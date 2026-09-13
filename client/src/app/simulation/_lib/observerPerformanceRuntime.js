const DEFAULT_LABEL = 'observer';

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Number(sorted[index].toFixed(3));
}

function round(value) { return Number(value.toFixed(3)); }

function heapSnapshot(memory) {
  if (!memory) return null;
  return {
    usedBytes: Number(memory.usedJSHeapSize),
    totalBytes: Number(memory.totalJSHeapSize),
    limitBytes: Number(memory.jsHeapSizeLimit),
  };
}

function collectLongTasks(target, entries) {
  for (const entry of entries || []) {
    const duration = Number(entry?.duration);
    const startTime = Number(entry?.startTime);
    if (!Number.isFinite(duration) || duration < 0) continue;
    if (Number.isFinite(startTime) && startTime < target.startedAt) continue;
    target.longTasks.push(duration);
  }
}

export function createObserverPerformanceProbe({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  performanceRef = windowRef?.performance,
  PerformanceObserverRef = windowRef?.PerformanceObserver,
} = {}) {
  let state = null;

  function snapshot(target = state) {
    if (!target) return null;
    const elapsedMs = performanceRef.now() - target.startedAt;
    const intervals = target.frameIntervals;
    const memory = heapSnapshot(performanceRef.memory);
    return {
      schema: 'eh-observer-performance.v1',
      label: target.label,
      elapsedMs: round(elapsedMs),
      raf: {
        supported: target.rafSupported,
        samples: intervals.length,
        fps: intervals.length && elapsedMs > 0 ? round(intervals.length * 1000 / elapsedMs) : null,
        intervalMs: { median: percentile(intervals, 0.5), p95: percentile(intervals, 0.95), max: intervals.length ? round(Math.max(...intervals)) : null },
      },
      longTasks: {
        supported: Boolean(target.longTaskObserver), count: target.longTasks.length,
        totalMs: round(target.longTasks.reduce((sum, value) => sum + value, 0)),
        maxMs: target.longTasks.length ? round(Math.max(...target.longTasks)) : null,
      },
      heap: memory ? {
        supported: true,
        baselineUsedBytes: target.baselineHeap?.usedBytes ?? null,
        usedBytes: memory.usedBytes,
        deltaUsedBytes: target.baselineHeap ? memory.usedBytes - target.baselineHeap.usedBytes : null,
        totalBytes: memory.totalBytes,
        limitBytes: memory.limitBytes,
      }
        : { supported: false, reason: 'performance.memory unavailable' },
      domNodes: documentRef?.getElementsByTagName?.('*')?.length ?? null,
    };
  }

  function stop() {
    if (!state) return null;
    const finished = state;
    collectLongTasks(finished, finished.longTaskObserver?.takeRecords?.());
    state = null;
    if (finished.rafId != null) windowRef.cancelAnimationFrame(finished.rafId);
    if (finished.timerId != null) windowRef.clearTimeout(finished.timerId);
    finished.timerId = null;
    finished.longTaskObserver?.disconnect();
    return snapshot(finished);
  }

  function start({ label = DEFAULT_LABEL, durationMs } = {}) {
    stop();
    const rafSupported = typeof windowRef?.requestAnimationFrame === 'function';
    if (!rafSupported) throw new Error('requestAnimationFrame unavailable');
    const next = {
      label: String(label),
      startedAt: performanceRef.now(),
      baselineHeap: heapSnapshot(performanceRef.memory),
      previousFrameAt: null,
      frameIntervals: [],
      longTasks: [],
      rafId: null,
      timerId: null,
      rafSupported,
      longTaskObserver: null,
    };
    if (typeof PerformanceObserverRef === 'function') {
      try {
        next.longTaskObserver = new PerformanceObserverRef((list) => {
          if (state === next) collectLongTasks(next, list.getEntries());
        });
        next.longTaskObserver.observe({ type: 'longtask' });
      } catch { next.longTaskObserver = null; }
    }
    state = next;
    const sample = (timestamp) => {
      if (state !== next) return;
      if (next.previousFrameAt != null) next.frameIntervals.push(timestamp - next.previousFrameAt);
      next.previousFrameAt = timestamp;
      next.rafId = windowRef.requestAnimationFrame(sample);
    };
    next.rafId = windowRef.requestAnimationFrame(sample);
    if (Number.isFinite(durationMs) && durationMs > 0) next.timerId = windowRef.setTimeout(() => { if (state === next) stop(); }, durationMs);
    return { started: true, label: next.label, durationMs: durationMs ?? null };
  }

  return { start, stop, snapshot, isRunning: () => Boolean(state) };
}
