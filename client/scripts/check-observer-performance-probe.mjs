import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { createObserverPerformanceProbe } = await import('../src/app/simulation/_lib/observerPerformanceRuntime.js');
const panelSource = readFileSync(new URL('../src/app/simulation/_components/SimulationObserverPerformancePanel.js', import.meta.url), 'utf8');
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

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
  const first = callbacks.values().next().value; now = 116; first(116); const second = callbacks.values().next().value; now = 132; second(132);
  performanceRef.memory.usedJSHeapSize = 18;
  const result = probe.stop();
  assert.equal(result.label, 'x8');
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

check('panel is query-gated and exposes accessible controls and JSON output', () => {
  assert.match(panelSource, /get\('perfProbe'\) === '1'/);
  assert.match(panelSource, /data-testid="observer-performance-start"/);
  assert.match(panelSource, /data-testid="observer-performance-stop"/);
  assert.match(panelSource, /data-testid="observer-performance-result"/);
  assert.match(panelSource, /if \(!enabled\) return null/);
  assert.match(panelSource, /document\.addEventListener\('click', onCaptureClick, true\)/);
  assert.match(panelSource, /event\.timeStamp/);
  assert.match(panelSource, /inputResponse: inputResponseSnapshot/);
  assert.match(panelSource, /removeEventListener\('click', onCaptureClick, true\)/);
  assert.match(panelSource, /inputResponseRef\.current = \{ samples: \[\], pending: \[\] \}/);
});

console.log(`OBSERVER_PERFORMANCE_PROBE_CHECKS ${checks}/${checks}`);
