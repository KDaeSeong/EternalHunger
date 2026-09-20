import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildActorGrowthPlan, refreshActorGrowthPlan, markGrowthComponent } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { addItemToInventory, normalizeInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { autoEquipBest } = await import('../src/app/simulation/_lib/gearFallbackRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { tryImmediateCraftFromSpecial } = await import('../src/app/simulation/_lib/gearImmediateSpecialCraftRuntime.js');
const { rollEarlyRouteLoot } = await import('../src/app/simulation/_lib/fieldRouteLootRuntime.js');
const { prepareInventoryForCraftLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { resolveActorNextMoveZone } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { runActorQueuedActionStep } = await import('../src/app/simulation/_lib/phaseActorQueuedActionStepRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { buildBaseZoneGraph, buildHyperloopZoneGraph } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');

let checks = 0;
const check = async (name, run) => { await run(); console.log(`PASS ${name}`); checks++; };
const ruleset = getRuleset('ER_S11');
const material = (id, spawnZones = ['a']) => ({ _id: id, name: id, type: '재료', category: 'material', tier: 1, spawnZones, recipe: { ingredients: [] } });
const gear = (id, ingredients, extra = {}) => ({ _id: id, name: id, category: 'equipment', type: '머리', equipSlot: 'head', tier: 2, recipe: { ingredients: ingredients.map((itemId) => ({ itemId, qty: 1 })) }, ...extra });
const fixtureItems = [material('raw'), material('far', ['c']), gear('left', ['raw']), gear('right', ['far']), gear('goal', ['left', 'right'], { tier: 4 })];
const world = { mapObj: { zones: ['a', 'b', 'c'].map((zoneId) => ({ zoneId, name: zoneId })) }, zoneGraph: { a: ['b'], b: ['a', 'c'], c: ['b'] }, forbiddenIds: new Set() };
const fixture = () => ({ _id: 'test', name: 'test', hp: 100, maxHp: 100, inventory: [], zoneId: 'a', routePlanTargetItemIds: ['goal'] });
const meta = buildItemMetaById(fixtureItems);
const names = buildItemNameById(fixtureItems);
const receive = (actor, id) => {
  const item = fixtureItems.find((row) => row._id === id);
  actor.inventory = addItemToInventory(actor.inventory, markGrowthComponent(item, actor), id, 1, 1, ruleset);
};

await check('completed intermediates replace their consumed leaf requirements', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left');
  const plan = refreshActorGrowthPlan(actor, fixtureItems, world);
  assert.deepEqual(plan.missing.map((row) => row.itemId), ['far']);
  assert.deepEqual(plan.craftIds, ['right', 'goal']);
  assert.equal(plan.targetZoneId, 'c'); assert.equal(plan.nextStep, 'b');
});
await check('two same-slot components survive normalization and are both consumed for the target', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world);
  receive(actor, 'left'); receive(actor, 'right');
  actor.inventory = normalizeInventory(actor.inventory, ruleset);
  assert.equal(actor.inventory.length, 2);
  assert.equal(refreshActorGrowthPlan(actor, fixtureItems, world).readyCraftId, 'goal');
  const crafted = tryAutoCraftFromInventory(actor, fixtureItems, names, meta, 1, 0, ruleset);
  assert.equal(crafted.craftedId, 'goal');
  assert.equal(invQty(actor.inventory, 'left'), 0); assert.equal(invQty(actor.inventory, 'right'), 0);
  assert.equal(actor.equipped.head, 'goal');
  assert.equal(refreshActorGrowthPlan(actor, fixtureItems, world).openingComplete, true);
});
await check('a required same-slot intermediate may be crafted beside another intermediate', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world);
  receive(actor, 'left'); receive(actor, 'far');
  refreshActorGrowthPlan(actor, fixtureItems, world);
  assert.equal(tryAutoCraftFromInventory(actor, fixtureItems, names, meta, 1, 0, ruleset).craftedId, 'right');
  assert.equal(invQty(actor.inventory, 'left'), 1);
});
await check('a chosen target replaces an unrelated same-tier item without discarding its ingredients', () => {
  const actor = fixture();
  actor.inventory = addItemToInventory([], gear('unrelated', [], { tier: 4 }), 'unrelated', 1, 1, ruleset);
  refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left'); receive(actor, 'right');
  refreshActorGrowthPlan(actor, fixtureItems, world);
  assert.equal(tryAutoCraftFromInventory(actor, fixtureItems, names, meta, 1, 0, ruleset).craftedId, 'goal');
  assert.equal(actor.equipped.head, 'goal'); assert.equal(invQty(actor.inventory, 'unrelated'), 0);
});
await check('farming holds its first-day position and only local ingredients enter its search queue', () => {
  const actor = fixture();
  const plan = refreshActorGrowthPlan(actor, fixtureItems, world);
  assert.deepEqual(plan.currentZoneItemIds, ['raw']);
  assert.equal(resolveActorNextMoveZone({ state: { actor, ...world, currentZone: 'a', moveTargets: ['a'], neighbors: ['b'], day: 1, phase: 'morning', preserveGrowthPosition: true, ruleset } }).nextZoneId, 'a');
  const queue = prepareActorPhaseActionPlan({ state: { actor, ...world, publicItems: fixtureItems, craftables: fixtureItems, itemMetaById: meta, itemNameById: names, ruleset, nextDay: 3, nextPhase: 'morning' } });
  assert.deepEqual(queue.fallbackRouteItemIds, ['raw']); assert.equal(queue.queuedActionType, 'routeFarm');
});
await check('a ready growth craft outranks further farming and preview leaves inventory and equipment untouched', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'raw');
  autoEquipBest(actor, meta); const equippedBefore = structuredClone(actor.equipped);
  const queue = prepareActorPhaseActionPlan({ state: { actor, ...world, publicItems: fixtureItems, craftables: fixtureItems, itemMetaById: meta, itemNameById: names, ruleset, nextDay: 1, nextPhase: 'morning' } });
  assert.equal(queue.queuedActionType, 'craft'); assert.equal(invQty(actor.inventory, 'raw'), 1);
  assert.deepEqual(actor.equipped, equippedBefore);
});
await check('a low-HP recovering actor queues truthful rest instead of a hunt that cannot start', () => {
  const actor = { ...fixture(), hp: 20, maxHp: 100 };
  const queue = prepareActorPhaseActionPlan({ state: {
    actor, ...world, publicItems: fixtureItems, craftables: fixtureItems,
    itemMetaById: meta, itemNameById: names, ruleset, nextDay: 2, nextPhase: 'morning', recovering: true,
  } });
  assert.equal(queue.queuedActionType, 'rest');
  assert.equal(queue.queuedAtomicAction.reason, 'low_hp_recovery');
  assert.deepEqual(queue.queueScoredCandidates, []);
  assert.ok(queue.blockedReasons.includes('recovering'));
  assert.ok(queue.candidatePreview.some((entry) => entry.startsWith('rest@')));
});
await check('resting neither reserves wildlife nor opens a field crate as a hidden second action', () => {
  const actor = { ...fixture(), hp: 20, maxHp: 100 };
  const nextSpawn = {
    wildlife: { a: 1 },
    wildlifeSpecies: { a: ['chicken'] },
    legendaryCrates: [{ zoneId: 'a', opened: false }],
  };
  const spawnBefore = structuredClone(nextSpawn);
  const events = [];
  const result = runActorQueuedActionStep({
    actor,
    actionPlan: {
      queuedActionType: 'rest', fallbackRouteItemIds: [], goalMissingIds: new Set(),
      queuedDroneOrder: null, queuedKioskAction: null,
    },
    movementResult: { didMove: false, recovering: true },
    state: {
      craftables: fixtureItems, itemMetaById: meta, itemNameById: names,
      mapObj: world.mapObj, nextDay: 2, nextPhase: 'morning', nextSpawn,
      phaseIdxNow: 4, publicItems: fixtureItems, recovering: true, ruleset,
    },
    actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }), atNow: () => ({ sec: 10 }) },
  });
  assert.deepEqual(nextSpawn, spawnBefore);
  assert.equal(result.actor._wildlifeHunt, undefined);
  assert.deepEqual(events.map((event) => event.kind), ['rest']);
  const summary = buildRunActionSummary([
    { kind: 'queue', chosen: 'rest' },
    { kind: 'action_cycle', chosen: 'rest' },
  ]);
  assert.equal(summary.restChosen, 1);
  assert.equal(summary.growth.rest, 1);
  assert.match(summary.growthLine, /안전 대기 1회/);
});
await check('forbidden paths are rejected; blocked targets replan to a reachable equipment branch', () => {
  const actor = fixture(); actor.zoneId = 'c';
  receive(actor, 'right');
  const blockedWorld = { ...world, forbiddenIds: new Set(['b']) };
  assert.equal(buildActorGrowthPlan(actor, fixtureItems, blockedWorld).blocked, 'no_safe_path');
  const items = [...fixtureItems, material('near', ['c']), gear('other', ['near'], { equipSlot: 'shoes' })];
  actor.routePlanTargetItemIds.push('other');
  assert.equal(buildActorGrowthPlan(actor, items, blockedWorld).targetId, 'other');
});
await check('nearest reachable material wins over alphabetically earlier distant material', () => {
  const items = [material('material', ['a', 'c']), gear('target', ['material'])];
  const actor = { ...fixture(), zoneId: 'd', routePlanTargetItemIds: ['target'] };
  const plan = buildActorGrowthPlan(actor, items, { mapObj: { zones: ['a', 'b', 'c', 'd'].map((zoneId) => ({ zoneId })) }, zoneGraph: { d: ['c'], c: ['d', 'b'], b: ['c', 'a'], a: ['b'] } });
  assert.equal(plan.targetZoneId, 'c');
});
await check('ready teammates regroup on day one without redirecting unfinished farmers', () => {
  const roster = [
    { ...fixture(), _id: 'ready', zoneId: 'a', teamId: 't', _growthPlan: { openingComplete: true } },
    { ...fixture(), _id: 'farmer', zoneId: 'b', teamId: 't', _growthPlan: { openingComplete: false } },
  ];
  const plans = buildTeamMovementPlans({ roster, ...world, day: 1, estimatePower: () => 10 });
  assert.equal(plans.get('ready').nextStep, 'b'); assert.equal(plans.has('farmer'), false);
});

await check('focused route search rejects materials from another region even if requested', () => {
  const result = rollEarlyRouteLoot({ curDay: 1, list: fixtureItems, mapObj: world.mapObj, zoneId: 'a',
    routeItemIds: new Set(['far']), opts: { focusedGrowth: true, routeFarm: true } });
  assert.equal(result.loot, null);
});
await check('full bags release unrelated material but preserve needed components and completed targets', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left');
  for (let i = 0; i < 9; i++) actor.inventory = addItemToInventory(actor.inventory, material(`spare${i}`), `spare${i}`, 1, 1, ruleset);
  assert.equal(actor.inventory.length, 10);
  const loot = { item: markGrowthComponent(fixtureItems.find((item) => item._id === 'far'), actor), itemId: 'far', qty: 1 };
  // Exercise the planner's space-making path separately from generic auto-drop.
  const strictBagRules = { ...ruleset, inventory: { ...ruleset.inventory, autoDropLowValue: false } };
  const room = prepareInventoryForCraftLoot(actor, loot, fixtureItems, strictBagRules);
  assert.ok(room.dropped.name.startsWith('spare')); assert.equal(invQty(room.inventory, 'left'), 1);
  const result = addItemToInventory(room.inventory, loot.item, loot.itemId, loot.qty, 1, strictBagRules);
  assert.equal(result.length, 10); assert.equal(invQty(result, 'far'), 1);
});
await check('duplicate branch quantities are counted and missing recipes cannot be declared complete', () => {
  const target = gear('twice', ['raw', 'raw']);
  const actor = { ...fixture(), routePlanTargetItemIds: ['twice'] };
  const items = [fixtureItems[0], target];
  refreshActorGrowthPlan(actor, items, world); receive(actor, 'raw');
  const plan = refreshActorGrowthPlan(actor, items, world);
  assert.equal(plan.missing[0].need, 1); assert.equal(plan.readyCraftId, '');
  assert.equal(tryAutoCraftFromInventory(actor, items, names, meta, 1, 0, ruleset), null);
  assert.equal(invQty(actor.inventory, 'raw'), 1);
  const cyclic = [gear('cycleA', ['cycleB']), gear('cycleB', ['cycleA'])];
  const invalid = buildActorGrowthPlan({ ...fixture(), routePlanTargetItemIds: ['cycleA'] }, cyclic, world);
  assert.equal(invalid.blocked, 'invalid_recipe'); assert.equal(invalid.openingComplete, false);
});
await check('special crafting requires and consumes the full catalog recipe, with no free combat bonus', async () => {
  const items = await loadGuestSimulationItemCatalog();
  const byId = new Map(items.map((item) => [item._id, item]));
  const target = items.find((item) => item.equipSlot === 'head' && item.tier === 5
    && item.recipe.ingredients.some((row) => byId.get(row.itemId)?.name === '미스릴') && item.recipe.ingredients.length > 1);
  assert.ok(target);
  const specialId = target.recipe.ingredients.find((row) => byId.get(row.itemId)?.name === '미스릴').itemId;
  const actor = { ...fixture(), routePlanTargetItemIds: [], _actionCycleKey: 'special:0' };
  const itemMetaById = buildItemMetaById(items); const itemNameById = buildItemNameById(items);
  actor.inventory = addItemToInventory([], byId.get(specialId), specialId, 1, 3, ruleset);
  const craft = () => tryImmediateCraftFromSpecial(actor, 'mithril', specialId, [target, ...items.filter((item) => !item.recipe.ingredients.length)], itemNameById, itemMetaById, 3, 'morning', 4, ruleset);
  const before = structuredClone(actor.inventory);
  assert.equal(craft().changed, false); assert.deepEqual(actor.inventory, before);
  for (const row of target.recipe.ingredients) if (row.itemId !== specialId) actor.inventory = addItemToInventory(actor.inventory, byId.get(row.itemId), row.itemId, row.qty, 3, ruleset);
  actor._actionCycleKey = 'special:20';
  const result = craft();
  assert.equal(result.craftedId, target._id); assert.equal(result.pvpBonus, 0);
  for (const row of target.recipe.ingredients) assert.equal(invQty(actor.inventory, row.itemId), 0);
  assert.equal(actor.equipped.head, target._id);
});

await check('24 canonical actors autonomously complete equipment in a safe training world', async () => {
  const random = Math.random; const initialSeed = Number(process.env.EH_GROWTH_SEED || 1101); let seed = initialSeed;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try {
    const items = await loadGuestSimulationItemCatalog();
    const mapObj = buildGuestSimulationMap(); const settings = getDefaultSimulationSettings();
    const zoneGraph = buildHyperloopZoneGraph(buildBaseZoneGraph(mapObj, mapObj.zones), mapObj.zones, mapObj.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId));
    const { shuffledChars } = buildInitialSimulationRoster({ charList: buildGuestSimulationRoster(), routeItems: items, initialMap: mapObj, initialZoneIds: mapObj.zones.map((zone) => zone.zoneId), loadedSettings: settings });
    const itemMetaById = buildItemMetaById(items); const itemNameById = buildItemNameById(items); const itemKeyById = buildItemKeyById(items);
    // Growth-only control: same team, no PvP/hazards/spawns. Never teleport, refill,
    // bypass capacity, or grant equipment. Full competitive matches are tested separately.
    let actors = shuffledChars.map((actor) => ({ ...actor, teamId: 'training', _itemKeyById: itemKeyById }));
    const completed = new Map(); let crafts = 0; let moves = 0;
    const nextSpawn = { fieldResources: createFieldResources(mapObj, items, ruleset) };
    const actions = { emitCraftRunEvent: () => { crafts++; }, emitRunEvent: (kind) => { if (kind === 'move') moves++; },
      applyLootCraftResult: (actor, result) => applyLootCraftResult(actor, result, itemMetaById, { emitCraftRunEvent: () => { crafts++; } }),
    };
    for (let cycle = 0; cycle < 100 && completed.size < 24; cycle++) {
      const phaseIdxNow = Math.floor(cycle / 7);
      actors = runPhaseActorActionPipeline({ actions, state: {
        phaseSurvivors: actors, publicItems: items, craftables: buildCraftableItems(items), itemMetaById, itemNameById, itemKeyById,
        mapObj, zones: mapObj.zones, zoneGraph, forbiddenIds: new Set(), ruleset,
        nextDay: Math.floor(phaseIdxNow / 2) + 1, nextPhase: phaseIdxNow % 2 ? 'night' : 'morning', phaseIdxNow,
        actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => cycle * 20, nextSpawn,
      } }).updatedSurvivors;
      for (const actor of actors) if (refreshActorGrowthPlan(actor, items, { mapObj, zoneGraph, nextSpawn }).openingComplete && !completed.has(actor._id)) completed.set(actor._id, cycle * 20);
    }
    const pending = actors.filter((actor) => !completed.has(actor._id)).map((actor) => ({ name: actor.name, weapon: actor.weaponType, zone: actor.zoneId, plan: actor._growthPlan, inventory: actor.inventory.map((row) => ({ name: row.name, qty: row.qty, component: row.craftComponent })) }));
    console.log(JSON.stringify({ seed: initialSeed, training: true, complete: completed.size, total: 24, crafts, moves, completionSec: [...completed.values()].sort((a, b) => a - b), pending }, null, 2));
    assert.equal(completed.size, 24, 'All unharmed training actors must finish their actual equipment targets without grants.');
  } finally { Math.random = random; }
});
console.log(`GROWTH_PLAN_CHECKS ${checks}/${checks}`);
