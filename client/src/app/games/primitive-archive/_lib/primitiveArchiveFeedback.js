function countEntries(value) {
  return Object.keys(value && typeof value === 'object' ? value : {}).length;
}

function partyHpTotal(state) {
  return (Array.isArray(state?.party) ? state.party : [])
    .reduce((sum, member) => sum + Math.max(0, Number(member?.hp || 0)), 0);
}

export function primitiveMilestoneSnapshot(state, seasonId = '', eraId = '') {
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
    eraId: String(eraId || ''),
  };
}

export function primitiveMilestoneCue(previous, current) {
  if (!previous || !current || previous.runId !== current.runId) return '';
  if (!previous.victory && current.victory) return 'champion';
  if (!previous.ended && current.ended) return 'defeat';
  if (previous.eraId && current.eraId && previous.eraId !== current.eraId) return 'eraAdvance';
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

const MILESTONE_RULES = {
  champion: { key: 'victory', action: 'primitive-victory', label: '아카이브 완성', tone: 'champion' },
  defeat: { key: 'defeat', action: 'primitive-defeat', label: '생존 런 종료', tone: 'danger' },
  eraAdvance: { key: 'eraAdvance', action: 'primitive-era', label: '새 시대 진입', tone: 'champion' },
  projectComplete: { key: 'projectComplete', action: 'primitive-project', label: '부족 프로젝트 완성', tone: 'success' },
  civicComplete: { key: 'civicComplete', action: 'primitive-civic', label: '사회 제도 완성', tone: 'success' },
  complete: { key: 'researchComplete', action: 'primitive-research', label: '기술 연구 완료', tone: 'success' },
  inspiration: { key: 'inspiration', action: 'primitive-inspiration', label: '영감 촉발', tone: 'highlight' },
  research: { key: 'eureka', action: 'primitive-eureka', label: '유레카 촉발', tone: 'highlight' },
  growth: { key: 'growth', action: 'primitive-growth', label: '부족 인구 성장', tone: 'success' },
  diplomacy: { key: 'contact', action: 'primitive-diplomacy', label: '새 부족 접촉', tone: 'highlight' },
  discover: { key: 'discover', action: 'primitive-discovery', label: '새 지역 발견', tone: 'highlight' },
  season: { key: 'season', action: 'primitive-season', label: '계절 전환', tone: 'highlight' },
};

const ACTION_RULES = {
  '채집': { key: 'gather', action: 'primitive-gather', counter: 'gather', cue: 'gather', successLabel: '채집 성공', failureLabel: '채집 실패' },
  '사냥': { key: 'hunt', action: 'primitive-hunt', counter: 'hunt', cue: 'combat', successLabel: '사냥 성공', failureLabel: '사냥 실패' },
  '제작': { key: 'craft', action: 'primitive-craft', counter: 'craft', cue: 'craft', successLabel: '제작 성공', failureLabel: '제작 실패' },
  '농업': { key: 'farm', action: 'primitive-farm', counter: 'farm', cue: 'farm', successLabel: '농업 생산', failureLabel: '농업 실패' },
  '목축': { key: 'herd', action: 'primitive-herd', counter: 'herd', cue: 'herd', successLabel: '목축 생산', failureLabel: '목축 실패' },
  '어로': { key: 'fish', action: 'primitive-fishing', counter: 'fish', cue: 'fish', successLabel: '어로 성공', failureLabel: '어로 실패' },
  '채광': { key: 'mine', action: 'primitive-mining', counter: 'mine', cue: 'mine', successLabel: '채광 성공', failureLabel: '채광 실패' },
  '식사': { key: 'meal', action: 'primitive-meal', counter: 'meals', cue: 'consume', successLabel: '식사 완료', failureLabel: '식사 불가' },
  '휴식': { key: 'rest', action: 'primitive-rest', cue: 'rest', successLabel: '휴식 완료', failureLabel: '휴식 불가' },
  '연구': { key: 'research', action: 'primitive-research', cue: 'research', successLabel: '연구 진척', failureLabel: '연구 불가' },
  '부족 회의': { key: 'civic', action: 'primitive-civic', cue: 'policy', successLabel: '사회 제도 진척', failureLabel: '부족 회의 불가' },
  '캠프': { key: 'camp', action: 'primitive-camp', counter: 'camp', cue: 'camp', successLabel: '캠프 작업 완료', failureLabel: '캠프 작업 불가' },
  '부족 프로젝트': { key: 'projectWork', action: 'primitive-project', cue: 'project', successLabel: '프로젝트 작업', failureLabel: '프로젝트 작업 불가' },
  '직접 대응': { key: 'event', action: 'primitive-event', cue: 'event', successLabel: '위기 대응 완료', failureLabel: '위기 대응 불가' },
  '탐험 단서 대응': { key: 'eventChain', action: 'primitive-event', cue: 'event', successLabel: '탐험 단서 처리', failureLabel: '탐험 단서 처리 불가' },
  '하루 자동 운영': { key: 'autoDay', action: 'primitive-day', cue: 'auto', successLabel: '하루 자동 운영', failureLabel: '자동 운영 불가' },
  '행동 지역 변경': { key: 'region', action: 'primitive-region', cue: 'confirm', successLabel: '행동 지역 지정', failureLabel: '지역 지정 불가', always: true },
  '부족 프로젝트 지정': { key: 'projectTarget', action: 'primitive-project', cue: 'project', successLabel: '공동 목표 지정', failureLabel: '프로젝트 지정 불가', always: true },
  '직업 배치': { key: 'job', action: 'primitive-job', cue: 'assign', successLabel: '부족원 배치 변경', failureLabel: '직업 배치 불가', always: true },
  '외교': { key: 'diplomacy', action: 'primitive-diplomacy', cue: 'diplomacy', successLabel: '부족 외교 완료', failureLabel: '부족 외교 불가', always: true },
  '합류': { key: 'recruit', action: 'primitive-recruit', cue: 'recruit', successLabel: '파티 합류', failureLabel: '합류 불가', always: true },
  '연구 목표 변경': { key: 'researchTarget', action: 'primitive-research', cue: 'confirm', successLabel: '연구 목표 변경', failureLabel: '연구 목표 변경 불가', always: true },
  '사회 제도 목표 변경': { key: 'civicTarget', action: 'primitive-civic', cue: 'confirm', successLabel: '사회 제도 목표 변경', failureLabel: '사회 제도 목표 변경 불가', always: true },
  '특전 구매': { key: 'perk', action: 'primitive-perk', cue: 'upgrade', successLabel: '특전 구매 완료', failureLabel: '특전 구매 불가', always: true },
  '자동 장착': { key: 'autoEquip', action: 'primitive-equip', cue: 'equip', successLabel: '추천 장비 장착', failureLabel: '자동 장착 불가', always: true },
  '장비 해제': { key: 'clearEquip', action: 'primitive-equip', cue: 'equip', successLabel: '장비 해제 완료', failureLabel: '장비 해제 불가', always: true },
  '장비 변경': { key: 'equip', action: 'primitive-equip', cue: 'equip', successLabel: '장비 변경 완료', failureLabel: '장비 변경 불가', always: true },
};

const ACTION_RESULT_PATTERNS = {
  '채집': /채집 (?:성공|실패)/,
  '사냥': /사냥 (?:성공|실패)/,
  '농업': /농업 (?:성공|실패)/,
  '목축': /목축 (?:성공|실패)/,
  '어로': /어로 (?:성공|실패)/,
  '채광': /채광 (?:성공|실패)/,
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
  '부족 프로젝트 지정': /프로젝트|공동 목표/,
  '직업 배치': /배치|부족원|직업/,
  '외교': /교역|선물|지식 교류|약탈|외교|관계/,
  '합류': /합류/,
  '특전 구매': /특전/,
  '자동 장착': /자동 장착|장비/,
  '장비 해제': /장비.*해제/,
  '장비 변경': /장비.*변경|장착/,
  '직접 대응': /대응|회복|비상|추적/,
  '탐험 단서 대응': /탐험|단서|대응/,
  '하루 자동 운영': /Day |하루|자동 운영|정산/,
};

const FAILURE_PATTERN = /실패|(?:재료|비용|자원|식량|연료|보유량).*부족|부족(?:합니다|하여|해서)|없습니다|잠김|불가|할 수 없|필요(?:합니다|함)|종료 상태|이미 완료/;

const TEXT_PRESENTATIONS = [
  { pattern: /새 (?:원시|문명) 아카이브 런|난이도로 새 .*런/, force: true, value: { key: 'newRun', action: 'new', cue: 'start', label: '새 생존 런 시작', outcome: 'ready', tone: 'highlight' } },
  { pattern: /로그인|만료|실패|없습니다|불러오지 못|할 수 없습니다|오류/, force: true, value: { key: 'messageError', action: 'primitive-survival-fail', cue: '', label: '생존 운영 안내', outcome: 'failure', tone: 'warning' } },
  { pattern: /저장된 .*런.*불러|런을 불러왔/, force: true, value: { key: 'load', action: 'load', cue: '', label: '생존 런 불러오기', outcome: 'success', tone: 'success' } },
  { pattern: /런을 .*저장|런.*저장 슬롯/, force: true, value: { key: 'save', action: 'save', cue: '', label: '생존 런 저장', outcome: 'success', tone: 'success' } },
  { pattern: /런 결과.*전적|전적.*기록|런.*정산/, force: true, value: { key: 'record', action: 'archive', cue: '', label: '생존 기록 정산', outcome: 'success', tone: 'success' } },
];

export function primitiveActionResultText(previous, current, label, fallback = '') {
  const currentLogs = Array.isArray(current?.log) ? current.log : [];
  const previousTop = Array.isArray(previous?.log) ? previous.log[0] : '';
  const boundary = previousTop ? currentLogs.indexOf(previousTop) : -1;
  const newLogs = currentLogs.slice(0, boundary >= 0 ? boundary : Math.min(currentLogs.length, 16));
  const pattern = ACTION_RESULT_PATTERNS[String(label || '')];
  const matched = pattern ? newLogs.find((line) => pattern.test(String(line || ''))) : '';
  return matched || newLogs[0] || fallback || `${label || '행동'}을 실행했습니다.`;
}

export function primitiveActionFeedback(previous, current, label, options = {}) {
  const resultText = options.resultText || primitiveActionResultText(previous, current, label);
  const milestoneCue = primitiveMilestoneCue(
    primitiveMilestoneSnapshot(previous, options.previousSeasonId, options.previousEraId),
    primitiveMilestoneSnapshot(current, options.currentSeasonId, options.currentEraId),
  );
  if (milestoneCue) {
    const milestone = MILESTONE_RULES[milestoneCue] || MILESTONE_RULES.complete;
    return {
      ...milestone,
      cue: '',
      outcome: 'milestone',
    };
  }

  const rule = ACTION_RULES[String(label || '')];
  if (!rule) {
    return {
      key: 'neutral',
      action: FAILURE_PATTERN.test(resultText) ? 'primitive-survival-fail' : 'confirm',
      cue: FAILURE_PATTERN.test(resultText) ? 'survivalFail' : '',
      label: `${label || '행동'} 결과`,
      outcome: FAILURE_PATTERN.test(resultText) ? 'failure' : 'neutral',
      tone: FAILURE_PATTERN.test(resultText) ? 'warning' : 'ready',
    };
  }

  const previousCounter = Number(previous?.counters?.[rule.counter] || 0);
  const currentCounter = Number(current?.counters?.[rule.counter] || 0);
  const spentAction = Number(current?.day || 0) > Number(previous?.day || 0)
    || Number(current?.ap || 0) < Number(previous?.ap || 0);
  const failedByText = FAILURE_PATTERN.test(resultText);
  const succeeded = !failedByText && (rule.counter ? currentCounter > previousCounter : spentAction || rule.always);
  if (succeeded) {
    return {
      key: rule.key,
      action: rule.action,
      cue: rule.cue || '',
      label: rule.successLabel,
      outcome: 'success',
      tone: 'success',
    };
  }

  const hpLost = partyHpTotal(current) < partyHpTotal(previous);
  return {
    key: `${rule.key}Failure`,
    action: 'primitive-survival-fail',
    cue: 'survivalFail',
    label: rule.failureLabel,
    outcome: 'failure',
    tone: hpLost ? 'danger' : 'warning',
  };
}

export function primitiveActionResultPresentation(previous, current, label, options = {}) {
  const detail = options.resultText || primitiveActionResultText(previous, current, label, options.fallbackText || '');
  return {
    ...primitiveActionFeedback(previous, current, label, { ...options, resultText: detail }),
    detail,
  };
}

export function primitiveTextPresentation(text, fallback = {
  key: 'idle',
  action: 'survival',
  cue: '',
  label: '최근 생존 결과',
  outcome: 'ready',
  tone: 'ready',
}) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { ...matched.value } : fallback;
}
