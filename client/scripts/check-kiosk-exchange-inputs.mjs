import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { fixture, plan, tick, refresh, hero, tree, rare, gear, items } = await import('./lib/team-purchase-fixture.mjs');
const { getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { quoteDefaultKioskGoalAction } = await import('../src/app/simulation/_lib/kioskGoalQuoteRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng, restoreSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const noRandom = () => { throw Error('A force-core input quote cannot draw RNG.'); };
const buyerOf = input => input.roster.find(actor => actor._id === 'crafter');
function exchangeFixture({ solo = true, reverse = false, tagged = false, credits = 3,
  held = ['meteor', 'life_tree'] } = {}) {
  const input = fixture(), buyer = buyerOf(input);
  const meteor = { ...tree, _id: 'exchange-held-meteor', name: '운석' };
  const life = { ...tree, _id: 'exchange-held-life', name: '생명의 나무' };
  const core = { ...tree, _id: 'exchange-needed-core', name: '포스 코어' };
  const decoyMeteor = { ...meteor, _id: 'exchange-unheld-meteor', ...(tagged ? { tags: ['meteor'] } : {}) };
  const decoyLife = { ...life, _id: 'exchange-unheld-life', ...(tagged ? { tags: ['life_tree'] } : {}) };
  const decoyCore = { ...core, _id: 'exchange-unneeded-core', tags: ['force_core'] };
  const target = gear(rare._id, '포스 모자', core._id);
  buyer.simCredits = credits;
  buyer.inventory.push(...[...(held.includes('meteor') ? [meteor] : []), ...(held.includes('life_tree') ? [life] : [])]
    .map(item => ({ ...item, itemId: item._id, qty: 1 })));
  if (solo) { input.roster = [buyer]; input.state.isSoloMatch = true; }
  const catalog = [decoyMeteor, decoyLife, decoyCore, ...items.filter(item => ![tree._id, rare._id].includes(item._id)),
    meteor, life, core, target];
  refresh(input, reverse ? catalog.reverse() : catalog);
  return { ...input, meteor, life, core, target, decoyMeteor, decoyLife, decoyCore };
}
function decisions(input) {
  const { state } = input, buyer = buyerOf(input), craftGoal = getActorGrowthCraftGoal(buyer, state.publicItems);
  const before = structuredClone({ roster: input.roster, spawn: state.nextSpawn, shops: state.kiosks,
    ruleset: state.ruleset, items: state.publicItems });
  const quote = withSimulationRandom(noRandom, () => quoteDefaultKioskGoalAction({ actor: buyer, craftGoal,
    publicItems: state.publicItems, ruleset: state.ruleset, day: state.nextDay, phase: state.nextPhase }));
  const movement = withSimulationRandom(noRandom, () => chooseAiMoveTargets({ actor: buyer, craftGoal,
    mapObj: state.mapObj, kiosks: state.kiosks, publicItems: state.publicItems, spawnState: state.nextSpawn,
    forbiddenIds: state.forbiddenIds, ruleset: state.ruleset, day: state.nextDay, phase: state.nextPhase,
    isSoloMatch: state.isSoloMatch }));
  const shared = withSimulationRandom(noRandom, () => plan(input));
  const action = withSimulationRandom(() => 0, () => rollKioskInteraction(state.mapObj, 'c', state.kiosks,
    state.publicItems, state.nextDay, state.nextPhase, buyer, craftGoal, state.itemNameById,
    state.ruleset.market, state.ruleset));
  assert.deepEqual({ roster: input.roster, spawn: state.nextSpawn, shops: state.kiosks,
    ruleset: state.ruleset, items: state.publicItems }, before);
  return { quote, action, movement, shared };
}
function runRecipe(input, { restore = false, kinds = ['kioskExchange'] } = {}) {
  const beforeCredits = buyerOf(input).simCredits, events = [];
  let random = createSeedRng('kiosk:recipe:ordered:0');
  const arrived = tick(input, random); input.roster = arrived.updatedSurvivors; events.push(...arrived.events);
  assert.equal(buyerOf(input).zoneId, 'c');
  assert.ok(!arrived.events.some(event => event.kind === 'procurement' && event.who === 'crafter'));
  if (restore) {
    const frame = createSimulationFrame({ survivors: input.roster, dead: [], day: input.state.nextDay,
      phase: input.state.nextPhase, matchSec: 500, spawnState: input.state.nextSpawn,
      forbiddenIds: input.state.forbiddenIds, mapId: input.state.mapObj._id });
    const saved = JSON.parse(JSON.stringify({ frame, randomState: random.getState() }));
    input.roster = saved.frame.survivors; input.state.nextSpawn = saved.frame.spawnState;
    random = restoreSeedRng(saved.randomState);
  }
  let matchSec = 500;
  for (const sec of [540, 580, 620, 660, 700]) {
    input.state.currentActionSec = () => sec;
    const result = tick(input, random); input.roster = result.updatedSurvivors; events.push(...result.events); matchSec = sec;
    if (buyerOf(input).equipped.head === input.target._id) break;
  }
  const after = buyerOf(input), receipts = events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.deepEqual(receipts.map(event => event.actionType), kinds);
  const totalPaid = receipts.reduce((sum, event) => sum + event.paidCost, 0);
  assert.equal(totalPaid, beforeCredits - 3); assert.equal(after.simCredits, 0);
  assert.equal(after.equipped.head, input.target._id); assert.equal(invQty(after.inventory, input.core._id), 0);
  assert.equal(invQty(after.inventory, input.decoyCore._id), 0); assert.equal(invQty(after.inventory, hero._id), 0);
  const craft = events.filter(event => event.kind === 'craft' && event.who === 'crafter');
  assert.equal(craft.length, 1); assert.equal(craft[0].paidCost, 3); assert.equal(craft[0].afterCredits, 0);
  assert.ok(input.roster.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
  const lastReceipt = receipts.at(-1);
  assert.equal(lastReceipt.itemId, input.core._id);
  const model = buildTeamObserverModel({ teamId: after.teamId, publicItems: input.state.publicItems,
    spawnState: input.state.nextSpawn, forbiddenIds: [], settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
    day: input.state.nextDay, phase: input.state.nextPhase, survivors: JSON.parse(JSON.stringify(input.roster)),
    events: JSON.parse(JSON.stringify(events)), matchSec });
  const observed = model.members.find(member => member.id === 'crafter').procurement;
  assert.equal(observed.matchedChoice, true); assert.equal(observed.outcome, 'completed');
  assert.equal(observed.actionKey, lastReceipt.actionKey);
  console.log(`FORCE_CORE_INPUT_WITNESS ${JSON.stringify({ solo: !!input.state.isSoloMatch, restored: restore,
    orderedActions: kinds, paid: totalPaid, recipeCost: 3, remainingCredits: after.simCredits,
    consumed: lastReceipt.consumed.map(row => row.itemId), output: lastReceipt.itemId,
    equipped: after.equipped.head, observerActionKey: observed.actionKey })}`);
  return { after, receipts, craft };
}
function assertFreeQuote(input) {
  const decision = decisions(input);
  assert.equal(decision.quote?.kind, 'exchange'); assert.equal(decision.quote.itemId, input.core._id);
  assert.deepEqual(decision.action, decision.quote); assert.deepEqual(decision.movement.targets, ['c']);
  assert.ok(decision.quote.consume.every(row => invQty(buyerOf(input).inventory, row.itemId) >= row.qty));
  return decision;
}

check('owned second IDs enable actual solo exchange and crafting across order, tag and saved-frame variants', () => {
  for (const reverse of [false, true]) for (const tagged of [false, true]) for (const restore of [false, true]) {
    const input = exchangeFixture({ reverse, tagged }); assertFreeQuote(input);
    const result = runRecipe(input, { restore });
    assert.deepEqual(new Set(result.receipts[0].consumed.map(row => row.itemId)), new Set([input.meteor._id, input.life._id]));
  }
});
check('a real shared exchange sends three members to the kiosk without transferring their personal money', () => {
  for (const reverse of [false, true]) {
    const input = exchangeFixture({ solo: false, reverse, tagged: true });
    const decision = assertFreeQuote(input);
    assert.equal([...decision.shared.movementPlans.values()].filter(move => /^팀 제작 교환:/.test(move.sourceReason)).length, 3);
    runRecipe(input);
  }
});
check('a protected preferred meteor is preserved by choosing another owned ID for the free exchange', () => {
  const input = exchangeFixture(), spare = { ...input.meteor, _id: 'exchange-spare-meteor' };
  buyerOf(input).inventory.push({ ...spare, itemId: spare._id, qty: 1 });
  const target = { ...input.target, recipe: { ...input.target.recipe,
    ingredients: [...input.target.recipe.ingredients, { itemId: input.meteor._id, qty: 1 }] } };
  refresh(input, [input.meteor, ...input.state.publicItems.filter(item => ![input.meteor._id, target._id].includes(item._id)), spare, target]);
  const decision = assertFreeQuote(input);
  assert.ok(!decision.quote.consume.some(row => row.itemId === input.meteor._id));
  assert.ok(decision.quote.consume.some(row => row.itemId === spare._id));
  const result = runRecipe(input);
  assert.ok(result.craft[0].consumed.some(row => row.itemId === input.meteor._id));
});
check('a protected preferred life tree is preserved by choosing another owned ID for the free exchange', () => {
  const input = exchangeFixture(), spare = { ...input.life, _id: 'exchange-spare-life' };
  buyerOf(input).inventory.push({ ...spare, itemId: spare._id, qty: 1 });
  const target = { ...input.target, recipe: { ...input.target.recipe,
    ingredients: [...input.target.recipe.ingredients, { itemId: input.life._id, qty: 1 }] } };
  refresh(input, [input.life, ...input.state.publicItems.filter(item => ![input.life._id, target._id].includes(item._id)), spare, target]);
  const decision = assertFreeQuote(input);
  assert.ok(!decision.quote.consume.some(row => row.itemId === input.life._id));
  assert.ok(decision.quote.consume.some(row => row.itemId === spare._id));
  const result = runRecipe(input);
  assert.ok(result.craft[0].consumed.some(row => row.itemId === input.life._id));
});
check('fully protected inputs reject exchange and keep the affordable exact direct purchase fallback', () => {
  for (const credits of [3, 353]) {
    const input = exchangeFixture({ credits });
    const target = { ...input.target, recipe: { ...input.target.recipe, ingredients: [...input.target.recipe.ingredients,
      { itemId: input.meteor._id, qty: 1 }, { itemId: input.life._id, qty: 1 }] } };
    refresh(input, input.state.publicItems.map(item => item._id === target._id ? target : item));
    const decision = decisions(input);
    if (credits === 3) {
      assert.equal(decision.quote, null); assert.equal(decision.action, null);
      assert.ok(!decision.movement.targets.includes('c'));
      buyerOf(input).zoneId = 'c'; const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
      assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
      assert.equal(invQty(actual.updatedSurvivors[0].inventory, input.meteor._id), 1);
      assert.equal(invQty(actual.updatedSurvivors[0].inventory, input.life._id), 1);
    } else {
      assert.equal(decision.quote.kind, 'buy'); assert.equal(decision.quote.itemId, input.core._id);
      assert.equal(decision.quote.cost, 350); runRecipe(input, { kinds: ['kioskBuy'] });
    }
  }
});
check('one owned nonpreferred input buys only the other component and then exchanges within the recipe budget', () => {
  for (const key of ['meteor', 'life_tree']) for (const discount of [0, 0.5]) {
    const input = exchangeFixture({ credits: (discount ? 100 : 200) + 3, held: [key], tagged: true });
    if (discount) buyerOf(input)._perkRuntime = { kioskDiscountPct: discount };
    const decision = decisions(input), boughtId = key === 'meteor' ? input.decoyLife._id : input.decoyMeteor._id;
    assert.equal(decision.quote?.kind, 'buy'); assert.equal(decision.quote.itemId, boughtId);
    assert.equal(decision.quote.cost, discount ? 100 : 200); assert.deepEqual(decision.action, decision.quote);
    const result = runRecipe(input, { kinds: ['kioskBuy', 'kioskExchange'], restore: true });
    assert.equal(result.receipts[0].itemId, boughtId); assert.equal(result.receipts[0].afterCredits, 3);
    assert.ok(result.receipts[1].consumed.some(row => row.itemId === boughtId));
    assert.ok(result.receipts[1].consumed.some(row => row.itemId === (key === 'meteor' ? input.meteor._id : input.life._id)));
    const short = exchangeFixture({ credits: (discount ? 100 : 200) + 2, held: [key], tagged: true });
    if (discount) buyerOf(short)._perkRuntime = { kioskDiscountPct: discount };
    assert.equal(decisions(short).quote, null); assert.equal(decisions(short).action, null);
  }
  for (const key of ['meteor', 'life_tree']) {
    const input = exchangeFixture({ credits: 203, held: [key] });
    const protectedItem = key === 'meteor' ? input.meteor : input.life;
    const target = { ...input.target, recipe: { ...input.target.recipe,
      ingredients: [...input.target.recipe.ingredients, { itemId: protectedItem._id, qty: 1 }] } };
    refresh(input, input.state.publicItems.map(item => item._id === target._id ? target : item));
    const blocked = decisions(input); assert.equal(blocked.quote, null); assert.equal(blocked.action, null);
    assert.ok(!blocked.movement.targets.includes('c'));
    buyerOf(input).zoneId = 'c'; const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
    assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
    assert.equal(invQty(actual.updatedSurvivors[0].inventory, protectedItem._id), 1);
    const viable = exchangeFixture({ credits: 203, held: [key] });
    const spare = { ...protectedItem, _id: `exchange-component-spare-${key}` };
    buyerOf(viable).inventory.push({ ...spare, itemId: spare._id, qty: 1 });
    refresh(viable, [...viable.state.publicItems.filter(item => item._id !== target._id), spare, target]);
    assert.equal(decisions(viable).quote.kind, 'buy');
    const result = runRecipe(viable, { kinds: ['kioskBuy', 'kioskExchange'] });
    assert.ok(result.receipts[1].consumed.some(row => row.itemId === spare._id));
    assert.ok(!result.receipts[1].consumed.some(row => row.itemId === protectedItem._id));
    assert.ok(result.craft[0].consumed.some(row => row.itemId === protectedItem._id));
  }
  const full = exchangeFixture({ credits: 203, held: ['meteor'] });
  full.state.ruleset.inventory = { ...full.state.ruleset.inventory, maxSlots: 2, autoDropLowValue: false };
  assert.equal(decisions(full).quote, null); assert.equal(decisions(full).action, null);
  buyerOf(full).zoneId = 'c'; const actual = tick(full, createSeedRng('kiosk:recipe:ordered:0'));
  assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
});
check('absent or policy-restricted owned inputs cannot be invented and a later allowed input remains usable', () => {
  for (const boundary of ['absent', 'food', 'inventory-food', 'insufficient-recipe-fee']) {
    const input = exchangeFixture();
    if (boundary === 'absent') refresh(input, input.state.publicItems.filter(item => item._id !== input.meteor._id));
    if (boundary === 'food') refresh(input, input.state.publicItems.map(item => item._id === input.meteor._id ? { ...item, tags: ['food'] } : item));
    if (boundary === 'inventory-food') buyerOf(input).inventory.find(row => row.itemId === input.meteor._id).tags = ['food'];
    if (boundary === 'insufficient-recipe-fee') buyerOf(input).simCredits = 2;
    const decision = decisions(input); assert.equal(decision.quote, null); assert.equal(decision.action, null);
    assert.ok([...decision.shared.movementPlans.values()].every(move => !/^팀 제작 교환:/.test(move.sourceReason)));
    buyerOf(input).zoneId = 'c'; const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
    assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
  }
  const input = exchangeFixture(), spare = { ...input.meteor, _id: 'exchange-allowed-meteor' };
  buyerOf(input).inventory.find(row => row.itemId === input.meteor._id).tags = ['food'];
  buyerOf(input).inventory.push({ ...spare, itemId: spare._id, qty: 1 });
  refresh(input, [input.meteor, ...input.state.publicItems.filter(item => item._id !== input.meteor._id), spare]);
  const decision = assertFreeQuote(input);
  assert.ok(decision.quote.consume.some(row => row.itemId === spare._id));
  const result = runRecipe(input); assert.equal(invQty(result.after.inventory, input.meteor._id), 1);
  const restrictedOnly = exchangeFixture({ credits: 203, held: ['meteor'] });
  buyerOf(restrictedOnly).inventory.find(row => row.itemId === restrictedOnly.meteor._id).tags = ['food'];
  assert.equal(decisions(restrictedOnly).quote, null); assert.equal(decisions(restrictedOnly).action, null);
  buyerOf(restrictedOnly).zoneId = 'c'; const actual = tick(restrictedOnly, createSeedRng('kiosk:recipe:ordered:0'));
  assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
});
check('time, sales-category and authored-shop gates keep their normal movement and exact-input contracts', () => {
  for (const boundary of ['early', 'disabled', 'authored-empty', 'authored-wrong-input']) {
    const input = exchangeFixture({ solo: false });
    if (boundary === 'early') { input.state.nextDay = 1; input.state.phaseIdxNow = 0; }
    if (boundary === 'disabled') input.state.ruleset.market.kiosk.categories.legendary = false;
    if (boundary.startsWith('authored')) input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', hasCustomCatalog: true,
      catalog: boundary === 'authored-empty' ? [] : [{ mode: 'exchange', itemId: input.core._id,
        exchange: { giveItemId: input.decoyMeteor._id, giveQty: 1 } }] }];
    const decision = decisions(input); assert.equal(decision.action, null);
    assert.ok(!decision.movement.targets.includes('c'));
    assert.ok([...decision.shared.movementPlans.values()].every(move => !/^팀 제작 교환:/.test(move.sourceReason)));
    buyerOf(input).zoneId = 'c'; const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
    assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
  }
});
check('split quantities are conserved and two core outputs consume one owned pair quantity per exchange', () => {
  const input = exchangeFixture({ credits: 3 });
  for (const item of [input.meteor, input.life]) {
    buyerOf(input).inventory.push({ ...item, itemId: item._id, qty: 1 });
  }
  const target = { ...input.target, recipe: { ...input.target.recipe,
    ingredients: input.target.recipe.ingredients.map(row => row.itemId === input.core._id ? { ...row, qty: 2 } : row) } };
  refresh(input, input.state.publicItems.map(item => item._id === target._id ? target : item));
  assertFreeQuote(input); const result = runRecipe(input, { kinds: ['kioskExchange', 'kioskExchange'], restore: true });
  assert.equal(result.receipts.length, 2);
  for (const receipt of result.receipts) {
    assert.equal(receipt.paidCost, 0);
    assert.deepEqual(new Set(receipt.consumed.map(row => row.itemId)), new Set([input.meteor._id, input.life._id]));
  }
  assert.equal(invQty(result.after.inventory, input.meteor._id), 0); assert.equal(invQty(result.after.inventory, input.life._id), 0);
  assert.ok(result.craft[0].consumed.some(row => row.itemId === input.core._id && row.qty === 2));
});
console.log(`Kiosk exchange input checks passed: ${checks}/${checks}`);
