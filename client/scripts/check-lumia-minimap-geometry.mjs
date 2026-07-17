import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importSource(relativeUrl) {
  const source = await readFile(new URL(relativeUrl, import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const constants = await importSource('../src/app/simulation/_lib/simulationConstants.js');
const geometry = await importSource('../src/app/simulation/_lib/lumiaMapRenderGeometryRuntime.js');
const {
  LUMIA_DEFAULT_ROAD_EDGES,
  LUMIA_HYPERLOOP_MARKERS,
  LUMIA_ISLAND_OUTLINE,
  LUMIA_KIOSK_MARKERS,
  LUMIA_PASSAGE_SEGMENTS,
  LUMIA_ZONE_POS,
} = constants;
const {
  LUMIA_RENDER_GEOMETRY_DEFAULTS,
  createLumiaConnectedPassages,
  createLumiaRenderMarkers,
  createLumiaRenderPositions,
  getDistanceToPolygonBoundary,
  isPointInsidePolygon,
} = geometry;

const canonicalPositions = Object.fromEntries(
  Object.entries(LUMIA_ZONE_POS).filter(([zoneId]) => !['pond', 'residential'].includes(zoneId))
);
const positions = createLumiaRenderPositions(canonicalPositions, LUMIA_ISLAND_OUTLINE);
const passages = createLumiaConnectedPassages(
  LUMIA_PASSAGE_SEGMENTS,
  positions,
  LUMIA_ISLAND_OUTLINE
);

for (const [zoneId, point] of Object.entries(positions)) {
  assert.equal(isPointInsidePolygon(point, LUMIA_ISLAND_OUTLINE), true, `${zoneId} node must stay inside the island`);
  assert.ok(
    getDistanceToPolygonBoundary(point, LUMIA_ISLAND_OUTLINE) >= LUMIA_RENDER_GEOMETRY_DEFAULTS.nodeInset - 0.01,
    `${zoneId} node must keep its boundary inset`
  );
}

for (const [kind, markers] of [
  ['hyperloop', createLumiaRenderMarkers(LUMIA_HYPERLOOP_MARKERS, LUMIA_ISLAND_OUTLINE)],
  ['kiosk', createLumiaRenderMarkers(LUMIA_KIOSK_MARKERS, LUMIA_ISLAND_OUTLINE)],
]) {
  for (const [zoneId, point] of Object.entries(markers)) {
    assert.equal(isPointInsidePolygon(point, LUMIA_ISLAND_OUTLINE), true, `${kind}:${zoneId} must stay inside the island`);
    assert.ok(
      getDistanceToPolygonBoundary(point, LUMIA_ISLAND_OUTLINE) >= LUMIA_RENDER_GEOMETRY_DEFAULTS.markerInset - 0.01,
      `${kind}:${zoneId} must keep its boundary inset`
    );
  }
}

assert.equal(passages.length, LUMIA_PASSAGE_SEGMENTS.length, 'every traced passage must be rendered');
assert.equal(passages.length, LUMIA_DEFAULT_ROAD_EDGES.length, 'movement and rendering road counts must match');

function distance(a, b) {
  return Math.hypot(Number(a[0]) - Number(b.x), Number(a[1]) - Number(b.y));
}

for (const passage of passages) {
  const [fromZoneId, toZoneId] = passage.edge;
  assert.ok(distance(passage.points[0], positions[fromZoneId]) < 0.01, `${fromZoneId}-${toZoneId} must start at its node`);
  assert.ok(distance(passage.points.at(-1), positions[toZoneId]) < 0.01, `${fromZoneId}-${toZoneId} must end at its node`);

  for (let index = 0; index < passage.points.length - 1; index += 1) {
    const start = passage.points[index];
    const end = passage.points[index + 1];
    for (let step = 0; step <= 20; step += 1) {
      const ratio = step / 20;
      const sample = [
        start[0] + ((end[0] - start[0]) * ratio),
        start[1] + ((end[1] - start[1]) * ratio),
      ];
      assert.equal(
        isPointInsidePolygon(sample, LUMIA_ISLAND_OUTLINE),
        true,
        `${fromZoneId}-${toZoneId} must not leave the island`
      );
      assert.ok(
        getDistanceToPolygonBoundary(sample, LUMIA_ISLAND_OUTLINE)
          >= LUMIA_RENDER_GEOMETRY_DEFAULTS.routeInset - 0.02,
        `${fromZoneId}-${toZoneId} must keep its route boundary inset`
      );
    }
  }
}

const adjacency = new Map(Object.keys(positions).map((zoneId) => [zoneId, new Set()]));
for (const [a, b] of LUMIA_DEFAULT_ROAD_EDGES) {
  adjacency.get(a)?.add(b);
  adjacency.get(b)?.add(a);
}
const visited = new Set();
const queue = [Object.keys(positions)[0]];
while (queue.length) {
  const zoneId = queue.shift();
  if (!zoneId || visited.has(zoneId)) continue;
  visited.add(zoneId);
  for (const next of adjacency.get(zoneId) || []) queue.push(next);
}
assert.equal(visited.size, Object.keys(positions).length, 'the Lumia road graph must connect every zone');

console.log(JSON.stringify({
  zones: Object.keys(positions).length,
  passages: passages.length,
  connectedZones: visited.size,
  endpointsSnapped: true,
  boundaryContained: true,
}, null, 2));
