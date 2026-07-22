import { TrackCard } from './RacingLogosPlayPanels';
import { RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosTracksTab(props) {
  const {
    state,
    tracks,
  } = props;

  return (
              <section className="games-panel">
                <RacingLogosPanelTitle action="map" title="트랙 로고" meta={`${tracks.length}개`} />
                <div className="game-save-list">
                  {tracks.map((track) => <TrackCard key={track.id} track={track} filters={state.filters} />)}
                </div>
              </section>
  );
}
