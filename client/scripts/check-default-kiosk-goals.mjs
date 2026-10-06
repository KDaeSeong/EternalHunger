import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { fixture, plan, tick, refresh, hero, tree, rare, items } = await import('./lib/team-purchase-fixture.mjs');
const { getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { computeLateGameUpgradeNeed } = await import('../src/app/simulation/_lib/gearUpgradeNeedRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { resolveActorMoveTargetMemory } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const noRandom = () => { throw Error('A movement quote cannot draw RNG.'); };
function solo(credits = 203) {
  const input = fixture(); input.roster = [input.roster[1]]; input.state.isSoloMatch = true;
  input.roster[0].simCredits = credits; refresh(input); return input;
}
function movement(input) {
  const { state } = input, actor = input.roster.find(row => row._id === 'crafter');
  return withSimulationRandom(noRandom, () => chooseAiMoveTargets({ actor,
    craftGoal: getActorGrowthCraftGoal(actor, state.publicItems),
    upgradeNeed: computeLateGameUpgradeNeed(actor, state.itemMetaById, state.itemNameById, state.nextDay, state.nextPhase, state.ruleset),
    mapObj: state.mapObj, kiosks: state.kiosks, publicItems: state.publicItems, spawnState: state.nextSpawn,
    forbiddenIds: state.forbiddenIds, day: state.nextDay, phase: state.nextPhase, ruleset: state.ruleset, isSoloMatch: state.isSoloMatch }));
}
function actionQuote(input, random = () => 0) {
  const { state } = input, actor = input.roster.find(row => row._id === 'crafter');
  return withSimulationRandom(random, () => rollKioskInteraction(state.mapObj, 'c', state.kiosks, state.publicItems,
    state.nextDay, state.nextPhase, actor, getActorGrowthCraftGoal(actor, state.publicItems), state.itemNameById,
    state.ruleset.market, state.ruleset,
    computeLateGameUpgradeNeed(actor, state.itemMetaById, state.itemNameById, state.nextDay, state.nextPhase, state.ruleset), 500));
}
function assertNoGoalOrder(input) {
  const snapshot = () => ({ roster: input.roster, spawn: input.state.nextSpawn,
    shops: input.state.kiosks, ruleset: input.state.ruleset });
  const before = structuredClone(snapshot());
  assert.ok(!movement(input).targets.includes('c'));
  assert.equal(actionQuote(input), null);
  assert.deepEqual(snapshot(), before);
  input.roster.forEach(actor => { actor.zoneId = 'c'; });
  const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
  assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.who === 'crafter' && event.source === 'kiosk'));
  const buyer = actual.updatedSurvivors.find(actor => actor._id === 'crafter');
  const otherPaid = actual.events.filter(event => event.kind === 'procurement' && event.who === 'crafter')
    .reduce((sum, event) => sum + event.paidCost - event.gainedCredits, 0);
  assert.equal(buyer.simCredits, before.roster.find(actor => actor._id === 'crafter').simCredits - otherPaid);
  assert.equal(invQty(buyer.inventory, tree._id), 0);
  assert.equal(invQty(buyer.inventory, hero._id), 1);
}
function assertPaidRecipe(input, expectedCost) {
  const original = structuredClone({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn });
  assert.deepEqual(movement(input).targets, ['c']);
  assert.equal(actionQuote(input, noRandom).cost, expectedCost);
  assert.deepEqual({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn }, original);
  const random = createSeedRng('kiosk:recipe:ordered:0');
  const arrived = tick(input, random);
  assert.equal(arrived.updatedSurvivors[0].zoneId, 'c');
  assert.ok(!arrived.events.some(event => event.kind === 'procurement'));
  input.roster = JSON.parse(JSON.stringify(arrived.updatedSurvivors)); input.state.currentActionSec = () => 540;
  const paid = tick(input, random), buyer = paid.updatedSurvivors[0];
  const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, expectedCost);
  assert.equal(receipts[0].beforeCredits, expectedCost + 3); assert.equal(receipts[0].afterCredits, 3);
  const crafted = paid.events.filter(event => event.kind === 'craft' && event.who === 'crafter');
  assert.equal(crafted.length, 1); assert.equal(crafted[0].paidCost, 3); assert.equal(crafted[0].afterCredits, 0);
  assert.equal(buyer.simCredits, 0); assert.equal(buyer.equipped.head, rare._id);
  assert.equal(invQty(buyer.inventory, hero._id), 0); assert.equal(invQty(buyer.inventory, tree._id), 0);
  const model = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
    spawnState: input.state.nextSpawn, forbiddenIds: [], settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
    day: 3, phase: 'morning', survivors: JSON.parse(JSON.stringify(paid.updatedSurvivors)),
    events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])), matchSec: 540 });
  const receipt = model.members.find(member => member.id === 'crafter').procurement;
  assert.equal(receipt.matchedChoice, true); assert.equal(receipt.outcome, 'completed');
  assert.ok(receipt.result.includes(`-${expectedCost}Cr`));
  console.log(`DEFAULT_KIOSK_PAID_WITNESS ${JSON.stringify({ cost: expectedCost, recipeCost: 3,
    beforeCredits: receipts[0].beforeCredits, remainingCredits: buyer.simCredits, equippedId: buyer.equipped.head,
    receiptActionKey: receipts[0].actionKey, observerMatched: receipt.matchedChoice })}`);
}

check('default recipe orders reserve the full crafting fee before travel or onsite payment', () => {
  for (const credits of [0, 199, 200, 202]) assertNoGoalOrder(solo(credits));
});
check('the exact normal purchase and recipe budget travels, pays once, crafts and equips after JSON restoration', () => {
  assertPaidRecipe(solo(), 200);
});
check('real perk discounts are honored by default movement and settlement', () => {
  const input = solo(103); input.roster[0]._perkRuntime = { kioskDiscountPct: 0.5 };
  assertPaidRecipe(input, 100);
  const short = solo(102); short.roster[0]._perkRuntime = { kioskDiscountPct: 0.5 }; assertNoGoalOrder(short);
});
check('configured default prices replace hard-coded movement thresholds', () => {
  for (const price of [75, 800]) {
    const input = solo(price + 3); input.state.ruleset.market.kiosk.prices.legendaryByKey.life_tree = price;
    assertPaidRecipe(input, price);
    const short = solo(price + 2); short.state.ruleset.market.kiosk.prices.legendaryByKey.life_tree = price;
    assertNoGoalOrder(short);
  }
});
check('a protected full bag cannot hold a default order and a reopened slot allows the same paid recipe', () => {
  for (const autoDropLowValue of [false, true]) {
    const input = solo(); input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue };
    assertNoGoalOrder(input);
    input.roster[0].zoneId = 'a'; input.state.ruleset.inventory.maxSlots = 2;
    assertPaidRecipe(input, 200);
  }
});
check('disabled default legendary stock cannot reappear through recommendation or fallback buying', () => {
  const input = solo(); input.state.ruleset.market.kiosk.categories.legendary = false; assertNoGoalOrder(input);
});
check('absent actual default stock cannot attract either a recipe or a general upgrade buyer', () => {
  for (const hasRecipe of [true, false]) {
    const input = solo();
    if (!hasRecipe) { delete input.roster[0].goalLoadouts; input.roster[0].routePlanTargetItemIds = []; }
    refresh(input, items.filter(item => item._id !== tree._id));
    assert.ok(!movement(input).targets.includes('c')); assert.equal(actionQuote(input), null);
    const random = createSeedRng('kiosk:recipe:ordered:0');
    const actual = tick(input, random); assert.notEqual(actual.updatedSurvivors[0].zoneId, 'c');
    assert.ok(!actual.events.some(event => event.kind === 'procurement'));
  }
});
check('the entire multistep recipe fee survives a default material quote', () => {
  const mid = { _id: 'default-mid', itemKey: 'default-mid', name: '중간 부품', type: '재료', tier: 3,
    recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: tree._id, qty: 1 }], resultQty: 1, creditsCost: 4 } };
  const target = { ...rare, recipe: { ingredients: [{ itemId: mid._id, qty: 1 }], resultQty: 1, creditsCost: 3 } };
  for (const credits of [203, 206, 207]) {
    const input = solo(credits); refresh(input, [...items.filter(item => item._id !== rare._id), mid, target]);
    assert.equal(movement(input).targets.includes('c'), credits === 207);
    assert.equal(actionQuote(input)?.cost ?? null, credits === 207 ? 200 : null);
    if (credits === 207) {
      const random = createSeedRng('kiosk:recipe:ordered:0'), events = [];
      for (const sec of [500, 540, 580, 620, 660]) {
        input.state.currentActionSec = () => sec;
        const result = tick(input, random); input.roster = JSON.parse(JSON.stringify(result.updatedSurvivors)); events.push(...result.events);
        if (input.roster[0].equipped.head === target._id) break;
      }
      const receipts = events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
      const crafts = events.filter(event => event.kind === 'craft' && event.who === 'crafter');
      assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, 200); assert.equal(receipts[0].afterCredits, 7);
      assert.equal(crafts.length, 2); assert.equal(crafts.reduce((sum, event) => sum + event.paidCost, 0), 7);
      assert.equal(input.roster[0].simCredits, 0); assert.equal(input.roster[0].equipped.head, target._id);
      for (const item of [hero, tree, mid]) assert.equal(invQty(input.roster[0].inventory, item._id), 0);
    }
  }
});
check('default exchange previews retain the recipe base and can choose a payable direct order instead', () => {
  const meteor = { _id: 'default-meteor', name: '운석', type: '재료', tier: 4 };
  const force = { _id: 'default-force', name: '포스 코어', type: '재료', tier: 5 };
  for (const protectedMeteor of [false, true]) {
    const input = solo(protectedMeteor ? 353 : 3), buyer = input.roster[0];
    buyer.inventory.push(...[meteor, tree].map(item => ({ ...item, itemId: item._id, qty: 1 })));
    const target = { ...rare, recipe: { ...rare.recipe, ingredients: [{ itemId: hero._id, qty: 1 },
      { itemId: force._id, qty: 1 }, ...(protectedMeteor ? [{ itemId: meteor._id, qty: 1 }] : [])] } };
    refresh(input, [...items.filter(item => item._id !== rare._id), meteor, force, target]);
    const before = structuredClone(buyer.inventory), quote = actionQuote(input);
    assert.equal(quote.kind, protectedMeteor ? 'buy' : 'exchange'); assert.equal(quote.itemId, force._id);
    assert.deepEqual(movement(input).targets, ['c']); assert.deepEqual(buyer.inventory, before);
    const random = createSeedRng('kiosk:recipe:ordered:0'); input.roster = tick(input, random).updatedSurvivors;
    input.state.currentActionSec = () => 540;
    const paid = tick(input, random), receipt = paid.events.find(event => event.kind === 'procurement');
    assert.equal(receipt.actionType, protectedMeteor ? 'kioskBuy' : 'kioskExchange');
    assert.equal(receipt.paidCost, protectedMeteor ? 350 : 0);
    assert.equal(paid.updatedSurvivors[0].equipped.head, rare._id); assert.equal(paid.updatedSurvivors[0].simCredits, 0);
  }
});
check('default personal and shared planning agree on normal and discounted payable recipe boundaries', () => {
  for (const discount of [0, 0.5]) for (const enough of [false, true]) {
    const input = fixture(), buyer = input.roster[1];
    buyer.simCredits = (discount ? 100 : 200) + (enough ? 3 : 2);
    if (discount) buyer._perkRuntime = { kioskDiscountPct: discount };
    refresh(input);
    assert.equal(movement(input).targets.includes('c'), enough);
    const shared = [...withSimulationRandom(noRandom, () => plan(input)).movementPlans.values()]
      .filter(move => /^팀 제작 구매:/.test(move.sourceReason));
    assert.equal(shared.length, enough ? 3 : 0);
  }
});
check('unavailable default quotes invalidate an in-flight kiosk target instead of retaining its TTL', () => {
  for (const scenario of ['fee', 'capacity', 'disabled', 'price']) {
    const input = solo(), buyer = input.roster[0];
    Object.assign(buyer, { zoneId: 'b', aiTargetZoneId: 'c', aiTargetTTL: 2,
      aiTargetReason: '전설 재료(키오스크 구매)', aiTargetRequiresRequote: true });
    if (scenario === 'fee') buyer.simCredits = 202;
    if (scenario === 'capacity') input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue: false };
    if (scenario === 'disabled') input.state.ruleset.market.kiosk.categories.legendary = false;
    if (scenario === 'price') input.state.ruleset.market.kiosk.prices.legendaryByKey.life_tree = 800;
    const next = withSimulationRandom(() => 0, () => resolveActorMoveTargetMemory({ actor: buyer,
      plannedMove: movement(input), spawnState: input.state.nextSpawn, forbiddenIds: input.state.forbiddenIds,
      zoneIdSet: new Set(input.state.zones.map(zone => zone.zoneId)), day: 3, phase: 'morning',
      roster: input.roster, publicItems: input.state.publicItems, nowSec: 520 }));
    assert.notEqual(next.holdTarget, 'c'); assert.notEqual(next.actor.aiTargetRequiresRequote, true);
    assert.equal(buyer.aiTargetZoneId, 'c', 'Read-only decision must leave the supplied actor unchanged.');
  }
});
check('payable surplus quotes preserve the existing candidate order and real action probability', () => {
  const input = solo(700), buyer = input.roster[0], up = { spendSurplus: true, surplusLegendBudget: true };
  const tacticalModule = { _id: 'default-module', name: '전술 강화 모듈', type: '재료', tier: 1 };
  refresh(input, [...items, tacticalModule]);
  const before = structuredClone(buyer);
  const move = withSimulationRandom(noRandom, () => chooseAiMoveTargets({ actor: buyer, craftGoal: null,
    upgradeNeed: up, mapObj: input.state.mapObj, kiosks: [], publicItems: input.state.publicItems,
    spawnState: input.state.nextSpawn, forbiddenIds: new Set(), day: 3, phase: 'morning',
    ruleset: input.state.ruleset, isSoloMatch: true }));
  assert.deepEqual(move.targets, ['c']); assert.deepEqual(buyer, before);
  const quote = random => withSimulationRandom(random, () => rollKioskInteraction(input.state.mapObj, 'c', [],
    input.state.publicItems, 3, 'morning', buyer, null, input.state.itemNameById,
    input.state.ruleset.market, input.state.ruleset, up, 500));
  assert.equal(quote(() => 0).itemId, tacticalModule._id);
  assert.equal(quote(() => 1), null, 'A movement quote must not force the actual probabilistic surplus purchase.');
});
console.log(`Default kiosk goal checks passed: ${checks}/${checks}`);
