'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
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
  campFacilityRows,
  civicRows,
  civicsInspirationRows,
  civicsPlannerRows,
  civicsSummary,
  civilizationMilestoneRows,
  clearAllEquipmentAction,
  createNewState,
  difficultyRows,
  directionParticle,
  equipmentChoicesForSlot,
  equipmentInventoryRows,
  equipmentRows,
  formatRequires,
  getActor,
  getPartyCap,
  getRunProgressReport,
  itemName,
  logCapacity,
  objectParticle,
  partyInsulation,
  perkRows,
  projectActionEstimate,
  projectRows,
  recipeRows,
  recruitPartyMemberAction,
  recruitablePartyRows,
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
  startNewRunFromMeta,
  subjectParticle,
  techRows,
  totalCarryWeight,
  topicParticle,
  explorationSummary,
  tribeSummary,
} from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveFeatureTabs from './PrimitiveArchiveFeatureTabs';
import usePrimitiveArchivePersistence from '../_hooks/usePrimitiveArchivePersistence';
import {
  primitiveActionFeedback,
  primitiveActionResultText,
  primitiveMilestoneCue,
  primitiveMilestoneSnapshot,
} from '../_lib/primitiveArchiveFeedback';

import {
  BASE_CAMP_ACTIONS,
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

export default function PrimitiveArchivePlayContent() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'survival' });
  const [state, setState] = useState(createHydrationSafeState);
  const [actorId, setActorId] = useState('shiroko');
  const [zoneId, setZoneId] = useState('whisper-woods');
  const [recipeId, setRecipeId] = useState('twine');
  const [partySort, setPartySort] = useState('default');
  const [selectedRecruitId, setSelectedRecruitId] = useState('');
  const [newRunDifficulty, setNewRunDifficulty] = useState('normal');
  const [researchPlannerOpen, setResearchPlannerOpen] = useState(false);
  const [actionResult, setActionResult] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ action: 'survival', outcome: 'ready', runId: state.runId, tone: 'ready' });
  const feedbackRef = useRef(primitiveMilestoneSnapshot(state));

  const actor = getActor(state, actorId);
  const recipes = useMemo(() => recipeRows(state), [state]);
  const recipe = recipes.find((row) => row.id === recipeId) || recipes.find((row) => row.unlocked) || recipes[0];
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  const stamina = averageParty(state, 'stamina');
  const bodyTemp = averageBodyTemp(state);
  const currentDifficulty = difficultyRows().find((row) => row.key === state.difficulty) || difficultyRows()[1];
  const selectedDifficulty = difficultyRows().find((row) => row.key === newRunDifficulty) || difficultyRows()[1];
  const score = scoreState(state);
  const {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  } = usePrimitiveArchivePersistence({
    hp,
    score,
    setActionResult,
    setNewRunDifficulty,
    setState,
    showToast,
    state,
    token,
  });
  const dead = state.ended || hp <= 0;
  const canAct = !dead && state.ap > 0;
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
  const runProgressReport = useMemo(() => getRunProgressReport(state), [state]);
  const archiveReport = useMemo(() => archiveCompletionReportForState(state), [state]);
  const techs = useMemo(() => techRows(state), [state]);
  const civicAdvancements = useMemo(() => civicRows(state), [state]);
  const inspirationRows = useMemo(() => researchInspirationRows(state), [state]);
  const civicInspirationRows = useMemo(() => civicsInspirationRows(state), [state]);
  const plannerRows = useMemo(() => researchPlannerRows(state), [state]);
  const civicPlannerRows = useMemo(() => civicsPlannerRows(state), [state]);
  const selectedPlanner = plannerRows.find((tech) => tech.id === state.research.selectedTechId) || plannerRows[0];
  const selectedCivicPlanner = civicPlannerRows.find((civic) => civic.id === state.civics.selectedCivicId) || civicPlannerRows[0];
  const priorityPlannerRows = plannerRows.filter((tech) => !tech.completed).slice(0, 6);
  const priorityCivicRows = civicPlannerRows.filter((civic) => !civic.completed).slice(0, 6);
  const researchMap = useMemo(() => buildResearchMap(techs), [techs]);
  const civicMap = useMemo(() => buildResearchMap(civicAdvancements), [civicAdvancements]);
  const campFacilities = useMemo(() => campFacilityRows(state), [state]);
  const perks = useMemo(() => perkRows(state), [state]);
  const projects = useMemo(() => projectRows(state), [state]);
  const tribe = useMemo(() => tribeSummary(state), [state]);
  const rivals = useMemo(() => rivalTribeRows(state), [state]);
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

  useEffect(() => {
    const previous = feedbackRef.current;
    const current = primitiveMilestoneSnapshot(state, milestones.season.id);
    const cue = primitiveMilestoneCue(previous, current);
    if (cue) playGameSfx(cue);
    feedbackRef.current = current;
  }, [milestones.season.id, playGameSfx, state]);

  const partyView = useMemo(() => {
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
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 행동이 없습니다.';
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
    const nextState = updater(state);
    const latest = primitiveActionResultText(state, nextState, label, fallbackText);
    const feedback = primitiveActionFeedback(state, nextState, label);
    if (feedback.cue) playGameSfx(feedback.cue);
    setState(nextState);
    setActionResult(latest);
    setActionFeedback({ ...feedback, runId: nextState.runId });
  };

  const runGather = () => {
    if (!canAct) return;
    applyAction('채집', (current) => runGatherAction(current, actorId, activeRegionId));
  };

  const runHunt = () => {
    if (!canAct) return;
    applyAction('사냥', (current) => runHuntAction(current, actorId, activeRegionId));
  };

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
    const rival = rivals.find((row) => row.id === rivalId);
    applyAction(
      rival?.name || '경쟁 부족 외교',
      (current) => runDiplomacyAction(current, actorId, rivalId, actionId),
    );
  };

  const runRecoveryChoice = (choiceId) => {
    if (!canAct) return;
    const choice = runProgressReport.recoveryChoices?.find((row) => row.id === choiceId);
    applyAction(
      choice?.title || '직접 대응',
      (current) => runRecoveryChoiceAction(current, actorId, choiceId),
      `${choice?.title || '직접 대응'}을 실행했습니다.`,
    );
  };

  const runEventChain = (chainId) => {
    if (!canAct) return;
    const chain = runProgressReport.activeEventChains?.find((row) => row.id === chainId);
    applyAction(
      chain?.title || '탐험 단서 대응',
      (current) => runEventChainAction(current, actorId, chainId),
      `${chain?.title || '탐험 단서'} 대응을 실행했습니다.`,
    );
  };

  const startNewRun = () => {
    const nextState = startNewRunFromMeta(state, { difficulty: newRunDifficulty });
    setState(nextState);
    setActorId('shiroko');
    setZoneId('whisper-woods');
    setRecipeId('twine');
    setSelectedRecruitId('');
    setActionResult(`${selectedDifficulty.label} 난이도로 새 원시 아카이브 런을 시작했습니다.`);
    setActionFeedback({ action: 'start', outcome: 'ready', runId: nextState.runId, tone: 'ready' });
    setMessage('');
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

  const playActions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>{selectedDifficulty.label} 새 런</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="auto" onClick={() => applyAction('하루 자동 운영', (current) => runAutoDayAction(current))} disabled={!canAct}>하루 자동 운영</GameControlButton>
    </>
  );

  const playMetrics = [
    { label: 'Day/AP', value: `${state.day} · ${state.ap}/${state.apMax}` },
    { label: '난이도', value: currentDifficulty.label },
    { label: '파티/부족', value: `${state.party.length}/${partyCap} · ${tribe.population}/${tribe.capacity}` },
    { label: '상태', value: `${hp}HP · 허기 ${hunger} · ST ${stamina}` },
    { label: '체온/보온', value: `${bodyTemp.toFixed(1)}도 · ${insulation}` },
    { label: '핵심 발전', value: `${research.archiveCompleted + civics.archiveCompleted}/${research.archiveTotal + civics.archiveTotal}` },
    { label: '기록서', value: `${archiveReport.grade} · ${archiveReport.archiveScore}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const playMessages = [
    message ? { key: 'message', text: message } : null,
    archiveVictory.victory ? { key: 'victory', text: '아카이브를 완성했습니다. 결과를 기록하거나 새 런을 시작하세요.' } : null,
    archiveVictory.canComplete ? { key: 'complete-ready', text: '모든 목표를 달성했습니다. 아카이브 완성으로 런을 마무리할 수 있습니다.' } : null,
    dead && !archiveVictory.victory ? { key: 'dead', tone: 'error', text: '런이 종료 상태입니다. 결과를 기록하거나 새 런을 시작하세요.' } : null,
  ];

  const guide = {
    title: '생존 코치',
    badge: archiveVictory.victory ? '완성' : dead ? '위험' : `Day ${state.day}`,
    primaryTitle: archiveVictory.victory ? '아카이브 완성 가능' : dead ? '런 종료' : canAct ? `${actor?.name || '대원'} 행동 가능` : '정산 필요',
    primaryText: archiveVictory.victory
      ? '아카이브 완성을 눌러 이번 런을 마무리할 수 있습니다.'
      : dead
        ? '결과를 기록하거나 새 런을 시작하세요.'
        : `${zone.note} 제작 목표는 ${recipe.name}${recipe.unlocked ? '' : ' (잠김)'}입니다.`,
    focusRows: [
      { label: 'HP', value: hp },
      { label: '허기', value: hunger },
      { label: 'ST', value: stamina },
      { label: '체온', value: bodyTemp.toFixed(1) },
    ],
    adviceLines: [
      hp <= 35 ? { kind: '우선', title: '회복/휴식', detail: 'HP가 낮습니다. 전투보다 캠프와 회복을 먼저 검토하세요.' } : null,
      hunger <= 35 ? { kind: '우선', title: '식량 확보', detail: '허기가 낮으면 다음 행동 안정성이 떨어집니다.' } : null,
      tribe.unassigned > 0 ? { kind: '운영', title: '직업 배치', detail: `미배치 부족원 ${tribe.unassigned}명을 생산·건설·연구에 투입할 수 있습니다.` } : null,
      archiveVictory.canComplete ? { kind: '완료', title: '아카이브 완성', detail: '목표를 달성했습니다. 기록 전 마무리를 준비하세요.' } : null,
      { kind: '진행', title: '연구/제작 병행', detail: `${research.completed}/${research.total} 연구 완료, 기록 점수 ${archiveReport.archiveScore}%입니다.` },
    ],
  };

  return (
    <GamePlayShell
      className="primitive-archive-page-shell"
      kicker="Primitive Archive"
      title="원시 아카이브"
      description="학생 파티와 부족이 채집, 사냥, 제작, 기술, 사회 제도를 발전시키며 원시 지대에서 문명을 세우는 생존 시뮬레이션입니다."
      summaryLabel="Primitive Archive 요약"
      summaryDensity="micro"
      primaryMetricLimit={8}
      heroLayout="compact"
      actions={playActions}
      metrics={playMetrics}
      messages={playMessages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="primitive-archive-survival-coach" />

      <PrimitiveArchiveFeatureTabs
        actor={actor}
        actorId={actorId}
        actionFeedback={actionFeedback.runId === state.runId
          ? actionFeedback
          : { action: 'survival', outcome: 'ready', runId: state.runId, tone: 'ready' }}
        actionForecasts={actionForecasts}
        adjustTribeJob={adjustTribeJob}
        applyAction={applyAction}
        archiveReport={archiveReport}
        archiveVictory={archiveVictory}
        autoEquip={autoEquip}
        buyPerk={buyPerk}
        busy={busy}
        campFacilities={campFacilities}
        canAct={canAct}
        changeEquipmentSlot={changeEquipmentSlot}
        civicAdvancements={civicAdvancements}
        civicInspirationRows={civicInspirationRows}
        civicMap={civicMap}
        civicPlannerRows={civicPlannerRows}
        civics={civics}
        clearEquipment={clearEquipment}
        craftChance={craftChance}
        currentEquipmentRows={currentEquipmentRows}
        currentDifficulty={currentDifficulty}
        currentLogCapacity={currentLogCapacity}
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
        setPartySort={setPartySort}
        setRecipeId={setRecipeId}
        setNewRunDifficulty={setNewRunDifficulty}
        setResearchPlannerOpen={setResearchPlannerOpen}
        setSelectedRecruitId={setSelectedRecruitId}
        regions={regions}
        state={state}
        startNewRun={startNewRun}
        techs={techs}
        technologyPlannerRows={plannerRows}
        tribe={tribe}
        token={token}
        hydrated={hydrated}
        zone={zone}
        zoneId={activeRegionId}
        zoneSelectionUnlocked={zoneSelectionUnlocked}
      />
    </GamePlayShell>
  );
}
