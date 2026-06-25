// Default Lumia Island adjacency graph.
// Road edges come from the user's supplied "길로 연결된 곳" table.
// The park-cemetery jump paddle is kept as a separate connectionType.

const DEFAULT_ROAD_EDGES = [
  ['alley', 'gas_station'],
  ['alley', 'police'],
  ['alley', 'temple'],

  ['gas_station', 'archery'],
  ['gas_station', 'school'],
  ['gas_station', 'firestation'],

  ['archery', 'school'],
  ['archery', 'hotel'],

  ['school', 'firestation'],
  ['school', 'hotel'],
  ['school', 'forest'],
  ['school', 'lab'],

  ['police', 'temple'],
  ['police', 'firestation'],
  ['police', 'stream'],

  ['firestation', 'park'],
  ['firestation', 'lab'],

  ['temple', 'stream'],

  ['stream', 'park'],
  ['stream', 'hospital'],

  ['park', 'hospital'],

  ['hospital', 'cemetery'],
  ['hospital', 'factory'],

  ['hotel', 'beach'],
  ['hotel', 'forest'],

  ['beach', 'forest'],
  ['beach', 'apartment'],

  ['forest', 'sandy_beach'],
  ['forest', 'apartment'],
  ['forest', 'cathedral'],
  ['forest', 'lab'],

  ['apartment', 'sandy_beach'],
  ['apartment', 'warehouse'],
  ['apartment', 'cathedral'],

  ['cemetery', 'cathedral'],
  ['cemetery', 'factory'],
  ['cemetery', 'lab'],

  ['cathedral', 'warehouse'],
  ['cathedral', 'factory'],
  ['cathedral', 'port'],

  ['warehouse', 'port'],

  ['port', 'barge'],
  ['port', 'factory'],

  ['barge', 'factory'],
];

const DEFAULT_SPECIAL_EDGES = [
  ['park', 'cemetery', 'jump_paddle'],
];

const DEFAULT_EDGES = [...DEFAULT_ROAD_EDGES, ...DEFAULT_SPECIAL_EDGES];

function uniquePairs(edges) {
  const uniq = new Set();
  const out = [];
  for (const edge of edges) {
    const [aRaw, bRaw, connectionTypeRaw] = Array.isArray(edge) ? edge : [];
    const a = String(aRaw || '').trim();
    const b = String(bRaw || '').trim();
    const connectionType = String(connectionTypeRaw || 'road').trim() || 'road';
    if (!a || !b || a === b) continue;
    const k = a < b ? `${a}::${b}::${connectionType}` : `${b}::${a}::${connectionType}`;
    if (uniq.has(k)) continue;
    uniq.add(k);
    out.push([a, b, connectionType]);
  }
  return out;
}

function buildDefaultZoneConnections(zoneIds) {
  const set = new Set((Array.isArray(zoneIds) ? zoneIds : []).map((z) => String(z || '').trim()).filter(Boolean));
  if (set.size <= 1) return [];

  return uniquePairs(DEFAULT_EDGES)
    .filter(([a, b]) => set.has(a) && set.has(b))
    .map(([a, b, connectionType]) => ({
      fromZoneId: a,
      toZoneId: b,
      bidirectional: true,
      connectionType,
    }));
}

module.exports = {
  DEFAULT_ROAD_EDGES,
  DEFAULT_SPECIAL_EDGES,
  DEFAULT_EDGES,
  buildDefaultZoneConnections,
};
