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

// Phase setup and the first growth pass can otherwise share one long animation
// frame even when scheduler.yield() splits them into separate tasks. Let a
// visible document reach RAF, then resume in a task (not its RAF microtasks).
// This is a rendering opportunity, not proof that pixels have been presented.
// Keep ordinary action-frame yields fast; use this at phase preparation and
// between budgeted growth slices, without advancing the match clock.
export function requestSimulationFrameYield({
  windowRef = globalThis.window,
  schedulerRef = globalThis.scheduler,
  documentRef = windowRef?.document,
} = {}) {
  if (documentRef?.visibilityState !== 'visible'
    || typeof windowRef?.requestAnimationFrame !== 'function'
    || typeof windowRef?.cancelAnimationFrame !== 'function'
    || typeof windowRef?.setTimeout !== 'function'
    || typeof windowRef?.clearTimeout !== 'function') {
    return requestSimulationMainThreadYield({ windowRef, schedulerRef });
  }
  return new Promise((resolve) => {
    let frameId = null, fallbackId = null, resumeId = null, finished = false;
    let onVisibilityChange = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (frameId !== null) windowRef.cancelAnimationFrame(frameId);
      if (fallbackId !== null) windowRef.clearTimeout(fallbackId);
      if (resumeId !== null) windowRef.clearTimeout(resumeId);
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
      resolve();
    };
    onVisibilityChange = () => {
      if (documentRef.visibilityState !== 'visible') finish();
    };
    documentRef.addEventListener?.('visibilitychange', onVisibilityChange);
    // RAF may be suspended after scheduling. Do not make simulation progress
    // depend on an animation callback; normal browser timer throttling applies.
    fallbackId = windowRef.setTimeout(finish, 100);
    const afterFrame = () => {
      frameId = null;
      if (!finished) resumeId = windowRef.setTimeout(finish, 0);
    };
    try { frameId = windowRef.requestAnimationFrame(afterFrame); }
    catch { resumeId = windowRef.setTimeout(finish, 0); }
  });
}
