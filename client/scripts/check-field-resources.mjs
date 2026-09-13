import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createFieldResources, ensureFieldResources, getFieldResourceQty, collectFieldResourceLoot, summarizeFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { cloneSpawnState, createInitialSpawnState } = await import('../src/app/simulation/_lib/spawnStateRuntime.js');
const { rollFieldLoot } = await import('../src/app/simulation/_lib/fieldLootRuntime.js');
const { runRouteFarmAction } = await import('../src/app/simulation/_lib/phaseRouteFarmRuntime.js');
const { runFieldLootPhase } = await import('../src/app/simulation/_lib/phaseFieldLootRuntime.js');
const { runFacilityGatherPhase } = await import('../src/app/simulation/_lib/phaseFacilityGatherRuntime.js');
const { buildActorGrowthPlan, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { pickGoalResourceZoneTargets } = await import('../src/app/simulation/_lib/resourceTargetingRuntime.js');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const ruleset = getRuleset('ER_S11');
const raw = { _id: 'raw', name: '테스트 원료', type: '재료', category: 'material', tier: 1, spawnZones: ['a', 'b'], recipe: { ingredients: [] } };
const target = { _id: 'target', name: '테스트 장비', type: '머리', category: 'equipment', equipSlot: 'head', tier: 4, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } };
const items = [raw, target];
const mapObj = { _id: 'stock-test', zones: ['a', 'b'].map((zoneId) => ({ zoneId, name: zoneId })), fieldResourceStock: { a: { raw: 1 }, b: { raw: 2 } } };
const zoneGraph = { a: ['b'], b: ['a'] };
const actor = (id = 'one') => ({ _id: id, name: id, teamId: id, hp: 100, maxHp: 100, zoneId: 'a', inventory: [], routePlanTargetItemIds: ['target'] });
const loot = (qty = 1, zoneId = 'a') => ({ item: raw, itemId: 'raw', zoneId, qty });
const receive = (row) => (qty) => {
  row.inventory = addItemToInventory(row.inventory, raw, raw._id, qty, 1, ruleset);
  return row.inventory._lastAdd.acceptedQty;
};
const fixedRandom = Math.random;
Math.random = () => 0;
try {
  check('only actual local uncrafted basic supplies enter finite stock', () => {
    const resources = createFieldResources(mapObj, [...items, { ...raw, _id: 'crafted', recipe: target.recipe }, { ...raw, _id: 'special', name: '운석' }], ruleset);
    assert.equal(getFieldResourceQty(resources, 'a', 'raw'), 1);
    assert.equal(getFieldResourceQty(resources, 'missing', 'raw'), 0);
    for (const id of ['target', 'crafted', 'special']) assert.equal(getFieldResourceQty(resources, 'a', id), 0);
    assert.equal(summarizeFieldResources(resources).initial, 3);
  });
  check('competing teams cannot both collect the last item, even with stale proposals', () => {
    const resources = createFieldResources(mapObj, items, ruleset);
    const first = actor(); const second = actor('two'); const a = loot(3); const b = loot(3);
    assert.equal(collectFieldResourceLoot(resources, a, receive(first)), 1);
    assert.equal(collectFieldResourceLoot(resources, b, receive(second)), 0);
    assert.equal(invQty(first.inventory, 'raw') + invQty(second.inventory, 'raw'), 1);
    assert.equal(getFieldResourceQty(resources, 'a', 'raw'), 0);
    assert.equal(collectFieldResourceLoot(resources, a, receive(first)), 0, 'The same accepted proposal cannot be committed twice.');
  });
  check('rejected and partially accepted inventory never destroy uncollected stock', () => {
    const resources = createFieldResources(mapObj, items, ruleset);
    const proposal = loot(2, 'b');
    assert.equal(collectFieldResourceLoot(resources, proposal, () => 0), 0);
    assert.equal(getFieldResourceQty(resources, 'b', 'raw'), 2);
    assert.equal(collectFieldResourceLoot(resources, proposal, () => 1), 1);
    assert.equal(getFieldResourceQty(resources, 'b', 'raw'), 1);
    assert.equal(summarizeFieldResources(resources).taken, 1);
  });
  check('a genuinely full protected bag does not consume field stock', () => {
    const resources = createFieldResources(mapObj, items, ruleset);
    const row = actor(); const compact = { ...ruleset, inventory: { ...ruleset.inventory, maxSlots: 1 } };
    row.inventory = addItemToInventory([], { ...raw, _id: 'other', name: '보호 재료', goalItem: true }, 'other', 1, 1, compact);
    const accepted = collectFieldResourceLoot(resources, loot(), (qty) => {
      row.inventory = addItemToInventory(row.inventory, raw, 'raw', qty, 1, compact);
      return row.inventory._lastAdd.acceptedQty;
    });
    assert.equal(accepted, 0); assert.equal(getFieldResourceQty(resources, 'a', 'raw'), 1);
  });
  check('night/day cloning preserves stock, snapshots are independent, new matches reset it', () => {
    const spawn = createInitialSpawnState(mapObj._id);
    const resources = ensureFieldResources(spawn, mapObj, items, ruleset);
    collectFieldResourceLoot(resources, loot(), () => 1);
    const night = cloneSpawnState(spawn, mapObj._id);
    assert.equal(ensureFieldResources(night, { ...mapObj }, items, ruleset).byZone.a.raw.remaining, 0);
    collectFieldResourceLoot(night.fieldResources, loot(1, 'b'), () => 1);
    assert.equal(resources.byZone.b.raw.remaining, 2);
    const restored = JSON.parse(JSON.stringify(night));
    assert.equal(ensureFieldResources(restored, mapObj, items, ruleset).byZone.b.raw.remaining, 1);
    assert.equal(ensureFieldResources(createInitialSpawnState(mapObj._id), mapObj, items, ruleset).byZone.a.raw.remaining, 1);
  });
  check('depleted and nonlocal items cannot reappear through guaranteed routes or generic fallback', () => {
    const resources = createFieldResources(mapObj, items, ruleset);
    collectFieldResourceLoot(resources, loot(), () => 1);
    for (const opts of [{ routeFarm: true, focusedGrowth: true, routeItemIds: ['raw'] }, {}, { routeItemIds: ['target'] }]) {
      assert.equal(rollFieldLoot(mapObj, 'a', items, ruleset, { ...opts, fieldResources: resources, day: 1, phase: 'morning', moved: true }), null);
    }
    assert.equal(rollFieldLoot(mapObj, 'unknown', items, ruleset, { fieldResources: resources, moved: true }), null);
  });
  check('plans move to remaining supplies, respect forbidden paths, and never fake completion', () => {
    const fieldResources = createFieldResources(mapObj, items, ruleset); const row = actor();
    assert.equal(buildActorGrowthPlan(row, items, { mapObj, zoneGraph, fieldResources }).targetZoneId, 'a');
    collectFieldResourceLoot(fieldResources, loot(), () => 1);
    const plan = buildActorGrowthPlan(row, items, { mapObj, zoneGraph, fieldResources });
    assert.equal(plan.targetZoneId, 'b'); assert.equal(plan.nextStep, 'b'); assert.deepEqual(plan.currentZoneItemIds, []);
    assert.ok(buildActorGrowthPlan(row, items, { mapObj, zoneGraph, fieldResources, forbiddenIds: new Set(['b']) }).blocked);
    collectFieldResourceLoot(fieldResources, loot(2, 'b'), () => 2);
    const empty = buildActorGrowthPlan(row, items, { mapObj, zoneGraph, fieldResources });
    assert.ok(empty.blocked); assert.equal(empty.openingComplete, false);
  });
  check('actual movement and route-farming executors reroute the second team after the first takes stock', () => {
    const nextSpawn = { fieldResources: createFieldResources(mapObj, items, ruleset) };
    const events = [];
    const actions = { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }), atNow: () => ({ sec: 20 }) };
    const state = { mapObj, zoneGraph, nextSpawn, ruleset, publicItems: items, craftables: [], itemNameById: {}, itemMetaById: {}, nextDay: 1, nextPhase: 'morning', forbiddenIds: new Set() };
    const first = actor(); let second = actor('two');
    refreshActorGrowthPlan(first, items, state); refreshActorGrowthPlan(second, items, state);
    runRouteFarmAction({ actions, state: { ...state, actor: first, fallbackRouteItemIds: ['raw'], goalMissingIds: ['raw'] } });
    assert.equal(invQty(first.inventory, 'raw'), 1);
    second = runActorMovementDecisionPhase({ actions, state: { ...state, actor: second, zones: mapObj.zones, phaseSurvivors: [second] } }).actor;
    assert.equal(second.zoneId, 'b');
    runRouteFarmAction({ actions, state: { ...state, actor: second, fallbackRouteItemIds: ['raw'], goalMissingIds: ['raw'] } });
    assert.equal(invQty(second.inventory, 'raw'), 1);
    assert.equal(nextSpawn.fieldResources.byZone.a.raw.remaining, 0);
    assert.equal(nextSpawn.fieldResources.byZone.b.raw.remaining, 1);
    assert.equal(events.filter((event) => event.kind === 'resource_replan').length, 1);
    assert.equal(events.filter((event) => event.kind === 'field_resource').length, 2);
  });
  check('an impossible recipe switches equipment branches before wasting other local materials', () => {
    const other = { ...raw, _id: 'other' };
    const impossible = { ...target, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }, { itemId: 'other', qty: 1 }] } };
    const possible = { ...target, _id: 'alternative', equipSlot: 'arm', type: '팔', recipe: { ingredients: [{ itemId: 'other', qty: 1 }] } };
    const catalog = [raw, other, impossible, possible];
    const fieldResources = createFieldResources(mapObj, catalog, ruleset);
    collectFieldResourceLoot(fieldResources, loot(), () => 1); collectFieldResourceLoot(fieldResources, loot(2, 'b'), () => 2);
    const plan = buildActorGrowthPlan({ ...actor(), routePlanTargetItemIds: ['target', 'alternative'] }, catalog, { mapObj, zoneGraph, fieldResources });
    assert.equal(plan.targetId, 'alternative'); assert.equal(plan.targetZoneId, 'a');
    assert.equal(plan.openingComplete, false);
  });
  check('late-game material targeting also discards exhausted source hints', () => {
    const fieldResources = createFieldResources(mapObj, items, ruleset);
    collectFieldResourceLoot(fieldResources, loot(), () => 1);
    const targets = pickGoalResourceZoneTargets(mapObj, { fieldResources }, new Set(), [{ itemId: 'raw', name: raw.name }], { raw }, { raw: raw.name });
    assert.deepEqual(targets, ['b']);
  });
  check('general field loot and explicit route farming draw from the very same pool', () => {
    const nextSpawn = { fieldResources: createFieldResources(mapObj, items, ruleset) };
    const state = { mapObj, nextSpawn, ruleset, publicItems: items, craftables: [], itemNameById: {}, itemMetaById: {}, nextDay: 1, nextPhase: 'morning' };
    const first = actor(); refreshActorGrowthPlan(first, items, { ...state, zoneGraph });
    runFieldLootPhase({ state: { ...state, actor: first, didMove: true } });
    const second = actor('two');
    runRouteFarmAction({ state: { ...state, actor: second, fallbackRouteItemIds: ['raw'], goalMissingIds: ['raw'] } });
    assert.equal(invQty(first.inventory, 'raw'), 1); assert.equal(invQty(second.inventory, 'raw'), 0);
    assert.equal(summarizeFieldResources(nextSpawn.fieldResources).taken, 1);
  });
  check('facility water collection cannot bypass depleted field stock', () => {
    const water = { ...raw, _id: 'water', name: '물', spawnZones: [] };
    const waterMap = { ...mapObj, waterSourceZoneIds: ['a'], fieldResourceStock: { a: { water: 1 } } };
    const nextSpawn = { fieldResources: createFieldResources(waterMap, [water], ruleset) };
    const state = { mapObj: waterMap, nextSpawn, ruleset, publicItems: [water], nextDay: 1 };
    const first = actor(); const second = actor('two');
    runFacilityGatherPhase({ state: { ...state, actor: first } }); runFacilityGatherPhase({ state: { ...state, actor: second } });
    assert.equal(invQty(first.inventory, 'water'), 1); assert.equal(invQty(second.inventory, 'water'), 0);
  });
  check('zero stock and denied custom crates are respected without phantom sources', () => {
    const customItem = { ...raw, spawnZones: [] };
    const customMap = { ...mapObj, itemCrates: [{ zoneId: 'a', crateType: 'food', lootTable: [{ itemId: 'raw', weight: 1 }] }], crateAllowDeny: { a: ['food'] } };
    assert.equal(summarizeFieldResources(createFieldResources(customMap, [customItem], ruleset)).initial, 0);
    const zeroMap = { ...mapObj, fieldResourceStock: { a: { raw: 0 }, b: { raw: 0 } } };
    assert.equal(summarizeFieldResources(createFieldResources(zeroMap, items, ruleset)).initial, 0);
  });
  check('observer summaries count accepted supply and actual replans, not attempted searches', () => {
    const summary = buildRunActionSummary([{ kind: 'field_resource', qty: 2, depleted: true }, { kind: 'resource_replan' }, { kind: 'queue', chosen: 'routeFarm' }]);
    assert.deepEqual(summary.fieldResources, { pickups: 1, units: 2, depleted: 1, replans: 1 });
    assert.match(summary.fieldResourceLine, /2개/);
  });
} finally { Math.random = fixedRandom; }
console.log(`FIELD_RESOURCE_CHECKS ${checks}/${checks}`);
