// client/src/utils/api.js
// Browser sessions use an HttpOnly cookie. A short in-memory marker preserves
// existing login guards without exposing the JWT to JavaScript storage.

import axios from 'axios';
import {
  AUTH_ERROR_CODES,
  authFailureMessage,
  classifyAuthFailure,
  isJwtExpired,
} from './auth-session';

export const DEFAULT_API_TIMEOUT_MS = 10000;
export const INIT_API_TIMEOUT_MS = 45000;
export const AUTH_SYNC_EVENT = 'eh:auth-sync';
export const COOKIE_SESSION_MARKER = 'cookie-session';
export const SERVICE_UNAVAILABLE_MESSAGE =
  '서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.';
export const API_BASE_CONFIG_ERROR = SERVICE_UNAVAILABLE_MESSAGE;

export function normalizeApiBase(raw) {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (/\/api(?:\/proxy)?$/.test(v)) return v;
  return `${v}/api`;
}

export function stripApiSuffix(raw) {
  return String(raw || '').trim().replace(/\/api\/?$/, '');
}

export function getApiBase() {
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env && String(env).trim()) return normalizeApiBase(env);

  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('EH_API_BASE');
      if (saved && String(saved).trim()) return normalizeApiBase(saved);
    } catch {}

    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:5000/api';
    if (origin && /^https?:\/\//.test(origin)) return `${origin}/api/proxy`;
  }

  return '';
}

export const API_BASE = getApiBase();

export function normalizeToken(raw) {
  if (raw === undefined || raw === null) return null;
  const v = String(raw).trim();
  if (!v || v === 'undefined' || v === 'null') return null;
  return v;
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function getToken() {
  return getUser() ? COOKIE_SESSION_MARKER : null;
}

export function getFallbackToken() {
  return null;
}

export function getAnyToken() {
  return getToken();
}

function getCookieValue(name) {
  if (typeof document === 'undefined') return '';
  try {
    const prefix = `${name}=`;
    const part = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  } catch {
    return '';
  }
}

function expireVisibleLegacyCookie(name) {
  if (typeof document === 'undefined' || !getCookieValue(name)) return;
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  try {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  } catch {}
}

function clearLegacyTokenStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('authToken');
  } catch {}
  expireVisibleLegacyCookie('token');
  expireVisibleLegacyCookie('accessToken');
  expireVisibleLegacyCookie('authToken');
}

export function syncAuthCookie() {
  clearLegacyTokenStorage();
}

export function emitAuthSync(detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    const payload = { at: Date.now(), ...detail };
    window.localStorage.setItem('eh_auth_sync_ts', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT, { detail: payload }));
  } catch {}
}

export function saveAuth(_token, user) {
  if (typeof window === 'undefined') return;
  clearLegacyTokenStorage();
  let didChange = false;
  try {
    if (user !== undefined) {
      const nextUserRaw = user === null ? null : JSON.stringify(user);
      const prevUserRaw = window.localStorage.getItem('user');
      if (nextUserRaw === null) window.localStorage.removeItem('user');
      else window.localStorage.setItem('user', nextUserRaw);
      didChange = prevUserRaw !== nextUserRaw;
    }
  } catch {}
  clearApiGetCache();
  if (didChange) emitAuthSync({ reason: 'saveAuth' });
}

function requestServerLogout() {
  if (typeof window === 'undefined') return;
  const url = buildApiUrl('/auth/logout');
  if (!url) return;
  const csrfToken = getCookieValue('eh_csrf');
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  void fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
  }).catch(() => {});
}

export function clearAuth(detail = {}) {
  if (typeof window === 'undefined') return;
  requestServerLogout();
  try {
    window.localStorage.removeItem('user');
  } catch {}
  clearLegacyTokenStorage();
  clearApiGetCache();
  emitAuthSync({ reason: 'clearAuth', ...(detail || {}) });
}

export function updateStoredUser(patch) {
  if (typeof window === 'undefined') return null;
  const current = getUser();
  if (!current || typeof current !== 'object') return null;
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...(patch || {}) };
  if (!next || typeof next !== 'object') return null;
  saveAuth(undefined, next);
  return next;
}

export function isAdmin() {
  return Boolean(getUser()?.isAdmin);
}

export function buildAuthHeaders(tokenOverride) {
  const token = normalizeToken(tokenOverride !== undefined ? tokenOverride : getAnyToken());
  if (!token || token === COOKIE_SESSION_MARKER) return {};
  return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
}

function comparableToken(rawToken) {
  return String(normalizeToken(rawToken) || '').replace(/^Bearer\s+/i, '');
}

function clearRejectedStoredAuth(requestToken, authCode) {
  if (typeof window === 'undefined') return;
  const currentToken = getAnyToken();
  if (!currentToken || comparableToken(currentToken) !== comparableToken(requestToken)) return;
  clearAuth({ reason: 'auth-invalidated', authCode });
}

function createAuthSessionError(authCode, requestUrl, method) {
  const err = new Error(authFailureMessage(authCode));
  err.code = authCode;
  err.authCode = authCode;
  err.status = 401;
  err.isAuthError = true;
  err.isTimeout = false;
  err.isNetwork = false;
  err.requestUrl = requestUrl;
  err.method = method;
  return err;
}

function shouldAttachStoredAuth(url, options = {}) {
  if (options.auth === false) return false;
  if (options.tokenOverride !== undefined) return true;
  return !/^\/?auth\/(?:login|signup|reset-password)(?:[/?#]|$)/i.test(String(url || ''));
}

export function buildApiUrl(url, options = {}) {
  const base = normalizeApiBase(options.baseOverride || getApiBase());
  if (!base) return '';
  return `${base}${String(url || '').startsWith('/') ? url : `/${url}`}`;
}

const GET_CACHE = new Map();
const PERSISTENT_GET_CACHE_PREFIX = 'eh_get_cache:';
const PERSISTENT_GET_CACHE_INDEX = 'eh_get_cache:index';

function hashCacheKey(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildGetCacheKey(url, options = {}) {
  const fullUrl = buildApiUrl(url, { baseOverride: options.baseOverride });
  const token = normalizeToken(options.tokenOverride !== undefined ? options.tokenOverride : getAnyToken());
  const tokenScope = token ? `auth:${hashCacheKey(token)}` : 'anon';
  return `${fullUrl}::${tokenScope}`;
}

function canUseSessionGetCache(options = {}) {
  if (options.storage !== 'session' || typeof window === 'undefined') return false;
  try {
    return Boolean(window.sessionStorage);
  } catch {
    return false;
  }
}

function getPersistentCacheIndex() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(PERSISTENT_GET_CACHE_INDEX) || '{}') || {};
  } catch {
    return {};
  }
}

function setPersistentCacheIndex(index) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PERSISTENT_GET_CACHE_INDEX, JSON.stringify(index || {}));
  } catch {}
}

function persistentGetCacheKey(rawKey) {
  return `${PERSISTENT_GET_CACHE_PREFIX}${hashCacheKey(rawKey)}`;
}

function readPersistentGetCache(rawKey, options = {}) {
  if (!canUseSessionGetCache(options)) return null;
  const storageKey = persistentGetCacheKey(rawKey);
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
    if (!cached || cached.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writePersistentGetCache(rawKey, data, expiresAt, options = {}) {
  if (!canUseSessionGetCache(options)) return;
  const storageKey = persistentGetCacheKey(rawKey);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ data, expiresAt }));
    const index = getPersistentCacheIndex();
    index[storageKey] = rawKey;
    setPersistentCacheIndex(index);
  } catch {}
}

function clearPersistentGetCache(match = '') {
  if (typeof window === 'undefined') return;
  let storage = null;
  try {
    storage = window.sessionStorage;
  } catch {
    return;
  }
  if (!storage) return;

  const index = getPersistentCacheIndex();
  const needle = String(match || '');
  let didChange = false;
  Object.entries(index).forEach(([storageKey, rawKey]) => {
    if (!needle || String(rawKey || '').includes(needle)) {
      try { storage.removeItem(storageKey); } catch {}
      delete index[storageKey];
      didChange = true;
    }
  });
  if (!needle) {
    try {
      Object.keys(storage)
        .filter((key) => key.startsWith(PERSISTENT_GET_CACHE_PREFIX))
        .forEach((key) => storage.removeItem(key));
    } catch {}
  }
  if (didChange || !needle) setPersistentCacheIndex(index);
}

export function clearApiGetCache(match = '') {
  const needle = String(match || '');
  if (!needle) {
    GET_CACHE.clear();
    clearPersistentGetCache();
    return;
  }
  for (const key of GET_CACHE.keys()) {
    if (key.includes(needle)) GET_CACHE.delete(key);
  }
  clearPersistentGetCache(needle);
}

export async function apiRequest(method, url, data, options = {}) {
  const attachStoredAuth = shouldAttachStoredAuth(url, options);
  const requestToken = normalizeToken(attachStoredAuth
    ? (options.tokenOverride !== undefined ? options.tokenOverride : getAnyToken())
    : null);
  const headers = { ...buildAuthHeaders(requestToken), ...(options.headers || {}) };
  const upperMethod = String(method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod) && options.csrf !== false) {
    const csrfToken = getCookieValue('eh_csrf');
    if (csrfToken && !headers['X-CSRF-Token'] && !headers['x-csrf-token']) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const fullUrl = buildApiUrl(url, { baseOverride: options.baseOverride });
  if (!fullUrl) {
    const err = new Error(API_BASE_CONFIG_ERROR);
    err.code = 'API_BASE_MISSING';
    err.status = 0;
    err.isConfigError = true;
    err.isTimeout = false;
    err.isNetwork = false;
    err.requestUrl = url;
    err.method = method;
    throw err;
  }

  if (requestToken && requestToken !== COOKIE_SESSION_MARKER && isJwtExpired(requestToken)) {
    clearRejectedStoredAuth(requestToken, AUTH_ERROR_CODES.expired);
    throw createAuthSessionError(AUTH_ERROR_CODES.expired, fullUrl, method);
  }

  try {
    const res = await axios({
      method,
      url: fullUrl,
      data,
      headers,
      timeout: Number(options.timeoutMs || DEFAULT_API_TIMEOUT_MS),
      withCredentials: options.withCredentials !== false,
      responseType: options.responseType,
    });
    if (options.returnFullResponse) {
      return { data: res.data, status: res.status, headers: res.headers };
    }
    return res.data;
  } catch (e) {
    const status = Number(e?.response?.status || 0);
    const isTimeout = e?.code === 'ECONNABORTED';
    const isNetwork = !status && !isTimeout;
    const responseCode = String(e?.response?.data?.code || '').trim();
    const authCode = classifyAuthFailure({
      status,
      data: e?.response?.data,
      hadToken: Boolean(requestToken),
    });
    if (authCode) clearRejectedStoredAuth(requestToken, authCode);
    const isServiceFailure = isNetwork || status >= 500 || responseCode === 'SERVICE_CONFIGURATION_ERROR';
    const msg = authCode
      ? authFailureMessage(authCode)
      : isTimeout
        ? '요청이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
        : isServiceFailure
          ? SERVICE_UNAVAILABLE_MESSAGE
          : (e?.response?.data?.error || e?.response?.data?.message || e.message || '요청을 처리하지 못했습니다.');
    const err = new Error(msg);
    err.response = e?.response;
    err.code = responseCode || e?.code || '';
    err.status = status;
    err.isTimeout = isTimeout;
    err.isNetwork = isNetwork;
    err.requestUrl = fullUrl;
    err.method = method;
    err.timeoutMs = Number(options.timeoutMs || DEFAULT_API_TIMEOUT_MS);
    err.originalMessage = e?.message || msg;
    err.authCode = authCode;
    err.isAuthError = Boolean(authCode);
    throw err;
  }
}

export const apiGet = (url, options) => apiRequest('GET', url, undefined, options);

export async function apiGetCached(url, options = {}) {
  const ttlMs = Math.max(0, Number(options.ttlMs || 10000));
  if (options.force || ttlMs <= 0) return apiGet(url, options);
  const key = buildGetCacheKey(url, options);
  const now = Date.now();
  const hit = GET_CACHE.get(key);
  if (hit && hit.expiresAt > now) return hit.promise || hit.data;
  const persisted = readPersistentGetCache(key, options);
  if (persisted) {
    GET_CACHE.set(key, { data: persisted.data, expiresAt: persisted.expiresAt });
    return persisted.data;
  }
  const promise = apiGet(url, options)
    .then((responseData) => {
      const expiresAt = Date.now() + ttlMs;
      GET_CACHE.set(key, { data: responseData, expiresAt });
      writePersistentGetCache(key, responseData, expiresAt, options);
      return responseData;
    })
    .catch((err) => {
      GET_CACHE.delete(key);
      throw err;
    });
  GET_CACHE.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

export const apiPost = (url, data, options) => apiRequest('POST', url, data, options);
export const apiPut = (url, data, options) => apiRequest('PUT', url, data, options);
export const apiDelete = (url, options) => apiRequest('DELETE', url, undefined, options);
