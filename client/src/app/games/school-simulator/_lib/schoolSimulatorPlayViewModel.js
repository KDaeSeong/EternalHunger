import {
  CAREER_TRACKS,
  FESTIVAL_TYPES,
  POLICY_PRESETS,
  RECRUITMENT_STRATEGIES,
  SUBJECT_POLICY_MODES,
  SUBJECT_SHOWCASE_ACTIONS,
  TEACHER_ACTIONS,
  WEEK_SCHEDULE,
  WORK_ACTIONS,
  careerTrackRows,
  clubRows,
  festivalStatus,
  getAtRiskStudents,
  getAverages,
  getTopStudents,
  longTermReport,
  scoreState,
  semesterReport,
  scenarioProductionReportForState,
  subjectPolicyRows,
  subjectShowcaseRows,
  subjectShowcaseSummary,
  teacherRows,
  weeklyEventReport,
} from './schoolSimulatorEngine';
import { buildSchoolCareReport } from './schoolSimulatorCareReport';

export function buildSchoolSimulatorPlayViewModel({
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
}) {
  const averages = getAverages(state);
  const topStudents = getTopStudents(state, 'understanding', 5);
  const riskStudents = getAtRiskStudents(state);
  const subjectRows = subjectPolicyRows(state);
  const subjectShowcases = subjectShowcaseRows(state);
  const subjectShowcaseSummaryData = subjectShowcaseSummary(state);
  const clubs = clubRows(state);
  const teachers = teacherRows(state);
  const careerRows = careerTrackRows(state);
  const festival = festivalStatus(state);
  const events = weeklyEventReport(state);
  const report = semesterReport(state);
  const longTerm = longTermReport(state);
  const scenarioReport = scenarioProductionReportForState(state);
  const careReport = buildSchoolCareReport(state, teachers);
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

  return {
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
  };
}
