// client/src/utils/api.js
// - 공통 API 유틸
// - 기본은 NEXT_PUBLIC_API_BASE(있으면) > localStorage(EH_API_BASE) > 환경에 따른 기본값
// - localStorage(EH_API_BASE)는 "http://localhost:5000" 처럼 /api 없는 값도 허용

import axios from 'axios';

export function normalizeApiBase(raw) {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  // 이미 /api로 끝나면 그대로
  if (v.endsWith('/api')) return v;
  return `${v}/api`;
}

export function getApiBase() {
  // 1) env가 있으면 최우선(배포용)
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env && String(env).trim()) return normalizeApiBase(env);

  // 2) 브라우저라면 localStorage(EH_API_BASE) 우선
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('EH_API_BASE');
      if (saved && String(saved).trim()) return normalizeApiBase(saved);
    } catch {}

    // 3) 로컬 개발 기본값
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000/api';
  }

  // 4) 기본(배포)
  return 'https://eternalhunger-e7z1.onrender.com/api';
}

// 하위 호환용(가능하면 apiRequest/apiGet을 쓰세요)
export const API_BASE = getApiBase();

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function isAdmin() {
  const u = getUser();
  return Boolean(u?.isAdmin);
}

export async function apiRequest(method, url, data) {
  const token = getToken();
  const headers = token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {};

  const base = getApiBase();
  const fullUrl = `${base}${url.startsWith('/') ? url : `/${url}`}`;

  try {
    const res = await axios({ method, url: fullUrl, data, headers });
    return res.data;
  } catch (e) {
    const msg = e?.response?.data?.error || e?.response?.data?.message || e.message || '요청 실패';
    const err = new Error(msg);
    err.response = e?.response;
    throw err;
  }
}

export const apiGet = (url) => apiRequest('GET', url);
export const apiPost = (url, data) => apiRequest('POST', url, data);
export const apiPut = (url, data) => apiRequest('PUT', url, data);
export const apiDelete = (url) => apiRequest('DELETE', url);
