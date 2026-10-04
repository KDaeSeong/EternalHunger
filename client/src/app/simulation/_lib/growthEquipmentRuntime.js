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

// A focus reserves its ingredients, not the entire crafting catalogue. Ready
// upgrades and consumables may use surplus. Only another equipment slot may
// release a blocked focus's reservation; food must still preserve every unit.
export function canCraftAlongsideGrowth(actor, item) {
  const plan = actor?._growthPlan;
  if (!plan?.targetId || plan.craftIds?.includes(String(item._id))) return true;
  const category = inferItemCategory(item);
  if (category === 'consumable') {
    const terms = getCraftRecipeTerms(item);
    return !!terms && terms.ingredients.every((row) =>
      invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty);
  }
  const slot = inferEquipSlot(item);
  if (category !== 'equipment' || !GROWTH_EQUIPMENT_SLOTS.includes(slot)
    || Number(item.tier) <= getActorEquipmentTier(actor, slot)
    || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor?.weaponType, item.weaponType))) return false;
  const terms = getCraftRecipeTerms(item);
  if (!terms) return false;
  // A real higher-tier result in this slot already fulfills the lower-tier
  // need. Its transaction still has to supply every ingredient and credit.
  if (slot === plan.targetSlot && Number(plan.targetTier) > 0 && Number(item.tier) > Number(plan.targetTier)) return true;
  // Receiving a same-slot upgrade replaces the current non-component item,
  // even when that item is absent from the upgrade's ingredient list.
  const replaced = (actor.inventory || []).find((entry) => !entry.craftComponent
    && inferItemCategory(entry) === 'equipment' && inferEquipSlot(entry) === slot);
  if (slot === plan.targetSlot && Number(plan.reservedQtyById?.[getInvItemId(replaced)] || 0) > 0) return false;
  return (Boolean(plan.blocked) && slot !== plan.targetSlot) || terms.ingredients.every((row) =>
    invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty);
}
