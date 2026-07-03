import { isExplicitDay1HeroRoutePlan } from './routePlanProgressRuntime';
import { runDay1HeroGearDirectorWithLogs } from './phaseRouteProgressRuntime';
import { runRouteFarmAction } from './phaseRouteFarmRuntime';
import { runHuntAction } from './phaseHuntActionRuntime';
import { openLegendaryCrateForActor } from './phaseLegendaryCrateRuntime';
import { runCraftAction } from './phaseCraftActionRuntime';
import { runProcurementAction } from './phaseProcurementActionRuntime';
import { runActorPostActionPhase } from './phaseActorPostActionRuntime';
import { runFacilityGatherPhase } from './phaseFacilityGatherRuntime';
import { runFieldLootPhase } from './phaseFieldLootRuntime';
import { runWorldSpawnPickupPhase } from './phaseWorldSpawnPickupRuntime';
import { applyActorPhaseStatusTick } from './phaseActorStatusRuntime';
import { runActorMovementDecisionPhase } from './phaseActorMovementRuntime';
import { prepareActorPhaseActionPlan } from './phaseActionQueueRuntime';
import { hasKioskAtZone } from './simulationEngine';

export function runPhaseActorActionPipeline({
  state = {},
  actions = {},
} = {}) {
  const {
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    damagePerTick = 0,
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
    useDetonation = false,
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => null,
    atNow = () => null,
    emitCraftRunEvent = () => {},
    emitDeathRunEventOnce = () => {},
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitQueueRunEvent = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    grantMasteries = () => {},
    isHyperloopTransit = () => false,
    reserveActionSecond = () => null,
    setDeathMetadata = () => {},
    setPendingTranscendPick = () => {},
  } = actions;

  const baseZonePop = {};
  (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((survivor) => {
    if (!survivor || Number(survivor.hp || 0) <= 0) return;
    const zoneId = String(survivor.zoneId || '');
    if (!zoneId) return;
    baseZonePop[zoneId] = (baseZonePop[zoneId] || 0) + 1;
  });

  const newlyDead = [];
  let pendingPickAssigned = initialPendingPickAssigned;

  const runDay1HeroGear = (actor, options) => runDay1HeroGearDirectorWithLogs({
    state: { actor, publicItems, itemNameById, itemMetaById, day: nextDay, phase: nextPhase, ruleset },
    actions: { addLog },
    options,
  });

  const updatedSurvivors = (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
    .map((sourceActor) => {
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
        return updated;
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
      const currentZone = movementResult.currentZone;
      const nextZoneId = movementResult.nextZoneId;
      const didMove = movementResult.didMove;
      const preGoal = movementResult.preGoal;
      const upgradeNeed = movementResult.upgradeNeed;
      const holdTarget = movementResult.holdTarget;
      const moveReason = movementResult.moveReason;
      const moveObjectiveType = movementResult.moveObjectiveType;
      const moveObjectiveSubkind = movementResult.moveObjectiveSubkind;
      const moveContestPressure = movementResult.moveContestPressure;
      const fleeInterruptReason = movementResult.fleeInterruptReason;
      const recovering = movementResult.recovering;
      const mustEscape = movementResult.mustEscape;
      const usedHyperloopMove = movementResult.usedHyperloopMove;
      const moveEtaSec = movementResult.moveEtaSec;

      if (didMove && Number(nextDay || 0) === 1) {
        updated.day1Moves = Math.max(0, Number(updated.day1Moves || 0)) + 1;
        if (String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
          runDay1HeroGear(updated, {
            allowAbstractFallback: true,
            forceRouteCompletion: true,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
        }
      }

      const facilityGatherResult = runFacilityGatherPhase({
        state: {
          actor: updated,
          mapObj,
          nextDay,
          publicItems,
          ruleset,
        },
        actions: {
          addLog,
          atNow,
          emitItemGainIfAny,
          getZoneName,
        },
      });
      updated = facilityGatherResult.actor;

      const fieldLootResult = runFieldLootPhase({
        state: {
          actor: updated,
          craftables,
          didMove,
          itemMetaById,
          itemNameById,
          mapObj,
          nextDay,
          nextPhase,
          pendingPickAssigned,
          pendingTranscendPick,
          preGoal,
          publicItems,
          ruleset,
          selectedCharId,
          showMarketPanel,
        },
        actions: {
          addLog,
          applyLootCraftResult,
          atNow,
          emitItemGainIfAny,
          getZoneName,
          grantMastery,
          setPendingTranscendPick,
        },
      });
      updated = fieldLootResult.actor;
      pendingPickAssigned = fieldLootResult.pendingPickAssigned;

      const worldSpawnPickupResult = runWorldSpawnPickupPhase({
        state: {
          actor: updated,
          craftables,
          didMove,
          itemMetaById,
          itemNameById,
          nextDay,
          nextPhase,
          nextSpawn,
          pendingPickAssigned,
          pendingTranscendPick,
          phaseIdxNow,
          preGoal,
          publicItems,
          ruleset,
          selectedCharId,
          showMarketPanel,
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
          setPendingTranscendPick,
        },
      });
      updated = worldSpawnPickupResult.actor;
      pendingPickAssigned = worldSpawnPickupResult.pendingPickAssigned;

      const isKioskZone = hasKioskAtZone(kiosks, mapObj, updated.zoneId);

      const actionPlan = prepareActorPhaseActionPlan({
        state: {
          actor: updated,
          craftables,
          currentActionSec,
          currentZone,
          didMove,
          droneOffers,
          fleeInterruptReason,
          holdTarget,
          itemKeyById,
          itemMetaById,
          itemNameById,
          kiosks,
          mapObj,
          marketRules,
          moveContestPressure,
          moveEtaSec,
          moveObjectiveSubkind,
          moveObjectiveType,
          moveReason,
          mustEscape,
          nextDay,
          nextPhase,
          nextZoneId,
          phaseIdxNow,
          publicItems,
          recovering,
          ruleset,
          upgradeNeed,
          usedHyperloopMove,
        },
        actions: {
          atNow,
          emitQueueRunEvent,
          getZoneName,
        },
      });
      updated = actionPlan.actor;
      const fallbackRouteItemIds = actionPlan.fallbackRouteItemIds;
      const goalMissingIds = actionPlan.goalMissingIds;
      const queuedKioskAction = actionPlan.queuedKioskAction;
      const queuedDroneOrder = actionPlan.queuedDroneOrder;
      const queuedActionType = actionPlan.queuedActionType;

      if (queuedActionType === 'routeFarm' && fallbackRouteItemIds.length > 0) {
        runRouteFarmAction({
          state: {
            actor: updated,
            craftables,
            fallbackRouteItemIds,
            goalMissingIds: [...goalMissingIds],
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
        const huntAction = runHuntAction({
          state: {
            actor: updated,
            canReviveThisMatch,
            craftables,
            didMove,
            goalMissingIds,
            isKioskZone,
            itemMetaById,
            itemNameById,
            mapObj,
            nextDay,
            nextPhase,
            nextSpawn,
            phaseIdxNow,
            publicItems,
            recovering,
            reviveCutoffIdx,
            ruleset,
            wasAlive: Number(sourceActor.hp || 0) > 0,
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
      }

      const legendaryCrateResult = openLegendaryCrateForActor({
        state: {
          actor: updated,
          craftables,
          didMove,
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
          queuedDroneOrder,
          queuedKioskAction,
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
      return updated;
    })
    .filter((survivor) => Number(survivor.hp || 0) > 0);

  return {
    newlyDead,
    pendingPickAssigned,
    updatedSurvivors,
  };
}
