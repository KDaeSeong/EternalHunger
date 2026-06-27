import { compactIO, safeTags } from './simulationCommon';
import { classifySpecialByName } from './craftRuntime';
import { findCrateZoneWeightsForItem } from './mapTargeting';
import { getRegionData, getRegionFacilityZoneIds, getRegionZoneWeightsForItem } from './lumiaRegionData';
import { canonicalCoreZoneId } from './coreSpawnRuntime';
import { LIFE_TREE_PHASE_ZONES, METEOR_EXCLUDED_ZONE_IDS } from './specialResourceRuntime';

function buildRuntimeSpawnMeta({ itemId, meta, itemName, mapObj, spawnState, forbiddenIds }) {
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();
  function add(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };
  const nm = String(itemName || meta?.name || '');
  const tags = safeTags(meta).map((t) => String(t).toLowerCase());
  const spec = String(classifySpecialByName(nm) || '');
  const hintZones = Array.isArray(meta?.spawnZones) ? meta.spawnZones : [];
  const crateHints = new Set((Array.isArray(meta?.spawnCrateTypes) ? meta.spawnCrateTypes : []).map((x) => String(x || '').toLowerCase()).filter(Boolean));
  for (const raw of hintZones) {
    const t = String(raw || '').trim();
    if (!t || !Array.isArray(mapObj?.zones)) continue;
    if (/^Z\d+$/i.test(t)) { add(t.toUpperCase(), 2.4); continue; }
    mapObj.zones.filter((z) => z && z.zoneId && String(z.name || '').includes(t)).forEach((z) => add(String(z.zoneId), 1.8));
  }
  if (crateHints.size && Array.isArray(mapObj?.itemCrates)) {
    for (const c of mapObj.itemCrates) {
      const zid = String(c?.zoneId || '');
      const ct = String(c?.crateType || 'food').toLowerCase();
      if (zid && crateHints.has(ct) && !forb.has(zid)) add(zid, 1.6);
    }
  }
  for (const [z, w] of findCrateZoneWeightsForItem(mapObj, itemId, forb).entries()) add(z, 1.4 + Math.min(4, w / 4));
  for (const [z, w] of getRegionZoneWeightsForItem({ _id: itemId, name: nm, text: nm }, mapObj?.zones, forb).entries()) add(z, 1.1 + Math.min(5, w / 3));
  if (nm.includes('물') || tags.includes('water')) {
    if (Array.isArray(mapObj?.waterSourceZoneIds)) mapObj.waterSourceZoneIds.forEach((z) => add(z, 2.2));
    (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .filter((z) => Number(getRegionData(z?.zoneId)?.resources?.['물'] || 0) > 0)
      .forEach((z) => add(z?.zoneId, 2.0));
  }
  if (nm.includes('스테이크') || tags.includes('cooked')) {
    if (Array.isArray(mapObj?.campfireZoneIds)) mapObj.campfireZoneIds.forEach((z) => add(z, 1.4));
    getRegionFacilityZoneIds('campfire', mapObj?.zones).forEach((z) => add(z, 1.3));
  }
  if (spec === 'meteor') {
    (Array.isArray(spawnState?.coreNodes) ? spawnState.coreNodes : [])
      .filter((n) => !n?.picked && String(n?.kind || '') === 'meteor')
      .forEach((n) => add(n?.zoneId, 3.2));
    (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((z) => canonicalCoreZoneId(z?.zoneId))
      .filter((zid) => zid && !METEOR_EXCLUDED_ZONE_IDS.has(zid))
      .forEach((zid) => add(zid, 0.8));
  }
  if (spec === 'life_tree') {
    (Array.isArray(spawnState?.coreNodes) ? spawnState.coreNodes : [])
      .filter((n) => !n?.picked && String(n?.kind || '') === 'life_tree')
      .forEach((n) => add(n?.zoneId, 3.2));
    Object.values(LIFE_TREE_PHASE_ZONES)
      .flat()
      .map(canonicalCoreZoneId)
      .forEach((zid) => add(zid, 1.1));
  }
  if (spec === 'mithril' && spawnState?.bosses?.alpha?.alive && spawnState.bosses.alpha.zoneId) add(spawnState.bosses.alpha.zoneId, 2.6);
  if (spec === 'force_core' && spawnState?.bosses?.omega?.alive && spawnState.bosses.omega.zoneId) add(spawnState.bosses.omega.zoneId, 2.6);
  if (spec === 'vf' && spawnState?.bosses?.weakline?.alive && spawnState.bosses.weakline.zoneId) add(spawnState.bosses.weakline.zoneId, 3.0);
  if ((nm.includes('고기') || tags.includes('meat') || tags.includes('food')) && spawnState?.wildlife) {
    Object.entries(spawnState.wildlife)
      .map(([z, c]) => ({ z: String(z), c: Math.max(0, Number(c || 0)) }))
      .filter((x) => x.z && !forb.has(x.z))
      .sort((a, b) => (b.c - a.c) || a.z.localeCompare(b.z))
      .slice(0, 4)
      .forEach((e) => add(e.z, 1));
  }
  return {
    itemId: String(itemId || ''),
    crateTypes: [...crateHints],
    zoneWeights: [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])),
  };
}

function expandMissingResourceChain(missingList, itemMetaById, itemNameById, maxDepth = 2) {
  const seeds = Array.isArray(missingList) ? missingList : [];
  const seen = new Map();
  const out = [];
  const q = seeds
    .map((m) => ({
      itemId: String(m?.itemId || ''),
      name: String(m?.name || ''),
      depth: 0,
      chainWeight: 1,
      special: String(m?.special || ''),
    }))
    .filter((x) => x.itemId);
  while (q.length) {
    const cur = q.shift();
    const prev = Number(seen.get(cur.itemId) ?? -1);
    if (prev >= cur.chainWeight) continue;
    seen.set(cur.itemId, cur.chainWeight);
    out.push(cur);
    if (cur.depth >= maxDepth) continue;
    const meta = itemMetaById?.[cur.itemId] || null;
    const ings = compactIO(meta?.recipe?.ingredients || []);
    if (!ings.length) continue;
    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      if (!id) continue;
      q.push({
        itemId: id,
        name: String(itemNameById?.[id] || itemMetaById?.[id]?.name || ''),
        depth: cur.depth + 1,
        chainWeight: cur.chainWeight * (cur.depth <= 0 ? 0.72 : 0.5),
        special: String(classifySpecialByName(itemNameById?.[id] || itemMetaById?.[id]?.name || '') || ''),
      });
    }
  }
  return out.sort((a, b) => (a.depth - b.depth) || (b.chainWeight - a.chainWeight) || a.itemId.localeCompare(b.itemId));
}

function pickGoalResourceZoneTargets(mapObj, spawnState, forbiddenIds, missingList, itemMetaById, itemNameById) {
  const miss = expandMissingResourceChain(missingList, itemMetaById, itemNameById, 2);
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();

  function addScore(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };

  for (const m of miss) {
    const id = String(m?.itemId || '');
    if (!id) continue;
    const meta = itemMetaById?.[id] || null;
    const runtimeSpawnMeta = buildRuntimeSpawnMeta({
      itemId: id,
      meta,
      itemName: itemNameById?.[id] || meta?.name || m?.name || '',
      mapObj,
      spawnState,
      forbiddenIds: forb,
    });
    const mul = Math.max(0.2, Number(m?.chainWeight || 1));
    for (const [z, w] of runtimeSpawnMeta.zoneWeights) addScore(z, w * mul);
  }

  const ranked = [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return ranked.slice(0, 6).map(([z]) => z);
}

export {
  buildRuntimeSpawnMeta,
  expandMissingResourceChain,
  pickGoalResourceZoneTargets,
};
