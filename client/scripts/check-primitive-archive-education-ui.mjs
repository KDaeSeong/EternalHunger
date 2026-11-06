import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const root = new URL('../', import.meta.url), url = path => new URL(path, root);
const formUrl = url('src/app/games/primitive-archive/_components/PrimitiveArchiveEducationPlan.js').href;
const tribeUrl = url('src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js').href;
const primitivesUrl = url('src/app/games/_components/GamePlayPrimitives.js').href;
const transformed = new Set([formUrl, tribeUrl, primitivesUrl,
  url('src/app/games/primitive-archive/_components/PrimitiveArchiveProcessingPlan.js').href,
  url('src/app/games/_components/GameActionIcon.js').href,
  url('src/app/games/primitive-archive/_components/PrimitiveArchiveVisuals.js').href]);
globalThis.__educationUiReact = React;
const hooksSource = `export function useState(initial) {
  const harness = globalThis.__educationUiHooks;
  if (!harness) return globalThis.__educationUiReact.useState(initial);
  const index = harness.cursor++;
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
  return [harness.values[index], value => {
    harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value;
  }];
}`;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === formUrl && specifier === 'react') return { url: `data:text/javascript,${encodeURIComponent(hooksSource)}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(moduleUrl, context, next) {
    if (!transformed.has(moduleUrl)) return next(moduleUrl, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(moduleUrl), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Form } = await import(formUrl);
const { default: Tribe } = await import(tribeUrl);
const { GameControlButton } = await import(primitivesUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const processing = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const feedback = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js');
const soundtrack = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js');
const clone = value => structuredClone(value);
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (node.type === GameControlButton) return nodes(GameControlButton(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
};
const one = (tree, predicate) => { const found = nodes(tree, predicate); assert.equal(found.length, 1); return found[0]; };
const byType = (tree, type) => one(tree, node => node.type === type);
const button = tree => one(tree, node => node.type === 'button' && node.props.type === 'submit');
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
function fresh(runId = 'education-ui') {
  let state = engine.createNewState({ runId, rng: () => 0.5, now: '2026-11-06T00:00:00.000Z' });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.inventory = { ...state.inventory, berry: 100, paper: 8, wood: 20, fiber: 20 };
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true, SHELTER: true, SETTLEMENT: true, FOOD_STORAGE: true };
  state.civics.completed.PUBLIC_EDUCATION = true;
  state.tribe.population = 4;
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, job.id === 'scholar' ? 2 : job.id === 'forager' ? 2 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, 0]));
  return state;
}
const formProps = (state, extra = {}) => ({ education: engine.tribeEducationSummary(state), runId: state.runId, onConfigure() {}, ...extra });
function harness(initialProps) {
  let props = initialProps, key, hooks;
  return { render(next = props) {
    props = next; const element = Form(props); assert.ok(element);
    if (element.key !== key) { key = element.key; hooks = { cursor: 0, values: [] }; }
    hooks.cursor = 0; globalThis.__educationUiHooks = hooks;
    try { return element.type(element.props); } finally { delete globalThis.__educationUiHooks; }
  }, get key() { return key; } };
}
const change = (tree, value) => byType(tree, 'input').props.onChange({ target: { value } });
const submit = tree => { let prevented = false; byType(tree, 'form').props.onSubmit({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); };
const pageSource = readFileSync(url('src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js'), 'utf8');
function declaration(name) {
  const source = ts.createSourceFile('page.js', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); let found;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) { assert.equal(found, undefined); found = `const ${node.getText(source)};`; } ts.forEachChild(node, visit); };
  visit(source); assert.ok(found, name); return found;
}
const compiled = ts.transpileModule(['applyAction', 'configureTribeEducation', 'configureTribeProcess'].map(declaration).join('\n'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const configOnly = ts.transpileModule(declaration('configureTribeEducation'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
function pageHarness(state = fresh(), overrides = {}) {
  const ref = { current: state }, calls = { state: [], result: [], feedback: [] };
  const scope = { ...engine, ...processing, ...feedback, ...soundtrack, state, tribe: engine.tribeSummary(state), stateRef: ref, hydrated: true,
    checkpoint: { ready: true, exclusive: true, status: 'ready' }, busy: '', shopControlsBusy: false,
    shopStartRef: { current: false }, showDeveloperTools: false, actorId: state.party[0].id,
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    playGameSfx() {}, setMusicScene() {}, setActorId() {}, setArrivingEraId() {}, setMessage() {},
    setState: value => calls.state.push(value), setActionResult: value => calls.result.push(value), setActionFeedback: value => calls.feedback.push(value), ...overrides };
  const bound = new Function(...Object.keys(scope), `${compiled}\nreturn {handler: configureTribeEducation, legacyHandler: configureTribeProcess};`)(...Object.values(scope));
  const directScope = { ...scope, applyAction: (_label, action) => action(ref.current) };
  const directHandler = new Function(...Object.keys(directScope), `${configOnly}\nreturn configureTribeEducation;`)(...Object.values(directScope));
  return { ref, calls, scope, ...bound, directHandler };
}
function captureDraws(run) {
  const original = Math.random, draws = []; let seed = 0x12345678;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const value = seed / 2 ** 32; draws.push(value); return value; };
  try { run(); return draws; } finally { Math.random = original; }
}
let checks = 0, callbackDrawComparison;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };

check('native education form keeps edits as drafts until one atomic valid submission', () => {
  const state = fresh(), before = clone(state), requests = [], view = harness(formProps(state, { onConfigure: plan => requests.push(plan) }));
  let tree = view.render(); assert.equal(button(tree).props.disabled, true);
  const input = byType(tree, 'input'); assert.equal(input.props.type, 'number'); assert.equal(input.props.min, '0'); assert.equal(input.props.max, '24'); assert.equal(input.props.step, '1');
  assert.equal(nodes(tree, node => node.type === 'label').length, 1);
  assert.equal(input.props['aria-describedby'], button(tree).props['aria-describedby']);
  change(tree, '3'); tree = view.render(); assert.equal(requests.length, 0); assert.equal(button(tree).props.disabled, false);
  submit(tree); assert.deepEqual(requests, [{ teachers: 3 }]); assert.deepEqual(state, before);
});

check('unsaved drafts survive stock and day refresh and reset only for a different saved plan or run', () => {
  const state = fresh(), view = harness(formProps(state)); let tree = view.render(); const key = view.key;
  change(tree, '7'); const update = clone(state); update.day++; update.inventory.paper = 1;
  tree = view.render(formProps(update)); assert.equal(view.key, key); assert.equal(byType(tree, 'input').props.value, '7');
  tree = view.render(formProps(engine.configureTribeEducationAction(update, { teachers: 2 })));
  assert.notEqual(view.key, key); assert.equal(byType(tree, 'input').props.value, '2');
  change(tree, '9'); tree = view.render(formProps(fresh('different-run'))); assert.equal(byType(tree, 'input').props.value, '0');
});

check('invalid, locked, ended, busy and missing-callback forms cannot submit a changed plan', () => {
  for (const value of ['', '-1', '25', '1.5', 'Infinity', 'bad']) {
    const calls = [], view = harness(formProps(fresh(), { onConfigure: plan => calls.push(plan) }));
    let tree = view.render(); change(tree, value); tree = view.render(); assert.equal(button(tree).props.disabled, true); submit(tree); assert.deepEqual(calls, []);
  }
  const locked = fresh(); delete locked.civics.completed.PUBLIC_EDUCATION;
  for (const [state, extra] of [[locked, {}], [{ ...fresh(), ended: true }, {}], [fresh(), { blockedReason: '쓰기 권한 확인 중' }], [fresh(), { onConfigure: undefined }]]) {
    const calls = [], view = harness(formProps(state, { onConfigure: plan => calls.push(plan), ...extra }));
    let tree = view.render(); change(tree, '2'); tree = view.render(); assert.equal(button(tree).props.disabled, true); submit(tree); assert.deepEqual(calls, []);
  }
  const activeLocked = engine.configureTribeEducationAction(fresh(), { teachers: 2 }); delete activeLocked.civics.completed.PUBLIC_EDUCATION;
  const calls = [], view = harness(formProps(activeLocked, { onConfigure: plan => calls.push(plan) }));
  let tree = view.render(); change(tree, '0'); tree = view.render(); assert.equal(button(tree).props.disabled, false); submit(tree); assert.deepEqual(calls, [{ teachers: 0 }]);
});

check('tribe renders one education form and the real recent receipt without altering history', () => {
  const state = engine.advanceDay(engine.configureTribeEducationAction(fresh(), { teachers: 2 }), { rng: () => 0.5 });
  const education = engine.tribeEducationSummary(state); assert.ok(education.receipt); assert.ok(education.receipt.teachers > 0);
  const changed = engine.configureTribeEducationAction(state, { teachers: 1 }); changed.inventory.paper = 99;
  const before = clone(changed), props = { state: changed, tribe: engine.tribeSummary(changed), rivals: [], busy: '', recentActionText: '현재 운영 결과',
    adjustTribeJob() {}, configureTribeProcess() {}, configureTribeEducation() {} };
  const tree = Tribe(props); assert.equal(nodes(tree, node => node.type === Form).length, 1);
  const row = one(tree, node => node.props.className === 'primitive-education-receipt');
  assert.equal(textOf(row), '직전 정산 실제 공교육' + education.receiptText);
  const html = renderToStaticMarkup(React.createElement(Tribe, props));
  assert.equal((html.match(/aria-label="공교육 교원 계획"/g) || []).length, 1);
  assert.ok(html.includes('현재 운영 결과')); assert.ok(html.includes('직전 정산 실제 공교육')); assert.deepEqual(changed, before);
});

check('actual page callbacks change only the plan and honor writer, shop, stale plan and run guards', () => {
  const state = fresh(); state.ap = 0; const before = clone(state), view = pageHarness(state);
  const direct = pageHarness(state), original = Math.random;
  Math.random = () => { throw new Error('Education guard or plan mutation consumed gameplay RNG'); };
  try { direct.directHandler({ teachers: 2 }); } finally { Math.random = original; }
  // The shared applyAction wrapper already normalizes milestones/feedback.
  // Compare the actual existing process callback separately from the new path.
  const common = pageHarness(clone(state));
  const baselineDraws = captureDraws(() => common.legacyHandler({ actionId: 'kiln', targetStock: 3 }));
  const actualDraws = captureDraws(() => view.handler({ teachers: 2 }));
  assert.equal(common.calls.state.length, 1);
  assert.ok(actualDraws.length <= baselineDraws.length, 'Education must add no RNG draws over the existing real process callback.');
  assert.deepEqual(actualDraws, baselineDraws.slice(0, actualDraws.length));
  callbackDrawComparison = { newCallbackDraws: actualDraws, existingProcessCallbackDraws: baselineDraws,
    noAdditionalDraws: actualDraws.length <= baselineDraws.length, pureGuardAndMutationDraws: 0 };
  assert.deepEqual(view.ref.current.tribe.educationPlan, { teachers: 2 }); assert.equal(view.calls.state.length, 1);
  assert.deepEqual(view.ref.current.inventory, before.inventory); assert.deepEqual(view.ref.current.party, before.party); assert.equal(view.ref.current.ap, 0);
  assert.deepEqual(state, before);
  for (const overrides of [{ hydrated: false }, { checkpoint: { ready: false, exclusive: false, status: 'loading' } },
    { checkpoint: { ready: true, exclusive: false, status: 'conflict' } }, { busy: 'save' }, { busy: 'load' },
    { shopControlsBusy: true }, { shopStartRef: { current: true } }]) {
    const blocked = pageHarness(fresh(), overrides), current = blocked.ref.current; blocked.handler({ teachers: 2 });
    assert.equal(blocked.ref.current, current); assert.equal(blocked.calls.state.length, 0);
  }
  for (const replacement of [engine.configureTribeEducationAction(fresh(), { teachers: 1 }), fresh('new-live-run'), { ...fresh(), ended: true }]) {
    const stale = pageHarness(); stale.ref.current = replacement; stale.handler({ teachers: 2 }); assert.equal(stale.ref.current, replacement); assert.equal(stale.calls.state.length, 0);
  }
});

console.log(JSON.stringify({ checks, pass: true, callbackDrawComparison,
  scope: 'Actual form callbacks, controlled draft hooks, page handlers and server-rendered markup; not mounted browser lifecycle or visual acceptance.' }));
