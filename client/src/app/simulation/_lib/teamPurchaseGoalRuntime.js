import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { getActorResourceRecipeTargets } from './lateGrowthTargetRuntime.js';
import { getActorEquipmentTier, GROWTH_EQUIPMENT_SLOTS } from './growthEquipmentRuntime.js';
import { canReceiveItem, inferItemCategory } from './inventoryRules.js';
import { classifySpecialByName } from './craftRuntime.js';
import { listKioskZoneIdsForMap } from './mapTargeting.js';
import { canUseKioskAtWorldTime, kioskLegendaryPrice } from './marketRuntime.js';
import { resolveKioskSpecialItems } from './aiKioskSpecialItemsRuntime.js';
import { pickKioskPrioritySpecialAction } from './aiKioskPriorityRuntime.js';
import { applyPerkDiscount, getActorPerkEffects } from './perkRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

// A teammate's immediately completable recipe is a squad need, even when the
// leader still has ordinary farming to do. Quote only a real available order;
// travel does not buy, reserve stock, share credits or create equipment.
export function chooseTeamPurchaseMove({ members = [], publicItems = [], ruleset, mapObj, kiosks = [],
  day, phase, forbiddenIds = new Set(), routeForZone } = {}) {
  if (!canUseKioskAtWorldTime(day, phase) || !mapObj || typeof routeForZone !== 'function') return null;
  const zones = listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds);
  if (!zones.length) return null;
  const specialItems = resolveKioskSpecialItems(publicItems), routes = new Map(), candidates = [];
  for (const actor of members) {
    const growth = actor._growthPlan;
    if (getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE || !growth?.openingComplete || !growth.targetId) continue;
    const target = getActorResourceRecipeTargets(actor, publicItems).find(item => String(item._id) === String(growth.targetId));
    if (!target) continue;
    const work = getGrowthRecipeWork(actor, publicItems, target._id, { ruleset });
    if (work.blocked || work.readyCraftId || work.missing.length !== 1 || work.missing[0].need !== 1) continue;
    const missing = work.missing[0], material = publicItems.find(item => String(item._id) === missing.itemId);
    // Keep obtainable field farming first, and agree with the action queue's
    // procurement gate. A quoted kiosk must not lead to an unpayable farm hold.
    if (!growth.missing?.some(row => row.itemId === missing.itemId && !row.zones?.length)) continue;
    const credits = Number(actor.simCredits || 0);
    if (!Number.isFinite(credits) || credits < 0) continue;
    const key = classifySpecialByName(material?.name);
    if (!key || inferItemCategory(material) !== 'material') continue;
    const perk = getActorPerkEffects(actor), prices = ruleset?.market?.kiosk?.prices || {};
    const discount = value => applyPerkDiscount(value, perk.kioskDiscountPct, perk.marketDiscountPct);
    const defaultOffer = pickKioskPrioritySpecialAction({ missingSpecialKeys: new Set([key]), specialItems,
      inv: actor.inventory, simCredits: actor.simCredits, curDay: day, curPhase: phase,
      allowVf: ruleset?.market?.kiosk?.categories?.vf !== false,
      allowLegendary: ruleset?.market?.kiosk?.categories?.legendary !== false,
      shouldDeferVfForLegend: Number(actor.goalGearTier ?? 6) >= 6
        && GROWTH_EQUIPMENT_SLOTS.some(slot => getActorEquipmentTier(actor, slot) < 5),
      kioskSpecialPrice: kind => discount(kind === 'vf' ? Number(prices.vf ?? 500)
        : kioskLegendaryPrice(kind, prices.legendaryByKey)) });
    for (const zoneId of zones) {
      const kiosk = kiosks.find(row => String(row.mapId?._id || row.mapId || '') === String(mapObj._id || '')
        && String(row.zoneId || '') === zoneId);
      const catalog = Array.isArray(kiosk?.catalog) ? kiosk.catalog : [];
      // A custom catalogue is authoritative. Only its exact deterministic
      // missing-item buy is quoted; random unrelated catalogue offers are not.
      const row = catalog.find(entry => String(entry.itemId?._id || entry.itemId || '') === missing.itemId);
      const offer = catalog.length ? row && String(row.mode || 'sell') === 'sell'
        ? { kind: 'buy', itemId: missing.itemId, item: material, cost: discount(Math.max(0, Number(row.priceCredits || 0))) }
        : null : defaultOffer;
      if (offer?.kind !== 'buy' || String(offer.itemId) !== missing.itemId
        || !Number.isFinite(offer.cost) || offer.cost < 0
        || offer.cost + work.plannedCredits > credits
        || !canReceiveItem(actor.inventory, offer.item, offer.itemId, 1, ruleset)) continue;
      if (!routes.has(zoneId)) routes.set(zoneId, routeForZone(zoneId));
      const route = routes.get(zoneId);
      if (route) candidates.push({ actor, target, material, zoneId, distance: route.distance, cost: offer.cost });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cost - b.cost
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || String(a.actor._id || a.actor.id || '').localeCompare(String(b.actor._id || b.actor.id || ''))
    || a.zoneId.localeCompare(b.zoneId));
  const best = candidates[0];
  return best ? { targets: [best.zoneId],
    reason: `팀 제작 구매: ${best.material.name} · ${best.actor.name || best.actor._id}의 ${best.target.name} 제작 재료` } : null;
}
