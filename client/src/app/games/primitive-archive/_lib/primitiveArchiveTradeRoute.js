import { RIVAL_TRIBES } from './primitiveArchiveData.js';

export const ANNUAL_TRADE_PROJECT_ID = 'early-modern-trade-route';
export const ANNUAL_TRADE_JOBS = [{ id: 'builder', name: '건설대' }, { id: 'scholar', name: '기록대' }];
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const goodsEqual = (actual, expected) => exactKeys(actual, Object.keys(expected))
  && Object.entries(expected).every(([id, quantity]) => actual[id] === quantity);

export function isValidAnnualTradeRouteState(state) {
  if (Object.hasOwn(state, 'annualTradeRoute')) {
    const route = state.annualTradeRoute;
    if (!exactKeys(route, ['version', 'rivalId', 'fromJobId']) || route.version !== 1
      || !RIVAL_TRIBES.some(row => row.id === route.rivalId)
      || !ANNUAL_TRADE_JOBS.some(row => row.id === route.fromJobId)
      || state.calendar?.mode !== 'annual' || !state.projects?.completed?.[ANNUAL_TRADE_PROJECT_ID]
      || state.diplomacy?.contacts?.[route.rivalId]?.known !== true) return false;
  }
  const receipt = state.tribe?.lastProduction?.tradeRoute;
  if (receipt === undefined) return true;
  if (!exactKeys(receipt, ['version', 'rivalId', 'fromJobId', 'workers', 'spent', 'received', 'status', 'reason'])
    || receipt.version !== 1
    || !ANNUAL_TRADE_JOBS.some(row => row.id === receipt.fromJobId)) return false;
  const rival = RIVAL_TRIBES.find(row => row.id === receipt.rivalId);
  const applied = receipt.status === 'applied' && receipt.reason === '' && receipt.workers === 1
    && rival && goodsEqual(receipt.spent, rival.tradeCost) && goodsEqual(receipt.received, rival.tradeReward);
  const skipped = receipt.status === 'skipped' && receipt.workers === 0
    && ['선택한 직업에 실제 일손 1명이 필요합니다.', '올해 시작 비축에 교역 자재가 부족합니다.'].includes(receipt.reason)
    && goodsEqual(receipt.spent, {}) && goodsEqual(receipt.received, {});
  return Boolean(rival && (applied || skipped) && state.calendar?.mode === 'annual'
    && state.projects?.completed?.[ANNUAL_TRADE_PROJECT_ID]);
}

// Project from pre-production stock. The assigned worker is diverted only when
// the whole exchange can execute; configured jobs are never rewritten here.
export function projectAnnualTradeRoute(state) {
  const route = state.annualTradeRoute;
  const rival = RIVAL_TRIBES.find(row => row.id === route?.rivalId);
  const unlocked = state.calendar?.mode === 'annual' && Boolean(state.projects?.completed?.[ANNUAL_TRADE_PROJECT_ID]);
  const configured = Boolean(route);
  let reason = state.ended ? '종료된 문명입니다.' : !unlocked ? '연간 운영에서 근세 교역로 사업을 완성해야 합니다.'
    : !configured ? '교역 상대와 전용 일손을 선택하세요.'
      : !rival || !state.diplomacy?.contacts?.[rival.id]?.known ? '접촉한 교역 상대가 필요합니다.'
        : !ANNUAL_TRADE_JOBS.some(row => row.id === route.fromJobId) || Number(state.tribe?.assignments?.[route.fromJobId] || 0) < 1
          ? '선택한 직업에 실제 일손 1명이 필요합니다.'
          : Object.entries(rival.tradeCost).some(([id, count]) => Number(state.inventory?.[id] || 0) < count)
            ? '올해 시작 비축에 교역 자재가 부족합니다.' : '';
  const assignments = { ...state.tribe?.assignments };
  const inventory = { ...state.inventory };
  let receipt = null;
  if (!reason) {
    assignments[route.fromJobId] -= 1;
    for (const [id, count] of Object.entries(rival.tradeCost)) inventory[id] = Number(inventory[id] || 0) - count;
    for (const [id, count] of Object.entries(rival.tradeReward)) inventory[id] = Number(inventory[id] || 0) + count;
    receipt = { version: 1, rivalId: rival.id, fromJobId: route.fromJobId, workers: 1, status: 'applied', reason: '',
      spent: { ...rival.tradeCost }, received: { ...rival.tradeReward } };
  } else if (configured && unlocked && rival && state.diplomacy?.contacts?.[rival.id]?.known
    && ANNUAL_TRADE_JOBS.some(row => row.id === route.fromJobId) && !state.ended) {
    receipt = { version: 1, rivalId: rival.id, fromJobId: route.fromJobId, workers: 0, status: 'skipped', reason,
      spent: {}, received: {} };
  }
  return { unlocked, configured, canOperate: !reason, reason, rival, assignments, inventory, receipt };
}
