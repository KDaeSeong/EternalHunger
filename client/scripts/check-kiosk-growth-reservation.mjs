import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { commitProcurementTransaction } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const { getGrowthRecipeWork, refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { prepareCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');

// Current authored catalogues, real recipe accounting and atomic settlement.
// This check does not run a match, contact accounts, or substitute transactions.
const raw = { _id: 'reserve-raw', name: '예약 재료', type: '재료', tier: 1 };
const missing = { _id: 'reserve-missing', name: '부족한 재료', type: '재료', tier: 1 };
const spare = { _id: 'reserve-spare', name: '여분 재료', type: '재료', tier: 4 };
const other = { _id: 'reserve-other', name: '별도 재료', type: '재료', tier: 4 };
const middle = { _id: 'reserve-middle', name: '중간 부품', type: '재료', tier: 3,
  recipe: { ingredients: [{ itemId: raw._id, qty: 1 }, { itemId: missing._id, qty: 1 }], resultQty: 1, creditsCost: 8 } };
const target = { _id: 'reserve-target', name: '목표 모자', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 5,
  recipe: { ingredients: [{ itemId: middle._id, qty: 1 }], resultQty: 1, creditsCost: 12 } };
const items = [raw, missing, spare, other, middle, target];
const map = { _id: 'reservation-map', zones: [{ zoneId: 'hospital', name: '병원', hasKiosk: true }] };
const held = (item, qty = 1) => ({ ...structuredClone(item), itemId: item._id, qty });
const sale = (item, priceCredits = 7) => ({ itemId: item._id, mode: 'sell', priceCredits });
const refund = (item, priceCredits = 7) => ({ itemId: item._id, mode: 'buy', priceCredits });
const exchange = (give, qty = 1) => ({ itemId: other._id, mode: 'exchange',
  exchange: { giveItemId: give._id, giveQty: qty } });
function fixture({ credits = 20, inventory = [held(raw)], catalog = [sale(other)], rules = {}, extraItems = [] } = {}) {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.inventory = { ...ruleset.inventory, ...rules };
  const actor = { _id: 'reservation-buyer', hp: 100, maxHp: 100, zoneId: 'hospital', simCredits: credits,
    inventory: structuredClone(inventory), _actionCycleKey: '4:500', _procurementActionKey: 'old-action',
    equipped: {}, _craftRevision: 17 };
  return { actor, catalog, ruleset, publicItems: [...items, ...extraItems] };
}
const work = input => getGrowthRecipeWork(input.actor, input.publicItems, target._id, { ruleset: input.ruleset });
function commit(input, actor, offer) {
  return commitProcurementTransaction({ actor, offer, day: 3, phaseIdxNow: 4, ruleset: input.ruleset,
    actionType: { buy: 'kioskBuy', sell: 'kioskSell', exchange: 'kioskExchange' }[offer.kind] });
}
function quote(input, { noGoal = false, noRules = false, day = 3, random = 0, craftGoal } = {}) {
  const goal = craftGoal ?? (noGoal ? { missing: [] } : { target, missing: work(input).missing });
  const kiosks = [{ mapId: map._id, zoneId: 'hospital', hasCustomCatalog: true, catalog: input.catalog }];
  const before = structuredClone({ input, goal, kiosks });
  let draws = 0;
  const offer = withSimulationRandom(() => { draws++; return random; }, () => rollKioskInteraction(
    map, 'hospital', kiosks, input.publicItems, day, 'morning', input.actor, goal,
    Object.fromEntries(input.publicItems.map(item => [item._id, item.name])), input.ruleset.market,
    noRules ? null : input.ruleset));
  assert.deepEqual({ input, goal, kiosks }, before, 'Quoting must preserve actor, catalogue, rules and recipe inputs.');
  return { offer, draws };
}
function assertBlocked(input, label, options) {
  const { offer } = quote(input, options);
  if (offer) {
    const actor = structuredClone(input.actor), before = work(input), receipt = commit(input, actor, offer);
    const after = work({ ...input, actor });
    console.log(`RESERVATION_WITNESS ${JSON.stringify({ label, kind: offer.kind, committed: receipt.ok,
      credits: [input.actor.simCredits, actor.simCredits], fees: [before.plannedCredits, after.plannedCredits],
      missing: [before.missing.map(row => [row.itemId, row.need]), after.missing.map(row => [row.itemId, row.need])] })}`);
  }
  assert.ok(!offer, `${label}: unsafe authored fallback must not be quoted`);
}
function assertAllowed(input, kind, expectedCredits, options) {
  const before = work(input), { offer, draws } = quote(input, options);
  assert.equal(offer?.kind, kind, 'Expected the actual authored transaction.');
  const receipt = commit(input, input.actor, offer);
  assert.equal(receipt.ok, true); assert.equal(input.actor.simCredits, expectedCredits);
  if (!options?.noGoal && !options?.noRules) {
    const after = work(input), oldMissing = new Map(before.missing.map(row => [row.itemId, row.need]));
    assert.ok(after.missing.every(row => row.need <= (oldMissing.get(row.itemId) || 0)));
    assert.ok(Math.max(0, after.plannedCredits - input.actor.simCredits)
      <= Math.max(0, before.plannedCredits - receipt.beforeCredits));
  }
  return { offer, receipt, draws };
}
let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

check('unrelated purchase cannot spend the full remaining multistage recipe fee reserve (20 -> 13)', () => {
  const input = fixture(); assert.equal(work(input).plannedCredits, 20);
  assertBlocked(input, 'reserved credits 20 -> 13');
});
check('a real surplus purchase still pays the authored price (27 -> 20)', () => {
  const input = fixture({ credits: 27 }), result = assertAllowed(input, 'buy', 20);
  assert.equal(result.receipt.paidCost, 7); assert.equal(invQty(input.actor.inventory, other._id), 1);
  assert.equal(result.draws, 2, 'Validation must not draw random numbers.');
});
check('an underfunded purchase cannot spend any already reserved available credits', () => {
  assertBlocked(fixture({ credits: 7 }), 'underfunded purchase');
});
check('a free unrelated purchase can preserve an existing fee shortfall', () => {
  assertAllowed(fixture({ credits: 5, catalog: [sale(other, 0)] }), 'buy', 5);
});
check('unrelated exchange cannot consume an exactly held recipe ingredient', () => {
  assertBlocked(fixture({ catalog: [exchange(raw)] }), 'reserved exchange input');
});
check('an exchange consumes only real ingredient surplus and keeps the required quantity', () => {
  const input = fixture({ inventory: [held(raw, 2)], catalog: [exchange(raw)] });
  const { receipt, draws } = assertAllowed(input, 'exchange', 20);
  assert.deepEqual(receipt.consumed, [{ itemId: raw._id, qty: 1 }]);
  assert.equal(invQty(input.actor.inventory, raw._id), 1); assert.equal(draws, 2);
});
check('exchange quantity cannot consume surplus plus one reserved unit', () => {
  assertBlocked(fixture({ inventory: [held(raw, 2)], catalog: [exchange(raw, 2)] }), 'exchange quantity reserve');
});
check('unrelated refund cannot sell an exactly held recipe ingredient', () => {
  assertBlocked(fixture({ catalog: [refund(raw)] }), 'reserved refund input');
});
check('a surplus refund settles at its authored value without consuming reserved quantity', () => {
  const input = fixture({ inventory: [held(raw, 2)], catalog: [refund(raw)] });
  const { receipt, draws } = assertAllowed(input, 'sell', 27);
  assert.equal(receipt.gainedCredits, 7); assert.equal(invQty(input.actor.inventory, raw._id), 1); assert.equal(draws, 2);
});
check('a useful surplus refund can fund only part of the remaining recipe fees', () => {
  const input = fixture({ credits: 5, inventory: [held(raw, 2)], catalog: [refund(raw)] });
  assertAllowed(input, 'sell', 12); assert.equal(work(input).plannedCredits, 20);
});
check('insufficient_credits recipe status still allows a genuine fundraising refund', () => {
  const input = fixture({ credits: 5, inventory: [held(raw), held(missing), held(spare)], catalog: [refund(spare)] });
  assert.equal(work(input).blocked, 'insufficient_credits');
  assertAllowed(input, 'sell', 12); assert.equal(invQty(input.actor.inventory, spare._id), 0);
});
check('a free trade can preserve a material-ready insufficient-credit status', () => {
  const input = fixture({ credits: 5, inventory: [held(raw), held(missing)], catalog: [sale(other, 0)] });
  assert.equal(work(input).blocked, 'insufficient_credits'); assertAllowed(input, 'buy', 5);
});
check('exact target material purchase preserves every remaining fee and takes no RNG', () => {
  const input = fixture({ credits: 27, catalog: [sale(missing)] });
  const { offer, draws } = assertAllowed(input, 'buy', 20);
  assert.equal(offer.itemId, missing._id); assert.equal(draws, 0); assert.equal(work(input).readyCraftId, middle._id);
  assertBlocked(fixture({ credits: 26, catalog: [sale(missing)] }), 'exact purchase fee short');
});
check('direct target acquisition can replace the remaining recipe fees at an underfunded balance', () => {
  const input = fixture({ credits: 15, catalog: [sale(target, 15)] });
  assertAllowed(input, 'buy', 0); assert.equal(work(input).plannedCredits, 0);
  assert.equal(invQty(input.actor.inventory, target._id), 1);
});
check('a purchased intermediate can reduce both remaining fees and an existing fee shortfall', () => {
  for (const credits of [5, 17]) {
    const input = fixture({ credits, catalog: [sale(middle, 5)] });
    assertAllowed(input, 'buy', credits - 5); assert.equal(work(input).plannedCredits, 12);
  }
});
check('an unrelated exchange cannot sacrifice a reserved intermediate even when rebuilding remains funded', () => {
  const input = fixture({ credits: 30, inventory: [held(middle), held(raw), held(missing)], catalog: [exchange(middle)] });
  assert.equal(work(input).plannedCredits, 12);
  assertBlocked(input, 'reserved but recraftable intermediate');
});
check('a full bag cannot accept a side purchase by auto-dropping a reserved material', () => {
  const input = fixture({ credits: 27, inventory: [held(raw), held(spare)],
    rules: { maxSlots: 2, autoDropLowValue: true } });
  const actor = structuredClone(input.actor);
  assert.equal(commit(input, actor, { kind: 'buy', item: other, itemId: other._id, qty: 1, cost: 7 }).ok, true);
  assert.equal(invQty(actor.inventory, raw._id), 0, 'The real receipt must exercise auto-drop.');
  assertBlocked(input, 'full bag auto-drop');
});
check('full inventory rejects a side purchase when auto-drop is disabled', () => {
  assertBlocked(fixture({ credits: 27, inventory: [held(raw), held(spare)],
    rules: { maxSlots: 2, autoDropLowValue: false } }), 'full bag no auto-drop');
});
check('equipment replacement cannot destroy a held required intermediate', () => {
  const component = { ...middle, type: '방어구', category: 'equipment', equipSlot: 'head', tier: 3 };
  const upgrade = { _id: 'reserve-upgrade', name: '별도 모자', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 4 };
  const input = fixture({ credits: 27, inventory: [held(component)], catalog: [sale(upgrade)], extraItems: [upgrade] });
  input.publicItems = input.publicItems.map(item => item._id === middle._id ? component : item);
  const actor = structuredClone(input.actor);
  assert.equal(commit(input, actor, { kind: 'buy', item: upgrade, itemId: upgrade._id, qty: 1, cost: 7 }).ok, true);
  assert.equal(invQty(actor.inventory, middle._id), 0, 'The real receipt must exercise replacement.');
  assertBlocked(input, 'reserved equipment replacement');
});
check('no active target and ruleset-free callers retain their existing authored fallback', () => {
  assertAllowed(fixture(), 'buy', 13, { noGoal: true });
  assertAllowed(fixture(), 'buy', 13, { noRules: true });
});
check('market item restrictions, exact affordability, world time and random gates remain enforced', () => {
  const food = { ...other, tags: ['food'] }, input = fixture({ credits: 27 });
  input.publicItems = input.publicItems.map(item => item._id === food._id ? food : item);
  assertBlocked(input, 'restricted item');
  assertBlocked(fixture({ credits: 6 }), 'unaffordable authored price');
  assertBlocked(fixture({ credits: 27 }), 'world time gate', { day: 1 });
  assertBlocked(fixture({ credits: 27 }), 'random gate', { random: 0.9999 });
});
check('the real refreshed growth plan propagates recipe reservations into authored side trades', () => {
  for (const credits of [20, 27]) {
    const input = fixture({ credits });
    input.actor.routePlanTargetItemIds = [target._id];
    input.publicItems = input.publicItems.map(item => [raw._id, missing._id].includes(item._id)
      ? { ...item, spawnZones: ['hospital'] } : item);
    const plan = refreshActorGrowthPlan(input.actor, input.publicItems, {
      mapObj: map, zoneGraph: { hospital: [] }, forbiddenIds: new Set(), ruleset: input.ruleset,
    });
    assert.equal(plan.targetId, target._id); assert.equal(plan.plannedCredits, 20);
    assert.equal(input.actor.inventory.find(row => row.itemId === raw._id)._growthReserved, true);
    const craftGoal = getActorGrowthCraftGoal(input.actor, input.publicItems);
    assert.equal(craftGoal.target._id, target._id);
    if (credits === 20) assertBlocked(input, 'refreshed plan fee reserve', { craftGoal });
    else assertAllowed(input, 'buy', 20, { craftGoal });
  }
});
check('a surplus refund can open a slot and recover an inventory-full recipe', () => {
  const input = fixture({ inventory: [held(raw, 2), held(missing, 2), held(spare)],
    catalog: [refund(spare)], rules: { maxSlots: 3, autoDropLowValue: false } });
  assert.equal(work(input).blocked, 'inventory_full');
  assert.equal(prepareCraftTransaction(input.actor, middle, 3, input.ruleset).ok, false);
  assertAllowed(input, 'sell', 27);
  assert.equal(work(input).blocked, ''); assert.equal(work(input).readyCraftId, middle._id);
  assert.equal(prepareCraftTransaction(input.actor, middle, 3, input.ruleset).ok, true);
  const stillFull = fixture({ inventory: [held(raw, 2), held(missing, 2), held(spare, 2)],
    catalog: [refund(spare)], rules: { maxSlots: 3, autoDropLowValue: false } });
  assertBlocked(stillFull, 'refund does not recover capacity');
});
for (const fee of [8, 0]) check(`a recipe-related raw output cannot reverse a held branch into extra crafting (fee ${fee})`, () => {
  const branchA = { ...middle, recipe: { ...middle.recipe, creditsCost: fee } };
  const branchB = { ...branchA, _id: 'reserve-branch-b', name: '다른 중간 부품' };
  const branchedTarget = { ...target, recipe: { ...target.recipe,
    ingredients: [{ itemId: branchA._id, qty: 1 }, { itemId: branchB._id, qty: 1 }] } };
  const input = fixture({ credits: 40, inventory: [held(branchA), held(raw), held(missing, 2)],
    catalog: [{ itemId: raw._id, mode: 'exchange', exchange: { giveItemId: branchA._id, giveQty: 1 } }],
    extraItems: [branchB] });
  input.publicItems = input.publicItems.map(item => item._id === middle._id ? branchA
    : item._id === target._id ? branchedTarget : item);
  const before = work(input), actor = structuredClone(input.actor);
  const receipt = commit(input, actor, { kind: 'exchange', item: raw, itemId: raw._id, qty: 1,
    consume: [{ itemId: branchA._id, qty: 1 }] });
  assert.equal(receipt.ok, true); assert.equal(invQty(actor.inventory, branchA._id), 0);
  const after = work({ ...input, actor });
  assert.equal(before.plannedCredits, 12 + fee); assert.equal(after.plannedCredits, 12 + 2 * fee);
  assert.deepEqual(after.missing, before.missing);
  assertBlocked(input, `recipe-related reversal fee ${fee}`);
});
check('a zero-fee partial self-exchange cannot increase already outstanding recipe quantities', () => {
  const component = { ...middle, recipe: { ...middle.recipe, creditsCost: 0 } };
  const partialTarget = { ...target, recipe: { ...target.recipe,
    ingredients: [{ itemId: component._id, qty: 3 }] } };
  const input = fixture({ credits: 20, inventory: [held(component, 2), held(raw, 2), held(missing, 2)],
    catalog: [{ itemId: component._id, mode: 'exchange', exchange: { giveItemId: component._id, giveQty: 2 } }] });
  input.publicItems = input.publicItems.map(item => item._id === middle._id ? component
    : item._id === target._id ? partialTarget : item);
  const before = work(input), actor = structuredClone(input.actor);
  const receipt = commit(input, actor, { kind: 'exchange', item: component, itemId: component._id, qty: 1,
    consume: [{ itemId: component._id, qty: 2 }] });
  assert.equal(receipt.ok, true); assert.equal(invQty(actor.inventory, component._id), 1);
  const after = work({ ...input, actor });
  assert.equal(after.plannedCredits, before.plannedCredits); assert.deepEqual(after.missing, before.missing);
  assert.deepEqual(after.craftIds, before.craftIds);
  assert.equal(before.reservedQtyById[raw._id], 1); assert.equal(after.reservedQtyById[raw._id], 2);
  const selected = quote(input).offer;
  if (selected) console.log(`PARTIAL_RECIPE_WITNESS ${JSON.stringify({ selected: selected.kind,
    committed: receipt.ok, heldComponent: [2, invQty(actor.inventory, component._id)],
    reservedRaw: [before.reservedQtyById[raw._id], after.reservedQtyById[raw._id]] })}`);
  assertBlocked(input, 'zero-fee partial self-exchange');
});
check('gaining one branch cannot excuse losing more outstanding zero-fee work in another branch', () => {
  const branchA = { ...middle, recipe: { ...middle.recipe, creditsCost: 0 } };
  const branchB = { ...branchA, _id: 'reserve-partial-b', name: '별도 중간 부품' };
  const partialTarget = { ...target, recipe: { ...target.recipe,
    ingredients: [{ itemId: branchA._id, qty: 3 }, { itemId: branchB._id, qty: 1 }] } };
  const input = fixture({ credits: 20, inventory: [held(branchA, 2), held(raw, 3), held(missing, 3)],
    catalog: [{ itemId: branchB._id, mode: 'exchange', exchange: { giveItemId: branchA._id, giveQty: 2 } }],
    extraItems: [branchB] });
  input.publicItems = input.publicItems.map(item => item._id === middle._id ? branchA
    : item._id === target._id ? partialTarget : item);
  const before = work(input), actor = structuredClone(input.actor);
  const receipt = commit(input, actor, { kind: 'exchange', item: branchB, itemId: branchB._id, qty: 1,
    consume: [{ itemId: branchA._id, qty: 2 }] });
  assert.equal(receipt.ok, true); assert.equal(invQty(actor.inventory, branchB._id), 1);
  const after = work({ ...input, actor });
  assert.equal(after.plannedCredits, before.plannedCredits); assert.deepEqual(after.missing, before.missing);
  assert.equal(before.reservedQtyById[raw._id], 2); assert.equal(after.reservedQtyById[raw._id], 3);
  const selected = quote(input).offer;
  if (selected) console.log(`PARTIAL_BRANCH_WITNESS ${JSON.stringify({ selected: selected.kind,
    committed: receipt.ok, heldA: [2, invQty(actor.inventory, branchA._id)], receivedB: 1,
    reservedRaw: [before.reservedQtyById[raw._id], after.reservedQtyById[raw._id]] })}`);
  assertBlocked(input, 'zero-fee partial branch exchange');
});
console.log(`KIOSK_GROWTH_RESERVATION_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
