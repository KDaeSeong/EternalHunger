const FEEDBACK_PROFILES = {
  idle: { action: '', cue: '', label: '운영 결과', tone: '' },
  newRun: { action: 'school-new', cue: 'schoolNewRun', label: '새 학교', tone: 'highlight' },
  semester: { action: 'school-semester', cue: 'schoolSemester', label: '학기 전환', tone: 'highlight' },
  festivalComplete: { action: 'school-festival-complete', cue: 'schoolFestivalComplete', label: '행사 완료', tone: 'success' },
  festivalStart: { action: 'school-festival-start', cue: 'schoolFestivalStart', label: '행사 시작', tone: 'highlight' },
  incident: { action: 'school-incident', cue: 'schoolIncident', label: '학교 사건', tone: 'warning' },
  incidentResolved: { action: 'school-resolution', cue: 'schoolResolution', label: '사건 해결', tone: 'success' },
  crisis: { action: 'school-crisis', cue: 'schoolCrisis', label: '운영 경보', tone: 'danger' },
  recovery: { action: 'school-recovery', cue: 'schoolRecovery', label: '위험 완화', tone: 'success' },
  policy: { action: 'school-policy', cue: 'schoolPolicy', label: '정책 변경', tone: 'highlight' },
  week: { action: 'school-week', cue: 'schoolBell', label: '새 주차', tone: 'highlight' },
  blocked: { action: 'school-blocked', cue: 'schoolBlocked', label: '실행 불가', tone: 'warning' },
  counseling: { action: 'school-counseling', cue: 'schoolCounseling', label: '상담 지원', tone: 'success' },
  lesson: { action: 'school-lesson', cue: 'schoolLesson', label: '수업 운영', tone: 'highlight' },
  maintenance: { action: 'school-maintenance', cue: 'schoolMaintenance', label: '시설 정비', tone: 'success' },
  teacher: { action: 'school-teacher', cue: 'schoolTeacher', label: '교사 지원', tone: 'success' },
  admission: { action: 'school-admission', cue: 'schoolAdmission', label: '입학 홍보', tone: 'highlight' },
  career: { action: 'school-career', cue: 'schoolCareer', label: '진로 지도', tone: 'success' },
  club: { action: 'school-club', cue: 'schoolClub', label: '동아리 운영', tone: 'highlight' },
  rest: { action: 'school-rest', cue: 'schoolRest', label: '운영진 회복', tone: 'success' },
  vision: { action: 'school-vision', cue: 'schoolVision', label: '학교 비전', tone: 'highlight' },
  action: { action: 'school-operation', cue: 'schoolOperation', label: '운영 실행', tone: 'success' },
};

const ACTION_LOG_RULES = [
  { pattern: /짧은 휴식을 취했습니다/, profile: 'rest' },
  { pattern: /장기 학교 비전을/, profile: 'vision' },
  { pattern: /진로 상담을 진행했습니다/, profile: 'career' },
  { pattern: /상담 강화 행동을 실행했습니다/, profile: 'counseling' },
  { pattern: /시설 점검 \/ 보수 행동을 실행했습니다/, profile: 'maintenance' },
  { pattern: /(?:교사에게 .* 적용했습니다|교사 워크숍 행동을 실행했습니다)/, profile: 'teacher' },
  { pattern: /캠페인을 진행했습니다/, profile: 'admission' },
  { pattern: /(?:신규 모집으로 .*합류했습니다|발표회를 준비합니다)/, profile: 'club' },
  { pattern: /(?:수업 방식을 .*조정했습니다|발표 수업을 열었습니다|교과 공개수업 행동을 실행했습니다|도서관 학습 프로그램 행동을 실행했습니다|활동을 시작했습니다)/, profile: 'lesson' },
  { pattern: /행동을 실행했습니다/, profile: 'action' },
];

const TEXT_PRESENTATIONS = [
  { pattern: /저장.*실패|불러오기.*실패|기록.*실패|유효하지|부족합니다|할 수 없습니다|없습니다|적자/, profile: 'blocked' },
  { pattern: /불러오|불러왔/, value: { action: 'load', label: '진행 불러오기', tone: 'success' } },
  { pattern: /저장/, value: { action: 'save', label: '진행 저장', tone: 'success' } },
  { pattern: /전적|운영 기록/, value: { action: 'archive', label: '전적 기록', tone: 'success' } },
];

function atRiskStudentCount(state) {
  const students = Array.isArray(state?.students) ? state.students : [];
  return students
    .filter((student) => (
      Number(student?.stress || 0) >= 68
      || Number(student?.health ?? 100) <= 45
      || Number(student?.satisfaction ?? 100) <= 44
    ))
    .slice(0, 6)
    .length;
}

function crisisFlags(state, riskCount) {
  const flags = [];
  if (Number(state?.school?.budget || 0) < 0) flags.push('budget');
  if (Number(state?.school?.riskLevel || 0) >= 60) flags.push('school');
  if (Number(state?.player?.burnoutRisk || 0) >= 65) flags.push('burnout');
  if (riskCount >= 4) flags.push('students');
  return flags;
}

export function schoolFeedbackSnapshot(state) {
  const school = state?.school || {};
  const festival = school.festival || {};
  const events = state?.events || {};
  const riskCount = atRiskStudentCount(state);
  const crisis = crisisFlags(state, riskCount);

  return {
    runId: String(state?.runId || ''),
    periodKey: `${Number(school.year || 0)}:${Number(school.semester || 0)}`,
    week: Number(school.week || 0),
    semesterReportCount: Array.isArray(state?.semesterHistory) ? state.semesterHistory.length : 0,
    festivalActiveId: String(festival.active?.id || ''),
    festivalHistoryCount: Array.isArray(festival.history) ? festival.history.length : 0,
    pendingEventId: String(events.pending?.id || ''),
    resolvedEventCount: Array.isArray(events.history) ? events.history.length : 0,
    policyPreset: String(school.policyPreset || ''),
    riskCount,
    crisisSignature: crisis.join(':'),
    latestLog: String(state?.log?.[0] || ''),
  };
}

export function schoolFeedbackTransition(previousValue, currentValue) {
  const previous = previousValue?.periodKey ? previousValue : schoolFeedbackSnapshot(previousValue);
  const current = currentValue?.periodKey ? currentValue : schoolFeedbackSnapshot(currentValue);
  if (!previousValue || !currentValue) return 'idle';
  if (previous.runId !== current.runId) return 'newRun';
  if (
    current.semesterReportCount > previous.semesterReportCount
    || current.periodKey !== previous.periodKey
  ) return 'semester';
  if (current.festivalHistoryCount > previous.festivalHistoryCount) return 'festivalComplete';
  if (current.festivalActiveId && current.festivalActiveId !== previous.festivalActiveId) return 'festivalStart';
  if (current.pendingEventId && current.pendingEventId !== previous.pendingEventId) return 'incident';
  if (current.resolvedEventCount > previous.resolvedEventCount) return 'incidentResolved';
  if (!previous.crisisSignature && current.crisisSignature) return 'crisis';
  if (previous.riskCount > current.riskCount && (current.riskCount === 0 || previous.riskCount - current.riskCount >= 2)) return 'recovery';
  if (current.policyPreset !== previous.policyPreset) return 'policy';
  if (current.week !== previous.week) return 'week';
  if (
    current.latestLog
    && current.latestLog !== previous.latestLog
    && /부족합니다|할 수 없습니다|없습니다|이미 적용|이미 진행/.test(current.latestLog)
  ) return 'blocked';
  if (current.latestLog && current.latestLog !== previous.latestLog) {
    const actionRule = ACTION_LOG_RULES.find((row) => row.pattern.test(current.latestLog));
    if (actionRule) return actionRule.profile;
  }
  return 'action';
}

export function schoolActionCue(previous, current) {
  const transition = schoolFeedbackTransition(previous, current);
  return FEEDBACK_PROFILES[transition]?.cue || '';
}

export function schoolActionPresentation(previous, current) {
  const transition = schoolFeedbackTransition(previous, current);
  return { key: transition, ...FEEDBACK_PROFILES[transition] };
}

export function schoolResultPresentation(text, fallback = FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  for (const row of TEXT_PRESENTATIONS) {
    if (!row.pattern.test(normalized)) continue;
    if (row.profile) return { key: row.profile, ...FEEDBACK_PROFILES[row.profile] };
    return { key: 'message', cue: '', ...row.value };
  }
  return fallback || FEEDBACK_PROFILES.idle;
}
