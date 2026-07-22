import { Rail3dPanelTitle } from './Rail3dVisuals';

export default function Rail3dLogTab(props) {
  const {
    state,
  } = props;

  return (
              <section className="games-panel">
                <Rail3dPanelTitle action="logs" title="운행 로그" meta={state.runId} />
                <div className="games-activity-list">
                  {state.log.slice(0, 12).map((line, index) => (
                    <div key={`${line}-${index}`}><strong>{line}</strong></div>
                  ))}
                </div>
              </section>
  );
}
