import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const e = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const d = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const c = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const m = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveTradeRoute.js');
const stamp = s => ({ runId: s.runId, day: s.day, ap: s.ap, updatedAt: s.updatedAt, completedYears: s.calendar?.completedYears ?? null });
const year = s => e.runSettlementYearAction(s, stamp(s));
const rival = d.RIVAL_TRIBES[0];
function fixture(job = 'builder') {
  let s = e.createNewState({ runId: 'trade-route-check', now: '2026-11-27T00:00:00.000Z', rng: () => 0.99 });
  s.research.completed = Object.fromEntries(d.TECHNOLOGY_TREE.map(row => [row.id, true]));
  Object.assign(s.research.completed, { SETTLEMENT: true, FOOD_STORAGE: true });
  s.camp = { ...s.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1 };
  s.tribe.population = 8;
  s.tribe.assignments = Object.fromEntries(d.TRIBE_JOBS.map(row => [row.id, row.id === job ? 8 : 0]));
  s.tribe.autoAssignments = Object.fromEntries(d.TRIBE_JOBS.map(row => [row.id, 0]));
  s.inventory = { berry: 200, wood: 50, stone: 50, fiber: 50, hide: 50, resin: 50 };
  s.projects.completed[m.ANNUAL_TRADE_PROJECT_ID] = true;
  s.projects.resourceCommitted[m.ANNUAL_TRADE_PROJECT_ID] = true;
  s.projects.progress[m.ANNUAL_TRADE_PROJECT_ID] = 12;
  s.projects.selectedProjectId = 'palisade';
  s.diplomacy.contacts[rival.id].known = true;
  s = e.startAnnualSettlementAction(s, stamp(s));
  assert.equal(s.calendar?.mode, 'annual');
  assert.equal(c.isValidRunState(s), true);
  return s;
}
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS ${name}`); }
check('public work has a real later-era prerequisite, finite cost and work', () => {
  const p = d.TRIBE_PROJECTS.find(row => row.id === m.ANNUAL_TRADE_PROJECT_ID);
  assert.equal(p.era, 'EARLY_MODERN'); assert.deepEqual(p.prereqs, ['OCEANIC_CARTOGRAPHY']);
  assert.equal(p.work, 12); assert.deepEqual(p.cost, { wood: 8, fiber: 4, hide: 2 });
  const daily = e.createNewState({ rng: () => 0.5 });
  daily.research.completed.OCEANIC_CARTOGRAPHY = true;
  assert.ok(!e.projectRows(daily).some(row => row.id === p.id));
  assert.ok(!Object.hasOwn(e.normalizeState(daily).projects.progress, p.id));
  assert.notEqual(e.selectProjectAction(daily, p.id).projects.selectedProjectId, p.id);
});
check('old saves without a route normalize and checkpoint without inventing a route', () => {
  const s = fixture(); assert.equal(Object.hasOwn(e.normalizeState(s), 'annualTradeRoute'), false);
  assert.equal(c.isValidRunState(s), true);
});
check('configure, replace and clear are pure no-time, no-stock actions for one known rival', () => {
  const s = fixture(); const before = structuredClone(s);
  const next = e.configureAnnualTradeRouteAction(s, { rivalId: rival.id, fromJobId: 'builder' });
  assert.deepEqual(s, before); assert.equal(next.day, s.day); assert.equal(next.ap, s.ap);
  assert.deepEqual(next.inventory, s.inventory); assert.deepEqual(next.calendar, s.calendar);
  assert.deepEqual(next.tribe, s.tribe); assert.equal(c.isValidRunState(next), true);
  assert.equal(e.configureAnnualTradeRouteAction(next, { rivalId: rival.id, fromJobId: 'scholar' }).annualTradeRoute.fromJobId, 'scholar');
  const clear = e.configureAnnualTradeRouteAction(next, { rivalId: '' });
  assert.equal(Object.hasOwn(clear, 'annualTradeRoute'), false); assert.equal(c.isValidRunState(clear), true);
});
check('unknown rivals, missing project, daily and ended modes reject configuration', () => {
  for (const change of [s => { s.diplomacy.contacts[rival.id].known = false; },
    s => { s.projects.completed[m.ANNUAL_TRADE_PROJECT_ID] = false; },
    s => { delete s.calendar; }, s => { s.ended = true; }]) {
    const s = fixture(); change(s);
    assert.equal(e.configureAnnualTradeRouteAction(s, { rivalId: rival.id, fromJobId: 'builder' }), s);
  }
});
check('public work completes through two real paid annual construction periods', () => {
  let s = fixture();
  s.projects.completed[m.ANNUAL_TRADE_PROJECT_ID] = false;
  s.projects.resourceCommitted[m.ANNUAL_TRADE_PROJECT_ID] = false;
  s.projects.progress[m.ANNUAL_TRADE_PROJECT_ID] = 0;
  s.projects.selectedProjectId = m.ANNUAL_TRADE_PROJECT_ID;
  assert.equal(e.annualTradeRouteSummary(s).unlocked, false);
  s = year(s);
  assert.equal(s.projects.resourceCommitted[m.ANNUAL_TRADE_PROJECT_ID], true);
  assert.equal(s.projects.progress[m.ANNUAL_TRADE_PROJECT_ID], 8);
  assert.equal(s.projects.completed[m.ANNUAL_TRADE_PROJECT_ID], false);
  s = year(s);
  assert.equal(s.projects.progress[m.ANNUAL_TRADE_PROJECT_ID], 12);
  assert.equal(e.annualTradeRouteSummary(s).unlocked, true);
});
for (const job of ['builder', 'scholar']) check(`${job} diverts one actual worker, records exact goods and preserves configured jobs`, () => {
  const s = e.configureAnnualTradeRouteAction(fixture(job), { rivalId: rival.id, fromJobId: job });
  const before = structuredClone(s); const p = m.projectAnnualTradeRoute(s);
  assert.equal(p.assignments[job], 7);
  assert.deepEqual(p.receipt.spent, rival.tradeCost); assert.deepEqual(p.receipt.received, rival.tradeReward);
  const next = year(s); const receipt = next.tribe.lastProduction;
  assert.deepEqual(s, before); assert.deepEqual(next.tribe.assignments, s.tribe.assignments);
  assert.equal(receipt.assignments[job], 7); assert.equal(receipt.tradeRoute.workers, 1);
  assert.equal(c.isValidRunState(next), true);
  assert.deepEqual(e.normalizeState(JSON.parse(JSON.stringify(next))).annualTradeRoute, s.annualTradeRoute);
  const control = year(e.configureAnnualTradeRouteAction(s, { rivalId: '' }));
  for (const resource of new Set([...Object.keys(rival.tradeCost), ...Object.keys(rival.tradeReward)])) {
    assert.equal(next.inventory[resource], Number(control.inventory[resource] || 0)
      - Number(rival.tradeCost[resource] || 0) + Number(rival.tradeReward[resource] || 0));
  }
  if (job === 'builder') {
    assert.equal(receipt.projectBaseWork, Math.max(0, control.tribe.lastProduction.projectBaseWork - 1));
  }
});
check('scholar diversion reduces actual requested research by exactly one', () => {
  let s = fixture('scholar');
  const target = d.TECHNOLOGY_TREE.at(-1);
  delete s.research.completed[target.id];
  s.research.progress[target.id] = 0; s.research.selectedTechId = target.id;
  const control = year(s);
  s = e.configureAnnualTradeRouteAction(s, { rivalId: rival.id, fromJobId: 'scholar' });
  const next = year(s);
  assert.equal(next.tribe.lastProduction.researchRequested, control.tribe.lastProduction.researchRequested - 1);
  assert.equal(next.tribe.lastProduction.researchRequested, 7);
});
check('trade and policy forecasts use the automatic workforce in the upcoming year', () => {
  const state = fixture(); state.tribe.assignments.builder = 0; state.tribe.population = 16;
  const configured = e.configureAnnualTradeRouteAction(state, { rivalId: rival.id, fromJobId: 'builder' });
  const summary = e.annualTradeRouteSummary(configured);
  const actual = year(configured).tribe.lastProduction;
  assert.equal(actual.tradeRoute.status, 'applied'); assert.equal(summary.canOperate, true);
  assert.equal(summary.jobs.find(job => job.id === 'builder').workers, actual.assignments.builder + 1);
  const balanced = e.annualWorkPolicyComparison(configured).policies.find(policy => policy.id === 'balanced');
  assert.deepEqual(balanced.receipt.tradeRoute, actual.tradeRoute);
  assert.deepEqual(balanced.assignments, actual.assignments);
  assert.equal(balanced.rows.find(row => row.id === 'tradeWorkers').value, 1);
});
check('short initial materials spend nothing, divert nobody, and do not borrow this year production', () => {
  const s = e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'builder' });
  s.inventory.stone = 0;
  const projection = m.projectAnnualTradeRoute(s);
  assert.equal(projection.receipt.status, 'skipped'); assert.equal(projection.receipt.workers, 0); assert.deepEqual(projection.inventory, s.inventory);
  assert.deepEqual(projection.assignments, s.tribe.assignments);
  assert.equal(year(s).tribe.lastProduction.tradeRoute.status, 'skipped');
});
check('unavailable worker never creates trade goods or labor', () => {
  const s = e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'scholar' });
  assert.equal(m.projectAnnualTradeRoute(s).receipt.status, 'skipped'); assert.equal(year(s).tribe.lastProduction.tradeRoute.workers, 0);
});
check('route receipt is yearly and does not survive a paused exchange as fresh trade', () => {
  let s = year(e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'builder' }));
  assert.ok(s.tribe.lastProduction.tradeRoute);
  s.inventory.stone = 0; s = year(s);
  assert.equal(s.tribe.lastProduction.tradeRoute.status, 'skipped');
});
check('malformed and forged route saves or receipts are strictly rejected', () => {
  const good = year(e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'builder' }));
  for (const mutate of [s => { s.annualTradeRoute.version = 2; }, s => { s.annualTradeRoute.extra = true; },
    s => { s.annualTradeRoute.fromJobId = 'invented'; }, s => { s.annualTradeRoute = null; },
    s => { s.tribe.lastProduction.tradeRoute.workers = 0; },
    s => { s.tribe.lastProduction.tradeRoute.spent.stone = 1; },
    s => { s.tribe.lastProduction.tradeRoute.status = 'skipped'; },
    s => { s.tribe.lastProduction.tradeRoute.reason = 'invented'; },
    s => { s.tribe.lastProduction.tradeRoute.received.wood = 999; }]) {
    const s = structuredClone(good); mutate(s); assert.equal(c.isValidRunState(s), false);
    assert.throws(() => e.normalizeState(s), RangeError);
  }
});
const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const nextImage = require('next/image');
globalThis.__tradeRouteImage = nextImage.default || nextImage;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/image') return { url: 'data:text/javascript,export default globalThis.__tradeRouteImage;', shortCircuit: true };
  if (specifier.startsWith('next/')) return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
  return next(specifier, context);
}, load(url, context, next) {
  if (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js')) return next(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: TradeRoute } = await import('../src/app/games/primitive-archive/_components/PrimitiveArchiveTradeRoute.js');
check('actual route UI shows exact completed and skipped receipt goods and labor', () => {
  let s = year(e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'builder' }));
  let html = renderToStaticMarkup(React.createElement(TradeRoute, { tradeRoute: e.annualTradeRouteSummary(s) }));
  assert.match(html, /실제 교역 완료/); assert.match(html, /실제 전용 1명/); assert.match(html, /건설대/);
  assert.ok(html.includes(e.annualTradeRouteSummary(s).lastReceiptCostText));
  s.inventory.stone = 0; s = year(s);
  html = renderToStaticMarkup(React.createElement(TradeRoute, { tradeRoute: e.annualTradeRouteSummary(s), blocked: true }));
  assert.match(html, /교역 건너뜀/); assert.match(html, /실제 전용 0명/); assert.match(html, /자재가 부족/);
  assert.match(html, /disabled/);
});
check('UI configuration callbacks only request one route selection or clear', () => {
  const s = e.configureAnnualTradeRouteAction(fixture(), { rivalId: rival.id, fromJobId: 'builder' });
  const calls = [];
  const tree = TradeRoute({ tradeRoute: e.annualTradeRouteSummary(s), onConfigure: value => calls.push(value) });
  const buttons = [];
  const visit = node => { if (!node || typeof node !== 'object') return;
    if (typeof node.props?.onClick === 'function') buttons.push(node.props);
    React.Children.forEach(node.props?.children, visit);
  };
  visit(tree); buttons[0].onClick(); buttons.at(-1).onClick();
  assert.deepEqual(calls, [{ rivalId: rival.id, fromJobId: 'builder' }, { rivalId: '' }]);
});
console.log(`ANNUAL_TRADE_ROUTE ${passed} passed; controlled engine/checkpoint checks only`);
