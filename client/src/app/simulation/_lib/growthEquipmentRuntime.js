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
// upgrades in another slot may use surplus; a blocked focus can release it.
export function canCraftAlongsideGrowth(actor, item) {
  const plan = actor?._growthPlan;
  if (!plan?.targetId || plan.craftIds?.includes(String(item._id))) return true;
  const slot = inferEquipSlot(item);
  if (inferItemCategory(item) !== 'equipment' || !GROWTH_EQUIPMENT_SLOTS.includes(slot)
    || Number(item.tier) <= getActorEquipmentTier(actor, slot)
    || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor?.weaponType, item.weaponType))) return false;
  const terms = getCraftRecipeTerms(item);
  if (!terms) return false;
  return Boolean(plan.blocked) || terms.ingredients.every((row) =>
    invQty(actor.inventory, row.itemId) - Number(plan.reservedQtyById?.[row.itemId] || 0) >= row.qty);
}
