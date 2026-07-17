export const SCHOOL_SIMULATOR_BGM_SCENES = Object.freeze({
  morning: 'school-morning',
  classroom: 'school-classroom',
  counseling: 'school-counseling-room',
  campus: 'school-campus',
  festival: 'school-festival',
  incident: 'school-incident-alert',
  semester: 'school-semester-finale',
  afterschool: 'school-afterschool',
});

export const SCHOOL_SIMULATOR_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'morning', theme: SCHOOL_SIMULATOR_BGM_SCENES.morning, title: '아침 조회', icon: 'school-new' }),
  Object.freeze({ scene: 'classroom', theme: SCHOOL_SIMULATOR_BGM_SCENES.classroom, title: '교실의 리듬', icon: 'school-lesson' }),
  Object.freeze({ scene: 'counseling', theme: SCHOOL_SIMULATOR_BGM_SCENES.counseling, title: '상담실의 오후', icon: 'school-counseling' }),
  Object.freeze({ scene: 'campus', theme: SCHOOL_SIMULATOR_BGM_SCENES.campus, title: '캠퍼스 산책', icon: 'school-operation' }),
  Object.freeze({ scene: 'festival', theme: SCHOOL_SIMULATOR_BGM_SCENES.festival, title: '축제 준비', icon: 'school-festival-start' }),
  Object.freeze({ scene: 'incident', theme: SCHOOL_SIMULATOR_BGM_SCENES.incident, title: '비상 방송', icon: 'school-incident' }),
  Object.freeze({ scene: 'semester', theme: SCHOOL_SIMULATOR_BGM_SCENES.semester, title: '학기의 끝', icon: 'school-semester' }),
  Object.freeze({ scene: 'afterschool', theme: SCHOOL_SIMULATOR_BGM_SCENES.afterschool, title: '방과 후 기록', icon: 'archive' }),
]);

const TAB_SCENES = Object.freeze({
  operations: SCHOOL_SIMULATOR_BGM_SCENES.morning,
  tutorial: SCHOOL_SIMULATOR_BGM_SCENES.morning,
  scenario: SCHOOL_SIMULATOR_BGM_SCENES.campus,
  events: SCHOOL_SIMULATOR_BGM_SCENES.campus,
  class: SCHOOL_SIMULATOR_BGM_SCENES.classroom,
  students: SCHOOL_SIMULATOR_BGM_SCENES.counseling,
  staff: SCHOOL_SIMULATOR_BGM_SCENES.campus,
  clubs: SCHOOL_SIMULATOR_BGM_SCENES.campus,
  advanced: SCHOOL_SIMULATOR_BGM_SCENES.afterschool,
});

const MORNING_RESULTS = new Set(['newRun', 'week', 'policy', 'action', 'maintenance', 'teacher', 'admission', 'vision']);
const CLASSROOM_RESULTS = new Set(['lesson']);
const COUNSELING_RESULTS = new Set(['counseling', 'career', 'recovery', 'rest']);
const FESTIVAL_RESULTS = new Set(['club', 'festivalStart', 'festivalComplete']);
const INCIDENT_RESULTS = new Set(['incident', 'crisis', 'blocked']);

export function resolveSchoolSimulatorBgmScene({
  activeTabId = 'operations',
  budget = 0,
  burnoutRisk = 0,
  festivalActive = false,
  pendingEvent = false,
  riskLevel = 0,
  riskStudentCount = 0,
} = {}) {
  const crisis = Number(budget || 0) < 0
    || Number(burnoutRisk || 0) >= 65
    || Number(riskLevel || 0) >= 60
    || Number(riskStudentCount || 0) >= 4;
  if (crisis || pendingEvent) return SCHOOL_SIMULATOR_BGM_SCENES.incident;
  if (festivalActive || activeTabId === 'clubs') return SCHOOL_SIMULATOR_BGM_SCENES.festival;
  return TAB_SCENES[activeTabId] || SCHOOL_SIMULATOR_BGM_SCENES.morning;
}

export function schoolSimulatorResultMusic(presentation = {}) {
  const key = String(presentation?.key || '');
  if (key === 'semester') return { theme: SCHOOL_SIMULATOR_BGM_SCENES.semester, durationMs: 18_000 };
  if (INCIDENT_RESULTS.has(key)) return { theme: SCHOOL_SIMULATOR_BGM_SCENES.incident, durationMs: key === 'crisis' ? 15_000 : 12_000 };
  if (FESTIVAL_RESULTS.has(key)) return { theme: SCHOOL_SIMULATOR_BGM_SCENES.festival, durationMs: key === 'festivalComplete' ? 14_000 : 10_000 };
  if (COUNSELING_RESULTS.has(key)) return { theme: SCHOOL_SIMULATOR_BGM_SCENES.counseling, durationMs: 9_000 };
  if (CLASSROOM_RESULTS.has(key)) return { theme: SCHOOL_SIMULATOR_BGM_SCENES.classroom, durationMs: 9_000 };
  if (MORNING_RESULTS.has(key)) return { theme: SCHOOL_SIMULATOR_BGM_SCENES.morning, durationMs: key === 'newRun' ? 10_000 : 8_000 };
  return null;
}
