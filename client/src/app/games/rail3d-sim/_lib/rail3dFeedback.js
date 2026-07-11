import { trainRows } from './rail3dEngine';

function eventCount(trains, key) {
  return (trains || []).reduce(
    (sum, train) => sum + Object.keys(train?.[key] || {}).length,
    0,
  );
}

export function rail3dFeedbackSnapshot(state) {
  const rows = trainRows(state);
  const trains = state?.trains || [];
  const completed = rows.filter((row) => row.phase === 'DONE').length;
  return {
    runId: String(state?.runId || ''),
    nowS: Number(state?.nowS || 0),
    lookaheadBlocks: Number(state?.lookaheadBlocks || 0),
    stepSeconds: Number(state?.stepSeconds || 0),
    arrivals: eventCount(trains, 'actualArriveS'),
    departures: eventCount(trains, 'actualDepartS'),
    completed,
    total: rows.length,
    stopped: rows.filter((row) => row.signalState === 'STOP').length,
    tokenWaits: rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length,
  };
}

export function rail3dFeedbackCue(previous, current) {
  if (!previous || previous.runId !== current.runId) return '';
  if (previous.lookaheadBlocks !== current.lookaheadBlocks) return 'signalAdjust';
  if (previous.stepSeconds !== current.stepSeconds) return 'select';
  if (current.total && current.completed === current.total && previous.completed !== previous.total) {
    return 'serviceComplete';
  }
  if (current.tokenWaits > previous.tokenWaits) return 'tokenWait';
  if (current.stopped > previous.stopped) return 'signalStop';
  if (current.completed > previous.completed) return 'trainComplete';
  if (current.arrivals > previous.arrivals) return 'stationArrive';
  if (current.departures > previous.departures) return 'trainDepart';
  if (current.stopped < previous.stopped) return 'signalClear';
  if (current.nowS > previous.nowS) return 'railStep';
  return '';
}
