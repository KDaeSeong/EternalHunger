import { getRegionZoneWeightsForItem } from './lumiaRegionData';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';
import { classifySpecialByName } from './craftRuntime';

const sourceCache = new WeakMap();

// Source locations are static. Stock is per match, never per actor or phase.
export function getFieldItemSourceZones(item, mapObj) {
  if (!item || !mapObj) return [];
  if (!sourceCache.has(mapObj)) sourceCache.set(mapObj, new WeakMap());
  const cache = sourceCache.get(mapObj);
  if (cache.has(item)) return cache.get(item);
  const zones = new Set((mapObj.zones || []).map((zone) => String(zone.zoneId)));
  const ids = new Set(getRegionZoneWeightsForItem(item, mapObj.zones).keys());
  for (const crate of mapObj.itemCrates || []) {
    const denied = mapObj.crateAllowDeny?.[crate.zoneId] || [];
    if (denied.includes(String(crate.crateType || 'food').toLowerCase())) continue;
    if ((crate.lootTable || []).some((row) => String(row.itemId) === String(item._id) && Number(row.weight ?? 1) > 0)) ids.add(String(crate.zoneId));
  }
  for (const zone of mapObj.zones || []) {
    if ((item.spawnZones || []).some((id) => id === zone.zoneId || id === zone.name)) ids.add(String(zone.zoneId));
  }
  if (['물', 'water'].includes(String(item.name || '').trim().toLowerCase())) {
    for (const zoneId of mapObj.waterSourceZoneIds || []) ids.add(String(zoneId));
  }
  const result = [...ids].filter((id) => zones.has(id));
  cache.set(item, result);
  return result;
}

export function createFieldResources(mapObj, items = [], ruleset = {}) {
  // A simulator supply parameter, not an asserted original-game spawn count.
  const configured = Number(ruleset.drops?.fieldCrate?.sharedStock?.unitsPerItemSource ?? 12);
  const units = Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : 12;
  const byZone = {};
  for (const item of items) {
    if (!item?._id || isItemExcludedFromFieldFarming(item) || classifySpecialByName(item.name)) continue;
    if (Number(item.tier || 1) > 2 || item.recipe?.ingredients?.length) continue;
    for (const zoneId of getFieldItemSourceZones(item, mapObj)) {
      const override = Number(mapObj?.fieldResourceStock?.[zoneId]?.[item._id] ?? units);
      const initial = Number.isFinite(override) ? Math.max(0, Math.floor(override)) : units;
      byZone[zoneId] ||= {};
      byZone[zoneId][String(item._id)] = { initial, remaining: initial, taken: 0 };
    }
  }
  return { version: 1, mapId: String(mapObj?._id || mapObj?.id || ''), byZone };
}

export function ensureFieldResources(spawnState, mapObj, items, ruleset) {
  if (!spawnState || !mapObj || !items?.length) return null;
  const mapId = String(mapObj._id || mapObj.id || '');
  if (spawnState.fieldResources?.version !== 1 || spawnState.fieldResources.mapId !== mapId) {
    spawnState.fieldResources = createFieldResources(mapObj, items, ruleset);
  }
  return spawnState.fieldResources;
}

export function getFieldResourceQty(resources, zoneId, itemId) {
  if (!resources) return Infinity; // Catalog-only previews do not own a match.
  return Math.max(0, Math.floor(Number(resources.byZone?.[zoneId]?.[itemId]?.remaining) || 0));
}

export function limitFieldLootToStock(loot, resources, neededQtyById) {
  if (!loot?.itemId) return null;
  const need = neededQtyById?.[loot.itemId] ?? Infinity;
  const qty = Math.min(Math.max(0, Math.floor(Number(loot.qty) || 0)), getFieldResourceQty(resources, loot.zoneId, loot.itemId), need);
  return qty > 0 ? { ...loot, qty } : null;
}

// The callback is synchronous: inventory acceptance and world consumption form
// one transaction. An unsuccessful/partial pickup leaves the rest in the world.
export function collectFieldResourceLoot(resources, loot, receive) {
  if (loot?._fieldCollected) return 0;
  const proposal = limitFieldLootToStock(loot, resources);
  if (!proposal) return 0;
  const accepted = Math.min(proposal.qty, Math.max(0, Math.floor(Number(receive(proposal.qty)) || 0)));
  if (!accepted) return 0;
  loot._fieldCollected = true;
  if (resources) {
    const row = resources.byZone[loot.zoneId][loot.itemId];
    row.remaining -= accepted;
    row.taken += accepted;
  }
  return accepted;
}

export function emitFieldResourcePickup(resources, loot, qty, actor, actions = {}) {
  if (!resources || qty <= 0) return;
  const row = resources.byZone?.[loot.zoneId]?.[loot.itemId];
  if (!row) return;
  actions.emitRunEvent?.('field_resource', {
    who: String(actor?._id || ''), teamId: actor?.teamId, zoneId: loot.zoneId,
    itemId: loot.itemId, qty, initial: row.initial, remaining: row.remaining,
    depleted: row.remaining === 0,
  }, actions.atNow?.());
  if (row.remaining === 0) actions.addLog?.(`📦 ${actions.getZoneName?.(loot.zoneId) || loot.zoneId}의 [${loot.item?.name || loot.itemId}] 재고가 소진되었습니다. 다른 공급 지역을 탐색합니다.`, 'normal');
}

export function summarizeFieldResources(resources) {
  const result = { sources: 0, initial: 0, remaining: 0, taken: 0, depleted: 0 };
  for (const rows of Object.values(resources?.byZone || {})) for (const row of Object.values(rows)) {
    result.sources++;
    result.initial += row.initial;
    result.remaining += row.remaining;
    result.taken += row.taken;
    if (row.initial > 0 && row.remaining === 0) result.depleted++;
  }
  return result;
}
