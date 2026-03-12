'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import '../styles/Home.css';
import { AUTH_SYNC_EVENT, apiGet, clearAuth, getUser, updateStoredUser } from '../utils/api';
import { HOF_SYNC_EVENT, HOF_SYNC_KEY, readHallOfFameState, summarizeHallOfFameTop3 } from '../utils/hallOfFame';

export default function Home() {
  const [rankings, setRankings] = useState({ wins: [], kills: [], points: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myCharTop3, setMyCharTop3] = useState({ wins: [], kills: [] });

// 내 기록만 표시(명예의 전당: 최다 우승/최다 킬)
const myUsername = user?.username ?? null;
const myWinsTop3 = myCharTop3.wins;
const myKillsTop3 = myCharTop3.kills;

  useEffect(() => {
    const syncMyHallOfFame = () => {
      if (!myUsername) {
        setMyCharTop3({ wins: [], kills: [] });
        return;
      }
      const state = readHallOfFameState({ username: myUsername });
      setMyCharTop3(summarizeHallOfFameTop3(state));
    };

    syncMyHallOfFame();

    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (!event?.key) return;
      if (event.key === HOF_SYNC_KEY || event.key === `eh_hof_${myUsername}`) syncMyHallOfFame();
    };
    const onHofSync = () => syncMyHallOfFame();
    window.addEventListener('storage', onStorage);
    window.addEventListener(HOF_SYNC_EVENT, onHofSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(HOF_SYNC_EVENT, onHofSync);
    };
  }, [myUsername]);


  // ★ 로그아웃 함수
  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      clearAuth();
      setUser(null);                   
      alert("로그아웃 되었습니다.");
      window.location.reload();        
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncStoredUser = () => {
      const savedUser = getUser();
      setUser(savedUser || null);
    };

    const refreshHome = async () => {
      syncStoredUser();
      setLoading(true);
      try {
        const payload = await apiGet('/rankings');
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const wins = Array.isArray(payload.wins) ? payload.wins : [];
          const kills = Array.isArray(payload.kills) ? payload.kills : [];
          const points = Array.isArray(payload.points) ? payload.points : [];
          setRankings({ wins, kills, points });
        } else {
          const data = Array.isArray(payload) ? payload : [];
          const wins = [...data].sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0)).slice(0, 3);
          const kills = [...data].sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0)).slice(0, 3);
          const points = [...data]
            .sort((a, b) => (((Number(b.totalWins) * 100) + (Number(b.totalKills) * 10)) - ((Number(a.totalWins) * 100) + (Number(a.totalKills) * 10))))
            .slice(0, 3);
          setRankings({ wins, kills, points });
        }

        if (getUser()) {
          try {
            const me = await apiGet('/user/me');
            if (me && typeof me === 'object') {
              setUser(me);
              updateStoredUser((currentUser) => ({ ...(currentUser || {}), ...me }));
            }
          } catch (meErr) {
            if (Number(meErr?.status || 0) === 401 || Number(meErr?.status || 0) === 403) {
              clearAuth();
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    syncStoredUser();
    refreshHome();

    const onFocus = () => refreshHome();
    const onAuthSync = () => refreshHome();
    window.addEventListener('focus', onFocus);
    window.addEventListener(AUTH_SYNC_EVENT, onAuthSync);
    window.addEventListener(HOF_SYNC_EVENT, onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(AUTH_SYNC_EVENT, onAuthSync);
      window.removeEventListener(HOF_SYNC_EVENT, onFocus);
    };
  }, []);

  return (
    <main className="home-container">
      {/* 상단 네비게이션 */}
      <div className="top-nav">
        {user ? (
          <div className="user-info">
            <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp || 0} · Cr: {user.credits || 0} · 특전: {Array.isArray(user.perks) ? user.perks.length : 0})</span>
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
            <span className="hero-logo-sub">ETERNAL</span>
            <span className="hero-logo-main">HUNGER</span>
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
                    <h3>💀 학살자 (Kills/Assists)</h3>
                    <ul>
                        {user ? (
                        myKillsTop3 && myKillsTop3.length > 0 ? myKillsTop3.map((char, idx) => (
                            <li key={idx} className={`rank-${idx + 1}`}>
                                <span className="rank-badge">{idx + 1}</span>
                                <div className="rank-info">
                                    <span className="rank-name">{char.name}</span>
                                    <span className="rank-val" style={{color:'#ff5252'}}>
                                        {(char.totalKills ?? char.records?.totalKills ?? 0)} 킬 / {(char.totalAssists ?? char.records?.totalAssists ?? 0)} 어시
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