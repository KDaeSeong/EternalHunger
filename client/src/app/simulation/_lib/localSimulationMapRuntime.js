const LOCAL_MAP_STORE_KEY = 'eh_simulation_local_maps_v1';
const LOCAL_RULE_STORE_KEY = 'eh_simulation_local_rules_v1';
const LOCAL_RULESET_SELECTION_KEY = 'eh_simulation_local_ruleset_id_v1';

export const LOCAL_MAP_STORE_VERSION = 1;
export const LOCAL_MAP_LIMIT = 8;
export const LOCAL_MAP_MAX_BYTES = 256 * 1024;
export const LOCAL_MAP_STORE_MAX_BYTES = 1024 * 1024;
export const LOCAL_RULE_MAX_BYTES = 128 * 1024;
export const LOCAL_RULE_STORE_MAX_BYTES = 512 * 1024;

const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ALLOWED_MAP_FIELDS = [
  'coreSpawnZones', 'forbiddenZoneConfig', 'campfireZoneIds', 'waterSourceZoneIds',
  'hyperloopDeviceZoneId', 'mutantWildlifeSpawnZoneId', 'itemCrates', 'crateAllowDeny',
];

function getStorage(storage) {
  if (storage !== undefined) return storage;
  if (typeof globalThis === 'undefined') return null;
  try { return globalThis.localStorage || null; } catch { return null; }
}

function parseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function safeJsonValue(value, depth = 0) {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 256 && value.every((item) => safeJsonValue(item, depth + 1));
  if (!isPlainObject(value)) return false;
  return Object.keys(value).length <= 256
    && Object.entries(value).every(([key, item]) => !RESERVED_KEYS.has(key) && safeJsonValue(item, depth + 1));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function finitePoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  if (isPlainObject(value)) {
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  return null;
}

function normalizeZone(raw, index) {
  if (!isPlainObject(raw)) return { error: `구역 ${index + 1}은 객체여야 합니다.` };
  const zoneId = String(raw.zoneId || raw.id || '').trim();
  const name = String(raw.name || zoneId).trim();
  if (!zoneId || zoneId.length > 80 || RESERVED_KEYS.has(zoneId)) return { error: `구역 ${index + 1}의 ID가 올바르지 않습니다.` };
  if (!name || name.length > 120) return { error: `${zoneId}의 이름이 올바르지 않습니다.` };

  let polygon;
  if (raw.polygon !== undefined) {
    if (!Array.isArray(raw.polygon) || raw.polygon.length < 3 || raw.polygon.length > 64) {
      return { error: `${zoneId}의 polygon은 3~64개의 점이어야 합니다.` };
    }
    polygon = raw.polygon.map(finitePoint);
    if (polygon.some((point) => !point)) return { error: `${zoneId}의 polygon 좌표가 올바르지 않습니다.` };
  }
  let center;
  if (raw.center !== undefined) {
    center = finitePoint(raw.center);
    if (!center) return { error: `${zoneId}의 center 좌표가 올바르지 않습니다.` };
  }

  const zone = {
    zoneId,
    name,
    isForbidden: raw.isForbidden === true,
    hasKiosk: raw.hasKiosk === true,
    hasHyperloop: raw.hasHyperloop === true,
  };
  if (polygon) zone.polygon = polygon;
  if (center) zone.center = center;
  return { zone };
}

function normalizeConnection(raw, index, zoneIds) {
  const tuple = Array.isArray(raw) ? raw : null;
  const fromZoneId = String(tuple ? tuple[0] : raw?.fromZoneId || raw?.from || '').trim();
  const toZoneId = String(tuple ? tuple[1] : raw?.toZoneId || raw?.to || '').trim();
  if (!fromZoneId || !toZoneId || !zoneIds.has(fromZoneId) || !zoneIds.has(toZoneId) || fromZoneId === toZoneId) {
    return { error: `동선 ${index + 1}이 존재하지 않는 구역을 참조합니다.` };
  }
  return {
    connection: {
      fromZoneId,
      toZoneId,
      bidirectional: tuple ? tuple[3] !== false : raw?.bidirectional !== false,
      connectionType: String(tuple ? tuple[2] || 'road' : raw?.connectionType || 'road').slice(0, 32),
    },
  };
}

function isWeaklyConnected(zoneIds, connections) {
  if (!zoneIds.length) return false;
  const adjacency = new Map(zoneIds.map((id) => [id, new Set()]));
  for (const connection of connections) {
    adjacency.get(connection.fromZoneId)?.add(connection.toZoneId);
    adjacency.get(connection.toZoneId)?.add(connection.fromZoneId);
  }
  const visited = new Set([zoneIds[0]]);
  const queue = [zoneIds[0]];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === zoneIds.length;
}

let localMapIdSequence = 0;

function makeLocalMapId() {
  try {
    if (globalThis.crypto?.randomUUID) return `local-map-${globalThis.crypto.randomUUID()}`;
  } catch { /* Use the process-local fallback below. */ }
  localMapIdSequence += 1;
  return `local-map-${Date.now().toString(36)}-${localMapIdSequence.toString(36)}`;
}

export function normalizeLocalSimulationMap(input, { allowMissingId = true, preserveUpdatedAt = false } = {}) {
  if (!isPlainObject(input)) return { ok: false, errors: ['지도는 JSON 객체여야 합니다.'] };
  const rawId = String(input._id || input.id || '').trim();
  const id = rawId.startsWith('local-map-') ? rawId : (allowMissingId ? makeLocalMapId() : '');
  if (!id || id.length > 120) return { ok: false, errors: ['로컬 지도 ID가 올바르지 않습니다.'] };
  const name = String(input.name || '').trim();
  if (!name || name.length > 120) return { ok: false, errors: ['지도 이름은 1~120자여야 합니다.'] };
  if (!Array.isArray(input.zones) || input.zones.length < 2 || input.zones.length > 64) {
    return { ok: false, errors: ['구역은 2~64개여야 합니다.'] };
  }

  const zones = [];
  const zoneIds = new Set();
  for (let index = 0; index < input.zones.length; index += 1) {
    const result = normalizeZone(input.zones[index], index);
    if (!result.zone) return { ok: false, errors: [result.error] };
    if (zoneIds.has(result.zone.zoneId)) return { ok: false, errors: [`구역 ID가 중복됩니다: ${result.zone.zoneId}`] };
    zoneIds.add(result.zone.zoneId);
    zones.push(result.zone);
  }

  const sourceConnections = input.zoneConnections ?? input.connections;
  let zoneConnections = [];
  if (sourceConnections !== undefined) {
    if (!Array.isArray(sourceConnections) || sourceConnections.length > 256) {
      return { ok: false, errors: ['동선은 256개 이하의 배열이어야 합니다.'] };
    }
    for (let index = 0; index < sourceConnections.length; index += 1) {
      const result = normalizeConnection(sourceConnections[index], index, zoneIds);
      if (!result.connection) return { ok: false, errors: [result.error] };
      zoneConnections.push(result.connection);
    }
  }
  if (!zoneConnections.length) {
    for (let index = 0; index < zones.length; index += 1) {
      const next = zones[(index + 1) % zones.length];
      zoneConnections.push({ fromZoneId: zones[index].zoneId, toZoneId: next.zoneId, bidirectional: true, connectionType: 'road' });
    }
  }
  if (!isWeaklyConnected([...zoneIds], zoneConnections)) {
    return { ok: false, errors: ['모든 구역이 하나의 연결된 동선망에 포함되어야 합니다.'] };
  }

  const map = {
    _id: id,
    id,
    name,
    description: String(input.description || '').slice(0, 500),
    zones,
    zoneConnections,
    localUser: true,
    guestDefault: false,
    updatedAt: preserveUpdatedAt && Number.isFinite(Number(input.updatedAt))
      ? Math.max(0, Math.floor(Number(input.updatedAt)))
      : Date.now(),
  };
  for (const key of ALLOWED_MAP_FIELDS) {
    if (input[key] === undefined) continue;
    if (!safeJsonValue(input[key])) return { ok: false, errors: [`${key}에 지원하지 않는 값이 있습니다.`] };
    map[key] = cloneJson(input[key]);
  }

  let size;
  try { size = JSON.stringify(map).length * 2; } catch { return { ok: false, errors: ['지도를 JSON으로 저장할 수 없습니다.'] }; }
  if (size > LOCAL_MAP_MAX_BYTES) return { ok: false, errors: [`지도 크기가 ${LOCAL_MAP_MAX_BYTES / 1024}KB를 초과합니다.`] };
  return { ok: true, map, errors: [] };
}

function readStore(storage) {
  const local = getStorage(storage);
  if (!local) return { maps: [], selectedMapId: '', recoverable: false };
  let raw = '';
  let parsed;
  try { raw = local.getItem(LOCAL_MAP_STORE_KEY) || ''; parsed = parseJson(raw); } catch { parsed = null; }
  if (!isPlainObject(parsed) || parsed.version !== LOCAL_MAP_STORE_VERSION || !Array.isArray(parsed.maps)) {
    return { maps: [], selectedMapId: '', recoverable: Boolean(raw) };
  }
  const maps = [];
  const seen = new Set();
  for (const storedMap of parsed.maps.slice(0, LOCAL_MAP_LIMIT)) {
    const result = normalizeLocalSimulationMap(storedMap, { allowMissingId: false, preserveUpdatedAt: true });
    const id = String(storedMap?._id || storedMap?.id || '');
    if (!result.ok || !id.startsWith('local-map-') || seen.has(id)) continue;
    seen.add(id);
    maps.push(result.map);
  }
  return { maps, selectedMapId: String(parsed.selectedMapId || ''), recoverable: maps.length !== parsed.maps.length };
}

function writeStore(store, storage) {
  const local = getStorage(storage);
  if (!local) return { ok: false, error: '이 브라우저에서 로컬 저장소를 사용할 수 없습니다.' };
  const payload = { version: LOCAL_MAP_STORE_VERSION, selectedMapId: String(store.selectedMapId || ''), maps: store.maps.slice(0, LOCAL_MAP_LIMIT) };
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length * 2 > LOCAL_MAP_STORE_MAX_BYTES) return { ok: false, error: '로컬 지도 저장소가 허용 크기를 초과했습니다.' };
    local.setItem(LOCAL_MAP_STORE_KEY, serialized);
    return { ok: true };
  } catch {
    return { ok: false, error: '로컬 저장 공간이 부족하거나 차단되어 지도를 저장하지 못했습니다.' };
  }
}

function orderedMaps(fallbackMap, store) {
  const fallback = fallbackMap ? cloneJson(fallbackMap) : null;
  const localMaps = [...store.maps];
  const selected = localMaps.find((map) => map._id === store.selectedMapId);
  const rest = localMaps.filter((map) => map._id !== store.selectedMapId);
  return selected ? [selected, ...(fallback ? [fallback] : []), ...rest] : [...(fallback ? [fallback] : []), ...localMaps];
}

export function loadLocalSimulationMaps(fallbackMap, storage) {
  const store = readStore(storage);
  const selectedExists = !store.selectedMapId || store.maps.some((map) => map._id === store.selectedMapId);
  if (!selectedExists || store.recoverable) {
    writeStore({ maps: store.maps, selectedMapId: selectedExists ? store.selectedMapId : '' }, storage);
  }
  return orderedMaps(fallbackMap, store);
}

export function saveLocalSimulationMap(input, storage) {
  const result = normalizeLocalSimulationMap(input);
  if (!result.ok) return result;
  const store = readStore(storage);
  const exists = store.maps.some((map) => map._id === result.map._id);
  if (!exists && store.maps.length >= LOCAL_MAP_LIMIT) {
    return { ok: false, errors: [`로컬 지도는 최대 ${LOCAL_MAP_LIMIT}개까지 저장할 수 있습니다.`] };
  }
  const maps = exists
    ? store.maps.map((map) => map._id === result.map._id ? result.map : map)
    : [...store.maps, result.map];
  const written = writeStore({ maps, selectedMapId: result.map._id }, storage);
  return written.ok ? { ok: true, map: result.map, maps, errors: [] } : { ok: false, errors: [written.error] };
}

export function deleteLocalSimulationMap(mapId, storage) {
  const id = String(mapId || '').trim();
  const store = readStore(storage);
  if (!id.startsWith('local-map-')) return { ok: false, errors: ['내장 지도는 삭제할 수 없습니다.'] };
  if (!store.maps.some((map) => map._id === id)) return { ok: false, errors: ['삭제할 로컬 지도를 찾을 수 없습니다.'] };
  const maps = store.maps.filter((map) => map._id !== id);
  const selectedMapId = store.selectedMapId === id ? '' : store.selectedMapId;
  const written = writeStore({ maps, selectedMapId }, storage);
  return written.ok ? { ok: true, maps, errors: [] } : { ok: false, errors: [written.error] };
}

export function selectLocalSimulationMap(mapId, fallbackMap, storage) {
  const id = String(mapId || '').trim();
  const store = readStore(storage);
  if (id && id !== String(fallbackMap?._id || '') && !store.maps.some((map) => map._id === id)) {
    return { ok: false, errors: ['선택한 로컬 지도를 찾을 수 없습니다.'] };
  }
  const written = writeStore({ maps: store.maps, selectedMapId: id === String(fallbackMap?._id || '') ? '' : id }, storage);
  return written.ok ? { ok: true, maps: orderedMaps(fallbackMap, { ...store, selectedMapId: id }), selectedMapId: id, errors: [] }
    : { ok: false, errors: [written.error] };
}

export function readLocalRulesetSelection(storage) {
  const local = getStorage(storage);
  if (!local) return '';
  try {
    const id = String(local.getItem(LOCAL_RULESET_SELECTION_KEY) || '').trim();
    return id.length <= 40 ? id : '';
  } catch { return ''; }
}

export function saveLocalRulesetSelection(rulesetId, storage) {
  const id = String(rulesetId || '').trim();
  const local = getStorage(storage);
  if (!local || !id || id.length > 40) return { ok: false, error: '규칙 선택을 저장할 수 없습니다.' };
  try { local.setItem(LOCAL_RULESET_SELECTION_KEY, id); return { ok: true, id }; } catch { return { ok: false, error: '규칙 선택을 저장하지 못했습니다.' }; }
}

function readRuleStore(storage) {
  const local = getStorage(storage);
  if (!local) return { rulesets: {}, recoverable: false };
  let raw = '';
  let parsed;
  try { raw = local.getItem(LOCAL_RULE_STORE_KEY) || ''; parsed = parseJson(raw); } catch { parsed = null; }
  if (!isPlainObject(parsed) || parsed.version !== LOCAL_MAP_STORE_VERSION || !isPlainObject(parsed.rulesets)) {
    return { rulesets: {}, recoverable: Boolean(raw) };
  }
  const rulesets = {};
  for (const [id, patch] of Object.entries(parsed.rulesets)) {
    if (!id || id.length > 40 || !safeJsonValue(patch) || !isPlainObject(patch)) continue;
    rulesets[id] = cloneJson(patch);
  }
  return { rulesets, recoverable: Object.keys(rulesets).length !== Object.keys(parsed.rulesets).length };
}

function writeRuleStore(rulesets, storage) {
  const local = getStorage(storage);
  if (!local) return { ok: false, error: '이 브라우저에서 로컬 저장소를 사용할 수 없습니다.' };
  try {
    const serialized = JSON.stringify({ version: LOCAL_MAP_STORE_VERSION, rulesets });
    if (serialized.length * 2 > LOCAL_RULE_STORE_MAX_BYTES) return { ok: false, error: '로컬 규칙 저장소가 허용 크기를 초과했습니다.' };
    local.setItem(LOCAL_RULE_STORE_KEY, serialized);
    return { ok: true };
  } catch { return { ok: false, error: '로컬 저장 공간이 부족하거나 차단되어 규칙을 저장하지 못했습니다.' }; }
}

export function readLocalRulesetOverride(rulesetId, storage) {
  const id = String(rulesetId || '').trim();
  const store = readRuleStore(storage);
  if (store.recoverable) writeRuleStore(store.rulesets, storage);
  const patch = store.rulesets[id];
  return patch ? cloneJson(patch) : null;
}

export function saveLocalRulesetOverride(rulesetId, patch, storage) {
  const id = String(rulesetId || '').trim();
  if (!id || id.length > 40 || !isPlainObject(patch) || !safeJsonValue(patch)) {
    return { ok: false, error: '규칙은 안전한 JSON 객체여야 합니다.' };
  }
  let size;
  try { size = JSON.stringify(patch).length * 2; } catch { return { ok: false, error: '규칙을 JSON으로 저장할 수 없습니다.' }; }
  if (size > LOCAL_RULE_MAX_BYTES) return { ok: false, error: `규칙 크기가 ${LOCAL_RULE_MAX_BYTES / 1024}KB를 초과합니다.` };
  const store = readRuleStore(storage);
  const rulesets = { ...store.rulesets, [id]: cloneJson(patch) };
  const written = writeRuleStore(rulesets, storage);
  return written.ok ? { ok: true, patch: cloneJson(patch) } : { ok: false, error: written.error };
}

export function clearLocalRulesetOverride(rulesetId, storage) {
  const id = String(rulesetId || '').trim();
  const store = readRuleStore(storage);
  const rulesets = { ...store.rulesets };
  delete rulesets[id];
  const written = writeRuleStore(rulesets, storage);
  return written.ok ? { ok: true } : { ok: false, error: written.error || '로컬 규칙을 초기화하지 못했습니다.' };
}

export function getLocalSimulationStorageKeys() {
  return { map: LOCAL_MAP_STORE_KEY, rules: LOCAL_RULE_STORE_KEY, rulesetSelection: LOCAL_RULESET_SELECTION_KEY };
}
