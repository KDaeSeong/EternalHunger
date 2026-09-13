import { canMoveByStatus } from '../../../utils/statusLogic.js';
import {
  areSameTeam,
  buildCraftGoal,
  chooseAiMoveTargets,
  computeLateGameUpgradeNeed,
  getActorPerkEffects,
  pickGoalLoadoutKeys,
  uniqStrings,
} from './simulationEngine';
import { formatMoveIntentLabel } from './moveIntentRuntime';
import {
  estimateMovePower,
  shouldAvoidCombatByMovePower,
} from './movePowerRuntime';
import { advanceActorRouteProgressForGoal } from './phaseRouteProgressRuntime';
import {
  applyActorKnockbackMovement,
  clearActorMoveTargetMemory,
  initializeActorPhaseMovementState,
  resolveActorMoveTargetMemory,
  resolveActorNextMoveZone,
} from './actorMovementDecisionHelpers';
import { getLumiaWalkEtaSec } from './lumiaMapGeometryRuntime';
import { assessTeamCombat, pickTeamSafeZone } from './teamTacticsRuntime';
import { getActorTeamId } from './teamRuntime';
import { refreshActorGrowthPlan } from './growthPlanRuntime';
import { pickEndgameMove } from './suddenDeathRuntime';
import { shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { getActorDimensionRiftId } from './dimensionRiftSpaceRuntime.js';
import {
  consumeRetreatAvoidDecision,
  getRetreatAvoidZoneId,
  rememberRetreatOrigin,
} from './retreatDecisionMemoryRuntime.js';

export {
  applyActorKnockbackMovement,
  clearActorMoveTargetMemory,
  initializeActorPhaseMovementState,
  resolveActorMoveTargetMemory,
  resolveActorNextMoveZone,
};

export function runActorMovementDecisionPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    forbiddenIds = new Set(),
    hyperloopDelaySec = 3,
    isSoloMatch = false,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    mapObj,
    movePowerContext = {},
    nextDay,
    nextPhase,
    nextSpawn,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    ruleset,
    teamMovementPlan = null,
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    isHyperloopTransit = () => false,
    reserveActionSecond = () => {},
  } = actions;

  if (getActorDimensionRiftId(actor)) {
    const currentZone = String(actor.zoneId || '');
    return { actor, currentZone, nextZoneId: currentZone, didMove: false, mustEscape: false,
      holdTarget: true, moveTargets: [], moveReason: 'dimension_rift_wait', moveEtaSec: 0,
      usedHyperloopMove: false, moveContestPressure: 0, moveObjectiveType: 'dimension_rift',
      moveObjectiveSubkind: '', fleeInterruptReason: '', recovering: false };
  }

  let updated = initializeActorPhaseMovementState(actor, {
    itemKeyById,
    ruleset,
  });

  const knockbackMovement = applyActorKnockbackMovement({
    state: {
      actor: updated,
      forbiddenIds,
      zoneGraph,
      zones,
    },
    actions: {
      addLog,
      atNow,
      emitRunEvent,
      getZoneName,
    },
  });
  updated = knockbackMovement.actor;
  const currentZone = knockbackMovement.currentZone;
  const neighbors = knockbackMovement.neighbors;
  const retreatAvoidZoneId = getRetreatAvoidZoneId(updated);
  const previousGrowth = updated._growthPlan;
  const growthPlan = refreshActorGrowthPlan(updated, state.publicItems, { mapObj, zoneGraph, forbiddenIds, nextSpawn });
  if (previousGrowth?.targetZoneId && growthPlan?.targetZoneId !== previousGrowth.targetZoneId && nextSpawn?.fieldResources) {
    const exhausted = (previousGrowth.missing || []).filter((row) => row.zones.includes(previousGrowth.targetZoneId)
      && nextSpawn.fieldResources.byZone?.[previousGrowth.targetZoneId]?.[row.itemId]?.remaining === 0);
    if (exhausted.length) {
      emitRunEvent('resource_replan', { who: String(updated._id), from: previousGrowth.targetZoneId,
        to: growthPlan?.targetZoneId || '', itemIds: exhausted.map((row) => row.itemId), blocked: growthPlan?.blocked || '' }, atNow());
      addLog(`🧭 [${updated.name}] ${getZoneName(previousGrowth.targetZoneId)}의 필요한 재료 소진 → ${growthPlan?.targetZoneId ? getZoneName(growthPlan.targetZoneId) + ' 재탐색' : '다른 성장 목표 검토'}`, 'normal');
    }
  }

  const mustEscape = forbiddenIds.has(currentZone);
  const preGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
    goalTier: updated?.goalGearTier,
    goalItemKeys: pickGoalLoadoutKeys(updated),
    perkEffects: getActorPerkEffects(updated),
  });
  const upgradeNeed = computeLateGameUpgradeNeed(updated, itemMetaById, itemNameById, nextDay, nextPhase, ruleset);
  const aiCfg = ruleset?.ai || {};
  const recoverHpBelow = Math.max(0, Number(aiCfg?.recoverHpBelow ?? 38));
  const sameZoneOpponents = (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).filter((target) => (
    target
    && shareCombatSpace(updated, target)
    && String(target?._id || '') !== String(updated?._id || '')
    && !areSameTeam(updated, target)
    && Number(target?.hp || 0) > 0
    && String(target?.zoneId || '') === String(currentZone)
  ));
  const worstSameZoneOpponent = sameZoneOpponents
    .slice()
    .sort((a, b) => Number(estimateMovePower(b, movePowerContext) || 0) - Number(estimateMovePower(a, movePowerContext) || 0))[0] || null;
  const avoidInfoNow = worstSameZoneOpponent ? shouldAvoidCombatByMovePower(updated, worstSameZoneOpponent, movePowerContext) : null;
  const estimatePower = (row) => estimateMovePower(row, movePowerContext);
  const teamAssessment = assessTeamCombat(updated, phaseSurvivors, {
    estimatePower, minRatio: Number(aiCfg?.fightAvoidMinRatio ?? 0.4),
  });
  const useTeamAssessment = !isSoloMatch && (teamAssessment.allyCount > 1 || teamAssessment.enemyCount > 1);
  const extremeRatio = Number(aiCfg?.fightAvoidExtremeRatio ?? 0.30);
  const extremeDelta = Number(aiCfg?.fightAvoidExtremeDelta ?? 25);
  const lowHpFleeInterrupt = !mustEscape && sameZoneOpponents.length > 0 && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;
  const powerFleeInterrupt = !mustEscape && (useTeamAssessment ? teamAssessment.shouldAvoid
    : !!avoidInfoNow && ((Number(avoidInfoNow?.ratio || 1) < extremeRatio) || ((Number(avoidInfoNow?.opP || 0) - Number(avoidInfoNow?.myP || 0)) >= extremeDelta)));
  const fleeInterruptReason = mustEscape ? 'forbidden' : (lowHpFleeInterrupt ? 'low_hp' : (powerFleeInterrupt ? (useTeamAssessment ? teamAssessment.reason : 'power_gap') : ''));
  const recovering = !mustEscape && !fleeInterruptReason && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;
  const growthActive = growthPlan && !growthPlan.openingComplete && !growthPlan.blocked;
  let activeTeamPlan = !mustEscape && !recovering && !fleeInterruptReason && !growthActive ? teamMovementPlan : null;
  // The grouped-team planner has already made and paid for the leader's
  // objective choice. Do not run every member's individual random chooser or
  // allocate target-memory TTLs that are immediately discarded by that plan.
  const targetMemory = activeTeamPlan
    ? {
      actor: clearActorMoveTargetMemory(updated),
      holdTarget: null,
      moveTargets: [activeTeamPlan.nextStep],
      moveReason: activeTeamPlan.mode,
      moveObjectiveType: activeTeamPlan.objectiveType,
      moveObjectiveSubkind: activeTeamPlan.objectiveSubkind,
      moveContestPressure: activeTeamPlan.contestPressure,
    }
    : resolveActorMoveTargetMemory({
      state: {
        actor: updated,
        aiMove: chooseAiMoveTargets({
          actor: updated,
          craftGoal: preGoal,
          upgradeNeed,
          mapObj,
          spawnState: nextSpawn,
          forbiddenIds,
          day: nextDay,
          phase: nextPhase,
          kiosks,
          itemMetaById,
          itemNameById,
          nowSec: state.currentActionSec?.(),
          ruleset,
          isSoloMatch,
        }),
        currentZone,
        day: nextDay,
        forbiddenIds,
        mustEscape,
        phase: nextPhase,
        ruleset,
      },
    });
  updated = targetMemory.actor;
  const holdTarget = targetMemory.holdTarget;
  let moveTargets = targetMemory.moveTargets;
  let moveReason = targetMemory.moveReason;
  let moveObjectiveType = targetMemory.moveObjectiveType;
  let moveObjectiveSubkind = targetMemory.moveObjectiveSubkind;
  let moveContestPressure = targetMemory.moveContestPressure;
  if (!mustEscape && !recovering && !fleeInterruptReason && growthPlan && !growthPlan.blocked && !activeTeamPlan
    && !(growthPlan.openingComplete && moveObjectiveType === 'dimension_rift')) {
    updated = clearActorMoveTargetMemory(updated);
    moveTargets = [growthPlan.nextStep || currentZone];
    moveReason = growthPlan.openingComplete ? 'growth_ready' : growthPlan.readyCraftId ? 'growth_craft' : growthPlan.blocked ? 'growth_blocked' : 'growth_farm';
    moveObjectiveType = '';
    moveObjectiveSubkind = '';
    moveContestPressure = 0;
  }

  moveTargets = uniqStrings(moveTargets.map((zoneId) => String(zoneId || ''))).filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));

  if (fleeInterruptReason) {
    updated = clearActorMoveTargetMemory(updated);
    moveObjectiveType = '';
    moveObjectiveSubkind = '';
    moveContestPressure = 0;
    const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
    const pick = pickTeamSafeZone(updated, phaseSurvivors, zoneGraph, forbiddenIds, {
      maxDepth: depthMax,
      estimatePower,
      enemyFree: lowHpFleeInterrupt,
      excludedZoneIds: !mustEscape && retreatAvoidZoneId ? [retreatAvoidZoneId] : [],
    });
    moveTargets = [String(pick?.nextStep || currentZone)];
    moveReason = `flee:${String(fleeInterruptReason)}`;
  } else if (recovering) {
    updated = clearActorMoveTargetMemory(updated);
    moveObjectiveType = '';
    moveObjectiveSubkind = '';
    moveContestPressure = 0;

    const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
    const pick = pickTeamSafeZone(updated, phaseSurvivors, zoneGraph, forbiddenIds, {
      maxDepth: depthMax,
      estimatePower,
      enemyFree: true,
      excludedZoneIds: retreatAvoidZoneId ? [retreatAvoidZoneId] : [],
    });
    moveTargets = [String(pick?.nextStep || currentZone)];
    moveReason = 'recover';
  }

  const endgameMove = pickEndgameMove(updated, nextSpawn?.endgame, forbiddenIds, zoneGraph, Number(atNow()?.sec || 0));
  if (endgameMove) {
    updated = clearActorMoveTargetMemory(updated);
    moveTargets = [endgameMove.nextStep];
    moveReason = 'endgame_rotate';
    moveObjectiveType = 'final_zone';
    moveObjectiveSubkind = 'survival';
    moveContestPressure = 1;
  }
  const nextMove = resolveActorNextMoveZone({
    state: {
      actor: updated,
      currentZone,
      day: nextDay,
      fleeInterruptReason,
      forbiddenIds,
      moveTargets,
      mustEscape,
      neighbors,
      phase: nextPhase,
      recovering,
      preserveGrowthPosition: !!growthPlan,
      ruleset,
      zoneGraph,
    },
  });
  // An announced closure takes priority over farming/holding. Still only take
  // one graph edge and charge its ordinary travel time below.
  if (endgameMove) nextMove.nextZoneId = endgameMove.nextStep;
  let retreatCooldownHeld = false;
  if (!mustEscape && !endgameMove) {
    if (retreatAvoidZoneId && String(nextMove.nextZoneId || '') === retreatAvoidZoneId) {
      consumeRetreatAvoidDecision(updated);
      nextMove.nextZoneId = currentZone;
      retreatCooldownHeld = true;
      activeTeamPlan = null;
      updated = clearActorMoveTargetMemory(updated);
      moveTargets = [currentZone];
      moveReason = 'retreat_cooldown';
      moveObjectiveType = '';
      moveObjectiveSubkind = '';
      moveContestPressure = 0;
      addLog(`🧭 [${updated.name}] 직전 위험 지역(${getZoneName(retreatAvoidZoneId)}) 즉시 복귀를 한 차례 보류합니다.`, 'normal');
    }
  }
  const movementBlocked = !canMoveByStatus(updated);
  const nextZoneId = movementBlocked ? currentZone : nextMove.nextZoneId;
  if (movementBlocked && nextMove.nextZoneId !== currentZone) {
    moveReason = 'status_move_block';
    addLog(`⛓️ [${updated.name}] 이동 불가 상태로 ${getZoneName(currentZone)}에 머뭅니다.`, 'system');
    emitRunEvent('action_blocked', { who: String(updated._id), action: 'move', reason: moveReason, zoneId: currentZone }, atNow());
  }
  const usedHyperloopMove = isHyperloopTransit(currentZone, nextZoneId);
  const didChangeZone = String(nextZoneId) !== String(currentZone);
  const retreatMemoryConsulted = !!retreatAvoidZoneId && !mustEscape && !endgameMove
    && (!!fleeInterruptReason || recovering);
  // A hold or unrelated no-op must not consume the one-shot reversal guard.
  // Consume it after a safe-zone search used the exclusion, or after any real
  // move makes the remembered edge no longer an immediate return.
  if (!retreatCooldownHeld && (retreatMemoryConsulted || (!!retreatAvoidZoneId && didChangeZone))) {
    consumeRetreatAvoidDecision(updated);
  }
  if (didChangeZone && !mustEscape && (String(moveReason || '').startsWith('flee:') || moveReason === 'recover')) {
    rememberRetreatOrigin(updated, currentZone);
  }
  const moveEtaSec = usedHyperloopMove
    ? hyperloopDelaySec
    : (didChangeZone ? getLumiaWalkEtaSec(currentZone, nextZoneId) : 1);
  if (didChangeZone && moveEtaSec > 1) reserveActionSecond(moveEtaSec);

  if (didChangeZone) {
    if (usedHyperloopMove) {
      addLog(`🌀 [${updated.name}] 하이퍼루프 이동(3초): ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'highlight');
    } else if (mustEscape) {
      addLog(`⚠️ [${updated.name}] 금지구역 이탈: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
    } else if (String(moveReason || '').startsWith('flee:')) {
      const fleeLabel = moveReason === 'flee:low_hp' ? '저HP' : (fleeInterruptReason === 'team_outnumbered' ? '팀 인원·전력 열세' : (powerFleeInterrupt ? '전투력 열세' : '긴급'));
      addLog(`🏃 [${updated.name}] ${fleeLabel} 인터럽트 도주: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
    } else if (forbiddenIds.has(String(nextZoneId))) {
      addLog(`⚠️ [${updated.name}] 금지구역 진입: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
    } else if (moveTargets.length) {
      if (moveReason === 'recover') {
        addLog(`🛟 [${updated.name}] 회복 우선 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
      } else {
        const intentLabel = formatMoveIntentLabel(moveReason, moveObjectiveType, moveObjectiveSubkind);
        addLog(`🎯 [${updated.name}] ${intentLabel}: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
      }
    } else {
      addLog(`🚶 [${updated.name}] 로테이션: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
    }

    emitRunEvent('move', {
      who: String(updated?._id || ''),
      name: updated?.name,
      from: String(currentZone),
      to: String(nextZoneId),
      reason: mustEscape ? 'escape' : (String(moveReason || '').startsWith('flee:') ? String(moveReason) : (moveTargets.length ? String(moveReason || 'goal') : 'wander')),
      transport: usedHyperloopMove ? 'hyperloop' : 'walk',
      etaSec: moveEtaSec,
      objectiveType: moveObjectiveType,
      objectiveSubkind: moveObjectiveSubkind,
      contestPressure: moveContestPressure,
      teamId: getActorTeamId(updated),
      teamAssessment,
    }, atNow());
    grantMastery(updated, 'movement', usedHyperloopMove ? 220 : 180, usedHyperloopMove ? '하이퍼루프 이동' : '지역 이동');
  } else if (mustEscape) {
    addLog(`⛔ [${updated.name}] 금지구역(${getZoneName(currentZone)})에 머무릅니다...`, 'death');
  }

  const publishPowerFleeDecision = !endgameMove && useTeamAssessment && powerFleeInterrupt;
  if (retreatCooldownHeld || activeTeamPlan || publishPowerFleeDecision) {
    const reason = retreatCooldownHeld ? 'retreat_cooldown' : (fleeInterruptReason || activeTeamPlan?.mode);
    updated._teamDecision = { ...teamAssessment, reason, leaderId: activeTeamPlan?.leaderId || '', targetZoneId: activeTeamPlan?.targetZoneId || nextZoneId };
    emitRunEvent('team_decision', {
      who: String(updated._id || ''), teamId: getActorTeamId(updated),
      from: currentZone, to: nextZoneId, moved: didChangeZone, ...updated._teamDecision,
    }, atNow());
    if (!didChangeZone && activeTeamPlan?.mode === 'team_regroup') {
      addLog(`🤝 [${updated.name}] ${getZoneName(currentZone)}에서 팀원 합류 대기`, 'normal');
    }
  } else updated._teamDecision = null;

  updated.zoneId = nextZoneId;
  if (growthPlan) emitRunEvent('growth_plan', {
    who: String(updated._id), teamId: getActorTeamId(updated), targetId: growthPlan.targetId,
    targetName: growthPlan.targetName, completedSlots: growthPlan.completedSlots, totalSlots: growthPlan.totalSlots,
    openingComplete: growthPlan.openingComplete, missing: growthPlan.missing.map(({ itemId, need }) => ({ itemId, need })),
    targetZoneId: growthPlan.targetZoneId, reason: fleeInterruptReason || moveReason, blocked: growthPlan.blocked,
  }, atNow());
  const objectiveTargets = activeTeamPlan ? [activeTeamPlan.targetZoneId] : moveTargets;
  const objectiveTargetSet = new Set((Array.isArray(objectiveTargets) ? objectiveTargets : []).map((zoneId) => String(zoneId || '')).filter(Boolean));
  if (moveObjectiveType && objectiveTargetSet.has(String(updated.zoneId || '')) && moveContestPressure > 0) {
    updated._objectiveContestType = moveObjectiveType;
    updated._objectiveContestSubkind = moveObjectiveSubkind;
    updated._objectiveContestPressure = moveContestPressure;
    updated._objectiveContestUntilPhaseIdx = phaseIdxNow;
  } else if (Number(updated?._objectiveContestUntilPhaseIdx ?? -1) < phaseIdxNow) {
    updated._objectiveContestType = '';
    updated._objectiveContestSubkind = '';
    updated._objectiveContestPressure = 0;
    updated._objectiveContestUntilPhaseIdx = null;
  }
  advanceActorRouteProgressForGoal({
    actor: updated,
    craftGoal: preGoal,
    ruleset,
    searched: false,
    zoneId: updated.zoneId,
  });

  return {
    actor: updated,
    currentZone,
    didMove: String(nextZoneId) !== String(currentZone),
    fleeInterruptReason,
    holdTarget,
    moveContestPressure,
    moveEtaSec,
    moveObjectiveSubkind,
    moveObjectiveType,
    moveReason,
    moveTargets,
    mustEscape,
    nextZoneId,
    preGoal,
    recovering,
    retreatCooldownHeld,
    upgradeNeed,
    usedHyperloopMove,
  };
}
