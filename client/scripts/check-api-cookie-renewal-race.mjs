import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import axios from 'axios';

const apiUrl = new URL('../src/utils/api.js', import.meta.url);
const authUrl = new URL('../src/utils/auth-session.js', import.meta.url);
// Resolve the actual extensionless local import; never replace product source.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === apiUrl.href && specifier === './auth-session') {
      return { url: authUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const ownerA = Object.freeze({ id: '111111111111111111111111', username: 'synthetic-owner-a' });
const ownerB = Object.freeze({ id: '222222222222222222222222', username: 'synthetic-owner-b' });
const originals = Object.fromEntries(['window', 'document', 'fetch', 'CustomEvent'].map(name => [name,
  Object.getOwnPropertyDescriptor(globalThis, name)]));
const originalAdapter = axios.defaults.adapter;
const originalApiBase = process.env.NEXT_PUBLIC_API_BASE;
const sourceHash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const inputHashes = { api: sourceHash(apiUrl), auth: sourceHash(authUrl) };
let activeEnv;
let api;
let auth;
let adapterCalls = 0;
let syntheticLogoutCalls = 0;
const results = [];

function installMemoryBrowser() {
  const env = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage(),
    events: [], logouts: [], requests: [], requestReady: deferred() };
  globalThis.CustomEvent = class {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };
  globalThis.window = {
    localStorage: env.localStorage, sessionStorage: env.sessionStorage,
    location: { hostname: 'cookie-race.invalid', origin: 'https://cookie-race.invalid', protocol: 'https:' },
    dispatchEvent(event) { env.events.push(event); return true; },
  };
  globalThis.document = { cookie: 'eh_csrf=synthetic-csrf-old' };
  globalThis.fetch = async (url, options) => {
    env.logouts.push({ url, options }); syntheticLogoutCalls += 1;
    return { ok: true, status: 204 };
  };
  activeEnv = env;
  return env;
}
function setup(user = ownerA) {
  const env = installMemoryBrowser();
  api.saveAuth(undefined, user);
  env.events.length = 0;
  return env;
}
async function start(env, method = 'GET', options = {}) {
  const outcome = api.apiRequest(method, '/notifications', method === 'GET' ? undefined : { synthetic: true }, {
    baseOverride: 'https://cookie-race.invalid/api', timeoutMs: 1000, ...options,
  }).then(value => ({ value }), error => ({ error }));
  const request = await env.requestReady.promise;
  return { request, outcome };
}
function reject401(request, code = auth.AUTH_ERROR_CODES.invalid) {
  const error = new Error('Synthetic delayed unauthorized response');
  error.isAxiosError = true;
  error.config = request.config;
  error.response = { status: 401, statusText: 'Unauthorized', data: { code }, headers: {}, config: request.config };
  request.gate.reject(error);
}
async function unauthorized(operation) {
  reject401(operation.request);
  const { error } = await operation.outcome;
  assert.ok(error?.isAuthError, 'The original request must still report its authentication failure.');
  assert.equal(error.status, 401);
}
function assertPreserved(env, expectedUser) {
  assert.deepEqual(api.getUser(), expectedUser, 'A stale request must preserve the current user snapshot.');
  assert.equal(env.logouts.length, 0, 'A stale request must not log out the renewed/current session.');
  assert.equal(env.events.length, 0, 'A stale request must not emit an authentication invalidation event.');
}
function assertCleared(env) {
  assert.equal(api.getUser(), null, 'An unchanged rejected current cookie session must be cleared.');
  assert.equal(env.logouts.length, 1, 'Current rejection must request exactly one synthetic server logout.');
  assert.equal(env.logouts[0].options.method, 'POST');
  assert.equal(env.logouts[0].options.credentials, 'include');
  assert.equal(env.logouts[0].options.headers['X-CSRF-Token'], 'synthetic-csrf-old');
  assert.equal(env.events.length, 1);
  assert.equal(env.events[0].type, api.AUTH_SYNC_EVENT);
}
function jwt(exp) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.synthetic-signature`;
}
async function check(name, run) {
  try {
    await run(); results.push({ name, pass: true }); console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, pass: false });
    console.error('FAIL ' + name + ': ' + String(error.message).split('\n')[0].slice(0, 220));
  }
}

try {
  delete process.env.NEXT_PUBLIC_API_BASE;
  installMemoryBrowser();
  // Actual apiRequest -> actual Axios -> deferred adapter. No socket adapter runs.
  axios.defaults.adapter = config => {
    adapterCalls += 1;
    const request = { config, gate: deferred() };
    activeEnv.requests.push(request); activeEnv.requestReady.resolve(request);
    return request.gate.promise;
  };
  auth = await import(authUrl.href);
  api = await import(apiUrl.href);

  for (const method of ['GET', 'POST']) {
    await check(`${method} delayed 401 preserves same-owner same-revision cookie renewal`, async () => {
      const env = setup(), before = api.captureAuthSession();
      const operation = await start(env, method);
      assert.equal(operation.request.config.withCredentials, true);
      assert.equal(operation.request.config.headers.Authorization, undefined);
      if (method === 'POST') assert.equal(operation.request.config.headers['X-CSRF-Token'], 'synthetic-csrf-old');
      globalThis.document.cookie = 'eh_csrf=synthetic-csrf-new';
      const renewed = api.captureAuthSession();
      assert.equal(renewed.scope, before.scope); assert.equal(renewed.revision, before.revision);
      assert.notEqual(renewed.csrfToken, before.csrfToken);
      assert.equal(api.isCurrentAuthSession(before), false);
      await unauthorized(operation);
      assertPreserved(env, ownerA);
      assert.deepEqual(api.captureAuthSession(), renewed);
    });
  }
  await check('unchanged current cookie 401 still clears the session once', async () => {
    const env = setup(), operation = await start(env);
    await unauthorized(operation); assertCleared(env);
  });
  await check('old owner response cannot clear a new owner with unchanged module revision', async () => {
    const env = setup(), before = api.captureAuthSession(), operation = await start(env);
    env.localStorage.setItem('user', JSON.stringify(ownerB));
    const after = api.captureAuthSession();
    assert.equal(after.revision, before.revision); assert.notEqual(after.scope, before.scope);
    await unauthorized(operation); assertPreserved(env, ownerB);
  });
  await check('old revision response cannot clear same-owner same-cookie renewed auth', async () => {
    const env = setup(), before = api.captureAuthSession(), operation = await start(env);
    api.saveAuth(undefined, ownerA);
    const after = api.captureAuthSession();
    assert.equal(after.scope, before.scope); assert.equal(after.csrfToken, before.csrfToken);
    assert.notEqual(after.revision, before.revision);
    assert.equal(env.events.length, 0, 'Identical stored user renewal need not emit a profile-change event.');
    await unauthorized(operation); assertPreserved(env, ownerA);
  });
  await check('explicit old JWT failure preserves unrelated current cookie auth', async () => {
    const env = setup(), token = jwt(Math.floor(Date.now() / 1000) + 3600);
    const operation = await start(env, 'GET', { tokenOverride: token });
    assert.equal(operation.request.config.headers.Authorization, `Bearer ${token}`);
    await unauthorized(operation); assertPreserved(env, ownerA);
  });
  await check('expired explicit JWT retains preflight rejection without clearing cookie auth', async () => {
    const env = setup(), callsBefore = adapterCalls;
    await assert.rejects(() => api.apiGet('/notifications', {
      tokenOverride: jwt(Math.floor(Date.now() / 1000) - 60), baseOverride: 'https://cookie-race.invalid/api',
    }), error => error?.isAuthError && error.authCode === auth.AUTH_ERROR_CODES.expired);
    assert.equal(adapterCalls, callsBefore); assertPreserved(env, ownerA);
  });
  await check('legacy stored JWT never replaces the active cookie marker or suppresses its current rejection', async () => {
    const env = setup(); env.localStorage.setItem('token', jwt(Math.floor(Date.now() / 1000) + 3600));
    assert.equal(api.getToken(), api.COOKIE_SESSION_MARKER);
    const operation = await start(env);
    assert.equal(operation.request.config.headers.Authorization, undefined);
    await unauthorized(operation); assertCleared(env);
  });
  assert.deepEqual({ api: sourceHash(apiUrl), auth: sourceHash(authUrl) }, inputHashes, 'Product inputs changed during this check.');
} finally {
  axios.defaults.adapter = originalAdapter;
  if (originalApiBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE;
  else process.env.NEXT_PUBLIC_API_BASE = originalApiBase;
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

const failed = results.filter(result => !result.pass).length;
console.log(JSON.stringify({ pass: failed === 0, checks: results.length, passed: results.length - failed, failed,
  adapterCalls, syntheticLogoutCalls, realNetworkRequests: 0, filesWritten: 0, inputHashes,
  scope: 'Actual unmodified api.js/auth-session.js and Axios with deferred synthetic 401 adapter responses; in-memory window/document/storage and synthetic logout fetch only. No real accounts, browser, natural cross-tab or manual acceptance.' }));
if (failed) process.exitCode = 1;
