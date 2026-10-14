import { runSimulationPhaseCycle } from './simulationPhaseCycleRuntime.js';
import { createSimulationEventActions } from './simulationEventActionsRuntime.js';
import { prepareSimulationRunInput } from './simulationReplayRuntime.js';
import { projectSimulationFrame } from './simulationFrameRuntime.js';
import { normalizeAutoSpeed } from './simulationSpeedRuntime.js';
import { captureSimulationPhaseWorkerRefState, restoreSimulationPhaseWorkerOptions } from './simulationPhaseWorkerInputRuntime.js';

// No UI/account callbacks enter this host. Native postMessage is the synchronous
// ownership boundary for frames, action arguments and the final RNG state.
export function createSimulationPhaseWorkerRuntime({
  send,
  now = () => globalThis.performance.now(),
  taskYield = () => new Promise((resolve) => globalThis.setTimeout(resolve, 0)),
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
        requestMainThreadYield: taskYield,
        requestFrameYield: taskYield,
        growthYieldOptions: { visibility: () => controls.visibility,
          now, requestTaskYield: taskYield, requestFrameYield: taskYield },
        visibleClockNow: now,
        visibleClockVisibility: () => controls.visibility,
        waitForVisibleTick: (ms) => ms > 0 ? wait(ms) : taskYield(),
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
