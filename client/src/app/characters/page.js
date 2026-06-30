// client/src/app/characters/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '../../styles/ERCharacters.css';
import '../../styles/Home.css';
import { WEAPON_TYPES_KO, normalizeWeaponType } from '../../utils/equipmentCatalog';
import { applyErSubjectPreset, getErSubjectPreset } from '../../utils/erMeta';
import { TACTICAL_SKILL_OPTIONS_KO, normalizeSupportedTacSkill } from '../simulation/tacticalSkillTable';
import { apiGet, apiPost, clearAuth, getToken, getUser } from '../../utils/api';
import { compactCharactersForSave, findCharacterSaveMismatches } from '../../utils/characterPayload';
import { readCompressedPreviewImage } from '../../utils/previewImage';
import { DEFAULT_ER_STATS, normalizeErStats } from '../../utils/erStats';
import SiteHeader from '../../components/SiteHeader';

const GOAL_GEAR_TIERS = [
  { value: 4, label: '영웅' },
  { value: 5, label: '전설' },
  { value: 6, label: '초월' },
];

function normalizeCharacterEditorList(data) {
  return (Array.isArray(data) ? data : []).map((c) => ({
    ...c,
    stats: normalizeErStats(c?.stats),
    weaponType: normalizeWeaponType(c?.weaponType),
    goalGearTier: [4, 5, 6].includes(Number(c?.goalGearTier)) ? Number(c.goalGearTier) : 6,
    tacticalSkill: normalizeSupportedTacSkill(c?.tacticalSkill),
  }));
}

function formatSaveMismatchMessage(mismatches) {
  const sample = (Array.isArray(mismatches) ? mismatches : [])
    .slice(0, 5)
    .map((m) => `${m.field}:${String(m.id || '').slice(-6)}`)
    .join(', ');
  return `저장 후 서버 값이 요청 값과 다릅니다.${sample ? ` (${sample})` : ''}`;
}

function freshCharactersUrl() {
  return `/characters?_fresh=${Date.now()}`;
}

async function loadCharactersAfterSave(result) {
  if (Array.isArray(result?.characters)) return result.characters;
  return apiGet(freshCharactersUrl(), { timeoutMs: 30000 });
}

function syncTokenCookie(token) {
  try {
    document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  } catch {}
}

function characterId(char) {
  return char?._id || char?.id;
}

function gearTierLabel(value) {
  return GOAL_GEAR_TIERS.find((x) => x.value === Number(value || 6))?.label || '초월';
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);
  const [dirtyPreviewIds, setDirtyPreviewIds] = useState(() => new Set());
  const [configCharId, setConfigCharId] = useState(null);
  const [editCharId, setEditCharId] = useState(null);
  const [editGoalGearTier, setEditGoalGearTier] = useState(6);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [user, setUser] = useState(null);

  const editChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(editCharId)) || null,
    [characters, editCharId]
  );

  const configChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(configCharId)) || null,
    [characters, configCharId]
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      alert('로그인이 필요합니다.');
      window.location.href = '/login';
      return;
    }
    syncTokenCookie(token);

    const userData = getUser();
    if (userData) setUser(userData);
    fetchCharacters();
  }, []);

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      clearAuth();
      setUser(null);
      window.location.reload();
    }
  };

  async function fetchCharacters() {
    const token = getToken();
    if (!token) return [];
    try {
      const data = await apiGet('/characters');
      const normalized = normalizeCharacterEditorList(data);
      setCharacters(normalized);
      return normalized;
    } catch (err) {
      console.error('캐릭터 로드 실패:', err);
      return [];
    }
  }

  const addCharacter = () => {
    const id = Date.now();
    const newChar = {
      id,
      name: '',
      gender: '여',
      stats: { ...DEFAULT_ER_STATS },
      image: null,
      previewImage: null,
      summary: '',
      weaponType: '',
      goalGearTier: 6,
      tacticalSkill: normalizeSupportedTacSkill('블링크'),
    };
    setCharacters((prev) => [...prev, newChar]);
    setEditCharId(id);
  };

  const removeCharacter = (targetId) => {
    if (!confirm('이 캐릭터를 목록에서 삭제할까요? 저장 전까지 서버에는 반영되지 않습니다.')) return;
    setCharacters((prev) => prev.filter((char) => String(characterId(char)) !== String(targetId)));
    setDirtyPreviewIds((prev) => {
      const next = new Set(prev);
      next.delete(String(targetId));
      return next;
    });
  };

  const updateCharacter = (targetId, field, value) => {
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return { ...char, [field]: value };
      })
    );
  };

  const applyErPresetToCharacter = (targetId) => {
    const current = characters.find((char) => String(characterId(char)) === String(targetId));
    const preset = getErSubjectPreset(current);
    if (!preset) {
      alert('이름과 일치하는 ER 실험체 프리셋을 찾지 못했습니다.');
      return;
    }
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return applyErSubjectPreset(char, { replaceDefaultTactical: true, statBiasScale: 1 });
      })
    );
    alert(`ER 프리셋 적용: ${preset.names?.[0] || preset.code} / ${preset.primaryWeapon} / ${preset.tacticalSkill}`);
  };

  const openConfigModal = (char) => {
    const id = characterId(char);
    if (!id) return;
    setConfigCharId(id);
    const tier = Number(char?.goalGearTier || 6);
    setEditGoalGearTier([4, 5, 6].includes(tier) ? tier : 6);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill) || '블링크');
  };

  const closeConfigModal = () => setConfigCharId(null);
  const closeEditModal = () => setEditCharId(null);

  const saveConfigModal = () => {
    if (!configCharId) return;
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(configCharId)) return char;
        return {
          ...char,
          goalGearTier: Number(editGoalGearTier || 6),
          tacticalSkill: normalizeSupportedTacSkill(editTacticalSkill),
        };
      })
    );
    closeConfigModal();
  };

  const handleImageUpload = (e, targetId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    readCompressedPreviewImage(file)
      .then((preview) => {
        if (!preview) {
          alert('이미지 용량이 너무 커서 미리보기를 저장하지 못했습니다.');
          return;
        }
        updateCharacter(targetId, 'previewImage', preview);
        setDirtyPreviewIds((prev) => new Set([...prev, String(targetId)]));
      })
      .catch(() => {
        alert('이미지를 읽지 못했습니다.');
      });
  };

  const handleAiAnalyze = async (targetId) => {
    const text = prompt('캐릭터 설정 텍스트를 붙여넣어 주세요.');
    if (!text || text.length < 2) return;

    try {
      alert('AI가 분석 중입니다. 잠시만 기다려주세요.');
      const data = await apiPost('/analyze', { text });
      const charName = data.name || '이름없음';
      const gender = data.gender || '여';
      const newStats = normalizeErStats(data.stats);

      setCharacters((prev) =>
        prev.map((char) => {
          const id = characterId(char);
          if (String(id) !== String(targetId)) return char;
          return { ...char, name: charName, gender, stats: newStats };
        })
      );

      alert(`분석 완료\n이름: ${charName}\n성별: ${gender}`);
    } catch (error) {
      console.error(error);
      alert('AI 연결 오류가 발생했습니다. 서버 상태를 확인해 주세요.');
    }
  };

  const saveCharacters = async () => {
    const token = getToken();
    if (characters.length === 0) return alert('저장할 캐릭터가 없습니다.');
    if (!window.confirm('현재 캐릭터 목록을 저장하시겠습니까? 기존 서버 데이터는 이 목록으로 갱신됩니다.')) return;

    try {
      if (!token) throw new Error('로그인이 필요합니다.');
      const payload = compactCharactersForSave(characters, { previewImageIds: dirtyPreviewIds });
      const result = await apiPost('/characters/save', payload, { timeoutMs: 30000 });
      if (Array.isArray(result?.missingIds) && result.missingIds.length > 0) {
        throw new Error('일부 캐릭터를 찾을 수 없습니다. 새로고침 후 다시 저장해 주세요.');
      }
      if (result?.receivedCount !== undefined) {
        const receivedCount = Number(result.receivedCount || 0);
        const appliedCount = Number(result.updatedCount || 0) + Number(result.createdCount || 0);
        if (receivedCount !== payload.length || appliedCount !== payload.length) {
          throw new Error(`저장 반영 건수가 맞지 않습니다. 요청 ${payload.length}명 / 반영 ${appliedCount}명`);
        }
      }
      const savedCharacters = await loadCharactersAfterSave(result);
      const normalizedSaved = normalizeCharacterEditorList(savedCharacters);
      if (normalizedSaved.length !== payload.length) {
        throw new Error(`저장된 캐릭터 수가 맞지 않습니다. 요청 ${payload.length}명 / 저장 ${normalizedSaved.length}명`);
      }
      const mismatches = findCharacterSaveMismatches(payload, normalizedSaved, { saveResults: result?.saveResults });
      if (mismatches.length > 0) {
        throw new Error(formatSaveMismatchMessage(mismatches));
      }
      setCharacters(normalizedSaved);
      setDirtyPreviewIds(new Set());
      alert('저장 완료');
    } catch (error) {
      console.error(error);
      const status = Number(error?.status || error?.response?.status || 0);
      alert(
        status === 413
          ? '저장 데이터가 너무 큽니다. 이미지 용량을 줄인 뒤 다시 시도해 주세요.'
          : `저장 실패: ${error?.message || '서버 오류'}`
      );
    }
  };

  return (
    <main className="characters-page-shell">
      <SiteHeader className="characters-site-header" />
      <header hidden aria-hidden="true" />

      <div className="page-header">
        <h1>캐릭터 설정</h1>
        <p>참가 캐릭터를 추가하고 기본 정보를 관리합니다.</p>
      </div>

      <div id="characterRowContainer" className="character-list-compact">
        {characters.map((char) => {
          const realId = characterId(char);
          const weapon = normalizeWeaponType(char.weaponType) || '랜덤';
          const tactical = normalizeSupportedTacSkill(char.tacticalSkill) || '블링크';
          return (
            <div className="characterRowContainer2 character-list-card" key={realId}>
              <div className="character-summary-avatar">
                {char.previewImage ? (
                  <img src={char.previewImage} alt={`${char.name || '캐릭터'} 미리보기`} />
                ) : (
                  <span>이미지 없음</span>
                )}
              </div>

              <div className="character-summary-main">
                <div className="character-summary-top">
                  <strong>{char.name || '이름 없음'}</strong>
                  <span>{char.gender || '여'}</span>
                </div>
                <div className="character-summary-meta">
                  <span>무기: {weapon}</span>
                  <span>목표: {gearTierLabel(char.goalGearTier)}</span>
                  <span>전술: {tactical}</span>
                </div>
              </div>

              <div className="character-summary-actions">
                <button type="button" onClick={() => setEditCharId(realId)}>기본 정보</button>
                <button type="button" onClick={() => openConfigModal(char)}>목표/전술</button>
                <button type="button" onClick={() => handleAiAnalyze(realId)}>AI 분석</button>
                <button type="button" onClick={() => applyErPresetToCharacter(realId)}>ER 프리셋</button>
                <button type="button" className="danger" onClick={() => removeCharacter(realId)}>삭제</button>
              </div>
            </div>
          );
        })}
      </div>

      {editChar ? (
        <div
          role="dialog"
          aria-modal="true"
          className="character-edit-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div className="character-edit-modal">
            <div className="character-edit-head">
              <div>
                <p>기본 정보 편집</p>
                <h2>{editChar.name || '이름 없음'}</h2>
              </div>
              <button type="button" onClick={closeEditModal} aria-label="닫기">×</button>
            </div>

            <div className="character-edit-grid">
              <div className="character-edit-image">
                {editChar.previewImage ? (
                  <img src={editChar.previewImage} alt="미리보기" />
                ) : (
                  <span>이미지 없음</span>
                )}
                <label>
                  이미지 선택
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, characterId(editChar))}
                  />
                </label>
              </div>

              <div className="character-edit-fields">
                <label>
                  이름
                  <input
                    type="text"
                    value={editChar.name || ''}
                    onChange={(e) => updateCharacter(characterId(editChar), 'name', e.target.value)}
                    placeholder="캐릭터 이름"
                  />
                </label>

                <label>
                  성별
                  <select
                    value={editChar.gender || '여'}
                    onChange={(e) => updateCharacter(characterId(editChar), 'gender', e.target.value)}
                  >
                    <option value="여">여</option>
                    <option value="남">남</option>
                    <option value="무성">무성</option>
                  </select>
                </label>

                <label>
                  사용 무기
                  <select
                    value={normalizeWeaponType(editChar.weaponType) || ''}
                    onChange={(e) => updateCharacter(characterId(editChar), 'weaponType', normalizeWeaponType(e.target.value))}
                  >
                    <option value="">랜덤</option>
                    {WEAPON_TYPES_KO.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="character-edit-actions">
              <button type="button" onClick={closeEditModal}>닫기</button>
            </div>
          </div>
        </div>
      ) : null}

      {configChar ? (
        <div
          role="dialog"
          aria-modal="true"
          className="character-edit-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfigModal();
          }}
        >
          <div className="character-edit-modal">
            <div className="character-edit-head">
              <div>
                <p>목표/전술 설정</p>
                <h2>{configChar.name || '이름 없음'}</h2>
              </div>
              <button type="button" onClick={closeConfigModal} aria-label="닫기">×</button>
            </div>

            <div className="character-edit-fields">
              <label>
                <span className="character-field-help">
                  목표 장비 등급
                  <Link href="/help" className="inline-help-link" title="목표 장비 등급 도움말">?</Link>
                </span>
                <select value={String(editGoalGearTier)} onChange={(e) => setEditGoalGearTier(Number(e.target.value))}>
                  {GOAL_GEAR_TIERS.map((t) => (
                    <option key={t.value} value={String(t.value)}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="character-field-help">
                  전술 스킬
                  <Link href="/help" className="inline-help-link" title="전술 스킬 도움말">?</Link>
                </span>
                <select value={String(editTacticalSkill)} onChange={(e) => setEditTacticalSkill(e.target.value)}>
                  {TACTICAL_SKILL_OPTIONS_KO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="character-edit-actions">
              <button type="button" onClick={closeConfigModal}>취소</button>
              <button type="button" className="primary" onClick={saveConfigModal}>적용</button>
            </div>
          </div>
        </div>
      ) : null}

      <div id="addBtn">
        <button id="addChar" onClick={addCharacter}>+ 캐릭터 추가</button>
      </div>

      <div className="main-save-container">
        <button type="button" className="main-save-btn" onClick={saveCharacters}>
          설정 저장하기
        </button>
      </div>
    </main>
  );
}
