const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearAuthCookies,
  issueAuthCookies,
  validateCsrfRequest,
} = require('../utils/authPolicy');

test('session cookies keep JWT HttpOnly and require matching CSRF on unsafe methods', () => {
  const issued = [];
  const cleared = [];
  const response = {
    cookie: (name, value, options) => issued.push({ name, value, options }),
    clearCookie: (name, options) => cleared.push({ name, options }),
  };

  const csrfToken = issueAuthCookies(response, 'signed-jwt');
  const session = issued.find((item) => item.name === SESSION_COOKIE);
  const csrf = issued.find((item) => item.name === CSRF_COOKIE);
  assert.equal(session.value, 'signed-jwt');
  assert.equal(session.options.httpOnly, true);
  assert.equal(csrf.options.httpOnly, false);
  assert.equal(csrfToken.length, 64);

  const cookie = `${SESSION_COOKIE}=signed-jwt; ${CSRF_COOKIE}=${csrfToken}`;
  assert.equal(validateCsrfRequest({ method: 'POST', headers: { cookie, 'x-csrf-token': csrfToken } }), true);
  assert.equal(validateCsrfRequest({ method: 'POST', headers: { cookie, 'x-csrf-token': 'wrong' } }), false);
  assert.equal(validateCsrfRequest({ method: 'GET', headers: { cookie } }), true);

  clearAuthCookies(response);
  assert.deepEqual(cleared.map((item) => item.name).sort(), [CSRF_COOKIE, SESSION_COOKIE].sort());
});

test('browser code has no hardcoded backend fallback or JavaScript JWT storage', () => {
  const root = path.resolve(__dirname, '..', '..');
  const proxy = fs.readFileSync(path.join(root, 'client', 'src', 'app', 'api', 'proxy', '[...path]', 'route.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'client', 'src', 'utils', 'api.js'), 'utf8');
  const authRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'auth.js'), 'utf8');

  assert.equal(proxy.includes('LEGACY_BACKEND_FALLBACK'), false);
  assert.equal(proxy.includes('AUTH_PROXY_CREDENTIAL_ORIGINS'), true);
  assert.equal(api.includes("localStorage.setItem('token'"), false);
  assert.equal(api.includes("localStorage.getItem('token'"), false);
  assert.equal(api.includes('withCredentials: options.withCredentials !== false'), true);
  assert.equal(authRoute.includes('return res.json({ token,'), false);
  assert.equal(authRoute.includes('issueAuthCookies(res, token)'), true);
});
