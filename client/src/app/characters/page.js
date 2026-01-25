// client/src/app/characters/page.js
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import '../../styles/ERCharacters.css'; 
import '../../styles/Home.css';

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));

    // ✅ 직접 axios.get을 쓰지 말고, 위에서 만든 fetchCharacters()를 실행하세요!
    fetchCharacters();
  }, []);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.reload(); // 깔끔하게 새로고침
    }
  };

 // 1. 서버에서 데이터 불러오기
  const fetchCharacters = async () => {
      const token = localStorage.getItem('token');
      try {
          const res = await axios.get('https://eternalhunger-e7z1.onrender.com/api/characters', {
              headers: { Authorization: `Bearer ${token}` } // ✅ 이 명찰이 핵심입니다!
          });
          setCharacters(res.data);
      } catch (err) { 
          console.error("데이터 로드 실패:", err); 
      }
  };
  // 2. 캐릭터 추가 (임시 ID 사용)
  const addCharacter = () => {
    const newChar = {
      id: Date.now(), // 임시 ID
      name: '',
      gender: '남',
      stats: { str:0, agi:0, int:0, men:0, luk:0, dex:0, sht:0, end:0 },
      image: null,
      previewImage: null,
      summary: ''
    };
    setCharacters([...characters, newChar]);
  };

  // 3. 캐릭터 삭제 (ID 호환성 수정)
  const removeCharacter = (targetId) => {
    setCharacters(characters.filter(char => {
      // DB 아이디(_id) 혹은 임시 아이디(id) 중 하나라도 맞으면 삭제
      const charId = char._id || char.id;
      return charId !== targetId;
    }));
  };

  // 4. 정보 업데이트 (ID 호환성 수정)
  const updateCharacter = (targetId, field, value) => {
    setCharacters(characters.map(char => {
      const charId = char._id || char.id;
      if (charId === targetId) {
        return { ...char, [field]: value };
      }
      return char;
    }));
  };

  // 5. 이미지 업로드
  const handleImageUpload = (e, targetId) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      updateCharacter(targetId, 'previewImage', reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 6. AI 분석 요청 (버그 수정: 한 번에 업데이트)
  const handleAiAnalyze = async (targetId) => {
    const text = prompt("캐릭터 설정(나무위키 텍스트 등)을 붙여넣으세요:");
    if (!text || text.length < 2) return;

    try {
      alert("🤖 AI가 분석 중입니다... (잠시만 기다려주세요)");
      
      const response = await axios.post('https://eternalhunger-e7z1.onrender.com/api/analyze', { text });
      const data = response.data;
      
      const charName = data.name || "이름없음";
      const gender = data.gender || "남";
      const newStats = data.stats || { str:0, agi:0, int:0, men:0, luk:0, dex:0, sht:0, end:0 };

      // ★ 핵심 수정: 하나씩 고치지 않고, '함수형 업데이트'로 한 번에 확실하게 적용!
      setCharacters(prevCharacters => prevCharacters.map(char => {
        // ID가 일치하는 캐릭터 찾기
        const charId = char._id || char.id;
        if (charId === targetId) {
          // 기존 정보에 새 분석 결과(이름, 성별, 스탯)를 덮어씌워서 반환
          return { 
            ...char, 
            name: charName, 
            gender: gender, 
            stats: newStats 
          };
        }
        return char; // 나머지 캐릭터는 그대로 유지
      }));
      
      // 알림 메시지 띄우기 (데이터 확인용)
      // JSON.stringify로 스탯을 문자열로 보여줌
      alert(`✅ 분석 완료!\n이름: ${charName}\n성별: ${gender}\n스탯: ${JSON.stringify(newStats, null, 2)}`);

    } catch (error) {
      console.error(error);
      alert("AI 연결 오류! 서버 터미널을 확인하세요.");
    }
  };

  // 7. 서버 저장 (Confirm 추가)
  const saveCharacters = async () => {
    const token = localStorage.getItem('token');
    if (characters.length === 0) return alert("저장할 캐릭터가 없습니다!");

    if (!window.confirm("현재 캐릭터 목록을 저장하시겠습니까?\n(기존 데이터는 덮어씌워집니다)")) {
      return; 
    }
    
    try {
        await axios.post('https://eternalhunger-e7z1.onrender.com/api/characters/save', characters, {
            headers: { Authorization: `Bearer ${token}` } // 저장할 때도 토큰 전송
        });
        alert("저장 완료!");
    } catch (error) { alert("저장 실패!"); }
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

      {/* 심플해진 헤더 */}
      <div className="page-header">
        <h1>캐릭터 설정</h1>
        <p>이곳에서는 캐릭터를 추가하고 관리할 수 있습니다.</p>
      </div>

      <div id="characterRowContainer">
        {characters.map((char) => {
          // ★ 핵심 수정: DB아이디(_id)가 없으면 임시아이디(id)를 사용
          const realId = char._id || char.id; 

          return (
            <div className="characterRowContainer2" key={realId}>
              <div className="characterRow">
                <button className="deleteChar" onClick={() => removeCharacter(realId)}>삭제</button>
                
                <div className="previewImage">
                  {char.previewImage ? (
                    <img src={char.previewImage} alt="미리보기" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : (
                    <span style={{margin:'auto', color:'#ccc'}}>이미지 없음</span>
                  )}
                </div>

                <label className="addImage">
                  📷 이미지 선택
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, realId)} 
                    style={{display:'none'}} 
                  />
                </label>
                
                <label>
                  이름:
                  <input 
                    type="text" 
                    value={char.name} 
                    onChange={(e) => updateCharacter(realId, 'name', e.target.value)}
                    placeholder="캐릭터 이름"
                  />
                </label>

                <label>
                  성별:
                  <select 
                    value={char.gender || '남'} 
                    onChange={(e) => updateCharacter(realId, 'gender', e.target.value)}
                  >
                    <option value="남">남</option>
                    <option value="여">여</option>
                    <option value="무성">무성</option>
                  </select>
                </label>

                <button 
                  type="button" 
                  className="ai-scouter-btn"
                  onClick={() => handleAiAnalyze(realId)}
                >
                   ⚡ AI 스카우터 (분석하기)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div id="addBtn">
        <button id="addChar" onClick={addCharacter}>+ 캐릭터 추가</button>
      </div>

      <div className="main-save-container">
        <div className="main-save-btn" onClick={saveCharacters}>
          <h1>💾 설정 저장하기</h1>
        </div>
      </div>
    </main>
  );
}