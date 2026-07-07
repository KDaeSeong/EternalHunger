export default function RacingLogosLogTab(props) {
  const {
    state,
  } = props;

  return (
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>운영 로그</h2>
                  <span>{state.runId}</span>
                </div>
                <div className="games-activity-list">
                  {state.log.slice(0, 12).map((line, index) => (
                    <div key={`${line}-${index}`}><strong>{line}</strong></div>
                  ))}
                </div>
              </section>
  );
}
