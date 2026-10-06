import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { computeLateGameUpgradeNeed } = await import('../src/app/simulation/_lib/gearUpgradeNeedRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { resolveActorMoveTargetMemory } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { clearRuntimeCombatFields, applyAiRecoveryWindow } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { fixture, plan, tick, refresh, hero, cloth, tree, ordinary, rare, gear, items } = await import('./lib/team-purchase-fixture.mjs');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const purchasePlans = input => [...plan(input).movementPlans.values()].filter(move => /^팀 제작 구매:/.test(move.sourceReason));

check('a funded follower with only one missing rare ingredient can guide the squad to a real kiosk', () => {
  const input = fixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  const crafter = input.roster[1];
  assert.equal(crafter._growthPlan.blocked, 'no_material_source');
  assert.deepEqual(crafter._growthPlan.missing.map(row => [row.itemId, row.need]), [[tree._id, 1]]);
  assert.equal(input.roster[0]._growthPlan.nextStep, 'b');
  const result = withSimulationRandom(() => { throw new Error('Concrete paid recipe planning must be deterministic.'); }, () => plan(input));
  for (const actor of input.roster) {
    const move = result.movementPlans.get(actor._id);
    assert.equal(move.targetZoneId, 'c');
    assert.match(move.sourceReason, /구매/);
    assert.equal(move.objectiveType, '');
    assert.equal(move.objective, null, 'A kiosk plan is not a reserved world source or a paid receipt.');
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

check('actual travel, paid purchase and recipe consumption complete the follower gear without donating team funds', () => {
  for (const reverse of [false, true]) {
    const input = fixture(); if (reverse) input.roster.reverse();
    const arrived = tick(input);
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0, 'Travel is not also a purchase.');
    const before = arrived.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(before.simCredits, 260); assert.equal(invQty(before.inventory, tree._id), 0);
    const observerContext = { teamId: 'team:1', publicItems: input.state.publicItems,
      spawnState: input.state.nextSpawn, forbiddenIds: [...input.state.forbiddenIds],
      settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
      day: input.state.nextDay, phase: input.state.nextPhase };
    const travelModel = buildTeamObserverModel({ ...observerContext, survivors: arrived.updatedSurvivors,
      events: arrived.events, matchSec: input.state.currentActionSec() });
    assert.equal(travelModel.objectives.length, 0, 'A planned kiosk order is not a reserved field resource.');
    assert.ok(travelModel.members.every(member => /구매 검토.*crafter의 생명 모자/.test(member.decision?.text)),
      'Every actual shared travel decision must retain the real buyer and recipe in the observer model.');
    assert.ok(travelModel.members.every(member => !member.procurement), 'Travel must not fabricate a paid receipt.');
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const paid = tick(input), crafter = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(crafter.equipped.head, rare._id); assert.equal(crafter.simCredits, 57);
    assert.equal(invQty(crafter.inventory, hero._id), 0); assert.equal(invQty(crafter.inventory, tree._id), 0);
    const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
    assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, 200); assert.equal(receipts[0].outcome, 'completed');
    assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === 'crafter'));
    assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
    const paidModel = buildTeamObserverModel({ ...observerContext, survivors: paid.updatedSurvivors,
      events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])), matchSec: input.state.currentActionSec() });
    const receipt = paidModel.members.find(member => member.id === 'crafter').procurement;
    assert.equal(receipt.outcome, 'completed'); assert.equal(receipt.matchedChoice, true);
    assert.match(receipt.result, /생명의 나무.*구매 완료.*200Cr.*260→60Cr/);
    assert.ok(paidModel.members.filter(member => member.id !== 'crafter').every(member => !member.procurement));
    assert.match(describeObserverEvent(arrived.events.find(event => event.reason === 'team_rotate')), /구매 검토/);
    assert.ok([...plan({ ...input, roster: paid.updatedSurvivors }).movementPlans.values()].every(move => !/팀 제작 구매/.test(move.sourceReason)));
  }
});

check('the intent names its real buyer, material and recipe and survives JSON without claiming a completed order', () => {
  const input = fixture(), intent = purchasePlans(input)[0];
  assert.match(intent.sourceReason, /생명의 나무.*crafter의 생명 모자 제작 재료/);
  assert.deepEqual(JSON.parse(JSON.stringify(intent)), intent);
  const text = describeObserverEvent({ kind: 'team_decision', reason: intent.mode, sharedGoalReason: intent.sourceReason,
    who: 'leader', targetZoneId: intent.targetZoneId, moved: false });
  assert.match(text, /구매 검토.*crafter의 생명 모자/); assert.doesNotMatch(text, /구매 완료|획득 완료/);
});

check('buying must leave enough for the real recipe, and neither absent funds nor pooled teammate credits qualify', () => {
  for (const credits of [0, 199, 200, 202, -1, Infinity]) {
    const input = fixture(); input.roster[1].simCredits = credits; input.roster[0].simCredits = 1000;
    assert.equal(purchasePlans(input).length, 0, `buyer credits ${credits}`);
  }
  const input = fixture(); input.roster[1].simCredits = 203;
  assert.equal(purchasePlans(input).length, 3);
});

check('owned or superseded gear, additional missing inputs and multiple missing units cannot masquerade as one-order completion', () => {
  for (const scenario of ['material_owned', 'completed', 'superseded', 'extra_input', 'two_units']) {
    const input = fixture(), crafter = input.roster[1];
    if (['material_owned', 'completed', 'superseded'].includes(scenario)) {
      const item = scenario === 'material_owned' ? tree : scenario === 'completed' ? rare : { ...rare, _id: 'higher', tier: 6 };
      crafter.inventory.push({ ...item, itemId: item._id, qty: 1 });
    } else {
      const changed = structuredClone(rare);
      if (scenario === 'extra_input') changed.recipe.ingredients.push({ itemId: cloth._id, qty: 1 });
      else changed.recipe.ingredients[1].qty = 2;
      refresh(input, items.map(item => item._id === rare._id ? changed : item));
    }
    assert.equal(purchasePlans(input).length, 0, scenario);
  }
});

check('ordinary field ingredients and a real spawned team source retain their farming priority', () => {
  const field = fixture(); field.roster[1].goalLoadouts.legend.headKey = ordinary.itemKey; refresh(field);
  assert.deepEqual(field.roster[1]._growthPlan.missing[0].zones, ['b']);
  assert.equal(purchasePlans(field).length, 0);
  const spawned = fixture(); spawned.state.nextSpawn.coreNodes.push({ id: 'tree-b', kind: 'life_tree', zoneId: 'b', picked: false });
  const chosen = plan(spawned).movementPlans.get('crafter');
  assert.equal(chosen.targetZoneId, 'b'); assert.equal(chosen.objective.type, 'natural_core');
  assert.equal(chosen.objective.beneficiary.who, 'crafter'); assert.equal(purchasePlans(spawned).length, 0);
});

check('forbidden, disconnected and enemy-overwhelmed kiosk routes are rejected', () => {
  for (const scenario of ['forbidden', 'disconnected', 'danger']) {
    const input = fixture();
    if (scenario === 'forbidden') input.state.forbiddenIds.add('c');
    if (scenario === 'disconnected') input.state.zoneGraph.a = ['b'];
    if (scenario === 'danger') for (let i = 0; i < 5; i++) input.roster.push({ ...structuredClone(input.roster[0]),
      _id: `enemy-${i}`, teamId: 'enemy', zoneId: 'c' });
    assert.equal(purchasePlans(input).length, 0, scenario);
  }
});

check('opening, separation, recovery, scheduled waiting, solo and final-zone survival remain higher priorities', () => {
  for (const scenario of ['opening', 'separated', 'recovery', 'waiting', 'solo', 'endgame']) {
    const input = fixture();
    if (scenario === 'opening') input.roster[0]._growthPlan.openingComplete = false;
    if (scenario === 'separated') input.roster[0].zoneId = 'b';
    if (scenario === 'recovery') input.roster[1].hp = 15;
    if (scenario === 'waiting') input.state.getRotationHold = actor => actor._id === 'leader'
      ? { reason: 'action_wait', readyAtSec: 550 } : null;
    if (scenario === 'solo') input.state.isSoloMatch = true;
    if (scenario === 'endgame') input.state.nextSpawn.endgame = { stage: 'final' };
    assert.equal(purchasePlans(input).length, 0, scenario);
  }
});

check('a full protected bag and disabled default legendary sales do not create a payable squad destination', () => {
  for (const scenario of ['capacity', 'disabled']) {
    const input = fixture();
    if (scenario === 'capacity') input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue: false };
    else input.state.ruleset.market.kiosk.categories.legendary = false;
    assert.equal(purchasePlans(input).length, 0, scenario);
  }
});

check('a real custom kiosk price and discount are honored by both selection and actual paid settlement', () => {
  for (const scenario of [
    { catalogPrice: 75, price: 75 },
    { price: 100, discount: 0.5 },
    ...[650, 651, 800, 1200].map(price => ({ catalogPrice: price, price })),
    { catalogPrice: 75, price: 75, unrelatedPrice: 1200 },
    { catalogPrice: 1200, price: 600, discount: 0.5, populatedId: true },
  ]) {
    const input = fixture(), crafter = input.roster[1], price = scenario.price;
    crafter.simCredits = price + 3;
    if (scenario.catalogPrice !== undefined) input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
      catalog: [{ itemId: scenario.populatedId ? { _id: tree._id } : tree._id, mode: 'sell', priceCredits: scenario.catalogPrice },
        ...(scenario.unrelatedPrice ? [{ itemId: cloth._id, mode: 'sell', priceCredits: scenario.unrelatedPrice }] : [])] }];
    if (scenario.discount) crafter._perkRuntime = { kioskDiscountPct: scenario.discount };
    const originalCatalog = structuredClone(input.state.kiosks);
    assert.equal(purchasePlans(input).length, 3);
    const arrived = tick(input);
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    assert.equal(arrived.updatedSurvivors.find(actor => actor._id === 'crafter').simCredits, price + 3);
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const paid = tick(input), buyer = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(buyer.equipped.head, rare._id); assert.equal(buyer.simCredits, 0);
    assert.equal(invQty(buyer.inventory, hero._id), 0); assert.equal(invQty(buyer.inventory, tree._id), 0);
    const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
    assert.equal(receipts.length, 1); assert.equal(receipts[0].outcome, 'completed');
    assert.equal(receipts[0].paidCost, price);
    assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === 'crafter'));
    assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
    const watched = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
      spawnState: input.state.nextSpawn, forbiddenIds: [...input.state.forbiddenIds],
      settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
      day: input.state.nextDay, phase: input.state.nextPhase, survivors: paid.updatedSurvivors,
      events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])), matchSec: input.state.currentActionSec() });
    const observedReceipt = watched.members.find(member => member.id === 'crafter').procurement;
    assert.equal(observedReceipt.outcome, 'completed'); assert.equal(observedReceipt.matchedChoice, true);
    assert.ok(observedReceipt.result.includes(`-${price}Cr`));
    assert.ok(observedReceipt.result.includes(`보유 ${price + 3}→3Cr`));
    assert.deepEqual(input.state.kiosks, originalCatalog);
    console.log(`TEAM_KIOSK_PRICE_WITNESS ${JSON.stringify({ configuredPrice: scenario.catalogPrice ?? 200,
      discount: scenario.discount || 0, paidCost: receipts[0].paidCost, recipeCost: 3,
      remainingCredits: buyer.simCredits, equippedId: buyer.equipped.head })}`);
  }
});

check('high-price custom orders still require the buyer\'s own purchase and recipe credits', () => {
  for (const price of [300, 651, 800, 1200]) {
    for (const credits of [price - 1, price, price + 2]) {
      const input = fixture(); input.roster[1].simCredits = credits; input.roster[0].simCredits = 5000;
      input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
        catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: price }] }];
      assert.equal(purchasePlans(input).length, 0, `configured ${price}, buyer ${credits}`);
    }
  }
});

check('a custom kiosk without an exact supported purchase does not borrow the default material price', () => {
  for (const catalog of [
    [{ itemId: cloth._id, mode: 'sell', priceCredits: 10 }],
    [{ itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } }],
    [{ itemId: tree._id, mode: 'sell', priceCredits: 300 }],
  ]) {
    const input = fixture(); input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog }];
    assert.equal(purchasePlans(input).length, 0);
  }
});

check('mixed modes and unavailable earlier rows resolve the same concrete order in team planning and actual settlement', () => {
  for (const scenario of ['refund_first', 'unavailable_exchange_first', 'unaffordable_buy_first', 'available_buy_first']) {
    const input = fixture(), crafter = input.roster[1], price = scenario === 'available_buy_first' ? 120 : 75;
    crafter.simCredits = price + 3;
    crafter._procurementActionKey = 'phase:0:cycle:legacy'; // An old receipt is not a future order reservation.
    const first = scenario === 'refund_first' ? { itemId: tree._id, mode: 'buy', priceCredits: 50 }
      : scenario === 'unavailable_exchange_first' ? { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } }
        : { itemId: tree._id, mode: 'sell', priceCredits: scenario === 'available_buy_first' ? 120 : 300 };
    input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
      catalog: [first, { itemId: { _id: tree._id }, mode: 'sell', priceCredits: 75 }] }];
    const before = structuredClone({ roster: input.roster, kiosks: input.state.kiosks, spawn: input.state.nextSpawn });
    const withoutRandom = () => { throw new Error('Exact catalogue planning cannot draw randomness.'); };
    const quote = withSimulationRandom(withoutRandom, () => rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks,
      input.state.publicItems, input.state.nextDay, input.state.nextPhase, crafter, getActorGrowthCraftGoal(crafter, items),
      input.state.itemNameById, input.state.ruleset.market, input.state.ruleset));
    assert.equal(quote.kind, 'buy'); assert.equal(quote.cost, price);
    console.log(`MIXED_KIOSK_WITNESS ${JSON.stringify({ scenario, actualQuote: quote.cost,
      teamDestinations: withSimulationRandom(withoutRandom, () => purchasePlans(input)).length })}`);
    assert.equal(withSimulationRandom(withoutRandom, () => purchasePlans(input)).length, 3, scenario);
    assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.kiosks, before.kiosks);
    assert.deepEqual(input.state.nextSpawn, before.spawn);
    const arrived = tick(input);
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const paid = tick(input), buyer = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(buyer.equipped.head, rare._id); assert.equal(buyer.simCredits, 0);
    assert.equal(invQty(buyer.inventory, hero._id), 0); assert.equal(invQty(buyer.inventory, tree._id), 0);
    const receipt = paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter');
    assert.equal(receipt.actionType, 'kioskBuy'); assert.equal(receipt.paidCost, price);
    assert.equal(receipt.outcome, 'completed'); assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === 'crafter'));
  }
});

check('a concrete payable exchange guides real squad travel and consumes only surplus beyond the recipe needs', () => {
  for (const reservedCloth of [false, true]) {
    const input = fixture(), crafter = input.roster[1]; crafter.simCredits = 3;
    crafter.inventory.push({ ...cloth, itemId: cloth._id, qty: reservedCloth ? 2 : 1 });
    if (reservedCloth) {
      const changed = structuredClone(rare); changed.recipe.ingredients.push({ itemId: cloth._id, qty: 1 });
      refresh(input, items.map(item => item._id === rare._id ? changed : item));
    } else refreshActorGrowthPlan(crafter, input.state.publicItems, input.state);
    input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: reservedCloth ? 3 : 2, autoDropLowValue: false };
    input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
      { itemId: { _id: tree._id }, mode: 'exchange', exchange: { giveItemId: { _id: cloth._id }, giveQty: 1 } },
      { itemId: tree._id, mode: 'sell', priceCredits: 75 },
    ] }];
    const before = structuredClone({ roster: input.roster, kiosks: input.state.kiosks, spawn: input.state.nextSpawn });
    const proposed = withSimulationRandom(() => { throw new Error('Exact exchange planning must be read-only and deterministic.'); }, () => plan(input));
    console.log(`TEAM_KIOSK_EXCHANGE_INTENT_WITNESS ${JSON.stringify({ reservedCloth,
      exchangeDestinations: [...proposed.movementPlans.values()].filter(move => /^팀 제작 교환:/.test(move.sourceReason)).length })}`);
    assert.equal(proposed.movementPlans.size, 3);
    assert.ok([...proposed.movementPlans.values()].every(move => move.targetZoneId === 'c' && /^팀 제작 교환:/.test(move.sourceReason)));
    assert.ok([...proposed.movementPlans.values()].every(move => !move.objectiveType && !move.objective));
    assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.kiosks, before.kiosks);
    assert.deepEqual(input.state.nextSpawn, before.spawn);
    const arrived = tick(input);
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    const travel = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
      spawnState: input.state.nextSpawn, forbiddenIds: [...input.state.forbiddenIds],
      settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
      day: input.state.nextDay, phase: input.state.nextPhase, survivors: arrived.updatedSurvivors,
      events: JSON.parse(JSON.stringify(arrived.events)), matchSec: 500 });
    assert.ok(travel.members.every(member => /교환 검토.*crafter의 생명 모자/.test(member.decision.text)));
    assert.equal(travel.objectives.length, 0);
    assert.ok(travel.members.every(member => !member.procurement));
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const paid = tick(input), buyer = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(buyer.equipped.head, rare._id); assert.equal(buyer.simCredits, 0);
    for (const item of [hero, tree, cloth]) assert.equal(invQty(buyer.inventory, item._id), 0);
    const receipt = paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter');
    assert.equal(receipt.actionType, 'kioskExchange'); assert.equal(receipt.paidCost, 0);
    assert.equal(receipt.beforeCredits, 3); assert.equal(receipt.afterCredits, 3);
    assert.deepEqual(receipt.consumed.map(row => [row.itemId, row.qty]), [[cloth._id, 1]]);
    assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === 'crafter'));
    assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
    console.log(`TEAM_KIOSK_EXCHANGE_WITNESS ${JSON.stringify({ reservedCloth, consumed: receipt.consumed,
      recipeCost: 3, remainingCredits: buyer.simCredits, equippedId: buyer.equipped.head })}`);
  }
});

check('an exchange ingredient lost during travel invalidates the fresh order without free goods or crafting', () => {
  const input = fixture(), crafter = input.roster[1]; crafter.simCredits = 3;
  crafter.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 });
  refreshActorGrowthPlan(crafter, input.state.publicItems, input.state);
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } },
  ] }];
  const arrived = tick(input);
  assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
  assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
  input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  const buyer = input.roster.find(actor => actor._id === 'crafter');
  buyer.inventory = buyer.inventory.filter(entry => entry.itemId !== cloth._id);
  assert.ok([...plan(input).movementPlans.values()].every(move => !/^팀 제작 교환:/.test(move.sourceReason)));
  const next = tick(input), after = next.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(invQty(after.inventory, tree._id), 0); assert.equal(invQty(after.inventory, rare._id), 0);
  assert.equal(invQty(after.inventory, hero._id), 1);
  assert.ok(next.events.filter(event => event.who === 'crafter').every(event => event.actionType !== 'kioskExchange'));
});

check('an exchange cannot sacrifice a needed recipe input, exceed its real quantity, or bypass recipe credits', () => {
  for (const scenario of ['worn_base', 'needed_cloth', 'missing_units', 'invalid_units', 'recipe_credits', 'blocked_receive']) {
    const input = fixture(), crafter = input.roster[1]; crafter.simCredits = scenario === 'recipe_credits' ? 2 : 3;
    if (scenario !== 'worn_base') crafter.inventory.push({ ...cloth, itemId: cloth._id,
      qty: ['invalid_units', 'blocked_receive'].includes(scenario) ? 2 : 1 });
    if (scenario === 'needed_cloth') {
      const changed = structuredClone(rare); changed.recipe.ingredients.push({ itemId: cloth._id, qty: 1 });
      refresh(input, items.map(item => item._id === rare._id ? changed : item));
    } else refreshActorGrowthPlan(crafter, input.state.publicItems, input.state);
    if (scenario === 'blocked_receive') input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 2, autoDropLowValue: false };
    input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
      { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: scenario === 'worn_base' ? hero._id : cloth._id,
        giveQty: scenario === 'missing_units' ? 2 : scenario === 'invalid_units' ? 1.5 : 1 } },
    ] }];
    const before = structuredClone(input.roster);
    assert.ok([...plan(input).movementPlans.values()].every(move => !/^팀 제작 (구매|교환):/.test(move.sourceReason)), scenario);
    assert.deepEqual(input.roster, before);
  }
});

check('a concrete distant kiosk uses the full safe route but executes only one ordinary movement step', () => {
  const input = fixture(); input.state.zoneGraph = { a: ['b'], b: ['a', 'd'], d: ['b', 'e'], e: ['d', 'c'], c: ['e'] };
  for (const zoneId of ['d', 'e']) input.state.mapObj.zones.push({ zoneId, name: zoneId });
  const proposed = plan(input).movementPlans.get('crafter');
  assert.equal(proposed.targetZoneId, 'c'); assert.equal(proposed.nextStep, 'b');
  const moved = tick(input);
  assert.ok(moved.updatedSurvivors.every(actor => actor.zoneId === 'b'));
  assert.equal(moved.events.filter(event => event.kind === 'procurement').length, 0);
  assert.equal(moved.updatedSurvivors.find(actor => actor._id === 'crafter').simCredits, 260);
});

check('credits lost during travel invalidate the next quote without receiving the material or result for free', () => {
  const input = fixture(), arrived = tick(input); input.roster = arrived.updatedSurvivors;
  const buyer = input.roster.find(actor => actor._id === 'crafter'); buyer.simCredits = 0;
  input.state.currentActionSec = () => 540;
  assert.equal(purchasePlans(input).length, 0);
  const next = tick(input), after = next.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(invQty(after.inventory, tree._id), 0); assert.equal(invQty(after.inventory, rare._id), 0);
  assert.equal(invQty(after.inventory, hero._id), 1); assert.equal(after.simCredits, 0);
  assert.ok(next.events.filter(event => event.who === 'crafter').every(event => event.kind !== 'procurement'));
});

check('an unaffordable authored kiosk cannot attract the squad through a leader default-price fallback', () => {
  const input = fixture();
  input.roster[0].goalLoadouts.legend.headKey = rare.itemKey;
  input.roster[0].simCredits = 260;
  input.roster[1].goalLoadouts.legend.headKey = ordinary.itemKey;
  input.roster[1].simCredits = 20;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
    catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: 800 }] }];
  refresh(input);
  const result = plan(input);
  assert.ok([...result.movementPlans.values()].every(move => move.targetZoneId !== 'c'),
    'The leader fallback must not send a gathered squad to an order it cannot pay.');
});

function individualMove(input, actor = input.roster[1]) {
  return chooseAiMoveTargets({ actor, craftGoal: getActorGrowthCraftGoal(actor, input.state.publicItems),
    upgradeNeed: computeLateGameUpgradeNeed(actor, input.state.itemMetaById, input.state.itemNameById,
      input.state.nextDay, input.state.nextPhase, input.state.ruleset),
    mapObj: input.state.mapObj, kiosks: input.state.kiosks, publicItems: input.state.publicItems,
    forbiddenIds: input.state.forbiddenIds, spawnState: input.state.nextSpawn,
    day: input.state.nextDay, phase: input.state.nextPhase, ruleset: input.state.ruleset });
}

function authoredMaterialFixture() {
  const input = fixture();
  const material = { _id: 'purchase-authored-alloy', name: '정제 합금', type: '재료', tier: 4 };
  const target = { ...rare, name: '합금 모자', recipe: { ...rare.recipe,
    ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: material._id, qty: 1 }] } };
  refresh(input, [...items.filter(item => ![tree._id, rare._id].includes(item._id)), material, target]);
  input.roster[1].simCredits = 78;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: { _id: material._id }, mode: 'sell', priceCredits: 75 },
  ] }];
  return { ...input, material, target };
}

check('an exact authored material order guides squad travel and real crafting without a special material name', () => {
  for (const reverse of [false, true]) {
    const input = authoredMaterialFixture(), buyer = input.roster[1], random = createSeedRng('kiosk:authored:material');
    if (reverse) input.roster.reverse();
    const before = structuredClone({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn });
    const result = withSimulationRandom(() => { throw Error('Exact authored material planning cannot draw RNG.'); }, () => plan(input));
    assert.equal(result.movementPlans.size, 3);
    assert.ok([...result.movementPlans.values()].every(move => move.targetZoneId === 'c' && /^팀 제작 구매:/.test(move.sourceReason)));
    assert.ok([...result.movementPlans.values()].every(move => /정제 합금.*crafter의 합금 모자/.test(move.sourceReason)));
    assert.deepEqual({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn }, before);
    const arrived = tick(input, random);
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    assert.equal(arrived.updatedSurvivors.find(actor => actor._id === buyer._id).simCredits, 78);
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const paid = tick(input, random), paidBuyer = paid.updatedSurvivors.find(actor => actor._id === buyer._id);
    // Ordinary material receipts retain the existing optional loot-craft roll.
    // This seed defers it, so follow the real later inventory-craft action.
    assert.equal(paidBuyer.simCredits, 3); assert.equal(paidBuyer.equipped.head, hero._id);
    assert.equal(invQty(paidBuyer.inventory, hero._id), 1); assert.equal(invQty(paidBuyer.inventory, input.material._id), 1);
    const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === buyer._id);
    assert.equal(receipts.length, 1); assert.equal(receipts[0].itemId, input.material._id); assert.equal(receipts[0].paidCost, 75);
    assert.equal(receipts[0].beforeCredits, 78); assert.equal(receipts[0].afterCredits, 3);
    assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== buyer._id).every(actor => actor.simCredits === 20));
    const model = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
      survivors: JSON.parse(JSON.stringify(paid.updatedSurvivors)), events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])),
      spawnState: input.state.nextSpawn, forbiddenIds: [], day: 3, phase: 'morning', matchSec: 540,
      settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset } });
    const observed = model.members.find(actor => actor.id === buyer._id).procurement;
    assert.equal(observed.matchedChoice, true); assert.equal(observed.actionKey, receipts[0].actionKey);
    assert.match(observed.result, /정제 합금.*75Cr/);
    const events = [...arrived.events, ...paid.events]; input.roster = paid.updatedSurvivors;
    for (const sec of [580, 620, 660]) {
      input.state.currentActionSec = () => sec;
      const next = tick(input, random); input.roster = next.updatedSurvivors; events.push(...next.events);
    }
    const after = input.roster.find(actor => actor._id === buyer._id);
    assert.equal(after.equipped.head, input.target._id); assert.equal(after.simCredits, 0);
    assert.equal(invQty(after.inventory, hero._id), 0); assert.equal(invQty(after.inventory, input.material._id), 0);
    const crafted = events.find(event => event.kind === 'craft' && event.who === buyer._id);
    assert.equal(crafted.itemId, input.target._id); assert.equal(crafted.paidCost, 3);
    assert.deepEqual(crafted.consumed.map(row => [row.itemId, row.qty]), [[hero._id, 1], [input.material._id, 1]]);
    assert.equal(events.filter(event => event.kind === 'procurement' && event.who === buyer._id).length, 1);
    console.log(`AUTHORED_MATERIAL_WITNESS ${JSON.stringify({ reverse, paidCost: receipts[0].paidCost,
      recipeCost: 3, equippedId: after.equipped.head, remainingCredits: after.simCredits, observed: observed.matchedChoice })}`);
  }
});

check('a solo crafter follows the exact authored material quote through actual travel and paid completion', () => {
  const input = authoredMaterialFixture(), buyer = input.roster[1], random = createSeedRng('kiosk:authored:material');
  input.roster = [buyer]; input.state.isSoloMatch = true;
  const before = structuredClone(input.roster);
  const move = withSimulationRandom(() => { throw Error('An exact solo quote cannot draw RNG.'); }, () => individualMove(input, buyer));
  assert.deepEqual(move.targets, ['c']); assert.equal(move.reason, '키오스크 조달 검토');
  assert.deepEqual(input.roster, before); assert.equal(purchasePlans(input).length, 0);
  const events = [];
  for (const sec of [500, 540, 580, 620, 660]) {
    input.state.currentActionSec = () => sec;
    const next = tick(input, random); input.roster = next.updatedSurvivors; events.push(...next.events);
    if (sec === 500) {
      assert.equal(input.roster[0].zoneId, 'c'); assert.equal(input.roster[0].simCredits, 78);
      assert.equal(events.filter(event => event.kind === 'procurement').length, 0);
    }
    if (input.roster[0].equipped.head === input.target._id) break;
  }
  assert.equal(input.roster[0].equipped.head, input.target._id); assert.equal(input.roster[0].simCredits, 0);
  const receipts = events.filter(event => event.kind === 'procurement');
  assert.equal(receipts.length, 1); assert.equal(receipts[0].itemId, input.material._id); assert.equal(receipts[0].paidCost, 75);
  assert.ok(events.some(event => event.kind === 'craft' && event.paidCost === 3));
});

check('a custom material with an obtainable field source keeps farming ahead of kiosk travel', () => {
  const input = authoredMaterialFixture();
  refresh(input, input.state.publicItems.map(item => item._id === input.material._id ? { ...item, tier: 1, spawnZones: ['b'] } : item));
  assert.deepEqual(input.roster[1]._growthPlan.missing[0].zones, ['b']);
  assert.equal(purchasePlans(input).length, 0); assert.deepEqual(individualMove(input).targets, ['b']);
});

check('custom materials require exact authored stock and never appear in default or unrelated catalogues', () => {
  for (const scenario of ['default', 'filtered_empty', 'wrong_id', 'wrong_map', 'refund_only']) {
    const input = authoredMaterialFixture();
    if (scenario === 'default') input.state.kiosks = [];
    if (scenario === 'filtered_empty') Object.assign(input.state.kiosks[0], { catalog: [], hasCustomCatalog: true });
    if (scenario === 'wrong_id') {
      const other = { ...input.material, _id: 'same-name-other-id' };
      refresh(input, [...input.state.publicItems, other]);
      input.state.kiosks[0].catalog[0].itemId = { ...other };
    }
    if (scenario === 'wrong_map') input.state.kiosks[0].mapId = 'other-map';
    if (scenario === 'refund_only') input.state.kiosks[0].catalog[0].mode = 'buy';
    const before = structuredClone({ roster: input.roster, shops: input.state.kiosks });
    assert.equal(purchasePlans(input).length, 0, scenario);
    assert.ok(!individualMove(input).targets.includes('c'), scenario);
    assert.deepEqual({ roster: input.roster, shops: input.state.kiosks }, before);
  }
});

check('authored materials retain recipe fees, receiving capacity, world time and squad safety gates', () => {
  for (const scenario of ['recipe_fee', 'capacity', 'too_early', 'forbidden', 'disconnected', 'danger', 'recovery', 'opening']) {
    const input = authoredMaterialFixture();
    if (scenario === 'recipe_fee') input.roster[1].simCredits = 77;
    if (scenario === 'capacity') input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue: false };
    if (scenario === 'too_early') { input.state.nextDay = 1; input.state.nextPhase = 'morning'; }
    if (scenario === 'forbidden') input.state.forbiddenIds.add('c');
    if (scenario === 'disconnected') input.state.zoneGraph.a = ['b'];
    if (scenario === 'danger') for (let i = 0; i < 5; i++) input.roster.push({ ...structuredClone(input.roster[0]),
      _id: `alloy-enemy-${i}`, teamId: 'enemy', zoneId: 'c' });
    if (scenario === 'recovery') input.roster[1].hp = 15;
    if (scenario === 'opening') input.roster[0]._growthPlan.openingComplete = false;
    assert.equal(purchasePlans(input).length, 0, scenario);
    if (['recipe_fee', 'capacity', 'too_early', 'forbidden'].includes(scenario)) {
      assert.ok(!individualMove(input).targets.includes('c'), scenario);
    }
  }
});

check('a custom material exchange consumes surplus while preserving the worn recipe base and its fee', () => {
  for (const giveBase of [false, true]) {
    const input = authoredMaterialFixture(), buyer = input.roster[1]; buyer.simCredits = 3;
    buyer.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 }); refresh(input);
    input.state.kiosks[0].catalog = [{ itemId: { _id: input.material._id }, mode: 'exchange',
      exchange: { giveItemId: giveBase ? hero._id : { _id: cloth._id }, giveQty: 1 } }];
    const plans = [...plan(input).movementPlans.values()].filter(move => /^팀 제작 교환:/.test(move.sourceReason));
    if (giveBase) { assert.equal(plans.length, 0); assert.ok(!individualMove(input).targets.includes('c')); continue; }
    assert.equal(plans.length, 3); assert.deepEqual(individualMove(input).targets, ['c']);
    const random = createSeedRng('kiosk:recipe:ordered:0'), arrived = tick(input, random);
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    input.roster = arrived.updatedSurvivors; const events = [];
    for (const sec of [540, 580, 620, 660]) {
      input.state.currentActionSec = () => sec;
      const next = tick(input, random); input.roster = next.updatedSurvivors; events.push(...next.events);
      if (input.roster.find(actor => actor._id === buyer._id).equipped.head === input.target._id) break;
    }
    const after = input.roster.find(actor => actor._id === buyer._id);
    assert.equal(after.equipped.head, input.target._id); assert.equal(after.simCredits, 0);
    const receipts = events.filter(event => event.kind === 'procurement' && event.who === buyer._id);
    assert.equal(receipts.length, 1); assert.equal(receipts[0].actionType, 'kioskExchange'); assert.equal(receipts[0].paidCost, 0);
    assert.deepEqual(receipts[0].consumed.map(row => [row.itemId, row.qty]), [[cloth._id, 1]]);
    assert.ok(events.some(event => event.kind === 'craft' && event.who === buyer._id && event.paidCost === 3));
  }
});

check('authored material plans are invalidated when stock or buyer funds disappear during real travel', () => {
  for (const scenario of ['stock_removed', 'funds_lost']) {
    const input = authoredMaterialFixture(), arrived = tick(input, createSeedRng('kiosk:authored:material'));
    assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
    input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
    const buyer = input.roster.find(actor => actor._id === 'crafter');
    if (scenario === 'stock_removed') Object.assign(input.state.kiosks[0], { catalog: [], hasCustomCatalog: true });
    else buyer.simCredits = 0;
    assert.equal(purchasePlans(input).length, 0); assert.ok(!individualMove(input, buyer).targets.includes('c'));
    const next = tick(input, createSeedRng('kiosk:authored:material')), after = next.updatedSurvivors.find(actor => actor._id === buyer._id);
    assert.equal(invQty(after.inventory, input.material._id), 0); assert.equal(invQty(after.inventory, input.target._id), 0);
    assert.equal(invQty(after.inventory, hero._id), 1); assert.equal(after.simCredits, scenario === 'funds_lost' ? 0 : 78);
    assert.ok(next.events.filter(event => event.who === buyer._id).every(event => event.kind !== 'procurement' && event.kind !== 'craft'));
  }
});

check('exact custom material IDs cannot bypass canonical food or kiosk water exclusions', () => {
  for (const material of [
    { name: '냉동피자', type: '재료' }, { name: '정제 합금', type: '재료', tags: ['food'] }, { name: '물', type: '재료' },
  ]) {
    const input = authoredMaterialFixture();
    refresh(input, input.state.publicItems.map(item => item._id === input.material._id ? { ...item, ...material } : item));
    input.state.kiosks[0].catalog[0].itemId = { _id: input.material._id, name: '정제 합금', type: '재료' };
    const before = structuredClone(input.roster);
    assert.equal(purchasePlans(input).length, 0, material.name); assert.ok(!individualMove(input).targets.includes('c'), material.name);
    assert.deepEqual(input.roster, before);
  }
});

function travelingKioskFixture(named = false) {
  const input = named ? { ...fixture(), material: tree, target: rare } : authoredMaterialFixture();
  const buyer = input.roster.find(actor => actor._id === 'crafter'); buyer.simCredits = 78;
  input.roster = [buyer]; input.state.isSoloMatch = true;
  input.state.mapObj.zones.push({ zoneId: 'd', name: 'd', hasKiosk: true });
  input.state.zoneGraph = { a: ['b'], b: ['a', 'c', 'd'], c: ['b'], d: ['b'] };
  input.state.kiosks = ['c', 'd'].map(zoneId => ({ mapId: input.state.mapObj._id, zoneId,
    catalog: [{ itemId: { _id: input.material._id }, mode: 'sell', priceCredits: zoneId === 'c' ? 75 : 800 }] }));
  refresh(input); return input;
}

function rememberMovement(input, aiMove = individualMove(input, input.roster[0]), extra = {}) {
  return resolveActorMoveTargetMemory({ state: { actor: input.roster[0], aiMove,
    currentZone: input.roster[0].zoneId, day: input.state.nextDay, phase: input.state.nextPhase,
    forbiddenIds: input.state.forbiddenIds, ruleset: input.state.ruleset, spawnState: input.state.nextSpawn,
    publicItems: input.state.publicItems, roster: input.roster, nowSec: input.state.currentActionSec(), ...extra } });
}

check('a fresh payable shop replaces stale kiosk travel memory and really pays and crafts after rerouting', () => {
  for (const named of [false, true]) for (const restored of [false, true]) {
    const input = travelingKioskFixture(named), random = createSeedRng('kiosk:authored:material');
    const first = tick(input, random); input.roster = first.updatedSurvivors;
    assert.equal(input.roster[0].zoneId, 'b'); assert.equal(input.roster[0].aiTargetZoneId, 'c');
    assert.ok(input.roster[0].aiTargetTTL > 0); assert.equal(first.events.filter(event => event.kind === 'procurement').length, 0);
    if (restored) {
      const frame = createSimulationFrame({ day: 3, phase: 'morning', matchSec: 500, survivors: input.roster,
        spawnState: input.state.nextSpawn, forbiddenIds: input.state.forbiddenIds, mapId: input.state.mapObj._id });
      input.roster = JSON.parse(JSON.stringify(frame)).survivors;
    }
    input.state.kiosks[0].catalog[0].priceCredits = 800; input.state.kiosks[1].catalog[0].priceCredits = 75;
    assert.deepEqual(individualMove(input, input.roster[0]).targets, ['d']);
    input.state.currentActionSec = () => 540;
    const redirected = tick(input, random); input.roster = redirected.updatedSurvivors;
    assert.equal(input.roster[0].aiTargetZoneId, 'd', 'Fresh payable stock must replace the stale saved destination before TTL expiry.');
    assert.equal(input.roster[0].zoneId, 'd'); assert.equal(input.roster[0].simCredits, 78);
    assert.equal(redirected.events.filter(event => event.kind === 'procurement').length, 0);
    assert.ok(redirected.events.some(event => event.kind === 'move' && event.from === 'b' && event.to === 'd'));
    const events = [...first.events, ...redirected.events];
    for (const sec of [580, 620, 660, 700]) {
      input.state.currentActionSec = () => sec;
      const next = tick(input, random); input.roster = next.updatedSurvivors; events.push(...next.events);
      if (input.roster[0].equipped.head === input.target._id) break;
    }
    assert.equal(input.roster[0].equipped.head, input.target._id); assert.equal(input.roster[0].simCredits, 0);
    const receipts = events.filter(event => event.kind === 'procurement');
    assert.equal(receipts.length, 1); assert.equal(receipts[0].zoneId, 'd'); assert.equal(receipts[0].paidCost, 75);
    assert.equal(receipts[0].itemId, input.material._id); assert.equal(receipts[0].beforeCredits, 78); assert.equal(receipts[0].afterCredits, 3);
    assert.ok(events.some(event => event.kind === 'craft' && event.paidCost === 3));
    const observer = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
      survivors: JSON.parse(JSON.stringify(input.roster)), events: JSON.parse(JSON.stringify(events)),
      spawnState: input.state.nextSpawn, forbiddenIds: [], day: 3, phase: 'morning', matchSec: input.state.currentActionSec(),
      settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset } });
    assert.equal(observer.members[0].procurement.matchedChoice, true);
    assert.equal(observer.members[0].procurement.actionKey, receipts[0].actionKey);
    console.log(`KIOSK_REQUOTE_WITNESS ${JSON.stringify({ named, restored, from: 'b', to: 'd', paidCost: receipts[0].paidCost,
      recipeCost: 3, remainingCredits: input.roster[0].simCredits, equippedId: input.roster[0].equipped.head })}`);
  }
});

check('a still-payable remembered kiosk retains its TTL and catalogue choice without extra RNG draws', () => {
  const input = travelingKioskFixture(), random = createSeedRng('kiosk:authored:material');
  input.roster = tick(input, random).updatedSurvivors;
  input.state.kiosks[1].catalog[0].priceCredits = 60;
  const ttl = input.roster[0].aiTargetTTL, before = structuredClone({ inventory: input.roster[0].inventory,
    credits: input.roster[0].simCredits, shops: input.state.kiosks, spawn: input.state.nextSpawn });
  const held = withSimulationRandom(() => { throw Error('A valid remembered quote cannot redraw its TTL.'); }, () => rememberMovement(input));
  assert.equal(held.holdTarget, 'c'); assert.equal(held.actor.aiTargetTTL, ttl - 1); assert.equal(held.actor.aiTargetRequiresRequote, true);
  assert.equal(held.moveReason, '키오스크 조달 검토:ttl'); assert.equal(held.moveObjective, null);
  assert.deepEqual({ inventory: input.roster[0].inventory, credits: input.roster[0].simCredits,
    shops: input.state.kiosks, spawn: input.state.nextSpawn }, before);
});

check('unavailable stock, funds, capacity, acquired ingredients, field sources and policy invalidate remembered kiosk needs', () => {
  for (const scenario of ['stock', 'funds', 'capacity', 'owned', 'field', 'food', 'water', 'forbidden', 'too_early']) {
    const input = travelingKioskFixture(), random = createSeedRng('kiosk:authored:material');
    input.roster = tick(input, random).updatedSurvivors; const buyer = input.roster[0];
    if (scenario === 'stock') Object.assign(input.state.kiosks[0], { catalog: [], hasCustomCatalog: true });
    if (scenario === 'funds') buyer.simCredits = 0;
    if (scenario === 'capacity') input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue: false };
    if (scenario === 'owned') buyer.inventory.push({ ...input.material, itemId: input.material._id, qty: 1 });
    if (['field', 'food', 'water'].includes(scenario)) refresh(input, input.state.publicItems.map(item => item._id !== input.material._id ? item
      : { ...item, ...(scenario === 'field' ? { tier: 1, spawnZones: ['b'] } : scenario === 'food' ? { tags: ['food'] } : { name: '물' }) }));
    if (scenario === 'forbidden') input.state.forbiddenIds.add('c');
    if (scenario === 'too_early') { input.state.nextDay = 1; input.state.nextPhase = 'morning'; }
    refreshActorGrowthPlan(buyer, input.state.publicItems, input.state);
    const before = structuredClone({ inventory: buyer.inventory, credits: buyer.simCredits,
      shops: input.state.kiosks, spawn: input.state.nextSpawn });
    const next = withSimulationRandom(random, () => rememberMovement(input));
    assert.notEqual(next.holdTarget, 'c', scenario); assert.ok(!next.moveTargets.includes('c'), scenario);
    assert.notEqual(next.actor.aiTargetRequiresRequote, true, scenario);
    assert.deepEqual({ inventory: buyer.inventory, credits: buyer.simCredits, shops: input.state.kiosks, spawn: input.state.nextSpawn }, before);
  }
});

check('an exchange input lost in transit clears the remembered kiosk order without consuming the recipe base', () => {
  const input = travelingKioskFixture(), buyer = input.roster[0], random = createSeedRng('kiosk:authored:material');
  buyer.simCredits = 3; buyer.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 }); refresh(input);
  input.state.kiosks[0].catalog = [{ itemId: input.material._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } }];
  input.roster = tick(input, random).updatedSurvivors;
  assert.equal(input.roster[0].zoneId, 'b'); assert.equal(input.roster[0].aiTargetZoneId, 'c');
  input.roster[0].inventory = input.roster[0].inventory.filter(entry => entry.itemId !== cloth._id);
  const before = structuredClone(input.roster[0].inventory);
  const next = withSimulationRandom(random, () => rememberMovement(input));
  assert.notEqual(next.holdTarget, 'c'); assert.notEqual(next.actor.aiTargetRequiresRequote, true);
  assert.equal(next.actor.simCredits, 3); assert.deepEqual(next.actor.inventory, before);
  assert.equal(invQty(next.actor.inventory, hero._id), 1); assert.equal(invQty(next.actor.inventory, input.material._id), 0);
});

check('a generic remembered route does not acquire a fresh kiosk revalidation marker or label', () => {
  const input = travelingKioskFixture(), random = createSeedRng('kiosk:authored:material');
  const first = withSimulationRandom(random, () => rememberMovement(input, { targets: ['b'], reason: 'wander' }));
  input.roster = [first.actor];
  const held = withSimulationRandom(() => { throw Error('Generic TTL holding cannot redraw RNG.'); }, () => rememberMovement(input));
  assert.equal(held.holdTarget, 'b'); assert.equal(held.moveReason, 'wander:ttl');
  assert.ok(!Object.hasOwn(held.actor, 'aiTargetRequiresRequote')); assert.equal(held.moveObjective, null);
});

check('kiosk revalidation memory is cleared on escape, arrival, regrouping, death and recovery retargeting', () => {
  const input = travelingKioskFixture(), random = createSeedRng('kiosk:authored:material');
  input.roster = tick(input, random).updatedSurvivors;
  const traveling = structuredClone(input.roster[0]); assert.equal(traveling.aiTargetRequiresRequote, true);
  const escaped = rememberMovement({ ...input, roster: [structuredClone(traveling)] }, undefined, { mustEscape: true });
  assert.equal(escaped.holdTarget, null); assert.ok(!Object.hasOwn(escaped.actor, 'aiTargetRequiresRequote'));
  const arrived = rememberMovement({ ...input, roster: [{ ...structuredClone(traveling), zoneId: 'c' }] }, { targets: [], reason: '' });
  assert.equal(arrived.holdTarget, null); assert.ok(!Object.hasOwn(arrived.actor, 'aiTargetRequiresRequote'));
  const dead = clearRuntimeCombatFields(structuredClone(traveling));
  assert.ok(!Object.hasOwn(dead, 'aiTargetRequiresRequote')); assert.equal(dead.aiTargetTTL, 0);
  const recovering = applyAiRecoveryWindow(structuredClone(traveling), 540, { retargetZoneId: 'a', retargetTtl: 2, reason: 'pvp:recover' });
  assert.ok(!Object.hasOwn(recovering, 'aiTargetRequiresRequote')); assert.equal(recovering.aiTargetZoneId, 'a');
  const retained = withSimulationRandom(() => { throw Error('Recovery retarget TTL must remain valid.'); },
    () => rememberMovement({ ...input, roster: [recovering] }));
  assert.equal(retained.holdTarget, 'a'); assert.equal(retained.moveReason, 'pvp:recover:ttl');
  input.roster.push(...fixture().roster.filter(actor => actor._id !== 'crafter').map(actor => ({ ...actor, zoneId: 'b' })));
  input.state.isSoloMatch = false; input.state.currentActionSec = () => 540;
  const regrouped = tick(input, random);
  assert.ok(regrouped.events.some(event => event.kind === 'team_decision'));
  assert.ok(regrouped.updatedSurvivors.every(actor => !Object.hasOwn(actor, 'aiTargetRequiresRequote')));
});

check('an earlier affordable price that spends the recipe fee cannot hide a later completable order', () => {
  for (const reverse of [false, true]) {
    for (const discount of [0, 0.5]) {
      const input = fixture(), buyer = input.roster[1]; const recipeRandom = createSeedRng('kiosk:recipe:ordered:0'); buyer.simCredits = 78;
      if (discount) buyer._perkRuntime = { kioskDiscountPct: discount };
      input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
        { itemId: tree._id, mode: 'sell', priceCredits: discount ? 156 : 78 },
        { itemId: { _id: tree._id }, mode: 'sell', priceCredits: discount ? 150 : 75 },
      ] }];
      if (reverse) input.roster.reverse();
      const before = structuredClone({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn });
      const quote = withSimulationRandom(() => { throw new Error('Recipe-aware quotes cannot draw RNG.'); },
        () => rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks, input.state.publicItems, 3, 'morning',
          buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems), input.state.itemNameById,
          input.state.ruleset.market, input.state.ruleset));
      assert.equal(quote?.kind, 'buy'); assert.equal(quote.cost, 75);
      assert.equal(purchasePlans(input).length, 3);
      assert.deepEqual(individualMove(input, buyer).targets, ['c']);
      assert.deepEqual({ roster: input.roster, shops: input.state.kiosks, spawn: input.state.nextSpawn }, before);
      const arrived = tick(input, recipeRandom);
      assert.ok(arrived.updatedSurvivors.every(actor => actor.zoneId === 'c'));
      assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
      input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
      const paid = tick(input, recipeRandom), after = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
      assert.equal(after.equipped.head, rare._id); assert.equal(after.simCredits, 0);
      assert.equal(invQty(after.inventory, hero._id), 0); assert.equal(invQty(after.inventory, tree._id), 0);
      const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === 'crafter');
      assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, 75);
      assert.equal(receipts[0].beforeCredits, 78); assert.equal(receipts[0].afterCredits, 3);
      assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === 'crafter'));
      assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== 'crafter').every(actor => actor.simCredits === 20));
      const model = buildTeamObserverModel({ teamId: 'team:1', publicItems: input.state.publicItems,
        survivors: JSON.parse(JSON.stringify(paid.updatedSurvivors)), events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])),
        spawnState: input.state.nextSpawn, forbiddenIds: [], day: 3, phase: 'morning', matchSec: 540,
        settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset } });
      const receipt = model.members.find(actor => actor.id === 'crafter').procurement;
      assert.equal(receipt.matchedChoice, true); assert.equal(receipt.actionKey, receipts[0].actionKey);
      console.log(`RECIPE_AWARE_KIOSK_WITNESS ${JSON.stringify({ reverse, discount, chosenCost: quote.cost,
        paidCost: receipts[0].paidCost, recipeCost: 3, remainingCredits: after.simCredits, equippedId: after.equipped.head })}`);
    }
  }
});

check('a recipe-destroying exchange cannot hide the next safe sale for shared and individual travel', () => {
  const input = fixture(), buyer = input.roster[1]; const recipeRandom = createSeedRng('kiosk:recipe:ordered:1'); buyer.simCredits = 78;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: hero._id, giveQty: 1 } },
    { itemId: tree._id, mode: 'sell', priceCredits: 75 },
  ] }];
  const before = structuredClone({ actor: buyer, shops: input.state.kiosks });
  const quote = rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks, input.state.publicItems, 3, 'morning',
    buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems), input.state.itemNameById, input.state.ruleset.market, input.state.ruleset);
  assert.equal(quote?.kind, 'buy'); assert.equal(quote.cost, 75);
  assert.equal(purchasePlans(input).length, 3); assert.deepEqual(individualMove(input, buyer).targets, ['c']);
  assert.deepEqual({ actor: buyer, shops: input.state.kiosks }, before);
  const arrived = tick(input, recipeRandom); input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  assert.ok(input.roster.every(actor => actor.zoneId === 'c'));
  const paid = tick(input, recipeRandom), after = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(after.equipped.head, rare._id); assert.equal(after.simCredits, 0);
  const receipt = paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.equal(receipt.actionType, 'kioskBuy'); assert.equal(receipt.paidCost, 75); assert.deepEqual(receipt.consumed, []);
  assert.equal(invQty(after.inventory, hero._id), 0); assert.equal(invQty(after.inventory, tree._id), 0);
});

check('a buy that cannot fit does not hide a later exchange that frees the needed inventory slot', () => {
  const input = fixture(), buyer = input.roster[1]; const recipeRandom = createSeedRng('kiosk:recipe:ordered:2'); buyer.simCredits = 78;
  buyer.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 });
  Object.assign(input.state.ruleset.inventory, { maxSlots: 2, autoDropLowValue: false });
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: tree._id, mode: 'sell', priceCredits: 75 },
    { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } },
  ] }];
  refreshActorGrowthPlan(buyer, input.state.publicItems, input.state);
  const quote = rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks, input.state.publicItems, 3, 'morning',
    buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems), input.state.itemNameById, input.state.ruleset.market, input.state.ruleset);
  assert.equal(quote?.kind, 'exchange'); assert.deepEqual(quote.consume, [{ itemId: cloth._id, qty: 1 }]);
  assert.ok([...plan(input).movementPlans.values()].every(move => /^팀 제작 교환:/.test(move.sourceReason)));
  assert.deepEqual(individualMove(input, buyer).targets, ['c']);
  const arrived = tick(input, recipeRandom); input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  assert.ok(input.roster.every(actor => actor.zoneId === 'c'));
  const paid = tick(input, recipeRandom), after = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(after.equipped.head, rare._id); assert.equal(after.simCredits, 75);
  for (const item of [hero, tree, cloth]) assert.equal(invQty(after.inventory, item._id), 0);
  const receipt = paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.equal(receipt.actionType, 'kioskExchange'); assert.equal(receipt.paidCost, 0);
});

check('later goal offers preserve every remaining recipe fee in a real multi-stage craft', () => {
  const input = fixture(), buyer = input.roster[1]; const recipeRandom = createSeedRng('kiosk:recipe:ordered:3'); buyer.simCredits = 82;
  const component = { _id: 'purchase-component', name: '생명 부품', type: '재료', tier: 4,
    recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: tree._id, qty: 1 }], resultQty: 1, creditsCost: 4 } };
  const target = { ...rare, recipe: { ingredients: [{ itemId: component._id, qty: 1 }], resultQty: 1, creditsCost: 3 } };
  refresh(input, [...items.filter(item => item._id !== rare._id), component, target]);
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: tree._id, mode: 'sell', priceCredits: 78 },
    { itemId: tree._id, mode: 'sell', priceCredits: 75 },
  ] }];
  assert.equal(buyer._growthPlan.plannedCredits, 7);
  const quote = rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks, input.state.publicItems, 3, 'morning',
    buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems), input.state.itemNameById, input.state.ruleset.market, input.state.ruleset);
  assert.equal(quote?.cost, 75); assert.equal(purchasePlans(input).length, 3);
  const arrived = tick(input, recipeRandom); input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  const paid = tick(input, recipeRandom);
  const receipt = paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter');
  assert.equal(receipt.paidCost, 75); assert.equal(receipt.afterCredits, 7);
  const subsequentEvents = [];
  input.roster = paid.updatedSurvivors;
  for (const sec of [580, 620, 660, 700]) {
    if (input.roster.find(actor => actor._id === 'crafter').equipped.head === rare._id) break;
    input.state.currentActionSec = () => sec;
    const result = tick(input, recipeRandom); input.roster = result.updatedSurvivors; subsequentEvents.push(...result.events);
  }
  const after = input.roster.find(actor => actor._id === 'crafter');
  assert.equal(after.equipped.head, rare._id); assert.equal(after.simCredits, 0);
  for (const item of [hero, tree, component]) assert.equal(invQty(after.inventory, item._id), 0);
  assert.equal([...paid.events, ...subsequentEvents].filter(event => event.kind === 'procurement' && event.who === 'crafter').length, 1);
  assert.equal([...paid.events, ...subsequentEvents].filter(event => event.kind === 'craft' && event.who === 'crafter').length, 2);
});

check('rejected exact recipe trades cannot return through random catalogue fallback', () => {
  for (const random of [0, 0.5, 0.999]) {
    const input = fixture(), buyer = input.roster[1]; buyer.simCredits = 78;
    input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
      { itemId: tree._id, mode: 'sell', priceCredits: 78 },
      { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: hero._id, giveQty: 1 } },
    ] }];
    const before = structuredClone({ actor: buyer, shops: input.state.kiosks });
    const quote = withSimulationRandom(() => random, () => rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks,
      input.state.publicItems, 3, 'morning', buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems),
      input.state.itemNameById, input.state.ruleset.market, input.state.ruleset));
    assert.equal(quote, null); assert.equal(purchasePlans(input).length, 0);
    assert.deepEqual({ actor: buyer, shops: input.state.kiosks }, before);
  }
});

check('catalogue order still prefers an earlier useful order over a cheaper later one', () => {
  const input = fixture(), buyer = input.roster[1]; const recipeRandom = createSeedRng('kiosk:recipe:ordered:5'); buyer.simCredits = 81;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [
    { itemId: tree._id, mode: 'sell', priceCredits: 78 },
    { itemId: tree._id, mode: 'sell', priceCredits: 75 },
  ] }];
  const quote = rollKioskInteraction(input.state.mapObj, 'c', input.state.kiosks, input.state.publicItems, 3, 'morning',
    buyer, getActorGrowthCraftGoal(buyer, input.state.publicItems), input.state.itemNameById, input.state.ruleset.market, input.state.ruleset);
  assert.equal(quote?.cost, 78); assert.equal(purchasePlans(input).length, 3);
  const arrived = tick(input, recipeRandom); input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  const paid = tick(input, recipeRandom), after = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter').paidCost, 78);
  assert.equal(after.equipped.head, rare._id); assert.equal(after.simCredits, 0);
});

check('individual travel uses the real cheap catalog price, pays once, and consumes the recipe without pooled credits', () => {
  const input = fixture(); input.roster = [input.roster[1]]; input.state.isSoloMatch = true;
  input.roster[0].simCredits = 78;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
    catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: 75 }] }];
  refresh(input);
  const before = structuredClone({ actor: input.roster[0], spawn: input.state.nextSpawn, shops: input.state.kiosks });
  const choice = withSimulationRandom(() => { throw new Error('A concrete shop quote cannot use RNG.'); },
    () => individualMove(input, input.roster[0]));
  assert.deepEqual(choice.targets, ['c']); assert.match(choice.reason, /조달 검토/);
  assert.deepEqual({ actor: input.roster[0], spawn: input.state.nextSpawn, shops: input.state.kiosks }, before);
  const arrived = tick(input); input.roster = arrived.updatedSurvivors;
  assert.equal(input.roster[0].zoneId, 'c'); assert.equal(input.roster[0].simCredits, 78);
  assert.equal(arrived.events.filter(event => event.kind === 'procurement').length, 0);
  input.state.currentActionSec = () => 540;
  const paid = tick(input), actor = paid.updatedSurvivors[0];
  assert.equal(actor.equipped.head, rare._id); assert.equal(actor.simCredits, 0);
  assert.equal(invQty(actor.inventory, hero._id), 0); assert.equal(invQty(actor.inventory, tree._id), 0);
  assert.equal(paid.events.filter(event => event.kind === 'procurement').length, 1);
  assert.equal(paid.events.find(event => event.kind === 'procurement').paidCost, 75);
});

check('individual kiosk destinations exclude expensive, missing-stock, failed-exchange and full-bag orders', () => {
  for (const scenario of ['price', 'recipe_credits', 'not_listed', 'missing_exchange', 'protected_bag']) {
    const input = fixture(), actor = input.roster[1];
    const row = { itemId: tree._id, mode: 'sell', priceCredits: scenario === 'price' ? 800 : 75 };
    if (scenario === 'recipe_credits') actor.simCredits = 77;
    if (scenario === 'not_listed') row.itemId = cloth._id;
    if (scenario === 'missing_exchange') Object.assign(row, { mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } });
    if (scenario === 'protected_bag') {
      Object.assign(input.state.ruleset.inventory, { maxSlots: 1, autoDropLowValue: false });
      actor.inventory[0].goalItem = true;
    }
    input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c', catalog: [row] }];
    assert.ok(!individualMove(input).targets.includes('c'), scenario);
  }
});

check('mixed kiosk prices, discounts and exchanges are quoted without admitting an unaffordable default shop', () => {
  const input = fixture(), actor = input.roster[1]; actor.simCredits = 78;
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'b',
    catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: 75 }] },
  { mapId: input.state.mapObj._id, zoneId: 'c', catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: 800 }] }];
  assert.deepEqual(individualMove(input).targets, ['b']);
  input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
    catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: 150 }] }];
  actor._perkRuntime = { kioskDiscountPct: 0.5 };
  assert.deepEqual(individualMove(input).targets, ['c']);
  delete actor._perkRuntime; actor.simCredits = 3;
  actor.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 });
  input.state.kiosks[0].catalog = [{ itemId: tree._id, mode: 'exchange',
    exchange: { giveItemId: cloth._id, giveQty: 1 } }];
  const before = structuredClone(actor), choice = individualMove(input);
  assert.deepEqual(choice.targets, ['c']); assert.deepEqual(actor, before);
  assert.match(describeObserverEvent({ kind: 'team_decision', reason: 'team_rotate',
    sharedGoalReason: choice.reason, moved: false }), /조달 검토/);
  input.state.kiosks[0].catalog[0].exchange.giveItemId = hero._id;
  assert.ok(!individualMove(input).targets.includes('c'), 'An exchange cannot spend the required base gear.');
});

check('default VF purchases retain their time and legendary-readiness gates and pay the real transcend recipe', () => {
  const input = fixture(), crafter = input.roster[1];
  const vf = { _id: 'purchase-vf', name: 'VF 혈액 샘플', type: '재료', tier: 6 };
  const bases = ['weapon', 'head', 'clothes', 'arm', 'shoes'].map(equipSlot => ({ ...hero, _id: `legend-${equipSlot}`,
    itemKey: `legend-${equipSlot}`, equipSlot, weaponType: equipSlot === 'weapon' ? '도끼' : '', tier: 5 }));
  const transcend = { ...gear('purchase-transcend', '초월 모자', vf._id), tier: 6,
    recipe: { ingredients: [{ itemId: 'legend-head', qty: 1 }, { itemId: vf._id, qty: 1 }], resultQty: 1, creditsCost: 3 } };
  crafter.weaponType = '도끼'; crafter.goalGearTier = 6; crafter.simCredits = 503;
  crafter.inventory = bases.map(item => ({ ...item, itemId: item._id, qty: 1 }));
  crafter.equipped = Object.fromEntries(bases.map(item => [item.equipSlot, item._id]));
  crafter.goalLoadouts = { transcend: { headKey: transcend.itemKey } };
  refresh(input, [...items, ...bases, vf, transcend]);
  assert.equal(crafter._growthPlan.targetId, transcend._id);
  assert.equal(purchasePlans(input).length, 0, 'Day 3 cannot buy default VF.');
  input.state.nextDay = 4; input.state.phaseIdxNow = 6;
  assert.equal(purchasePlans(input).length, 3);
  const savedWeapon = crafter.inventory.find(item => item.equipSlot === 'weapon'); savedWeapon.tier = 4;
  assert.equal(purchasePlans(input).length, 0, 'An unfinished legendary slot still defers default VF.');
  savedWeapon.tier = 5;
  const arrived = tick(input); input.roster = arrived.updatedSurvivors; input.state.currentActionSec = () => 540;
  const paid = tick(input), buyer = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(buyer.equipped.head, transcend._id); assert.equal(buyer.simCredits, 0);
  assert.equal(invQty(buyer.inventory, vf._id), 0); assert.equal(invQty(buyer.inventory, 'legend-head'), 0);
  assert.equal(paid.events.find(event => event.kind === 'procurement' && event.who === 'crafter').paidCost, 500);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'real shared paid-recipe selection and normal action settlement; not default balance or human acceptance' }));
