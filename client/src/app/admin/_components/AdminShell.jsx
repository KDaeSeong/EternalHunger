'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from './AdminNav';
import { apiGet, clearAuth, getAnyToken, getUser, normalizeToken, saveAuth, updateStoredUser } from '../../../utils/api';

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

  const maxAge = 60 * 60 * 24 * 7;
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `token=${encodeURIComponent(v)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function extractIsAdmin(payload) {
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
    return false;
  }

  return null;
}

function extractUserPayload(payload) {
  if (payload && typeof payload === 'object') {
    if (payload.user && typeof payload.user === 'object') return payload.user;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    return payload;
  }
  return null;
}

async function fetchUserInfo(token) {
  const candidates = ['/user/me', '/user'];

  for (const path of candidates) {
    try {
      const data = await apiGet(path, { tokenOverride: token });
      return { ok: true, data };
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) {
        return { ok: false, unauthorized: true, data: null };
      }
    }
  }

  return { ok: false, unauthorized: false, data: null };
}

export default function AdminShell({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let canceled = false;

    (async () => {
      const token = getAnyToken();
      const storedUser = getUser();

      if (!token) {
        if (storedUser) clearAuth();
        if (!canceled) setStatus('blocked_login');
        return;
      }

      try {
        syncTokenToCookie(token);
      } catch {}

      if (storedUser?.isAdmin === false) {
        if (!canceled) setStatus('blocked_admin');
        return;
      }

      const info = await fetchUserInfo(token);
      if (!info.ok) {
        if (info.unauthorized) clearAuth();
        if (!canceled) setStatus('blocked_login');
        return;
      }

      const nextUser = extractUserPayload(info.data);
      if (nextUser && typeof nextUser === 'object') {
        if (storedUser) updateStoredUser(nextUser);
        else saveAuth(token, nextUser);
      }

      const isAdmin = extractIsAdmin(info.data ?? nextUser ?? storedUser);
      if (!canceled) {
        if (isAdmin === false) setStatus('blocked_admin');
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
