'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from './AdminNav';
import { apiGet, clearAuth, getUser, saveAuth, updateStoredUser } from '../../../utils/api';

function extractIsAdmin(payload) {
  const value = payload?.isAdmin ?? payload?.admin ?? payload?.user?.isAdmin ?? payload?.user?.admin ?? payload?.data?.isAdmin ?? payload?.data?.admin;
  if (typeof value === 'boolean') return value;
  const role = payload?.role ?? payload?.user?.role ?? payload?.data?.role ?? payload?.userRole ?? payload?.data?.userRole;
  if (typeof role === 'string' && role) return role.toUpperCase().includes('ADMIN');
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

async function fetchUserInfo() {
  for (const path of ['/user/me', '/user']) {
    try {
      return { ok: true, data: await apiGet(path) };
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
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
      const storedUser = getUser();
      if (!storedUser) {
        if (!canceled) setStatus('blocked_login');
        return;
      }
      if (storedUser.isAdmin === false) {
        if (!canceled) setStatus('blocked_admin');
        return;
      }

      const info = await fetchUserInfo();
      if (!info.ok) {
        if (info.unauthorized) clearAuth();
        if (!canceled) setStatus('blocked_login');
        return;
      }

      const nextUser = extractUserPayload(info.data);
      if (nextUser && typeof nextUser === 'object') {
        if (storedUser) updateStoredUser(nextUser);
        else saveAuth(undefined, nextUser);
      }
      const isAdmin = extractIsAdmin(info.data ?? nextUser ?? storedUser);
      if (!canceled) setStatus(isAdmin === false ? 'blocked_admin' : 'allowed');
    })();
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (status === 'blocked_login' || status === 'blocked_admin') router.replace('/');
  }, [status, router]);

  if (status === 'checking') {
    return <div style={{ padding: 16 }}><div style={{ fontWeight: 800 }}>관리자 페이지 확인 중…</div><div style={{ opacity: 0.75, marginTop: 6 }}>로그인/권한 상태를 확인하고 있어.</div></div>;
  }
  if (status === 'blocked_login') {
    return <div style={{ padding: 16 }}><div style={{ fontWeight: 800 }}>로그인이 필요합니다.</div><div style={{ marginTop: 8 }}><Link href="/" style={{ textDecoration: 'underline' }}>메인으로 이동</Link></div></div>;
  }
  if (status === 'blocked_admin') {
    return <div style={{ padding: 16 }}><div style={{ fontWeight: 800 }}>관리자 권한이 필요합니다.</div><div style={{ opacity: 0.75, marginTop: 6 }}>계정이 관리자로 등록되어 있는지 확인해줘.</div><div style={{ marginTop: 8 }}><Link href="/" style={{ textDecoration: 'underline' }}>메인으로 이동</Link></div></div>;
  }

  return <div className="admin-shell"><aside className="admin-sidebar"><AdminNav /></aside><main className="admin-main">{children}</main></div>;
}
