'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import '../../styles/ERModifiers.css';

export default function ModifiersPage() {
  // 스탯 가중치 상태
  const [weights, setWeights] = useState({
    str: 1.0, agi: 1.0, int: 1.0, men: 1.0,
    luk: 1.0, dex: 1.0, sht: 1.0, end: 1.0
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 유저 정보 및 설정 불러오기
  useEffect(() => {
    const fetchData = async () => {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (userData) {
        setUser(JSON.parse(userData));
      }

      // ★ [중요] 토큰을 가지고 내 설정을 불러옵니다.
      if (token) {
        try {
          const res = await axios.get('http://localhost:5000/api/settings', {
            headers: { Authorization: `Bearer ${token}` } 
          });
          
          if (res.data && res.data.statWeights) {
            setWeights(res.data.statWeights);
          }
        } catch (err) {
          console.error("설정 로드 실패:", err);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.reload();
    }
  };

  const handleChange = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  // 2. ★ [수정됨] 저장 함수 (토큰 포함 전송)
  const saveSettings = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert("로그인이 필요한 기능입니다.");
        return;
    }

    if (!window.confirm("이 밸런스로 설정을 저장하시겠습니까?")) return;

    try {
      // 주소 변경: POST -> PUT
      // 헤더 추가: Authorization
      await axios.put('http://localhost:5000/api/settings', 
        { statWeights: weights }, 
        { headers: { Authorization: `Bearer ${token}` } } 
      );
      alert("💾 밸런스 설정이 저장되었습니다!");
      location.reload();
    } catch (err) {
      console.error(err);
      alert("저장 실패: " + (err.response?.data?.error || "서버 오류"));
    }
  };

  const statLabels = {
    str: '근력 (공격력)', agi: '민첩 (선공권)', int: '지능 (변수창출)', men: '정신 (저항력)',
    luk: '행운 (생존변수)', dex: '손재주 (정확도)', sht: '사격 (견제력)', end: '지구력 (방어력)'
  };

  return (
    <main>
      <header>
        <section id="header-id1">
            <ul>
            <li>
                <Link href="/" className="logo-btn">
                <div className="text-logo">
                    <span className="logo-top">PROJECT</span>
                    <span className="logo-main">ARENA</span>
                </div>
                </Link>
            </li>
            
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers" style={{color:'#0288d1'}}>보정치 설정</Link></li>
            <li><Link href="/simulation" style={{fontWeight:'bold'}}>▶ 게임 시작</Link></li>

            <li className="auth-menu">
                {user ? (
                <div className="user-info">
                    <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp || 0})</span>
                    <button className="logout-btn" onClick={handleLogout}>🚪 로그아웃</button>
                </div>
                ) : (
                <div className="auth-btns">
                    <Link href="/login" className="login-btn">🔑 로그인</Link>
                </div>
                )}
            </li>
            </ul>
        </section>
        </header>

      <div className="page-header">
        <h1>게임 밸런스 / 보정치 설정</h1>
        <p>각 스탯이 생존과 전투에 미치는 <b>영향력(가중치)</b>을 조절합니다.</p>
        <p style={{fontSize: '0.9rem', color: '#888'}}>
            {user ? "설정을 저장하면 계정에 기록되며 다음 게임부터 적용됩니다." : "⚠️ 로그인이 필요합니다."}
        </p>
      </div>

      <div className="modifiers-container">
        {loading ? <p style={{textAlign:'center', padding:'50px'}}>설정 불러오는 중...</p> : 
         Object.keys(weights).map((key) => (
          <div key={key} className="modifier-item">
            <div className="mod-label">
              <span>{statLabels[key] || key.toUpperCase()}</span>
              <span className="mod-value">{weights[key]}x</span>
            </div>
            
            <input 
              type="range" 
              min="0" max="3.0" step="0.1"
              value={weights[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="mod-slider"
              disabled={!user} 
            />
            
            <div className="mod-desc">
              {weights[key] > 1.5 ? "🔥 영향력 매우 높음" : 
               weights[key] < 0.5 ? "💨 영향력 미미함" : "✨ 적절함"}
            </div>
          </div>
        ))}
      </div>
        
        <div className="main-save-container">
            {user ? (
                <div className="main-save-btn" onClick={saveSettings}>
                    <h1>💾 밸런스 저장</h1>
                </div>
            ) : (
                <div className="main-save-btn" style={{background:'#ccc', cursor:'not-allowed'}}>
                    <h1>🔒 로그인 필요</h1>
                </div>
            )}
        </div>
    </main>
  );
}