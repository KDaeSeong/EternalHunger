function countEntries(value) {
  return Object.keys(value && typeof value === 'object' ? value : {}).length;
}

function partyHpTotal(state) {
  return (Array.isArray(state?.party) ? state.party : [])
    .reduce((sum, member) => sum + Math.max(0, Number(member?.hp || 0)), 0);
}

export function primitiveMilestoneSnapshot(state, seasonId = '') {
  return {
    runId: String(state?.runId || ''),
    ended: Boolean(state?.ended),
    victory: Boolean(state?.victory),
    discoverySerial: Number(state?.exploration?.discoverySerial || 0),
    projectSerial: Number(state?.projects?.completionSerial || 0),
    researchSerial: Number(state?.research?.completionSerial || 0),
    civicsSerial: Number(state?.civics?.completionSerial || 0),
    eurekaCount: countEntries(state?.research?.eureka),
    inspirationCount: countEntries(state?.civics?.inspiration),
    tribeGrowthSerial: Number(state?.tribe?.growthSerial || 0),
    contactSerial: Number(state?.diplomacy?.contactSerial || 0),
    seasonId: String(seasonId || ''),
  };
}

export function primitiveMilestoneCue(previous, current) {
  if (!previous || !current || previous.runId !== current.runId) return '';
  if (!previous.victory && current.victory) return 'champion';
  if (!previous.ended && current.ended) return 'defeat';
  if (current.projectSerial > previous.projectSerial) return 'projectComplete';
  if (current.civicsSerial > previous.civicsSerial) return 'civicComplete';
  if (current.researchSerial > previous.researchSerial) return 'complete';
  if (current.inspirationCount > previous.inspirationCount) return 'inspiration';
  if (current.eurekaCount > previous.eurekaCount) return 'research';
  if (current.tribeGrowthSerial > previous.tribeGrowthSerial) return 'growth';
  if (current.contactSerial > previous.contactSerial) return 'diplomacy';
  if (current.discoverySerial > previous.discoverySerial) return 'discover';
  if (previous.seasonId && current.seasonId !== previous.seasonId) return 'season';
  return '';
}

const ACTION_RULES = {
  '채집': { action: 'gather', counter: 'gather', cue: 'gather' },
  '사냥': { action: 'combat', counter: 'hunt', cue: 'combat' },
  '제작': { action: 'craft', counter: 'craft', cue: 'craft' },
  '식사': { action: 'consume', counter: 'meals', cue: 'consume' },
  '휴식': { action: 'rest', cue: 'rest' },
  '연구': { action: 'research' },
  '부족 회의': { action: 'policy' },
  '캠프': { action: 'camp', counter: 'camp', cue: 'camp' },
  '부족 프로젝트': { action: 'project' },
  '직접 대응': { action: 'event' },
  '탐험 단서 대응': { action: 'event' },
  '하루 자동 운영': { action: 'auto' },
};

const ACTION_RESULT_PATTERNS = {
  '채집': /채집 (?:성공|실패)/,
  '사냥': /사냥 (?:성공|실패)/,
  '제작': /제작 (?:성공|실패)|제작 재료가 부족/,
  '식사': /먹었습니다|먹을 음식이 없습니다/,
  '휴식': /휴식했습니다/,
  '연구': /연구/,
  '부족 회의': /부족 회의|사회 제도/,
  '캠프': /연료|모닥불|대피소|작업대|기록실|필사대|서가|고기를 구웠/,
  '부족 프로젝트': /프로젝트|공동 작업/,
  '행동 지역 변경': /행동 지역/,
  '연구 목표 변경': /연구 목표/,
  '사회 제도 목표 변경': /사회 제도 목표/,
};

export function primitiveActionResultText(previous, current, label, fallback = '') {
  const currentLogs = Array.isArray(current?.log) ? current.log : [];
  const previousTop = Array.isArray(previous?.log) ? previous.log[0] : '';
  const boundary = previousTop ? currentLogs.indexOf(previousTop) : -1;
  const newLogs = currentLogs.slice(0, boundary >= 0 ? boundary : Math.min(currentLogs.length, 16));
  const pattern = ACTION_RESULT_PATTERNS[String(label || '')];
  const matched = pattern ? newLogs.find((line) => pattern.test(String(line || ''))) : '';
  return matched || newLogs[0] || fallback || `${label || '행동'}을 실행했습니다.`;
}

function milestoneAction(cue) {
  if (cue === 'champion') return 'champion';
  if (cue === 'defeat') return 'defeat';
  if (cue === 'projectComplete') return 'project';
  if (cue === 'civicComplete' || cue === 'inspiration') return 'policy';
  if (cue === 'complete' || cue === 'research') return 'research';
  if (cue === 'growth') return 'growth';
  if (cue === 'diplomacy') return 'diplomacy';
  if (cue === 'discover') return 'discover';
  if (cue === 'season') return 'season';
  return 'complete';
}

export function primitiveActionFeedback(previous, current, label) {
  const milestoneCue = primitiveMilestoneCue(
    primitiveMilestoneSnapshot(previous),
    primitiveMilestoneSnapshot(current),
  );
  if (milestoneCue) {
    return {
      action: milestoneAction(milestoneCue),
      cue: '',
      outcome: 'milestone',
      tone: milestoneCue === 'defeat' ? 'danger' : milestoneCue === 'champion' ? 'champion' : 'highlight',
    };
  }

  const rule = ACTION_RULES[String(label || '')];
  if (!rule) return { action: 'confirm', cue: '', outcome: 'neutral', tone: 'ready' };

  const previousCounter = Number(previous?.counters?.[rule.counter] || 0);
  const currentCounter = Number(current?.counters?.[rule.counter] || 0);
  const spentAction = Number(current?.day || 0) > Number(previous?.day || 0)
    || Number(current?.ap || 0) < Number(previous?.ap || 0);
  const succeeded = rule.counter ? currentCounter > previousCounter : spentAction;
  if (succeeded) return { action: rule.action, cue: rule.cue || '', outcome: 'success', tone: 'success' };

  const hpLost = partyHpTotal(current) < partyHpTotal(previous);
  return {
    action: hpLost ? 'warning' : rule.action,
    cue: 'survivalFail',
    outcome: 'failure',
    tone: hpLost ? 'danger' : 'warning',
  };
}
