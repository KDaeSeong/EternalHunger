import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { createObserverPerformanceProbe } = await import('../src/app/simulation/_lib/observerPerformanceRuntime.js');
const panelSource = readFileSync(new URL('../src/app/simulation/_components/SimulationObserverPerformancePanel.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

function harness({ observeThrows = false } = {}) {
  let now = 0, serial = 0;
  const callbacks = new Map(), timers = new Map(), observers = [];
  const performanceRef = { now: () => now, timeOrigin: 1000000,
    memory: { usedJSHeapSize: 100, totalJSHeapSize: 200, jsHeapSizeLimit: 300 } };
  const windowRef = { requestAnimationFrame: (callback) => { callbacks.set(++serial, callback); return serial; },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    setTimeout: (callback) => { timers.set(++serial, callback); return serial; }, clearTimeout: (id) => timers.delete(id) };
  class PerformanceObserverRef {
    constructor(callback) { this.callback = callback; this.queued = []; this.disconnected = false; observers.push(this); }
    observe() { if (observeThrows) throw new Error('Long tasks not supported.'); }
    takeRecords() { return this.queued.splice(0); }
    disconnect() { this.disconnected = true; }
  }
  const probe = createObserverPerformanceProbe({ windowRef, performanceRef, PerformanceObserverRef,
    documentRef: { visibilityState: 'visible', getElementsByTagName: () => [] } });
  return { probe, callbacks, timers, observers, performanceRef, setNow: (value) => { now = value; },
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
    PerformanceObserver: class { constructor(callback) { this.callback = callback; observer = this; } observe() {} takeRecords() { return []; } disconnect() {} },
  };
  class PerformanceObserverRef extends windowRef.PerformanceObserver {}
  const probe = createObserverPerformanceProbe({ windowRef, documentRef: { getElementsByTagName: () => [1, 2, 3] }, performanceRef, PerformanceObserverRef });
  probe.start({ label: 'x8', durationMs: 1000 });
  observer.callback({ getEntries: () => [{ startTime: 90, duration: 80 }, { startTime: 110, duration: 55 }] });
  const first = callbacks.values().next().value; callbacks.clear(); now = 116; first(116);
  const second = callbacks.values().next().value; callbacks.clear(); now = 132; second(132);
  performanceRef.memory.usedJSHeapSize = 18;
  const result = probe.stop();
  assert.equal(result.label, 'x8');
  assert.equal(result.schema, 'eh-observer-performance.v2');
  assert.equal(result.raf.samples, 1);
  assert.equal(result.raf.fps, 31.25);
  assert.equal(result.heap.usedBytes, 18);
  assert.equal(result.heap.baselineUsedBytes, 10);
  assert.equal(result.heap.deltaUsedBytes, 8);
  assert.deepEqual(result.longTasks, { supported: true, count: 1, totalMs: 55, maxMs: 55 });
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
    yield { startTime: -1, duration: 9999 };
    yield { startTime: 1, duration: -1 };
    yield { startTime: 1, duration: NaN };
    for (let i = 0; i < 200000; i++) yield { startTime: i * 60, duration: i === 0 ? 750 : 50 };
  } });
  h.observers[0].queued.push({ startTime: 18000000, duration: 80 });
  const result = h.probe.stop();
  assert.deepEqual(result.longTasks, { supported: true, count: 200001, totalMs: 10000780, maxMs: 750 });
  assert.equal(h.observers[0].disconnected, true);
});

check('a large click burst uses one pending RAF and retains all input samples, first peak and last delay', () => {
  const h = harness(); h.probe.start(); h.setNow(100);
  h.probe.recordInput(0);
  for (let i = 1; i < 200000; i++) h.probe.recordInput(90);
  assert.equal(h.callbacks.size, 2, 'One sampling RAF plus one input RAF, not one callback per click.');
  h.frame(110);
  const result = h.probe.stop();
  assert.deepEqual(result.inputResponse, { supported: true, samples: 200000, lastMs: 20, maxMs: 110 });
  assert.equal(h.callbacks.size, 0);
});

check('epoch and invalid event timestamps normalize to the same performance clock', () => {
  const h = harness(); h.probe.start(); h.setNow(100);
  h.probe.recordInput(h.performanceRef.timeOrigin + 95);
  h.probe.recordInput(NaN);
  h.frame(110);
  assert.deepEqual(h.probe.stop().inputResponse, { supported: true, samples: 2, lastMs: 10, maxMs: 15 });
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
  assert.equal(h.probe.isRunning(), false); assert.equal(h.callbacks.size, 0); assert.equal(h.timers.size, 0);
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

console.log(`OBSERVER_PERFORMANCE_PROBE_CHECKS ${checks}/${checks}`);
