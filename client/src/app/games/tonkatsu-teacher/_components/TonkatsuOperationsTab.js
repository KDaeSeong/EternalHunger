import { SmallStat } from '../../_components/GamePlayPrimitives';

export default function TonkatsuOperationsTab(props) {
  const {
    operationsReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운영 상태</h2>
                    <span>{operationsReport.headline} · {operationsReport.riskLabel}</span>
                  </div>
                  <div className="games-rank-split">
                    {operationsReport.businessRows.map((row) => (
                      <SmallStat label={row.label} value={row.value} key={row.label} />
                    ))}
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {operationsReport.recommendations.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.priority === 'high' ? '우선' : item.priority === 'medium' ? '추천' : '보조'}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>주요 지표</h2>
                    <span>제작 · 성장 · 전투</span>
                  </div>
                  <div className="games-rank-split">
                    {[...operationsReport.kitchenRows, ...operationsReport.growthRows, ...operationsReport.battleRows].map((row) => (
                      <SmallStat label={row.label} value={row.value} key={`${row.label}-${row.value}`} />
                    ))}
                  </div>
                </section>
              </section>
    </>
  );
}
