import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { getLootCraftOptions, emitCraftRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { tryImmediateCraftFromSpecial } = await import('../src/app/simulation/_lib/gearImmediateSpecialCraftRuntime.js');
const { runCraftAction } = await import('../src/app/simulation/_lib/phaseCraftActionRuntime.js');
const { getGrowthRecipeWork, refreshActorGrowthPlan, getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { createFieldResources, collectFieldResourceLoot, getFieldResourceQty } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { buildActorRecoveryPlan, craftActorRecoveryItem } = await import('../src/app/simulation/_lib/recoveryPlanRuntime.js');
const { forceUseConsumableAtIndex } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { getActorGrowthObservation, describeCraftReceipt } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { buildItemIndexes, buildDay1TargetCandidatesBySlot } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { createPhaseCombatEliminationRuntime } = await import('../src/app/simulation/_lib/phaseCombatEliminationRuntime.js');
const { invQty, addItemToInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, consumable: 6, equipment: 1 }, autoDropLowValue: false } };
const leaf = { itemId: 'custom:leaf', name: '약초', type: '재료', qty: 4, tier: 1 };
const recipe = { _id: 'custom:food', name: '맞춤 음식', type: 'food', tier: 1,
  recipe: { ingredients: [{ itemId: leaf.itemId, qty: 2 }], resultQty: 3, creditsCost: 7 } };
// Opening goals are equipment. Keep food batch/cost/capacity coverage by
// using it as a real intermediate in the equipment recipe, not as a slot.
const growthGoal = { _id: 'custom:head-goal', name: '맞춤 모자', type: '방어구', equipSlot: 'head', tier: 4,
  recipe: { ingredients: [{ itemId: recipe._id, qty: 3 }] } };
const actor = (extra = {}) => ({ _id: 'crafter', name: '제작자', hp: 100, maxHp: 100, simCredits: 20,
  inventory: [structuredClone(leaf)], equipped: {}, _actionCycleKey: '1:20', ...extra });
const resources = (who) => JSON.stringify({ inventory: who.inventory, equipped: who.equipped,
  hp: who.hp, credits: who.simCredits, revision: who._craftRevision });
const craft = (who, item = recipe, config = rules) => tryAutoCraftFromInventory(who, [item], {}, {}, 1, 0, config);
const loot = (who, item = recipe) => withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(
  who.inventory, leaf.itemId, [item], {}, {}, 1, rules, getLootCraftOptions(who)));
const transactions = () => import('../src/app/simulation/_lib/craftTransactionRuntime.js');
let passed = 0;
let failed = 0;
async function test(name, step) {
  try { await step(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

await test('direct crafting consumes the full recipe, yields three and charges seven', () => {
  const who = actor();
  const result = craft(who);
  assert.equal(invQty(who.inventory, recipe._id), 3);
  assert.equal(invQty(who.inventory, leaf.itemId), 2);
  assert.equal(who.simCredits, 13);
  assert.equal(result.craftedQty, 3);
  assert.match(result.log, /x3/);
  assert.match(result.log, /7Cr/);
  assert.equal(result.receipt.paidCost, 7);
});
await test('unaffordable crafting preserves materials, equipment and credits', () => {
  const who = actor({ simCredits: 6 });
  const before = resources(who);
  assert.equal(craft(who), null);
  assert.equal(resources(who), before);
  assert.equal(who._craftDebug.code, 'insufficient_credits');
  assert.match(who._craftDebug.text, /7.*6/);
});
await test('invalid yields and costs never silently become a free one-item recipe', () => {
  for (const field of ['resultQty', 'creditsCost']) {
    for (const value of [null, '', false, -1, 0.5, Infinity, NaN, 'wrong', Number.MAX_SAFE_INTEGER + 1, ...(field === 'resultQty' ? [0] : [])]) {
      const who = actor();
      const before = resources(who);
      assert.equal(craft(who, { ...recipe, recipe: { ...recipe.recipe, [field]: value } }), null, `${field}=${String(value)}`);
      assert.equal(resources(who), before);
    }
  }
});
await test('legacy omitted fields remain one item at zero cost; numeric editor strings are valid', () => {
  const who = actor();
  const result = craft(who, { ...recipe, recipe: { ingredients: recipe.recipe.ingredients } });
  assert.equal(result.craftedQty, 1);
  assert.equal(who.simCredits, 20);
  const other = actor();
  craft(other, { ...recipe, recipe: { ...recipe.recipe, resultQty: '3', creditsCost: '7' } });
  assert.equal(invQty(other.inventory, recipe._id), 3);
  assert.equal(other.simCredits, 13);
});
await test('duplicate ingredient rows are summed before checking or consuming', () => {
  const doubled = { ...recipe, recipe: { ...recipe.recipe, ingredients: [{ itemId: leaf.itemId, qty: 2 }, { itemId: leaf.itemId, qty: 2 }] } };
  const poor = actor({ inventory: [{ ...leaf, qty: 3 }] });
  const before = resources(poor);
  assert.equal(craft(poor, doubled), null);
  assert.equal(resources(poor), before);
  const who = actor();
  const result = craft(who, doubled);
  assert.equal(invQty(who.inventory, leaf.itemId), 0);
  assert.deepEqual(result.receipt.consumed, [{ itemId: leaf.itemId, qty: 4 }]);
});
await test('partial output stack capacity rolls back the entire recipe', () => {
  const who = actor({ inventory: [structuredClone(leaf), { itemId: recipe._id, name: recipe.name, type: 'food', qty: 5 }] });
  const before = resources(who);
  assert.equal(craft(who), null);
  assert.equal(resources(who), before);
  assert.equal(who._craftDebug.code, 'inventory_full');
});
await test('failed equipment batch preserves the old equipped item, even after a tentative replacement', () => {
  const old = { itemId: 'old:head', name: '기존 모자', type: '방어구', equipSlot: 'head', tier: 1, qty: 1 };
  const who = actor({ inventory: [structuredClone(leaf), old], equipped: { head: old.itemId } });
  const before = resources(who);
  const gear = { ...recipe, _id: 'custom:head', name: '제작 모자', type: '방어구', equipSlot: 'head', tier: 3,
    recipe: { ...recipe.recipe, resultQty: 2 } };
  assert.equal(craft(who, gear), null);
  assert.equal(resources(who), before);
});
await test('dead actors and malformed inventory cannot manufacture items', () => {
  for (const extra of [{ hp: 0 }, { hp: NaN }, { inventory: [{ ...leaf, qty: 0 }] }, { inventory: [{ ...leaf, qty: -2 }] }]) {
    const who = actor(extra);
    const before = resources(who);
    assert.equal(craft(who), null);
    assert.equal(resources(who), before);
  }
});
await test('same action and its JSON-restored retry cannot pay or craft twice', () => {
  const who = actor();
  assert.ok(craft(who));
  const restored = JSON.parse(JSON.stringify(who));
  const before = resources(restored);
  assert.equal(craft(restored), null);
  assert.equal(resources(restored), before);
  restored._actionCycleKey = '1:40';
  assert.ok(craft(restored));
  assert.equal(invQty(restored.inventory, recipe._id), 6);
  assert.equal(restored.simCredits, 6);
});
await test('loot crafting prepares without mutation and commits actual quantity and cost once', async () => {
  const { commitCraftTransaction } = await transactions();
  const who = actor();
  const before = resources(who);
  const result = loot(who);
  assert.ok(result);
  assert.equal(resources(who), before);
  assert.equal(commitCraftTransaction(who, result.transaction).ok, true);
  assert.equal(invQty(who.inventory, recipe._id), 3);
  assert.equal(who.simCredits, 13);
  const after = resources(who);
  assert.equal(commitCraftTransaction(who, result.transaction).ok, false);
  assert.equal(resources(who), after);
});
await test('a stale or foreign loot result cannot overwrite newer resources or revive a dead actor', async () => {
  const { commitCraftTransaction } = await transactions();
  for (const change of [(who) => { who.simCredits--; }, (who) => { who.inventory[0].qty--; },
    (who) => { who.hp = 0; }, (who) => { who._id = 'other'; }, (who) => { who._actionCycleKey = '1:40'; }]) {
    const who = actor();
    const result = loot(who);
    change(who);
    const before = resources(who);
    assert.equal(commitCraftTransaction(who, result.transaction).ok, false);
    assert.equal(resources(who), before);
  }
});
await test('serialized prepared loot commits once and a later legitimate craft in the same cycle remains possible', async () => {
  const { commitCraftTransaction } = await transactions();
  const who = actor();
  const first = JSON.parse(JSON.stringify(loot(who)));
  const restored = JSON.parse(JSON.stringify(who));
  assert.equal(commitCraftTransaction(restored, first.transaction).ok, true);
  const second = loot(restored);
  assert.equal(commitCraftTransaction(restored, second.transaction).ok, true);
  assert.equal(restored.simCredits, 6);
  assert.equal(invQty(restored.inventory, recipe._id), 6);
  assert.equal(commitCraftTransaction(restored, first.transaction).ok, false);
});
await test('loot path never prepares unaffordable batches', () => {
  const who = actor({ simCredits: 0 });
  const before = resources(who);
  assert.equal(loot(who), null);
  assert.equal(resources(who), before);
});
await test('successful craft events preserve yield, consumed materials and actual credits', () => {
  const who = actor();
  const result = craft(who);
  const events = [];
  emitCraftRunEvent((kind, data) => events.push({ kind, ...data }), who._id, result);
  assert.equal(events[0].qty, 3);
  assert.equal(events[0].paidCost, 7);
  assert.equal(events[0].beforeCredits, 20);
  assert.equal(events[0].afterCredits, 13);
  assert.deepEqual(events[0].consumed, [{ itemId: leaf.itemId, qty: 2 }]);
  assert.match(describeCraftReceipt(events[0]), /3개 제작 완료.*7Cr.*20→13Cr/);
  assert.equal(describeCraftReceipt({ ...events[0], afterCredits: 14 }), '');
});
await test('the shared product loot application awards inventory, mastery and an event only after commit', async () => {
  const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
  const who = actor();
  const result = loot(who);
  const events = [], masteries = [];
  const options = { emitCraftRunEvent: (...args) => events.push(args), grantCraftMastery: (...args) => masteries.push(args) };
  assert.equal(applyLootCraftResult(who, result, {}, options), true);
  assert.equal(applyLootCraftResult(who, result, {}, options), false);
  assert.equal(who.simCredits, 13);
  assert.equal(events.length, 1);
  assert.equal(masteries.length, 1);
});
await test('queued crafting and immediate special crafting pay the same contract', () => {
  const who = actor();
  const events = [];
  const queued = runCraftAction({ state: { actor: who, craftables: [recipe], publicItems: [recipe], itemNameById: {}, itemMetaById: {},
    nextDay: 1, nextPhase: 'morning', phaseIdxNow: 0, queuedActionType: 'craft', ruleset: rules },
    actions: { emitCraftRunEvent: (...args) => events.push(args) } });
  assert.equal(queued.craftResult.craftedQty, 3);
  assert.equal(who.simCredits, 13);
  assert.equal(events.length, 1);
  const specialRecipe = { ...recipe, _id: 'custom:mithril-head', name: '미스릴 모자', type: '방어구', equipSlot: 'head', tier: 5,
    recipe: { ...recipe.recipe, resultQty: 1 } };
  const rich = actor();
  assert.equal(tryImmediateCraftFromSpecial(rich, 'mithril', leaf.itemId, [specialRecipe], {}, {}, 3, 'morning', 4, rules).changed, true);
  assert.equal(rich.simCredits, 13);
  const poor = actor({ simCredits: 0 });
  const before = resources(poor);
  assert.equal(tryImmediateCraftFromSpecial(poor, 'mithril', leaf.itemId, [specialRecipe], {}, {}, 3, 'morning', 4, rules).changed, false);
  assert.equal(resources(poor), before);
});
await test('growth planning counts batch yields and reuses surplus across shared recipe branches', () => {
  const raw = { _id: leaf.itemId, type: '재료' };
  const intermediate = { ...recipe, _id: 'intermediate', type: '재료', recipe: { ...recipe.recipe, creditsCost: 0 } };
  const branch = { _id: 'branch', recipe: { ingredients: [{ itemId: intermediate._id, qty: 2 }] } };
  const target = { _id: 'target', recipe: { ingredients: [{ itemId: intermediate._id, qty: 1 }, { itemId: branch._id, qty: 1 }] } };
  const work = getGrowthRecipeWork(actor({ inventory: [] }), [raw, intermediate, branch, target], target._id);
  assert.equal(work.blocked, '');
  assert.deepEqual(work.missing, [{ itemId: leaf.itemId, name: leaf.itemId, need: 2, have: 0 }]);
  assert.deepEqual(work.craftIds, ['intermediate', 'branch', 'target']);
});
await test('growth planning distinguishes a funded ready recipe from missing crafting credits', () => {
  const work = getGrowthRecipeWork(actor({ simCredits: 0 }), [{ _id: leaf.itemId }, recipe], recipe._id);
  assert.equal(work.readyCraftId, '');
  assert.equal(work.blocked, 'insufficient_credits');
  assert.equal(work.requiredCredits, 7);
  assert.equal(work.availableCredits, 0);
  const who = actor({ simCredits: 0, routePlanTargetItemIds: [growthGoal._id], _growthPlan: { targetId: growthGoal._id } });
  const view = getActorGrowthObservation(who, [{ _id: leaf.itemId }, recipe, growthGoal]);
  assert.equal(view.targetId, growthGoal._id); assert.match(view.materials, /필요 7Cr.*보유 0Cr/);
});

await test('initial route candidates count the same batch yield as ongoing growth planning', () => {
  const raw = { _id: leaf.itemId, name: '약초', type: '재료', tier: 1, spawnZones: ['a'] };
  const intermediate = { ...recipe, _id: 'intermediate', type: '재료', recipe: { ...recipe.recipe, creditsCost: 0 } };
  const target = { _id: 'target', name: '맞춤 모자', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: intermediate._id, qty: 3 }] } };
  const items = [raw, intermediate, target];
  const candidates = buildDay1TargetCandidatesBySlot(actor(), items, buildItemIndexes(items), { zones: [{ zoneId: 'a' }] });
  assert.equal(candidates.get('head')[0].requirements[0].qty, 2);
});
await test('PvP loot and its follow-up crafting pay and emit actual receipts, without duplicate death rewards', () => {
  const winner = actor({ inventory: [{ ...leaf, qty: 1 }], zoneId: 'a' });
  const loser = actor({ _id: 'loser', inventory: [{ ...leaf, qty: 1 }], simCredits: 0, zoneId: 'a' });
  const events = [];
  const runtime = createPhaseCombatEliminationRuntime({ state: { craftables: [recipe], publicItems: [{ ...leaf, _id: leaf.itemId }, recipe],
    itemNameById: {}, itemMetaById: {}, nextDay: 1, phaseIdxNow: 0, ruleset: rules, pvpCfg: { lootInventoryUnits: 1 },
    phaseSurvivors: [winner, loser] }, actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  withSimulationRandom(() => 0, () => runtime.applyCombatElimination(winner, loser, { deferAftermath: true }));
  assert.equal(winner.simCredits, 13);
  assert.equal(invQty(winner.inventory, recipe._id), 3);
  assert.equal(events.filter((event) => event.kind === 'craft').length, 1);
  assert.equal(events.find((event) => event.kind === 'craft').paidCost, 7);
  const before = resources(winner);
  assert.equal(runtime.applyCombatElimination(winner, loser).duplicate, true);
  assert.equal(resources(winner), before);
});
await test('forged prepared output and failed automatic dropping leave every existing item intact', async () => {
  const { prepareCraftTransaction, commitCraftTransaction } = await transactions();
  const who = actor();
  const prepared = prepareCraftTransaction(who, recipe, 1, rules);
  prepared.inventory.find((item) => item.itemId === recipe._id).qty = 6;
  const before = resources(who);
  assert.equal(commitCraftTransaction(who, prepared).ok, false);
  assert.equal(resources(who), before);
  const droppable = actor({ inventory: [structuredClone(leaf), { itemId: 'junk', name: '잔해', type: '재료', qty: 1, tier: 1 }] });
  const bagBefore = resources(droppable);
  const tooLarge = { ...recipe, tier: 4, recipe: { ...recipe.recipe, resultQty: 7 } };
  const smallBag = { inventory: { ...rules.inventory, maxSlots: 2, autoDropLowValue: true, autoDropMinIncomingScore: 0, autoDropScoreMargin: 0 } };
  assert.equal(prepareCraftTransaction(droppable, tooLarge, 1, smallBag).ok, false);
  assert.equal(resources(droppable), bagBefore);
});
await test('observer capacity warning uses the current match rules and is read-only', () => {
  const who = actor({ routePlanTargetItemIds: [growthGoal._id], _growthPlan: { targetId: growthGoal._id } });
  const before = JSON.stringify(who);
  const limited = { inventory: { ...rules.inventory, stackMax: { ...rules.inventory.stackMax, consumable: 2 } } };
  const view = getActorGrowthObservation(who, [{ _id: leaf.itemId }, recipe, growthGoal], { ruleset: limited });
  assert.equal(view.targetId, growthGoal._id);
  assert.match(view.materials, /수량 전체.*공간 부족/);
  assert.equal(JSON.stringify(who), before);
});
await test('craft receipts survive both account compaction boundaries with bounded material entries', () => {
  const who = actor(), events = [];
  emitCraftRunEvent((kind, data) => events.push({ kind, ...data }), who._id, craft(who));
  const source = readFileSync(new URL('../../server/routes/game.js', import.meta.url), 'utf8');
  const compactSource = source.slice(source.indexOf('function compactRunEventsForStorage('), source.indexOf('function buildRunSummary('));
  const compact = runInNewContext(`${compactSource}; compactRunEventsForStorage`);
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  const compactStart = finish.indexOf('const compactRunEvents =');
  const compactEnd = finish.indexOf('.filter(Boolean);', compactStart) + '.filter(Boolean);'.length;
  assert.ok(compactStart >= 0 && compactEnd > compactStart, 'the actual client event compaction block must exist');
  const clientSource = finish.slice(compactStart, compactEnd);
  events[0].consumed.push({ itemId: 'invalid', qty: Infinity });
  const submitted = runInNewContext(`${clientSource}; compactRunEvents`, { runEvents: events });
  const [restored] = JSON.parse(JSON.stringify(compact(submitted)));
  assert.equal(restored.qty, 3);
  assert.deepEqual(restored.consumed, [{ itemId: leaf.itemId, itemName: leaf.itemId, qty: 2 }]);
  assert.equal(describeCraftReceipt(restored), describeCraftReceipt(events[0]));
});

// Construct the reservation case directly, never from an exported old match.
const otherGrowth = (reservedQty = 2, blocked = '') => ({ targetId: 'other-gear', targetIds: ['other-gear'],
  craftIds: [], componentIds: [], reservedQtyById: { [leaf.itemId]: reservedQty }, blocked });
await test('an active gear goal permits consumable crafting from genuinely surplus ingredients', () => {
  const who = actor({ _growthPlan: otherGrowth() });
  const planBefore = JSON.stringify(who._growthPlan);
  const result = craft(who);
  assert.equal(result?.craftedId, recipe._id);
  assert.equal(result.receipt.paidCost, 7);
  assert.deepEqual(result.receipt.consumed, [{ itemId: leaf.itemId, qty: 2 }]);
  assert.equal(invQty(who.inventory, recipe._id), 3);
  assert.equal(invQty(who.inventory, leaf.itemId), 2);
  assert.equal(who.simCredits, 13);
  assert.equal(JSON.stringify(who._growthPlan), planBefore);
});
await test('consumables never spend reserved gear ingredients, including a blocked goal', () => {
  for (const blocked of ['', 'inventory_full', 'insufficient_credits']) {
    const who = actor({ _growthPlan: otherGrowth(3, blocked) });
    const before = resources(who);
    assert.equal(craft(who), null);
    assert.equal(loot(who), null);
    assert.equal(resources(who), before);
  }
});
await test('loot preparation shares the same surplus reservation and commits the real food batch once', async () => {
  const { commitCraftTransaction } = await transactions();
  const who = actor({ _growthPlan: otherGrowth() });
  const before = resources(who);
  const result = loot(who);
  assert.ok(result?.transaction);
  assert.equal(resources(who), before);
  assert.equal(commitCraftTransaction(who, result.transaction).ok, true);
  assert.equal(invQty(who.inventory, leaf.itemId), 2);
  assert.equal(invQty(who.inventory, recipe._id), 3);
  assert.equal(who.simCredits, 13);
  assert.equal(loot(who), null, 'the remaining ingredients now belong entirely to the gear goal');
  const after = resources(who);
  assert.equal(commitCraftTransaction(who, result.transaction).ok, false);
  assert.equal(resources(who), after);
});
await test('a ready focused gear recipe still precedes a higher-tier surplus consumable', () => {
  const target = { ...growthGoal, recipe: { ingredients: [{ itemId: leaf.itemId, qty: 2 }], creditsCost: 5 } };
  const who = actor({ _growthPlan: { ...otherGrowth(), targetId: target._id, targetIds: [target._id], craftIds: [target._id] } });
  const result = tryAutoCraftFromInventory(who, [{ ...recipe, tier: 6 }, target], {}, {}, 1, 0, rules);
  assert.equal(result?.craftedId, target._id);
  assert.equal(invQty(who.inventory, recipe._id), 0);
  assert.equal(invQty(who.inventory, leaf.itemId), 2);
  assert.equal(who.simCredits, 15);
});
await test('surplus eligibility cannot bypass real cost, missing materials or full output capacity', () => {
  for (const extra of [{ simCredits: 6 }, { inventory: [] },
    { inventory: [structuredClone(leaf), { ...recipe, itemId: recipe._id, qty: 5 }] }]) {
    const who = actor({ _growthPlan: otherGrowth(0), ...extra });
    const before = resources(who);
    assert.equal(craft(who), null);
    assert.equal(loot(who), null);
    assert.equal(resources(who), before);
  }
});

// Real remaining recipe accounting, not a manufactured reservation or an old
// journal. One finite dye is still to be gathered; twenty credits finish gear.
function paidGrowthFixture(credits = 20) {
  const raw = { ...leaf, _id: leaf.itemId, spawnZones: ['a'] };
  const dye = { _id: 'custom:paid-dye', name: '맞춤 염료', type: '재료', tier: 1, spawnZones: ['a'] };
  const food = { ...recipe, consumeEffect: { version: 1, heal: 25 } };
  const target = { ...growthGoal, recipe: { ingredients: [{ itemId: raw._id, qty: 2 }, { itemId: dye._id, qty: 1 }], creditsCost: 20 } };
  const catalog = [raw, dye, food, target];
  const mapObj = { _id: 'fresh-paid-growth', zones: [{ zoneId: 'a' }], fieldResourceStock: { a: { [dye._id]: 1 } } };
  const fieldResources = createFieldResources(mapObj, catalog, rules);
  const world = { mapObj, zoneGraph: { a: [] }, fieldResources, ruleset: rules };
  const who = actor({ simCredits: credits, zoneId: 'a', routePlanTargetItemIds: [target._id], _growthFocusId: target._id });
  const plan = refreshActorGrowthPlan(who, catalog, world);
  assert.equal(plan.targetId, target._id); assert.equal(plan.blocked, '');
  assert.equal(plan.plannedCredits, 20); assert.equal(plan.readyCraftId, '');
  assert.equal(plan.reservedQtyById[raw._id], 2); assert.deepEqual(plan.currentZoneItemIds, [dye._id]);
  return { who, raw, dye, food, target, catalog, world, fieldResources };
}

await test('routine surplus food cannot consume the credits needed to finish the current equipment recipe', () => {
  for (const credits of [19, 20, 26]) {
    const { who, food } = paidGrowthFixture(credits);
    const before = resources(who);
    assert.equal(craft(who, food), null, `routine food must retain a twenty-credit recipe budget from ${credits}`);
    assert.equal(loot(who, food), null);
    assert.equal(resources(who), before);
  }
});

await test('the ordinary action queue gathers the missing gear material instead of spending its reserved credits on food', () => {
  const { who, catalog, world, fieldResources, dye } = paidGrowthFixture();
  const before = resources(who);
  const queue = prepareActorPhaseActionPlan({ state: { actor: who, ...world, publicItems: catalog, craftables: catalog,
    itemMetaById: Object.fromEntries(catalog.map(item => [item._id, item])),
    itemNameById: Object.fromEntries(catalog.map(item => [item._id, item.name])),
    nextDay: 1, nextPhase: 'morning', phaseIdxNow: 0 } });
  assert.equal(queue.queuedActionType, 'routeFarm');
  assert.equal(resources(who), before); assert.equal(getFieldResourceQty(fieldResources, 'a', dye._id), 1);
});

await test('genuine surplus credits still fund food before finite pickup and paid equipment completion', () => {
  for (const credits of [27, 30]) {
    const { who, dye, food, target, catalog, world, fieldResources } = paidGrowthFixture(credits);
    const made = craft(who, food);
    assert.equal(made.craftedId, food._id); assert.equal(made.receipt.paidCost, 7);
    assert.equal(who.simCredits, credits - 7); assert.equal(invQty(who.inventory, leaf.itemId), 2);
    assert.equal(invQty(who.inventory, food._id), 3);
    const acquired = collectFieldResourceLoot(fieldResources, { item: dye, itemId: dye._id, zoneId: 'a', qty: 1 }, qty => {
      const next = addItemToInventory(who.inventory, dye, dye._id, qty, 1, rules);
      if (next._lastAdd.acceptedQty) who.inventory = next;
      return next._lastAdd.acceptedQty;
    });
    assert.equal(acquired, 1); assert.equal(getFieldResourceQty(fieldResources, 'a', dye._id), 0);
    who._actionCycleKey = 'paid-growth:next';
    assert.equal(refreshActorGrowthPlan(who, catalog, world).readyCraftId, target._id);
    const equipped = tryAutoCraftFromInventory(who, [food, target], {}, {}, 1, 0, rules);
    assert.equal(equipped.craftedId, target._id); assert.equal(equipped.receipt.paidCost, 20);
    assert.equal(who.simCredits, credits - 27); assert.equal(who.equipped.head, target._id);
    assert.equal(invQty(who.inventory, leaf.itemId), 0); assert.equal(invQty(who.inventory, dye._id), 0);
    assert.equal(getActorGrowthProgress(who, catalog).openingComplete, true);
  }
});

await test('zero-cost surplus food and a consumable required by the gear recipe remain legitimate crafts', () => {
  const { who, food } = paidGrowthFixture(19);
  const free = { ...food, recipe: { ...food.recipe, creditsCost: 0 } };
  assert.equal(craft(who, free).craftedId, food._id); assert.equal(who.simCredits, 19);
  const paidHead = { ...growthGoal, recipe: { ...growthGoal.recipe, creditsCost: 3 } };
  const intermediate = actor({ simCredits: 10, routePlanTargetItemIds: [paidHead._id], zoneId: 'a' });
  const catalog = [{ _id: leaf.itemId, name: leaf.name, type: '재료' }, food, paidHead];
  refreshActorGrowthPlan(intermediate, catalog, { mapObj: { zones: [{ zoneId: 'a' }] }, zoneGraph: { a: [] }, ruleset: rules });
  assert.equal(intermediate._growthPlan.plannedCredits, 10);
  assert.equal(craft(intermediate, food).craftedId, food._id); assert.equal(intermediate.simCredits, 3);
  intermediate._actionCycleKey = 'paid-intermediate:next';
  refreshActorGrowthPlan(intermediate, catalog, { mapObj: { zones: [{ zoneId: 'a' }] }, zoneGraph: { a: [] }, ruleset: rules });
  assert.equal(craft(intermediate, paidHead).craftedId, paidHead._id); assert.equal(intermediate.simCredits, 0);
});

await test('urgent recovery still uses its own real recipe budget instead of waiting for future equipment', () => {
  const { who, food, catalog, world } = paidGrowthFixture(); who.hp = 3;
  const recovery = buildActorRecoveryPlan(who, catalog, world);
  assert.equal(recovery.mode, 'craft'); assert.equal(recovery.readyCraftId, food._id);
  const made = craftActorRecoveryItem(who, recovery, catalog, 1, 0, rules);
  assert.equal(made.receipt.paidCost, 7); assert.equal(who.simCredits, 13);
  const used = forceUseConsumableAtIndex(who, who.inventory.findIndex(item => item.itemId === food._id));
  assert.equal(used.used, true); assert.equal(who.hp, 28); assert.equal(invQty(who.inventory, leaf.itemId), 2);
  assert.equal(who._growthPlan.targetId, growthGoal._id);
});

console.log(`CUSTOM_CRAFTING_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
