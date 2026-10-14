import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import './lib/register-simulation-modules.mjs';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const hookUrl = new URL('../src/app/simulation/_lib/useSimulationPhaseExecutor.js', import.meta.url).href;
const controllerUrl = new URL('../src/app/simulation/_lib/useSimulationPhaseController.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const cycleStub = `data:text/javascript,${encodeURIComponent(`
  export function runSimulationPhaseCycle(options) {
    const probe = globalThis.__phaseExecutorHookProbe;
    probe.fallbackRuns++;
    probe.fallbackOptions.push(options);
    return Promise.resolve({ kind: 'fallback' });
  }
`)}`;

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'react') {
    return { url: harnessUrl, shortCircuit: true };
  }
  if (context.parentURL === hookUrl && specifier === './simulationPhaseCycleRuntime.js') {
    return { url: cycleStub, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });

const { useSimulationPhaseExecutor } = await import(hookUrl);
const { useSimulationPhaseController } = await import(controllerUrl);
const probe = { fallbackRuns: 0, fallbackOptions: [], workers: [], mode: 'complete' };
globalThis.__phaseExecutorHookProbe = probe;

class TestWorker {
  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
    probe.workers.push(this);
    if (probe.mode !== 'pending-startup') queueMicrotask(() => {
      if (probe.mode === 'startup-fail') this.dispatch('error', { error: new Error('startup failed'), preventDefault() {} });
      else this.dispatch('message', { data: { kind: 'ready' } });
    });
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  dispatch(name, event) { for (const listener of this.listeners.get(name) || []) listener(event); }
  postMessage(message) {
    this.messages.push(message);
    if (message.kind !== 'phase') return;
    if (probe.mode === 'complete') queueMicrotask(() => this.dispatch('message', { data: {
      kind: 'complete', phaseId: message.phaseId, seq: 1,
      refState: { startStarterLoadoutApplied: false, suddenDeathActive: false,
        suddenDeathEndAtSec: null, suddenDeathForbiddenAnnounced: false, random: null },
    } }));
    if (probe.mode === 'execution-fail') queueMicrotask(() => this.dispatch('message', { data: {
      kind: 'failed', phaseId: message.phaseId, seq: 1, message: 'controlled worker failure',
      refState: { startStarterLoadoutApplied: false, suddenDeathActive: false,
        suddenDeathEndAtSec: null, suddenDeathForbiddenAnnounced: false, random: null },
    } }));
  }
  terminate() { this.terminated = true; }
}

const previousWorker = globalThis.Worker;
const previousDocument = globalThis.document;
const previousWindow = globalThis.window;
let documentAdds = 0, documentRemoves = 0;
globalThis.Worker = TestWorker;
globalThis.document = {
  visibilityState: 'visible',
  addEventListener(name) { if (name === 'visibilitychange') documentAdds++; },
  removeEventListener(name) { if (name === 'visibilitychange') documentRemoves++; },
};
globalThis.window = { setTimeout: () => 1, clearTimeout() {} };

function makeFixture({ autoSpeed = 32, input = { run: 1 } } = {}) {
  const props = { autoSpeed };
  const actions = { autoplayWrites: [], logs: [], finishWrites: 0, saveWrites: 0,
    setAutoPlay: (value) => actions.autoplayWrites.push(value),
    addLog: (...args) => actions.logs.push(args),
    finishGame: () => { actions.finishWrites++; },
    save: () => { actions.saveWrites++; },
  };
  const refs = { runInputRef: { current: input }, autoSpeedRef: { current: autoSpeed },
    runRandomRef: { current: null } };
  const state = { day: 1, phase: 'morning', autoSpeed };
  let execute;
  const harness = createHandlerHarness(() => {
    execute = useSimulationPhaseExecutor({ autoSpeed: props.autoSpeed });
    return null;
  }, {});
  harness.render();
  return { harness, props, actions, refs, state, execute: (...args) => execute(...args) };
}

function phaseOptions(fixture) {
  return { state: fixture.state, refs: fixture.refs, actions: fixture.actions, helpers: { marker: true } };
}
async function settle() { await new Promise((resolve) => setTimeout(resolve, 0)); }
async function until(predicate, message) {
  for (let i = 0; i < 30 && !predicate(); i++) await settle();
  assert.ok(predicate(), message);
}

let checks = 0;
async function check(name, run) {
  await run(); checks++;
  console.log(`PASS ${name}`);
}

try {
  await check('Worker-free environment runs the real fallback exactly once', async () => {
    const fixture = makeFixture();
    globalThis.Worker = undefined;
    assert.deepEqual(await fixture.execute(phaseOptions(fixture)), { kind: 'fallback' });
    assert.equal(probe.fallbackRuns, 1);
    fixture.harness.unmount();
    globalThis.Worker = TestWorker;
  });

  await check('startup failure falls back once before any phase command is accepted', async () => {
    probe.mode = 'startup-fail';
    const fixture = makeFixture();
    assert.deepEqual(await fixture.execute(phaseOptions(fixture)), { kind: 'fallback' });
    assert.equal(probe.fallbackRuns, 2);
    assert.equal(probe.workers.at(-1).messages.some(row => row.kind === 'phase'), false);
    fixture.harness.unmount();
  });

  await check('successful worker phase does not run the fallback and preserves real import.meta worker URL', async () => {
    probe.mode = 'complete';
    const fixture = makeFixture();
    await fixture.execute(phaseOptions(fixture));
    const worker = probe.workers.at(-1);
    assert.equal(probe.fallbackRuns, 2);
    assert.equal(new URL(worker.url).pathname.endsWith('/simulationPhaseWorker.js'), true);
    assert.deepEqual(worker.options, { type: 'module' });
    assert.equal(worker.messages.filter(row => row.kind === 'phase').length, 1);
    fixture.harness.unmount();
  });

  await check('execution failure blocks same-input resume but a replacement input starts a fresh phase', async () => {
    probe.mode = 'execution-fail';
    const fixture = makeFixture();
    await assert.rejects(fixture.execute(phaseOptions(fixture)), error => error.code === 'PHASE_WORKER_EXECUTION');
    assert.equal(fixture.actions.autoplayWrites.length, 1);
    assert.equal(fixture.actions.logs.length, 1);
    assert.equal(probe.fallbackRuns, 2);
    await assert.rejects(fixture.execute(phaseOptions(fixture)), error => error.code === 'PHASE_WORKER_EXECUTION');
    assert.equal(probe.fallbackRuns, 2, 'same failed input cannot restart on the main thread');
    fixture.refs.runInputRef.current = { run: 2 };
    probe.mode = 'complete';
    await fixture.execute(phaseOptions(fixture));
    assert.equal(probe.fallbackRuns, 2);
    fixture.harness.unmount();
  });

  await check('unmount during worker startup cancels without fallback or game-side writes', async () => {
    probe.mode = 'pending-startup';
    const fixture = makeFixture();
    const pending = fixture.execute(phaseOptions(fixture));
    await until(() => probe.workers.at(-1)?.listeners.has('message'), 'startup worker listener was not installed');
    fixture.harness.unmount();
    await pending;
    assert.equal(probe.fallbackRuns, 2);
    assert.deepEqual(fixture.actions.autoplayWrites, []);
    assert.deepEqual(fixture.actions.logs, []);
    assert.equal(fixture.actions.finishWrites + fixture.actions.saveWrites, 0);
    assert.equal(probe.workers.at(-1).terminated, true);
  });

  await check('unmount after phase post cancels active worker without fallback or game-side writes', async () => {
    probe.mode = 'pending-active';
    const fixture = makeFixture();
    const pending = fixture.execute(phaseOptions(fixture));
    const worker = probe.workers.at(-1);
    await until(() => worker.messages.some(row => row.kind === 'phase'), 'phase was not posted');
    fixture.harness.unmount();
    await pending;
    assert.equal(probe.fallbackRuns, 2);
    assert.deepEqual(fixture.actions.autoplayWrites, []);
    assert.deepEqual(fixture.actions.logs, []);
    assert.equal(fixture.actions.finishWrites + fixture.actions.saveWrites, 0);
    assert.equal(worker.terminated, true);
  });

  await check('speed effect and visibility listener clean up on rerender and unmount', async () => {
    probe.mode = 'complete';
    const addsBefore = documentAdds, removesBefore = documentRemoves;
    const fixture = makeFixture();
    fixture.props.autoSpeed = 8;
    fixture.harness.render();
    assert.equal(documentAdds - addsBefore, 2);
    assert.equal(documentRemoves - removesBefore, 1);
    fixture.harness.unmount();
    assert.equal(documentAdds, documentRemoves);
  });

  await check('first-frame failure preserves partial journal and blocks guarded restart before side effects', async () => {
    probe.mode = 'execution-fail';
    const input = { run: 'day0-match0' };
    const calls = { locks: 0, refreshes: 0, journals: 0, prepares: 0, applies: 0,
      finishes: 0, saves: 0, autoplay: [], logs: [] };
    let journal = [];
    const refs = {
      runInputRef: { current: input }, autoSpeedRef: { current: 32 }, runRandomRef: { current: null },
      isAdvancingRef: { current: false }, mapPreparationRef: { current: null },
      activeMapRef: { current: null }, activeMapIdRef: { current: null },
      startStarterLoadoutAppliedRef: { current: false }, suddenDeathActiveRef: { current: false },
      suddenDeathEndAtSecRef: { current: null }, suddenDeathForbiddenAnnouncedRef: { current: false },
      fullLogsRef: { current: [] }, fullRunEventsRef: { current: [] }, isFinishingRef: { current: false },
      proceedPhaseGuardedRef: { current: null },
    };
    const actors = [
      { _id: 'a', name: 'A', hp: 100, maxHp: 100, alive: true },
      { _id: 'b', name: 'B', hp: 100, maxHp: 100, alive: true },
    ];
    const actions = {
      setAutoPlay: value => calls.autoplay.push(value),
      addLog: (...args) => calls.logs.push(args),
      finishGame: () => { calls.finishes++; },
      save: () => { calls.saves++; },
      lockRunInputs: () => { calls.locks++; },
      refreshMapSettingsFromServer: async () => { calls.refreshes++; },
      setRunEvents: rows => { calls.journals++; journal = rows; },
      setIsAdvancing() {},
      prepareRun: () => { calls.prepares++; return null; },
      applyRunInput: () => { calls.applies++; },
      normalizeAutoSpeed: value => value,
    };
    const state = {
      day: 0, phase: 'night', matchSec: 0, runSeed: 17, runEvents: journal,
      survivors: actors, dead: [], settings: { matchMode: 'solo' }, autoSpeed: 32,
      autoPlay: false, isAdvancing: false, loading: false, isGameOver: false,
      showMarketPanel: false, pendingTranscendPick: null, assistCounts: {}, killCounts: {},
    };
    let controller;
    const harness = createHandlerHarness(() => {
      controller = useSimulationPhaseController({ actions, helpers: {}, refs, state });
      return null;
    }, {});
    harness.render();
    await assert.rejects(controller.proceedPhaseGuarded(), error => error.code === 'PHASE_WORKER_EXECUTION');
    assert.equal(journal.length, 1);
    assert.equal(journal[0].kind, 'run_start');
    assert.equal(calls.logs.length, 1);
    assert.equal(calls.autoplay.at(-1), false);
    assert.equal(controller.proceedPhaseGuarded.constructor.name, 'AsyncFunction');
    const snapshot = structuredClone({ calls, journal });
    await controller.proceedPhaseGuarded();
    assert.deepEqual(calls.locks, snapshot.calls.locks);
    assert.deepEqual(calls.refreshes, snapshot.calls.refreshes);
    assert.deepEqual(calls.journals, snapshot.calls.journals);
    assert.deepEqual(calls.prepares, snapshot.calls.prepares);
    assert.deepEqual(calls.applies, snapshot.calls.applies);
    assert.deepEqual(calls.finishes + calls.saves, 0);
    assert.deepEqual(journal, snapshot.journal);
    assert.deepEqual(calls.logs, snapshot.calls.logs);
    assert.equal(calls.autoplay.at(-1), false);
    assert.equal(probe.fallbackRuns, 2);
    harness.unmount();
  });
  console.log(JSON.stringify({ passed: checks, fallbackRuns: probe.fallbackRuns,
    workerCreations: probe.workers.length, scope: 'real hook function with test-only hook/Worker harness; not browser UI evidence' }));
} finally {
  if (previousWorker === undefined) delete globalThis.Worker;
  else globalThis.Worker = previousWorker;
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  delete globalThis.__phaseExecutorHookProbe;
}
