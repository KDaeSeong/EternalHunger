import taskPack from '../_data/task-pack-stepAQ_AR.json';
import judgeRules from '../_data/judge-rules.json';

export const GAME_SLUG = 'si-coding-sim';
export const QUICK_SAVE_SLOT = 'si-coding-sim-main';
export const SAVE_VERSION = 'si-coding-sim-v1';

export const TASKS = Array.isArray(taskPack.tasks) ? taskPack.tasks : [];

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
const SUPPORT_STARTING_RESERVE = Math.max(24, Math.round(Number(taskPack.meta?.contractRewardScore || 80) * 0.4));

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
  const firstTask = TASKS[0];
  return {
    runId: options.runId || `si-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    currentTaskId: firstTask?.id || '',
    resources: { ...BASE_RESOURCES },
    workspaceFiles: firstTask ? { [firstTask.id]: createTaskWorkspace(firstTask) } : {},
    reports: {},
    hintUsage: {},
    companySupport: createCompanySupportState(),
    documentReviewByTask: {},
    taskOutcomes: {},
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
    resources: { ...base.resources, ...(value.resources || {}) },
    workspaceFiles: value.workspaceFiles && typeof value.workspaceFiles === 'object' ? value.workspaceFiles : base.workspaceFiles,
    reports: value.reports && typeof value.reports === 'object' ? value.reports : {},
    hintUsage: value.hintUsage && typeof value.hintUsage === 'object' ? value.hintUsage : {},
    companySupport: normalizeCompanySupport(value.companySupport),
    documentReviewByTask: value.documentReviewByTask && typeof value.documentReviewByTask === 'object' ? normalizeDocumentReviewByTask(value.documentReviewByTask) : {},
    taskOutcomes: value.taskOutcomes && typeof value.taskOutcomes === 'object' ? value.taskOutcomes : {},
    projectEvaluations: Array.isArray(value.projectEvaluations) ? value.projectEvaluations : [],
    followUpPlan: value.followUpPlan && typeof value.followUpPlan === 'object' ? value.followUpPlan : null,
    generatedSeeds: Array.isArray(value.generatedSeeds) ? value.generatedSeeds : [],
    selectedSeedId: String(value.selectedSeedId || ''),
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

export function getCurrentTask(state) {
  const current = normalizeState(state);
  return TASKS.find((task) => task.id === current.currentTaskId) || TASKS[0] || null;
}

export function taskRows(state) {
  const current = normalizeState(state);
  return TASKS.map((task) => {
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
  TASKS.forEach((task) => {
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
  const task = TASKS.find((item) => item.id === taskId) || TASKS[0];
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
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || TASKS[0];
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
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
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
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
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
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
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
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
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
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
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
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
  if (!task) return current;
  const outcome = evaluateTask(task, current);
  const previous = current.taskOutcomes[task.id];
  const resources = applyResourceDelta(current.resources, outcome.resourceDelta);
  current = {
    ...current,
    resources,
    taskOutcomes: {
      ...current.taskOutcomes,
      [task.id]: {
        ...outcome,
        submittedAt: new Date().toISOString(),
      },
    },
  };
  const improved = previous ? Math.max(0, outcome.score - Number(previous.score || 0)) : outcome.score;
  return addLog(current, `${task.id} 검수 ${outcome.score}점. ${outcomeStatus(outcome.score)}${improved ? `, 개선 +${improved}` : ''}.`);
}

export function evaluateProjectAction(state) {
  const current = normalizeState(state);
  const outcomes = Object.values(current.taskOutcomes || {});
  const submittedTasks = outcomes.length;
  const totalTasks = TASKS.length;
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

export function getFileContent(state, taskId, fileId) {
  const current = normalizeState(state);
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task || !fileId) return '';
  const workspace = current.workspaceFiles[task.id] || createTaskWorkspace(task);
  return workspace[fileId] ?? '';
}

export function getRevealedHints(state, taskId) {
  const current = normalizeState(state);
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task) return [];
  const revealed = Number(current.hintUsage[task.id] || 0);
  return (task.hints || []).slice(0, revealed);
}

export function getReportText(state, taskId) {
  const current = normalizeState(state);
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
  if (!task) return '';
  return current.reports[task.id] || '';
}

export function getDocumentReviewProgress(state, taskId) {
  const current = normalizeState(state);
  const task = TASKS.find((item) => item.id === taskId) || getCurrentTask(current);
  return buildDocumentReviewProgress(task, current);
}

export function companySupportSummary(state, taskId) {
  const current = normalizeState(state);
  const task = TASKS.find((item) => item.id === (taskId || current.currentTaskId)) || getCurrentTask(current);
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
  const outcomes = Object.values(current.taskOutcomes || {});
  const averageScore = outcomes.length
    ? Math.round(outcomes.reduce((sum, outcome) => sum + Number(outcome.score || 0), 0) / outcomes.length)
    : 0;
  return {
    currentTaskId: current.currentTaskId,
    submittedTasks: outcomes.length,
    totalTasks: TASKS.length,
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
    score: scoreState(current),
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
  if (Number(task.reportMinLength || 0) > 0) {
    results.push({
      label: `작업 보고 ${task.reportMinLength}자 이상`,
      passed: report.trim().length >= Number(task.reportMinLength || 0),
      rules: [{ type: 'reportMinLength', value: task.reportMinLength }],
    });
  }
  const documentResult = buildDocumentReviewResult(task, state);
  if (documentResult) results.push(documentResult);
  const passCount = results.filter((result) => result.passed).length;
  const score = results.length ? Math.round((passCount / results.length) * 100) : 0;
  const riskOpenCount = results.length - passCount;
  const resourceDelta = calculateResourceDelta(task, score, riskOpenCount);
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
  return TASKS.reduce((summary, task) => {
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
  const oldDelta = outcome.resourceDelta || calculateResourceDelta(task, outcome.score, oldRisk);
  const nextRisk = Math.max(0, oldRisk - 1);
  const nextDelta = calculateResourceDelta(task, outcome.score, nextRisk);
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

function calculateResourceDelta(task, score, riskOpenCount) {
  const weight = DIFFICULTY_WEIGHT[task.difficulty] || 1;
  if (score === 100) {
    return {
      stamina: -Math.ceil(5 * weight),
      mentality: -Math.ceil(2 * weight),
      clientTrust: Math.ceil(6 * weight),
      techDebt: -Math.ceil(2 * weight),
    };
  }
  if (score >= 75) {
    return {
      stamina: -Math.ceil(9 * weight),
      mentality: -Math.ceil(5 * weight),
      clientTrust: Math.max(-1, 2 - riskOpenCount),
      techDebt: Math.ceil(4 * weight + riskOpenCount),
    };
  }
  return {
    stamina: -Math.ceil(13 * weight),
    mentality: -Math.ceil(8 * weight),
    clientTrust: -Math.ceil(5 * weight + riskOpenCount),
    techDebt: Math.ceil(8 * weight + riskOpenCount * 2),
  };
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

function createCompanySupportState() {
  return {
    cashReserve: SUPPORT_STARTING_RESERVE,
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
