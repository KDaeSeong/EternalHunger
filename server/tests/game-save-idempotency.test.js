const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const { gameRunIdentity } = require('../utils/gameRunIdentity');

function fixture() {
  let committed = { logs: [], characterIncrements: [], teamIncrements: [], userIncrements: [] };
  let queue = Promise.resolve(), failAt = '', nextId = 0;
  const routes = new Map();
  const query = (read) => {
    let session;
    return { session(value) { session = value; return this; },
      then(resolve, reject) { return Promise.resolve().then(() => read(session?.data || committed)).then(resolve, reject); } };
  };
  class GameLog {
    constructor(value) { Object.assign(this, value); this._id = 'log-' + (++nextId); }
    async save({ session } = {}) {
      assert.ok(session, 'log writes must participate in the record transaction');
      const data = session.data;
      if (data.logs.some((log) => log.userId === this.userId && log.clientRunId === this.clientRunId)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      data.logs.push(structuredClone(this)); return this;
    }
    static findOne(filter) { return query((data) => data.logs.find((log) => log.userId === filter.userId && log.clientRunId === filter.clientRunId) || null); }
    static async countDocuments() { return committed.logs.length; }
  }
  GameLog.db = { async transaction(run) {
    const previous = queue;
    let release; queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const session = { data: structuredClone(committed) };
    try { const result = await run(session); committed = session.data; return result; }
    finally { release(); }
  } };
  const A = '0000000000000000000000aa', B = '0000000000000000000000bb';
  const C = '0000000000000000000000cc', D = '0000000000000000000000dd';
  const chars = [{ _id: A, userId: 'u1', name: '가' }, { _id: B, userId: 'u1', name: '나' },
    { _id: C, userId: 'u2', name: '다' }, { _id: D, userId: 'u2', name: '라' }];
  const Character = {
    findOne(filter) { return query(() => chars.find((actor) => actor._id === filter._id && actor.userId === filter.userId)); },
    async findById(id) { return chars.find((actor) => actor._id === id); },
    find(filter) { return query(() => chars.filter((actor) => actor.userId === filter.userId && filter._id.$in.includes(actor._id))); },
    async bulkWrite(ops, { session } = {}) {
      assert.ok(session, 'character increments must use the same transaction');
      if (failAt === 'character') { failAt = ''; throw new Error('injected character failure'); }
      session.data.characterIncrements.push(...structuredClone(ops));
    },
  };
  const TeamRecord = { async bulkWrite(ops, { session } = {}) {
    assert.ok(session, 'team increments must use the same transaction');
    if (failAt === 'team') { failAt = ''; throw new Error('injected team failure'); }
    session.data.teamIncrements.push(...structuredClone(ops));
  } };
  const User = {
    async updateOne(filter, update, { session } = {}) {
      assert.ok(session, 'user LP/statistics must use the same transaction');
      if (failAt === 'user') { failAt = ''; throw new Error('injected user failure'); }
      session.data.userIncrements.push(structuredClone({ filter, update }));
    },
    findById(id) {
      return { select() { return this; }, lean: async () => {
        const lp = committed.userIncrements.filter((row) => row.filter._id === id)
          .reduce((sum, row) => sum + Number(row.update.$inc.lp || 0), 0);
        return { _id: id, lp, credits: 0, statistics: {} };
      } };
    },
  };
  const rateLimit = { positiveInt: (value, fallback) => Number(value) > 0 ? Math.floor(Number(value)) : fallback,
    async consumeRateLimit() { return { allowed: true, remaining: 99, retryAfterSec: 1 }; } };
  const router = { get() {}, post(path, handler) { routes.set(path, handler); } };
  const routePath = require.resolve('../routes/game');
  const routeRequire = createRequire(routePath);
  const overrides = { express: { Router: () => router }, '../models/GameLog': GameLog,
    '../models/Characters': Character, '../models/TeamRecord': TeamRecord, '../models/User': User,
    '../utils/rateLimit': rateLimit };
  vm.runInNewContext(readFileSync(routePath, 'utf8'), { module: { exports: {} }, structuredClone, process,
    console: { error() {} }, require: (name) => overrides[name] || routeRequire(name) }, { filename: routePath });
  const body = { clientRunId: 'same-completed-game', winnerId: A, winnerTeamId: 't', matchMode: 'squad', teamSize: 2,
    killCounts: { [A]: 3 }, assistCounts: { [B]: 2 }, fullLogs: ['같은 경기'], runEvents: [],
    participants: [{ _id: A, name: '가', teamId: 't', hp: 100 }, { _id: B, name: '나', teamId: 't', hp: 0 }] };
  return { body, ids: { A, B, C, D }, data: () => committed, fail(value) { failAt = value; },
    async call(payload = body, userId = 'u1') {
      const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      await routes.get('/end')({ body: payload, user: { id: userId } }, res); return res;
    } };
}

test('identical retries save one log and increment character and team records once', async () => {
  const api = fixture();
  const first = await api.call(), second = await api.call();
  assert.equal(first.code, 200); assert.equal(second.code, 200);
  assert.equal(first.body.gameLogId, second.body.gameLogId); assert.equal(second.body.duplicate, true);
  assert.equal(api.data().logs.length, 1); assert.equal(api.data().logs[0].clientRunId, api.body.clientRunId);
  assert.equal(api.data().characterIncrements.length, 2); assert.equal(api.data().teamIncrements.length, 1);
  assert.equal(api.data().characterIncrements[0].updateOne.update.$inc['records.gamesPlayed'], 1);
  assert.equal(api.data().teamIncrements[0].updateOne.update.$inc.gamesPlayed, 1);
});

test('simultaneous identical requests return the same saved receipt', async () => {
  const api = fixture();
  const replies = await Promise.all(Array.from({ length: 8 }, () => api.call()));
  assert.ok(replies.every((res) => res.code === 200));
  assert.equal(new Set(replies.map((res) => res.body.gameLogId)).size, 1);
  assert.equal(api.data().logs.length, 1); assert.equal(api.data().characterIncrements.length, 2);
  assert.equal(api.data().teamIncrements.length, 1);
});

for (const stage of ['character', 'team', 'user']) test(`a ${stage} write failure rolls back all data and permits one retry`, async () => {
  const api = fixture(); api.fail(stage);
  assert.equal((await api.call()).code, 500);
  assert.deepEqual(api.data(), { logs: [], characterIncrements: [], teamIncrements: [], userIncrements: [] });
  assert.equal((await api.call()).code, 200); assert.equal((await api.call()).code, 200);
  assert.equal(api.data().logs.length, 1); assert.equal(api.data().characterIncrements.length, 2);
  assert.equal(api.data().teamIncrements.length, 1);
});

test('old clients receive a deterministic retry identity, independent of object-key order', async () => {
  const api = fixture(), legacy = { ...api.body }; delete legacy.clientRunId;
  const reordered = Object.fromEntries(Object.entries(legacy).reverse());
  assert.equal(gameRunIdentity(legacy), gameRunIdentity(reordered));
  assert.equal((await api.call(legacy)).body.gameLogId, (await api.call(reordered)).body.gameLogId);
  assert.match(api.data().logs[0].clientRunId, /^legacy-[a-f0-9]{64}$/);
  assert.equal(api.data().logs.length, 1);
});

test('run receipts are scoped to the account, while different runs remain distinct', async () => {
  const api = fixture();
  await api.call(); await api.call({ ...api.body, clientRunId: 'another-game' });
  const { C, D } = api.ids;
  await api.call({ ...api.body, winnerId: C, participants: [{ _id: C, teamId: 't', hp: 100 }, { _id: D, teamId: 't', hp: 100 }] }, 'u2');
  assert.equal(api.data().logs.length, 3); assert.equal(api.data().characterIncrements.length, 6);
  assert.equal(api.data().teamIncrements.length, 3);
});

test('invalid run identifiers fail without changing any records', async () => {
  const api = fixture();
  for (const clientRunId of ['', ' ', null, 4, {}, 'x'.repeat(161)]) {
    assert.equal((await api.call({ ...api.body, clientRunId })).code, 400);
  }
  assert.equal(api.data().logs.length, 0); assert.equal(api.data().characterIncrements.length, 0);
});

test('one finished run grants server-computed LP once, never a client-sent amount', async () => {
  const api = fixture();
  const payload = { ...api.body, lpEarned: 99999, creditsEarned: 99999, predictedWinnerId: api.ids.A };
  const first = await api.call(payload), retry = await api.call(payload);
  assert.equal(first.body.lpEarnedApplied, 150); // base 50 + correct prediction 100
  assert.equal(first.body.creditsEarnedApplied, 0);
  assert.deepEqual({ ...first.body.lpBreakdown }, { base: 50, predictionBonus: 100, predictionCorrect: true });
  assert.equal(retry.body.duplicate, true); assert.equal(retry.body.lpEarnedApplied, 150);
  assert.equal(api.data().userIncrements.length, 1);
  assert.equal(api.data().userIncrements[0].update.$inc.lp, 150);
  assert.equal(first.body.user.lp, 150);
});

test('kill and assist maps are recorded, bounded, and a winner outside the roster is rejected', async () => {
  const api = fixture();
  const { A, B } = api.ids;
  await api.call({ ...api.body, clientRunId: 'bounded-run', killCounts: { [A]: 1e9 }, assistCounts: { [B]: 2 } });
  const incs = api.data().characterIncrements.map((op) => op.updateOne.update.$inc);
  assert.equal(incs[0]['records.totalKills'], 4); // at most 2 x roster size
  assert.equal(incs[1]['records.totalAssists'], 2);
  assert.equal(incs[1]['records.deathCount'], 0);
  const rejected = await api.call({ ...api.body, clientRunId: 'foreign-winner', winnerId: '0000000000000000000000ff' });
  assert.equal(rejected.code, 400);
});
