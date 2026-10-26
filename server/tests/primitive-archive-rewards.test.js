const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');

const USER_A = '64b000000000000000000001';
const USER_B = '64b000000000000000000002';
const ROUTE_PATH = require.resolve('../routes/gameRecords');
const CONTRACT = require('../generated/primitiveArchiveRewardContract.json');

function clone(value) {
  return structuredClone(value);
}

function queryLike(load) {
  const query = {
    session() { return this; },
    sort() { return this; },
    select() { return this; },
    lean() { return Promise.resolve(load()); },
    then(resolve, reject) { return Promise.resolve(load()).then(resolve, reject); },
  };
  return query;
}

function completedState(runId, tier = 'basic', overrides = {}) {
  return {
    runId,
    day: CONTRACT.baseDays,
    ended: true,
    victory: true,
    devTools: { enabled: false, used: false, guaranteedSuccess: false, unlockSpecializedActions: false, actionBonuses: {} },
    meta: { lastSettledRunId: runId },
    research: { completed: Object.fromEntries((tier === 'full' ? CONTRACT.full : CONTRACT.core).technologies.map((id) => [id, true])) },
    civics: { completed: Object.fromEntries((tier === 'full' ? CONTRACT.full : CONTRACT.core).civics.map((id) => [id, true])) },
    camp: { ...CONTRACT.campRequirements },
    inventory: Object.fromEntries(CONTRACT.bookRequirements.map((id) => [id, 1])),
    party: Array.from({ length: CONTRACT.survivorCount }, (_, index) => ({ id: `member-${index}`, hp: 80 })),
    ...overrides,
  };
}

function makeFixture() {
  let nextId = 1;
  let failBalanceWrite = false;
  let queue = Promise.resolve();
  const data = {
    records: [],
    rewards: [],
    daily: [],
    users: [
      { _id: USER_A, lp: 40, credits: 70, primitiveArchiveRewardMutationVersion: 0 },
      { _id: USER_B, lp: 5, credits: 9, primitiveArchiveRewardMutationVersion: 0 },
    ],
  };
  const matchRecord = (row, filter) => (
    String(row.userId) === String(filter.userId)
    && row.gameSlug === filter.gameSlug
    && (!filter.$or || filter.$or.some((condition) => (
      condition.clientRunId !== undefined
        ? row.clientRunId === condition.clientRunId
        : row.payload?.state?.runId === condition['payload.state.runId']
    )))
  );
  const ensure = async () => {};
  const models = {};
  models.GamePlayRecord = {
    ensureRunIdentityIndex: ensure,
    db: {
      async transaction(callback) {
        const previous = queue;
        let release;
        queue = new Promise((resolve) => { release = resolve; });
        await previous;
        const snapshot = clone(data);
        try {
          return await callback({ transaction: true });
        } catch (error) {
          for (const key of Object.keys(data)) data[key] = snapshot[key];
          throw error;
        } finally {
          release();
        }
      },
    },
    find(filter) {
      return {
        select() { return this; }, sort() { return this; }, limit() { return this; },
        lean() { return Promise.resolve(data.records.filter((row) => String(row.userId) === String(filter.userId) && (!filter.gameSlug || row.gameSlug === filter.gameSlug)).map(clone)); },
      };
    },
    findOne(filter) {
      return queryLike(() => clone(data.records.filter((row) => matchRecord(row, filter))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0] || null));
    },
    async create(values) {
      const input = Array.isArray(values) ? values[0] : values;
      if (input.clientRunId && data.records.some((row) => String(row.userId) === String(input.userId)
        && row.gameSlug === input.gameSlug && row.clientRunId === input.clientRunId)) {
        throw Object.assign(new Error('duplicate record'), { code: 11000 });
      }
      const row = { _id: `record-${nextId++}`, ...clone({ ...input, userId: String(input.userId) }), createdAt: new Date(), updatedAt: new Date() };
      data.records.push(row);
      return Array.isArray(values) ? [clone(row)] : clone(row);
    },
    async deleteOne(filter) {
      const index = data.records.findIndex((row) => String(row._id) === String(filter._id) && String(row.userId) === String(filter.userId));
      if (index < 0) return { deletedCount: 0 };
      data.records.splice(index, 1);
      return { deletedCount: 1 };
    },
  };
  models.PrimitiveArchiveReward = {
    ensureRewardIdentityIndex: ensure,
    findOne(filter) {
      return queryLike(() => clone(data.rewards.find((row) => String(row.userId) === String(filter.userId)
        && row.gameSlug === filter.gameSlug && row.runId === filter.runId) || null));
    },
    async create(values) {
      const input = Array.isArray(values) ? values[0] : values;
      if (data.rewards.some((row) => String(row.userId) === String(input.userId)
        && row.gameSlug === input.gameSlug && row.runId === input.runId)) {
        throw Object.assign(new Error('duplicate reward'), { code: 11000 });
      }
      const row = { _id: `reward-${nextId++}`, ...clone({ ...input, userId: String(input.userId) }) };
      data.rewards.push(row);
      return Array.isArray(values) ? [clone(row)] : clone(row);
    },
    async updateOne(filter, update) {
      const row = data.rewards.find((item) => String(item._id) === String(filter._id));
      if (!row) return { matchedCount: 0 };
      Object.assign(row, update.$set || {});
      return { matchedCount: 1 };
    },
  };
  models.PrimitiveArchiveDailyReward = {
    ensureDailyIdentityIndex: ensure,
    findOneAndUpdate(filter, update) {
      let row = data.daily.find((item) => String(item.userId) === String(filter.userId) && item.dayKey === filter.dayKey);
      if (!row && update.$setOnInsert) {
        row = { _id: `daily-${nextId++}`, ...clone({ ...update.$setOnInsert, userId: String(filter.userId) }) };
        data.daily.push(row);
      }
      return queryLike(() => clone(row || null));
    },
    async updateOne(filter, update) {
      const row = data.daily.find((item) => String(item.userId) === String(filter.userId) && item.dayKey === filter.dayKey);
      if (!row) return { matchedCount: 0 };
      row.lp += Number(update.$inc.lp || 0);
      row.credits += Number(update.$inc.credits || 0);
      return { matchedCount: 1 };
    },
  };
  models.User = {
    async updateOne(filter, update) {
      const user = data.users.find((row) => String(row._id) === String(filter._id));
      if (!user) return { matchedCount: 0 };
      if (Number(update.$inc.lp || 0) > 0 && failBalanceWrite) {
        failBalanceWrite = false;
        throw new Error('injected wallet write failure');
      }
      user.lp += Number(update.$inc.lp || 0);
      user.credits += Number(update.$inc.credits || 0);
      user.primitiveArchiveRewardMutationVersion += Number(update.$inc.primitiveArchiveRewardMutationVersion || 0);
      return { matchedCount: 1 };
    },
    findById(id) {
      const user = data.users.find((row) => String(row._id) === String(id));
      return queryLike(() => clone(user || null));
    },
  };

  const routes = new Map();
  const express = { Router: () => ({
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); },
  }) };
  const routeRequire = createRequire(ROUTE_PATH);
  const routeModule = { exports: {} };
  vm.runInNewContext(readFileSync(ROUTE_PATH, 'utf8'), {
    Buffer, Date, Intl, JSON, Math, Number, String, console: { error() {} }, module: routeModule, process,
    require(name) {
      if (name === 'express') return express;
      if (name === '../models/GamePlayRecord') return models.GamePlayRecord;
      if (name === '../models/PrimitiveArchiveReward') return models.PrimitiveArchiveReward;
      if (name === '../models/PrimitiveArchiveDailyReward') return models.PrimitiveArchiveDailyReward;
      if (name === '../models/User') return models.User;
      return routeRequire(name);
    },
  }, { filename: ROUTE_PATH });
  const router = routeModule.exports;
  router.testing.configureDependencies({ ...models, now: () => new Date('2026-10-26T03:00:00.000Z') });
  const postHandler = routes.get('POST /:gameSlug');

  const bodyFor = (runId, tier = 'basic', overrides = {}) => ({
    title: `Archive ${runId}`, mode: 'survival-loop', result: 'clear', score: 1e100,
    playTimeSec: 60, summary: { score: 1e100 }, payload: { state: completedState(runId, tier) }, ...overrides,
  });
  return {
    data,
    router,
    bodyFor,
    seed(row) { data.records.push(clone(row)); },
    failBalanceWrite() { failBalanceWrite = true; },
    async post(body, { userId = USER_A, gameSlug = CONTRACT.gameSlug } = {}) {
      const res = {
        statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
      };
      await postHandler({ body, params: { gameSlug }, user: { id: userId } }, res);
      return res;
    },
  };
}

test('archive completion receives fixed basic and full totals; client score/result/amount are not the payout source', async () => {
  const fixture = makeFixture();
  const basic = await fixture.post(fixture.bodyFor('basic-run'));
  const full = await fixture.post(fixture.bodyFor('full-run', 'full', {
    score: Number.MAX_VALUE,
    result: 'fail',
    lpEarned: 999999999,
    creditsEarned: 999999999,
  }));
  assert.equal(basic.body.rewards.status, 'awarded');
  assert.deepEqual({ lp: basic.body.rewards.lp, credits: basic.body.rewards.credits, tier: basic.body.rewards.tier }, { lp: 500, credits: 1000, tier: 'basic' });
  assert.equal(full.body.rewards.status, 'awarded');
  assert.deepEqual({ lp: full.body.rewards.lp, credits: full.body.rewards.credits, tier: full.body.rewards.tier }, { lp: 1500, credits: 3000, tier: 'full' });
  assert.equal(full.body.userProgress.lp, 2040);
  assert.equal(full.body.userProgress.credits, 4070);
  assert.equal(full.body.record.result, 'fail', 'client result remains a record field but does not affect the award');
});

test('missing completion proofs, developer enabled/used and forged client totals keep record-only semantics', async () => {
  const fixture = makeFixture();
  for (const [runId, overrides] of [
    ['unfinished', { ended: false }],
    ['developer-used', { devTools: { enabled: false, used: true } }],
    ['developer-enabled', { devTools: { enabled: true, used: false } }],
    ['missing-core', { research: { completed: {} } }],
  ]) {
    const response = await fixture.post(fixture.bodyFor(runId, 'full', { payload: { state: completedState(runId, 'full', overrides) } }));
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.rewards.status, 'ineligible');
    assert.equal(response.body.rewards.lp, 0);
    assert.equal(response.body.rewards.credits, 0);
  }
  const invalidFirst = await fixture.post(fixture.bodyFor('invalid-replay', 'basic', {
    payload: { state: completedState('invalid-replay', 'basic', { victory: false }) },
  }));
  const invalidRetry = await fixture.post(fixture.bodyFor('invalid-replay', 'basic'));
  assert.equal(invalidFirst.body.rewards.replayed, false);
  assert.equal(invalidRetry.body.rewards.replayed, true);
  assert.equal(invalidRetry.body.rewards.status, 'ineligible', 'The immutable first ineligible snapshot cannot be upgraded on retry.');
  assert.equal(fixture.data.users[0].lp, 40);
  assert.equal(fixture.data.users[0].credits, 70);
  assert.equal(fixture.data.records.length, 5, 'ineligible attempts remain valid records');
});

test('developer panel enabled without any adjustment remains eligible, but adjusted and unsettled snapshots do not', async () => {
  const fixture = makeFixture();
  const enabledOnly = completedState('enabled-only');
  enabledOnly.devTools.enabled = true;
  const accepted = await fixture.post(fixture.bodyFor('enabled-only', 'basic', { payload: { state: enabledOnly } }));
  assert.equal(accepted.body.rewards.status, 'awarded');

  const adjusted = completedState('adjusted');
  adjusted.devTools.enabled = true;
  adjusted.devTools.actionBonuses.gather = 0.1;
  const rejectedAdjustment = await fixture.post(fixture.bodyFor('adjusted', 'basic', { payload: { state: adjusted } }));
  assert.equal(rejectedAdjustment.body.rewards.status, 'ineligible');

  const unsettled = completedState('unsettled');
  unsettled.meta.lastSettledRunId = '';
  const rejectedSettlement = await fixture.post(fixture.bodyFor('unsettled', 'basic', { payload: { state: unsettled } }));
  assert.equal(rejectedSettlement.body.rewards.status, 'ineligible');
});

test('first record stays immutable across retries and legacy completed rows can claim once from their stored snapshot', async () => {
  const fixture = makeFixture();
  const first = await fixture.post(fixture.bodyFor('immutable-run', 'basic', { score: 90 }));
  const changed = await fixture.post(fixture.bodyFor('immutable-run', 'full', { title: 'forged retry', score: 9e99 }));
  assert.equal(first.body.rewards.lp, 500);
  assert.equal(changed.body.rewards.status, 'already_awarded');
  assert.equal(changed.body.rewards.replayed, true);
  assert.equal(changed.body.rewards.lp, 500);
  assert.equal(changed.body.record.title, 'Archive immutable-run');
  assert.equal(changed.body.record.payload.state.research.completed[CONTRACT.full.technologies.at(-1)], undefined);
  assert.equal(fixture.data.users[0].lp, 540);

  const legacy = makeFixture();
  const stored = legacy.bodyFor('historic-run', 'full');
  legacy.seed({ _id: 'historic-record', userId: USER_A, gameSlug: CONTRACT.gameSlug, title: 'Historic', mode: 'survival-loop', result: 'clear', score: 7, playTimeSec: 12, summary: {}, payload: stored.payload, payloadBytes: 1, playedAt: new Date(), createdAt: new Date() });
  const claim = await legacy.post(legacy.bodyFor('historic-run', 'basic', { title: 'changed body' }));
  assert.equal(claim.statusCode, 200);
  assert.equal(claim.body.rewards.status, 'awarded');
  assert.equal(claim.body.rewards.tier, 'full');
  assert.equal(claim.body.rewards.lp, 1500);
  assert.equal(claim.body.record.title, 'Historic');
  assert.equal(legacy.data.records.length, 1);
});

test('same run retries and record deletion cannot pay twice; daily-limit deferral does not spend and can pay next KST day', async () => {
  const fixture = makeFixture();
  for (let index = 0; index < 3; index += 1) {
    const response = await fixture.post(fixture.bodyFor(`full-${index}`, 'full'));
    assert.equal(response.body.rewards.status, 'awarded');
  }
  const capped = await fixture.post(fixture.bodyFor('deferred-full', 'full'));
  assert.equal(capped.body.rewards.status, 'daily_limit');
  assert.equal(capped.body.rewards.lp, 0);
  assert.equal(capped.body.rewards.credits, 0);
  assert.deepEqual(fixture.data.daily[0] && { lp: fixture.data.daily[0].lp, credits: fixture.data.daily[0].credits }, { lp: 4500, credits: 9000 });

  fixture.data.records.splice(fixture.data.records.findIndex((row) => row.clientRunId === 'deferred-full'), 1);
  fixture.router.testing.configureDependencies({ now: () => new Date('2026-10-27T00:00:00.000Z') });
  const nextDay = await fixture.post(fixture.bodyFor('deferred-full', 'basic', { title: 'changed after delete' }));
  assert.equal(nextDay.body.rewards.status, 'awarded');
  assert.equal(nextDay.body.rewards.tier, 'full');
  assert.equal(nextDay.body.rewards.lp, 1500);
  assert.equal(nextDay.body.record, null, 'a deleted immutable record is not recreated from a changed body');
  assert.equal(fixture.data.users[0].lp, 6040);

  const already = await fixture.post(fixture.bodyFor('full-0', 'full'));
  assert.equal(already.body.rewards.status, 'already_awarded');
  assert.equal(fixture.data.users[0].lp, 6040);
});

test('daily cap accepts exact maximum then returns zero without consuming over-limit budget', async () => {
  const fixture = makeFixture();
  for (let index = 0; index < 3; index += 1) await fixture.post(fixture.bodyFor(`max-full-${index}`, 'full'));
  await fixture.post(fixture.bodyFor('max-basic-0', 'basic'));
  const over = await fixture.post(fixture.bodyFor('max-basic-1', 'basic'));
  assert.equal(over.body.rewards.status, 'daily_limit');
  assert.equal(over.body.rewards.lp, 0);
  assert.deepEqual({ lp: fixture.data.daily[0].lp, credits: fixture.data.daily[0].credits }, { lp: 5000, credits: 10000 });
});

test('transaction failure rolls back record, ledger, daily usage and both wallet balances before retry', async () => {
  const fixture = makeFixture();
  fixture.failBalanceWrite();
  const failed = await fixture.post(fixture.bodyFor('rollback-run'));
  assert.equal(failed.statusCode, 500);
  assert.equal(fixture.data.records.length, 0);
  assert.equal(fixture.data.rewards.length, 0);
  assert.equal(fixture.data.daily.length, 0);
  assert.deepEqual({ lp: fixture.data.users[0].lp, credits: fixture.data.users[0].credits }, { lp: 40, credits: 70 });
  const retry = await fixture.post(fixture.bodyFor('rollback-run'));
  assert.equal(retry.body.rewards.status, 'awarded');
  assert.equal(fixture.data.rewards.length, 1);
});

test('different users retain separate records, reward ledgers, daily budgets and actual balances', async () => {
  const fixture = makeFixture();
  const a = await fixture.post(fixture.bodyFor('shared-run'), { userId: USER_A });
  const b = await fixture.post(fixture.bodyFor('shared-run'), { userId: USER_B });
  assert.equal(a.body.rewards.lp, 500);
  assert.equal(b.body.rewards.lp, 500);
  assert.equal(fixture.data.rewards.length, 2);
  assert.deepEqual(fixture.data.users.map((user) => user.lp), [540, 505]);
});

test('reward contract generation exposes fixed client rules and the exact same server policy', () => {
  const rules = require('../generated/primitiveArchiveRewardContract.json').rules;
  assert.deepEqual(rules, {
    basic: { lp: 500, credits: 1000 },
    full: { lp: 1500, credits: 3000 },
    dailyLimit: { lp: 5000, credits: 10000 },
  });
  assert.ok(CONTRACT.core.technologies.length > 0);
  assert.ok(CONTRACT.core.civics.length > 0);
  assert.ok(CONTRACT.full.technologies.length >= CONTRACT.core.technologies.length);
  assert.ok(CONTRACT.full.civics.length >= CONTRACT.core.civics.length);
});

test('reward and daily models declare unique identities; the user serialization marker is private by default', () => {
  const Reward = require('../models/PrimitiveArchiveReward');
  const Daily = require('../models/PrimitiveArchiveDailyReward');
  const User = require('../models/User');
  assert.ok(Reward.schema.indexes().some(([keys, options]) => (
    keys.userId === 1 && keys.gameSlug === 1 && keys.runId === 1 && options.unique === true
  )));
  assert.ok(Daily.schema.indexes().some(([keys, options]) => (
    keys.userId === 1 && keys.dayKey === 1 && options.unique === true
  )));
  assert.equal(User.schema.path('primitiveArchiveRewardMutationVersion').options.select, false);
});
