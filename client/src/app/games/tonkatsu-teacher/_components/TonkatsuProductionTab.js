import { SmallStat } from '../../_components/GamePlayPrimitives';

export default function TonkatsuProductionTab(props) {
  const {
    productionReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>현재 장면</h2>
                    <span>{productionReport.phase}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="연출 점수" value={`${productionReport.productionScore}%`} />
                    <SmallStat label="장면 수" value={productionReport.sceneCues.length} />
                    <SmallStat label="이벤트" value={productionReport.eventRows.length} />
                    <SmallStat label="사운드 큐" value={productionReport.soundCues.length} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {productionReport.sceneCues.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '준비' : '세팅'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>장기 이벤트 변형</h2>
                    <span>영업 · 전투 · 심사</span>
                  </div>
                  <div className="game-save-list">
                    {productionReport.eventRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '발동권' : '준비중'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>사운드 큐</h2>
                    <span>{productionReport.soundCues.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {productionReport.soundCues.map((cue) => (
                      <article className="game-save-row" key={cue.id}>
                        <div>
                          <span>{cue.target}</span>
                          <strong>{cue.cue}</strong>
                          <small>{cue.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>다음 연출 포인트</h2>
                    <span>추천</span>
                  </div>
                  <div className="games-activity-list">
                    {productionReport.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
              </section>
    </>
  );
}
