// client/src/app/details/page.js
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import '../../styles/ERDetails.css'; 

export default function DetailsPage() {
  const [characters, setCharacters] = useState([]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    // ★ 1. [보안] 토큰 검사 (문지기)
    const token = localStorage.getItem('token');
    if (!token) {
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = '/login'; // 강제 추방
        return;
    }

    // 화면이 켜진 뒤에만 localStorage에 접근 (에러 방지 핵심!)
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.reload(); // 깔끔하게 새로고침
    }
  };

  // 1. 서버에서 캐릭터 불러오기
  useEffect(() => {
    axios.get('http://localhost:5000/api/characters')
      .then(res => setCharacters(res.data))
      .catch(err => console.error("로드 실패:", err));
  }, []);

  // 2. 스탯 변경 함수 (수정됨: _id 사용)
  const handleStatChange = (id, statName, value) => {
    const newValue = parseInt(value) || 0;
    setCharacters(characters.map(char => {
      // ★ 여기가 수정되었습니다 (char._id)
      if (char._id === id) {
        const oldStats = char.stats || { str:0, agi:0, int:0, men:0, luk:0, dex:0, sht:0, end:0 };
        return { ...char, stats: { ...oldStats, [statName]: newValue } };
      }
      return char;
    }));
  };

  // 3. 저장 함수
  const saveChanges = async () => {
    if (!window.confirm("변경된 스탯 정보를 저장하시겠습니까?")) return;

    try {
      await axios.post('http://localhost:5000/api/characters/save', characters);
      alert("완벽하게 저장되었습니다!");
    } catch (err) {
      alert("저장 실패 ㅠㅠ");
    }
  };

  return (
    <main>
      <header>
        <section id="header-id1">
            <ul>
            {/* 1. 로고 */}
            <li>
                <Link href="/" className="logo-btn">
                <div className="text-logo">
                    <span className="logo-top">PROJECT</span>
                    <span className="logo-main">ARENA</span>
                </div>
                </Link>
            </li>
            
            {/* 2. 네비게이션 메뉴 */}
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            
            {/* 3. 게임 시작 버튼 (강조) */}
            <li><Link href="/simulation" style={{color:'#0288d1', fontWeight:'bold'}}>▶ 게임 시작</Link></li>

            {/* 4. ★ 우측 끝 유저 정보 (에러 방지 및 디자인 적용됨) */}
            <li className="auth-menu">
                {user ? (
                <div className="user-info">
                    <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp})</span>
                    <button className="logout-btn" onClick={handleLogout}>🚪 로그아웃</button>
                </div>
                ) : (
                <div className="auth-btns">
                    <Link href="/login" className="login-btn">🔑 로그인</Link>
                    <Link href="/signup" className="signup-btn">📝 회원가입</Link>
                </div>
                )}
            </li>
            </ul>
        </section>
        </header>

      {/* 심플해진 제목 */}
      <div className="page-header">
        <h1>캐릭터 상세 설정</h1>
        <p>AI가 분석한 스탯을 내 마음대로 수정해보세요.</p>
      </div>

      {/* ▼ 스탯 가이드 (새로 추가되는 부분) */}
      <div className="stat-guide-container">
        <h3>📊 스탯 기준표</h3>
        <div className="stat-guide-grid">
          <div className="guide-item rank-e">
            <span className="range">1 ~ 20</span>
            <span className="desc">일반인 (시민~운동선수)</span>
          </div>
          <div className="guide-item rank-c">
            <span className="range">21 ~ 40</span>
            <span className="desc">엘리트 (특수부대/천재)</span>
          </div>
          <div className="guide-item rank-a">
            <span className="range">41 ~ 60</span>
            <span className="desc">초인 (인간 한계 돌파)</span>
          </div>
          <div className="guide-item rank-s">
            <span className="range">61 ~ 80</span>
            <span className="desc">전설 (세계관 최강자)</span>
          </div>
          <div className="guide-item rank-ex">
            <span className="range">81 ~ 100</span>
            <span className="desc">신화 (규격 외 존재)</span>
          </div>
        </div>
      </div>
      {/* ▲ 여기까지 추가 */}

        <div id="detailsContainer">
            {characters.map((char) => (
            /* ★ 핵심 수정: key를 char._id로 변경 */
            <div key={char._id} className="stat-card">
                
                <div className="char-info">
                {/* 이미지가 없으면 기본 이미지 표시 */}
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <h3>{char.name || "이름없음"}</h3>
                <span className="gender-badge">{char.gender || "남"}</span>
                </div>

                <div className="stats-grid">
                {/* ▼ 스탯 한글 명칭 매핑 (수정됨) */}
                {[
                    { key: 'str', label: '근력 (STR)' },
                    { key: 'agi', label: '민첩 (AGI)' },
                    { key: 'int', label: '지능 (INT)' },
                    { key: 'men', label: '정신 (MEN)' },
                    { key: 'luk', label: '행운 (LUK)' },
                    { key: 'dex', label: '손재주 (DEX)' },
                    { key: 'sht', label: '사격 (SHT)' },
                    { key: 'end', label: '지구력 (END)' }
                ].map((stat) => (
                    <div key={stat.key} className="stat-item">
                    {/* 영어 대신 한글(약자) 라벨 표시 */}
                    <label>{stat.label}</label>
                    <input 
                        type="number" 
                        value={char.stats?.[stat.key] || 0}
                        onChange={(e) => handleStatChange(char._id, stat.key, e.target.value)}
                    />
                    </div>
                ))}
                </div>
            </div>
            ))}
        </div>
        <div className="main-save-container">
            <div className="main-save-btn" onClick={saveChanges}>
                <h1>💾 변경사항 저장</h1>
            </div>
        </div>
    </main>
  );
}