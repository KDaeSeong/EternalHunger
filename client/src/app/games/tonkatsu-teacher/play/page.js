'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell, { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  GAME_SLUG,
  INGREDIENTS,
  JUDGE_BATCH_MODE_LABELS,
  JUDGE_HISTORY_MODE_LABELS,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  TOURNAMENT_TIERS,
  averageStudents,
  battleAction,
  buildFacilityContext,
  buyIngredientAction,
  clearJudgeHistoryAction,
  craftRecipeAction,
  createNewState,
  enterTournamentAction,
  facilityRows,
  feedStudentAction,
  formatNeeds,
  fulfillDailyOrdersAction,
  getPlayTimeSec,
  getStudent,
  ingredientName,
  inventoryCount,
  judgeRecentSummary,
  judgeSummary,
  mealTokenCount,
  nextDayAction,
  normalizeState,
  operationsReportForState,
  productionReportForState,
  recipeName,
  recipeRows,
  researchRecipeAction,
  researchRows,
  runJudgeBatchAction,
  scoreState,
  sellRecipeAction,
  setBusinessModeAction,
  startJudgeMatchAction,
  submitJudgePickAction,
  summaryForState,
  tournamentPreview,
  upgradeFacilityAction,
} from '../_lib/tonkatsuTeacherEngine';

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function formatSigned(value, unit = '') {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('ko-KR')}${unit}`;
}

function buildSelectedRecipePlan({ state, recipe, recipeStatus, student, tournament, facilityContext, tokenCount }) {
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
  const expectedYield = Math.max(1, Math.floor(Number(recipe.yieldTokens || 1) * productionMult));
  const demand = 1 + Math.min(0.3, Number(state.reputation || 0) / 1000);
  const deliveryActive = state.businessMode === 'delivery' && facilityContext.deliveryUnlocked;
  const directRevenue = Math.round(Number(recipe.sellPrice || 0) * expectedYield * demand * (deliveryActive ? Number(facilityContext.deliveryGoldMult || 1) : 1));
  const orderRevenue = Math.round(Number(recipe.sellPrice || 0) * expectedYield * Number(facilityContext.goldMultFromOrders || 1));
  const bestRevenue = Math.max(directRevenue, orderRevenue);
  const investment = Number(recipe.craftCost || 0) + ingredientInputCost;
  const margin = bestRevenue - investment;
  const canCraft = Boolean(recipeStatus.unlocked) && Number(state.gold || 0) >= Number(recipe.craftCost || 0) && missingTotal === 0;
  const likes = (recipe.tags || []).includes(student.pref);
  const weak = (recipe.tags || []).includes(student.weak);
  const moraleGain = Math.round(12 * (likes ? 1.35 : 1) * (weak ? 0.7 : 1));
  const heal = Math.round(Number(recipe.power || 0) * (likes ? 1.2 : 1));
  const nextMorale = clampNumber(Number(student.morale || 0) + moraleGain, 0, 100);
  const battleTarget = 116 + Number(state.floor || 1) * 18;
  const feedBattlePower = Number(student.atk || 0) * 8
    + Number(student.def || 0) * 5
    + nextMorale
    + Number(recipe.power || 0)
    + (likes ? 10 : 0)
    - (weak ? 8 : 0);
  const feedWinPct = Math.round(clampNumber(0.35 + (feedBattlePower - battleTarget) / 160, 0.12, 0.92) * 100);
  const tournamentGap = Number(tournament.total || 0) - Number(tournament.tier?.targetScore || 0);
  const planScore = Math.round(clampNumber(
    (recipeStatus.unlocked ? 18 : 0)
      + (canCraft || tokenCount > 0 ? 22 : 0)
      + clampNumber(12 + margin / 8, 0, 22)
      + (weak ? 0 : likes ? 16 : 9)
      + clampNumber(12 + tournamentGap / 3, 0, 22),
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
    prepText: canCraft ? '가능' : missingRows.length ? `${missingTotal}개 부족` : '비용 부족',
    margin,
    salesMode: orderRevenue >= directRevenue ? '주문' : deliveryActive ? '배달' : '홀',
    studentFit: weak ? '주의' : likes ? '적합' : '보통',
    tournamentText: `${tournament.total}/${tournament.tier.targetScore} (${formatSigned(tournamentGap)})`,
    nextAction,
    rows: [
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
  const [state, setState] = useState(() => createNewState());
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

  const recipes = recipeRows(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const recipeStatus = recipes.find((item) => item.id === recipe.id) || { unlocked: true, reason: '' };
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId) || INGREDIENTS[0];
  const student = getStudent(state, studentId);
  const facilities = facilityRows(state);
  const researches = researchRows(state);
  const facilityContext = buildFacilityContext(state);
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
  const winRatePreview = Math.round(Math.max(12, Math.min(92, 35 + (((student.atk * 8 + student.def * 5 + student.morale + (recipe.power || 0)) - (116 + state.floor * 18)) / 160) * 100)));
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
      setState(normalizeState(detail?.save?.payload?.state));
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
      <button type="button" onClick={startNewRun}>새 운영</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '운영 기록'}</button>
      <Link href="/myanime/tonkatsu-teacher">상세</Link>
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
      summaryDensity="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />
      <RecentActionResult label="이번 운영 결과" text={recentActionText} pinned />

      <GameFeatureTabs
        tabs={[
          {
            id: 'operations',
            label: '운영 리포트',
            badge: `${operationsReport.readinessPct}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운영 상태</h2>
                    <span>{operationsReport.headline} · {operationsReport.riskLabel}</span>
                  </div>
                  <div className="games-rank-split">
                    {operationsReport.businessRows.map((row) => (
                      <SmallStat label={row.label} value={row.value} key={row.label} />
                    ))}
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {operationsReport.recommendations.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.priority === 'high' ? '우선' : item.priority === 'medium' ? '추천' : '보조'}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>주요 지표</h2>
                    <span>제작 · 성장 · 전투</span>
                  </div>
                  <div className="games-rank-split">
                    {[...operationsReport.kitchenRows, ...operationsReport.growthRows, ...operationsReport.battleRows].map((row) => (
                      <SmallStat label={row.label} value={row.value} key={`${row.label}-${row.value}`} />
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'tutorial',
            label: '튜토리얼/밸런스',
            badge: `${operationsReport.tutorialPct}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>초반 체크리스트</h2>
                    <span>{operationsReport.tutorialPct}%</span>
                  </div>
                  <div className="game-save-list">
                    {operationsReport.tutorialRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.done ? '완료' : `${row.progressPct}%`}</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                          <small>{row.actionHint}</small>
                        </div>
                        <strong>{row.done ? 'OK' : '진행'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>밸런스 점검</h2>
                    <span>{operationsReport.balanceScore}%</span>
                  </div>
                  <div className="game-save-list">
                    {operationsReport.balanceRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.tone === 'good' ? '안정' : row.tone === 'watch' ? '주의' : '위험'} · {row.pct}%</span>
                          <strong>{row.label}: {row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'good' ? 'OK' : row.tone === 'watch' ? '조정' : '우선'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'production',
            label: '연출/이벤트',
            badge: `${productionReport.productionScore}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>현재 장면</h2>
                    <span>{productionReport.phase}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="연출 점수" value={`${productionReport.productionScore}%`} />
                    <SmallStat label="장면 수" value={productionReport.sceneCues.length} />
                    <SmallStat label="이벤트" value={productionReport.eventRows.length} />
                    <SmallStat label="사운드 큐" value={productionReport.soundCues.length} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {productionReport.sceneCues.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '준비' : '세팅'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>장기 이벤트 변형</h2>
                    <span>영업 · 전투 · 심사</span>
                  </div>
                  <div className="game-save-list">
                    {productionReport.eventRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.trigger} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'ready' ? '발동권' : '준비중'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>사운드 큐</h2>
                    <span>{productionReport.soundCues.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {productionReport.soundCues.map((cue) => (
                      <article className="game-save-row" key={cue.id}>
                        <div>
                          <span>{cue.target}</span>
                          <strong>{cue.cue}</strong>
                          <small>{cue.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>다음 연출 포인트</h2>
                    <span>추천</span>
                  </div>
                  <div className="games-activity-list">
                    {productionReport.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'kitchen',
            label: '주방/영업',
            badge: `${mealTokenCount(state)}개`,
            children: (
              <>
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>선택 메뉴 운영 판단</h2>
                  <span>{selectedRecipePlan.planScore}% · {selectedRecipePlan.salesMode}</span>
                </div>
                <div className="games-rank-split">
                  <SmallStat label="제작 준비" value={selectedRecipePlan.prepText} />
                  <SmallStat label="예상 생산" value={`${selectedRecipePlan.expectedYield}개`} />
                  <SmallStat label="마진" value={formatSigned(selectedRecipePlan.margin, 'G')} />
                  <SmallStat label="학생 적합" value={selectedRecipePlan.studentFit} />
                  <SmallStat label="대회" value={selectedRecipePlan.tournamentText} />
                </div>
                <p style={{ color: '#cbd5e1', fontWeight: 900, lineHeight: 1.6, marginTop: 12 }}>
                  {selectedRecipePlan.nextAction}
                </p>
                <div className="game-save-list" style={{ marginTop: 12 }}>
                  {selectedRecipePlan.rows.map((row) => (
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

              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 제작</h2>
                    <span>{recipe.name}</span>
                  </div>
                  <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
                    필요: {formatNeeds(recipe.needs)}
                  </p>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>메뉴 제작</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => sellRecipeAction(current, recipeId))}>선택 메뉴 판매</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => fulfillDailyOrdersAction(current))}>일일 주문 처리</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 매입</h2>
                    <span>{ingredient.name}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="가격" value={`${ingredient.price}G`} />
                    <SmallStat label="보유 재료" value={inventoryCount(state)} />
                    <SmallStat label="보관 한도" value={facilityContext.storageCap} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 1))}>1개 구매</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 5))}>5개 구매</ActionButton>
                  </div>
                </section>
              </section>
              </>
            ),
          },
          {
            id: 'students',
            label: '학생/전투',
            badge: `${winRatePreview}%`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학생 지원</h2>
                    <span>{student.name}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="HP" value={`${student.currentHp}/${student.hp}`} />
                    <SmallStat label="사기" value={student.morale} />
                    <SmallStat label="승률" value={`${winRatePreview}%`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => feedStudentAction(current, studentId, recipeId))}>선택 메뉴 배식</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => battleAction(current, studentId))}>전투 진행</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => nextDayAction(current))}>다음 영업일</ActionButton>
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'growth',
            label: '성장/대회',
            badge: `${state.recipeShards}조각`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>성장 후보</h2>
                    <span>시설 · 연구</span>
                  </div>
                  <div className="games-rank-split">
                    {operationsReport.growthRows.map((row) => (
                      <SmallStat label={row.label} value={row.value} key={row.label} />
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>대회 미리보기</h2>
                    <span>{tournament.theme.name}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="예상 점수" value={tournament.total} />
                    <SmallStat label="목표" value={tournament.tier.targetScore} />
                    <SmallStat label="판정" value={tournament.win ? '우승권' : '부족'} />
                  </div>
                  <ActionButton disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => enterTournamentAction(current, recipeId, tournamentTierId))}>선택 메뉴로 출전</ActionButton>
                </section>
              </section>
            ),
          },
          {
            id: 'judge',
            label: '심사',
            badge: `${judge.accuracy}%`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>심사 빠른 실행</h2>
                    <span>{judge.rank}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="심사" value={judge.judged} />
                    <SmallStat label="정답" value={judge.correct} />
                    <SmallStat label="정확도" value={`${judge.accuracy}%`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => {
                      setJudgePick('A');
                      setJudgeText('');
                      setState((current) => startJudgeMatchAction(current, judgeTierId));
                    }}>새 심사 매치</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => runJudgeBatchAction(current, judgeTierId, judgeBatchCount, judgeBatchMode))}>자동 심사 실행</ActionButton>
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'advanced',
            label: '상세 관리',
            badge: `${inventoryRows.length + tokenRows.length}종`,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주방</h2>
            <span>제작비 {recipe.craftCost}G</span>
          </div>
          <label className="game-save-json-field">
            <span>레시피</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {recipes.map((item) => (
                <option value={item.id} key={item.id} disabled={!item.unlocked}>
                  {item.unlocked ? item.name : `${item.name} · ${item.reason}`}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            필요: {formatNeeds(recipe.needs)}
          </p>
          <p style={{ color: '#94a3b8', fontWeight: 800, lineHeight: 1.5 }}>{recipe.note}</p>
          {!recipeStatus.unlocked ? <p style={{ color: '#fbbf24', fontWeight: 900, lineHeight: 1.5 }}>{recipeStatus.reason}</p> : null}
          <div className="games-rank-split">
            <SmallStat label="보유" value={tokenCount} />
            <SmallStat label="판매가" value={`${recipe.sellPrice}G`} />
            <SmallStat label="전투 보정" value={recipe.power} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>메뉴 제작</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => sellRecipeAction(current, recipeId))}>영업 판매</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => feedStudentAction(current, studentId, recipeId))}>선택 학생에게 배식</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재료 상점</h2>
            <span>재료 {inventoryCount(state)}</span>
          </div>
          <label className="game-save-json-field">
            <span>재료</span>
            <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
              {INGREDIENTS.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}G</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {ingredient.name} · 희귀도 {ingredient.rarity} · #{ingredient.tags.join(' #')}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 1))}>1개 구매</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 5))}>5개 구매</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => fulfillDailyOrdersAction(current))}>일일 주문 처리</ActionButton>
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="보관 한도" value={`${inventoryCount(state)}/${facilityContext.storageCap}`} />
            <SmallStat label="주문량" value={facilityContext.dailyOrders} />
            <SmallStat label="영업 배율" value={`x${facilityContext.goldMultFromOrders.toFixed(2)}`} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton disabled={!canAct || state.businessMode === 'hall'} onClick={() => setState((current) => setBusinessModeAction(current, 'hall'))}>홀 영업</ActionButton>
            <ActionButton disabled={!canAct || state.businessMode === 'delivery'} onClick={() => setState((current) => setBusinessModeAction(current, 'delivery'))}>배달 영업</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학생 지원</h2>
            <span>예상 승률 {winRatePreview}%</span>
          </div>
          <label className="game-save-json-field">
            <span>학생</span>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {state.students.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="역할" value={student.role} />
            <SmallStat label="HP" value={`${student.currentHp}/${student.hp}`} />
            <SmallStat label="사기" value={student.morale} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            선호 태그 #{student.pref} · 약점 태그 #{student.weak} · 현재 식사 {student.meal ? recipeName(student.meal) : '없음'}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => battleAction(current, studentId))}>전투 진행</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => nextDayAction(current))}>다음 영업일</ActionButton>
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{inventoryRows.length}종</span>
          </div>
          {inventoryRows.length ? (
            <div className="game-save-list">
              {inventoryRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>재료</span>
                    <strong>{ingredientName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">보유 재료가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>준비된 메뉴</h2>
            <span>{tokenRows.length}종</span>
          </div>
          {tokenRows.length ? (
            <div className="game-save-list">
              {tokenRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>메뉴</span>
                    <strong>{recipeName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">준비된 메뉴가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시설</h2>
            <span>{facilities.length}종</span>
          </div>
          <div className="game-save-list">
            {facilities.map((facility) => (
              <article className="game-save-row" key={facility.id}>
                <div>
                  <span>{facility.effect} · Lv.{facility.level}/{facility.maxLevel}</span>
                  <strong>{facility.name}</strong>
                  <small>{facility.maxed ? '최대 레벨' : `다음 비용 ${facility.nextCost}G`}</small>
                </div>
                <button type="button" disabled={!canAct || facility.maxed || !facility.canUpgrade} onClick={() => setState((current) => upgradeFacilityAction(current, facility.id))}>업그레이드</button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>연구</h2>
            <span>조각 {Number(state.recipeShards || 0)}</span>
          </div>
          <div className="game-save-list">
            {researches.map((project) => (
              <article className="game-save-row" key={project.recipeId}>
                <div>
                  <span>{project.gold}G · 조각 {project.recipeShards}</span>
                  <strong>{project.name}</strong>
                  <small>{project.done ? '완료' : project.recipeName}</small>
                </div>
                <button type="button" disabled={!canAct || project.done || !project.canResearch} onClick={() => setState((current) => researchRecipeAction(current, project.recipeId))}>연구</button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>대회</h2>
            <span>{tournament.theme.name}</span>
          </div>
          <label className="game-save-json-field">
            <span>티어</span>
            <select value={tournamentTierId} onChange={(event) => setTournamentTierId(event.target.value)}>
              {TOURNAMENT_TIERS.map((tier) => <option value={tier.id} key={tier.id}>{tier.name} · {tier.entryGold}G</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{tournament.theme.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="예상 점수" value={tournament.total} />
            <SmallStat label="목표" value={tournament.tier.targetScore} />
            <SmallStat label="판정" value={tournament.win ? '우승권' : '부족'} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => enterTournamentAction(current, recipeId, tournamentTierId))}>선택 메뉴로 출전</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>심사위원</h2>
            <span>{judge.rank}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="심사" value={judge.judged} />
            <SmallStat label="정답" value={judge.correct} />
            <SmallStat label="정확도" value={`${judge.accuracy}%`} />
          </div>
          {judge.lastBatch ? (
            <p style={{ color: '#fbbf24', fontWeight: 900, lineHeight: 1.5 }}>
              최근 자동심사 {judge.lastBatch.correct}/{judge.lastBatch.count} 정답 ({judge.lastBatch.accuracy}%) · {JUDGE_BATCH_MODE_LABELS[judge.lastBatch.mode] || '자동'}
            </p>
          ) : (
            <p style={{ color: '#94a3b8', fontWeight: 800, lineHeight: 1.5 }}>셰프들의 제출작을 보고 승자를 맞히는 대회 전용 심사 모드입니다.</p>
          )}
          <div className="games-chip-row" style={{ margin: '8px 0 10px' }}>
            <label className="tonkatsu-judge-toggle">
              <input type="checkbox" checked={recentAutoOnly} onChange={(event) => setRecentAutoOnly(event.target.checked)} />
              <span>최근 자동심사만</span>
            </label>
            <label className="game-save-json-field" style={{ margin: 0, minWidth: 150 }}>
              <span>기록 필터</span>
              <select value={judgeHistoryMode} onChange={(event) => setJudgeHistoryMode(event.target.value)}>
                {Object.entries(JUDGE_HISTORY_MODE_LABELS).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}
              </select>
            </label>
          </div>
          {judgeRecent.total ? (
            <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
              <strong>최근 {recentAutoOnly ? '자동 ' : ''}{judgeRecent.total}판</strong>
              {' · '}
              정확도 {judgeRecent.accuracy}% ({judgeRecent.correct}/{judgeRecent.total})
              {' · '}
              수익 +{judgeRecent.rewardGold}G / +{judgeRecent.rewardShards}조각
              {' · '}
              최근 랭크 {judgeRecent.rank}
              {' · '}
              랜덤 {judgeRecent.modeCounts.random} · 강한쪽 {judgeRecent.modeCounts.strong} · 약한쪽 {judgeRecent.modeCounts.weak} · 수동 {judgeRecent.modeCounts.manual}
            </div>
          ) : null}
          <label className="game-save-json-field">
            <span>심사 티어</span>
            <select value={judgeTierId} onChange={(event) => setJudgeTierId(event.target.value)}>
              {TOURNAMENT_TIERS.map((tier) => <option value={tier.id} key={tier.id}>{tier.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split" style={{ marginTop: 10 }}>
            <label className="game-save-json-field">
              <span>자동 횟수</span>
              <select value={judgeBatchCount} onChange={(event) => setJudgeBatchCount(Number(event.target.value))}>
                {[5, 10, 20, 50].map((count) => <option value={count} key={count}>{count}회</option>)}
              </select>
            </label>
            <label className="game-save-json-field">
              <span>자동 방식</span>
              <select value={judgeBatchMode} onChange={(event) => setJudgeBatchMode(event.target.value)}>
                {Object.entries(JUDGE_BATCH_MODE_LABELS).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton disabled={!canAct} onClick={() => {
              setJudgePick('A');
              setJudgeText('');
              setState((current) => startJudgeMatchAction(current, judgeTierId));
            }}>새 심사 매치</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => runJudgeBatchAction(current, judgeTierId, judgeBatchCount, judgeBatchMode))}>자동 심사 실행</ActionButton>
            <ActionButton disabled={!canAct || (!judge.judged && !judgeMatch)} onClick={() => setState((current) => clearJudgeHistoryAction(current))}>심사 기록 초기화</ActionButton>
          </div>

          {judgeMatch ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div className="games-rank-split">
                <SmallStat label="테마" value={judgeMatch.themeName || judgeMatch.themeId} />
                <SmallStat label="티어" value={judgeMatch.tierName || judgeMatch.tierId} />
                <SmallStat label="결과" value={judgeMatch.resolved ? (judgeMatch.correct ? '정답' : '오답') : '판정 대기'} />
              </div>
              <article className="game-save-row">
                <div>
                  <span>A · {judgeMatch.aiAName}</span>
                  <strong>{judgeMatch.aiARecipeName || recipeName(judgeMatch.aiARecipeId)}</strong>
                  <small>{judgeMatch.aiAAppeal}</small>
                </div>
                <strong>{judgeMatch.resolved ? `${judgeMatch.aiATotal}점` : '비공개'}</strong>
              </article>
              <article className="game-save-row">
                <div>
                  <span>B · {judgeMatch.aiBName}</span>
                  <strong>{judgeMatch.aiBRecipeName || recipeName(judgeMatch.aiBRecipeId)}</strong>
                  <small>{judgeMatch.aiBAppeal}</small>
                </div>
                <strong>{judgeMatch.resolved ? `${judgeMatch.aiBTotal}점` : '비공개'}</strong>
              </article>
              <label className="game-save-json-field">
                <span>선택</span>
                <select value={judgePick} onChange={(event) => setJudgePick(event.target.value)}>
                  <option value="A">A 셰프</option>
                  <option value="B">B 셰프</option>
                </select>
              </label>
              <label className="game-save-json-field">
                <span>심사 메모</span>
                <input value={judgeText} onChange={(event) => setJudgeText(event.target.value)} placeholder="판정 근거를 적어두세요" />
              </label>
              <ActionButton disabled={!canAct || judgeMatch.resolved} onClick={() => setState((current) => submitJudgePickAction(current, judgePick, judgeText))}>판정 제출</ActionButton>
            </div>
          ) : (
            <div className="games-empty" style={{ marginTop: 14 }}>새 심사 매치를 준비하면 A/B 셰프의 제출작이 표시됩니다.</div>
          )}

          {judgeRecent.rows.length ? (
            <div className="game-save-list" style={{ marginTop: 14 }}>
              {judgeRecent.rows.map((entry, index) => (
                <article className="game-save-row" key={`${entry.id || entry.judgedAt}-${index}`}>
                  <div>
                    <span>{entry.themeName || entry.themeId} · {JUDGE_HISTORY_MODE_LABELS[entry.judgeMode] || '기록'} · {entry.judgePick} 선택</span>
                    <strong>{entry.correct ? '정답' : '오답'} · {entry.aiAName} vs {entry.aiBName}</strong>
                    <small>{entry.judgeText || '메모 없음'}</small>
                  </div>
                  <strong>{entry.aiATotal}:{entry.aiBTotal}</strong>
                </article>
              ))}
            </div>
          ) : judge.judged ? (
            <div className="games-empty" style={{ marginTop: 14 }}>현재 필터에 맞는 심사 기록이 없습니다.</div>
          ) : null}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로그</h2>
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
      </section>
              </>
            ),
          },
        ]}
      />
    </GamePlayShell>
  );
}
