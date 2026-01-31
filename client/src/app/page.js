'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Home.css';
import { API_BASE } from '../utils/api';

export default function Home() {
  const [rankings, setRankings] = useState({ wins: [], kills: [], points: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

// 내 기록만 표시(명예의 전당: 최다 우승/최다 킬)
const myUsername = user?.username ?? null;
const pickMineTop3 = (list, scoreFn) => {
  if (!myUsername) return [];
  const arr = Array.isArray(list) ? list : [];
  const mine = arr.filter((x) => {
    const owner =
      x?.username ??
      x?.user?.username ??
      x?.ownerUsername ??
      x?.owner?.username ??
      x?.createdBy ??
      x?.playerUsername;
    return owner === myUsername;
  });
  return [...mine].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, 3);
};

const myWinsTop3 = pickMineTop3(rankings.wins, (x) => Number(x?.totalWins ?? x?.records?.totalWins ?? 0));
const myKillsTop3 = pickMineTop3(rankings.kills, (x) => Number(x?.totalKills ?? x?.records?.totalKills ?? 0));

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
        const res = await axios.get(`${API_BASE}/rankings`, config);
        const payload = res.data;

        // 서버(/api/rankings)는 { wins:[], kills:[], points:[] } 형태로 내려줍니다.
        // (과거에 배열을 내려주던 경우가 있을 수 있어, 배열도 호환 처리)
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const wins = Array.isArray(payload.wins) ? payload.wins : [];
          const kills = Array.isArray(payload.kills) ? payload.kills : [];
          const points = Array.isArray(payload.points) ? payload.points : [];
          setRankings({ wins, kills, points });
        } else {
          const data = Array.isArray(payload) ? payload : [];

          // (1) 최다 우승
          const wins = [...data]
            .sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0))
            .slice(0, 3);
          // (2) 학살자
          const kills = [...data]
            .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
            .slice(0, 3);
          // (3) 레전드 (점수 계산: 우승*100 + 킬*10)
          const points = [...data]
            .sort((a, b) => {
              const scoreA = (Number(a.totalWins) * 100) + (Number(a.totalKills) * 10);
              const scoreB = (Number(b.totalWins) * 100) + (Number(b.totalKills) * 10);
              return scoreB - scoreA;
            })
            .slice(0, 3);

          setRankings({ wins, kills, points });
        }
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

        <Link href="/board" className="menu-card">
            <div className="icon">🗣️</div>
            <h3>게시판</h3>
            <p>자유롭게 글을 작성하고 공유합니다.</p>
        </Link>

        {user?.isAdmin ? (
          <Link href="/admin" className="menu-card">
              <div className="icon">🛠️</div>
              <h3>관리자</h3>
              <p>아이템/맵/상점/특전 관리</p>
          </Link>
        ) : null}
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
                        {user ? (
                        myWinsTop3 && myWinsTop3.length > 0 ? myWinsTop3.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val">{(char.totalWins ?? char.records?.totalWins ?? 0)}회 우승</span>
                                </div>
                            </li>
                        )) : <li className="no-data">아직 내 우승 기록이 없습니다.</li>
                    ) : (
                        <li className="no-data">로그인 후 내 우승 기록을 확인할 수 있어요.</li>
                    )}
                    </ul>
                </div>

                {/* 💀 최다 킬 */}
                <div className="hof-card">
                    <h3>💀 학살자 (Kills)</h3>
                    <ul>
                        {user ? (
                        myKillsTop3 && myKillsTop3.length > 0 ? myKillsTop3.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val" style={{color:'#ff5252'}}>
                                        {(char.totalKills ?? char.records?.totalKills ?? 0)} 킬
                                    </span>
                                </div>
                            </li>
                        )) : <li className="no-data">아직 내 킬 기록이 없습니다.</li>
                    ) : (
                        <li className="no-data">로그인 후 내 킬 기록을 확인할 수 있어요.</li>
                    )}
                    </ul>
                </div>

                {/* 💎 레전드 (LP) */}
                <div className="hof-card">
                    <h3>💎 레전드 (Points)</h3>
                    <ul>
                        {rankings.points && rankings.points.length > 0 ? rankings.points.map((p, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{p.username ?? p.name ?? 'Unknown'}</span>
                                    <span className="rank-val" style={{color:'#7b1fa2'}}>
                                        {p.lp ?? ((Number(p.totalWins ?? p.records?.totalWins ?? 0) * 100) + (Number(p.totalKills ?? p.records?.totalKills ?? 0) * 10))} LP
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