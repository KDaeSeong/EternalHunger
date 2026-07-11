import fs from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await fs.readFile(new URL('../src/utils/auth-session.js', import.meta.url), 'utf8');
const authModuleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const auth = await import(authModuleUrl);

function jwtWithExpiry(exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.signature`;
}

const now = Date.UTC(2026, 6, 11, 12, 0, 0);
const expiredToken = jwtWithExpiry(Math.floor(now / 1000) - 1);
const activeToken = jwtWithExpiry(Math.floor(now / 1000) + 3600);

assert(auth.isJwtExpired(expiredToken, now, 0), 'expired JWT should be rejected before a request');
assert(!auth.isJwtExpired(activeToken, now, 0), 'active JWT should remain usable');
assert(!auth.isJwtExpired('opaque-token', now, 0), 'opaque tokens should not be treated as expired JWTs');
assert(
  auth.classifyAuthFailure({
    status: 401,
    data: { code: auth.AUTH_ERROR_CODES.expired },
    hadToken: true,
  }) === auth.AUTH_ERROR_CODES.expired,
  'server expiration code should be preserved'
);
assert(
  auth.classifyAuthFailure({
    status: 403,
    data: { error: '유효하지 않은 토큰입니다.' },
    hadToken: true,
  }) === auth.AUTH_ERROR_CODES.invalid,
  'legacy invalid-token responses should invalidate the local session'
);
assert(
  auth.classifyAuthFailure({
    status: 403,
    data: { error: '관리자 권한이 없습니다.' },
    hadToken: true,
  }) === '',
  'permission errors must not sign out a valid user'
);
assert(
  auth.classifyAuthFailure({
    status: 401,
    data: { code: auth.AUTH_ERROR_CODES.required },
    hadToken: false,
  }) === '',
  'anonymous 401 responses must not be treated as a rejected stored session'
);
assert(
  auth.classifyAuthFailure({
    status: 401,
    data: { error: '비밀번호가 일치하지 않습니다.' },
    hadToken: true,
  }) === '',
  'login credential errors must not invalidate an unrelated stored session'
);

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  key(index) {
    return [...this.values.keys()][index] || null;
  }

  get length() {
    return this.values.size;
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
let authSyncCount = 0;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = {
  dispatchEvent: () => {
    authSyncCount += 1;
  },
  localStorage,
  sessionStorage,
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000',
    protocol: 'http:',
  },
};
globalThis.document = { cookie: '' };
let axiosCalls = 0;
globalThis.__authTestAxiosImpl = async () => {
  axiosCalls += 1;
  return { data: { ok: true }, status: 200, headers: {} };
};

const apiSource = await fs.readFile(new URL('../src/utils/api.js', import.meta.url), 'utf8');
const testableApiSource = apiSource
  .replace("import axios from 'axios';", 'const axios = (...args) => globalThis.__authTestAxiosImpl(...args);')
  .replace("from './auth-session';", `from '${authModuleUrl}';`);
const api = await import(`data:text/javascript;base64,${Buffer.from(testableApiSource).toString('base64')}`);

localStorage.setItem('token', expiredToken);
localStorage.setItem('user', JSON.stringify({ username: 'expired-user' }));
let expiredRequestError = null;
try {
  await api.apiGet('/notifications');
} catch (error) {
  expiredRequestError = error;
}
assert(expiredRequestError?.authCode === auth.AUTH_ERROR_CODES.expired, 'expired token should yield a typed auth error');
assert(axiosCalls === 0, 'expired token should not reach the network');
assert(localStorage.getItem('token') === null, 'expired token should be removed');
assert(localStorage.getItem('user') === null, 'stale cached user should be removed with the token');
assert(authSyncCount === 1, 'expired session should emit one auth synchronization event');

const futureToken = jwtWithExpiry(Math.floor(Date.now() / 1000) + 3600);
localStorage.setItem('token', futureToken);
localStorage.setItem('user', JSON.stringify({ username: 'active-user' }));
globalThis.__authTestAxiosImpl = async () => {
  axiosCalls += 1;
  const error = new Error('Request failed');
  error.response = { status: 403, data: { error: '유효하지 않은 토큰입니다.' } };
  throw error;
};
let rejectedRequestError = null;
try {
  await api.apiGet('/notifications');
} catch (error) {
  rejectedRequestError = error;
}
assert(rejectedRequestError?.isAuthError, 'rejected stored token should yield an auth error');
assert(localStorage.getItem('token') === null, 'server-rejected stored token should be removed');
assert(authSyncCount === 2, 'server-rejected session should emit one additional auth event');

localStorage.setItem('token', futureToken);
localStorage.setItem('user', JSON.stringify({ username: 'admin-user' }));
globalThis.__authTestAxiosImpl = async () => {
  axiosCalls += 1;
  const error = new Error('Request failed');
  error.response = { status: 403, data: { error: '관리자 권한이 없습니다.' } };
  throw error;
};
let permissionError = null;
try {
  await api.apiGet('/admin/users');
} catch (error) {
  permissionError = error;
}
assert(permissionError && !permissionError.isAuthError, 'permission denial should remain a normal API error');
assert(localStorage.getItem('token') === futureToken, 'permission denial must preserve the active session');
assert(authSyncCount === 2, 'permission denial must not emit an auth invalidation event');

localStorage.setItem('token', expiredToken);
localStorage.setItem('user', JSON.stringify({ username: 'expired-user' }));
let loginRequestHeaders = null;
globalThis.__authTestAxiosImpl = async (config) => {
  axiosCalls += 1;
  loginRequestHeaders = config.headers;
  return { data: { token: futureToken, user: { username: 'active-user' } }, status: 200, headers: {} };
};
await api.apiPost('/auth/login', { username: 'active-user', password: 'secret' });
assert(!loginRequestHeaders?.Authorization, 'public auth requests must not attach a stale stored token');
assert(localStorage.getItem('token') === expiredToken, 'public auth request should leave replacement to saveAuth after success');

console.log('Auth session checks passed.');
