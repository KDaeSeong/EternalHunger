import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { createObserverPerformanceProbe } = await import('../src/app/simulation/_lib/observerPerformanceRuntime.js');
const { measureObserverWork, subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');
const panelSource = readFileSync(new URL('../src/app/simulation/_components/SimulationObserverPerformancePanel.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

function harness({ observeThrows = false, animationFrames = false, animationObserveThrows = false, visibilityEvents = true,
  longTaskAdvertised = true } = {}) {
  let now = 0, serial = 0;
  const callbacks = new Map(), timers = new Map(), observers = [];
  const performanceRef = { now: () => now, timeOrigin: 1000000,
    memory: { usedJSHeapSize: 100, totalJSHeapSize: 200, jsHeapSizeLimit: 300 } };
  const windowRef = { requestAnimationFrame: (callback) => { callbacks.set(++serial, callback); return serial; },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    setTimeout: (callback) => { timers.set(++serial, callback); return serial; }, clearTimeout: (id) => timers.delete(id) };
  class PerformanceObserverRef {
    static supportedEntryTypes = [...(longTaskAdvertised ? ['longtask'] : []), ...(animationFrames ? ['long-animation-frame'] : [])];
    constructor(callback) { this.callback = callback; this.queued = []; this.disconnected = false; observers.push(this); }
    observe({ type }) {
      this.type = type;
      if (observeThrows || type === 'long-animation-frame' && animationObserveThrows) throw new Error('Observation unavailable.');
    }
    takeRecords() { return this.queued.splice(0); }
    disconnect() { this.disconnected = true; }
  }
  const visibilityListeners = new Set();
  const documentRef = { visibilityState: 'visible', getElementsByTagName: () => [] };
  if (visibilityEvents) {
    documentRef.addEventListener = (type, callback) => { if (type === 'visibilitychange') visibilityListeners.add(callback); };
    documentRef.removeEventListener = (type, callback) => { if (type === 'visibilitychange') visibilityListeners.delete(callback); };
  }
  const probe = createObserverPerformanceProbe({ windowRef, performanceRef, PerformanceObserverRef, documentRef });
  return { probe, callbacks, timers, observers, performanceRef, visibilityListeners, setNow: (value) => { now = value; },
    fireTimer: (id) => { const callback = timers.get(id); timers.delete(id); callback(); },
    setVisibility: (value) => { documentRef.visibilityState = value; [...visibilityListeners].forEach((callback) => callback()); },
    frame: (timestamp) => {
      now = timestamp;
      const ready = [...callbacks.values()]; callbacks.clear();
      ready.forEach((callback) => callback(timestamp));
    } };
}

check('RAF, long-task, heap, and DOM metrics are measured without timer-as-FPS substitution', () => {
  let now = 100; let rafId = 0; const callbacks = new Map(); let timer; let cleared = false; let observer;
  const performanceRef = { now: () => now, memory: { usedJSHeapSize: 10, totalJSHeapSize: 20, jsHeapSizeLimit: 30 } };
  const windowRef = {
    performance: performanceRef,
    requestAnimationFrame: (callback) => { const id = ++rafId; callbacks.set(id, callback); return id; },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    setTimeout: (callback) => { timer = callback; return 1; },
    clearTimeout: () => { cleared = true; },
    PerformanceObserver: class { static supportedEntryTypes = ['longtask']; constructor(callback) { this.callback = callback; observer = this; } observe() {} takeRecords() { return []; } disconnect() {} },
  };
  class PerformanceObserverRef extends windowRef.PerformanceObserver {}
  const probe = createObserverPerformanceProbe({ windowRef, documentRef: { getElementsByTagName: () => [1, 2, 3] }, performanceRef, PerformanceObserverRef });
  probe.start({ label: 'x8', durationMs: 1000 });
  observer.callback({ getEntries: () => [{ startTime: 10, duration: 80 }, { startTime: 110, duration: 55 }] });
  const first = callbacks.values().next().value; callbacks.clear(); now = 116; first(116);
  const second = callbacks.values().next().value; callbacks.clear(); now = 132; second(132);
  performanceRef.memory.usedJSHeapSize = 18;
  const result = probe.stop();
  assert.equal(result.label, 'x8');
  assert.equal(result.schema, 'eh-observer-performance.v3');
  assert.equal(result.raf.samples, 1);
  assert.equal(result.raf.fps, 31.25);
  assert.equal(result.heap.usedBytes, 18);
  assert.equal(result.heap.baselineUsedBytes, 10);
  assert.equal(result.heap.deltaUsedBytes, 8);
  assert.deepEqual(result.longTasks, { supported: true, count: 1, totalMs: 55, maxMs: 55, reason: null });
  assert.equal(result.domNodes, 3);
  assert.equal(typeof timer, 'function');
  assert.equal(cleared, true);
});

check('unsupported heap and long-task APIs remain explicit', () => {
  let now = 0; const callbacks = [];
  const windowRef = { requestAnimationFrame: (callback) => { callbacks.push(callback); return callbacks.length; }, cancelAnimationFrame: () => {} };
  const probe = createObserverPerformanceProbe({ windowRef, performanceRef: { now: () => now }, documentRef: {} });
  probe.start({ label: 'x1' });
  const result = probe.stop();
  assert.deepEqual(result.heap, { supported: false, reason: 'performance.memory unavailable' });
  assert.equal(result.longTasks.supported, false);
});

check('a long measurement does not overflow the argument stack when producing its snapshot', () => {
  let now = 0, callback;
  const windowRef = { requestAnimationFrame: (next) => { callback = next; return 1; }, cancelAnimationFrame: () => {} };
  const probe = createObserverPerformanceProbe({ windowRef, performanceRef: { now: () => now }, documentRef: {} });
  probe.start({ label: 'synthetic-200000-frames' });
  callback(0);
  for (let i = 1; i <= 200000; i++) { now += i === 1 ? 750 : 10; callback(now); }
  let result;
  assert.doesNotThrow(() => { result = probe.stop(); });
  assert.equal(result.raf.samples, 200000);
  assert.equal(result.raf.intervalMs.max, 750, 'The first stall cannot disappear from the full measurement maximum.');
  assert.equal(result.raf.intervalMs.median, 10); assert.equal(result.raf.intervalMs.p95, 10);
  assert.equal(result.raf.percentiles.bins, 10001);
  assert.equal(result.raf.percentiles.scope, 'entire_measurement');
  assert.equal(result.raf.percentiles.overflowSamples, 0);
  assert.equal(result.elapsedMs, 2000740);
});

check('percentiles include the entire measurement with explicit rounding, not only a recent fast window', () => {
  const h = harness(); h.probe.start(); h.frame(0);
  let time = 0;
  for (let i = 0; i < 10000; i++) { time += i < 2000 ? 200 : 10; h.frame(time); }
  const result = h.probe.stop();
  assert.deepEqual(result.raf.intervalMs, { median: 10, p95: 200, max: 200 });
  assert.equal(result.raf.percentiles.resolutionMs, 0.1);
  const rounded = harness(); rounded.probe.start(); rounded.frame(0); rounded.frame(16.04);
  assert.deepEqual(rounded.probe.stop().raf.intervalMs, { median: 16, p95: 16, max: 16.04 });
});

check('histogram overflow is reported as a range and cannot clamp a slow session into a passing value', () => {
  const h = harness(); h.probe.start(); h.frame(0); h.frame(1500); h.frame(6000);
  const result = h.probe.stop();
  assert.equal(result.raf.samples, 2);
  assert.deepEqual(result.raf.intervalMs, { median: null, p95: null, max: 4500 });
  assert.equal(result.raf.percentiles.overflowSamples, 2);
  assert.deepEqual(result.raf.percentiles.medianRangeMs, [1500, 4500]);
  assert.deepEqual(result.raf.percentiles.p95RangeMs, [1500, 4500]);
  assert.equal(result.raf.fps, 0.333);
});

check('many long tasks and pending records retain the complete count, total and earliest peak without a raw array', () => {
  const h = harness(); h.probe.start(); h.setNow(20000000);
  h.observers[0].callback({ getEntries: function* () {
    yield { startTime: -10000, duration: 9999 };
    yield { startTime: 1, duration: -1 };
    yield { startTime: 1, duration: NaN };
    for (let i = 0; i < 200000; i++) yield { startTime: i * 60, duration: i === 0 ? 750 : 50 };
  } });
  h.observers[0].queued.push({ startTime: 18000000, duration: 80 });
  const result = h.probe.stop();
  assert.deepEqual(result.longTasks, { supported: true, count: 200001, totalMs: 10000780, maxMs: 750, reason: null });
  assert.equal(h.observers[0].disconnected, true);
});

check('a large click burst uses one pending RAF and retains all input samples, first peak and last delay', () => {
  const h = harness(); h.probe.start(); h.setNow(100);
  h.probe.recordInput(0);
  for (let i = 1; i < 200000; i++) h.probe.recordInput(90);
  assert.equal(h.callbacks.size, 2, 'One sampling RAF plus one input RAF, not one callback per click.');
  h.frame(110);
  const result = h.probe.stop();
  assert.deepEqual(result.inputResponse, { supported: true, samples: 200000, pendingSamples: 0,
    scope: 'captured_click_to_next_RAF_not_INP_or_presentation', lastMs: 20, maxMs: 110 });
  assert.equal(h.callbacks.size, 0);
});

check('epoch and invalid event timestamps normalize to the same performance clock', () => {
  const h = harness(); h.probe.start(); h.setNow(100);
  h.probe.recordInput(h.performanceRef.timeOrigin + 95);
  h.probe.recordInput(NaN);
  h.frame(110);
  assert.deepEqual(h.probe.stop().inputResponse, { supported: true, samples: 2, pendingSamples: 0,
    scope: 'captured_click_to_next_RAF_not_INP_or_presentation', lastMs: 10, maxMs: 15 });
});

check('stop/restart rejects old input, RAF and observer callbacks and resets every metric', () => {
  const h = harness(); h.probe.start({ durationMs: 1000 }); h.probe.recordInput(0);
  const oldCallbacks = [...h.callbacks.values()], oldObserver = h.observers[0];
  const finished = h.probe.stop();
  assert.equal(finished.inputResponse.samples, 0, 'A cancelled click has no observed next RAF.');
  assert.equal(h.callbacks.size, 0); assert.equal(h.timers.size, 0);
  assert.equal(h.probe.recordInput(1), false); assert.equal(h.probe.snapshot(), null);
  h.setNow(2000); h.performanceRef.memory.usedJSHeapSize = 150;
  h.probe.start({ label: 'second' });
  oldCallbacks.forEach((callback) => callback(2100));
  oldObserver.callback({ getEntries: () => [{ startTime: 2100, duration: 900 }] });
  assert.equal(h.callbacks.size, 1);
  const fresh = h.probe.snapshot();
  assert.equal(fresh.label, 'second'); assert.equal(fresh.raf.samples, 0);
  assert.equal(fresh.inputResponse.samples, 0); assert.equal(fresh.longTasks.count, 0);
  assert.equal(fresh.heap.baselineUsedBytes, 150); assert.equal(fresh.visibilityState, 'visible');
  h.probe.stop();
});

check('automatic stop and observer initialization failure release their scheduled resources', () => {
  const h = harness({ observeThrows: true }); h.probe.start({ durationMs: 1000 });
  assert.equal(h.observers[0].disconnected, true); assert.equal(h.probe.snapshot().longTasks.supported, false);
  h.probe.recordInput(0);
  h.setNow(1000); [...h.timers.values()][0]();
  assert.equal(h.probe.isRunning(), true, 'Automatic stop first waits for the final browser records.');
  h.setNow(2000); h.fireTimer([...h.timers.keys()].at(-1));
  assert.equal(h.probe.isRunning(), false); assert.equal(h.callbacks.size, 0); assert.equal(h.timers.size, 0);
});

check('long animation frames distinguish work, render, layout and script entrypoints without replacing long tasks', () => {
  const h = harness({ animationFrames: true }); h.setNow(100); h.probe.start();
  const observer = h.observers.find((row) => row.type === 'long-animation-frame');
  assert.ok(observer, 'Use a separately feature-detected long-animation-frame observer.');
  observer.callback({ getEntries: () => [{ startTime: 150, duration: 300, renderStart: 350,
    styleAndLayoutStart: 400, blockingDuration: 220,
    scripts: [{ startTime: 160, duration: 180, executionStart: 165, forcedStyleAndLayoutDuration: 3,
      invoker: 'Window.setTimeout', invokerType: 'user-callback', sourceFunctionName: 'advance',
      sourceURL: 'http://localhost:3107/_next/chunk.js?private=value#fragment', sourceCharPosition: 123,
      windowAttribution: 'self', window: { cyclic: true } }] }] });
  h.setNow(450);
  const result = h.probe.stop(), frames = result.longAnimationFrames;
  assert.equal(frames.supported, true); assert.equal(frames.count, 1);
  assert.equal(frames.maxDurationMs, 300); assert.equal(frames.maxWorkMs, 200);
  assert.equal(frames.maxRenderMs, 100); assert.equal(frames.maxStyleAndLayoutMs, 50);
  assert.equal(frames.maxBlockingMs, 220);
  assert.equal(frames.slowest[0].startOffsetMs, 50);
  assert.equal(frames.slowest[0].scripts[0].sourceFunctionName, 'advance');
  assert.equal(frames.slowest[0].scripts[0].sourceURL, 'http://localhost:3107/_next/chunk.js');
  assert.equal(frames.slowest[0].scripts[0].forcedStyleAndLayoutMs, 3);
  assert.equal('window' in frames.slowest[0].scripts[0], false);
  assert.deepEqual(result.longTasks, { supported: true, count: 0, totalMs: 0, maxMs: null, reason: null });
  assert.equal(observer.disconnected, true);
});

check('animation attribution is bounded but totals and the first peak span the whole session', () => {
  const h = harness({ animationFrames: true }); h.probe.start();
  const observer = h.observers.find((row) => row.type === 'long-animation-frame');
  assert.ok(observer);
  const scripts = Array.from({ length: 12 }, (_, index) => ({ duration: 10 + index,
    sourceFunctionName: 'x'.repeat(2000), invoker: 'x'.repeat(2000) }));
  observer.callback({ getEntries: function* () {
    for (let i = 0; i < 200000; i++) yield { startTime: i * 1000, duration: i === 0 ? 950 : 60,
      renderStart: 0, styleAndLayoutStart: 0, blockingDuration: i === 0 ? 900 : 10,
      scripts };
  } });
  const frames = h.probe.stop().longAnimationFrames;
  assert.equal(frames.count, 200000); assert.equal(frames.totalDurationMs, 12000890);
  assert.equal(frames.maxDurationMs, 950); assert.equal(frames.maxWorkMs, 950);
  assert.equal(frames.maxRenderMs, 0); assert.equal(frames.maxStyleAndLayoutMs, 0);
  assert.equal(frames.slowest.length, 8); assert.equal(frames.slowest[0].durationMs, 950);
  assert.equal(frames.slowest[0].scriptCount, 12); assert.equal(frames.slowest[0].scripts.length, 8);
  assert.equal(frames.slowest[0].scripts[0].durationMs, 21);
  assert.equal(frames.slowest[0].scripts[0].sourceFunctionName.length, 512);
  assert.equal(frames.slowest[0].scripts[0].invoker.length, 512);
});

check('animation frame records are drained at stop, owned in snapshots and excluded across restarts', () => {
  const h = harness({ animationFrames: true }); h.setNow(100); h.probe.start();
  const old = h.observers.find((row) => row.type === 'long-animation-frame');
  assert.ok(old);
  old.callback({ getEntries: () => [{ startTime: -1000, duration: 900 }, { startTime: NaN, duration: 900 },
    { startTime: 110, duration: -1 }, { startTime: 110, duration: Infinity }] });
  old.queued.push({ startTime: 110, duration: 75, renderStart: 0,
    scripts: [{ duration: 60, sourceFunctionName: 'original' }] });
  h.setNow(185);
  assert.equal(h.probe.stop().longAnimationFrames.count, 1);
  h.setNow(2000); h.probe.start();
  old.callback({ getEntries: () => [{ startTime: 2010, duration: 999 }] });
  assert.equal(h.probe.snapshot().longAnimationFrames.count, 0);
  const current = h.observers.filter((row) => row.type === 'long-animation-frame').at(-1);
  current.callback({ getEntries: () => [{ startTime: 2010, duration: 80,
    scripts: [{ duration: 60, sourceFunctionName: 'original' }] }] });
  const snapshot = h.probe.snapshot();
  snapshot.longAnimationFrames.slowest[0].scripts[0].sourceFunctionName = 'mutated';
  snapshot.longAnimationFrames.slowest.length = 0;
  h.setNow(2090);
  const result = h.probe.stop();
  assert.equal(result.longAnimationFrames.slowest[0].scripts[0].sourceFunctionName, 'original');
  assert.equal(h.callbacks.size, 0); assert.equal(current.disconnected, true);
});

check('unsupported or failed animation attribution does not disable the long-task acceptance metric', () => {
  for (const options of [{}, { animationFrames: true, animationObserveThrows: true }]) {
    const h = harness(options); h.probe.start();
    assert.equal(h.probe.snapshot().longAnimationFrames.supported, false);
    assert.equal(h.probe.snapshot().longTasks.supported, true);
    h.observers[0].callback({ getEntries: () => [{ startTime: 1, duration: 250 }] });
    assert.equal(h.probe.stop().longTasks.maxMs, 250);
    assert.ok(h.observers.every((observer) => observer.disconnected));
  }
});

check('optional work timings retain result identity and the original thrown error', () => {
  const h = harness(); const value = {}, failure = new Error('work failure');
  assert.equal(measureObserverWork('disabled', () => value), value);
  h.probe.start();
  assert.equal(measureObserverWork('prepare', () => { h.setNow(20); return value; }), value);
  assert.throws(() => measureObserverWork('prepare', () => { h.setNow(50); throw failure; }), (error) => error === failure);
  const result = h.probe.stop();
  assert.deepEqual(result.workBreakdown.stages, [{ name: 'prepare', count: 2, totalMs: 50, maxMs: 30, maxStartOffsetMs: 20 }]);
  measureObserverWork('after-stop', () => value);
  assert.equal(result.workBreakdown.stages.length, 1);
});

check('work breakdown uses bounded names, owned snapshots and a restarted baseline', () => {
  const h = harness(); h.probe.start();
  for (let index = 0; index < 100; index++) measureObserverWork(`stage-${index}-${'x'.repeat(200)}`, () => h.setNow(index + 1));
  const result = h.probe.snapshot();
  assert.equal(result.workBreakdown.stages.length, 24);
  assert.equal(result.workBreakdown.stages[0].name.length, 80);
  result.workBreakdown.stages[0].maxMs = 999;
  assert.equal(h.probe.snapshot().workBreakdown.stages[0].maxMs, 1);
  h.probe.start(); assert.deepEqual(h.probe.stop().workBreakdown.stages, []);
});

check('diagnostic clock/callback failures cannot replace game results and stale disposal cannot cancel a new recorder', () => {
  const value = {}, captured = [];
  let dispose = subscribeObserverWorkMeasurements(() => { throw new Error('clock failure'); }, () => {});
  assert.equal(measureObserverWork('clock-failed', () => value), value); dispose();
  dispose = subscribeObserverWorkMeasurements(() => 1, () => { throw new Error('recorder failure'); });
  assert.equal(measureObserverWork('callback-failed', () => value), value);
  const newerDispose = subscribeObserverWorkMeasurements(() => 2, (entry) => captured.push(entry));
  dispose(); measureObserverWork('newer', () => value); newerDispose();
  assert.equal(captured.length, 1); assert.equal(captured[0].name, 'newer');
});

check('visibility events preserve hidden intervals even when both endpoints are visible', () => {
  const h = harness(); h.probe.start(); h.setNow(100); h.setVisibility('hidden');
  h.setNow(350); h.setVisibility('visible'); h.setNow(500);
  const result = h.probe.stop();
  assert.deepEqual(result.visibility, { supported: true, reason: null, initialState: 'visible', endState: 'visible',
    transitions: 2, boundaryNotifications: 0, durationMs: { visible: 250, hidden: 250, unknown: 0 }, entireMeasurementVisible: false });
  assert.equal(h.visibilityListeners.size, 0);
});

check('snapshots do not double-count visibility durations and unsupported events cannot prove visible coverage', () => {
  const h = harness(); h.probe.start(); h.setNow(10);
  assert.equal(h.probe.snapshot().visibility.durationMs.visible, 10);
  assert.equal(h.probe.snapshot().visibility.durationMs.visible, 10);
  h.setNow(30); assert.equal(h.probe.stop().visibility.durationMs.visible, 30);
  const unsupported = harness({ visibilityEvents: false }); unsupported.probe.start(); unsupported.setNow(30);
  const result = unsupported.probe.stop();
  assert.equal(result.visibility.initialState, 'visible'); assert.equal(result.visibility.endState, 'visible');
  assert.equal(result.visibility.supported, false); assert.equal(result.visibility.durationMs, null);
  assert.equal(result.visibility.entireMeasurementVisible, false);
});

check('restart and automatic stop release visibility listeners and reject stale events', () => {
  const h = harness(); h.probe.start(); const oldListener = [...h.visibilityListeners][0];
  h.setNow(100); h.probe.start({ durationMs: 1000 }); assert.equal(h.visibilityListeners.size, 1);
  h.setVisibility('hidden'); h.setNow(150); oldListener();
  assert.deepEqual(h.probe.snapshot().visibility.durationMs, { visible: 0, hidden: 50, unknown: 0 });
  h.setNow(200); [...h.timers.values()][0]();
  assert.equal(h.visibilityListeners.size, 0); assert.equal(h.probe.isRunning(), false);
});

check('unknown and initially hidden documents never pass the continuous visibility condition', () => {
  const h = harness(); h.setVisibility('hidden'); h.probe.start(); h.setNow(10); h.setVisibility('unknown');
  h.setNow(20); h.setVisibility('visible'); h.setNow(30);
  assert.deepEqual(h.probe.stop().visibility.durationMs, { visible: 10, hidden: 10, unknown: 10 });
  h.probe.start(); h.setNow(40);
  assert.equal(h.probe.stop().visibility.entireMeasurementVisible, true);
});

check('panel is query-gated and exposes accessible controls and JSON output', () => {
  assert.match(panelSource, /get\('perfProbe'\) === '1'/);
  assert.match(panelSource, /data-testid="observer-performance-start"/);
  assert.match(panelSource, /data-testid="observer-performance-stop"/);
  assert.match(panelSource, /data-testid="observer-performance-result"/);
  assert.match(panelSource, /if \(!enabled\) return null/);
  assert.match(panelSource, /document\.addEventListener\('click', onCaptureClick, true\)/);
  assert.match(panelSource, /probe\.recordInput\(event\.timeStamp\)/);
  assert.match(panelSource, /removeEventListener\('click', onCaptureClick, true\)/);
  assert.match(panelSource, /probe\.stop\(\)/);
  assert.doesNotMatch(panelSource, /Math\.max\(\.\.\.|samples\.push|pending\.push|requestAnimationFrame/);
});

check('diagnostic JSON is collapsed by default and bounded so it cannot push the battlefield out of view', () => {
  assert.match(panelSource, /<aside className="sim-observer-performance"/);
  assert.match(panelSource, /<details className="sim-observer-performance-result">/);
  assert.match(panelSource, /<summary>측정 JSON 보기<\/summary>/);
  assert.match(styles, /\.sim-observer-performance \{[^}]*flex: 0 0 auto;[^}]*max-height: 25dvh;[^}]*overflow: auto;/);
  assert.match(styles, /\.sim-observer-performance-result pre \{[^}]*max-height: 160px;[^}]*overflow: auto;/);
});

check('silently accepting an unsupported entry type cannot mark Long Tasks as supported', () => {
  const h = harness({ longTaskAdvertised: false }); h.probe.start();
  assert.equal(h.observers.length, 0);
  assert.equal(h.probe.stop().longTasks.supported, false);
});

check('first RAF and unfinished trailing intervals cannot disappear behind a healthy p95', () => {
  const h = harness(); h.probe.start(); h.frame(300); h.frame(316); h.setNow(900);
  const result = h.probe.stop();
  assert.equal(result.raf.intervalMs.p95, 16);
  assert.deepEqual(result.raf.boundaryGapsMs, { firstRafDelay: 300, trailingRafGap: 584 });
  assert.equal(result.boundary.status, 'incomplete');
  const empty = harness(); empty.probe.start(); empty.setNow(600);
  assert.deepEqual(empty.probe.stop().raf.boundaryGapsMs, { firstRafDelay: null, trailingRafGap: 600 });
});

check('boundary-overlapping entries are retained but invalid timestamps and wholly old work are excluded', () => {
  const h = harness(); h.setNow(100); h.probe.start();
  h.observers[0].callback({ getEntries: () => [
    { startTime: 90, duration: 211 }, { startTime: 10, duration: 80 },
    { startTime: NaN, duration: 900 }, { startTime: null, duration: 900 },
  ] });
  h.setNow(400);
  assert.equal(h.probe.stop().longTasks.maxMs, 211);
});

check('malformed heap numbers are unavailable rather than apparent zero memory growth', () => {
  const h = harness(); h.performanceRef.memory.usedJSHeapSize = NaN; h.probe.start();
  h.performanceRef.memory.usedJSHeapSize = 100;
  assert.equal(h.probe.snapshot().heap.baselineUsedBytes, null);
  h.performanceRef.memory.totalJSHeapSize = Infinity;
  assert.equal(h.probe.stop().heap.supported, false);
});

check('a queued visibility event with the same observed endpoint cannot certify continuous visibility', () => {
  const h = harness(); h.probe.start(); h.setNow(100); h.setVisibility('visible');
  const result = h.probe.stop();
  assert.equal(result.visibility.transitions, 1);
  assert.equal(result.visibility.entireMeasurementVisible, false);
});

const asyncCheck = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
await asyncCheck('visibility notifications delivered during finalization invalidate coverage without extending cutoff durations', async () => {
  const h = harness(); h.probe.start(); h.frame(16); h.setNow(100);
  const pending = h.probe.stopAfterFrame({ reason: 'replay-complete' });
  assert.equal(h.probe.snapshot().visibility.entireMeasurementVisible, true);
  h.setNow(110); h.setVisibility('visible');
  h.setNow(120); h.setVisibility('hidden'); h.setNow(130); h.setVisibility('visible');
  h.frame(150); h.fireTimer([...h.timers.keys()].at(-1));
  const result = await pending;
  assert.equal(result.boundary.status, 'settled');
  assert.equal(result.visibility.transitions, 3); assert.equal(result.visibility.boundaryNotifications, 3);
  assert.equal(result.visibility.entireMeasurementVisible, false);
  assert.deepEqual(result.visibility.durationMs, { visible: 100, hidden: 0, unknown: 0 });
  assert.equal(result.endedAtMs, 100); assert.equal(result.elapsedMs, 100);
  assert.equal(h.probe.getLastResult().visibility.entireMeasurementVisible, false);
});

await asyncCheck('post-stop RAF then task drains late end records without extending the measured clock or heap', async () => {
  const h = harness({ animationFrames: true }); h.setNow(100); h.probe.start(); h.frame(116); h.frame(132);
  h.probe.recordInput(132); h.setNow(200);
  const pending = h.probe.stopAfterFrame({ reason: 'replay-complete' });
  assert.equal(h.probe.recordInput(201), false);
  const task = h.observers.find(row => row.type === 'longtask');
  const animation = h.observers.find(row => row.type === 'long-animation-frame');
  task.queued.push({ startTime: 190, duration: 284 }, { startTime: 200, duration: 999 });
  animation.queued.push({ startTime: 190, duration: 300, renderStart: 440 });
  h.performanceRef.memory.usedJSHeapSize = 180;
  h.frame(500);
  assert.equal(h.probe.isRunning(), true, 'An RAF callback alone is not the post-render task barrier.');
  h.setNow(501); h.fireTimer([...h.timers.keys()].at(-1));
  const result = await pending;
  assert.equal(result.boundary.status, 'settled'); assert.equal(result.elapsedMs, 100);
  assert.equal(result.longTasks.count, 1); assert.equal(result.longTasks.maxMs, 284);
  assert.equal(result.longAnimationFrames.maxDurationMs, 300);
  assert.equal(result.heap.usedBytes, 100); assert.equal(result.visibility.durationMs.visible, 100);
  assert.equal(result.inputResponse.pendingSamples, 0);
  assert.equal(h.callbacks.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.visibilityListeners.size, 0);
  result.longTasks.maxMs = 0;
  assert.equal(h.probe.getLastResult().longTasks.maxMs, 284, 'Persist an independently owned final result.');
});

await asyncCheck('automatic stop preserves a retrievable result and timeout is explicitly incomplete', async () => {
  const h = harness(); h.probe.start({ durationMs: 500 }); h.frame(16); h.setNow(500);
  h.fireTimer([...h.timers.keys()][0]); h.setNow(1500); h.fireTimer([...h.timers.keys()][0]);
  const result = h.probe.getLastResult();
  assert.equal(result.elapsedMs, 500); assert.equal(result.boundary.status, 'incomplete');
  assert.equal(result.boundary.stopReason, 'duration'); assert.equal(h.probe.isRunning(), false);
  assert.equal(h.callbacks.size, 0); assert.equal(h.timers.size, 0);
});

await asyncCheck('restarting during finalization cancels the old barrier and cannot contaminate the next run', async () => {
  const h = harness(); h.probe.start(); h.setNow(100);
  const old = h.probe.stopAfterFrame(); const callbacks = [...h.callbacks.values()];
  h.setNow(200); h.probe.start({ label: 'new' });
  assert.equal((await old).boundary.status, 'incomplete');
  callbacks.forEach(callback => callback(250));
  assert.equal(h.probe.snapshot().label, 'new'); assert.equal(h.probe.snapshot().raf.samples, 0);
  h.probe.stop(); assert.equal(h.timers.size, 0); assert.equal(h.visibilityListeners.size, 0);
});

check('actual context tracks speed, replay identity and pauses without retaining records', () => {
  const h = harness(); const context = { engineVersion: 'engine', speed: 1, seed: '1101', replayId: 'source',
    autoPlay: false, isGameOver: false, matchSec: 0, record: { private: true } };
  h.probe.start({ label: 'x32', context }); h.setNow(10); h.probe.updateContext({ ...context, autoPlay: true });
  h.setNow(30); h.probe.updateContext({ ...context, speed: 8, replayId: 'other' });
  h.setNow(40); h.probe.updateContext({ ...context, speed: 8, replayId: 'other', isGameOver: true, matchSec: 20 });
  const result = h.probe.stop();
  assert.equal(result.context.initial.speed, 1); assert.equal(result.context.speedChanges, 1);
  assert.equal(result.context.identityChanges, 1); assert.equal(result.context.pauses, 1);
  assert.equal(result.context.activeStartOffsetMs, 10); assert.equal(result.context.activeEndOffsetMs, 40);
  assert.equal('record' in result.context.initial, false);
});

console.log(`OBSERVER_PERFORMANCE_PROBE_CHECKS ${checks}/${checks}`);
