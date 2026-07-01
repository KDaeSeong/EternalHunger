import { invQty } from './inventoryRules';
import { uniqStr } from './simulationCommon';

export function isExplicitDay1HeroRoutePlan(actor) {
  const source = String(actor?.routePlanSource || '').trim();
  return source === 'day1_hero_2zone' || source === 'day1_hero_2zone_partial';
}

export function getRuntimeRoutePlanZoneIds(actor) {
  return Array.isArray(actor?.routePlanZoneIds)
    ? actor.routePlanZoneIds.map((z) => String(z || '').trim()).filter(Boolean)
    : [];
}

export function isRuntimeRoutePlanComplete(actor) {
  const routePlanIds = getRuntimeRoutePlanZoneIds(actor);
  if (!routePlanIds.length) return false;
  return Math.max(0, Number(actor?.routePlanIndex || 0)) >= routePlanIds.length;
}

export function getRoutePlanMissingItemIds(actor) {
  if (!isExplicitDay1HeroRoutePlan(actor)) return [];
  const requiredIds = Array.isArray(actor?.routePlanRequiredItemIds)
    ? actor.routePlanRequiredItemIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const requiredQtyById = actor?.routePlanRequiredQtyById && typeof actor.routePlanRequiredQtyById === 'object'
    ? actor.routePlanRequiredQtyById
    : {};
  return uniqStr(requiredIds.filter((id) => {
    const needQty = Math.max(1, Math.floor(Number(requiredQtyById?.[id] || 1)));
    return invQty(actor?.inventory, id) < needQty;
  }));
}

export function mergeMissingItemIds(...lists) {
  return uniqStr(lists.flatMap((list) => (
    Array.isArray(list) ? list.map((id) => String(id || '').trim()).filter(Boolean) : []
  )));
}

export function shouldForceDay1HeroGearCatchup(actor, day, phase) {
  const d = Number(day || 0);
  const ph = String(phase || '').toLowerCase();
  const catchupWindow = (d === 1 && ph === 'night') || (d === 2 && ph === 'morning');
  if (!catchupWindow) return false;
  if (!isExplicitDay1HeroRoutePlan(actor)) return true;
  return isRuntimeRoutePlanComplete(actor);
}
