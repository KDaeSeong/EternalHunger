// client/src/utils/api.js
// - 공통 API 유틸
// - 기본은 NEXT_PUBLIC_API_BASE(있으면) > localStorage(EH_API_BASE) > 환경에 따른 기본값
// - localStorage(EH_API_BASE)는 "http://localhost:5000" 처럼 /api 없는 값도 허용
// - 실행 체크 시 인증/시뮬 페이지 모두 이 공용 유틸 기준으로 API_BASE를 맞춘다

import axios from 'axios';

export const DEFAULT_API_TIMEOUT_MS = 10000;
export const AUTH_SYNC_EVENT = 'eh:auth-sync';
export const API_BASE_CONFIG_ERROR =
  'API_BASE가 설정되지 않았습니다. NEXT_PUBLIC_API_BASE 또는 EH_API_BASE를 확인하세요.';

export function normalizeApiBase(raw) {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (v.endsWith('/api')) return v;
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

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000/api';
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
  try {
    if (token !== undefined) {
      const rawToken = normalizeToken(token);
      const prevToken = normalizeToken(window.localStorage.getItem('token'));
      if (rawToken) window.localStorage.setItem('token', rawToken);
      else window.localStorage.removeItem('token');
      didChange = didChange || prevToken !== rawToken;
    }
    if (user !== undefined) {
      const nextUserRaw = user === null ? null : JSON.stringify(user);
      const prevUserRaw = window.localStorage.getItem('user');
      if (nextUserRaw === null) window.localStorage.removeItem('user');
      else window.localStorage.setItem('user', nextUserRaw);
      didChange = didChange || prevUserRaw !== nextUserRaw;
    }
  } catch {}
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
  try {
    document.cookie = 'token=; Max-Age=0; Path=/; SameSite=Lax';
  } catch {}
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
      timeout: DEFAULT_API_TIMEOUT_MS,
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
    err.timeoutMs = DEFAULT_API_TIMEOUT_MS;
    err.originalMessage = e?.message || msg;
    throw err;
  }
}

export const apiGet = (url, options) => apiRequest('GET', url, undefined, options);
export const apiPost = (url, data, options) => apiRequest('POST', url, data, options);
export const apiPut = (url, data, options) => apiRequest('PUT', url, data, options);
export const apiDelete = (url, options) => apiRequest('DELETE', url, undefined, options);
