import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { createHungerPlaybackTimer, HUNGER_PLAYBACK_SPEEDS, recreateHungerRunSnapshot } from '../src/app/hungergames/_lib/hungerGamePlayback.js';
import { createHungerRun, advanceHungerRun } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { defaultHungerConfig } from '../src/app/hungergames/_lib/hungerGamePresets.js';

const timers = () => {
  let sequence = 0; const tasks = new Map();
  return { tasks, schedule: (fn, delay) => { const id = ++sequence; tasks.set(id, { fn, delay }); return id; },
    clear: (id) => tasks.delete(id),
    take(delay) { const found = [...tasks].find(([, task]) => task.delay === delay); assert.ok(found, `No ${delay}ms task`); return found[1].fn; } };
};
let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
await check('cancel and speed replacement invalidate even an already queued old timer callback', () => {
  const clock = timers(); const timer = createHungerPlaybackTimer({ schedule: clock.schedule, clear: clock.clear });
  const ticks = [];
  const cleanupOld = timer.schedule(() => ticks.push('old'), 1800); const old = clock.take(1800);
  timer.schedule(() => ticks.push('new'), 500); cleanupOld(); old();
  assert.deepEqual(ticks, []); clock.take(500)(); assert.deepEqual(ticks, ['new']);
  timer.schedule(() => ticks.push('stopped'), 4000); const stopped = clock.take(4000); timer.cancel(); stopped();
  assert.deepEqual(ticks, ['new']);
});
await check('a functional update queued by a fired timer also becomes inert after synchronous cancellation', () => {
  const clock = timers(); const timer = createHungerPlaybackTimer({ schedule: clock.schedule, clear: clock.clear });
  let update;
  timer.schedule((isCurrent) => { update = (previous) => isCurrent() ? previous + 1 : previous; }, 1800);
  clock.take(1800)(); timer.cancel(); assert.equal(update(12), 12);
});
await check('recreation retains v1, v2 and v3 original inputs and preserves separately edited next-match config', () => {
  const config = defaultHungerConfig(); const nextConfig = { ...config, seed: 'next-match-edited', maxPhases: 1 };
  for (const version of [1, 2, 3]) {
    let run = createHungerRun(config, version); for (let i = 0; i < 3 && !run.finished; i += 1) run = advanceHungerRun(run);
    const before = JSON.stringify({ config: nextConfig, run }); const snapshot = recreateHungerRunSnapshot(run);
    assert.equal(snapshot.rulesVersion, version); assert.deepEqual(snapshot.input, run.input); assert.equal(snapshot.history.length, 0);
    let replay = snapshot; for (let i = 0; i < run.history.length; i += 1) replay = advanceHungerRun(replay);
    assert.deepEqual(replay, run); assert.equal(JSON.stringify({ config: nextConfig, run }), before);
    const pack = createHungerPack(nextConfig, snapshot);
    assert.equal(pack.config.seed, 'next-match-edited'); assert.equal(pack.run.config.seed, config.seed);
    assert.equal(pack.run.rulesVersion, version); assert.ok(!Object.hasOwn(pack, 'playbackDelay'));
  }
  const legacy = createHungerRun(config, 1); delete legacy.rulesVersion;
  assert.equal(recreateHungerRunSnapshot(legacy).rulesVersion, 1);
  assert.equal(HUNGER_PLAYBACK_SPEEDS.find((speed) => speed.delay === 1800).label, '보통 · 1.8초마다');
});

const pageUrl = new URL('../src/app/hungergames/page.js', import.meta.url).href;
const viewerType = () => null; const rosterType = () => null; const eventsType = () => null;
globalThis.__hgPlaybackTest = { React, viewerType, rosterType, eventsType };
const moduleSource = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === pageUrl) {
      if (specifier === 'react') return moduleSource(`
        export function useState(initial) { return globalThis.__hgPlaybackTest.hooks.useState(initial); }
        export function useRef(initial) { return globalThis.__hgPlaybackTest.hooks.useRef(initial); }
        export function useEffect(effect, deps) { return globalThis.__hgPlaybackTest.hooks.useEffect(effect, deps); }`);
      if (specifier.endsWith('.module.css')) return moduleSource('export default new Proxy({}, {get: (_, key) => String(key)});');
      if (specifier === 'next/link' || specifier.endsWith('/SiteHeader')) return moduleSource('export default function Wrapper() { return null; }');
      if (specifier.endsWith('/HungerRunViewer')) return moduleSource('export default globalThis.__hgPlaybackTest.viewerType;');
      if (specifier.endsWith('/HungerRosterEditor')) return moduleSource('export default globalThis.__hgPlaybackTest.rosterType;');
      if (specifier.endsWith('/HungerEventEditor')) return moduleSource('export default globalThis.__hgPlaybackTest.eventsType;');
      if (specifier.endsWith('/utils/api')) return moduleSource(`
        export function getToken() { return 'fixture-token'; }
        export function apiGet(...args) { return globalThis.__hgPlaybackTest.apiGet(...args); }
        export function apiPut() { throw new Error('Account writes are forbidden in this fixture.'); }`);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== pageUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Page } = await import(pageUrl);
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
};
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const button = (tree, label) => nodes(tree, (node) => node.type === 'button' && textOf(node) === label)[0];
const field = (tree, label) => nodes(tree, (node) => node.type === 'label' && textOf(node).startsWith(label))[0];
const control = (tree, label) => nodes(field(tree, label), (node) => ['input', 'select'].includes(node.type))[0];
const viewer = (tree) => nodes(tree, (node) => node.type === viewerType)[0].props;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
async function mount(stored = null) {
  const clock = timers(); const cells = []; let cursor = 0; let effects = []; let writes = 0; let confirmation = true; let disposed = false;
  const original = { window: globalThis.window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const hooks = {
    useState(initial) {
      const index = cursor++; if (!(index in cells)) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [cells[index].value, (value) => { cells[index].value = typeof value === 'function' ? value(cells[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index]; },
    useEffect(effect, deps) {
      const index = cursor++; const previous = cells[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); cells[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  globalThis.window = { setTimeout: clock.schedule, clearTimeout: clock.clear, confirm: () => confirmation,
    localStorage: { getItem: () => stored, setItem: () => { writes += 1; } } };
  globalThis.setTimeout = clock.schedule; globalThis.clearTimeout = clock.clear;
  globalThis.__hgPlaybackTest.hooks = hooks;
  globalThis.__hgPlaybackTest.apiGet = async () => ({ saves: [] });
  const draw = () => { cursor = 0; effects = []; const tree = Page(); effects.forEach((effect) => effect()); return tree; };
  draw(); await flush(); draw();
  return { clock, draw, get writes() { return writes; }, confirm: (value) => { confirmation = value; },
    cleanup() { if (disposed) return; disposed = true; cells.forEach((cell) => cell?.cleanup?.()); Object.assign(globalThis, original); } };
}
await check('actual page cancellation preserves current run, playback and next config; accepted replay resets only run progress', async () => {
  const app = await mount();
  try {
    button(app.draw(), '경기 시작').props.onClick(); button(app.draw(), '다음 페이즈').props.onClick();
    control(app.draw(), '경기 시드').props.onChange({ target: { value: 'edited-next-seed' } });
    viewer(app.draw()).onFollowActor('demo-robot'); button(app.draw(), '자동 진행').props.onClick();
    const tree = app.draw(); const beforeRun = viewer(tree).run; const beforeTick = app.clock.take(1800);
    app.confirm(false); button(tree, '원래 경기 조건으로 다시 보기').props.onClick();
    assert.equal(viewer(app.draw()).run, beforeRun); assert.ok(button(app.draw(), '자동 진행 중지'));
    assert.equal(app.clock.take(1800), beforeTick); assert.equal(control(app.draw(), '경기 시드').props.value, 'edited-next-seed');
    app.confirm(true); button(app.draw(), '원래 경기 조건으로 다시 보기').props.onClick();
    const after = app.draw(); const next = viewer(after);
    assert.equal(next.run.history.length, 0); assert.deepEqual(next.run.input, beforeRun.input);
    assert.equal(next.run.rulesVersion, beforeRun.rulesVersion); assert.equal(next.viewIndex, -1);
    assert.equal(next.followActorId, 'demo-robot'); assert.ok(button(after, '자동 진행'));
    assert.equal(control(after, '경기 시드').props.value, 'edited-next-seed');
    beforeTick(); assert.equal(viewer(app.draw()).run.history.length, 0);
  } finally { app.cleanup(); }
});
await check('actual speed changes cancel old ticks, keep autoplay active and leave follow selection independent', async () => {
  const app = await mount();
  try {
    button(app.draw(), '경기 시작').props.onClick(); button(app.draw(), '자동 진행').props.onClick(); app.draw();
    const old = app.clock.take(1800); control(app.draw(), '자동 진행 간격').props.onChange({ target: { value: '500' } });
    const tree = app.draw(); old(); assert.equal(viewer(app.draw()).run.history.length, 0);
    assert.ok(button(tree, '자동 진행 중지')); assert.equal(control(tree, '자동 진행 간격').props.value, 500);
    const next = app.clock.take(500); viewer(app.draw()).onFollowActor('demo-robot');
    assert.equal(app.clock.take(500), next); next(); assert.equal(viewer(app.draw()).run.history.length, 1);
    const pending = app.clock.take(500); viewer(app.draw()).onViewIndex(0); app.draw(); pending();
    assert.equal(viewer(app.draw()).run.history.length, 1); assert.equal(viewer(app.draw()).viewIndex, 0);
    assert.ok(button(app.draw(), '자동 진행'));
  } finally { app.cleanup(); }
});
await check('actual account-read waiting, import intent and unmount stop pending autoplay without account writes', async () => {
  const app = await mount();
  try {
    button(app.draw(), '경기 시작').props.onClick(); button(app.draw(), '자동 진행').props.onClick(); app.draw();
    const stale = app.clock.take(1800); let resolveRead;
    globalThis.__hgPlaybackTest.apiGet = () => new Promise((resolve) => { resolveRead = resolve; });
    const waiting = button(app.draw(), '계정 저장 불러오기').props.onClick(); const busyTree = app.draw();
    assert.equal(button(busyTree, '자동 진행').props.disabled, true); assert.equal(button(busyTree, '원래 경기 조건으로 다시 보기').props.disabled, true);
    stale(); assert.equal(viewer(app.draw()).run.history.length, 0);
    resolveRead({ saves: [] }); await waiting; await flush(); app.draw();
    button(app.draw(), '자동 진행').props.onClick(); app.draw(); const imported = app.clock.take(1800);
    button(app.draw(), 'JSON 가져오기').props.onClick(); app.draw(); imported();
    assert.equal(viewer(app.draw()).run.history.length, 0);
    button(app.draw(), '자동 진행').props.onClick(); app.draw(); const unmounted = app.clock.take(1800);
    app.cleanup(); unmounted(); assert.equal(app.clock.tasks.size, 0);
  } finally { app.cleanup(); }
});
await check('corrupt browser bytes stay protected and terminal runs cannot manually or automatically advance', async () => {
  const corrupt = await mount('{');
  try {
    const tree = corrupt.draw(); assert.ok(textOf(tree).includes('기존 저장 보존 중'));
    assert.equal(button(tree, '원래 경기 조건으로 다시 보기').props.disabled, true);
    assert.equal(corrupt.clock.tasks.size, 0); assert.equal(corrupt.writes, 0);
  } finally { corrupt.cleanup(); }
  const app = await mount();
  try {
    control(app.draw(), '최대 페이즈 수').props.onChange({ target: { value: '1' } });
    button(app.draw(), '경기 시작').props.onClick(); button(app.draw(), '다음 페이즈').props.onClick();
    const tree = app.draw(); const before = viewer(tree).run;
    assert.equal(before.finished, true); assert.equal(button(tree, '다음 페이즈').props.disabled, true);
    assert.equal(button(tree, '자동 진행').props.disabled, true);
    button(tree, '자동 진행').props.onClick(); button(tree, '다음 페이즈').props.onClick();
    assert.equal(viewer(app.draw()).run, before);
  } finally { app.cleanup(); }
});
delete globalThis.__hgPlaybackTest;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual playback timer and v1/v2/v3 run recreation; actual page handlers with memory React hooks and fake timers/storage/account reads. Viewer/editors/header are boundary stubs. No browser, real account writes, build or full HG regression.' }));
