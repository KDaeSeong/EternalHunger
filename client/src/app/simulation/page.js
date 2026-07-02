'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { AUTH_SYNC_EVENT, INIT_API_TIMEOUT_MS, apiGet, apiGetCached, apiPost, apiPut, getToken, getUser, updateStoredUser } from '../../utils/api';
import { LEGACY_HOF_KEY, emitHallOfFameSync, writeHallOfFameState } from '../../utils/hallOfFame';
import { applyErSubjectPreset, buildErBehaviorModifier } from '../../utils/erMeta';
import {
  EFFECT_AIRBORNE,
  EFFECT_KNOCKBACK,
  EFFECT_STUN,
  applyHealingModifier,
  getCooldownTickMultiplier,
  getKnockbackDistance,
  getLifestealPercent,
  getRegenValue,
  getShieldValue,
  hasActionBlockStatus,
  updateEffects,
} from '../../utils/statusLogic';
import { ER_STAT_KEYS, normalizeErStats } from '../../utils/erStats';
import {
  createInitialMasteryState,
  getMovementSpeedMasteryBonus,
  getNonCombatRegenMultiplier,
  getWildlifeDamageMultiplier,
  getWildlifeMasteryEntries,
} from '../../utils/masteryLogic';
import { normalizeWeaponType } from '../../utils/equipmentCatalog';
import { DEFAULT_RULESET_ID, getRuleset, getPhaseDurationSec, getFogLocalTimeSec, getNaturalCreditGain, normalizeRulesetId } from '../../utils/rulesets';
import SiteHeader from '../../components/SiteHeader';
import { buildTacStatusEffects, getTacBaseCdSec, getTacEffectNumber, getTacTrigger, normalizeSupportedTacSkill } from './tacticalSkillTable';
import SimulationControlPanel from './_components/SimulationControlPanel';
import SimulationHydrationPanel from './_components/SimulationHydrationPanel';
import SimulationLogPanel from './_components/SimulationLogPanel';
import SimulationMatchStatusPanel from './_components/SimulationMatchStatusPanel';
import SimulationResultModal from './_components/SimulationResultModal';
import '../../styles/ERSimulation.css';

const SIM_INIT_PING_TIMEOUT_MS = 5000;
const SIM_INIT_REQUIRED_TIMEOUT_MS = Math.min(INIT_API_TIMEOUT_MS, 12000);
const SIM_INIT_HEAVY_TIMEOUT_MS = Math.min(INIT_API_TIMEOUT_MS, 18000);
const SIM_INIT_ITEMS_GRACE_MS = 2500;

import {
  buildDetonationRiskSummary,
  buildRecentPings,
  buildZoneEdges,
  buildZonePositions,
  getEmptyDetonationRiskSummary,
} from './_lib/mapDerived';
import {
  applyCharacterSkillOnBasicAttack,
  areCharacterSkillsEnabled,
} from './_lib/characterSkillRuntime';
import {
  itemDisplayName,
  normalizeRewardDropEntries,
  itemIcon,
  shuffleArray,
  EQUIP_SLOTS,
  START_WEAPON_TYPES,
  normalizeUserStatistics,
  mergeStoredUserProgress,
  perkNumber,
  buildPerkRuntimeBundle,
  getActorPerkEffects,
  getPerkLootBias,
  getPerkAggressionBias,
  getPerkEventItemBias,
  applyPerkCreditBonus,
  maybeBoostDropQty,
  applyPerkBundleToActor,
  ensureEquipped,
  normalizeRuntimeEffect,
  normalizeRuntimeSurvivorList,
  buildRuntimeSurvivorMap,
  upsertRuntimeSurvivor,
  normalizeRuntimeSurvivor,
  getInvItemId,
  getEquipMoveSpeed,
  extractActorNameFromLog,
  getEquipSummary,
  compactIO,
  isEnabledScenarioEvent,
  getScenarioEventTimeOfDay,
  localKeyHyperloops,
  readLocalJsonArray,
  uniqStr,
  randInt,
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
  describeRuntimeEffect,
  getVisibleRuntimeEffects,
  shouldLogRuntimeEffectApplication,
  shouldLogRuntimeEffectExpiry,
  shouldLogRuntimeEffectTick,
  applyRuntimeEffectPayloads,
  consumeShieldDamage,
  clearPostCombatEffects,
  hasKioskAtZone,
  removeActiveEffect,
  createInitialSpawnState,
  zoneHasKioskFlag,
  getEligibleSpawnZoneIds,
  getHyperloopDeviceZoneId,
  ensureWorldSpawns,
  findDimensionRiftGiftItem,
  getDimensionRiftGiftMeta,
  listActiveDimensionRifts,
  pickDimensionRiftChoice,
  pickRiftEntrantTeams,
  resolveDimensionRiftWinner,
  openSpawnedLegendaryCrate,
  openSpawnedTranscendCrate,
  openSpawnedFoodCrate,
  pickupSpawnedCore,
  consumeBossAtZone,
  consumeMutantWildlifeAtZone,
  classifySpecialByName,
  pickGoalLoadoutKeys,
  buildCraftGoal,
  uniqStrings,
  advanceEarlyRouteProgress,
  buildDay1HeroRoutePlanDetails,
  buildEarlyRoutePlanDetails,
  getEarlyRoutePlanTarget,
  bfsNextStepToAnyTarget,
  bfsPickSafestZone,
  computeLateGameUpgradeNeed,
  chooseAiMoveTargets,
  rollKioskInteraction,
  rollDroneOrder,
  consumeWildlifeAtZone,
  inferItemCategory,
  inferEquipSlot,
  hasActiveEffect,
  canReceiveItem,
  normalizeInventory,
  formatInvAddNote,
  addItemToInventory,
  markInventoryGoalItem,
  invQty,
  consumeIngredientsFromInv,
  tryAutoCraftFromLoot,
  tryAutoCraftFromInventory,
  autoEquipBest,
  day1HeroGearDirector,
  lateGameGearDirector,
  pickCatalogEquipmentItem,
  tryImmediateCraftFromSpecial,
  safeGenerateDynamicEvent,
  areSameTeam,
  getActorTeamCapacity,
  getActorTeamId,
  getActorTeamName,
  getActorTeamOriginalSize,
  getAliveTeams,
  getWinningTeam,
  pickTeamRepresentative,
  getTimeOfDayFromPhase,
  worldTimeText,
  worldPhaseIndex,
  saveLocalHallOfFameBackup,
} from './_lib/simulationEngine';
import { buildRunSummaries, getEmptyRunSummaries } from './_lib/runSummaries';
import {
  buildSimulationDiagnostics,
  formatDiagnosticsLine,
  getEmptySimulationDiagnostics,
} from './_lib/simulationDiagnostics';
import { LOG_DETAIL_OPEN_KEY } from './_lib/logPresentation';
import {
  applyRegionDataToZones,
  getRegionData,
  getRegionFacilityZoneIds,
} from './_lib/lumiaRegionData';
import {
  isExplicitDay1HeroRoutePlan,
  getRuntimeRoutePlanZoneIds,
  getRoutePlanMissingItemIds,
  mergeMissingItemIds,
  shouldForceDay1HeroGearCatchup,
} from './_lib/routePlanProgressRuntime';
import {
  normalizeSatiety,
  decayActorSatiety,
} from './_lib/satietyRuntime';
import {
  PARTICIPANT_PRESET_SELECTED_KEY,
  PARTICIPANT_PRESET_LIMIT,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
  normalizeParticipantPresetList,
  readLocalParticipantPresets,
  writeLocalParticipantPresets,
  getInitialParticipantPresetId,
} from './_lib/participantPresetRuntime';
import {
  mergeServerCharacterIntoRuntimeSurvivor,
  getRuntimeActorKey,
  dedupeRuntimeParticipants,
} from './_lib/runtimeParticipantRuntime';
import { formatMoveIntentLabel } from './_lib/moveIntentRuntime';
import {
  normalizeMatchMode,
  getMatchConfig,
  applyMatchTeams,
  pickParticipantsForRun,
  getMatchStartInfo,
} from './_lib/matchRosterRuntime';
import { useSimEquipmentPersistence } from './_lib/useSimEquipmentPersistence';
import {
  getExportLogLines,
  makeLogFileBaseName,
  downloadTextFile,
  buildLogExportSummary,
  buildMarkdownLogExport,
} from './_lib/logExportRuntime';
import {
  formatClock,
  waitMs,
  softenNonLethalBattleLog,
} from './_lib/simulationFormattingRuntime';
import {
  formatInitLoadError,
  getApiErrorMessage,
  getRejectedLabels,
  getSettledArray,
  getSettledValue,
  loadMarketData,
  loadTradeData,
  redirectToLogin,
  settleWithin,
} from './_lib/simulationInitRuntime';
import {
  buildBaseZoneGraph,
  getHyperloopZoneIds,
  buildHyperloopZoneGraph,
  isHyperloopTransit as isHyperloopTransitEdge,
} from './_lib/mapGraphRuntime';
import { useSimulationRuntimeGuards } from './_lib/useSimulationRuntimeGuards';
import { useHyperloopPickLog } from './_lib/useHyperloopPickLog';
import {
  estimateMovePower as estimateMovePowerRuntime,
  shouldAvoidCombatByMovePower as shouldAvoidCombatByMovePowerRuntime,
} from './_lib/movePowerRuntime';
import { createPhaseDeathRuntime } from './_lib/phaseDeathRuntime';
import {
  buildItemNameById,
  buildItemMetaById,
  buildItemKeyById,
  buildCraftableItems,
  buildInventoryOptions,
  buildDevGrantItemOptions,
  filterVisibleDevGrantItemOptions,
  getSelectedDevGrantItem,
  buildTradeWantItemOptions,
  limitVisibleRows,
} from './_lib/itemOptionsRuntime';
import { createSeedRng } from './_lib/randomSeedRuntime';
import {
  getForbiddenZoneIdsForPhase as getForbiddenZoneIdsForPhaseRuntime,
  getForbiddenAddedZoneIdsForPhase as getForbiddenAddedZoneIdsForPhaseRuntime,
} from './_lib/forbiddenZoneRuntime';
import {
  applyErTraitAfterBattle as applyErTraitAfterBattleRuntime,
  applyErWeaponSkillAfterCombat as applyErWeaponSkillAfterCombatRuntime,
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
  grantMastery as grantMasteryRuntime,
  grantMasteries as grantMasteriesRuntime,
  grantCraftMastery as grantCraftMasteryRuntime,
  grantPvpDamageMastery as grantPvpDamageMasteryRuntime,
  grantPvpKillMastery as grantPvpKillMasteryRuntime,
} from './_lib/masteryProgressRuntime';
import {
  gainText,
  shouldLogItemReceive,
  emitItemGainIfAny as emitItemGainIfAnyRuntime,
  emitCraftRunEvent as emitCraftRunEventRuntime,
  emitObjectiveRunEvent as emitObjectiveRunEventRuntime,
  getLootCraftOptions,
  emitQueueRunEvent as emitQueueRunEventRuntime,
  emitEffectRunEvents as emitEffectRunEventsRuntime,
  emitConsumableRunEvent as emitConsumableRunEventRuntime,
} from './_lib/runEventRuntime';
import {
  createPhaseConsumableRuntime,
  forceUseConsumableAtIndex,
} from './_lib/consumableRuntime';

const HYPERLOOP_DELAY_SEC = 3;
const MARKET_CARD_RENDER_LIMIT = 40;
const DEV_SELECT_RENDER_LIMIT = 80;
const DEV_EVENT_PREVIEW_LIMIT = 80;

export default function SimulationPage() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [survivors, setSurvivors] = useState([]);
  const [candidateSurvivors, setCandidateSurvivors] = useState([]);
  const [dead, setDead] = useState([]);
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [prevPhaseLogs, setPrevPhaseLogs] = useState([]);

  const PREVLOGS_OPEN_KEY = 'eh_prevlogs_open';
  const [showPrevLogs, setShowPrevLogs] = useState(() => {
    try {
      return localStorage.getItem(PREVLOGS_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREVLOGS_OPEN_KEY, showPrevLogs ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showPrevLogs]);

  const [showDetailedLogs, setShowDetailedLogs] = useState(() => {
    try {
      return localStorage.getItem(LOG_DETAIL_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOG_DETAIL_OPEN_KEY, showDetailedLogs ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showDetailedLogs]);
  const [runEvents, setRunEvents] = useState([]);
  const [forbiddenAddedNow, setForbiddenAddedNow] = useState([]);

  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState('night');
  // timeOfDay: 'day' | 'night' (phase에서 파생, 날짜/스폰 게이트용)
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDayFromPhase('night'));
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
    return useMemo(() => safeRenderCompute(label, factory, fallback), deps);
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
  const [settings, setSettings] = useState({
    statWeights: { maxHp: 1, attackPower: 1, skillAmp: 1, defense: 1, attackSpeed: 1, attackRange: 1, sightRange: 1 },
    suddenDeathTurn: 5,
    forbiddenZoneStartDay: 2,
    forbiddenZoneStartPhase: 'night',
    forbiddenZoneDamageBase: 1.5,
    rulesetId: 'ER_S11',
    matchMode: 'squad',
  });
  const [participantPresets, setParticipantPresets] = useState(readLocalParticipantPresets);
  const [selectedParticipantPresetId, setSelectedParticipantPresetId] = useState(getInitialParticipantPresetId);
  const [participantPresetName, setParticipantPresetName] = useState('');

  const saveSelectedParticipantPresetId = (presetId) => {
    const nextId = String(presetId || RANDOM_PARTICIPANT_PRESET_ID);
    setSelectedParticipantPresetId(nextId);
    try {
      localStorage.setItem(PARTICIPANT_PRESET_SELECTED_KEY, nextId);
    } catch {
      // ignore local storage failures
    }
  };

  useEffect(() => {
    if (selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID) return;
    if (participantPresets.some((preset) => String(preset?.id || '') === String(selectedParticipantPresetId))) return;
    saveSelectedParticipantPresetId(RANDOM_PARTICIPANT_PRESET_ID);
  }, [participantPresets, selectedParticipantPresetId]);

  useEffect(() => {
    if (selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID) {
      setParticipantPresetName('');
      return;
    }
    const preset = participantPresets.find((row) => String(row?.id || '') === String(selectedParticipantPresetId));
    setParticipantPresetName(preset?.name || '');
  }, [participantPresets, selectedParticipantPresetId]);

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

  // 🗺️ 맵 선택(로드맵 2번)
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState('');
  // 🌀 하이퍼루프(맵 즉시 이동): 현재 맵에서 이동 가능한 목적지(로컬 설정)
  const [hyperloopDestId, setHyperloopDestId] = useState('');
  const [hyperloopCharId, setHyperloopCharId] = useState('');

  // 🪟 UI 모달(미니맵/캐릭터/로그)
  const [uiModal, setUiModal] = useState(null); // 'map' | 'chars' | 'log' | null
  const closeUiModal = () => setUiModal(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeUiModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  // 🧩 월드 스폰 상태(전설 재료 상자/보스) - 맵별로 관리
  const [spawnState, setSpawnState] = useState(() => createInitialSpawnState(activeMapId));

  const isFinishingRef = useRef(false);
  // ✅ 시작(1일차 낮) 기본 장비 세팅이 1회만 적용되도록 플래그
  const startStarterLoadoutAppliedRef = useRef(false);
  const persistSimEquipmentsFromChars = useSimEquipmentPersistence();

  // SD 서든데스(6번째 밤 이후): 페이즈 고정 + 전 구역 금지구역 + 카운트다운
  const suddenDeathActiveRef = useRef(false);
  const suddenDeathEndAtSecRef = useRef(null);
  const suddenDeathForbiddenAnnouncedRef = useRef(false);



const activeMapName = useSafeMemo('activeMapName', () => {
  const list = Array.isArray(maps) ? maps : [];
  return list.find((m) => String(m?._id) === String(activeMapId))?.name || '맵 없음';
}, [maps, activeMapId], '맵 없음');

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
  const [marketTab, setMarketTab] = useState('craft'); // craft | kiosk | drone | perk | trade
  const [selectedCharId, setSelectedCharId] = useState('');
  const [credits, setCredits] = useState(0);
  const [publicItems, setPublicItems] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [droneOffers, setDroneOffers] = useState([]);
  const [publicPerks, setPublicPerks] = useState([]);
  const [tradeOffers, setTradeOffers] = useState([]);
  const [viewerLp, setViewerLp] = useState(() => Number(getUser()?.lp || 0));
  const [viewerPerks, setViewerPerks] = useState(() => (Array.isArray(getUser()?.perks) ? getUser().perks : []));
  const [myTradeOffers, setMyTradeOffers] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [marketMessage, setMarketMessage] = useState('');
  const [devGrantItemId, setDevGrantItemId] = useState('');
  const [devGrantQty, setDevGrantQty] = useState(1);
  const [tradeDraft, setTradeDraft] = useState({
    give: [{ itemId: '', qty: 1 }],
    want: [{ itemId: '', qty: 1 }],
    wantCredits: 0,
    note: '',
  });

  const logBoxRef = useRef(null);
  const logWindowRef = useRef(null);
  const hasInitialized = useRef(false);
  const forbiddenCacheRef = useRef({});
  const logSeqRef = useRef(0);
  // ✅ UI용 logs는 "현재 페이즈"만 보여주고, 전체 기록은 따로 누적합니다.
  const fullLogsRef = useRef([]);
  const fullLogEntriesRef = useRef([]);
  const [logBoxMaxH, setLogBoxMaxH] = useState(420);

  // 🗺️ 맵/ID는 시뮬 "시작" 순간에 서버에서 새로고침할 수 있어, ref로 즉시값을 유지합니다.
  const mapsRef = useRef([]);
  const activeMapIdRef = useRef('');
  const activeMapRef = useRef(null);


  // phase(morning/night) -> timeOfDay(day/night) 동기화
  useEffect(() => {
    setTimeOfDay(getTimeOfDayFromPhase(phase));
  }, [phase]);


  // ▶️ 오토 플레이(페이즈 자동 진행)
  // - "틱 기반"은 페이즈 내부를 초 단위로 계산하는 엔진이고,
  // - 오토 플레이는 "다음 페이즈" 버튼을 일정 간격으로 자동 눌러주는 UX입니다.
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1); // 1 / 2 / 4 / 8 / 16 / 32
  const autoSpeedRef = useRef(1);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const isAdvancingRef = useRef(false);
  const isRefreshingMapsRef = useRef(false);
  const [isRefreshingMapSettings, setIsRefreshingMapSettings] = useState(false);
  const [mapRefreshToast, setMapRefreshToast] = useState(null);
  const mapRefreshToastTimerRef = useRef(null);
  const proceedPhaseGuardedRef = useRef(null);

  function normalizeAutoSpeed(value) {
    return Math.max(1, Math.min(32, Number(value) || 1));
  }

  function updateAutoSpeed(value) {
    const next = normalizeAutoSpeed(value);
    autoSpeedRef.current = next;
    setAutoSpeed(next);
  }

  useEffect(() => {
    autoSpeedRef.current = normalizeAutoSpeed(autoSpeed);
  }, [autoSpeed]);

  function showMapRefreshToast(text, kind = 'info') {
    // ✅ 헤더에서 1~2초 보이는 가벼운 토스트(연타/중복 호출 대응)
    try {
      if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
    } catch {}
    setMapRefreshToast({ text: String(text || ''), kind: String(kind || 'info') });
    mapRefreshToastTimerRef.current = setTimeout(() => {
      setMapRefreshToast(null);
      mapRefreshToastTimerRef.current = null;
    }, 1700);
  };

  useEffect(() => {
    return () => {
      try {
        if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
      } catch {}
    };
  }, []);

  // ✅ 관전자 모드 기본: 상점/조합/교환 UI는 숨김(테스트용 토글)
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [showDevDebugDetails, setShowDevDebugDetails] = useState(false);
  const [showDevEventLog, setShowDevEventLog] = useState(false);
  const [showAllMarketRows, setShowAllMarketRows] = useState(false);
  const [devGrantSearch, setDevGrantSearch] = useState('');
  const [tradeWantSearch, setTradeWantSearch] = useState('');
  const [pendingTranscendPick, setPendingTranscendPick] = useState(null);

  // 🎲 시드 고정(랜덤 재현)
  const SEED_STORAGE_KEY = 'eh_run_seed';
  function getInitialSeed() {
    try {
      const v = localStorage.getItem(SEED_STORAGE_KEY);
      const s = (v && String(v).trim()) ? String(v).trim() : '';
      return s || String(Date.now());
    } catch {
      return String(Date.now());
    }
  };
  const [runSeed, setRunSeed] = useState(getInitialSeed);
  const [seedDraft, setSeedDraft] = useState(getInitialSeed);
  const randomBackupRef = useRef(null);

  // ✅ (팝업/데스크톱) 시뮬레이션 창: 로그 출력 길이에 맞춰 높이를 유동 조정
  function resizeSimWindowToContent() {
    try {
      if (typeof window === 'undefined') return;
      if (typeof window.resizeTo !== 'function') return;

      const ua = String(navigator?.userAgent || '');
      const isElectron = ua.includes('Electron');
      const isPopup = !!window.opener;

      // 일반 브라우저 탭에서는 resizeTo가 기대대로 동작하지 않으므로, 팝업/데스크톱만 적용
      if (!isElectron && !isPopup) return;

      const doc = document.documentElement;
      const body = document.body;
      const contentH = Math.max(Number(doc?.scrollHeight || 0), Number(body?.scrollHeight || 0));
      const chromeH = Math.max(0, Number(window.outerHeight || 0) - Number(window.innerHeight || 0));

      const minH = 520;
      const maxH = Math.max(minH, Number(screen?.availHeight || 9999) - 40);
      const targetH = Math.max(minH, Math.min(maxH, contentH + chromeH + 20));

      window.resizeTo(Number(window.outerWidth || 1280), targetH);
    } catch {
      // ignore
    }
  };

  function addLog(text, type = 'normal') {
    // 전체 로그(서버 저장/결과용)는 페이즈 초기화와 무관하게 누적
    try {
      const logText = String(text || '');
      const logType = String(type || 'normal');
      fullLogsRef.current = [...(Array.isArray(fullLogsRef.current) ? fullLogsRef.current : []), logText];
      fullLogEntriesRef.current = [
        ...(Array.isArray(fullLogEntriesRef.current) ? fullLogEntriesRef.current : []),
        { text: logText, type: logType },
      ];
    } catch {}
    // ✅ React StrictMode(dev)에서는 state updater가 2번 호출될 수 있어,
    //   id 생성/카운터 증가를 updater 내부에서 처리해 key 충돌을 방지합니다.
    setLogs((prev) => {
      logSeqRef.current += 1;
      const rand = Math.random().toString(16).slice(2);
      const id = `${Date.now()}-${logSeqRef.current}-${rand}`;
      return [...prev, { text, type, id }];
    });
  };
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  function exportBattleLog(format = 'md') {
    const fmt = String(format || 'md').toLowerCase() === 'json' ? 'json' : 'md';
    const lines = getExportLogLines(fullLogsRef.current);
    if (!lines.length) {
      addLog('⚠️ 저장할 전투 로그가 없습니다. 게임을 시작한 뒤 다시 시도해주세요.', 'system');
      return;
    }

    const summary = buildLogExportSummary({
      lines,
      settings,
      resultSummary,
      runEvents,
      winner,
      killCounts,
      assistCounts,
    });
    const filename = makeLogFileBaseName({ winner, resultSummary }, fmt);
    const payload = fmt === 'json'
      ? JSON.stringify({
          schema: 'eternal-hunger.battle-log.v1',
          summary,
          logs: lines.map((text, index) => ({ index: index + 1, text })),
          runEvents: Array.isArray(runEvents) ? runEvents : [],
        }, null, 2)
      : buildMarkdownLogExport(lines, summary);
    const ok = downloadTextFile(
      filename,
      payload,
      fmt === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
    );
    addLog(ok ? `💾 전투 로그 저장: ${filename}` : '⚠️ 전투 로그 저장 실패', ok ? 'system' : 'death');
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
    const stamp = at || { day, phase, sec: matchSec };
    const eventPayload = payload && typeof payload === 'object' ? { ...payload } : {};
    const payloadKind = eventPayload.kind;
    delete eventPayload.kind;
    delete eventPayload.at;
    delete eventPayload.ts;
    const e = { ...eventPayload, kind: String(kind || 'unknown'), at: stamp, ts: Date.now() };
    if ((e.subkind === undefined || e.subkind === null || e.subkind === '') && payloadKind !== undefined && payloadKind !== null && String(payloadKind)) {
      e.subkind = String(payloadKind);
    }
    setRunEvents((prev) => {
      const next = [...(Array.isArray(prev) ? prev : []), e];
      const max = 5000;
      return next.length > max ? next.slice(next.length - max) : next;
    });
  };

  function grantMastery(actor, category, amount, reason = '') {
    return grantMasteryRuntime(actor, category, amount, reason, addLog);
  }

  function grantMasteries(actor, entries = [], reason = '') {
    return grantMasteriesRuntime(actor, entries, reason, addLog);
  }

  function grantCraftMastery(actor, crafted, itemMetaById, reason = '제작') {
    return grantCraftMasteryRuntime(actor, crafted, itemMetaById, reason, addLog);
  }

  function grantPvpDamageMastery(actor, payload = {}, reason = '교전') {
    return grantPvpDamageMasteryRuntime(actor, payload, reason, addLog);
  }

  function grantPvpKillMastery(actor, opponent, reason = '처치') {
    return grantPvpKillMasteryRuntime(actor, opponent, reason, addLog);
  }

  function applyErTraitAfterBattle(actor, opts = {}) {
    return applyErTraitAfterBattleRuntime(actor, { ...opts, addLog });
  };

  function applyErWeaponSkillAfterCombat(attacker, defender, opts = {}) {
    return applyErWeaponSkillAfterCombatRuntime(attacker, defender, {
      ...opts,
      addLog,
      emitRunEvent,
      emitEffectRunEvents,
    });
  };

  function emitItemGainIfAny(qty, payload = {}, at = null) {
    return emitItemGainIfAnyRuntime(emitRunEvent, qty, payload, at);
  };

  function emitCraftRunEvent(who, crafted, at = null, zoneId = '') {
    return emitCraftRunEventRuntime(emitRunEvent, who, crafted, at, zoneId);
  };

  function emitObjectiveRunEvent(actor, objective, payload = {}, at = null) {
    return emitObjectiveRunEventRuntime(emitRunEvent, actor, objective, payload, at);
  };

  function applyLootCraftResult(actor, crafted, itemMeta, at = null, zoneId = '', logType = 'normal') {
    if (!actor || !crafted?.inventory) return false;
    actor.inventory = crafted.inventory;
    autoEquipBest(actor, itemMeta);
    addLog(`[${actor.name}] ${crafted.log}`, logType);
    grantCraftMastery(actor, crafted, itemMeta, '제작');
    emitCraftRunEvent(actor?._id, crafted, at, zoneId || actor?.zoneId);
    return true;
  };

  function emitQueueRunEvent(who, payload = {}, at = null) {
    return emitQueueRunEventRuntime(emitRunEvent, who, payload, at);
  };

  function emitEffectRunEvents(who, rows, meta = {}, at = null) {
    return emitEffectRunEventsRuntime(emitRunEvent, who, rows, meta, at);
  };

  function emitConsumableRunEvent(who, item, meta = {}, at = null) {
    return emitConsumableRunEventRuntime(emitRunEvent, who, item, meta, at);
  };

  // 🛠 개발자 도구: 선택 캐릭터에게 소모품을 임의로 사용(강제)
  // - 전투 중 사용 불가: 진행 중(isAdvancing)일 때는 버튼을 비활성화합니다.
  
  // 🎁 개발자 도구: 초월 장비 선택 상자(선택 대기) 처리
  function resolvePendingTranscendPick(optionIndex, method = 'manual') {
    if (!pendingTranscendPick) return;

    const pending = pendingTranscendPick;
    const ruleset = getRuleset(settings?.rulesetId);
    const options = Array.isArray(pending?.options) ? pending.options : [];
    const chosen = (Number(optionIndex) === -1) ? pickAutoTranscendOption(options, publicItems) : (options[Number(optionIndex)] || null);

    if (!chosen?.itemId) {
      setPendingTranscendPick(null);
      return;
    }

    const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === String(chosen.itemId)) || null;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((c) => ({
        ...c,
        inventory: Array.isArray(c?.inventory) ? c.inventory.map((i) => ({ ...i })) : [],
      }));
      const idx = next.findIndex((c) => String(c?._id) === String(pending.characterId));
      if (idx < 0) return prev;

      const ch = next[idx];
      ch.inventory = addItemToInventory(ch.inventory, item, String(chosen.itemId), 1, day, ruleset);
      const meta = ch.inventory?._lastAdd || null;
      const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
      const nm = itemDisplayName(item || { _id: chosen.itemId, name: chosen.name });
      addLog(`🎁 [${ch.name}] 초월 장비 선택 상자 선택 → ${itemIcon(item)} ${nm} ${gainText(got)}${formatInvAddNote(meta, 1, ch.inventory, ruleset)}`, 'highlight');
      emitItemGainIfAny(got, { who: ch.name, whoId: ch._id, itemId: String(chosen.itemId), source: 'box', sourceKind: 'transcend_pick', zoneId: pending.zoneId, choice: method }, pending.at || { day, phase, sec: matchSec });
      if (got > 0) autoEquipBest(ch, {});
      return next;
    });

    setPendingTranscendPick(null);
  };

  const devForceUseConsumable = (charId, invIndex) => {
    if (!showMarketPanel) return;
    if (isAdvancing || isGameOver) return;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((c) => ({
        ...c,
        inventory: Array.isArray(c?.inventory) ? c.inventory.map((i) => ({ ...i })) : [],
      }));
      const idx = next.findIndex((c) => String(c?._id) === String(charId));
      if (idx < 0) return prev;

      const ch = next[idx];
      const result = forceUseConsumableAtIndex(ch, invIndex, {
        addLog,
        emitConsumableRunEvent,
        emitEffectRunEvents,
      });
      if (!result.used) return prev;
      return next;
    });
  };

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;

    // ✅ 로그 길이에 맞춰 로그창 높이를 유동적으로 조절(최소~최대 클램프)
    const measure = () => {
      const h = Math.max(0, Number(el.scrollHeight || 0));
      const desired = Math.max(180, Math.min(560, h + 8));
      setLogBoxMaxH(desired);

      // ✅ 로그가 쌓여도 "페이지"가 아니라 로그 창 내부만 스크롤되게 고정
      el.scrollTop = el.scrollHeight;

      // ✅ (팝업/데스크톱) 창 높이도 로그 길이에 맞춰 유동 조정
      resizeSimWindowToContent();
    };

    // 렌더 직후 실제 scrollHeight를 잡기 위해 한 프레임 뒤에 측정
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [logs, prevPhaseLogs, showPrevLogs, showDetailedLogs]);

// 선택 캐릭터 기본값 유지
  useEffect(() => {
    if (!survivors?.length) {
      setSelectedCharId('');
      return;
    }
    if (!selectedCharId) {
      setSelectedCharId(survivors[0]._id);
      return;
    }
    if (!survivors.some((s) => String(s._id) === String(selectedCharId))) {
      setSelectedCharId(survivors[0]._id);
    }
  }, [survivors, selectedCharId]);

  const selectedChar = useSafeMemo('selectedChar', () => {
    const list = Array.isArray(survivors) ? survivors : [];
    return list.find((s) => String(s?._id) === String(selectedCharId)) || null;
  }, [survivors, selectedCharId], null);

  function applyParticipantPresetToCurrent(presetId = selectedParticipantPresetId) {
    if (day !== 0 || matchSec !== 0 || isAdvancing || isGameOver) {
      setMarketMessage('참가자 프리셋은 게임 시작 전(0일차 00초)에만 적용할 수 있습니다.');
      return;
    }

    const pool = (Array.isArray(candidateSurvivors) && candidateSurvivors.length)
      ? candidateSurvivors
      : survivors;
    const picked = pickParticipantsForRun(pool, participantPresets, presetId, settings);
    const assigned = applyMatchTeams(picked, settings);
    const kills = {};
    const assists = {};
    const shouldTrackAssists = getMatchConfig(settings).matchMode !== 'solo';
    assigned.forEach((actor) => {
      const key = getRuntimeActorKey(actor);
      if (!key) return;
      kills[key] = 0;
      if (shouldTrackAssists) assists[key] = 0;
    });

    setSurvivors(assigned);
    setDead([]);
    setKillCounts(kills);
    setAssistCounts(assists);
    setSelectedCharId(assigned[0]?._id || '');
    setMarketMessage(
      presetId === RANDOM_PARTICIPANT_PRESET_ID
        ? `무작위 참가자 ${assigned.length}명을 다시 구성했습니다.`
        : `참가자 프리셋을 적용했습니다. (${assigned.length}명)`
    );
  }

  function saveCurrentParticipantPreset() {
    const ids = normalizeParticipantPresetIds((Array.isArray(survivors) ? survivors : []).map((actor) => getRuntimeActorKey(actor)));
    if (ids.length < 2) {
      setMarketMessage('저장할 참가자가 부족합니다.');
      return;
    }

    const now = Date.now();
    const existingId = selectedParticipantPresetId !== RANDOM_PARTICIPANT_PRESET_ID ? String(selectedParticipantPresetId || '') : '';
    const currentName = String(participantPresetName || '').trim();
    const list = normalizeParticipantPresetList(participantPresets);
    const existingIndex = existingId ? list.findIndex((preset) => String(preset?.id || '') === existingId) : -1;
    if (existingIndex < 0 && list.length >= PARTICIPANT_PRESET_LIMIT) {
      setMarketMessage(`참가자 프리셋은 최대 ${PARTICIPANT_PRESET_LIMIT}개까지 저장할 수 있습니다.`);
      return;
    }

    const previous = existingIndex >= 0 ? list[existingIndex] : null;
    const nextPreset = {
      id: previous?.id || `preset-${now}`,
      name: currentName || previous?.name || `프리셋 ${Math.min(list.length + 1, PARTICIPANT_PRESET_LIMIT)}`,
      characterIds: ids,
      matchMode: getMatchConfig(settings).matchMode,
      createdAt: Number(previous?.createdAt || now),
      updatedAt: now,
    };
    const next = existingIndex >= 0
      ? list.map((preset, index) => (index === existingIndex ? nextPreset : preset))
      : [...list, nextPreset];
    writeLocalParticipantPresets(next);
    setParticipantPresets(next);
    saveSelectedParticipantPresetId(nextPreset.id);
    setParticipantPresetName(nextPreset.name);
    setMarketMessage(`참가자 프리셋을 저장했습니다. (${ids.length}명)`);
  }

  function deleteSelectedParticipantPreset() {
    if (selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID) return;
    const id = String(selectedParticipantPresetId || '');
    const next = normalizeParticipantPresetList(participantPresets).filter((preset) => String(preset?.id || '') !== id);
    writeLocalParticipantPresets(next);
    setParticipantPresets(next);
    saveSelectedParticipantPresetId(RANDOM_PARTICIPANT_PRESET_ID);
    setParticipantPresetName('');
    setMarketMessage('참가자 프리셋을 삭제했습니다.');
  }

  // 🎒 장비 장착/해제(런타임): equipped[slot]에 itemId를 저장
  function setEquipForSurvivor(survivorId, slot, itemIdOrNull) {
    const sid = String(survivorId || '');
    const sslot = String(slot || '');
    if (!sid || !EQUIP_SLOTS.includes(sslot)) return;

    setSurvivors((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        const id = String(s?._id || s?.id || s?.name || '');
        if (id !== sid) return s;
        const eq = { ...ensureEquipped(s) };
        eq[sslot] = itemIdOrNull ? String(itemIdOrNull) : null;
        return { ...s, equipped: eq };
      })
    );
  };


  const activeMap = useSafeMemo('activeMap', () => {
    const list = Array.isArray(maps) ? maps : [];
    return list.find((m) => String(m?._id) === String(activeMapId)) || null;
  }, [maps, activeMapId], null);

  // ref 동기화(즉시 접근 필요)
  useEffect(() => {
    mapsRef.current = Array.isArray(maps) ? maps : [];
  }, [maps]);
  useEffect(() => {
    activeMapIdRef.current = String(activeMapId || '');
  }, [activeMapId]);
  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  // 맵이 바뀌면 월드 스폰 상태 초기화
  useEffect(() => {
    setSpawnState(createInitialSpawnState(activeMapId));
  }, [activeMapId]);

  const zones = useSafeMemo('zones', () => {
    const z = Array.isArray(activeMap?.zones) ? activeMap.zones : [];
    const fallbackZones = [
      { zoneId: 'alley', name: '골목길', isForbidden: false },
      { zoneId: 'gas_station', name: '주유소', isForbidden: false },
      { zoneId: 'archery', name: '양궁장', isForbidden: false },
      { zoneId: 'school', name: '학교', isForbidden: false },
      { zoneId: 'police', name: '경찰서', isForbidden: false },
      { zoneId: 'firestation', name: '소방서', isForbidden: false },
      { zoneId: 'temple', name: '절', isForbidden: false },
      { zoneId: 'stream', name: '개울', isForbidden: false },
      { zoneId: 'park', name: '연못', isForbidden: false },
      { zoneId: 'hospital', name: '병원', isForbidden: false },
      { zoneId: 'hotel', name: '호텔', isForbidden: false },
      { zoneId: 'beach', name: '모래사장', isForbidden: false },
      { zoneId: 'forest', name: '숲', isForbidden: false },
      { zoneId: 'apartment', name: '고급 주택가', isForbidden: false },
      { zoneId: 'cemetery', name: '묘지', isForbidden: false },
      { zoneId: 'cathedral', name: '성당', isForbidden: false },
      { zoneId: 'warehouse', name: '창고', isForbidden: false },
      { zoneId: 'port', name: '항구', isForbidden: false },
      { zoneId: 'barge', name: '바지선', isForbidden: false },
      { zoneId: 'factory', name: '공장', isForbidden: false },
      { zoneId: 'lab', name: '연구소', isForbidden: false },
    ];
    return applyRegionDataToZones(z.length ? z : fallbackZones);
  }, [activeMap], []);

  const zoneNameById = useSafeMemo('zoneNameById', () => {
    const out = {};
    (Array.isArray(zones) ? zones : []).forEach((z) => {
      if (z?.zoneId) out[String(z.zoneId)] = z.name || String(z.zoneId);
    });
    return out;
  }, [zones], {});

  const getZoneName = useMemo(() => (zoneId) => {
    const key = String(zoneId || '');
    return zoneNameById[key] || key || '미상';
  }, [zoneNameById]);

  // 🌀 하이퍼루프 목적지(로컬 설정): eh_map_hyperloops_{mapId}
  const hyperloopDestIds = useSafeMemo('hyperloopDestIds', () => {
    const ids = uniqStr(readLocalJsonArray(localKeyHyperloops(activeMapId)));
    if (!ids.length) return [];
    const mapSet = new Set((Array.isArray(maps) ? maps : []).map((m) => String(m?._id || '')));
    return ids.filter((id) => mapSet.has(String(id)));
  }, [activeMapId, maps], []);

  // 🌀 하이퍼루프 장치(패드) 구역(로컬 설정): eh_hyperloop_zone_{mapId}
  const hyperloopPadZoneId = useSafeMemo('hyperloopPadZoneId', () => {
    const serverZoneId = String(activeMap?.hyperloopDeviceZoneId || '').trim();
    if (serverZoneId) return serverZoneId;
    const saved = String(getHyperloopDeviceZoneId(activeMapId) || '').trim();
    if (saved) return saved;
    const z = Array.isArray(zones) ? zones : [];
    return String(z?.[0]?.zoneId || '');
  }, [activeMapId, zones, activeMap], '');

  const hyperloopPadName = useSafeMemo('hyperloopPadName', () => {
    const zid = String(hyperloopPadZoneId || '').trim();
    if (!zid) return '';
    return String(getZoneName(zid) || zid);
  }, [hyperloopPadZoneId, zoneNameById], '');

  const isSelectedCharOnHyperloopPad = useSafeMemo('isSelectedCharOnHyperloopPad', () => {
    const who = String(selectedCharId || '').trim();
    if (!who) return false;
    const pad = String(hyperloopPadZoneId || '').trim();
    if (!pad) return false;
    const actor = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id || '') === who) || null;
    return String(actor?.zoneId || '').trim() === pad;
  }, [selectedCharId, survivors, hyperloopPadZoneId], false);

  const hyperloopDestKey = hyperloopDestIds.join('|');

  useEffect(() => {
    if (!hyperloopDestIds.length) {
      setHyperloopDestId('');
      return;
    }
    if (!hyperloopDestId || !hyperloopDestIds.includes(String(hyperloopDestId))) {
      setHyperloopDestId(String(hyperloopDestIds[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hyperloopDestKey]);

// 🌀 하이퍼루프 이동 대상(캐릭터) 기본값: 선택 캐릭터 우선
useEffect(() => {
  const preferred = String(selectedCharId || '').trim();
  if (preferred) {
    if (String(hyperloopCharId || '') !== preferred) setHyperloopCharId(preferred);
    return;
  }
  const alive = (Array.isArray(survivors) ? survivors : []).filter((c) => Number(c?.hp || 0) > 0);
  if (!alive.length) {
    setHyperloopCharId('');
    return;
  }
  if (!hyperloopCharId || !alive.some((c) => String(c?._id) === String(hyperloopCharId))) {
    setHyperloopCharId(String(alive[0]?._id || ''));
  }
}, [survivors, hyperloopCharId, selectedCharId]);

  function doHyperloopJump(toMapId, whoId) {
    const toId = String(toMapId || '').trim();
const who = String(whoId || '').trim();
if (!who) {
  addLog('🌀 하이퍼루프: 이동할 캐릭터를 선택하세요.', 'system');
  return;
}
    if (!toId) return;
    if (loading || isAdvancing || isGameOver) return;
    if (day <= 0) {
      addLog('🌀 하이퍼루프: 게임 시작 후(1일차부터) 사용할 수 있습니다.', 'system');
      return;
    }

    // 맵 내 장치(패드) 구역에 있어야 사용 가능
    const padZid = String(hyperloopPadZoneId || '').trim();
    const actor = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id || '') === who) || null;
    const actorZid = String(actor?.zoneId || '').trim();
    if (!padZid || actorZid !== padZid) {
      const padNm = String(hyperloopPadName || padZid || '하이퍼루프 구역');
      addLog(`🌀 하이퍼루프 장치: [${padNm}]에서만 사용할 수 있습니다.`, 'system');
      return;
    }
    const toMap = (Array.isArray(maps) ? maps : []).find((m) => String(m?._id) === toId) || null;
    if (!toMap) return;

    const rs = getRuleset(settings?.rulesetId);
    const forb = new Set(getForbiddenZoneIdsForPhase(toMap, day, phase, rs));
    const z = Array.isArray(toMap?.zones) ? toMap.zones : [];
    const eligible = getEligibleSpawnZoneIds(z, forb);

    // 목적지 맵에도 패드 구역이 있으면 그곳으로 도착(금지구역이면 예외)
    const destPad = String(getHyperloopDeviceZoneId(toId) || '').trim();
    const destPadOk = !!destPad && z.some((zz) => String(zz?.zoneId || '') === destPad) && !forb.has(destPad);
    const entryZoneId = String((destPadOk ? destPad : (eligible?.[0] || z?.[0]?.zoneId)) || '__default__');

    const fromName = String(activeMapName || '현재맵');
    const toName = String(toMap?.name || '목적지');
    setActiveMapId(toId);
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((c) => (String(c?._id) === who ? ({ ...c, mapId: toId, zoneId: entryZoneId }) : c)));
    const whoName = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === who)?.name || '선택 캐릭터';
    addLog(`🌀 하이퍼루프 이동: ${fromName} → ${toName} (${whoName})`, 'highlight');
    emitRunEvent('hyperloop', { whoId: who, who: whoName, fromMapId: String(activeMapId || ''), toMapId: toId, toZoneId: entryZoneId });
  };



  const baseZoneGraph = useSafeMemo('baseZoneGraph', () => {
    return buildBaseZoneGraph(activeMap, zones);
  }, [activeMap, zones], {});

  const hyperloopZoneIds = useSafeMemo('hyperloopZoneIds', () => {
    return getHyperloopZoneIds(activeMap, zones);
  }, [activeMap, zones], []);

  const hyperloopZoneKey = hyperloopZoneIds.join('|');
  const hyperloopZoneSet = useMemo(() => new Set(hyperloopZoneIds), [hyperloopZoneKey]);

  const zoneGraph = useSafeMemo('zoneGraph', () => {
    return buildHyperloopZoneGraph(baseZoneGraph, zones, hyperloopZoneIds);
  }, [baseZoneGraph, zones, hyperloopZoneKey], {});

  const isHyperloopTransit = (fromZoneId, toZoneId) => (
    isHyperloopTransitEdge(baseZoneGraph, hyperloopZoneIds, fromZoneId, toZoneId)
  );

  function applyRunSeed(seedStr) {
    const s = String(seedStr || '').trim() || '0';
    try { localStorage.setItem(SEED_STORAGE_KEY, s); } catch {}
    if (!randomBackupRef.current) randomBackupRef.current = Math.random;
    Math.random = createSeedRng(`RUN:${s}`);
  };

  function restoreRandom() {
    if (randomBackupRef.current) Math.random = randomBackupRef.current;
  };

  useEffect(() => {
    // ✅ 게임 시작 전(0일차)에만 시드를 적용해 랜덤 재현성을 확보합니다.
    if (!runSeed) return;
    if (isAdvancing || isGameOver) return;
    if (day !== 0 || matchSec !== 0) return;
    applyRunSeed(runSeed);
  }, [runSeed, day, matchSec, isAdvancing, isGameOver]);

  useEffect(() => () => restoreRandom(), []);

  function getForbiddenZoneIdsForPhase(mapObj, dayNum, phaseKey) {
    return getForbiddenZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef.current);
  }

  function getForbiddenAddedZoneIdsForPhase(mapObj, dayNum, phaseKey) {
    return getForbiddenAddedZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef.current);
  };
  const itemNameById = useSafeMemo('itemNameById', () => {
    return buildItemNameById(publicItems);
  }, [publicItems], {});

  const itemMetaById = useSafeMemo('itemMetaById', () => {
    return buildItemMetaById(publicItems);
  }, [publicItems], {});

  const itemKeyById = useSafeMemo('itemKeyById', () => {
    return buildItemKeyById(publicItems);
  }, [publicItems], {});

  const craftables = useSafeMemo('craftables', () => {
    return buildCraftableItems(publicItems);
  }, [publicItems], []);

  const inventoryOptions = useSafeMemo('inventoryOptions', () => {
    return buildInventoryOptions(selectedChar);
  }, [selectedChar], []);

  const devGrantItemOptions = useSafeMemo('devGrantItemOptions', () => {
    return buildDevGrantItemOptions(publicItems);
  }, [publicItems], []);

  const visibleDevGrantItemOptions = useSafeMemo('visibleDevGrantItemOptions', () => {
    return filterVisibleDevGrantItemOptions(devGrantItemOptions, devGrantSearch, devGrantItemId);
  }, [devGrantItemOptions, devGrantSearch, devGrantItemId], []);

  const selectedDevGrantItem = useSafeMemo('selectedDevGrantItem', () => {
    return getSelectedDevGrantItem(devGrantItemOptions, devGrantItemId);
  }, [devGrantItemOptions, devGrantItemId], null);

  const tradeWantItemOptions = useSafeMemo('tradeWantItemOptions', () => {
    return buildTradeWantItemOptions(publicItems, tradeWantSearch, tradeDraft?.want, DEV_SELECT_RENDER_LIMIT);
  }, [publicItems, tradeWantSearch, tradeDraft?.want], []);

  const visibleCraftables = useSafeMemo('visibleCraftables', () => {
    return limitVisibleRows(craftables, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [craftables, showAllMarketRows], []);

  const visibleKiosks = useSafeMemo('visibleKiosks', () => {
    return limitVisibleRows(kiosks, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [kiosks, showAllMarketRows], []);

  const visibleDroneOffers = useSafeMemo('visibleDroneOffers', () => {
    return limitVisibleRows(droneOffers, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [droneOffers, showAllMarketRows], []);

  const visiblePublicPerks = useSafeMemo('visiblePublicPerks', () => {
    return limitVisibleRows(publicPerks, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [publicPerks, showAllMarketRows], []);

  const visibleTradeOffers = useSafeMemo('visibleTradeOffers', () => {
    return limitVisibleRows(tradeOffers, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [tradeOffers, showAllMarketRows], []);

  const visibleMyTradeOffers = useSafeMemo('visibleMyTradeOffers', () => {
    return limitVisibleRows(myTradeOffers, showAllMarketRows, MARKET_CARD_RENDER_LIMIT);
  }, [myTradeOffers, showAllMarketRows], []);

  const runEventsPreviewText = useSafeMemo('runEventsPreviewText', () => {
    if (!showDevEventLog) return '';
    return JSON.stringify((Array.isArray(runEvents) ? runEvents : []).slice(-DEV_EVENT_PREVIEW_LIMIT), null, 2);
  }, [runEvents, showDevEventLog], '');

  useEffect(() => {
    setShowAllMarketRows(false);
  }, [marketTab, showMarketPanel]);

  function getQty(key, fallback = 1) {
    const v = Number(qtyMap[key]);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.floor(v);
  };

  function setQty(key, v) {
    setQtyMap((prev) => ({ ...prev, [key]: v }));
  };

  function patchServerCharacterState(serverCharacter) {
    if (!serverCharacter?._id) return;
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => (
      String(s?._id) === String(serverCharacter?._id)
        ? (() => {
          const merged = mergeServerCharacterIntoRuntimeSurvivor(s, serverCharacter);
          autoEquipBest(merged, itemMetaById);
          return normalizeRuntimeSurvivor(merged);
        })()
        : normalizeRuntimeSurvivor(s)
    )));
  };

  async function syncMyState() {
    try {
      const [me, chars] = await Promise.all([
        apiGet('/user/me'),
        apiGet('/characters?view=simulation'),
      ]);
      applyUserEconomyProgress({
        credits: me?.credits,
        lp: me?.lp,
        perks: Array.isArray(me?.perks) ? me.perks : undefined,
      });
      const list = Array.isArray(chars) ? chars : [];
      setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => {
        const found = list.find((c) => String(c?._id) === String(s?._id));
        if (!found) return normalizeRuntimeSurvivor(s);
        const merged = mergeServerCharacterIntoRuntimeSurvivor(s, found);
        autoEquipBest(merged, itemMetaById);
        return normalizeRuntimeSurvivor(merged);
      }));
    } catch (e) {
      // 동기화 실패는 치명적이지 않음
      console.error(e);
    }
  };

  function applyUserEconomyProgress(patch = {}) {
    const hasCredits = Number.isFinite(Number(patch?.credits));
    const hasLp = Number.isFinite(Number(patch?.lp));
    const hasPerks = Array.isArray(patch?.perks);

    if (hasCredits) setCredits(Math.max(0, Number(patch.credits || 0)));
    if (hasLp) setViewerLp(Math.max(0, Number(patch.lp || 0)));
    if (hasPerks) setViewerPerks((patch.perks || []).map((x) => String(x || '')).filter(Boolean));

    updateStoredUser((currentUser) => ({
      ...(currentUser || {}),
      ...(hasCredits ? { credits: Math.max(0, Number(patch.credits || 0)) } : {}),
      ...(hasLp ? { lp: Math.max(0, Number(patch.lp || 0)) } : {}),
      ...(hasPerks ? { perks: (patch.perks || []).map((x) => String(x || '')).filter(Boolean) } : {}),
    }));
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewerProgress = () => {
      const u = getUser();
      setViewerLp(Math.max(0, Number(u?.lp || 0)));
      setViewerPerks(Array.isArray(u?.perks) ? u.perks.map((x) => String(x || '')).filter(Boolean) : []);
      if (Number.isFinite(Number(u?.credits))) setCredits(Math.max(0, Number(u.credits || 0)));
    };
    syncViewerProgress();
    window.addEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
  }, []);

  const ownedPerkCodeSet = useSafeMemo('ownedPerkCodeSet', () => new Set((Array.isArray(viewerPerks) ? viewerPerks : []).map((x) => String(x || ''))), [viewerPerks], new Set());
  const activeViewerPerkBundle = useSafeMemo('activeViewerPerkBundle', () => buildPerkRuntimeBundle(viewerPerks, publicPerks), [viewerPerks, publicPerks], buildPerkRuntimeBundle([], []));

  useEffect(() => {
    if (!Array.isArray(survivors) || survivors.length <= 0) return;
    setSurvivors((prev) => normalizeRuntimeSurvivorList((Array.isArray(prev) ? prev : []).map((s) => applyPerkBundleToActor({ ...s }, activeViewerPerkBundle, { applyCredits: true }))));
    setDead((prev) => normalizeRuntimeSurvivorList((Array.isArray(prev) ? prev : []).map((s) => applyPerkBundleToActor({ ...s }, activeViewerPerkBundle, { applyCredits: false }))));
  }, [activeViewerPerkBundle]);

  async function loadMarket() {
    try {
      setMarketMessage('');
      const result = await loadMarketData();
      setPublicItems(result.publicItems);
      setKiosks(result.kiosks);
      setDroneOffers(result.droneOffers);
      setPublicPerks(result.publicPerks);
      if (result.failedLabels.length) setMarketMessage(`${result.failedLabels.join(', ')} 로드 실패`);
    } catch (e) {
      setMarketMessage(getApiErrorMessage(e));
    }
  };

  async function loadTrades() {
    try {
      setMarketMessage('');
      const result = await loadTradeData();
      setTradeOffers(result.tradeOffers);
      setMyTradeOffers(result.myTradeOffers);
      if (result.failedLabels.length) setMarketMessage(`${result.failedLabels.join(', ')} 로드 실패`);
    } catch (e) {
      setMarketMessage(getApiErrorMessage(e));
    }
  };

  // 초기 데이터 로드 (캐릭터 + 이벤트 + 설정 + 상점 데이터)
  useEffect(() => {
    const token = getToken();
    const me = getUser();
    if (!token || !me?.username) {
      redirectToLogin('로그인 정보가 없거나 만료되었습니다. 다시 로그인해주세요.', true);
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        void apiGet('/public/ping', { timeoutMs: SIM_INIT_PING_TIMEOUT_MS })
          .catch((pingErr) => {
            console.warn('[simulation:initPing]', pingErr);
          });

        const itemsLoadPromise = apiGetCached('/public/items', { ttlMs: 60000, timeoutMs: SIM_INIT_HEAVY_TIMEOUT_MS });
        const [criticalResults, quickItemsRes] = await Promise.all([
          Promise.allSettled([
            apiGetCached('/characters?view=simulation', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/settings', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/user/me', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/public/maps', { ttlMs: 60000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/public/perks', { ttlMs: 60000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
          ]),
          settleWithin(itemsLoadPromise, SIM_INIT_ITEMS_GRACE_MS),
        ]);
        const [charRes, settingRes, meRes, mapsRes, perksRes] = criticalResults;

        const authRejected = [charRes, settingRes, meRes, mapsRes, perksRes].some((result) => {
          const status = Number(result?.reason?.response?.status || result?.reason?.status || 0);
          return result?.status === 'rejected' && (status === 401 || status === 403);
        });
        if (authRejected) {
          redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.', true);
          return;
        }

        const charList = getSettledArray(charRes);
        const settingValue = getSettledValue(settingRes, {});
        const meValue = getSettledValue(meRes, {});
        const mapsList = getSettledArray(mapsRes);
        const itemsValue = getSettledArray(quickItemsRes);
        const perksValue = getSettledArray(perksRes);

        const initFailed = getRejectedLabels([
          ['캐릭터', charRes],
          ['설정', settingRes],
          ['유저 정보', meRes],
          ['맵', mapsRes],
          ['특전', perksRes],
        ]);
        if (initFailed.length) {
          addLog(`⚠️ 초기 데이터 일부 로드 실패: ${initFailed.join(', ')}. 가능한 기본값으로 계속합니다.`, 'system');
        }
        if (!charList.length) {
          addLog('⚠️ 캐릭터 목록이 비어 있습니다. 캐릭터 설정을 확인해주세요.', 'system');
        }
        if (!mapsList.length) {
          addLog('⚠️ 맵 데이터를 불러오지 못했습니다. 임시 기본 구역으로 대기합니다.', 'system');
        }

        const itemsList = Array.isArray(itemsValue) ? itemsValue : [];
        const perksList = Array.isArray(perksValue) ? perksValue : [];

        const loadDeferredInitData = () => {
          void Promise.allSettled([
            apiGetCached('/events', { ttlMs: 15000, timeoutMs: 20000 }),
            apiGetCached('/public/kiosks', { ttlMs: 60000, timeoutMs: 20000 }),
            apiGetCached('/public/drone-offers', { ttlMs: 60000, timeoutMs: 20000 }),
            apiGet('/trades', { timeoutMs: 20000 }),
            apiGet('/trades?mine=true', { timeoutMs: 20000 }),
          ]).then(([eventRes, kiosksRes, droneRes, openTrades, mineTrades]) => {
            setEvents(getSettledArray(eventRes));
            setKiosks(getSettledArray(kiosksRes));
            setDroneOffers(getSettledArray(droneRes));
            setTradeOffers(getSettledArray(openTrades));
            setMyTradeOffers(getSettledArray(mineTrades));

            const failed = getRejectedLabels([
              ['이벤트', eventRes],
              ['키오스크', kiosksRes],
              ['드론 판매', droneRes],
              ['오픈 오퍼', openTrades],
              ['내 오퍼', mineTrades],
            ]);
            if (failed.length) setMarketMessage(`${failed.join(', ')} 로드 실패`);
          }).catch((err) => {
            console.error('[simulation:deferredData]', err);
            setMarketMessage(getApiErrorMessage(err, '보조 데이터 로드 실패'));
          });
        };

        const storedMatchMode = (() => {
          try {
            return window.localStorage.getItem('eh_sim_match_mode');
          } catch {
            return '';
          }
        })();
        const storedCharacterSkills = (() => {
          try {
            return window.localStorage.getItem('eh_sim_character_skills');
          } catch {
            return '';
          }
        })();
        const storedCharacterSkillSettings = storedCharacterSkills === '0' || storedCharacterSkills === '1'
          ? {
              skills: {
                ...(settingValue?.skills || {}),
                enabled: storedCharacterSkills === '1',
                characterSkills: storedCharacterSkills === '1',
                aiUseSkills: storedCharacterSkills === '1',
              },
            }
          : {};
        const loadedSettings = {
          ...(settings || {}),
          ...(settingValue || {}),
          ...storedCharacterSkillSettings,
          matchMode: normalizeMatchMode(storedMatchMode || settingValue?.matchMode || settings?.matchMode),
        };
        setSettings(loadedSettings);
        setPublicPerks(perksList);
        applyUserEconomyProgress({
          credits: meValue?.credits,
          lp: meValue?.lp,
          perks: Array.isArray(meValue?.perks) ? meValue.perks : undefined,
        });

        mapsRef.current = mapsList;
        setMaps(mapsList);
// ✅ 시뮬레이션은 "플레이어가 맵을 선택"하지 않습니다.
// 등록된 맵 중 첫 번째 맵을 시작점으로 사용합니다. (이동/진행 로직은 런타임에서 처리)
const initialMapId = (mapsList[0]?._id ? String(mapsList[0]._id) : '');
if (initialMapId) {
  activeMapIdRef.current = initialMapId;
  setActiveMapId(initialMapId);
}

        const initialMap = mapsList.find((m) => String(m?._id) === String(initialMapId)) || null;
        activeMapRef.current = initialMap;
        const initialZoneIds = (Array.isArray(initialMap?.zones) && initialMap.zones.length)
          ? initialMap.zones.map((z) => String(z.zoneId))
          : ['__default__'];

        // 🎮 룰 프리셋에 따라 생존자 런타임 상태를 초기화
        const ruleset = getRuleset(loadedSettings?.rulesetId);
        const det = ruleset?.detonation;
        const energy = ruleset?.gadgetEnergy;

// 🎒 추천 상급 장비(또는 역할)에 맞춰 시작 구역을 가중치 랜덤으로 선택
const pickStartZoneIdForChar = (c) => {
  try {
    const zonesArr = Array.isArray(initialMap?.zones) ? initialMap.zones : [];
    const fallbackPool = Array.isArray(initialZoneIds) && initialZoneIds.length ? initialZoneIds : ['__default__'];
    const fallback = () => fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    if (!zonesArr.length) return fallback();

    const texts = [];
    function addText(v) {
      if (v === null || v === undefined) return;
      const s = String(v).trim();
      if (s) texts.push(s.toLowerCase());
    };

    function addFromList(arr) {
      if (!Array.isArray(arr)) return;
      arr.forEach((g) => {
        if (!g) return;
        if (typeof g === 'string') {
          addText(g);
          return;
        }
        addText(g.name);
        addText(g.kind);
        addText(g.category);
        addText(g.type);
        if (Array.isArray(g.tags)) g.tags.forEach(addText);
      });
    };

    addFromList(c?.recommendedHighGear);
    addFromList(c?.recommendedAdvancedGear);
    addFromList(c?.recommendedGear);
    addFromList(c?.advancedGear);

    const st = normalizeErStats(c?.stats || c?.stat || c);
    const keys = ER_STAT_KEYS;
    const ranked = keys.map((k) => [k, Number(st?.[k] ?? st?.[k.toUpperCase()] ?? 0)]);
    ranked.sort((a, b) => b[1] - a[1]);
    const top = ranked[0]?.[0];
    if (top) addText(top);

    const keywordMap = {
      keyboard: ['keyboard', '키보드', '키보'],
      mouse: ['mouse', '마우스'],
      monitor: ['monitor', '모니터'],
      weapon: ['weapon', '무기', 'armory', '병기'],
      armor: ['armor', '방어구', '갑옷'],
      food: ['food', '음식', '식당', '편의'],
      attackPower: ['attack', '공격', '무기', 'weapon', 'melee', 'shoot', 'gun'],
      skillAmp: ['skill', '스킬', '증폭', 'lab', '연구'],
      defense: ['defense', '방어', 'armor'],
      attackSpeed: ['speed', '공속', '기동'],
      attackRange: ['range', '사거리', '원거리'],
      sightRange: ['vision', '시야', '정찰'],
    };

    const expanded = new Set();
    texts.forEach((t) => {
      expanded.add(t);
      Object.entries(keywordMap).forEach(([k, syns]) => {
        const hit = t.includes(k) || syns.some((s) => t.includes(String(s).toLowerCase()));
        if (hit) syns.forEach((s) => expanded.add(String(s).toLowerCase()));
      });
    });

    const hints = [...expanded].filter(Boolean);
    if (!hints.length) return fallback();

    const candidates = [];
    for (const zone of zonesArr) {
      const name = String(zone?.name || '').toLowerCase();
      const tags = Array.isArray(zone?.tags) ? zone.tags.map((x) => String(x).toLowerCase()) : [];
      if (hints.some((h) => name.includes(h) || tags.includes(h))) {
        candidates.push(String(zone?.zoneId || ''));
      }
    }

    const pool = candidates.filter(Boolean).length ? candidates.filter(Boolean) : fallbackPool;
    return pool[Math.floor(Math.random() * pool.length)] || fallback();
  } catch (err) {
    console.error('[simulation:pickStartZoneIdForChar]', err);
    return String(initialZoneIds?.[0] || '__default__');
  }
};
        const emptyRoutePlan = {
          zoneIds: [],
          itemIdsByZone: {},
          targetItemIds: [],
          requiredItemIds: [],
          requiredQtyById: {},
          droneItemIds: [],
          targetNamesBySlot: {},
          source: '',
        };

        const buildFastRoutePlanForActor = (actor, routeItems) => {
          if (!Array.isArray(routeItems) || !routeItems.length) return emptyRoutePlan;
          try {
            const day1HeroRoutePlan = buildDay1HeroRoutePlanDetails(actor, initialMap, routeItems, {
              routeLength: 2,
              droneFallbackLimit: 1,
              candidateLimit: 6,
              beamLimit: 48,
              maxRoutes: 96,
            });
            if (day1HeroRoutePlan?.complete) return day1HeroRoutePlan;
            return buildEarlyRoutePlanDetails(actor, initialMap, routeItems, { routeLength: 4 }) || emptyRoutePlan;
          } catch (routeErr) {
            console.error('[simulation:initRoutePlan]', routeErr);
            return emptyRoutePlan;
          }
        };

        const mergeRoutePlanFields = (actor, routePlan, sourceFallback = 'fast_start') => {
          const plan = routePlan || emptyRoutePlan;
          const routePlanZoneIds = Array.isArray(plan.zoneIds) ? plan.zoneIds : [];
          return normalizeRuntimeSurvivor({
            ...actor,
            routePlanZoneIds,
            routePlanItemIdsByZone: plan.itemIdsByZone || {},
            routePlanTargetItemIds: Array.isArray(plan.targetItemIds) ? plan.targetItemIds : [],
            routePlanRequiredItemIds: Array.isArray(plan.requiredItemIds) ? plan.requiredItemIds : [],
            routePlanRequiredQtyById: plan.requiredQtyById || {},
            routePlanDroneItemIds: Array.isArray(plan.droneItemIds) ? plan.droneItemIds : [],
            routePlanTargetNamesBySlot: plan.targetNamesBySlot || {},
            routePlanSource: plan.source || (routePlanZoneIds.length ? 'recipe' : sourceFallback),
          });
        };

        const applyLoadedItemsToRuntime = (loadedItems, reason = 'background') => {
          const nextItems = Array.isArray(loadedItems) ? loadedItems : [];
          if (!nextItems.length) return false;
          setPublicItems(nextItems);
          const enrichList = (list) => normalizeRuntimeSurvivorList((Array.isArray(list) ? list : []).map((actor) => {
            const routeSource = String(actor?.routePlanSource || '');
            const alreadyRouted = routeSource && routeSource !== 'fast_start';
            const routeStarted = Math.max(0, Number(actor?.routePlanIndex || 0)) > 0 || actor?.day1HeroDone;
            if (alreadyRouted || routeStarted) return actor;
            const routePlan = buildFastRoutePlanForActor(actor, nextItems);
            if (!Array.isArray(routePlan?.zoneIds) || !routePlan.zoneIds.length) return actor;
            return mergeRoutePlanFields(actor, routePlan, routeSource || 'fast_start');
          }));
          setCandidateSurvivors((prev) => enrichList(prev));
          setSurvivors((prev) => enrichList(prev));
          if (reason === 'background') {
            addLog(`📦 아이템 데이터 로드 완료: ${nextItems.length}개. 참가자 루트 파밍을 보강했습니다.`, 'system');
          }
          return true;
        };
        const initPerkBundle = buildPerkRuntimeBundle(Array.isArray(meValue?.perks) ? meValue.perks : [], perksList);

        const charsWithHp = [];
        (Array.isArray(charList) ? charList : []).forEach((c) => {
          const erSeed = applyErSubjectPreset(c, {
            replaceDefaultTactical: false,
            statBiasScale: Number(ruleset?.ai?.erPresetStatScale ?? 1),
          });
          const routePlan = buildFastRoutePlanForActor(erSeed, itemsList);
          const routePlanZoneIds = routePlan.zoneIds;
          const startZoneId = routePlanZoneIds[0] || pickStartZoneIdForChar(erSeed);
          const seedStats = normalizeErStats(erSeed?.stats);
          const seedMaxHp = Math.max(1, Math.round(Number(seedStats.maxHp || 100)));
          const seededBase = mergeRoutePlanFields({
            ...erSeed,
            stats: seedStats,
            level: 1,
            erLevel: 1,
            masteryXp: 0,
            mastery: createInitialMasteryState(),
            weaponMasteryXp: 0,
            weaponMasteryLevel: 1,
            tacticalSkillLevel: Math.max(1, Math.min(2, Number(erSeed?.tacticalSkillLevel || 1))),
            hp: seedMaxHp,
            maxHp: seedMaxHp,
            zoneId: startZoneId,
            equipped: ensureEquipped(erSeed),
            day1Moves: 0,
            day1HeroDone: false,
            routePlanSearchCounts: {},
            routePlanIndex: 0,
            simCredits: Number(ruleset?.credits?.start ?? 15),
            droneLastOrderIndex: -9999,
            droneLastOrderAbsSec: -99999,
            kioskLastInteractAbsSec: -99999,
            detonationSec: det ? det.startSec : null,
            detonationMaxSec: det ? det.maxSec : null,
            gadgetEnergy: energy ? energy.start : 0,
            cooldowns: {
              portableSafeZone: 0,
              cnotGate: 0,
              weaponSkill: 0,
            },
            safeZoneUntil: 0,
          }, routePlan, 'fast_start');
          const seeded = applyPerkBundleToActor(seededBase, initPerkBundle, { initialFill: true, applyCredits: true });
          charsWithHp.push(seeded);
        });
        const candidateChars = normalizeRuntimeSurvivorList(charsWithHp);
        const selectedChars = pickParticipantsForRun(candidateChars, participantPresets, selectedParticipantPresetId, loadedSettings);
        const shuffledChars = applyMatchTeams(selectedChars, loadedSettings);
        setCandidateSurvivors(candidateChars);
        setSurvivors(shuffledChars);
        setEvents([]);

        // 킬 카운트 초기화
        const initialKills = {};
        shuffledChars.forEach((c) => {
          initialKills[c._id] = 0;
        });
        setKillCounts(initialKills);

        // 어시스트 카운트 초기화
        const initialAssists = {};
        const shouldTrackAssists = getMatchConfig(loadedSettings).matchMode !== 'solo';
        shuffledChars.forEach((c) => {
          if (shouldTrackAssists) initialAssists[c._id] = 0;
        });
        setAssistCounts(initialAssists);

        const initialCredits = Number(meValue?.credits || 0);
        setCredits(initialCredits);
        updateStoredUser((currentUser) => ({ ...currentUser, credits: initialCredits }));
        setPublicItems(itemsList);
        setPublicPerks(perksList);
        setKiosks([]);
        setDroneOffers([]);
        setTradeOffers([]);
        setMyTradeOffers([]);

        // 경기 시간도 초기화
        setMatchSec(0);
        setPrevPhaseLogs([]);
        setIsGameOver(false);
        setWinner(null);
        setGameEndReason(null);
        setResultSummary(null);
        setShowResultModal(false);

        addLog('📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.', 'system');
        loadDeferredInitData();
        if (quickItemsRes?.status === 'timeout') {
          addLog('⏳ 아이템 데이터 로드가 늦어져 기본 배치로 먼저 준비했습니다. 도착하면 루트 파밍을 자동 보강합니다.', 'system');
          itemsLoadPromise
            .then((loadedItems) => {
              applyLoadedItemsToRuntime(loadedItems, 'background');
            })
            .catch((itemsErr) => {
              console.warn('[simulation:initItems.background]', itemsErr);
              addLog(`⚠️ 아이템 데이터 백그라운드 로드 실패: ${getApiErrorMessage(itemsErr)}`, 'system');
            });
        } else if (quickItemsRes?.status === 'rejected') {
          const itemErr = quickItemsRes.reason;
          console.warn('[simulation:initItems.quick]', itemErr);
          addLog(`⚠️ 아이템 데이터 로드 실패: ${getApiErrorMessage(itemErr)}. 기본 배치로 계속합니다.`, 'system');
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        const status = Number(err?.response?.status || 0);
        if (status === 401 || status === 403) {
          redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.', true);
          return;
        }
        addLog(formatInitLoadError(err), 'death');
      } finally {
        setLoading(false);
      }
    };

    void fetchData().catch((err) => {
      console.error('[simulation:fetchData.unhandled]', err);
      addLog(formatInitLoadError(err), 'death');
      setLoading(false);
    });
  }, []);

  // 최신 킬 정보 전달
  async function finishGame(finalSurvivors, latestKillCounts, latestAssistCounts, options = {}) {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    // 게임 종료 시 오토 플레이는 자동으로 해제
    setAutoPlay(false);
    const finalKills = latestKillCounts || killCounts;
    const finalAssists = latestAssistCounts || assistCounts;
    const finalAlive = Array.isArray(finalSurvivors) ? finalSurvivors : [];
    const finalDead = Array.isArray(options?.finalDead) ? options.finalDead : dead;
    const winningTeam = getWinningTeam(finalAlive, finalKills, finalAssists);
    const w = winningTeam?.representative || finalAlive[0];
    const participants = dedupeRuntimeParticipants([
      ...finalAlive,
      ...(Array.isArray(finalDead) ? finalDead : []),
    ]);
    const matchCfgForResult = getMatchConfig(settings);
    const totalTeamCount = new Set(
      participants.map((p) => String(p?.teamId || p?.matchTeamId || p?._id || p?.id || '').trim()).filter(Boolean)
    ).size;

    const wId = getRuntimeActorKey(w);
    const myKills = wId ? Number(finalKills[wId] || 0) : 0;
    const myAssists = wId ? Number(finalAssists[wId] || 0) : 0;
    const rewardLP = w ? (100 + myKills * 10) : 0;
    const topKillLeader = [...participants]
      .sort((a, b) => {
        const aId = getRuntimeActorKey(a);
        const bId = getRuntimeActorKey(b);
        return (Number(finalKills?.[bId] || 0) - Number(finalKills?.[aId] || 0)) ||
          (Number(finalAssists?.[bId] || 0) - Number(finalAssists?.[aId] || 0));
      })[0] || null;
    const winnerTeamAliveCount = winningTeam ? Math.max(0, Number(winningTeam?.aliveCount || winningTeam?.members?.length || 0)) : 0;
    const winnerTeamOriginalSize = winningTeam ? Math.max(winnerTeamAliveCount, Number(winningTeam?.originalSize || winnerTeamAliveCount || 1)) : 0;
    const winnerTeamMissingCount = Math.max(0, winnerTeamOriginalSize - winnerTeamAliveCount);
    const winnerTeamRosterNames = Array.isArray(winningTeam?.rosterNames) && winningTeam.rosterNames.length
      ? winningTeam.rosterNames
      : participants
        .filter((p) => winningTeam?.teamId && getActorTeamId(p) === winningTeam.teamId)
        .map((p) => String(p?.name || '').trim())
        .filter(Boolean);

    setWinner(w);
    setIsGameOver(true);
    setShowResultModal(true);
    setResultSummary({
      rewardLP,
      myKills,
      myAssists,
      participantsCount: participants.length,
      saveStatus: { hallOfFame: w ? 'pending' : 'skipped', userStats: 'pending' },
      userProgress: null,
      matchMode: matchCfgForResult.matchMode,
      teamSize: matchCfgForResult.teamSize,
      maxTeams: matchCfgForResult.maxTeams,
      teamCount: totalTeamCount,
      aliveTeamCount: getAliveTeams(finalAlive).length,
      winnerTeam: winningTeam
        ? {
            teamId: winningTeam.teamId,
            teamName: winningTeam.teamName,
            aliveCount: winnerTeamAliveCount,
            originalSize: winnerTeamOriginalSize,
            missingCount: winnerTeamMissingCount,
            capacity: Number(winningTeam?.capacity || matchCfgForResult.teamSize || winnerTeamOriginalSize || 1),
            rosterNames: winnerTeamRosterNames,
            members: winningTeam.members.map((m) => ({
              id: getRuntimeActorKey(m),
              name: m?.name,
              hp: Number(m?.hp || 0),
              teamSlot: Number(m?.matchTeamSlot || m?.teamSlot || 0),
            })),
          }
        : null,
      topKillLeader: topKillLeader
        ? {
            id: getRuntimeActorKey(topKillLeader),
            name: topKillLeader.name,
            kills: Number(finalKills?.[getRuntimeActorKey(topKillLeader)] || 0),
            assists: Number(finalAssists?.[getRuntimeActorKey(topKillLeader)] || 0),
          }
        : null,
    });

    if (w) {
      const matchModeNow = normalizeMatchMode(settings?.matchMode);
      addLog(
        matchModeNow === 'solo'
          ? `🏆 게임 종료! 최후의 생존자: [${w.name}]`
          : `🏆 게임 종료! 최후의 팀: ${winningTeam?.teamName || getActorTeamName(w)} (생존 ${winnerTeamAliveCount}/${winnerTeamOriginalSize}) / 대표 생존자: [${w.name}]`,
        'highlight'
      );
    }
    else addLog('💀 생존자가 아무도 없습니다...', 'death');


    // (3) 로컬 백업(캐릭터별: 내 명예의 전당)
    try {
      const me = getUser();
      const username = me?.username || me?.id || 'guest';
      saveLocalHallOfFameBackup(w, finalKills, finalAssists, participants);

      // legacy(플레이어 단위) 기록을 1회만 캐릭터로 이관
      if (w) {
        writeHallOfFameState({ username }, (current) => {
          const state = { ...(current || {}), chars: { ...(current?.chars || {}) } };
          if (state._migratedFromPlayerV1) return state;
          try {
            const legacyRaw = localStorage.getItem(LEGACY_HOF_KEY);
            const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
            const legacyWins = Number(legacy?.wins?.[username] || 0);
            const legacyKills = Number(legacy?.kills?.[username] || 0);
            if (legacyWins > 0 || legacyKills > 0) {
              const wid = String(w?._id ?? w?.id ?? '');
              if (wid) {
                const entry = state.chars[wid] || { name: w?.name || wid, wins: 0, kills: 0, assists: 0 };
                entry.wins = Number(entry.wins || 0) + legacyWins;
                entry.kills = Number(entry.kills || 0) + legacyKills;
                state.chars[wid] = entry;
              }
            }
          } catch {}
          state._migratedFromPlayerV1 = true;
          return state;
        }, { migratedLegacy: true });
      }

      if (w) {
        const raw = localStorage.getItem(LEGACY_HOF_KEY);
        const data = raw ? JSON.parse(raw) : { wins: {}, kills: {} };
        if (!data.wins) data.wins = {};
        if (!data.kills) data.kills = {};
        const wKey = String(w?._id ?? w?.id ?? '');
        const kills = Number(finalKills?.[wKey] || 0);
        data.wins[username] = Number(data.wins[username] || 0) + 1;
        data.kills[username] = Number(data.kills[username] || 0) + kills;
        localStorage.setItem(LEGACY_HOF_KEY, JSON.stringify(data));
      }
      emitHallOfFameSync({ username }, { reason: 'finishGame' });
    } catch (e) {
      console.error('hall of fame sync failed', e);
    }

    // 서버 저장
    try {
      if (w) {
        const compactParticipants = participants.map((p) => {
          const id = getRuntimeActorKey(p);
          return {
            _id: id,
            id,
            charId: id,
            name: String(p?.name || p?.nickname || p?.charName || id || 'Unknown'),
          };
        });
        const compactFullLogs = (Array.isArray(fullLogsRef.current) ? fullLogsRef.current : [])
          .slice(-350)
          .map((line) => String(line || '').slice(0, 600));
        await apiPost('/game/end', {
          winnerId: wId,
          killCounts: finalKills,
          fullLogs: compactFullLogs,
          participants: compactParticipants,
        });
        addLog('✅ 명예의 전당 저장 완료', 'system');
        setResultSummary((prev) => ({
          ...(prev || {}),
          saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'success' },
        }));
      }
    } catch (e) {
      console.error(e);
      addLog('⚠️ 명예의 전당 저장 실패', 'death');
      setResultSummary((prev) => ({
        ...(prev || {}),
        saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'error' },
      }));
    }

    try {
      const res = await apiPost('/user/update-stats', {
        kills: myKills,
        isWin: Boolean(w),
        lpEarned: rewardLP,
      });

      if (typeof res?.credits === 'number') setCredits(res.credits);

      if (res?.user && typeof res.user === 'object') {
        updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, res.user));
      } else if (typeof res?.newLp === 'number' || typeof res?.credits === 'number' || res?.statistics) {
        updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, {
          lp: typeof res?.newLp === 'number' ? res.newLp : currentUser?.lp,
          credits: typeof res?.credits === 'number' ? res.credits : currentUser?.credits,
          statistics: res?.statistics || currentUser?.statistics,
        }));
      }

      setResultSummary((prev) => ({
        ...(prev || {}),
        rewardLP: typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : (prev?.rewardLP ?? rewardLP),
        userProgress: {
          lp: typeof res?.newLp === 'number' ? res.newLp : Number(res?.user?.lp || 0),
          credits: typeof res?.credits === 'number' ? res.credits : Number(res?.user?.credits || 0),
          statistics: normalizeUserStatistics(res?.statistics || res?.user?.statistics),
        },
        saveStatus: { ...(prev?.saveStatus || {}), userStats: 'success' },
      }));

      addLog(
        `💾 [전적 저장 완료] ${Boolean(w) ? `LP +${typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : rewardLP} 획득! ` : ''}(현재 총 LP: ${res?.newLp ?? res?.user?.lp ?? '?'})`,
        'system'
      );
    } catch (e) {
      addLog(`⚠️ 전적 저장 실패: ${e?.response?.data?.error || '서버 오류'}`, 'death');
      setResultSummary((prev) => ({
        ...(prev || {}),
        saveStatus: { ...(prev?.saveStatus || {}), userStats: 'error' },
      }));
    }
  };

  // --- [핵심] 진행 로직 ---
  async function proceedPhase() {
    // ✅ 다음 페이즈로 넘어갈 때, 이전/현재 페이즈 UI 로그는 초기화
    setPrevPhaseLogs([]);
    setShowPrevLogs(false);
    setLogs(() => []);
    logSeqRef.current = 0;
    setLogBoxMaxH(180);

    // 1. 페이즈 및 날짜 변경
    let nextPhase = phase === 'morning' ? 'night' : 'morning';
    let nextDay = day;
    if (phase === 'night') nextDay++;

    // 🎮 룰 프리셋 (기본: ER_S11)
    const ruleset = getRuleset(settings?.rulesetId);

    // 서든데스(6번째 밤 이후): 페이즈 고정 + 전 지역 금지 + 카운트다운
    const sdCfg = ruleset?.suddenDeath || {};
    const sdTotalSec = Math.max(10, Number(sdCfg.totalSec ?? sdCfg.durationSec ?? 180));
    const shouldActivateSuddenDeath = !suddenDeathActiveRef.current && nextDay === 6 && nextPhase === 'night';
    if (shouldActivateSuddenDeath) {
      // 최초 발동: 6번째 밤 이후 진행을 시도할 때
      if (!suddenDeathActiveRef.current) {
        suddenDeathActiveRef.current = true;
        if (typeof suddenDeathEndAtSecRef.current !== 'number') suddenDeathEndAtSecRef.current = matchSec + sdTotalSec;
        addLog(`=== 서든데스 발동: 최종 안전구역 2곳 제외 전지역 금지 + 카운트다운 ${sdTotalSec}s ===`, 'day-header');
      }
      // 페이즈는 최대 6일차 밤에서 고정
    }
    // 🚫 금지구역 처리 방식: detonation(폭발 타이머) 설정이 있으면 타이머를 사용
    const useDetonation = !!ruleset?.detonation;
    const marketRules = ruleset?.market || {};
    // ⚔️ 전투 세팅: ruleset 기반 상수(장비 보정 등)를 합쳐서 전달
    const battleSettings = {
      ...settings,
      battle: { ...(ruleset?.battle || {}), ...(settings?.battle || {}), equipment: ruleset?.equipment || {} },
      skills: { ...(ruleset?.skills || {}), ...(settings?.skills || {}) },
    };
    const phaseDurationSec = getPhaseDurationSec(ruleset, nextDay, nextPhase);
    const phaseStartSec = matchSec;
    const tickSec = Math.max(1, Math.floor(Number(ruleset?.tickSec || 1)));
    let phaseRuntimeOffsetSec = 0;
    let phaseActionAbsSec = phaseStartSec;
    const currentActionSec = () => Math.max(0, Math.floor(Number(phaseActionAbsSec || phaseStartSec || 0)));
    const atNow = () => ({ day: nextDay, phase: nextPhase, sec: currentActionSec() });
    const reserveActionSecond = (seconds = tickSec) => {
      const offset = Math.max(0, Math.min(phaseDurationSec, Math.floor(Number(phaseRuntimeOffsetSec || 0))));
      phaseActionAbsSec = phaseStartSec + offset;
      phaseRuntimeOffsetSec = Math.min(
        phaseDurationSec,
        offset + Math.max(1, Math.floor(Number(seconds || tickSec || 1)))
      );
      return phaseActionAbsSec;
    };
    const getVisibleTickDelayMs = () => {
      const speed = normalizeAutoSpeed(autoSpeedRef.current || autoSpeed);
      return Math.max(24, Math.round(1000 / speed));
    };
    const commitVisibleClock = async (absSec = phaseStartSec + phaseRuntimeOffsetSec, { wait = true } = {}) => {
      const nextSec = Math.max(
        phaseStartSec,
        Math.min(phaseStartSec + phaseDurationSec, Math.floor(Number(absSec || phaseStartSec)))
      );
      setMatchSec(nextSec);
      if (wait) await waitMs(getVisibleTickDelayMs());
    };
    const reserveVisibleSecond = async (seconds = tickSec) => {
      const actionSec = reserveActionSecond(seconds);
      await commitVisibleClock(phaseStartSec + phaseRuntimeOffsetSec);
      return actionSec;
    };
    const runVisibleClockToPhaseEnd = async () => {
      while (phaseRuntimeOffsetSec < phaseDurationSec) {
        reserveActionSecond(tickSec);
        await commitVisibleClock(phaseStartSec + phaseRuntimeOffsetSec);
      }
    };
    const fogLocalSec = getFogLocalTimeSec(ruleset, nextDay, nextPhase, phaseDurationSec);

    // 🔥 서든데스: 6번째 밤부터는 “마지막 1인 생존”까지 교전이 더 자주 발생하도록 가속합니다.
    // - (기존) 6번째 밤 강제 종료는 제거
    if (!suddenDeathActiveRef.current && nextDay === 6 && nextPhase === 'night') {
      addLog('=== 🔥 서든데스: 6번째 밤 돌입 (교전 빈도 증가) ===', 'day-header');
    }

    // 💰 이번 페이즈 기본 크레딧(시즌 11 컨셉)
    const baseCredits = getNaturalCreditGain(ruleset, nextDay, nextPhase, phaseDurationSec);

    let earnedCredits = baseCredits;

    setDay(nextDay);
    setPhase(nextPhase);
    setTimeOfDay(getTimeOfDayFromPhase(nextPhase));
    addLog(`=== ${worldTimeText(nextDay, nextPhase)} (⏱ ${phaseDurationSec}s) ===`, 'day-header');

    // 서든데스 카운트다운 표시
    if (suddenDeathActiveRef.current && typeof suddenDeathEndAtSecRef.current === 'number') {
      const remain = Math.max(0, Math.ceil(suddenDeathEndAtSecRef.current - matchSec));
      addLog(`서든데스 카운트다운: ${remain}s`, 'system');
    }

    // 현재 페이즈 인덱스(배송/딜레이 처리용)
    const phaseIdxNow = worldPhaseIndex(nextDay, nextPhase);
    const matchCfgNow = getMatchConfig(settings);
    const isSoloMatch = matchCfgNow.matchMode === 'solo';
    const canReviveThisMatch = !isSoloMatch;

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
    const mapIdNow = String(activeMapIdRef.current || activeMapId || '');
    const mapObjRaw = activeMapRef.current || activeMap;
    const mapObjBase = mapObjRaw || ((Array.isArray(zones) && zones.length)
      ? { _id: mapIdNow || 'local', zones }
      : null);
    const mapObj = mapObjBase
      ? { ...mapObjBase, zones: applyRegionDataToZones(Array.isArray(mapObjBase?.zones) ? mapObjBase.zones : zones) }
      : null;
    let forbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset)) : new Set();
    let newlyAddedForbidden = mapObj ? getForbiddenAddedZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset) : [];
    let suddenDeathSafeZoneIds = [];


    // ✅ 서든데스: 전 지역 금지로 0명 생존(무승부) 케이스가 발생할 수 있어, 최종 안전구역 2곳을 남깁니다.
    // - 기본: 소방서/골목길(2번째 이미지 동선 기준)
    if (suddenDeathActiveRef.current && mapObj && Array.isArray(mapObj.zones)) {
      const allZoneIds = mapObj.zones
        .map((z) => String(z?.zoneId ?? z?.id ?? z?._id ?? ''))
        .filter(Boolean);

      const preferred = ['firestation', 'alley'];
      const safePick = preferred.filter((zid) => allZoneIds.includes(zid));
      while (safePick.length < 2 && allZoneIds.length) {
        const cand = allZoneIds[Math.floor(Math.random() * allZoneIds.length)];
        if (!safePick.includes(cand)) safePick.push(cand);
      }
      const safeSet = new Set(safePick);
      suddenDeathSafeZoneIds = safePick.map((zid) => String(zid || '')).filter(Boolean);

      forbiddenIds = new Set(allZoneIds.filter((zid) => !safeSet.has(zid)));

      if (!suddenDeathForbiddenAnnouncedRef.current) {
        newlyAddedForbidden = allZoneIds.filter((zid) => !safeSet.has(zid));
        suddenDeathForbiddenAnnouncedRef.current = true;
      } else {
        newlyAddedForbidden = [];
      }

      addLog(`🟩 최종 안전구역: ${safePick.map((z) => getZoneName(z)).join(', ')}`, 'highlight');
    }

    setForbiddenAddedNow(newlyAddedForbidden);
    const forbiddenNames = [...forbiddenIds].map((zid) => getZoneName(zid)).join(', ');
    const forbiddenAddedNames = newlyAddedForbidden.map((zid) => getZoneName(zid)).join(', ');

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // LEGACY 규칙: 금지구역 체류 시 HP 감소
    const damagePerTick = Number(cfg.damagePerTick ?? 0) || Math.round(nextDay * (settings.forbiddenZoneDamageBase || 1.5));
    // 🧾 금지구역 상태(디버그/재현용): 페이즈 전환마다 1줄로 표준 로그를 남깁니다.
    const totalZones = (Array.isArray(mapObj?.zones) && mapObj.zones.length) ? mapObj.zones.length : (Array.isArray(zones) ? zones.length : 0);
    const safeZones = Math.max(0, totalZones - forbiddenIds.size);
    const fzEnabled = cfg.enabled !== false;
    const fzStartDay = Number(cfg.startDay ?? settings.forbiddenZoneStartDay ?? 2);
    const fzStartPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
    const fzPhaseIdx = nextDay * 2 + (nextPhase === 'night' ? 1 : 0);
    const fzStartIdx = Math.max(0, fzStartDay) * 2 + (fzStartPhase === 'night' ? 1 : 0);
    const fzStateText = (!fzEnabled)
      ? 'OFF'
      : (fzPhaseIdx < fzStartIdx ? `대기(${fzStartDay}일차 ${fzStartPhase === 'night' ? '밤' : '낮'}부터)` : 'ON');
    addLog(`🚫 금지구역 업데이트: +${newlyAddedForbidden.length} · 금지 ${forbiddenIds.size}/${totalZones} · 안전 ${safeZones} · ${fzStateText}`, 'system');


    if (forbiddenIds.size > 0) {
      if (newlyAddedForbidden.length > 0) {
        addLog(`🚫 금지구역 확장: ${forbiddenAddedNames}`, 'highlight');
      }
      if (useDetonation) {
        const startSec = Number(ruleset?.detonation?.startSec || 20);
        const maxSec = Number(ruleset?.detonation?.maxSec || 30);
        addLog(`⚠️ 제한구역: ${forbiddenNames} (폭발 타이머: 기본 ${startSec}s / 최대 ${maxSec}s)`, 'system');
      } else {
        addLog(`⚠️ 금지구역: ${forbiddenNames} (해당 구역 체류 시 HP -${damagePerTick})`, 'system');
      }
    }




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
    // 2-0. 월드 스폰(맵 이벤트): 전설 재료 상자/보스 생성(낮 시작 시 1회)
    const spawnRes = ensureWorldSpawns(spawnState, zones, forbiddenIds, nextDay, nextPhase, mapIdNow, mapObj?.coreSpawnZones, ruleset, {
      matchMode: matchCfgNow.matchMode,
    });
    let nextSpawn = spawnRes.state;
    if (Array.isArray(spawnRes.announcements) && spawnRes.announcements.length) {
      spawnRes.announcements.forEach((m) => addLog(m, 'highlight'));
    }

    // 🧾 월드 스폰 상태(재현/디버그용)
    try {
      const lc = (Array.isArray(nextSpawn?.legendaryCrates) ? nextSpawn.legendaryCrates : []).filter((c) => !c?.opened).length;
      const cores = (Array.isArray(nextSpawn?.coreNodes) ? nextSpawn.coreNodes : []).filter((n) => !n?.picked);
      const meteor = cores.filter((n) => String(n?.kind) === 'meteor').length;
      const lifeTree = cores.filter((n) => String(n?.kind) === 'life_tree').length;
      const b = nextSpawn?.bosses || {};
      const wildlifeTotal = (nextSpawn?.wildlife && typeof nextSpawn.wildlife === 'object')
        ? Object.values(nextSpawn.wildlife).reduce((sum, v) => sum + Math.max(0, Number(v || 0)), 0)
        : 0;
      emitRunEvent('spawn_state', {
        day: nextDay,
        phase: nextPhase,
        legendary: lc,
        transcendCrates: (Array.isArray(nextSpawn?.transcendCrates) ? nextSpawn.transcendCrates : []).filter((c) => !c?.opened).length,
        foodCrates: (Array.isArray(nextSpawn?.foodCrates) ? nextSpawn.foodCrates : []).filter((c) => !c?.opened).length,
        dimensionRifts: listActiveDimensionRifts(nextSpawn).length,
        meteor,
        lifeTree,
        wildlifeTotal,
        alpha: !!b?.alpha?.alive,
        omega: !!b?.omega?.alive,
        weakline: !!b?.weakline?.alive,
      }, atNow());
    } catch {
      // ignore
    }

    // ✅ 관전형: 1일차 낮에는 "기본 장비"만 지급하고, 제작/루팅으로 성장하게 합니다.
    const isFirstDayStarterLoadout = (nextDay === 1 && nextPhase === 'morning' && !startStarterLoadoutAppliedRef.current);
    let phaseSurvivors = isFirstDayStarterLoadout
      ? (Array.isArray(survivors) ? survivors : []).map((s) => {
          const preferredWeaponType = normalizeWeaponType(String(s?.weaponType || '').trim());
          const wType = preferredWeaponType
            ? preferredWeaponType
            : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
          const wTypeNorm = normalizeWeaponType(wType);

          const gear = {
            weapon: pickCatalogEquipmentItem(publicItems, {
              slot: 'weapon',
              tier: 1,
              weaponType: wTypeNorm,
              allowNearestTier: true,
            }),
            shoes: pickCatalogEquipmentItem(publicItems, {
              slot: 'shoes',
              tier: 1,
              allowNearestTier: true,
            }),
          };

          // ✅ 관전형: 시작 시 장비는 최소만 주고, 재료/제작으로 성장
          // - 인벤토리엔 '재료/소모품'만 남기고 장비는 초기화
          let baseInv = Array.isArray(s?.inventory)
            ? s.inventory.filter((x) => String(x?.category || inferItemCategory(x)) !== 'equipment')
            : [];
          baseInv = normalizeInventory(baseInv, ruleset);

          // 1일차 시작에는 제작 재료를 지급하지 않습니다. 장비 완성은 이동 후 루트 파밍/제작으로 진행됩니다.
          let inv = baseInv;

          // 시작 보급 음식은 생존용 1개만 지급합니다.
          const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
          if (steak?._id) {
            inv = addItemToInventory(inv, steak, String(steak._id), 1, nextDay, ruleset);
          }

          // 시작 장비(무기/신발)
          if (gear.weapon?._id) {
            inv = addItemToInventory(inv, gear.weapon, String(gear.weapon._id), 1, nextDay, ruleset);
          }
          if (gear.shoes?._id) {
            inv = addItemToInventory(inv, gear.shoes, String(gear.shoes._id), 1, nextDay, ruleset);
          }

          return {
            ...s,
            day1Moves: 0,
            day1HeroDone: false,
            inventory: inv,
            equipped: {
              ...(ensureEquipped(s) || {}),
              weapon: gear.weapon?._id ? String(gear.weapon._id) : null,
              shoes: gear.shoes?._id ? String(gear.shoes._id) : null,
              head: null,
              clothes: null,
              arm: null,
            },
          };
        })
      : (Array.isArray(survivors) ? survivors : []);

    if (isFirstDayStarterLoadout) {
      startStarterLoadoutAppliedRef.current = true;
      addLog('🧰 1일차 낮: 실제 아이템 목록에서 시작 무기/신발이 지급되었습니다. (관전형: 제작/루팅으로 성장)', 'highlight');
    }


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

    let updatedSurvivors = (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
      .map((s) => {
        const beforeHp = Number(s.hp || 0);
        const beforeEffects = Array.isArray(s?.activeEffects) ? s.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
        const statusTick = updateEffects({ ...s, activeEffects: beforeEffects }, { returnMeta: true, elapsedSec: phaseDurationSec });
        let updated = normalizeRuntimeSurvivor(statusTick?.character || s);

        (Array.isArray(statusTick?.ticks) ? statusTick.ticks : []).forEach((tick) => {
          if (!shouldLogRuntimeEffectTick(tick)) return;
          const amount = Math.max(0, Number(tick?.amount || 0));
          if (amount <= 0) return;
          const nm = String(tick?.name || '효과');
          const secText = Number(tick?.seconds || 0) > 1 ? ` (${Math.max(1, Math.floor(Number(tick.seconds)))}초)` : '';
          if (tick?.type === 'damage') addLog(`⏱️ [${updated.name}] ${nm}: HP -${amount}${secText}`, 'highlight');
          else if (tick?.type === 'heal') addLog(`✨ [${updated.name}] ${nm}: HP +${amount}${secText}`, 'system');
        });
        (Array.isArray(statusTick?.expired) ? statusTick.expired : []).forEach((eff) => {
          if (!shouldLogRuntimeEffectExpiry(eff)) return;
          const nm = String(eff?.name || '효과');
          addLog(`⌛ [${updated.name}] ${nm} 종료`, 'system');
        });

        const afterHp = Number(updated.hp || 0);
        if (beforeHp > 0 && afterHp <= 0) {
          updated.hp = 0;
          const visibleDamageTick = (Array.isArray(statusTick?.ticks) ? statusTick.ticks : [])
            .find((tick) => Number(tick?.amount || 0) > 0 && shouldLogRuntimeEffectTick(tick));
          const cause = visibleDamageTick
            ? String(visibleDamageTick?.name || '상태 이상')
            : '지속 피해';
          setDeathMetadata(updated, 'status_effect', { causeName: cause });
          updated.deadAtPhaseIdx = phaseIdxNow;
          updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
          newlyDead.push(updated);
          emitDeathRunEventOnce(updated, { reason: 'status_effect', cause });
          addLog(`💀 [${updated.name}] ${cause}로 사망했습니다.`, 'death');
          return updated;
        }

        // --- 이동 ---
updated.simCredits = updated.simCredits ?? 0;
updated.droneLastOrderIndex = updated.droneLastOrderIndex ?? -9999;
updated.droneLastOrderAbsSec = updated.droneLastOrderAbsSec ?? -99999;
updated.kioskLastInteractAbsSec = updated.kioskLastInteractAbsSec ?? -99999;
updated.aiTargetZoneId = updated.aiTargetZoneId ?? null;
updated.aiTargetTTL = updated.aiTargetTTL ?? 0;
updated.inventory = Array.isArray(updated.inventory) ? updated.inventory : [];
updated.inventory = normalizeInventory(updated.inventory, ruleset);
updated._itemKeyById = itemKeyById;

let currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
let neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
const knockbackDistance = getKnockbackDistance(updated);
if (knockbackDistance > 0 && neighbors.length > 0) {
  const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
  const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
  const pushedZone = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
  if (pushedZone && pushedZone !== currentZone) {
    updated.zoneId = pushedZone;
    removeActiveEffect(updated, EFFECT_KNOCKBACK);
    addLog(`↔️ [${updated.name}] 밀려남: ${getZoneName(currentZone)} → ${getZoneName(pushedZone)}`, 'system');
    emitRunEvent('move', { who: String(updated?._id || ''), name: updated?.name, from: currentZone, to: pushedZone, reason: 'knockback' }, atNow());
    currentZone = pushedZone;
    neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
  }
}
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

// 🤖 목표 존 유지(TTL): 목표를 몇 페이즈 유지해서 '사람처럼' 보이게 함
const hasAiMoveTargets = Array.isArray(aiMove?.targets) && aiMove.targets.length > 0;
const earlyRouteTarget = getEarlyRoutePlanTarget(updated, forbiddenIds, nextDay, nextPhase);
const earlyRoutePriorityPhase = Number(nextDay || 0) === 1;
const preferEarlyRoutePlan = !!earlyRouteTarget && (
  (!hasAiMoveTargets)
  || earlyRoutePriorityPhase
);
const plannedMove = preferEarlyRoutePlan
  ? { targets: [earlyRouteTarget], reason: hasAiMoveTargets ? 'early_route:priority' : 'early_route' }
  : aiMove;
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

const ttlMin = Math.max(1, Number(aiCfg?.targetTtlMin ?? 2));
const ttlMax = Math.max(ttlMin, Number(aiCfg?.targetTtlMax ?? 4));
const clearOnReach = aiCfg?.clearOnReach !== false;
const plannedObjectiveType = String(plannedMove?.objectiveType || '');
const plannedObjectiveSubkind = String(plannedMove?.objectiveSubkind || '');
const plannedContestPressure = Math.max(0, Number(plannedMove?.contestPressure || 0));

let holdTarget = null;

// 금지구역이면 목표 유지 대신 목표를 초기화(생존 우선)
if (mustEscape) {
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  updated.aiTargetObjectiveType = '';
  updated.aiTargetObjectiveSubkind = '';
  updated.aiTargetContestPressure = 0;
} else {
  const saved = String(updated.aiTargetZoneId || '');
  const ttlNow = Math.max(0, Number(updated.aiTargetTTL || 0));

  if (saved && ttlNow > 0 && !forbiddenIds.has(saved)) {
    holdTarget = saved;
    // 페이즈마다 TTL 감소
    updated.aiTargetTTL = ttlNow - 1;
    if (clearOnReach && String(currentZone) === saved) {
      holdTarget = null;
      updated.aiTargetZoneId = null;
      updated.aiTargetTTL = 0;
      updated.aiTargetObjectiveType = '';
      updated.aiTargetObjectiveSubkind = '';
      updated.aiTargetContestPressure = 0;
    }
  }

  if (!holdTarget && Array.isArray(plannedMove?.targets) && plannedMove.targets.length > 0) {
    const pickedTarget = plannedMove.targets
      .map((z) => String(z || ''))
      .find((z) => z && !forbiddenIds.has(String(z))) || '';
    if (pickedTarget) {
      updated.aiTargetZoneId = pickedTarget;
      updated.aiTargetTTL = randInt(ttlMin, ttlMax);
      updated.aiTargetObjectiveType = plannedObjectiveType;
      updated.aiTargetObjectiveSubkind = plannedObjectiveSubkind;
      updated.aiTargetContestPressure = plannedContestPressure;
      holdTarget = pickedTarget;
    }
  }
}

let moveTargets = holdTarget ? [holdTarget] : (Array.isArray(plannedMove?.targets) ? plannedMove.targets : []);
let moveReason = holdTarget ? `${String(plannedMove?.reason || 'goal')}:ttl` : String(plannedMove?.reason || '');
let moveObjectiveType = String(updated.aiTargetObjectiveType || plannedObjectiveType || '');
let moveObjectiveSubkind = String(updated.aiTargetObjectiveSubkind || plannedObjectiveSubkind || '');
let moveContestPressure = Math.max(0, Number(updated.aiTargetContestPressure || plannedContestPressure || 0));

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
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  updated.aiTargetObjectiveType = '';
  updated.aiTargetObjectiveSubkind = '';
  updated.aiTargetContestPressure = 0;
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
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  updated.aiTargetObjectiveType = '';
  updated.aiTargetObjectiveSubkind = '';
  updated.aiTargetContestPressure = 0;
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
const forbidCfg = ruleset?.forbidden || {};
const escapeMoveChance = Math.min(1, Math.max(0, Number(forbidCfg.escapeMoveChance ?? 0.85)));
// detonation이 임계치 근처면(=곧 폭발) 탈출 시도를 더 강하게 합니다.
const curDet = Number.isFinite(Number(updated.detonationSec)) ? Number(updated.detonationSec) : 999;
const dangerForceSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5) + 2);
const escapeChance = (mustEscape && curDet <= dangerForceSec) ? 1 : escapeMoveChance;

const equipMs = getEquipMoveSpeed(updated);
const masteryMs = getMovementSpeedMasteryBonus(updated);
const msMoveBonus = Math.min(0.18, equipMs * 0.9 + masteryMs); // 신발/이동 숙련도 반영(이동 결정)
let baseMoveChance = mustEscape ? escapeChance : (fleeInterruptReason ? 1 : (recovering ? 0.95 : (moveTargets.length ? 0.88 : 0.6)));
// ✅ 1일차 낮에는 "최소 1회 이동" 목표를 위해 이동 확률을 상향(관전 템포)
if (!mustEscape && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning') {
  baseMoveChance = Math.max(baseMoveChance, 0.92);
}
const moveChance = Math.min(0.98, baseMoveChance + msMoveBonus);
let willMove = Math.random() < moveChance;

// ✅ 관전형 요구사항: 1일차 낮에는 '최소 1회 이동'을 거의 확정으로 보장
// - day1Moves가 0인 상태에서만 강제(이후에는 원래 확률로)
if (!mustEscape && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning' && Math.max(0, Number(updated.day1Moves || 0)) < 1) {
  if (neighbors.length > 0) willMove = true;
}

if (willMove) {
  if (mustEscape) {
    // 금지구역이면 우선 안전한 곳으로 이동
    if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      // 연결 정보가 없으면(=neighbors가 비면) "맵 전체 순간이동" 대신 제자리(동선 데이터는 zoneConnections로 보강)
      nextZoneId = currentZone;
    }
  } else if (moveTargets.length) {
    const tset = new Set(moveTargets.map((z) => String(z)));
    const stepRes = bfsNextStepToAnyTarget(currentZone, tset, zoneGraph, forbiddenIds);

    const picked = stepRes.nextStep || (tset.has(currentZone) ? currentZone : String(moveTargets[0] || currentZone));
    if (picked && !forbiddenIds.has(String(picked))) nextZoneId = String(picked);
  } else {
    // 기본: 랜덤 인접 이동
    if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      // 연결 정보가 없으면(=neighbors가 비면) "맵 전체 랜덤" 대신 제자리
      nextZoneId = currentZone;
    }
  }
}

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
const preRouteCraftMissingItemIds = (Array.isArray(preGoal?.missing) ? preGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean);
const preRouteMissingItemIds = mergeMissingItemIds(preRouteCraftMissingItemIds, getRoutePlanMissingItemIds(updated));
const preRouteMappedItemIds = Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated.zoneId || '')])
  ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')].map((id) => String(id || '').trim()).filter(Boolean)
  : [];
advanceEarlyRouteProgress(updated, updated.zoneId, {
  missingItemIds: preRouteMissingItemIds,
  routeItemIds: preRouteMappedItemIds.length ? preRouteMappedItemIds : preRouteMissingItemIds,
  searched: false,
  maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
});

const didMove = String(nextZoneId) !== String(currentZone);

        // ✅ 1일차 "최소 1회 이동" 목표 추적
        if (didMove && Number(nextDay || 0) === 1) {
          updated.day1Moves = Math.max(0, Number(updated.day1Moves || 0)) + 1;
          if (String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
            const heroRes = day1HeroGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, {
              allowAbstractFallback: true,
              forceRouteCompletion: true,
              routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
            });
            if (heroRes?.changed && Array.isArray(heroRes.logs)) {
              heroRes.logs.forEach((m) => addLog(String(m), 'highlight'));
            }
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
          const postLootMissingIds = (Array.isArray(postLootGoal?.missing) ? postLootGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean);
          const postLootRouteItemIds = Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated?.zoneId || '')])
            ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')].map((id) => String(id || '').trim()).filter(Boolean)
            : [];
          advanceEarlyRouteProgress(updated, updated.zoneId, {
            missingItemIds: postLootMissingIds,
            routeItemIds: postLootRouteItemIds.length ? postLootRouteItemIds : postLootMissingIds,
            searched: true,
            maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
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
        const craftGoalMissingIds = (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
          .map((m) => String(m?.itemId || ''))
          .filter(Boolean);
        const routePlanMissingIdsNow = getRoutePlanMissingItemIds(updated);
        const earlyRouteMissingIdsNow = mergeMissingItemIds(craftGoalMissingIds, routePlanMissingIdsNow);
        const mappedRouteItemIdsNow = Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated.zoneId || '')])
          ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')].map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        advanceEarlyRouteProgress(updated, updated.zoneId, {
          missingItemIds: earlyRouteMissingIdsNow,
          routeItemIds: mappedRouteItemIdsNow.length ? mappedRouteItemIdsNow : earlyRouteMissingIdsNow,
          searched: false,
          maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
        });
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
        const deferProcureForRoute = currentRouteNeedsSearch && !upgradeNeed?.wantLegend && !upgradeNeed?.wantTrans;
        let queuedKioskAction = (didMove || fleeInterruptReason || deferProcureForRoute) ? null : rollKioskInteraction(mapObj, updated.zoneId, kiosks, publicItems, nextDay, nextPhase, updated, craftGoal, itemNameById, marketRules, ruleset, upgradeNeed, currentActionSec());
        if (queuedKioskAction?.kind === 'buy' && queuedKioskAction?.itemId && !canReceiveItem(updated.inventory, queuedKioskAction.item, queuedKioskAction.itemId, queuedKioskAction.qty || 1, ruleset)) {
          queuedKioskAction = null;
        }
        let queuedDroneOrder = (didMove || fleeInterruptReason || deferProcureForRoute || (queuedKioskAction?.itemId && queuedKioskAction?.item)) ? null : rollDroneOrder(droneOffers, mapObj, publicItems, nextDay, nextPhase, updated, phaseIdxNow, craftGoal, itemNameById, marketRules, currentActionSec());
        if (queuedDroneOrder?.itemId && !canReceiveItem(updated.inventory, queuedDroneOrder.item, queuedDroneOrder.itemId, queuedDroneOrder.qty || 1, ruleset)) {
          queuedDroneOrder = null;
        }
        const craftProbeActor = (didMove || fleeInterruptReason || queuedKioskAction?.itemId || queuedDroneOrder?.itemId)
          ? null
          : { ...updated, inventory: Array.isArray(updated.inventory) ? [...updated.inventory] : [], _itemKeyById: itemKeyById };
        const craftPreview = craftProbeActor
          ? tryAutoCraftFromInventory(craftProbeActor, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset)
          : null;
        const suppressEarlyRouteHunt = currentRouteNeedsSearch && !craftPreview?.changed && !upgradeNeed?.farmCredits;
        const queueScoredCandidates = (() => {
          if (didMove || fleeInterruptReason) return [];
          const lowHpRatio = Math.max(0, Math.min(1, Number(updated?.hp || 0) / Math.max(1, Number(updated?.maxHp || 100))));
          const simCredits = Math.max(0, Number(updated?.simCredits || 0));
          const farmCreditsBias = upgradeNeed?.farmCredits ? 10 : 0;
          const legendBias = upgradeNeed?.wantLegend ? 6 : 0;
          const transBias = upgradeNeed?.wantTrans ? 8 : 0;
          const scoreRows = [];
          if (queuedKioskAction?.itemId && queuedKioskAction?.item) {
            const kioskTypeMap = { buy: 'kioskBuy', exchange: 'kioskExchange', sell: 'kioskSell' };
            const itemId = String(queuedKioskAction?.itemId || '');
            const matchesGoal = goalMissingIds.has(itemId) || (goalTargetId && goalTargetId === itemId);
            const kind = String(queuedKioskAction?.kind || 'buy');
            const isSell = kind === 'sell';
            const score =
              (isSell ? (18 + farmCreditsBias + Math.max(0, simCredits >= 300 ? 6 : 0)) : 44)
              + (matchesGoal ? 26 : 0)
              + (isSell ? 0 : legendBias + transBias)
              + (kind === 'exchange' ? 6 : 0)
              - (lowHpRatio <= 0.28 ? 5 : 0);
            scoreRows.push({
              type: kioskTypeMap[kind] || 'kioskBuy',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `${kioskTypeMap[kind] || 'kioskBuy'}:${String(queuedKioskAction?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: [matchesGoal ? 'goal' : '', kind === 'exchange' ? 'exchange' : '', isSell ? 'sell' : ''].filter(Boolean).join('+'),
            });
          }
          if (queuedDroneOrder?.itemId) {
            const itemId = String(queuedDroneOrder?.itemId || '');
            const matchesGoal = goalMissingIds.has(itemId) || (goalTargetId && goalTargetId === itemId);
            const matchesRouteDrone = routeDroneNeedIds.has(itemId);
            const score = 40 + (matchesGoal ? 28 : 0) + (matchesRouteDrone ? 36 : 0) + legendBias + transBias - (simCredits < 40 ? 10 : 0) - (lowHpRatio <= 0.28 ? 4 : 0);
            scoreRows.push({
              type: 'droneOrder',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `drone:${String(queuedDroneOrder?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: [matchesRouteDrone ? 'route_drone' : '', matchesGoal ? 'goal' : ''].filter(Boolean).join('+'),
            });
          }
          if (craftPreview?.changed) {
            const itemId = String(craftPreview?.craftedId || '');
            const craftedTier = Math.max(1, Number(craftPreview?.craftedTier || itemMetaById?.[itemId]?.tier || 1));
            const matchesGoal = goalTargetId === itemId || goalMissingIds.has(itemId);
            const score = 58 + craftedTier * 6 + (matchesGoal ? 24 : 0) + legendBias + transBias;
            scoreRows.push({
              type: 'craft',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `craft:${String(craftPreview?.craftedName || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: `${matchesGoal ? 'goal+' : ''}tier${craftedTier}`,
            });
          }
          if (suppressEarlyRouteHunt) {
            scoreRows.push({
              type: 'routeFarm',
              zoneId: String(updated?.zoneId || ''),
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score: 34 + (fallbackRouteItemIds.length ? 4 : 0) + (lowHpRatio <= 0.35 ? 2 : 0),
              label: 'routeFarm',
              priorityNote: currentRouteItemIds.length ? 'early_route+materials' : 'early_route+fallback',
            });
          } else {
            scoreRows.push({
              type: 'hunt',
              zoneId: String(updated?.zoneId || ''),
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score: 24 + farmCreditsBias + (lowHpRatio <= 0.35 ? 6 : 0) + (craftPreview?.changed ? -10 : 0),
              label: 'hunt',
              priorityNote: farmCreditsBias > 0 ? 'credits' : '',
            });
          }
          return scoreRows
            .sort((a, b) => {
              const ds = Number(b?.score || 0) - Number(a?.score || 0);
              if (Math.abs(ds) > 0.001) return ds;
              const pa = ['craft', 'routeFarm', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(a?.type || ''));
              const pb = ['craft', 'routeFarm', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(b?.type || ''));
              return pa - pb;
            })
            .slice(0, 5);
        })();
        const queuedAtomicAction = (() => {
          if (didMove) {
            return {
              type: (mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo',
              fromZoneId: String(currentZone || ''),
              toZoneId: String(nextZoneId || currentZone || ''),
              reason: mustEscape ? 'escape' : String(moveReason || 'goal'),
              etaSec: moveEtaSec,
              transport: usedHyperloopMove ? 'hyperloop' : 'walk',
              phaseIdx: Number(phaseIdxNow || 0),
              score: 999,
              objectiveType: moveObjectiveType,
              objectiveSubkind: moveObjectiveSubkind,
              contestPressure: moveContestPressure,
            };
          }
          if (fleeInterruptReason) {
            return {
              type: 'flee',
              fromZoneId: String(currentZone || ''),
              toZoneId: String(nextZoneId || currentZone || ''),
              reason: String(moveReason || `flee:${fleeInterruptReason}`),
              etaSec: moveEtaSec,
              transport: usedHyperloopMove ? 'hyperloop' : 'walk',
              phaseIdx: Number(phaseIdxNow || 0),
              score: 998,
            };
          }
          return queueScoredCandidates[0] || (
            earlyRouteActionActive
              ? { type: 'routeFarm', zoneId: String(updated?.zoneId || ''), etaSec: 1, phaseIdx: Number(phaseIdxNow || 0), score: 1, reason: 'early_route' }
              : { type: 'hunt', zoneId: String(updated?.zoneId || ''), etaSec: 1, phaseIdx: Number(phaseIdxNow || 0), score: 0 }
          );
        })();
        const queuedActionType = String(queuedAtomicAction?.type || 'hunt');
        const queuePreview = [queuedAtomicAction].filter(Boolean).map((act) => {
          const type = String(act?.type || 'hunt');
          const zoneText = getZoneName(act?.toZoneId || act?.zoneId || '');
          const itemText = String(
            (String(act?.itemId || '') && (itemNameById?.[String(act?.itemId || '')] || ''))
            || queuedKioskAction?.item?.name
            || queuedDroneOrder?.item?.name
            || craftPreview?.craftedName
            || ''
          );
          return [type, itemText && `:${itemText}`, zoneText && `@${zoneText}`].filter(Boolean).join('');
        });
        const candidatePreview = [
          didMove ? `${(mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo'}@${getZoneName(nextZoneId || currentZone || '')}` : null,
          (!didMove && fleeInterruptReason) ? `flee:${String(fleeInterruptReason || '')}` : null,
          ...queueScoredCandidates.map((row) => `${String(row?.label || row?.type || '')}[${Number(row?.score || 0).toFixed(1)}]`),
        ].filter(Boolean);
        const blockedReasons = [
          (didMove && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? 'movement_locked' : null,
          (fleeInterruptReason && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? `flee_interrupt:${String(fleeInterruptReason || '')}` : null,
          (!didMove && !fleeInterruptReason && !queuedKioskAction?.itemId && !queuedDroneOrder?.itemId && craftProbeActor?._craftDebug?.code && craftProbeActor?._craftDebug?.code !== 'crafted')
            ? `craft:${String(craftProbeActor?._craftDebug?.code || '')}`
            : null,
          ...queueScoredCandidates.slice(1).map((row) => `deferred:${String(row?.type || '')}`).slice(0, 2),
        ].filter(Boolean);
        updated.aiActionQueue = [queuedAtomicAction];
        updated.aiCurrentAction = queuedActionType;
        updated.aiActionEtaSec = Number(queuedAtomicAction?.etaSec || 1);
        updated._aiDebug = {
          phaseIdx: Number(phaseIdxNow || 0),
          zoneName: getZoneName(updated?.zoneId || currentZone),
          action: queuedActionType,
          reason: String(queuedAtomicAction?.reason || moveReason || ''),
          targetZoneName: getZoneName(queuedAtomicAction?.toZoneId || holdTarget || ''),
          itemName: String(
            queuedKioskAction?.item?.name
            || queuedDroneOrder?.item?.name
            || craftPreview?.craftedName
            || (craftGoal?.target?.name || '')
          ),
          goalName: String(craftGoal?.target?.name || ''),
          missingNames: (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
            .slice(0, 4)
            .map((m) => String(m?.name || itemNameById?.[String(m?.itemId || '')] || m?.itemId || ''))
            .filter(Boolean),
          queuePreview,
          candidatePreview: candidatePreview.slice(0, 5),
          candidateScores: queueScoredCandidates.slice(0, 4).map((row) => `${String(row?.type || '')}:${Number(row?.score || 0).toFixed(1)}${row?.priorityNote ? `(${String(row.priorityNote)})` : ''}`),
          blockedReasons: blockedReasons.slice(0, 3),
          objectiveType: String(queuedAtomicAction?.objectiveType || moveObjectiveType || ''),
          objectiveSubkind: String(queuedAtomicAction?.objectiveSubkind || moveObjectiveSubkind || ''),
          contestPressure: Math.max(0, Number(queuedAtomicAction?.contestPressure || moveContestPressure || 0)),
          fleeReason: String(fleeInterruptReason || ''),
          recovering: !!recovering,
          credits: Math.max(0, Number(updated?.simCredits || 0)),
          wantLegend: !!upgradeNeed?.wantLegend,
          wantTrans: !!upgradeNeed?.wantTrans,
          farmCredits: !!upgradeNeed?.farmCredits,
        };
        if (blockedReasons.length || ['flee', 'routeFarm', 'kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder', 'craft'].includes(queuedActionType)) {
          emitQueueRunEvent(updated, {
            zoneId: String(updated?.zoneId || currentZone || ''),
            chosen: queuedActionType,
            blockedReasons,
            candidates: candidatePreview.slice(0, 5),
            candidateScores: queueScoredCandidates,
            candidateCount: candidatePreview.length,
            reason: String(queuedAtomicAction?.reason || moveReason || ''),
            objectiveType: String(queuedAtomicAction?.objectiveType || moveObjectiveType || ''),
            objectiveSubkind: String(queuedAtomicAction?.objectiveSubkind || moveObjectiveSubkind || ''),
            contestPressure: Math.max(0, Number(queuedAtomicAction?.contestPressure || moveContestPressure || 0)),
          }, atNow());
        }

        if (queuedActionType === 'routeFarm' && fallbackRouteItemIds.length > 0) {
          const initialRouteLootHit = !!loot && String(loot?.crateId || '') === 'route_plan';
          const day1RouteBurst = Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning';
          const configuredAttempts = Math.max(1, Math.floor(Number(ruleset?.ai?.earlyRouteFarmAttempts ?? (day1RouteBurst ? 2 : 1))));
          const routeAttempts = Math.max(0, configuredAttempts - (initialRouteLootHit ? 1 : 0));
          let routeGoalIdsForSearch = [...goalMissingIds];

          for (let routeAttempt = 0; routeAttempt < routeAttempts; routeAttempt += 1) {
            const routeLoot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, {
              moved: false,
              routeFarm: true,
              day: nextDay,
              phase: nextPhase,
              dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey,
              perkEffects: getActorPerkEffects(updated),
              goalItemIds: routeGoalIdsForSearch,
              routeItemIds: fallbackRouteItemIds,
            });
            if (routeLoot?.itemId) {

            updated.inventory = addItemToInventory(updated.inventory, routeLoot.item, routeLoot.itemId, routeLoot.qty, nextDay, ruleset);
            const metaR = updated.inventory?._lastAdd;
            const gotR = Math.max(0, Number(metaR?.acceptedQty ?? routeLoot.qty));
            const nmR = routeLoot.item?.name || itemNameById?.[String(routeLoot.itemId || '')] || '아이템';
            if (shouldLogItemReceive(gotR, metaR)) {
              addLog(`🧭 [${updated.name}] ${getZoneName(updated.zoneId)}에서 루트 재료 ${itemIcon(routeLoot.item || { type: '' })} [${nmR}] ${gainText(gotR)}${formatInvAddNote(metaR, routeLoot.qty, updated.inventory, ruleset)}`, 'normal');
            }
            emitItemGainIfAny(gotR, { who: String(updated?._id || ''), itemId: String(routeLoot.itemId || ''), source: 'gather', kind: String(routeLoot?.crateType || 'route_material'), zoneId: String(updated?.zoneId || '') }, atNow());
            if (gotR > 0) grantMastery(updated, 'search', 70, '루트 탐색');
            if (gotR > 0) autoEquipBest(updated, itemMetaById);
            const craftedR = tryAutoCraftFromLoot(updated.inventory, routeLoot.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
            applyLootCraftResult(updated, craftedR, itemMetaById, atNow(), updated?.zoneId);
            const postRouteGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
              goalTier: updated?.goalGearTier,
              goalItemKeys: pickGoalLoadoutKeys(updated),
              perkEffects: getActorPerkEffects(updated),
            });
            const postRouteCraftMissingIds = (Array.isArray(postRouteGoal?.missing) ? postRouteGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean);
            routeGoalIdsForSearch = mergeMissingItemIds(postRouteCraftMissingIds, getRoutePlanMissingItemIds(updated));
            }
            advanceEarlyRouteProgress(updated, updated.zoneId, {
              missingItemIds: routeGoalIdsForSearch,
              routeItemIds: fallbackRouteItemIds,
              searched: true,
              maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
            });
            if (!routeGoalIdsForSearch.length) break;
            if (updated?._routePlanProgress?.advanced) break;
          }
        }

        if (queuedActionType === 'routeFarm' && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning' && !isExplicitDay1HeroRoutePlan(updated)) {
          const heroRes = day1HeroGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, {
            allowAbstractFallback: true,
            forceRouteCompletion: true,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
          if (heroRes?.changed && Array.isArray(heroRes.logs)) {
            heroRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }
        }

        if (queuedActionType === 'hunt') {
        // --- 보스(맵 이벤트 스폰): 알파/오메가/위클라인 ---
        const boss = recovering ? null : consumeBossAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset);

        // --- 변이 야생동물(요청): 매 밤 스폰(로컬 설정 zone) ---
        const mutant = boss ? null : (recovering ? null : consumeMutantWildlifeAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset));

        // --- 야생동물 사냥(일반): 존 스폰 카운트 기반(매 페이즈 스폰 체크/파밍 강화) ---
        const hunt = boss || mutant || consumeWildlifeAtZone(nextSpawn, mapObj, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove, isKioskZone, recovering });

        const isBossReward = !!boss;
        const isMutantReward = !boss && !!mutant;
        if (hunt) {
          const dmg = Math.max(0, Number(hunt.damage || 0));
          const estimatedWildlifeDamage = Math.round((isBossReward ? 260 : isMutantReward ? 180 : 110) * getWildlifeDamageMultiplier(updated));
          updated.hp = Math.max(0, Number(updated.hp || 0) - dmg);
          addLog(`🎯 [${updated.name}] ${hunt.log}${dmg > 0 ? ` (피해 -${dmg})` : ''}`, dmg > 0 ? 'highlight' : 'normal');
          grantMasteries(updated, getWildlifeMasteryEntries({ damageDealt: estimatedWildlifeDamage, damageTaken: dmg }), isBossReward ? '보스 사냥' : isMutantReward ? '변이 사냥' : '사냥');
          const creditGain = Math.max(0, Number(hunt?.credits || 0));
          if (creditGain > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + creditGain);
            addLog(`💳 [${updated.name}] ${isBossReward ? '보스 처치 보상' : isMutantReward ? '변이 사냥 보상' : '사냥 보상'} (크레딧 +${creditGain})`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: creditGain, source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());

            if (isBossReward) {
              const pb = 0.45;
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }
          }



          const drops = normalizeRewardDropEntries(
            Array.isArray(hunt?.drops) ? hunt.drops : (hunt?.drop ? [hunt.drop] : []),
            publicItems,
            itemNameById,
          );
          if (isBossReward) {
            emitObjectiveRunEvent(updated, 'boss', {
              subkind: String(hunt?.kind || ''),
              credits: creditGain,
              damage: dmg,
              dropCount: drops.length,
              success: true,
              danger: 0.45,
            }, atNow());
          }
          for (const d of drops) {
            if (!d?.itemId || !d?.item) continue;
            const q = Math.max(1, Number(d.qty || 1));
            const nm = d.item?.name || itemNameById?.[String(d.itemId || '')] || '아이템';
            const huntDropItem = markInventoryGoalItem(d.item, goalMissingIds.has(String(d.itemId || '')));
            updated.inventory = addItemToInventory(updated.inventory, huntDropItem, d.itemId, q, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const got = Math.max(0, Number(meta?.acceptedQty ?? q));
            if (shouldLogItemReceive(got, meta)) {
              addLog(`🧾 [${updated.name}] 드랍: ${itemIcon(d.item || { type: '' })} [${nm}] ${gainText(got)}${formatInvAddNote(meta, q, updated.inventory, ruleset)}`, 'normal');
            }
            emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(d.itemId || ''), source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());

            const specialKind = classifySpecialByName(nm);
            const immediateH = tryImmediateCraftFromSpecial(updated, specialKind, String(d.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateH?.changed) {
              updated.inventory = immediateH.inventory;
              (Array.isArray(immediateH.logs) ? immediateH.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateH?.pvpBonus || 0) > 0) {
              const pb = Number(immediateH.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }

            const craftedH = immediateH?.changed ? null : tryAutoCraftFromLoot(updated.inventory, d.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
            applyLootCraftResult(updated, craftedH, itemMetaById, atNow(), updated?.zoneId);
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            setDeathMetadata(updated, 'wildlife_hunt', { causeName: '사냥 중 치명상' });
            updated.deadAtPhaseIdx = phaseIdxNow;
            updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
            addLog(`💀 [${updated.name}]이(가) 사냥 중 치명상을 입고 사망했습니다.`, 'death');
            emitDeathRunEventOnce(updated, { reason: 'wildlife_hunt', cause: '사냥 중 치명상' });
            newlyDead.push(updated);
          }
        }

        }

        // --- 전설 재료 상자(맵 이벤트 스폰): 3일차 '낮' 이후부터 맵 어딘가에 드랍 → 해당 구역 진입 시 개봉 ---
        const legendary = openSpawnedLegendaryCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (legendary) {
          updated.inventory = addItemToInventory(updated.inventory, legendary.item, legendary.itemId, legendary.qty, nextDay, ruleset);
          const meta = updated.inventory?._lastAdd;
          const got = Math.max(0, Number(meta?.acceptedQty ?? legendary.qty));
          const nm = legendary.item?.name || '전설 재료';
          if (shouldLogItemReceive(got, meta, { important: true })) {
            addLog(`🟪 [${updated.name}] ${getZoneName(updated.zoneId)}에서 🎁 전설 재료 상자를 열어 [${nm}] ${gainText(got)}${formatInvAddNote(meta, legendary.qty, updated.inventory, ruleset)}`, 'normal');
          }
          emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(legendary.itemId || ''), source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());
          if (got > 0) grantMastery(updated, 'search', 350, '항공 보급');

          const specialLKindMain = classifySpecialByName(String(legendary?.item?.name || ''));
          const immediateLMain = tryImmediateCraftFromSpecial(updated, specialLKindMain, String(legendary.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
          if (immediateLMain?.changed) {
            updated.inventory = immediateLMain.inventory;
            (Array.isArray(immediateLMain.logs) ? immediateLMain.logs : []).forEach((m) => addLog(String(m), 'highlight'));
          }
          if (Number(immediateLMain?.pvpBonus || 0) > 0) {
            const pb = Number(immediateLMain.pvpBonus || 0);
            updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
            updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
            updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
            updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }

          // 크레딧 보상 + 추가드랍(룰셋 기반)
          const legCr = Math.max(0, Number(legendary?.credits || 0));
          if (legCr > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + legCr);
            addLog(`💳 [${updated.name}] 전설 상자 보상 크레딧 +${legCr}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: legCr, source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());
          }

          emitObjectiveRunEvent(updated, 'legendary_crate', {
            subkind: 'legendary_material',
            itemId: String(legendary.itemId || ''),
            itemName: String(nm || ''),
            qty: got,
            credits: legCr,
            success: got > 0,
            danger: Math.max(0, Number(immediateLMain?.pvpBonus || 0)),
          }, atNow());

          const bonusDrops = Array.isArray(legendary?.bonusDrops) ? legendary.bonusDrops : [];
          for (const bd of bonusDrops) {
            if (!bd?.itemId || !bd?.item) continue;
            const q = Math.max(1, Number(bd.qty || 1));
            updated.inventory = addItemToInventory(updated.inventory, bd.item, bd.itemId, q, nextDay, ruleset);
            const metaB = updated.inventory?._lastAdd;
            const gotB = Math.max(0, Number(metaB?.acceptedQty ?? q));
            const nmB = bd.item?.name || '전설 재료';
            if (shouldLogItemReceive(gotB, metaB)) {
              addLog(`🟪 [${updated.name}] 전설 상자 추가드랍: [${nmB}] ${gainText(gotB)}${formatInvAddNote(metaB, q, updated.inventory, ruleset)}`, 'highlight');
            }
            emitItemGainIfAny(gotB, { who: String(updated?._id || ''), itemId: String(bd.itemId || ''), source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());

            const specialLBKind = classifySpecialByName(String(bd?.item?.name || nmB || ''));
            const immediateLB = tryImmediateCraftFromSpecial(updated, specialLBKind, String(bd.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateLB?.changed) {
              updated.inventory = immediateLB.inventory;
              (Array.isArray(immediateLB.logs) ? immediateLB.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateLB?.pvpBonus || 0) > 0) {
              const pb = Number(immediateLB.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }
            if (gotB > 0 && !immediateLB?.changed) {
              const craftedB = tryAutoCraftFromLoot(updated.inventory, bd.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
              applyLootCraftResult(updated, craftedB, itemMetaById, atNow(), updated?.zoneId);
            }
          }


          // 전설 재료도 즉시 조합 트리거(선택적)
          const craftedL = (typeof immediateLMain !== 'undefined' && immediateLMain?.changed) ? null : tryAutoCraftFromLoot(updated.inventory, legendary.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
          applyLootCraftResult(updated, craftedL, itemMetaById, atNow(), updated?.zoneId);
        }

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
            const postCraftCraftMissingIds = (Array.isArray(postCraftGoal?.missing) ? postCraftGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean);
            const postCraftMissingIds = mergeMissingItemIds(postCraftCraftMissingIds, getRoutePlanMissingItemIds(updated));
            const postCraftRouteItemIds = Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated?.zoneId || '')])
              ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')].map((id) => String(id || '').trim()).filter(Boolean)
              : [];
            advanceEarlyRouteProgress(updated, updated.zoneId, {
              missingItemIds: postCraftMissingIds,
              routeItemIds: postCraftRouteItemIds.length ? postCraftRouteItemIds : postCraftMissingIds,
              searched: false,
              maxSearches: Number(ruleset?.ai?.earlyRouteMaxSearches ?? 3),
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
          const heroRes = day1HeroGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, {
            allowAbstractFallback: allowAbstractGearFallback || forceEarlyHeroRouteCompletion,
            forceRouteCompletion: forceEarlyHeroRouteCompletion,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
          if (heroRes?.changed && Array.isArray(heroRes.logs)) {
            heroRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }

          // 후반 fallback 제작: 실제 전설/초월 레시피가 없을 때만 추상 장비 안전망을 사용합니다.
          const lateRes = lateGameGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, { allowAbstractFallback: allowAbstractGearFallback });
          if (lateRes?.changed && Array.isArray(lateRes.logs)) {
            lateRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }
        }


        // --- 시즌 11 컨셉: 가젯 에너지 ---
        const forceEarlyHeroRouteCompletionAnyAction = shouldForceDay1HeroGearCatchup(updated, nextDay, nextPhase);
        if (forceEarlyHeroRouteCompletionAnyAction) {
          const heroCatchup = day1HeroGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, {
            allowAbstractFallback: true,
            forceRouteCompletion: true,
            routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
          });
          if (heroCatchup?.changed && Array.isArray(heroCatchup.logs)) {
            heroCatchup.logs.forEach((m) => addLog(String(m), 'highlight'));
          }
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
      eventProb,
      isDay1MorningFarmPhase,
      isEarlyRouteFarmingActor,
      pvpMinSameZone,
      pvpProbCfg,
      restrictedRatio,
      suddenDeath,
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
    while (phaseRuntimeOffsetSec < phaseDurationSec) {
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
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
                  const desc = describeRuntimeEffect(row.effect);
                  if (desc) bits.push(desc);
                }
              });
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
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
                  const desc = describeRuntimeEffect(row.effect);
                  if (desc) bits.push(desc);
                }
              });
              targetTacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${defender.name} ${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${defender.name} ${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
                  const desc = describeRuntimeEffect(row.effect);
                  if (desc) bits.push(`${defender.name} ${desc}`);
                }
              });
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
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
                  const desc = describeRuntimeEffect(row.effect);
                  if (desc) bits.push(desc);
                }
              });
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

      } else if (canDual && rand < eventProb) {
        // [🤝 2인 이벤트]
        const targetSeed = potentialTargets[0];
        const target = targetSeed?._id ? survivorMap.get(String(targetSeed._id)) : null;
        if (!target || Number(target.hp || 0) <= 0) {
          upsertRuntimeSurvivor(survivorMap, actor);
          continue;
        }
        const targetIndex = todaysSurvivors.findIndex((t) => String(t?._id || '') === String(target._id));
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

        const timeKey = nextPhase === 'night' ? 'night' : 'day';

        // ✅ (로드맵 6-4 + 2번 연동) 시간대/맵 조건을 우선 적용
        let availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e || !isEnabledScenarioEvent(e)) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? (String(e.text || '').includes('{2}') ? 2 : 1));
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 2 || vc !== 0) return false;

          const tod = getScenarioEventTimeOfDay(e);
          if (tod !== 'both' && tod !== timeKey) return false;

          // mapId가 비어있으면 "어느 맵에서든" 발생 가능, 값이 있으면 현재 선택 맵과 일치해야 함
          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;

          // zoneId가 있으면, 현재 캐릭터의 구역과 일치해야 발생
          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환
        if (availableEvents.length === 0) {
          availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text || !isEnabledScenarioEvent(e)) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (!String(e.text).includes('{2}')) return false;
            const tod = getScenarioEventTimeOfDay(e);
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        const randomEvent = availableEvents.length
          ? availableEvents[Math.floor(Math.random() * availableEvents.length)]
          : null;

        if (!randomEvent?.text) {
          // (유저용 로그 아님) 조우했지만 이벤트가 없을 때는 조용히 스킵
          upsertRuntimeSurvivor(survivorMap, actor);
          upsertRuntimeSurvivor(survivorMap, target);
          continue;
        }
        const eventText = String(randomEvent.text)
          .replace(/\{1\}/g, `[${actor.name}]`)
          .replace(/\{2\}/g, `[${target.name}]`);
        addLog(eventText, 'normal');
      } else {
        // [🌳 1인 이벤트]
        const timeKey = nextPhase === 'night' ? 'night' : 'day';
        let soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e || !isEnabledScenarioEvent(e)) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? 1);
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 1 || vc !== 0) return false;

          const tod = getScenarioEventTimeOfDay(e);
          if (tod !== 'both' && tod !== timeKey) return false;

          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환: {2} 없는 이벤트를 1인 이벤트로 취급
        if (soloEvents.length === 0) {
          soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text || !isEnabledScenarioEvent(e)) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (String(e.text).includes('{2}')) return false;
            const tod = getScenarioEventTimeOfDay(e);
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        const scriptSoloChance = Math.max(0, Math.min(1, Number((pvpProbCfg && pvpProbCfg.scriptSoloChance) != null ? pvpProbCfg.scriptSoloChance : 0.22)));
        if (soloEvents.length > 0 && Math.random() < scriptSoloChance) {
          const randomEvent = soloEvents[Math.floor(Math.random() * soloEvents.length)];
          const eventText = String(randomEvent.text)
            .replace(/\{1\}/g, `[${actor.name}]`)
            .replace(/\{2\}/g, `[${actor.name}]`);
          addLog(eventText, 'normal');
        } else {
          // 폴백: 동적 이벤트 생성
          const eventResult = safeGenerateDynamicEvent(actor, nextDay, ruleset, nextPhase, publicItems, {
            farmFocus: isDay1MorningFarmPhase || isEarlyRouteFarmingActor(actor),
            zoneName: getZoneName(actor?.zoneId || ''),
          });
          if (eventResult && eventResult.log && !eventResult.silent) {
            addLog(eventResult.log, Number(eventResult?.damage || 0) > 0 ? 'highlight' : 'normal');
          }

          // ✅ 동적 이벤트 보상: 크레딧
          const perkFx = getActorPerkEffects(actor);
          const erCr = applyPerkCreditBonus(Math.max(0, Number(eventResult?.earnedCredits || 0)), perkFx?.eventCreditsPct || 0);
          if (erCr > 0) {
            earnedCredits += erCr;
            actor.simCredits = Number(actor.simCredits || 0) + erCr;
            emitRunEvent('gain', { who: String(actor && actor._id ? actor._id : ''), itemId: 'CREDITS', qty: erCr, source: 'event', zoneId: String(actor && actor.zoneId ? actor.zoneId : '') }, atNow());
          }

          // ✅ 수집/사냥 이벤트 페널티: (1) 다음 페이즈 1회 교전 확률 증가 (2) 같은 페이즈 즉시 '표적 우선'
          const pb = Math.max(0, Number(eventResult?.pvpBonusNext || 0));
          if (pb > 0) {
            // 다음 페이즈: 공격(initiator) 확률 보너스
            actor._gatherPvpBonus = Math.max(Number(actor._gatherPvpBonus || 0), pb);
            actor._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;

            // 같은 페이즈: 수집 직후 노출(타겟 우선)
            actor._immediateDanger = Math.max(Number(actor._immediateDanger || 0), pb);
            actor._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }

          // ✅ 동적 이벤트 드랍(소량): addItemToInventory로 일관 처리 + 즉시 1회 조합 시도
          // - 기존(레거시) eventResult.newItem / eventResult.drop도 같이 호환
          const legacyNewItem = eventResult && eventResult.newItem ? eventResult.newItem : null;
          const rawEventDrops = [
            ...(Array.isArray(eventResult?.drops) ? eventResult.drops : []),
            ...(eventResult?.drop ? [eventResult.drop] : []),
            ...(legacyNewItem ? [{ item: (legacyNewItem.item || legacyNewItem), itemId: (legacyNewItem.itemId || legacyNewItem.id || legacyNewItem._id || ''), qty: (legacyNewItem.qty || 1) }] : []),
          ];
          const normalizedEventDrops = normalizeRewardDropEntries(rawEventDrops, publicItems, itemNameById);
          const eventCraftGoal = buildCraftGoal(actor.inventory, craftables, itemNameById, {
            goalTier: actor?.goalGearTier,
            goalItemKeys: pickGoalLoadoutKeys(actor),
            perkEffects: perkFx,
          });
          const eventGoalMissingIds = new Set(
            (Array.isArray(eventCraftGoal?.missing) ? eventCraftGoal.missing : [])
              .map((m) => String(m?.itemId || ''))
              .filter(Boolean)
          );

          for (const resolvedDrop of normalizedEventDrops) {
            const dropId = String(resolvedDrop.itemId || '');
            if (!dropId) continue;
            const eventItemBias = getPerkEventItemBias(perkFx);
            const dropQty = maybeBoostDropQty(Math.max(1, Number(resolvedDrop.qty || 1)), eventItemBias * 0.55, 1);
            const dropItem = markInventoryGoalItem(resolvedDrop.item || null, eventGoalMissingIds.has(dropId));

            actor.inventory = addItemToInventory(actor.inventory, dropItem, dropId, dropQty, nextDay, ruleset);
            const metaD = actor.inventory && actor.inventory._lastAdd ? actor.inventory._lastAdd : null;
            const gotD = Math.max(0, Number(metaD && metaD.acceptedQty != null ? metaD.acceptedQty : dropQty));
            if (gotD > 0) {
              const nmD = itemDisplayName(dropItem || { _id: dropId, name: itemNameById?.[dropId] || resolvedDrop?.name });
              addLog("🧾 [" + actor.name + "] 획득: " + itemIcon(dropItem || { type: "" }) + " [" + nmD + "] x" + gotD + formatInvAddNote(metaD, dropQty, actor.inventory, ruleset), "normal");
              emitRunEvent("gain", { who: String(actor && actor._id ? actor._id : ""), itemId: dropId, qty: gotD, source: "event", zoneId: String(actor && actor.zoneId ? actor.zoneId : "") }, atNow());

              const craftedE = tryAutoCraftFromLoot(actor.inventory, dropId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(actor));
              applyLootCraftResult(actor, craftedE, itemMetaById, atNow(), actor?.zoneId);
            }
          }

          if (eventResult.damage) actor.hp -= eventResult.damage;
          if (eventResult.recovery) {
            const maxHpNow = Math.max(1, Number(actor?.maxHp || 100));
            const bonusRecovery = Math.max(0, perkNumber(perkFx?.eventRecoveryPlus || 0));
            const finalRecovery = applyHealingModifier(actor, Math.round((Math.max(0, Number(eventResult.recovery || 0)) + bonusRecovery) * getNonCombatRegenMultiplier(actor)));
            actor.hp = Math.min(maxHpNow, Number(actor.hp || 0) + finalRecovery);
          }
          const eventEffects = applyRuntimeEffectPayloads(actor, eventResult?.newEffects || eventResult?.newEffect);
          eventEffects.results.forEach((row) => {
            if (row?.reason === 'immune') addLog(`🛡️ [${actor.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
            else if (row?.reason === 'resisted') addLog(`🧷 [${actor.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
            else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
              const desc = describeRuntimeEffect(row.effect);
              if (desc) addLog(`🪄 [${actor.name}] ${desc}`, 'system');
            }
          });
          emitEffectRunEvents(actor, eventEffects.results, { source: 'event', reason: 'dynamic_event', zoneId: String(actor?.zoneId || '') }, atNow());
        }

        actor = normalizeRuntimeSurvivor(actor);
        if (actor.hp <= 0) {
          setDeathMetadata(actor, 'event_accident', { causeName: '사고' });
          actor.deadAtPhaseIdx = phaseIdxNow;
          actor.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
          addLog(`💀 [${actor.name}]이(가) 사고로 사망했습니다.`, 'death');
          newDeadIds.push(actor._id);
          emitDeathRunEventOnce(actor, { reason: 'event_accident', cause: '사고' });
          flushDeadSnapshots(appendPhaseDeadSnapshots(actor));
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
    setMatchSec(shouldFinishByElimination ? (phaseStartSec + phaseRuntimeOffsetSec) : (phaseStartSec + phaseDurationSec));

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
    if (isRefreshingMapsRef.current) return false;
    isRefreshingMapsRef.current = true;
    setIsRefreshingMapSettings(true);
    try {
      const mapsRes = await apiGet('/public/maps', { timeoutMs: 8000 });
      const mapsList = Array.isArray(mapsRes) ? mapsRes : [];
      if (!mapsList.length) {
        addLog('⚠️ 맵 설정 새로고침 실패(맵 목록 없음)', 'death');
        showMapRefreshToast('맵 목록이 없습니다.', 'error');
        return false;
      }

      mapsRef.current = mapsList;
      setMaps(mapsList);

      const keepId = String(activeMapIdRef.current || activeMapId || '');
      const nextId = (keepId && mapsList.some((m) => String(m?._id) === keepId))
        ? keepId
        : String(mapsList[0]?._id || '');

      if (nextId) {
        activeMapIdRef.current = nextId;
        setActiveMapId(nextId);
        activeMapRef.current = mapsList.find((m) => String(m?._id) === nextId) || null;
      }

      addLog(reason === 'start' ? '🔄 맵 설정을 서버에서 새로 불러왔습니다.' : '🔄 맵 설정을 새로고침했습니다.', 'system');
      showMapRefreshToast(reason === 'start' ? '서버에서 새로 불러옴' : '새로고침 완료', 'ok');
      return true;
    } catch (e) {
      addLog('⚠️ 맵 설정 새로고침 실패(기존 설정 유지)', 'death');
      showMapRefreshToast('새로고침 실패(기존 유지)', 'error');
      return false;
    } finally {
      isRefreshingMapsRef.current = false;
      setIsRefreshingMapSettings(false);
    }
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
    finishGame(aliveTeams[0]?.members || survivors, killCounts, assistCounts);
  }, [survivors.length, day, loading, isGameOver]);


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
  }, [autoPlay, autoSpeed, matchSec, loading, isAdvancing, isGameOver, showMarketPanel, pendingTranscendPick, day, phase, settings?.rulesetId, survivors.length, startBlocked]);

  // ======== Market actions ========
  function ensureCharSelected() {
    if (!selectedCharId) {
      setMarketMessage('생존자를 선택해주세요.');
      return false;
    }
    return true;
  };

  function grantRuntimeItem(actor, item, itemId, qty, ruleset) {
    const ch = {
      ...(actor || {}),
      inventory: Array.isArray(actor?.inventory) ? actor.inventory.map((entry) => ({ ...entry })) : [],
    };
    ch.inventory = addItemToInventory(ch.inventory, item, itemId, qty, day, ruleset);
    const meta = ch.inventory?._lastAdd || null;
    const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
    if (got > 0) autoEquipBest(ch, itemMetaById);
    return { actor: normalizeRuntimeSurvivor(ch), meta, got };
  }

  function devGrantItemToSelected() {
    if (!showMarketPanel) return;
    if (isAdvancing || isGameOver) {
      setMarketMessage('진행 중이거나 종료된 게임에서는 개발자 아이템 지급을 사용할 수 없습니다.');
      return;
    }
    if (!ensureCharSelected()) return;

    const itemId = String(devGrantItemId || '').trim();
    const item = devGrantItemOptions.find((it) => String(it?._id || '') === itemId) || null;
    if (!item) {
      setMarketMessage('지급할 아이템을 선택해주세요.');
      return;
    }

    const qty = Math.max(1, Math.min(99, Math.floor(Number(devGrantQty || 1))));
    const ruleset = getRuleset(settings?.rulesetId);
    const current = selectedChar;
    if (!current) {
      setMarketMessage('선택 캐릭터를 찾을 수 없습니다.');
      return;
    }

    const res = grantRuntimeItem(current, item, itemId, qty, ruleset);
    const nm = itemDisplayName(item);
    setMarketMessage('');

    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => {
      if (String(s?._id) !== String(selectedCharId)) return s;
      return res.actor;
    }));

    addLog(`🛠 [${current.name}] 개발자 아이템 지급: ${itemIcon(item)} ${nm} ${gainText(res.got)}${formatInvAddNote(res.meta, qty, res.actor.inventory, ruleset)}`, res.got > 0 ? 'highlight' : 'death');
    emitItemGainIfAny(res.got, {
      who: current.name,
      whoId: current._id,
      itemId,
      source: 'dev_tool',
      sourceKind: 'manual_grant',
      zoneId: current.zoneId,
    }, { day, phase, sec: matchSec });
    setMarketMessage(res.got > 0
      ? `${current.name}에게 ${nm} x${res.got} 지급 완료`
      : `${current.name}에게 ${nm} 지급 실패`);
  }

  async function doCraft(itemId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`craft:${itemId}`, 1);
      const res = await apiPost('/items/craft', { characterId: selectedCharId, itemId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🛠️ [조합] ${res?.message || '조합 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [조합 실패] ${msg}`, 'death');
    }
  };

  async function doKioskTransaction(kioskId, catalogIndex) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`kiosk:${kioskId}:${catalogIndex}`, 1);
      const res = await apiPost(`/kiosks/${kioskId}/transaction`, { characterId: selectedCharId, catalogIndex, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🏪 [키오스크] ${res?.message || '거래 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [키오스크 실패] ${msg}`, 'death');
    }
  };

  async function doDroneBuy(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`drone:${offerId}`, 1);
      const res = await apiPost('/drone/buy', { characterId: selectedCharId, offerId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🚁 [드론] ${res?.message || '구매 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [드론 구매 실패] ${msg}`, 'death');
    }
  };

  async function doPerkPurchase(code) {
    try {
      setMarketMessage('');
      const perkCode = String(code || '').trim();
      if (!perkCode) {
        setMarketMessage('특전 코드가 올바르지 않습니다.');
        return;
      }
      const res = await apiPost('/perks/purchase', { code: perkCode });
      applyUserEconomyProgress({ lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      addLog(`🎖️ [특전] ${res?.message || '구매 완료'} (${perkCode})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [특전 구매 실패] ${msg}`, 'death');
    }
  };

  async function createTradeOffer() {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const give = compactIO(tradeDraft.give);
      const want = compactIO(tradeDraft.want);
      const wantCredits = Math.max(0, Number(tradeDraft.wantCredits || 0));
      const note = String(tradeDraft.note || '');

      if (give.length === 0) {
        setMarketMessage('give 항목이 비었습니다.');
        return;
      }

      await apiPost('/trades', {
        fromCharacterId: selectedCharId,
        give,
        want,
        wantCredits,
        note,
      });

      addLog('🔁 [거래] 오퍼 생성 완료', 'system');
      setTradeDraft({ give: [{ itemId: '', qty: 1 }], want: [{ itemId: '', qty: 1 }], wantCredits: 0, note: '' });
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 오퍼 실패] ${msg}`, 'death');
    }
  };

  async function cancelTradeOffer(offerId) {
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/cancel`, {});
      addLog('🧾 [거래] 오퍼 취소 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 취소 실패] ${msg}`, 'death');
    }
  };

  async function acceptTradeOffer(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const res = await apiPost(`/trades/${offerId}/accept`, { toCharacterId: selectedCharId });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog('✅ [거래] 수락 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 수락 실패] ${msg}`, 'death');
    }
  };

  // 탭 전환 시 필요한 데이터 갱신
  useEffect(() => {
    if (marketTab === 'trade') {
      void fireAndReport('marketTab.loadTrades', () => loadTrades());
    }
    if (marketTab === 'craft' || marketTab === 'kiosk' || marketTab === 'drone' || marketTab === 'perk') {
      void fireAndReport('marketTab.loadMarket', () => loadMarket());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketTab]);

  // activeMap 로딩이 순간적으로 비는 경우(=맵 미지정/리프레시 타이밍)에도
  // 금지구역 로직이 동작하도록 zones 기반 fallback을 둡니다.
  const activeMapEff = useMemo(() => activeMap || ((Array.isArray(zones) && zones.length)
    ? { _id: String(activeMapId || 'local'), zones }
    : null), [activeMap, activeMapId, zones]);
  const forbiddenNow = useMemo(() => (
    activeMapEff
      ? new Set(getForbiddenZoneIdsForPhase(activeMapEff, day, phase, getRuleset(settings?.rulesetId)))
      : new Set()
  ), [activeMapEff, day, phase, settings?.rulesetId]);

  const shouldComputeHeavyDerived = showResultModal || showMarketPanel || uiModal === 'map' || uiModal === 'chars' || uiModal === 'log';
  const shouldComputeMapDerived = true;

  // 🧾 런 요약: 획득 경로(아이템만 집계, 크레딧 제외)
  const heavyRunSummaries = useMemo(() => {
    if (!shouldComputeHeavyDerived) return getEmptyRunSummaries();
    return safeRenderCompute('heavyRunSummaries', () => buildRunSummaries({
      runEvents,
      itemNameById,
      zoneNameById,
      itemMetaById,
      survivors,
      dead,
      killCounts,
      assistCounts,
    }), getEmptyRunSummaries());
  }, [runEvents, itemNameById, zoneNameById, itemMetaById, survivors, dead, killCounts, assistCounts, shouldComputeHeavyDerived]);

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
  } = heavyRunSummaries;

  const simulationDiagnostics = useMemo(() => {
    if (!shouldComputeHeavyDerived) return getEmptySimulationDiagnostics();
    return safeRenderCompute('simulationDiagnostics', () => buildSimulationDiagnostics({
      runEvents,
      survivors,
      dead,
      itemMetaById,
      zoneNameById,
      ruleset: getRuleset(settings?.rulesetId),
    }), getEmptySimulationDiagnostics());
  }, [runEvents, survivors, dead, itemMetaById, zoneNameById, settings?.rulesetId, shouldComputeHeavyDerived]);
  const simulationDiagnosticsLine = useMemo(
    () => formatDiagnosticsLine(simulationDiagnostics),
    [simulationDiagnostics]
  );

  const zonePos = useMemo(() => {
    if (!shouldComputeMapDerived) return {};
    return safeRenderCompute('zonePos', () => buildZonePositions(zones), {});
  }, [zones, shouldComputeMapDerived]);

  const zoneEdges = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeRenderCompute('zoneEdges', () => buildZoneEdges({ zones, zoneGraph: baseZoneGraph }), []);
  }, [baseZoneGraph, zones, shouldComputeMapDerived]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const pingNow = useMemo(() => Date.now(), [runEvents]);
  const recentPings = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeRenderCompute('recentPings', () => buildRecentPings({ runEvents, pingNow, zonePos }), []);
  }, [runEvents, pingNow, zonePos, shouldComputeMapDerived]);

  const detonationRiskSummary = useMemo(() => safeRenderCompute('detonationRiskSummary', () => buildDetonationRiskSummary({
    day,
    activeMap,
    zones,
    forbiddenNow,
    rulesetId: settings?.rulesetId,
    survivors,
    phase,
    getZoneName,
  }), getEmptyDetonationRiskSummary()), [day, activeMap, zones, forbiddenNow, settings?.rulesetId, survivors, phase, getZoneName]);

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
      <header hidden aria-hidden="true">
        <section id="header-id1">
          <ul>
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">ETERNAL</span>
                  <span className="logo-main">HUNGER</span>
                </div>
              </Link>
            </li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/help">도움말</Link></li>
            <li><Link href="/simulation" style={{ color: '#0288d1' }}>▶ 게임 시작</Link></li>
          </ul>
        </section>
      </header>

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className={`simulation-container modal-layout ${showMarketPanel ? 'devtools-open' : ''}`}>
        {/* 생존자 현황판 */}
        <aside className={`survivor-board ${uiModal === 'chars' ? 'modal-open' : ''}`}>
          {uiModal === 'chars' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}
          <h2>생존자 ({survivors.length}명)</h2>
          <div className="survivor-grid">
            {survivors.map((char) => (
              <div key={char._id} className="survivor-card alive">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                {(() => {
                  const teamState = getTeamStateForActor(char);
                  if (!teamState) return null;
                  return (
                    <div
                      className={`team-status-badge ${teamState.missingCount > 0 ? 'damaged' : ''}`}
                      title={`${teamState.teamName} 원래 팀원: ${teamState.rosterNames.join(', ') || '확인 불가'}`}
                    >
                      👥 {teamState.label}
                    </div>
                  );
                })()}
                <div className="skill-tag">⭐ {char.specialSkill?.name || '기본 공격'}</div>
	                <div className={`zone-badge ${forbiddenNow.has(String(char.zoneId || '')) ? 'forbidden' : ''}`}>
	                  📍 {getZoneName(char.zoneId || '__default__')}
	                </div>

                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, rowGap: 4, justifyContent: 'center', fontSize: 12, opacity: 0.95 }}>
                  <span>❤️ {Math.max(0, Math.floor(Number(char.hp ?? 0)))}/{Math.max(1, Math.floor(Number(char.maxHp ?? 100)))}</span>
                  {(() => {
                    const detVal = Number(char.detonationSec);
                    if (!Number.isFinite(detVal)) return null;

                    const rs = getRuleset(settings?.rulesetId);
                    const detMax = Number(char.detonationMaxSec ?? rs?.detonation?.maxSec ?? 30);
                    const critical = Math.max(0, Number(rs?.detonation?.criticalSec ?? 5));

                    const totalZonesForUI = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
                    const forbiddenCnt = forbiddenNow?.size ? forbiddenNow.size : 0;
                    const safeLeftForUI = Math.max(0, totalZonesForUI - forbiddenCnt);
                    const detForceAll = Math.max(0, Number(rs?.detonation?.forceAllAfterSec ?? 40));
                    const curPhaseDur = Math.max(0, Number(getPhaseDurationSec(rs, day, phase) || 0));
                    const forceAllOn = (safeLeftForUI <= 2 && totalZonesForUI > 0 && curPhaseDur >= detForceAll);

                    const zid = String(char.zoneId || '');
                    const isForbiddenUi = forceAllOn ? true : forbiddenNow.has(zid);

                    const detFloor = Math.max(0, Math.floor(detVal));
                    const maxFloor = Number.isFinite(detMax) ? Math.max(0, Math.floor(detMax)) : null;
                    const isCritical = detFloor <= critical;
                    const label = maxFloor !== null ? `${detFloor}/${maxFloor}s` : `${detFloor}s`;

                    return (
                      <span
                        title={isForbiddenUi ? '금지구역: 폭발 타이머 감소' : '안전구역: 폭발 타이머 회복'}
                        style={{
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.20)',
                          background: isCritical ? 'rgba(255, 82, 82, 0.42)' : isForbiddenUi ? 'rgba(255, 82, 82, 0.26)' : 'rgba(0,0,0,0.22)',
                          color: '#fff',
                        }}
                      >
                        {isCritical ? '⚠️ ' : ''}⏳ {label}
                      </span>
                    );
                  })()}

                  {normalizeRulesetId(settings?.rulesetId) === DEFAULT_RULESET_ID && (
                    <span>⚡ {Number.isFinite(Number(char.gadgetEnergy)) ? Math.floor(Number(char.gadgetEnergy)) : 0}</span>
                  )}
                </div>

                {(() => {
                  const es = getEquipSummary(char);
                  return (
                    <div className="equip-summary" title={es.full}>
                      🧰 {es.short}
                    </div>
                  );
                })()}

                <div className="inventory-summary">
                  <span className="bag-icon">🎒</span>
                  <span className="inv-count">{Array.isArray(char.inventory) ? char.inventory.length : 0}/3</span>
                  <div className="inv-tooltip">
                    {(Array.isArray(char.inventory) ? char.inventory : []).map((it, i) => (
                      <div key={i} className="inv-item-mini">
                        {itemIcon(it)} {itemDisplayName(it)}
                        {Number(it?.qty || 1) > 1 ? ` x${Number(it.qty)}` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}

                <div className="status-effects-container">
                  {(() => {
                    const uiPhaseIdx = Math.max(0, Number(day || 0) * 2 + (timeOfDay === 'day' ? 0 : 1));
                    const du = Number(char?._immediateDangerUntilPhaseIdx ?? -1);
                    const dv = Math.max(0, Number(char?._immediateDanger || 0));
                    if (dv <= 0 || du !== uiPhaseIdx) return null;
                    const pct = Math.min(99, Math.max(1, Math.round(dv * 100)));
                    return (
                      <span title="수집/사냥 직후: 교전 유발(표적 우선)" className="effect-badge">
                        ⚠️ 노출 +{pct}%
                      </span>
                    );
                  })()}
                  {getVisibleRuntimeEffects(char.activeEffects).map((eff, i) => {
                    const nm = String(eff?.name || '');
                    const dur = Number.isFinite(Number(eff?.remainingDuration)) ? Math.max(0, Number(eff.remainingDuration)) : null;
                    const icon = nm === '식중독' ? '🤢'
                      : nm === '중독' ? '☠️'
                        : nm === '화상' ? '🔥'
                          : nm === '보호막' ? '🛡️'
                            : nm === '재생' ? '✨'
                              : nm === '에어본' ? '🌀'
                                : nm === '치유 감소' ? '🩹'
                                  : nm === '기절' ? '💫'
                                    : nm === '넉백' ? '↔️'
                                      : nm === '이동 속도 감소' ? '↘️'
                                        : nm === '흡혈' ? '🩸'
                                          : nm === '이동 속도 증가' ? '↗️'
                                            : nm === '쿨다운 증가' ? '⏫'
                                              : nm === '쿨다운 감소' ? '⏬'
                                                : '🤕';
                    const stacks = Math.max(1, Number(eff?.stacks || 1));
                    const label = eff?._boardLabel || (dur !== null ? `${icon}${nm}${stacks > 1 ? ` x${stacks}` : ''} ${dur}s` : `${icon}${nm}${stacks > 1 ? ` x${stacks}` : ''}`);
                    return (
                      <span key={`${nm}-${i}`} title={eff?._boardTitle || (dur !== null ? `${nm}${stacks > 1 ? ` x${stacks}` : ''} (${dur}s)` : nm)} className="effect-badge">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: '30px', color: '#ff5252' }}>사망자 ({dead.length}명)</h2>
          <div className="survivor-grid">
            {dead.map((char) => (
              <div key={char._id} className="survivor-card dead">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                {(() => {
                  const teamState = getTeamStateForActor(char);
                  if (!teamState) return null;
                  return (
                    <div
                      className={`team-status-badge ${teamState.missingCount > 0 ? 'damaged' : ''}`}
                      title={`${teamState.teamName} 원래 팀원: ${teamState.rosterNames.join(', ') || '확인 불가'}`}
                    >
                      👥 {teamState.label}
                    </div>
                  );
                })()}
                <div className="zone-badge dead">📍 {getZoneName(char.zoneId || '__default__')}</div>
                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
{killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}
              </div>
            ))}
          </div>
        </aside>

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


{(() => {
  if (day <= 0) return null;
  const s = spawnState && String(spawnState.mapId || '') === String(activeMapId || '') ? spawnState : null;
  if (!s) return null;

  const unopenedCrates = (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : []).filter((c) => c && !c.opened).length;
  const unopenedTranscendCrates = (Array.isArray(s.transcendCrates) ? s.transcendCrates : []).filter((c) => c && !c.opened).length;
  const activeDimensionRifts = listActiveDimensionRifts(s).length;
  const unpickedCore = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked).length;

  const meteorCnt = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked && String(n.kind) === 'meteor').length;
  const lifeTreeCnt = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked && String(n.kind) === 'life_tree').length;

  const bosses = s.bosses || {};
  const alphaOn = !!bosses?.alpha?.alive;
  const omegaOn = !!bosses?.omega?.alive;
  const weaklineOn = !!bosses?.weakline?.alive;

  const wildlifeMap = (s?.wildlife && typeof s.wildlife === 'object') ? s.wildlife : {};
  const eligibleWildZones = (Array.isArray(zones) ? zones : [])
    .filter((z) => z && z.zoneId)
    .filter((z) => !zoneHasKioskFlag(z))
    .map((z) => String(z.zoneId));
  const wildlifeTotal = eligibleWildZones.reduce((sum, zid) => sum + Math.max(0, Number(wildlifeMap?.[zid] ?? 0)), 0);
  const wildlifeEmpty = eligibleWildZones.reduce((cnt, zid) => cnt + ((Math.max(0, Number(wildlifeMap?.[zid] ?? 0)) <= 0) ? 1 : 0), 0);

  if (!unopenedCrates && !unopenedTranscendCrates && !activeDimensionRifts && !unpickedCore && !alphaOn && !omegaOn && !weaklineOn && wildlifeTotal <= 0) return null;

  return (
    <div className="worldspawn-toolbar">
      <span className="ws-title">🌍 월드스폰</span>
      <span className="ws-chip">🟪 전설상자: <b>{unopenedCrates}</b></span>
      <span className="ws-chip">🎁 초월상자: <b>{unopenedTranscendCrates}</b></span>
      <span className="ws-chip">🌀 차원의 틈: <b>{activeDimensionRifts}</b></span>
      <span className="ws-chip">🌠 오브젝트: 운석 <b>{meteorCnt}</b> / 생나 <b>{lifeTreeCnt}</b></span>
      <span className="ws-chip" title="시간대별 종별 야생동물 스폰">🦌 야생동물: <b>{wildlifeTotal}</b>{wildlifeEmpty > 0 ? ` (빈구역 ${wildlifeEmpty})` : ''}</span>
      <span className="ws-chip">👹 알파: <b>{alphaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 오메가: <b>{omegaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 위클라인: <b>{weaklineOn ? 'ON' : 'off'}</b></span>
    </div>
  );
})()}

          {/* 🗺️ 미니맵: 구역 그래프 + 캐릭터 위치 */}
          <div className={`minimap-panel battlefield-panel ${uiModal === 'map' ? 'modal-open' : ''}`}>
            {uiModal === 'map' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}
            {(() => {
              const z = Array.isArray(zones) ? zones : [];
              if (!z.length) return <div className="minimap-empty">미니맵 데이터가 없습니다.</div>;

              const aliveByZone = {};
              (Array.isArray(survivors) ? survivors : []).forEach((c) => {
                const mid = String(c?.mapId || '').trim();
                if (mid && String(activeMapId || '') && mid !== String(activeMapId)) return;
                const zid = String(c?.zoneId || '');
                if (!zid) return;
                if (!aliveByZone[zid]) aliveByZone[zid] = [];
                aliveByZone[zid].push(c);
              });
              const deadByZone = {};
              (Array.isArray(dead) ? dead : []).forEach((c) => {
                const mid = String(c?.mapId || '').trim();
                if (mid && String(activeMapId || '') && mid !== String(activeMapId)) return;
                const zid = String(c?.zoneId || '');
                if (!zid) return;
                if (!deadByZone[zid]) deadByZone[zid] = [];
                deadByZone[zid].push(c);
              });

              const hyperloopSelectedChar = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === String(hyperloopCharId)) || null;
              const selectedZoneId = hyperloopSelectedChar ? String(hyperloopSelectedChar?.zoneId || '') : '';

              const OFF = [
                [0, 0], [3, 0], [-3, 0], [0, 3], [0, -3],
                [3, 3], [-3, 3], [3, -3], [-3, -3],
                [5, 0], [-5, 0], [0, 5], [0, -5],
              ];
              const TOKEN_OFF = [
                [0, 0], [4.4, 0], [-4.4, 0], [0, 4.4], [0, -4.4],
                [3.3, 3.3], [-3.3, 3.3], [3.3, -3.3], [-3.3, -3.3],
                [6.2, 1.8], [-6.2, 1.8], [1.8, 6.2], [1.8, -6.2],
              ];

              return (
                <div className="minimap-canvas">
                  <svg className="minimap-svg" viewBox="0 0 100 100" role="img" aria-label="미니맵">
                    {z.map((zone) => {
                      const id = String(zone?.zoneId || '');
                      const p = zonePos?.[id];
                      if (!id || !p) return null;
                      const isF = forbiddenNow.has(id);
                      return (
                        <circle
                          key={`surface-${id}`}
                          cx={p.x}
                          cy={p.y}
                          r={6.35}
                          className={`minimap-zone-surface ${isF ? 'forbidden' : ''}`}
                        />
                      );
                    })}

                    {/* 연결선 */}
                    {zoneEdges.map(([a, b]) => {
                      const pa = zonePos?.[a];
                      const pb = zonePos?.[b];
                      if (!pa || !pb) return null;
                      return (
                        <line
                          key={`e-${a}-${b}`}
                          x1={pa.x}
                          y1={pa.y}
                          x2={pb.x}
                          y2={pb.y}
                          className="minimap-edge"
                        />
                      );
                    })}

                    {/* 구역 노드 */}
                    {z.map((zone) => {
                    const id = String(zone?.zoneId || '');
                    const p = zonePos?.[id];
                    if (!id || !p) return null;
                    const isF = forbiddenNow.has(id);
                    const isSelZone = !!selectedZoneId && selectedZoneId === id;
                    const nm = String(getZoneName(id) || id);
                    const aliveHere = aliveByZone[id]?.length || 0;
                    const deadHere = deadByZone[id]?.length || 0;
                    const nodeR = 4.8;
                    const labelSize = nm.length >= 6 ? 2.05 : nm.length >= 5 ? 2.3 : 2.65;
                    const hasHyperloop = hyperloopZoneSet.has(id);

                    return (
                      <g key={`z-${id}`}>
                        <text
                          className="minimap-zone-label"
                          x={p.x}
                          y={p.y - nodeR - 1.4}
                          textAnchor="middle"
                          fontSize={labelSize}
                        >
                          {nm}
                        </text>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={nodeR}
                          className={`minimap-node ${isF ? 'forbidden' : ''} ${isSelZone ? 'selected' : ''}`}
                        />
                        {/* 배경 지도(하이퍼루프 이미지)에 이미 지역명이 있으므로, SVG 텍스트 라벨은 숨긴다. */}
                        <title>{nm}</title>

                        {/* 하이퍼루프 */}
                        {hasHyperloop ? (
                          <text x={p.x + nodeR} y={p.y - 4.2} textAnchor="middle" fontSize="5.0" fill="rgba(180,220,255,0.92)">🌀</text>
                        ) : null}

                        {/* 생존/사망 수 */}
                        {(aliveHere > 0 || deadHere > 0) ? (
                          <text
                            x={p.x}
                            y={p.y + 5.8}
                            textAnchor="middle"
                            fontSize="3.0"
                            fill="rgba(255,255,255,0.72)"
                          >
                            {aliveHere > 0 ? `+${aliveHere}` : ''}{deadHere > 0 ? ` / -${deadHere}` : ''}
                          </text>
                        ) : null}

                        {/* 캐릭터 마커 */}
                        {(aliveByZone[id] || []).slice(0, 12).map((c, idx) => {
                          const o = TOKEN_OFF[idx % TOKEN_OFF.length];
                          const cx = p.x + o[0] * 0.55;
                          const cy = p.y + o[1] * 0.55;
                          const isSel = String(c?._id || '') === String(hyperloopCharId || '');
                          const hpRatio = Math.max(0, Math.min(1, Number(c?.hp || 0) / Math.max(1, Number(c?.maxHp || 100))));
                          const tokenImg = String(c?.previewImage || '/Images/default_image.png');
                          const teamState = getTeamStateForActor(c);
                          const teamColor = teamState?.missingCount > 0
                            ? 'rgba(255, 180, 80, 0.94)'
                            : 'rgba(112, 221, 148, 0.94)';
                          const tokenTitle = `${String(c?.name || '캐릭터')} / HP ${Math.floor(Number(c?.hp || 0))}/${Math.max(1, Math.floor(Number(c?.maxHp || 100)))} / ${nm}`;
                          return (
                            <g key={`a-${id}-${c._id || idx}`} className={`minimap-character-token ${isSel ? 'selected' : ''}`}>
                              <title>{tokenTitle}</title>
                              {isSel ? (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={3.3}
                                  fill="none"
                                  stroke="rgba(255,215,0,0.92)"
                                  strokeWidth="0.8"
                                />
                              ) : null}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={2.65}
                                fill="rgba(8, 14, 24, 0.92)"
                                stroke={isSel ? 'rgba(255,215,0,0.95)' : teamColor}
                                strokeWidth="0.55"
                              />
                              <image
                                href={tokenImg}
                                x={cx - 1.75}
                                y={cy - 1.75}
                                width="3.5"
                                height="3.5"
                                preserveAspectRatio="xMidYMid slice"
                              />
                              <path
                                d={`M ${cx - 2.55} ${cy + 2.95} H ${cx - 2.55 + (5.1 * hpRatio)}`}
                                className={hpRatio <= 0.32 ? 'minimap-token-hp critical' : 'minimap-token-hp'}
                              />
                              <text
                                x={cx}
                                y={cy + 5.8}
                                textAnchor="middle"
                                className="minimap-token-label"
                              >
                                {String(c?.name || '?').slice(0, 2)}
                              </text>
                            </g>
                          );
                        })}
                        {(deadByZone[id] || []).slice(0, 8).map((c, idx) => {
                          const o = OFF[(idx + 2) % OFF.length];
                          return (
                            <circle
                              key={`d-${id}-${c._id || idx}`}
                              cx={p.x + o[0] * 0.55}
                              cy={p.y + o[1] * 0.55}
                              r={0.85}
                              fill="rgba(170,170,170,0.70)"
                              stroke="rgba(0,0,0,0.28)"
                              strokeWidth="0.35"
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                    {recentPings.map((ping) => {
                      const p = zonePos?.[String(ping?.zoneId || '')];
                      if (!p) return null;
                      return (
                        <g
                          key={`ping-${ping.id}`}
                          className={`minimap-ping ${String(ping.kind || '')}`}
                          transform={`translate(${p.x} ${p.y})`}
                        >
                          <circle r="7.8" />
                          <text className="minimap-ping-icon" x="0" y="1.5" textAnchor="middle">
                            {ping.icon}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
            <div className="minimap-legend">
              <span className="minimap-dot alive" /> 생존자 · <span className="minimap-dot dead" /> 사망자 · <span className="minimap-dot forbidden" /> 금지구역 · ⭐ 하이퍼루프 대상
            </div>

            {day > 0 && hyperloopDestIds.length ? (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.22)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ opacity: 0.9 }} title="하이퍼루프는 맵 내 장치(패드)에서만 사용 가능">
                    🌀 하이퍼루프
                  </span>
                  <span style={{ opacity: 0.9 }}>
                    패드: <b>{hyperloopPadName || hyperloopPadZoneId || '자동'}</b>
                  </span>

                  {isSelectedCharOnHyperloopPad ? (
                    <>
                      <select
                        value={hyperloopDestId}
                        onChange={(e) => setHyperloopDestId(e.target.value)}
                        disabled={loading || isAdvancing || isGameOver}
                        title="어드민(맵)에서 설정한 하이퍼루프 목적지(로컬 저장)"
                        style={{
                          padding: '6px 8px',
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(0,0,0,0.20)',
                          color: '#fff',
                        }}
                      >
                        {hyperloopDestIds.map((id) => {
                          const m = (Array.isArray(maps) ? maps : []).find((x) => String(x?._id) === String(id)) || null;
                          return (
                            <option key={`hl-mm-${id}`} value={id} style={{ color: '#000' }}>
                              {m?.name || id}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="btn-secondary"
                        onClick={() => doHyperloopJump(hyperloopDestId, selectedCharId)}
                        disabled={loading || isAdvancing || isGameOver || !hyperloopDestId || !selectedCharId}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        title="하이퍼루프: 선택 캐릭터만 목적지 맵으로 즉시 이동"
                      >
                        🌀 이동
                      </button>
                    </>
                  ) : (
                    <span style={{ opacity: 0.75 }} title="선택 캐릭터가 패드 구역에 있어야 사용할 수 있습니다.">
                      선택 캐릭터가 패드 구역에 있어야 사용 가능
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

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

          <div className="control-panel" style={{ display: 'none' }} aria-hidden="true">
            <div className="control-row">
              <select
                className="autoplay-speed"
                value={normalizeMatchMode(settings?.matchMode)}
                onChange={(e) => handleMatchModeChange(e.target.value)}
                disabled={loading || isAdvancing || day !== 0}
                title="매치 모드: 시작 전 변경 가능"
              >
                <option value="squad">스쿼드</option>
                <option value="solo">솔로</option>
              </select>

              {isGameOver ? (
                <button className="btn-restart" onClick={() => window.location.reload()}>🔄 다시 하기</button>
              ) : (
                <button
                  className="btn-proceed"
                  onClick={proceedPhaseGuarded}
                  disabled={actionDisabled}
                  style={{ opacity: actionDisabled ? 0.5 : 1 }}
                >
                  {loading
                    ? '⏳ 로딩 중...'
                    : isAdvancing
                      ? '⏩ 진행 중...'
                      : startBlocked
                        ? startBlockedText
                        : day === 0
                          ? '🔥 게임 시작'
                          : getAliveTeams(survivors).length <= 1
                            ? '🏆 결과 확인하기'
                            : phase === 'morning'
                              ? (day >= 6 ? '🔥 서든데스 진행' : '🌙 밤으로 진행')
                              : (day >= 6 ? '🔥 서든데스 진행' : '🌞 다음 날 낮으로 진행')}
                </button>
              )}

              <button
                className={`btn-secondary sim-devtools-control ${showMarketPanel ? 'active' : ''}`}
                onClick={() => setShowMarketPanel((v) => !v)}
                title="관전자 모드에서는 기본적으로 숨겨두고, 테스트할 때만 열어쓰세요."
              >
                {showMarketPanel ? '🛠 개발자 도구 닫기' : '🛠 개발자 도구'}
              </button>

              <button
                className="btn-secondary"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={loading || isGameOver || startBlocked}
                title="오토 플레이: 다음 페이즈 버튼을 자동으로 눌러 진행합니다(페이즈 내부는 틱 엔진으로 계산)."
              >
                {autoPlay ? '⏸ 오토' : '▶ 오토'}
              </button>

              <select
                className="autoplay-speed"
                value={autoSpeed}
                onChange={(e) => updateAutoSpeed(e.target.value)}
                disabled={loading || isGameOver}
                title="오토 플레이 배속: 1초 틱 기준으로 최대 32배속까지 진행합니다."
              >
                <option value={1}>x1</option>
                <option value={2}>x2</option>
                <option value={4}>x4</option>
                <option value={8}>x8</option>
                <option value={16}>x16</option>
                <option value={32}>x32</option>
              </select>
            </div>
          </div>
        </section>

        {/* 🧪 상점/조합/교환 패널 (테스트/디버그용, 기본 숨김) */}
        {showMarketPanel ? (
        <aside className="market-panel">
          <div className="market-header">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>                <button className="market-close" onClick={() => setShowMarketPanel(false)} title="패널 닫기">✕</button>
              </div>
            </div>

            <div className="market-row" style={{ marginTop: 10 }}>
              <div className="market-small">사용 캐릭터</div>
              <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} style={{ width: '100%' }}>
                <option value="">(선택)</option>
                {survivors.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {selectedChar ? (
                <div className="market-small" style={{ marginTop: 4 }}>
                  HP {Math.round(Number(selectedChar.hp || 0))}/{Math.round(Number(selectedChar.maxHp || 100))}
                  {' · '}포만감 {normalizeSatiety(selectedChar.satiety)}/100
                </div>
              ) : null}
            </div>

            <div className="market-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="market-mini-btn"
                onClick={() => exportBattleLog('md')}
                title="1일차 낮부터 현재까지 누적된 전투 로그를 Markdown 파일로 저장합니다."
              >
                로그 MD
              </button>
              <button
                type="button"
                className="market-mini-btn"
                onClick={() => exportBattleLog('json')}
                title="1일차 낮부터 현재까지 누적된 전투 로그와 runEvents를 JSON 파일로 저장합니다."
              >
                로그 JSON
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showDevEventLog ? 'active' : ''}`}
                onClick={() => setShowDevEventLog((v) => !v)}
                title="큰 JSON 문자열 생성은 필요할 때만 켭니다."
              >
                {showDevEventLog ? '이벤트 JSON 숨김' : '이벤트 JSON'}
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showDevDebugDetails ? 'active' : ''}`}
                onClick={() => setShowDevDebugDetails((v) => !v)}
                title="AI/제작/런 메트릭 상세 카드를 필요할 때만 렌더합니다."
              >
                {showDevDebugDetails ? '상세 디버그 숨김' : '상세 디버그'}
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showAllMarketRows ? 'active' : ''}`}
                onClick={() => setShowAllMarketRows((v) => !v)}
                title={`상점 목록은 기본 ${MARKET_CARD_RENDER_LIMIT}개만 렌더합니다.`}
              >
                {showAllMarketRows ? '목록 빠르게' : `목록 ${MARKET_CARD_RENDER_LIMIT}개`}
              </button>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🎲 시드(재현)</div>
              <div className="market-small">같은 시드면 랜덤 결과가 재현됩니다. (게임 시작 전에만 변경 권장)</div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  placeholder="예) 1700000000000"
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                />
                <button
                  className="market-mini-btn"
                  onClick={() => setRunSeed(String(seedDraft || '').trim() || String(Date.now()))}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                  title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 변경을 권장하지 않습니다.' : ''}
                >
                  적용
                </button>
                <button
                  className="market-mini-btn"
                  onClick={() => { const n = String(Date.now()); setSeedDraft(n); setRunSeed(n); }}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                >
                  새 시드
                </button>
              </div>
              <div className="market-small">현재: <strong>{runSeed}</strong></div>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">👥 참가자 프리셋</div>
              <div className="market-small">
                기본은 무작위 24명입니다. 현재 참가자 24명을 최대 {PARTICIPANT_PRESET_LIMIT}개까지 저장해 시작 전에 적용할 수 있습니다.
              </div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <select
                  value={selectedParticipantPresetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    saveSelectedParticipantPresetId(id);
                    const preset = (Array.isArray(participantPresets) ? participantPresets : [])
                      .find((row) => String(row?.id || '') === String(id));
                    setParticipantPresetName(preset?.name || '');
                  }}
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                >
                  <option value={RANDOM_PARTICIPANT_PRESET_ID}>무작위 24명</option>
                  {(Array.isArray(participantPresets) ? participantPresets : []).map((preset, index) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name || `프리셋 ${index + 1}`} ({normalizeParticipantPresetIds(preset.characterIds).length}명)
                    </option>
                  ))}
                </select>
                <button
                  className="market-mini-btn"
                  onClick={() => applyParticipantPresetToCurrent(selectedParticipantPresetId)}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                  title={(day !== 0 || matchSec !== 0) ? '게임 시작 전에만 적용할 수 있습니다.' : ''}
                >
                  적용
                </button>
              </div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={participantPresetName}
                  onChange={(e) => setParticipantPresetName(e.target.value)}
                  placeholder="프리셋 이름"
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                />
                <button
                  className="market-mini-btn"
                  onClick={saveCurrentParticipantPreset}
                  disabled={isAdvancing || isGameOver || !survivors.length}
                  title="현재 참가자 목록을 저장합니다."
                >
                  저장
                </button>
                <button
                  className="market-mini-btn"
                  onClick={deleteSelectedParticipantPreset}
                  disabled={isAdvancing || isGameOver || selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID}
                >
                  삭제
                </button>
              </div>
              <div className="market-small" style={{ marginTop: 6 }}>
                저장됨: <strong>{(Array.isArray(participantPresets) ? participantPresets : []).length}</strong>/{PARTICIPANT_PRESET_LIMIT}
                {' · '}후보: <strong>{(Array.isArray(candidateSurvivors) && candidateSurvivors.length) || survivors.length}</strong>명
              </div>
            </div>

            {showDevEventLog ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🧾 이벤트 로그(JSON)</div>
                <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 (최근 {DEV_EVENT_PREVIEW_LIMIT}개만 표시)</div>
                <textarea
                  readOnly
                  value={runEventsPreviewText}
                  style={{ width: '100%', minHeight: 160, marginTop: 8 }}
                />
                <div className="market-actions" style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      try {
                        navigator.clipboard?.writeText(JSON.stringify(runEvents, null, 2));
                        addLog('✅ 이벤트 로그 복사 완료', 'system');
                      } catch (e) {
                        addLog('⚠️ 이벤트 로그 복사 실패', 'death');
                      }
                    }}
                    disabled={!runEvents.length}
                  >
                    전체 복사
                  </button>
                </div>
              </div>
            ) : (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🧾 이벤트 로그(JSON)</div>
                <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 · 필요할 때만 위의 이벤트 JSON 버튼을 켜세요.</div>
              </div>
            )}

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🌍 런 전체 요약</div>
              <div className="market-small">drone: <b>{Number(runProgressSummary?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgressSummary?.kioskGains || 0)}</b> / craft: <b>{Number(runProgressSummary?.craftCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend chars: <b>{Number(runProgressSummary?.legendCount || 0)}</b> / transcend chars: <b>{Number(runProgressSummary?.transCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>death: <b>{Number(runProgressSummary?.totalDeaths || 0)}</b> / revive: <b>{Number(runProgressSummary?.totalRevives || 0)}</b> / flee: <b>{Number(runProgressSummary?.totalFlees || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>revive ratio: <b>{Number(runProgressSummary?.reviveRate || 0).toFixed(2)}</b> / flee ratio: <b>{Number(runProgressSummary?.fleeRate || 0).toFixed(2)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend pace: <b>{String(runProgressSummary?.legendPace || 'pending')}</b> / transcend pace: <b>{String(runProgressSummary?.transPace || 'pending')}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgressSummary?.firstLegendText || '-')} / first transcend: {String(runProgressSummary?.firstTransText || '-')}</div>
              <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgressSummary?.latestLegendText || '-')} / latest transcend: {String(runProgressSummary?.latestTransText || '-')}</div>
            </div>

            <div className="market-card sim-diagnostics-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">밸런스 진단</div>
              <div className="market-small">{simulationDiagnosticsLine}</div>
              <div className="sim-diagnostics-grid" style={{ marginTop: 8 }}>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.opening || 0)}</b>
                  <span>1일차</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.mid || 0)}</b>
                  <span>중반 사망</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.end || 0)}</b>
                  <span>후반 사망</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.chase?.caught || 0)}</b>
                  <span>추격 성공</span>
                </div>
              </div>
              {(Array.isArray(simulationDiagnostics?.recommendations) ? simulationDiagnostics.recommendations : []).slice(0, 3).map((note, idx) => (
                <div key={`sim-diag-note-${idx}`} className="market-small sim-diagnostics-note">
                  {note}
                </div>
              ))}
            </div>


            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🩹 사용/상태 요약</div>
              <div className="market-small">{runSupportSummary?.line}</div>
              {runSupportSummary?.topItems ? (
                <div className="market-small" style={{ marginTop: 6 }}>top use: {runSupportSummary.topItems}</div>
              ) : null}
              {runSupportSummary?.topEffects ? (
                <div className="market-small" style={{ marginTop: 6 }}>top effects: {runSupportSummary.topEffects}</div>
              ) : null}
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">⏱️ 행동 큐/추격 요약</div>
              <div className="market-small">{runActionSummary?.line}</div>
              <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary?.chaseLine}</div>
              {runActionSummary?.tuningLine ? (
                <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary.tuningLine}</div>
              ) : null}
              {runActionSummary?.topObjectiveMoves ? (
                <div className="market-small" style={{ marginTop: 6 }}>top objective: {runActionSummary.topObjectiveMoves}</div>
              ) : null}
              {runActionSummary?.topBlocked ? (
                <div className="market-small" style={{ marginTop: 6 }}>top blocked: {runActionSummary.topBlocked}</div>
              ) : null}
              {runActionSummary?.topDeferred ? (
                <div className="market-small" style={{ marginTop: 6 }}>top deferred: {runActionSummary.topDeferred}</div>
              ) : null}
            </div>

            {pendingTranscendPick ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🎁 초월 장비 선택 상자(대기)</div>
                <div className="market-small">[{pendingTranscendPick.characterName || pendingTranscendPick.characterId}] {getZoneName(pendingTranscendPick.zoneId)} · 선택 완료 전에는 진행이 잠깁니다.</div>
                <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {(Array.isArray(pendingTranscendPick.options) ? pendingTranscendPick.options : []).map((o, idx) => {
                    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(o?.itemId)) || null;
                    const nm = itemDisplayName(it || { _id: o?.itemId, name: o?.name });
                    const tierText = tierLabelKo(clampTier4(it?.tier ?? o?.tier ?? 4));
                    const slotText = String(it?.equipSlot || o?.slot || '');
                    return (
                      <button
                        key={`tp-${pendingTranscendPick.id || 'p'}-${String(o?.itemId || idx)}`}
                        onClick={() => resolvePendingTranscendPick(idx, 'manual')}
                        disabled={isAdvancing || isGameOver}
                      >
                        {itemIcon(it)} {nm} ({tierText}{slotText ? `/${slotText}` : ''})
                      </button>
                    );
                  })}
                  <button onClick={() => resolvePendingTranscendPick(-1, 'auto')} disabled={isAdvancing || isGameOver}>자동(추천)</button>
                </div>
              </div>
            ) : null}

            {selectedCharId && selectedChar ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🛠 아이템 지급(개발자)</div>
                <div className="market-small">선택 캐릭터에게 아이템을 직접 지급합니다. 장비 아이템은 지급 후 자동 장착 규칙을 다시 적용합니다.</div>
                <input
                  value={devGrantSearch}
                  onChange={(e) => setDevGrantSearch(e.target.value)}
                  placeholder={`아이템 검색 후 선택 (표시 ${visibleDevGrantItemOptions.length}/${devGrantItemOptions.length})`}
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={isAdvancing || isGameOver}
                />
                <div className="dev-grant-list" role="listbox" aria-label="developer item grant list">
                  {visibleDevGrantItemOptions.length === 0 ? (
                    <div className="market-small">검색 결과가 없습니다.</div>
                  ) : (
                    visibleDevGrantItemOptions.map((it) => {
                      const id = String(it?._id || '');
                      const selected = id && id === String(devGrantItemId || '');
                      return (
                        <button
                          type="button"
                          key={`dev-grant-${id}`}
                          className={`dev-grant-option ${selected ? 'selected' : ''}`}
                          onClick={() => setDevGrantItemId(id)}
                          disabled={isAdvancing || isGameOver || !id}
                          role="option"
                          aria-selected={selected}
                          title={it?._label || it?.name || id}
                        >
                          <span>{it?._label || it?.name || id}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                  <div className="dev-grant-picked" title={selectedDevGrantItem?._label || ''}>
                    선택: {selectedDevGrantItem?._label || '-'}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={devGrantQty}
                    onChange={(e) => setDevGrantQty(e.target.value)}
                    style={{ width: 76 }}
                    disabled={isAdvancing || isGameOver}
                  />
                  <button
                    className="market-mini-btn"
                    onClick={devGrantItemToSelected}
                    disabled={isAdvancing || isGameOver || !devGrantItemId}
                  >
                    지급
                  </button>
                </div>
              </div>
            ) : null}

            {/* 🛠 개발자 도구: 유저가 선택 캐릭터에게 소모품을 임의로 사용 */}
            {selectedCharId && selectedChar ? (() => {
              const list = (Array.isArray(selectedChar.inventory) ? selectedChar.inventory : [])
                .map((it, idx) => ({ it, idx }))
                .filter((x) => inferItemCategory(x.it) === 'consumable');

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 소모품 강제 사용(개발자)</div>
                  <div className="market-small">시뮬은 기본적으로 플레이어가 자동 사용합니다. 이 영역은 개발자 도구가 켜졌을 때만 노출됩니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">소모품이 없습니다.</div>
                    ) : (
                      list.slice(0, 12).map(({ it, idx }) => {
                        const q = Math.max(1, Number(it?.qty || 1));
                        return (
                          <button
                            key={`dev-cons-${idx}-${String(it?._id || it?.itemId || '')}`}
                            onClick={() => devForceUseConsumable(selectedCharId, idx)}
                            disabled={isAdvancing || isGameOver}
                            title={isAdvancing ? '진행 중에는 사용할 수 없습니다.' : '개발자 도구: 임의로 사용'}
                          >
                            {itemIcon(it)} {itemDisplayName(it)}{q > 1 ? ` x${q}` : ''}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const dbg = selectedChar?._craftDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 제작 디버그</div>
                  {!dbg ? (
                    <div className="market-small">아직 제작 판정 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">code: <b>{String(dbg?.code || '-')}</b>{dbg?.targetName ? ` / target: ${dbg.targetName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>{String(dbg?.text || '')}</div>
                      {Array.isArray(dbg?.missing) && dbg.missing.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {dbg.missing.slice(0, 5).join(', ')}</div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const ai = selectedChar?._aiDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🤖 AI 디버그</div>
                  {!ai ? (
                    <div className="market-small">아직 AI 판단 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">action: <b>{String(ai?.action || '-')}</b>{ai?.itemName ? ` / item: ${ai.itemName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>zone: {String(ai?.zoneName || '-')} {ai?.targetZoneName ? `→ ${ai.targetZoneName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>reason: {String(ai?.reason || '-')}</div>
                      {Array.isArray(ai?.queuePreview) && ai.queuePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>queue: {ai.queuePreview.join(' → ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidatePreview) && ai.candidatePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>candidates: {ai.candidatePreview.join(' > ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidateScores) && ai.candidateScores.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>scores: {ai.candidateScores.join(' | ')}</div>
                      ) : null}
                      {Array.isArray(ai?.blockedReasons) && ai.blockedReasons.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>blocked: {ai.blockedReasons.join(', ')}</div>
                      ) : null}
                      {ai?.goalName ? <div className="market-small" style={{ marginTop: 6 }}>goal: {String(ai.goalName)}</div> : null}
                      {Array.isArray(ai?.missingNames) && ai.missingNames.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {ai.missingNames.join(', ')}</div>
                      ) : null}
                      <div className="market-small" style={{ marginTop: 6 }}>
                        late: {ai?.wantLegend ? '전설 ' : ''}{ai?.wantTrans ? '초월 ' : ''}{ai?.farmCredits ? '/ 크레딧 파밍' : ''}{!ai?.wantLegend && !ai?.wantTrans && !ai?.farmCredits ? '일반 성장' : ''}
                      </div>
                      {ai?.fleeReason ? <div className="market-small" style={{ marginTop: 6 }}>flee: {String(ai.fleeReason)}</div> : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const rp = runProgressSummary || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">📈 런 메트릭</div>
                  {!rp ? (
                    <div className="market-small">아직 메트릭이 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">drone: <b>{Number(rp?.droneCalls || 0)}</b> / kiosk: <b>{Number(rp?.kioskGains || 0)}</b> / craft: <b>{Number(rp?.craftCount || 0)}</b></div>
                      <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(rp?.firstLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>first transcend: {String(rp?.firstTransText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(rp?.latestLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest transcend: {String(rp?.latestTransText || '-')}</div>
                    </>
                  )}
                </div>
              );
            })() : null}

            {/* 🎒 장비 장착/해제 (개발자/관전자) */}
            {selectedCharId && selectedChar ? (() => {
              const eq = ensureEquipped(selectedChar);
              const inv = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
              const list = inv
                .map((it, idx) => ({ it, idx }))
                .map(({ it, idx }) => {
                  const category = String(it?.category || inferItemCategory(it));
                  const slot = String(it?.equipSlot || inferEquipSlot(it));
                  const itemId = getInvItemId(it);
                  const isEquip = category === 'equipment' && slot && EQUIP_SLOTS.includes(String(slot));
                  return { it, idx, slot, itemId, isEquip };
                })
                .filter((x) => x.isEquip && x.itemId);

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🎒 장비 장착/해제</div>
                  <div className="market-small">무기/방어구는 장착 상태(equipped)를 우선 적용합니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">장착 가능한 장비가 없습니다.</div>
                    ) : (
                      list.slice(0, 30).map(({ it, idx, slot, itemId }) => {
                        const tierText = tierLabelKo(clampTier4(it?.tier || 1));
                        const nm = itemDisplayName(it);
                        const equipped = String(eq?.[slot] || '') === String(itemId);
                        return (
                          <div key={`eq-${idx}-${itemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{itemIcon(it)}</span>
                            <span style={{ fontWeight: 800 }}>{nm}</span>
                            <span className="market-small">({tierText}{slot ? `/${slot}` : ''})</span>
                            <button
                              className={`invEquipBtn ${equipped ? 'off' : 'on'}`}
                              onClick={() => setEquipForSurvivor(selectedCharId, slot, equipped ? null : itemId)}
                              disabled={isAdvancing || isGameOver}
                            >
                              {equipped ? '해제' : '장착'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })() : null}

            <div className="market-tabs">
              <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
              <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
              <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
              <button className={`market-tab ${marketTab === 'perk' ? 'active' : ''}`} onClick={() => setMarketTab('perk')}>🎖️ 특전</button>
              <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
            </div>

            <div className="market-card" style={{ marginTop: 10 }}>
              <div className="market-row">
                <div>
                  <div className="market-title">💳 계정 진행</div>
                  <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
                  {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
                </div>
                <button onClick={() => { void fireAndReport('market.sync', () => Promise.allSettled([syncMyState(), loadMarket()])); }} className="market-mini-btn">동기화</button>
              </div>
            </div>

            {marketMessage ? (
              <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
                <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
                <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
              </div>
            ) : null}
          </div>

          {marketTab === 'craft' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>레시피가 있는 아이템만 표시됩니다.</div>
              {craftables.length === 0 ? (
                <div className="market-card">조합 가능한 아이템이 없습니다. (관리자에서 레시피를 등록하세요)</div>
              ) : (
                <>
                  {visibleCraftables.map((it) => (
                    <div key={it._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{it.name}</div>
                          <div className="market-small">tier {it.tier || 1} · {it.rarity || 'common'} · 비용 {Number(it?.recipe?.creditsCost || 0)} Cr</div>
                        </div>
                      </div>

                      <div className="market-small" style={{ marginTop: 8 }}>
                        재료: {(it.recipe.ingredients || []).map((ing) => {
                          const ingId = String(ing.itemId);
                          const ingName = itemNameById[ingId] || ingId;
                          return `${ingName} x${Number(ing.qty || 1)}`;
                        }).join(', ')}
                      </div>

                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={getQty(`craft:${it._id}`, 1)}
                          onChange={(e) => setQty(`craft:${it._id}`, e.target.value)}
                        />
                        <button onClick={() => doCraft(it._id)} disabled={!selectedCharId}>조합</button>
                      </div>
                    </div>
                  ))}
                  {craftables.length > visibleCraftables.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      조합 목록 더 보기 ({visibleCraftables.length}/{craftables.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'kiosk' ? (
            <div className="market-section">
              {kiosks.length === 0 ? (
                <div className="market-card">키오스크가 없습니다. (관리자에서 키오스크/카탈로그를 등록하세요)</div>
              ) : (
                <>
                  {visibleKiosks.map((k) => (
                    <div key={k._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{k.name || '키오스크'}</div>
                          <div className="market-small">위치: {k.mapId?.name || '미지정'}</div>
                        </div>
                        <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        {(Array.isArray(k.catalog) ? k.catalog : []).slice(0, showAllMarketRows ? undefined : MARKET_CARD_RENDER_LIMIT).map((entry, idx) => {
                          const mode = entry.mode || 'sell';
                          const label = mode === 'sell' ? '구매' : mode === 'buy' ? '판매' : '교환';
                          const price = Math.max(0, Number(entry.priceCredits || 0));

                          const itemId = entry.itemId?._id || entry.itemId;
                          const itemName = entry.itemId?.name || itemNameById[String(itemId)] || String(itemId || '미지정');

                          const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                          const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById[String(exId)] || String(exId)) : '');
                          const exQty = Number(entry.exchange?.giveQty || 1);

                          return (
                            <div key={idx} className="market-subcard">
                              <div className="market-row">
                                <div>
                                  <div className="market-title">{label}: {itemName}</div>
                                  <div className="market-small">
                                    {mode === 'exchange'
                                      ? `재료: ${exName || '미지정'} x${exQty}`
                                      : `단가: ${price} Cr`}
                                  </div>
                                </div>
                              </div>

                              <div className="market-actions" style={{ marginTop: 8 }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={getQty(`kiosk:${k._id}:${idx}`, 1)}
                                  onChange={(e) => setQty(`kiosk:${k._id}:${idx}`, e.target.value)}
                                />
                                <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId || !itemId}>실행</button>
                              </div>
                            </div>
                          );
                        })}
                        {!showAllMarketRows && Array.isArray(k.catalog) && k.catalog.length > MARKET_CARD_RENDER_LIMIT ? (
                          <div className="market-small" style={{ marginTop: 8 }}>
                            카탈로그 {MARKET_CARD_RENDER_LIMIT}/{k.catalog.length}개 표시 중
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {kiosks.length > visibleKiosks.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      키오스크 더 보기 ({visibleKiosks.length}/{kiosks.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'drone' ? (
            <div className="market-section">
              {droneOffers.length === 0 ? (
                <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
              ) : (
                <>
                  {visibleDroneOffers.map((o) => (
                    <div key={o._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{o.itemId?.name || '아이템'}</div>
                          <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                        </div>
                        <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                      </div>
                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={getQty(`drone:${o._id}`, 1)}
                          onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                        />
                        <button onClick={() => doDroneBuy(o._id)} disabled={!selectedCharId}>구매</button>
                      </div>
                    </div>
                  ))}
                  {droneOffers.length > visibleDroneOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      드론 목록 더 보기 ({visibleDroneOffers.length}/{droneOffers.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'perk' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>계정 단위 특전입니다. 구매 후 홈/시뮬 모두 즉시 반영됩니다.</div>
              {publicPerks.length === 0 ? (
                <div className="market-card">활성 특전이 없습니다. (관리자에서 특전을 등록하세요)</div>
              ) : (
                <>
                  {visiblePublicPerks.map((perk) => {
                    const code = String(perk?.code || '');
                    const owned = ownedPerkCodeSet.has(code);
                    const cost = Math.max(0, Number(perk?.lpCost || 0));
                    const desc = String(perk?.description || perk?.effectText || perk?.summary || '').trim();
                    return (
                      <div key={perk?._id || code} className="market-card">
                        <div className="market-row">
                          <div>
                            <div className="market-title">{perk?.name || code || '특전'}</div>
                            <div className="market-small">코드: {code || '-'} · 비용: {cost} LP{perk?.category ? ` · ${perk.category}` : ''}</div>
                          </div>
                          <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                        </div>
                        {desc ? <div className="market-small" style={{ marginTop: 8 }}>{desc}</div> : null}
                        <div className="market-actions" style={{ marginTop: 10 }}>
                          <button onClick={() => doPerkPurchase(code)} disabled={!code || owned || Number(viewerLp || 0) < cost}>
                            {owned ? '보유 중' : `구매 (${cost} LP)`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {publicPerks.length > visiblePublicPerks.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      특전 더 보기 ({visiblePublicPerks.length}/{publicPerks.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'trade' ? (
            <div className="market-section">
              <div className="market-row" style={{ marginBottom: 8 }}>
                <div className="market-small">오픈 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {tradeOffers.length === 0 ? (
                <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
              ) : (
                <>
                  {visibleTradeOffers.map((off) => (
                    <div key={off._id} className="market-card">
                      <div className="market-title">{off.fromCharacterId?.name || '상대'}의 오퍼</div>
                      <div className="market-small" style={{ marginTop: 6 }}>
                        주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                      </div>
                      <div className="market-small" style={{ marginTop: 4 }}>
                        원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                          ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                          : '없음'}
                        {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                      </div>
                      {off.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {off.note}</div> : null}

                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId || String(off?.fromCharacterId?._id || '') === String(selectedCharId)}>수락</button>
                      </div>
                    </div>
                  ))}
                  {tradeOffers.length > visibleTradeOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      오픈 오퍼 더 보기 ({visibleTradeOffers.length}/{tradeOffers.length})
                    </button>
                  ) : null}
                </>
              )}

              <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="market-small">내 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {myTradeOffers.length === 0 ? (
                <div className="market-card">내 오퍼가 없습니다.</div>
              ) : (
                <>
                  {visibleMyTradeOffers.map((off) => (
                    <div key={off._id} className="market-card">
                      <div className="market-title">상태: {off.status}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>
                        주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                      </div>
                      <div className="market-small" style={{ marginTop: 4 }}>
                        원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                          ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                          : '없음'}
                        {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                      </div>
                      <div className="market-actions" style={{ marginTop: 10 }}>
                        {off.status === 'open' ? (
                          <button onClick={() => cancelTradeOffer(off._id)}>취소</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {myTradeOffers.length > visibleMyTradeOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      내 오퍼 더 보기 ({visibleMyTradeOffers.length}/{myTradeOffers.length})
                    </button>
                  ) : null}
                </>
              )}

              <div className="market-card" style={{ marginTop: 18 }}>
                <div className="market-title">오퍼 생성</div>
                <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

                <div style={{ marginTop: 12 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
                  {(Array.isArray(tradeDraft.give) ? tradeDraft.give : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택)</option>
                        {inventoryOptions.map((it) => (
                          <option key={it.itemId} value={it.itemId}>{it.name} (보유 {it.qty})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.give.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, give: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, give: [...tradeDraft.give, { itemId: '', qty: 1 }] })}
                  >
                    + give 추가
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
                  <input
                    value={tradeWantSearch}
                    onChange={(e) => setTradeWantSearch(e.target.value)}
                    placeholder={`원하는 아이템 검색 (표시 ${tradeWantItemOptions.length}/${publicItems.length})`}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                  {(Array.isArray(tradeDraft.want) ? tradeDraft.want : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택 안 함)</option>
                        {tradeWantItemOptions.map((it) => (
                          <option key={it._id} value={it._id}>{it.name} (tier {it.tier || 1})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.want.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, want: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, want: [...tradeDraft.want, { itemId: '', qty: 1 }] })}
                  >
                    + want 추가
                  </button>
                </div>

                <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
                  <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
                  <input
                    type="number"
                    min={0}
                    value={tradeDraft.wantCredits}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, wantCredits: e.target.value })}
                    style={{ width: 120 }}
                  />
                </div>

                <div className="market-row" style={{ marginTop: 10 }}>
                  <textarea
                    value={tradeDraft.note}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, note: e.target.value })}
                    placeholder="메모(선택)"
                    style={{ width: '100%', minHeight: 64 }}
                  />
                </div>

                <div className="market-actions" style={{ marginTop: 10 }}>
                  <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        ) : null}
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
