const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');

// Actual MongoDB acceptance check. Use only a disposable loopback MongoDB:
// EH_TEST_MONGO_URI=mongodb://127.0.0.1:PORT/ node --test server/tests/game-record-mongo.integration.js
const mongoUri = process.env.EH_TEST_MONGO_URI || '';
const parsedMongoUri = (() => {
  try { return new URL(mongoUri); } catch { return null; }
})();
assert.ok(
  parsedMongoUri
    && parsedMongoUri.protocol === 'mongodb:'
    && ['127.0.0.1', 'localhost'].includes(parsedMongoUri.hostname)
    && parsedMongoUri.pathname === '/'
    && !parsedMongoUri.username
    && !parsedMongoUri.password
    && !parsedMongoUri.search
    && !parsedMongoUri.hash,
  'EH_TEST_MONGO_URI must be an unauthenticated loopback MongoDB URI with no database or options.',
);

const dbName = `eh_archive_acceptance_${process.pid}_${Date.now()}_${randomBytes(5).toString('hex')}`;
const ownedDbNamePattern = /^eh_archive_acceptance_\d+_\d+_[a-f0-9]{10}$/;
const fixtureSecret = randomBytes(32).toString('hex');
const priorSecret = process.env.MY_SECRET_KEY;
let mongoose;
let mongoClient;
let userModel;
let recordModel;
let verifyToken;
let server;
let serverVersion = '';
let mongoPid = null;
let databaseOwned = false;
let databaseDropped = false;
let cleanupError = '';
let fixtureUsers = [];
let fixtureTokens = [];
const checks = [];

function check(name, action) {
  test(name, async () => {
    await action();
    checks.push(name);
  });
}

before(async () => {
  process.env.MY_SECRET_KEY = fixtureSecret;
  mongoose = require('mongoose');
  mongoose.set('autoIndex', false);

  mongoClient = new mongoose.mongo.MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  const listed = await mongoClient.db('admin').admin().listDatabases({ nameOnly: true });
  assert.equal(listed.databases.some((entry) => entry.name === dbName), false, 'Generated test database already exists.');
  databaseOwned = true;

  await mongoose.connect(mongoUri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  const preexistingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  assert.deepEqual(preexistingCollections, [], 'Generated test database must be empty before setup.');

  const serverInfo = await mongoose.connection.db.admin().command({ buildInfo: 1 });
  serverVersion = String(serverInfo.version || 'unknown');
  const launchOptions = await mongoose.connection.db.admin().command({ getCmdLineOpts: 1 });
  assert.equal(launchOptions.parsed.net.bindIp, '127.0.0.1', 'MongoDB must bind to loopback only.');
  assert.equal(Number(launchOptions.parsed.net.port), Number(parsedMongoUri.port), 'MongoDB must use the dedicated test port.');
  const expectedDataPath = path.resolve(__dirname, '..', '..', '.local', 'mongodb-archive-acceptance', 'data');
  assert.equal(path.resolve(launchOptions.parsed.storage.dbPath), expectedDataPath, 'MongoDB data must stay in the dedicated acceptance directory.');
  try {
    const status = await mongoose.connection.db.admin().command({ serverStatus: 1 });
    mongoPid = Number.isInteger(status.pid) ? status.pid : null;
  } catch {
    // Some MongoDB configurations restrict serverStatus; the outer runner records mongod PID.
  }

  userModel = require('../models/User');
  recordModel = require('../models/GamePlayRecord');
  ({ verifyToken } = require('../middleware/authMiddleware'));
  const nonce = randomBytes(6).toString('hex');
  fixtureUsers = await userModel.create([
    { username: `archive_acceptance_a_${nonce}`, nickname: '격리 수용 시험 A', password: randomBytes(18).toString('hex') },
    { username: `archive_acceptance_b_${nonce}`, nickname: '격리 수용 시험 B', password: randomBytes(18).toString('hex') },
  ]);
  const jwt = require('jsonwebtoken');
  fixtureTokens = fixtureUsers.map((user) => jwt.sign({ id: String(user._id), tokenVersion: user.tokenVersion }, fixtureSecret));

  const express = require('express');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/game-records', verifyToken, require('../routes/gameRecords'));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  let teardownFailure = null;
  const noteTeardownFailure = (error) => {
    cleanupError = cleanupError || String(error?.message || error);
    teardownFailure = teardownFailure || error;
  };
  try {
    if (server) {
      const closed = once(server, 'close');
      server.closeAllConnections?.();
      server.close();
      await closed;
    }
  } catch (error) {
    noteTeardownFailure(error);
  }
  try {
    if (mongoose?.connection?.readyState === 1 && databaseOwned) {
      const activeDatabase = mongoose.connection.db.databaseName;
      if (!ownedDbNamePattern.test(activeDatabase) || activeDatabase !== dbName) {
        throw new Error(`Refusing to drop database outside this harness identity: ${activeDatabase}`);
      }
      await mongoose.connection.dropDatabase();
      databaseDropped = true;
    }
  } catch (error) {
    noteTeardownFailure(error);
  }
  try {
    if (mongoose?.connection?.readyState) await mongoose.disconnect();
  } catch (error) {
    noteTeardownFailure(error);
  }
  try {
    if (mongoClient) await mongoClient.close();
  } catch (error) {
    noteTeardownFailure(error);
  }
  if (priorSecret === undefined) delete process.env.MY_SECRET_KEY;
  else process.env.MY_SECRET_KEY = priorSecret;

  process.stdout.write(`MONGO_GAME_RECORD_ACCEPTANCE ${JSON.stringify({
    pass: checks.length === 5 && databaseDropped && !cleanupError,
    checks,
    database: dbName,
    databaseDropped,
    mongoVersion: serverVersion,
    mongodPid: mongoPid,
    harnessPid: process.pid,
    auth: 'actual verifyToken JWT middleware with synthetic disposable DB users; no production accounts',
    storage: 'actual GamePlayRecord Mongoose model, actual gameRecords router, real loopback MongoDB; autoIndex disabled',
    cleanupError,
  })}\n`);
  if (teardownFailure) throw teardownFailure;
});

function tokenFor(userIndex = 0) {
  return fixtureTokens[userIndex];
}

function bodyFor(runId, marker = 'original', overrides = {}) {
  return {
    title: `Archive ${marker}`,
    mode: 'survival-loop',
    result: 'clear',
    score: marker === 'original' ? 120 : 900,
    playTimeSec: 90,
    summary: { day: 12, marker },
    payload: { state: { runId, day: marker === 'original' ? 12 : 99, marker } },
    ...overrides,
  };
}

async function request(path, { userIndex = 0, method = 'POST', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game-records${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokenFor(userIndex)}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

check('unauthenticated request is rejected by actual verifyToken middleware', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game-records`);
  assert.equal(response.status, 401);
});

check('the actual route creates the real unique partial index and concurrent retries converge', async () => {
  const runId = `race-${randomBytes(8).toString('hex')}`;
  const concurrency = 10;
  const originalFindOne = recordModel.findOne;
  let gateReads = 0;
  let completedReads = 0;
  let releaseReads;
  const allRead = new Promise((resolve) => { releaseReads = resolve; });
  let readDeadline;
  const boundedReadWait = new Promise((_, reject) => {
    readDeadline = setTimeout(() => reject(new Error('Timed out waiting for all concurrent MongoDB lookups.')), 10000);
    readDeadline.unref?.();
  });

  recordModel.findOne = function gatedFindOne(...args) {
    const query = originalFindOne.apply(this, args);
    const filter = args[0] || {};
    if (filter.gameSlug !== 'primitive-archive' || !Array.isArray(filter.$or) || gateReads >= concurrency) return query;
    gateReads += 1;
    const execute = query.then.bind(query);
    query.then = (resolve, reject) => execute()
      .then(async (value) => {
        completedReads += 1;
        if (completedReads === concurrency) releaseReads();
        await Promise.race([allRead, boundedReadWait]);
        return value;
      })
      .then(resolve, reject);
    return query;
  };

  let replies;
  try {
    replies = await Promise.all(Array.from({ length: concurrency }, (_, index) => (
      request('/primitive-archive', { body: bodyFor(runId, `candidate-${index}`) })
    )));
  } finally {
    clearTimeout(readDeadline);
    recordModel.findOne = originalFindOne;
  }

  assert.equal(gateReads, concurrency, 'All concurrent initial lookups must reach MongoDB before inserts proceed.');
  assert.deepEqual(replies.map((reply) => reply.status).sort((a, b) => a - b), [...Array(concurrency - 1).fill(200), 201]);
  assert.equal(replies.filter((reply) => reply.body.replayed === false).length, 1);
  assert.equal(replies.filter((reply) => reply.body.replayed === true).length, concurrency - 1);
  assert.equal(new Set(replies.map((reply) => reply.body.record.id)).size, 1);
  assert.equal(await recordModel.countDocuments({ userId: fixtureUsers[0]._id, gameSlug: 'primitive-archive', clientRunId: runId }), 1);

  const indexes = await recordModel.collection.indexes();
  const identityIndex = indexes.find((index) => index.name === 'userId_1_gameSlug_1_clientRunId_1');
  assert.ok(identityIndex, 'The route must create the identity index in MongoDB.');
  assert.deepEqual(identityIndex.key, { userId: 1, gameSlug: 1, clientRunId: 1 });
  assert.equal(identityIndex.unique, true);
  assert.deepEqual(identityIndex.partialFilterExpression, { clientRunId: { $type: 'string', $gt: '' } });

  const firstRecord = replies.find((reply) => reply.status === 201).body.record;
  const retry = await request('/primitive-archive', {
    body: bodyFor(runId, 'changed-retry', { title: 'Changed retry title', score: 999 }),
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.replayed, true);
  assert.deepEqual(retry.body.record, firstRecord);
});

check('legacy nested run IDs are reused without rewriting the record', async () => {
  const runId = `legacy-${randomBytes(8).toString('hex')}`;
  const legacy = await recordModel.create({
    userId: fixtureUsers[0]._id,
    gameSlug: 'primitive-archive',
    title: 'Legacy terminal run',
    mode: 'survival-loop',
    result: 'clear',
    score: 33,
    summary: { marker: 'legacy' },
    payload: { state: { runId, day: 8, marker: 'legacy-snapshot' } },
  });

  const retry = await request('/primitive-archive', { body: bodyFor(runId, 'changed-legacy') });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.record.id, String(legacy._id));
  assert.equal(retry.body.record.payload.state.marker, 'legacy-snapshot');
  assert.equal(await recordModel.countDocuments({ userId: fixtureUsers[0]._id, gameSlug: 'primitive-archive' }), 2);
  const unchanged = await recordModel.findById(legacy._id).lean();
  assert.equal(unchanged.clientRunId, undefined);
  assert.equal(unchanged.title, 'Legacy terminal run');
});

check('identity is scoped by user and run ID, while manual and other-game records keep create semantics', async () => {
  const sharedRun = `shared-${randomBytes(8).toString('hex')}`;
  const sameUser = await request('/primitive-archive', { body: bodyFor(sharedRun) });
  const otherUser = await request('/primitive-archive', { userIndex: 1, body: bodyFor(sharedRun) });
  const distinctRun = await request('/primitive-archive', { body: bodyFor(`${sharedRun}-distinct`) });
  assert.equal(sameUser.status, 201);
  assert.equal(otherUser.status, 201);
  assert.equal(distinctRun.status, 201);
  assert.notEqual(sameUser.body.record.id, otherUser.body.record.id);
  assert.notEqual(sameUser.body.record.id, distinctRun.body.record.id);
  assert.notEqual(otherUser.body.record.id, distinctRun.body.record.id);

  const manual = { title: 'Manual archive entry', mode: '', payload: {} };
  const manualOne = await request('/primitive-archive', { body: manual });
  const manualTwo = await request('/primitive-archive', { body: manual });
  assert.equal(manualOne.status, 201);
  assert.equal(manualTwo.status, 201);
  assert.notEqual(manualOne.body.record.id, manualTwo.body.record.id);
  assert.equal(manualOne.body.replayed, undefined);
  assert.equal(manualTwo.body.replayed, undefined);

  const otherGameBody = bodyFor(`other-game-${randomBytes(8).toString('hex')}`);
  const otherGameOne = await request('/another-game', { body: otherGameBody });
  const otherGameTwo = await request('/another-game', { body: otherGameBody });
  assert.equal(otherGameOne.status, 201);
  assert.equal(otherGameTwo.status, 201);
  assert.equal(otherGameOne.body.replayed, undefined);
  assert.equal(otherGameTwo.body.replayed, undefined);
});

check('completed-run validation rejects malformed identity without inserting', async () => {
  const before = await recordModel.countDocuments({ userId: fixtureUsers[0]._id, gameSlug: 'primitive-archive' });
  const response = await request('/primitive-archive', {
    body: { mode: 'survival-loop', payload: { state: { runId: 'bad\nkey' } } },
  });
  assert.equal(response.status, 400);
  assert.equal(await recordModel.countDocuments({ userId: fixtureUsers[0]._id, gameSlug: 'primitive-archive' }), before);
});
