import { createSeedRng } from './randomSeedRuntime';

function getEffectiveZones(mapObj, fallbackZones) {
  return Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : (Array.isArray(fallbackZones) ? fallbackZones : []);
}

function getZoneIds(zones) {
  return (Array.isArray(zones) ? zones : []).map((zone) => String(zone.zoneId));
}

function getZoneSignature(zoneIds) {
  return zoneIds.length ? `${zoneIds.length}:${zoneIds[0]}:${zoneIds[zoneIds.length - 1]}` : '0';
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
  const orderKey = `${String(mapObj?._id || 'no-map')}:forbidden:order:${zoneSig}`;
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
  const key = `${String(mapObj?._id || 'no-map')}:${String(effDay)}:${String(effPhase)}:${zoneSig}`;
  if (cache?.[key]) return cache[key];

  const base = getForbiddenBaseSet(zones);
  const cfg = mapObj?.forbiddenZoneConfig || {};
  const startDay = Number(cfg.startDay ?? settings?.forbiddenZoneStartDay ?? 2);
  const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings?.forbiddenZoneStartPhase ?? 'night');
  const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));
  const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
  const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);
  const labForceIdx = 4 * 2 + 1;

  if (zoneIds.includes('lab') && phaseIdx >= labForceIdx) base.add('lab');

  if (isForbiddenEnabled(settings) && phaseIdx >= startIdx && zoneIds.length > 0) {
    const steps = phaseIdx - startIdx + 1;
    const order = getForbiddenOrderForMap(mapObj, fallbackZones, cache);
    const safeRemain = Math.max(1, Math.floor(Number(cfg.safeRemain ?? 2)));
    const maxAdd = Math.max(0, zoneIds.length - safeRemain - base.size);
    const extraCount = Math.min(steps * addPerPhase, Math.min(maxAdd, order.length));
    order.slice(0, extraCount).forEach((id) => base.add(id));
  }

  const arr = [...base];
  if (cache) cache[key] = arr;
  return arr;
}

export function getForbiddenAddedZoneIdsForPhase(mapObj, dayNum, phaseKey, fallbackZones, settings, cache) {
  const effDay = Math.max(0, Number(dayNum || 0));
  const effPhase = String(phaseKey || '') === 'night' ? 'night' : 'morning';
  const zones = getEffectiveZones(mapObj, fallbackZones);
  const zoneIds = getZoneIds(zones);
  if (!zoneIds.length || !isForbiddenEnabled(settings)) return [];

  const cfg = mapObj?.forbiddenZoneConfig || {};
  const startDay = Number(cfg.startDay ?? settings?.forbiddenZoneStartDay ?? 2);
  const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings?.forbiddenZoneStartPhase ?? 'night');
  const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));
  const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
  const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);
  if (phaseIdx < startIdx) return [];

  const labForceIdx = 4 * 2 + 1;
  const baseSet = getForbiddenBaseSet(zones);
  if (zoneIds.includes('lab') && phaseIdx >= labForceIdx) baseSet.add('lab');
  const safeRemain = Math.max(1, Math.floor(Number(cfg.safeRemain ?? 2)));
  const maxAdd = Math.max(0, zoneIds.length - safeRemain - baseSet.size);
  const order = getForbiddenOrderForMap(mapObj, fallbackZones, cache);
  const steps = phaseIdx - startIdx + 1;
  const cap = Math.min(maxAdd, order.length);
  const extraCur = Math.min(steps * addPerPhase, cap);
  const extraPrev = Math.min(Math.max(0, (steps - 1) * addPerPhase), cap);
  let added = order.slice(extraPrev, extraCur).filter(Boolean);

  if (zoneIds.includes('lab') && phaseIdx === labForceIdx) {
    added = ['lab', ...added.filter((id) => String(id) !== 'lab')];
  }
  return added;
}
