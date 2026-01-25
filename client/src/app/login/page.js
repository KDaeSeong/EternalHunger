'use client';
import { useState } from 'react';
import Link from 'next/link';
import '../../styles/Auth.css'; // ★ 스타일 임포트
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const res = await axios.post('https://eternalhunger-e7z1.onrender.com/api/auth/login', form);
        
        // 1. 데이터 저장
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        // 2. 알림 및 이동
        alert(`${res.data.user.username}님, 환영합니다!`);
        
        // ★ router.push('/')로 메인 화면으로 즉시 이동
        router.push('/'); 
        
        // 3. (선택사항) 메인 화면의 유저 상태 반영을 위해 새로고침 효과
        // Next.js 환경에 따라 router.refresh()를 쓰거나 아래처럼 처리합니다.
        setTimeout(() => window.location.reload(), 100); 

    } catch (err) {
        alert(err.response?.data?.error || "로그인 실패");
    }
};

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* 로고 섹션 */}
        <div className="auth-logo">
          <span className="logo-sub">PROJECT</span>
          <span className="logo-main">ARENA</span>
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
            onChange={e => setForm({...form, username: e.target.value})} 
          />
          <input 
            type="password" 
            className="auth-input" 
            placeholder="비밀번호" 
            required
            onChange={e => setForm({...form, password: e.target.value})} 
          />
          <button type="submit" className="btn-primary">로그인</button>
        </form>

        {/* 푸터 섹션 */}
        <div className="auth-footer">
          아직 계정이 없으신가요? 
          <Link href="/signup" className="auth-link">회원가입하기</Link>
        </div>
      </div>
    </div>
  );
}