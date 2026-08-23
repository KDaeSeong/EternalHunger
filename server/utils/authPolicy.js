const crypto = require('crypto');

const SESSION_COOKIE = 'token';
const CSRF_COOKIE = 'eh_csrf';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (username.length < 4 || username.length > 32) {
    return { ok: false, username, error: '아이디는 4~32자로 입력해주세요.' };
  }
  if (!/^[\p{L}\p{N}._-]+$/u.test(username)) {
    return { ok: false, username, error: '아이디는 문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.' };
  }
  return { ok: true, username, error: '' };
}

function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 10 || password.length > 72) {
    return { ok: false, password, error: '비밀번호는 10~72자로 입력해주세요.' };
  }
  const categories = [/[\p{L}]/u, /\d/u, /[^\p{L}\p{N}]/u]
    .filter((pattern) => pattern.test(password)).length;
  if (categories < 3) {
    return { ok: false, password, error: '비밀번호에는 문자, 숫자, 특수문자를 각각 하나 이상 포함해주세요.' };
  }
  return { ok: true, password, error: '' };
}

function parseCookies(req) {
  const raw = String(req?.headers?.cookie || '');
  return raw.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index <= 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function secureCookiesEnabled() {
  if (String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true') return true;
  if (String(process.env.COOKIE_SECURE || '').toLowerCase() === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function baseCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax',
    secure: secureCookiesEnabled(),
  };
}

function issueAuthCookies(res, token) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const base = baseCookieOptions();
  res.cookie(SESSION_COOKIE, token, {
    ...base,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
  return csrfToken;
}

function clearAuthCookies(res) {
  const base = baseCookieOptions();
  res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validateCsrfRequest(req) {
  if (SAFE_METHODS.has(String(req?.method || 'GET').toUpperCase())) return true;
  const cookies = parseCookies(req);
  const header = req?.headers?.['x-csrf-token'];
  return safeEqual(cookies[CSRF_COOKIE], header);
}

module.exports = {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearAuthCookies,
  issueAuthCookies,
  normalizeUsername,
  parseCookies,
  validateCsrfRequest,
  validatePassword,
  validateUsername,
};
