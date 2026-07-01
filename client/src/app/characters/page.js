// client/src/app/characters/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '../../styles/ERCharacters.css';
import '../../styles/Home.css';
import { WEAPON_TYPES_KO, normalizeWeaponType } from '../../utils/equipmentCatalog';
import { applyErSubjectPreset, getErSubjectPreset } from '../../utils/erMeta';
import { TACTICAL_SKILL_OPTIONS_KO, normalizeSupportedTacSkill } from '../simulation/tacticalSkillTable';
import { apiGet, apiGetCached, apiPost, clearApiGetCache, clearAuth, getToken, getUser } from '../../utils/api';
import { compactCharactersForSave, findCharacterSaveMismatches } from '../../utils/characterPayload';
import { readCompressedPreviewImage } from '../../utils/previewImage';
import { DEFAULT_ER_STATS, normalizeErStats } from '../../utils/erStats';
import SiteHeader from '../../components/SiteHeader';

const GOAL_GEAR_TIERS = [
  { value: 4, label: '영웅' },
  { value: 5, label: '전설' },
  { value: 6, label: '초월' },
];

const SKILL_LEVEL_COUNT = 5;

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSkillLevelArray(value, fallback = 0, opts = {}) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[,\s/]+/).filter(Boolean);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < SKILL_LEVEL_COUNT; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    let n = cleanNumber(picked, fallback);
    if (opts.percent && n > 0 && n <= 0.25) n *= 100;
    out.push(opts.integer ? Math.round(n) : Number(n.toFixed(3)));
  }
  return out;
}

function normalizeCharacterSkillLevels(levels) {
  const src = levels && typeof levels === 'object' ? levels : {};
  return {
    q: Math.max(1, Math.min(5, Math.floor(cleanNumber(src.q, 1)))),
    w: Math.max(1, Math.min(5, Math.floor(cleanNumber(src.w, 1)))),
    e: Math.max(1, Math.min(5, Math.floor(cleanNumber(src.e, 1)))),
    r: Math.max(1, Math.min(5, Math.floor(cleanNumber(src.r, 1)))),
  };
}

function createDefaultQSkill(overrides = {}) {
  return {
    enabled: false,
    type: 'basic_attack_recast',
    name: '',
    cooldownSec: 7,
    recastWindowSec: 5,
    radius: 0,
    firstFlat: [0, 0, 0, 0, 0],
    secondFlat: [0, 0, 0, 0, 0],
    secondMaxHpPct: [0, 0, 0, 0, 0],
    firstSkillAmpScale: 0,
    secondSkillAmpScale: 0,
    ...overrides,
  };
}

function normalizeQSkillForEditor(skills) {
  const q = skills?.q && typeof skills.q === 'object' ? skills.q : {};
  return createDefaultQSkill({
    enabled: q.enabled === true,
    type: String(q.type || 'basic_attack_recast'),
    name: String(q.name || ''),
    cooldownSec: Math.max(1, cleanNumber(q.cooldownSec, 7)),
    recastWindowSec: Math.max(1, cleanNumber(q.recastWindowSec, 5)),
    radius: Math.max(0, cleanNumber(q.radius, 0)),
    firstFlat: normalizeSkillLevelArray(q.firstFlat, 0, { integer: true }),
    secondFlat: normalizeSkillLevelArray(q.secondFlat, 0, { integer: true }),
    secondMaxHpPct: normalizeSkillLevelArray(q.secondMaxHpPct, 0, { percent: true }),
    firstSkillAmpScale: Math.max(0, cleanNumber(q.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanNumber(q.secondSkillAmpScale, 0)),
  });
}

function normalizeCharacterSkillsForEditor(skills) {
  return { q: normalizeQSkillForEditor(skills) };
}

function normalizeCharacterEditorList(data) {
  return (Array.isArray(data) ? data : []).map((c) => ({
    ...c,
    stats: normalizeErStats(c?.stats),
    weaponType: normalizeWeaponType(c?.weaponType),
    characterSkillLevels: normalizeCharacterSkillLevels(c?.characterSkillLevels),
    characterSkills: normalizeCharacterSkillsForEditor(c?.characterSkills),
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
  return `/characters?view=editor&_fresh=${Date.now()}`;
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
  const [editCharacterSkillCode, setEditCharacterSkillCode] = useState('');
  const [editCharacterSkillLevels, setEditCharacterSkillLevels] = useState(() => normalizeCharacterSkillLevels());
  const [editCharacterSkills, setEditCharacterSkills] = useState(() => normalizeCharacterSkillsForEditor());
  const [user, setUser] = useState(() => getUser() || null);

  const editChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(editCharId)) || null,
    [characters, editCharId]
  );

  const configChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(configCharId)) || null,
    [characters, configCharId]
  );

  async function fetchCharacters() {
    const token = getToken();
    if (!token) return [];
    try {
      const data = await apiGetCached('/characters?view=editor', { ttlMs: 8000, timeoutMs: 20000 });
      const normalized = normalizeCharacterEditorList(data);
      setCharacters(normalized);
      return normalized;
    } catch (err) {
      console.error('캐릭터 로드 실패:', err);
      return [];
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      alert('로그인이 필요합니다.');
      window.location.href = '/login';
      return;
    }
    syncTokenCookie(token);

    const timer = window.setTimeout(() => {
      fetchCharacters();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      clearAuth();
      setUser(null);
      window.location.reload();
    }
  };

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
      characterTemplateId: '',
      characterSkillCode: '',
      characterSkillLevel: 1,
      characterSkillLevels: { q: 1, w: 1, e: 1, r: 1 },
      characterSkills: normalizeCharacterSkillsForEditor(),
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

  const updateEditQSkill = (field, value) => {
    setEditCharacterSkills((prev) => ({
      ...prev,
      q: {
        ...createDefaultQSkill(prev?.q || {}),
        [field]: value,
      },
    }));
  };

  const updateEditQSkillLevelValue = (field, index, value) => {
    setEditCharacterSkills((prev) => {
      const q = createDefaultQSkill(prev?.q || {});
      const list = normalizeSkillLevelArray(q[field], 0, { percent: field === 'secondMaxHpPct' });
      list[index] = cleanNumber(value, 0);
      return {
        ...prev,
        q: {
          ...q,
          [field]: list,
        },
      };
    });
  };

  const openConfigModal = (char) => {
    const id = characterId(char);
    if (!id) return;
    setConfigCharId(id);
    const tier = Number(char?.goalGearTier || 6);
    setEditGoalGearTier([4, 5, 6].includes(tier) ? tier : 6);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill) || '블링크');
    setEditCharacterSkillCode(String(char?.characterSkillCode || char?.erSubject || '').trim());
    setEditCharacterSkillLevels(normalizeCharacterSkillLevels(char?.characterSkillLevels));
    setEditCharacterSkills(normalizeCharacterSkillsForEditor(char?.characterSkills));
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
          characterSkillCode: String(editCharacterSkillCode || '').trim(),
          characterSkillLevel: editCharacterSkillLevels.q,
          characterSkillLevels: normalizeCharacterSkillLevels(editCharacterSkillLevels),
          characterSkills: normalizeCharacterSkillsForEditor(editCharacterSkills),
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
      clearApiGetCache('/characters');
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
        <div className="page-header-row">
          <div className="page-header-copy">
            <h1>캐릭터 설정</h1>
            <p>참가 캐릭터를 추가하고 기본 정보를 관리합니다.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="page-header-action-btn secondary" onClick={addCharacter}>
              + 캐릭터 추가
            </button>
            <button type="button" className="page-header-action-btn primary" onClick={saveCharacters}>
              변경사항 저장
            </button>
          </div>
        </div>
      </div>

      <div id="characterRowContainer" className="character-list-compact">
        {characters.map((char) => {
          const realId = characterId(char);
          const weapon = normalizeWeaponType(char.weaponType) || '랜덤';
          const tactical = normalizeSupportedTacSkill(char.tacticalSkill) || '블링크';
          const qSkill = char?.characterSkills?.q;
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
                  {qSkill?.enabled ? <span>Q: {qSkill.name || '사용자 Q'}</span> : null}
                </div>
              </div>

              <div className="character-summary-actions">
                <button type="button" onClick={() => setEditCharId(realId)}>기본 정보</button>
                <button type="button" onClick={() => openConfigModal(char)}>목표/스킬</button>
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
                <p>목표/스킬 설정</p>
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

              <div className="character-skill-section">
                <div className="character-skill-section-head">
                  <strong>캐릭터 Q</strong>
                  <label className="character-skill-toggle">
                    <input
                      type="checkbox"
                      checked={editCharacterSkills?.q?.enabled === true}
                      onChange={(e) => updateEditQSkill('enabled', e.target.checked)}
                    />
                    <span>사용</span>
                  </label>
                </div>

                <div className="character-skill-inline-grid">
                  <label>
                    스킬 코드
                    <input
                      type="text"
                      value={editCharacterSkillCode}
                      onChange={(e) => setEditCharacterSkillCode(e.target.value)}
                      placeholder="예: bihyung"
                    />
                  </label>

                  <label>
                    Q 레벨
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="1"
                      value={editCharacterSkillLevels.q}
                      onChange={(e) => setEditCharacterSkillLevels((prev) => ({
                        ...normalizeCharacterSkillLevels(prev),
                        q: Math.max(1, Math.min(5, Math.floor(cleanNumber(e.target.value, 1)))),
                      }))}
                    />
                  </label>
                </div>

                <label>
                  Q 이름
                  <input
                    type="text"
                    value={editCharacterSkills?.q?.name || ''}
                    onChange={(e) => updateEditQSkill('name', e.target.value)}
                    placeholder="예: 도깨비 장난"
                    disabled={editCharacterSkills?.q?.enabled !== true}
                  />
                </label>

                <div className="character-skill-inline-grid">
                  <label>
                    쿨다운(초)
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={editCharacterSkills?.q?.cooldownSec ?? 7}
                      onChange={(e) => updateEditQSkill('cooldownSec', Math.max(1, cleanNumber(e.target.value, 7)))}
                      disabled={editCharacterSkills?.q?.enabled !== true}
                    />
                  </label>

                  <label>
                    재시전 시간(초)
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={editCharacterSkills?.q?.recastWindowSec ?? 5}
                      onChange={(e) => updateEditQSkill('recastWindowSec', Math.max(1, cleanNumber(e.target.value, 5)))}
                      disabled={editCharacterSkills?.q?.enabled !== true}
                    />
                  </label>

                  <label>
                    Q2 광역 범위
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editCharacterSkills?.q?.radius ?? 0}
                      onChange={(e) => updateEditQSkill('radius', Math.max(0, cleanNumber(e.target.value, 0)))}
                      disabled={editCharacterSkills?.q?.enabled !== true}
                    />
                  </label>
                </div>

                {[
                  ['firstFlat', 'Q1 추가 피해', 1],
                  ['secondFlat', 'Q2 추가 피해', 1],
                  ['secondMaxHpPct', 'Q2 최대 체력 %', 0.5],
                ].map(([field, label, step]) => (
                  <div className="character-skill-level-editor" key={field}>
                    <span>{label}</span>
                    <div className="character-skill-level-grid">
                      {Array.from({ length: SKILL_LEVEL_COUNT }).map((_, index) => (
                        <label key={`${field}-${index}`}>
                          Lv.{index + 1}
                          <input
                            type="number"
                            min="0"
                            step={String(step)}
                            value={editCharacterSkills?.q?.[field]?.[index] ?? 0}
                            onChange={(e) => updateEditQSkillLevelValue(field, index, e.target.value)}
                            disabled={editCharacterSkills?.q?.enabled !== true}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="character-skill-inline-grid">
                  <label>
                    Q1 스증 계수
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      value={editCharacterSkills?.q?.firstSkillAmpScale ?? 0}
                      onChange={(e) => updateEditQSkill('firstSkillAmpScale', Math.max(0, cleanNumber(e.target.value, 0)))}
                      disabled={editCharacterSkills?.q?.enabled !== true}
                    />
                  </label>

                  <label>
                    Q2 스증 계수
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      value={editCharacterSkills?.q?.secondSkillAmpScale ?? 0}
                      onChange={(e) => updateEditQSkill('secondSkillAmpScale', Math.max(0, cleanNumber(e.target.value, 0)))}
                      disabled={editCharacterSkills?.q?.enabled !== true}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="character-edit-actions">
              <button type="button" onClick={closeConfigModal}>취소</button>
              <button type="button" className="primary" onClick={saveConfigModal}>적용</button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}
