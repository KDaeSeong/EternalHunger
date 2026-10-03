import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildActorGrowthPlan, refreshActorGrowthPlan, getActorGrowthProgress, markGrowthComponent } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
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
const { buildBaseZoneGraph, buildHyperloopZoneGraph, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { buildDay1TargetCandidatesBySlot, buildItemIndexes } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');

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

await check('missing opening targets remain incomplete even when every known target is owned', () => {
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'deleted-body-goal', 'deleted-body-goal'] };
  receive(actor, 'goal');
  const before = JSON.stringify(actor);
  const progress = getActorGrowthProgress(actor, fixtureItems);
  assert.equal(progress.completedSlots, 1); assert.equal(progress.totalSlots, 2);
  assert.equal(progress.openingComplete, false); assert.deepEqual(progress.remaining, []);
  assert.deepEqual(progress.goalIssues.map(({ itemId, reason }) => [itemId, reason]), [['deleted-body-goal', 'missing_target']]);
  const plan = buildActorGrowthPlan(actor, fixtureItems, world);
  assert.equal(plan.openingComplete, false); assert.equal(plan.blocked, 'invalid_target');
  assert.deepEqual(plan.targetIds, ['goal', 'deleted-body-goal']);
  assert.equal(JSON.stringify(actor), before);
  assert.deepEqual(getActorGrowthProgress(JSON.parse(before), fixtureItems), progress);
});

await check('an empty catalog cannot erase declared demand, and genuinely unset goals remain unset', () => {
  const actor = { ...fixture(), routePlanTargetItemIds: ['missing', 'missing', ''] };
  const progress = getActorGrowthProgress(actor, []);
  assert.equal(progress.completedSlots, 0); assert.equal(progress.totalSlots, 1);
  assert.equal(progress.openingComplete, false);
  assert.equal(buildActorGrowthPlan(actor, [], world).blocked, 'invalid_target');
  assert.equal(getActorGrowthProgress({ ...fixture(), routePlanTargetItemIds: [] }, []).totalSlots, 0);
  assert.equal(buildActorGrowthPlan({ ...fixture(), routePlanTargetItemIds: [] }, [], world), null);
});

await check('valid opening recipes still finish and pay their full costs beside a missing target', () => {
  const items = fixtureItems.map((item) => item._id === 'goal'
    ? { ...item, recipe: { ...item.recipe, creditsCost: 7 } } : item);
  const actor = { ...fixture(), simCredits: 20, routePlanTargetItemIds: ['goal', 'missing'] };
  const initial = refreshActorGrowthPlan(actor, items, world);
  assert.equal(initial.targetId, 'goal'); assert.equal(initial.goalIssues[0].itemId, 'missing');
  receive(actor, 'left'); receive(actor, 'right'); refreshActorGrowthPlan(actor, items, world);
  const result = tryAutoCraftFromInventory(actor, items, buildItemNameById(items), buildItemMetaById(items), 1, 0, ruleset);
  assert.equal(result?.craftedId, 'goal'); assert.equal(actor.simCredits, 13);
  assert.equal(invQty(actor.inventory, 'left'), 0); assert.equal(invQty(actor.inventory, 'right'), 0);
  const final = refreshActorGrowthPlan(actor, items, world);
  assert.equal(final.completedSlots, 1); assert.equal(final.totalSlots, 2);
  assert.equal(final.openingComplete, false); assert.equal(final.blocked, 'invalid_target');
});

await check('real recovery recipes fill empty gear without pretending a missing authored goal was completed', () => {
  const target = gear('recovery', ['raw'], { tier: 4, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], creditsCost: 5 } });
  const items = [material('raw'), target];
  const actor = { ...fixture(), simCredits: 20, routePlanTargetItemIds: ['missing'], goalLoadouts: { hero: { clothesKey: 'missing' } } };
  receive(actor, 'raw');
  const plan = refreshActorGrowthPlan(actor, items, world);
  assert.equal(plan.stage, 'recovery'); assert.equal(plan.readyCraftId, 'recovery');
  assert.equal(plan.openingComplete, false); assert.equal(plan.goalIssues[0].slot, 'clothes');
  assert.equal(tryAutoCraftFromInventory(actor, items, buildItemNameById(items), buildItemMetaById(items), 1, 0, ruleset)?.craftedId, 'recovery');
  assert.equal(invQty(actor.inventory, 'raw'), 0); assert.equal(actor.simCredits, 15);
  assert.equal(actor.equipped.head, 'recovery');
  const progress = getActorGrowthProgress(actor, items);
  assert.equal(progress.completedSlots, 0); assert.equal(progress.totalSlots, 1); assert.equal(progress.openingComplete, false);
});

await check('automatic route substitutes cannot fulfill an unresolved authored opening key', () => {
  const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
  const items = [material('raw'), ...slots.map((slot) => gear(`fallback-${slot}`, ['raw'], { equipSlot: slot, tier: 4 }))];
  const actor = { ...fixture(), goalLoadouts: { hero: { headKey: 'custom-head-key' } } };
  const candidates = buildDay1TargetCandidatesBySlot(actor, items, buildItemIndexes(items), world.mapObj);
  actor.routePlanTargetItemIds = slots.map((slot) => candidates.get(slot)[0].item._id);
  actor.inventory = items.slice(1).map((item) => ({ ...item, itemId: item._id, qty: 1 }));
  const progress = getActorGrowthProgress(actor, items);
  assert.equal(progress.completedSlots, 4); assert.equal(progress.totalSlots, 5); assert.equal(progress.openingComplete, false);
  assert.equal(progress.goalIssues[0].key, 'custom-head-key'); assert.equal(progress.goalIssues[0].slot, 'head');
  assert.equal(buildActorGrowthPlan(actor, items, world).blocked, 'invalid_target');
  const restored = [...items, gear('custom-head-id', ['raw'], { itemKey: 'custom-head-key', tier: 4 })];
  const unresolved = getActorGrowthProgress(actor, restored);
  assert.equal(unresolved.totalSlots, 5); assert.equal(unresolved.completedSlots, 4);
  assert.deepEqual(unresolved.goalIssues, []); assert.equal(unresolved.remaining[0]._id, 'custom-head-id');
  actor.inventory = [...actor.inventory.filter((item) => item.equipSlot !== 'head'), { ...restored.at(-1), itemId: 'custom-head-id', qty: 1 }];
  assert.equal(getActorGrowthProgress(actor, restored).openingComplete, true);
});

await check('authored keys resolve all supported aliases without double-counting route targets', () => {
  const item = gear('owned-id', ['raw'], { itemKey: 'owned-key', externalId: 'owned-external', tier: 4 });
  for (const key of ['owned-id', 'owned-key', 'owned-external']) {
    const actor = { ...fixture(), routePlanTargetItemIds: ['owned-id'], goalLoadouts: { hero: { headKey: key } },
      inventory: [{ ...item, itemId: item._id, qty: 1 }] };
    const progress = getActorGrowthProgress(actor, [material('raw'), item]);
    assert.equal(progress.totalSlots, 1); assert.equal(progress.completedSlots, 1); assert.equal(progress.openingComplete, true);
    assert.deepEqual(progress.targetIds, ['owned-id']); assert.deepEqual(progress.goalIssues, []);
  }
});

await check('wrong-slot duplicate declarations keep the valid slot and flag the other slot', () => {
  const item = gear('owned-id', ['raw'], { itemKey: 'same-key', tier: 4 });
  const actor = { ...fixture(), routePlanTargetItemIds: ['owned-id'],
    goalLoadouts: { hero: { headKey: 'same-key', clothesKey: 'same-key' } }, inventory: [{ ...item, itemId: item._id, qty: 1 }] };
  const progress = getActorGrowthProgress(actor, [material('raw'), item]);
  assert.equal(progress.totalSlots, 2); assert.equal(progress.completedSlots, 1); assert.equal(progress.openingComplete, false);
  assert.deepEqual(progress.goalIssues.map(({ slot, reason }) => [slot, reason]), [['clothes', 'slot_mismatch']]);
});

await check('owned deleted, generated, non-equipment and incompatible targets cannot count as fulfilled', () => {
  const cases = [
    [gear('deleted', ['raw'], { lockedByAdmin: 'deleted' }), 'unavailable_target'],
    [gear('eq_generated', ['raw']), 'unavailable_target'],
    [material('not-gear'), 'not_equipment'],
    [gear('bad-slot', ['raw'], { equipSlot: 'body' }), 'not_equipment'],
    [gear('wrong-weapon', ['raw'], { equipSlot: 'weapon', weaponType: '활' }), 'weapon_mismatch'],
  ];
  for (const [item, reason] of cases) {
    const actor = { ...fixture(), weaponType: '권총', routePlanTargetItemIds: [item._id], inventory: [{ ...item, itemId: item._id, qty: 1 }] };
    const progress = getActorGrowthProgress(actor, [material('raw'), item]);
    assert.equal(progress.completedSlots, 0, reason); assert.equal(progress.totalSlots, 1, reason);
    assert.equal(progress.openingComplete, false, reason); assert.equal(progress.goalIssues[0].reason, reason);
  }
});

await check('production growth events retain unresolved declarations instead of publishing completion', () => {
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'missing'] };
  receive(actor, 'goal');
  const events = [];
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: [actor], ...world,
    publicItems: fixtureItems, craftables: fixtureItems, itemMetaById: meta, itemNameById: names,
    ruleset, nextDay: 1, nextPhase: 'morning', actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 10 },
  actions: { emitRunEvent: (kind, event) => events.push({ kind, ...event }) } });
  const event = events.find((entry) => entry.kind === 'growth_plan');
  assert.ok(event); assert.equal(event.openingComplete, false);
  assert.equal(event.completedSlots, 1); assert.equal(event.totalSlots, 2);
  assert.deepEqual(event.goalIssues.map(({ itemId, reason }) => [itemId, reason]), [['missing', 'missing_target']]);
  assert.notEqual(event.goalIssues, result.updatedSurvivors[0]._growthPlan.goalIssues);
  assert.equal(result.updatedSurvivors[0]._growthReadyAtSec, 30, 'No actual opening recipe remains; keep the normal twenty-second cadence.');
  assert.equal(events.find((entry) => entry.kind === 'action_cycle').intervalSec, 20);
});

await check('a missing-only goal cannot suppress an otherwise ready shared boss action', () => {
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'missing'] };
  receive(actor, 'goal');
  const queue = prepareActorPhaseActionPlan({ state: { actor, ...world, publicItems: fixtureItems, craftables: fixtureItems,
    itemMetaById: meta, itemNameById: names, ruleset, nextDay: 2, nextPhase: 'night',
    movementObjective: { type: 'boss', targetZoneId: 'a', beneficiary: actor._id } } });
  assert.equal(queue.queuedActionType, 'hunt');
  assert.match(queue.queueScoredCandidates.find((entry) => entry.type === 'hunt').priorityNote, /team_boss/);
  assert.equal(actor._growthPlan.blocked, 'invalid_target'); assert.equal(actor._growthPlan.openingComplete, false);
});

await check('a valid selected recipe keeps its one-second action beside an unresolved declaration', () => {
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'missing'] };
  refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left'); receive(actor, 'right');
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: [actor], ...world, publicItems: fixtureItems,
    craftables: fixtureItems, itemMetaById: meta, itemNameById: names, ruleset, nextDay: 2, nextPhase: 'night',
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 10 } });
  const crafted = result.updatedSurvivors[0];
  assert.equal(crafted.equipped.head, 'goal'); assert.equal(crafted._growthReadyAtSec, 11);
  assert.equal(getActorGrowthProgress(crafted, fixtureItems).openingComplete, false);
  assert.equal(invQty(crafted.inventory, 'left'), 0); assert.equal(invQty(crafted.inventory, 'right'), 0);
});

await check('completed intermediates replace their consumed leaf requirements', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left');
  const plan = refreshActorGrowthPlan(actor, fixtureItems, world);
  assert.deepEqual(plan.missing.map((row) => row.itemId), ['far']);
  assert.deepEqual(plan.craftIds, ['right', 'goal']);
  assert.equal(plan.targetZoneId, 'c'); assert.equal(plan.nextStep, 'b');
});
await check('a viable opening focus survives an equipped intermediate and finishes before another empty slot', () => {
  const items = [...fixtureItems, material('body-raw'), gear('body-goal', ['body-raw'], { equipSlot: 'clothes', tier: 4 })];
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'body-goal'] };
  assert.equal(refreshActorGrowthPlan(actor, items, world).targetId, 'goal');
  receive(actor, 'left'); actor.equipped = { head: 'left' };
  assert.equal(refreshActorGrowthPlan(actor, items, world).targetId, 'goal');
  receive(actor, 'right'); refreshActorGrowthPlan(actor, items, world);
  assert.equal(tryAutoCraftFromInventory(actor, items, buildItemNameById(items), buildItemMetaById(items), 1, 0, ruleset)?.craftedId, 'goal');
  assert.equal(refreshActorGrowthPlan(actor, items, world).targetId, 'body-goal');
});
await check('a depleted or explicitly attempted focus releases the opening plan instead of becoming a sticky dead end', () => {
  const items = [...fixtureItems, material('body-raw'), gear('body-goal', ['body-raw'], { equipSlot: 'clothes', tier: 4 })];
  const actor = { ...fixture(), routePlanTargetItemIds: ['goal', 'body-goal'] };
  refreshActorGrowthPlan(actor, items, world);
  const fieldResources = createFieldResources(world.mapObj, items, ruleset);
  fieldResources.byZone.c.far.remaining = 0;
  assert.equal(refreshActorGrowthPlan(actor, items, { ...world, fieldResources }).targetId, 'body-goal');
  actor._growthFocusId = 'goal';
  assert.equal(buildActorGrowthPlan(actor, items, { ...world, attemptedTargets: ['goal'] }).targetId, 'body-goal');
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
await check('a one-second opening craft locks only its own next action, not twenty seconds of growth or world time', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left'); receive(actor, 'right');
  let sec = 10; const cycles = [];
  const result = runPhaseActorActionPipeline({ state: {
    phaseSurvivors: [actor], ...world, publicItems: fixtureItems, craftables: fixtureItems,
    itemMetaById: meta, itemNameById: names, ruleset, nextDay: 1, nextPhase: 'morning',
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => sec,
  }, actions: { emitRunEvent: (kind, event) => { if (kind === 'action_cycle') cycles.push(event); } } });
  const crafted = result.updatedSurvivors[0];
  assert.equal(crafted.equipped.head, 'goal');
  assert.equal(crafted._actionReadyAtSec, 11); assert.equal(crafted._growthReadyAtSec, 11);
  assert.equal(cycles[0].intervalSec, 1); assert.equal(sec, 10);
  sec = 10.5;
  const held = runPhaseActorActionPipeline({ state: { phaseSurvivors: [crafted], actionIntervalSec: 20,
    statusElapsedSec: 0, currentActionSec: () => sec }, actions: {
    emitRunEvent: (kind) => { if (kind === 'action_cycle') assert.fail('Still crafting.'); },
  } });
  assert.equal(held.updatedSurvivors[0]._actionReadyAtSec, 11);
});
await check('an opening move pays its real travel time, while a longer action lock cannot be overwritten', () => {
  const actor = fixture(); refreshActorGrowthPlan(actor, fixtureItems, world); receive(actor, 'left');
  const state = { phaseSurvivors: [actor], ...world, publicItems: fixtureItems, craftables: fixtureItems,
    itemMetaById: meta, itemNameById: names, ruleset, nextDay: 1, nextPhase: 'morning',
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 10 };
  const moved = runPhaseActorActionPipeline({ state, actions: { isHyperloopTransit: () => true } }).updatedSurvivors[0];
  assert.equal(moved.aiCurrentAction, 'moveTo'); assert.equal(moved._growthReadyAtSec, 13);
  assert.equal(moved._actionReadyAtSec, 13);
  const crafter = fixture(); refreshActorGrowthPlan(crafter, fixtureItems, world); receive(crafter, 'left'); receive(crafter, 'right');
  const locked = runPhaseActorActionPipeline({ state: { ...state, phaseSurvivors: [crafter] }, actions: {
    emitQueueRunEvent: (who) => { who._actionReadyAtSec = 15; },
  } }).updatedSurvivors[0];
  assert.equal(locked._actionReadyAtSec, 15); assert.equal(locked._growthReadyAtSec, 15);
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
await check('focused growth can gather a required consumable ingredient without changing its category or effect', () => {
  const dose = { ...material('dose'), type: '소모품', category: 'consumable', name: '제작용 회복약',
    consumeEffect: { version: 1, heal: 25, satiety: 0 } };
  const target = gear('medical-gear', ['dose']);
  const items = [dose, target];
  const who = { ...fixture(), routePlanTargetItemIds: ['medical-gear'] };
  const plan = refreshActorGrowthPlan(who, items, world);
  assert.deepEqual(plan.currentZoneItemIds, ['dose']);
  const resources = createFieldResources(world.mapObj, items, ruleset);
  const options = { curDay: 1, list: items, mapObj: world.mapObj, zoneId: 'a',
    routeItemIds: new Set(plan.currentZoneItemIds),
    opts: { focusedGrowth: true, routeFarm: true, fieldResources: resources, neededQtyById: { dose: 1 } } };
  const loot = rollEarlyRouteLoot(options).loot;
  assert.equal(loot?.itemId, 'dose');
  assert.equal(loot.qty, 1);
  assert.deepEqual(loot.item.consumeEffect, dose.consumeEffect);
  who.inventory = addItemToInventory([], markGrowthComponent(loot.item, who), loot.itemId, loot.qty, 1, ruleset);
  assert.equal(who.inventory[0].category, 'consumable');
  const itemMeta = buildItemMetaById(items);
  refreshActorGrowthPlan(who, items, world);
  assert.equal(tryAutoCraftFromInventory(who, items, buildItemNameById(items), itemMeta, 1, 0, ruleset)?.craftedId, 'medical-gear');
  assert.equal(invQty(who.inventory, 'dose'), 0);
  assert.equal(who.equipped.head, 'medical-gear');
  assert.equal(rollEarlyRouteLoot({ ...options, routeItemIds: new Set(['unrequested']) }).loot, null);
  resources.byZone.a.dose.remaining = 0;
  assert.equal(rollEarlyRouteLoot(options).loot, null, 'depleted ingredients cannot be granted');
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

await check('24 canonical actors complete real equipment before the first night ends in a safe training world', async () => {
  const random = Math.random; const initialSeed = Number(process.env.EH_GROWTH_SEED || 1101); let seed = initialSeed;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try {
    const items = await loadGuestSimulationItemCatalog();
    const mapObj = buildGuestSimulationMap(); const settings = getDefaultSimulationSettings();
    const baseGraph = buildBaseZoneGraph(mapObj, mapObj.zones);
    const loops = mapObj.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId);
    const zoneGraph = buildHyperloopZoneGraph(baseGraph, mapObj.zones, loops);
    const { shuffledChars } = buildInitialSimulationRoster({ charList: buildGuestSimulationRoster(), routeItems: items, initialMap: mapObj, initialZoneIds: mapObj.zones.map((zone) => zone.zoneId), loadedSettings: settings });
    const itemMetaById = buildItemMetaById(items); const itemNameById = buildItemNameById(items); const itemKeyById = buildItemKeyById(items);
    // Growth-only control: same team, no PvP/hazards/spawns. Never teleport, refill,
    // bypass capacity, or grant equipment. Full competitive matches are tested separately.
    let actors = shuffledChars.map((actor) => ({ ...actor, teamId: 'training', _itemKeyById: itemKeyById }));
    const completed = new Map(); let crafts = 0; let moves = 0;
    const nextSpawn = { fieldResources: createFieldResources(mapObj, items, ruleset) };
    const actions = { emitCraftRunEvent: () => { crafts++; }, emitRunEvent: (kind) => { if (kind === 'move') moves++; },
      isHyperloopTransit: (from, to) => isHyperloopTransit(baseGraph, loops, from, to),
      applyLootCraftResult: (actor, result) => applyLootCraftResult(actor, result, itemMetaById, { emitCraftRunEvent: () => { crafts++; } }),
    };
    const morningEndSec = getPhaseDurationSec(ruleset, 1, 'morning');
    const firstDayEndSec = morningEndSec + getPhaseDurationSec(ruleset, 1, 'night');
    const timeline = createPhaseActionTimeline({ durationSec: firstDayEndSec, intervalSec: 1, onGrowth: (sec) => {
      if (completed.size === 24) return;
      const phaseIdxNow = sec < morningEndSec ? 0 : 1;
      actors = runPhaseActorActionPipeline({ actions, state: {
        phaseSurvivors: actors, publicItems: items, craftables: buildCraftableItems(items), itemMetaById, itemNameById, itemKeyById,
        mapObj, zones: mapObj.zones, zoneGraph, forbiddenIds: new Set(), ruleset,
        nextDay: Math.floor(phaseIdxNow / 2) + 1, nextPhase: phaseIdxNow % 2 ? 'night' : 'morning', phaseIdxNow,
        actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => sec, nextSpawn,
      } }).updatedSurvivors;
      for (const actor of actors) if (refreshActorGrowthPlan(actor, items, { mapObj, zoneGraph, nextSpawn, ruleset }).openingComplete && !completed.has(actor._id)) completed.set(actor._id, sec);
    } });
    timeline.advanceTo(firstDayEndSec);
    const pending = actors.filter((actor) => !completed.has(actor._id)).map((actor) => ({ name: actor.name, weapon: actor.weaponType, zone: actor.zoneId, plan: actor._growthPlan, inventory: actor.inventory.map((row) => ({ name: row.name, qty: row.qty, component: row.craftComponent })) }));
    console.log(JSON.stringify({ seed: initialSeed, training: true, firstDayEndSec, complete: completed.size, total: 24, crafts, moves, completionSec: [...completed.values()].sort((a, b) => a - b), pending }, null, 2));
    assert.equal(completed.size, 24, 'All unharmed training actors must finish actual targets before the first night ends, without grants.');
  } finally { Math.random = random; }
});
console.log(`GROWTH_PLAN_CHECKS ${checks}/${checks}`);
