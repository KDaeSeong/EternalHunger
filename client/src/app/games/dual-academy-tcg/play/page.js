'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  TCG_CHARACTER_LIST,
  TCG_GAME_SLUG,
  getTcgCharacter,
  hasKeyword,
  keywordLabels,
  normalizeCards,
  normalizeTcgCharacters,
  renderTcgQuote,
} from '../_lib/tcgCatalog';
import {
  ENGINE_VERSION,
  PLAYER_LABELS,
  QUICK_SAVE_SLOT,
  activateCounterTrap,
  activateFromHand,
  activateFieldIgnition,
  activateHinaIgnition,
  activateSetCard,
  activateYuukaQuick,
  advancePhase,
  autoPlayEnemy,
  chooseFromDeck,
  chooseTarget,
  changeMonsterPosition,
  confirmTrigger,
  createDuelState,
  declareAttack,
  normalizeDuelState,
  normalSummon,
  passResponse,
  resolveChain,
  serializeDuelState,
  setSpellTrap,
  summarizeDuel,
} from '../_lib/tcgDuelEngine';

function cardKind(card) {
  if (!card) return 'Unknown';
  if (card.role === 'Unit') return 'Monster';
  if (card.tags?.includes('trap') || card.tags?.includes('counter')) return 'Trap';
  return 'Spell';
}

function subType(card) {
  if (!card) return '';
  if (card.tags?.includes('field')) return 'Field';
  if (card.tags?.includes('counter')) return 'Counter';
  if (card.tags?.includes('quick')) return 'Quick';
  return '';
}

function cardAtk(card) {
  return Number(card?.attack || card?.atk || 0);
}

function cardHealth(card) {
  return Number(card?.currentHealth ?? card?.health ?? 0);
}

function getPlayTimeSec(startedAt) {
  const start = new Date(startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

function KeywordBadges({ card }) {
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

function CardFace({ card, small = false }) {
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

function ZoneButton({ card, label, active, highlight, onClick, children }) {
  return (
    <button
      type="button"
      className={`tcg-card ${card?.tone ? `is-${card.tone}` : ''} ${active ? 'is-selected' : ''} ${highlight ? 'is-targetable' : ''}`}
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

function ZoneArchivePanel({ state, zoneView, onClose }) {
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
        <button type="button" onClick={onClose}>닫기</button>
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

function PlayerField({
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
          <button type="button" className="tcg-core-target" onClick={() => onSummon(firstEmptySlot(player.monster))} disabled={firstEmptySlot(player.monster) < 0}>
            <strong>선택 카드 소환</strong>
            <span>빈 몬스터 존 자동 선택</span>
          </button>
        ) : null}
        {selectedAttacker && playerKey !== state.turnPlayer && !player.monster.some(Boolean) ? (
          <button type="button" className="tcg-core-target" onClick={() => onAttack(selectedAttacker.slot, null)}>
            <strong>직접 공격</strong>
            <span>{PLAYER_LABELS[playerKey]} LP를 공격합니다.</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function firstEmptySlot(zone) {
  return Array.isArray(zone) ? zone.findIndex((row) => !row) : -1;
}

function PromptPanel({ state, setState }) {
  const prompt = state.prompt;
  if (prompt.kind === 'NONE' && !state.chain.length) return null;
  const player = prompt.player || state.turnPlayer;
  const counterSlots = prompt.kind === 'RESPOND'
    ? state.players[player]?.spellTrap
      .map((card, slot) => ({ card, slot }))
      .filter(({ card }) => card && cardKind(card) === 'Trap' && subType(card) === 'Counter')
    : [];

  return (
    <section className="tcg-result">
      {prompt.kind === 'RESPOND' ? (
        <>
          <strong>{PLAYER_LABELS[player]} 응답 창</strong>
          <span>체인 {state.chain.length}개가 대기 중입니다.</span>
          <div className="tcg-card-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {counterSlots.map(({ card, slot }) => (
              <button type="button" key={card.instanceId} onClick={() => setState((current) => activateCounterTrap(current, player, slot))}>
                {card.name} 발동
              </button>
            ))}
            <button type="button" onClick={() => setState((current) => resolveChain(passResponse(current)))}>
              응답 없음
            </button>
          </div>
        </>
      ) : null}
      {prompt.kind === 'SELECT_TARGET' ? (
        <>
          <strong>{prompt.title}</strong>
          <span>필드에서 강조된 카드를 누르거나 아래 대상 버튼을 누르세요.</span>
          <div className="tcg-card-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {prompt.options.map((option) => (
              <button type="button" key={`${option.player}-${option.zone}-${option.slot}`} onClick={() => setState((current) => chooseTarget(current, option))}>
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {prompt.kind === 'SELECT_FROM_DECK' ? (
        <>
          <strong>{prompt.title}</strong>
          <span>덱에서 가져올 카드를 선택하세요.</span>
          <div className="tcg-card-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            {prompt.options.map((option) => (
              <button type="button" key={`${option.deckIndex}-${option.cardId}`} onClick={() => setState((current) => chooseFromDeck(current, option.deckIndex))}>
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {prompt.kind === 'TRIGGER_CONFIRM' ? (
        <>
          <strong>{prompt.title}</strong>
          <div className="tcg-card-controls" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button type="button" onClick={() => setState((current) => confirmTrigger(current, true))}>발동</button>
            <button type="button" onClick={() => setState((current) => confirmTrigger(current, false))}>넘기기</button>
          </div>
        </>
      ) : null}
      {prompt.kind === 'NONE' && state.chain.length ? (
        <button type="button" onClick={() => setState((current) => resolveChain(current))}>체인 해결</button>
      ) : null}
    </section>
  );
}

function CharacterPanel({ label, profile, value, onChange, active, quote }) {
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

export default function DualAcademyTcgPlayPage() {
  return (
    <Suspense fallback={(
      <main className="tcg-page-shell">
        <SiteHeader />
        <section className="tcg-arena">
          <div className="tcg-deck-message">매치를 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <DualAcademyTcgPlayContent />
    </Suspense>
  );
}

function DualAcademyTcgPlayContent() {
  const mounted = useHydrated();
  const token = useAuthToken();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const { showToast } = useToast();
  const [cardCatalog, setCardCatalog] = useState(FALLBACK_TCG_CARDS);
  const [deckCardIds, setDeckCardIds] = useState(FALLBACK_DECK_CARD_IDS);
  const [deckName, setDeckName] = useState('기본 덱');
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [deckMessage, setDeckMessage] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [localRoomDirty, setLocalRoomDirty] = useState(false);
  const [roomSyncMessage, setRoomSyncMessage] = useState('');
  const [recordedMatchIds, setRecordedMatchIds] = useState([]);
  const [recordMessage, setRecordMessage] = useState('');
  const [selectedHandId, setSelectedHandId] = useState('');
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [zoneView, setZoneView] = useState(null);
  const [state, setState] = useState(() => createDuelState());

  const resetWithDeck = useCallback((cardIds, cards, characters = null) => {
    setRecordMessage('');
    setSelectedHandId('');
    setSelectedAttacker(null);
    setZoneView(null);
    setState(createDuelState({ deckCardIds: cardIds, cardCatalog: cards, characters: normalizeTcgCharacters(characters) }));
  }, []);

  const loadDeck = useCallback(async () => {
    if (!mounted) return;
    setLoadingDeck(true);
    setDeckMessage('');
    try {
      const cardPayload = await apiGetCached('/tcg/cards', {
        ttlMs: 60000,
        timeoutMs: 12000,
        storage: 'session',
      });
      const nextCards = normalizeCards(cardPayload?.cards);
      let nextCardIds = Array.isArray(cardPayload?.defaultDeckCardIds) && cardPayload.defaultDeckCardIds.length
        ? cardPayload.defaultDeckCardIds
        : FALLBACK_DECK_CARD_IDS;
      let nextDeckName = '기본 덱';

      if (token) {
        try {
          const deckPayload = await apiGet('/tcg/decks/active', { timeoutMs: 12000 });
          if (Array.isArray(deckPayload?.deck?.cardIds) && deckPayload.deck.cardIds.length) {
            nextCardIds = deckPayload.deck.cardIds;
            nextDeckName = deckPayload.deck.name || nextDeckName;
          }
        } catch (err) {
          setDeckMessage(err?.message || '저장된 덱을 불러오지 못해 기본 덱을 사용합니다.');
        }
      } else {
        setDeckMessage('로그인하면 저장된 덱을 사용할 수 있습니다.');
      }

      setCardCatalog(nextCards);
      setDeckCardIds(nextCardIds);
      setDeckName(nextDeckName);
      resetWithDeck(nextCardIds, nextCards);
    } catch (err) {
      setDeckMessage(err?.message || '카드 정보를 불러오지 못해 기본 덱을 사용합니다.');
      setCardCatalog(FALLBACK_TCG_CARDS);
      setDeckCardIds(FALLBACK_DECK_CARD_IDS);
      setDeckName('기본 덱');
      resetWithDeck(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS);
    } finally {
      setLoadingDeck(false);
    }
  }, [mounted, resetWithDeck, token]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const applyRoomMatch = useCallback((nextRoom, options = {}) => {
    if (!nextRoom) {
      setDeckMessage('게임방을 찾을 수 없습니다.');
      return false;
    }
    setRoom(nextRoom);
    if (nextRoom.gameSlug !== TCG_GAME_SLUG) {
      setDeckMessage('이 게임방은 Dual Academy TCG 방이 아닙니다.');
      return false;
    }

    const roomState = nextRoom.state && typeof nextRoom.state === 'object' ? nextRoom.state : {};
    const nextCards = normalizeCards(roomState.cardCatalog);
    const nextCardIds = Array.isArray(roomState.deckCardIds) && roomState.deckCardIds.length ? roomState.deckCardIds : deckCardIds;
    const restored = normalizeDuelState(roomState.state, { deckCardIds: nextCardIds, cardCatalog: nextCards });
    if (!restored) {
      setDeckMessage(options.emptyMessage || '게임방에 저장된 매치가 없어 현재 덱으로 시작합니다.');
      setRoomSyncMessage('');
      return false;
    }

    setCardCatalog(nextCards);
    setDeckCardIds(nextCardIds);
    setDeckName(roomState.deckName || nextRoom.title || deckName);
    setRecordMessage('');
    setSelectedHandId('');
    setSelectedAttacker(null);
    setZoneView(null);
    setState(restored);
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
    setDeckMessage(options.message || '게임방 매치를 불러왔습니다.');
    return true;
  }, [deckCardIds, deckName]);

  useEffect(() => {
    setRoom(null);
    setRoomLoaded(false);
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
  }, [roomId]);

  useEffect(() => {
    if (!mounted || loadingDeck || !roomId || !token || roomLoaded) return;
    let cancelled = false;
    const loadRoomMatch = async () => {
      setRoomBusy(true);
      try {
        const payload = await apiGet(`/game-rooms/${roomId}`, { timeoutMs: 12000 });
        if (!cancelled) {
          applyRoomMatch(payload?.room || null, {
            message: '게임방 매치를 불러왔습니다.',
            emptyMessage: '게임방에 저장된 매치가 없어 현재 덱으로 시작합니다.',
          });
          setRoomLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.message || '게임방 매치를 불러오지 못했습니다.';
          setDeckMessage(message);
          showToast({ tone: 'danger', message });
          setRoomLoaded(true);
        }
      } finally {
        if (!cancelled) setRoomBusy(false);
      }
    };
    void loadRoomMatch();
    return () => {
      cancelled = true;
    };
  }, [applyRoomMatch, loadingDeck, mounted, roomId, roomLoaded, showToast, token]);

  useEffect(() => {
    if (!mounted || loadingDeck || !roomId || !token || !roomLoaded) return;
    let cancelled = false;
    const pollRoom = async () => {
      if (roomBusy) return;
      try {
        const payload = await apiGet(`/game-rooms/${roomId}`, { timeoutMs: 10000 });
        if (cancelled) return;
        const nextRoom = payload?.room || null;
        if (!nextRoom || nextRoom.gameSlug !== TCG_GAME_SLUG) return;
        const currentRevision = Number(room?.revision ?? -1);
        const nextRevision = Number(nextRoom.revision ?? 0);
        if (nextRevision <= currentRevision) return;
        setRoom(nextRoom);
        if (localRoomDirty) {
          setRoomSyncMessage('게임방에 새 매치 상태가 있습니다. 방 불러오기를 누르면 반영됩니다.');
          return;
        }
        applyRoomMatch(nextRoom, { message: '게임방 매치가 자동 갱신되었습니다.' });
      } catch {
        // Polling is best-effort.
      }
    };
    const intervalId = window.setInterval(pollRoom, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyRoomMatch, loadingDeck, localRoomDirty, mounted, room?.revision, roomBusy, roomId, roomLoaded, token]);

  useEffect(() => {
    if (!mounted || !token || !state.winner || recordedMatchIds.includes(state.matchId)) return;
    let cancelled = false;
    const saveRecord = async () => {
      try {
        setRecordedMatchIds((current) => current.includes(state.matchId) ? current : [...current, state.matchId]);
        const result = state.winner === 'player' ? 'win' : 'loss';
        const score = state.winner === 'player' ? 100 + Math.floor(state.players.player.lp / 100) : Math.floor(state.players.enemy.lp / 100);
        const payload = {
          title: 'Dual Academy TCG v13 듀얼',
          mode: 'v13-zone-engine',
          result,
          score,
          playTimeSec: getPlayTimeSec(state.startedAt),
          summary: {
            deckName,
            ...summarizeDuel(state),
            result,
          },
          payload: {
            deckName,
            deckCardIds,
            engineVersion: ENGINE_VERSION,
            state: serializeDuelState(state),
          },
        };
        if (roomId) {
          const hostUserId = String(room?.hostId || '');
          const roomRecord = await apiPost(`/game-rooms/${roomId}/records`, {
            ...payload,
            winnerUserId: state.winner === 'player' ? hostUserId : '',
            resultByUserId: hostUserId ? { [hostUserId]: result } : {},
            scoreByUserId: hostUserId ? { [hostUserId]: payload.score } : {},
          }, { timeoutMs: 12000 });
          clearApiGetCache('/game-rooms');
          if (!cancelled && roomRecord?.room) setRoom(roomRecord.room);
        } else {
          await apiPost(`/game-records/${TCG_GAME_SLUG}`, payload, { timeoutMs: 12000 });
        }
        clearApiGetCache('/game-records');
        if (!cancelled) setRecordMessage('전적을 자동 저장했습니다.');
      } catch (err) {
        if (!cancelled) {
          const recordedRoom = err?.response?.data?.room;
          if (roomId && recordedRoom?.recordedAt) {
            setRoom(recordedRoom);
            setRecordMessage('방 결과가 이미 기록되어 있습니다.');
            return;
          }
          setRecordedMatchIds((current) => current.filter((id) => id !== state.matchId));
          setRecordMessage(err?.message || '전적 자동 저장에 실패했습니다.');
        }
      }
    };
    void saveRecord();
    return () => {
      cancelled = true;
    };
  }, [deckCardIds, deckName, mounted, recordedMatchIds, room?.hostId, roomId, state, token]);

  useEffect(() => {
    if (state.turnPlayer !== 'enemy') return;
    if (state.prompt.kind === 'RESPOND' && state.prompt.player !== 'enemy') return;
    const timer = window.setTimeout(() => {
      setState((current) => autoPlayEnemy(current));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state.turnPlayer, state.phase, state.prompt.kind, state.prompt.player, state.chain.length]);

  const duelCharacters = normalizeTcgCharacters(state.characters);
  const playerCharacter = getTcgCharacter(duelCharacters.player, 'YUUKA');
  const enemyCharacter = getTcgCharacter(duelCharacters.enemy, 'HINA');
  const latestEvent = Array.isArray(state.events) ? state.events[0] : null;
  const latestActor = latestEvent?.actor === 'enemy' ? 'enemy' : 'player';
  const latestCharacter = latestActor === 'enemy' ? enemyCharacter : playerCharacter;
  const latestQuote = latestEvent ? renderTcgQuote(latestCharacter, latestEvent) : '이벤트 대기 중입니다.';
  const selectedCard = state.players.player.hand.find((card) => card.instanceId === selectedHandId) || null;
  const summary = summarizeDuel(state);
  const canAct = !state.winner && state.turnPlayer === 'player' && state.prompt.kind === 'NONE' && state.chain.length === 0;
  const canMain = canAct && (state.phase === 'MAIN1' || state.phase === 'MAIN2');
  const promptTargets = useMemo(() => {
    const out = new Set();
    if (state.prompt.kind === 'SELECT_TARGET') {
      state.prompt.options.forEach((opt) => out.add(`${opt.player}:${opt.zone}:${opt.slot}`));
    }
    return out;
  }, [state.prompt]);
  const monsterEffectRows = useMemo(() => (
    state.players.player.monster
      .map((card, slot) => ({ card, slot }))
      .filter(({ card }) => card?.id === 'GEH-HINA-01' || card?.id === 'MIL-YUUKA-01')
      .map(({ card, slot }) => {
        const isHina = card.id === 'GEH-HINA-01';
        const key = isHina ? 'GEH-HINA-01:HINA_IGNITION_2' : 'MIL-YUUKA-01:YUUKA_IGNITION_2';
        const used = Boolean(state.players.player.flags.usedEffects?.[key]);
        const disabled = !canMain || used || (isHina && Number(state.players.player.lp || 0) <= 800);
        return {
          id: `${card.id}-${slot}`,
          slot,
          name: card.name,
          disabled,
          label: isHina ? `히나 ② · M${slot + 1}` : `유우카 ② · M${slot + 1}`,
          detail: isHina ? 'LP 800 지불, 필드 카드 1장 파괴' : '자신 필드 카드 DATA +1 / 보호막',
          action: isHina ? 'hina' : 'yuuka',
          status: used ? '사용됨' : disabled ? '대기' : '발동 가능',
        };
      })
  ), [canMain, state.players.player.flags.usedEffects, state.players.player.lp, state.players.player.monster]);

  useEffect(() => {
    if (!selectedHandId) return;
    if (!state.players.player.hand.some((card) => card.instanceId === selectedHandId)) setSelectedHandId('');
  }, [selectedHandId, state.players.player.hand]);

  const markDirty = () => {
    if (roomId) {
      setLocalRoomDirty(true);
      setRoomSyncMessage('');
    }
  };

  const act = (mutator) => {
    markDirty();
    setState((current) => mutator(current));
  };

  const playSelected = () => {
    if (!selectedCard || !canMain) return;
    if (cardKind(selectedCard) === 'Monster') {
      const slot = firstEmptySlot(state.players.player.monster);
      if (slot >= 0) act((current) => normalSummon(current, selectedCard.instanceId, slot));
      setSelectedHandId('');
      return;
    }
    if (cardKind(selectedCard) === 'Trap') {
      const slot = firstEmptySlot(state.players.player.spellTrap);
      if (slot >= 0) act((current) => setSpellTrap(current, selectedCard.instanceId, slot));
      setSelectedHandId('');
      return;
    }
    act((current) => activateFromHand(current, selectedCard.instanceId));
    setSelectedHandId('');
  };

  const saveMatch = async () => {
    if (!token || saveBusy) {
      setDeckMessage('로그인하면 현재 매치를 저장할 수 있습니다.');
      return;
    }
    setSaveBusy(true);
    try {
      await apiPut(`/game-saves/${TCG_GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `${deckName} ${state.turn}턴`,
        version: ENGINE_VERSION,
        summary: {
          deckName,
          ...summary,
        },
        payload: {
          deckName,
          deckCardIds,
          cardCatalog,
          engineVersion: ENGINE_VERSION,
          state: serializeDuelState(state),
        },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setDeckMessage('현재 매치를 저장했습니다.');
      showToast({ tone: 'success', message: '현재 매치를 저장했습니다.' });
    } catch (err) {
      const message = err?.message || '매치 저장에 실패했습니다.';
      setDeckMessage(message);
      showToast({ tone: 'danger', message });
    } finally {
      setSaveBusy(false);
    }
  };

  const loadMatch = async () => {
    if (!token || saveBusy) {
      setDeckMessage('로그인하면 저장된 매치를 불러올 수 있습니다.');
      return;
    }
    setSaveBusy(true);
    try {
      const list = await apiGet(`/game-saves?gameSlug=${TCG_GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setDeckMessage('저장된 매치가 없습니다.');
        return;
      }

      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const nextCards = normalizeCards(payload.cardCatalog);
      const nextCardIds = Array.isArray(payload.deckCardIds) && payload.deckCardIds.length ? payload.deckCardIds : deckCardIds;
      const restored = normalizeDuelState(payload.state, { deckCardIds: nextCardIds, cardCatalog: nextCards });
      if (!restored) {
        setDeckMessage('저장된 매치 데이터가 올바르지 않습니다.');
        return;
      }
      setCardCatalog(nextCards);
      setDeckCardIds(nextCardIds);
      setDeckName(payload.deckName || detail?.save?.summary?.deckName || deckName);
      setRecordMessage('');
      setSelectedHandId('');
      setSelectedAttacker(null);
      setZoneView(null);
      setState(restored);
      if (roomId) {
        setLocalRoomDirty(true);
        setRoomSyncMessage('');
      }
      setDeckMessage('저장된 매치를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 매치를 불러왔습니다.' });
    } catch (err) {
      const message = err?.message || '매치 불러오기에 실패했습니다.';
      setDeckMessage(message);
      showToast({ tone: 'danger', message });
    } finally {
      setSaveBusy(false);
    }
  };

  const saveRoomMatch = async () => {
    if (!roomId) {
      setDeckMessage('연결된 게임방이 없습니다.');
      return;
    }
    if (!token || roomBusy) {
      setDeckMessage('로그인하면 게임방에 매치를 저장할 수 있습니다.');
      return;
    }
    setRoomBusy(true);
    try {
      const payload = await apiPost(`/game-rooms/${roomId}/state`, {
        revision: room?.revision,
        summary: {
          deckName,
          ...summary,
        },
        state: {
          deckName,
          deckCardIds,
          cardCatalog,
          engineVersion: ENGINE_VERSION,
          state: serializeDuelState(state),
        },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-rooms');
      setRoom(payload?.room || room);
      setLocalRoomDirty(false);
      setRoomSyncMessage('');
      setDeckMessage('게임방에 현재 매치를 저장했습니다.');
      showToast({ tone: 'success', message: '게임방에 현재 매치를 저장했습니다.' });
    } catch (err) {
      const conflictRoom = err?.response?.data?.room;
      if (conflictRoom) setRoom(conflictRoom);
      const message = err?.message || '게임방 저장에 실패했습니다.';
      setDeckMessage(message);
      showToast({ tone: 'danger', message });
    } finally {
      setRoomBusy(false);
    }
  };

  const reloadRoomMatch = () => {
    if (!roomId || roomBusy) return;
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
    setRoomLoaded(false);
  };

  const resetMatch = () => {
    markDirty();
    resetWithDeck(deckCardIds, cardCatalog, state.characters);
  };

  const updateCharacter = (player, characterId) => {
    markDirty();
    setState((current) => ({
      ...current,
      characters: normalizeTcgCharacters({
        ...current.characters,
        [player]: characterId,
      }),
    }));
  };

  const openZoneView = (player, zone, reveal = true) => {
    setZoneView({ player, zone, reveal });
  };

  return (
    <main className="tcg-page-shell">
      <SiteHeader />
      <section className="tcg-arena">
        <header className="tcg-topbar">
          <div>
            <p>Dual Academy TCG</p>
            <h1>v13 듀얼</h1>
          </div>
          <nav>
            <Link href="/myanime/dual-academy-tcg">상세</Link>
            <Link href="/myanime/dual-academy-tcg/deck">덱 편집</Link>
            <Link href="/board?category=game&gameSlug=dual-academy-tcg">게시판</Link>
            <button type="button" onClick={saveMatch} disabled={saveBusy}>저장</button>
            <button type="button" onClick={loadMatch} disabled={saveBusy}>불러오기</button>
            {roomId ? <Link href={`/games/rooms/${roomId}`}>게임방</Link> : <Link href={`/games/rooms?gameSlug=${TCG_GAME_SLUG}&create=1`}>방 만들기</Link>}
            {roomId ? <button type="button" onClick={saveRoomMatch} disabled={roomBusy}>방 저장</button> : null}
            {roomId ? <button type="button" onClick={reloadRoomMatch} disabled={roomBusy}>방 불러오기</button> : null}
            <button type="button" onClick={resetMatch}>새 매치</button>
          </nav>
        </header>

        {roomId ? (
          <section className="tcg-room-banner">
            <div>
              <strong>{room?.title || '게임방 매치'}</strong>
              <span>{room?.status || 'loading'} · rev {Number(room?.revision || 0)}{localRoomDirty ? ' · 로컬 변경 있음' : ''}</span>
              {roomSyncMessage ? <small>{roomSyncMessage}</small> : null}
            </div>
            <Link href={`/games/rooms/${roomId}`}>로비로 이동</Link>
          </section>
        ) : null}

        <section className="tcg-scoreboard" aria-label="match status">
          <div>
            <span>내 LP</span>
            <strong>{state.players.player.lp}</strong>
          </div>
          <div>
            <span>AI LP</span>
            <strong>{state.players.enemy.lp}</strong>
          </div>
          <div>
            <span>턴</span>
            <strong>{state.turn}</strong>
          </div>
          <div>
            <span>차례</span>
            <strong>{PLAYER_LABELS[state.turnPlayer]}</strong>
          </div>
          <div>
            <span>페이즈</span>
            <strong>{state.phase}</strong>
          </div>
          <div>
            <span>체인</span>
            <strong>{state.chain.length}</strong>
          </div>
        </section>

        <section className="tcg-character-strip" aria-label="duel characters">
          <CharacterPanel
            label="P1"
            profile={playerCharacter}
            value={duelCharacters.player}
            active={latestActor === 'player'}
            quote={latestActor === 'player' ? latestQuote : ''}
            onChange={(characterId) => updateCharacter('player', characterId)}
          />
          <CharacterPanel
            label="AI"
            profile={enemyCharacter}
            value={duelCharacters.enemy}
            active={latestActor === 'enemy'}
            quote={latestActor === 'enemy' ? latestQuote : ''}
            onChange={(characterId) => updateCharacter('enemy', characterId)}
          />
        </section>

        {state.winner ? (
          <section className={`tcg-result is-${state.winner}`}>
            {state.winner === 'player' ? '승리했습니다.' : '패배했습니다.'}
            {recordMessage ? <span>{recordMessage}</span> : null}
          </section>
        ) : null}

        <PromptPanel state={state} setState={(updater) => {
          markDirty();
          setState(updater);
        }} />

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
      </section>
    </main>
  );
}
