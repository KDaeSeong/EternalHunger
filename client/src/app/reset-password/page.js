'use client';

import Link from 'next/link';
import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiPost } from '../../utils/api';
import '../../styles/Auth.css';

export default function ResetPasswordPage() {
  const [form, setForm] = useState({
    username: '',
    recoveryCode: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const { showToast } = useToast();

  const setWarning = (nextMessage) => {
    setMessage(nextMessage);
    showToast({ tone: 'warning', message: nextMessage });
  };

  const handleReset = async (event) => {
    event.preventDefault();
    if (busy) return;

    const username = String(form.username || '').trim();
    const recoveryCode = String(form.recoveryCode || '').trim();
    const newPassword = String(form.newPassword || '');
    const confirmPassword = String(form.confirmPassword || '');

    if (!username || !recoveryCode || !newPassword || !confirmPassword) {
      setWarning('아이디, 복구 코드, 새 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      setWarning('새 비밀번호는 6~72자로 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setWarning('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setBusy(true);
    setMessage('');
    setSuccess(false);
    try {
      const res = await apiPost('/auth/reset-password', { username, recoveryCode, newPassword }, { timeoutMs: 20000 });
      const nextMessage = res?.message || '비밀번호를 재설정했습니다. 새 비밀번호로 로그인해주세요.';
      setForm({ username, recoveryCode: '', newPassword: '', confirmPassword: '' });
      setMessage(nextMessage);
      setSuccess(true);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '비밀번호 재설정에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <SiteHeader />
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="logo-sub">케이의</span>
            <span className="logo-main">게임개발소</span>
          </div>

          <h2>비밀번호 재설정</h2>
          <p className="auth-copy">
            계정 설정에서 발급한 복구 코드로 새 비밀번호를 설정합니다.
          </p>

          <form onSubmit={handleReset} className="auth-form">
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
              type="text"
              className="auth-input"
              placeholder="복구 코드"
              required
              value={form.recoveryCode}
              disabled={busy}
              autoComplete="one-time-code"
              onChange={(event) => setForm({ ...form, recoveryCode: event.target.value.toUpperCase() })}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="새 비밀번호"
              required
              minLength={6}
              maxLength={72}
              value={form.newPassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="새 비밀번호 확인"
              required
              minLength={6}
              maxLength={72}
              value={form.confirmPassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? '재설정 중...' : '비밀번호 재설정'}
            </button>
          </form>

          {message ? (
            <div className={`auth-message ${success ? 'success' : ''}`} role="status" aria-live="polite">
              {message}
            </div>
          ) : null}

          <div className="auth-footer">
            새 비밀번호가 준비됐나요?
            <Link href="/login" className="auth-link">
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
