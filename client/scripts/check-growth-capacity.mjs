import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildActorGrowthPlan, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { getActorGrowthObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');

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
  const plan = refreshActorGrowthPlan(who, items, world);
  assert.equal(plan.blocked, 'inventory_full'); assert.equal(plan.readyCraftId, '');
  const before = structuredClone({ inventory: who.inventory, credits: who.simCredits, equipped: who.equipped });
  assert.equal(craft(who), null);
  assert.deepEqual({ inventory: who.inventory, credits: who.simCredits, equipped: who.equipped }, before);
  const observation = getActorGrowthObservation(who, items, { ruleset });
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
console.log(`GROWTH_CAPACITY_CHECKS ${checks}/${checks}`);
