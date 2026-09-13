import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { commitProcurementTransaction: commit } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const { runProcurementAction } = await import('../src/app/simulation/_lib/phaseProcurementActionRuntime.js');
const { addItemToInventory, consumeIngredientsFromInv } = await import('../src/app/simulation/_lib/inventoryRules.js');

let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}

const cloth = { _id: 'cloth', name: '천', type: 'material', tier: 1 };
const stone = { _id: 'stone', name: '돌', type: 'material', tier: 1 };
const ruleset = { inventory: { maxSlots: 10, stackMax: { material: 3, equipment: 1 }, autoDropLowValue: false } };
const held = (item, qty = 1) => ({ itemId: item._id, name: item.name, type: item.type, tier: item.tier, qty,
  ...(item.equipSlot ? { equipSlot: item.equipSlot, category: 'equipment' } : {}) });
const actor = (extra = {}) => ({ _id: 'a', name: '거래자', hp: 100, maxHp: 100, simCredits: 100,
  inventory: [], zoneId: 'dock', _actionCycleKey: '0:20', ...extra });
const buy = (extra = {}) => ({ kind: 'buy', item: cloth, itemId: cloth._id, qty: 1, cost: 10, ...extra });
const exchange = (extra = {}) => buy({ kind: 'exchange', consume: [{ itemId: stone._id, qty: 1 }], ...extra });
const sell = (extra = {}) => buy({ kind: 'sell', credits: 7, ...extra });
const transact = (subject, offer = buy(), actionType = 'kioskBuy', options = {}) =>
  commit({ actor: subject, offer, actionType, ruleset, ...options });
const count = (subject, id) => subject.inventory.filter((entry) => entry.itemId === id).reduce((sum, entry) => sum + entry.qty, 0);

function rejectedUnchanged(subject, offer, actionType, reason, options = {}) {
  const before = structuredClone(subject);
  const originalInventory = subject.inventory;
  const result = transact(subject, offer, actionType, options);
  assert.deepEqual(result, { ok: false, reason });
  assert.deepEqual(subject, before);
  assert.equal(subject.inventory, originalInventory);
}

function pipeline(subject, offer = buy(), actionType = 'kioskBuy', options = {}) {
  const events = [];
  const logs = [];
  const crafts = [];
  const run = () => runProcurementAction({ state: {
    actor: subject, ruleset, nextDay: 1, nextPhase: 'morning', phaseIdxNow: 0,
    queuedActionType: actionType, queuedKioskAction: offer, queuedDroneOrder: offer,
    publicItems: [cloth, stone], craftables: [], itemNameById: { cloth: '천', stone: '돌' }, itemMetaById: {}, ...options,
  }, actions: {
    atNow: () => 20,
    addLog: (...args) => logs.push(args),
    emitItemGainIfAny: (qty, payload, at) => events.push({ type: 'gain', qty, ...payload, at }),
    emitRunEvent: (type, payload, at) => events.push({ type, ...payload, at }),
    applyLootCraftResult: (...args) => crafts.push(args),
  } });
  return { run, events, logs, crafts };
}

check('buy commits the full quantity and quoted total price', () => {
  const subject = actor();
  const result = transact(subject, buy({ qty: 2, cost: 15 }));
  assert.equal(result.ok, true);
  assert.equal(count(subject, 'cloth'), 2);
  assert.equal(subject.simCredits, 85);
  assert.equal(result.receivedQty, 2);
  assert.equal(result.paidCost, 15);
});

check('exchange aggregates duplicate requirements and consumes across stacks', () => {
  const subject = actor({ inventory: [held(stone, 1), held(stone, 2)] });
  const result = transact(subject, exchange({ consume: [{ itemId: 'stone', qty: 1 }, { itemId: 'stone', qty: 2 }] }), 'kioskExchange');
  assert.equal(result.ok, true);
  assert.deepEqual(result.consumed, [{ itemId: 'stone', qty: 3 }]);
  assert.equal(count(subject, 'stone'), 0);
  assert.equal(count(subject, 'cloth'), 1);
  assert.equal(subject.simCredits, 100);
});

check('sale consumes the exact quantity before granting the quoted credits', () => {
  const subject = actor({ inventory: [held(cloth, 3)] });
  const result = transact(subject, sell({ qty: 2, credits: 9 }), 'kioskSell');
  assert.equal(result.ok, true);
  assert.equal(count(subject, 'cloth'), 1);
  assert.equal(subject.simCredits, 109);
  assert.equal(result.receivedQty, 0);
});

check('drone accepts its actual offer kind and preserves quoted discounts', () => {
  for (const kind of ['drone', undefined]) {
    const subject = actor();
    assert.equal(transact(subject, buy({ kind, cost: 2.5 }), 'droneOrder').ok, true);
    assert.equal(subject.simCredits, 97.5);
    assert.equal(count(subject, 'cloth'), 1);
  }
});

check('insufficient current credits reject both kiosk and drone orders', () => {
  for (const [actionType, kind] of [['kioskBuy', 'buy'], ['droneOrder', 'drone']]) {
    rejectedUnchanged(actor({ simCredits: 0 }), buy({ kind }), actionType, 'insufficient_credits');
  }
});

check('duplicated ingredient rows cannot share the same single item', () => {
  rejectedUnchanged(actor({ inventory: [held(stone)] }), exchange({
    consume: [{ itemId: 'stone', qty: 1 }, { itemId: 'stone', qty: 1 }],
  }), 'kioskExchange', 'insufficient_items');
  rejectedUnchanged(actor({ inventory: [held(stone, 2)] }), exchange({
    consume: [{ itemId: 'stone', qty: 1 }, { itemId: 'cloth', qty: 1 }],
  }), 'kioskExchange', 'insufficient_items');
});

check('an item removed after planning cannot be exchanged or sold', () => {
  for (const [actionType, offer, material] of [['kioskExchange', exchange(), stone], ['kioskSell', sell(), cloth]]) {
    const subject = actor({ inventory: [held(material)] });
    subject.inventory = consumeIngredientsFromInv(subject.inventory, [{ itemId: material._id, qty: 1 }]);
    rejectedUnchanged(subject, offer, actionType, 'insufficient_items');
  }
});

check('partial stack reception rolls back purchase and drone charges', () => {
  for (const [actionType, kind] of [['kioskBuy', 'buy'], ['droneOrder', 'drone']]) {
    rejectedUnchanged(actor({ inventory: [held(cloth, 2)] }), buy({ kind, qty: 2 }), actionType, 'cannot_receive_full_order');
  }
});

check('exchange capacity failure preserves every ingredient and held item', () => {
  rejectedUnchanged(actor({ inventory: [held(stone, 2)] }), exchange(), 'kioskExchange', 'cannot_receive_full_order', {
    ruleset: { inventory: { ...ruleset.inventory, maxSlots: 1 } },
  });
});

check('consuming the final ingredient stack frees a slot for exchange', () => {
  const subject = actor({ inventory: [held(stone)] });
  assert.equal(transact(subject, exchange(), 'kioskExchange', {
    ruleset: { inventory: { ...ruleset.inventory, maxSlots: 1 } },
  }).ok, true);
  assert.equal(subject.inventory.length, 1);
  assert.equal(count(subject, 'cloth'), 1);
});

check('failed bulk equipment order does not discard equipped old gear', () => {
  const old = { _id: 'old', name: '낡은 신발', type: 'equipment', equipSlot: 'shoes', tier: 1 };
  const next = { ...old, _id: 'next', name: '새 신발', tier: 2 };
  const subject = actor({ inventory: [held(old)], equipped: { shoes: old._id } });
  const candidate = addItemToInventory(subject.inventory, next, next._id, 2, 1, ruleset);
  assert.equal(candidate._lastAdd.reason, 'equip_replaced');
  assert.equal(candidate._lastAdd.acceptedQty, 1);
  rejectedUnchanged(subject, buy({ item: next, itemId: next._id, qty: 2 }), 'kioskBuy', 'cannot_receive_full_order');
});

check('failed bulk order also rolls back proposed automatic bag drops', () => {
  const item = { _id: 'boots', name: '새 신발', type: 'equipment', equipSlot: 'shoes', tier: 4 };
  const limitedRules = { inventory: { maxSlots: 1, autoDropLowValue: true, autoDropMinIncomingScore: 0, autoDropScoreMargin: 0 } };
  const subject = actor({ inventory: [held(stone)] });
  const candidate = addItemToInventory(subject.inventory, item, item._id, 2, 1, limitedRules);
  assert.equal(candidate._lastAdd.reason, 'auto_dropped');
  rejectedUnchanged(subject, buy({ item, itemId: item._id, qty: 2 }), 'kioskBuy', 'cannot_receive_full_order', { ruleset: limitedRules });
});

check('successful preparation never mutates the old inventory or offer', () => {
  const entry = Object.freeze(held(cloth));
  const previous = Object.freeze([entry]);
  const offer = Object.freeze(buy());
  const subject = actor({ inventory: previous });
  assert.equal(transact(subject, offer).ok, true);
  assert.equal(entry.qty, 1);
  assert.equal(previous.length, 1);
  assert.equal(count(subject, 'cloth'), 2);
});

check('invalid order quantities are not rounded or defaulted into free goods', () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity, null, true, '', Number.MAX_SAFE_INTEGER + 1]) {
    rejectedUnchanged(actor(), buy({ qty }), 'kioskBuy', 'invalid_quantity');
  }
});

check('invalid prices and balances cannot generate credits or free goods', () => {
  for (const bad of [-1, Infinity, NaN, null, true, '']) {
    rejectedUnchanged(actor(), buy({ cost: bad }), 'kioskBuy', 'invalid_credits');
    rejectedUnchanged(actor({ simCredits: bad }), buy(), 'kioskBuy', 'invalid_credits');
    rejectedUnchanged(actor({ inventory: [held(cloth)] }), sell({ credits: bad }), 'kioskSell', 'invalid_credits');
  }
  rejectedUnchanged(actor({ simCredits: Number.MAX_VALUE, inventory: [held(cloth)] }), sell({ credits: Number.MAX_VALUE }), 'kioskSell', 'invalid_credits');
});

check('zero quoted price is valid but a missing price is not', () => {
  const subject = actor({ simCredits: 0 });
  assert.equal(transact(subject, buy({ cost: 0 })).ok, true);
  assert.equal(subject.simCredits, 0);
  rejectedUnchanged(actor(), buy({ cost: undefined }), 'kioskBuy', 'invalid_credits');
});

check('mismatched action kind or catalog identity is rejected', () => {
  rejectedUnchanged(actor(), sell(), 'kioskBuy', 'invalid_offer');
  rejectedUnchanged(actor(), buy({ item: null }), 'kioskBuy', 'invalid_item');
  rejectedUnchanged(actor(), buy({ item: 'cloth' }), 'kioskBuy', 'invalid_item');
  rejectedUnchanged(actor(), buy({ item: stone }), 'kioskBuy', 'invalid_item');
  rejectedUnchanged(actor(), buy(), 'notAnAction', 'invalid_action');
});

check('malformed exchange requirements reject without partial consumption', () => {
  for (const consume of [[], null, [{ itemId: '', qty: 1 }], [{ itemId: 'stone', qty: 0 }],
    [{ itemId: 'stone', qty: 0.5 }], [{ itemId: 'stone', qty: Infinity }],
    [{ itemId: 'stone', qty: Number.MAX_SAFE_INTEGER }, { itemId: 'stone', qty: 1 }]]) {
    rejectedUnchanged(actor({ inventory: [held(stone)] }), exchange({ consume }), 'kioskExchange', 'invalid_ingredients');
  }
});

check('malformed inventory is not silently converted into spendable stock', () => {
  for (const inventory of [null, {}, [{ itemId: 'stone', qty: 0 }], [{ itemId: 'stone', qty: 0.5 }],
    [{ itemId: 'stone', qty: NaN }], [{ itemId: '', qty: 1 }]]) {
    rejectedUnchanged(actor({ inventory }), exchange(), 'kioskExchange', 'invalid_inventory');
  }
});

check('dead or invalid actors cannot transact', () => {
  for (const hp of [0, -1, NaN, Infinity, undefined]) {
    rejectedUnchanged(actor({ hp }), buy(), 'kioskBuy', 'actor_inactive');
  }
});

check('legacy inventory IDs and omitted quantities remain supported', () => {
  const subject = actor({ inventory: [{ id: 'stone', name: '돌' }] });
  assert.equal(transact(subject, exchange({ qty: undefined }), 'kioskExchange').ok, true);
  assert.equal(count(subject, 'stone'), 0);
  assert.equal(count(subject, 'cloth'), 1);
});

check('successful retry is blocked after JSON restoration, even with another offer', () => {
  const subject = actor();
  assert.equal(transact(subject).ok, true);
  const restored = JSON.parse(JSON.stringify(subject));
  rejectedUnchanged(restored, buy(), 'kioskBuy', 'already_committed');
  rejectedUnchanged(restored, buy({ item: stone, itemId: stone._id }), 'kioskBuy', 'already_committed');
});

check('next scheduled action or next legacy phase can transact normally', () => {
  const subject = actor();
  assert.equal(transact(subject).ok, true);
  subject._actionCycleKey = '0:40';
  assert.equal(transact(subject).ok, true);
  const legacy = actor({ _actionCycleKey: undefined });
  assert.equal(transact(legacy).ok, true);
  rejectedUnchanged(legacy, buy(), 'kioskBuy', 'already_committed');
  assert.equal(transact(legacy, buy(), 'kioskBuy', { phaseIdxNow: 1 }).ok, true);
});

check('failure does not reserve a success key and JSON replay is deterministic', () => {
  const subject = actor({ simCredits: 0 });
  rejectedUnchanged(subject, buy(), 'kioskBuy', 'insufficient_credits');
  subject.simCredits = 10;
  const restored = JSON.parse(JSON.stringify(subject));
  assert.deepEqual(transact(subject), transact(restored));
  assert.deepEqual(subject, restored);
});

check('real action handler rejects shortages without gain, craft or actor edits', () => {
  for (const [actionType, offer] of [['kioskBuy', buy()], ['kioskExchange', exchange()], ['kioskSell', sell()], ['droneOrder', buy({ kind: 'drone' })]]) {
    const subject = actor({ simCredits: 0 });
    const before = structuredClone(subject);
    const flow = pipeline(subject, offer, actionType);
    assert.equal(flow.run().didProcure, false);
    assert.deepEqual(subject, before);
    assert.equal(flow.events.length, 0);
    assert.equal(flow.crafts.length, 0);
    assert.equal(flow.logs.length, 1);
  }
});

check('real buy and drone handlers emit one receipt and never double-charge', () => {
  for (const [actionType, kind] of [['kioskBuy', 'buy'], ['droneOrder', 'drone']]) {
    const subject = actor({ simCredits: 10 });
    const flow = pipeline(subject, buy({ kind }), actionType);
    assert.equal(flow.run().didProcure, true);
    assert.equal(flow.events.length, 1);
    assert.equal(flow.events[0].paidCost, 10);
    assert.equal(flow.events[0].afterCredits, 0);
    assert.equal(subject.simCredits, 0);
    const beforeRetry = structuredClone(subject);
    const logCount = flow.logs.length;
    const craftCount = flow.crafts.length;
    assert.equal(flow.run().reason, 'already_committed');
    assert.deepEqual(subject, beforeRetry);
    assert.equal(flow.events.length, 1);
    assert.equal(flow.logs.length, logCount);
    assert.equal(flow.crafts.length, craftCount);
  }
});

check('real sale handler clears sold equipment and records actual consumption', () => {
  const boots = { _id: 'boots', name: '신발', type: 'equipment', equipSlot: 'shoes', tier: 1 };
  const subject = actor({ inventory: [held(boots)], equipped: { shoes: boots._id } });
  const flow = pipeline(subject, sell({ item: boots, itemId: boots._id }), 'kioskSell');
  assert.equal(flow.run().didProcure, true);
  assert.equal(subject.equipped.shoes, null);
  assert.equal(subject.simCredits, 107);
  assert.deepEqual(flow.events[0].consumed, [{ itemId: boots._id, qty: 1 }]);
  assert.equal(flow.events[0].itemId, 'CREDITS');
});

check('real module buy and exchange upgrade only after successful payment, once', () => {
  const module = { _id: 'module', name: '전술 강화 모듈', tags: ['tac_skill_module'], tier: 4 };
  for (const actionType of ['kioskBuy', 'kioskExchange']) {
    const subject = actor({ inventory: [held(stone)], tacticalSkillLevel: 1 });
    const offer = (actionType === 'kioskBuy' ? buy : exchange)({ item: module, itemId: module._id });
    const poor = actor({ simCredits: 0, tacticalSkillLevel: 1 });
    const failedFlow = pipeline(poor, offer, actionType);
    assert.equal(failedFlow.run().didProcure, false);
    assert.equal(poor.tacticalSkillLevel, 1);
    assert.equal(failedFlow.events.length, 0);
    assert.equal(failedFlow.crafts.length, 0);
    const flow = pipeline(subject, offer, actionType);
    assert.equal(flow.run().didProcure, true);
    assert.equal(subject.tacticalSkillLevel, 2);
    assert.equal(count(subject, module._id), 0);
    const before = structuredClone(subject);
    assert.equal(flow.run().reason, 'already_committed');
    assert.deepEqual(subject, before);
    assert.equal(flow.events.length, 1);
  }
});

check('unrelated queued action is untouched and not reported as procurement', () => {
  const subject = actor();
  const before = structuredClone(subject);
  const flow = pipeline(subject, buy(), 'routeFarm');
  assert.equal(flow.run().ran, false);
  assert.deepEqual(subject, before);
  assert.equal(flow.events.length, 0);
  assert.equal(flow.logs.length, 0);
});

console.log(`Procurement transactions: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
