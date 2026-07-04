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
  return {
    tracks: CORE_TRACKS.length,
    events: CORE_EVENTS.length,
    completeness: audit.completeness,
    placeholderOnly: audit.placeholderOnly,
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
