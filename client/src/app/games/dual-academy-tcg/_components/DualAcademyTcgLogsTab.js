import {
  ZoneArchivePanel,
} from './TcgPlayBoard';

export default function DualAcademyTcgLogsTab(props) {
  const {
    concurrencyAudit,
    downloadReplayExport,
    effectCoverage,
    latestCharacter,
    latestQuote,
    matchReport,
    replayExport,
    replayTimeline,
    setZoneView,
    state,
    zoneView,
  } = props;

  return (
    <>
            <section className="tcg-layout is-single">
              <aside className="tcg-panel">
                <h2>매치 리포트</h2>
                <section className={`tcg-event-callout is-${state.winner === 'enemy' ? 'red' : state.winner === 'player' ? 'green' : 'gold'}`}>
                  <span>{matchReport.winnerLabel}</span>
                  <strong>{matchReport.headline}</strong>
                  <p>이벤트 {matchReport.eventCount}건 · LP 차이 {matchReport.lpDiff >= 0 ? '+' : ''}{matchReport.lpDiff}</p>
                </section>
                <dl className="tcg-small-stats">
                  <div>
                    <dt>내 템포</dt>
                    <dd>{matchReport.players.player.tempoScore}</dd>
                  </div>
                  <div>
                    <dt>AI 템포</dt>
                    <dd>{matchReport.players.enemy.tempoScore}</dd>
                  </div>
                  <div>
                    <dt>내 누적 피해</dt>
                    <dd>{matchReport.players.player.damageDealt}</dd>
                  </div>
                  <div>
                    <dt>AI 누적 피해</dt>
                    <dd>{matchReport.players.enemy.damageDealt}</dd>
                  </div>
                </dl>
                <div className="game-save-list">
                  {matchReport.recommendations.map((line, index) => (
                    <article className="game-save-row" key={`tcg-report-rec-${index}`}>
                      <div>
                        <span>권장 플레이</span>
                        <strong>{line}</strong>
                      </div>
                      <strong>{index + 1}</strong>
                    </article>
                  ))}
                </div>
                <section className="tcg-event-callout is-violet">
                  <span>{replayTimeline.chainStatus}</span>
                  <strong>{replayTimeline.headline}</strong>
                  <p>
                    턴 {replayTimeline.turnCount}개 · 내 피해 {replayTimeline.playerDamage}
                    {' / '}
                    AI 피해 {replayTimeline.enemyDamage}
                    {' · '}
                    효과 발동 {replayTimeline.chainActivations}회
                  </p>
                </section>
                <section className={`tcg-event-callout is-${replayExport.ready ? 'green' : 'gold'}`}>
                  <span>{replayExport.format} · {replayExport.sizeLabel}</span>
                  <strong>{replayExport.fileName}</strong>
                  <p>이벤트 {replayExport.eventCount}건 · 턴 {replayExport.turnCount}개 · {replayExport.statusLabel}</p>
                  <button type="button" onClick={downloadReplayExport}>JSON 리플레이 다운로드</button>
                </section>
                <div className="game-save-list">
                  {replayExport.auditRows.map((row) => (
                    <article className="game-save-row" key={`tcg-replay-audit-${row.id}`}>
                      <div>
                        <span>{row.label}</span>
                        <strong>{row.detail}</strong>
                      </div>
                      <strong>{row.status}</strong>
                    </article>
                  ))}
                </div>
                <section className={`tcg-event-callout is-${effectCoverage.ready && concurrencyAudit.ready ? 'green' : 'gold'}`}>
                  <span>이식 감사 · 효과 {effectCoverage.completionPct}% · 방 {concurrencyAudit.completionPct}%</span>
                  <strong>{effectCoverage.headline}</strong>
                  <p>{concurrencyAudit.headline}</p>
                </section>
                <div className="game-save-list">
                  {effectCoverage.rows.slice(0, 8).map((row) => (
                    <article className="game-save-row" key={`tcg-effect-audit-${row.id}`}>
                      <div>
                        <span>{row.type} · {row.effect}</span>
                        <strong>{row.name}</strong>
                        <small>{row.detail}</small>
                      </div>
                      <strong>{row.status}</strong>
                    </article>
                  ))}
                </div>
                <div className="game-save-list">
                  {concurrencyAudit.rows.map((row) => (
                    <article className="game-save-row" key={`tcg-room-audit-${row.id}`}>
                      <div>
                        <span>{row.label}</span>
                        <strong>{row.detail}</strong>
                      </div>
                      <strong>{row.status}</strong>
                    </article>
                  ))}
                </div>
                <div className="game-save-list">
                  {replayTimeline.recommendations.map((line, index) => (
                    <article className="game-save-row" key={`tcg-replay-rec-${index}`}>
                      <div>
                        <span>리플레이 점검</span>
                        <strong>{line}</strong>
                      </div>
                      <strong>{index + 1}</strong>
                    </article>
                  ))}
                </div>
                {replayTimeline.chainAuditRows.length ? (
                  <div className="game-save-list">
                    {replayTimeline.chainAuditRows.map((row) => (
                      <article className="game-save-row" key={`tcg-chain-${row.order}-${row.cardName}`}>
                        <div>
                          <span>체인 {row.order} · {row.ownerLabel} · {row.source}</span>
                          <strong>{row.cardName}</strong>
                          <small>{row.effect}{row.negated ? ' · 무효화됨' : ''}</small>
                        </div>
                        <strong>{row.negated ? '무효' : '대기'}</strong>
                      </article>
                    ))}
                  </div>
                ) : null}
                <div className="game-save-list">
                  {replayTimeline.turnRows.slice(0, 5).map((row) => (
                    <article className="game-save-row" key={`tcg-replay-turn-${row.turn}`}>
                      <div>
                        <span>T{row.turn} · {row.phases} · {row.swingLabel}</span>
                        <strong>이벤트 {row.eventCount}건 · 템포 {row.tempoDelta >= 0 ? '+' : ''}{row.tempoDelta}</strong>
                        <small>
                          {row.highlights.length
                            ? row.highlights.map((item) => item.label).join(' / ')
                            : '하이라이트 없음'}
                        </small>
                      </div>
                      <strong>{row.swing >= 0 ? `+${row.swing}` : row.swing}</strong>
                    </article>
                  ))}
                </div>
                <label className="game-save-json-field">
                  <span>리플레이 JSON 미리보기</span>
                  <textarea readOnly value={replayExport.previewText} rows={8} />
                </label>
                {replayTimeline.exportText ? (
                  <label className="game-save-json-field">
                    <span>리플레이 요약</span>
                    <textarea readOnly value={replayTimeline.exportText} rows={5} />
                  </label>
                ) : null}
                {matchReport.highlights.length ? (
                  <div className="game-save-list">
                    {matchReport.highlights.slice(0, 4).map((line, index) => (
                      <article className="game-save-row" key={`tcg-report-hi-${index}`}>
                        <div>
                          <span>하이라이트</span>
                          <strong>{line}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </aside>
              <aside className="tcg-panel tcg-log">
              <h2>v13 이벤트</h2>
              <section className={`tcg-event-callout is-${latestCharacter.tone}`}>
                <span>{latestCharacter.academy}</span>
                <strong>{latestCharacter.name}</strong>
                <p>{latestQuote}</p>
              </section>
              <ol>
                {(state.events || []).slice(0, 12).map((event) => (
                  <li key={event.id}>
                    T{event.turn} · {event.phase} · {event.type} · {event.text}
                  </li>
                ))}
                {!(state.events || []).length ? <li>아직 이벤트가 없습니다.</li> : null}
              </ol>
              <h2>로그</h2>
              <ol>
                {state.log.slice(0, 16).map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ol>
            </aside>
            </section>

          <ZoneArchivePanel
            state={state}
            zoneView={zoneView}
            onClose={() => setZoneView(null)}
          />
            </>
  );
}
