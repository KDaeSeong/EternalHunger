import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildBaseZoneGraph, buildHyperloopZoneGraph, getHyperloopZoneIds, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildRouteConnectionInfo } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { applyRegionDataToZones } = await import('../src/app/simulation/_lib/lumiaRegionData.js');
const { buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { normalizeLocalSimulationMap, saveLocalSimulationMap, loadLocalSimulationMaps } = await import('../src/app/simulation/_lib/localSimulationMapRuntime.js');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { bfsNextStepToAnyTarget } = await import('../src/app/simulation/_lib/pathfindingRuntime.js');

const ids = ['alley', 'gas_station', 'archery', 'school', 'police', 'firestation', 'temple', 'stream'];
const draft = {
  _id: 'local-map-navigation-contract', name: '단방향 지도 계약',
  zones: ids.map(zoneId => ({ zoneId, name: zoneId, hasHyperloop: false })),
  zoneConnections: ids.slice(0, -1).map((fromZoneId, index) => ({ fromZoneId, toZoneId: ids[index + 1], bidirectional: false })),
};
const local = normalizeLocalSimulationMap(draft).map;
const derivedGraph = map => {
  const zones = applyRegionDataToZones(map.zones);
  const base = buildBaseZoneGraph(map, zones);
  const loops = getHyperloopZoneIds(map, zones);
  return { zones, base, loops, graph: buildHyperloopZoneGraph(base, zones, loops) };
};
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}

check('route scoring preserves explicit one-way roads with Lumia IDs', () => {
  assert.equal(buildRouteConnectionInfo(local).routePenalty(['gas_station', 'alley']), 1);
  assert.deepEqual(buildBaseZoneGraph(local, local.zones).gas_station, ['archery']);
});
check('route scoring cannot merge an absent default road into an explicit map', () => {
  assert.equal(buildRouteConnectionInfo(local).routePenalty(['alley', 'temple']), 1);
});
check('unknown source or destination is not a road or hyperloop shortcut', () => {
  const map = { zones: [{ zoneId: 'a', hasHyperloop: true }, { zoneId: 'b' }],
    hyperloopDeviceZoneId: 'ghost', zoneConnections: [{ fromZoneId: 'ghost', toZoneId: 'b' }, { fromZoneId: 'b', toZoneId: 'missing' }] };
  const route = buildRouteConnectionInfo(map);
  for (const pair of [['ghost', 'b'], ['b', 'missing'], ['a', 'missing']]) assert.equal(route.routePenalty(pair), 1);
});
check('legacy arbitrary-zone ring fallback is shared by scoring and movement', () => {
  const map = { zones: ['a', 'b', 'c', 'd'].map(zoneId => ({ zoneId })) };
  const route = buildRouteConnectionInfo(map);
  assert.equal(route.routePenalty(['a', 'b']), 0);
  assert.equal(route.routePenalty(['a', 'c']), 1);
});
check('legacy unspecified Lumia hyperloops are shared by scoring and movement', () => {
  const map = { zones: [{ zoneId: 'gas_station' }, { zoneId: 'hospital' }, { zoneId: 'alley' }] };
  assert.deepEqual(new Set(getHyperloopZoneIds(map, map.zones)), new Set(['gas_station', 'hospital']));
  assert.equal(buildRouteConnectionInfo(map).routePenalty(['gas_station', 'hospital']), 0);
});
check('explicit false overrides a default hyperloop location', () => {
  assert.deepEqual(getHyperloopZoneIds(local, local.zones), []);
});
check('legacy hyperloop false is also an explicit override', () => {
  const zones = [{ zoneId: 'hospital', hyperloop: false }];
  assert.deepEqual(getHyperloopZoneIds({}, zones), []);
});
check('current boolean flag takes precedence over the legacy alias', () => {
  const zones = [{ zoneId: 'hospital', hasHyperloop: false, hyperloop: true },
    { zoneId: 'alley', hasHyperloop: true, hyperloop: false }];
  assert.deepEqual(getHyperloopZoneIds({}, zones), ['alley']);
});
check('display and phase region enrichment cannot turn disabled pads back on', () => {
  const zones = applyRegionDataToZones(local.zones);
  assert.ok(zones.every(zone => zone.hasHyperloop === false));
  assert.deepEqual(getHyperloopZoneIds(local, zones), []);
});
check('explicit custom pad and legacy missing flag remain supported', () => {
  const zones = applyRegionDataToZones([{ zoneId: 'alley', hasHyperloop: true }, { zoneId: 'hospital' }, { zoneId: 'private', hasHyperloop: true }]);
  assert.deepEqual(new Set(getHyperloopZoneIds({}, zones)), new Set(['alley', 'hospital', 'private']));
});
check('map-level device stays enabled but cannot refer to a nonexistent zone', () => {
  assert.deepEqual(getHyperloopZoneIds({ ...local, hyperloopDeviceZoneId: 'school' }, local.zones), ['school']);
  assert.deepEqual(getHyperloopZoneIds({ ...local, hyperloopDeviceZoneId: 'ghost' }, local.zones), []);
});
check('all custom route pairs agree with the rendered/prepared movement graph', () => {
  const { graph } = derivedGraph(local);
  const route = buildRouteConnectionInfo(local);
  for (const from of ids) for (const to of ids) {
    if (from !== to) assert.equal(route.routePenalty([from, to]), graph[from].includes(to) ? 0 : 1, `${from}->${to}`);
  }
});
check('saved JSON replay preparation preserves one-way paths and disabled pads', () => {
  const input = createSimulationRunInput({ activeMap: local, runSeed: 'navigation-contract',
    settings: { rulesetId: 'ER_S11' }, survivors: [{ _id: 'a', hp: 100, zoneId: 'alley' }, { _id: 'b', hp: 100, zoneId: 'stream' }],
    dead: [], publicItems: [], kiosks: [], droneOffers: [], spawnState: null, initialFrame: null });
  const before = structuredClone(input);
  const { state, helpers } = prepareSimulationRunInput(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(state.zoneGraph, buildBaseZoneGraph(local, local.zones));
  assert.equal(helpers.isHyperloopTransit('gas_station', 'stream'), false);
  assert.deepEqual(input, before);
});
check('local save/load round trip preserves the disabled device contract', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const saved = saveLocalSimulationMap(local, storage);
  assert.equal(saved.ok, true);
  const restored = loadLocalSimulationMaps(buildGuestSimulationMap(), storage).find(map => map._id === local._id);
  assert.deepEqual(derivedGraph(restored).loops, []);
  assert.deepEqual(restored.zoneConnections, local.zoneConnections);
});
check('pathfinding follows the actual one-way next hop and cannot reverse or bypass forbidden space', () => {
  const { graph } = derivedGraph(local);
  assert.deepEqual(bfsNextStepToAnyTarget('gas_station', new Set(['stream']), graph), { nextStep: 'archery', target: 'stream' });
  assert.deepEqual(bfsNextStepToAnyTarget('stream', new Set(['alley']), graph), { nextStep: null, target: null });
  assert.deepEqual(bfsNextStepToAnyTarget('alley', new Set(['stream']), graph, new Set(['school'])), { nextStep: null, target: null });
});
check('built-in 21-zone roads and twelve effective hyperloops remain unchanged', () => {
  const map = buildGuestSimulationMap();
  const { zones, base, loops, graph } = derivedGraph(map);
  assert.equal(zones.length, 21);
  assert.deepEqual(loops, ['gas_station', 'school', 'temple', 'stream', 'hospital', 'hotel', 'forest', 'apartment', 'cathedral', 'barge', 'factory', 'lab']);
  const route = buildRouteConnectionInfo(map);
  for (const from of zones.map(zone => zone.zoneId)) for (const to of zones.map(zone => zone.zoneId)) {
    if (from === to) continue;
    const expected = base[from].includes(to) || loops.includes(from);
    assert.equal(route.routePenalty([from, to]), expected ? 0 : 1);
    assert.equal(graph[from].includes(to), expected);
    assert.equal(isHyperloopTransit(base, loops, from, to), loops.includes(from) && !base[from].includes(to));
  }
});
check('navigation derivation is immutable and does not consume random numbers', () => {
  const before = structuredClone(local);
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Navigation must not consume RNG'); };
    derivedGraph(local);
    buildRouteConnectionInfo(local).routePenalty(['alley', 'stream']);
  } finally { Math.random = random; }
  assert.deepEqual(local, before);
});

console.log(`MAP_NAVIGATION_CONTRACT_CHECKS ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
