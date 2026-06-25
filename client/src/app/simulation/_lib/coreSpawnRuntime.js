import { zoneNameHasKiosk } from './marketRuntime';
import { findItemByKeywords, pickWeighted } from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';

const LEGACY_CORE_ZONE_IDS = ['sandy_beach', 'forest', 'stream', 'cemetery', 'factory', 'port'];
const LEGACY_CORE_ZONE_NAME_KEYS = ['모래사장', '숲', '개울', '연못', '공장', '항구'];

function zoneHasKioskFlag(zone) {
  if (!zone) return false;
  if (typeof zone?.hasKiosk === 'boolean') return !!zone.hasKiosk;
  return zoneNameHasKiosk(zone?.name || '') || zoneNameHasKiosk(zone?.zoneId || '');
}

function getEligibleSpawnZoneIds(zones, forbiddenIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && !zoneHasKioskFlag(z))
    .map(({ zid }) => zid);
}

function zoneAllowsNaturalCore(zone, allowSet) {
  if (!zone) return false;
  if (zoneHasKioskFlag(zone)) return false;

  const zid = String(zone?.zoneId || '');

  if (allowSet instanceof Set && allowSet.size) {
    return zid && allowSet.has(zid);
  }

  if (typeof zone?.coreSpawn === 'boolean') return !!zone.coreSpawn;

  const nm = String(zone?.name || '');
  return LEGACY_CORE_ZONE_IDS.includes(zid) || LEGACY_CORE_ZONE_NAME_KEYS.includes(nm);
}

function getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const allowSet = Array.isArray(coreSpawnZoneIds) && coreSpawnZoneIds.length ? new Set(coreSpawnZoneIds.map(String)) : null;

  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && zoneAllowsNaturalCore(z, allowSet))
    .map(({ zid }) => zid);
}

function rollNaturalCoreSpawn(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  const ruleset = opts?.ruleset || null;
  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};
  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  if (!isAtOrAfterWorldTime(curDay, curPhase, coreGateDay, 'day')) return null;

  const moved = !!opts.moved;

  const zones = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const z = zones.find((x) => String(x?.zoneId) === String(zoneId)) || null;
  const zoneName = String(z?.name || '');
  const zoneHasKiosk = Boolean(opts?.isKioskZone || z?.hasKiosk);

  if (zoneHasKiosk) return null;

  const mapAllow = Array.isArray(mapObj?.coreSpawnZones) ? mapObj.coreSpawnZones.map(String) : null;

  let allowed = false;
  if (mapAllow && mapAllow.length) {
    allowed = mapAllow.includes(String(zoneId));
  } else if (z && typeof z?.coreSpawn === 'boolean') {
    allowed = !!z.coreSpawn;
  } else {
    allowed = LEGACY_CORE_ZONE_IDS.includes(String(zoneId)) || LEGACY_CORE_ZONE_NAME_KEYS.includes(zoneName);
  }

  if (!allowed) return null;

  const chance = moved ? 0.08 : 0.03;
  if (Math.random() >= chance) return null;

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const candidates = [];
  if (meteor?._id) candidates.push({ key: 'meteor', item: meteor, weight: 1 });
  if (tree?._id) candidates.push({ key: 'life_tree', item: tree, weight: 1 });
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  if (!picked?.item?._id) return null;

  return { item: picked.item, itemId: String(picked.item._id), qty: 1, kind: String(picked.key) };
}

export {
  LEGACY_CORE_ZONE_IDS,
  LEGACY_CORE_ZONE_NAME_KEYS,
  getEligibleCoreSpawnZoneIds,
  getEligibleSpawnZoneIds,
  rollNaturalCoreSpawn,
  zoneAllowsNaturalCore,
  zoneHasKioskFlag,
};
