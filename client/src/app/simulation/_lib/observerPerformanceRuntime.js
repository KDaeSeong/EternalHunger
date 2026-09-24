import { subscribeObserverWorkMeasurements } from './observerWorkMeasurementRuntime.js';

const DEFAULT_LABEL = 'observer';
const FRAME_BIN_RESOLUTION_MS = 0.1;
const FRAME_BIN_LIMIT_MS = 1000;
const FRAME_BIN_COUNT = Math.round(FRAME_BIN_LIMIT_MS / FRAME_BIN_RESOLUTION_MS) + 1;
const SLOW_FRAME_LIMIT = 8;
const SLOW_SCRIPT_LIMIT = 8;
const ATTRIBUTION_TEXT_LIMIT = 512;

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

const attributionText = (value) => String(value ?? '').slice(0, ATTRIBUTION_TEXT_LIMIT);
const finiteNumber = (value) => value != null && Number.isFinite(Number(value)) ? Number(value) : null;

function scriptSource(value) {
  // Diagnostics are local-only, but query strings, fragments and URL credentials
  // still do not belong in the copyable attribution report.
  try { const url = new URL(String(value)); return attributionText(`${url.origin}${url.pathname}`); }
  catch { return attributionText(String(value ?? '').split(/[?#]/)[0]); }
}

function collectLongAnimationFrames(target, entries) {
  const frames = target.longAnimationFrames;
  for (const entry of entries || []) {
    const duration = finiteNumber(entry?.duration), start = finiteNumber(entry?.startTime);
    if (duration == null || duration < 0 || start == null || start < target.startedAt) continue;
    const end = start + duration;
    const render = Number(entry.renderStart), layout = Number(entry.styleAndLayoutStart);
    const hasRender = render > 0 && render >= start && render <= end;
    const hasLayout = hasRender && layout >= render && layout <= end;
    const workMs = hasRender ? render - start : duration;
    const renderMs = hasRender ? end - render : 0;
    const styleAndLayoutMs = hasLayout ? end - layout : 0;
    const blockingMs = Math.max(0, finiteNumber(entry.blockingDuration) ?? 0);
    frames.count += 1; frames.totalDurationMs += duration;
    frames.maxDurationMs = Math.max(frames.maxDurationMs ?? 0, duration);
    frames.maxWorkMs = Math.max(frames.maxWorkMs ?? 0, workMs);
    frames.maxRenderMs = Math.max(frames.maxRenderMs ?? 0, renderMs);
    frames.maxStyleAndLayoutMs = Math.max(frames.maxStyleAndLayoutMs ?? 0, styleAndLayoutMs);
    frames.maxBlockingMs = Math.max(frames.maxBlockingMs ?? 0, blockingMs);
    if (frames.slowest.length === SLOW_FRAME_LIMIT && duration <= frames.slowest.at(-1).durationMs) continue;
    // Keep only bounded, owned scalar data. Never retain a PerformanceEntry or
    // its Window reference, and never sort an unbounded full-session array.
    const scripts = [];
    let scriptCount = 0;
    for (const script of entry.scripts || []) {
      const ms = finiteNumber(script?.duration);
      if (ms == null || ms < 0) continue;
      scriptCount += 1;
      if (scripts.length === SLOW_SCRIPT_LIMIT && ms <= scripts.at(-1).durationMs) continue;
      scripts.push({ durationMs: ms, invoker: attributionText(script.invoker), invokerType: attributionText(script.invokerType),
        sourceURL: scriptSource(script.sourceURL), sourceFunctionName: attributionText(script.sourceFunctionName),
        sourceCharPosition: finiteNumber(script.sourceCharPosition), windowAttribution: attributionText(script.windowAttribution),
        forcedStyleAndLayoutMs: finiteNumber(script.forcedStyleAndLayoutDuration), pauseMs: finiteNumber(script.pauseDuration) });
      scripts.sort((a, b) => b.durationMs - a.durationMs);
      if (scripts.length > SLOW_SCRIPT_LIMIT) scripts.pop();
    }
    frames.slowest.push({ startOffsetMs: start - target.startedAt, durationMs: duration,
      workMs, renderMs, styleAndLayoutMs, blockingMs, scriptCount, scripts });
    frames.slowest.sort((a, b) => b.durationMs - a.durationMs);
    if (frames.slowest.length > SLOW_FRAME_LIMIT) frames.slowest.pop();
  }
}

function animationFrameSnapshot(target) {
  const frames = target.longAnimationFrames;
  const rounded = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, typeof value === 'number' ? round(value) : value]));
  return {
    ...rounded(frames), supported: Boolean(target.longAnimationFrameObserver),
    reason: target.longAnimationFrameObserver ? null : 'long-animation-frame unavailable',
    attribution: { selection: 'slowest_by_duration', frameLimit: SLOW_FRAME_LIMIT, scriptLimit: SLOW_SCRIPT_LIMIT,
      textLimit: ATTRIBUTION_TEXT_LIMIT, scope: 'browser_attributed_main_thread_entrypoints_not_full_call_stacks' },
    slowest: frames.slowest.map((row) => ({ ...rounded(row), scripts: row.scripts.map(rounded) })),
  };
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
      longAnimationFrames: animationFrameSnapshot(target),
      workBreakdown: { scope: 'instrumented_synchronous_stages_including_nested_work_not_additive',
        stages: [...target.workStages.values()].map((stage) => ({ ...stage,
          totalMs: round(stage.totalMs), maxMs: round(stage.maxMs), maxStartOffsetMs: round(stage.maxStartOffsetMs) })) },
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
    collectLongAnimationFrames(finished, finished.longAnimationFrameObserver?.takeRecords?.());
    state = null;
    if (finished.rafId != null) windowRef.cancelAnimationFrame(finished.rafId);
    if (finished.input.rafId != null) windowRef.cancelAnimationFrame(finished.input.rafId);
    if (finished.timerId != null) windowRef.clearTimeout(finished.timerId);
    finished.timerId = null;
    finished.longTaskObserver?.disconnect();
    finished.longAnimationFrameObserver?.disconnect();
    finished.unsubscribeWork?.();
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
      longAnimationFrames: { count: 0, totalDurationMs: 0, maxDurationMs: null, maxWorkMs: null,
        maxRenderMs: null, maxStyleAndLayoutMs: null, maxBlockingMs: null, slowest: [] },
      input: { samples: 0, lastMs: null, maxMs: null, pendingCount: 0, firstAt: Infinity, lastAt: 0, rafId: null },
      rafId: null,
      timerId: null,
      rafSupported,
      longTaskObserver: null,
      longAnimationFrameObserver: null,
      workStages: new Map(),
      unsubscribeWork: null,
    };
    if (typeof PerformanceObserverRef === 'function') {
      try {
        next.longTaskObserver = new PerformanceObserverRef((list) => {
          if (state === next) collectLongTasks(next, list.getEntries());
        });
        next.longTaskObserver.observe({ type: 'longtask' });
      } catch { next.longTaskObserver?.disconnect(); next.longTaskObserver = null; }
      if (PerformanceObserverRef.supportedEntryTypes?.includes('long-animation-frame')) {
        try {
          next.longAnimationFrameObserver = new PerformanceObserverRef((list) => {
            if (state === next) collectLongAnimationFrames(next, list.getEntries());
          });
          next.longAnimationFrameObserver.observe({ type: 'long-animation-frame' });
        } catch { next.longAnimationFrameObserver?.disconnect(); next.longAnimationFrameObserver = null; }
      }
    }
    state = next;
    next.unsubscribeWork = subscribeObserverWorkMeasurements(() => performanceRef.now(), (entry) => {
      if (state !== next || !Number.isFinite(entry.duration) || entry.duration < 0) return;
      const name = String(entry.name).slice(0, 80);
      if (!next.workStages.has(name) && next.workStages.size >= 24) return;
      const stage = next.workStages.get(name) || { name, count: 0, totalMs: 0, maxMs: -1, maxStartOffsetMs: 0 };
      stage.count += 1; stage.totalMs += entry.duration;
      if (entry.duration > stage.maxMs) { stage.maxMs = entry.duration; stage.maxStartOffsetMs = entry.startTime - next.startedAt; }
      next.workStages.set(name, stage);
    });
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
