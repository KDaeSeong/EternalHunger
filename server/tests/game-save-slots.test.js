const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const vm = require('node:vm');

const USER_A = '0000000000000000000000a1';
const USER_B = '0000000000000000000000b2';

function fixture({ rows = [] } = {}) {
  let committed = { rows: structuredClone(rows), userCounters: {} };
  let transactionQueue = Promise.resolve();
  let nextId = rows.length + 1;
  let countBarrier = null;
  let failNextSlotWrite = false;
  const routes = new Map();

  function same(left, right) {
    if (left === undefined || right === undefined || left === null || right === null) return left === right;
    return String(left) === String(right);
  }

  function matches(row, filter) {
    return Object.entries(filter || {}).every(([key, value]) => same(row[key], value));
  }

  function query(read, initialSession = null) {
    let session = initialSession;
    const result = {
      session(value) { session = value; return this; },
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean() { return this; },
      then(resolve, reject) {
        return Promise.resolve().then(() => read(session?.data || committed, session)).then(resolve, reject);
      },
    };
    return result;
  }

  function applyUpdate(target, update) {
    for (const [path, amount] of Object.entries(update?.$inc || {})) {
      target[path] = Number(target[path] || 0) + Number(amount || 0);
    }
  }

  const GameSaveSlot = {
    findOne(filter) {
      return query((data) => data.rows.find((row) => matches(row, filter)) || null);
    },
    countDocuments(filter) {
      return query(async (data, session) => {
        if (!session && countBarrier) await countBarrier.wait();
        return data.rows.filter((row) => matches(row, filter)).length;
      });
    },
    findOneAndUpdate(filter, update, options = {}) {
      return query((data) => {
        if (failNextSlotWrite) {
          failNextSlotWrite = false;
          throw new Error('injected slot write failure');
        }
        let row = data.rows.find((candidate) => matches(candidate, filter));
        if (!row && options.upsert) {
          row = { _id: String(nextId++).padStart(24, '0'), createdAt: new Date(0), updatedAt: new Date(0) };
          data.rows.push(row);
        }
        if (!row) return null;
        const patch = structuredClone(update?.$set || {});
        if (update?.$set?.userId) patch.userId = String(update.$set.userId);
        Object.assign(row, patch, { updatedAt: new Date(0) });
        return structuredClone(row);
      }, options.session || null);
    },
    deleteOne(filter, options = {}) {
      return query((data) => {
        const index = data.rows.findIndex((row) => matches(row, filter));
        if (index < 0) return { deletedCount: 0 };
        data.rows.splice(index, 1);
        return { deletedCount: 1 };
      }, options.session || null);
    },
  };

  GameSaveSlot.db = {
    async transaction(run) {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const session = { data: structuredClone(committed) };
      try {
        const result = await run(session);
        committed = session.data;
        return result;
      } finally {
        release();
      }
    },
  };

  const User = {
    async updateOne(filter, update, options = {}) {
      assert.ok(options.session, 'game-save mutation marker must use the transaction session');
      assert.ok(Object.keys(update?.$inc || {}).some((key) => key.split('.').at(-1) === 'gameSaveMutationVersion'),
        'user update must increment the private gameSaveMutationVersion marker');
      const data = options.session.data;
      const userId = String(filter?._id || '');
      data.userCounters[userId] ||= {};
      applyUpdate(data.userCounters[userId], update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  const router = {
    get() {},
    put(path, handler) { routes.set(`PUT ${path}`, handler); },
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); },
  };
  const routePath = require.resolve('../routes/gameSaves');
  const routeRequire = createRequire(routePath);
  const overrides = {
    express: { Router: () => router },
    '../models/GameSaveSlot': GameSaveSlot,
    '../models/User': User,
  };
  vm.runInNewContext(readFileSync(routePath, 'utf8'), {
    module: { exports: {} },
    Buffer,
    Date,
    Number,
    String,
    JSON,
    Math,
    process: { env: { GAME_SAVE_MAX_SLOTS_PER_GAME: '20', GAME_SAVE_MAX_BYTES: '1048576' } },
    console: { error() {} },
    require: (name) => overrides[name] || routeRequire(name),
  }, { filename: routePath });

  function response() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  function id() { return String(nextId++).padStart(24, '0'); }

  return {
    id,
    data: () => committed,
    slots: () => structuredClone(committed.rows),
    setRows(value) { committed.rows = structuredClone(value); },
    failNextSave() { failNextSlotWrite = true; },
    enableConcurrentCountBarrier() {
      let arrivals = 0, release;
      const gate = new Promise((resolve) => { release = resolve; });
      countBarrier = { async wait() { arrivals += 1; if (arrivals === 2) release(); await gate; } };
    },
    async put({ userId = USER_A, gameSlug = 'archive', slotKey = 'slot', payload = { value: 1 } } = {}) {
      const res = response();
      await routes.get('PUT /:gameSlug/:slotKey')({
        user: { id: userId }, params: { gameSlug, slotKey },
        body: { payload, summary: { day: 1 }, saveName: slotKey, version: 'test' },
      }, res);
      return res;
    },
    async remove({ userId = USER_A, id: slotId } = {}) {
      const res = response();
      await routes.get('DELETE /:id')({ user: { id: userId }, params: { id: slotId } }, res);
      return res;
    },
  };
}

function seededRows(count, { userId = USER_A, gameSlug = 'archive' } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    _id: String(index + 1).padStart(24, '0'), userId, gameSlug,
    slotKey: `slot-${index}`, payload: { value: index }, payloadBytes: 11,
    summary: {}, saveName: `Slot ${index}`, version: 'old',
  }));
}

test('concurrent creation at the per-game limit admits one slot only', async () => {
  const api = fixture({ rows: seededRows(19) });
  api.enableConcurrentCountBarrier();
  const replies = await Promise.all([
    api.put({ slotKey: 'parallel-a' }),
    api.put({ slotKey: 'parallel-b' }),
  ]);
  assert.deepEqual(replies.map((reply) => reply.statusCode).sort(), [200, 400]);
  assert.equal(api.slots().length, 20);
});

test('updating an existing key succeeds when its game is already full', async () => {
  const rows = seededRows(20);
  const api = fixture({ rows });
  const originalId = rows[0]._id;
  const reply = await api.put({ slotKey: 'slot-0', payload: { refreshed: true } });
  assert.equal(reply.statusCode, 200);
  assert.equal(api.slots().length, 20);
  assert.equal(api.slots().find((row) => row._id === originalId).payload.refreshed, true);
});

test('deleting a slot frees capacity for a later save', async () => {
  const rows = seededRows(20);
  const api = fixture({ rows });
  assert.equal((await api.remove({ id: rows[0]._id })).statusCode, 200);
  assert.equal((await api.put({ slotKey: 'replacement' })).statusCode, 200);
  assert.equal(api.slots().length, 20);
});

test('capacity is scoped by account and game, and another account cannot delete a slot', async () => {
  const rows = [
    ...seededRows(20),
    ...seededRows(19, { gameSlug: 'other-game' }).map((row, index) => ({ ...row, _id: String(100 + index).padStart(24, '0') })),
    ...seededRows(19, { userId: USER_B }).map((row, index) => ({ ...row, _id: String(200 + index).padStart(24, '0') })),
  ];
  const api = fixture({ rows });
  assert.equal((await api.put({ userId: USER_A, gameSlug: 'other-game', slotKey: 'new-a' })).statusCode, 200);
  assert.equal((await api.put({ userId: USER_B, gameSlug: 'archive', slotKey: 'new-b' })).statusCode, 200);
  assert.equal((await api.put({ userId: USER_B, gameSlug: 'archive', slotKey: 'new-b-2' })).statusCode, 400);
  assert.equal((await api.put({ userId: USER_A, gameSlug: 'archive', slotKey: 'overflow' })).statusCode, 400);
  assert.equal((await api.remove({ userId: USER_B, id: rows[0]._id })).statusCode, 404);
  assert.ok(api.slots().some((row) => row._id === rows[0]._id));
});

test('a failed slot write rolls back the original row and mutation counter', async () => {
  const rows = seededRows(1);
  const api = fixture({ rows });
  const beforeRows = api.slots();
  const beforeCounter = structuredClone(api.data().userCounters);
  api.failNextSave();
  const reply = await api.put({ slotKey: 'slot-0', payload: { shouldNotPersist: true } });
  assert.equal(reply.statusCode, 500);
  assert.deepEqual(api.slots(), beforeRows);
  assert.deepEqual(api.data().userCounters, beforeCounter);
});
