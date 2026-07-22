import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { generateRaceCardAction, generateSeasonCardAction } from '../_lib/racingLogosEngine';
import { RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosDataPackTab(props) {
  const {
    dataPack,
    recentActionText,
    resultPresentation,
    setState,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <RacingLogosPanelTitle
                    action={dataPack.releaseScore >= 100 ? 'release-ready' : 'release'}
                    title="배포 단위"
                    meta={`${dataPack.releaseScore}%`}
                  />
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <SmallStat icon="season-card" label="시즌 카드" value={dataPack.seasonCards} />
                    <SmallStat icon="race-card" label="이벤트 카드" value={dataPack.eventCards} />
                    <SmallStat icon="logs" label="결과 행" value={dataPack.resultRows.length} />
                    <SmallStat icon="trophy" label="평균 레이팅" value={dataPack.avgRating || '-'} />
                  </div>
                  <div className="game-save-list">
                    {dataPack.packRows.map((row) => (
                      <article className="game-save-row racing-logo-icon-row" key={row.id}>
                        <GameActionIcon action={row.status === 'complete' ? 'release-ready' : 'release'} label={row.label} />
                        <div>
                          <span>{row.value} · {row.pct}%</span>
                          <strong>{row.label}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.status === 'complete' ? '완료' : '준비'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="analysis" title="장기 결과 모델" meta="event · season · ledger" />
                  <div className="game-save-list">
                    {dataPack.modelRows.map((row) => (
                      <article className="game-save-row racing-logo-icon-row" key={row.id}>
                        <GameActionIcon action="analysis" label={row.label} />
                        <div>
                          <span>{row.value} · {row.pct}%</span>
                          <strong>{row.label}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.status === 'complete' ? '연결' : '대기'}</strong>
                      </article>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="race-card" cue="off" onClick={() => setState((current) => generateRaceCardAction(current))}>이벤트 카드 생성</ActionButton>
                    <ActionButton action="season-card" cue="off" onClick={() => setState((current) => generateSeasonCardAction(current))}>시즌 카드 생성</ActionButton>
                  </div>
                  <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="archive" title="결과 원장" meta={`${dataPack.resultRows.length}행`} />
                  <div className="game-save-list">
                    {dataPack.resultRows.length ? dataPack.resultRows.slice(0, 8).map((row) => (
                      <article className="game-save-row racing-logo-icon-row" key={row.id}>
                        <GameActionIcon action={row.season ? 'season-card' : 'race-card'} label={row.raceName} />
                        <div>
                          <span>{row.season ? '시즌' : '이벤트'} · {row.trackName} · {row.distanceM.toLocaleString('ko-KR')}m</span>
                          <strong>{row.raceName}: {row.winner}</strong>
                          <small>2위 {row.runnerUp} · {row.surface.toUpperCase()} · rating {row.rating}</small>
                        </div>
                        <strong>{row.week || 'card'}</strong>
                      </article>
                    )) : <div className="games-empty">이벤트 카드나 시즌 카드를 생성하면 장기 결과 원장이 채워집니다.</div>}
                  </div>
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="target" title="다음 분리 작업" meta="추천" />
                  <div className="games-activity-list">
                    {dataPack.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
              </section>
  );
}
