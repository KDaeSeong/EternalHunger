import { applySimulationPhaseWorkerRefState } from './simulationPhaseWorkerInputRuntime.js';
import { publishSimulationFrame } from './simulationFrameRuntime.js';
import { captureObserverWorkerMeasurementToken, readObserverWorkerMeasurementTime,
  publishObserverWorkerMeasurement, measureObserverWork } from './observerWorkMeasurementRuntime.js';

const ACTIONS = new Set(['addLog', 'emitRunEvent', 'resetPhaseLogs', 'applyUserEconomyProgress',
  'persistSimEquipmentsFromChars', 'setPendingTranscendPick']);
let workerMeasurementSerial = 0;

function startWorkerMeasurement(phaseId) {
  const token = captureObserverWorkerMeasurementToken();
  if (!token) return null;
  const measurement = { token, id: ++workerMeasurementSerial, phaseId,
    startedAt: readObserverWorkerMeasurementTime(token), ended: false };
  publishObserverWorkerMeasurement(token, { kind: 'start', id: measurement.id, phaseId });
  return measurement;
}

function finishWorkerMeasurement(run, diagnostics, kind = 'terminal') {
  const measurement = run?.measurement;
  if (!measurement || measurement.ended) return;
  measurement.ended = true;
  const endedAt = readObserverWorkerMeasurementTime(measurement.token);
  const elapsed = measurement.startedAt != null && endedAt != null ? endedAt - measurement.startedAt : null;
  publishObserverWorkerMeasurement(measurement.token, { kind, id: measurement.id, phaseId: measurement.phaseId,
    clientElapsedMs: elapsed != null && elapsed >= 0 ? elapsed : null, diagnostics });
}

function postWorkerMessage(worker, message) {
  if (captureObserverWorkerMeasurementToken()) {
    return measureObserverWork(`worker.postMessage.${message.kind}`, () => worker.postMessage(message));
  }
  return worker.postMessage(message);
}

function workerError(code, cause) {
  const error = new Error(code === 'PHASE_WORKER_STARTUP'
    ? '독립 경기 실행을 시작할 수 없습니다.'
    : '경기 계산이 중단되었습니다. 기록을 저장한 뒤 새 경기를 시작해 주세요.');
  error.code = code;
  error.cause = cause;
  return error;
}

// Native worker messages already own their data. Only rendering is coalesced;
// every log/event and the final frame are applied in the original FIFO order.
export function createSimulationPhaseWorkerClient({
  createWorker,
  scheduleFrame = (callback) => globalThis.requestAnimationFrame?.(callback),
  cancelFrame = (id) => globalThis.cancelAnimationFrame?.(id),
  scheduleTimeout = (callback, ms) => globalThis.setTimeout(callback, ms),
  cancelTimeout = (id) => globalThis.clearTimeout(id),
  startupTimeoutMs = 5000,
} = {}) {
  let worker = null, ready = null, readyTimer = null, rejectReady = null;
  let resolveReady = null, phaseId = 0, active = null;
  let frameId = null, frameTimer = null, disposed = false, starting = false;
  let controls = { visibility: 'visible' };
  let messageListener = null, errorListener = null;
  let runInputPosted = false;

  function cancelPublication() {
    if (frameId !== null && frameId !== undefined) cancelFrame(frameId);
    if (frameTimer !== null) cancelTimeout(frameTimer);
    frameId = null;
    frameTimer = null;
  }
  function flushFrame() {
    cancelPublication();
    if (!active?.frame) return;
    const frame = active.frame;
    active.frame = null;
    publishSimulationFrame(frame, active.actions);
  }
  function closeWorker() {
    if (readyTimer !== null) cancelTimeout(readyTimer);
    readyTimer = null;
    if (worker) {
      worker.removeEventListener('message', messageListener);
      worker.removeEventListener('error', errorListener);
      worker.removeEventListener('messageerror', errorListener);
      worker.terminate();
    }
    worker = null;
    runInputPosted = false;
    ready = null;
    resolveReady = null;
    rejectReady = null;
  }
  function fail(cause, overrideCode) {
    const run = active;
    finishWorkerMeasurement(run, null, 'client-failure');
    const code = overrideCode || (run?.posted ? 'PHASE_WORKER_EXECUTION' : 'PHASE_WORKER_STARTUP');
    const error = workerError(code, cause);
    const rejectStartup = rejectReady;
    // A valid, already-owned last frame remains useful on execution failure.
    // Cancelling a component must not publish into that disposed component.
    if (run?.frame && code !== 'PHASE_WORKER_DISPOSED') {
      try { flushFrame(); } catch { /* Preserve the authoritative failure. */ }
    }
    cancelPublication();
    if (run) run.frame = null;
    active = null;
    closeWorker();
    rejectStartup?.(error);
    run?.reject(error);
  }
  function publishLater(frame) {
    active.frame = frame;
    if (frameTimer !== null) return;
    // Hidden/suspended documents must still receive a bounded publication.
    frameTimer = scheduleTimeout(() => {
      try { flushFrame(); } catch (error) { fail(error); }
    }, 100);
    frameId = scheduleFrame(() => {
      try { flushFrame(); } catch (error) { fail(error); }
    });
  }
  function receive(target, message) {
    if (target !== worker || disposed) return;
    if (message?.kind === 'ready' && resolveReady) {
      if (readyTimer !== null) cancelTimeout(readyTimer);
      readyTimer = null;
      const resolve = resolveReady;
      resolveReady = null;
      rejectReady = null;
      resolve();
      return;
    }
    if (!active || message?.phaseId !== active.id) return;
    try {
      if (message.seq !== active.seq + 1) throw new Error('Invalid phase message sequence.');
      active.seq = message.seq;
      if (message.kind === 'frame') {
        publishLater(message.frame);
      } else if (message.kind === 'action') {
        if (!ACTIONS.has(message.name) || !Array.isArray(message.args)) throw new Error('Invalid phase action.');
        const result = active.actions[message.name]?.(...message.args);
        // Equipment persistence was already fire-and-forget in finalization.
        if (message.name === 'persistSimEquipmentsFromChars') result?.catch?.(() => {});
      } else if (message.kind === 'finish') {
        if (active.finished || !Array.isArray(message.args)) throw new Error('Duplicate phase finish.');
        active.finished = true;
        flushFrame();
        applySimulationPhaseWorkerRefState(message.refState, active.refs);
        const result = active.actions.finishGame?.(...message.args);
        active.finishResult = Promise.resolve(result);
        // The complete branch awaits this result; attach a rejection observer
        // now so an async host failure is not reported as an unhandled promise.
        active.finishResult.catch(() => {});
      } else if (message.kind === 'complete') {
        if (active.completing) throw new Error('Duplicate phase completion.');
        active.completing = true;
        finishWorkerMeasurement(active, message.diagnostics);
        flushFrame();
        applySimulationPhaseWorkerRefState(message.refState, active.refs);
        const run = active;
        Promise.resolve(run.finishResult).then(() => {
          if (active !== run) return;
          active = null;
          if (run.finished) closeWorker();
          run.resolve();
        }, fail);
      } else if (message.kind === 'failed') {
        finishWorkerMeasurement(active, message.diagnostics);
        flushFrame();
        if (message.refState) applySimulationPhaseWorkerRefState(message.refState, active.refs);
        throw new Error(String(message.message || 'Phase worker failed.'));
      } else throw new Error('Unknown phase message.');
    } catch (error) { fail(error); }
  }
  function startWorker() {
    if (ready) return ready;
    try {
      worker = createWorker();
      const target = worker;
      ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      messageListener = (event) => receive(target, event.data);
      errorListener = (event) => { event.preventDefault?.(); if (target === worker) fail(event.error || event); };
      worker.addEventListener('message', messageListener);
      worker.addEventListener('error', errorListener);
      worker.addEventListener('messageerror', errorListener);
      readyTimer = scheduleTimeout(() => fail(new Error('Phase worker startup timed out.')), startupTimeoutMs);
      return ready;
    } catch (error) {
      closeWorker();
      throw workerError('PHASE_WORKER_STARTUP', error);
    }
  }
  async function runPhase({ command, actions = {}, refs = {} } = {}) {
    if (disposed) throw workerError('PHASE_WORKER_DISPOSED', new Error('Disposed phase client.'));
    if (active || starting) throw workerError('PHASE_WORKER_EXECUTION', new Error('Overlapping phase.'));
    if (command?.frame?.day === 0 && worker) closeWorker();
    starting = true;
    try { await startWorker(); } finally { starting = false; }
    if (disposed) throw workerError('PHASE_WORKER_DISPOSED', new Error('Disposed phase client.'));
    return new Promise((resolve, reject) => {
      active = { id: ++phaseId, seq: 0, actions, refs, resolve, reject,
        frame: null, finished: false, finishResult: null, posted: false, completing: false };
      active.measurement = startWorkerMeasurement(active.id);
      try {
        postWorkerMessage(worker, { kind: 'controls', controls });
        // This worker prepares the immutable run input once. Every phase still
        // transfers its complete current frame, controls, flags and RNG state.
        const workerCommand = { ...command };
        if (runInputPosted) delete workerCommand.input;
        const message = { kind: 'phase', phaseId, command: workerCommand };
        if (active.measurement) message.diagnostics = true;
        postWorkerMessage(worker, message);
        if (command.input !== undefined) runInputPosted = true;
        active.posted = true;
      } catch (error) { fail(error); }
    });
  }
  function updateControls(next) {
    controls = { ...controls, ...next };
    try { if (worker) postWorkerMessage(worker, { kind: 'controls', controls }); }
    catch (error) { fail(error); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (active || rejectReady) fail(new Error('Phase client disposed.'), 'PHASE_WORKER_DISPOSED');
    else closeWorker();
    cancelPublication();
  }
  return { runPhase, updateControls, dispose };
}
