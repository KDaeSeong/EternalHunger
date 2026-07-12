import { GameControlButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { CardSummary } from './BaVanguardBoard';
import { CIRCLES, cardName } from '../_lib/baVanguardCatalog';

export default function BaVanguardHandLogTab(props) {
  const {
    canControl,
    concurrencyAudit,
    downloadReplayExport,
    duel,
    me,
    onCallSelected,
    onRetire,
    onRideSelected,
    portingCoverage,
    replayExport,
    replayReport,
    recentDuelText,
    resultPresentation,
    selectedHandId,
    selectedHandIndex,
    setSelectedHandIndex,
  } = props;

  return (
    <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>내 패</h2>
            <span>{me.hand.length}장</span>
          </div>
          <div className="game-save-list">
            {me.hand.length ? me.hand.map((cardId, index) => (
              <CardSummary
                cardId={cardId}
                key={`${cardId}-${index}`}
                active={selectedHandIndex === index}
                right={selectedHandIndex === index ? '선택' : undefined}
                onClick={() => setSelectedHandIndex((current) => (current === index ? null : index))}
              />
            )) : <div className="game-save-row"><div><strong>패가 없습니다.</strong></div><strong>-</strong></div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>패 액션</h2>
            <span>{selectedHandId ? cardName(selectedHandId) : '미선택'}</span>
          </div>
          {selectedHandId ? <CardSummary cardId={selectedHandId} /> : <p style={{ color: '#cbd5e1', fontWeight: 800 }}>패에서 카드를 선택하세요.</p>}
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <GameControlButton action="vanguard-ride" cue="off" onClick={onRideSelected} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>라이드</GameControlButton>
            {CIRCLES.filter((circle) => circle !== 'VC' && !me.circles[circle]).map((circle) => (
              <GameControlButton action="vanguard-call" cue="off" key={circle} onClick={() => onCallSelected(circle)} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>{circle} 콜</GameControlButton>
            ))}
          </div>
          <div className="game-save-actions" style={{ marginTop: 8 }}>
            {CIRCLES.filter((circle) => circle !== 'VC' && me.circles[circle]).map((circle) => (
              <GameControlButton action="vanguard-retire" cue="off" key={circle} onClick={() => onRetire(circle)} disabled={!canControl || duel.phase !== 'MAIN'}>{circle} 퇴각</GameControlButton>
            ))}
          </div>
          <RecentActionResult
            action={resultPresentation.action}
            label={resultPresentation.label}
            text={recentDuelText}
            tone={resultPresentation.tone}
          />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>리플레이 흐름</h2>
            <span>{replayReport.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="로그" value={replayReport.logCount} />
            <SmallStat label="턴" value={replayReport.turnCount} />
            <SmallStat label="데미지 차이" value={replayReport.damageSwing >= 0 ? `+${replayReport.damageSwing}` : replayReport.damageSwing} />
            <SmallStat label="내 공격" value={replayReport.meAttackCount} />
            <SmallStat label="AI 공격" value={replayReport.oppAttackCount} />
            <SmallStat label="가드" value={`${replayReport.meGuardCount}/${replayReport.oppGuardCount}`} />
          </div>
          <div className="games-activity-list" style={{ marginBottom: 12 }}>
            <div>
              <strong>{replayExport.fileName}</strong>
              <span>{replayExport.format} · {replayExport.sizeLabel} · {replayExport.statusLabel}</span>
            </div>
            <GameControlButton action="vanguard-replay" cue="off" onClick={downloadReplayExport}>JSON 리플레이 다운로드</GameControlButton>
          </div>
          <div className="game-save-list" style={{ marginBottom: 12 }}>
            {replayExport.auditRows.map((row) => (
              <article className="game-save-row" key={`vg-replay-export-${row.id}`}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.detail}</strong>
                </div>
                <strong>{row.status}</strong>
              </article>
            ))}
          </div>
          <section className={`tcg-event-callout is-${portingCoverage.ready && concurrencyAudit.ready ? 'green' : 'gold'}`} style={{ marginBottom: 12 }}>
            <span>이식 감사 · 카드 {portingCoverage.completionPct}% · 방 {concurrencyAudit.completionPct}%</span>
            <strong>{portingCoverage.headline}</strong>
            <p>{concurrencyAudit.headline}</p>
          </section>
          <div className="game-save-list" style={{ marginBottom: 12 }}>
            {portingCoverage.typeRows.map((row) => (
              <article className="game-save-row" key={`vg-port-type-${row.type}`}>
                <div>
                  <span>{row.label} · {row.covered}/{row.total}</span>
                  <strong>{row.detail}</strong>
                </div>
                <strong>{row.status}</strong>
              </article>
            ))}
          </div>
          <div className="game-save-list" style={{ marginBottom: 12 }}>
            {concurrencyAudit.rows.map((row) => (
              <article className="game-save-row" key={`vg-room-audit-${row.id}`}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.detail}</strong>
                </div>
                <strong>{row.status}</strong>
              </article>
            ))}
          </div>
          <div className="games-activity-list" style={{ marginBottom: 12 }}>
            {replayReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
          {replayReport.guardAudit ? (
            <div className="game-save-list" style={{ marginBottom: 12 }}>
              <article className="game-save-row">
                <div>
                  <span>{replayReport.guardAudit.defenderLabel} 방어 · {replayReport.guardAudit.attackerCircle} 공격</span>
                  <strong>
                    필요 실드 {replayReport.guardAudit.guardNeeded.toLocaleString('ko-KR')}
                    {' · '}
                    {replayReport.guardAudit.canGuard ? '방어 가능권' : '방어 부족'}
                  </strong>
                  <small>
                    공격 {replayReport.guardAudit.attackPower.toLocaleString('ko-KR')}
                    {' / '}
                    기본 {replayReport.guardAudit.baseDefense.toLocaleString('ko-KR')}
                    {' / '}
                    현재 실드 {replayReport.guardAudit.guardShield.toLocaleString('ko-KR')}
                    {' / '}
                    가용 {replayReport.guardAudit.availableShield.toLocaleString('ko-KR')}
                    {' / '}
                    센티넬 {replayReport.guardAudit.sentinels}
                  </small>
                </div>
                <strong>{replayReport.guardAudit.perfectGuard ? 'PG' : 'GUARD'}</strong>
              </article>
            </div>
          ) : null}
          <div className="game-save-list">
            {replayReport.turnRows.slice(0, 5).map((row) => (
              <article className="game-save-row" key={`vg-replay-${row.turn}`}>
                <div>
                  <span>T{row.turn} · {row.summary}</span>
                  <strong>템포 {row.tempoDelta >= 0 ? '+' : ''}{row.tempoDelta} · 압박 {row.guardPressure >= 0 ? '+' : ''}{row.guardPressure}</strong>
                  <small>
                    {row.highlights.length
                      ? row.highlights.map((item) => item.label).join(' / ')
                      : '하이라이트 없음'}
                  </small>
                </div>
                <strong>{row.decisive ? '결정' : row.hits ? '히트' : '진행'}</strong>
              </article>
            ))}
          </div>
          <label className="game-save-json-field" style={{ marginTop: 12 }}>
            <span>리플레이 JSON 미리보기</span>
            <textarea readOnly value={replayExport.previewText} rows={8} />
          </label>
          {replayReport.exportText ? (
            <label className="game-save-json-field" style={{ marginTop: 12 }}>
              <span>리플레이 요약</span>
              <textarea readOnly value={replayReport.exportText} rows={5} />
            </label>
          ) : null}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로그</h2>
            <span>최근 {Math.min(duel.log.length, 80)}개</span>
          </div>
          <div className="games-activity-list">
            {duel.log.slice(0, 80).map((row, index) => (
              <div key={`${row}-${index}`}><strong>{row}</strong></div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
