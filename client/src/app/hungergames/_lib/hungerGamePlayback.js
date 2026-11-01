import { createHungerRun } from './hungerGameRuntime.js';

export const HUNGER_PLAYBACK_SPEEDS = Object.freeze([
  Object.freeze({ delay: 500, label: '빠르게 · 0.5초마다' }),
  Object.freeze({ delay: 1800, label: '보통 · 1.8초마다' }),
  Object.freeze({ delay: 4000, label: '천천히 · 4초마다' }),
]);

export function recreateHungerRunSnapshot(run) {
  if (!run) throw new Error('다시 볼 경기가 없습니다.');
  return createHungerRun(run.input, run.rulesVersion ?? 1);
}

export function createHungerPlaybackTimer({ schedule = globalThis.setTimeout, clear = globalThis.clearTimeout } = {}) {
  let generation = 0;
  let pending = null;
  const cancel = () => {
    generation += 1;
    if (pending !== null) clear(pending);
    pending = null;
  };
  return {
    cancel,
    schedule(onTick, delay) {
      cancel();
      const scheduledGeneration = generation;
      const isCurrent = () => scheduledGeneration === generation;
      pending = schedule(() => {
        if (!isCurrent()) return;
        pending = null;
        onTick(isCurrent);
      }, delay);
      return () => { if (isCurrent()) cancel(); };
    },
  };
}
