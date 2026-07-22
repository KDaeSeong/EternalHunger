import { SmallStat } from '../../_components/GamePlayPrimitives';
import TonkatsuMethodStrip from './TonkatsuMethodStrip';
import { TonkatsuIconRow, TonkatsuPanelTitle } from './TonkatsuVisuals';

export default function TonkatsuProductionTab(props) {
  const {
    methodRows,
    productionReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <TonkatsuPanelTitle action="tonkatsu-opening" title="현재 장면" meta={productionReport.phase} />
                  <div className="games-rank-split">
                    <SmallStat label="연출 점수" value={`${productionReport.productionScore}%`} />
                    <SmallStat label="장면 수" value={productionReport.sceneCues.length} />
                    <SmallStat label="이벤트" value={productionReport.eventRows.length} />
                    <SmallStat label="사운드 큐" value={productionReport.soundCues.length} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {productionReport.sceneCues.map((row) => (
                      <TonkatsuIconRow action={row.tone === 'ready' ? 'tonkatsu-opening' : 'effect'} label={row.title} key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '준비' : '세팅'}</strong>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel tonkatsu-method-panel">
                  <TonkatsuPanelTitle action="tonkatsu-growth" title="조리 숙련도" meta={`${methodRows.filter((row) => row.level > 0).length}/${methodRows.length} 숙련 시작`} />
                  <TonkatsuMethodStrip rows={methodRows} compact />
                </section>
                <section className="games-panel">
                  <TonkatsuPanelTitle action="tonkatsu-contest" title="장기 이벤트 변형" meta="영업 · 전투 · 심사" />
                  <div className="game-save-list">
                    {productionReport.eventRows.map((row) => (
                      <TonkatsuIconRow action={row.tone === 'ready' ? 'tonkatsu-contest' : 'tonkatsu-setback'} label={row.title} key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '발동권' : '준비중'}</strong>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <TonkatsuPanelTitle action="audio" title="사운드 큐" meta={`${productionReport.soundCues.length}개`} />
                  <div className="game-save-list">
                    {productionReport.soundCues.map((cue) => (
                      <TonkatsuIconRow action="audio" label={cue.cue} key={cue.id}>
                        <div>
                          <span>{cue.target}</span>
                          <strong>{cue.cue}</strong>
                          <small>{cue.detail}</small>
                        </div>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <TonkatsuPanelTitle action="advisor" title="다음 연출 포인트" meta="추천" />
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
