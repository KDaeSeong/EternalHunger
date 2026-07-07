import { GameFeatureTabs } from '../../_components/GamePlayShell';
import { SmallStat } from '../../_components/GamePlayPrimitives';
import { BattlePanel, CardSummary, DeckEntryLine, Field, ZoneExplorer } from './BaVanguardBoard';
import {
  CIRCLES,
  PRESET_DECKS,
  SIDE_LABELS,
  cardName,
  getCard,
} from '../_lib/baVanguardCatalog';

export default function BaVanguardFeatureTabs(props) {
  const {
    autoGuardMe,
    canControl,
    canMulligan,
    compositionRows,
    concurrencyAudit,
    deck,
    deckReport,
    downloadReplayExport,
    duel,
    gzoneFilter,
    markRoomDirty,
    matchupReport,
    me,
    nextPhase,
    onAutoRide,
    onCallSelected,
    onGGuard,
    onGuardAdd,
    onGuardEnd,
    onMulligan,
    onMyCircleClick,
    onOppCircleClick,
    onRetire,
    onRideSelected,
    onStride,
    onVCAct,
    openZone,
    openingHand,
    openingStats,
    opp,
    opponentPresetId,
    opponentValidation,
    portingCoverage,
    presetId,
    replayExport,
    replayReport,
    rules,
    runAiUntilStop,
    seed,
    selectedAttacker,
    selectedHandId,
    selectedHandIndex,
    setAutoGuardMe,
    setGzoneFilter,
    setOpponentPresetId,
    setPresetId,
    setRuleOption,
    setSeed,
    setSelectedHandIndex,
    setZoneView,
    startNewDuel,
    summary,
    tacticalReport,
    tacticalTone,
    valid,
    validation,
    visibleCards,
    zoneView,
  } = props;

  return (
      <GameFeatureTabs
        tabs={[
          {
            id: 'duel',
            label: '듀얼 진행',
            badge: duel.phase,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>플레이 설정</h2>
            <span>{deck.clan}</span>
          </div>
          <label className="game-save-json-field">
            <span>내 프리셋</span>
            <select value={presetId} onChange={(event) => {
              markRoomDirty();
              setPresetId(event.target.value);
            }}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>AI 프리셋</span>
            <select value={opponentPresetId} onChange={(event) => {
              markRoomDirty();
              setOpponentPresetId(event.target.value);
            }}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>시드</span>
            <input value={seed} onChange={(event) => {
              markRoomDirty();
              setSeed(Number(event.target.value) || 0);
            }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
            <input type="checkbox" checked={autoGuardMe} onChange={(event) => {
              markRoomDirty();
              setAutoGuardMe(event.target.checked);
            }} />
            내 방어 자동 처리
          </label>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.allowMixedClan} onChange={(event) => setRuleOption('allowMixedClan', event.target.checked)} />
              학원(클랜) 혼합 허용
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.firstTurnNoDraw} onChange={(event) => setRuleOption('firstTurnNoDraw', event.target.checked)} />
              선공 1턴 드로우/공격 제한
            </label>
            <p style={{ margin: 0, color: '#94a3b8', fontWeight: 800, lineHeight: 1.45 }}>
              룰 옵션은 덱 검증과 새 듀얼 시작부터 적용됩니다.
            </p>
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => startNewDuel(seed)}>설정으로 재시작</button>
            <button type="button" onClick={runAiUntilStop}>AI 진행</button>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진행 컨트롤</h2>
            <span>{duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례`}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="선공 제한" value={rules.firstTurnNoDraw ? 'ON' : 'OFF'} />
            <SmallStat label="혼합 클랜" value={rules.allowMixedClan ? '허용' : '금지'} />
            <SmallStat label="패" value={`${me.hand.length}/${opp.hand.length}`} />
            <SmallStat label="덱" value={`${me.deck.length}/${opp.deck.length}`} />
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={nextPhase} disabled={Boolean(duel.winner || duel.battle)}>다음 페이즈</button>
            <button type="button" onClick={onMulligan} disabled={!canMulligan}>멀리건</button>
            <button type="button" onClick={onAutoRide} disabled={!canControl || duel.phase !== 'MAIN'}>자동 라이드</button>
            <button type="button" onClick={onStride} disabled={!canControl || duel.phase !== 'MAIN'}>스트라이드</button>
            <button type="button" onClick={onVCAct} disabled={!canControl || duel.phase !== 'MAIN'}>VC 스킬</button>
          </div>
          {selectedAttacker ? <p style={{ color: '#cbd5e1', fontWeight: 800 }}>공격자 {selectedAttacker} 선택 중입니다. AI 필드의 목표를 누르세요.</p> : null}
        </section>

        <BattlePanel
          battle={duel.battle}
          selectedHandId={selectedHandId}
          onGuardAdd={onGuardAdd}
          onGGuard={onGGuard}
          onGuardEnd={onGuardEnd}
        />
      </section>

      <section className="games-detail-grid">
        <Field
          title="AI 필드"
          player={opp}
          side="opp"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onOppCircleClick}
          onZoneClick={openZone}
        />
        <Field
          title="내 필드"
          player={me}
          side="me"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onMyCircleClick}
          onZoneClick={openZone}
        />
      </section>

      <ZoneExplorer
        duel={duel}
        zoneView={zoneView}
        gzoneFilter={gzoneFilter}
        onFilterChange={setGzoneFilter}
        onClose={() => setZoneView(null)}
      />
              </>
            ),
          },
          {
            id: 'tactics',
            label: '전술 리포트',
            badge: tacticalReport.riskLabel,
            children: (
              <>
      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>현재 판단</h2>
            <span>{tacticalReport.phase} · {SIDE_LABELS[tacticalReport.active]}</span>
          </div>
          <section className={`tcg-event-callout is-${tacticalTone}`}>
            <span>{tacticalReport.riskLabel}</span>
            <strong>{tacticalReport.headline}</strong>
            <p>
              준비도 {tacticalReport.readinessPct}% · 데미지 차이 {tacticalReport.damageDelta >= 0 ? '+' : ''}{tacticalReport.damageDelta}
              {' · '}
              필드 {tacticalReport.fieldDelta >= 0 ? '+' : ''}{tacticalReport.fieldDelta}
            </p>
          </section>
          <div className="games-rank-split">
            <SmallStat label="내 데미지" value={`${tacticalReport.playerDamage}/6`} />
            <SmallStat label="AI 데미지" value={`${tacticalReport.enemyDamage}/6`} />
            <SmallStat label="내 덱" value={tacticalReport.playerDeck} />
            <SmallStat label="AI 덱" value={tacticalReport.enemyDeck} />
            <SmallStat label="파워 차이" value={tacticalReport.powerDelta >= 0 ? `+${tacticalReport.powerDelta}` : tacticalReport.powerDelta} />
            <SmallStat label="총 실드" value={tacticalReport.shield.totalShield.toLocaleString('ko-KR')} />
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>추천 행동</h2>
            <span>{tacticalReport.recommendedAction}</span>
          </div>
          <div className="game-save-list">
            {tacticalReport.recommendations.map((item, index) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.priority === 'high' ? '우선' : item.priority === 'low' ? '후순위' : '검토'} · {index + 1}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <strong>{item.priority}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>방어 자원</h2>
            <span>센티넬 {tacticalReport.shield.sentinels}장</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="총 실드" value={tacticalReport.shield.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="센티넬" value={tacticalReport.shield.sentinels} />
            <SmallStat label="트리거" value={tacticalReport.shield.triggers} />
            <SmallStat label="일반 유닛" value={tacticalReport.shield.normalUnits} />
          </div>
          {tacticalReport.guard ? (
            <div className="games-activity-list" style={{ marginTop: 12 }}>
              <div>
                <strong>가드 필요량 {tacticalReport.guard.guardNeeded.toLocaleString('ko-KR')}</strong>
                <span>
                  공격 {tacticalReport.guard.attackPower.toLocaleString('ko-KR')} · 기본 방어 {tacticalReport.guard.baseDefense.toLocaleString('ko-KR')} · 현재 실드 {tacticalReport.guard.currentShield.toLocaleString('ko-KR')}
                </span>
              </div>
              <div>
                <strong>{tacticalReport.guard.perfectGuard ? '퍼펙트 가드 적용됨' : '퍼펙트 가드 미적용'}</strong>
                <span>가용 패 실드 {tacticalReport.guard.availableShield.toLocaleString('ko-KR')}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
              방어 창이 열리면 필요한 실드와 가용 방어 자원을 여기서 계산합니다.
            </p>
          )}
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>공격 후보</h2>
            <span>{tacticalReport.attackCandidates.length}라인</span>
          </div>
          <div className="game-save-list">
            {tacticalReport.attackCandidates.length ? tacticalReport.attackCandidates.map((row) => (
              <article className="game-save-row" key={row.circle}>
                <div>
                  <span>{row.circle} · 부스트 {row.boostPower.toLocaleString('ko-KR')}</span>
                  <strong>{row.cardName}</strong>
                </div>
                <strong>{row.power.toLocaleString('ko-KR')}</strong>
              </article>
            )) : (
              <article className="game-save-row">
                <div>
                  <span>공격 후보 없음</span>
                  <strong>배틀 페이즈나 스탠드 상태를 확인하세요.</strong>
                </div>
                <strong>-</strong>
              </article>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>현재 전장 요약</h2>
            <span>{duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례`}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="내 패" value={me.hand.length} />
            <SmallStat label="AI 패" value={opp.hand.length} />
            <SmallStat label="내 드롭" value={me.drop.length} />
            <SmallStat label="AI 드롭" value={opp.drop.length} />
            <SmallStat label="내 G존" value={me.gzone.length} />
            <SmallStat label="AI G존" value={opp.gzone.length} />
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'hand',
            label: '패/로그',
            badge: `${me.hand.length}장`,
            children: (
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
            <button type="button" onClick={onRideSelected} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>라이드</button>
            {CIRCLES.filter((circle) => circle !== 'VC' && !me.circles[circle]).map((circle) => (
              <button type="button" key={circle} onClick={() => onCallSelected(circle)} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>{circle} 콜</button>
            ))}
          </div>
          <div className="game-save-actions" style={{ marginTop: 8 }}>
            {CIRCLES.filter((circle) => circle !== 'VC' && me.circles[circle]).map((circle) => (
              <button type="button" key={circle} onClick={() => onRetire(circle)} disabled={!canControl || duel.phase !== 'MAIN'}>{circle} 퇴각</button>
            ))}
          </div>
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
            <button type="button" onClick={downloadReplayExport}>JSON 리플레이 다운로드</button>
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
            ),
          },
          {
            id: 'deck',
            label: '덱 분석',
            badge: valid ? '검증 통과' : '오류',
            children: (
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>검증</h2>
            <span>{valid ? '통과' : '오류 있음'}</span>
          </div>
          <div className="games-activity-list">
            {validation.errors.length ? validation.errors.map((row) => <div key={row}><strong>{row}</strong></div>) : <div><strong>내 덱 필수 규칙 오류가 없습니다.</strong></div>}
            {validation.warnings.map((row) => <div key={row}><strong>{row}</strong></div>)}
            {opponentValidation.errors.map((row) => <div key={`opp-${row}`}><strong>AI: {row}</strong></div>)}
            {opponentValidation.warnings.map((row) => <div key={`opp-w-${row}`}><strong>AI: {row}</strong></div>)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>오프닝 핸드</h2>
            <span>Seed {seed}</span>
          </div>
          <div className="game-save-list">
            {openingHand.map((cardId, index) => <CardSummary cardId={cardId} key={`${cardId}-${index}`} right={`G${getCard(cardId)?.grade ?? '-'}`} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>덱 요약</h2>
            <span>{summary.mainCount}/{rules.mainSize}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평균 파워" value={summary.averagePower.toLocaleString('ko-KR')} />
            <SmallStat label="실드 총합" value={summary.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="G3" value={summary.grade3Count} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{deck.description}</p>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>매치업 실험실</h2>
            <span>{matchupReport.samples ? `${matchupReport.samples}판 자동 실험` : '대기'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="승률" value={`${matchupReport.winRate}%`} />
            <SmallStat label="전적" value={`${matchupReport.wins}승 ${matchupReport.losses}패`} />
            <SmallStat label="평균 턴" value={matchupReport.averageTurn} />
            <SmallStat label="선공 승률" value={`${matchupReport.firstWinRate}%`} />
            <SmallStat label="후공 승률" value={`${matchupReport.secondWinRate}%`} />
            <SmallStat label="평균 피해" value={`${matchupReport.averageMeDamage}/${matchupReport.averageOppDamage}`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {matchupReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
          {matchupReport.rows.length ? (
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {matchupReport.rows.slice(0, 4).map((row) => (
                <article className="game-save-row" key={row.index}>
                  <div>
                    <span>{row.first === 'me' ? '내 선공' : 'AI 선공'} · {row.turn}턴</span>
                    <strong>{row.winner === 'me' ? '승리' : row.winner === 'opp' ? '패배' : '미결'}</strong>
                    <small>피해 {row.meDamage}/{row.oppDamage} · 덱 {row.meDeck}/{row.oppDeck}</small>
                  </div>
                  <strong>#{row.index}</strong>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>덱 분석</h2>
            <span>{openingStats.samples}회 샘플</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="G1 확보" value={`${openingStats.grade1Rate}%`} />
            <SmallStat label="G2 확보" value={`${openingStats.grade2Rate}%`} />
            <SmallStat label="G3 확보" value={`${openingStats.grade3Rate}%`} />
            <SmallStat label="라인 완성" value={`${openingStats.rideLineRate}%`} />
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="센티넬" value={`${openingStats.sentinelRate}%`} />
            <SmallStat label="평균 트리거" value={openingStats.triggerAverage} />
            <SmallStat label="평균 실드" value={openingStats.shieldAverage.toLocaleString('ko-KR')} />
            <SmallStat label="평균 파워" value={openingStats.powerAverage.toLocaleString('ko-KR')} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {deckReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>구성표</h2>
            <span>{compositionRows.length}개 묶음</span>
          </div>
          <div className="game-save-list">
            {compositionRows.map((row) => (
              <article className="game-save-row" key={row.key}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.count}장</strong>
                  <small>평균 파워 {row.averagePower.toLocaleString('ko-KR')} · 실드 합계 {row.shieldTotal.toLocaleString('ko-KR')}</small>
                </div>
                <strong>{row.zoneLabel}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>메인 덱</h2>
            <span>{summary.mainCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.main.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>G존</h2>
            <span>{summary.gCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.gzone.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>카드 라이브러리</h2>
            <span>{visibleCards.length}장</span>
          </div>
          <div className="game-save-list">
            {visibleCards.map((card) => <CardSummary cardId={card.id} key={card.id} />)}
          </div>
        </section>
      </section>
              </>
            ),
          },
        ]}
      />
  );
}
