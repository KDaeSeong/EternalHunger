'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameActionIcon from '../../_components/GameActionIcon';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import {
  TEACHER_ACTIONS,
  WORK_ACTIONS,
  applyPolicyPreset,
  applyTeacherAction,
  applyWorkAction,
  createNewState,
  runCareerCounselingAction,
} from '../_lib/schoolSimulatorEngine';
import { actionFeedbackText } from '../_lib/schoolSimulatorPlayHelpers';
import {
  schoolActionCue,
  schoolActionPresentation,
  schoolResultPresentation,
} from '../_lib/schoolSimulatorFeedback';
import { buildSchoolSimulatorPlayViewModel } from '../_lib/schoolSimulatorPlayViewModel';
import useSchoolSimulatorPersistence from '../_hooks/useSchoolSimulatorPersistence';
import useSchoolSimulatorSelections from '../_hooks/useSchoolSimulatorSelections';
import SchoolSimulatorFeatureTabs from '../_components/SchoolSimulatorFeatureTabs';
export default function SchoolSimulatorPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'school' });
  const [state, setState] = useState(() => createNewState());
  const [actionResult, setActionResult] = useState('');
  const [actionPresentation, setActionPresentation] = useState({
    action: '',
    cue: '',
    key: 'idle',
    label: '운영 결과',
    tone: '',
  });
  const {
    actionId,
    careerTrackId,
    clubId,
    festivalId,
    policyId,
    recruitmentStrategyId,
    resetForLoadedRun,
    resetForNewRun,
    setActionId,
    setCareerTrackId,
    setClubId,
    setFestivalId,
    setPolicyId,
    setRecruitmentStrategyId,
    setSubjectId,
    setSubjectModeId,
    setSubjectShowcaseActionId,
    setTeacherActionId,
    setTeacherId,
    subjectId,
    subjectModeId,
    subjectShowcaseActionId,
    teacherActionId,
    teacherId,
  } = useSchoolSimulatorSelections();

  const viewModel = useMemo(() => buildSchoolSimulatorPlayViewModel({
    actionId,
    actionResult,
    careerTrackId,
    clubId,
    festivalId,
    policyId,
    recruitmentStrategyId,
    state,
    subjectId,
    subjectModeId,
    subjectShowcaseActionId,
    teacherActionId,
    teacherId,
  }), [
    actionId,
    actionResult,
    careerTrackId,
    clubId,
    festivalId,
    policyId,
    recruitmentStrategyId,
    state,
    subjectId,
    subjectModeId,
    subjectShowcaseActionId,
    teacherActionId,
    teacherId,
  ]);

  const {
    averages,
    careReport,
    careerRows,
    clubs,
    events,
    festival,
    longTerm,
    primaryRisk,
    recentActionText,
    recommendedAction,
    recommendedActionId,
    report,
    riskStudents,
    scenarioReport,
    score,
    selectedAction,
    selectedCareer,
    selectedClub,
    selectedFestival,
    selectedPolicy,
    selectedRecruitment,
    selectedSubject,
    selectedSubjectMode,
    selectedSubjectShowcase,
    selectedSubjectShowcaseAction,
    selectedSubjectShowcaseActive,
    selectedSubjectShowcaseTargets,
    selectedTeacher,
    selectedTeacherAction,
    subjectRows,
    subjectShowcaseSummaryData,
    subjectShowcases,
    teachers,
    topStudents,
    weekInfo,
  } = viewModel;

  const {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  } = useSchoolSimulatorPersistence({
    onLoaded: resetForLoadedRun,
    score,
    setActionResult,
    setState,
    showToast,
    state,
    token,
  });

  const applySchoolAction = (label, updater, fallback = '') => {
    const nextState = updater(state);
    setState(nextState);
    setActionResult(actionFeedbackText(state, nextState, label, fallback));
    setActionPresentation(schoolActionPresentation(state, nextState));
    const cue = schoolActionCue(state, nextState);
    if (cue) playGameSfx(cue);
  };

  const startNewRun = () => {
    const nextState = createNewState();
    const presentation = schoolActionPresentation(state, nextState);
    setState(nextState);
    resetForNewRun(nextState);
    setMessage('');
    setActionResult('새 학교 운영을 시작했습니다.');
    setActionPresentation(presentation);
    if (presentation.cue) playGameSfx(presentation.cue);
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
      <GameControlButton action="new" cue="off" onClick={startNewRun}>새 학교</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link href="/myanime/school-simulator" data-game-sfx="select"><GameActionIcon action="settings" label="상세" />상세</Link>
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

  const resultPresentation = schoolResultPresentation(recentActionText, actionPresentation);

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
      summaryDensity="micro"
      primaryMetricLimit={12}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact storageKey="school-simulator-operations-coach" />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={recentActionText}
        tone={resultPresentation.tone}
        pinned
      />

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
        resultPresentation={resultPresentation}
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
