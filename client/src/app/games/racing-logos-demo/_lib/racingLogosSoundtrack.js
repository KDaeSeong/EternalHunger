export const RACING_LOGOS_BGM_SCENES = Object.freeze({
  garage: 'racing-garage',
  telemetry: 'racing-telemetry',
  grid: 'racing-grid',
  circuit: 'racing-circuit',
  redFlag: 'racing-red-flag',
  podium: 'racing-podium',
  archive: 'racing-archive',
});

export const RACING_LOGOS_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'garage', theme: RACING_LOGOS_BGM_SCENES.garage, title: '피트 개장', icon: 'settings' }),
  Object.freeze({ scene: 'telemetry', theme: RACING_LOGOS_BGM_SCENES.telemetry, title: '텔레메트리 라인', icon: 'analysis' }),
  Object.freeze({ scene: 'grid', theme: RACING_LOGOS_BGM_SCENES.grid, title: '스타팅 그리드', icon: 'calendar' }),
  Object.freeze({ scene: 'circuit', theme: RACING_LOGOS_BGM_SCENES.circuit, title: '풀 스로틀', icon: 'race-card' }),
  Object.freeze({ scene: 'redFlag', theme: RACING_LOGOS_BGM_SCENES.redFlag, title: '레드 플래그', icon: 'warning' }),
  Object.freeze({ scene: 'podium', theme: RACING_LOGOS_BGM_SCENES.podium, title: '체커드 플래그', icon: 'trophy' }),
  Object.freeze({ scene: 'archive', theme: RACING_LOGOS_BGM_SCENES.archive, title: '경기 후 리포트', icon: 'archive' }),
]);

const TAB_SCENES = Object.freeze({
  audit: RACING_LOGOS_BGM_SCENES.garage,
  'local-pack': RACING_LOGOS_BGM_SCENES.telemetry,
  tracks: RACING_LOGOS_BGM_SCENES.grid,
  calendar: RACING_LOGOS_BGM_SCENES.grid,
  'data-pack': RACING_LOGOS_BGM_SCENES.telemetry,
  events: RACING_LOGOS_BGM_SCENES.circuit,
  matrix: RACING_LOGOS_BGM_SCENES.telemetry,
  log: RACING_LOGOS_BGM_SCENES.archive,
  advanced: RACING_LOGOS_BGM_SCENES.telemetry,
});

const TELEMETRY_RESULTS = new Set(['logoAudit', 'packApply', 'draftLoaded']);
const CIRCUIT_RESULTS = new Set(['raceCard']);
const GRID_RESULTS = new Set(['seasonCard']);
const PODIUM_RESULTS = new Set(['logoAuditPerfect', 'dataPackReady']);
const RED_FLAG_RESULTS = new Set(['blocked', 'packClear', 'packInvalid']);

export function resolveRacingLogosBgmScene({
  activeTabId = 'audit',
  eventCount = 1,
  releaseScore = 0,
} = {}) {
  if (Number(eventCount || 0) <= 0) return RACING_LOGOS_BGM_SCENES.redFlag;
  if (activeTabId === 'data-pack' && Number(releaseScore || 0) >= 90) {
    return RACING_LOGOS_BGM_SCENES.podium;
  }
  return TAB_SCENES[activeTabId] || RACING_LOGOS_BGM_SCENES.garage;
}

export function racingLogosResultMusic(presentation = {}, cue = '') {
  const key = String(presentation?.key || cue || '');
  const cueKey = String(cue || '');
  if (RED_FLAG_RESULTS.has(key) || RED_FLAG_RESULTS.has(cueKey)) {
    return { theme: RACING_LOGOS_BGM_SCENES.redFlag, durationMs: 13_000 };
  }
  if (PODIUM_RESULTS.has(key) || PODIUM_RESULTS.has(cueKey)) {
    return { theme: RACING_LOGOS_BGM_SCENES.podium, durationMs: key === 'dataPackReady' ? 18_000 : 13_000 };
  }
  if (CIRCUIT_RESULTS.has(key) || CIRCUIT_RESULTS.has(cueKey)) {
    return { theme: RACING_LOGOS_BGM_SCENES.circuit, durationMs: 11_000 };
  }
  if (GRID_RESULTS.has(key) || GRID_RESULTS.has(cueKey)) {
    return { theme: RACING_LOGOS_BGM_SCENES.grid, durationMs: 11_000 };
  }
  if (TELEMETRY_RESULTS.has(key) || TELEMETRY_RESULTS.has(cueKey)) {
    return { theme: RACING_LOGOS_BGM_SCENES.telemetry, durationMs: 9_000 };
  }
  if (key === 'newRun' || cueKey === 'start') {
    return { theme: RACING_LOGOS_BGM_SCENES.garage, durationMs: 8_000 };
  }
  return null;
}
