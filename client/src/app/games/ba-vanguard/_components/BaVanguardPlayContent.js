'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GameActionIcon from '../../_components/GameActionIcon';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import BaVanguardFeatureTabs from './BaVanguardFeatureTabs';
import { roomConcurrencyAudit } from './BaVanguardBoard';
import { useBaVanguardPersistence } from '../_hooks/useBaVanguardPersistence';
import {
  baVanguardFeedbackCue,
  baVanguardFeedbackSnapshot,
} from '../_lib/baVanguardFeedback';
import { createBaVanguardPlaytestSummary } from '../_lib/baVanguardPageRuntime';
import {
  CARDS,
  DEFAULT_RULES,
  GAME_SLUG,
  PRESET_DECKS,
  SIDE_LABELS,
  activateVCAct,
  advancePhase,
  aiStep,
  autoRide,
  callFromHand,
  canAttack,
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

const AI_FEEDBACK_DELAY_MS = 180;

export default function BaVanguardPlayContent() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'card' });
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
  const [zoneView, setZoneView] = useState(null);
  const [gzoneFilter, setGzoneFilter] = useState('all');
  const feedbackRef = useRef(baVanguardFeedbackSnapshot(duel));

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
  const {
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
  } = useBaVanguardPersistence({
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
  });

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
  const playtestSummary = useMemo(() => createBaVanguardPlaytestSummary({
    autoGuardMe,
    concurrencyAudit,
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
  }), [autoGuardMe, concurrencyAudit, deck, duelSummary, opponentDeck, opponentPresetId, portingCoverage, presetId, replayExport, replayReport, rules, score, tacticalReport]);
  const visibleCards = CARDS.filter((card) => card.clan === deck.clan);
  const valid = validation.errors.length === 0 && opponentValidation.errors.length === 0;
  const me = duel.players.me;
  const opp = duel.players.opp;
  const selectedHandId = selectedHandIndex === null ? null : me.hand[selectedHandIndex] || null;
  const canControl = duel.active === 'me' && !duel.winner;
  const canMulligan = canControl && duel.turn === 1 && duel.phase === 'STAND' && !duel.battle && !duel.mulliganDone?.me;

  useEffect(() => {
    const current = baVanguardFeedbackSnapshot(duel);
    const cue = baVanguardFeedbackCue(feedbackRef.current, current);
    if (cue) playGameSfx(cue);
    feedbackRef.current = current;
  }, [duel, playGameSfx]);


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
    playGameSfx('vanguardStart');
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
    setTimeout(runAiUntilStop, AI_FEEDBACK_DELAY_MS);
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
    setTimeout(runAiUntilStop, AI_FEEDBACK_DELAY_MS);
  };

  const setRuleOption = (key, value) => {
    markRoomDirty();
    setRules((current) => normalizeRules({ ...current, [key]: value }));
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={() => startNewDuel(seed)}>새 듀얼</GameControlButton>
      <GameControlButton action="shuffle" onClick={() => {
        markRoomDirty();
        setSeed((current) => current + 1);
      }}>시드 +1</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <GameControlButton action="replay" onClick={downloadReplayExport}>리플레이 저장</GameControlButton>
      {roomId ? (
        <Link className="game-control-button" data-game-sfx="nav" href={`/games/rooms/${roomId}`}>
          <GameActionIcon action="diplomacy" label="게임방" />
          <span className="game-action-button__label">게임방</span>
        </Link>
      ) : (
        <Link className="game-control-button" data-game-sfx="nav" href={`/games/rooms?gameSlug=${GAME_SLUG}&create=1`}>
          <GameActionIcon action="diplomacy" label="방 만들기" />
          <span className="game-action-button__label">방 만들기</span>
        </Link>
      )}
      {roomId ? <GameControlButton action="save" onClick={() => void saveRoomState()} disabled={roomBusy}>{roomBusy ? '방 처리 중...' : '방 저장'}</GameControlButton> : null}
      {roomId ? <GameControlButton action="load" onClick={reloadRoomState} disabled={roomBusy}>방 불러오기</GameControlButton> : null}
      <Link className="game-control-button" data-game-sfx="nav" href="/myanime/ba-vanguard">
        <GameActionIcon action="settings" label="상세" />
        <span className="game-action-button__label">상세</span>
      </Link>
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
      className="ba-vanguard-page-shell"
      kicker="BA Vanguard"
      title="BA Vanguard"
      description="myanime 원본의 P-G 플레이테스트 흐름을 사이트용으로 이식했습니다. 라이드, 콜, 스트라이드, 배틀, 가드, 드라이브/데미지 체크, 간단 AI 진행을 한 화면에서 확인합니다."
      heroLayout="compact"
      summaryLabel="BA Vanguard 현황"
      summaryDensity="micro"
      primaryMetricLimit={9}
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="ba-vanguard-duel-coach" />
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
