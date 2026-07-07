import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import { runForAction, stepAction } from '../_lib/rail3dEngine';

export default function Rail3dOperationsTab(props) {
  const {
    applyRailAction,
    bottleneck,
    completed,
    dispatchPlan,
    openAnalysisTab,
    recentActionText,
    report,
    rows,
    score,
    state,
    stopped,
    tokenWaits,
  } = props;

  return (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운행 판단</h2>
                    <span>{completed === rows.length ? '운행 완료' : stopped ? '정지 발생' : '운행 중'}</span>
                  </div>
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
                    <ActionButton onClick={openAnalysisTab}>병목/다이아 보기</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>관제 플랜</h2>
                    <span>{bottleneck.grade}등급 · {dispatchPlan.items.length}개</span>
                  </div>
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>{dispatchPlan.headline}</strong>
                  </div>
                  <div className="game-save-list">
                    {dispatchPlan.items.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.kind}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => runDispatchAction(item)}>
                          {item.actionLabel}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 제어</h2>
                    <span>Step {state.stepSeconds}s · Lookahead {state.lookaheadBlocks}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyRailAction('1 Step', (current) => stepAction(current))}>1 Step</ActionButton>
                    <ActionButton onClick={() => applyRailAction('5분 진행', (current) => runForAction(current, 300))}>5분 진행</ActionButton>
                    <ActionButton onClick={() => applyRailAction('20분 진행', (current) => runForAction(current, 1200))}>20분 진행</ActionButton>
                  </div>
                  <RecentActionResult label="최근 운행 결과" text={recentActionText} pinned />
                </section>
              </section>
  );
}
