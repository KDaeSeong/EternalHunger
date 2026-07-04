'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
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

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function MiniRow({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
  const tokenCount = Number(state.mealTokens[recipe.id] || 0);
  const winRatePreview = Math.round(Math.max(12, Math.min(92, 35 + (((student.atk * 8 + student.def * 5 + student.morale + (recipe.power || 0)) - (116 + state.floor * 18)) / 160) * 100)));
  const inventoryRows = Object.entries(state.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => ingredientName(a).localeCompare(ingredientName(b), 'ko-KR'));
  const tokenRows = Object.entries(state.mealTokens)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => recipeName(a).localeCompare(recipeName(b), 'ko-KR'));

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
      <Link href="/games/tonkatsu-teacher">상세</Link>
    </>
  );

  const metrics = [
    { label: 'Day', value: state.day },
    { label: 'Gold', value: `${Number(state.gold || 0).toLocaleString('ko-KR')}G` },
    { label: '평판', value: state.reputation },
    { label: '전투층', value: state.floor },
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

  return (
    <GamePlayShell
      kicker="Tonkatsu Teacher"
      title="돈카츠 선생"
      description="재료를 사고 메뉴를 만들어 판매하거나 학생에게 배식한 뒤 전투 보상으로 다시 가게를 키우는 경영 루프 slice입니다."
      summaryLabel="돈카츠 선생 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
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
            <MiniRow label="보유" value={tokenCount} />
            <MiniRow label="판매가" value={`${recipe.sellPrice}G`} />
            <MiniRow label="전투 보정" value={recipe.power} />
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
            <MiniRow label="보관 한도" value={`${inventoryCount(state)}/${facilityContext.storageCap}`} />
            <MiniRow label="주문량" value={facilityContext.dailyOrders} />
            <MiniRow label="영업 배율" value={`x${facilityContext.goldMultFromOrders.toFixed(2)}`} />
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
            <MiniRow label="역할" value={student.role} />
            <MiniRow label="HP" value={`${student.currentHp}/${student.hp}`} />
            <MiniRow label="사기" value={student.morale} />
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
            <MiniRow label="예상 점수" value={tournament.total} />
            <MiniRow label="목표" value={tournament.tier.targetScore} />
            <MiniRow label="판정" value={tournament.win ? '우승권' : '부족'} />
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
            <MiniRow label="심사" value={judge.judged} />
            <MiniRow label="정답" value={judge.correct} />
            <MiniRow label="정확도" value={`${judge.accuracy}%`} />
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
                <MiniRow label="테마" value={judgeMatch.themeName || judgeMatch.themeId} />
                <MiniRow label="티어" value={judgeMatch.tierName || judgeMatch.tierId} />
                <MiniRow label="결과" value={judgeMatch.resolved ? (judgeMatch.correct ? '정답' : '오답') : '판정 대기'} />
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
    </GamePlayShell>
  );
}
