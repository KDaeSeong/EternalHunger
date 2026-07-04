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
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  averageStudents,
  battleAction,
  buyIngredientAction,
  craftRecipeAction,
  createNewState,
  feedStudentAction,
  formatNeeds,
  getPlayTimeSec,
  getStudent,
  ingredientName,
  inventoryCount,
  mealTokenCount,
  nextDayAction,
  normalizeState,
  recipeName,
  scoreState,
  sellRecipeAction,
  summaryForState,
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
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId) || INGREDIENTS[0];
  const student = getStudent(state, studentId);
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
              {RECIPES.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            필요: {formatNeeds(recipe.needs)}
          </p>
          <p style={{ color: '#94a3b8', fontWeight: 800, lineHeight: 1.5 }}>{recipe.note}</p>
          <div className="games-rank-split">
            <MiniRow label="보유" value={tokenCount} />
            <MiniRow label="판매가" value={`${recipe.sellPrice}G`} />
            <MiniRow label="전투 보정" value={recipe.power} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!canAct} onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>메뉴 제작</ActionButton>
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
