'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import '../../styles/Auth.css';
import { apiPost, saveAuth } from '../../utils/api';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  const handleLogin = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage('');
    try {
      const res = await apiPost('/auth/login', form);
      const token = res?.token;
      const user = res?.user;
      if (!token || !user) throw new Error('로그인 응답이 올바르지 않습니다.');

      saveAuth(token, user);
      showToast({ tone: 'success', message: `${user.nickname || user.username || '사용자'}님, 환영합니다.` });
      router.replace('/');
    } catch (err) {
      const nextMessage = err?.message || '로그인에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <SiteHeader />
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="logo-sub">ETERNAL</span>
            <span className="logo-main">HUNGER</span>
          </div>

          <h2>로그인</h2>
          <p style={{ color: '#666', marginTop: '-10px' }}>
            시뮬레이션 결과와 운영 데이터를 계정에 저장합니다.
          </p>

          <form onSubmit={handleLogin} className="auth-form">
            <input
              type="text"
              className="auth-input"
              placeholder="아이디"
              required
              value={form.username}
              disabled={busy}
              autoComplete="username"
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="비밀번호"
              required
              value={form.password}
              disabled={busy}
              autoComplete="current-password"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {message ? (
            <div className="auth-message" role="status" aria-live="polite">
              {message}
            </div>
          ) : null}

          <div className="auth-footer">
            아직 계정이 없으신가요?
            <Link href="/signup" className="auth-link">
              회원가입하기
            </Link>
          </div>
          <div className="auth-footer">
            비밀번호를 잊으셨나요?
            <Link href="/reset-password" className="auth-link">
              복구 코드로 재설정
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
