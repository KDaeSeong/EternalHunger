'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import '../styles/Home.css';
import { apiGet } from '../utils/api';

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
        // 1) 서버에서 "내 랭킹"을 가져옵니다. (apiGet은 토큰/쿠키 처리를 공통 유틸에 위임)
const payload = await apiGet('/rankings');

        // 서버(/api/rankings)는 { wins:[], kills:[], points:[] } 형태로 내려줍니다.
        // (과거에 배열을 내려주던 경우가 있을 수 있어, 배열도 호환 처리)
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
let wins = Array.isArray(payload.wins) ? payload.wins : [];
let kills = Array.isArray(payload.kills) ? payload.kills : [];
let points = Array.isArray(payload.points) ? payload.points : [];

// 2) 로컬 백업(서버 저장/조회가 실패해도 화면에 "내 기록"이 남게)
try {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const username = me?.username || me?.id || 'guest';
  const key = `eh_hof_${username}`;
  const raw = localStorage.getItem(key);
  const local = raw ? JSON.parse(raw) : null;

  const toTop3 = (mapObj, fieldName) => {
    const entries = mapObj && typeof mapObj === 'object' ? Object.entries(mapObj) : [];
    return entries
      .map(([name, val]) => ({ name, [fieldName]: Number(val || 0) }))
      .sort((a, b) => (b[fieldName] || 0) - (a[fieldName] || 0))
      .slice(0, 3);
  };

  if (local && wins.length === 0 && local.winsByChar) wins = toTop3(local.winsByChar, 'totalWins');
  if (local && kills.length === 0 && local.killsByChar) kills = toTop3(local.killsByChar, 'totalKills');

  if (points.length === 0) {
    // 점수 = 우승*100 + 킬*10 (내 기록 기준)
    const winMap = (local && local.winsByChar) ? local.winsByChar : {};
    const killMap = (local && local.killsByChar) ? local.killsByChar : {};
    const names = new Set([...Object.keys(winMap || {}), ...Object.keys(killMap || {})]);
    points = [...names]
      .map((name) => {
        const totalWins = Number(winMap?.[name] || 0);
        const totalKills = Number(killMap?.[name] || 0);
        return { name, totalWins, totalKills };
      })
      .sort((a, b) => ((b.totalWins * 100 + b.totalKills * 10) - (a.totalWins * 100 + a.totalKills * 10)))
      .slice(0, 3);
  }
} catch (e) {
  console.error('local hof fallback failed', e);
}

setRankings({ wins, kills, points });
} else {
          const data = Array.isArray(payload) ? payload : [];

          // (1) 최다 우승
          let wins = [...data]
            .sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0))
            .slice(0, 3);
          // (2) 학살자
          let kills = [...data]
            .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
            .slice(0, 3);
          // (3) 레전드 (점수 계산: 우승*100 + 킬*10)
          let points = [...data]
            .sort((a, b) => {
              const scoreA = (Number(a.totalWins) * 100) + (Number(a.totalKills) * 10);
              const scoreB = (Number(b.totalWins) * 100) + (Number(b.totalKills) * 10);
              return scoreB - scoreA;
            })
            .slice(0, 3);

          
// 로컬 백업(서버 형식이 배열로만 올 때도 내 기록 유지)
try {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const username = me?.username || me?.id || 'guest';
  const key = `eh_hof_${username}`;
  const raw = localStorage.getItem(key);
  const local = raw ? JSON.parse(raw) : null;

  const toTop3 = (mapObj, fieldName) => {
    const entries = mapObj && typeof mapObj === 'object' ? Object.entries(mapObj) : [];
    return entries
      .map(([name, val]) => ({ name, [fieldName]: Number(val || 0) }))
      .sort((a, b) => (b[fieldName] || 0) - (a[fieldName] || 0))
      .slice(0, 3);
  };

  if (local && wins.length === 0 && local.winsByChar) wins = toTop3(local.winsByChar, 'totalWins');
  if (local && kills.length === 0 && local.killsByChar) kills = toTop3(local.killsByChar, 'totalKills');
} catch (e) {
  console.error('local hof fallback failed', e);
}

setRankings({ wins, kills, points });
        }
        setLoading(false);

      } catch (err) {
        console.error(err);
        setLoading(false);
// 서버 조회가 막혀도(403 등) 로컬 백업이라도 보여주기
try {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const username = me?.username || me?.id || 'guest';
  const key = `eh_hof_${username}`;
  const raw = localStorage.getItem(key);
  const local = raw ? JSON.parse(raw) : null;

  const toTop3 = (mapObj, fieldName) => {
    const entries = mapObj && typeof mapObj === 'object' ? Object.entries(mapObj) : [];
    return entries
      .map(([name, val]) => ({ name, [fieldName]: Number(val || 0) }))
      .sort((a, b) => (b[fieldName] || 0) - (a[fieldName] || 0))
      .slice(0, 3);
  };

  const wins = local?.winsByChar ? toTop3(local.winsByChar, 'totalWins') : [];
  const kills = local?.killsByChar ? toTop3(local.killsByChar, 'totalKills') : [];
  setRankings({ wins, kills, points: [] });
} catch (e) {
  setRankings({ wins: [], kills: [], points: [] });
}
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