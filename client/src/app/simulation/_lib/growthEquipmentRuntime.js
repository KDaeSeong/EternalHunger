import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { getInvItemId, inferEquipSlot, inferItemCategory, invQty } from './inventoryRules.js';
import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';

export const GROWTH_EQUIPMENT_SLOTS = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const catalogs = new WeakMap();

export function getGrowthEquipmentCatalog(items) {
  if (!catalogs.has(items)) catalogs.set(items, items.filter((item) =>
    inferItemCategory(item) === 'equipment' && GROWTH_EQUIPMENT_SLOTS.includes(inferEquipSlot(item))
    && Number(item.tier) >= 1 && Number(item.tier) <= 6 && getCraftRecipeTerms(item)));
  return catalogs.get(items);
}

export function getActorEquipmentTier(actor, slot) {
  const inventory = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const worn = new Set(Object.values(actor?.equipped || {}).filter(Boolean).map(String));
  return Math.max(0, ...inventory.filter((entry) => inferEquipSlot(entry) === slot
    && invQty(inventory, getInvItemId(entry)) > 0
    && (!entry.craftComponent || worn.has(getInvItemId(entry)))
    && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor?.weaponType, entry.weaponType)))
    .map((entry) => Number(entry.tier) || 0));
}

// A focus reserves its ingredients and remaining recipe fees, not the entire
// catalogue. Routine consumables use real surplus; urgent recovery has its own
// survival-first transaction. A recipe's own consumable intermediates are not
// side crafts. Only another equipment slot may release blocked ingredients.
export function canCraftAlongsideGrowth(actor, item) {
  const plan = actor?._growthPlan;
  if (!plan?.targetId || plan.craftIds?.includes(String(item._id))) return true;
  const category = inferItemCategory(item);
  if (category === 'consumable') {
    const terms = getCraftRecipeTerms(item);
    const surplusCredits = Math.max(0, Number(actor?.simCredits ?? 0) - Number(plan.plannedCredits ?? 0));
    return !!terms && terms.creditsCost <= surplusCredits && terms.ingredients.every((row) =>
      invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty);
  }
  const slot = inferEquipSlot(item);
  if (category !== 'equipment' || !GROWTH_EQUIPMENT_SLOTS.includes(slot)
    || Number(item.tier) <= getActorEquipmentTier(actor, slot)
    || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor?.weaponType, item.weaponType))) return false;
  const terms = getCraftRecipeTerms(item);
  if (!terms) return false;
  // A real higher-tier result in this slot already fulfills the lower-tier
  // automatic need. A specifically authored focus remains exact: only actual
  // ingredient and credit surplus may fund an unrelated higher-tier result.
  if (slot === plan.targetSlot && Number(plan.targetTier) > 0 && Number(item.tier) > Number(plan.targetTier)) {
    const exactAuthoredFocus = Array.isArray(plan.exactTargetIds)
      && plan.exactTargetIds.includes(String(plan.targetId));
    if (!exactAuthoredFocus) return true;
    const candidateAuthored = Array.isArray(plan.exactTargetIds)
      && String(item._id) !== String(plan.targetId)
      && plan.exactTargetIds.includes(String(item._id));
    if (candidateAuthored) {
      // A later explicitly selected same-slot goal may replace this focus when
      // its own real recipe is payable and all inputs are actually present.
      return terms.creditsCost <= Number(actor?.simCredits ?? 0)
        && terms.ingredients.every((row) => invQty(actor.inventory, row.itemId) >= row.qty);
    }
    const surplusCredits = Math.max(0, Number(actor?.simCredits ?? 0) - Number(plan.plannedCredits ?? 0));
    if (terms.creditsCost > surplusCredits || !terms.ingredients.every((row) =>
      invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty)) return false;
    // Surplus is necessary, but a same-slot auto-equip also replaces the
    // current item. Let the shared replacement-item guard below decide that.
  }
  // Receiving a same-slot upgrade replaces the current non-component item,
  // even when that item is absent from the upgrade's ingredient list.
  const replaced = (actor.inventory || []).find((entry) => !entry.craftComponent
    && inferItemCategory(entry) === 'equipment' && inferEquipSlot(entry) === slot);
  if (slot === plan.targetSlot && Number(plan.reservedQtyById?.[getInvItemId(replaced)] || 0) > 0) return false;
  return (Boolean(plan.blocked) && slot !== plan.targetSlot) || terms.ingredients.every((row) =>
    invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty);
}
