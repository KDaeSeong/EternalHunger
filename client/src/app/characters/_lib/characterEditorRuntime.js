import { WEAPON_TYPES_KO, normalizeWeaponType } from '../../../utils/equipmentCatalog';
import { apiGet } from '../../../utils/api';
import { DEFAULT_ER_STATS, normalizeErStats } from '../../../utils/erStats';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';

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
    sourceText: '',
    cooldownSec: 7,
    recastWindowSec: 5,
    radius: 0,
    firstFlat: [0, 0, 0, 0, 0],
    secondFlat: [0, 0, 0, 0, 0],
    secondMaxHpPct: [0, 0, 0, 0, 0],
    secondCurrentHpPct: [0, 0, 0, 0, 0],
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
    sourceText: String(q.sourceText || ''),
    cooldownSec: Math.max(1, cleanNumber(q.cooldownSec, 7)),
    recastWindowSec: Math.max(1, cleanNumber(q.recastWindowSec, 5)),
    radius: Math.max(0, cleanNumber(q.radius, 0)),
    firstFlat: normalizeSkillLevelArray(q.firstFlat, 0, { integer: true }),
    secondFlat: normalizeSkillLevelArray(q.secondFlat, 0, { integer: true }),
    secondMaxHpPct: normalizeSkillLevelArray(q.secondMaxHpPct, 0, { percent: true }),
    secondCurrentHpPct: normalizeSkillLevelArray(q.secondCurrentHpPct, 0, { percent: true }),
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
  return `저장 후 서버 값이 요청 값과 어긋났습니다.${sample ? ` (${sample})` : ''}`;
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

function createBlankCharacter(id) {
  return {
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
}

export {
  GOAL_GEAR_TIERS,
  SKILL_LEVEL_COUNT,
  WEAPON_TYPES_KO,
  characterId,
  cleanNumber,
  createBlankCharacter,
  createDefaultQSkill,
  formatSaveMismatchMessage,
  gearTierLabel,
  loadCharactersAfterSave,
  normalizeCharacterEditorList,
  normalizeCharacterSkillLevels,
  normalizeCharacterSkillsForEditor,
  normalizeQSkillForEditor,
  normalizeSkillLevelArray,
  syncTokenCookie,
};
