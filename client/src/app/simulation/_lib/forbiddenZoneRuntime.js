import { createSeedRng } from './randomSeedRuntime';
import { buildBaseZoneGraph } from './mapGraphRuntime';

function getEffectiveZones(mapObj, fallbackZones) {
  return Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : (Array.isArray(fallbackZones) ? fallbackZones : []);
}

function getZoneIds(zones) {
  return (Array.isArray(zones) ? zones : []).map((zone) => String(zone.zoneId));
}

function getZoneSignature(zoneIds) {
  return JSON.stringify(zoneIds);
}

function countSafeComponents(safe, graph) {
  const remaining = new Set(safe);
  let count = 0;
  while (remaining.size) {
    count += 1;
    const queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    for (let index = 0; index < queue.length; index += 1) {
      for (const id of graph[queue[index]] || []) {
        if (remaining.delete(id)) queue.push(id);
      }
    }
  }
  return count;
}

// Peel outer zones instead of cutting the remaining walking area into islands.
// Disconnected custom maps are not given invented roads; prefer a closure that
// does not split an existing component further.
function pickNextClosure(safe, priority, graph) {
  const candidates = priority.filter((id) => safe.has(id));
  const components = countSafeComponents(safe, graph);
  return candidates.find((id) => countSafeComponents(new Set([...safe].filter((other) => other !== id)), graph) <= components) || candidates[0];
}

function isForbiddenEnabled(settings) {
  return settings?.forbiddenZoneEnabled === false ? false : true;
}

function getForbiddenBaseSet(zones) {
  return new Set((Array.isArray(zones) ? zones : []).filter((zone) => zone?.isForbidden).map((zone) => String(zone.zoneId)));
}

export function getForbiddenOrderForMap(mapObj, fallbackZones, cache) {
  const zones = getEffectiveZones(mapObj, fallbackZones);
  const zoneIds = getZoneIds(zones);
  const zoneSig = getZoneSignature(zoneIds);
  const orderKey = `${String(mapObj?._id || 'no-map')}:forbidden:order:${zoneSig}:${zones.map((zone) => !!zone.isForbidden).join(',')}`;
  if (cache?.[orderKey]) return cache[orderKey];

  const base = getForbiddenBaseSet(zones);
  const candidates = zoneIds.filter((id) => id && !base.has(id));
  const rng = createSeedRng(`FORB_ORDER:${String(mapObj?._id || '')}`);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  if (cache) cache[orderKey] = candidates;
  return candidates;
}

export function getForbiddenZoneIdsForDay(mapObj, dayNum, fallbackZones, settings, cache) {
  const zones = getEffectiveZones(mapObj, fallbackZones);
  const zoneIds = getZoneIds(zones);
  const zoneSig = getZoneSignature(zoneIds);
  const key = `${String(mapObj?._id || 'no-map')}:${dayNum}:${zoneSig}`;
  if (cache?.[key]) return cache[key];

  const base = getForbiddenBaseSet(zones);
  const cfg = mapObj?.forbiddenZoneConfig || {};
  const startDay = Number(cfg.startDay ?? cfg.startPhase ?? settings?.forbiddenZoneStartDay ?? 3);
  const count = Math.max(1, Number(cfg.count ?? cfg.perDay ?? 2));

  if (isForbiddenEnabled(settings) && dayNum >= startDay && zoneIds.length > 0) {
    const order = getForbiddenOrderForMap(mapObj, fallbackZones, cache);
    const maxAdd = Math.max(0, zoneIds.length - 1 - base.size);
    const extraCount = Math.min(count, Math.min(maxAdd, order.length));
    order.slice(0, extraCount).forEach((id) => base.add(id));
  }

  const arr = [...base];
  if (cache) cache[key] = arr;
  return arr;
}

export function getForbiddenZoneIdsForPhase(mapObj, dayNum, phaseKey, fallbackZones, settings, cache) {
  const effDay = Math.max(0, Number(dayNum || 0));
  const effPhase = String(phaseKey || '') === 'night' ? 'night' : 'morning';
  const zones = getEffectiveZones(mapObj, fallbackZones);
  const zoneIds = getZoneIds(zones);
  const zoneSig = getZoneSignature(zoneIds);
  const key = JSON.stringify([mapObj?._id, effDay, effPhase, zoneSig, mapObj?.zoneConnections,
    zones.map((zone) => !!zone.isForbidden), mapObj?.forbiddenZoneConfig,
    settings?.forbiddenZoneEnabled, settings?.forbiddenZoneStartDay, settings?.forbiddenZoneStartPhase]);
  if (cache?.[key]) return cache[key];

  const base = getForbiddenBaseSet(zones);
  const cfg = mapObj?.forbiddenZoneConfig || {};
  const startDay = Number(cfg.startDay ?? settings?.forbiddenZoneStartDay ?? 2);
  const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings?.forbiddenZoneStartPhase ?? 'night');
  const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));
  const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
  const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);
  const labForceIdx = 4 * 2 + 1;

  const priority = getForbiddenOrderForMap(mapObj, fallbackZones, cache);
  const graph = buildBaseZoneGraph(mapObj, zones);
  const safe = new Set(zoneIds.filter((id) => !base.has(id)));
  const safeRemain = Math.max(1, Math.floor(Number(cfg.safeRemain ?? 2)));
  // Reconstruct cumulative closures, including the laboratory rule, so a later
  // phase cannot reopen a zone or count an already closed laboratory twice.
  for (let index = Math.min(startIdx, labForceIdx); index <= phaseIdx; index += 1) {
    if (index === labForceIdx && safe.delete('lab')) base.add('lab');
    if (!isForbiddenEnabled(settings) || index < startIdx) continue;
    for (let added = 0; added < addPerPhase && safe.size > safeRemain; added += 1) {
      const id = pickNextClosure(safe, priority, graph);
      if (!id) break;
      safe.delete(id);
      base.add(id);
    }
  }

  const arr = [...base];
  if (cache) cache[key] = arr;
  return arr;
}

export function getForbiddenAddedZoneIdsForPhase(mapObj, dayNum, phaseKey, fallbackZones, settings, cache) {
  const effDay = Math.max(0, Number(dayNum || 0));
  const effPhase = String(phaseKey || '') === 'night' ? 'night' : 'morning';
  const current = getForbiddenZoneIdsForPhase(mapObj, effDay, effPhase, fallbackZones, settings, cache);
  const previous = new Set(getForbiddenZoneIdsForPhase(mapObj,
    effPhase === 'night' ? effDay : effDay - 1,
    effPhase === 'night' ? 'morning' : 'night', fallbackZones, settings, cache));
  return current.filter((id) => !previous.has(id));
}
