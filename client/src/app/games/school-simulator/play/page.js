'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  CAREER_TRACKS,
  FESTIVAL_TYPES,
  POLICY_PRESETS,
  QUICK_SAVE_SLOT,
  RECRUITMENT_STRATEGIES,
  SAVE_VERSION,
  SUBJECT_POLICY_MODES,
  SUBJECT_SHOWCASE_ACTIONS,
  SUBJECTS,
  TEACHER_ACTIONS,
  WEEK_SCHEDULE,
  WORK_ACTIONS,
  applyPolicyPreset,
  applyTeacherAction,
  applyWorkAction,
  careerTrackRows,
  clubRows,
  createNewState,
  festivalStatus,
  getAtRiskStudents,
  getAverages,
  getPlayTimeSec,
  getTopStudents,
  longTermReport,
  normalizeState,
  runCareerCounselingAction,
  scoreState,
  semesterReport,
  scenarioProductionReportForState,
  subjectPolicyRows,
  subjectShowcaseRows,
  subjectShowcaseSummary,
  summaryForState,
  teacherRows,
  weeklyEventReport,
} from '../_lib/schoolSimulatorEngine';
import { actionFeedbackText } from '../_lib/schoolSimulatorPlayHelpers';
import { buildSchoolCareReport } from '../_lib/schoolSimulatorCareReport';
import SchoolSimulatorFeatureTabs from '../_components/SchoolSimulatorFeatureTabs';
export default function SchoolSimulatorPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [actionId, setActionId] = useState(WORK_ACTIONS[0].id);
  const [policyId, setPolicyId] = useState(POLICY_PRESETS[0].id);
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [subjectModeId, setSubjectModeId] = useState(SUBJECT_POLICY_MODES[0].id);
  const [subjectShowcaseActionId, setSubjectShowcaseActionId] = useState(SUBJECT_SHOWCASE_ACTIONS[0].id);
  const [recruitmentStrategyId, setRecruitmentStrategyId] = useState(RECRUITMENT_STRATEGIES[0].id);
  const [careerTrackId, setCareerTrackId] = useState(CAREER_TRACKS[0].id);
  const [clubId, setClubId] = useState('club_research');
  const [festivalId, setFestivalId] = useState(FESTIVAL_TYPES[0].id);
  const [teacherId, setTeacherId] = useState('t_hina');
  const [teacherActionId, setTeacherActionId] = useState(TEACHER_ACTIONS[0].id);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [actionResult, setActionResult] = useState('');

  const averages = useMemo(() => getAverages(state), [state]);
  const topStudents = useMemo(() => getTopStudents(state, 'understanding', 5), [state]);
  const riskStudents = useMemo(() => getAtRiskStudents(state), [state]);
  const subjectRows = useMemo(() => subjectPolicyRows(state), [state]);
  const subjectShowcases = useMemo(() => subjectShowcaseRows(state), [state]);
  const subjectShowcaseSummaryData = useMemo(() => subjectShowcaseSummary(state), [state]);
  const clubs = useMemo(() => clubRows(state), [state]);
  const teachers = useMemo(() => teacherRows(state), [state]);
  const careerRows = useMemo(() => careerTrackRows(state), [state]);
  const festival = useMemo(() => festivalStatus(state), [state]);
  const events = useMemo(() => weeklyEventReport(state), [state]);
  const report = useMemo(() => semesterReport(state), [state]);
  const longTerm = useMemo(() => longTermReport(state), [state]);
  const scenarioReport = useMemo(() => scenarioProductionReportForState(state), [state]);
  const careReport = useMemo(() => buildSchoolCareReport(state, teachers), [state, teachers]);
  const score = scoreState(state);
  const selectedAction = WORK_ACTIONS.find((action) => action.id === actionId) || WORK_ACTIONS[0];
  const selectedPolicy = POLICY_PRESETS.find((policy) => policy.id === policyId) || POLICY_PRESETS[0];
  const selectedSubject = subjectRows.find((subject) => subject.id === subjectId) || subjectRows[0];
  const selectedSubjectMode = SUBJECT_POLICY_MODES.find((mode) => mode.id === subjectModeId) || SUBJECT_POLICY_MODES[0];
  const selectedSubjectShowcase = subjectShowcases.find((subject) => subject.id === subjectId) || subjectShowcases[0];
  const selectedSubjectShowcaseAction = SUBJECT_SHOWCASE_ACTIONS.find((action) => action.id === subjectShowcaseActionId) || SUBJECT_SHOWCASE_ACTIONS[0];
  const selectedSubjectShowcaseActive = Number(selectedSubjectShowcase?.[selectedSubjectShowcaseAction.field] || 0) > 0;
  const selectedSubjectShowcaseTargets = selectedSubjectShowcaseAction.id === 'publicLesson'
    ? selectedSubjectShowcase?.publicTargets || 0
    : selectedSubjectShowcaseAction.id === 'achievementPresentation'
      ? selectedSubjectShowcase?.presentationTargets || 0
      : selectedSubjectShowcase?.weekTargets || 0;
  const selectedRecruitment = RECRUITMENT_STRATEGIES.find((strategy) => strategy.id === recruitmentStrategyId) || RECRUITMENT_STRATEGIES[0];
  const selectedCareer = CAREER_TRACKS.find((track) => track.id === careerTrackId) || CAREER_TRACKS[0];
  const selectedClub = clubs.find((club) => club.id === clubId) || clubs[0];
  const selectedFestival = FESTIVAL_TYPES.find((item) => item.id === festivalId) || FESTIVAL_TYPES[0];
  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId) || teachers[0];
  const selectedTeacherAction = TEACHER_ACTIONS.find((item) => item.id === teacherActionId) || TEACHER_ACTIONS[0];
  const weekInfo = WEEK_SCHEDULE[state.school.week] || { label: '학기 종료', examType: null };
  const primaryRisk = report.risks.find((risk) => risk.level !== 'good') || report.risks[0] || null;
  const recommendedActionId = primaryRisk?.title?.includes('학생') || primaryRisk?.title?.includes('컨디션')
    ? 'boostCounseling'
    : primaryRisk?.title?.includes('교사')
      ? 'teacherWorkshop'
      : primaryRisk?.title?.includes('시설') || primaryRisk?.title?.includes('안전')
        ? 'facilityMaintenance'
        : primaryRisk?.title?.includes('교과')
          ? 'libraryProgram'
          : primaryRisk?.title?.includes('모집')
            ? 'openClass'
            : primaryRisk?.title?.includes('예산')
              ? 'studentCouncilMeeting'
              : selectedAction.id;
  const recommendedAction = WORK_ACTIONS.find((action) => action.id === recommendedActionId) || selectedAction;
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 운영 액션이 없습니다.';

  const applySchoolAction = (label, updater, fallback = '') => {
    const nextState = updater(state);
    setState(nextState);
    setActionResult(actionFeedbackText(state, nextState, label, fallback));
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setActionId(WORK_ACTIONS[0].id);
    setPolicyId(nextState.school.policyPreset);
    setSubjectId(SUBJECTS[0].id);
    setSubjectModeId(SUBJECT_POLICY_MODES[0].id);
    setSubjectShowcaseActionId(SUBJECT_SHOWCASE_ACTIONS[0].id);
    setRecruitmentStrategyId(RECRUITMENT_STRATEGIES[0].id);
    setCareerTrackId(CAREER_TRACKS[0].id);
    setClubId('club_research');
    setFestivalId(FESTIVAL_TYPES[0].id);
    setMessage('');
    setActionResult('새 학교 운영을 시작했습니다.');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 School Simulator 진행 상태를 저장할 수 있습니다.');
      setActionResult('로그인하면 School Simulator 진행 상태를 저장할 수 있습니다.');
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
      setActionResult(`School Simulator 진행 상태를 저장했습니다. ${state.school.year}년 ${state.school.semester}학기 ${state.school.week}주차.`);
      showToast({ tone: 'success', message: 'School Simulator 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 School Simulator 진행 상태를 불러올 수 있습니다.');
      setActionResult('로그인하면 저장된 School Simulator 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 School Simulator 진행 상태가 없습니다.');
        setActionResult('저장된 School Simulator 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setPolicyId(nextState.school.policyPreset);
      setMessage('저장된 School Simulator 진행 상태를 불러왔습니다.');
      setActionResult(actionFeedbackText(state, nextState, '불러오기', '저장된 School Simulator 진행 상태를 불러왔습니다.'));
      showToast({ tone: 'success', message: '저장된 School Simulator 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 School Simulator 운영 기록을 전적에 남길 수 있습니다.');
      setActionResult('로그인하면 School Simulator 운영 기록을 전적에 남길 수 있습니다.');
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
      setActionResult(`School Simulator 운영 기록을 전적에 남겼습니다. 점수 ${score.toLocaleString('ko-KR')}.`);
      showToast({ tone: 'success', message: 'School Simulator 운영 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const applySelectedAction = () => {
    applySchoolAction(selectedAction.label, (current) => applyWorkAction(current, actionId));
  };

  const applySelectedPolicy = () => {
    applySchoolAction('정책 적용', (current) => applyPolicyPreset(current, policyId));
  };

  const careCommandDisabled = (command) => {
    if (!command?.type) return true;
    if (command.type === 'work') {
      const action = WORK_ACTIONS.find((item) => item.id === command.actionId);
      return !action || state.player.weeklyActionPoint < action.apCost || state.school.budget < action.budgetCost;
    }
    if (command.type === 'teacher') {
      const action = TEACHER_ACTIONS.find((item) => item.id === command.actionId);
      return !action || state.player.weeklyActionPoint < action.apCost || state.school.budget < action.budgetCost;
    }
    if (command.type === 'career') return state.player.weeklyActionPoint < 2 || state.school.budget < 180;
    return true;
  };

  const runCareCommand = (command) => {
    if (!command?.type) return;
    if (command.type === 'work') {
      setActionId(command.actionId);
      applySchoolAction(command.label, (current) => applyWorkAction(current, command.actionId));
      return;
    }
    if (command.type === 'career') {
      setCareerTrackId(command.trackId);
      applySchoolAction(command.label, (current) => runCareerCounselingAction(current, command.trackId));
      return;
    }
    if (command.type === 'teacher') {
      setTeacherId(command.teacherId);
      setTeacherActionId(command.actionId);
      applySchoolAction(command.label, (current) => applyTeacherAction(current, command.teacherId, command.actionId));
    }
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 학교</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/school-simulator">상세</Link>
    </>
  );

  const metrics = [
    { label: '연도', value: `${state.school.year}년 ${state.school.semester}학기` },
    { label: '주차', value: `${state.school.week}주` },
    { label: '예산', value: state.school.budget.toLocaleString('ko-KR') },
    { label: 'AP', value: state.player.weeklyActionPoint },
    { label: '학생', value: state.students.length },
    { label: '과목', value: Math.round(subjectRows.reduce((sum, row) => sum + Number(row.averageScore || 0), 0) / Math.max(1, subjectRows.length)) },
    { label: '진로', value: Math.round(state.students.reduce((sum, student) => sum + Number(student.careerReadiness || 0), 0) / Math.max(1, state.students.length)) },
    { label: '사건', value: events.pending ? '대응' : events.history.length },
    { label: '시나리오', value: `${scenarioReport.sceneScore}%` },
    { label: '튜토리얼', value: `${report.tutorialPct}%` },
    { label: '밸런스', value: `${report.balanceScore}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    state.school.budget < 0 ? { key: 'budget', tone: 'error', text: '예산이 적자입니다. 다음 주 운영 전에 지출을 줄이거나 입학/브랜드 정책을 조정해야 합니다.' } : null,
  ];

  const guide = {
    title: '학교 운영 코치',
    badge: weekInfo.label,
    primaryTitle: primaryRisk?.title || '이번 주 운영 안정',
    primaryText: primaryRisk?.detail || '학생, 교사, 시설 지표를 확인하고 주차를 진행하세요.',
    focusRows: [
      { label: '평균 이해', value: averages.understanding },
      { label: '위험 학생', value: `${riskStudents.length}명` },
      { label: '주간 사건', value: `${events.count}건` },
      { label: '추천 행동', value: selectedAction?.label || recommendedActionId },
    ],
    adviceLines: report.risks.slice(0, 4).map((risk) => ({
      kind: risk.level === 'good' ? '안정' : risk.level === 'warn' ? '주의' : '개입',
      title: risk.title,
      detail: risk.detail,
    })),
  };

  return (
    <GamePlayShell
      kicker="School Simulator"
      title="학교 운영 시뮬레이터"
      description="업로드된 School Simulator Step 23의 주간 운영, 장기 학교 비전, 정책 프리셋, 학생/교사/시설 지표, 시험과 학기 보고 흐름을 사이트용 플레이로 이식했습니다."
      summaryLabel="School Simulator 요약"
      summaryDensity="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />

      <SchoolSimulatorFeatureTabs
        actionId={actionId}
        applySchoolAction={applySchoolAction}
        applySelectedAction={applySelectedAction}
        applySelectedPolicy={applySelectedPolicy}
        averages={averages}
        careCommandDisabled={careCommandDisabled}
        careReport={careReport}
        careerRows={careerRows}
        careerTrackId={careerTrackId}
        clubId={clubId}
        clubs={clubs}
        events={events}
        festival={festival}
        festivalId={festivalId}
        longTerm={longTerm}
        policyId={policyId}
        primaryRisk={primaryRisk}
        recentActionText={recentActionText}
        recommendedAction={recommendedAction}
        recruitmentStrategyId={recruitmentStrategyId}
        report={report}
        riskStudents={riskStudents}
        runCareCommand={runCareCommand}
        scenarioReport={scenarioReport}
        selectedAction={selectedAction}
        selectedCareer={selectedCareer}
        selectedClub={selectedClub}
        selectedFestival={selectedFestival}
        selectedPolicy={selectedPolicy}
        selectedRecruitment={selectedRecruitment}
        selectedSubject={selectedSubject}
        selectedSubjectMode={selectedSubjectMode}
        selectedSubjectShowcase={selectedSubjectShowcase}
        selectedSubjectShowcaseAction={selectedSubjectShowcaseAction}
        selectedSubjectShowcaseActive={selectedSubjectShowcaseActive}
        selectedSubjectShowcaseTargets={selectedSubjectShowcaseTargets}
        selectedTeacher={selectedTeacher}
        selectedTeacherAction={selectedTeacherAction}
        setActionId={setActionId}
        setCareerTrackId={setCareerTrackId}
        setClubId={setClubId}
        setFestivalId={setFestivalId}
        setPolicyId={setPolicyId}
        setRecruitmentStrategyId={setRecruitmentStrategyId}
        setSubjectId={setSubjectId}
        setSubjectModeId={setSubjectModeId}
        setSubjectShowcaseActionId={setSubjectShowcaseActionId}
        setTeacherActionId={setTeacherActionId}
        setTeacherId={setTeacherId}
        state={state}
        subjectId={subjectId}
        subjectModeId={subjectModeId}
        subjectShowcaseActionId={subjectShowcaseActionId}
        subjectRows={subjectRows}
        subjectShowcaseSummaryData={subjectShowcaseSummaryData}
        subjectShowcases={subjectShowcases}
        teacherActionId={teacherActionId}
        teacherId={teacherId}
        teachers={teachers}
        topStudents={topStudents}
        weekInfo={weekInfo}
      />
    </GamePlayShell>
  );
}
