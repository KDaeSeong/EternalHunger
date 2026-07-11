import { getAtRiskStudents, getAverages, scoreState } from './schoolSimulatorEngine';

function schoolActionSnapshot(value) {
  const averages = getAverages(value);
  return {
    year: value.school?.year,
    semester: value.school?.semester,
    week: value.school?.week,
    budget: Number(value.school?.budget || 0),
    ap: Number(value.player?.weeklyActionPoint || 0),
    energy: Number(value.player?.energy || 0),
    mental: Number(value.player?.mental || 0),
    score: scoreState(value),
    understanding: Math.round(Number(averages.understanding || 0)),
    satisfaction: Math.round(Number(averages.satisfaction || 0)),
    stress: Math.round(Number(averages.stress || 0)),
    riskCount: getAtRiskStudents(value).length,
  };
}

export function actionFeedbackText(previous, next, label, fallback = '') {
  const latestLog = next.log?.[0];
  if (latestLog && latestLog !== previous.log?.[0]) return latestLog;

  const before = schoolActionSnapshot(previous);
  const after = schoolActionSnapshot(next);
  const parts = [];
  if (after.year !== before.year || after.semester !== before.semester || after.week !== before.week) {
    parts.push(`${after.year}년 ${after.semester}학기 ${after.week}주차`);
  }
  if (after.budget !== before.budget) parts.push(`예산 ${after.budget - before.budget >= 0 ? '+' : ''}${(after.budget - before.budget).toLocaleString('ko-KR')}`);
  if (after.ap !== before.ap) parts.push(`AP ${after.ap - before.ap >= 0 ? '+' : ''}${after.ap - before.ap}`);
  if (after.energy !== before.energy) parts.push(`체력 ${after.energy - before.energy >= 0 ? '+' : ''}${after.energy - before.energy}`);
  if (after.mental !== before.mental) parts.push(`멘탈 ${after.mental - before.mental >= 0 ? '+' : ''}${after.mental - before.mental}`);
  if (after.score !== before.score) parts.push(`점수 ${after.score.toLocaleString('ko-KR')}`);
  if (after.riskCount !== before.riskCount) parts.push(`위험 학생 ${after.riskCount}명`);
  if (after.understanding !== before.understanding) parts.push(`이해도 ${after.understanding}`);
  if (after.satisfaction !== before.satisfaction) parts.push(`만족도 ${after.satisfaction}`);
  if (after.stress !== before.stress) parts.push(`스트레스 ${after.stress}`);
  if (parts.length) return `${label}: ${parts.join(' · ')}`;
  return fallback || `${label}: ${after.year}년 ${after.semester}학기 ${after.week}주차 · AP ${after.ap} · 예산 ${after.budget.toLocaleString('ko-KR')}`;
}

export function schoolActionCue(previous, next) {
  const previousSemester = `${previous.school?.year || 0}:${previous.school?.semester || 0}`;
  const nextSemester = `${next.school?.year || 0}:${next.school?.semester || 0}`;
  if (previousSemester !== nextSemester) return 'semester';

  const previousFestival = previous.school?.festival || {};
  const nextFestival = next.school?.festival || {};
  const festivalCompleted = Number(nextFestival.history?.length || 0) > Number(previousFestival.history?.length || 0);
  if (festivalCompleted) return 'festival';

  const previousEventId = previous.events?.pending?.id || '';
  const nextEventId = next.events?.pending?.id || '';
  if (nextEventId && nextEventId !== previousEventId) return 'event';
  return '';
}

export function ScoreBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="game-save-row">
      <div>
        <span>{label}</span>
        <strong>{safeValue}</strong>
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 110,
          height: 10,
          borderRadius: 999,
          background: '#d8e4ee',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${safeValue}%`,
            height: '100%',
            background: safeValue >= 70 ? '#247a50' : safeValue >= 45 ? '#2673a6' : '#bc4749',
          }}
        />
      </div>
    </div>
  );
}
