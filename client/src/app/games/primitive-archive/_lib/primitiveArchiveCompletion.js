import { archiveVictorySummary, completeArchiveAction } from './primitiveArchiveEngine';

const COMPLETION_CONFIRMATION = '기초 아카이브를 완성하고 이 런을 종료할까요? 보상이 정산되며, 종료한 런에서는 문명 발전을 더 이어갈 수 없습니다.';

export function requestArchiveCompletion({ getState, ready, busy, confirm, applyAction } = {}) {
  if (!ready || busy || typeof getState !== 'function' || typeof confirm !== 'function'
    || typeof applyAction !== 'function') return false;

  const current = getState();
  if (!archiveVictorySummary(current).canComplete) return false;
  if (!confirm(COMPLETION_CONFIRMATION)) return false;

  applyAction('아카이브 완성', (state) => completeArchiveAction(state));
  return true;
}
