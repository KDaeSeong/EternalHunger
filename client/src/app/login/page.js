'use client';
import { useState } from 'react';
import Link from 'next/link';
import '../../styles/Auth.css'; // ★ 스타일 임포트
import { useRouter } from 'next/navigation';
import { apiPost, saveAuth } from '../../utils/api';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiPost('/auth/login', form);
      const token = res?.token;
      const user = res?.user;
      if (!token || !user) throw new Error('로그인 응답이 올바르지 않습니다.');

      saveAuth(token, user);
      setMessage(`${user.username}님, 환영합니다.`);
      router.replace('/');
    } catch (err) {
      setMessage(err.message || '로그인 실패');
      setBusy(false);
    }
};

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* 로고 섹션 */}
        <div className="auth-logo">
          <span className="logo-sub">ETERNAL</span>
          <span className="logo-main">HUNGER</span>
        </div>

        <h2>반갑습니다!</h2>
        <p style={{color:'#666', marginTop:'-10px'}}>시뮬레이션 결과를 저장하려면 로그인하세요.</p>

        {/* 폼 섹션 */}
        <form onSubmit={handleLogin} className="auth-form">
          <input 
            type="text" 
            className="auth-input" 
            placeholder="아이디" 
            required
            value={form.username}
            disabled={busy}
            autoComplete="username"
            onChange={e => setForm({...form, username: e.target.value})} 
          />
          <input 
            type="password" 
            className="auth-input" 
            placeholder="비밀번호" 
            required
            value={form.password}
            disabled={busy}
            autoComplete="current-password"
            onChange={e => setForm({...form, password: e.target.value})} 
          />
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? '로그인 중...' : '로그인'}</button>
        </form>
        {message ? (
          <div className="auth-message" role="status" aria-live="polite">{message}</div>
        ) : null}

        {/* 푸터 섹션 */}
        <div className="auth-footer">
          아직 계정이 없으신가요? 
          <Link href="/signup" className="auth-link">회원가입하기</Link>
        </div>
      </div>
    </div>
  );
}
