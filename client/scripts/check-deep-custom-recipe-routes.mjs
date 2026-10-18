import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { saveGuestItem, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildItemIndexes, buildDay1TargetCandidatesBySlot, prepareRouteRequirementSearch } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { buildDay1HeroRoutePlanDetails } = await import('../src/app/simulation/_lib/routePlanRuntime.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');

const zone = 'source-zone';
const raw = { _id: 'source:leaf', name: '실제 원재료', type: '재료', category: 'material', tier: 1, spawnZones: [zone] };
const builtin = [raw];
const memory = () => {
  const rows = new Map();
  return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
};

function saveAcyclicChain(edges, suffix) {
  const storage = memory();
  const nodeIds = Array.from({ length: Math.max(0, edges - 1) }, (_, index) => `guest-item-${suffix}-stage-${index + 1}`);
  const targetId = `guest-item-${suffix}-goal`;
  let nextId = raw._id;
  for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
    const id = nodeIds[index];
    const result = saveGuestItem({ _id: id, name: id, type: '재료', tier: 5,
      recipe: { ingredients: [{ itemId: nextId, qty: 1 }], resultQty: 1, creditsCost: 0 } }, builtin, storage);
    assert.equal(result.ok, true, result.error);
    nextId = id;
  }
  const goal = saveGuestItem({ _id: targetId, name: `${suffix} 맞춤 투구`, type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: nextId, qty: 1 }], resultQty: 1, creditsCost: 0 } }, builtin, storage);
  assert.equal(goal.ok, true, goal.error);
  const profile = readGuestItems(builtin, storage);
  assert.equal(profile.ok, true, profile.error);
  return { targetId, nodeIds, items: [...builtin, ...profile.items] };
}

function addOtherSlotRecipes(items, suffix) {
  const slots = ['weapon', 'clothes', 'arm', 'shoes'];
  const sourceRows = slots.map(slot => ({ _id: `source:${suffix}:${slot}`, name: `${slot} 재료`, type: '재료',
    category: 'material', tier: 1, spawnZones: [zone] }));
  const gearRows = slots.map((slot, index) => ({ _id: `fixture:${suffix}:${slot}`, name: `${slot} 장비`, type: '방어구',
    category: 'equipment', equipSlot: slot, tier: 4,
    recipe: { ingredients: [{ itemId: sourceRows[index]._id, qty: 1 }], resultQty: 1, creditsCost: 0 } }));
  return [...items, ...sourceRows, ...gearRows];
}

function fixture(chain, suffix) {
  const items = addOtherSlotRecipes(chain.items, suffix);
  const actor = { _id: `fixture:${suffix}`, weaponType: '단검', goalLoadouts: { hero: { headKey: chain.targetId } } };
  const map = { zones: [{ zoneId: zone, name: zone }] };
  const candidates = buildDay1TargetCandidatesBySlot(actor, items, buildItemIndexes(items), map);
  return { actor, items, map, candidates };
}

let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.message}`); }
}

function assertLeafAndFullRoute(edges, suffix) {
  const chain = saveAcyclicChain(edges, suffix);
  const { actor, items, map, candidates } = fixture(chain, suffix);
  const head = candidates.get('head')?.[0];
  assert.ok(head, 'authored head target must remain selected');
  assert.deepEqual(head.requirements.map(({ itemId, qty, zones }) => ({ itemId, qty, zones })),
    [{ itemId: raw._id, qty: 1, zones: [zone] }]);
  const route = buildDay1HeroRoutePlanDetails(actor, map, items);
  assert.equal(route.complete, true, `full five-slot route should cover all real leaves: ${JSON.stringify(route.missing)}`);
  assert.ok(route.requiredItemIds.includes(raw._id));
  assert.equal(route.requiredItemIds.some(id => chain.nodeIds.includes(id)), false);
  assert.equal(route.targetItemIds.length, 5);
}

check('six-edge custom equipment recipe resolves its true leaf and five-slot route', () => assertLeafAndFullRoute(6, 'six-edge'));
check('24-edge custom equipment recipe resolves without an arbitrary route-depth cap', () => assertLeafAndFullRoute(24, 'twenty-four-edge'));
check('maximum 128 saved custom profiles form a valid deep route to the true leaf', () => assertLeafAndFullRoute(128, 'maximum-profile-chain'));

check('shared recipe surplus is consumed in original depth-first order', () => {
  const shared = { _id: 'fixture:shared', type: '재료', tier: 2,
    recipe: { ingredients: [{ itemId: raw._id, qty: 1 }], resultQty: 2, creditsCost: 0 } };
  const branch = { _id: 'fixture:branch', type: '재료', tier: 2,
    recipe: { ingredients: [{ itemId: shared._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  const target = { _id: 'guest-item-shared-goal', name: '공유 재료 투구', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: shared._id, qty: 1 }, { itemId: branch._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  const { candidates } = fixture({ targetId: target._id, nodeIds: [], items: [raw, shared, branch, target] }, 'shared');
  assert.deepEqual(candidates.get('head')?.[0]?.requirements.map(({ itemId, qty, zones }) => ({ itemId, qty, zones })),
    [{ itemId: raw._id, qty: 1, zones: [zone] }]);
});

check('cross-slot raw requirement overflow is rejected without unsafe route totals', () => {
  const hugeRaw = { _id: 'source:huge-shared-leaf', name: '대량 원재료', type: '재료', category: 'material', tier: 1, spawnZones: [zone] };
  const hugeGear = (slot, suffix) => ({ _id: `guest-item-${suffix}`, name: suffix, type: '방어구', category: 'equipment',
    equipSlot: slot, tier: 4, recipe: { ingredients: [{ itemId: hugeRaw._id, qty: Number.MAX_SAFE_INTEGER }], resultQty: 1, creditsCost: 0 } });
  const head = hugeGear('head', 'huge-head');
  const clothes = hugeGear('clothes', 'huge-clothes');
  const items = addOtherSlotRecipes([hugeRaw, head, clothes], 'huge-shared-leaf');
  const actor = { _id: 'fixture:cross-slot-overflow', weaponType: '단검', goalLoadouts: { hero: {
    headKey: head._id, clothesKey: clothes._id,
  } } };
  const map = { zones: [{ zoneId: zone, name: zone }] };
  const route = buildDay1HeroRoutePlanDetails(actor, map, items);
  assert.equal(route.complete, false, 'unsafe combined demand cannot produce a complete route');
  assert.deepEqual(route.missing, [], 'covered real ingredients remain covered; overflow does not invent a missing source');

  const candidates = buildDay1TargetCandidatesBySlot(actor, items, buildItemIndexes(items), map);
  const search = prepareRouteRequirementSearch(candidates, 1);
  const covered = search.materials.map(row => row.zones.includes(zone));
  let state = { quantities: new Array(search.materials.length).fill(0), ids: [], picks: [] };
  for (const slot of ['head', 'clothes']) state = search.extend(state, search.bySlot.get(slot)[0], covered);
  assert.equal(state.invalid, true, 'the combined state must carry its overflow status');
  assert.equal(state.stats.droneBlockedMissing, 0, 'covered leaves are not reclassified as unavailable supplies');

  const otherRaw = { ...hugeRaw, _id: 'source:huge-distinct-leaf', name: '별도 대량 원재료' };
  const otherHead = { ...hugeGear('head', 'distinct-head'), recipe: {
    ingredients: [{ itemId: hugeRaw._id, qty: Number.MAX_SAFE_INTEGER }], resultQty: 1, creditsCost: 0,
  } };
  const otherClothes = { ...hugeGear('clothes', 'distinct-clothes'), recipe: {
    ingredients: [{ itemId: otherRaw._id, qty: Number.MAX_SAFE_INTEGER }], resultQty: 1, creditsCost: 0,
  } };
  const distinctItems = addOtherSlotRecipes([hugeRaw, otherRaw, otherHead, otherClothes], 'huge-distinct-leaves');
  const distinctActor = { ...actor, goalLoadouts: { hero: { headKey: otherHead._id, clothesKey: otherClothes._id } } };
  const distinctRoute = buildDay1HeroRoutePlanDetails(distinctActor, map, distinctItems);
  assert.equal(distinctRoute.complete, false, 'unsafe totals across different leaves cannot complete a route');
  const distinctCandidates = buildDay1TargetCandidatesBySlot(distinctActor, distinctItems,
    buildItemIndexes(distinctItems), map);
  const distinctSearch = prepareRouteRequirementSearch(distinctCandidates, 1);
  const distinctCovered = distinctSearch.materials.map(row => row.zones.includes(zone));
  let distinctState = { quantities: new Array(distinctSearch.materials.length).fill(0), ids: [], picks: [] };
  for (const slot of ['head', 'clothes']) {
    distinctState = distinctSearch.extend(distinctState, distinctSearch.bySlot.get(slot)[0], distinctCovered);
  }
  assert.equal(distinctState.invalid, true, 'unsafe sum across distinct leaves must mark the state invalid');
});

function assertRejectedHead(target, dependencies, suffix) {
  const items = addOtherSlotRecipes([raw, ...dependencies, target], suffix);
  const actor = { _id: `fixture:${suffix}`, weaponType: '단검', goalLoadouts: { hero: { headKey: target._id } } };
  const candidates = buildDay1TargetCandidatesBySlot(actor, items, buildItemIndexes(items), { zones: [{ zoneId: zone, name: zone }] });
  assert.equal(candidates.get('head')?.length || 0, 0, 'invalid inputs must not become source-less farm requirements');
}

check('missing recipe input is rejected instead of treated as a gatherable item', () => {
  assertRejectedHead({ _id: 'guest-item-missing-goal', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: 'missing:ingredient', qty: 1 }] } }, [], 'missing');
});
check('cyclic recipe is rejected instead of becoming an intermediate gather target', () => {
  const cycle = { _id: 'fixture:cycle-part', type: '재료', recipe: { ingredients: [{ itemId: 'guest-item-cycle-goal', qty: 1 }] } };
  assertRejectedHead({ _id: 'guest-item-cycle-goal', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: cycle._id, qty: 1 }] } }, [cycle], 'cycle');
});
check('invalid quantity and unsafe nested quantity overflow are rejected', () => {
  assertRejectedHead({ _id: 'guest-item-invalid-qty-goal', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: raw._id, qty: 0 }] } }, [], 'invalid-qty');
  const huge = { _id: 'fixture:huge-part', type: '재료', recipe: { ingredients: [{ itemId: raw._id, qty: 2 }] } };
  const outer = { _id: 'fixture:outer-part', type: '재료', recipe: { ingredients: [{ itemId: huge._id, qty: Number.MAX_SAFE_INTEGER }] } };
  assertRejectedHead({ _id: 'guest-item-overflow-goal', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: outer._id, qty: 1 }] } }, [outer, huge], 'overflow');
  const left = { _id: 'fixture:left-branch', type: '재료', recipe: { ingredients: [{ itemId: raw._id, qty: Number.MAX_SAFE_INTEGER }] } };
  const right = { _id: 'fixture:right-branch', type: '재료', recipe: { ingredients: [{ itemId: raw._id, qty: 1 }] } };
  assertRejectedHead({ _id: 'guest-item-aggregate-overflow-goal', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: left._id, qty: 1 }, { itemId: right._id, qty: 1 }] } }, [left, right], 'aggregate-overflow');
});

function fallbackHead(id, tier = 4) {
  const source = { _id: `source:${id}`, name: `${id} 채집물`, type: '재료', category: 'material', tier: 1, spawnZones: [zone] };
  const item = { _id: id, name: `${id} 얕은 대체 투구`, type: '방어구', category: 'equipment', equipSlot: 'head', tier,
    recipe: { ingredients: [{ itemId: source._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  return { source, item };
}

check('missing authored head lets a five-slot route use shallow fallback but progress retains missing goal', () => {
  const fallback = fallbackHead('fixture:missing-fallback');
  const items = addOtherSlotRecipes([raw, fallback.source, fallback.item], 'missing-fallback');
  const actor = { _id: 'fixture:missing-authored', weaponType: '단검', goalLoadouts: { hero: { headKey: 'guest-item-not-in-catalog' } } };
  const route = buildDay1HeroRoutePlanDetails(actor, { zones: [{ zoneId: zone, name: zone }] }, items);
  assert.equal(route.complete, true);
  assert.equal(route.targetItemIds.length, 5);
  assert.ok(route.targetItemIds.includes(fallback.item._id));
  const progress = getActorGrowthProgress({ ...actor, routePlanTargetItemIds: route.targetItemIds }, items);
  assert.equal(progress.openingComplete, false);
  assert.deepEqual(progress.goalIssues.map(row => [row.itemId, row.reason]), [['guest-item-not-in-catalog', 'missing_target']]);
});

check('catalogued cyclic authored head can route around to shallow fallback without erasing declared goal', () => {
  const targetId = 'guest-item-cyclic-authored-head';
  const cyclePart = { _id: 'fixture:cycle-authored-part', type: '재료',
    recipe: { ingredients: [{ itemId: targetId, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  const target = { _id: targetId, name: '순환 맞춤 투구', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: cyclePart._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  const fallback = fallbackHead('fixture:cycle-fallback', 4);
  const betterOwned = fallbackHead('fixture:cycle-better-owned', 5);
  const items = addOtherSlotRecipes([raw, cyclePart, target, fallback.source, fallback.item, betterOwned.source, betterOwned.item], 'cycle-fallback');
  const actor = { _id: 'fixture:cyclic-authored', weaponType: '단검', goalLoadouts: { hero: { headKey: targetId } } };
  const route = buildDay1HeroRoutePlanDetails(actor, { zones: [{ zoneId: zone, name: zone }] }, items);
  assert.equal(route.complete, true);
  assert.equal(route.targetItemIds.length, 5);
  assert.ok(route.targetItemIds.includes(fallback.item._id));
  assert.equal(route.targetItemIds.includes(targetId), false);

  const withoutHead = getActorGrowthProgress({ ...actor, routePlanTargetItemIds: route.targetItemIds }, items);
  assert.equal(withoutHead.openingComplete, false);
  assert.equal(withoutHead.remaining.some(item => item._id === targetId), true);
  assert.deepEqual(withoutHead.goalIssues, []);

  const otherSlotsOwned = route.targetItemIds.filter(id => id !== fallback.item._id)
    .map(id => ({ ...items.find(item => item._id === id), itemId: id, qty: 1 }));

  const fallbackOnly = getActorGrowthProgress({ ...actor, routePlanTargetItemIds: route.targetItemIds,
    inventory: [...otherSlotsOwned, { ...fallback.item, itemId: fallback.item._id, qty: 1 }] }, items);
  assert.equal(fallbackOnly.openingComplete, false, 'same-tier route fallback is not the authored item');

  const betterFallbackOnly = getActorGrowthProgress({ ...actor, routePlanTargetItemIds: route.targetItemIds,
    inventory: [...otherSlotsOwned, { ...betterOwned.item, itemId: betterOwned.item._id, qty: 1 }] }, items);
  assert.equal(betterFallbackOnly.openingComplete, false,
    'a higher-tier fallback cannot fulfill an exact authored item, even when its recipe is malformed');
  assert.deepEqual(betterFallbackOnly.remaining.map(item => item._id), [targetId]);

  const authoredOwned = getActorGrowthProgress({ ...actor, routePlanTargetItemIds: route.targetItemIds,
    inventory: [...otherSlotsOwned, { ...target, itemId: targetId, qty: 1 }] }, items);
  assert.equal(authoredOwned.openingComplete, true,
    'actual ownership fulfills the declared item without claiming that its cyclic recipe was crafted');
  assert.equal(authoredOwned.remaining.length, 0);

  const automaticFallback = getActorGrowthProgress({ ...actor, goalLoadouts: {},
    routePlanTargetItemIds: route.targetItemIds,
    inventory: [...otherSlotsOwned, { ...betterOwned.item, itemId: betterOwned.item._id, qty: 1 }] }, items);
  assert.equal(automaticFallback.openingComplete, true,
    'automatic route targets retain higher-tier substitution; only direct declarations require the exact item');
  assert.equal(automaticFallback.remaining.length, 0);
});

console.log(`DEEP_CUSTOM_RECIPE_ROUTE_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
