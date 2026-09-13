import { getEffectiveStats, isTargetableByStatus, canUseSkillByStatus } from '../../../utils/statusLogic.js';
import { isInSpatialSkillRange, spatialDistance, getSpatialStats } from './combatSpatialRuntime.js';
import { getCharacterSkillMovementEstimate } from './characterSkillMovementRuntime.js';
import { getCharacterStatusSkillValue } from './characterStatusSkillRuntime.js';
import { getUniqueResourceSnapshot, normalizeSkillResourceAmount } from './uniqueResourceRuntime.js';
import { isStatusSupportSkill } from '../../../utils/characterStatusSkillDefinition.js';
import { areSameTeam } from './teamRuntime.js';

function actorId(actor) {
  return String(actor?._id || actor?.id || '');
}

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().toLowerCase();
  return text || fallback;
}

function readPct(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n > 1 ? n / 100 : n;
}

function hpSnapshot(actor) {
  const stats = getEffectiveStats(actor);
  const maxHp = Math.max(1, Number(actor?.maxHp || stats?.maxHp || 100));
  const hp = Math.max(0, Number(actor?.hp ?? maxHp));
  return {
    hp,
    maxHp,
    ratio: Math.max(0, Math.min(1, hp / maxHp)),
  };
}

function uniqueAliveTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    const id = actorId(target);
    if (!id || seen.has(id) || Number(target?.hp || 0) <= 0 || !isTargetableByStatus(target)) continue;
    seen.add(id);
    out.push(target);
  }
  return out;
}

function isTargetInSkillRange(attacker, target, def, settings, opts = {}) {
  return isInSpatialSkillRange(attacker, target, def, settings, opts.visionRoster);
}

function getSkillTiming(def) {
  const castDelaySec = Math.max(0, Number(def?.castDelaySec || 0));
  const recoveryDelaySec = Math.max(0, Number(def?.recoveryDelaySec || 0));
  return {
    castDelaySec,
    recoveryDelaySec,
    actionLockSec: castDelaySec + recoveryDelaySec,
  };
}

function inferTargetPriority(def, stage) {
  const explicit = cleanText(def?.targetPriority, 'auto');
  if (explicit !== 'auto') return explicit;
  if (Number(def?.radius || 0) > 0) return 'cluster';
  const maxPct = stage === 2 ? def?.secondMaxHpPct : def?.maxHpPct;
  const curPct = stage === 2 ? def?.secondCurrentHpPct : def?.currentHpPct;
  if (Array.isArray(maxPct) && maxPct.some((n) => Number(n || 0) > 0)) return 'highest_max_hp';
  if (Array.isArray(curPct) && curPct.some((n) => Number(n || 0) > 0)) return 'lowest_hp';
  return 'damage';
}

function targetPassesHpCondition(target, def) {
  const targetHp = hpSnapshot(target);
  const minTargetHpPct = readPct(def?.minTargetHpPct, 0);
  const maxTargetHpPct = readPct(def?.maxTargetHpPct, 0);
  if (minTargetHpPct > 0 && targetHp.ratio < minTargetHpPct) return false;
  if (maxTargetHpPct > 0 && targetHp.ratio > maxTargetHpPct) return false;
  return true;
}

function casterPassesHpCondition(attacker, def) {
  const casterHp = hpSnapshot(attacker);
  const minCasterHpPct = readPct(def?.minCasterHpPct, 0);
  const maxCasterHpPct = readPct(def?.maxCasterHpPct, 0);
  if (minCasterHpPct > 0 && casterHp.ratio < minCasterHpPct) return false;
  if (maxCasterHpPct > 0 && casterHp.ratio > maxCasterHpPct) return false;
  return true;
}

function countClusterTargets(target, candidates, radius) {
  if (!target) return 0;
  return uniqueAliveTargets(candidates)
    .filter((candidate) => actorId(candidate) !== actorId(target) && spatialDistance(candidate, target) <= radius + 1e-6)
    .length;
}

function isSupportSkill(def) {
  if (isStatusSupportSkill(def)) return true;
  if (def.statusEffects?.length) return false;
  const hasHeal = Array.isArray(def?.heal) && def.heal.some((n) => Number(n || 0) > 0);
  const hasShield = Array.isArray(def?.shield) && def.shield.some((n) => Number(n || 0) > 0);
  const hasDamage = [
    ...(Array.isArray(def?.firstFlat) ? def.firstFlat : []),
    ...(Array.isArray(def?.flatDamage) ? def.flatDamage : []),
    ...(Array.isArray(def?.secondFlat) ? def.secondFlat : []),
    ...(Array.isArray(def?.maxHpPct) ? def.maxHpPct : []),
    ...(Array.isArray(def?.currentHpPct) ? def.currentHpPct : []),
    ...(Array.isArray(def?.secondMaxHpPct) ? def.secondMaxHpPct : []),
    ...(Array.isArray(def?.secondCurrentHpPct) ? def.secondCurrentHpPct : []),
    Number(def?.skillAmpScale || 0),
    Number(def?.firstSkillAmpScale || 0),
    Number(def?.secondSkillAmpScale || 0),
  ].some((n) => Number(n || 0) > 0);
  return (hasHeal || hasShield) && !hasDamage;
}

function getNetResourceGain(attacker, def) {
  const { resource, value } = getUniqueResourceSnapshot(attacker);
  if (!resource.enabled) return 0;
  const cost = normalizeSkillResourceAmount(def?.resourceCost);
  const gain = normalizeSkillResourceAmount(def?.resourceGain);
  if (gain <= 0 || value < cost) return 0;
  return Math.max(0, Math.min(resource.maxValue, value - cost + gain) - value);
}

function getMovementUtility(attacker, target, def, opts = {}) {
  const estimate = getCharacterSkillMovementEstimate(attacker, target, def, {
    ignoreStatus: opts.previewFuture === true,
    nowSec: opts.nowSec,
  });
  if (!estimate) return { value: 0, estimate: null };
  if (estimate.movementMode === 'toward_target') {
    const gap = Math.max(0, spatialDistance(attacker, target) - getSpatialStats(attacker).attackRange);
    const usefulDistance = Math.min(estimate.actualDistance, gap);
    return { value: usefulDistance > 0 ? usefulDistance * 24 : 0, estimate };
  }
  const hp = hpSnapshot(attacker);
  const threshold = readPct(def?.maxCasterHpPct, 0) || 0.55;
  return { value: hp.ratio <= threshold ? estimate.actualDistance * 24 + (1 - hp.ratio) * 30 : 0, estimate };
}

function scoreTarget({ target, def, priority, candidates, damageInfo, attacker, resourceValue = 0, opts = {} }) {
  const hp = hpSnapshot(target);
  const expectedDamage = Math.max(0, Number(damageInfo?.damage || 0));
  const killable = hp.hp > 0 && expectedDamage >= hp.hp;
  const clusterCount = Number(def?.radius || 0) > 0 ? countClusterTargets(target, candidates, Number(def.radius)) : 0;
  const statusValue = getCharacterStatusSkillValue(attacker, target, def);
  const movement = getMovementUtility(attacker, target, def, opts);
  let score = expectedDamage + statusValue + resourceValue + movement.value;

  if (killable) score += 80;
  if (priority === 'killable') score += killable ? 120 : (1 - hp.ratio) * 30;
  else if (priority === 'lowest_hp') score += (1 - hp.ratio) * 45 + Math.max(0, 80 - hp.hp) * 0.2;
  else if (priority === 'highest_max_hp') score += hp.maxHp * 0.12 + hp.hp * 0.04;
  else if (priority === 'cluster') score += clusterCount * 30 + (killable ? 40 : 0);
  else score += (1 - hp.ratio) * 20 + clusterCount * 12;

  return {
    clusterCount,
    expectedDamage,
    statusValue,
    movementValue: movement.value,
    movementMode: movement.estimate?.movementMode || '',
    killable,
    score,
    target,
  };
}

function hasUtilityPayload(def, idx) {
  const heal = Array.isArray(def?.heal) ? Number(def.heal[idx] || 0) : 0;
  const shield = Array.isArray(def?.shield) ? Number(def.shield[idx] || 0) : 0;
  return heal > 0 || shield > 0;
}

function utilityIsWorthUsing(target, def, idx, attacker = target) {
  if (getCharacterStatusSkillValue(attacker, target, def) > 0) return true;
  if (getNetResourceGain(attacker, def) > 0) return true;
  if (!hasUtilityPayload(def, idx)) return false;
  const targetHp = hpSnapshot(target);
  const heal = Array.isArray(def?.heal) ? Number(def.heal[idx] || 0) : 0;
  const shield = Array.isArray(def?.shield) ? Number(def.shield[idx] || 0) : 0;
  const maxTargetHpPct = readPct(def?.maxTargetHpPct, 0);
  const maxCasterHpPct = readPct(def?.maxCasterHpPct, 0);
  const defaultThreshold = maxTargetHpPct > 0 ? maxTargetHpPct : maxCasterHpPct > 0 ? maxCasterHpPct : 0.75;
  const canHeal = heal > 0 && targetHp.hp < targetHp.maxHp && targetHp.ratio <= defaultThreshold;
  return canHeal || shield > 0;
}

function scoreSupportTarget({ target, def, idx, attacker }) {
  const hp = hpSnapshot(target);
  const heal = Array.isArray(def?.heal) ? Math.max(0, Number(def.heal[idx] || 0)) : 0;
  const shield = Array.isArray(def?.shield) ? Math.max(0, Number(def.shield[idx] || 0)) : 0;
  const missingHp = Math.max(0, hp.maxHp - hp.hp);
  const healValue = Math.min(heal, missingHp);
  const shieldValue = shield > 0 ? shield * (1.1 + Math.max(0, 1 - hp.ratio)) : 0;
  return {
    clusterCount: 0,
    expectedDamage: 0,
    killable: false,
    score: healValue * 2 + shieldValue + (1 - hp.ratio) * 80 + (actorId(target) ? 1 : 0)
      + getCharacterStatusSkillValue(attacker, target, def) + getNetResourceGain(attacker, def),
    target,
  };
}

function supportCandidatePool(attacker, supportTargets, def) {
  const scope = String(def?.supportTargetScope || 'auto');
  if (scope === 'self') return [attacker];
  if (scope === 'ally') return Array.isArray(supportTargets) ? supportTargets : [];
  return [attacker, ...(Array.isArray(supportTargets) ? supportTargets : [])];
}

function selectSupportTarget({
  attacker,
  def,
  idx,
  settings,
  supportTargets,
  opts,
}) {
  const supportCandidates = uniqueAliveTargets(supportCandidatePool(attacker, supportTargets, def))
    .filter((target) => actorId(target) === actorId(attacker) || areSameTeam(attacker, target))
    .filter((target) => actorId(target) === actorId(attacker) || isTargetInSkillRange(attacker, target, def, settings, opts))
    .filter((target) => targetPassesHpCondition(target, def))
    .map((target) => scoreSupportTarget({ target, def, idx, attacker }))
    .sort((a, b) => b.score - a.score);
  const useful = supportCandidates.filter((entry) => utilityIsWorthUsing(entry.target, def, idx, attacker));
  return {
    scored: supportCandidates,
    best: useful[0] || null,
  };
}

function isBasicAttackEnhanceSkill(def) {
  const type = String(def?.type || '');
  return type === 'basic_attack_enhance' || type === 'basic_attack_recast';
}

export function selectCharacterSkillAiDecision({
  attacker,
  defender,
  def,
  idx = 0,
  stage = 1,
  settings = {},
  splashTargets = [],
  supportTargets = [],
  estimateDamage = () => ({ damage: 0 }),
  opts = {},
} = {}) {
  if (!attacker || !defender || !def) {
    return { shouldUse: false, reason: 'missing_context', timing: getSkillTiming(def) };
  }

  const timing = getSkillTiming(def);
  opts = { ...opts, visionRoster: opts.visionRoster || [attacker, defender, ...splashTargets, ...supportTargets] };
  if (!opts.previewFuture && !canUseSkillByStatus(attacker, def)) return { shouldUse: false, reason: 'status_restriction', timing };
  if (!casterPassesHpCondition(attacker, def)) {
    return { shouldUse: false, reason: 'caster_hp_condition', timing };
  }

  if (isSupportSkill(def)) {
    const { scored, best } = selectSupportTarget({
      attacker,
      def,
      idx,
      settings,
      supportTargets,
      opts,
    });
    if (!best) return { shouldUse: false, reason: 'no_support_value', scored, timing };

    const useCondition = cleanText(def?.useCondition, 'auto');
    const casterHp = hpSnapshot(attacker);
    if (useCondition === 'defensive' && casterHp.ratio > 0.55 && actorId(best.target) === actorId(attacker)) {
      return { shouldUse: false, reason: 'defensive_condition_not_met', scored, timing };
    }

    return {
      shouldUse: true,
      reason: useCondition !== 'auto' ? useCondition : def.statusEffects?.length ? 'support_status' : 'support_low_hp',
      target: best.target,
      targetPriority: 'support_low_hp',
      targetScore: best.score,
      expectedDamage: 0,
      clusterCount: 0,
      lockToAttackTarget: false,
      supportTarget: true,
      timing,
    };
  }

  const lockToAttackTarget = def?.lockToAttackTarget !== false && isBasicAttackEnhanceSkill(def);
  const allCandidates = uniqueAliveTargets([defender, ...splashTargets])
    .filter((target) => actorId(target) !== actorId(attacker))
    .filter((target) => !areSameTeam(attacker, target))
    .filter((target) => targetPassesHpCondition(target, def))
    .filter((target) => isTargetInSkillRange(attacker, target, def, settings, opts));
  const candidates = lockToAttackTarget
    ? allCandidates.filter((target) => actorId(target) === actorId(defender))
    : allCandidates;

  if (!candidates.length) return { shouldUse: false, reason: 'no_target_in_range', timing };

  const priority = inferTargetPriority(def, stage);
  const useCondition = cleanText(def?.useCondition, 'auto');
  const resourceValue = getNetResourceGain(attacker, def);
  const scored = candidates
    .map((target) => scoreTarget({
      target,
      attacker,
      def,
      priority,
      candidates: allCandidates,
      damageInfo: estimateDamage(target),
      resourceValue,
      opts,
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const minExpectedDamage = useCondition === 'harass' ? 0 : Math.max(0, Number(def?.minExpectedDamage ?? 1));
  const minSplashTargets = Math.max(0, Math.floor(Number(def?.minSplashTargets || 0)));
  const utilityUseful = utilityIsWorthUsing(attacker, def, idx) || best.statusValue > 0 || resourceValue > 0 || best.movementValue > 0;
  const recastPressure = stage === 2 && Number(def?.recastWindowSec || 0) > 0;
  const casterHp = hpSnapshot(attacker);

  if (minSplashTargets > 0 && best.clusterCount < minSplashTargets) {
    return { shouldUse: false, reason: 'not_enough_splash_targets', scored, timing };
  }
  if (useCondition === 'finish' && !best.killable) {
    return { shouldUse: false, reason: 'finish_condition_not_met', scored, timing };
  }
  if (useCondition === 'defensive' && !utilityUseful && casterHp.ratio > 0.55) {
    return { shouldUse: false, reason: 'defensive_condition_not_met', scored, timing };
  }
  if (!utilityUseful && !recastPressure && best.expectedDamage < minExpectedDamage) {
    return { shouldUse: false, reason: 'low_expected_value', scored, timing };
  }

  return {
    shouldUse: true,
    reason: best.killable ? 'killable' : useCondition !== 'auto' ? useCondition
      : resourceValue > 0 && best.expectedDamage <= 0 ? 'resource_gain'
        : best.movementValue > 0 && best.expectedDamage <= 0 ? `movement_${best.movementMode}` : priority,
    target: best.target,
    targetPriority: priority,
    targetScore: best.score,
    expectedDamage: best.expectedDamage,
    clusterCount: best.clusterCount,
    movementValue: best.movementValue,
    lockToAttackTarget,
    timing,
  };
}
