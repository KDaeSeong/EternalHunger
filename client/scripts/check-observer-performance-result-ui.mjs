import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';

// Real component handlers with synthetic probe, DOM host and download seams.
// No browser, measurements, replay execution, storage or server calls occur.
const base = new URL('../src/app/simulation/_components/', import.meta.url);
const panelUrl = new URL('SimulationObserverPerformancePanel.js', base).href;
const modalUrl = new URL('SimulationResultModal.js', base).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const stubUrl = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooksUrl = stubUrl(`export * from '${harnessUrl}'; import { useMemo } from '${harnessUrl}';
  export const useCallback = (callback, dependencies) => useMemo(() => callback, dependencies);`);
const seam = { probes: [], downloads: [], failDownload: false, serializations: new Map(),
  stringify(value, ...args) {
    this.serializations.set(value, (this.serializations.get(value) || 0) + 1);
    return JSON.stringify(value, ...args);
  },
};
globalThis.observerResultUiTest = seam;
const probeUrl = stubUrl('export const createObserverPerformanceProbe = () => globalThis.observerResultUiTest.makeProbe();');
const portalUrl = stubUrl('export const createPortal = (children, host) => ({type:"test-portal", props:{children, host}});');
const downloadUrl = stubUrl(`export function downloadTextFile(filename, text, mimeType) {
  const seam = globalThis.observerResultUiTest;
  if (seam.failDownload) return false;
  seam.downloads.push({filename, text, mimeType}); return true;
}`);
const memoryUrl = stubUrl('export const observerMemoryRegistry = { snapshot: () => null };');
const authUrl = stubUrl('export const useAuthUser = () => null;');
const leafUrl = stubUrl('export default function Child() { return null; }');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ([panelUrl, modalUrl].includes(context.parentURL)) {
      if (specifier === 'react') return { url: hooksUrl, shortCircuit: true };
      if (specifier === 'react-dom') return { url: portalUrl, shortCircuit: true };
      if (specifier.endsWith('/observerPerformanceRuntime')) return { url: probeUrl, shortCircuit: true };
      if (specifier.endsWith('/logExportRuntime')) return { url: downloadUrl, shortCircuit: true };
      if (specifier.endsWith('/observerMemoryLifetime')) return { url: memoryUrl, shortCircuit: true };
      if (specifier.endsWith('/client-auth')) return { url: authUrl, shortCircuit: true };
      if (specifier === 'next/image' || specifier.endsWith('.css') || specifier.endsWith('/GameActionIcon')) {
        return { url: leafUrl, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (![panelUrl, modalUrl].includes(url)) return nextLoad(url, context);
    let source = readFileSync(new URL(url), 'utf8');
    if (url === panelUrl) source = source.replaceAll('JSON.stringify(', 'globalThis.observerResultUiTest.stringify(');
    const transpiled = ts.transpileModule(source, { compilerOptions: {
      jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const react = `const React = { Fragment: Symbol.for('test.fragment'), createElement(type, props, ...children) {
      return {type, props:{...(props || {}), children:children.length === 1 ? children[0] : children}};
    }};\n`;
    return { format: 'module', shortCircuit: true, source: react + transpiled };
  },
});
const [{ default: Panel }, { default: Modal }] = await Promise.all([import(panelUrl), import(modalUrl)]);
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { OBSERVER_REPORT_MAX_BYTES, buildObserverPerformanceReportDownload } = await import('../src/app/simulation/_components/observerPerformanceExport.js');

function fakeProbe() {
  const probe = { value: null, running: false, finished: false, stops: [], updates: [],
    start({ label, context }) {
      this.running = true; this.finished = false;
      this.value = { schema: 'eh-observer-performance.v3', engineVersion: SIMULATION_ENGINE_VERSION,
        label, startedAtMs: 10, endedAtMs: null, elapsedMs: 0,
        boundary: { status: 'recording', stopReason: null },
        context: { initial: { ...context }, final: { ...context }, identityChanges: 0 },
        privateRawEvidence: { marker: 'preserve exact raw payload' } };
    },
    snapshot() { return this.finished ? null : this.value; },
    getLastResult() { return this.value; },
    isRunning() { return this.running; },
    updateContext(context) { this.updates.push(context); if (this.value) this.value.context.final = { ...context }; },
    recordInput() {},
    stop() { this.running = false; },
    stopAfterFrame(options = {}) {
      this.running = false;
      this.value = { ...this.value, endedAtMs: 20, elapsedMs: 10,
        boundary: { status: 'draining', stopReason: options.reason || 'manual' } };
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      this.stops.push({ options, resolve });
      return promise;
    },
    finish(overrides = {}) {
      this.value = { ...this.value, boundary: { ...this.value.boundary, status: 'settled' }, ...overrides };
      this.finished = true;
      this.stops.at(-1).resolve(this.value);
      return this.value;
    },
  };
  seam.probes.push(probe);
  return probe;
}
seam.makeProbe = fakeProbe;
const byId = (tree, id) => elements(tree, node => node.props?.['data-testid'] === id)[0];
const resultButton = tree => byId(tree, 'observer-performance-result-download');
const ready = node => Boolean(node && !node.props.disabled);
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const descriptors = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let checks = 0;
let failures = 0;
const check = async (name, run) => {
  checks++;
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message.slice(0, 600)}`); }
};

function panelHarness({ search = '?perfProbe=1', ...overrides } = {}) {
  const intervals = new Map();
  let nextInterval = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { search }, setInterval(callback) { const id = ++nextInterval; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  const props = { speed: 8, seed: 'synthetic-result-source', replayMode: true, replayId: 'source-A',
    day: 0, matchSec: 0, autoPlay: false, isGameOver: false, replayStatus: null,
    observerReportTarget: { isConnected: true }, ...overrides };
  const h = createHandlerHarness(Panel, props);
  h.render(); h.flush();
  const probe = seam.probes.at(-1);
  return { h, props, probe,
    update(patch) { Object.assign(props, patch); h.render(); return h.flush(); },
    tick() { for (const callback of intervals.values()) callback(); return h.flush(); },
    start() { byId(h.tree, 'observer-performance-start').props.onClick(); return h.flush(); },
    async complete(overrides = {}) {
      this.update({ day: 7, matchSec: 1200, isGameOver: true,
        replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
      const report = probe.finish(overrides); await settle(); h.flush(); return report;
    },
  };
}

try {
  await check('the real result modal exposes its report host through the supplied ref callback', () => {
    const targets = [];
    const tree = Modal({ open: true, resultSummary: { matchMode: 'solo' }, replayStatus: { text: '비교 완료' },
      onObserverReportTargetChange: target => targets.push(target) });
    const slot = byId(tree, 'observer-performance-result-slot');
    assert.ok(slot, 'The actual result modal must contain the portal host.');
    assert.equal(typeof slot.props.ref, 'function');
    const host = { isConnected: true };
    slot.props.ref(host); slot.props.ref(null);
    assert.deepEqual(targets, [host, null]);
    assert.equal(Modal({ open: false, onObserverReportTargetChange() {} }), null);
  });

  await check('query-gated diagnostics cannot expose a result download when disabled', () => {
    const before = seam.probes.length;
    const { h } = panelHarness({ search: '' });
    assert.equal(h.tree, null); assert.equal(seam.probes.length, before); h.unmount();
  });

  await check('manual finalized results remain exportable only from the original panel', async () => {
    const state = panelHarness(); state.start();
    const pending = byId(state.h.tree, 'observer-performance-stop').props.onClick();
    state.h.flush(); assert.equal(ready(resultButton(state.h.tree)), false);
    const report = state.probe.finish(); await pending; await settle(); state.h.flush();
    assert.equal(ready(resultButton(state.h.tree)), false);
    const top = byId(state.h.tree, 'observer-performance-download'); assert.equal(ready(top), true);
    const before = seam.downloads.length; top.props.onClick(); state.h.flush();
    assert.equal(seam.downloads.length, before + 1);
    assert.deepEqual(JSON.parse(seam.downloads.at(-1).text), report); state.h.unmount();
  });

  await check('the result portal waits for comparison and the final barrier, then exports unchanged raw v3', async () => {
    const state = panelHarness(); state.start();
    state.update({ day: 7, matchSec: 1200, isGameOver: true });
    assert.equal(state.probe.stops.length, 0); assert.equal(ready(resultButton(state.h.tree)), false);
    state.update({ replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
    assert.equal(state.probe.stops.length, 1);
    assert.equal(state.probe.stops[0].options.reason, 'replay-complete');
    state.tick(); assert.equal(ready(resultButton(state.h.tree)), false, 'Draining is never downloadable.');
    assert.equal(elements(state.h.tree, node => node.props?.role === 'status'
      && textOf(node) === '성능 측정 결과를 정리하는 중입니다.').length, 1);
    const report = state.probe.finish(); await settle(); state.h.flush();
    const button = resultButton(state.h.tree); assert.equal(ready(button), true);
    assert.equal(textOf(button), '이번 경기 성능 JSON 저장');
    const portal = elements(state.h.tree, node => node.type === 'test-portal')[0];
    assert.equal(portal.props.host, state.props.observerReportTarget);
    const before = structuredClone(report); button.props.onClick(); state.h.flush();
    assert.deepEqual(JSON.parse(seam.downloads.at(-1).text), before);
    assert.deepEqual(report, before);
    assert.equal(seam.downloads.at(-1).mimeType, 'application/json;charset=utf-8');
    state.update({ day: 0, matchSec: 0, isGameOver: false, replayStatus: null });
    assert.equal(ready(resultButton(state.h.tree)), false, 'Even the same seed/replay cannot inherit a previous result.');
    state.update({ day: 7, matchSec: 1200, isGameOver: true,
      replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
    assert.equal(ready(resultButton(state.h.tree)), false, 'An unmeasured repeated replay must not reuse the previous measurement.');
    state.h.unmount();
  });

  await check('comparison failure and incomplete automatic results retain exact raw export evidence', async () => {
    for (const status of ['settled', 'incomplete']) {
      const state = panelHarness(); state.start();
      state.update({ day: 7, matchSec: 1200, isGameOver: true,
        replayStatus: { comparison: { matched: false, actualEvents: 100 } } });
      const report = state.probe.finish({ boundary: { status, stopReason: 'replay-complete' } });
      await settle(); state.h.flush();
      assert.equal(ready(resultButton(state.h.tree)), true);
      resultButton(state.h.tree).props.onClick(); state.h.flush();
      assert.deepEqual(JSON.parse(seam.downloads.at(-1).text), report); state.h.unmount();
    }
  });

  await check('result downloads enforce the raw UTF-8 limit and expose download errors', async () => {
    const state = panelHarness(); state.start();
    const report = await state.complete();
    const button = resultButton(state.h.tree);
    seam.failDownload = true; button.props.onClick(); state.h.flush(); seam.failDownload = false;
    const alerts = elements(state.h.tree, node => node.props?.role === 'alert');
    assert.equal(alerts.length, 1, 'Portal download errors must appear once rather than competing with the panel.');
    assert.ok(alerts.some(node => /저장.*못|다운로드/.test(textOf(node))), 'The download failure must be visible.');
    state.h.unmount();
    const base = structuredClone(report); base.label = '';
    const baseFile = buildObserverPerformanceReportDownload(base);
    const spareBytes = OBSERVER_REPORT_MAX_BYTES - new TextEncoder().encode(baseFile.text).byteLength;
    const label = '가'.repeat(Math.floor(spareBytes / 3)) + 'a'.repeat(spareBytes % 3);
    const exact = panelHarness(); exact.start();
    const exactReport = await exact.complete({ label });
    const atLimit = seam.downloads.length; resultButton(exact.h.tree).props.onClick(); exact.h.flush();
    assert.equal(seam.downloads.length, atLimit + 1);
    assert.equal(new TextEncoder().encode(seam.downloads.at(-1).text).byteLength, OBSERVER_REPORT_MAX_BYTES);
    assert.equal(JSON.stringify(JSON.parse(seam.downloads.at(-1).text)) === JSON.stringify(exactReport), true);
    exact.h.unmount();
    const over = panelHarness(); over.start(); await over.complete({ label: label + 'a' });
    const before = seam.downloads.length; resultButton(over.h.tree).props.onClick(); over.h.flush();
    assert.equal(seam.downloads.length, before, 'Oversize reports must not download a truncated payload.');
    assert.ok(elements(over.h.tree, node => node.props?.role === 'alert').some(node => /2 MiB|한도/.test(textOf(node))));
    over.h.unmount();
  });

  await check('unchanged report identity avoids repeated rendering serialization', async () => {
    const state = panelHarness(); state.start(); const report = await state.complete();
    const before = seam.serializations.get(report) || 0;
    assert.ok(before > 0, 'Observe the actual component display serialization before checking reuse.');
    state.tick(); state.h.render(); state.h.flush();
    assert.equal(seam.serializations.get(report) || 0, before); state.h.unmount();
  });

  await check('a late earlier-attempt completion cannot become the next result in the same panel', async () => {
    const state = panelHarness(); state.start();
    state.update({ day: 7, matchSec: 1200, isGameOver: true,
      replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
    const earlier = structuredClone(state.probe.value);
    earlier.boundary.status = 'settled';
    state.update({ day: 0, matchSec: 0, isGameOver: false, replayStatus: null });
    state.update({ day: 7, matchSec: 1200, isGameOver: true,
      replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
    assert.equal(state.probe.stops.length, 1, 'One pending barrier must not create competing completions.');
    state.probe.finish(earlier); await settle(); state.h.flush();
    assert.equal(ready(resultButton(state.h.tree)), false, 'Earlier-attempt raw data must not label the next result.');
    const top = byId(state.h.tree, 'observer-performance-download');
    assert.equal(ready(top), true, 'The earlier raw evidence remains exportable from the diagnostic panel.');
    top.props.onClick(); state.h.flush();
    assert.deepEqual(JSON.parse(seam.downloads.at(-1).text), earlier);
    state.update({ day: 0, matchSec: 0, isGameOver: false, replayStatus: null });
    state.start(); const current = await state.complete();
    assert.equal(ready(resultButton(state.h.tree)), true, 'A fresh measurement in the new attempt can complete normally.');
    resultButton(state.h.tree).props.onClick(); state.h.flush();
    assert.deepEqual(JSON.parse(seam.downloads.at(-1).text), current); state.h.unmount();
  });

  await check('a late completion after unmount cannot write into the next mounted panel', async () => {
    const old = panelHarness(); old.start();
    old.update({ day: 7, matchSec: 1200, isGameOver: true,
      replayStatus: { comparison: { matched: true, actualEvents: 100 } } });
    old.h.unmount();
    const next = panelHarness({ seed: 'next-match', replayId: 'source-B' }); next.start();
    old.probe.finish(); await settle(); next.h.flush();
    assert.equal(old.h.writesAfterUnmount, 0);
    assert.equal(ready(resultButton(next.h.tree)), false);
    assert.equal(next.probe.value.context.initial.seed, 'next-match'); next.h.unmount();
  });
} finally {
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  delete globalThis.observerResultUiTest;
}
console.log(JSON.stringify({ pass: failures === 0, checks, failures,
  scope: 'actual JSX components and handlers with fake probe/portal/download seams; no browser, performance-nine or saved-match proof' }));
console.log(`OBSERVER_PERFORMANCE_RESULT_UI ${checks - failures}/${checks}`);
if (failures) process.exitCode = 1;
