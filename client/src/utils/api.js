// client/src/utils/api.js
// - 공통 API 유틸
// - 로컬 개발(Next localhost)에서는 기본적으로 로컬 서버(http://localhost:5000/api)를 사용하고,
//   배포/그 외 환경에서는 Render 서버를 기본값으로 사용합니다.
// - 필요하면 NEXT_PUBLIC_API_BASE로 강제 지정할 수 있습니다.

import axios from 'axios';

export function getApiBase() {
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env && String(env).trim()) return String(env).replace(/\/$/, '');

  // 브라우저(클라이언트)에서만 현재 호스트 기준으로 판단
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
  }

  // 기본(배포)
  return 'https://eternalhunger-e7z1.onrender.com/api';
}

export const API_BASE = getApiBase();

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
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
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fullUrl = `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;

  try {
    const res = await axios({
      method,
      url: fullUrl,
      data,
      headers,
    });
    return res.data;
  } catch (e) {
    // UI에서 메시지를 읽기 쉽게 만들기
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
