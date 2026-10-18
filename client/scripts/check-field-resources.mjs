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
const { resolveActorNextMoveZone } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
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
  check('focused shared-field loot only selects positive live growth demand', () => {
    const incidental = { ...raw, _id: 'incidental-leaf', spawnZones: ['a'] };
    const wanted = { ...raw, _id: 'wanted-leaf', spawnZones: ['a'] };
    const zeroDemand = { ...raw, _id: 'zero-demand-leaf', spawnZones: ['a'] };
    const unavailableRare = { ...raw, _id: 'unavailable-rare', tier: 2, spawnZones: ['b'] };
    const catalog = [incidental, wanted, zeroDemand, unavailableRare];
    const stockMap = { ...mapObj, _id: 'focused-demand-stock', fieldResourceStock: { a: {
      [incidental._id]: 1, [wanted._id]: 1, [zeroDemand._id]: 1,
    } } };
    const resources = createFieldResources(stockMap, catalog, ruleset);
    const roll = (opts = {}) => rollFieldLoot(stockMap, 'a', catalog, ruleset,
      { fieldResources: resources, moved: true, ...opts });

    assert.equal(roll({ focusedGrowth: true,
      neededQtyById: { [wanted._id]: 1, [incidental._id]: 0, [zeroDemand._id]: 0 } })?.itemId, wanted._id,
    'A needed supply must remain selectable even when an unrelated catalog item comes first.');
    assert.equal(roll({ focusedGrowth: true,
      neededQtyById: { [unavailableRare._id]: 1 } }), null,
    'A blocked rare-material demand must not award an unrelated stocked item.');
    assert.equal(roll({ focusedGrowth: false, neededQtyById: { [wanted._id]: 1 } })?.itemId, incidental._id,
      'Unfocused growth keeps the prior incidental candidate pool.');
    assert.equal(roll({ focusedGrowth: true })?.itemId, incidental._id,
      'A focused call without a demand map keeps the prior incidental candidate pool.');
    assert.equal(roll({ focusedGrowth: true, neededQtyById: { [zeroDemand._id]: 0 } }), null,
      'Zero-quantity demand is not a candidate.');
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
  check('two actual teams reroute, pay a recipe, equip the goal, and fail closed without a source', () => {
    const paidRaw = { ...raw, _id: 'paid-raw', spawnZones: ['a', 'b'] };
    const paidTarget = { _id: 'paid-target', name: '유료 목표 장비', type: '머리', category: 'equipment', equipSlot: 'head', tier: 4,
      recipe: { ingredients: [{ itemId: paidRaw._id, qty: 1 }], creditsCost: 7 } };
    const paidItems = [paidRaw, paidTarget]; const paidMap = { ...mapObj, fieldResourceStock: { a: { [paidRaw._id]: 1 }, b: { [paidRaw._id]: 1 } } };
    const paidCraftables = [paidTarget], paidSpawn = { fieldResources: createFieldResources(paidMap, paidItems, ruleset) };
    const events = [];
    const paidActions = { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }), atNow: () => ({ sec: 20 }),
      applyLootCraftResult: (row, crafted, meta, at, zoneId) => applyLootCraftResult(row, crafted, meta,
        { at, zoneId, emitCraftRunEvent: (who, result, when, where) => events.push({ kind: 'craft', who,
          itemId: result.craftedId, zoneId: where, ...result.receipt }) }) };
    const paidState = { mapObj: paidMap, zoneGraph, nextSpawn: paidSpawn, ruleset, publicItems: paidItems,
      craftables: paidCraftables, itemNameById: { [paidRaw._id]: paidRaw.name }, itemMetaById: {}, nextDay: 1,
      nextPhase: 'morning', forbiddenIds: new Set() };
    const paidActor = (id) => ({ ...actor(id), teamId: id, routePlanTargetItemIds: [paidTarget._id], inventory: [],
      simCredits: 7, equipped: { head: null } });
    let firstTeam = paidActor('paid-team-one'); let secondTeam = paidActor('paid-team-two');
    for (const row of [firstTeam, secondTeam]) {
      assert.deepEqual(row.inventory, []);
      assert.equal(row.equipped.head, null);
      const authored = buildActorGrowthPlan(row, paidItems, paidState);
      assert.equal(authored.targetId, paidTarget._id);
      assert.deepEqual(authored.goalIssues, []);
    }
    refreshActorGrowthPlan(firstTeam, paidItems, paidState); refreshActorGrowthPlan(secondTeam, paidItems, paidState);
    runRouteFarmAction({ actions: paidActions, state: { ...paidState, actor: firstTeam,
      fallbackRouteItemIds: [paidRaw._id], goalMissingIds: [paidRaw._id] } });
    assert.equal(invQty(firstTeam.inventory, paidRaw._id), 0, 'The last local unit must be consumed by the real recipe.');
    assert.equal(invQty(firstTeam.inventory, paidTarget._id), 1);
    assert.equal(firstTeam.simCredits, 0);
    assert.equal(firstTeam.equipped.head, paidTarget._id);
    assert.equal(refreshActorGrowthPlan(firstTeam, paidItems, paidState).openingComplete, true);
    secondTeam = runActorMovementDecisionPhase({ actions: paidActions, state: { ...paidState, actor: secondTeam,
      zones: paidMap.zones, phaseSurvivors: [secondTeam] } }).actor;
    assert.equal(secondTeam.zoneId, 'b', 'The real movement executor must reroute to the alternative supply.');
    runRouteFarmAction({ actions: paidActions, state: { ...paidState, actor: secondTeam,
      fallbackRouteItemIds: [paidRaw._id], goalMissingIds: [paidRaw._id] } });
    assert.equal(invQty(secondTeam.inventory, paidRaw._id), 0);
    assert.equal(invQty(secondTeam.inventory, paidTarget._id), 1);
    assert.equal(secondTeam.simCredits, 0);
    assert.equal(secondTeam.equipped.head, paidTarget._id);
    assert.equal(refreshActorGrowthPlan(secondTeam, paidItems, paidState).openingComplete, true);
    assert.equal(paidSpawn.fieldResources.byZone.a[paidRaw._id].remaining, 0);
    assert.equal(paidSpawn.fieldResources.byZone.b[paidRaw._id].remaining, 0);
    assert.equal(events.filter((event) => event.kind === 'craft' && event.itemId === paidTarget._id).length, 2);
    assert.ok(events.filter((event) => event.kind === 'craft' && event.itemId === paidTarget._id)
      .every((event) => event.paidCost === 7 && event.afterCredits === 0));

    const exhausted = paidActor('paid-team-exhausted');
    const noSourceState = { ...paidState, actor: exhausted };
    refreshActorGrowthPlan(exhausted, paidItems, noSourceState);
    runRouteFarmAction({ actions: paidActions, state: { ...noSourceState,
      fallbackRouteItemIds: [paidRaw._id], goalMissingIds: [paidRaw._id] } });
    assert.equal(invQty(exhausted.inventory, paidRaw._id), 0);
    assert.equal(invQty(exhausted.inventory, paidTarget._id), 0);
    assert.equal(exhausted.simCredits, 7);
    assert.equal(exhausted.equipped.head, null);

    const blockedMap = { ...paidMap, _id: 'paid-blocked-path', fieldResourceStock: {
      a: { [paidRaw._id]: 0 }, b: { [paidRaw._id]: 1 } } };
    const blockedSpawn = { fieldResources: createFieldResources(blockedMap, paidItems, ruleset) };
    let blocked = paidActor('paid-team-forbidden');
    const blockedState = { ...paidState, mapObj: blockedMap, nextSpawn: blockedSpawn, actor: blocked, forbiddenIds: new Set(['b']) };
    refreshActorGrowthPlan(blocked, paidItems, blockedState);
    blocked = runActorMovementDecisionPhase({ actions: paidActions, state: { ...blockedState, zones: blockedMap.zones,
      phaseSurvivors: [blocked] } }).actor;
    assert.equal(blocked.zoneId, 'a');
    const beforeCraftCount = events.filter((event) => event.kind === 'craft').length;
    runRouteFarmAction({ actions: paidActions, state: { ...blockedState, actor: blocked,
      fallbackRouteItemIds: [paidRaw._id], goalMissingIds: [paidRaw._id] } });
    assert.equal(invQty(blocked.inventory, paidRaw._id), 0);
    assert.equal(invQty(blocked.inventory, paidTarget._id), 0);
    assert.equal(blocked.simCredits, 7);
    assert.equal(blocked.equipped.head, null);
    assert.equal(blockedSpawn.fieldResources.byZone.b[paidRaw._id].remaining, 1);
    assert.equal(events.filter((event) => event.kind === 'craft').length, beforeCraftCount);
  });
  check('voluntary, targeted and committed movement respect forbidden neighbors while escape remains active', () => {
    const traveler = { ...actor('movement-boundary'), day1Moves: 0 };
    const forbidden = new Set(['b']);
    const resolve = (overrides = {}) => resolveActorNextMoveZone({ state: { actor: traveler, currentZone: 'a',
      day: 2, phase: 'night', neighbors: ['b'], zoneGraph: { a: ['b'], b: ['a'], c: [] }, forbiddenIds: forbidden,
      ruleset, ...overrides } });
    assert.equal(resolve().nextZoneId, 'a', 'Voluntary wandering waits when every adjacent zone is forbidden.');
    assert.equal(resolve({ day: 1, phase: 'morning' }).nextZoneId, 'a', 'Forced first-morning movement also waits.');
    assert.equal(resolve({ neighbors: ['b', 'c'], zoneGraph: { a: ['b', 'c'], b: ['a'], c: [] } }).nextZoneId, 'c',
      'A safe adjacent zone remains available for ordinary movement.');
    assert.equal(resolve({ currentZone: 'b', neighbors: ['a'], mustEscape: true }).nextZoneId, 'a',
      'An actor already in a forbidden zone still attempts a safe escape.');
    assert.equal(resolve({ mustEscape: true, forbiddenIds: new Set(['a', 'b']) }).nextZoneId, 'b',
      'An actor trapped in forbidden zones retains the existing escape-step fallback.');
    assert.equal(resolve({ moveTargets: ['c'], zoneGraph: { a: ['b'], b: ['c'], c: [] } }).nextZoneId, 'a',
      'A planned route cannot cross a forbidden intermediate zone.');
    assert.equal(resolve({ committedNextStep: 'b' }).nextZoneId, 'a',
      'A committed step cannot bypass a forbidden destination.');
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
