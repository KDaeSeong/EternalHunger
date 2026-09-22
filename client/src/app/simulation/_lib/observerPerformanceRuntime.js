const DEFAULT_LABEL = 'observer';
const FRAME_BIN_RESOLUTION_MS = 0.1;
const FRAME_BIN_LIMIT_MS = 1000;
const FRAME_BIN_COUNT = Math.round(FRAME_BIN_LIMIT_MS / FRAME_BIN_RESOLUTION_MS) + 1;

function framePercentile(frames, p) {
  if (!frames.count) return { value: null, range: null };
  const rank = Math.ceil(p * frames.count);
  let cumulative = 0;
  for (let index = 0; index < frames.bins.length; index++) {
    cumulative += frames.bins[index];
    if (cumulative >= rank) return { value: round(index * FRAME_BIN_RESOLUTION_MS), range: null };
  }
  // Do not turn a very slow/background session into an apparently healthy
  // percentile. Above the finite histogram, report a range, never a clamped ms.
  return { value: null, range: [round(frames.overflowMin), round(frames.overflowMax)] };
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
    target.longTasks.count += 1;
    target.longTasks.totalMs += duration;
    target.longTasks.maxMs = Math.max(target.longTasks.maxMs ?? 0, duration);
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
    const frames = target.frames;
    const median = framePercentile(frames, 0.5), p95 = framePercentile(frames, 0.95);
    const memory = heapSnapshot(performanceRef.memory);
    return {
      schema: 'eh-observer-performance.v2',
      label: target.label,
      elapsedMs: round(elapsedMs),
      raf: {
        supported: target.rafSupported,
        samples: frames.count,
        fps: frames.count && elapsedMs > 0 ? round(frames.count * 1000 / elapsedMs) : null,
        intervalMs: { median: median.value, p95: p95.value, max: frames.count ? round(frames.maxMs) : null },
        percentiles: { scope: 'entire_measurement', method: 'rounded_histogram', resolutionMs: FRAME_BIN_RESOLUTION_MS,
          upperBoundMs: FRAME_BIN_LIMIT_MS, bins: FRAME_BIN_COUNT, overflowSamples: frames.overflowCount,
          medianRangeMs: median.range, p95RangeMs: p95.range },
      },
      longTasks: {
        supported: Boolean(target.longTaskObserver), count: target.longTasks.count,
        totalMs: round(target.longTasks.totalMs), maxMs: target.longTasks.maxMs == null ? null : round(target.longTasks.maxMs),
      },
      inputResponse: { supported: true, samples: target.input.samples,
        lastMs: target.input.lastMs == null ? null : round(target.input.lastMs),
        maxMs: target.input.maxMs == null ? null : round(target.input.maxMs) },
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
      visibilityState: documentRef?.visibilityState ?? 'unknown',
    };
  }

  function stop() {
    if (!state) return null;
    const finished = state;
    collectLongTasks(finished, finished.longTaskObserver?.takeRecords?.());
    state = null;
    if (finished.rafId != null) windowRef.cancelAnimationFrame(finished.rafId);
    if (finished.input.rafId != null) windowRef.cancelAnimationFrame(finished.input.rafId);
    if (finished.timerId != null) windowRef.clearTimeout(finished.timerId);
    finished.timerId = null;
    finished.longTaskObserver?.disconnect();
    return snapshot(finished);
  }

  function recordInput(eventTimestamp) {
    const target = state;
    if (!target) return false;
    const now = performanceRef.now(), eventTime = Number(eventTimestamp);
    const normalized = eventTime > now + 60000 ? eventTime - Number(performanceRef.timeOrigin) : eventTime;
    const startedAt = Number.isFinite(normalized) ? normalized : now;
    const input = target.input;
    input.pendingCount += 1;
    input.firstAt = Math.min(input.firstAt, startedAt);
    input.lastAt = startedAt;
    if (input.rafId == null) input.rafId = windowRef.requestAnimationFrame((frameTime) => {
      if (state !== target) return;
      input.samples += input.pendingCount;
      input.lastMs = Math.max(0, frameTime - input.lastAt);
      input.maxMs = Math.max(input.maxMs ?? 0, frameTime - input.firstAt);
      input.pendingCount = 0; input.firstAt = Infinity; input.rafId = null;
    });
    return true;
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
      // Fixed 80 KB histogram: all frames contribute, without a growing raw
      // array or per-second full-session sorting. Maxima remain exact.
      frames: { bins: new Float64Array(FRAME_BIN_COUNT), count: 0, maxMs: 0,
        overflowCount: 0, overflowMin: Infinity, overflowMax: 0 },
      longTasks: { count: 0, totalMs: 0, maxMs: null },
      input: { samples: 0, lastMs: null, maxMs: null, pendingCount: 0, firstAt: Infinity, lastAt: 0, rafId: null },
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
      } catch { next.longTaskObserver?.disconnect(); next.longTaskObserver = null; }
    }
    state = next;
    const sample = (timestamp) => {
      if (state !== next) return;
      if (Number.isFinite(timestamp)) {
        const interval = timestamp - next.previousFrameAt;
        if (next.previousFrameAt != null && interval >= 0) {
          const frames = next.frames;
          frames.count += 1; frames.maxMs = Math.max(frames.maxMs, interval);
          if (interval <= FRAME_BIN_LIMIT_MS) frames.bins[Math.round(interval / FRAME_BIN_RESOLUTION_MS)] += 1;
          else {
            frames.overflowCount += 1; frames.overflowMin = Math.min(frames.overflowMin, interval);
            frames.overflowMax = Math.max(frames.overflowMax, interval);
          }
        }
        next.previousFrameAt = timestamp;
      }
      next.rafId = windowRef.requestAnimationFrame(sample);
    };
    next.rafId = windowRef.requestAnimationFrame(sample);
    if (Number.isFinite(durationMs) && durationMs > 0) next.timerId = windowRef.setTimeout(() => { if (state === next) stop(); }, durationMs);
    return { started: true, label: next.label, durationMs: durationMs ?? null };
  }

  return { start, stop, snapshot, recordInput, isRunning: () => Boolean(state) };
}
