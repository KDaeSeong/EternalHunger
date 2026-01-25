// client/src/app/signup/page.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import '../../styles/Auth.css'; // 이전 단계에서 만든 CSS 재사용

export default function SignupPage() {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // 간단한 비밀번호 확인 로직
    if (form.password !== form.confirmPassword) {
      alert("비밀번호가 일치하지 않습니다!");
      return;
    }

    try {
      // 2. 서버(백엔드)로 데이터 전송
      // router.post 가 아니라 axios.post 를 써야 합니다!
      const response = await axios.post('https://eternalhunger-e7z1.onrender.com/api/auth/signup', {
        username: form.username,
        password: form.password
      });

      alert("회원가입 성공! 로그인 페이지로 이동합니다.");
      router.push('/login');
    } catch (err) {
      // 에러 메시지가 있으면 출력 (예: 아이디 중복 등)
      alert(err.response?.data?.error || "회원가입 중 오류가 발생했습니다.");
    }

    
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* 로고 섹션 (메인 화면과 동일한 스타일) */}
        <div className="auth-logo">
          <span className="logo-sub">PROJECT</span>
          <span className="logo-main">ARENA</span>
        </div>

        <h2>새로운 참가자 등록</h2>
        <p style={{color:'#666', marginTop:'-10px'}}>프로젝트 아레나의 세계에 오신 것을 환영합니다.</p>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSignup} className="auth-form">
          <input 
            type="text" 
            className="auth-input" 
            placeholder="사용할 아이디" 
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
          <input 
            type="password" 
            className="auth-input" 
            placeholder="비밀번호 확인" 
            required
            onChange={e => setForm({...form, confirmPassword: e.target.value})} 
          />
          <button type="submit" className="btn-primary">가입하기</button>
        </form>

        {/* 로그인 페이지로 이동 */}
        <div className="auth-footer">
          이미 계정이 있으신가요? 
          <Link href="/login" className="auth-link">로그인하러 가기</Link>
        </div>
      </div>
    </div>
  );
}