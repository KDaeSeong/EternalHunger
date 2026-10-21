import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
globalThis.__primitiveArchiveReact = React;
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const persistenceUrl = new URL('../src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js', import.meta.url).href;
const reactStub = `
  export function useState(initial) {
    const harness = globalThis.__primitiveArchivePersistenceHarness;
    harness.stateInitials.push(initial);
    return [initial, (value) => harness.stateWrites.push(value)];
  }
  export function useRef(initial) {
    const ref = { current: initial };
    globalThis.__primitiveArchivePersistenceHarness.refs.push(ref);
    return ref;
  }
`;
const apiStub = `
  async function call(method, path, payload, options) {
    const harness = globalThis.__primitiveArchivePersistenceHarness;
    const request = { method, path, payload, options };
    harness.apiCalls.push(request);
    const handler = harness.handlers[method];
    return handler ? handler(request) : undefined;
  }
  export const apiGet = (path, options) => call('GET', path, undefined, options);
  export const apiPost = (path, payload, options) => call('POST', path, payload, options);
  export const apiPut = (path, payload, options) => call('PUT', path, payload, options);
  export const clearApiGetCache = (path) => globalThis.__primitiveArchivePersistenceHarness.cacheClears.push(path);
  export const captureAuthSession = () => ({ scope: 'fixture', revision: 0 });
  export const isCurrentAuthSession = () => true;
`;
const asDataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === persistenceUrl && specifier === 'react') {
      return { url: asDataModule(reactStub), shortCircuit: true };
    }
    if (context.parentURL === persistenceUrl && specifier === '../../../../utils/api') {
      return { url: asDataModule(apiStub), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { default: invokePersistenceHook } = await import(persistenceUrl);

const runTabUrl = new URL('../src/app/games/primitive-archive/_components/PrimitiveArchiveRunTab.js', import.meta.url).href;
const runTabModules = new Map([
  ['next/link', `const jsx = (...args) => globalThis.__primitiveArchiveReact.createElement(...args); export default function Link(props) { return jsx('a', props); }`],
  ['../../_components/GamePlayPrimitives', `
    const jsx = (...args) => globalThis.__primitiveArchiveReact.createElement(...args);
    export function ActionButton(props) { return jsx('button', { type: 'button', 'data-action': props.action, disabled: props.disabled, title: props.title, children: props.children }); }
    export function GameControlButton(props) { return jsx('button', { type: 'button', 'data-action': props.action, disabled: props.disabled, title: props.title, children: props.children }); }
  `],
  ['../_lib/primitiveArchivePageRuntime', `
    export const FALLBACK_DIFFICULTY_TAGS = {};
    export const multiplierText = (value) => String(value);
    export const startInventoryText = () => '기본 보급';
  `],
  ['./PrimitiveArchiveVisuals', `
    const jsx = (...args) => globalThis.__primitiveArchiveReact.createElement(...args);
    export function PrimitiveArchivePanelTitle(props) { return jsx('header', { children: props.children }); }
  `],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === runTabUrl && runTabModules.has(specifier)) {
      return { url: asDataModule(runTabModules.get(specifier)), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== runTabUrl) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});
const { default: PrimitiveArchiveRunTab } = await import(runTabUrl);

function fixture(overrides = {}) {
  const base = engine.createNewState({
    rng: () => 0.5,
    runId: 'run-record-check',
    now: '2026-10-20T00:00:00.000Z',
  });
  return engine.normalizeState({
    ...base,
    day: 4,
    ap: 2,
    party: base.party.map((member) => ({ ...member, hp: 80, hunger: 15, stamina: 90, bodyTemp: 37 })),
    ...overrides,
  });
}

function goalReadyFixture(overrides = {}) {
  const base = fixture();
  return engine.normalizeState({
    ...base,
    day: 12,
    camp: { ...base.camp, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1 },
    inventory: { ...base.inventory, book_craft_guide: 1, book_camp_manual: 1 },
    research: {
      ...base.research,
      completed: Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true])),
    },
    civics: {
      ...base.civics,
      completed: Object.fromEntries(engine.CIVIC_TREE.map((civic) => [civic.id, true])),
    },
    ...overrides,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const checks = [];
const failures = [];
function check(name, run) {
  try {
    run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function expectStatus(state, expected) {
  const status = engine.runRecordStatus(state);
  for (const [key, value] of Object.entries(expected)) assert.equal(status[key], value, `${key} classification`);
  return status;
}

function persistenceHarness(state, options = {}) {
  const harness = {
    apiCalls: [],
    cacheClears: [],
    handlers: options.handlers || {},
    refs: [],
    stateInitials: [],
    stateWrites: [],
  };
  globalThis.__primitiveArchivePersistenceHarness = harness;
  const writes = { actionResults: [], difficulties: [], states: [], toasts: [] };
  const controls = invokePersistenceHook({
    setActionResult: (value) => writes.actionResults.push(value),
    setNewRunDifficulty: (value) => writes.difficulties.push(value),
    setState: (value) => writes.states.push(value),
    showToast: (value) => writes.toasts.push(value),
    state,
    token: options.token ?? 'test-token',
  });
  return { controls, harness, writes };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function checkAsync(name, run) {
  try {
    await run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

check('an active run directs the player to archive completion when every real objective is ready', () => {
  const state = goalReadyFixture();
  assert.equal(engine.archiveVictorySummary(state).canComplete, true);
  const status = expectStatus(state, { canRecord: false, result: 'none', label: '진행 중' });
  assert.match(status.reason, /아카이브 완성/);
});

check('an active run with unfinished objectives directs the player to settle the run', () => {
  const status = expectStatus(fixture(), { canRecord: false, result: 'none', label: '진행 중' });
  assert.match(status.reason, /런 정산/);
});

check('an ended victorious run is recordable as a clear', () => {
  const state = goalReadyFixture({ ended: true, victory: true });
  expectStatus(state, { canRecord: true, result: 'clear', label: '아카이브 완성' });
});

check('an ended run with every companion dead is recordable as a failure', () => {
  const state = fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) });
  expectStatus(state, { canRecord: true, result: 'fail', label: '실패' });
});

check('an ended unfinished run with survivors is recordable as an uncompleted settlement', () => {
  const state = fixture({ ended: true });
  expectStatus(state, { canRecord: true, result: 'none', label: '미완성 정산' });
});

check('a stale active flag cannot hide a total party loss', () => {
  const state = fixture({ ended: false, party: fixture().party.map((member) => ({ ...member, hp: 0 })) });
  expectStatus(state, { canRecord: true, result: 'fail', label: '실패' });
});

check('one or more living companions prevent an active run from being classified as failure', () => {
  const state = fixture();
  state.party[0].hp = 0;
  expectStatus(state, { canRecord: false, result: 'none', label: '진행 중' });
});

check('classification reads frozen state without mutating the caller input', () => {
  const state = deepFreeze(fixture());
  const before = structuredClone(state);
  engine.runRecordStatus(state);
  assert.deepEqual(state, before);
});

check('archive completion records rewards once and remains classified as a clear', () => {
  const state = goalReadyFixture();
  const original = structuredClone(state);
  const completed = engine.completeArchiveAction(state);
  assert.equal(completed.ended, true);
  assert.equal(completed.victory, true);
  assert.equal(completed.meta.runsCompleted, original.meta.runsCompleted + 1);
  expectStatus(completed, { canRecord: true, result: 'clear' });

  const repeated = engine.completeArchiveAction(completed);
  assert.equal(repeated.meta.runsCompleted, completed.meta.runsCompleted);
  assert.equal(repeated.meta.perkPoints, completed.meta.perkPoints);
  assert.equal(repeated.meta.lifetimeScore, completed.meta.lifetimeScore);
  expectStatus(repeated, { canRecord: true, result: 'clear' });
  assert.deepEqual(state, original, 'Completion must not mutate the pre-completion state.');
});

check('ordinary settlement records a living unfinished run once and remains uncompleted', () => {
  const state = fixture();
  const original = structuredClone(state);
  const settled = engine.settleRunAction(state);
  assert.equal(settled.ended, true);
  assert.equal(settled.victory, false);
  assert.equal(settled.meta.runsCompleted, original.meta.runsCompleted + 1);
  expectStatus(settled, { canRecord: true, result: 'none', label: '미완성 정산' });

  const repeated = engine.settleRunAction(settled);
  assert.equal(repeated.meta.runsCompleted, settled.meta.runsCompleted);
  assert.equal(repeated.meta.perkPoints, settled.meta.perkPoints);
  assert.equal(repeated.meta.lifetimeScore, settled.meta.lifetimeScore);
  expectStatus(repeated, { canRecord: true, result: 'none' });
  assert.deepEqual(state, original, 'Settlement must not mutate the pre-settlement state.');
});

check('failure reward settlement is explicit, one-time and keeps the run classified as a failure', () => {
  const state = fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) });
  const original = structuredClone(state);
  expectStatus(state, { canRecord: true, result: 'fail' });

  const settled = engine.settleRunAction(state);
  const award = Math.max(1, Math.floor(engine.scoreState(state) / 850));
  assert.equal(settled.ended, true);
  assert.equal(settled.victory, false);
  assert.equal(settled.meta.lastSettledRunId, state.runId);
  assert.equal(settled.meta.lastAward, award);
  assert.equal(settled.meta.perkPoints, state.meta.perkPoints + award);
  assert.equal(settled.meta.runsCompleted, state.meta.runsCompleted + 1);
  expectStatus(settled, { canRecord: true, result: 'fail', label: '실패' });

  const repeated = engine.settleRunAction(settled);
  assert.equal(repeated.meta.perkPoints, settled.meta.perkPoints);
  assert.equal(repeated.meta.runsCompleted, settled.meta.runsCompleted);
  assert.equal(repeated.meta.lifetimeScore, settled.meta.lifetimeScore);
  expectStatus(repeated, { canRecord: true, result: 'fail' });
  assert.deepEqual(state, original, 'Reward settlement must not mutate the unrecorded failed run.');
});

function renderRunTab(state, overrides = {}) {
  const difficulty = engine.difficultyRows().find((row) => row.key === state.difficulty) || engine.difficultyRows()[0];
  return renderToStaticMarkup(React.createElement(PrimitiveArchiveRunTab, {
    applyAction() {},
    archiveVictory: engine.archiveVictorySummary(state),
    busy: '',
    currentDifficulty: difficulty,
    hydrated: true,
    newRunDifficulty: state.difficulty,
    recordRun() {},
    selectedDifficulty: difficulty,
    setNewRunDifficulty() {},
    startNewRun() {},
    state,
    token: 'fixture-token',
    ...overrides,
  }));
}

function actionButton(html, action) {
  return html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0] || '';
}

check('the actual run-management panel disables recording until completion or settlement and enables terminal records', () => {
  const active = renderRunTab(fixture());
  assert.match(actionButton(active, 'archive'), /disabled/);
  assert.match(actionButton(active, 'archive'), /런 정산/);
  assert.doesNotMatch(actionButton(active, 'settle'), /disabled/);

  const ready = renderRunTab(goalReadyFixture());
  assert.match(actionButton(ready, 'archive'), /disabled/);
  assert.match(actionButton(ready, 'archive'), /아카이브 완성/);
  assert.doesNotMatch(actionButton(ready, 'complete'), /disabled/);
  assert.match(ready, /아카이브 완성/);

  const clear = renderRunTab(engine.completeArchiveAction(goalReadyFixture()));
  assert.doesNotMatch(actionButton(clear, 'archive'), /disabled/);
  assert.match(actionButton(clear, 'complete'), /disabled/);
  assert.match(actionButton(clear, 'settle'), /disabled/);

  const failed = fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) });
  const failureHtml = renderRunTab(failed);
  assert.doesNotMatch(actionButton(failureHtml, 'archive'), /disabled/);
});

check('the actual run-management panel locks new, record, completion and settlement controls during every persistence operation', () => {
  const activeReady = goalReadyFixture();
  const terminal = engine.completeArchiveAction(activeReady);
  for (const busy of ['save', 'load', 'record']) {
    const activeHtml = renderRunTab(activeReady, { busy });
    assert.match(actionButton(activeHtml, 'new'), /disabled/);
    assert.match(actionButton(activeHtml, 'archive'), /disabled/);
    assert.match(actionButton(activeHtml, 'complete'), /disabled/);
    assert.match(actionButton(activeHtml, 'settle'), /disabled/);

    const terminalHtml = renderRunTab(terminal, { busy });
    assert.match(actionButton(terminalHtml, 'new'), /disabled/);
    assert.match(actionButton(terminalHtml, 'archive'), /disabled/);
    assert.match(actionButton(terminalHtml, 'complete'), /disabled/);
    assert.match(actionButton(terminalHtml, 'settle'), /disabled/);
  }
});

check('the actual run-management panel keeps record disabled until hydration and authentication are both present', () => {
  const terminal = engine.completeArchiveAction(goalReadyFixture());
  assert.match(actionButton(renderRunTab(terminal, { hydrated: false }), 'archive'), /disabled/);
  assert.match(actionButton(renderRunTab(terminal, { token: '' }), 'archive'), /disabled/);
  assert.doesNotMatch(actionButton(renderRunTab(terminal, { hydrated: true, token: 'fixture-token' }), 'archive'), /disabled/);
});

check('the actual run-management panel offers explicit reward settlement after failure until that run has been settled', () => {
  const failed = fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) });
  const failedHtml = renderRunTab(failed);
  assert.doesNotMatch(actionButton(failedHtml, 'settle'), /disabled/);
  assert.match(failedHtml, /런 보상 정산/);
  assert.doesNotMatch(actionButton(failedHtml, 'archive'), /disabled/);

  const settledFailure = engine.settleRunAction(failed);
  const settledHtml = renderRunTab(settledFailure);
  assert.match(actionButton(settledHtml, 'settle'), /disabled/);
  assert.doesNotMatch(actionButton(settledHtml, 'archive'), /disabled/);
  assert.equal(engine.runRecordStatus(settledFailure).result, 'fail');
});

await checkAsync('the real persistence hook blocks both active-run record paths without API or state writes', async () => {
  for (const [state, reason] of [
    [fixture(), /런 정산/],
    [goalReadyFixture(), /아카이브 완성/],
  ]) {
    const original = structuredClone(state);
    const { controls, harness, writes } = persistenceHarness(state);
    await controls.recordRun();
    assert.equal(harness.apiCalls.length, 0);
    assert.equal(writes.states.length, 0);
    assert.equal(writes.actionResults.length, 1);
    assert.match(writes.actionResults[0], reason);
    assert.deepEqual(state, original);
  }
});

await checkAsync('the real persistence hook sends the actual clear, failure and unfinished results with engine scores', async () => {
  const cases = [
    ['clear', engine.completeArchiveAction(goalReadyFixture())],
    ['fail', fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) })],
    ['none', fixture({ ended: true })],
  ];
  for (const [result, state] of cases) {
    const original = structuredClone(state);
    const { controls, harness, writes } = persistenceHarness(state);
    await controls.recordRun();
    assert.equal(harness.apiCalls.length, 1);
    const [request] = harness.apiCalls;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/game-records/primitive-archive');
    assert.equal(request.payload.result, result);
    assert.equal(request.payload.title, `문명 아카이브 · ${state.day}일 · ${engine.runRecordStatus(state).label}`);
    assert.equal(request.payload.mode, 'survival-loop');
    assert.equal(request.payload.score, engine.scoreState(state));
    assert.deepEqual(request.payload.payload.state, engine.normalizeState(state));
    assert.equal(harness.cacheClears[0], '/game-records');
    assert.equal(writes.states.length, 0);
    assert.deepEqual(state, original);
  }
});

await checkAsync('a rejected record leaves the run untouched and the same hook can retry successfully', async () => {
  let attempts = 0;
  const state = fixture({ ended: true });
  const original = structuredClone(state);
  const { controls, harness, writes } = persistenceHarness(state, {
    handlers: { POST: () => { attempts += 1; if (attempts === 1) throw new Error('offline fixture'); } },
  });
  await controls.recordRun();
  assert.equal(harness.apiCalls.length, 1);
  assert.match(writes.toasts.at(-1).message, /offline fixture/);
  assert.deepEqual(state, original);
  assert.equal(writes.states.length, 0);

  await controls.recordRun();
  assert.equal(harness.apiCalls.length, 2);
  assert.equal(attempts, 2);
  assert.equal(harness.cacheClears.at(-1), '/game-records');
  assert.deepEqual(state, original);
  assert.equal(writes.states.length, 0);
});

await checkAsync('same-tick record calls and save/load attempts share the pending-operation lock', async () => {
  const request = deferred();
  const { controls, harness, writes } = persistenceHarness(fixture({ ended: true }), {
    handlers: { POST: () => request.promise },
  });
  const firstRecord = controls.recordRun();
  const duplicateRecord = controls.recordRun();
  await Promise.all([controls.saveRun(), controls.loadRun(), duplicateRecord]);
  assert.equal(harness.apiCalls.length, 1);
  assert.equal(harness.apiCalls[0].method, 'POST');
  assert.equal(writes.states.length, 0);
  request.resolve({ ok: true });
  await firstRecord;
  assert.equal(writes.states.length, 0);
});

await checkAsync('a delayed record of the previous run cannot settle or overwrite a newly started run', async () => {
  const request = deferred();
  const oldRun = fixture({ ended: true });
  const newRun = fixture({ runId: 'new-run-after-record-start', day: 1, ended: false, victory: false });
  let currentRun = newRun;
  const { controls, harness, writes } = persistenceHarness(oldRun, {
    handlers: { POST: () => request.promise },
  });
  const recordInFlight = controls.recordRun();
  assert.equal(harness.apiCalls[0].payload.payload.state.runId, oldRun.runId);
  currentRun = newRun;
  request.resolve({ ok: true });
  await recordInFlight;
  assert.equal(currentRun, newRun);
  assert.equal(currentRun.ended, false);
  assert.equal(currentRun.victory, false);
  assert.equal(writes.states.length, 0);
  assert.equal(writes.difficulties.length, 0);
  assert.deepEqual(oldRun, fixture({ ended: true }));
});

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
