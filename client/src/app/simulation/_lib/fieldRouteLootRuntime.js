import {
  clampTier4,
  pickWeighted,
  randInt,
} from './simulationCommon';
import { applyPerkLootWeight } from './perkRuntime';
import {
  inferItemCategory,
  markInventoryGoalItem,
} from './inventoryRules';
import { classifySpecialByName } from './craftRuntime';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';

export function rollEarlyRouteLoot({
  curDay = 0,
  curPhase = '',
  fallbackMaxTier = 2,
  field = {},
  goalItemIds = new Set(),
  list = [],
  moved = false,
  opts = {},
  perkLootBias = 0,
  routeItemIds = new Set(),
  zoneId = '',
} = {}) {
  const earlyRouteCfg = field?.earlyRoute || {};
  const earlyRouteActive = routeItemIds.size > 0 && (
    curDay === 1 ||
    (curDay === 2 && (curPhase === 'morning' || curPhase === 'day'))
  );
  if (!earlyRouteActive) return { handled: false, loot: null };

  const routeFarmOnly = opts?.routeFarm === true || opts?.routeFarmOnly === true;
  const routeChanceBase = moved
    ? Number(earlyRouteCfg?.chanceMoved ?? 0.72)
    : Number(routeFarmOnly ? (earlyRouteCfg?.chanceFarm ?? 0.82) : (earlyRouteCfg?.chanceStay ?? 0.42));
  const routeChance = Math.max(0.01, Math.min(0.98, routeChanceBase + Math.max(0, perkLootBias) * 0.10));
  const routeMaxTier = Math.max(1, Number(earlyRouteCfg?.maxTier ?? fallbackMaxTier));
  const routeEquipmentMaxTier = Math.max(1, Number(earlyRouteCfg?.equipmentMaxTier ?? 2));
  const routeWeight = Math.max(0, Number(earlyRouteCfg?.routeWeight ?? 8));
  const routeGoalWeight = Math.max(0, Number(earlyRouteCfg?.goalWeight ?? 16));
  const routeEquipmentWeight = Math.max(0, Number(earlyRouteCfg?.equipmentWeight ?? 6));
  const routeMaxQty = Math.max(1, Math.min(3, Number(earlyRouteCfg?.maxQty ?? 2)));
  const routeCandidates = [...routeItemIds]
    .map((itemId) => {
      const item = list.find((it) => String(it?._id) === String(itemId)) || null;
      if (!item?._id) return null;
      if (isItemExcludedFromFieldFarming(item)) return null;
      if (classifySpecialByName(item?.name)) return null;
      const category = inferItemCategory(item);
      const isMaterial = category === 'material';
      const isLowEquip = category === 'equipment';
      if (!isMaterial && !isLowEquip) return null;
      const tier = clampTier4(item?.tier || 1);
      if (isMaterial && tier > routeMaxTier) return null;
      if (isLowEquip && tier > routeEquipmentMaxTier) return null;
      const directGoal = goalItemIds.has(String(item._id));
      const baseWeight = routeWeight + (isLowEquip ? routeEquipmentWeight : 0) + (directGoal ? routeGoalWeight : 0) + (tier <= 1 ? 2 : 0);
      return { item, itemId: String(item._id), tier, weight: applyPerkLootWeight(baseWeight, opts?.perkEffects || {}, { rareBoost: tier >= 2 ? 0.12 : 0 }) };
    })
    .filter((x) => x && Number(x?.weight || 0) > 0);

  if (routeCandidates.length && Math.random() < routeChance) {
    const picked = pickWeighted(routeCandidates);
    if (picked?.itemId) {
      const pickedCategory = inferItemCategory(picked?.item);
      const qtyMax = pickedCategory === 'material' && Number(picked?.tier || 1) <= 1 ? routeMaxQty : 1;
      const qty = Math.max(1, randInt(1, qtyMax));
      const crateType = pickedCategory === 'equipment' ? 'route_equipment' : 'route_material';
      return {
        handled: true,
        loot: {
          item: markInventoryGoalItem(picked.item, true, 'route_goal'),
          itemId: String(picked.itemId),
          qty,
          crateId: 'route_plan',
          crateType,
          routeFarm: routeFarmOnly,
          zoneId: String(zoneId || ''),
        },
      };
    }
  }

  return {
    handled: routeFarmOnly,
    loot: null,
  };
}
