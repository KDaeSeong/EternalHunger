'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from './AdminNav';
import { getApiBase } from '../../../utils/api';

function normalizeToken(raw) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (v === 'undefined' || v === 'null') return null;
  return v;
}

function readToken() {
  try {
    return normalizeToken(
      localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('authToken')
    );
  } catch {
    return null;
  }
}

function hasCookie(name) {
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`));
  } catch {
    return false;
  }
}

function syncTokenToCookie(token) {
  const v = normalizeToken(token);
  if (!v) return;
  if (hasCookie('token')) return;

  const maxAge = 60 * 60 * 24 * 7; // 7일
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `token=${encodeURIComponent(v)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function extractIsAdmin(payload) {
  // 서버 응답 스키마가 확정이 아니라서, 흔한 케이스를 폭넓게 커버
  const v =
    payload?.isAdmin ??
    payload?.admin ??
    payload?.user?.isAdmin ??
    payload?.user?.admin ??
    payload?.data?.isAdmin ??
    payload?.data?.admin;

  if (typeof v === 'boolean') return v;

  const role =
    payload?.role ??
    payload?.user?.role ??
    payload?.data?.role ??
    payload?.userRole ??
    payload?.data?.userRole;

  if (typeof role === 'string' && role) {
    const r = role.toUpperCase();
    if (r.includes('ADMIN')) return true;
    return false; // role 값이 있는데 ADMIN이 아니면 일반 유저로 판단
  }

  return null; // 판단 불가
}

async function fetchUserInfo(token) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2500);

  try {
    const base = getApiBase();
    const candidates = [`${base}/user/me`, `${base}/user`];
    const headers = {};

    const v = normalizeToken(token);
    if (v) {
      headers.Authorization = v.startsWith('Bearer ') ? v : `Bearer ${v}`;
    }

    for (const url of candidates) {
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!res.ok) continue;

      let data = null;
      try {
        data = await res.json();
      } catch {
        // JSON이 아니더라도, 응답이 OK면 "로그인 상태"는 맞는 걸로 간주
        return { ok: true, data: null };
      }

      return { ok: true, data };
    }

    return { ok: false, data: null };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(t);
  }
}

export default function AdminShell({ children }) {
  const router = useRouter();
  // checking | allowed | blocked_login | blocked_admin
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let canceled = false;

    (async () => {
      // 1) localStorage 토큰이 있으면 쿠키로 동기화해서 Next proxy 가드도 통과하게 함
      const token = readToken();
      if (token) {
        try {
          syncTokenToCookie(token);
        } catch {}

        // 2) 가능하면 유저 정보를 받아서 admin 여부까지 확인 (스키마 없으면 판단 생략)
        const info = await fetchUserInfo(token);
        const isAdmin = extractIsAdmin(info.data);

        if (!canceled) {
          if (info.ok && isAdmin === false) setStatus('blocked_admin');
          else setStatus('allowed');
        }
        return;
      }

      // 3) 토큰이 없으면 쿠키 세션(/api/user*)을 확인
      const info = await fetchUserInfo(null);
      if (!canceled) {
        if (!info.ok) setStatus('blocked_login');
        else if (extractIsAdmin(info.data) === false) setStatus('blocked_admin');
        else setStatus('allowed');
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (status === 'blocked_login' || status === 'blocked_admin') router.replace('/');
  }, [status, router]);

  const shellStyle = { display: 'flex', minHeight: '100vh' };
  const sidebarStyle = {
    width: 240,
    padding: 16,
    borderRight: '1px solid rgba(255,255,255,0.08)',
    background: '#0b1220',
  };
  const mainStyle = { flex: 1, padding: 16 };

  if (status === 'checking') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>관리자 페이지 확인 중…</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>로그인/권한 상태를 확인하고 있어.</div>
      </div>
    );
  }

  if (status === 'blocked_login') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>로그인이 필요합니다.</div>
        <div style={{ marginTop: 8 }}>
          <Link href="/" style={{ textDecoration: 'underline' }}>
            메인으로 이동
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'blocked_admin') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>관리자 권한이 필요합니다.</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          계정이 관리자로 등록되어 있는지 확인해줘.
        </div>
        <div style={{ marginTop: 8 }}>
          <Link href="/" style={{ textDecoration: 'underline' }}>
            메인으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell" style={shellStyle}>
      <aside className="admin-sidebar" style={sidebarStyle}>
        <AdminNav />
      </aside>

      <main className="admin-main" style={mainStyle}>
        {children}
      </main>
    </div>
  );
}
