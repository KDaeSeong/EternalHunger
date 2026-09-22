import { normalizeWeaponType } from '../../../utils/equipmentCatalog.js';
import { getInvItemId, inferEquipSlot, inferItemCategory, invQty } from './inventoryRules.js';
import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';

const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const catalogs = new WeakMap();
const keyOf = (item) => String(item?.itemKey || item?.externalId || item?._id || '').trim();

function lateCatalog(items) {
  if (!catalogs.has(items)) catalogs.set(items, items.filter((item) =>
    [5, 6].includes(Number(item.tier)) && inferItemCategory(item) === 'equipment'
    && slots.includes(inferEquipSlot(item)) && getCraftRecipeTerms(item)));
  return catalogs.get(items);
}

// A plan chooses an existing recipe, never grants its result. Authored choices
// win over automatic upgrades; catalog order must not decide between them.
export function getLateGrowthTargets(actor, items) {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  const owned = new Set(inventory.filter((entry) => invQty(inventory, getInvItemId(entry)) > 0).map(getInvItemId));
  const worn = new Set(Object.values(actor.equipped || {}).filter(Boolean).map(String));
  const weapon = normalizeWeaponType(actor.weaponType || '');
  const catalog = lateCatalog(items);
  const compatible = (item, slot, tier) => inferEquipSlot(item) === slot && Number(item.tier) === tier
    && (slot !== 'weapon' || !weapon || !normalizeWeaponType(item.weaponType)
      || normalizeWeaponType(item.weaponType) === weapon);
  const candidates = [], issues = [];
  for (const slot of slots) {
    const currentTier = Math.max(0, ...inventory.filter((entry) => owned.has(getInvItemId(entry))
      && (!entry.craftComponent || worn.has(getInvItemId(entry))) && inferEquipSlot(entry) === slot)
      .map((entry) => Number(entry.tier) || 0));
    for (const [group, tier] of [['legend', 5], ['transcend', 6]]) {
      if (currentTier > tier) continue;
      const requested = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
      if (requested) {
        const target = catalog.find((item) => keyOf(item) === requested || String(item._id) === requested);
        if (!target || !compatible(target, slot, tier)) {
          issues.push({ slot, tier, key: requested, reason: 'invalid_target' });
        } else if (!owned.has(String(target._id))) candidates.push({ target, authored: true, slot, tier });
      } else if (currentTier === tier - 1) {
        for (const target of catalog.filter((item) => compatible(item, slot, tier) && !owned.has(String(item._id)))) {
          candidates.push({ target, authored: false, slot, tier });
        }
      }
    }
  }
  const ownedIngredients = (item) => getCraftRecipeTerms(item).ingredients
    .reduce((sum, row) => sum + Math.min(row.qty, invQty(inventory, row.itemId)), 0);
  candidates.sort((a, b) => Number(b.authored) - Number(a.authored) || a.tier - b.tier
    || ownedIngredients(b.target) - ownedIngredients(a.target)
    || slots.indexOf(a.slot) - slots.indexOf(b.slot) || String(a.target._id).localeCompare(String(b.target._id)));
  return { targets: candidates.map((row) => row.target), issues };
}
