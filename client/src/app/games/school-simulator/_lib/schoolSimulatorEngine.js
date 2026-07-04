export const GAME_SLUG = 'school-simulator';
export const QUICK_SAVE_SLOT = 'school-simulator-main';
export const SAVE_VERSION = 'school-simulator-v1';

export const WEEK_SCHEDULE = {
  1: { label: '학기 시작', examType: null },
  2: { label: '일반 수업', examType: null },
  3: { label: '쪽지시험 주간', examType: 'quiz' },
  4: { label: '일반 수업', examType: null },
  5: { label: '쪽지시험 주간', examType: 'quiz' },
  6: { label: '중간고사', examType: 'midterm' },
  7: { label: '중간 정산', examType: null },
  8: { label: '일반 수업', examType: null },
  9: { label: '쪽지시험 주간', examType: 'quiz' },
  10: { label: '프로젝트 / 행사', examType: null },
  11: { label: '쪽지시험 주간', examType: 'quiz' },
  12: { label: '기말고사', examType: 'final' },
};

export const POLICY_PRESETS = [
  { id: 'balanced', label: '균형 운영', budgetCost: 80, effects: { academic: 1, welfare: 1, autonomy: 1, community: 1, stress: -0.2, satisfaction: 0.4, teacherFatigue: 0.2 } },
  { id: 'academic_focus', label: '학업 집중', budgetCost: 120, effects: { academic: 3, welfare: -1, autonomy: -1, community: 0, diligence: 1.4, understanding: 1.2, stress: 1.1, teacherFatigue: 0.8 } },
  { id: 'care_focus', label: '돌봄 회복', budgetCost: 130, effects: { academic: -1, welfare: 3, autonomy: 0, community: 1, stress: -1.8, satisfaction: 1.4, health: 1.2, teacherFatigue: -0.6 } },
  { id: 'autonomy_focus', label: '자치 활성', budgetCost: 90, effects: { academic: 0, welfare: 0, autonomy: 3, community: 2, stress: -0.4, satisfaction: 1.0, relation: 1.2 } },
  { id: 'brand_focus', label: '브랜드 도약', budgetCost: 160, effects: { academic: 2, welfare: 0, autonomy: 0, community: 1, stress: 0.6, satisfaction: 0.2, admissions: 2.2 } },
];

export const WORK_ACTIONS = [
  { id: 'boostCounseling', label: '상담 강화', apCost: 2, budgetCost: 220, tags: ['principal'], description: '상담실 인력과 프로그램을 늘려 스트레스와 시험 불안을 낮춥니다.', effects: { welfare: 2, community: 1, stress: -4, satisfaction: 1 } },
  { id: 'libraryProgram', label: '도서관 학습 프로그램', apCost: 2, budgetCost: 180, tags: ['academic'], description: '도서관 프로그램을 운영하여 성실도와 이해도 상승량을 높입니다.', effects: { academic: 2, diligence: 2, understanding: 2 } },
  { id: 'facilityMaintenance', label: '시설 점검 / 보수', apCost: 2, budgetCost: 260, tags: ['facility'], description: '시설 상태를 회복시키고 안전 신뢰도를 올립니다.', effects: { safety: 3, facilityCondition: 8, risk: -3 } },
  { id: 'studentCouncilMeeting', label: '학생회 협의', apCost: 1, budgetCost: 80, tags: ['principal'], description: '학생 자치와 공동체성을 강화합니다.', effects: { autonomy: 3, community: 2, satisfaction: 1 } },
  { id: 'teacherWorkshop', label: '교사 워크숍', apCost: 2, budgetCost: 210, tags: ['teacher'], description: '교사 수업력과 사기를 소폭 올리고 피로를 완화합니다.', effects: { teacherSkill: 1, teacherMorale: 2, teacherFatigue: -3 } },
  { id: 'scholarshipPolicy', label: '장학 정책', apCost: 2, budgetCost: 300, tags: ['finance'], description: '학생 만족과 입학 매력을 높이지만 예산을 소모합니다.', effects: { welfare: 1, satisfaction: 2, admissions: 2, finance: -1 } },
  { id: 'openClass', label: '교과 공개수업', apCost: 2, budgetCost: 150, tags: ['academic'], description: '수업 평판과 브랜드 인지도를 높입니다.', effects: { academic: 2, admissions: 1.5, teacherFatigue: 1 } },
  { id: 'festivalPrep', label: '축제 준비', apCost: 3, budgetCost: 260, tags: ['community'], description: '공동체성과 자치를 크게 올리지만 학업 집중은 다소 흔들립니다.', effects: { community: 4, autonomy: 3, satisfaction: 2, academic: -1, stress: 0.5 } },
];

const TEACHER_SEEDS = [
  { id: 't_hina', name: '히나', subject: '수학', teachingSkill: 82, counselingSkill: 58, warmth: 60, fatigue: 32, morale: 74 },
  { id: 't_noa', name: '노아', subject: '국어', teachingSkill: 78, counselingSkill: 66, warmth: 68, fatigue: 26, morale: 76 },
  { id: 't_furina', name: '푸리나', subject: '영어', teachingSkill: 75, counselingSkill: 60, warmth: 73, fatigue: 28, morale: 71 },
  { id: 't_yuri', name: '유리', subject: '사회', teachingSkill: 72, counselingSkill: 74, warmth: 77, fatigue: 25, morale: 80 },
  { id: 't_mika', name: '미카', subject: '과학', teachingSkill: 80, counselingSkill: 54, warmth: 55, fatigue: 30, morale: 69 },
  { id: 't_lumine', name: '루미네', subject: '예술', teachingSkill: 74, counselingSkill: 68, warmth: 79, fatigue: 23, morale: 84 },
  { id: 't_mirai', name: '미래', subject: '체육', teachingSkill: 70, counselingSkill: 59, warmth: 71, fatigue: 27, morale: 78 },
  { id: 't_jin', name: '진', subject: '생활지도', teachingSkill: 68, counselingSkill: 82, warmth: 69, fatigue: 34, morale: 75 },
];

const STUDENT_NAMES = ['시로코', '유우카', '호시노', '아루', '노노미', '세리카', '이오리', '히후미', '하나코', '미도리', '모모이', '아리스', '아즈사', '마리', '코하루', '카즈사', '나기사', '세이아'];

const FACILITY_SEEDS = [
  { id: 'f_classroom', name: '일반 교실', type: 'classroom', condition: 76, capacity: 90 },
  { id: 'f_library', name: '도서관', type: 'library', condition: 72, capacity: 50 },
  { id: 'f_counsel', name: '상담실', type: 'welfare', condition: 70, capacity: 35 },
  { id: 'f_lab', name: '실험실', type: 'lab', condition: 66, capacity: 40 },
  { id: 'f_club', name: '동아리관', type: 'club', condition: 68, capacity: 60 },
];

export const SUBJECTS = [
  { id: 'math', label: '수학', teacherSubject: '수학', core: true },
  { id: 'language', label: '국어', teacherSubject: '국어', core: true },
  { id: 'english', label: '영어', teacherSubject: '영어', core: true },
  { id: 'social', label: '사회', teacherSubject: '사회', core: true },
  { id: 'science', label: '과학', teacherSubject: '과학', core: true },
  { id: 'arts', label: '예술', teacherSubject: '예술', core: false },
  { id: 'physical', label: '체육', teacherSubject: '체육', core: false },
  { id: 'project', label: '프로젝트', teacherSubject: '생활지도', core: false },
];

export const SUBJECT_POLICY_MODES = [
  { id: 'balanced', label: '균형 수업', learning: 1.0, stress: 0, autonomy: 0.4, satisfaction: 0.3 },
  { id: 'lecture', label: '강의 집중', learning: 1.35, stress: 1.2, autonomy: -0.3, satisfaction: -0.2 },
  { id: 'discussion', label: '토론 수업', learning: 1.05, stress: 0.4, autonomy: 1.4, satisfaction: 0.7 },
  { id: 'project', label: '프로젝트형', learning: 1.15, stress: 0.8, autonomy: 1.1, satisfaction: 0.9 },
  { id: 'coaching', label: '보충 코칭', learning: 1.2, stress: -0.8, autonomy: 0.2, satisfaction: 0.5 },
];

export const CLUB_TEMPLATES = [
  { id: 'club_research', label: '탐구 동아리', theme: 'academic', capacity: 10, level: 1 },
  { id: 'club_creative', label: '창작 동아리', theme: 'creative', capacity: 10, level: 1 },
  { id: 'club_leadership', label: '자치 리더 동아리', theme: 'leadership', capacity: 8, level: 1 },
  { id: 'club_healing', label: '회복 지원 동아리', theme: 'wellbeing', capacity: 8, level: 1 },
];

export const CAREER_TRACKS = [
  { id: 'academic', label: '학업 심화', understanding: 3, diligence: 2, autonomy: 0, satisfaction: 0 },
  { id: 'research', label: '연구 프로젝트', understanding: 2, diligence: 1, autonomy: 2, satisfaction: 0 },
  { id: 'creative', label: '창작 포트폴리오', understanding: 1, diligence: 0, autonomy: 2, satisfaction: 2 },
  { id: 'community', label: '지역사회 연계', understanding: 0, diligence: 1, autonomy: 2, satisfaction: 2 },
  { id: 'wellbeing', label: '회복 상담', understanding: 0, diligence: 0, autonomy: 1, satisfaction: 3, stress: -4, health: 2 },
];

export const RECRUITMENT_STRATEGIES = [
  { id: 'balanced', label: '균형 모집', admissions: 2, brand: 2, quality: 1 },
  { id: 'academic', label: '학업 성과 홍보', admissions: 2, brand: 3, quality: 3, academic: 1 },
  { id: 'welfare', label: '복지·안전 홍보', admissions: 2, brand: 2, quality: 2, wellbeing: 1 },
  { id: 'culture', label: '자치·문화 홍보', admissions: 3, brand: 3, quality: 1, community: 1 },
];

export const FESTIVAL_TYPES = [
  { id: 'class_festival', label: '학급 축제', metric: 'community', weeks: 2, budgetCost: 380 },
  { id: 'club_showcase', label: '동아리 발표회', metric: 'autonomy', weeks: 2, budgetCost: 320 },
  { id: 'subject_expo', label: '교과 박람회', metric: 'academic', weeks: 2, budgetCost: 420 },
  { id: 'wellbeing_day', label: '회복 주간', metric: 'welfare', weeks: 1, budgetCost: 260 },
];

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const mode = options.mode || 'principal';
  return {
    runId: options.runId || `school-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    school: {
      name: options.schoolName || '키보토스 아카데미',
      year: 1,
      semester: 1,
      week: 1,
      budget: mode === 'chairman' ? 24000 : 16000,
      income: 0,
      expense: 0,
      policyPreset: 'balanced',
      subjectPolicies: createSubjectPolicies(),
      culture: { autonomy: 56, academic: 52, welfare: 60, community: 50 },
      reputation: { academic: 50, wellbeing: 58, safety: 62, autonomy: 56, community: 50, finance: 52 },
      admissions: { applications: 58, competitionRate: 3.6, brandAwareness: 50, inboundInterest: 52, nextIntakeQuality: 60, recruitmentStrategy: 'balanced', marketingMomentum: 0 },
      festival: { active: null, history: [] },
      riskLevel: 16,
    },
    player: { mode, name: options.playerName || '플레이어', energy: 72, mental: 68, insight: 55, network: 42, weeklyActionPoint: 7, burnoutRisk: 14 },
    students: createStudents(),
    teachers: TEACHER_SEEDS.map((teacher) => ({ ...teacher })),
    facilities: FACILITY_SEEDS.map((facility) => ({ ...facility })),
    clubs: createDefaultClubs(),
    careerReports: [],
    weeklyModifiers: {},
    recentExamResults: [],
    semesterHistory: [],
    log: ['새 학교 운영을 시작했습니다. AP와 예산을 써서 주간 행동을 고르고 주차를 정산하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    school: value.school && typeof value.school === 'object' ? {
      ...base.school,
      ...value.school,
      culture: { ...base.school.culture, ...(value.school.culture || {}) },
      reputation: { ...base.school.reputation, ...(value.school.reputation || {}) },
      admissions: { ...base.school.admissions, ...(value.school.admissions || {}) },
      subjectPolicies: normalizeSubjectPolicies(value.school.subjectPolicies),
      festival: { ...base.school.festival, ...(value.school.festival || {}), history: Array.isArray(value.school.festival?.history) ? value.school.festival.history.slice(0, 8) : [] },
    } : base.school,
    player: value.player && typeof value.player === 'object' ? { ...base.player, ...value.player } : base.player,
    students: Array.isArray(value.students) && value.students.length ? value.students.map((student, index) => normalizeStudent(student, index)) : base.students,
    teachers: Array.isArray(value.teachers) && value.teachers.length ? value.teachers : base.teachers,
    facilities: Array.isArray(value.facilities) && value.facilities.length ? value.facilities : base.facilities,
    clubs: Array.isArray(value.clubs) && value.clubs.length ? normalizeClubs(value.clubs, value.students || base.students) : normalizeClubs(base.clubs, value.students || base.students),
    careerReports: Array.isArray(value.careerReports) ? value.careerReports.slice(0, 30) : base.careerReports,
    weeklyModifiers: value.weeklyModifiers && typeof value.weeklyModifiers === 'object' ? value.weeklyModifiers : {},
    recentExamResults: Array.isArray(value.recentExamResults) ? value.recentExamResults : [],
    semesterHistory: Array.isArray(value.semesterHistory) ? value.semesterHistory : [],
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

function createStudents() {
  return STUDENT_NAMES.map((name, index) => {
    const grade = 1 + (index % 3);
    const variance = (index * 7) % 17;
    const favoriteSubject = SUBJECTS[index % SUBJECTS.length].id;
    const weakSubject = SUBJECTS[(index + 3) % SUBJECTS.length].id;
    const subjectScores = createSubjectScores(index, favoriteSubject, weakSubject);
    const club = CLUB_TEMPLATES[index % CLUB_TEMPLATES.length];
    return {
      id: `s_${index + 1}`,
      name,
      grade,
      classNo: 1 + (index % 2),
      diligence: clamp(54 + variance, 0, 100),
      understanding: Math.round(average(Object.values(subjectScores))),
      subjectScores,
      favoriteSubject,
      weakSubject,
      stress: clamp(28 + ((index * 5) % 28), 0, 100),
      satisfaction: clamp(58 + ((index * 3) % 19), 0, 100),
      health: clamp(72 - (index % 5) * 3, 0, 100),
      autonomyParticipation: clamp(42 + ((index * 9) % 33), 0, 100),
      relationStability: clamp(50 + ((index * 13) % 29), 0, 100),
      careerReadiness: clamp(35 + ((index * 6) % 30), 0, 100),
      careerTrack: CAREER_TRACKS[index % CAREER_TRACKS.length].id,
      clubId: club.id,
      clubRole: index % 7 === 0 ? 'leader' : 'member',
    };
  });
}

function createSubjectScores(index, favoriteSubject, weakSubject) {
  return SUBJECTS.reduce((next, subject, subjectIndex) => {
    const base = 48 + ((index * 9 + subjectIndex * 5) % 24);
    const adjusted = base + (subject.id === favoriteSubject ? 10 : 0) - (subject.id === weakSubject ? 8 : 0);
    return { ...next, [subject.id]: clamp(adjusted, 0, 100) };
  }, {});
}

function createSubjectPolicies() {
  return SUBJECTS.reduce((next, subject) => ({
    ...next,
    [subject.id]: { subject: subject.id, mode: 'balanced' },
  }), {});
}

function normalizeSubjectPolicies(value = {}) {
  const base = createSubjectPolicies();
  return SUBJECTS.reduce((next, subject) => ({
    ...next,
    [subject.id]: {
      ...base[subject.id],
      ...(value?.[subject.id] || {}),
      mode: SUBJECT_POLICY_MODES.some((mode) => mode.id === value?.[subject.id]?.mode) ? value[subject.id].mode : 'balanced',
    },
  }), {});
}

function normalizeStudent(student, index = 0) {
  const favoriteSubject = student.favoriteSubject || SUBJECTS[index % SUBJECTS.length].id;
  const weakSubject = student.weakSubject || SUBJECTS[(index + 3) % SUBJECTS.length].id;
  const subjectScores = student.subjectScores && typeof student.subjectScores === 'object'
    ? SUBJECTS.reduce((next, subject) => ({ ...next, [subject.id]: clamp(student.subjectScores[subject.id] ?? student.understanding ?? 50, 0, 100) }), {})
    : createSubjectScores(index, favoriteSubject, weakSubject);
  return {
    ...student,
    subjectScores,
    favoriteSubject,
    weakSubject,
    understanding: Math.round(average(Object.values(subjectScores))),
    careerTrack: student.careerTrack || CAREER_TRACKS[index % CAREER_TRACKS.length].id,
    clubId: student.clubId || CLUB_TEMPLATES[index % CLUB_TEMPLATES.length].id,
    clubRole: student.clubRole || (index % 7 === 0 ? 'leader' : 'member'),
  };
}

function createDefaultClubs() {
  return CLUB_TEMPLATES.map((club) => ({
    ...club,
    influence: 50,
    clubMood: 56,
    showcaseWeeksRemaining: 0,
    eventHistory: [],
    memberCount: 0,
    memberNames: [],
    leaderStudentId: null,
    leaderStudentName: '미지정',
  }));
}

function normalizeClubs(clubs = [], students = []) {
  const previous = Object.fromEntries(clubs.map((club) => [club.id, club]));
  return createDefaultClubs().map((base) => {
    const club = { ...base, ...(previous[base.id] || {}) };
    const members = students.filter((student) => student.clubId === club.id);
    const leader = members.find((student) => student.clubRole === 'leader') || members.slice().sort((a, b) => Number(b.autonomyParticipation || 0) - Number(a.autonomyParticipation || 0))[0];
    return {
      ...club,
      memberCount: members.length,
      memberNames: members.slice(0, 5).map((student) => student.name),
      leaderStudentId: leader?.id || null,
      leaderStudentName: leader?.name || '미지정',
      influence: clamp((club.level || 1) * 10 + 34 + members.length * 2.4 + (leader ? 5 : 0) + (club.clubMood - 50) * 0.15, 0, 100),
    };
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}

function average(values) {
  const list = values.filter((value) => Number.isFinite(Number(value)));
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + Number(value || 0), 0) / list.length;
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}

function applyCulture(state, effects = {}) {
  const school = { ...state.school, culture: { ...state.school.culture }, reputation: { ...state.school.reputation }, admissions: { ...state.school.admissions } };
  school.culture.academic = clamp(school.culture.academic + Number(effects.academic || 0), 0, 100);
  school.culture.welfare = clamp(school.culture.welfare + Number(effects.welfare || 0), 0, 100);
  school.culture.autonomy = clamp(school.culture.autonomy + Number(effects.autonomy || 0), 0, 100);
  school.culture.community = clamp(school.culture.community + Number(effects.community || 0), 0, 100);
  school.reputation.academic = clamp(school.reputation.academic + Number(effects.academic || 0) * 0.6, 0, 100);
  school.reputation.wellbeing = clamp(school.reputation.wellbeing + Number(effects.welfare || 0) * 0.6, 0, 100);
  school.reputation.autonomy = clamp(school.reputation.autonomy + Number(effects.autonomy || 0) * 0.6, 0, 100);
  school.reputation.community = clamp(school.reputation.community + Number(effects.community || 0) * 0.6, 0, 100);
  school.reputation.safety = clamp(school.reputation.safety + Number(effects.safety || 0), 0, 100);
  school.reputation.finance = clamp(school.reputation.finance + Number(effects.finance || 0), 0, 100);
  school.riskLevel = clamp(school.riskLevel + Number(effects.risk || 0), 0, 100);
  school.admissions.brandAwareness = clamp(school.admissions.brandAwareness + Number(effects.admissions || 0), 0, 100);
  school.admissions.inboundInterest = clamp(school.admissions.inboundInterest + Number(effects.admissions || 0), 0, 100);
  return { ...state, school };
}

function applyStudentEffects(students, effects = {}) {
  return students.map((student) => ({
    ...student,
    diligence: clamp(student.diligence + Number(effects.diligence || 0), 0, 100),
    understanding: clamp(student.understanding + Number(effects.understanding || 0), 0, 100),
    stress: clamp(student.stress + Number(effects.stress || 0), 0, 100),
    satisfaction: clamp(student.satisfaction + Number(effects.satisfaction || 0), 0, 100),
    health: clamp(student.health + Number(effects.health || 0), 0, 100),
    autonomyParticipation: clamp(student.autonomyParticipation + Number(effects.autonomy || 0), 0, 100),
    relationStability: clamp(student.relationStability + Number(effects.relation || effects.community || 0), 0, 100),
  }));
}

function applyTeacherEffects(teachers, effects = {}) {
  return teachers.map((teacher) => ({
    ...teacher,
    teachingSkill: clamp(teacher.teachingSkill + Number(effects.teacherSkill || 0), 0, 100),
    morale: clamp(teacher.morale + Number(effects.teacherMorale || 0), 0, 100),
    fatigue: clamp(teacher.fatigue + Number(effects.teacherFatigue || 0), 0, 100),
  }));
}

function subjectPolicyMode(state, subjectId) {
  const modeId = state.school.subjectPolicies?.[subjectId]?.mode || 'balanced';
  return SUBJECT_POLICY_MODES.find((mode) => mode.id === modeId) || SUBJECT_POLICY_MODES[0];
}

function teacherForSubject(state, subject) {
  return state.teachers.find((teacher) => teacher.subject === subject.teacherSubject)
    || state.teachers.find((teacher) => teacher.subject === '생활지도')
    || state.teachers[0];
}

function applySubjectLearning(student, state, weekInfo, teachingBase) {
  const nextScores = { ...student.subjectScores };
  let stressDelta = 0;
  let satisfactionDelta = 0;
  let autonomyDelta = 0;
  SUBJECTS.forEach((subject) => {
    const teacher = teacherForSubject(state, subject);
    const mode = subjectPolicyMode(state, subject.id);
    const favorite = student.favoriteSubject === subject.id ? 1.2 : 1;
    const weak = student.weakSubject === subject.id ? 0.85 : 1;
    const examBoost = weekInfo.examType ? 0.4 : 0;
    const gain = (teachingBase * 0.55 + Number(teacher?.teachingSkill || 60) / 55 + examBoost) * mode.learning * favorite * weak;
    nextScores[subject.id] = clamp(Number(nextScores[subject.id] || 50) + gain, 0, 100);
    stressDelta += mode.stress / SUBJECTS.length;
    satisfactionDelta += mode.satisfaction / SUBJECTS.length;
    autonomyDelta += mode.autonomy / SUBJECTS.length;
  });
  return {
    ...student,
    subjectScores: nextScores,
    understanding: Math.round(average(Object.values(nextScores))),
    stress: clamp(student.stress + stressDelta, 0, 100),
    satisfaction: clamp(student.satisfaction + satisfactionDelta, 0, 100),
    autonomyParticipation: clamp(student.autonomyParticipation + autonomyDelta, 0, 100),
  };
}

export function applyWorkAction(state, actionId) {
  let current = normalizeState(state);
  const action = WORK_ACTIONS.find((item) => item.id === actionId) || WORK_ACTIONS[0];
  if (Number(current.player.weeklyActionPoint || 0) < action.apCost) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < action.budgetCost) return addLog(current, '예산이 부족합니다.');
  current = {
    ...current,
    player: {
      ...current.player,
      weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - action.apCost,
      energy: clamp(Number(current.player.energy || 0) - Math.max(1, action.apCost - 1), 0, 100),
      mental: clamp(Number(current.player.mental || 0) - Math.max(0, action.apCost - 2), 0, 100),
    },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - action.budgetCost,
      expense: Number(current.school.expense || 0) + action.budgetCost,
    },
    students: applyStudentEffects(current.students, action.effects),
    teachers: applyTeacherEffects(current.teachers, action.effects),
    facilities: current.facilities.map((facility) => ({ ...facility, condition: clamp(facility.condition + Number(action.effects.facilityCondition || 0), 0, 100) })),
  };
  current = applyCulture(current, action.effects);
  return addLog(current, `${action.label} 행동을 실행했습니다.`);
}

export function applyPolicyPreset(state, presetId) {
  let current = normalizeState(state);
  const preset = POLICY_PRESETS.find((item) => item.id === presetId) || POLICY_PRESETS[0];
  if (current.school.policyPreset === preset.id) return addLog(current, '이미 적용 중인 정책입니다.');
  if (Number(current.player.weeklyActionPoint || 0) < 1) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < preset.budgetCost) return addLog(current, '예산이 부족합니다.');
  current = {
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 1 },
    school: {
      ...current.school,
      policyPreset: preset.id,
      budget: Number(current.school.budget || 0) - preset.budgetCost,
      expense: Number(current.school.expense || 0) + preset.budgetCost,
    },
    students: applyStudentEffects(current.students, preset.effects),
    teachers: applyTeacherEffects(current.teachers, preset.effects),
  };
  current = applyCulture(current, preset.effects);
  return addLog(current, `정책 프리셋을 ${preset.label}(으)로 변경했습니다.`);
}

export function restAction(state) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    player: {
      ...current.player,
      energy: clamp(Number(current.player.energy || 0) + 15, 0, 100),
      mental: clamp(Number(current.player.mental || 0) + 10, 0, 100),
      burnoutRisk: clamp(Number(current.player.burnoutRisk || 0) - 6, 0, 100),
      weeklyActionPoint: Math.max(0, Number(current.player.weeklyActionPoint || 0) - 2),
    },
  }, '짧은 휴식을 취했습니다. 체력과 정신력이 회복됩니다.');
}

export function applySubjectPolicyAction(state, subjectId, modeId) {
  const current = normalizeState(state);
  const subject = SUBJECTS.find((item) => item.id === subjectId) || SUBJECTS[0];
  const mode = SUBJECT_POLICY_MODES.find((item) => item.id === modeId) || SUBJECT_POLICY_MODES[0];
  if (Number(current.player.weeklyActionPoint || 0) < 1) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 80) return addLog(current, '예산이 부족합니다.');
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 1 },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - 80,
      expense: Number(current.school.expense || 0) + 80,
      subjectPolicies: { ...current.school.subjectPolicies, [subject.id]: { subject: subject.id, mode: mode.id } },
    },
    teachers: current.teachers.map((teacher) => (
      teacher.subject === subject.teacherSubject ? { ...teacher, fatigue: clamp(teacher.fatigue + 1, 0, 100) } : teacher
    )),
  }, `${subject.label} 수업 방식을 ${mode.label}로 조정했습니다.`);
}

export function runAdmissionCampaignAction(state, strategyId) {
  const current = normalizeState(state);
  const strategy = RECRUITMENT_STRATEGIES.find((item) => item.id === strategyId) || RECRUITMENT_STRATEGIES[0];
  if (Number(current.player.weeklyActionPoint || 0) < 2) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 240) return addLog(current, '예산이 부족합니다.');
  const admissions = current.school.admissions;
  const academicSignal = strategy.academic ? Number(current.school.reputation.academic || 0) / 35 : 0;
  const wellbeingSignal = strategy.wellbeing ? Number(current.school.reputation.wellbeing || 0) / 38 : 0;
  const communitySignal = strategy.community ? Number(current.school.reputation.community || 0) / 40 : 0;
  const applicationsGain = Math.round(3 + strategy.admissions + academicSignal + wellbeingSignal + communitySignal);
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 2, network: clamp(Number(current.player.network || 0) + 2, 0, 100) },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - 240,
      expense: Number(current.school.expense || 0) + 240,
      admissions: {
        ...admissions,
        recruitmentStrategy: strategy.id,
        marketingMomentum: clamp(Number(admissions.marketingMomentum || 0) + 9, 0, 100),
        brandAwareness: clamp(Number(admissions.brandAwareness || 0) + strategy.brand, 0, 100),
        inboundInterest: clamp(Number(admissions.inboundInterest || 0) + strategy.admissions + 2, 0, 100),
        applications: Math.max(0, Number(admissions.applications || 0) + applicationsGain),
        nextIntakeQuality: clamp(Number(admissions.nextIntakeQuality || 0) + strategy.quality, 0, 100),
      },
    },
  }, `${strategy.label} 캠페인을 진행했습니다. 지원자 +${applicationsGain}, 다음 신입생 질 +${strategy.quality}`);
}

export function runCareerCounselingAction(state, trackId) {
  const current = normalizeState(state);
  const track = CAREER_TRACKS.find((item) => item.id === trackId) || CAREER_TRACKS[0];
  if (Number(current.player.weeklyActionPoint || 0) < 2) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 180) return addLog(current, '예산이 부족합니다.');
  const targetIds = current.students.slice().sort((a, b) => Number(a.careerReadiness || 0) - Number(b.careerReadiness || 0)).slice(0, 6).map((student) => student.id);
  const students = current.students.map((student) => {
    if (!targetIds.includes(student.id)) return student;
    return {
      ...student,
      careerTrack: track.id,
      careerReadiness: clamp(Number(student.careerReadiness || 0) + 8 + Number(track.understanding || 0), 0, 100),
      diligence: clamp(student.diligence + Number(track.diligence || 0), 0, 100),
      understanding: clamp(student.understanding + Number(track.understanding || 0), 0, 100),
      autonomyParticipation: clamp(student.autonomyParticipation + Number(track.autonomy || 0), 0, 100),
      satisfaction: clamp(student.satisfaction + Number(track.satisfaction || 0), 0, 100),
      stress: clamp(student.stress + Number(track.stress || 0), 0, 100),
      health: clamp(student.health + Number(track.health || 0), 0, 100),
    };
  });
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 2 },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - 180,
      expense: Number(current.school.expense || 0) + 180,
      reputation: {
        ...current.school.reputation,
        academic: clamp(current.school.reputation.academic + (track.id === 'academic' ? 1 : 0), 0, 100),
        community: clamp(current.school.reputation.community + (track.id === 'community' ? 1 : 0), 0, 100),
      },
    },
    students,
    careerReports: [{ week: current.school.week, trackId: track.id, label: track.label, students: targetIds.length }, ...current.careerReports].slice(0, 30),
  }, `${track.label} 진로 상담을 진행했습니다. 대상 ${targetIds.length}명`);
}

export function runSubjectPresentationAction(state, subjectId) {
  const current = normalizeState(state);
  const subject = SUBJECTS.find((item) => item.id === subjectId) || SUBJECTS[0];
  if (Number(current.player.weeklyActionPoint || 0) < 2) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 220) return addLog(current, '예산이 부족합니다.');
  const subjectAverage = Math.round(average(current.students.map((student) => student.subjectScores?.[subject.id] || student.understanding || 50)));
  const teacher = teacherForSubject(current, subject);
  const presentationScore = clamp(subjectAverage * 0.68 + Number(teacher?.teachingSkill || 60) * 0.22 + Number(current.school.culture.autonomy || 50) * 0.1, 0, 100);
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 2 },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - 220,
      expense: Number(current.school.expense || 0) + 220,
      reputation: { ...current.school.reputation, academic: clamp(current.school.reputation.academic + presentationScore / 32, 0, 100), community: clamp(current.school.reputation.community + presentationScore / 55, 0, 100) },
      admissions: { ...current.school.admissions, brandAwareness: clamp(current.school.admissions.brandAwareness + presentationScore / 40, 0, 100), inboundInterest: clamp(current.school.admissions.inboundInterest + presentationScore / 60, 0, 100) },
    },
    teachers: current.teachers.map((item) => (item.id === teacher?.id ? { ...item, fatigue: clamp(item.fatigue + 3, 0, 100), morale: clamp(item.morale + 1, 0, 100) } : item)),
  }, `${subject.label} 발표 수업을 열었습니다. 발표 점수 ${presentationScore}점`);
}

export function runClubRecruitmentAction(state, clubId) {
  const current = normalizeState(state);
  const club = current.clubs.find((item) => item.id === clubId) || current.clubs[0];
  if (Number(current.player.weeklyActionPoint || 0) < 2) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 140) return addLog(current, '예산이 부족합니다.');
  const memberCount = current.students.filter((student) => student.clubId === club.id).length;
  const capacityLeft = Math.max(0, Number(club.capacity || 8) - memberCount);
  const candidates = current.students.filter((student) => student.clubId !== club.id).slice(0, Math.min(3, capacityLeft));
  if (!candidates.length) return addLog(current, `${club.label}에 추가 모집할 여유가 없습니다.`);
  const candidateIds = new Set(candidates.map((student) => student.id));
  const students = current.students.map((student) => (candidateIds.has(student.id) ? { ...student, clubId: club.id, clubRole: student.clubRole || 'member', satisfaction: clamp(student.satisfaction + 1, 0, 100) } : student));
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 2 },
    school: { ...current.school, budget: Number(current.school.budget || 0) - 140, expense: Number(current.school.expense || 0) + 140 },
    students,
    clubs: normalizeClubs(current.clubs, students),
  }, `${club.label} 신규 모집으로 ${candidates.length}명이 합류했습니다.`);
}

export function startClubShowcaseAction(state, clubId) {
  const current = normalizeState(state);
  const club = current.clubs.find((item) => item.id === clubId) || current.clubs[0];
  if (Number(current.player.weeklyActionPoint || 0) < 2) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < 180) return addLog(current, '예산이 부족합니다.');
  if (Number(club.showcaseWeeksRemaining || 0) > 0) return addLog(current, `${club.label} 발표회는 이미 준비 중입니다.`);
  const clubs = current.clubs.map((item) => (item.id === club.id ? { ...item, showcaseWeeksRemaining: 2, clubMood: clamp(item.clubMood + 3, 0, 100) } : item));
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 2 },
    school: { ...current.school, budget: Number(current.school.budget || 0) - 180, expense: Number(current.school.expense || 0) + 180 },
    clubs,
  }, `${club.label} 발표회를 준비합니다. 2주 뒤 결과가 정산됩니다.`);
}

export function launchFestivalAction(state, festivalId) {
  const current = normalizeState(state);
  const festival = FESTIVAL_TYPES.find((item) => item.id === festivalId) || FESTIVAL_TYPES[0];
  if (current.school.festival?.active) return addLog(current, '이미 진행 중인 행사가 있습니다.');
  if (Number(current.player.weeklyActionPoint || 0) < 3) return addLog(current, 'AP가 부족합니다.');
  if (Number(current.school.budget || 0) < festival.budgetCost) return addLog(current, '예산이 부족합니다.');
  return addLog({
    ...current,
    player: { ...current.player, weeklyActionPoint: Number(current.player.weeklyActionPoint || 0) - 3 },
    school: {
      ...current.school,
      budget: Number(current.school.budget || 0) - festival.budgetCost,
      expense: Number(current.school.expense || 0) + festival.budgetCost,
      festival: { ...current.school.festival, active: { id: festival.id, label: festival.label, metric: festival.metric, weeksRemaining: festival.weeks } },
    },
  }, `${festival.label}를 시작했습니다. ${festival.weeks}주 뒤 결과가 정산됩니다.`);
}

function runExam(state, weekInfo) {
  if (!weekInfo.examType) return [];
  const weight = weekInfo.examType === 'final' ? 1.35 : weekInfo.examType === 'midterm' ? 1.15 : 0.75;
  return state.students.map((student) => ({
    studentId: student.id,
    name: student.name,
    score: clamp((student.diligence * 0.26 + student.understanding * 0.42 + average(Object.values(student.subjectScores || {})) * 0.16 + student.health * 0.08 + (100 - student.stress) * 0.08) * weight, 0, 100),
  })).sort((a, b) => b.score - a.score);
}

function processClubWeekly(state, students, clubs) {
  let nextStudents = students.map((student) => ({ ...student }));
  let school = { ...state.school, reputation: { ...state.school.reputation }, culture: { ...state.school.culture }, festival: { ...state.school.festival } };
  const logs = [];
  let nextClubs = normalizeClubs(clubs, nextStudents).map((club) => {
    const members = nextStudents.filter((student) => student.clubId === club.id);
    nextStudents = nextStudents.map((student) => {
      if (student.clubId !== club.id) return student;
      const leaderBonus = student.clubRole === 'leader' ? 1 : 0;
      if (club.theme === 'academic') {
        const subjectScores = { ...student.subjectScores, math: clamp((student.subjectScores?.math || 50) + 1, 0, 100), science: clamp((student.subjectScores?.science || 50) + 1, 0, 100) };
        return { ...student, subjectScores, diligence: clamp(student.diligence + club.level + leaderBonus, 0, 100), understanding: Math.round(average(Object.values(subjectScores))), stress: clamp(student.stress - 1, 0, 100) };
      }
      if (club.theme === 'creative') {
        const subjectScores = { ...student.subjectScores, arts: clamp((student.subjectScores?.arts || 50) + 2, 0, 100) };
        return { ...student, subjectScores, satisfaction: clamp(student.satisfaction + 2 + leaderBonus, 0, 100), autonomyParticipation: clamp(student.autonomyParticipation + 1, 0, 100), understanding: Math.round(average(Object.values(subjectScores))) };
      }
      if (club.theme === 'leadership') {
        return { ...student, autonomyParticipation: clamp(student.autonomyParticipation + 2 + leaderBonus, 0, 100), relationStability: clamp(student.relationStability + 2, 0, 100), satisfaction: clamp(student.satisfaction + 1, 0, 100) };
      }
      return { ...student, stress: clamp(student.stress - 2, 0, 100), health: clamp(student.health + 1, 0, 100), satisfaction: clamp(student.satisfaction + 1 + leaderBonus, 0, 100) };
    });

    let nextClub = { ...club };
    if (nextClub.showcaseWeeksRemaining > 0) {
      nextClub.showcaseWeeksRemaining -= 1;
      if (nextClub.showcaseWeeksRemaining === 0) {
        school.reputation.academic = clamp(school.reputation.academic + (club.theme === 'academic' ? 3 : 1), 0, 100);
        school.reputation.autonomy = clamp(school.reputation.autonomy + (club.theme === 'leadership' ? 3 : 1), 0, 100);
        school.reputation.wellbeing = clamp(school.reputation.wellbeing + (club.theme === 'wellbeing' ? 3 : 1), 0, 100);
        school.reputation.community = clamp(school.reputation.community + 2, 0, 100);
        school.admissions.brandAwareness = clamp(school.admissions.brandAwareness + 2, 0, 100);
        nextClub = {
          ...nextClub,
          eventHistory: [`발표회 성공 · ${members.length}명 참여`, ...(nextClub.eventHistory || [])].slice(0, 5),
          clubMood: clamp(nextClub.clubMood + 4, 0, 100),
        };
        logs.push(`${nextClub.label} 발표회가 마무리되어 학교 평판이 상승했습니다.`);
      }
    }
    return nextClub;
  });
  nextClubs = normalizeClubs(nextClubs, nextStudents);
  return { students: nextStudents, clubs: nextClubs, school, logs };
}

function processFestivalWeekly(state, students, school) {
  if (!school.festival?.active) return { students, school, logs: [] };
  const active = { ...school.festival.active, weeksRemaining: Number(school.festival.active.weeksRemaining || 0) - 1 };
  if (active.weeksRemaining > 0) {
    return { students, school: { ...school, festival: { ...school.festival, active } }, logs: [] };
  }
  const metricMap = {
    academic: (student) => student.understanding + student.diligence,
    autonomy: (student) => student.autonomyParticipation + student.relationStability,
    community: (student) => student.satisfaction + student.relationStability,
    welfare: (student) => 100 - student.stress + student.health,
  };
  const metric = metricMap[active.metric] || metricMap.community;
  const ranked = students.slice().sort((a, b) => metric(b) - metric(a));
  const winner = ranked[0];
  const nextStudents = students.map((student) => ({
    ...student,
    satisfaction: clamp(student.satisfaction + (student.id === winner?.id ? 5 : 2), 0, 100),
    relationStability: clamp(student.relationStability + 2, 0, 100),
    stress: clamp(student.stress - 1, 0, 100),
  }));
  const nextSchool = {
    ...school,
    culture: {
      ...school.culture,
      community: clamp(school.culture.community + 2, 0, 100),
      autonomy: clamp(school.culture.autonomy + (active.metric === 'autonomy' ? 2 : 1), 0, 100),
      academic: clamp(school.culture.academic + (active.metric === 'academic' ? 2 : 0), 0, 100),
      welfare: clamp(school.culture.welfare + (active.metric === 'welfare' ? 2 : 0), 0, 100),
    },
    reputation: {
      ...school.reputation,
      community: clamp(school.reputation.community + 3, 0, 100),
      academic: clamp(school.reputation.academic + (active.metric === 'academic' ? 2 : 0), 0, 100),
      wellbeing: clamp(school.reputation.wellbeing + (active.metric === 'welfare' ? 2 : 0), 0, 100),
    },
    admissions: {
      ...school.admissions,
      brandAwareness: clamp(school.admissions.brandAwareness + 3, 0, 100),
      inboundInterest: clamp(school.admissions.inboundInterest + 2, 0, 100),
    },
    festival: {
      active: null,
      history: [{ label: active.label, winnerName: winner?.name || '없음', metric: active.metric, week: school.week }, ...(school.festival.history || [])].slice(0, 8),
    },
  };
  return { students: nextStudents, school: nextSchool, logs: [`${active.label}가 종료되었습니다. 대표 학생: ${winner?.name || '없음'}.`] };
}

export function endWeekAction(state) {
  let current = normalizeState(state);
  const weekInfo = WEEK_SCHEDULE[current.school.week] || { label: '학기 종료', examType: null };
  const policy = POLICY_PRESETS.find((item) => item.id === current.school.policyPreset) || POLICY_PRESETS[0];
  const avgTeacherSkill = average(current.teachers.map((teacher) => teacher.teachingSkill));
  const facilityAvg = average(current.facilities.map((facility) => facility.condition));
  const teachingBase = avgTeacherSkill / 26 + Number(current.school.culture.academic || 0) / 32 + facilityAvg / 60;
  const welfareBase = Number(current.school.culture.welfare || 0) / 34 + average(current.teachers.map((teacher) => teacher.counselingSkill)) / 42;

  let students = current.students.map((student) => {
    const learned = applySubjectLearning(student, current, weekInfo, teachingBase);
    return {
      ...learned,
      diligence: clamp(learned.diligence + teachingBase * 0.8 + Number(policy.effects.diligence || 0) * 0.6, 0, 100),
      stress: clamp(learned.stress + 2.1 - welfareBase * 0.65 + Number(policy.effects.stress || 0) * 0.4, 0, 100),
      satisfaction: clamp(learned.satisfaction + Number(current.school.culture.community || 0) / 55 + Number(policy.effects.satisfaction || 0) * 0.35, 0, 100),
      health: clamp(learned.health - 1 + Number(policy.effects.health || 0) * 0.35, 0, 100),
      careerReadiness: clamp(learned.careerReadiness + learned.understanding / 120 + learned.autonomyParticipation / 150, 0, 100),
    };
  });

  const clubResult = processClubWeekly(current, students, current.clubs || []);
  students = clubResult.students;

  let teachers = current.teachers.map((teacher) => ({
    ...teacher,
    fatigue: clamp(teacher.fatigue + 4 + Number(policy.effects.teacherFatigue || 0), 0, 100),
    morale: clamp(teacher.morale - 1 + Number(policy.effects.teacherMorale || 0), 0, 100),
  }));
  let facilities = current.facilities.map((facility) => ({ ...facility, condition: clamp(facility.condition - 2, 0, 100) }));
  const income = 900 + Math.round(Number(current.school.reputation.finance || 0) * 9 + Number(current.school.admissions.competitionRate || 0) * 120);
  const maintenance = 520 + current.students.length * 18 + current.teachers.length * 42 + Math.round((100 - facilityAvg) * 7);
  const exams = runExam({ ...current, students }, weekInfo);
  const examAvg = exams.length ? Math.round(average(exams.map((row) => row.score))) : 0;
  let school = {
    ...current.school,
    ...clubResult.school,
    budget: Number(current.school.budget || 0) + income - maintenance,
    income: Number(current.school.income || 0) + income,
    expense: Number(current.school.expense || 0) + maintenance,
    reputation: { ...clubResult.school.reputation },
    admissions: { ...clubResult.school.admissions },
    riskLevel: clamp(Number(current.school.riskLevel || 0) + (average(students.map((student) => student.stress)) > 70 ? 3 : -1) + (facilityAvg < 50 ? 2 : 0), 0, 100),
  };
  if (exams.length) school.reputation.academic = clamp(school.reputation.academic + (examAvg - 60) / 9, 0, 100);
  school.reputation.wellbeing = clamp(school.reputation.wellbeing + (average(students.map((student) => student.satisfaction)) - average(students.map((student) => student.stress))) / 80, 0, 100);
  school.admissions.brandAwareness = clamp(school.admissions.brandAwareness + Number(school.reputation.academic || 0) / 90 + Number(school.reputation.community || 0) / 140, 0, 100);
  school.admissions.inboundInterest = clamp(school.admissions.inboundInterest + Number(school.reputation.wellbeing || 0) / 120, 0, 100);
  school.admissions.competitionRate = Math.max(0.8, Math.round((1.2 + school.admissions.brandAwareness / 24 + school.admissions.inboundInterest / 42) * 10) / 10);

  const festivalResult = processFestivalWeekly(current, students, school);
  students = festivalResult.students;
  school = festivalResult.school;

  const nextWeek = Number(school.week || 1) + 1;
  const semesterEnded = nextWeek > 12;
  let semesterHistory = current.semesterHistory;
  if (semesterEnded) {
    semesterHistory = [createSemesterReport({ ...current, school, students, teachers, facilities, recentExamResults: exams })].concat(semesterHistory).slice(0, 10);
    school.week = 1;
    school.semester += 1;
    if (school.semester > 2) {
      school.semester = 1;
      school.year += 1;
      students = graduateAndRecruit(students, school);
    }
  } else {
    school.week = nextWeek;
  }

  current = {
    ...current,
    school,
    students,
    teachers,
    facilities,
    clubs: clubResult.clubs,
    recentExamResults: exams,
    semesterHistory,
    player: {
      ...current.player,
      weeklyActionPoint: 7,
      energy: clamp(Number(current.player.energy || 0) + 7, 0, 100),
      mental: clamp(Number(current.player.mental || 0) + 5, 0, 100),
      burnoutRisk: clamp(Number(current.player.burnoutRisk || 0) + (Number(current.player.energy || 0) < 35 ? 4 : -1), 0, 100),
    },
    weeklyModifiers: {},
  };

  const examText = exams.length ? ` 시험 평균 ${examAvg}점.` : '';
  const eventText = [...clubResult.logs, ...festivalResult.logs].length ? ` ${[...clubResult.logs, ...festivalResult.logs].join(' ')}` : '';
  return addLog(current, `${weekInfo.label} 주간 정산 완료. 수입 +${income} / 유지비 -${maintenance}.${examText}${eventText}${semesterEnded ? ' 학기가 종료되어 보고서가 생성됐습니다.' : ''}`);
}

function graduateAndRecruit(students, school) {
  const returning = students
    .filter((student) => student.grade < 3)
    .map((student) => ({ ...student, grade: student.grade + 1 }));
  const intake = Math.max(4, Math.min(8, Math.round(Number(school.admissions.competitionRate || 1) + 2)));
  const start = returning.length;
  const recruits = Array.from({ length: intake }, (_, index) => ({
    ...createStudents()[index % STUDENT_NAMES.length],
    id: `new_${school.year}_${index}`,
    name: `${STUDENT_NAMES[(start + index) % STUDENT_NAMES.length]} ${school.year}기`,
    grade: 1,
    diligence: clamp(48 + Number(school.admissions.nextIntakeQuality || 50) / 4 + index, 0, 100),
    understanding: clamp(45 + Number(school.admissions.nextIntakeQuality || 50) / 5 + index, 0, 100),
  }));
  return returning.concat(recruits);
}

function createSemesterReport(state) {
  const averages = getAverages(state);
  return {
    year: state.school.year,
    semester: state.school.semester,
    academic: averages.understanding,
    wellbeing: averages.satisfaction,
    stress: averages.stress,
    teacherMorale: averages.teacherMorale,
    budget: state.school.budget,
    score: scoreState(state),
  };
}

export function getAverages(state) {
  const current = normalizeState(state);
  return {
    diligence: Math.round(average(current.students.map((student) => student.diligence))),
    understanding: Math.round(average(current.students.map((student) => student.understanding))),
    stress: Math.round(average(current.students.map((student) => student.stress))),
    satisfaction: Math.round(average(current.students.map((student) => student.satisfaction))),
    health: Math.round(average(current.students.map((student) => student.health))),
    autonomy: Math.round(average(current.students.map((student) => student.autonomyParticipation))),
    relation: Math.round(average(current.students.map((student) => student.relationStability))),
    teacherFatigue: Math.round(average(current.teachers.map((teacher) => teacher.fatigue))),
    teacherMorale: Math.round(average(current.teachers.map((teacher) => teacher.morale))),
    facilityCondition: Math.round(average(current.facilities.map((facility) => facility.condition))),
  };
}

export function getTopStudents(state, key = 'understanding', limit = 5) {
  return normalizeState(state).students
    .slice()
    .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
    .slice(0, limit);
}

export function getAtRiskStudents(state) {
  return normalizeState(state).students
    .filter((student) => student.stress >= 68 || student.health <= 45 || student.satisfaction <= 44)
    .sort((a, b) => b.stress - a.stress)
    .slice(0, 6);
}

export function subjectPolicyRows(state) {
  const current = normalizeState(state);
  return SUBJECTS.map((subject) => {
    const policy = current.school.subjectPolicies?.[subject.id] || { mode: 'balanced' };
    const mode = SUBJECT_POLICY_MODES.find((item) => item.id === policy.mode) || SUBJECT_POLICY_MODES[0];
    const teacher = teacherForSubject(current, subject);
    const averageScore = Math.round(average(current.students.map((student) => student.subjectScores?.[subject.id] || student.understanding || 50)));
    return { ...subject, mode: mode.id, modeLabel: mode.label, teacherName: teacher?.name || '미지정', averageScore };
  });
}

export function clubRows(state) {
  const current = normalizeState(state);
  return normalizeClubs(current.clubs, current.students);
}

export function careerTrackRows(state) {
  const current = normalizeState(state);
  return CAREER_TRACKS.map((track) => ({
    ...track,
    count: current.students.filter((student) => student.careerTrack === track.id).length,
    averageReadiness: Math.round(average(current.students.filter((student) => student.careerTrack === track.id).map((student) => student.careerReadiness))),
  }));
}

export function semesterReport(state) {
  const current = normalizeState(state);
  const avg = getAverages(current);
  const subjects = subjectPolicyRows(current).map((subject) => {
    const scores = current.students.map((student) => Number(student.subjectScores?.[subject.id] ?? student.understanding ?? 50));
    return {
      ...subject,
      averageScore: Math.round(average(scores)),
      weakCount: current.students.filter((student) => Number(student.subjectScores?.[subject.id] ?? 50) < 55).length,
      highCount: current.students.filter((student) => Number(student.subjectScores?.[subject.id] ?? 0) >= 75).length,
    };
  });
  const careerRows = CAREER_TRACKS.map((track) => {
    const members = current.students.filter((student) => student.careerTrack === track.id);
    return {
      ...track,
      count: members.length,
      averageReadiness: Math.round(average(members.map((student) => student.careerReadiness))),
      averageStress: Math.round(average(members.map((student) => student.stress))),
      averageSatisfaction: Math.round(average(members.map((student) => student.satisfaction))),
    };
  }).sort((a, b) => b.count - a.count || b.averageReadiness - a.averageReadiness);
  const subjectAverage = Math.round(average(subjects.map((subject) => subject.averageScore)));
  const recentExamAverage = Math.round(average(current.recentExamResults.map((row) => row.score)));
  const careerAverage = Math.round(average(current.students.map((student) => student.careerReadiness)));
  const clubInfluence = Math.round(average(clubRows(current).map((club) => club.influence)));
  const maintenanceEstimate = 520 + current.students.length * 18 + current.teachers.length * 42 + Math.round((100 - avg.facilityCondition) * 7);
  const budgetRunwayWeeks = Math.max(0, Math.floor(Number(current.school.budget || 0) / Math.max(1, maintenanceEstimate)));
  const atRiskCount = getAtRiskStudents(current).length;
  const risks = [];

  const addRisk = (level, title, detail, action) => {
    risks.push({ level, title, detail, action });
  };

  if (Number(current.school.budget || 0) < 2500) {
    addRisk('critical', '예산 압박', `현재 예산으로 약 ${budgetRunwayWeeks}주 버틸 수 있습니다.`, '모집 캠페인이나 재정 평판 회복을 우선하세요.');
  } else if (budgetRunwayWeeks <= 4) {
    addRisk('warn', '예산 여유 부족', `유지비 추정치 기준 ${budgetRunwayWeeks}주 여유입니다.`, '고비용 행사는 한 주 미루고 수입 기반을 올리세요.');
  }
  if (avg.stress >= 68 || atRiskCount >= 4) {
    addRisk('critical', '학생 피로 누적', `위험 학생 ${atRiskCount}명, 평균 스트레스 ${avg.stress}입니다.`, '상담 강화와 돌봄 정책으로 회복 주간을 만드세요.');
  } else if (avg.stress >= 58 || avg.health <= 55) {
    addRisk('warn', '컨디션 경고', `평균 스트레스 ${avg.stress}, 평균 건강 ${avg.health}입니다.`, '시험 전에는 강의 집중보다 보충 코칭을 섞으세요.');
  }
  if (avg.teacherFatigue >= 68 || avg.teacherMorale <= 50) {
    addRisk('warn', '교사 운영 부담', `교사 피로 ${avg.teacherFatigue}, 사기 ${avg.teacherMorale}입니다.`, '교사 워크숍이나 휴식 운영을 배치하세요.');
  }
  if (avg.facilityCondition <= 58 || Number(current.school.riskLevel || 0) >= 55) {
    addRisk('warn', '시설/안전 리스크', `시설 ${avg.facilityCondition}, 운영 위험 ${current.school.riskLevel}입니다.`, '시설 보수 액션으로 안전 평판 하락을 막으세요.');
  }
  if (subjectAverage < 60) {
    addRisk('warn', '교과 성취 저하', `교과 평균이 ${subjectAverage}점입니다.`, '평균이 낮은 과목부터 발표 수업이나 보충 코칭을 넣으세요.');
  }
  if (careerAverage < 55) {
    addRisk('warn', '진로 준비 부족', `진로 준비 평균이 ${careerAverage}점입니다.`, '하위권 학생 대상 진로 상담을 먼저 실행하세요.');
  }
  if (Number(current.school.admissions.competitionRate || 0) < 2 || Number(current.school.admissions.applications || 0) < current.students.length * 2) {
    addRisk('warn', '모집 기반 약화', `지원자 ${current.school.admissions.applications}명, 경쟁률 ${current.school.admissions.competitionRate}:1입니다.`, '브랜드나 복지 강점을 앞세운 모집 전략이 필요합니다.');
  }
  if (!risks.length) {
    addRisk('good', '안정 운영', '즉시 처리해야 할 구조적 위험은 없습니다.', '다음 시험/행사 타이밍에 맞춰 성장 분야를 골라 투자하세요.');
  }

  return {
    headline: `${current.school.year}년 ${current.school.semester}학기 ${current.school.week}주차`,
    score: scoreState(current),
    status: risks.some((risk) => risk.level === 'critical') ? '긴급 점검' : risks.some((risk) => risk.level === 'warn') ? '주의 필요' : '안정',
    academic: {
      understanding: avg.understanding,
      diligence: avg.diligence,
      subjectAverage,
      recentExamAverage,
    },
    wellbeing: {
      stress: avg.stress,
      satisfaction: avg.satisfaction,
      health: avg.health,
      atRiskCount,
    },
    operations: {
      budget: Number(current.school.budget || 0),
      budgetRunwayWeeks,
      teacherFatigue: avg.teacherFatigue,
      teacherMorale: avg.teacherMorale,
      facilityCondition: avg.facilityCondition,
      competitionRate: Number(current.school.admissions.competitionRate || 0),
      careerAverage,
      clubInfluence,
    },
    subjectRows: subjects.sort((a, b) => a.averageScore - b.averageScore),
    careerRows,
    risks,
    recommendations: risks.slice(0, 4).map((risk) => risk.action),
  };
}

export function festivalStatus(state) {
  const current = normalizeState(state);
  return {
    active: current.school.festival?.active || null,
    history: current.school.festival?.history || [],
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const avg = getAverages(current);
  const subjectAverage = Math.round(average(subjectPolicyRows(current).map((row) => row.averageScore)));
  const careerAverage = Math.round(average(current.students.map((student) => student.careerReadiness)));
  const clubInfluence = Math.round(average(clubRows(current).map((club) => club.influence)));
  return Math.max(0, Math.round(
    Number(current.school.budget || 0) / 24
    + avg.understanding * 10
    + subjectAverage * 4
    + avg.satisfaction * 10
    + avg.autonomy * 7
    + careerAverage * 4
    + clubInfluence * 3
    + avg.teacherMorale * 6
    + avg.facilityCondition * 5
    - avg.stress * 6
    - Number(current.school.riskLevel || 0) * 7
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const avg = getAverages(current);
  return {
    year: current.school.year,
    semester: current.school.semester,
    week: current.school.week,
    budget: current.school.budget,
    students: current.students.length,
    teachers: current.teachers.length,
    academic: avg.understanding,
    stress: avg.stress,
    satisfaction: avg.satisfaction,
    subjectAverage: Math.round(average(subjectPolicyRows(current).map((row) => row.averageScore))),
    careerReadiness: Math.round(average(current.students.map((student) => student.careerReadiness))),
    clubInfluence: Math.round(average(clubRows(current).map((club) => club.influence))),
    festivalHistory: current.school.festival?.history?.length || 0,
    score: scoreState(current),
  };
}
