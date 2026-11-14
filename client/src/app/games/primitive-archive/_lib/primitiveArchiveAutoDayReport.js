import { AUTO_DAY_GOALS, normalizeAutoDayGoal } from './primitiveArchiveAutoDayGoals';

const COUNTER_LABELS = {
  gather: '채집 성공', hunt: '사냥 성공', craft: '제작 성공', logging: '벌목 성공',
  herbal: '약초 채집 성공', trap: '덫 사냥 성공', farm: '농업 성공', herd: '목축 성공',
  fish: '어로 성공', mine: '채광 성공', quarry: '채석 성공', survey: '탐사 성공',
  patrol: '순찰 성공', treatment: '치료 성공', festival: '축제 성공', season_plan: '계절 준비 성공',
  drill: '훈련 성공', debate: '토론 성공', irrigation: '관개 성공', kiln: '가마 작업 성공',
  weave: '직조 성공', smelt: '제련 성공', forge: '단조 성공', mill: '제분 성공',
  market: '시장 거래 성공', preserve: '식량 보존 성공', road: '도로 작업 성공',
  trade_route: '교역로 작업 성공', settlement: '정착 작업 성공', voyage: '항해 성공',
  camp: '캠프 작업', meals: '식사', events: '사건 처리',
};

export function autoDayExecutionReport(previous, next, goalValue) {
  if (!previous || !next || previous === next || previous.runId !== next.runId) return null;
  const goalId = normalizeAutoDayGoal(goalValue);
  const goal = AUTO_DAY_GOALS.find(row => row.id === goalId);
  const changes = Object.entries(COUNTER_LABELS).flatMap(([id, label]) => {
    const count = Number(next.counters?.[id] || 0) - Number(previous.counters?.[id] || 0);
    return Number.isFinite(count) && count > 0 ? [{ id, label, count }] : [];
  });
  const oldLog = Array.isArray(previous.log) ? previous.log : [];
  const newLog = Array.isArray(next.log) ? next.log : [];
  let addedCount = newLog.length;
  let matched = false;
  for (let index = 0; index < newLog.length; index += 1) {
    const overlap = newLog.length - index;
    if (overlap <= oldLog.length && newLog.slice(index).every((line, offset) => line === oldLog[offset])) {
      addedCount = index;
      matched = true;
      break;
    }
  }
  return {
    runId: next.runId, goalId, goalLabel: goal?.label || '기본 운영', goalDescription: goal?.description || '',
    fromDay: previous.day, toDay: next.day, changes,
    recentLog: newLog.slice(0, matched ? Math.min(addedCount, 8) : 8),
  };
}
