// Growth decisions share the match clock with combat. Advancing the same clock
// twice is idempotent; no phase setup, rewards or spawns belong in this loop.
export function lockActorActionTime(actors, nowSec, seconds) {
  const until = Math.round((Number(nowSec || 0) + Math.max(0, Number(seconds) || 0)) * 1e6) / 1e6;
  for (const actor of actors) {
    if (actor) actor._actionReadyAtSec = Math.max(Number(actor._actionReadyAtSec || 0), until);
  }
  return until;
}

export function createPhaseActionTimeline({ durationSec, intervalSec = 20, onGrowth = () => {}, onGrowthSteps, onElapsed = () => {} }) {
  // Combat can end at a fractional second; never silently drop the final
  // part of the same world clock (movement, effects and cooldowns).
  const duration = Number.isFinite(Number(durationSec))
    ? Math.max(0, Math.round(Number(durationSec) * 1e6) / 1e6) : 0;
  const interval = Math.max(1, Math.floor(Number(intervalSec) || 20));
  let cursor = 0;
  let nextGrowth = 0;
  let advancing = false;
  let interruptedGrowth = false;
  function* advanceToSteps(offsetSec) {
    if (advancing) throw new Error('The phase clock is already advancing.');
    // A cancelled/failed growth batch may have consumed shared resources. It
    // cannot be retried on this timeline as if it had never started.
    if (interruptedGrowth) throw new Error('The phase growth batch was interrupted.');
    advancing = true;
    try {
      const target = Math.max(cursor, Math.min(duration, Number(offsetSec) || 0));
      while (cursor <= target) {
        if (cursor === nextGrowth && cursor < duration) {
          if (onGrowthSteps) {
            interruptedGrowth = true;
            yield* onGrowthSteps(cursor);
            interruptedGrowth = false;
          } else onGrowth(cursor);
          nextGrowth += interval;
        }
        if (cursor >= target) break;
        const end = Math.min(target, nextGrowth, Math.floor(cursor) + 1);
        onElapsed(cursor, Math.round((end - cursor) * 1e6) / 1e6);
        cursor = end;
      }
      return cursor;
    } finally { advancing = false; }
  }
  return {
    advanceToSteps,
    advanceTo(offsetSec) {
      if (onGrowthSteps) throw new Error('Cooperative growth requires advanceToSteps.');
      return advanceToSteps(offsetSec).next().value;
    },
  };
}
