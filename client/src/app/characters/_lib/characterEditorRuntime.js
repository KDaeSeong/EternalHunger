import { WEAPON_TYPES_KO, normalizeWeaponType } from '../../../utils/equipmentCatalog';
import { apiGet } from '../../../utils/api';
import { DEFAULT_ER_STATS, normalizeErStats } from '../../../utils/erStats';
import {
  CHARACTER_SKILL_SLOTS,
  createDefaultCompiledSkill,
  normalizeCharacterSkillType,
  normalizeSupportTargetScope,
} from '../../../utils/characterSkillCompiler';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';

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

function normalizeSkillSlot(slot) {
  const key = String(slot || 'q').trim().toLowerCase();
  return CHARACTER_SKILL_SLOTS.includes(key) ? key : 'q';
}

function cleanStatModifiers(statModifiers) {
  const src = statModifiers && typeof statModifiers === 'object' ? statModifiers : {};
  return Object.fromEntries(
    Object.entries(src)
      .map(([key, value]) => [key, cleanNumber(value, 0)])
      .filter(([, value]) => Number.isFinite(value) && value !== 0)
  );
}

function cleanPctInput(value, fallback = 0) {
  const n = cleanNumber(value, fallback);
  if (n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

function createDefaultCharacterSkill(overrides = {}, slot = 'q') {
  const skillSlot = normalizeSkillSlot(overrides.slot || slot);
  return createDefaultCompiledSkill({
    enabled: false,
    ...overrides,
    slot: skillSlot,
  }, skillSlot);
}

function normalizeCharacterSkillForEditor(skills, slot = 'q') {
  const skillSlot = normalizeSkillSlot(slot);
  const raw = skills?.[skillSlot] && typeof skills[skillSlot] === 'object' ? skills[skillSlot] : {};
  const normalized = createDefaultCharacterSkill({
    enabled: raw.enabled === true,
    slot: skillSlot,
    type: normalizeCharacterSkillType(raw.type, skillSlot),
    trigger: String(raw.trigger || ''),
    name: String(raw.name || ''),
    sourceText: String(raw.sourceText || ''),
    cooldownSec: Math.max(skillSlot === 'passive' ? 0 : 1, cleanNumber(raw.cooldownSec, skillSlot === 'q' ? 7 : 12)),
    recastWindowSec: Math.max(0, cleanNumber(raw.recastWindowSec, 0)),
    range: Math.max(0, cleanNumber(raw.range, 0)),
    castDelaySec: Math.max(0, cleanNumber(raw.castDelaySec, 0)),
    recoveryDelaySec: Math.max(0, cleanNumber(raw.recoveryDelaySec, 0)),
    useCondition: String(raw.useCondition || 'auto'),
    targetPriority: String(raw.targetPriority || 'auto'),
    supportTargetScope: normalizeSupportTargetScope(raw.supportTargetScope),
    minExpectedDamage: Math.max(0, cleanNumber(raw.minExpectedDamage, 1)),
    minSplashTargets: Math.max(0, Math.floor(cleanNumber(raw.minSplashTargets, 0))),
    minCasterHpPct: cleanPctInput(raw.minCasterHpPct, 0),
    maxCasterHpPct: cleanPctInput(raw.maxCasterHpPct, 0),
    minTargetHpPct: cleanPctInput(raw.minTargetHpPct, 0),
    maxTargetHpPct: cleanPctInput(raw.maxTargetHpPct, 0),
    radius: Math.max(0, cleanNumber(raw.radius, 0)),
    durationSec: Math.max(0, cleanNumber(raw.durationSec, 0)),
    firstFlat: normalizeSkillLevelArray(raw.firstFlat, 0, { integer: true }),
    secondFlat: normalizeSkillLevelArray(raw.secondFlat, 0, { integer: true }),
    flatDamage: normalizeSkillLevelArray(raw.flatDamage ?? raw.firstFlat, 0, { integer: true }),
    maxHpPct: normalizeSkillLevelArray(raw.maxHpPct, 0, { percent: true }),
    currentHpPct: normalizeSkillLevelArray(raw.currentHpPct, 0, { percent: true }),
    secondMaxHpPct: normalizeSkillLevelArray(raw.secondMaxHpPct, 0, { percent: true }),
    secondCurrentHpPct: normalizeSkillLevelArray(raw.secondCurrentHpPct, 0, { percent: true }),
    heal: normalizeSkillLevelArray(raw.heal, 0, { integer: true }),
    shield: normalizeSkillLevelArray(raw.shield, 0, { integer: true }),
    firstSkillAmpScale: Math.max(0, cleanNumber(raw.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanNumber(raw.secondSkillAmpScale, 0)),
    skillAmpScale: Math.max(0, cleanNumber(raw.skillAmpScale ?? raw.firstSkillAmpScale, 0)),
    statModifiers: cleanStatModifiers(raw.statModifiers),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 16) : [],
  }, skillSlot);
  if (skillSlot === 'q' && !raw.type) normalized.type = 'basic_attack_enhance';
  return normalized;
}

function createDefaultQSkill(overrides = {}) {
  return createDefaultCharacterSkill(overrides, 'q');
}

function normalizeQSkillForEditor(skills) {
  return normalizeCharacterSkillForEditor(skills, 'q');
}

function normalizeCharacterSkillsForEditor(skills) {
  return Object.fromEntries(
    CHARACTER_SKILL_SLOTS.map((slot) => [slot, normalizeCharacterSkillForEditor(skills, slot)])
  );
}

function normalizeCharacterEditorList(data) {
  return (Array.isArray(data) ? data : []).map((c) => ({
    ...c,
    stats: normalizeErStats(c?.stats),
    weaponType: normalizeWeaponType(c?.weaponType),
    characterSkillLevels: normalizeCharacterSkillLevels(c?.characterSkillLevels),
    characterSkills: normalizeCharacterSkillsForEditor(c?.characterSkills),
    goalGearTier: 6,
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

function gearTierLabel() {
  return '초월';
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
  SKILL_LEVEL_COUNT,
  WEAPON_TYPES_KO,
  characterId,
  cleanNumber,
  createBlankCharacter,
  createDefaultCharacterSkill,
  createDefaultQSkill,
  formatSaveMismatchMessage,
  gearTierLabel,
  loadCharactersAfterSave,
  normalizeCharacterEditorList,
  normalizeCharacterSkillLevels,
  normalizeCharacterSkillForEditor,
  normalizeCharacterSkillsForEditor,
  normalizeQSkillForEditor,
  normalizeSkillLevelArray,
  syncTokenCookie,
};
