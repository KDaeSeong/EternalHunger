import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildIsolationNavigation, createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');

const baseline = JSON.parse(await createRandomIsolationInput('1101'));
const navigation = buildIsolationNavigation(baseline.map);
const input = createSimulationRunInput({ activeMap: baseline.map, runSeed: baseline.runSeed,
  settings: baseline.settings, publicItems: baseline.items, survivors: baseline.survivors,
  dead: [], kiosks: [], droneOffers: [], spawnState: null, initialFrame: null });
const prepared = prepareSimulationRunInput(input);
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

check('diagnostics and product replay derive the same regions and complete movement graph', () => {
  assert.deepEqual(navigation.zones, prepared.state.zones);
  assert.deepEqual(navigation.zoneGraph, prepared.state.zoneGraph);
  assert.equal(navigation.loops.length, 12);
  assert.ok(navigation.loops.includes('lab'), 'The separate map-level device must not disappear from diagnostics.');
});
check('all diagnostic travel-mode decisions agree with the product replay helper', () => {
  for (const from of navigation.zones) for (const to of navigation.zones) {
    assert.equal(isHyperloopTransit(navigation.baseGraph, navigation.loops, from.zoneId, to.zoneId),
      prepared.helpers.isHyperloopTransit(from.zoneId, to.zoneId), `${from.zoneId}->${to.zoneId}`);
  }
});
check('diagnostics preserve explicit custom device disabling and map input ownership', () => {
  const map = structuredClone(baseline.map);
  map.hyperloopDeviceZoneId = '';
  map.zones.forEach(zone => { zone.hasHyperloop = false; });
  const before = structuredClone(map), derived = buildIsolationNavigation(map);
  assert.deepEqual(derived.loops, []);
  assert.deepEqual(derived.zoneGraph, derived.baseGraph);
  assert.deepEqual(map, before);
});

const repeated = JSON.parse(await createRandomIsolationInput('1101'));
check('the default roster fixture remains explicitly reproducible', () => {
  assert.equal(baseline.initialRosterSeed, 'FIXTURE:initial-roster');
  assert.deepEqual(repeated, baseline);
});
const otherMatch = JSON.parse(await createRandomIsolationInput('2202'));
check('changing match randomness alone does not silently change initial teams', () => {
  assert.deepEqual(otherMatch.survivors, baseline.survivors);
  assert.equal(otherMatch.runSeed, '2202');
});
const variant = JSON.parse(await createRandomIsolationInput('1101', { initialRosterSeed: 'HF4:roster-A' }));
const sameVariant = JSON.parse(await createRandomIsolationInput('1101', { initialRosterSeed: 'HF4:roster-A' }));
check('an explicit roster seed changes the arrangement reproducibly without adding or losing actors', () => {
  const arrangement = fixture => fixture.survivors.map(actor => [actor._id, actor.teamId, actor.teamSlot]);
  assert.notDeepEqual(arrangement(variant), arrangement(baseline));
  assert.deepEqual(sameVariant, variant);
  assert.deepEqual(variant.survivors.map(actor => actor._id).sort(), baseline.survivors.map(actor => actor._id).sort());
  assert.equal(new Set(variant.survivors.map(actor => actor.teamId)).size, 8);
  assert.equal(variant.survivors.length, 24);
});

console.log(`ISOLATION_FIXTURE_CHECKS ${checks}/${checks}`);
