export const AUTH_ERROR_CODES = Object.freeze({
  required: 'AUTH_REQUIRED',
  expired: 'AUTH_TOKEN_EXPIRED',
  invalid: 'AUTH_TOKEN_INVALID',
  userMissing: 'AUTH_USER_NOT_FOUND',
});

const INVALID_SESSION_CODES = new Set([
  AUTH_ERROR_CODES.expired,
  AUTH_ERROR_CODES.invalid,
  AUTH_ERROR_CODES.userMissing,
]);

function tokenValue(rawToken) {
  return String(rawToken || '').trim().replace(/^Bearer\s+/i, '');
}

function decodeBase64Url(value) {
  if (typeof globalThis.atob !== 'function') return '';
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return globalThis.atob(padded);
}

export function jwtExpiryMs(rawToken) {
  const parts = tokenValue(rawToken).split('.');
  if (parts.length !== 3) return 0;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const expiresAt = Number(payload?.exp || 0) * 1000;
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : 0;
  } catch {
    return 0;
  }
}

export function isJwtExpired(rawToken, nowMs = Date.now(), clockSkewMs = 5000) {
  const expiresAt = jwtExpiryMs(rawToken);
  return expiresAt > 0 && expiresAt <= Number(nowMs || 0) + Math.max(0, Number(clockSkewMs || 0));
}

export function classifyAuthFailure({ status, data, hadToken = false } = {}) {
  const code = String(data?.code || '').trim().toUpperCase();
  if (INVALID_SESSION_CODES.has(code)) return code;
  if (!hadToken) return '';

  const message = String(data?.error || data?.message || '').trim();
  if (Number(status || 0) === 401 && code === AUTH_ERROR_CODES.required) {
    return AUTH_ERROR_CODES.invalid;
  }
  if (Number(status || 0) === 401 && /로그인이 필요|사용자를 찾을 수 없/i.test(message)) {
    return AUTH_ERROR_CODES.invalid;
  }
  if (Number(status || 0) === 403 && /유효하지 않은 토큰|token expired|jwt expired/i.test(message)) {
    return /expired|만료/i.test(message) ? AUTH_ERROR_CODES.expired : AUTH_ERROR_CODES.invalid;
  }
  return '';
}

export function authFailureMessage(code) {
  if (code === AUTH_ERROR_CODES.expired) {
    return '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.';
  }
  return '로그인 정보가 유효하지 않습니다. 다시 로그인해 주세요.';
}
