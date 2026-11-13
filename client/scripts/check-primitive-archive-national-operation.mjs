import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import './lib/register-simulation-modules.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const ts = require('typescript');
const sourceRoot = process.env.PA_NATIONAL_SOURCE_ROOT;
const overriddenNames = new Set(['PrimitiveArchivePlayContent.js', 'PrimitiveArchiveTribeTab.js', 'PrimitiveArchiveFeatureTabs.js']);
function componentSource(url) {
  const name = path.basename(new URL(url).pathname);
  if (sourceRoot && overriddenNames.has(name)) {
    const candidates = [path.join(sourceRoot, name), path.join(sourceRoot, '_components', name),
      path.join(sourceRoot, 'client/src/app/games/primitive-archive/_components', name)];
    const selected = candidates.find(candidate => existsSync(candidate));
    assert.ok(selected, `Original source override must provide ${name}`);
    return readFileSync(selected, 'utf8');
  }
  return readFileSync(new URL(url), 'utf8');
}
const nextImage = require('next/image');
const imageKey = '__nationalOperationImage';
const previousImage = globalThis[imageKey];
globalThis[imageKey] = nextImage.default || nextImage;
const loader = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/image') return { url: `data:text/javascript,export default globalThis.${imageKey};`, shortCircuit: true };
    if (specifier.startsWith('next/')) return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(componentSource(url), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const engine = await import(new URL('_lib/primitiveArchiveEngine.js', base));
const data = await import(new URL('_lib/primitiveArchiveData.js', base));
const checkpointModule = await import(new URL('_lib/primitiveArchiveCheckpoint.js', base));
const feedback = await import(new URL('_lib/primitiveArchiveFeedback.js', base));
const soundtrack = await import(new URL('_lib/primitiveArchiveSoundtrack.js', base));
const { default: Tribe } = await import(new URL('_components/PrimitiveArchiveTribeTab.js', base));
const { default: Tabs } = await import(new URL('_components/PrimitiveArchiveFeatureTabs.js', base));
const { GameControlButton } = await import('../src/app/games/_components/GamePlayPrimitives.js');
const playSource = componentSource(new URL('_components/PrimitiveArchivePlayContent.js', base));
const checkpointSource = readFileSync(new URL('_hooks/usePrimitiveArchiveCheckpoint.js', base), 'utf8');
const clone = value => structuredClone(value);
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt,
  completedYears: state.calendar?.completedYears ?? null });
const jobs = selected => Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, selected[row.id] || 0]));

// Fresh controlled capability fixtures, not naturally earned unlocks or past runs.
function fresh(id = 'national-operation', annual = true) {
  let state = engine.createNewState({ runId: id, now: '2026-11-13T00:00:00.000Z', rng: () => 0.5 });
  state.research.completed = Object.fromEntries(data.TECH_TREE.map(row => [row.id, true]));
  state.civics.completed.STATE_WORKFORCE = true;
  state.camp = { ...state.camp, fireLevel: 3, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.tribe.population = 8;
  state.tribe.assignments = jobs({ forager: 4, builder: 4 });
  state.tribe.autoAssignments = jobs({});
  state.inventory = { ...state.inventory, berry: 200, wood: 50, stone: 50, fiber: 50, resin: 50, hide: 50 };
  const rival = engine.RIVAL_TRIBES[0];
  state.exploration.revealed[rival.homeRegionId] = true;
  state = engine.normalizeState(state);
  assert.equal(checkpointModule.isValidRunState(state), true);
  return annual ? engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears: 60 }) : state;
}
const withoutLog = state => { const value = clone(state); delete value.log; delete value.updatedAt; return value; };
function immutableAction(state, action) {
  const before = clone(state), next = action(state);
  assert.deepEqual(state, before, 'Actual engine action preserves its source.');
  assert.equal(checkpointModule.isValidRunState(next), true);
  return next;
}
function declaration(name, source = playSource) {
  const ast = ts.createSourceFile('play.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const found = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(found.length, 1, `Unique actual PlayContent declaration: ${name}`);
  return found[0];
}

// Real PlayContent declarations run against real engines. Only browser effects,
// React setters and ownership/lease scheduling are controlled by the harness.
function harness(state = fresh()) {
  const names = ['actionOwnerSession', 'applyAction', 'annualExpected', 'annualExpectedState', 'annualExpectedVersion',
    'annualExpectedSession', 'annualRequestIsCurrent', 'nationalRequestIsCurrent', 'selectNationalProject',
    'adjustNationalTribeJob', 'changeNationalTribeWorkPolicy', 'runNationalDiplomacy', 'runDiplomacy',
    'runSettlementYear', 'changeTribeWorkPolicy', 'annualControlsBlocked', 'annualYearControl'];
  const compiled = ts.transpileModule(names.map(name => declaration(name)).join('\n'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext },
  }).outputText;
  const calls = { states: [], feedback: [], actors: [], text: [] };
  const stateRef = { current: state }, actionVersionRef = { current: 0 }, actorSelectionRef = { current: state.party[0].id };
  const currentSession = { scope: 'auth:cookie:A', revision: 1, csrfToken: 'csrf-A' };
  const storageRefs = { mountedRef: { current: true }, readyRef: { current: true },
    activeOwnerRef: { current: 'A' }, desiredOwnerRef: { current: 'A' },
    writerLeasesRef: { current: new Map([['A', { status: 'held' }]]) }, useCallback: fn => fn };
  const canMutate = new Function(...Object.keys(storageRefs),
    `${declaration('hasWriterLease', checkpointSource)}\n${declaration('canMutate', checkpointSource)}\nreturn canMutate;`)(...Object.values(storageRefs));
  const checkpoint = { ready: true, exclusive: true, canMutate };
  const annual = engine.annualSettlementSummary(state);
  const annualUiGuardRef = { current: { hydrated: true, checkpoint, busy: false, shopControlsBusy: false } };
  const scope = { ...engine, ...feedback, ...soundtrack, React, GameControlButton,
    state, stateRef, actionVersionRef, actorSelectionRef, actorId: state.party[0].id,
    annual, annualMode: annual.annualMode, tribe: engine.tribeSummary(state), checkpoint, annualUiGuardRef,
    captureAuthSession: () => ({ ...currentSession }), isCurrentAuthSession: value => Boolean(value)
      && ['scope', 'revision', 'csrfToken'].every(key => value[key] === currentSession[key]),
    hydrated: true, busy: '', shopControlsBusy: false, shopStartRef: { current: false }, showDeveloperTools: false,
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: '',
    playGameSfx() {}, setMusicScene() {}, setArrivingEraId() {}, setMessage() {},
    setState: value => calls.states.push(value), setActorId: value => calls.actors.push(value),
    setActionResult: value => calls.text.push(value), setActionFeedback: value => calls.feedback.push(value) };
  const exported = ['selectNationalProject', 'adjustNationalTribeJob', 'changeNationalTribeWorkPolicy',
    'runNationalDiplomacy', 'runDiplomacy', 'runSettlementYear', 'changeTribeWorkPolicy', 'annualYearControl'];
  const view = new Function(...Object.keys(scope), `${compiled}\nreturn {${exported.join(',')}};`)(...Object.values(scope));
  return { ...view, scope, calls, stateRef, actionVersionRef, actorSelectionRef, checkpoint, storageRefs, currentSession, annualUiGuardRef };
}
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(text).join('');
function tribeProps(view, extra = {}) {
  const state = view.stateRef.current, actor = state.party[0];
  return { state, actor, actorId: actor.id, annual: engine.annualSettlementSummary(state),
    tribe: engine.tribeSummary(state), projects: engine.projectRows(state),
    rivals: engine.rivalTribeRows(state, actor.id), regions: [], hydrated: true, busy: false,
    utilityActions: engine.utilityActionRows(state, actor.id), canAct: state.ap > 0,
    selectNationalProject: view.selectNationalProject, runNationalDiplomacy: view.runNationalDiplomacy,
    adjustNationalTribeJob: view.adjustNationalTribeJob, changeNationalTribeWorkPolicy: view.changeNationalTribeWorkPolicy,
    runDiplomacy: view.runDiplomacy,
    changeTribeWorkPolicy: view.changeTribeWorkPolicy, annualYearControl: view.annualYearControl,
    nationalControlsBlocked: false, recentActionText: '', ...extra };
}

const priorWindow = globalThis.window;
const timeout = setTimeout(() => { console.error('FAIL national operation exceeded 45 seconds'); process.exitCode = 1; }, 45000);
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) {
    const category = /Unique actual PlayContent declaration|Actual feature routing|assert.ok\(button\)/.test(error.message)
      ? 'missing integration capability' : 'contract assertion';
    failures.push({ name, category, message: error.message });
    console.error(`FAIL ${name} [${category}]: ${error.stack}`);
  }
}
globalThis.window = { location: { href: 'http://localhost/national-operation-controlled' }, clearTimeout() {}, setTimeout() { return 1; } };
try {
  check('daily and annual policy/project selection are free intent, not production or body changes', () => {
    for (const annual of [false, true]) {
      const original = fresh(`free-${annual}`, annual);
      const project = engine.projectRows(original).find(row => row.available && !row.completed);
      assert.ok(project);
      const selected = immutableAction(original, s => engine.selectProjectAction(s, project.id));
      const planned = immutableAction(selected, s => engine.changeTribeWorkPolicyAction(s, 'construction'));
      for (const key of ['inventory', 'party', 'equipment', 'lineage', 'founderHistory']) assert.deepEqual(planned[key], original[key]);
      assert.equal(planned.day, original.day); assert.equal(planned.ap, original.ap);
      assert.deepEqual(planned.tribe.assignments, original.tribe.assignments);
      assert.equal(planned.tribe.productionSerial, original.tribe.productionSerial);
      assert.equal(planned.projects.selectedProjectId, project.id);
      assert.equal(planned.tribe.workPolicy, 'construction');
      assert.deepEqual(planned.calendar, original.calendar);
    }
  });
  check('locked and invalid management selections preserve economic and lineage state', () => {
    const locked = engine.normalizeState(engine.createNewState({ runId: 'locked-national', rng: () => 0.5 }));
    for (const action of [s => engine.changeTribeWorkPolicyAction(s, 'construction'),
      s => engine.changeTribeWorkPolicyAction(s, 'invalid'), s => engine.selectProjectAction(s, 'invalid')]) {
      const next = immutableAction(locked, action);
      assert.deepEqual(withoutLog(next), withoutLog(locked));
    }
  });
  check('the real annual project consumes catalog materials once and records actual work only on settlement', () => {
    const original = fresh('project-payment');
    const project = engine.projectRows(original).find(row => row.id === 'drying-rack');
    const selected = engine.selectProjectAction(original, project.id);
    assert.equal(selected.projects.resourceCommitted[project.id], false);
    const plan = engine.annualSettlementSummary(selected).plan;
    const next = immutableAction(selected, s => engine.runSettlementYearAction(s, stamp(s)));
    assert.equal(next.projects.resourceCommitted[project.id], true);
    assert.ok(next.projects.progress[project.id] > selected.projects.progress[project.id]);
    const receipt = next.tribe.lastProduction;
    assert.deepEqual(receipt.gains, plan.production);
    assert.ok(receipt.projectWork > 0);
    for (const [id, quantity] of Object.entries(project.cost)) {
      const reward = next.projects.completed[project.id] ? Number(project.reward?.[id] || 0) : 0;
      const expected = Number(selected.inventory[id] || 0) + Number(receipt.gains[id] || 0) - quantity
        + reward - Number(receipt.foodSpent?.[id] || 0) - Number(receipt.education?.spent?.[id] || 0)
        - Number(receipt.processing?.spent?.[id] || 0) + Number(receipt.processing?.gains?.[id] || 0);
      assert.equal(next.inventory[id], expected, `Physical project inventory ${id}`);
    }
    assert.equal(next.calendar.completedYears, 1);
    assert.deepEqual(next.equipment, original.equipment);
  });
  check('trade pays immediately once per annual period using catalog costs and rewards', () => {
    const state = fresh('trade'), actor = state.party[0].id, rival = engine.RIVAL_TRIBES[0];
    assert.equal(engine.rivalTribeRows(state, actor).find(row => row.id === rival.id).canTrade, true);
    const next = immutableAction(state, s => engine.runDiplomacyAction(s, actor, rival.id, 'trade'));
    assert.equal(next.ap, state.ap - 1); assert.equal(next.day, state.day);
    assert.equal(next.calendar.completedYears, 0);
    const ledger = { ...state.inventory };
    for (const [id, qty] of Object.entries(rival.tradeCost)) ledger[id] = Number(ledger[id] || 0) - qty;
    Object.entries(rival.tradeReward).forEach(([id, qty], i) => { ledger[id] = Number(ledger[id] || 0) + qty
      + (i === 0 && state.research.completed.FOREIGN_TRADE ? 1 : 0); });
    for (const id of new Set([...Object.keys(ledger), ...Object.keys(next.inventory)])) assert.equal(Number(next.inventory[id] || 0), Number(ledger[id] || 0));
    assert.equal(next.diplomacy.actionSerial, state.diplomacy.actionSerial + 1);
    assert.deepEqual(next.equipment, state.equipment);
    const twice = engine.runDiplomacyAction(next, actor, rival.id, 'trade');
    assert.deepEqual(withoutLog(twice), withoutLog(next));
    const newYear = engine.runSettlementYearAction(next, stamp(next));
    assert.equal(engine.rivalTribeRows(newYear, actor).find(row => row.id === rival.id).canTrade, true);
    const nextTrade = engine.runDiplomacyAction(newYear, actor, rival.id, 'trade');
    assert.equal(nextTrade.diplomacy.actionSerial, next.diplomacy.actionSerial + 1);
    assert.equal(nextTrade.calendar.completedYears, 1);
  });
  check('an unaffordable public target remains selectable but cannot fabricate payment or work', () => {
    const state = fresh('unfunded-project');
    state.inventory.wood = 0; state.inventory.fiber = 0;
    const project = engine.projectRows(state).find(row => row.id === 'drying-rack');
    assert.equal(project.available, true); assert.equal(project.hasCost, false);
    const selected = engine.selectProjectAction(state, project.id);
    assert.deepEqual(selected.inventory, state.inventory);
    const next = engine.runSettlementYearAction(selected, stamp(selected));
    assert.equal(next.projects.resourceCommitted[project.id], false);
    assert.equal(next.projects.progress[project.id], selected.projects.progress[project.id]);
    assert.equal(next.tribe.lastProduction.projectWork, 0);
  });
  check('unaffordable AP-zero unknown dead-actor and annual raid requests are atomic negatives', () => {
    const baseState = fresh('negative-trade'), rival = engine.RIVAL_TRIBES[0];
    const noStock = clone(baseState); noStock.inventory = Object.fromEntries(Object.keys(baseState.inventory).map(id => [id, 0]));
    const noAp = clone(baseState); noAp.ap = 0;
    for (const [state, actor, target, action] of [[noStock, noStock.party[0].id, rival.id, 'trade'],
      [noAp, noAp.party[0].id, rival.id, 'trade'], [baseState, 'missing-actor', rival.id, 'trade'],
      [baseState, baseState.party[0].id, 'missing-rival', 'trade'], [baseState, baseState.party[0].id, rival.id, 'raid']]) {
      const next = immutableAction(state, s => engine.runDiplomacyAction(s, actor, target, action));
      assert.deepEqual(withoutLog(next), withoutLog(state));
    }
  });
  check('AP-zero annual settlement remains available and an old stamp cannot settle twice', () => {
    const state = fresh('zero-ap'); state.ap = 0;
    const expected = stamp(state), next = immutableAction(state, s => engine.runSettlementYearAction(s, expected));
    assert.equal(next.calendar.completedYears, 1); assert.equal(next.ap, next.apMax);
    assert.equal(engine.runSettlementYearAction(next, expected), next);
  });
  check('legacy JSON and real checkpoint restores preserve plans original people equipment and trade period', () => {
    let state = fresh('restore-national');
    state = engine.changeTribeWorkPolicyAction(state, 'construction');
    state = engine.runDiplomacyAction(state, state.party[0].id, engine.RIVAL_TRIBES[0].id, 'trade');
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    assert.equal(checkpointModule.writeCheckpoint(storage, 'guest', state, { expectedRevision: 0 }).status, 'ready');
    const loaded = checkpointModule.readCheckpoint(storage, 'guest'); assert.equal(loaded.status, 'ready');
    const restored = engine.normalizeState(loaded.checkpoint.current);
    for (const key of ['tribe', 'inventory', 'projects', 'party', 'equipment', 'lineage', 'calendar', 'diplomacy', 'founderHistory']) assert.deepEqual(restored[key], state[key]);
    const old = clone(state); delete old.tribe.workPolicy; delete old.tribe.autoAssignments;
    const legacy = engine.normalizeState(JSON.parse(JSON.stringify(old)));
    assert.equal(legacy.tribe.workPolicy, 'balanced');
    for (const key of ['inventory', 'party', 'equipment', 'lineage', 'calendar', 'diplomacy', 'founderHistory']) assert.deepEqual(legacy[key], old[key]);
    const stored = new Map(values);
    storage.setItem = () => { throw new Error('controlled quota'); };
    assert.notEqual(checkpointModule.writeCheckpoint(storage, 'guest', restored, { expectedRevision: loaded.revision }).status, 'ready');
    assert.deepEqual(values, stored, 'A failed write cannot replace the saved original.');
  });
  check('actual Tribe and FeatureTabs callbacks select a free project once and invalidate old annual control', () => {
    const view = harness(), props = tribeProps(view);
    const target = props.projects.find(row => row.available && !row.selected && !row.completed);
    assert.ok(target);
    const tabs = Tabs({ ...props, activeTabId: 'tribe', archiveReport: { grade: '' },
      research: { unlocked: false }, civics: {}, inventoryRows: [], currentDifficulty: { label: '' }, setActiveTabId() {} });
    const routed = nodes(tabs, node => node.type === Tribe)[0];
    assert.ok(routed, 'Actual feature routing exposes the real Tribe component.');
    assert.equal(routed.props.selectNationalProject, view.selectNationalProject);
    const tree = Tribe(routed.props);
    const projectRow = nodes(tree, node => node.type === 'div' && text(node).includes(target.name))
      .find(node => nodes(node, child => child.type === GameControlButton && text(child) === '목표 지정').length);
    const button = nodes(projectRow, node => node.type === GameControlButton && text(node) === '목표 지정')[0];
    assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
    const before = clone(view.stateRef.current);
    button.props.onClick(); button.props.onClick();
    assert.equal(view.calls.states.length, 1);
    assert.equal(view.stateRef.current.projects.selectedProjectId, target.id);
    for (const key of ['inventory', 'party', 'equipment', 'lineage']) assert.deepEqual(view.stateRef.current[key], before[key]);
    assert.equal(view.stateRef.current.ap, before.ap);
    view.runSettlementYear();
    assert.equal(view.stateRef.current.calendar.completedYears, 0, 'Old displayed year control cannot settle after another action.');
  });
  check('actual national trade callback is immediate and repeated same-render clicks execute once', () => {
    const view = harness(), before = clone(view.stateRef.current), rival = engine.RIVAL_TRIBES[0];
    const button = nodes(Tribe(tribeProps(view)), node => node.type === GameControlButton && text(node) === '교역')[0];
    assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
    button.props.onClick(); button.props.onClick();
    assert.equal(view.calls.states.length, 1);
    const expected = engine.runDiplomacyAction(before, before.party[0].id, rival.id, 'trade');
    assert.deepEqual(withoutLog(view.stateRef.current), withoutLog(expected));
  });
  check('daily Tribe trade still dispatches the existing immediate daily action', () => {
    const state = fresh('daily-ui-trade', false), view = harness(state);
    const button = nodes(Tribe(tribeProps(view)), node => node.type === GameControlButton && text(node) === '교역')[0];
    assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
    button.props.onClick();
    const expected = engine.runDiplomacyAction(state, state.party[0].id, engine.RIVAL_TRIBES[0].id, 'trade');
    assert.deepEqual(withoutLog(view.stateRef.current), withoutLog(expected));
    assert.equal(view.stateRef.current.calendar?.mode === 'annual', false);
  });
  check('actual annual callback settles AP zero once despite duplicate same-render calls', () => {
    const state = fresh('zero-callback'); state.ap = 0;
    const view = harness(state); view.runSettlementYear(); view.runSettlementYear();
    assert.equal(view.calls.states.length, 1); assert.equal(view.stateRef.current.calendar.completedYears, 1);
  });
  check('actual annual policy and workforce controls apply their free effects once and reject stale renders', () => {
    for (const kind of ['policy', 'jobs']) {
      const view = harness(fresh(`national-${kind}`)), before = clone(view.stateRef.current);
      const tree = Tribe(tribeProps(view));
      const job = engine.TRIBE_JOBS.find(row => row.id === 'forager');
      const button = kind === 'policy'
        ? nodes(tree, node => node.type === 'button' && node.props['aria-describedby'] === 'primitive-work-policy-construction')[0]
        : nodes(tree, node => node.props?.['aria-label'] === `${job.name} 배치 1명 감소`)[0];
      assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
      button.props.onClick(); button.props.onClick();
      assert.equal(view.calls.states.length, 1);
      const expected = kind === 'policy' ? engine.changeTribeWorkPolicyAction(before, 'construction')
        : engine.adjustTribeJobAction(before, 'forager', -1);
      assert.deepEqual(withoutLog(view.stateRef.current), withoutLog(expected));
      assert.equal(view.stateRef.current.ap, before.ap); assert.equal(view.stateRef.current.calendar.completedYears, 0);
      for (const key of ['inventory', 'party', 'equipment', 'lineage']) assert.deepEqual(view.stateRef.current[key], before[key]);
    }
  });
  check('actual national controls reject stale plans actors runs owners sessions leases busy storage and ended states', () => {
    const changes = {
      plan: h => { h.stateRef.current = engine.selectProjectAction(h.stateRef.current, engine.TRIBE_PROJECTS[1].id); },
      year: h => { h.stateRef.current = engine.runSettlementYearAction(h.stateRef.current, stamp(h.stateRef.current)); },
      actor: h => { h.actorSelectionRef.current = h.stateRef.current.party[1].id; },
      run: h => { h.stateRef.current = fresh('replacement-run'); },
      owner: h => { h.currentSession.scope = 'auth:cookie:B'; },
      revision: h => { h.currentSession.revision++; }, csrf: h => { h.currentSession.csrfToken = 'new-csrf'; },
      lease: h => { h.storageRefs.writerLeasesRef.current.set('A', { status: 'busy' }); },
      storageOwner: h => { h.storageRefs.desiredOwnerRef.current = 'B'; },
      unmount: h => { h.storageRefs.mountedRef.current = false; },
      exclusive: h => { h.checkpoint.exclusive = false; },
      storage: h => { h.checkpoint.ready = false; }, busy: h => { h.annualUiGuardRef.current.busy = true; },
      shop: h => { h.annualUiGuardRef.current.shopControlsBusy = true; },
    };
    for (const [name, change] of Object.entries(changes)) {
      const h = harness(fresh(`guard-${name}`)); change(h);
      const before = clone(h.stateRef.current);
      h.selectNationalProject(engine.TRIBE_PROJECTS[1].id);
      h.adjustNationalTribeJob('forager', -1);
      h.changeNationalTribeWorkPolicy('construction');
      h.runNationalDiplomacy(engine.RIVAL_TRIBES[0].id, 'trade');
      assert.deepEqual(h.stateRef.current, before, name);
      assert.equal(h.calls.states.length, 0, name);
    }
    const ended = fresh('ended-national'); ended.ended = true;
    const view = harness(ended), before = clone(ended);
    view.selectNationalProject(engine.TRIBE_PROJECTS[1].id);
    view.adjustNationalTribeJob('forager', -1);
    view.changeNationalTribeWorkPolicy('construction');
    view.runNationalDiplomacy(engine.RIVAL_TRIBES[0].id, 'trade');
    assert.deepEqual(view.stateRef.current, before); assert.equal(view.calls.states.length, 0);
  });
} finally {
  clearTimeout(timeout);
  loader.deregister();
  globalThis.window = priorWindow;
  if (previousImage === undefined) delete globalThis[imageKey]; else globalThis[imageKey] = previousImage;
}
console.log(JSON.stringify({ passed, failed: failures.length,
  sourceMode: sourceRoot ? 'original source override' : 'current product',
  fixtureMode: 'Fresh controlled unlock/resource capability fixtures; not natural progression or a repeated 25-year run',
  failureCategories: failures.map(({ name, category }) => ({ name, category })),
  scope: 'Fresh controlled actual engine, actual JSX and extracted current callbacks; not mounted React/browser/human acceptance' }));
if (failures.length) process.exitCode = 1;
