import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { GUEST_ITEM_CATALOG } from '../src/app/simulation/_generated/guestItemCatalog.generated.js';
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { rollDroneOrder } = await import('../src/app/simulation/_lib/aiDroneRuntime.js');
const { commitProcurementTransaction } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const { isDefaultKioskItem, isMarketItemAllowed, visibleKioskCatalog } = await import('../src/utils/marketItemPolicy.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const ruleset = structuredClone(getRuleset('ER_S11'));
const map = { _id: 'food-policy-map', zones: [{ zoneId: 'hospital', name: '병원', hasKiosk: true }] };
const water = GUEST_ITEM_CATALOG.find(item => item.name === '물');
const tree = GUEST_ITEM_CATALOG.find(item => item.name === '생명의 나무');
const cloth = { _id: 'policy-cloth', name: '천', type: '재료', tier: 1 };
const authoredFood = { _id: 'authored-food', name: '관리자 급식', type: '재료', tags: ['food'], tier: 1 };
const foods = [...GUEST_ITEM_CATALOG.filter(item => item.name !== '물'
  && (item.name === '고기' || (item.tags || []).some(tag => ['food', 'drink', '음식', '음료'].includes(tag)))), authoredFood];
const buyer = (inventory = []) => ({ _id: 'policy-buyer', hp: 100, maxHp: 100,
  simCredits: 1000, goalGearTier: 4, tacticalSkillLevel: 1, inventory: structuredClone(inventory), equipped: {} });
const goal = item => ({ missing: [{ itemId: item._id, name: item.name, need: 1, have: 0 }] });
function kiosk(actor, items, catalog, need = goal(items[0]), extra = {}) {
  return withSimulationRandom(() => 0, () => rollKioskInteraction(map, 'hospital',
    [{ mapId: map._id, zoneId: 'hospital', catalog, ...extra }], items, 4, 'morning', actor,
    need, {}, ruleset.market, ruleset));
}
function drone(actor, items, offers = [], need = goal(items[0])) {
  return withSimulationRandom(() => 0, () => rollDroneOrder(offers, map, items,
    1, 'morning', actor, 0, need, {}, ruleset.market));
}
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }

check('the real default catalogue contains exactly the six requested resources and module', () => {
  const names = GUEST_ITEM_CATALOG.filter(isDefaultKioskItem).map(item => item.name).sort();
  assert.deepEqual(names, ['운석', '생명의 나무', '미스릴', '전술 강화 모듈', 'VF 혈액 샘플', '포스 코어'].sort());
  for (const name of names) {
    const item = GUEST_ITEM_CATALOG.find(row => row.name === name);
    assert.equal(kiosk(buyer(), [item], [])?.itemId, item._id, name);
  }
});

check('all shipped food and authored food are excluded from default, goal, route and explicit shop paths', () => {
  assert.ok(foods.some(item => item.name === '고기' && item.type === '재료'));
  for (const item of foods) {
    assert.equal(isMarketItemAllowed(item, 'kiosk'), false, item.name);
    assert.equal(isMarketItemAllowed(item, 'drone'), false, item.name);
    assert.equal(kiosk(buyer(), [item], []), null, item.name);
    assert.equal(kiosk(buyer(), [item, tree], [{ itemId: item._id, mode: 'sell', priceCredits: 1 }]), null, item.name);
    assert.equal(drone(buyer(), [item], [{ itemId: item, priceCredits: 1 }]), null, item.name);
    const actor = buyer(); actor.routePlanDroneItemIds = [item._id];
    assert.equal(drone(actor, [item]), null, item.name);
  }
});

check('water is forbidden in kiosk defaults, custom purchases, exchanges and refunds', () => {
  assert.equal(kiosk(buyer(), [water], []), null);
  for (const row of [{ itemId: water._id, mode: 'sell', priceCredits: 1 },
    { itemId: water._id, mode: 'buy', priceCredits: 1 },
    { itemId: water._id, mode: 'exchange', exchange: { giveItemId: cloth._id, giveQty: 1 } },
    { itemId: tree._id, mode: 'exchange', exchange: { giveItemId: water._id, giveQty: 1 } }]) {
    const actor = buyer([{ ...water, itemId: water._id, qty: 1 }, { ...cloth, itemId: cloth._id, qty: 1 }]);
    assert.equal(kiosk(actor, [water, tree, cloth], [row]), null);
  }
});

check('a populated water drone offer uses its actual price and settles once without free delivery', () => {
  const actor = buyer(), before = structuredClone(actor);
  const offer = drone(actor, [water], [{ _id: 'water-offer', itemId: water, priceCredits: 17 }]);
  assert.equal(offer.itemId, water._id); assert.equal(offer.cost, 17); assert.equal(offer.offerId, 'water-offer');
  assert.deepEqual(actor, before);
  const receipt = commitProcurementTransaction({ actor, offer, actionType: 'droneOrder', ruleset });
  assert.equal(receipt.ok, true); assert.equal(receipt.paidCost, 17); assert.equal(actor.simCredits, 983);
  assert.equal(actor.inventory.find(row => row.itemId === water._id).qty, 1);
  assert.equal(commitProcurementTransaction({ actor, offer, actionType: 'droneOrder', ruleset }).reason, 'already_committed');
});

check('water is available through drone recipe needs, opening routes and ordinary fallback stock', () => {
  assert.equal(drone(buyer(), [water]).itemId, water._id);
  const routed = buyer(); routed.routePlanDroneItemIds = [water._id];
  assert.equal(drone(routed, [water]).source, 'route_plan_drone');
  assert.equal(drone(buyer(), [water], [], { missing: [] }).itemId, water._id);
  assert.equal(drone(buyer(), [cloth], [], goal(cloth)).itemId, cloth._id);
});

check('old queued food orders reject atomically at settlement even after JSON restoration', () => {
  for (const item of [...foods, water]) for (const [actionType, kind] of [['kioskBuy', 'buy'], ['kioskSell', 'sell'],
    ['kioskExchange', 'exchange'], ['droneOrder', 'drone']]) {
    if (item === water && actionType === 'droneOrder') continue;
    const actor = buyer([{ ...item, itemId: item._id, qty: 1 }, { ...cloth, itemId: cloth._id, qty: 1 }]);
    const before = structuredClone(actor);
    const offer = JSON.parse(JSON.stringify({ itemId: item._id, item, kind, qty: 1, cost: 1,
      credits: 1, consume: [{ itemId: cloth._id, qty: 1 }] }));
    assert.equal(commitProcurementTransaction({ actor, offer, actionType, ruleset }).reason, 'restricted_item');
    assert.deepEqual(actor, before);
  }
  const actor = buyer([{ ...water, itemId: water._id, qty: 1 }]), before = structuredClone(actor);
  const offer = { kind: 'exchange', itemId: tree._id, item: tree, qty: 1, consume: [{ itemId: water._id, qty: 1 }] };
  assert.equal(commitProcurementTransaction({ actor, offer, actionType: 'kioskExchange', ruleset }).reason, 'restricted_item');
  assert.deepEqual(actor, before);
});

check('catalogue filtering keeps original transaction indices and populated authored food metadata', () => {
  const raw = [{ itemId: authoredFood, mode: 'sell' }, { itemId: water, mode: 'sell' },
    { itemId: tree, mode: 'sell', priceCredits: 75 }];
  const before = structuredClone(raw), visible = visibleKioskCatalog(raw, id => ({ _id: id, name: '표시 이름' }));
  assert.deepEqual(visible.map(row => row.catalogIndex), [2]); assert.deepEqual(raw, before);
  assert.equal(visibleKioskCatalog(visible)[0].catalogIndex, 2);
});

check('a filtered-empty custom shop cannot borrow default stock, and default kiosks cannot buy ordinary crafting inputs', () => {
  assert.equal(kiosk(buyer(), [tree], [], goal(tree), { hasCustomCatalog: true }), null);
  assert.equal(kiosk(buyer(), [cloth], []), null);
  assert.equal(kiosk(buyer(), [cloth], [{ itemId: cloth._id, mode: 'sell', priceCredits: 7 }]).cost, 7);
});

check('food-named equipment stays a non-food custom item and cannot enter the six-item default stock', () => {
  const weapon = { _id: 'bread-sword', name: '빵 검', type: '무기', equipSlot: 'weapon', tier: 1 };
  assert.equal(isMarketItemAllowed(weapon, 'kiosk'), true); assert.equal(isDefaultKioskItem(weapon), false);
});

console.log(JSON.stringify({ checks, pass: true, foodItemsChecked: foods.length,
  scope: 'current catalogue, real kiosk/drone quote and atomic settlement; not live account or balance acceptance' }));
