// Optional local diagnostic only. No clock reads, engine state writes or random
// draws occur when the query-gated observer panel is not recording.
let activeRecorder = null;

export function subscribeObserverWorkMeasurements(now, onMeasure) {
  const recorder = { now, onMeasure };
  activeRecorder = recorder;
  return () => { if (activeRecorder === recorder) activeRecorder = null; };
}

export function measureObserverWork(name, work) {
  const recorder = activeRecorder;
  if (!recorder) return work();
  let start;
  try { start = recorder.now(); }
  catch { return work(); }
  try { return work(); }
  finally {
    // A diagnostic callback must never change the success/failure of game work.
    try { recorder.onMeasure({ name, startTime: start, duration: recorder.now() - start }); }
    catch { /* The game result is authoritative even if diagnostics fail. */ }
  }
}
