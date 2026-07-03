'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { apiPost } from '../../utils/api';
import { buildErBehaviorModifier } from '../../utils/erMeta';
import {
  EFFECT_AIRBORNE,
  EFFECT_STUN,
  applyHealingModifier,
  getCooldownTickMultiplier,
  getLifestealPercent,
  getRegenValue,
  getShieldValue,
  hasActionBlockStatus,
} from '../../utils/statusLogic';
import {
  getNonCombatRegenMultiplier,
} from '../../utils/masteryLogic';
import { getRuleset } from '../../utils/rulesets';
import SiteHeader from '../../components/SiteHeader';
import { buildTacStatusEffects, getTacBaseCdSec, getTacEffectNumber, getTacTrigger, normalizeSupportedTacSkill } from './tacticalSkillTable';
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
  itemDisplayName,
  itemIcon,
  shuffleArray,
  perkNumber,
  getActorPerkEffects,
  getPerkLootBias,
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
  crateTypeLabel,
  pickAutoTranscendOption,
  rollFieldLoot,
  findItemByKeywords,
  pickUnitsFromInventory,
  removePickedUnitsFromInventory,
  pruneEquippedAgainstInventory,
  clearRuntimeCombatFields,
  applyAiRecoveryWindow,
  isAiRecoveryLocked,
  normalizeRevivedSurvivor,
  applyRuntimeEffectPayloads,
  consumeShieldDamage,
  clearPostCombatEffects,
  hasKioskAtZone,
  findDimensionRiftGiftItem,
  getDimensionRiftGiftMeta,
  listActiveDimensionRifts,
  pickDimensionRiftChoice,
  pickRiftEntrantTeams,
  resolveDimensionRiftWinner,
  openSpawnedTranscendCrate,
  openSpawnedFoodCrate,
  pickupSpawnedCore,
  classifySpecialByName,
  pickGoalLoadoutKeys,
  buildCraftGoal,
  uniqStrings,
  bfsPickSafestZone,
  computeLateGameUpgradeNeed,
  chooseAiMoveTargets,
  inferEquipSlot,
  hasActiveEffect,
  canReceiveItem,
  normalizeInventory,
  formatInvAddNote,
  addItemToInventory,
  invQty,
  consumeIngredientsFromInv,
  tryAutoCraftFromLoot,
  tryAutoCraftFromInventory,
  autoEquipBest,
  lateGameGearDirector,
  tryImmediateCraftFromSpecial,
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
  getRegionData,
  getRegionFacilityZoneIds,
} from './_lib/lumiaRegionData';
import {
  isExplicitDay1HeroRoutePlan,
  shouldForceDay1HeroGearCatchup,
} from './_lib/routePlanProgressRuntime';
import {
  advanceActorRouteProgressForGoal,
  runDay1HeroGearDirectorWithLogs,
} from './_lib/phaseRouteProgressRuntime';
import { runRouteFarmAction } from './_lib/phaseRouteFarmRuntime';
import { runHuntAction } from './_lib/phaseHuntActionRuntime';
import { openLegendaryCrateForActor } from './_lib/phaseLegendaryCrateRuntime';
import {
  normalizeSatiety,
  decayActorSatiety,
} from './_lib/satietyRuntime';
import {
  getRuntimeActorKey,
  dedupeRuntimeParticipants,
} from './_lib/runtimeParticipantRuntime';
import { formatMoveIntentLabel } from './_lib/moveIntentRuntime';
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
import {
  estimateMovePower as estimateMovePowerRuntime,
  shouldAvoidCombatByMovePower as shouldAvoidCombatByMovePowerRuntime,
} from './_lib/movePowerRuntime';
import { createPhaseDeathRuntime } from './_lib/phaseDeathRuntime';
import {
  getForbiddenZoneIdsForPhase as getForbiddenZoneIdsForPhaseRuntime,
  getForbiddenAddedZoneIdsForPhase as getForbiddenAddedZoneIdsForPhaseRuntime,
} from './_lib/forbiddenZoneRuntime';
import {
  canonicalizeCharName,
} from './_lib/combatRuntime';
import {
  estimatePvpPower,
  pickUnbiasedBattle as pickUnbiasedBattleRuntime,
  shouldAvoidCombatByPvpPower,
} from './_lib/pvpMatchupRuntime';
import {
  buildPvpPhaseRuntime,
  pickPvpTarget as pickPvpTargetRuntime,
} from './_lib/pvpPhaseRuntime';
import { runForcedSuddenDeathClash } from './_lib/suddenDeathRuntime';
import {
  collectRuntimeEffectResultTexts,
  logRuntimeEffectResults,
} from './_lib/runtimeStatus';
import {
  gainText,
  shouldLogItemReceive,
  getLootCraftOptions,
} from './_lib/runEventRuntime';
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
import {
  applyActorKnockbackMovement,
  clearActorMoveTargetMemory,
  initializeActorPhaseMovementState,
  resolveActorNextMoveZone,
  resolveActorMoveTargetMemory,
} from './_lib/phaseActorMovementRuntime';
import { prepareActorPhaseActionQueue } from './_lib/phaseActionQueueRuntime';

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

        // --- 이동 ---
        updated = initializeActorPhaseMovementState(updated, {
          itemKeyById,
          ruleset,
        });

        const knockbackMovement = applyActorKnockbackMovement({
          state: {
            actor: updated,
            forbiddenIds,
            zoneGraph,
            zones,
          },
          actions: {
            addLog,
            atNow,
            emitRunEvent,
            getZoneName,
          },
        });
        updated = knockbackMovement.actor;
        let currentZone = knockbackMovement.currentZone;
        let neighbors = knockbackMovement.neighbors;
        let nextZoneId = currentZone;

const mustEscape = forbiddenIds.has(currentZone);

// 목표 기반 이동: 조합 목표/월드 스폰/키오스크를 고려
const preGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
  goalTier: updated?.goalGearTier,
  goalItemKeys: pickGoalLoadoutKeys(updated),
  perkEffects: getActorPerkEffects(updated),
});
const upgradeNeed = computeLateGameUpgradeNeed(updated, itemMetaById, itemNameById, nextDay, nextPhase, ruleset);
const aiMove = chooseAiMoveTargets({
  actor: updated,
  craftGoal: preGoal,
  upgradeNeed,
  mapObj,
  spawnState: nextSpawn,
  forbiddenIds,
  day: nextDay,
  phase: nextPhase,
  kiosks,
  itemMetaById,
  itemNameById,
});

const aiCfg = ruleset?.ai || {};
const recoverHpBelow = Math.max(0, Number(aiCfg?.recoverHpBelow ?? 38));
const recoverMinDelta = Math.max(0, Math.floor(Number(aiCfg?.recoverMinSaferDelta ?? 1)));
const sameZoneOpponents = (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).filter((t) => (
  t && String(t?._id || '') !== String(updated?._id || '') && !areSameTeam(updated, t) && Number(t?.hp || 0) > 0 && String(t?.zoneId || '') === String(currentZone)
));
const worstSameZoneOpponent = sameZoneOpponents
  .slice()
  .sort((a, b) => Number(estimateMovePowerRuntime(b, movePowerContext) || 0) - Number(estimateMovePowerRuntime(a, movePowerContext) || 0))[0] || null;
const avoidInfoNow = worstSameZoneOpponent ? shouldAvoidCombatByMovePowerRuntime(updated, worstSameZoneOpponent, movePowerContext) : null;
const extremeRatio = Number(aiCfg?.fightAvoidExtremeRatio ?? 0.30);
const extremeDelta = Number(aiCfg?.fightAvoidExtremeDelta ?? 25);
const lowHpFleeInterrupt = !mustEscape && sameZoneOpponents.length > 0 && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;
const powerFleeInterrupt = !mustEscape && !!avoidInfoNow && ((Number(avoidInfoNow?.ratio || 1) < extremeRatio) || ((Number(avoidInfoNow?.opP || 0) - Number(avoidInfoNow?.myP || 0)) >= extremeDelta));
const fleeInterruptReason = mustEscape ? 'forbidden' : (lowHpFleeInterrupt ? 'low_hp' : (powerFleeInterrupt ? 'power_gap' : ''));
const recovering = !mustEscape && !fleeInterruptReason && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;

// 🤖 목표 존 유지(TTL): 목표를 몇 페이즈 유지해서 '사람처럼' 보이게 함
const targetMemory = resolveActorMoveTargetMemory({
  state: {
    actor: updated,
    aiMove,
    currentZone,
    day: nextDay,
    forbiddenIds,
    mustEscape,
    phase: nextPhase,
    ruleset,
  },
});
updated = targetMemory.actor;
const holdTarget = targetMemory.holdTarget;
let moveTargets = targetMemory.moveTargets;
let moveReason = targetMemory.moveReason;
let moveObjectiveType = targetMemory.moveObjectiveType;
let moveObjectiveSubkind = targetMemory.moveObjectiveSubkind;
let moveContestPressure = targetMemory.moveContestPressure;

const riftTargetsNow = (!isSoloMatch && String(nextPhase || '') === 'night' && [2, 3, 4].includes(Number(nextDay || 0)))
  ? listActiveDimensionRifts(nextSpawn)
    .map((r) => String(r?.zoneId || ''))
    .filter((zid) => zid && !forbiddenIds.has(String(zid)))
  : [];
if (!mustEscape && !recovering && riftTargetsNow.length > 0) {
  const riftContestChance = Math.max(0, Math.min(1, Number(ruleset?.worldSpawns?.dimensionRift?.contestChance ?? 0.38)));
  const wantsRift = Math.random() < riftContestChance || (String(moveObjectiveType || '') === '' && Math.random() < 0.25);
  if (wantsRift) {
    moveTargets = [riftTargetsNow[Math.floor(Math.random() * riftTargetsNow.length)]];
    moveReason = 'dimension_rift';
    moveObjectiveType = 'dimension_rift';
    moveObjectiveSubkind = 'aglaia';
    moveContestPressure = Math.max(moveContestPressure, 0.45);
  }
}

// ✅ 목표/이동 후보에서 금지구역은 최대한 제외 (막혀서 멈추는 현상 방지)
moveTargets = uniqStrings(moveTargets.map((z) => String(z || ''))).filter((z) => z && !forbiddenIds.has(String(z)));

if (fleeInterruptReason) {
  updated = clearActorMoveTargetMemory(updated);
  moveObjectiveType = '';
  moveObjectiveSubkind = '';
  moveContestPressure = 0;
  const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
  const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: Math.max(1, recoverMinDelta) });
  const best = String(pick?.target || currentZone);
  if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
    moveTargets = [String(best)];
  }
  moveReason = `flee:${String(fleeInterruptReason)}`;
} else if (recovering) {
  // 회복 우선: 목표/보스 추적보다 안전/저인구 존으로 분산(인접 1칸에만 갇히지 않게 BFS 사용)
  updated = clearActorMoveTargetMemory(updated);
  moveObjectiveType = '';
  moveObjectiveSubkind = '';
  moveContestPressure = 0;

  const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
  const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: recoverMinDelta });

  const best = String(pick?.target || currentZone);
  if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
    moveTargets = [String(best)];
    moveReason = 'recover';
  }
}

// 금지구역이면 "탈출 시도" 확률만 올리고, 100% 강제 이탈은 하지 않습니다.
// (요구사항: 금지구역에 일정 시간 머무르면 사망 => 실제로 '머무를' 수 있어야 함)
const nextMove = resolveActorNextMoveZone({
  state: {
    actor: updated,
    currentZone,
    day: nextDay,
    fleeInterruptReason,
    forbiddenIds,
    moveTargets,
    mustEscape,
    neighbors,
    phase: nextPhase,
    recovering,
    ruleset,
    zoneGraph,
  },
});
nextZoneId = nextMove.nextZoneId;
const usedHyperloopMove = isHyperloopTransit(currentZone, nextZoneId);
const moveEtaSec = usedHyperloopMove ? HYPERLOOP_DELAY_SEC : 1;
if (usedHyperloopMove) reserveActionSecond(moveEtaSec);

if (String(nextZoneId) !== String(currentZone)) {
  if (usedHyperloopMove) {
    addLog(`🌀 [${updated.name}] 하이퍼루프 이동(3초): ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'highlight');
  } else if (mustEscape) {
    addLog(`⚠️ [${updated.name}] 금지구역 이탈: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (String(moveReason || '').startsWith('flee:')) {
    const fleeLabel = moveReason === 'flee:low_hp' ? '저HP' : (moveReason === 'flee:power_gap' ? '전투력 열세' : '긴급');
    addLog(`🏃 [${updated.name}] ${fleeLabel} 인터럽트 도주: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (forbiddenIds.has(String(nextZoneId))) {
    addLog(`⚠️ [${updated.name}] 금지구역 진입: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (moveTargets.length) {
    if (moveReason === 'recover') {
      addLog(`🛟 [${updated.name}] 회복 우선 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
    } else {
      const intentLabel = formatMoveIntentLabel(moveReason, moveObjectiveType, moveObjectiveSubkind);
      addLog(`🎯 [${updated.name}] ${intentLabel}: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
    }
  } else {
    addLog(`🚶 [${updated.name}] 로테이션: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
  }

  // 🧾 AI 이동 목표/결정(재현/디버그용)
  emitRunEvent('move', {
    who: String(updated?._id || ''),
    name: updated?.name,
    from: String(currentZone),
    to: String(nextZoneId),
    reason: mustEscape ? 'escape' : (String(moveReason || '').startsWith('flee:') ? String(moveReason) : (moveTargets.length ? String(moveReason || 'goal') : 'wander')),
    transport: usedHyperloopMove ? 'hyperloop' : 'walk',
    etaSec: moveEtaSec,
    objectiveType: moveObjectiveType,
    objectiveSubkind: moveObjectiveSubkind,
    contestPressure: moveContestPressure,
  }, atNow());
  grantMastery(updated, 'movement', usedHyperloopMove ? 220 : 180, usedHyperloopMove ? '하이퍼루프 이동' : '지역 이동');
} else if (mustEscape) {
  addLog(`⛔ [${updated.name}] 금지구역(${getZoneName(currentZone)})에 머무릅니다...`, 'death');
}

updated.zoneId = nextZoneId;
const objectiveTargetSet = new Set((Array.isArray(moveTargets) ? moveTargets : []).map((z) => String(z || '')).filter(Boolean));
if (moveObjectiveType && objectiveTargetSet.has(String(updated.zoneId || '')) && moveContestPressure > 0) {
  updated._objectiveContestType = moveObjectiveType;
  updated._objectiveContestSubkind = moveObjectiveSubkind;
  updated._objectiveContestPressure = moveContestPressure;
  updated._objectiveContestUntilPhaseIdx = phaseIdxNow;
} else if (Number(updated?._objectiveContestUntilPhaseIdx ?? -1) < phaseIdxNow) {
  updated._objectiveContestType = '';
  updated._objectiveContestSubkind = '';
  updated._objectiveContestPressure = 0;
  updated._objectiveContestUntilPhaseIdx = null;
}
advanceActorRouteProgressForGoal({
  actor: updated,
  craftGoal: preGoal,
  ruleset,
  searched: false,
  zoneId: updated.zoneId,
});

const didMove = String(nextZoneId) !== String(currentZone);

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

        // 🔥 모닥불(요리) & 💧 물 채집 (서버 맵 설정 기반)
        try {
          const campfireZones = uniqStr([
            ...(Array.isArray(mapObj?.campfireZoneIds) ? mapObj.campfireZoneIds : []).map(String),
            ...getRegionFacilityZoneIds('campfire', mapObj?.zones),
          ]);
          const waterZones = uniqStr([
            ...(Array.isArray(mapObj?.waterSourceZoneIds) ? mapObj.waterSourceZoneIds : []).map(String),
            ...(Array.isArray(mapObj?.zones) ? mapObj.zones : [])
              .filter((z) => Number(getRegionData(z?.zoneId)?.resources?.['물'] || 0) > 0)
              .map((z) => String(z?.zoneId || '')),
          ]);

          // 물 채집: 해당 존이면 물을 확보(관전 템포용)
          if (waterZones.includes(String(updated.zoneId))) {
            const water = findItemByKeywords(publicItems, ['물', 'water']);
            if (water?._id) {
              const have = invQty(updated.inventory, String(water._id));
              const chance = have <= 0 ? 0.85 : have < 2 ? 0.55 : 0.25;
              if (Math.random() < chance && canReceiveItem(updated.inventory, water, String(water._id), 1, ruleset)) {
                updated.inventory = addItemToInventory(updated.inventory, water, String(water._id), 1, nextDay, ruleset);
                const metaW = updated.inventory?._lastAdd;
                const gotW = Math.max(0, Number(metaW?.acceptedQty ?? 1));
                addLog(`💧 [${updated.name}] ${getZoneName(updated.zoneId)}에서 물 ${gainText(gotW)}${formatInvAddNote(metaW, 1, updated.inventory, ruleset)}`, 'normal');
                emitItemGainIfAny(gotW, { who: String(updated?._id || ''), itemId: String(water._id), source: 'gather', kind: 'water', zoneId: String(updated?.zoneId || '') }, atNow());
              }
            }
          }

          // 모닥불 요리: 고기 1개를 스테이크 1개로 변환(페이즈당 1회)
          if (campfireZones.includes(String(updated.zoneId))) {
            const meat = findItemByKeywords(publicItems, ['고기']);
            const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
            if (meat?._id && steak?._id) {
              const haveMeat = invQty(updated.inventory, String(meat._id));
              if (haveMeat >= 1 && canReceiveItem(updated.inventory, steak, String(steak._id), 1, ruleset)) {
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(meat._id), qty: 1 }]);
                updated.inventory = addItemToInventory(updated.inventory, steak, String(steak._id), 1, nextDay, ruleset);
                const metaS = updated.inventory?._lastAdd;
                const gotS = Math.max(0, Number(metaS?.acceptedQty ?? 1));
                addLog(`🔥 [${updated.name}] ${getZoneName(updated.zoneId)} 모닥불에서 고기를 구워 스테이크 ${gainText(gotS, '제작', '제작 실패')}${formatInvAddNote(metaS, 1, updated.inventory, ruleset)}`, 'highlight');
                emitItemGainIfAny(gotS, { who: String(updated?._id || ''), itemId: String(steak._id), source: 'craft', kind: 'campfire', zoneId: String(updated?.zoneId || '') }, atNow());
              }
            }
          }
        } catch {
          // ignore
        }

        // --- 필드 파밍(이벤트 외): 이동/탐색 중 아이템 획득 ---
        const loot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, {
          moved: didMove,
          day: nextDay,
          phase: nextPhase,
          dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey,
          perkEffects: getActorPerkEffects(updated),
          goalItemIds: (Array.isArray(preGoal?.missing) ? preGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean),
          routeItemIds: Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated.zoneId || '')])
            ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')]
            : [],
        });
        if (loot) {
          const isTransPick = String(loot?.crateType || '').toLowerCase() === 'transcend_pick' && Array.isArray(loot?.options);
          if (isTransPick) {
            const devPickable = !!showMarketPanel && !pendingPickAssigned && !pendingTranscendPick && String(selectedCharId || '') === String(updated?._id || '');
            if (devPickable) {
              pendingPickAssigned = true;
              setPendingTranscendPick({
                id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                characterId: String(updated?._id || ''),
                characterName: updated?.name,
                zoneId: String(updated?.zoneId || ''),
                options: loot.options,
                at: atNow(),
              });
              addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자를 발견했습니다. (개발자 도구: 선택 대기)`, 'highlight');
            } else {
              const auto = pickAutoTranscendOption(loot.options, publicItems) || (loot.options[0] || null);
              const chosenId = String(auto?.itemId || '');
              const chosenItem = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === chosenId) || null;
              updated.inventory = addItemToInventory(updated.inventory, chosenItem, chosenId, 1, nextDay, ruleset);
              const meta = updated.inventory?._lastAdd;
              const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
              const nm = itemDisplayName(chosenItem || { _id: chosenId, name: auto?.name });
              addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자 오픈 → ${itemIcon(chosenItem)} [${nm}] ${gainText(got)}${formatInvAddNote(meta, 1, updated.inventory, ruleset)}`, 'highlight');
              emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: chosenId, source: 'box', sourceKind: 'transcend_pick', zoneId: String(updated?.zoneId || ''), choice: 'auto' }, atNow());
              if (got > 0) grantMastery(updated, 'search', 350, '항공 보급');
              if (got > 0) autoEquipBest(updated, itemMetaById);
            }
          } else {
            updated.inventory = addItemToInventory(updated.inventory, loot.item, loot.itemId, loot.qty, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const got = Math.max(0, Number(meta?.acceptedQty ?? loot.qty));
            const nm = loot.item?.name || '아이템';
            if (shouldLogItemReceive(got, meta)) {
              addLog(`📦 [${updated.name}] ${getZoneName(updated.zoneId)}에서 ${crateTypeLabel(loot.crateType)} ${itemIcon(loot.item || { type: '' })} [${nm}] ${gainText(got)}${formatInvAddNote(meta, loot.qty, updated.inventory, ruleset)}`, 'normal');
            }
            emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(loot.itemId || ''), source: 'box', sourceKind: String(loot?.crateType || ''), zoneId: String(updated?.zoneId || '') }, atNow());
            if (got > 0) grantMastery(updated, 'search', 70, '상자 탐색');
            if (got > 0) autoEquipBest(updated, itemMetaById);
          }
        }

        // --- 필드 조합(이벤트 외): 방금 주운 재료로 1회 조합 시도 ---
        if (loot && String(loot?.crateType || '').toLowerCase() !== 'transcend_pick' && loot.itemId) {
          const crafted = tryAutoCraftFromLoot(updated.inventory, loot.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
          applyLootCraftResult(updated, crafted, itemMetaById, atNow(), updated?.zoneId);
        }

        if (loot && String(loot?.crateId || '') === 'route_plan') {
          const postLootGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
            goalTier: updated?.goalGearTier,
            goalItemKeys: pickGoalLoadoutKeys(updated),
            perkEffects: getActorPerkEffects(updated),
          });
          advanceActorRouteProgressForGoal({
            actor: updated,
            craftGoal: postLootGoal,
            includeRoutePlanMissing: false,
            ruleset,
            searched: true,
            zoneId: updated.zoneId,
          });
        }


        // --- 음식 상자(맵 이벤트 스폰): 매일 낮 시작에 드랍 → 해당 구역 진입 시 개봉 ---
        const foodCrate = openSpawnedFoodCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, {
          moved: didMove,
          goalItemIds: (Array.isArray(preGoal?.missing) ? preGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean),
        });
        if (foodCrate) {
          updated.inventory = addItemToInventory(updated.inventory, foodCrate.item, foodCrate.itemId, foodCrate.qty, nextDay, ruleset);
          const metaF = updated.inventory?._lastAdd;
          const gotF = Math.max(0, Number(metaF?.acceptedQty ?? foodCrate.qty));
          const nmF = foodCrate.item?.name || '소모품';
          if (shouldLogItemReceive(gotF, metaF)) {
            addLog(`🍱 [${updated.name}] ${getZoneName(updated.zoneId)}에서 음식 상자를 열어 ${itemIcon(foodCrate.item)} [${nmF}] ${gainText(gotF)}${formatInvAddNote(metaF, foodCrate.qty, updated.inventory, ruleset)}`, 'normal');
          }
          emitItemGainIfAny(gotF, { who: String(updated?._id || ''), itemId: String(foodCrate.itemId || ''), source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, atNow());
          if (gotF > 0) {
            grantMastery(updated, 'search', 70, '음식 상자');
            const craftedF = tryAutoCraftFromLoot(updated.inventory, foodCrate.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
            applyLootCraftResult(updated, craftedF, itemMetaById, atNow(), updated?.zoneId);
          }

          const crF = Math.max(0, Number(foodCrate?.credits || 0));
          if (crF > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + crF);
            addLog(`💳 [${updated.name}] 음식 상자 보상 크레딧 +${crF}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: crF, source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, atNow());
          }
        }

        // --- 초월 장비 선택 상자(월드 스폰): 4일차 밤 위클라인과 함께 2개만 스폰 ---
        const transcendCrate = openSpawnedTranscendCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (transcendCrate && Array.isArray(transcendCrate.options)) {
          const devPickable = !!showMarketPanel && !pendingPickAssigned && !pendingTranscendPick && String(selectedCharId || '') === String(updated?._id || '');
          if (devPickable) {
            pendingPickAssigned = true;
            setPendingTranscendPick({
              id: String(transcendCrate?.crateId || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
              characterId: String(updated?._id || ''),
              characterName: updated?.name,
              zoneId: String(updated?.zoneId || ''),
              options: transcendCrate.options,
              at: atNow(),
            });
            addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자를 발견했습니다. (개발자 도구: 선택 대기)`, 'highlight');
          } else {
            const auto = pickAutoTranscendOption(transcendCrate.options, publicItems) || (transcendCrate.options[0] || null);
            const chosenId = String(auto?.itemId || '');
            const chosenItem = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === chosenId) || null;
            updated.inventory = addItemToInventory(updated.inventory, chosenItem, chosenId, 1, nextDay, ruleset);
            const metaT = updated.inventory?._lastAdd;
            const gotT = Math.max(0, Number(metaT?.acceptedQty ?? 1));
            const nmT = itemDisplayName(chosenItem || { _id: chosenId, name: auto?.name });
            addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자 오픈 → ${itemIcon(chosenItem)} [${nmT}] ${gainText(gotT)}${formatInvAddNote(metaT, 1, updated.inventory, ruleset)}`, 'highlight');
            emitItemGainIfAny(gotT, { who: String(updated?._id || ''), itemId: chosenId, source: 'box', sourceKind: 'transcend_pick', zoneId: String(updated?.zoneId || ''), choice: 'auto', crateId: String(transcendCrate?.crateId || '') }, atNow());
            if (gotT > 0) grantMastery(updated, 'search', 350, '항공 보급');
            if (gotT > 0) autoEquipBest(updated, itemMetaById);
          }
        }

        const isKioskZone = hasKioskAtZone(kiosks, mapObj, updated.zoneId);

        // --- 자연 코어(맵 이벤트 스폰): 2일차 '낮' 이후 운석/생명의 나무 ---
        const corePickup = pickupSpawnedCore(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (corePickup) {
          updated.inventory = addItemToInventory(updated.inventory, corePickup.item, corePickup.itemId, corePickup.qty || 1, nextDay, ruleset);
          const meta = updated.inventory?._lastAdd;
          const got = Math.max(0, Number(meta?.acceptedQty ?? (corePickup.qty || 1)));
          const nm = corePickup.item?.name || '특수 재료';
          if (shouldLogItemReceive(got, meta, { important: true })) {
            addLog(`🌠 [${updated.name}] ${getZoneName(updated.zoneId)} 오브젝트 채집: [${nm}] ${gainText(got)}${formatInvAddNote(meta, corePickup.qty || 1, updated.inventory, ruleset)}`, 'highlight');
          }
          emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(corePickup.itemId || ''), source: 'natural', kind: String(corePickup.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());
          if (got > 0) grantMastery(updated, 'search', 100, '자원 채취');

          const immediateCore = tryImmediateCraftFromSpecial(updated, String(corePickup.kind || ''), String(corePickup.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
          if (immediateCore?.changed) {
            updated.inventory = immediateCore.inventory;
            (Array.isArray(immediateCore.logs) ? immediateCore.logs : []).forEach((m) => addLog(String(m), 'highlight'));
          }
          if (Number(immediateCore?.pvpBonus || 0) > 0) {
            const pb = Number(immediateCore.pvpBonus || 0);
            updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
            updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
            updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
            updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }
          emitObjectiveRunEvent(updated, 'natural_core', {
            subkind: String(corePickup.kind || ''),
            itemId: String(corePickup.itemId || ''),
            itemName: String(nm || ''),
            qty: got,
            success: got > 0,
            danger: Math.max(0, Number(immediateCore?.pvpBonus || 0)),
          }, atNow());

          const craftedN = immediateCore?.changed ? null : tryAutoCraftFromLoot(updated.inventory, corePickup.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
          applyLootCraftResult(updated, craftedN, itemMetaById, atNow(), updated?.zoneId);
        }

        // --- 조합 목표(간단 AI): 현재 인벤 기준으로 '가까운' 상위 티어 1개를 목표로 삼음 ---
        const craftGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
          goalTier: updated?.goalGearTier,
          goalItemKeys: pickGoalLoadoutKeys(updated),
          perkEffects: getActorPerkEffects(updated),
        });

        // ✅ 1초 tick 행동 큐(1차): 이동/사냥/구매/제작 중 1개만 실행
        const routeProgressNow = advanceActorRouteProgressForGoal({
          actor: updated,
          craftGoal,
          ruleset,
          searched: false,
          zoneId: updated.zoneId,
        });
        const routePlanMissingIdsNow = routeProgressNow.routePlanMissingItemIds;
        const earlyRouteMissingIdsNow = routeProgressNow.missingItemIds;
        const mappedRouteItemIdsNow = routeProgressNow.mappedRouteItemIds;
        const goalMissingIds = new Set(earlyRouteMissingIdsNow);
        const routeDroneNeedIds = new Set((Array.isArray(updated?.routePlanDroneItemIds) ? updated.routePlanDroneItemIds : [])
          .map((id) => String(id || '').trim())
          .filter((id) => id && routePlanMissingIdsNow.includes(id)));
        const goalTargetId = String(craftGoal?.target?._id || craftGoal?.target?.itemId || '');
        const routePlanIdsNow = Array.isArray(updated?.routePlanZoneIds)
          ? updated.routePlanZoneIds.map((z) => String(z || '').trim()).filter(Boolean)
          : [];
        const earlyRouteActionActive = (
          (Number(nextDay || 0) === 1 || (Number(nextDay || 0) === 2 && String(nextPhase || '') === 'morning')) &&
          routePlanIdsNow.length > 0 &&
          Math.max(0, Number(updated?.routePlanIndex || 0)) < routePlanIdsNow.length
        );
        const currentRouteItemIds = mappedRouteItemIdsNow;
        const fallbackRouteItemIds = currentRouteItemIds.length
          ? currentRouteItemIds
          : [...goalMissingIds].filter(Boolean);
        const currentRouteNeedsSearch = earlyRouteActionActive &&
          fallbackRouteItemIds.length > 0 &&
          fallbackRouteItemIds.some((id) => goalMissingIds.has(id));
        const actionQueue = prepareActorPhaseActionQueue({
          state: {
            actor: updated,
            craftables,
            craftGoal,
            currentActionSec,
            currentRouteItemIds,
            currentRouteNeedsSearch,
            didMove,
            droneOffers,
            earlyRouteActionActive,
            fallbackRouteItemIds,
            fleeInterruptReason,
            goalMissingIds,
            goalTargetId,
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
            routePlanMissingIdsNow,
            ruleset,
            currentZone,
            upgradeNeed,
            usedHyperloopMove,
          },
          actions: {
            atNow,
            emitQueueRunEvent,
            getZoneName,
          },
        });
        updated = actionQueue.actor;
        const queuedKioskAction = actionQueue.queuedKioskAction;
        const queuedDroneOrder = actionQueue.queuedDroneOrder;
        const queuedActionType = actionQueue.queuedActionType;

        if (queuedActionType === 'routeFarm' && fallbackRouteItemIds.length > 0) {
          runRouteFarmAction({
            state: {
              actor: updated,
              craftables,
              fallbackRouteItemIds,
              goalMissingIds: [...goalMissingIds],
              initialLoot: loot,
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

        let didProcure = false;

        // --- 키오스크/드론(구매/교환): 원자 액션(kioskBuy/kioskExchange/kioskSell/droneOrder)일 때만 실행 ---
        if (['kioskBuy','kioskExchange','kioskSell','droneOrder'].includes(queuedActionType)) {
          const kioskAction = queuedKioskAction;
          if (['kioskBuy','kioskExchange','kioskSell'].includes(queuedActionType) && kioskAction?.itemId && kioskAction?.item) {
          const itemNm = kioskAction.item?.name || kioskAction.label || '아이템';

          if (kioskAction.kind === 'buy') {
            const cost = Math.max(0, Number(kioskAction.cost || 0));
            updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const want = Math.max(1, Number(kioskAction.qty || 1));
            const got = Math.max(0, Number(meta?.acceptedQty ?? want));
            const paidCost = got > 0 ? cost : 0;
            if (paidCost > 0) updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - paidCost);

            // ✅ 전술 강화 모듈: (level 모드) 즉시 소비 → 전술 스킬 레벨 +1
            // - 모듈을 인벤에 쌓아두지 않고, 즉시 레벨로 전환(관전 템포)
            const tacMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
            const tags = Array.isArray(kioskAction?.item?.tags) ? kioskAction.item.tags : [];
            const isTacModule = String(itemNm || '').includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (tacMode === 'level' && isTacModule && got > 0) {
              const beforeLv = Math.max(1, Math.min(2, Math.floor(Number(updated?.tacticalSkillLevel || 1))));
              const inc = Math.max(0, Math.min(2 - beforeLv, Math.floor(got)));
              if (inc > 0) {
                updated.tacticalSkillLevel = beforeLv + inc;
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: inc }]);
                addLog(`🎛️ [${updated.name}] 전술 강화 모듈 사용 → 전술 스킬 레벨 +${inc} (Lv.${updated.tacticalSkillLevel})`, 'highlight');
              }
            }
            if (shouldLogItemReceive(got, meta)) {
              addLog(`🏪 [${updated.name}] 키오스크 ${kioskAction.label ? `(${kioskAction.label}) ` : ''}구매: [${itemNm}] ${gainText(got, '구매', '구매 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}${paidCost > 0 ? ` (크레딧 -${paidCost})` : ''}`, 'system');
            }
            emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'buy', zoneId: String(updated?.zoneId || '') }, atNow());
            if (got > 0) autoEquipBest(updated, itemMetaById);
            didProcure = true;

            // 구매 아이템도 즉시 조합 트리거(선택적)
            const specialKKind = classifySpecialByName(String(kioskAction?.item?.name || itemNm || ''));
            const immediateK = tryImmediateCraftFromSpecial(updated, specialKKind, String(kioskAction.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateK?.changed) {
              updated.inventory = immediateK.inventory;
              (Array.isArray(immediateK.logs) ? immediateK.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateK?.pvpBonus || 0) > 0) {
              const pb = Number(immediateK.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }

            const craftedK = immediateK?.changed ? null : tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
            applyLootCraftResult(updated, craftedK, itemMetaById, atNow(), updated?.zoneId);
          }

          if (kioskAction.kind === 'exchange' && Array.isArray(kioskAction.consume) && kioskAction.consume.length) {
            const consumedNames = kioskAction.consume
              .map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty || 1}`)
              .join(' + ');
            updated.inventory = consumeIngredientsFromInv(updated.inventory, kioskAction.consume);
            updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const want = Math.max(1, Number(kioskAction.qty || 1));
            const got = Math.max(0, Number(meta?.acceptedQty ?? want));

            // ✅ 전술 강화 모듈: (level 모드) 즉시 소비 → 전술 스킬 레벨 +1
            const tacMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
            const tags = Array.isArray(kioskAction?.item?.tags) ? kioskAction.item.tags : [];
            const isTacModule = String(itemNm || '').includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (tacMode === 'level' && isTacModule && got > 0) {
              const beforeLv = Math.max(1, Math.min(2, Math.floor(Number(updated?.tacticalSkillLevel || 1))));
              const inc = Math.max(0, Math.min(2 - beforeLv, Math.floor(got)));
              if (inc > 0) {
                updated.tacticalSkillLevel = beforeLv + inc;
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: inc }]);
                addLog(`🎛️ [${updated.name}] 전술 강화 모듈 사용 → 전술 스킬 레벨 +${inc} (Lv.${updated.tacticalSkillLevel})`, 'highlight');
              }
            }
            if (shouldLogItemReceive(got, meta, { important: true })) {
              addLog(`🏪 [${updated.name}] 키오스크 교환: ${consumedNames} → [${itemNm}] ${gainText(got, '교환', '교환 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}`, 'system');
            }
            emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'exchange', zoneId: String(updated?.zoneId || '') }, atNow());
            if (got > 0) autoEquipBest(updated, itemMetaById);
            didProcure = true;

            const craftedE = tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
            applyLootCraftResult(updated, craftedE, itemMetaById, atNow(), updated?.zoneId);
          }

          if (kioskAction.kind === 'sell') {
            const q = Math.max(1, Number(kioskAction.qty || 1));
            const gain = Math.max(0, Number(kioskAction.credits || 0));
            updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: q }]);
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + gain);
            addLog(`🏪 [${updated.name}] 키오스크 환급: [${itemNm}] x${q} → 크레딧 +${gain}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: gain, source: 'kiosk', kind: 'sell', zoneId: String(updated?.zoneId || '') }, atNow());
            didProcure = true;
          }

          }
          if (!didProcure && queuedActionType === 'droneOrder') {
            // --- 드론 호출(하급 아이템 보급): 즉시 지급 ---
            const droneOrder = queuedDroneOrder;
            if (droneOrder?.itemId && Number(droneOrder?.cost || 0) <= Number(updated.simCredits || 0)) {
            const cost = Math.max(0, Number(droneOrder.cost || 0));

            const qty = Math.max(1, Number(droneOrder.qty || 1));
            const item = droneOrder?.item || null;
            const itemId = String(droneOrder.itemId || item?._id || '');
            if (itemId) {
              updated.inventory = addItemToInventory(updated.inventory, item, itemId, qty, nextDay, ruleset);
              const meta = updated.inventory?._lastAdd;
              const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
              const paidCost = got > 0 ? cost : 0;
              if (paidCost > 0) updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - paidCost);
              if (shouldLogItemReceive(got, meta)) {
                addLog(`🚁 [${updated.name}] 드론 호출: ${item?.name || itemNameById?.[itemId] || '아이템'} ${gainText(got, '수령', '호출 실패')}${formatInvAddNote(meta, qty, updated.inventory, ruleset)}${paidCost > 0 ? ` (-${paidCost}Cr, 즉시)` : ''}`, 'normal');
              }
              emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(itemId || ''), source: 'drone', zoneId: String(updated?.zoneId || '') }, atNow());
              if (got > 0) autoEquipBest(updated, itemMetaById);
              didProcure = true;

              // 즉시 지급된 아이템으로 조합이 가능해지면 자동 조합(낮은 확률)
              const craftedD = tryAutoCraftFromLoot(updated.inventory, itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
              applyLootCraftResult(updated, craftedD, itemMetaById, atNow(), updated?.zoneId, 'highlight');
            }
          }
        }

        }

        // ✅ 인벤 기반 제작(레시피): 행동 큐가 'craft'일 때만 실행
        // - 이동/사냥/구매와 같은 tick에 겹치지 않게 1차 분리
        if (queuedActionType === 'craft') {
          const invCraft = tryAutoCraftFromInventory(updated, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
          if (invCraft?.changed) {
            addLog(String(invCraft.log), 'highlight');
            emitCraftRunEvent(updated?._id, invCraft, atNow(), updated?.zoneId);
            const postCraftGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
              goalTier: updated?.goalGearTier,
              goalItemKeys: pickGoalLoadoutKeys(updated),
              perkEffects: getActorPerkEffects(updated),
            });
            advanceActorRouteProgressForGoal({
              actor: updated,
              craftGoal: postCraftGoal,
              ruleset,
              searched: false,
              zoneId: updated.zoneId,
            });
          }
          else if (String(selectedCharId || '') === String(updated?._id || '')) {
            const dbg = updated?._craftDebug || null;
            const dbgKey = `${phaseIdxNow}:${String(dbg?.code || '')}:${String(dbg?.targetName || '')}:${Array.isArray(dbg?.missing) ? dbg.missing.join('|') : ''}`;
            if (dbg?.code && updated?._craftDebugLogKey !== dbgKey) {
              updated._craftDebugLogKey = dbgKey;
              addLog(`[${updated.name}] 🧪 제작판정(${dbg.code}): ${dbg.text}`, 'system');
            }
          }

          // 1일차 fallback 제작: 정상 레시피 데이터가 없을 때만 추상 장비 생성 안전망을 사용합니다.
          const allowAbstractGearFallback = !Array.isArray(craftables) || craftables.length <= 0;
          const forceEarlyHeroRouteCompletion = shouldForceDay1HeroGearCatchup(updated, nextDay, nextPhase);
          runDay1HeroGear(updated, {
            allowAbstractFallback: allowAbstractGearFallback || forceEarlyHeroRouteCompletion,
            forceRouteCompletion: forceEarlyHeroRouteCompletion,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });

          // 후반 fallback 제작: 실제 전설/초월 레시피가 없을 때만 추상 장비 안전망을 사용합니다.
          const lateRes = lateGameGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, { allowAbstractFallback: allowAbstractGearFallback });
          if (lateRes?.changed && Array.isArray(lateRes.logs)) {
            lateRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }
        }


        // --- 시즌 11 컨셉: 가젯 에너지 ---
        const forceEarlyHeroRouteCompletionAnyAction = shouldForceDay1HeroGearCatchup(updated, nextDay, nextPhase);
        if (forceEarlyHeroRouteCompletionAnyAction) {
          runDay1HeroGear(updated, {
            allowAbstractFallback: true,
            forceRouteCompletion: true,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
        }

        if (ruleset.id === 'ER_S11') {
          const energyCfg = ruleset?.gadgetEnergy || {};
          const maxEnergy = Number(energyCfg.max ?? 100);
          const gain = Number(energyCfg.gainPerPhase ?? 10);
          const curEnergy = Number(updated.gadgetEnergy ?? 0);
          updated.gadgetEnergy = Math.min(maxEnergy, curEnergy + gain);
          if (!updated.cooldowns) updated.cooldowns = { portableSafeZone: 0, cnotGate: 0 };
          if (updated.safeZoneUntil === undefined || updated.safeZoneUntil === null) updated.safeZoneUntil = 0;
        }

        // --- 폭발 타이머(금지구역) ---
        // - 룰셋이 detonation을 제공하면, 어떤 규칙이든 폭발 타이머를 사용합니다.
        if (useDetonation) {
          // 기존 저장 데이터와 호환: 필드가 없으면 기본값 주입
          const detCfg = ruleset?.detonation || {};
          if (updated.detonationSec === undefined || updated.detonationSec === null) updated.detonationSec = Number(detCfg.startSec ?? 20);
          if (updated.detonationMaxSec === undefined || updated.detonationMaxSec === null) updated.detonationMaxSec = Number(detCfg.maxSec ?? 30);
        }

        // --- 금지구역 피해(LEGACY) ---
        // - detonation이 없을 때만 HP 감소 규칙을 사용
        if (!useDetonation) {
          if (forbiddenIds.size > 0 && forbiddenIds.has(String(updated.zoneId))) {
            updated.hp = Math.max(0, Number(updated.hp || 0) - damagePerTick);
            if (updated.hp > 0) {
              addLog(`☠️ [${updated.name}] 금지구역(${getZoneName(updated.zoneId)}) 피해: HP -${damagePerTick}`, 'death');
            }
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            setDeathMetadata(updated, 'forbidden_zone', { causeName: '금지구역 피해' });
            addLog(`💀 [${s.name}]이(가) 금지구역을 벗어나지 못하고 사망했습니다.`, 'death');
            updated.deadAtPhaseIdx = phaseIdxNow;
            updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
            emitDeathRunEventOnce(updated, { reason: 'forbidden_zone', cause: '금지구역 피해' });
            newlyDead.push(updated);
          }
        }
        return updated;
      })
      .filter((s) => Number(s.hp || 0) > 0);

    if (!isSoloMatch && String(nextPhase || '') === 'night' && [2, 3, 4].includes(Number(nextDay || 0))) {
      const activeRifts = listActiveDimensionRifts(nextSpawn);
      if (activeRifts.length > 0) {
        const survivorById = buildRuntimeSurvivorMap(updatedSurvivors);
        const safeReturnZones = (Array.isArray(zones) ? zones : [])
          .map((z) => String(z?.zoneId || ''))
          .filter((zid) => zid && !forbiddenIds.has(String(zid)));
        const usedRiftTeamIds = new Set();
        const giftMeta = getDimensionRiftGiftMeta(nextDay);
        const rewardCredits = Math.max(0, Math.floor(Number(ruleset?.worldSpawns?.dimensionRift?.rewardCreditsByDay?.[String(nextDay)] ?? (
          Number(nextDay || 0) === 2 ? 45 : Number(nextDay || 0) === 3 ? 65 : 90
        ))));

        const pickRiftReturnZone = (actor) => {
          const preferred = [
            actor?.riftReturnZoneId,
            actor?.aiTargetZoneId,
            Array.isArray(actor?.routePlanZoneIds) ? actor.routePlanZoneIds[Math.max(0, Number(actor?.routePlanIndex || 0))] : '',
          ]
            .map((z) => String(z || ''))
            .find((z) => z && !forbiddenIds.has(String(z)));
          if (preferred) return preferred;
          if (safeReturnZones.length) return safeReturnZones[Math.floor(Math.random() * safeReturnZones.length)];
          return String(actor?.zoneId || zones?.[0]?.zoneId || '');
        };

        const getCurrentTeamMembers = (team) => (Array.isArray(team?.members) ? team.members : [])
          .map((m) => survivorById.get(String(m?._id || '')))
          .filter((m) => m && Number(m?.hp || 0) > 0);

        for (const rift of activeRifts) {
          if (Number(rift?.day || 0) !== Number(nextDay || 0) || String(rift?.phase || '') !== String(nextPhase || '')) continue;
          const entrantTeams = pickRiftEntrantTeams(rift, Array.from(survivorById.values()))
            .filter((team) => team?.teamId && !usedRiftTeamIds.has(String(team.teamId)));

          if (entrantTeams.length <= 0) {
            rift.resolved = true;
            rift.closedWithoutEntrants = true;
            continue;
          }

          rift.entrantTeamIds = entrantTeams.map((team) => String(team.teamId || '')).filter(Boolean);
          const riftZoneName = getZoneName(rift.zoneId);
          addLog(`🌀 차원의 틈 진입: ${riftZoneName} · ${entrantTeams.map((team) => team.teamName || team.teamId).join(' vs ')}`, 'highlight');

          const riftResult = resolveDimensionRiftWinner(entrantTeams, (actor) => estimateMovePowerRuntime(actor, movePowerContext));
          const winnerTeam = riftResult?.winner || null;
          const loserTeam = riftResult?.loser || null;
          if (!winnerTeam) continue;

          const winnerMembers = getCurrentTeamMembers(winnerTeam);
          const loserMembers = getCurrentTeamMembers(loserTeam);
          if (!winnerMembers.length) continue;

          rift.resolved = true;
          rift.winnerTeamId = String(winnerTeam.teamId || '');
          rift.loserTeamId = String(loserTeam?.teamId || '');
          usedRiftTeamIds.add(String(winnerTeam.teamId || ''));
          if (loserTeam?.teamId) usedRiftTeamIds.add(String(loserTeam.teamId));

          if (riftResult?.uncontested) {
            addLog(`🌀 [${winnerTeam.teamName || winnerTeam.teamId}] 차원의 틈 무혈 점거`, 'highlight');
          } else {
            addLog(`⚔️ 차원의 틈 교전: [${winnerTeam.teamName || winnerTeam.teamId}] 승리`, 'death');
          }

          for (const member of winnerMembers) {
            member.simCredits = Math.max(0, Number(member.simCredits || 0) + rewardCredits);
            survivorById.set(String(member._id || ''), member);
            emitRunEvent('gain', {
              who: String(member?._id || ''),
              itemId: 'CREDITS',
              qty: rewardCredits,
              source: 'dimension_rift',
              zoneId: String(rift?.zoneId || ''),
            }, atNow());
          }

          const representative = winnerMembers
            .slice()
            .sort((a, b) => Number(estimateMovePowerRuntime(b, movePowerContext) || 0) - Number(estimateMovePowerRuntime(a, movePowerContext) || 0))[0];

          let giftGot = 0;
          let choiceGot = 0;
          let choiceItemId = '';
          let choiceName = '';
          if (representative) {
            representative.inventory = normalizeInventory(representative.inventory, ruleset);
            const giftItem = findDimensionRiftGiftItem(publicItems, nextDay);
            if (giftItem?._id) {
              representative.inventory = addItemToInventory(representative.inventory, giftItem, String(giftItem._id), 1, nextDay, ruleset);
              const giftMetaAdd = representative.inventory?._lastAdd;
              giftGot = Math.max(0, Number(giftMetaAdd?.acceptedQty ?? 1));
            }

            const choice = pickDimensionRiftChoice(publicItems, nextDay);
            const choiceItem = choice?.item || null;
            if (choiceItem?._id) {
              choiceItemId = String(choiceItem._id);
              choiceName = itemDisplayName(choiceItem);
              representative.inventory = addItemToInventory(representative.inventory, choiceItem, choiceItemId, 1, nextDay, ruleset);
              const choiceMeta = representative.inventory?._lastAdd;
              choiceGot = Math.max(0, Number(choiceMeta?.acceptedQty ?? 1));
              emitItemGainIfAny(choiceGot, {
                who: String(representative?._id || ''),
                itemId: choiceItemId,
                source: 'dimension_rift',
                zoneId: String(rift?.zoneId || ''),
                giftRarity: String(giftMeta?.rarity || ''),
              }, atNow());

              const immediate = tryImmediateCraftFromSpecial(
                representative,
                classifySpecialByName(choiceName),
                choiceItemId,
                publicItems,
                itemNameById,
                itemMetaById,
                nextDay,
                nextPhase,
                phaseIdxNow,
                ruleset,
              );
              if (immediate?.changed) {
                representative.inventory = immediate.inventory;
                (Array.isArray(immediate.logs) ? immediate.logs : []).forEach((m) => addLog(String(m), 'highlight'));
              }
              if (choiceGot > 0) autoEquipBest(representative, itemMetaById);
            }

            survivorById.set(String(representative._id || ''), representative);
            addLog(`🎁 [${representative.name}] 아글라이아의 선물(${giftMeta?.label || rift.giftLabel || '보상'}) ${gainText(giftGot)}${choiceName ? ` → [${choiceName}] ${gainText(choiceGot, '선택', '선택 실패')}` : ''}`, 'highlight');
          }

          if (loserTeam && loserMembers.length) {
            const returnNames = [];
            for (const member of loserMembers) {
              const returnZoneId = pickRiftReturnZone(member);
              const maxHp = Math.max(1, Number(member?.maxHp ?? 100));
              member.hp = Math.max(1, Math.floor(maxHp * 0.65));
              member.zoneId = returnZoneId;
              clearRuntimeCombatFields(member);
              applyAiRecoveryWindow(member, currentActionSec(), {
                reason: 'dimension_rift_loss',
                recoverSec: 8,
                safeZoneSec: 3,
              });
              survivorById.set(String(member._id || ''), member);
              returnNames.push(`${member.name}:${getZoneName(returnZoneId)}`);
            }
            addLog(`↩️ [${loserTeam.teamName || loserTeam.teamId}] 차원의 틈 패배 팀 부활: ${returnNames.join(', ')}`, 'system');
          }

          emitRunEvent('dimension_rift', {
            zoneId: String(rift?.zoneId || ''),
            winnerTeamId: String(winnerTeam?.teamId || ''),
            loserTeamId: String(loserTeam?.teamId || ''),
            entrantTeamIds: rift.entrantTeamIds,
            credits: rewardCredits,
            giftRarity: String(giftMeta?.rarity || ''),
            choiceItemId,
          }, atNow());
        }

        updatedSurvivors = normalizeRuntimeSurvivorList(Array.from(survivorById.values()))
          .filter((s) => Number(s.hp || 0) > 0);
      }
    }

    if (suddenDeathActiveRef.current && ruleset?.suddenDeath?.forceGather !== false && suddenDeathSafeZoneIds.length > 0) {
      const aliveTeamsBeforeClash = getAliveTeams(updatedSurvivors);
      if (aliveTeamsBeforeClash.length > 1) {
        const clashZone = String(suddenDeathSafeZoneIds[0] || '');
        const criticalSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5));
        const detMax = Math.max(criticalSec + 8, Number(ruleset?.detonation?.maxSec ?? 30));
        updatedSurvivors = normalizeRuntimeSurvivorList(
          updatedSurvivors.map((actor) => {
            if (!actor || Number(actor?.hp || 0) <= 0) return actor;
            if (!clashZone || String(actor.zoneId || '') === clashZone) return actor;
            return {
              ...actor,
              zoneId: clashZone,
              detonationMaxSec: Math.max(Number(actor?.detonationMaxSec || 0), detMax),
              detonationSec: Math.max(Number(actor?.detonationSec || 0), criticalSec + 8),
              aiTargetZoneId: null,
              aiTargetTTL: 0,
            };
          })
        ).filter((s) => Number(s?.hp || 0) > 0);
        addLog(`🔥 서든데스 교전 집결: 생존 팀이 ${getZoneName(clashZone)}로 진입합니다.`, 'highlight');
        emitRunEvent('sudden_death_gather', {
          zoneId: clashZone,
          teamCount: aliveTeamsBeforeClash.length,
        }, atNow());
      }
    }

    // 2.5) 페이즈 내부 틱 시뮬레이션(폭발 타이머)
    if (useDetonation && forbiddenIds.size > 0) {
      const detCfg = ruleset?.detonation || {};
      const decPerSec = Number(detCfg.decreasePerSecForbidden ?? detCfg.decreasePerSec ?? 1);
      const regenPerSec = Number(detCfg.regenPerSecOutsideForbidden ?? detCfg.regenPerSecOutside ?? 1);
      const criticalSec = Number(detCfg.criticalSec || 5);

      const psz = ruleset?.gadgets?.portableSafeZone || {};
      const pszCost = Number(psz.energyCost || 40);
      const pszCd = Number(psz.cooldownSec || 30);
      const pszDur = Number(psz.durationSec || 7);

      const cnot = ruleset?.gadgets?.cnotGate || {};
      const cnotCost = Number(cnot.energyCost || 30);
      const cnotCd = Number(cnot.cooldownSec || 10);

      const allZoneIds = (Array.isArray(mapObj?.zones) && mapObj.zones.length)
        ? mapObj.zones.map((z) => String(z.zoneId))
        : [...forbiddenIds];

      // 🧨 엔드게임: 안전구역이 2곳만 남으면(=마지막 단계), 40s 유예 후 안전구역도 폭발 타이머가 감소합니다.
      const safeLeft = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid))).length;
      const allowForceAll = !suddenDeathActiveRef.current;
      const forceAllAfterSec = (allowForceAll && safeLeft <= 2) ? Math.max(0, Number(detCfg.forceAllAfterSec ?? 40)) : null;
      if (forceAllAfterSec !== null) {
        addLog(`⏳ 안전구역 유예 ${forceAllAfterSec}s: 이후 모든 구역에서 폭발 타이머가 감소합니다.`, 'system');
      }

      const pickSafeZone = (fromZoneId) => {
        const neighbors = Array.isArray(zoneGraph[fromZoneId]) ? zoneGraph[fromZoneId] : [];
        const safeNeighbors = neighbors.map(String).filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeNeighbors.length) return String(safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)]);
        const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeAll.length) return String(safeAll[Math.floor(Math.random() * safeAll.length)]);
        return String(fromZoneId);
      };

      // 🌫️ 퍼플 포그(서브웨더) - Day2/Day3/Day4 중간(단순 모델)
      const fogWarningSec = Number(ruleset?.fog?.warningSec || 30);
      const fogDurationSec = Number(ruleset?.fog?.durationSec || 45);
      const fogStartLocal = (fogLocalSec === null || fogLocalSec === undefined) ? null : Number(fogLocalSec);
      const fogWarnLocal = (fogStartLocal !== null) ? Math.max(0, fogStartLocal - fogWarningSec) : null;
      const fogEndLocal = (fogStartLocal !== null) ? fogStartLocal + fogDurationSec : null;

      let aliveMap = buildRuntimeSurvivorMap(updatedSurvivors);
      aliveMap = new Map(Array.from(aliveMap.values()).map((s) => [String(s._id), { ...s, cooldowns: { ...(s.cooldowns || {}) } }]));

      for (let t = 0; t < phaseDurationSec; t += tickSec) {
        const absSec = phaseStartSec + t;

        // 퍼플 포그 안내 로그(과도한 로그 방지: 1회씩만)
        if (fogWarnLocal !== null && t === fogWarnLocal) {
          addLog(`🌫️ 퍼플 포그 경고! 약 ${fogWarningSec}s 후, 일부 구역에서 시야가 악화됩니다.`, 'system');
        }
        if (fogStartLocal !== null && t === fogStartLocal) {
          addLog(`🌫️ 퍼플 포그 확산! (약 ${fogDurationSec}s)`, 'highlight');
        }
        if (fogEndLocal !== null && t === fogEndLocal) {
          addLog(`🌫️ 퍼플 포그가 걷혔습니다.`, 'system');
        }

        for (const s of aliveMap.values()) {
          if (!s || Number(s.hp || 0) <= 0) continue;

          // 쿨다운 감소
          if (s.cooldowns) {
            const cooldownTick = tickSec * getCooldownTickMultiplier(s);
            s.cooldowns.portableSafeZone = Math.max(0, Number(s.cooldowns.portableSafeZone || 0) - cooldownTick);
            s.cooldowns.cnotGate = Math.max(0, Number(s.cooldowns.cnotGate || 0) - cooldownTick);
            s.cooldowns.weaponSkill = Math.max(0, Number(s.cooldowns.weaponSkill || 0) - cooldownTick);
          }

          const zoneId = String(s.zoneId || '__default__');
          const forceAllNow = (forceAllAfterSec !== null && t >= forceAllAfterSec);
          const isForbidden = forceAllNow ? true : forbiddenIds.has(zoneId);

          if (forceAllAfterSec !== null && t === forceAllAfterSec) {
            addLog('⚠️ 유예 종료: 안전구역도 위험해졌습니다.', 'highlight');
          }

          if (!isForbidden) {
            // 안전 구역: 폭발 타이머 회복
            if (s.detonationSec !== null && s.detonationSec !== undefined) {
              const maxDet = Number(s.detonationMaxSec || detCfg.maxSec || 30);
              s.detonationSec = Math.min(maxDet, Number(s.detonationSec || 0) + regenPerSec * tickSec);
            }
            // 로그 스팸 방지: 안전구역에선 경고 마일스톤을 초기화
            s._detLogLastMilestone = null;
            continue;
          }

          // 제한구역: 폭발 타이머는 "금지구역에 있으면 무조건 감소"합니다.
          // (안전지대/개인 보호 효과가 있더라도 감소하며, 엔드게임(forceAllNow)도 동일)

          // 제한구역: 폭발 타이머 감소(휴대용 안전지대 전개 중이면 감소를 멈춥니다.)
          const isProtected = Number(s.safeZoneUntil || 0) > absSec;
          if (!isProtected) {
            s.detonationSec = Math.max(0, Number(s.detonationSec || 0) - decPerSec * tickSec);
          }

          // ⏳ 경고 로그(마일스톤) - 과도한 로그 방지
          const detFloor = Math.max(0, Math.floor(Number(s.detonationSec || 0)));
          const milestones = Array.isArray(detCfg.logMilestones) ? detCfg.logMilestones.map((x) => Math.floor(Number(x))) : [15, 10, 5, 3, 1, 0];
          if (milestones.includes(detFloor) && Number(s._detLogLastMilestone) !== detFloor) {
            s._detLogLastMilestone = detFloor;
            addLog(`⏳ [${s.name}] 폭발 타이머 ${detFloor}s (구역: ${getZoneName(zoneId)})`, 'system');
          }

          // 위기: 가젯 사용 시도(단순 모델)
          if (Number(s.detonationSec || 0) <= criticalSec) {
            const energyNow = Number(s.gadgetEnergy || 0);

            // 1) CNOT 게이트(간이 텔레포트)
            if (Number(s.cooldowns?.cnotGate || 0) <= 0 && energyNow >= cnotCost) {
              const dest = pickSafeZone(zoneId);
              if (dest && String(dest) !== zoneId) {
                s.zoneId = String(dest);
                s.gadgetEnergy = energyNow - cnotCost;
                s.cooldowns.cnotGate = cnotCd;
                addLog(`🌀 [${s.name}] CNOT 게이트 발동 → ${getZoneName(dest)} (에너지 -${cnotCost})`, 'highlight');
              }
            }

            // 2) 휴대용 안전지대(간이 개인 보호)
            const afterEnergy = Number(s.gadgetEnergy || 0);
            if (forbiddenIds.has(String(s.zoneId || zoneId)) && Number(s.cooldowns?.portableSafeZone || 0) <= 0 && afterEnergy >= pszCost) {
              s.gadgetEnergy = afterEnergy - pszCost;
              s.cooldowns.portableSafeZone = pszCd;
              s.safeZoneUntil = absSec + pszDur;
              addLog(`🛡️ [${s.name}] 휴대용 안전지대 전개 (${pszDur}s) (에너지 -${pszCost})`, 'highlight');
            }
          }

          // 폭발 타이머 만료 → 사망
          if (Number(s.detonationSec || 0) <= 0) {
            setDeathMetadata(s, 'detonation', { causeName: '폭발 타이머', atSec: absSec });
            s.hp = 0;
            s.deadAtPhaseIdx = phaseIdxNow;
            s.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
            newlyDead.push(s);
            emitDeathRunEventOnce(s, { reason: 'detonation', cause: '폭발 타이머', at: atNow() });
            addLog(`💥 [${s.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
          }
        }
      }

      // ✅ 무승부 방지: 서든데스에서 전원 폭발로 0명이 되면, 가장 늦게 죽은 1명을 승자로 판정
      if (suddenDeathActiveRef.current) {
        const aliveNow = Array.from(aliveMap.values()).filter((x) => Number(x?.hp || 0) > 0);
        if (aliveNow.length === 0) {
          const deadNow = Array.from(aliveMap.values()).filter((x) => Number(x?.hp || 0) <= 0);
          if (deadNow.length) {
            const lastAt = Math.max(...deadNow.map((x) => Number(x?._deathAt || 0)));
            const candidates = deadNow.filter((x) => Number(x?._deathAt || 0) === lastAt);
            const lastWinner = candidates[Math.floor(Math.random() * candidates.length)];
            if (lastWinner) {
              // dead 목록에 들어간 winner를 되살리기
              const idx = newlyDead.findIndex((deadEntry) => String(deadEntry?._id) === String(lastWinner?._id));
              if (idx >= 0) newlyDead.splice(idx, 1);
              lastWinner.hp = Math.max(1, Number(lastWinner.hp || 1));
              aliveMap.set(lastWinner._id, lastWinner);
              addLog(`⚖️ 전원 폭발! 마지막까지 버틴 [${lastWinner.name}] 승리(무승부 방지)`, 'highlight');
            }
          }
        }
      }

// 반영
      updatedSurvivors = normalizeRuntimeSurvivorList(Array.from(aliveMap.values())).filter((s) => Number(s.hp || 0) > 0);
    }

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



        // --- 전술 스킬(시즌 11) 간이 발동 로직 ---
        // - 상세설정에서 선택한 tacticalSkill 문자열을 기반으로, 도주/추격/교전에 실제 영향 부여
        // - 효과는 관전형 템포에 맞춘 단순 모델(SSOT/AI 안정화 우선)
        const absNow = currentActionSec();

        // --- 전술 강화 모듈(크레딧 업그레이드) 반영 ---
        // - 인벤에 보유한 '전술 강화 모듈' 수만큼 전술 스킬 쿨다운↓ / 효과↑
        // - 관전형을 위한 단순 모델(최대 5스택)
        const tacModuleLevel = (c) => {
          const mode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
          if (mode === 'level') {
            // 전술 스킬 레벨: Lv.1~2 (보정치는 Lv-1)
            const lv = Math.max(1, Math.min(2, Math.floor(Number(c?.tacticalSkillLevel || 1))));
            return lv - 1;
          }
          const inv = Array.isArray(c?.inventory) ? c.inventory : [];
          let n = 0;
          for (const it of inv) {
            const nm = String(it?.name || '').trim();
            const tags = Array.isArray(it?.tags) ? it.tags : [];
            const isModule = nm.includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (!isModule) continue;
            n += Math.max(0, Number(it?.qty || 1));
          }
          // stack 모드는 호환 유지(보정치 최대 1)
          return Math.max(0, Math.min(1, Math.floor(n)));
        };
        const normalizeTac = (v) => {
          return normalizeSupportedTacSkill(v);
        };
        const tacCdSec = (name, who) => {
          // 전술 스킬 쿨다운: 테이블 기반(튜닝 용이)
          const base = getTacBaseCdSec(name);

          const lv = tacModuleLevel(who);
          const mult = Math.max(0.70, 1 - (lv * 0.05)); // 최대 30% 감소
          return Math.max(12, Math.round(base * mult));
        };
        const canUseTac = (c) => (absNow >= Number(c?._tacNextAbsSec || 0));
        const applyTacUse = (c, name) => {
          if (!c) return;
          const n = normalizeTac(name);
          c._tacNextAbsSec = absNow + tacCdSec(n, c);
          c._tacLastUsed = n;
          c._tacLastUsedAt = absNow;
        };
        const pvpCfg = ruleset?.pvp || {};
        const pickSparseSafeNeighbor = (fromZoneId) => {
          const from = String(fromZoneId || '');
          if (!from) return '';
          const neighbors = Array.isArray(zoneGraph?.[from]) ? zoneGraph[from].map((z) => String(z)) : [];
          const safeNeighbors = neighbors.filter((z) => z && !forbiddenIds.has(z));
          if (!safeNeighbors.length) return from;
          const pop = {};
          for (const s of survivorMap.values()) {
            if (!s || Number(s.hp || 0) <= 0) continue;
            if (newDeadIds.includes(s._id)) continue;
            const zid = String(s.zoneId || '');
            if (!zid) continue;
            pop[zid] = (pop[zid] || 0) + 1;
          }
          let dest = from;
          let bestPop = 1e9;
          for (const z of safeNeighbors) {
            const p = Number(pop[z] || 0);
            if (p < bestPop) {
              bestPop = p;
              dest = z;
            }
          }
          return String(dest || from);
        };
        const applyCombatElimination = (combatWinner, combatLoser, opts = {}) => {
          if (!combatWinner || !combatLoser) return { assistId: null };
          const winnerId = String(combatWinner?._id || '');
          const loserId = String(combatLoser?._id || '');
          const prevDamagedBy = String(opts.prevDamagedBy || combatLoser?.lastDamagedBy || '');
          const prevDamagedPhaseIdx = Number(opts.prevDamagedPhaseIdx ?? combatLoser?.lastDamagedPhaseIdx ?? -9999);
          const deathReason = String(opts?.deathReason || 'combat').trim() || 'combat';
          const deathCauseName = String(opts?.deathCauseName || opts?.killText || '교전').trim() || '교전';
          let pushedDead = false;
          setDeathMetadata(combatLoser, deathReason, { causeName: deathCauseName, by: winnerId });
          if (!newDeadIds.includes(loserId)) {
            combatLoser.deadAtPhaseIdx = phaseIdxNow;
            combatLoser.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
            newDeadIds.push(loserId);
            pushedDead = true;
          }
          roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;
          grantPvpKillMastery(combatWinner, combatLoser, '처치');
          let assistId = null;
          const assistActor = prevDamagedBy
            ? (survivorMap.get(prevDamagedBy)
              || phaseSurvivors.find((s) => String(s?._id || '') === prevDamagedBy)
              || todaysSurvivors.find((s) => String(s?._id || '') === prevDamagedBy)
              || null)
            : null;
          const canRecordAssist = !isSoloMatch
            && assistActor
            && String(assistActor?.name || '').trim()
            && prevDamagedBy !== winnerId
            && prevDamagedBy !== loserId
            && areSameTeam(assistActor, combatWinner)
            && !areSameTeam(assistActor, combatLoser)
            && (phaseIdxNow - prevDamagedPhaseIdx) <= assistWindowPhases;
          if (canRecordAssist) {
            assistId = prevDamagedBy;
            roundAssists[assistId] = (roundAssists[assistId] || 0) + 1;
          }
          const assistName = assistId ? String(assistActor?.name || '') : '';
          addLog(`☠️ [${combatWinner.name}] ${opts.killText || '처치'}! (+1킬${assistId ? `, 어시: ${assistName}` : ''})`, 'death');
          if (!opts?.skipTraitAfterBattle) {
            applyErTraitAfterBattle(combatWinner, { lethal: true, defeated: combatLoser, damageDealt: opts?.damageDealt });
          }
          emitDeathRunEventOnce(combatLoser, {
            by: winnerId,
            zoneId: String(combatLoser?.zoneId || combatWinner?.zoneId || actor?.zoneId || ''),
            reason: deathReason,
            cause: deathCauseName,
          });
          if (useDetonation) {
            const bonusSec = Number(ruleset?.detonation?.killBonusSec || 5);
            const baseMax = Number((combatWinner.detonationMaxSec ?? ruleset?.detonation?.maxSec) ?? 30);
            const nextMax = baseMax + bonusSec;
            combatWinner.detonationMaxSec = nextMax;
            const baseCur = Number((combatWinner.detonationSec ?? ruleset?.detonation?.startSec) ?? 20);
            combatWinner.detonationSec = Math.min(nextMax, baseCur + bonusSec);
            addLog(`⏱️ [${combatWinner.name}] 처치 보상: 금지구역 제한시간 +${bonusSec}s`, 'system');
            const killCredit = Number(ruleset?.credits?.kill || 0);
            if (killCredit > 0) {
              earnedCredits += killCredit;
              combatWinner.simCredits = Number(combatWinner.simCredits || 0) + killCredit;
            }
          }
          const lootRate = Number(pvpCfg.lootCreditRate ?? 0.35);
          const lootMin = Number(pvpCfg.lootCreditMin ?? 10);
          const winnerLootBias = Math.max(0, getPerkLootBias(combatWinner));
          const lootUnitsBase = Math.max(0, Math.floor(Number(pvpCfg.lootInventoryUnits ?? 1)));
          const lootUnits = Math.max(0, Math.min(4, lootUnitsBase + (winnerLootBias >= 0.35 ? 1 : 0) + (winnerLootBias >= 0.8 ? 1 : 0)));
          const loserCredits = Math.max(0, Number(combatLoser?.simCredits || 0));
          const stealCreditBase = Math.min(loserCredits, Math.max(lootMin, Math.floor(loserCredits * lootRate)));
          const stealCredit = Math.min(loserCredits, Math.max(lootMin, Math.round(stealCreditBase * (1 + winnerLootBias * 0.5))));
          let lootLines = [];
          const craftLogs = [];
          if (stealCredit > 0) {
            combatLoser.simCredits = loserCredits - stealCredit;
            combatWinner.simCredits = Number(combatWinner.simCredits || 0) + stealCredit;
            lootLines.push(`💰 크레딧 ${stealCredit}`);
            emitRunEvent('gain', { who: winnerId, itemId: 'CREDITS', qty: stealCredit, source: 'pvp', from: loserId, zoneId: String(combatWinner?.zoneId || '') }, atNow());
          }
          const winnerLootGoal = buildCraftGoal(combatWinner.inventory, craftables, itemNameById, {
            goalTier: combatWinner?.goalGearTier,
            goalItemKeys: pickGoalLoadoutKeys(combatWinner),
            perkEffects: getActorPerkEffects(combatWinner),
          });
          const winnerLootGoalIds = (Array.isArray(winnerLootGoal?.missing) ? winnerLootGoal.missing : [])
            .map((m) => String(m?.itemId || ''))
            .filter(Boolean);
          const lootPick = lootUnits > 0 ? pickUnitsFromInventory(combatLoser?.inventory || [], lootUnits, { goalItemIds: winnerLootGoalIds }) : [];
          if (lootPick.length) {
            combatLoser.inventory = removePickedUnitsFromInventory(combatLoser?.inventory || [], lootPick);
            pruneEquippedAgainstInventory(combatLoser);
            for (const lp of lootPick) {
              const lootId = String(lp?.itemId || '');
              if (!lootId) continue;
              const lootItem = lp?.item || (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === lootId) || null;
              const fallbackName = itemNameById?.[lootId] || '아이템';
              const stub = lootItem || { _id: lootId, name: fallbackName, type: '재료', tags: [] };
              combatWinner.inventory = addItemToInventory(combatWinner.inventory, stub, lootId, 1, nextDay, ruleset);
              const gainMeta = combatWinner.inventory?._lastAdd;
              const got = Math.max(0, Number(gainMeta?.acceptedQty ?? 1));
              if (got > 0) {
                emitRunEvent('gain', { who: winnerId, itemId: lootId, qty: got, source: 'pvp', from: loserId, zoneId: String(combatWinner?.zoneId || '') }, atNow());
                lootLines.push(`${itemIcon(stub)} ${stub?.name || fallbackName} x${got}`);
                const crafted = tryAutoCraftFromLoot(combatWinner.inventory, lootId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(combatWinner));
                if (crafted?.inventory) {
                  combatWinner.inventory = crafted.inventory;
                  craftLogs.push(crafted.log);
                }
              }
            }
          }
          const invCraft = tryAutoCraftFromInventory(combatWinner, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
          if (invCraft?.log) craftLogs.push(invCraft.log);
          autoEquipBest(combatWinner, itemMetaById);
          pruneEquippedAgainstInventory(combatLoser);
          if (lootLines.length) addLog(`🧾 루팅: [${combatWinner.name}] ← [${combatLoser.name}] (${lootLines.join(', ')})`, 'normal');
          if (craftLogs.length) {
            for (const line of craftLogs) addLog(line, 'highlight');
          }
          const maxHp = Number(combatWinner?.maxHp ?? 100);
          const restHealMax = Math.max(0, Math.floor(Number(pvpCfg.restHealMax ?? 8)));
          const regenMultiplier = getNonCombatRegenMultiplier(combatWinner);
          const restHeal = applyHealingModifier(combatWinner, Math.min(Math.round(restHealMax * regenMultiplier), Math.max(0, maxHp - Number(combatWinner.hp || 0))));
          if (restHeal > 0) {
            combatWinner.hp = Math.min(maxHp, Number(combatWinner.hp || 0) + restHeal);
            addLog(`🩹 [${combatWinner.name}] 전투 후 재정비: HP +${restHeal}`, 'system');
          }
          tryUseConsumable(combatWinner, 'after_battle');
          const curHp = Number(combatWinner.hp || 0);
          const postRestHpBelow = Math.max(0, Number(pvpCfg.postBattleRestHpBelow ?? 45));
          const postRestExtraHealMax = Math.max(0, Math.floor(Number(pvpCfg.postBattleRestExtraHealMax ?? 6)));
          const postMoveChance = Math.max(0, Math.min(1, Number(pvpCfg.postBattleMoveChance ?? 0.35)));
          if (curHp > 0 && curHp <= postRestHpBelow) {
            const extraHeal = applyHealingModifier(combatWinner, Math.min(Math.round(postRestExtraHealMax * regenMultiplier), Math.max(0, maxHp - curHp)));
            if (extraHeal > 0) {
              combatWinner.hp = Math.min(maxHp, curHp + extraHeal);
              addLog(`🧘 [${combatWinner.name}] 전투 후 응급 처치: HP +${extraHeal}`, 'system');
            }
          } else if (Math.random() < postMoveChance) {
            const curZone = String(combatWinner.zoneId || '');
            const nextZone = pickSparseSafeNeighbor(curZone);
            if (nextZone && nextZone !== curZone) {
              combatWinner.zoneId = nextZone;
              addLog(`🚶 [${combatWinner.name}] 전투 후 이동: ${getZoneName(nextZone)}`, 'system');
            }
          }
          if (clearPostCombatEffects(combatWinner)) {
            addLog(`🧼 [${combatWinner.name}] 전투 후 지속 피해 상태 정리`, 'system');
          }
          clearRuntimeCombatFields(combatWinner);
          applyAiRecoveryWindow(combatWinner, currentActionSec(), {
            reason: 'post_combat',
            opponentId: loserId,
            recoverSec: 6,
            safeZoneSec: Number(combatWinner.hp || 0) <= postRestHpBelow ? 5 : 0,
          });
          if (pushedDead) {
            flushDeadSnapshots(appendPhaseDeadSnapshots(combatLoser));
          }
          return { assistId };
        };
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
        const resolveFleeSequence = (flee, chaser, opts = {}) => {
          const curZone = String(opts.curZone || flee?.zoneId || chaser?.zoneId || '');
          if (!flee || !chaser || !curZone) return null;
          const neighbors = Array.isArray(zoneGraph?.[curZone]) ? zoneGraph[curZone].map((z) => String(z)) : [];
          const safeNeighbors = neighbors.filter((z) => z && !forbiddenIds.has(z));
          if (!safeNeighbors.length) return null;

          const fleeTac = normalizeTac(flee?.tacticalSkill);
          const chaseTac = normalizeTac(chaser?.tacticalSkill);
          const fleeTacTrig = getTacTrigger(fleeTac, 'flee');
          const chaseTacTrig = getTacTrigger(chaseTac, 'chase');
          const fleeLv = tacModuleLevel(flee);
          const chaseLv = tacModuleLevel(chaser);

          if (fleeTac === '블링크' && canUseTac(flee)) {
            const dest = pickSparseSafeNeighbor(curZone);
            flee.zoneId = String(dest || curZone);
            applyAiRecoveryWindow(flee, currentActionSec(), { reason: 'tac_blink_escape', opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
            upsertRuntimeSurvivor(survivorMap, flee);
            applyTacUse(flee, '블링크');
            addLog(`✨ [${flee.name}] 전술 스킬(블링크)로 도주! ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'highlight');
            emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: 'tac_blink_escape' }, atNow());
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'blink_escape', escaped: true, caught: false, tacUsed: '블링크' }, atNow());
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id), tacUsed: '블링크' };
          }
          const healBelowHp = Number(fleeTacTrig?.hpBelow ?? 55);
          if ((opts.allowHeal ?? true) && fleeTac === '치유의 바람' && canUseTac(flee) && Number(flee.hp || 0) > 0 && Number(flee.hp || 0) <= healBelowHp) {
            const maxHp = Number(flee?.maxHp ?? 100);
            const healCap = getTacEffectNumber('치유의 바람', 'healCap', 1 + fleeLv, 22);
            const rawHeal = Math.min(healCap, Math.max(0, maxHp - Number(flee.hp || 0)));
            const heal = applyHealingModifier(flee, rawHeal);
            const regenRecovery = getTacEffectNumber('치유의 바람', 'regenRecovery', 1 + fleeLv, 4);
            const regenDuration = getTacEffectNumber('치유의 바람', 'regenDuration', 1 + fleeLv, 2);
            if (heal > 0 || regenRecovery > 0) {
              if (heal > 0) flee.hp = Math.min(maxHp, Number(flee.hp || 0) + heal);
              applyTacUse(flee, '치유의 바람');
              const tacEffects = applyRuntimeEffectPayloads(flee, buildTacStatusEffects('치유의 바람', 1 + fleeLv, 'tac_healwind'));
              const bits = [];
              if (heal > 0) bits.push(`HP +${heal}`);
              bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
              if (bits.length) addLog(`🌿 [${flee.name}] 전술 스킬(치유의 바람): ${bits.join(', ')}`, 'system');
              emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: '치유의 바람', mode: 'escape_heal', zoneId: String(flee?.zoneId || curZone || ''), heal: heal }, atNow());
              emitEffectRunEvents(flee, tacEffects.results, { source: 'tactical', skill: '치유의 바람', reason: 'escape_heal', zoneId: String(flee?.zoneId || curZone || '') }, atNow());
            }
          }

          const escTacBonus = (fleeTacTrig?.applyBonus === true)
            ? getTacEffectNumber(fleeTac, 'escapeBonus', 1 + fleeLv, 0)
            : 0;
          const chaseTacBonus = (chaseTacTrig?.applyBonus === true)
            ? Math.max(
                getTacEffectNumber(chaseTac, 'escapeBonus', 1 + chaseLv, 0),
                getTacEffectNumber(chaseTac, 'chaseBonus', 1 + chaseLv, 0)
              )
            : 0;
          const fleeMs = getEquipMoveSpeed(flee);
          const chaseMs = getEquipMoveSpeed(chaser);
          const fleeAggro = Math.max(0, getPerkAggressionBias(flee));
          const chaseAggro = Math.max(0, getPerkAggressionBias(chaser));
          const fleeHpRatio = Math.max(0, Math.min(1, Number(flee?.hp || 0) / Math.max(1, Number(flee?.maxHp || 100))));
          const chaseHpRatio = Math.max(0, Math.min(1, Number(chaser?.hp || 0) / Math.max(1, Number(chaser?.maxHp || 100))));
          const fleeShield = Math.max(0, getShieldValue(flee));
          const chaseShield = Math.max(0, getShieldValue(chaser));
          const fleeRegen = Math.max(0, getRegenValue(flee));
          const chaseRegen = Math.max(0, getRegenValue(chaser));
          const fleeEr = buildErBehaviorModifier(flee, battleSettings);
          const chaseEr = buildErBehaviorModifier(chaser, battleSettings);
          const escapeBase = Number(ruleset?.ai?.escapeBaseChance ?? 0.22);
          const msScale = Number(ruleset?.ai?.escapeMoveSpeedScale ?? 0.12);
          const pressurePenalty = Number(ruleset?.ai?.escapePressurePenalty ?? 0.28);
          const lowSafePenalty = Number(ruleset?.ai?.escapeLowSafePenalty ?? 0.15);
          const recoveryPenalty = Number(ruleset?.ai?.chaseRecoveryPenalty ?? 0.12);
          const safeCount = Math.max(0, totalZonesCount - forbiddenIds.size);
          const curForbidden = forbiddenIds.has(curZone);
          const powDelta = estimatePower(chaser) - estimatePower(flee);
          const fleeSustain = Math.min(0.14, fleeShield * 0.008 + fleeRegen * 0.02);
          const chaseSustain = Math.min(0.10, chaseShield * 0.006 + chaseRegen * 0.015);
          const chaserRecovering = Number(chaser?._aiRecoverUntilSec || 0) > Number(currentActionSec() || 0);
          let pEscape = escapeBase + (fleeMs - chaseMs) * msScale;
          pEscape += (escTacBonus && canUseTac(flee) && (fleeTacTrig?.applyBonus ?? true)) ? escTacBonus : 0;
          pEscape += Number(fleeEr?.escapeBonus || 0);
          pEscape -= Number(chaseEr?.chaseBonus || 0) * 0.7;
          if (curForbidden) pEscape -= 0.18;
          pEscape -= restrictedRatio * pressurePenalty;
          if (safeCount <= 3) pEscape -= lowSafePenalty;
          pEscape -= Math.max(0, Math.min(0.18, powDelta / 120));
          pEscape += Math.max(0, (0.42 - fleeHpRatio)) * 0.18;
          pEscape += fleeSustain;
          pEscape -= fleeAggro * 0.08;
          pEscape -= chaseAggro * 0.04;
          pEscape -= chaserRecovering ? recoveryPenalty * 0.45 : 0;
          pEscape = Math.max(0.05, Math.min(0.9, pEscape));
          const didEscape = (opts.forceAttempt === true) ? true : (Math.random() < pEscape);
          if (!didEscape) {
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(curZone || ''), outcome: 'escape_fail', escaped: false, caught: true, pEscape: Number(pEscape.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, atNow());
            return { escaped: false, fleeId: String(flee._id), chaserId: String(chaser._id) };
          }
          if (escTacBonus && canUseTac(flee) && (fleeTacTrig?.useOnCommit ?? true)) {
            applyTacUse(flee, fleeTac);
            addLog(`💨 [${flee.name}] 전술 스킬(${fleeTac})로 도주 보정!`, 'system');
            emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: String(fleeTac || ''), mode: 'escape_bonus', zoneId: String(flee?.zoneId || curZone || '') }, atNow());
          }

          const dest = pickSparseSafeNeighbor(curZone);
          flee.zoneId = String(dest || curZone);
          applyAiRecoveryWindow(flee, currentActionSec(), { reason: String(opts.moveReason || 'escape'), opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
          upsertRuntimeSurvivor(survivorMap, flee);
          addLog(`🏃 [${flee.name}] ${opts.escapeText || '교전을 피하려 도주'}: ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'system');
          emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: opts.moveReason || 'escape' }, atNow());

          const chaseBase = Number(ruleset?.ai?.chaseBaseChance ?? 0.25);
          const chaseMsScale = Number(ruleset?.ai?.chaseMoveSpeedScale ?? 0.14);
          let pChase = chaseBase + (chaseMs - fleeMs) * chaseMsScale + restrictedRatio * 0.10 + Math.max(0, Math.min(0.20, powDelta / 80));
          pChase += chaseAggro * 0.10;
          pChase += Number(chaseEr?.chaseBonus || 0);
          pChase -= fleeAggro * 0.04;
          pChase -= Number(fleeEr?.escapeBonus || 0) * 0.4;
          pChase -= Math.max(0, (0.55 - chaseHpRatio)) * 0.22;
          pChase += chaseSustain * 0.5;
          pChase -= chaserRecovering ? recoveryPenalty : 0;
          pChase += (chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.applyBonus ?? true)) ? chaseTacBonus : 0;
          pChase = Math.max(0, Math.min(0.95, pChase));
          const willChase = Math.random() < pChase;
          if (willChase && chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.useOnCommit ?? true)) {
            applyTacUse(chaser, chaseTac);
            addLog(`🧭 [${chaser.name}] 전술 스킬(${chaseTac})로 추격 강화!`, 'system');
            emitRunEvent('skill', { who: String(chaser?._id || ''), whoName: chaser?.name, skill: String(chaseTac || ''), mode: 'chase_bonus', zoneId: String(chaser?.zoneId || curZone || '') }, atNow());
          }
          if (!willChase) {
            applyAiRecoveryWindow(chaser, currentActionSec(), { reason: 'lost_track', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escape_no_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, atNow());
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
          }

          chaser.zoneId = String(flee.zoneId || curZone);
          applyAiRecoveryWindow(chaser, currentActionSec(), { reason: 'chase', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
          upsertRuntimeSurvivor(survivorMap, chaser);
          addLog(`🏃‍♂️ [${chaser.name}] 추격! → ${getZoneName(chaser.zoneId)}`, 'highlight');
          emitRunEvent('move', { who: String(chaser?._id || ''), name: chaser?.name, from: curZone, to: String(chaser.zoneId || ''), reason: 'chase' }, atNow());

          const catchBase = Number(ruleset?.ai?.catchBaseChance ?? 0.35);
          const catchMsScale = Number(ruleset?.ai?.catchMoveSpeedScale ?? 0.18);
          let pCatch = catchBase + (chaseMs - fleeMs) * catchMsScale + restrictedRatio * 0.12 + Math.max(0, Math.min(0.25, powDelta / 70));
          pCatch += chaseAggro * 0.12;
          pCatch += Number(chaseEr?.chaseBonus || 0);
          pCatch -= fleeAggro * 0.05;
          pCatch -= Number(fleeEr?.escapeBonus || 0) * 0.5;
          pCatch -= Math.max(0, (0.5 - chaseHpRatio)) * 0.18;
          pCatch -= Math.min(0.18, fleeShield * 0.01 + fleeRegen * 0.03);
          pCatch += Math.min(0.08, chaseShield * 0.006 + chaseRegen * 0.012);
          pCatch += (chaseTacBonus && canUseTac(chaser)) ? (chaseTacBonus * 0.9) : 0;
          pCatch = Math.max(0.05, Math.min(0.95, pCatch));
          const caught = Math.random() < pCatch;
          if (!caught) {
            addLog(`💨 [${flee.name}] 간신히 따돌렸습니다.`, 'system');
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escaped_after_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, atNow());
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
          }

          const sustainMitigation = Math.min(5, Math.round(fleeShield * 0.12 + fleeRegen * 0.8));
          const finishBias = chaseHpRatio >= 0.7 ? 1 : 0;
          const pre = Math.min(13, Math.max(3, Math.round(4 + (chaseMs - fleeMs) * 6 + Math.max(0, powDelta) / 80 + finishBias - sustainMitigation)));
          flee.hp = Math.max(0, Number(flee.hp || 0) - pre);
          upsertRuntimeSurvivor(survivorMap, flee);
          addLog(`⚡ 추격전! [${chaser.name}]이(가) [${flee.name}]을(를) 따라잡아 기습합니다. (피해 -${pre})`, 'highlight');
          emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'caught', escaped: true, caught: true, preDamage: pre, fatal: Number(flee.hp || 0) <= 0, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, atNow());
          return { escaped: true, caught: true, dest: String(flee.zoneId || curZone), preDamage: pre, fatal: Number(flee.hp || 0) <= 0, fleeId: String(flee._id), chaserId: String(chaser._id) };
        };
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


          const applyCombatTacAttack = (attacker, defender, baseDmg) => {
            const tac = normalizeTac(attacker?.tacticalSkill);
            const trig = getTacTrigger(tac, 'combat');
            const lv = tacModuleLevel(attacker);
            const hp = Number(attacker?.hp || 0);
            const maxHp = Math.max(1, Number(attacker?.maxHp || 100));
            if (!trig || !canUseTac(attacker)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
            if (Number(trig?.hpBelow || 999) < 999 && hp > Number(trig?.hpBelow || 999)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
            let dmg = Math.max(0, Math.floor(Number(baseDmg || 0)));
            const flat = getTacEffectNumber(tac, 'openerFlatDmg', 1 + lv, 0);
            const heal = getTacEffectNumber(tac, 'selfHeal', 1 + lv, 0);
            const cost = getTacEffectNumber(tac, 'selfCost', 1 + lv, 0);
            const regenRecovery = getTacEffectNumber(tac, 'regenRecovery', 1 + lv, 0);
            const regenDuration = getTacEffectNumber(tac, 'regenDuration', 1 + lv, 2);
            if (cost > 0 && hp <= Math.max(12, cost + 2)) return dmg;
            applyTacUse(attacker, tac);
            if (cost > 0) attacker.hp = Math.max(1, hp - cost);
            const finalHeal = heal > 0 ? applyHealingModifier(attacker, heal) : 0;
            if (finalHeal > 0) attacker.hp = Math.min(maxHp, Number(attacker.hp || hp) + finalHeal);
            const tacEffects = applyRuntimeEffectPayloads(attacker, buildTacStatusEffects(tac, 1 + lv, `tac_${String(tac || '').replace(/\s+/g, '_')}`, { target: 'self' }));
            const targetTacEffects = applyRuntimeEffectPayloads(defender, buildTacStatusEffects(tac, 1 + lv, `tac_${String(tac || '').replace(/\s+/g, '_')}`, { target: 'enemy' }));
            dmg += flat;
            if (flat > 0 || finalHeal > 0 || cost > 0 || regenRecovery > 0 || tacEffects.results.length > 0 || targetTacEffects.results.length > 0) {
              const bits = [];
              if (flat > 0) bits.push(`추가 피해 +${flat}`);
              if (finalHeal > 0) bits.push(`HP +${finalHeal}`);
              if (cost > 0) bits.push(`HP -${cost}`);
              bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
              bits.push(...collectRuntimeEffectResultTexts(targetTacEffects.results, { subjectName: defender.name }));
              if (bits.length) addLog(`🧠 [${attacker.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
            }
            emitRunEvent('skill', { who: String(attacker?._id || ''), whoName: attacker?.name, skill: String(tac || ''), mode: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, atNow());
            emitEffectRunEvents(attacker, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, atNow());
            emitEffectRunEvents(defender, targetTacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack_target', zoneId: String(defender?.zoneId || attacker?.zoneId || '') }, atNow());
            return Math.max(0, dmg);
          };
          const shieldBlock = (defender, rawDmg) => {
            let dmg = Math.max(0, Number(rawDmg || 0));
            if (dmg <= 0) return dmg;

            const preShield = consumeShieldDamage(defender, dmg);
            if (preShield.absorbed > 0) {
              addLog(`🛡️ [${defender.name}] 보호막: 피해 -${preShield.absorbed}`, 'system');
              dmg = Math.max(0, Number(preShield.damage || 0));
              if (dmg <= 0) return 0;
            }

            const erDefense = buildErBehaviorModifier(defender, battleSettings);
            const erBlockRaw = Math.min(Math.max(0, dmg * 0.35), Math.max(0, Number(erDefense?.damageBlock || 0)));
            const erBlock = Math.min(Math.max(0, Math.round(erBlockRaw)), Math.ceil(dmg));
            if (erBlock > 0) {
              dmg = Math.max(0, dmg - erBlock);
              if (erBlock >= 5) addLog(`🛡️ [${defender.name}] ER 방어: 피해 -${erBlock}`, 'system');
              if (dmg <= 0) return 0;
            }

            const tac = normalizeTac(defender?.tacticalSkill);
            const defenseTac = ['초월', '아티팩트', '무효화'];
            if (!defenseTac.includes(tac)) return dmg;
            if (!canUseTac(defender)) return dmg;
            const tcfg = getTacTrigger(tac, 'combatDefense');
            const minDmg = Math.max(0, Number(tcfg?.minIncomingDmg ?? 0));
            if (minDmg > 0 && dmg < minDmg) return dmg;
            const lv = tacModuleLevel(defender);
            const negateLethal = getTacEffectNumber(tac, 'negateLethal', 1 + lv, 0) > 0;
            if (negateLethal && dmg >= Number(defender?.hp || 0)) {
              applyTacUse(defender, tac);
              addLog(`🗿 [${defender.name}] 전술 스킬(${tac}): 치명타격 무효`, 'highlight');
              return Math.max(0, Number(defender?.hp || 0) - 1);
            }
            const blockCap = getTacEffectNumber(tac, 'block', 1 + lv, 0);
            const shieldValue = getTacEffectNumber(tac, 'shieldValue', 1 + lv, blockCap);
            const shieldDuration = getTacEffectNumber(tac, 'shieldDuration', 1 + lv, 2);
            if (blockCap <= 0 && shieldValue <= 0) return dmg;
            applyTacUse(defender, tac);
            const tacEffects = applyRuntimeEffectPayloads(defender, buildTacStatusEffects(tac, 1 + lv, `tac_${String(tac || '').replace(/\s+/g, '_')}`));
            const blocked = consumeShieldDamage(defender, dmg);
            const block = Math.max(0, Number(blocked?.absorbed || 0));
            if (block > 0 || tacEffects.results.length > 0) {
              const bits = [];
              bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
              if (block > 0) bits.push(`피해 -${block}`);
              if (bits.length) addLog(`⚡ [${defender.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
            }
            emitRunEvent('skill', { who: String(defender?._id || ''), whoName: defender?.name, skill: String(tac || ''), mode: 'combat_defense', zoneId: String(defender?.zoneId || '') }, atNow());
            emitEffectRunEvents(defender, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_defense', zoneId: String(defender?.zoneId || '') }, atNow());
            return Math.max(0, Number(blocked?.damage || dmg));
          };

          const getCharacterSkillSplashTargets = (attacker, primaryTarget) => {
            const zoneId = String(primaryTarget?.zoneId || attacker?.zoneId || '');
            const attackerId = String(attacker?._id || '');
            const primaryId = String(primaryTarget?._id || '');
            if (!zoneId || !attackerId) return [];
            return Array.from(survivorMap.values()).filter((s) => {
              const sid = String(s?._id || '');
              if (!sid || sid === attackerId || sid === primaryId) return false;
              if (newDeadIds.includes(sid) || Number(s?.hp || 0) <= 0) return false;
              if (String(s?.zoneId || '') !== zoneId) return false;
              return !areSameTeam(attacker, s);
            });
          };

          const applyCharacterSkillSplashDamage = (attacker, splashHits) => {
            if (!attacker || !Array.isArray(splashHits) || splashHits.length <= 0) return 0;
            let total = 0;
            for (const hit of splashHits) {
              const splashTarget = hit?.target;
              const targetId = String(splashTarget?._id || '');
              if (!targetId || newDeadIds.includes(targetId) || Number(splashTarget?.hp || 0) <= 0) continue;
              const raw = Math.max(0, Number(hit?.damage || 0));
              if (raw <= 0) continue;
              const prevDamagedBySplash = String(splashTarget?.lastDamagedBy || '');
              const prevDamagedPhaseIdxSplash = Number(splashTarget?.lastDamagedPhaseIdx ?? -9999);
              const finalSplash = shieldBlock(splashTarget, raw);
              if (finalSplash <= 0) continue;
              splashTarget.hp = Math.max(0, Number(splashTarget.hp || 0) - finalSplash);
              splashTarget.lastDamagedBy = String(attacker?._id || '');
              splashTarget.lastDamagedPhaseIdx = phaseIdxNow;
              total += finalSplash;
              addLog(`🌀 광역 피해: [${attacker.name}] ${String(hit?.skill || '스킬')} → [${splashTarget.name}] -${finalSplash}`, 'highlight');
              emitRunEvent('battle', {
                a: String(attacker?._id || ''),
                b: targetId,
                winner: Number(splashTarget.hp || 0) <= 0 ? String(attacker?._id || '') : '',
                lethal: Number(splashTarget.hp || 0) <= 0,
                zoneId: String(splashTarget?.zoneId || attacker?.zoneId || ''),
                subkind: 'character_skill_splash',
              }, atNow());
              grantPvpDamageMastery(attacker, { damageDealt: finalSplash, damageTaken: 0 }, '스킬 광역');
              if (Number(splashTarget.hp || 0) <= 0) {
                applyCombatElimination(attacker, splashTarget, {
                  prevDamagedBy: prevDamagedBySplash,
                  prevDamagedPhaseIdx: prevDamagedPhaseIdxSplash,
                  killText: '스킬 처치',
                  deathReason: 'character_skill_splash',
                  deathCauseName: `${String(hit?.skill || '스킬')} 광역 피해`,
                  damageDealt: finalSplash,
                });
              } else {
                upsertRuntimeSurvivor(survivorMap, splashTarget);
              }
            }
            return total;
          };

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
