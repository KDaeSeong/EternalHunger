'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import SimulationHydrationPanel from './_components/SimulationHydrationPanel';
import SimulationPageView from './_components/SimulationPageView';
import '../../styles/ERSimulation.css';

import { areCharacterSkillsEnabled } from './_lib/characterSkillRuntime';
import {
  applyMatchTeams,
  normalizeMatchMode,
} from './_lib/matchRosterRuntime';
import {
  buildActorAvatarByName,
  buildActorTeamState,
  buildCharacterSkillModeSettings,
  buildCharacterSkillsToggleSettings,
  fireAndReport,
  getActiveMapForForbiddenZones,
  getClientHydrationSnapshot,
  getDefaultSimulationSettings,
  getPreferredHyperloopCharId,
  getServerHydrationSnapshot,
  safeRenderCompute,
  subscribeHydration,
} from './_lib/simulationPageRuntime';
import { useSimEquipmentPersistence } from './_lib/useSimEquipmentPersistence';
import { useSimulationInitialData } from './_lib/useSimulationInitialData';
import { useSimulationRuntimeGuards } from './_lib/useSimulationRuntimeGuards';
import { useHyperloopPickLog } from './_lib/useHyperloopPickLog';
import { logRuntimeEffectResults } from './_lib/runtimeStatus';
import { useSimulationMarketState } from './_lib/useSimulationMarketState';
import { useSimulationMarketActions } from './_lib/useSimulationMarketActions';
import { useSimulationMapActions } from './_lib/useSimulationMapActions';
import { useSimulationDevToolActions } from './_lib/useSimulationDevToolActions';
import { useSimulationPhaseController } from './_lib/useSimulationPhaseController';
import { useSimulationLogs } from './_lib/useSimulationLogs';
import { useSimulationRunSeed } from './_lib/useSimulationRunSeed';
import { useSimulationFlowState } from './_lib/useSimulationFlowState';
import { useSimulationUiModal } from './_lib/useSimulationUiModal';
import { useSimulationDerivedData } from './_lib/useSimulationDerivedData';
import { useSimulationMapState } from './_lib/useSimulationMapState';
import { useSimulationParticipantPresets } from './_lib/useSimulationParticipantPresets';
import { useSimulationEventActions } from './_lib/useSimulationEventActions';

const MARKET_CARD_RENDER_LIMIT = 40;
const DEV_SELECT_RENDER_LIMIT = 80;
const DEV_EVENT_PREVIEW_LIMIT = 80;

export default function SimulationPage() {
  const hasHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const [survivors, setSurvivors] = useState([]);
  const [candidateSurvivors, setCandidateSurvivors] = useState([]);
  const [dead, setDead] = useState([]);
  const [forbiddenAddedNow, setForbiddenAddedNow] = useState([]);

  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState('night');
  // ⏱ 경기 경과 시간(초) - 하이브리드(페이즈 버튼 + 내부 틱)에서 기준이 되는 절대 시간
  const [matchSec, setMatchSec] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  // 킬 카운트 및 결과창 관리
  const [killCounts, setKillCounts] = useState({});
  const [assistCounts, setAssistCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameEndReason, setGameEndReason] = useState(null); // 게임 종료 사유(예: 6번째 밤 타임리밋)
  const [winner, setWinner] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);

  // 서버 설정값
  const [settings, setSettings] = useState(getDefaultSimulationSettings);
  const {
    addLog: addLogFromLogs,
    addLogRef,
    emitRunEvent: emitRunEventFromLogs,
    exportBattleLog: exportBattleLogFromLogs,
    fullLogEntriesRef,
    fullLogsRef,
    logBoxMaxH,
    logBoxRef,
    logWindowRef,
    logs,
    prevPhaseLogs,
    resetPhaseLogs,
    runEvents,
    setPrevPhaseLogs,
    setRunEvents,
    setShowDetailedLogs,
    setShowPrevLogs,
    showDetailedLogs,
    showPrevLogs,
  } = useSimulationLogs({
    day,
    matchSec,
    phase,
    exportState: {
      assistCounts,
      killCounts,
      resultSummary,
      settings,
      winner,
    },
  });
  const getTeamStateForActor = (actor) => buildActorTeamState(actor, settings, survivors, dead);

  const handleMatchModeChange = (value) => {
    const matchMode = normalizeMatchMode(value);
    const nextSettings = { ...(settings || {}), matchMode };
    try {
      window.localStorage.setItem('eh_sim_match_mode', matchMode);
    } catch {}
    setSettings(nextSettings);
    if (day === 0 && !isGameOver) {
      setSurvivors((prev) => applyMatchTeams(prev, nextSettings));
    }
  };

  const characterSkillsEnabled = areCharacterSkillsEnabled(buildCharacterSkillModeSettings(settings));

  const handleCharacterSkillsToggle = (enabled) => {
    const on = !!enabled;
    const nextSettings = buildCharacterSkillsToggleSettings(settings, on);
    try {
      window.localStorage.setItem('eh_sim_character_skills', on ? '1' : '0');
    } catch {}
    setSettings(nextSettings);
  };

  // 🪟 UI 모달(미니맵/캐릭터/로그)
  const { closeUiModal, setUiModal, uiModal } = useSimulationUiModal();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onError = (event) => {
      console.error('[simulation:window.error]', event?.error || event?.message || event);
    };
    const onUnhandledRejection = (event) => {
      console.error('[simulation:window.unhandledrejection]', event?.reason || event);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const isFinishingRef = useRef(false);
  // ✅ 시작(1일차 낮) 기본 장비 세팅이 1회만 적용되도록 플래그
  const startStarterLoadoutAppliedRef = useRef(false);
  const persistSimEquipmentsFromChars = useSimEquipmentPersistence();

  // SD 서든데스(6번째 밤 이후): 페이즈 고정 + 전 구역 금지구역 + 카운트다운
  const suddenDeathActiveRef = useRef(false);
  const suddenDeathEndAtSecRef = useRef(null);
  const suddenDeathForbiddenAnnouncedRef = useRef(false);


  // 로그에서 [이름]을 파싱해 아이콘을 붙이기 위한 캐시
  const actorAvatarByName = safeRenderCompute(
    'actorAvatarByName',
    () => buildActorAvatarByName(survivors, dead),
    {}
  );

  // ✅ 상점/조합/교환 패널
  const {
    activeViewerPerkBundle,
    applyUserEconomyProgress,
    craftables,
    credits,
    devGrantItemId,
    devGrantItemOptions,
    devGrantQty,
    devGrantSearch,
    droneOffers,
    getQty,
    inventoryOptions,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    loadMarket,
    loadTrades,
    marketMessage,
    marketTab,
    myTradeOffers,
    ownedPerkCodeSet,
    patchServerCharacterState,
    pendingTranscendPick,
    publicItems,
    publicPerks,
    runEventsPreviewText,
    selectedChar,
    selectedCharId,
    selectedDevGrantItem,
    selectMarketTab,
    setCredits,
    setDevGrantItemId,
    setDevGrantQty,
    setDevGrantSearch,
    setDroneOffers,
    setKiosks,
    setMarketMessage,
    setMyTradeOffers,
    setPendingTranscendPick,
    setPublicItems,
    setPublicPerks,
    setQty,
    setSelectedCharId,
    setShowAllMarketRows,
    setShowDevDebugDetails,
    setShowDevEventLog,
    setShowMarketPanel,
    setTradeDraft,
    setTradeOffers,
    setTradeWantSearch,
    setViewerLp,
    setViewerPerks,
    showAllMarketRows,
    showDevDebugDetails,
    showDevEventLog,
    showMarketPanel,
    syncMyState,
    tradeDraft,
    tradeOffers,
    tradeWantItemOptions,
    tradeWantSearch,
    viewerLp,
    viewerPerks,
    visibleCraftables,
    visibleDevGrantItemOptions,
    visibleDroneOffers,
    visibleKiosks,
    visibleMyTradeOffers,
    visiblePublicPerks,
    visibleTradeOffers,
  } = useSimulationMarketState({
    devEventPreviewLimit: DEV_EVENT_PREVIEW_LIMIT,
    devSelectRenderLimit: DEV_SELECT_RENDER_LIMIT,
    fireAndReport,
    marketCardRenderLimit: MARKET_CARD_RENDER_LIMIT,
    runEvents,
    setDead,
    setSurvivors,
    survivors,
  });
  const {
    activeMap,
    activeMapId,
    activeMapIdRef,
    activeMapName,
    activeMapRef,
    applyActiveMapId,
    baseZoneGraph,
    getZoneName,
    hyperloopDestId,
    hyperloopDestIds,
    hyperloopPadName,
    hyperloopPadZoneId,
    hyperloopZoneSet,
    isHyperloopTransit,
    isSelectedCharOnHyperloopPad,
    maps,
    mapsRef,
    setHyperloopDestId,
    setMaps,
    setSpawnState,
    spawnState,
    zoneGraph,
    zoneNameById,
    zones,
  } = useSimulationMapState({
    selectedCharId,
    survivors,
  });

  const hyperloopCharId = getPreferredHyperloopCharId(selectedCharId, survivors);
  const forbiddenCacheRef = useRef({});
  // ✅ UI용 logs는 "현재 페이즈"만 보여주고, 전체 기록은 따로 누적합니다.

  // ▶️ 오토 플레이(페이즈 자동 진행)
  // - "틱 기반"은 페이즈 내부를 초 단위로 계산하는 엔진이고,
  // - 오토 플레이는 "다음 페이즈" 버튼을 일정 간격으로 자동 눌러주는 UX입니다.
  const {
    autoPlay,
    autoSpeed,
    autoSpeedRef,
    isAdvancing,
    isAdvancingRef,
    isRefreshingMapsRef,
    isRefreshingMapSettings,
    mapRefreshToast,
    normalizeAutoSpeed,
    proceedPhaseGuardedRef,
    setAutoPlay,
    setIsAdvancing,
    setIsRefreshingMapSettings,
    showMapRefreshToast,
    updateAutoSpeed,
  } = useSimulationFlowState();

    // ✅ 헤더에서 1~2초 보이는 가벼운 토스트(연타/중복 호출 대응)
  // ✅ 관전자 모드 기본: 상점/조합/교환 UI는 숨김(테스트용 토글)

  // 🎲 시드 고정(랜덤 재현)
  const {
    runSeed,
    seedDraft,
    setRunSeed,
    setSeedDraft,
  } = useSimulationRunSeed({
    day,
    isAdvancing,
    isGameOver,
    matchSec,
  });

  const {
    applyParticipantPresetToCurrent,
    deleteSelectedParticipantPreset,
    participantPresetName,
    participantPresets,
    saveCurrentParticipantPreset,
    saveSelectedParticipantPresetId,
    selectedParticipantPresetId,
    setParticipantPresetName,
    setParticipantPresets,
    setSelectedParticipantPresetId,
  } = useSimulationParticipantPresets({
    candidateSurvivors,
    day,
    isAdvancing,
    isGameOver,
    matchSec,
    settings,
    survivors,
    actions: {
      setAssistCounts,
      setDead,
      setKillCounts,
      setMarketMessage,
      setSelectedCharId,
      setSurvivors,
    },
  });

  // ✅ (팝업/데스크톱) 시뮬레이션 창: 로그 출력 길이에 맞춰 높이를 유동 조정
      // 일반 브라우저 탭에서는 resizeTo가 기대대로 동작하지 않으므로, 팝업/데스크톱만 적용
  function addLog(text, type = 'normal') {
    return addLogFromLogs(text, type);
  }

  function exportBattleLog(format = 'md') {
    const result = exportBattleLogFromLogs(format);
    if (result?.status === 'empty') {
      addLog('⚠️ 저장할 전투 로그가 없습니다. 게임을 시작한 뒤 다시 시도해주세요.', 'system');
      return;
    }
    addLog(result?.ok ? `💾 전투 로그 저장: ${result.filename}` : '⚠️ 전투 로그 저장 실패', result?.ok ? 'system' : 'death');
  }

  useSimulationRuntimeGuards({
    addLogRef,
    setAutoPlay,
    isAdvancingRef,
    setIsAdvancing,
  });

  useHyperloopPickLog({ hyperloopCharId, survivors, addLog });


  // 🧾 구조적 이벤트 로그(재현/디버깅용)
  // - 문자열 로그는 사람용, runEvents는 "룰/상태"를 요약/집계하기 위한 데이터용
  function emitRunEvent(kind, payload = {}, at = null) {
    return emitRunEventFromLogs(kind, payload, at);
  }

  const {
    applyErTraitAfterBattle,
    applyErWeaponSkillAfterCombat,
    applyLootCraftResult,
    emitConsumableRunEvent,
    emitCraftRunEvent,
    emitEffectRunEvents,
    emitItemGainIfAny,
    emitObjectiveRunEvent,
    emitQueueRunEvent,
    grantMasteries,
    grantMastery,
    grantPvpDamageMastery,
    grantPvpKillMastery,
  } = useSimulationEventActions({
    addLog,
    emitRunEvent,
  });

  const {
    devForceUseConsumable,
    resolvePendingTranscendPick,
    setEquipForSurvivor,
  } = useSimulationDevToolActions({
    state: {
      day,
      isAdvancing,
      isGameOver,
      matchSec,
      pendingTranscendPick,
      phase,
      publicItems,
      settings,
      showMarketPanel,
    },
    actions: {
      addLog,
      emitConsumableRunEvent,
      emitEffectRunEvents,
      emitItemGainIfAny,
      setPendingTranscendPick,
      setSurvivors,
    },
  });
  const {
    doHyperloopJump,
    getForbiddenAddedZoneIdsForPhase,
    getForbiddenZoneIdsForPhase,
    refreshMapSettingsFromServer,
  } = useSimulationMapActions({
    refs: {
      activeMapIdRef,
      activeMapRef,
      forbiddenCacheRef,
      isRefreshingMapsRef,
      mapsRef,
    },
    state: {
      activeMapId,
      activeMapName,
      day,
      hyperloopPadName,
      hyperloopPadZoneId,
      isAdvancing,
      isGameOver,
      loading,
      maps,
      matchPhase: phase,
      settings,
      survivors,
      zones,
    },
    actions: {
      addLog,
      applyActiveMapId,
      emitRunEvent,
      setIsRefreshingMapSettings,
      setMaps,
      setSurvivors,
      showMapRefreshToast,
    },
  });
  useSimulationInitialData({
    refs: { activeMapRef, mapsRef },
    helpers: {
      addLog,
      applyActiveMapId,
      getDefaultSimulationSettings,
    },
    actions: {
      setAssistCounts,
      setCandidateSurvivors,
      setCredits,
      setDroneOffers,
      setGameEndReason,
      setIsGameOver,
      setKiosks,
      setKillCounts,
      setLoading,
      setMaps,
      setMarketMessage,
      setMatchSec,
      setMyTradeOffers,
      setParticipantPresetName,
      setParticipantPresets,
      setPrevPhaseLogs,
      setPublicItems,
      setPublicPerks,
      setResultSummary,
      setSelectedParticipantPresetId,
      setSettings,
      setShowResultModal,
      setSurvivors,
      setTradeOffers,
      setViewerLp,
      setViewerPerks,
      setWinner,
    },
  });

  const {
    proceedPhaseGuarded,
    startBlocked,
    startBlockedText,
  } = useSimulationPhaseController({
    refs: {
      activeMapIdRef,
      activeMapRef,
      autoSpeedRef,
      fullLogEntriesRef,
      fullLogsRef,
      isAdvancingRef,
      isFinishingRef,
      proceedPhaseGuardedRef,
      startStarterLoadoutAppliedRef,
      suddenDeathActiveRef,
      suddenDeathEndAtSecRef,
      suddenDeathForbiddenAnnouncedRef,
    },
    state: {
      activeMap,
      activeMapId,
      assistCounts,
      autoPlay,
      autoSpeed,
      craftables,
      day,
      dead,
      droneOffers,
      isAdvancing,
      isGameOver,
      itemKeyById,
      itemMetaById,
      itemNameById,
      kiosks,
      killCounts,
      loading,
      matchSec,
      pendingTranscendPick,
      phase,
      publicItems,
      runSeed,
      selectedCharId,
      settings,
      showMarketPanel,
      spawnState,
      survivors,
      zoneGraph,
      zones,
    },
    helpers: {
      getForbiddenAddedZoneIdsForPhase,
      getForbiddenZoneIdsForPhase,
      getZoneName,
      isHyperloopTransit,
    },
    actions: {
      addLog,
      applyErTraitAfterBattle,
      applyErWeaponSkillAfterCombat,
      applyLootCraftResult,
      applyUserEconomyProgress,
      emitConsumableRunEvent,
      emitCraftRunEvent,
      emitEffectRunEvents,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitQueueRunEvent,
      emitRunEvent,
      grantMasteries,
      grantMastery,
      grantPvpDamageMastery,
      grantPvpKillMastery,
      normalizeAutoSpeed,
      persistSimEquipmentsFromChars,
      refreshMapSettingsFromServer,
      resetPhaseLogs,
      setAssistCounts,
      setAutoPlay,
      setCredits,
      setDay,
      setDead,
      setForbiddenAddedNow,
      setIsAdvancing,
      setIsGameOver,
      setKillCounts,
      setMatchSec,
      setPendingTranscendPick,
      setPhase,
      setResultSummary,
      setRunEvents,
      setShowResultModal,
      setSpawnState,
      setSurvivors,
      setWinner,
    },
  });

  const {
    acceptTradeOffer,
    cancelTradeOffer,
    createTradeOffer,
    devGrantItemToSelected,
    doCraft,
    doDroneBuy,
    doKioskTransaction,
    doPerkPurchase,
  } = useSimulationMarketActions({
    state: {
      day,
      devGrantItemId,
      devGrantItemOptions,
      devGrantQty,
      isAdvancing,
      isGameOver,
      itemMetaById,
      matchSec,
      phase,
      selectedChar,
      selectedCharId,
      settings,
      showMarketPanel,
      tradeDraft,
    },
    actions: {
      addLog,
      applyUserEconomyProgress,
      emitItemGainIfAny,
      getQty,
      loadMarket,
      loadTrades,
      patchServerCharacterState,
      setMarketMessage,
      setSurvivors,
      setTradeDraft,
      syncMyState,
    },
  });

  // 탭 전환 시 필요한 데이터 갱신
  // activeMap 로딩이 순간적으로 비는 경우(=맵 미지정/리프레시 타이밍)에도
  // 금지구역 로직이 동작하도록 zones 기반 fallback을 둡니다.
  const activeMapEff = getActiveMapForForbiddenZones(activeMap, activeMapId, zones);
  const forbiddenNow = activeMapEff
    ? new Set(getForbiddenZoneIdsForPhase(activeMapEff, day, phase))
    : new Set();


  // 🧾 런 요약: 획득 경로(아이템만 집계, 크레딧 제외)
  const {
    gainSourceSummary,
    creditSourceSummary,
    gainDetailSummary,
    specialSourceSummary,
    runProgressSummary,
    runSupportSummary,
    runActionSummary,
    objectiveSummary,
    topRankedCharacters,
    detonationRiskSummary,
    recentPings,
    simulationDiagnostics,
    simulationDiagnosticsLine,
    zoneEdges,
    zonePos,
  } = useSimulationDerivedData({
    activeMap,
    assistCounts,
    baseZoneGraph,
    day,
    dead,
    forbiddenNow,
    getZoneName,
    itemMetaById,
    itemNameById,
    killCounts,
    phase,
    runEvents,
    settings,
    showMarketPanel,
    showResultModal,
    survivors,
    uiModal,
    zoneNameById,
    zones,
  });

  if (!hasHydrated) {
    return <SimulationHydrationPanel />;
  }

  return (
    <SimulationPageView
      acceptTradeOffer={acceptTradeOffer}
      activeMap={activeMap}
      activeMapId={activeMapId}
      activeViewerPerkBundle={activeViewerPerkBundle}
      addLog={addLog}
      applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
      actorAvatarByName={actorAvatarByName}
      assistCounts={assistCounts}
      autoPlay={autoPlay}
      autoSpeed={autoSpeed}
      candidateSurvivors={candidateSurvivors}
      cancelTradeOffer={cancelTradeOffer}
      characterSkillsEnabled={characterSkillsEnabled}
      closeUiModal={closeUiModal}
      createTradeOffer={createTradeOffer}
      craftables={craftables}
      creditSourceSummary={creditSourceSummary}
      credits={credits}
      day={day}
      dead={dead}
      deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
      detonationRiskSummary={detonationRiskSummary}
      devEventPreviewLimit={DEV_EVENT_PREVIEW_LIMIT}
      devForceUseConsumable={devForceUseConsumable}
      devGrantItemId={devGrantItemId}
      devGrantItemOptions={devGrantItemOptions}
      devGrantItemToSelected={devGrantItemToSelected}
      devGrantQty={devGrantQty}
      devGrantSearch={devGrantSearch}
      doCraft={doCraft}
      doDroneBuy={doDroneBuy}
      doHyperloopJump={doHyperloopJump}
      doKioskTransaction={doKioskTransaction}
      doPerkPurchase={doPerkPurchase}
      droneOffers={droneOffers}
      exportBattleLog={exportBattleLog}
      fireAndReport={fireAndReport}
      forbiddenAddedNow={forbiddenAddedNow}
      forbiddenNow={forbiddenNow}
      gainDetailSummary={gainDetailSummary}
      gainSourceSummary={gainSourceSummary}
      gameEndReason={gameEndReason}
      getQty={getQty}
      getTeamStateForActor={getTeamStateForActor}
      getZoneName={getZoneName}
      handleCharacterSkillsToggle={handleCharacterSkillsToggle}
      handleMatchModeChange={handleMatchModeChange}
      hyperloopCharId={hyperloopCharId}
      hyperloopDestId={hyperloopDestId}
      hyperloopDestIds={hyperloopDestIds}
      hyperloopPadName={hyperloopPadName}
      hyperloopPadZoneId={hyperloopPadZoneId}
      hyperloopZoneSet={hyperloopZoneSet}
      inventoryOptions={inventoryOptions}
      isAdvancing={isAdvancing}
      isGameOver={isGameOver}
      isRefreshingMapSettings={isRefreshingMapSettings}
      isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
      itemNameById={itemNameById}
      killCounts={killCounts}
      kiosks={kiosks}
      loadMarket={loadMarket}
      loadTrades={loadTrades}
      loading={loading}
      logBoxMaxH={logBoxMaxH}
      logBoxRef={logBoxRef}
      logWindowRef={logWindowRef}
      logs={logs}
      mapRefreshToast={mapRefreshToast}
      maps={maps}
      marketCardRenderLimit={MARKET_CARD_RENDER_LIMIT}
      marketMessage={marketMessage}
      marketTab={marketTab}
      matchSec={matchSec}
      myTradeOffers={myTradeOffers}
      objectiveSummary={objectiveSummary}
      ownedPerkCodeSet={ownedPerkCodeSet}
      participantPresetName={participantPresetName}
      participantPresets={participantPresets}
      pendingTranscendPick={pendingTranscendPick}
      phase={phase}
      prevPhaseLogs={prevPhaseLogs}
      proceedPhaseGuarded={proceedPhaseGuarded}
      publicItems={publicItems}
      publicPerks={publicPerks}
      recentPings={recentPings}
      refreshMapSettingsFromServer={refreshMapSettingsFromServer}
      resolvePendingTranscendPick={resolvePendingTranscendPick}
      resultSummary={resultSummary}
      runActionSummary={runActionSummary}
      runEvents={runEvents}
      runEventsPreviewText={runEventsPreviewText}
      runProgressSummary={runProgressSummary}
      runSeed={runSeed}
      runSupportSummary={runSupportSummary}
      saveCurrentParticipantPreset={saveCurrentParticipantPreset}
      saveSelectedParticipantPresetId={saveSelectedParticipantPresetId}
      seedDraft={seedDraft}
      selectedChar={selectedChar}
      selectedCharId={selectedCharId}
      selectedDevGrantItem={selectedDevGrantItem}
      selectedParticipantPresetId={selectedParticipantPresetId}
      setAutoPlay={setAutoPlay}
      setDevGrantItemId={setDevGrantItemId}
      setDevGrantQty={setDevGrantQty}
      setDevGrantSearch={setDevGrantSearch}
      setEquipForSurvivor={setEquipForSurvivor}
      setHyperloopDestId={setHyperloopDestId}
      setMarketTab={selectMarketTab}
      setParticipantPresetName={setParticipantPresetName}
      setQty={setQty}
      setRunSeed={setRunSeed}
      setSeedDraft={setSeedDraft}
      setSelectedCharId={setSelectedCharId}
      setShowAllMarketRows={setShowAllMarketRows}
      setShowDevDebugDetails={setShowDevDebugDetails}
      setShowDevEventLog={setShowDevEventLog}
      setShowDetailedLogs={setShowDetailedLogs}
      setShowMarketPanel={setShowMarketPanel}
      setShowPrevLogs={setShowPrevLogs}
      setShowResultModal={setShowResultModal}
      setTradeDraft={setTradeDraft}
      setTradeWantSearch={setTradeWantSearch}
      setUiModal={setUiModal}
      settings={settings}
      showAllMarketRows={showAllMarketRows}
      showDevDebugDetails={showDevDebugDetails}
      showDevEventLog={showDevEventLog}
      showDetailedLogs={showDetailedLogs}
      showMarketPanel={showMarketPanel}
      showPrevLogs={showPrevLogs}
      showResultModal={showResultModal}
      simulationDiagnostics={simulationDiagnostics}
      simulationDiagnosticsLine={simulationDiagnosticsLine}
      specialSourceSummary={specialSourceSummary}
      spawnState={spawnState}
      startBlocked={startBlocked}
      startBlockedText={startBlockedText}
      survivors={survivors}
      syncMyState={syncMyState}
      topRankedCharacters={topRankedCharacters}
      tradeDraft={tradeDraft}
      tradeOffers={tradeOffers}
      tradeWantItemOptions={tradeWantItemOptions}
      tradeWantSearch={tradeWantSearch}
      uiModal={uiModal}
      updateAutoSpeed={updateAutoSpeed}
      viewerLp={viewerLp}
      viewerPerks={viewerPerks}
      visibleCraftables={visibleCraftables}
      visibleDevGrantItemOptions={visibleDevGrantItemOptions}
      visibleDroneOffers={visibleDroneOffers}
      visibleKiosks={visibleKiosks}
      visibleMyTradeOffers={visibleMyTradeOffers}
      visiblePublicPerks={visiblePublicPerks}
      visibleTradeOffers={visibleTradeOffers}
      winner={winner}
      zones={zones}
      zoneEdges={zoneEdges}
      zonePos={zonePos}
    />
  );
}
