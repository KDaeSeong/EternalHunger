const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');

const mongoUri = process.env.EH_TEST_MONGO_URI || '';
const parsed = (() => { try { return new URL(mongoUri); } catch { return null; } })();
const enabled = Boolean(parsed);
const dbName = `eh_archive_rewards_${process.pid}_${randomBytes(6).toString('hex')}`;
const secret = randomBytes(32).toString('hex');
const checks = [];
let mongoose;
let User;
let Reward;
let Daily;
let Record;
let fixtureUsers = [];
let tokens = [];
let workers = [];
let databaseOwned = false;

const workerSource = String.raw`
const express = require('express');
const mongoose = require('mongoose');
const { verifyToken } = require('./middleware/authMiddleware');
const router = require('./routes/gameRecords');
const app = express();
app.use(express.json({ limit: '2mb' }));
app.post('/__test/fail-next', (req, res) => {
  router.testing.configureDependencies({ afterDailyIncrement: async () => { router.testing.configureDependencies({ afterDailyIncrement: null }); throw new Error('injected transaction failure'); } });
  res.json({ ready: true });
});
app.use('/api/game-records', verifyToken, router);
let server;
(async () => {
  mongoose.set('autoIndex', false);
  await mongoose.connect(process.env.EH_TEST_MONGO_URI, { dbName: process.env.EH_TEST_DB, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  server = app.listen(0, '127.0.0.1', () => process.stdout.write('READY ' + server.address().port + '\n'));
})();
process.on('SIGTERM', async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); process.exit(0); });
`;

function check(name, action) {
  test(name, { skip: !enabled }, async () => { await action(); checks.push(name); });
}

before(async () => {
  if (!enabled) return;
  assert.ok(parsed.protocol === 'mongodb:' && ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
    && parsed.pathname === '/' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash,
  'EH_TEST_MONGO_URI must be an unauthenticated loopback root Mongo URI.');
  process.env.MY_SECRET_KEY = secret;
  mongoose = require('mongoose');
  mongoose.set('autoIndex', false);
  const client = new mongoose.mongo.MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    assert.equal((await client.db('admin').admin().listDatabases({ nameOnly: true })).databases.some((x) => x.name === dbName), false);
  } finally {
    await client.close();
  }
  databaseOwned = true;
  await mongoose.connect(mongoUri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  assert.deepEqual(await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray(), []);
  User = require('../models/User'); Record = require('../models/GamePlayRecord');
  Reward = require('../models/PrimitiveArchiveReward'); Daily = require('../models/PrimitiveArchiveDailyReward');
  fixtureUsers = await User.create(Array.from({ length: 6 }, (_, index) => ({
    username: `archive_reward_${index}_${randomBytes(5).toString('hex')}`, password: randomBytes(20).toString('hex'),
  })));
  tokens = fixtureUsers.map((row) => require('jsonwebtoken').sign({ id: String(row._id), tokenVersion: row.tokenVersion }, secret));
  try {
    workers.push(await startWorker('A'));
    workers.push(await startWorker('B'));
  } catch (error) {
    await Promise.all(workers.map((worker) => worker.stop().catch(() => {})));
    throw error;
  }
});

after(async () => {
  if (!enabled) return;
  for (const worker of workers) await worker.stop();
  if (mongoose?.connection?.readyState) {
    if (databaseOwned) {
      assert.equal(mongoose.connection.db.databaseName, dbName);
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  } else if (databaseOwned) {
    await mongoose.connect(mongoUri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    assert.equal(mongoose.connection.db.databaseName, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  process.stdout.write(`PRIMITIVE_ARCHIVE_REWARDS_MONGO ${JSON.stringify({ pass: checks.length === 6, checks, dbName, databaseDropped: databaseOwned })}\n`);
});

async function startWorker(label) {
  const child = spawn(process.execPath, ['-e', workerSource], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, EH_TEST_DB: dbName, EH_TEST_MONGO_URI: mongoUri, MY_SECRET_KEY: secret },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const match = output.match(/READY (\d+)/);
    if (match) return { label, child, port: Number(match[1]), stop: () => stopChild(child) };
    if (child.exitCode !== null) throw new Error(`Worker ${label} exited: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill(); throw new Error(`Worker ${label} did not start: ${output}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), new Promise((_, reject) => setTimeout(() => reject(new Error('Worker shutdown timed out')), 5000))]);
}

function completed(runId, tier = 'basic') {
  const contract = require('../generated/primitiveArchiveRewardContract.json');
  const groups = tier === 'full' ? contract.full : contract.core;
  return { payload: { state: {
    runId, day: contract.baseDays, ended: true, victory: true,
    devTools: {
      enabled: false,
      used: false,
      guaranteedSuccess: false,
      unlockSpecializedActions: false,
      actionBonuses: {},
    },
    meta: { lastSettledRunId: runId },
    research: { completed: Object.fromEntries(groups.technologies.map((id) => [id, true])) },
    civics: { completed: Object.fromEntries(groups.civics.map((id) => [id, true])) },
    camp: { ...contract.campRequirements },
    inventory: Object.fromEntries(contract.bookRequirements.map((id) => [id, 1])),
    party: Array.from({ length: contract.survivorCount }, () => ({ hp: 80 })),
  } }, mode: 'survival-loop', result: 'clear', score: 999999999 };
}

async function post(worker, runId, tier = 'basic', accountIndex = 0, payloadOverride) {
  const body = completed(runId, tier);
  if (payloadOverride !== undefined) body.payload = payloadOverride;
  const response = await fetch(`http://127.0.0.1:${worker.port}/api/game-records/primitive-archive`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokens[accountIndex]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

check('two independent HTTP processes award one shared run once', async () => {
  const runId = `same-${randomBytes(7).toString('hex')}`;
  const replies = await Promise.all([post(workers[0], runId), post(workers[1], runId)]);
  assert.deepEqual(replies.map((x) => x.status).sort(), [200, 201]);
  assert.deepEqual(replies.map((x) => x.body.rewards.status).sort(), ['already_awarded', 'awarded']);
  for (const reply of replies) {
    assert.deepEqual({ lp: reply.body.rewards.lp, credits: reply.body.rewards.credits, tier: reply.body.rewards.tier }, {
      lp: 500, credits: 1000, tier: 'basic',
    });
  }
  const user = fixtureUsers[0];
  assert.equal(await Reward.countDocuments({ userId: user._id, runId }), 1);
  assert.equal(await Record.countDocuments({ userId: user._id, clientRunId: runId }), 1);
  const wallet = await User.findById(user._id).select('lp credits').lean();
  assert.deepEqual({ lp: wallet.lp, credits: wallet.credits }, { lp: 500, credits: 1000 });
});

check('different run race respects daily cap without spending excess', async () => {
  const user = fixtureUsers[1];
  const ids = ['f1', 'f2', 'f3'].map((x) => `${x}-${randomBytes(5).toString('hex')}`);
  for (const id of ids) {
    const result = await post(workers[0], id, 'full', 1);
    assert.equal(result.body.rewards.status, 'awarded');
    assert.deepEqual({ lp: result.body.rewards.lp, credits: result.body.rewards.credits, tier: result.body.rewards.tier }, {
      lp: 1500, credits: 3000, tier: 'full',
    });
  }
  const raceIds = [0, 1].map((i) => `cap-${i}-${randomBytes(5).toString('hex')}`);
  const replies = await Promise.all([post(workers[0], raceIds[0], 'basic', 1), post(workers[1], raceIds[1], 'basic', 1)]);
  assert.deepEqual(replies.map((x) => x.body.rewards.status).sort(), ['awarded', 'daily_limit']);
  const daily = await Daily.findOne({ userId: user._id, dayKey: require('../routes/gameRecords').testing.toKstDayKey(new Date()) }).lean();
  assert.deepEqual({ lp: daily.lp, credits: daily.credits }, { lp: 5000, credits: 10000 });
});

check('transaction failure after daily mutation rolls back all reward effects', async () => {
  const user = fixtureUsers[2];
  const fail = await fetch(`http://127.0.0.1:${workers[0].port}/__test/fail-next`, { method: 'POST' });
  assert.equal(fail.status, 200);
  const runId = `rollback-${randomBytes(6).toString('hex')}`;
  const before = await User.findById(user._id).select('lp credits').lean();
  const result = await post(workers[0], runId, 'basic', 2);
  assert.equal(result.status, 500);
  assert.equal(await Record.countDocuments({ userId: user._id, clientRunId: runId }), 0);
  assert.equal(await Reward.countDocuments({ userId: user._id, runId }), 0);
  assert.equal(await Daily.countDocuments({ userId: user._id }), 0);
  const afterWallet = await User.findById(user._id).select('lp credits').lean();
  assert.deepEqual({ lp: afterWallet.lp, credits: afterWallet.credits }, { lp: before.lp, credits: before.credits });
});

check('deleting a paid history row and resubmitting cannot pay again', async () => {
  const user = fixtureUsers[3];
  const runId = `delete-${randomBytes(6).toString('hex')}`;
  const first = await post(workers[0], runId, 'basic', 3);
  assert.equal(first.body.rewards.status, 'awarded');
  assert.deepEqual({ lp: first.body.rewards.lp, credits: first.body.rewards.credits, tier: first.body.rewards.tier }, {
    lp: 500, credits: 1000, tier: 'basic',
  });
  const prior = await User.findById(user._id).select('lp credits').lean();
  await Record.deleteOne({ userId: user._id, clientRunId: runId });
  const retry = await post(workers[1], runId, 'basic', 3);
  assert.equal(retry.body.record, null);
  assert.equal(retry.body.rewards.status, 'already_awarded');
  assert.deepEqual({ lp: retry.body.rewards.lp, credits: retry.body.rewards.credits, tier: retry.body.rewards.tier }, {
    lp: 500, credits: 1000, tier: 'basic',
  });
  const wallet = await User.findById(user._id).select('lp credits').lean();
  assert.deepEqual({ lp: wallet.lp, credits: wallet.credits }, { lp: prior.lp, credits: prior.credits });
});

check('an existing completed snapshot can claim its first receipt with exact full amounts', async () => {
  const user = fixtureUsers[4];
  const runId = `historic-${randomBytes(6).toString('hex')}`;
  const stored = completed(runId, 'full');
  const historicalDocument = new Record({
    userId: user._id,
    gameSlug: 'primitive-archive',
    clientRunId: runId,
    title: 'Stored historical completion',
    mode: 'survival-loop',
    result: 'clear',
    score: 7,
    playTimeSec: 90,
    summary: { day: stored.payload.state.day },
    payload: stored.payload,
  });
  const historicalRow = historicalDocument.toObject();
  assert.equal(Object.hasOwn(historicalRow.payload.state.devTools, 'actionBonuses'), false,
    'Legacy fixture must use the actual Mongoose minimized serialization shape.');
  await Record.collection.insertOne(historicalRow);
  const response = await post(workers[1], runId, 'basic', 4);
  assert.equal(response.status, 200);
  assert.equal(response.body.replayed, true);
  assert.equal(response.body.rewards.status, 'awarded');
  assert.deepEqual({ lp: response.body.rewards.lp, credits: response.body.rewards.credits, tier: response.body.rewards.tier }, {
    lp: 1500, credits: 3000, tier: 'full',
  });
  assert.equal(response.body.userProgress.lp, 1500);
  assert.equal(response.body.userProgress.credits, 3000);
  assert.equal(await Reward.countDocuments({ userId: user._id, runId }), 1);
});

check('legacy ineligible ledger is repaired only from its surviving minimized original snapshot', async () => {
  const user = fixtureUsers[5];
  const runId = `legacy-ineligible-${randomBytes(6).toString('hex')}`;
  const original = completed(runId, 'full');
  const historicalDocument = new Record({
    userId: user._id,
    gameSlug: 'primitive-archive',
    clientRunId: runId,
    title: 'Original stored completion',
    mode: 'survival-loop',
    result: 'clear',
    payload: original.payload,
  });
  const historicalRow = historicalDocument.toObject();
  assert.equal(Object.hasOwn(historicalRow.payload.state.devTools, 'actionBonuses'), false);
  await Record.collection.insertOne(historicalRow);
  await Reward.create({
    userId: user._id,
    gameSlug: 'primitive-archive',
    runId,
    status: 'ineligible',
    tier: null,
    lp: 0,
    credits: 0,
  });

  const changedState = completed(runId, 'basic').payload;
  changedState.state.victory = false;
  const response = await post(workers[0], runId, 'basic', 5, changedState);
  assert.equal(response.body.record.title, 'Original stored completion');
  assert.equal(response.body.replayed, true);
  assert.equal(response.body.rewards.status, 'awarded');
  assert.deepEqual({ lp: response.body.rewards.lp, credits: response.body.rewards.credits, tier: response.body.rewards.tier }, {
    lp: 1500, credits: 3000, tier: 'full',
  });
  assert.equal(response.body.userProgress.lp, 1500);
  assert.equal(response.body.userProgress.credits, 3000);
  const ledgers = await Reward.find({ userId: user._id, runId }).lean();
  assert.equal(ledgers.length, 1, 'The original ineligible ledger identity is repaired in place.');
  assert.equal(ledgers[0].status, 'awarded');
  assert.equal(ledgers[0].tier, 'full');
});
