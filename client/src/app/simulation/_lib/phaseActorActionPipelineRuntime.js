import { runDay1HeroGearDirectorWithLogs } from './phaseRouteProgressRuntime';
import { runSingleActorPhaseAction } from './phaseActorActionStepRuntime';
import { buildCraftGoal, chooseAiMoveTargets, computeLateGameUpgradeNeed, getActorPerkEffects, pickGoalLoadoutKeys } from './simulationEngine';
import { buildTeamCoordination } from './teamTacticsRuntime';
import { publishTeamRegroupDecision } from './teamRegroupRuntime';
import { estimateMovePower } from './movePowerRuntime';
import { hasActionBlockStatus, getForcedControlEffect, canMoveByStatus } from '../../../utils/statusLogic';
import { refreshActorGrowthPlan, getActorGrowthCraftGoal } from './growthPlanRuntime';
import { getCombatIntentOpponents } from './combatTimingRuntime.js';
import { getActorDimensionRiftId } from './dimensionRiftSpaceRuntime.js';
import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { measureObserverWork } from './observerWorkMeasurementRuntime.js';
import { getRetreatAvoidZoneId } from './retreatDecisionMemoryRuntime.js';

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

// Retain the synchronous entry point for callers that already own a complete
// action boundary. The match loop drains the same steps cooperatively instead.
export function runPhaseActorActionPipeline(options = {}) {
  const steps = runPhaseActorActionPipelineSteps(options);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

export function* runPhaseActorActionPipelineSteps({
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
  const scheduled = state.actionIntervalSec != null;
  const now = Number(state.currentActionSec?.() || 0);
  // Planning and execution must agree about who can act at this boundary.
  // Otherwise a gathered squad issues a shared rotation but only its first
  // ready member leaves, while the others are held by their individual clocks.
  const growthHoldStatus = (actor) => {
    if (getForcedControlEffect(actor)) return 'status';
    if (!scheduled) return '';
    if (getActorDimensionRiftId(actor)) return 'replanned';
    if (actor?._wildlifeHunt) return 'hunt';
    if (actor?._pendingCharacterCast) return 'cast';
    if (!state.forbiddenIds?.has(String(actor?.zoneId))
      && getCombatIntentOpponents(actor, roster, now).length > 0) return 'combat';
    if (Number(actor?.hp || 0) <= 0 || hasActionBlockStatus(actor)) return 'status';
    if (Number(actor?._growthReadyAtSec || 0) > now || Number(actor?._actionReadyAtSec || 0) > now) return 'action_wait';
    return '';
  };
  const baseZonePopBySpace = new Map([...new Set(roster.map(getCombatSpaceId))]
    .map((spaceId) => [spaceId, buildBaseZonePopulation(roster, spaceId)]));
  // Every member plans from the same pre-action roster, not a partly moved team.
  const movementRoster = cloneMovementRosterForPlanning(roster);
  yield;
  for (const actor of movementRoster) {
    measureObserverWork('growth.refreshPlans', () => refreshActorGrowthPlan(actor, publicItems, state));
    yield;
  }
  const { movementPlans: teamMovementPlans, regroupDecisions } = measureObserverWork('growth.teamCoordination', () => buildTeamCoordination({
    roster: movementRoster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds,
    day: nextDay, phase: nextPhase, isSoloMatch: state.isSoloMatch,
    spawnState: state.nextSpawn, ruleset, publicItems,
    getRotationHold: scheduled ? (actor) => {
      const reason = growthHoldStatus(actor) || (!canMoveByStatus(actor) ? 'status' : '');
      return reason ? { reason, readyAtSec: reason === 'action_wait'
        ? Math.max(Number(actor._growthReadyAtSec || 0), Number(actor._actionReadyAtSec || 0)) : null } : null;
    } : null,
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
  yield;
  const planningActorsById = new Map(movementRoster.map((actor) => [String(actor._id || actor.id || ''), actor]));
  const newlyDead = [];
  let pendingPickAssigned = initialPendingPickAssigned;

  const runDay1HeroGear = (actor, options) => runDay1HeroGearDirectorWithLogs({
    state: { actor, publicItems, itemNameById, itemMetaById, day: nextDay, phase: nextPhase, ruleset },
    actions: { addLog },
    options,
  });

  const processActor = (sourceActor) => {
    const regroupDecision = regroupDecisions.get(String(sourceActor?._id || sourceActor?.id || ''));
    const hold = (status) => {
      publishTeamRegroupDecision(sourceActor, regroupDecision, { status, at: actions.atNow?.(),
        emitRunEvent: actions.emitRunEvent, addLog, zoneName: actions.getZoneName });
      return sourceActor;
    };
    // Only field growth is held. The shared clock still advances internal
    // movement, statuses, consumables, attacks and casts, including at low HP.
    const heldBy = growthHoldStatus(sourceActor);
    if (heldBy) {
      if (scheduled && getActorDimensionRiftId(sourceActor)) sourceActor.aiCurrentAction = 'dimension_rift_wait';
      else if (heldBy === 'hunt') sourceActor.aiCurrentAction = 'hunt_combat';
      return hold(heldBy);
    }
    if (regroupDecision?.stage === 'rotation_wait') {
      // Do not start another hunt or advance this member's action clock while
      // waiting: staggered 20-second clocks would otherwise never align.
      return hold('rotation_wait');
    }
    let moveCost = 1;
    if (scheduled) sourceActor._actionCycleKey = `${state.phaseIdxNow}:${now}`;
    const teamMovementPlan = teamMovementPlans.get(String(sourceActor?._id || sourceActor?.id || ''));
    const resourceGoal = teamMovementPlan?.objective?.type === 'natural_core' ? teamMovementPlan.objective : null;
    const beneficiaryId = resourceGoal?.beneficiary?.who;
    const beneficiary = planningActorsById.get(beneficiaryId);
    const beneficiaryPlan = teamMovementPlans.get(beneficiaryId);
    // Yield only to a teammate who can actually arrive in this action batch.
    // This is not a world reservation: other teams can still take the source,
    // and a failed/stale plan cannot make it permanently uncollectable.
    const deferredCoreSourceIds = beneficiary && beneficiaryId !== String(sourceActor._id || sourceActor.id || '')
      && beneficiaryPlan?.nextStep === resourceGoal.targetZoneId && !growthHoldStatus(beneficiary)
      && canMoveByStatus(beneficiary)
      && getRetreatAvoidZoneId(beneficiary) !== resourceGoal.targetZoneId
      && Number(beneficiary.hp) > Math.max(0, Number(ruleset?.ai?.recoverHpBelow ?? 38))
      ? resourceGoal.sourceIds : [];
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
        teamMovementPlan,
        teamMovementPlanCommitted: Boolean(resourceGoal?.beneficiary),
        deferredCoreSourceIds,
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
  };
  const processedActors = [];
  // These are checkpoints, not simulation time steps: preserve actor/RNG/shared
  // resource order and publish only after the entire batch has finished.
  for (const sourceActor of roster) {
    processedActors.push(processActor(sourceActor));
    yield;
  }
  const updatedSurvivors = processedActors.filter((survivor) => Number(survivor?.hp || 0) > 0);

  return {
    newlyDead,
    pendingPickAssigned,
    updatedSurvivors,
  };
}
