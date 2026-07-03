// client/src/utils/api.js
// - 공통 API 유틸
// - 기본은 NEXT_PUBLIC_API_BASE(있으면) > localStorage(EH_API_BASE) > 환경에 따른 기본값
// - localStorage(EH_API_BASE)는 "http://localhost:5000" 처럼 /api 없는 값도 허용
// - 배포에서 공개 API_BASE가 없으면 같은 오리진의 /api/proxy 를 자동 사용한다
// - 실행 체크 시 인증/시뮬 페이지 모두 이 공용 유틸 기준으로 API_BASE를 맞춘다

import axios from 'axios';

export const DEFAULT_API_TIMEOUT_MS = 10000;
export const INIT_API_TIMEOUT_MS = 45000;
export const AUTH_SYNC_EVENT = 'eh:auth-sync';
export const API_BASE_CONFIG_ERROR =
  'API_BASE를 확인할 수 없습니다. NEXT_PUBLIC_API_BASE, EH_API_BASE 또는 서버 BACKEND_BASE_URL 설정을 확인하세요.';

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

export function getToken() {
  if (typeof window === 'undefined') return null;
  return normalizeToken(window.localStorage.getItem('token'));
}

export function getFallbackToken() {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeToken(
      window.localStorage.getItem('accessToken') || window.localStorage.getItem('authToken')
    );
  } catch {
    return null;
  }
}

export function getAnyToken() {
  return normalizeToken(getToken() || getFallbackToken());
}

function getCookieSecureFlag() {
  if (typeof window === 'undefined') return '';
  try {
    return window.location?.protocol === 'https:' ? '; Secure' : '';
  } catch {
    return '';
  }
}

function writeAuthCookie(name, value) {
  if (typeof document === 'undefined') return;
  const token = normalizeToken(value);
  const secure = getCookieSecureFlag();
  try {
    if (token) {
      const maxAge = 60 * 60 * 24;
      document.cookie = `${name}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    } else {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    }
  } catch {}
}

export function syncAuthCookie(token) {
  writeAuthCookie('token', token);
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function emitAuthSync(detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    const payload = { at: Date.now(), ...detail };
    window.localStorage.setItem('eh_auth_sync_ts', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT, { detail: payload }));
  } catch {}
}

export function saveAuth(token, user) {
  if (typeof window === 'undefined') return;
  let didChange = false;
  let authTokenChanged = false;
  try {
    if (token !== undefined) {
      const rawToken = normalizeToken(token);
      const prevToken = normalizeToken(window.localStorage.getItem('token'));
      if (rawToken) window.localStorage.setItem('token', rawToken);
      else window.localStorage.removeItem('token');
      syncAuthCookie(rawToken);
      authTokenChanged = prevToken !== rawToken;
      didChange = didChange || authTokenChanged;
    }
    if (user !== undefined) {
      const nextUserRaw = user === null ? null : JSON.stringify(user);
      const prevUserRaw = window.localStorage.getItem('user');
      if (nextUserRaw === null) window.localStorage.removeItem('user');
      else window.localStorage.setItem('user', nextUserRaw);
      didChange = didChange || prevUserRaw !== nextUserRaw;
    }
  } catch {}
  if (authTokenChanged) clearApiGetCache();
  if (didChange) emitAuthSync({ reason: 'saveAuth' });
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('authToken');
  } catch {}
  writeAuthCookie('token', null);
  writeAuthCookie('accessToken', null);
  writeAuthCookie('authToken', null);
  clearApiGetCache();
  emitAuthSync({ reason: 'clearAuth' });
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
  const u = getUser();
  return Boolean(u?.isAdmin);
}

export function buildAuthHeaders(tokenOverride) {
  const token = normalizeToken(tokenOverride !== undefined ? tokenOverride : getAnyToken());
  if (!token) return {};
  return {
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };
}

export function buildApiUrl(url, options = {}) {
  const base = normalizeApiBase(options.baseOverride || getApiBase());
  if (!base) return '';
  return `${base}${String(url || '').startsWith('/') ? url : `/${url}`}`;
}

const GET_CACHE = new Map();
const PERSISTENT_GET_CACHE_PREFIX = 'eh_get_cache:';
const PERSISTENT_GET_CACHE_INDEX = 'eh_get_cache:index';

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

function hashCacheKey(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
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
      try {
        storage.removeItem(storageKey);
      } catch {}
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
  const headers = {
    ...buildAuthHeaders(options.tokenOverride),
    ...(options.headers || {}),
  };

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

  try {
    const res = await axios({
      method,
      url: fullUrl,
      data,
      headers,
      timeout: Number(options.timeoutMs || DEFAULT_API_TIMEOUT_MS),
      withCredentials: Boolean(options.withCredentials),
      responseType: options.responseType,
    });
    if (options.returnFullResponse) {
      return {
        data: res.data,
        status: res.status,
        headers: res.headers,
      };
    }
    return res.data;
  } catch (e) {
    const status = Number(e?.response?.status || 0);
    const isTimeout = e?.code === 'ECONNABORTED';
    const isNetwork = !status && !isTimeout;
    const msg = isTimeout
      ? '요청 시간이 초과되었습니다. 서버 실행 상태를 확인하세요.'
      : (e?.response?.data?.error || e?.response?.data?.message || e.message || '요청 실패');
    const err = new Error(msg);
    err.response = e?.response;
    err.code = e?.code || '';
    err.status = status;
    err.isTimeout = isTimeout;
    err.isNetwork = isNetwork;
    err.requestUrl = fullUrl;
    err.method = method;
    err.timeoutMs = Number(options.timeoutMs || DEFAULT_API_TIMEOUT_MS);
    err.originalMessage = e?.message || msg;
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
  if (hit && hit.expiresAt > now) {
    if (hit.promise) return hit.promise;
    return hit.data;
  }

  const persisted = readPersistentGetCache(key, options);
  if (persisted) {
    GET_CACHE.set(key, { data: persisted.data, expiresAt: persisted.expiresAt });
    return persisted.data;
  }

  const promise = apiGet(url, options)
    .then((data) => {
      const expiresAt = Date.now() + ttlMs;
      GET_CACHE.set(key, { data, expiresAt });
      writePersistentGetCache(key, data, expiresAt, options);
      return data;
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
