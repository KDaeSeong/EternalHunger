// Display scheduling only: these wall-clock values must never enter the match
// clock, saved frames, decisions or RNG. Headless checks have no browser clock.
export function createVisibleClockPacer({
  now = typeof window === 'undefined' ? null : () => performance.now(),
  visibility = () => globalThis.document?.visibilityState ?? null,
  maxLagMs = 250,
} = {}) {
  const readNow = () => {
    if (typeof now !== 'function') return null;
    const value = Number(now());
    return Number.isFinite(value) ? value : null;
  };
  let deadlineMs = readNow();
  let committedWallMs = deadlineMs;
  let previousSpeed = null;
  let previousVisibility = visibility();

  const reset = (wallMs = readNow()) => {
    deadlineMs = wallMs;
    committedWallMs = wallMs;
    previousSpeed = null;
    previousVisibility = visibility();
  };

  return {
    reset,
    getDelayMs(elapsedSec, speed) {
      const elapsed = Number(elapsedSec);
      if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
      const rate = Math.max(1, Math.min(32, Number(speed) || 1));
      const budgetMs = 1000 * elapsed / rate;
      const wallMs = readNow();
      // Virtual/headless waits retain their elapsed-time callback contract.
      if (wallMs === null) { reset(null); return Math.max(1, Math.round(budgetMs)); }
      const currentVisibility = visibility();
      if (deadlineMs === null || (committedWallMs !== null && wallMs < committedWallMs)
        || currentVisibility !== previousVisibility) reset(wallMs);
      // A new speed applies only to the next interval, not to old display debt.
      if (previousSpeed !== null && previousSpeed !== rate) deadlineMs = committedWallMs;
      previousSpeed = rate;
      previousVisibility = currentVisibility;
      deadlineMs += budgetMs;
      // A suspended tab or long stall must not build an unbounded catch-up burst.
      if (wallMs - deadlineMs > maxLagMs) deadlineMs = wallMs;
      return Math.max(0, Math.ceil(deadlineMs - wallMs));
    },
    markCommitted() {
      const wallMs = readNow();
      if (wallMs === null || (committedWallMs !== null && wallMs < committedWallMs)) reset(wallMs);
      else committedWallMs = wallMs;
    },
  };
}
