'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import { RecentActionResult } from '../../_components/GamePlayPrimitives';
import DualAcademyTcgFeatureTabs from '../_components/DualAcademyTcgFeatureTabs';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  TCG_GAME_SLUG,
  getTcgCharacter,
  normalizeCards,
  normalizeTcgCharacters,
  renderTcgQuote,
} from '../_lib/tcgCatalog';
import {
  ENGINE_VERSION,
  PLAYER_LABELS,
  QUICK_SAVE_SLOT,
  activateFromHand,
  activateFieldIgnition,
  activateHinaIgnition,
  activateSetCard,
  activateYuukaQuick,
  advancePhase,
  autoPlayEnemy,
  autoPlayPlayer,
  cardEffectCoverageReport,
  chooseTarget,
  changeMonsterPosition,
  createDuelState,
  declareAttack,
  matchReportForState,
  normalizeDuelState,
  normalSummon,
  passResponse,
  replayExportForState,
  replayTimelineForState,
  resolveChain,
  serializeDuelState,
  setSpellTrap,
  summarizeDuel,
  turnAdvisorForState,
} from '../_lib/tcgDuelEngine';
import { afterRender, buildZoneInspection } from '../_lib/tcgPlayPageRuntime';

import {
  CharacterPanel,
  KeywordBadges,
  PlayerField,
  PromptPanel,
  ZoneArchivePanel,
  cardAtk,
  cardKind,
  firstEmptySlot,
  getPlayTimeSec,
  roomConcurrencyAudit,
  subType,
} from '../_components/TcgPlayBoard';

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
  const [activeTcgTab, setActiveTcgTab] = useState('board');
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
    afterRender(() => void loadDeck());
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
    let cancelled = false;
    afterRender(() => {
      if (cancelled) return;
      setRoom(null);
      setRoomLoaded(false);
      setLocalRoomDirty(false);
      setRoomSyncMessage('');
    });
    return () => {
      cancelled = true;
    };
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

  const turnAdvisor = useMemo(() => turnAdvisorForState(state, 'player'), [state]);
  const advisorTone = turnAdvisor.riskLabel === '위험'
    ? 'red'
    : turnAdvisor.riskLabel === '주의'
      ? 'gold'
      : turnAdvisor.riskLabel === '종료'
        ? 'green'
        : 'violet';
  const summary = summarizeDuel(state);
  const matchReport = useMemo(() => matchReportForState(state), [state]);
  const replayTimeline = useMemo(() => replayTimelineForState(state), [state]);
  const replayExport = useMemo(() => replayExportForState(state), [state]);
  const effectCoverage = useMemo(() => cardEffectCoverageReport(cardCatalog), [cardCatalog]);
  const zoneInspection = useMemo(() => buildZoneInspection(state, turnAdvisor), [state, turnAdvisor]);
  const concurrencyAudit = useMemo(() => roomConcurrencyAudit({
    roomId,
    room,
    localRoomDirty,
    roomSyncMessage,
    roomBusy,
  }), [localRoomDirty, room, roomBusy, roomId, roomSyncMessage]);
  const matchReportSummary = useMemo(() => ({
    headline: matchReport.headline,
    eventCount: matchReport.eventCount,
    lpDiff: matchReport.lpDiff,
    winnerLabel: matchReport.winnerLabel,
    playerTempo: matchReport.players.player.tempoScore,
    enemyTempo: matchReport.players.enemy.tempoScore,
    playerDamageDealt: matchReport.players.player.damageDealt,
    enemyDamageDealt: matchReport.players.enemy.damageDealt,
    turnAdvisor: {
      riskLabel: turnAdvisor.riskLabel,
      recommendedAction: turnAdvisor.recommendedAction,
      readinessPct: turnAdvisor.readinessPct,
      boardDelta: turnAdvisor.boardDelta,
    },
    replayTimeline: {
      headline: replayTimeline.headline,
      totalSwing: replayTimeline.totalSwing,
      chainStatus: replayTimeline.chainStatus,
      turnCount: replayTimeline.turnCount,
    },
    replayExport: {
      fileName: replayExport.fileName,
      sizeLabel: replayExport.sizeLabel,
      statusLabel: replayExport.statusLabel,
      ready: replayExport.ready,
      auditRows: replayExport.auditRows.map((row) => ({
        id: row.id,
        label: row.label,
        status: row.status,
      })),
    },
    portingAudit: {
      effectCoveragePct: effectCoverage.completionPct,
      roomSyncPct: concurrencyAudit.completionPct,
      ready: effectCoverage.ready && concurrencyAudit.ready,
      effectHeadline: effectCoverage.headline,
      roomHeadline: concurrencyAudit.headline,
    },
  }), [concurrencyAudit, effectCoverage, matchReport, replayExport, replayTimeline, turnAdvisor]);

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
            matchReport: matchReportSummary,
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
  }, [deckCardIds, deckName, matchReportSummary, mounted, recordedMatchIds, room?.hostId, roomId, state, token]);

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
  const recentActionText = latestEvent
    ? `T${latestEvent.turn} · ${latestEvent.phase} · ${PLAYER_LABELS[latestEvent.actor] || latestEvent.actor}: ${latestEvent.text}`
    : state.log?.[0] || deckMessage || '아직 실행한 듀얼 액션이 없습니다.';
  const selectedCard = state.players.player.hand.find((card) => card.instanceId === selectedHandId) || null;
  const canAct = !state.winner && state.turnPlayer === 'player' && state.prompt.kind === 'NONE' && state.chain.length === 0;
  const canMain = canAct && (state.phase === 'MAIN1' || state.phase === 'MAIN2');
  const canAutoPlayPlayer = !state.winner
    && (state.turnPlayer === 'player' || state.prompt.player === 'player')
    && !(state.prompt.kind === 'NONE' && state.chain.length > 0);
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
    if (!state.players.player.hand.some((card) => card.instanceId === selectedHandId)) {
      afterRender(() => setSelectedHandId(''));
    }
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

  const downloadReplayExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([replayExport.jsonText], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = replayExport.fileName;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    showToast({ tone: 'success', message: `리플레이 파일을 준비했습니다. (${replayExport.sizeLabel})` });
  }, [replayExport, showToast]);

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
          matchReport: matchReportSummary,
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
          matchReport: matchReportSummary,
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
    setActiveTcgTab('logs');
  };

  const tcgGuide = {
    title: '턴 코치',
    badge: `${turnAdvisor.riskLabel} ${turnAdvisor.readinessPct}%`,
    primaryTitle: state.winner ? `${PLAYER_LABELS[state.winner]} 승리` : turnAdvisor.recommendedAction,
    primaryText: state.winner
      ? '매치 리포트와 리플레이를 확인한 뒤 저장하거나 새 매치를 시작하세요.'
      : turnAdvisor.headline,
    focusRows: [
      { label: '차례', value: state.winner ? '종료' : `${PLAYER_LABELS[state.turnPlayer]} ${state.phase}` },
      { label: '내 LP', value: state.players.player.lp },
      { label: 'AI LP', value: state.players.enemy.lp },
      { label: '보드', value: turnAdvisor.boardDelta >= 0 ? `+${turnAdvisor.boardDelta}` : turnAdvisor.boardDelta },
    ],
    adviceLines: turnAdvisor.recommendations.slice(0, 4).map((item, index) => ({
      kind: item.priority === 'high' ? '우선' : `${index + 1}순위`,
      title: item.title,
      detail: item.detail,
    })),
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
            <button type="button" onClick={downloadReplayExport}>리플레이 저장</button>
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

        <GameAdvisorPanel {...tcgGuide} />
        <RecentActionResult label="최근 듀얼 이벤트" text={recentActionText} pinned />

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

        <DualAcademyTcgFeatureTabs
          act={act}
          activeTcgTab={activeTcgTab}
          advisorTone={advisorTone}
          canAct={canAct}
          canAutoPlayPlayer={canAutoPlayPlayer}
          canMain={canMain}
          concurrencyAudit={concurrencyAudit}
          deckMessage={deckMessage}
          deckName={deckName}
          downloadReplayExport={downloadReplayExport}
          effectCoverage={effectCoverage}
          latestCharacter={latestCharacter}
          latestQuote={latestQuote}
          loadingDeck={loadingDeck}
          matchReport={matchReport}
          monsterEffectRows={monsterEffectRows}
          openZoneView={openZoneView}
          playSelected={playSelected}
          promptTargets={promptTargets}
          replayExport={replayExport}
          replayTimeline={replayTimeline}
          selectedAttacker={selectedAttacker}
          selectedCard={selectedCard}
          selectedHandId={selectedHandId}
          setActiveTcgTab={setActiveTcgTab}
          setSelectedAttacker={setSelectedAttacker}
          setSelectedHandId={setSelectedHandId}
          setState={setState}
          setZoneView={setZoneView}
          state={state}
          turnAdvisor={turnAdvisor}
          zoneInspection={zoneInspection}
          zoneView={zoneView}
        />
      </section>
    </main>
  );
}
