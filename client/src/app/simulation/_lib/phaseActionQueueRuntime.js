import {
  buildCraftGoal,
  getActorPerkEffects,
  pickGoalLoadoutKeys,
} from './simulationEngine';
import { prepareActorPhaseActionQueue } from './phaseActionQueueDecisionRuntime';
import { advanceActorRouteProgressForGoal } from './phaseRouteProgressRuntime';
import { refreshActorGrowthPlan, getActorGrowthCraftGoal } from './growthPlanRuntime';

export { prepareActorPhaseActionQueue } from './phaseActionQueueDecisionRuntime';

export function prepareActorPhaseActionPlan({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    currentActionSec,
    currentZone,
    didMove = false,
    droneOffers,
    fleeInterruptReason = '',
    holdTarget = '',
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    mapObj,
    marketRules,
    moveContestPressure = 0,
    moveEtaSec = 1,
    moveObjectiveSubkind = '',
    moveObjectiveType = '',
    moveReason = '',
    movementObjective = null,
    movementTargetZoneId = '',
    sharedGoalReason = '',
    decisionEvidence = null,
    retreatOutcome = '',
    mustEscape = false,
    nextDay,
    nextPhase,
    nextZoneId,
    phaseIdxNow = 0,
    publicItems,
    recovering = false,
    ruleset,
    upgradeNeed,
    usedHyperloopMove = false,
  } = state;

  const updated = actor || {};
  const growthPlan = refreshActorGrowthPlan(updated, publicItems, state);
  const craftGoal = getActorGrowthCraftGoal(updated, publicItems) || buildCraftGoal(updated.inventory, craftables, itemNameById, {
    goalTier: updated?.goalGearTier,
    goalItemKeys: pickGoalLoadoutKeys(updated),
    perkEffects: getActorPerkEffects(updated),
  });
  const routeProgressNow = advanceActorRouteProgressForGoal({
    actor: updated,
    craftGoal,
    ruleset,
    searched: false,
    zoneId: updated.zoneId,
  });
  const routePlanMissingIdsNow = growthPlan ? growthPlan.missing.map((row) => row.itemId) : routeProgressNow.routePlanMissingItemIds;
  const earlyRouteMissingIdsNow = growthPlan ? routePlanMissingIdsNow : routeProgressNow.missingItemIds;
  const mappedRouteItemIdsNow = growthPlan ? growthPlan.currentZoneItemIds : routeProgressNow.mappedRouteItemIds;
  const goalMissingIds = new Set(earlyRouteMissingIdsNow);
  const goalTargetId = String(craftGoal?.target?._id || craftGoal?.target?.itemId || '');
  const routePlanIdsNow = Array.isArray(updated?.routePlanZoneIds)
    ? updated.routePlanZoneIds.map((zoneId) => String(zoneId || '').trim()).filter(Boolean)
    : [];
  const earlyRouteActionActive = growthPlan ? !growthPlan.openingComplete : (
    (Number(nextDay || 0) === 1 || (Number(nextDay || 0) === 2 && String(nextPhase || '') === 'morning')) &&
    routePlanIdsNow.length > 0 &&
    Math.max(0, Number(updated?.routePlanIndex || 0)) < routePlanIdsNow.length
  );
  const currentRouteItemIds = mappedRouteItemIdsNow;
  const fallbackRouteItemIds = growthPlan ? currentRouteItemIds : currentRouteItemIds.length
    ? currentRouteItemIds
    : [...goalMissingIds].filter(Boolean);
  const currentRouteNeedsSearch = (earlyRouteActionActive || !!growthPlan?.targetId) &&
    fallbackRouteItemIds.length > 0 &&
    fallbackRouteItemIds.some((id) => goalMissingIds.has(id));
  const actionQueue = prepareActorPhaseActionQueue({
    state: {
      actor: updated,
      craftables,
      craftGoal,
      currentActionSec,
      currentRouteItemIds,
      currentRouteNeedsSearch,
      didMove,
      droneOffers,
      earlyRouteActionActive,
      fallbackRouteItemIds,
      fleeInterruptReason,
      goalMissingIds,
      goalTargetId,
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
      movementObjective,
      movementTargetZoneId,
      sharedGoalReason,
      decisionEvidence,
      retreatOutcome,
      mustEscape,
      nextDay,
      nextPhase,
      nextZoneId,
      phaseIdxNow,
      publicItems,
      recovering,
      routePlanMissingIdsNow,
      ruleset,
      currentZone,
      upgradeNeed,
      usedHyperloopMove,
    },
    actions,
  });

  return {
    ...actionQueue,
    craftGoal,
    currentRouteItemIds,
    fallbackRouteItemIds,
    goalMissingIds,
    routePlanMissingIdsNow,
  };
}
