'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { apiPost } from '../../utils/api';
import { buildErBehaviorModifier } from '../../utils/erMeta';
import {
  EFFECT_AIRBORNE,
  EFFECT_STUN,
  applyHealingModifier,
  getLifestealPercent,
  hasActionBlockStatus,
} from '../../utils/statusLogic';
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

import {
  applyCharacterSkillOnBasicAttack,
  areCharacterSkillsEnabled,
} from './_lib/characterSkillRuntime';
import {
  itemIcon,
  shuffleArray,
  perkNumber,
  getPerkAggressionBias,
  applyPerkCreditBonus,
  maybeBoostDropQty,
  normalizeRuntimeSurvivorList,
  buildRuntimeSurvivorMap,
  upsertRuntimeSurvivor,
  normalizeRuntimeSurvivor,
  getInvItemId,
  getEquipMoveSpeed,
  extractActorNameFromLog,
  uniqStr,
  clampTier4,
  tierLabelKo,
  findItemByKeywords,
  applyAiRecoveryWindow,
  isAiRecoveryLocked,
  normalizeRevivedSurvivor,
  hasKioskAtZone,
  classifySpecialByName,
  uniqStrings,
  bfsPickSafestZone,
  inferEquipSlot,
  hasActiveEffect,
  canReceiveItem,
  normalizeInventory,
  invQty,
  consumeIngredientsFromInv,
  areSameTeam,
  getActorTeamCapacity,
  getActorTeamId,
  getActorTeamName,
  getActorTeamOriginalSize,
  getAliveTeams,
  pickTeamRepresentative,
  getTimeOfDayFromPhase,
  worldPhaseIndex,
} from './_lib/simulationEngine';
import {
  isExplicitDay1HeroRoutePlan,
} from './_lib/routePlanProgressRuntime';
import { runDay1HeroGearDirectorWithLogs } from './_lib/phaseRouteProgressRuntime';
import { runRouteFarmAction } from './_lib/phaseRouteFarmRuntime';
import { runHuntAction } from './_lib/phaseHuntActionRuntime';
import { openLegendaryCrateForActor } from './_lib/phaseLegendaryCrateRuntime';
import { runCraftAction } from './_lib/phaseCraftActionRuntime';
import { runProcurementAction } from './_lib/phaseProcurementActionRuntime';
import { runActorPostActionPhase } from './_lib/phaseActorPostActionRuntime';
import { runDetonationTickPhase } from './_lib/phaseDetonationTickRuntime';
import { runDimensionRiftPhase } from './_lib/phaseDimensionRiftRuntime';
import { runFacilityGatherPhase } from './_lib/phaseFacilityGatherRuntime';
import { runFieldLootPhase } from './_lib/phaseFieldLootRuntime';
import { runWorldSpawnPickupPhase } from './_lib/phaseWorldSpawnPickupRuntime';
import {
  normalizeSatiety,
  decayActorSatiety,
} from './_lib/satietyRuntime';
import {
  getRuntimeActorKey,
  dedupeRuntimeParticipants,
} from './_lib/runtimeParticipantRuntime';
import {
  normalizeMatchMode,
  getMatchConfig,
  applyMatchTeams,
  getMatchStartInfo,
} from './_lib/matchRosterRuntime';
import { useSimEquipmentPersistence } from './_lib/useSimEquipmentPersistence';
import {
  formatClock,
  softenNonLethalBattleLog,
} from './_lib/simulationFormattingRuntime';
import { useSimulationInitialData } from './_lib/useSimulationInitialData';
import { useSimulationRuntimeGuards } from './_lib/useSimulationRuntimeGuards';
import { useHyperloopPickLog } from './_lib/useHyperloopPickLog';
import { createPhaseDeathRuntime } from './_lib/phaseDeathRuntime';
import {
  getForbiddenZoneIdsForPhase as getForbiddenZoneIdsForPhaseRuntime,
  getForbiddenAddedZoneIdsForPhase as getForbiddenAddedZoneIdsForPhaseRuntime,
} from './_lib/forbiddenZoneRuntime';
import {
  canonicalizeCharName,
} from './_lib/combatRuntime';
import { createPhaseCombatTacticalRuntime } from './_lib/phaseCombatTacticalRuntime';
import { createPhaseCombatFleeRuntime } from './_lib/phaseCombatFleeRuntime';
import { createPhaseCombatSkillSplashRuntime } from './_lib/phaseCombatSkillSplashRuntime';
import { createPhaseCombatEliminationRuntime } from './_lib/phaseCombatEliminationRuntime';
import {
  estimatePvpPower,
  pickUnbiasedBattle as pickUnbiasedBattleRuntime,
  shouldAvoidCombatByPvpPower,
} from './_lib/pvpMatchupRuntime';
import {
  buildPvpPhaseRuntime,
  pickPvpTarget as pickPvpTargetRuntime,
} from './_lib/pvpPhaseRuntime';
import {
  runForcedSuddenDeathClash,
  runSuddenDeathGatherPhase,
} from './_lib/suddenDeathRuntime';
import { logRuntimeEffectResults } from './_lib/runtimeStatus';
import {
  createPhaseConsumableRuntime,
} from './_lib/consumableRuntime';
import { finishSimulationGame } from './_lib/finishGameRuntime';
import { createMarketActionRuntime } from './_lib/marketActionRuntime';
import { createMapActionRuntime } from './_lib/mapActionRuntime';
import { createDevToolActionRuntime } from './_lib/devToolActionRuntime';
import { useSimulationMarketState } from './_lib/useSimulationMarketState';
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
import { applyActorPhaseStatusTick } from './_lib/phaseActorStatusRuntime';
import { runActorMovementDecisionPhase } from './_lib/phaseActorMovementRuntime';
import { prepareActorPhaseActionPlan } from './_lib/phaseActionQueueRuntime';

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

  // 🛠 개발자 도구: 선택 캐릭터에게 소모품을 임의로 사용(강제)
  // - 전투 중 사용 불가: 진행 중(isAdvancing)일 때는 버튼을 비활성화합니다.
  
  // 🎁 개발자 도구: 초월 장비 선택 상자(선택 대기) 처리
  function getDevToolActions() {
    return createDevToolActionRuntime({
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
  }

  function resolvePendingTranscendPick(optionIndex, method = 'manual') {
    return getDevToolActions().resolvePendingTranscendPick(optionIndex, method);
  };

  const devForceUseConsumable = (charId, invIndex) => {
    return getDevToolActions().devForceUseConsumable(charId, invIndex);
  };

  // 🎒 장비 장착/해제(런타임): equipped[slot]에 itemId를 저장
  function setEquipForSurvivor(survivorId, slot, itemIdOrNull) {
    return getDevToolActions().setEquipForSurvivor(survivorId, slot, itemIdOrNull);
  };
  function getMapActions() {
    return createMapActionRuntime({
      refs: {
        activeMapIdRef,
        activeMapRef,
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
      },
      actions: {
        addLog,
        applyActiveMapId,
        emitRunEvent,
        getForbiddenZoneIdsForPhase,
        setIsRefreshingMapSettings,
        setMaps,
        setSurvivors,
        showMapRefreshToast,
      },
    });
  }

  function doHyperloopJump(toMapId, whoId) {
    return getMapActions().doHyperloopJump(toMapId, whoId);
  }
    // ✅ 게임 시작 전(0일차)에만 시드를 적용해 랜덤 재현성을 확보합니다.
  function getForbiddenZoneIdsForPhase(mapObj, dayNum, phaseKey) {
    return getForbiddenZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef.current);
  }

  function getForbiddenAddedZoneIdsForPhase(mapObj, dayNum, phaseKey) {
    return getForbiddenAddedZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef.current);
  };
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

    const reviveCfg = ruleset?.revive || {};
    const phaseFromTimeOfDay = (value) => String(value || 'day') === 'night' ? 'night' : 'morning';

    // 🧬 부활 컷오프: 기본 2일차 밤(포함)까지 자동 부활, 5일차 낮까지 유료 부활
    const reviveAutoCutoff = reviveCfg?.autoCutoff || {};
    const revivePaidCutoff = reviveCfg?.paidCutoff || {};
    const reviveWipeProtectionCutoff = reviveCfg?.teamWipeProtectionCutoff || { day: 2, timeOfDay: 'day' };
    const reviveCutoffIdx = worldPhaseIndex(
      Number(reviveAutoCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveAutoCutoff?.timeOfDay ?? reviveAutoCutoff?.phase ?? 'night')
    );
    const wipeProtectionCutoffIdx = worldPhaseIndex(
      Number(reviveWipeProtectionCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveWipeProtectionCutoff?.timeOfDay ?? reviveWipeProtectionCutoff?.phase ?? 'day')
    );
    const paidReviveCutoffIdx = worldPhaseIndex(
      Number(revivePaidCutoff?.day ?? 5),
      phaseFromTimeOfDay(revivePaidCutoff?.timeOfDay ?? revivePaidCutoff?.phase ?? 'day')
    );
    const paidReviveCostBase = Math.max(0, Number(reviveCfg?.paidCostBase ?? 100));
    const paidReviveCostPerUse = Math.max(0, Number(reviveCfg?.paidCostPerUse ?? 50));
    const reviveHpRatio = Math.max(0.05, Math.min(1, Number(reviveCfg?.hpRatio ?? 0.65)));
    let revivedNow = [];

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

    // 🧬 부활 처리: deadAtPhaseIdx(사망 시점)가 컷오프 이하이면 다음 페이즈 시작에 1회 부활
    if (Array.isArray(dead) && dead.length) {
      const safeZonePool = (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
        .map((z) => String(z?.zoneId ?? z?.id ?? z?._id ?? ''))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)));
      const remainingDead = [];

      for (const d0 of dead) {
        const deadAt = Number(d0?.deadAtPhaseIdx ?? -9999);
        const teamAlive = canReviveThisMatch && (Array.isArray(survivors) ? survivors : []).some((s) => Number(s?.hp || 0) > 0 && areSameTeam(s, d0));
        const teamWipeProtected = canReviveThisMatch && phaseIdxNow <= wipeProtectionCutoffIdx && deadAt >= 0 && deadAt <= wipeProtectionCutoffIdx;
        const canAutoReviveByTeamState = teamAlive || teamWipeProtected;
        const autoEligible = canReviveThisMatch && canAutoReviveByTeamState && (d0?.reviveEligible === true || (deadAt >= 0 && deadAt <= reviveCutoffIdx)) && !d0?.revivedOnce;
        const paidReviveCount = Math.max(0, Math.floor(Number(d0?.paidReviveCount || 0)));
        const paidCost = paidReviveCostBase + paidReviveCostPerUse * paidReviveCount;
        const paidEligible = canReviveThisMatch && !autoEligible && phaseIdxNow <= paidReviveCutoffIdx && teamAlive && Number(d0?.simCredits || 0) >= paidCost;
        if (autoEligible || paidEligible) {
          const maxHp = Number(d0?.maxHp ?? 100);
          const revivedHp = Math.max(1, Math.floor(maxHp * reviveHpRatio));
          const zoneId = safeZonePool.length ? String(safeZonePool[Math.floor(Math.random() * safeZonePool.length)]) : String(d0?.zoneId || '');
          const reviveKit = findItemByKeywords(publicItems, ['붕대', 'bandage', '응급']);

          const r = normalizeRevivedSurvivor(d0, revivedHp, zoneId, phaseIdxNow, ruleset, phaseStartSec, reviveKit);
          if (paidEligible) {
            r.simCredits = Math.max(0, Number(r.simCredits || 0) - paidCost);
            r.paidReviveCount = paidReviveCount + 1;
          }
          if (useDetonation) {
            const startSec = Number(ruleset?.detonation?.startSec ?? 20);
            const maxSec = Number(ruleset?.detonation?.maxSec ?? 30);
            r.detonationMaxSec = maxSec;
            r.detonationSec = Math.min(maxSec, startSec);
          }

          revivedNow.push(r);
          emitRunEvent('revive', { who: String(r._id || ''), zoneId: String(zoneId || ''), hp: revivedHp, paid: paidEligible, cost: paidEligible ? paidCost : 0 }, atNow());
          addLog(`✨ [${r.name}] ${paidEligible ? `유료 부활! (-${paidCost}Cr)` : '부활!'} (HP ${revivedHp}${reviveKit?._id ? ', 붕대 1 지급' : ''})`, 'highlight');
        } else {
          remainingDead.push(d0);
        }
      }

      if (revivedNow.length) setDead(remainingDead);
    }
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
    const baseZonePop = {};
    (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((s) => {
      if (!s || Number(s.hp || 0) <= 0) return;
      const zid = String(s.zoneId || '');
      if (!zid) return;
      baseZonePop[zid] = (baseZonePop[zid] || 0) + 1;
    });
    const movePowerContext = { ruleset, battleSettings };
    const runDay1HeroGear = (actor, options) => runDay1HeroGearDirectorWithLogs({
      state: { actor, publicItems, itemNameById, itemMetaById, day: nextDay, phase: nextPhase, ruleset },
      actions: { addLog },
      options,
    });

    let updatedSurvivors = (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
      .map((s) => {
        const statusTickResult = applyActorPhaseStatusTick({
          state: {
            actor: s,
            canReviveThisMatch,
            elapsedSec: phaseDurationSec,
            phaseIdxNow,
            reviveCutoffIdx,
          },
          actions: {
            addLog,
            emitDeathRunEventOnce,
            setDeathMetadata,
          },
        });
        let updated = statusTickResult.actor;
        if (statusTickResult.died) {
          newlyDead.push(updated);
          return updated;
        }

        const movementResult = runActorMovementDecisionPhase({
          state: {
            actor: updated,
            baseZonePop,
            craftables,
            forbiddenIds,
            hyperloopDelaySec: HYPERLOOP_DELAY_SEC,
            isSoloMatch,
            itemKeyById,
            itemMetaById,
            itemNameById,
            kiosks,
            mapObj,
            movePowerContext,
            nextDay,
            nextPhase,
            nextSpawn,
            phaseIdxNow,
            phaseSurvivors,
            ruleset,
            zoneGraph,
            zones,
          },
          actions: {
            addLog,
            atNow,
            emitRunEvent,
            getZoneName,
            grantMastery,
            isHyperloopTransit,
            reserveActionSecond,
          },
        });
        updated = movementResult.actor;
        const currentZone = movementResult.currentZone;
        const nextZoneId = movementResult.nextZoneId;
        const didMove = movementResult.didMove;
        const preGoal = movementResult.preGoal;
        const upgradeNeed = movementResult.upgradeNeed;
        const holdTarget = movementResult.holdTarget;
        const moveReason = movementResult.moveReason;
        const moveObjectiveType = movementResult.moveObjectiveType;
        const moveObjectiveSubkind = movementResult.moveObjectiveSubkind;
        const moveContestPressure = movementResult.moveContestPressure;
        const fleeInterruptReason = movementResult.fleeInterruptReason;
        const recovering = movementResult.recovering;
        const mustEscape = movementResult.mustEscape;
        const usedHyperloopMove = movementResult.usedHyperloopMove;
        const moveEtaSec = movementResult.moveEtaSec;

        // ✅ 1일차 "최소 1회 이동" 목표 추적
        if (didMove && Number(nextDay || 0) === 1) {
          updated.day1Moves = Math.max(0, Number(updated.day1Moves || 0)) + 1;
          if (String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
            runDay1HeroGear(updated, {
              allowAbstractFallback: true,
              forceRouteCompletion: true,
              routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
            });
          }
        }

        const facilityGatherResult = runFacilityGatherPhase({
          state: {
            actor: updated,
            mapObj,
            nextDay,
            publicItems,
            ruleset,
          },
          actions: {
            addLog,
            atNow,
            emitItemGainIfAny,
            getZoneName,
          },
        });
        updated = facilityGatherResult.actor;

        const fieldLootResult = runFieldLootPhase({
          state: {
            actor: updated,
            craftables,
            didMove,
            itemMetaById,
            itemNameById,
            mapObj,
            nextDay,
            nextPhase,
            pendingPickAssigned,
            pendingTranscendPick,
            preGoal,
            publicItems,
            ruleset,
            selectedCharId,
            showMarketPanel,
          },
          actions: {
            addLog,
            applyLootCraftResult,
            atNow,
            emitItemGainIfAny,
            getZoneName,
            grantMastery,
            setPendingTranscendPick,
          },
        });
        updated = fieldLootResult.actor;
        pendingPickAssigned = fieldLootResult.pendingPickAssigned;

        const worldSpawnPickupResult = runWorldSpawnPickupPhase({
          state: {
            actor: updated,
            craftables,
            didMove,
            itemMetaById,
            itemNameById,
            nextDay,
            nextPhase,
            nextSpawn,
            pendingPickAssigned,
            pendingTranscendPick,
            phaseIdxNow,
            preGoal,
            publicItems,
            ruleset,
            selectedCharId,
            showMarketPanel,
          },
          actions: {
            addLog,
            applyLootCraftResult,
            atNow,
            emitItemGainIfAny,
            emitObjectiveRunEvent,
            emitRunEvent,
            getZoneName,
            grantMastery,
            setPendingTranscendPick,
          },
        });
        updated = worldSpawnPickupResult.actor;
        pendingPickAssigned = worldSpawnPickupResult.pendingPickAssigned;

        const isKioskZone = hasKioskAtZone(kiosks, mapObj, updated.zoneId);

        const actionPlan = prepareActorPhaseActionPlan({
          state: {
            actor: updated,
            craftables,
            currentActionSec,
            currentZone,
            didMove,
            droneOffers,
            fleeInterruptReason,
            holdTarget,
            itemKeyById,
            itemMetaById,
            itemNameById,
            kiosks,
            mapObj,
            marketRules,
            moveContestPressure,
            moveEtaSec,
            moveObjectiveSubkind,
            moveObjectiveType,
            moveReason,
            mustEscape,
            nextDay,
            nextPhase,
            nextZoneId,
            phaseIdxNow,
            publicItems,
            recovering,
            ruleset,
            upgradeNeed,
            usedHyperloopMove,
          },
          actions: {
            atNow,
            emitQueueRunEvent,
            getZoneName,
          },
        });
        updated = actionPlan.actor;
        const fallbackRouteItemIds = actionPlan.fallbackRouteItemIds;
        const goalMissingIds = actionPlan.goalMissingIds;
        const queuedKioskAction = actionPlan.queuedKioskAction;
        const queuedDroneOrder = actionPlan.queuedDroneOrder;
        const queuedActionType = actionPlan.queuedActionType;

        if (queuedActionType === 'routeFarm' && fallbackRouteItemIds.length > 0) {
          runRouteFarmAction({
            state: {
              actor: updated,
              craftables,
              fallbackRouteItemIds,
              goalMissingIds: [...goalMissingIds],
              initialLoot: fieldLootResult.loot,
              itemMetaById,
              itemNameById,
              mapObj,
              nextDay,
              nextPhase,
              publicItems,
              ruleset,
            },
            actions: {
              addLog,
              applyLootCraftResult,
              atNow,
              emitItemGainIfAny,
              getZoneName,
              grantMastery,
            },
          });
        }

        if (queuedActionType === 'routeFarm' && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
          runDay1HeroGear(updated, {
            allowAbstractFallback: true,
            forceRouteCompletion: true,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
        }

        if (queuedActionType === 'hunt') {
          const huntAction = runHuntAction({
            state: {
              actor: updated,
              canReviveThisMatch,
              craftables,
              didMove,
              goalMissingIds,
              isKioskZone,
              itemMetaById,
              itemNameById,
              mapObj,
              nextDay,
              nextPhase,
              nextSpawn,
              phaseIdxNow,
              publicItems,
              recovering,
              reviveCutoffIdx,
              ruleset,
              wasAlive: Number(s.hp || 0) > 0,
            },
            actions: {
              addLog,
              applyLootCraftResult,
              atNow,
              emitDeathRunEventOnce,
              emitItemGainIfAny,
              emitObjectiveRunEvent,
              emitRunEvent,
              grantMasteries,
              setDeathMetadata,
            },
          });
          updated = huntAction.actor;
          if (huntAction.died) newlyDead.push(updated);
        }

        const legendaryCrateResult = openLegendaryCrateForActor({
          state: {
            actor: updated,
            craftables,
            didMove,
            itemMetaById,
            itemNameById,
            nextDay,
            nextPhase,
            nextSpawn,
            phaseIdxNow,
            publicItems,
            ruleset,
          },
          actions: {
            addLog,
            applyLootCraftResult,
            atNow,
            emitItemGainIfAny,
            emitObjectiveRunEvent,
            emitRunEvent,
            getZoneName,
            grantMastery,
          },
        });
        updated = legendaryCrateResult.actor;

        const procurementActionResult = runProcurementAction({
          state: {
            actor: updated,
            craftables,
            itemMetaById,
            itemNameById,
            nextDay,
            nextPhase,
            phaseIdxNow,
            publicItems,
            queuedActionType,
            queuedDroneOrder,
            queuedKioskAction,
            ruleset,
          },
          actions: {
            addLog,
            applyLootCraftResult,
            atNow,
            emitItemGainIfAny,
            emitRunEvent,
          },
        });
        updated = procurementActionResult.actor;

        const craftActionResult = runCraftAction({
          state: {
            actor: updated,
            craftables,
            itemMetaById,
            itemNameById,
            nextDay,
            nextPhase,
            phaseIdxNow,
            publicItems,
            queuedActionType,
            ruleset,
            selectedCharId,
          },
          actions: {
            addLog,
            atNow,
            emitCraftRunEvent,
            runDay1HeroGear,
          },
        });
        updated = craftActionResult.actor;


        const postActionResult = runActorPostActionPhase({
          state: {
            actor: updated,
            canReviveThisMatch,
            damagePerTick,
            forbiddenIds,
            nextDay,
            nextPhase,
            phaseIdxNow,
            reviveCutoffIdx,
            ruleset,
            sourceActor: s,
            useDetonation,
          },
          actions: {
            addLog,
            emitDeathRunEventOnce,
            getZoneName,
            runDay1HeroGear,
            setDeathMetadata,
          },
        });
        updated = postActionResult.actor;
        if (postActionResult.died) newlyDead.push(updated);
        return updated;
      })
      .filter((s) => Number(s.hp || 0) > 0);

    const dimensionRiftResult = runDimensionRiftPhase({
      state: {
        currentActionSec,
        forbiddenIds,
        isSoloMatch,
        itemMetaById,
        itemNameById,
        movePowerContext,
        nextDay,
        nextPhase,
        nextSpawn,
        phaseIdxNow,
        publicItems,
        ruleset,
        updatedSurvivors,
        zones,
      },
      actions: {
        addLog,
        atNow,
        emitItemGainIfAny,
        emitRunEvent,
        getZoneName,
      },
    });
    updatedSurvivors = dimensionRiftResult.updatedSurvivors;

    const suddenDeathGatherResult = runSuddenDeathGatherPhase({
      state: {
        ruleset,
        suddenDeathActive: suddenDeathActiveRef.current,
        suddenDeathSafeZoneIds,
        updatedSurvivors,
      },
      actions: {
        addLog,
        atNow,
        emitRunEvent,
        getZoneName,
      },
    });
    updatedSurvivors = suddenDeathGatherResult.updatedSurvivors;

    const detonationTickResult = runDetonationTickPhase({
      state: {
        canReviveThisMatch,
        fogLocalSec,
        forbiddenIds,
        mapObj,
        newlyDead,
        phaseDurationSec,
        phaseIdxNow,
        phaseStartSec,
        reviveCutoffIdx,
        ruleset,
        suddenDeathActive: suddenDeathActiveRef.current,
        tickSec,
        updatedSurvivors,
        useDetonation,
        zoneGraph,
      },
      actions: {
        addLog,
        atNow,
        emitDeathRunEventOnce,
        getZoneName,
        setDeathMetadata,
      },
    });
    updatedSurvivors = detonationTickResult.updatedSurvivors;

    flushDeadSnapshots(appendPhaseDeadSnapshots(newlyDead));

    const {
      assistWindowPhases,
      battleProb,
      isDay1MorningFarmPhase,
      isEarlyRouteFarmingActor,
      pvpMinSameZone,
      pvpProbCfg,
      restrictedRatio,
      suddenDeath,
      totalZonesCount,
    } = buildPvpPhaseRuntime({
      fogLocalSec,
      forbiddenIds,
      mapObj,
      nextDay,
      nextPhase,
      ruleset,
    });

    // 전투 알고리즘 보정값(ER 느낌): 제한구역 압박/밤 여부를 전투 계산에도 전달
    battleSettings.battle.pressure = restrictedRatio;
    battleSettings.battle.isNight = (nextPhase === 'night');
    const pvpMatchupContext = { ruleset, battleSettings, nextDay };
    const estimatePower = (actor) => estimatePvpPower(actor, pvpMatchupContext);
    const shouldAvoidCombatByPower = (actor, opponent) => shouldAvoidCombatByPvpPower(actor, opponent, pvpMatchupContext);
    const pickUnbiasedBattle = (actor, opponent) => pickUnbiasedBattleRuntime(actor, opponent, pvpMatchupContext);

    let survivorMap = buildRuntimeSurvivorMap(normalizeRuntimeSurvivorList(updatedSurvivors));
    let todaysSurvivors = [];
    let newDeadIds = [];
    const refillActionWave = () => {
      const liveActors = Array.from(survivorMap.values())
        .filter((s) => s?._id && !newDeadIds.includes(s._id) && Number(s.hp || 0) > 0)
        .map((s) => normalizeRuntimeSurvivor(s));
      todaysSurvivors = shuffleArray(liveActors);
      return todaysSurvivors.length;
    };

    // 이번 턴 킬 모아두기
    let roundKills = {};
    let roundAssists = {};

    const consCfg = ruleset?.consumables || {};
    const { tryUseConsumable } = createPhaseConsumableRuntime({
      addLog,
      atNow,
      consCfg,
      emitConsumableRunEvent,
      emitEffectRunEvents,
      phaseIdxNow,
      survivorMap,
    });


    // 3. 메인 루프
    while (getPhaseRuntimeOffsetSec() < phaseDurationSec) {
      if (todaysSurvivors.length <= 0 && refillActionWave() <= 0) break;

      let actor = todaysSurvivors.pop();
      actor = actor?._id ? survivorMap.get(String(actor._id)) : null;
      if (!actor) continue;
      actor = normalizeRuntimeSurvivor(actor);
      decayActorSatiety(actor, consCfg?.satietyDecayPerAction ?? 1);
      await reserveVisibleSecond(tickSec);

      if (!actor?._id || newDeadIds.includes(actor._id) || actor.hp <= 0) continue;
      if (hasActionBlockStatus(actor)) {
        const blockName = hasActiveEffect(actor, EFFECT_STUN)
          ? EFFECT_STUN
          : hasActiveEffect(actor, EFFECT_AIRBORNE)
            ? EFFECT_AIRBORNE
            : '행동 불가';
        addLog(`💫 [${actor.name}] ${blockName} 상태로 행동하지 못했습니다.`, 'system');
        upsertRuntimeSurvivor(survivorMap, actor);
        continue;
      }

      // 아이템 사용(전투 중 불가 / 전투 후 가능): 전투 외 타이밍에서만 호출
      tryUseConsumable(actor, 'turn_start');

      // ✅ 수집 이벤트 페널티: 다음 페이즈 1회 교전 확률 보너스
      let gatherPvpBonus = 0;
      const gatherUntil = Number(actor?._gatherPvpBonusUntilPhaseIdx ?? -1);
      if (gatherUntil === phaseIdxNow) {
        gatherPvpBonus = Math.max(0, Number(actor?._gatherPvpBonus || 0));
      } else if (gatherUntil > -1 && gatherUntil < phaseIdxNow) {
        actor._gatherPvpBonus = 0;
        actor._gatherPvpBonusUntilPhaseIdx = null;
      }

      const actorRecoveryLocked = isAiRecoveryLocked(actor, currentActionSec());
      const potentialTargets = todaysSurvivors.filter((t) => {
        if (!t || newDeadIds.includes(t._id)) return false;
        if (String(t?._id || '') === String(actor?._id || '')) return false;
        if (areSameTeam(actor, t)) return false;
        if (String(t?.zoneId || '') !== String(actor?.zoneId || '')) return false;
        if (actorRecoveryLocked || isAiRecoveryLocked(t, currentActionSec())) return false;
        return true;
      });
      const canDual = potentialTargets.length >= (pvpMinSameZone - 1);

      // ✅ 즉시 위험(수집/사냥 직후): 같은 페이즈에서 '표적 우선' (다음 페이즈로 넘어가면 자동 해제)
      const dangerUntil = Number(actor?._immediateDangerUntilPhaseIdx ?? -1);
      if (dangerUntil > -1 && dangerUntil < phaseIdxNow) {
        actor._immediateDanger = 0;
        actor._immediateDangerUntilPhaseIdx = null;
      }

      const pvpTarget = canDual ? pickPvpTargetRuntime(potentialTargets, survivorMap, phaseIdxNow) : null;
      const rand = Math.random();

      const midgameCombatWindow = !suddenDeath && Number(nextDay || 0) >= 2 && Number(nextDay || 0) <= 4;
      const lowHpAvoidCombat = !suddenDeath && Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= Number(ruleset?.ai?.recoverHpBelow ?? 38);
      const densityFactor = Math.min(1, Math.max(0, potentialTargets.length / 3));
      const pressureMult = 0.75 + 0.25 * restrictedRatio;
      const densityMult = 0.55 + 0.45 * densityFactor;
      const nightMult = (nextPhase === 'night') ? 1.05 : 1.0;
      const actorAggro = getPerkAggressionBias(actor);
      const midgameEncounterBonus = midgameCombatWindow ? Math.max(0, Number(pvpProbCfg.midgameEncounterBonus ?? 0.10)) : 0;
      const lowHpEncounterMult = lowHpAvoidCombat
        ? Math.max(0.12, Math.min(1, Number(midgameCombatWindow ? (pvpProbCfg.midgameLowHpEncounterMult ?? 0.70) : (pvpProbCfg.lowHpEncounterMult ?? 0.38))))
        : 1;
      const battleProb2Base = suddenDeath ? Math.max(0.95, battleProb) : (battleProb * densityMult * pressureMult * nightMult * lowHpEncounterMult);
      const actorMs = getEquipMoveSpeed(actor);
      const actorEr = buildErBehaviorModifier(actor, battleSettings);
      const earlyRouteFarming = isEarlyRouteFarmingActor(actor);
      const immediateDangerNow = Number(actor?._immediateDanger || 0) > 0 && Number(actor?._immediateDangerUntilPhaseIdx ?? -1) === phaseIdxNow;
      const actorObjectivePressure = Number(actor?._objectiveContestUntilPhaseIdx ?? -1) === phaseIdxNow
        ? Math.max(0, Number(actor?._objectiveContestPressure || 0))
        : 0;
      if (Number(actor?._objectiveContestUntilPhaseIdx ?? -1) > -1 && Number(actor?._objectiveContestUntilPhaseIdx ?? -1) < phaseIdxNow) {
        actor._objectiveContestType = '';
        actor._objectiveContestSubkind = '';
        actor._objectiveContestPressure = 0;
        actor._objectiveContestUntilPhaseIdx = null;
      }
      const targetObjectivePressure = pvpTarget && Number(pvpTarget?._objectiveContestUntilPhaseIdx ?? -1) === phaseIdxNow
        ? Math.max(0, Number(pvpTarget?._objectiveContestPressure || 0))
        : 0;
      const objectiveEncounterBonus = suddenDeath ? 0 : Math.max(actorObjectivePressure, targetObjectivePressure);
      const earlyFarmEncounterMult = earlyRouteFarming ? Math.max(0.05, Math.min(1, Number(pvpProbCfg.earlyRouteFarmEncounterMult ?? 0.38))) : 1;
      const evadeBonus = suddenDeath ? 0 : Math.min(0.18, actorMs * 0.9); // 이동속도 높을수록 교전 회피(추격 회피)
      const aggressionEncounterBonus = suddenDeath ? 0 : Math.max(-0.06, Math.min(0.16, actorAggro * 0.18));
      const erEncounterBonus = suddenDeath ? 0 : Math.max(-0.08, Math.min(0.16, Number(actorEr?.aggressionBias || 0) + Number(actorEr?.chaseBonus || 0) * 0.35 - Number(actorEr?.escapeBonus || 0) * 0.45));
      const battleProb2 = isDay1MorningFarmPhase
        ? 0
        : Math.min(0.99, Math.max(0, battleProb2Base * earlyFarmEncounterMult + gatherPvpBonus * (earlyRouteFarming ? 0.55 : 1) + objectiveEncounterBonus + midgameEncounterBonus + aggressionEncounterBonus + erEncounterBonus - evadeBonus));
      if (lowHpAvoidCombat && canDual) {
        addLog(`🛡️ [${actor.name}] 저HP로 교전 회피`, 'system');
      }

      // 전투력 열세면 교전 회피 + 인접 안전 구역으로 이동(가능할 때)
      if (canDual && earlyRouteFarming && rand < battleProb2 && pvpTarget) {
        const baseAvoid = Number(pvpProbCfg.earlyRouteFarmAvoidChance ?? 0.72);
        const avoidChance = Math.max(0.12, Math.min(0.92,
          baseAvoid
          + Number(actorEr?.escapeBonus || 0) * 0.55
          - Math.max(0, actorAggro) * 0.12
          - (immediateDangerNow ? 0.28 : 0)
        ));
        if (Math.random() < avoidChance) {
          const from = String(actor?.zoneId || '');
          const pop = {};
          for (const s of survivorMap.values()) {
            if (!s || Number(s.hp || 0) <= 0) continue;
            if (newDeadIds.includes(s._id)) continue;
            const zid = String(s.zoneId || '');
            if (!zid) continue;
            pop[zid] = (pop[zid] || 0) + 1;
          }
          const depthMax = Math.max(1, Math.floor(Number(ruleset?.ai?.safeSearchDepth ?? 3)));
          const minDelta = Math.max(0, Math.floor(Number(ruleset?.ai?.recoverMinSaferDelta ?? 1)));
          const pick = bfsPickSafestZone(from, zoneGraph, forbiddenIds, pop, { maxDepth: depthMax, minDelta });
          const dest = String(pick?.nextStep || '');
          if (dest && dest !== from) {
            actor.zoneId = dest;
            applyAiRecoveryWindow(actor, currentActionSec(), { reason: 'early_route_avoid', opponentId: String(pvpTarget?._id || ''), recoverSec: 4, safeZoneSec: 3 });
            upsertRuntimeSurvivor(survivorMap, actor);
            addLog(`🏃 [${actor.name}] 초반 루트 파밍 중 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
            emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason: 'early_route_avoid' }, atNow());
          } else {
            applyAiRecoveryWindow(actor, currentActionSec(), { reason: 'early_route_avoid_hold', opponentId: String(pvpTarget?._id || ''), recoverSec: 3 });
            addLog(`🏃 [${actor.name}] 초반 루트 파밍 중 교전 회피`, 'system');
          }
          continue;
        }
      }

      if (canDual && rand < battleProb2) {
        const targetEval = pvpTarget;
        const avoidInfo = targetEval ? shouldAvoidCombatByPower(actor, targetEval) : null;
        if (avoidInfo) {
          const oppName = String(targetEval?.name || '상대');
          const delta = Number(avoidInfo.opP || 0) - Number(avoidInfo.myP || 0);
          const avoidChanceBase = Number(ruleset?.ai?.fightAvoidChance ?? 0.75);
          const avoidChance = Math.min(0.95, avoidChanceBase + Math.min(0.25, actorMs * 1.5)); // 신발 이속이 높을수록 회피 확률 증가
          const extremeRatio = Number(ruleset?.ai?.fightAvoidExtremeRatio ?? 0.30);
          const extremeDelta = Number(ruleset?.ai?.fightAvoidExtremeDelta ?? 25);
          const willAvoid = suddenDeath ? false : ((avoidInfo.ratio < extremeRatio || delta >= extremeDelta) ? true : (Math.random() < avoidChance));

          if (!willAvoid) {
            addLog(`🔥 [${actor.name}] 불리하지만 [${oppName}]과 교전합니다!`, 'highlight');
          } else {
          const from = String(actor?.zoneId || '');
          const pop = {};
          for (const s of survivorMap.values()) {
            if (!s || Number(s.hp || 0) <= 0) continue;
            if (newDeadIds.includes(s._id)) continue;
            const zid = String(s.zoneId || '');
            if (!zid) continue;
            pop[zid] = (pop[zid] || 0) + 1;
          }

          const depthMax = Math.max(1, Math.floor(Number(ruleset?.ai?.safeSearchDepth ?? 3)));
          const minDelta = Math.max(0, Math.floor(Number(ruleset?.ai?.recoverMinSaferDelta ?? 1)));
          const pick = bfsPickSafestZone(from, zoneGraph, forbiddenIds, pop, { maxDepth: depthMax, minDelta });

          let dest = String(pick?.nextStep || '');

          if (dest && dest !== from) {
            actor.zoneId = dest;
            applyAiRecoveryWindow(actor, currentActionSec(), { reason: 'avoid_power', opponentId: String(targetEval?._id || ''), recoverSec: 6, safeZoneSec: 4 });
            upsertRuntimeSurvivor(survivorMap, actor);
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
            emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason: 'avoid_power' }, atNow());
          } else {
            applyAiRecoveryWindow(actor, currentActionSec(), { reason: 'avoid_power_hold', opponentId: String(targetEval?._id || ''), recoverSec: 4 });
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피`, 'system');
          }
          continue;
          }
        }
      }

      if (canDual && rand < battleProb2) {
        // [⚔️ 전투]
        let target = pvpTarget;
        if (!target) {
          upsertRuntimeSurvivor(survivorMap, actor);
          continue;
        }

        // 상대방 행동권 사용
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);



        const absNow = currentActionSec();
        const tacticalRuntime = createPhaseCombatTacticalRuntime({
          state: {
            absNow,
            battleSettings,
            ruleset,
          },
          actions: {
            addLog,
            atNow,
            emitEffectRunEvents,
            emitRunEvent,
          },
        });
        const {
          applyCombatTacAttack,
          applyTacUse,
          canUseTac,
          normalizeTac,
          shieldBlock,
          tacModuleLevel,
        } = tacticalRuntime;
        const combatFleeRuntime = createPhaseCombatFleeRuntime({
          state: {
            battleSettings,
            currentActionSec,
            estimatePower,
            forbiddenIds,
            newDeadIds,
            restrictedRatio,
            ruleset,
            survivorMap,
            totalZonesCount,
            zoneGraph,
          },
          actions: {
            addLog,
            atNow,
            emitEffectRunEvents,
            emitRunEvent,
            getZoneName,
          },
          tactical: {
            applyTacUse,
            canUseTac,
            normalizeTac,
            tacModuleLevel,
          },
        });
        const {
          pickSparseSafeNeighbor,
          resolveFleeSequence,
        } = combatFleeRuntime;
        const pvpCfg = ruleset?.pvp || {};
        const combatEliminationRuntime = createPhaseCombatEliminationRuntime({
          state: {
            assistWindowPhases,
            canReviveThisMatch,
            craftables,
            currentActionSec,
            itemMetaById,
            itemNameById,
            isSoloMatch,
            newDeadIds,
            nextDay,
            phaseIdxNow,
            phaseSurvivors,
            publicItems,
            pvpCfg,
            reviveCutoffIdx,
            roundAssists,
            roundKills,
            ruleset,
            sourceActor: actor,
            survivorMap,
            todaysSurvivors,
            useDetonation,
          },
          actions: {
            addEarnedCredits: (amount) => {
              earnedCredits += Math.max(0, Number(amount || 0));
            },
            addLog,
            appendPhaseDeadSnapshots,
            applyErTraitAfterBattle,
            atNow,
            emitDeathRunEventOnce,
            emitRunEvent,
            flushDeadSnapshots,
            getZoneName,
            grantPvpKillMastery,
            pickSparseSafeNeighbor,
            setDeathMetadata,
            tryUseConsumable,
          },
        });
        const { applyCombatElimination } = combatEliminationRuntime;
        const markUnattributedDeath = (victim, reasonText = '접전 중 전투불능') => {
          if (!victim) return;
          const victimId = String(victim?._id || '');
          setDeathMetadata(victim, victim._deathBy || 'combat_unattributed', { causeName: reasonText });
          addLog(`☠️ [${victim.name}] ${reasonText}`, 'death');
          if (!newDeadIds.includes(victimId)) {
            victim.deadAtPhaseIdx = phaseIdxNow;
            victim.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
            newDeadIds.push(victimId);
            flushDeadSnapshots(appendPhaseDeadSnapshots(victim));
          }
          emitDeathRunEventOnce(victim, { reason: victim._deathBy || 'combat_unattributed', cause: reasonText });
        };
        const skillSplashRuntime = createPhaseCombatSkillSplashRuntime({
          state: {
            newDeadIds,
            phaseIdxNow,
            survivorMap,
          },
          actions: {
            addLog,
            applyCombatElimination,
            atNow,
            emitRunEvent,
            grantPvpDamageMastery,
            shieldBlock,
          },
        });
        const {
          applyCharacterSkillSplashDamage,
          getCharacterSkillSplashTargets,
        } = skillSplashRuntime;
        // 🏃 추격·도주(1단계): 이속/HP/장비차 + 제한구역 압박 기반(관전형 템포)
        const escapeOutcome = (() => {
          const curZone = String(actor?.zoneId || target?.zoneId || '');
          if (!curZone) return null;

          const hpBelow = Number(ruleset?.ai?.escapeHpBelow ?? 42);
          const aAvoid = shouldAvoidCombatByPower(actor, target);
          const bAvoid = shouldAvoidCombatByPower(target, actor);
          const aWants = (Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= hpBelow) || !!aAvoid;
          const bWants = (Number(target.hp || 0) > 0 && Number(target.hp || 0) <= hpBelow) || !!bAvoid;
          if (!aWants && !bWants) return null;

          let flee = null;
          let chaser = null;
          if (aWants && !bWants) { flee = actor; chaser = target; }
          else if (!aWants && bWants) { flee = target; chaser = actor; }
          else {
            const ahp = Number(actor.hp || 0);
            const bhp = Number(target.hp || 0);
            if (ahp != bhp) flee = (ahp < bhp) ? actor : target;
            else {
              const ar = aAvoid ? Number(aAvoid.ratio || 0.5) : 0.5;
              const br = bAvoid ? Number(bAvoid.ratio || 0.5) : 0.5;
              flee = (ar < br) ? actor : target;
            }
            chaser = (flee === actor) ? target : actor;
          }
          return resolveFleeSequence(flee, chaser, { curZone });
        })();

        // 도주 성공 & 미포획이면 전투 없이 종료(둘 다 행동권 소모)
        if (escapeOutcome && escapeOutcome.escaped && !escapeOutcome.caught) {
          actor = survivorMap.get(actor._id) || actor;
          target = survivorMap.get(target._id) || target;
          continue;
        }

        // 도주 중 포획(기습)으로 HP 0이면 즉시 사망 처리
        if (escapeOutcome && escapeOutcome.escaped && escapeOutcome.caught) {
          const fleeNow = survivorMap.get(escapeOutcome.fleeId);
          const chaserNow = survivorMap.get(escapeOutcome.chaserId);
          if (fleeNow && Number(fleeNow.hp || 0) <= 0 && chaserNow) {
            applyCombatElimination(chaserNow, fleeNow, { killText: '추격 제압' });
            continue;
          }
        }

        // 추격전 이후 최신 상태(존/HP)로 전투 진행
        actor = survivorMap.get(actor._id) || actor;
        target = survivorMap.get(target._id) || target;

	        const actorBattleName = canonicalizeCharName(actor.name);
        const targetBattleName = canonicalizeCharName(target.name);
        const battleResult = pickUnbiasedBattle(
          { ...actor, name: actorBattleName },
          { ...target, name: targetBattleName }
        );
        let battleLog = battleResult.log || '';
        if (actorBattleName && actorBattleName !== actor.name) {
          battleLog = battleLog.split(actorBattleName).join(actor.name);
        }
        if (targetBattleName && targetBattleName !== target.name) {
          battleLog = battleLog.split(targetBattleName).join(target.name);
        }
        // 누적 HP 기반 교전: 즉사 대신 피해/반격을 누적(HP 0일 때만 사망)
        if (battleResult.winner) {
          const actorIdStr = String(actor._id);
          const winnerIdStr = String(battleResult.winner._id);
          const battleWinner = winnerIdStr === actorIdStr ? actor : target;
          const loser = winnerIdStr === actorIdStr ? target : actor;
          const winnerId = String(battleResult.winner._id);

          const prevDamagedBy = String(loser?.lastDamagedBy || '');
          const prevDamagedPhaseIdx = Number(loser?.lastDamagedPhaseIdx ?? -9999);

          const wp = estimatePower(battleWinner);
          const lp = estimatePower(loser);
          const ratio = wp / Math.max(1, wp + lp);
          const loserHpBeforeDamage = Math.max(0, Number(loser.hp || 0));
          const damageBase = Number(pvpCfg.damageBase ?? 18);
          const damageDayScale = Number(pvpCfg.damageDayScale ?? 3);
          const base = damageBase + nextDay * damageDayScale;
          const earlyLethalDayEnd = Math.max(0, Math.floor(Number(pvpCfg.earlyLethalDamageDayEnd ?? 3)));
          const earlyLethalWindow = !isDay1MorningFarmPhase && nextDay <= earlyLethalDayEnd;
          const earlyDamageFlat = earlyLethalWindow ? Math.max(0, Number(pvpCfg.earlyLethalDamageFlat ?? 8)) : 0;
          const earlyLowHpBonusBelow = Math.max(0, Number(pvpCfg.earlyLethalLowHpBonusBelow ?? 45));
          const earlyLowHpBonus = (earlyLethalWindow && loserHpBeforeDamage <= earlyLowHpBonusBelow)
            ? Math.max(0, Number(pvpCfg.earlyLethalLowHpBonus ?? 10))
            : 0;
          const winnerErDamage = buildErBehaviorModifier(battleWinner, battleSettings);
          const loserErDamage = buildErBehaviorModifier(loser, battleSettings);
          const erDamageScale = Math.max(0, Number(battleSettings?.battle?.erDamageScale ?? 1));
          const winnerDamageBonus = Math.round(Math.max(0, Number(winnerErDamage?.damageBonus || 0)) * erDamageScale);
          const counterDamageBonus = Math.round(Math.max(0, Number(loserErDamage?.damageBonus || 0)) * erDamageScale * 0.45);
          const dmgToLoser = Math.min(110, Math.max(16, Math.round(base + ratio * 34 + winnerDamageBonus + earlyDamageFlat + earlyLowHpBonus)));
          const dmgToWinner = Math.min(38, Math.max(0, Math.round(7 + (1 - ratio) * 14 + counterDamageBonus)));
          if (winnerDamageBonus >= 4 || counterDamageBonus >= 3) {
            const bits = [];
            if (winnerDamageBonus >= 4) bits.push(`${battleWinner.name} +${winnerDamageBonus}`);
            if (counterDamageBonus >= 3) bits.push(`${loser.name} 반격 +${counterDamageBonus}`);
            addLog(`⚔️ ER 피해 보정: ${bits.join(' / ')}`, 'system');
          }

          const atkDmgToLoser = applyCombatTacAttack(battleWinner, loser, dmgToLoser);
          const atkDmgToWinner = applyCombatTacAttack(loser, battleWinner, dmgToWinner);
          const charSkillToLoser = applyCharacterSkillOnBasicAttack(battleWinner, loser, atkDmgToLoser, {
            settings: battleSettings,
            nowSec: currentActionSec(),
            at: atNow(),
            addLog,
            emitRunEvent,
            splashTargets: getCharacterSkillSplashTargets(battleWinner, loser),
            showLog: battleSettings?.skills?.showSkillLogs !== false,
          });
          const charSkillToWinner = applyCharacterSkillOnBasicAttack(loser, battleWinner, atkDmgToWinner, {
            settings: battleSettings,
            nowSec: currentActionSec(),
            at: atNow(),
            addLog,
            emitRunEvent,
            splashTargets: getCharacterSkillSplashTargets(loser, battleWinner),
            showLog: battleSettings?.skills?.showSkillLogs !== false,
          });
          const finalDmgToLoser = shieldBlock(loser, charSkillToLoser.damage);
          const finalDmgToWinner = shieldBlock(battleWinner, charSkillToWinner.damage);

          loser.hp = Math.max(0, Number(loser.hp || 0) - finalDmgToLoser);
          battleWinner.hp = Math.max(0, Number(battleWinner.hp || 0) - finalDmgToWinner);
          const splashDmgByWinner = applyCharacterSkillSplashDamage(battleWinner, charSkillToLoser.splashHits);
          const splashDmgByLoser = applyCharacterSkillSplashDamage(loser, charSkillToWinner.splashHits);
          const applyCombatLifesteal = (who, dealt) => {
            if (!who || Number(who.hp || 0) <= 0) return 0;
            const pct = getLifestealPercent(who);
            if (pct <= 0 || dealt <= 0) return 0;
            const maxHp = Math.max(1, Number(who?.maxHp || 100));
            const rawHeal = Math.min(Math.max(0, maxHp - Number(who.hp || 0)), Math.max(1, Math.round(Number(dealt || 0) * pct)));
            const heal = applyHealingModifier(who, rawHeal);
            if (heal <= 0) return 0;
            who.hp = Math.min(maxHp, Number(who.hp || 0) + heal);
            addLog(`🩸 [${who.name}] 흡혈: HP +${heal}`, 'system');
            return heal;
          };
          applyCombatLifesteal(battleWinner, finalDmgToLoser);
          applyCombatLifesteal(loser, finalDmgToWinner);
          const weaponSkillResult = applyErWeaponSkillAfterCombat(battleWinner, loser, {
            damageDealt: finalDmgToLoser,
            lethalPreview: loser.hp <= 0,
            settings: battleSettings,
            nowSec: currentActionSec(),
            at: atNow(),
          });
          const weaponSkillDamageToLoser = Math.max(0, Number(weaponSkillResult?.damage || 0));
          let totalDmgToLoser = finalDmgToLoser + weaponSkillDamageToLoser;
          const totalDmgToWinner = finalDmgToWinner;
          if (splashDmgByWinner > 0 || splashDmgByLoser > 0) {
            const bits = [];
            if (splashDmgByWinner > 0) bits.push(`${battleWinner.name} 광역 +${splashDmgByWinner}`);
            if (splashDmgByLoser > 0) bits.push(`${loser.name} 광역 +${splashDmgByLoser}`);
            addLog(`🌀 캐릭터 스킬 광역: ${bits.join(' / ')}`, 'system');
          }


          let lethal = loser.hp <= 0;
          if (!lethal && earlyLethalWindow) {
            const hpAfterCombat = Math.max(0, Number(loser.hp || 0));
            const finishHpBelow = Math.max(0, Number(pvpCfg.earlyLethalFinishHpBelow ?? 12));
            if (hpAfterCombat > 0 && hpAfterCombat <= finishHpBelow) {
              const finishBase = Math.max(0, Number(pvpCfg.earlyLethalFinishChanceBase ?? 0.12));
              const finishScale = Math.max(0, Number(pvpCfg.earlyLethalFinishChanceDayScale ?? 0.05));
              const finishRatioBonus = Math.max(0, Number(pvpCfg.earlyLethalFinishRatioBonus ?? 0.12));
              const midgameFinishBonus = midgameCombatWindow ? Math.max(0, Number(pvpCfg.midgameLethalFinishBonus ?? 0.10)) : 0;
              const finishMax = Math.max(0, Math.min(1, Number(pvpCfg.earlyLethalFinishMax ?? 0.34)));
              const ratioBonus = Math.max(0, (ratio - 0.5) * 2) * finishRatioBonus;
              const finishChance = Math.min(finishMax, finishBase + Math.max(0, nextDay - 1) * finishScale + ratioBonus + midgameFinishBonus);
              if (Math.random() < finishChance) {
                const finisherDamage = Math.max(1, Math.ceil(hpAfterCombat));
                loser.hp = 0;
                totalDmgToLoser += finisherDamage;
                lethal = true;
                addLog(`☠️ [${battleWinner.name}] 결정타로 [${loser.name}]을(를) 마무리했습니다.`, 'death');
              }
            }
          }
          if (!lethal) {
            battleLog = softenNonLethalBattleLog(battleLog);
          }


          // 최근 피해 기여자 기록(어시스트 판정용)
          if (totalDmgToWinner > 0) {
            battleWinner.lastDamagedBy = String(loser._id);
            battleWinner.lastDamagedPhaseIdx = phaseIdxNow;
          }
          if (!lethal && totalDmgToLoser > 0) {
            loser.lastDamagedBy = String(winnerId);
            loser.lastDamagedPhaseIdx = phaseIdxNow;
          }
          addLog(battleLog, lethal ? 'death' : 'normal');
          addLog(`🩸 피해: [${battleWinner.name}]↘[${loser.name}] -${totalDmgToLoser} (반격 -${totalDmgToWinner})`, 'highlight');
          grantPvpDamageMastery(battleWinner, { damageDealt: totalDmgToLoser, damageTaken: totalDmgToWinner }, lethal ? '결정 교전' : '교전 승리');
          grantPvpDamageMastery(loser, { damageDealt: totalDmgToWinner, damageTaken: totalDmgToLoser }, lethal ? '교전 경험' : '반격');

          let postCombatFlee = null;
          const criticalFleeHpBelow = Math.max(0, Number(pvpCfg.criticalFleeHpBelow ?? 18));
          const criticalFleeChance = Math.max(0, Math.min(1, Number(pvpCfg.criticalFleeChance ?? 0.78)));
          if (!lethal && Number(loser.hp || 0) > 0 && Number(loser.hp || 0) <= criticalFleeHpBelow && Math.random() < criticalFleeChance) {
            postCombatFlee = resolveFleeSequence(loser, battleWinner, { curZone: String(loser.zoneId || battleWinner.zoneId || ''), forceAttempt: true, escapeText: '빈사 도주', moveReason: 'critical_flee' });
          }
          if (!lethal && postCombatFlee?.fatal !== true) {
            applyErTraitAfterBattle(battleWinner, { lethal: false, damageDealt: totalDmgToLoser, defeated: loser });
          }

          // 🧾 전투 이벤트(미니맵 핑/집계용)
          emitRunEvent(
            'battle',
            {
              a: String(actor?._id || ''),
              b: String(target?._id || ''),
              winner: (lethal || (postCombatFlee?.fatal === true)) ? String(battleWinner?._id || '') : '',
              lethal: !!lethal || (postCombatFlee?.fatal === true),
              zoneId: String(actor?.zoneId || target?.zoneId || ''),
            },
            atNow()
          );

          if (postCombatFlee?.fatal === true) {
            applyCombatElimination(battleWinner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '빈사 추격 제압', deathReason: 'critical_flee', deathCauseName: '빈사 추격', damageDealt: totalDmgToLoser });
          } else if (lethal) {
            applyCombatElimination(battleWinner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '처치', deathReason: 'combat', deathCauseName: '교전', damageDealt: totalDmgToLoser });
          }
        } else {
          const scratch = Math.min(12, 5 + Math.floor(nextDay / 2));
          actor.hp = Math.max(0, Number(actor.hp || 0) - scratch);
          target.hp = Math.max(0, Number(target.hp || 0) - scratch);
          if (scratch > 0) {
            actor.lastDamagedBy = String(target._id);
            actor.lastDamagedPhaseIdx = phaseIdxNow;
            target.lastDamagedBy = String(actor._id);
            target.lastDamagedPhaseIdx = phaseIdxNow;
          }
          grantPvpDamageMastery(actor, { damageDealt: scratch, damageTaken: scratch }, '접전');
          grantPvpDamageMastery(target, { damageDealt: scratch, damageTaken: scratch }, '접전');
          addLog(battleLog, 'normal');
          addLog(`⚔️ 접전 피해: [${actor.name}] / [${target.name}] 둘 다 -${scratch}`, 'normal');

          emitRunEvent(
            'battle',
            {
              a: String(actor?._id || ''),
              b: String(target?._id || ''),
              winner: '',
              lethal: false,
              zoneId: String(actor?.zoneId || target?.zoneId || ''),
            },
            atNow()
          );
          if (actor.hp <= 0) markUnattributedDeath(actor, '접전 끝에 쓰러짐');
          if (target.hp <= 0) markUnattributedDeath(target, '접전 끝에 쓰러짐');
        }

      }

      upsertRuntimeSurvivor(survivorMap, actor);
    }

    // 4. 킬 카운트 업데이트
    runForcedSuddenDeathClash({
      addLog,
      appendPhaseDeadSnapshots,
      assistCounts,
      emitDeathRunEventOnce,
      estimatePower,
      flushDeadSnapshots,
      killCounts,
      newDeadIds,
      phaseIdxNow,
      roundAssists,
      roundKills,
      ruleset,
      setDeathMetadata,
      suddenDeathActive: suddenDeathActiveRef.current,
      survivorMap,
    });

    reconcileZeroHpDeaths({
      canReviveThisMatch,
      newDeadIds,
      reviveCutoffIdx,
      survivorMap,
    });

    const updatedKillCounts = { ...killCounts };
    Object.keys(roundKills).forEach((killerId) => {
      updatedKillCounts[killerId] = (updatedKillCounts[killerId] || 0) + roundKills[killerId];
    });
    setKillCounts(updatedKillCounts);

    const updatedAssistCounts = isSoloMatch ? {} : { ...assistCounts };
    if (!isSoloMatch) {
      Object.keys(roundAssists).forEach((aid) => {
        updatedAssistCounts[aid] = (updatedAssistCounts[aid] || 0) + (roundAssists[aid] || 0);
      });
    }
    setAssistCounts(updatedAssistCounts);

    // 5. 생존자 업데이트
    const finalStepSurvivors = Array.from(survivorMap.values())
      .filter((s) => !newDeadIds.includes(s?._id))
      .map((s) => normalizeRuntimeSurvivor(s));

    // 💳 크레딧은 화면에 직접 띄우지 않고, 캐릭터별(simCredits)로만 누적 표시합니다.
    // - baseCredits(페이즈 기본)는 생존자에게 분배(합계=baseCredits)
    if (baseCredits > 0 && finalStepSurvivors.length > 0) {
      finalStepSurvivors.forEach((s) => {
        s.simCredits = Number(s.simCredits || 0) + baseCredits;
      });
    }

    // ✅ 시뮬에서 생성된 랜덤 장비를 DB에 저장(관리자 아이템 목록에서 확인 가능)
    // - 저장 실패(토큰 만료/서버 다운)해도 시뮬 진행은 계속
    // NOTE: off-map 생존자(관전/퇴장) 분기는 아직 미사용이므로 finalStepSurvivors만 저장한다.
    persistSimEquipmentsFromChars(
      (Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []),
      `phase:d${nextDay}_${nextPhase}`
    ).catch(() => {});


    // SD 서든데스: 카운트다운 종료 시 강제 결판(최후 1인)
    const sdEndAt = suddenDeathEndAtSecRef.current;
    const sdRemainAfter = (suddenDeathActiveRef.current && typeof sdEndAt === 'number')
      ? Math.ceil(sdEndAt - (matchSec + phaseDurationSec))
      : null;
    const finalAliveTeams = getAliveTeams(finalStepSurvivors);
    const shouldFinishByElimination = finalAliveTeams.length <= 1;
    if (!shouldFinishByElimination) {
      await runVisibleClockToPhaseEnd();
    }

    if (suddenDeathActiveRef.current && typeof sdEndAt === 'number' && sdRemainAfter <= 0 && finalAliveTeams.length > 1) {
      const scoredTeams = finalAliveTeams
        .map((team) => ({
          ...team,
          hpSum: team.members.reduce((sum, m) => sum + Math.max(0, Number(m?.hp || 0)), 0),
          kills: team.members.reduce((sum, m) => sum + Number(updatedKillCounts?.[m?._id] || 0), 0),
        }))
        .sort((a, b) => (b.hpSum - a.hpSum) || (b.kills - a.kills) || (b.members.length - a.members.length));
      const topScore = Number(scoredTeams[0]?.hpSum || 0);
      const topList = scoredTeams.filter((team) => Number(team?.hpSum || 0) === topScore);
      const wTeam = topList[Math.floor(Math.random() * topList.length)] || scoredTeams[0];
      const wForced = pickTeamRepresentative(wTeam?.members || [], updatedKillCounts, updatedAssistCounts);
      const forcedDead = finalStepSurvivors
        .filter((s) => !areSameTeam(s, wForced))
        .map((s) => {
          const deadActor = { ...s, hp: 0 };
          setDeathMetadata(deadActor, 'sudden_death_timeout', { causeName: '서든데스 시간 만료' });
          deadActor.deadAtPhaseIdx = phaseIdxNow;
          deadActor.reviveEligible = false;
          emitDeathRunEventOnce(deadActor, { reason: 'sudden_death_timeout', cause: '서든데스 시간 만료' });
          return deadActor;
        });
      const forcedDeadSnapshots = appendPhaseDeadSnapshots(forcedDead);
      flushDeadSnapshots(forcedDeadSnapshots);
      const winners = (Array.isArray(wTeam?.members) ? wTeam.members : [wForced]).filter(Boolean).map((s) => normalizeRuntimeSurvivor(s));
      const finalDeadForFinish = dedupeRuntimeParticipants([...(Array.isArray(dead) ? dead : []), ...phaseDeadSnapshots]);
      setSurvivors(winners);
      setMatchSec(phaseStartSec + phaseDurationSec);
      addLog(`⏱ 서든데스 종료! 제한시간 만료로 ${wTeam?.teamName || getActorTeamName(wForced)} 승리`, 'highlight');
      finishGame(winners, updatedKillCounts, updatedAssistCounts, { finalDead: finalDeadForFinish });
      return;
    }

    // NOTE: offMapSurvivors는 아직 정의/사용하지 않으므로, 렌더는 최종 생존자만 반영
    setSurvivors((Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []).map((s) => normalizeRuntimeSurvivor(s)));

    // 월드 스폰 상태 반영(상자 개봉/보스 처치 등)
    setSpawnState(nextSpawn);

    // 5.5) 경기 시간 진행(초)
    setMatchSec(shouldFinishByElimination ? (phaseStartSec + getPhaseRuntimeOffsetSec()) : (phaseStartSec + phaseDurationSec));

    // 5.6) 크레딧 적립(페이즈 보상 + 처치 보상 등)
    if (earnedCredits > 0) {
      apiPost('/credits/earn', { amount: earnedCredits })
        .then((res) => {
          applyUserEconomyProgress({ credits: res?.credits });
        })
        .catch(() => {});
    }

    if (finalAliveTeams.length <= 1) {
      const finalDeadForFinish = dedupeRuntimeParticipants([...(Array.isArray(dead) ? dead : []), ...phaseDeadSnapshots]);
      finishGame(finalAliveTeams[0]?.members || finalStepSurvivors, updatedKillCounts, updatedAssistCounts, { finalDead: finalDeadForFinish });
    }
  };

  // 🔄 서버 맵 설정 새로고침(관리자에서 수정한 crateAllowDeny 등 즉시 반영용)
  async function refreshMapSettingsFromServer(reason = 'manual') {
    return getMapActions().refreshMapSettingsFromServer(reason);
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

  // ======== Market actions ========
  function getMarketActions() {
    return createMarketActionRuntime({
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
  }

  function devGrantItemToSelected() {
    return getMarketActions().devGrantItemToSelected();
  }

  function doCraft(itemId) {
    return getMarketActions().doCraft(itemId);
  }

  function doKioskTransaction(kioskId, catalogIndex) {
    return getMarketActions().doKioskTransaction(kioskId, catalogIndex);
  }

  function doDroneBuy(offerId) {
    return getMarketActions().doDroneBuy(offerId);
  }

  function doPerkPurchase(code) {
    return getMarketActions().doPerkPurchase(code);
  }

  function createTradeOffer() {
    return getMarketActions().createTradeOffer();
  }

  function cancelTradeOffer(offerId) {
    return getMarketActions().cancelTradeOffer(offerId);
  }

  function acceptTradeOffer(offerId) {
    return getMarketActions().acceptTradeOffer(offerId);
  }

  // 탭 전환 시 필요한 데이터 갱신
  // activeMap 로딩이 순간적으로 비는 경우(=맵 미지정/리프레시 타이밍)에도
  // 금지구역 로직이 동작하도록 zones 기반 fallback을 둡니다.
  const activeMapEff = activeMap || ((Array.isArray(zones) && zones.length)
    ? { _id: String(activeMapId || 'local'), zones }
    : null);
  const forbiddenNow = activeMapEff
    ? new Set(getForbiddenZoneIdsForPhaseRuntime(activeMapEff, day, phase, zones, settings, null))
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
