'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import useGameSfx from '../../_lib/useGameSfx';
import {
  GameControlButton,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import {
  RECIPES,
  createNewState,
} from '../_lib/schaleIdleEngine';
import SchaleIdleFeatureTabs from '../_components/SchaleIdleFeatureTabs';
import { buildSchaleIdlePlayViewModel } from '../_lib/schaleIdlePlayViewModel';
import useSchaleIdlePersistence from '../_hooks/useSchaleIdlePersistence';
import {
  schaleIdleFeedbackPresentation,
  schaleIdleResultCue,
} from '../_lib/schaleIdleFeedback';


export default function SchaleIdlePlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'idle' });
  const [state, setState] = useState(() => createNewState());
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [enhanceSlot, setEnhanceSlot] = useState('');
  const [towerBatchCount, setTowerBatchCount] = useState(10);
  const [towerStopOnFail, setTowerStopOnFail] = useState(true);
  const [selectedSalvageUids, setSelectedSalvageUids] = useState([]);
  const [presetName, setPresetName] = useState('탑 등반 세트');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const feedbackRef = useRef(state);

  useEffect(() => {
    const cue = schaleIdleResultCue(feedbackRef.current, state);
    feedbackRef.current = state;
    if (cue) playGameSfx(cue);
  }, [playGameSfx, state]);

  const viewModel = useMemo(() => buildSchaleIdlePlayViewModel({
    enhanceSlot,
    recipeId,
    selectedPresetId,
    selectedSalvageUids,
    state,
  }), [enhanceSlot, recipeId, selectedPresetId, selectedSalvageUids, state]);

  const {
    achievements,
    activePresetId,
    claimableAchievements,
    dailyPlan,
    enhanceSlots,
    equipped,
    equippedTitle,
    equipmentTuning,
    equipmentVault,
    equipmentVaultSummary,
    growthReport,
    growthRoadmap,
    leader,
    missions,
    power,
    presets,
    recentActionText,
    rows,
    salvage,
    salvageInfo,
    score,
    seasonReport,
    seasonRewards,
    selectedEquip,
    selectedPreset,
    selectedRecipe,
    selectedRecipePlan,
    selectedSalvageInfo,
    selectedSlot,
    shopOffers,
    shopRotation,
    syncReport,
    titles,
    totalUpgradeLevel,
    upgrades,
    validSelectedSalvageUids,
  } = viewModel;
  const resultPresentation = useMemo(
    () => schaleIdleFeedbackPresentation(recentActionText),
    [recentActionText],
  );

  const {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  } = useSchaleIdlePersistence({
    onLoaded: () => setSelectedSalvageUids([]),
    score,
    setState,
    showToast,
    state,
    token,
  });

  const startNewRun = () => {
    setState(createNewState());
    setRecipeId(RECIPES[0].id);
    setEnhanceSlot('');
    setTowerBatchCount(10);
    setTowerStopOnFail(true);
    setSelectedSalvageUids([]);
    setPresetName('탑 등반 세트');
    setSelectedPresetId('');
    setMessage('');
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 당직</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link href="/myanime/schale-idle-rpg">상세</Link>
    </>
  );

  const metrics = [
    { label: '최고 층', value: state.maxClearedFloor },
    { label: '현재 층', value: state.floor },
    { label: '탑', value: `${state.towerMaxCleared}층` },
    { label: '전투력', value: power.toLocaleString('ko-KR') },
    { label: '크레딧', value: `${Number(state.credits || 0).toLocaleString('ko-KR')} Cr` },
    { label: '업적', value: `${achievements.filter((achievement) => achievement.claimed).length}/${achievements.length}` },
    { label: '연구', value: `Lv.${totalUpgradeLevel}` },
    { label: '운영', value: `${dailyPlan.readinessPct}%` },
    { label: '성장', value: `${growthReport.overallPct}%` },
    { label: '로드맵', value: `${growthRoadmap.completionPct}%` },
    { label: '시즌', value: `${seasonReport.seasonPct}%` },
    { label: '동기화', value: `${syncReport.syncScore}%` },
    { label: '시즌 보상', value: `${seasonRewards.claimedCount}/${seasonRewards.totalCount}` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
  ];

  const guide = {
    title: '성장 코치',
    badge: dailyPlan.riskLabel,
    primaryTitle: dailyPlan.nextAction?.title || growthRoadmap.nextAction?.title || '안정 루프',
    primaryText: dailyPlan.nextAction?.detail || growthRoadmap.nextAction?.detail || dailyPlan.headline,
    focusRows: [
      { label: '전투력', value: power.toLocaleString('ko-KR') },
      { label: '운영', value: `${dailyPlan.readinessPct}%` },
      { label: '성장', value: `${growthReport.overallPct}%` },
      { label: '시즌 보상', value: `${seasonRewards.claimableCount}개` },
    ],
    adviceLines: dailyPlan.priorityActions.slice(0, 4).map((action, index) => ({
      kind: action.priority === 'high' ? '우선' : `${index + 1}순위`,
      title: action.title,
      detail: action.detail,
    })),
  };

  return (
    <GamePlayShell
      className="schale-idle-page-shell"
      kicker="Schale Idle RPG"
      title="샬레 당직 RPG"
      description="업로드된 Schale Idle RPG v1.34의 방치 정산, 장비 제작, 강화, 시련의 탑, 미션 보상 루프를 사이트용 playable slice로 이식했습니다."
      summaryLabel="Schale Idle RPG 요약"
      summaryDensity="micro"
      primaryMetricLimit={10}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="schale-idle-growth-coach" />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={resultPresentation.detail}
        tone={resultPresentation.tone}
        pinned
      />

      <SchaleIdleFeatureTabs
        achievements={achievements}
        activePresetId={activePresetId}
        busy={busy}
        claimableAchievements={claimableAchievements}
        dailyPlan={dailyPlan}
        enhanceSlots={enhanceSlots}
        equipped={equipped}
        equippedTitle={equippedTitle}
        equipmentTuning={equipmentTuning}
        equipmentVault={equipmentVault}
        equipmentVaultSummary={equipmentVaultSummary}
        growthReport={growthReport}
        growthRoadmap={growthRoadmap}
        hydrated={hydrated}
        leader={leader}
        missions={missions}
        presetName={presetName}
        presets={presets}
        recipeId={recipeId}
        rows={rows}
        salvage={salvage}
        salvageInfo={salvageInfo}
        saveRun={saveRun}
        recordRun={recordRun}
        seasonReport={seasonReport}
        seasonRewards={seasonRewards}
        selectedEquip={selectedEquip}
        selectedPreset={selectedPreset}
        selectedRecipe={selectedRecipe}
        selectedRecipePlan={selectedRecipePlan}
        selectedSalvageInfo={selectedSalvageInfo}
        selectedSlot={selectedSlot}
        setEnhanceSlot={setEnhanceSlot}
        setPresetName={setPresetName}
        setRecipeId={setRecipeId}
        setSelectedPresetId={setSelectedPresetId}
        setSelectedSalvageUids={setSelectedSalvageUids}
        setState={setState}
        setTowerBatchCount={setTowerBatchCount}
        setTowerStopOnFail={setTowerStopOnFail}
        shopOffers={shopOffers}
        shopRotation={shopRotation}
        state={state}
        syncReport={syncReport}
        titles={titles}
        totalUpgradeLevel={totalUpgradeLevel}
        towerBatchCount={towerBatchCount}
        towerStopOnFail={towerStopOnFail}
        token={token}
        upgrades={upgrades}
        validSelectedSalvageUids={validSelectedSalvageUids}
      />
    </GamePlayShell>
  );
}
