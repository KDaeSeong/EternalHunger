export const SI_CODING_BGM_SCENES = Object.freeze({
  focus: 'coding-focus',
  docs: 'coding-docs',
  execution: 'coding-execution',
  audit: 'coding-audit',
  risk: 'coding-risk',
  success: 'coding-success',
  delivery: 'coding-delivery',
});

export const SI_CODING_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'focus', theme: SI_CODING_BGM_SCENES.focus, title: '집중 모드', icon: 'coding-ready' }),
  Object.freeze({ scene: 'docs', theme: SI_CODING_BGM_SCENES.docs, title: '명세의 여백', icon: 'document-review' }),
  Object.freeze({ scene: 'execution', theme: SI_CODING_BGM_SCENES.execution, title: '실행 파이프라인', icon: 'coding-submit' }),
  Object.freeze({ scene: 'audit', theme: SI_CODING_BGM_SCENES.audit, title: '리뷰 대기열', icon: 'coding-audit' }),
  Object.freeze({ scene: 'risk', theme: SI_CODING_BGM_SCENES.risk, title: '장애 대응', icon: 'coding-blocked' }),
  Object.freeze({ scene: 'success', theme: SI_CODING_BGM_SCENES.success, title: '그린 빌드', icon: 'coding-test-pass' }),
  Object.freeze({ scene: 'delivery', theme: SI_CODING_BGM_SCENES.delivery, title: '릴리스 완료', icon: 'project' }),
]);

const TAB_SCENES = Object.freeze({
  field: SI_CODING_BGM_SCENES.focus,
  tasks: SI_CODING_BGM_SCENES.focus,
  docs: SI_CODING_BGM_SCENES.docs,
  code: SI_CODING_BGM_SCENES.execution,
  career: SI_CODING_BGM_SCENES.success,
  audit: SI_CODING_BGM_SCENES.audit,
  advanced: SI_CODING_BGM_SCENES.audit,
});

const DOC_RESULTS = new Set(['documentReview', 'documentReviewUndo', 'hintOpen', 'supportHint']);
const EXECUTION_RESULTS = new Set(['taskSelect', 'taskReset', 'deploy']);
const RISK_RESULTS = new Set(['codeFail', 'codingBlocked', 'projectHeld', 'projectRejected']);
const SUCCESS_RESULTS = new Set(['codePass', 'codePerfect', 'supportRisk']);

export function resolveSiCodingBgmScene({
  activeTabId = 'field',
  stamina = 100,
  mentality = 100,
  techDebt = 0,
  outcomeScore = null,
  evaluationGrade = '',
  submittedTasks = 0,
  totalTasks = 0,
} = {}) {
  const score = outcomeScore === null || outcomeScore === undefined
    ? null
    : Number(outcomeScore);
  const grade = String(evaluationGrade || '').toUpperCase();
  const critical = Number(stamina || 0) <= 15
    || Number(mentality || 0) <= 15
    || Number(techDebt || 0) >= 70
    || grade === 'FAIL'
    || (score !== null && Number.isFinite(score) && score < 60);
  if (critical) return SI_CODING_BGM_SCENES.risk;
  if (Number(totalTasks || 0) > 0 && Number(submittedTasks || 0) >= Number(totalTasks || 0)) {
    return SI_CODING_BGM_SCENES.delivery;
  }
  if (grade === 'S' || grade === 'A' || (score !== null && score >= 90)) {
    return SI_CODING_BGM_SCENES.success;
  }
  return TAB_SCENES[activeTabId] || SI_CODING_BGM_SCENES.focus;
}

export function siCodingResultMusic(presentation = {}) {
  const key = String(presentation?.key || '');
  if (RISK_RESULTS.has(key)) return { theme: SI_CODING_BGM_SCENES.risk, durationMs: 12_000 };
  if (SUCCESS_RESULTS.has(key)) {
    return { theme: SI_CODING_BGM_SCENES.success, durationMs: key === 'codePerfect' ? 14_000 : 10_000 };
  }
  if (key === 'projectApproved') return { theme: SI_CODING_BGM_SCENES.delivery, durationMs: 16_000 };
  if (DOC_RESULTS.has(key)) return { theme: SI_CODING_BGM_SCENES.docs, durationMs: 8_000 };
  if (EXECUTION_RESULTS.has(key)) return { theme: SI_CODING_BGM_SCENES.execution, durationMs: 8_000 };
  if (key === 'newRun' || key === 'projectSelect') {
    return { theme: SI_CODING_BGM_SCENES.focus, durationMs: 8_000 };
  }
  return null;
}
