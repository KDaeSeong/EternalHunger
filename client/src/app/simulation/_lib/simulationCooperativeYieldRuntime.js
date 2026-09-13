// Keep browser-only scheduling outside the deterministic engine state.  A
// generator yields the returned promise, so runSimulationSteps removes the
// active match RNG while the browser gets a chance to paint and handle input.
// Headless checks deliberately receive null and never pay for real timers.
export function requestSimulationMainThreadYield({
  windowRef = globalThis.window,
  schedulerRef = globalThis.scheduler,
} = {}) {
  if (!windowRef) return null;
  if (typeof schedulerRef?.yield === 'function') return schedulerRef.yield();
  if (typeof windowRef.setTimeout !== 'function') return null;
  return new Promise((resolve) => windowRef.setTimeout(resolve, 0));
}
