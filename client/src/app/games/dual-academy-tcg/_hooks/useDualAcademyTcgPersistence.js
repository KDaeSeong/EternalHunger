'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  TCG_GAME_SLUG,
  normalizeCards,
  normalizeTcgCharacters,
} from '../_lib/tcgCatalog';
import {
  ENGINE_VERSION,
  QUICK_SAVE_SLOT,
  cardEffectCoverageReport,
  createDuelState,
  matchReportForState,
  normalizeDuelState,
  replayExportForState,
  replayTimelineForState,
  serializeDuelState,
  summarizeDuel,
  turnAdvisorForState,
} from '../_lib/tcgDuelEngine';
import { afterRender } from '../_lib/tcgPlayPageRuntime';
import { getPlayTimeSec, roomConcurrencyAudit } from '../_components/TcgPlayBoard';

export default function useDualAcademyTcgPersistence({
  mounted,
  roomId,
  setSelectedAttacker,
  setSelectedHandId,
  setState,
  setZoneView,
  showToast,
  state,
  token,
}) {
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

  const resetTransientSelection = useCallback(() => {
    setSelectedHandId('');
    setSelectedAttacker(null);
    setZoneView(null);
  }, [setSelectedAttacker, setSelectedHandId, setZoneView]);

  const resetWithDeck = useCallback((cardIds, cards, characters = null) => {
    setRecordMessage('');
    resetTransientSelection();
    setState(createDuelState({
      deckCardIds: cardIds,
      cardCatalog: cards,
      characters: normalizeTcgCharacters(characters),
    }));
  }, [resetTransientSelection, setState]);

  const buildMatchReportSummary = useCallback(() => {
    const turnAdvisor = turnAdvisorForState(state, 'player');
    const matchReport = matchReportForState(state);
    const replayTimeline = replayTimelineForState(state);
    const replayExport = replayExportForState(state);
    const effectCoverage = cardEffectCoverageReport(cardCatalog);
    const concurrencyAudit = roomConcurrencyAudit({
      roomId,
      room,
      localRoomDirty,
      roomSyncMessage,
      roomBusy,
    });

    return {
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
    };
  }, [cardCatalog, localRoomDirty, room, roomBusy, roomId, roomSyncMessage, state]);

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
    resetTransientSelection();
    setState(restored);
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
    setDeckMessage(options.message || '게임방 매치를 불러왔습니다.');
    return true;
  }, [deckCardIds, deckName, resetTransientSelection, setState]);

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
            matchReport: buildMatchReportSummary(),
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
  }, [buildMatchReportSummary, deckCardIds, deckName, mounted, recordedMatchIds, room?.hostId, roomId, state, token]);

  const markDirty = useCallback(() => {
    if (roomId) {
      setLocalRoomDirty(true);
      setRoomSyncMessage('');
    }
  }, [roomId]);

  const saveMatch = async () => {
    if (!token || saveBusy) {
      setDeckMessage('로그인하면 현재 매치를 저장할 수 있습니다.');
      return;
    }
    setSaveBusy(true);
    try {
      const summary = summarizeDuel(state);
      await apiPut(`/game-saves/${TCG_GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `${deckName} ${state.turn}턴`,
        version: ENGINE_VERSION,
        summary: {
          deckName,
          ...summary,
          matchReport: buildMatchReportSummary(),
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
      resetTransientSelection();
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
      const summary = summarizeDuel(state);
      const payload = await apiPost(`/game-rooms/${roomId}/state`, {
        revision: room?.revision,
        summary: {
          deckName,
          ...summary,
          matchReport: buildMatchReportSummary(),
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

  return {
    cardCatalog,
    deckMessage,
    deckName,
    loadingDeck,
    loadMatch,
    localRoomDirty,
    markDirty,
    recordMessage,
    reloadRoomMatch,
    resetMatch,
    room,
    roomBusy,
    roomSyncMessage,
    saveBusy,
    saveMatch,
    saveRoomMatch,
    setDeckMessage,
  };
}
