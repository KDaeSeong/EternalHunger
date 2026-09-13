import { getCombatSpaceId, shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import {
  ACTIVE_CHARACTER_SKILL_SLOTS,
  BASIC_ATTACK_RECAST_TYPE,
  CHARACTER_SKILL_MODE,
  CHARACTER_SKILL_SLOT_LABELS,
  PASSIVE_STAT_TYPE,
  areCharacterSkillsEnabled,
  getCharacterSkillDef,
  getCharacterSkillLevel,
  levelValue,
  normalizeSkillState,
  resolveCharacterSkillCode,
} from './characterSkillDefinitionRuntime.js';
import { selectCharacterSkillAiDecision } from './characterSkillAiRuntime.js';
import { calculateCombatDamage, getCombatStats } from './combatDamageRuntime.js';
import { isInSpatialSkillRange, isInBasicAttackRange, spatialDistance, getSpatialPosition } from './combatSpatialRuntime.js';
import { areSameTeam } from './teamRuntime.js';
import { isStatusSupportSkill } from '../../../utils/characterStatusSkillDefinition.js';
import { makeCharacterStatusPayload } from './characterStatusSkillRuntime.js';
import {
  addOrRefreshEffect,
  canUseSkillByStatus,
  isTargetableByStatus,
  applyHealingModifier,
  getEffectiveStats,
  makeShieldEffect,
} from '../../../utils/statusLogic.js';
import { resolveCharacterSkillCooldownSec } from './cooldownRuntime.js';
import { gainSkillResource, spendSkillResource } from './uniqueResourceRuntime.js';
import { resolveCharacterSkillMovement } from './characterSkillMovementRuntime.js';

function readPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 0.25 ? n / 100 : n;
}

function getSkillAmpDamage(actor, def, key, fallbackSettingsKey, settings) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  const scale = Number(def?.[key] ?? skills?.[fallbackSettingsKey] ?? 0);
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const stats = getCombatStats(actor);
  return Math.max(0, Math.round(Number(stats?.skillAmp || 0) * scale));
}

function isPureSupportSkill(def) {
  return isStatusSupportSkill(def);
}

function getSupportSkillAmpValue(actor, def) {
  const scale = Number(def?.skillAmpScale ?? def?.firstSkillAmpScale ?? 0);
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const stats = getCombatStats(actor);
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

function calculateSkillDamage(attacker, defender, def, idx, stage, settings, basicCritical = false) {
  if (isPureSupportSkill(def)) {
    return {
      damage: 0,
      maxHpDamage: 0,
      currentHpDamage: 0,
      skillAmpDamage: 0,
    };
  }

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
  const attackPowerDamage = getCombatStats(attacker).attackPower * Math.max(0, Number(isSecond ? def.secondAttackPowerScale || 0 : def.attackPowerScale || 0));
  const packet = calculateCombatDamage(attacker, defender, { type: def.damageType || 'skill',
    baseDamage: flat + hpScaled.maxHpDamage + hpScaled.currentHpDamage + skillAmpDamage + attackPowerDamage,
    // An enhanced basic attack shares its parent hit's crit roll. Standalone
    // skill estimates must not consume match randomness during target choice.
    critical: basicCritical });
  return {
    damage: packet.damage,
    packet: { ...packet, area: Number(def.radius || 0) > 0 },
    maxHpDamage: hpScaled.maxHpDamage,
    currentHpDamage: hpScaled.currentHpDamage,
    skillAmpDamage,
  };
}

function applySupportUtility(attacker, supportTarget, def, idx) {
  const target = supportTarget || attacker;
  if (Number(target?.hp || 0) <= 0 || !shareCombatSpace(attacker, target) || !isTargetableByStatus(target)) return { healAmount: 0, shieldValue: 0, target };
  let healAmount = Math.max(0, Math.round(levelValue(def.heal, idx, 0)));
  let shieldValue = Math.max(0, Math.round(levelValue(def.shield, idx, 0)));
  const supportAmpValue = getSupportSkillAmpValue(attacker, def);
  if (String(def?.type || '') === 'heal_skill') healAmount += supportAmpValue;
  if (String(def?.type || '') === 'shield_skill') shieldValue += supportAmpValue;
  const maxHp = Math.max(1, Number(target?.maxHp || getEffectiveStats(target)?.maxHp || 100));

  if (healAmount > 0) {
    healAmount = applyHealingModifier(target, healAmount);
    const before = Math.max(0, Number(target.hp || 0));
    target.hp = Math.max(0, Math.min(maxHp, before + healAmount));
    healAmount = Math.max(0, Math.round(Number(target.hp || 0) - before));
  }

  if (shieldValue > 0) {
    const result = addOrRefreshEffect(target, makeShieldEffect(
      shieldValue,
      Math.max(0.000001, Number(def.durationSec || 2)),
      def.id || def.name,
      { tags: ['positive', 'shield', 'character_skill'], durationUnit: 'sec' }
    ));
    target.activeEffects = result.character.activeEffects;
    if (!result.applied) shieldValue = 0;
  }

  return { healAmount, shieldValue, target };
}

function setSkillCooldown(stateSlot, actor, def, nowSec, settings) {
  stateSlot.stage = 'cooldown';
  stateSlot.recastUntil = 0;
  stateSlot.cooldownUntil = nowSec + resolveCharacterSkillCooldownSec(actor, def, settings);
}

function buildSkillLogBits(damageInfo, utility, splashHits, movement = null) {
  const bits = [];
  const splashCount = splashHits.filter((hit) => !hit?.primary).length;
  if (damageInfo.damage > 0) bits.push(`추가 피해 +${damageInfo.damage}`);
  if (damageInfo.maxHpDamage > 0) bits.push(`최대 체력 피해 +${damageInfo.maxHpDamage}`);
  if (damageInfo.currentHpDamage > 0) bits.push(`현재 체력 피해 +${damageInfo.currentHpDamage}`);
  if (utility.healAmount > 0) bits.push(`회복 +${utility.healAmount}`);
  if (utility.shieldValue > 0) bits.push(`보호막 +${utility.shieldValue}`);
  if (splashCount > 0) bits.push(`광역 ${splashCount}명`);
  if (movement?.actualDistance > 0) bits.push(`${movement.movementMode === 'away_from_target' ? '후퇴' : '돌진'} ${movement.actualDistance}m`);
  return bits;
}

function emitUniqueResourceChange(actor, def, change, phase, opts, nowSec) {
  if (!change?.changed) return;
  const delta = phase === 'skill_resolve' ? change.gain : -change.cost;
  opts?.emitRunEvent?.('unique_resource', {
    who: actorId(actor),
    whoName: actor?.name,
    skill: def?.name,
    slot: def?.slot,
    phase,
    resourceName: change.resource.name,
    delta,
    before: change.before,
    after: change.after,
    maxValue: change.resource.maxValue,
  }, opts?.at || null);
}

function makeSkillHit(target, damageInfo, def, stage, opts = {}) {
  return {
    target,
    damage: damageInfo.damage,
    packet: damageInfo.packet,
    maxHpDamage: damageInfo.maxHpDamage,
    currentHpDamage: damageInfo.currentHpDamage,
    skill: def.name,
    stage,
    radius: opts.radius ?? Number(def.radius || 0),
    ...(opts.centerPosition ? { centerPosition: opts.centerPosition } : {}),
    primary: opts.primary === true,
  };
}

function hasSecondStagePayload(def) {
  return [
    ...(Array.isArray(def?.secondFlat) ? def.secondFlat : []),
    ...(Array.isArray(def?.secondMaxHpPct) ? def.secondMaxHpPct : []),
    ...(Array.isArray(def?.secondCurrentHpPct) ? def.secondCurrentHpPct : []),
    Number(def?.secondSkillAmpScale || 0),
  ].some((n) => Number(n || 0) > 0);
}

function canTriggerWithBaseDamage(def, rawBaseDamage) {
  if (rawBaseDamage > 0) return true;
  const type = String(def?.type || '');
  return type === 'attack_skill' || type === 'heal_skill' || type === 'shield_skill';
}

function buildSplashHits(attacker, defender, def, idx, stage, settings, splashTargets, basicCritical = false) {
  const radius = Number(def.radius || 0);
  if (radius <= 0 || !Array.isArray(splashTargets)) return [];
  if (stage < 2 && String(def?.type || '') === BASIC_ATTACK_RECAST_TYPE && hasSecondStagePayload(def)) return [];
  return splashTargets
    .filter((target) => target && actorId(target) !== actorId(defender) && Number(target?.hp || 0) > 0 && isTargetableByStatus(target))
    .filter((target) => !areSameTeam(attacker, target) && spatialDistance(defender, target) <= radius + 1e-6)
    .map((target) => {
      const splashDamage = calculateSkillDamage(attacker, target, def, idx, stage, settings, basicCritical);
      return makeSkillHit(target, splashDamage, def, stage, { radius, centerPosition: { ...getSpatialPosition(defender) } });
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
  const isRecastSkill = String(def.type || '') === BASIC_ATTACK_RECAST_TYPE
    && Number(def.recastWindowSec || 0) > 0
    && hasSecondStagePayload(def);

  if (!opts.prepared && !hasRecast && !cooldownReady) return null;
  if (!opts.prepared && !isRecastSkill && !cooldownReady) return null;

  const level = opts.prepared?.level || getCharacterSkillLevel(attacker, def.slot);
  const idx = level - 1;
  const stage = opts.prepared?.stage || (hasRecast ? 2 : 1);
  const estimateDamage = (target) => calculateSkillDamage(attacker, target, def, idx, stage, settings, opts.basicCritical === true);
  const aiDecision = opts.prepared ? { ...opts.prepared.decision, target: defender, shouldUse: true } : selectCharacterSkillAiDecision({
    attacker,
    defender,
    def,
    idx,
    stage,
    settings,
    splashTargets: opts?.splashTargets,
    supportTargets: opts?.supportTargets,
    estimateDamage,
    opts,
  });
  if (!aiDecision.shouldUse) return null;
  const resourceSpend = opts.prepared
    ? { paid: true, changed: false }
    : spendSkillResource(attacker, def);
  if (!resourceSpend.paid) return null;
  emitUniqueResourceChange(attacker, def, resourceSpend, 'skill_start', opts, nowSec);

  const skillTarget = aiDecision.target || defender;
  const statusPayload = makeCharacterStatusPayload(def, opts.prepared);
  const targetIsDefender = actorId(skillTarget) === actorId(defender);
  const movement = resolveCharacterSkillMovement(attacker, skillTarget, def, {
    nowSec,
    castId: opts.prepared?.castId || '',
    stage,
  }, { emitRunEvent: opts.emitRunEvent, addLog: opts.addLog, at: opts.at });
  const damageInfo = estimateDamage(skillTarget);
  const utility = applySupportUtility(attacker, aiDecision.supportTarget ? skillTarget : attacker, def, idx);

  if (opts.prepared) {
    // Cooldown and recast transitions belong to the cast scheduler.
  } else if (isRecastSkill && !hasRecast && Number(def.recastWindowSec || 0) > 0) {
    slotState.stage = 'recast';
    slotState.recastUntil = nowSec + Math.max(1, Number(def.recastWindowSec || 5));
    slotState.cooldownUntil = nowSec + resolveCharacterSkillCooldownSec(attacker, def, settings);
  } else {
    setSkillCooldown(slotState, attacker, def, nowSec, settings);
  }

  const splashCandidates = targetIsDefender
    ? opts?.splashTargets
    : [defender, ...(Array.isArray(opts?.splashTargets) ? opts.splashTargets : [])];
  const splashHits = !isPureSupportSkill(def)
    ? buildSplashHits(attacker, skillTarget, def, idx, stage, settings, splashCandidates, opts.basicCritical === true)
    : [];
  if (!targetIsDefender && damageInfo.damage > 0) {
    splashHits.unshift(makeSkillHit(skillTarget, damageInfo, def, stage, { primary: true, radius: 0 }));
  }
  if (opts.prepared) {
    const castMeta = { castId: opts.prepared.castId, skill: def.name, slot: def.slot, stage };
    if (damageInfo.packet) damageInfo.packet = { ...damageInfo.packet, ...castMeta };
    splashHits.forEach((hit) => { if (hit.packet) hit.packet = { ...hit.packet, ...castMeta }; });
  }
  if (statusPayload) splashHits.forEach((hit) => { hit.statusPayload = statusPayload; });

  slotState.lastUsedAt = nowSec;
  slotState.lastStage = stage;
  slotState.level = level;
  slotState.source = def.source || '';
  slotState.lastAiReason = aiDecision.reason || '';
  slotState.lastTargetId = actorId(skillTarget);
  slotState.lastCastDelaySec = aiDecision.timing?.castDelaySec || 0;
  slotState.lastRecoveryDelaySec = aiDecision.timing?.recoveryDelaySec || 0;

  const resourceGain = gainSkillResource(attacker, def);
  emitUniqueResourceChange(attacker, def, resourceGain, 'skill_resolve', opts, nowSec);
  const bits = buildSkillLogBits(damageInfo, utility, splashHits, movement);
  if (resourceSpend.changed) bits.push(`${resourceSpend.resource.name} -${resourceSpend.cost}`);
  if (resourceGain.changed) bits.push(`${resourceGain.resource.name} +${resourceGain.gain}`);
  if (typeof opts?.addLog === 'function' && opts?.showLog !== false && bits.length) {
    const label = stage === 2 ? `${CHARACTER_SKILL_SLOT_LABELS[def.slot]}2` : CHARACTER_SKILL_SLOT_LABELS[def.slot];
    opts.addLog(`[${attacker.name}] ${def.name} ${label} → [${skillTarget.name}]: ${bits.join(', ')}`, 'highlight');
  }
  if (typeof opts?.emitRunEvent === 'function' && (bits.length || opts.prepared)) {
    opts.emitRunEvent('skill', {
      who: String(attacker?._id || ''),
      whoName: attacker?.name,
      target: actorId(skillTarget),
      targetName: skillTarget?.name,
      supportTarget: !!aiDecision.supportTarget,
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
      resourceCost: resourceSpend.changed ? resourceSpend.cost : 0,
      resourceGain: resourceGain.gain || 0,
      resourceAfter: resourceGain.after ?? resourceSpend.after,
      movementMode: movement?.movementMode || '',
      movementDistance: movement?.actualDistance || 0,
      splashCount: splashHits.filter((hit) => !hit?.primary).length,
      directRetarget: !targetIsDefender,
      aiReason: aiDecision.reason || '',
      targetPriority: aiDecision.targetPriority || '',
      targetScore: Math.round(Number(aiDecision.targetScore || 0) * 100) / 100,
      castDelaySec: aiDecision.timing?.castDelaySec || 0,
      recoveryDelaySec: aiDecision.timing?.recoveryDelaySec || 0,
      actionLockSec: aiDecision.timing?.actionLockSec || 0,
      zoneId: String(attacker?.zoneId || defender?.zoneId || ''),
      ...(opts.prepared ? { castId: opts.prepared.castId, targetId: actorId(skillTarget), phase: 'release' } : {}),
    }, opts?.at || null);
  }

  const directDamage = targetIsDefender ? damageInfo.damage : 0;
  return {
    damage: directDamage,
    extraDamage: directDamage,
    packet: targetIsDefender ? damageInfo.packet : null,
    stage,
    level,
    skill: def.name,
    slot: def.slot,
    maxHpDamage: targetIsDefender ? damageInfo.maxHpDamage : 0,
    currentHpDamage: targetIsDefender ? damageInfo.currentHpDamage : 0,
    heal: utility.healAmount,
    shield: utility.shieldValue,
    resourceCost: resourceSpend.changed ? resourceSpend.cost : 0,
    resourceGain: resourceGain.gain || 0,
    resourceAfter: resourceGain.after ?? resourceSpend.after,
    movement,
    target: skillTarget,
    targetId: actorId(skillTarget),
    directRetarget: !targetIsDefender,
    aiReason: aiDecision.reason || '',
    targetPriority: aiDecision.targetPriority || '',
    timing: aiDecision.timing,
    splashHits,
    statusPayload,
    applied: bits.length > 0 || !!statusPayload || Number(def.resourceGain || 0) > 0 || !!movement,
  };
}

// Pure selection/estimation shared by the real cast scheduler. The selected
// target is reduced to an ID before a cast is stored on an actor.
export function previewCharacterSkill(attacker, defender, def, stage, opts = {}) {
  const level = getCharacterSkillLevel(attacker, def.slot);
  const decision = selectCharacterSkillAiDecision({ attacker, defender, def, stage, idx: level - 1,
    settings: opts.settings, splashTargets: opts.splashTargets, supportTargets: opts.supportTargets,
    estimateDamage: (target) => calculateSkillDamage(attacker, target, def, level - 1, stage, opts.settings, false), opts });
  if (!decision.shouldUse) return null;
  const { target, scored: _scored, ...savedDecision } = decision;
  return { def, level, stage, targetId: actorId(target), combatSpaceId: getCombatSpaceId(attacker), decision: savedDecision };
}

export function applyPreparedCharacterSkill(attacker, target, prepared, opts = {}) {
  if (isDimensionRiftDefeated(attacker)) return null;
  const enhancement = ['basic_attack_enhance', 'basic_attack_recast'].includes(prepared?.def?.type);
  if (!enhancement && prepared?.combatSpaceId != null && prepared.combatSpaceId !== getCombatSpaceId(attacker)) return null;
  if (!attacker || !target || attacker.hp <= 0 || target.hp <= 0 || !canUseSkillByStatus(attacker, prepared?.def) || !isTargetableByStatus(target)
    || (enhancement ? !isInBasicAttackRange(attacker, target, opts.visionRoster)
      : !isInSpatialSkillRange(attacker, target, prepared.def, opts.settings, opts.visionRoster))) return null;
  const state = normalizeSkillState(attacker);
  const result = applySingleSkillOnBasicAttack(attacker, target, prepared.def, { ...opts, state, prepared });
  attacker.skillState = state;
  return result;
}

export { hasSecondStagePayload };

function applyCharacterSkillOnBasicAttack(attacker, defender, baseDamage, opts = {}) {
  const rawBaseDamage = Math.max(0, Number(baseDamage || 0));
  if (!attacker || !defender || !shareCombatSpace(attacker, defender) || Number(attacker.hp || 0) <= 0 || !canUseSkillByStatus(attacker)) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const settings = opts?.settings || {};
  if (!areCharacterSkillsEnabled(settings)) {
    return { damage: rawBaseDamage, extraDamage: 0, stage: 0, splashHits: [], applied: false };
  }

  const state = normalizeSkillState(attacker);
  const defs = ACTIVE_CHARACTER_SKILL_SLOTS
    .map((slot) => getCharacterSkillDef(attacker, slot))
    .filter((def) => def && String(def.type || '') !== PASSIVE_STAT_TYPE)
    .filter((def) => canUseSkillByStatus(attacker, def))
    .filter((def) => canTriggerWithBaseDamage(def, rawBaseDamage));

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
  const heal = results.reduce((sum, result) => sum + Math.max(0, Number(result.heal || 0)), 0);
  const shield = results.reduce((sum, result) => sum + Math.max(0, Number(result.shield || 0)), 0);
  const actionLockSec = results.reduce((max, result) => Math.max(max, Number(result.timing?.actionLockSec || 0)), 0);
  const castDelaySec = results.reduce((max, result) => Math.max(max, Number(result.timing?.castDelaySec || 0)), 0);
  const recoveryDelaySec = results.reduce((max, result) => Math.max(max, Number(result.timing?.recoveryDelaySec || 0)), 0);
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
    heal,
    shield,
    actionLockSec,
    castDelaySec,
    recoveryDelaySec,
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
