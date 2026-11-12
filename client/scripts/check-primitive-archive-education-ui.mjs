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
  url('src/app/games/primitive-archive/_components/PrimitiveArchiveProductionRequirementGuide.js').href,
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
const { default: Form, PrimitiveArchiveEducationTradition: Reservation } = await import(formUrl);
const { default: Tribe } = await import(tribeUrl);
const { GameControlButton } = await import(primitivesUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { recordFounderDeed } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
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
const compiled = ts.transpileModule(['applyAction', 'configureTribeEducation', 'configureTribeProcess',
  'reserveEducationTradition', 'cancelEducationTradition'].map(declaration).join('\n'), {
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
    actorSelectionRef: { current: state.party[0].id }, educationTradition: engine.educationTraditionSummary(state, state.party[0].id),
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    playGameSfx() {}, setMusicScene() {}, setActorId() {}, setArrivingEraId() {}, setMessage() {},
    setState: value => calls.state.push(value), setActionResult: value => calls.result.push(value), setActionFeedback: value => calls.feedback.push(value), ...overrides };
  const bound = new Function(...Object.keys(scope), `${compiled}\nreturn {handler: configureTribeEducation, legacyHandler: configureTribeProcess, reserveEducationTradition, cancelEducationTradition};`)(...Object.values(scope));
  const directScope = { ...scope, applyAction: (_label, action) => action(ref.current) };
  const directHandler = new Function(...Object.keys(directScope), `${configOnly}\nreturn configureTribeEducation;`)(...Object.values(directScope));
  const invoke = name => {
    const previousWindow = globalThis.window;
    globalThis.window = { clearTimeout() {}, setTimeout() { return 1; } };
    try { return bound[name](); }
    finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
  };
  return { ref, calls, scope, ...bound, directHandler, invoke };
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

function traditionFixture(giverIndex = 0) {
  let state = fresh('education-tradition-ui');
  state.research.completed.HERBALISM = true;
  state.weather = { id: 'clear', name: '검사 맑음', temp: 20, cold: 0, actionMod: 0 };
  for (let i = 0; i < 3; i++) state = recordFounderDeed(state, {
    actorId: state.party[giverIndex].id, kind: 'research_contribution', success: true, target: 'ui-lesson-fixture',
  });
  state = engine.ancestralRiteAction(state, state.party[2].id, state.party[giverIndex].id);
  state = engine.configureTribeEducationAction(state, { teachers: 2 });
  assert.equal(engine.educationTraditionSummary(state, state.party[0].id).canReserve, true);
  return state;
}
const reservationProps = (state, extra = {}) => ({ tradition: engine.educationTraditionSummary(state, state.party[0].id),
  education: engine.tribeEducationSummary(state), hydrated: true, busy: '', ended: false,
  onReserve() {}, onCancel() {}, ...extra });
const reserveButton = tree => one(tree, node => node.type === 'button' && textOf(node).includes('다음 아침 공교육에 전승 1회 예약'));
const cancelButton = tree => one(tree, node => node.type === 'button' && textOf(node).includes('예약 취소 · 환급 없음'));

check('education tradition is compact below the saved plan and separates forecasts from real receipt CP', () => {
  const state = traditionFixture(), before = clone(state), props = reservationProps(state);
  const html = renderToStaticMarkup(React.createElement(Form, { ...formProps(state), ...props }));
  assert.equal((html.match(/aria-label="공교육 교원 계획"/g) || []).length, 1);
  assert.equal((html.match(/aria-label="저장된 공교육 계획의 전승 예약"/g) || []).length, 1);
  assert.ok(html.indexOf('저장된 계획 · 교원 상한') < html.indexOf('공교육 전승 투자'));
  assert.match(html, /사용권 1회를 즉시 소비/); assert.match(html, /환급하거나 다음 날로 넘기지 않습니다/);
  assert.match(html, /현재 비축 기준 전망/); assert.match(html, /CP 예상/);
  const reserved = engine.reserveEducationTraditionAction(state, state.party[0].id);
  const settled = engine.advanceDay(reserved, { rng: () => 0.5 });
  const recentProps = reservationProps(settled), actual = recentProps.tradition.lastSettlement;
  assert.equal(actual.kind, 'education'); assert.ok(actual.basePoints > 0); assert.ok(actual.bonusPoints > 0);
  const recent = Reservation(recentProps);
  assert.ok(textOf(recent).includes(`최근 실제 적용 CP기본 수업 ${actual.basePoints}CP / 전승 추가 ${actual.bonusPoints}CP`));
  assert.deepEqual(state, before);
});

check('reservation controls reject hydration, busy, ended, disabled and missing callbacks', () => {
  const state = traditionFixture(); let calls = 0;
  for (const extra of [{ hydrated: false }, { busy: 'save' }, { busy: 'load' }, { ended: true }, { onReserve: undefined },
    { tradition: { ...reservationProps(state).tradition, enabled: false, canReserve: false } }]) {
    const tree = Reservation(reservationProps(state, { onReserve() { calls++; }, ...extra }));
    assert.equal(reserveButton(tree).props.disabled, true); reserveButton(tree).props.onClick();
  }
  assert.equal(calls, 0);
});

check('actual reserve and cancel callbacks spend once and preserve plan, stock and personal costs', () => {
  const state = traditionFixture(), before = clone(state), view = pageHarness(state);
  view.invoke('reserveEducationTradition');
  const reserved = view.ref.current;
  assert.equal(reserved.projectTradition.pending.kind, 'education');
  assert.equal(reserved.ancestralFaith.active.remaining, state.ancestralFaith.active.remaining - 1);
  assert.deepEqual(reserved.inventory, state.inventory); assert.deepEqual(reserved.party, state.party);
  assert.equal(reserved.ap, state.ap); assert.deepEqual(reserved.tribe.educationPlan, state.tribe.educationPlan);
  view.invoke('reserveEducationTradition'); assert.equal(view.ref.current, reserved);
  const cancel = pageHarness(reserved);
  const tree = Reservation(reservationProps(reserved, { onCancel: () => cancel.invoke('cancelEducationTradition') }));
  assert.equal(cancelButton(tree).props.disabled, false); cancelButton(tree).props.onClick();
  const cancelled = cancel.ref.current;
  assert.equal(cancelled.projectTradition.pending, null);
  assert.equal(cancelled.ancestralFaith.active.remaining, reserved.ancestralFaith.active.remaining);
  assert.equal(engine.educationTraditionSummary(cancelled, state.party[0].id).canReserve, false);
  cancel.invoke('cancelEducationTradition'); assert.equal(cancel.ref.current, cancelled);
  assert.deepEqual(state, before);
});

check('education reservation uses the saved teacher plan without discarding the unsaved draft', () => {
  const state = traditionFixture(), page = pageHarness(state);
  const view = harness({ ...formProps(state), ...reservationProps(state), onReserve: () => page.invoke('reserveEducationTradition') });
  let tree = view.render(); change(tree, '7'); tree = view.render();
  const reservation = one(tree, node => node.type === Reservation);
  reserveButton(Reservation(reservation.props)).props.onClick();
  assert.equal(page.ref.current.projectTradition.pending.teachers, 2);
  assert.equal(page.ref.current.tribe.educationPlan.teachers, 2);
  tree = view.render({ ...formProps(page.ref.current), ...reservationProps(page.ref.current) });
  assert.equal(byType(tree, 'input').props.value, '7');
});

check('stale run day actor teacher plan civic and provider screens cannot reserve', () => {
  for (const changeLive of [
    view => { view.ref.current = { ...view.ref.current, runId: 'different-live-run' }; },
    view => { view.ref.current = { ...view.ref.current, day: view.ref.current.day + 1 }; },
    view => { view.scope.actorSelectionRef.current = view.ref.current.party[1].id; },
    view => { view.ref.current = engine.configureTribeEducationAction(view.ref.current, { teachers: 1 }); },
    view => { view.ref.current = { ...view.ref.current, civics: { ...view.ref.current.civics,
      selectedCivicId: view.scope.educationTradition.selectedCivicId === 'ORAL_RECORDS' ? 'MILITARY_TRADITION' : 'ORAL_RECORDS' } }; },
    view => { view.ref.current = traditionFixture(1); },
    view => { view.ref.current = { ...view.ref.current, ended: true }; },
  ]) {
    const view = pageHarness(traditionFixture()); changeLive(view); const current = view.ref.current;
    view.invoke('reserveEducationTradition'); assert.equal(view.calls.state.length, 0); assert.equal(view.ref.current, current);
  }
});

check('education reservation and cancellation retain writer and save guards and recheck inside applyAction', () => {
  for (const overrides of [{ hydrated: false }, { checkpoint: { ready: false, exclusive: false } },
    { checkpoint: { ready: true, exclusive: false } }, { busy: 'save' }, { busy: 'load' },
    { shopControlsBusy: true }, { shopStartRef: { current: true } }]) {
    const view = pageHarness(traditionFixture(), overrides), current = view.ref.current;
    view.invoke('reserveEducationTradition'); assert.equal(view.ref.current, current); assert.equal(view.calls.state.length, 0);
    const reserved = engine.reserveEducationTraditionAction(traditionFixture(), traditionFixture().party[0].id);
    const cancel = pageHarness(reserved, overrides), pending = cancel.ref.current;
    cancel.invoke('cancelEducationTradition'); assert.equal(cancel.ref.current, pending); assert.equal(cancel.calls.state.length, 0);
  }
  for (const name of ['reserveEducationTradition', 'cancelEducationTradition']) {
    let state = traditionFixture();
    if (name.startsWith('cancel')) state = engine.reserveEducationTraditionAction(state, state.party[0].id);
    const view = pageHarness(state), next = { ...state, day: state.day + 1 };
    const compiledHandler = ts.transpileModule(declaration(name), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
    let result;
    const scope = { ...view.scope, applyAction: (_label, updater) => { result = updater(next); } };
    const handler = new Function(...Object.keys(scope), `${compiledHandler}\nreturn ${name};`)(...Object.values(scope));
    handler(); assert.equal(result, next);
  }
});

console.log(JSON.stringify({ checks, pass: true, callbackDrawComparison,
  scope: 'Actual form callbacks, controlled draft hooks, page handlers and server-rendered markup; not mounted browser lifecycle or visual acceptance.' }));
