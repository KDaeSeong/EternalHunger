import {
  areSameTeam,
  bfsPickSafestZone,
  buildCraftGoal,
  chooseAiMoveTargets,
  computeLateGameUpgradeNeed,
  getActorPerkEffects,
  listActiveDimensionRifts,
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
    baseZonePop = {},
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

  const mustEscape = forbiddenIds.has(currentZone);
  const preGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
    goalTier: updated?.goalGearTier,
    goalItemKeys: pickGoalLoadoutKeys(updated),
    perkEffects: getActorPerkEffects(updated),
  });
  const upgradeNeed = computeLateGameUpgradeNeed(updated, itemMetaById, itemNameById, nextDay, nextPhase, ruleset);
  const aiMove = chooseAiMoveTargets({
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
  });

  const aiCfg = ruleset?.ai || {};
  const recoverHpBelow = Math.max(0, Number(aiCfg?.recoverHpBelow ?? 38));
  const recoverMinDelta = Math.max(0, Math.floor(Number(aiCfg?.recoverMinSaferDelta ?? 1)));
  const sameZoneOpponents = (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).filter((target) => (
    target
    && String(target?._id || '') !== String(updated?._id || '')
    && !areSameTeam(updated, target)
    && Number(target?.hp || 0) > 0
    && String(target?.zoneId || '') === String(currentZone)
  ));
  const worstSameZoneOpponent = sameZoneOpponents
    .slice()
    .sort((a, b) => Number(estimateMovePower(b, movePowerContext) || 0) - Number(estimateMovePower(a, movePowerContext) || 0))[0] || null;
  const avoidInfoNow = worstSameZoneOpponent ? shouldAvoidCombatByMovePower(updated, worstSameZoneOpponent, movePowerContext) : null;
  const extremeRatio = Number(aiCfg?.fightAvoidExtremeRatio ?? 0.30);
  const extremeDelta = Number(aiCfg?.fightAvoidExtremeDelta ?? 25);
  const lowHpFleeInterrupt = !mustEscape && sameZoneOpponents.length > 0 && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;
  const powerFleeInterrupt = !mustEscape && !!avoidInfoNow && ((Number(avoidInfoNow?.ratio || 1) < extremeRatio) || ((Number(avoidInfoNow?.opP || 0) - Number(avoidInfoNow?.myP || 0)) >= extremeDelta));
  const fleeInterruptReason = mustEscape ? 'forbidden' : (lowHpFleeInterrupt ? 'low_hp' : (powerFleeInterrupt ? 'power_gap' : ''));
  const recovering = !mustEscape && !fleeInterruptReason && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;

  const targetMemory = resolveActorMoveTargetMemory({
    state: {
      actor: updated,
      aiMove,
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

  const riftTargetsNow = (!isSoloMatch && String(nextPhase || '') === 'night' && [2, 3, 4].includes(Number(nextDay || 0)))
    ? listActiveDimensionRifts(nextSpawn)
      .map((rift) => String(rift?.zoneId || ''))
      .filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)))
    : [];
  if (!mustEscape && !recovering && riftTargetsNow.length > 0) {
    const riftContestChance = Math.max(0, Math.min(1, Number(ruleset?.worldSpawns?.dimensionRift?.contestChance ?? 0.38)));
    const wantsRift = Math.random() < riftContestChance || (String(moveObjectiveType || '') === '' && Math.random() < 0.25);
    if (wantsRift) {
      moveTargets = [riftTargetsNow[Math.floor(Math.random() * riftTargetsNow.length)]];
      moveReason = 'dimension_rift';
      moveObjectiveType = 'dimension_rift';
      moveObjectiveSubkind = 'aglaia';
      moveContestPressure = Math.max(moveContestPressure, 0.45);
    }
  }

  moveTargets = uniqStrings(moveTargets.map((zoneId) => String(zoneId || ''))).filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));

  if (fleeInterruptReason) {
    updated = clearActorMoveTargetMemory(updated);
    moveObjectiveType = '';
    moveObjectiveSubkind = '';
    moveContestPressure = 0;
    const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
    const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: Math.max(1, recoverMinDelta) });
    const best = String(pick?.target || currentZone);
    if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
      moveTargets = [String(best)];
    }
    moveReason = `flee:${String(fleeInterruptReason)}`;
  } else if (recovering) {
    updated = clearActorMoveTargetMemory(updated);
    moveObjectiveType = '';
    moveObjectiveSubkind = '';
    moveContestPressure = 0;

    const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
    const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: recoverMinDelta });

    const best = String(pick?.target || currentZone);
    if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
      moveTargets = [String(best)];
      moveReason = 'recover';
    }
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
      ruleset,
      zoneGraph,
    },
  });
  const nextZoneId = nextMove.nextZoneId;
  const usedHyperloopMove = isHyperloopTransit(currentZone, nextZoneId);
  const didChangeZone = String(nextZoneId) !== String(currentZone);
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
      const fleeLabel = moveReason === 'flee:low_hp' ? '저HP' : (moveReason === 'flee:power_gap' ? '전투력 열세' : '긴급');
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
    }, atNow());
    grantMastery(updated, 'movement', usedHyperloopMove ? 220 : 180, usedHyperloopMove ? '하이퍼루프 이동' : '지역 이동');
  } else if (mustEscape) {
    addLog(`⛔ [${updated.name}] 금지구역(${getZoneName(currentZone)})에 머무릅니다...`, 'death');
  }

  updated.zoneId = nextZoneId;
  const objectiveTargetSet = new Set((Array.isArray(moveTargets) ? moveTargets : []).map((zoneId) => String(zoneId || '')).filter(Boolean));
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
    upgradeNeed,
    usedHyperloopMove,
  };
}
