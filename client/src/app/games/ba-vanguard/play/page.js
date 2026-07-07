'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import BaVanguardFeatureTabs from '../_components/BaVanguardFeatureTabs';
import { RecentActionResult } from '../../_components/GamePlayPrimitives';
import { roomConcurrencyAudit } from '../_components/BaVanguardBoard';
import {
  CARDS,
  DEFAULT_RULES,
  GAME_SLUG,
  PRESET_DECKS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  SIDE_LABELS,
  activateVCAct,
  advancePhase,
  aiStep,
  autoRide,
  callFromHand,
  canAttack,
  cardName,
  deckConsistencyReport,
  declareAttack,
  drawOpeningHand,
  duelTacticalReport,
  endTurn,
  getPreset,
  guardAddFromHand,
  guardEnd,
  guardGGuardian,
  initDuelState,
  mulliganAll,
  normalizeRules,
  playtestMatchupReport,
  retireCircle,
  rideFromHand,
  scoreDeck,
  strideWithAutoCost,
  summarizeDeck,
  summarizeDuel,
  validateDeck,
  vanguardPortingCoverageReport,
  vanguardReplayExportForState,
  vanguardReplayReport,
} from '../_lib/baVanguardCatalog';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function afterRender(task) {
  if (typeof window === 'undefined') return undefined;
  const raf = window.requestAnimationFrame(() => task());
  return () => window.cancelAnimationFrame(raf);
}

export default function BaVanguardPlayPage() {
  return (
    <Suspense fallback={(
      <main className="games-page-shell">
        <section className="games-page">
          <div className="games-empty">BA Vanguard 플레이테스트를 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <BaVanguardPlayContent />
    </Suspense>
  );
}

function BaVanguardPlayContent() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const { showToast } = useToast();
  const [presetId, setPresetId] = useState(PRESET_DECKS[0]?.id || '');
  const [opponentPresetId, setOpponentPresetId] = useState(PRESET_DECKS[1]?.id || PRESET_DECKS[0]?.id || '');
  const [seed, setSeed] = useState(2401);
  const [rules, setRules] = useState(() => normalizeRules(DEFAULT_RULES));
  const [autoGuardMe, setAutoGuardMe] = useState(false);
  const [duel, setDuel] = useState(() => initDuelState({
    meDeck: getPreset(PRESET_DECKS[0]?.id),
    oppDeck: getPreset(PRESET_DECKS[1]?.id || PRESET_DECKS[0]?.id),
    seed: 2401,
    firstTurnNoDraw: rules.firstTurnNoDraw,
  }));
  const [selectedHandIndex, setSelectedHandIndex] = useState(null);
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [busy, setBusy] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [localRoomDirty, setLocalRoomDirty] = useState(false);
  const [roomSyncMessage, setRoomSyncMessage] = useState('');
  const [message, setMessage] = useState('');
  const [zoneView, setZoneView] = useState(null);
  const [gzoneFilter, setGzoneFilter] = useState('all');

  const deck = getPreset(presetId);
  const opponentDeck = getPreset(opponentPresetId);
  const validation = useMemo(() => validateDeck(deck, rules), [deck, rules]);
  const opponentValidation = useMemo(() => validateDeck(opponentDeck, rules), [opponentDeck, rules]);
  const summary = useMemo(() => summarizeDeck(deck), [deck]);
  const openingHand = useMemo(() => drawOpeningHand(deck, seed, 5), [deck, seed]);
  const deckReport = useMemo(() => deckConsistencyReport(deck, seed, rules), [deck, seed, rules]);
  const matchupReport = useMemo(() => playtestMatchupReport(deck, opponentDeck, seed, rules, 20), [deck, opponentDeck, seed, rules]);
  const openingStats = deckReport.opening;
  const compositionRows = deckReport.composition;
  const score = scoreDeck(deck, rules);
  const duelSummary = summarizeDuel(duel);
  const tacticalReport = useMemo(() => duelTacticalReport(duel, 'me'), [duel]);
  const replayReport = useMemo(() => vanguardReplayReport(duel), [duel]);
  const replayExport = useMemo(() => vanguardReplayExportForState({
    duel,
    deck,
    opponentDeck,
    rules,
    seed,
    matchupReport,
  }), [deck, duel, matchupReport, opponentDeck, rules, seed]);
  const portingCoverage = useMemo(() => vanguardPortingCoverageReport(CARDS), []);
  const concurrencyAudit = useMemo(() => roomConcurrencyAudit({
    roomId,
    room,
    localRoomDirty,
    roomSyncMessage,
    roomBusy,
  }), [localRoomDirty, room, roomBusy, roomId, roomSyncMessage]);
  const tacticalTone = tacticalReport.riskLabel === '위험'
    ? 'red'
    : tacticalReport.riskLabel === '주의'
      ? 'gold'
      : tacticalReport.riskLabel === '종료'
        ? 'green'
        : 'violet';
  const playtestSummary = useMemo(() => ({
    presetId,
    opponentPresetId,
    deckName: deck.name,
    opponentDeckName: opponentDeck.name,
    clan: deck.clan,
    rules,
    autoGuardMe,
    score,
    duel: duelSummary,
    tacticalReport: {
      riskLabel: tacticalReport.riskLabel,
      recommendedAction: tacticalReport.recommendedAction,
      readinessPct: tacticalReport.readinessPct,
      damageDelta: tacticalReport.damageDelta,
    },
    replayReport: {
      headline: replayReport.headline,
      damageSwing: replayReport.damageSwing,
      logCount: replayReport.logCount,
      turnCount: replayReport.turnCount,
      guardAudit: replayReport.guardAudit
        ? {
          guardNeeded: replayReport.guardAudit.guardNeeded,
          canGuard: replayReport.guardAudit.canGuard,
        }
        : null,
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
      cardCoveragePct: portingCoverage.completionPct,
      roomSyncPct: concurrencyAudit.completionPct,
      ready: portingCoverage.ready && concurrencyAudit.ready,
      coverageHeadline: portingCoverage.headline,
      roomHeadline: concurrencyAudit.headline,
    },
  }), [autoGuardMe, concurrencyAudit, deck.clan, deck.name, duelSummary, opponentDeck.name, opponentPresetId, portingCoverage, presetId, replayExport, replayReport, rules, score, tacticalReport]);
  const visibleCards = CARDS.filter((card) => card.clan === deck.clan);
  const valid = validation.errors.length === 0 && opponentValidation.errors.length === 0;
  const me = duel.players.me;
  const opp = duel.players.opp;
  const selectedHandId = selectedHandIndex === null ? null : me.hand[selectedHandIndex] || null;
  const canControl = duel.active === 'me' && !duel.winner;
  const canMulligan = canControl && duel.turn === 1 && duel.phase === 'STAND' && !duel.battle && !duel.mulliganDone?.me;

  const markRoomDirty = useCallback(() => {
    if (!roomId) return;
    setLocalRoomDirty(true);
    setRoomSyncMessage('');
  }, [roomId]);

  const mutateDuel = (mutator) => {
    markRoomDirty();
    setDuel((prev) => {
      const next = clone(prev);
      mutator(next);
      return next;
    });
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
    showToast({ tone: 'success', message: `BA Vanguard 리플레이를 준비했습니다. (${replayExport.sizeLabel})` });
  }, [replayExport, showToast]);

  const openZone = (side, zone) => {
    setZoneView({ side, zone });
    if (zone === 'gzone') setGzoneFilter('all');
  };

  const startNewDuel = (nextSeed = seed) => {
    markRoomDirty();
    setDuel(initDuelState({
      meDeck: deck,
      oppDeck: opponentDeck,
      seed: nextSeed,
      first: 'me',
      firstTurnNoDraw: rules.firstTurnNoDraw,
    }));
    setSelectedHandIndex(null);
    setSelectedAttacker(null);
    setZoneView(null);
    setMessage('새 플레이테스트를 시작했습니다.');
  };

  const runAiUntilStop = () => {
    setDuel((prev) => {
      const next = clone(prev);
      for (let index = 0; index < 80; index += 1) {
        if (next.winner) break;
        if (next.battle?.defenderSide === 'me' && !autoGuardMe) break;
        if (next.active === 'me' && !next.battle) break;
        const progressed = aiStep(next, rules.firstTurnNoDraw, autoGuardMe);
        if (!progressed) break;
      }
      return next;
    });
  };

  const nextPhase = () => {
    setSelectedAttacker(null);
    setSelectedHandIndex(null);
    mutateDuel((next) => {
      if (next.phase === 'END') endTurn(next);
      else advancePhase(next, rules.firstTurnNoDraw);
    });
    setTimeout(runAiUntilStop, 0);
  };

  const onMulligan = () => {
    mutateDuel((next) => mulliganAll(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onAutoRide = () => {
    mutateDuel((next) => autoRide(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onRideSelected = () => {
    if (!selectedHandId) return;
    mutateDuel((next) => rideFromHand(next, 'me', selectedHandId));
    setSelectedHandIndex(null);
  };

  const onCallSelected = (circle) => {
    if (!selectedHandId) return;
    mutateDuel((next) => callFromHand(next, 'me', selectedHandId, circle));
    setSelectedHandIndex(null);
  };

  const onRetire = (circle) => {
    mutateDuel((next) => retireCircle(next, 'me', circle));
  };

  const onStride = () => {
    mutateDuel((next) => strideWithAutoCost(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onVCAct = () => {
    mutateDuel((next) => activateVCAct(next, 'me', selectedHandId || undefined));
    setSelectedHandIndex(null);
  };

  const onMyCircleClick = (circle) => {
    if (!canControl) return;
    if (duel.phase === 'BATTLE') {
      if (canAttack(duel, 'me', circle)) setSelectedAttacker((current) => (current === circle ? null : circle));
      return;
    }
    if (duel.phase === 'MAIN' && circle !== 'VC' && me.circles[circle]) onRetire(circle);
  };

  const onOppCircleClick = (circle) => {
    if (!selectedAttacker || !canControl || duel.phase !== 'BATTLE') return;
    mutateDuel((next) => {
      declareAttack(next, selectedAttacker, circle);
      aiStep(next, rules.firstTurnNoDraw, autoGuardMe);
    });
    setSelectedAttacker(null);
  };

  const onGuardAdd = () => {
    if (!selectedHandId) return;
    mutateDuel((next) => guardAddFromHand(next, 'me', selectedHandId));
    setSelectedHandIndex(null);
  };

  const onGGuard = () => {
    mutateDuel((next) => guardGGuardian(next, 'me', selectedHandId || undefined));
    setSelectedHandIndex(null);
  };

  const onGuardEnd = () => {
    mutateDuel((next) => guardEnd(next));
    setSelectedHandIndex(null);
    setTimeout(runAiUntilStop, 0);
  };

  const setRuleOption = (key, value) => {
    markRoomDirty();
    setRules((current) => normalizeRules({ ...current, [key]: value }));
  };

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
  }, []);

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
        summary: playtestSummary,
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
          ...playtestSummary,
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
        summary: playtestSummary,
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

  const actions = (
    <>
      <button type="button" onClick={() => startNewDuel(seed)}>새 듀얼</button>
      <button type="button" onClick={() => {
        markRoomDirty();
        setSeed((current) => current + 1);
      }}>시드 +1</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <button type="button" onClick={downloadReplayExport}>리플레이 저장</button>
      {roomId ? <Link href={`/games/rooms/${roomId}`}>게임방</Link> : <Link href={`/games/rooms?gameSlug=${GAME_SLUG}&create=1`}>방 만들기</Link>}
      {roomId ? <button type="button" onClick={() => void saveRoomState()} disabled={roomBusy}>{roomBusy ? '방 처리 중...' : '방 저장'}</button> : null}
      {roomId ? <button type="button" onClick={reloadRoomState} disabled={roomBusy}>방 불러오기</button> : null}
      <Link href="/myanime/ba-vanguard">상세</Link>
    </>
  );

  const metrics = [
    { label: '카드', value: CARDS.length },
    { label: '턴/페이즈', value: `${duel.turn} · ${duel.phase}` },
    { label: '진행', value: duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례` },
    { label: '내 데미지', value: `${me.damage.length}/6` },
    { label: 'AI 데미지', value: `${opp.damage.length}/6` },
    { label: '판단', value: `${tacticalReport.riskLabel} ${tacticalReport.readinessPct}%` },
    { label: '흐름', value: replayReport.damageSwing >= 0 ? `+${replayReport.damageSwing}` : replayReport.damageSwing },
    { label: '실험 승률', value: `${matchupReport.winRate}%` },
    { label: '리플레이', value: replayExport.statusLabel },
    { label: '이식 감사', value: `${portingCoverage.completionPct}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    roomId && localRoomDirty ? { key: 'room-dirty', text: '게임방에 반영되지 않은 로컬 변경이 있습니다. 방 저장을 누르면 공유됩니다.' } : null,
    roomSyncMessage ? { key: 'room-sync', text: roomSyncMessage } : null,
    roomId && room?.title ? { key: 'room-title', text: `연결된 게임방: ${room.title}` } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이테스트는 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    !valid ? { key: 'invalid', tone: 'error', text: '현재 덱 또는 상대 덱에 규칙 오류가 있습니다. 검증 목록을 확인하세요.' } : null,
    duel.battle?.defenderSide === 'me' ? { key: 'guard', text: '방어 창이 열렸습니다. 패에서 카드를 선택해 가드하거나 바로 가드 종료를 누르세요.' } : null,
  ];
  const recentDuelText = duel.log?.[0] || message || '아직 실행한 듀얼 액션이 없습니다.';

  const guide = {
    title: '듀얼 코치',
    badge: `${tacticalReport.riskLabel} ${tacticalReport.readinessPct}%`,
    primaryTitle: duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : tacticalReport.recommendedAction,
    primaryText: duel.winner
      ? '결과를 기록하거나 리플레이를 내보내 다음 밸런스 조정에 사용하세요.'
      : tacticalReport.headline,
    focusRows: [
      { label: '차례', value: duel.winner ? '종료' : `${SIDE_LABELS[duel.active]} ${duel.phase}` },
      { label: '내 피해', value: `${me.damage.length}/6` },
      { label: 'AI 피해', value: `${opp.damage.length}/6` },
      { label: '흐름', value: replayReport.damageSwing >= 0 ? `+${replayReport.damageSwing}` : replayReport.damageSwing },
    ],
    adviceLines: tacticalReport.recommendations.slice(0, 4).map((item, index) => ({
      kind: item.priority === 'high' ? '우선' : `${index + 1}순위`,
      title: item.title,
      detail: item.detail,
    })),
  };

  return (
    <GamePlayShell
      kicker="BA Vanguard"
      title="BA Vanguard"
      description="myanime 원본의 P-G 플레이테스트 흐름을 사이트용으로 이식했습니다. 라이드, 콜, 스트라이드, 배틀, 가드, 드라이브/데미지 체크, 간단 AI 진행을 한 화면에서 확인합니다."
      summaryLabel="BA Vanguard 현황"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />
      <RecentActionResult label="최근 듀얼 결과" text={recentDuelText} pinned />

      <BaVanguardFeatureTabs
        autoGuardMe={autoGuardMe}
        canControl={canControl}
        canMulligan={canMulligan}
        compositionRows={compositionRows}
        concurrencyAudit={concurrencyAudit}
        deck={deck}
        deckReport={deckReport}
        downloadReplayExport={downloadReplayExport}
        duel={duel}
        gzoneFilter={gzoneFilter}
        markRoomDirty={markRoomDirty}
        matchupReport={matchupReport}
        me={me}
        nextPhase={nextPhase}
        onAutoRide={onAutoRide}
        onCallSelected={onCallSelected}
        onGGuard={onGGuard}
        onGuardAdd={onGuardAdd}
        onGuardEnd={onGuardEnd}
        onMulligan={onMulligan}
        onMyCircleClick={onMyCircleClick}
        onOppCircleClick={onOppCircleClick}
        onRetire={onRetire}
        onRideSelected={onRideSelected}
        onStride={onStride}
        onVCAct={onVCAct}
        openZone={openZone}
        openingHand={openingHand}
        openingStats={openingStats}
        opp={opp}
        opponentPresetId={opponentPresetId}
        opponentValidation={opponentValidation}
        portingCoverage={portingCoverage}
        presetId={presetId}
        replayExport={replayExport}
        replayReport={replayReport}
        rules={rules}
        runAiUntilStop={runAiUntilStop}
        seed={seed}
        selectedAttacker={selectedAttacker}
        selectedHandId={selectedHandId}
        selectedHandIndex={selectedHandIndex}
        setAutoGuardMe={setAutoGuardMe}
        setGzoneFilter={setGzoneFilter}
        setOpponentPresetId={setOpponentPresetId}
        setPresetId={setPresetId}
        setRuleOption={setRuleOption}
        setSeed={setSeed}
        setSelectedHandIndex={setSelectedHandIndex}
        setZoneView={setZoneView}
        startNewDuel={startNewDuel}
        summary={summary}
        tacticalReport={tacticalReport}
        tacticalTone={tacticalTone}
        valid={valid}
        validation={validation}
        visibleCards={visibleCards}
        zoneView={zoneView}
      />
    </GamePlayShell>
  );
}
