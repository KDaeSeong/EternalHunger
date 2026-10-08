import { subscribeObserverWorkMeasurements } from './observerWorkMeasurementRuntime.js';

const DEFAULT_LABEL = 'observer';
const FRAME_BIN_RESOLUTION_MS = 0.1;
const FRAME_BIN_LIMIT_MS = 1000;
const FRAME_BIN_COUNT = Math.round(FRAME_BIN_LIMIT_MS / FRAME_BIN_RESOLUTION_MS) + 1;
const SLOW_FRAME_LIMIT = 8;
const SLOW_TASK_LIMIT = 8;
const SLOW_SCRIPT_LIMIT = 8;
const ATTRIBUTION_TEXT_LIMIT = 512;
const MILLISECOND_EXPORT_DECIMALS = 3;
const finiteNumber = (value) => value != null && Number.isFinite(Number(value)) ? Number(value) : null;

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

function round(value) { return Number(value.toFixed(MILLISECOND_EXPORT_DECIMALS)); }

function heapSnapshot(memory) {
  if (!memory) return null;
  const result = {
    usedBytes: Number(memory.usedJSHeapSize),
    totalBytes: Number(memory.totalJSHeapSize),
    limitBytes: Number(memory.jsHeapSizeLimit),
  };
  return Object.values(result).every(Number.isFinite) && result.usedBytes >= 0
    && result.totalBytes >= result.usedBytes && result.limitBytes > 0 ? result : null;
}

function intersectsMeasurement(target, start, duration) {
  return start != null && duration != null && duration >= 0
    && start + duration > target.startedAt
    && (target.stoppedAt == null || start < target.stoppedAt);
}

function collectLongTasks(target, entries) {
  for (const entry of entries || []) {
    const duration = finiteNumber(entry?.duration);
    const startTime = finiteNumber(entry?.startTime);
    if (!Number.isFinite(startTime) || !Number.isFinite(duration)
      || !intersectsMeasurement(target, startTime, duration)) continue;
    target.longTasks.count += 1;
    target.longTasks.totalMs += duration;
    target.longTasks.maxMs = Math.max(target.longTasks.maxMs ?? 0, duration);
    const slowest = target.longTasks.slowest;
    if (slowest.length === SLOW_TASK_LIMIT && duration <= slowest.at(-1).durationMs) continue;
    // Retain the actual peak's clock without retaining PerformanceEntry,
    // container identifiers, Window references or an unbounded task journal.
    slowest.push({ startOffsetMs: startTime - target.startedAt, durationMs: duration });
    slowest.sort((a, b) => b.durationMs - a.durationMs);
    if (slowest.length > SLOW_TASK_LIMIT) slowest.pop();
  }
}

const attributionText = (value) => String(value ?? '').slice(0, ATTRIBUTION_TEXT_LIMIT);

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
    if (!intersectsMeasurement(target, start, duration)) continue;
    const end = start + duration;
    const render = Number(entry.renderStart), layout = Number(entry.styleAndLayoutStart);
    const hasRender = render > 0 && render >= start && render <= end;
    const hasLayout = hasRender && layout >= render && layout <= end;
    const workMs = hasRender ? render - start : duration;
    const renderMs = hasRender ? end - render : 0;
    const styleAndLayoutMs = hasLayout ? end - layout : 0;
    const blocking = finiteNumber(entry.blockingDuration);
    const blockingMs = blocking != null && blocking >= 0 ? blocking : null;
    frames.count += 1; frames.totalDurationMs += duration;
    frames.maxDurationMs = Math.max(frames.maxDurationMs ?? 0, duration);
    frames.maxWorkMs = Math.max(frames.maxWorkMs ?? 0, workMs);
    frames.maxRenderMs = Math.max(frames.maxRenderMs ?? 0, renderMs);
    frames.maxStyleAndLayoutMs = Math.max(frames.maxStyleAndLayoutMs ?? 0, styleAndLayoutMs);
    if (blockingMs != null) frames.maxBlockingMs = Math.max(frames.maxBlockingMs ?? 0, blockingMs);
    const keepDuration = frames.slowest.length < SLOW_FRAME_LIMIT || duration > frames.slowest.at(-1).durationMs;
    const lastBlocking = frames.mostBlocking.at(-1);
    const keepBlocking = blockingMs != null && (frames.mostBlocking.length < SLOW_FRAME_LIMIT
      || blockingMs > lastBlocking.blockingMs
      || blockingMs === lastBlocking.blockingMs && duration > lastBlocking.durationMs);
    // A shorter, heavily blocking frame must not disappear behind eight long
    // frames with little blocking work (for example, a slow RAF cadence).
    if (!keepDuration && !keepBlocking) continue;
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
    const row = { startOffsetMs: start - target.startedAt, durationMs: duration,
      workMs, renderMs, styleAndLayoutMs, blockingMs, scriptCount, scripts };
    if (keepDuration) {
      frames.slowest.push(row);
      frames.slowest.sort((a, b) => b.durationMs - a.durationMs);
      if (frames.slowest.length > SLOW_FRAME_LIMIT) frames.slowest.pop();
    }
    if (keepBlocking) {
      frames.mostBlocking.push(row);
      frames.mostBlocking.sort((a, b) => b.blockingMs - a.blockingMs || b.durationMs - a.durationMs);
      if (frames.mostBlocking.length > SLOW_FRAME_LIMIT) frames.mostBlocking.pop();
    }
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
      mostBlockingSelection: 'largest_blocking_duration_then_duration',
      textLimit: ATTRIBUTION_TEXT_LIMIT, scope: 'browser_attributed_main_thread_entrypoints_not_full_call_stacks' },
    slowest: frames.slowest.map((row) => ({ ...rounded(row), scripts: row.scripts.map(rounded) })),
    mostBlocking: frames.mostBlocking.map((row) => ({ ...rounded(row), scripts: row.scripts.map(rounded) })),
  };
}

export function createObserverPerformanceProbe({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  performanceRef = windowRef?.performance,
  PerformanceObserverRef = windowRef?.PerformanceObserver,
} = {}) {
  let state = null;
  let lastResult = null;

  const visibilityState = () => {
    const value = documentRef?.visibilityState;
    return value === 'visible' || value === 'hidden' ? value : 'unknown';
  };

  function visibilitySnapshot(target, now) {
    const visibility = target.visibility;
    const endState = visibilityState();
    const durationMs = { ...visibility.durationMs };
    durationMs[visibility.state] += Math.max(0, now - visibility.changedAt);
    return {
      supported: visibility.supported,
      reason: visibility.supported ? null : 'document visibility events unavailable',
      initialState: visibility.initialState,
      endState,
      transitions: visibility.supported ? visibility.transitions : null,
      boundaryNotifications: 0,
      durationMs: visibility.supported ? Object.fromEntries(Object.entries(durationMs).map(([key, value]) => [key, round(value)])) : null,
      entireMeasurementVisible: visibility.supported
        && visibility.initialState === 'visible' && endState === 'visible'
        && visibility.state === 'visible' && visibility.transitions === 0,
    };
  }

  function snapshot(target = state) {
    if (!target) return null;
    const now = target.stoppedAt ?? performanceRef.now();
    const elapsedMs = now - target.startedAt;
    const frames = target.frames;
    const median = framePercentile(frames, 0.5), p95 = framePercentile(frames, 0.95);
    const memory = target.stoppedAt == null ? heapSnapshot(performanceRef.memory) : target.finalHeap;
    const draining = target.stoppedAt != null && state === target && Boolean(target.stopPromise);
    return {
      schema: 'eh-observer-performance.v3',
      numericPrecision: { roundedMillisecondsResolutionMs: 10 ** -MILLISECOND_EXPORT_DECIMALS },
      label: target.label,
      startedAtMs: round(target.startedAt),
      endedAtMs: target.stoppedAt == null ? null : round(target.stoppedAt),
      timeOriginMs: finiteNumber(performanceRef.timeOrigin),
      environment: { ...target.environment },
      engineVersion: target.context?.initial?.engineVersion ?? null,
      context: target.context ? structuredClone(target.context) : null,
      boundary: { status: target.stoppedAt == null ? 'recording' : draining ? 'draining' : target.boundarySettled ? 'settled' : 'incomplete',
        stopReason: target.stopReason ?? null,
        entryScope: 'full_entries_intersecting_measurement_including_boundary_overlaps',
        reason: target.boundarySettled ? null : draining ? 'awaiting post-stop frame and task' : target.boundaryReason ?? 'measurement still running' },
      elapsedMs: round(elapsedMs),
      raf: {
        supported: target.rafSupported,
        samples: frames.count,
        fps: frames.count && elapsedMs > 0 ? round(frames.count * 1000 / elapsedMs) : null,
        intervalMs: { median: median.value, p95: p95.value, max: frames.count ? round(frames.maxMs) : null },
        boundaryGapsMs: { firstRafDelay: target.firstFrameAt == null ? null : round(Math.max(0, target.firstFrameAt - target.startedAt)),
          trailingRafGap: round(Math.max(0, now - (target.previousFrameAt ?? target.startedAt))) },
        scope: 'RAF_callback_cadence_not_presented_FPS',
        percentiles: { scope: 'entire_measurement', method: 'rounded_histogram', resolutionMs: FRAME_BIN_RESOLUTION_MS,
          upperBoundMs: FRAME_BIN_LIMIT_MS, bins: FRAME_BIN_COUNT, overflowSamples: frames.overflowCount,
          medianRangeMs: median.range, p95RangeMs: p95.range },
      },
      longTasks: {
        supported: Boolean(target.longTaskObserver), count: target.longTasks.count,
        totalMs: round(target.longTasks.totalMs), maxMs: target.longTasks.maxMs == null ? null : round(target.longTasks.maxMs),
        reason: target.longTaskObserver ? null : 'longtask not advertised or observation failed',
        timing: { selection: 'slowest_by_duration', taskLimit: SLOW_TASK_LIMIT,
          scope: 'full_intersecting_task_elapsed_time_not_cpu_or_script_attribution' },
        slowest: target.longTasks.slowest.map((row) => ({ startOffsetMs: round(row.startOffsetMs), durationMs: round(row.durationMs) })),
      },
      longAnimationFrames: animationFrameSnapshot(target),
      workBreakdown: { scope: 'instrumented_synchronous_stages_including_nested_work_not_additive',
        stages: [...target.workStages.values()].map((stage) => ({ ...stage,
          totalMs: round(stage.totalMs), maxMs: round(stage.maxMs), maxStartOffsetMs: round(stage.maxStartOffsetMs) })) },
      inputResponse: { supported: true, samples: target.input.samples, pendingSamples: target.input.pendingCount,
        scope: 'captured_click_to_next_RAF_not_INP_or_presentation',
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
      domNodes: target.stoppedAt == null ? documentRef?.getElementsByTagName?.('*')?.length ?? null : target.finalDomNodes,
      visibilityState: target.finalVisibility?.endState ?? documentRef?.visibilityState ?? 'unknown',
      visibility: target.finalVisibility ? structuredClone(target.finalVisibility) : visibilitySnapshot(target, now),
    };
  }

  function closeBoundary(target, reason) {
    if (target.stoppedAt != null) return;
    target.stoppedAt = performanceRef.now();
    target.stopReason = reason;
    target.finalHeap = heapSnapshot(performanceRef.memory);
    target.finalDomNodes = documentRef?.getElementsByTagName?.('*')?.length ?? null;
    target.finalVisibility = visibilitySnapshot(target, target.stoppedAt);
    if (target.rafId != null) windowRef.cancelAnimationFrame(target.rafId);
    if (target.timerId != null) windowRef.clearTimeout(target.timerId);
    target.rafId = null; target.timerId = null;
  }

  function finish(target, settled, reason) {
    const finished = target;
    finished.boundarySettled = settled; finished.boundaryReason = reason;
    collectLongTasks(finished, finished.longTaskObserver?.takeRecords?.());
    collectLongAnimationFrames(finished, finished.longAnimationFrameObserver?.takeRecords?.());
    if (state === finished) state = null;
    if (finished.rafId != null) windowRef.cancelAnimationFrame(finished.rafId);
    if (finished.input.rafId != null) windowRef.cancelAnimationFrame(finished.input.rafId);
    if (finished.timerId != null) windowRef.clearTimeout(finished.timerId);
    finished.timerId = null;
    if (finished.settleFrameId != null) windowRef.cancelAnimationFrame(finished.settleFrameId);
    if (finished.settleTimerId != null) windowRef.clearTimeout(finished.settleTimerId);
    if (finished.settleResumeId != null) windowRef.clearTimeout(finished.settleResumeId);
    finished.longTaskObserver?.disconnect();
    finished.longAnimationFrameObserver?.disconnect();
    finished.unsubscribeWork?.();
    if (finished.visibility.listener) documentRef.removeEventListener('visibilitychange', finished.visibility.listener);
    const result = snapshot(finished);
    lastResult = structuredClone(result);
    finished.resolveStop?.(structuredClone(result));
    return result;
  }

  // Immediate disposal is safe on unmount/restart, but cannot prove that the
  // current browser task/animation frame has already produced its final entry.
  function stop() {
    if (!state) return null;
    closeBoundary(state, 'immediate');
    return finish(state, false, 'disposed before a post-stop frame and task');
  }

  function stopAfterFrame({ reason = 'manual' } = {}) {
    if (!state) return Promise.resolve(lastResult ? structuredClone(lastResult) : null);
    const target = state;
    if (target.stopPromise) return target.stopPromise;
    closeBoundary(target, reason);
    target.stopPromise = new Promise((resolve) => { target.resolveStop = resolve; });
    const resultPromise = target.stopPromise;
    if (visibilityState() !== 'visible' || typeof windowRef.setTimeout !== 'function') {
      finish(target, false, 'post-stop visible frame unavailable');
      return resultPromise;
    }
    target.settleTimerId = windowRef.setTimeout(() => {
      if (state === target) finish(target, false, 'post-stop frame timed out');
    }, 1000);
    try {
      target.settleFrameId = windowRef.requestAnimationFrame(() => {
        if (state !== target) return;
        target.settleFrameId = null;
        target.settleResumeId = windowRef.setTimeout(() => {
          if (state === target) finish(target, true, null);
        }, 0);
      });
    } catch { finish(target, false, 'post-stop RAF request failed'); }
    return resultPromise;
  }

  function recordInput(eventTimestamp) {
    const target = state;
    if (!target || target.stoppedAt != null) return false;
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

  function updateContext(value) {
    if (!state || state.stoppedAt != null || !value) return false;
    // Own bounded scalar metadata only; never retain replay records or actors.
    const next = Object.fromEntries(Object.entries(value).slice(0, 16).filter(([, item]) =>
      item == null || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item) || typeof item === 'string')
      .map(([key, item]) => [key.slice(0, 40), typeof item === 'string' ? item.slice(0, 160) : item]));
    if (!state.context) state.context = { initial: next, final: next, speedChanges: 0, identityChanges: 0, pauses: 0,
      activeStartOffsetMs: null, activeEndOffsetMs: null };
    const context = state.context, previous = context.final;
    if (next.speed !== previous.speed) context.speedChanges += 1;
    if (next.replayId !== previous.replayId || next.seed !== previous.seed || next.engineVersion !== previous.engineVersion) context.identityChanges += 1;
    if (previous.autoPlay && !next.autoPlay && !next.isGameOver) context.pauses += 1;
    const offset = round(performanceRef.now() - state.startedAt);
    if (next.autoPlay && context.activeStartOffsetMs == null) context.activeStartOffsetMs = offset;
    if (next.isGameOver && context.activeEndOffsetMs == null) context.activeEndOffsetMs = offset;
    context.final = next;
    return true;
  }

  function start({ label = DEFAULT_LABEL, durationMs, context } = {}) {
    stop();
    lastResult = null;
    const rafSupported = typeof windowRef?.requestAnimationFrame === 'function';
    if (!rafSupported) throw new Error('requestAnimationFrame unavailable');
    const next = {
      label: String(label),
      startedAt: performanceRef.now(),
      baselineHeap: heapSnapshot(performanceRef.memory),
      previousFrameAt: null,
      firstFrameAt: null,
      stoppedAt: null,
      context: null,
      environment: { userAgent: attributionText(windowRef?.navigator?.userAgent),
        viewportWidth: finiteNumber(windowRef?.innerWidth), viewportHeight: finiteNumber(windowRef?.innerHeight),
        devicePixelRatio: finiteNumber(windowRef?.devicePixelRatio),
        hardwareConcurrency: finiteNumber(windowRef?.navigator?.hardwareConcurrency) },
      // Fixed 80 KB histogram: all frames contribute, without a growing raw
      // array or per-second full-session sorting. Maxima remain exact.
      frames: { bins: new Float64Array(FRAME_BIN_COUNT), count: 0, maxMs: 0,
        overflowCount: 0, overflowMin: Infinity, overflowMax: 0 },
      longTasks: { count: 0, totalMs: 0, maxMs: null, slowest: [] },
      longAnimationFrames: { count: 0, totalDurationMs: 0, maxDurationMs: null, maxWorkMs: null,
        maxRenderMs: null, maxStyleAndLayoutMs: null, maxBlockingMs: null, slowest: [], mostBlocking: [] },
      input: { samples: 0, lastMs: null, maxMs: null, pendingCount: 0, firstAt: Infinity, lastAt: 0, rafId: null },
      rafId: null,
      timerId: null,
      rafSupported,
      longTaskObserver: null,
      longAnimationFrameObserver: null,
      workStages: new Map(),
      unsubscribeWork: null,
    };
    const initialVisibility = visibilityState();
    next.visibility = {
      supported: false, initialState: initialVisibility, state: initialVisibility,
      changedAt: next.startedAt, transitions: 0, durationMs: { visible: 0, hidden: 0, unknown: 0 }, listener: null,
    };
    if (typeof PerformanceObserverRef === 'function') {
      if (PerformanceObserverRef.supportedEntryTypes?.includes('longtask')) try {
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
    updateContext(context);
    if (typeof documentRef?.addEventListener === 'function' && typeof documentRef?.removeEventListener === 'function') {
      const onVisibilityChange = () => {
        if (state !== next) return;
        const visibility = next.visibility, value = visibilityState();
        // A queued event may be delivered after the tab has already returned
        // to the old state. Its presence still invalidates continuous visibility.
        visibility.transitions += 1;
        if (next.stoppedAt != null) {
          // Delivery time cannot tell whether this transition occurred before
          // the cutoff. Keep cutoff durations fixed and conservatively invalidate
          // coverage instead of discarding notifications during the drain.
          next.finalVisibility.transitions = visibility.transitions;
          next.finalVisibility.boundaryNotifications += 1;
          next.finalVisibility.entireMeasurementVisible = false;
          return;
        }
        if (value === visibility.state) return;
        const now = performanceRef.now();
        visibility.durationMs[visibility.state] += Math.max(0, now - visibility.changedAt);
        visibility.changedAt = now; visibility.state = value;
      };
      documentRef.addEventListener('visibilitychange', onVisibilityChange);
      next.visibility.listener = onVisibilityChange; next.visibility.supported = true;
    }
    next.unsubscribeWork = subscribeObserverWorkMeasurements(() => performanceRef.now(), (entry) => {
      if (state !== next || next.stoppedAt != null || !Number.isFinite(entry.duration) || entry.duration < 0) return;
      const name = String(entry.name).slice(0, 80);
      if (!next.workStages.has(name) && next.workStages.size >= 24) return;
      const stage = next.workStages.get(name) || { name, count: 0, totalMs: 0, maxMs: -1, maxStartOffsetMs: 0 };
      stage.count += 1; stage.totalMs += entry.duration;
      if (entry.duration > stage.maxMs) { stage.maxMs = entry.duration; stage.maxStartOffsetMs = entry.startTime - next.startedAt; }
      next.workStages.set(name, stage);
    });
    const sample = (timestamp) => {
      if (state !== next || next.stoppedAt != null) return;
      if (Number.isFinite(timestamp)) {
        if (next.firstFrameAt == null) next.firstFrameAt = timestamp;
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
    if (Number.isFinite(durationMs) && durationMs > 0) next.timerId = windowRef.setTimeout(() => {
      if (state === next) void stopAfterFrame({ reason: 'duration' });
    }, durationMs);
    return { started: true, label: next.label, durationMs: durationMs ?? null };
  }

  return { start, stop, stopAfterFrame, snapshot, recordInput, updateContext,
    getLastResult: () => lastResult ? structuredClone(lastResult) : null,
    isRunning: () => Boolean(state) };
}
