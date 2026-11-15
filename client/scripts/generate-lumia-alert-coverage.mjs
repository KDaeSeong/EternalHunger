import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LUMIA_REFERENCE_ZONE_PIXELS } from '../src/app/simulation/_lib/lumiaReferenceMapGeometry.js';
import { LUMIA_MINIMAP_REFERENCE_IMAGE, LUMIA_MINIMAP_VIEWBOX } from '../src/app/simulation/_lib/simulationConstants.js';

// Display-only clips: the original geometry, navigation and PNG are inputs only.
// Assign source-pixel centres, preserving every existing region interior; extend
// uncovered centres to the nearest original edge, ties in declaration order.
const target = new URL('../src/app/simulation/_components/minimapReferenceAlertCoverage.js', import.meta.url);
const report = new URL('../../.local/code-audit/minimap-restricted-boundaries/alert-coverage-generation.json', import.meta.url);
const checking = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Only --check is supported');
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
const bounds = LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds;
const { width: W, height: H } = bounds;
const N = W * H;
const regions = Object.entries(LUMIA_REFERENCE_ZONE_PIXELS);
assert.equal(regions.length, 21);
const labels = new Int8Array(N).fill(-1), counts = Array(21).fill(0);
const statistics = { preservedInteriorCentres: 0, extendedCentres: 0, overlappingInteriorCentres: 0, overlapExamples: [], nearestExactTies: 0 };
function edgeDistanceSquared([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}
function inside(point, polygon, includeBoundary = true) {
  const [x, y] = point; let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (edgeDistanceSquared(point, a, b) === 0) return includeBoundary;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const point = [bounds.x + x + 0.5, bounds.y + y + 0.5];
  const interiors = [];
  for (let r = 0; r < regions.length; r++) if (inside(point, regions[r][1].polygon, false)) interiors.push(r);
  let owner = interiors[0];
  if (interiors.length) {
    statistics.preservedInteriorCentres++;
    if (interiors.length > 1) {
      statistics.overlappingInteriorCentres++;
      if (statistics.overlapExamples.length < 8) statistics.overlapExamples.push({ point, regions: interiors.map(r => regions[r][0]) });
    }
  } else {
    statistics.extendedCentres++;
    let best = Infinity;
    for (let r = 0; r < regions.length; r++) {
      const polygon = regions[r][1].polygon;
      let distance = Infinity;
      for (let i = 0; i < polygon.length; i++) distance = Math.min(distance, edgeDistanceSquared(point, polygon[i], polygon[(i + 1) % polygon.length]));
      if (distance < best) { best = distance; owner = r; }
      else if (distance === best) statistics.nearestExactTies++;
    }
  }
  assert.ok(owner >= 0 && owner < 21);
  labels[y * W + x] = owner; counts[owner]++;
  for (const r of interiors) assert.equal(owner, r, `Original interior conflict at ${point}`);
}
assert.equal(statistics.overlappingInteriorCentres, 0, JSON.stringify(statistics.overlapExamples));
const pointKey = (x, y) => y * (W + 1) + x;
const fromKey = key => [key % (W + 1), Math.floor(key / (W + 1))];
const edges = Array.from({ length: 21 }, () => []);
function add(r, x, y, xx, yy) { edges[r].push([pointKey(x, y), pointKey(xx, yy)]); }
let sharedUnitEdges = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = labels[y * W + x];
  if (!y || labels[(y - 1) * W + x] !== r) add(r, x, y, x + 1, y);
  if (x === W - 1 || labels[y * W + x + 1] !== r) { add(r, x + 1, y, x + 1, y + 1); if (x < W - 1) sharedUnitEdges++; }
  if (y === H - 1 || labels[(y + 1) * W + x] !== r) { add(r, x + 1, y + 1, x, y + 1); if (y < H - 1) sharedUnitEdges++; }
  if (!x || labels[y * W + x - 1] !== r) add(r, x, y + 1, x, y);
}
const componentCounts = Array(21).fill(0), visited = new Uint8Array(N), queue = new Int32Array(N);
for (let start = 0; start < N; start++) if (!visited[start]) {
  const r = labels[start]; componentCounts[r]++;
  let head = 0, tail = 1; queue[0] = start; visited[start] = 1;
  while (head < tail) {
    const p = queue[head++], x = p % W, y = Math.floor(p / W);
    const neighbors = [];
    if (x) neighbors.push(p - 1); if (x < W - 1) neighbors.push(p + 1);
    if (y) neighbors.push(p - W); if (y < H - 1) neighbors.push(p + W);
    for (const q of neighbors) if (!visited[q] && labels[q] === r) { visited[q] = 1; queue[tail++] = q; }
  }
}
const sourcePolygons = {}, topology = [];
for (let r = 0; r < regions.length; r++) {
  const [id, region] = regions[r], outgoing = new Map(), incoming = new Map();
  for (const [a, b] of edges[r]) {
    if (!outgoing.has(a)) outgoing.set(a, []); outgoing.get(a).push(b);
    incoming.set(b, (incoming.get(b) || 0) + 1);
  }
  const branchedVertices = [...outgoing].filter(([p, next]) => next.length !== 1 || incoming.get(p) !== 1).map(([p]) => fromKey(p));
  const loops = [], used = new Set();
  if (!branchedVertices.length) for (const start of outgoing.keys()) if (!used.has(start)) {
    let p = start; const loop = [];
    do { assert.equal(used.has(p), false); used.add(p); loop.push(fromKey(p)); p = outgoing.get(p)[0]; } while (p !== start);
    loops.push(loop);
  }
  const row = { id, pixels: counts[r], connectedComponents4: componentCounts[r], unitBoundaryEdges: edges[r].length, loops: loops.length, branchedVertices, anchorPreserved: false };
  topology.push(row);
  if (componentCounts[r] !== 1 || branchedVertices.length || loops.length !== 1) continue;
  const loop = loops[0];
  const twiceArea = loop.reduce((sum, a, i) => { const b = loop[(i + 1) % loop.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
  assert.equal(twiceArea / 2, counts[r], `${id}: area must equal its exact cell count, without holes`);
  // Remove only exactly collinear grid vertices, preserving every cell edge.
  const simple = loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
    return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
  }).map(([x, y]) => [x + bounds.x, y + bounds.y]);
  assert.equal(inside(region.anchor, region.polygon), true);
  assert.equal(inside(region.anchor, simple), true, `${id}: source anchor must remain inside`);
  row.anchorPreserved = true; row.vertices = simple.length;
  sourcePolygons[id] = simple;
}
const metadata = {
  schema: 'lumia-reference-alert-coverage.v1', scope: 'Display-only forbidden-image clips, not terrain truth, gameplay, navigation or world coordinates.',
  sourcePixelGeometrySha256: sha(JSON.stringify(LUMIA_REFERENCE_ZONE_PIXELS)),
  sourceMapBounds: bounds, targetViewBox: LUMIA_MINIMAP_VIEWBOX,
  algorithm: '1px source cell centres; retain strict original polygon interior membership; uncovered or boundary centres choose nearest original polygon edge by squared distance, exact ties in original declaration order. Trace cell-union boundary and remove only collinear vertices.',
  quantization: 'Finite source-pixel-centre contract; contours follow source pixel-cell edges, not subpixel original polygon boundaries. Literal viewBox coordinates rounded to 8 decimals; shared vertices use identical rounding.',
  canonicalRegionOrder: regions.map(([id]) => id), totalPixels: N, ...statistics, sharedUnitEdges,
  topology, selfIntersectionCheck: 'All traced edges are axis-aligned unit grid edges; each boundary vertex has one incoming and outgoing edge and occurs once per loop. Collinear removal preserves those edges.',
};
const invalid = topology.filter(row => row.connectedComponents4 !== 1 || row.loops !== 1 || row.branchedVertices.length || !row.anchorPreserved);
if (invalid.length) {
  if (!checking) fs.writeFileSync(report, JSON.stringify({ status: 'blocked-topology', metadata, invalid }, null, 2) + '\n', { flag: 'wx' });
  throw new Error(`Cannot export single simple polygons: ${JSON.stringify(invalid)}`);
}
assert.equal(Object.keys(sourcePolygons).length, 21);
assert.equal(counts.reduce((a, b) => a + b, 0), N);
assert.equal(edges.reduce((sum, list) => sum + list.length, 0), sharedUnitEdges * 2 + 2 * W + 2 * H, 'Every shared unit edge belongs to two regions, and map perimeter to one');
const rounded = value => Number(value.toFixed(8));
const polygons = Object.fromEntries(Object.entries(sourcePolygons).map(([id, polygon]) => [id, polygon.map(([x, y]) => [rounded((x - bounds.x) / W * LUMIA_MINIMAP_VIEWBOX.width), rounded((y - bounds.y) / H * LUMIA_MINIMAP_VIEWBOX.height)])]));
const output = `// Generated by client/scripts/generate-lumia-alert-coverage.mjs; do not edit.\n// Display-only source-pixel coverage, not gameplay or terrain geometry.\nexport const LUMIA_REFERENCE_ALERT_COVERAGE_META = ${JSON.stringify(metadata, null, 2)};\nexport const LUMIA_REFERENCE_ALERT_COVERAGE_POLYGONS = {\n${Object.entries(polygons).map(([id, points]) => `  ${id}: ${JSON.stringify(points)},`).join('\n')}\n};\n`;
if (checking) assert.equal(fs.readFileSync(target, 'utf8'), output, 'Generated coverage is stale');
else {
  fs.writeFileSync(target, output, { flag: 'wx' });
  fs.writeFileSync(report, JSON.stringify({ status: 'generated', module: fileURLToPath(target), moduleSha256: sha(output), moduleBytes: Buffer.byteLength(output), metadata }, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ status: checking ? 'exact' : 'generated', regions: 21, sourcePixelCentres: N, preserved: statistics.preservedInteriorCentres, extended: statistics.extendedCentres, sharedUnitEdges, totalVertices: topology.reduce((sum, row) => sum + row.vertices, 0), moduleBytes: Buffer.byteLength(output), moduleSha256: sha(output) }));
