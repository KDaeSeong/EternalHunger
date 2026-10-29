import { subscribeObserverWorkMeasurements } from './observerWorkMeasurementRuntime.js';

const DEFAULT_LABEL = 'observer';
const FRAME_BIN_RESOLUTION_MS = 0.1;
const FRAME_BIN_LIMIT_MS = 1000;
const FRAME_BIN_COUNT = Math.round(FRAME_BIN_LIMIT_MS / FRAME_BIN_RESOLUTION_MS) + 1;
const SLOW_FRAME_LIMIT = 8;
const SLOW_TASK_LIMIT = 8;
const SLOW_SCRIPT_LIMIT = 8;
const ATTRIBUTION_TEXT_LIMIT = 512;
const WORK_STAGE_LIMIT = 24;
const WORK_STAGE_NAME_LIMIT = 80;
const WORKER_PHASE_LIMIT = 64;
const MAX_WAIT_TOTAL_MS = Number.MAX_SAFE_INTEGER;
const MAX_WAIT_COUNT = Number.MAX_SAFE_INTEGER;
const MILLISECOND_EXPORT_DECIMALS = 3;
const finiteNumber = (value) => value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const MAP_VIEWPORT_SELECTOR = '[data-observer-map-viewport]';
const MAP_WORLD_SELECTOR = '[data-observer-map-world]';

function rectEvidence(rect) {
  if (!rect) return null;
  const values = ['left', 'top', 'right', 'bottom', 'width', 'height'];
  const result = Object.fromEntries(values.map((key) => [key, finiteNumber(rect[key])]));
  return values.every((key) => result[key] != null) && result.width > 0 && result.height > 0
    && Math.abs(result.right - result.left - result.width) < 1
    && Math.abs(result.bottom - result.top - result.height) < 1 ? result : null;
}

function boundedString(value, limit = 120) {
  return typeof value === 'string' ? value.slice(0, limit) : null;
}

function elementEvidence(element) {
  const className = typeof element?.className === 'string' ? element.className
    : typeof element?.className?.baseVal === 'string' ? element.className.baseVal : null;
  return {
    tagName: boundedString(String(element?.tagName || '').toLowerCase(), 32),
    id: boundedString(element?.id, 80),
    className: boundedString(className),
  };
}

function mapFailureEvidence(sample) {
  if (!sample) return null;
  return {
    source: boundedString(sample.source, 16),
    viewport: rectEvidence(sample.viewport),
    content: rectEvidence(sample.content),
    world: rectEvidence(sample.world),
    browserViewport: rectEvidence(sample.browserViewport),
    clipCauses: (Array.isArray(sample.clipCauses) ? sample.clipCauses : []).slice(0, 8)
      .map((cause) => boundedString(cause, 32)).filter(Boolean),
    clipChain: (Array.isArray(sample.clipChain) ? sample.clipChain : []).slice(0, 8).map((entry) => ({
      rect: rectEvidence(entry.rect), clipsX: Boolean(entry.clipsX), clipsY: Boolean(entry.clipsY),
      tagName: boundedString(entry.tagName, 32), id: boundedString(entry.id, 80),
      className: boundedString(entry.className), overflowX: boundedString(entry.overflowX, 12),
      overflowY: boundedString(entry.overflowY, 12),
    })),
    scroll: sample.scroll ? {
      left: finiteNumber(sample.scroll.left), top: finiteNumber(sample.scroll.top),
      width: finiteNumber(sample.scroll.width), height: finiteNumber(sample.scroll.height),
      clientWidth: finiteNumber(sample.scroll.clientWidth), clientHeight: finiteNumber(sample.scroll.clientHeight),
    } : null,
    viewportClassName: boundedString(sample.viewportClassName),
    zoomed: sample.zoomed === true,
    fullyDisplayed: sample.fullyDisplayed === true,
    hiddenByStyle: sample.hiddenByStyle === true,
  };
}

function observerContextEvidence(context) {
  if (!context || typeof context !== 'object') return null;
  const keys = ['engineVersion', 'speed', 'seed', 'autoPlay', 'day', 'matchSec', 'isGameOver',
    'replayMode', 'replayId', 'comparisonMatched', 'comparedEvents', 'phase', 'status'];
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(context, key)).map((key) => {
    const value = context[key];
    if (typeof value === 'string') return [key, value.slice(0, 160)];
    if (typeof value === 'number') return [key, Number.isFinite(value) ? value : null];
    if (typeof value === 'boolean' || value == null) return [key, value];
    return [key, null];
  }));
}

function hasSupportedAxisTransform(style) {
  const transform = String(style?.transform || 'none');
  if (transform !== 'none') {
    const match = transform.match(/^matrix\(\s*([-+\deE.]+)\s*,\s*([-+\deE.]+)\s*,\s*([-+\deE.]+)\s*,\s*([-+\deE.]+)\s*,\s*([-+\deE.]+)\s*,\s*([-+\deE.]+)\s*\)$/);
    if (!match || Math.abs(Number(match[2])) > 1e-7 || Math.abs(Number(match[3])) > 1e-7
      || !(Number(match[1]) > 0) || !(Number(match[4]) > 0)) return false;
  }
  return !(style?.rotate && style.rotate !== 'none' && style.rotate !== '0deg'
    || style?.scale && style.scale !== 'none');
}

function clientBox(element, style) {
  const rect = rectEvidence(element?.getBoundingClientRect?.());
  const left = finiteNumber(element?.clientLeft), top = finiteNumber(element?.clientTop);
  const width = finiteNumber(element?.clientWidth), height = finiteNumber(element?.clientHeight);
  const offsetWidth = finiteNumber(element?.offsetWidth), offsetHeight = finiteNumber(element?.offsetHeight);
  if (!rect || left == null || top == null || width == null || height == null || offsetWidth == null || offsetHeight == null
    || width <= 0 || height <= 0 || offsetWidth <= 0 || offsetHeight <= 0) return null;
  const scaleX = rect.width / offsetWidth, scaleY = rect.height / offsetHeight;
  if (!(scaleX > 0) || !(scaleY > 0) || !Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return null;
  if (!hasSupportedAxisTransform(style)) return null;
  const scaledLeft = rect.left + left * scaleX, scaledTop = rect.top + top * scaleY;
  const scaledWidth = width * scaleX, scaledHeight = height * scaleY;
  return { left: scaledLeft, top: scaledTop, right: scaledLeft + scaledWidth,
    bottom: scaledTop + scaledHeight, width: scaledWidth, height: scaledHeight };
}

function containsRect(outer, inner, tolerance = 0.5) {
  return !!outer && !!inner && inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance
    && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
}

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

function workerAggregate(value = {}) {
  const count = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(finiteNumber(value?.count) ?? 0)));
  const measuredCount = Math.min(count, Math.max(0, Math.floor(finiteNumber(value?.measuredCount) ?? 0)));
  const total = finiteNumber(value?.totalMs), max = finiteNumber(value?.maxMs);
  return { count, measuredCount,
    totalMs: measuredCount && total != null && total >= 0 ? round(total) : null,
    maxMs: measuredCount && max != null && max >= 0 ? round(max) : null };
}

function workerReport(value) {
  if (value?.schema !== 'eh-worker-phase-performance.v1' || !['complete', 'failed'].includes(value.status)) return null;
  const elapsed = finiteNumber(value.elapsedMs);
  const rows = (source, key, limit) => (Array.isArray(source) ? source : []).slice(0, limit)
    .filter(row => typeof row?.[key] === 'string').map(row => ({
      [key]: row[key].slice(0, WORK_STAGE_NAME_LIMIT), ...workerAggregate(row) }));
  return { schema: value.schema, status: value.status,
    elapsedMs: elapsed != null && elapsed >= 0 ? round(elapsed) : null,
    elapsedIncludesNestedStagesAndWaits: true, detailDurationsAreNonAdditive: true,
    stages: rows(value.stages, 'name', WORK_STAGE_LIMIT),
    hostWaits: { task: workerAggregate(value.hostWaits?.task), display: workerAggregate(value.hostWaits?.display) },
    messagesBeforeTerminal: rows(value.messagesBeforeTerminal, 'kind', 32),
    messageTimingScope: 'synchronous_send_call_only_not_delivery_reception_or_host_processing_latency',
    terminalMessageTiming: 'excluded; snapshot precedes terminal send' };
}

function recordWorkerMeasurement(target, entry) {
  if (!Number.isSafeInteger(entry?.id) || entry.id <= 0 || !Number.isSafeInteger(entry.phaseId) || entry.phaseId <= 0) return;
  if (entry.kind === 'start') {
    if (target.workerPhases.has(entry.id)) return;
    target.workerPhasesRequested += 1;
    if (target.workerPhases.size >= WORKER_PHASE_LIMIT) {
      target.workerPhases.delete(target.workerPhases.keys().next().value);
      target.evictedWorkerPhases += 1;
    }
    target.workerPhases.set(entry.id, { id: entry.id, phaseId: entry.phaseId,
      status: 'pending', clientElapsedMs: null, diagnostics: null });
    return;
  }
  if (!['terminal', 'client-failure'].includes(entry.kind)) return;
  const phase = target.workerPhases.get(entry.id);
  if (!phase || phase.phaseId !== entry.phaseId || phase.status !== 'pending') return;
  const elapsed = finiteNumber(entry.clientElapsedMs);
  phase.clientElapsedMs = elapsed != null && elapsed >= 0 ? round(elapsed) : null;
  phase.diagnostics = entry.kind === 'terminal' ? workerReport(entry.diagnostics) : null;
  phase.status = entry.kind === 'client-failure' ? 'client-failure'
    : phase.diagnostics?.status || 'missing-worker-report';
  if (entry.kind === 'terminal') target.workerTerminalMessages += 1;
  else target.workerClientFailures += 1;
  if (phase.diagnostics) target.workerReports += 1;
}

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

  function captureMapCoverage(target, source) {
    const coverage = target.mapCoverage;
    coverage.samples += 1;
    if (Object.hasOwn(coverage.lifecycleCounts, source)) coverage.lifecycleCounts[source] += 1;
    const fail = (kind, reason, supported = coverage.supported) => {
      coverage.supported = supported;
      coverage.missingSamples += kind === 'map_missing' || kind === 'geometry_unavailable' ? 1 : 0;
      coverage.clippedSamples += kind === 'clipped' ? 1 : 0;
      coverage.fullSamples += 0;
      coverage.reason ||= reason;
      coverage.firstFailure ||= {
        kind,
        offsetMs: round(performanceRef.now() - target.startedAt),
        contextScope: 'latest observer context received before this geometry sample',
        gameContext: observerContextEvidence(target.context?.final),
        sample: kind === 'clipped' ? mapFailureEvidence(coverage.lastSample) : null,
      };
    };
    if (typeof documentRef?.querySelector !== 'function' || typeof windowRef?.getComputedStyle !== 'function') {
      fail('geometry_unavailable', 'DOM map geometry APIs unavailable', false);
      return;
    }
    let viewport, content, world;
    try {
      viewport = documentRef.querySelector(MAP_VIEWPORT_SELECTOR);
      content = viewport?.querySelector?.('[data-observer-map-content]');
      world = viewport?.querySelector?.(MAP_WORLD_SELECTOR);
    } catch {
      fail('geometry_unavailable', 'map geometry lookup failed', false);
      return;
    }
    if (!viewport || !content || !world || viewport.isConnected === false || world.isConnected === false) {
      fail('map_missing', 'minimap viewport, content or world SVG missing');
      return;
    }
    let viewportBox, contentRect, worldRect, clipChain = [], hidden = false;
    try {
      const viewportStyle = windowRef.getComputedStyle(viewport);
      const contentStyle = windowRef.getComputedStyle(content);
      const worldStyle = windowRef.getComputedStyle(world);
      const hiddenStyle = (style) => style?.display === 'none' || style?.visibility === 'hidden'
        || style?.visibility === 'collapse' || Number(style?.opacity) === 0;
      hidden = [viewportStyle, contentStyle, worldStyle].some(hiddenStyle);
      for (const style of [viewportStyle, contentStyle, worldStyle]) {
        if (!hasSupportedAxisTransform(style)) {
          fail('geometry_unavailable', 'rotated, skewed or unresolved CSS transform', false); return;
        }
      }
      viewportBox = clientBox(viewport, viewportStyle);
      contentRect = rectEvidence(content.getBoundingClientRect?.());
      worldRect = rectEvidence(world.getBoundingClientRect?.());
      const viewportWidth = finiteNumber(windowRef.innerWidth), viewportHeight = finiteNumber(windowRef.innerHeight);
      if (!viewportBox || !contentRect || !worldRect || viewportWidth == null || viewportHeight == null
        || viewportWidth <= 0 || viewportHeight <= 0 || worldRect.width <= 0 || worldRect.height <= 0) {
        fail('geometry_unavailable', 'map or viewport has no measurable positive bounds', false);
        return;
      }
      const browserBox = { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight,
        width: viewportWidth, height: viewportHeight };
      const clipCauses = [];
      let clipped = false;
      if (!containsRect(browserBox, viewportBox)) { clipped = true; clipCauses.push('browser-viewport'); }
      if (!containsRect(viewportBox, worldRect)) { clipped = true; clipCauses.push('map-viewport'); }
      if (!containsRect(contentRect, worldRect)) { clipped = true; clipCauses.push('map-content'); }
      let ancestor = viewport.parentElement;
      while (ancestor) {
        const style = windowRef.getComputedStyle(ancestor);
        if (!hasSupportedAxisTransform(style)) {
          fail('geometry_unavailable', 'rotated, skewed or unresolved ancestor transform', false); return;
        }
        hidden ||= hiddenStyle(style);
        const overflowX = String(style?.overflowX || style?.overflow || '').toLowerCase();
        const overflowY = String(style?.overflowY || style?.overflow || '').toLowerCase();
        const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(overflowX);
        const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(overflowY);
        if (ancestor !== documentRef.documentElement && (clipsX || clipsY)) {
          if (clipChain.length >= 8) { fail('geometry_unavailable', 'too many clipping ancestors to retain bounded evidence', false); return; }
          const box = clientBox(ancestor, style);
          if (!box) { fail('geometry_unavailable', 'clipping ancestor bounds unavailable', false); return; }
          let ancestorClips = false;
          if (clipsX && (worldRect.left < box.left - 0.5 || worldRect.right > box.right + 0.5
            || viewportBox.left < box.left - 0.5 || viewportBox.right > box.right + 0.5)) ancestorClips = true;
          if (clipsY && (worldRect.top < box.top - 0.5 || worldRect.bottom > box.bottom + 0.5
            || viewportBox.top < box.top - 0.5 || viewportBox.bottom > box.bottom + 0.5)) ancestorClips = true;
          if (ancestorClips) {
            clipped = true;
            clipCauses.push('clipping-ancestor');
          }
          clipChain.push({ rect: box, clipsX, clipsY, ...(ancestorClips ? elementEvidence(ancestor) : {}),
            overflowX: boundedString(overflowX, 12), overflowY: boundedString(overflowY, 12) });
        }
        ancestor = ancestor.parentElement;
      }
      const fullyDisplayed = !clipped && !hidden;
      if (hidden) clipCauses.push('hidden-style');
      const viewportEvidence = elementEvidence(viewport);
      coverage.lastSample = { source, offsetMs: round(performanceRef.now() - target.startedAt), viewport: viewportBox,
        content: contentRect, world: worldRect, browserViewport: browserBox, clipChain, clipCauses,
        scroll: { left: finiteNumber(viewport.scrollLeft), top: finiteNumber(viewport.scrollTop),
          width: finiteNumber(viewport.scrollWidth), height: finiteNumber(viewport.scrollHeight),
          clientWidth: finiteNumber(viewport.clientWidth), clientHeight: finiteNumber(viewport.clientHeight) },
        viewportClassName: viewportEvidence.className,
        zoomed: String(viewportEvidence.className || '').split(/\s+/).includes('is-zoomed'),
        fullyDisplayed, hiddenByStyle: hidden };
      if (fullyDisplayed) coverage.fullSamples += 1;
      else fail('clipped', hidden ? 'map viewport or SVG is hidden by CSS' : 'transformed map world is clipped by a viewport');
    } catch {
      fail('geometry_unavailable', 'map geometry measurement failed', false);
    }
  }

  function mapCoverageSnapshot(target) {
    const coverage = target.mapCoverage;
    return { scope: 'DOM geometry at start, every RAF callback, captured scroll/resize and stop; no native occlusion, paint or human-legibility proof',
      supported: coverage.supported, reason: coverage.reason,
      samples: coverage.samples, fullSamples: coverage.fullSamples, missingSamples: coverage.missingSamples,
      clippedSamples: coverage.clippedSamples,
      firstFailure: coverage.firstFailure ? structuredClone(coverage.firstFailure) : null,
      boundaryNotifications: coverage.boundaryNotifications,
      lifecycleCounts: { ...coverage.lifecycleCounts }, lastSample: coverage.lastSample ? structuredClone(coverage.lastSample) : null,
      nativeOcclusionProven: false, paintProven: false, humanLegibilityProven: false,
      fullyDisplayedThroughout: coverage.supported && coverage.samples > 0 && coverage.missingSamples === 0
        && coverage.clippedSamples === 0 && coverage.fullSamples === coverage.samples
        && coverage.boundaryNotifications === 0
        && coverage.lifecycleCounts.start === 1 && coverage.lifecycleCounts.end === 1
        && coverage.lifecycleCounts.raf >= 2 };
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
      waitBreakdown: { scope: 'async_wait_settlements_separate_from_synchronous_work',
        waits: [...target.waitStages.values()].map((stage) => ({ ...stage,
          totalMs: round(stage.totalMs), maxMs: round(stage.maxMs) })) },
      workerBreakdown: {
        scope: 'whole_worker_phases_requested_during_this_probe_not_CPU_attribution',
        clockScope: 'worker_and_client_elapsed_durations_only_not_shared_absolute_timestamps',
        clientElapsedScope: 'ready_worker_before_command_posts_to_terminal_receipt_excludes_host_finish_settlement',
        statusScope: 'worker_terminal_report_not_client_phase_success',
        measurementStartScope: 'client_measurement_start_before_command_posts_not_successful_phase_posts',
        coverage: 'no_retroactive_mid_phase_capture_or_results_from_stopped_or_replaced_probes',
        stopScope: 'late_reports_discarded_but_an_opted_in_worker_phase_keeps_measuring_until_it_ends',
        phaseLimit: WORKER_PHASE_LIMIT, requestedPhases: target.workerPhasesRequested,
        terminalMessages: target.workerTerminalMessages, clientFailures: target.workerClientFailures,
        reports: target.workerReports,
        missingReports: target.workerPhasesRequested - target.workerReports,
        missingReportsScope: 'started_measurements_without_valid_report_including_pending_evicted_and_client_failures',
        retainedPendingPhases: [...target.workerPhases.values()].filter(phase => phase.status === 'pending').length,
        evictedPhases: target.evictedWorkerPhases,
        phases: structuredClone([...target.workerPhases.values()]),
      },
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
      mapCoverage: mapCoverageSnapshot(target),
    };
  }

  function closeBoundary(target, reason) {
    if (target.stoppedAt != null) return;
    captureMapCoverage(target, 'end');
    // Include the synchronous final geometry read in the measured interval;
    // never clamp its sample timestamp to conceal collection cost.
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
    if (finished.mapCoverage.scrollListener) documentRef.removeEventListener('scroll', finished.mapCoverage.scrollListener, true);
    if (finished.mapCoverage.resizeListener) windowRef.removeEventListener('resize', finished.mapCoverage.resizeListener);
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
      waitStages: new Map(),
      workerPhases: new Map(),
      workerPhasesRequested: 0,
      workerTerminalMessages: 0,
      workerClientFailures: 0,
      workerReports: 0,
      evictedWorkerPhases: 0,
      unsubscribeWork: null,
      mapCoverage: { supported: typeof documentRef?.querySelector === 'function'
          && typeof windowRef?.getComputedStyle === 'function'
          && typeof documentRef?.addEventListener === 'function' && typeof documentRef?.removeEventListener === 'function'
          && typeof windowRef?.addEventListener === 'function' && typeof windowRef?.removeEventListener === 'function',
        reason: null, samples: 0, fullSamples: 0, missingSamples: 0, clippedSamples: 0,
        firstFailure: null, lastSample: null,
        boundaryNotifications: 0,
        lifecycleCounts: { start: 0, raf: 0, scroll: 0, resize: 0, end: 0 },
        scrollListener: null, resizeListener: null },
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
    if (next.mapCoverage.supported) {
      const notifyMapChange = (source) => {
        if (state !== next) return;
        if (next.stoppedAt != null) { next.mapCoverage.boundaryNotifications += 1; return; }
        captureMapCoverage(next, source);
      };
      next.mapCoverage.scrollListener = () => notifyMapChange('scroll');
      next.mapCoverage.resizeListener = () => notifyMapChange('resize');
      documentRef.addEventListener('scroll', next.mapCoverage.scrollListener, true);
      windowRef.addEventListener('resize', next.mapCoverage.resizeListener);
    } else {
      next.mapCoverage.reason = 'DOM geometry or scroll/resize lifecycle events unavailable';
    }
    captureMapCoverage(next, 'start');
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
      const name = String(entry.name).slice(0, WORK_STAGE_NAME_LIMIT);
      if (!next.workStages.has(name) && next.workStages.size >= WORK_STAGE_LIMIT) return;
      const stage = next.workStages.get(name) || { name, count: 0, totalMs: 0, maxMs: -1, maxStartOffsetMs: 0 };
      stage.count += 1; stage.totalMs += entry.duration;
      if (entry.duration > stage.maxMs) { stage.maxMs = entry.duration; stage.maxStartOffsetMs = entry.startTime - next.startedAt; }
      next.workStages.set(name, stage);
    }, (entry) => {
      if (state !== next || next.stoppedAt != null || !Number.isFinite(entry.duration) || entry.duration < 0) return;
      const name = String(entry.name).slice(0, WORK_STAGE_NAME_LIMIT);
      if (!next.waitStages.has(name) && next.waitStages.size >= WORK_STAGE_LIMIT) return;
      const stage = next.waitStages.get(name) || { name, count: 0, totalMs: 0, maxMs: 0 };
      stage.count = Math.min(MAX_WAIT_COUNT, stage.count + 1);
      stage.totalMs = Math.min(MAX_WAIT_TOTAL_MS, stage.totalMs + entry.duration);
      stage.maxMs = Math.max(stage.maxMs, entry.duration);
      next.waitStages.set(name, stage);
    }, (entry) => {
      if (state !== next || next.stoppedAt != null) return;
      recordWorkerMeasurement(next, entry);
    });
    const sample = (timestamp) => {
      if (state !== next || next.stoppedAt != null) return;
      captureMapCoverage(next, 'raf');
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
