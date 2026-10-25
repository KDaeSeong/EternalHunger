const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { after, before, test } = require('node:test');

// Opt-in integration acceptance test. It is safe only against the disposable,
// loopback MongoDB launched for this test; never point it at a configured app DB.
const mongoUri = process.env.EH_TEST_MONGO_URI || '';
const mongoUrl = (() => {
  try { return new URL(mongoUri); } catch { return null; }
})();
const ownedDbNamePattern = /^eh_save_slots_acceptance_\d+_\d+_[a-f0-9]{10}$/;
const dbName = `eh_save_slots_acceptance_${process.pid}_${Date.now()}_${randomBytes(5).toString('hex')}`;
const FIXTURE_COUNT = 10;
const completedChecks = [];

let mongoose;
let mongoClient;
let User;
let GameSaveSlot;
let secret = '';
let priorSecret;
let server;
let serverPort = 0;
let workerServers = [];
let fixtureUsers = {};
let tokens = {};
let databaseOwned = false;
let databaseDropped = false;
let mongoVersion = '';
let mongoPid = null;
let cleanupError = '';

function assertSafeMongoUri() {
  assert.ok(
    mongoUrl
      && mongoUrl.protocol === 'mongodb:'
      && mongoUrl.hostname === '127.0.0.1'
      && Number.isInteger(Number(mongoUrl.port))
      && Number(mongoUrl.port) > 0
      && mongoUrl.pathname === '/'
      && !mongoUrl.username
      && !mongoUrl.password
      && !mongoUrl.search
      && !mongoUrl.hash,
    'EH_TEST_MONGO_URI must be exactly mongodb://127.0.0.1:PORT/ with no credentials, database, or options.',
  );
}

function appFor(express, verifyToken) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/game-saves', verifyToken, require('../routes/gameSaves'));
  return app;
}

function workerEnvironment(userId, workerSecret) {
  const inherited = process.env;
  return {
    PATH: inherited.PATH || '',
    SystemRoot: inherited.SystemRoot || '',
    WINDIR: inherited.WINDIR || '',
    TEMP: inherited.TEMP || '',
    TMP: inherited.TMP || '',
    EH_TEST_MONGO_URI: mongoUri,
    EH_TEST_DB_NAME: dbName,
    EH_TEST_USER_ID: String(userId),
    EH_TEST_SECRET: workerSecret,
    GAME_SAVE_MAX_BYTES: '1048576',
    GAME_SAVE_MAX_SLOTS_PER_GAME: '20',
  };
}

function waitForWorkerReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A game-save worker did not become ready in time.')), 15000);
    timer.unref?.();
    const onMessage = (message) => {
      if (message?.type === 'ready') {
        clearTimeout(timer);
        cleanup();
        resolve({ port: message.port, pid: message.pid });
      } else if (message?.type === 'startup-error') {
        clearTimeout(timer);
        cleanup();
        reject(new Error(`Game-save worker startup failed: ${String(message.message || 'unknown error')}`));
      }
    };
    const onExit = (code) => {
      clearTimeout(timer);
      cleanup();
      reject(new Error(`Game-save worker exited before ready (code ${code}).`));
    };
    const onError = (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    child.on('message', onMessage);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

async function startWorker(userId, workerSecret) {
  const child = fork(__filename, ['--worker'], {
    env: workerEnvironment(userId, workerSecret),
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
  });
  workerServers.push({ child, port: 0, pid: 0 });
  try {
    const ready = await waitForWorkerReady(child);
    const worker = workerServers[workerServers.length - 1];
    worker.port = ready.port;
    worker.pid = ready.pid;
    return worker;
  } catch (error) {
    child.kill();
    throw error;
  }
}

function createToken(user, tokenId) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({
    id: String(user._id),
    tokenVersion: Number(user.tokenVersion || 0),
    jti: tokenId,
  }, secret);
}

function makeSaveBody(marker, overrides = {}) {
  return {
    saveName: `통합검사 ${marker}`,
    version: 'fixture-v1',
    summary: { marker },
    payload: { fixture: true, marker },
    ...overrides,
  };
}

async function httpRequest(port, route, { token, method = 'GET', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let responseBody = null;
  try { responseBody = await response.json(); } catch { /* retain status for non-JSON errors */ }
  return { status: response.status, body: responseBody };
}

function requestMain(route, options = {}) {
  return httpRequest(serverPort, route, { token: options.token || tokens.primary, ...options });
}

function requestWorker(worker, route, options = {}) {
  return httpRequest(worker.port, route, { token: options.token || worker.token || tokens.primary, ...options });
}

function savePath(gameSlug, slotKey) {
  return `/game-saves/${encodeURIComponent(gameSlug)}/${encodeURIComponent(slotKey)}`;
}

async function saveThrough(port, token, gameSlug, slotKey, marker) {
  return httpRequest(port, savePath(gameSlug, slotKey), {
    method: 'PUT',
    token,
    body: makeSaveBody(marker),
  });
}

async function seedSlots(userId, gameSlug, count, prefix = 'seed') {
  const now = new Date();
  const rows = Array.from({ length: count }, (_, index) => {
    const payload = { seeded: true, index };
    return {
      userId,
      gameSlug,
      slotKey: `${prefix}-${String(index).padStart(2, '0')}`,
      saveName: `기존 슬롯 ${index}`,
      version: 'legacy-fixture',
      summary: { index },
      payload,
      payloadBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'),
      createdAt: now,
      updatedAt: now,
    };
  });
  if (rows.length) await GameSaveSlot.insertMany(rows);
  return rows;
}

async function slotCount(userId, gameSlug) {
  return GameSaveSlot.countDocuments({ userId, gameSlug });
}

async function readMutationVersion(userId) {
  const user = await User.findById(userId).select('+gameSaveMutationVersion').lean();
  assert.ok(user, 'The synthetic test user must still exist.');
  return Number(user.gameSaveMutationVersion || 0);
}

async function setFailCommand({ errorCode, errorLabels = [] }, action) {
  const admin = mongoose.connection.db.admin();
  await admin.command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: {
      failCommands: ['findAndModify'],
      errorCode,
      ...(errorLabels.length ? { errorLabels } : {}),
    },
  });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await action();
  } finally {
    console.error = originalConsoleError;
    await admin.command({ configureFailPoint: 'failCommand', mode: 'off' });
  }
}

function acceptance(name, action) {
  test(name, async () => {
    await action();
    completedChecks.push(name);
  });
}

async function bootWorker() {
  try {
    assertSafeMongoUri();
    const workerDbName = String(process.env.EH_TEST_DB_NAME || '');
    assert.ok(ownedDbNamePattern.test(workerDbName), 'Worker DB name must be a generated harness-owned database.');
    const workerSecret = String(process.env.EH_TEST_SECRET || '');
    assert.ok(workerSecret.length >= 32, 'Worker must receive only a synthetic test signing secret.');
    process.env.MY_SECRET_KEY = workerSecret;
    process.env.GAME_SAVE_MAX_BYTES = '1048576';
    process.env.GAME_SAVE_MAX_SLOTS_PER_GAME = '20';

    const workerMongoose = require('mongoose');
    workerMongoose.set('autoIndex', false);
    await workerMongoose.connect(mongoUri, {
      dbName: workerDbName,
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    });
    const express = require('express');
    const { verifyToken } = require('../middleware/authMiddleware');
    const app = appFor(express, verifyToken);
    const workerServer = app.listen(0, '127.0.0.1');
    await once(workerServer, 'listening');
    process.on('message', async (message) => {
      if (message?.type !== 'close') return;
      workerServer.closeAllConnections?.();
      await new Promise((resolve) => workerServer.close(resolve));
      await workerMongoose.disconnect();
      if (process.connected) process.send({ type: 'closed' });
      process.disconnect?.();
    });
    process.send({ type: 'ready', port: workerServer.address().port, pid: process.pid });
  } catch (error) {
    if (process.connected) process.send({ type: 'startup-error', message: String(error?.message || error) });
    process.exitCode = 1;
  }
}

if (process.argv.includes('--worker')) {
  void bootWorker();
} else {
  assertSafeMongoUri();
  assert.ok(ownedDbNamePattern.test(dbName), 'Generated database name is outside the harness-owned namespace.');

  before(async () => {
    priorSecret = process.env.MY_SECRET_KEY;
    secret = randomBytes(32).toString('hex');
    process.env.MY_SECRET_KEY = secret;
    process.env.GAME_SAVE_MAX_BYTES = '1048576';
    process.env.GAME_SAVE_MAX_SLOTS_PER_GAME = '20';

    mongoose = require('mongoose');
    mongoose.set('autoIndex', false);
    mongoClient = new mongoose.mongo.MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    const existingDatabases = await mongoClient.db('admin').admin().listDatabases({ nameOnly: true });
    assert.equal(existingDatabases.databases.some((entry) => entry.name === dbName), false, 'Generated acceptance DB already exists.');

    await mongoose.connect(mongoUri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    const existingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    assert.deepEqual(existingCollections, [], 'The generated acceptance database must be empty before setup.');

    const admin = mongoose.connection.db.admin();
    const buildInfo = await admin.command({ buildInfo: 1 });
    mongoVersion = String(buildInfo.version || 'unknown');
    const cmdLine = await admin.command({ getCmdLineOpts: 1 });
    const parsed = cmdLine.parsed || {};
    const bindIp = parsed.net?.bindIp;
    const bindAddresses = Array.isArray(bindIp) ? bindIp.map(String) : [String(bindIp || '')];
    assert.deepEqual(bindAddresses, ['127.0.0.1'], 'MongoDB must bind only to 127.0.0.1.');
    assert.equal(Number(parsed.net?.port), Number(mongoUrl.port), 'MongoDB must use the URI loopback port.');
    const expectedDataPath = path.resolve(__dirname, '..', '..', '.local', 'mongodb-save-slots-acceptance', 'data');
    assert.equal(path.resolve(parsed.storage?.dbPath || ''), expectedDataPath, 'MongoDB dbPath must be the dedicated acceptance workspace directory.');
    assert.equal(parsed.replication?.replSet ?? parsed.replication?.replSetName, 'eh_save_slots_fixture', 'MongoDB must be the dedicated eh_save_slots_fixture replica set.');
    assert.equal(Number(parsed.setParameter?.enableTestCommands), 1, 'MongoDB must explicitly enable test commands for isolated failCommand checks.');
    const hello = await admin.command({ hello: 1 });
    assert.equal(hello.setName, 'eh_save_slots_fixture');
    assert.equal(hello.isWritablePrimary, true, 'The isolated replica-set node must be primary for transactions.');
    // Only claim teardown ownership after the empty database and exact server
    // identity (loopback bind, port, dbPath, replica set, and primary) are proven.
    databaseOwned = true;
    try {
      mongoPid = Number((await admin.command({ serverStatus: 1 })).pid) || null;
    } catch {
      // PID is supplementary evidence; URI and getCmdLineOpts remain mandatory.
    }

    User = require('../models/User');
    GameSaveSlot = require('../models/GameSaveSlot');
    await GameSaveSlot.createIndexes();
    const indexes = await GameSaveSlot.collection.indexes();
    const ownerSlotUnique = indexes.find((index) => (
      index.key?.userId === 1 && index.key?.gameSlug === 1 && index.key?.slotKey === 1
    ));
    assert.ok(ownerSlotUnique, 'The actual GameSaveSlot collection must contain the owner/game/key index.');
    assert.equal(ownerSlotUnique.unique, true, 'Owner/game/key must be unique in the actual database.');

    const nonce = randomBytes(9).toString('hex');
    const userNames = ['primary', 'race18', 'samekey', 'legacy', 'createDelete', 'isolation', 'rollback', 'transient'];
    const createdUsers = await User.create(userNames.map((name) => ({
      username: `save_slots_${name}_${nonce}`,
      nickname: `슬롯시험 ${name}`,
      password: randomBytes(20).toString('hex'),
    })));
    fixtureUsers = Object.fromEntries(userNames.map((name, index) => [name, createdUsers[index]]));
    const jwt = require('jsonwebtoken');
    tokens = Object.fromEntries(userNames.map((name) => [name, createToken(fixtureUsers[name], `main-${name}-${randomBytes(8).toString('hex')}`)]));

    const express = require('express');
    const { verifyToken } = require('../middleware/authMiddleware');
    server = appFor(express, verifyToken).listen(0, '127.0.0.1');
    await once(server, 'listening');
    serverPort = server.address().port;

    // Two independent server processes use separate Node runtimes, Mongo connections,
    // HTTP sockets, and synthetic JWT session IDs while targeting the same DB/user.
    const workerTokens = [0, 1].map(() => jwt.sign({
      id: String(fixtureUsers.primary._id),
      tokenVersion: Number(fixtureUsers.primary.tokenVersion || 0),
      jti: `worker-${randomBytes(10).toString('hex')}`,
    }, secret));
    workerServers = [];
    await startWorker(fixtureUsers.primary._id, secret);
    await startWorker(fixtureUsers.primary._id, secret);
    workerServers[0].token = workerTokens[0];
    workerServers[1].token = workerTokens[1];
  });

  after(async () => {
    let teardownFailure = null;
    const noteCleanupError = (error) => {
      cleanupError = cleanupError || String(error?.message || error);
      teardownFailure = teardownFailure || error;
    };
    for (const worker of workerServers) {
      try {
        if (!worker.child.connected || worker.child.exitCode !== null) continue;
        const exited = once(worker.child, 'exit');
        const closed = new Promise((resolve) => {
          const timer = setTimeout(resolve, 10000);
          timer.unref?.();
          const onMessage = (message) => {
            if (message?.type !== 'closed') return;
            clearTimeout(timer);
            worker.child.off('message', onMessage);
            resolve();
          };
          worker.child.on('message', onMessage);
        });
        worker.child.send({ type: 'close' });
        await closed;
        if (worker.child.exitCode === null) {
          const timer = setTimeout(() => worker.child.kill(), 3000);
          timer.unref?.();
          await exited;
          clearTimeout(timer);
        }
      } catch (error) {
        worker.child.kill();
        noteCleanupError(error);
      }
    }
    try {
      if (server) {
        server.closeAllConnections?.();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    } catch (error) {
      noteCleanupError(error);
    }
    try {
      if (mongoose?.connection?.readyState === 1 && databaseOwned) {
        const activeDatabase = mongoose.connection.db.databaseName;
        if (!ownedDbNamePattern.test(activeDatabase) || activeDatabase !== dbName) {
          throw new Error(`Refusing to drop a database outside this harness identity: ${activeDatabase}`);
        }
        await mongoose.connection.dropDatabase();
        databaseDropped = true;
      }
    } catch (error) {
      noteCleanupError(error);
    }
    try {
      if (mongoose?.connection?.readyState) await mongoose.disconnect();
    } catch (error) {
      noteCleanupError(error);
    }
    try {
      if (mongoClient) await mongoClient.close();
    } catch (error) {
      noteCleanupError(error);
    }
    if (priorSecret === undefined) delete process.env.MY_SECRET_KEY;
    else process.env.MY_SECRET_KEY = priorSecret;

    process.stdout.write(`MONGO_GAME_SAVE_SLOTS_ACCEPTANCE ${JSON.stringify({
      pass: completedChecks.length === FIXTURE_COUNT && databaseDropped && !cleanupError,
      checks: completedChecks,
      databaseDropped,
      mongoVersion,
      mongodPid: mongoPid,
      harnessPid: process.pid,
      workers: workerServers.map((worker) => worker.pid).filter(Boolean),
      cleanupError,
      secrets: 'synthetic tokens, nonce, and private marker values omitted',
    })}\n`);
    if (teardownFailure) throw teardownFailure;
  });

  acceptance('actual indexes, verifyToken session, default User reads, and slot HTTP responses hide the private mutation marker', async () => {
    const userId = fixtureUsers.primary._id;
    const start = await readMutationVersion(userId);
    const create = await requestMain(savePath('private-check', 'slot-a'), {
      method: 'PUT',
      body: makeSaveBody('private-check'),
    });
    assert.equal(create.status, 200);
    const markerAfter = await readMutationVersion(userId);
    assert.equal(markerAfter, start + 1, 'One successful new-slot mutation must increment the private marker once.');

    const defaultUser = await User.findById(userId).lean();
    assert.ok(defaultUser);
    assert.equal(Object.hasOwn(defaultUser, 'gameSaveMutationVersion'), false, 'Default User reads must honor select:false.');
    const session = await requestMain('/auth/session');
    assert.equal(session.status, 200);
    assert.equal(Object.hasOwn(session.body.user, 'gameSaveMutationVersion'), false, 'The actual auth-session response must not expose the private marker.');

    const listed = await requestMain('/game-saves?gameSlug=private-check');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.saves.length, 1);
    assert.equal(Object.hasOwn(listed.body.saves[0], 'payload'), false, 'Slot list responses must remain payload-free.');
    const detail = await requestMain(`/game-saves/${create.body.save.id}`);
    assert.equal(detail.status, 200);
    const visibleJson = JSON.stringify([create.body, listed.body, detail.body, session.body]);
    assert.equal(visibleJson.includes('gameSaveMutationVersion'), false, 'No HTTP response may expose the private marker field.');
  });

  acceptance('19 existing slots raced through two independent HTTP servers allow exactly one creation', async () => {
    const userId = fixtureUsers.primary._id;
    const gameSlug = 'nineteen-race';
    await seedSlots(userId, gameSlug, 19, 'at-cap');
    const beforeVersion = await readMutationVersion(userId);
    const responses = await Promise.all([
      requestWorker(workerServers[0], savePath(gameSlug, 'concurrent-a'), { method: 'PUT', body: makeSaveBody('race-a') }),
      requestWorker(workerServers[1], savePath(gameSlug, 'concurrent-b'), { method: 'PUT', body: makeSaveBody('race-b') }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [200, 400]);
    assert.equal(await slotCount(userId, gameSlug), 20, 'The shared account/game quota must stop at exactly 20.');
    assert.equal(await readMutationVersion(userId), beforeVersion + 1, 'Only the committed slot mutation may advance the marker.');
  });

  acceptance('18 existing slots plus many simultaneous distinct creates finish at exactly 20', async () => {
    const userId = fixtureUsers.race18._id;
    const gameSlug = 'eighteen-race';
    await seedSlots(userId, gameSlug, 18, 'at-cap');
    const token = tokens.race18;
    const concurrency = 24;
    const responses = await Promise.all(Array.from({ length: concurrency }, (_, index) => {
      const worker = workerServers[index % workerServers.length];
      const workerToken = createTokenForWorker(fixtureUsers.race18, `race18-${index}`);
      return requestWorker(worker, savePath(gameSlug, `new-${index}`), {
        token: workerToken,
        method: 'PUT',
        body: makeSaveBody(`eighteen-${index}`),
      });
    }));
    assert.equal(responses.filter((response) => response.status === 200).length, 2);
    assert.equal(responses.filter((response) => response.status === 400).length, concurrency - 2);
    assert.equal(await slotCount(userId, gameSlug), 20);
    assert.ok(token, 'The fixture account token exists for isolated quota traffic.');
  });

  acceptance('same-key concurrent updates all succeed and converge on one stable slot identity', async () => {
    const userId = fixtureUsers.samekey._id;
    const gameSlug = 'same-key-race';
    const concurrency = 20;
    const responses = await Promise.all(Array.from({ length: concurrency }, (_, index) => {
      const worker = workerServers[index % workerServers.length];
      const token = createTokenForWorker(fixtureUsers.samekey, `samekey-${index}`);
      return requestWorker(worker, savePath(gameSlug, 'single-slot'), {
        token,
        method: 'PUT',
        body: makeSaveBody(`same-${index}`),
      });
    }));
    assert.ok(responses.every((response) => response.status === 200), 'Idempotent same-key writes must resolve successfully.');
    const ids = responses.map((response) => response.body?.save?.id);
    assert.ok(ids.every(Boolean));
    assert.equal(new Set(ids).size, 1, 'Every writer must receive the same persisted slot ID.');
    assert.equal(await slotCount(userId, gameSlug), 1);
    const stored = await GameSaveSlot.findOne({ userId, gameSlug, slotKey: 'single-slot' }).lean();
    assert.ok(responses.some((response) => response.body.save.payload.marker === stored.payload.marker));
  });

  acceptance('a full game still permits an existing-slot update, then delete frees one slot for retry', async () => {
    const userId = fixtureUsers.primary._id;
    const gameSlug = 'nineteen-race';
    const existing = await GameSaveSlot.findOne({ userId, gameSlug, slotKey: 'at-cap-00' }).lean();
    assert.ok(existing);
    const update = await requestMain(savePath(gameSlug, existing.slotKey), {
      method: 'PUT',
      body: makeSaveBody('full-update'),
    });
    assert.equal(update.status, 200, 'Existing data can be updated when a game has 20 slots.');
    assert.equal(update.body.save.id, String(existing._id));
    assert.equal(update.body.save.payload.marker, 'full-update');

    const deleted = await requestMain(`/game-saves/${existing._id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.equal(await slotCount(userId, gameSlug), 19);
    const retried = await requestMain(savePath(gameSlug, 'after-delete'), {
      method: 'PUT',
      body: makeSaveBody('after-delete'),
    });
    assert.equal(retried.status, 200);
    assert.equal(await slotCount(userId, gameSlug), 20);
  });

  acceptance('21 legacy slots remain readable, allow update/delete, block new slots, and initialize a missing marker once', async () => {
    const user = fixtureUsers.legacy;
    const userId = user._id;
    const gameSlug = 'legacy-over-cap';
    await seedSlots(userId, gameSlug, 21, 'legacy');
    await User.collection.updateOne({ _id: userId }, { $unset: { gameSaveMutationVersion: '' } });
    assert.equal(Object.hasOwn(await User.collection.findOne({ _id: userId }), 'gameSaveMutationVersion'), false);

    const beforeIds = await GameSaveSlot.find({ userId, gameSlug }).distinct('_id');
    const update = await requestMain(savePath(gameSlug, 'legacy-00'), {
      token: tokens.legacy,
      method: 'PUT',
      body: makeSaveBody('legacy-updated'),
    });
    assert.equal(update.status, 200);
    assert.ok(beforeIds.some((id) => String(id) === update.body.save.id));
    assert.equal(await slotCount(userId, gameSlug), 21, 'Updating an over-cap legacy save must preserve its row count.');
    assert.equal(await readMutationVersion(userId), 1, 'The first successful legacy mutation must create marker version 1.');

    const victim = await GameSaveSlot.findOne({ userId, gameSlug, slotKey: 'legacy-20' }).lean();
    const deleted = await requestMain(`/game-saves/${victim._id}`, { token: tokens.legacy, method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.equal(await slotCount(userId, gameSlug), 20);
    const blocked = await requestMain(savePath(gameSlug, 'legacy-new'), {
      token: tokens.legacy,
      method: 'PUT',
      body: makeSaveBody('legacy-new'),
    });
    assert.equal(blocked.status, 400);
    assert.equal(await slotCount(userId, gameSlug), 20);
    const remaining = await GameSaveSlot.find({ userId, gameSlug }).distinct('_id');
    assert.equal(remaining.length, 20);
    assert.ok(beforeIds.filter((id) => String(id) !== String(victim._id)).every((id) => remaining.some((rowId) => String(rowId) === String(id))));
  });

  acceptance('a concurrent create and delete stays within the quota and allows either serial order', async () => {
    const userId = fixtureUsers.createDelete._id;
    const gameSlug = 'create-delete-race';
    await seedSlots(userId, gameSlug, 20, 'full');
    const victim = await GameSaveSlot.findOne({ userId, gameSlug, slotKey: 'full-00' }).lean();
    const [create, deletion] = await Promise.all([
      requestWorker(workerServers[0], savePath(gameSlug, 'race-new'), {
        token: tokens.createDelete,
        method: 'PUT',
        body: makeSaveBody('create-delete-race'),
      }),
      requestWorker(workerServers[1], `/game-saves/${victim._id}`, {
        token: tokens.createDelete,
        method: 'DELETE',
      }),
    ]);
    assert.equal(deletion.status, 200);
    assert.ok([200, 400].includes(create.status), 'Create may commit before or after the concurrent delete.');
    const finalCount = await slotCount(userId, gameSlug);
    assert.ok(finalCount === 19 || finalCount === 20, `Final slot count must respect the 20-slot cap, got ${finalCount}.`);
    assert.equal(create.status === 200, finalCount === 20, 'Create outcome must agree with the final slot count.');
  });

  acceptance('quota and slot visibility are isolated by account and game, with owner-scoped detail reads', async () => {
    const ownerId = fixtureUsers.primary._id;
    const otherId = fixtureUsers.isolation._id;
    const gameSlug = 'isolation-game';
    await seedSlots(ownerId, gameSlug, 20, 'owner');
    const otherGame = await requestMain(savePath('different-game', 'one'), {
      method: 'PUT',
      body: makeSaveBody('different-game'),
    });
    assert.equal(otherGame.status, 200, 'A different game receives its own 20-slot allowance.');
    const otherAccount = await requestMain(savePath(gameSlug, 'other-account'), {
      token: tokens.isolation,
      method: 'PUT',
      body: makeSaveBody('other-account'),
    });
    assert.equal(otherAccount.status, 200, 'A different account receives an independent allowance.');
    assert.equal(await slotCount(ownerId, gameSlug), 20);
    assert.equal(await slotCount(ownerId, 'different-game'), 1);
    assert.equal(await slotCount(otherId, gameSlug), 1);
    const ownerCannotReadOther = await requestMain(`/game-saves/${otherAccount.body.save.id}`);
    assert.equal(ownerCannotReadOther.status, 404);
    const list = await requestMain('/game-saves?gameSlug=isolation-game');
    assert.equal(list.status, 200);
    assert.equal(list.body.saves.length, 20);
    assert.ok(list.body.saves.every((slot) => slot.gameSlug === gameSlug));
  });

  acceptance('a non-transient MongoDB write error rolls back slot and marker, and a retry commits once', async () => {
    const userId = fixtureUsers.rollback._id;
    const gameSlug = 'rollback-error';
    const beforeCount = await slotCount(userId, gameSlug);
    const beforeVersion = await readMutationVersion(userId);
    const response = await setFailCommand({ errorCode: 121 }, () => requestMain(savePath(gameSlug, 'retryable'), {
      token: tokens.rollback,
      method: 'PUT',
      body: makeSaveBody('rollback-attempt'),
    }));
    assert.equal(response.status, 500);
    assert.equal(await slotCount(userId, gameSlug), beforeCount, 'A failed transactional mutation must leave no slot.');
    assert.equal(await readMutationVersion(userId), beforeVersion, 'The private marker must roll back with the failed slot mutation.');
    const retry = await requestMain(savePath(gameSlug, 'retryable'), {
      token: tokens.rollback,
      method: 'PUT',
      body: makeSaveBody('rollback-retry'),
    });
    assert.equal(retry.status, 200);
    assert.equal(await slotCount(userId, gameSlug), 1);
    assert.equal(await readMutationVersion(userId), beforeVersion + 1);
  });

  acceptance('a transient transaction error is retried to one committed slot and one marker increment', async () => {
    const userId = fixtureUsers.transient._id;
    const gameSlug = 'transient-retry';
    const beforeVersion = await readMutationVersion(userId);
    const response = await setFailCommand({ errorCode: 112, errorLabels: ['TransientTransactionError'] }, () => requestMain(savePath(gameSlug, 'retryable'), {
      token: tokens.transient,
      method: 'PUT',
      body: makeSaveBody('transient-retry'),
    }));
    assert.equal(response.status, 200);
    assert.equal(await slotCount(userId, gameSlug), 1);
    assert.equal(await readMutationVersion(userId), beforeVersion + 1, 'A retried transaction must commit exactly one mutation marker increment.');
  });
}

function createTokenForWorker(user, jti) {
  return require('jsonwebtoken').sign({
    id: String(user._id),
    tokenVersion: Number(user.tokenVersion || 0),
    jti,
  }, secret);
}
