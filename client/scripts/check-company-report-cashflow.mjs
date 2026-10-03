import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import {
  CAPITAL_DISCLOSURE_TYPES,
  CAPITAL_FINANCING_TYPES,
  advanceBusinessDayAction,
  calendarSummary,
  capitalMarketSummary,
  closeCapitalMarketAction,
  closeInventoryValuationAction,
  collectForeignReceivableAction,
  collectReceivableAction,
  createDisclosureAction,
  createExportPlanAction,
  createHedgeContractAction,
  createImportPlanAction,
  createLedgerSnapshotAction,
  createNewState,
  createOrderAction,
  createProgressExportAction,
  decideDividendAction,
  FIXED_EXPENSES,
  formatMoney,
  GLOBAL_MARKETS,
  globalMarketRows,
  globalTradeSummary,
  inboundInventoryAction,
  inventoryRows,
  ledgerRestorePlan,
  managementReport,
  marketingCampaignAction,
  monthEndCloseAction,
  normalizeState,
  orderRows,
  PARTNERS,
  payVatAction,
  PRODUCTS,
  raiseCapitalAction,
  receivableRows,
  reportSummary,
  reportHistoryTrend,
  restoreLatestSnapshotAction,
  restoreLedgerSnapshotAction,
  SAVE_VERSION,
  settleGlobalTradeAction,
  shipOrderAction,
  vatScheduleRows,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';
import {
  companyReportResultPresentation,
} from '../src/app/games/company-report/_lib/companyReportFeedback.js';

const fixedExpenses = FIXED_EXPENSES.reduce((sum, row) => sum + row.amount, 0);
const seed = () => createNewState({ now: '2026-10-03T00:00:00.000Z', runId: 'cashflow-check' });
const clone = (value) => JSON.parse(JSON.stringify(value));
let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`); };
function expectClosing(state) {
  const next = monthEndCloseAction(state);
  const settlement = next.settlements[0];
  assert.equal(next.company.cashKrw, state.company.cashKrw - fixedExpenses - settlement.tax);
  assert.equal(settlement.fixedExpensesPaidKrw, fixedExpenses);
  assert.equal(settlement.openingCashKrw, state.cashFlowPeriod.openingCashKrw);
  assert.equal(settlement.closingCashKrw, next.company.cashKrw);
  assert.equal(settlement.netCashflow, next.company.cashKrw - settlement.openingCashKrw);
  assert.equal(next.cashFlowPeriod.openingCashKrw, next.company.cashKrw);
  assert.equal(next.cashFlowPeriod.coverage, 'full-period');
  assert.deepEqual([next.cashFlowPeriod.year, next.cashFlowPeriod.month], [next.company.year, next.company.month]);
  assert.equal(managementReport(next).cashFlow.periodNetCashflow, 0);
  return next;
}

check('idle monthly closing pays fixed expenses exactly once', () => {
  let state = seed();
  const openingCash = state.company.cashKrw;
  for (let closedMonths = 1; closedMonths <= 3; closedMonths += 1) {
    state = expectClosing(state);
    assert.equal(state.company.cashKrw, openingCash - fixedExpenses * closedMonths);
    assert.equal(state.settlements[0].netCashflow, -fixedExpenses);
  }
  assert.deepEqual([state.company.year, state.company.month], [2026, 5]);
  assert.equal(state.company.cashKrw, 901800000);
});

check('opening collected invoices are not counted as new cash', () => {
  const state = seed();
  const collected = state.receivables.find((row) => row.status === 'COLLECTED');
  assert.ok(collected.amount > 0);
  const again = collectReceivableAction(state, collected.id);
  assert.equal(again.company.cashKrw, state.company.cashKrw);
  assert.equal(managementReport(again).cashFlow.periodNetCashflow, 0);
  assert.equal(expectClosing(again).settlements[0].netCashflow, -fixedExpenses);
});

check('partial and previous-period receivables count only their actual collection', () => {
  const original = seed();
  const row = original.receivables.find((ar) => ar.status === 'PARTIAL');
  row.month = 1; // Invoice issue month is not collection month.
  const expectedReceipt = row.amount - row.collected;
  const state = collectReceivableAction(original, row.id);
  assert.equal(state.company.cashKrw, original.company.cashKrw + expectedReceipt);
  assert.equal(managementReport(state).cashFlow.periodNetCashflow, expectedReceipt);
  assert.equal(collectReceivableAction(state, row.id).company.cashKrw, state.company.cashKrw);
  assert.equal(expectClosing(state).settlements[0].netCashflow, expectedReceipt - fixedExpenses);
});

check('production, shipment and collection each affect cash only when paid', () => {
  const original = seed();
  const product = PRODUCTS.find((row) => row.id === 'book-akashi');
  const quantity = 100;
  const produced = inboundInventoryAction(original, product.id, quantity);
  const productionCost = product.unitCost * quantity;
  assert.equal(produced.company.cashKrw, original.company.cashKrw - productionCost);
  assert.equal(produced.inventory[product.id].onHand, original.inventory[product.id].onHand + quantity);
  const ordered = createOrderAction(produced, 'future-book', product.id, quantity);
  assert.equal(ordered.orders.length, produced.orders.length + 1);
  const shipped = shipOrderAction(ordered, ordered.orders[0].id);
  assert.equal(shipped.company.cashKrw, produced.company.cashKrw, 'Shipment creates an invoice, not cash.');
  assert.equal(shipped.inventory[product.id].onHand, produced.inventory[product.id].onHand - quantity);
  const firstClose = expectClosing(shipped);
  assert.equal(firstClose.settlements[0].netCashflow, -productionCost - fixedExpenses);
  const receipt = shipped.receivables[0];
  const blocked = collectReceivableAction(shipped, receipt.id);
  assert.equal(blocked.company.cashKrw, shipped.company.cashKrw, 'An unpaid 30-day invoice cannot produce cash early.');
  assert.equal(receivableRows(blocked)[0].canCollect, false);
  const daysToDue = Math.round((Date.parse(receipt.dueDate) - Date.parse(calendarSummary(firstClose).currentDate)) / 86400000);
  const matured = advanceBusinessDayAction(firstClose, daysToDue);
  const collected = collectReceivableAction(matured, receipt.id);
  assert.equal(collected.company.cashKrw, produced.company.cashKrw - fixedExpenses + receipt.amount);
  assert.equal(expectClosing(collected).settlements[0].netCashflow, receipt.amount - fixedExpenses, 'Prior-month production costs cannot be charged again in the collection month.');
});

function queuedCreditOrders() {
  let state = inboundInventoryAction(seed(), 'book-akashi', 520);
  state = createOrderAction(state, 'hanbit-event', 'book-akashi', 500);
  const first = state.orders[0].id;
  state = createOrderAction(state, 'hanbit-event', 'book-akashi', 500);
  const second = state.orders[0].id;
  return { state: shipOrderAction(state, first), first, second };
}

function outstandingFor(state, partnerId) {
  return receivableRows(state).filter((row) => row.partnerId === partnerId)
    .reduce((sum, row) => sum + row.remaining, 0);
}

function expectCreditShipmentBlocked(state, orderId) {
  const original = clone(state);
  const blocked = shipOrderAction(state, orderId);
  assert.match(blocked.log[0], /여신 한도.*부족/);
  for (const key of ['company', 'inventory', 'orders', 'receivables', 'cashFlowPeriod', 'operatingExpensePeriod', 'nextReceivableNo']) {
    assert.deepEqual(blocked[key], state[key], `A blocked shipment must preserve ${key}.`);
  }
  assert.equal(companyReportResultPresentation(state, blocked).key, 'creditBlocked');
  assert.deepEqual(state, original, 'Checking shipment credit must not mutate the input ledger.');
  return blocked;
}

check('queued orders cannot bypass actual shipment credit including VAT', () => {
  const { state, second } = queuedCreditOrders();
  const partner = PARTNERS.find((row) => row.id === 'hanbit-event');
  assert.equal(partner.creditLimit, 30000000);
  assert.equal(outstandingFor(state, partner.id), 15400000);
  assert.equal(state.inventory['book-akashi'].onHand, 500);
  assert.equal(state.orders.find((row) => row.id === second).status, 'CONFIRMED');
  const blocked = expectCreditShipmentBlocked(state, second);
  assert.match(blocked.log[0], /14,600,000원/);
  assert.match(blocked.log[0], /15,400,000원/);
  expectCreditShipmentBlocked(blocked, second);
});

check('collecting the real invoice releases credit and permits the held shipment exactly once', () => {
  const { state, second } = queuedCreditOrders();
  const blocked = expectCreditShipmentBlocked(state, second);
  const invoice = blocked.receivables.find((row) => row.partnerId === 'hanbit-event');
  const recovered = collectReceivableAction(blocked, invoice.id);
  assert.equal(recovered.company.cashKrw, state.company.cashKrw + invoice.amount);
  assert.equal(outstandingFor(recovered, invoice.partnerId), 0);
  const shipped = shipOrderAction(recovered, second);
  assert.equal(shipped.orders.find((row) => row.id === second).status, 'SHIPPED');
  assert.equal(shipped.inventory['book-akashi'].onHand, 0);
  assert.equal(shipped.receivables.length, state.receivables.length + 1);
  assert.equal(shipped.company.cashKrw, recovered.company.cashKrw, 'Credit clearance is not a second cash receipt.');
  assert.equal(outstandingFor(shipped, invoice.partnerId), 15400000);
  const repeated = shipOrderAction(shipped, second);
  assert.deepEqual(repeated.receivables, shipped.receivables);
  assert.deepEqual(repeated.inventory, shipped.inventory);
});

check('shipment credit counts only that partner\'s unpaid balance, including partial invoices', () => {
  let state = inboundInventoryAction(seed(), 'book-akashi', 1920);
  const orderIds = [];
  for (let index = 0; index < 4; index += 1) {
    state = createOrderAction(state, 'blue-collect', 'book-akashi', 600);
    orderIds.push(state.orders[0].id);
  }
  assert.equal(outstandingFor(state, 'blue-collect'), 6680000);
  for (const orderId of orderIds.slice(0, 3)) state = shipOrderAction(state, orderId);
  assert.equal(outstandingFor(state, 'blue-collect'), 62120000);
  expectCreditShipmentBlocked(state, orderIds[3]);
  const partialInvoice = state.receivables.find((row) => row.status === 'PARTIAL');
  state = collectReceivableAction(state, partialInvoice.id);
  const shipped = shipOrderAction(state, orderIds[3]);
  assert.equal(outstandingFor(shipped, 'blue-collect'), 73920000);
  assert.equal(shipped.orders.find((row) => row.id === orderIds[3]).status, 'SHIPPED');
  assert.equal(outstandingFor(shipped, 'globe-media'), 5016000, 'Another partner\'s credit and old invoice stay untouched.');
});

check('fully collected historical invoices do not consume available shipment credit', () => {
  let state = inboundInventoryAction(seed(), 'book-akashi', 1120);
  state = createOrderAction(state, 'future-book', 'book-akashi', 1600);
  const orderId = state.orders[0].id;
  const shipped = shipOrderAction(state, orderId);
  assert.equal(shipped.orders.find((row) => row.id === orderId).status, 'SHIPPED');
  assert.equal(outstandingFor(shipped, 'future-book'), 49280000);
  assert.equal(shipped.company.cashKrw, state.company.cashKrw);
});

check('month changes, JSON normalization and ledger restore do not erase unpaid shipment exposure', () => {
  const { state, second } = queuedCreditOrders();
  expectCreditShipmentBlocked(normalizeState(clone(state)), second);
  expectCreditShipmentBlocked(expectClosing(state), second);
  const snapshotted = createLedgerSnapshotAction(state);
  const recovered = collectReceivableAction(snapshotted, snapshotted.receivables[0].id);
  const shipped = shipOrderAction(recovered, second);
  for (const restore of [restoreLatestSnapshotAction, restoreLedgerSnapshotAction]) {
    const restored = restore(shipped);
    assert.equal(restored.orders.find((row) => row.id === second).status, 'CONFIRMED');
    expectCreditShipmentBlocked(restored, second);
  }
});

check('credit boundary permits the exact remaining amount and blocks one additional unit', () => {
  const state = inboundInventoryAction(seed(), 'book-akashi', 20);
  // A controlled partial-payment boundary, not a claim about the opening ledger.
  state.receivables.push({ id: 'credit-boundary', partnerId: 'hanbit-event', amount: 20000000,
    collected: 5400000, status: 'PARTIAL', year: 2026, month: 2 });
  const exact = createOrderAction(state, 'hanbit-event', 'book-akashi', 500);
  assert.equal(exact.orders.length, state.orders.length + 1, 'Order acceptance must use the same whole-won invoice as shipment.');
  const exactOrderId = exact.orders[0].id;
  const shipped = shipOrderAction(exact, exactOrderId);
  assert.equal(shipped.orders.find((row) => row.id === exactOrderId).status, 'SHIPPED');
  assert.equal(outstandingFor(shipped, 'hanbit-event'), 30000000);
  const changed = clone(exact);
  changed.inventory['book-akashi'].onHand += 1;
  changed.orders[0].quantity += 1; // Existing stored order differs from today's available credit.
  expectCreditShipmentBlocked(changed, exactOrderId);
});

check('twelve real business months keep credit, collections and profitable closing linked across a year', () => {
  let state = seed();
  const openingCash = state.company.cashKrw;
  const monthlyBatches = 11;
  for (let month = 0; month < 12; month += 1) {
    if (month === 6) state = normalizeState(clone(state));
    const periodOpeningCash = state.company.cashKrw;
    // Consolidate production into four days, then use 22 shipment days.
    // The February calendar must constrain this run without free time or cash.
    state = inboundInventoryAction(state, 'book-akashi', 6000);
    state = inboundInventoryAction(state, 'book-akashi', monthlyBatches * 1000 - 6000);
    assert.equal(state.company.day, 5);
    for (let batch = 0; batch < monthlyBatches; batch += 1) {
      const pending = [];
      for (let index = 0; index < 2; index += 1) {
        const previousCount = state.orders.length;
        state = createOrderAction(state, 'hanbit-event', 'book-akashi', 500);
        assert.equal(state.orders.length, previousCount + 1);
        pending.push(state.orders[0].id);
      }
      state = shipOrderAction(state, pending[0]);
      state = expectCreditShipmentBlocked(state, pending[1]);
      const invoice = state.receivables.find((row) => row.orderId === pending[0]);
      state = collectReceivableAction(state, invoice.id);
      state = shipOrderAction(state, pending[1]);
      assert.equal(state.orders.find((row) => row.id === pending[1]).status, 'SHIPPED');
      state = collectReceivableAction(state, state.receivables.find((row) => row.orderId === pending[1]).id);
      assert.equal(outstandingFor(state, 'hanbit-event'), 0);
      assert.equal(state.inventory['book-akashi'].onHand, 480 + (monthlyBatches - batch - 1) * 1000);
    }
    assert.equal(state.company.day, 27);
    assert.ok(calendarSummary(state).daysRemaining >= 0, 'The business run must fit inside each real calendar month.');
    for (const vat of vatScheduleRows(state).filter((row) => row.remainingAmount > 0)) {
      state = payVatAction(state, vat.targetYear, vat.targetMonth, vat.remainingAmount);
    }
    assert.ok(managementReport(state).income.netProfit > 0);
    state = expectClosing(state);
    assert.equal(state.settlements[0].openingCashKrw, periodOpeningCash);
    assert.ok(state.company.cashKrw > periodOpeningCash, 'Real profitable sales must remain playable without donated cash.');
    assert.ok(Object.values(state.inventory).every((row) => Number.isFinite(row.onHand) && row.onHand >= 0));
  }
  assert.deepEqual([state.company.year, state.company.month], [2027, 2]);
  assert.ok(state.company.cashKrw > openingCash);
  assert.equal(state.orders.filter((row) => row.partnerId === 'hanbit-event' && row.status === 'SHIPPED').length, monthlyBatches * 2 * 12);
  assert.equal(state.capitalMarket.financingPlans.length, 0, 'The reference business run must not rely on funding actions or ledger restores.');
});

check('profit-tax branch pays tax, not accounting net loss or COGS again', () => {
  const state = seed();
  // Controlled profit fixture, not a claim that a normal single order earns this much.
  state.orders = [{
    id: 'tax-branch', productId: 'book-akashi', partnerId: 'future-book',
    quantity: 1, shippedQty: 1, unitPrice: 300000000, unitCost: 10000000,
    year: 2026, month: 2, status: 'SHIPPED',
  }];
  const next = expectClosing(state);
  const result = next.settlements[0];
  const profit = 300000000 - 10000000 - fixedExpenses;
  assert.equal(result.operatingProfit, profit);
  assert.equal(result.tax, Math.round(profit * 0.22));
  assert.equal(result.netProfit, profit - result.tax);
  assert.equal(result.netCashflow, -fixedExpenses - result.tax, 'Uncollected sales are not cash receipts.');
});

check('inventory write-down is noncash and is not paid twice', () => {
  const original = seed();
  const valued = closeInventoryValuationAction(original);
  assert.ok(valued.inventoryWriteDowns.some((row) => row.netEffectAmount > 0));
  assert.equal(valued.company.cashKrw, original.company.cashKrw);
  const next = expectClosing(valued);
  assert.ok(next.settlements[0].inventoryWriteDownNet > 0);
  assert.equal(next.settlements[0].netCashflow, -fixedExpenses);
});

check('VAT, campaigns, disclosure, dividend and funding enter the real period flow', () => {
  let state = seed();
  const opening = state.company.cashKrw;
  const vat = vatScheduleRows(state, 2026).find((row) => row.remainingAmount > 0);
  assert.ok(vat);
  const vatAmount = Math.min(vat.remainingAmount, 10000);
  state = payVatAction(state, 2026, vat.targetMonth, vatAmount);
  assert.equal(state.company.cashKrw, opening - vatAmount);
  const product = PRODUCTS[0];
  const campaignCost = 12000000 + product.hype * 80000;
  state = marketingCampaignAction(state, product.id);
  const disclosure = CAPITAL_DISCLOSURE_TYPES[0];
  state = createDisclosureAction(state, disclosure.id);
  const dividendCost = state.capitalMarket.sharesOutstanding * 120;
  state = decideDividendAction(state);
  const financing = CAPITAL_FINANCING_TYPES.find((row) => row.id === 'CORPORATE_BOND');
  state = raiseCapitalAction(state, financing.id);
  assert.equal(state.capitalMarket.debtKrw, financing.debtKrw);
  const expected = -vatAmount - campaignCost - disclosure.costKrw - dividendCost + financing.cashKrw;
  assert.equal(state.company.cashKrw - opening, expected);
  assert.equal(managementReport(state).cashFlow.periodNetCashflow, expected);
  assert.equal(expectClosing(state).settlements[0].netCashflow, expected - fixedExpenses);
});

check('global trading, hedge payment and foreign collection use actual cash changes', () => {
  const original = seed();
  const market = GLOBAL_MARKETS[0];
  let state = createExportPlanAction(original, market.id, PRODUCTS[0].id, 100);
  state = createImportPlanAction(state, market.id, PRODUCTS[2].id, 50);
  assert.equal(state.company.cashKrw, original.company.cashKrw);
  state = createHedgeContractAction(state);
  const premium = state.global.hedgeContracts[0].premiumKrw;
  state = settleGlobalTradeAction(state);
  assert.equal(state.global.exportResults.length, 1);
  assert.equal(state.global.importResults.length, 1);
  const exportCost = state.global.exportResults[0].exportCostKrw;
  const importCost = state.global.importResults[0].landedCostKrw;
  const hedgeReceipt = state.global.hedgeContracts[0].settlementKrw;
  const tradeFlow = -premium - exportCost - importCost + hedgeReceipt;
  assert.equal(state.company.cashKrw, original.company.cashKrw + tradeFlow);
  assert.equal(settleGlobalTradeAction(state).company.cashKrw, state.company.cashKrw);
  const ar = state.global.foreignReceivables[0];
  state = collectForeignReceivableAction(state, ar.id);
  assert.equal(collectForeignReceivableAction(state, ar.id).company.cashKrw, state.company.cashKrw);
  assert.equal(expectClosing(state).settlements[0].netCashflow, tradeFlow + ar.amountKrw - fixedExpenses);
});

check('blocked actions leave cash and period opening untouched', () => {
  const state = seed();
  state.company.cashKrw = 0;
  state.cashFlowPeriod.openingCashKrw = 0;
  const blocked = inboundInventoryAction(state, PRODUCTS[0].id, 1);
  assert.match(blocked.log[0], /현금이 부족/);
  assert.equal(blocked.company.cashKrw, 0);
  assert.deepEqual(blocked.cashFlowPeriod, state.cashFlowPeriod);
  let global = createExportPlanAction(state, GLOBAL_MARKETS[0].id, PRODUCTS[0].id, 1);
  global = settleGlobalTradeAction(global);
  assert.match(global.log[0], /부족/);
  assert.equal(global.company.cashKrw, 0);
  assert.equal(global.global.exportResults.length, 0);
  assert.equal(global.global.exportPlans[0].status, 'ACTIVE');
});

check('new-year closing resets the next period opening', () => {
  const state = seed();
  state.company.month = 12;
  state.cashFlowPeriod.month = 12;
  const next = expectClosing(state);
  assert.deepEqual([next.company.year, next.company.month], [2027, 1]);
  assert.equal(next.settlements[0].month, 12);
});

check('JSON save/load keeps the original opening, not the current balance', () => {
  const original = seed();
  const row = original.receivables.find((ar) => ar.status === 'PARTIAL');
  const state = collectReceivableAction(original, row.id);
  const loaded = normalizeState(clone(state));
  assert.deepEqual(loaded.cashFlowPeriod, original.cashFlowPeriod);
  assert.equal(managementReport(loaded).cashFlow.periodNetCashflow, row.amount - row.collected);
  assert.equal(expectClosing(loaded).settlements[0].netCashflow, row.amount - row.collected - fixedExpenses);
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

check('old saves start an explicit since-load baseline without rewriting history', () => {
  const old = seed();
  delete old.cashFlowPeriod;
  old.company.cashKrw = 1100000000;
  const oldHistory = clone(old.settlements);
  const loaded = normalizeState(clone(old));
  assert.equal(loaded.company.cashKrw, old.company.cashKrw);
  assert.deepEqual(loaded.settlements, oldHistory);
  assert.deepEqual(loaded.cashFlowPeriod, { year: 2026, month: 2, openingCashKrw: old.company.cashKrw, coverage: 'since-load' });
  const row = loaded.receivables.find((ar) => ar.status === 'PARTIAL');
  const state = collectReceivableAction(loaded, row.id);
  assert.deepEqual(normalizeState(clone(state)).cashFlowPeriod, loaded.cashFlowPeriod);
  const next = expectClosing(state);
  assert.equal(next.settlements[0].cashflowCoverage, 'since-load');
  assert.equal(next.settlements[0].netCashflow, row.amount - row.collected - fixedExpenses);
  assert.match(next.log[0], /불러온 뒤/);
  assert.equal(companyReportResultPresentation(state, next).impacts[2].label, '불러온 뒤 현금변화');
  assert.equal(expectClosing(next).settlements[0].cashflowCoverage, 'full-period');
});

check('mismatched or invalid opening metadata cannot masquerade as a full month', () => {
  for (const patch of [null, { year: 2025 }, { month: 12 }, { openingCashKrw: NaN }, { openingCashKrw: '1500000000' }, { coverage: 'unknown' }]) {
    const state = seed();
    state.cashFlowPeriod = patch === null ? null : { ...state.cashFlowPeriod, ...patch };
    const loaded = normalizeState(state);
    assert.equal(loaded.cashFlowPeriod.coverage, 'since-load');
    assert.equal(loaded.cashFlowPeriod.openingCashKrw, state.company.cashKrw);
    assert.equal(managementReport(loaded).cashFlow.periodNetCashflow, 0);
  }
});

check('new ledger snapshots restore both balance and opening metadata', () => {
  const original = seed();
  const snapshotState = createLedgerSnapshotAction(inboundInventoryAction(original, PRODUCTS[0].id, 10));
  assert.deepEqual(snapshotState.ledgerSnapshots[0].payload.cashFlowPeriod, original.cashFlowPeriod);
  const changed = expectClosing(snapshotState);
  for (const mode of ['CORE_STATE', 'FULL_LEDGER']) {
    assert.equal(ledgerRestorePlan(changed, mode).restorable, true);
    const restored = restoreLedgerSnapshotAction(changed, mode);
    assert.equal(restored.restoreHistory[0].status, 'SUCCESS');
    assert.equal(restored.company.cashKrw, snapshotState.company.cashKrw);
    assert.deepEqual(restored.cashFlowPeriod, snapshotState.cashFlowPeriod);
    assert.equal(expectClosing(restored).company.cashKrw, snapshotState.company.cashKrw - fixedExpenses);
  }
  const latest = restoreLatestSnapshotAction(changed);
  assert.deepEqual(latest.cashFlowPeriod, snapshotState.cashFlowPeriod);
  assert.equal(latest.company.cashKrw, snapshotState.company.cashKrw);
});

check('selected non-company restore preserves cash; company restore restores its opening', () => {
  const snapshotState = createLedgerSnapshotAction(seed());
  const changed = inboundInventoryAction(snapshotState, PRODUCTS[0].id, 10);
  const inventoryOnly = restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'inventory_balance');
  assert.equal(inventoryOnly.restoreHistory[0].status, 'SUCCESS');
  assert.equal(inventoryOnly.company.cashKrw, changed.company.cashKrw);
  assert.deepEqual(inventoryOnly.cashFlowPeriod, changed.cashFlowPeriod);
  assert.deepEqual(inventoryOnly.inventory, snapshotState.inventory);
  const companyOnly = restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'company_info');
  assert.equal(companyOnly.restoreHistory[0].status, 'SUCCESS');
  assert.equal(companyOnly.company.cashKrw, snapshotState.company.cashKrw);
  assert.deepEqual(companyOnly.cashFlowPeriod, snapshotState.cashFlowPeriod);
  assert.equal(companyOnly.inventory[PRODUCTS[0].id].onHand, changed.inventory[PRODUCTS[0].id].onHand);
});

check('old snapshot table checksums stay valid and restore an honest partial baseline', () => {
  const original = seed();
  const snapshotState = createLedgerSnapshotAction(original);
  const snapshot = snapshotState.ledgerSnapshots[0];
  delete snapshot.payload.cashFlowPeriod;
  // Recreate the original payload checksum from this fixture, not a historical output file.
  const payloadText = JSON.stringify(snapshot.payload);
  let hash = 0;
  for (let i = 0; i < payloadText.length; i += 1) hash = ((hash << 5) - hash + payloadText.charCodeAt(i)) | 0;
  snapshot.checksum = Math.abs(hash).toString(16).padStart(8, '0');
  const changed = inboundInventoryAction(snapshotState, PRODUCTS[0].id, 100);
  for (const mode of ['CORE_STATE', 'FULL_LEDGER', 'SELECTED_TABLES']) {
    const tables = 'company_info';
    assert.equal(ledgerRestorePlan(changed, mode, tables).restorable, true);
    const restored = restoreLedgerSnapshotAction(changed, mode, tables);
    assert.equal(restored.restoreHistory[0].status, 'SUCCESS');
    assert.equal(restored.company.cashKrw, original.company.cashKrw);
    assert.equal(restored.cashFlowPeriod.openingCashKrw, original.company.cashKrw);
    assert.equal(restored.cashFlowPeriod.coverage, 'since-load');
  }
  const latest = restoreLatestSnapshotAction(changed);
  assert.equal(latest.cashFlowPeriod.coverage, 'since-load');
  assert.equal(latest.cashFlowPeriod.openingCashKrw, original.company.cashKrw);
});

check('live report shows period flow, not the entire cash balance', () => {
  const original = seed();
  assert.equal(reportHistoryTrend(original).latest.netCashflow, 0);
  assert.equal(reportHistoryTrend(original).latest.cashflowDelta, null, 'Legacy history must not be compared as verified full-period flow.');
  const state = inboundInventoryAction(original, PRODUCTS[0].id, 10);
  assert.equal(reportHistoryTrend(state).latest.netCashflow, -PRODUCTS[0].unitCost * 10);
  const next = expectClosing(state);
  const history = reportHistoryTrend(next);
  assert.equal(history.latest.netCashflow, 0);
  assert.equal(history.rows.find((row) => row.period === '2026-02').netCashflow, next.settlements[0].netCashflow);
  const exported = createProgressExportAction(state);
  assert.ok(exported.exportHistory[0].content.includes(`Period Cash Change: ${formatMoney(-PRODUCTS[0].unitCost * 10)}`));
  assert.match(exported.exportHistory[0].content, /Cash Flow Coverage: full-period/);
});

check('unfunded fixed costs are not silently clamped or given free cash', () => {
  let state = seed();
  for (let month = 0; month < 8; month += 1) state = expectClosing(state);
  assert.equal(state.company.cashKrw, 1500000000 - fixedExpenses * 8);
  assert.ok(state.company.cashKrw < 0);
  assert.equal(managementReport(state).riskRows.find((row) => row.label === '현금 런웨이').tone, 'warning');
  const blocked = inboundInventoryAction(state, PRODUCTS[0].id, 1);
  assert.equal(blocked.company.cashKrw, state.company.cashKrw);
  assert.match(blocked.log[0], /현금이 부족/);
  const recovered = raiseCapitalAction(blocked, 'CORPORATE_BOND');
  assert.equal(recovered.company.cashKrw, state.company.cashKrw + 180000000);
  assert.equal(recovered.capitalMarket.debtKrw, 180000000);
});

check('collecting last month\'s actual shipment is cash in the new period only', () => {
  const original = seed();
  const ordered = createOrderAction(original, 'future-book', PRODUCTS[0].id, 10);
  const shipped = shipOrderAction(ordered, ordered.orders[0].id);
  const firstClose = expectClosing(shipped);
  const invoice = shipped.receivables[0];
  const daysToDue = Math.round((Date.parse(invoice.dueDate) - Date.parse(calendarSummary(firstClose).currentDate)) / 86400000);
  const collected = collectReceivableAction(advanceBusinessDayAction(firstClose, daysToDue), invoice.id);
  const secondClose = expectClosing(collected);
  assert.equal(secondClose.settlements[0].netCashflow, invoice.amount - fixedExpenses);
  assert.equal(secondClose.settlements[1].netCashflow, -fixedExpenses);
});

check('closing retains liquidity warnings and records the partial cashflow scope', () => {
  const old = seed();
  delete old.cashFlowPeriod;
  old.company.cashKrw = 900000000;
  const loaded = normalizeState(old);
  const next = expectClosing(loaded);
  assert.equal(companyReportResultPresentation(loaded, next).key, 'liquidityRiskEscalated');
  assert.equal(next.settlements[0].cashflowCoverage, 'since-load');
  assert.match(next.log[0], /불러온 뒤/);
});

// Render the real components and export helpers from current source. JSX is
// compiled in memory, just like the existing observer-layout runtime check.
const jsxModules = new Set([
  '../src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js',
  '../src/app/games/company-report/_components/CompanyReportGlobalCapitalPanels.js',
  '../src/app/games/company-report/_components/CompanyReportManagementPanels.js',
  '../src/app/games/company-report/_components/CompanyReportGuidancePanel.js',
  '../src/app/games/company-report/_components/CompanyReportVisuals.js',
  '../src/app/games/company-report/_lib/companyReportPlayHelpers.js',
  '../src/app/games/_components/GamePlayPrimitives.js',
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
registerHooks({ load(url, context, nextLoad) {
  if (!jsxModules.has(url)) return nextLoad(url, context);
  return {
    format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText,
  };
} });
const { default: LedgerPanel } = await import('../src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js');
const { default: GlobalCapitalPanels } = await import('../src/app/games/company-report/_components/CompanyReportGlobalCapitalPanels.js');
const { default: ManagementPanels } = await import('../src/app/games/company-report/_components/CompanyReportManagementPanels.js');
const { buildCompanyReportGuidance } = await import('../src/app/games/company-report/_components/CompanyReportGuidancePanel.js');
const { buildCompanyReportPlayViewModel } = await import('../src/app/games/company-report/_lib/companyReportPlayViewModel.js');
const { buildCompanyReportExportPayload, buildCompanyReportExportCsv } = await import('../src/app/games/company-report/_lib/companyReportExportRuntime.js');

function renderLedger(state, overrides = {}) {
  return renderToStaticMarkup(React.createElement(LedgerPanel, {
    state,
    orders: orderRows(state), stocks: inventoryRows(state), receivables: receivableRows(state),
    report: reportSummary(state), latestSettlement: state.settlements[0],
    latestSnapshot: null, latestBookmark: null, latestExport: null, latestRestore: null,
    restoreMode: 'FULL_LEDGER', restorePlan: ledgerRestorePlan(state), selectedRestoreTables: '',
    resultPresentation: { action: 'closing', label: '월말 결산', tone: 'warning' },
    recentActionText: state.log[0], quantity: 1, partnerId: 'future-book', productId: PRODUCTS[0].id,
    ...overrides,
  }));
}

check('rendered closing panel shows paid costs, closing cash and partial scope', () => {
  const full = expectClosing(seed());
  const fullHtml = renderLedger(full);
  assert.ok(fullHtml.includes(`고정비 지급 ${formatMoney(fixedExpenses)}`));
  assert.ok(fullHtml.includes(`결산 후 현금 ${formatMoney(full.company.cashKrw)}`));
  assert.ok(fullHtml.includes(`월간 현금변화 ${formatMoney(-fixedExpenses)}`));
  const old = seed();
  delete old.cashFlowPeriod;
  old.company.cashKrw = 900000000;
  const partial = expectClosing(normalizeState(old));
  const partialHtml = renderLedger(partial);
  assert.ok(partialHtml.includes(`불러온 뒤 현금변화 ${formatMoney(-fixedExpenses)}`));
  assert.ok(partialHtml.includes(`결산 후 현금 ${formatMoney(partial.company.cashKrw)}`));
  assert.ok(!renderLedger(seed()).includes('고정비 지급'), 'The opening historical settlement must not invent a cash payment.');
});

check('real JSON and CSV export helpers separate cash balance from period flow', () => {
  const original = seed();
  const state = inboundInventoryAction(original, PRODUCTS[0].id, 10);
  const payload = buildCompanyReportExportPayload({ state, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
  const flow = -PRODUCTS[0].unitCost * 10;
  assert.equal(payload.management.cashFlow.cash, state.company.cashKrw);
  assert.equal(payload.management.cashFlow.openingCashKrw, original.company.cashKrw);
  assert.equal(payload.management.cashFlow.periodNetCashflow, flow);
  assert.equal(payload.management.cashFlow.cashflowCoverage, 'full-period');
  assert.equal(payload.version, SAVE_VERSION);
  const csv = buildCompanyReportExportCsv(payload);
  assert.ok(csv.includes(`"finance","periodNetCashflow","${flow}"`));
  assert.ok(csv.includes('"finance","cashflowCoverage","full-period"'));
  const old = clone(original);
  delete old.cashFlowPeriod;
  const partial = inboundInventoryAction(normalizeState(old), PRODUCTS[0].id, 10);
  const partialPayload = buildCompanyReportExportPayload({ state: partial, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
  assert.equal(partialPayload.management.cashFlow.cashflowCoverage, 'since-load');
  assert.ok(buildCompanyReportExportCsv(partialPayload).includes('"finance","cashflowCoverage","since-load"'));
});

check('actual ledger controls show contractual terms, waiting dates and disabled early collection', () => {
  const ordered = createOrderAction(seed(), 'future-book', 'book-akashi', 10);
  const state = shipOrderAction(ordered, ordered.orders[0].id);
  const id = state.receivables[0].id;
  const view = buildCompanyReportPlayViewModel({ state, selectedReceivableId: id });
  assert.equal(view.selectedReceivable.canCollect, false, 'An explicit waiting invoice must not be silently replaced by another collectible invoice.');
  const pendingHtml = renderLedger(state, view).replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(pendingHtml.includes('결제 30일'));
  assert.ok(pendingHtml.includes('2026-03-04'));
  assert.ok(pendingHtml.includes('남은 작업일 26일'));
  const pendingButton = [...pendingHtml.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map((match) => match[0]).find((button) => button.includes('선택 채권 전액 회수'));
  assert.ok(pendingButton);
  assert.match(pendingButton, /\bdisabled=""/);
  const matured = advanceBusinessDayAction(monthEndCloseAction(state), 3);
  const maturedView = buildCompanyReportPlayViewModel({ state: matured, selectedReceivableId: id });
  assert.equal(maturedView.selectedReceivable.canCollect, true);
  const matureHtml = renderLedger(matured, maturedView).replace(/<!--[\s\S]*?-->/g, '');
  const collectButton = [...matureHtml.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map((match) => match[0]).find((button) => button.includes('선택 채권 전액 회수'));
  assert.ok(collectButton);
  assert.doesNotMatch(collectButton, /\bdisabled=/);
  assert.ok(matureHtml.includes('2026-03-04'));
});

check('guidance recommends waiting for unpaid invoices instead of promising unavailable cash', () => {
  let state = seed();
  for (const row of receivableRows(state).filter((item) => item.canCollect)) state = collectReceivableAction(state, row.id);
  for (let index = 0; index < 2; index += 1) {
    state = createOrderAction(state, 'future-book', 'book-akashi', 10);
    state = shipOrderAction(state, state.orders[0].id);
  }
  const guidanceFor = (value) => buildCompanyReportGuidance({ state: value, ...buildCompanyReportPlayViewModel({ state: value }) });
  assert.equal(calendarSummary(state).collectibleCount, 0);
  assert.equal(guidanceFor(state).primaryAction.title, '결제 대금 입금 대기');
  assert.match(guidanceFor(state).primaryAction.action, /월말 결산 비용/);
  const nextMonth = monthEndCloseAction(state);
  assert.match(guidanceFor(nextMonth).primaryAction.action, /2026-03-04.*일정/);
  const matured = advanceBusinessDayAction(nextMonth, 3);
  assert.equal(guidanceFor(matured).primaryAction.title, '미수 채권 회수');
  assert.equal(calendarSummary(matured).collectibleCount, 1);
});

check('real JSON and CSV exports preserve the same business date and pending payment calendar', () => {
  const ordered = createOrderAction(seed(), 'future-book', 'book-akashi', 10);
  const state = advanceBusinessDayAction(shipOrderAction(ordered, ordered.orders[0].id), 5);
  const payload = buildCompanyReportExportPayload({ state, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
  assert.deepEqual(payload.calendar, calendarSummary(state));
  assert.equal(JSON.parse(JSON.stringify(payload)).calendar.currentDate, '2026-02-07');
  const csv = buildCompanyReportExportCsv(payload);
  assert.ok(csv.includes('"company","businessDate","2026-02-07"'));
  assert.ok(csv.includes('"company","daysRemaining","21"'));
  assert.ok(csv.includes('"company","nextCollectionDate","2026-03-04"'));
});

function renderCapitalPanel(state) {
  return renderToStaticMarkup(React.createElement(GlobalCapitalPanels, {
    state, capitalSummary: capitalMarketSummary(state), globalSummary: globalTradeSummary(state),
    foreignReceivables: [], markets: globalMarketRows(state), globalMarketId: GLOBAL_MARKETS[0].id,
    globalProductId: PRODUCTS[0].id, globalUnits: 100, selectedForeignAr: null,
    disclosureTypeId: CAPITAL_DISCLOSURE_TYPES[0].id, financingTypeId: CAPITAL_FINANCING_TYPES[0].id,
    recentActionText: state.log[0], resultPresentation: { action: 'closing', label: '자본시장 월마감', tone: 'highlight' },
  }));
}

check('rendered market controls show one completed month and reopen only after real month advancement', () => {
  const opened = seed();
  const closed = closeCapitalMarketAction(opened);
  const nextMonth = monthEndCloseAction(closed);
  const legacy = clone(opened);
  legacy.capitalMarket.stockHistory.unshift({ year: 2026, month: 2, sharePrice: 12500, investorTrust: 62, disclosureRisk: 13 });
  for (const [state, disabled] of [[opened, false], [closed, true], [normalizeState(clone(closed)), true], [nextMonth, false], [legacy, true]]) {
    const original = clone(state);
    const html = renderCapitalPanel(state);
    const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
      .map((match) => match[0]).filter((button) => button.includes('자본시장 월마감'));
    assert.equal(buttons.length, 1);
    assert.equal(/\sdisabled(?:=|[\s>])/.test(buttons[0]), disabled);
    if (disabled) {
      assert.ok(html.includes('2026-02 자본시장 월마감 완료. 다음 달에 새 실적을 반영할 수 있습니다.'));
    } else {
      assert.ok(html.includes('이번 달 매출과 순손익을 기준으로 한 번만 반영합니다.'));
    }
    assert.deepEqual(state, original);
  }
});

check('rendered hedge control follows real remaining protection capacity and explains both gains and losses', () => {
  const planned = createExportPlanAction(seed(), 'jp-retail', 'book-akashi', 100);
  const hedged = createHedgeContractAction(planned);
  for (const [state, disabled] of [[seed(), true], [planned, false], [hedged, true]]) {
    const html = renderCapitalPanel(state);
    const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
      .map((match) => match[0]).find((row) => row.includes('환헤지 체결'));
    assert.equal(/\sdisabled(?:=|[\s>])/.test(button), disabled);
    assert.ok(html.includes('65%'));
    assert.ok(html.includes('1.2%'));
    assert.ok(html.includes('이익과 손실을 모두 반영'));
    assert.ok(html.includes(formatMoney(globalTradeSummary(state).hedgeableNotionalKrw)));
  }
});

check('actual management markup exposes FX, hedge cost, hedge settlement and the matching net profit', () => {
  const state = settleGlobalTradeAction(createHedgeContractAction(createExportPlanAction(seed(), 'jp-retail', 'book-akashi', 100)));
  const management = managementReport(state);
  const html = renderToStaticMarkup(React.createElement(ManagementPanels, {
    management, ledgerDiff: [], latestSnapshot: null, restorePlan: ledgerRestorePlan(state),
  }));
  for (const [label, amount] of [
    ['환차손익', management.income.fxGainLossKrw], ['환헤지 계약비', management.income.hedgePremiumExpensesKrw],
    ['환헤지 정산손익', management.income.hedgeSettlementKrw], ['예상 순손익', management.income.netProfit],
  ]) {
    assert.ok(html.includes(label));
    assert.ok(html.includes(formatMoney(amount)));
  }
});

check('actual JSON, CSV and text exports carry the same signed financial income and premiums', () => {
  let state = createHedgeContractAction(createExportPlanAction(seed(), 'jp-retail', 'book-akashi', 100));
  state = monthEndCloseAction(state);
  state = settleGlobalTradeAction(state);
  const payload = buildCompanyReportExportPayload({ state, restoreMode: 'FULL_LEDGER', selectedRestoreTables: '' });
  const csv = buildCompanyReportExportCsv(payload);
  const income = managementReport(state).income;
  for (const key of ['fxGainLossKrw', 'hedgePremiumExpensesKrw', 'hedgeSettlementKrw', 'financialResultKrw', 'profitBeforeTax', 'netProfit']) {
    assert.equal(payload.management.income[key], income[key]);
    assert.ok(csv.includes(`"income","${key}","${income[key]}"`));
  }
  assert.ok(income.hedgeSettlementKrw > 0, 'The normal next-month quote must exercise a real signed hedge settlement.');
  assert.ok(createProgressExportAction(state).exportHistory[0].content.includes(`Financial Result: ${formatMoney(income.financialResultKrw)}`));
});

console.log(JSON.stringify({ pass: true, checks: passed, fixedExpenses, evidence: 'engine, serialized state, real export helpers and static React markup; no account, browser or deployment' }));
