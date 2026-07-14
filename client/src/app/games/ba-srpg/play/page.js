'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import BaSrpgFeatureTabs from '../_components/BaSrpgFeatureTabs';
import {
  baSrpgFeedbackCue,
  baSrpgFeedbackPresentation,
  createBaSrpgFeedbackSnapshot,
} from '../_lib/baSrpgFeedback';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  EDICTS,
  MAX_FORMATION_SIZE,
  PROPERTIES,
  TACTICAL_SKILLS,
  autoPlayerTurnAction,
  battlePower,
  cellContent,
  createNewState,
  edictRows,
  equipmentRows,
  formationPresetRows,
  getCampaignExpansionReport,
  formationRows,
  getCampaignReport,
  getBattleForecast,
  getBattleMissionOverlay,
  getBattlePresentationReport,
  getMission,
  getOperationBriefing,
  getPlayTimeSec,
  guildRankInfo,
  inventoryRows,
  itemName,
  normalizeState,
  propertyRows,
  questRows,
  recipeRows,
  scoreState,
  selectEnemyAction,
  selectUnitAction,
  shopRows,
  summaryForState,
  tacticalSkillRows,
  townSummary,
} from '../_lib/baSrpgEngine';

function missionRewardSummary(mission) {
  if (!mission?.rewards?.length) return '보상 없음';
  return mission.rewards.map((reward) => {
    const qty = reward.qtyMin === reward.qtyMax ? reward.qtyMin : `${reward.qtyMin}-${reward.qtyMax}`;
    const chance = Math.round((reward.chance ?? 1) * 100);
    return `${itemName(reward.itemId)} x${qty} (${chance}%)`;
  }).join(' · ');
}

export default function BaSrpgPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [missionId, setMissionId] = useState('m001');
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [propertyId, setPropertyId] = useState(PROPERTIES[0].id);
  const [edictId, setEdictId] = useState(EDICTS[0].id);
  const [skillId, setSkillId] = useState(TACTICAL_SKILLS[0].id);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const playGameSfx = useGameSfx({ theme: 'tactical', volume: 0.18 });
  const feedbackRef = useRef(null);
  const feedbackSnapshot = useMemo(() => createBaSrpgFeedbackSnapshot(state), [state]);
  const resultPresentation = useMemo(
    () => baSrpgFeedbackPresentation(feedbackSnapshot),
    [feedbackSnapshot],
  );

  useEffect(() => {
    const cue = baSrpgFeedbackCue(feedbackRef.current, feedbackSnapshot);
    feedbackRef.current = feedbackSnapshot;
    if (cue) playGameSfx(cue);
  }, [feedbackSnapshot, playGameSfx]);

  const battle = state.battle;
  const mission = getMission(battle.missionId);
  const selectedUnit = battle.units.find((unit) => unit.id === battle.selectedUnitId) || battle.units[0];
  const selectedCanAct = battle.phase === 'player' && selectedUnit && !selectedUnit.acted && Number(selectedUnit.ap || 0) > 0;
  const targetEnemy = battle.enemies.find((enemy) => enemy.id === battle.targetEnemyId && enemy.hp > 0);
  const formation = useMemo(() => formationRows(state), [state]);
  const formationPresets = useMemo(() => formationPresetRows(state, missionId), [state, missionId]);
  const rows = useMemo(() => inventoryRows(state), [state]);
  const equips = useMemo(() => equipmentRows(state), [state]);
  const quests = useMemo(() => questRows(state), [state]);
  const shop = useMemo(() => shopRows(state), [state]);
  const recipes = useMemo(() => recipeRows(state), [state]);
  const properties = useMemo(() => propertyRows(state), [state]);
  const edicts = useMemo(() => edictRows(state), [state]);
  const skills = useMemo(() => tacticalSkillRows(state), [state]);
  const town = useMemo(() => townSummary(state), [state]);
  const guildRank = useMemo(() => guildRankInfo(state), [state]);
  const campaignReport = useMemo(() => getCampaignReport(state), [state]);
  const campaignExpansion = useMemo(() => getCampaignExpansionReport(state), [state]);
  const operationBriefing = useMemo(() => getOperationBriefing(state), [state]);
  const battleForecast = useMemo(() => getBattleForecast(state), [state]);
  const battleMissionOverlay = useMemo(() => getBattleMissionOverlay(state), [state]);
  const battlePresentation = useMemo(() => getBattlePresentationReport(state), [state]);
  const score = scoreState(state);
  const power = battlePower(state);
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId) || recipes[0];
  const selectedProperty = properties.find((property) => property.id === propertyId) || properties[0];
  const selectedEdict = edicts.find((edict) => edict.id === edictId) || edicts[0];
  const selectedSkill = skills.find((skill) => skill.id === skillId) || skills[0];
  const selectedMission = getMission(missionId);
  const selectedMissionProgress = campaignReport.missionRows.find((row) => row.id === selectedMission.id) || campaignReport.missionRows[0];
  const selectedMissionBrief = operationBriefing.missionRows.find((row) => row.id === selectedMission.id) || operationBriefing.missionRows[0];
  const selectedMissionRewards = missionRewardSummary(selectedMission);
  const formationCount = formation.filter((student) => student.selected).length;
  const cleared = battle.phase === 'cleared';
  const failed = battle.phase === 'failed';
  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA SRPG 진행 상태를 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `BA SRPG Day ${state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('BA SRPG 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'BA SRPG 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 BA SRPG 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 BA SRPG 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      feedbackRef.current = createBaSrpgFeedbackSnapshot(nextState);
      setState(nextState);
      setMissionId(nextState.selectedMissionId);
      setMessage('저장된 BA SRPG 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 BA SRPG 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA SRPG 전투 스냅샷을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `BA SRPG - ${mission.name}`,
        mode: 'tactical-grid',
        result: cleared ? 'mission-clear' : failed ? 'mission-failed' : 'mission-snapshot',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('BA SRPG 전투 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'BA SRPG 전투 스냅샷을 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setMissionId(nextState.selectedMissionId);
    setRecipeId(RECIPES[0].id);
    setPropertyId(PROPERTIES[0].id);
    setEdictId(EDICTS[0].id);
    setSkillId(TACTICAL_SKILLS[0].id);
    setMessage('');
  };

  const handleCellClick = (x, y) => {
    const content = cellContent(state, x, y);
    if (content.type === 'unit') setState((current) => selectUnitAction(current, content.actor.id));
    if (content.type === 'enemy') setState((current) => selectEnemyAction(current, content.actor.id));
  };

  const runAutoBattle = () => {
    setState((current) => {
      let next = current;
      for (let i = 0; i < 8; i += 1) {
        if (next.battle.phase !== 'player') break;
        next = autoPlayerTurnAction(next);
        if (next.battle.phase === 'cleared' || next.battle.phase === 'failed') break;
      }
      return next;
    });
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 작전</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link href="/srpg/ba-srpg">상세</Link>
    </>
  );

  const metrics = [
    { label: '임무', value: mission.name },
    { label: '편성', value: `${formationCount}/${MAX_FORMATION_SIZE}` },
    { label: '일차', value: state.day },
    { label: '턴', value: battle.turn },
    { label: '전투력', value: power.toLocaleString('ko-KR') },
    { label: '승리', value: state.battleWins },
    { label: '별', value: `${campaignReport.starTotal}/${campaignReport.starMax}` },
    { label: '확장', value: `${campaignExpansion.readinessPct}%` },
    { label: '작전', value: `${operationBriefing.readinessPct}%` },
    { label: '연출', value: `${battlePresentation.completionPct}%` },
    { label: '위협', value: battleForecast.threatLevel },
    { label: '길드', value: `${guildRank.rank} (${guildRank.rep})` },
    { label: '부동산', value: town.activeProperties },
    { label: '크레딧', value: `${Number(state.credit || 0).toLocaleString('ko-KR')} Cr` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    cleared ? { key: 'clear', text: '임무를 클리어했습니다. 전적에 기록하거나 다른 임무를 시작하세요.' } : null,
    failed ? { key: 'failed', tone: 'error', text: '임무에 실패했습니다. 여관 휴식 후 재도전하거나 새 임무를 시작하세요.' } : null,
  ];

  const guide = {
    title: '전술 코치',
    badge: battleForecast.threatLevel,
    primaryTitle: cleared ? '임무 클리어' : failed ? '재정비 필요' : selectedCanAct ? `${selectedUnit?.name || '선택 유닛'} 행동 차례` : '턴 정리',
    primaryText: targetEnemy
      ? `${targetEnemy.name} HP ${targetEnemy.hp}/${targetEnemy.maxHp}. 예상 피해와 AP를 보고 공격, 스킬, 이동 중 하나를 선택하세요.`
      : selectedCanAct
        ? '공격 대상을 먼저 지정하면 명중/피해 예측을 보고 행동할 수 있습니다.'
        : '행동 가능한 유닛이 없으면 턴 종료나 자동 진행으로 전투 흐름을 넘기세요.',
    focusRows: [
      { label: '선택 유닛', value: selectedUnit?.name || '-' },
      { label: '목표', value: targetEnemy?.name || '-' },
      { label: '예상 피해', value: battleForecast.incomingTotal },
      { label: '고위험', value: `${battleForecast.highThreatCount}명` },
    ],
    adviceLines: battleForecast.recommendations.map((line, index) => ({
      kind: `${index + 1}순위`,
      title: line,
    })),
  };

  return (
    <GamePlayShell
      kicker="BA SRPG"
      title="BA SRPG 전술 작전"
      description="업로드된 BA SRPG 데이터를 기반으로 격자 이동, AP, 사거리, 엄폐, 적 턴, 임무 보상, 의뢰/제작/상점을 묶은 1차 전술 slice입니다."
      summaryLabel="BA SRPG 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={resultPresentation.detail}
        tone={resultPresentation.tone}
        pinned
      />

      <BaSrpgFeatureTabs
        battle={battle}
        battleForecast={battleForecast}
        battleMissionOverlay={battleMissionOverlay}
        battlePresentation={battlePresentation}
        campaignExpansion={campaignExpansion}
        campaignReport={campaignReport}
        edictId={edictId}
        edicts={edicts}
        equips={equips}
        failed={failed}
        formation={formation}
        formationCount={formationCount}
        formationPresets={formationPresets}
        guildRank={guildRank}
        handleCellClick={handleCellClick}
        mission={mission}
        missionId={missionId}
        operationBriefing={operationBriefing}
        properties={properties}
        propertyId={propertyId}
        quests={quests}
        recipeId={recipeId}
        recipes={recipes}
        rows={rows}
        runAutoBattle={runAutoBattle}
        selectedCanAct={selectedCanAct}
        selectedEdict={selectedEdict}
        selectedMission={selectedMission}
        selectedMissionBrief={selectedMissionBrief}
        selectedMissionProgress={selectedMissionProgress}
        selectedMissionRewards={selectedMissionRewards}
        selectedProperty={selectedProperty}
        selectedRecipe={selectedRecipe}
        selectedSkill={selectedSkill}
        selectedUnit={selectedUnit}
        setEdictId={setEdictId}
        setMissionId={setMissionId}
        setPropertyId={setPropertyId}
        setRecipeId={setRecipeId}
        setSkillId={setSkillId}
        setState={setState}
        shop={shop}
        skillId={skillId}
        skills={skills}
        state={state}
        targetEnemy={targetEnemy}
        town={town}
      />
    </GamePlayShell>
  );
}
