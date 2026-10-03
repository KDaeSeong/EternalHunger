const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeUsername,
  validatePassword,
  validateUsername,
} = require('../utils/authPolicy');
const {
  generateJoinCode,
  hashJoinCode,
  verifyJoinCode,
} = require('../utils/gameRoomAccess');
const {
  buildCorsOptions,
  getHttpConfig,
  validateRuntimeEnv,
} = require('../config/runtimeConfig');

test('account input policy normalizes usernames and rejects weak credentials', () => {
  assert.equal(normalizeUsername('  Test_User  '), 'test_user');
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('valid_user-01').ok, true);
  assert.equal(validatePassword('short1!').ok, false);
  assert.equal(validatePassword('StrongPass1!').ok, true);
});

test('private-room join codes are high entropy and verified by hash', () => {
  const code = generateJoinCode();
  const hash = hashJoinCode(code);
  assert.ok(code.length >= 32);
  assert.equal(hash.length, 64);
  assert.equal(verifyJoinCode(code, hash), true);
  assert.equal(verifyJoinCode(`${code}x`, hash), false);
});

test('runtime config uses bounded defaults and rejects missing secrets', () => {
  assert.deepEqual(getHttpConfig({}), {
    port: 5000,
    jsonBodyLimit: '2mb',
    trustProxy: 0,
  });
  assert.throws(
    () => validateRuntimeEnv({ MONGO_URI: '', MY_SECRET_KEY: '' }),
    /필수 환경변수/,
  );
  assert.throws(
    () => validateRuntimeEnv({ MONGO_URI: 'mongodb://example', MY_SECRET_KEY: 'short' }),
    /32자/,
  );
});

test('credentialed CORS rejects origins outside the allowlist', async () => {
  const options = buildCorsOptions({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://games.example.com',
  });
  const allow = await new Promise((resolve, reject) => {
    options.origin('https://games.example.com', (error, value) => (
      error ? reject(error) : resolve(value)
    ));
  });
  assert.equal(allow, true);
  await assert.rejects(new Promise((resolve, reject) => {
    options.origin('https://evil.example', (error, value) => (
      error ? reject(error) : resolve(value)
    ));
  }), /허용되지 않은 Origin/);
});

test('client-authored reward paths are closed in their own routers, not by mount order', async () => {
  const root = path.resolve(__dirname, '..', '..');
  const callRoute = async (router, routePath) => {
    const layer = router.stack.find((row) => row.route?.path === routePath && row.route.methods.post);
    assert.ok(layer, `${routePath} must exist so it cannot fall through to another handler`);
    const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await layer.route.stack.at(-1).handle({ body: { amount: 100000, lpEarned: 99999 }, user: { id: 'u1' } }, res);
    return res;
  };
  assert.equal((await callRoute(require('../routes/credits'), '/earn')).code, 410);
  assert.equal((await callRoute(require('../routes/user'), '/update-stats')).code, 410);
  const serverIndex = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
  assert.doesNotMatch(serverIndex, /securityGateway/, 'no router may shadow /api/game/end by mount order');

  const gameRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'game.js'), 'utf8');
  assert.doesNotMatch(gameRoute, /body\.(lpEarned|creditsEarned|rewardLP)/, 'LP must be computed by the server');
  const finishRuntime = fs.readFileSync(
    path.join(root, 'client', 'src', 'app', 'simulation', '_lib', 'finishGameRuntime.js'),
    'utf8',
  );
  const phaseRuntime = fs.readFileSync(
    path.join(root, 'client', 'src', 'app', 'simulation', '_lib', 'phaseFinalizationRuntime.js'),
    'utf8',
  );
  assert.doesNotMatch(finishRuntime, /user\/update-stats/);
  assert.doesNotMatch(phaseRuntime, /credits\/earn/);
});

test('readiness endpoint is unavailable without a MongoDB connection', async () => {
  const { app } = require('../index');
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/public/ping`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.database, 'unavailable');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('HTTP middleware rejects oversized JSON and untrusted origins', async () => {
  const { app } = require('../index');
  const previousOrigins = process.env.CORS_ORIGINS;
  const server = app.listen(0);
  try {
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const denied = await fetch(`${base}/api/public/ping`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(denied.status, 403);

    const oversized = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'x'.repeat((2 * 1024 * 1024) + 1024) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'BODY_TOO_LARGE');
  } finally {
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
    await new Promise((resolve) => server.close(resolve));
  }
});
