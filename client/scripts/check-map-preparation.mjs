import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { legacyHeroRoutePlan } = await import('./lib/legacy-hero-route-plan.mjs');
const { buildDay1TargetCandidatesBySlot: legacyCandidates, buildItemIndexes } = await import('./lib/legacy-route-plan-builder.mjs');
const { buildDay1HeroRoutePlanDetails } = await import('../src/app/simulation/_lib/routePlanRuntime.js');
const { buildDay1TargetCandidatesBySlot, addRequirementsToState, prepareRouteRequirementSearch, requirementStatsForRoute } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { rebaseSurvivorsForMap } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { EQUIP_SLOTS } = await import('../src/app/simulation/_lib/simulationConstants.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const items = await loadGuestSimulationItemCatalog();
const roster = buildGuestSimulationRoster();
const builtin = buildGuestSimulationMap();
const zoneIds = ['alley', 'gas_station', 'archery', 'school', 'police', 'firestation', 'temple', 'stream'];
const corridor = { _id: 'test-corridor', zones: zoneIds.map((zoneId) => ({ zoneId, hasHyperloop: false })),
  zoneConnections: zoneIds.slice(0, -1).map((fromZoneId, index) => ({ fromZoneId, toZoneId: zoneIds[index + 1], bidirectional: false })) };
const fastOptions = { candidateLimit: 6, beamLimit: 48, maxRoutes: 96, droneFallbackLimit: 1 };
let checks = 0;
let routesCompared = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const compare = (actor, map, catalog = items, options = fastOptions) => {
  const input = structuredClone({ actor, map, catalog, options });
  const actual = withSimulationRandom(() => { throw new Error('Route planning must not consume match RNG'); },
    () => buildDay1HeroRoutePlanDetails(actor, map, catalog, options));
  assert.deepEqual(actual, legacyHeroRoutePlan(actor, map, catalog, options));
  assert.deepEqual({ actor, map, catalog, options }, input, 'Neither implementation may mutate inputs.');
  routesCompared++;
  return actual;
};

check('24 actors retain exact route, targets, quantities and tie ordering on both real map shapes', () => {
  for (const map of [builtin, corridor]) for (const actor of roster) compare(actor, map);
});
check('candidate and recipe source ordering match the frozen builder for every weapon', () => {
  const indexes = buildItemIndexes(items);
  for (const actor of roster) {
    assert.deepEqual(buildDay1TargetCandidatesBySlot(actor, items, indexes, builtin, fastOptions),
      legacyCandidates(actor, items, indexes, builtin, fastOptions));
  }
});
check('forbidden zones, explicit goals and alternate search limits retain exact choices', () => {
  const actor = structuredClone(roster[0]);
  const candidates = legacyCandidates(actor, items, buildItemIndexes(items), builtin);
  actor.goalLoadouts = { hero: Object.fromEntries([...candidates].map(([slot, rows]) => [`${slot}Key`, rows[0]?.item.itemKey])) };
  for (const options of [
    {}, { candidateLimit: 3, beamLimit: 20, maxRoutes: 20, droneFallbackLimit: 0 },
    { candidateLimit: 8, beamLimit: 30, maxRoutes: 50, droneFallbackLimit: 5, droneMaxTier: 3, forbiddenIds: new Set(['hotel', 'school', 'alley']) },
  ]) compare(actor, builtin, items, options);
});
check('empty, unknown and single-zone maps and missing equipment slots keep fallbacks', () => {
  for (const map of [{ zones: [] }, { zones: [{ zoneId: 'unknown' }] }, { zones: [{ zoneId: 'hotel' }] }]) compare(roster[0], map);
  compare(roster[0], builtin, []);
  compare(roster[0], builtin, items.filter((item) => item.equipSlot !== 'head'));
});

const customMap = { _id: 'custom', zones: ['north', 'south', 'west'].map((zoneId) => ({ zoneId, hasHyperloop: false })),
  zoneConnections: [{ fromZoneId: 'north', toZoneId: 'south', bidirectional: false }],
  itemCrates: [{ zoneId: 'north', lootTable: [{ itemId: 'leaf-a', weight: 4 }] }] };
const customItems = [
  { _id: 'leaf-a', name: 'Alpha custom material', type: '재료', tier: 1, spawnZones: ['north'] },
  { _id: 'leaf-b', name: 'Beta custom material', type: '재료', tier: 2, spawnZones: ['south'] },
  { _id: 'batch', name: 'Batch material', type: '재료', tier: 2,
    recipe: { ingredients: [{ itemId: 'leaf-a', qty: 3 }], resultQty: 2, creditCost: 0 } },
  ...EQUIP_SLOTS.flatMap((slot) => [0, 1, 2].map((n) => ({ _id: `${slot}-${n}`, itemKey: `${slot}-${n}`, name: `${slot} ${n}`,
    type: '장비', category: 'equipment', equipSlot: slot, tier: 4,
    recipe: { ingredients: [{ itemId: n === 0 ? 'batch' : 'leaf-a', qty: n + 1 }, { itemId: 'leaf-b', qty: 1 }], resultQty: 1, creditCost: 0 } }))),
];
check('custom batch recipes, shared leaves, costs and missing references stay equivalent', () => {
  compare({ _id: 'custom-actor' }, customMap, customItems);
  const broken = structuredClone(customItems);
  broken.find((row) => row._id === 'weapon-0').recipe.ingredients.push({ itemId: 'missing', qty: 2 });
  broken.find((row) => row._id === 'head-0').recipe.ingredients.push({ itemId: 'head-0', qty: 1 });
  broken.find((row) => row._id === 'shoes-1').recipe.resultQty = 0;
  compare({ _id: 'custom-actor' }, customMap, broken);
});
check('in-place catalog, crate, map, forbidden and goal edits do not reuse stale preparation', () => {
  const map = structuredClone(customMap), catalog = structuredClone(customItems), actor = { _id: 'editable' };
  const options = { ...fastOptions, forbiddenIds: new Set() };
  compare(actor, map, catalog, options);
  catalog[0].spawnZones = ['west']; catalog[0].name = 'Changed custom material';
  map.itemCrates[0].zoneId = 'south'; options.forbiddenIds.add('south');
  catalog.find((row) => row._id === 'arm-0').recipe.ingredients[0].qty = 17;
  actor.goalLoadouts = { hero: { weaponKey: 'weapon-2', armKey: 'arm-0' } };
  compare(actor, map, catalog, options);
  map.zones = [{ zoneId: 'west' }];
  compare(actor, map, catalog, options);
});
check('numeric beam branches retain insertion/addition order without shared mutable quantities', () => {
  const candidates = buildDay1TargetCandidatesBySlot({}, customItems, buildItemIndexes(customItems), customMap);
  const search = prepareRouteRequirementSearch(candidates, 1);
  const route = new Set(['north']);
  const covered = search.materials.map((req) => req.zones.some((zone) => route.has(zone)));
  const initial = { quantities: new Array(search.materials.length).fill(0), ids: [], picks: [] };
  let numeric = initial, reference = new Map();
  for (const slot of EQUIP_SLOTS) {
    const candidate = search.bySlot.get(slot)[0];
    const previous = structuredClone(numeric);
    const branch = search.extend(numeric, search.bySlot.get(slot).at(-1), covered);
    numeric = search.extend(numeric, candidate, covered);
    reference = addRequirementsToState(reference, candidate.requirements);
    const stats = requirementStatsForRoute(reference, route);
    assert.equal(numeric.stats.missingCount, stats.missing.length);
    for (const key of ['missingQty', 'totalQty', 'coveredQty']) assert.equal(numeric.stats[key], stats[key]);
    assert.deepEqual(numeric.ids.map((index) => search.materials[index].itemId), [...reference.keys()]);
    assert.deepEqual(numeric.ids.map((index) => numeric.quantities[index]), [...reference.values()].map((req) => req.qty));
    branch.quantities.fill(-1); branch.ids.length = 0;
    assert.ok(numeric.quantities.every((qty) => qty >= 0));
    if (slot === EQUIP_SLOTS[0]) assert.deepEqual(initial, previous);
  }
});
check('rebasing duplicate actors owns independent output arrays and never consumes RNG', () => {
  const actor = structuredClone(roster[0]);
  const source = structuredClone(actor);
  const [a, b] = withSimulationRandom(() => { throw new Error('Map rebase consumed RNG'); },
    () => rebaseSurvivorsForMap([actor, actor], corridor, items));
  assert.deepEqual(a, b);
  a.routePlanZoneIds.push('not-in-map');
  a.routePlanRequiredQtyById['not-an-item'] = 77;
  assert.ok(!b.routePlanZoneIds.includes('not-in-map'));
  assert.equal(b.routePlanRequiredQtyById['not-an-item'], undefined);
  assert.deepEqual(actor, source);
});
console.log(JSON.stringify({ checks, routesCompared, pass: true, scope: 'exact planning equivalence, not browser latency or human acceptance' }));
