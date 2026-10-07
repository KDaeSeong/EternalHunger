import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { fixture, plan, tick, refresh, hero, tree, rare, gear, items } = await import('./lib/team-purchase-fixture.mjs');
const { getActorGrowthCraftGoal, getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { quoteDefaultKioskGoalAction } = await import('../src/app/simulation/_lib/kioskGoalQuoteRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng, restoreSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { commitProcurementTransaction } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');

const routes = [
  { from: '운석', to: '생명의 나무', output: 'life_tree' },
  { from: '생명의 나무', to: '운석', output: 'meteor' },
  { from: '포스 코어', to: '미스릴', output: 'mithril' },
];
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const noRandom = () => { throw Error('A goal exchange quote cannot draw RNG.'); };
const buyerOf = input => input.roster.find(actor => actor._id === 'crafter');
function makeInput(route, { solo = true, reverse = false, credits = 3 } = {}) {
  const input = fixture(), buyer = buyerOf(input);
  const source = { ...tree, _id: `held-${route.output}`, name: route.from };
  const decoy = { ...source, _id: `unheld-${route.output}` };
  const output = { ...tree, _id: `required-${route.output}`, name: route.to };
  const target = gear(rare._id, `${route.to} 모자`, output._id);
  buyer.simCredits = credits;
  buyer.inventory.push({ ...source, itemId: source._id, qty: 1 });
  if (solo) { input.roster = [buyer]; input.state.isSoloMatch = true; }
  const catalog = [decoy, ...items.filter(item => ![tree._id, rare._id].includes(item._id)), source, output, target];
  refresh(input, reverse ? catalog.reverse() : catalog);
  return { ...input, source, decoy, output, target };
}
function decisions(input) {
  const { state } = input, actor = buyerOf(input), craftGoal = getActorGrowthCraftGoal(actor, state.publicItems);
  const before = structuredClone({ roster: input.roster, publicItems: state.publicItems,
    spawn: state.nextSpawn, kiosks: state.kiosks });
  const quote = withSimulationRandom(noRandom, () => quoteDefaultKioskGoalAction({ actor, craftGoal,
    publicItems: state.publicItems, ruleset: state.ruleset, day: state.nextDay, phase: state.nextPhase }));
  const movement = withSimulationRandom(noRandom, () => chooseAiMoveTargets({ actor, craftGoal,
    mapObj: state.mapObj, kiosks: state.kiosks, publicItems: state.publicItems, spawnState: state.nextSpawn,
    forbiddenIds: state.forbiddenIds, ruleset: state.ruleset, day: state.nextDay, phase: state.nextPhase,
    isSoloMatch: state.isSoloMatch }));
  const shared = withSimulationRandom(noRandom, () => plan(input));
  const action = withSimulationRandom(() => 0, () => rollKioskInteraction(state.mapObj, 'c', state.kiosks,
    state.publicItems, state.nextDay, state.nextPhase, actor, craftGoal, state.itemNameById,
    state.ruleset.market, state.ruleset));
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(state.publicItems, before.publicItems);
  assert.deepEqual(state.nextSpawn, before.spawn); assert.deepEqual(state.kiosks, before.kiosks);
  return { quote, movement, shared, action };
}
function runRecipe(input, restore = false) {
  const events = []; let random = createSeedRng('kiosk:recipe:ordered:0');
  const arrival = tick(input, random); input.roster = arrival.updatedSurvivors; events.push(...arrival.events);
  assert.equal(buyerOf(input).zoneId, 'c');
  assert.ok(!arrival.events.some(event => event.kind === 'procurement' && event.who === 'crafter'));
  if (restore) {
    const frame = createSimulationFrame({ survivors: input.roster, dead: [], day: input.state.nextDay,
      phase: input.state.nextPhase, matchSec: 500, spawnState: input.state.nextSpawn,
      forbiddenIds: input.state.forbiddenIds, mapId: input.state.mapObj._id });
    const saved = JSON.parse(JSON.stringify({ frame, random: random.getState() }));
    input.roster = saved.frame.survivors; input.state.nextSpawn = saved.frame.spawnState;
    random = restoreSeedRng(saved.random);
  }
  input.state.currentActionSec = () => 540;
  const paid = tick(input, random); input.roster = paid.updatedSurvivors; events.push(...paid.events);
  const after = buyerOf(input), receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.equal(receipts.length, 1, JSON.stringify({ source: input.source.name, actor: after, events: paid.events }));
  assert.equal(receipts[0].actionType, 'kioskExchange');
  assert.equal(receipts[0].itemId, input.output._id); assert.equal(receipts[0].paidCost, 0);
  assert.deepEqual(receipts[0].consumed.map(row => row.itemId), [input.source._id]);
  const crafts = paid.events.filter(event => event.kind === 'craft' && event.who === 'crafter');
  assert.equal(crafts.length, 1, JSON.stringify({ target: input.target._id, source: input.source.name,
    actor: after, events: paid.events })); assert.equal(crafts[0].paidCost, 3);
  assert.equal(after.simCredits, 0); assert.equal(after.equipped.head, input.target._id);
  for (const id of [input.source._id, input.output._id, hero._id]) assert.equal(invQty(after.inventory, id), 0);
  assert.ok(input.roster.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
  const observed = buildTeamObserverModel({ survivors: input.roster, dead: [], events, teamId: after.teamId,
    publicItems: input.state.publicItems, matchSec: 540, forbiddenIds: [], spawnState: input.state.nextSpawn,
    day: input.state.nextDay, phase: input.state.nextPhase,
    settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset } }).members.find(row => row.id === 'crafter').procurement;
  assert.equal(observed.actionKey, receipts[0].actionKey); assert.equal(observed.matchedChoice, true);
  return { after, receipt: receipts[0], craft: crafts[0] };
}

check('all three held-material routes reach exact goal exchange, paid craft and equip without purchase credits', () => {
  for (const route of routes) for (const reverse of [false, true]) for (const restore of [false, true]) {
    const input = makeInput(route, { reverse }); const decision = decisions(input);
    assert.equal(decision.quote?.kind, 'exchange', route.from + ' → ' + route.to);
    assert.deepEqual(decision.action, decision.quote); assert.deepEqual(decision.movement.targets, ['c']);
    runRecipe(input, restore);
  }
});
check('shared routes use the beneficiary inventory and preserve each other member personal money', () => {
  for (const route of routes) {
    const input = makeInput(route, { solo: false }); const decision = decisions(input);
    assert.equal([...decision.shared.movementPlans.values()].filter(move => /^팀 제작 교환:/.test(move.sourceReason)).length, 3);
    runRecipe(input, true);
  }
});

check('a protected preferred input is preserved by consuming another actually held ID', () => {
  for (const route of routes) {
    const input = makeInput(route), protectedItem = input.source;
    const spare = { ...protectedItem, _id: `spare-${route.output}` };
    buyerOf(input).inventory.push({ ...spare, itemId: spare._id, qty: 1 });
    input.target = { ...input.target, recipe: { ...input.target.recipe,
      ingredients: [...input.target.recipe.ingredients, { itemId: protectedItem._id, qty: 1 }] } };
    refresh(input, [protectedItem, ...input.state.publicItems.filter(item => ![protectedItem._id, input.target._id].includes(item._id)), spare, input.target]);
    input.source = spare;
    assert.deepEqual(decisions(input).quote?.consume, [{ itemId: spare._id, qty: 1 }]);
    const result = runRecipe(input, true);
    assert.ok(result.craft.consumed.some(row => row.itemId === protectedItem._id));
  }
});

check('goal exchanges reject unavailable, forbidden-policy, protected, fee-short and shop-gated inputs', () => {
  for (const route of routes) for (const boundary of ['missing-stock', 'input-food', 'output-food',
    'protected', 'fee-short', 'early', 'disabled', 'authored-empty']) {
    const input = makeInput(route, { solo: false }), buyer = buyerOf(input);
    if (boundary === 'missing-stock') refresh(input, input.state.publicItems.filter(item => item._id !== input.source._id));
    if (boundary === 'input-food') buyer.inventory.find(row => row.itemId === input.source._id).tags = ['food'];
    if (boundary === 'output-food') refresh(input, input.state.publicItems.map(item => item._id === input.output._id ? { ...item, tags: ['food'] } : item));
    if (boundary === 'protected') {
      input.target = { ...input.target, recipe: { ...input.target.recipe,
        ingredients: [...input.target.recipe.ingredients, { itemId: input.source._id, qty: 1 }] } };
      refresh(input, input.state.publicItems.map(item => item._id === input.target._id ? input.target : item));
    }
    if (boundary === 'fee-short') buyer.simCredits = 2;
    if (boundary === 'early') { input.state.nextDay = 1; input.state.phaseIdxNow = 0; }
    if (boundary === 'disabled') input.state.ruleset.market.kiosk.categories.legendary = false;
    if (boundary === 'authored-empty') input.state.kiosks = [{ mapId: input.state.mapObj._id,
      zoneId: 'c', hasCustomCatalog: true, catalog: [] }];
    const decision = decisions(input);
    assert.equal(decision.action, null, `${route.output}:${boundary}`);
    assert.ok(!/키오스크|구매|교환|kiosk/.test(decision.movement.reason || ''),
      JSON.stringify({ route: route.output, boundary, movement: decision.movement }));
    assert.ok([...decision.shared.movementPlans.values()].every(move => !/^팀 제작 교환:/.test(move.sourceReason)));
    buyer.zoneId = 'c'; const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
    assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.who === 'crafter'));
    const after = actual.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(invQty(after.inventory, input.source._id), 1); assert.equal(after.simCredits, buyer.simCredits);
  }
});

check('exchanges fit a full bag because their real consumed input releases a slot', () => {
  for (const route of routes) {
    const input = makeInput(route);
    input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 2, autoDropLowValue: false };
    assert.equal(decisions(input).quote?.kind, 'exchange'); runRecipe(input, true);
  }
});

check('multi-stage custom recipes retain every remaining fee and exact ingredient quantity', () => {
  for (const route of routes) for (const credits of [11, 12]) {
    const input = makeInput(route, { credits }), middle = { ...hero, _id: `middle-${route.output}`,
      itemKey: `middle-${route.output}`, name: '중간 부품', type: '재료', category: 'material', equipSlot: '', tier: 4,
      recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: input.output._id, qty: 1 }], resultQty: 2, creditsCost: 5 } };
    input.target = { ...input.target, recipe: { ingredients: [{ itemId: middle._id, qty: 2 }], resultQty: 1, creditsCost: 7 } };
    refresh(input, [...input.state.publicItems.filter(item => item._id !== input.target._id), middle, input.target]);
    if (credits === 11) { assert.equal(decisions(input).quote, null); assert.equal(decisions(input).action, null); continue; }
    const preview = structuredClone(buyerOf(input));
    const receipt = commitProcurementTransaction({ actor: preview, day: 3, ruleset: input.state.ruleset, actionType: 'kioskExchange',
      offer: { kind: 'exchange', item: input.output, itemId: input.output._id, qty: 1, consume: [{ itemId: input.source._id, qty: 1 }] } });
    assert.equal(decisions(input).quote?.kind, 'exchange', JSON.stringify({ route: route.output, credits, receipt,
      after: getGrowthRecipeWork(preview, input.state.publicItems, input.target._id, { ruleset: input.state.ruleset }),
      goal: getActorGrowthCraftGoal(buyerOf(input), input.state.publicItems),
      work: getGrowthRecipeWork(buyerOf(input), input.state.publicItems, input.target._id, { ruleset: input.state.ruleset }) }));
    const events = [], random = createSeedRng('kiosk:recipe:ordered:0');
    for (const sec of [500, 540, 580, 620, 660]) {
      input.state.currentActionSec = () => sec;
      const result = tick(input, random); input.roster = result.updatedSurvivors; events.push(...result.events);
      if (buyerOf(input).equipped.head === input.target._id) break;
    }
    const crafts = events.filter(event => event.kind === 'craft' && event.who === 'crafter');
    assert.deepEqual(crafts.map(event => event.paidCost), [5, 7]); assert.equal(crafts[0].qty, 2);
    assert.ok(crafts[1].consumed.some(row => row.itemId === middle._id && row.qty === 2));
    assert.equal(buyerOf(input).equipped.head, input.target._id); assert.equal(buyerOf(input).simCredits, 0);
  }
});

console.log(`Kiosk goal exchange checks passed: ${checks}/${checks}`);
