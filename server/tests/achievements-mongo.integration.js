const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { createAchievementService, recordKey } = require('../utils/achievementService');
const { createAchievementTotalsLoader } = require('../utils/achievementTotals');
const { buildAchievementPayload } = require('../utils/achievementPayload');

const rawUri = process.env.ACHIEVEMENT_TEST_MONGO_URI;
if (!rawUri) throw new Error('Set ACHIEVEMENT_TEST_MONGO_URI to a fresh, isolated localhost replica-set database.');
const uri = new URL(rawUri);
const databaseName = uri.pathname.slice(1);
assert.equal(uri.protocol, 'mongodb:');
assert.equal(uri.hostname, '127.0.0.1');
assert.ok(uri.port && !uri.username && !uri.password);
assert.match(databaseName, /^achievement-test-[a-f0-9]{12}$/);
assert.ok(uri.searchParams.get('replicaSet'));

const models = {
  User: require('../models/User'), AchievementRecord: require('../models/AchievementRecord'),
  Character: require('../models/Characters'), TeamRecord: require('../models/TeamRecord'),
  GameLog: require('../models/GameLog'), Post: require('../models/Post'),
  TwentyQuestionsRoom: require('../models/TwentyQuestionsRoom'),
  GamePlayRecord: require('../models/GamePlayRecord'), PrimitiveArchiveReward: require('../models/PrimitiveArchiveReward'),
};
const A = new mongoose.Types.ObjectId('64b000000000000000000001');
const B = new mongoose.Types.ObjectId('64b000000000000000000002');
const C = new mongoose.Types.ObjectId('64b000000000000000000003');
const at = new Date('2026-11-14T12:00:00Z');
let groups = 0;
let passed = false;
let connected = false;
async function check(name, work) { await work(); groups += 1; console.log(JSON.stringify({ pass: true, group: groups, name })); }

(async () => {
  const probe = new mongoose.mongo.MongoClient(rawUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await probe.connect();
    assert.deepEqual(await probe.db(databaseName).listCollections().toArray(), [], 'Refuse to modify a database that already contains data.');
  } finally { await probe.close(); }
  await mongoose.connect(rawUri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  connected = true;
  await mongoose.connection.db.collection('__achievement_test_owner').insertOne({ _id: databaseName, ownedBy: 'achievements-mongo.integration.js' });
  for (const model of Object.values(models)) await model.createCollection();
  await models.User.create([A, B, C].map((_id, index) => ({ _id, username: 'achievement-fixture-' + index,
    password: crypto.randomBytes(20).toString('hex'), nickname: '시험 계정 ' + index,
    lp: index === 0 ? 1000 : 0, credits: index === 0 ? 1000 : 0,
    statistics: { totalGames: index === 1 ? 0 : 1, totalWins: 0, totalKills: 0 } })));
  await models.Character.collection.insertMany(Array.from({ length: 5 }, (_, index) => ({ userId: A, name: 'fixture-character-' + index })));
  const loadTotals = createAchievementTotalsLoader(models);
  const service = createAchievementService({ ...models, loadTotals, now: () => at });

  await check('concurrent first reads create one durable record for each achieved milestone', async () => {
    await Promise.all(Array.from({ length: 12 }, () => service.snapshot(A)));
    const rows = await models.AchievementRecord.find({ userId: A }).lean();
    assert.deepEqual(rows.map((row) => row.achievementId).sort(), ['first_sim', 'lp_climber', 'roster_builder', 'wallet']);
    assert.ok(rows.every((row) => row.claimedAt === null));
    assert.equal((await models.User.findById(A).lean()).lp, 1000);
  });

  await check('twenty real concurrent transactions pay an individual reward once', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => service.claim(A, { achievementIds: ['first_sim'] })));
    assert.equal(results.reduce((sum, row) => sum + row.claim.count, 0), 1);
    const user = await models.User.findById(A).lean();
    assert.deepEqual([user.lp, user.credits], [1050, 1100]);
    const retry = await service.claim(A, { achievementIds: ['first_sim'] });
    assert.deepEqual(retry.claim.previouslyAwarded, { lp: 50, credits: 100 });
    assert.deepEqual(buildAchievementPayload(retry).userProgress, { lp: 1050, credits: 1100 });
  });

  await check('spending balances and deleting a roster preserve original unlocks and dates', async () => {
    await models.User.updateOne({ _id: A }, { $set: { lp: 0, credits: 0 } });
    await models.Character.deleteMany({ userId: A });
    const snapshot = await service.snapshot(A);
    const payload = buildAchievementPayload(snapshot);
    for (const id of ['wallet', 'lp_climber', 'roster_builder']) {
      const row = payload.achievements.find((entry) => entry.id === id);
      assert.equal(row.completed, true); assert.equal(row.currentValue, 0);
      assert.equal(row.unlockedAt, at.toISOString());
    }
  });

  await check('overlapping all and individual claims share durable account/achievement identities', async () => {
    const results = await Promise.all([
      service.claim(A, { all: true }), service.claim(A, { achievementIds: ['wallet'] }), service.claim(A, { all: true }),
    ]);
    assert.equal(results.reduce((sum, row) => sum + row.claim.lp, 0), 325);
    const user = await models.User.findById(A).lean();
    assert.deepEqual([user.lp, user.credits], [325, 650]);
    await assert.rejects(service.claim(B, { achievementIds: ['first_sim'], userId: A, lp: 999999 }), { code: 'ACHIEVEMENT_NOT_UNLOCKED' });
    assert.equal((await models.User.findById(B).lean()).lp, 0);
  });

  await check('an injected balance-write failure rolls back the real Mongo claim transaction', async () => {
    await service.snapshot(C);
    const failingUser = { db: models.User.db, findById: models.User.findById.bind(models.User),
      updateOne: async (filter, update, options) => {
        if (Object.hasOwn(update.$inc || {}, 'lp')) throw new Error('Injected balance failure');
        return models.User.updateOne(filter, update, options);
      } };
    const failing = createAchievementService({ User: failingUser, AchievementRecord: models.AchievementRecord, loadTotals, now: () => at });
    await assert.rejects(failing.claim(C, { all: true }), /Injected balance failure/);
    assert.equal((await models.AchievementRecord.findById(recordKey(C, 'first_sim')).lean()).claimedAt, null);
    assert.equal((await models.User.findById(C).lean()).lp, 0);
    assert.equal((await service.claim(C, { all: true })).claim.lp, 50);
    assert.equal((await service.claim(C, { all: true })).claim.lp, 0);
  });

  await check('real record aggregation deduplicates legacy runs and excludes other accounts and unsupported games', async () => {
    await models.GamePlayRecord.collection.insertMany([
      { userId: A, gameSlug: 'company-report', clientRunId: 'same-legacy-run', result: 'none', playedAt: new Date(1) },
      { userId: A, gameSlug: 'company-report', clientRunId: 'same-legacy-run', result: 'clear', playedAt: new Date(2) },
      { userId: A, gameSlug: 'ba-vanguard', result: 'win', playedAt: new Date(3) },
      { userId: A, gameSlug: 'invented-game', result: 'win', playedAt: new Date(4) },
      { userId: B, gameSlug: 'myanimecraft', result: 'win', playedAt: new Date(5) },
      { userId: A, gameSlug: 'primitive-archive', result: 'clear', payload: { state: { devTools: { used: true } } } },
    ]);
    await models.PrimitiveArchiveReward.collection.insertMany([
      { userId: A, gameSlug: 'primitive-archive', runId: 'basic', tier: 'basic', status: 'daily_limit' },
      { userId: A, gameSlug: 'primitive-archive', runId: 'full', tier: 'full', status: 'awarded' },
      { userId: A, gameSlug: 'primitive-archive', runId: 'developer', tier: null, status: 'ineligible' },
      { userId: A, gameSlug: 'primitive-archive', runId: 'inconsistent', tier: 'basic', status: 'ineligible' },
      { userId: B, gameSlug: 'primitive-archive', runId: 'other-account', tier: 'full', status: 'awarded' },
    ]);
    const { totals } = await loadTotals(A);
    assert.deepEqual([totals.gameRecords, totals.gameClears, totals.gameVariety], [4, 3, 3]);
    assert.deepEqual([totals.archiveRuns, totals.archiveFullRuns, totals['game:company-report']], [2, 1, 1]);
    const snapshot = await service.snapshot(A);
    const ids = new Set(snapshot.records.map((row) => row.achievementId));
    for (const id of ['archive_basic', 'archive_full', 'three_games', 'game_company-report', 'game_ba-vanguard']) assert.ok(ids.has(id), id);
    assert.equal(ids.has('game_myanimecraft'), false);
  });

  passed = true;
  console.log(JSON.stringify({ pass: true, groups, scope: 'Actual isolated local MongoDB replica-set claims and statistics; no public data or account writes.' }));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (connected && passed) {
    const owner = await mongoose.connection.db.collection('__achievement_test_owner').findOne({ _id: databaseName });
    assert.equal(owner?.ownedBy, 'achievements-mongo.integration.js');
    const allowed = new Set(['__achievement_test_owner', ...Object.values(models).map((model) => model.collection.name)]);
    const collections = await mongoose.connection.db.listCollections().toArray();
    assert.ok(collections.every((collection) => allowed.has(collection.name)), 'Refuse to drop a database containing unrelated collections.');
    await mongoose.connection.dropDatabase();
    console.log(JSON.stringify({ databaseDropped: true, databaseName }));
  }
  await mongoose.disconnect();
});
