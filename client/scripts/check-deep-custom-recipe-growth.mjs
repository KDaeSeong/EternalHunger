import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { GUEST_ITEM_PROFILE_KEY, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { getGrowthRecipeWork, buildActorGrowthPlan, refreshActorGrowthPlan,
  getActorGrowthProgress, markGrowthComponent } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

// Fresh authored inputs and independent arithmetic expectations only. No
// saved match, historical result, account, filesystem output or paid API.
const ruleset = getRuleset('ER_S11');
const world = { ruleset, mapObj: { zones: ['a', 'b'].map(zoneId => ({ zoneId, name: zoneId })) },
  zoneGraph: { a: ['b'], b: ['a'] }, forbiddenIds: new Set() };
const raw = () => ({ _id: 'raw', name: '원재료', type: '재료', tier: 1, stackMax: 10,
  spawnZones: ['a'], recipe: { ingredients: [] } });
const idAt = index => `guest-item-chain-${index}`;
function fixture(stages) {
  const builtin = [raw()];
  const authored = Array.from({ length: stages }, (_, index) => ({
    _id: idAt(index), name: `제작 단계 ${index + 1}`, type: index === stages - 1 ? '방어구' : '재료',
    ...(index === stages - 1 ? { equipSlot: 'head' } : {}),
    tier: index === stages - 1 ? 4 : 1, stackMax: 10,
    recipe: { ingredients: [{ itemId: index ? idAt(index - 1) : 'raw', qty: 1 }],
      resultQty: 1, creditsCost: 2 },
  }));
  const serialized = JSON.stringify({ schemaVersion: 1, items: authored });
  const storage = { getItem(key) { assert.equal(key, GUEST_ITEM_PROFILE_KEY); return serialized; } };
  const read = readGuestItems(builtin, storage);
  assert.equal(read.ok, true, 'The real local authoring boundary must accept this noncyclic recipe.');
  const items = [...builtin, ...read.items];
  const targetId = idAt(stages - 1);
  const actor = { _id: 'deep-recipe-actor', name: '시험 대원', teamId: 'team-a', hp: 100, maxHp: 100,
    zoneId: 'b', simCredits: stages * 2, inventory: [], equipped: {},
    routePlanTargetItemIds: [targetId], goalLoadouts: { hero: { headKey: targetId } } };
  return { actor, items, targetId, authored, builtin };
}

let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

for (const stages of [6, 24, 128]) {
  check(`${stages} authored stages resolve the real leaf, source, and full cost without mutation`, () => {
    const { actor, items, targetId } = fixture(stages);
    const before = JSON.stringify({ actor, items });
    const work = getGrowthRecipeWork(actor, items, targetId, { ruleset });
    assert.equal(work.blocked, '');
    assert.deepEqual(work.craftIds, Array.from({ length: stages }, (_, index) => idAt(index)));
    assert.deepEqual(work.missing, [{ itemId: 'raw', name: '원재료', need: 1, have: 0 }]);
    assert.equal(work.plannedCredits, stages * 2);
    const plan = buildActorGrowthPlan(actor, items, world);
    assert.equal(plan.targetId, targetId); assert.equal(plan.blocked, '');
    assert.deepEqual(plan.currentZoneItemIds, []);
    assert.equal(plan.targetZoneId, 'a'); assert.equal(plan.nextStep, 'a');
    assert.deepEqual(plan.missing.map(row => [row.itemId, row.need, row.zones]), [['raw', 1, ['a']]]);
    assert.equal(JSON.stringify({ actor, items }), before);
    assert.deepEqual(getGrowthRecipeWork(actor, JSON.parse(JSON.stringify(items)), targetId, { ruleset }), work);
  });

  check(`${stages} stages consume real ingredients, pay every receipt, and equip the final target`, () => {
    const { actor, items, targetId } = fixture(stages);
    const initialCredits = actor.simCredits;
    const meta = buildItemMetaById(items), names = buildItemNameById(items);
    refreshActorGrowthPlan(actor, items, world);
    actor.inventory = addItemToInventory(actor.inventory, markGrowthComponent(items[0], actor), 'raw', 1, 1, ruleset);
    let paid = 0;
    for (let index = 0; index < stages; index++) {
      actor._actionCycleKey = `deep-recipe:${index}`;
      const plan = refreshActorGrowthPlan(actor, items, world);
      assert.equal(plan.blocked, ''); assert.equal(plan.readyCraftId, idAt(index));
      const result = tryAutoCraftFromInventory(actor, items, names, meta, 1, 0, ruleset);
      assert.equal(result?.craftedId, idAt(index));
      assert.equal(result.receipt.paidCost, 2); assert.equal(result.receipt.receivedQty, 1);
      assert.deepEqual(result.receipt.consumed, [{ itemId: index ? idAt(index - 1) : 'raw', qty: 1 }]);
      paid += result.receipt.paidCost;
      assert.equal(actor.simCredits, initialCredits - paid);
      assert.equal(invQty(actor.inventory, index ? idAt(index - 1) : 'raw'), 0);
      assert.equal(invQty(actor.inventory, idAt(index)), 1);
      const afterCraft = JSON.stringify(actor);
      assert.equal(tryAutoCraftFromInventory(actor, items, names, meta, 1, 0, ruleset), null);
      assert.equal(JSON.stringify(actor), afterCraft, 'A repeated action must not consume or award again.');
    }
    assert.equal(paid, stages * 2); assert.equal(actor.simCredits, 0);
    assert.equal(actor.equipped.head, targetId);
    assert.equal(getActorGrowthProgress(actor, items).openingComplete, true);
    assert.equal(invQty(actor.inventory, 'raw'), 0);
  });
}

check('deep shared branches use one real batch and retain virtual surplus accounting', () => {
  const { actor, items, targetId } = fixture(24);
  const changed = items.map(item => item._id === idAt(0)
    ? { ...item, recipe: { ...item.recipe, resultQty: 2, ingredients: [{ itemId: 'raw', qty: 3 }] } }
    : item._id === targetId ? { ...item, recipe: { ...item.recipe,
      ingredients: [...item.recipe.ingredients, { itemId: idAt(0), qty: 1 }] } } : item);
  const before = JSON.stringify({ actor, changed });
  const work = getGrowthRecipeWork(actor, changed, targetId, { ruleset });
  assert.equal(work.blocked, ''); assert.equal(work.plannedCredits, 48);
  assert.equal(work.craftIds.length, 24);
  assert.deepEqual(work.missing, [{ itemId: 'raw', name: '원재료', need: 3, have: 0 }]);
  assert.equal(work.reservedQtyById[idAt(0)], 2);
  assert.equal(JSON.stringify({ actor, changed }), before);
});

for (const [label, alter] of [
  ['cycle', (recipe, targetId) => ({ ...recipe, ingredients: [{ itemId: targetId, qty: 1 }] })],
  ['missing ingredient', recipe => ({ ...recipe, ingredients: [{ itemId: 'absent', qty: 1 }] })],
  ['zero quantity', recipe => ({ ...recipe, ingredients: [{ itemId: 'raw', qty: 0 }] })],
  ['unsafe batch output', recipe => ({ ...recipe, resultQty: Number.MAX_SAFE_INTEGER + 1 })],
  ['unsafe accumulated costs', recipe => ({ ...recipe, creditsCost: Number.MAX_SAFE_INTEGER })],
]) {
  check(`deep ${label} remains blocked without rewriting inventory or credits`, () => {
    const { actor, items, targetId } = fixture(24);
    const changed = items.map(item => item._id === idAt(0) ? { ...item, recipe: alter(item.recipe, targetId) } : item);
    const before = JSON.stringify({ actor, changed });
    const work = getGrowthRecipeWork(actor, changed, targetId, { ruleset });
    assert.equal(work.blocked, 'invalid_recipe');
    assert.equal(JSON.stringify({ actor, changed }), before);
  });
}

check('owned deep intermediate stops expansion without inventing missing raw stock', () => {
  const { actor, items, targetId } = fixture(128);
  actor.inventory = [{ ...items.find(item => item._id === idAt(96)), itemId: idAt(96), qty: 1 }];
  const work = getGrowthRecipeWork(actor, items, targetId, { ruleset });
  assert.equal(work.blocked, ''); assert.deepEqual(work.missing, []);
  assert.deepEqual(work.craftIds, Array.from({ length: 31 }, (_, index) => idAt(97 + index)));
  assert.equal(work.readyCraftId, idAt(97)); assert.equal(work.plannedCredits, 62);
});

check('shared deep branches cannot overflow aggregate raw demand or reservations', () => {
  const { actor, items, targetId } = fixture(24);
  const changed = items.map(item => item._id === idAt(0)
    ? { ...item, recipe: { ...item.recipe, ingredients: [{ itemId: 'raw', qty: Number.MAX_SAFE_INTEGER }] } }
    : item._id === targetId ? { ...item, recipe: { ...item.recipe,
      ingredients: [...item.recipe.ingredients, { itemId: idAt(0), qty: 1 }] } } : item);
  const before = JSON.stringify({ actor, changed });
  assert.equal(getGrowthRecipeWork(actor, changed, targetId, { ruleset }).blocked, 'invalid_recipe');
  assert.equal(JSON.stringify({ actor, changed }), before);
});

check('an unsafe sum of held ingredient rows cannot satisfy a deep recipe', () => {
  const { actor, items, targetId } = fixture(24);
  actor.inventory = [{ itemId: 'raw', qty: Number.MAX_SAFE_INTEGER }, { itemId: 'raw', qty: 1 }];
  const before = JSON.stringify(actor);
  assert.equal(getGrowthRecipeWork(actor, items, targetId, { ruleset }).blocked, 'invalid_recipe');
  assert.equal(JSON.stringify(actor), before);
});

console.log(`DEEP_CUSTOM_RECIPE_GROWTH ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
