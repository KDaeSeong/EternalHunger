export default function Rail3dLogTab(props) {
  const {
    state,
  } = props;

  return (
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>운행 로그</h2>
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
