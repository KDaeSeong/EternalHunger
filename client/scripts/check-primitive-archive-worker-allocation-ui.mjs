import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import './lib/register-simulation-modules.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const client = path.join(root, 'client'), requireClient = createRequire(path.join(client, 'package.json'));
const loadPackage = async name => import(pathToFileURL(requireClient.resolve(name)).href);
const React = (await loadPackage('react')).default, ts = (await loadPackage('typescript')).default;
const { renderToStaticMarkup } = await loadPackage('react-dom/server');
registerHooks({ load(url, context, nextLoad) {
  if (!url.startsWith(pathToFileURL(path.join(client, 'src')).href) || !url.includes('/_components/')) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const engine = await import(new URL('_lib/primitiveArchiveEngine.js', base));
const feedback = await import(new URL('_lib/primitiveArchiveFeedback.js', base));
const soundtrack = await import(new URL('_lib/primitiveArchiveSoundtrack.js', base));
const { GameControlButton } = await import('../src/app/games/_components/GamePlayPrimitives.js');
const { default: Panel } = await import(new URL('_components/PrimitiveArchiveWorkerComparison.js', base));
const pageText = readFileSync(new URL('_components/PrimitiveArchivePlayContent.js', base), 'utf8');
const ast = ts.createSourceFile('page.js', pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function declaration(name) {
  const found = [];
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(`const ${node.getText(ast)};`); ts.forEachChild(node, visit); }
  visit(ast); assert.equal(found.length, 1, `Actual page declaration ${name}`); return found[0];
}
const names = ['applyAction', 'resetWorkerComparison', 'workerComparison', 'workerExpectedState', 'workerExpectedVersion',
  'workerExpectedSession', 'workerExpectedChoice', 'workerRequestIsCurrent', 'chooseWorkerComparison', 'applyWorkerComparison',
  'workerSelectionBlocked', 'workerApplyBlocked', 'workerComparisonControl'];
const compiled = ts.transpileModule(names.map(declaration).join('\n'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText;
const fresh = () => {
  const state = engine.createNewState({ runId: 'worker-allocation-ui-current', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5 });
  for (const row of engine.TECH_TREE) state.research.completed[row.id] = true;
  state.inventory = { berry: 1000, wood: 100, stone: 100, fiber: 100 };
  state.camp = { ...state.camp, shelterLevel: 3, fireLevel: 1, fuel: 20, workbenchLevel: 1 };
  state.tribe.population = 6;
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, row.id === 'forager' ? 3 : row.id === 'scholar' ? 3 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, 0])); state.ap = 0;
  return engine.normalizeState(state);
};
function harness(state = fresh(), overrides = {}) {
  const calls = { states: [], choices: [], epochs: [] }, session = { owner: 'worker-owner' };
  const choice = { fromJobId: 'forager', toJobId: 'scholar' }, actorId = state.party[0].id;
  const scope = { ...engine, ...feedback, ...soundtrack, React, GameControlButton, PrimitiveArchiveWorkerComparison: Panel,
    useCallback: callback => callback, useMemo: callback => callback(),
    state, stateRef: { current: state }, actorId, actorSelectionRef: { current: actorId },
    annualMode: state.calendar?.mode === 'annual', activeTabId: 'tribe', hydrated: true, busy: '', shopControlsBusy: false,
    checkpoint: { ready: true, exclusive: true, canMutate: () => true }, shopStartRef: { current: false },
    workerChoice: choice, workerChoiceEpoch: 0,
    workerChoiceRef: { current: { ...choice, epoch: 0, runId: state.runId, mode: state.calendar?.mode === 'annual' ? 'annual' : 'daily', actorId, session } },
    captureAuthSession: () => session, isCurrentAuthSession: value => value === session, actionOwnerSession: session,
    actionVersionRef: { current: 0 }, workerComparisonUiGuardRef: { current: null },
    setWorkerChoice: value => calls.choices.push(value), setWorkerChoiceEpoch: value => calls.epochs.push(value),
    showDeveloperTools: false, musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    setState: value => calls.states.push(value), playGameSfx() {}, setMusicScene() {}, setActorId() {}, setArrivingEraId() {},
    setActionResult() {}, setActionFeedback() {}, setMessage() {}, ...overrides };
  scope.workerComparisonUiGuardRef.current = { hydrated: scope.hydrated, busy: scope.busy, shopControlsBusy: scope.shopControlsBusy,
    checkpoint: scope.checkpoint, activeTabId: scope.activeTabId, actorId: scope.actorId, annualMode: scope.annualMode };
  const exports = names.filter(name => name !== 'applyAction');
  const view = new Function(...Object.keys(scope), `${compiled}\nreturn { ${exports.join(',')} };`)(...Object.values(scope));
  return { ...view, scope, calls };
}
function invoke(callback, ...args) {
  const previousWindow = globalThis.window;
  globalThis.window = { clearTimeout() {}, setTimeout() { return 1; } };
  try { return callback(...args); } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('actual tribe panel SSR exposes accessible choices assumptions exact numbers and signed loss rows', () => {
  const view = harness(); assert.equal(view.workerComparison.available, true);
  const html = renderToStaticMarkup(view.workerComparisonControl);
  assert.match(html, /<select/); assert.match(html, /<caption>/); assert.match(html, /scope="col"/);
  assert.match(html, /비교는 무료/); assert.match(html, /직접 고정/); assert.match(html, /자동 재배치/);
  const exact = { ...view.workerComparison, rows: [{ id: 'fraction', group: 'operations', label: '실측', unit: 'CP', before: 0.5, after: 0.3, delta: -0.2 }] };
  const numbers = renderToStaticMarkup(React.createElement(Panel, { comparison: exact, choice: view.scope.workerChoice }));
  assert.match(numbers, /0\.3 CP/); assert.match(numbers, /0\.5 CP/); assert.match(numbers, /-0\.2 CP/);
  assert.match(numbers, /data-change="loss"/);
  assert.match(readFileSync(new URL('_components/PrimitiveArchiveTribeTab.js', base), 'utf8'), /workerComparisonControl/);
  assert.match(readFileSync(new URL('_components/PrimitiveArchiveFeatureTabs.js', base), 'utf8'), /\.\.\.props/);
});
check('AP zero selection is free without a writer while apply requires the live lease', () => {
  const view = harness(fresh(), { checkpoint: { ready: true, exclusive: false, canMutate: () => false } });
  assert.equal(view.workerSelectionBlocked, false); assert.equal(view.workerApplyBlocked, true);
  const before = structuredClone(view.scope.stateRef.current);
  invoke(view.chooseWorkerComparison, 'toJobId', 'miner');
  assert.equal(view.scope.workerChoiceRef.current.toJobId, 'miner'); assert.deepEqual(view.calls.epochs, [1]);
  assert.deepEqual(view.scope.stateRef.current, before); assert.equal(view.calls.states.length, 0);
  invoke(view.applyWorkerComparison); assert.equal(view.calls.states.length, 0);
  const active = harness(); const original = active.scope.stateRef.current;
  invoke(active.applyWorkerComparison); assert.equal(active.calls.states.length, 1);
  const next = active.scope.stateRef.current; assert.equal(next.day, original.day); assert.equal(next.ap, 0);
  assert.equal(next.tribe.assignments.forager, 2); assert.equal(next.tribe.assignments.scholar, 4);
  invoke(active.applyWorkerComparison); assert.equal(active.calls.states.length, 1, 'old rendered apply cannot transfer twice');
});
check('scope guards reject stale owner run actor tab mode version choice and live bootstrap or busy state', () => {
  for (const mutate of [
    view => { view.scope.stateRef.current = { ...view.scope.stateRef.current, runId: 'replacement' }; },
    view => { view.scope.actionVersionRef.current++; },
    view => { view.scope.workerChoiceRef.current = { ...view.scope.workerChoiceRef.current, epoch: 1 }; },
    view => { view.scope.actorSelectionRef.current = 'different-actor'; },
    view => { view.scope.workerComparisonUiGuardRef.current.activeTabId = 'growth'; },
    view => { view.scope.workerComparisonUiGuardRef.current.annualMode = true; },
    view => { view.scope.workerComparisonUiGuardRef.current.hydrated = false; },
    view => { view.scope.workerComparisonUiGuardRef.current.busy = 'load'; },
    view => { view.scope.workerComparisonUiGuardRef.current.shopControlsBusy = true; },
    view => { view.scope.shopStartRef.current = true; },
    view => { view.scope.workerChoiceRef.current.session = { owner: 'other' }; },
  ]) {
    const view = harness(); mutate(view); invoke(view.chooseWorkerComparison, 'toJobId', 'miner'); invoke(view.applyWorkerComparison);
    assert.equal(view.calls.states.length, 0); assert.equal(view.calls.choices.length, 0);
  }
  const noLease = harness(); noLease.scope.checkpoint.canMutate = () => false;
  invoke(noLease.applyWorkerComparison); assert.equal(noLease.calls.states.length, 0);
});
check('actual reset and scope effect request reactive epoch changes and reject the prior choice closure', () => {
  const view = harness(), previous = view.scope.workerChoiceRef.current;
  const nextState = { ...view.scope.state, runId: 'restored-run' }, nextActor = nextState.party[1].id;
  view.resetWorkerComparison(nextState, nextActor);
  assert.deepEqual(view.calls.choices, [{ fromJobId: 'unassigned', toJobId: '' }]); assert.deepEqual(view.calls.epochs, [1]);
  assert.equal(view.scope.workerChoiceRef.current.runId, nextState.runId); assert.equal(view.scope.workerChoiceRef.current.actorId, nextActor);
  assert.notEqual(view.scope.workerChoiceRef.current, previous);
  invoke(view.applyWorkerComparison); assert.equal(view.calls.states.length, 0);
  const effects = [];
  function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0]?.getText(ast).includes('resetWorkerComparison(state, actorId)')) effects.push(node.arguments[0].getText(ast)); ts.forEachChild(node, visit); }
  visit(ast); assert.equal(effects.length, 1);
  const scope = view.scope;
  const effect = new Function(...Object.keys(scope), 'resetWorkerComparison', `return (${effects[0]});`)(...Object.values(scope), view.resetWorkerComparison);
  effect(); assert.deepEqual(view.calls.epochs, [1, 2]);
  assert.equal(scope.workerChoiceRef.current.runId, scope.state.runId); assert.equal(scope.workerChoiceRef.current.actorId, scope.actorId);
});
check('panel stays absent outside the tribe tab and shows the actual annual comparison in annual scope', () => {
  assert.equal(harness(fresh(), { activeTabId: 'actions' }).workerComparisonControl, null);
  const source = fresh(), stamp = { runId: source.runId, day: source.day, ap: source.ap, updatedAt: source.updatedAt, completedYears: null };
  const state = engine.startAnnualSettlementAction(source, stamp, { observedLifetimeYears: 60 });
  const view = harness(state); assert.equal(view.workerComparison.mode, 'annual');
  assert.match(renderToStaticMarkup(view.workerComparisonControl), /년차/);
});
console.log(JSON.stringify({ pass: true, checks, mode: 'tracked-current-source-only',
  scope: 'Actual page callbacks, reset effect, live guards and SSR product panel with controlled hook values. No mounted React, browser geometry, device save writes, account writes or historical audit inputs.', resultFiles: 0 }));
