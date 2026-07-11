function latestOutcome(state) {
  return Object.entries(state?.taskOutcomes || {})
    .map(([taskId, outcome]) => ({ taskId, ...outcome }))
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))[0] || null;
}

export function siCodingFeedbackSnapshot(state) {
  const outcome = latestOutcome(state);
  const evaluation = state?.projectEvaluations?.[0] || null;
  return {
    runId: String(state?.runId || ''),
    taskSetId: String(state?.taskSet?.id || ''),
    outcomeSignature: outcome ? `${outcome.taskId}:${outcome.score}:${outcome.submittedAt || ''}` : '',
    outcomeScore: Number(outcome?.score || 0),
    evaluationSignature: evaluation ? `${evaluation.createdAt || ''}:${evaluation.grade || ''}` : '',
    evaluationGrade: String(evaluation?.grade || ''),
    hintCount: Object.values(state?.hintUsage || {}).reduce((sum, count) => sum + Number(count || 0), 0),
    supportSpent: Number(state?.companySupport?.totalSpent || 0),
  };
}

export function siCodingFeedbackCue(previous, current) {
  if (!previous || previous.runId !== current.runId) return '';
  if (previous.taskSetId !== current.taskSetId) return 'deploy';
  if (previous.evaluationSignature !== current.evaluationSignature && current.evaluationSignature) {
    return current.evaluationGrade === 'FAIL' || current.evaluationGrade === '보류'
      ? 'projectRejected'
      : 'projectApproved';
  }
  if (previous.outcomeSignature !== current.outcomeSignature && current.outcomeSignature) {
    if (current.outcomeScore >= 100) return 'codePerfect';
    if (current.outcomeScore >= 75) return 'codePass';
    return 'codeFail';
  }
  if (current.hintCount > previous.hintCount) return 'hintOpen';
  if (current.supportSpent > previous.supportSpent) return 'support';
  return '';
}
