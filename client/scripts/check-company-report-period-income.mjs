import assert from 'node:assert/strict';
import {
  bookmarkCurrentReportAction,
  closeInventoryValuationAction,
  collectForeignReceivableAction,
  collectReceivableAction,
  createExportPlanAction,
  createHedgeContractAction,
  createImportPlanAction,
  createLedgerSnapshotAction,
  createNewState,
  createOrderAction,
  createProgressExportAction,
  FIXED_EXPENSES,
  formatMoney,
  globalTradeSummary,
  inboundInventoryAction,
  inventoryRows,
  managementReport,
  monthEndCloseAction,
  normalizeState,
  reportHistoryTrend,
  reportSummary,
  restoreLedgerSnapshotAction,
  SAVE_VERSION,
  settleGlobalTradeAction,
  shipOrderAction,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';

const seed = () => createNewState({ runId: 'period-income-check', now: '2026-10-03T00:00:00.000Z' });
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixedExpenses = FIXED_EXPENSES.reduce((sum, row) => sum + row.amount, 0);
let passed = 0;
function check(name, run) { run(); passed += 1; console.log(`PASS ${name}`); }

function expectPeriodMatchesClosing(state) {
  const income = managementReport(state).income;
  const original = clone(state);
  const next = monthEndCloseAction(state);
  const closed = next.settlements[0];
  assert.equal(closed.year, income.year);
  assert.equal(closed.month, income.month);
  assert.equal(closed.totalSales, income.sales);
  assert.equal(closed.totalCost, income.totalCost);
  assert.equal(closed.operatingProfit, income.operatingProfit);
  assert.equal(closed.tax, income.tax);
  assert.equal(closed.netProfit, income.netProfit);
  assert.equal(next.company.cashKrw, state.company.cashKrw - fixedExpenses - income.tax);
  assert.equal(closed.closingAssetsKrw, reportSummary(next).assets);
  assert.equal(closed.closingReceivableKrw, reportSummary(next).receivableAmount);
  assert.deepEqual(state, original, 'Reporting and closing must not mutate the input ledger.');
  return next;
}

function delayedShipment() {
  let state = createOrderAction(seed(), 'future-book', 'book-akashi', 10);
  const orderId = state.orders[0].id;
  state = monthEndCloseAction(state);
  return shipOrderAction(state, orderId);
}

check('order is earned in shipment month, not order month or collection month', () => {
  const state = delayedShipment();
  const order = state.orders[0];
  assert.equal(order.month, 2);
  assert.deepEqual([order.shippedYear, order.shippedMonth], [2026, 3]);
  assert.equal(state.receivables[0].month, 3);
  assert.equal(managementReport(state).income.sales, 280000);
  assert.equal(managementReport(state).income.cogs, 90000);
  const march = expectPeriodMatchesClosing(state);
  assert.equal(march.settlements[0].totalSales, 280000);
  assert.equal(march.settlements[1].totalSales, 11800000);
  const collected = collectReceivableAction(march, state.receivables[0].id);
  assert.equal(collected.company.cashKrw, march.company.cashKrw + state.receivables[0].amount);
  assert.equal(expectPeriodMatchesClosing(collected).settlements[0].totalSales, 0);
});

check('duplicate shipment is blocked without moving recognition month', () => {
  const state = delayedShipment();
  const next = monthEndCloseAction(state);
  const duplicate = shipOrderAction(next, state.orders[0].id);
  assert.deepEqual(duplicate.orders[0], state.orders[0]);
  assert.equal(duplicate.receivables.length, state.receivables.length);
  assert.equal(managementReport(duplicate).income.sales, 0);
});

check('old order rows recover actual shipment month from their linked invoice', () => {
  const old = clone(delayedShipment());
  delete old.orders[0].shippedYear;
  delete old.orders[0].shippedMonth;
  const oldHistory = clone(old.settlements);
  const loaded = normalizeState(old);
  assert.equal(managementReport(loaded).income.sales, 280000);
  assert.equal(expectPeriodMatchesClosing(loaded).settlements[0].totalSales, 280000);
  assert.deepEqual(loaded.settlements, oldHistory);
  assert.equal(loaded.orders[0].shippedMonth, undefined, 'A read must not fabricate or rewrite old rows.');
});

check('old seed rows without a dated invoice retain their original period', () => {
  const state = seed();
  state.receivables = [];
  assert.equal(managementReport(state).income.sales, 11800000);
  const malformed = clone(state);
  malformed.receivables = [{ orderId: malformed.orders[0].id, amount: 1 }];
  malformed.orders[0].shippedMonth = 0;
  malformed.orders[0].shippedYear = 2026;
  assert.equal(managementReport(malformed).income.sales, 11800000);
});

check('year rollover records shipment in January of the next year', () => {
  const state = seed();
  state.company.month = 12;
  state.cashFlowPeriod.month = 12;
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 10);
  const january = monthEndCloseAction(ordered);
  const shipped = shipOrderAction(january, ordered.orders[0].id);
  assert.deepEqual([shipped.orders[0].shippedYear, shipped.orders[0].shippedMonth], [2027, 1]);
  assert.equal(expectPeriodMatchesClosing(shipped).settlements[0].totalSales, 280000);
});

check('board and analysis use this month, not the opening historical settlement', () => {
  const state = seed();
  const historical = clone(state.settlements);
  assert.equal(state.settlements[0].totalSales, 41089920);
  const report = reportSummary(state);
  const management = managementReport(state);
  assert.equal(report.sales, 11800000);
  assert.equal(management.income.sales, 11800000);
  assert.equal(management.income.cogs, 3880000);
  assert.equal(management.income.operatingProfit, 11800000 - 3880000 - fixedExpenses);
  assert.equal(management.productRows.reduce((sum, row) => sum + row.value, 0), management.income.sales);
  assert.deepEqual(state.settlements, historical);
  const next = expectPeriodMatchesClosing(state);
  assert.equal(managementReport(next).income.sales, 0);
  assert.equal(managementReport(next).income.cogs, 0);
  assert.equal(managementReport(next).income.operatingProfit, -fixedExpenses);
  assert.deepEqual(managementReport(next).productRows, []);
});

check('inventory turnover is uncomputed before any shipment, not divided by one won', () => {
  const next = monthEndCloseAction(seed());
  const original = clone(next);
  const management = managementReport(next);
  assert.equal(management.income.cogs, 0);
  assert.ok(management.balance.inventoryAmount > 0);
  assert.equal(management.balance.inventoryMonths, null);
  const risk = management.riskRows.find((row) => row.label === '재고 회전 월수');
  assert.equal(risk.value, '집계 전 · 출고 없음');
  assert.equal(risk.action, 'company-inventory-risk');
  assert.ok(management.recommendations.some((message) => message.includes('계산할 수 없습니다')));
  assert.ok(!management.recommendations.some((message) => message.startsWith('재고 회전이 느립니다')));
  assert.deepEqual(next, original);
  const shipped = managementReport(delayedShipment());
  assert.equal(shipped.balance.inventoryMonths, Number((shipped.balance.inventoryAmount / 90000).toFixed(2)));
  assert.match(shipped.riskRows.find((row) => row.label === '재고 회전 월수').value, /^\d+(?:\.\d+)?개월$/);
  const empty = clone(next);
  Object.values(empty.inventory).forEach((stock) => { stock.onHand = 0; stock.reserved = 0; });
  assert.equal(managementReport(empty).balance.inventoryMonths, 0);
  assert.equal(managementReport(empty).riskRows.find((row) => row.label === '재고 회전 월수').value, '0개월');
});

check('real global exports enter income and product analysis once', () => {
  const state = settleGlobalTradeAction(createExportPlanAction(seed(), 'jp-retail', 'book-akashi', 100));
  const result = state.global.exportResults[0];
  const income = managementReport(state).income;
  assert.equal(income.sales, 11800000 + result.salesKrw);
  assert.equal(income.cogs, 3880000 + result.exportCostKrw);
  assert.equal(income.exportSalesKrw, result.salesKrw);
  assert.equal(income.exportCostKrw, result.exportCostKrw);
  assert.equal(managementReport(state).productRows.reduce((sum, row) => sum + row.value, 0), income.sales);
  const next = expectPeriodMatchesClosing(state);
  assert.equal(next.settlements[0].exportSalesKrw, result.salesKrw);
  assert.equal(reportSummary(next).sales, 0, 'Last month\'s export must not be added again to this month.');
  const collected = collectForeignReceivableAction(next, state.global.foreignReceivables[0].id);
  assert.equal(managementReport(collected).income.sales, 0);
  assert.equal(expectPeriodMatchesClosing(collected).settlements[0].exportSalesKrw, 0);
});

check('planned but unsettled exports and inventory imports are not sales or COGS', () => {
  const original = seed();
  const exportPlan = createExportPlanAction(original, 'jp-retail', 'book-akashi', 100);
  assert.equal(managementReport(exportPlan).income.sales, 11800000);
  const importPlan = createImportPlanAction(original, 'jp-retail', 'goods-aero', 50);
  const imported = settleGlobalTradeAction(importPlan);
  assert.ok(imported.company.cashKrw < original.company.cashKrw);
  assert.equal(managementReport(imported).income.sales, 11800000);
  assert.equal(managementReport(imported).income.cogs, 3880000);
  assert.ok(reportSummary(imported).inventoryAmount > reportSummary(original).inventoryAmount);
  expectPeriodMatchesClosing(imported);
});

check('inventory valuation affects current forecast and the same closing profit', () => {
  const state = closeInventoryValuationAction(seed());
  const effect = state.inventoryWriteDowns.reduce((sum, row) => sum + row.netEffectAmount, 0);
  assert.ok(effect > 0);
  assert.equal(managementReport(state).income.operatingProfit, 11800000 - 3880000 - fixedExpenses - effect);
  const next = expectPeriodMatchesClosing(state);
  assert.equal(next.settlements[0].inventoryWriteDownNet, effect);
  assert.equal(managementReport(next).income.inventoryWriteDownNet, 0);
});

check('live trend and progress export share the actual current period', () => {
  const state = delayedShipment();
  const income = managementReport(state).income;
  const latest = reportHistoryTrend(state).latest;
  assert.equal(latest.period, '2026-03');
  assert.equal(latest.sales, 280000);
  assert.equal(latest.cost, income.cogs + fixedExpenses);
  assert.equal(latest.netProfit, income.netProfit);
  const exported = createProgressExportAction(state).exportHistory[0].content;
  assert.match(exported, /Period: 2026-03/);
  assert.ok(exported.includes(`Sales: ${formatMoney(280000)}`));
  assert.ok(exported.includes(`Operating Profit: ${formatMoney(income.operatingProfit)}`));
});

check('closed report bookmarks keep the closed results and balance, not next month\'s actions', () => {
  const closed = expectPeriodMatchesClosing(delayedShipment());
  const result = closed.settlements[0];
  const nextMonth = collectReceivableAction(closed, closed.receivables[0].id);
  const bookmark = bookmarkCurrentReportAction(nextMonth).reportBookmarks[0];
  assert.deepEqual([bookmark.year, bookmark.month], [result.year, result.month]);
  assert.equal(bookmark.sales, result.totalSales);
  assert.equal(bookmark.operatingProfit, result.operatingProfit);
  assert.equal(bookmark.netProfit, result.netProfit);
  assert.equal(bookmark.cashKrw, result.closingCashKrw);
  assert.equal(bookmark.assets, result.closingAssetsKrw);
  assert.equal(bookmark.receivableAmount, result.closingReceivableKrw);
  assert.equal(bookmark.balanceScope, 'closing');
  const legacy = bookmarkCurrentReportAction(seed()).reportBookmarks[0];
  assert.equal(legacy.sales, seed().settlements[0].totalSales);
  assert.equal(legacy.balanceScope, 'bookmark-time');
  assert.match(legacy.note, /북마크 시점 기준/);
});

check('20 real exports keep every result and unpaid invoice, including profitable closing tax', () => {
  let state = seed();
  let sales = 0;
  let costs = 0;
  let receivables = 0;
  for (let i = 0; i < 20; i += 1) {
    state = settleGlobalTradeAction(createExportPlanAction(state, 'jp-retail', 'book-akashi', 1000));
    const result = state.global.exportResults[0];
    sales += result.salesKrw;
    costs += result.exportCostKrw;
    receivables += result.receivableAmountKrw;
  }
  assert.equal(state.global.exportResults.length, 20);
  assert.equal(state.global.exportPlans.length, 20);
  assert.equal(state.global.foreignReceivables.length, 20);
  assert.equal(globalTradeSummary(state).exportSalesKrw, sales);
  assert.equal(globalTradeSummary(state).openForeignReceivableKrw, receivables);
  assert.equal(managementReport(state).income.sales, 11800000 + sales);
  assert.equal(managementReport(state).income.cogs, 3880000 + costs);
  const profit = 11800000 + sales - 3880000 - costs - fixedExpenses;
  assert.ok(profit > 0, 'These ordinary engine actions must actually exercise profitable closing.');
  const next = expectPeriodMatchesClosing(state);
  assert.equal(next.settlements[0].tax, Math.round(profit * 0.22));
  assert.equal(next.settlements[0].netCashflow, -costs - fixedExpenses - next.settlements[0].tax);
  const report = reportSummary(next);
  assert.equal(report.liabilities, report.receivableAmount * 0.08 + report.vatPayableAmount + next.capitalMarket.debtKrw,
    'Profit tax paid at closing must not be recorded again as unpaid debt.');
  const oldest = state.global.foreignReceivables.at(-1);
  const collected = collectForeignReceivableAction(next, oldest.id);
  assert.equal(collected.company.cashKrw, next.company.cashKrw + oldest.amountKrw);
});

check('20 pending plans, imports and 13 paid hedges survive beyond the old display limits', () => {
  let state = seed();
  for (let i = 0; i < 20; i += 1) {
    state = createExportPlanAction(state, 'jp-retail', 'book-akashi', 1);
    state = createImportPlanAction(state, 'jp-retail', 'goods-aero', 1);
  }
  for (let i = 0; i < 13; i += 1) state = createHedgeContractAction(state);
  const loaded = normalizeState(clone(state));
  assert.equal(loaded.global.exportPlans.length, 20);
  assert.equal(loaded.global.importPlans.length, 20);
  assert.equal(loaded.global.hedgeContracts.length, 13);
  const cashBefore = loaded.company.cashKrw;
  const settled = settleGlobalTradeAction(loaded);
  assert.equal(settled.global.exportResults.length, 20);
  assert.equal(settled.global.importResults.length, 20);
  assert.equal(settled.global.hedgeContracts.filter((row) => row.status === 'SETTLED').length, 13);
  const exportCost = settled.global.exportResults.reduce((sum, row) => sum + row.exportCostKrw, 0);
  const importCost = settled.global.importResults.reduce((sum, row) => sum + row.landedCostKrw, 0);
  const hedgeReceipt = settled.global.hedgeContracts.reduce((sum, row) => sum + row.settlementKrw, 0);
  assert.equal(settled.company.cashKrw, cashBefore - exportCost - importCost + hedgeReceipt);
  assert.deepEqual(normalizeState(clone(settled)).global, settled.global);
  const snapshotState = createLedgerSnapshotAction(settled);
  const changed = collectForeignReceivableAction(snapshotState, settled.global.foreignReceivables.at(-1).id);
  const restored = restoreLedgerSnapshotAction(changed);
  assert.equal(restored.restoreHistory[0].status, 'SUCCESS');
  assert.deepEqual(restored.global, settled.global);
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

function importedShipment() {
  let state = createOrderAction(seed(), 'future-book', 'book-akashi', 100);
  const orderId = state.orders[0].id;
  state = settleGlobalTradeAction(createImportPlanAction(state, 'jp-retail', 'book-akashi', 1000));
  const beforeShipment = clone(state);
  return { beforeShipment, state: shipOrderAction(state, orderId), orderId };
}

check('shipment records the real weighted inventory cost after an intervening import', () => {
  const { beforeShipment, state, orderId } = importedShipment();
  const stock = beforeShipment.inventory['book-akashi'];
  const order = state.orders.find((row) => row.id === orderId);
  assert.equal(stock.avgCost, 8395);
  assert.equal(order.unitCost, stock.avgCost);
  assert.equal(order.unitPrice, 28000, 'Actual COGS must not change the agreed sale price.');
  assert.equal(state.inventory['book-akashi'].onHand, stock.onHand - 100);
  assert.equal(state.company.cashKrw, beforeShipment.company.cashKrw, 'Shipment must not pay for inventory twice.');
  assert.equal(managementReport(state).income.localCogs, managementReport(seed()).income.localCogs + stock.avgCost * 100);
  assert.equal(reportSummary(state).assets, reportSummary(beforeShipment).assets - stock.avgCost * 100 + 3080000);
  assert.equal(beforeShipment.orders[0].unitCost, 9000, 'The pre-shipment estimate remains unchanged in the input.');
  expectPeriodMatchesClosing(state);
});

check('later production and valuation do not rewrite a completed shipment cost', () => {
  const shipment = importedShipment();
  const originalIncome = managementReport(shipment.state).income;
  const originalOrder = clone(shipment.state.orders.find((row) => row.id === shipment.orderId));
  let state = inboundInventoryAction(shipment.state, 'book-akashi', 10000);
  assert.notEqual(state.inventory['book-akashi'].avgCost, originalOrder.unitCost);
  assert.equal(managementReport(state).income.localCogs, originalIncome.localCogs);
  state = closeInventoryValuationAction(state);
  assert.equal(managementReport(state).income.localCogs, originalIncome.localCogs);
  assert.deepEqual(state.orders.find((row) => row.id === shipment.orderId), originalOrder);
  expectPeriodMatchesClosing(state);
});

check('valuation before shipment changes actual COGS, not the agreed revenue', () => {
  const ordered = createOrderAction(seed(), 'future-book', 'book-akashi', 100);
  const valued = closeInventoryValuationAction(ordered);
  const unitCost = valued.inventory['book-akashi'].avgCost;
  assert.notEqual(unitCost, ordered.orders[0].unitCost, 'The real valuation action must change the chosen inventory cost.');
  const shipped = shipOrderAction(valued, ordered.orders[0].id);
  assert.equal(shipped.orders[0].unitCost, unitCost);
  assert.equal(managementReport(shipped).income.localCogs - managementReport(valued).income.localCogs, unitCost * 100);
  assert.equal(managementReport(shipped).income.sales - managementReport(valued).income.sales, 2800000);
  expectPeriodMatchesClosing(shipped);
});

check('the next month uses each shipment own actual cost and preserves past closing', () => {
  const shipment = importedShipment();
  let state = monthEndCloseAction(shipment.state);
  const oldClosing = clone(state.settlements[0]);
  const oldOrder = clone(state.orders.find((row) => row.id === shipment.orderId));
  state = inboundInventoryAction(state, 'book-akashi', 1000);
  const unitCost = state.inventory['book-akashi'].avgCost;
  state = createOrderAction(state, 'future-book', 'book-akashi', 10);
  state = shipOrderAction(state, state.orders[0].id);
  assert.equal(managementReport(state).income.localCogs, unitCost * 10);
  assert.deepEqual(state.orders.find((row) => row.id === shipment.orderId), oldOrder);
  const closed = expectPeriodMatchesClosing(state);
  assert.deepEqual(closed.settlements[1], oldClosing);
});

check('zero recorded cost is not replaced by catalog cost in shipment or inventory assets', () => {
  const state = seed();
  state.inventory['book-akashi'].avgCost = 0;
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 10);
  const shipped = shipOrderAction(ordered, ordered.orders[0].id);
  assert.equal(shipped.orders[0].unitCost, 0);
  assert.equal(managementReport(shipped).income.localCogs, managementReport(state).income.localCogs);
  assert.equal(inventoryRows(shipped).find((row) => row.id === 'book-akashi').amount, 0);
  assert.equal(reportSummary(shipped).assets - reportSummary(ordered).assets, 308000);
});

check('import weighted cost preserves recorded zero-value stock', () => {
  const state = seed();
  state.inventory['book-akashi'].avgCost = 0;
  const imported = settleGlobalTradeAction(createImportPlanAction(state, 'jp-retail', 'book-akashi', 100));
  const cost = imported.global.importResults[0].landedCostKrw;
  assert.equal(imported.inventory['book-akashi'].avgCost, Math.round(cost / 580));
});

check('failed and repeated shipments neither debit inventory nor alter historical cost', () => {
  const ordered = createOrderAction(seed(), 'future-book', 'book-akashi', 1000);
  const original = clone(ordered);
  const rejected = shipOrderAction(ordered, ordered.orders[0].id);
  assert.equal(rejected.orders[0].status, 'CONFIRMED');
  assert.deepEqual(rejected.inventory, ordered.inventory);
  assert.deepEqual(rejected.orders, ordered.orders);
  assert.deepEqual(managementReport(rejected).income, managementReport(ordered).income);
  assert.deepEqual(ordered, original);
  const shipment = importedShipment();
  const repeated = shipOrderAction(shipment.state, shipment.orderId);
  assert.deepEqual(repeated.inventory, shipment.state.inventory);
  assert.deepEqual(repeated.orders, shipment.state.orders);
  assert.equal(repeated.receivables.length, shipment.state.receivables.length);
  assert.deepEqual(managementReport(repeated).income, managementReport(shipment.state).income);
});

check('actual shipment costs survive save normalization and ledger restore without migrating old orders', () => {
  const shipment = importedShipment();
  const loaded = normalizeState(clone(shipment.state));
  assert.deepEqual(loaded.orders, shipment.state.orders);
  const snapshotted = createLedgerSnapshotAction(loaded);
  const changed = inboundInventoryAction(snapshotted, 'book-akashi', 100);
  const restored = restoreLedgerSnapshotAction(changed);
  assert.equal(restored.restoreHistory[0].status, 'SUCCESS');
  assert.deepEqual(restored.orders, loaded.orders);
  assert.deepEqual(managementReport(restored).income, managementReport(loaded).income);
  assert.deepEqual(normalizeState(clone(seed())).orders, seed().orders, 'Do not recalculate old shipments against present inventory.');
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

console.log(JSON.stringify({ pass: true, checks: passed, evidence: 'current source actions, serialized state and ledger restore; no historical result files or real account' }));
