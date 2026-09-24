import { LUMIA_DEFAULT_EDGES, LUMIA_HYPERLOOP_ZONE_IDS } from './simulationConstants';

const defaultHyperloopZones = new Set(LUMIA_HYPERLOOP_ZONE_IDS);

export function hasZoneHyperloop(zone) {
  // Explicit map settings win, including false. Missing flags retain the
  // legacy Lumia fallback; the current field takes precedence over its alias.
  if (typeof zone?.hasHyperloop === 'boolean') return zone.hasHyperloop;
  if (typeof zone?.hyperloop === 'boolean') return zone.hyperloop;
  return defaultHyperloopZones.has(String(zone?.zoneId || '').trim());
}

function toGraphObject(graph) {
  const out = {};
  Object.keys(graph || {}).forEach((key) => {
    out[key] = [...graph[key]];
  });
  return out;
}

function shouldUseDefaultLumiaEdges(zoneIds) {
  const ids = new Set((Array.isArray(zoneIds) ? zoneIds : []).map((z) => String(z || '')).filter(Boolean));
  if (!ids.size) return false;
  const defaultHits = [...ids].filter((zoneId) => (
    LUMIA_DEFAULT_EDGES.some(([a, b]) => zoneId === a || zoneId === b)
  )).length;
  return defaultHits >= Math.min(8, ids.size);
}

function mergeDefaultLumiaEdges(graph, zoneIds) {
  if (!shouldUseDefaultLumiaEdges(zoneIds)) return;
  for (const [a, b] of (Array.isArray(LUMIA_DEFAULT_EDGES) ? LUMIA_DEFAULT_EDGES : [])) {
    if (!a || !b) continue;
    if (!graph[a] || !graph[b]) continue;
    graph[a].add(b);
    graph[b].add(a);
  }
}

export function buildBaseZoneGraph(activeMap, zones) {
  const graph = {};
  const zoneIds = (Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || ''));
  const zoneSet = new Set(zoneIds.filter(Boolean));
  zoneIds.forEach((id) => {
    if (id) graph[id] = new Set();
  });

  const conns = Array.isArray(activeMap?.zoneConnections) ? activeMap.zoneConnections : [];
  conns.forEach((c) => {
    const a = String(c?.fromZoneId || '');
    const b = String(c?.toZoneId || '');
    if (!a || !b || a === b || !zoneSet.has(a) || !zoneSet.has(b)) return;
    graph[a].add(b);
    if (c?.bidirectional !== false) graph[b].add(a);
  });

  // An explicit user map is authoritative. Lumia compatibility edges are only
  // a fallback for legacy maps that supplied zones but no connection contract.
  if (!conns.length) mergeDefaultLumiaEdges(graph, zoneIds);

  const hasEdges = Object.values(graph).some((s) => (s?.size || 0) > 0);
  if (!hasEdges && zoneIds.length > 1) {
    if (!conns.length) mergeDefaultLumiaEdges(graph, zoneIds);

    const hasEdgesAfter = Object.values(graph).some((s) => (s?.size || 0) > 0);
    if (!hasEdgesAfter && !conns.length) {
      for (let i = 0; i < zoneIds.length; i += 1) {
        const a = zoneIds[i];
        const b = zoneIds[(i + 1) % zoneIds.length];
        if (a && b && a !== b) {
          graph[a].add(b);
          graph[b].add(a);
        }
      }
    }
  }

  return toGraphObject(graph);
}

export function getHyperloopZoneIds(activeMap, zones) {
  const zoneById = new Map((Array.isArray(zones) ? zones : [])
    .map((zone) => [String(zone?.zoneId || ''), zone]).filter(([id]) => id));
  const out = [];
  const seen = new Set();
  const add = (zoneId) => {
    const id = String(zoneId || '').trim();
    if (!id || seen.has(id) || !zoneById.has(id)) return;
    seen.add(id);
    out.push(id);
  };

  (Array.isArray(zones) ? zones : []).forEach((zone) => {
    if ((typeof zone?.hasHyperloop === 'boolean' || typeof zone?.hyperloop === 'boolean')
      && hasZoneHyperloop(zone)) add(zone?.zoneId);
  });
  // Preserve legacy iteration order without reviving explicitly disabled pads.
  LUMIA_HYPERLOOP_ZONE_IDS.forEach((id) => {
    if (hasZoneHyperloop(zoneById.get(id))) add(id);
  });
  add(activeMap?.hyperloopDeviceZoneId);
  return out;
}

export function buildHyperloopZoneGraph(baseZoneGraph, zones, hyperloopZoneIds) {
  const graph = {};
  const zoneIds = (Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || '')).filter(Boolean);
  Object.entries(baseZoneGraph || {}).forEach(([zoneId, neighbors]) => {
    graph[String(zoneId)] = new Set((Array.isArray(neighbors) ? neighbors : []).map((z) => String(z || '')).filter(Boolean));
  });

  const loops = (Array.isArray(hyperloopZoneIds) ? hyperloopZoneIds : []).map((z) => String(z || '')).filter(Boolean);
  if (loops.length) {
    for (const loopZoneId of loops) {
      if (!graph[loopZoneId]) graph[loopZoneId] = new Set();
      for (const destZoneId of zoneIds) {
        if (!destZoneId || destZoneId === loopZoneId) continue;
        graph[loopZoneId].add(destZoneId);
      }
    }
  }

  return toGraphObject(graph);
}

export function isHyperloopTransit(baseZoneGraph, hyperloopZoneIds, fromZoneId, toZoneId) {
  const from = String(fromZoneId || '').trim();
  const to = String(toZoneId || '').trim();
  if (!from || !to || from === to) return false;
  const hyperloopZoneSet = new Set((Array.isArray(hyperloopZoneIds) ? hyperloopZoneIds : []).map((z) => String(z || '')));
  if (!hyperloopZoneSet.has(from)) return false;
  const roadNeighbors = Array.isArray(baseZoneGraph?.[from]) ? baseZoneGraph[from].map((z) => String(z || '')) : [];
  return !roadNeighbors.includes(to);
}
