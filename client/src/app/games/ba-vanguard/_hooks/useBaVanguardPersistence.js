import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { roomConcurrencyAudit } from '../_components/BaVanguardBoard';
import { createBaVanguardPlaytestSummary } from '../_lib/baVanguardPageRuntime';
import {
  GAME_SLUG,
  PRESET_DECKS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  cardName,
  getPreset,
  initDuelState,
  normalizeRules,
} from '../_lib/baVanguardCatalog';

function afterRender(task) {
  if (typeof window === 'undefined') return undefined;
  const raf = window.requestAnimationFrame(() => task());
  return () => window.cancelAnimationFrame(raf);
}

export function useBaVanguardPersistence({
  autoGuardMe,
  deck,
  duel,
  duelSummary,
  hydrated,
  openingHand,
  opponentDeck,
  opponentPresetId,
  portingCoverage,
  presetId,
  replayExport,
  replayReport,
  roomId,
  rules,
  score,
  seed,
  showToast,
  tacticalReport,
  token,
  validation,
  setAutoGuardMe,
  setDuel,
  setOpponentPresetId,
  setPresetId,
  setRules,
  setSeed,
  setSelectedAttacker,
  setSelectedHandIndex,
  setZoneView,
}) {
  const [busy, setBusy] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [localRoomDirty, setLocalRoomDirty] = useState(false);
  const [roomSyncMessage, setRoomSyncMessage] = useState('');
  const [message, setMessage] = useState('');

  const markRoomDirty = useCallback(() => {
    if (!roomId) return;
    setLocalRoomDirty(true);
    setRoomSyncMessage('');
  }, [roomId]);

  const createCurrentPlaytestSummary = () => createBaVanguardPlaytestSummary({
    autoGuardMe,
    concurrencyAudit: roomConcurrencyAudit({
      roomId,
      room,
      localRoomDirty,
      roomSyncMessage,
      roomBusy,
    }),
    deck,
    duelSummary,
    opponentDeck,
    opponentPresetId,
    portingCoverage,
    presetId,
    replayExport,
    replayReport,
    rules,
    score,
    tacticalReport,
  });

  const applyRoomState = useCallback((nextRoom, options = {}) => {
    if (!nextRoom) {
      setMessage('게임방을 찾을 수 없습니다.');
      return false;
    }
    setRoom(nextRoom);
    if (nextRoom.gameSlug !== GAME_SLUG) {
      setMessage('이 게임방은 BA Vanguard 방이 아닙니다.');
      return false;
    }

    const roomState = nextRoom.state && typeof nextRoom.state === 'object' ? nextRoom.state : {};
    if (!roomState.duel) {
      setRoomSyncMessage('');
      setMessage(options.emptyMessage || '게임방에 저장된 플레이테스트 상태가 없어 현재 설정을 유지합니다.');
      return false;
    }

    const nextPreset = getPreset(roomState.presetId)?.id || PRESET_DECKS[0].id;
    const nextOpp = getPreset(roomState.opponentPresetId)?.id || PRESET_DECKS[1]?.id || PRESET_DECKS[0].id;
    const nextRules = normalizeRules(roomState.rules);
    const nextSeed = Number(roomState.seed || 2401);
    setPresetId(nextPreset);
    setOpponentPresetId(nextOpp);
    setSeed(nextSeed);
    setRules(nextRules);
    setAutoGuardMe(Boolean(roomState.autoGuardMe));
    setDuel(roomState.duel);
    setSelectedHandIndex(null);
    setSelectedAttacker(null);
    setZoneView(null);
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
    setMessage(options.message || '게임방 플레이테스트 상태를 불러왔습니다.');
    return true;
  }, [setAutoGuardMe, setDuel, setOpponentPresetId, setPresetId, setRules, setSeed, setSelectedAttacker, setSelectedHandIndex, setZoneView]);

  useEffect(() => {
    return afterRender(() => {
      setRoom(null);
      setRoomLoaded(false);
      setLocalRoomDirty(false);
      setRoomSyncMessage('');
    });
  }, [roomId]);

  useEffect(() => {
    if (!hydrated || !roomId || !token || roomLoaded) return;
    let cancelled = false;
    const loadRoomState = async () => {
      setRoomBusy(true);
      try {
        const payload = await apiGet(`/game-rooms/${roomId}`, { timeoutMs: 12000 });
        if (!cancelled) {
          applyRoomState(payload?.room || null, {
            message: '게임방 플레이테스트 상태를 불러왔습니다.',
            emptyMessage: '게임방에 저장된 플레이테스트 상태가 없어 현재 설정을 유지합니다.',
          });
          setRoomLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          const nextMessage = err?.message || '게임방 상태를 불러오지 못했습니다.';
          setMessage(nextMessage);
          showToast({ tone: 'danger', message: nextMessage });
          setRoomLoaded(true);
        }
      } finally {
        if (!cancelled) setRoomBusy(false);
      }
    };
    void loadRoomState();
    return () => {
      cancelled = true;
    };
  }, [applyRoomState, hydrated, roomId, roomLoaded, showToast, token]);

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA Vanguard 플레이테스트 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `BA Vanguard ${deck.name}`,
        version: SAVE_VERSION,
        summary: createCurrentPlaytestSummary(),
        payload: { presetId, opponentPresetId, seed, rules, autoGuardMe, duel },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('BA Vanguard 플레이테스트 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 플레이테스트 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 BA Vanguard 플레이테스트 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 BA Vanguard 플레이테스트 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const nextPreset = getPreset(payload.presetId)?.id || PRESET_DECKS[0].id;
      const nextOpp = getPreset(payload.opponentPresetId)?.id || PRESET_DECKS[1]?.id || PRESET_DECKS[0].id;
      const nextSeed = Number(payload.seed || 2401);
      const nextRules = normalizeRules(payload.rules);
      setPresetId(nextPreset);
      setOpponentPresetId(nextOpp);
      setSeed(nextSeed);
      setRules(nextRules);
      setAutoGuardMe(Boolean(payload.autoGuardMe));
      setDuel(payload.duel || initDuelState({
        meDeck: getPreset(nextPreset),
        oppDeck: getPreset(nextOpp),
        seed: nextSeed,
        firstTurnNoDraw: nextRules.firstTurnNoDraw,
      }));
      setSelectedHandIndex(null);
      setSelectedAttacker(null);
      setZoneView(null);
      if (roomId) {
        setLocalRoomDirty(true);
        setRoomSyncMessage('');
      }
      setMessage('저장된 BA Vanguard 플레이테스트 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 BA Vanguard 플레이테스트 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA Vanguard 플레이테스트 결과를 전적에 기록할 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `BA Vanguard - ${deck.name}`,
        mode: 'playtest',
        result: duel.winner ? (duel.winner === 'me' ? 'win' : 'loss') : 'in-progress',
        score: score + (duel.winner === 'me' ? 300 : 0),
        playTimeSec: 0,
        summary: {
          ...createCurrentPlaytestSummary(),
          openingHand: openingHand.map(cardName),
        },
        payload: { presetId, opponentPresetId, seed, rules, deck, opponentDeck, validation, duel },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('BA Vanguard 플레이테스트 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 플레이테스트 결과를 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const saveRoomState = async () => {
    if (!roomId) {
      setMessage('연결된 게임방이 없습니다.');
      return;
    }
    if (!token || roomBusy) {
      setMessage('로그인하면 게임방에 플레이테스트 상태를 저장할 수 있습니다.');
      return;
    }
    setRoomBusy(true);
    try {
      const payload = await apiPost(`/game-rooms/${roomId}/state`, {
        revision: room?.revision,
        summary: createCurrentPlaytestSummary(),
        state: {
          presetId,
          opponentPresetId,
          seed,
          rules,
          autoGuardMe,
          saveVersion: SAVE_VERSION,
          duel,
        },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-rooms');
      setRoom(payload?.room || room);
      setLocalRoomDirty(false);
      setRoomSyncMessage('');
      setMessage('게임방에 BA Vanguard 상태를 저장했습니다.');
      showToast({ tone: 'success', message: '게임방에 BA Vanguard 상태를 저장했습니다.' });
    } catch (err) {
      const conflictRoom = err?.response?.data?.room;
      if (conflictRoom) setRoom(conflictRoom);
      const nextMessage = err?.message || '게임방 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setRoomBusy(false);
    }
  };

  const reloadRoomState = () => {
    if (!roomId || roomBusy) return;
    setLocalRoomDirty(false);
    setRoomSyncMessage('');
    setRoomLoaded(false);
  };

  return {
    busy,
    loadRun,
    localRoomDirty,
    markRoomDirty,
    message,
    recordRun,
    reloadRoomState,
    room,
    roomBusy,
    roomSyncMessage,
    saveRoomState,
    saveRun,
    setMessage,
  };
}
