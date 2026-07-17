import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { generateSeasonCardAction } from '../_lib/racingLogosEngine';
import { LogoPreview } from './RacingLogosPlayPanels';

export default function RacingLogosCalendarTab(props) {
  const {
    calendar,
    recentActionText,
    resultPresentation,
    setState,
    state,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>시즌 캘린더 리포트</h2>
                    <span>{calendar.readyRows}/{calendar.totalRows} 편성 가능</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="준비도" value={`${calendar.averageReadiness}%`} />
                    <SmallStat label="예상 관심도" value={`${calendar.projectedInterest}%`} />
                    <SmallStat label="지역" value={calendar.regions.length} />
                    <SmallStat label="주로" value={calendar.surfaces.length} />
                    <SmallStat label="보강 필요" value={calendar.missingRows.length} />
                    <SmallStat label="카드" value={state.raceCards.length} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {calendar.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="season-card" cue="off" onClick={() => setState((current) => generateSeasonCardAction(current))}>시즌 카드 생성</ActionButton>
                  </div>
                  <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>라운드 편성</h2>
                    <span>{calendar.rows.length}라운드</span>
                  </div>
                  <div className="game-save-list">
                    {calendar.rows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <LogoPreview
                          key={`${row.logoKey}:${row.fallbackLogo}:${state.filters.preferLocalLogos ? 'local' : 'placeholder'}:${row.id}`}
                          alt={row.trackName}
                          fallbackLogo={row.fallbackLogo}
                          localCandidates={row.localCandidates}
                          preferLocalLogos={state.filters.preferLocalLogos}
                          showDebug={state.filters.showDebug}
                        />
                        <div>
                          <span>{row.week} · {row.tier} · {row.theme}</span>
                          <strong>{row.raceName}</strong>
                          <small>{row.trackName} / {row.surfaceName} / {row.distanceM.toLocaleString('ko-KR')}m</small>
                          <small>{row.status}</small>
                        </div>
                        <span className="game-save-chip">{row.readiness}%</span>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>예상 결과</h2>
                    <span>시즌 카드 미리보기</span>
                  </div>
                  <div className="game-save-list">
                    {calendar.rows.map((row) => (
                      <article className="game-save-row racing-logo-icon-row" key={`${row.id}-preview`}>
                        <GameActionIcon action="trophy" label="예상 우승" />
                        <div>
                          <span>{row.week} · 상금 {row.purse.toLocaleString('ko-KR')}</span>
                          <strong>{row.preview.winner}</strong>
                          <small>2위 {row.preview.runnerUp} · 관심도 {row.projectedInterest}%</small>
                        </div>
                        <strong>{row.preview.rating}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
  );
}
