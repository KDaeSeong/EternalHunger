'use client';

import { useRef, useSyncExternalStore } from 'react';
import {
  buildActorAvatarByName,
  buildActorTeamState,
  fireAndReport,
  getActiveMapForForbiddenZones,
  getClientHydrationSnapshot,
  getDefaultSimulationSettings,
  getPreferredHyperloopCharId,
  getServerHydrationSnapshot,
  safeRenderCompute,
  subscribeHydration,
} from './simulationPageRuntime';
import { useSimEquipmentPersistence } from './useSimEquipmentPersistence';
import { useSimulationInitialData } from './useSimulationInitialData';
import { useSimulationRuntimeGuards } from './useSimulationRuntimeGuards';
import { useHyperloopPickLog } from './useHyperloopPickLog';
import { logRuntimeEffectResults } from './runtimeStatus';
import { useSimulationMarketState } from './useSimulationMarketState';
import { useSimulationMarketActions } from './useSimulationMarketActions';
import { useSimulationMapActions } from './useSimulationMapActions';
import { useSimulationDevToolActions } from './useSimulationDevToolActions';
import { useSimulationPhaseController } from './useSimulationPhaseController';
import { useSimulationLogs } from './useSimulationLogs';
import { useSimulationRunSeed } from './useSimulationRunSeed';
import { useSimulationFlowState } from './useSimulationFlowState';
import { useSimulationUiModal } from './useSimulationUiModal';
import { useSimulationDerivedData } from './useSimulationDerivedData';
import { useSimulationMapState } from './useSimulationMapState';
import { useSimulationParticipantPresets } from './useSimulationParticipantPresets';
import { useSimulationEventActions } from './useSimulationEventActions';
import { useSimulationBrowserErrorLogging } from './useSimulationBrowserErrorLogging';
import { useSimulationDevRunGuard } from './useSimulationDevRunGuard';
import { useSimulationSettingsControls } from './useSimulationSettingsControls';
import { useSimulationMatchState } from './useSimulationMatchState';
import { buildSimulationPageViewProps } from './simulationPageViewProps';

const MARKET_CARD_RENDER_LIMIT = 40;
const DEV_SELECT_RENDER_LIMIT = 80;
const DEV_EVENT_PREVIEW_LIMIT = 80;

export function useSimulationPageController() {
  const hasHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const {
    assistCounts, candidateSurvivors, day, dead, forbiddenAddedNow, gameEndReason,
    isGameOver, killCounts, loading, matchSec, phase, resultSummary,
    setAssistCounts, setCandidateSurvivors, setDay, setDead, setForbiddenAddedNow,
    setGameEndReason, setIsGameOver, setKillCounts, setLoading, setMatchSec, setPhase,
    setResultSummary, setSettings, setShowResultModal, setSurvivors, setWinner,
    setWinnerPredictionId, settings, showResultModal, survivors, winner, winnerPredictionId,
  } = useSimulationMatchState();
  const simulationLogs = useSimulationLogs({
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
  const {
    addLog: addLogFromLogs,
    addLogRef,
    emitRunEvent: emitRunEventFromLogs,
    exportBattleLog: exportBattleLogFromLogs,
    fullLogEntriesRef,
    fullLogsRef,
    resetPhaseLogs,
    runEvents,
    setPrevPhaseLogs,
    setRunEvents,
  } = simulationLogs;

  function addLog(text, type = 'normal') {
    return addLogFromLogs(text, type);
  }

  const getTeamStateForActor = (actor) => buildActorTeamState(actor, settings, survivors, dead);

  const settingsControls = useSimulationSettingsControls({
    day,
    isGameOver,
    setSettings,
    setSurvivors,
    settings,
  });
  // 🪟 UI 모달(미니맵/캐릭터/로그)
  const uiModalState = useSimulationUiModal();
  const { uiModal } = uiModalState;

  useSimulationBrowserErrorLogging();

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
  const marketState = useSimulationMarketState({
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
    applyUserEconomyProgress,
    craftables,
    credits,
    devGrantItemId,
    devGrantItemOptions,
    devGrantQty,
    droneOffers,
    getQty,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    loadMarket,
    loadTrades,
    patchServerCharacterState,
    pendingTranscendPick,
    publicItems,
    selectedChar,
    selectedCharId,
    setCredits,
    setDroneOffers,
    setKiosks,
    setMarketMessage,
    setMyTradeOffers,
    setPendingTranscendPick,
    setPublicItems,
    setPublicPerks,
    setSelectedCharId,
    setShowMarketPanel,
    setTradeDraft,
    setTradeOffers,
    setViewerLp,
    setViewerPerks,
    showMarketPanel,
    syncMyState,
    tradeDraft,
  } = marketState;
  const devRunGuard = useSimulationDevRunGuard({
    addLog,
    setShowMarketPanel,
    showMarketPanel,
  });
  const {
    devRunTainted,
    devRunTaintedRef,
    markDevRunTainted,
  } = devRunGuard;
  const mapState = useSimulationMapState({
    selectedCharId,
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
    hyperloopPadName,
    hyperloopPadZoneId,
    isHyperloopTransit,
    maps,
    mapsRef,
    setMaps,
    setSpawnState,
    spawnState,
    zoneGraph,
    zoneNameById,
    zones,
  } = mapState;

  const hyperloopCharId = getPreferredHyperloopCharId(selectedCharId, survivors);
  const forbiddenCacheRef = useRef({});
  // ✅ UI용 logs는 "현재 페이즈"만 보여주고, 전체 기록은 따로 누적합니다.

  // ▶️ 오토 플레이(페이즈 자동 진행)
  // - "틱 기반"은 페이즈 내부를 초 단위로 계산하는 엔진이고,
  // - 오토 플레이는 "다음 페이즈" 버튼을 일정 간격으로 자동 눌러주는 UX입니다.
  const flowState = useSimulationFlowState();
  const {
    autoPlay,
    autoSpeed,
    autoSpeedRef,
    isAdvancing,
    isAdvancingRef,
    isRefreshingMapsRef,
    normalizeAutoSpeed,
    proceedPhaseGuardedRef,
    setAutoPlay,
    setIsAdvancing,
    setIsRefreshingMapSettings,
    showMapRefreshToast,
  } = flowState;

    // ✅ 헤더에서 1~2초 보이는 가벼운 토스트(연타/중복 호출 대응)
  // ✅ 관전자 모드 기본: 상점/조합/교환 UI는 숨김(테스트용 토글)

  // 🎲 시드 고정(랜덤 재현)
  const runSeedState = useSimulationRunSeed({
    day,
    isAdvancing,
    isGameOver,
    matchSec,
  });
  const {
    runSeed,
  } = runSeedState;

  const participantPresetState = useSimulationParticipantPresets({
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
  const {
    setParticipantPresetName,
    setParticipantPresets,
    setSelectedParticipantPresetId,
  } = participantPresetState;

  // ✅ (팝업/데스크톱) 시뮬레이션 창: 로그 출력 길이에 맞춰 높이를 유동 조정
      // 일반 브라우저 탭에서는 resizeTo가 기대대로 동작하지 않으므로, 팝업/데스크톱만 적용
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
      survivors,
    },
    actions: {
      addLog,
      emitConsumableRunEvent,
      emitEffectRunEvents,
      emitItemGainIfAny,
      markDevRunTainted,
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
      devRunTaintedRef,
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
      devRunTainted,
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
      runEvents,
      runSeed,
      selectedCharId,
      settings,
      showMarketPanel,
      spawnState,
      survivors,
      winnerPredictionId,
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
      markDevRunTainted,
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
  const derivedData = useSimulationDerivedData({
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
    return { hasHydrated, pageViewProps: null };
  }

  const pageViewProps = buildSimulationPageViewProps({
    constants: {
      devEventPreviewLimit: DEV_EVENT_PREVIEW_LIMIT,
      marketCardRenderLimit: MARKET_CARD_RENDER_LIMIT,
    },
    state: {
      actorAvatarByName,
      assistCounts,
      candidateSurvivors,
      day,
      dead,
      forbiddenAddedNow,
      forbiddenNow,
      gameEndReason,
      isGameOver,
      killCounts,
      loading,
      matchSec,
      phase,
      resultSummary,
      settings,
      showResultModal,
      survivors,
      winner,
      winnerPredictionId,
      zones,
    },
    helpers: {
      addLog,
      exportBattleLog,
      fireAndReport,
      getTeamStateForActor,
      getZoneName,
      setShowResultModal,
      setWinnerPredictionId,
    },
    logs: simulationLogs,
    settingsControls,
    uiModalState,
    marketState,
    devRunGuard,
    mapState,
    flowState,
    runSeedState,
    participantPresetState,
    phaseController: {
      proceedPhaseGuarded,
      startBlocked,
      startBlockedText,
    },
    devToolActions: {
      devForceUseConsumable,
      resolvePendingTranscendPick,
      setEquipForSurvivor,
    },
    mapActions: {
      doHyperloopJump,
      refreshMapSettingsFromServer,
    },
    marketActions: {
      acceptTradeOffer,
      cancelTradeOffer,
      createTradeOffer,
      devGrantItemToSelected,
      doCraft,
      doDroneBuy,
      doKioskTransaction,
      doPerkPurchase,
    },
    derivedData,
  });

  return { hasHydrated, pageViewProps };
}
