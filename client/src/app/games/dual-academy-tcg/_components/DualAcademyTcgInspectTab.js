export default function DualAcademyTcgInspectTab(props) {
  const {
    openZoneView,
    zoneInspection,
  } = props;

  return (
    <section className="tcg-layout is-single">
              <aside className="tcg-panel">
                <h2>전장 검사</h2>
                <section className={`tcg-event-callout is-${zoneInspection.boardDelta < -250 ? 'red' : zoneInspection.boardDelta > 250 ? 'green' : 'violet'}`}>
                  <span>{zoneInspection.badge} · 보드 차이 {zoneInspection.boardDelta >= 0 ? '+' : ''}{zoneInspection.boardDelta}</span>
                  <strong>{zoneInspection.headline}</strong>
                  <p>몬스터, 마함, 필드 카드, LP, 덱/묘지 자원을 한 번에 비교합니다.</p>
                </section>
                <div className="game-save-list">
                  {zoneInspection.sideRows.map((row) => (
                    <article className="game-save-row" key={row.label}>
                      <div>
                        <span>LP {row.lp} · 덱 {row.deck} · 패 {row.hand} · 묘지 {row.grave}</span>
                        <strong>{row.label}: {row.strongestName}</strong>
                        <small>
                          몬스터 {row.monsters}/5 · 마함 {row.backrow}/5 · 빈 칸 {row.openMonster}/{row.openSpellTrap} · {row.fieldName}
                        </small>
                      </div>
                      <strong>{row.power}</strong>
                    </article>
                  ))}
                </div>
              </aside>
              <aside className="tcg-panel">
                <h2>우선 확인</h2>
                <div className="game-save-list">
                  {zoneInspection.focusRows.map((row, index) => (
                    <article className="game-save-row" key={row.id}>
                      <div>
                        <span>{row.kind} · {row.level === 'high' ? '우선' : '검토'} · {index + 1}</span>
                        <strong>{row.title}</strong>
                        <small>{row.detail}</small>
                      </div>
                      <strong>{row.level}</strong>
                    </article>
                  ))}
                </div>
              </aside>
              <aside className="tcg-panel">
                <h2>존 빠른 보기</h2>
                <div className="game-save-list">
                  {zoneInspection.archiveRows.map((row) => (
                    <article className="game-save-row" key={row.id}>
                      <div>
                        <span>{row.count}장 · {row.reveal ? '공개' : '비공개'}</span>
                        <strong>{row.label}</strong>
                        <small>{row.preview}</small>
                      </div>
                      <button type="button" onClick={() => openZoneView(row.player, row.zone, row.reveal)}>
                        보기
                      </button>
                    </article>
                  ))}
                </div>
              </aside>
            </section>
  );
}
