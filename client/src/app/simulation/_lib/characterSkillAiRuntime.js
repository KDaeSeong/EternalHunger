import { getEffectiveStats } from '../../../utils/statusLogic.js';

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

function sameZone(a, b) {
  const az = String(a?.zoneId || '');
  const bz = String(b?.zoneId || '');
  return Boolean(az && bz && az === bz);
}

function uniqueAliveTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    const id = actorId(target);
    if (!id || seen.has(id) || Number(target?.hp || 0) <= 0) continue;
    seen.add(id);
    out.push(target);
  }
  return out;
}

function getSkillRange(attacker, def, settings = {}) {
  const explicit = Number(def?.range);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const defaultSkillRange = Number(settings?.skills?.defaultCharacterSkillRange || 0);
  if (Number.isFinite(defaultSkillRange) && defaultSkillRange > 0) return defaultSkillRange;
  const stats = getEffectiveStats(attacker);
  return Math.max(0.5, Number(stats?.attackRange || 1));
}

function isTargetInSkillRange(attacker, target, def, settings, opts = {}) {
  if (!attacker || !target || !sameZone(attacker, target)) return false;
  const encounterRange = Math.max(0.1, Number(opts.encounterRange ?? 0.5));
  return getSkillRange(attacker, def, settings) >= encounterRange;
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

function countClusterTargets(target, candidates) {
  if (!target) return 0;
  return uniqueAliveTargets(candidates)
    .filter((candidate) => actorId(candidate) !== actorId(target) && sameZone(candidate, target))
    .length;
}

function isSupportSkill(def) {
  const type = String(def?.type || '');
  if (type === 'heal_skill' || type === 'shield_skill') return true;
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

function scoreTarget({ target, def, priority, candidates, damageInfo }) {
  const hp = hpSnapshot(target);
  const expectedDamage = Math.max(0, Number(damageInfo?.damage || 0));
  const killable = hp.hp > 0 && expectedDamage >= hp.hp;
  const clusterCount = Number(def?.radius || 0) > 0 ? countClusterTargets(target, candidates) : 0;
  let score = expectedDamage;

  if (killable) score += 80;
  if (priority === 'killable') score += killable ? 120 : (1 - hp.ratio) * 30;
  else if (priority === 'lowest_hp') score += (1 - hp.ratio) * 45 + Math.max(0, 80 - hp.hp) * 0.2;
  else if (priority === 'highest_max_hp') score += hp.maxHp * 0.12 + hp.hp * 0.04;
  else if (priority === 'cluster') score += clusterCount * 30 + (killable ? 40 : 0);
  else score += (1 - hp.ratio) * 20 + clusterCount * 12;

  return {
    clusterCount,
    expectedDamage,
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

function utilityIsWorthUsing(target, def, idx) {
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

function scoreSupportTarget({ target, def, idx }) {
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
    score: healValue * 2 + shieldValue + (1 - hp.ratio) * 80 + (actorId(target) ? 1 : 0),
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
    .filter((target) => actorId(target) === actorId(attacker) || isTargetInSkillRange(attacker, target, def, settings, opts))
    .filter((target) => targetPassesHpCondition(target, def))
    .map((target) => scoreSupportTarget({ target, def, idx }))
    .sort((a, b) => b.score - a.score);
  const useful = supportCandidates.filter((entry) => utilityIsWorthUsing(entry.target, def, idx));
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
      reason: useCondition !== 'auto' ? useCondition : 'support_low_hp',
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
    .filter((target) => targetPassesHpCondition(target, def))
    .filter((target) => isTargetInSkillRange(attacker, target, def, settings, opts));
  const candidates = lockToAttackTarget
    ? allCandidates.filter((target) => actorId(target) === actorId(defender))
    : allCandidates;

  if (!candidates.length) return { shouldUse: false, reason: 'no_target_in_range', timing };

  const priority = inferTargetPriority(def, stage);
  const useCondition = cleanText(def?.useCondition, 'auto');
  const scored = candidates
    .map((target) => scoreTarget({
      target,
      def,
      priority,
      candidates: allCandidates,
      damageInfo: estimateDamage(target),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const minExpectedDamage = useCondition === 'harass' ? 0 : Math.max(0, Number(def?.minExpectedDamage ?? 1));
  const minSplashTargets = Math.max(0, Math.floor(Number(def?.minSplashTargets || 0)));
  const utilityUseful = utilityIsWorthUsing(attacker, def, idx);
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
    reason: best.killable ? 'killable' : useCondition !== 'auto' ? useCondition : priority,
    target: best.target,
    targetPriority: priority,
    targetScore: best.score,
    expectedDamage: best.expectedDamage,
    clusterCount: best.clusterCount,
    lockToAttackTarget,
    timing,
  };
}
