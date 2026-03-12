// client/src/app/details/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../../styles/ERDetails.css'; 
import { TACTICAL_SKILL_OPTIONS_KO, normalizeSupportedTacSkill } from '../simulation/tacticalSkillTable';
import { apiGet, apiPost, clearAuth, getToken, getUser } from '../../utils/api';

const GOAL_GEAR_TIERS = [
  { value: 4, label: '영웅' },
  { value: 5, label: '전설' },
  { value: 6, label: '초월' },
];

const LOADOUT_TIERS = [
  { key: 'hero', label: '영웅' },
  { key: 'legend', label: '전설' },
  { key: 'transcend', label: '초월' },
];

const LOADOUT_SLOTS = [
  { key: 'weaponKey', label: '무기', slot: 'weapon' },
  { key: 'headKey', label: '머리', slot: 'head' },
  { key: 'clothesKey', label: '옷', slot: 'clothes' },
  { key: 'armKey', label: '팔', slot: 'arm' },
  { key: 'shoesKey', label: '신발', slot: 'shoes' },
];

const EMPTY_LOADOUTS = {
  hero: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
  legend: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
  transcend: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
};

function coerceLoadouts(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = JSON.parse(JSON.stringify(EMPTY_LOADOUTS));
  for (const t of LOADOUT_TIERS) {
    const tierObj = src?.[t.key] && typeof src[t.key] === 'object' ? src[t.key] : {};
    for (const s of LOADOUT_SLOTS) {
      const v = tierObj?.[s.key];
      out[t.key][s.key] = typeof v === 'string' ? v : '';
    }
  }
  return out;
}

export default function DetailsPage() {
  const [characters, setCharacters] = useState([]);

  const [configCharId, setConfigCharId] = useState(null);
  const [editGoalGearTier, setEditGoalGearTier] = useState(6);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [editGoalLoadouts, setEditGoalLoadouts] = useState(EMPTY_LOADOUTS);
  const [equipList, setEquipList] = useState([]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    // ★ 1. [보안] 토큰 검사 (문지기)
    const token = getToken();
    if (!token) {
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = '/login'; // 강제 추방
        return;
    }

    // 화면이 켜진 뒤에만 localStorage에 접근 (에러 방지 핵심!)
    const userData = getUser();
    if (userData) {
      setUser(userData);
    }
  }, []);

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      clearAuth();
      setUser(null);
      window.location.reload(); // 깔끔하게 새로고침
    }
  };

  // 1. 서버에서 캐릭터 불러오기
  useEffect(() => {
    const token = getToken(); // 토큰 가져오기
    if (!token) return;
    apiGet('/characters')
      .then(data => setCharacters(((data || [])).map((c) => ({
        ...c,
        goalGearTier: [4, 5, 6].includes(Number(c?.goalGearTier)) ? Number(c.goalGearTier) : 6,
        tacticalSkill: normalizeSupportedTacSkill(c?.tacticalSkill),
      }))))
      .catch(err => console.error("로드 실패:", err));
  }, []);

  const openConfigModal = (char) => {
    const id = char?._id;
    if (!id) return;
    setConfigCharId(id);
    const tier = Number(char?.goalGearTier || 6);
    setEditGoalGearTier([4, 5, 6].includes(tier) ? tier : 6);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill));
    setEditGoalLoadouts(coerceLoadouts(char?.goalLoadouts));
  };

  const closeConfigModal = () => setConfigCharId(null);

  useEffect(() => {
    if (!configCharId) return;
    if (equipList.length > 0) return;
    const token = getToken();
    if (!token) return;
    apiGet('/items/equipment-list').then((data) => {
      setEquipList(Array.isArray(data) ? data : []);
    }).catch(() => {
      setEquipList([]);
    });
  }, [configCharId, equipList.length]);

  const updateLoadout = (tierKey, slotKey, value) => {
    setEditGoalLoadouts((prev) => ({
      ...prev,
      [tierKey]: { ...(prev?.[tierKey] || {}), [slotKey]: String(value || '') }
    }));
  };

  const saveConfigModal = () => {
    if (!configCharId) return;
    setCharacters((prev) => prev.map((c) => {
      if (String(c?._id) !== String(configCharId)) return c;
      return {
        ...c,
        goalGearTier: Number(editGoalGearTier || 6),
        tacticalSkill: normalizeSupportedTacSkill(editTacticalSkill),
        goalLoadouts: coerceLoadouts(editGoalLoadouts),
      };
    }));
    closeConfigModal();
  };

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
  const token = getToken();
  if (!window.confirm("변경된 스탯 정보를 저장하시겠습니까?")) return;

  try {
    // 세 번째 인자로 헤더를 넣어줍니다.
    if (!token) throw new Error('로그인이 필요합니다.');
    await apiPost('/characters/save', characters);
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

                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    목표: {GOAL_GEAR_TIERS.find((t) => t.value === Number(char?.goalGearTier || 6))?.label || '초월'} / 전술: {String(char?.tacticalSkill || '블링크')}
                  </div>
                  <button
                    type="button"
                    onClick={() => openConfigModal(char)}
                    style={{ padding: '8px 10px', borderRadius: 12, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                  >
                    ⚙️ 목표/전술 설정
                  </button>
                </div>
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

        {configCharId ? (() => {
          const cur = characters.find((c) => String(c?._id) === String(configCharId)) || null;
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

                  <div style={{ borderTop: '1px solid #eee', paddingTop: 10, display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 13, color: '#333' }}>목표 장비 세팅 (등급별)</div>
                    {LOADOUT_TIERS.map((t) => (
                      <div key={t.key} style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t.label}</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {LOADOUT_SLOTS.map((s) => {
                            const options = equipList.filter((x) => String(x?.equipSlot || '') === s.slot);
                            const val = String(editGoalLoadouts?.[t.key]?.[s.key] || '');
                            return (
                              <label key={s.key} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#444' }}>{s.label}</span>
                                <select value={val} onChange={(e) => updateLoadout(t.key, s.key, e.target.value)}>
                                  <option value="">(미지정)</option>
                                  {options.map((o) => (
                                    <option key={o.itemKey} value={o.itemKey}>
                                      {o.name}{o.tier ? ` (T${o.tier})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={closeConfigModal} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>취소</button>
                  <button type="button" onClick={saveConfigModal} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #0288d1', background: '#0288d1', color: '#fff', cursor: 'pointer' }}>적용</button>
                </div>
              </div>
            </div>
          );
        })() : null}
    </main>
  );
}