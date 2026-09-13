import { isExplicitDay1HeroRoutePlan } from './routePlanProgressRuntime';
import { runRouteFarmAction } from './phaseRouteFarmRuntime';
import { runHuntAction } from './phaseHuntActionRuntime';
import { openLegendaryCrateForActor } from './phaseLegendaryCrateRuntime';
import { runCraftAction } from './phaseCraftActionRuntime';
import { runProcurementAction } from './phaseProcurementActionRuntime';
import { runActorPostActionPhase } from './phaseActorPostActionRuntime';
import { hasKioskAtZone } from './simulationEngine';

export function runActorQueuedActionStep({
  actionPlan = {},
  actions = {},
  actor = null,
  fieldLootResult = {},
  movementResult = {},
  sourceActor = null,
  state = {},
} = {}) {
  const {
    canReviveThisMatch = false,
    craftables,
    damagePerTick = 0,
    forbiddenIds = new Set(),
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay = 1,
    nextPhase = 'morning',
    nextSpawn,
    phaseIdxNow = 0,
    publicItems = [],
    recovering = false,
    reviveCutoffIdx = 0,
    ruleset,
    selectedCharId = '',
    useDetonation = false,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => null,
    atNow = () => null,
    emitCraftRunEvent = () => {},
    emitDeathRunEventOnce = () => {},
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    grantMasteries = () => {},
    runDay1HeroGear = () => null,
    setDeathMetadata = () => {},
  } = actions;

  let updated = actor;
  const newlyDead = [];
  const queuedActionType = actionPlan.queuedActionType;
  if (!updated || Number(updated.hp || 0) <= 0) return { actor: updated, newlyDead };

  if (queuedActionType === 'rest') {
    addLog(`🩹 [${updated.name}] 저체력으로 안전 지역에서 다음 행동을 기다립니다.`, 'system');
    emitRunEvent('rest', { who: String(updated._id || ''), zoneId: String(updated.zoneId || ''),
      reason: 'low_hp_recovery', hp: Number(updated.hp || 0), maxHp: Number(updated.maxHp || 0) }, atNow());
  }

  if (queuedActionType === 'routeFarm' && actionPlan.fallbackRouteItemIds.length > 0) {
    runRouteFarmAction({
      state: {
        actor: updated,
        craftables,
        currentActionSec: state.currentActionSec,
        deferHuntSettlement: state.actionIntervalSec != null,
        fallbackRouteItemIds: actionPlan.fallbackRouteItemIds,
        nextSpawn,
        forbiddenIds,
        zoneGraph: state.zoneGraph,
        goalMissingIds: [...actionPlan.goalMissingIds],
        initialLoot: fieldLootResult.loot,
        itemMetaById,
        itemNameById,
        mapObj,
        nextDay,
        nextPhase,
        publicItems,
        ruleset,
      },
      actions: {
        addLog,
        applyLootCraftResult,
        atNow,
        emitItemGainIfAny,
        getZoneName,
        grantMastery,
        emitRunEvent,
      },
    });
  }

  if (queuedActionType === 'routeFarm' && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
    runDay1HeroGear(updated, {
      allowAbstractFallback: true,
      forceRouteCompletion: true,
      routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
    });
  }

  if (queuedActionType === 'hunt') {
    const isKioskZone = hasKioskAtZone(state.kiosks, mapObj, updated.zoneId);
    const huntAction = runHuntAction({
      state: {
        actor: updated,
        canReviveThisMatch,
        craftables,
        currentActionSec: state.currentActionSec,
        deferHuntSettlement: state.actionIntervalSec != null,
        didMove: movementResult.didMove,
        goalMissingIds: actionPlan.goalMissingIds,
        isKioskZone,
        itemMetaById,
        itemNameById,
        mapObj,
        nextDay,
        nextPhase,
        nextSpawn,
        phaseIdxNow,
        publicItems,
        recovering: recovering || movementResult.recovering,
        reviveCutoffIdx,
        ruleset,
      },
      actions: {
        addLog,
        applyLootCraftResult,
        atNow,
        emitDeathRunEventOnce,
        emitItemGainIfAny,
        emitObjectiveRunEvent,
        emitRunEvent,
        grantMasteries,
        setDeathMetadata,
      },
    });
    updated = huntAction.actor;
    if (huntAction.died) newlyDead.push(updated);
    if (Number(updated?.hp || 0) <= 0) return { actor: updated, newlyDead };
    // A scheduled hunt now owns the actor until its real-time encounter ends.
    // Opening crates, procurement and crafting are separate actions.
    if (huntAction.pending) return { actor: updated, newlyDead, huntPending: true };
  }

  const legendaryCrateResult = queuedActionType === 'rest' ? { actor: updated, opened: false } : openLegendaryCrateForActor({
    state: {
      actor: updated,
      craftables,
      didMove: movementResult.didMove,
      itemMetaById,
      itemNameById,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseIdxNow,
      publicItems,
      ruleset,
    },
    actions: {
      addLog,
      applyLootCraftResult,
      atNow,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitRunEvent,
      getZoneName,
      grantMastery,
    },
  });
  updated = legendaryCrateResult.actor;

  const procurementActionResult = runProcurementAction({
    state: {
      actor: updated,
      craftables,
      itemMetaById,
      itemNameById,
      nextDay,
      nextPhase,
      phaseIdxNow,
      publicItems,
      queuedActionType,
      queuedDroneOrder: actionPlan.queuedDroneOrder,
      queuedKioskAction: actionPlan.queuedKioskAction,
      ruleset,
    },
    actions: {
      addLog,
      applyLootCraftResult,
      atNow,
      emitItemGainIfAny,
      emitRunEvent,
    },
  });
  updated = procurementActionResult.actor;

  const craftActionResult = runCraftAction({
    state: {
      actor: updated,
      craftables,
      itemMetaById,
      itemNameById,
      nextDay,
      nextPhase,
      phaseIdxNow,
      publicItems,
      queuedActionType,
      ruleset,
      selectedCharId,
    },
    actions: {
      addLog,
      atNow,
      emitCraftRunEvent,
      runDay1HeroGear,
    },
  });
  updated = craftActionResult.actor;

  const postActionResult = runActorPostActionPhase({
    state: {
      actor: updated,
      canReviveThisMatch,
      damagePerTick,
      forbiddenIds,
      nextDay,
      nextPhase,
      phaseIdxNow,
      reviveCutoffIdx,
      ruleset,
      sourceActor,
      useDetonation,
    },
    actions: {
      addLog,
      emitDeathRunEventOnce,
      getZoneName,
      runDay1HeroGear,
      setDeathMetadata,
    },
  });
  updated = postActionResult.actor;
  if (postActionResult.died) newlyDead.push(updated);

  return {
    actor: updated,
    newlyDead,
  };
}
