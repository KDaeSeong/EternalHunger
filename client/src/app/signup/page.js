'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiPost } from '../../utils/api';
import '../../styles/Auth.css';

export default function SignupPage() {
  const [form, setForm] = useState({
    username: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  const setWarning = (nextMessage) => {
    setMessage(nextMessage);
    showToast({ tone: 'warning', message: nextMessage });
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (busy) return;

    if (form.password !== form.confirmPassword) {
      setWarning('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setWarning('이용약관과 개인정보 처리방침에 동의해주세요.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await apiPost('/auth/signup', {
        username: form.username,
        nickname: form.nickname,
        password: form.password,
        acceptTerms: form.acceptTerms,
        acceptPrivacy: form.acceptPrivacy,
      });

      showToast({ tone: 'success', message: '회원가입이 완료되었습니다. 로그인해주세요.' });
      router.push('/login');
    } catch (err) {
      const nextMessage = err?.message || '회원가입 중 오류가 발생했습니다.';
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
            <span className="logo-sub">케이의</span>
            <span className="logo-main">게임개발소</span>
          </div>

          <h2>회원가입</h2>
          <p className="auth-copy">
            캐릭터, 시뮬레이션 기록, 커뮤니티 활동을 저장할 계정을 만듭니다.
          </p>

          <form onSubmit={handleSignup} className="auth-form">
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
              placeholder="닉네임(선택)"
              value={form.nickname}
              disabled={busy}
              maxLength={20}
              autoComplete="nickname"
              onChange={(event) => setForm({ ...form, nickname: event.target.value })}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="비밀번호"
              required
              value={form.password}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="비밀번호 확인"
              required
              value={form.confirmPassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            />

            <div className="auth-consent-box">
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={form.acceptTerms}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, acceptTerms: event.target.checked })}
                />
                <span>
                  <Link href="/terms">이용약관</Link>에 동의합니다.
                </span>
              </label>
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={form.acceptPrivacy}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, acceptPrivacy: event.target.checked })}
                />
                <span>
                  <Link href="/privacy">개인정보 처리방침</Link>에 동의합니다.
                </span>
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? '가입 중...' : '가입하기'}
            </button>
          </form>

          {message ? (
            <div className="auth-message" role="status" aria-live="polite">
              {message}
            </div>
          ) : null}

          <div className="auth-footer">
            이미 계정이 있나요?
            <Link href="/login" className="auth-link">
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
