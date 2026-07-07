import { TrackCard } from './RacingLogosPlayPanels';

export default function RacingLogosTracksTab(props) {
  const {
    state,
    tracks,
  } = props;

  return (
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>트랙 로고</h2>
                  <span>{tracks.length}개</span>
                </div>
                <div className="game-save-list">
                  {tracks.map((track) => <TrackCard key={track.id} track={track} filters={state.filters} />)}
                </div>
              </section>
  );
}
