import { classifySpecialByName } from './craftRuntime.js';
import { pickKioskCatalogGoalAction } from './aiKioskCatalogRuntime.js';
import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { applyPerkDiscount, getActorPerkEffects } from './perkRuntime.js';
import { commitProcurementTransaction } from './procurementTransactionRuntime.js';

// Movement quotes only an outstanding recipe need. An authored shop cannot
// borrow default stock or prices, and quoting never pays or reserves anything.
export function getKioskMovementTargets({ zoneIds = [], mapObj, kiosks = [], actor,
  craftGoal, publicItems = [], ruleset, day, desiredKeys = [], desiredItemIds = [], defaultEligible = false } = {}) {
  const keys = new Set(desiredKeys);
  const itemIds = new Set(desiredItemIds.map(String));
  const missing = (craftGoal?.missing || []).filter(row => itemIds.has(String(row.itemId)) || keys.has(
    String(row.special || classifySpecialByName(row.name) || '')));
  const perk = getActorPerkEffects(actor);
  const discount = value => applyPerkDiscount(value, perk.kioskDiscountPct, perk.marketDiscountPct);
  const targetId = String(craftGoal?.target?._id || '');
  let beforeWork;
  return zoneIds.filter(zoneId => {
    const shop = kiosks.find(row => String(row.mapId?._id || row.mapId || '') === String(mapObj?._id || '')
      && String(row.zoneId || '') === String(zoneId));
    const catalog = Array.isArray(shop?.catalog) ? shop.catalog : [];
    if (!catalog.length) return !shop?.hasCustomCatalog && defaultEligible;
    const offer = pickKioskCatalogGoalAction({ catalog, actor, miss: missing, applyKioskCost: discount,
      findById: id => publicItems.find(item => String(item._id) === id),
      targetId, publicItems, ruleset, day });
    if (!offer) return false;
    const preview = { ...actor, _procurementActionKey: undefined };
    const receipt = commitProcurementTransaction({ actor: preview, offer, day, ruleset,
      actionType: offer.kind === 'exchange' ? 'kioskExchange' : 'kioskBuy' });
    if (!receipt.ok) return false;
    if (!targetId) return true;
    beforeWork ??= getGrowthRecipeWork(actor, publicItems, targetId, { ruleset });
    const afterWork = getGrowthRecipeWork(preview, publicItems, targetId, { ruleset });
    const outstanding = new Map(beforeWork.missing.map(row => [row.itemId, row.need]));
    return !beforeWork.blocked && !afterWork.blocked && afterWork.plannedCredits <= preview.simCredits
      && afterWork.missing.every(row => row.need <= (outstanding.get(row.itemId) || 0));
  });
}
