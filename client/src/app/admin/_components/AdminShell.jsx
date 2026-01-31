'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from './AdminNav';

function readToken() {
  try {
    return (
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
  if (!token) return;
  if (hasCookie('token')) return;

  const maxAge = 60 * 60 * 24 * 7; // 7일
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `token=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

async function checkCookieSession() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2500);

  try {
    const candidates = ['/api/user/me', '/api/user'];
    for (const url of candidates) {
      const res = await fetch(url, { credentials: 'include', signal: controller.signal });
      if (res.ok) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function AdminShell({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | allowed | blocked

  useEffect(() => {
    let canceled = false;

    (async () => {
      // 1) localStorage 토큰이 있으면 쿠키로 동기화해서 Next middleware 가드도 통과하게 함
      const token = readToken();
      if (token) {
        try {
          syncTokenToCookie(token);
        } catch {}
        if (!canceled) setStatus('allowed');
        return;
      }

      // 2) 토큰이 없으면 쿠키 세션(/api/user*)을 확인
      const ok = await checkCookieSession();
      if (!canceled) setStatus(ok ? 'allowed' : 'blocked');
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (status === 'blocked') router.replace('/');
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
        <div style={{ opacity: 0.75, marginTop: 6 }}>로그인 상태를 확인하고 있어.</div>
      </div>
    );
  }

  if (status === 'blocked') {
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
