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

export const TEACHER_ACTIONS = [
  { id: 'teacher_recovery', label: '교사 회복일', apCost: 2, budgetCost: 180, description: '피로가 높은 교사를 쉬게 해 사기와 유지 안정성을 회복합니다.' },
  { id: 'mentor_case_conference', label: '멘토 사례 회의', apCost: 2, budgetCost: 160, description: '담당 과목 학생의 스트레스와 만족도를 관리하고 상담 역량을 올립니다.' },
  { id: 'teacher_promotion_review', label: '승진 심사', apCost: 2, budgetCost: 220, description: '성과가 충분한 교사의 직급을 올리고 수업/상담 역량을 강화합니다.' },
  { id: 'teacher_contract_renewal', label: '계약 갱신', apCost: 1, budgetCost: 120, description: '계약 불안을 낮추고 교사 사기를 안정화합니다.' },
  { id: 'teacher_short_leave', label: '단기 휴직', apCost: 1, budgetCost: 90, description: '소진 위험 교사를 2주간 휴직 처리해 회복 루틴을 시작합니다.' },
  { id: 'teacher_evaluation_review', label: '교사 평가', apCost: 1, budgetCost: 80, description: '현재 성과를 평가하고 피드백으로 사기를 보정합니다.' },
];

export const TEACHER_SEEDS = [
  { id: 't_hina', name: '히나', subject: '수학', teachingSkill: 82, counselingSkill: 58, warmth: 60, fatigue: 32, morale: 74 },
  { id: 't_noa', name: '노아', subject: '국어', teachingSkill: 78, counselingSkill: 66, warmth: 68, fatigue: 26, morale: 76 },
  { id: 't_furina', name: '푸리나', subject: '영어', teachingSkill: 75, counselingSkill: 60, warmth: 73, fatigue: 28, morale: 71 },
  { id: 't_yuri', name: '유리', subject: '사회', teachingSkill: 72, counselingSkill: 74, warmth: 77, fatigue: 25, morale: 80 },
  { id: 't_mika', name: '미카', subject: '과학', teachingSkill: 80, counselingSkill: 54, warmth: 55, fatigue: 30, morale: 69 },
  { id: 't_lumine', name: '루미네', subject: '예술', teachingSkill: 74, counselingSkill: 68, warmth: 79, fatigue: 23, morale: 84 },
  { id: 't_mirai', name: '미래', subject: '체육', teachingSkill: 70, counselingSkill: 59, warmth: 71, fatigue: 27, morale: 78 },
  { id: 't_jin', name: '진', subject: '생활지도', teachingSkill: 68, counselingSkill: 82, warmth: 69, fatigue: 34, morale: 75 },
];

export const STUDENT_NAMES = ['시로코', '유우카', '호시노', '아루', '노노미', '세리카', '이오리', '히후미', '하나코', '미도리', '모모이', '아리스', '아즈사', '마리', '코하루', '카즈사', '나기사', '세이아'];

export const FACILITY_SEEDS = [
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

export const SUBJECT_SHOWCASE_ACTIONS = [
  {
    id: 'publicLesson',
    label: '공개수업',
    field: 'publicLessonWeeks',
    apCost: 1,
    budgetCost: 150,
    weeks: 1,
    description: '수업 완성도를 외부에 보여 학업 평판과 브랜드 인지도를 올립니다.',
  },
  {
    id: 'achievementPresentation',
    label: '성취 발표',
    field: 'achievementPresentationWeeks',
    apCost: 1,
    budgetCost: 220,
    weeks: 2,
    description: '우수 학생의 성과를 발표해 만족도, 자치 참여, 입학 관심도를 올립니다.',
  },
  {
    id: 'subjectWeek',
    label: '과목 주간 행사',
    field: 'subjectWeekWeeks',
    apCost: 2,
    budgetCost: 260,
    weeks: 2,
    description: '교과 중심 행사를 열어 공동체성, 자율성, 홍보 탄력을 올립니다.',
  },
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

export const SCHOOL_VISIONS = [
  {
    id: 'balanced_growth',
    label: '균형 성장형 학교',
    short: '성적, 복지, 자치, 재정을 고르게 끌어올리는 표준 성장 노선입니다.',
    goal: '3년 안에 학업, 복지, 공동체, 재정 평가를 모두 60 이상으로 안정화',
    weights: { academic: 1, wellbeing: 1, autonomy: 0.8, community: 0.9, finance: 1, admissions: 0.7, teacher: 0.8, career: 0.7 },
  },
  {
    id: 'academic_mastery',
    label: '학업 명문형 학교',
    short: '수업 완성도와 시험 성취를 앞세우되 학생 지원 체계를 함께 관리하는 노선입니다.',
    goal: '학업 평판 75 이상, 교과 평균 70 이상, 입학 경쟁률 4.0 이상 달성',
    weights: { academic: 1.8, wellbeing: 0.6, autonomy: 0.4, community: 0.5, finance: 0.8, admissions: 1.1, teacher: 0.9, career: 1 },
  },
  {
    id: 'democratic_autonomy',
    label: '자치·민주형 학교',
    short: '학생회, 학급 자치, 동아리 자율성을 학교 브랜드의 핵심으로 삼는 노선입니다.',
    goal: '자율 문화 80 이상, 학생회 권한 70 이상, 공동체 평판 70 이상 달성',
    weights: { academic: 0.6, wellbeing: 0.9, autonomy: 1.8, community: 1.4, finance: 0.5, admissions: 0.8, teacher: 0.7, career: 0.7 },
  },
  {
    id: 'welfare_recovery',
    label: '복지·회복형 학교',
    short: '상담, 회복, 적응, 안전을 중심에 두고 낙오 없이 성장시키는 노선입니다.',
    goal: '학생 평균 스트레스 45 이하, 복지 평판 80 이상, 지원 학생 회복률 향상',
    weights: { academic: 0.7, wellbeing: 1.9, autonomy: 0.7, community: 1.1, finance: 0.6, admissions: 0.6, teacher: 1, career: 0.7 },
  },
  {
    id: 'creative_culture',
    label: '창작·문화형 학교',
    short: '예술, 프로젝트, 축제, 발표 활동으로 학교 색깔을 만드는 노선입니다.',
    goal: '동아리, 성취 발표, 과목 주간 행사를 바탕으로 브랜드 인지도 75 이상 달성',
    weights: { academic: 0.8, wellbeing: 0.9, autonomy: 1.2, community: 1.3, finance: 0.6, admissions: 1, teacher: 0.8, career: 0.9 },
  },
  {
    id: 'research_specialized',
    label: '연구 특성화 학교',
    short: '탐구 프로젝트, 심화 세미나, 연구 트랙 학생을 중심으로 성취를 쌓는 노선입니다.',
    goal: '연구·심화 학생군을 키워 학업 평판과 졸업 준비도를 동시에 끌어올리기',
    weights: { academic: 1.5, wellbeing: 0.7, autonomy: 0.8, community: 0.6, finance: 0.7, admissions: 1, teacher: 1.1, career: 1.3 },
  },
  {
    id: 'community_linked',
    label: '지역사회 연계형 학교',
    short: '지역 프로젝트, 동문, 학부모 신뢰, 공동체 평판을 축으로 삼는 노선입니다.',
    goal: '공동체 평판 75 이상, 동문·지역 프로그램 누적, 입학 신뢰 기반 확보',
    weights: { academic: 0.7, wellbeing: 1, autonomy: 1, community: 1.8, finance: 0.8, admissions: 1, teacher: 0.8, career: 0.9 },
  },
];

export const FESTIVAL_TYPES = [
  { id: 'class_festival', label: '학급 축제', metric: 'community', weeks: 2, budgetCost: 380 },
  { id: 'club_showcase', label: '동아리 발표회', metric: 'autonomy', weeks: 2, budgetCost: 320 },
  { id: 'subject_expo', label: '교과 박람회', metric: 'academic', weeks: 2, budgetCost: 420 },
  { id: 'wellbeing_day', label: '회복 주간', metric: 'welfare', weeks: 1, budgetCost: 260 },
];

export const WEEKLY_EVENT_TEMPLATES = [
  {
    id: 'exam_pressure',
    title: '시험 불안 확산',
    tone: 'warn',
    category: '학생 생활',
    condition: 'exam_or_stress',
    target: 'stress_students',
    summary: '시험 일정과 과제 압박이 겹치며 일부 학생의 불안이 눈에 띄게 올라갑니다.',
    initialEffects: { targetStress: 3, targetSatisfaction: -1, risk: 2, welfare: -1 },
    choices: [
      { id: 'counseling', label: '상담 집중 배치', apCost: 1, budgetCost: 140, result: '상담 인력을 집중 배치해 불안이 높은 학생을 빠르게 안정시켰습니다.', effects: { targetStress: -7, targetHealth: 2, welfare: 1, risk: -2, teacherFatigue: 1 } },
      { id: 'workload', label: '과제량 조정', apCost: 1, budgetCost: 60, result: '과제량을 조정해 전체 스트레스를 낮췄지만 학업 평판 상승세는 조금 둔화됐습니다.', effects: { allStress: -2, allSatisfaction: 1, academic: -1 } },
      { id: 'observe', label: '담임 관찰', apCost: 0, budgetCost: 0, result: '담임 관찰로 비용은 아꼈지만 불안 신호가 일부 남았습니다.', effects: { targetStress: 1, risk: 1 } },
    ],
  },
  {
    id: 'teacher_burnout',
    title: '교사 과부하 경보',
    tone: 'critical',
    category: '교사 조직',
    condition: 'teacher_fatigue',
    target: 'tired_teacher',
    summary: '핵심 교사의 피로가 누적되어 수업 품질과 유지 안정성에 경보가 들어왔습니다.',
    initialEffects: { teacherFatigue: 4, teacherMorale: -3, risk: 2 },
    choices: [
      { id: 'substitute', label: '대체 수업 편성', apCost: 1, budgetCost: 180, result: '대체 수업을 편성해 과부하를 낮추고 수업 공백을 막았습니다.', effects: { teacherFatigue: -9, teacherMorale: 4, academic: 1, risk: -2 } },
      { id: 'peer_support', label: '동료 공동지도', apCost: 1, budgetCost: 90, result: '동료 교사 공동지도로 부담을 나눴습니다.', effects: { teacherFatigue: -5, allTeacherMorale: 1, community: 1, risk: -1 } },
      { id: 'push_through', label: '일정 유지', apCost: 0, budgetCost: 0, result: '일정을 유지했지만 교사 피로와 이탈 위험이 더 커졌습니다.', effects: { teacherFatigue: 3, teacherMorale: -2, risk: 2 } },
    ],
  },
  {
    id: 'facility_complaint',
    title: '시설 민원 접수',
    tone: 'warn',
    category: '시설 안전',
    condition: 'facility_low',
    target: 'weak_facility',
    summary: '낡은 시설에 대한 민원이 들어와 안전 평판과 학교 신뢰가 흔들립니다.',
    initialEffects: { facilityCondition: -3, safety: -2, risk: 3 },
    choices: [
      { id: 'repair', label: '긴급 보수', apCost: 1, budgetCost: 260, result: '긴급 보수로 민원을 빠르게 잠재우고 안전 신뢰를 회복했습니다.', effects: { facilityCondition: 11, safety: 3, risk: -3 } },
      { id: 'notice', label: '개선 일정 공지', apCost: 1, budgetCost: 70, result: '개선 일정을 공개해 불신 확산을 막았습니다.', effects: { facilityCondition: 3, safety: 1, community: 1, risk: -1 } },
      { id: 'defer', label: '다음 주로 이월', apCost: 0, budgetCost: 0, result: '처리를 미루며 시설 불만이 더 누적됐습니다.', effects: { facilityCondition: -2, safety: -1, risk: 2 } },
    ],
  },
  {
    id: 'parent_interest',
    title: '학부모 관심 급증',
    tone: 'good',
    category: '입학 홍보',
    condition: 'admissions_window',
    target: 'admissions',
    summary: '최근 공개 활동과 평판이 학부모 커뮤니티에서 회자되며 문의가 늘었습니다.',
    initialEffects: { applications: 3, brand: 2, inboundInterest: 2 },
    choices: [
      { id: 'open_house', label: '입학 설명회 개최', apCost: 1, budgetCost: 180, result: '입학 설명회가 성공해 지원자와 신입생 질이 함께 올랐습니다.', effects: { applications: 8, brand: 3, inboundInterest: 4, intakeQuality: 2 } },
      { id: 'online_pack', label: '온라인 안내 강화', apCost: 1, budgetCost: 80, result: '온라인 안내를 정비해 적은 비용으로 문의 전환율을 올렸습니다.', effects: { applications: 4, brand: 2, inboundInterest: 2 } },
      { id: 'no_extra', label: '기존 홍보 유지', apCost: 0, budgetCost: 0, result: '추가 대응 없이 자연 유입만 받았습니다.', effects: { applications: 1, inboundInterest: 1 } },
    ],
  },
  {
    id: 'club_momentum',
    title: '동아리 자치 탄력',
    tone: 'good',
    category: '학생 자치',
    condition: 'club_active',
    target: 'club_students',
    summary: '동아리 활동이 학생들 사이에서 좋은 분위기를 만들며 자치 참여가 살아납니다.',
    initialEffects: { allSatisfaction: 1, allAutonomy: 1, autonomy: 1, community: 1 },
    choices: [
      { id: 'mini_grant', label: '소액 활동비 지원', apCost: 1, budgetCost: 120, result: '소액 활동비가 동아리 분위기와 자치 참여를 크게 밀어 올렸습니다.', effects: { targetAutonomy: 5, targetSatisfaction: 3, autonomy: 2, community: 1 } },
      { id: 'student_led', label: '학생 주도 발표', apCost: 1, budgetCost: 60, result: '학생 주도 발표로 공동체 평판과 브랜드 신호가 좋아졌습니다.', effects: { targetAutonomy: 3, community: 2, brand: 2 } },
      { id: 'watch', label: '자율 진행', apCost: 0, budgetCost: 0, result: '자율 진행으로 작은 성장만 확보했습니다.', effects: { targetAutonomy: 1, targetSatisfaction: 1 } },
    ],
  },
  {
    id: 'relationship_conflict',
    title: '학급 관계 갈등',
    tone: 'warn',
    category: '관계망',
    condition: 'relationship_low',
    target: 'low_relation_students',
    summary: '학급 내 갈등 조짐이 커져 만족도와 관계 안정성이 흔들립니다.',
    initialEffects: { targetRelation: -4, targetSatisfaction: -2, targetStress: 2, risk: 2 },
    choices: [
      { id: 'mediation', label: '관계 조정 회의', apCost: 1, budgetCost: 120, result: '관계 조정 회의로 갈등 학생들의 관계 안정성을 회복했습니다.', effects: { targetRelation: 8, targetStress: -3, welfare: 1, community: 1, risk: -2 } },
      { id: 'class_project', label: '공동 프로젝트 배정', apCost: 1, budgetCost: 150, result: '공동 프로젝트가 자치와 공동체성을 동시에 끌어올렸습니다.', effects: { targetRelation: 4, targetAutonomy: 3, community: 2, academic: 1 } },
      { id: 'monitor', label: '주의 관찰', apCost: 0, budgetCost: 0, result: '주의 관찰만 진행해 갈등의 확산은 막지 못했습니다.', effects: { targetStress: 1, risk: 1 } },
    ],
  },
];
