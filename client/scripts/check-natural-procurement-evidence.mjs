import assert from 'node:assert/strict';
import { summarizeKioskCraftEvidence } from './lib/natural-procurement-evidence.mjs';

const queue = ({ who = 'a', actionKey = 'buy:1', chosen = 'kioskBuy', itemId = 'wood', sharedGoalReason = '' } = {}) => ({
  kind: 'queue', who, actionKey, chosen, itemId, sharedGoalReason,
});
const receipt = ({ who = 'a', actionKey = 'buy:1', actionType = 'kioskBuy', itemId = 'wood', receivedQty = 1,
  paidCost = 20, beforeCredits = 100, afterCredits = beforeCredits - paidCost, outcome = 'completed', source = 'kiosk',
  consumed = [] } = {}) => ({ kind: 'procurement', who, actionKey, actionType, itemId, receivedQty,
  paidCost, beforeCredits, afterCredits, outcome, source, consumed });
const craft = ({ who = 'a', actionKey = 'craft:1', itemId = 'gear', paidCost = 5, beforeCredits = 80,
  afterCredits = beforeCredits - paidCost, consumed = [{ itemId: 'wood', qty: 1 }], qty = 1 } = {}) => ({
  kind: 'craft', who, actionKey, itemId, paidCost, beforeCredits, afterCredits, consumed, qty,
});

function summarizeUnchanged(events, options = {}) {
  const beforeEvents = structuredClone(events);
  const beforeEquipIndexes = new Set(options.equippedCraftEventIndexes || []);
  const result = summarizeKioskCraftEvidence(events, options);
  assert.deepEqual(events, beforeEvents, 'The event journal must remain unchanged.');
  assert.deepEqual(options.equippedCraftEventIndexes || new Set(), beforeEquipIndexes,
    'The supplied equip-index set must remain unchanged.');
  return result;
}

const normal = [queue({ sharedGoalReason: '팀 제작 구매: 생명 모자' }), receipt(), craft()];
const normalResult = summarizeUnchanged(normal, { equippedCraftEventIndexes: new Set([2]) });
assert.deepEqual(normalResult.receivedReceiptEventIndexes, [1]);
assert.deepEqual(normalResult.associations, [{
  receiptEventIndex: 1, queueEventIndex: 0, craftEventIndex: 2, who: 'a', purchasedId: 'wood', linkedQty: 1,
  purchaseActionKey: 'buy:1', craftActionKey: 'craft:1', actionType: 'kioskBuy', paidCost: 20,
  craftId: 'gear', craftCost: 5, sharedPurposeTagged: true, equippedObserved: true,
}]);
assert.deepEqual(normalResult.zeroFeeAssociations, [], 'Paid craft evidence must not also enter the zero-fee category.');
assert.equal(normalResult.scope, 'quantity-bounded journal association, not lot provenance or causal shared procurement');

const excluded = [
  receipt({ actionType: 'kioskSell', receivedQty: 0 }),
  receipt({ actionKey: 'cancelled', outcome: 'cancelled', receivedQty: 1 }),
  receipt({ actionKey: 'zero', receivedQty: 0 }),
  receipt({ actionKey: 'fraction', receivedQty: 1.5 }),
  receipt({ actionKey: 'negative', receivedQty: -1 }),
  receipt({ actionKey: 'exchange', actionType: 'kioskExchange', itemId: 'fiber', receivedQty: 2 }),
];
assert.deepEqual(summarizeUnchanged(excluded).receivedReceiptEventIndexes, [5]);

for (const mismatch of [
  { who: 'other' },
  { actionKey: 'wrong-key' },
  { chosen: 'kioskExchange' },
  { itemId: 'fiber' },
]) {
  const result = summarizeUnchanged([queue({ ...mismatch, sharedGoalReason: '팀 제작 구매: 생명 모자' }), receipt(), craft()]);
  assert.equal(result.associations[0]?.queueEventIndex, null, `Queue mismatch must not join: ${JSON.stringify(mismatch)}`);
  assert.equal(result.associations[0]?.sharedPurposeTagged, false, 'A mismatched labeled queue cannot tag purpose.');
}

const untaggedQueue = summarizeUnchanged([queue({ sharedGoalReason: '팀 공동 목표 · 키오스크' }), receipt(), craft()]);
assert.equal(untaggedQueue.associations[0]?.queueEventIndex, 0);
assert.equal(untaggedQueue.associations[0]?.sharedPurposeTagged, false, 'Only the exact authored purpose prefix is tagged.');

const invalidReceipts = [
  receipt({ source: 'drone' }),
  receipt({ actionKey: '' }),
  receipt({ who: '' }),
  receipt({ itemId: '' }),
];
assert.deepEqual(summarizeUnchanged(invalidReceipts).receivedReceiptEventIndexes, [],
  'Wrong source and missing string identity keys cannot create received inventory evidence.');

assert.throws(() => summarizeUnchanged([
  receipt({ actionKey: 'duplicate' }), receipt({ actionKey: 'duplicate' }),
]), /Duplicate completed procurement action/);

const lateQueue = summarizeUnchanged([receipt(), queue(), craft()]);
assert.equal(lateQueue.associations[0]?.queueEventIndex, null, 'A queue after receipt cannot join backward.');

const sameSecondBeforeReceipt = summarizeUnchanged([
  { ...craft(), at: { sec: 7 } },
  { ...queue(), at: { sec: 7 } },
  { ...receipt(), at: { sec: 7 } },
]);
assert.deepEqual(sameSecondBeforeReceipt.associations, [], 'Original event order wins even when timestamps match.');

const twoReceiptsOneConsumption = summarizeUnchanged([
  queue({ actionKey: 'buy:1' }), receipt({ actionKey: 'buy:1' }),
  queue({ actionKey: 'buy:2' }), receipt({ actionKey: 'buy:2' }),
  craft(),
]);
assert.equal(twoReceiptsOneConsumption.associations.length, 1);
assert.equal(twoReceiptsOneConsumption.associations[0].receiptEventIndex, 1,
  'One consumed unit cannot be allocated to both receipt lots.');

const splitQuantity = summarizeUnchanged([
  queue(), receipt({ receivedQty: 3 }),
  craft({ actionKey: 'craft:1', consumed: [{ itemId: 'wood', qty: 1 }] }),
  craft({ actionKey: 'craft:2', consumed: [{ itemId: 'wood', qty: 2 }] }),
]);
assert.deepEqual(splitQuantity.associations.map(row => [row.craftEventIndex, row.linkedQty]), [[2, 1], [3, 2]]);

const saleAndExchange = summarizeUnchanged([
  queue({ actionKey: 'buy:1' }), receipt({ actionKey: 'buy:1', receivedQty: 2 }),
  receipt({ actionKey: 'sale:1', actionType: 'kioskSell', itemId: 'wood', receivedQty: 0,
    consumed: [{ itemId: 'wood', qty: 1 }] }),
  queue({ actionKey: 'exchange:1', chosen: 'kioskExchange', itemId: 'fiber', sharedGoalReason: '팀 제작 교환: 섬유' }),
  receipt({ actionKey: 'exchange:1', actionType: 'kioskExchange', itemId: 'fiber', receivedQty: 1,
    paidCost: 0, beforeCredits: 80, afterCredits: 80, consumed: [{ itemId: 'wood', qty: 1 }] }),
  craft({ actionKey: 'craft:wood', consumed: [{ itemId: 'wood', qty: 1 }] }),
  craft({ actionKey: 'craft:fiber', consumed: [{ itemId: 'fiber', qty: 1 }] }),
]);
assert.deepEqual(saleAndExchange.receivedReceiptEventIndexes, [1, 4]);
assert.equal(saleAndExchange.associations.length, 1, 'A sold/exchanged-away unit cannot be linked to later crafting.');
assert.equal(saleAndExchange.associations[0].receiptEventIndex, 4);
assert.equal(saleAndExchange.associations[0].purchasedId, 'fiber');
assert.equal(saleAndExchange.associations[0].sharedPurposeTagged, true);

const paidChecks = summarizeUnchanged([
  queue(), receipt({ receivedQty: 3 }),
  craft({ actionKey: 'free', paidCost: 0, beforeCredits: 80, afterCredits: 80 }),
  craft({ actionKey: 'wrong-delta', paidCost: 5, beforeCredits: 80, afterCredits: 76 }),
  craft({ actionKey: 'paid', paidCost: 5, beforeCredits: 76, afterCredits: 71 }),
]);
assert.deepEqual(paidChecks.associations.map(row => row.craftActionKey), ['paid']);
assert.deepEqual(paidChecks.zeroFeeAssociations.map(row => row.craftActionKey), ['free'],
  'A valid zero-fee craft is separate from paid crafts; a mismatched delta is excluded.');

const zeroFeeWithPurchase = summarizeUnchanged([
  queue({ chosen: 'kioskExchange', sharedGoalReason: '팀 제작 교환: 나뭇가지' }),
  receipt({ actionType: 'kioskExchange', paidCost: 0, beforeCredits: 100, afterCredits: 100,
    consumed: [{ itemId: 'metal', qty: 1 }] }),
  craft({ actionKey: 'craft:free', paidCost: 0, beforeCredits: 80, afterCredits: 80 }),
], { equippedCraftEventIndexes: new Set([2]) });
assert.deepEqual(zeroFeeWithPurchase.associations, []);
assert.equal(zeroFeeWithPurchase.zeroFeeAssociations.length, 1);
assert.equal(zeroFeeWithPurchase.zeroFeeAssociations[0].linkedQty, 1,
  'Zero-fee craft still requires a real positive ingredient consumption.');
assert.equal(zeroFeeWithPurchase.zeroFeeAssociations[0].sharedPurposeTagged, true);
assert.equal(zeroFeeWithPurchase.zeroFeeAssociations[0].equippedObserved, true);

const zeroFeeConsumesOnce = summarizeUnchanged([
  queue(), receipt({ receivedQty: 1 }),
  craft({ actionKey: 'craft:free', paidCost: 0, beforeCredits: 80, afterCredits: 80 }),
  craft({ actionKey: 'craft:paid-later', paidCost: 5, beforeCredits: 80, afterCredits: 75 }),
]);
assert.deepEqual(zeroFeeConsumesOnce.zeroFeeAssociations.map(row => row.craftActionKey), ['craft:free']);
assert.deepEqual(zeroFeeConsumesOnce.associations, [], 'A zero-fee craft consumes the receipt budget once; later crafting cannot reuse it.');

const invalidZeroFee = summarizeUnchanged([
  queue(), receipt({ receivedQty: 1 }),
  craft({ actionKey: 'craft:invalid-free', paidCost: 0, beforeCredits: 80, afterCredits: 79 }),
]);
assert.deepEqual(invalidZeroFee.associations, []);
assert.deepEqual(invalidZeroFee.zeroFeeAssociations, [], 'Zero price with a changing balance is not a valid zero-fee receipt.');

for (const invalidFirstCraft of [
  craft({ actionKey: 'free', paidCost: 0, beforeCredits: 80, afterCredits: 80 }),
  craft({ actionKey: 'bad-delta', paidCost: 5, beforeCredits: 80, afterCredits: 76 }),
  craft({ actionKey: 'negative-balance', paidCost: 11, beforeCredits: 10, afterCredits: -1 }),
]) {
  const result = summarizeUnchanged([
    queue(), receipt({ receivedQty: 1 }),
    invalidFirstCraft,
    craft({ actionKey: 'later-paid', beforeCredits: 75, afterCredits: 70 }),
  ]);
  assert.deepEqual(result.associations, [], 'Consumed units cannot reappear after an unpaid or invalid-credit craft.');
}

const fractionalCost = summarizeUnchanged([
  queue(), receipt({ receivedQty: 1 }),
  craft({ paidCost: 20.2, beforeCredits: 100.1, afterCredits: 79.9 }),
]);
assert.equal(fractionalCost.associations[0]?.craftCost, 20.2,
  'Small floating-point currency representation error is tolerated.');

for (const missingCraftField of ['actionKey', 'itemId', 'qty']) {
  const malformed = craft({
    ...(missingCraftField === 'actionKey' ? { actionKey: '' } : {}),
    ...(missingCraftField === 'itemId' ? { itemId: '' } : {}),
    ...(missingCraftField === 'qty' ? { qty: 0 } : {}),
  });
  const result = summarizeUnchanged([
    queue(), receipt({ receivedQty: 1 }), malformed,
    craft({ actionKey: `later-${missingCraftField}` }),
  ]);
  assert.deepEqual(result.associations, [], `Missing craft ${missingCraftField} must not link or restore consumed quantity.`);
}

assert.throws(() => summarizeUnchanged([
  queue(), receipt({ receivedQty: 2 }),
  craft({ actionKey: 'same-craft' }), craft({ actionKey: 'same-craft' }),
]), /Duplicate craft action/);

for (const invalidConsumption of [
  [{ itemId: 'wood', qty: 1 }, { itemId: 'fiber', qty: 0 }],
  [{ itemId: 'wood', qty: Number.MAX_SAFE_INTEGER }, { itemId: 'wood', qty: 1 }],
]) {
  const malformed = craft({ actionKey: 'malformed-consumption', consumed: invalidConsumption });
  const result = summarizeUnchanged([
    queue(), receipt({ receivedQty: 2 }), malformed,
    craft({ actionKey: 'later-paid' }),
  ]);
  assert.deepEqual(result.associations, [],
    'Invalid or overflowing consumption is all-or-nothing and cannot produce partial evidence or restore lots.');
}

const perEventEquip = summarizeUnchanged([
  queue(), receipt({ receivedQty: 2 }),
  craft({ actionKey: 'craft:first', itemId: 'same-gear' }),
  craft({ actionKey: 'craft:second', itemId: 'same-gear' }),
], { equippedCraftEventIndexes: new Set([3]) });
assert.deepEqual(perEventEquip.associations.map(row => row.equippedObserved), [false, true],
  'Equip observation is keyed to craft event indexes, not actor/item identity.');

console.log('PASS natural procurement evidence pure unit checks');
