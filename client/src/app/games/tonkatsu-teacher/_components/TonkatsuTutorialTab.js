import { TonkatsuIconRow, TonkatsuPanelTitle } from './TonkatsuVisuals';

export default function TonkatsuTutorialTab(props) {
  const {
    operationsReport,
  } = props;

  return (
    <>
              <section className="games-dashboard">
                <section className="games-panel">
                  <TonkatsuPanelTitle action="guide" title="초반 체크리스트" meta={`${operationsReport.tutorialPct}%`} />
                  <div className="game-save-list">
                    {operationsReport.tutorialRows.map((row) => (
                      <TonkatsuIconRow action={row.done ? 'complete' : 'guide'} label={row.title} key={row.id}>
                        <div>
                          <span>{row.done ? '완료' : `${row.progressPct}%`}</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                          <small>{row.actionHint}</small>
                        </div>
                        <strong>{row.done ? 'OK' : '진행'}</strong>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <TonkatsuPanelTitle action="analysis" title="밸런스 점검" meta={`${operationsReport.balanceScore}%`} />
                  <div className="game-save-list">
                    {operationsReport.balanceRows.map((row) => (
                      <TonkatsuIconRow action={row.tone === 'good' ? 'complete' : row.tone === 'watch' ? 'analysis' : 'warning'} label={row.label} key={row.id}>
                        <div>
                          <span>{row.tone === 'good' ? '안정' : row.tone === 'watch' ? '주의' : '위험'} · {row.pct}%</span>
                          <strong>{row.label}: {row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'good' ? 'OK' : row.tone === 'watch' ? '조정' : '우선'}</strong>
                      </TonkatsuIconRow>
                    ))}
                  </div>
                </section>
              </section>
    </>
  );
}
