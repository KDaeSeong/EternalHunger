import {
  addItemToInventory,
  advanceEarlyRouteProgress,
  autoEquipBest,
  buildCraftGoal,
  formatInvAddNote,
  getActorPerkEffects,
  itemIcon,
  pickGoalLoadoutKeys,
  rollFieldLoot,
  tryAutoCraftFromLoot,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';
import {
  getRoutePlanMissingItemIds,
  mergeMissingItemIds,
} from './routePlanProgressRuntime';

export function runRouteFarmAction({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    fallbackRouteItemIds = [],
    goalMissingIds = [],
    initialLoot,
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay,
    nextPhase,
    publicItems,
    ruleset,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => {},
    atNow = () => null,
    emitItemGainIfAny = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
  } = actions;
  const updated = actor || {};
  const routeItemIds = (Array.isArray(fallbackRouteItemIds) ? fallbackRouteItemIds : [])
    .map((itemId) => String(itemId || '').trim())
    .filter(Boolean);

  if (!routeItemIds.length) {
    return {
      actor: updated,
      attempts: 0,
    };
  }

  const initialRouteLootHit = !!initialLoot && String(initialLoot?.crateId || '') === 'route_plan';
  const day1RouteBurst = Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning';
  const configuredAttempts = Math.max(1, Math.floor(Number(ruleset?.ai?.earlyRouteFarmAttempts ?? (day1RouteBurst ? 2 : 1))));
  const routeAttempts = Math.max(0, configuredAttempts - (initialRouteLootHit ? 1 : 0));
  let routeGoalIdsForSearch = [...(Array.isArray(goalMissingIds) ? goalMissingIds : [])];

  for (let routeAttempt = 0; routeAttempt < routeAttempts; routeAttempt += 1) {
    const routeLoot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, {
      moved: false,
      routeFarm: true,
      day: nextDay,
      phase: nextPhase,
      dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey,
      perkEffects: getActorPerkEffects(updated),
      goalItemIds: routeGoalIdsForSearch,
      routeItemIds,
    });

    if (routeLoot?.itemId) {
      updated.inventory = addItemToInventory(updated.inventory, routeLoot.item, routeLoot.itemId, routeLoot.qty, nextDay, ruleset);
      const metaR = updated.inventory?._lastAdd;
      const gotR = Math.max(0, Number(metaR?.acceptedQty ?? routeLoot.qty));
      const nmR = routeLoot.item?.name || itemNameById?.[String(routeLoot.itemId || '')] || '아이템';
      if (shouldLogItemReceive(gotR, metaR)) {
        addLog(`🧭 [${updated.name}] ${getZoneName(updated.zoneId)}에서 루트 재료 ${itemIcon(routeLoot.item || { type: '' })} [${nmR}] ${gainText(gotR)}${formatInvAddNote(metaR, routeLoot.qty, updated.inventory, ruleset)}`, 'normal');
      }
      emitItemGainIfAny(gotR, { who: String(updated?._id || ''), itemId: String(routeLoot.itemId || ''), source: 'gather', kind: String(routeLoot?.crateType || 'route_material'), zoneId: String(updated?.zoneId || '') }, atNow());
      if (gotR > 0) grantMastery(updated, 'search', 70, '루트 탐색');
      if (gotR > 0) autoEquipBest(updated, itemMetaById);

      const craftedR = tryAutoCraftFromLoot(
        updated.inventory,
        routeLoot.itemId,
        craftables,
        itemNameById,
        itemMetaById,
        nextDay,
        ruleset,
        getLootCraftOptions(updated)
      );
      applyLootCraftResult(updated, craftedR, itemMetaById, atNow(), updated?.zoneId);

      const postRouteGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
        goalTier: updated?.goalGearTier,
        goalItemKeys: pickGoalLoadoutKeys(updated),
        perkEffects: getActorPerkEffects(updated),
      });
      const postRouteCraftMissingIds = (Array.isArray(postRouteGoal?.missing) ? postRouteGoal.missing : [])
        .map((missing) => String(missing?.itemId || ''))
        .filter(Boolean);
      routeGoalIdsForSearch = mergeMissingItemIds(postRouteCraftMissingIds, getRoutePlanMissingItemIds(updated));
    }

    advanceEarlyRouteProgress(updated, updated.zoneId, {
      missingItemIds: routeGoalIdsForSearch,
      routeItemIds,
      searched: true,
      maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
    });
    if (!routeGoalIdsForSearch.length) break;
    if (updated?._routePlanProgress?.advanced) break;
  }

  return {
    actor: updated,
    attempts: routeAttempts,
  };
}
