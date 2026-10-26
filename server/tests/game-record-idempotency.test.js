const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');

const USER_A = '64b000000000000000000001';
const USER_B = '64b000000000000000000002';
const GAME = 'primitive-archive';

function clone(value) {
  return structuredClone(value);
}

function nestedRunId(row) {
  return row?.payload?.state?.runId;
}

function matchesFilter(row, filter) {
  if (String(row.userId) !== String(filter.userId) || row.gameSlug !== filter.gameSlug) return false;
  if (!Array.isArray(filter.$or)) return true;
  return filter.$or.some((condition) => {
    if (condition.clientRunId !== undefined) return row.clientRunId === condition.clientRunId;
    return nestedRunId(row) === condition['payload.state.runId'];
  });
}

function makeFixture() {
  const rows = [];
  const routes = new Map();
  const events = [];
  let nextId = 1;
  let failNextCreate = false;
  let failNextIndex = false;
  let createQueue = Promise.resolve();
  let lookupBarrier = null;

  const GamePlayRecord = {
    db: { async transaction(callback) { return callback({ transaction: true }); } },
    async ensureRunIdentityIndex() {
      events.push('ensure-index');
      if (failNextIndex) {
        failNextIndex = false;
        throw new Error('injected index creation failure');
      }
    },
    findOne(filter) {
      const query = {
        sort() { return this; },
        lean() {
          const barrier = lookupBarrier && Array.isArray(filter.$or) ? lookupBarrier.arrive() : Promise.resolve();
          return Promise.resolve(barrier).then(() => clone(rows.filter((row) => matchesFilter(row, filter))
            .sort((a, b) => a.createdAt - b.createdAt || String(a._id).localeCompare(String(b._id)))[0] || null));
        },
        then(resolve, reject) { return this.lean().then(resolve, reject); },
      };
      return query;
    },
    async create(values) {
      events.push('create');
      if (failNextCreate) {
        failNextCreate = false;
        throw new Error('injected record store failure');
      }
      const previous = createQueue;
      let release;
      createQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        const input = Array.isArray(values) ? values[0] : values;
        if (input.clientRunId && rows.some((row) => String(row.userId) === String(input.userId)
          && row.gameSlug === input.gameSlug && row.clientRunId === input.clientRunId)) {
          throw Object.assign(new Error('duplicate key'), { code: 11000, keyPattern: { userId: 1, gameSlug: 1, clientRunId: 1 } });
        }
        const row = {
          _id: `record-${nextId++}`,
          ...clone({ ...input, userId: String(input.userId) }),
          createdAt: new Date(`2026-10-21T00:00:${String(nextId).padStart(2, '0')}.000Z`),
          updatedAt: new Date(`2026-10-21T00:00:${String(nextId).padStart(2, '0')}.000Z`),
        };
        rows.push(row);
        return Array.isArray(values) ? [clone(row)] : clone(row);
      } finally {
        release();
      }
    },
  };

  const express = { Router: () => ({
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); },
  }) };
  const routePath = require.resolve('../routes/gameRecords');
  const routeRequire = createRequire(routePath);
  const routeModule = { exports: {} };
  const rewardRows = [];
  const rewardModel = {
    async ensureRewardIdentityIndex() {},
    findOne(filter) { return Promise.resolve(rewardRows.find((row) => String(row.userId) === String(filter.userId) && row.runId === filter.runId) || null); },
    async create(values) {
      const row = { _id: `reward-${rewardRows.length + 1}`, ...(Array.isArray(values) ? values[0] : values) };
      rewardRows.push(row);
      return Array.isArray(values) ? [row] : row;
    },
    async updateOne() { return { matchedCount: 1 }; },
  };
  const dailyModel = { async ensureDailyIdentityIndex() {} };
  const userModel = {
    async updateOne() { return { matchedCount: 1 }; },
    findById() { return { select() { return this; }, lean: async () => null }; },
  };
  const routeConsole = { error() {} };
  vm.runInNewContext(readFileSync(routePath, 'utf8'), {
    Buffer,
    Date,
    JSON,
    Math,
    Number,
    String,
    console: routeConsole,
    module: routeModule,
    process,
    require(name) {
      if (name === 'express') return express;
      if (name === '../models/GamePlayRecord') return GamePlayRecord;
      if (name === '../models/PrimitiveArchiveReward') return rewardModel;
      if (name === '../models/PrimitiveArchiveDailyReward') return dailyModel;
      if (name === '../models/User') return userModel;
      return routeRequire(name);
    },
  }, { filename: routePath });

  const bodyFor = (runId, overrides = {}) => ({
    title: `Archive ${runId}`,
    mode: 'survival-loop',
    result: 'clear',
    score: 120,
    playTimeSec: 90,
    summary: { day: 12, marker: 'first' },
    payload: { state: { runId, day: 12, marker: 'first' } },
    ...overrides,
  });
  const postHandler = routes.get('POST /:gameSlug');
  routeModule.exports.testing.configureDependencies({ GamePlayRecord, PrimitiveArchiveReward: rewardModel, PrimitiveArchiveDailyReward: dailyModel, User: userModel });
  assert.equal(typeof postHandler, 'function', 'The actual route source must register POST /:gameSlug.');
  return {
    rows,
    events,
    bodyFor,
    failCreate() { failNextCreate = true; },
    failIndex() { failNextIndex = true; },
    makeLookupRace(expectedLookups) {
      let arrived = 0;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      lookupBarrier = {
        arrive() {
          arrived += 1;
          if (arrived >= expectedLookups) release();
          return gate;
        },
      };
      return () => { lookupBarrier = null; };
    },
    seed(row) { rows.push(clone({ ...row, userId: String(row.userId) })); },
    async post(body, { userId = USER_A, gameSlug = GAME } = {}) {
      const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
      };
      await postHandler({ body, params: { gameSlug }, user: { id: userId } }, res);
      return res;
    },
  };
}

test('the real schema declares a unique partial idempotency index for user, game and client run key', () => {
  const GamePlayRecord = require('../models/GamePlayRecord');
  const index = GamePlayRecord.schema.indexes().find(([keys]) => (
    keys.userId === 1 && keys.gameSlug === 1 && keys.clientRunId === 1
  ));
  assert.ok(index, 'The idempotency index must be declared on the actual Mongoose schema.');
  assert.equal(GamePlayRecord.schema.path('clientRunId').options.maxlength, 160);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { clientRunId: { $type: 'string', $gt: '' } });
});

test('the real model retries failed index creation and shares an in-flight index promise', async () => {
  const GamePlayRecord = require('../models/GamePlayRecord');
  const originalCreateIndex = GamePlayRecord.collection.createIndex;
  const calls = [];
  GamePlayRecord.collection.createIndex = (keys, options) => {
    calls.push({ keys, options });
    if (calls.length === 1) return Promise.reject(new Error('injected index creation failure'));
    return Promise.resolve('userId_1_gameSlug_1_clientRunId_1');
  };
  try {
    await assert.rejects(GamePlayRecord.ensureRunIdentityIndex(), /injected index creation failure/);
    const results = await Promise.all([
      GamePlayRecord.ensureRunIdentityIndex(),
      GamePlayRecord.ensureRunIdentityIndex(),
    ]);
    assert.equal(calls.length, 2, 'Only the failed call and one shared retry should create the index.');
    assert.deepEqual(results, ['userId_1_gameSlug_1_clientRunId_1', 'userId_1_gameSlug_1_clientRunId_1']);
    assert.deepEqual(calls[1].keys, { userId: 1, gameSlug: 1, clientRunId: 1 });
    assert.equal(calls[1].options.unique, true);
    assert.deepEqual(calls[1].options.partialFilterExpression, { clientRunId: { $type: 'string', $gt: '' } });
  } finally {
    GamePlayRecord.collection.createIndex = originalCreateIndex;
  }
});

test('a completed Primitive Archive run retry returns the first immutable snapshot', async () => {
  const api = makeFixture();
  const firstBody = api.bodyFor('terminal-run-001');
  const first = await api.post(firstBody);
  const retry = await api.post(api.bodyFor('terminal-run-001', {
    title: 'Changed retry title',
    summary: { day: 99, marker: 'retry' },
    payload: { state: { runId: 'terminal-run-001', day: 99, marker: 'retry' } },
    score: 999,
  }));

  assert.equal(first.statusCode, 201);
  assert.equal(first.body.replayed, false);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.replayed, true);
  assert.match(retry.body.message, /중복으로 추가하지 않았/);
  assert.equal(retry.body.record.id, first.body.record.id);
  assert.deepEqual(retry.body.record.payload, first.body.record.payload);
  assert.equal(api.rows.length, 1);
  assert.ok(api.events.indexOf('ensure-index') < api.events.indexOf('create'));
  assert.equal(api.rows[0].title, firstBody.title);
  assert.equal(api.rows[0].summary.marker, 'first');
});

test('simultaneous identical completed-run requests converge on one receipt', async () => {
  const api = makeFixture();
  const releaseRace = api.makeLookupRace(2);
  const replies = await Promise.all([
    api.post(api.bodyFor('terminal-run-race')),
    api.post(api.bodyFor('terminal-run-race')),
  ]);
  releaseRace();

  assert.deepEqual(replies.map((reply) => reply.statusCode).sort(), [200, 201]);
  assert.deepEqual(replies.map((reply) => reply.body.replayed).sort(), [false, true]);
  assert.equal(replies[0].body.record.id, replies[1].body.record.id);
  assert.equal(api.rows.length, 1);
});

test('the dedupe key is isolated by user and game, while other game submissions keep create semantics', async () => {
  const api = makeFixture();
  const a = await api.post(api.bodyFor('shared-run-id'));
  const aRetry = await api.post(api.bodyFor('shared-run-id'));
  const b = await api.post(api.bodyFor('shared-run-id'), { userId: USER_B });
  const otherGameOne = await api.post(api.bodyFor('shared-run-id'), { gameSlug: 'another-game' });
  const otherGameTwo = await api.post(api.bodyFor('shared-run-id'), { gameSlug: 'another-game' });

  assert.equal(a.statusCode, 201);
  assert.equal(aRetry.statusCode, 200);
  assert.equal(aRetry.body.replayed, true);
  assert.equal(b.statusCode, 201);
  assert.equal(b.body.record.id === a.body.record.id, false);
  assert.equal(otherGameOne.statusCode, 201);
  assert.equal(otherGameTwo.statusCode, 201);
  assert.equal(otherGameOne.body.replayed, undefined);
  assert.equal(otherGameTwo.body.replayed, undefined);
  assert.equal(api.rows.length, 4);
});

test('a storage failure does not reserve the run key and a valid retry can create it', async () => {
  const api = makeFixture();
  api.failCreate();
  const failed = await api.post(api.bodyFor('retry-after-store-failure'));
  const retry = await api.post(api.bodyFor('retry-after-store-failure'));
  const duplicate = await api.post(api.bodyFor('retry-after-store-failure'));

  assert.equal(failed.statusCode, 500);
  assert.equal(retry.statusCode, 201);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.replayed, true);
  assert.equal(api.rows.length, 1);
});

test('index creation failure fails closed before insert and the next attempt can retry', async () => {
  const api = makeFixture();
  api.failIndex();
  const failed = await api.post(api.bodyFor('index-retry-run'));
  assert.equal(failed.statusCode, 503);
  assert.equal(api.rows.length, 0);
  const retry = await api.post(api.bodyFor('index-retry-run'));
  assert.equal(retry.statusCode, 201);
  assert.equal(api.rows.length, 1);
  assert.ok(api.events.indexOf('ensure-index') < api.events.indexOf('create'));
});

test('a legacy row without clientRunId is found by its nested run id and remains unchanged', async () => {
  const api = makeFixture();
  const legacy = {
    _id: 'legacy-record',
    userId: new mongoose.Types.ObjectId(USER_A),
    gameSlug: GAME,
    title: 'Legacy terminal run',
    mode: 'survival-loop',
    result: 'clear',
    score: 33,
    playTimeSec: 45,
    summary: { marker: 'legacy' },
    payload: { state: { runId: 'legacy-run-01', day: 8, marker: 'legacy-snapshot' } },
    payloadBytes: 50,
    playedAt: new Date('2026-10-20T00:00:00.000Z'),
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
  };
  api.seed(legacy);
  api.seed({
    ...legacy,
    _id: 'legacy-record-later',
    title: 'Later duplicate from the legacy era',
    createdAt: new Date('2026-10-20T00:00:01.000Z'),
    payload: { state: { runId: 'legacy-run-01', day: 99, marker: 'later-duplicate' } },
  });
  const retry = await api.post(api.bodyFor('legacy-run-01', { title: 'New retry content' }));

  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.record.id, legacy._id);
  assert.equal(retry.body.record.payload.state.marker, 'legacy-snapshot');
  assert.equal(api.rows.length, 2, 'Existing duplicate legacy rows are preserved rather than rewritten or deleted.');
  assert.equal(api.rows[0].clientRunId, undefined);
  assert.equal(api.rows[0].title, 'Legacy terminal run');
});

test('a legacy row without a nested run id does not block a valid completed-run identity', async () => {
  const api = makeFixture();
  const legacyWithoutKey = {
    _id: 'legacy-without-run-key',
    userId: new mongoose.Types.ObjectId(USER_A),
    gameSlug: GAME,
    title: 'Legacy row without key',
    payload: { state: { day: 3 } },
    createdAt: new Date('2026-10-19T00:00:00.000Z'),
  };
  api.seed(legacyWithoutKey);
  const created = await api.post(api.bodyFor('new-run-after-legacy'));
  assert.equal(created.statusCode, 201);
  assert.equal(api.rows.length, 2);
});

test('malformed completed-run keys are rejected without inserts, while manual archive records keep legacy behavior', async () => {
  const api = makeFixture();
  for (const runId of [undefined, '', '   ', 'x'.repeat(161), 'bad\nkey', 47, {}]) {
    const body = api.bodyFor('placeholder');
    if (runId === undefined) delete body.payload.state.runId;
    else body.payload.state.runId = runId;
    const first = await api.post(body);
    assert.equal(first.statusCode, 400, `Malformed/missing key ${String(runId)} must be rejected for completed runs.`);
  }
  assert.equal(api.rows.length, 0);
  const manualBody = { mode: '', payload: {}, title: 'Manual archive entry' };
  const first = await api.post(manualBody);
  const second = await api.post(manualBody);
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(first.body.replayed, undefined);
  assert.equal(api.rows.length, 2);
});

test('trimmed opaque identity accepts 160 characters and retains punctuation', async () => {
  const api = makeFixture();
  const runId = `  run / α?${'z'.repeat(152)}  `;
  assert.equal(runId.trim().length, 160);
  const body = api.bodyFor(runId);
  const first = await api.post(body);
  const retry = await api.post(body);
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.replayed, false);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.replayed, true);
  assert.equal(api.rows[0].clientRunId, runId.trim());
  assert.equal(api.rows.length, 1);
});
