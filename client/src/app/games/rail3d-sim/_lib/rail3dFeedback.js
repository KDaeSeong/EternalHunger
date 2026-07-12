const RAIL_FEEDBACK_PROFILES = {
  idle: { action: '', cue: '', label: '운행 결과', tone: '' },
  newRun: { action: 'new', cue: 'start', label: '새 운행', tone: 'highlight' },
  signalAdjust: { action: 'signal', cue: 'signalAdjust', label: '신호 설정', tone: 'highlight' },
  stepSeconds: { action: 'clock', cue: 'select', label: '스텝 간격', tone: 'highlight' },
  serviceComplete: { action: 'trophy', cue: 'serviceComplete', label: '전 운행 완료', tone: 'success' },
  tokenWait: { action: 'wait', cue: 'tokenWait', label: '토큰 대기', tone: 'warning' },
  signalStop: { action: 'signal', cue: 'signalStop', label: '정지 신호', tone: 'danger' },
  trainComplete: { action: 'dispatch', cue: 'trainComplete', label: '열차 종착', tone: 'success' },
  stationArrive: { action: 'station', cue: 'stationArrive', label: '역 도착', tone: 'success' },
  trainDepart: { action: 'dispatch', cue: 'trainDepart', label: '열차 출발', tone: 'highlight' },
  signalClear: { action: 'confirm', cue: 'signalClear', label: '신호 해제', tone: 'success' },
  railStep: { action: 'advance', cue: 'railStep', label: '운행 진행', tone: '' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /실패|로그인|없습니다|할 수 없습니다/, value: { action: 'warning', label: '운행 안내', tone: 'warning' } },
  { pattern: /불러오|불러왔/, value: { action: 'load', label: '운행 불러오기', tone: 'success' } },
  { pattern: /저장/, value: { action: 'save', label: '운행 저장', tone: 'success' } },
  { pattern: /전적|운행 기록/, value: { action: 'archive', label: '운행 기록', tone: 'success' } },
  { pattern: /열차를 선택/, value: { action: 'dispatch', label: '열차 선택', tone: 'highlight' } },
  { pattern: /최소 간격|권장.*간격|다이아/, value: { action: 'analysis', label: '다이아 분석', tone: 'highlight' } },
];

function eventCount(trains, key) {
  return (trains || []).reduce(
    (sum, train) => sum + Object.keys(train?.[key] || {}).length,
    0,
  );
}

export function rail3dFeedbackSnapshot(state) {
  const trains = state?.trains || [];
  const completed = trains.filter((train) => train?.phase === 'DONE').length;
  return {
    runId: String(state?.runId || ''),
    nowS: Number(state?.nowS || 0),
    lookaheadBlocks: Number(state?.lookaheadBlocks || 0),
    stepSeconds: Number(state?.stepSeconds || 0),
    arrivals: eventCount(trains, 'actualArriveS'),
    departures: eventCount(trains, 'actualDepartS'),
    completed,
    total: trains.length,
    stopped: trains.filter((train) => train?.signalState === 'STOP').length,
    tokenWaits: trains.filter((train) => train?.stopReason?.kind === 'TOKEN_WAIT').length,
  };
}

export function rail3dFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = previousValue?.arrivals !== undefined ? previousValue : rail3dFeedbackSnapshot(previousValue);
  const current = currentValue?.arrivals !== undefined ? currentValue : rail3dFeedbackSnapshot(currentValue);
  if (previous.runId !== current.runId) return 'newRun';
  if (previous.lookaheadBlocks !== current.lookaheadBlocks) return 'signalAdjust';
  if (previous.stepSeconds !== current.stepSeconds) return 'stepSeconds';
  if (current.total && current.completed === current.total && previous.completed < previous.total) return 'serviceComplete';
  if (current.tokenWaits > previous.tokenWaits) return 'tokenWait';
  if (current.stopped > previous.stopped) return 'signalStop';
  if (current.completed > previous.completed) return 'trainComplete';
  if (current.arrivals > previous.arrivals) return 'stationArrive';
  if (current.departures > previous.departures) return 'trainDepart';
  if (current.stopped < previous.stopped) return 'signalClear';
  if (current.nowS > previous.nowS) return 'railStep';
  return 'idle';
}

export function rail3dFeedbackCue(previous, current) {
  return RAIL_FEEDBACK_PROFILES[rail3dFeedbackTransition(previous, current)]?.cue || '';
}

export function rail3dFeedbackPresentation(previous, current) {
  const key = rail3dFeedbackTransition(previous, current);
  return { key, ...RAIL_FEEDBACK_PROFILES[key] };
}

export function rail3dResultPresentation(text, fallback = RAIL_FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
