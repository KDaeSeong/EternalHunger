import { useMemo } from 'react';
import { createSimulationEventActions } from './simulationEventActionsRuntime.js';

export function useSimulationEventActions({
  addLog,
  emitRunEvent,
} = {}) {
  return useMemo(() => createSimulationEventActions({ addLog, emitRunEvent }), [addLog, emitRunEvent]);
}
