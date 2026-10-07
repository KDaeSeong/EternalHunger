// Optional local diagnostic only. No clock reads, engine state writes or random
// draws occur when the query-gated observer panel is not recording.
let activeRecorder = null;

export function subscribeObserverWorkMeasurements(now, onMeasure, onWait) {
  const recorder = { now, onMeasure, onWait };
  activeRecorder = recorder;
  return () => { if (activeRecorder === recorder) activeRecorder = null; };
}

// Measure a browser/task wait separately from synchronous work. The disabled
// path deliberately returns the original value without reading a clock or
// wrapping a Promise. A recorder is only allowed to observe settlement; it
// cannot replace the request's fulfillment value or rejection reason.
export function measureObserverWait(name, requestWait) {
  const recorder = activeRecorder;
  if (!recorder?.onWait) return requestWait();
  const wait = requestWait();
  if (wait == null) return wait;
  let then;
  try { then = wait.then; }
  catch { return wait; }
  if (typeof then !== 'function') return wait;
  let startTime;
  try {
    startTime = Number(recorder.now());
    if (!Number.isFinite(startTime)) return wait;
  } catch { return wait; }
  const recordSettlement = () => {
    // A disposed or replaced probe must not even read its old diagnostic clock.
    if (activeRecorder !== recorder) return;
    try {
      const endTime = Number(recorder.now());
      if (!Number.isFinite(endTime)) return;
      recorder.onWait({ name, startTime, duration: Math.max(0, endTime - startTime) });
    } catch { /* Diagnostics never alter the requested wait's outcome. */ }
  };
  // Start after request creation, but before registering the continuation: the
  // async wait is measured, not synchronous setup in requestWait(). Always
  // return a Promise that waits for settlement, even if a thenable's `then`
  // method only registers callbacks and returns undefined.
  return new Promise((resolve, reject) => {
    let settled = false;
    const fulfill = (value) => {
      if (settled) return;
      settled = true;
      recordSettlement();
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      recordSettlement();
      reject(error);
    };
    try { then.call(wait, fulfill, fail); }
    catch (error) { fail(error); }
  });
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
