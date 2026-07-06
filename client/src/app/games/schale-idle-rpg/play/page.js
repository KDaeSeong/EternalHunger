'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell, { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  STUDENTS,
  achievementRows,
  accountSyncReportForState,
  applyOfflineProgressAction,
  applyUpgradeAction,
  applyEquipmentPresetAction,
  attemptTowerAction,
  availableEnhanceSlots,
  autoSalvageAction,
  claimAchievementRewardsAction,
  buyTowerShopOfferMaxAction,
  buyTowerShopOfferAction,
  claimMissionRewardsAction,
  claimSeasonRewardsAction,
  craftRecipeAction,
  createNewState,
  dailyOperationsPlanForState,
  deleteEquipmentPresetAction,
  enhanceEquipmentAction,
  equipmentPresetRows,
  equipTitleAction,
  getEquippedList,
  growthReportForState,
  growthRoadmapForState,
  getLeader,
  getPlayTimeSec,
  inventoryRows,
  itemName,
  missionRows,
  normalizeState,
  rerollEquipmentAction,
  resetTowerShopRotationAction,
  resolveDutyAction,
  restAction,
  salvageRows,
  salvageSummary,
  salvageSelectedAction,
  saveEquipmentPresetAction,
  scoreState,
  seasonOperationsReportForState,
  seasonRewardRows,
  selectedSalvageSummary,
  setSalvageCandidateOnlyAction,
  slotLabel,
  summaryForState,
  teamPower,
  toggleEquipmentAffixLockAction,
  towerShopRotationSummary,
  titleRows,
  towerShopRows,
  upgradeRows,
} from '../_lib/schaleIdleEngine';

function formatRolls(equip) {
  const rolls = equip?.rolls || {};
  return [
    `화력 ${Math.round(Number(rolls.powerAddMul || 1) * 100)}%`,
    `계수 ${Math.round(Number(rolls.powerMulMul || 1) * 100)}%`,
    `스태미나 ${Math.round(Number(rolls.staminaMulMul || 1) * 100)}%`,
  ].join(' · ');
}

function formatAffixes(equip) {
  return (equip?.affixes || []).map((affix) => `${affix.locked ? '잠금 ' : ''}${affix.label} x${affix.value}`).join(', ');
}

export default function SchaleIdlePlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [enhanceSlot, setEnhanceSlot] = useState('');
  const [towerBatchCount, setTowerBatchCount] = useState(10);
  const [towerStopOnFail, setTowerStopOnFail] = useState(true);
  const [selectedSalvageUids, setSelectedSalvageUids] = useState([]);
  const [presetName, setPresetName] = useState('탑 등반 세트');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const equipped = useMemo(() => getEquippedList(state), [state]);
  const enhanceSlots = useMemo(() => availableEnhanceSlots(state), [state]);
  const rows = useMemo(() => inventoryRows(state), [state]);
  const missions = useMemo(() => missionRows(state), [state]);
  const achievements = useMemo(() => achievementRows(state), [state]);
  const titles = useMemo(() => titleRows(state), [state]);
  const upgrades = useMemo(() => upgradeRows(state), [state]);
  const salvage = useMemo(() => salvageRows(state), [state]);
  const salvageInfo = useMemo(() => salvageSummary(state), [state]);
  const validSelectedSalvageUids = useMemo(() => {
    const uidSet = new Set(salvage.map((entry) => entry.uid));
    return selectedSalvageUids.filter((uid) => uidSet.has(uid));
  }, [salvage, selectedSalvageUids]);
  const selectedSalvageInfo = useMemo(
    () => selectedSalvageSummary(state, validSelectedSalvageUids),
    [state, validSelectedSalvageUids],
  );
  const shopOffers = useMemo(() => towerShopRows(state), [state]);
  const shopRotation = useMemo(() => towerShopRotationSummary(state), [state]);
  const presets = useMemo(() => equipmentPresetRows(state), [state]);
  const growthReport = useMemo(() => growthReportForState(state), [state]);
  const growthRoadmap = useMemo(() => growthRoadmapForState(state), [state]);
  const dailyPlan = useMemo(() => dailyOperationsPlanForState(state), [state]);
  const seasonReport = useMemo(() => seasonOperationsReportForState(state), [state]);
  const seasonRewards = useMemo(() => seasonRewardRows(state), [state]);
  const syncReport = useMemo(() => accountSyncReportForState(state), [state]);
  const leader = getLeader(state);
  const selectedRecipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const selectedSlot = enhanceSlot || enhanceSlots[0] || '';
  const selectedEquip = selectedSlot ? state.equipment?.[selectedSlot] : null;
  const power = teamPower(state);
  const score = scoreState(state);
  const claimableAchievements = achievements.filter((achievement) => achievement.canClaim).length;
  const equippedTitle = titles.find((title) => title.equipped);
  const totalUpgradeLevel = upgrades.reduce((sum, upgrade) => sum + Number(upgrade.level || 0), 0);
  const activePresetId = selectedPresetId || state.activePresetId || presets[0]?.id || '';
  const selectedPreset = presets.find((preset) => preset.id === activePresetId);
  const recentActionText = state.log?.[0] || '아직 실행한 성장 액션이 없습니다.';

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Schale Idle RPG 진행 상태를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      const savedAt = new Date().toISOString();
      const stateForSave = { ...state, lastSavedAt: savedAt, updatedAt: savedAt };
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Schale Idle F${stateForSave.maxClearedFloor} T${stateForSave.towerMaxCleared}`,
        version: SAVE_VERSION,
        summary: summaryForState(stateForSave),
        payload: { state: stateForSave },
        lastPlayedAt: savedAt,
      }, { timeoutMs: 15000 });
      setState(stateForSave);
      clearApiGetCache('/game-saves');
      setMessage('Schale Idle RPG 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 Schale Idle RPG 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Schale Idle RPG 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const restored = applyOfflineProgressAction(normalizeState(detail?.save?.payload?.state));
      setState(restored);
      setSelectedSalvageUids([]);
      const offline = restored.offlineLastSummary;
      const loadedMessage = offline?.waves
        ? `저장된 Schale Idle RPG 진행 상태를 불러왔습니다. 오프라인 ${offline.waves}웨이브 보상도 반영했습니다.`
        : '저장된 Schale Idle RPG 진행 상태를 불러왔습니다.';
      setMessage(loadedMessage);
      showToast({ tone: 'success', message: loadedMessage });
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
      setMessage('로그인하면 Schale Idle RPG 진행 스냅샷을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Schale Idle RPG Floor ${state.maxClearedFloor}`,
        mode: 'idle-rpg',
        result: 'account-progress',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

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

  const runAutoSalvage = () => {
    setState((current) => autoSalvageAction(current));
    setSelectedSalvageUids([]);
  };

  const runSelectedSalvage = () => {
    const selectedUids = validSelectedSalvageUids;
    setState((current) => salvageSelectedAction(current, selectedUids));
    setSelectedSalvageUids([]);
  };

  const runPlanCommand = (command) => {
    if (!command?.type) return;
    if (command.type === 'claim-rewards') {
      setState((current) => claimAchievementRewardsAction(claimMissionRewardsAction(current)));
      return;
    }
    if (command.type === 'rest') {
      setState((current) => restAction(current));
      return;
    }
    if (command.type === 'duty') {
      setState((current) => resolveDutyAction(current, command.minutes || 120));
      return;
    }
    if (command.type === 'tower') {
      setState((current) => attemptTowerAction(current, towerBatchCount, towerStopOnFail));
      return;
    }
    if (command.type === 'salvage') {
      runAutoSalvage();
      return;
    }
    if (command.type === 'upgrade' && command.upgradeId) {
      setState((current) => applyUpgradeAction(current, command.upgradeId));
      return;
    }
    if (command.type === 'craft' && command.recipeId) {
      setRecipeId(command.recipeId);
      setState((current) => craftRecipeAction(current, command.recipeId));
      return;
    }
    if (command.type === 'buy-offer' && command.offerId) {
      setState((current) => buyTowerShopOfferAction(current, command.offerId));
    }
  };

  const toggleSalvageSelection = (uid) => {
    setSelectedSalvageUids((current) => (
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    ));
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 당직</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
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
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 진행은 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
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
      kicker="Schale Idle RPG"
      title="샬레 당직 RPG"
      description="업로드된 Schale Idle RPG v1.34의 방치 정산, 장비 제작, 강화, 시련의 탑, 미션 보상 루프를 사이트용 playable slice로 이식했습니다."
      summaryLabel="Schale Idle RPG 요약"
      summaryDensity="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />
      <RecentActionResult label="이번 성장 결과" text={recentActionText} pinned />

      <GameFeatureTabs
        tabs={[
          {
            id: 'plan',
            label: '운영 플랜',
            badge: dailyPlan.riskLabel,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>오늘 플랜</h2>
            <span>{dailyPlan.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="준비도" value={`${dailyPlan.readinessPct}%`} />
            <SmallStat label="상태" value={dailyPlan.riskLabel} />
            <SmallStat label="우선 작업" value={`${dailyPlan.highPriorityCount}개`} />
            <SmallStat label="메인 승률" value={`${dailyPlan.projections.mainProbabilityPct}%`} />
            <SmallStat label="탑 승률" value={`${dailyPlan.projections.towerProbabilityPct}%`} />
            <SmallStat label="방치" value={`${dailyPlan.projections.hourlyCredits.toLocaleString('ko-KR')} Cr/h`} />
          </div>
          <div className="game-save-list">
            {dailyPlan.priorityActions.map((action, index) => (
              <article className="game-save-row" key={action.id}>
                <div>
                  <span>{index + 1}순위 · {action.priority === 'high' ? '즉시' : action.priority === 'low' ? '보류' : '권장'}</span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </div>
                <button type="button" disabled={!action.command} onClick={() => runPlanCommand(action.command)}>
                  {action.buttonLabel || '실행'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 체크</h2>
            <span>{dailyPlan.roadmapHeadline}</span>
          </div>
          <div className="game-save-list">
            {dailyPlan.checkCards.map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.status === 'complete' ? '완료' : item.status === 'ready' ? '대기' : '진행'}</span>
                  <strong>{item.label} · {item.value}</strong>
                  <small>{item.detail}</small>
                </div>
                <strong>{item.status === 'complete' ? 'OK' : item.status === 'ready' ? '확인' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>다음 목표</h2>
            <span>{dailyPlan.nextAction?.title || '안정 루프'}</span>
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            {dailyPlan.nextAction ? (
              <>
                <strong>{dailyPlan.nextAction.action}</strong>
                <br />
                {dailyPlan.nextAction.detail}
              </>
            ) : '현재는 메인 정산, 탑 도전, 보상 수령 루프를 반복하면 됩니다.'}
          </div>
          <div className="games-rank-split">
            <SmallStat label="시간당 토큰" value={`+${dailyPlan.projections.hourlyTokens}`} />
            <SmallStat label="방치 상한" value={`${dailyPlan.projections.capHours}시간`} />
            <SmallStat label="병목" value={dailyPlan.blockers.length ? `${dailyPlan.blockers.length}개` : '없음'} />
          </div>
          {dailyPlan.blockers.length ? (
            <div className="game-save-list" style={{ marginTop: 12 }}>
              <article className="game-save-row">
                <div>
                  <span>현재 병목</span>
                  <strong>{dailyPlan.blockers.join(' / ')}</strong>
                </div>
                <strong>점검</strong>
              </article>
            </div>
          ) : null}
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'season',
            label: '시즌/밸런스',
            badge: seasonReport.riskLabel,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시즌 운영</h2>
            <span>{seasonReport.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="시즌" value={seasonReport.seasonId} />
            <SmallStat label="진행도" value={`${seasonReport.seasonPct}%`} />
            <SmallStat label="일차" value={`${seasonReport.seasonDay}/${seasonReport.seasonLengthDays}`} />
            <SmallStat label="남은 기간" value={`${seasonReport.daysLeft}일`} />
            <SmallStat label="상태" value={seasonReport.riskLabel} />
          </div>
          <div className="game-save-list">
            {seasonReport.tracks.map((track) => (
              <article className="game-save-row" key={track.id}>
                <div>
                  <span>{track.phase} · {track.pct}% · {track.priority === 'high' ? '우선' : track.priority === 'low' ? '보류' : '권장'}</span>
                  <strong>{track.title}</strong>
                  <small>{track.detail}</small>
                </div>
                <strong>{track.status === 'complete' ? '완료' : track.status === 'close' ? '근접' : track.action}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시즌 보상</h2>
            <span>{seasonRewards.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="수령" value={`${seasonRewards.claimedCount}/${seasonRewards.totalCount}`} />
            <SmallStat label="대기" value={`${seasonRewards.claimableCount}개`} />
            <SmallStat label="시즌 진행" value={`${seasonRewards.seasonPct}%`} />
          </div>
          <ActionButton
            disabled={!seasonRewards.claimableCount}
            onClick={() => setState((current) => claimSeasonRewardsAction(current))}
          >
            {seasonRewards.claimableCount ? `${seasonRewards.claimableCount}개 수령` : '수령 없음'}
          </ActionButton>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {seasonRewards.rows.map((reward) => (
              <article className="game-save-row" key={reward.id}>
                <div>
                  <span>{reward.target}% 보상 · {reward.pct}% · {reward.status === 'claimed' ? '수령 완료' : reward.status === 'ready' ? '수령 가능' : '잠김'}</span>
                  <strong>{reward.name}</strong>
                  <small>{reward.desc} · {reward.rewardText}</small>
                </div>
                <strong>{reward.status === 'claimed' ? '완료' : reward.status === 'ready' ? '수령' : `${reward.target}%`}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장기 밸런스</h2>
            <span>{seasonReport.balanceRows.filter((row) => row.tone === 'warn').length ? '점검 필요' : '안정'}</span>
          </div>
          <div className="game-save-list">
            {seasonReport.balanceRows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.tone === 'warn' ? '경고' : row.tone === 'good' ? '양호' : '관찰'}</span>
                  <strong>{row.label} · {row.value}</strong>
                  <small>{row.detail}</small>
                </div>
                <strong>{row.tone === 'warn' ? '점검' : 'OK'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시즌 추천</h2>
            <span>{seasonReport.seasonName}</span>
          </div>
          <div className="game-save-list">
            {seasonReport.recommendations.map((line, index) => (
              <article className="game-save-row" key={`${line}-${index}`}>
                <div>
                  <span>{index + 1}순위</span>
                  <strong>{line}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'sync',
            label: '계정 동기화',
            badge: `${syncReport.syncScore}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>동기화 상태</h2>
                    <span>{syncReport.statusLabel}</span>
                  </div>
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <SmallStat label="동기화 점수" value={`${syncReport.syncScore}%`} />
                    <SmallStat label="미저장" value={syncReport.dirtyMinutes ? `${syncReport.dirtyMinutes}분` : '없음'} />
                    <SmallStat label="최고 층" value={`F${syncReport.summary.floor}`} />
                    <SmallStat label="탑" value={`${syncReport.summary.tower}층`} />
                    <SmallStat label="전투력" value={syncReport.summary.power.toLocaleString('ko-KR')} />
                    <SmallStat label="점수" value={syncReport.summary.score.toLocaleString('ko-KR')} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <ActionButton onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>
                      {busy === 'save' ? '저장 중...' : '서버 저장'}
                    </ActionButton>
                    <ActionButton onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>
                      {busy === 'record' ? '기록 중...' : '전적 스냅샷'}
                    </ActionButton>
                  </div>
                  <div className="game-save-list">
                    {syncReport.syncRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.status === 'complete' ? '완료' : row.status === 'ready' ? '대기' : '참고'}</span>
                          <strong>{row.label} · {row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.status === 'complete' ? 'OK' : row.status === 'ready' ? '처리' : '정보'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>동기화 payload</h2>
                    <span>저장 · 전적 · 복귀</span>
                  </div>
                  <div className="game-save-list">
                    {syncReport.payloadRows.map((row) => (
                      <article className="game-save-row" key={row.label}>
                        <div>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>동기화 추천</h2>
                    <span>다음 순서</span>
                  </div>
                  <div className="games-activity-list">
                    {syncReport.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'duty',
            label: '당직/제작',
            badge: `${state.stamina}/100`,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>성장 리포트</h2>
            <span>{growthReport.summary}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="메인 승률" value={`${growthReport.combat.mainProbabilityPct}%`} />
            <SmallStat label="탑 승률" value={`${growthReport.combat.towerProbabilityPct}%`} />
            <SmallStat label="다음 메인" value={`${growthReport.combat.mainTargetPct}% / F${growthReport.combat.mainTarget}`} />
            <SmallStat label="다음 탑" value={`${growthReport.combat.towerTargetPct}% / ${growthReport.combat.towerTarget}층`} />
            <SmallStat label="보상 대기" value={`${growthReport.resources.claimableRewards}개`} />
            <SmallStat label="분해 후보" value={`${growthReport.resources.salvageCandidates}개`} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {growthReport.recommendations.slice(0, 4).map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.priority === 'high' ? '우선' : item.priority === 'low' ? '보류' : '권장'}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>성장 로드맵</h2>
            <span>{growthRoadmap.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="전체" value={`${growthRoadmap.completionPct}%`} />
            {growthRoadmap.sections.map((section) => (
              <SmallStat
                key={section.id}
                label={section.label}
                value={`${section.pct}% · ${section.done}/${section.total}`}
              />
            ))}
          </div>
          {growthRoadmap.nextAction ? (
            <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
              <strong>{growthRoadmap.nextAction.title}</strong>
              {' · '}
              {growthRoadmap.nextAction.action}
              <br />
              {growthRoadmap.nextAction.detail}
            </div>
          ) : null}
          <div className="game-save-list">
            {growthRoadmap.sections.map((section) => (
              <article className="game-save-row" key={section.id}>
                <div>
                  <span>{section.label} · 완료 {section.done}/{section.total} · {section.pct}%</span>
                  <strong>{section.steps.map((step) => step.title).join(' / ')}</strong>
                  <small>{section.steps.find((step) => step.status !== 'complete')?.detail || '해당 구간 목표를 모두 완료했습니다.'}</small>
                </div>
                <strong>{section.steps.find((step) => step.priority === 'high' && step.status !== 'complete') ? '우선' : section.pct >= 100 ? '완료' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>방치 정산</h2>
            <span>{leader.name}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="스태미나" value={`${state.stamina}/100`} />
            <SmallStat label="보스 처치" value={state.counters.KILL_BOSS} />
            <SmallStat label="누적 클리어" value={state.counters.CLEAR_FLOOR} />
            <SmallStat label="오프라인" value={state.offlineLastSummary?.waves ? `${state.offlineLastSummary.waves}웨이브` : '없음'} />
            <SmallStat label="대사" value={leader.lines.clear} />
          </div>
          <label className="game-save-json-field">
            <span>리더</span>
            <select value={state.leaderStudentId} onChange={(event) => setState((current) => ({ ...current, leaderStudentId: event.target.value }))}>
              {STUDENTS.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => resolveDutyAction(current, 30))}>30분 정산</ActionButton>
            <ActionButton onClick={() => setState((current) => resolveDutyAction(current, 120))}>2시간 정산</ActionButton>
            <ActionButton onClick={() => setState((current) => restAction(current))}>재정비</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>오프라인 보상</h2>
            <span>{state.offlineLastSummary?.waves ? `${Math.floor(Number(state.offlineLastSummary.deltaMs || 0) / 60000)}분` : '없음'}</span>
          </div>
          {state.offlineLastSummary?.waves ? (
            <div className="games-rank-split">
              <SmallStat label="웨이브" value={state.offlineLastSummary.waves} />
              <SmallStat label="크레딧" value={`${Number(state.offlineLastSummary.creditsGained || 0).toLocaleString('ko-KR')} Cr`} />
              <SmallStat label="토큰" value={`+${Number(state.offlineLastSummary.tokensGained || 0)}`} />
              <SmallStat label="상한" value={state.offlineLastSummary.capped ? '8시간 적용' : '미적용'} />
            </div>
          ) : <div className="games-empty">저장 데이터를 불러오면 지난 접속 시간에 따른 오프라인 보상이 표시됩니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>제작</h2>
            <span>{selectedRecipe.credits} Cr</span>
          </div>
          <label className="game-save-json-field">
            <span>레시피</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {RECIPES.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            필요 재료: {Object.entries(selectedRecipe.requires).map(([itemId, qty]) => `${itemName(itemId)} ${qty}`).join(', ')}
          </p>
          <ActionButton onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>제작 실행</ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>강화 / 탑</h2>
            <span>열쇠 {Number(state.inventory.itm_tower_key || 0)} · 연패 {Number(state.towerLossStreak || 0)}</span>
          </div>
          <label className="game-save-json-field">
            <span>강화 슬롯</span>
            <select value={selectedSlot} onChange={(event) => setEnhanceSlot(event.target.value)} disabled={!enhanceSlots.length}>
              {enhanceSlots.length ? enhanceSlots.map((slot) => <option value={slot} key={slot}>{slotLabel(slot)}</option>) : <option value="">장비 없음</option>}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="도전 층" value={`${state.towerFloor}층`} />
            <SmallStat label="최고 층" value={`${state.towerMaxCleared}층`} />
            <SmallStat label="연패보정" value={`x${(1 + Math.min(0.24, Math.max(0, Number(state.towerLossStreak || 0)) * 0.06)).toFixed(2)}`} />
            <SmallStat label="토큰" value={Number(state.inventory.itm_tower_token || 0)} />
          </div>
          <label className="game-save-json-field">
            <span>탑 배치 횟수</span>
            <select value={towerBatchCount} onChange={(event) => setTowerBatchCount(Number(event.target.value))}>
              <option value={1}>x1</option>
              <option value={5}>x5</option>
              <option value={10}>x10</option>
              <option value={100}>x100</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>탑 배치 규칙</span>
            <select value={towerStopOnFail ? 'stop' : 'continue'} onChange={(event) => setTowerStopOnFail(event.target.value === 'stop')}>
              <option value="stop">실패 시 중단</option>
              <option value="continue">실패해도 계속</option>
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedSlot} onClick={() => setState((current) => enhanceEquipmentAction(current, selectedSlot))}>선택 장비 강화</ActionButton>
            <ActionButton disabled={!selectedEquip} onClick={() => setState((current) => rerollEquipmentAction(current, selectedSlot))}>선택 장비 옵션 재련</ActionButton>
            <ActionButton disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
              자동 분해 실행{salvageInfo.candidateOnly ? ' · 후보만' : ''}
            </ActionButton>
            <ActionButton disabled={Number(state.inventory.itm_tower_key || 0) <= 0} onClick={() => setState((current) => attemptTowerAction(current, towerBatchCount, towerStopOnFail))}>
              탑 배치 도전 x{towerBatchCount}
            </ActionButton>
            <ActionButton disabled={Number(state.inventory.itm_tower_key || 0) <= 0} onClick={() => setState((current) => attemptTowerAction(current, 100, false))}>탑 x100 계속 도전</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>상시 연구</h2>
            <span>총 Lv.{totalUpgradeLevel}</span>
          </div>
          <div className="game-save-list">
            {upgrades.map((upgrade) => (
              <article className="game-save-row" key={upgrade.id}>
                <div>
                  <span>Lv.{upgrade.level} → Lv.{upgrade.nextLevel} · {Number(upgrade.costCredits || 0).toLocaleString('ko-KR')} Cr</span>
                  <strong>{upgrade.name}</strong>
                  <small>{upgrade.bonusText || '보정 없음'}</small>
                  <small>필요: {upgrade.costItemText || '없음'}</small>
                </div>
                <button type="button" disabled={!upgrade.canUpgrade} onClick={() => setState((current) => applyUpgradeAction(current, upgrade.id))}>연구</button>
              </article>
            ))}
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'gear',
            label: '장비/보상',
            badge: `${equipped.length}개`,
            children: (
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{equipped.length}개</span>
          </div>
          {equipped.length ? (
            <div className="game-save-list">
              {equipped.map((equip) => (
                <article className="game-save-row" key={equip.uid}>
                  <div>
                    <span>{slotLabel(equip.slot)} · {equip.rarity}</span>
                    <strong>{equip.name}</strong>
                    <small>{formatRolls(equip)}</small>
                    <small>{formatAffixes(equip) || '옵션 없음'}</small>
                    {(equip.affixes || []).length ? (
                      <div className="games-chip-row" style={{ marginTop: 8 }}>
                        {equip.affixes.map((affix) => (
                          <button
                            type="button"
                            className={`schale-salvage-toggle${affix.locked ? ' is-on' : ''}`}
                            key={`${equip.uid}-${affix.id}`}
                            onClick={() => setState((current) => toggleEquipmentAffixLockAction(current, equip.slot, affix.id))}
                          >
                            {affix.locked ? '잠금' : '잠금 해제'} · {affix.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <strong>+{equip.enhance || 0}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">장착 중인 장비가 없습니다. 제작으로 장비를 확보하세요.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비 프리셋</h2>
            <span>{presets.length}/12</span>
          </div>
          <label className="game-save-json-field">
            <span>프리셋 이름</span>
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="프리셋 이름" />
          </label>
          <label className="game-save-json-field">
            <span>적용 대상</span>
            <select value={activePresetId} onChange={(event) => setSelectedPresetId(event.target.value)} disabled={!presets.length}>
              {presets.length ? presets.map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {preset.active ? '★ ' : ''}{preset.name} · {preset.availableCount}/{preset.equippedCount}
                </option>
              )) : <option value="">저장된 프리셋 없음</option>}
            </select>
          </label>
          <div className="games-chip-row" style={{ marginBottom: 12 }}>
            <button type="button" className="tcg-primary-action" disabled={!equipped.length} onClick={() => {
              setSelectedPresetId('');
              setState((current) => saveEquipmentPresetAction(current, presetName));
            }}>
              현재 장비 저장
            </button>
            <button type="button" className="tcg-primary-action" disabled={!selectedPreset} onClick={() => setState((current) => applyEquipmentPresetAction(current, activePresetId))}>
              프리셋 적용
            </button>
            <button type="button" className="tcg-secondary-action" disabled={!selectedPreset} onClick={() => {
              setSelectedPresetId('');
              setState((current) => deleteEquipmentPresetAction(current, activePresetId));
            }}>
              삭제
            </button>
          </div>
          <div className="game-save-list">
            {presets.length ? presets.slice(0, 5).map((preset) => (
              <article className="game-save-row" key={preset.id}>
                <div>
                  <span>{preset.active ? '활성' : '저장'} · 사용 가능 {preset.availableCount}/{preset.equippedCount}</span>
                  <strong>{preset.name}</strong>
                  <small>{preset.missingCount ? `누락 슬롯 ${preset.missingCount}개` : '모든 장비 사용 가능'}</small>
                </div>
                <strong>{preset.equippedCount}슬롯</strong>
              </article>
            )) : (
              <article className="game-save-row">
                <div>
                  <span>현재 장비 저장으로 생성</span>
                  <strong>저장된 프리셋이 없습니다.</strong>
                </div>
                <strong>대기</strong>
              </article>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{rows.length}종</span>
          </div>
          <div className="game-save-list">
            {rows.slice(0, 14).map((row) => (
              <article className="game-save-row" key={row.itemId}>
                <div>
                  <span>{row.rarity}</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>타워 상점</h2>
            <span>토큰 {shopRotation.tokenCount}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="오늘 픽업" value={`${shopRotation.dailyCount}개`} />
            <SmallStat label="오늘 리셋" value={`${shopRotation.dailyResetsUsed}/${shopRotation.dailyResetMax}`} />
            <SmallStat label="오늘 피티" value={`${shopRotation.dailyPityCounter}/${shopRotation.dailyPityTrigger}`} />
            <SmallStat label="이번주 픽업" value={`${shopRotation.weeklyCount}개`} />
            <SmallStat label="주간 리셋" value={`${shopRotation.weeklyResetsUsed}/${shopRotation.weeklyResetMax}`} />
            <SmallStat label="주간 피티" value={`${shopRotation.weeklyPityCounter}/${shopRotation.weeklyPityTrigger}`} />
          </div>
          <div className="games-chip-row" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="tcg-primary-action"
              disabled={!shopRotation.canResetDaily}
              onClick={() => setState((current) => resetTowerShopRotationAction(current, 'DAILY'))}
            >
              오늘 픽업 리셋 · {shopRotation.dailyResetCost}토큰
            </button>
            <button
              type="button"
              className="tcg-primary-action"
              disabled={!shopRotation.canResetWeekly}
              onClick={() => setState((current) => resetTowerShopRotationAction(current, 'WEEKLY'))}
            >
              이번주 픽업 리셋 · {shopRotation.weeklyResetCost}토큰
            </button>
          </div>
          <div className="game-save-list">
            {shopOffers.map((offer) => (
              <article className="game-save-row" key={offer.id}>
                <div>
                  <span>{offer.pickupLabel} · {offer.costText} · {offer.limitText}</span>
                  <strong>{offer.name}</strong>
                  <small>남은 구매 {offer.remaining}</small>
                </div>
                <div className="game-save-row-actions">
                  <button type="button" disabled={!offer.canBuy} onClick={() => setState((current) => buyTowerShopOfferAction(current, offer.id))}>구매</button>
                  <button type="button" disabled={!offer.canBuyMax} onClick={() => setState((current) => buyTowerShopOfferMaxAction(current, offer.id))}>
                    최대 {offer.maxBuyCount || 0}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>분해 대기열</h2>
            <button type="button" className="tcg-primary-action" disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
              자동 분해{salvageInfo.candidateOnly ? ' · 후보만' : ''}
            </button>
          </div>
          {salvage.length ? (
            <>
              <div className="games-chip-row" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={`schale-salvage-toggle${salvageInfo.candidateOnly ? ' is-on' : ''}`}
                  onClick={() => setState((current) => setSalvageCandidateOnlyAction(current, !salvageInfo.candidateOnly))}
                >
                  후보만 분해
                  {salvageInfo.candidateOnly ? <span>ON</span> : <span>OFF</span>}
                </button>
                <button
                  type="button"
                  className="schale-salvage-toggle"
                  disabled={!salvageInfo.executableCount}
                  onClick={() => setSelectedSalvageUids(salvage.filter((entry) => entry.executable).map((entry) => entry.uid))}
                >
                  실행 대상 선택
                </button>
                <button
                  type="button"
                  className="schale-salvage-toggle"
                  disabled={!validSelectedSalvageUids.length}
                  onClick={() => setSelectedSalvageUids([])}
                >
                  선택 해제
                </button>
                <button
                  type="button"
                  className="tcg-primary-action"
                  disabled={!selectedSalvageInfo.executableCount}
                  onClick={runSelectedSalvage}
                >
                  선택 분해
                </button>
              </div>
              <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                {salvageInfo.candidateOnly ? (
                  <>
                    <strong>후보만 분해 ON</strong> · 실행 대상 {salvageInfo.executableCount}개 / 보호 유지 {salvageInfo.protectedByCandidateOnly}개입니다.
                    장착 장비 {salvageInfo.protectedEquipped}개는 별도로 보호 중입니다.
                  </>
                ) : (
                  <>
                    <strong>후보만 분해 OFF</strong> · 전체 대기열 {salvageInfo.totalQueued}개를 자동 분해 대상으로 처리합니다.
                    위험 후보까지 포함되므로 실행 전 목록을 확인하세요.
                  </>
                )}
              </div>
              <div className="games-rank-split" style={{ marginBottom: 12 }}>
                <SmallStat label="대기열" value={`${salvageInfo.totalQueued}개`} />
                <SmallStat label="실행 대상" value={`${salvageInfo.executableCount}개`} />
                <SmallStat label="보호" value={`${salvageInfo.protectedByCandidateOnly}개`} />
                <SmallStat label="고철" value={salvageInfo.totals.scrap} />
                <SmallStat label="강화석" value={salvageInfo.totals.stone} />
                <SmallStat label="리롤권" value={salvageInfo.totals.ticket} />
                <SmallStat label="위험 후보" value={`${salvageInfo.highRiskCount}개`} />
              </div>
              {validSelectedSalvageUids.length ? (
                <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                  <strong>선택 {selectedSalvageInfo.selectedCount}개</strong>
                  {' · '}
                  실행 {selectedSalvageInfo.executableCount}개 / 보호 {selectedSalvageInfo.protectedByCandidateOnly}개
                  {' · '}
                  예상 보상 {selectedSalvageInfo.totalRewardText}
                  {selectedSalvageInfo.candidateOnly && selectedSalvageInfo.highRiskCount ? ' · 위험 후보는 보호됩니다.' : ''}
                </div>
              ) : null}
              <div className="game-save-list">
                <article className="game-save-row">
                  <div>
                    <span>희귀도: {salvageInfo.byRarityText}</span>
                    <strong>슬롯 분포: {salvageInfo.bySlotText}</strong>
                  </div>
                </article>
                {salvageInfo.highRiskCount ? (
                  <article className="game-save-row">
                    <div>
                      <span>RARE 이상 / 강화 +3 이상 / 점수 120 이상</span>
                      <strong>위험 후보 상위: {salvageInfo.topRiskRows.map((entry) => `${entry.name}(${entry.score})`).join(', ')}</strong>
                    </div>
                    <strong>주의</strong>
                  </article>
                ) : null}
                {salvage.slice(0, 8).map((entry) => (
                  <article className="game-save-row" key={`${entry.uid}-${entry.createdAt}`}>
                    <div>
                      <span>{slotLabel(entry.slot)} · {entry.rarity} · {entry.reason}</span>
                      <strong>{entry.name}</strong>
                      <small>{entry.rewardText}</small>
                      <small>점수 {entry.score} · {entry.executable ? '실행 대상' : '보호'}</small>
                    </div>
                    <label className="schale-salvage-check">
                      <input
                        type="checkbox"
                        checked={validSelectedSalvageUids.includes(entry.uid)}
                        onChange={() => toggleSalvageSelection(entry.uid)}
                      />
                      <span>선택</span>
                    </label>
                  </article>
                ))}
              </div>
            </>
          ) : <div className="games-empty">분해 대기 중인 장비가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>미션</h2>
            <button type="button" className="tcg-primary-action" onClick={() => setState((current) => claimMissionRewardsAction(current))}>보상 수령</button>
          </div>
          <div className="game-save-list">
            {missions.map((mission) => (
              <article className="game-save-row" key={mission.id}>
                <div>
                  <span>{mission.type} · {mission.progress}/{mission.target}</span>
                  <strong>{mission.name}</strong>
                </div>
                <strong>{mission.claimed ? '수령' : mission.done ? '완료' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>업적</h2>
            <button type="button" className="tcg-primary-action" disabled={!claimableAchievements} onClick={() => setState((current) => claimAchievementRewardsAction(current))}>
              {claimableAchievements ? `${claimableAchievements}개 수령` : '수령 없음'}
            </button>
          </div>
          <div className="game-save-list">
            {achievements.map((achievement) => (
              <article className="game-save-row" key={achievement.id}>
                <div>
                  <span>{achievement.progress}/{achievement.target}{achievement.titleName ? ` · ${achievement.titleName}` : ''}</span>
                  <strong>{achievement.name}</strong>
                  <small>{achievement.desc}</small>
                </div>
                <strong>{achievement.claimed ? '수령' : achievement.done ? '완료' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>칭호</h2>
            <span>{equippedTitle ? equippedTitle.name : '미장착'}</span>
          </div>
          <div className="game-save-list">
            {titles.map((title) => (
              <article className="game-save-row" key={title.id}>
                <div>
                  <span>{title.kind === 'POWER_MUL' ? '전투력' : '크레딧'} x{Number(title.mul || 1).toFixed(2)}</span>
                  <strong>{title.name}</strong>
                  <small>{title.desc}</small>
                </div>
                <button type="button" disabled={!title.unlocked} onClick={() => setState((current) => equipTitleAction(current, title.equipped ? null : title.id))}>
                  {title.equipped ? '해제' : title.unlocked ? '장착' : '잠김'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'records',
            label: '보고서/로그',
            badge: `${state.log.length}개`,
            children: (
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>성장 판단</h2>
            <span>{growthReport.statusTone === 'good' ? '안정' : growthReport.statusTone === 'warn' ? '점검 필요' : '위험'}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="전투력" value={growthReport.combat.power.toLocaleString('ko-KR')} />
            <SmallStat label="연패 보정" value={`+${growthReport.combat.towerCatchupPct}%`} />
            <SmallStat label="빈 슬롯" value={growthReport.resources.missingSlots.length ? growthReport.resources.missingSlots.join(', ') : '없음'} />
            <SmallStat label="연구 가능" value={`${growthReport.resources.readyUpgrades}개`} />
            <SmallStat label="1시간 방치" value={`${growthReport.offlineProjection.hourlyCredits.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="방치 상한" value={`${growthReport.offlineProjection.capHours}시간`} />
          </div>
          <div className="game-save-list">
            {growthReport.nextMission ? (
              <article className="game-save-row">
                <div>
                  <span>미션 {growthReport.nextMission.progress}/{growthReport.nextMission.target} · {growthReport.nextMission.pct}%</span>
                  <strong>{growthReport.nextMission.name}</strong>
                </div>
              </article>
            ) : null}
            {growthReport.nextAchievement ? (
              <article className="game-save-row">
                <div>
                  <span>업적 {growthReport.nextAchievement.progress}/{growthReport.nextAchievement.target} · {growthReport.nextAchievement.pct}%</span>
                  <strong>{growthReport.nextAchievement.name}</strong>
                </div>
              </article>
            ) : null}
            {growthReport.blockers.length ? (
              <article className="game-save-row">
                <div>
                  <span>병목</span>
                  <strong>{growthReport.blockers.join(' / ')}</strong>
                </div>
                <strong>점검</strong>
              </article>
            ) : (
              <article className="game-save-row">
                <div>
                  <span>병목 없음</span>
                  <strong>현재 루프는 안정적으로 이어갈 수 있습니다.</strong>
                </div>
                <strong>안정</strong>
              </article>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>근무 보고서</h2>
            <span>{state.lastDutyReport ? `${state.lastDutyReport.fromFloor}-${state.lastDutyReport.toFloor}층` : '없음'}</span>
          </div>
          {state.lastDutyReport ? (
            <div className="games-activity-list">
              <div>
                <strong>획득 {Number(state.lastDutyReport.totalCreditsGained || 0).toLocaleString('ko-KR')} Cr · {state.lastDutyReport.stoppedReason}</strong>
              </div>
              {(state.lastDutyReport.highlights || []).map((line, index) => (
                <div key={`${line}-${index}`}>
                  <strong>{line}</strong>
                </div>
              ))}
            </div>
          ) : <div className="games-empty">아직 방치 정산 보고서가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>탑 보고서</h2>
            <span>{state.towerLastBatchReport ? `${state.towerLastBatchReport.successes}승 ${state.towerLastBatchReport.failures}패` : '없음'}</span>
          </div>
          {state.towerLastBatchReport ? (
            <div className="games-activity-list">
              <div>
                <strong>
                  요청 {Number(state.towerLastBatchReport.requested || 0)}회 · {state.towerLastBatchReport.stopOnFail === false ? '실패해도 계속' : '실패 시 중단'}
                  {' · '}
                  획득 {Number(state.towerLastBatchReport.creditsGained || 0).toLocaleString('ko-KR')} Cr · 토큰 {Number(state.towerLastBatchReport.tokensGained || 0)}
                </strong>
              </div>
              {(state.towerLastBatchReport.logs || []).map((line, index) => (
                <div key={`${line}-${index}`}>
                  <strong>{line}</strong>
                </div>
              ))}
            </div>
          ) : <div className="games-empty">아직 탑 도전 보고서가 없습니다.</div>}
        </section>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>최근 로그</h2>
          <span>{state.runId}</span>
        </div>
        <div className="games-activity-list">
          {state.log.slice(0, 12).map((line, index) => (
            <div key={`${line}-${index}`}>
              <strong>{line}</strong>
            </div>
          ))}
        </div>
      </section>
              </>
            ),
          },
        ]}
      />
    </GamePlayShell>
  );
}
