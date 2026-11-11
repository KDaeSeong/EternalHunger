import { getInvItemId, inferEquipSlot, inferItemCategory } from './inventoryRules.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { getOpeningGrowthTargetByKey } from './growthTargetIdentityRuntime.js';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';

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
// Resolve current declarations against the complete ordered catalogue at the
// successful commit boundary. An old or absent plan is not an acquisition gate.
export function recordCraftedGrowthAcquisition(actor, item, items) {
  const id = String(item?._id || ''), slot = inferEquipSlot(item);
  if (!id || inferItemCategory(item) !== 'equipment'
    || !['weapon', 'head', 'clothes', 'arm', 'shoes'].includes(slot) || !ownsGrowthTarget(actor, item)
    || !Array.isArray(items)) return;
  const heroKey = String(actor.goalLoadouts?.hero?.[`${slot}Key`] || '').trim();
  if (heroKey && String(getOpeningGrowthTargetByKey(items, heroKey)?._id || '') === id) {
    actor._openingAcquiredItemIds = { ...actor._openingAcquiredItemIds, [slot]: id };
  }
  const group = Number(item.tier) === 5 ? 'legend' : Number(item.tier) === 6 ? 'transcend' : '';
  const matchesLate = group && getLateGrowthTargets(actor, items, { authoredOnly: true, includeAcquired: true }).targets
    .some(target => String(target._id) === id && inferEquipSlot(target) === slot && Number(target.tier) === Number(item.tier));
  if (matchesLate) actor._lateAcquiredItemIds = { ...actor._lateAcquiredItemIds,
    [group]: { ...actor._lateAcquiredItemIds?.[group], [slot]: id } };
}
