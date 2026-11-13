import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import './lib/register-simulation-modules.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const nextImage = require('next/image');
const previousImage = globalThis.__foodOutlookImage;
globalThis.__foodOutlookImage = nextImage.default || nextImage;
const loader = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/image') return { url: 'data:text/javascript,export default globalThis.__foodOutlookImage;', shortCircuit: true };
    if (specifier.startsWith('next/')) return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const engine = await import(new URL('_lib/primitiveArchiveEngine.js', base));
const data = await import(new URL('_lib/primitiveArchiveData.js', base));
const checkpointModule = await import(new URL('_lib/primitiveArchiveCheckpoint.js', base));
const { primitiveArchiveFoodOutlook } = await import(new URL('_lib/primitiveArchiveFoodOutlook.js', base));
const { primitiveArchiveFocusPlan } = await import(new URL('_lib/primitiveArchiveFocus.js', base));
const { default: Food } = await import(new URL('_components/PrimitiveArchiveFoodOutlook.js', base));
const { default: Focus } = await import(new URL('_components/PrimitiveArchiveFocusPanel.js', base));
const playSource = readFileSync(new URL('_components/PrimitiveArchivePlayContent.js', base), 'utf8');
const clone = value => structuredClone(value);
const jobs = counts => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, counts[job.id] || 0]));

// Fresh prepared capability fixtures, not old reports or naturally earned runs.
function fixture(id = 'food-outlook', counts = { builder: 4 }) {
  let state = engine.createNewState({ runId: id, difficulty: 'normal', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5 });
  for (const tech of ['GATHERING', 'SETTLEMENT', 'FOOD_STORAGE']) state.research.completed[tech] = true;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { cooked_meat: 1, wood: 20 };
  state.tribe.population = 4; state.tribe.assignments = jobs(counts); state.tribe.autoAssignments = jobs({});
  state.party = state.party.map(member => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  state = engine.normalizeState(state);
  assert.equal(checkpointModule.isValidRunState(state), true);
  return state;
}
function declaration(name) {
  const ast = ts.createSourceFile('play.js', playSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const found = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(found.length, 1, `Actual page declaration ${name}`); return found[0];
}
function pageInventory(state) {
  return new Function('state', 'itemName', `${declaration('inventoryRows')}\nreturn inventoryRows;`)(state, engine.itemName);
}
function modelInput(state) {
  return { supplies: engine.survivalSupplySummary(state), inventoryRows: pageInventory(state),
    ready: true, ended: state.ended, annualMode: state.calendar?.mode === 'annual' };
}
function focusInput(state, { ready = true, busy = false } = {}) {
  const supplies = engine.survivalSupplySummary(state), nightRows = engine.nightSurvivalRows(state);
  const plan = primitiveArchiveFocusPlan({ state, supplies, nightRows, research: engine.researchSummary(state),
    campActions: engine.campActionRows(state), archiveVictory: engine.archiveVictorySummary(state), ready, busy });
  return { plan, operations: engine.settlementOperationsSummary(state),
    annual: { ...engine.annualSettlementSummary(state), lineageMode: state.lineage.mode },
    inventoryRows: pageInventory(state), ready, ended: state.ended };
}
function actualPageFocusProps(state) {
  const ast = ts.createSourceFile('play.js', playSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const found = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'PrimitiveArchiveFocusPanel') found.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(found.length, 1);
  const inputs = focusInput(state);
  const scope = { React, PrimitiveArchiveFocusPanel: Focus, focusPlan: inputs.plan, operations: inputs.operations,
    annual: inputs.annual, annualMode: inputs.annual.annualMode, inventoryRows: inputs.inventoryRows, state,
    checkpoint: { ready: true }, settlementDayControl: null, selectArchiveTab() {}, openCompletionHelp() {},
    completionHelpBlocked: false, annualStartControl: null, annualYearControl: null };
  const compiled = ts.transpileModule(`const node = (${found[0]});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(scope), `${compiled}\nreturn node.props;`)(...Object.values(scope));
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const cardCount = html => (html.match(/aria-label="식량과 배식 전망"/g) || []).length;
const originalRandom = Math.random;
const timeout = setTimeout(() => { console.error('FAIL food outlook exceeded 45 seconds'); process.exitCode = 1; }, 45000);
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.stack}`); }
}
try {
  check('one real cooked food item remains one item but provides two indivisible ration units', () => {
    const state = fixture(), input = modelInput(state), outlook = primitiveArchiveFoodOutlook(input);
    assert.equal(data.ITEMS.cooked_meat.type, 'food');
    assert.deepEqual(outlook.current.foodItems, [{ id: 'cooked_meat', name: data.ITEMS.cooked_meat.name, quantity: 1 }]);
    assert.equal(outlook.current.foodCount, 1); assert.equal(outlook.current.rationStock, 2); assert.equal(outlook.current.rationNeed, 1);
    assert.equal(outlook.party.nutrition, 0, 'The whole shared ration leaves no fraction for personal nutrition.');
    assert.equal(outlook.morning.provided, 2); assert.equal(outlook.morning.need, 1); assert.equal(outlook.morning.reserve, 0);
    assert.equal(outlook.morning.shortage, 0);
    const html = render(Food, { outlook });
    assert.match(html, /식품 1개/); assert.match(html, /공동 배식 재고 2단위/);
    assert.match(html, /제공 2/); assert.match(html, /배식 후 비축 0단위/);
    assert.ok(html.includes(data.ITEMS.cooked_meat.name));
  });
  check('all held canonical food item counts and real summaries retain separate unit domains', () => {
    const state = fixture('all-food');
    state.inventory = Object.fromEntries(Object.entries(data.ITEMS).filter(([, item]) => item.type === 'food').map(([id]) => [id, 1]));
    state.inventory.wood = 99;
    const input = modelInput(state), outlook = primitiveArchiveFoodOutlook(input);
    const expected = input.inventoryRows.filter(([id]) => data.ITEMS[id]?.type === 'food');
    assert.equal(outlook.current.foodCount, expected.length);
    assert.deepEqual(outlook.current.foodItems.map(row => [row.id, row.quantity]), expected);
    assert.equal(outlook.current.rationStock, input.supplies.rationStock);
    assert.deepEqual(outlook.party, { need: input.supplies.partyNeed, nutrition: input.supplies.partyNutrition, shortage: input.supplies.foodShortage });
    assert.notEqual(outlook.current.foodCount, outlook.current.rationStock);
  });
  check('next-morning food production never erases current evening nutrition shortage or actual night danger', () => {
    const state = fixture('future-not-tonight', { forager: 4 }); state.inventory = { wood: 20 };
    state.party[0].hunger = 95;
    const input = modelInput(state), outlook = primitiveArchiveFoodOutlook(input);
    assert.equal(outlook.current.foodCount, 0); assert.equal(outlook.party.nutrition, 0); assert.ok(outlook.party.shortage > 0);
    assert.ok(outlook.morning.produced > 0); assert.equal(outlook.morning.shortage, 0);
    assert.ok(engine.nightSurvivalRows(state).some(row => row.id === state.party[0].id && row.hungerDamage > 0));
    const html = render(Food, { outlook }); assert.match(html, /다음 아침 생산은 현재 밤에 쓸 수 없습니다/);
    assert.equal(outlook.party.shortage, input.supplies.foodShortage);
  });
  check('a real project reward can improve actual morning rations without being fabricated in the fixed preview', () => {
    const state = fixture('reward-exclusion'); state.inventory = { wood: 3, fiber: 2 };
    const project = engine.TRIBE_PROJECTS.find(row => row.id === 'drying-rack');
    state.projects.selectedProjectId = project.id; state.projects.progress[project.id] = project.work - 1;
    const input = modelInput(state), outlook = primitiveArchiveFoodOutlook(input), before = clone(state);
    assert.equal(outlook.morning.provided, 0); assert.ok(outlook.morning.shortage > 0);
    const next = engine.advanceDay(state, { rng: () => 0.5 });
    assert.deepEqual(state, before); assert.equal(next.projects.completed[project.id], true);
    assert.ok(project.reward.jerky > 0); assert.ok(next.tribe.lastProduction.foodProvided > outlook.morning.provided);
    assert.match(outlook.notes.exclusions, /사업 완성 보상/);
  });
  check('missing unknown numbers remain unknown while real zero and AP zero stay readable', () => {
    const state = fixture('unknown'), input = modelInput(state); state.ap = 0;
    assert.ok(primitiveArchiveFoodOutlook(modelInput(state)));
    const unknown = { ...input, inventoryRows: undefined, supplies: { ...input.supplies,
      rationStock: undefined, partyNeed: NaN, partyNutrition: null, foodShortage: '0', forecast: undefined } };
    const outlook = primitiveArchiveFoodOutlook(unknown);
    assert.equal(outlook.current.foodCount, null); assert.deepEqual(outlook.current.foodItems, []);
    assert.equal(outlook.current.rationStock, null); assert.equal(outlook.party.need, null);
    assert.equal(outlook.party.nutrition, null); assert.equal(outlook.party.shortage, null); assert.equal(outlook.morning, null);
    const html = render(Food, { outlook }); assert.match(html, /확인 필요/); assert.match(html, /전망을 확인할 수 없습니다/);
    assert.equal(primitiveArchiveFoodOutlook({ ...input, inventoryRows: [] }).current.foodCount, 0);
    assert.equal(primitiveArchiveFoodOutlook({ ...input, inventoryRows: [['berry', 'unknown']] }).current.foodCount, null);
    const unknownCare = primitiveArchiveFoodOutlook({ ...input, supplies: { ...input.supplies,
      careUnlocked: undefined, careActive: 'false', forecast: { days: [{ need: 1, shortage: NaN }] } } });
    assert.equal(unknownCare.care.unlocked, null); assert.equal(unknownCare.care.active, null);
    assert.equal(unknownCare.morning.need, 1); assert.equal(unknownCare.morning.stock, null);
    assert.equal(unknownCare.morning.shortage, null);
  });
  check('projection excludes annual ended not-ready and missing supplies instead of mixing personal and census food', () => {
    const state = fixture('mode-guards'), input = modelInput(state);
    for (const override of [{ ready: false }, { ended: true }, { annualMode: true }, { supplies: null }]) assert.equal(primitiveArchiveFoodOutlook({ ...input, ...override }), null);
    const annual = engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day, ap: state.ap,
      updatedAt: state.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
    assert.equal(primitiveArchiveFoodOutlook(modelInput(annual)), null);
    assert.equal(render(Food, { outlook: primitiveArchiveFoodOutlook(input), annualMode: true }), '');
  });
  check('actual page JSX passes actual inventory rows readiness and ended state into the real Focus panel', () => {
    const state = fixture('page-wiring'), props = actualPageFocusProps(state);
    assert.deepEqual(props.inventoryRows, pageInventory(state)); assert.equal(props.ready, true); assert.equal(props.ended, false);
    assert.equal(props.plan.supplies.rationStock, engine.survivalSupplySummary(state).rationStock);
    const html = render(Focus, props); assert.equal(cardCount(html), 1);
    assert.match(html, /<dt[^>]*>[^<]*보유 식품[^<]*저녁 관리 전[^<]*<\/dt>/);
    assert.match(html, /<dd[^>]*>식품 1개 · 공동 배식 재고 2단위/);
    for (const label of ['대원 저녁 식사 · 관리 전', '다음 아침 · 현재 배치 고정 전망']) assert.ok(html.includes(label), label);
  });
  check('actual Focus derives outlook from its real supplies without hiding existing night risks or showing invalid modes', () => {
    const state = fixture('focus-integration', { forager: 4 }); state.inventory = { wood: 20 }; state.party[0].hunger = 95;
    const props = focusInput(state), html = render(Focus, props);
    assert.equal(cardCount(html), 1); assert.match(html, /밤 피해 예상/); assert.match(html, /허기/);
    assert.match(html, /현재 밤에 쓸 수 없습니다/);
    for (const options of [{ ready: false }, { busy: true }]) assert.equal(cardCount(render(Focus, focusInput(state, options))), 0);
    const ended = { ...state, ended: true }; assert.equal(cardCount(render(Focus, focusInput(ended))), 0);
    const safe = fixture('annual-integration');
    const annual = engine.startAnnualSettlementAction(safe, { runId: safe.runId, day: safe.day, ap: safe.ap,
      updatedAt: safe.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
    assert.equal(cardCount(render(Focus, focusInput(annual))), 0);
  });
  check('actual summary projection and SSR are pure across JSON reload and preserve original checkpoint AP inventory time and RNG', () => {
    const state = fixture('pure-food'), before = clone(state), stored = new Map();
    const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) };
    assert.equal(checkpointModule.writeCheckpoint(storage, 'guest', state, { expectedRevision: 0 }).status, 'ready');
    const originalStorage = new Map(stored);
    const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value); for (const child of Object.values(value)) freeze(child);
    } };
    freeze(state);
    let current, html;
    Math.random = () => { throw Error('Food outlook or SSR consumed ambient randomness'); };
    try { current = primitiveArchiveFoodOutlook(modelInput(state)); html = render(Food, { outlook: current }); }
    finally { Math.random = originalRandom; }
    const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(primitiveArchiveFoodOutlook(modelInput(restored)), current);
    assert.equal(render(Food, { outlook: current }), html);
    assert.deepEqual(state, before); assert.deepEqual(stored, originalStorage);
  });
} finally {
  Math.random = originalRandom; clearTimeout(timeout); loader.deregister();
  if (previousImage === undefined) delete globalThis.__foodOutlookImage; else globalThis.__foodOutlookImage = previousImage;
}
console.log(JSON.stringify({ passed, failed: failures.length,
  scope: 'Fresh prepared actual engine summaries, pure projection, actual React SSR and executed page JSX; no historical outcomes, natural progression, browser or human acceptance' }));
if (failures.length) process.exitCode = 1;
