function recordSignature(record) {
  return Object.entries(record || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function packSignature(pack) {
  return [
    recordSignature(pack?.trackNames),
    recordSignature(pack?.eventNames),
    recordSignature(pack?.trackLogoKeyOverrides),
  ].join('::');
}

function packEntryCount(pack) {
  return Object.keys(pack?.trackNames || {}).length
    + Object.keys(pack?.eventNames || {}).length
    + Object.keys(pack?.trackLogoKeyOverrides || {}).length;
}

function filterSignature(filters) {
  return [
    filters?.region || 'all',
    filters?.surface || 'all',
    filters?.preferLocalLogos === false ? 'placeholder' : 'local',
    filters?.showDebug ? 'debug' : 'clean',
  ].join('|');
}

function filterDetail(filters) {
  const region = { all: '전체 지역', japan: '일본', europe: '유럽', usa: '미국' }[filters?.region] || filters?.region;
  const surface = { all: '전체 주로', turf: '잔디', dirt: '더트' }[filters?.surface] || filters?.surface;
  const logoMode = filters?.preferLocalLogos === false ? 'placeholder만' : '로컬팩 우선';
  return `${region} · ${surface} · ${logoMode}${filters?.showDebug ? ' · 경로 디버그' : ''}`;
}

const FEEDBACK_PROFILES = {
  idle: { action: 'logo-audit', cue: '', label: '이번 검수 결과', tone: 'ready' },
  newRun: { action: 'new', cue: 'start', label: '새 에셋 검수', tone: 'highlight' },
  logoAudit: { action: 'logo-audit', cue: 'logoAudit', label: '로고팩 감사 완료', tone: 'highlight' },
  logoAuditPerfect: { action: 'logo-perfect', cue: 'logoAuditPerfect', label: '로고팩 완전 검수', tone: 'success' },
  raceCard: { action: 'race-card', cue: 'raceCard', label: '이벤트 카드 생성', tone: 'success' },
  seasonCard: { action: 'season-card', cue: 'seasonCard', label: '시즌 카드 생성', tone: 'success' },
  dataPackReady: { action: 'release-ready', cue: 'dataPackReady', label: '데이터팩 배포 준비', tone: 'champion' },
  packApply: { action: 'pack-apply', cue: 'packApply', label: '로컬팩 적용', tone: 'success' },
  packClear: { action: 'pack-clear', cue: 'packClear', label: '로컬팩 초기화', tone: 'warning' },
  filterChanged: { action: 'filter', cue: '', label: '검수 필터 변경', tone: 'highlight' },
  blocked: { action: 'pack-invalid', cue: 'packInvalid', label: '에셋 처리 불가', tone: 'warning' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /로그인|실패|없습니다|찾지 못했습니다|불러오지 못했습니다|유효한 JSON|오류|필요|expected|unexpected|JSON.*(?:position|line)/i, force: true, value: { action: 'pack-invalid', label: '에셋 처리 안내', tone: 'warning' } },
  { pattern: /초안.*(?:보기|불러)/, force: true, value: { action: 'draft', label: '보강 초안 준비', tone: 'highlight' } },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', label: '검수 불러오기', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', label: '검수 저장', tone: 'success' } },
  { pattern: /전적|감사 결과.*기록/, force: true, value: { action: 'archive', label: '감사 기록', tone: 'success' } },
];

const BLOCKED_LOG = /없습니다|실패|찾지 못|불러오지 못|유효한 JSON|오류|필요/;

export function racingLogosFeedbackSnapshot(state) {
  const audits = Array.isArray(state?.auditHistory) ? state.auditHistory : [];
  const cards = Array.isArray(state?.raceCards) ? state.raceCards : [];
  const logs = Array.isArray(state?.log) ? state.log : [];
  const latestAudit = audits[0] || null;
  const latestCard = cards[0] || null;
  const raceCardCount = cards.filter((card) => !card?.season).length;
  const seasonCardCount = cards.filter((card) => Boolean(card?.season)).length;
  return {
    runId: String(state?.runId || ''),
    latestLog: String(logs[0] || ''),
    logCount: logs.length,
    auditCount: audits.length,
    auditCompleteness: Number(latestAudit?.completeness || 0),
    placeholderOnly: Number(latestAudit?.placeholderOnly || 0),
    cardCount: cards.length,
    raceCardCount,
    seasonCardCount,
    latestCardId: String(latestCard?.id || ''),
    latestCardSeason: Boolean(latestCard?.season),
    packSignature: packSignature(state?.localPack),
    packEntryCount: packEntryCount(state?.localPack),
    filterSignature: filterSignature(state?.filters),
    filterDetail: filterDetail(state?.filters),
  };
}

function asSnapshot(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'auditCount')
    ? value
    : racingLogosFeedbackSnapshot(value);
}

function isDataPackReady(snapshot) {
  return snapshot.auditCompleteness >= 100
    && snapshot.placeholderOnly === 0
    && snapshot.raceCardCount > 0
    && snapshot.seasonCardCount > 0;
}

export function racingLogosFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  const logChanged = current.latestLog !== previous.latestLog || current.logCount > previous.logCount;
  if (previous.runId !== current.runId) return 'newRun';
  if (logChanged && BLOCKED_LOG.test(current.latestLog)) return 'blocked';
  if (current.auditCount > previous.auditCount) {
    return current.auditCompleteness >= 100 && current.placeholderOnly === 0
      ? 'logoAuditPerfect'
      : 'logoAudit';
  }
  if (current.cardCount > previous.cardCount) {
    if (!isDataPackReady(previous) && isDataPackReady(current)) return 'dataPackReady';
    return current.latestCardSeason ? 'seasonCard' : 'raceCard';
  }
  if (current.packSignature !== previous.packSignature) {
    return current.packEntryCount ? 'packApply' : 'packClear';
  }
  if (current.filterSignature !== previous.filterSignature) return 'filterChanged';
  return 'idle';
}

export function racingLogosResultPresentation(previousValue, currentValue) {
  const current = asSnapshot(currentValue);
  const key = racingLogosFeedbackTransition(previousValue, current);
  const profile = { key, ...FEEDBACK_PROFILES[key] };
  if (key === 'newRun') return { ...profile, detail: '공개 placeholder와 로컬팩 오버레이 검수를 새로 시작했습니다.' };
  if (key === 'filterChanged') return { ...profile, detail: current.filterDetail };
  if (key === 'dataPackReady') return { ...profile, detail: '완전 감사와 이벤트·시즌 결과 카드가 모두 준비됐습니다.' };
  return current.latestLog ? { ...profile, detail: current.latestLog } : profile;
}

export function racingLogosFeedbackCue(previousValue, currentValue) {
  if (!previousValue || !currentValue || asSnapshot(previousValue).runId !== asSnapshot(currentValue).runId) return '';
  return racingLogosResultPresentation(previousValue, currentValue).cue || '';
}

export function racingLogosTextPresentation(text, fallback = FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
