const CODING_FEEDBACK_PROFILES = {
  idle: { action: '', cue: '', label: '검수 결과', tone: '' },
  newRun: { action: 'new', cue: 'start', label: '새 현장', tone: 'highlight' },
  deploy: { action: 'deploy', cue: 'deploy', label: '현장 투입', tone: 'highlight' },
  projectApproved: { action: 'project', cue: 'projectApproved', label: '프로젝트 승인', tone: 'success' },
  projectRejected: { action: 'judge', cue: 'projectRejected', label: '프로젝트 반려', tone: 'danger' },
  codePerfect: { action: 'trophy', cue: 'codePerfect', label: '만점 검수', tone: 'champion' },
  codePass: { action: 'confirm', cue: 'codePass', label: '검수 통과', tone: 'success' },
  codeFail: { action: 'code', cue: 'codeFail', label: '검수 실패', tone: 'danger' },
  taskSelect: { action: 'task-select', cue: 'taskSelect', label: '과제 전환', tone: 'highlight' },
  taskReset: { action: 'reset', cue: 'taskReset', label: '과제 초기화', tone: 'warning' },
  documentReview: { action: 'document-review', cue: 'documentReview', label: '문서 검토', tone: 'success' },
  documentReviewUndo: { action: 'document-unreview', cue: 'documentReviewUndo', label: '검토 취소', tone: 'warning' },
  hintOpen: { action: 'hint', cue: 'hintOpen', label: '힌트 공개', tone: 'warning' },
  supportHint: { action: 'support-hint', cue: 'supportHint', label: '힌트 비용 지원', tone: 'highlight' },
  supportRisk: { action: 'support-risk', cue: 'supportRisk', label: 'QA 리스크 완충', tone: 'success' },
  projectSelect: { action: 'project-select', cue: 'projectSelect', label: '차기 현장 선택', tone: 'highlight' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /로그인|저장.*실패|불러오기.*실패|전적 기록.*실패|없습니다|부족합니다|할 수 없습니다|유효하지/, force: true, value: { action: 'warning', label: '처리 안내', tone: 'warning' } },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', label: '현장 불러오기', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', label: '현장 저장', tone: 'success' } },
  { pattern: /전적|납품 기록/, force: true, value: { action: 'archive', label: '납품 기록', tone: 'success' } },
  { pattern: /초기화|리셋/, force: true, value: { action: 'reset', label: '과제 초기화', tone: 'warning' } },
  { pattern: /과제.*선택|선택.*과제/, force: true, value: { action: 'target', label: '과제 선택', tone: 'highlight' } },
];

function latestOutcome(state) {
  return Object.entries(state?.taskOutcomes || {})
    .map(([taskId, outcome]) => ({ taskId, ...outcome }))
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))[0] || null;
}

export function siCodingFeedbackSnapshot(state) {
  const outcome = latestOutcome(state);
  const evaluation = state?.projectEvaluations?.[0] || null;
  const supportEntry = state?.companySupport?.entries?.[0] || null;
  return {
    runId: String(state?.runId || ''),
    taskSetId: String(state?.taskSet?.id || ''),
    currentTaskId: String(state?.currentTaskId || ''),
    selectedSeedId: String(state?.selectedSeedId || ''),
    outcomeSignature: outcome ? `${outcome.taskId}:${outcome.score}:${outcome.submittedAt || ''}` : '',
    outcomeScore: Number(outcome?.score || 0),
    evaluationSignature: evaluation ? `${evaluation.createdAt || ''}:${evaluation.grade || ''}` : '',
    evaluationGrade: String(evaluation?.grade || ''),
    hintCount: Object.values(state?.hintUsage || {}).reduce((sum, count) => sum + Number(count || 0), 0),
    reviewedItems: Object.values(state?.documentReviewByTask || {}).reduce(
      (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
      0,
    ),
    supportSpent: Number(state?.companySupport?.totalSpent || 0),
    supportEntryId: String(supportEntry?.id || ''),
    supportAction: String(supportEntry?.action || ''),
    supportTitle: String(supportEntry?.title || ''),
    supportAmount: Number(supportEntry?.amount || 0),
    latestLog: String(state?.log?.[0] || ''),
  };
}

export function siCodingFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = previousValue?.outcomeSignature !== undefined ? previousValue : siCodingFeedbackSnapshot(previousValue);
  const current = currentValue?.outcomeSignature !== undefined ? currentValue : siCodingFeedbackSnapshot(currentValue);
  if (previous.runId !== current.runId) return 'newRun';
  if (previous.taskSetId !== current.taskSetId) return 'deploy';
  if (previous.latestLog !== current.latestLog && /원본 상태로 되돌렸습니다/.test(current.latestLog)) return 'taskReset';
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
  if (previous.currentTaskId !== current.currentTaskId
    || (previous.latestLog !== current.latestLog && /과제를 열었습니다/.test(current.latestLog))) return 'taskSelect';
  if (previous.selectedSeedId !== current.selectedSeedId && current.selectedSeedId) return 'projectSelect';
  if (current.reviewedItems > previous.reviewedItems) return 'documentReview';
  if (current.reviewedItems < previous.reviewedItems) return 'documentReviewUndo';
  if (current.hintCount > previous.hintCount) return 'hintOpen';
  if (current.supportSpent > previous.supportSpent || current.supportEntryId !== previous.supportEntryId) {
    return current.supportAction === 'risk' ? 'supportRisk' : 'supportHint';
  }
  return 'idle';
}

export function siCodingFeedbackCue(previous, current) {
  return CODING_FEEDBACK_PROFILES[siCodingFeedbackTransition(previous, current)]?.cue || '';
}

export function siCodingFeedbackPresentation(previous, current) {
  const key = siCodingFeedbackTransition(previous, current);
  const snapshot = current?.outcomeSignature !== undefined ? current : siCodingFeedbackSnapshot(current);
  const profile = { key, ...CODING_FEEDBACK_PROFILES[key] };
  if (key === 'projectApproved') return { ...profile, label: `프로젝트 ${snapshot.evaluationGrade}등급 승인` };
  if (key === 'projectRejected' && snapshot.evaluationGrade === '보류') return { ...profile, label: '프로젝트 보류', tone: 'warning' };
  if (key === 'codePerfect') return { ...profile, label: `${snapshot.outcomeScore}점 만점 검수` };
  if (key === 'codePass') return { ...profile, label: `${snapshot.outcomeScore}점 검수 통과` };
  if (key === 'codeFail') return { ...profile, label: `${snapshot.outcomeScore}점 검수 실패` };
  if (key === 'taskSelect') return { ...profile, label: `${snapshot.currentTaskId} 과제 전환`, detail: snapshot.latestLog || `${snapshot.currentTaskId} 과제를 열었습니다.` };
  if (key === 'taskReset') return { ...profile, detail: snapshot.latestLog || '현재 과제를 원본 상태로 되돌렸습니다.' };
  if (key === 'documentReview') return { ...profile, label: `문서 검토 ${snapshot.reviewedItems}개`, detail: `문서 검토 항목 ${snapshot.reviewedItems}개를 확인했습니다.` };
  if (key === 'documentReviewUndo') return { ...profile, label: `검토 항목 ${snapshot.reviewedItems}개`, detail: `문서 검토 항목을 해제했습니다. 현재 ${snapshot.reviewedItems}개를 확인했습니다.` };
  if (key === 'supportHint' || key === 'supportRisk') return {
    ...profile,
    detail: `${snapshot.supportTitle || profile.label}에 예비비 ${snapshot.supportAmount}pt를 사용했습니다.`,
  };
  if (key === 'projectSelect') return { ...profile, detail: snapshot.latestLog || '차기 현장 후보를 선택했습니다.' };
  return { ...profile, detail: snapshot.latestLog };
}

export function siCodingResultPresentation(text, fallback = CODING_FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
