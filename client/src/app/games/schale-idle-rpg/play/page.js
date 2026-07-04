'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  STUDENTS,
  attemptTowerAction,
  availableEnhanceSlots,
  claimMissionRewardsAction,
  craftRecipeAction,
  createNewState,
  enhanceEquipmentAction,
  getEquippedList,
  getLeader,
  getPlayTimeSec,
  inventoryRows,
  itemName,
  missionRows,
  normalizeState,
  resolveDutyAction,
  restAction,
  scoreState,
  slotLabel,
  summaryForState,
  teamPower,
} from '../_lib/schaleIdleEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function SchaleIdlePlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [enhanceSlot, setEnhanceSlot] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const equipped = useMemo(() => getEquippedList(state), [state]);
  const enhanceSlots = useMemo(() => availableEnhanceSlots(state), [state]);
  const rows = useMemo(() => inventoryRows(state), [state]);
  const missions = useMemo(() => missionRows(state), [state]);
  const leader = getLeader(state);
  const selectedRecipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const selectedSlot = enhanceSlot || enhanceSlots[0] || '';
  const power = teamPower(state);
  const score = scoreState(state);

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Schale Idle RPG 진행 상태를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Schale Idle F${state.maxClearedFloor} T${state.towerMaxCleared}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
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
      setState(normalizeState(detail?.save?.payload?.state));
      setMessage('저장된 Schale Idle RPG 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Schale Idle RPG 진행 상태를 불러왔습니다.' });
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
    setMessage('');
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 당직</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/games/schale-idle-rpg">상세</Link>
    </>
  );

  const metrics = [
    { label: '최고 층', value: state.maxClearedFloor },
    { label: '현재 층', value: state.floor },
    { label: '탑', value: `${state.towerMaxCleared}층` },
    { label: '전투력', value: power.toLocaleString('ko-KR') },
    { label: '크레딧', value: `${Number(state.credits || 0).toLocaleString('ko-KR')} Cr` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 진행은 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Schale Idle RPG"
      title="샬레 당직 RPG"
      description="업로드된 Schale Idle RPG v1.34의 방치 정산, 장비 제작, 강화, 시련의 탑, 미션 보상 루프를 사이트용 playable slice로 이식했습니다."
      summaryLabel="Schale Idle RPG 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>방치 정산</h2>
            <span>{leader.name}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="스태미나" value={`${state.stamina}/100`} />
            <SmallStat label="보스 처치" value={state.counters.KILL_BOSS} />
            <SmallStat label="누적 클리어" value={state.counters.CLEAR_FLOOR} />
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
            <span>열쇠 {Number(state.inventory.itm_tower_key || 0)}</span>
          </div>
          <label className="game-save-json-field">
            <span>강화 슬롯</span>
            <select value={selectedSlot} onChange={(event) => setEnhanceSlot(event.target.value)} disabled={!enhanceSlots.length}>
              {enhanceSlots.length ? enhanceSlots.map((slot) => <option value={slot} key={slot}>{slotLabel(slot)}</option>) : <option value="">장비 없음</option>}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedSlot} onClick={() => setState((current) => enhanceEquipmentAction(current, selectedSlot))}>선택 장비 강화</ActionButton>
            <ActionButton onClick={() => setState((current) => attemptTowerAction(current, 1))}>탑 1회 도전</ActionButton>
            <ActionButton onClick={() => setState((current) => attemptTowerAction(current, 5))}>탑 5회 도전</ActionButton>
          </div>
        </section>
      </section>

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
                  </div>
                  <strong>+{equip.enhance || 0}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">장착 중인 장비가 없습니다. 제작으로 장비를 확보하세요.</div>}
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
    </GamePlayShell>
  );
}
