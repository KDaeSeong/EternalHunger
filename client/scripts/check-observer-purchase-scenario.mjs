import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const { fixture, tick, hero, tree, rare } = await import('./lib/team-purchase-fixture.mjs');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');

const seed = 'observer:team-purchase:1101';
const isPurchase = event => event.reason === 'team_rotate' && /키오스크|구매|kiosk/.test(event.sharedGoalReason);

function observe(input, survivors, events, matchSec) {
  // Read a JSON-restored real action result. Neither the cards nor receipts
  // are fixtures; only the pre-action recipe, funds and world are controlled.
  const payload = JSON.parse(JSON.stringify({ survivors, dead: [], events, matchSec,
    teamId: 'team:1', publicItems: input.state.publicItems, spawnState: input.state.nextSpawn,
    forbiddenIds: [...input.state.forbiddenIds], day: input.state.nextDay, phase: input.state.nextPhase,
    settings: { rulesetId: 'ER_S11', simulationRuleset: input.state.ruleset } }));
  const before = structuredClone(payload);
  const model = withSimulationRandom(() => { throw new Error('Observer reads cannot draw game randomness.'); },
    () => buildTeamObserverModel(payload));
  assert.deepEqual(payload, before, 'Observer reads cannot mutate the actual decision or settlement input.');
  return model;
}

function runCase({ name, reverse = false, credits = 260, price = 200, forbidden = false, loseCredits = false }) {
  const input = fixture();
  input.roster.find(actor => actor._id === 'crafter').simCredits = credits;
  if (price !== 200) input.state.kiosks = [{ mapId: input.state.mapObj._id, zoneId: 'c',
    catalog: [{ itemId: tree._id, mode: 'sell', priceCredits: price }] }];
  if (forbidden) input.state.forbiddenIds.add('c');
  if (reverse) input.roster.reverse();
  const random = createSeedRng(seed);
  const expectsTravel = !forbidden && credits >= price + 3;
  const expectsPayment = expectsTravel && !loseCredits;
  const travel = tick(input, random);
  const intentions = travel.events.filter(isPurchase);
  const travelModel = observe(input, travel.updatedSurvivors, travel.events, 500);
  assert.equal(travel.events.filter(event => event.kind === 'procurement').length, 0,
    'Travelling to a shop is not also a paid order.');
  assert.ok(travelModel.members.every(member => !member.procurement));
  if (expectsTravel) {
    assert.ok(intentions.length > 0, 'The dedicated fixture must actually exercise shared purchase intentions.');
    assert.equal(new Set(intentions.map(event => event.who)).size, 3);
    assert.ok(travel.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.ok(intentions.every(event => /검토/.test(describeObserverEvent(event))));
    assert.ok(travelModel.members.every(member => /구매 검토.*crafter의 생명 모자/.test(member.decision?.text)));
    assert.equal(travelModel.objectives.length, 0, 'Shop travel cannot fabricate a reserved world resource.');
    const traveler = travel.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.equal(traveler.simCredits, credits);
    assert.equal(invQty(traveler.inventory, tree._id), 0);
    assert.equal(invQty(traveler.inventory, rare._id), 0);
  } else {
    assert.equal(intentions.length, 0, 'Insufficient recipe funds or a forbidden shop cannot create shared purchase travel.');
    assert.ok(travel.updatedSurvivors.every(actor => actor.zoneId !== 'c'));
    assert.ok(travelModel.members.every(member => !/구매 검토/.test(member.decision?.text || '')));
  }

  input.roster = travel.updatedSurvivors;
  if (loseCredits) input.roster.find(actor => actor._id === 'crafter').simCredits = 0;
  input.state.currentActionSec = () => 540;
  const paid = tick(input, random);
  const buyer = paid.updatedSurvivors.find(actor => actor._id === 'crafter');
  const buyerReceipts = paid.events.filter(event => event.kind === 'procurement' && event.who === buyer._id);
  const receipts = buyerReceipts.filter(event => event.actionType === 'kioskBuy' && event.itemId === tree._id);
  const completed = receipts.filter(event => event.outcome === 'completed');
  const paidModel = observe(input, paid.updatedSurvivors, [...travel.events, ...paid.events], 540);
  const observedBuyer = paidModel.members.find(member => member.id === buyer._id);
  if (expectsPayment) {
    assert.equal(completed.length, 1, 'The positive fixture must produce exactly one real paid order.');
    assert.equal(receipts.length, 1);
    assert.equal(completed[0].paidCost, price);
    assert.equal(completed[0].beforeCredits, credits);
    assert.equal(completed[0].afterCredits, credits - price);
    assert.equal(buyer.simCredits, credits - price - 3, 'The real recipe fee must also be paid.');
    assert.equal(buyer.equipped.head, rare._id);
    assert.equal(invQty(buyer.inventory, hero._id), 0);
    assert.equal(invQty(buyer.inventory, tree._id), 0);
    assert.equal(invQty(buyer.inventory, rare._id), 1);
    assert.ok(paid.events.some(event => event.kind === 'craft' && event.who === buyer._id));
    assert.ok(paid.updatedSurvivors.filter(actor => actor._id !== buyer._id).every(actor => actor.simCredits === 20));
    assert.equal(observedBuyer.procurement.outcome, 'completed');
    assert.equal(observedBuyer.procurement.actionKey, completed[0].actionKey);
    assert.equal(observedBuyer.procurement.matchedChoice, true);
    assert.ok(observedBuyer.procurement.result.includes(price + 'Cr'));
    assert.ok(observedBuyer.procurement.result.includes(credits + '→' + (credits - price) + 'Cr'));
    assert.ok(paidModel.members.filter(member => member.id !== buyer._id).every(member => !member.procurement));
  } else {
    assert.equal(completed.length, 0, 'A negative fixture cannot complete the shared recipe order.');
    assert.notEqual(buyer.equipped.head, rare._id);
    assert.equal(invQty(buyer.inventory, tree._id), 0);
    assert.equal(invQty(buyer.inventory, rare._id), 0);
    // An ordinary drone order is legal even when the shared kiosk recipe
    // cannot be completed. Its real receipt must still match its own action.
    if (observedBuyer.procurement) {
      const actual = buyerReceipts.find(event => event.actionKey === observedBuyer.procurement.actionKey);
      assert.ok(actual);
      assert.equal(observedBuyer.procurement.outcome, actual.outcome);
      assert.equal(observedBuyer.procurement.matchedChoice, true);
      assert.notEqual(actual.itemId, tree._id);
    }
  }
  return { name, expectsTravel, expectsPayment, sharedIntentionCount: intentions.length,
    sharedActorCount: new Set(intentions.map(event => event.who)).size, completedReceiptCount: completed.length,
    otherCompletedReceiptCount: buyerReceipts.filter(event => event.outcome === 'completed'
      && !completed.includes(event)).length,
    paidCost: completed[0]?.paidCost || 0, remainingCredits: buyer.simCredits,
    observedReceiptMatched: observedBuyer.procurement?.matchedChoice || false,
    random: random.getState() };
}

// Mandatory positive and negative coverage is independent of a natural
// match's incidental shopping frequency. No game module or result is mocked.
export function runObserverPurchaseScenarioChecks({ report = console.log } = {}) {
  const specs = [
    { name: 'default paid recipe and observer receipt' },
    { name: 'reversed member processing', reverse: true },
    { name: 'authored 75Cr order and 3Cr recipe', price: 75, credits: 78 },
    { name: 'purchase affordable but recipe funds missing', credits: 202 },
    { name: 'credits lost after shared travel', loseCredits: true },
    { name: 'forbidden kiosk destination', forbidden: true },
  ];
  const cases = specs.map(spec => {
    const result = runCase(spec);
    report('PASS observer purchase scenario: ' + spec.name);
    return result;
  });
  const positive = cases.filter(row => row.expectsPayment);
  const negative = cases.filter(row => !row.expectsPayment);
  assert.equal(positive.length, 3);
  assert.equal(negative.length, 3);
  assert.ok(positive.every(row => row.sharedIntentionCount > 0 && row.completedReceiptCount === 1
    && row.observedReceiptMatched), 'Every dedicated positive case must exercise real purchase-to-observer coverage.');
  return { checks: cases.length, pass: true, seed, positiveCases: positive.length, negativeCases: negative.length,
    actualCompletedReceipts: positive.reduce((sum, row) => sum + row.completedReceiptCount, 0), cases,
    scope: 'explicit mid-match conditions, real travel/payment/craft and JSON-restored observer model; not natural balance or browser rendering' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(runObserverPurchaseScenarioChecks(), null, 2));
}
