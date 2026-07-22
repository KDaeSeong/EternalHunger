import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { runForAction, stepAction } from '../_lib/rail3dEngine';
import { Rail3dIconRow, Rail3dPanelTitle } from './Rail3dVisuals';

const DISPATCH_ACTION_ICONS = {
  'focus-train': 'dispatch',
  'apply-lookahead': 'guard',
  'show-analysis': 'analysis',
  step: 'turn',
  'run-5': 'advance',
  record: 'archive',
};

export default function Rail3dOperationsTab(props) {
  const {
    applyRailAction,
    bottleneck,
    completed,
    dispatchPlan,
    openAnalysisTab,
    report,
    rows,
    runDispatchAction,
    score,
    state,
    stopped,
    tokenWaits,
  } = props;

  return (
              <section className="games-dashboard">
                <section className="games-panel">
                  <Rail3dPanelTitle
                    action={completed === rows.length ? 'rail-clear' : stopped ? 'signal' : 'analysis'}
                    title="운행 판단"
                    meta={completed === rows.length ? '운행 완료' : stopped ? '정지 발생' : '운행 중'}
                  />
                  <div className="games-rank-split">
                    <SmallStat label="종착" value={`${completed}/${rows.length}`} />
                    <SmallStat label="STOP" value={stopped} />
                    <SmallStat label="토큰 대기" value={tokenWaits} />
                    <SmallStat label="누적 지연" value={`${report.totals.totalDelayS}s`} />
                    <SmallStat label="총 대기" value={`${report.totals.totalWaitS}s`} />
                    <SmallStat label="점수" value={score.toLocaleString('ko-KR')} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {report.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="analysis" onClick={openAnalysisTab}>병목/다이아 보기</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <Rail3dPanelTitle action="dispatch" title="관제 플랜" meta={`${bottleneck.grade}등급 · ${dispatchPlan.items.length}개`} />
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>{dispatchPlan.headline}</strong>
                  </div>
                  <div className="game-save-list">
                    {dispatchPlan.items.map((item) => (
                      <Rail3dIconRow
                        action={DISPATCH_ACTION_ICONS[item.action] || 'dispatch'}
                        label={item.title}
                        key={item.id}
                      >
                        <div>
                          <span>{item.kind}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <GameControlButton
                          action={DISPATCH_ACTION_ICONS[item.action] || 'dispatch'}
                          className="tcg-primary-action"
                          cue={['apply-lookahead', 'step', 'run-5'].includes(item.action) ? 'off' : undefined}
                          onClick={() => runDispatchAction(item)}
                        >
                          {item.actionLabel}
                        </GameControlButton>
                      </Rail3dIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <Rail3dPanelTitle action="settings" title="빠른 제어" meta={`Step ${state.stepSeconds}s · Lookahead ${state.lookaheadBlocks}`} />
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton action="turn" cue="off" onClick={() => applyRailAction('1 Step', (current) => stepAction(current))}>1 Step</ActionButton>
                    <ActionButton action="advance" cue="off" onClick={() => applyRailAction('5분 진행', (current) => runForAction(current, 300))}>5분 진행</ActionButton>
                    <ActionButton action="advance" cue="off" onClick={() => applyRailAction('20분 진행', (current) => runForAction(current, 1200))}>20분 진행</ActionButton>
                  </div>
                </section>
              </section>
  );
}
