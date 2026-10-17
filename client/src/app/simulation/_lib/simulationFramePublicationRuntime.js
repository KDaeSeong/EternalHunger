const FRAME_PUBLICATION_INTERVAL_MS = 1000 / 30;

export function createSimulationFramePublicationLimiter({
  now = () => globalThis.performance?.now?.(),
} = {}) {
  let lastObservedTimeMs = null;
  let lastEmittedTimeMs = null;

  function shouldPublish({ force = false } = {}) {
    let currentTimeMs;
    try {
      currentTimeMs = typeof now === 'function' ? Number(now()) : NaN;
    } catch {
      lastObservedTimeMs = null;
      lastEmittedTimeMs = null;
      return true;
    }

    if (!Number.isFinite(currentTimeMs)
      || (lastObservedTimeMs !== null && currentTimeMs < lastObservedTimeMs)) {
      lastObservedTimeMs = null;
      lastEmittedTimeMs = null;
      return true;
    }

    lastObservedTimeMs = currentTimeMs;
    if (force || lastEmittedTimeMs === null
      || currentTimeMs - lastEmittedTimeMs >= FRAME_PUBLICATION_INTERVAL_MS) {
      lastEmittedTimeMs = currentTimeMs;
      return true;
    }
    return false;
  }

  return {
    shouldPublish,
    getLastObservationTimeMs: () => lastObservedTimeMs,
  };
}
