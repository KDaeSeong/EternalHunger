import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import './lib/register-simulation-modules.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const nextImage = require('next/image');
globalThis.__annualUiImage = nextImage.default || nextImage;
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const playSource = readFileSync(new URL('_components/PrimitiveArchivePlayContent.js', base), 'utf8');
const hookSource = readFileSync(new URL('_hooks/usePrimitiveArchiveCheckpoint.js', base), 'utf8');
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/image') return { url: 'data:text/javascript,export default globalThis.__annualUiImage;', shortCircuit: true };
  if (specifier.startsWith('next/')) return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
  return next(specifier, context);
}, load(url, context, next) {
  if (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js')) return next(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const engine = await import(new URL('_lib/primitiveArchiveEngine.js', base));
const calendar = await import(new URL('_lib/primitiveArchiveCalendar.js', base));
const feedback = await import(new URL('_lib/primitiveArchiveFeedback.js', base));
const soundtrack = await import(new URL('_lib/primitiveArchiveSoundtrack.js', base));
const { founderHistoryRows } = await import(new URL('_lib/primitiveArchiveFounders.js', base));
const { default: Focus } = await import(new URL('_components/PrimitiveArchiveFocusPanel.js', base));
const { default: Tabs } = await import(new URL('_components/PrimitiveArchiveFeatureTabs.js', base));
const { default: Camp } = await import(new URL('_components/PrimitiveArchiveCampWorkspace.js', base));
const { default: Founders } = await import(new URL('_components/PrimitiveArchiveFoundersTab.js', base));
const { default: Tribe } = await import(new URL('_components/PrimitiveArchiveTribeTab.js', base));
const { default: Inventory } = await import(new URL('_components/PrimitiveArchiveInventoryBar.js', base));
const { GameControlButton } = await import('../src/app/games/_components/GamePlayPrimitives.js');

// Actual current declarations, real engine and JSX. Scheduling/ownership inputs
// are controlled here; these checks are not mounted React or browser acceptance.
function declaration(source, name) {
  const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const found = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(found.length, 1, `actual declaration ${name}`); return found[0];
}
const names = ['actionOwnerSession', 'applyAction', 'annualExpected', 'annualExpectedState', 'annualExpectedVersion',
  'annualExpectedSession', 'annualRequestIsCurrent', 'startAnnualSettlement', 'runSettlementYear',
  'annualControlsBlocked', 'annualStartControl', 'annualYearControl', 'resetAutoDayGoal', 'replaceState', 'handleRestoredRun'];
names.push('runCamp', 'runUtility', 'prepareSuccessor');
const compiled = ts.transpileModule(names.map(name => declaration(playSource, name)).join('\n'), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext },
}).outputText;
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt,
  completedYears: state.calendar?.completedYears ?? null });
const fresh = (id = 'annual-ui-fresh', legacy = false) => {
  const state = engine.createNewState({ runId: id, now: '2026-11-12T00:00:00.000Z', rng: () => 0.5,
    ...(legacy ? { lineageMode: 'legacy' } : {}) });
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp.shelterLevel = 1; state.camp.workbenchLevel = 0;
  state.inventory = { ...state.inventory, berry: 100, wood: 100, stone: 100, fiber: 100 };
  state.tribe.population = 8;
  return state;
};
const annualState = (id, legacy = false) => { const state = fresh(id, legacy); return engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears: 60 }); };
const annualSummary = state => ({ ...engine.annualSettlementSummary(state), lineageMode: state.lineage.mode });
function harness(state = fresh(), overrides = {}) {
  const calls = { states: [], feedback: [], tabs: [], texts: [], actors: [], goals: [], reports: [], epochs: [] };
  const stateRef = { current: state }, actionVersionRef = { current: 0 };
  const session = { current: 1 };
  let held = true;
  const checkpoint = { ready: true, exclusive: true, canMutate: () => held };
  const annual = annualSummary(state);
  const scope = { ...engine, ...feedback, ...soundtrack, React, GameControlButton,
    useCallback: fn => fn, state, stateRef, actionVersionRef, annual, annualMode: annual.annualMode,
    captureAuthSession: () => ({ revision: session.current }), isCurrentAuthSession: value => value?.revision === session.current,
    autoDayGoalRef: { current: { id: 'exploration', epoch: 7, runId: state.runId, session: { revision: 0 } } },
    setAutoDayGoalId: value => calls.goals.push(value), setAutoDayReport: value => calls.reports.push(value),
    setAutoDayGoalEpoch: value => calls.epochs.push(value),
    hydrated: true, checkpoint, busy: '', shopControlsBusy: false, shopStartRef: { current: false },
    annualUiGuardRef: { current: { hydrated: true, checkpoint, busy: false, shopControlsBusy: false } },
    showDeveloperTools: false, actorId: state.party[0].id, musicSceneTimerRef: { current: null },
    canAct: !state.ended && state.ap > 0, utilityActions: engine.utilityActionRows(state, state.party[0].id),
    eraArrivalTimerRef: { current: null }, feedbackRef: { current: {} }, baseMusicScene: 'archive-camp',
    playGameSfx() {}, setMusicScene() {}, setArrivingEraId() {}, setMessage() {},
    setState: value => calls.states.push(value), setActionResult: value => calls.texts.push(value),
    setActionFeedback: value => calls.feedback.push(value), setActiveTabId: value => calls.tabs.push(value),
    setActorId: value => calls.actors.push(value), setRequirementHelpRequest() {}, setInitialShopRunId() {},
    setNewRunDifficulty() {}, setZoneId() {}, setRecipeId() {}, setSelectedRecruitId() {}, ...overrides };
  const view = new Function(...Object.keys(scope), `${compiled}\nreturn {${names.filter(name => ['applyAction', 'startAnnualSettlement', 'runSettlementYear', 'annualStartControl', 'annualYearControl', 'replaceState', 'handleRestoredRun', 'runCamp', 'runUtility', 'prepareSuccessor'].includes(name)).join(',')}};`)(...Object.values(scope));
  return { ...view, calls, scope, stateRef, actionVersionRef, session, lease: value => { held = value; } };
}
const priorWindow = globalThis.window;
globalThis.window = { location: { href: 'http://localhost/annual-ui-fixture' }, clearTimeout() {}, setTimeout() { return 1; } };
let passed = 0; const failures = [];
async function check(name, run) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.stack}`); }
}
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (node.type === GameControlButton) return nodes(GameControlButton(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
};
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(text).join('');
const lineageFor = state => {
  const lineage = engine.lineageSummary(state);
  return { ...lineage, rows: lineage.rows.map(row => ({ ...row, annual: calendar.annualPersonSummary(state, row.actorId) })) };
};
const focusPlan = { blocked: false, objective: { title: '개인 허기 위험', detail: '개인 밤 대비', targetTab: 'actions' }, night: { title: '이번 밤', rows: [], detail: '밤 피해', tone: 'danger' } };
try {
  await check('actual checkpoint live getter reads mounted ownership and the held lease without blocking memory progress', () => {
    const refs = { mountedRef: { current: true }, readyRef: { current: true }, activeOwnerRef: { current: 'A' }, desiredOwnerRef: { current: 'A' },
      writerLeasesRef: { current: new Map([['A', { status: 'held' }]]) }, useCallback: fn => fn };
    const source = [declaration(hookSource, 'hasWriterLease'), declaration(hookSource, 'canMutate')].join('\n');
    const getter = new Function(...Object.keys(refs), `${source}\nreturn canMutate;`)(...Object.values(refs));
    assert.equal(getter(), true);
    for (const name of ['mountedRef', 'readyRef']) { refs[name].current = false; assert.equal(getter(), false); refs[name].current = true; }
    refs.desiredOwnerRef.current = 'B'; assert.equal(getter(), false); refs.desiredOwnerRef.current = 'A';
    for (const status of ['pending', 'busy', 'released']) { refs.writerLeasesRef.current.set('A', { status }); assert.equal(getter(), false); }
    refs.writerLeasesRef.current.set('A', { status: 'held' }); assert.equal(getter(), true);
    refs.activeOwnerRef.current = null; assert.equal(getter(), false); refs.activeOwnerRef.current = 'A';
    assert.equal(getter(), true, 'a held writer still permits memory-only progress after a save problem');
  });
  await check('explicit actual transition has fixed 60-year policy and changes no time AP stock or personal state', () => {
    const state = fresh(), before = structuredClone(state), view = harness(state);
    assert.ok(view.annualStartControl); assert.equal(view.annualYearControl, null);
    view.startAnnualSettlement();
    const next = view.stateRef.current; assert.equal(next.calendar.observedLifetimeYears, 60);
    for (const key of ['day', 'ap', 'inventory', 'party', 'weather']) assert.deepEqual(next[key], before[key], key);
    assert.deepEqual(view.calls.tabs, ['tribe']); assert.equal(view.calls.states.length, 1);
    view.startAnnualSettlement(); assert.equal(view.calls.states.length, 1, 'same rendered callback cannot transition twice');
    assert.deepEqual(state, before);
  });
  await check('actual year callback advances at AP0 low stamina hunger100 morale0 and empty stock, then rejects a duplicate', () => {
    const state = annualState('annual-zero'); state.ap = 0; state.inventory = {}; state.tribe.morale = 0;
    state.party = state.party.map(member => ({ ...member, stamina: 0, hunger: 100 }));
    const view = harness(state); assert.equal(view.annualYearControl.props.disabled, false);
    view.runSettlementYear(); const next = view.stateRef.current;
    assert.equal(next.calendar.completedYears, 1); assert.equal(view.calls.states.length, 1);
    assert.match(view.calls.texts[0], /1년|1년차/);
    view.runSettlementYear(); assert.equal(view.stateRef.current, next); assert.equal(view.calls.states.length, 1);
  });
  await check('old callbacks refuse changed run mode year day AP stamp and an identical-object ABA restore', () => {
    const mutations = [state => ({ ...state, runId: 'different' }), state => ({ ...state, day: state.day + 1 }),
      state => ({ ...state, ap: state.ap - 1 }), state => ({ ...state, updatedAt: 'changed' }),
      state => ({ ...state, calendar: { ...state.calendar, completedYears: 1 } }), state => { const next = { ...state }; delete next.calendar; return next; }];
    for (const mutate of mutations) { const view = harness(annualState('stale')); const current = mutate(view.stateRef.current); view.stateRef.current = current; view.runSettlementYear(); assert.equal(view.stateRef.current, current); assert.equal(view.calls.states.length, 0); }
    const view = harness(annualState('aba')), original = view.stateRef.current;
    view.replaceState(annualState('another')); view.replaceState(original); const count = view.calls.states.length;
    view.runSettlementYear(); assert.equal(view.calls.states.length, count); assert.equal(view.stateRef.current, original);
  });
  await check('live owner lease bootstrap shop and save guards reject direct old callbacks', () => {
    for (const guard of [view => view.lease(false), view => { view.session.current++; },
      view => { view.scope.annualUiGuardRef.current.hydrated = false; }, view => { view.scope.annualUiGuardRef.current.busy = true; },
      view => { view.scope.annualUiGuardRef.current.shopControlsBusy = true; }, view => { view.scope.shopStartRef.current = true; },
      view => { view.scope.checkpoint.ready = false; }, view => { view.scope.checkpoint.exclusive = false; }]) {
      const view = harness(annualState('locked')); const before = view.stateRef.current; guard(view); view.runSettlementYear();
      assert.equal(view.stateRef.current, before); assert.equal(view.calls.states.length, 0);
    }
    const view = harness(annualState('common-owner')); view.session.current++; view.applyAction('old owner', state => ({ ...state, ap: 0 })); assert.equal(view.calls.states.length, 0);
  });
  await check('actual restore callback selects the annual operating tab and daily restores select actions', () => {
    const view = harness(); view.handleRestoredRun(annualState('restore'), { source: 'current' });
    assert.deepEqual(view.calls.tabs, ['tribe']);
    assert.deepEqual(view.scope.autoDayGoalRef.current, { id: 'default', epoch: 8, runId: 'restore', session: { revision: 1 } });
    assert.deepEqual(view.calls.goals, ['default']); assert.deepEqual(view.calls.reports, [null]);
    assert.deepEqual(view.calls.epochs, [8]);
    view.handleRestoredRun(fresh('daily'), { source: 'previous' }); assert.deepEqual(view.calls.tabs, ['tribe', 'actions']);
    assert.deepEqual(view.scope.autoDayGoalRef.current, { id: 'default', epoch: 9, runId: 'daily', session: { revision: 1 } });
    assert.deepEqual(view.calls.goals, ['default', 'default']); assert.deepEqual(view.calls.reports, [null, null]);
    assert.deepEqual(view.calls.epochs, [8, 9]);
  });
  await check('actual Focus replaces the night column with total census annual plan receipt and one year command', () => {
    const state = annualState('focus'), view = harness(state), annual = annualSummary(state);
    const html = render(Focus, { plan: focusPlan, annual, annualYearControl: view.annualYearControl });
    assert.match(html, /연간 공동체 운영/); assert.match(html, /함께 살아가는 인구/); assert.match(html, /시설 투자/);
    assert.match(html, /연간 실제 정산 전/); assert.match(html, /20년/); assert.match(html, /25년/); assert.match(html, /60년/);
    assert.doesNotMatch(html, /이번 밤|밤 피해|개인 허기 위험/);
    assert.equal((html.match(/aria-label="정착 1년 공동체 1년 운영"/g) || []).length, 1);
    const completed = engine.runSettlementYearAction(state, stamp(state));
    assert.match(render(Focus, { plan: focusPlan, annual: annualSummary(completed) }), /최근 실제 정산 · 정착 1년/);
    const legacy = annualState('legacy', true); const legacyHtml = render(Focus, { plan: focusPlan, annual: annualSummary(legacy) });
    assert.match(legacyHtml, /기존 생애 정책/); assert.doesNotMatch(legacyHtml, /관찰 생애 60년/);
  });
  await check('actual transition is primary only when ready and never silently converts a daily state', () => {
    const state = fresh(), view = harness(state);
    const html = render(Focus, { plan: focusPlan, annual: annualSummary(state), annualStartControl: view.annualStartControl });
    assert.match(html, /공동체 연간 운영으로 전환/); assert.match(html, /시간·행동력·자원을 쓰지/); assert.equal(state.calendar, undefined);
    const notReady = engine.createNewState({ rng: () => 0.5 });
    assert.doesNotMatch(render(Focus, { plan: focusPlan, annual: annualSummary(notReady) }), /공동체 연간 운영으로 전환/);
  });
  await check('ended annual JSX retains completed receipts without offering a future year or projection', () => {
    let state = annualState('ended-ui'); state = engine.runSettlementYearAction(state, stamp(state)); state = { ...state, ended: true };
    const view = harness(state); assert.equal(view.annualYearControl, null);
    const html = render(Focus, { plan: focusPlan, annual: annualSummary(state), annualYearControl: view.annualYearControl });
    assert.match(html, /정착 1년 정산 완료 · 운영 종료/); assert.match(html, /최근 실제 정산 · 정착 1년/);
    assert.doesNotMatch(html, /정착 2년|올해 생산·배식 전망|공동체 1년 운영/);
  });
  await check('actual tabs expose tribe growth founders and facilities while hiding personal action weather screens', () => {
    const state = annualState('tabs'), calls = [];
    const tree = Tabs({ annual: annualSummary(state), state, activeTabId: 'actions', archiveReport: { grade: '기록' }, research: { unlocked: false }, civics: {}, tribe: engine.tribeSummary(state), inventoryRows: [], partyCap: 3, currentDifficulty: {}, setActiveTabId: id => calls.push(id) });
    const buttons = nodes(tree, node => node.type === 'button');
    const ids = buttons.map(node => node.props.id);
    assert.ok(ids.includes('primitive-archive-tab-camp')); assert.ok(ids.includes('primitive-archive-tab-tribe'));
    for (const id of ['actions', 'party', 'inventory']) assert.ok(!ids.includes('primitive-archive-tab-' + id));
    assert.deepEqual(ids.slice(0, 3), ['primitive-archive-tab-tribe', 'primitive-archive-tab-growth', 'primitive-archive-tab-founders']);
    const facility = buttons.find(node => node.props.id === 'primitive-archive-tab-camp'); assert.match(text(facility), /시설 투자/);
    facility.props.onClick({ currentTarget: { closest: () => null } }); assert.deepEqual(calls, ['camp']);
  });
  await check('actual facilities preserve workbench access without personal fire cooking or overnight reports', () => {
    const state = annualState('facilities'), annual = annualSummary(state), calls = [];
    const props = { annual, state, canAct: true, actor: state.party[0], campActions: engine.campActionRows(state), campFacilities: engine.campFacilityRows(state), runCamp: id => calls.push(id), regions: [] };
    const html = render(Camp, props); assert.match(html, /공동체 시설 투자/); assert.match(html, /작업대/);
    assert.doesNotMatch(html, /불 피우기|연료 보충|요리|남은 생존|밤을 지내/);
    const controls = nodes(Camp(props), node => node.type?.name === 'CampActionControl');
    const workbench = controls.find(node => node.props.action.id === 'workbench');
    assert.ok(workbench); assert.equal(workbench.props.canAct, true); workbench.props.onClick(); assert.deepEqual(calls, ['workbench']);
  });
  await check('actual page facility management and successor callbacks retain real costs without annual personal exhaustion', () => {
    const state = annualState('actual-management'); state.party = state.party.map(member => ({ ...member, stamina: 0, hunger: 100 }));
    const view = harness(state); view.runCamp('workbench');
    assert.equal(view.stateRef.current.camp.workbenchLevel, 1); assert.equal(view.stateRef.current.ap, state.ap - 1);
    assert.equal(view.stateRef.current.inventory.wood, state.inventory.wood - 4);
    assert.equal(view.stateRef.current.inventory.stone, state.inventory.stone - 2);
    assert.deepEqual(view.stateRef.current.party, state.party);
    const prepared = harness(annualState('actual-preparation')); prepared.prepareSuccessor(prepared.stateRef.current.party[0].id);
    assert.equal(prepared.stateRef.current.lineage.prepared.length, 1);
    const unlocked = annualState('actual-utility');
    unlocked.party = unlocked.party.map(member => ({ ...member, stamina: 0, hunger: 100 }));
    unlocked.research.completed = Object.fromEntries(engine.TECH_TREE.map(row => [row.id, true]));
    unlocked.inventory = Object.fromEntries(Object.keys(engine.ITEMS).map(id => [id, 50]));
    const utilityView = harness(unlocked);
    const action = utilityView.scope.utilityActions.find(row => row.available && !['patrol', 'drill', 'treatment', 'season_plan', 'irrigation', 'road'].includes(row.id));
    assert.ok(action, 'a real unlocked management action is executable');
    utilityView.runUtility(action.id);
    assert.equal(utilityView.stateRef.current.ap, unlocked.ap - 1);
    assert.equal(utilityView.stateRef.current.day, unlocked.day);
    assert.deepEqual(utilityView.stateRef.current.party.map(row => [row.stamina, row.hunger]), unlocked.party.map(row => [row.stamina, row.hunger]));
  });
  await check('actual tribe exposes management actor selection and useful actions while hiding personal raid and night forecasts', () => {
    const state = annualState('tribe'), ids = [], actors = [];
    const props = { annual: annualSummary(state), state, hydrated: true, canAct: true, actor: state.party[0], actorId: state.party[0].id, setActorId: id => actors.push(id), tribe: engine.tribeSummary(state), utilityActions: engine.utilityActionRows(state, state.party[0].id), runUtility: id => ids.push(id), regions: [], rivals: [] };
    const html = render(Tribe, props); assert.match(html, /관리 담당/); assert.match(html, /공동체 관리/); assert.doesNotMatch(html, /오늘 저녁|다음 날 부족 배식|부족 전용 식량 전망\(2일\)|약탈/);
    const tree = Tribe(props), select = nodes(tree, node => node.type === 'select')[0]; select.props.onChange({ target: { value: state.party[1].id } }); assert.deepEqual(actors, [state.party[1].id]);
    const buttons = nodes(tree, node => node.type === 'button' && node.props.onClick && text(node).includes('실행'));
    assert.ok(buttons.length > 0, 'real utility controls remain discoverable');
  });
  await check('actual founders show observed/service years and prepared people without relabeling old cycles', () => {
    let state = annualState('people'); state = engine.prepareSuccessorAction(state, state.party[0].id);
    assert.ok(state.lineage.prepared.length > 0, 'real preparation creates a visible household member');
    const html = render(Founders, { state, annual: annualSummary(state), lineage: lineageFor(state), foundersRows: [], ancestralRows: [] });
    assert.match(html, /관찰 0년/); assert.match(html, /활동 0년/); assert.match(html, /준비된 후계 · 1명/); assert.doesNotMatch(html, /게임상 활동기 \d+기/);
    const inventory = render(Inventory, { inventory: state.inventory, inventoryRows: Object.entries(state.inventory) }); assert.match(inventory, /전체 보유품/);
  });
  await check('restored supported 80-year and no-natural-end calendars display their actual policy in the real JSX', () => {
    for (const lifetime of [80, null]) {
      const input = fresh('restored-policy-' + String(lifetime));
      const state = engine.normalizeState(JSON.parse(JSON.stringify(engine.startAnnualSettlementAction(input, stamp(input), { observedLifetimeYears: lifetime }))));
      const annual = annualSummary(state);
      const focus = render(Focus, { plan: focusPlan, annual });
      const founders = render(Founders, { state, annual, lineage: lineageFor(state), foundersRows: [], ancestralRows: [] });
      const expected = lifetime === null ? /자동 생애 종료 없음/ : /관찰 생애 80년/;
      assert.match(focus, expected); assert.match(founders, expected);
      assert.doesNotMatch(focus, /관찰 생애 60년/); assert.doesNotMatch(founders, /관찰 생애 60년/);
    }
  });
  await check('real archival JSX keeps pre-transition and boundary days while displaying later annual records as years', () => {
    const input = fresh('record-date'); input.day = 10;
    let state = engine.startAnnualSettlementAction(input, stamp(input), { observedLifetimeYears: 60 });
    state = engine.runSettlementYearAction(state, stamp(state)); state = engine.runSettlementYearAction(state, stamp(state));
    // Controlled archive props exercise date presentation, not a fabricated game death.
    const rows = founderHistoryRows(state).slice(0, 1).map(row => ({ ...row, firstObservedDay: 11,
      recentDeeds: [{ day: 9, kind: 'project' }, { day: 10, kind: 'project' }, { day: 11, kind: 'project' }],
      deathRecord: { day: 12, source: 'natural', reason: '기록 표시 표본' } }));
    const html = render(Founders, { state, annual: annualSummary(state), lineage: lineageFor(state), foundersRows: rows, ancestralRows: [] });
    assert.match(html, /9일차/); assert.match(html, /10일차/); assert.match(html, /정착 1년차/); assert.match(html, /정착 2년차/);
    assert.doesNotMatch(html, /11일차|12일차/);
  });
} finally {
  delete globalThis.__annualUiImage;
  if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
}
console.log(`RESULT ${passed}/${passed + failures.length} passed; ${failures.length} failed; actual JSX/public callbacks, controlled ownership; browser and human acceptance remain separate`);
if (failures.length) process.exitCode = 1;
