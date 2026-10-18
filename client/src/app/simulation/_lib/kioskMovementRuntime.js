import { classifySpecialByName } from './craftRuntime.js';
import { pickKioskCatalogGoalAction } from './aiKioskCatalogRuntime.js';
import { applyPerkDiscount, getActorPerkEffects } from './perkRuntime.js';
import { createKioskRecipeOfferValidator, quoteDefaultKioskGoalAction } from './kioskGoalQuoteRuntime.js';

// Movement quotes only an outstanding recipe need. An authored shop cannot
// borrow default stock or prices, and quoting never pays or reserves anything.
export function getKioskMovementTargets({ zoneIds = [], mapObj, kiosks = [], actor,
  craftGoal, publicItems = [], ruleset, day, phase, upgradeNeed, desiredKeys = [], desiredItemIds = [] } = {}) {
  const keys = new Set(desiredKeys);
  const itemIds = new Set(desiredItemIds.map(String));
  const missing = (craftGoal?.missing || []).filter(row => itemIds.has(String(row.itemId)) || keys.has(
    String(row.special || classifySpecialByName(row.name) || '')));
  const perk = getActorPerkEffects(actor);
  const discount = value => applyPerkDiscount(value, perk.kioskDiscountPct, perk.marketDiscountPct);
  const targetId = String(craftGoal?.target?._id || '');
  // Default shops quote the same actor/recipe within this synchronous call.
  // Keep only availability, including a failed quote; custom stock remains
  // per-shop and the next movement decision must quote fresh inputs again.
  let defaultOfferAvailable;
  return zoneIds.filter(zoneId => {
    const shop = kiosks.find(row => String(row.mapId?._id || row.mapId || '') === String(mapObj?._id || '')
      && String(row.zoneId || '') === String(zoneId));
    const catalog = Array.isArray(shop?.catalog) ? shop.catalog : [];
    if (!catalog.length) {
      if (shop?.hasCustomCatalog) return false;
      if (defaultOfferAvailable === undefined) {
        defaultOfferAvailable = !!quoteDefaultKioskGoalAction({ actor, craftGoal: { ...craftGoal, missing }, publicItems,
          ruleset, day, phase, includeSurplus: true, upgradeNeed: upgradeNeed && { ...upgradeNeed,
            wantLegend: upgradeNeed.wantLegend && ['meteor', 'life_tree', 'mithril', 'force_core'].some(key => keys.has(key)),
            wantTrans: upgradeNeed.wantTrans && keys.has('vf') } });
      }
      return defaultOfferAvailable;
    }
    const offer = pickKioskCatalogGoalAction({ catalog, actor, miss: missing, applyKioskCost: discount,
      findById: id => publicItems.find(item => String(item._id) === id),
      targetId, publicItems, ruleset, day });
    return !!offer && (!!targetId || createKioskRecipeOfferValidator({ actor, publicItems, ruleset, day })(offer));
  });
}
