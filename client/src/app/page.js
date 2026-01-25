'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Home.css';

export default function Home() {
  const [rankings, setRankings] = useState({ wins: [], kills: [], points: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // ★ 로그아웃 함수
  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('token'); 
      localStorage.removeItem('user');  
      setUser(null);                   
      alert("로그아웃 되었습니다.");
      window.location.reload();        
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        // 1. 토큰 가져오기 (내 기록을 보려면 토큰 필수)
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        
        // 2. 데이터 요청
        const res = await axios.get('https://eternalhunger-e7z1.onrender.com/api/rankings', config);
        const data = res.data || [];

        // 3. ★ [중요] 서버 데이터(배열)를 화면에 맞는 모양(객체)으로 변환
        // (그냥 setRankings(res.data) 해버리면 wins, kills가 없어서 에러 납니다!)
        
        // (1) 최다 우승
        const wins = [...data].sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0)).slice(0, 3);
        // (2) 학살자
        const kills = [...data].sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0)).slice(0, 3);
        // (3) 레전드 (점수 계산: 우승*100 + 킬*10)
        const points = [...data].sort((a, b) => {
             const scoreA = (a.totalWins * 100) + (a.totalKills * 10);
             const scoreB = (b.totalWins * 100) + (b.totalKills * 10);
             return scoreB - scoreA;
        }).slice(0, 3);

        setRankings({ wins, kills, points });
        setLoading(false);

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  return (
    <main className="home-container">
      {/* 상단 네비게이션 */}
      <div className="top-nav">
        {user ? (
          <div className="user-info">
            <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp || 0})</span>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 로그아웃
            </button>
          </div>
        ) : (
          <div className="auth-btns">
            <Link href="/login" className="login-btn">🔑 로그인</Link>
            <Link href="/signup" className="signup-btn">📝 회원가입</Link>
          </div>
        )}
      </div>

      {/* 1. 메인 타이틀 */}
      <section className="hero-section">
        <div className="hero-logo-container">
            <span className="hero-logo-sub">PROJECT</span>
            <span className="hero-logo-main">ARENA</span>
        </div>
        <p className="main-desc">나만의 캐릭터, 나만의 시나리오로 펼쳐지는 배틀로얄 시뮬레이터</p>
      </section>

      {/* 2. 메뉴 카드 섹션 */}
      <section className="menu-grid">
        <Link href="/characters" className="menu-card">
            <div className="icon">👥</div>
            <h3>캐릭터 설정</h3>
            <p>참가할 선수들을 등록하고 관리합니다.</p>
        </Link>
        
        <Link href="/details" className="menu-card">
            <div className="icon">📊</div>
            <h3>상세 스탯</h3>
            <p>AI 분석 및 능력치 커스텀</p>
        </Link>

        <Link href="/events" className="menu-card">
            <div className="icon">📜</div>
            <h3>시나리오</h3>
            <p>게임에서 발생할 사건 사고 정의</p>
        </Link>

        <Link href="/modifiers" className="menu-card">
            <div className="icon">⚖️</div>
            <h3>게임 밸런스</h3>
            <p>확률 및 가중치 조절</p>
        </Link>
      </section>

      {/* 3. 게임 시작 버튼 */}
      <div className="start-btn-container">
        {user ? (
            <Link href="/simulation">
                <button className="start-btn">⚔️ 시뮬레이션 시작하기</button>
            </Link>
        ) : (
            <Link href="/login">
                <button className="start-btn" style={{background:'#999'}}>🔒 로그인 후 시작</button>
            </Link>
        )}
      </div>

      {/* 4. 명예의 전당 */}
      <section className="hall-of-fame">
        <h2 className="hof-title">🏆 명예의 전당 🏆</h2>
        
        {loading ? (
            <p style={{textAlign:'center', color:'#666'}}>데이터를 불러오는 중...</p>
        ) : (
            <div className="hof-grid">
                
                {/* 👑 최다 우승 */}
                <div className="hof-card">
                    <h3>👑 최다 우승</h3>
                    <ul>
                        {rankings.wins && rankings.wins.length > 0 ? rankings.wins.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val">{char.totalWins}회 우승</span>
                                </div>
                            </li>
                        )) : <li className="no-data">아직 우승자가 없습니다.</li>}
                    </ul>
                </div>

                {/* 💀 최다 킬 */}
                <div className="hof-card">
                    <h3>💀 학살자 (Kills)</h3>
                    <ul>
                        {rankings.kills && rankings.kills.length > 0 ? rankings.kills.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val" style={{color:'#ff5252'}}>
                                        {char.totalKills} 킬
                                    </span>
                                </div>
                            </li>
                        )) : <li className="no-data">아직 기록이 없습니다.</li>}
                    </ul>
                </div>

                {/* 💎 레전드 (LP) */}
                <div className="hof-card">
                    <h3>💎 레전드 (Points)</h3>
                    <ul>
                        {rankings.points && rankings.points.length > 0 ? rankings.points.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val" style={{color:'#7b1fa2'}}>
                                        {(char.totalWins * 100) + (char.totalKills * 10)} LP
                                    </span>
                                </div>
                            </li>
                        )) : <li className="no-data">아직 기록이 없습니다.</li>}
                    </ul>
                </div>

            </div>
        )}
      </section>

    </main>
  );
}