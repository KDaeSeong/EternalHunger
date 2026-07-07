export default function RacingLogosMatrixTab(props) {
  const {
    packMatrix,
  } = props;

  return (
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>로컬팩 매트릭스</h2>
                  <span>{packMatrix.totals.completed}/{packMatrix.totals.rows}</span>
                </div>
                <div className="game-save-list">
                  {packMatrix.rows.map((row) => (
                    <article className="game-save-row" key={row.id}>
                      <div>
                        <span>{row.kindLabel} / {row.requiredKey}</span>
                        <strong>{row.name}</strong>
                        <small>{row.logoKeyPath} · logoKey: {row.logoKey}</small>
                        <small>{row.candidateText}</small>
                      </div>
                      <span className="game-save-chip">{row.status}</span>
                    </article>
                  ))}
                </div>
              </section>
  );
}
