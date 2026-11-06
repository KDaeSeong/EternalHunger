import { getInvItemId, inferEquipSlot, inferItemCategory } from './inventoryRules.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';

export function ownsGrowthTarget(actor, target) {
  return (actor.inventory || []).some(entry => {
    const raw = entry?.qty === undefined ? 1 : entry.qty;
    const qty = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
    return getInvItemId(entry) === String(target._id) && Number.isSafeInteger(qty) && qty > 0
      && (inferEquipSlot(target) !== 'weapon'
        || areEquipmentWeaponTypesCompatible(actor.weaponType, { ...target, ...entry }.weaponType));
  });
}

// Record only an actual received result matching a current direct declaration.
// Use the planner's already resolved group-specific identity, never reinterpret
// aliases without its complete catalog. Planning prunes changed declarations.
export function recordCraftedGrowthAcquisition(actor, item) {
  const id = String(item?._id || ''), slot = inferEquipSlot(item);
  if (!id || inferItemCategory(item) !== 'equipment'
    || !['weapon', 'head', 'clothes', 'arm', 'shoes'].includes(slot) || !ownsGrowthTarget(actor, item)) return;
  const matches = group => {
    const key = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
    const planned = actor._growthPlan?.authoredTargetsByGroup?.[group]?.[slot];
    return key && planned?.key === key && planned.itemId === id;
  };
  if (matches('hero')) actor._openingAcquiredItemIds = { ...actor._openingAcquiredItemIds, [slot]: id };
  const group = Number(item.tier) === 5 ? 'legend' : Number(item.tier) === 6 ? 'transcend' : '';
  if (group && matches(group)) actor._lateAcquiredItemIds = { ...actor._lateAcquiredItemIds,
    [group]: { ...actor._lateAcquiredItemIds?.[group], [slot]: id } };
}
