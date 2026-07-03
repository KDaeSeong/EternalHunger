import {
  ACTIVE_CHARACTER_SKILL_SLOTS,
  BASIC_ATTACK_RECAST_TYPE,
  CHARACTER_SKILL_MODE,
  CHARACTER_SKILL_SLOT_LABELS,
  PASSIVE_STAT_TYPE,
  areCharacterSkillsEnabled,
  getCharacterSkillDef,
  getCharacterSkillLevel,
  getCooldownScale,
  levelValue,
  normalizeSkillState,
  resolveCharacterSkillCode,
} from './characterSkillDefinitionRuntime';
import { selectCharacterSkillAiDecision } from './characterSkillAiRuntime';
import {
  addOrRefreshEffect,
  getEffectiveStats,
  makeShieldEffect,
} from '../../../utils/statusLogic';

function readPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 0.25 ? n / 100 : n;
}

function getSkillAmpDamage(actor, def, key, fallbackSettingsKey, settings) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  const scale = Number(def?.[key] ?? skills?.[fallbackSettingsKey] ?? 0);
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const stats = getEffectiveStats(actor);
  return Math.max(0, Math.round(Number(stats?.skillAmp || 0) * scale));
}

function getTargetHpSnapshot(target) {
  const effective = getEffectiveStats(target);
  const maxHp = Math.max(1, Number(target?.maxHp || effective?.maxHp || 100));
  const currentHp = Math.max(0, Number(target?.hp ?? maxHp));
  return { maxHp, currentHp };
}

function actorId(actor) {
  return String(actor?._id || actor?.id || '');
}

function getHpScaledDamage(target, idx, maxHpPct, currentHpPct) {
  const { maxHp, currentHp } = getTargetHpSnapshot(target);
  const maxHpDamage = Math.max(0, Math.round(maxHp * readPct(levelValue(maxHpPct, idx, 0))));
  const currentHpDamage = Math.max(0, Math.round(currentHp * readPct(levelValue(currentHpPct, idx, 0))));
  return { maxHpDamage, currentHpDamage };
}

function calculateSkillDamage(attacker, defender, def, idx, stage, settings) {
  const isSecond = stage === 2;
  const flat = isSecond
    ? levelValue(def.secondFlat, idx, 0)
    : Math.max(levelValue(def.flatDamage, idx, 0), levelValue(def.firstFlat, idx, 0));
  const hpScaled = isSecond
    ? getHpScaledDamage(defender, idx, def.secondMaxHpPct, def.secondCurrentHpPct)
    : getHpScaledDamage(defender, idx, def.maxHpPct, def.currentHpPct);
  const skillAmpDamage = getSkillAmpDamage(
    attacker,
    def,
    isSecond ? 'secondSkillAmpScale' : 'skillAmpScale',
    isSecond ? 'bihyungQSecondSkillAmpScale' : 'bihyungQFirstSkillAmpScale',
    settings
  ) || (isSecond ? 0 : getSkillAmpDamage(attacker, def, 'firstSkillAmpScale', 'bihyungQFirstSkillAmpScale', settings));
  const damage = Math.max(0, Math.round(flat + hpScaled.maxHpDamage + hpScaled.currentHpDamage + skillAmpDamage));
  return {
    damage,
    maxHpDamage: hpScaled.maxHpDamage,
    currentHpDamage: hpScaled.currentHpDamage,
    skillAmpDamage,
  };
}

function applySelfUtility(attacker, def, idx) {
  let healAmount = Math.max(0, Math.round(levelValue(def.heal, idx, 0)));
  const shieldValue = Math.max(0, Math.round(levelValue(def.shield, idx, 0)));
  const maxHp = Math.max(1, Number(attacker?.maxHp || getEffectiveStats(attacker)?.maxHp || 100));

  if (healAmount > 0) {
    const before = Math.max(0, Number(attacker.hp || 0));
    attacker.hp = Math.max(0, Math.min(maxHp, before + healAmount));
    healAmount = Math.max(0, Math.round(Number(attacker.hp || 0) - before));
  }

  if (shieldValue > 0) {
    const result = addOrRefreshEffect(attacker, makeShieldEffect(
      shieldValue,
      Math.max(2, Number(def.durationSec || 2)),
      def.id || def.name,
      { tags: ['positive', 'shield', 'character_skill'] }
    ));
    attacker.activeEffects = result.character.activeEffects;
  }

  return { healAmount, shieldValue };
}

function setSkillCooldown(stateSlot, def, nowSec, settings) {
  stateSlot.stage = 'cooldown';
  stateSlot.recastUntil = 0;
  stateSlot.cooldownUntil = nowSec + Math.max(1, Math.round(Number(def.cooldownSec || 1) * getCooldownScale(settings)));
}

function buildSkillLogBits(damageInfo, utility, splashHits) {
  const bits = [];
  const splashCount = splashHits.filter((hit) => !hit?.primary).length;
  if (damageInfo.damage > 0) bits.push(`추가 피해 +${damageInfo.damage}`);
  if (damageInfo.maxHpDamage > 0) bits.push(`최대 체력 피해 +${damageInfo.maxHpDamage}`);
  if (damageInfo.currentHpDamage > 0) bits.push(`현재 체력 피해 +${damageInfo.currentHpDamage}`);
  if (utility.healAmount > 0) bits.push(`회복 +${utility.healAmount}`);
  if (utility.shieldValue > 0) bits.push(`보호막 +${utility.shieldValue}`);
  if (splashCount > 0) bits.push(`광역 ${splashCount}명`);
  return bits;
}

function makeSkillHit(target, damageInfo, def, stage, opts = {}) {
  return {
    target,
    damage: damageInfo.damage,
    maxHpDamage: damageInfo.maxHpDamage,
    currentHpDamage: damageInfo.currentHpDamage,
    skill: def.name,
    stage,
    radius: opts.radius ?? Number(def.radius || 0),
    primary: opts.primary === true,
  };
}

function buildSplashHits(attacker, defender, def, idx, stage, settings, splashTargets) {
  const radius = Number(def.radius || 0);
  if (radius <= 0 || !Array.isArray(splashTargets)) return [];
  return splashTargets
    .filter((target) => target && actorId(target) !== actorId(defender) && Number(target?.hp || 0) > 0)
    .map((target) => {
      const splashDamage = calculateSkillDamage(attacker, target, def, idx, stage, settings);
      return makeSkillHit(target, splashDamage, def, stage, { radius });
    });
}

function applySingleSkillOnBasicAttack(attacker, defender, def, opts = {}) {
  const settings = opts?.settings || {};
  const nowSec = Math.max(0, Number(opts?.nowSec || 0));
  const state = opts.state;
  const slotState = state[def.slot] || {};
  state[def.slot] = slotState;
  const cooldownUntil = Math.max(0, Number(slotState.cooldownUntil || 0));
  const recastUntil = Math.max(0, Number(slotState.recastUntil || 0));
  const hasRecast = String(slotState.stage || '') === 'recast' && recastUntil >= nowSec;
  const cooldownReady = cooldownUntil <= nowSec;
  const isRecastSkill = String(def.type || '') === BASIC_ATTACK_RECAST_TYPE;

  if (!hasRecast && !cooldownReady) return null;
  if (!isRecastSkill && !cooldownReady) return null;

  const level = getCharacterSkillLevel(attacker, def.slot);
  const idx = level - 1;
  const stage = hasRecast ? 2 : 1;
  const estimateDamage = (target) => calculateSkillDamage(attacker, target, def, idx, stage, settings);
  const aiDecision = selectCharacterSkillAiDecision({
    attacker,
    defender,
    def,
    idx,
    stage,
    settings,
    splashTargets: opts?.splashTargets,
    estimateDamage,
    opts,
  });
  if (!aiDecision.shouldUse) return null;

  const skillTarget = aiDecision.target || defender;
  const targetIsDefender = actorId(skillTarget) === actorId(defender);
  const damageInfo = estimateDamage(skillTarget);
  const utility = applySelfUtility(attacker, def, idx);

  if (isRecastSkill && !hasRecast && Number(def.recastWindowSec || 0) > 0) {
    slotState.stage = 'recast';
    slotState.recastUntil = nowSec + Math.max(1, Number(def.recastWindowSec || 5));
    slotState.cooldownUntil = nowSec + Math.max(1, Math.round(Number(def.cooldownSec || 7) * getCooldownScale(settings)));
  } else {
    setSkillCooldown(slotState, def, nowSec, settings);
  }

  const splashCandidates = targetIsDefender
    ? opts?.splashTargets
    : [defender, ...(Array.isArray(opts?.splashTargets) ? opts.splashTargets : [])];
  const splashHits = damageInfo.damage > 0
    ? buildSplashHits(attacker, skillTarget, def, idx, stage, settings, splashCandidates)
    : [];
  if (!targetIsDefender && damageInfo.damage > 0) {
    splashHits.unshift(makeSkillHit(skillTarget, damageInfo, def, stage, { primary: true, radius: 0 }));
  }

  slotState.lastUsedAt = nowSec;
  slotState.lastStage = stage;
  slotState.level = level;
  slotState.source = def.source || '';
  slotState.lastAiReason = aiDecision.reason || '';
  slotState.lastTargetId = actorId(skillTarget);
  slotState.lastCastDelaySec = aiDecision.timing?.castDelaySec || 0;
  slotState.lastRecoveryDelaySec = aiDecision.timing?.recoveryDelaySec || 0;

  const bits = buildSkillLogBits(damageInfo, utility, splashHits);
  if (typeof opts?.addLog === 'function' && opts?.showLog !== false && bits.length) {
    const label = stage === 2 ? `${CHARACTER_SKILL_SLOT_LABELS[def.slot]}2` : CHARACTER_SKILL_SLOT_LABELS[def.slot];
    opts.addLog(`[${attacker.name}] ${def.name} ${label} → [${skillTarget.name}]: ${bits.join(', ')}`, 'highlight');
  }
  if (typeof opts?.emitRunEvent === 'function' && bits.length) {
    opts.emitRunEvent('skill', {
      who: String(attacker?._id || ''),
      whoName: attacker?.name,
      target: actorId(skillTarget),
      targetName: skillTarget?.name,
      skill: def.name,
      slot: def.slot,
      mode: CHARACTER_SKILL_MODE,
      source: def.source || '',
      stage,
      level,
      damage: damageInfo.damage,
      maxHpDamage: damageInfo.maxHpDamage,
      currentHpDamage: damageInfo.currentHpDamage,
      heal: utility.healAmount,
      shield: utility.shieldValue,
      splashCount: splashHits.filter((hit) => !hit?.primary).length,
      directRetarget: !targetIsDefender,
      aiReason: aiDecision.reason || '',
      targetPriority: aiDecision.targetPriority || '',
      targetScore: Math.round(Number(aiDecision.targetScore || 0) * 100) / 100,
      castDelaySec: aiDecision.timing?.castDelaySec || 0,
      recoveryDelaySec: aiDecision.timing?.recoveryDelaySec || 0,
      actionLockSec: aiDecision.timing?.actionLockSec || 0,
      zoneId: String(attacker?.zoneId || defender?.zoneId || ''),
    }, opts?.at || null);
  }

  const directDamage = targetIsDefender ? damageInfo.damage : 0;
  return {
    damage: directDamage,
    extraDamage: directDamage,
    stage,
    level,
    skill: def.name,
    slot: def.slot,
    maxHpDamage: targetIsDefender ? damageInfo.maxHpDamage : 0,
    currentHpDamage: targetIsDefender ? damageInfo.currentHpDamage : 0,
    heal: utility.healAmount,
    shield: utility.shieldValue,
    target: skillTarget,
    targetId: actorId(skillTarget),
    directRetarget: !targetIsDefender,
    aiReason: aiDecision.reason || '',
    targetPriority: aiDecision.targetPriority || '',
    timing: aiDecision.timing,
    splashHits,
    applied: bits.length > 0,
  };
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

  const state = normalizeSkillState(attacker);
  const defs = ACTIVE_CHARACTER_SKILL_SLOTS
    .map((slot) => getCharacterSkillDef(attacker, slot))
    .filter((def) => def && String(def.type || '') !== PASSIVE_STAT_TYPE);

  if (!defs.length) {
    attacker.skillState = state;
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const results = [];
  for (const def of defs) {
    const result = applySingleSkillOnBasicAttack(attacker, defender, def, { ...opts, state });
    if (result?.applied) results.push(result);
  }

  attacker.skillState = state;
  if (!results.length) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const extraDamage = results.reduce((sum, result) => sum + Math.max(0, Number(result.extraDamage || 0)), 0);
  const splashHits = results.flatMap((result) => Array.isArray(result.splashHits) ? result.splashHits : []);
  const maxHpDamage = results.reduce((sum, result) => sum + Math.max(0, Number(result.maxHpDamage || 0)), 0);
  const currentHpDamage = results.reduce((sum, result) => sum + Math.max(0, Number(result.currentHpDamage || 0)), 0);
  const first = results[0];

  return {
    damage: rawBaseDamage + extraDamage,
    extraDamage,
    stage: first.stage,
    level: first.level,
    skill: results.map((result) => result.skill).filter(Boolean).join(', '),
    slot: first.slot,
    maxHpDamage,
    currentHpDamage,
    splashHits,
    applied: true,
    results,
  };
}

export {
  CHARACTER_SKILL_MODE,
  applyCharacterSkillOnBasicAttack,
  areCharacterSkillsEnabled,
  getCharacterSkillDef,
  resolveCharacterSkillCode,
};
