const FEEDBACK_PROFILES = {
  idle: { action: '', cue: '', label: '운영 결과', tone: '' },
  newRun: { action: 'new', cue: 'start', label: '새 학교', tone: 'highlight' },
  semester: { action: 'semester', cue: 'semester', label: '학기 전환', tone: 'highlight' },
  festivalComplete: { action: 'festival', cue: 'festival', label: '행사 완료', tone: 'success' },
  festivalStart: { action: 'festival', cue: 'festival', label: '행사 시작', tone: 'highlight' },
  incident: { action: 'event', cue: 'schoolIncident', label: '학교 사건', tone: 'warning' },
  incidentResolved: { action: 'complete', cue: 'schoolResolution', label: '사건 해결', tone: 'success' },
  crisis: { action: 'warning', cue: 'schoolCrisis', label: '운영 경보', tone: 'danger' },
  recovery: { action: 'counsel', cue: 'schoolRecovery', label: '위험 완화', tone: 'success' },
  policy: { action: 'policy', cue: 'policy', label: '정책 변경', tone: 'highlight' },
  week: { action: 'calendar', cue: 'schoolBell', label: '새 주차', tone: 'highlight' },
  blocked: { action: 'warning', cue: 'warning', label: '실행 불가', tone: 'warning' },
  action: { action: '', cue: '', label: '운영 결과', tone: '' },
};

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
