import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const summary = {
  schema: 'eh-twenty-questions-mongo-integration.v1', startedUtc: new Date().toISOString(),
  status: 'failed', checks: [], cleanup: { databaseDropped: false, disconnected: false, httpClosed: false },
  scope: 'synthetic loopback HTTP, independent JWT actors, actual routes/auth/models/Mongo; not browser or natural session expiry acceptance',
};
let server;
let databaseOwned = false;
let databaseName;
let manifest;
let manifestPath;
let baseUrl;
let Room;
let User;
let Notification;
let host;
let player;
let other;
let readGate = null;
let writeGate = null;
let beforeWrite = null;
let restoreQueries = () => {};

function validateManifest(input, filename) {
  assert.ok(['started', 'ready', 'running'].includes(input.status), 'fixture manifest must describe a started live fixture');
  assert.equal(input.bindIp, '127.0.0.1', 'fixture must bind exclusively to IPv4 loopback');
  assert.ok(Number.isSafeInteger(input.port) && input.port > 1024 && input.port <= 65535, 'invalid fixture port');
  assert.ok(Number.isSafeInteger(input.pid) && input.pid > 0, 'fixture PID is required');
  assert.ok(Number.isSafeInteger(input.ownerPid) && input.ownerPid > 0, 'fixture owner PID is required');
  const root = path.resolve(input.fixtureRoot);
  assert.equal(path.dirname(path.resolve(filename)), root, 'manifest must be inside its owned fixture directory');
  const match = /^fixture-([a-f0-9]{12})$/.exec(path.basename(root));
  assert.ok(match, 'fixture directory must contain the explicit random run ID');
  const runId = match[1];
  assert.equal(input.databaseName, `eh_tq_test_${runId}`, 'database prefix must match this fixture run ID');
  assert.equal(input.replicaSet, `eh_tq_fixture_${runId}`, 'replica set must match this fixture run ID');
  assert.equal(path.resolve(input.dataPath), path.join(root, 'data'), 'data directory must be the owned fixture data directory');
  assert.ok(/^[a-f0-9]{64}$/i.test(input.binarySha256), 'binary integrity metadata is required');
  const started = Date.parse(input.startedUtc);
  assert.ok(Number.isFinite(started) && started <= Date.now() + 60_000 && Date.now() - started < 2 * 60 * 60_000, 'refusing a stale fixture manifest');
  return runId;
}

async function check(name, operation) {
  const started = Date.now();
  try { await operation(); } catch (error) {
    summary.failedCheck = name;
    throw error;
  }
  summary.checks.push({ name, status: 'pass', elapsedMs: Date.now() - started });
}

async function request(route, actor = player, body, method = 'POST') {
  const headers = { Accept: 'application/json' };
  if (actor?.token) headers.Authorization = `Bearer ${actor.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api/twenty-questions${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

function pendingQuestions(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(), askerId: player.id, text: `Synthetic question ${index}`,
    response: 'pending', createdAt: now, updatedAt: now,
  }));
}

async function newRoom(overrides = {}) {
  const response = await request('/', host, { title: 'Synthetic concurrency verification', answer: 'apple', category: 'free' });
  assert.equal(response.status, 200, 'actual room creation must succeed');
  assert.equal(response.data.room.answer, 'apple');
  const id = response.data.room._id;
  if (Object.keys(overrides).length) await Room.updateOne({ _id: id }, { $set: overrides }, { runValidators: true });
  return id;
}

function synchronizeReads(id) {
  let arrived = 0;
  let release;
  let reject;
  const waiting = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const timer = setTimeout(() => reject(new Error('two actual Mongo read snapshots did not arrive')), 6000);
  readGate = {
    id,
    async arrive() {
      if (++arrived === 2) { clearTimeout(timer); readGate = null; release(); }
      await waiting;
    },
    cancel() { clearTimeout(timer); release(); },
  };
}

function preferTerminalWrite(id, status) {
  let release;
  let reject;
  const waiting = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const timer = setTimeout(() => reject(new Error('preferred actual Mongo terminal write did not arrive')), 6000);
  writeGate = { id, status, waiting, release() { clearTimeout(timer); writeGate = null; release(); }, cancel() { clearTimeout(timer); release(); } };
}

// These wrappers delay completed real reads or the start of real writes. They
// never substitute a document, query result, write, update pipeline or database.
function installTimingControls() {
  const originalFind = Room.findById;
  const originalUpdate = Room.findOneAndUpdate;
  Room.findById = function(id, ...args) {
    const query = originalFind.call(this, id, ...args);
    const originalExec = query.exec;
    query.exec = async function(...execArgs) {
      const value = await originalExec.apply(this, execArgs);
      const gate = readGate;
      if (gate && String(id) === gate.id && !this.mongooseOptions().lean) await gate.arrive();
      return value;
    };
    return query;
  };
  Room.findOneAndUpdate = function(filter, ...args) {
    const query = originalUpdate.call(this, filter, ...args);
    const originalExec = query.exec;
    query.exec = async function(...execArgs) {
      const gate = writeGate;
      const status = this.getUpdate()?.[0]?.$set?.status?.$literal;
      if (gate && String(filter._id) === gate.id && status !== gate.status) await gate.waiting;
      if (beforeWrite && filter.$expr) {
        const callback = beforeWrite;
        beforeWrite = null;
        await callback();
      }
      const value = await originalExec.apply(this, execArgs);
      if (gate && String(filter._id) === gate.id && status === gate.status) gate.release();
      return value;
    };
    return query;
  };
  restoreQueries = () => { Room.findById = originalFind; Room.findOneAndUpdate = originalUpdate; };
}

async function persisted(id) {
  return Room.findById(id).lean();
}
async function notificationCount(id, type) {
  return Notification.countDocuments({ 'meta.roomId': id, ...(type ? { type } : {}) });
}
function oneWinner(results) {
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const loser = results.find((result) => result.status === 409);
  assert.equal(loser.data.code, 'TWENTY_QUESTIONS_CONFLICT');
  assert.equal(Object.hasOwn(loser.data, 'room'), false, 'conflicts cannot leak stale/raw room state');
}

try {
  assert.ok(process.env.TQ_TEST_MONGO_MANIFEST, 'TQ_TEST_MONGO_MANIFEST is required; there is no fallback or skip');
  manifestPath = await realpath(process.env.TQ_TEST_MONGO_MANIFEST);
  const rawManifest = await readFile(manifestPath);
  manifest = JSON.parse(rawManifest);
  const runId = validateManifest(manifest, manifestPath);
  databaseName = `${manifest.databaseName}_${randomBytes(6).toString('hex')}`;
  assert.match(databaseName, new RegExp(`^eh_tq_test_${runId}_[a-f0-9]{12}$`));
  const uri = new URL(`mongodb://127.0.0.1:${manifest.port}/${databaseName}`);
  uri.searchParams.set('replicaSet', manifest.replicaSet);
  assert.equal(uri.hostname, '127.0.0.1');
  assert.equal(uri.username, '');
  assert.equal(uri.password, '');
  summary.fixture = { runId, manifestSha256: sha256(rawManifest), databaseName, port: manifest.port, pid: manifest.pid };
  const sourcePaths = [
    'routes/twentyQuestions.js', 'models/TwentyQuestionsRoom.js', 'models/User.js',
    'middleware/authMiddleware.js', 'utils/twentyQuestionsRules.js', 'utils/notifications.js',
    'tests/integration/twenty-questions-mongo.mjs',
  ];
  const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
  summary.sources = await Promise.all(sourcePaths.map(async (filename) => ({ path: `server/${filename}`, sha256: sha256(await readFile(path.join(serverRoot, filename))) })));
  // A fresh per-process secret replaces any inherited value before auth modules
  // load. No dotenv, production entry point or external authentication is used.
  process.env.MY_SECRET_KEY = randomBytes(32).toString('hex');
  mongoose.set('autoIndex', false);
  await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 10_000, maxPoolSize: 8 });
  assert.equal(mongoose.connection.name, databaseName);
  const admin = mongoose.connection.db.admin();
  const hello = await admin.command({ hello: 1 });
  assert.equal(hello.setName, manifest.replicaSet);
  assert.equal(hello.isWritablePrimary, true);
  const options = await admin.command({ getCmdLineOpts: 1 });
  assert.equal(path.resolve(options.parsed.storage.dbPath), path.resolve(manifest.dataPath));
  assert.equal(options.parsed.net.port, manifest.port);
  assert.equal(options.parsed.net.bindIp, manifest.bindIp);
  const serverStatus = await admin.command({ serverStatus: 1 });
  assert.equal(Number(serverStatus.pid), manifest.pid, 'connected Mongo PID must match the live ownership manifest');
  const build = await admin.command({ buildInfo: 1 });
  summary.runtime = { node: process.version, mongoose: mongoose.version, mongodb: build.version, writablePrimary: true, pidVerified: true };
  assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, 'random test database must not already contain collections');
  databaseOwned = true;
  Room = require('../../models/TwentyQuestionsRoom');
  User = require('../../models/User');
  Notification = require('../../models/Notification');
  const { optionalAuth } = require('../../middleware/authMiddleware');
  const router = require('../../routes/twentyQuestions');
  const actors = await User.create(['host', 'player', 'other'].map((label) => ({
    username: `tq_${runId}_${label}`, nickname: label, password: randomBytes(18).toString('hex'),
  })));
  [host, player, other] = actors.map((user) => ({ id: user._id, token: jwt.sign({ id: String(user._id), tv: 0 }, process.env.MY_SECRET_KEY, { expiresIn: '15m' }) }));
  assert.notEqual(host.token, player.token);
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/twenty-questions', optionalAuth, router);
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  installTimingControls();

  await check('shared twentieth attempt: actual question/guess race and persisted limit', async () => {
    const id = await newRoom({ questions: pendingQuestions(19) });
    synchronizeReads(id);
    const results = await Promise.all([request(`/${id}/questions`, player, { text: 'One more?' }), request(`/${id}/guesses`, other, { text: 'wrong' })]);
    oneWinner(results);
    const saved = await persisted(id);
    assert.equal(saved.questions.length + saved.guesses.length, 20);
    assert.equal(saved.__v, 1);
    assert.equal(await notificationCount(id), results[0].status === 200 ? 1 : 0);
  });
  await check('answered question retry leaves response/date and one real notification unchanged', async () => {
    const id = await newRoom({ questions: pendingQuestions(1) });
    const questionId = String((await persisted(id)).questions[0]._id);
    assert.equal((await request(`/${id}/questions/${questionId}/answer`, host, { response: 'yes' })).status, 200);
    const first = (await persisted(id)).questions[0];
    assert.equal((await request(`/${id}/questions/${questionId}/answer`, host, { response: 'no' })).status, 409);
    const saved = (await persisted(id)).questions[0];
    assert.equal(saved.response, 'yes');
    assert.deepEqual(saved.answeredAt, first.answeredAt);
    assert.equal(await notificationCount(id, 'twenty_answer'), 1);
  });
  await check('two pending answers race: exactly one database update and notification', async () => {
    const id = await newRoom({ questions: pendingQuestions(1) });
    const questionId = String((await persisted(id)).questions[0]._id);
    synchronizeReads(id);
    const results = await Promise.all(['yes', 'no'].map((response) => request(`/${id}/questions/${questionId}/answer`, host, { response })));
    oneWinner(results);
    assert.equal((await persisted(id)).questions[0].response, results[0].status === 200 ? 'yes' : 'no');
    assert.equal(await notificationCount(id, 'twenty_answer'), 1);
  });
  await check('legacy missing question response keeps the actual Mongoose pending default and accepts one answer', async () => {
    const id = await newRoom({ questions: pendingQuestions(1) });
    const questionId = String((await persisted(id)).questions[0]._id);
    await Room.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { 'questions.0.response': '' } });
    const rawBefore = await Room.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.equal(Object.hasOwn(rawBefore.questions[0], 'response'), false);
    const detail = await request(`/${id}`, host, undefined, 'GET');
    assert.equal(detail.data.room.questions[0].response, 'pending');
    assert.equal(detail.data.room.pendingCount, 1);
    const result = await request(`/${id}/questions/${questionId}/answer`, host, { response: 'yes' });
    if (result.status !== 200) summary.failureEvidence = { syntheticRoomId: id, questionId, rawResponseMissing: true, displayedResponse: detail.data.room.questions[0].response, answerHttpStatus: result.status, persistedRevision: (await persisted(id)).__v };
    assert.equal(result.status, 200);
    const saved = await persisted(id);
    assert.equal(saved.questions[0].response, 'yes');
    assert.ok(saved.questions[0].answeredAt instanceof Date);
    assert.ok(saved.questions[0].updatedAt instanceof Date);
    assert.equal((await request(`/${id}/questions/${questionId}/answer`, host, { response: 'no' })).status, 409);
    assert.equal(await notificationCount(id, 'twenty_answer'), 1);
  });
  await check('legacy null response races as pending with one committed answer and notification', async () => {
    const legacy = pendingQuestions(1);
    legacy[0].response = null;
    const id = await newRoom({ questions: legacy });
    const questionId = String((await persisted(id)).questions[0]._id);
    const detail = await request(`/${id}`, host, undefined, 'GET');
    assert.equal(detail.data.room.questions[0].response, 'pending');
    assert.equal(detail.data.room.pendingCount, 1);
    synchronizeReads(id);
    const results = await Promise.all(['yes', 'no'].map((response) => request(`/${id}/questions/${questionId}/answer`, host, { response })));
    oneWinner(results);
    assert.equal(await notificationCount(id, 'twenty_answer'), 1);
    assert.equal((await persisted(id)).questions[0].response, results[0].status === 200 ? 'yes' : 'no');
  });
  await check('exhaustion waits for a null pending question after another final answer', async () => {
    const legacy = pendingQuestions(20).map((question) => ({ ...question, response: 'no' }));
    legacy[0].response = null;
    legacy[1].response = 'pending';
    const id = await newRoom({ questions: legacy });
    assert.equal((await request(`/${id}`, host, undefined, 'GET')).data.room.pendingCount, 2);
    const first = await request(`/${id}/questions/${legacy[1]._id}/answer`, host, { response: 'yes' });
    assert.equal(first.status, 200);
    assert.equal(first.data.exhausted, false);
    assert.equal(first.data.room.pendingCount, 1);
    assert.equal((await persisted(id)).status, 'active');
    const last = await request(`/${id}/questions/${legacy[0]._id}/answer`, host, { response: 'no' });
    assert.equal(last.status, 200);
    assert.equal(last.data.exhausted, true);
    assert.equal((await persisted(id)).status, 'closed');
    assert.equal(await notificationCount(id, 'twenty_answer'), 2);
  });
  await check('twentieth wrong guess waits for a null pending question', async () => {
    const legacy = pendingQuestions(19).map((question) => ({ ...question, response: 'no' }));
    legacy[0].response = null;
    const id = await newRoom({ questions: legacy });
    const result = await request(`/${id}/guesses`, player, { text: 'wrong' });
    assert.equal(result.status, 200);
    assert.equal(result.data.exhausted, false);
    assert.equal(result.data.room.answer, '');
    assert.equal((await persisted(id)).status, 'active');
  });
  await check('nonpending values including empty, false and zero cannot be overwritten', async () => {
    const values = ['yes', 'no', 'maybe', '', false, 0];
    const id = await newRoom({ questions: pendingQuestions(values.length) });
    const stored = (await persisted(id)).questions;
    stored.forEach((question, index) => { question.response = values[index]; });
    await Room.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { questions: stored } });
    for (const question of stored) assert.equal((await request(`/${id}/questions/${question._id}/answer`, host, { response: 'yes' })).status, 409);
    const raw = await Room.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.deepEqual(raw.questions.map((question) => question.response), values);
    assert.equal(raw.__v, 0);
    assert.equal(await notificationCount(id), 0);
  });
  for (const first of ['closed', 'solved']) {
    await check(`${first} wins the actual close/correct-guess race without terminal reversal`, async () => {
      const id = await newRoom();
      synchronizeReads(id);
      preferTerminalWrite(id, first);
      const results = await Promise.all([request(`/${id}/close`, host), request(`/${id}/guesses`, player, { text: 'apple' })]);
      oneWinner(results);
      assert.equal(results[first === 'closed' ? 0 : 1].status, 200);
      const saved = await persisted(id);
      assert.equal(saved.status, first);
      assert.equal(saved.guesses.length, first === 'solved' ? 1 : 0);
      assert.equal(await notificationCount(id, 'twenty_solved'), first === 'solved' ? 1 : 0);
    });
  }
  await check('close prevents a delayed actual hint write', async () => {
    const id = await newRoom();
    synchronizeReads(id);
    preferTerminalWrite(id, 'closed');
    const results = await Promise.all([request(`/${id}/close`, host), request(`/${id}/hints`, host, { text: 'Late hint' })]);
    oneWinner(results);
    assert.equal(results[0].status, 200);
    assert.equal((await persisted(id)).hintMessages.length, 0);
  });
  await check('legacy missing __v admits only one actual game write', async () => {
    const id = await newRoom();
    await Room.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { __v: '' } });
    assert.equal(Object.hasOwn(await persisted(id), '__v'), false);
    synchronizeReads(id);
    oneWinner(await Promise.all([request(`/${id}/questions`, player, { text: 'Legacy question?' }), request(`/${id}/hints`, host, { text: 'Legacy hint' })]));
    const saved = await persisted(id);
    assert.equal(saved.__v, 1);
    assert.equal(saved.questions.length + saved.hintMessages.length, 1);
  });
  await check('actual heartbeat survives immediate solving and solver registration', async () => {
    const id = await newRoom();
    beforeWrite = async () => { assert.equal((await request(`/${id}/presence`, other)).status, 200); };
    assert.equal((await request(`/${id}/guesses`, player, { text: 'apple' })).status, 200);
    const saved = await persisted(id);
    assert.equal(saved.status, 'solved');
    assert.ok(saved.presence.some((entry) => String(entry.userId) === String(other.id)));
    assert.ok(saved.presence.some((entry) => String(entry.userId) === String(player.id)));
    assert.equal(saved.__v, 1);
  });
  await check('actual presence filter retains peers, renews self, expires old rows without advancing revision', async () => {
    const id = await newRoom({ presence: [
      { userId: host.id, lastSeenAt: new Date() }, { userId: player.id, lastSeenAt: new Date() },
      { userId: other.id, lastSeenAt: new Date(Date.now() - 30_000) },
    ] });
    assert.equal((await request(`/${id}/presence`, player)).status, 200);
    const saved = await persisted(id);
    assert.deepEqual(saved.presence.map((entry) => String(entry.userId)).sort(), [String(host.id), String(player.id)].sort());
    assert.equal(saved.__v, 0);
  });
  await check('twentieth pending question stays active; final host answer closes and reveals', async () => {
    const id = await newRoom({ questions: pendingQuestions(19).map((question) => ({ ...question, response: 'no' })) });
    const added = await request(`/${id}/questions`, player, { text: '$literal user text stays literal?' });
    assert.equal(added.status, 200);
    assert.equal(added.data.room.answer, '');
    const before = await persisted(id);
    assert.equal(before.status, 'active');
    assert.equal(before.questions.at(-1).text, '$literal user text stays literal?');
    assert.ok(before.questions.at(-1).createdAt instanceof Date);
    assert.ok(before.questions.at(-1).updatedAt instanceof Date);
    assert.equal((await request(`/${id}/guesses`, other, { text: 'apple' })).status, 400);
    const answered = await request(`/${id}/questions/${before.questions.at(-1)._id}/answer`, host, { response: 'yes' });
    assert.equal(answered.status, 200);
    assert.equal(answered.data.exhausted, true);
    assert.equal((await persisted(id)).status, 'closed');
    assert.equal((await request(`/${id}`, null, undefined, 'GET')).data.room.answer, 'apple');
  });
  await check('twentieth wrong guess waits for existing pending questions', async () => {
    const id = await newRoom({ questions: pendingQuestions(19) });
    const result = await request(`/${id}/guesses`, player, { text: 'wrong' });
    assert.equal(result.status, 200);
    assert.equal(result.data.exhausted, false);
    assert.equal(result.data.room.answer, '');
    assert.equal((await persisted(id)).status, 'active');
  });
  await check('two correct guesses record one solver and one persisted notification', async () => {
    const id = await newRoom();
    synchronizeReads(id);
    oneWinner(await Promise.all([player, other].map((actor) => request(`/${id}/guesses`, actor, { text: 'apple' }))));
    const saved = await persisted(id);
    assert.equal(saved.guesses.length, 1);
    assert.equal(String(saved.solvedBy), String(saved.guesses[0].guesserId));
    assert.equal(await notificationCount(id, 'twenty_solved'), 1);
  });
  await check('actual JWT identity, host authority, public secrecy and terminal reveal', async () => {
    const id = await newRoom({ questions: pendingQuestions(1) });
    const questionId = String((await persisted(id)).questions[0]._id);
    for (const suffix of ['/questions', '/guesses', '/hints', '/close', `/questions/${questionId}/answer`]) {
      assert.equal((await request(`/${id}${suffix}`, null, { text: 'Synthetic', response: 'yes' })).status, 401);
    }
    for (const suffix of ['/questions', '/guesses']) assert.equal((await request(`/${id}${suffix}`, host, { text: 'Synthetic' })).status, 403);
    for (const suffix of ['/hints', '/close', `/questions/${questionId}/answer`]) assert.equal((await request(`/${id}${suffix}`, player, { text: 'Synthetic', response: 'yes' })).status, 403);
    for (const actor of [null, player]) {
      const detail = await request(`/${id}`, actor, undefined, 'GET');
      assert.equal(detail.status, 200);
      assert.equal(detail.data.room.answer, '');
      assert.equal(detail.data.room.answerRevealed, false);
    }
    assert.equal((await request(`/${id}`, host, undefined, 'GET')).data.room.answer, 'apple');
    const list = await request('/', null, undefined, 'GET');
    assert.equal(list.status, 200);
    assert.equal(list.data.rooms.some((room) => Object.hasOwn(room, 'answer')), false);
    assert.equal((await persisted(id)).__v, 0);
    assert.equal(await notificationCount(id), 0);
    assert.equal((await request(`/${id}/close`, host)).status, 200);
    assert.equal((await request(`/${id}`, null, undefined, 'GET')).data.room.answer, 'apple');
  });
  summary.status = 'passed';
} catch (error) {
  summary.error = { name: error.name, message: String(error.message).slice(0, 1500), code: error.code ?? null };
  process.exitCode = 1;
} finally {
  readGate?.cancel();
  writeGate?.cancel();
  restoreQueries();
  if (server) {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    summary.cleanup.httpClosed = !server.listening;
  }
  if (databaseOwned && mongoose.connection.readyState === 1) {
    try {
      const current = JSON.parse(await readFile(manifestPath));
      validateManifest(current, manifestPath);
      assert.equal(current.pid, manifest.pid);
      assert.equal(current.databaseName, manifest.databaseName);
      assert.equal(mongoose.connection.name, databaseName);
      assert.match(databaseName, new RegExp(`^${manifest.databaseName}_[a-f0-9]{12}$`));
      await mongoose.connection.dropDatabase();
      assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
      summary.cleanup.databaseDropped = true;
    } catch (error) {
      summary.cleanup.error = String(error.message).slice(0, 800);
      summary.status = 'failed';
      process.exitCode = 1;
    }
  }
  try { await mongoose.disconnect(); summary.cleanup.disconnected = true; } catch (error) {
    summary.cleanup.disconnectError = String(error.message).slice(0, 800);
    summary.status = 'failed'; process.exitCode = 1;
  }
  summary.finishedUtc = new Date().toISOString();
  summary.passedChecks = summary.checks.length;
  console.log(JSON.stringify(summary));
}
