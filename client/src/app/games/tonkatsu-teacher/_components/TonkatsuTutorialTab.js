

export default function TonkatsuTutorialTab(props) {
  const {
    operationsReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>초반 체크리스트</h2>
                    <span>{operationsReport.tutorialPct}%</span>
                  </div>
                  <div className="game-save-list">
                    {operationsReport.tutorialRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.done ? '완료' : `${row.progressPct}%`}</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                          <small>{row.actionHint}</small>
                        </div>
                        <strong>{row.done ? 'OK' : '진행'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>밸런스 점검</h2>
                    <span>{operationsReport.balanceScore}%</span>
                  </div>
                  <div className="game-save-list">
                    {operationsReport.balanceRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.tone === 'good' ? '안정' : row.tone === 'watch' ? '주의' : '위험'} · {row.pct}%</span>
                          <strong>{row.label}: {row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'good' ? 'OK' : row.tone === 'watch' ? '조정' : '우선'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
    </>
  );
}
