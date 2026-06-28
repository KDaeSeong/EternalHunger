'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../../styles/ERModifiers.css';
import { DEFAULT_RULESET_ID, RULESETS, normalizeRulesetId } from '../../utils/rulesets';
import { apiGet, apiPut, clearAuth, getToken, getUser } from '../../utils/api';
import { ER_STAT_FIELDS } from '../../utils/erStats';
import SiteHeader from '../../components/SiteHeader';

const DEFAULT_STAT_WEIGHTS = ER_STAT_FIELDS
  .filter((field) => !String(field.key).includes('Growth'))
  .reduce((acc, field) => {
    acc[field.key] = 1.0;
    return acc;
  }, {});

function normalizeStatWeights(value) {
  const src = value && typeof value === 'object' ? value : {};
  const out = { ...DEFAULT_STAT_WEIGHTS };
  Object.keys(out).forEach((key) => {
    const n = Number(src[key]);
    if (Number.isFinite(n)) out[key] = n;
  });
  return out;
}

export default function ModifiersPage() {
  // 스탯 가중치 상태
  const [weights, setWeights] = useState(DEFAULT_STAT_WEIGHTS);

  // 룰 프리셋(시뮬레이터 규칙 세트)
  const [rulesetId, setRulesetId] = useState(DEFAULT_RULESET_ID);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 유저 정보 및 설정 불러오기
  useEffect(() => {
    const fetchData = async () => {
      const userData = getUser();
      const token = getToken();
      
      if (userData) {
        setUser(userData);
      }

      // ★ [중요] 토큰을 가지고 내 설정을 불러옵니다.
      if (token) {
        try {
          const data = await apiGet('/settings');
          
          if (data && data.statWeights) {
            setWeights(normalizeStatWeights(data.statWeights));
          }

          if (data && data.rulesetId) {
            setRulesetId(normalizeRulesetId(data.rulesetId));
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
      clearAuth();
      setUser(null);
      window.location.reload();
    }
  };

  const handleChange = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  // 2. ★ [수정됨] 저장 함수 (토큰 포함 전송)
  const saveSettings = async () => {
    const token = getToken();
    
    if (!token) {
        alert("로그인이 필요한 기능입니다.");
        return;
    }

    if (!window.confirm("이 밸런스로 설정을 저장하시겠습니까?")) return;

    try {
      // 주소 변경: POST -> PUT
      // 헤더 추가: Authorization
      await apiPut('/settings', { statWeights: weights, rulesetId: normalizeRulesetId(rulesetId) });
      alert("💾 밸런스 설정이 저장되었습니다!");
      location.reload();
    } catch (err) {
      console.error(err);
      alert("저장 실패: " + (err.response?.data?.error || "서버 오류"));
    }
  };

  const statLabels = Object.fromEntries(
    ER_STAT_FIELDS
      .filter((field) => !String(field.key).includes('Growth'))
      .map((field) => [field.key, field.label])
  );

  return (
    <main className="modifiers-page-shell">
      <SiteHeader className="modifiers-site-header" />
      <header hidden aria-hidden="true">
        <section id="header-id1">
            <ul>
            <li>
                <Link href="/" className="logo-btn">
                <div className="text-logo">
                    <span className="logo-top">ETERNAL</span>
                    <span className="logo-main">HUNGER</span>
                </div>
                </Link>
            </li>
            
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers" style={{color:'#0288d1'}}>보정치 설정</Link></li>
            <li><Link href="/help">도움말</Link></li>
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
        {loading ? <p style={{textAlign:'center', padding:'50px'}}>설정 불러오는 중...</p> : (
        <>
          <div className="modifier-item">
            <div className="mod-label">
              <span>🎮 룰 프리셋 (시뮬레이터 규칙)</span>
              <span className="mod-value">{RULESETS[normalizeRulesetId(rulesetId)]?.label || normalizeRulesetId(rulesetId)}</span>
            </div>

            <select
              value={normalizeRulesetId(rulesetId)}
              onChange={(e) => setRulesetId(e.target.value)}
              disabled={!user}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid #ddd',
                marginTop: '10px'
              }}
            >
              {Object.values(RULESETS).map((rs) => (
                <option key={rs.id} value={rs.id}>{rs.label}</option>
              ))}
            </select>

            <div className="mod-desc">
              {normalizeRulesetId(rulesetId) === DEFAULT_RULESET_ID
                ? '⏱ 페이즈 버튼으로 진행하지만, 페이즈 내부는 틱(초) 기반으로 폭발 타이머/가젯/포그를 처리합니다.'
                : '🧪 기존 단순화 규칙입니다(틱 기반 처리 없음).'}
            </div>
          </div>

          {Object.keys(DEFAULT_STAT_WEIGHTS).map((key) => (
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
        </>
        )}
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
