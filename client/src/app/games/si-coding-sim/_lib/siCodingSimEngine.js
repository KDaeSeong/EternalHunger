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
  return addLog({
    ...current,
    projectEvaluations: [evaluation, ...current.projectEvaluations].slice(0, 10),
  }, `프로젝트 종료 판정: ${grade}. 제출 ${submittedTasks}/${totalTasks}, 열린 리스크 ${openRiskCount}건.`);
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
