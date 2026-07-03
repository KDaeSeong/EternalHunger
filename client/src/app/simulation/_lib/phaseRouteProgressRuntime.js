import {
  advanceEarlyRouteProgress,
  day1HeroGearDirector,
} from './simulationEngine';
import {
  getRoutePlanMissingItemIds,
  mergeMissingItemIds,
} from './routePlanProgressRuntime';

export function getCraftGoalMissingItemIds(craftGoal) {
  return (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
    .map((missing) => String(missing?.itemId || ''))
    .filter(Boolean);
}

export function getRouteMappedItemIdsForZone(actor, zoneId) {
  const activeZoneId = String(zoneId || actor?.zoneId || '');
  return Array.isArray(actor?.routePlanItemIdsByZone?.[activeZoneId])
    ? actor.routePlanItemIdsByZone[activeZoneId].map((id) => String(id || '').trim()).filter(Boolean)
    : [];
}

export function advanceActorRouteProgressForGoal({
  actor,
  craftGoal,
  includeRoutePlanMissing = true,
  ruleset,
  searched = false,
  zoneId,
} = {}) {
  const activeZoneId = String(zoneId || actor?.zoneId || '');
  const craftMissingItemIds = getCraftGoalMissingItemIds(craftGoal);
  const routePlanMissingItemIds = includeRoutePlanMissing ? getRoutePlanMissingItemIds(actor) : [];
  const missingItemIds = mergeMissingItemIds(craftMissingItemIds, routePlanMissingItemIds);
  const mappedRouteItemIds = getRouteMappedItemIdsForZone(actor, activeZoneId);
  const routeItemIds = mappedRouteItemIds.length ? mappedRouteItemIds : missingItemIds;

  advanceEarlyRouteProgress(actor, activeZoneId, {
    missingItemIds,
    routeItemIds,
    searched: !!searched,
    maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
  });

  return {
    craftMissingItemIds,
    mappedRouteItemIds,
    missingItemIds,
    routeItemIds,
    routePlanMissingItemIds,
  };
}

export function runDay1HeroGearDirectorWithLogs({
  actions = {},
  options = {},
  state = {},
} = {}) {
  const {
    actor,
    day,
    itemMetaById,
    itemNameById,
    phase,
    publicItems,
    ruleset,
  } = state;
  const { addLog = () => {} } = actions;
  const result = day1HeroGearDirector(
    actor,
    publicItems,
    itemNameById,
    itemMetaById,
    day,
    phase,
    ruleset,
    options
  );

  if (result?.changed && Array.isArray(result.logs)) {
    result.logs.forEach((message) => addLog(String(message), 'highlight'));
  }

  return result;
}
