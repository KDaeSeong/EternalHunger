import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import {
  CAPITAL_DISCLOSURE_TYPES, PRODUCTS, SAVE_VERSION,
  createNewState, marketingCampaignAction, createDisclosureAction,
  managementReport, monthEndCloseAction, normalizeState,
  createLedgerSnapshotAction, restoreLatestSnapshotAction, restoreLedgerSnapshotAction,
  ledgerRestorePlan, createProgressExportAction, formatMoney, reportHistoryTrend,
  createExportPlanAction, settleGlobalTradeAction, inboundInventoryAction,
  payVatAction, decideDividendAction, raiseCapitalAction, reportSummary,
  orderRows, inventoryRows, receivableRows,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';

const seed = () => createNewState({ runId: 'operating-expenses-check', now: '2026-10-03T00:00:00.000Z' });
const clone = (value) => JSON.parse(JSON.stringify(value));
const campaignCost = (id) => 12000000 + PRODUCTS.find((row) => row.id === id).hype * 80000;
const disclosureCost = CAPITAL_DISCLOSURE_TYPES.find((row) => row.id === 'EARNINGS_CALL').costKrw;
const expenseActions = (state = seed()) => createDisclosureAction(marketingCampaignAction(state, 'goods-aero'), 'EARNINGS_CALL');
let passed = 0;
function check(name, run) { run(); passed += 1; console.log(`PASS ${name}`); }

check('paid campaign and disclosure reduce this period profit, not gross margin', () => {
  const original = seed();
  const state = expenseActions(original);
  const before = managementReport(original).income;
  const after = managementReport(state).income;
  const cost = campaignCost('goods-aero') + disclosureCost;
  assert.equal(cost, 20640000);
  assert.equal(state.company.cashKrw, original.company.cashKrw - cost);
  assert.equal(after.operatingProfit, before.operatingProfit - cost);
  assert.equal(after.marketingExpenses, campaignCost('goods-aero'));
  assert.equal(after.disclosureExpenses, disclosureCost);
  assert.equal(after.paidOperatingExpenses, cost);
  assert.equal(after.totalCost, before.totalCost + cost);
  assert.equal(after.sales, before.sales);
  assert.equal(after.cogs, before.cogs);
  assert.equal(after.grossProfit, before.grossProfit);
  assert.equal(after.operatingExpenseCoverage, 'full-period');
  assert.equal(managementReport(original).income.paidOperatingExpenses, 0, 'Input state is not mutated.');
});

check('marketing and disclosure each recognize exactly their own paid amount', () => {
  const state = seed();
  const campaign = managementReport(marketingCampaignAction(state, 'book-akashi')).income;
  assert.equal(campaign.marketingExpenses, campaignCost('book-akashi'));
  assert.equal(campaign.disclosureExpenses, 0);
  const disclosure = managementReport(createDisclosureAction(state, 'AUDIT_RESPONSE')).income;
  assert.equal(disclosure.marketingExpenses, 0);
  assert.equal(disclosure.disclosureExpenses, CAPITAL_DISCLOSURE_TYPES.find((row) => row.id === 'AUDIT_RESPONSE').costKrw);
});

check('rejected cash actions neither create expenses nor change profit', () => {
  const state = seed();
  state.company.cashKrw = 1;
  const before = clone(state);
  const rejected = expenseActions(state);
  assert.equal(rejected.company.cashKrw, 1);
  assert.deepEqual(rejected.operatingExpensePeriod, state.operatingExpensePeriod);
  assert.deepEqual(managementReport(rejected).income, managementReport(state).income);
  assert.deepEqual(state, before);
});

check('full history expenses survive disclosure and log display caps', () => {
  let state = seed();
  state.company.cashKrw = 10000000000;
  const opening = state.company.cashKrw;
  for (let i = 0; i < 121; i += 1) {
    state = marketingCampaignAction(state, 'book-akashi');
    state = createDisclosureAction(state, 'EARNINGS_CALL');
  }
  assert.equal(state.capitalMarket.disclosures.length, 16);
  assert.equal(state.log.length, 120);
  const income = managementReport(state).income;
  assert.equal(income.marketingExpenses, campaignCost('book-akashi') * 121);
  assert.equal(income.disclosureExpenses, disclosureCost * 121);
  assert.equal(state.company.cashKrw, opening - income.paidOperatingExpenses);
  assert.deepEqual(managementReport(normalizeState(clone(state))).income, income);
});

check('closing records paid expenses without charging the same cash twice', () => {
  const state = expenseActions();
  const income = managementReport(state).income;
  const next = monthEndCloseAction(state);
  const closed = next.settlements[0];
  assert.equal(closed.operatingProfit, income.operatingProfit);
  assert.equal(closed.totalCost, income.totalCost);
  assert.equal(closed.netProfit, income.netProfit);
  assert.equal(closed.marketingExpensesPaidKrw, income.marketingExpenses);
  assert.equal(closed.disclosureExpensesPaidKrw, income.disclosureExpenses);
  assert.equal(closed.operatingExpensesPaidKrw, income.paidOperatingExpenses);
  assert.equal(closed.operatingExpenseCoverage, 'full-period');
  assert.equal(next.company.cashKrw, state.company.cashKrw - income.fixedExpenses - income.tax);
  assert.equal(closed.closingAssetsKrw, reportSummary(state).assets - income.fixedExpenses - income.tax);
  assert.equal(closed.netCashflow, -income.paidOperatingExpenses - income.fixedExpenses - income.tax);
  assert.equal(reportHistoryTrend(state).latest.cost, income.totalCost);
});

check('next month starts with no old expenses and leaves prior settlement intact', () => {
  let next = monthEndCloseAction(expenseActions());
  const old = clone(next.settlements[0]);
  assert.deepEqual(next.operatingExpensePeriod, { year: 2026, month: 3, marketingKrw: 0, disclosureKrw: 0, coverage: 'full-period' });
  assert.equal(managementReport(next).income.paidOperatingExpenses, 0);
  next = createDisclosureAction(next, 'EARNINGS_CALL');
  assert.equal(managementReport(next).income.paidOperatingExpenses, disclosureCost);
  next = monthEndCloseAction(next);
  assert.equal(next.settlements[0].operatingExpensesPaidKrw, disclosureCost);
  assert.deepEqual(next.settlements[1], old);
});

check('December to January rolls over the paid expense period once', () => {
  const state = seed();
  state.company.month = 12;
  state.cashFlowPeriod.month = 12;
  state.operatingExpensePeriod.month = 12;
  const closed = monthEndCloseAction(expenseActions(state));
  assert.deepEqual([closed.operatingExpensePeriod.year, closed.operatingExpensePeriod.month], [2027, 1]);
  assert.equal(closed.settlements[0].operatingExpensesPaidKrw, 20640000);
  assert.equal(managementReport(closed).income.paidOperatingExpenses, 0);
});

check('real profitable exports pay tax on profit after paid operating expenses', () => {
  let state = seed();
  for (let i = 0; i < 20; i += 1) state = settleGlobalTradeAction(createExportPlanAction(state, 'jp-retail', 'book-akashi', 1000));
  const before = managementReport(state).income;
  state = expenseActions(state);
  const income = managementReport(state).income;
  assert.ok(income.operatingProfit > 0);
  assert.equal(income.operatingProfit, before.operatingProfit - 20640000);
  assert.equal(income.tax, Math.round(income.operatingProfit * 0.22));
  assert.ok(income.tax < before.tax);
  const closed = monthEndCloseAction(state);
  assert.equal(closed.settlements[0].tax, income.tax);
  assert.equal(closed.company.cashKrw, state.company.cashKrw - income.fixedExpenses - income.tax);
});

check('inventory, VAT, dividends and financing are not campaign or disclosure expenses', () => {
  const original = seed();
  let state = inboundInventoryAction(original, 'book-akashi', 10);
  assert.equal(state.company.cashKrw, original.company.cashKrw - 90000);
  state = payVatAction(state, 2026, 2, 100);
  assert.equal(state.vatPayments[0].paymentAmount, 100);
  state = decideDividendAction(state);
  assert.equal(state.capitalMarket.dividends.length, 1);
  state = raiseCapitalAction(state, 'RIGHTS_OFFERING');
  assert.equal(state.capitalMarket.financingPlans[0].type, 'RIGHTS_OFFERING');
  state = raiseCapitalAction(state, 'CORPORATE_BOND');
  assert.equal(state.capitalMarket.debtKrw, 180000000);
  assert.notEqual(state.company.cashKrw, seed().company.cashKrw);
  assert.equal(managementReport(state).income.paidOperatingExpenses, 0);
});

check('JSON save normalization preserves counters, cash and history without recounting rows', () => {
  const state = expenseActions();
  const loaded = normalizeState(clone(state));
  assert.deepEqual(loaded.operatingExpensePeriod, state.operatingExpensePeriod);
  assert.equal(loaded.company.cashKrw, state.company.cashKrw);
  assert.deepEqual(loaded.capitalMarket, state.capitalMarket);
  assert.deepEqual(managementReport(normalizeState(loaded)).income, managementReport(state).income);
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

check('legacy saves recover only dated known disclosures, not unknown campaign payments', () => {
  const state = expenseActions();
  delete state.operatingExpensePeriod;
  state.log = [];
  const original = clone(state);
  const loaded = normalizeState(state);
  assert.equal(loaded.company.cashKrw, state.company.cashKrw);
  assert.deepEqual(loaded.settlements, state.settlements);
  assert.equal(managementReport(loaded).income.marketingExpenses, 0);
  assert.equal(managementReport(loaded).income.disclosureExpenses, disclosureCost);
  assert.equal(managementReport(loaded).income.operatingExpenseCoverage, 'recorded-only');
  assert.ok(managementReport(loaded).recommendations.some((line) => line.includes('기록이 남은 지급비용만')));
  assert.deepEqual(state, original);
  const next = marketingCampaignAction(loaded, 'book-akashi');
  assert.equal(managementReport(next).income.paidOperatingExpenses, campaignCost('book-akashi') + disclosureCost);
  assert.equal(next.operatingExpensePeriod.coverage, 'recorded-only');
});

check('legacy fallback sees uncapped valid current rows and excludes invalid or other periods', () => {
  const state = seed();
  delete state.operatingExpensePeriod;
  state.capitalMarket.disclosures = Array.from({ length: 20 }, (_, i) => ({ id: `known-${i}`, year: 2026, month: 2, costKrw: 100 }));
  state.capitalMarket.disclosures.push(
    { year: 2026, month: 1, costKrw: 500 },
    { year: 2027, month: 2, costKrw: 500 },
    { year: 2026, month: 2, costKrw: -1 },
    { year: 2026, month: 2, costKrw: '100' },
    { year: 2026, month: 2, costKrw: Infinity },
    null,
  );
  const loaded = normalizeState(state);
  assert.equal(loaded.capitalMarket.disclosures.length, 16);
  assert.equal(managementReport(loaded).income.disclosureExpenses, 2000);
  assert.equal(managementReport(normalizeState(loaded)).income.disclosureExpenses, 2000);
});

check('stale or invalid counters do not invent past expenses or poison reports', () => {
  const state = expenseActions();
  for (const change of [
    { month: 1 }, { year: 2025 }, { marketingKrw: -1 }, { marketingKrw: Infinity },
    { marketingKrw: '100' }, { disclosureKrw: NaN }, { coverage: 'unknown' },
  ]) {
    const loaded = normalizeState({ ...state, operatingExpensePeriod: { ...state.operatingExpensePeriod, ...change } });
    assert.equal(managementReport(loaded).income.marketingExpenses, 0);
    assert.equal(managementReport(loaded).income.disclosureExpenses, disclosureCost);
    assert.equal(managementReport(loaded).income.operatingExpenseCoverage, 'recorded-only');
    assert.equal(loaded.company.cashKrw, state.company.cashKrw);
  }
});

check('closing a legacy partial period retains its honest scope then resets the next period', () => {
  const legacy = expenseActions();
  delete legacy.operatingExpensePeriod;
  const next = monthEndCloseAction(legacy);
  assert.equal(next.settlements[0].operatingExpensesPaidKrw, disclosureCost);
  assert.equal(next.settlements[0].operatingExpenseCoverage, 'recorded-only');
  assert.equal(next.operatingExpensePeriod.coverage, 'full-period');
  assert.equal(managementReport(next).income.paidOperatingExpenses, 0);
});

check('latest and physical snapshot restores put cash and paid expense counters back together', () => {
  const snapshotted = createLedgerSnapshotAction(expenseActions());
  const original = clone(snapshotted);
  const changed = expenseActions(snapshotted);
  for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction]) {
    const restored = restore(changed);
    assert.equal(restored.company.cashKrw, snapshotted.company.cashKrw);
    assert.deepEqual(restored.operatingExpensePeriod, snapshotted.operatingExpensePeriod);
    assert.deepEqual(managementReport(restored).income, managementReport(snapshotted).income);
    assert.equal(ledgerRestorePlan(restored).afterDiffStatus, 'MATCH');
  }
  assert.deepEqual(snapshotted, original);
});

check('selected company restore brings its expense period; unrelated table restore does not', () => {
  const snapshotted = createLedgerSnapshotAction(expenseActions());
  const changed = expenseActions(snapshotted);
  const companyOnly = restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'company_info');
  assert.equal(companyOnly.company.cashKrw, snapshotted.company.cashKrw);
  assert.deepEqual(companyOnly.operatingExpensePeriod, snapshotted.operatingExpensePeriod);
  const ordersOnly = restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'sales_order');
  assert.equal(ordersOnly.company.cashKrw, changed.company.cashKrw);
  assert.deepEqual(ordersOnly.operatingExpensePeriod, changed.operatingExpensePeriod);
});

check('old snapshot missing expense metadata never keeps the newer current counters', () => {
  const old = createLedgerSnapshotAction(expenseActions());
  delete old.ledgerSnapshots[0].payload.operatingExpensePeriod;
  delete old.ledgerSnapshots[0].operatingExpenseChecksum;
  const changed = expenseActions(old);
  for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction,
    (state) => restoreLedgerSnapshotAction(state, 'SELECTED_TABLES', 'company_info')]) {
    const restored = restore(changed);
    assert.equal(restored.company.cashKrw, old.company.cashKrw);
    assert.equal(restored.operatingExpensePeriod.marketingKrw, 0);
    assert.equal(restored.operatingExpensePeriod.disclosureKrw, disclosureCost);
    assert.equal(restored.operatingExpensePeriod.coverage, 'recorded-only');
  }
});

check('new expense checksum blocks tampered counters on both snapshot restore paths', () => {
  const snapshotted = createLedgerSnapshotAction(expenseActions());
  assert.equal(typeof snapshotted.ledgerSnapshots[0].operatingExpenseChecksum, 'string');
  const changed = expenseActions(snapshotted);
  changed.ledgerSnapshots[0].payload.operatingExpensePeriod.marketingKrw += 1;
  const plan = ledgerRestorePlan(changed);
  assert.equal(plan.restorable, false);
  assert.equal(plan.dryRunStatus, 'BLOCKED');
  assert.ok(plan.warnings.some((line) => line.includes('지급비용')));
  for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction]) {
    const rejected = restore(changed);
    assert.equal(rejected.company.cashKrw, changed.company.cashKrw);
    assert.deepEqual(rejected.operatingExpensePeriod, changed.operatingExpensePeriod);
  }
});

check('new snapshot missing counters or an invalid expense checksum cannot restore', () => {
  for (const tamper of [
    (snapshot) => { delete snapshot.payload.operatingExpensePeriod; },
    (snapshot) => { snapshot.operatingExpenseChecksum = ''; },
    (snapshot) => { snapshot.operatingExpenseChecksum = null; },
  ]) {
    const state = createLedgerSnapshotAction(expenseActions());
    tamper(state.ledgerSnapshots[0]);
    assert.equal(ledgerRestorePlan(state).restorable, false);
    for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction]) {
      assert.equal(restore(state).company.cashKrw, state.company.cashKrw);
      assert.deepEqual(restore(state).operatingExpensePeriod, state.operatingExpensePeriod);
    }
  }
});

check('expense-only changes are not falsely shown as an already-matched ledger', () => {
  const changed = createLedgerSnapshotAction(expenseActions());
  changed.operatingExpensePeriod.marketingKrw += 1;
  assert.equal(ledgerRestorePlan(changed).beforeDiffStatus, 'DIFF');
  const restored = restoreLedgerSnapshotAction(changed);
  assert.equal(restored.restoreHistory[0].status, 'SUCCESS');
  assert.equal(ledgerRestorePlan(restored).afterDiffStatus, 'MATCH');
});

const jsxModules = new Set([
  '../src/app/games/company-report/_components/CompanyReportManagementPanels.js',
  '../src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js',
  '../src/app/games/company-report/_components/CompanyReportVisuals.js',
  '../src/app/games/company-report/_lib/companyReportPlayHelpers.js',
  '../src/app/games/_components/GamePlayPrimitives.js',
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
registerHooks({
  load(url, context, nextLoad) {
    if (!jsxModules.has(url)) return nextLoad(url, context);
    return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});
const { default: ManagementPanels } = await import('../src/app/games/company-report/_components/CompanyReportManagementPanels.js');
const { default: ArchivePanels } = await import('../src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js');
const { buildCompanyReportExportPayload, buildCompanyReportExportCsv } = await import('../src/app/games/company-report/_lib/companyReportExportRuntime.js');
const renderManagement = (state) => renderToStaticMarkup(React.createElement(ManagementPanels, {
  ledgerDiff: [], latestSnapshot: null, management: managementReport(state), restorePlan: ledgerRestorePlan(state),
}));
const renderArchive = (state) => renderToStaticMarkup(React.createElement(ArchivePanels, {
  state, orders: orderRows(state), stocks: inventoryRows(state), receivables: receivableRows(state), report: reportSummary(state),
  latestSettlement: state.settlements[0], latestSnapshot: null, latestBookmark: null, latestExport: null, latestRestore: null,
  restoreMode: 'FULL_LEDGER', restorePlan: ledgerRestorePlan(state), selectedRestoreTables: '',
  resultPresentation: { action: 'closing', label: '월말 결산', tone: 'warning' }, recentActionText: state.log[0],
  quantity: 1, partnerId: 'future-book', productId: PRODUCTS[0].id,
}));

check('actual management markup exposes paid expense amounts and legacy scope', () => {
  const state = expenseActions();
  const html = renderManagement(state);
  assert.ok(html.includes('캠페인 집행비'));
  assert.ok(html.includes('공시 대응비'));
  assert.ok(html.includes(formatMoney(campaignCost('goods-aero'))));
  assert.ok(html.includes(formatMoney(disclosureCost)));
  assert.ok(html.includes(formatMoney(managementReport(state).income.operatingProfit)));
  assert.ok(html.includes('결산 때 다시 지급하지 않습니다'));
  delete state.operatingExpensePeriod;
  assert.ok(renderManagement(state).includes('기록이 남은 지급비용만'));
});

check('closing markup distinguishes expenses paid earlier from cash paid at closing', () => {
  const state = monthEndCloseAction(expenseActions());
  const html = renderArchive(state);
  assert.ok(html.includes(`이미 지급한 운영비 ${formatMoney(20640000)}`));
  assert.ok(html.includes(`결산 후 현금 ${formatMoney(state.company.cashKrw)}`));
  const legacy = expenseActions();
  delete legacy.operatingExpensePeriod;
  assert.ok(renderArchive(monthEndCloseAction(legacy)).includes('기록이 남은 지급비용만'));
  assert.ok(!renderArchive(seed()).includes('이미 지급한 운영비'), 'Opening historical settlement must not gain invented expense detail.');
});

check('JSON, CSV and progress exports carry the same expense totals and honest scope', () => {
  for (const state of [expenseActions(), (() => { const old = expenseActions(); delete old.operatingExpensePeriod; return old; })()]) {
    const saved = createProgressExportAction(state);
    const payload = buildCompanyReportExportPayload({ state: saved, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
    const income = managementReport(saved).income;
    assert.equal(payload.management.income.paidOperatingExpenses, income.paidOperatingExpenses);
    assert.equal(payload.management.income.operatingExpenseCoverage, income.operatingExpenseCoverage);
    const csv = buildCompanyReportExportCsv(payload);
    for (const metric of ['marketingExpenses', 'disclosureExpenses', 'paidOperatingExpenses', 'operatingExpenseCoverage']) {
      assert.ok(csv.includes(metric));
      assert.ok(csv.includes(String(income[metric])));
    }
    const text = saved.exportHistory[0].content;
    assert.ok(text.includes(`Paid Operating Expenses: ${formatMoney(income.paidOperatingExpenses)}`));
    assert.ok(text.includes(`Operating Expense Coverage: ${income.operatingExpenseCoverage}`));
    assert.ok(text.includes(`Operating Profit: ${formatMoney(income.operatingProfit)}`));
  }
});

console.log(JSON.stringify({ pass: true, checks: passed, evidence: 'current paid actions, serialized state, snapshot restoration and actual rendered components; no prior result files or real account' }));
