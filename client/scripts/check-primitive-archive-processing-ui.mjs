import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const root = new URL('../', import.meta.url);
const url = relative => new URL(relative, root);
const formUrl = url('src/app/games/primitive-archive/_components/PrimitiveArchiveProcessingPlan.js').href;
const tribeUrl = url('src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js').href;
const playUrl = url('src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js');
const primitivesUrl = url('src/app/games/_components/GamePlayPrimitives.js').href;
const cssUrl = url('src/styles/PrimitiveArchiveWorkPolicy.css');
const transformed = new Set([formUrl, tribeUrl, primitivesUrl,
  url('src/app/games/primitive-archive/_components/PrimitiveArchiveEducationPlan.js').href,
  url('src/app/games/_components/GameActionIcon.js').href,
  url('src/app/games/primitive-archive/_components/PrimitiveArchiveVisuals.js').href]);

// Only form state returns are controlled for direct callback/draft checks.
// Static markup uses React's actual server renderer. This is not mounted lifecycle.
globalThis.__processingUiReact = React;
const hooksSource = `export function useState(initial) {
  const harness = globalThis.__processingUiHooks;
  if (!harness) return globalThis.__processingUiReact.useState(initial);
  const index = harness.cursor++;
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
  return [harness.values[index], value => {
    harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value;
  }];
}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === formUrl && specifier === 'react') {
      return { url: `data:text/javascript,${encodeURIComponent(hooksSource)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(moduleUrl, context, nextLoad) {
    if (!transformed.has(moduleUrl)) return nextLoad(moduleUrl, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(moduleUrl), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: ProcessingPlan } = await import(formUrl);
const { default: Tribe } = await import(tribeUrl);
const { GameControlButton } = await import(primitivesUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const processing = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const feedback = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js');
const soundtrack = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js');
const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (node.type === GameControlButton) return nodes(GameControlButton(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
};
const one = (tree, predicate) => {
  const found = nodes(tree, predicate); assert.equal(found.length, 1); return found[0];
};
const byType = (tree, type) => one(tree, node => node.type === type);
const submitButton = tree => one(tree, node => node.type === 'button' && node.props.type === 'submit');
const patch = (actionId = 'kiln', targetStock = 3) => ({ actionId, targetStock });
const fresh = (runId = 'processing-ui-fresh') => {
  const state = engine.createNewState({ rng: () => 0.5, runId, now: '2026-11-05T00:00:00.000Z' });
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true, POTTERY: true };
  state.camp = { ...state.camp, shelterLevel: 1, fuel: 10 };
  state.inventory = { ...state.inventory, berry: 100, clay: 20, wood: 40, pottery: 0 };
  state.tribe = { ...state.tribe, population: 4, morale: 75,
    assignments: Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, job.id === 'artisan' ? 2 : 0])),
    autoAssignments: Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, 0])),
  };
  return state;
};
const configured = (state = fresh(), plan = patch()) => engine.configureTribeProcessAction(state, plan);
const selectedCasualty = () => {
  let state = fresh(); state.party[0].hp = 1;
  state = engine.runHuntAction(state, state.party[0].id, 'plains', { rng: () => 0.999999 });
  assert.equal(state.party[0].hp, 0);
  return state;
};
const formProps = (state, extra = {}) => ({ processing: engine.tribeSummary(state).processing, runId: state.runId,
  onConfigure() {}, ...extra });
const tribeProps = (state, extra = {}) => ({ state, tribe: engine.tribeSummary(state), rivals: [], busy: '',
  recentActionText: '기존 최근 부족 운영 결과', adjustTribeJob() {}, configureTribeProcess() {}, ...extra });
const html = props => renderToStaticMarkup(React.createElement(Tribe, props));

function formHarness(initialProps) {
  let props = initialProps, key, hooks;
  return {
    render(nextProps = props) {
      props = nextProps;
      const element = ProcessingPlan(props);
      assert.ok(element);
      if (element.key !== key) { key = element.key; hooks = { cursor: 0, values: [] }; }
      hooks.cursor = 0;
      globalThis.__processingUiHooks = hooks;
      try { return element.type(element.props); }
      finally { delete globalThis.__processingUiHooks; }
    },
    get key() { return key; },
  };
}
const change = (tree, type, value) => byType(tree, type).props.onChange({ target: { value } });
const submit = tree => {
  let prevented = false;
  byType(tree, 'form').props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
};
const pageSource = readFileSync(playUrl, 'utf8');
function declaration(name) {
  const source = ts.createSourceFile('PrimitiveArchivePlayContent.js', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      assert.equal(found, undefined); found = `const ${node.getText(source)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(found, name); return found;
}
const compiled = ts.transpileModule(['applyAction', 'configureTribeProcess'].map(declaration).join('\n'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
function pageHarness(state = fresh(), overrides = {}) {
  const ref = { current: state }, calls = { state: [], result: [], feedback: [] };
  const scope = { ...engine, ...processing, ...feedback, ...soundtrack,
    state, tribe: engine.tribeSummary(state), stateRef: ref, hydrated: true,
    checkpoint: { ready: true, exclusive: true, status: 'ready' }, busy: '', shopControlsBusy: false,
    shopStartRef: { current: false }, showDeveloperTools: false, actorId: state.party[0].id,
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    playGameSfx() {}, setMusicScene() {}, setActorId() {}, setArrivingEraId() {}, setMessage() {},
    setState: value => calls.state.push(value), setActionResult: value => calls.result.push(value),
    setActionFeedback: value => calls.feedback.push(value), ...overrides,
  };
  const handler = new Function(...Object.keys(scope), `${compiled}\nreturn configureTribeProcess;`)(...Object.values(scope));
  return { handler, ref, calls, scope };
}

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS ' + name); };
check('one native process form belongs to the existing artisan card with no extra summary or developer gate', () => {
  const state = freeze(configured()), before = JSON.stringify(state), props = tribeProps(state), tree = Tribe(props);
  assert.equal(nodes(tree, node => node.type === 'section').length, 3);
  const panel = one(tree, node => node.type === 'section' && node.props.className.includes('primitive-job-panel'));
  const grid = one(panel, node => node.props.className === 'primitive-job-grid');
  const card = one(grid, node => node.type === 'article' && node.props.className.includes('primitive-processing-job'));
  assert.equal(nodes(card, node => node.type === ProcessingPlan).length, 1);
  assert.equal(nodes(tree, node => node.type === ProcessingPlan).length, 1);
  const rendered = html(props);
  assert.equal((rendered.match(/aria-label="가공대 생산 계획"/g) || []).length, 1);
  assert.equal((rendered.match(/직전 정산 실제 가공/g) || []).length, 1);
  assert.ok(rendered.includes('직전 운영 방침·배치'));
  assert.ok(rendered.includes('기존 최근 부족 운영 결과'));
  assert.equal(JSON.stringify(state), before);
  assert.doesNotMatch(readFileSync(new URL(formUrl), 'utf8'), /showDeveloperTools|devTools/);
});
check('native labels select integer input and submit forwarding expose keyboard and description semantics', () => {
  const harness = formHarness(formProps(fresh())), tree = harness.render();
  const select = byType(tree, 'select'), input = byType(tree, 'input'), button = submitButton(tree);
  assert.equal(nodes(tree, node => node.type === 'label').length, 2);
  assert.equal(input.props.type, 'number'); assert.equal(input.props.inputMode, 'numeric');
  assert.equal(input.props.step, '1'); assert.equal(input.props.max, Number.MAX_SAFE_INTEGER);
  assert.equal(button.props.type, 'submit'); assert.equal(textOf(button), '설정 적용');
  const describedBy = select.props['aria-describedby'];
  assert.equal(input.props['aria-describedby'], describedBy); assert.equal(button.props['aria-describedby'], describedBy);
  assert.equal(nodes(tree, node => node.props.id === describedBy).length, 1);
  assert.equal(nodes(tree, node => node.type === 'details').length, 0);
  const options = nodes(select, node => node.type === 'option');
  assert.deepEqual(options.map(option => option.props.value), ['', ...processing.TRIBE_PROCESS_ACTION_IDS]);
  assert.ok(options.every(option => !option.props.disabled));
  assert.equal(select.props.role, undefined); assert.equal(input.props.role, undefined);
});
check('draft edits commit one valid process and target together without costs or premature callbacks', () => {
  const state = fresh(), before = clone(state), received = [];
  const harness = formHarness(formProps(state, { onConfigure: plan => received.push(plan) }));
  let tree = harness.render(); assert.equal(submitButton(tree).props.disabled, true);
  change(tree, 'select', 'kiln'); tree = harness.render();
  assert.equal(byType(tree, 'input').props.value, '1');
  change(tree, 'input', '5'); tree = harness.render();
  assert.equal(received.length, 0); assert.equal(submitButton(tree).props.disabled, false);
  submit(tree); assert.deepEqual(received, [patch('kiln', 5)]); assert.deepEqual(state, before);
  change(tree, 'select', ''); tree = harness.render();
  assert.equal(byType(tree, 'input').props.value, '0'); assert.equal(byType(tree, 'input').props.disabled, true);
  assert.equal(submitButton(tree).props.disabled, true);
  const offRequests = [], active = formHarness(formProps(configured(), { onConfigure: plan => offRequests.push(plan) }));
  let activeTree = active.render(); change(activeTree, 'select', ''); activeTree = active.render(); submit(activeTree);
  assert.deepEqual(offRequests, [patch('', 0)]);
});
check('invalid same ended busy or missing-callback form submissions cannot request any change', () => {
  for (const value of ['', '0', '-1', '1.5', '9007199254740992', 'Infinity', 'bad']) {
    let calls = 0;
    const harness = formHarness(formProps(configured(), { onConfigure() { calls += 1; } }));
    let tree = harness.render(); change(tree, 'input', value); tree = harness.render();
    assert.equal(submitButton(tree).props.disabled, true, value); submit(tree); assert.equal(calls, 0, value);
  }
  let sameCalls = 0;
  const same = formHarness(formProps(configured(), { onConfigure() { sameCalls += 1; } }));
  const sameTree = same.render(); assert.equal(submitButton(sameTree).props.disabled, true);
  submit(sameTree); assert.equal(sameCalls, 0);
  for (const extra of [{ onConfigure: undefined }, { blockedReason: '소유자·쓰기 권한 확인 중' },
    { processing: engine.tribeSummary({ ...configured(), ended: true }).processing }]) {
    let calls = 0;
    const harness = formHarness(formProps(configured(), { onConfigure() { calls += 1; }, ...extra }));
    let tree = harness.render(); change(tree, 'input', '6'); tree = harness.render();
    assert.equal(submitButton(tree).props.disabled, true); submit(tree); assert.equal(calls, 0);
  }
  let calls = 0;
  const harness = formHarness(formProps(configured(), { onConfigure() { calls += 1; } }));
  let tree = harness.render(); change(tree, 'select', 'not-a-process'); tree = harness.render();
  submit(tree); assert.equal(calls, 0);
});
check('locked future plans remain editable with no materials labor AP or selected living actor', () => {
  const unestablished = engine.createNewState({ runId: 'processing-locked-job-label',
    now: '2026-11-05T00:00:00.000Z', rng: () => 0.5 });
  assert.equal(engine.tribeSummary(unestablished).jobs.find(job => job.id === 'artisan').lockedReason, '정착 연구 필요');
  const state = selectedCasualty(); state.research.completed.POTTERY = false; state.ap = 0;
  state.inventory.clay = 0; state.inventory.wood = 0; state.tribe.assignments.artisan = 0;
  let received;
  const harness = formHarness(formProps(state, { onConfigure: plan => { received = plan; } }));
  let tree = harness.render(); assert.equal(byType(tree, 'select').props.disabled, false);
  change(tree, 'select', 'kiln'); tree = harness.render(); change(tree, 'input', '3'); tree = harness.render();
  assert.equal(submitButton(tree).props.disabled, false);
  assert.ok(textOf(tree).includes('미래 계획')); assert.ok(textOf(tree).includes('연구'));
  submit(tree); assert.deepEqual(received, patch());
  for (const pause of [
    candidate => { candidate.research.completed.POTTERY = false; },
    candidate => { candidate.inventory.clay = 0; candidate.inventory.wood = 0; },
    candidate => { candidate.tribe.assignments.artisan = 0; },
    candidate => { candidate.inventory.pottery = 3; },
  ]) {
    const candidate = configured(); pause(candidate);
    const summary = engine.tribeSummary(candidate).processing;
    assert.equal(summary.expectedBatches, 0); assert.equal(summary.canConfigure, true);
    let request;
    const paused = formHarness(formProps(candidate, { onConfigure: plan => { request = plan; } }));
    let pausedTree = paused.render(); assert.ok(textOf(pausedTree).includes(summary.statusText));
    change(pausedTree, 'input', '4'); pausedTree = paused.render();
    assert.equal(submitButton(pausedTree).props.disabled, false); submit(pausedTree);
    assert.deepEqual(request, patch('kiln', 4));
  }
});
check('run and saved-plan keys reset drafts while stock day and unrelated rerenders preserve them', () => {
  const state = configured(), props = formProps(state), harness = formHarness(props);
  let tree = harness.render(); const initialKey = harness.key;
  change(tree, 'input', '17'); tree = harness.render();
  const newer = { ...state, day: state.day + 1, inventory: { ...state.inventory, clay: 1 } };
  tree = harness.render(formProps(newer));
  assert.equal(harness.key, initialKey); assert.equal(byType(tree, 'input').props.value, '17');
  const changedPlan = configured(newer, patch('weave', 8));
  tree = harness.render(formProps(changedPlan));
  assert.notEqual(harness.key, initialKey); assert.equal(byType(tree, 'select').props.value, 'weave');
  assert.equal(byType(tree, 'input').props.value, '8');
  const planKey = harness.key; change(tree, 'input', '23');
  tree = harness.render(formProps(configured(fresh('another-processing-run'), patch('weave', 8))));
  assert.notEqual(harness.key, planKey); assert.equal(byType(tree, 'input').props.value, '8');
});
check('actual artisan count and existing manual labor steppers remain authoritative', () => {
  const state = configured(), requested = [], tree = Tribe(tribeProps(state, {
    adjustTribeJob: (...args) => requested.push(args),
  }));
  const card = one(tree, node => node.type === 'article' && node.props.className.includes('primitive-processing-job'));
  const buttons = nodes(card, node => node.type === 'button');
  assert.equal(buttons.length, 2);
  assert.equal(textOf(one(card, node => node.props.className === 'primitive-job-stepper')), '2');
  assert.ok(textOf(card).includes('직접 배치 2명 · 자동 배치 0명'));
  assert.equal(buttons[0].props['aria-label'], '가공대 배치 1명 감소');
  assert.equal(buttons[1].props['aria-label'], '가공대 배치 1명 증가');
  buttons[0].props.onClick(); buttons[1].props.onClick();
  assert.deepEqual(requested, [['artisan', -1], ['artisan', 1]]);
  const adjusted = engine.adjustTribeJobAction(state, 'artisan', 1);
  assert.equal(engine.tribeSummary(adjusted).processing.workers, 3);
  assert.equal(adjusted.tribe.autoAssignments.artisan, 0);
});
check('current-stock preview displays actual assigned labor precise costs gains and batch overshoot', () => {
  const state = configured(), summary = engine.tribeSummary(state).processing;
  assert.equal(summary.expectedBatches, 2); assert.equal(summary.expectedOutput, 4);
  const tree = formHarness(formProps(state)).render(), text = textOf(tree);
  for (const expected of ['현재 비축 기준 전망', `실제 배치 ${summary.workers}명`, `현재 산출품 비축 ${summary.currentStock}개`,
    `예상 ${summary.expectedBatches}묶음`, `산출 ${summary.expectedOutput}개`, summary.costText, summary.outputText,
    summary.statusText, summary.timingText, '목표를 넘길 수']) assert.ok(text.includes(expected), expected);
  const fractional = configured(); fractional.inventory.pottery = 0.3;
  const fractionalSummary = engine.tribeSummary(fractional).processing;
  assert.equal(fractionalSummary.currentStock, 0.3);
  const fractionalTree = formHarness(formProps(fractional)).render();
  assert.ok(textOf(fractionalTree).includes('현재 산출품 비축 0.3개'));
  const unusable = configured(); unusable.inventory.pottery = -1;
  const unusableSummary = engine.tribeSummary(unusable).processing;
  assert.equal(unusableSummary.currentStock, null); assert.equal(unusableSummary.expectedBatches, 0);
  assert.equal(unusableSummary.canConfigure, true);
  let requested;
  const paused = formHarness(formProps(unusable, { onConfigure: plan => { requested = plan; } }));
  let pausedTree = paused.render();
  assert.ok(textOf(pausedTree).includes('현재 산출품 비축 확인 불가'));
  assert.ok(!textOf(pausedTree).includes('확인 불가개'));
  assert.ok(textOf(pausedTree).includes(unusableSummary.statusText));
  assert.equal(byType(pausedTree, 'select').props.disabled, false);
  change(pausedTree, 'input', '4'); pausedTree = paused.render();
  assert.equal(submitButton(pausedTree).props.disabled, false); submit(pausedTree);
  assert.deepEqual(requested, patch('kiln', 4)); assert.equal(unusable.inventory.pottery, -1);
});
check('actual historical receipt survives plan stock and labor edits and missing history stays missing', () => {
  const state = configured();
  const settled = engine.advanceDay({ ...state, ap: 0 }, { rng: () => 0.5 });
  const priorSummary = engine.tribeSummary(settled).processing;
  assert.ok(priorSummary.receipt); assert.ok(priorSummary.receipt.batches > 0);
  const receiptBefore = JSON.stringify(priorSummary.receipt);
  let changed = configured(settled, patch('weave', 9));
  changed = engine.adjustTribeJobAction(changed, 'artisan', -1);
  changed = { ...changed, inventory: { ...changed.inventory, pottery: 99 } };
  const currentSummary = engine.tribeSummary(changed).processing;
  assert.equal(JSON.stringify(currentSummary.receipt), receiptBefore);
  assert.equal(currentSummary.receiptText, priorSummary.receiptText);
  const tree = Tribe(tribeProps(changed));
  const ledger = one(tree, node => node.props.className === 'primitive-tribe-ledger');
  const receiptRow = one(ledger, node => node.props.className === 'primitive-processing-receipt');
  assert.equal(textOf(receiptRow), '직전 정산 실제 가공' + priorSummary.receiptText);
  const missing = { ...settled, tribe: { ...settled.tribe, lastProduction: { ...settled.tribe.lastProduction } } };
  delete missing.tribe.lastProduction.processing;
  const missingSummary = engine.tribeSummary(missing).processing;
  assert.equal(missingSummary.receipt, null);
  const missingRow = one(Tribe(tribeProps(missing)), node => node.props.className === 'primitive-processing-receipt');
  assert.equal(textOf(missingRow), '직전 정산 실제 가공' + missingSummary.receiptText);
  assert.notEqual(missingSummary.receiptText, priorSummary.receiptText);
});
check('actual page config handler uses shared feedback and changes only the saved plan without actor costs', () => {
  const state = selectedCasualty(); state.ap = 0;
  const before = clone(state), view = pageHarness(state);
  view.handler(patch());
  assert.deepEqual(view.ref.current.tribe.processingPlan, patch());
  assert.equal(view.ref.current.ap, state.ap); assert.deepEqual(view.ref.current.inventory, state.inventory);
  assert.deepEqual(view.ref.current.tribe.assignments, state.tribe.assignments);
  assert.equal(view.calls.state.length, 1); assert.equal(view.calls.feedback.length, 1);
  assert.ok(view.calls.result[0]); assert.deepEqual(state, before);
});
check('invalid identical unhydrated ended changed-plan old-form and old-run callbacks do not replace live plans', () => {
  for (const plan of [null, {}, patch('unknown', 4), patch('kiln', 0), patch('kiln', 1.5), patch('kiln', Number.MAX_SAFE_INTEGER + 1),
    patch('', 1), { ...patch(), workers: 1 }]) {
    const view = pageHarness(); view.handler(plan); assert.equal(view.calls.state.length, 0);
  }
  for (const [state, extra] of [[configured(), {}], [fresh(), { hydrated: false }], [{ ...fresh(), ended: true }, {}]]) {
    const view = pageHarness(state, extra); view.handler(patch()); assert.equal(view.calls.state.length, 0);
  }
  const view = pageHarness(); view.handler(patch()); const after = view.ref.current;
  view.handler(patch('weave', 8)); assert.equal(view.ref.current, after); assert.equal(view.calls.state.length, 1);
  const stale = pageHarness(); stale.ref.current = configured(stale.ref.current, patch('weave', 8));
  const changed = stale.ref.current; stale.handler(patch()); assert.equal(stale.ref.current, changed); assert.equal(stale.calls.state.length, 0);
  const oldRun = pageHarness(), form = formHarness(formProps(oldRun.scope.state, { onConfigure: oldRun.handler }));
  let tree = form.render(); change(tree, 'select', 'kiln'); tree = form.render();
  oldRun.ref.current = fresh('another-live-run'); submit(tree); assert.equal(oldRun.calls.state.length, 0);
});
check('actual page direct callbacks honor owner writer save load and shop guards without freezing a held writer', () => {
  for (const guard of [
    { checkpoint: { ready: false, exclusive: false, status: 'owner-unknown' } },
    { checkpoint: { ready: false, exclusive: false, status: 'loading' } },
    { checkpoint: { ready: true, exclusive: false, status: 'conflict' } },
    { busy: 'save' }, { busy: 'load' }, { shopControlsBusy: true }, { shopStartRef: { current: true } },
  ]) {
    const view = pageHarness(fresh(), guard), before = view.ref.current;
    view.handler(patch()); assert.equal(view.ref.current, before); assert.equal(view.calls.state.length, 0);
  }
  for (const status of ['conflict', 'unavailable', 'corrupt']) {
    const view = pageHarness(fresh(), { checkpoint: { ready: true, exclusive: true, status } });
    view.handler(patch()); assert.deepEqual(view.ref.current.tribe.processingPlan, patch());
    assert.equal(view.calls.state.length, 1);
  }
});
check('page props route the real state and atomic callback while CSS uses era tokens and responsive native controls', () => {
  const source = ts.createSourceFile('PrimitiveArchivePlayContent.js', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const tabs = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PrimitiveArchiveFeatureTabs') tabs.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source); assert.equal(tabs.length, 1);
  assert.match(tabs[0].getText(source), /configureTribeProcess=\{configureTribeProcess\}/);
  assert.match(tabs[0].getText(source), /state=\{state\}/);
  assert.match(tabs[0].getText(source), /busy=\{busy \|\| \(shopControlsBusy/);
  const parsed = postcss.parse(readFileSync(cssUrl, 'utf8')), rules = [];
  parsed.walkRules(rule => { if (rule.selector.includes('primitive-processing')) rules.push(rule); });
  const has = (prop, value) => rules.some(rule => rule.nodes.some(node => node.prop === prop && node.value.includes(value)));
  for (const [prop, value] of [['grid-template-columns', 'min(100%, 12rem)'], ['min-width', '0'],
    ['white-space', 'normal'], ['overflow-wrap', 'anywhere'], ['grid-column', '1 / -1']]) assert.ok(has(prop, value), prop);
  assert.ok(rules.some(rule => rule.selector.includes(':focus-visible')));
  for (const rule of rules) rule.walkDecls(node => {
    if (['color', 'background', 'border', 'border-color', 'outline'].includes(node.prop)) assert.ok(node.value.includes('var(--era-'), node.prop);
    assert.ok(!(node.prop === 'display' && node.value === 'none'));
  });
});

console.log(JSON.stringify({ pass: true, checks, mode: 'actual-source', generatedResultFiles: 0,
  scope: 'Actual JSX components, engine summaries, historical receipts, page AST handlers and CSS. Form hook returns and page UI setters are controlled inputs, not mounted React/checkpoint lifecycle. Native element props/callbacks only; no actual browser keyboard, geometry, storage lifecycle, full build or deployment acceptance.' }));
