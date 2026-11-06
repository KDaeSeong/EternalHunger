const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const mongoose = require('mongoose');
const Room = require('../models/TwentyQuestionsRoom');

const HOST = '64b000000000000000000001';
const PLAYER = '64b000000000000000000002';
const OTHER = '64b000000000000000000003';
const ROOM = '64b000000000000000000010';
const QUESTION = '64b000000000000000000020';
const copy = (value) => value == null ? value : mongoose.mongo.BSON.deserialize(mongoose.mongo.BSON.serialize({ value })).value;
const same = (left, right) => String(left) === String(right);
const get = (value, path) => path.split('.').reduce((row, key) => row?.[key], value);
function put(value, path, next) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((row, key) => row[key] ??= {}, value);
  parent[last] = copy(next);
}

// The adapter replaces persistence IO only. Routes, rules, schema validation,
// Mongoose document dirty tracking and save-generated updates remain real.
function expression(value, row, variables = {}) {
  if (typeof value === 'string') {
    if (value.startsWith('$$')) return get(variables, value.slice(2));
    if (value.startsWith('$')) return get(row, value.slice(1));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => expression(item, row, variables));
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof mongoose.Types.ObjectId) return value;
  if ('$literal' in value) return value.$literal;
  if ('$ifNull' in value) { const [first, fallback] = expression(value.$ifNull, row, variables); return first ?? fallback; }
  if ('$eq' in value) { const [left, right] = expression(value.$eq, row, variables); return same(left, right); }
  if ('$ne' in value) { const [left, right] = expression(value.$ne, row, variables); return !same(left, right); }
  if ('$gte' in value) { const [left, right] = expression(value.$gte, row, variables); return left >= right; }
  if ('$and' in value) return expression(value.$and, row, variables).every(Boolean);
  if ('$add' in value) return expression(value.$add, row, variables).reduce((sum, item) => sum + item, 0);
  if ('$concatArrays' in value) return expression(value.$concatArrays, row, variables).flat();
  if ('$slice' in value) { const [items, count] = expression(value.$slice, row, variables); return count < 0 ? items.slice(count) : items.slice(0, count); }
  if ('$filter' in value) {
    const filter = value.$filter;
    return expression(filter.input, row, variables).filter((item) => expression(filter.cond, row, { ...variables, [filter.as]: item }));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expression(item, row, variables)]));
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$expr') return expression(value, row);
    if (key === '$or') return value.some((condition) => matches(row, condition));
    if (value && typeof value === 'object' && '$exists' in value) return (get(row, key) !== undefined) === value.$exists;
    if (value && typeof value === 'object' && '$elemMatch' in value) return (row[key] || []).some((item) => matches(item, value.$elemMatch));
    return same(get(row, key), value);
  });
}
function applyUpdate(row, update) {
  if (Array.isArray(update)) {
    for (const stage of update) {
      const fields = Object.fromEntries(Object.entries(stage.$set).map(([key, value]) => [key, expression(value, row)]));
      for (const [key, value] of Object.entries(fields)) put(row, key, value);
    }
    return;
  }
  for (const [path, value] of Object.entries(update.$set || {})) put(row, path, value);
  for (const [path, value] of Object.entries(update.$inc || {})) put(row, path, (get(row, path) || 0) + value);
  for (const [path, value] of Object.entries(update.$push || {})) {
    const items = get(row, path) || [];
    put(row, path, [...items, ...(value.$each || [value])]);
  }
}

function fixture(t, overrides = {}) {
  const routes = new Map();
  const notifications = [];
  let barrier = null;
  let preferredStatus = null;
  let releasePreferred = null;
  let preferredDone = null;
  let beforeGameWrite = null;
  let row = copy({
    _id: new mongoose.Types.ObjectId(ROOM), hostId: new mongoose.Types.ObjectId(HOST),
    title: 'Concurrent room', answer: 'apple', hint: '', category: 'free', status: 'active',
    maxQuestions: 20, questions: [], guesses: [], hintMessages: [], presence: [], __v: 0,
    ...overrides,
  });
  const originalUpdate = Room.collection.updateOne;
  const originalFindUpdate = Room.collection.findOneAndUpdate;
  const write = async (filter, update, resultDocument) => {
    const nextStatus = Array.isArray(update) ? update[0].$set.status?.$literal : update.$set?.status;
    if (preferredStatus && nextStatus !== preferredStatus) await preferredDone;
    if (beforeGameWrite && filter.$expr) {
      const callback = beforeGameWrite;
      beforeGameWrite = null;
      await callback();
    }
    if (!matches(row, filter)) return resultDocument ? null : { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    applyUpdate(row, update);
    if (preferredStatus && nextStatus === preferredStatus) { preferredStatus = null; releasePreferred(); }
    return resultDocument ? copy(row) : { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  };
  Room.collection.updateOne = async (filter, update) => {
    return write(filter, update, false);
  };
  Room.collection.findOneAndUpdate = async (filter, update) => {
    return write(filter, update, true);
  };
  t.after(() => { Room.collection.updateOne = originalUpdate; Room.collection.findOneAndUpdate = originalFindUpdate; });
  const model = {
    ROOM_CATEGORIES: Room.ROOM_CATEGORIES,
    findOneAndUpdate: (...args) => Room.findOneAndUpdate(...args),
    findById() {
      const snapshot = copy(row);
      const readBarrier = barrier;
      return {
        populate() { return this; },
        async lean() {
          const populated = copy(row);
          const user = (id) => ({ _id: id, nickname: same(id, HOST) ? 'Host' : 'Player' });
          populated.hostId = user(populated.hostId);
          if (populated.solvedBy) populated.solvedBy = user(populated.solvedBy);
          populated.questions.forEach((question) => { question.askerId = user(question.askerId); });
          populated.guesses.forEach((guess) => { guess.guesserId = user(guess.guesserId); });
          populated.hintMessages.forEach((hint) => { hint.authorId = user(hint.authorId); });
          populated.presence.forEach((entry) => { entry.userId = user(entry.userId); });
          return populated;
        },
        then(resolve, reject) {
          const waiting = readBarrier ? readBarrier() : Promise.resolve();
          return waiting.then(() => Room.hydrate(snapshot)).then(resolve, reject);
        },
      };
    },
  };
  const routePath = require.resolve('../routes/twentyQuestions');
  const realRequire = createRequire(routePath);
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(routePath, 'utf8'), {
    module, console: { error() {} }, Date,
    require(name) {
      if (name === 'express') return { Router: () => ({ get(path, ...handlers) { routes.set(`GET ${path}`, handlers); }, post(path, ...handlers) { routes.set(`POST ${path}`, handlers); } }) };
      if (name === '../models/TwentyQuestionsRoom') return model;
      if (name === '../middleware/authMiddleware') return { verifyToken(req, res, next) { if (!req.user) return res.status(401).json({ error: 'Auth required' }); return next(); } };
      if (name === '../utils/notifications') return { async createNotification(input) { notifications.push(copy(input)); } };
      return realRequire(name);
    },
  }, { filename: routePath });
  return {
    row: () => copy(row), notifications,
    preferTerminalWrite(status) {
      preferredStatus = status;
      preferredDone = new Promise((resolve) => { releasePreferred = resolve; });
    },
    beforeNextGameWrite(callback) { beforeGameWrite = callback; },
    synchronizeReads(count) {
      let arrived = 0, release;
      const waiting = new Promise((resolve) => { release = resolve; });
      barrier = () => { if (++arrived === count) { barrier = null; release(); } return waiting; };
    },
    async call(path, user = PLAYER, body = {}, params = {}) {
      const handlers = routes.get(path.startsWith('GET ') ? path : `POST ${path}`);
      const req = { user: user ? { id: user } : null, body, params: { id: ROOM, questionId: QUESTION, ...params } };
      const result = { status: 200, body: null };
      const res = { status(status) { result.status = status; return this; }, json(value) { result.body = value; return this; } };
      const dispatch = async (index) => { if (index < handlers.length) await handlers[index](req, res, () => dispatch(index + 1)); };
      await dispatch(0);
      return result;
    },
  };
}
function questions(count = 1) {
  return Array.from({ length: count }, (_, index) => ({ _id: new mongoose.Types.ObjectId(index === 0 ? QUESTION : undefined), askerId: new mongoose.Types.ObjectId(PLAYER), text: `Question ${index}`, response: 'pending', createdAt: new Date('2026-11-01T00:00:00Z'), updatedAt: new Date('2026-11-01T00:00:00Z') }));
}

test('Twenty Questions actual routes reject stale game mutations', async (t) => {
  await t.test('question and guess share the final available attempt atomically', async (t) => {
    const f = fixture(t, { questions: questions(19) });
    f.synchronizeReads(2);
    const results = await Promise.all([f.call('/:id/questions', PLAYER, { text: 'Another?' }), f.call('/:id/guesses', OTHER, { text: 'wrong' })]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.row().questions.length + f.row().guesses.length, 20);
  });
  await t.test('answered questions cannot be overwritten or notify twice', async (t) => {
    const f = fixture(t, { questions: questions() });
    assert.equal((await f.call('/:id/questions/:questionId/answer', HOST, { response: 'yes' })).status, 200);
    const firstDate = f.row().questions[0].answeredAt;
    assert.equal((await f.call('/:id/questions/:questionId/answer', HOST, { response: 'no' })).status, 409);
    assert.equal(f.row().questions[0].response, 'yes');
    assert.deepEqual(f.row().questions[0].answeredAt, firstDate);
    assert.equal(f.notifications.length, 1);
  });
  for (const first of ['close', 'guess']) {
    await t.test(`${first} racing a terminal mutation has only one winner`, async (t) => {
      const f = fixture(t);
      f.synchronizeReads(2);
      f.preferTerminalWrite(first === 'close' ? 'closed' : 'solved');
      const close = () => f.call('/:id/close', HOST);
      const guess = () => f.call('/:id/guesses', PLAYER, { text: 'apple' });
      const results = await Promise.all(first === 'close' ? [close(), guess()] : [guess(), close()]);
      assert.deepEqual(results.map((result) => result.status), [200, 409]);
      assert.equal(f.row().status, first === 'close' ? 'closed' : 'solved');
      assert.equal(f.row().guesses.length, first === 'close' ? 0 : 1);
      assert.equal(f.notifications.length, first === 'close' ? 0 : 1);
    });
  }

  await t.test('concurrent answers commit and notify only once', async (t) => {
    const f = fixture(t, { questions: questions() });
    f.synchronizeReads(2);
    const results = await Promise.all(['yes', 'no'].map((response) => f.call('/:id/questions/:questionId/answer', HOST, { response })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.notifications.length, 1);
    assert.equal(f.row().questions[0].response, results[0].status === 200 ? 'yes' : 'no');
  });
  await t.test('legacy missing revision accepts only one competing mutation', async (t) => {
    const f = fixture(t, { __v: undefined });
    f.synchronizeReads(2);
    const results = await Promise.all([f.call('/:id/questions', PLAYER, { text: 'First?' }), f.call('/:id/hints', HOST, { text: 'Hint' })]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.row().__v, 1);
    assert.equal(f.row().questions.length + f.row().hintMessages.length, 1);
  });
  await t.test('legacy missing question response keeps its schema pending default and allows only one answer', async (t) => {
    const legacy = questions();
    delete legacy[0].response;
    const f = fixture(t, { questions: legacy });
    assert.equal(Object.hasOwn(f.row().questions[0], 'response'), false);
    assert.equal((await f.call('GET /:id', HOST)).body.room.questions[0].response, 'pending');
    f.synchronizeReads(2);
    const results = await Promise.all(['yes', 'no'].map((response) => f.call('/:id/questions/:questionId/answer', HOST, { response })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.notifications.length, 1);
    assert.equal(f.row().questions[0].response, results[0].status === 200 ? 'yes' : 'no');
  });
  await t.test('legacy null response is pending and accepts exactly one answer', async (t) => {
    const legacy = questions();
    legacy[0].response = null;
    const f = fixture(t, { questions: legacy });
    assert.equal((await f.call('GET /:id', HOST)).body.room.questions[0].response, 'pending');
    f.synchronizeReads(2);
    const results = await Promise.all(['yes', 'no'].map((response) => f.call('/:id/questions/:questionId/answer', HOST, { response })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.notifications.length, 1);
  });
  await t.test('null pending questions delay exhaustion until their own final answer', async (t) => {
    const legacy = questions(20).map((question) => ({ ...question, response: 'no' }));
    legacy[0].response = null;
    legacy[1].response = 'pending';
    const f = fixture(t, { questions: legacy });
    const detail = await f.call('GET /:id', HOST);
    assert.equal(detail.body.room.pendingCount, 2);
    const answered = await f.call('/:id/questions/:questionId/answer', HOST, { response: 'yes' }, { questionId: String(legacy[1]._id) });
    assert.equal(answered.status, 200);
    assert.equal(answered.body.exhausted, false);
    assert.equal(f.row().status, 'active');
    assert.equal(answered.body.room.pendingCount, 1);
    assert.equal((await f.call('/:id/questions/:questionId/answer', HOST, { response: 'no' })).status, 200);
    assert.equal(f.row().status, 'closed');
  });
  await t.test('a twentieth wrong guess does not exhaust a null pending question', async (t) => {
    const legacy = questions(19).map((question) => ({ ...question, response: 'no' }));
    legacy[0].response = null;
    const f = fixture(t, { questions: legacy });
    const result = await f.call('/:id/guesses', PLAYER, { text: 'wrong' });
    assert.equal(result.status, 200);
    assert.equal(result.body.exhausted, false);
    assert.equal(f.row().status, 'active');
    assert.equal(result.body.room.answer, '');
  });
  await t.test('only pending or nullish responses accept answers; other stored values stay unchanged', async (t) => {
    const responses = ['yes', 'no', 'maybe', '', false, 0];
    const stored = questions(responses.length);
    stored.forEach((question, index) => { question.response = responses[index]; });
    const f = fixture(t, { questions: stored });
    for (const [index, response] of responses.entries()) {
      assert.equal((await f.call('/:id/questions/:questionId/answer', HOST, { response: 'yes' }, { questionId: String(stored[index]._id) })).status, 409);
      assert.equal(f.row().questions[index].response, response);
      assert.equal(f.row().__v, 0);
      assert.equal(f.notifications.length, 0);
    }
  });
  await t.test('a concurrent heartbeat survives gameplay and immediate solving registers its actor', async (t) => {
    const f = fixture(t);
    f.beforeNextGameWrite(async () => { assert.equal((await f.call('/:id/presence', OTHER)).status, 200); });
    assert.equal((await f.call('/:id/guesses', PLAYER, { text: 'apple' })).status, 200);
    assert.equal(f.row().status, 'solved');
    assert.deepEqual(f.row().presence.map((entry) => String(entry.userId)).sort(), [OTHER, PLAYER].sort());
    assert.equal(f.row().__v, 1);
  });
  await t.test('heartbeat renews one actor, retains other live actors, and prunes expired actors', async (t) => {
    const f = fixture(t, { presence: [
      { userId: new mongoose.Types.ObjectId(HOST), lastSeenAt: new Date() },
      { userId: new mongoose.Types.ObjectId(PLAYER), lastSeenAt: new Date() },
      { userId: new mongoose.Types.ObjectId(OTHER), lastSeenAt: new Date(Date.now() - 30_000) },
    ] });
    assert.equal((await f.call('/:id/presence', PLAYER)).status, 200);
    assert.deepEqual(f.row().presence.map((entry) => String(entry.userId)).sort(), [HOST, PLAYER].sort());
    assert.equal(f.row().__v, 0);
  });
  await t.test('the twentieth question stays pending, then its final answer closes the room', async (t) => {
    const oldQuestions = questions(19).map((question) => ({ ...question, response: 'no' }));
    const f = fixture(t, { questions: oldQuestions });
    const question = await f.call('/:id/questions', PLAYER, { text: '$literal is plain user text?' });
    assert.equal(question.status, 200);
    assert.equal(f.row().status, 'active');
    assert.equal(question.body.room.answer, '');
    assert.equal(f.row().questions.at(-1).text, '$literal is plain user text?');
    assert.ok(f.row().questions.at(-1).createdAt instanceof Date);
    const denied = await f.call('/:id/guesses', OTHER, { text: 'apple' });
    assert.equal(denied.status, 400);
    assert.equal(f.row().status, 'active');
    const answered = await f.call('/:id/questions/:questionId/answer', HOST, { response: 'yes' }, { questionId: String(f.row().questions.at(-1)._id) });
    assert.equal(answered.status, 200);
    assert.equal(answered.body.exhausted, true);
    assert.equal(answered.body.room.answer, 'apple');
    assert.equal(f.row().status, 'closed');
  });
  await t.test('a twentieth wrong guess waits for existing pending questions', async (t) => {
    const f = fixture(t, { questions: questions(19) });
    const result = await f.call('/:id/guesses', PLAYER, { text: 'wrong' });
    assert.equal(result.status, 200);
    assert.equal(result.body.exhausted, false);
    assert.equal(f.row().status, 'active');
    assert.equal(result.body.room.answer, '');
  });
  await t.test('closing rejects a concurrent hint rather than saving it after termination', async (t) => {
    const f = fixture(t);
    f.synchronizeReads(2);
    f.preferTerminalWrite('closed');
    const results = await Promise.all([f.call('/:id/close', HOST), f.call('/:id/hints', HOST, { text: 'Too late' })]);
    assert.deepEqual(results.map((result) => result.status), [200, 409]);
    assert.equal(f.row().hintMessages.length, 0);
  });
  await t.test('two correct guesses have one recorded solver and one notification', async (t) => {
    const f = fixture(t);
    f.synchronizeReads(2);
    const results = await Promise.all([PLAYER, OTHER].map((user) => f.call('/:id/guesses', user, { text: 'apple' })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.row().guesses.length, 1);
    assert.equal(f.notifications.length, 1);
    assert.equal(String(f.row().solvedBy), String(f.row().guesses[0].guesserId));
  });
  await t.test('existing authentication and host authority stay enforced without writes', async (t) => {
    const f = fixture(t, { questions: questions() });
    for (const path of ['/:id/questions', '/:id/guesses', '/:id/hints', '/:id/close', '/:id/questions/:questionId/answer']) {
      assert.equal((await f.call(path, null, { text: 'Text', response: 'yes' })).status, 401);
    }
    for (const path of ['/:id/questions', '/:id/guesses']) assert.equal((await f.call(path, HOST, { text: 'Text' })).status, 403);
    for (const path of ['/:id/hints', '/:id/close', '/:id/questions/:questionId/answer']) assert.equal((await f.call(path, PLAYER, { text: 'Text', response: 'yes' })).status, 403);
    assert.equal(f.row().__v, 0);
    assert.equal(f.notifications.length, 0);
  });
  await t.test('public detail keeps the active answer private and reveals a committed terminal answer', async (t) => {
    const f = fixture(t);
    for (const user of [null, PLAYER]) {
      const detail = await f.call('GET /:id', user);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.room.answer, '');
      assert.equal(detail.body.room.answerRevealed, false);
    }
    assert.equal((await f.call('GET /:id', HOST)).body.room.answer, 'apple');
    assert.equal(f.row().__v, 0);
    assert.equal((await f.call('/:id/close', HOST)).status, 200);
    assert.equal((await f.call('GET /:id', null)).body.room.answer, 'apple');
    assert.equal(f.row().__v, 1);
  });
});
