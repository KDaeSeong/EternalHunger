import {
  activateFieldIgnition,
  activateHinaIgnition,
  activateSetCard,
  activateYuukaQuick,
  advancePhase,
  autoPlayPlayer,
  changeMonsterPosition,
  chooseTarget,
  declareAttack,
  normalSummon,
  passResponse,
  resolveChain,
  setSpellTrap,
} from '../_lib/tcgDuelEngine';
import {
  KeywordBadges,
  PlayerField,
  ZoneArchivePanel,
  cardAtk,
  cardKind,
  subType,
} from './TcgPlayBoard';

export default function DualAcademyTcgFeatureTabs(props) {
  const {
    act,
    activeTcgTab,
    advisorTone,
    canAct,
    canAutoPlayPlayer,
    canMain,
    concurrencyAudit,
    deckMessage,
    deckName,
    downloadReplayExport,
    effectCoverage,
    latestCharacter,
    latestQuote,
    loadingDeck,
    matchReport,
    monsterEffectRows,
    openZoneView,
    playSelected,
    promptTargets,
    replayExport,
    replayTimeline,
    selectedAttacker,
    selectedCard,
    selectedHandId,
    setActiveTcgTab,
    setSelectedAttacker,
    setSelectedHandId,
    setState,
    setZoneView,
    state,
    turnAdvisor,
    zoneInspection,
    zoneView,
  } = props;

  return (
    <>
      <section className="tcg-feature-tabs" role="tablist" aria-label="TCG 기능">
        {[
          { id: 'board', label: '보드', badge: state.phase },
          { id: 'advisor', label: '턴 판단', badge: turnAdvisor.riskLabel },
          { id: 'inspect', label: '존 검사', badge: zoneInspection.badge },
          { id: 'hand', label: '패/액션', badge: `${state.players.player.hand.length}장` },
          { id: 'logs', label: '로그/아카이브', badge: replayExport.statusLabel },
        ].map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTcgTab === tab.id}
            className={activeTcgTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => setActiveTcgTab(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.badge}</strong>
          </button>
        ))}
      </section>

      {activeTcgTab === 'board' ? (
        <section className="tcg-layout">
        <aside className="tcg-panel">
          <h2>덱</h2>
          <p className="tcg-deck-name">{loadingDeck ? '덱 불러오는 중' : deckName}</p>
          {deckMessage ? <p className="tcg-deck-message">{deckMessage}</p> : null}
          <div className="tcg-deck-count">
            <strong>{state.players.player.deck.length}</strong>
            <span>남은 카드</span>
          </div>
          <dl className="tcg-small-stats">
            <div>
              <dt>내 묘지</dt>
              <dd>{state.players.player.grave.length}</dd>
            </div>
            <div>
              <dt>내 제외</dt>
              <dd>{state.players.player.banished.length}</dd>
            </div>
            <div>
              <dt>v13 이벤트</dt>
              <dd>{state.events.length}</dd>
            </div>
          </dl>
          <div className="tcg-card-controls" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => openZoneView('player', 'deck', true)}>내 덱</button>
            <button type="button" onClick={() => openZoneView('player', 'grave', true)}>내 묘지</button>
            <button type="button" onClick={() => openZoneView('player', 'banished', true)}>내 제외</button>
            <button type="button" onClick={() => openZoneView('enemy', 'deck', false)}>AI 덱</button>
            <button type="button" onClick={() => openZoneView('enemy', 'grave', true)}>AI 묘지</button>
            <button type="button" onClick={() => openZoneView('enemy', 'banished', true)}>AI 제외</button>
          </div>
          <button type="button" className="tcg-primary-action" onClick={() => act((current) => activateFieldIgnition(current, 'player'))} disabled={!canMain || !state.players.player.field}>
            필드 효과
          </button>
          <button
            type="button"
            className="tcg-primary-action"
            onClick={() => {
              setSelectedHandId('');
              setSelectedAttacker(null);
              act((current) => autoPlayPlayer(current));
            }}
            disabled={!canAutoPlayPlayer}
          >
            내 턴 자동
          </button>
          <div className="tcg-card-controls" style={{ marginTop: 12 }}>
            {monsterEffectRows.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => act((current) => (
                  row.action === 'hina'
                    ? activateHinaIgnition(current, row.slot)
                    : activateYuukaQuick(current, row.slot)
                ))}
                disabled={row.disabled}
                title={row.detail}
              >
                {row.label} · {row.status}
              </button>
            ))}
            {!monsterEffectRows.length ? <span>발동 가능한 몬스터 효과 없음</span> : null}
          </div>
          <button type="button" className="tcg-primary-action" onClick={() => act((current) => resolveChain(passResponse(current)))} disabled={state.prompt.kind !== 'RESPOND' || state.prompt.player !== 'player'}>
            응답 없이 해결
          </button>
        </aside>

        <section className="tcg-board">
          <PlayerField
            title="AI 필드"
            playerKey="enemy"
            player={state.players.enemy}
            state={state}
            selectedAttacker={selectedAttacker}
            setSelectedAttacker={setSelectedAttacker}
            selectedHandId={selectedHandId}
            onSummon={() => {}}
            onSet={() => {}}
            onActivateSet={() => {}}
            onAttack={(attackerSlot, targetSlot) => {
              act((current) => declareAttack(current, attackerSlot, targetSlot));
              setSelectedAttacker(null);
            }}
            onChangePosition={() => {}}
            promptTargets={promptTargets}
            onPickPromptTarget={(player, zone, slot) => act((current) => chooseTarget(current, { player, zone, slot }))}
          />
          <PlayerField
            title="내 필드"
            playerKey="player"
            player={state.players.player}
            state={state}
            selectedAttacker={selectedAttacker}
            setSelectedAttacker={setSelectedAttacker}
            selectedHandId={selectedHandId}
            onSummon={(slot) => {
              if (!selectedHandId || slot < 0) return;
              act((current) => normalSummon(current, selectedHandId, slot));
              setSelectedHandId('');
            }}
            onSet={(slot) => {
              if (!selectedHandId) return;
              act((current) => setSpellTrap(current, selectedHandId, slot));
              setSelectedHandId('');
            }}
            onActivateSet={(slot) => act((current) => activateSetCard(current, slot))}
            onAttack={() => {}}
            onChangePosition={(slot) => act((current) => changeMonsterPosition(current, slot))}
            promptTargets={promptTargets}
            onPickPromptTarget={(player, zone, slot) => act((current) => chooseTarget(current, { player, zone, slot }))}
          />
          <div className="tcg-lane-title" style={{ marginTop: 12 }}>
            <h2>페이즈 컨트롤</h2>
            <button type="button" onClick={() => act((current) => advancePhase(current))} disabled={!canAct && state.prompt.kind === 'NONE'}>
              다음 페이즈
            </button>
          </div>
        </section>
        </section>
      ) : null}

      {activeTcgTab === 'advisor' ? (
        <section className="tcg-layout is-single">
          <aside className="tcg-panel">
            <h2>턴 어드바이저</h2>
            <section className={`tcg-event-callout is-${advisorTone}`}>
              <span>{turnAdvisor.phase} · {turnAdvisor.riskLabel}</span>
              <strong>{turnAdvisor.headline}</strong>
              <p>준비도 {turnAdvisor.readinessPct}% · 보드 {turnAdvisor.boardDelta >= 0 ? '+' : ''}{turnAdvisor.boardDelta} · LP {turnAdvisor.lpDelta >= 0 ? '+' : ''}{turnAdvisor.lpDelta}</p>
            </section>
            <dl className="tcg-small-stats">
              <div>
                <dt>패 몬스터</dt>
                <dd>{turnAdvisor.hand.monsters}</dd>
              </div>
              <div>
                <dt>패 주문</dt>
                <dd>{turnAdvisor.hand.spells}</dd>
              </div>
              <div>
                <dt>패 함정</dt>
                <dd>{turnAdvisor.hand.traps}</dd>
              </div>
              <div>
                <dt>빈 몬스터 존</dt>
                <dd>{turnAdvisor.openMonster}</dd>
              </div>
              <div>
                <dt>빈 마함 존</dt>
                <dd>{turnAdvisor.openSpellTrap}</dd>
              </div>
              <div>
                <dt>킬각 피해</dt>
                <dd>{turnAdvisor.lethal.damage}</dd>
              </div>
            </dl>
          </aside>
          <aside className="tcg-panel">
            <h2>추천 행동</h2>
            <div className="game-save-list">
              {turnAdvisor.recommendations.map((item, index) => (
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
          </aside>
          <aside className="tcg-panel">
            <h2>전투선</h2>
            <div className="games-activity-list">
              <div>
                <strong>{turnAdvisor.lethal.canAttack ? turnAdvisor.lethal.attackerName : '공격 가능 몬스터 없음'}</strong>
                <span>
                  {turnAdvisor.lethal.lethal
                    ? `직접 공격으로 ${turnAdvisor.lethal.damage} 피해 마무리 가능`
                    : turnAdvisor.lethal.targetName
                      ? `${turnAdvisor.lethal.targetName} 우선 정리`
                      : turnAdvisor.lethal.canAttack
                        ? `${turnAdvisor.lethal.damage} 직접 피해 가능`
                        : 'MAIN 페이즈 전개 또는 다음 페이즈 진행이 필요합니다.'}
                </span>
              </div>
              <div>
                <strong>현재 권장</strong>
                <span>{turnAdvisor.recommendedAction}</span>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeTcgTab === 'inspect' ? (
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
      ) : null}

      {activeTcgTab === 'logs' ? (
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
      ) : null}

      {activeTcgTab === 'hand' ? (
      <section className="tcg-hand">
        <div className="tcg-lane-title">
          <h2>내 패</h2>
          <span>{state.players.player.hand.length}장 · 선택: {selectedCard?.name || '없음'}</span>
        </div>
        <div className="tcg-card-controls" style={{ marginBottom: 12 }}>
          <button type="button" onClick={playSelected} disabled={!selectedCard || !canMain}>
            선택 카드 실행
          </button>
          <button type="button" onClick={() => setSelectedHandId('')} disabled={!selectedHandId}>
            선택 해제
          </button>
        </div>
        <div className="tcg-hand-row">
          {state.players.player.hand.map((card) => (
            <article className={`tcg-card is-${card.tone} ${selectedHandId === card.instanceId ? 'is-selected' : ''}`} key={card.instanceId}>
              <div className="tcg-card-head">
                <span>{card.cost ?? '-'}</span>
                <strong>{cardKind(card)} {subType(card)}</strong>
              </div>
              <div className="tcg-card-art" />
              <h3>{card.name}</h3>
              <KeywordBadges card={card} />
              <p>{Array.isArray(card.text) ? card.text.join(' ') : card.text}</p>
              {cardKind(card) === 'Monster' ? <span>ATK {cardAtk(card)} / HP {card.health}</span> : null}
              <button type="button" onClick={() => setSelectedHandId((current) => current === card.instanceId ? '' : card.instanceId)} disabled={!canMain}>
                {selectedHandId === card.instanceId ? '선택됨' : '선택'}
              </button>
            </article>
          ))}
          {!state.players.player.hand.length ? <div className="tcg-empty-zone">패가 없습니다.</div> : null}
        </div>
      </section>
      ) : null}
    </>
  );
}
