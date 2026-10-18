import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { withSimulationRandom } from '../src/utils/simulationRandom.js';
const { buildActorGrowthPlan, getActorGrowthProgress, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getLateGrowthTargets } = await import('../src/app/simulation/_lib/lateGrowthTargetRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

const ruleset = getRuleset('ER_S11');
const raw = { _id: 'raw', name: '공유 원재료', type: '재료', category: 'material', tier: 1,
  spawnZones: ['a'], recipe: { ingredients: [] } };
const far = { _id: 'far', name: '먼 원재료', type: '재료', category: 'material', tier: 1,
  spawnZones: ['b'], recipe: { ingredients: [] } };
const starter = { _id: 'starter', name: '기본 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 2,
  recipe: { ingredients: [] } };
const authored = { _id: 'authored-head', name: '직접 지정 영웅 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 4,
  itemKey: 'authored-head-key', recipe: { ingredients: [{ itemId: 'raw', qty: 1 }, { itemId: 'far', qty: 1 }], creditsCost: 2 } };
const unrelatedUpgrade = { _id: 'unrelated-tier5-head', name: '비지정 전설 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 5,
  recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], creditsCost: 7 } };
const clothesGoal = { _id: 'clothes-goal', name: '직접 지정 옷', category: 'equipment', type: '옷', equipSlot: 'clothes', tier: 4,
  recipe: { ingredients: [{ itemId: 'far', qty: 1 }], creditsCost: 2 } };
const items = [raw, far, starter, authored, unrelatedUpgrade, clothesGoal];
const itemMeta = buildItemMetaById(items), itemNames = buildItemNameById(items);
const mapObj = { zones: [{ zoneId: 'a' }, { zoneId: 'b' }] };
const zoneGraph = { a: ['b'], b: ['a'] };
let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log(`PASS ${label}`); };

function fixture({ direct = true, rawQty = 1, farQty = 0, credits = 30, goals = null,
  routeIds = [authored._id], ownGoal = false } = {}) {
  const inventory = [{ ...starter, itemId: starter._id, qty: 1 }];
  if (rawQty) inventory.push({ ...raw, itemId: raw._id, qty: rawQty });
  if (farQty) inventory.push({ ...far, itemId: far._id, qty: farQty });
  if (ownGoal) inventory.push({ ...authored, itemId: authored._id, qty: 1 });
  const actor = { _id: 'actor', hp: 100, maxHp: 100, weaponType: '', simCredits: credits,
    zoneId: 'a', inventory, equipped: { head: ownGoal ? authored._id : starter._id }, routePlanTargetItemIds: routeIds,
    ...(direct ? { goalLoadouts: goals || { hero: { headKey: authored._id } } } : {}) };
  const fieldResources = createFieldResources(mapObj, items, ruleset);
  fieldResources.byZone.a.raw.remaining = 0;
  return { actor, world: { mapObj, zoneGraph, forbiddenIds: new Set(), fieldResources, ruleset } };
}

function makePlan(state) { return refreshActorGrowthPlan(state.actor, items, state.world); }
function lootCraft(state, itemId, catalog = items, meta = itemMeta, names = itemNames) {
  const plan = state.actor._growthPlan;
  const preview = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(state.actor.inventory, itemId, catalog,
    names, meta, 1, ruleset, { goalItemKeys: [], weaponType: state.actor.weaponType, growthPlan: plan,
      craftActor: { _id: state.actor._id, hp: state.actor.hp, simCredits: state.actor.simCredits,
        equipped: state.actor.equipped } }));
  if (!preview) return null;
  assert.equal(applyLootCraftResult(state.actor, preview, meta), true);
  return preview;
}

function starterReservedFixture() {
  const starterGoal = { ...authored, _id: 'authored-head-uses-starter',
    recipe: { ingredients: [{ itemId: starter._id, qty: 1 }, { itemId: far._id, qty: 1 }], creditsCost: 2 } };
  const catalog = [raw, far, starter, starterGoal, unrelatedUpgrade, clothesGoal];
  const meta = buildItemMetaById(catalog), names = buildItemNameById(catalog);
  const actor = { _id: 'actor', hp: 100, maxHp: 100, weaponType: '', simCredits: 30,
    zoneId: 'a', inventory: [{ ...starter, itemId: starter._id, qty: 1 }, { ...raw, itemId: raw._id, qty: 1 }],
    equipped: { head: starter._id }, routePlanTargetItemIds: [starterGoal._id],
    goalLoadouts: { hero: { headKey: starterGoal._id } } };
  const fieldResources = createFieldResources(mapObj, catalog, ruleset);
  fieldResources.byZone.a.raw.remaining = 0;
  const state = { actor, world: { mapObj, zoneGraph, forbiddenIds: new Set(), fieldResources, ruleset } };
  const growth = refreshActorGrowthPlan(actor, catalog, state.world);
  return { state, growth, catalog, meta, names, starterGoal };
}

for (const [name, craft] of [
  ['inventory', ({ state, catalog, meta, names }) => tryAutoCraftFromInventory(state.actor, catalog, names, meta, 1, 0, ruleset)],
  ['loot', ({ state, catalog, meta, names }) => lootCraft(state, raw._id, catalog, meta, names)],
]) {
  const reproduction = starterReservedFixture();
  assert.equal(reproduction.growth.targetId, reproduction.starterGoal._id);
  assert.equal(reproduction.growth.exactTargetIds.includes(reproduction.starterGoal._id), true);
  assert.equal(reproduction.growth.reservedQtyById[starter._id], 1);
  const beforeCredits = reproduction.state.actor.simCredits;
  const crafted = craft(reproduction);
  assert.equal(crafted, null,
    `${name}: unrelated same-slot upgrade must not replace the starter reserved by the authored goal`);
  assert.equal(reproduction.state.actor.simCredits, beforeCredits);
  assert.equal(reproduction.state.actor.inventory.find((entry) => entry.itemId === starter._id)?.qty, 1,
    `${name}: the starter reserved for the authored recipe must remain available`);
  assert.equal(reproduction.state.actor.inventory.find((entry) => entry.itemId === raw._id)?.qty, 1);
  assert.equal(getActorGrowthProgress(reproduction.state.actor, reproduction.catalog).openingComplete, false);
  console.log(`PASS ${name} same-slot replacement preserves the authored goal's equipped starter`);
}

for (const [name, craft] of [
  ['inventory', (state) => tryAutoCraftFromInventory(state.actor, items, itemNames, itemMeta, 1, 0, ruleset)],
  ['loot', (state) => lootCraft(state, 'raw')],
]) {
  check(`${name} side crafts preserve exact-target ingredient and credit reservations`, () => {
    const state = fixture();
    const plan = makePlan(state);
    assert.equal(plan.targetId, authored._id); assert.equal(plan.exactTargetIds.includes(authored._id), true);
    assert.equal(plan.reservedQtyById.raw, 1); assert.equal(plan.plannedCredits, 2);
    const before = { credits: state.actor.simCredits, raw: 1 };
    assert.equal(craft(state), null, `${name}: the unrelated tier-5 recipe must not consume reserved stock`);
    assert.equal(state.actor.simCredits, before.credits);
    assert.equal(state.actor.inventory.find((entry) => entry.itemId === raw._id)?.qty, before.raw);
    const refreshed = buildActorGrowthPlan(state.actor, items, state.world);
    assert.equal(refreshed.targetId, authored._id); assert.equal(refreshed.blocked, '');
    assert.deepEqual(refreshed.missing.map((row) => row.itemId), ['far']);
    assert.equal(getActorGrowthProgress(state.actor, items).openingComplete, false);
  });
}

check('automatic goals retain their existing higher-tier substitution', () => {
  const state = fixture({ direct: false });
  const growth = makePlan(state);
  assert.equal(growth.exactTargetIds.includes(authored._id), false);
  const crafted = tryAutoCraftFromInventory(state.actor, items, itemNames, itemMeta, 1, 0, ruleset);
  assert.equal(crafted?.craftedId, unrelatedUpgrade._id);
  assert.equal(crafted.receipt.paidCost, 7); assert.equal(state.actor.simCredits, 23);
  assert.equal(getActorGrowthProgress(state.actor, items).openingComplete, true);
});

check('unrelated raw surplus may fund a same-slot upgrade without touching reserved units', () => {
  const state = fixture({ rawQty: 2 });
  const growth = makePlan(state);
  assert.equal(growth.reservedQtyById.raw, 1);
  const crafted = tryAutoCraftFromInventory(state.actor, items, itemNames, itemMeta, 1, 0, ruleset);
  assert.equal(crafted?.craftedId, unrelatedUpgrade._id); assert.equal(crafted.receipt.paidCost, 7);
  assert.equal(state.actor.simCredits, 23);
  assert.equal(state.actor.inventory.find((entry) => entry.itemId === raw._id)?.qty, 1);
  assert.equal(getActorGrowthProgress(state.actor, items).openingComplete, false);
});

check('planned direct-goal credits cannot be spent by an unrelated same-slot upgrade', () => {
  const expensiveGoal = { ...authored, recipe: { ...authored.recipe, creditsCost: 20 } };
  const expensiveItems = items.map((item) => item._id === authored._id ? expensiveGoal : item);
  const state = fixture({ rawQty: 2, credits: 25 });
  const growth = refreshActorGrowthPlan(state.actor, expensiveItems, state.world);
  assert.equal(growth.exactTargetIds.includes(authored._id), true);
  assert.equal(growth.plannedCredits, 20);
  assert.equal(tryAutoCraftFromInventory(state.actor, expensiveItems, buildItemNameById(expensiveItems),
    buildItemMetaById(expensiveItems), 1, 0, ruleset), null);
  assert.equal(state.actor.simCredits, 25);
  assert.equal(state.actor.inventory.find((entry) => entry.itemId === raw._id)?.qty, 2);
});

function lateReservedFixture({ includeFar = false } = {}) {
  const head4 = { _id: 'late-head4', name: '기본 머리 4단계', category: 'equipment', type: '머리', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [] } };
  const lateGoal = { _id: 'authored-legend-head', name: '직접 지정 전설 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: head4._id, qty: 1 }, { itemId: far._id, qty: 1 }], creditsCost: 2 } };
  const transcendent = { _id: 'unrelated-transcend-head', name: '비지정 초월 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 6,
    recipe: { ingredients: [{ itemId: raw._id, qty: 1 }], creditsCost: 7 } };
  const otherGear = [
    { _id: 'late-clothes4', name: '기본 옷 4단계', category: 'equipment', type: '옷', equipSlot: 'clothes', tier: 4, recipe: { ingredients: [] } },
    { _id: 'late-arm4', name: '기본 팔 4단계', category: 'equipment', type: '팔', equipSlot: 'arm', tier: 4, recipe: { ingredients: [] } },
    { _id: 'late-shoes4', name: '기본 신발 4단계', category: 'equipment', type: '신발', equipSlot: 'shoes', tier: 4, recipe: { ingredients: [] } },
    { _id: 'late-weapon4', name: '기본 무기 4단계', category: 'equipment', type: '무기', equipSlot: 'weapon', tier: 4, weaponType: '검', recipe: { ingredients: [] } },
  ];
  const catalog = [raw, far, head4, lateGoal, transcendent, ...otherGear];
  const meta = buildItemMetaById(catalog), names = buildItemNameById(catalog);
  const inventory = [head4, ...otherGear].map((entry) => ({ ...entry, itemId: entry._id, qty: 1 }));
  inventory.push({ ...raw, itemId: raw._id, qty: 1 });
  if (includeFar) inventory.push({ ...far, itemId: far._id, qty: 1 });
  const actor = { _id: 'late-actor', hp: 100, maxHp: 100, weaponType: '검', simCredits: 30,
    zoneId: 'a', inventory, equipped: { head: head4._id, clothes: otherGear[0]._id, arm: otherGear[1]._id,
      shoes: otherGear[2]._id, weapon: otherGear[3]._id }, routePlanTargetItemIds: [],
    goalLoadouts: { legend: { headKey: lateGoal._id } } };
  const fieldResources = createFieldResources(mapObj, catalog, ruleset);
  fieldResources.byZone.a.raw.remaining = 0;
  const state = { actor, world: { mapObj, zoneGraph, forbiddenIds: new Set(), fieldResources, ruleset } };
  const growth = refreshActorGrowthPlan(actor, catalog, state.world);
  return { state, growth, catalog, meta, names, lateGoal, transcendent };
}

function authoredSuccessorFixture() {
  const head4 = { _id: 'successor-head4', name: '기본 머리 4단계', category: 'equipment', type: '머리', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [] } };
  const legendGoal = { _id: 'authored-legend-before-transcend', name: '직접 지정 전설 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: head4._id, qty: 1 }, { itemId: far._id, qty: 1 }], creditsCost: 3 } };
  const blood = { _id: 'successor-blood', name: '정당한 보스 재료', type: '재료', category: 'material', tier: 4 };
  const transcendGoal = { _id: 'authored-transcend-after-legend', name: '직접 지정 초월 머리', category: 'equipment', type: '머리', equipSlot: 'head', tier: 6,
    recipe: { ingredients: [{ itemId: head4._id, qty: 1 }, { itemId: blood._id, qty: 1 }], creditsCost: 3 } };
  const otherGear = [
    { _id: 'successor-clothes4', name: '기본 옷 4단계', category: 'equipment', type: '옷', equipSlot: 'clothes', tier: 4, recipe: { ingredients: [] } },
    { _id: 'successor-arm4', name: '기본 팔 4단계', category: 'equipment', type: '팔', equipSlot: 'arm', tier: 4, recipe: { ingredients: [] } },
    { _id: 'successor-shoes4', name: '기본 신발 4단계', category: 'equipment', type: '신발', equipSlot: 'shoes', tier: 4, recipe: { ingredients: [] } },
    { _id: 'successor-weapon4', name: '기본 무기 4단계', category: 'equipment', type: '무기', equipSlot: 'weapon', tier: 4, weaponType: '검', recipe: { ingredients: [] } },
  ];
  const catalog = [raw, far, blood, head4, legendGoal, transcendGoal, ...otherGear];
  const meta = buildItemMetaById(catalog), names = buildItemNameById(catalog);
  const inventory = [head4, ...otherGear].map((entry) => ({ ...entry, itemId: entry._id, qty: 1 }));
  const actor = { _id: 'successor-actor', hp: 100, maxHp: 100, weaponType: '검', simCredits: 20,
    zoneId: 'a', inventory, equipped: { head: head4._id, clothes: otherGear[0]._id, arm: otherGear[1]._id,
      shoes: otherGear[2]._id, weapon: otherGear[3]._id }, routePlanTargetItemIds: [],
    goalLoadouts: { legend: { headKey: legendGoal._id }, transcend: { headKey: transcendGoal._id } } };
  const fieldResources = createFieldResources(mapObj, catalog, ruleset);
  const state = { actor, world: { mapObj, zoneGraph, forbiddenIds: new Set(), fieldResources, ruleset } };
  const growth = refreshActorGrowthPlan(actor, catalog, state.world);
  return { state, growth, catalog, meta, names, legendGoal, transcendGoal, blood };
}

for (const [name, craft] of [
  ['inventory', (fixture) => {
    fixture.state.actor.inventory.push({ ...fixture.blood, itemId: fixture.blood._id, qty: 1 });
    return tryAutoCraftFromInventory(fixture.state.actor, fixture.catalog, fixture.names, fixture.meta, 1, 0, ruleset);
  }],
  ['loot', (fixture) => {
    fixture.state.actor.inventory.push({ ...fixture.blood, itemId: fixture.blood._id, qty: 1 });
    return lootCraft(fixture.state, fixture.blood._id, fixture.catalog, fixture.meta, fixture.names);
  }],
]) {
  check(`${name} permits a payable later authored same-slot target without auto-completing its earlier tier-5 goal`, () => {
    const fixture = authoredSuccessorFixture();
    assert.equal(fixture.growth.targetId, fixture.legendGoal._id);
    assert.equal(fixture.growth.stage, 'late');
    assert.equal(fixture.growth.exactTargetIds.includes(fixture.legendGoal._id), true);
    assert.equal(fixture.growth.exactTargetIds.includes(fixture.transcendGoal._id), true);
    const crafted = craft(fixture);
    assert.equal(crafted?.craftedId, fixture.transcendGoal._id,
      JSON.stringify({ name, craftedId: crafted?.craftedId, plan: fixture.state.actor._growthPlan,
        inventory: fixture.state.actor.inventory.map((entry) => [entry.itemId, entry.qty]) }));
    assert.equal(crafted.receipt.paidCost, 3);
    assert.deepEqual(crafted.receipt.consumed, [
      { itemId: 'successor-head4', qty: 1 }, { itemId: fixture.blood._id, qty: 1 },
    ]);
    assert.equal(fixture.state.actor.inventory.some((entry) => entry.itemId === fixture.legendGoal._id), false);
    assert.equal(fixture.state.actor._lateAcquiredItemIds?.legend?.head, undefined);
    assert.equal(fixture.state.actor.equipped.head, fixture.transcendGoal._id);
    refreshActorGrowthPlan(fixture.state.actor, fixture.catalog, fixture.state.world);
    assert.equal(getLateGrowthTargets(fixture.state.actor, fixture.catalog, { authoredOnly: true }).targets
      .some((item) => item._id === fixture.legendGoal._id), true,
    'The direct tier-5 request remains unacquired after its tier-6 successor is crafted.');
    assert.equal(fixture.state.actor._lateAcquiredItemIds?.legend?.head, undefined);
  });
}

for (const [name, craft] of [
  ['inventory', ({ state, catalog, names, meta }) => tryAutoCraftFromInventory(state.actor, catalog, names, meta, 1, 0, ruleset)],
  ['loot', ({ state, catalog, names, meta }) => lootCraft(state, raw._id, catalog, meta, names)],
]) {
  check(`${name} keeps a legend target's replacement item before an unrelated transcend upgrade`, () => {
    const fixture = lateReservedFixture();
    assert.equal(fixture.growth.stage, 'late');
    assert.equal(fixture.growth.openingComplete, true);
    assert.equal(fixture.growth.targetId, fixture.lateGoal._id);
    assert.equal(fixture.growth.exactTargetIds.includes(fixture.lateGoal._id), true);
    assert.equal(fixture.growth.reservedQtyById[fixture.state.actor.equipped.head], 1);
    const credits = fixture.state.actor.simCredits;
    const result = craft(fixture);
    assert.equal(result, null);
    assert.equal(fixture.state.actor.simCredits, credits);
    assert.equal(fixture.state.actor.inventory.find((entry) => entry.itemId === raw._id)?.qty, 1);
    assert.equal(fixture.state.actor.inventory.find((entry) => entry.itemId === fixture.state.actor.equipped.head)?.qty, 1);
    assert.equal(getActorGrowthProgress(fixture.state.actor, fixture.catalog).openingComplete, true);
  });
}

for (const [name, craft] of [
  ['inventory', ({ state, catalog, names, meta }) => tryAutoCraftFromInventory(state.actor, catalog, names, meta, 1, 0, ruleset)],
  ['loot', ({ state, catalog, names, meta }) => lootCraft(state, far._id, catalog, meta, names)],
]) {
  check(`${name} can craft the actual authored legend target with its late receipt`, () => {
    const fixture = lateReservedFixture({ includeFar: true });
    assert.equal(fixture.growth.targetId, fixture.lateGoal._id);
    assert.equal(fixture.growth.exactTargetIds.includes(fixture.lateGoal._id), true);
    const result = craft(fixture);
    assert.equal(result?.craftedId, fixture.lateGoal._id);
    assert.equal(result.receipt.paidCost, 2);
    assert.deepEqual(result.receipt.consumed, [
      { itemId: 'late-head4', qty: 1 }, { itemId: far._id, qty: 1 },
    ]);
    assert.equal(fixture.state.actor.inventory.find((entry) => entry.itemId === fixture.lateGoal._id)?.qty, 1);
  });
}

check('a completed authored goal does not block a different slot focus', () => {
  const state = fixture({ rawQty: 1, ownGoal: true,
    routeIds: [authored._id, clothesGoal._id],
    goals: { hero: { headKey: authored._id, clothesKey: clothesGoal._id } } });
  const growth = makePlan(state);
  assert.equal(getActorGrowthProgress(state.actor, items).completedSlots, 1);
  assert.equal(growth.targetId, clothesGoal._id);
  const crafted = tryAutoCraftFromInventory(state.actor, items, itemNames, itemMeta, 1, 0, ruleset);
  assert.equal(crafted?.craftedId, unrelatedUpgrade._id);
  assert.equal(crafted.receipt.paidCost, 7); assert.equal(state.actor.simCredits, 23);
  assert.equal(getActorGrowthProgress(state.actor, items).completedSlots, 1);
});

for (const [name, craft] of [
  ['inventory', (state) => tryAutoCraftFromInventory(state.actor, items, itemNames, itemMeta, 1, 0, ruleset)],
  ['loot', (state) => lootCraft(state, 'far')],
]) {
  check(`${name} can still craft the actual direct goal with its real receipt`, () => {
    const state = fixture({ rawQty: 1, farQty: 1 });
    const plan = makePlan(state);
    assert.equal(plan.targetId, authored._id); assert.equal(plan.readyCraftId, authored._id);
    const crafted = craft(state);
    assert.equal(crafted?.craftedId, authored._id);
    assert.equal(crafted.receipt.paidCost, 2);
    assert.deepEqual(crafted.receipt.consumed, [{ itemId: raw._id, qty: 1 }, { itemId: far._id, qty: 1 }]);
    assert.equal(state.actor.simCredits, 28);
    assert.equal(state.actor.inventory.find((entry) => entry.itemId === authored._id)?.qty, 1);
    assert.equal(getActorGrowthProgress(state.actor, items).openingComplete, true);
  });
}

console.log(`AUTHORED_GOAL_MATERIAL_RESERVATION ${checks}/${checks}`);
