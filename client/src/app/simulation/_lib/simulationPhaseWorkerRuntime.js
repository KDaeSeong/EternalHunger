import { runSimulationPhaseCycle } from './simulationPhaseCycleRuntime.js';
import { createSimulationEventActions } from './simulationEventActionsRuntime.js';
import { prepareSimulationRunInput } from './simulationReplayRuntime.js';
import { projectSimulationFrame } from './simulationFrameRuntime.js';
import { normalizeAutoSpeed } from './simulationSpeedRuntime.js';
import { captureSimulationPhaseWorkerRefState, restoreSimulationPhaseWorkerOptions } from './simulationPhaseWorkerInputRuntime.js';

export function requestSimulationWorkerTaskYield({
  schedulerRef = globalThis.scheduler,
  scheduleTimeout = (callback, ms) => globalThis.setTimeout(callback, ms),
} = {}) {
  if (typeof schedulerRef?.yield === 'function') return schedulerRef.yield();
  return new Promise((resolve) => scheduleTimeout(resolve, 0));
}

const PHASE_TASK_YIELD_INTERVAL_MS = 8;

// Coalesce only routine action-loop yields. Explicit frame/setup/growth yields
// and every positive display-clock wait retain their own task boundary.
export function createSimulationPhaseWorkerYieldPolicy({
  taskYield = requestSimulationWorkerTaskYield,
  wait = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, ms))),
  now = () => globalThis.performance.now(),
} = {}) {
  const interval = PHASE_TASK_YIELD_INTERVAL_MS;
  const readClock = () => {
    try {
      const value = typeof now === 'function' ? Number(now()) : NaN;
      return Number.isFinite(value) ? value : null;
    } catch { return null; }
  };
  let lastYieldAt = readClock();
  const markCompleted = () => { lastYieldAt = readClock(); };
  const markAfterSuccess = (result) => {
    if (result && typeof result.then === 'function') {
      return result.then((value) => { markCompleted(); return value; });
    }
    markCompleted();
    return result;
  };
  const requestTaskYield = () => markAfterSuccess(taskYield());
  const requestMainThreadYield = () => {
    const current = readClock();
    if (current === null || lastYieldAt === null || current < lastYieldAt
      || current - lastYieldAt >= interval) return requestTaskYield();
    return null;
  };
  const waitForVisibleTick = (ms) => ms > 0
    ? markAfterSuccess(wait(ms))
    : requestMainThreadYield();
  return { requestMainThreadYield, requestFrameYield: requestTaskYield, requestTaskYield,
    waitForVisibleTick };
}

// No UI/account callbacks enter this host. Native postMessage is the synchronous
// ownership boundary for frames, action arguments and the final RNG state.
export function createSimulationPhaseWorkerRuntime({
  send,
  now = () => globalThis.performance.now(),
  taskYield = requestSimulationWorkerTaskYield,
  wait = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, ms))),
} = {}) {
  let prepared = null;
  let busy = false;
  let options = null;
  let controls = { visibility: 'visible' };

  async function receive(message) {
    if (message?.kind === 'controls') {
      controls = { ...controls, ...message.controls };
      if (options?.refs.autoSpeedRef && message.controls?.autoSpeed !== undefined) {
        options.refs.autoSpeedRef.current = message.controls.autoSpeed;
      }
      return;
    }
    if (message?.kind !== 'phase') return;
    const { phaseId, command } = message;
    let seq = 0;
    const emit = (kind, payload = {}) => send({ kind, phaseId, seq: ++seq, ...payload });
    if (busy) {
      emit('failed', { message: 'A simulation phase is already running.' });
      return;
    }
    busy = true;
    try {
      // Main starts a new worker for a new run; later phases reuse this private
      // immutable catalogue/navigation preparation, never UI-owned objects.
      prepared ||= prepareSimulationRunInput(command.input);
      options = restoreSimulationPhaseWorkerOptions(command, prepared);
      if (controls.autoSpeed !== undefined) options.refs.autoSpeedRef.current = controls.autoSpeed;
      const yieldPolicy = createSimulationPhaseWorkerYieldPolicy({ taskYield, wait, now });
      const emitAction = (name, ...args) => emit('action', { name, args });
      const addLog = (text, type = 'normal') => {
        options.refs.fullLogEntriesRef.current.push({ text: String(text || ''), type: String(type || 'normal') });
        emitAction('addLog', text, type);
      };
      const emitRunEvent = (...args) => emitAction('emitRunEvent', ...args);
      options.actions = {
        ...createSimulationEventActions({ addLog, emitRunEvent }),
        addLog, emitRunEvent, normalizeAutoSpeed,
        resetPhaseLogs: () => emitAction('resetPhaseLogs'),
        applyUserEconomyProgress: (...args) => emitAction('applyUserEconomyProgress', ...args),
        persistSimEquipmentsFromChars: (...args) => {
          emitAction('persistSimEquipmentsFromChars', ...args);
          return Promise.resolve();
        },
        setPendingTranscendPick: (...args) => emitAction('setPendingTranscendPick', ...args),
        finishGame: (...args) => emit('finish', { args, refState: captureSimulationPhaseWorkerRefState(options.refs) }),
        publishSimulationFrameFromSource: (input, observe) => {
          const frame = projectSimulationFrame(input);
          observe(frame);
          emit('frame', { frame });
        },
        requestMainThreadYield: yieldPolicy.requestMainThreadYield,
        requestFrameYield: yieldPolicy.requestFrameYield,
        growthYieldOptions: { visibility: () => controls.visibility,
          now, requestTaskYield: yieldPolicy.requestTaskYield, requestFrameYield: yieldPolicy.requestFrameYield },
        visibleClockNow: now,
        visibleClockVisibility: () => controls.visibility,
        waitForVisibleTick: yieldPolicy.waitForVisibleTick,
      };
      await runSimulationPhaseCycle(options);
      emit('complete', { refState: captureSimulationPhaseWorkerRefState(options.refs) });
    } catch (error) {
      emit('failed', { message: String(error?.message || error),
        refState: options ? captureSimulationPhaseWorkerRefState(options.refs) : null });
    } finally {
      busy = false;
      options = null;
    }
  }
  return { receive };
}
