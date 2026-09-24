import { requestSimulationFrameYield } from './simulationCooperativeYieldRuntime';
import { measureObserverWork } from './observerWorkMeasurementRuntime';

// Scheduling affects responsiveness only, never route choices or RNG. The
// iterator holds uncommitted results; cancelling discards them as a whole.
export async function runMapPreparationSteps(steps, {
  isCurrent = () => true,
  yieldFrame = requestSimulationFrameYield,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  sliceMs = 8,
} = {}) {
  try {
    const initialYield = yieldFrame();
    if (initialYield) await initialYield;
    while (isCurrent()) {
      const started = now();
      const step = measureObserverWork('map-preparation-slice', () => {
        let current;
        do {
          current = steps.next();
        } while (!current.done && now() - started < sliceMs);
        return current;
      });
      if (!isCurrent()) return { ok: false, cancelled: true };
      if (step.done) return { ok: true, value: step.value };
      const pending = yieldFrame();
      if (pending) await pending;
    }
    return { ok: false, cancelled: true };
  } finally {
    steps.return?.();
  }
}
