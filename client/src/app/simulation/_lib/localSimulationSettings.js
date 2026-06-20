export function isEnabledScenarioEvent(ev) {
  return ev?.enabled !== false;
}

export function getScenarioEventTimeOfDay(ev) {
  const raw = String(ev?.timeOfDay || ev?.time || 'both').toLowerCase();
  if (raw === 'day' || raw === 'night' || raw === 'both') return raw;
  if (raw === 'any') return 'both';
  return 'both';
}

export function localKeyHyperloops(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_map_hyperloops_${id}` : '';
}

export function localKeyHyperloopDeviceZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_hyperloop_zone_${id}` : '';
}

export function localKeyMutantWildlifeZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_mutant_spawn_zone_${id}` : '';
}

export function readLocalJsonArray(key) {
  const k = String(key || '').trim();
  if (!k) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(k);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function readLocalString(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(k) || '');
  } catch {
    return '';
  }
}

export function getMutantWildlifeSpawnZoneId(mapId) {
  const k = localKeyMutantWildlifeZone(mapId);
  return readLocalString(k);
}

export function getHyperloopDeviceZoneId(mapId) {
  const k = localKeyHyperloopDeviceZone(mapId);
  return readLocalString(k);
}
