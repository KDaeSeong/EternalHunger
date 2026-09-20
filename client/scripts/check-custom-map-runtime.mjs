import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { buildBaseZoneGraph, getHyperloopZoneIds } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildCustomMapRenderGeometry } = await import('../src/app/simulation/_lib/customMapRenderGeometryRuntime.js');
const { buildZonePositions } = await import('../src/app/simulation/_lib/mapDerived.js');

let checks = 0;
const check = (name, fn) => {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
};

check('explicit custom connections remain authoritative even with Lumia-like IDs', () => {
  const ids = ['alley', 'gas_station', 'archery', 'school', 'police', 'firestation', 'temple', 'stream'];
  const zones = ids.map((zoneId) => ({ zoneId }));
  const graph = buildBaseZoneGraph({ zoneConnections: [
    { fromZoneId: 'alley', toZoneId: 'gas_station', bidirectional: false },
  ] }, zones);
  assert.deepEqual(graph.alley, ['gas_station']);
  assert.deepEqual(graph.gas_station, []);
  assert.equal(Object.values(graph).reduce((sum, neighbors) => sum + neighbors.length, 0), 1);
});

check('connections cannot invent zones that are absent from the selected map', () => {
  const zones = [{ zoneId: 'a' }, { zoneId: 'b' }];
  const graph = buildBaseZoneGraph({ zoneConnections: [
    { fromZoneId: 'a', toZoneId: 'missing' },
    { fromZoneId: 'ghost', toZoneId: 'b' },
    { fromZoneId: 'a', toZoneId: 'a' },
  ] }, zones);
  assert.deepEqual(Object.keys(graph).sort(), ['a', 'b']);
  assert.deepEqual(graph, { a: [], b: [] });
});

check('legacy maps without a connection contract retain a deterministic connected fallback', () => {
  const zones = ['north', 'east', 'south', 'west'].map((zoneId) => ({ zoneId }));
  const graph = buildBaseZoneGraph({}, zones);
  assert.deepEqual(graph.north, ['east', 'west']);
  assert.deepEqual(graph.south, ['east', 'west']);
});

check('custom polygons and centers normalize into one stable render coordinate system', () => {
  const zones = [
    { zoneId: 'a', polygon: [{ x: 1000, y: 2000 }, { x: 1200, y: 2000 }, { x: 1200, y: 2200 }, { x: 1000, y: 2200 }] },
    { zoneId: 'b', polygon: [[1400, 2000], [1600, 2000], [1600, 2200], [1400, 2200]] },
    { zoneId: 'c', center: { x: 1300, y: 2500 } },
    { zoneId: 'd' },
  ];
  const before = structuredClone(zones);
  const geometry = buildCustomMapRenderGeometry(zones, [['a', 'b'], ['b', 'c'], ['a', 'ghost']]);
  assert.equal(geometry.kind, 'custom');
  assert.deepEqual(Object.keys(geometry.polygons).sort(), ['a', 'b']);
  assert.deepEqual(Object.keys(geometry.positions).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(geometry.passages.map((row) => row.edge), [['a', 'b'], ['b', 'c']]);
  for (const point of Object.values(geometry.positions)) {
    assert.ok(point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
  }
  assert.deepEqual(buildZonePositions(zones), geometry.positions);
  assert.deepEqual(zones, before);
});

check('malformed polygons do not falsely activate custom rendering', () => {
  const zones = [{ zoneId: 'a', polygon: [{ x: 'bad', y: 1 }] }, { zoneId: 'b' }];
  assert.equal(buildCustomMapRenderGeometry(zones), null);
  assert.deepEqual(Object.keys(buildZonePositions(zones)).sort(), ['a', 'b']);
});

check('custom hyperloops come from its own zone flags and device, not foreign IDs', () => {
  const zones = [{ zoneId: 'alpha', hasHyperloop: true }, { zoneId: 'beta' }, { zoneId: 'gamma' }];
  assert.deepEqual(getHyperloopZoneIds({ hyperloopDeviceZoneId: 'gamma' }, zones), ['alpha', 'gamma']);
});

check('the minimap switches polygons, passages, clipping and labels as one geometry', async () => {
  const source = await readFile(new URL('../src/app/simulation/_components/SimulationMinimapCanvas.js', import.meta.url), 'utf8');
  assert.match(source, /buildCustomMapRenderGeometry\(zones, zoneEdges\)/);
  assert.match(source, /customGeometry\?\.polygons \|\| LUMIA_REFERENCE_POLYGONS/);
  assert.match(source, /customGeometry\?\.passages \|\| createLumiaConnectedPassages/);
  assert.match(source, /aria-label=\{customGeometry \? '사용자 지도 미니맵' : '루미아 섬 미니맵'\}/);
});

console.log(`CUSTOM_MAP_RUNTIME_CHECKS ${checks}/${checks}`);
