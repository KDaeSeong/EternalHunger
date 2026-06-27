const LEGACY_SCENARIO_EVENT_PATTERNS = [
  /숨을 고르/i,
  /주변을 조심스럽게/i,
  /발자국 소리/i,
  /주변을 뒤져/i,
  /먹을 것을 발견/i,
  /발밑을 잘못/i,
  /누군가와 마주쳐/i,
  /짧게 충돌/i,
  /서둘러/i,
];

export function isLegacyScenarioEventText(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  return LEGACY_SCENARIO_EVENT_PATTERNS.some((pattern) => pattern.test(value));
}

export function isEnabledScenarioEvent(ev) {
  return ev?.enabled !== false && !isLegacyScenarioEventText(ev?.text);
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
