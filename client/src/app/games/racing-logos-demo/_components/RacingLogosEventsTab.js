import GameActionIcon from '../../_components/GameActionIcon';
import { EventRow } from './RacingLogosPlayPanels';
import { RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosEventsTab(props) {
  const {
    events,
    latestRaceCard,
    state,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <RacingLogosPanelTitle action="calendar" title="이벤트" meta={`${events.length}개`} />
                  <div className="game-save-list">
                    {events.map((event) => <EventRow key={event.id} event={event} filters={state.filters} />)}
                  </div>
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="race-card" title="이벤트 카드" meta={`${latestRaceCard ? latestRaceCard.results.length : 0} races`} />
                  <div className="game-save-list">
                    {latestRaceCard ? latestRaceCard.results.map((result, index) => (
                      <article className="game-save-row racing-logo-icon-row" key={`${result.eventId}-${result.week || index}`}>
                        <GameActionIcon action="trophy" label="우승 결과" />
                        <div>
                          <span>{result.trackName} / {result.surface.toUpperCase()} / {result.distanceM.toLocaleString('ko-KR')}m</span>
                          <strong>{result.raceName}</strong>
                          <small>2위 {result.runnerUp}</small>
                        </div>
                        <strong>{result.winner}</strong>
                      </article>
                    )) : <div className="games-empty">이벤트 카드를 생성하면 간단한 레이스 결과가 표시됩니다.</div>}
                  </div>
                </section>
              </section>
  );
}
