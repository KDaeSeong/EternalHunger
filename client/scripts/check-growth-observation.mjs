import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { runProcurementAction } = await import('../src/app/simulation/_lib/phaseProcurementActionRuntime.js');
const { emitQueueRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const material = (id, name = id) => ({ _id: id, name, type: 'material', category: 'material', tier: 1, spawnZones: ['a'] });
const gear = (id, ingredients, slot = 'head') => ({ _id: id, name: id, type: 'equipment', category: 'equipment', equipSlot: slot, tier: 4,
  recipe: { ingredients: ingredients.map((itemId) => ({ itemId, qty: 1 })) } });
const items = [material('cloth', '천'), material('stone', '돌'), gear('first', ['cloth']), gear('chosen', ['stone'], 'shoes')];
const held = (item, qty = 1) => ({ ...item, itemId: item._id, qty });
const actor = (extra = {}) => ({ _id: 'a', name: '관전자', hp: 100, maxHp: 100, teamId: 'team:1', zoneId: 'a',
  inventory: [], simCredits: 100, _actionCycleKey: '0:20', routePlanTargetItemIds: ['first', 'chosen'], _growthFocusId: 'chosen', ...extra });
const world = { mapObj: { zones: [{ zoneId: 'a' }] }, zoneGraph: { a: [] }, forbiddenIds: new Set() };
const prepare = (extra) => { const subject = actor(extra); refreshActorGrowthPlan(subject, items, world); return subject; };
const model = (subject, events = [], extra = {}) => buildTeamObserverModel({ survivors: [subject], events, publicItems: items, matchSec: 30, ...extra });
const ruleset = { inventory: { maxSlots: 10, stackMax: { material: 3 }, autoDropLowValue: false } };
const offer = (extra = {}) => ({ kind: 'buy', item: items[0], itemId: 'cloth', qty: 1, cost: 10, ...extra });
function transact(subject, selected = offer(), actionType = 'kioskBuy', extra = {}) {
  const events = [];
  const execute = () => runProcurementAction({ state: { actor: subject, ruleset, nextDay: 1, nextPhase: 'morning', phaseIdxNow: 0,
    queuedActionType: actionType, queuedKioskAction: selected, queuedDroneOrder: selected, publicItems: items, craftables: [],
    itemNameById: Object.fromEntries(items.map((item) => [item._id, item.name])), itemMetaById: {}, ...extra },
  actions: { atNow: () => ({ sec: 20 }), emitRunEvent: (kind, data, at) => events.push({ ...data, kind, at }) } });
  const result = execute();
  return { result, events, execute };
}
const choice = (extra = {}) => ({ kind: 'queue', who: 'a', chosen: 'kioskBuy', itemId: 'cloth', itemName: '천',
  actionKey: 'phase:0:cycle:0:20', at: { sec: 20 }, ...extra });

check('the visible growth target is the actual chosen branch, not the first missing slot', () => {
  const subject = prepare();
  assert.equal(model(subject).members[0].growth?.targetId, 'chosen');
  assert.match(model(subject).members[0].growth.materials, /돌 1개/);
});

check('current inventory removes fulfilled goals and material needs before the next planning tick', () => {
  const subject = prepare();
  subject.inventory = [held(items[1])];
  const ready = model(subject).members[0].growth;
  assert.equal(ready.materials, '필요한 재료 확보 · 제작 가능');
  subject.inventory = [held(items[3])];
  assert.equal(model(subject).members[0].growth.status, 'replanning');
  assert.equal(model(subject).members[0].growth.targetId, '');
  subject.inventory.push(held(items[2]));
  assert.equal(model(subject).members[0].growth.status, 'complete');
});

check('no planner or dead/ended participant is presented as an active growth decision', () => {
  assert.equal(model(actor()).members[0].growth.status, 'unplanned');
  assert.equal(model(prepare({ hp: 0 })).members[0].growth, null);
  assert.equal(model(prepare(), [], { isGameOver: true }).members[0].growth, null);
});

check('forbidden or exhausted recorded destinations do not remain active material routes', () => {
  const subject = prepare();
  const forbidden = model(subject, [], { forbiddenIds: ['a'] }).members[0].growth;
  assert.equal(forbidden.destination, ''); assert.match(forbidden.note, /금지구역/);
  const exhausted = model(subject, [], { spawnState: { fieldResources: { byZone: { a: { stone: { remaining: 0 } } } } } }).members[0].growth;
  assert.equal(exhausted.destination, ''); assert.match(exhausted.note, /소진/);
});

check('observation is read only and survives frame serialization', () => {
  const subject = prepare(); const before = JSON.stringify(subject);
  const originalRandom = Math.random; Math.random = () => { throw new Error('observer must not use RNG'); };
  try { assert.deepEqual(model(subject), model(JSON.parse(before))); } finally { Math.random = originalRandom; }
  assert.equal(JSON.stringify(subject), before);
});

check('a completed intermediate replaces raw ingredients in the displayed recipe work', () => {
  const nested = [...items, gear('final', ['first', 'stone'], 'chest')];
  const subject = actor({ routePlanTargetItemIds: ['final'], _growthFocusId: 'final' });
  refreshActorGrowthPlan(subject, nested, world); subject.inventory = [held(items[2])];
  const growth = model(subject, [], { publicItems: nested }).members[0].growth;
  assert.match(growth.materials, /돌 1개/); assert.doesNotMatch(growth.materials, /천/);
});

check('invalid recipes and missing field supplies remain explicit, not imaginary destinations', () => {
  const invalid = [...items, gear('broken', ['unknown'])];
  const subject = actor({ routePlanTargetItemIds: ['broken'], _growthFocusId: 'broken' });
  refreshActorGrowthPlan(subject, invalid, world);
  assert.match(model(subject, [], { publicItems: invalid }).members[0].growth.materials, /제작법/);
  const blocked = prepare(); blocked._growthPlan.blocked = 'no_material_source'; blocked._growthPlan.targetZoneId = '';
  assert.match(model(blocked).members[0].growth.note, /공급처 없음/);
});

check('a successful purchase preserves the actual quantity, charge and matched selection', () => {
  const subject = actor(); const flow = transact(subject, offer({ qty: 2, cost: 15 }));
  const receipt = flow.events.find((event) => event.kind === 'procurement');
  assert.equal(receipt?.outcome, 'completed'); assert.equal(receipt.receivedQty, 2);
  assert.equal(receipt.paidCost, 15); assert.equal(receipt.beforeCredits, 100); assert.equal(receipt.afterCredits, 85);
  const card = model(subject, [choice(), ...flow.events]).members[0].procurement;
  assert.equal(card.matchedChoice, true); assert.match(card.result, /천 2개.*구매 완료.*15Cr.*100→85Cr/);
  assert.ok(model(subject, flow.events).recent.some((row) => /구매 완료/.test(row.text)));
});

check('cancelled orders have a reason but no charge, item gain or actor mutation', () => {
  for (const [subject, selected, reason] of [[actor({ simCredits: 0 }), offer(), 'insufficient_credits'],
    [actor({ inventory: [held(items[0], 3)] }), offer(), 'cannot_receive_full_order']]) {
    const before = structuredClone(subject); const flow = transact(subject, selected);
    assert.deepEqual(subject, before); assert.equal(flow.result.didProcure, false);
    assert.equal(flow.events.length, 1); assert.equal(flow.events[0].reason, reason);
    assert.equal(flow.events[0].outcome, 'cancelled'); assert.equal(flow.events[0].receivedQty, 0);
    assert.match(model(subject, [choice(), ...flow.events]).members[0].procurement.result, /거래 취소.*변경 없음/);
  }
});

check('the same item in another action, future receipts or another actor are not joined to this order', () => {
  const subject = actor(); const receipt = transact(subject).events[0];
  const unmatched = model(subject, [choice({ actionKey: 'older' }), receipt]).members[0].procurement;
  assert.equal(unmatched.matchedChoice, false);
  const pending = model(subject, [choice(), { ...receipt, at: { sec: 31 } }, { ...receipt, who: 'b' }]).members[0].procurement;
  assert.equal(pending.outcome, 'unconfirmed'); assert.match(pending.result, /정산 결과 기록 없음/);
  assert.doesNotMatch(pending.result, /완료/);
});

check('a successful retry cannot publish a second completion receipt', () => {
  const flow = transact(actor());
  flow.execute(); assert.equal(flow.events.filter((event) => event.kind === 'procurement').length, 1);
});

check('contradictory or malformed receipts cannot be presented as successful purchases', () => {
  const receipt = transact(actor()).events[0];
  for (const extra of [{ paidCost: 99 }, { receivedQty: 2 }, { receiptVersion: 9 }, { qty: -1 }, { afterCredits: NaN }]) {
    assert.equal(describeObserverEvent({ ...receipt, ...extra }), '');
  }
});

check('exchange and sale report real consumed items and credits, not a bought credit item', () => {
  const subject = actor({ inventory: [held(items[1])] });
  const exchanged = transact(subject, offer({ kind: 'exchange', consume: [{ itemId: 'stone', qty: 1 }] }), 'kioskExchange').events[0];
  assert.match(describeObserverEvent(exchanged), /돌 1개.*천 1개.*교환 완료/);
  subject._actionCycleKey = '0:40';
  const sold = transact(subject, offer({ kind: 'sell', credits: 7 }), 'kioskSell').events[0];
  assert.match(describeObserverEvent(sold), /천 1개.*판매 완료.*7Cr/);
  assert.equal(sold.itemId, 'cloth'); assert.equal(sold.receivedQty, 0);
});

check('drone delivery is actual receipt, and later inventory consumption does not rewrite its history', () => {
  const subject = actor(); const receipt = transact(subject, offer({ kind: 'drone' }), 'droneOrder').events[0];
  subject.inventory = [];
  assert.match(model(subject, [receipt]).members[0].procurement.result, /드론.*천 1개.*수령 완료/);
});

check('queue serialization preserves the exact action identity without inventing an order result', () => {
  const events = []; emitQueueRunEvent((kind, payload, at) => events.push({ ...payload, kind, at }), actor(), choice());
  assert.equal(events[0].actionKey, choice().actionKey);
  assert.equal(events[0].outcome, undefined);
});

check('account compaction preserves a bounded receipt and rejects invalid consumption entries', () => {
  const source = readFileSync(new URL('../../server/routes/game.js', import.meta.url), 'utf8');
  const compactSource = source.slice(source.indexOf('function compactRunEventsForStorage('), source.indexOf('function buildRunSummary('));
  const compact = runInNewContext(`${compactSource}; compactRunEventsForStorage`);
  const receipt = transact(actor()).events[0];
  receipt.consumed = [{ itemId: 'stone', itemName: '돌', qty: 1, secret: 'omit' }, { itemId: 'bad', qty: Infinity }];
  const restored = JSON.parse(JSON.stringify(compact([choice(), receipt])));
  assert.equal(restored[0].actionKey, choice().actionKey);
  assert.equal(restored[1].receiptVersion, 1); assert.equal(restored[1].receivedQty, 1);
  assert.deepEqual(restored[1].consumed, [{ itemId: 'stone', itemName: '돌', qty: 1 }]);
  assert.match(describeObserverEvent(restored[1]), /구매 완료/);
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  const clientCompactSource = finish.slice(finish.indexOf('const compactRunEvents ='), finish.indexOf("await apiPost('/game/end'"));
  const submitted = runInNewContext(`${clientCompactSource}; compactRunEvents`, { runEvents: [choice(), receipt] });
  const roundTrip = JSON.parse(JSON.stringify(compact(submitted)));
  assert.equal(roundTrip[0].actionKey, choice().actionKey);
  assert.equal(roundTrip[1].itemName, '천');
  assert.equal(describeObserverEvent(roundTrip[1]), describeObserverEvent(restored[1]));
});

console.log(`GROWTH_OBSERVATION_CHECKS ${checks}/${checks}`);
