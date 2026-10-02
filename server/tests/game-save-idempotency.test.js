const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const { gameRunIdentity } = require('../utils/gameRunIdentity');

function fixture() {
  let committed = { logs: [], characterIncrements: [], teamIncrements: [] };
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
  const chars = [{ _id: 'a', userId: 'u1', name: '가' }, { _id: 'b', userId: 'u1', name: '나' },
    { _id: 'c', userId: 'u2', name: '다' }, { _id: 'd', userId: 'u2', name: '라' }];
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
  const router = { get() {}, post(path, handler) { routes.set(path, handler); } };
  const routePath = require.resolve('../routes/game');
  const routeRequire = createRequire(routePath);
  const overrides = { express: { Router: () => router }, '../models/GameLog': GameLog,
    '../models/Characters': Character, '../models/TeamRecord': TeamRecord };
  vm.runInNewContext(readFileSync(routePath, 'utf8'), { module: { exports: {} }, structuredClone,
    console: { error() {} }, require: (name) => overrides[name] || routeRequire(name) }, { filename: routePath });
  const body = { clientRunId: 'same-completed-game', winnerId: 'a', winnerTeamId: 't', matchMode: 'squad', teamSize: 2,
    killCounts: { a: 3 }, assistCounts: { b: 2 }, fullLogs: ['같은 경기'], runEvents: [],
    participants: [{ _id: 'a', name: '가', teamId: 't', hp: 100 }, { _id: 'b', name: '나', teamId: 't', hp: 0 }] };
  return { body, data: () => committed, fail(value) { failAt = value; },
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

for (const stage of ['character', 'team']) test(`a ${stage} write failure rolls back all data and permits one retry`, async () => {
  const api = fixture(); api.fail(stage);
  assert.equal((await api.call()).code, 500);
  assert.deepEqual(api.data(), { logs: [], characterIncrements: [], teamIncrements: [] });
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
  await api.call({ ...api.body, winnerId: 'c', participants: [{ _id: 'c', teamId: 't', hp: 100 }, { _id: 'd', teamId: 't', hp: 100 }] }, 'u2');
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
