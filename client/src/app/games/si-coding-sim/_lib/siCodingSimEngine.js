import taskPackStepU from '../_data/task-pack-stepU.json';
import taskPackStepV from '../_data/task-pack-stepV.json';
import taskPackStepW from '../_data/task-pack-stepW.json';
import taskPackStepX from '../_data/task-pack-stepX.json';
import taskPackStepY from '../_data/task-pack-stepY.json';
import taskPackStepZ from '../_data/task-pack-stepZ.json';
import taskPackStepAAAB from '../_data/task-pack-stepAA_AB.json';
import taskPackStepACAD from '../_data/task-pack-stepAC_AD.json';
import taskPackStepAEAF from '../_data/task-pack-stepAE_AF.json';
import taskPackStepAGAH from '../_data/task-pack-stepAG_AH.json';
import taskPackStepAIAJ from '../_data/task-pack-stepAI_AJ.json';
import taskPackStepAKAL from '../_data/task-pack-stepAK_AL.json';
import taskPackStepAMAN from '../_data/task-pack-stepAM_AN.json';
import taskPackStepAOAP from '../_data/task-pack-stepAO_AP.json';
import taskPack from '../_data/task-pack-stepAQ_AR.json';
import judgeRules from '../_data/judge-rules.json';

export const GAME_SLUG = 'si-coding-sim';
export const QUICK_SAVE_SLOT = 'si-coding-sim-main';
export const SAVE_VERSION = 'si-coding-sim-v1';

const DEFAULT_TASK_PACK_ID = 'stepAQ_AR';

export const TASK_PACKS = [
  { id: 'stepU', label: 'Step U', pack: taskPackStepU },
  { id: 'stepV', label: 'Step V', pack: taskPackStepV },
  { id: 'stepW', label: 'Step W', pack: taskPackStepW },
  { id: 'stepX', label: 'Step X', pack: taskPackStepX },
  { id: 'stepY', label: 'Step Y', pack: taskPackStepY },
  { id: 'stepZ', label: 'Step Z', pack: taskPackStepZ },
  { id: 'stepAA_AB', label: 'Step AA/AB', pack: taskPackStepAAAB },
  { id: 'stepAC_AD', label: 'Step AC/AD', pack: taskPackStepACAD },
  { id: 'stepAE_AF', label: 'Step AE/AF', pack: taskPackStepAEAF },
  { id: 'stepAG_AH', label: 'Step AG/AH', pack: taskPackStepAGAH },
  { id: 'stepAI_AJ', label: 'Step AI/AJ', pack: taskPackStepAIAJ },
  { id: 'stepAK_AL', label: 'Step AK/AL', pack: taskPackStepAKAL },
  { id: 'stepAM_AN', label: 'Step AM/AN', pack: taskPackStepAMAN },
  { id: 'stepAO_AP', label: 'Step AO/AP', pack: taskPackStepAOAP },
  { id: DEFAULT_TASK_PACK_ID, label: 'Step AQ/AR', pack: taskPack },
].map((entry) => ({
  ...entry,
  title: entry.pack?.meta?.title || `SI Coding Sim Prototype ${entry.label}`,
  summary: `${entry.label} task pack`,
  version: entry.pack?.meta?.version || '',
  tasks: Array.isArray(entry.pack?.tasks) ? entry.pack.tasks : [],
  rewardScore: Number(entry.pack?.meta?.contractRewardScore || 0),
}));

const DEFAULT_TASK_PACK = TASK_PACKS.find((entry) => entry.id === DEFAULT_TASK_PACK_ID) || TASK_PACKS[TASK_PACKS.length - 1];

export const TASKS = DEFAULT_TASK_PACK.tasks;

function taskPackById(packId) {
  const key = String(packId || '').trim();
  return TASK_PACKS.find((entry) => entry.id === key) || DEFAULT_TASK_PACK;
}

const BASE_RESOURCES = {
  stamina: 100,
  mentality: 100,
  clientTrust: 50,
  techDebt: 25,
};

const DIFFICULTY_WEIGHT = {
  Easy: 1,
  Normal: 1.25,
  Hard: 1.6,
};

const SUPPORT_ACTIONS = judgeRules.companySupport?.actions || {};

const SUPPORT_ACTION_LABELS = {
  hint: {
    title: '사내 지식베이스 매칭',
    detail: '힌트 비용 1회를 예비비로 보전합니다.',
  },
  risk: {
    title: 'QA 지원 인력 투입',
    detail: '제출 후 열린 리스크 1단계를 줄이고 자원 정산을 되돌립니다.',
  },
};

const CORE_STAT_DEFS = [
  { key: 'analysis', label: '분석력', summary: '요구사항과 관련 파일의 우선순위를 더 빨리 좁힙니다.' },
  { key: 'implementation', label: '구현력', summary: '과제 해결 안정성과 제출 보상을 높입니다.' },
  { key: 'debugging', label: '디버깅', summary: '실패 원인과 위험 지점을 더 잘 짚습니다.' },
  { key: 'refactoring', label: '정리력', summary: '기술부채 증가를 줄이고 재작업 위험을 낮춥니다.' },
  { key: 'testing', label: '테스트 감각', summary: '테스트 관점과 완전 통과 보상을 강화합니다.' },
  { key: 'communication', label: '문서화', summary: '보고 부담을 줄이고 고객 신뢰 손실을 완화합니다.' },
  { key: 'focus', label: '집중력', summary: '긴급 과제와 힌트 사용 부담을 줄입니다.' },
];

const DOMAIN_SKILL_DEFS = [
  { key: 'backend', label: '백엔드' },
  { key: 'database', label: 'DB' },
  { key: 'legacy', label: '레거시' },
  { key: 'algorithm', label: '알고리즘' },
];

const TRAIT_DEFS = {
  requirementDetective: {
    label: '요구사항 탐정',
    description: '문서 체크와 추천 파일 힌트가 더 선명해집니다.',
  },
  hawkEye: {
    label: '매의 눈',
    description: '실패한 파일과 조건을 더 쉽게 추적합니다.',
  },
  testMind: {
    label: '테스트 마인드',
    description: '완전 통과 과제에서 성장과 신뢰 보상이 좋아집니다.',
  },
  legacyArchaeologist: {
    label: '레거시 고고학자',
    description: '레거시/참고 파일이 있는 과제에서 시작 판단이 좋아집니다.',
  },
  hotfixConstitution: {
    label: '핫픽스 체질',
    description: '긴급 수정 과제의 피로와 리스크 부담을 줄입니다.',
  },
  codeSmellHunter: {
    label: '코드 스멜 추적자',
    description: '좋은 제출 이후 기술부채 증가를 조금 더 억제합니다.',
  },
};

const PROJECT_SEED_GROUPS = [
  {
    id: 'recovery',
    label: '복구/핫픽스',
    templates: [
      {
        id: 'SEED-REC-001',
        title: '운영장애 야간 핫픽스',
        client: 'Haneul Steel',
        projectName: 'Legacy Login Recovery Sprint',
        module: '로그인/권한',
        modeLabel: '백엔드+프론트 패치',
        difficulty: 'Hard',
        durationWeeks: 1,
        summary: '배포 직후 장애가 난 로그인/세션 구간을 긴급 수습하는 단기 재투입입니다.',
        primaryDocs: ['장애 원인보고서', '긴급 배포 계획서', '운영 체크리스트'],
        seedDelta: { stamina: -8, mentality: -6, clientTrust: -2, techDebt: 5 },
        riskBias: 'high',
        tags: ['핫픽스', '야간배포', '운영장애'],
      },
      {
        id: 'SEED-REC-002',
        title: '배치 실패 재처리 투입',
        client: 'Cheongram Retail',
        projectName: 'Settlement Batch Rescue',
        module: '정산 배치/모니터링',
        modeLabel: 'SQL+배치 패치',
        difficulty: 'Hard',
        durationWeeks: 2,
        summary: '배치 누락과 재처리를 동시에 잡아야 하는 안정화 중심 재투입입니다.',
        primaryDocs: ['배치 장애보고서', '재처리 절차서', '검증 결과서'],
        seedDelta: { stamina: -7, mentality: -5, clientTrust: -1, techDebt: 4 },
        riskBias: 'high',
        tags: ['배치', '재처리', '장애수습'],
      },
    ],
  },
  {
    id: 'warranty',
    label: '하자보수/안정화',
    templates: [
      {
        id: 'SEED-WAR-001',
        title: 'QA 반려 잔건 정리',
        client: 'Kivotos Academy Office',
        projectName: 'Notice QA Stabilization',
        module: '공지/첨부 팝업',
        modeLabel: '프론트+문서 대응',
        difficulty: 'Normal',
        durationWeeks: 2,
        summary: '남은 QA 반려와 증적 미비를 정리해 납품 후폭풍을 줄이는 안정화 현장입니다.',
        primaryDocs: ['QA 재검수표', '테스트 증적서', '주간보고'],
        seedDelta: { stamina: -5, mentality: -3, clientTrust: 1, techDebt: 2 },
        riskBias: 'mid',
        tags: ['QA', '증적', '안정화'],
      },
      {
        id: 'SEED-WAR-002',
        title: '운영 문의 집중 대응',
        client: 'Haneul Steel',
        projectName: 'Helpdesk Warranty Extension',
        module: '문의 대응/수정 패치',
        modeLabel: '운영지원',
        difficulty: 'Normal',
        durationWeeks: 3,
        summary: '크리티컬 이슈는 줄었지만 잔여 문의가 많아 매뉴얼과 소규모 패치를 병행합니다.',
        primaryDocs: ['문의 대응 로그', '수정 이력서', '운영 매뉴얼'],
        seedDelta: { stamina: -4, mentality: -2, clientTrust: 2, techDebt: 1 },
        riskBias: 'mid',
        tags: ['운영지원', '문의대응', '매뉴얼'],
      },
    ],
  },
  {
    id: 'maintenance',
    label: '유지보수/운영지원',
    templates: [
      {
        id: 'SEED-MNT-001',
        title: '월간 유지보수 전환',
        client: 'Cheongram Retail',
        projectName: 'Partner Admin Maintenance Window',
        module: '거래처 관리/권한',
        modeLabel: 'SQL+관리화면 개선',
        difficulty: 'Normal',
        durationWeeks: 4,
        summary: '질문 대응과 소규모 개선이 혼합된 전형적인 유지보수 현장입니다.',
        primaryDocs: ['월간 점검 보고서', '개선 요청 목록', '릴리즈 노트'],
        seedDelta: { stamina: -3, mentality: -1, clientTrust: 3, techDebt: 1 },
        riskBias: 'low',
        tags: ['유지보수', '월간점검', '소규모개선'],
      },
      {
        id: 'SEED-MNT-002',
        title: '정기점검+소규모 개선',
        client: 'Kivotos Academy Office',
        projectName: 'Notice Operations Support',
        module: '공지/배너/통계',
        modeLabel: '백엔드+리포트',
        difficulty: 'Normal',
        durationWeeks: 4,
        summary: '치명 장애는 적지만 운영 편의성 개선 요청이 꾸준히 들어오는 관리형 현장입니다.',
        primaryDocs: ['정기점검표', '고객 요청서', '릴리즈 확인서'],
        seedDelta: { stamina: -2, mentality: -1, clientTrust: 4, techDebt: 0 },
        riskBias: 'low',
        tags: ['운영지원', '정기점검', '리포트'],
      },
    ],
  },
  {
    id: 'upgrade',
    label: '고도화/추가개발',
    templates: [
      {
        id: 'SEED-UPG-001',
        title: '추가 화면 고도화',
        client: 'Cheongram Retail',
        projectName: 'Partner Workflow Upgrade',
        module: '거래처 승인/검색 고도화',
        modeLabel: '프론트+백엔드 기능추가',
        difficulty: 'Hard',
        durationWeeks: 6,
        summary: '기존 현장을 기반으로 신규 화면과 조회 조건이 늘어나는 전형적 고도화 프로젝트입니다.',
        primaryDocs: ['요구사항 정의서', '상세설계서', '통합 테스트 시나리오'],
        seedDelta: { stamina: -5, mentality: -2, clientTrust: 6, techDebt: 1 },
        riskBias: 'mid',
        tags: ['고도화', '신규화면', '요구사항확장'],
      },
      {
        id: 'SEED-UPG-002',
        title: '배치/성능 개선 2차',
        client: 'Haneul Steel',
        projectName: 'Groupware Performance Upgrade',
        module: '배치/검색 성능',
        modeLabel: 'SQL 튜닝+백엔드 개선',
        difficulty: 'Hard',
        durationWeeks: 5,
        summary: '기존 안정화가 끝난 뒤 성능과 편의성을 함께 끌어올리는 2차 개선 현장입니다.',
        primaryDocs: ['성능 분석서', '튜닝 결과서', '배포 계획서'],
        seedDelta: { stamina: -4, mentality: -2, clientTrust: 5, techDebt: -1 },
        riskBias: 'mid',
        tags: ['성능개선', 'SQL튜닝', '2차개선'],
      },
    ],
  },
  {
    id: 'strategic',
    label: '확장수주/리드투입',
    templates: [
      {
        id: 'SEED-STR-001',
        title: '계열사 표준안 확산',
        client: 'Kivotos Group',
        projectName: 'Shared Portal Standard Rollout',
        module: '표준 공지/첨부/권한',
        modeLabel: '리드+표준화 설계',
        difficulty: 'Hard',
        durationWeeks: 8,
        summary: '기존 성공 사례를 들고 다른 조직에 표준안을 이식하는 확장 수주형 프로젝트입니다.',
        primaryDocs: ['차기 제안서', '표준 설계서', '온보딩 가이드'],
        seedDelta: { stamina: -4, mentality: -1, clientTrust: 8, techDebt: -2 },
        riskBias: 'mid',
        tags: ['확장수주', '표준화', '리드투입'],
      },
      {
        id: 'SEED-STR-002',
        title: '신규 고객사 PoC 제안',
        client: 'Blue Archive Media',
        projectName: 'Content Admin Pilot',
        module: '콘텐츠 관리/다운로드',
        modeLabel: '제안+PoC 개발',
        difficulty: 'Hard',
        durationWeeks: 7,
        summary: '이번 현장 성과를 레퍼런스로 삼아 신규 고객사를 따내는 파일럿 프로젝트입니다.',
        primaryDocs: ['PoC 제안서', '데모 시나리오', '견적 초안'],
        seedDelta: { stamina: -3, mentality: 0, clientTrust: 10, techDebt: -1 },
        riskBias: 'mid',
        tags: ['신규수주', 'PoC', '제안'],
      },
    ],
  },
];

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const pack = taskPackById(options.taskPackId || DEFAULT_TASK_PACK_ID);
  const firstTask = pack.tasks[0];
  return {
    runId: options.runId || `si-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    currentTaskId: firstTask?.id || '',
    activeTasks: [],
    taskSet: {
      id: 'initial',
      packId: pack.id,
      title: pack.title,
      summary: `${pack.label} 원본 task-pack에서 가져온 과제 세트입니다.`,
      sourceSeedId: '',
      rewardScore: pack.rewardScore,
    },
    resources: { ...BASE_RESOURCES },
    workspaceFiles: firstTask ? { [firstTask.id]: createTaskWorkspace(firstTask) } : {},
    reports: {},
    hintUsage: {},
    companySupport: createCompanySupportState(pack.rewardScore),
    documentReviewByTask: {},
    taskOutcomes: {},
    playerProfile: createPlayerProfile(),
    projectEvaluations: [],
    followUpPlan: null,
    generatedSeeds: [],
    selectedSeedId: '',
    log: ['SI 코딩 시뮬레이터 현장이 시작됐습니다. 문서와 코드를 보고 패치한 뒤 검수를 실행하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    activeTasks: Array.isArray(value.activeTasks) && value.activeTasks.length ? value.activeTasks : [],
    taskSet: normalizeTaskSet(value.taskSet),
    resources: { ...base.resources, ...(value.resources || {}) },
    workspaceFiles: value.workspaceFiles && typeof value.workspaceFiles === 'object' ? value.workspaceFiles : base.workspaceFiles,
    reports: value.reports && typeof value.reports === 'object' ? value.reports : {},
    hintUsage: value.hintUsage && typeof value.hintUsage === 'object' ? value.hintUsage : {},
    companySupport: normalizeCompanySupport(value.companySupport),
    documentReviewByTask: value.documentReviewByTask && typeof value.documentReviewByTask === 'object' ? normalizeDocumentReviewByTask(value.documentReviewByTask) : {},
    taskOutcomes: value.taskOutcomes && typeof value.taskOutcomes === 'object' ? value.taskOutcomes : {},
    playerProfile: normalizePlayerProfile(value.playerProfile),
    projectEvaluations: Array.isArray(value.projectEvaluations) ? value.projectEvaluations : [],
    followUpPlan: value.followUpPlan && typeof value.followUpPlan === 'object' ? value.followUpPlan : null,
    generatedSeeds: Array.isArray(value.generatedSeeds) ? value.generatedSeeds : [],
    selectedSeedId: String(value.selectedSeedId || ''),
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

export function getCurrentTask(state) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  return tasks.find((task) => task.id === current.currentTaskId) || tasks[0] || null;
}

export function getActiveTasks(state) {
  return activeTaskList(normalizeState(state));
}

export function taskPackRows(state) {
  const current = normalizeState(state);
  const activePackId = current.activeTasks.length ? '' : current.taskSet?.packId || DEFAULT_TASK_PACK_ID;
  return TASK_PACKS.map((pack) => ({
    id: pack.id,
    label: pack.label,
    title: pack.title,
    version: pack.version,
    taskCount: pack.tasks.length,
    rewardScore: pack.rewardScore,
    selected: pack.id === activePackId,
  }));
}

export function selectTaskPackAction(state, packId) {
  const current = normalizeState(state);
  const pack = taskPackById(packId);
  const firstTask = pack.tasks[0] || null;
  if (!firstTask) return addLog(current, `${pack.label} 과제팩에 표시할 과제가 없습니다.`);
  return addLog({
    ...current,
    activeTasks: [],
    taskSet: {
      id: 'initial',
      packId: pack.id,
      title: pack.title,
      summary: `${pack.label} 원본 task-pack에서 가져온 과제 세트입니다.`,
      sourceSeedId: '',
      rewardScore: pack.rewardScore,
    },
    currentTaskId: firstTask.id,
    resources: { ...BASE_RESOURCES },
    workspaceFiles: { [firstTask.id]: createTaskWorkspace(firstTask) },
    reports: {},
    hintUsage: {},
    companySupport: createCompanySupportState(pack.rewardScore),
    documentReviewByTask: {},
    taskOutcomes: {},
    projectEvaluations: [],
    followUpPlan: null,
    generatedSeeds: [],
    selectedSeedId: '',
  }, `${pack.label} 과제팩으로 전환했습니다. 과제 ${pack.tasks.length}개를 불러왔습니다.`);
}

export function taskRows(state) {
  const current = normalizeState(state);
  return activeTaskList(current).map((task) => {
    const outcome = current.taskOutcomes[task.id] || null;
    const hints = Number(current.hintUsage[task.id] || 0);
    return {
      id: task.id,
      projectName: task.projectName,
      client: task.client,
      difficulty: task.difficulty,
      modeLabel: task.modeLabel,
      tags: task.tags || [],
      score: outcome?.score ?? null,
      status: outcome ? outcomeStatus(outcome.score) : '미제출',
      hints,
      hintCount: Array.isArray(task.hints) ? task.hints.length : 0,
      documentCount: Array.isArray(task.documents) ? task.documents.length : 0,
      checkpointCount: Array.isArray(task.documentPlay?.reviewItems) ? task.documentPlay.reviewItems.length : 0,
      executionCount: Array.isArray(task.execution?.tests) ? task.execution.tests.length : 0,
      hiddenExecutionCount: Array.isArray(task.execution?.hiddenTests) ? task.execution.hiddenTests.length : 0,
      checkCount: Array.isArray(task.judge?.checks) ? task.judge.checks.length : 0,
    };
  });
}

export function projectProgressRows(state) {
  const current = normalizeState(state);
  const groups = new Map();
  activeTaskList(current).forEach((task) => {
    const projectName = task.projectName || task.client || '미분류 프로젝트';
    if (!groups.has(projectName)) {
      groups.set(projectName, {
        projectName,
        firstTaskId: task.id,
        totalTasks: 0,
        submittedTasks: 0,
        perfectTasks: 0,
        partialTasks: 0,
        riskyTasks: 0,
        documentTasks: 0,
        executionTasks: 0,
        totalScore: 0,
        active: false,
      });
    }
    const group = groups.get(projectName);
    const outcome = current.taskOutcomes[task.id] || null;
    group.totalTasks += 1;
    group.documentTasks += (task.documentPlay || (task.documents || []).length) ? 1 : 0;
    group.executionTasks += (task.execution?.enabled || (task.execution?.tests || []).length) ? 1 : 0;
    group.active = group.active || task.id === current.currentTaskId;
    if (outcome) {
      const score = Number(outcome.score || 0);
      group.submittedTasks += 1;
      group.totalScore += score;
      if (score === 100) group.perfectTasks += 1;
      else if (score >= 75) group.partialTasks += 1;
      else group.riskyTasks += 1;
    }
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    progressPct: Math.round((group.submittedTasks / Math.max(1, group.totalTasks)) * 100),
    averageScore: group.submittedTasks ? Math.round(group.totalScore / group.submittedTasks) : 0,
  }));
}

export function selectTaskAction(state, taskId) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const task = tasks.find((item) => item.id === taskId) || tasks[0];
  if (!task) return current;
  const workspaceFiles = {
    ...current.workspaceFiles,
    [task.id]: current.workspaceFiles[task.id] || createTaskWorkspace(task),
  };
  return addLog({
    ...current,
    currentTaskId: task.id,
    workspaceFiles,
  }, `${task.id} 과제를 열었습니다.`);
}

export function resetTaskAction(state, taskId) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const task = tasks.find((item) => item.id === (taskId || current.currentTaskId)) || tasks[0];
  if (!task) return current;
  return addLog({
    ...current,
    workspaceFiles: {
      ...current.workspaceFiles,
      [task.id]: createTaskWorkspace(task),
    },
    reports: {
      ...current.reports,
      [task.id]: '',
    },
    documentReviewByTask: {
      ...current.documentReviewByTask,
      [task.id]: [],
    },
  }, `${task.id} 작업 파일을 원본 상태로 되돌렸습니다.`);
}

export function updateFileAction(state, taskId, fileId, content) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task || !fileId) return current;
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    workspaceFiles: {
      ...current.workspaceFiles,
      [task.id]: {
        ...(current.workspaceFiles[task.id] || createTaskWorkspace(task)),
        [fileId]: String(content ?? ''),
      },
    },
  };
}

export function updateReportAction(state, taskId, report) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task) return current;
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    reports: {
      ...current.reports,
      [task.id]: String(report ?? ''),
    },
  };
}

export function revealHintAction(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task) return current;
  const hints = Array.isArray(task.hints) ? task.hints : [];
  const revealed = Number(current.hintUsage[task.id] || 0);
  if (revealed >= hints.length) return addLog(current, '이미 모든 힌트를 열었습니다.');
  const support = getTaskSupportUsage(current, task.id);
  const covered = Number(support.hintCredits || 0) > revealed;
  const resources = covered ? current.resources : applyResourceDelta(current.resources, hintCost(task));
  return addLog({
    ...current,
    resources,
    hintUsage: {
      ...current.hintUsage,
      [task.id]: revealed + 1,
    },
  }, `${task.id} 힌트 ${revealed + 1}/${hints.length}을 확인했습니다.${covered ? ' 회사 지원으로 비용을 보전했습니다.' : ''}`);
}

export function applyCompanySupportAction(state, taskId, action) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  const actionKey = String(action || '').trim();
  if (!task || !SUPPORT_ACTION_LABELS[actionKey]) return current;
  const cost = supportCost(task, actionKey);
  if (current.companySupport.cashReserve < cost) {
    return addLog(current, `회사 지원 예비비가 부족합니다. 필요 ${cost}pt, 보유 ${current.companySupport.cashReserve}pt.`);
  }

  if (actionKey === 'hint') {
    return applyHintSupport(current, task, cost);
  }
  if (actionKey === 'risk') {
    return applyRiskSupport(current, task, cost);
  }
  return current;
}

export function toggleDocumentReviewAction(state, taskId, itemId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task || !itemId) return current;
  const validIds = new Set((task.documentPlay?.reviewItems || []).map((item) => item.id));
  if (!validIds.has(itemId)) return current;
  const selected = new Set(current.documentReviewByTask[task.id] || []);
  if (selected.has(itemId)) selected.delete(itemId);
  else selected.add(itemId);
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    documentReviewByTask: {
      ...current.documentReviewByTask,
      [task.id]: Array.from(selected),
    },
  };
}

export function submitTaskAction(state, taskId) {
  let current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task) return current;
  const outcome = evaluateTask(task, current);
  const previous = current.taskOutcomes[task.id];
  const resources = applyResourceDelta(current.resources, outcome.resourceDelta);
  const progress = applyTaskProgress(current.playerProfile, task, previous, outcome);
  current = {
    ...current,
    resources,
    playerProfile: progress.profile,
    taskOutcomes: {
      ...current.taskOutcomes,
      [task.id]: {
        ...outcome,
        submittedAt: new Date().toISOString(),
      },
    },
  };
  if (progress.log.length) {
    current = addLog(current, `성장 적용: ${progress.log.join(', ')}`);
  }
  const improved = previous ? Math.max(0, outcome.score - Number(previous.score || 0)) : outcome.score;
  return addLog(current, `${task.id} 검수 ${outcome.score}점. ${outcomeStatus(outcome.score)}${improved ? `, 개선 +${improved}` : ''}.`);
}

export function evaluateProjectAction(state) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const outcomes = Object.values(current.taskOutcomes || {});
  const submittedTasks = outcomes.length;
  const totalTasks = tasks.length;
  const fullPassCount = outcomes.filter((outcome) => Number(outcome.score || 0) === 100).length;
  const partialCount = outcomes.filter((outcome) => Number(outcome.score || 0) >= 75 && Number(outcome.score || 0) < 100).length;
  const failedCount = outcomes.filter((outcome) => Number(outcome.score || 0) < 75).length;
  const openRiskCount = outcomes.reduce((sum, outcome) => sum + Number(outcome.riskOpenCount || 0), 0);
  const documentMetrics = buildProjectDocumentMetrics(current);
  const documentPenalty = documentMetrics.missingRequiredCount + Math.max(0, documentMetrics.wrongSelectedCount - documentMetrics.allowedWrongCount);
  const resources = current.resources;
  const allSubmitted = submittedTasks === totalTasks;
  let grade = '보류';
  if (allSubmitted) {
    if (resources.stamina <= 15 || resources.mentality <= 15 || resources.clientTrust < 20 || failedCount >= 3 || documentPenalty >= 4) {
      grade = 'FAIL';
    } else if (fullPassCount === totalTasks && resources.clientTrust >= 70 && resources.techDebt <= 35) {
      grade = 'S';
    } else if (failedCount === 0 && openRiskCount <= 1 && documentPenalty === 0 && resources.clientTrust >= 60) {
      grade = 'A';
    } else if (failedCount <= 1 && openRiskCount <= 3 && documentPenalty <= 2) {
      grade = 'B';
    } else {
      grade = 'C';
    }
  }
  const evaluation = {
    createdAt: new Date().toISOString(),
    grade,
    submittedTasks,
    totalTasks,
    fullPassCount,
    partialCount,
    failedCount,
    openRiskCount,
    documentMetrics,
    documentPenalty,
    score: scoreState(current),
    resources: { ...resources },
  };
  const followUpPlan = buildFollowUpPlan(evaluation);
  const generatedSeeds = buildNextProjectSeeds(followUpPlan, evaluation);
  return addLog({
    ...current,
    projectEvaluations: [evaluation, ...current.projectEvaluations].slice(0, 10),
    followUpPlan,
    generatedSeeds,
    selectedSeedId: generatedSeeds[0]?.id || '',
  }, `프로젝트 종료 판정: ${grade}. 제출 ${submittedTasks}/${totalTasks}, 열린 리스크 ${openRiskCount}건.${generatedSeeds.length ? ` 차기 후보 ${generatedSeeds.length}종을 생성했습니다.` : ''}`);
}

export function selectProjectSeedAction(state, seedId) {
  const current = normalizeState(state);
  const key = String(seedId || '').trim();
  const seed = current.generatedSeeds.find((item) => item.id === key);
  if (!seed) return current;
  return addLog({
    ...current,
    selectedSeedId: seed.id,
  }, `차기 현장 후보 [${seed.projectName}]을 선택했습니다.`);
}

export function startSelectedProjectSeedAction(state) {
  const current = normalizeState(state);
  const seed = current.generatedSeeds.find((item) => item.id === current.selectedSeedId) || current.generatedSeeds[0];
  if (!seed) return addLog(current, '시작할 차기 현장 후보가 없습니다.');
  const tasks = buildGeneratedTaskPack(seed);
  const firstTask = tasks[0] || null;
  const career = resolvePlayerCareer(current.playerProfile, current.projectEvaluations);
  const startResources = applyResourceDelta(seed.startResources || BASE_RESOURCES, career.nextStartBonus);
  if (!firstTask) return addLog(current, `${seed.projectName}에서 생성할 과제가 없습니다.`);
  return addLog({
    ...current,
    activeTasks: tasks,
    taskSet: {
      id: `seed-${seed.id}`,
      packId: '',
      title: `${seed.projectName} 차기 현장 세트`,
      summary: `${seed.title} 기반으로 분석, 패치, 문서 과제를 생성했습니다.`,
      sourceSeedId: seed.id,
      seedGroupLabel: seed.seedGroupLabel,
      rewardScore: seed.rewardScore,
      careerRankTitle: career.rankTitle,
      careerReputationLabel: career.reputationLabel,
    },
    currentTaskId: firstTask.id,
    resources: startResources,
    workspaceFiles: { [firstTask.id]: createTaskWorkspace(firstTask) },
    reports: {},
    hintUsage: {},
    companySupport: createCompanySupportState(seed.rewardScore),
    documentReviewByTask: {},
    taskOutcomes: {},
    projectEvaluations: [],
    followUpPlan: null,
    generatedSeeds: [],
    selectedSeedId: '',
  }, `${seed.projectName} 차기 현장을 시작했습니다. 생성 과제 ${tasks.length}개.`);
}

export function getFileContent(state, taskId, fileId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task || !fileId) return '';
  const workspace = current.workspaceFiles[task.id] || createTaskWorkspace(task);
  return workspace[fileId] ?? '';
}

export function getRevealedHints(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task) return [];
  const revealed = Number(current.hintUsage[task.id] || 0);
  return (task.hints || []).slice(0, revealed);
}

export function getReportText(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task) return '';
  return current.reports[task.id] || '';
}

export function getDocumentReviewProgress(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === taskId) || getCurrentTask(current);
  return buildDocumentReviewProgress(task, current);
}

export function companySupportSummary(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task) {
    return {
      cashReserve: current.companySupport.cashReserve,
      totalSpent: current.companySupport.totalSpent,
      entries: current.companySupport.entries,
      actions: [],
    };
  }
  const usage = getTaskSupportUsage(current, task.id);
  const outcome = current.taskOutcomes[task.id] || null;
  const revealedHints = Number(current.hintUsage[task.id] || 0);
  const hintCostValue = supportCost(task, 'hint');
  const riskCostValue = supportCost(task, 'risk');
  const openRiskCount = Number(outcome?.riskOpenCount || 0);
  return {
    cashReserve: current.companySupport.cashReserve,
    totalSpent: current.companySupport.totalSpent,
    entries: current.companySupport.entries,
    usage,
    revealedHints,
    openRiskCount,
    actions: [
      {
        key: 'hint',
        title: SUPPORT_ACTION_LABELS.hint.title,
        detail: `${SUPPORT_ACTION_LABELS.hint.detail} 현재 힌트 ${revealedHints}/${task.hints?.length || 0}회, 보전 ${usage.hintCredits || 0}회.`,
        cost: hintCostValue,
        disabled: current.companySupport.cashReserve < hintCostValue || Number(usage.hintCredits || 0) >= Math.max(1, task.hints?.length || 0),
      },
      {
        key: 'risk',
        title: SUPPORT_ACTION_LABELS.risk.title,
        detail: outcome ? `${SUPPORT_ACTION_LABELS.risk.detail} 현재 열린 리스크 ${openRiskCount}건.` : '제출 후 열린 리스크가 생기면 QA 지원을 투입할 수 있습니다.',
        cost: riskCostValue,
        disabled: current.companySupport.cashReserve < riskCostValue || !outcome || openRiskCount <= 0,
      },
    ],
  };
}

export function projectSeedRoadmap(state) {
  const current = normalizeState(state);
  const evaluation = current.projectEvaluations[0] || null;
  const selectedSeed = current.generatedSeeds.find((seed) => seed.id === current.selectedSeedId) || current.generatedSeeds[0] || null;
  return {
    evaluation,
    followUpPlan: current.followUpPlan,
    generatedSeeds: current.generatedSeeds,
    selectedSeed,
    seedGroups: PROJECT_SEED_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      templateCount: group.templates.length,
    })),
  };
}

export function playerProfileSummary(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  const profile = normalizePlayerProfile(current.playerProfile);
  const career = resolvePlayerCareer(profile, current.projectEvaluations);
  const passiveRows = passiveInsightRows(current, task?.id);
  return {
    totalImprovedRuns: profile.totalImprovedRuns,
    perfectRuns: profile.perfectRuns,
    lastProgressLog: profile.lastProgressLog,
    career,
    statRows: CORE_STAT_DEFS.map((item) => ({
      ...item,
      level: profile.coreStats[item.key] || 0,
      xp: profile.coreXp[item.key] || 0,
    })),
    domainRows: DOMAIN_SKILL_DEFS.map((item) => ({
      ...item,
      level: profile.domainSkills[item.key] || 0,
      xp: profile.domainXp[item.key] || 0,
    })),
    traitRows: Object.entries(TRAIT_DEFS).map(([key, item]) => ({
      key,
      ...item,
      unlocked: profile.unlockedTraits.includes(key),
    })),
    passiveRows,
  };
}

export function passiveInsightRows(state, taskId) {
  const current = normalizeState(state);
  const task = activeTaskList(current).find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task) return [];
  const profile = normalizePlayerProfile(current.playerProfile);
  const rows = [];
  const recommendedFile = getRecommendedFile(task, profile);
  if (recommendedFile) {
    rows.push({ id: 'recommended-file', label: '추천 시작 파일', detail: recommendedFile.path || recommendedFile.name || recommendedFile.id });
  }
  const effectiveReportMinLength = getEffectiveReportMinLength(task, current);
  if (effectiveReportMinLength !== Number(task.reportMinLength || 0)) {
    rows.push({ id: 'report-relief', label: '문서화 보정', detail: `보고 최소 길이 ${Number(task.reportMinLength || 0)}자 -> ${effectiveReportMinLength}자` });
  }
  if (profile.unlockedTraits.includes('hotfixConstitution') && isHotfixTask(task)) {
    rows.push({ id: 'hotfix-trait', label: '핫픽스 체질', detail: '긴급 수정 과제의 피로와 기술부채 부담을 줄입니다.' });
  }
  if (profile.unlockedTraits.includes('codeSmellHunter')) {
    rows.push({ id: 'code-smell', label: '코드 스멜 추적자', detail: '부분 성공 이상 제출에서 기술부채 증가를 억제합니다.' });
  }
  Object.entries(task.passiveInsights || {}).forEach(([key, value]) => {
    rows.push({ id: `task-${key}`, label: key, detail: value });
  });
  return rows.slice(0, 8);
}

export function taskPackAuditReport(state) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const rows = tasks.map((task) => {
    const documentCount = Array.isArray(task.documents) ? task.documents.length : 0;
    const checkpointCount = Array.isArray(task.documentPlay?.reviewItems) ? task.documentPlay.reviewItems.length : 0;
    const publicTests = Array.isArray(task.execution?.tests) ? task.execution.tests.length : 0;
    const hiddenTests = Array.isArray(task.execution?.hiddenTests) ? task.execution.hiddenTests.length : 0;
    const staticChecks = Array.isArray(task.judge?.checks) ? task.judge.checks.length : 0;
    const editableFiles = (task.files || []).filter((file) => file.editable !== false).length;
    const hintCount = Array.isArray(task.hints) ? task.hints.length : 0;
    const difficultyWeight = DIFFICULTY_WEIGHT[task.difficulty] || 1.25;
    const coverageScore = Math.min(44, staticChecks * 8 + publicTests * 7 + hiddenTests * 5 + checkpointCount * 4);
    const supportScore = Math.min(24, documentCount * 5 + hintCount * 4 + editableFiles * 3);
    const complexityScore = Math.min(32, Math.round(difficultyWeight * 10 + editableFiles * 4 + checkpointCount * 2 + staticChecks * 2));
    const auditScore = clamp(Math.round(coverageScore + supportScore + complexityScore), 0, 100);
    const blockers = [
      staticChecks + publicTests + hiddenTests === 0 ? '검수 규칙 없음' : '',
      checkpointCount === 0 ? '문서 체크 없음' : '',
      hintCount === 0 ? '힌트 없음' : '',
      editableFiles === 0 ? '수정 파일 없음' : '',
    ].filter(Boolean);
    return {
      id: task.id,
      projectName: task.projectName || task.client || '미분류',
      difficulty: task.difficulty || 'Normal',
      modeLabel: task.modeLabel || 'patch',
      documentCount,
      checkpointCount,
      publicTests,
      hiddenTests,
      staticChecks,
      editableFiles,
      hintCount,
      auditScore,
      blockers,
      status: blockers.length ? '보강 필요' : auditScore >= 80 ? '양호' : auditScore >= 62 ? '점검' : '부족',
    };
  });
  const totalTasks = rows.length;
  const difficultyCounts = rows.reduce((acc, row) => {
    acc[row.difficulty] = Number(acc[row.difficulty] || 0) + 1;
    return acc;
  }, {});
  const averageAuditScore = totalTasks
    ? Math.round(rows.reduce((sum, row) => sum + row.auditScore, 0) / totalTasks)
    : 0;
  const docTaskCount = rows.filter((row) => row.documentCount || row.checkpointCount).length;
  const executionTaskCount = rows.filter((row) => row.publicTests || row.hiddenTests || row.staticChecks).length;
  const hintTaskCount = rows.filter((row) => row.hintCount).length;
  const hardRatio = totalTasks ? Math.round((Number(difficultyCounts.Hard || 0) / totalTasks) * 100) : 0;
  const issueRows = rows
    .filter((row) => row.blockers.length || row.auditScore < 70)
    .sort((a, b) => a.auditScore - b.auditScore || a.id.localeCompare(b.id, 'ko-KR'));
  const warnings = [
    hardRatio >= 55 ? `Hard 비중 ${hardRatio}%로 피로도가 높습니다.` : '',
    docTaskCount < Math.ceil(totalTasks * 0.45) ? '문서 체크 과제가 부족합니다.' : '',
    executionTaskCount < totalTasks ? '실행/정적 검수 없는 과제가 있습니다.' : '',
    hintTaskCount < totalTasks ? '힌트가 없는 과제가 있습니다.' : '',
    issueRows.length ? `보강 후보 ${issueRows.length}개가 있습니다.` : '',
  ].filter(Boolean);
  const selectedPack = current.activeTasks.length ? null : taskPackById(current.taskSet?.packId || DEFAULT_TASK_PACK_ID);
  return {
    title: current.taskSet?.title || selectedPack?.title || 'SI Coding Sim 과제팩',
    packLabel: current.activeTasks.length ? '생성 현장' : selectedPack?.label || '',
    totalTasks,
    averageAuditScore,
    docTaskCount,
    executionTaskCount,
    hintTaskCount,
    hardRatio,
    difficultyCounts,
    issueRows,
    rows,
    warnings,
    grade: averageAuditScore >= 85 && !warnings.length ? 'A' : averageAuditScore >= 75 ? 'B' : averageAuditScore >= 62 ? 'C' : 'D',
  };
}

export function submissionComparisonReport(state) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const outcomes = Object.values(current.taskOutcomes || {});
  const submittedTasks = outcomes.length;
  const totalTasks = tasks.length;
  const averageScore = submittedTasks
    ? Math.round(outcomes.reduce((sum, outcome) => sum + Number(outcome.score || 0), 0) / submittedTasks)
    : 0;
  const fullPassCount = outcomes.filter((outcome) => Number(outcome.score || 0) === 100).length;
  const riskOpenCount = outcomes.reduce((sum, outcome) => sum + Number(outcome.riskOpenCount || 0), 0);
  const documentMetrics = buildProjectDocumentMetrics(current);
  const documentPenalty = documentMetrics.missingRequiredCount + Math.max(0, documentMetrics.wrongSelectedCount - documentMetrics.allowedWrongCount);
  const completionPct = Math.round((submittedTasks / Math.max(1, totalTasks)) * 100);
  const score = scoreState(current);
  const resourceScore = Math.round(
    Number(current.resources.stamina || 0) * 0.18
    + Number(current.resources.mentality || 0) * 0.18
    + Number(current.resources.clientTrust || 0) * 0.42
    - Number(current.resources.techDebt || 0) * 0.22
  );
  const deliveryScore = clamp(Math.round(
    completionPct * 0.32
    + averageScore * 0.34
    + (fullPassCount / Math.max(1, totalTasks)) * 100 * 0.18
    + resourceScore * 0.16
    - riskOpenCount * 2
    - documentPenalty * 4
  ), 0, 100);
  const benchmarkRows = [
    {
      id: 'community',
      label: '커뮤니티 평균',
      target: 62,
      detail: '절반 이상 제출, 평균 70점대, 리스크 일부 허용',
    },
    {
      id: 'experienced',
      label: '숙련자 기준',
      target: 78,
      detail: '대부분 제출, 문서 누락 0~1개, 열린 리스크 3개 이하',
    },
    {
      id: 'delivery',
      label: '납품 안정권',
      target: 88,
      detail: '전 과제 제출, 평균 90점 이상, 신뢰와 기술부채 안정',
    },
  ].map((row) => ({
    ...row,
    delta: deliveryScore - row.target,
    status: deliveryScore >= row.target ? '도달' : '미달',
  }));
  const metricRows = [
    { id: 'completion', label: '제출률', value: `${submittedTasks}/${totalTasks}`, target: '100%', ok: submittedTasks === totalTasks },
    { id: 'average', label: '평균 점수', value: `${averageScore}점`, target: '90점+', ok: averageScore >= 90 },
    { id: 'perfect', label: '완전 통과', value: `${fullPassCount}/${totalTasks}`, target: '전 과제', ok: fullPassCount === totalTasks },
    { id: 'risk', label: '열린 리스크', value: `${riskOpenCount}건`, target: '3건 이하', ok: riskOpenCount <= 3 },
    { id: 'docs', label: '문서 누락', value: `${documentPenalty}건`, target: '0건', ok: documentPenalty === 0 },
    { id: 'resources', label: '자원 상태', value: `체력 ${current.resources.stamina} / 신뢰 ${current.resources.clientTrust} / 부채 ${current.resources.techDebt}`, target: '신뢰 60+ / 부채 45-', ok: current.resources.clientTrust >= 60 && current.resources.techDebt <= 45 },
  ];
  const recommendations = [
    submittedTasks < totalTasks ? '미제출 과제를 먼저 제출해 비교 표본을 채우세요.' : '',
    averageScore < 90 ? '부분 통과 과제는 실패 규칙부터 다시 확인하는 편이 좋습니다.' : '',
    documentPenalty > 0 ? '문서 체크포인트의 필수 요구와 함정 선택을 재검토하세요.' : '',
    riskOpenCount > 3 ? '회사 지원의 QA 완충을 리스크 큰 과제에 먼저 쓰세요.' : '',
    current.resources.techDebt > 45 ? '기술부채가 높아 다음 현장 시작 자원이 나빠질 수 있습니다.' : '',
  ].filter(Boolean);
  return {
    deliveryScore,
    score,
    submittedTasks,
    totalTasks,
    averageScore,
    fullPassCount,
    riskOpenCount,
    documentPenalty,
    completionPct,
    benchmarkRows,
    metricRows,
    recommendations,
    tier: deliveryScore >= 88 ? '납품 안정권' : deliveryScore >= 78 ? '숙련자권' : deliveryScore >= 62 ? '평균권' : '연습권',
  };
}

export function portingCompletionReport(state) {
  const current = normalizeState(state);
  const audit = taskPackAuditReport(current);
  const comparison = submissionComparisonReport(current);
  const seedRoadmap = projectSeedRoadmap(current);
  const activeTasks = activeTaskList(current);
  const totalSourceTasks = TASK_PACKS.reduce((sum, pack) => sum + pack.tasks.length, 0);
  const executionRows = audit.rows.filter((row) => row.publicTests || row.hiddenTests || row.staticChecks);
  const documentRows = audit.rows.filter((row) => row.documentCount || row.checkpointCount);
  const hardRows = audit.rows.filter((row) => row.difficulty === 'Hard');

  const rows = [
    {
      id: 'source-packs',
      label: '원본 현장팩',
      value: `${TASK_PACKS.length}팩 · ${totalSourceTasks}과제`,
      detail: `현재 현장 ${activeTasks.length}과제를 포함해 Step U~AQ/AR 계열을 전환했습니다.`,
      ready: TASK_PACKS.length >= 10 && totalSourceTasks >= activeTasks.length,
    },
    {
      id: 'browser-sandbox',
      label: '브라우저 샌드박스 판정',
      value: `실행형 ${executionRows.length}/${audit.totalTasks}`,
      detail: `공개 테스트, 숨김 테스트, 정적 문자열 판정을 브라우저 플레이 루프 안에서 재현합니다.`,
      ready: executionRows.length > 0 && audit.averageAuditScore >= 70,
    },
    {
      id: 'community-challenge',
      label: '커뮤니티 챌린지 기준',
      value: `${comparison.benchmarkRows.length}개 기준선`,
      detail: '커뮤니티 평균, 숙련자 기준, 납품 안정권을 전적 기록용 요약과 같은 지표로 비교합니다.',
      ready: comparison.benchmarkRows.length >= 3 && comparison.metricRows.length >= 6,
    },
    {
      id: 'long-term-balance',
      label: '장기 밸런스 확장',
      value: `${seedRoadmap.seedGroups.length}계열 · Hard ${hardRows.length}개`,
      detail: `후속 현장 후보, 회사 지원, 문서/실행 과제 비율을 장기 피로도 기준으로 감시합니다.`,
      ready: seedRoadmap.seedGroups.length >= 4 && documentRows.length > 0 && hardRows.length > 0,
    },
  ];
  const readyRows = rows.filter((row) => row.ready).length;
  const completionPct = Math.round((readyRows / Math.max(1, rows.length)) * 100);
  const recommendations = [
    comparison.completionPct < 100 ? '미제출 과제를 제출하면 커뮤니티 기준선 비교가 더 정확해집니다.' : '',
    audit.warnings.length ? audit.warnings[0] : '',
    seedRoadmap.followUpPlan ? '프로젝트 종료 후 생성된 후보로 장기 밸런스를 계속 확인할 수 있습니다.' : '프로젝트 종료 판정을 실행하면 후속 현장 후보가 열립니다.',
  ].filter(Boolean);

  return {
    completionPct,
    ready: completionPct >= 100,
    headline: `이식 감사 ${completionPct}% · 과제팩 ${TASK_PACKS.length}개 · 납품 ${comparison.deliveryScore}점`,
    rows,
    recommendations: [...new Set(recommendations)].slice(0, 4),
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const outcomes = Object.values(current.taskOutcomes || {});
  const averageScore = outcomes.length
    ? outcomes.reduce((sum, outcome) => sum + Number(outcome.score || 0), 0) / outcomes.length
    : 0;
  return Math.max(0, Math.round(
    averageScore * 18
    + outcomes.length * 120
    + Number(current.resources.clientTrust || 0) * 10
    + Number(current.resources.stamina || 0) * 3
    + Number(current.resources.mentality || 0) * 3
    - Number(current.resources.techDebt || 0) * 7
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const tasks = activeTaskList(current);
  const outcomes = Object.values(current.taskOutcomes || {});
  const averageScore = outcomes.length
    ? Math.round(outcomes.reduce((sum, outcome) => sum + Number(outcome.score || 0), 0) / outcomes.length)
    : 0;
  const profile = normalizePlayerProfile(current.playerProfile);
  const career = resolvePlayerCareer(profile, current.projectEvaluations);
  const taskPack = taskPackById(current.taskSet?.packId || DEFAULT_TASK_PACK_ID);
  const audit = taskPackAuditReport(current);
  const comparison = submissionComparisonReport(current);
  const porting = portingCompletionReport(current);
  return {
    currentTaskId: current.currentTaskId,
    taskPackId: current.activeTasks.length ? current.taskSet?.id || '' : taskPack.id,
    taskPackLabel: current.activeTasks.length ? current.taskSet?.title || '생성 현장' : taskPack.label,
    taskSetTitle: current.taskSet?.title || '',
    submittedTasks: outcomes.length,
    totalTasks: tasks.length,
    averageScore,
    documentMissing: buildProjectDocumentMetrics(current).missingRequiredCount,
    supportReserve: current.companySupport.cashReserve,
    supportSpent: current.companySupport.totalSpent,
    nextSeedCount: current.generatedSeeds.length,
    selectedSeed: current.generatedSeeds.find((seed) => seed.id === current.selectedSeedId)?.projectName || '',
    stamina: current.resources.stamina,
    mentality: current.resources.mentality,
    clientTrust: current.resources.clientTrust,
    techDebt: current.resources.techDebt,
    careerRank: career.rankTitle,
    reputation: career.reputationLabel,
    improvedRuns: profile.totalImprovedRuns,
    perfectRuns: profile.perfectRuns,
    taskPackAuditScore: audit.averageAuditScore,
    taskPackAuditGrade: audit.grade,
    deliveryScore: comparison.deliveryScore,
    deliveryTier: comparison.tier,
    portingCompletionPct: porting.completionPct,
    portingReady: porting.ready,
    score: scoreState(current),
  };
}

function activeTaskList(state) {
  if (Array.isArray(state?.activeTasks) && state.activeTasks.length) return state.activeTasks;
  return taskPackById(state?.taskSet?.packId || DEFAULT_TASK_PACK_ID).tasks;
}

function createPlayerProfile() {
  return {
    coreStats: {
      analysis: 4,
      implementation: 4,
      debugging: 4,
      refactoring: 3,
      testing: 3,
      communication: 3,
      focus: 4,
    },
    coreXp: Object.fromEntries(CORE_STAT_DEFS.map((item) => [item.key, 0])),
    domainSkills: {
      backend: 1,
      database: 1,
      legacy: 0,
      algorithm: 0,
    },
    domainXp: Object.fromEntries(DOMAIN_SKILL_DEFS.map((item) => [item.key, 0])),
    unlockedTraits: [],
    totalImprovedRuns: 0,
    perfectRuns: 0,
    lastProgressLog: [],
  };
}

function normalizePlayerProfile(value) {
  const base = createPlayerProfile();
  const src = value && typeof value === 'object' ? value : {};
  return {
    coreStats: normalizeNumberMap(base.coreStats, src.coreStats, 0, 9),
    coreXp: normalizeNumberMap(base.coreXp, src.coreXp, 0, 999),
    domainSkills: normalizeNumberMap(base.domainSkills, src.domainSkills, 0, 5),
    domainXp: normalizeNumberMap(base.domainXp, src.domainXp, 0, 999),
    unlockedTraits: Array.isArray(src.unlockedTraits)
      ? src.unlockedTraits.map((item) => String(item || '')).filter((item) => TRAIT_DEFS[item])
      : [],
    totalImprovedRuns: Math.max(0, Math.round(Number(src.totalImprovedRuns || 0))),
    perfectRuns: Math.max(0, Math.round(Number(src.perfectRuns || 0))),
    lastProgressLog: Array.isArray(src.lastProgressLog) ? src.lastProgressLog.map((item) => String(item || '')).filter(Boolean).slice(0, 8) : [],
  };
}

function normalizeNumberMap(base, value, min, max) {
  const src = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(base).map(([key, fallback]) => [key, clamp(Number(src[key] ?? fallback), min, max)]));
}

function applyTaskProgress(profileValue, task, previousOutcome, nextOutcome) {
  const profile = normalizePlayerProfile(profileValue);
  const previousScore = Number(previousOutcome?.score || 0);
  const improvedScore = Math.max(0, Number(nextOutcome.score || 0) - previousScore);
  const firstSubmit = !previousOutcome;
  if (!firstSubmit && improvedScore <= 0) {
    return { profile: { ...profile, lastProgressLog: [] }, log: [] };
  }

  const gain = Math.max(1, Math.ceil((firstSubmit ? Math.max(Number(nextOutcome.score || 0), 40) : improvedScore) / 25));
  profile.totalImprovedRuns += 1;
  if (Number(nextOutcome.score || 0) === 100 && previousScore < 100) {
    profile.perfectRuns += 1;
  }

  const log = [];
  const raiseCore = (key, amount) => {
    const count = gainLevel(profile.coreStats, profile.coreXp, key, amount, 9);
    if (count > 0) log.push(`${CORE_STAT_DEFS.find((item) => item.key === key)?.label || key} +${count}`);
  };
  const raiseDomain = (key, amount) => {
    const count = gainLevel(profile.domainSkills, profile.domainXp, key, amount, 5);
    if (count > 0) log.push(`${DOMAIN_SKILL_DEFS.find((item) => item.key === key)?.label || key} +${count}`);
  };

  raiseCore('analysis', gain);
  raiseCore('implementation', gain);
  raiseCore('focus', 1);
  if (taskMatches(task, ['requirements', 'document', 'report', 'notice', 'scope'])) raiseCore('communication', gain);
  if (taskMatches(task, ['hotfix', 'bug', 'fix', 'legacy']) || Number(nextOutcome.score || 0) < 100) raiseCore('debugging', gain);
  if (Number(nextOutcome.score || 0) === 100) {
    raiseCore('testing', gain);
    raiseCore('refactoring', 1);
  }

  if (taskMatches(task, ['backend', 'api', 'service', 'login', 'auth'])) raiseDomain('backend', gain);
  if (taskMatches(task, ['database', 'sql', 'batch', 'db', 'query'])) raiseDomain('database', gain);
  if (taskMatches(task, ['legacy', 'jsp', 'old', 'groupware'])) raiseDomain('legacy', gain);
  if (taskMatches(task, ['algorithm', 'codingtest', 'array', 'sort'])) raiseDomain('algorithm', gain);

  unlockTraitsIfNeeded(profile).forEach((traitKey) => {
    log.push(`특성 해금: ${TRAIT_DEFS[traitKey]?.label || traitKey}`);
  });
  profile.lastProgressLog = log.slice(0, 8);
  return { profile, log: profile.lastProgressLog };
}

function gainLevel(profileSection, xpSection, key, amount, maxLevel) {
  if (!Object.prototype.hasOwnProperty.call(profileSection, key) || !amount) return 0;
  let levelUps = 0;
  xpSection[key] = Math.max(0, Number(xpSection[key] || 0)) + Math.max(0, Number(amount || 0));
  while (profileSection[key] < maxLevel) {
    const threshold = Math.max(2, Number(profileSection[key] || 0) + 2);
    if (xpSection[key] < threshold) break;
    xpSection[key] -= threshold;
    profileSection[key] += 1;
    levelUps += 1;
  }
  return levelUps;
}

function unlockTraitsIfNeeded(profile) {
  const unlocked = [];
  const maybeUnlock = (traitKey, condition) => {
    if (condition && !profile.unlockedTraits.includes(traitKey)) {
      profile.unlockedTraits.push(traitKey);
      unlocked.push(traitKey);
    }
  };
  maybeUnlock('requirementDetective', profile.totalImprovedRuns >= 1 || profile.coreStats.analysis >= 5);
  maybeUnlock('hawkEye', profile.perfectRuns >= 1 || profile.coreStats.debugging >= 5);
  maybeUnlock('testMind', profile.coreStats.testing >= 5);
  maybeUnlock('legacyArchaeologist', profile.domainSkills.legacy >= 1 && profile.totalImprovedRuns >= 2);
  maybeUnlock('hotfixConstitution', profile.coreStats.focus >= 5 && profile.totalImprovedRuns >= 2);
  maybeUnlock('codeSmellHunter', profile.coreStats.refactoring >= 4 && profile.perfectRuns >= 2);
  return unlocked;
}

function resolvePlayerCareer(profileValue, evaluations = []) {
  const profile = normalizePlayerProfile(profileValue);
  const completedProjects = Array.isArray(evaluations) ? evaluations.filter((item) => item.grade && item.grade !== '蹂대쪟').length : 0;
  const successProjects = Array.isArray(evaluations) ? evaluations.filter((item) => ['A', 'S'].includes(item.grade)).length : 0;
  const failProjects = Array.isArray(evaluations) ? evaluations.filter((item) => item.grade === 'FAIL').length : 0;
  const reputationScore = Math.max(-50, profile.totalImprovedRuns * 8 + profile.perfectRuns * 10 + successProjects * 18 - failProjects * 12);
  let rank = { code: 'ENTRY', title: '초급 투입', summary: '첫 현장 결과가 커리어 보정의 기준이 됩니다.' };
  if (reputationScore >= 120 || profile.perfectRuns >= 4) rank = { code: 'PRINCIPAL', title: '수석 / PM 후보', summary: '차기 현장의 시작 자원 보정이 가장 큽니다.' };
  else if (reputationScore >= 80 || profile.perfectRuns >= 3) rank = { code: 'SENIOR', title: '고급 개발자', summary: '어려운 현장에서도 안정적인 시작 보정을 받습니다.' };
  else if (reputationScore >= 50 || successProjects >= 2) rank = { code: 'TROUBLESHOOTER', title: '현장 해결사', summary: '장애 수습과 고도화 연결에서 신뢰를 얻었습니다.' };
  else if (reputationScore >= 25 || completedProjects >= 2) rank = { code: 'MID', title: '중급 개발자', summary: '단순 투입을 넘어 맞는 구간을 스스로 잡기 시작했습니다.' };
  else if (reputationScore >= 8 || completedProjects >= 1 || profile.totalImprovedRuns >= 2) rank = { code: 'JUNIOR', title: '주니어 개발자', summary: '기본 신뢰 보정이 열렸습니다.' };

  return {
    reputationScore,
    reputationLabel: reputationScore >= 90 ? '전략 파트너' : reputationScore >= 45 ? '핵심 협력사' : reputationScore >= 15 ? '안정 운영 벤더' : reputationScore >= 0 ? '일반 협력사' : '위기 거래처',
    completedProjects,
    successProjects,
    failProjects,
    rankCode: rank.code,
    rankTitle: rank.title,
    rankSummary: rank.summary,
    nextStartBonus: resolveCareerBonus(rank.code),
  };
}

function resolveCareerBonus(rankCode) {
  switch (rankCode) {
    case 'PRINCIPAL':
      return { stamina: 5, mentality: 3, clientTrust: 5, techDebt: -2 };
    case 'SENIOR':
      return { stamina: 4, mentality: 2, clientTrust: 4, techDebt: -2 };
    case 'TROUBLESHOOTER':
      return { stamina: 3, mentality: 2, clientTrust: 3, techDebt: -1 };
    case 'MID':
      return { stamina: 2, mentality: 1, clientTrust: 2, techDebt: -1 };
    case 'JUNIOR':
      return { stamina: 1, mentality: 0, clientTrust: 1, techDebt: 0 };
    default:
      return { stamina: 0, mentality: 0, clientTrust: 0, techDebt: 0 };
  }
}

function getEffectiveReportMinLength(task, state) {
  const base = Number(task?.reportMinLength || 0);
  if (!base) return 0;
  const profile = normalizePlayerProfile(state?.playerProfile);
  const relief = Math.min(6, Math.max(0, Number(profile.coreStats.communication || 0) - 3));
  return Math.min(base, Math.max(12, base - relief));
}

function adjustResourceDeltaForProfile(delta, task, score, profileValue) {
  const profile = normalizePlayerProfile(profileValue);
  const next = { ...delta };
  if (profile.coreStats.implementation >= 6 && score >= 75) next.clientTrust += 1;
  if (profile.coreStats.communication >= 5 && next.clientTrust < 0) next.clientTrust += 1;
  if (profile.coreStats.refactoring >= 5 || profile.unlockedTraits.includes('codeSmellHunter')) {
    next.techDebt = Math.max(next.techDebt - 1, score === 100 ? -999 : 0);
  }
  if (profile.unlockedTraits.includes('hotfixConstitution') && isHotfixTask(task)) {
    next.stamina += 1;
    next.mentality += 1;
  }
  if (profile.unlockedTraits.includes('testMind') && score === 100) {
    next.clientTrust += 1;
    next.techDebt -= 1;
  }
  return next;
}

function getRecommendedFile(task, profileValue) {
  const profile = normalizePlayerProfile(profileValue);
  if (profile.coreStats.analysis < 5 && !profile.unlockedTraits.includes('requirementDetective')) return null;
  const editableFiles = (task?.files || []).filter((file) => file.editable !== false);
  if (!editableFiles.length) return null;
  const counts = Object.create(null);
  (task?.judge?.checks || []).forEach((check) => {
    (check.rules || []).forEach((rule) => {
      if (rule.fileId) counts[rule.fileId] = (counts[rule.fileId] || 0) + 1;
    });
  });
  return editableFiles
    .map((file) => ({ file, count: counts[file.id] || 0 }))
    .sort((a, b) => b.count - a.count)[0]?.file || editableFiles[0];
}

function isHotfixTask(task) {
  return taskMatches(task, ['hotfix', 'urgent', 'bug', 'fix', 'patch']);
}

function taskMatches(task, keywords) {
  const source = [
    task?.id,
    task?.projectName,
    task?.client,
    task?.difficulty,
    task?.modeLabel,
    task?.summary,
    ...(task?.tags || []),
    ...(task?.files || []).map((file) => `${file.name || ''} ${file.path || ''} ${file.language || ''}`),
  ].join(' ').toLowerCase();
  return keywords.some((keyword) => source.includes(String(keyword).toLowerCase()));
}

function normalizeTaskSet(value) {
  const src = value && typeof value === 'object' ? value : {};
  const pack = taskPackById(src.packId || DEFAULT_TASK_PACK_ID);
  return {
    id: String(src.id || 'initial'),
    packId: String(src.packId || pack.id),
    title: String(src.title || pack.title),
    summary: String(src.summary || `${pack.label} 원본 task-pack에서 가져온 과제 세트입니다.`),
    sourceSeedId: String(src.sourceSeedId || ''),
    seedGroupLabel: String(src.seedGroupLabel || ''),
    rewardScore: Number(src.rewardScore || pack.rewardScore || 0),
    careerRankTitle: String(src.careerRankTitle || ''),
    careerReputationLabel: String(src.careerReputationLabel || ''),
  };
}

function buildGeneratedTaskPack(seed) {
  const docs = [
    {
      id: 'REQ',
      title: '후속 요구 메모',
      content: `[요청] ${seed.module} 구간에서 다음 단계 작업이 필요합니다. 고객사 ${seed.client} 기준으로 범위와 우선순위를 먼저 잠가 주세요.`,
    },
    {
      id: 'PM',
      title: 'PM 전달사항',
      content: `[내부] ${seed.title} 이후 연결 건입니다. 일정 여유가 크지 않으니 우선순위와 증적을 분명히 남겨 주세요.`,
    },
    {
      id: 'QA',
      title: '검수 기준',
      content: '[검수] 요구 문구가 빠지지 않았는지, 보고가 짧지 않은지, 핵심 문자열이 남아 있는지 확인합니다.',
    },
  ];
  const blueprints = generatedTaskBlueprints(seed, docs);
  return blueprints.map((blueprint, index) => instantiateGeneratedTask(blueprint, seed, index));
}

function generatedTaskBlueprints(seed, docs) {
  if (seed.seedGroupId === 'recovery') {
    return [
      {
        key: 'REC-ANALYSIS',
        modeLabel: '장애 분석 문서',
        difficulty: 'Normal',
        deadline: '오늘 21:00 장애 원인보고',
        summary: `${seed.module} 운영장애를 정리하는 원인보고서 초안을 작성하세요.`,
        goals: ['원인 섹션을 넣는다.', '영향 범위를 적는다.', '즉시 조치와 재발 방지를 구분한다.'],
        documents: docs,
        file: { name: 'incident_report.md', language: 'markdown', content: '# 장애 원인보고서\n\n## 원인\nTODO\n\n## 영향 범위\n- \n\n## 즉시 조치\n- \n\n## 재발 방지\n- \n' },
        checks: [
          generatedCheck('원인 섹션 반영', [{ type: 'includes', value: '## 원인' }, { type: 'notIncludes', value: 'TODO' }]),
          generatedCheck('영향 범위 작성', [{ type: 'includes', value: '## 영향 범위' }, { type: 'anyIncludes', values: ['회원', '사용자', '세션', '로그인'] }]),
          generatedCheck('즉시조치/재발방지 분리', [{ type: 'includes', value: '## 즉시 조치' }, { type: 'includes', value: '## 재발 방지' }]),
        ],
        hints: ['장애 문서는 원인/영향/즉시조치/재발방지를 분리해 두는 게 좋습니다.', '영향 범위에는 실제 사용자나 기능 범위를 적어 두면 판정 문자열을 만족하기 쉽습니다.'],
      },
      {
        key: 'REC-PATCH',
        modeLabel: '핫픽스 패치',
        difficulty: 'Hard',
        deadline: '오늘 22:00 긴급 반영',
        summary: `${seed.module} 구간 null/장애 방어 패치를 넣으세요.`,
        goals: ['fallback 응답을 만든다.', 'status를 ok로 유지한다.', 'legacyAlert 호출을 남기지 않는다.'],
        documents: docs,
        file: { name: 'hotfix_service.js', language: 'javascript', content: "function buildResponse(sessionInfo) {\n  if (!sessionInfo) {\n    legacyAlert('session missing');\n    return {};\n  }\n\n  return {\n    status: 'fail',\n    userId: sessionInfo.userId\n  };\n}\n" },
        checks: [
          generatedCheck('fallback 응답 추가', [{ type: 'anyIncludes', values: ['return buildFallbackResponse()', 'const fallback =', 'let fallback ='] }, { type: 'anyIncludes', values: ['message', 'title', 'body'] }]),
          generatedCheck('status ok 유지', [{ type: 'anyIncludes', values: ["status: 'ok'", 'status: "ok"'] }]),
          generatedCheck('legacyAlert 제거', [{ type: 'notIncludes', value: 'legacyAlert(' }]),
        ],
        hints: ['운영 핫픽스는 구조 개선보다 fallback과 status 유지가 먼저입니다.', 'legacyAlert 문자열이 남아 있으면 실패합니다.'],
      },
      generatedDocumentTask(seed, docs, 'REC-DEPLOY', '배포 체크리스트', '긴급 배포 체크리스트', ['rollback', '스모크', '모니터링']),
    ];
  }

  if (seed.seedGroupId === 'upgrade' || seed.seedGroupId === 'strategic') {
    return [
      generatedDocumentTask(seed, docs, 'SCOPE', seed.seedGroupId === 'strategic' ? '확장 제안서' : '요구사항 범위서', `${seed.module} 범위 문서`, ['표준 API', '공통 컴포넌트', '적용 대상']),
      {
        key: 'SERVICE',
        modeLabel: seed.seedGroupId === 'strategic' ? '표준 API 패치' : '기능 추가 패치',
        difficulty: 'Hard',
        deadline: '금주 개발 완료',
        summary: `${seed.module} 서비스 코드를 보강하세요.`,
        goals: ['null guard', 'READY 또는 ok status', '이력 로그'],
        documents: docs,
        file: { name: seed.seedGroupId === 'strategic' ? 'standard_api.js' : 'WorkflowService.java', language: seed.seedGroupId === 'strategic' ? 'javascript' : 'java', content: "function buildStandardResponse(data) {\n  return {\n    status: 'pending',\n    data: data\n  };\n}\n" },
        checks: [
          generatedCheck('null guard', [{ type: 'anyIncludes', values: ['if (!data)', 'if (data == null)', 'if (dto == null)', 'if(null == dto)'] }]),
          generatedCheck('상태값 정상화', [{ type: 'anyIncludes', values: ["status: 'ok'", 'status: "ok"', 'status", "READY"', 'status", "READY"'] }]),
          generatedCheck('audit log', [{ type: 'anyIncludes', values: ['audit', 'Audit', 'log.info', 'insertHistory'] }]),
        ],
        hints: ['고도화/확장 코드는 null guard와 상태값, 이력 로그가 핵심입니다.', 'audit 또는 log.info 같은 문자열이 있으면 판정이 열립니다.'],
      },
      generatedDocumentTask(seed, docs, 'TEST', seed.seedGroupId === 'strategic' ? '롤아웃 계획서' : '통합 테스트 문서', '검수/확산 계획', ['CASE-', '기대 결과', '롤백']),
    ];
  }

  return [
    generatedDocumentTask(seed, docs, 'TRIAGE', seed.seedGroupId === 'warranty' ? 'QA 증적 정리' : '문의 분류 문서', `${seed.module} 운영 문서`, seed.seedGroupId === 'warranty' ? ['재현 절차', '수정 결과', '증적 링크'] : ['P1', 'P2', '처리 순서']),
    {
      key: 'PATCH',
      modeLabel: seed.seedGroupId === 'warranty' ? '하자보수 SQL 패치' : '관리화면 패치',
      difficulty: seed.difficulty === 'Hard' ? 'Hard' : 'Normal',
      deadline: '내일 14:00 운영 개선 반영',
      summary: `${seed.module} 운영 패치를 보강하세요.`,
      goals: ['필터 조건', '빈 상태 처리', '최신순 정렬'],
      documents: docs,
      file: { name: seed.seedGroupId === 'warranty' ? 'warranty_fix.sql' : 'admin_search.js', language: seed.seedGroupId === 'warranty' ? 'sql' : 'javascript', content: seed.seedGroupId === 'warranty' ? 'SELECT TICKET_ID, STATUS, REG_DT\nFROM QA_TICKET\nWHERE 1=1\nORDER BY TICKET_ID ASC;\n' : "function searchList(keyword) {\n  if (!keyword) {\n    alert('keyword empty');\n    return;\n  }\n\n  return loadItems(keyword);\n}\n" },
      checks: [
        generatedCheck('필수 필터', [{ type: 'anyIncludes', values: ["STATUS = 'DONE'", "DEL_YN = 'N'", 'keyword.trim()', 'safeKeyword'] }]),
        generatedCheck('빈 상태 또는 최신순', [{ type: 'anyIncludes', values: ['renderEmptyState()', 'emptyState', 'ORDER BY REG_DT DESC', 'order by reg_dt desc'] }]),
        generatedCheck('기존 위험 제거', [{ type: 'notIncludes', value: 'ORDER BY TICKET_ID ASC' }]),
      ],
      hints: ['운영 패치는 필터 조건과 빈 상태/정렬을 같이 봐야 합니다.', '기존 위험 문자열이 남아 있으면 실패할 수 있습니다.'],
    },
    generatedDocumentTask(seed, docs, 'REPORT', seed.seedGroupId === 'warranty' ? '릴리즈 노트' : '월간 점검 보고', '운영 보고서', ['변경 사항', '영향 모듈', '확인 완료']),
  ];
}

function generatedDocumentTask(seed, docs, key, modeLabel, title, keywords) {
  return {
    key,
    modeLabel,
    difficulty: 'Normal',
    deadline: '이번 주 완료',
    summary: `${seed.module} 관련 ${title}를 정리하세요.`,
    goals: keywords.map((keyword) => `${keyword} 항목을 남긴다.`),
    documents: docs,
    file: { name: `${key.toLowerCase()}_${seed.id.toLowerCase()}.md`, language: 'markdown', content: `# ${title}\n\n- 작성 예정\n` },
    checks: keywords.map((keyword) => generatedCheck(`${keyword} 확인`, [{ type: 'anyIncludes', values: [keyword, keyword.toLowerCase()] }])),
    hints: [`${title}는 ${keywords.join(', ')} 항목을 빠뜨리지 않는 것이 핵심입니다.`],
  };
}

function instantiateGeneratedTask(blueprint, seed, index) {
  const fileId = `${blueprint.key.toLowerCase()}-file`;
  return {
    id: `${seed.id}-${String(index + 1).padStart(2, '0')}`,
    projectName: seed.projectName,
    client: seed.client,
    difficulty: blueprint.difficulty || seed.difficulty || 'Normal',
    deadline: blueprint.deadline || '이번 주 완료',
    modeLabel: blueprint.modeLabel,
    tags: [...(seed.tags || []), seed.seedGroupLabel, blueprint.modeLabel].filter(Boolean),
    summary: blueprint.summary,
    goals: blueprint.goals || [],
    documents: blueprint.documents || [],
    files: [{
      id: fileId,
      path: blueprint.file?.name || 'task.md',
      role: '수정 대상',
      editable: true,
      language: blueprint.file?.language || 'markdown',
      content: blueprint.file?.content || '',
    }],
    hints: blueprint.hints || [],
    reportMinLength: 24,
    reportPlaceholder: blueprint.reportPlaceholder || '수정한 내용과 확인 결과를 적으세요.',
    judge: {
      checks: (blueprint.checks || []).map((check) => ({
        ...check,
        rules: (check.rules || []).map((rule) => ({ ...rule, fileId })),
      })),
    },
    documentPlay: {
      title: `${blueprint.modeLabel} 문서 확인`,
      summary: '후속 현장 문서에서 핵심 요구를 골라 체크하세요.',
      allowWrongSelections: 1,
      reviewItems: (blueprint.goals || []).map((goal, goalIndex) => ({
        id: `${blueprint.key}-REQ-${goalIndex + 1}`,
        title: goal,
        detail: '후속 현장 핵심 요구',
        required: true,
        sourceDocId: 'REQ',
      })),
    },
    execution: {
      enabled: false,
      tests: [],
      hiddenTests: [],
      entryFileId: fileId,
    },
    passiveInsights: {
      source: seed.projectName,
      kickoff: seed.kickoffFocus,
      pressure: `압박 ${seed.pressure}`,
    },
  };
}

function generatedCheck(label, rules) {
  return {
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    description: label,
    failReason: `${label} 조건이 부족합니다.`,
    rules,
  };
}

function createTaskWorkspace(task) {
  return Object.fromEntries((task.files || []).map((file) => [file.id, String(file.content || '')]));
}

function evaluateTask(task, state) {
  const workspace = state.workspaceFiles[task.id] || createTaskWorkspace(task);
  const report = state.reports[task.id] || '';
  const source = `${Object.values(workspace).join('\n\n')}\n\n${report}`;
  const results = (task.judge?.checks || []).map((check, index) => {
    const passed = (check.rules || []).every((rule) => evaluateRule(rule, source));
    return {
      label: check.label || check.title || `검수 ${index + 1}`,
      passed,
      rules: check.rules || [],
    };
  });
  const effectiveReportMinLength = getEffectiveReportMinLength(task, state);
  if (effectiveReportMinLength > 0) {
    results.push({
      label: `작업 보고 ${task.reportMinLength}자 이상`,
      passed: report.trim().length >= effectiveReportMinLength,
      rules: [{ type: 'reportMinLength', value: effectiveReportMinLength }],
    });
  }
  const documentResult = buildDocumentReviewResult(task, state);
  if (documentResult) results.push(documentResult);
  const passCount = results.filter((result) => result.passed).length;
  const score = results.length ? Math.round((passCount / results.length) * 100) : 0;
  const riskOpenCount = results.length - passCount;
  const resourceDelta = calculateResourceDelta(task, score, riskOpenCount, state);
  return {
    taskId: task.id,
    score,
    passCount,
    totalChecks: results.length,
    riskOpenCount,
    results,
    resourceDelta,
  };
}

function buildDocumentReviewProgress(task, state) {
  const reviewItems = task?.documentPlay?.reviewItems || [];
  const selectedIds = new Set(state?.documentReviewByTask?.[task?.id] || []);
  const requiredItems = reviewItems.filter((item) => item.required);
  const checkedRequired = requiredItems.filter((item) => selectedIds.has(item.id));
  const missingRequired = requiredItems.filter((item) => !selectedIds.has(item.id));
  const wrongSelected = reviewItems.filter((item) => selectedIds.has(item.id) && !item.required);
  const allowWrongSelections = Number(task?.documentPlay?.allowWrongSelections || 0);
  return {
    totalCount: reviewItems.length,
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    requiredCount: requiredItems.length,
    checkedRequiredCount: checkedRequired.length,
    missingRequired,
    missingRequiredCount: missingRequired.length,
    wrongSelected,
    wrongSelectedCount: wrongSelected.length,
    allowWrongSelections,
    passed: missingRequired.length === 0 && wrongSelected.length <= allowWrongSelections,
  };
}

function buildDocumentReviewResult(task, state) {
  if (!task?.documentPlay) return null;
  const progress = buildDocumentReviewProgress(task, state);
  const missingLabels = progress.missingRequired.map((item) => item.title).join(', ');
  const wrongLabels = progress.wrongSelected.map((item) => item.title).join(', ');
  const detailParts = [
    `핵심 요구 ${progress.checkedRequiredCount}/${progress.requiredCount}`,
    progress.missingRequiredCount ? `누락: ${missingLabels}` : '',
    progress.wrongSelectedCount ? `재확인: ${wrongLabels}` : '',
  ].filter(Boolean);
  return {
    label: task.documentPlay.title || '문서 핵심 요구 확인',
    passed: progress.passed,
    resultType: 'document',
    missingRequiredCount: progress.missingRequiredCount,
    wrongSelectedCount: progress.wrongSelectedCount,
    rules: [{ type: 'documentReview', value: detailParts.join(' · ') }],
  };
}

function buildProjectDocumentMetrics(state) {
  const current = normalizeState(state);
  return activeTaskList(current).reduce((summary, task) => {
    if (!task.documentPlay) return summary;
    const progress = buildDocumentReviewProgress(task, current);
    summary.taskCount += 1;
    summary.requiredCount += progress.requiredCount;
    summary.checkedRequiredCount += progress.checkedRequiredCount;
    summary.missingRequiredCount += progress.missingRequiredCount;
    summary.wrongSelectedCount += progress.wrongSelectedCount;
    summary.allowedWrongCount += progress.allowWrongSelections;
    if (progress.passed) summary.passedTaskCount += 1;
    return summary;
  }, {
    taskCount: 0,
    passedTaskCount: 0,
    requiredCount: 0,
    checkedRequiredCount: 0,
    missingRequiredCount: 0,
    wrongSelectedCount: 0,
    allowedWrongCount: 0,
  });
}

function evaluateRule(rule, sourceInput) {
  const source = String(sourceInput || '');
  const lowerSource = source.toLowerCase();
  if (rule.type === 'includes') {
    return includesText(source, lowerSource, rule.value);
  }
  if (rule.type === 'notIncludes') {
    return !includesText(source, lowerSource, rule.value);
  }
  if (rule.type === 'anyIncludes') {
    return (rule.values || []).some((value) => includesText(source, lowerSource, value));
  }
  return false;
}

function includesText(source, lowerSource, value) {
  const text = String(value || '');
  if (!text) return true;
  return source.includes(text) || lowerSource.includes(text.toLowerCase());
}

function hintCost(task) {
  const weight = DIFFICULTY_WEIGHT[task.difficulty] || 1;
  return {
    stamina: -Math.ceil(2 * weight),
    mentality: task.difficulty === 'Hard' ? -1 : 0,
    clientTrust: 0,
    techDebt: Math.ceil(1 * weight),
  };
}

function supportCost(task, action) {
  const byDifficulty = SUPPORT_ACTIONS[action]?.costPtByDifficulty || {};
  return Number(byDifficulty[task?.difficulty] || byDifficulty.Normal || 10);
}

function buildFollowUpPlan(evaluation) {
  if (!evaluation || evaluation.grade === '보류') return null;
  const resources = evaluation.resources || BASE_RESOURCES;
  const trustHigh = resources.clientTrust >= 70;
  const debtLow = resources.techDebt <= 35;
  const debtHigh = resources.techDebt >= 55;
  const strained = resources.stamina <= 30 || resources.mentality <= 30;
  let plan;

  if (evaluation.grade === 'FAIL') {
    plan = {
      code: 'RED-DEPLOY',
      badge: '재투입',
      title: '긴급 하자보수 재투입',
      summary: '프로젝트가 종료되지 못해 같은 고객사로 즉시 재투입됩니다.',
      contract: '무상 안정화 압박',
      nextAssignment: '운영장애 핫픽스 + 원인보고서 제출',
      priority: '운영 복구',
      duration: '5일',
      carryOverDelta: { stamina: -10, mentality: -8, clientTrust: -5, techDebt: 6 },
      actionItems: ['야간 배포 동행', '장애 원인보고서 작성', '미통과 항목 우선 핫픽스'],
      nextFocus: '당장 서비스부터 살리는 단계',
    };
  } else if (evaluation.grade === 'C') {
    plan = {
      code: 'WARRANTY-EXT',
      badge: '연장',
      title: '하자보수 연장 투입',
      summary: '납품은 되었지만 누적 리스크 때문에 안정화 기간이 늘어납니다.',
      contract: '하자보수 연장 2주',
      nextAssignment: 'QA 잔건 정리 + 재작업 회차 소진',
      priority: debtHigh ? '기술부채 감축' : '리스크 정리',
      duration: '2주',
      carryOverDelta: { stamina: -6, mentality: -4, clientTrust: -2, techDebt: 4 },
      actionItems: ['재작업 1순위 항목 재검증', '운영/QA 공용 체크리스트 작성', '고객사 주간보고 재정비'],
      nextFocus: '수습과 신뢰 회복이 먼저인 단계',
    };
  } else if (evaluation.grade === 'B') {
    plan = {
      code: trustHigh ? 'MAINT-PLUS' : 'STABILIZE-B',
      badge: trustHigh ? '유지보수' : '조건부 연장',
      title: trustHigh ? '조건부 유지보수 전환' : '안정화 우선 후속 투입',
      summary: trustHigh ? '잔여 리스크를 조건으로 유지보수 계약 전환을 제안합니다.' : '추가 고도화보다 남은 리스크를 먼저 정리합니다.',
      contract: trustHigh ? '월간 유지보수 전환' : '안정화 1주 + 조건부 추가계약',
      nextAssignment: trustHigh ? '소규모 기능개선 1건 + 문의대응' : '재검수 대응 + 잔여 결함 제거',
      priority: debtHigh ? '리팩토링 병행' : '고객 체감 이슈 정리',
      duration: trustHigh ? '1개월' : '1주',
      carryOverDelta: trustHigh
        ? { stamina: -4, mentality: -2, clientTrust: 4, techDebt: 2 }
        : { stamina: -5, mentality: -3, clientTrust: 1, techDebt: 3 },
      actionItems: trustHigh
        ? ['문의 대응 SLA 정리', '소규모 고도화 범위 합의', '정기점검 리포트 초안 작성']
        : ['QA 반려 포인트 우선 수정', '고객 실무자 재시연 준비', '야간 재배포 체크리스트 점검'],
      nextFocus: trustHigh ? '관계를 계약으로 굳히는 단계' : '납품 후폭풍을 줄이는 단계',
    };
  } else if (evaluation.grade === 'A') {
    const advanced = trustHigh && debtLow && !strained;
    plan = {
      code: advanced ? 'ADVANCE-A' : 'MAINT-A',
      badge: advanced ? '고도화' : '안정 운영',
      title: advanced ? '차기 고도화 우선 제안' : '안정 운영 + 소규모 개선',
      summary: advanced ? '납품 품질이 좋아 다음 고도화 범위를 먼저 논의합니다.' : '안정적인 마무리를 바탕으로 운영 안정화와 소규모 개선이 이어집니다.',
      contract: advanced ? '후속 고도화 우선협상' : '운영지원 1개월',
      nextAssignment: advanced ? '추가 화면 2종 / 배치 개선 / 성능 보완' : '운영 이슈 대응 + 개선요청 소화',
      priority: advanced ? '범위 확장' : '안정 운영',
      duration: advanced ? '6주' : '1개월',
      carryOverDelta: advanced
        ? { stamina: -3, mentality: -1, clientTrust: 8, techDebt: 0 }
        : { stamina: -2, mentality: -1, clientTrust: 5, techDebt: 1 },
      actionItems: advanced
        ? ['추가 요구사항 워크숍 참석', '고도화 견적 초안 검토', '핵심 모듈 선행 분석']
        : ['운영 문의 대응', '소규모 개선 일정 조율', '정기점검 보고'],
      nextFocus: advanced ? '다음 계약을 먹는 단계' : '관리를 잘 이어가는 단계',
    };
  } else {
    plan = {
      code: 'STRATEGIC-S',
      badge: '확장 수주',
      title: '차기 고도화 + 계열사 추천 투입',
      summary: '프로젝트 평판이 좋아 같은 고객사뿐 아니라 다른 조직으로도 제안이 이어집니다.',
      contract: '고도화 + 신규 프로젝트 추천',
      nextAssignment: '핵심 기능 확장 / 신규 계열사 표준화 / 리드 투입',
      priority: '확장 수주',
      duration: '8주',
      carryOverDelta: { stamina: -2, mentality: 0, clientTrust: 12, techDebt: -2 },
      actionItems: ['차기 제안서 작성', '핵심 모듈 표준안 공유', '후임/추가 인력 온보딩'],
      nextFocus: '현장을 넘어서 계정을 키우는 단계',
    };
  }

  const nextStartResources = addResourceDelta(resources, plan.carryOverDelta);
  return {
    ...plan,
    baseGrade: evaluation.grade,
    nextStartResources,
    carryOverSummary: formatResourceDelta(plan.carryOverDelta),
  };
}

function buildNextProjectSeeds(plan, evaluation) {
  if (!plan || !evaluation || evaluation.grade === '보류') return [];
  const groupOrder = resolveSeedGroups(plan.code);
  const groupPriority = Object.fromEntries(groupOrder.map((groupId, index) => [groupId, index]));
  const candidates = groupOrder
    .map((groupId) => PROJECT_SEED_GROUPS.find((group) => group.id === groupId))
    .filter(Boolean)
    .flatMap((group) => group.templates.map((template) => ({
      ...template,
      seedGroupId: group.id,
      seedGroupLabel: group.label,
    })));

  return candidates
    .map((template) => createProjectSeed(template, plan, evaluation, groupPriority))
    .sort((a, b) => b.fitScore - a.fitScore || a.groupPriority - b.groupPriority || a.projectName.localeCompare(b.projectName, 'ko-KR'))
    .slice(0, 3)
    .map((seed, index) => ({
      ...seed,
      recommendation: index === 0 ? '추천' : index === 1 ? '대안' : '예비',
      recommendationReason: index === 0
        ? '현재 종료 판정과 자원 상태 기준 최우선 후보'
        : index === 1
          ? '조건이 맞으면 바로 전환 가능한 차순위 후보'
          : '압박이 커질 때를 대비한 안전 대안',
    }));
}

function resolveSeedGroups(planCode) {
  if (planCode === 'RED-DEPLOY') return ['recovery', 'warranty', 'maintenance'];
  if (planCode === 'WARRANTY-EXT') return ['warranty', 'recovery', 'maintenance'];
  if (planCode === 'STABILIZE-B') return ['warranty', 'maintenance', 'upgrade'];
  if (planCode === 'MAINT-PLUS' || planCode === 'MAINT-A') return ['maintenance', 'upgrade', 'warranty'];
  if (planCode === 'ADVANCE-A') return ['upgrade', 'maintenance', 'strategic'];
  if (planCode === 'STRATEGIC-S') return ['strategic', 'upgrade', 'maintenance'];
  return ['maintenance', 'warranty', 'upgrade'];
}

function createProjectSeed(template, plan, evaluation, groupPriorityMap) {
  const startResources = addResourceDelta(plan.nextStartResources, template.seedDelta);
  const pressure = computeSeedPressure(startResources, template.riskBias);
  const groupPriority = groupPriorityMap[template.seedGroupId] ?? 9;
  const gradeScore = { FAIL: -12, C: -4, B: 4, A: 10, S: 16 }[evaluation.grade] ?? 0;
  const trustScore = Math.floor((Number(startResources.clientTrust || 0) - 50) / 5);
  const debtScore = Math.floor((55 - Number(startResources.techDebt || 0)) / 8);
  const groupScore = {
    recovery: evaluation.grade === 'FAIL' || startResources.clientTrust < 35 ? 16 : -2,
    warranty: evaluation.failedCount || evaluation.openRiskCount > 3 ? 12 : 2,
    maintenance: evaluation.grade === 'B' || evaluation.grade === 'A' ? 10 : 4,
    upgrade: evaluation.grade === 'A' || evaluation.grade === 'S' ? 14 : -4,
    strategic: evaluation.grade === 'S' ? 18 : evaluation.resources?.clientTrust >= 75 ? 8 : -10,
  }[template.seedGroupId] ?? 0;
  const strainPenalty = pressure === '높음' ? -6 : pressure === '보통' ? -2 : 4;
  const fitScore = clamp(50 - groupPriority * 5 + gradeScore + trustScore + debtScore + groupScore + strainPenalty, 0, 100);
  const rewardScore = computeSeedReward(template, evaluation, fitScore);
  return {
    ...template,
    groupPriority,
    fitScore,
    fitBand: fitScore >= 75 ? '높음' : fitScore >= 55 ? '보통' : '낮음',
    pressure,
    startResources,
    rewardScore,
    kickoffFocus: seedKickoffFocus(template, evaluation, pressure),
    startingSummary: `시작 자원 · 체력 ${startResources.stamina} · 멘탈 ${startResources.mentality} · 고객신뢰 ${startResources.clientTrust} · 기술부채 ${startResources.techDebt}`,
    contractSummary: `${template.durationWeeks}주 예상 · ${plan.contract} 이후 연결 · 예상 보상 ${rewardScore}pt`,
    fitReason: `${evaluation.grade} 등급, 고객신뢰 ${evaluation.resources.clientTrust}, 기술부채 ${evaluation.resources.techDebt} 기준 적합도 ${fitScore}점`,
    reason: `${plan.title} 이후 ${template.seedGroupLabel} 성격의 후속 현장이 자연스럽게 이어집니다.`,
  };
}

function computeSeedPressure(resources, riskBias) {
  const strain = (resources.stamina <= 30 ? 1 : 0) + (resources.mentality <= 30 ? 1 : 0) + (resources.clientTrust < 45 ? 1 : 0);
  if (riskBias === 'high' || strain >= 2) return '높음';
  if (riskBias === 'mid' || strain === 1 || resources.techDebt >= 55) return '보통';
  return '낮음';
}

function computeSeedReward(template, evaluation, fitScore) {
  const difficultyBase = { Easy: 48, Normal: 64, Hard: 84 }[template.difficulty] || 60;
  const groupBonus = { recovery: -6, warranty: 0, maintenance: 8, upgrade: 18, strategic: 30 }[template.seedGroupId] || 0;
  const gradeBonus = { FAIL: -12, C: -4, B: 4, A: 10, S: 18 }[evaluation.grade] || 0;
  return Math.max(32, Math.round(difficultyBase + groupBonus + gradeBonus + fitScore * 0.2));
}

function seedKickoffFocus(template, evaluation, pressure) {
  if (template.seedGroupId === 'recovery') return '장애 복구와 원인보고서를 먼저 고정해야 합니다.';
  if (template.seedGroupId === 'warranty') return '재검수 포인트와 증적 정리를 먼저 잡아야 합니다.';
  if (template.seedGroupId === 'maintenance') return pressure === '낮음' ? '문의 대응과 소규모 개선을 병행해 고객 관계를 굳힙니다.' : '운영 안정화부터 잡고 개선 요청은 순차 처리합니다.';
  if (template.seedGroupId === 'upgrade') return evaluation.resources.techDebt <= 45 ? '고도화 범위를 먼저 잠그고 선행 분석 문서를 확보합니다.' : '기술부채를 안고 들어가므로 리팩토링 범위를 함께 협의합니다.';
  return '성과를 레퍼런스로 묶어 제안서와 표준 문서를 먼저 꺼내야 합니다.';
}

function addResourceDelta(resources, delta) {
  return {
    stamina: clamp(Number(resources.stamina || 0) + Number(delta?.stamina || 0), 0, 100),
    mentality: clamp(Number(resources.mentality || 0) + Number(delta?.mentality || 0), 0, 100),
    clientTrust: clamp(Number(resources.clientTrust || 0) + Number(delta?.clientTrust || 0), 0, 100),
    techDebt: clamp(Number(resources.techDebt || 0) + Number(delta?.techDebt || 0), 0, 999),
  };
}

function formatResourceDelta(delta) {
  return ['stamina', 'mentality', 'clientTrust', 'techDebt']
    .map((key) => `${resourceLabel(key)} ${Number(delta?.[key] || 0) >= 0 ? '+' : ''}${Number(delta?.[key] || 0)}`)
    .join(' · ');
}

function resourceLabel(key) {
  if (key === 'stamina') return '체력';
  if (key === 'mentality') return '멘탈';
  if (key === 'clientTrust') return '고객신뢰';
  if (key === 'techDebt') return '기술부채';
  return key;
}

function applyHintSupport(state, task, cost) {
  const support = getTaskSupportUsage(state, task.id);
  const maxCredits = Math.max(1, task.hints?.length || 0);
  if (Number(support.hintCredits || 0) >= maxCredits) {
    return addLog(state, `${task.id}에서는 더 이상 힌트 비용을 보전할 수 없습니다.`);
  }
  const previousCredits = Number(support.hintCredits || 0);
  const revealedHints = Number(state.hintUsage[task.id] || 0);
  const shouldRefundAppliedHint = revealedHints > previousCredits;
  const nextSupport = spendCompanySupport(state.companySupport, task.id, 'hint', cost);
  const nextUsage = {
    ...getTaskSupportUsage({ companySupport: nextSupport }, task.id),
    hintCredits: previousCredits + 1,
  };
  return addLog({
    ...state,
    resources: shouldRefundAppliedHint ? applyResourceDelta(state.resources, invertResourceDelta(hintCost(task))) : state.resources,
    companySupport: setTaskSupportUsage(nextSupport, task.id, nextUsage),
  }, `${task.id} 힌트 비용 1회를 회사 지원으로 보전했습니다.${shouldRefundAppliedHint ? ' 이미 사용한 힌트 비용도 정산했습니다.' : ''}`);
}

function applyRiskSupport(state, task, cost) {
  const outcome = state.taskOutcomes[task.id] || null;
  const oldRisk = Number(outcome?.riskOpenCount || 0);
  if (!outcome || oldRisk <= 0) {
    return addLog(state, `${task.id}에는 완충할 열린 리스크가 없습니다.`);
  }
  const oldDelta = outcome.resourceDelta || calculateResourceDelta(task, outcome.score, oldRisk, state);
  const nextRisk = Math.max(0, oldRisk - 1);
  const nextDelta = calculateResourceDelta(task, outcome.score, nextRisk, state);
  const adjustment = diffResourceDelta(nextDelta, oldDelta);
  const nextSupport = spendCompanySupport(state.companySupport, task.id, 'risk', cost);
  const support = getTaskSupportUsage({ companySupport: nextSupport }, task.id);
  const nextUsage = {
    ...support,
    riskReliefCredits: Number(support.riskReliefCredits || 0) + 1,
  };
  return addLog({
    ...state,
    resources: applyResourceDelta(state.resources, adjustment),
    companySupport: setTaskSupportUsage(nextSupport, task.id, nextUsage),
    taskOutcomes: {
      ...state.taskOutcomes,
      [task.id]: {
        ...outcome,
        riskOpenCount: nextRisk,
        resourceDelta: nextDelta,
        supportReliefCount: Number(outcome.supportReliefCount || 0) + 1,
      },
    },
  }, `${task.id} QA 지원으로 열린 리스크를 ${oldRisk}건에서 ${nextRisk}건으로 줄였습니다.`);
}

function calculateResourceDelta(task, score, riskOpenCount, state = null) {
  const weight = DIFFICULTY_WEIGHT[task.difficulty] || 1;
  let delta;
  if (score === 100) {
    delta = {
      stamina: -Math.ceil(5 * weight),
      mentality: -Math.ceil(2 * weight),
      clientTrust: Math.ceil(6 * weight),
      techDebt: -Math.ceil(2 * weight),
    };
  } else if (score >= 75) {
    delta = {
      stamina: -Math.ceil(9 * weight),
      mentality: -Math.ceil(5 * weight),
      clientTrust: Math.max(-1, 2 - riskOpenCount),
      techDebt: Math.ceil(4 * weight + riskOpenCount),
    };
  } else {
    delta = {
      stamina: -Math.ceil(13 * weight),
      mentality: -Math.ceil(8 * weight),
      clientTrust: -Math.ceil(5 * weight + riskOpenCount),
      techDebt: Math.ceil(8 * weight + riskOpenCount * 2),
    };
  }
  return adjustResourceDeltaForProfile(delta, task, score, state?.playerProfile);
}

function invertResourceDelta(delta) {
  return Object.fromEntries(Object.entries(delta || {}).map(([key, value]) => [key, -Number(value || 0)]));
}

function diffResourceDelta(nextDelta, previousDelta) {
  const keys = new Set([...Object.keys(nextDelta || {}), ...Object.keys(previousDelta || {})]);
  return Object.fromEntries(Array.from(keys).map((key) => [key, Number(nextDelta?.[key] || 0) - Number(previousDelta?.[key] || 0)]));
}

function applyResourceDelta(resources, delta) {
  return {
    stamina: clamp(Number(resources.stamina || 0) + Number(delta.stamina || 0), 0, 100),
    mentality: clamp(Number(resources.mentality || 0) + Number(delta.mentality || 0), 0, 100),
    clientTrust: clamp(Number(resources.clientTrust || 0) + Number(delta.clientTrust || 0), 0, 100),
    techDebt: clamp(Number(resources.techDebt || 0) + Number(delta.techDebt || 0), 0, 999),
  };
}

function createCompanySupportState(rewardScore = DEFAULT_TASK_PACK.rewardScore) {
  return {
    cashReserve: Math.max(24, Math.round(Number(rewardScore || DEFAULT_TASK_PACK.rewardScore || 80) * 0.4)),
    totalSpent: 0,
    usageByTask: {},
    entries: [],
  };
}

function normalizeCompanySupport(value) {
  const base = createCompanySupportState();
  if (!value || typeof value !== 'object') return base;
  const usageByTask = value.usageByTask && typeof value.usageByTask === 'object' ? value.usageByTask : {};
  return {
    cashReserve: clamp(Number(value.cashReserve ?? base.cashReserve), 0, 999),
    totalSpent: Math.max(0, Math.round(Number(value.totalSpent || 0))),
    usageByTask: Object.fromEntries(Object.entries(usageByTask).map(([taskId, usage]) => [taskId, normalizeTaskSupportUsage(usage)])),
    entries: Array.isArray(value.entries) ? value.entries.slice(0, 12) : [],
  };
}

function normalizeTaskSupportUsage(value) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    hintCredits: Math.max(0, Math.round(Number(src.hintCredits || 0))),
    riskReliefCredits: Math.max(0, Math.round(Number(src.riskReliefCredits || 0))),
    spent: Math.max(0, Math.round(Number(src.spent || 0))),
    purchases: Array.isArray(src.purchases) ? src.purchases.slice(0, 8) : [],
  };
}

function getTaskSupportUsage(state, taskId) {
  return normalizeTaskSupportUsage(state?.companySupport?.usageByTask?.[taskId]);
}

function setTaskSupportUsage(companySupport, taskId, usage) {
  return {
    ...companySupport,
    usageByTask: {
      ...(companySupport.usageByTask || {}),
      [taskId]: normalizeTaskSupportUsage(usage),
    },
  };
}

function spendCompanySupport(companySupport, taskId, action, amount) {
  const meta = SUPPORT_ACTION_LABELS[action] || { title: action, detail: '' };
  const usage = getTaskSupportUsage({ companySupport }, taskId);
  const purchase = {
    id: `SUP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    title: meta.title,
    amount,
    detail: meta.detail,
    createdAt: new Date().toISOString(),
  };
  const nextUsage = {
    ...usage,
    spent: Number(usage.spent || 0) + amount,
    purchases: [purchase, ...(usage.purchases || [])].slice(0, 8),
  };
  return setTaskSupportUsage({
    ...companySupport,
    cashReserve: clamp(Number(companySupport.cashReserve || 0) - amount, 0, 999),
    totalSpent: Math.max(0, Math.round(Number(companySupport.totalSpent || 0) + amount)),
    entries: [purchase, ...(companySupport.entries || [])].slice(0, 12),
  }, taskId, nextUsage);
}

function outcomeStatus(score) {
  if (score === 100) return '완벽';
  if (score >= 75) return '부분 통과';
  return '위험';
}

function normalizeDocumentReviewByTask(value) {
  return Object.fromEntries(Object.entries(value || {}).map(([taskId, entry]) => {
    if (Array.isArray(entry)) return [taskId, entry.map((item) => String(item || '').trim()).filter(Boolean)];
    if (entry && typeof entry === 'object' && Array.isArray(entry.selectedIds)) {
      return [taskId, entry.selectedIds.map((item) => String(item || '').trim()).filter(Boolean)];
    }
    return [taskId, []];
  }));
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}
