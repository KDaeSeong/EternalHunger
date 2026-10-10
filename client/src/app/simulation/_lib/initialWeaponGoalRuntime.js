import {
  ER_WEAPON_TYPES_KO,
  normalizeErWeaponType,
  normalizeErWeaponTypes,
  pickInitialErWeaponType,
} from '../../../utils/erMeta.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { inferEquipSlot, inferItemCategory } from './inventoryRules.js';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';

function isUsableWeaponGoal(item) {
  const id = String(item?._id || '');
  return Boolean(id && item.lockedByAdmin !== 'deleted' && !id.startsWith('wpn_') && !id.startsWith('eq_')
    && inferItemCategory(item) === 'equipment' && inferEquipSlot(item) === 'weapon');
}

function openingWeaponGoal(character, items) {
  const key = String(character?.goalLoadouts?.hero?.weaponKey || '').trim();
  if (!key) return null;
  // Match opening progress: the first alias wins even if that row is invalid.
  // Do not silently replace a deleted, wrong-slot or colliding authored goal.
  const item = items.find((row) => row && [row.itemKey, row.externalId, row._id]
    .some((alias) => String(alias ?? '').trim() === key));
  return isUsableWeaponGoal(item) ? item : null;
}

export function pickInitialErWeaponTypeForGoals(character, publicItems = [], random) {
  const items = Array.isArray(publicItems) ? publicItems.filter((item) => item && typeof item === 'object') : [];
  const configured = normalizeErWeaponTypes(character?.erWeapons);
  const fallback = normalizeErWeaponType(character?.weaponType || '');
  const pool = configured.length ? configured : ER_WEAPON_TYPES_KO.includes(fallback) ? [fallback] : ER_WEAPON_TYPES_KO;
  const opening = openingWeaponGoal(character, items);
  // Use the late planner's real tier/recipe/alias validation, but not old match
  // inventory or weapon state: this is a new run, before its route is built.
  const late = getLateGrowthTargets({
    goalLoadouts: character?.goalLoadouts,
    weaponType: '', inventory: [], equipped: {},
  }, items, { authoredOnly: true }).targets
    .filter(isUsableWeaponGoal);
  const goals = opening ? [opening, ...late] : late;
  const compatible = goals.length ? pool.filter((weapon) => goals
    .every((goal) => areEquipmentWeaponTypesCompatible(weapon, goal.weaponType))) : [];
  // An empty intersection is a configuration conflict, not permission to edit
  // the user's goals or allowed weapons. Existing growth diagnostics retain it.
  // Keep exactly one random draw, including a one-choice compatible pool.
  return pickInitialErWeaponType(compatible.length ? { ...character, erWeapons: compatible } : character, random);
}
