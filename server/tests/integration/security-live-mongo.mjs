import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || '';
const primaryBaseUrl = String(process.env.PRIMARY_BASE_URL || 'http://127.0.0.1:5100').replace(/\/$/, '');
const secondaryBaseUrl = String(process.env.SECONDARY_BASE_URL || 'http://127.0.0.1:5101').replace(/\/$/, '');
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const password = 'Live!Security9Pass';

function databaseName(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('?')[0]);
  } catch {
    return '';
  }
}

function assertTestDatabase(uri) {
  const name = databaseName(uri);
  assert.ok(name, 'MONGO_URI must include an explicit database name');
  assert.match(name, /(test|integration|e2e)/i, 'refusing to run against a non-test database');
  return name;
}

function printable(value) {
  return JSON.stringify(value, null, 2);
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  applyCookies(headers) {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter(Boolean);
    for (const value of values) {
      for (const match of String(value).matchAll(/(?:^|,\s*)(token|eh_csrf)=([^;]*)/g)) {
        if (match[2]) this.cookies.set(match[1], match[2]);
        else this.cookies.delete(match[1]);
      }
    }
  }

  async request(baseUrl, path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && options.csrf !== false && this.cookies.has('eh_csrf')) {
      headers['X-CSRF-Token'] = this.cookies.get('eh_csrf');
    }
    if (Object.prototype.hasOwnProperty.call(options, 'body')) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: Object.prototype.hasOwnProperty.call(options, 'body') ? JSON.stringify(options.body) : undefined,
    });
    this.applyCookies(response.headers);
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    return { response, status: response.status, data, raw };
  }
}

function expectStatus(result, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    accepted.includes(result.status),
    `${label}: expected ${accepted.join('/')} but received ${result.status}\n${printable(result.data)}`,
  );
}

async function waitForReady(baseUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/public/ping`);
      if (response.status === 200) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${baseUrl} did not become ready: ${lastError?.message || 'timeout'}`);
}

async function waitForUniqueIndex(collection, expectedKeys, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const indexes = await collection.indexes().catch(() => []);
    const found = indexes.some((index) => index.unique === true
      && expectedKeys.every(([key, direction]) => index.key?.[key] === direction));
    if (found) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`unique index was not created for ${collection.collectionName}`);
}

async function signupAndLogin(baseUrl, suffix) {
  const username = `ehsec_${stamp}_${suffix}`.slice(0, 32);
  const session = new Session(suffix);
  const signup = await session.request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: {
      username,
      password,
      nickname: `보안${suffix}`,
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  expectStatus(signup, 201, `${suffix} signup`);

  const login = await session.request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  expectStatus(login, 200, `${suffix} login`);
  assert.equal(Object.prototype.hasOwnProperty.call(login.data || {}, 'token'), false, `${suffix} login leaked token in JSON`);
  assert.ok(session.cookies.get('token'), `${suffix} login did not set the session cookie`);
  assert.ok(session.cookies.get('eh_csrf'), `${suffix} login did not set the CSRF cookie`);
  return { username, session };
}

async function verifyClientRewardBoundary({ primary, secondary, db, user }) {
  const users = db.collection('users');
  const gameLogs = db.collection('gamelogs');
  const before = await users.findOne({ username: user.username });
  assert.ok(before, 'test user was not persisted');

  const reward = await user.session.request(primary, '/api/credits/earn', {
    method: 'POST',
    body: { amount: 99_999_999, reason: 'client-forged' },
  });
  expectStatus(reward, 410, 'client credit mutation');
  assert.equal(reward.data?.code, 'CLIENT_REWARD_DISABLED');

  const stats = await user.session.request(primary, '/api/user/update-stats', {
    method: 'POST',
    body: { lpEarned: 99_999_999, creditsEarned: 99_999_999, isWin: true, kills: 99_999 },
  });
  expectStatus(stats, 410, 'client stats mutation');
  assert.equal(stats.data?.code, 'CLIENT_STATS_DISABLED');

  const clientRunId = `security-live:${stamp}:same-run`;
  const body = {
    clientRunId,
    winnerId: 'hero-a',
    participants: [
      { charId: 'hero-a', name: 'Hero A', killCount: 999_999, assistCount: 999_999 },
      { charId: 'hero-b', name: 'Hero B' },
    ],
    lpEarned: 99_999_999,
    creditsEarned: 99_999_999,
    fullLogs: ['client-authored outcome'],
  };
  const writes = await Promise.all(Array.from({ length: 12 }, (_, index) => (
    user.session.request(index % 2 === 0 ? primary : secondary, '/api/game/end', { method: 'POST', body })
  )));
  assert.equal(writes.filter((result) => result.status === 201).length, 1, 'exactly one request must create the game log');
  assert.equal(writes.filter((result) => result.status === 200).length, 11, 'duplicate requests must be idempotent');
  assert.ok(writes.every((result) => result.data?.trustedOutcome === false), 'client outcomes must remain untrusted');
  assert.ok(writes.every((result) => result.data?.rewardStatus === 'unverified'), 'client outcomes must remain unverified');
  assert.ok(writes.every((result) => result.data?.lpEarnedApplied === 0 && result.data?.creditsEarnedApplied === 0), 'no client reward may be applied');

  const stored = await gameLogs.find({ userId: before._id, clientRunId }).toArray();
  assert.equal(stored.length, 1, 'parallel duplicate runs created more than one game log');
  assert.equal(stored[0].trustedOutcome, false);
  assert.equal(stored[0].rewardStatus, 'unverified');
  const after = await users.findOne({ _id: before._id });
  assert.equal(Number(after.lp || 0), Number(before.lp || 0), 'LP changed from an untrusted client request');
  assert.equal(Number(after.credits || 0), Number(before.credits || 0), 'credits changed from an untrusted client request');
  assert.deepEqual(after.statistics, before.statistics, 'statistics changed from an untrusted client request');
  console.log('PASS DEF-001 client reward boundary and parallel idempotency');
}

async function verifyPrivateRoomAndRevision({ primary, secondary, db, host, guest }) {
  const create = await host.session.request(primary, '/api/game-rooms', {
    method: 'POST',
    body: {
      gameSlug: 'security-integration',
      title: 'Private integration room',
      visibility: 'private',
      maxPlayers: 4,
      state: { turn: 0, writer: 'initial' },
    },
  });
  expectStatus(create, 201, 'private room create');
  const roomId = create.data?.room?.id;
  const joinCode = create.data?.joinCode;
  assert.match(String(roomId || ''), /^[a-f\d]{24}$/i, 'private room id is missing');
  assert.match(String(joinCode || ''), /^[A-Za-z0-9_-]{32}$/, 'private join code is not 192-bit base64url');
  assert.equal(JSON.stringify(create.data).includes('joinCodeHash'), false, 'private room hash leaked from API');

  const hidden = await guest.session.request(secondary, `/api/game-rooms/${roomId}`);
  expectStatus(hidden, 404, 'private room lookup without invite');
  const invited = await guest.session.request(secondary, `/api/game-rooms/${roomId}?joinCode=${encodeURIComponent(joinCode)}`);
  expectStatus(invited, 200, 'private room lookup with invite');
  assert.equal(invited.data?.room?.inviteAuthorized, true);
  assert.equal(Object.prototype.hasOwnProperty.call(invited.data?.room || {}, 'state'), false, 'invite lookup leaked room state before join');

  const missingJoin = await guest.session.request(secondary, `/api/game-rooms/${roomId}/join`, {
    method: 'POST', body: {},
  });
  expectStatus(missingJoin, 403, 'private room join without invite');
  assert.equal(missingJoin.data?.code, 'ROOM_INVITE_REQUIRED');
  const wrongJoin = await guest.session.request(secondary, `/api/game-rooms/${roomId}/join`, {
    method: 'POST', body: { joinCode: `${joinCode}x` },
  });
  expectStatus(wrongJoin, 403, 'private room join with wrong invite');

  const joined = await guest.session.request(secondary, `/api/game-rooms/${roomId}/join`, {
    method: 'POST', body: { joinCode },
  });
  expectStatus(joined, 200, 'private room join with invite');
  assert.equal(joined.data?.room?.isParticipant, true);
  const memberView = await guest.session.request(secondary, `/api/game-rooms/${roomId}`);
  expectStatus(memberView, 200, 'private member lookup');
  assert.deepEqual(memberView.data?.room?.state, { turn: 0, writer: 'initial' });

  const rawRoom = await db.collection('gamerooms').findOne({ _id: new mongoose.Types.ObjectId(roomId) });
  assert.match(String(rawRoom?.joinCodeHash || ''), /^[a-f\d]{64}$/i, 'join code was not stored as a SHA-256 hash');
  assert.notEqual(rawRoom.joinCodeHash, joinCode, 'raw join code was stored in MongoDB');

  const revision = Number(memberView.data?.room?.revision);
  const updates = await Promise.all([
    host.session.request(primary, `/api/game-rooms/${roomId}/state`, {
      method: 'POST', body: { revision, state: { turn: 1, writer: 'host-primary' } },
    }),
    guest.session.request(secondary, `/api/game-rooms/${roomId}/state`, {
      method: 'POST', body: { revision, state: { turn: 1, writer: 'guest-secondary' } },
    }),
  ]);
  assert.equal(updates.filter((result) => result.status === 200).length, 1, 'exactly one revision update must succeed');
  assert.equal(updates.filter((result) => result.status === 409).length, 1, 'stale revision update must conflict');
  const success = updates.find((result) => result.status === 200);
  const conflict = updates.find((result) => result.status === 409);
  assert.equal(success.data?.room?.revision, revision + 1);
  assert.equal(conflict.data?.code, 'ROOM_REVISION_CONFLICT');
  assert.equal(conflict.data?.room?.revision, revision + 1);

  const storedRoom = await db.collection('gamerooms').findOne({ _id: rawRoom._id });
  assert.equal(storedRoom.revision, revision + 1, 'room revision incremented more than once');
  assert.deepEqual(storedRoom.state, success.data.room.state, 'stored room state does not match the winning update');
  console.log('PASS DEF-005 private room invite boundary');
  console.log('PASS DEF-006 cross-instance atomic room revision');
}

async function verifySharedRateLimit({ primary, secondary, db }) {
  const username = `missing_${stamp}`.slice(0, 32);
  const attempts = [];
  for (const baseUrl of [primary, secondary, primary]) {
    const anonymous = new Session('rate-limit');
    attempts.push(await anonymous.request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username, password: 'Wrong!Password8' },
    }));
  }
  assert.deepEqual(attempts.map((result) => result.status), [401, 401, 429], 'login rate limit was not shared across instances');
  assert.equal(attempts[2].data?.code, 'RATE_LIMITED');
  const bucket = await db.collection('ratelimitbuckets').findOne({ scope: 'auth:login', count: { $gte: 3 } });
  assert.ok(bucket, 'shared MongoDB rate-limit bucket was not persisted');
  assert.equal(bucket.count, 3, 'shared rate-limit count is not atomic');
  console.log('PASS DEF-007 shared MongoDB rate limit across two instances');
}

async function main() {
  assert.ok(mongoUri, 'MONGO_URI is required');
  const dbName = assertTestDatabase(mongoUri);
  await Promise.all([waitForReady(primaryBaseUrl), waitForReady(secondaryBaseUrl)]);
  const connection = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 10_000 }).asPromise();
  const db = connection.db;
  let completed = false;
  try {
    await Promise.all([
      waitForUniqueIndex(db.collection('gamelogs'), [['userId', 1], ['clientRunId', 1]]),
      waitForUniqueIndex(db.collection('ratelimitbuckets'), [['key', 1]]),
    ]);
    const host = await signupAndLogin(primaryBaseUrl, 'host');
    const guest = await signupAndLogin(secondaryBaseUrl, 'guest');
    await verifyClientRewardBoundary({ primary: primaryBaseUrl, secondary: secondaryBaseUrl, db, user: host });
    await verifyPrivateRoomAndRevision({ primary: primaryBaseUrl, secondary: secondaryBaseUrl, db, host, guest });
    await verifySharedRateLimit({ primary: primaryBaseUrl, secondary: secondaryBaseUrl, db });
    completed = true;
    console.log(`PASS live security integration on ${dbName}`);
  } finally {
    if (process.env.KEEP_SECURITY_TEST_DB !== '1') {
      await connection.dropDatabase();
      console.log(`CLEAN dropped isolated test database ${dbName}`);
    }
    await connection.close();
  }
  assert.equal(completed, true);
}

main().catch((error) => {
  console.error('FAIL live security integration');
  console.error(error?.stack || error);
  process.exitCode = 1;
});
