import {
  companySupportSummary,
  getActiveTasks,
  getCurrentTask,
  getDocumentReviewProgress,
  getFileContent,
  getReportText,
  getRevealedHints,
  passiveInsightRows,
  playerProfileSummary,
  portingCompletionReport,
  projectProgressRows,
  projectSeedRoadmap,
  scoreState,
  submissionComparisonReport,
  taskPackAuditReport,
  taskPackRows,
  taskRows,
} from './siCodingSimEngine';
import { buildSubmissionReadiness } from './siCodingSubmissionReadiness';

function filterTaskRows(rows, taskFilters) {
  const query = taskFilters.query.trim().toLowerCase();
  return rows.filter((row) => {
    const searchable = [
      row.id,
      row.projectName,
      row.client,
      row.modeLabel,
      row.difficulty,
      row.status,
      ...(row.tags || []),
    ].join(' ').toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (taskFilters.difficulty !== 'all' && row.difficulty !== taskFilters.difficulty) return false;
    if (taskFilters.status !== 'all' && row.status !== taskFilters.status) return false;
    if (taskFilters.tag !== 'all' && !(row.tags || []).includes(taskFilters.tag)) return false;
    if (taskFilters.capability === 'execution' && !row.executionCount && !row.hiddenExecutionCount && !row.checkCount) return false;
    if (taskFilters.capability === 'document' && !row.documentCount && !row.checkpointCount) return false;
    if (taskFilters.capability === 'hint' && !row.hintCount) return false;
    return true;
  });
}

export function buildSiCodingSimPlayViewModel({
  selectedFileId,
  state,
  taskFilters,
}) {
  const rows = taskRows(state);
  const activeTasks = getActiveTasks(state);
  const packRows = taskPackRows(state);
  const projectRows = projectProgressRows(state);
  const taskTagOptions = Array.from(new Set(rows.flatMap((row) => row.tags || []))).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const filteredRows = filterTaskRows(rows, taskFilters);
  const task = getCurrentTask(state);
  const taskId = task?.id;
  const files = task?.files || [];
  const activeFile = files.find((file) => file.id === selectedFileId) || files[0] || null;
  const activeFileId = activeFile?.id || '';
  const activeContent = activeFileId && taskId ? getFileContent(state, taskId, activeFileId) : '';
  const reportText = taskId ? getReportText(state, taskId) : '';
  const revealedHints = taskId ? getRevealedHints(state, taskId) : [];
  const outcome = taskId ? state.taskOutcomes[taskId] : null;
  const latestEvaluation = state.projectEvaluations[0] || null;
  const score = scoreState(state);
  const documentPlay = task?.documentPlay || null;
  const documentProgress = taskId ? getDocumentReviewProgress(state, taskId) : null;
  const execution = task?.execution || null;
  const profileSummary = playerProfileSummary(state, taskId);
  const insightRows = passiveInsightRows(state, taskId);
  const currentTaskRow = rows.find((row) => row.id === task?.id) || null;
  const support = companySupportSummary(state, taskId);
  const seedRoadmap = projectSeedRoadmap(state);
  const packAudit = taskPackAuditReport(state);
  const submissionComparison = submissionComparisonReport(state);
  const portingCompletion = portingCompletionReport(state);
  const submissionReadiness = buildSubmissionReadiness(task, state, reportText, documentProgress, revealedHints, outcome);
  const canRevealHint = revealedHints.length < (task?.hints?.length || 0);

  return {
    activeContent,
    activeFile,
    activeFileId,
    activeTasks,
    canRevealHint,
    currentTaskRow,
    documentPlay,
    documentProgress,
    execution,
    files,
    filteredRows,
    insightRows,
    latestEvaluation,
    outcome,
    packAudit,
    packRows,
    portingCompletion,
    profileSummary,
    projectRows,
    reportText,
    revealedHints,
    rows,
    score,
    seedRoadmap,
    submissionComparison,
    submissionReadiness,
    support,
    task,
    taskId,
    taskTagOptions,
  };
}
