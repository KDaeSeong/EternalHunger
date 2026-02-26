// server/utils/defaultZoneConnections.js
// ✅ 기본 '존 동선(인접 그래프)' 프리셋
// - Eternal Return 루미아 섬(존 기반) 감성에 맞춰, 기본 존들이 "인접 이동" 할 수 있도록 구성
// - 실제 맵 제작 단계에서 어드민 UI로 덮어쓸 수 있으므로, 여기서는 "기본값"만 제공합니다.

// 기본 연결(양방향)
// NOTE: zoneId는 server/utils/defaultZones.js의 기본 zoneId와 맞춰야 합니다.
const DEFAULT_EDGES = [
  // 중심/도심
  ['alley', 'hospital'],
  ['alley', 'police'],
  ['alley', 'cathedral'],
  ['alley', 'warehouse'],
  ['alley', 'residential'],
  ['alley', 'gas_station'],

  // 서쪽/해안
  ['gas_station', 'beach'],
  ['beach', 'stream'],
  ['beach', 'port'],

  // 자연/사냥 루트
  ['stream', 'forest'],
  ['stream', 'pond'],
  ['forest', 'archery'],
  ['forest', 'temple'],
  ['forest', 'pond'],
  ['temple', 'pond'],
  ['archery', 'temple'],

  // 북/학군
  ['pond', 'school'],
  ['pond', 'lab'],
  ['pond', 'cathedral'],
  ['school', 'hotel'],
  ['hotel', 'lab'],
  ['hotel', 'cathedral'],
  ['hotel', 'residential'],
  ['school', 'residential'],
  ['hospital', 'residential'],

  // 산업/남동
  ['warehouse', 'factory'],
  ['factory', 'port'],
  ['factory', 'firestation'],
  ['factory', 'lab'],
  ['firestation', 'police'],
  ['warehouse', 'port'],
];

function uniquePairs(edges) {
  const uniq = new Set();
  const out = [];
  for (const [aRaw, bRaw] of edges) {
    const a = String(aRaw || '').trim();
    const b = String(bRaw || '').trim();
    if (!a || !b || a === b) continue;
    const k = a < b ? `${a}::${b}` : `${b}::${a}`;
    if (uniq.has(k)) continue;
    uniq.add(k);
    out.push([a, b]);
  }
  return out;
}

/**
 * @param {string[]} zoneIds 현재 맵에 존재하는 zoneId 목록
 * @returns {{fromZoneId:string,toZoneId:string,bidirectional:boolean}[]}
 */
function buildDefaultZoneConnections(zoneIds) {
  const set = new Set((Array.isArray(zoneIds) ? zoneIds : []).map((z) => String(z || '').trim()).filter(Boolean));
  if (set.size <= 1) return [];

  const edges = uniquePairs(DEFAULT_EDGES)
    .filter(([a, b]) => set.has(a) && set.has(b))
    .map(([a, b]) => ({ fromZoneId: a, toZoneId: b, bidirectional: true }));

  return edges;
}

module.exports = {
  DEFAULT_EDGES,
  buildDefaultZoneConnections,
};
