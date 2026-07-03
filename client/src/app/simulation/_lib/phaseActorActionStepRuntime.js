import { isExplicitDay1HeroRoutePlan } from './routePlanProgressRuntime';
import { applyActorPhaseStatusTick } from './phaseActorStatusRuntime';
import { runActorMovementDecisionPhase } from './phaseActorMovementRuntime';
import { prepareActorPhaseActionPlan } from './phaseActionQueueRuntime';
import { runActorLootStep } from './phaseActorLootStepRuntime';
import { runActorQueuedActionStep } from './phaseActorQueuedActionStepRuntime';

export function runSingleActorPhaseAction({
  actions = {},
  sourceActor = null,
  state = {},
} = {}) {
  const {
    baseZonePop = {},
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    droneOffers = [],
    forbiddenIds = new Set(),
    hyperloopDelaySec = 3,
    isSoloMatch = false,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks = [],
    mapObj,
    marketRules,
    movePowerContext = {},
    nextDay = 1,
    nextPhase = 'morning',
    nextSpawn,
    pendingPickAssigned: initialPendingPickAssigned = false,
    pendingTranscendPick = null,
    phaseDurationSec = 0,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    publicItems = [],
    reviveCutoffIdx = 0,
    ruleset,
    selectedCharId = '',
    showMarketPanel = false,
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitQueueRunEvent = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    isHyperloopTransit = () => false,
    reserveActionSecond = () => null,
    runDay1HeroGear = () => null,
    setDeathMetadata = () => {},
  } = actions;

  let pendingPickAssigned = initialPendingPickAssigned;
  const newlyDead = [];
  const statusTickResult = applyActorPhaseStatusTick({
    state: {
      actor: sourceActor,
      canReviveThisMatch,
      elapsedSec: phaseDurationSec,
      phaseIdxNow,
      reviveCutoffIdx,
    },
    actions: {
      addLog,
      emitDeathRunEventOnce,
      setDeathMetadata,
    },
  });
  let updated = statusTickResult.actor;
  if (statusTickResult.died) {
    newlyDead.push(updated);
    return { actor: updated, newlyDead, pendingPickAssigned };
  }

  const movementResult = runActorMovementDecisionPhase({
    state: {
      actor: updated,
      baseZonePop,
      craftables,
      forbiddenIds,
      hyperloopDelaySec,
      isSoloMatch,
      itemKeyById,
      itemMetaById,
      itemNameById,
      kiosks,
      mapObj,
      movePowerContext,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseIdxNow,
      phaseSurvivors,
      ruleset,
      zoneGraph,
      zones,
    },
    actions: {
      addLog,
      atNow,
      emitRunEvent,
      getZoneName,
      grantMastery,
      isHyperloopTransit,
      reserveActionSecond,
    },
  });
  updated = movementResult.actor;

  if (movementResult.didMove && Number(nextDay || 0) === 1) {
    updated.day1Moves = Math.max(0, Number(updated.day1Moves || 0)) + 1;
    if (String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
      runDay1HeroGear(updated, {
        allowAbstractFallback: true,
        forceRouteCompletion: true,
        routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
      });
    }
  }

  const lootStepResult = runActorLootStep({
    actions,
    actor: updated,
    movementResult,
    state: {
      ...state,
      pendingPickAssigned,
      pendingTranscendPick,
    },
  });
  updated = lootStepResult.actor;
  pendingPickAssigned = lootStepResult.pendingPickAssigned;

  const actionPlan = prepareActorPhaseActionPlan({
    state: {
      actor: updated,
      craftables,
      currentActionSec,
      currentZone: movementResult.currentZone,
      didMove: movementResult.didMove,
      droneOffers,
      fleeInterruptReason: movementResult.fleeInterruptReason,
      holdTarget: movementResult.holdTarget,
      itemKeyById,
      itemMetaById,
      itemNameById,
      kiosks,
      mapObj,
      marketRules,
      moveContestPressure: movementResult.moveContestPressure,
      moveEtaSec: movementResult.moveEtaSec,
      moveObjectiveSubkind: movementResult.moveObjectiveSubkind,
      moveObjectiveType: movementResult.moveObjectiveType,
      moveReason: movementResult.moveReason,
      mustEscape: movementResult.mustEscape,
      nextDay,
      nextPhase,
      nextZoneId: movementResult.nextZoneId,
      phaseIdxNow,
      publicItems,
      recovering: movementResult.recovering,
      ruleset,
      upgradeNeed: movementResult.upgradeNeed,
      usedHyperloopMove: movementResult.usedHyperloopMove,
    },
    actions: {
      atNow,
      emitQueueRunEvent,
      getZoneName,
    },
  });
  updated = actionPlan.actor;

  const queuedActionResult = runActorQueuedActionStep({
    actionPlan,
    actions,
    actor: updated,
    fieldLootResult: lootStepResult.fieldLootResult,
    movementResult,
    sourceActor,
    state,
  });
  updated = queuedActionResult.actor;
  if (Array.isArray(queuedActionResult.newlyDead) && queuedActionResult.newlyDead.length) {
    newlyDead.push(...queuedActionResult.newlyDead);
  }

  return {
    actor: updated,
    newlyDead,
    pendingPickAssigned,
  };
}
