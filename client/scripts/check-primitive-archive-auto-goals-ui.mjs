import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './lib/register-simulation-modules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const client = path.join(root, 'client');
const requireClient = createRequire(path.join(client, 'package.json'));
const importClient = async name => import(pathToFileURL(requireClient.resolve(name)).href);
const React = (await importClient('react')).default;
const ts = (await importClient('typescript')).default;
const { renderToStaticMarkup } = await importClient('react-dom/server');
const useBaseline = process.env.PA_AUTO_GOALS_BASELINE === '1';
const relative = 'client/src/app/games/primitive-archive/';
const baselineFiles = ['_lib/primitiveArchiveEngine.js', '_components/PrimitiveArchivePlayContent.js',
  '_components/PrimitiveArchiveActionWorkspace.js', '_components/PrimitiveArchiveFeatureTabs.js'];
function read(relativePath) {
  if (relativePath === relative + '_components/PrimitiveArchivePlayContent.js' && process.env.PA_AUTO_GOALS_PAGE_SOURCE) {
    return readFileSync(path.resolve(root, process.env.PA_AUTO_GOALS_PAGE_SOURCE), 'utf8');
  }
  const original = useBaseline && baselineFiles.some(file => relativePath === relative + file);
  return readFileSync(path.join(root, original ? '.local/code-audit/archive-auto-goals-baseline-sources/' + relativePath : relativePath), 'utf8');
}
registerHooks({ load(url, context, nextLoad) {
  if (!url.startsWith(pathToFileURL(path.join(client, 'src')).href)) return nextLoad(url, context);
  const absolute = fileURLToPath(new URL(url));
  const relativePath = path.relative(root, absolute).split(path.sep).join('/');
  const source = read(relativePath);
  if (!relativePath.includes('/_components/') && !relativePath.endsWith('primitiveArchiveEngine.js')) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const goals = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAutoDayGoals.js');
const reports = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAutoDayReport.js');
const feedback = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js');
const soundtrack = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js');
const { GameControlButton } = await import('../src/app/games/_components/GamePlayPrimitives.js');
const { default: Panel } = await import('../src/app/games/primitive-archive/_components/PrimitiveArchiveAutoDayGoalPanel.js');
const sourceText = read(relative + '_components/PrimitiveArchivePlayContent.js');
const source = ts.createSourceFile('page.js', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function declaration(name) {
  const found = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found.push(`const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.equal(found.length, 1, `Actual page declaration ${name}`); return found[0];
}
const names = ['applyAction', 'autoDayExpectedState', 'autoDayExpectedVersion', 'autoDayExpectedSession',
  'autoDayExpectedGoal', 'autoDayRequestIsCurrent', 'changeAutoDayGoal', 'runAutoDay',
  'autoDayControlsBlocked', 'autoDayControl', 'autoDayGoalControl'];
const compiled = ts.transpileModule(names.map(declaration).join('\n'), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext },
}).outputText;
const fresh = () => engine.createNewState({ runId: 'auto-goals-ui-controlled', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5 });
const clone = value => structuredClone(value);
function harness(state = fresh(), overrides = {}) {
  const calls = { state: [], goals: [], reports: [], epochs: [] }, session = { owner: 'controlled-owner' };
  const scope = {
    ...engine, ...goals, ...reports, ...feedback, ...soundtrack,
    React, GameControlButton, PrimitiveArchiveAutoDayGoalPanel: Panel,
    state, stateRef: { current: state }, hydrated: true, annualMode: false, canAct: state.ap > 0,
    checkpoint: { ready: true, exclusive: true, status: 'ready', canMutate: () => true },
    busy: '', shopControlsBusy: false, shopStartRef: { current: false },
    autoDayGoalId: 'default', autoDayGoalEpoch: 0, autoDayReport: null,
    autoDayGoalRef: { current: { id: 'default', epoch: 0, runId: state.runId, session } },
    actionOwnerSession: session, captureAuthSession: () => session, isCurrentAuthSession: value => value === session,
    actionVersionRef: { current: 0 }, showDeveloperTools: false, actorId: state.party[0].id,
    annualUiGuardRef: { current: null },
    hasLivingPartyMember: value => value.party.some(row => row.hp > 0),
    setAutoDayGoalId: value => calls.goals.push(value), setAutoDayReport: value => calls.reports.push(value),
    setAutoDayGoalEpoch: value => calls.epochs.push(value),
    setState: value => calls.state.push(value), setActionResult() {}, setMessage() {}, setActionFeedback() {},
    playGameSfx() {}, setMusicScene() {}, setActorId() {}, setArrivingEraId() {},
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    ...overrides,
  };
  scope.annualUiGuardRef.current = { hydrated: scope.hydrated, checkpoint: scope.checkpoint, busy: scope.busy, shopControlsBusy: scope.shopControlsBusy };
  const factory = new Function(...Object.keys(scope), `${compiled}\nreturn { ${names.join(',')} };`);
  return { scope, calls, ...factory(...Object.values(scope)) };
}
function invoke(callback, ...args) {
  const random = Math.random, previous = globalThis.window;
  Math.random = () => 0.5; globalThis.window = { clearTimeout() {}, setTimeout() { return 1; } };
  try { return callback(...args); } finally { Math.random = random; if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('actual page exposes a separate four-goal selector and preserves the original auto button', () => {
  const view = harness();
  assert.equal(view.autoDayControl.type, GameControlButton);
  assert.equal(view.autoDayControl.props.children, '하루 자동 운영');
  assert.equal(view.autoDayControl.props.action, 'auto');
  assert.equal(view.autoDayControl.props.cue, 'off');
  assert.equal(view.autoDayControl.props.className, 'primitive-auto-day');
  const html = renderToStaticMarkup(view.autoDayGoalControl);
  assert.match(html, /<select/);
  for (const goal of goals.AUTO_DAY_GOALS) assert.ok(html.includes(`value="${goal.id}"`));
  assert.match(html, /무료/); assert.match(html, /기존 행동 비용/);
  assert.match(read(relative + '_components/PrimitiveArchiveActionWorkspace.js'), /autoDayGoalControl/);
  assert.match(read(relative + '_components/PrimitiveArchiveFeatureTabs.js'), /autoDayGoalControl|\.\.\.props/);
});
check('changing goal is free at AP zero and only explicit auto click performs real action', () => {
  const state = fresh(); state.ap = 0;
  const view = harness(state), original = clone(state);
  invoke(view.changeAutoDayGoal, 'exploration');
  assert.deepEqual(state, original); assert.equal(view.calls.state.length, 0);
  assert.equal(view.scope.autoDayGoalRef.current.id, 'exploration');
  assert.deepEqual(view.calls.epochs, /\[autoDayGoalEpoch\s*,/.test(sourceText) ? [1] : []);
  assert.equal(view.autoDayControl.props.disabled, true);
  const active = harness(fresh(), { autoDayGoalId: 'development' });
  active.scope.autoDayGoalRef.current.id = 'development';
  invoke(active.runAutoDay);
  assert.ok(active.calls.state.length > 0);
  assert.ok(active.calls.reports.some(value => value?.goalId === 'development'));
  assert.ok(!Object.hasOwn(active.scope.stateRef.current, 'autoGoal'));
});
check('owner session writer lease bootstrap and active operation guards reject direct callbacks', () => {
  for (const overrides of [
    { hydrated: false }, { checkpoint: { ready: false, exclusive: false, canMutate: () => false } },
    { checkpoint: { ready: true, exclusive: false, canMutate: () => false } },
    { checkpoint: { ready: true, exclusive: true, canMutate: () => false } },
    { isCurrentAuthSession: () => false }, { busy: 'save' }, { busy: 'load' },
    { shopControlsBusy: true }, { shopStartRef: { current: true } },
  ]) {
    const view = harness(fresh(), overrides), before = clone(view.scope.autoDayGoalRef.current);
    invoke(view.changeAutoDayGoal, 'exploration'); invoke(view.runAutoDay);
    assert.equal(view.calls.state.length, 0); assert.equal(view.calls.goals.length, 0);
    assert.deepEqual(view.scope.autoDayGoalRef.current, before);
  }
});
check('stale rendered callback cannot apply a goal or run to another state or goal epoch', () => {
  for (const mutate of [view => { view.scope.stateRef.current = { ...view.scope.stateRef.current, runId: 'other-run' }; },
    view => { view.scope.stateRef.current = { ...view.scope.stateRef.current, day: 2 }; },
    view => { view.scope.actionVersionRef.current++; },
    view => { view.scope.autoDayGoalRef.current = { ...view.scope.autoDayGoalRef.current, epoch: view.scope.autoDayGoalRef.current.epoch + 1 }; }]) {
    const view = harness(); mutate(view); invoke(view.changeAutoDayGoal, 'exploration'); invoke(view.runAutoDay);
    assert.equal(view.calls.state.length, 0); assert.equal(view.calls.goals.length, 0);
  }
});
check('annual mode hides goal selection and ordinary daily auto controls', () => {
  const view = harness(fresh(), { annualMode: true });
  assert.equal(view.autoDayGoalControl, null); assert.equal(view.autoDayControl, null);
});
check('execution report derives only actual deltas and recent logs and rejects another run', () => {
  const previous = fresh(), next = clone(previous);
  next.counters.craft += 2; next.log = ['new actual log', ...previous.log];
  const before = clone(previous), after = clone(next);
  const report = reports.autoDayExecutionReport(previous, next, 'completion');
  assert.equal(report.goalId, 'completion');
  assert.equal(report.changes.find(row => row.id === 'craft').count, 2);
  assert.deepEqual(report.recentLog, ['new actual log']);
  assert.deepEqual(previous, before); assert.deepEqual(next, after);
  assert.equal(reports.autoDayExecutionReport(previous, { ...next, runId: 'other' }, 'completion'), null);
  assert.equal(reports.autoDayExecutionReport(previous, previous, 'completion'), null);
  const html = renderToStaticMarkup(React.createElement(Panel, { goalId: 'completion', onChange() {}, report }));
  assert.match(html, /최근 기록/); assert.match(html, /new actual log/); assert.match(html, /제작 성공 \+2/);
});
check('actual reset effect requests a reactive render when default goal and null report survive a session change', () => {
  const state = fresh(), oldSession = { revision: 1 }, newSession = { revision: 2 };
  const ref = { current: { id: 'default', epoch: 0, runId: state.runId, session: oldSession } };
  const hookDeclarations = [], hookBindings = [], effectBodies = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
      && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'useState') {
      const bindings = node.name.elements.map(element => element.name?.getText(source));
      if (bindings[0]?.startsWith('autoDayGoal') || bindings[0] === 'autoDayReport') {
        hookDeclarations.push(`const ${node.getText(source)};`); hookBindings.push(...bindings);
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('resetAutoDayGoal(state.runId)')) effectBodies.push(node.arguments[0].getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(hookDeclarations.length >= 2); assert.equal(effectBodies.length, 1);
  const slots = [], updates = []; let cursor = 0, dirty = false;
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => {
      const next = typeof value === 'function' ? value(slots[index]) : value;
      if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; updates.push(index); }
    }];
  };
  const evaluateHooks = new Function('useState', 'useCallback', 'autoDayGoalRef', 'captureAuthSession', 'isCurrentAuthSession', 'state',
    `${hookDeclarations.join('\n')}\n${declaration('resetAutoDayGoal')}\nreturn { ${hookBindings.join(',')}, resetAutoDayGoal, effect: (${effectBodies[0]}) };`);
  const renderHooks = () => {
    cursor = 0;
    return evaluateHooks(useState, callback => callback, ref, () => newSession, value => value === newSession, state);
  };
  const beforeEffect = renderHooks();
  assert.equal(beforeEffect.autoDayGoalId, 'default'); assert.equal(beforeEffect.autoDayReport, null);
  const stale = harness(state, { ...beforeEffect, autoDayGoalRef: ref,
    captureAuthSession: () => newSession, isCurrentAuthSession: value => value === newSession });
  assert.equal(stale.autoDayControl.props.disabled, true);
  assert.equal(stale.autoDayRequestIsCurrent(), false);
  beforeEffect.effect();
  assert.equal(ref.current.session, newSession); assert.equal(ref.current.id, 'default'); assert.equal(ref.current.epoch, 1);
  assert.equal(dirty, true, 'Same default goal and null report must still change at least one reactive state; ref-only reset leaves disabled controls committed.');
  assert.ok(updates.length > 0);
  const afterEffect = renderHooks();
  assert.equal(afterEffect.autoDayGoalId, 'default'); assert.equal(afterEffect.autoDayReport, null);
  const refreshed = harness(state, { ...afterEffect, autoDayGoalRef: ref,
    captureAuthSession: () => newSession, isCurrentAuthSession: value => value === newSession });
  assert.equal(refreshed.autoDayControl.props.disabled, false);
  assert.equal(refreshed.autoDayGoalControl.props.disabled, false);
  assert.equal(refreshed.autoDayRequestIsCurrent(), true);
  invoke(stale.runAutoDay); assert.equal(stale.calls.state.length, 0, 'the old goal object closure remains rejected after reset');
});
console.log(JSON.stringify({ pass: true, checks, baseline: useBaseline,
  mode: useBaseline ? 'explicit-private-original-ui-negative-control' : 'current-tracked-source',
  scope: 'Actual page declarations, reset effect and callbacks, SSR product panel, controlled hook values with Object.is-aware reactive update modeling. Normal mode reads current tracked sources without private audit inputs. No browser, mounted React/storage hooks, account writes or live UI acceptance.', resultFiles: 0 }));
