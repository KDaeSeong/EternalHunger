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
      culture: { autonomy: 56, academic: 52, welfare: 60, community: 50 },
      reputation: { academic: 50, wellbeing: 58, safety: 62, autonomy: 56, community: 50, finance: 52 },
      admissions: { applications: 58, competitionRate: 3.6, brandAwareness: 50, inboundInterest: 52, nextIntakeQuality: 60 },
      riskLevel: 16,
    },
    player: { mode, name: options.playerName || '플레이어', energy: 72, mental: 68, insight: 55, network: 42, weeklyActionPoint: 7, burnoutRisk: 14 },
    students: createStudents(),
    teachers: TEACHER_SEEDS.map((teacher) => ({ ...teacher })),
    facilities: FACILITY_SEEDS.map((facility) => ({ ...facility })),
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
    school: value.school && typeof value.school === 'object' ? { ...base.school, ...value.school, culture: { ...base.school.culture, ...(value.school.culture || {}) }, reputation: { ...base.school.reputation, ...(value.school.reputation || {}) }, admissions: { ...base.school.admissions, ...(value.school.admissions || {}) } } : base.school,
    player: value.player && typeof value.player === 'object' ? { ...base.player, ...value.player } : base.player,
    students: Array.isArray(value.students) && value.students.length ? value.students : base.students,
    teachers: Array.isArray(value.teachers) && value.teachers.length ? value.teachers : base.teachers,
    facilities: Array.isArray(value.facilities) && value.facilities.length ? value.facilities : base.facilities,
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
    return {
      id: `s_${index + 1}`,
      name,
      grade,
      classNo: 1 + (index % 2),
      diligence: clamp(54 + variance, 0, 100),
      understanding: clamp(50 + ((index * 11) % 23), 0, 100),
      stress: clamp(28 + ((index * 5) % 28), 0, 100),
      satisfaction: clamp(58 + ((index * 3) % 19), 0, 100),
      health: clamp(72 - (index % 5) * 3, 0, 100),
      autonomyParticipation: clamp(42 + ((index * 9) % 33), 0, 100),
      relationStability: clamp(50 + ((index * 13) % 29), 0, 100),
      careerReadiness: clamp(35 + ((index * 6) % 30), 0, 100),
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

function runExam(state, weekInfo) {
  if (!weekInfo.examType) return [];
  const weight = weekInfo.examType === 'final' ? 1.35 : weekInfo.examType === 'midterm' ? 1.15 : 0.75;
  return state.students.map((student) => ({
    studentId: student.id,
    name: student.name,
    score: clamp((student.diligence * 0.34 + student.understanding * 0.46 + student.health * 0.1 + (100 - student.stress) * 0.1) * weight, 0, 100),
  })).sort((a, b) => b.score - a.score);
}

export function endWeekAction(state) {
  let current = normalizeState(state);
  const weekInfo = WEEK_SCHEDULE[current.school.week] || { label: '학기 종료', examType: null };
  const policy = POLICY_PRESETS.find((item) => item.id === current.school.policyPreset) || POLICY_PRESETS[0];
  const avgTeacherSkill = average(current.teachers.map((teacher) => teacher.teachingSkill));
  const facilityAvg = average(current.facilities.map((facility) => facility.condition));
  const teachingBase = avgTeacherSkill / 26 + Number(current.school.culture.academic || 0) / 32 + facilityAvg / 60;
  const welfareBase = Number(current.school.culture.welfare || 0) / 34 + average(current.teachers.map((teacher) => teacher.counselingSkill)) / 42;

  let students = current.students.map((student) => ({
    ...student,
    diligence: clamp(student.diligence + teachingBase * 0.8 + Number(policy.effects.diligence || 0) * 0.6, 0, 100),
    understanding: clamp(student.understanding + teachingBase + Number(policy.effects.understanding || 0) * 0.7, 0, 100),
    stress: clamp(student.stress + 2.1 - welfareBase * 0.65 + Number(policy.effects.stress || 0) * 0.4, 0, 100),
    satisfaction: clamp(student.satisfaction + Number(current.school.culture.community || 0) / 55 + Number(policy.effects.satisfaction || 0) * 0.35, 0, 100),
    health: clamp(student.health - 1 + Number(policy.effects.health || 0) * 0.35, 0, 100),
    careerReadiness: clamp(student.careerReadiness + student.understanding / 120 + student.autonomyParticipation / 150, 0, 100),
  }));

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
    budget: Number(current.school.budget || 0) + income - maintenance,
    income: Number(current.school.income || 0) + income,
    expense: Number(current.school.expense || 0) + maintenance,
    reputation: { ...current.school.reputation },
    admissions: { ...current.school.admissions },
    riskLevel: clamp(Number(current.school.riskLevel || 0) + (average(students.map((student) => student.stress)) > 70 ? 3 : -1) + (facilityAvg < 50 ? 2 : 0), 0, 100),
  };
  if (exams.length) school.reputation.academic = clamp(school.reputation.academic + (examAvg - 60) / 9, 0, 100);
  school.reputation.wellbeing = clamp(school.reputation.wellbeing + (average(students.map((student) => student.satisfaction)) - average(students.map((student) => student.stress))) / 80, 0, 100);
  school.admissions.brandAwareness = clamp(school.admissions.brandAwareness + Number(school.reputation.academic || 0) / 90 + Number(school.reputation.community || 0) / 140, 0, 100);
  school.admissions.inboundInterest = clamp(school.admissions.inboundInterest + Number(school.reputation.wellbeing || 0) / 120, 0, 100);
  school.admissions.competitionRate = Math.max(0.8, Math.round((1.2 + school.admissions.brandAwareness / 24 + school.admissions.inboundInterest / 42) * 10) / 10);

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
  return addLog(current, `${weekInfo.label} 주간 정산 완료. 수입 +${income} / 유지비 -${maintenance}.${examText}${semesterEnded ? ' 학기가 종료되어 보고서가 생성됐습니다.' : ''}`);
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

export function scoreState(state) {
  const current = normalizeState(state);
  const avg = getAverages(current);
  return Math.max(0, Math.round(
    Number(current.school.budget || 0) / 24
    + avg.understanding * 12
    + avg.satisfaction * 10
    + avg.autonomy * 7
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
    score: scoreState(current),
  };
}
