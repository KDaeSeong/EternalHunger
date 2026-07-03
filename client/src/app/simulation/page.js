'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getRuleset } from '../../utils/rulesets';
import SiteHeader from '../../components/SiteHeader';
import SimulationControlPanel from './_components/SimulationControlPanel';
import SimulationHydrationPanel from './_components/SimulationHydrationPanel';
import SimulationLogPanel from './_components/SimulationLogPanel';
import SimulationMarketPanel from './_components/SimulationMarketPanel';
import SimulationMatchStatusPanel from './_components/SimulationMatchStatusPanel';
import SimulationMinimapPanel from './_components/SimulationMinimapPanel';
import SimulationResultModal from './_components/SimulationResultModal';
import SimulationSurvivorBoard from './_components/SimulationSurvivorBoard';
import SimulationWorldSpawnToolbar from './_components/SimulationWorldSpawnToolbar';
import '../../styles/ERSimulation.css';

import { areCharacterSkillsEnabled } from './_lib/characterSkillRuntime';
import {
  itemIcon,
  perkNumber,
  applyPerkCreditBonus,
  maybeBoostDropQty,
  normalizeRuntimeSurvivorList,
  getInvItemId,
  extractActorNameFromLog,
  uniqStr,
  clampTier4,
  tierLabelKo,
  classifySpecialByName,
  uniqStrings,
  inferEquipSlot,
  canReceiveItem,
  normalizeInventory,
  invQty,
  consumeIngredientsFromInv,
  getActorTeamCapacity,
  getActorTeamId,
  getActorTeamName,
  getActorTeamOriginalSize,
  getAliveTeams,
  getTimeOfDayFromPhase,
} from './_lib/simulationEngine';
import {
  normalizeSatiety,
} from './_lib/satietyRuntime';
import { getRuntimeActorKey } from './_lib/runtimeParticipantRuntime';
import {
  normalizeMatchMode,
  getMatchConfig,
  applyMatchTeams,
  getMatchStartInfo,
} from './_lib/matchRosterRuntime';
import { useSimEquipmentPersistence } from './_lib/useSimEquipmentPersistence';
import {
  formatClock,
} from './_lib/simulationFormattingRuntime';
import { useSimulationInitialData } from './_lib/useSimulationInitialData';
import { useSimulationRuntimeGuards } from './_lib/useSimulationRuntimeGuards';
import { useHyperloopPickLog } from './_lib/useHyperloopPickLog';
import { createPhaseDeathRuntime } from './_lib/phaseDeathRuntime';
import { logRuntimeEffectResults } from './_lib/runtimeStatus';
import { finishSimulationGame } from './_lib/finishGameRuntime';
import { useSimulationMarketState } from './_lib/useSimulationMarketState';
import { useSimulationMarketActions } from './_lib/useSimulationMarketActions';
import { useSimulationMapActions } from './_lib/useSimulationMapActions';
import { useSimulationDevToolActions } from './_lib/useSimulationDevToolActions';
import { useSimulationLogs } from './_lib/useSimulationLogs';
import { useSimulationRunSeed } from './_lib/useSimulationRunSeed';
import { useSimulationFlowState } from './_lib/useSimulationFlowState';
import { useSimulationUiModal } from './_lib/useSimulationUiModal';
import { useSimulationDerivedData } from './_lib/useSimulationDerivedData';
import { useSimulationMapState } from './_lib/useSimulationMapState';
import { useSimulationParticipantPresets } from './_lib/useSimulationParticipantPresets';
import { useSimulationEventActions } from './_lib/useSimulationEventActions';
import {
  beginSimulationPhase,
  prepareForbiddenZonePhase,
} from './_lib/phasePreparationRuntime';
import {
  buildStarterLoadoutSurvivorsForPhase,
  prepareWorldSpawnsForPhase,
} from './_lib/phaseSpawnRuntime';
import { runPhaseRevival } from './_lib/phaseRevivalRuntime';
import { runPhaseActorActionPipeline } from './_lib/phaseActorActionPipelineRuntime';
import { finalizeSimulationPhase } from './_lib/phaseFinalizationRuntime';
import { runPvpActionLoop } from './_lib/phasePvpActionLoopRuntime';
import { runPhaseWorldResolution } from './_lib/phaseWorldResolutionRuntime';

const HYPERLOOP_DELAY_SEC = 3;
const MARKET_CARD_RENDER_LIMIT = 40;
const DEV_SELECT_RENDER_LIMIT = 80;
const DEV_EVENT_PREVIEW_LIMIT = 80;

function subscribeHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function getDefaultSimulationSettings() {
  return {
    statWeights: { maxHp: 1, attackPower: 1, skillAmp: 1, defense: 1, attackSpeed: 1, attackRange: 1, sightRange: 1 },
    suddenDeathTurn: 5,
    forbiddenZoneStartDay: 2,
    forbiddenZoneStartPhase: 'night',
    forbiddenZoneDamageBase: 1.5,
    rulesetId: 'ER_S11',
    matchMode: 'squad',
  };
}

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
  // timeOfDay: 'day' | 'night' (phase에서 파생, 날짜/스폰 게이트용)
  const timeOfDay = getTimeOfDayFromPhase(phase);
  // ⏱ 경기 경과 시간(초) - 하이브리드(페이즈 버튼 + 내부 틱)에서 기준이 되는 절대 시간
  const [matchSec, setMatchSec] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  function safeRenderCompute(label, factory, fallback) {
    try {
      return factory();
    } catch (err) {
      console.error(`[simulation:${label}]`, err);
      return fallback;
    }
  };

  function useSafeMemo(label, factory, deps, fallback) {
    void deps;
    return safeRenderCompute(label, factory, fallback);
  };


  function fireAndReport(label, job) {
    return Promise.resolve()
      .then(() => job())
      .catch((err) => {
        console.error(`[simulation:${label}]`, err);
        throw err;
      });
  };

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
  const getTeamStateForActor = (actor) => {
    if (!actor || normalizeMatchMode(settings?.matchMode) === 'solo') return null;
    const teamId = getActorTeamId(actor);
    if (!teamId) return null;
    const allActors = [
      ...(Array.isArray(survivors) ? survivors : []),
      ...(Array.isArray(dead) ? dead : []),
    ];
    const teamActors = allActors.filter((row) => getActorTeamId(row) === teamId);
    const aliveCount = (Array.isArray(survivors) ? survivors : [])
      .filter((row) => getActorTeamId(row) === teamId && Number(row?.hp || 0) > 0)
      .length;
    const rosterSize = Math.max(
      getActorTeamOriginalSize(actor, teamActors.length || 1),
      ...teamActors.map((row) => getActorTeamOriginalSize(row, teamActors.length || 1)),
      teamActors.length || 1
    );
    const capacity = Math.max(
      getActorTeamCapacity(actor, getMatchConfig(settings).teamSize),
      getMatchConfig(settings).teamSize
    );
    const rosterNames = Array.isArray(actor?.matchTeamRosterNames) && actor.matchTeamRosterNames.length
      ? actor.matchTeamRosterNames
      : teamActors.map((row) => String(row?.name || '').trim()).filter(Boolean);
    return {
      teamId,
      teamName: getActorTeamName(actor),
      aliveCount,
      rosterSize,
      capacity,
      missingCount: Math.max(0, rosterSize - aliveCount),
      rosterNames,
      label: `${getActorTeamName(actor)} · 생존 ${aliveCount}/${rosterSize}${capacity > rosterSize ? ` (정원 ${capacity})` : ''}`,
    };
  };

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

  const getCharacterSkillModeSettings = (src = settings) => {
    const rs = getRuleset(src?.rulesetId);
    return {
      ...src,
      skills: { ...(rs?.skills || {}), ...(src?.skills || {}) },
    };
  };

  const characterSkillsEnabled = areCharacterSkillsEnabled(getCharacterSkillModeSettings(settings));

  const handleCharacterSkillsToggle = (enabled) => {
    const on = !!enabled;
    const nextSettings = {
      ...(settings || {}),
      skills: {
        ...(settings?.skills || {}),
        enabled: on,
        characterSkills: on,
        aiUseSkills: on,
      },
    };
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
  const actorAvatarByName = useSafeMemo('actorAvatarByName', () => {
    const out = {};
    const all = [...(Array.isArray(survivors) ? survivors : []), ...(Array.isArray(dead) ? dead : [])];
    for (const c of all) {
      const name = String(c?.name || '').trim();
      const img = String(c?.previewImage || c?.image || '').trim();
      if (name && img && !out[name]) out[name] = img;
    }
    return out;
  }, [survivors, dead], {});

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

  const hyperloopCharId = (() => {
    const preferred = String(selectedCharId || '').trim();
    if (preferred) return preferred;
    const alive = (Array.isArray(survivors) ? survivors : []).filter((actor) => Number(actor?.hp || 0) > 0);
    return String(alive[0]?._id || '');
  })();
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

  // 최신 킬 정보 전달
  async function finishGame(finalSurvivors, latestKillCounts, latestAssistCounts, options = {}) {
    return finishSimulationGame({
      finalSurvivors,
      latestAssistCounts,
      latestKillCounts,
      options,
      refs: {
        fullLogsRef,
        isFinishingRef,
      },
      state: {
        assistCounts,
        dead,
        killCounts,
        settings,
      },
      actions: {
        addLog,
        setAutoPlay,
        setCredits,
        setIsGameOver,
        setResultSummary,
        setShowResultModal,
        setWinner,
      },
    });
  };
  const finishGameRef = useRef(finishGame);

  useEffect(() => {
    finishGameRef.current = finishGame;
  });

  // --- [핵심] 진행 로직 ---
  async function proceedPhase() {
    const {
      atNow,
      baseCredits,
      battleSettings,
      canReviveThisMatch,
      currentActionSec,
      fogLocalSec,
      getPhaseRuntimeOffsetSec,
      isSoloMatch,
      marketRules,
      matchCfgNow,
      nextDay,
      nextPhase,
      phaseDurationSec,
      phaseIdxNow,
      phaseStartSec,
      reserveActionSecond,
      reserveVisibleSecond,
      ruleset,
      runVisibleClockToPhaseEnd,
      tickSec,
      useDetonation,
    } = beginSimulationPhase({
      refs: {
        autoSpeedRef,
        suddenDeathActiveRef,
        suddenDeathEndAtSecRef,
      },
      state: {
        autoSpeed,
        day,
        matchSec,
        phase,
        settings,
      },
      actions: {
        addLog,
        normalizeAutoSpeed,
        resetPhaseLogs,
        setDay,
        setMatchSec,
        setPhase,
      },
    });
    let earnedCredits = baseCredits;

    // 🎁 초월 선택 상자(개발자 도구): 한 페이즈에 1개만 선택 대기(나머지는 자동 선택)
    let pendingPickAssigned = false;

    // 2. 맵 내부 구역 이동 + 금지구역(구역 기반) 데미지
    const {
      damagePerTick,
      forbiddenIds,
      mapIdNow,
      mapObj,
      suddenDeathSafeZoneIds,
      totalZones,
    } = prepareForbiddenZonePhase({
      refs: {
        activeMapIdRef,
        activeMapRef,
        suddenDeathActiveRef,
        suddenDeathForbiddenAnnouncedRef,
      },
      state: {
        activeMap,
        activeMapId,
        nextDay,
        nextPhase,
        ruleset,
        settings,
        useDetonation,
        zones,
      },
      helpers: {
        getForbiddenAddedZoneIdsForPhase,
        getForbiddenZoneIdsForPhase,
        getZoneName,
      },
      actions: {
        addLog,
        setForbiddenAddedNow,
      },
    });

    const {
      reviveCutoffIdx,
      revivedNow,
    } = runPhaseRevival({
      state: {
        canReviveThisMatch,
        dead,
        forbiddenIds,
        mapObj,
        phaseIdxNow,
        phaseStartSec,
        publicItems,
        reviveCfg: ruleset?.revive || {},
        ruleset,
        survivors,
        useDetonation,
      },
      actions: {
        addLog,
        atNow,
        emitRunEvent,
        setDead,
      },
    });
    const nextSpawn = prepareWorldSpawnsForPhase({
      state: {
        forbiddenIds,
        mapIdNow,
        mapObj,
        matchMode: matchCfgNow.matchMode,
        nextDay,
        nextPhase,
        ruleset,
        spawnState,
        zones,
      },
      actions: {
        addLog,
        atNow,
        emitRunEvent,
      },
    });

    let phaseSurvivors = buildStarterLoadoutSurvivorsForPhase({
      refs: {
        startStarterLoadoutAppliedRef,
      },
      state: {
        nextDay,
        nextPhase,
        publicItems,
        ruleset,
        survivors,
      },
      actions: {
        addLog,
      },
    });


    // ✅ 부활자는 이번 페이즈부터 다시 생존자로 합류
    if (revivedNow.length) phaseSurvivors = [...phaseSurvivors, ...revivedNow];
    phaseSurvivors = normalizeRuntimeSurvivorList(phaseSurvivors);

    // 1일차 장비 성장은 실제 레시피 제작을 우선합니다. 추상 장비 생성은 데이터 누락 시 fallback으로만 사용합니다.

    const newlyDead = [];
    const phaseDeathLogStartIndex = Array.isArray(fullLogEntriesRef.current) ? fullLogEntriesRef.current.length : 0;
    const {
      appendPhaseDeadSnapshots,
      emitDeathRunEventOnce,
      flushDeadSnapshots,
      phaseDeadSnapshots,
      reconcileZeroHpDeaths,
      setDeathMetadata,
    } = createPhaseDeathRuntime({
      addLog,
      atNow,
      currentActionSec,
      emitRunEvent,
      fullLogEntriesRef,
      phaseDeathLogStartIndex,
      phaseIdxNow,
      ruleset,
      setDead,
    });
    const movePowerContext = { ruleset, battleSettings };
    const actorActionPipelineResult = runPhaseActorActionPipeline({
      state: {
        canReviveThisMatch,
        craftables,
        currentActionSec,
        damagePerTick,
        droneOffers,
        forbiddenIds,
        hyperloopDelaySec: HYPERLOOP_DELAY_SEC,
        isSoloMatch,
        itemKeyById,
        itemMetaById,
        itemNameById,
        kiosks,
        mapObj,
        marketRules,
        movePowerContext,
        nextDay,
        nextPhase,
        nextSpawn,
        pendingPickAssigned,
        pendingTranscendPick,
        phaseDurationSec,
        phaseIdxNow,
        phaseSurvivors,
        publicItems,
        reviveCutoffIdx,
        ruleset,
        selectedCharId,
        showMarketPanel,
        useDetonation,
        zoneGraph,
        zones,
      },
      actions: {
        addLog,
        applyLootCraftResult,
        atNow,
        emitCraftRunEvent,
        emitDeathRunEventOnce,
        emitItemGainIfAny,
        emitObjectiveRunEvent,
        emitQueueRunEvent,
        emitRunEvent,
        getZoneName,
        grantMastery,
        grantMasteries,
        isHyperloopTransit,
        reserveActionSecond,
        setDeathMetadata,
        setPendingTranscendPick,
      },
    });
    pendingPickAssigned = actorActionPipelineResult.pendingPickAssigned;
    if (Array.isArray(actorActionPipelineResult.newlyDead) && actorActionPipelineResult.newlyDead.length) {
      newlyDead.push(...actorActionPipelineResult.newlyDead);
    }
    let updatedSurvivors = Array.isArray(actorActionPipelineResult.updatedSurvivors)
      ? actorActionPipelineResult.updatedSurvivors
      : [];

    const worldResolutionResult = runPhaseWorldResolution({
      refs: {
        suddenDeathActiveRef,
      },
      state: {
        canReviveThisMatch,
        currentActionSec,
        fogLocalSec,
        forbiddenIds,
        isSoloMatch,
        itemMetaById,
        itemNameById,
        mapObj,
        movePowerContext,
        newlyDead,
        nextDay,
        nextPhase,
        nextSpawn,
        phaseDurationSec,
        phaseIdxNow,
        phaseStartSec,
        publicItems,
        reviveCutoffIdx,
        ruleset,
        suddenDeathSafeZoneIds,
        tickSec,
        updatedSurvivors,
        useDetonation,
        zoneGraph,
        zones,
      },
      actions: {
        addLog,
        appendPhaseDeadSnapshots,
        atNow,
        emitDeathRunEventOnce,
        emitItemGainIfAny,
        emitRunEvent,
        flushDeadSnapshots,
        getZoneName,
        setDeathMetadata,
      },
    });
    updatedSurvivors = worldResolutionResult.updatedSurvivors;
    const pvpActionLoopResult = await runPvpActionLoop({
      state: {
        battleSettings,
        canReviveThisMatch,
        craftables,
        currentActionSec,
        fogLocalSec,
        forbiddenIds,
        getPhaseRuntimeOffsetSec,
        isSoloMatch,
        itemMetaById,
        itemNameById,
        mapObj,
        nextDay,
        nextPhase,
        phaseDurationSec,
        phaseIdxNow,
        phaseSurvivors,
        publicItems,
        reviveCutoffIdx,
        ruleset,
        tickSec,
        updatedSurvivors,
        useDetonation,
        zoneGraph,
      },
      actions: {
        addEarnedCredits: (amount) => {
          earnedCredits += Math.max(0, Number(amount || 0));
        },
        addLog,
        appendPhaseDeadSnapshots,
        applyErTraitAfterBattle,
        applyErWeaponSkillAfterCombat,
        atNow,
        emitConsumableRunEvent,
        emitDeathRunEventOnce,
        emitEffectRunEvents,
        emitRunEvent,
        flushDeadSnapshots,
        getZoneName,
        grantPvpDamageMastery,
        grantPvpKillMastery,
        reserveVisibleSecond,
        setDeathMetadata,
      },
    });
    const {
      estimatePower,
      newDeadIds,
      roundAssists,
      roundKills,
      survivorMap,
    } = pvpActionLoopResult;
    const phaseFinalizationResult = await finalizeSimulationPhase({
      refs: {
        suddenDeathActiveRef,
        suddenDeathEndAtSecRef,
      },
      state: {
        assistCounts,
        baseCredits,
        canReviveThisMatch,
        dead,
        earnedCredits,
        estimatePower,
        getPhaseRuntimeOffsetSec,
        isSoloMatch,
        killCounts,
        matchSec,
        newDeadIds,
        nextDay,
        nextPhase,
        nextSpawn,
        phaseDeadSnapshots,
        phaseDurationSec,
        phaseIdxNow,
        phaseStartSec,
        reviveCutoffIdx,
        roundAssists,
        roundKills,
        ruleset,
        survivorMap,
      },
      actions: {
        addLog,
        appendPhaseDeadSnapshots,
        applyUserEconomyProgress,
        emitDeathRunEventOnce,
        finishGame,
        flushDeadSnapshots,
        persistSimEquipmentsFromChars,
        reconcileZeroHpDeaths,
        runVisibleClockToPhaseEnd,
        setAssistCounts,
        setDeathMetadata,
        setKillCounts,
        setMatchSec,
        setSpawnState,
        setSurvivors,
      },
    });
    if (phaseFinalizationResult?.shouldReturn) return;
  };

  // 진행 버튼/오토 플레이 공용 가드(중복 호출 방지)
  async function proceedPhaseGuarded() {
    if (isAdvancingRef.current) return;
    if (loading) return;
    if (isGameOver) return;
    const startInfo = getMatchStartInfo(survivors, settings);
    if (day === 0 && !startInfo.ready) {
      const needText = startInfo.matchMode === 'solo' ? '솔로는 생존자 2명 이상이 필요합니다.' : '스쿼드는 서로 다른 팀 2개 이상이 필요합니다.';
      addLog(`⚠️ 게임 시작 불가: ${needText} (현재 ${startInfo.participantCount}명 / ${startInfo.teamCount}팀)`, 'system');
      return;
    }
if (showMarketPanel && pendingTranscendPick) {
      addLog('🎁 초월 장비 선택 상자: 먼저 선택을 완료하세요.', 'system');
      return;
    }

    isAdvancingRef.current = true;
    setIsAdvancing(true);
    try {
      // ✅ "게임 시작" 순간(0일차 첫 진행)에는 맵 설정을 서버에서 강제 새로고침하여,
      //    Admin에서 수정한 crateAllowDeny 등이 즉시 반영되게 합니다.
      if (day === 0 && matchSec === 0) {
        await refreshMapSettingsFromServer('start');
      }

      // 🧾 런 시작(시드 재현): "첫 진행" 순간에만 1회 기록
      if (day === 0 && matchSec === 0) {
        setRunEvents([{
          kind: 'run_start',
          at: { day, phase, sec: matchSec },
          seed: runSeed,
          matchMode: startInfo.matchMode,
          teamSize: startInfo.teamSize,
          maxTeams: startInfo.maxTeams,
          participantCount: startInfo.participantCount,
          teamCount: startInfo.teamCount,
        }]);
      }
      await proceedPhase();
    } finally {
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    }
  };

  // 오토 플레이가 항상 최신 proceed를 호출하도록 ref에 연결
  useEffect(() => {
    proceedPhaseGuardedRef.current = proceedPhaseGuarded;
  });

  const matchStartInfo = getMatchStartInfo(survivors, settings);
  const startBlocked = day === 0 && !matchStartInfo.ready;
  const startBlockedText = matchStartInfo.matchMode === 'solo'
    ? `⚠️ 솔로 인원 부족 (${matchStartInfo.participantCount}/2명)`
    : `⚠️ 팀 부족 (${matchStartInfo.teamCount}/2팀 · ${matchStartInfo.participantCount}명)`;

  // ✅ 생존자 1명(또는 0명) 남으면 즉시 종료(틱/타이머 사망도 포함)
  useEffect(() => {
    if (loading || isGameOver) return;
    if (day === 0) return;
    if (!Array.isArray(survivors)) return;
    const aliveTeams = getAliveTeams(survivors);
    if (aliveTeams.length > 1) return;
    const finalSurvivors = aliveTeams[0]?.members || survivors;
    const id = window.setTimeout(() => {
      finishGameRef.current?.(finalSurvivors, killCounts, assistCounts);
    }, 0);
    return () => window.clearTimeout(id);
  }, [survivors, day, loading, isGameOver, killCounts, assistCounts]);


  // ▶ 오토 플레이: matchSec(페이즈 종료 시 증가)를 트리거로 다음 페이즈를 자동 진행
  useEffect(() => {
    if (!autoPlay) return;
    if (loading) return;
    if (isAdvancing) return;
    if (isGameOver) return;
    if (showMarketPanel && pendingTranscendPick) return;
    if (startBlocked) return;

    const speed = normalizeAutoSpeed(autoSpeedRef.current || autoSpeed);
    const delayMs = Math.max(80, Math.round(220 / speed));

    const id = window.setTimeout(() => {
      // ref를 통해 최신 함수 호출
      proceedPhaseGuardedRef.current?.();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [autoPlay, autoSpeed, autoSpeedRef, matchSec, loading, isAdvancing, isGameOver, showMarketPanel, pendingTranscendPick, day, phase, settings?.rulesetId, survivors.length, startBlocked, normalizeAutoSpeed, proceedPhaseGuardedRef]);

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
  const activeMapEff = activeMap || ((Array.isArray(zones) && zones.length)
    ? { _id: String(activeMapId || 'local'), zones }
    : null);
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

  const actionDisabled = loading || isAdvancing || startBlocked || (showMarketPanel && !!pendingTranscendPick);
  const aliveTeamCount = useMemo(() => getAliveTeams(survivors).length, [survivors]);
  const primaryProceedLabel = useMemo(() => {
    if (loading) return '로딩 중...';
    if (isAdvancing) return '진행 중...';
    if (startBlocked) return startBlockedText || '시작 조건 부족';
    if (isGameOver) return '다시 하기';
    if (day === 0) return '게임 시작';
    if (aliveTeamCount <= 1) return '결과 확인';
    if (phase === 'morning') return day >= 6 ? '서든데스' : '밤 진행';
    return day >= 6 ? '서든데스' : '낮 진행';
  }, [aliveTeamCount, day, isAdvancing, isGameOver, loading, phase, startBlocked, startBlockedText]);

  if (!hasHydrated) {
    return <SimulationHydrationPanel />;
  }

  return (
    <main className="simulation-page">
      <SiteHeader className="simulation-site-header" />

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className={`simulation-container modal-layout ${showMarketPanel ? 'devtools-open' : ''}`}>
        <SimulationSurvivorBoard
          activeMap={activeMap}
          closeUiModal={closeUiModal}
          day={day}
          dead={dead}
          forbiddenNow={forbiddenNow}
          getTeamStateForActor={getTeamStateForActor}
          getZoneName={getZoneName}
          killCounts={killCounts}
          phase={phase}
          settings={settings}
          survivors={survivors}
          timeOfDay={timeOfDay}
          uiModal={uiModal}
          zones={zones}
        />
        {/* 게임 화면 */}
        <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
          <div className="screen-header">
            <Link href="/" className="simulation-mobile-logo" aria-label="ETERNAL HUNGER 메인">
              <span className="logo-top">ETERNAL</span>
              <span className="logo-main">HUNGER</span>
            </Link>
            <h1>{day === 0 ? 'GAME READY' : `DAY ${day} - ${timeOfDay === 'day' ? 'DAY' : 'NIGHT'}`}</h1>
            <div className="screen-header-right">
              <span className="weather-badge">{timeOfDay === 'day' ? '☀ 낮' : '🌙 밤'}</span>
              <span className="weather-badge">⏱ {formatClock(matchSec)}</span>

              {isGameOver ? (
                <button
                  className="btn-restart sim-header-proceed"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  {primaryProceedLabel}
                </button>
              ) : (
                <button
                  className="btn-proceed sim-header-proceed"
                  type="button"
                  onClick={proceedPhaseGuarded}
                  disabled={actionDisabled}
                  title={startBlocked ? startBlockedText : '현재 페이즈를 진행합니다.'}
                >
                  {primaryProceedLabel}
                </button>
              )}

              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('map')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🗺️ 미니맵
              </button>
              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('chars')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                👥 캐릭터
              </button>
              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('log')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🧾 로그
              </button>

              <button
                className={`btn-secondary sim-devtools-btn ${showMarketPanel ? 'active' : ''}`}
                onClick={() => setShowMarketPanel((v) => !v)}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="상점/조합/교환 및 테스트용 개발자 도구를 엽니다."
              >
                {showMarketPanel ? '🛠 도구 닫기' : '🛠 개발자'}
              </button>

              <button
                className="btn-secondary sim-refresh-btn"
                onClick={() => { void fireAndReport('refreshMapSettings.manual', () => refreshMapSettingsFromServer('manual')); }}
                disabled={loading || isAdvancing || isGameOver}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
              >
                {isRefreshingMapSettings ? '⏳ 새로고침 중...' : '🔄 맵 새로고침'}
              </button>

              {/* 🌀 하이퍼루프: 맵 내 장치(패드) 상호작용은 미니맵 아래에서 제공 */}

              {mapRefreshToast ? (
                <span
                  className="weather-badge"
                  style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={mapRefreshToast.text}
                >
                  {mapRefreshToast.kind === 'error' ? '⚠️' : '✅'} {mapRefreshToast.text}
                </span>
              ) : null}
            </div>
          </div>

          {detonationRiskSummary?.visible ? (
            <div className="forbidden-top-bar">
              <span className="fz-title">🚫 금지구역</span>
              <span className="fz-chip" title="6번째 밤부터는 교전을 강하게 유도(서든데스)하고, 마지막 1명 생존 시 게임이 종료됩니다.">
                🔥 서든데스: <b>6번째 밤 이후</b>
              </span>
              <span className="fz-chip" title={detonationRiskSummary?.fzHoverText || '현재 금지구역 없음'}>금지 <b>{detonationRiskSummary?.forbiddenCnt || 0}</b> / 전체 <b>{detonationRiskSummary?.total || 0}</b> · 안전 <b>{detonationRiskSummary?.safeLeft || 0}</b></span>
              <span
                className={`fz-chip ${(detonationRiskSummary?.riskyCount || 0) > 0 ? 'fz-danger' : ''}`}
                title={detonationRiskSummary?.riskyTitle || '폭발 타이머 임계치 이하 생존자 수'}
              >
                ⚠️ 위험 <b>{detonationRiskSummary?.riskyCount || 0}</b>명
              </span>
              {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
                <span className="fz-chip fz-danger" title={`이번 진행에서 새로 금지된 구역: ${forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}`}>
                  +{forbiddenAddedNow.length} 신규 금지
                </span>
              ) : null}
              {detonationRiskSummary?.willForceAllThisPhase ? (
                <span className="fz-chip fz-danger" title="안전구역이 1~2개 남은 상태에서 현 페이즈 길이가 기준 이상이면 폭발이 전 구역에 적용됩니다.">
                  ☢️ 이번 페이즈 전구역 폭발 가능
                </span>
              ) : null}
            </div>
          ) : null}


          <div className="simulation-stage">
            <div className="simulation-battlefield-column">
              <SimulationWorldSpawnToolbar
                activeMapId={activeMapId}
                day={day}
                spawnState={spawnState}
                zones={zones}
              />

              <SimulationMinimapPanel
                activeMapId={activeMapId}
                closeUiModal={closeUiModal}
                day={day}
                dead={dead}
                doHyperloopJump={doHyperloopJump}
                forbiddenNow={forbiddenNow}
                getTeamStateForActor={getTeamStateForActor}
                getZoneName={getZoneName}
                hyperloopCharId={hyperloopCharId}
                hyperloopDestId={hyperloopDestId}
                hyperloopDestIds={hyperloopDestIds}
                hyperloopPadName={hyperloopPadName}
                hyperloopPadZoneId={hyperloopPadZoneId}
                hyperloopZoneSet={hyperloopZoneSet}
                isAdvancing={isAdvancing}
                isGameOver={isGameOver}
                isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
                loading={loading}
                maps={maps}
                recentPings={recentPings}
                selectedCharId={selectedCharId}
                setHyperloopDestId={setHyperloopDestId}
                survivors={survivors}
                uiModal={uiModal}
                zones={zones}
                zoneEdges={zoneEdges}
                zonePos={zonePos}
              />
            </div>

            <aside className="simulation-side-column" aria-label="Simulation status and logs">
              <SimulationMatchStatusPanel
                day={day}
                phase={phase}
                matchSec={formatClock(matchSec)}
                survivors={survivors}
                dead={dead}
                killCounts={killCounts}
                activeMap={activeMap}
                zones={zones}
                forbiddenNow={forbiddenNow}
                spawnState={spawnState}
                getZoneName={getZoneName}
              />

              <SimulationLogPanel
                uiModal={uiModal}
                closeUiModal={closeUiModal}
                day={day}
                activeMap={activeMap}
                zones={zones}
                forbiddenNow={forbiddenNow}
                forbiddenAddedNow={forbiddenAddedNow}
                settings={settings}
                getRuleset={getRuleset}
                getZoneName={getZoneName}
                prevPhaseLogs={prevPhaseLogs}
                showPrevLogs={showPrevLogs}
                setShowPrevLogs={setShowPrevLogs}
                logs={logs}
                showDetailedLogs={showDetailedLogs}
                setShowDetailedLogs={setShowDetailedLogs}
                logWindowRef={logWindowRef}
                logBoxRef={logBoxRef}
                logBoxMaxH={logBoxMaxH}
                actorAvatarByName={actorAvatarByName}
                extractActorNameFromLog={extractActorNameFromLog}
              />
            </aside>
          </div>

          <SimulationControlPanel
            matchMode={normalizeMatchMode(settings?.matchMode)}
            onMatchModeChange={handleMatchModeChange}
            matchModeDisabled={loading || isAdvancing || day !== 0}
            characterSkillsEnabled={characterSkillsEnabled}
            onCharacterSkillsToggle={handleCharacterSkillsToggle}
            characterSkillsDisabled={loading || isAdvancing}
            isGameOver={isGameOver}
            onRestart={() => window.location.reload()}
            onProceed={proceedPhaseGuarded}
            actionDisabled={actionDisabled}
            loading={loading}
            isAdvancing={isAdvancing}
            startBlocked={startBlocked}
            startBlockedText={startBlockedText}
            day={day}
            phase={phase}
            aliveTeamCount={aliveTeamCount}
            showMarketPanel={showMarketPanel}
            onToggleDevTools={() => setShowMarketPanel((v) => !v)}
            autoPlay={autoPlay}
            onToggleAutoPlay={() => setAutoPlay((v) => !v)}
            autoDisabled={loading || isGameOver || startBlocked}
            autoSpeed={autoSpeed}
            onAutoSpeedChange={updateAutoSpeed}
            speedDisabled={loading || isGameOver}
          />

        </section>

        <SimulationMarketPanel
          acceptTradeOffer={acceptTradeOffer}
          activeViewerPerkBundle={activeViewerPerkBundle}
          addLog={addLog}
          applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
          candidateSurvivors={candidateSurvivors}
          cancelTradeOffer={cancelTradeOffer}
          createTradeOffer={createTradeOffer}
          craftables={craftables}
          credits={credits}
          day={day}
          deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
          devEventPreviewLimit={DEV_EVENT_PREVIEW_LIMIT}
          devForceUseConsumable={devForceUseConsumable}
          devGrantItemId={devGrantItemId}
          devGrantItemOptions={devGrantItemOptions}
          devGrantItemToSelected={devGrantItemToSelected}
          devGrantQty={devGrantQty}
          devGrantSearch={devGrantSearch}
          doCraft={doCraft}
          doDroneBuy={doDroneBuy}
          doKioskTransaction={doKioskTransaction}
          doPerkPurchase={doPerkPurchase}
          droneOffers={droneOffers}
          exportBattleLog={exportBattleLog}
          fireAndReport={fireAndReport}
          getQty={getQty}
          getZoneName={getZoneName}
          inventoryOptions={inventoryOptions}
          isAdvancing={isAdvancing}
          isGameOver={isGameOver}
          itemNameById={itemNameById}
          kiosks={kiosks}
          loadMarket={loadMarket}
          loadTrades={loadTrades}
          marketCardRenderLimit={MARKET_CARD_RENDER_LIMIT}
          marketMessage={marketMessage}
          marketTab={marketTab}
          matchSec={matchSec}
          myTradeOffers={myTradeOffers}
          ownedPerkCodeSet={ownedPerkCodeSet}
          participantPresetName={participantPresetName}
          participantPresets={participantPresets}
          pendingTranscendPick={pendingTranscendPick}
          publicItems={publicItems}
          publicPerks={publicPerks}
          resolvePendingTranscendPick={resolvePendingTranscendPick}
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
          setDevGrantItemId={setDevGrantItemId}
          setDevGrantQty={setDevGrantQty}
          setDevGrantSearch={setDevGrantSearch}
          setParticipantPresetName={setParticipantPresetName}
          setQty={setQty}
          setRunSeed={setRunSeed}
          setSeedDraft={setSeedDraft}
          setEquipForSurvivor={setEquipForSurvivor}
          setMarketTab={selectMarketTab}
          setShowAllMarketRows={setShowAllMarketRows}
          setShowDevDebugDetails={setShowDevDebugDetails}
          setShowDevEventLog={setShowDevEventLog}
          setShowMarketPanel={setShowMarketPanel}
          setSelectedCharId={setSelectedCharId}
          setTradeDraft={setTradeDraft}
          setTradeWantSearch={setTradeWantSearch}
          showAllMarketRows={showAllMarketRows}
          showDevDebugDetails={showDevDebugDetails}
          showDevEventLog={showDevEventLog}
          showMarketPanel={showMarketPanel}
          simulationDiagnostics={simulationDiagnostics}
          simulationDiagnosticsLine={simulationDiagnosticsLine}
          survivors={survivors}
          syncMyState={syncMyState}
          tradeDraft={tradeDraft}
          tradeOffers={tradeOffers}
          tradeWantItemOptions={tradeWantItemOptions}
          tradeWantSearch={tradeWantSearch}
          viewerLp={viewerLp}
          viewerPerks={viewerPerks}
          visibleCraftables={visibleCraftables}
          visibleDevGrantItemOptions={visibleDevGrantItemOptions}
          visibleDroneOffers={visibleDroneOffers}
          visibleKiosks={visibleKiosks}
          visibleMyTradeOffers={visibleMyTradeOffers}
          visiblePublicPerks={visiblePublicPerks}
          visibleTradeOffers={visibleTradeOffers}
        />
      </div>

      {/* 결과 모달창 */}
      <SimulationResultModal
        open={showResultModal}
        gameEndReason={gameEndReason}
        winner={winner}
        resultSummary={resultSummary}
        specialSourceSummary={specialSourceSummary}
        gainSourceSummary={gainSourceSummary}
        creditSourceSummary={creditSourceSummary}
        gainDetailSummary={gainDetailSummary}
        runSupportSummary={runSupportSummary}
        runActionSummary={runActionSummary}
        objectiveSummary={objectiveSummary}
        topRankedCharacters={topRankedCharacters}
        killCounts={killCounts}
        assistCounts={assistCounts}
        onExportBattleLog={exportBattleLog}
        onClose={() => setShowResultModal(false)}
      />

    </main>
  );
}
