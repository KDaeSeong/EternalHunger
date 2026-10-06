import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { getActorResourceRecipeTargets } from './lateGrowthTargetRuntime.js';
import { getActorEquipmentTier, GROWTH_EQUIPMENT_SLOTS } from './growthEquipmentRuntime.js';
import { inferItemCategory } from './inventoryRules.js';
import { classifySpecialByName } from './craftRuntime.js';
import { listKioskZoneIdsForMap } from './mapTargeting.js';
import { canUseKioskAtWorldTime, kioskLegendaryPrice } from './marketRuntime.js';
import { resolveKioskSpecialItems } from './aiKioskSpecialItemsRuntime.js';
import { pickKioskPrioritySpecialAction } from './aiKioskPriorityRuntime.js';
import { applyPerkDiscount, getActorPerkEffects } from './perkRuntime.js';
import { pickKioskCatalogGoalAction } from './aiKioskCatalogRuntime.js';
import { commitProcurementTransaction } from './procurementTransactionRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDefaultKioskItem } from '../../../utils/marketItemPolicy.js';

// A teammate's immediately completable recipe is a squad need, even when the
// leader still has ordinary farming to do. Quote only a real available order;
// travel does not buy, reserve stock, share credits or create equipment.
export function chooseTeamPurchaseMove({ members = [], publicItems = [], ruleset, mapObj, kiosks = [],
  day, phase, forbiddenIds = new Set(), routeForZone } = {}) {
  if (!canUseKioskAtWorldTime(day, phase) || !mapObj || typeof routeForZone !== 'function') return null;
  const zones = listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds);
  if (!zones.length) return null;
  const specialItems = resolveKioskSpecialItems(publicItems.filter(isDefaultKioskItem)), routes = new Map(), candidates = [];
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
      // Use the same exact quote as the action queue, including mixed modes
      // and unavailable earlier rows; never invent an unrelated idle offer.
      const offer = (catalog.length || kiosk?.hasCustomCatalog) ? pickKioskCatalogGoalAction({ catalog, actor, miss: [missing],
        applyKioskCost: discount, findById: id => publicItems.find(item => String(item._id) === id),
        targetId: target._id, publicItems, ruleset, day, requireComplete: true }) : defaultOffer;
      if (!['buy', 'exchange'].includes(offer?.kind) || String(offer.itemId) !== missing.itemId) continue;
      // Preview a prospective order, not a retry of the actor's old receipt.
      // Settlement prepares inventory on copies; the real actor, funds and
      // successful-action marker are never changed or reserved by this quote.
      const preview = { ...actor, _procurementActionKey: undefined };
      const receipt = commitProcurementTransaction({ actor: preview, offer, day, ruleset,
        actionType: offer.kind === 'exchange' ? 'kioskExchange' : 'kioskBuy' });
      if (!receipt.ok) continue;
      // An exchange may free a bag slot, but may also consume a required base
      // or ingredient. Re-account the real resulting recipe before travelling.
      const afterWork = getGrowthRecipeWork(preview, publicItems, target._id, { ruleset });
      if (afterWork.blocked || afterWork.missing.length || !afterWork.readyCraftId
        || afterWork.plannedCredits > preview.simCredits) continue;
      if (!routes.has(zoneId)) routes.set(zoneId, routeForZone(zoneId));
      const route = routes.get(zoneId);
      if (route) candidates.push({ actor, target, material, zoneId, distance: route.distance,
        kind: offer.kind, cost: receipt.paidCost });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cost - b.cost
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || String(a.actor._id || a.actor.id || '').localeCompare(String(b.actor._id || b.actor.id || ''))
    || a.zoneId.localeCompare(b.zoneId));
  const best = candidates[0];
  return best ? { targets: [best.zoneId],
    reason: `팀 제작 ${best.kind === 'exchange' ? '교환' : '구매'}: ${best.material.name} · ${best.actor.name || best.actor._id}의 ${best.target.name} 제작 재료` } : null;
}
