import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const root = new URL('../', import.meta.url);
const tribeUrl = new URL('src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js', root).href;
const playUrl = new URL('src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js', root);
const cssUrl = new URL('src/styles/PrimitiveArchiveWorkPolicy.css', root);
const transformed = new Set([tribeUrl,
  new URL('src/app/games/primitive-archive/_components/PrimitiveArchiveVisuals.js', root).href,
  new URL('src/app/games/_components/GamePlayPrimitives.js', root).href,
  new URL('src/app/games/_components/GameActionIcon.js', root).href]);
registerHooks({
  load(url, context, nextLoad) {
    if (!transformed.has(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Tribe } = await import(tribeUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const fresh = () => engine.createNewState({ rng: () => 0.5, runId: 'work-policy-ui-fresh', now: '2026-11-01T00:00:00.000Z' });
const unlocked = () => {
  const state = fresh();
  return engine.normalizeState({ ...state, research: { ...state.research, completed: { ...state.research.completed, STATE_WORKFORCE: true } } });
};
const propsFor = (state, extra = {}) => ({ tribe: engine.tribeSummary(state), rivals: [], busy: false,
  actionFeedback: { action: 'primitive-job', label: '운영 방침 변경', tone: 'ready' }, recentActionText: '기존 최근 운영 결과',
  adjustTribeJob: () => {}, changeTribeWorkPolicy: () => {}, ...extra });
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const policyGroup = tree => nodes(tree, node => node.props?.['aria-label'] === '자동 일손 운영 방침')[0];
const policyButtons = tree => nodes(policyGroup(tree), node => node.type === 'button');
const policyButton = (tree, id) => policyButtons(tree).find(node => node.props['aria-describedby'] === 'primitive-work-policy-' + id);
const html = props => renderToStaticMarkup(React.createElement(Tribe, props));
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS ' + name); };

check('real engine summaries render the three choices inside the existing job panel with native selection semantics', () => {
  const state = freeze(unlocked()), before = JSON.stringify(state), props = propsFor(state), tree = Tribe(props);
  const panel = nodes(tree, node => node.type === 'section' && node.props.className.includes('primitive-job-panel'))[0];
  assert.ok(policyGroup(panel));
  assert.equal(nodes(tree, node => node.type === 'section').length, 3);
  assert.equal(policyButtons(tree).length, 3);
  assert.equal(policyButton(tree, 'balanced').props['aria-pressed'], true);
  assert.equal(policyButton(tree, 'balanced').props.disabled, true);
  assert.equal(policyButton(tree, 'construction').props.disabled, false);
  assert.equal(policyButton(tree, 'research').props.disabled, false);
  assert.equal(JSON.stringify(state), before);
});

check('policy choice is presentation and next-settlement intent, without promising immediate labor or new lineage effects', () => {
  const text = html(propsFor(unlocked()));
  for (const expected of ['AP', '다음', '지금 배치는 바뀌지', '직접 고정한 일손', '식량 확보']) assert.ok(text.includes(expected), expected);
  assert.ok(text.includes('기존 최근 운영 결과'));
});

check('locked ended busy missing callback and same-selection handlers cannot request policy changes', () => {
  for (const [state, extra] of [[fresh(), {}], [{ ...unlocked(), ended: true }, {}], [unlocked(), { busy: 'save' }],
    [unlocked(), { changeTribeWorkPolicy: undefined }]]) {
    let calls = 0; const props = propsFor(state, { changeTribeWorkPolicy: () => { calls += 1; }, ...extra });
    const tree = Tribe(props);
    for (const button of policyButtons(tree)) { assert.equal(button.props.disabled, true); button.props.onClick(); }
    assert.equal(calls, 0);
  }
  let calls = 0; const tree = Tribe(propsFor(unlocked(), { changeTribeWorkPolicy: () => { calls += 1; } }));
  policyButton(tree, 'balanced').props.onClick(); assert.equal(calls, 0);
});

check('AP-zero and injured representatives can choose policy while actual assignments and costs remain unchanged', () => {
  let state = unlocked(); state = { ...state, ap: 0, party: state.party.map(actor => ({ ...actor, hp: 1 })) };
  const before = { ap: state.ap, party: structuredClone(state.party), inventory: structuredClone(state.inventory),
    assignments: structuredClone(state.tribe.assignments), autoAssignments: structuredClone(state.tribe.autoAssignments), day: state.day,
    projectTradition: structuredClone(state.projectTradition), founderHistory: structuredClone(state.founderHistory), ancestralFaith: structuredClone(state.ancestralFaith) };
  const tree = Tribe(propsFor(state, { changeTribeWorkPolicy: id => { state = engine.changeTribeWorkPolicyAction(state, id); } }));
  policyButton(tree, 'construction').props.onClick();
  assert.equal(state.tribe.workPolicy, 'construction'); assert.equal(state.ap, before.ap); assert.deepEqual(state.party, before.party);
  assert.deepEqual(state.inventory, before.inventory); assert.deepEqual(state.tribe.assignments, before.assignments);
  assert.deepEqual(state.tribe.autoAssignments, before.autoAssignments); assert.equal(state.day, before.day);
  assert.deepEqual(state.projectTradition, before.projectTradition); assert.deepEqual(state.founderHistory, before.founderHistory);
  assert.deepEqual(state.ancestralFaith, before.ancestralFaith);
});

check('a pending policy explains unavailable real work without trapping the player in that selection', () => {
  let state = engine.changeTribeWorkPolicyAction(unlocked(), 'construction');
  const tribe = engine.tribeSummary(state);
  assert.ok(tribe.workPolicy.applicationBlockedReason);
  const tree = Tribe(propsFor(state, { changeTribeWorkPolicy: id => { state = engine.changeTribeWorkPolicyAction(state, id); } }));
  assert.ok(textOf(policyGroup(tree)).includes(tribe.workPolicy.applicationBlockedReason));
  assert.equal(policyButton(tree, 'balanced').props.disabled, false);
  policyButton(tree, 'balanced').props.onClick(); assert.equal(state.tribe.workPolicy, 'balanced');
});

check('the prior settlement policy and actual builder scholar counts remain independent of current policy and manual edits', () => {
  const state = unlocked(), initial = engine.tribeSummary(state);
  const receipt = freeze({ ...initial.lastProduction, workPolicy: 'construction', assignments: { builder: 2, scholar: 1 } });
  const before = JSON.stringify(receipt);
  for (const current of ['balanced', 'research']) {
    const option = initial.workPolicy.options.find(row => row.id === current);
    const tribe = { ...initial, productionSerial: 1, lastProduction: receipt,
      workPolicy: { ...initial.workPolicy, id: current, label: option.label },
      jobs: initial.jobs.map(job => ({ ...job, count: 0, manualCount: 0, autoCount: 0 })) };
    const text = html(propsFor(state, { tribe }));
    assert.ok(text.includes('직전 정산 당시 선택: 건설 우선 · 실제 건설 2명/기록 1명'));
    assert.ok(!text.includes('실제 적용방침')); assert.equal(JSON.stringify(receipt), before);
  }
});

check('old partial or unknown settlement receipts do not borrow current policy or worker counts', () => {
  const state = unlocked(), initial = engine.tribeSummary(state);
  for (const lastProduction of [{}, { workPolicy: 'construction' }, { assignments: { builder: 7, scholar: 8 } },
    { workPolicy: 'unknown', assignments: { builder: 7, scholar: 8 } },
    { workPolicy: 'research', assignments: { builder: -1, scholar: 8 } }]) {
    const text = html(propsFor(state, { tribe: { ...initial, productionSerial: 1, lastProduction } }));
    assert.ok(text.includes('방침·배치 미기록')); assert.ok(!text.includes('직전 정산 당시 선택:'));
  }
});

check('only already completed recorded project contributions appear as evidence and never as a policy unlock', () => {
  const records = freeze([
    { projectId: 'done', founderId: 'noa', completedDay: 40, appliedWork: 1, text: '탐사 표식망 · 노아의 실제 공동 작업 전승 1 · 40일차 완성' },
    { projectId: 'pending', founderId: 'hina', completedDay: 0, appliedWork: 2, text: '미완성 표본' },
    { projectId: 'zero', founderId: 'yuuka', completedDay: 41, appliedWork: 0, text: '기여 없는 표본' },
  ]);
  const props = propsFor(fresh(), { projectTradition: { records } }), text = html(props), tree = Tribe(props);
  assert.ok(text.includes(records[0].text)); assert.ok(!text.includes('미완성 표본')); assert.ok(!text.includes('기여 없는 표본'));
  assert.ok(text.includes('해금 조건이나 추가 효과가 아닙니다'));
  assert.ok(policyButtons(tree).every(button => button.props.disabled));
  assert.equal(nodes(policyGroup(Tribe(propsFor(unlocked()))), node => node.type === 'details').length, 0);
});

check('current and busy reasons remain source-derived and long text uses era tokens and responsive wrapping', () => {
  const state = unlocked(), tribe = engine.tribeSummary(state);
  const options = tribe.workPolicy.options.map(option => option.id === 'construction' ? { ...option, canSelect: false, blockedReason: '검증된 잠금 사유' } : option);
  const tree = Tribe(propsFor(state, { tribe: { ...tribe, workPolicy: { ...tribe.workPolicy, options } } }));
  assert.equal(policyButton(tree, 'construction').props.title, '검증된 잠금 사유');
  const css = postcss.parse(readFileSync(cssUrl, 'utf8'));
  const declarations = []; css.walkDecls(decl => declarations.push([decl.prop, decl.value]));
  assert.ok(declarations.some(([prop, value]) => prop === 'grid-template-columns' && value.includes('min(100%, 12rem)')));
  assert.ok(declarations.some(([prop, value]) => prop === 'min-width' && value === '0'));
  assert.ok(declarations.some(([prop, value]) => prop === 'white-space' && value === 'normal'));
  assert.ok(declarations.some(([prop, value]) => prop === 'overflow-wrap' && value === 'anywhere'));
  for (const [prop, value] of declarations.filter(([prop]) => ['color', 'background', 'border'].includes(prop))) assert.ok(value.includes('var(--era-'), prop);
});

check('the actual page handler routes through existing feedback and ignores a second old-render click or another run', () => {
  const sourceText = readFileSync(playUrl, 'utf8'), source = ts.createSourceFile('PrimitiveArchivePlayContent.js', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let initializer;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'changeTribeWorkPolicy') initializer = node.initializer; ts.forEachChild(node, visit); };
  visit(source); assert.ok(initializer);
  const state = unlocked(), tribe = engine.tribeSummary(state), ref = { current: state }; let calls = 0, label;
  const handler = new Function('tribe', 'state', 'stateRef', 'applyAction', 'tribeSummary', 'changeTribeWorkPolicyAction', `return ${initializer.getText(source)};`)(
    tribe, state, ref, (name, updater) => { calls += 1; label = name; ref.current = updater(ref.current); }, engine.tribeSummary, engine.changeTribeWorkPolicyAction);
  handler('construction'); assert.equal(calls, 1); assert.equal(label, '운영 방침 변경'); assert.equal(ref.current.tribe.workPolicy, 'construction');
  handler('construction'); assert.equal(calls, 1);
  ref.current = { ...state, runId: 'another-run' }; handler('research'); assert.equal(calls, 1);
  ref.current = { ...state, ended: true }; handler('research'); assert.equal(calls, 1);
  assert.match(sourceText, /changeTribeWorkPolicy=\{changeTribeWorkPolicy\}/);
  assert.match(sourceText, /projectTradition=\{projectTradition\}/);
});

console.log(JSON.stringify({ pass: true, checks, scope: 'Real tribe component SSR/native handlers and current engine inputs; page policy handler extracted from its current AST. No browser geometry, full page lifecycle, save API, build or human acceptance claim.' }));
