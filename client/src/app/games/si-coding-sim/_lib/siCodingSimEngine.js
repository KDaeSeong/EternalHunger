import taskPack from '../_data/task-pack-stepAQ_AR.json';

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
    };
  });
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
  const resources = applyResourceDelta(current.resources, hintCost(task));
  return addLog({
    ...current,
    resources,
    hintUsage: {
      ...current.hintUsage,
      [task.id]: revealed + 1,
    },
  }, `${task.id} 힌트 ${revealed + 1}/${hints.length}을 확인했습니다.`);
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
  const resources = current.resources;
  const allSubmitted = submittedTasks === totalTasks;
  let grade = '보류';
  if (allSubmitted) {
    if (resources.stamina <= 15 || resources.mentality <= 15 || resources.clientTrust < 20 || failedCount >= 3) {
      grade = 'FAIL';
    } else if (fullPassCount === totalTasks && resources.clientTrust >= 70 && resources.techDebt <= 35) {
      grade = 'S';
    } else if (failedCount === 0 && openRiskCount <= 1 && resources.clientTrust >= 60) {
      grade = 'A';
    } else if (failedCount <= 1 && openRiskCount <= 3) {
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

function applyResourceDelta(resources, delta) {
  return {
    stamina: clamp(Number(resources.stamina || 0) + Number(delta.stamina || 0), 0, 100),
    mentality: clamp(Number(resources.mentality || 0) + Number(delta.mentality || 0), 0, 100),
    clientTrust: clamp(Number(resources.clientTrust || 0) + Number(delta.clientTrust || 0), 0, 100),
    techDebt: clamp(Number(resources.techDebt || 0) + Number(delta.techDebt || 0), 0, 999),
  };
}

function outcomeStatus(score) {
  if (score === 100) return '완벽';
  if (score >= 75) return '부분 통과';
  return '위험';
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
