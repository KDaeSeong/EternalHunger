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

console.log('Auth session checks passed.');
