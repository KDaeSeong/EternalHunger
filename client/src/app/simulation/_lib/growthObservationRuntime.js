import { getActorGrowthProgress, getGrowthRecipeWork, markGrowthComponent } from './growthPlanRuntime.js';
import { getFieldResourceQty } from './fieldResourceRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { procurementFailureText } from './procurementTransactionRuntime.js';
import { prepareCraftTransaction, craftFailureText } from './craftTransactionRuntime.js';

const list = (value) => Array.isArray(value) ? value : [];
export const PROCUREMENT_LABELS = Object.freeze({ kioskBuy: '키오스크 구매', kioskExchange: '키오스크 교환', kioskSell: '키오스크 판매', droneOrder: '드론 주문' });

export function describeCraftReceipt(event) {
  if (event?.kind !== 'craft' || event.receiptVersion !== 1 || !Number.isSafeInteger(event.qty) || event.qty <= 0
    || event.receivedQty !== event.qty || !Number.isSafeInteger(event.paidCost) || event.paidCost < 0
    || ![event.beforeCredits, event.afterCredits].every((value) => Number.isFinite(value) && value >= 0)
    || event.beforeCredits - event.paidCost !== event.afterCredits) return '';
  return `${event.itemName || '아이템'} ${event.qty}개 제작 완료${event.paidCost
    ? ` · 제작 비용 ${event.paidCost}Cr (${event.beforeCredits}→${event.afterCredits}Cr)` : ''}`;
}

export function getActorGrowthObservation(actor, items, { progress = getActorGrowthProgress(actor, items),
  forbiddenIds = [], fieldResources, zoneName = String, isGameOver = false, ruleset } = {}) {
  if (isGameOver || !(actor?.hp > 0) || getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE) return null;
  const empty = { targetId: '', targetName: '', materials: '', destination: '', note: '' };
  const plan = actor._growthPlan;
  if (!progress.remaining.length && plan?.blocked === 'invalid_target') return { ...empty, status: 'unplanned', label: '후반 목표의 아이템·장착 부위·제작법 확인 필요' };
  if (!progress.totalSlots && !plan?.targetId) return { ...empty, status: 'unplanned', label: '성장 목표 미설정' };
  if (!progress.remaining.length && (plan?.stage !== 'late' || !plan?.targetId)) return { ...empty, status: 'complete', label: '현재 설정한 목표 장비 확보' };
  if (!plan) return { ...empty, status: 'unplanned', label: '성장 목표 선택 대기' };
  const target = (plan.stage === 'late' ? items : progress.remaining).find((item) => String(item._id) === String(plan.targetId));
  if (!target) return { ...empty, status: 'replanning', label: '현재 목표 확보 · 다음 성장 판단 대기' };
  const work = getGrowthRecipeWork(actor, items, target._id);
  if (!work.craftIds.length && !work.missing.length && !work.blocked) return { ...empty, status: 'replanning', label: '현재 목표 확보 · 다음 성장 판단 대기' };
  const missing = work.missing.slice(0, 3).map((row) => `${row.name} ${row.need}개`).join(' · ');
  const ready = items.find((item) => String(item._id) === work.readyCraftId);
  const receiptPreview = ready && ruleset ? prepareCraftTransaction(actor,
    markGrowthComponent(ready, { _growthPlan: { targetIds: plan.targetIds, componentIds: work.componentIds } }), 1, ruleset) : null;
  const materials = receiptPreview && !receiptPreview.ok ? craftFailureText(receiptPreview.reason, receiptPreview)
    : work.blocked === 'insufficient_credits' ? `제작 비용 부족 · 필요 ${work.requiredCredits}Cr / 보유 ${work.availableCredits}Cr`
    : work.blocked ? '제작법 연결 확인 필요' : work.missing.length
    ? `부족: ${missing}${work.missing.length > 3 ? ` 외 ${work.missing.length - 3}종` : ''}${ready ? ` · ${ready.name} 제작 가능` : ''}`
    : ready ? '필요한 재료 확보 · 제작 가능' : '다음 제작 판단 대기';
  const forbidden = forbiddenIds instanceof Set ? forbiddenIds : new Set(forbiddenIds);
  let destination = '', note = '';
  if (work.blocked) note = work.blocked === 'insufficient_credits' ? '재료 확보 · 제작 비용 대기' : '성장 경로 재검토';
  else if (work.missing.length && plan.targetZoneId) {
    const relevant = list(plan.missing).filter((row) => work.missing.some((need) => need.itemId === row.itemId)
      && list(row.zones).includes(plan.targetZoneId));
    if (forbidden.has(plan.targetZoneId)) note = '계획한 재료 지역이 금지구역 · 새 판단 대기';
    else if (relevant.length && relevant.every((row) => getFieldResourceQty(fieldResources, plan.targetZoneId, row.itemId) <= 0)) note = '계획한 지역의 필요한 재료 소진 · 새 판단 대기';
    else if (relevant.length) destination = zoneName(plan.targetZoneId);
  }
  if (!destination && !note && work.missing.length && plan.blocked) note = ({ no_material_source: '필드 공급처 없음 · 다른 조달 판단 필요',
    no_safe_path: '안전한 재료 경로 없음', invalid_recipe: '제작법 연결 확인 필요' })[plan.blocked] || '성장 경로 재검토';
  return { targetId: String(target._id), targetName: target.name, status: 'growing', stage: plan.stage,
    label: `${plan.stage === 'late' ? '후반 성장' : '성장'} 목표: ${target.name}`, materials, destination, note };
}

// Only a committed transaction produces a completion label. Never infer receipt
// from the selected order, current bag contents, or a later order for that item.
export function describeProcurementReceipt(event) {
  if (event?.kind !== 'procurement' || event.receiptVersion !== 1 || !Object.hasOwn(PROCUREMENT_LABELS, event.actionType)) return '';
  const action = PROCUREMENT_LABELS[event.actionType];
  const name = event.itemName || '품목 미확인';
  if (event.outcome === 'cancelled') return `${action} · ${name} · ${procurementFailureText(event.reason)} · 크레딧·가방 변경 없음`;
  const numericKeys = ['paidCost', 'gainedCredits', 'beforeCredits', 'afterCredits', 'receivedQty', 'qty'];
  if (event.outcome !== 'completed' || !numericKeys.every((key) => Number.isFinite(event[key]) && event[key] >= 0)
    || !Number.isSafeInteger(event.qty) || event.qty <= 0 || !Number.isSafeInteger(event.receivedQty)
    || Math.abs(event.beforeCredits - event.paidCost + event.gainedCredits - event.afterCredits) > 0.000001
    || (event.actionType === 'kioskSell' ? event.receivedQty !== 0 : event.receivedQty !== event.qty)) return '';
  if (['kioskExchange', 'kioskSell'].includes(event.actionType) && (!list(event.consumed).length
    || !event.consumed.every((row) => row?.itemId && Number.isSafeInteger(row.qty) && row.qty > 0))) return '';
  const consumed = list(event.consumed).filter((row) => row.itemId && Number.isSafeInteger(row.qty) && row.qty > 0)
    .map((row) => `${row.itemName || row.itemId} ${row.qty}개`).join(' + ');
  const balance = `보유 ${event.beforeCredits}→${event.afterCredits}Cr`;
  if (event.actionType === 'kioskSell') return `${action} · ${name} ${event.qty}개 판매 완료 · +${event.gainedCredits}Cr · ${balance}`;
  if (event.actionType === 'kioskExchange') return `${action} · ${consumed || '교환 재료'} → ${name} ${event.receivedQty}개 교환 완료 · ${balance}`;
  return `${action} · ${name} ${event.receivedQty}개 ${event.actionType === 'droneOrder' ? '수령' : '구매'} 완료 · -${event.paidCost}Cr · ${balance}`;
}

export function updateProcurementObservation(previous, event, clock) {
  if (event.kind === 'queue' && Object.hasOwn(PROCUREMENT_LABELS, event.chosen)) return {
    actionKey: event.actionKey || '', actionType: event.chosen, itemId: event.itemId || '', outcome: 'unconfirmed',
    clock, choice: `${PROCUREMENT_LABELS[event.chosen]} · ${event.itemName || '품목 미기록'} 선택`,
    result: '정산 결과 기록 없음 · 획득 여부 미확인', matchedChoice: false,
  };
  const result = describeProcurementReceipt(event);
  if (!result) return previous;
  const matched = !!event.actionKey && previous?.actionKey === event.actionKey && previous.actionType === event.actionType
    && previous.itemId === event.itemId;
  return { actionKey: event.actionKey, actionType: event.actionType, itemId: event.itemId, outcome: event.outcome,
    clock, choice: matched ? previous.choice : '', choiceClock: matched ? previous.choiceClock || previous.clock : '', matchedChoice: matched, result };
}
