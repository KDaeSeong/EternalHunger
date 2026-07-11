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
  PlayerField,
} from './TcgPlayBoard';
import { GameControlButton } from '../../_components/GamePlayPrimitives';

export default function DualAcademyTcgBoardTab(props) {
  const {
    act,
    canAct,
    canAutoPlayPlayer,
    canMain,
    deckMessage,
    deckName,
    loadingDeck,
    monsterEffectRows,
    openZoneView,
    promptTargets,
    selectedAttacker,
    selectedHandId,
    setSelectedAttacker,
    setSelectedHandId,
    state,
  } = props;

  return (
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
              <div className="tcg-action-controls" style={{ marginTop: 12 }}>
                <GameControlButton action="zone" onClick={() => openZoneView('player', 'deck', true)}>내 덱</GameControlButton>
                <GameControlButton action="zone" onClick={() => openZoneView('player', 'grave', true)}>내 묘지</GameControlButton>
                <GameControlButton action="zone" onClick={() => openZoneView('player', 'banished', true)}>내 제외</GameControlButton>
                <GameControlButton action="zone" onClick={() => openZoneView('enemy', 'deck', false)}>AI 덱</GameControlButton>
                <GameControlButton action="zone" onClick={() => openZoneView('enemy', 'grave', true)}>AI 묘지</GameControlButton>
                <GameControlButton action="zone" onClick={() => openZoneView('enemy', 'banished', true)}>AI 제외</GameControlButton>
              </div>
              <GameControlButton action="effect" className="tcg-primary-action" onClick={() => act((current) => activateFieldIgnition(current, 'player'))} disabled={!canMain || !state.players.player.field}>
                필드 효과
              </GameControlButton>
              <GameControlButton
                action="auto"
                className="tcg-primary-action"
                onClick={() => {
                  setSelectedHandId('');
                  setSelectedAttacker(null);
                  act((current) => autoPlayPlayer(current));
                }}
                disabled={!canAutoPlayPlayer}
              >
                내 턴 자동
              </GameControlButton>
              <div className="tcg-action-controls" style={{ marginTop: 12 }}>
                {monsterEffectRows.map((row) => (
                  <GameControlButton
                    action="effect"
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
                  </GameControlButton>
                ))}
                {!monsterEffectRows.length ? <span>발동 가능한 몬스터 효과 없음</span> : null}
              </div>
              <GameControlButton action="pass" className="tcg-primary-action" onClick={() => act((current) => resolveChain(passResponse(current)))} disabled={state.prompt.kind !== 'RESPOND' || state.prompt.player !== 'player'}>
                응답 없이 해결
              </GameControlButton>
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
                <GameControlButton action="phase" onClick={() => act((current) => advancePhase(current))} disabled={!canAct && state.prompt.kind === 'NONE'}>
                  다음 페이즈
                </GameControlButton>
              </div>
            </section>
            </section>
  );
}
