'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  POLICY_PRESETS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  WEEK_SCHEDULE,
  WORK_ACTIONS,
  applyPolicyPreset,
  applyWorkAction,
  createNewState,
  endWeekAction,
  getAtRiskStudents,
  getAverages,
  getPlayTimeSec,
  getTopStudents,
  normalizeState,
  restAction,
  scoreState,
  summaryForState,
} from '../_lib/schoolSimulatorEngine';

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

function ScoreBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="game-save-row">
      <div>
        <span>{label}</span>
        <strong>{safeValue}</strong>
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 110,
          height: 10,
          borderRadius: 999,
          background: '#d8e4ee',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${safeValue}%`,
            height: '100%',
            background: safeValue >= 70 ? '#247a50' : safeValue >= 45 ? '#2673a6' : '#bc4749',
          }}
        />
      </div>
    </div>
  );
}

export default function SchoolSimulatorPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [actionId, setActionId] = useState(WORK_ACTIONS[0].id);
  const [policyId, setPolicyId] = useState(POLICY_PRESETS[0].id);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const averages = useMemo(() => getAverages(state), [state]);
  const topStudents = useMemo(() => getTopStudents(state, 'understanding', 5), [state]);
  const riskStudents = useMemo(() => getAtRiskStudents(state), [state]);
  const score = scoreState(state);
  const selectedAction = WORK_ACTIONS.find((action) => action.id === actionId) || WORK_ACTIONS[0];
  const selectedPolicy = POLICY_PRESETS.find((policy) => policy.id === policyId) || POLICY_PRESETS[0];
  const weekInfo = WEEK_SCHEDULE[state.school.week] || { label: '학기 종료', examType: null };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setActionId(WORK_ACTIONS[0].id);
    setPolicyId(nextState.school.policyPreset);
    setMessage('');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 School Simulator 진행 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `School Y${state.school.year}-${state.school.semester} W${state.school.week}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('School Simulator 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'School Simulator 진행 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 School Simulator 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 School Simulator 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setPolicyId(nextState.school.policyPreset);
      setMessage('저장된 School Simulator 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 School Simulator 진행 상태를 불러왔습니다.' });
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
      setMessage('로그인하면 School Simulator 운영 기록을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `School Simulator - ${state.school.year}년 ${state.school.semester}학기 ${state.school.week}주`,
        mode: 'school-sim',
        result: 'term-report',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('School Simulator 운영 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'School Simulator 운영 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const applySelectedAction = () => {
    setState((current) => applyWorkAction(current, actionId));
  };

  const applySelectedPolicy = () => {
    setState((current) => applyPolicyPreset(current, policyId));
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 학교</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/games/school-simulator">상세</Link>
    </>
  );

  const metrics = [
    { label: '연도', value: `${state.school.year}년 ${state.school.semester}학기` },
    { label: '주차', value: `${state.school.week}주` },
    { label: '예산', value: state.school.budget.toLocaleString('ko-KR') },
    { label: 'AP', value: state.player.weeklyActionPoint },
    { label: '학생', value: state.students.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    state.school.budget < 0 ? { key: 'budget', tone: 'error', text: '예산이 적자입니다. 다음 주 운영 전에 지출을 줄이거나 입학/브랜드 정책을 조정해야 합니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="School Simulator"
      title="학교 운영 시뮬레이터"
      description="업로드된 School Simulator Step 23의 주간 운영, 정책 프리셋, 학생/교사/시설 지표, 시험과 학기 보고 흐름을 사이트용 플레이 slice로 이식했습니다."
      summaryLabel="School Simulator 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주간 운영</h2>
            <span>{weekInfo.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>운영 행동</span>
            <select value={actionId} onChange={(event) => setActionId(event.target.value)}>
              {WORK_ACTIONS.map((action) => (
                <option value={action.id} key={action.id}>
                  {action.label} / AP {action.apCost} / {action.budgetCost.toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedAction.description}</p>
          <div className="games-rank-split">
            <SmallStat label="필요 AP" value={selectedAction.apCost} />
            <SmallStat label="비용" value={selectedAction.budgetCost.toLocaleString('ko-KR')} />
            <SmallStat label="체력" value={state.player.energy} />
            <SmallStat label="멘탈" value={state.player.mental} />
          </div>
          <ActionButton onClick={applySelectedAction} disabled={state.player.weeklyActionPoint < selectedAction.apCost}>
            선택 행동 실행
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>정책 프리셋</h2>
            <span>{selectedPolicy.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>정책</span>
            <select value={policyId} onChange={(event) => setPolicyId(event.target.value)}>
              {POLICY_PRESETS.map((policy) => (
                <option value={policy.id} key={policy.id}>
                  {policy.label} / {policy.budgetCost.toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="현재 정책" value={POLICY_PRESETS.find((item) => item.id === state.school.policyPreset)?.label || state.school.policyPreset} />
            <SmallStat label="변경 비용" value={selectedPolicy.budgetCost.toLocaleString('ko-KR')} />
            <SmallStat label="지원자" value={state.school.admissions.applications} />
            <SmallStat label="경쟁률" value={`${state.school.admissions.competitionRate}:1`} />
          </div>
          <ActionButton onClick={applySelectedPolicy} disabled={state.player.weeklyActionPoint < 1 || state.school.policyPreset === policyId}>
            정책 적용
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주차 정산</h2>
            <span>{weekInfo.examType ? '시험 주간' : '일반 주간'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="스트레스" value={averages.stress} />
            <SmallStat label="만족도" value={averages.satisfaction} />
            <SmallStat label="교사 사기" value={averages.teacherMorale} />
            <SmallStat label="시설" value={averages.facilityCondition} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => endWeekAction(current))}>다음 주로 진행</ActionButton>
            <ActionButton onClick={() => setState((current) => restAction(current))} disabled={state.player.weeklyActionPoint < 2}>지친 운영진 휴식</ActionButton>
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학교 문화</h2>
            <span>위험 {state.school.riskLevel}</span>
          </div>
          <div className="game-save-list">
            <ScoreBar label="학업" value={state.school.culture.academic} />
            <ScoreBar label="복지" value={state.school.culture.welfare} />
            <ScoreBar label="자치" value={state.school.culture.autonomy} />
            <ScoreBar label="공동체" value={state.school.culture.community} />
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>평판</h2>
            <span>브랜드 {state.school.admissions.brandAwareness}</span>
          </div>
          <div className="game-save-list">
            <ScoreBar label="학업 평판" value={state.school.reputation.academic} />
            <ScoreBar label="안전 평판" value={state.school.reputation.safety} />
            <ScoreBar label="복지 평판" value={state.school.reputation.wellbeing} />
            <ScoreBar label="재정 평판" value={state.school.reputation.finance} />
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>평균 지표</h2>
            <span>{state.students.length}명</span>
          </div>
          <div className="game-save-list">
            <ScoreBar label="성실도" value={averages.diligence} />
            <ScoreBar label="이해도" value={averages.understanding} />
            <ScoreBar label="건강" value={averages.health} />
            <ScoreBar label="진로 준비" value={Math.round((averages.understanding + averages.autonomy) / 2)} />
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>상위 학생</h2>
            <span>이해도 기준</span>
          </div>
          <div className="game-save-list">
            {topStudents.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>{student.grade}학년 {student.classNo}반</span>
                  <strong>{student.name}</strong>
                </div>
                <strong>{student.understanding}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>위기 학생</h2>
            <span>{riskStudents.length}명</span>
          </div>
          <div className="game-save-list">
            {riskStudents.length ? riskStudents.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>스트레스 {student.stress} / 건강 {student.health}</span>
                  <strong>{student.name}</strong>
                </div>
                <strong>{student.satisfaction}</strong>
              </article>
            )) : <div className="games-empty">현재 즉시 개입이 필요한 학생은 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>교사와 시설</h2>
            <span>{state.teachers.length}명 / {state.facilities.length}곳</span>
          </div>
          <div className="game-save-list">
            {state.teachers.slice(0, 4).map((teacher) => (
              <article className="game-save-row" key={teacher.id}>
                <div>
                  <span>{teacher.subject} / 피로 {teacher.fatigue}</span>
                  <strong>{teacher.name}</strong>
                </div>
                <strong>{teacher.teachingSkill}</strong>
              </article>
            ))}
            {state.facilities.slice(0, 3).map((facility) => (
              <article className="game-save-row" key={facility.id}>
                <div>
                  <span>{facility.type} / 수용 {facility.capacity}</span>
                  <strong>{facility.name}</strong>
                </div>
                <strong>{facility.condition}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>최근 시험</h2>
            <span>{state.recentExamResults.length}건</span>
          </div>
          <div className="game-save-list">
            {state.recentExamResults.length ? state.recentExamResults.slice(0, 6).map((row) => (
              <article className="game-save-row" key={row.studentId}>
                <div>
                  <span>시험 점수</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{row.score}</strong>
              </article>
            )) : <div className="games-empty">아직 시험 결과가 없습니다. 3주차, 5주차, 6주차, 9주차, 11주차, 12주차에 시험이 진행됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학기 보고서</h2>
            <span>{state.semesterHistory.length}개</span>
          </div>
          <div className="game-save-list">
            {state.semesterHistory.length ? state.semesterHistory.slice(0, 5).map((report, index) => (
              <article className="game-save-row" key={`${report.year}-${report.semester}-${index}`}>
                <div>
                  <span>{report.year}년 {report.semester}학기</span>
                  <strong>학업 {report.academic} / 복지 {report.wellbeing}</strong>
                </div>
                <strong>{report.score}</strong>
              </article>
            )) : <div className="games-empty">12주차를 넘기면 학기 보고서가 생성됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 10).map((line, index) => (
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
