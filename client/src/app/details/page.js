// client/src/app/details/page.js
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import '../../styles/ERDetails.css'; 
import { normalizeSupportedTacSkill } from '../simulation/tacticalSkillTable';
import { apiGet, apiGetCached, apiPost, clearApiGetCache, getToken } from '../../utils/api';
import { compactCharactersForSave, findCharacterSaveMismatches } from '../../utils/characterPayload';
import { ER_STAT_FIELDS, normalizeErStats } from '../../utils/erStats';
import SiteHeader from '../../components/SiteHeader';
import DetailsGoalConfigModal from './_components/DetailsGoalConfigModal';
import {
  EMPTY_LOADOUTS,
  coerceLoadouts,
  formatSaveMismatchMessage,
  getGoalGearTierLabel,
  loadCharactersAfterSave,
  normalizeDetailsCharacterList,
  syncTokenCookie,
} from './_lib/detailsPageRuntime';
import { useModalBackdropClose } from '../_lib/useModalBackdropClose';

export default function DetailsPage() {
  const [characters, setCharacters] = useState([]);

  const [configCharId, setConfigCharId] = useState(null);
  const [editGoalGearTier, setEditGoalGearTier] = useState(6);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [editGoalLoadouts, setEditGoalLoadouts] = useState(EMPTY_LOADOUTS);
  const [equipList, setEquipList] = useState([]);
  const [statModalCharId, setStatModalCharId] = useState(null);
  const { handleBackdropPointerDown, handleBackdropPointerUp } = useModalBackdropClose();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      alert('로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.');
      window.location.href = '/login';
      return;
    }
    syncTokenCookie(token);
  }, []);
  // 1. 서버에서 캐릭터 불러오기
  useEffect(() => {
    const token = getToken(); // 토큰 가져오기
    if (!token) return;
    apiGetCached('/characters?view=stats', { ttlMs: 8000, timeoutMs: 20000 })
      .then(data => setCharacters(normalizeDetailsCharacterList(data)))
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
  const closeStatModal = () => setStatModalCharId(null);

  useEffect(() => {
    if (!configCharId) return;
    if (equipList.length > 0) return;
    const token = getToken();
    if (!token) return;
    apiGet('/items/equipment-list', { timeoutMs: 20000 }).then((data) => {
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
    const newValue = Number(value);
    setCharacters((prev) => prev.map(char => {
      // ★ 여기가 수정되었습니다 (char._id)
      if (char._id === id) {
        const oldStats = normalizeErStats(char.stats);
        return { ...char, stats: normalizeErStats({ ...oldStats, [statName]: Number.isFinite(newValue) ? newValue : 0 }) };
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
    const payload = compactCharactersForSave(characters, { omitPreviewImages: true });
    const result = await apiPost('/characters/save', payload, { timeoutMs: 30000 });
    clearApiGetCache('/characters');
    if (Array.isArray(result?.missingIds) && result.missingIds.length > 0) {
      throw new Error('일부 캐릭터를 찾을 수 없습니다. 새로고침 후 다시 저장해주세요.');
    }
    if (result?.receivedCount !== undefined) {
      const receivedCount = Number(result.receivedCount || 0);
      const appliedCount = Number(result.updatedCount || 0) + Number(result.createdCount || 0);
      if (receivedCount !== payload.length || appliedCount !== payload.length) {
        throw new Error(`저장 반영 건수가 맞지 않습니다. 요청 ${payload.length}명 / 반영 ${appliedCount}명`);
      }
    }
    const savedCharacters = await loadCharactersAfterSave(result);
    const normalizedSaved = normalizeDetailsCharacterList(savedCharacters);
    if (normalizedSaved.length !== payload.length) {
      throw new Error(`저장 후 캐릭터 수가 맞지 않습니다. 요청 ${payload.length}명 / 저장 ${normalizedSaved.length}명`);
    }
    const mismatches = findCharacterSaveMismatches(payload, normalizedSaved, { saveResults: result?.saveResults });
    if (mismatches.length > 0) {
      throw new Error(formatSaveMismatchMessage(mismatches));
    }
    setCharacters(normalizedSaved);
    alert("완벽하게 저장되었습니다!");
  } catch (err) {
    console.error(err);
    const status = Number(err?.status || err?.response?.status || 0);
    alert(status === 413 ? '저장 데이터가 너무 큽니다. 이미지 용량을 줄인 뒤 다시 시도해주세요.' : `저장 실패: ${err?.message || '서버 오류'}`);
  }
};

  return (
    <main className="details-page-shell">
      <SiteHeader className="details-site-header" />

      {/* 심플해진 제목 */}
      <div className="page-header">
        <div className="page-header-row">
          <div className="page-header-copy">
            <h1>캐릭터 상세 설정</h1>
            <p>AI가 분석한 스탯을 내 마음대로 수정해보세요.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="page-header-action-btn primary" onClick={saveChanges}>
              변경사항 저장
            </button>
          </div>
        </div>
      </div>

      {/* ▼ 스탯 가이드 (새로 추가되는 부분) */}
      <div className="stat-guide-container">
        <h3>📊 스탯 기준표</h3>
        <div className="stat-guide-grid">
          <div className="guide-item rank-e">
            <span className="range">Lv.1 ~ 20</span>
            <span className="desc">모든 캐릭터는 1레벨 시작, 숙련도 누적으로 성장</span>
          </div>
          <div className="guide-item rank-c">
            <span className="range">체력 / 성장 체력</span>
            <span className="desc">레벨이 오를 때 최대 체력과 생존력이 증가</span>
          </div>
          <div className="guide-item rank-a">
            <span className="range">공격력 / 스킬 증폭</span>
            <span className="desc">무기 숙련도와 성장 스탯이 전투 피해에 반영</span>
          </div>
          <div className="guide-item rank-s">
            <span className="range">방어력 / 공격속도</span>
            <span className="desc">피해 감소, 교전 템포, 무기 스킬 발동에 영향</span>
          </div>
          <div className="guide-item rank-ex">
            <span className="range">사거리 / 시야</span>
            <span className="desc">선공, 추격, 오브젝트 접근 판단에 사용</span>
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
                <Image
                  src={char.previewImage || '/Images/default_image.png'}
                  alt={char.name || '캐릭터 이미지'}
                  width={96}
                  height={96}
                  unoptimized
                />
                <h3>{char.name || "이름없음"}</h3>
                <span className="gender-badge">{char.gender || "남"}</span>

                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <div className="goal-help-line">
                    목표: {getGoalGearTierLabel(char?.goalGearTier)} / 전술: {String(char?.tacticalSkill || '블링크')}
                    <Link href="/help" className="inline-help-link" title="목표, 전술, 장비 용어 설명 보기">?</Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => openConfigModal(char)}
                    style={{ padding: '8px 10px', borderRadius: 12, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                  >
                    ⚙️ 목표/전술 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatModalCharId(char._id)}
                    className="details-stat-open-btn"
                  >
                    스탯 상세 편집
                  </button>
                </div>
                </div>

                <div className="details-stat-summary">
                {(() => {
                  const st = normalizeErStats(char.stats);
                  return (
                    <>
                      <span>HP {st.maxHp}</span>
                      <span>공 {st.attackPower}</span>
                      <span>스증 {st.skillAmp}</span>
                      <span>방 {st.defense}</span>
                      <span>공속 {st.attackSpeed}</span>
                      <span>사거리 {st.attackRange}</span>
                    </>
                  );
                })()}
                </div>
            </div>
            ))}
        </div>
        {statModalCharId ? (() => {
          const cur = characters.find((c) => String(c?._id) === String(statModalCharId)) || null;
          if (!cur) return null;
          return (
            <div
              role="dialog"
              aria-modal="true"
              className="details-modal-backdrop"
              onPointerDown={handleBackdropPointerDown}
              onPointerUp={(e) => handleBackdropPointerUp(e, closeStatModal)}
            >
              <div className="details-stat-modal">
                <div className="details-modal-head">
                  <div>
                    <p>스탯 상세 편집</p>
                    <h2>{cur.name || '이름 없음'}</h2>
                  </div>
                  <button type="button" onClick={closeStatModal} aria-label="닫기">×</button>
                </div>
                <div className="stats-grid details-modal-stats">
                  {ER_STAT_FIELDS.map((stat) => (
                    <div key={stat.key} className="stat-item">
                      <label>{stat.label}</label>
                      <input
                        type="number"
                        min={stat.min ?? 0}
                        step={stat.step ?? 1}
                        value={normalizeErStats(cur.stats)?.[stat.key] ?? stat.defaultValue ?? 0}
                        onChange={(e) => handleStatChange(cur._id, stat.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="details-modal-actions">
                  <button type="button" onClick={closeStatModal}>닫기</button>
                </div>
              </div>
            </div>
          );
        })() : null}

        <DetailsGoalConfigModal
          character={characters.find((c) => String(c?._id) === String(configCharId)) || null}
          editGoalGearTier={editGoalGearTier}
          editGoalLoadouts={editGoalLoadouts}
          editTacticalSkill={editTacticalSkill}
          equipList={equipList}
          onBackdropPointerDown={handleBackdropPointerDown}
          onBackdropPointerUp={handleBackdropPointerUp}
          onClose={closeConfigModal}
          onSave={saveConfigModal}
          onSetGoalGearTier={setEditGoalGearTier}
          onSetTacticalSkill={setEditTacticalSkill}
          onUpdateLoadout={updateLoadout}
        />
    </main>
  );
}
