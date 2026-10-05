import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildTeamCoordination } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { computeLateGameUpgradeNeed } = await import('../src/app/simulation/_lib/gearUpgradeNeedRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { buildItemMetaById, buildItemNameById, buildItemKeyById, buildCraftableItems } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const eventActions = await import('../src/app/simulation/_lib/runEventRuntime.js');

// Explicit mid-match recipe, inventory and earned-credit conditions. This is
// not a default-balance match, a prepared outcome, or the unavailable Marcus input.
const hero = { _id: 'purchase-hero', itemKey: 'purchase-hero', name: '초기 모자', type: '방어구',
  category: 'equipment', equipSlot: 'head', tier: 4, stats: { defense: 10 } };
const cloth = { _id: 'purchase-cloth', name: '추가 천', type: '재료', tier: 1, spawnZones: ['b'] };
const tree = { _id: 'purchase-tree', name: '생명의 나무', type: '재료', tier: 4 };
const gear = (id, name, ingredient) => ({ ...hero, _id: id, itemKey: id, name, tier: 5,
  recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: ingredient, qty: 1 }], resultQty: 1, creditsCost: 3 } });
const ordinary = gear('purchase-ordinary', '천 모자', cloth._id);
const rare = gear('purchase-rare', '생명 모자', tree._id);
const items = [hero, cloth, tree, ordinary, rare];
function fixture() {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.worldSpawns.dimensionRift.enabled = false;
  const mapObj = { _id: 'purchase-map', zones: ['a', 'b', 'c'].map(zoneId => ({ zoneId, name: zoneId, hasKiosk: zoneId === 'c' })) };
  const state = { mapObj, zones: mapObj.zones, zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] },
    forbiddenIds: new Set(), nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset,
    publicItems: items, craftables: buildCraftableItems(items), itemMetaById: buildItemMetaById(items),
    itemNameById: buildItemNameById(items), itemKeyById: buildItemKeyById(items),
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 500, kiosks: [], droneOffers: [],
    nextSpawn: { coreNodes: [], fieldResources: createFieldResources(mapObj, items, ruleset) } };
  const roster = ['leader', 'crafter', 'escort'].map((_id, index) => ({ _id, name: _id, teamId: 'team:1', teamSlot: index + 1,
    zoneId: 'a', hp: 100, maxHp: 100, stats: { attackPower: 20, defense: 10 }, simCredits: index === 1 ? 260 : 20,
    inventory: [{ ...structuredClone(hero), itemId: hero._id, qty: 1 }], equipped: { head: hero._id },
    routePlanTargetItemIds: [hero._id], goalLoadouts: { legend: { headKey: index === 1 ? rare.itemKey : ordinary.itemKey } } }));
  for (const actor of roster) refreshActorGrowthPlan(actor, items, state);
  return { state, roster };
}
function plan({ state, roster }) {
  return buildTeamCoordination({ roster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds,
    day: state.nextDay, phase: state.nextPhase, spawnState: state.nextSpawn, ruleset: state.ruleset,
    publicItems: state.publicItems, isSoloMatch: state.isSoloMatch,
    mapObj: state.mapObj, kiosks: state.kiosks,
    getRotationHold: state.getRotationHold,
    estimatePower: () => 100, chooseLeaderMove: actor => chooseAiMoveTargets({ actor,
      craftGoal: getActorGrowthCraftGoal(actor, state.publicItems),
      upgradeNeed: computeLateGameUpgradeNeed(actor, state.itemMetaById, state.itemNameById, state.nextDay, state.nextPhase, state.ruleset),
      mapObj: state.mapObj, spawnState: state.nextSpawn, forbiddenIds: state.forbiddenIds, kiosks: state.kiosks, publicItems: state.publicItems,
      day: state.nextDay, phase: state.nextPhase, ruleset: state.ruleset }) });
}
function tick(input) {
  const { state, roster } = input, events = [], logs = [];
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at,
    actions: { enqueueRunEvent: event => events.push(structuredClone(event)) } });
  const actions = { atNow: () => ({ day: state.nextDay, phase: state.nextPhase, sec: state.currentActionSec() }),
    emitRunEvent, addLog: message => logs.push(message),
    emitItemGainIfAny: (...args) => eventActions.emitItemGainIfAny(emitRunEvent, ...args),
    emitObjectiveRunEvent: (...args) => eventActions.emitObjectiveRunEvent(emitRunEvent, ...args),
    emitQueueRunEvent: (...args) => eventActions.emitQueueRunEvent(emitRunEvent, ...args),
    emitCraftRunEvent: (...args) => eventActions.emitCraftRunEvent(emitRunEvent, ...args) };
  actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => applyLootCraftResult(actor, result, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  return { ...withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...state, phaseSurvivors: roster }, actions })), events, logs };
}
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
function refresh(input, catalog = input.state.publicItems) {
  Object.assign(input.state, { publicItems: catalog, craftables: buildCraftableItems(catalog),
    itemMetaById: buildItemMetaById(catalog), itemNameById: buildItemNameById(catalog), itemKeyById: buildItemKeyById(catalog) });
  input.state.nextSpawn.fieldResources = createFieldResources(input.state.mapObj, catalog, input.state.ruleset);
  for (const actor of input.roster) refreshActorGrowthPlan(actor, catalog, input.state);
}
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
