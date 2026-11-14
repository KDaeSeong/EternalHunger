import { AUTO_DAY_GOALS } from '../_lib/primitiveArchiveAutoDayGoals';

export default function PrimitiveArchiveAutoDayGoalPanel({ goalId, onChange, disabled, report }) {
  const selected = AUTO_DAY_GOALS.find(row => row.id === goalId);
  return (
    <section className="primitive-auto-day-goal" aria-label="하루 자동 운영 목표">
      <label className="game-save-json-field">
        <span>자동 운영 목표</span>
        <select value={goalId} onChange={event => onChange(event.target.value)} disabled={disabled}
          aria-describedby="primitive-auto-day-goal-help">
          {AUTO_DAY_GOALS.map(goal => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
        </select>
      </label>
      <p id="primitive-auto-day-goal-help">{selected?.description} 목표 선택은 무료이며, 하루 자동 운영을 누를 때 기존 행동 비용으로 실행합니다.</p>
      {report ? (
        <details className="primitive-action-settings">
          <summary>최근 자동 운영 처리내역 · {report.goalLabel} · {report.fromDay}일 → {report.toDay}일</summary>
          <p>실행 목표: {report.goalDescription}</p>
          <p>실제 누적 횟수 변화입니다. 하루 경과에 따른 정산도 포함되며 행동의 전체 순서를 뜻하지 않습니다.</p>
          {report.changes.length ? <ul>{report.changes.map(row => <li key={row.id}>{row.label} +{row.count}</li>)}</ul>
            : <p>표시할 누적 횟수 변화가 없습니다.</p>}
          <strong>최근 기록</strong>
          {report.recentLog.length ? <ul>{report.recentLog.map((line, index) => <li key={index}>{line}</li>)}</ul>
            : <p>새로 확인할 최근 기록이 없습니다.</p>}
        </details>
      ) : null}
    </section>
  );
}
