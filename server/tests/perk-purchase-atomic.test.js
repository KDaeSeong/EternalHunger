const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = readFileSync(path.join(__dirname, '../routes/perks.js'), 'utf8');

function makeHarness({ lp = 1000, owned = [], perks = [] } = {}) {
  const user = {
    _id: 'user-1', username: 'test-user', nickname: 'tester', lp, credits: 31,
    perks: [...owned], isAdmin: false, badges: [], statistics: { totalGames: 0 },
  };
  const routes = new Map();
  const atomicWrites = [];
  const store = new Map([['user-1', user]]);
  const User = {
    async findOneAndUpdate(filter, update, options) {
      atomicWrites.push({ filter, update, options });
      const current = store.get(String(filter._id));
      if (!current || !(current.lp >= filter.lp.$gte) || current.perks.includes(filter.perks.$ne)) return null;
      current.lp += update.$inc.lp;
      for (const code of update.$addToSet.perks ? [update.$addToSet.perks] : []) {
        if (!current.perks.includes(code)) current.perks.push(code);
      }
      return options.new ? structuredClone(current) : null;
    },
    findById(id) {
      return { lean: async () => {
        const current = store.get(String(id));
        return current ? structuredClone(current) : null;
      } };
    },
  };
  const Perk = {
    find(filter) {
      return { lean: async () => perks.filter((perk) => perk.code === filter.code && perk.isActive === true) };
    },
  };
  const express = { Router: () => ({
    get(route, handler) { routes.set(`GET ${route}`, handler); },
    post(route, handler) { routes.set(`POST ${route}`, handler); },
  }) };
  const dependencyMap = {
    express,
    '../models/User': User,
    '../models/Perk': Perk,
    '../utils/requestScope': { scopedFilter: (_req, filter) => filter },
    '../utils/defaultPerks': {
      dedupeScopedPerks: (rows) => rows,
      ensureDefaultPublicPerks: async () => {},
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(routeSource, {
    require: (id) => dependencyMap[id],
    module,
    exports: module.exports,
    console: { error() {} },
    Number,
    Array,
    Boolean,
    String,
    Set,
    Math,
  }, { filename: path.join(__dirname, '../routes/perks.js') });

  async function purchase(body) {
    let status = 200;
    let payload;
    const res = {
      status(value) { status = value; return this; },
      json(value) { payload = value; return value; },
    };
    await routes.get('POST /purchase')({ user: { id: 'user-1' }, body }, res);
    return { status, payload };
  }

  return { user, store, atomicWrites, purchase };
}

function publicPerk(code, lpCost) {
  return { code, lpCost, isActive: true, category: 'title', effects: {} };
}

test('concurrent duplicate purchase charges once and returns an owned replay', async () => {
  const harness = makeHarness({ perks: [publicPerk('TITLE_A', 120)] });
  const [first, second] = await Promise.all([
    harness.purchase({ code: 'TITLE_A', lpCost: 1 }),
    harness.purchase({ code: 'TITLE_A', lpCost: 1 }),
  ]);
  assert.deepEqual([first.status, second.status], [200, 200]);
  assert.equal([first.payload.message, second.payload.message].filter((message) => message === '특전 구매 완료').length, 1);
  assert.equal([first.payload.message, second.payload.message].filter((message) => message === '이미 보유한 특전입니다.').length, 1);
  assert.equal(harness.user.lp, 880);
  assert.deepEqual(harness.user.perks, ['TITLE_A']);
  assert.equal(harness.atomicWrites.every((write) => write.options.new === true), true);
});

test('concurrent different purchases retain both ownership entries and both charges', async () => {
  const harness = makeHarness({ perks: [publicPerk('TITLE_A', 120), publicPerk('FRAME_B', 220)] });
  const results = await Promise.all([
    harness.purchase({ code: 'TITLE_A' }),
    harness.purchase({ code: 'FRAME_B' }),
  ]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(harness.user.lp, 660);
  assert.deepEqual(new Set(harness.user.perks), new Set(['TITLE_A', 'FRAME_B']));
});

test('purchase decrement composes with a concurrent reward LP increment', async () => {
  const harness = makeHarness({ lp: 500, perks: [publicPerk('TITLE_A', 120)] });
  const purchase = harness.purchase({ code: 'TITLE_A' });
  const reward = Promise.resolve().then(() => { harness.user.lp += 500; });
  const [result] = await Promise.all([purchase, reward]);
  assert.equal(result.status, 200);
  assert.equal(harness.user.lp, 880);
});

test('insufficient balance and missing user are distinguished after atomic miss', async () => {
  const short = makeHarness({ lp: 20, perks: [publicPerk('TITLE_A', 120)] });
  const insufficient = await short.purchase({ code: 'TITLE_A' });
  assert.equal(insufficient.status, 400);
  assert.equal(insufficient.payload.error, 'LP가 부족합니다.');
  assert.equal(short.user.lp, 20);
  assert.deepEqual(short.user.perks, []);

  const missing = makeHarness({ perks: [publicPerk('TITLE_A', 120)] });
  missing.store.delete('user-1');
  const absent = await missing.purchase({ code: 'TITLE_A' });
  assert.equal(absent.status, 404);
  assert.equal(absent.payload.error, 'user_not_found');
});

test('already-owned replay does not charge again', async () => {
  const harness = makeHarness({ lp: 400, owned: ['TITLE_A'], perks: [publicPerk('TITLE_A', 120)] });
  const result = await harness.purchase({ code: 'TITLE_A' });
  assert.equal(result.status, 200);
  assert.equal(result.payload.message, '이미 보유한 특전입니다.');
  assert.equal(result.payload.lp, 400);
  assert.deepEqual(result.payload.perks, ['TITLE_A']);
  assert.equal(harness.user.lp, 400);
});

test('invalid server prices are rejected and client prices cannot override catalog price', async () => {
  for (const invalid of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '120', null]) {
    const harness = makeHarness({ perks: [publicPerk('TITLE_A', invalid)] });
    const result = await harness.purchase({ code: 'TITLE_A', lpCost: 0 });
    assert.equal(result.status, 500, `price ${String(invalid)} should be rejected`);
    assert.equal(result.payload.code, 'PERK_PRICE_INVALID');
    assert.match(result.payload.error, /상품 가격을 확인할 수 없습니다/);
    assert.equal(harness.user.lp, 1000);
    assert.deepEqual(harness.user.perks, []);
    assert.equal(harness.atomicWrites.length, 0);
  }

  const harness = makeHarness({ perks: [publicPerk('TITLE_A', 120)] });
  const result = await harness.purchase({ code: 'TITLE_A', lpCost: 0 });
  assert.equal(result.status, 200);
  assert.equal(harness.user.lp, 880);
});
