import { RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosLogTab(props) {
  const {
    state,
  } = props;

  return (
              <section className="games-panel">
                <RacingLogosPanelTitle action="logs" title="운영 로그" meta={state.runId} />
                <div className="games-activity-list">
                  {state.log.slice(0, 12).map((line, index) => (
                    <div key={`${line}-${index}`}><strong>{line}</strong></div>
                  ))}
                </div>
              </section>
  );
}
