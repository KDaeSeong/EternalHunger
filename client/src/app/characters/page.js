// client/src/app/characters/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../../styles/ERCharacters.css'; 
import '../../styles/Home.css';
// 사용 무기 선택(캐릭터 기본 무기 타입)
// - 목록은 장비 자동생성 카탈로그와 동일하게 유지(표준화)
import { WEAPON_TYPES_KO, normalizeWeaponType } from '../../utils/equipmentCatalog';
import { TACTICAL_SKILL_OPTIONS_KO, normalizeSupportedTacSkill } from '../simulation/tacticalSkillTable';
import { apiGet, apiPost, clearAuth, getToken, getUser } from '../../utils/api';

const GOAL_GEAR_TIERS = [
  { value: 4, label: '영웅' },
  { value: 5, label: '전설' },
  { value: 6, label: '초월' },
];


export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);

  // 캐릭터 목표(장비 등급/전술 스킬) 모달
  const [configCharId, setConfigCharId] = useState(null);
  const [editGoalGearTier, setEditGoalGearTier] = useState(6);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');

  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    const userData = getUser();
    if (userData) setUser(userData);

    // ✅ 직접 axios.get을 쓰지 말고, 위에서 만든 fetchCharacters()를 실행하세요!
    fetchCharacters();
  }, []);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      clearAuth();
      setUser(null);
      window.location.reload(); // 깔끔하게 새로고침
    }
  };

 // 1. 서버에서 데이터 불러오기
    // 토큰을 Next.js API Route에서도 읽을 수 있게 쿠키로 동기화
  const syncTokenCookie = (token) => {
    try {
      document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
    } catch (e) {
      // 쿠키 저장 실패해도 UI는 계속 진행
    }
  };

  async function fetchCharacters() {
      const token = getToken();
      if (!token) return;
      try {
          const data = await apiGet('/characters');
          // 무기 타입 표준화(레거시 표기 보정 포함)
          setCharacters(((data || [])).map((c) => ({
            ...c,
            weaponType: normalizeWeaponType(c?.weaponType),
            goalGearTier: [4, 5, 6].includes(Number(c?.goalGearTier)) ? Number(c.goalGearTier) : 6,
            tacticalSkill: normalizeSupportedTacSkill(c?.tacticalSkill),
          })));
      } catch (err) { 
          console.error("데이터 로드 실패:", err); 
      }
  }
  // 2. 캐릭터 추가 (임시 ID 사용)
  const addCharacter = () => {
    const newChar = {
      id: Date.now(), // 임시 ID
      name: '',
      gender: '남',
      stats: { str:0, agi:0, int:0, men:0, luk:0, dex:0, sht:0, end:0 },
      image: null,
      previewImage: null,
      summary: '',
      weaponType: '',
      goalGearTier: 6,
      tacticalSkill: normalizeSupportedTacSkill('블링크'),
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

  const openConfigModal = (char) => {
    const id = char?._id || char?.id;
    if (!id) return;
    setConfigCharId(id);
    const tier = Number(char?.goalGearTier || 6);
    setEditGoalGearTier([4, 5, 6].includes(tier) ? tier : 6);
    const tac = normalizeSupportedTacSkill(char?.tacticalSkill);
    setEditTacticalSkill(tac || '블링크');
  };

  const closeConfigModal = () => setConfigCharId(null);

  const saveConfigModal = () => {
    if (!configCharId) return;
    updateCharacter(configCharId, 'goalGearTier', Number(editGoalGearTier || 6));
    updateCharacter(configCharId, 'tacticalSkill', normalizeSupportedTacSkill(editTacticalSkill));
    closeConfigModal();
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
      
      const data = await apiPost('/analyze', { text });
      
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
    const token = getToken();
    if (characters.length === 0) return alert("저장할 캐릭터가 없습니다!");

    if (!window.confirm("현재 캐릭터 목록을 저장하시겠습니까?\n(기존 데이터는 덮어씌워집니다)")) {
      return; 
    }
    
    try {
        if (!token) throw new Error('로그인이 필요합니다.');
        await apiPost('/characters/save', characters);
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
                  <span className="logo-top">ETERNAL</span>
                  <span className="logo-main">HUNGER</span>
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

                <label>
                  사용 무기:
                  <select
                    value={normalizeWeaponType(char.weaponType) || ''}
                    onChange={(e) => updateCharacter(realId, 'weaponType', normalizeWeaponType(e.target.value))}
                  >
                    <option value="">랜덤</option>
                    {WEAPON_TYPES_KO.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>

                <label>
                  목표/전술:
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openConfigModal(char)}
                      style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                    >
                      ⚙️ 설정
                    </button>
                    <span style={{ fontSize: 12, color: '#666' }}>
                      목표:{' '}{GOAL_GEAR_TIERS.find((x) => x.value === Number(char?.goalGearTier || 6))?.label || '초월'} / 전술:{' '}{String(char?.tacticalSkill || '블링크')}
                    </span>
                  </div>
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

      {configCharId ? (() => {
        const cur = characters.find((c) => String(c?._id || c?.id) === String(configCharId)) || null;
        const name = cur?.name || '캐릭터';
        return (
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) closeConfigModal(); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999,
            }}
          >
            <div style={{ width: 'min(560px, 100%)', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>⚙️ {name} 목표 세팅</h2>
                <button type="button" onClick={closeConfigModal} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#333' }}>목표 장비 등급</span>
                  <select value={String(editGoalGearTier)} onChange={(e) => setEditGoalGearTier(Number(e.target.value))}>
                    {GOAL_GEAR_TIERS.map((t) => (
                      <option key={t.value} value={String(t.value)}>{t.label}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#333' }}>전술 스킬 (시즌10 일반)</span>
                  <select value={String(editTacticalSkill)} onChange={(e) => setEditTacticalSkill(e.target.value)}>
                    {TACTICAL_SKILL_OPTIONS_KO.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={closeConfigModal} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={saveConfigModal} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #0288d1', background: '#0288d1', color: '#fff', cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          </div>
        );
      })() : null}

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