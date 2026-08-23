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

test('client-authored simulation paths cannot award persistent currency or stats', () => {
  const root = path.resolve(__dirname, '..', '..');
  const gateway = fs.readFileSync(path.join(root, 'server', 'routes', 'securityGateway.js'), 'utf8');
  const finishRuntime = fs.readFileSync(
    path.join(root, 'client', 'src', 'app', 'simulation', '_lib', 'finishGameRuntime.js'),
    'utf8',
  );
  const phaseRuntime = fs.readFileSync(
    path.join(root, 'client', 'src', 'app', 'simulation', '_lib', 'phaseFinalizationRuntime.js'),
    'utf8',
  );
  assert.match(gateway, /lpEarnedApplied:\s*0/);
  assert.match(gateway, /creditsEarnedApplied:\s*0/);
  assert.match(gateway, /trustedOutcome:\s*false/);
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
