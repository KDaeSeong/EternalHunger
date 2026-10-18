import { ER_WEAPON_TYPES_KO, normalizeErWeaponType, normalizeErWeaponTypes } from '../../../utils/erMeta.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { inferEquipSlot, inferItemCategory } from './inventoryRules.js';
import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';

export const GUEST_GOAL_TIERS = [
  { key: 'hero', label: '영웅', tier: 4 },
  { key: 'legend', label: '전설', tier: 5 },
  { key: 'transcend', label: '초월', tier: 6 },
];

export const GUEST_GOAL_SLOTS = [
  { key: 'weaponKey', slot: 'weapon', label: '무기' },
  { key: 'headKey', slot: 'head', label: '머리' },
  { key: 'clothesKey', slot: 'clothes', label: '옷' },
  { key: 'armKey', slot: 'arm', label: '팔' },
  { key: 'shoesKey', slot: 'shoes', label: '신발' },
];

const tierByKey = new Map(GUEST_GOAL_TIERS.map((row) => [row.key, row]));
const slotByKey = new Map(GUEST_GOAL_SLOTS.map((row) => [row.key, row]));
const itemId = (item) => String(item?._id || '').trim();
const aliasesFor = (item, tierKey) => tierKey === 'hero'
  ? [item?.itemKey, item?.externalId, item?._id]
  : [item?._id, item?.itemKey, item?.externalId];
const valueOf = (value) => String(value ?? '').trim();
const isUnavailable = (item) => !itemId(item) || item.lockedByAdmin === 'deleted'
  || itemId(item).startsWith('wpn_') || itemId(item).startsWith('eq_');

export function normalizeGuestGoalLoadouts(raw) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Object.keys(raw).some((key) => !tierByKey.has(key))) return null;
  const result = Object.fromEntries(GUEST_GOAL_TIERS.map(({ key }) => [key, {}]));
  for (const { key: tierKey } of GUEST_GOAL_TIERS) {
    const tier = raw[tierKey];
    if (tier === undefined) continue;
    if (!tier || typeof tier !== 'object' || Array.isArray(tier)
      || Object.keys(tier).some((key) => !slotByKey.has(key))) return null;
    for (const { key: slotKey } of GUEST_GOAL_SLOTS) {
      const value = tier[slotKey];
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length > 180 || /[\u0000-\u001f\u007f]/.test(value)) return null;
      result[tierKey][slotKey] = value.trim();
    }
  }
  for (const tier of Object.values(result)) {
    for (const { key: slotKey } of GUEST_GOAL_SLOTS) if (!Object.hasOwn(tier, slotKey)) tier[slotKey] = '';
  }
  return result;
}

function firstOpeningMatch(items, key) {
  const wanted = valueOf(key);
  if (!wanted) return null;
  return (Array.isArray(items) ? items : []).find((item) => item
    && aliasesFor(item, 'hero').some((alias) => valueOf(alias) === wanted)) || null;
}

function goalWeaponTypes(actor) {
  const explicit = normalizeErWeaponType(actor?.weaponType || '');
  if (explicit && ER_WEAPON_TYPES_KO.includes(explicit)) return [explicit];
  const configured = normalizeErWeaponTypes(actor?.erWeapons).filter((value) => ER_WEAPON_TYPES_KO.includes(value));
  if (configured.length) return configured;
  return [];
}

function itemMatchesTarget(item, tierKey, slotKey, actor) {
  const tier = tierByKey.get(tierKey);
  const slot = slotByKey.get(slotKey);
  if (!tier || !slot || isUnavailable(item) || inferItemCategory(item) !== 'equipment'
    || inferEquipSlot(item) !== slot.slot || Number(item.tier) !== tier.tier) return false;
  if (slot.slot !== 'weapon') return true;
  const allowed = goalWeaponTypes(actor);
  return allowed.length > 0 && allowed.some((weapon) => areEquipmentWeaponTypesCompatible(weapon, item.weaponType));
}

export function getGuestEquipmentGoalOptions(actor, items, tierKey, slot) {
  const slotKey = GUEST_GOAL_SLOTS.find((row) => row.slot === slot || row.key === slot)?.key;
  if (!tierByKey.has(tierKey) || !slotKey || !Array.isArray(items)) return [];
  const seen = new Set();
  // The late planner's authored-key index is catalog-order first-valid. Build
  // that same index once for the option list instead of rescanning the full
  // catalog once per candidate. resolveGuestEquipmentGoal remains the exact
  // single-key runtime probe used when validating a persisted selection.
  const firstValidLateAlias = new Map();
  if (tierKey !== 'hero') {
    for (const candidate of items) {
      const tier = Number(candidate?.tier);
      const candidateSlot = inferEquipSlot(candidate);
      if (![5, 6].includes(tier) || inferItemCategory(candidate) !== 'equipment'
        || !GUEST_GOAL_SLOTS.some((row) => row.slot === candidateSlot)
        || isUnavailable(candidate) || !getCraftRecipeTerms(candidate)) continue;
      const primary = String(candidate?.itemKey || candidate?.externalId || candidate?._id || '').trim();
      for (const alias of [primary, itemId(candidate)]) if (alias && !firstValidLateAlias.has(alias)) {
        firstValidLateAlias.set(alias, candidate);
      }
    }
  }
  return items.filter((item) => {
    const id = itemId(item);
    if (!itemMatchesTarget(item, tierKey, slotKey, actor) || !getCraftRecipeTerms(item) || seen.has(id)) return false;
    const resolved = tierKey === 'hero'
      ? resolveGuestEquipmentGoal(actor, items, tierKey, slotKey, id)
      : firstValidLateAlias.get(id);
    if (itemId(resolved) !== id || !itemMatchesTarget(resolved, tierKey, slotKey, actor)) return false;
    seen.add(id);
    return true;
  });
}

export function resolveGuestEquipmentGoal(actor, items, tierKey, slot, key) {
  const tier = tierByKey.get(tierKey);
  const slotRow = GUEST_GOAL_SLOTS.find((row) => row.slot === slot || row.key === slot);
  const wanted = valueOf(key);
  if (!tier || !slotRow || !wanted || !Array.isArray(items)) return null;
  if (tierKey === 'hero') {
    const item = firstOpeningMatch(items, wanted);
    return itemMatchesTarget(item, tierKey, slotRow.key, actor) && getCraftRecipeTerms(item) ? item : null;
  }
  const goalLoadouts = Object.fromEntries(GUEST_GOAL_TIERS.map(({ key: group }) => [group,
    Object.fromEntries(GUEST_GOAL_SLOTS.map(({ key: field }) => [field, '']))]));
  goalLoadouts[tierKey][slotRow.key] = wanted;
  const probe = { ...actor, inventory: [], equipped: {}, _lateAcquiredItemIds: undefined,
    goalLoadouts };
  const result = getLateGrowthTargets(probe, items, { authoredOnly: true, includeAcquired: true });
  const resolved = result.targets.find((item) => itemId(item) && Number(item.tier) === tier.tier
    && inferEquipSlot(item) === slotRow.slot && !isUnavailable(item)
    && (slotRow.slot !== 'weapon' || goalWeaponTypes(actor).some((weapon) => areEquipmentWeaponTypesCompatible(weapon, item.weaponType))));
  return resolved || null;
}

export function getGuestEquipmentGoalErrors(actor, items) {
  const loadouts = normalizeGuestGoalLoadouts(actor?.goalLoadouts);
  if (loadouts === null) return ['장비 목표 형식을 확인해 주세요.'];
  if (loadouts === undefined) return [];
  const catalog = Array.isArray(items) ? items : [];
  const errors = [];
  for (const { key: tierKey, label: tierLabel } of GUEST_GOAL_TIERS) {
    for (const { key: slotKey, label: slotLabel } of GUEST_GOAL_SLOTS) {
      const key = loadouts[tierKey][slotKey];
      if (!key) continue;
      const item = resolveGuestEquipmentGoal(actor, catalog, tierKey, slotKey, key);
      if (!item || !itemMatchesTarget(item, tierKey, slotKey, actor)) {
        errors.push(`${tierLabel} ${slotLabel} 목표가 현재 아이템 목록의 슬롯·티어·무기 호환 조건과 맞지 않습니다.`);
      }
    }
  }
  return errors;
}
