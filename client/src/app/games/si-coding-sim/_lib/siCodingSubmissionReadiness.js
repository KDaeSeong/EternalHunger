import { getFileContent } from './siCodingSimEngine';

function includesReadinessText(source, token) {
  const text = String(token || '');
  if (!text) return true;
  const input = String(source || '');
  return input.includes(text) || input.toLowerCase().includes(text.toLowerCase());
}

function evaluateReadinessRule(rule, source) {
  if (!rule) return false;
  if (rule.type === 'includes') return includesReadinessText(source, rule.value);
  if (rule.type === 'notIncludes') return !includesReadinessText(source, rule.value);
  if (rule.type === 'anyIncludes') return (rule.values || []).some((value) => includesReadinessText(source, value));
  return false;
}

function describeReadinessRule(rule) {
  if (!rule) return '알 수 없는 규칙';
  if (rule.type === 'includes') return `필요: ${rule.value || '-'}`;
  if (rule.type === 'notIncludes') return `제거: ${rule.value || '-'}`;
  if (rule.type === 'anyIncludes') return `후보 중 1개: ${(rule.values || []).slice(0, 3).join(' / ') || '-'}`;
  return rule.value ? String(rule.value) : rule.type || '규칙 확인';
}

export function buildSubmissionReadiness(task, state, reportText, documentProgress, revealedHints, outcome) {
  if (!task) {
    return {
      percent: 0,
      passCount: 0,
      totalCount: 0,
      headline: '과제 없음',
      nextAction: '과제를 먼저 선택하세요.',
      rows: [],
      hintSummary: '0/0',
      reportSummary: '0/0자',
      documentSummary: '-',
    };
  }

  const source = [
    ...((task.files || []).map((file) => getFileContent(state, task.id, file.id))),
    reportText,
  ].join('\n\n');
  const rows = (task.judge?.checks || []).map((check, index) => {
    const rules = check.rules || [];
    const failedRules = rules.filter((rule) => !evaluateReadinessRule(rule, source));
    return {
      id: check.id || `check-${index}`,
      label: check.label || check.title || check.description || `정적 체크 ${index + 1}`,
      detail: failedRules.length
        ? failedRules.slice(0, 2).map(describeReadinessRule).join(' · ')
        : `${rules.length || 0}개 규칙 예상 통과`,
      passed: failedRules.length === 0,
      panel: 'code',
      actionLabel: '코드 보기',
    };
  });

  const reportMinLength = Number(task.reportMinLength || 0);
  if (reportMinLength > 0) {
    const reportLength = reportText.trim().length;
    rows.push({
      id: 'report',
      label: '작업 보고',
      detail: `${reportLength}/${reportMinLength}자${reportLength < reportMinLength ? ' · 수정 내용과 확인 결과를 더 적으세요.' : ''}`,
      passed: reportLength >= reportMinLength,
      panel: 'code',
      actionLabel: '보고 작성',
    });
  }

  if (task.documentPlay && documentProgress) {
    const documentIssues = [
      documentProgress.missingRequiredCount ? `필수 누락 ${documentProgress.missingRequiredCount}개` : '',
      documentProgress.wrongSelectedCount ? `재확인 ${documentProgress.wrongSelectedCount}개` : '',
    ].filter(Boolean);
    rows.push({
      id: 'document',
      label: task.documentPlay.title || '문서 체크',
      detail: documentIssues.length ? documentIssues.join(' · ') : `핵심 요구 ${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}`,
      passed: documentProgress.passed,
      panel: 'document',
      actionLabel: '문서 보기',
    });
  }

  const passCount = rows.filter((row) => row.passed).length;
  const totalCount = rows.length;
  const percent = totalCount ? Math.round((passCount / totalCount) * 100) : 100;
  const firstBlocker = rows.find((row) => !row.passed);
  const hintCount = task.hints?.length || 0;
  const outcomeSummary = outcome ? `최근 검수 ${outcome.score}점` : '아직 검수 전';
  const headline = percent >= 100 ? '제출 예상 통과권' : firstBlocker?.label || '보강 필요';
  const nextAction = firstBlocker
    ? `${firstBlocker.label}: ${firstBlocker.detail}`
    : `${outcomeSummary} · 현재 상태로 검수를 실행해도 됩니다.`;

  return {
    percent,
    passCount,
    totalCount,
    headline,
    nextAction,
    rows,
    hintSummary: `${revealedHints.length}/${hintCount}`,
    reportSummary: `${reportText.trim().length}/${reportMinLength || 0}자`,
    documentSummary: task.documentPlay && documentProgress
      ? `${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}`
      : '-',
  };
}
