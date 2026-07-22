import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { generateSeasonCardAction } from '../_lib/racingLogosEngine';
import { LogoPreview } from './RacingLogosPlayPanels';
import { RacingLogosInfoRow, RacingLogosPanelTitle } from './RacingLogosVisuals';

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
                  <RacingLogosPanelTitle action="season-card" title="시즌 캘린더 리포트" meta={`${calendar.readyRows}/${calendar.totalRows} 편성 가능`} />
                  <div className="games-rank-split">
                    <SmallStat icon="status" label="준비도" value={`${calendar.averageReadiness}%`} />
                    <SmallStat icon="trophy" label="예상 관심도" value={`${calendar.projectedInterest}%`} />
                    <SmallStat icon="map" label="지역" value={calendar.regions.length} />
                    <SmallStat icon="filter" label="주로" value={calendar.surfaces.length} />
                    <SmallStat icon="draft" label="보강 필요" value={calendar.missingRows.length} />
                    <SmallStat icon="race-card" label="카드" value={state.raceCards.length} />
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
                  <RacingLogosPanelTitle action="calendar" title="라운드 편성" meta={`${calendar.rows.length}라운드`} />
                  <div className="game-save-list">
                    {calendar.rows.map((row) => (
                      <RacingLogosInfoRow
                        key={row.id}
                        label={row.raceName}
                        leading={<LogoPreview
                          key={`${row.logoKey}:${row.fallbackLogo}:${state.filters.preferLocalLogos ? 'local' : 'placeholder'}:${row.id}`}
                          alt={row.trackName}
                          fallbackLogo={row.fallbackLogo}
                          localCandidates={row.localCandidates}
                          preferLocalLogos={state.filters.preferLocalLogos}
                          showDebug={state.filters.showDebug}
                        />}
                      >
                        <div>
                          <span>{row.week} · {row.tier} · {row.theme}</span>
                          <strong>{row.raceName}</strong>
                          <small>{row.trackName} / {row.surfaceName} / {row.distanceM.toLocaleString('ko-KR')}m</small>
                          <small>{row.status}</small>
                        </div>
                        <span className="game-save-chip">{row.readiness}%</span>
                      </RacingLogosInfoRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="trophy" title="예상 결과" meta="시즌 카드 미리보기" />
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
