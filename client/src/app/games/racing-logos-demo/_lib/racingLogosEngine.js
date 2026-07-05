export const GAME_SLUG = 'racing-logos-demo';
export const QUICK_SAVE_SLOT = 'racing-logos-main';
export const SAVE_VERSION = 'racing-logos-v1';

export const PLACEHOLDER_LOGO_BASE = '/games/racing-logos-demo/logos/_placeholder';

export const CORE_TRACKS = [
  { id: 'trk_tokyo', region: 'japan', surface: 'turf', direction: 'left', distanceM: 2400, logoKey: 'tokyo_racecourse' },
  { id: 'trk_ascot', region: 'europe', surface: 'turf', direction: 'right', distanceM: 2400, logoKey: 'ascot_racecourse' },
  { id: 'trk_churchill', region: 'usa', surface: 'dirt', direction: 'left', distanceM: 2000, logoKey: 'churchill_downs' },
];

export const CORE_EVENTS = [
  { id: 'evt_tokyo_cup', trackId: 'trk_tokyo', region: 'japan', surface: 'turf', direction: 'left', distanceM: 2400 },
  { id: 'evt_ascot_mile', trackId: 'trk_ascot', region: 'europe', surface: 'turf', direction: 'right', distanceM: 1600 },
  { id: 'evt_derby_trial', trackId: 'trk_churchill', region: 'usa', surface: 'dirt', direction: 'left', distanceM: 2000 },
];

export const SEASON_CALENDAR_TEMPLATE = [
  { id: 'spring-derby-trial', week: '3월 2주', tier: 'G3', eventId: 'evt_derby_trial', theme: '더트 개막 예선', purse: 720 },
  { id: 'early-summer-tokyo-cup', week: '5월 4주', tier: 'G2', eventId: 'evt_tokyo_cup', theme: '중거리 클래식', purse: 960 },
  { id: 'summer-ascot-mile', week: '7월 3주', tier: 'G1', eventId: 'evt_ascot_mile', theme: '유럽 마일 챔피언십', purse: 1180 },
  { id: 'autumn-tokyo-repeat', week: '10월 1주', tier: 'G1', eventId: 'evt_tokyo_cup', theme: '가을 왕좌전', purse: 1320 },
];

export const EMPTY_LOCAL_PACK = {
  trackNames: {},
  eventNames: {},
  trackLogoKeyOverrides: {},
};

const REGION_LABELS = {
  japan: 'JP',
  europe: 'EU',
  usa: 'US',
};

const REGION_NAMES = {
  japan: '일본',
  europe: '유럽',
  usa: '미국',
};

const SURFACE_NAMES = {
  turf: '잔디',
  dirt: '더트',
};

const DIRECTION_NAMES = {
  left: '좌회전',
  right: '우회전',
};

const ENTRY_POOL = [
  { id: 'aurora', name: 'Aurora Line', surface: 'turf', region: 'japan', stamina: 82, pace: 72 },
  { id: 'bluegate', name: 'Bluegate Run', surface: 'dirt', region: 'usa', stamina: 76, pace: 84 },
  { id: 'crown', name: 'Crown Step', surface: 'turf', region: 'europe', stamina: 88, pace: 68 },
  { id: 'meteor', name: 'Meteor Rail', surface: 'dirt', region: 'japan', stamina: 70, pace: 90 },
  { id: 'silver', name: 'Silver Court', surface: 'turf', region: 'usa', stamina: 80, pace: 77 },
];

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `racing-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    localPack: { ...EMPTY_LOCAL_PACK },
    filters: {
      region: 'all',
      surface: 'all',
      showDebug: false,
      preferLocalLogos: true,
    },
    auditHistory: [],
    raceCards: [],
    log: ['Racing Logos 데모를 불러왔습니다. 공개 placeholder와 로컬팩 오버레이를 함께 검수할 수 있습니다.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    localPack: sanitizeLocalPack(value.localPack),
    filters: value.filters && typeof value.filters === 'object' ? { ...base.filters, ...value.filters } : base.filters,
    auditHistory: Array.isArray(value.auditHistory) ? value.auditHistory.slice(0, 16) : [],
    raceCards: Array.isArray(value.raceCards) ? value.raceCards.slice(0, 12) : [],
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

export function applyLocalPackAction(state, localPack, source = 'manual') {
  const current = normalizeState(state);
  const nextPack = sanitizeLocalPack(localPack);
  const trackCount = Object.keys(nextPack.trackNames).length;
  const eventCount = Object.keys(nextPack.eventNames).length;
  const overrideCount = Object.keys(nextPack.trackLogoKeyOverrides).length;
  return addLog({
    ...current,
    localPack: nextPack,
  }, `${source === 'fetch' ? 'public/local_pack' : '수동 JSON'} 로컬팩 적용: 트랙명 ${trackCount}, 이벤트명 ${eventCount}, 로고키 ${overrideCount}.`);
}

export function clearLocalPackAction(state) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    localPack: { ...EMPTY_LOCAL_PACK },
  }, '로컬팩 오버레이를 비우고 core 데이터 기준으로 되돌렸습니다.');
}

export function setFilterAction(state, patch) {
  const current = normalizeState(state);
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    filters: { ...current.filters, ...(patch || {}) },
  };
}

export function auditLogoPackAction(state) {
  const current = normalizeState(state);
  const tracks = buildTracks(current);
  const events = buildEvents(current);
  const namedTracks = tracks.filter((track) => track.hasLocalName).length;
  const namedEvents = events.filter((event) => event.hasLocalName).length;
  const overriddenLogos = tracks.filter((track) => track.hasLogoOverride).length;
  const localCandidateCount = tracks.reduce((sum, track) => sum + track.localCandidates.length, 0);
  const placeholderOnly = tracks.filter((track) => !track.hasLogoOverride).length;
  const completeness = Math.round(((namedTracks / tracks.length) + (namedEvents / events.length) + (overriddenLogos / tracks.length)) / 3 * 100);
  const audit = {
    id: `AUD-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    tracks: tracks.length,
    events: events.length,
    namedTracks,
    namedEvents,
    overriddenLogos,
    localCandidateCount,
    placeholderOnly,
    completeness,
    score: completeness * 12 + namedEvents * 25 + overriddenLogos * 40,
  };
  return addLog({
    ...current,
    auditHistory: [audit, ...current.auditHistory].slice(0, 16),
  }, `로고팩 감사 완료: 완성도 ${completeness}%, placeholder 전용 ${placeholderOnly}개.`);
}

export function generateRaceCardAction(state) {
  const current = normalizeState(state);
  const events = visibleEvents(current);
  if (!events.length) return addLog(current, '현재 필터에 맞는 레이스 이벤트가 없습니다.');
  const card = {
    id: `CARD-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    results: events.map((event, index) => simulateEvent(event, index + current.raceCards.length)),
  };
  return addLog({
    ...current,
    raceCards: [card, ...current.raceCards].slice(0, 12),
  }, `레이스 카드 ${card.results.length}개 이벤트를 생성했습니다.`);
}

export function generateSeasonCardAction(state) {
  const current = normalizeState(state);
  const rows = seasonCalendarRows(current);
  if (!rows.length) return addLog(current, '시즌 캘린더에 편성된 이벤트가 없습니다.');
  const card = {
    id: `SEASON-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    season: true,
    results: rows.map((row) => ({
      ...row.preview,
      eventId: row.eventId,
      raceName: row.raceName,
      trackName: row.trackName,
      region: row.region,
      surface: row.surface,
      distanceM: row.distanceM,
      week: row.week,
      tier: row.tier,
      readiness: row.readiness,
    })),
  };
  return addLog({
    ...current,
    raceCards: [card, ...current.raceCards].slice(0, 12),
  }, `시즌 캘린더 카드 ${card.results.length}개 라운드를 생성했습니다.`);
}

export function buildTracks(state) {
  const current = normalizeState(state);
  return CORE_TRACKS.map((track) => {
    const logoKey = current.localPack.trackLogoKeyOverrides[track.id] || track.logoKey;
    return {
      ...track,
      name: current.localPack.trackNames[track.id] || track.id,
      logoKey,
      regionLabel: REGION_LABELS[track.region] || track.region,
      regionName: REGION_NAMES[track.region] || track.region,
      surfaceName: SURFACE_NAMES[track.surface] || track.surface,
      directionName: DIRECTION_NAMES[track.direction] || track.direction,
      hasLocalName: Boolean(current.localPack.trackNames[track.id]),
      hasLogoOverride: Boolean(current.localPack.trackLogoKeyOverrides[track.id]),
      localCandidates: getLocalLogoCandidates(logoKey),
      fallbackLogo: getPlaceholderLogoUrl(track.region),
    };
  });
}

export function buildEvents(state) {
  const current = normalizeState(state);
  const tracksById = new Map(buildTracks(current).map((track) => [track.id, track]));
  return CORE_EVENTS.map((event) => {
    const track = tracksById.get(event.trackId);
    return {
      ...event,
      raceName: current.localPack.eventNames[event.id] || event.id,
      trackName: track?.name || event.trackId,
      trackLogoKey: track?.logoKey || event.trackId,
      regionLabel: REGION_LABELS[event.region] || event.region,
      regionName: REGION_NAMES[event.region] || event.region,
      surfaceName: SURFACE_NAMES[event.surface] || event.surface,
      directionName: DIRECTION_NAMES[event.direction] || event.direction,
      fallbackLogo: getPlaceholderLogoUrl(event.region),
      localCandidates: getLocalLogoCandidates(track?.logoKey || event.trackId),
      hasLocalName: Boolean(current.localPack.eventNames[event.id]),
    };
  });
}

export function localPackMatrix(state) {
  const tracks = buildTracks(state);
  const events = buildEvents(state);
  const trackRows = tracks.map((track) => {
    const missing = [
      track.hasLocalName ? '' : '트랙명',
      track.hasLogoOverride ? '' : '로고키',
    ].filter(Boolean);
    return {
      id: `track-${track.id}`,
      kind: 'track',
      kindLabel: '트랙',
      sourceId: track.id,
      name: track.name,
      requiredKey: `trackNames.${track.id}`,
      logoKeyPath: `trackLogoKeyOverrides.${track.id}`,
      logoKey: track.logoKey,
      candidateText: track.localCandidates.join(' / '),
      hasName: track.hasLocalName,
      hasLogo: track.hasLogoOverride,
      complete: missing.length === 0,
      status: missing.length ? `${missing.join(', ')} 필요` : '완료',
    };
  });
  const eventRows = events.map((event) => ({
    id: `event-${event.id}`,
    kind: 'event',
    kindLabel: '이벤트',
    sourceId: event.id,
    name: event.raceName,
    requiredKey: `eventNames.${event.id}`,
    logoKeyPath: `tracks.${event.trackId}`,
    logoKey: event.trackLogoKey,
    candidateText: event.localCandidates.join(' / '),
    hasName: event.hasLocalName,
    hasLogo: true,
    complete: event.hasLocalName,
    status: event.hasLocalName ? '완료' : '이벤트명 필요',
  }));
  const rows = [...trackRows, ...eventRows];
  return {
    rows,
    totals: {
      rows: rows.length,
      completed: rows.filter((row) => row.complete).length,
      missingNames: rows.filter((row) => !row.hasName).length,
      missingLogoOverrides: trackRows.filter((row) => !row.hasLogo).length,
      localCandidateCount: rows.reduce((sum, row) => sum + (row.candidateText ? row.candidateText.split(' / ').length : 0), 0),
      trackNameCount: trackRows.filter((row) => row.hasName).length,
      eventNameCount: eventRows.filter((row) => row.hasName).length,
      logoOverrideCount: trackRows.filter((row) => row.hasLogo).length,
    },
  };
}

export function seasonCalendarRows(state) {
  const current = normalizeState(state);
  const eventsById = new Map(buildEvents(current).map((event) => [event.id, event]));
  const tracksById = new Map(buildTracks(current).map((track) => [track.id, track]));
  return SEASON_CALENDAR_TEMPLATE.map((slot, index) => {
    const event = eventsById.get(slot.eventId) || null;
    const track = event ? tracksById.get(event.trackId) : null;
    const missing = [
      event?.hasLocalName ? '' : '이벤트명',
      track?.hasLocalName ? '' : '트랙명',
      track?.hasLogoOverride ? '' : '로고키',
    ].filter(Boolean);
    const preview = event ? simulateEvent(event, index + 100) : null;
    const readiness = Math.max(0, Math.round((3 - missing.length) / 3 * 100));
    return {
      ...slot,
      eventId: event?.id || slot.eventId,
      raceName: event?.raceName || slot.eventId,
      trackId: event?.trackId || '',
      trackName: event?.trackName || '-',
      region: event?.region || '',
      regionName: event?.regionName || '',
      surface: event?.surface || '',
      surfaceName: event?.surfaceName || '',
      directionName: event?.directionName || '',
      distanceM: Number(event?.distanceM || 0),
      logoKey: track?.logoKey || event?.trackLogoKey || '',
      fallbackLogo: event?.fallbackLogo || '',
      localCandidates: event?.localCandidates || [],
      missing,
      readiness,
      status: missing.length ? `${missing.join(', ')} 보강 필요` : '편성 가능',
      preview: preview || { winner: '-', runnerUp: '-', rating: 0 },
      projectedInterest: Math.max(40, Math.min(100, Math.round((slot.purse / 18) + readiness * 0.35 + Number(preview?.rating || 0) * 0.12))),
    };
  });
}

export function seasonCalendarReport(state) {
  const rows = seasonCalendarRows(state);
  const readyRows = rows.filter((row) => row.missing.length === 0);
  const regions = Array.from(new Set(rows.map((row) => row.region).filter(Boolean)));
  const surfaces = Array.from(new Set(rows.map((row) => row.surface).filter(Boolean)));
  const averageReadiness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length)
    : 0;
  const projectedInterest = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.projectedInterest, 0) / rows.length)
    : 0;
  const missingRows = rows.filter((row) => row.missing.length > 0);
  const recommendations = [
    missingRows.length ? `${missingRows[0].raceName}부터 ${missingRows[0].missing.join(', ')}을 보강하면 캘린더 노출 품질이 가장 빨리 올라갑니다.` : '',
    regions.length < 3 ? '지역 분포가 좁습니다. 공개 후보팩을 확장할 때 지역별 이벤트를 하나씩 더 배치하세요.' : '',
    surfaces.length < 2 ? '주로가 한쪽으로 치우쳤습니다. turf/dirt 이벤트를 모두 포함하면 시즌 카드가 더 다양해집니다.' : '',
    projectedInterest < 70 ? '예상 관심도가 낮습니다. 상금과 대표 이벤트명을 보강해서 시즌 카드의 첫인상을 올리세요.' : '',
  ].filter(Boolean);
  if (!recommendations.length) recommendations.push('시즌 캘린더는 현재 공개용 검수 기준을 충족합니다. 다음 단계는 실제 장기 결과 데이터팩 분리입니다.');
  return {
    rows,
    readyRows: readyRows.length,
    totalRows: rows.length,
    averageReadiness,
    projectedInterest,
    regions,
    surfaces,
    missingRows,
    recommendations,
  };
}

function buildDataPackRow(id, label, value, detail, pct, status = 'ready') {
  return {
    id,
    label,
    value,
    detail,
    pct: Math.round(Math.max(0, Math.min(100, Number(pct || 0)))),
    status,
  };
}

export function dataPackReleaseReportForState(state) {
  const current = normalizeState(state);
  const matrix = localPackMatrix(current);
  const calendar = seasonCalendarReport(current);
  const audit = latestAudit(current);
  const seasonCards = current.raceCards.filter((card) => card.season);
  const eventCards = current.raceCards.filter((card) => !card.season);
  const resultRows = current.raceCards.slice(0, 8).flatMap((card) => (
    (card.results || []).map((result, index) => ({
      id: `${card.id}-${result.eventId}-${index}`,
      cardId: card.id,
      season: Boolean(card.season),
      raceName: result.raceName,
      trackName: result.trackName,
      winner: result.winner,
      runnerUp: result.runnerUp,
      rating: Number(result.rating || 0),
      week: result.week || '',
      surface: result.surface,
      distanceM: Number(result.distanceM || 0),
    }))
  ));
  const avgRating = resultRows.length
    ? Math.round(resultRows.reduce((sum, row) => sum + row.rating, 0) / resultRows.length)
    : 0;
  const releaseScore = Math.round(Math.max(0, Math.min(100,
    audit.completeness * 0.34
      + calendar.averageReadiness * 0.24
      + Math.min(100, seasonCards.length * 34 + eventCards.length * 16) * 0.16
      + Math.min(100, resultRows.length * 7) * 0.14
      + Math.min(100, matrix.totals.localCandidateCount * 4) * 0.12,
  )));
  const packRows = [
    buildDataPackRow(
      'core-pack',
      'core 데이터팩',
      `${CORE_TRACKS.length}T / ${CORE_EVENTS.length}E`,
      '공개 가능한 트랙/이벤트 id, 지역, 주로, 방향, 거리 정보입니다.',
      100,
      'complete',
    ),
    buildDataPackRow(
      'public-placeholder',
      'public placeholder',
      `${audit.placeholderOnly}개 placeholder`,
      '저작권 이슈 없이 배포 가능한 fallback 로고 경로입니다.',
      Math.max(20, 100 - audit.placeholderOnly * 22),
      audit.placeholderOnly ? 'ready' : 'complete',
    ),
    buildDataPackRow(
      'local-pack',
      'private local_pack',
      `${matrix.totals.completed}/${matrix.totals.rows}`,
      '실명, 로고키, 후보 경로를 개인 로컬 데이터팩으로 분리해 검수합니다.',
      matrix.totals.rows ? matrix.totals.completed / matrix.totals.rows * 100 : 0,
      matrix.totals.completed === matrix.totals.rows ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'season-pack',
      'season calendar',
      `${calendar.readyRows}/${calendar.totalRows}`,
      '시즌 라운드 편성과 예상 관심도, 보강 필요 항목을 분리 관리합니다.',
      calendar.averageReadiness,
      calendar.readyRows === calendar.totalRows ? 'complete' : 'ready',
    ),
  ];
  const modelRows = [
    buildDataPackRow(
      'event-card',
      '이벤트 결과 모델',
      `${eventCards.length}장`,
      '필터된 이벤트를 카드 단위 결과로 생성해 단기 검수에 사용합니다.',
      Math.min(100, eventCards.length * 45),
      eventCards.length ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'season-card',
      '시즌 결과 모델',
      `${seasonCards.length}장`,
      '시즌 캘린더 전체를 장기 결과 카드로 저장해 장기 레이스 흐름을 분리합니다.',
      Math.min(100, seasonCards.length * 55),
      seasonCards.length ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'rating-ledger',
      '레이팅 원장',
      resultRows.length ? `${resultRows.length}개 결과` : '결과 없음',
      resultRows.length ? `평균 레이팅 ${avgRating}, winner/runner-up/track/surface/distance가 누적됩니다.` : '이벤트 카드나 시즌 카드를 생성하면 결과 원장이 채워집니다.',
      Math.min(100, resultRows.length * 7),
      resultRows.length ? 'complete' : 'ready',
    ),
  ];
  const recommendations = [];
  if (matrix.totals.completed < matrix.totals.rows) recommendations.push('private local_pack 매트릭스의 누락 이름과 로고키를 먼저 채우세요.');
  if (calendar.readyRows < calendar.totalRows) recommendations.push('시즌 캘린더 보강 필요 라운드를 정리하면 장기 결과 모델 품질이 올라갑니다.');
  if (!seasonCards.length) recommendations.push('시즌 카드 생성을 한 번 실행해 장기 레이스 결과 모델을 검증하세요.');
  if (!eventCards.length) recommendations.push('필터별 이벤트 카드를 만들어 단기 결과 모델도 비교하세요.');
  if (!recommendations.length) recommendations.push('배포용 core/placeholder와 개인용 local_pack, 결과 모델이 분리되어 있습니다. 전적 기록으로 감사 스냅샷을 남기세요.');
  return {
    releaseScore,
    packRows,
    modelRows,
    resultRows,
    seasonCards: seasonCards.length,
    eventCards: eventCards.length,
    avgRating,
    recommendations,
  };
}

export function visibleTracks(state) {
  const current = normalizeState(state);
  return buildTracks(current).filter((track) => matchFilters(track, current.filters));
}

export function visibleEvents(state) {
  const current = normalizeState(state);
  return buildEvents(current).filter((event) => matchFilters(event, current.filters));
}

export function latestAudit(state) {
  const current = normalizeState(state);
  return current.auditHistory[0] || estimateAudit(current);
}

export function scoreState(state) {
  const current = normalizeState(state);
  const audit = latestAudit(current);
  const raceScore = current.raceCards.reduce((sum, card) => sum + card.results.reduce((inner, result) => inner + result.rating, 0), 0);
  return Math.max(0, Math.round(audit.score + raceScore + current.raceCards.length * 60));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const audit = latestAudit(current);
  const matrix = localPackMatrix(current);
  const calendar = seasonCalendarReport(current);
  const dataPack = dataPackReleaseReportForState(current);
  return {
    tracks: CORE_TRACKS.length,
    events: CORE_EVENTS.length,
    completeness: audit.completeness,
    calendarReadiness: calendar.averageReadiness,
    dataPackReleaseScore: dataPack.releaseScore,
    seasonResultCards: dataPack.seasonCards,
    eventResultCards: dataPack.eventCards,
    placeholderOnly: audit.placeholderOnly,
    missingNames: matrix.totals.missingNames,
    missingLogoOverrides: matrix.totals.missingLogoOverrides,
    raceCards: current.raceCards.length,
    score: scoreState(current),
  };
}

export function sampleLocalPackText() {
  return JSON.stringify({
    trackNames: {
      trk_tokyo: 'Tokyo Racecourse',
      trk_ascot: 'Ascot Racecourse',
      trk_churchill: 'Churchill Downs',
    },
    eventNames: {
      evt_tokyo_cup: 'Tokyo Cup',
      evt_ascot_mile: 'Ascot Mile',
      evt_derby_trial: 'Derby Trial',
    },
    trackLogoKeyOverrides: {
      trk_tokyo: 'tokyo_racecourse',
      trk_ascot: 'ascot_racecourse',
      trk_churchill: 'churchill_downs',
    },
  }, null, 2);
}

export function parseLocalPackText(text) {
  if (!String(text || '').trim()) return { ok: true, value: { ...EMPTY_LOCAL_PACK } };
  try {
    return { ok: true, value: sanitizeLocalPack(JSON.parse(text)) };
  } catch (err) {
    return { ok: false, error: err?.message || 'JSON 파싱에 실패했습니다.' };
  }
}

export function getPlaceholderLogoUrl(fallbackKey = 'generic') {
  const key = normalizeKey(fallbackKey) || 'generic';
  return `${PLACEHOLDER_LOGO_BASE}/${key}.svg`;
}

export function getLocalLogoCandidates(logoKey) {
  const key = normalizeKey(logoKey);
  if (!key) return [];
  return [
    `/local_pack/logos/${key}.png`,
    `/local_pack/logos/${key}.webp`,
    `/local_pack/logos/${key}.svg`,
  ];
}

export function normalizeKey(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}

function sanitizeLocalPack(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_LOCAL_PACK };
  return {
    trackNames: sanitizeRecord(value.trackNames),
    eventNames: sanitizeRecord(value.eventNames),
    trackLogoKeyOverrides: sanitizeRecord(value.trackLogoKeyOverrides),
  };
}

function sanitizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [String(key || '').trim(), String(entry || '').trim()])
    .filter(([key, entry]) => key && entry));
}

function matchFilters(row, filters) {
  const region = filters?.region || 'all';
  const surface = filters?.surface || 'all';
  return (region === 'all' || row.region === region) && (surface === 'all' || row.surface === surface);
}

function estimateAudit(state) {
  const tracks = buildTracks(state);
  const events = buildEvents(state);
  const namedTracks = tracks.filter((track) => track.hasLocalName).length;
  const namedEvents = events.filter((event) => event.hasLocalName).length;
  const overriddenLogos = tracks.filter((track) => track.hasLogoOverride).length;
  const completeness = Math.round(((namedTracks / tracks.length) + (namedEvents / events.length) + (overriddenLogos / tracks.length)) / 3 * 100);
  return {
    id: 'ESTIMATE',
    createdAt: state.updatedAt,
    tracks: tracks.length,
    events: events.length,
    namedTracks,
    namedEvents,
    overriddenLogos,
    localCandidateCount: tracks.reduce((sum, track) => sum + track.localCandidates.length, 0),
    placeholderOnly: tracks.filter((track) => !track.hasLogoOverride).length,
    completeness,
    score: completeness * 12 + namedEvents * 25 + overriddenLogos * 40,
  };
}

function simulateEvent(event, salt) {
  const rows = ENTRY_POOL.map((entry) => {
    const surfaceBonus = entry.surface === event.surface ? 12 : -5;
    const regionBonus = entry.region === event.region ? 8 : 0;
    const distanceBias = Math.max(-12, Math.min(12, Math.round((2400 - event.distanceM) / 100)));
    const rating = entry.stamina + entry.pace + surfaceBonus + regionBonus + distanceBias + seededRoll(`${event.id}:${entry.id}:${salt}`);
    return {
      ...entry,
      rating,
    };
  }).sort((a, b) => b.rating - a.rating);
  return {
    eventId: event.id,
    raceName: event.raceName,
    trackName: event.trackName,
    region: event.region,
    surface: event.surface,
    distanceM: event.distanceM,
    winner: rows[0].name,
    runnerUp: rows[1].name,
    rating: rows[0].rating,
  };
}

function seededRoll(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash % 21);
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}
