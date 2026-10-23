'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import { useGameBgm } from '../../_components/GameBgmProvider';
import GamePlayShell from '../../_components/GamePlayShell';
import useGameSfx from '../../_lib/useGameSfx';
import {
  GameControlButton,
} from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  ITEMS,
  ZONES,
  actionChance,
  actionForecastRows,
  adjustTribeJobAction,
  averageBodyTemp,
  averageParty,
  archiveCompletionReportForState,
  archiveVictorySummary,
  autoEquipAction,
  buyPerkAction,
  canSelectActionZone,
  campActionRows,
  campFacilityRows,
  civicRows,
  civicsInspirationRows,
  civicsPlannerRows,
  civicsSummary,
  civilizationMilestoneRows,
  clearAllEquipmentAction,
  createNewState,
  difficultyRows,
  developerToolsSummary,
  directionParticle,
  equipmentChoicesForSlot,
  equipmentInventoryRows,
  equipmentRows,
  getActor,
  getPartyCap,
  getRunProgressReport,
  itemName,
  logCapacity,
  nightSurvivalRows,
  objectParticle,
  partyInsulation,
  perkRows,
  projectActionEstimate,
  projectRows,
  recipeRows,
  recruitPartyMemberAction,
  recruitablePartyRows,
  resetDeveloperToolsAction,
  researchInspirationRows,
  researchPlannerRows,
  researchSummary,
  regionalActionChance,
  rivalTribeRows,
  runCampAction,
  runCivicAction,
  runCraftAction,
  runDiplomacyAction,
  runAutoDayAction,
  runEatAction,
  runGatherAction,
  runHuntAction,
  runSpecializedAction,
  runUtilityAction,
  runProjectAction,
  runEventChainAction,
  runRecoveryChoiceAction,
  runResearchAction,
  runRestAction,
  scoreState,
  selectProjectAction,
  selectCivicAction,
  selectRegionAction,
  selectTechAction,
  setEquipmentSlotAction,
  specializedActionRows,
  utilityActionRows,
  updateDeveloperToolsAction,
  startNewRunFromMeta,
  subjectParticle,
  techRows,
  totalCarryWeight,
  topicParticle,
  explorationSummary,
  tribeSummary,
} from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveEraDefs from './PrimitiveArchiveEraDefs';
import PrimitiveArchiveFeatureTabs from './PrimitiveArchiveFeatureTabs';
import PrimitiveArchiveFocusPanel from './PrimitiveArchiveFocusPanel';
import { primitiveArchiveEraTheme } from '../_lib/primitiveArchiveEraTheme';
import '../../../../styles/PrimitiveArchiveEras.css';
import { primitiveArchiveFocusPlan } from '../_lib/primitiveArchiveFocus';
import usePrimitiveArchivePersistence from '../_hooks/usePrimitiveArchivePersistence';
import usePrimitiveArchiveCheckpoint from '../_hooks/usePrimitiveArchiveCheckpoint';
import { requestArchiveCompletion } from '../_lib/primitiveArchiveCompletion';
import { primitiveArchiveCoachMessage } from '../_lib/primitiveArchiveCoach';
import {
  primitiveActionResultPresentation,
  primitiveActionResultText,
  primitiveMilestoneCue,
  primitiveMilestoneSnapshot,
  primitiveRestoredResultText,
  primitiveTextPresentation,
} from '../_lib/primitiveArchiveFeedback';
import {
  primitiveArchiveActionMusic,
  primitiveArchiveMilestoneMusic,
  resolvePrimitiveArchiveBgmScene,
} from '../_lib/primitiveArchiveSoundtrack';

import {
  PARTY_SORT_OPTIONS,
  actionLabel,
  buildResearchMap,
  chanceText,
  clampRatio,
  equipmentChoiceScore,
  equipmentSuccessText,
  roleActionForMember,
  vitalBadges,
} from '../_lib/primitiveArchivePageRuntime';

function createHydrationSafeState() {
  return createNewState({ rng: () => 0.5 });
}

const NO_ROWS = [];
const CHECKPOINT_PROBLEM_STATUSES = ['corrupt', 'conflict', 'unavailable', 'owner-unknown', 'invalid-state'];

function saveStateLabel(status) {
  if (status === 'ready') return { tone: 'ready', label: '기기에 저장됨' };
  if (status === 'missing') return { tone: 'ready', label: '자동 저장 준비' };
  if (status === 'loading') return { tone: 'pending', label: '기록 확인 중' };
  return { tone: 'error', label: '자동 저장 멈춤' };
}

export default function PrimitiveArchivePlayContent() {
  const token = useAuthToken();
  const user = useAuthUser();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'civilization' });
  const { setMusicScene } = useGameBgm();
  const [state, setState] = useState(createHydrationSafeState);
  const [activeTabId, setActiveTabId] = useState('actions');
  const [actorId, setActorId] = useState('shiroko');
  const [zoneId, setZoneId] = useState('whisper-woods');
  const [recipeId, setRecipeId] = useState('twine');
  const [partySort, setPartySort] = useState('default');
  const [selectedRecruitId, setSelectedRecruitId] = useState('');
  const [newRunDifficulty, setNewRunDifficulty] = useState('normal');
  const [researchPlannerOpen, setResearchPlannerOpen] = useState(false);
  const [actionResult, setActionResult] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ key: 'idle', action: 'survival', label: '최근 생존 결과', outcome: 'ready', runId: state.runId, tone: 'ready' });
  const [arrivingEraId, setArrivingEraId] = useState('');
  const eraArrivalTimerRef = useRef(null);
  const stateRef = useRef(state);
  const feedbackRef = useRef(primitiveMilestoneSnapshot(state));
  const musicSceneTimerRef = useRef(null);
  const replaceState = useCallback((nextValue) => {
    if (typeof nextValue !== 'function') {
      stateRef.current = nextValue;
      feedbackRef.current = primitiveMilestoneSnapshot(nextValue);
      setState(nextValue);
      return;
    }
    setState((current) => {
      const nextState = nextValue(current);
      stateRef.current = nextState;
      feedbackRef.current = primitiveMilestoneSnapshot(nextState);
      return nextState;
    });
  }, []);
  const handleRestoredRun = useCallback((nextState) => {
    setNewRunDifficulty(nextState.difficulty || 'normal');
    setActorId(nextState.party.find((member) => member.hp > 0)?.id || nextState.party[0]?.id || 'shiroko');
    setZoneId(nextState.exploration?.selectedRegionId || 'whisper-woods');
    setRecipeId('twine');
    setSelectedRecruitId('');
    setActionResult(primitiveRestoredResultText(nextState));
    setActionFeedback({ key: 'idle', action: 'survival', label: '최근 생존 결과', outcome: 'ready', runId: nextState.runId, tone: 'ready' });
  }, []);
  const checkpoint = usePrimitiveArchiveCheckpoint({
    state,
    setState: replaceState,
    hydrated,
    user,
    token,
    onRestore: handleRestoredRun,
    latestStateRef: stateRef,
  });

  const actor = getActor(state, actorId);
  const recipes = useMemo(() => recipeRows(state), [state]);
  const recipe = recipes.find((row) => row.id === recipeId) || recipes.find((row) => row.unlocked) || recipes[0];
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  const stamina = averageParty(state, 'stamina');
  const bodyTemp = averageBodyTemp(state);
  const currentDifficulty = difficultyRows().find((row) => row.key === state.difficulty)
    || difficultyRows().find((row) => row.key === 'normal');
  const selectedDifficulty = difficultyRows().find((row) => row.key === newRunDifficulty)
    || difficultyRows().find((row) => row.key === 'normal');
  const score = scoreState(state);
  const {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  } = usePrimitiveArchivePersistence({
    latestStateRef: stateRef,
    replaceRun: checkpoint.replaceRun,
    setActionResult,
    setNewRunDifficulty,
    setState: replaceState,
    showToast,
    state,
    token,
  });
  const dead = state.ended || hp <= 0;
  const canAct = checkpoint.ready && !busy && !dead && state.ap > 0;
  const exploration = useMemo(() => explorationSummary(state), [state]);
  const regions = exploration.rows;
  const zoneSelectionUnlocked = canSelectActionZone(state);
  const selectedRegion = exploration.selected;
  const activeRegionId = zoneSelectionUnlocked ? selectedRegion?.id || zoneId : zoneId;
  const zone = selectedRegion?.zone || ZONES[0];
  const gatherChance = regionalActionChance(state, actorId, 'gather', activeRegionId);
  const huntChance = regionalActionChance(state, actorId, 'hunt', activeRegionId);
  const craftChance = recipe?.unlocked ? actionChance(state, actorId, 'craft', recipe.baseChance - 0.18) : 0;
  const research = useMemo(() => researchSummary(state), [state]);
  const civics = useMemo(() => civicsSummary(state), [state]);
  const archiveVictory = useMemo(() => archiveVictorySummary(state), [state]);
  const runProgressReport = useMemo(() => getRunProgressReport(state, actorId), [actorId, state]);
  const archiveReport = useMemo(() => archiveCompletionReportForState(state), [state]);
  // The advancement trees and planners are only shown on the growth screen and are
  // the most expensive rows to build, so other screens skip them.
  const growthOpen = activeTabId === 'growth';
  const techs = useMemo(() => (growthOpen ? techRows(state) : NO_ROWS), [growthOpen, state]);
  const civicAdvancements = useMemo(() => (growthOpen ? civicRows(state) : NO_ROWS), [growthOpen, state]);
  const inspirationRows = useMemo(() => (growthOpen ? researchInspirationRows(state) : NO_ROWS), [growthOpen, state]);
  const civicInspirationRows = useMemo(() => (growthOpen ? civicsInspirationRows(state) : NO_ROWS), [growthOpen, state]);
  const plannerRows = useMemo(() => (growthOpen ? researchPlannerRows(state) : NO_ROWS), [growthOpen, state]);
  const civicPlannerRows = useMemo(() => (growthOpen ? civicsPlannerRows(state) : NO_ROWS), [growthOpen, state]);
  const selectedPlanner = plannerRows.find((tech) => tech.id === state.research.selectedTechId) || plannerRows[0];
  const selectedCivicPlanner = civicPlannerRows.find((civic) => civic.id === state.civics.selectedCivicId) || civicPlannerRows[0];
  const priorityPlannerRows = plannerRows.filter((tech) => !tech.completed).slice(0, 6);
  const priorityCivicRows = civicPlannerRows.filter((civic) => !civic.completed).slice(0, 6);
  const researchMap = useMemo(() => buildResearchMap(techs), [techs]);
  const civicMap = useMemo(() => buildResearchMap(civicAdvancements), [civicAdvancements]);
  const campActions = useMemo(() => campActionRows(state), [state]);
  const campFacilities = useMemo(() => campFacilityRows(state), [state]);
  const perks = useMemo(() => perkRows(state), [state]);
  const projects = useMemo(() => projectRows(state), [state]);
  const tribe = useMemo(() => tribeSummary(state), [state]);
  const rivals = useMemo(() => rivalTribeRows(state, actorId), [actorId, state]);
  const selectedProject = projects.find((project) => project.selected && !project.completed)
    || projects.find((project) => project.available && !project.completed)
    || projects[0];
  const projectEstimate = useMemo(
    () => projectActionEstimate(state, actorId, selectedProject?.id || ''),
    [actorId, selectedProject?.id, state],
  );
  const milestones = useMemo(() => civilizationMilestoneRows(state), [state]);
  const currentEquipmentRows = useMemo(() => equipmentRows(state, actorId), [state, actorId]);
  const equipmentInventory = useMemo(() => equipmentInventoryRows(state), [state]);
  const partyCap = getPartyCap(state);
  const recruitCandidates = useMemo(() => recruitablePartyRows(state), [state]);
  const selectedRecruit = recruitCandidates.find((candidate) => candidate.id === selectedRecruitId) || recruitCandidates[0];
  const insulation = partyInsulation(state);
  const currentLogCapacity = logCapacity(state);
  const actionForecasts = useMemo(
    () => actionForecastRows(state, actorId, activeRegionId, recipeId),
    [activeRegionId, actorId, recipeId, state],
  );
  const specializedActions = useMemo(
    () => specializedActionRows(state, actorId, activeRegionId),
    [activeRegionId, actorId, state],
  );
  const utilityActions = useMemo(
    () => utilityActionRows(state, actorId),
    [actorId, state],
  );
  // Success-rate overrides are for testing. Production players only see them with
  // an admin account; a run that used them is excluded from perks and records.
  const showDeveloperTools = process.env.NODE_ENV !== 'production' || (hydrated && Boolean(user?.isAdmin));
  const developerTools = useMemo(() => developerToolsSummary(state), [state]);
  const baseMusicScene = resolvePrimitiveArchiveBgmScene({
    activeTabId,
    bodyTemp,
    ended: dead,
    hp,
    hunger,
    stamina,
    victory: archiveVictory.victory,
  });

  useEffect(() => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    musicSceneTimerRef.current = null;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => {
    const previous = feedbackRef.current;
    const current = primitiveMilestoneSnapshot(state, milestones.season.id, milestones.eraId);
    const cue = primitiveMilestoneCue(previous, current);
    if (cue) playGameSfx(cue);
    const musicTransition = primitiveArchiveMilestoneMusic(cue);
    if (musicTransition) {
      if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
      setMusicScene(musicTransition.theme);
      musicSceneTimerRef.current = window.setTimeout(() => {
        setMusicScene(baseMusicScene);
        musicSceneTimerRef.current = null;
      }, musicTransition.durationMs);
    }
    stateRef.current = state;
    feedbackRef.current = current;
  }, [baseMusicScene, milestones.eraId, milestones.season.id, playGameSfx, setMusicScene, state]);

  useEffect(() => () => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

  useEffect(() => () => {
    if (eraArrivalTimerRef.current) window.clearTimeout(eraArrivalTimerRef.current);
  }, []);

  // The save menu and the other-screens menu are native <details>; close them on an
  // outside press or Escape so an open menu never sits over the play area.
  useEffect(() => {
    const menuSelector = '.primitive-run-tools[open], .primitive-secondary-navigation[open]';
    const closeOnOutsidePress = (event) => {
      document.querySelectorAll(menuSelector).forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false;
      });
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll(menuSelector).forEach((menu) => {
        menu.open = false;
        if (menu.contains(document.activeElement)) menu.querySelector('summary')?.focus();
      });
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const partyView = useMemo(() => {
    const nightForecasts = new Map(nightSurvivalRows(state).map((row) => [row.id, row]));
    const rows = state.party.map((member, index) => {
      const chances = {
        gather: actionChance(state, member.id, 'gather', 0.5),
        hunt: actionChance(state, member.id, 'hunt', 0.42),
        craft: recipe?.unlocked ? actionChance(state, member.id, 'craft', recipe.baseChance - 0.18) : 0,
      };
      const basisAction = roleActionForMember(member);
      const basisChance = chances[basisAction];
      const staminaRatio = clampRatio(Number(member.stamina || 0) / 100);
      const hpRatio = clampRatio(Number(member.hp || 0) / 100);
      const hungerSafety = clampRatio((100 - Number(member.hunger || 0)) / 100);
      const recommendScore = basisChance * 0.62 + staminaRatio * 0.22 + hpRatio * 0.08 + hungerSafety * 0.08;
      return {
        member,
        index,
        chances,
        basisAction,
        basisChance,
        staminaRatio,
        recommendScore,
        badges: vitalBadges(member),
        nightSurvival: nightForecasts.get(member.id) || null,
      };
    });

    if (partySort === 'stamina') return rows.sort((a, b) => b.staminaRatio - a.staminaRatio || a.index - b.index);
    if (partySort === 'success') return rows.sort((a, b) => b.basisChance - a.basisChance || a.index - b.index);
    if (partySort === 'recommend') return rows.sort((a, b) => b.recommendScore - a.recommendScore || a.index - b.index);
    return rows;
  }, [partySort, recipe, state]);
  const inventoryRows = Object.entries(state.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => itemName(a).localeCompare(itemName(b), 'ko-KR'));
  const scopedActionFeedback = actionFeedback.runId === state.runId
    ? actionFeedback
    : { key: 'idle', action: 'survival', label: '최근 생존 결과', outcome: 'ready', runId: state.runId, tone: 'ready' };
  const recentActionText = message || actionResult || primitiveRestoredResultText(state, '아직 실행한 행동이 없습니다.');
  const resultPresentation = primitiveTextPresentation(recentActionText, scopedActionFeedback);
  const equipmentAdviceMode = Number(state.weather?.cold || 0) >= 5 || Number(actor?.bodyTemp ?? 37) <= 35.5 ? 'weather' : 'role';
  const equipmentAdviceRows = useMemo(() => {
    if (!actor) return [];
    return currentEquipmentRows
      .map((row) => {
        const choices = equipmentChoicesForSlot(state, actorId, row.slot).filter((choice) => choice.itemId);
        const best = choices
          .map((choice) => ({
            ...choice,
            item: ITEMS[choice.itemId],
            score: equipmentChoiceScore(choice.itemId, actor, equipmentAdviceMode, state.weather),
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (!best?.item) return null;
        return {
          slot: row.slot,
          slotLabel: row.label,
          currentName: row.itemName,
          itemId: best.itemId,
          name: best.name,
          score: Math.round(best.score),
          equipped: best.itemId === row.itemId,
          detail: equipmentSuccessText(best.item),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.equipped) - Number(b.equipped) || b.score - a.score)
      .slice(0, 5);
  }, [actor, actorId, currentEquipmentRows, equipmentAdviceMode, state]);
  const availableResearchNames = techs
    .filter((tech) => tech.available && !tech.completed)
    .map((tech) => tech.name);
  const selectedResearchHelp = !research.unlocked
    ? research.reason
    : research.selected && !research.selected.completed && !research.selected.available
      ? `${topicParticle(research.selected.name)} 아직 잠긴 연구입니다. 선행 연구: ${(research.selected.missingPrereqs || []).join(', ') || '없음'}. 지금 가능한 연구: ${availableResearchNames.slice(0, 3).join(', ') || '없음'}.`
      : research.selected && !research.selected.completed
        ? research.actionUnlocked
          ? `${research.selected.name} 연구를 진행할 수 있습니다. 자동 RP와 수동 연구 행동을 함께 사용할 수 있습니다.`
          : `${research.selected.name}에 매 행동 턴과 하루 시작 자동 RP가 누적됩니다. ${research.actionReason}`
        : '다음 연구 목표를 선택하면 선행 조건과 유레카 진행도를 여기에서 확인할 수 있습니다.';
  const availableCivicNames = civicAdvancements
    .filter((civic) => civic.available && !civic.completed)
    .map((civic) => civic.name);
  const selectedCivicHelp = !civics.unlocked
    ? civics.reason
    : civics.selected && !civics.selected.completed && !civics.selected.available
      ? `${topicParticle(civics.selected.name)} 아직 잠긴 사회 제도입니다. 선행 발전: ${(civics.selected.missingPrereqs || []).join(', ') || '없음'}. 지금 가능한 제도: ${availableCivicNames.slice(0, 3).join(', ') || '없음'}.`
      : civics.selected && !civics.selected.completed
        ? civics.actionUnlocked
          ? `${civics.selected.name} 제도를 추진할 수 있습니다. 자동 CP와 부족 회의를 함께 사용할 수 있습니다.`
          : `${civics.selected.name}에 매 행동 턴과 하루 시작 자동 CP가 누적됩니다. ${civics.actionReason}`
        : '다음 사회 제도를 선택하면 선행 조건과 영감 진행도를 여기에서 확인할 수 있습니다.';

  const applyAction = (label, updater, fallbackText = '') => {
    if (!checkpoint.ready || busy) return;
    const previousState = stateRef.current;
    // A run saved while the developer screen was open to everyone keeps its record
    // mark, but its adjustments stop applying once the screen is hidden.
    const actingState = !showDeveloperTools && previousState.devTools?.enabled
      ? updateDeveloperToolsAction(previousState, { enabled: false })
      : previousState;
    const nextState = updater(actingState);
    const previousMilestones = civilizationMilestoneRows(previousState);
    const nextMilestones = civilizationMilestoneRows(nextState);
    const latest = primitiveActionResultText(previousState, nextState, label, fallbackText);
    const feedback = primitiveActionResultPresentation(previousState, nextState, label, {
      currentEraId: nextMilestones.eraId,
      currentSeasonId: nextMilestones.season.id,
      fallbackText,
      previousEraId: previousMilestones.eraId,
      previousSeasonId: previousMilestones.season.id,
      resultText: latest,
    });
    if (feedback.cue) playGameSfx(feedback.cue);
    const actionMusic = primitiveArchiveActionMusic(feedback.cue);
    if (actionMusic) {
      if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
      setMusicScene(actionMusic.theme);
      musicSceneTimerRef.current = window.setTimeout(() => {
        setMusicScene(baseMusicScene);
        musicSceneTimerRef.current = null;
      }, actionMusic.durationMs);
    }
    stateRef.current = nextState;
    setState(nextState);
    setActionResult(latest);
    setMessage('');
    setActionFeedback({ ...feedback, runId: nextState.runId });
    if (nextMilestones.eraId !== previousMilestones.eraId) {
      if (eraArrivalTimerRef.current) window.clearTimeout(eraArrivalTimerRef.current);
      setArrivingEraId(nextMilestones.eraId);
      eraArrivalTimerRef.current = window.setTimeout(() => setArrivingEraId(''), 2600);
    }
  };

  const completeRun = () => requestArchiveCompletion({
    getState: () => stateRef.current,
    ready: hydrated && checkpoint.ready,
    busy: Boolean(busy),
    confirm: (message) => window.confirm(message),
    applyAction,
  });

  const runGather = () => {
    if (!canAct) return;
    applyAction('채집', (current) => runGatherAction(current, actorId, activeRegionId));
  };

  const runHunt = () => {
    if (!canAct) return;
    applyAction('사냥', (current) => runHuntAction(current, actorId, activeRegionId));
  };
  const runSpecialized = (actionId) => {
    if (!canAct) return;
    const row = specializedActions.find((candidate) => candidate.id === actionId);
    applyAction(row?.label || '\uD2B9\uD654 \uC0DD\uC5C5', (current) => (
      runSpecializedAction(current, actorId, actionId, activeRegionId)
    ));
  };

  const runUtility = (actionId) => {
    if (!canAct) return;
    const row = utilityActions.find((candidate) => candidate.id === actionId);
    applyAction(row?.label || '문명 운영', (current) => runUtilityAction(current, actorId, actionId));
  };

  const updateDeveloperTools = (patch) => {
    replaceState((current) => updateDeveloperToolsAction(current, patch));
  };

  const resetDeveloperTools = () => replaceState((current) => resetDeveloperToolsAction(current));


  const runCraft = () => {
    if (!canAct || !recipe?.unlocked) return;
    applyAction('제작', (current) => runCraftAction(current, actorId, recipeId));
  };

  const runEat = () => {
    if (!canAct) return;
    applyAction('식사', (current) => runEatAction(current, actorId));
  };

  const runRest = () => {
    if (!canAct) return;
    applyAction('휴식', (current) => runRestAction(current, actorId));
  };

  const runResearch = () => {
    if (!canAct) return;
    applyAction('연구', (current) => runResearchAction(current, actorId));
  };

  const runCivic = () => {
    if (!canAct) return;
    applyAction('부족 회의', (current) => runCivicAction(current, actorId));
  };

  const runCamp = (kind) => {
    if (!canAct) return;
    applyAction('캠프', (current) => runCampAction(current, actorId, kind));
  };

  const selectRegion = (regionId) => {
    const region = regions.find((row) => row.id === regionId);
    setZoneId(regionId);
    applyAction('행동 지역 변경', (current) => selectRegionAction(current, regionId), `행동 지역을 ${directionParticle(region?.name || '새 지역')} 지정했습니다.`);
  };

  const selectProject = (projectId) => {
    const project = projects.find((row) => row.id === projectId);
    applyAction('부족 프로젝트 지정', (current) => selectProjectAction(current, projectId), `${objectParticle(project?.name || '새 프로젝트')} 공동 목표로 지정했습니다.`);
  };

  const runProject = () => {
    if (!canAct || !selectedProject) return;
    applyAction('부족 프로젝트', (current) => runProjectAction(current, actorId, selectedProject.id));
  };

  const adjustTribeJob = (jobId, delta) => {
    applyAction('직업 배치', (current) => adjustTribeJobAction(current, jobId, delta));
  };

  const runDiplomacy = (rivalId, actionId) => {
    applyAction(
      '외교',
      (current) => runDiplomacyAction(current, actorId, rivalId, actionId),
    );
  };

  const runRecoveryChoice = (choiceId) => {
    if (!canAct) return;
    const choice = runProgressReport.recoveryChoices?.find((row) => row.id === choiceId);
    applyAction(
      '직접 대응',
      (current) => runRecoveryChoiceAction(current, actorId, choiceId),
      `${choice?.title || '직접 대응'}을 실행했습니다.`,
    );
  };

  const runEventChain = (chainId) => {
    if (!canAct) return;
    const chain = runProgressReport.activeEventChains?.find((row) => row.id === chainId);
    applyAction(
      '탐험 단서 대응',
      (current) => runEventChainAction(current, actorId, chainId),
      `${chain?.title || '탐험 단서'} 대응을 실행했습니다.`,
    );
  };

  const startNewRun = () => {
    if (!hydrated || !checkpoint.ready || busy) return;
    if (!window.confirm('현재 진행을 직전 런으로 보관하고 새 런을 시작할까요? 직전 런은 이 브라우저에서 하나만 보관합니다.')) return;
    const nextState = startNewRunFromMeta(stateRef.current, { difficulty: newRunDifficulty });
    const replacement = checkpoint.replaceRun(nextState);
    if (!replacement.ok) {
      setMessage(replacement.message);
      return;
    }
    const nextMessage = `${selectedDifficulty.label} 난이도로 새 문명 아카이브 런을 시작했습니다.`;
    const presentation = primitiveTextPresentation(nextMessage);
    setActorId('shiroko');
    setZoneId('whisper-woods');
    setRecipeId('twine');
    setSelectedRecruitId('');
    setActionResult(nextMessage);
    setActionFeedback({ ...presentation, runId: nextState.runId });
    setMessage('');
    if (presentation.cue) playGameSfx(presentation.cue);
  };
  const restorePreviousRun = () => {
    if (!hydrated || !checkpoint.ready || !checkpoint.hasPrevious || busy) return;
    if (!window.confirm('직전 런을 복구할까요? 현재 런은 직전 런 칸에 보관되어 다시 되돌릴 수 있습니다.')) return;
    const restored = checkpoint.restorePrevious();
    if (!restored.ok) setMessage(restored.message);
    else setMessage('직전 런을 복구했습니다. 바꾸기 전 런도 직전 런 칸에 보관했습니다.');
  };
  const loadServerRun = () => {
    if (!hydrated || !checkpoint.ready || !token || busy) return;
    if (!window.confirm('현재 진행을 직전 런으로 보관한 뒤 서버 저장본을 불러올까요?')) return;
    void loadRun();
  };

  const recruitMember = () => {
    if (!selectedRecruit) return;
    applyAction('합류', (current) => recruitPartyMemberAction(current, selectedRecruit.id), `${subjectParticle(selectedRecruit.name)} 파티에 합류했습니다.`);
  };

  const selectResearchTarget = (techId) => {
    const nextTech = techs.find((tech) => tech.id === techId);
    applyAction('연구 목표 변경', (current) => selectTechAction(current, techId), `연구 목표를 ${directionParticle(nextTech?.name || '새 기술')} 변경했습니다.`);
  };

  const selectCivicTarget = (civicId) => {
    const nextCivic = civicAdvancements.find((civic) => civic.id === civicId);
    applyAction('사회 제도 목표 변경', (current) => selectCivicAction(current, civicId), `사회 제도 목표를 ${directionParticle(nextCivic?.name || '새 제도')} 변경했습니다.`);
  };

  const buyPerk = (perk) => {
    applyAction('특전 구매', (current) => buyPerkAction(current, perk.id), `${perk.name} 특전을 구매했습니다.`);
  };

  const autoEquip = (mode) => {
    applyAction(
      '자동 장착',
      (current) => autoEquipAction(current, mode),
      mode === 'weather' ? '날씨 대응 장비를 자동 장착했습니다.' : '역할 추천 장비를 자동 장착했습니다.',
    );
  };

  const clearEquipment = () => {
    applyAction('장비 해제', (current) => clearAllEquipmentAction(current), '현재 파티의 장비를 모두 해제했습니다.');
  };

  const changeEquipmentSlot = (slot, itemId) => {
    const slotLabel = EQUIPMENT_SLOT_LABELS[slot] || slot;
    const choice = equipmentChoicesForSlot(state, actorId, slot).find((row) => row.itemId === itemId);
    applyAction(
      '장비 변경',
      (current) => setEquipmentSlotAction(current, actorId, slot, itemId),
      `${actor?.name || '대상'}의 ${slotLabel} 장비를 ${directionParticle(choice?.name || '없음')} 변경했습니다.`,
    );
  };

  const discardUnreadableRecord = () => {
    if (!hydrated || checkpoint.status !== 'corrupt' || busy) return;
    if (!window.confirm('이 기기의 읽을 수 없는 저장 기록을 정리하고, 지금 화면의 런부터 다시 자동 저장할까요? 정리한 기록은 이 브라우저에 백업 사본 하나로 남겨 둡니다. 기존 손상 기록 백업이 있다면 이번 기록으로 교체됩니다.')) return;
    const result = checkpoint.discardUnreadable();
    if (!result.ok) setMessage(result.message);
    else setMessage(result.backedUp
      ? '읽을 수 없던 기기 기록을 백업해 두고 지금 런부터 다시 자동 저장합니다.'
      : '읽을 수 없던 기기 기록을 정리하고 지금 런부터 다시 자동 저장합니다.');
  };

  const saveState = saveStateLabel(checkpoint.status);
  const closeRunTools = (event) => {
    if (!event.target.closest('button')) return;
    const menu = event.currentTarget.closest('details');
    if (menu) menu.open = false;
  };
  const playActions = (
    <details className="primitive-run-tools">
      <summary>
        저장·경기 관리
        <span className="primitive-save-state" data-tone={saveState.tone}>{saveState.label}</span>
      </summary>
      <div className="primitive-run-tools__items" onClick={closeRunTools}>
      <GameControlButton action="new" cue="off" onClick={startNewRun} disabled={!hydrated || !checkpoint.ready || Boolean(busy)}>{selectedDifficulty.label} 새 런</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || !checkpoint.ready || !token || Boolean(busy)}>{busy === 'save' ? '저장 중...' : '서버 저장'}</GameControlButton>
      <GameControlButton action="load" onClick={loadServerRun} disabled={!hydrated || !checkpoint.ready || !token || Boolean(busy)}>{busy === 'load' ? '불러오는 중...' : '서버 불러오기'}</GameControlButton>
      <GameControlButton action="load" onClick={restorePreviousRun} disabled={!hydrated || !checkpoint.ready || !checkpoint.hasPrevious || Boolean(busy)}>직전 런 복구</GameControlButton>
      </div>
    </details>
  );
  const autoDayControl = (
    <GameControlButton action="auto" cue="off" className="primitive-auto-day" onClick={() => applyAction('하루 자동 운영', (current) => runAutoDayAction(current))} disabled={!canAct}>하루 자동 운영</GameControlButton>
  );

  const playMetrics = [
    { label: '일차 · 행동력', value: `${state.day}일 · ${state.ap}/${state.apMax}` },
    { label: '식량', value: `${runProgressReport.foodUnits}단위` },
    { label: '모닥불 연료', value: Number(state.camp.fuel || 0) },
    { label: '생존 대원', value: state.party.filter((member) => member.hp > 0).length },
    { label: '난이도', value: currentDifficulty.label },
    { label: '파티/부족', value: `${state.party.length}/${partyCap} · ${tribe.population}/${tribe.capacity}` },
    { label: '상태', value: `${hp}HP · 허기 ${hunger} · ST ${stamina}` },
    { label: '체온/보온', value: `${bodyTemp.toFixed(1)}도 · ${insulation}` },
    { label: '핵심 발전', value: `${research.archiveCompleted + civics.archiveCompleted}/${research.archiveTotal + civics.archiveTotal}` },
    { label: '기록서', value: `${archiveReport.grade} · ${archiveReport.archiveScore}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  // Routine save states live in the save menu chip; only problems take a message row.
  const checkpointProblem = CHECKPOINT_PROBLEM_STATUSES.includes(checkpoint.status);
  const playMessages = [
    checkpointProblem ? {
      key: 'checkpoint',
      tone: 'error',
      text: checkpoint.status === 'corrupt' ? (
        <>
          {checkpoint.message}
          <button type="button" className="primitive-inline-action" onClick={discardUnreadableRecord} disabled={Boolean(busy)}>기기 기록 정리하고 계속</button>
        </>
      ) : checkpoint.message,
    } : null,
    message ? { key: 'message', text: message } : null,
    archiveVictory.victory ? { key: 'victory', text: '기초 아카이브 완주로 런이 종료되었습니다. 결과를 기록하거나 새 런을 시작하세요.' } : null,
    archiveVictory.canComplete ? { key: 'complete-ready', text: '기초 완주 목표를 달성했습니다. 런 관리에서 완성·종료하거나, 종료하지 않고 문명 발전을 계속할 수 있습니다.' } : null,
    dead && !archiveVictory.victory ? { key: 'dead', tone: 'error', text: '런이 종료 상태입니다. 결과를 기록하거나 새 런을 시작하세요.' } : null,
  ];

  const locationAndCraftAdvice = `${zone.note} 제작 목표는 ${recipe.name}${recipe.unlocked ? '' : ' (잠김)'}입니다.`;
  const coachMessage = primitiveArchiveCoachMessage({
    state,
    nightRows: partyView.map((row) => row.nightSurvival).filter(Boolean),
    fallbackText: locationAndCraftAdvice,
  });
  const guide = {
    title: '생존 코치',
    badge: archiveVictory.victory ? '기초 완주' : dead ? '위험' : `Day ${state.day}`,
    primaryTitle: archiveVictory.victory
      ? '기초 아카이브 완주'
      : dead
        ? '런 종료'
        : canAct
          ? coachMessage.urgent ? coachMessage.title : `${actor?.name || '대원'} 행동 가능`
          : !checkpoint.ready ? '진행 정보 확인 중' : busy ? '서버 작업 중' : 'AP 확인 필요',
    primaryText: archiveVictory.victory
      ? '기초 완주로 종료한 런입니다. 이 런은 더 진행할 수 없으며 결과를 기록하거나 새 런을 시작할 수 있습니다.'
      : dead
        ? state.meta?.lastSettledRunId === state.runId
          ? '결과를 기록하거나 새 런을 시작하세요.'
          : '런 관리에서 보상을 정산할 수 있습니다. 전적 기록은 보상 정산과 별개입니다.'
        : !checkpoint.ready
          ? '이 기기의 진행 정보를 확인한 뒤 행동할 수 있습니다.'
          : busy
            ? '서버 작업이 끝난 뒤 다음 행동을 고를 수 있습니다.'
            : coachMessage.text,
    focusRows: [
      { label: 'HP', value: hp },
      { label: '허기', value: hunger },
      { label: 'ST', value: stamina },
      { label: '체온', value: bodyTemp.toFixed(1) },
    ],
    adviceLines: [
      !dead && coachMessage.urgent ? { kind: '우선', title: coachMessage.title, detail: coachMessage.text } : null,
      hp <= 35 ? { kind: '우선', title: '회복/휴식', detail: 'HP가 낮습니다. 전투보다 캠프와 회복을 먼저 검토하세요.' } : null,
      hunger >= 65 ? { kind: '우선', title: '식량 확보', detail: '허기가 높으면 다음 행동 안정성이 떨어집니다.' } : null,
      tribe.unassigned > 0 ? { kind: '운영', title: '직업 배치', detail: `미배치 부족원 ${tribe.unassigned}명을 생산·건설·연구에 투입할 수 있습니다.` } : null,
      archiveVictory.canComplete ? { kind: '선택', title: '기초 완주 또는 문명 발전', detail: '기초 목표를 달성했습니다. 런 관리에서 완주·종료하거나, 종료 전에 더 높은 시대의 발전을 이어갈 수 있습니다.' } : null,
      { kind: '현재', title: '지역·제작 목표', detail: locationAndCraftAdvice },
      { kind: '진행', title: '연구/제작 병행', detail: `${research.completed}/${research.total} 연구 완료, 기록 점수 ${archiveReport.archiveScore}%입니다.` },
    ],
  };

  const focusPlan = primitiveArchiveFocusPlan({
    state,
    nightRows: partyView.map((row) => row.nightSurvival).filter(Boolean),
    research,
    campActions,
    archiveVictory,
    ready: checkpoint.ready,
    busy,
  });

  const eraTheme = primitiveArchiveEraTheme(milestones.eraId);
  const eraShellClassName = [
    'primitive-archive-page-shell',
    'primitive-era',
    `primitive-era--${eraTheme.key}`,
    arrivingEraId === milestones.eraId ? 'is-era-arriving' : '',
  ].filter(Boolean).join(' ');
  const eraPlate = (
    <span className="primitive-era-plate">
      <span className="primitive-era-plate__name">{milestones.eraLabel} 시대</span>
      <span className="primitive-era-plate__meta">
        {milestones.season.name} · {state.day}일째<span className="primitive-era-plate__medium"> · {eraTheme.medium}</span>
      </span>
    </span>
  );

  return (
    <GamePlayShell
      className={eraShellClassName}
      kicker={eraPlate}
      title="문명 아카이브"
      summaryLabel="문명 아카이브 요약"
      summaryDensity="micro"
      primaryMetricLimit={4}
      heroLayout="compact"
      actions={playActions}
      metrics={playMetrics}
      messages={playMessages}
    >
      <PrimitiveArchiveEraDefs theme={eraTheme} />
      <PrimitiveArchiveFocusPanel plan={focusPlan} onNavigate={setActiveTabId} />

      <PrimitiveArchiveFeatureTabs
        activeTabId={activeTabId}
        actor={actor}
        actorId={actorId}
        actionFeedback={resultPresentation}
        actionForecasts={actionForecasts}
        adjustTribeJob={adjustTribeJob}
        applyAction={applyAction}
        autoDayControl={autoDayControl}
        archiveReport={archiveReport}
        archiveVictory={archiveVictory}
        autoEquip={autoEquip}
        buyPerk={buyPerk}
        busy={busy || (!checkpoint.ready ? 'checkpoint' : '')}
        campActions={campActions}
        campFacilities={campFacilities}
        canAct={canAct}
        changeEquipmentSlot={changeEquipmentSlot}
        civicAdvancements={civicAdvancements}
        civicInspirationRows={civicInspirationRows}
        civicMap={civicMap}
        civicPlannerRows={civicPlannerRows}
        civics={civics}
        clearEquipment={clearEquipment}
        completeRun={completeRun}
        craftChance={craftChance}
        currentEquipmentRows={currentEquipmentRows}
        currentDifficulty={currentDifficulty}
        currentLogCapacity={currentLogCapacity}
        developerTools={developerTools}
        showDeveloperTools={showDeveloperTools}
        equipmentAdviceMode={equipmentAdviceMode}
        equipmentAdviceRows={equipmentAdviceRows}
        equipmentInventory={equipmentInventory}
        gatherChance={gatherChance}
        huntChance={huntChance}
        inspirationRows={inspirationRows}
        inventoryRows={inventoryRows}
        exploration={exploration}
        milestones={milestones}
        newRunDifficulty={newRunDifficulty}
        partyCap={partyCap}
        partySort={partySort}
        partyView={partyView}
        perks={perks}
        projectEstimate={projectEstimate}
        projects={projects}
        priorityPlannerRows={priorityPlannerRows}
        priorityCivicRows={priorityCivicRows}
        recentActionText={recentActionText}
        recipe={recipe}
        recipeId={recipeId}
        recipeRows={recipes}
        recruitCandidates={recruitCandidates}
        recruitMember={recruitMember}
        research={research}
        researchMap={researchMap}
        researchPlannerOpen={researchPlannerOpen}
        recordRun={recordRun}
        resetDeveloperTools={resetDeveloperTools}
        rivals={rivals}
        runCamp={runCamp}
        runCivic={runCivic}
        runCraft={runCraft}
        runDiplomacy={runDiplomacy}
        runEat={runEat}
        runGather={runGather}
        runHunt={runHunt}
        runProject={runProject}
        runEventChain={runEventChain}
        runProgressReport={runProgressReport}
        runRecoveryChoice={runRecoveryChoice}
        runResearch={runResearch}
        runRest={runRest}
        runSpecialized={runSpecialized}
        runUtility={runUtility}
        selectResearchTarget={selectResearchTarget}
        selectCivicTarget={selectCivicTarget}
        selectProject={selectProject}
        selectRegion={selectRegion}
        selectedPlanner={selectedPlanner}
        selectedCivicPlanner={selectedCivicPlanner}
        selectedProject={selectedProject}
        selectedRegion={selectedRegion}
        selectedRecruit={selectedRecruit}
        selectedResearchHelp={selectedResearchHelp}
        selectedCivicHelp={selectedCivicHelp}
        selectedDifficulty={selectedDifficulty}
        setActorId={setActorId}
        setActiveTabId={setActiveTabId}
        setPartySort={setPartySort}
        setRecipeId={setRecipeId}
        setNewRunDifficulty={setNewRunDifficulty}
        setResearchPlannerOpen={setResearchPlannerOpen}
        setSelectedRecruitId={setSelectedRecruitId}
        regions={regions}
        specializedActions={specializedActions}
        utilityActions={utilityActions}
        state={state}
        startNewRun={startNewRun}
        techs={techs}
        technologyPlannerRows={plannerRows}
        tribe={tribe}
        token={token}
        updateDeveloperTools={updateDeveloperTools}
        hydrated={hydrated}
        zone={zone}
        zoneId={activeRegionId}
        zoneSelectionUnlocked={zoneSelectionUnlocked}
      />
      <details className="primitive-guide-details">
        <summary>상세 생존 안내</summary>
        <GameAdvisorPanel {...guide} compact minimal storageKey="primitive-archive-survival-coach" />
      </details>
    </GamePlayShell>
  );
}
