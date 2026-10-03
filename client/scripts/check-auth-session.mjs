import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const authSource = await fs.readFile(new URL('../src/utils/auth-session.js', import.meta.url), 'utf8');
const authModuleUrl = `data:text/javascript;base64,${Buffer.from(authSource).toString('base64')}`;
const auth = await import(authModuleUrl);

function jwtWithExpiry(exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.signature`;
}

const now = Date.UTC(2026, 6, 11, 12, 0, 0);
assert(auth.isJwtExpired(jwtWithExpiry(Math.floor(now / 1000) - 1), now, 0));
assert(!auth.isJwtExpired(jwtWithExpiry(Math.floor(now / 1000) + 3600), now, 0));
assert.equal(auth.classifyAuthFailure({
  status: 403,
  data: { error: '관리자 권한이 없습니다.' },
  hadToken: true,
}), '');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] || null; }
  get length() { return this.values.size; }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
let authSyncCount = 0;
const fetchCalls = [];
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
};
globalThis.window = {
  dispatchEvent: () => { authSyncCount += 1; },
  localStorage,
  sessionStorage,
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000',
    protocol: 'http:',
  },
};
globalThis.document = { cookie: 'eh_csrf=csrf-contract-token' };
globalThis.fetch = async (...args) => {
  fetchCalls.push(args);
  return { ok: true, status: 204 };
};

let axiosConfig = null;
globalThis.__authTestAxiosImpl = async (config) => {
  axiosConfig = config;
  return { data: { ok: true }, status: 200, headers: {} };
};

const apiSource = await fs.readFile(new URL('../src/utils/api.js', import.meta.url), 'utf8');
assert(!apiSource.includes("localStorage.setItem('token'"), 'JWT must not be written to localStorage');
assert(!apiSource.includes("localStorage.getItem('token'"), 'JWT must not be read from localStorage');
const testableApiSource = apiSource
  .replace("import axios from 'axios';", 'const axios = (...args) => globalThis.__authTestAxiosImpl(...args);')
  .replace("from './auth-session';", `from '${authModuleUrl}';`);
const api = await import(`data:text/javascript;base64,${Buffer.from(testableApiSource).toString('base64')}`);

localStorage.setItem('token', 'legacy-jwt');
localStorage.setItem('user', JSON.stringify({ username: 'cookie-user', isAdmin: true }));
assert.equal(api.getToken(), api.COOKIE_SESSION_MARKER);

await api.apiGet('/notifications');
assert.equal(axiosConfig.withCredentials, true, 'API requests must include cookie credentials');
assert.equal(axiosConfig.headers.Authorization, undefined, 'cookie sessions must not expose a Bearer token');

await api.apiPost('/characters/save', []);
assert.equal(axiosConfig.headers['X-CSRF-Token'], 'csrf-contract-token', 'unsafe requests must echo the CSRF cookie');

api.saveAuth(undefined, { username: 'cookie-user', isAdmin: true });
assert.equal(localStorage.getItem('token'), null, 'legacy JWT must be removed during session save');
assert.equal(localStorage.getItem('user') !== null, true, 'non-sensitive user cache may remain');

globalThis.__authTestAxiosImpl = async () => {
  const error = new Error('Request failed');
  error.response = { status: 403, data: { error: '관리자 권한이 없습니다.' } };
  throw error;
};
await assert.rejects(() => api.apiGet('/admin/users'), (error) => !error.isAuthError);
assert.equal(localStorage.getItem('user') !== null, true, 'permission denial must preserve the session');

globalThis.__authTestAxiosImpl = async () => {
  const error = new Error('Request failed');
  error.response = { status: 401, data: { code: auth.AUTH_ERROR_CODES.invalid } };
  throw error;
};
await assert.rejects(() => api.apiGet('/notifications'), (error) => error.isAuthError);
assert.equal(localStorage.getItem('user'), null, 'invalid cookie session must clear the local user cache');
assert.equal(fetchCalls.length > 0, true, 'session invalidation must request server logout');
const [logoutUrl, logoutOptions] = fetchCalls.at(-1);
assert.equal(String(logoutUrl).endsWith('/api/auth/logout'), true);
assert.equal(logoutOptions.credentials, 'include');
assert.equal(logoutOptions.headers['X-CSRF-Token'], 'csrf-contract-token');
assert.equal(authSyncCount >= 1, true, 'session invalidation must emit a synchronization event');

globalThis.__authTestAxiosImpl = async () => {
  const error = new Error('Request failed');
  error.response = {
    status: 503,
    data: {
      code: 'SERVICE_CONFIGURATION_ERROR',
      error: 'BACKEND_BASE_URL이 설정되지 않았거나 올바르지 않습니다.',
    },
  };
  throw error;
};
await assert.rejects(
  () => api.apiGet('/public/home-hub'),
  (error) => error.code === 'SERVICE_CONFIGURATION_ERROR' &&
    error.message === api.SERVICE_UNAVAILABLE_MESSAGE &&
    !error.message.includes('BACKEND_BASE_URL'),
  'internal deployment details must be replaced with a user-facing service message',
);

function deferredRequest() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve: data => resolve({ data, status: 200, headers: {} }), reject };
}
function requestFailure(status = 500) {
  const error = new Error('Fixture request failed');
  error.response = { status, data: status === 401 ? { code: auth.AUTH_ERROR_CODES.invalid } : {} };
  return error;
}
let cacheChecks = 0;
async function cacheCheck(label, run) {
  await run(); cacheChecks++;
  console.log('PASS ' + label);
}
const author = { id: '111111111111111111111111', username: 'author' };
const reader = { id: '222222222222222222222222', username: 'reader' };
const cacheOptions = { ttlMs: 60000, storage: 'session' };

await cacheCheck('late author catalog cannot replace the current account catalog', async () => {
  const old = deferredRequest(), current = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const first = api.apiGetCached('/public/items', cacheOptions);
  api.saveAuth(undefined, reader);
  globalThis.__authTestAxiosImpl = () => current.promise;
  const second = api.apiGetCached('/public/items', cacheOptions);
  current.resolve([{ name: 'reader-item' }]); await second;
  old.resolve([{ name: 'author-item' }]); await first;
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [{ name: 'reader-item' }]);
});
await cacheCheck('late old-account authentication failure cannot log out the new account', async () => {
  const old = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.apiGet('/characters');
  api.saveAuth(undefined, reader);
  const logoutsBefore = fetchCalls.length;
  old.reject(requestFailure(401));
  await assert.rejects(pending, error => error.isAuthError);
  assert.deepEqual(api.getUser(), reader);
  assert.equal(fetchCalls.length, logoutsBefore);
});
await cacheCheck('late authentication failure cannot invalidate a newer login of the same account', async () => {
  const old = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.apiGet('/characters');
  api.saveAuth(undefined, author);
  old.reject(requestFailure(401));
  await assert.rejects(pending, error => error.isAuthError);
  assert.deepEqual(api.getUser(), author);
});
await cacheCheck('invalidating an in-flight catalog prevents an older result from undoing an edit', async () => {
  const old = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.apiGetCached('/public/items', cacheOptions);
  api.clearApiGetCache('/public/items');
  globalThis.__authTestAxiosImpl = async () => ({ data: [{ name: 'edited-item' }], status: 200, headers: {} });
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [{ name: 'edited-item' }]);
  old.resolve([{ name: 'before-edit' }]); await pending;
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [{ name: 'edited-item' }]);
});
await cacheCheck('an older failed request cannot delete a replacement catalog cache entry', async () => {
  const old = deferredRequest(); let currentCalls = 0;
  const memoryOptions = { ttlMs: 60000 };
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.apiGetCached('/public/items', memoryOptions);
  api.clearApiGetCache('/public/items');
  globalThis.__authTestAxiosImpl = async () => { currentCalls++; return { data: ['current'], status: 200, headers: {} }; };
  await api.apiGetCached('/public/items', memoryOptions);
  old.reject(requestFailure()); await assert.rejects(pending);
  assert.deepEqual(await api.apiGetCached('/public/items', memoryOptions), ['current']);
  assert.equal(currentCalls, 1);
});
await cacheCheck('a storage-driven account change cannot reuse the previous account memory cache', async () => {
  api.saveAuth(undefined, author); let calls = 0;
  globalThis.__authTestAxiosImpl = async () => { calls++; return { data: [api.getUser().id], status: 200, headers: {} }; };
  await api.apiGetCached('/public/items', cacheOptions);
  // A different tab can update user storage without calling this module's saveAuth.
  localStorage.setItem('user', JSON.stringify(reader));
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [reader.id]);
  assert.equal(calls, 2);
});
await cacheCheck('same-account duplicate requests coalesce without extra network work', async () => {
  const waiting = deferredRequest(); let calls = 0;
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => { calls++; return waiting.promise; };
  const one = api.apiGetCached('/public/items', cacheOptions), two = api.apiGetCached('/public/items', cacheOptions);
  waiting.resolve(['same-account']);
  assert.deepEqual(await one, ['same-account']); assert.deepEqual(await two, ['same-account']);
  assert.equal(calls, 1);
});
async function reloadApi(label) {
  return import(`data:text/javascript;base64,${Buffer.from(testableApiSource + '\n// reload fixture ' + label).toString('base64')}`);
}
await cacheCheck('same-account session cache survives a module reload without a request', async () => {
  globalThis.__authTestAxiosImpl = () => { throw new Error('Same-account session cache should be used.'); };
  const reloaded = await reloadApi('same-account');
  assert.deepEqual(await reloaded.apiGetCached('/public/items', cacheOptions), ['same-account']);
});
await cacheCheck('persistent cache key collisions cannot expose another account catalog', async () => {
  api.saveAuth(undefined, { username: 'Ab' });
  globalThis.__authTestAxiosImpl = async () => ({ data: ['Ab-private'], status: 200, headers: {} });
  await api.apiGetCached('/public/items', cacheOptions);
  const storageKey = [...sessionStorage.values.keys()].find(key => key.startsWith('eh_get_cache:') && !key.endsWith(':index'));
  assert.match(JSON.parse(sessionStorage.getItem(storageKey)).key, /:Ab$/);
  // "Ab" and "BA" have the same legacy djb2 hash; the stored full key must match.
  localStorage.setItem('user', JSON.stringify({ username: 'BA' }));
  globalThis.__authTestAxiosImpl = async () => ({ data: ['BA-private'], status: 200, headers: {} });
  const reloaded = await reloadApi('other-account');
  assert.deepEqual(await reloaded.apiGetCached('/public/items', cacheOptions), ['BA-private']);
  assert.match(JSON.parse(sessionStorage.getItem(storageKey)).key, /:BA$/,
    'This fixture must exercise the same hashed storage key for two different full identity keys.');
});
await cacheCheck('cookie sessions without usable identity metadata bypass the account cache', async () => {
  api.saveAuth(undefined, {}); let calls = 0;
  globalThis.__authTestAxiosImpl = async () => ({ data: [++calls], status: 200, headers: {} });
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [1]);
  assert.deepEqual(await api.apiGetCached('/public/items', cacheOptions), [2]);
  assert.equal(sessionStorage.values.size, 1, 'Only the empty cache index may remain after saveAuth.');
});
await cacheCheck('late session sync cannot restore an old account after switching accounts', async () => {
  const old = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.refreshStoredAuthSession();
  api.saveAuth(undefined, reader);
  old.resolve({ user: { ...author, lp: 50 } });
  assert.equal(await pending, false);
  assert.deepEqual(api.getUser(), reader);
});
await cacheCheck('late session sync cannot restore a logged-out account', async () => {
  const old = deferredRequest();
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.refreshStoredAuthSession();
  api.clearAuth();
  old.resolve({ user: author });
  assert.equal(await pending, false);
  assert.equal(api.getUser(), null);
});
await cacheCheck('session sync refreshes the current account but cannot undo newer progress', async () => {
  api.saveAuth(undefined, author);
  globalThis.__authTestAxiosImpl = async () => ({ data: { user: { ...author, lp: 50 } }, status: 200, headers: {} });
  assert.equal(await api.refreshStoredAuthSession(), true);
  assert.equal(api.getUser().lp, 50);
  const old = deferredRequest();
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.refreshStoredAuthSession();
  api.updateStoredUser({ lp: 200 });
  old.resolve({ user: { ...author, lp: 50 } });
  assert.equal(await pending, false);
  assert.equal(api.getUser().lp, 200);
});
await cacheCheck('a late game receipt cannot overwrite a different account or renewed session', async () => {
  api.saveAuth(undefined, author);
  const session = api.captureAuthSession();
  localStorage.setItem('user', JSON.stringify(reader));
  assert.equal(api.updateStoredUser({ lp: 999 }, { session }), null);
  assert.deepEqual(api.getUser(), reader);
  api.saveAuth(undefined, author);
  const renewed = api.captureAuthSession();
  api.saveAuth(undefined, author);
  assert.equal(api.updateStoredUser({ lp: 999 }, { session: renewed }), null);
  assert.deepEqual(api.getUser(), author);
});
await cacheCheck('cookie renewal and unmounted session sync both discard their older response', async () => {
  api.saveAuth(undefined, author);
  const old = deferredRequest();
  globalThis.__authTestAxiosImpl = () => old.promise;
  const pending = api.refreshStoredAuthSession();
  const oldCookie = document.cookie;
  document.cookie = 'eh_csrf=renewed-session';
  old.resolve({ user: { ...author, lp: 999 } });
  assert.equal(await pending, false);
  assert.deepEqual(api.getUser(), author);
  document.cookie = oldCookie;
  globalThis.__authTestAxiosImpl = async () => ({ data: { user: { ...author, lp: 999 } }, status: 200, headers: {} });
  assert.equal(await api.refreshStoredAuthSession({ shouldApply: () => false }), false);
  assert.deepEqual(api.getUser(), author);
});
console.log(`Auth session checks passed; cookie session isolation checks ${cacheChecks}/15. Mock HTTP/storage, not browser or server sessions.`);
