import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

const PANEL_ACTIONS = {
  code: 'code',
  execution: 'execute',
  document: 'archive',
  hint: 'guide',
};

export function ResultRow({ result }) {
  const detail = (result.rules || []).map((rule) => rule.value).filter(Boolean).join(' · ');
  return (
    <SiCodingIconRow action={result.passed ? 'coding-test-pass' : 'coding-test-fail'}>
      <div>
        <span>{result.resultType === 'document' ? 'DOC' : result.passed ? 'PASS' : 'FAIL'}</span>
        <strong>{result.label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <strong>{result.passed ? '통과' : '미통과'}</strong>
    </SiCodingIconRow>
  );
}

export default function SubmissionReadinessPanel({
  canRevealHint,
  onJump,
  onReset,
  onRevealHint,
  onSubmit,
  readiness,
}) {
  return (
    <section className="games-panel">
      <SiCodingPanelTitle action="coding-ready" title="제출 준비도" meta={`${readiness.percent}%`} />
      <div className="games-rank-split">
        <SmallStat icon="coding-test-pass" label="예상 통과" value={`${readiness.passCount}/${readiness.totalCount}`} />
        <SmallStat icon="replay" label="보고" value={readiness.reportSummary} />
        <SmallStat icon="document-review" label="문서" value={readiness.documentSummary} />
        <SmallStat icon="hint" label="힌트" value={readiness.hintSummary} />
      </div>
      <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
        <strong>{readiness.headline}</strong>
        {' · '}
        {readiness.nextAction}
      </div>
      <div className="game-save-list" style={{ marginTop: 12 }}>
        {readiness.rows.slice(0, 5).map((row) => (
          <SiCodingIconRow action={row.passed ? 'coding-test-pass' : 'coding-blocked'} key={`readiness-${row.id}`} style={row.passed ? { borderColor: '#2b8a5f' } : null}>
            <div>
              <span>{row.passed ? '예상 통과' : '보강 필요'}</span>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <GameControlButton action={PANEL_ACTIONS[row.panel] || 'target'} className="tcg-primary-action" onClick={() => onJump(row.panel)}>
              {row.actionLabel}
            </GameControlButton>
          </SiCodingIconRow>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
        <ActionButton action="coding-submit" cue="codeSubmit" onClick={onSubmit}>현재 과제 검수</ActionButton>
        <ActionButton action="hint" onClick={onRevealHint} disabled={!canRevealHint}>힌트 열기</ActionButton>
        <ActionButton action="reset" onClick={onReset}>현재 과제 초기화</ActionButton>
      </div>
    </section>
  );
}
