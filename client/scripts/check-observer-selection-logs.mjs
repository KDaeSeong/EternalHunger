import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createHandlerHarness, useEffect, useRef } from './lib/hook-handler-harness.mjs';

const hooks = ['useSimulationMarketState', 'useSimulationLogs'].map(name =>
  new URL(`../src/app/simulation/_lib/${name}.js`, import.meta.url).href);
const pickerUrl = new URL('../src/app/simulation/_components/SimulationMarketCharacterPicker.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (hooks.includes(url)) return { format: 'module', shortCircuit: true,
    source: readFileSync(new URL(url), 'utf8').replaceAll("from 'react'", `from '${harnessUrl}'`) };
  if (url !== pickerUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { useSimulationMarketState } = await import(hooks[0]);
const { useSimulationLogs } = await import(hooks[1]);
const { getPreferredHyperloopCharId } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { default: Picker } = await import(pickerUrl);
const baseline = process.argv.includes('--baseline');
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
const actor = (id) => Object.freeze({ _id: id, name: id, teamId: 'team:1', hp: 100, maxHp: 100,
  zoneId: 'a', stats: Object.freeze({ attackPower: 20, defense: 10 }), inventory: Object.freeze([]) });

// Negative control for the removed effect, not a past result file. It reproduces
// the old passive selection notification without filtering or sorting any logs.
function PassiveSelectionEffect(id, survivors, addLog) {
  const previous = useRef({ inited: false, last: '' });
  useEffect(() => {
    if (!id) return;
    const last = previous.current;
    if (!last.inited) { last.inited = true; last.last = id; return; }
    if (last.last === id) return;
    last.last = id;
    addLog(`🎯 하이퍼루프 대상 선택: ${survivors.find(row => row._id === id)?.name || '선택 캐릭터'}`, 'system');
  }, [id, survivors, addLog]);
}
function Observer(props) {
  const market = useSimulationMarketState(props);
  const logs = useSimulationLogs(props);
  const hyperloopCharId = getPreferredHyperloopCharId(market.selectedCharId, props.survivors);
  if (baseline) PassiveSelectionEffect(hyperloopCharId, props.survivors, logs.addLog);
  return { market, logs, hyperloopCharId };
}
const previousWindow = globalThis.window;
const timers = new Map();
let timerId = 0;
const observerWindow = {
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {}, removeEventListener() {},
  setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
};
function fixture(survivors = [actor('a'), actor('b'), actor('c')], { windowRef = observerWindow, drainTimers = true } = {}) {
  const mutations = [];
  const props = { survivors, day: 1, phase: 'night', matchSec: 10, isGameOver: false, runInputRef: { current: null },
    runLockedRef: { current: true }, runEvents: [], fireAndReport: () => { throw new Error('No account action'); },
    setSurvivors: () => mutations.push('survivors'), setDead: () => mutations.push('dead') };
  const h = createHandlerHarness(Observer, props);
  const rng = createSeedRng('observer-selection-independent');
  function run(callback) {
    const oldWindow = globalThis.window;
    globalThis.window = windowRef;
    try { return callback(); } finally { globalThis.window = oldWindow; }
  }
  function render() {
    return run(() => {
      const before = rng.getState();
      const value = withSimulationRandom(rng, () => h.flush());
      if (drainTimers) for (const [id, callback] of timers) { timers.delete(id); callback(); }
      assert.deepEqual(rng.getState(), before, 'View selection must not draw match randomness.');
      assert.deepEqual(mutations, [], 'A locked observer must not rewrite actors.');
      return value;
    });
  }
  render();
  return { h, props, render, run, get value() { return h.tree; }, async dispose() {
    await Promise.resolve();
    const oldWindow = globalThis.window; globalThis.window = windowRef;
    try { h.unmount(); } finally { globalThis.window = oldWindow; }
  } };
}
function manualScheduler() {
  const frames = new Map(), timers = new Map();
  let frameId = 0, timerId = 0;
  const windowRef = {
    ...observerWindow,
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { windowRef, frames, timers };
}
try {
  await check('the real log hook publishes a detached event snapshot to both read-only views', async () => {
    const f = fixture();
    try {
      const payload = { who: 'a', participants: ['a', 'b'], detail: { hp: 70 } };
      const at = { day: 1, phase: 'night', sec: 10 };
      f.value.logs.emitRunEvent('battle', payload, at);
      payload.participants[0] = 'other'; payload.detail.hp = 0; at.sec = 900;
      await Promise.resolve(); f.render();
      const published = f.value.logs.runEvents[0];
      assert.equal(f.value.logs.runEvents.length, 1);
      assert.equal(published, f.value.logs.fullRunEventsRef.current[0]);
      assert.deepEqual(published.participants, ['a', 'b']);
      assert.equal(published.detail.hp, 70); assert.equal(published.at.sec, 10);
      const previousWindow = f.value.logs.runEvents;
      f.h.dirty = true; f.props.matchSec = 11; f.render();
      assert.equal(f.value.logs.runEvents, previousWindow, 'A frame-only update reuses the owned event window.');
    } finally { await f.dispose(); }
  });
  await check('worker-task log and event bursts publish together on one animation frame', async () => {
    const scheduler = manualScheduler();
    const { frames } = scheduler;
    const f = fixture(undefined, { windowRef: scheduler.windowRef, drainTimers: false });
    const initialLogs = f.value.logs.logs;
    const initialEvents = f.value.logs.runEvents;
    try {
      for (let index = 0; index < 3; index++) {
        f.run(() => {
          f.value.logs.addLog(`burst-${index}`);
          f.value.logs.emitRunEvent('move', { who: 'a', ordinal: index }, { day: 1, phase: 'night', sec: index });
        });
        await Promise.resolve(); // Separate worker-message tasks, each followed by its microtask checkpoint.
        f.render();
        assert.equal(f.value.logs.logs, initialLogs, 'Visible logs wait for the animation frame.');
        assert.equal(f.value.logs.runEvents, initialEvents, 'Visible events wait for the animation frame.');
      }
      assert.deepEqual(f.value.logs.fullLogsRef.current, ['burst-0', 'burst-1', 'burst-2']);
      assert.deepEqual(f.value.logs.fullRunEventsRef.current.map(event => event.ordinal), [0, 1, 2]);
      assert.equal(frames.size, 1, 'A burst has one pending frame publisher.');
      const [firstFrameId, firstFrame] = frames.entries().next().value;
      frames.delete(firstFrameId); f.run(firstFrame); f.render();
      assert.deepEqual(f.value.logs.logs.map(({ text }) => text), ['burst-0', 'burst-1', 'burst-2']);
      assert.deepEqual(f.value.logs.runEvents.map(({ ordinal }) => ordinal), [0, 1, 2]);

      // Phase-log reset clears only queued display logs; event publication remains queued.
      f.run(() => {
        f.value.logs.addLog('reset-me');
        f.value.logs.emitRunEvent('move', { who: 'a', ordinal: 3 });
      });
      f.run(() => f.value.logs.resetPhaseLogs()); f.render();
      assert.deepEqual(f.value.logs.logs, []);
      const [id, publish] = frames.entries().next().value;
      frames.delete(id); f.run(publish); f.render();
      assert.deepEqual(f.value.logs.logs, []);
      assert.deepEqual(f.value.logs.runEvents.map(event => event.ordinal), [0, 1, 2, 3]);

      // Replacing a replay while an old event is pending must discard that event.
      f.run(() => f.value.logs.emitRunEvent('move', { who: 'a', ordinal: 'stale' }));
      await Promise.resolve();
      const replayEvents = Array.from({ length: 5002 }, (_, index) => ({
        kind: 'move', who: 'a', ordinal: index, at: { sec: index },
      }));
      f.run(() => f.value.logs.setRunEvents(replayEvents)); f.render();
      assert.equal(f.value.logs.runEvents.length, 5000);
      assert.equal(f.value.logs.runEvents[0].ordinal, 2);
      assert.equal(f.value.logs.runEvents.at(-1).ordinal, 5001);
      for (const [pendingId, callback] of frames) { frames.delete(pendingId); callback(); }
      f.render();
      assert.equal(f.value.logs.runEvents.length, 5000);
      assert.notEqual(f.value.logs.runEvents.at(-1).ordinal, 'stale');
      assert.ok(f.value.logs.fullRunEventsRef.current.every(event => Number.isInteger(event.ordinal)));
    } finally { frames.clear(); await f.dispose(); }
  });
  await check('the 100ms fallback publishes queued logs and events and cancels the frame', () => {
    const scheduler = manualScheduler();
    const f = fixture(undefined, { windowRef: scheduler.windowRef, drainTimers: false });
    try {
      f.run(() => {
        f.value.logs.addLog('fallback-1');
        f.value.logs.emitRunEvent('move', { who: 'a', ordinal: 1 });
        f.value.logs.addLog('fallback-2');
        f.value.logs.emitRunEvent('move', { who: 'a', ordinal: 2 });
      });
      assert.equal(scheduler.frames.size, 1);
      const fallbackEntries = [...scheduler.timers].filter(([, timer]) => timer.delay === 100);
      assert.equal(fallbackEntries.length, 1);
      const [timerId, timer] = fallbackEntries[0];
      assert.equal(timer.delay, 100);
      scheduler.timers.delete(timerId);
      f.run(timer.callback); f.render();
      assert.deepEqual(f.value.logs.logs.map(({ text }) => text), ['fallback-1', 'fallback-2']);
      assert.deepEqual(f.value.logs.runEvents.map(({ ordinal }) => ordinal), [1, 2]);
      assert.equal(scheduler.frames.size, 0, 'Fallback publication cancels the scheduled animation frame.');
      assert.equal([...scheduler.timers.values()].filter(timer => timer.delay === 100).length, 0);
    } finally { scheduler.frames.clear(); scheduler.timers.clear(); f.run(() => f.h.unmount()); }
  });
  await check('unmount cancels pending publication and late callbacks cannot write state', () => {
    const scheduler = manualScheduler();
    const f = fixture(undefined, { windowRef: scheduler.windowRef, drainTimers: false });
    f.run(() => {
      f.value.logs.addLog('pending');
      f.value.logs.emitRunEvent('move', { who: 'a', ordinal: 1 });
    });
    const lateFrames = [...scheduler.frames.values()];
    const lateTimers = [...scheduler.timers.values()].filter(timer => timer.delay === 100).map(({ callback }) => callback);
    assert.equal(lateFrames.length, 1);
    assert.equal(lateTimers.length, 1);
    f.run(() => f.h.unmount());
    assert.equal(scheduler.frames.size, 0);
    assert.equal(scheduler.timers.size, 0);
    f.run(() => { lateFrames.forEach(callback => callback()); lateTimers.forEach(callback => callback()); });
    assert.equal(f.h.writesAfterUnmount, 0);
  });
  await check('game completion flushes the final queued logs and events before the next frame', () => {
    const scheduler = manualScheduler();
    const f = fixture(undefined, { windowRef: scheduler.windowRef, drainTimers: false });
    try {
      f.run(() => {
        f.value.logs.addLog('last log');
        f.value.logs.emitRunEvent('finish', { who: 'a', ordinal: 1 });
      });
      f.render();
      assert.deepEqual(f.value.logs.logs, []);
      assert.deepEqual(f.value.logs.runEvents, []);
      f.props.isGameOver = true;
      f.h.dirty = true; f.render();
      assert.deepEqual(f.value.logs.logs.map(({ text }) => text), ['last log']);
      assert.deepEqual(f.value.logs.runEvents.map(({ ordinal }) => ordinal), [1]);
      assert.equal(scheduler.frames.size, 0);
      assert.equal([...scheduler.timers.values()].filter(timer => timer.delay === 100).length, 0);
    } finally { scheduler.frames.clear(); scheduler.timers.clear(); f.run(() => f.h.unmount()); }
  });
  await check('replay event replacement detaches its input and drops a queued previous-match event', async () => {
    const f = fixture();
    try {
      f.value.logs.emitRunEvent('move', { who: 'old', detail: { target: 'old-zone' } });
      const replayEvents = [{ kind: 'move', who: 'a', at: { sec: 3 }, detail: { target: 'new-zone' } }];
      f.value.logs.setRunEvents(replayEvents);
      replayEvents[0].who = 'mutated'; replayEvents[0].at.sec = 999;
      replayEvents[0].detail.target = 'mutated-zone';
      await Promise.resolve(); f.render();
      assert.equal(f.value.logs.runEvents.length, 1);
      assert.equal(f.value.logs.fullRunEventsRef.current.length, 1);
      const published = f.value.logs.runEvents[0];
      assert.equal(published, f.value.logs.fullRunEventsRef.current[0]);
      assert.equal(published.who, 'a'); assert.equal(published.at.sec, 3);
      assert.equal(published.detail.target, 'new-zone');
      assert.notEqual(published, replayEvents[0]);
      assert.notEqual(f.value.logs.runEvents, f.value.logs.fullRunEventsRef.current);
      f.value.logs.setRunEvents([]); f.render();
      assert.deepEqual(f.value.logs.runEvents, []); assert.deepEqual(f.value.logs.fullRunEventsRef.current, []);
    } finally { await f.dispose(); }
  });
  await check('mount and fallback after death update the selected actor without recording travel', async () => {
    const f = fixture();
    try {
      assert.equal(f.value.hyperloopCharId, 'a');
      f.props.survivors = f.props.survivors.slice(1);
      f.h.dirty = true; f.render();
      assert.equal(f.value.hyperloopCharId, 'b');
      assert.equal(f.value.market.selectedChar.name, 'b');
      assert.deepEqual(f.value.logs.fullLogsRef.current, []);
      assert.deepEqual(f.value.logs.fullRunEventsRef.current, []);
    } finally { await f.dispose(); }
  });
  await check('explicit picker selection, repeated effects and empty rosters remain view-only', async () => {
    const f = fixture();
    const before = JSON.stringify(f.props.survivors);
    try {
      f.value.market.setSelectedCharId('c'); f.render();
      assert.equal(f.value.hyperloopCharId, 'c');
      for (let i = 0; i < 4; i++) { f.h.dirty = true; f.render(); }
      assert.equal(JSON.stringify(f.props.survivors), before);
      f.props.survivors = []; f.h.dirty = true; f.render();
      assert.equal(f.value.hyperloopCharId, '');
      assert.equal(f.value.market.selectedChar, null);
      assert.deepEqual(f.value.logs.fullLogEntriesRef.current, []);
      assert.deepEqual(f.value.logs.fullRunEventsRef.current, []);
    } finally { await f.dispose(); }
  });
  await check('a remount after fallback does not manufacture a gameplay selection event', async () => {
    for (let i = 0; i < 3; i++) {
      const f = fixture([actor('b')]);
      try { assert.equal(f.value.hyperloopCharId, 'b'); assert.deepEqual(f.value.logs.fullLogsRef.current, []); }
      finally { await f.dispose(); }
    }
  });
  await check('the actual picker still presents the explicit choice and its current HP', () => {
    const survivors = [actor('a'), actor('b')];
    const html = renderToStaticMarkup(React.createElement(Picker, { survivors, selectedCharId: 'b',
      selectedChar: survivors[1], setSelectedCharId() {} }));
    assert.match(html, /<option value="b" selected="">b<\/option>/);
    assert.match(html, /HP 100\/100/);
  });
  await check('actual AI hyperloop movement keeps its ordered log, event and three-second reservation', async () => {
    const f = fixture();
    const reservations = [];
    try {
      const me = structuredClone(f.props.survivors[0]);
      const result = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({
        state: { actor: me, phaseSurvivors: [me], craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {},
          kiosks: [], mapObj: { zones: [{ zoneId: 'a' }, { zoneId: 'b' }] }, nextDay: 3, nextPhase: 'morning',
          nextSpawn: {}, forbiddenIds: new Set(['a']), phaseIdxNow: 4,
          ruleset: { ai: { targetTtlMin: 1, targetTtlMax: 1 }, forbidden: { escapeMoveChance: 1 } },
          zoneGraph: { a: ['b'], b: ['a'] }, zones: [{ zoneId: 'a' }, { zoneId: 'b' }] },
        actions: { addLog: f.value.logs.addLog, emitRunEvent: f.value.logs.emitRunEvent,
          isHyperloopTransit: (from, to) => from === 'a' && to === 'b',
          reserveActionSecond: value => reservations.push(value), atNow: () => ({ day: 3, phase: 'morning', sec: 100 }) },
      }));
      assert.equal(result.didMove, true);
      assert.equal(result.usedHyperloopMove, true);
      assert.equal(result.moveEtaSec, 3);
      assert.deepEqual(reservations, [3]);
      assert.ok(f.value.logs.fullLogEntriesRef.current.some(entry => /하이퍼루프 이동\(3초\): a → b/.test(entry.text)));
      const movement = f.value.logs.fullRunEventsRef.current.find(event => event.kind === 'move');
      assert.equal(movement.transport, 'hyperloop'); assert.equal(movement.etaSec, 3);
      const before = structuredClone(f.value.logs.fullLogEntriesRef.current);
      f.props.survivors = [actor('b')]; f.h.dirty = true; f.render();
      assert.deepEqual(f.value.logs.fullLogEntriesRef.current, before, 'Selection must not alter the genuine move journal.');
      await Promise.resolve(); f.render();
      assert.deepEqual(f.value.logs.logs.map(({ text, type }) => ({ text, type })), before);
    } finally { await f.dispose(); }
  });
  await check('different render batching preserves every raw log in creation order', async () => {
    async function exercise(dense) {
      const f = fixture();
      try {
        f.value.logs.addLog('=== 1일차 밤 ===', 'phase');
        f.props.survivors = f.props.survivors.slice(1);
        f.h.dirty = true; if (dense) f.render();
        f.value.logs.addLog('fixture regeneration after the death', 'normal');
        f.value.logs.addLog('fixture regroup after the regeneration', 'normal');
        f.render(); await Promise.resolve(); f.render();
        return { full: f.value.logs.fullLogEntriesRef.current, visible: f.value.logs.logs };
      } finally { await f.dispose(); }
    }
    assert.deepEqual(await exercise(true), await exercise(false));
  });
  await check('the controller keeps map selection but no longer binds it to the battle log', () => {
    const source = readFileSync(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /useHyperloopPickLog|하이퍼루프 대상 선택/);
    assert.match(source, /const hyperloopCharId = getPreferredHyperloopCharId\(selectedCharId, survivors\)/);
    assert.equal(existsSync(new URL('../src/app/simulation/_lib/useHyperloopPickLog.js', import.meta.url)), false);
  });
  if (process.argv.includes('--match')) {
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const input = await createRandomIsolationInput('observer-selection-replay');
    async function observedRun(interval) {
      const f = fixture([]); let frames = 0, fallbacks = 0, last = '';
      try {
        const result = await runRandomIsolationMatch(input, { onFrame: frame => {
          f.props.survivors = frame.survivors; f.h.dirty = true;
          if (++frames % interval !== 0) return;
          const id = f.render().hyperloopCharId;
          if (last && id && id !== last) fallbacks++;
          last = id;
        } });
        f.render();
        assert.deepEqual(f.value.logs.fullLogsRef.current, []);
        assert.deepEqual(f.value.logs.fullRunEventsRef.current, []);
        return { result, fallbacks };
      } finally { await f.dispose(); }
    }
    await check('two fresh complete matches retain all events, frames, raw logs and RNG with different observer batching', async () => {
      const dense = await observedRun(1), sparse = await observedRun(101);
      assert.ok(dense.fallbacks > 0, 'The fresh match must exercise automatic survivor selection changes.');
      assert.deepEqual(sparse.result.logs, dense.result.logs);
      assert.deepEqual(sparse.result.events, dense.result.events);
      assert.deepEqual(sparse.result.finalFrame, dense.result.finalFrame);
      assert.deepEqual(sparse.result.evidence, dense.result.evidence);
      console.log(JSON.stringify({ ...dense.result.evidence, denseFallbacks: dense.fallbacks, sparseFallbacks: sparse.fallbacks }));
    });
  }
} finally { globalThis.window = previousWindow; timers.clear(); }
console.log(JSON.stringify({ passed, scope: 'real hooks with a lifecycle model and actual engine actions; not browser timing or visual acceptance' }));
