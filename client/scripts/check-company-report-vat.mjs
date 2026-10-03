import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import {
  FIXED_EXPENSES, SAVE_VERSION, createNewState, createOrderAction, shipOrderAction,
  collectReceivableAction, monthEndCloseAction, payVatAction, raiseCapitalAction,
  vatScheduleRows, reportSummary, managementReport, normalizeState, formatMoney,
  createLedgerSnapshotAction, restoreLatestSnapshotAction, restoreLedgerSnapshotAction,
  createProgressExportAction,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';
const { buildCompanyReportPlayViewModel } = await import('../src/app/games/company-report/_lib/companyReportPlayViewModel.js');

const seed = () => createNewState({ runId: 'vat-check', now: '2026-10-03T00:00:00.000Z' });
const clone = (state) => JSON.parse(JSON.stringify(state));
const fixedExpenses = FIXED_EXPENSES.reduce((sum, row) => sum + row.amount, 0);
const failures = [];
let checks = 0;
function check(name, run) {
  try { run(); checks += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const vatRow = (state, year, month) => vatScheduleRows(state, year).find((row) => row.targetMonth === month);
const view = (state, selectedVatKey = '') => buildCompanyReportPlayViewModel({
  state, selectedVatKey, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '', vatPaymentAmount: '',
});
function closeFundedMonth(state) {
  // Real financing actions keep a long normal run solvent; do not edit its cash or calendar.
  const funded = state.company.cashKrw < fixedExpenses * 2 ? raiseCapitalAction(state, 'RIGHTS_OFFERING') : state;
  return monthEndCloseAction(funded);
}
function nextJanuary(state = seed()) {
  const year = state.company.year;
  let next = state;
  for (let i = 0; i < 12 && next.company.year === year; i += 1) next = closeFundedMonth(next);
  assert.deepEqual([next.company.year, next.company.month], [year + 1, 1]);
  return next;
}
function delayedShipment(state = seed()) {
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 10);
  return shipOrderAction(closeFundedMonth(ordered), ordered.orders[0].id);
}
function partialPayments(count = 40) {
  let state = seed();
  for (let i = 0; i < count; i += 1) state = payVatAction(state, 2026, 2, 100);
  return state;
}

check('confirmed but unshipped orders do not create VAT', () => {
  const state = seed();
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 10);
  assert.equal(vatRow(ordered, 2026, 2).invoiceVatAmount, 1180000);
  assert.equal(reportSummary(ordered).vatPayableAmount, reportSummary(state).vatPayableAmount);
});

check('VAT follows actual shipment month just like revenue, not order creation month', () => {
  const state = delayedShipment();
  assert.equal(state.orders[0].month, 2);
  assert.equal(managementReport(state).income.sales, 280000);
  assert.equal(vatRow(state, 2026, 2).invoiceVatAmount, 1180000);
  assert.equal(vatRow(state, 2026, 3).invoiceVatAmount, 28000);
});

check('collection, repeat shipment and later closing do not redate or duplicate invoice VAT', () => {
  const shipped = delayedShipment();
  const collected = collectReceivableAction(shipped, shipped.receivables[0].id);
  const next = shipOrderAction(closeFundedMonth(collected), shipped.orders[0].id);
  assert.equal(vatRow(next, 2026, 3).invoiceVatAmount, 28000);
  assert.equal(vatRow(next, 2026, 4).invoiceVatAmount, 0);
  assert.equal(next.receivables.length, shipped.receivables.length);
});

check('legacy shipment dates use a valid linked invoice without rewriting orders', () => {
  const state = clone(delayedShipment());
  delete state.orders[0].shippedYear;
  delete state.orders[0].shippedMonth;
  const original = clone(state);
  assert.equal(vatRow(normalizeState(state), 2026, 3).invoiceVatAmount, 28000);
  assert.deepEqual(state, original);
  assert.deepEqual(normalizeState(state).orders, state.orders);
});

check('legacy seeds without dated invoices retain their original period', () => {
  const state = seed();
  state.receivables = [];
  assert.equal(vatRow(state, 2026, 2).invoiceVatAmount, 1180000);
  state.receivables = [{ orderId: state.orders[0].id, year: 2026, month: 0 }];
  assert.equal(vatRow(state, 2026, 2).invoiceVatAmount, 1180000);
});

check('VAT on a partial legacy shipment matches the quantity recognized as revenue', () => {
  const state = seed();
  state.orders = [{ ...state.orders[0], quantity: 10, shippedQty: 5, unitPrice: 28000 }];
  state.receivables = [];
  assert.equal(managementReport(state).income.localSales, 140000);
  assert.equal(vatRow(state, 2026, 2).invoiceVatAmount, 14000);
});

check('a December order shipped in January creates VAT in the new year', () => {
  let state = seed();
  while (state.company.month !== 12) state = closeFundedMonth(state);
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 10);
  const shipped = shipOrderAction(closeFundedMonth(ordered), ordered.orders[0].id);
  assert.equal(vatRow(shipped, 2026, 12).invoiceVatAmount, 0);
  assert.equal(vatRow(shipped, 2027, 1).invoiceVatAmount, 28000);
  assert.equal(reportSummary(shipped).vatPayableAmount, 1208000);
});

check('year rollover retains unpaid prior VAT in balances and the actionable schedule', () => {
  const state = nextJanuary();
  const original = clone(state);
  const schedule = vatScheduleRows(state);
  assert.equal(reportSummary(state).vatPayableAmount, 1180000);
  assert.equal(schedule.find((row) => row.id === '2026-02')?.remainingAmount, 1180000);
  assert.equal(schedule.find((row) => row.id === '2026-02')?.status, 'OVERDUE');
  assert.equal(schedule.filter((row) => row.targetYear === 2027).length, 12);
  assert.equal(schedule.filter((row) => row.targetYear === 2026).length, 1);
  assert.equal(vatScheduleRows(state, 2026).length, 12, 'Explicit yearly reports retain their 12-month contract.');
  assert.ok(managementReport(state).recommendations.some((line) => line.includes('기한이 지난 부가세')));
  assert.deepEqual(state, original, 'Reading a report cannot rewrite historical periods or payments.');
});

check('December VAT stays due in January and becomes overdue in February', () => {
  let state = seed();
  while (state.company.month !== 12) state = closeFundedMonth(state);
  state = createOrderAction(state, 'future-book', 'book-akashi', 10);
  state = shipOrderAction(state, state.orders[0].id);
  state = closeFundedMonth(state);
  assert.equal(vatScheduleRows(state).find((row) => row.id === '2026-12')?.status, 'DUE');
  assert.equal(vatScheduleRows(closeFundedMonth(state)).find((row) => row.id === '2026-12')?.status, 'OVERDUE');
});

check('every partial payment remains recorded after the old 36-row limit', () => {
  const state = partialPayments();
  assert.equal(state.vatPayments.length, 40);
  assert.equal(vatRow(state, 2026, 2).paidAmount, 4000);
  assert.equal(vatRow(state, 2026, 2).remainingAmount, 1176000);
  assert.equal(seed().company.cashKrw - state.company.cashKrw, 4000);
});

check('rapid payments have distinct ledger identities even in the same millisecond', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => 1790985600000;
    const state = partialPayments();
    assert.equal(new Set(state.vatPayments.map((row) => row.id)).size, 40);
  } finally { Date.now = originalNow; }
});

check('paying the exact remaining VAT prevents a second payment without inventing cash', () => {
  const state = partialPayments();
  const remaining = 1180000 - 4000;
  const paid = payVatAction(state, 2026, 2, remaining);
  assert.equal(vatRow(paid, 2026, 2).status, 'PAID');
  assert.equal(vatRow(paid, 2026, 2).paidAmount, 1180000);
  assert.equal(paid.company.cashKrw, seed().company.cashKrw - 1180000);
  const duplicate = payVatAction(paid, 2026, 2, 100);
  assert.equal(duplicate.company.cashKrw, paid.company.cashKrw);
  assert.deepEqual(duplicate.vatPayments, paid.vatPayments);
});

check('prior-year VAT payments reduce both cash and liabilities without inventing a new expense', () => {
  const state = nextJanuary();
  const before = reportSummary(state);
  const income = managementReport(state).income;
  const paid = payVatAction(state, 2026, 2);
  const after = reportSummary(paid);
  assert.equal(paid.company.cashKrw, state.company.cashKrw - 1180000);
  assert.equal(after.vatPayableAmount, 0);
  assert.equal(after.assets, before.assets - 1180000);
  assert.equal(after.liabilities, before.liabilities - 1180000);
  assert.equal(after.equity, before.equity);
  assert.deepEqual(managementReport(paid).income, income);
  assert.ok(!vatScheduleRows(paid).some((row) => row.id === '2026-02'));
  assert.equal(vatRow(paid, 2026, 2).status, 'PAID', 'Historical yearly reports still retain fully paid rows.');
});

check('rejected zero, excess and cash-short payments preserve balances and payment records', () => {
  for (const amount of [0, -100, 1180001]) {
    const state = seed();
    const rejected = payVatAction(state, 2026, 2, amount);
    assert.equal(rejected.company.cashKrw, state.company.cashKrw);
    assert.deepEqual(rejected.vatPayments, state.vatPayments);
  }
  const state = seed();
  state.company.cashKrw = 1;
  assert.equal(payVatAction(state, 2026, 2, 100).company.cashKrw, 1);
  assert.equal(payVatAction(state, 2026, 2, 100).vatPayments.length, 0);
});

check('JSON normalization preserves all recorded payments and does not guess lost legacy payments', () => {
  const state = partialPayments();
  const loaded = normalizeState(clone(state));
  assert.equal(loaded.vatPayments.length, 40);
  assert.deepEqual(vatScheduleRows(loaded), vatScheduleRows(state));
  assert.equal(loaded.company.cashKrw, state.company.cashKrw);
  const truncatedLegacy = clone(state);
  truncatedLegacy.vatPayments = truncatedLegacy.vatPayments.slice(0, 36);
  assert.equal(vatRow(normalizeState(truncatedLegacy), 2026, 2).paidAmount, 3600, 'Absent old payments cannot be reconstructed from cash gaps.');
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

check('both snapshot restoration paths retain every payment together with its cash balance', () => {
  const snapshotted = createLedgerSnapshotAction(partialPayments());
  const changed = payVatAction(snapshotted, 2026, 2, 100);
  for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction]) {
    const restored = restore(changed);
    assert.equal(restored.vatPayments.length, 40);
    assert.deepEqual(restored.vatPayments, snapshotted.vatPayments);
    assert.equal(restored.company.cashKrw, snapshotted.company.cashKrw);
    assert.deepEqual(vatScheduleRows(restored), vatScheduleRows(snapshotted));
  }
});

check('the real page view model lets the player select and pay old-year VAT', () => {
  const state = nextJanuary();
  const model = view(state);
  assert.equal(model.selectedVatRow?.id, '2026-02');
  assert.equal(model.vatPayAmount, 1180000);
  assert.equal(view(state, '2027-01').selectedVatRow.id, '2027-01');
  const paid = payVatAction(state, model.selectedVatRow.targetYear, model.selectedVatRow.targetMonth, model.vatPayAmount);
  assert.equal(view(paid, '2026-02').report.vatPayableAmount, 0);
  assert.notEqual(view(paid, '2026-02').selectedVatRow.id, '2026-02');
});

const jsxModules = new Set([
  '../src/app/games/company-report/_components/CompanyReportVatInventoryPanels.js',
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
const { default: VatPanels } = await import('../src/app/games/company-report/_components/CompanyReportVatInventoryPanels.js');
const { buildCompanyReportExportPayload, buildCompanyReportExportCsv } = await import('../src/app/games/company-report/_lib/companyReportExportRuntime.js');

check('actual VAT markup and JSON/CSV/text exports expose the same prior-year unpaid amount', () => {
  const state = nextJanuary();
  const html = renderToStaticMarkup(React.createElement(VatPanels, {
    state, ...view(state), vatPaymentAmount: '', recentActionText: state.log[0],
    resultPresentation: { action: 'tax', label: '부가세', tone: 'warning' },
  }));
  assert.ok(html.includes('value="2026-02"'));
  assert.ok(html.includes(formatMoney(1180000)));
  assert.ok(html.includes('OVERDUE'));
  const payload = buildCompanyReportExportPayload({ state, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
  assert.equal(payload.report.vatPayableAmount, 1180000);
  assert.equal(payload.management.balance.vatPayableAmount, 1180000);
  assert.ok(buildCompanyReportExportCsv(payload).split('\r\n').includes('"finance","vatPayableAmount","1180000","","",""'));
  assert.ok(createProgressExportAction(state).exportHistory[0].content.includes(`Unpaid VAT: ${formatMoney(1180000)}`));
});

console.log(JSON.stringify({ pass: !failures.length, checks, failures, evidence: 'current actions, actual year rollover, serialized state, ledger restores, page view model and rendered components; no historical result files or real account' }));
if (failures.length) process.exitCode = 1;
