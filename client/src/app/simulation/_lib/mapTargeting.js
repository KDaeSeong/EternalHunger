import { hasKioskAtZone } from './marketRuntime';

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    const s = String(x || '');
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds) {
  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = [];
  for (const z of zonesArr) {
    const zid = String(z?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    if (hasKioskAtZone(kiosks, mapObj, zid)) out.push(zid);
  }
  return uniqStrings(out);
}

function findCrateZoneIdsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const hits = [];
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) hits.push(zid);
  }
  return uniqStrings(hits);
}

function findCrateZoneWeightsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return new Map();
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = new Map();
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    for (const e of lt) {
      if (String(e?.itemId || '') !== id) continue;
      const w = Math.max(0, Number(e?.weight ?? 1));
      out.set(zid, (out.get(zid) || 0) + w);
    }
  }
  return out;
}

export {
  findCrateZoneIdsForItem,
  findCrateZoneWeightsForItem,
  listKioskZoneIdsForMap,
  uniqStrings,
};
