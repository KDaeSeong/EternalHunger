import { itemDisplayName, safeTags } from './simulationCommon';
import { inferItemCategory } from './inventoryRules';
import { dedupeDevGrantItems } from './devGrantRuntime';

export function buildItemNameById(publicItems) {
  const map = {};
  (Array.isArray(publicItems) ? publicItems : []).forEach((item) => {
    if (item?._id) map[String(item._id)] = item.name;
  });
  return map;
}

export function buildItemMetaById(publicItems) {
  const map = {};
  (Array.isArray(publicItems) ? publicItems : []).forEach((item) => {
    if (!item?._id) return;
    const rawTier = Number(item?.tier || 1);
    const tier = Number.isFinite(rawTier) ? Math.max(1, Math.min(6, Math.floor(rawTier))) : 1;
    map[String(item._id)] = {
      name: String(item?.name || item?.text || ''),
      type: item?.type,
      tier,
      tags: safeTags(item),
      spawnZones: Array.isArray(item?.spawnZones) ? item.spawnZones : [],
      spawnCrateTypes: Array.isArray(item?.spawnCrateTypes) ? item.spawnCrateTypes : [],
      droneCreditsCost: Math.max(0, Number(item?.droneCreditsCost || 0)),
    };
  });
  return map;
}

export function buildItemKeyById(publicItems) {
  const map = {};
  (Array.isArray(publicItems) ? publicItems : []).forEach((item) => {
    if (!item?._id) return;
    const key = String(item?.itemKey || item?.externalId || '').trim();
    if (key) map[String(item._id)] = key;
  });
  return map;
}

export function buildCraftableItems(publicItems) {
  return (Array.isArray(publicItems) ? publicItems : [])
    .filter((item) => Array.isArray(item?.recipe?.ingredients) && item.recipe.ingredients.length > 0)
    .sort((a, b) => (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name)));
}

export function buildInventoryOptions(selectedChar) {
  const inventory = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
  const map = new Map();
  inventory.forEach((item) => {
    const id = item?.itemId ? String(item.itemId) : '';
    const name = itemDisplayName(item);
    if (!id) return;
    const prev = map.get(id);
    const qty = Math.max(1, Number(item.qty || 1));
    if (!prev) map.set(id, { itemId: id, name, qty });
    else map.set(id, { ...prev, qty: prev.qty + qty });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDevGrantItemOptions(publicItems) {
  return dedupeDevGrantItems(publicItems)
    .filter((item) => item?._id)
    .map((item) => {
      const rawTier = Number(item?.tier || 1);
      const tier = Number.isFinite(rawTier) ? Math.max(1, Math.min(6, Math.floor(rawTier))) : 1;
      return {
        ...item,
        _label: `${itemDisplayName(item)} · T${tier} · ${String(item?.equipSlot || item?.type || inferItemCategory(item) || '-')}`,
      };
    })
    .sort((a, b) => String(a._label || '').localeCompare(String(b._label || '')));
}

export function filterVisibleDevGrantItemOptions(devGrantItemOptions, devGrantSearch, devGrantItemId) {
  const query = String(devGrantSearch || '').trim().toLowerCase();
  const selected = String(devGrantItemId || '');
  const list = (Array.isArray(devGrantItemOptions) ? devGrantItemOptions : [])
    .filter((item) => {
      if (!query) return true;
      return [
        item?._label,
        item?.name,
        item?._id,
        item?.itemKey,
        item?.externalId,
        item?.type,
        item?.equipSlot,
        item?.rarity,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  const picked = selected
    ? (Array.isArray(devGrantItemOptions) ? devGrantItemOptions : []).find((item) => String(item?._id || '') === selected)
    : null;
  if (picked && !list.some((item) => String(item?._id || '') === selected)) return [picked, ...list];
  return list;
}

export function getSelectedDevGrantItem(devGrantItemOptions, devGrantItemId) {
  const selected = String(devGrantItemId || '');
  if (!selected) return null;
  return (Array.isArray(devGrantItemOptions) ? devGrantItemOptions : [])
    .find((item) => String(item?._id || '') === selected) || null;
}

export function buildTradeWantItemOptions(publicItems, tradeWantSearch, tradeWantRows, limit) {
  const query = String(tradeWantSearch || '').trim().toLowerCase();
  const selectedIds = new Set(
    (Array.isArray(tradeWantRows) ? tradeWantRows : [])
      .map((row) => String(row?.itemId || ''))
      .filter(Boolean)
  );
  const all = (Array.isArray(publicItems) ? publicItems : []).filter((item) => item?._id);
  const list = all
    .filter((item) => {
      if (selectedIds.has(String(item?._id || ''))) return true;
      if (!query) return true;
      return [
        item?.name,
        item?._id,
        item?.itemKey,
        item?.externalId,
        item?.type,
        item?.equipSlot,
        item?.rarity,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((a, b) => (Number(b?.tier || 0) - Number(a?.tier || 0)) || String(a?.name || '').localeCompare(String(b?.name || '')));
  const selected = all.filter((item) => selectedIds.has(String(item?._id || '')));
  const renderLimit = Math.max(1, Math.floor(Number(limit || 80)));
  const merged = [...selected, ...list.slice(0, renderLimit)];
  const seen = new Set();
  return merged.filter((item) => {
    const id = String(item?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, renderLimit);
}

export function limitVisibleRows(list, showAll, limit) {
  const rows = Array.isArray(list) ? list : [];
  return showAll ? rows : rows.slice(0, Math.max(0, Math.floor(Number(limit || 0))));
}
