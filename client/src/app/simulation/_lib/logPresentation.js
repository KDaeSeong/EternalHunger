export const LOG_DETAIL_OPEN_KEY = 'eh_logs_detail_open';

const SUMMARY_LIMIT = 48;

const IMPORTANT_TYPES = new Set(['death', 'day-header', 'night-header', 'error']);
const COMBAT_DETAIL_TYPES = new Set(['combat-detail']);

const IMPORTANT_TEXT_RE = /게임 종료|최후|승리|킬|처치|사망|전원 폭발|서든데스|금지구역 확장|최종 안전구역|제한구역|전설|초월|포스 코어|즉시 제작|후반 제작|1일차 목표|전술 스킬|보스|위클라인|오메가|알파|퍼플 포그|부활|CNOT|안전지대|하이퍼루프|런타임|오류|rare|legend|transcend|kill|death|winner/i;

const LOW_SIGNAL_TEXT_RE = /목표\(|이동:|교전 회피|인터럽트 도주|회복 우선 이동|획득 실패|가방 가득|x0|크레딧 \+|보상 크레딧|폭발 타이머 (?:15|10|5)s|재생: HP|종료$|면역$|저항$|보호막: 피해|드론 호출:|음식 상자|주변을|로테이션|재정비|머무릅니다/i;

const NON_KILL_DEATH_TEXT_RE = /금지구역|제한구역|폭발|폭발 타이머|사냥 중|치명상|시체|소멸|부활|전멸 방지|저장 실패|로드 실패|초기 데이터|런타임|오류|경고|생존자가 아무도|detonation|forbidden|wildlife|hunt|revive|error|failed/i;
const KILL_RESULT_TEXT_RE = /\+1\s*킬|처치|제압|격파/i;
const COMBAT_DETAIL_TEXT_RE = /장비:|무기 스킬|특성:|시그니처:|흡혈|피해:|ER 피해 보정|ER 방어|캐릭터 스킬 광역|보호막: 피해|결정타로|쓰러뜨리고 승리|접전 피해|루팅:|전투 후|교전 회피|도주|추격|반격/i;

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
  if (isCombatDetailLog(log)) return false;
  if (IMPORTANT_TYPES.has(type)) return true;
  if (LOW_SIGNAL_TEXT_RE.test(text)) return false;
  if (type === 'highlight') return true;
  return IMPORTANT_TEXT_RE.test(text);
}

export function isCombatDetailLog(log) {
  const normalized = normalizeLog(log, 0);
  const type = String(normalized?.type || 'system');
  const text = String(normalized?.text || '');
  if (!text.trim()) return false;
  return COMBAT_DETAIL_TYPES.has(type) || COMBAT_DETAIL_TEXT_RE.test(text);
}

export function isKillLog(log) {
  const normalized = normalizeLog(log, 0);
  const type = String(normalized?.type || 'system');
  const text = String(normalized?.text || '');
  if (!text.trim()) return false;
  if (type !== 'death') return false;
  return KILL_RESULT_TEXT_RE.test(text) && !NON_KILL_DEATH_TEXT_RE.test(text);
}

export function getVisibleLogs(logs, { detailed = false, limit = SUMMARY_LIMIT } = {}) {
  const list = (Array.isArray(logs) ? logs : []).map(normalizeLog);
  if (detailed) return list;

  const summary = list.filter(isSummaryLog);
  const base = summary.length ? summary : list;
  return base.slice(-Math.max(1, Number(limit || SUMMARY_LIMIT)));
}

export function getKillLogs(logs, { limit = 0 } = {}) {
  const killLogs = (Array.isArray(logs) ? logs : []).map(normalizeLog).filter(isKillLog);
  const max = Math.max(0, Number(limit || 0));
  return max > 0 ? killLogs.slice(-max) : killLogs;
}

export function getCombatDetailLogs(logs, { limit = 0 } = {}) {
  const detailLogs = (Array.isArray(logs) ? logs : []).map(normalizeLog).filter((log) => isCombatDetailLog(log) || isKillLog(log));
  const max = Math.max(0, Number(limit || 0));
  return max > 0 ? detailLogs.slice(-max) : detailLogs;
}

export function getHiddenLogCount(logs, visibleLogs, { detailed = false } = {}) {
  if (detailed) return 0;
  const total = Array.isArray(logs) ? logs.length : 0;
  const shown = Array.isArray(visibleLogs) ? visibleLogs.length : 0;
  return Math.max(0, total - shown);
}
