export const LOG_DETAIL_OPEN_KEY = 'eh_logs_detail_open';

const SUMMARY_LIMIT = 48;

const IMPORTANT_TYPES = new Set(['death', 'day-header', 'night-header', 'error']);

const IMPORTANT_TEXT_RE = /게임 종료|최후|승리|킬|처치|사망|전원 폭발|서든데스|금지구역 확장|최종 안전구역|제한구역|전설|초월|포스 코어|즉시 제작|후반 제작|1일차 목표|전술 스킬|보스|위클라인|오메가|알파|퍼플 포그|부활|CNOT|안전지대|하이퍼루프|런타임|오류|rare|legend|transcend|kill|death|winner/i;

const LOW_SIGNAL_TEXT_RE = /목표\(|이동:|교전 회피|인터럽트 도주|회복 우선 이동|획득 실패|가방 가득|x0|크레딧 \+|보상 크레딧|폭발 타이머 (?:15|10|5)s|출혈: HP|재생: HP|종료$|면역$|저항$|보호막: 피해|드론 호출:|음식 상자|주변을|발자국|숨을 고르며|머무릅니다/i;

function normalizeLog(log, index) {
  if (log && typeof log === 'object') {
    return {
      ...log,
      text: String(log.text || ''),
      type: String(log.type || 'system'),
      id: log.id || `log-${index}`,
    };
  }
  return {
    text: String(log || ''),
    type: 'system',
    id: `log-${index}`,
  };
}

export function isSummaryLog(log) {
  const type = String(log?.type || 'system');
  const text = String(log?.text || '');
  if (!text.trim()) return false;
  if (IMPORTANT_TYPES.has(type)) return true;
  if (LOW_SIGNAL_TEXT_RE.test(text)) return false;
  if (type === 'highlight') return true;
  return IMPORTANT_TEXT_RE.test(text);
}

export function getVisibleLogs(logs, { detailed = false, limit = SUMMARY_LIMIT } = {}) {
  const list = (Array.isArray(logs) ? logs : []).map(normalizeLog);
  if (detailed) return list;

  const summary = list.filter(isSummaryLog);
  const base = summary.length ? summary : list;
  return base.slice(-Math.max(1, Number(limit || SUMMARY_LIMIT)));
}

export function getHiddenLogCount(logs, visibleLogs, { detailed = false } = {}) {
  if (detailed) return 0;
  const total = Array.isArray(logs) ? logs.length : 0;
  const shown = Array.isArray(visibleLogs) ? visibleLogs.length : 0;
  return Math.max(0, total - shown);
}
