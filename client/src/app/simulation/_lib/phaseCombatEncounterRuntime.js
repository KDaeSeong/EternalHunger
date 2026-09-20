import { resolveCombatWinnerOutcome } from './phaseCombatDamageRuntime';
import { createPhaseCombatEliminationRuntime } from './phaseCombatEliminationRuntime';
import { createPhaseCombatFleeRuntime } from './phaseCombatFleeRuntime';
import { createPhaseCombatSkillSplashRuntime } from './phaseCombatSkillSplashRuntime';
import { createPhaseCombatTacticalRuntime } from './phaseCombatTacticalRuntime';
import { canJoinTeamCombat, runTeamCombatRound } from './teamCombatRuntime';
import { engageCombatParticipants } from './combatTimingRuntime.js';
import { isAiRecoveryLocked } from './survivorLifecycleRuntime';
import { shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { hasActionBlockStatus, canMoveByStatus, isTargetableByStatus, getForcedControlEffect } from '../../../utils/statusLogic.js';

export function runPhaseCombatEncounter({
  actions = {},
  state = {},
} = {}) {
  let {
    actor = null,
    target = null,
    assistWindowPhases = 0,
    battleSettings = {},
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    estimatePower = () => 0,
    forbiddenIds = new Set(),
    isSoloMatch = false,
    itemMetaById,
    itemNameById,
    newDeadIds = [],
    nextDay = 1,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    publicItems = [],
    restrictedRatio = 0,
    reviveCutoffIdx = 0,
    roundAssists = {},
    roundKills = {},
    ruleset = {},
    shouldAvoidCombatByPower = () => null,
    survivorMap = new Map(),
    todaysSurvivors = [],
    totalZonesCount = 0,
    useDetonation = false,
    zoneGraph = {},
    actionType = 'exchange',
    preparedSkill = null,
  } = state;
  const {
    addEarnedCredits = () => {},
    addLog = () => {},
    appendPhaseDeadSnapshots = (victim) => victim,
    applyErTraitAfterBattle = () => null,
    applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitEffectRunEvents = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantPvpDamageMastery = () => {},
    grantPvpKillMastery = () => {},
    setDeathMetadata = () => {},
    tryUseConsumable = () => {},
  } = actions;

  if (!actor || !target) return { actor, target, skipRemainingTurn: false };
  actor = survivorMap.get(String(actor._id || '')) || actor;
  target = survivorMap.get(String(target._id || '')) || target;
  if (!shareCombatSpace(actor, target) || String(actor.zoneId) !== String(target.zoneId)) return { actor, target, skipRemainingTurn: true };
  if (Number(actor.hp || 0) <= 0 || Number(target.hp || 0) <= 0 || !isTargetableByStatus(target) || newDeadIds.includes(String(actor._id)) || newDeadIds.includes(String(target._id))) {
    return { actor, target, skipRemainingTurn: true };
  }

  const absNow = currentActionSec();
  tryUseConsumable(actor, 'before_battle');
  tryUseConsumable(target, 'before_battle');
  const tacticalRuntime = createPhaseCombatTacticalRuntime({
    state: {
      absNow,
      battleSettings,
      ruleset,
    },
    actions: {
      addLog,
      atNow,
      emitEffectRunEvents,
      emitRunEvent,
    },
  });
  const {
    applyCombatTacAttack,
    applyTacUse,
    canUseTac,
    normalizeTac,
    shieldBlock,
    tacModuleLevel,
  } = tacticalRuntime;
  const combatFleeRuntime = createPhaseCombatFleeRuntime({
    state: {
      battleSettings,
      currentActionSec,
      estimatePower,
      forbiddenIds,
      newDeadIds,
      restrictedRatio,
      ruleset,
      survivorMap,
      totalZonesCount,
      zoneGraph,
    },
    actions: {
      addLog,
      atNow,
      emitEffectRunEvents,
      emitRunEvent,
      getZoneName,
    },
    tactical: {
      applyTacUse,
      canUseTac,
      normalizeTac,
      tacModuleLevel,
    },
  });
  const {
    pickSparseSafeNeighbor,
    resolveFleeSequence,
  } = combatFleeRuntime;
  const pvpCfg = ruleset?.pvp || {};
  const combatEliminationRuntime = createPhaseCombatEliminationRuntime({
    state: {
      assistWindowPhases,
      canReviveThisMatch,
      craftables,
      currentActionSec,
      itemMetaById,
      itemNameById,
      isSoloMatch,
      newDeadIds,
      nextDay,
      phaseIdxNow,
      phaseSurvivors,
      publicItems,
      pvpCfg,
      reviveCutoffIdx,
      roundAssists,
      roundKills,
      ruleset,
      sourceActor: actor,
      survivorMap,
      todaysSurvivors,
      useDetonation,
    },
    actions: {
      addEarnedCredits,
      addLog,
      appendPhaseDeadSnapshots,
      applyErTraitAfterBattle,
      atNow,
      emitDeathRunEventOnce,
      emitRunEvent,
      flushDeadSnapshots,
      getZoneName,
      grantPvpKillMastery,
      pickSparseSafeNeighbor,
      setDeathMetadata,
      tryUseConsumable,
    },
  });
  const { applyCombatElimination } = combatEliminationRuntime;
  const skillSplashRuntime = createPhaseCombatSkillSplashRuntime({
    state: {
      newDeadIds,
      phaseIdxNow,
      survivorMap,
    },
    actions: {
      addLog,
      applyCombatElimination,
      atNow,
      emitRunEvent,
      grantPvpDamageMastery,
      shieldBlock,
    },
  });
  const {
    applyCharacterSkillSplashDamage,
    getCharacterSkillSplashTargets,
  } = skillSplashRuntime;

  const escapeOutcome = (() => {
    if (actionType === 'skill_release') return null;
    const curZone = String(actor?.zoneId || target?.zoneId || '');
    if (!curZone) return null;

    const hpBelow = Number(ruleset?.ai?.escapeHpBelow ?? 42);
    const aAvoid = shouldAvoidCombatByPower(actor, target);
    const bAvoid = shouldAvoidCombatByPower(target, actor);
    const aWants = canMoveByStatus(actor) && ((Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= hpBelow) || !!aAvoid);
    const bWants = canMoveByStatus(target) && ((Number(target.hp || 0) > 0 && Number(target.hp || 0) <= hpBelow) || !!bAvoid);
    if (!aWants && !bWants) return null;

    let flee = null;
    let chaser = null;
    if (aWants && !bWants) {
      flee = actor;
      chaser = target;
    } else if (!aWants && bWants) {
      flee = target;
      chaser = actor;
    } else {
      const actorHp = Number(actor.hp || 0);
      const targetHp = Number(target.hp || 0);
      if (actorHp !== targetHp) {
        flee = (actorHp < targetHp) ? actor : target;
      } else {
        const actorRatio = aAvoid ? Number(aAvoid.ratio || 0.5) : 0.5;
        const targetRatio = bAvoid ? Number(bAvoid.ratio || 0.5) : 0.5;
        flee = (actorRatio < targetRatio) ? actor : target;
      }
      chaser = (flee === actor) ? target : actor;
    }
    const lowHp = Number(flee.hp || 0) <= hpBelow;
    const avoidanceInfo = flee === actor ? aAvoid : bAvoid;
    return resolveFleeSequence(flee, chaser, { curZone, reason: lowHp ? 'low_hp' : avoidanceInfo?.reason || 'power_gap',
      hpThreshold: lowHp ? hpBelow : null,
      comparison: lowHp ? null : avoidanceInfo?.comparison || avoidanceInfo });
  })();

  if (escapeOutcome && escapeOutcome.escaped && !escapeOutcome.caught) {
    actor = survivorMap.get(actor._id) || actor;
    target = survivorMap.get(target._id) || target;
    return { actor, target, skipRemainingTurn: true };
  }

  if (escapeOutcome && escapeOutcome.escaped && escapeOutcome.caught) {
    const fleeNow = survivorMap.get(escapeOutcome.fleeId);
    const chaserNow = survivorMap.get(escapeOutcome.chaserId);
    if (fleeNow && Number(fleeNow.hp || 0) <= 0 && chaserNow) {
      applyCombatElimination(chaserNow, fleeNow, { killText: '추격 제압' });
      return { actor, target, skipRemainingTurn: true };
    }
  }

  actor = survivorMap.get(actor._id) || actor;
  target = survivorMap.get(target._id) || target;

  if (actionType !== 'skill_release' && !getForcedControlEffect(actor)) engageCombatParticipants(actor, target, [...survivorMap.values()], currentActionSec(), {
    teamCombat: !isSoloMatch && ruleset?.pvp?.teamCombatEnabled !== false,
  });
  if (actionType === 'discover') return { actor, target, skipRemainingTurn: false };

  const resolvePair = (striker, victim, strikeOnly = false) => resolveCombatWinnerOutcome({
    actions: { addLog, applyErTraitAfterBattle, applyErWeaponSkillAfterCombat, atNow, emitRunEvent, grantPvpDamageMastery },
    combatElimination: { applyCombatElimination },
    flee: { resolveFleeSequence },
    skillSplash: { applyCharacterSkillSplashDamage, getCharacterSkillSplashTargets },
    state: { actor: striker, target: victim, battleSettings, currentActionSec, phaseIdxNow, pvpCfg,
      supportRoster: [...survivorMap.values()], strikeOnly, preparedSkill },
    tactical: { applyCombatTacAttack, shieldBlock },
  });

  if (actionType === 'skill_release') return resolvePair(actor, target, true);

  if (!isSoloMatch && ruleset?.pvp?.teamCombatEnabled !== false) {
    const round = runTeamCombatRound({ actor, target, survivorMap, newDeadIds, nowSec: currentActionSec(),
      estimatePower, todaysSurvivors, onlyActorId: actionType === 'basic' ? String(actor._id) : '',
      addLog, emitRunEvent, at: atNow(),
      resolveStrike: (striker, victim) => {
        const result = resolvePair(striker, victim, true);
        survivorMap.set(String(striker._id), result.actor || striker);
        survivorMap.set(String(victim._id), result.target || victim);
        return result;
      },
    });
    if (round.handled) return { actor: survivorMap.get(String(actor._id)) || actor,
      target: survivorMap.get(String(target._id)) || target, teamRound: round, skipRemainingTurn: false };
  }
  const nowSec = currentActionSec();
  const eligible = (actionType === 'basic' ? [actor] : [actor, target]).filter((row) => canJoinTeamCombat(row, { nowSec, zoneId: String(actor.zoneId), newDeadIds }));
  for (const striker of eligible) {
    const victim = striker === actor ? target : actor;
    if (striker.hp <= 0 || victim.hp <= 0 || hasActionBlockStatus(striker) || isAiRecoveryLocked(striker, nowSec)
      || String(striker.zoneId) !== String(victim.zoneId)) continue;
    resolvePair(striker, victim, true);
    survivorMap.set(String(striker._id), striker);
    survivorMap.set(String(victim._id), victim);
  }
  return { actor, target, skipRemainingTurn: false };
}
