import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const root = new URL('../', import.meta.url);
const file = relative => new URL(relative, root);
const componentUrl = file('src/app/games/primitive-archive/_components/PrimitiveArchiveProcessingPlan.js').href;
const tribeUrl = file('src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js').href;
const projectsUrl = file('src/app/games/primitive-archive/_components/PrimitiveArchiveProjectsPanel.js').href;
const playUrl = file('src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js');
const primitivesUrl = file('src/app/games/_components/GamePlayPrimitives.js').href;
const transformed = new Set([componentUrl, tribeUrl, projectsUrl, primitivesUrl,
  file('src/app/games/primitive-archive/_components/PrimitiveArchiveEducationPlan.js').href,
  file('src/app/games/_components/GameActionIcon.js').href,
  file('src/app/games/primitive-archive/_components/PrimitiveArchiveVisuals.js').href]);
globalThis.__processingTraditionReact = React;
const hooks = `export function useState(initial) {
  const harness = globalThis.__processingTraditionDraft;
  if (!harness) return globalThis.__processingTraditionReact.useState(initial);
  const index = harness.cursor++;
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
  return [harness.values[index], value => {
    harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value;
  }];
}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === componentUrl && specifier === 'react') {
      return { url: `data:text/javascript,${encodeURIComponent(hooks)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!transformed.has(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: ProcessingPlan, PrimitiveArchiveProcessingTradition: Reservation } = await import(componentUrl);
const { default: Tribe } = await import(tribeUrl);
const { default: Projects } = await import(projectsUrl);
const { GameControlButton } = await import(primitivesUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const feedback = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js');
const soundtrack = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js');
const clone = value => structuredClone(value);
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (node.type === GameControlButton) return nodes(GameControlButton(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
};
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const one = (tree, predicate) => { const found = nodes(tree, predicate); assert.equal(found.length, 1); return found[0]; };
const button = tree => one(tree, node => node.type === 'button');
const jobs = counts => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, counts[job.id] || 0]));
function fresh({ runId = 'processing-tradition-ui', giverIndex = 0 } = {}) {
  let state = engine.createNewState({ runId, difficulty: 'easy', now: '2026-11-05T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.inventory = { berry: 100, wood: 70, clay: 50, fiber: 30, stone: 50, resin: 10, pottery: 0 };
  state.weather = { id: 'clear', name: '검사 맑음', temp: 20, cold: 0, actionMod: 0 };
  state.tribe = { ...state.tribe, population: 4, assignments: jobs({ forager: 2, builder: 1, artisan: 1 }), autoAssignments: jobs({}) };
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true,
    CORDAGE: true, POTTERY: true, SETTLEMENT: true, FOOD_STORAGE: true };
  const giverId = state.party[giverIndex].id;
  for (let index = 0; index < 3; index++) state = engine.runCampAction(state, giverId, 'fuel', { rng: () => 0.5 });
  state = engine.ancestralRiteAction(state, giverId, giverId);
  state = engine.configureTribeProcessAction(state, { actionId: 'kiln', targetStock: 20 });
  assert.equal(state.ancestralFaith.active.remaining, 2);
  assert.equal(engine.processingTraditionSummary(state, giverId).canReserve, true);
  return state;
}
const reservationProps = (state, actorId = state.party[0].id, extra = {}) => ({
  tradition: engine.processingTraditionSummary(state, actorId), processing: engine.tribeSummary(state).processing,
  actor: state.party.find(actor => actor.id === actorId), hydrated: true, busy: '', ended: state.ended,
  onReserve() {}, ...extra,
});
const tribeProps = (state, actorId = state.party[0].id, extra = {}) => ({ state,
  actor: state.party.find(actor => actor.id === actorId), tribe: engine.tribeSummary(state), rivals: [], hydrated: true, busy: '',
  processingTradition: engine.processingTraditionSummary(state, actorId), projectTradition: engine.projectTraditionSummary(state, actorId),
  configureTribeProcess() {}, reserveProcessingTradition() {}, adjustTribeJob() {}, ...extra,
});
function projectProps(state, actorId = state.party[0].id) {
  const projects = engine.projectRows(state), selectedProject = projects.find(project => project.selected) || projects[0];
  return { projects, selectedProject, projectTradition: engine.projectTraditionSummary(state, actorId),
    projectEstimate: engine.projectActionEstimate(state, actorId, selectedProject.id), hydrated: true, ended: state.ended,
    canAct: true, reserveProjectTradition() {}, runProject() {}, selectProject() {} };
}
const markup = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const sourceText = readFileSync(playUrl, 'utf8');
const ast = ts.createSourceFile('PrimitiveArchivePlayContent.js', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function declaration(name) {
  const found = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(found.length, 1, name); return `const ${found[0].getText(ast)};`;
}
const compiled = ts.transpileModule(['setActorId', 'applyAction', 'reserveProjectTradition', 'reserveProcessingTradition']
  .map(declaration).join('\n'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
function page(state = fresh(), overrides = {}) {
  const actorId = state.party[0].id, ref = { current: state }, calls = { state: [], feedback: [], actor: [] };
  const scope = { ...engine, ...feedback, ...soundtrack, state, stateRef: ref, actorId,
    actorSelectionRef: { current: actorId }, useCallback: fn => fn,
    projectTradition: engine.projectTraditionSummary(state, actorId), processingTradition: engine.processingTraditionSummary(state, actorId),
    hydrated: true, checkpoint: { ready: true, exclusive: true, status: 'ready' }, busy: '', shopControlsBusy: false,
    shopStartRef: { current: false }, showDeveloperTools: false,
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    playGameSfx() {}, setMusicScene() {}, setArrivingEraId() {}, setMessage() {}, setActionResult() {},
    setState: value => calls.state.push(value), setActionFeedback: value => calls.feedback.push(value),
    setActorIdValue: value => calls.actor.push(value), ...overrides,
  };
  const result = new Function(...Object.keys(scope), `${compiled}\nreturn {reserveProjectTradition,reserveProcessingTradition,setActorId};`)(...Object.values(scope));
  const invoke = name => {
    const previousWindow = globalThis.window;
    globalThis.window = { clearTimeout() {}, setTimeout() { return 1; } };
    try { return result[name](); }
    finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
  };
  return { ...result, invoke, ref, calls, scope };
}
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
check('one sibling processing reservation group preserves the existing production form and ledger', () => {
  const state = fresh(), tree = Tribe(tribeProps(state));
  const card = one(tree, node => node.type === 'article' && node.props.className.includes('primitive-processing-job'));
  const plan = one(card, node => node.type === ProcessingPlan), reservation = one(card, node => node.type === Reservation);
  assert.equal(nodes(tree, node => node.type === Reservation).length, 1);
  assert.equal(nodes(plan, node => node.type === Reservation).length, 0);
  assert.equal(reservation.props.processing, plan.props.processing);
  const html = markup(Tribe, tribeProps(state));
  assert.equal((html.match(/<form\b/g) || []).length, 2);
  assert.equal((html.match(/<form\b[^>]*aria-label="가공대 생산 계획"/g) || []).length, 1);
  assert.equal((html.match(/<form\b[^>]*aria-label="공교육 교원 계획"/g) || []).length, 1);
  assert.ok(html.indexOf('저장된 가공 계획의 전승 예약') > html.indexOf('</form>'));
  assert.ok(html.includes('직전 정산 실제 가공')); assert.ok(html.includes('직전 운영 방침·배치'));
  const group = Reservation(reservation.props), native = button(group);
  assert.equal(native.props.type, 'button'); assert.equal(native.props.disabled, false);
  assert.equal(native.props['aria-describedby'], 'primitive-processing-tradition-conditions');
  assert.equal(nodes(group, node => node.props.id === native.props['aria-describedby']).length, 1);
});
check('native disclosure starts closed and exposes the shared reservation status without another form', () => {
  const state = fresh(), tree = Reservation(reservationProps(state));
  assert.equal(tree.type, 'details');
  assert.equal(tree.props.open, undefined);
  const summary = one(tree, node => node.type === 'summary');
  assert.match(textOf(summary), /가공대 전승 투자/);
  assert.match(textOf(summary), /전승 1회 예약 가능/);
  assert.equal(nodes(tree, node => node.type === 'form').length, 0);
  const reserved = engine.reserveProcessingTraditionAction(state, state.party[0].id);
  assert.match(textOf(one(Reservation(reservationProps(reserved)), node => node.type === 'summary')), /일차 가공 예약/);
});
check('actual provider executor shared uses paid materials timing and one-batch effect are readable', () => {
  const state = fresh(), props = reservationProps(state), text = textOf(Reservation(props));
  for (const expected of [props.tradition.founderName, props.tradition.executorName, props.tradition.modeLabel,
    props.tradition.costText, props.tradition.effectText, props.tradition.evidenceText,
    '실제 남은 횟수 2', '가마 굽기', '목표 비축 20개', '가공대 1명', '하루 한 건', '입력 중인 초안이 아닌']) assert.ok(text.includes(expected), expected);
  assert.ok(text.includes(props.processing.costText)); assert.ok(text.includes(props.processing.outputText));
  let deceased = fresh(); deceased.party[0].hp = 1;
  deceased = engine.runHuntAction(deceased, deceased.party[0].id, 'plains', { rng: () => 0.999999 });
  assert.equal(deceased.party[0].hp, 0);
  const executorId = deceased.party[1].id, deceasedProps = reservationProps(deceased, executorId);
  assert.equal(deceasedProps.tradition.modeLabel, '시조신의 가호');
  assert.equal(deceasedProps.tradition.canReserve, true);
  assert.notEqual(deceasedProps.tradition.founderName, deceasedProps.tradition.executorName);
  const deceasedText = textOf(Reservation(deceasedProps));
  assert.ok(deceasedText.includes('시조신의 가호'));
  assert.ok(deceasedText.includes(deceasedProps.tradition.executorName));
});
check('unsaved process drafts cannot silently become a reservation target or submit configuration', () => {
  const state = fresh(), view = page(state); let configureCalls = 0;
  const planElement = ProcessingPlan({ processing: engine.tribeSummary(state).processing, runId: state.runId,
    onConfigure() { configureCalls++; } });
  const draft = { cursor: 0, values: [] };
  const renderDraft = () => {
    draft.cursor = 0; globalThis.__processingTraditionDraft = draft;
    try { return planElement.type(planElement.props); } finally { delete globalThis.__processingTraditionDraft; }
  };
  let form = renderDraft();
  one(form, node => node.type === 'select').props.onChange({ target: { value: 'weave' } });
  form = renderDraft(); one(form, node => node.type === 'input').props.onChange({ target: { value: '9' } });
  form = renderDraft(); assert.equal(one(form, node => node.type === 'input').props.value, '9');
  const reservation = Reservation(reservationProps(state, state.party[0].id, { onReserve: () => view.invoke('reserveProcessingTradition') }));
  assert.ok(textOf(reservation).includes('가마 굽기 · 목표 비축 20개'));
  button(reservation).props.onClick();
  assert.equal(configureCalls, 0);
  assert.equal(view.ref.current.projectTradition.pending.actionId, 'kiln');
  assert.equal(view.ref.current.projectTradition.pending.targetStock, 20);
  assert.deepEqual(view.ref.current.tribe.processingPlan, { actionId: 'kiln', targetStock: 20 });
});
check('hydration shared persistence ended legacy missing handler and unavailable getters reject direct reservation callbacks', () => {
  const state = fresh(); let calls = 0;
  for (const extra of [{ hydrated: false }, { busy: 'save' }, { busy: 'load' }, { busy: 'checkpoint' }, { busy: 'shop-perks' },
    { ended: true }, { onReserve: undefined }, { tradition: { ...engine.processingTraditionSummary(state), canReserve: false, reason: '현재 유효한 가공 여지가 없습니다.' } },
    { tradition: { ...engine.processingTraditionSummary(state), enabled: false, canReserve: false, reason: '이전 저장은 비활성 상태입니다.' } }]) {
    const group = Reservation(reservationProps(state, state.party[0].id, { onReserve() { calls++; }, ...extra }));
    assert.equal(button(group).props.disabled, true); button(group).props.onClick();
  }
  assert.equal(calls, 0);
});
check('actual page reservation spends one existing use once and preserves personal costs and stock until settlement', () => {
  const state = fresh(), before = clone(state), view = page(state);
  view.invoke('reserveProcessingTradition');
  assert.equal(view.ref.current.projectTradition.pending.kind, 'processing');
  assert.equal(view.ref.current.ancestralFaith.active.remaining, 1);
  assert.equal(view.ref.current.ap, state.ap); assert.deepEqual(view.ref.current.inventory, state.inventory);
  assert.deepEqual(view.ref.current.party, state.party); assert.deepEqual(view.ref.current.counters, state.counters);
  const after = view.ref.current; view.invoke('reserveProcessingTradition'); view.invoke('reserveProjectTradition');
  assert.equal(view.ref.current, after); assert.equal(view.calls.state.length, 1); assert.equal(view.calls.feedback.length, 1);
  assert.deepEqual(state, before);
});
check('a project reservation blocks processing and a processing reservation is never shown as another project target', () => {
  const state = fresh(), project = page(state); project.invoke('reserveProjectTradition');
  const after = project.ref.current; project.invoke('reserveProcessingTradition'); assert.equal(project.ref.current, after);
  assert.equal(engine.processingTraditionSummary(after).canReserve, false);
  const processing = page(state); processing.invoke('reserveProcessingTradition');
  const props = projectProps(processing.ref.current), html = markup(Projects, props);
  assert.ok(html.includes('현재 공유 예약 · 가공대'));
  assert.ok(!html.includes('현재 선택 사업이 예약 대상과 다릅니다.'));
  assert.ok(!html.includes('undefined'));
  const projectReservation = one(Projects(props), node => node.type === 'button' && textOf(node).includes('다음 아침 건설에 전승 예약'));
  assert.equal(projectReservation.props.disabled, true);
});
check('old run day actor source process and target callbacks cannot reserve against newer displayed inputs', () => {
  for (const change of [
    view => { view.ref.current = fresh({ runId: 'different-run' }); },
    view => { view.ref.current = { ...view.ref.current, day: view.ref.current.day + 1 }; },
    view => { view.setActorId(view.scope.state.party[1].id); },
    view => { view.ref.current = fresh({ giverIndex: 1 }); },
    view => { view.ref.current = engine.configureTribeProcessAction(view.ref.current, { actionId: 'weave', targetStock: 20 }); },
    view => { view.ref.current = engine.configureTribeProcessAction(view.ref.current, { actionId: 'kiln', targetStock: 21 }); },
    view => { view.ref.current = { ...view.ref.current, ended: true }; },
  ]) {
    const view = page(); change(view); const current = view.ref.current;
    view.invoke('reserveProcessingTradition'); assert.equal(view.ref.current, current); assert.equal(view.calls.state.length, 0);
  }
  const actor = page(); actor.setActorId(actor.scope.state.party[1].id); actor.invoke('reserveProjectTradition');
  assert.equal(actor.calls.state.length, 0);
});
check('page callbacks retain all owner writer shop and save guards without freezing held-writer memory progress', () => {
  for (const guard of [{ hydrated: false }, { checkpoint: { ready: false, exclusive: false } },
    { checkpoint: { ready: true, exclusive: false, status: 'conflict' } }, { busy: 'save' }, { busy: 'load' },
    { shopControlsBusy: true }, { shopStartRef: { current: true } }]) {
    const view = page(fresh(), guard), current = view.ref.current;
    view.invoke('reserveProcessingTradition'); assert.equal(view.ref.current, current); assert.equal(view.calls.state.length, 0);
  }
  for (const status of ['conflict', 'unavailable', 'corrupt']) {
    const view = page(fresh(), { checkpoint: { ready: true, exclusive: true, status } });
    view.invoke('reserveProcessingTradition'); assert.equal(view.ref.current.projectTradition.pending.kind, 'processing');
  }
});
check('actual next-morning contribution and target-change expiry keep their original provider and saved target', () => {
  const state = fresh(), actorId = state.party[0].id;
  const reserved = engine.reserveProcessingTraditionAction(state, actorId);
  const pending = engine.processingTraditionSummary(reserved, actorId);
  assert.equal(pending.pending.actionId, 'kiln');
  const changed = engine.configureTribeProcessAction(reserved, { actionId: 'weave', targetStock: 9 });
  const changedText = textOf(Reservation(reservationProps(changed)));
  assert.ok(changedText.includes('방직 · 목표 비축 9개'));
  assert.ok(changedText.includes(pending.pendingText));
  const expired = engine.advanceDay({ ...changed, ap: 0 }, { rng: () => 0.5 });
  const expiredSummary = engine.processingTraditionSummary(expired, actorId);
  assert.equal(expiredSummary.lastSettlement.bonusBatches, 0);
  assert.ok(textOf(Reservation(reservationProps(expired))).includes(expiredSummary.lastSettlementText));
  const settled = engine.advanceDay({ ...reserved, ap: 0 }, { rng: () => 0.5 });
  const summary = engine.processingTraditionSummary(settled, actorId), before = clone(summary.lastSettlement);
  assert.equal(summary.lastSettlement.bonusBatches, 1); assert.equal(summary.records.length, 1);
  assert.ok(textOf(Reservation(reservationProps(settled))).includes(summary.records[0].text));
  const newer = engine.configureTribeProcessAction(settled, { actionId: 'weave', targetStock: 30 });
  assert.deepEqual(engine.processingTraditionSummary(newer).lastSettlement, before);
  assert.ok(textOf(Reservation(reservationProps(newer))).includes(summary.lastSettlementText));
});
check('ended pending status does not invent a settlement and project-only history is not credited to processing', () => {
  const state = fresh(), reserved = engine.reserveProcessingTraditionAction(state, state.party[0].id);
  const ended = { ...reserved, ended: true }, endedSummary = engine.processingTraditionSummary(ended);
  assert.equal(endedSummary.lastSettlement, null);
  assert.ok(textOf(Reservation(reservationProps(ended))).includes(endedSummary.pendingText));
  assert.ok(textOf(Reservation(reservationProps(ended))).includes('전승 정산 안내'));
  const project = engine.reserveProjectTraditionAction(state, state.party[0].id);
  const settledProject = engine.advanceDay({ ...project, ap: 0 }, { rng: () => 0.5 });
  const summary = engine.processingTraditionSummary(settledProject), group = Reservation(reservationProps(settledProject));
  assert.equal(summary.lastSettlement, null); assert.equal(summary.records.length, 0);
  assert.equal(nodes(group, node => node.props['aria-label'] === '가공에 남은 실제 시조 기여').length, 0);
  assert.ok(textOf(group).includes(summary.lastSettlementText));
});
check('page props and era styling connect to actual components without new forms or decorative controls', () => {
  const focusTabs = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'PrimitiveArchiveFeatureTabs') focusTabs.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(focusTabs.length, 1);
  assert.match(focusTabs[0].getText(ast), /processingTradition=\{processingTradition\}/);
  assert.match(focusTabs[0].getText(ast), /reserveProcessingTradition=\{reserveProcessingTradition\}/);
  const parsed = postcss.parse(readFileSync(file('src/styles/PrimitiveArchiveWorkPolicy.css'), 'utf8')), rules = [];
  parsed.walkRules(rule => { if (rule.selector.includes('primitive-processing-tradition')) rules.push(rule); });
  const has = (prop, value) => rules.some(rule => rule.nodes.some(node => node.prop === prop && node.value.includes(value)));
  for (const [prop, value] of [['min-width', '0'], ['overflow-wrap', 'anywhere'], ['white-space', 'normal'], ['grid-column', '1 / -1']]) assert.ok(has(prop, value), prop);
  assert.ok(rules.some(rule => rule.selector.includes(':focus-visible')));
  for (const rule of rules) rule.walkDecls(node => {
    if (['color', 'border', 'background', 'outline'].includes(node.prop)) assert.ok(node.value.includes('var(--era-'), node.prop);
  });
});
console.log(JSON.stringify({ pass: true, checks, generatedResultFiles: 0,
  scope: 'Actual processing/project/tribe JSX, actual engine getters/rites/reservations/day boundary, current page AST callbacks and CSS. Draft hook values and page setters are controlled; not mounted lifecycle, actual browser keyboard/layout, storage lifecycle, build or deployment acceptance.' }));
