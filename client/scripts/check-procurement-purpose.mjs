import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './lib/register-simulation-modules.mjs';

const { buildProcurementPurpose, describeProcurementPurpose, isProcurementAction } =
  await import('../src/app/simulation/_lib/procurementPurposeRuntime.js');
const { emitQueueRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { updateProcurementObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { describeObserverEvent, describeObserverReason } =
  await import('../src/app/simulation/_lib/teamObserverRuntime.js');

let checks = 0;
const check = (name, run) => {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
};

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

const teamReason = '팀 제작 구매: 운석 · 미르의 개밥바라기 제작 재료';
const personalPurpose = buildProcurementPurpose({ actorId: 'eunha', actionKey: 'k1',
  actionType: 'kioskBuy', itemId: 'life-tree', itemName: '생명의 나무', targetId: 'eunha-gear',
  targetName: '은하의 기어', recipeMissingIds: ['life-tree'], routeNeedIds: ['cloth'] });

check('personal purpose is classified by exact IDs, not stale or colliding display names', () => {
  assert.deepEqual(personalPurpose, { version: 1, actorId: 'eunha', actionKey: 'k1',
    actionType: 'kioskBuy', itemId: 'life-tree', itemName: '생명의 나무', kind: 'recipe_material',
    targetId: 'eunha-gear', targetName: '은하의 기어' });
  const sameNameDifferentId = buildProcurementPurpose({ actorId: 'eunha', actionKey: 'k1', actionType: 'kioskBuy',
    itemId: 'life-tree', itemName: '생명의 나무', targetId: 'other-gear', targetName: '은하의 기어',
    recipeMissingIds: ['another-material'] });
  assert.equal(sameNameDifferentId.kind, 'personal_order');
  assert.equal(sameNameDifferentId.targetId, '');
  const sameIdStaleName = buildProcurementPurpose({ actorId: 'eunha', actionKey: 'k2', actionType: 'kioskBuy',
    itemId: 'eunha-gear', itemName: '오래된 표시명', targetId: 'eunha-gear', targetName: '이전 목표 이름',
    recipeMissingIds: [] });
  assert.equal(sameIdStaleName.kind, 'target_item');
  assert.equal(sameIdStaleName.targetId, 'eunha-gear');
  const targetText = describeProcurementPurpose({ kind: 'queue', who: 'eunha', actionKey: 'k2',
    chosen: 'kioskBuy', itemId: 'eunha-gear', procurementPurpose: sameIdStaleName });
  assert.match(targetText, /현재 목표 장비 이전 목표 이름과 같은 품목 선택/);
  assert.doesNotMatch(targetText, /미확보|확보를 위한|구매 완료|제작 완료/);
});

check('route, general-order and sale purposes remain distinct', () => {
  const route = buildProcurementPurpose({ actorId: 'a', actionKey: 'k1', actionType: 'droneOrder', itemId: 'cloth',
    itemName: '천', targetId: 'stale-target', targetName: '오래된 목표', recipeMissingIds: ['other'], routeNeedIds: ['cloth'] });
  assert.equal(route.kind, 'route_material');
  assert.equal(route.targetId, '');
  assert.match(describeProcurementPurpose({ kind: 'queue', who: 'a', actionKey: 'k1', chosen: 'droneOrder',
    itemId: 'cloth', itemName: '천', procurementPurpose: route }), /파밍 경로/);
  const personal = buildProcurementPurpose({ actorId: 'a', actionKey: 'k2', actionType: 'kioskExchange', itemId: 'herb',
    itemName: '약초', targetId: 'goal', targetName: '목표', recipeMissingIds: ['cloth'], routeNeedIds: [] });
  assert.equal(personal.kind, 'personal_order');
  assert.match(describeProcurementPurpose({ kind: 'queue', who: 'a', actionKey: 'k2', chosen: 'kioskExchange',
    itemId: 'herb', itemName: '약초', procurementPurpose: personal }), /개인 조달 품목 약초/);
  const sale = buildProcurementPurpose({ actorId: 'a', actionKey: 's1', actionType: 'kioskSell', itemId: 'old-item',
    itemName: '낡은 장비', targetId: 'old-item', targetName: '낡은 장비', recipeMissingIds: ['old-item'] });
  assert.equal(sale.kind, 'sale');
  assert.equal(sale.targetId, '');
  assert.match(describeProcurementPurpose({ kind: 'queue', who: 'a', actionKey: 's1', chosen: 'kioskSell',
    itemId: 'old-item', itemName: '낡은 장비', procurementPurpose: sale }), /크레딧 확보/);
  for (const action of ['kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder']) assert.equal(isProcurementAction(action), true);
  for (const action of ['craft', 'moveTo', '', null]) assert.equal(isProcurementAction(action), false);
});

check('builder inputs are immutable and missing action identity cannot produce a purpose', () => {
  const input = freezeDeep({ actorId: 'a', actionKey: 'k1', actionType: 'kioskBuy', itemId: 'wood', itemName: '나무',
    targetId: 'gear', targetName: '장비', recipeMissingIds: ['wood'], routeNeedIds: ['wood', 'cloth'] });
  const before = structuredClone(input);
  const purpose = buildProcurementPurpose(input);
  assert.deepEqual(input, before);
  assert.equal(purpose.kind, 'recipe_material');
  assert.equal(buildProcurementPurpose({ ...input, actorId: '' }), null);
  assert.equal(buildProcurementPurpose({ ...input, actionKey: '' }), null);
  assert.equal(buildProcurementPurpose({ ...input, itemId: '' }), null);
  assert.equal(buildProcurementPurpose({ ...input, actionType: 'craft' }), null);
});

check('queue description rejects every identity mismatch and corrupt purpose schema', () => {
  const event = { kind: 'queue', who: 'eunha', actionKey: 'k1', chosen: 'kioskBuy', itemId: 'life-tree',
    itemName: '생명의 나무', procurementPurpose: personalPurpose };
  assert.match(describeProcurementPurpose(event), /은하의 기어의 부족 재료 생명의 나무/);
  for (const changed of [
    { who: 'other' }, { actionKey: 'other-key' }, { chosen: 'kioskExchange' }, { itemId: 'meteor' },
    { kind: 'procurement' },
  ]) assert.equal(describeProcurementPurpose({ ...event, ...changed }), '');
  assert.equal(describeProcurementPurpose({ ...event,
    procurementPurpose: { ...personalPurpose, version: 2 } }), '');
  assert.equal(describeProcurementPurpose({ ...event,
    procurementPurpose: { ...personalPurpose, kind: 'team_recipe' } }), '');
  assert.equal(describeProcurementPurpose({ ...event,
    procurementPurpose: { ...personalPurpose, actionType: 'kioskExchange' } }), '');
  assert.equal(describeProcurementPurpose({ ...event,
    procurementPurpose: { ...personalPurpose, kind: 'sale' } }), '');
  assert.equal(describeProcurementPurpose({ ...event,
    procurementPurpose: { ...personalPurpose, kind: 'recipe_material', targetId: '' } }), '');
});

check('queue event emitter deep-copies purpose and preserves separate shared movement metadata', () => {
  const emitted = [];
  const actor = freezeDeep({ _id: 'eunha', name: '은하', zoneId: 'shop' });
  const payload = freezeDeep({ chosen: 'kioskBuy', itemId: 'life-tree', itemName: '생명의 나무', actionKey: 'k1',
    procurementPurpose: personalPurpose, sharedGoalReason: teamReason });
  const before = structuredClone(payload);
  emitQueueRunEvent((kind, row) => emitted.push({ kind, row }), actor, payload, { sec: 296 });
  assert.deepEqual(payload, before);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].kind, 'queue');
  assert.deepEqual(emitted[0].row.procurementPurpose, personalPurpose);
  assert.notEqual(emitted[0].row.procurementPurpose, personalPurpose);
  assert.equal(emitted[0].row.sharedGoalReason, teamReason);
});

check('personal queue purpose takes precedence over another member shared recipe label', () => {
  const queue = { kind: 'queue', who: 'eunha', actionKey: 'k1', chosen: 'kioskBuy', itemId: 'life-tree',
    itemName: '생명의 나무', reason: 'team_rotate', sharedGoalReason: teamReason, procurementPurpose: personalPurpose };
  const reason = describeObserverReason(queue);
  assert.match(reason, /은하의 기어/);
  assert.match(reason, /생명의 나무/);
  assert.doesNotMatch(reason, /미르|운석|팀 공동 목표/);
  const eventText = describeObserverEvent(queue);
  assert.match(eventText, /생명의 나무/);
  assert.match(eventText, /은하의 기어/);
  assert.doesNotMatch(eventText, /미르의 개밥바라기|운석/);
  const movementText = describeObserverReason({ kind: 'move', reason: 'team_rotate', from: 'a', to: 'shop',
    sharedGoalReason: teamReason });
  assert.match(movementText, /팀 공동 목표/);
  assert.match(movementText, /미르|운석/);
});

const queueObservation = updateProcurementObservation(null, {
  kind: 'queue', who: 'eunha', actionKey: 'k1', chosen: 'kioskBuy', itemId: 'life-tree', itemName: '생명의 나무',
  sharedGoalReason: teamReason, procurementPurpose: personalPurpose,
}, '04:56');

const completedReceipt = { kind: 'procurement', receiptVersion: 1, who: 'eunha', actionKey: 'k1',
  actionType: 'kioskBuy', itemId: 'life-tree', itemName: '생명의 나무', outcome: 'completed', qty: 1,
  receivedQty: 1, paidCost: 200, gainedCredits: 0, beforeCredits: 250, afterCredits: 50, consumed: [] };

check('queue remains unconfirmed; only matching completed or cancelled identity-4 receipts settle it', () => {
  assert.equal(queueObservation.outcome, 'unconfirmed');
  assert.equal(queueObservation.matchedChoice, false);
  assert.match(queueObservation.result, /획득 여부 미확인/);
  assert.match(queueObservation.purpose, /은하의 기어/);
  assert.match(queueObservation.teamMovementReason, /미르|운석/);

  const completed = updateProcurementObservation(queueObservation, completedReceipt, '04:57');
  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.matchedChoice, true);
  assert.equal(completed.purpose, queueObservation.purpose);
  assert.equal(completed.teamMovementReason, queueObservation.teamMovementReason);
  assert.match(completed.result, /구매 완료/);

  const cancelled = updateProcurementObservation(queueObservation, { ...completedReceipt,
    outcome: 'cancelled', reason: 'inventory_full' }, '04:57');
  assert.equal(cancelled.outcome, 'cancelled');
  assert.equal(cancelled.matchedChoice, true);
  assert.match(cancelled.result, /크레딧·가방 변경 없음/);
  assert.doesNotMatch(cancelled.result, /획득 여부 미확인/);
});

check('receipt identity mismatch clears both purposes and old queues stay personally unknown', () => {
  for (const changed of [
    { who: 'other' }, { actionKey: 'k2' }, { actionType: 'droneOrder' }, { itemId: 'meteor' },
  ]) {
    const observation = updateProcurementObservation(queueObservation, { ...completedReceipt, ...changed }, '04:57');
    assert.equal(observation.matchedChoice, false);
    assert.equal(observation.purpose, '');
    assert.equal(observation.teamMovementReason, '');
    assert.equal(observation.choice, '');
  }
  const oldQueue = { kind: 'queue', who: 'eunha', actionKey: 'old', chosen: 'kioskBuy', itemId: 'life-tree',
    itemName: '생명의 나무', sharedGoalReason: teamReason };
  assert.equal(describeObserverReason(oldQueue), '개인 조달 선택 · 구체적인 목적 기록 없음');
  const oldObservation = updateProcurementObservation(null, oldQueue, '04:50');
  assert.equal(oldObservation.purpose, '개인 조달 목적 기록 없음');
  assert.match(oldObservation.teamMovementReason, /미르|운석/);
  const settled = updateProcurementObservation(oldObservation, { ...completedReceipt, actionKey: 'old' }, '04:51');
  assert.equal(settled.matchedChoice, true);
  assert.equal(settled.purpose, '개인 조달 목적 기록 없음');
});

check('observer panel renders personal purpose and explicitly separate team movement context', () => {
  const source = readFileSync(new URL('../src/app/simulation/_components/SimulationTeamObserverPanel.js', import.meta.url), 'utf8');
  assert.match(source, /actor\.procurement\.purpose/);
  assert.match(source, /actor\.procurement\.teamMovementReason/);
  assert.match(source, /이 개인 주문의 목적과는 별개/);
  assert.match(source, /actor\.procurement\.matchedChoice \? ' → 결과 연결'/);
  assert.doesNotMatch(source, / → 정산 확인/);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'procurement-purpose identity, queue copy, observer settlement joins and UI source contract; no match or browser' }));
