import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildActorGrowthPlan, refreshActorGrowthPlan, getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { getActorGrowthObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { invQty, addItemToInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { prepareCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { createFieldResources, collectFieldResourceLoot, getFieldResourceQty } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');

// Fresh controlled inputs, not the evaluator's missing match or past artifacts.
const material = (id) => ({ _id: id, name: id, type: '재료', category: 'material', tier: 4, spawnZones: ['school'] });
const gear = (id, slot, ingredients, cost = 0) => ({ _id: id, name: id, type: '방어구', category: 'equipment',
  equipSlot: slot, tier: 4, recipe: { ingredients: ingredients.map((itemId) => ({ itemId, qty: 1 })), creditsCost: cost } });
const items = [material('a'), material('b'), material('c'), gear('head-goal', 'head', ['a'], 10),
  gear('clothes-goal', 'clothes', ['b', 'c'], 25)];
const names = Object.fromEntries(items.map((item) => [item._id, item.name]));
const meta = Object.fromEntries(items.map((item) => [item._id, item]));
const ruleset = { inventory: { maxSlots: 10 } };
const world = { mapObj: { zones: [{ zoneId: 'school', name: '학교' }] }, zoneGraph: { school: [] }, ruleset };
const row = (item, qty = 1) => ({ ...structuredClone(item), itemId: item._id, qty });
const fixture = () => ({ _id: 'capacity-case', name: 'capacity-case', hp: 115, maxHp: 115, simCredits: 625, zoneId: 'school',
  _actionCycleKey: '5:0', _growthFocusId: 'head-goal', routePlanTargetItemIds: ['head-goal', 'clothes-goal'],
  equipped: { weapon: 'starter', shoes: 'tights', head: null, clothes: null, arm: null },
  inventory: [row(gear('starter', 'weapon', [])), row(gear('tights', 'shoes', [])), row(items[0], 2), row(items[1]), row(items[2]),
    ...Array.from({ length: 5 }, (_, i) => row(material(`protected-${i}`)))],
});
const craft = (who, catalog = items, rules = ruleset) => tryAutoCraftFromInventory(who, catalog, names, meta, 5, 8, rules);
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

check('a capacity-blocked focus switches to another planned slot that can actually craft', () => {
  const who = fixture();
  const before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, items, world);
  assert.equal(plan.targetId, 'clothes-goal');
  assert.equal(plan.readyCraftId, 'clothes-goal');
  assert.deepEqual(who, before, 'Planning must not pay, drop, craft or equip.');
  refreshActorGrowthPlan(who, items, world);
  assert.equal(craft(who)?.craftedId, 'clothes-goal');
  assert.equal(who.equipped.clothes, 'clothes-goal');
  assert.equal(who.inventory.length, 9);
  assert.equal(invQty(who.inventory, 'b'), 0); assert.equal(invQty(who.inventory, 'c'), 0);
  assert.equal(who.simCredits, 600);
  who._actionCycleKey = '5:1';
  assert.equal(refreshActorGrowthPlan(who, items, world).targetId, 'head-goal');
  assert.equal(craft(who)?.craftedId, 'head-goal');
  assert.equal(who.equipped.head, 'head-goal'); assert.equal(who.simCredits, 590);
  assert.equal(invQty(who.inventory, 'a'), 1);
  assert.equal(who.inventory.length, 10);
  for (let i = 0; i < 5; i++) assert.equal(invQty(who.inventory, `protected-${i}`), 1);
});
check('a full bag is not blocked when consuming ingredients makes an output slot', () => {
  const who = fixture(); who.inventory.find((item) => item.itemId === 'a').qty = 1;
  assert.equal(refreshActorGrowthPlan(who, items, world).targetId, 'head-goal');
  assert.equal(craft(who)?.craftedId, 'head-goal');
  assert.equal(who.inventory.length, 10);
});
check('unavoidable capacity failure preserves items and credits and is explained honestly', () => {
  const who = fixture(); who.routePlanTargetItemIds = ['head-goal'];
  // Other obtainable recipes now provide a legitimate escape from a full bag.
  // Isolate this capacity case from the separate clothes recipe.
  const catalog = items.filter((item) => item._id !== 'clothes-goal');
  const plan = refreshActorGrowthPlan(who, catalog, world);
  assert.equal(plan.blocked, 'inventory_full'); assert.equal(plan.readyCraftId, '');
  const before = structuredClone({ inventory: who.inventory, credits: who.simCredits, equipped: who.equipped });
  assert.equal(craft(who, catalog), null);
  assert.deepEqual({ inventory: who.inventory, credits: who.simCredits, equipped: who.equipped }, before);
  const observation = getActorGrowthObservation(who, catalog, { ruleset });
  assert.match(observation.materials, /공간 부족/);
  assert.doesNotMatch(observation.materials, /제작 가능/);
});
check('custom inventory capacity is carried through replanning rather than assuming ten slots', () => {
  const who = fixture(); const rules = { inventory: { maxSlots: 11 } };
  assert.equal(refreshActorGrowthPlan(who, items, { ...world, ruleset: rules }).targetId, 'head-goal');
  assert.equal(craft(who, items, rules)?.craftedId, 'head-goal');
  assert.equal(who.inventory.length, 11);
});
check('another ready component in the same recipe may make space without abandoning the goal', () => {
  const first = gear('left', 'head', ['a']);
  const second = gear('right', 'clothes', ['b', 'c']);
  const target = gear('final', 'head', ['left', 'right']);
  const catalog = [...items.slice(0, 3), first, second, target];
  const who = fixture(); who.routePlanTargetItemIds = ['final']; who._growthFocusId = 'final';
  const plan = refreshActorGrowthPlan(who, catalog, world);
  assert.equal(plan.targetId, 'final'); assert.equal(plan.readyCraftId, 'right');
  assert.equal(plan.blocked, '');
  assert.match(getActorGrowthObservation(who, catalog, { ruleset }).materials, /제작 가능/);
  assert.equal(craft(who, catalog)?.craftedId, 'right');
  assert.equal(who.inventory.length, 9);
  assert.equal(invQty(who.inventory, 'a'), 2);
});
check('capacity replanning still respects the cost of an alternative recipe', () => {
  const who = fixture(); who.simCredits = 10;
  const before = structuredClone(who.inventory);
  const plan = refreshActorGrowthPlan(who, items, world);
  assert.equal(plan.blocked, 'insufficient_credits');
  assert.equal(plan.readyCraftId, '');
  assert.equal(craft(who), null); assert.equal(who.simCredits, 10);
  assert.deepEqual(who.inventory.map(({ itemId, qty }) => ({ itemId, qty })), before.map(({ itemId, qty }) => ({ itemId, qty })));
});
check('failed first choices preserve the custom capacity when trying later targets', () => {
  const who = fixture(); who.inventory.push(row(material('extra-protected')));
  const rules = { inventory: { maxSlots: 11 } };
  const plan = refreshActorGrowthPlan(who, items, { ...world, ruleset: rules });
  assert.equal(plan.targetId, 'clothes-goal'); assert.equal(plan.readyCraftId, 'clothes-goal');
  assert.equal(craft(who, items, rules)?.craftedId, 'clothes-goal');
  assert.equal(who.inventory.length, 10);
  assert.equal(invQty(who.inventory, 'extra-protected'), 1);
});
check('queue selects the feasible alternative craft without manufacturing it during preview', () => {
  const who = fixture(); const inventory = structuredClone(who.inventory);
  const queue = prepareActorPhaseActionPlan({ state: { actor: who, ...world, publicItems: items, craftables: items,
    itemMetaById: meta, itemNameById: names, nextDay: 5, nextPhase: 'morning', phaseIdxNow: 8 } });
  assert.equal(queue.queuedActionType, 'craft');
  assert.equal(who._growthPlan.targetId, 'clothes-goal');
  assert.deepEqual(who.inventory.map(({ itemId, qty }) => ({ itemId, qty })), inventory.map(({ itemId, qty }) => ({ itemId, qty })));
  assert.equal(who.equipped.clothes, null); assert.equal(who.simCredits, 625);
});
check('JSON-restored inputs make the same capacity-aware decision and crafting outcome', () => {
  const first = fixture(); const restored = JSON.parse(JSON.stringify(first));
  for (const who of [first, restored]) { refreshActorGrowthPlan(who, items, world); craft(who); }
  assert.deepEqual(restored, first);
});

// A valid small-stack custom ruleset can block a batch even with free bag
// slots. The receipt remains atomic: do not throw away surplus to pass a plan.
const stackFixture = (ownedBatch = 2) => {
  const raw = { _id: 'stack-fiber', name: '맞춤 섬유', type: '재료', category: 'material', tier: 1, spawnZones: ['school'] };
  const batch = { _id: 'stack-cloth', name: '맞춤 원단', type: '재료', category: 'material', tier: 2,
    recipe: { ingredients: [{ itemId: raw._id, qty: 2 }], resultQty: 3, creditsCost: 7 } };
  const head = gear('stack-head', 'head', [batch._id], 4);
  head.recipe.ingredients[0].qty = 4;
  const catalog = [raw, batch, head];
  const rules = { inventory: { maxSlots: 10, stackMax: { material: 4 } } };
  const who = { _id: 'stack-case', name: 'stack-case', hp: 100, maxHp: 100, simCredits: 20,
    zoneId: 'school', _actionCycleKey: 'stack:0', _growthFocusId: head._id,
    routePlanTargetItemIds: [head._id], equipped: { head: null },
    inventory: [row(raw, 2), row(batch, ownedBatch)] };
  const runCraft = () => tryAutoCraftFromInventory(who, catalog,
    Object.fromEntries(catalog.map(item => [item._id, item.name])),
    Object.fromEntries(catalog.map(item => [item._id, item])), 5, 8, rules);
  return { who, catalog, rules, raw, batch, head, runCraft };
};
check('a partially receivable batch is blocked and described honestly even in a non-full bag', () => {
  const { who, catalog, rules, batch, runCraft } = stackFixture();
  assert.equal(prepareCraftTransaction(who, batch, 5, rules).reason, 'inventory_full');
  const before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, catalog, { ...world, ruleset: rules });
  assert.deepEqual(who, before);
  assert.equal(plan.blocked, 'inventory_full'); assert.equal(plan.readyCraftId, '');
  refreshActorGrowthPlan(who, catalog, { ...world, ruleset: rules });
  const observation = getActorGrowthObservation(who, catalog, { ruleset: rules });
  assert.match(observation.materials, /공간 부족/); assert.doesNotMatch(observation.materials, /제작 가능/);
  assert.equal(runCraft(), null); assert.equal(who.simCredits, 20);
  assert.deepEqual(who.inventory.map(({ itemId, qty }) => ({ itemId, qty })), before.inventory.map(({ itemId, qty }) => ({ itemId, qty })));
  assert.deepEqual(who.equipped, before.equipped);
});
check('a blocked intermediate stack can yield to another payable opening-slot recipe', () => {
  const { who, catalog, rules, raw, runCraft } = stackFixture();
  const alternative = gear('stack-clothes', 'clothes', [raw._id], 5);
  alternative.recipe.ingredients[0].qty = 2;
  catalog.push(alternative); who.routePlanTargetItemIds.push(alternative._id);
  const plan = refreshActorGrowthPlan(who, catalog, { ...world, ruleset: rules });
  assert.equal(plan.targetId, alternative._id); assert.equal(plan.readyCraftId, alternative._id);
  assert.equal(plan.blocked, '');
  const inventory = structuredClone(who.inventory);
  const queue = prepareActorPhaseActionPlan({ state: { actor: who, ...world, ruleset: rules, publicItems: catalog,
    craftables: catalog, itemMetaById: Object.fromEntries(catalog.map(item => [item._id, item])),
    itemNameById: Object.fromEntries(catalog.map(item => [item._id, item.name])), nextDay: 5, nextPhase: 'morning', phaseIdxNow: 8 } });
  assert.equal(queue.queuedActionType, 'craft'); assert.equal(who._growthPlan.readyCraftId, alternative._id);
  assert.deepEqual(who.inventory, inventory); assert.equal(who.simCredits, 20);
  const result = runCraft();
  assert.equal(result.craftedId, alternative._id); assert.equal(who.equipped.clothes, alternative._id);
  assert.equal(invQty(who.inventory, raw._id), 0); assert.equal(invQty(who.inventory, 'stack-cloth'), 2);
  assert.equal(who.simCredits, 15); assert.equal(who.equipped.head, null);
});
check('an exactly fitting batch still pays and consumes both steps of the authored recipe', () => {
  for (const restored of [false, true]) {
    const setup = stackFixture(1);
    if (restored) Object.assign(setup.who, JSON.parse(JSON.stringify(setup.who)));
    const { who, catalog, rules, raw, batch, head, runCraft } = setup;
    const first = refreshActorGrowthPlan(who, catalog, { ...world, ruleset: rules });
    assert.equal(first.readyCraftId, batch._id); assert.equal(first.blocked, '');
    assert.equal(runCraft().craftedId, batch._id);
    assert.equal(invQty(who.inventory, batch._id), 4); assert.equal(invQty(who.inventory, raw._id), 0);
    assert.equal(who.simCredits, 13);
    who._actionCycleKey = 'stack:1';
    assert.equal(refreshActorGrowthPlan(who, catalog, { ...world, ruleset: rules }).readyCraftId, head._id);
    assert.equal(runCraft().craftedId, head._id); assert.equal(who.equipped.head, head._id);
    assert.equal(invQty(who.inventory, batch._id), 0); assert.equal(invQty(who.inventory, head._id), 1);
    assert.equal(who.simCredits, 9);
  }
});
check('the default material stack limit also rejects a partial batch with free bag slots', () => {
  const { who, catalog, head, batch } = stackFixture(1);
  head.recipe.ingredients[0].qty = 2;
  const before = structuredClone(who);
  assert.equal(prepareCraftTransaction(who, batch).reason, 'inventory_full');
  const plan = buildActorGrowthPlan(who, catalog, { ...world, ruleset: {} });
  assert.equal(plan.blocked, 'inventory_full'); assert.equal(plan.readyCraftId, '');
  assert.deepEqual(who, before);
});
check('receivable missing ingredients can unlock a different step before the blocked batch', () => {
  const { who, catalog, rules, raw, batch, head, runCraft } = stackFixture();
  const dye = { _id: 'stack-dye', name: '맞춤 염료', type: '재료', category: 'material', tier: 1, spawnZones: ['school'] };
  const parts = ['stack-left', 'stack-right'].map(_id => ({ _id, name: _id, type: '재료', category: 'material', tier: 2,
    recipe: { ingredients: [{ itemId: batch._id, qty: 2 }, { itemId: dye._id, qty: 1 }], resultQty: 1, creditsCost: 0 } }));
  catalog.push(dye, ...parts); head.recipe.ingredients = parts.map(item => ({ itemId: item._id, qty: 1 }));
  const mapObj = { ...world.mapObj, fieldResourceStock: { school: { [dye._id]: 2 } } };
  const stock = createFieldResources(mapObj, catalog, rules), options = { ...world, mapObj, ruleset: rules, fieldResources: stock };
  assert.equal(prepareCraftTransaction(who, batch, 5, rules).reason, 'inventory_full');
  const plan = refreshActorGrowthPlan(who, catalog, options);
  assert.equal(plan.blocked, ''); assert.equal(plan.readyCraftId, '');
  assert.deepEqual(plan.currentZoneItemIds, [dye._id]);
  assert.doesNotMatch(getActorGrowthObservation(who, catalog, { ruleset: rules }).materials, /제작 가능/);
  const queue = prepareActorPhaseActionPlan({ state: { actor: who, ...options, publicItems: catalog, craftables: catalog,
    itemMetaById: Object.fromEntries(catalog.map(item => [item._id, item])),
    itemNameById: Object.fromEntries(catalog.map(item => [item._id, item.name])), nextDay: 5, nextPhase: 'morning', phaseIdxNow: 8 } });
  assert.equal(queue.queuedActionType, 'routeFarm'); assert.equal(who.simCredits, 20);
  assert.equal(getFieldResourceQty(stock, 'school', dye._id), 2);
  const acquired = collectFieldResourceLoot(stock, { item: dye, itemId: dye._id, zoneId: 'school', qty: 2 }, qty => {
    const inventory = addItemToInventory(who.inventory, dye, dye._id, qty, 5, rules);
    const accepted = inventory._lastAdd.acceptedQty;
    if (accepted) who.inventory = inventory;
    return accepted;
  });
  assert.equal(acquired, 2); assert.equal(getFieldResourceQty(stock, 'school', dye._id), 0);
  for (const [index, item] of [parts[0], batch, parts[1], head].entries()) {
    who._actionCycleKey = `stack:unlock:${index}`;
    assert.equal(refreshActorGrowthPlan(who, catalog, options).readyCraftId, item._id);
    assert.equal(runCraft().craftedId, item._id);
  }
  assert.equal(who.equipped.head, head._id); assert.equal(who.simCredits, 9);
  assert.equal(invQty(who.inventory, raw._id), 0); assert.equal(invQty(who.inventory, dye._id), 0);
  assert.equal(invQty(who.inventory, batch._id), 1);
  assert.equal(stock.byZone.school[dye._id].taken, 2);
});
check('ruleset-free recipe accounting does not assume an unknown custom stack limit', () => {
  const { who, catalog, batch, head } = stackFixture();
  const before = structuredClone(who);
  const work = getGrowthRecipeWork(who, catalog, head._id);
  assert.equal(work.readyCraftId, batch._id); assert.equal(work.blocked, '');
  assert.deepEqual(who, before);
});
console.log(`GROWTH_CAPACITY_CHECKS ${checks}/${checks}`);
