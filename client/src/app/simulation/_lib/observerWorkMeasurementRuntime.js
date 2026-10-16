// Optional local diagnostic only. No clock reads, engine state writes or random
// draws occur when the query-gated observer panel is not recording.
let activeRecorder = null;

export function subscribeObserverWorkMeasurements(now, onMeasure, onWait, onWorker) {
  const recorder = { now, onMeasure, onWait, onWorker,
    workerToken: typeof onWorker === 'function' ? {} : null };
  activeRecorder = recorder;
  return () => { if (activeRecorder === recorder) activeRecorder = null; };
}

export function captureObserverWorkerMeasurementToken() {
  return typeof activeRecorder?.onWorker === 'function' ? activeRecorder.workerToken : null;
}

export function readObserverWorkerMeasurementTime(token) {
  const recorder = activeRecorder;
  if (typeof recorder?.onWorker !== 'function' || recorder.workerToken !== token) return null;
  try {
    const value = Number(recorder.now());
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

export function publishObserverWorkerMeasurement(token, entry) {
  const recorder = activeRecorder;
  if (typeof recorder?.onWorker !== 'function' || recorder.workerToken !== token) return false;
  try { recorder.onWorker(entry); } catch { /* Diagnostics cannot affect game results. */ }
  return true;
}

const WORKER_DIAGNOSTIC_MAX_STAGES = 24;
const WORKER_DIAGNOSTIC_MAX_MESSAGES = 32;
const WORKER_DIAGNOSTIC_NAME_LIMIT = 80;
const WORKER_DIAGNOSTIC_NUMBER_LIMIT = Number.MAX_SAFE_INTEGER;

export function createObserverWorkerPhaseMeasurements({ now, send, taskYield, wait } = {}) {
  let disposed = false;
  let clockValid = true;
  let startedAt = null;
  let lastClock = null;
  const stages = new Map();
  const messages = new Map();
  const waits = { task: makeStats(), display: makeStats() };
  const readClock = () => {
    if (disposed || !clockValid) return null;
    try {
      const value = Number(now());
      if (!Number.isFinite(value) || (lastClock !== null && value < lastClock)) {
        clockValid = false;
        return null;
      }
      lastClock = value;
      if (startedAt === null) startedAt = value;
      return value;
    } catch { clockValid = false; return null; }
  };
  const add = (stats, duration) => {
    stats.count = Math.min(WORKER_DIAGNOSTIC_NUMBER_LIMIT, stats.count + 1);
    if (!Number.isFinite(duration) || duration < 0) return;
    stats.measuredCount = Math.min(WORKER_DIAGNOSTIC_NUMBER_LIMIT, stats.measuredCount + 1);
    stats.totalMs = Math.min(WORKER_DIAGNOSTIC_NUMBER_LIMIT, stats.totalMs + duration);
    stats.maxMs = Math.min(WORKER_DIAGNOSTIC_NUMBER_LIMIT, Math.max(stats.maxMs, duration));
  };
  const safeMeasure = (map, name, duration) => {
    try {
      const boundedName = String(name).slice(0, WORKER_DIAGNOSTIC_NAME_LIMIT);
      let stats = map.get(boundedName);
      if (!stats && map.size < (map === stages ? WORKER_DIAGNOSTIC_MAX_STAGES : WORKER_DIAGNOSTIC_MAX_MESSAGES)) {
        stats = makeStats(); map.set(boundedName, stats);
      }
      if (stats) add(stats, duration);
    } catch { /* Diagnostic aggregation is best effort. */ }
  };
  const observeWait = (kind, request) => {
    let result;
    try { result = request(); } catch (error) { throw error; }
    const before = readClock();
    const then = (() => { try { return result?.then; } catch { return null; } })();
    if (typeof then !== 'function') {
      const after = readClock();
      add(waits[kind], before === null || after === null ? null : after - before);
      return result;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const after = readClock();
      add(waits[kind], before === null || after === null ? null : after - before);
    };
    try { then.call(result, finish, finish); } catch { /* Preserve the original thenable and its contract. */ }
    return result;
  };
  readClock();
  // Reuse existing phase work instrumentation without retaining phase objects.
  const unsubscribe = subscribeObserverWorkMeasurements(now, ({ name, duration }) => safeMeasure(stages, name, duration));
  const measuredSend = (message) => {
    const before = readClock();
    let result;
    try { result = send(message); }
    finally {
      const after = readClock();
      safeMeasure(messages, message?.kind, before === null || after === null ? null : after - before);
    }
    return result;
  };
  const measuredTaskYield = () => observeWait('task', taskYield);
  const measuredWait = (ms) => observeWait('display', () => wait(ms));
  const work = (name, fn) => measureObserverWork(name, fn);
  const snapshot = (status) => {
    try {
      const end = readClock();
      const elapsedMs = startedAt === null || end === null ? null
        : Math.min(WORKER_DIAGNOSTIC_NUMBER_LIMIT, Math.max(0, end - startedAt));
      const statsRows = (map) => [...map.entries()].map(([name, value]) => ({ name, ...valueSnapshot(value) }));
      const waitRows = (value) => valueSnapshot(value);
      const msgRows = [...messages.entries()].map(([kind, value]) => ({ kind, ...valueSnapshot(value) }));
      return { schema: 'eh-worker-phase-performance.v1', status, elapsedMs,
        elapsedIncludesNestedStagesAndWaits: true, detailDurationsAreNonAdditive: true,
        hostWaits: { task: waitRows(waits.task), display: waitRows(waits.display) },
        stages: statsRows(stages), messagesBeforeTerminal: msgRows,
        terminalMessageTiming: 'excluded; snapshot precedes terminal send' };
    } catch {
      return { schema: 'eh-worker-phase-performance.v1', status, elapsedMs: null,
        elapsedIncludesNestedStagesAndWaits: true, detailDurationsAreNonAdditive: true,
        hostWaits: { task: null, display: null },
        stages: [], messagesBeforeTerminal: [], terminalMessageTiming: 'excluded; snapshot precedes terminal send' };
    }
  };
  const dispose = () => { if (disposed) return; disposed = true; unsubscribe(); };
  return { send: measuredSend, taskYield: measuredTaskYield, wait: measuredWait, work, snapshot, dispose };
}

function makeStats() { return { count: 0, measuredCount: 0, totalMs: 0, maxMs: 0 }; }
function valueSnapshot(value) {
  return { count: value.count, measuredCount: value.measuredCount,
    totalMs: value.measuredCount ? value.totalMs : null, maxMs: value.measuredCount ? value.maxMs : null };
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
