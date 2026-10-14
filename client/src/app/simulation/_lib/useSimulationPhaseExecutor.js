import { useEffect, useRef } from 'react';
import { runSimulationPhaseCycle } from './simulationPhaseCycleRuntime.js';
import { createSimulationPhaseWorkerClient } from './simulationPhaseWorkerClientRuntime.js';
import { createSimulationPhaseWorkerCommand } from './simulationPhaseWorkerInputRuntime.js';

export function useSimulationPhaseExecutor({ autoSpeed = 1 } = {}) {
  const clientRef = useRef(null);
  const unavailableRef = useRef(false);
  const failedInputRef = useRef(null);
  useEffect(() => {
    const update = () => clientRef.current?.updateControls({ autoSpeed,
      visibility: document.visibilityState });
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [autoSpeed]);
  useEffect(() => () => {
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  const executePhase = async function executePhase(options) {
    const input = options.refs?.runInputRef?.current;
    if (input && failedInputRef.current === input) {
      const error = new Error('중단된 경기는 이어서 실행할 수 없습니다. 기록을 저장한 뒤 새 경기를 시작해 주세요.');
      error.code = 'PHASE_WORKER_EXECUTION';
      options.actions.setAutoPlay?.(false);
      throw error;
    }
    if (!input || unavailableRef.current || typeof Worker !== 'function') {
      return runSimulationPhaseCycle(options);
    }
    if (!clientRef.current) clientRef.current = createSimulationPhaseWorkerClient({
      createWorker: () => new Worker(new URL('./simulationPhaseWorker.js', import.meta.url), { type: 'module' }),
    });
    clientRef.current.updateControls({ autoSpeed: options.refs.autoSpeedRef?.current || autoSpeed,
      visibility: document.visibilityState });
    try {
      const command = createSimulationPhaseWorkerCommand({ input, state: options.state, refs: options.refs });
      return await clientRef.current.runPhase({ command, actions: options.actions, refs: options.refs });
    } catch (error) {
      clientRef.current?.dispose();
      clientRef.current = null;
      if (error.code === 'PHASE_WORKER_DISPOSED') return;
      if (error.code !== 'PHASE_WORKER_STARTUP') {
        failedInputRef.current = input;
        options.actions.setAutoPlay?.(false);
        options.actions.addLog?.('⚠️ 경기 계산이 중단되었습니다. 기록을 저장한 뒤 새 경기를 시작해 주세요.', 'system');
        throw error;
      }
      // Before the phase command is accepted, no engine action or reward exists.
      // Mid-phase failures never enter this fallback and cannot duplicate a run.
      unavailableRef.current = true;
      return runSimulationPhaseCycle(options);
    }
  };
  // The outer start guard must reject a failed run before it can reset the
  // run_start journal (including a failure before the first published frame).
  executePhase.isRunFailed = (input) => Boolean(input && failedInputRef.current === input);
  return executePhase;
}
