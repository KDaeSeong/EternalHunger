import { requestSimulationFrameYield } from './simulationCooperativeYieldRuntime.js';
import { measureObserverWork } from './observerWorkMeasurementRuntime.js';

// Drive this generator with runSimulationSteps (or yield* from its caller),
// never an async callback that keeps the match RNG installed while awaiting.
// Individual decisions are indivisible; the budget limits work BETWEEN them.
export function* runGrowthActionSteps(steps, {
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  requestYield = requestSimulationFrameYield,
  sliceBudgetMs = 8,
} = {}) {
  const budget = Number.isFinite(Number(sliceBudgetMs)) ? Math.max(1, Number(sliceBudgetMs)) : 8;
  let completed = false;
  try {
    while (true) {
      const result = measureObserverWork('growth.slice', () => {
        const start = now();
        let step;
        do { step = steps.next(); }
        while (!step.done && now() - start < budget);
        return step;
      });
      if (result.done) {
        completed = true;
        return result.value;
      }
      const pause = requestYield();
      if (pause) yield pause;
    }
  } finally {
    if (!completed) steps.return?.();
  }
}
