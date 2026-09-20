import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { getLootCraftOptions, emitCraftRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { tryImmediateCraftFromSpecial } = await import('../src/app/simulation/_lib/gearImmediateSpecialCraftRuntime.js');
const { runCraftAction } = await import('../src/app/simulation/_lib/phaseCraftActionRuntime.js');
const { getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorGrowthObservation, describeCraftReceipt } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { buildItemIndexes, buildDay1TargetCandidatesBySlot } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { createPhaseCombatEliminationRuntime } = await import('../src/app/simulation/_lib/phaseCombatEliminationRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, consumable: 6, equipment: 1 }, autoDropLowValue: false } };
const leaf = { itemId: 'custom:leaf', name: '약초', type: '재료', qty: 4, tier: 1 };
const recipe = { _id: 'custom:food', name: '맞춤 음식', type: 'food', tier: 1,
  recipe: { ingredients: [{ itemId: leaf.itemId, qty: 2 }], resultQty: 3, creditsCost: 7 } };
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
  const who = actor({ simCredits: 0, routePlanTargetItemIds: [recipe._id], _growthPlan: { targetId: recipe._id } });
  assert.match(getActorGrowthObservation(who, [{ _id: leaf.itemId }, recipe]).materials, /필요 7Cr.*보유 0Cr/);
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
  const who = actor({ routePlanTargetItemIds: [recipe._id], _growthPlan: { targetId: recipe._id } });
  const before = JSON.stringify(who);
  const limited = { inventory: { ...rules.inventory, stackMax: { ...rules.inventory.stackMax, consumable: 2 } } };
  const view = getActorGrowthObservation(who, [{ _id: leaf.itemId }, recipe], { ruleset: limited });
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
  const clientSource = finish.slice(finish.indexOf('const compactRunEvents ='), finish.indexOf("await apiPost('/game/end'"));
  events[0].consumed.push({ itemId: 'invalid', qty: Infinity });
  const submitted = runInNewContext(`${clientSource}; compactRunEvents`, { runEvents: events });
  const [restored] = JSON.parse(JSON.stringify(compact(submitted)));
  assert.equal(restored.qty, 3);
  assert.deepEqual(restored.consumed, [{ itemId: leaf.itemId, itemName: leaf.itemId, qty: 2 }]);
  assert.equal(describeCraftReceipt(restored), describeCraftReceipt(events[0]));
});

console.log(`CUSTOM_CRAFTING_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
