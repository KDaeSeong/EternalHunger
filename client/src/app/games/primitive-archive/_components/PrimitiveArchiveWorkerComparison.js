import { GameControlButton } from '../../_components/GamePlayPrimitives';

const numberText = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '확인 불가';
const differenceText = value => typeof value !== 'number' || !Number.isFinite(value) ? '확인 불가'
  : value > 0 ? `+${numberText(value)}` : value < 0 ? numberText(value) : '변화 없음';
const GROUP_LABELS = { production: '생산', resources: '정산 후 재고', operations: '운영' };

export default function PrimitiveArchiveWorkerComparison({ comparison, choice, onChoose, onApply,
  selectionBlocked = false, applyBlocked = false, applyBlockedReason = '' }) {
  if (!comparison) return null;
  const jobs = comparison.jobs || [];
  const assignmentText = assignments => jobs.filter(job => job.id !== 'unassigned')
    .map(job => `${job.name} ${numberText(assignments?.[job.id])}명`).join(' · ');
  return (
    <section className="primitive-worker-comparison" aria-label="일손 1명 배치 비교">
      <h3>일손 1명 배치 비교</h3>
      <p>비교는 무료이며 배치를 바꾸지 않습니다. {comparison.periodLabel}의 같은 조건에서 얻고 잃는 양을 비교합니다.</p>
      <div className="primitive-worker-comparison__controls">
        <label><span>현재 맡은 일</span><select value={choice.fromJobId}
          disabled={selectionBlocked} onChange={event => onChoose('fromJobId', event.target.value)}>
          <option value="unassigned">미배치</option>
          {jobs.filter(job => job.id !== 'unassigned').map(job => <option key={job.id} value={job.id}
            disabled={job.count <= 0}>{job.name} · {job.count}명</option>)}
        </select></label>
        <label><span>맡길 일</span><select value={choice.toJobId}
          disabled={selectionBlocked} onChange={event => onChoose('toJobId', event.target.value)}>
          <option value="">직업 선택</option>
          {jobs.filter(job => job.id !== 'unassigned').map(job => <option key={job.id} value={job.id}
            disabled={!job.unlocked || job.id === choice.fromJobId}>{job.name}{job.unlocked ? '' : ' · 잠김'}</option>)}
        </select></label>
      </div>
      {!comparison.available && comparison.reason ? <p className="primitive-worker-comparison__reason">{comparison.reason}</p> : null}
      {comparison.available ? <>
        <div className="primitive-worker-comparison__table-wrap" tabIndex={0} role="region" aria-label="일손 배치 손익표">
          <table className="primitive-worker-comparison__table">
            <caption>{comparison.periodLabel} · 현재 배치와 1명 이동 후 비교</caption>
            <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경 후</th><th scope="col">차이</th></tr></thead>
            <tbody>{comparison.rows.map(row => <tr key={row.id} data-group={row.group}
              data-change={row.delta > 0 ? 'gain' : row.delta < 0 ? 'loss' : 'same'}>
              <th scope="row">{GROUP_LABELS[row.group] || row.group} · {row.label}</th>
              <td>{numberText(row.before)} {row.unit}</td><td>{numberText(row.after)} {row.unit}</td>
              <td>{differenceText(row.delta)}{row.delta !== 0 ? ` ${row.unit}` : ''}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <details className="primitive-worker-comparison__assignment">
          <summary>자동 재배치를 반영한 비교 일손</summary>
          <p>현재: {assignmentText(comparison.before?.assignments)}</p>
          <p>변경 후: {assignmentText(comparison.after?.assignments)}</p>
        </details>
      </> : null}
      <div className="primitive-worker-comparison__notes">
        {(comparison.assumptions || []).length ? <ul>{comparison.assumptions.map((text, index) => <li key={index}>{text}</li>)}</ul> : null}
        {(comparison.warnings || []).length ? <ul>{comparison.warnings.map((text, index) => <li key={index}>{text}</li>)}</ul> : null}
        <p>옮긴 직업의 배치는 직접 고정됩니다. 출발·도착 직업의 자동 배치분도 수동 고정되며 운영 방침은 그대로 유지합니다.</p>
      </div>
      <GameControlButton action="primitive-job" cue="off" className="primitive-worker-comparison__apply"
        disabled={applyBlocked || !comparison.available} onClick={onApply}>1명 옮기기</GameControlButton>
      {applyBlockedReason ? <p className="primitive-worker-comparison__reason">{applyBlockedReason}</p> : null}
    </section>
  );
}
