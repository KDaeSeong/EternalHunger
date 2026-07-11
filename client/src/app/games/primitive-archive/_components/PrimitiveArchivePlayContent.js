'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import useGameSfx from '../../_lib/useGameSfx';
import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  ITEMS,
  ZONES,
  actionChance,
  actionForecastRows,
  averageBodyTemp,
  averageParty,
  archiveCompletionReportForState,
  archiveVictorySummary,
  autoEquipAction,
  buyPerkAction,
  canSelectActionZone,
  campFacilityRows,
  civilizationMilestoneRows,
  completeArchiveAction,
  clearAllEquipmentAction,
  createNewState,
  difficultyRows,
  equipmentChoicesForSlot,
  equipmentInventoryRows,
  equipmentRows,
  formatRequires,
  getActor,
  getPartyCap,
  getRunProgressReport,
  itemName,
  logCapacity,
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
  runCampAction,
  runCraftAction,
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
  selectRegionAction,
  selectTechAction,
  setEquipmentSlotAction,
  settleRunAction,
  startNewRunFromMeta,
  techRows,
  totalCarryWeight,
  explorationSummary,
} from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveFeatureTabs from './PrimitiveArchiveFeatureTabs';
import usePrimitiveArchivePersistence from '../_hooks/usePrimitiveArchivePersistence';

import {
  BASE_CAMP_ACTIONS,
  FALLBACK_DIFFICULTY_TAGS,
  PARTY_SORT_OPTIONS,
  actionLabel,
  buildResearchMap,
  chanceText,
  clampRatio,
  equipmentChoiceScore,
  equipmentSuccessText,
  multiplierText,
  roleActionForMember,
  startInventoryText,
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
  const feedbackRef = useRef({
    runId: state.runId,
    discoverySerial: Number(state.exploration?.discoverySerial || 0),
    projectSerial: Number(state.projects?.completionSerial || 0),
    researchSerial: Number(state.research?.completionSerial || 0),
    seasonId: '',
  });

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
  const archiveVictory = useMemo(() => archiveVictorySummary(state), [state]);
  const runProgressReport = useMemo(() => getRunProgressReport(state), [state]);
  const archiveReport = useMemo(() => archiveCompletionReportForState(state), [state]);
  const techs = useMemo(() => techRows(state), [state]);
  const inspirationRows = useMemo(() => researchInspirationRows(state), [state]);
  const plannerRows = useMemo(() => researchPlannerRows(state), [state]);
  const selectedPlanner = plannerRows.find((tech) => tech.id === state.research.selectedTechId) || plannerRows[0];
  const priorityPlannerRows = plannerRows.filter((tech) => !tech.completed).slice(0, 6);
  const researchMap = useMemo(() => buildResearchMap(techs), [techs]);
  const campFacilities = useMemo(() => campFacilityRows(state), [state]);
  const perks = useMemo(() => perkRows(state), [state]);
  const projects = useMemo(() => projectRows(state), [state]);
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
    const current = {
      runId: state.runId,
      discoverySerial: Number(state.exploration?.discoverySerial || 0),
      projectSerial: Number(state.projects?.completionSerial || 0),
      researchSerial: Number(state.research?.completionSerial || 0),
      seasonId: milestones.season.id,
    };
    if (previous.runId === current.runId) {
      if (current.discoverySerial > previous.discoverySerial) playGameSfx('discover');
      if (current.projectSerial > previous.projectSerial) playGameSfx('projectComplete');
      if (current.researchSerial > previous.researchSerial) playGameSfx('complete');
      if (previous.seasonId && current.seasonId !== previous.seasonId) playGameSfx('season');
    }
    feedbackRef.current = current;
  }, [milestones.season.id, playGameSfx, state.exploration?.discoverySerial, state.projects?.completionSerial, state.research?.completionSerial, state.runId]);
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
      ? `${research.selected.name}은(는) 아직 잠긴 연구입니다. 선행 연구: ${(research.selected.missingPrereqs || []).join(', ') || '없음'}. 지금 가능한 연구: ${availableResearchNames.slice(0, 3).join(', ') || '없음'}.`
      : research.selected && !research.selected.completed
        ? research.actionUnlocked
          ? `${research.selected.name} 연구를 진행할 수 있습니다. 자동 RP와 수동 연구 행동을 함께 사용할 수 있습니다.`
          : `${research.selected.name}에 매 행동 턴과 하루 시작 자동 RP가 누적됩니다. ${research.actionReason}`
        : '다음 연구 목표를 선택하면 조건과 유레카·영감 진행도를 여기에서 확인할 수 있습니다.';

  const applyAction = (label, updater, fallbackText = '') => {
    const nextState = updater(state);
    const latest = nextState.log?.[0] !== state.log?.[0] && nextState.log?.[0]
      ? nextState.log[0]
      : fallbackText || `${label} 행동을 실행했습니다.`;
    setState(nextState);
    setActionResult(latest);
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

  const runCamp = (kind) => {
    if (!canAct) return;
    applyAction('캠프', (current) => runCampAction(current, actorId, kind));
  };

  const selectRegion = (regionId) => {
    const region = regions.find((row) => row.id === regionId);
    setZoneId(regionId);
    applyAction('행동 지역 변경', (current) => selectRegionAction(current, regionId), `행동 지역을 ${region?.name || '새 지역'}(으)로 지정했습니다.`);
  };

  const selectProject = (projectId) => {
    const project = projects.find((row) => row.id === projectId);
    applyAction('부족 프로젝트 지정', (current) => selectProjectAction(current, projectId), `${project?.name || '새 프로젝트'}을(를) 공동 목표로 지정했습니다.`);
  };

  const runProject = () => {
    if (!canAct || !selectedProject) return;
    applyAction('부족 프로젝트', (current) => runProjectAction(current, actorId, selectedProject.id));
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
    setState((current) => startNewRunFromMeta(current, { difficulty: newRunDifficulty }));
    setActorId('shiroko');
    setZoneId('whisper-woods');
    setRecipeId('twine');
    setSelectedRecruitId('');
    setActionResult(`${selectedDifficulty.label} 난이도로 새 원시 아카이브 런을 시작했습니다.`);
    setMessage('');
  };

  const recruitMember = () => {
    if (!selectedRecruit) return;
    applyAction('합류', (current) => recruitPartyMemberAction(current, selectedRecruit.id), `${selectedRecruit.name}이(가) 파티에 합류했습니다.`);
  };

  const selectResearchTarget = (techId) => {
    const nextTech = techs.find((tech) => tech.id === techId);
    applyAction('연구 목표 변경', (current) => selectTechAction(current, techId), `연구 목표를 ${nextTech?.name || '새 기술'}(으)로 변경했습니다.`);
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
      `${actor?.name || '대상'}의 ${slotLabel} 장비를 ${choice?.name || '없음'}(으)로 변경했습니다.`,
    );
  };

  const playActions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 런</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '런 기록'}</GameControlButton>
      <GameControlButton action="auto" onClick={() => applyAction('하루 자동 운영', (current) => runAutoDayAction(current))} disabled={!canAct}>하루 자동 운영</GameControlButton>
      <GameControlButton action="complete" onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))} disabled={!archiveVictory.canComplete}>아카이브 완성</GameControlButton>
      <GameControlButton action="settle" onClick={() => applyAction('런 정산', (current) => settleRunAction(current))}>런 정산</GameControlButton>
      <Link href="/myanime/primitive-archive">상세</Link>
    </>
  );

  const playMetrics = [
    { label: 'Day/AP', value: `${state.day} · ${state.ap}/${state.apMax}` },
    { label: '난이도', value: currentDifficulty.label },
    { label: '파티', value: `${state.party.length}/${partyCap}` },
    { label: '상태', value: `${hp}HP · 허기 ${hunger} · ST ${stamina}` },
    { label: '체온/보온', value: `${bodyTemp.toFixed(1)}도 · ${insulation}` },
    { label: '핵심 연구', value: `${research.archiveCompleted}/${research.archiveTotal}` },
    { label: '기록서', value: `${archiveReport.grade} · ${archiveReport.archiveScore}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const playMessages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만, 저장/불러오기/전적 기록은 로그인해야 사용할 수 있습니다.' } : null,
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
      archiveVictory.canComplete ? { kind: '완료', title: '아카이브 완성', detail: '목표를 달성했습니다. 기록 전 마무리를 준비하세요.' } : null,
      { kind: '진행', title: '연구/제작 병행', detail: `${research.completed}/${research.total} 연구 완료, 기록 점수 ${archiveReport.archiveScore}%입니다.` },
    ],
  };

  return (
    <GamePlayShell
      kicker="Primitive Archive"
      title="원시 아카이브"
      description="학생 파티가 원시 지대에서 채집, 사냥, 제작, 캠프, 연구, 장비 빌드를 반복하며 며칠이나 버티는지 보는 생존 시뮬레이션입니다."
      summaryLabel="Primitive Archive 요약"
      summaryDensity="micro"
      actions={playActions}
      metrics={playMetrics}
      messages={playMessages}
    >
      <section className="games-panel primitive-difficulty-panel">
        <div className="games-panel-title">
          <h2>시작 난이도</h2>
          <span>현재 런 {currentDifficulty.label} · 다음 새 런 {selectedDifficulty.label}</span>
        </div>
        <div className="primitive-difficulty-lockbar">
          <span><strong>현재 런</strong>{currentDifficulty.label}</span>
          <span><strong>다음 시작</strong>{selectedDifficulty.label}</span>
          <span>난이도는 새 런 시작 시점에만 적용됩니다.</span>
        </div>
        <div className="primitive-difficulty-grid">
          {difficultyRows().map((row) => (
            <button
              type="button"
              key={row.key}
              className={`primitive-difficulty-card${newRunDifficulty === row.key ? ' is-active' : ''}`}
              data-game-sfx="select"
              onClick={() => setNewRunDifficulty(row.key)}
              aria-pressed={newRunDifficulty === row.key}
            >
              <span className="primitive-difficulty-card__head">
                <strong>{row.label}</strong>
                <em>{row.startLabel || FALLBACK_DIFFICULTY_TAGS[row.key] || '시작'}</em>
              </span>
              <small>{row.recommendation || row.desc}</small>
              <span className="primitive-difficulty-card__stats">
                AP {row.apMax} · 허기 {multiplierText(row.hungerMultiplier)} · 추위 {multiplierText(row.coldMultiplier)} · 점수 {multiplierText(row.scoreMultiplier)}
              </span>
              <span className="primitive-difficulty-card__rule">
                {row.ruleSummary || row.desc}
              </span>
              <span className="primitive-difficulty-card__loadout">
                시작 보급: {startInventoryText(row)}
              </span>
            </button>
          ))}
        </div>
        <div className="primitive-difficulty-summary">
          <span>선택한 난이도는 새 런을 시작할 때 적용됩니다. 보유 특전 보급은 시작 보급에 추가됩니다.</span>
          <ActionButton action="new" onClick={startNewRun}>
            {selectedDifficulty.label}으로 새 런
          </ActionButton>
        </div>
      </section>

      <GameAdvisorPanel {...guide} />
      <RecentActionResult label="이번 행동 결과" text={recentActionText} pinned />

            <PrimitiveArchiveFeatureTabs
        actor={actor}
        actorId={actorId}
        actionForecasts={actionForecasts}
        applyAction={applyAction}
        archiveReport={archiveReport}
        archiveVictory={archiveVictory}
        autoEquip={autoEquip}
        buyPerk={buyPerk}
        campFacilities={campFacilities}
        canAct={canAct}
        changeEquipmentSlot={changeEquipmentSlot}
        clearEquipment={clearEquipment}
        craftChance={craftChance}
        currentEquipmentRows={currentEquipmentRows}
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
        partyCap={partyCap}
        partySort={partySort}
        partyView={partyView}
        perks={perks}
        projectEstimate={projectEstimate}
        projects={projects}
        priorityPlannerRows={priorityPlannerRows}
        recentActionText={recentActionText}
        recipe={recipe}
        recipeId={recipeId}
        recipeRows={recipes}
        recruitCandidates={recruitCandidates}
        recruitMember={recruitMember}
        research={research}
        researchMap={researchMap}
        researchPlannerOpen={researchPlannerOpen}
        runCamp={runCamp}
        runCraft={runCraft}
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
        selectProject={selectProject}
        selectRegion={selectRegion}
        selectedPlanner={selectedPlanner}
        selectedProject={selectedProject}
        selectedRegion={selectedRegion}
        selectedRecruit={selectedRecruit}
        selectedResearchHelp={selectedResearchHelp}
        setActorId={setActorId}
        setPartySort={setPartySort}
        setRecipeId={setRecipeId}
        setResearchPlannerOpen={setResearchPlannerOpen}
        setSelectedRecruitId={setSelectedRecruitId}
        regions={regions}
        state={state}
        techs={techs}
        zone={zone}
        zoneId={activeRegionId}
        zoneSelectionUnlocked={zoneSelectionUnlocked}
      />
    </GamePlayShell>
  );
}
