import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { commitProcurementTransaction } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

// Independent current kiosk inputs and real quote/settlement functions. No old
// journals, account server, evaluator answers or prepared match outcomes.
const tree = { _id: 'catalog-tree', name: '생명의 나무', type: '재료', tier: 4 };
const cloth = { _id: 'catalog-cloth', name: '천', type: '재료', tier: 1 };
const ruleset = structuredClone(getRuleset('ER_S11'));
const map = { _id: 'catalog-map', zones: [{ zoneId: 'hospital', name: '병원', hasKiosk: true }] };
const need = { missing: [{ itemId: tree._id, name: tree.name, special: 'life_tree', need: 1, have: 0 }] };
const buyer = (credits, inventory = []) => ({ _id: 'catalog-buyer', name: '구매자', zoneId: 'hospital',
  hp: 100, maxHp: 100, simCredits: credits, inventory: structuredClone(inventory), _actionCycleKey: '4:500' });
const sellRow = (item, priceCredits) => ({ itemId: item._id, mode: 'sell', priceCredits });
function quote(actor, catalog, goal = need) {
  const before = structuredClone({ actor, catalog, goal });
  const offer = withSimulationRandom(() => 0, () => rollKioskInteraction(map, 'hospital',
    [{ mapId: map._id, zoneId: 'hospital', catalog }], [tree, cloth], 3, 'morning', actor, goal,
    { [tree._id]: tree.name, [cloth._id]: cloth.name }, ruleset.market, ruleset));
  assert.deepEqual({ actor, catalog, goal }, before, 'Quoting cannot mutate the actor or saved catalogue.');
  return offer;
}
function commit(actor, offer) {
  const actionType = { buy: 'kioskBuy', sell: 'kioskSell', exchange: 'kioskExchange' }[offer.kind];
  return commitProcurementTransaction({ actor, offer, actionType, ruleset, day: 3, phaseIdxNow: 4 });
}
let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}

check('configured prices at and above the old 650-credit cutoff reach real paid settlement unchanged', () => {
  for (const price of [650, 651, 800, 1200]) {
    const actor = buyer(price), offer = quote(actor, [sellRow(tree, price)]);
    assert.equal(offer?.kind, 'buy'); assert.equal(offer.itemId, tree._id);
    const receipt = commit(actor, offer);
    console.log(`KIOSK_CATALOG_WITNESS ${JSON.stringify({ configuredPrice: price, quotedCost: offer.cost,
      paidCost: receipt.paidCost, remainingCredits: actor.simCredits })}`);
    assert.equal(receipt.ok, true); assert.equal(receipt.paidCost, price); assert.equal(actor.simCredits, 0);
    assert.equal(actor.inventory.find(row => row.itemId === tree._id)?.qty, 1);
  }
});
check('an unrelated expensive row cannot erase an affordable exact material order', () => {
  const actor = buyer(75), offer = quote(actor, [sellRow(tree, 75), sellRow(cloth, 1200)]);
  assert.equal(offer?.itemId, tree._id); assert.equal(offer.cost, 75);
  assert.equal(commit(actor, offer).paidCost, 75); assert.equal(actor.simCredits, 0);
});
check('an unaffordable custom order cannot be bought at the hidden default price', () => {
  const actor = buyer(260), before = structuredClone(actor), offer = quote(actor, [sellRow(tree, 300)]);
  if (offer) {
    const receipt = commit(actor, offer);
    console.log(`KIOSK_CATALOG_WITNESS ${JSON.stringify({ configuredPrice: 300, buyerCredits: 260,
      quotedCost: offer.cost, paidCost: receipt.paidCost, remainingCredits: actor.simCredits })}`);
  }
  assert.equal(offer, null); assert.deepEqual(actor, before);
});
check('a custom shop cannot offer a default rare material missing from its catalogue', () => {
  const actor = buyer(1000), offer = quote(actor, [sellRow(cloth, 800)]);
  assert.equal(offer?.itemId, cloth._id); assert.equal(offer.cost, 800);
  assert.equal(commit(actor, offer).paidCost, 800); assert.equal(actor.simCredits, 200);
  assert.equal(actor.inventory.some(row => row.itemId === tree._id), false);
});
check('an exchange-only shop cannot substitute a credit purchase when the required material is absent', () => {
  const actor = buyer(1000), before = structuredClone(actor);
  assert.equal(quote(actor, [{ itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } }]), null);
  assert.deepEqual(actor, before);
});
check('a valid exact exchange still consumes its real material despite an unrelated high-price entry', () => {
  const actor = buyer(0, [{ ...cloth, itemId: cloth._id, qty: 1 }]);
  const offer = quote(actor, [{ itemId: tree._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } },
    sellRow(cloth, 1200)]);
  assert.equal(offer?.kind, 'exchange'); const receipt = commit(actor, offer);
  assert.equal(receipt.ok, true); assert.deepEqual(receipt.consumed, [{ itemId: cloth._id, qty: 1 }]);
  assert.equal(actor.simCredits, 0); assert.equal(actor.inventory.some(row => row.itemId === cloth._id), false);
  assert.equal(actor.inventory.find(row => row.itemId === tree._id)?.qty, 1);
});
check('a configured high-price refund sells the real held item and never turns into a default buy', () => {
  const actor = buyer(0, [{ ...tree, itemId: tree._id, qty: 1 }]);
  const offer = quote(actor, [{ itemId: tree._id, mode: 'buy', priceCredits: 800 }], { missing: [] });
  assert.equal(offer?.kind, 'sell'); const receipt = commit(actor, offer);
  assert.equal(receipt.ok, true); assert.equal(receipt.gainedCredits, 800); assert.equal(actor.simCredits, 800);
  assert.equal(actor.inventory.some(row => row.itemId === tree._id), false);
});
check('an empty catalogue retains the ordinary rule-based kiosk offer and price', () => {
  const actor = buyer(200), offer = quote(actor, []);
  assert.equal(offer?.itemId, tree._id); assert.equal(offer.cost, 200);
  assert.equal(commit(actor, offer).paidCost, 200); assert.equal(actor.simCredits, 0);
});
console.log(`KIOSK_CATALOG_CONTRACT_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
