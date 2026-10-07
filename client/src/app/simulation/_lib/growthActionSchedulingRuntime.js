import { requestSimulationFrameYield, requestSimulationMainThreadYield } from './simulationCooperativeYieldRuntime.js';
import { measureObserverWait, measureObserverWork } from './observerWorkMeasurementRuntime.js';

// Keep one policy for the whole phase, not one per growth batch. At x32,
// waiting for a new RAF after EVERY 8ms computation slice would impose a
// display-refresh bottleneck unrelated to the requested simulation speed.
// Still yield a task after every slice and request a frame opportunity at a
// bounded wall-clock interval. These values never enter the match clock/RNG.
// Other speeds keep the existing frame-yield behavior without reading a clock.
export function createHighSpeedGrowthYield({
  readSpeed = () => 1,
  visibility = () => globalThis.window?.document?.visibilityState ?? null,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  requestTaskYield = requestSimulationMainThreadYield,
  requestFrameYield = requestSimulationFrameYield,
  frameIntervalMs = 32,
} = {}) {
  const interval = Number.isFinite(Number(frameIntervalMs)) ? Math.max(1, Number(frameIntervalMs)) : 32;
  let frameCompletedAt = null;
  const readClock = () => {
    try {
      const value = typeof now === 'function' ? Number(now()) : NaN;
      return Number.isFinite(value) ? value : null;
    } catch { return null; }
  };
  const requestFrame = () => {
    const pause = measureObserverWait('yield.growth.frame', requestFrameYield);
    if (!pause?.then) return pause;
    return Promise.resolve(pause).then((value) => {
      frameCompletedAt = readClock();
      return value;
    });
  };
  return () => {
    if (Number(readSpeed()) !== 32) {
      frameCompletedAt = null;
      return measureObserverWait('yield.growth.frame', requestFrameYield);
    }
    if (visibility() !== 'visible') {
      frameCompletedAt = null;
      return measureObserverWait('yield.growth.task', requestTaskYield);
    }
    const wall = readClock();
    if (wall === null || frameCompletedAt === null || wall < frameCompletedAt
      || wall - frameCompletedAt >= interval) return requestFrame();
    return measureObserverWait('yield.growth.task', requestTaskYield);
  };
}

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
