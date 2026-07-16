import {
  createEquipmentItem,
  normalizeWeaponType,
} from '../../../utils/equipmentCatalog';
import { tierLabelKo } from './simulationCommon';
import { START_WEAPON_TYPES } from './simulationConstants';
import {
  inferEquipSlot,
} from './inventoryRules';

function getInvId(x) {
  return String(x?.itemId || x?.id || x?._id || '');
}

function clampGearTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function getInvTier(x, itemMetaById) {
  const t0 = Number(x?.tier);
  if (Number.isFinite(t0) && t0 > 0) return clampGearTier(t0);
  const id = getInvId(x);
  const m = id ? itemMetaById?.[id] : null;
  return clampGearTier(m?.tier || 1);
}

function resolveActorWeaponType(actor) {
  const preferred = normalizeWeaponType(String(actor?.weaponType || '').trim());
  if (preferred) return preferred;
  const fallback = START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  return normalizeWeaponType(fallback);
}

function catalogItemId(item) {
  return String(item?._id || item?.itemId || item?.id || '').trim();
}

function isGeneratedCatalogEquipment(item) {
  const id = catalogItemId(item);
  return id.startsWith('wpn_') || id.startsWith('eq_');
}

function catalogItemKey(item) {
  return String(item?.itemKey || item?.externalId || '').trim();
}

function isPreferredCatalogSource(item) {
  const key = catalogItemKey(item).toLowerCase();
  const tags = Array.isArray(item?.tags) ? item.tags.map((x) => String(x || '').toLowerCase()) : [];
  const source = String(item?.source || '').toLowerCase();
  return key.startsWith('namu:') || tags.includes('namu') || source.includes('openapi') || source.includes('namu') || String(item?.erCode || '').trim();
}

function getCatalogWeaponType(item) {
  const rawList = [
    item?.weaponType,
    item?.itemSubType,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ];
  for (const raw of rawList) {
    const normalized = normalizeWeaponType(String(raw || '').trim());
    if (normalized) return normalized;
  }
  return '';
}

function cloneCatalogGear(item, opts = {}) {
  if (!item || typeof item !== 'object') return null;
  const tier = clampGearTier(item?.tier || 1);
  return {
    ...item,
    tier,
    rarity: item?.rarity || tierLabelKo(tier),
    equipSlot: String(item?.equipSlot || inferEquipSlot(item) || '').toLowerCase(),
    _forceReplaceSameTier: opts?.forceReplaceSameTier === true,
  };
}

function createWeaponCatalogFallback(weaponType, tier, opts = {}) {
  if (!weaponType) return null;
  const generated = createEquipmentItem({
    slot: 'weapon',
    tier,
    weaponType,
  });
  return cloneCatalogGear(generated, opts);
}

function pickCatalogEquipmentItem(publicItems, opts = {}) {
  const slot = String(opts?.slot || '').toLowerCase();
  if (!slot) return null;
  const targetTier = clampGearTier(opts?.tier || 1);
  const preferredWeaponType = slot === 'weapon' ? normalizeWeaponType(String(opts?.weaponType || '').trim()) : '';
  const avoid = new Set((Array.isArray(opts?.avoidItemIds) ? opts.avoidItemIds : []).map((id) => String(id || '').trim()).filter(Boolean));

  const all = (Array.isArray(publicItems) ? publicItems : [])
    .filter((item) => {
      const id = catalogItemId(item);
      if (!id || avoid.has(id) || isGeneratedCatalogEquipment(item)) return false;
      if (String(item?.lockedByAdmin || '') === 'deleted') return false;
      if (String(item?.equipSlot || inferEquipSlot(item) || '').toLowerCase() !== slot) return false;
      return true;
    });
  if (!all.length) {
    return slot === 'weapon'
      ? createWeaponCatalogFallback(preferredWeaponType, targetTier, opts)
      : null;
  }

  const typed = (preferredWeaponType && slot === 'weapon')
    ? all.filter((item) => getCatalogWeaponType(item) === preferredWeaponType)
    : all;
  if (preferredWeaponType && slot === 'weapon' && !typed.length) {
    return createWeaponCatalogFallback(preferredWeaponType, targetTier, opts);
  }
  const typePool = typed.length ? typed : all;
  const preferredSourcePool = typePool.filter(isPreferredCatalogSource);
  const sourcePool = preferredSourcePool.length ? preferredSourcePool : typePool;

  const exact = sourcePool.filter((item) => clampGearTier(item?.tier || 1) === targetTier);
  let pool = exact;
  if (!pool.length && opts?.allowNearestTier !== false) {
    const lower = sourcePool
      .filter((item) => clampGearTier(item?.tier || 1) <= targetTier)
      .sort((a, b) => clampGearTier(b?.tier || 1) - clampGearTier(a?.tier || 1));
    const higher = sourcePool
      .filter((item) => clampGearTier(item?.tier || 1) > targetTier)
      .sort((a, b) => clampGearTier(a?.tier || 1) - clampGearTier(b?.tier || 1));
    if (lower.length) {
      const bestTier = clampGearTier(lower[0]?.tier || 1);
      pool = lower.filter((item) => clampGearTier(item?.tier || 1) === bestTier);
    } else if (higher.length) {
      const bestTier = clampGearTier(higher[0]?.tier || 1);
      pool = higher.filter((item) => clampGearTier(item?.tier || 1) === bestTier);
    }
  }
  if (!pool.length) return null;

  const named = pool
    .filter((item) => String(item?.name || '').trim())
    .sort((a, b) => {
      const sa = isPreferredCatalogSource(a) ? 1 : 0;
      const sb = isPreferredCatalogSource(b) ? 1 : 0;
      if (sb !== sa) return sb - sa;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  const finalPool = named.length ? named : pool;
  const picked = finalPool[Math.floor(Math.random() * finalPool.length)] || finalPool[0];
  return cloneCatalogGear(picked, { forceReplaceSameTier: opts?.forceReplaceSameTier === true });
}

export {
  catalogItemId,
  clampGearTier,
  getInvId,
  getInvTier,
  pickCatalogEquipmentItem,
  resolveActorWeaponType,
};
