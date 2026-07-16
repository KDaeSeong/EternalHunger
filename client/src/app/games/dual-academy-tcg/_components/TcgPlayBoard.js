'use client';

import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { TCG_CHARACTER_LIST, keywordLabels } from '../_lib/tcgCatalog';
import {
  PLAYER_LABELS,
  activateCounterTrap,
  activateMikaQuick,
  chooseMikaNegateCost,
  chooseFromDeck,
  chooseTarget,
  confirmTrigger,
  mikaQuickReadiness,
  passResponse,
  resolveChain,
} from '../_lib/tcgDuelEngine';

export function cardKind(card) {
  if (!card) return 'Unknown';
  if (card.role === 'Unit') return 'Monster';
  if (card.tags?.includes('trap') || card.tags?.includes('counter')) return 'Trap';
  return 'Spell';
}

export function subType(card) {
  if (!card) return '';
  if (card.tags?.includes('field')) return 'Field';
  if (card.tags?.includes('counter')) return 'Counter';
  if (card.tags?.includes('quick')) return 'Quick';
  return '';
}

export function cardAtk(card) {
  return Number(card?.attack || card?.atk || 0);
}

export function cardHealth(card) {
  return Number(card?.currentHealth ?? card?.health ?? 0);
}

export function getPlayTimeSec(startedAt) {
  const start = new Date(startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function roomConcurrencyAudit({ roomId, room, localRoomDirty, roomSyncMessage, roomBusy }) {
  const connected = Boolean(roomId);
  const revision = Number(room?.revision);
  const hasRevision = !connected || Number.isFinite(revision);
  const message = String(roomSyncMessage || '');
  const conflictDetected = /새 매치|충돌|conflict|revision|409/i.test(message);
  const rows = [
    {
      id: 'room',
      label: '방 연결',
      status: connected ? '공유방' : '단독',
      detail: connected ? `roomId ${roomId}로 공유 매치를 사용합니다.` : '단독 플레이입니다. 방 저장 충돌 대상이 없습니다.',
      ok: true,
    },
    {
      id: 'revision',
      label: 'Revision 저장',
      status: hasRevision ? 'OK' : '대기',
      detail: connected ? `저장 요청에 현재 revision ${Number.isFinite(revision) ? revision : '미수신'}을 함께 보냅니다.` : '단독 플레이에서는 revision 저장이 필요하지 않습니다.',
      ok: hasRevision,
    },
    {
      id: 'local',
      label: '로컬 변경',
      status: localRoomDirty ? '저장 필요' : 'OK',
      detail: localRoomDirty ? '로컬 매치가 방 상태보다 앞서 있습니다. 방 저장 또는 방 불러오기로 정리하세요.' : '로컬 상태와 방 상태가 정리되어 있습니다.',
      ok: !localRoomDirty,
    },
    {
      id: 'conflict',
      label: '충돌 감지',
      status: conflictDetected ? '확인 필요' : 'OK',
      detail: conflictDetected ? message : '새 방 상태가 들어오면 자동 폴링 메시지로 알려줍니다.',
      ok: !conflictDetected,
    },
    {
      id: 'busy',
      label: '저장 처리',
      status: roomBusy ? '처리 중' : 'OK',
      detail: roomBusy ? '방 상태 저장/불러오기 요청을 처리 중입니다.' : '현재 방 요청 대기열이 비어 있습니다.',
      ok: !roomBusy,
    },
  ];
  const okRows = rows.filter((row) => row.ok);
  return {
    rows,
    ready: okRows.length === rows.length,
    completionPct: Math.round((okRows.length / rows.length) * 100),
    headline: connected
      ? `revision ${Number.isFinite(revision) ? revision : '대기'} · ${localRoomDirty ? '로컬 변경 있음' : '동기화됨'}`
      : '단독 매치 · 충돌 없음',
  };
}

export function KeywordBadges({ card }) {
  const labels = keywordLabels(card);
  const shielded = Boolean(card?.shield);
  if (!labels.length && !shielded) return null;
  return (
    <div className="tcg-keywords">
      {labels.map((label) => <span key={label}>{label}</span>)}
      {shielded ? <span className="tcg-shield-badge">보호막</span> : null}
    </div>
  );
}

export function CardFace({ card, small = false }) {
  if (!card) return <span>비어 있음</span>;
  if (card.face === 'down') return <span>세트 카드</span>;
  const dataCounters = Number(card.dataCounters || 0);
  return (
    <>
      <strong>{card.name}</strong>
      <KeywordBadges card={card} />
      {dataCounters > 0 ? <span>DATA {dataCounters}</span> : null}
      {cardKind(card) === 'Monster' ? (
        <span>{card.position || 'ATK'} · ATK {cardAtk(card)} / HP {cardHealth(card)}{card.hasAttacked ? ' / 공격 완료' : ''}</span>
      ) : (
        <span>{cardKind(card)} {subType(card)}</span>
      )}
      {!small && card.text ? <p>{Array.isArray(card.text) ? card.text.join(' ') : card.text}</p> : null}
    </>
  );
}

export function ZoneButton({ card, label, active, highlight, cue = 'select', onClick, children }) {
  return (
    <button
      type="button"
      className={`tcg-card ${card?.tone ? `is-${card.tone}` : ''} ${active ? 'is-selected' : ''} ${highlight ? 'is-targetable' : ''}`}
      data-game-sfx={cue}
      onClick={onClick}
      style={{
        minHeight: 118,
        opacity: card ? 1 : 0.78,
      }}
    >
      <div className="tcg-card-head">
        <span>{label}</span>
        <strong>{card ? cardKind(card) : 'EMPTY'}</strong>
      </div>
      <div className="tcg-card-art" />
      {children || <CardFace card={card} small />}
    </button>
  );
}

const ARCHIVE_ZONE_LABELS = {
  deck: '덱',
  grave: '묘지',
  banished: '제외',
};

function archiveCards(player, zone) {
  const cards = player?.[zone];
  return Array.isArray(cards) ? cards : [];
}

function ArchiveCard({ card, index, reveal }) {
  if (!reveal) {
    return (
      <article className="tcg-card">
        <div className="tcg-card-head">
          <span>#{index + 1}</span>
          <strong>비공개</strong>
        </div>
        <div className="tcg-card-art" />
        <h3>덱 카드</h3>
        <p>상대 덱 순서는 공개하지 않습니다.</p>
      </article>
    );
  }

  return (
    <article className={`tcg-card is-${card?.tone || 'blue'}`}>
      <div className="tcg-card-head">
        <span>#{index + 1}</span>
        <strong>{cardKind(card)} {subType(card)}</strong>
      </div>
      <div className="tcg-card-art" />
      <CardFace card={card} />
    </article>
  );
}

export function ZoneArchivePanel({ state, zoneView, onClose }) {
  if (!zoneView) return null;
  const player = state.players[zoneView.player];
  const cards = archiveCards(player, zoneView.zone);
  const shownCards = zoneView.zone === 'deck' ? cards : [...cards].reverse();
  const zoneLabel = ARCHIVE_ZONE_LABELS[zoneView.zone] || zoneView.zone;

  return (
    <section className="tcg-panel">
      <div className="tcg-lane-title">
        <h2>{PLAYER_LABELS[zoneView.player]} {zoneLabel}</h2>
        <span>{shownCards.length}장</span>
        <GameControlButton action="close" onClick={onClose}>닫기</GameControlButton>
      </div>
      <div className="tcg-hand-row">
        {shownCards.length ? shownCards.map((card, index) => (
          <ArchiveCard
            card={card}
            index={index}
            key={`${zoneView.player}-${zoneView.zone}-${card?.instanceId || index}`}
            reveal={zoneView.reveal}
          />
        )) : <div className="tcg-empty-zone">표시할 카드가 없습니다.</div>}
      </div>
    </section>
  );
}

export function PlayerField({
  title,
  playerKey,
  player,
  state,
  selectedAttacker,
  setSelectedAttacker,
  selectedHandId,
  onSummon,
  onSet,
  onActivateSet,
  onAttack,
  onChangePosition,
  promptTargets,
  onPickPromptTarget,
}) {
  const isCurrent = state.turnPlayer === playerKey;
  const canMain = isCurrent && (state.phase === 'MAIN1' || state.phase === 'MAIN2') && !state.winner && state.prompt.kind === 'NONE' && state.chain.length === 0;
  const canBattle = isCurrent && state.phase === 'BATTLE' && !state.winner && state.prompt.kind === 'NONE' && state.chain.length === 0;
  const targetKey = (zone, slot) => `${playerKey}:${zone}:${slot}`;
  return (
    <section className={`tcg-lane ${playerKey === 'enemy' ? 'is-enemy' : ''}`}>
      <div className="tcg-lane-title">
        <h2>{title}</h2>
        <span>덱 {player.deck.length} / 패 {player.hand.length} / 묘지 {player.grave.length} / 제외 {player.banished.length}</span>
      </div>

      <div className="tcg-card-row" style={{ marginBottom: 10 }}>
        {player.monster.map((card, slot) => {
          const key = targetKey('monster', slot);
          const isPromptTarget = promptTargets.has(key);
          const isSelected = selectedAttacker?.player === playerKey && selectedAttacker?.slot === slot;
          return (
            <ZoneButton
              key={key}
              card={card}
              label={`M${slot + 1}`}
              active={isSelected}
              highlight={isPromptTarget}
              cue={isPromptTarget
                ? 'select'
                : selectedAttacker && playerKey !== state.turnPlayer
                  ? 'combat'
                  : playerKey === state.turnPlayer && canMain && card && !selectedHandId
                    ? 'toggle'
                    : 'select'}
              onClick={() => {
                if (isPromptTarget) return onPickPromptTarget(playerKey, 'monster', slot);
                if (playerKey === state.turnPlayer && canBattle && card && !card.hasAttacked) {
                  setSelectedAttacker({ player: playerKey, slot });
                  return;
                }
                if (selectedAttacker && selectedAttacker.player === state.turnPlayer && playerKey !== state.turnPlayer) onAttack(selectedAttacker.slot, slot);
                if (playerKey === state.turnPlayer && canMain && card && !selectedHandId) onChangePosition(slot);
              }}
            >
              <CardFace card={card} small />
              {canMain && selectedHandId && !card ? <span>소환 가능</span> : null}
            </ZoneButton>
          );
        })}
      </div>

      <div className="tcg-card-row">
        {player.spellTrap.map((card, slot) => {
          const key = targetKey('spellTrap', slot);
          const isPromptTarget = promptTargets.has(key);
          return (
            <ZoneButton
              key={key}
              card={card}
              label={`S/T ${slot + 1}`}
              highlight={isPromptTarget}
              cue={isPromptTarget ? 'select' : canMain && selectedHandId && !card ? 'toggle' : card?.face === 'down' ? 'skill' : 'select'}
              onClick={() => {
                if (isPromptTarget) return onPickPromptTarget(playerKey, 'spellTrap', slot);
                if (canMain && selectedHandId && !card) return onSet(slot);
                if (canMain && card && card.face === 'down') return onActivateSet(slot);
              }}
            >
              <CardFace card={card} small />
              {canMain && selectedHandId && !card ? <span>세트 가능</span> : null}
            </ZoneButton>
          );
        })}
      </div>

      <div className="tcg-card-row" style={{ marginTop: 10 }}>
        {(() => {
          const key = targetKey('field', 0);
          const isPromptTarget = promptTargets.has(key);
          return (
            <ZoneButton
              card={player.field}
              label="FIELD"
              highlight={isPromptTarget}
              onClick={() => {
                if (isPromptTarget) return onPickPromptTarget(playerKey, 'field', 0);
              }}
            >
              <CardFace card={player.field} small />
            </ZoneButton>
          );
        })()}
        {playerKey === state.turnPlayer && canMain && selectedHandId ? (
          <GameControlButton action="summon" className="tcg-core-target" unwrapped onClick={() => onSummon(firstEmptySlot(player.monster))} disabled={firstEmptySlot(player.monster) < 0}>
            <strong>선택 카드 소환</strong>
            <span>빈 몬스터 존 자동 선택</span>
          </GameControlButton>
        ) : null}
        {selectedAttacker && playerKey !== state.turnPlayer && !player.monster.some(Boolean) ? (
          <GameControlButton action="attack" className="tcg-core-target" unwrapped onClick={() => onAttack(selectedAttacker.slot, null)}>
            <strong>직접 공격</strong>
            <span>{PLAYER_LABELS[playerKey]} LP를 공격합니다.</span>
          </GameControlButton>
        ) : null}
      </div>
    </section>
  );
}

export function firstEmptySlot(zone) {
  return Array.isArray(zone) ? zone.findIndex((row) => !row) : -1;
}

export function PromptPanel({ state, setState }) {
  const prompt = state.prompt;
  if (prompt.kind === 'NONE' && !state.chain.length) return null;
  const player = prompt.player || state.turnPlayer;
  const counterSlots = prompt.kind === 'RESPOND'
    ? state.players[player]?.spellTrap
      .map((card, slot) => ({ card, slot }))
      .filter(({ card }) => card && cardKind(card) === 'Trap' && subType(card) === 'Counter')
    : [];
  const mikaReadiness = prompt.kind === 'RESPOND'
    ? mikaQuickReadiness(state, player)
    : { canActivate: false, reason: '', options: [] };
  const hasFaceUpMika = prompt.kind === 'RESPOND'
    && state.players[player]?.monster?.some((card) => card?.id === 'TRI-MIKA-01' && card.face !== 'down' && card.face !== 'FaceDown');

  return (
    <section className="tcg-result">
      {prompt.kind === 'RESPOND' ? (
        <>
          <strong>{PLAYER_LABELS[player]} 응답 창</strong>
          <span>체인 {state.chain.length}개가 대기 중입니다.</span>
          <div className="tcg-action-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {counterSlots.map(({ card, slot }) => (
              <GameControlButton action="trap" key={card.instanceId} onClick={() => setState((current) => activateCounterTrap(current, player, slot))}>
                {card.name} 발동
              </GameControlButton>
            ))}
            {mikaReadiness.canActivate || hasFaceUpMika ? (
              <GameControlButton
                action="tcg-mika-negate"
                onClick={() => setState((current) => activateMikaQuick(current))}
                disabled={!mikaReadiness.canActivate}
                title={mikaReadiness.reason || '다른 트리니티 카드 1장을 묘지로 보내 상대 효과를 무효로 하고 파괴합니다.'}
              >
                미카 ② 발동
              </GameControlButton>
            ) : null}
            <GameControlButton action="pass" onClick={() => setState((current) => resolveChain(passResponse(current)))}>
              응답 없음
            </GameControlButton>
          </div>
        </>
      ) : null}
      {prompt.kind === 'SELECT_TARGET' ? (
        <>
          <strong>{prompt.title}</strong>
          <span>필드에서 강조된 카드를 누르거나 아래 대상 버튼을 누르세요.</span>
          <div className="tcg-action-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {prompt.options.map((option) => (
              <GameControlButton action="target" key={`${option.player}-${option.zone}-${option.slot}`} onClick={() => setState((current) => chooseTarget(current, option))}>
                {option.label}
              </GameControlButton>
            ))}
          </div>
        </>
      ) : null}
      {prompt.kind === 'SELECT_FROM_DECK' ? (
        <>
          <strong>{prompt.title}</strong>
          <span>덱에서 가져올 카드를 선택하세요.</span>
          <div className="tcg-action-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {prompt.options.map((option) => (
              <GameControlButton action="cards" key={`${option.deckIndex}-${option.cardId}`} onClick={() => setState((current) => chooseFromDeck(current, option.deckIndex))}>
                {option.label}
              </GameControlButton>
            ))}
          </div>
        </>
      ) : null}
      {prompt.kind === 'SELECT_COST_MIKA_NEGATE' ? (
        <>
          <strong>{prompt.title}</strong>
          <span>선택한 카드는 즉시 묘지로 보내지고 되돌릴 수 없습니다.</span>
          <div className="tcg-action-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {prompt.options.map((option) => (
              <GameControlButton
                action="tcg-mika-cost"
                key={`${option.zone}-${option.slot}`}
                onClick={() => setState((current) => chooseMikaNegateCost(current, option))}
              >
                {option.label}
              </GameControlButton>
            ))}
          </div>
        </>
      ) : null}
      {prompt.kind === 'TRIGGER_CONFIRM' ? (
        <>
          <strong>{prompt.title}</strong>
          <div className="tcg-action-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            <GameControlButton action="effect" onClick={() => setState((current) => confirmTrigger(current, true))}>발동</GameControlButton>
            <GameControlButton action="pass" onClick={() => setState((current) => confirmTrigger(current, false))}>넘기기</GameControlButton>
          </div>
        </>
      ) : null}
      {prompt.kind === 'NONE' && state.chain.length ? (
        <GameControlButton action="chain" onClick={() => setState((current) => resolveChain(current))}>체인 해결</GameControlButton>
      ) : null}
    </section>
  );
}

export function CharacterPanel({ label, profile, value, onChange, active, quote }) {
  const initials = String(profile.name || '?').slice(0, 2);
  return (
    <article className={`tcg-character-card is-${profile.tone} ${active ? 'is-speaking' : ''}`}>
      <div className="tcg-character-avatar" aria-hidden="true">{initials}</div>
      <div className="tcg-character-body">
        <div className="tcg-character-head">
          <div>
            <span>{label} · {profile.academy}</span>
            <strong>{profile.name}</strong>
          </div>
          <select value={value} onChange={(event) => onChange(event.target.value)}>
            {TCG_CHARACTER_LIST.map((character) => (
              <option value={character.id} key={character.id}>{character.name} · {character.academy}</option>
            ))}
          </select>
        </div>
        <p>{quote || '대기 중'}</p>
        <div className="tcg-character-ai">
          <span>공격 {Math.round(Number(profile.ai?.aggressive || 0) * 100)}</span>
          <span>제어 {Math.round(Number(profile.ai?.control || 0) * 100)}</span>
          <span>연계 {Math.round(Number(profile.ai?.combo || 0) * 100)}</span>
          <span>위험 {Math.round(Number(profile.ai?.risk || 0) * 100)}</span>
        </div>
      </div>
    </article>
  );
}
