import {
  ACTIVE_CHARACTER_SKILL_SLOTS,
  CHARACTER_SKILL_SLOT_LABELS,
  normalizeCharacterSkillType,
} from '../../../utils/characterSkillCompiler.js';

const CHARACTER_SKILL_MODE = 'character_skill';
const BASIC_ATTACK_RECAST_TYPE = 'basic_attack_enhance';
const COMBAT_EFFECT_TYPE = 'attack_skill';
const PASSIVE_STAT_TYPE = 'passive_stat';
const SKILL_LEVELS = 5;

const BIHYUNG_Q = {
  id: 'bihyung_q',
  characterCode: 'bihyung',
  slot: 'q',
  type: BASIC_ATTACK_RECAST_TYPE,
  trigger: 'basic_attack',
  name: '비형 Q',
  cooldownSec: 7,
  recastWindowSec: 5,
  range: 0,
  castDelaySec: 0.1,
  recoveryDelaySec: 0.25,
  useCondition: 'auto',
  targetPriority: 'cluster',
  minExpectedDamage: 1,
  minSplashTargets: 0,
  minCasterHpPct: 0,
  maxCasterHpPct: 0,
  minTargetHpPct: 0,
  maxTargetHpPct: 0,
  radius: 1,
  firstFlat: [10, 20, 30, 40, 50],
  secondFlat: [20, 30, 40, 50, 60],
  flatDamage: [10, 20, 30, 40, 50],
  maxHpPct: [0, 0, 0, 0, 0],
  currentHpPct: [0, 0, 0, 0, 0],
  secondMaxHpPct: [0, 0, 0, 0, 0],
  secondCurrentHpPct: [1, 1, 2, 2, 3],
  heal: [0, 0, 0, 0, 0],
  shield: [0, 0, 0, 0, 0],
  firstSkillAmpScale: 0,
  secondSkillAmpScale: 0,
  skillAmpScale: 0,
  statModifiers: {},
  source: 'builtin',
};

const CHARACTER_SKILL_CATALOG = {
  bihyung: {
    q: BIHYUNG_Q,
  },
};

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanSkillText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
    .trim();
}

function levelArray(value, fallback = 0) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '')
      .split(/[,\s/]+/)
      .filter(Boolean);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < SKILL_LEVELS; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    const n = Number(picked);
    out.push(Number.isFinite(n) ? n : fallback);
  }
  return out;
}

function levelValue(value, idx, fallback = 0) {
  const list = levelArray(value, fallback);
  return Number(list[idx] ?? list[list.length - 1] ?? fallback) || 0;
}

function resolveCharacterSkillCode(actor) {
  const explicit = normalizeText(actor?.characterSkillCode || actor?.erSubject || actor?.subjectCode || actor?.code);
  if (explicit === 'bihyung' || explicit === 'bihyeong') return 'bihyung';

  const name = normalizeText(actor?.name || actor?.nickname || actor?.characterName);
  if (name.includes('비형') || name.includes('bihyung') || name.includes('bihyeong')) return 'bihyung';
  return explicit || '';
}

function readSkillSource(actor) {
  if (actor?.characterSkills && typeof actor.characterSkills === 'object') return actor.characterSkills;
  if (actor?.customSkills && typeof actor.customSkills === 'object') return actor.customSkills;
  return {};
}

function cleanStatModifiers(statModifiers) {
  const src = statModifiers && typeof statModifiers === 'object' ? statModifiers : {};
  return Object.fromEntries(
    Object.entries(src)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value) && value !== 0)
  );
}

function cleanPctInput(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n > 1 ? n / 100 : n;
}

function normalizeCustomSkill(actor, slot) {
  const skillSlot = String(slot || '').toLowerCase();
  const raw = readSkillSource(actor)?.[skillSlot];
  if (!raw || typeof raw !== 'object' || raw.enabled === false) return null;

  const explicitName = cleanSkillText(raw.name, '');
  const firstFlat = levelArray(raw.firstFlat, 0).map((n) => Math.max(0, Math.round(n)));
  const secondFlat = levelArray(raw.secondFlat, 0).map((n) => Math.max(0, Math.round(n)));
  const flatDamage = levelArray(raw.flatDamage ?? raw.firstFlat, 0).map((n) => Math.max(0, Math.round(n)));
  const maxHpPct = levelArray(raw.maxHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const currentHpPct = levelArray(raw.currentHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const secondMaxHpPct = levelArray(raw.secondMaxHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const secondCurrentHpPct = levelArray(raw.secondCurrentHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const heal = levelArray(raw.heal, 0).map((n) => Math.max(0, Math.round(n)));
  const shield = levelArray(raw.shield, 0).map((n) => Math.max(0, Math.round(n)));
  const statModifiers = cleanStatModifiers(raw.statModifiers);
  const hasPayload = [
    ...firstFlat,
    ...secondFlat,
    ...flatDamage,
    ...maxHpPct,
    ...currentHpPct,
    ...secondMaxHpPct,
    ...secondCurrentHpPct,
    ...heal,
    ...shield,
    ...Object.values(statModifiers),
  ].some((n) => Number(n || 0) !== 0);
  if (!hasPayload && !explicitName) return null;

  const isPassive = skillSlot === 'passive';
  const defaultType = isPassive ? PASSIVE_STAT_TYPE : skillSlot === 'q' ? BASIC_ATTACK_RECAST_TYPE : COMBAT_EFFECT_TYPE;
  const defaultCooldown = skillSlot === 'r' ? 60 : skillSlot === 'e' ? 18 : skillSlot === 'w' ? 12 : skillSlot === 'q' ? 7 : 0;
  return {
    id: cleanSkillText(raw.id, `custom_${String(actor?._id || actor?.id || 'actor')}_${skillSlot}`),
    characterCode: cleanSkillText(actor?.characterSkillCode || actor?.erSubject || actor?.code, 'custom'),
    slot: skillSlot,
    type: normalizeCharacterSkillType(cleanSkillText(raw.type, defaultType), skillSlot),
    trigger: cleanSkillText(raw.trigger, isPassive ? 'always' : 'basic_attack'),
    name: explicitName || `${CHARACTER_SKILL_SLOT_LABELS[skillSlot] || skillSlot.toUpperCase()} skill`,
    cooldownSec: clamp(raw.cooldownSec ?? defaultCooldown, isPassive ? 0 : 1, 180),
    recastWindowSec: clamp(raw.recastWindowSec ?? 0, 0, 30),
    range: clamp(raw.range ?? 0, 0, 20),
    castDelaySec: clamp(raw.castDelaySec ?? 0, 0, 10),
    recoveryDelaySec: clamp(raw.recoveryDelaySec ?? 0, 0, 10),
    useCondition: cleanSkillText(raw.useCondition, 'auto'),
    targetPriority: cleanSkillText(raw.targetPriority, 'auto'),
    minExpectedDamage: Math.max(0, Number(raw.minExpectedDamage ?? 1) || 0),
    minSplashTargets: Math.max(0, Math.floor(Number(raw.minSplashTargets || 0))),
    minCasterHpPct: cleanPctInput(raw.minCasterHpPct, 0),
    maxCasterHpPct: cleanPctInput(raw.maxCasterHpPct, 0),
    minTargetHpPct: cleanPctInput(raw.minTargetHpPct, 0),
    maxTargetHpPct: cleanPctInput(raw.maxTargetHpPct, 0),
    radius: clamp(raw.radius ?? 0, 0, 5),
    durationSec: clamp(raw.durationSec ?? 0, 0, 60),
    firstFlat,
    secondFlat,
    flatDamage,
    maxHpPct,
    currentHpPct,
    secondMaxHpPct,
    secondCurrentHpPct,
    heal,
    shield,
    firstSkillAmpScale: Math.max(0, Number(raw.firstSkillAmpScale || 0)),
    secondSkillAmpScale: Math.max(0, Number(raw.secondSkillAmpScale || 0)),
    skillAmpScale: Math.max(0, Number(raw.skillAmpScale ?? raw.firstSkillAmpScale ?? 0)),
    statModifiers,
    source: 'custom',
  };
}

function getCharacterSkillDef(actor, slot) {
  const skillSlot = String(slot || '').toLowerCase();
  const custom = normalizeCustomSkill(actor, skillSlot);
  if (custom) return custom;

  const code = resolveCharacterSkillCode(actor);
  return code && skillSlot ? CHARACTER_SKILL_CATALOG?.[code]?.[skillSlot] || null : null;
}

function getCharacterSkillLevel(actor, slot) {
  const skillSlot = String(slot || '').toLowerCase();
  const explicit = Number(
    actor?.characterSkillLevels?.[skillSlot]
    ?? actor?.skillLevels?.[skillSlot]
    ?? actor?.characterSkillLevel
  );
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(clamp(explicit, 1, 5));

  const level = Math.max(1, Math.floor(Number(actor?.erLevel || actor?.level || 1)));
  return Math.floor(clamp(1 + Math.floor((level - 1) / 4), 1, 5));
}

function normalizeSkillState(actor) {
  const src = actor?.skillState && typeof actor.skillState === 'object' ? actor.skillState : {};
  const out = { ...src };
  for (const slot of ACTIVE_CHARACTER_SKILL_SLOTS) {
    out[slot] = src?.[slot] && typeof src[slot] === 'object' ? { ...src[slot] } : {};
  }
  return out;
}

function areCharacterSkillsEnabled(settings = {}) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  if (settings?.battle?.characterSkillsEnabled === false) return false;
  if (settings?.characterSkillsEnabled === false) return false;
  if (skills.enabled === false) return false;
  if (skills.characterSkills === false) return false;
  if (skills.aiUseSkills === false) return false;
  return true;
}

function getCooldownScale(settings = {}) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  return clamp(skills.cooldownScale ?? 1, 0.25, 4);
}

export {
  ACTIVE_CHARACTER_SKILL_SLOTS,
  BASIC_ATTACK_RECAST_TYPE,
  CHARACTER_SKILL_MODE,
  CHARACTER_SKILL_SLOT_LABELS,
  PASSIVE_STAT_TYPE,
  areCharacterSkillsEnabled,
  getCharacterSkillDef,
  getCharacterSkillLevel,
  getCooldownScale,
  levelArray,
  levelValue,
  normalizeSkillState,
  resolveCharacterSkillCode,
};
