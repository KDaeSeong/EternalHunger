export const RAIL3D_BGM_SCENES = Object.freeze({
  yard: 'rail-yard',
  mainline: 'rail-mainline',
  dispatch: 'rail-dispatch',
  congestion: 'rail-congestion',
  arrival: 'rail-arrival',
  archive: 'rail-archive',
});

export const RAIL3D_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'yard', theme: RAIL3D_BGM_SCENES.yard, title: '첫차 준비', icon: 'station' }),
  Object.freeze({ scene: 'mainline', theme: RAIL3D_BGM_SCENES.mainline, title: '푸른 본선', icon: 'dispatch' }),
  Object.freeze({ scene: 'dispatch', theme: RAIL3D_BGM_SCENES.dispatch, title: '관제의 손', icon: 'rail-junction' }),
  Object.freeze({ scene: 'congestion', theme: RAIL3D_BGM_SCENES.congestion, title: '붉은 신호', icon: 'signal' }),
  Object.freeze({ scene: 'arrival', theme: RAIL3D_BGM_SCENES.arrival, title: '종착의 불빛', icon: 'rail-clear' }),
  Object.freeze({ scene: 'archive', theme: RAIL3D_BGM_SCENES.archive, title: '막차 이후', icon: 'archive' }),
]);

const DISPATCH_TABS = new Set(['analysis', 'schedule', 'blocks']);
const ARCHIVE_TABS = new Set(['log', 'advanced']);
const CONGESTION_KEYS = new Set(['blockConflict', 'tokenWait', 'signalStop', 'delayedArrival', 'delayEscalated']);
const DISPATCH_KEYS = new Set(['signalAdjust', 'stepSeconds', 'junctionPass', 'tokenHandoff']);
const MAINLINE_KEYS = new Set(['stationArrive', 'trainDepart', 'trainComplete', 'networkClear', 'signalClear']);

export function resolveRail3dBgmScene({
  activeTabId = 'operations',
  completed = 0,
  healthScore = 100,
  nowS = 0,
  stopped = 0,
  tokenWaits = 0,
  total = 0,
} = {}) {
  if (total > 0 && completed >= total) return RAIL3D_BGM_SCENES.arrival;
  if (stopped > 0 || tokenWaits > 0 || Number(healthScore) < 55) return RAIL3D_BGM_SCENES.congestion;
  if (ARCHIVE_TABS.has(activeTabId)) return RAIL3D_BGM_SCENES.archive;
  if (DISPATCH_TABS.has(activeTabId)) return RAIL3D_BGM_SCENES.dispatch;
  if (Number(nowS) <= 0) return RAIL3D_BGM_SCENES.yard;
  return RAIL3D_BGM_SCENES.mainline;
}

export function rail3dResultMusic(presentation = {}) {
  const key = String(presentation?.key || '');
  if (key === 'serviceComplete') {
    return { theme: RAIL3D_BGM_SCENES.arrival, durationMs: 18_000 };
  }
  if (CONGESTION_KEYS.has(key)) {
    return { theme: RAIL3D_BGM_SCENES.congestion, durationMs: key === 'delayEscalated' ? 15_000 : 12_000 };
  }
  if (DISPATCH_KEYS.has(key)) {
    return { theme: RAIL3D_BGM_SCENES.dispatch, durationMs: 9_000 };
  }
  if (MAINLINE_KEYS.has(key)) {
    return { theme: RAIL3D_BGM_SCENES.mainline, durationMs: key === 'trainComplete' ? 11_000 : 8_000 };
  }
  if (key === 'newRun') {
    return { theme: RAIL3D_BGM_SCENES.yard, durationMs: 9_000 };
  }
  return null;
}
