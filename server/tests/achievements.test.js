const test = require('node:test');
const assert = require('node:assert/strict');
const { ACHIEVEMENTS, GAME_MILESTONES, buildAchievementRows } = require('../../shared/achievementCatalog.cjs');
const { createAchievementService, recordKey } = require('../utils/achievementService');
const { buildAchievementPayload } = require('../utils/achievementPayload');
const { createAchievementTotalsLoader, gameRecordPipeline } = require('../utils/achievementTotals');

const A = '64b000000000000000000001';
const B = '64b000000000000000000002';
const AT = new Date('2026-11-14T12:00:00Z');
const clone = (value) => structuredClone(value);

function fixture(initial = {}) {
  let data = { users: {
    [A]: { _id: A, username: 'account-a', nickname: '시험 계정', lp: 0, credits: 0 },
    [B]: { _id: B, username: 'account-b', lp: 0, credits: 0 },
  }, totals: { [A]: {}, [B]: {} }, records: {} };
  Object.assign(data.users[A], initial.user);
  Object.assign(data.totals[A], initial.totals);
  let queue = Promise.resolve();
  let failBalance = false;
  let failLedger = false;
  let transactionsAvailable = true;
  let time = AT;
  const query = (get) => ({ session() { return this; }, select() { return this; },
    lean() { return Promise.resolve(clone(get())); } });
  const User = {
    db: { transaction(work) {
      if (!transactionsAvailable) return Promise.reject(new Error('Transactions unavailable'));
      const run = async () => {
        const backup = clone(data);
        try { return await work({ fixtureSession: true }); } catch (error) { data = backup; throw error; }
      };
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    } },
    findById(id) { return query(() => data.users[String(id)] || null); },
    async updateOne(filter, update) {
      const user = data.users[String(filter._id)];
      if (!user) return { matchedCount: 0 };
      if (failBalance && Object.hasOwn(update.$inc || {}, 'lp')) throw new Error('Balance write failed');
      for (const [key, value] of Object.entries(update.$inc || {})) user[key] = (user[key] || 0) + value;
      return { matchedCount: 1 };
    },
  };
  const AchievementRecord = {
    find(filter) { return query(() => Object.values(data.records).filter((row) => row.userId === String(filter.userId))); },
    async updateOne(filter, update, options = {}) {
      let row = data.records[filter._id];
      if (!row && options.upsert) {
        row = { _id: filter._id, ...clone(update.$setOnInsert) };
        row.userId = String(update.$setOnInsert.userId);
        data.records[filter._id] = row;
      } else if (!row || (filter.userId && row.userId !== String(filter.userId))
        || (Object.hasOwn(filter, 'claimedAt') && Boolean(row.claimedAt)) || (failLedger && update.$set)) {
        return { matchedCount: 0 };
      }
      if (update.$set) Object.assign(row, clone(update.$set));
      return { matchedCount: 1 };
    },
  };
  const loadTotals = async (id) => {
    const user = clone(data.users[String(id)] || null);
    return { user, totals: { ...clone(data.totals[String(id)] || {}), lp: user?.lp || 0, credits: user?.credits || 0 } };
  };
  const dependencies = { User, AchievementRecord, loadTotals, now: () => time };
  return { service: createAchievementService(dependencies), dependencies,
    data: () => data, setTime(value) { time = value; },
    failBalance(value) { failBalance = value; }, failLedger(value) { failLedger = value; },
    transactions(value) { transactionsAvailable = value; } };
}

test('47 stable achievement identities retain all original points and define bounded one-time rewards', () => {
  assert.equal(ACHIEVEMENTS.length, 47);
  assert.equal(new Set(ACHIEVEMENTS.map((row) => row.id)).size, 47);
  const legacy = { first_sim: 10, ten_games: 30, first_win: 20, hunter: 25, roster_builder: 20,
    team_archivist: 20, replay_keeper: 25, poster: 10, commentator: 15, twenty_host: 10,
    twenty_solver: 20, wallet: 20, lp_climber: 25, badge_collector: 25 };
  for (const [id, points] of Object.entries(legacy)) assert.equal(ACHIEVEMENTS.find((row) => row.id === id)?.points, points);
  for (const row of ACHIEVEMENTS) {
    assert.ok(row.target > 0 && row.points > 0 && row.href.startsWith('/'));
    assert.deepEqual(row.reward, { lp: row.points * 5, credits: row.points * 10 });
    assert.ok(Object.isFrozen(row));
  }
  assert.equal(GAME_MILESTONES.length, 13);
});

test('snapshot backfills existing progress without changing an account balance', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  const result = await f.service.snapshot(A);
  assert.deepEqual(result.records.map((row) => row.achievementId), ['first_sim']);
  assert.equal(result.records[0].claimedAt, null);
  assert.equal(f.data().users[A].lp, 0);
  assert.equal(buildAchievementPayload(result).season.score, 10);
});

test('spending currency and deleting characters cannot revoke prior achievements or their original dates', async () => {
  const f = fixture({ user: { lp: 1000, credits: 1000 }, totals: { characters: 5 } });
  const first = await f.service.snapshot(A);
  f.data().users[A].lp = 0;
  f.data().users[A].credits = 0;
  f.data().totals[A].characters = 0;
  f.setTime(new Date('2026-11-15T12:00:00Z'));
  const after = await f.service.snapshot(A);
  const rows = buildAchievementRows(after.totals, after.records);
  for (const id of ['wallet', 'lp_climber', 'roster_builder']) {
    assert.equal(rows.find((row) => row.id === id).completed, true);
    assert.equal(rows.find((row) => row.id === id).progress, 1);
    assert.equal(rows.find((row) => row.id === id).unlockedAt, AT.toISOString());
  }
  assert.equal(after.records.length, first.records.length);
});

test('an individual reward is paid exactly once and retries show the previous payment and latest balance', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  const first = await f.service.claim(A, { achievementIds: ['first_sim'] });
  assert.deepEqual([first.claim.count, first.claim.lp, first.claim.credits], [1, 50, 100]);
  const second = await f.service.claim(A, { achievementIds: ['first_sim'] });
  assert.equal(second.claim.count, 0);
  assert.equal(second.claim.alreadyClaimedCount, 1);
  assert.deepEqual(second.claim.previouslyAwarded, { lp: 50, credits: 100 });
  assert.deepEqual(buildAchievementPayload(second).userProgress, { lp: 50, credits: 100 });
});

test('twenty concurrent claims share one payment', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  const results = await Promise.all(Array.from({ length: 20 }, () => f.service.claim(A, { achievementIds: ['first_sim'] })));
  assert.equal(results.reduce((sum, result) => sum + result.claim.count, 0), 1);
  assert.deepEqual([f.data().users[A].lp, f.data().users[A].credits], [50, 100]);
  assert.equal(Object.keys(f.data().records).length, 1);
});

test('overlapping all/individual requests grant each eligible achievement once', async () => {
  const f = fixture({ user: { lp: 1000, credits: 1000 }, totals: { totalGames: 10, totalWins: 1, totalKills: 10, characters: 5 } });
  const snapshot = await f.service.snapshot(A);
  const expected = snapshot.records.reduce((sum, row) => ({ lp: sum.lp + row.rewardLp, credits: sum.credits + row.rewardCredits }), { lp: 0, credits: 0 });
  const results = await Promise.all([
    f.service.claim(A, { achievementIds: ['first_sim', 'hunter'] }), f.service.claim(A, { all: true }), f.service.claim(A, { all: true }),
  ]);
  assert.equal(results.reduce((sum, row) => sum + row.claim.lp, 0), expected.lp);
  assert.equal(results.reduce((sum, row) => sum + row.claim.credits, 0), expected.credits);
  assert.deepEqual([f.data().users[A].lp, f.data().users[A].credits], [1000 + expected.lp, 1000 + expected.credits]);
});

test('duplicate selection IDs, forged reward amounts and another account ID cannot change the server grant', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  const result = await f.service.claim(A, { achievementIds: ['first_sim', 'first_sim'], userId: B, lp: 999999, credits: 999999 });
  assert.equal(result.claim.count, 1);
  assert.deepEqual([result.claim.lp, result.claim.credits], [50, 100]);
  assert.deepEqual([f.data().users[B].lp, f.data().users[B].credits], [0, 0]);
});

test('invalid selection and unearned achievements reject without granting rewards', async () => {
  const f = fixture();
  for (const body of [null, [], {}, { achievementIds: [] }, { achievementIds: ['unknown'] }, { achievementIds: [42] }]) {
    await assert.rejects(f.service.claim(A, body), { code: 'ACHIEVEMENT_INVALID_SELECTION' });
  }
  await assert.rejects(f.service.claim(A, { achievementIds: ['hunter'] }), { code: 'ACHIEVEMENT_NOT_UNLOCKED' });
  assert.equal(f.data().users[A].lp, 0);
  assert.deepEqual(f.data().records, {});
});

test('a failed balance write rolls back the claim ledger and a retry pays once', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  await f.service.snapshot(A);
  f.failBalance(true);
  await assert.rejects(f.service.claim(A, { all: true }), /Balance write failed/);
  assert.equal(f.data().records[recordKey(A, 'first_sim')].claimedAt, null);
  assert.equal(f.data().users[A].lp, 0);
  f.failBalance(false);
  assert.equal((await f.service.claim(A, { all: true })).claim.lp, 50);
});

test('ledger conflicts and unavailable transactions never fall back to a separate balance grant', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  await f.service.snapshot(A);
  f.failLedger(true);
  await assert.rejects(f.service.claim(A, { all: true }), { code: 'ACHIEVEMENT_CLAIM_CONFLICT' });
  assert.equal(f.data().users[A].lp, 0);
  f.transactions(false);
  await assert.rejects(f.service.claim(A, { all: true }), /Transactions unavailable/);
  assert.equal(f.data().records[recordKey(A, 'first_sim')].claimedAt, null);
});

test('rewards that cross a wallet threshold unlock the new achievement without paying it in the old request', async () => {
  const f = fixture({ user: { lp: 975 }, totals: { totalGames: 1 } });
  const result = await f.service.claim(A, { all: true });
  assert.equal(result.claim.count, 1);
  const row = buildAchievementPayload(result).achievements.find((entry) => entry.id === 'lp_climber');
  assert.equal(row.claimable, true);
  assert.equal(result.user.lp, 1025);
  assert.equal((await f.service.claim(A, { all: true })).claim.lp, 125);
});

test('all claims ignore unknown retired ledger IDs and preserve stored reward snapshots', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  await f.service.snapshot(A);
  f.data().records[recordKey(A, 'first_sim')].rewardLp = 40;
  f.data().records[recordKey(A, 'retired_id')] = { _id: recordKey(A, 'retired_id'), userId: A, achievementId: 'retired_id', rewardLp: 999999, rewardCredits: 999999 };
  assert.equal((await f.service.claim(A, { all: true })).claim.lp, 40);
  assert.equal(f.data().records[recordKey(A, 'retired_id')].claimedAt, undefined);
});

test('payload does not mutate its inputs and anonymous rows cannot claim rewards', () => {
  const input = { user: null, totals: {}, records: [] };
  const before = clone(input);
  const payload = buildAchievementPayload(input);
  assert.equal(payload.achievements.length, 47);
  assert.equal(payload.achievements.some((row) => row.completed || row.claimable), false);
  assert.deepEqual(input, before);
  assert.equal(payload.unclaimedRewards.count, 0);
});

test('statistics are scoped to the account, ignore unsupported games and use archive eligibility ledgers', async () => {
  const seen = [];
  const value = (data) => ({ session() { return this; }, select() { return this; }, lean: () => Promise.resolve(data), then: (yes, no) => Promise.resolve(data).then(yes, no) });
  const aggregate = (rows) => (pipeline) => { seen.push(pipeline); return value(rows); };
  const user = { _id: A, lp: 7, credits: 8, statistics: { totalGames: 2 }, badges: [], perks: [] };
  const loader = createAchievementTotalsLoader({ User: { findById: () => value(user) }, Character: { countDocuments: () => value(5) },
    TeamRecord: { aggregate: aggregate([{ teams: 3, wins: 4 }]) }, GameLog: { countDocuments: () => value(6) },
    Post: { countDocuments: () => value(1), aggregate: aggregate([{ count: 5 }]) }, TwentyQuestionsRoom: { countDocuments: () => value(1) },
    GamePlayRecord: { aggregate: aggregate([{ _id: 'company-report', plays: 2, clears: 1 }, { _id: 'made-up-game', plays: 999, clears: 999 }]) },
    PrimitiveArchiveReward: { aggregate: aggregate([{ runs: 1, full: 1 }]) },
  });
  const { totals } = await loader(A);
  assert.deepEqual([totals.gameRecords, totals.gameClears, totals.gameVariety, totals.sitePlays], [3, 2, 2, 5]);
  assert.deepEqual([totals.archiveRuns, totals.archiveFullRuns, totals['game:company-report']], [1, 1, 2]);
  assert.ok(seen.every((pipeline) => pipeline[0].$match.userId === A || pipeline[0].$match['comments.authorId'] === A));
  const pipeline = gameRecordPipeline(A);
  assert.deepEqual(pipeline[1].$project, { gameSlug: 1, clientRunId: 1, result: 1, playedAt: 1 });
  assert.ok(seen.some((p) => p[0].$match.status?.$in.includes('daily_limit')));
});

test('router rejects guests, invalid IDs and unmet claims without accepting a body user ID', async () => {
  const f = fixture({ totals: { totalGames: 1 } });
  const { createAchievementsRouter } = require('../routes/achievements');
  const router = createAchievementsRouter(f.dependencies);
  async function call(method, path, user, body) {
    const handler = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
    await handler({ user, body }, res);
    return res;
  }
  assert.equal((await call('get', '/', null)).code, 401);
  assert.equal((await call('get', '/', { id: 'bad-id' })).code, 401);
  const result = await call('post', '/claim', { id: A }, { achievementIds: ['first_sim'], userId: B });
  assert.equal(result.code, 200);
  assert.equal(result.body.user._id, A);
  assert.deepEqual(result.body.userProgress, { lp: 50, credits: 100 });
  assert.equal((await call('post', '/claim', { id: B }, { achievementIds: ['hunter'] })).code, 409);
});

test('the public catalog contains conditions and rewards without account progress or records', () => {
  const { publicCatalog } = require('../routes/achievements');
  let data;
  publicCatalog({}, { json(value) { data = value; } });
  assert.equal(data.count, 47);
  assert.equal(data.achievements.length, 47);
  assert.equal(data.user, undefined);
  assert.ok(data.achievements.every((row) => row.completed === undefined && row.unlockedAt === undefined && row.metric === undefined));
  assert.deepEqual(data.achievements.find((row) => row.id === 'first_sim').reward, { lp: 50, credits: 100 });
});
