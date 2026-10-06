import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { fixture, plan, tick, refresh, hero, tree, rare, gear, items } = await import('./lib/team-purchase-fixture.mjs');
const { getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { quoteDefaultKioskGoalAction } = await import('../src/app/simulation/_lib/kioskGoalQuoteRuntime.js');
const { resolveKioskSpecialItems } = await import('../src/app/simulation/_lib/aiKioskSpecialItemsRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng, restoreSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const noRandom = () => { throw Error('An identity quote cannot draw RNG.'); };
const kinds = [
  { key: 'meteor', name: '운석', cost: 200 }, { key: 'life_tree', name: '생명의 나무', cost: 200 },
  { key: 'mithril', name: '미스릴', cost: 250 }, { key: 'force_core', name: '포스 코어', cost: 350 },
  { key: 'vf', name: 'VF 혈액 샘플', cost: 500 },
];
function identityFixture(kind = kinds[1], { reverse = false, solo = false, taggedDecoy = false } = {}) {
  const input = fixture(), buyer = input.roster[1];
  const material = { ...tree, _id: `needed-${kind.key}`, name: kind.name, tier: kind.key === 'vf' ? 6 : 4 };
  const decoy = { ...material, _id: `decoy-${kind.key}`, ...(taggedDecoy ? { tags: [kind.key] } : {}) };
  const target = gear(rare._id, rare.name, material._id);
  const bases = kind.key === 'vf' ? ['weapon', 'head', 'clothes', 'arm', 'shoes'].map(equipSlot => ({ ...hero,
    _id: `identity-${equipSlot}`, itemKey: `identity-${equipSlot}`, equipSlot, tier: 5,
    weaponType: equipSlot === 'weapon' ? '도끼' : '' })) : [];
  if (bases.length) {
    target.tier = 6; target.recipe.ingredients[0].itemId = 'identity-head';
    buyer.weaponType = '도끼'; buyer.goalGearTier = 6;
    buyer.inventory = bases.map(item => ({ ...item, itemId: item._id, qty: 1 }));
    buyer.equipped = Object.fromEntries(bases.map(item => [item.equipSlot, item._id]));
    buyer.goalLoadouts = { transcend: { headKey: target.itemKey } };
    input.state.nextDay = 4; input.state.phaseIdxNow = 6;
  }
  buyer.simCredits = kind.cost + 3;
  const catalog = [decoy, ...items.filter(item => ![tree._id, rare._id].includes(item._id)), ...bases, material, target];
  if (reverse) catalog.reverse();
  if (solo) { input.roster = [buyer]; input.state.isSoloMatch = true; }
  refresh(input, catalog);
  return { ...input, material, decoy, target, price: kind.cost, baseId: target.recipe.ingredients[0].itemId };
}
function quote(input) {
  const buyer = input.roster.find(actor => actor._id === 'crafter'), { state } = input;
  return withSimulationRandom(noRandom, () => quoteDefaultKioskGoalAction({ actor: buyer,
    craftGoal: getActorGrowthCraftGoal(buyer, state.publicItems), publicItems: state.publicItems,
    ruleset: state.ruleset, day: state.nextDay, phase: state.nextPhase }));
}
function actionQuote(input) {
  const buyer = input.roster.find(actor => actor._id === 'crafter'), { state } = input;
  return withSimulationRandom(() => 0, () => rollKioskInteraction(state.mapObj, 'c', state.kiosks,
    state.publicItems, state.nextDay, state.nextPhase, buyer, getActorGrowthCraftGoal(buyer, state.publicItems),
    state.itemNameById, state.ruleset.market, state.ruleset));
}
function payAndObserve(input, restore = false) {
  const buyer = input.roster.find(actor => actor._id === 'crafter');
  const before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn, shops: input.state.kiosks });
  assert.equal(quote(input).itemId, input.material._id); assert.equal(actionQuote(input).itemId, input.material._id);
  const shared = withSimulationRandom(noRandom, () => plan(input));
  if (!input.state.isSoloMatch) assert.equal([...shared.movementPlans.values()].filter(move => /^팀 제작 구매:/.test(move.sourceReason)).length, 3);
  assert.deepEqual({ roster: input.roster, spawn: input.state.nextSpawn, shops: input.state.kiosks }, before);
  let random = createSeedRng('kiosk:recipe:ordered:0');
  const arrived = tick(input, random); input.roster = arrived.updatedSurvivors;
  assert.equal(input.roster.find(actor => actor._id === buyer._id).zoneId, 'c');
  assert.ok(!arrived.events.some(event => event.kind === 'procurement'));
  if (restore) {
    const frame = createSimulationFrame({ survivors: input.roster, dead: [], day: input.state.nextDay,
      phase: input.state.nextPhase, matchSec: 500, spawnState: input.state.nextSpawn,
      forbiddenIds: input.state.forbiddenIds, mapId: input.state.mapObj._id });
    const saved = JSON.parse(JSON.stringify({ frame, randomState: random.getState() }));
    input.roster = saved.frame.survivors; input.state.nextSpawn = saved.frame.spawnState;
    random = restoreSeedRng(saved.randomState);
  }
  input.state.currentActionSec = () => 540;
  const paid = tick(input, random), after = paid.updatedSurvivors.find(actor => actor._id === buyer._id);
  const receipts = paid.events.filter(event => event.kind === 'procurement' && event.who === buyer._id);
  assert.equal(receipts.length, 1); assert.equal(receipts[0].itemId, input.material._id); assert.equal(receipts[0].paidCost, input.price);
  assert.equal(receipts[0].afterCredits, 3); assert.equal(after.simCredits, 0); assert.equal(after.equipped.head, input.target._id);
  assert.equal(invQty(after.inventory, input.material._id), 0); assert.equal(invQty(after.inventory, input.decoy._id), 0);
  assert.equal(invQty(after.inventory, input.baseId), 0);
  assert.equal(paid.events.filter(event => event.kind === 'craft' && event.who === buyer._id).length, 1);
  assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== buyer._id).every(actor => actor.simCredits === 20));
  const model = buildTeamObserverModel({ teamId: buyer.teamId, publicItems: input.state.publicItems,
    spawnState: input.state.nextSpawn, forbiddenIds: [], settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset },
    day: input.state.nextDay, phase: input.state.nextPhase, survivors: JSON.parse(JSON.stringify(paid.updatedSurvivors)),
    events: JSON.parse(JSON.stringify([...arrived.events, ...paid.events])), matchSec: 540 });
  const receipt = model.members.find(member => member.id === buyer._id).procurement;
  assert.equal(receipt.matchedChoice, true); assert.equal(receipt.outcome, 'completed');
  assert.equal(receipt.actionKey, receipts[0].actionKey);
  console.log(`EXACT_KIOSK_MATERIAL_WITNESS ${JSON.stringify({ id: input.material._id, cost: input.price,
    solo: !!input.state.isSoloMatch, restored: restore, recipeCost: 3, remainingCredits: after.simCredits,
    equippedId: after.equipped.head, receiptActionKey: receipt.actionKey })}`);
}

check('duplicate life-tree names use the recipe ID in normal solo purchase, craft and observer receipts', () => {
  for (const reverse of [false, true]) for (const restore of [false, true]) payAndObserve(identityFixture(kinds[1], { reverse, solo: true }), restore);
});
check('all five priced default materials use exact recipe IDs regardless of catalog order and tag priority', () => {
  for (const kind of kinds) for (const reverse of [false, true]) payAndObserve(identityFixture(kind, { reverse, taggedDecoy: true }));
});
check('a previously owned same-name ingredient remains untouched and cannot satisfy the exact recipe need', () => {
  const input = identityFixture(kinds[1], { solo: true }), buyer = input.roster[0];
  buyer.inventory.push({ ...input.decoy, itemId: input.decoy._id, qty: 1 }); refresh(input);
  assert.equal(quote(input).itemId, input.material._id);
  const random = createSeedRng('kiosk:recipe:ordered:0'); input.roster = tick(input, random).updatedSurvivors;
  input.state.currentActionSec = () => 540;
  const paid = tick(input, random), after = paid.updatedSurvivors[0];
  assert.equal(after.equipped.head, input.target._id); assert.equal(after.simCredits, 0);
  assert.equal(invQty(after.inventory, input.decoy._id), 1);
});
check('food-tagged exact stock does not substitute a same-name default item or fabricate a payable shared goal', () => {
  const input = identityFixture();
  refresh(input, input.state.publicItems.map(item => item._id === input.material._id ? { ...item, tags: ['food'] } : item));
  const before = structuredClone(input.roster);
  assert.equal(quote(input), null); assert.equal(actionQuote(input), null);
  assert.ok([...plan(input).movementPlans.values()].every(move => !/^팀 제작 구매:/.test(move.sourceReason)));
  assert.deepEqual(input.roster, before);
  input.roster = [input.roster[1]]; input.state.isSoloMatch = true; input.roster[0].zoneId = 'c';
  const actual = tick(input, createSeedRng('kiosk:recipe:ordered:0'));
  assert.ok(!actual.events.some(event => event.kind === 'procurement' && event.source === 'kiosk'));
  assert.equal(invQty(actual.updatedSurvivors[0].inventory, input.material._id), 0);
  assert.equal(invQty(actual.updatedSurvivors[0].inventory, input.decoy._id), 0);
  assert.equal(actual.updatedSurvivors[0].equipped.head, hero._id);
});
check('two missing IDs of the same special kind are paid separately and consumed by the real combined recipe', () => {
  for (const reverse of [false, true]) {
    const input = identityFixture(kinds[1], { reverse, solo: true }), buyer = input.roster[0]; buyer.simCredits = 403;
    const target = { ...input.target, recipe: { ...input.target.recipe,
      ingredients: [...input.target.recipe.ingredients, { itemId: input.decoy._id, qty: 1 }] } };
    refresh(input, input.state.publicItems.map(item => item._id === target._id ? target : item));
    const random = createSeedRng('kiosk:recipe:ordered:0'), events = [];
    for (const sec of [500, 540, 580, 620, 660]) {
      input.state.currentActionSec = () => sec;
      const result = tick(input, random); input.roster = result.updatedSurvivors; events.push(...result.events);
      if (input.roster[0].equipped.head === target._id) break;
    }
    const receipts = events.filter(event => event.kind === 'procurement' && event.who === buyer._id);
    assert.equal(receipts.length, 2); assert.deepEqual(new Set(receipts.map(event => event.itemId)), new Set([input.material._id, input.decoy._id]));
    assert.equal(receipts.reduce((sum, event) => sum + event.paidCost, 0), 400);
    assert.equal(input.roster[0].equipped.head, target._id); assert.equal(input.roster[0].simCredits, 0);
    for (const id of [input.material._id, input.decoy._id, hero._id]) assert.equal(invQty(input.roster[0].inventory, id), 0);
  }
});
check('a force-core exchange yields the exact required output while conserving unrelated same-name cores', () => {
  const input = identityFixture(kinds[3], { solo: true }), buyer = input.roster[0]; buyer.simCredits = 3;
  const meteor = { ...tree, _id: 'identity-meteor', name: '운석' };
  const life = { ...tree, _id: 'identity-life', name: '생명의 나무' };
  buyer.inventory.push(...[meteor, life, input.decoy].map(item => ({ ...item, itemId: item._id, qty: 1 })));
  refresh(input, [...input.state.publicItems, meteor, life]);
  assert.equal(quote(input).kind, 'exchange'); assert.equal(quote(input).itemId, input.material._id);
  const random = createSeedRng('kiosk:recipe:ordered:0'); input.roster = tick(input, random).updatedSurvivors;
  input.state.currentActionSec = () => 540;
  const paid = tick(input, random), after = paid.updatedSurvivors[0], receipt = paid.events.find(event => event.kind === 'procurement');
  assert.equal(receipt.actionType, 'kioskExchange'); assert.equal(receipt.itemId, input.material._id); assert.equal(receipt.paidCost, 0);
  assert.equal(after.simCredits, 0); assert.equal(after.equipped.head, input.target._id);
  assert.equal(invQty(after.inventory, input.decoy._id), 1);
});
check('without an explicit missing ID the original tagged, name and idle selection order remains intact', () => {
  const input = identityFixture(kinds[1], { taggedDecoy: true }), before = structuredClone(input.state.publicItems);
  assert.equal(resolveKioskSpecialItems(input.state.publicItems).lifeTreeItem._id, input.decoy._id);
  assert.equal(resolveKioskSpecialItems(input.state.publicItems, [{ name: '생명의 나무', special: 'life_tree' }]).lifeTreeItem._id, input.decoy._id);
  assert.equal(resolveKioskSpecialItems([...input.state.publicItems].reverse()).lifeTreeItem._id, input.decoy._id);
  assert.deepEqual(input.state.publicItems, before);
});
console.log(`Kiosk material identity checks passed: ${checks}/${checks}`);
