import { runDay1HeroGearDirectorWithLogs } from './phaseRouteProgressRuntime';
import { runSingleActorPhaseAction } from './phaseActorActionStepRuntime';
import { buildCraftGoal, chooseAiMoveTargets, computeLateGameUpgradeNeed, getActorPerkEffects, pickGoalLoadoutKeys } from './simulationEngine';
import { buildTeamCoordination } from './teamTacticsRuntime';
import { publishTeamRegroupDecision } from './teamRegroupRuntime';
import { estimateMovePower } from './movePowerRuntime';
import { hasActionBlockStatus, getForcedControlEffect } from '../../../utils/statusLogic';
import { refreshActorGrowthPlan, getActorGrowthCraftGoal } from './growthPlanRuntime';
import { getCombatIntentOpponents } from './combatTimingRuntime.js';
import { getActorDimensionRiftId } from './dimensionRiftSpaceRuntime.js';
import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { measureObserverWork } from './observerWorkMeasurementRuntime.js';

function buildBaseZonePopulation(phaseSurvivors, combatSpaceId) {
  const baseZonePop = {};
  (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((survivor) => {
    if (!survivor || getCombatSpaceId(survivor) !== combatSpaceId || Number(survivor.hp || 0) <= 0) return;
    const zoneId = String(survivor.zoneId || '');
    if (!zoneId) return;
    baseZonePop[zoneId] = (baseZonePop[zoneId] || 0) + 1;
  });
  return baseZonePop;
}

// Movement planning mutates only the actor's growth markers and inventory
// entries. Keep that planning copy isolated while avoiding a full clone of
// spatial/combat/status state that the planner only reads.
export function cloneMovementRosterForPlanning(phaseSurvivors = []) {
  return (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
    .filter((actor) => !getActorDimensionRiftId(actor))
    .map((actor) => {
      const planningActor = { ...actor };
      if (Array.isArray(actor.inventory)) planningActor.inventory = structuredClone(actor.inventory);
      return planningActor;
    });
}

export function runPhaseActorActionPipeline({
  state = {},
  actions = {},
} = {}) {
  const {
    itemMetaById,
    itemNameById,
    nextDay = 1,
    nextPhase = 'morning',
    pendingPickAssigned: initialPendingPickAssigned = false,
    phaseSurvivors = [],
    publicItems = [],
    ruleset,
  } = state;
  const {
    addLog = () => {},
  } = actions;

  const roster = Array.isArray(phaseSurvivors) ? phaseSurvivors : [];
  const baseZonePopBySpace = new Map([...new Set(roster.map(getCombatSpaceId))]
    .map((spaceId) => [spaceId, buildBaseZonePopulation(roster, spaceId)]));
  // Every member plans from the same pre-action roster, not a partly moved team.
  const movementRoster = cloneMovementRosterForPlanning(roster);
  measureObserverWork('growth.refreshPlans', () => movementRoster.forEach((actor) => refreshActorGrowthPlan(actor, publicItems, state)));
  const { movementPlans: teamMovementPlans, regroupDecisions } = measureObserverWork('growth.teamCoordination', () => buildTeamCoordination({
    roster: movementRoster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds,
    day: nextDay, phase: nextPhase, isSoloMatch: state.isSoloMatch,
    spawnState: state.nextSpawn, ruleset, publicItems,
    maxDepth: Math.max(1, Number(ruleset?.ai?.safeSearchDepth ?? 3)),
    estimatePower: (actor) => estimateMovePower(actor, state.movePowerContext),
    chooseLeaderMove: (actor) => chooseAiMoveTargets({
      actor,
      craftGoal: getActorGrowthCraftGoal(actor, publicItems) || buildCraftGoal(actor.inventory, state.craftables, itemNameById, {
        goalTier: actor.goalGearTier, goalItemKeys: pickGoalLoadoutKeys(actor), perkEffects: getActorPerkEffects(actor),
      }),
      upgradeNeed: computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, nextDay, nextPhase, ruleset),
      mapObj: state.mapObj, spawnState: state.nextSpawn, forbiddenIds: state.forbiddenIds,
      day: nextDay, phase: nextPhase, kiosks: state.kiosks, itemMetaById, itemNameById,
      nowSec: state.currentActionSec?.(), ruleset, isSoloMatch: state.isSoloMatch,
    }),
  }));
  const newlyDead = [];
  let pendingPickAssigned = initialPendingPickAssigned;

  const runDay1HeroGear = (actor, options) => runDay1HeroGearDirectorWithLogs({
    state: { actor, publicItems, itemNameById, itemMetaById, day: nextDay, phase: nextPhase, ruleset },
    actions: { addLog },
    options,
  });

  const updatedSurvivors = roster
    .map((sourceActor) => {
      const regroupDecision = regroupDecisions.get(String(sourceActor?._id || sourceActor?.id || ''));
      const hold = (status) => {
        publishTeamRegroupDecision(sourceActor, regroupDecision, { status, at: actions.atNow?.(),
          emitRunEvent: actions.emitRunEvent, addLog, zoneName: actions.getZoneName });
        return sourceActor;
      };
      if (getForcedControlEffect(sourceActor)) return hold('status');
      const scheduled = state.actionIntervalSec != null;
      const now = Number(state.currentActionSec?.() || 0);
      // Only field growth is held. The shared clock still advances internal
      // movement, statuses, consumables, attacks and casts, including at low HP.
      if (scheduled && getActorDimensionRiftId(sourceActor)) {
        sourceActor.aiCurrentAction = 'dimension_rift_wait';
        return hold('replanned');
      }
      if (scheduled && sourceActor?._wildlifeHunt) {
        sourceActor.aiCurrentAction = 'hunt_combat';
        return hold('hunt');
      }
      if (scheduled && sourceActor?._pendingCharacterCast) return hold('cast');
      // Fighting consumes growth opportunities. A closure may still force
      // movement; ordinary farming resumes after the engagement is gone.
      if (scheduled && !state.forbiddenIds?.has(String(sourceActor?.zoneId))
        && getCombatIntentOpponents(sourceActor, roster, now).length > 0) return hold('combat');
      if (scheduled && (Number(sourceActor?.hp || 0) <= 0 || hasActionBlockStatus(sourceActor))) return hold('status');
      if (scheduled && (Number(sourceActor?._growthReadyAtSec || 0) > now
        || Number(sourceActor?._actionReadyAtSec || 0) > now)) return hold('action_wait');
      let moveCost = 1;
      if (scheduled) sourceActor._actionCycleKey = `${state.phaseIdxNow}:${now}`;
      const actorStepResult = measureObserverWork('growth.singleActor', () => runSingleActorPhaseAction({
        actions: {
          ...actions,
          runDay1HeroGear,
          ...(scheduled ? { reserveActionSecond: (seconds) => { moveCost = Math.max(moveCost, Number(seconds) || 1); return now; } } : {}),
        },
        sourceActor,
        state: {
          ...state,
          baseZonePop: baseZonePopBySpace.get(getCombatSpaceId(sourceActor)) || {},
          movementRoster,
          teamMovementPlan: teamMovementPlans.get(String(sourceActor?._id || sourceActor?.id || '')),
          teamRegroupDecision: regroupDecision,
          pendingPickAssigned,
        },
      }));

      if (scheduled && actorStepResult.actor) {
        const actor = actorStepResult.actor;
        // Teams move in parallel: one member's travel must not spend everyone
        // else's match time. Travel still delays that member's next action.
        actor._growthReadyAtSec = now + Math.max(state.actionIntervalSec, moveCost);
        actor._actionReadyAtSec = now + moveCost;
        actions.emitRunEvent?.('action_cycle', {
          who: String(actor._id), teamId: actor.teamId, chosen: actor.aiCurrentAction,
          intervalSec: state.actionIntervalSec, readyAtSec: actor._growthReadyAtSec,
        }, actions.atNow?.());
      }

      pendingPickAssigned = actorStepResult.pendingPickAssigned;
      if (Array.isArray(actorStepResult.newlyDead) && actorStepResult.newlyDead.length) {
        newlyDead.push(...actorStepResult.newlyDead);
      }
      return actorStepResult.actor;
    })
    .filter((survivor) => Number(survivor?.hp || 0) > 0);

  return {
    newlyDead,
    pendingPickAssigned,
    updatedSurvivors,
  };
}
