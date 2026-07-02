import { getEffectiveStats } from '../../../utils/statusLogic';

const CHARACTER_SKILL_MODE = 'character_skill';
const BASIC_ATTACK_RECAST_TYPE = 'basic_attack_recast';
const SKILL_LEVELS = 5;

const BIHYUNG_Q = {
  id: 'bihyung_q',
  characterCode: 'bihyung',
  slot: 'q',
  type: BASIC_ATTACK_RECAST_TYPE,
  name: '도깨비 장난',
  cooldownSec: 7,
  recastWindowSec: 5,
  radius: 1,
  firstFlat: [10, 20, 30, 40, 50],
  secondFlat: [20, 30, 40, 50, 60],
  secondMaxHpPct: [0, 0, 0, 0, 0],
  secondCurrentHpPct: [1, 1, 2, 2, 3],
  firstSkillAmpScale: 0,
  secondSkillAmpScale: 0,
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

function readPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 0.25 ? n / 100 : n;
}

function resolveCharacterSkillCode(actor) {
  const explicit = normalizeText(actor?.characterSkillCode || actor?.erSubject || actor?.subjectCode || actor?.code);
  if (explicit === 'bihyung' || explicit === 'bihyeong') return 'bihyung';

  const name = normalizeText(actor?.name || actor?.nickname || actor?.characterName);
  if (name.includes('비형') || name.includes('bihyung') || name.includes('bihyeong')) return 'bihyung';
  return explicit || '';
}

function normalizeCustomQSkill(actor) {
  const skills = actor?.characterSkills && typeof actor.characterSkills === 'object'
    ? actor.characterSkills
    : actor?.customSkills && typeof actor.customSkills === 'object'
      ? actor.customSkills
      : {};
  const raw = skills?.q && typeof skills.q === 'object' ? skills.q : null;
  if (!raw || raw.enabled === false) return null;

  const explicitName = cleanSkillText(raw.name, '');
  const firstFlat = levelArray(raw.firstFlat, 0).map((n) => Math.max(0, Math.round(n)));
  const secondFlat = levelArray(raw.secondFlat, 0).map((n) => Math.max(0, Math.round(n)));
  const secondMaxHpPct = levelArray(raw.secondMaxHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const secondCurrentHpPct = levelArray(raw.secondCurrentHpPct, 0).map((n) => Math.max(0, Number(n) || 0));
  const hasDamage = [...firstFlat, ...secondFlat, ...secondMaxHpPct, ...secondCurrentHpPct].some((n) => Number(n || 0) > 0);
  if (!hasDamage && !explicitName) return null;

  return {
    id: cleanSkillText(raw.id, `custom_${String(actor?._id || actor?.id || 'actor')}_q`),
    characterCode: cleanSkillText(actor?.characterSkillCode || actor?.erSubject || actor?.code, 'custom'),
    slot: 'q',
    type: cleanSkillText(raw.type, BASIC_ATTACK_RECAST_TYPE),
    name: explicitName || '사용자 Q',
    cooldownSec: clamp(raw.cooldownSec ?? 7, 1, 120),
    recastWindowSec: clamp(raw.recastWindowSec ?? 5, 1, 30),
    radius: clamp(raw.radius ?? 0, 0, 5),
    firstFlat,
    secondFlat,
    secondMaxHpPct,
    secondCurrentHpPct,
    firstSkillAmpScale: Math.max(0, Number(raw.firstSkillAmpScale || 0)),
    secondSkillAmpScale: Math.max(0, Number(raw.secondSkillAmpScale || 0)),
    source: 'custom',
  };
}

function getCharacterSkillDef(actor, slot) {
  const skillSlot = String(slot || '').toLowerCase();
  if (skillSlot === 'q') {
    const custom = normalizeCustomQSkill(actor);
    if (custom) return custom;
  }

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
  return {
    ...src,
    q: src?.q && typeof src.q === 'object' ? { ...src.q } : {},
  };
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

function getSkillAmpDamage(actor, def, key, fallbackSettingsKey, settings) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  const scale = Number(def?.[key] ?? skills?.[fallbackSettingsKey] ?? 0);
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const stats = getEffectiveStats(actor);
  return Math.max(0, Math.round(Number(stats?.skillAmp || 0) * scale));
}

function stageLabel(stage) {
  return stage === 2 ? 'Q2' : 'Q1';
}

function getTargetHpSnapshot(target) {
  const effective = getEffectiveStats(target);
  const maxHp = Math.max(1, Number(target?.maxHp || effective?.maxHp || 100));
  const currentHp = Math.max(0, Number(target?.hp ?? maxHp));
  return { maxHp, currentHp };
}

function getSecondStageDamage(target, idx, secondFlat, secondMaxHpPct, secondCurrentHpPct, skillAmpDamage) {
  const { maxHp, currentHp } = getTargetHpSnapshot(target);
  const maxHpDamage = Math.max(0, Math.round(maxHp * readPct(secondMaxHpPct[idx])));
  const currentHpDamage = Math.max(0, Math.round(currentHp * readPct(secondCurrentHpPct[idx])));
  const damage = Math.max(0, Math.round(
    Number(secondFlat[idx] || 0)
    + maxHpDamage
    + currentHpDamage
    + Math.max(0, Number(skillAmpDamage || 0))
  ));
  return { damage, maxHpDamage, currentHpDamage };
}

function applyCharacterSkillOnBasicAttack(attacker, defender, baseDamage, opts = {}) {
  const rawBaseDamage = Math.max(0, Number(baseDamage || 0));
  if (!attacker || !defender || rawBaseDamage <= 0) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const settings = opts?.settings || {};
  if (!areCharacterSkillsEnabled(settings)) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const def = getCharacterSkillDef(attacker, 'q');
  if (!def || String(def.type || BASIC_ATTACK_RECAST_TYPE) !== BASIC_ATTACK_RECAST_TYPE) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const nowSec = Math.max(0, Number(opts?.nowSec || 0));
  const state = normalizeSkillState(attacker);
  const q = state.q;
  const recastUntil = Math.max(0, Number(q.recastUntil || 0));
  const cooldownUntil = Math.max(0, Number(q.cooldownUntil || 0));
  const hasRecast = String(q.stage || '') === 'recast' && recastUntil >= nowSec;
  const cooldownReady = cooldownUntil <= nowSec;

  if (!hasRecast && !cooldownReady) {
    attacker.skillState = state;
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const level = getCharacterSkillLevel(attacker, 'q');
  const idx = level - 1;
  const firstFlat = levelArray(def.firstFlat, 0);
  const secondFlat = levelArray(def.secondFlat, 0);
  const secondMaxHpPct = levelArray(def.secondMaxHpPct, 0);
  const secondCurrentHpPct = levelArray(def.secondCurrentHpPct, 0);
  let stage = 1;
  let extraDamage = Math.max(0, Math.round(Number(firstFlat[idx] || 0)));
  let maxHpDamage = 0;
  let currentHpDamage = 0;
  let splashHits = [];

  if (hasRecast) {
    stage = 2;
    const secondSkillAmpDamage = getSkillAmpDamage(attacker, def, 'secondSkillAmpScale', 'bihyungQSecondSkillAmpScale', settings);
    const primaryDamage = getSecondStageDamage(defender, idx, secondFlat, secondMaxHpPct, secondCurrentHpPct, secondSkillAmpDamage);
    extraDamage = primaryDamage.damage;
    maxHpDamage = primaryDamage.maxHpDamage;
    currentHpDamage = primaryDamage.currentHpDamage;
    q.stage = 'cooldown';
    q.recastUntil = 0;
    q.cooldownUntil = nowSec + Math.max(1, Math.round(Number(def.cooldownSec || 7) * getCooldownScale(settings)));

    const splashTargets = Number(def.radius || 0) > 0 && Array.isArray(opts?.splashTargets) ? opts.splashTargets : [];
    splashHits = splashTargets
      .filter((target) => target && String(target?._id || '') !== String(defender?._id || '') && Number(target?.hp || 0) > 0)
      .map((target) => {
        const splashDamage = getSecondStageDamage(target, idx, secondFlat, secondMaxHpPct, secondCurrentHpPct, secondSkillAmpDamage);
        return {
          target,
          damage: splashDamage.damage,
          maxHpDamage: splashDamage.maxHpDamage,
          currentHpDamage: splashDamage.currentHpDamage,
          skill: def.name,
          stage,
          radius: def.radius,
        };
      });
  } else {
    extraDamage += getSkillAmpDamage(attacker, def, 'firstSkillAmpScale', 'bihyungQFirstSkillAmpScale', settings);
    q.stage = 'recast';
    q.recastUntil = nowSec + Math.max(1, Number(def.recastWindowSec || 5));
    q.cooldownUntil = nowSec + Math.max(1, Math.round(Number(def.cooldownSec || 7) * getCooldownScale(settings)));
  }

  q.lastUsedAt = nowSec;
  q.lastStage = stage;
  q.level = level;
  q.source = def.source || '';
  attacker.skillState = state;

  const finalDamage = rawBaseDamage + extraDamage;
  const bits = [`추가 피해 +${extraDamage}`];
  if (stage === 2 && maxHpDamage > 0) bits.push(`최대 체력 피해 +${maxHpDamage}`);
  if (stage === 2 && currentHpDamage > 0) bits.push(`현재 체력 피해 +${currentHpDamage}`);
  if (stage === 2 && splashHits.length) bits.push(`광역 ${splashHits.length}명`);

  const log = `[${attacker.name}] ${def.name} ${stageLabel(stage)}: ${bits.join(', ')}`;
  if (typeof opts?.addLog === 'function' && opts?.showLog !== false) {
    opts.addLog(`🌀 ${log}`, 'highlight');
  }
  if (typeof opts?.emitRunEvent === 'function') {
    opts.emitRunEvent('skill', {
      who: String(attacker?._id || ''),
      whoName: attacker?.name,
      target: String(defender?._id || ''),
      targetName: defender?.name,
      skill: def.name,
      slot: def.slot,
      mode: CHARACTER_SKILL_MODE,
      source: def.source || '',
      stage,
      level,
      damage: extraDamage,
      maxHpDamage,
      currentHpDamage,
      splashCount: splashHits.length,
      zoneId: String(attacker?.zoneId || defender?.zoneId || ''),
    }, opts?.at || null);
  }

  return {
    damage: finalDamage,
    extraDamage,
    stage,
    level,
    skill: def.name,
    maxHpDamage,
    currentHpDamage,
    splashHits,
    applied: true,
  };
}

export {
  CHARACTER_SKILL_MODE,
  applyCharacterSkillOnBasicAttack,
  areCharacterSkillsEnabled,
  getCharacterSkillDef,
  resolveCharacterSkillCode,
};
