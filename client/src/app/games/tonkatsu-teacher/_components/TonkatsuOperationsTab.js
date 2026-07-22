import { SmallStat } from '../../_components/GamePlayPrimitives';
import { TonkatsuIconRow, TonkatsuPanelTitle } from './TonkatsuVisuals';

export default function TonkatsuOperationsTab(props) {
  const {
    operationsReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <TonkatsuPanelTitle action="tonkatsu-service" title="운영 상태" meta={`${operationsReport.headline} · ${operationsReport.riskLabel}`} />
                  <div className="games-rank-split">
                    {operationsReport.businessRows.map((row) => (
                      <SmallStat label={row.label} value={row.value} key={row.label} />
                    ))}
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {operationsReport.recommendations.map((item) => (
                      <TonkatsuIconRow action={item.priority === 'high' ? 'warning' : 'advisor'} label={item.title} key={item.id}>
                        <div>
                          <span>{item.priority === 'high' ? '우선' : item.priority === 'medium' ? '추천' : '보조'}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <TonkatsuPanelTitle action="analysis" title="주요 지표" meta="제작 · 성장 · 전투" />
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
