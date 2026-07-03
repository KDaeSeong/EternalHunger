import {
  EFFECT_KNOCKBACK,
  getKnockbackDistance,
} from '../../../utils/statusLogic';
import { getMovementSpeedMasteryBonus } from '../../../utils/masteryLogic';
import {
  areSameTeam,
  bfsPickSafestZone,
  bfsNextStepToAnyTarget,
  buildCraftGoal,
  chooseAiMoveTargets,
  computeLateGameUpgradeNeed,
  getActorPerkEffects,
  getEarlyRoutePlanTarget,
  getEquipMoveSpeed,
  listActiveDimensionRifts,
  normalizeInventory,
  pickGoalLoadoutKeys,
  randInt,
  removeActiveEffect,
  uniqStrings,
} from './simulationEngine';
import { formatMoveIntentLabel } from './moveIntentRuntime';
import {
  estimateMovePower,
  shouldAvoidCombatByMovePower,
} from './movePowerRuntime';
import { advanceActorRouteProgressForGoal } from './phaseRouteProgressRuntime';

export function initializeActorPhaseMovementState(actor, {
  itemKeyById,
  ruleset,
} = {}) {
  const updated = actor || {};

  updated.simCredits = updated.simCredits ?? 0;
  updated.droneLastOrderIndex = updated.droneLastOrderIndex ?? -9999;
  updated.droneLastOrderAbsSec = updated.droneLastOrderAbsSec ?? -99999;
  updated.kioskLastInteractAbsSec = updated.kioskLastInteractAbsSec ?? -99999;
  updated.aiTargetZoneId = updated.aiTargetZoneId ?? null;
  updated.aiTargetTTL = updated.aiTargetTTL ?? 0;
  updated.inventory = Array.isArray(updated.inventory) ? updated.inventory : [];
  updated.inventory = normalizeInventory(updated.inventory, ruleset);
  updated._itemKeyById = itemKeyById;

  return updated;
}

export function applyActorKnockbackMovement({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    forbiddenIds = new Set(),
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  const updated = actor || {};
  let currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
  let neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
  const knockbackDistance = getKnockbackDistance(updated);

  if (knockbackDistance > 0 && neighbors.length > 0) {
    const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
    const pushedZone = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);

    if (pushedZone && pushedZone !== currentZone) {
      updated.zoneId = pushedZone;
      removeActiveEffect(updated, EFFECT_KNOCKBACK);
      addLog(`↔️ [${updated.name}] 밀려남: ${getZoneName(currentZone)} → ${getZoneName(pushedZone)}`, 'system');
      emitRunEvent('move', {
        who: String(updated?._id || ''),
        name: updated?.name,
        from: currentZone,
        to: pushedZone,
        reason: 'knockback',
      }, atNow());
      currentZone = pushedZone;
      neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
    }
  }

  return {
    actor: updated,
    currentZone,
    neighbors,
  };
}

export function clearActorMoveTargetMemory(actor) {
  const updated = actor || {};

  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  updated.aiTargetObjectiveType = '';
  updated.aiTargetObjectiveSubkind = '';
  updated.aiTargetContestPressure = 0;

  return updated;
}

export function resolveActorMoveTargetMemory({
  state = {},
} = {}) {
  const {
    actor,
    aiMove,
    currentZone,
    day,
    forbiddenIds = new Set(),
    mustEscape = false,
    phase,
    ruleset,
  } = state;
  let updated = actor || {};
  const hasAiMoveTargets = Array.isArray(aiMove?.targets) && aiMove.targets.length > 0;
  const earlyRouteTarget = getEarlyRoutePlanTarget(updated, forbiddenIds, day, phase);
  const earlyRoutePriorityPhase = Number(day || 0) === 1;
  const preferEarlyRoutePlan = !!earlyRouteTarget && (
    (!hasAiMoveTargets)
    || earlyRoutePriorityPhase
  );
  const plannedMove = preferEarlyRoutePlan
    ? { targets: [earlyRouteTarget], reason: hasAiMoveTargets ? 'early_route:priority' : 'early_route' }
    : aiMove;
  const aiCfg = ruleset?.ai || {};
  const ttlMin = Math.max(1, Number(aiCfg?.targetTtlMin ?? 2));
  const ttlMax = Math.max(ttlMin, Number(aiCfg?.targetTtlMax ?? 4));
  const clearOnReach = aiCfg?.clearOnReach !== false;
  const plannedObjectiveType = String(plannedMove?.objectiveType || '');
  const plannedObjectiveSubkind = String(plannedMove?.objectiveSubkind || '');
  const plannedContestPressure = Math.max(0, Number(plannedMove?.contestPressure || 0));

  let holdTarget = null;

  if (mustEscape) {
    updated = clearActorMoveTargetMemory(updated);
  } else {
    const saved = String(updated.aiTargetZoneId || '');
    const ttlNow = Math.max(0, Number(updated.aiTargetTTL || 0));

    if (saved && ttlNow > 0 && !forbiddenIds.has(saved)) {
      holdTarget = saved;
      updated.aiTargetTTL = ttlNow - 1;
      if (clearOnReach && String(currentZone) === saved) {
        holdTarget = null;
        updated = clearActorMoveTargetMemory(updated);
      }
    }

    if (!holdTarget && Array.isArray(plannedMove?.targets) && plannedMove.targets.length > 0) {
      const pickedTarget = plannedMove.targets
        .map((zoneId) => String(zoneId || ''))
        .find((zoneId) => zoneId && !forbiddenIds.has(String(zoneId))) || '';
      if (pickedTarget) {
        updated.aiTargetZoneId = pickedTarget;
        updated.aiTargetTTL = randInt(ttlMin, ttlMax);
        updated.aiTargetObjectiveType = plannedObjectiveType;
        updated.aiTargetObjectiveSubkind = plannedObjectiveSubkind;
        updated.aiTargetContestPressure = plannedContestPressure;
        holdTarget = pickedTarget;
      }
    }
  }

  return {
    actor: updated,
    holdTarget,
    moveContestPressure: Math.max(0, Number(updated.aiTargetContestPressure || plannedContestPressure || 0)),
    moveObjectiveSubkind: String(updated.aiTargetObjectiveSubkind || plannedObjectiveSubkind || ''),
    moveObjectiveType: String(updated.aiTargetObjectiveType || plannedObjectiveType || ''),
    moveReason: holdTarget ? `${String(plannedMove?.reason || 'goal')}:ttl` : String(plannedMove?.reason || ''),
    moveTargets: holdTarget ? [holdTarget] : (Array.isArray(plannedMove?.targets) ? plannedMove.targets : []),
    plannedMove,
  };
}

export function resolveActorNextMoveZone({
  state = {},
} = {}) {
  const {
    actor,
    currentZone,
    day,
    fleeInterruptReason = '',
    forbiddenIds = new Set(),
    moveTargets = [],
    mustEscape = false,
    neighbors = [],
    phase,
    recovering = false,
    ruleset,
    zoneGraph = {},
  } = state;

  const updated = actor || {};
  const forbidCfg = ruleset?.forbidden || {};
  const escapeMoveChance = Math.min(1, Math.max(0, Number(forbidCfg.escapeMoveChance ?? 0.85)));
  const curDet = Number.isFinite(Number(updated.detonationSec)) ? Number(updated.detonationSec) : 999;
  const dangerForceSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5) + 2);
  const escapeChance = (mustEscape && curDet <= dangerForceSec) ? 1 : escapeMoveChance;

  const equipMs = getEquipMoveSpeed(updated);
  const masteryMs = getMovementSpeedMasteryBonus(updated);
  const msMoveBonus = Math.min(0.18, equipMs * 0.9 + masteryMs);
  let baseMoveChance = mustEscape
    ? escapeChance
    : (fleeInterruptReason ? 1 : (recovering ? 0.95 : (moveTargets.length ? 0.88 : 0.6)));
  if (!mustEscape && Number(day || 0) === 1 && String(phase || '') === 'morning') {
    baseMoveChance = Math.max(baseMoveChance, 0.92);
  }
  const moveChance = Math.min(0.98, baseMoveChance + msMoveBonus);
  let willMove = Math.random() < moveChance;

  if (!mustEscape && Number(day || 0) === 1 && String(phase || '') === 'morning' && Math.max(0, Number(updated.day1Moves || 0)) < 1) {
    if (neighbors.length > 0) willMove = true;
  }

  let nextZoneId = currentZone;
  if (willMove) {
    if (mustEscape) {
      if (neighbors.length > 0) {
        const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
        const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
        nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
      } else {
        nextZoneId = currentZone;
      }
    } else if (moveTargets.length) {
      const targetSet = new Set(moveTargets.map((zoneId) => String(zoneId)));
      const stepRes = bfsNextStepToAnyTarget(currentZone, targetSet, zoneGraph, forbiddenIds);
      const picked = stepRes.nextStep || (targetSet.has(currentZone) ? currentZone : String(moveTargets[0] || currentZone));
      if (picked && !forbiddenIds.has(String(picked))) nextZoneId = String(picked);
    } else if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      nextZoneId = currentZone;
    }
  }

  return {
    moveChance,
    nextZoneId,
    willMove,
  };
}

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
  const moveEtaSec = usedHyperloopMove ? hyperloopDelaySec : 1;
  if (usedHyperloopMove) reserveActionSecond(moveEtaSec);

  if (String(nextZoneId) !== String(currentZone)) {
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
