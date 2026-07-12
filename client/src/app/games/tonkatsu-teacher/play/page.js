'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameActionIcon from '../../_components/GameActionIcon';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import TonkatsuTeacherFeatureTabs from '../_components/TonkatsuTeacherFeatureTabs';
import { tonkatsuResultCue } from '../_lib/tonkatsuTeacherFeedback';
import {
  GAME_SLUG,
  COSMETIC_SLOT_LABELS,
  INGREDIENTS,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  battleForecast,
  buildFacilityContext,
  cosmeticRows,
  createNewState,
  facilityRows,
  getPlayTimeSec,
  getStudent,
  ingredientName,
  judgeRecentSummary,
  judgeSummary,
  mealTokenCount,
  methodRows,
  normalizeState,
  operationsReportForState,
  productionReportForState,
  recipeMethodProfile,
  recipeName,
  recipeRows,
  researchRows,
  scoreState,
  summaryForState,
  tournamentPreview,
} from '../_lib/tonkatsuTeacherEngine';

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function formatSigned(value, unit = '') {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('ko-KR')}${unit}`;
}

function buildSelectedRecipePlan({ state, recipe, recipeStatus, student, tournament, facilityContext, methodProfile, battlePreview, tokenCount }) {
  const ingredientPrices = INGREDIENTS.reduce((map, item) => ({ ...map, [item.id]: Number(item.price || 0) }), {});
  const needRows = Object.entries(recipe.needs || {}).map(([id, qty]) => {
    const required = Number(qty || 0);
    const owned = Number(state.inventory?.[id] || 0);
    const missing = Math.max(0, required - owned);
    return {
      id,
      name: ingredientName(id),
      required,
      owned,
      missing,
      buyCost: missing * Number(ingredientPrices[id] || 0),
    };
  });
  const missingRows = needRows.filter((row) => row.missing > 0);
  const missingTotal = missingRows.reduce((sum, row) => sum + row.missing, 0);
  const missingBuyCost = missingRows.reduce((sum, row) => sum + row.buyCost, 0);
  const ingredientInputCost = needRows.reduce((sum, row) => sum + row.required * Number(ingredientPrices[row.id] || 0), 0);
  const productionMult = (recipe.tags || []).reduce((mult, tag) => mult * Number(facilityContext.productionMultByTag?.[tag] || 1), 1);
  const expectedYield = Math.max(1, Math.round(Number(recipe.yieldTokens || 1) * productionMult * methodProfile.productionMult * 100) / 100);
  const demand = 1 + Math.min(0.3, Number(state.reputation || 0) / 1000);
  const deliveryActive = state.businessMode === 'delivery' && facilityContext.deliveryUnlocked;
  const directRevenue = Math.round(Number(recipe.sellPrice || 0) * expectedYield * demand * (deliveryActive ? Number(facilityContext.deliveryGoldMult || 1) : 1));
  const orderRevenue = Math.round(Number(recipe.sellPrice || 0) * expectedYield * Number(facilityContext.goldMultFromOrders || 1));
  const bestRevenue = Math.max(directRevenue, orderRevenue);
  const investment = Number(recipe.craftCost || 0) + ingredientInputCost;
  const margin = bestRevenue - investment;
  const canCraft = Boolean(recipeStatus.unlocked) && Number(state.gold || 0) >= Number(recipe.craftCost || 0) && missingTotal === 0;
  const likes = battlePreview.likes;
  const weak = battlePreview.weak;
  const moraleGain = battlePreview.moraleGain;
  const heal = battlePreview.heal;
  const feedWinPct = battlePreview.chancePct;
  const tournamentGap = Number(tournament.total || 0) - Number(tournament.tier?.targetScore || 0);
  const planScore = Math.round(clampNumber(
    (recipeStatus.unlocked ? 18 : 0)
      + (canCraft || tokenCount > 0 ? 22 : 0)
      + clampNumber(12 + margin / 8, 0, 22)
      + (weak ? 0 : likes ? 16 : 9)
      + clampNumber(8 + tournamentGap / 3, 0, 18)
      + clampNumber((methodProfile.successPct - 80) * 0.6, 0, 6),
    0,
    100,
  ));

  let nextAction = '선택 메뉴를 기준으로 제작, 판매, 배식, 대회 중 하나를 고르세요.';
  if (!recipeStatus.unlocked) {
    nextAction = recipeStatus.reason || '레시피 해금 조건을 먼저 달성하세요.';
  } else if (Number(state.gold || 0) < Number(recipe.craftCost || 0)) {
    nextAction = `제작비 ${Number(recipe.craftCost || 0).toLocaleString('ko-KR')}G가 필요합니다. 주문 처리나 전투 보상으로 골드를 회수하세요.`;
  } else if (missingTotal > 0) {
    nextAction = `${missingRows.map((row) => `${row.name} ${row.missing}`).join(', ')} 매입 후 제작하세요. 예상 매입비 ${missingBuyCost.toLocaleString('ko-KR')}G입니다.`;
  } else if (tokenCount <= 0) {
    nextAction = `바로 제작 가능합니다. 예상 생산 ${expectedYield}개, 선택 영업 기준 마진 ${formatSigned(margin, 'G')}입니다.`;
  } else if (weak) {
    nextAction = `${student.name}에게는 약점 태그가 걸립니다. 판매나 다른 학생 배식이 더 안정적입니다.`;
  } else if (Number(student.currentHp || 0) < Number(student.hp || 1) * 0.75 || Number(student.morale || 0) < 58) {
    nextAction = `${student.name}에게 배식하면 HP +${heal}, 사기 +${moraleGain}, 전투 예상 ${feedWinPct}%입니다.`;
  } else if (tournament.win && Number(state.gold || 0) >= Number(tournament.tier?.entryGold || 0)) {
    nextAction = `${tournament.tier.name} 대회가 우승권입니다. 예상 ${tournament.total}점으로 출전 가치가 있습니다.`;
  } else {
    nextAction = `준비 메뉴 ${tokenCount}개를 ${orderRevenue >= directRevenue ? '일일 주문' : '선택 판매'}로 회수하는 편이 좋습니다.`;
  }

  return {
    planScore,
    canCraft,
    expectedYield,
    prepText: canCraft ? `${methodProfile.successPct}%` : missingRows.length ? `${missingTotal}개 부족` : '비용 부족',
    margin,
    salesMode: orderRevenue >= directRevenue ? '주문' : deliveryActive ? '배달' : '홀',
    studentFit: weak ? '주의' : likes ? '적합' : '보통',
    tournamentText: `${tournament.total}/${tournament.tier.targetScore} (${formatSigned(tournamentGap)})`,
    nextAction,
    rows: [
      {
        label: '조리 공정',
        value: `${methodProfile.methods.length}단계 · ${methodProfile.successPct}%`,
        detail: `${methodProfile.methods.map((method) => method.name).join(' → ') || '기본 조리'} · 숙련 생산 ${methodProfile.productionText}`,
      },
      {
        label: '제작 준비',
        value: canCraft ? '가능' : missingRows.length ? `${missingTotal}개 부족` : '비용 확인',
        detail: missingRows.length ? `부족: ${missingRows.map((row) => `${row.name} ${row.missing}`).join(', ')}` : `예상 생산 ${expectedYield}개`,
      },
      {
        label: '판매 마진',
        value: `${formatSigned(margin, 'G')}`,
        detail: `주문 ${orderRevenue.toLocaleString('ko-KR')}G / 직접 ${directRevenue.toLocaleString('ko-KR')}G 기준`,
      },
      {
        label: '학생 적합',
        value: weak ? '약점' : likes ? '선호' : '보통',
        detail: `${student.name}: ${likes ? '선호 태그 일치' : weak ? '약점 태그 충돌' : '태그 보정 없음'} · ${feedWinPct}%`,
      },
      {
        label: '대회 격차',
        value: tournament.win ? '우승권' : formatSigned(tournamentGap),
        detail: `${tournament.theme.name} · 목표 ${tournament.tier.targetScore}점`,
      },
    ],
  };
}

export default function TonkatsuTeacherPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'kitchen' });
  const [state, setState] = useState(() => createNewState());
  const feedbackRef = useRef(state);
  const [recipeId, setRecipeId] = useState('basic_tonkatsu');
  const [ingredientId, setIngredientId] = useState('pork');
  const [studentId, setStudentId] = useState('yuuka');
  const [tournamentTierId, setTournamentTierId] = useState('rookie');
  const [judgeTierId, setJudgeTierId] = useState('rookie');
  const [judgePick, setJudgePick] = useState('A');
  const [judgeText, setJudgeText] = useState('');
  const [judgeBatchCount, setJudgeBatchCount] = useState(10);
  const [judgeBatchMode, setJudgeBatchMode] = useState('random');
  const [recentAutoOnly, setRecentAutoOnly] = useState(false);
  const [judgeHistoryMode, setJudgeHistoryMode] = useState('all');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const cue = tonkatsuResultCue(feedbackRef.current, state);
    if (cue) playGameSfx(cue);
    feedbackRef.current = state;
  }, [playGameSfx, state]);

  const recipes = recipeRows(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const recipeStatus = recipes.find((item) => item.id === recipe.id) || { unlocked: true, reason: '' };
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId) || INGREDIENTS[0];
  const student = getStudent(state, studentId);
  const facilities = facilityRows(state);
  const researches = researchRows(state);
  const facilityContext = buildFacilityContext(state);
  const cosmetics = cosmeticRows(state);
  const ownedCosmetics = cosmetics.filter((item) => item.owned);
  const equippedCosmetics = Object.entries(COSMETIC_SLOT_LABELS).map(([slot, label]) => ({
    slot,
    label,
    item: cosmetics.find((cosmetic) => cosmetic.slot === slot && cosmetic.equipped),
  }));
  const tournament = tournamentPreview(state, recipeId, tournamentTierId);
  const judge = judgeSummary(state);
  const judgeRecent = judgeRecentSummary(state, {
    limit: judgeBatchCount,
    autoOnly: recentAutoOnly,
    mode: judgeHistoryMode,
  });
  const judgeMatch = judge.match;
  const score = scoreState(state);
  const ended = Boolean(state.ended);
  const canAct = !ended;
  const operationsReport = operationsReportForState(state);
  const productionReport = productionReportForState(state);
  const tokenCount = Number(state.mealTokens[recipe.id] || 0);
  const cookingMethodRows = methodRows(state, recipeId);
  const methodProfile = recipeMethodProfile(state, recipe);
  const feedBattlePreview = battleForecast(state, studentId, recipeId, { afterFeed: true });
  const winRatePreview = feedBattlePreview.chancePct;
  const inventoryRows = Object.entries(state.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => ingredientName(a).localeCompare(ingredientName(b), 'ko-KR'));
  const tokenRows = Object.entries(state.mealTokens)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => recipeName(a).localeCompare(recipeName(b), 'ko-KR'));
  const recentActionText = state.log?.[0] || '아직 실행한 운영 액션이 없습니다.';
  const selectedRecipePlan = buildSelectedRecipePlan({
    state,
    recipe,
    recipeStatus,
    student,
    tournament,
    facilityContext,
    methodProfile,
    battlePreview: feedBattlePreview,
    tokenCount,
  });

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 운영 데이터를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Tonkatsu Teacher Day ${state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('운영 데이터를 저장했습니다.');
      showToast({ tone: 'success', message: '돈카츠 선생 운영 데이터를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 운영 데이터를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 돈카츠 선생 데이터가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      feedbackRef.current = nextState;
      setState(nextState);
      setMessage('저장된 운영 데이터를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 돈카츠 선생 데이터를 불러왔습니다.' });
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
      setMessage('로그인하면 운영 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Tonkatsu Teacher Day ${state.day}`,
        mode: 'management-loop',
        result: state.floor >= 10 ? 'clear' : 'score',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('운영 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: '돈카츠 선생 결과를 전적에 기록했습니다.' });
      setState((current) => ({ ...current, ended: true }));
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
    setRecipeId('basic_tonkatsu');
    setIngredientId('pork');
    setStudentId('yuuka');
    setTournamentTierId('rookie');
    setJudgeTierId('rookie');
    setJudgePick('A');
    setJudgeText('');
    setJudgeBatchCount(10);
    setJudgeBatchMode('random');
    setMessage('');
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 운영</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '운영 기록'}</GameControlButton>
      <Link href="/myanime/tonkatsu-teacher" data-game-sfx="select"><GameActionIcon action="settings" label="상세" />상세</Link>
    </>
  );

  const metrics = [
    { label: 'Day', value: state.day },
    { label: 'Gold', value: `${Number(state.gold || 0).toLocaleString('ko-KR')}G` },
    { label: '평판', value: state.reputation },
    { label: '전투층', value: state.floor },
    { label: '운영', value: `${operationsReport.readinessPct}%` },
    { label: '연출', value: `${productionReport.productionScore}%` },
    { label: '시설', value: Object.values(state.facilityLevels || {}).reduce((sum, level) => sum + Number(level || 0), 0) },
    { label: '장식', value: `${ownedCosmetics.length}/${cosmetics.length}` },
    { label: '대회승', value: Number(state.counters.tournamentWins || 0) },
    { label: '메뉴', value: mealTokenCount(state) },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만, 저장/불러오기/전적 기록은 로그인해야 사용할 수 있습니다.' } : null,
    ended ? { key: 'ended', tone: 'error', text: '운영 리포트가 종료 상태입니다. 결과를 기록하거나 새 운영을 시작하세요.' } : null,
  ];

  const guide = {
    title: '운영 코치',
    badge: `${operationsReport.readinessPct}%`,
    primaryTitle: ended ? '운영 종료' : operationsReport.headline,
    primaryText: ended
      ? '결과를 기록하거나 새 운영을 시작하세요.'
      : `${operationsReport.riskLabel} 상태입니다. 재료, 메뉴, 학생 배식, 토너먼트 루프 중 병목을 먼저 처리하세요.`,
    focusRows: [
      { label: 'Gold', value: `${Number(state.gold || 0).toLocaleString('ko-KR')}G` },
      { label: '메뉴 토큰', value: mealTokenCount(state) },
      { label: '선택 메뉴', value: `${selectedRecipePlan.planScore}%` },
      { label: '운영', value: `${operationsReport.readinessPct}%` },
      { label: '연출', value: `${productionReport.productionScore}%` },
    ],
    adviceLines: operationsReport.recommendations.slice(0, 4).map((item) => ({
      kind: item.priority === 'high' ? '우선' : item.priority === 'medium' ? '추천' : '보조',
      title: item.title,
      detail: item.detail,
    })),
  };

  return (
    <GamePlayShell
      kicker="Tonkatsu Teacher"
      title="돈카츠 선생"
      description="재료를 사고 메뉴를 만들어 판매하거나 학생에게 배식한 뒤 전투 보상으로 다시 가게를 키우는 경영 루프 slice입니다."
      summaryLabel="돈카츠 선생 요약"
      summaryDensity="micro"
      primaryMetricLimit={11}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact storageKey="tonkatsu-teacher-operations-coach" />
      <RecentActionResult label="이번 운영 결과" text={recentActionText} pinned />

      <TonkatsuTeacherFeatureTabs
        canAct={canAct}
        cosmetics={cosmetics}
        equippedCosmetics={equippedCosmetics}
        facilities={facilities}
        facilityContext={facilityContext}
        formatSigned={formatSigned}
        ingredient={ingredient}
        ingredientId={ingredientId}
        inventoryRows={inventoryRows}
        judge={judge}
        judgeBatchCount={judgeBatchCount}
        judgeBatchMode={judgeBatchMode}
        judgeHistoryMode={judgeHistoryMode}
        judgeMatch={judgeMatch}
        judgePick={judgePick}
        judgeRecent={judgeRecent}
        judgeText={judgeText}
        judgeTierId={judgeTierId}
        operationsReport={operationsReport}
        ownedCosmetics={ownedCosmetics}
        productionReport={productionReport}
        methodProfile={methodProfile}
        methodRows={cookingMethodRows}
        recipe={recipe}
        recipeId={recipeId}
        recipes={recipes}
        recipeStatus={recipeStatus}
        recentAutoOnly={recentAutoOnly}
        researches={researches}
        selectedRecipePlan={selectedRecipePlan}
        setIngredientId={setIngredientId}
        setJudgeBatchCount={setJudgeBatchCount}
        setJudgeBatchMode={setJudgeBatchMode}
        setJudgeHistoryMode={setJudgeHistoryMode}
        setJudgePick={setJudgePick}
        setJudgeText={setJudgeText}
        setJudgeTierId={setJudgeTierId}
        setRecipeId={setRecipeId}
        setRecentAutoOnly={setRecentAutoOnly}
        setState={setState}
        setStudentId={setStudentId}
        setTournamentTierId={setTournamentTierId}
        state={state}
        student={student}
        studentId={studentId}
        tokenCount={tokenCount}
        tokenRows={tokenRows}
        tournament={tournament}
        tournamentTierId={tournamentTierId}
        winRatePreview={winRatePreview}
      />
    </GamePlayShell>
  );
}
