import assert from 'node:assert/strict';
import * as engine from '../src/app/games/company-report/_lib/companyReportEngine.js';

const { createNewState, createOrderAction, shipOrderAction, collectReceivableAction,
  inboundInventoryAction, createExportPlanAction, createImportPlanAction, settleGlobalTradeAction,
  monthEndCloseAction, normalizeState, receivableRows, managementReport,
  createLedgerSnapshotAction, restoreLatestSnapshotAction, restoreLedgerSnapshotAction,
  calendarSummary, advanceBusinessDayAction, SAVE_VERSION } = engine;
const seed = () => createNewState({ runId: 'business-time-check', now: '2026-10-03T00:00:00.000Z' });
const clone = (value) => JSON.parse(JSON.stringify(value));
let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.message}`); }
}
function shipment(partnerId, state = seed(), quantity = 10) {
  const ordered = createOrderAction(state, partnerId, 'book-akashi', quantity);
  return shipOrderAction(ordered, ordered.orders[0].id);
}
function assertOnlyLogChanged(before, after) {
  const copy = clone(after);
  copy.log = before.log;
  copy.updatedAt = before.updatedAt;
  assert.deepEqual(copy, before);
}

check('60-day customer cannot pay immediately or release shipment credit early', () => {
  const state = shipment('globe-media');
  const row = state.receivables[0];
  const blocked = collectReceivableAction(state, row.id);
  assert.equal(blocked.company.cashKrw, state.company.cashKrw);
  assert.deepEqual(blocked.receivables, state.receivables);
  assert.match(blocked.log[0], /결제일.*아직|결제일.*남/);
  assert.equal(receivableRows(state).find((item) => item.id === row.id).canCollect, false);
});

check('100 same-month production, shipment and collection clicks cannot repeat unlimited cash generation', () => {
  let state = seed();
  for (let i = 0; i < 100; i += 1) {
    state = inboundInventoryAction(state, 'book-akashi', 100);
    state = createOrderAction(state, 'globe-media', 'book-akashi', 100);
    state = shipOrderAction(state, state.orders[0].id);
    if (state.receivables[0].orderId === state.orders[0].id) state = collectReceivableAction(state, state.receivables[0].id);
  }
  const shipped = state.orders.filter((row) => row.productId === 'book-akashi' && row.partnerId === 'globe-media' && row.status === 'SHIPPED');
  assert.ok(shipped.length > 0 && shipped.length < 100);
  assert.ok(state.company.cashKrw < seed().company.cashKrw);
  assert.equal(state.company.month, 2);
  assert.ok(calendarSummary(state).daysRemaining < 2);
});

for (const [partnerId, days, dueDate] of [
  ['hanbit-event', 0, '2026-02-02'], ['future-book', 30, '2026-03-04'],
  ['blue-collect', 45, '2026-03-19'], ['globe-media', 60, '2026-04-03'],
]) {
  check(`${days}-day invoice locks actual shipment date and the contractual maturity`, () => {
    const state = shipment(partnerId);
    const row = state.receivables[0];
    assert.equal(row.issuedDate, '2026-02-02');
    assert.equal(row.termDays, days);
    assert.equal(row.dueDate, dueDate);
    const view = receivableRows(state).find((item) => item.id === row.id);
    assert.equal(view.canCollect, days === 0);
    assert.equal(view.daysUntilDue, days);
    if (days === 0) {
      const collected = collectReceivableAction(state, row.id);
      assert.equal(collected.company.cashKrw, state.company.cashKrw + row.amount);
      assert.equal(collected.receivables[0].collectedDate, row.issuedDate);
      assert.equal(collectReceivableAction(collected, row.id).company.cashKrw, collected.company.cashKrw);
    }
  });
}

check('one day before maturity is blocked; exact maturity collects once without creating new revenue', () => {
  let state = shipment('future-book');
  const row = state.receivables[0];
  state = monthEndCloseAction(state);
  state = advanceBusinessDayAction(state, 2);
  assert.equal(calendarSummary(state).currentDate, '2026-03-03');
  assertOnlyLogChanged(state, collectReceivableAction(state, row.id));
  const matured = advanceBusinessDayAction(state, 1);
  const before = clone(matured);
  const collected = collectReceivableAction(matured, row.id);
  assert.equal(collected.company.cashKrw, matured.company.cashKrw + row.amount);
  assert.equal(managementReport(collected).income.sales, managementReport(matured).income.sales);
  assert.equal(managementReport(collected).cashFlow.periodNetCashflow - managementReport(matured).cashFlow.periodNetCashflow, row.amount);
  assert.deepEqual(matured, before);
});

check('overdue status and guidance derive from the simulated date rather than stale saved labels', () => {
  let state = monthEndCloseAction(shipment('future-book'));
  state = advanceBusinessDayAction(state, 4);
  const row = receivableRows(state).find((item) => item.id === state.receivables[0].id);
  assert.equal(row.status, 'OVERDUE');
  assert.equal(row.canCollect, true);
  assert.ok(managementReport(state).cashFlow.overdueAmount >= row.remaining);
});

check('credit stays committed while payment is pending and opens only after the real due date', () => {
  let state = inboundInventoryAction(seed(), 'book-akashi', 1130);
  state = createOrderAction(state, 'future-book', 'book-akashi', 1600);
  state = shipOrderAction(state, state.orders[0].id);
  const invoice = state.receivables[0];
  const early = collectReceivableAction(state, invoice.id);
  const blocked = createOrderAction(early, 'future-book', 'book-akashi', 30);
  assert.match(blocked.log[0], /여신 한도.*부족/);
  state = monthEndCloseAction(state);
  state = advanceBusinessDayAction(state, 4);
  state = collectReceivableAction(state, invoice.id);
  const ordered = createOrderAction(state, 'future-book', 'book-akashi', 30);
  assert.equal(ordered.orders.length, state.orders.length + 1);
});

check('actual production capacity and shipment throughput consume finite workdays without free cash', () => {
  const state = seed();
  const capacity = calendarSummary(state).productionUnitsPerDay;
  const produced = inboundInventoryAction(state, 'book-akashi', capacity + 1);
  assert.equal(produced.company.day, 3);
  assert.equal(produced.company.cashKrw, state.company.cashKrw - (capacity + 1) * 9000);
  const shipped = shipment('globe-media', produced, 100);
  assert.equal(shipped.company.day, 4);
  assert.equal(shipped.company.cashKrw, produced.company.cashKrw);
});

check('work that cannot finish this month preserves cash, stock, invoices and time atomically', () => {
  let state = createOrderAction(seed(), 'hanbit-event', 'book-akashi', 10);
  state = advanceBusinessDayAction(state, calendarSummary(state).daysRemaining);
  const before = clone(state);
  for (const next of [inboundInventoryAction(state, 'book-akashi', 1), shipOrderAction(state, state.orders[0].id)]) {
    assert.match(next.log[0], /작업일.*부족|월말 결산/);
    assertOnlyLogChanged(state, next);
  }
  assert.deepEqual(state, before);
});

check('same-day customer is also bounded by workdays, not an alternative infinite loop', () => {
  let state = seed();
  for (let i = 0; i < 100; i += 1) {
    state = inboundInventoryAction(state, 'book-akashi', 100);
    state = createOrderAction(state, 'hanbit-event', 'book-akashi', 100);
    state = shipOrderAction(state, state.orders[0].id);
    if (state.receivables[0].orderId === state.orders[0].id) state = collectReceivableAction(state, state.receivables[0].id);
  }
  const shipments = state.orders.filter((row) => row.productId === 'book-akashi' && row.partnerId === 'hanbit-event' && row.status === 'SHIPPED').length;
  assert.ok(shipments > 0 && shipments < 28);
  assert.equal(state.company.month, 2);
});

check('bulk global trades cannot bypass the same finite operating capacity', () => {
  let state = createImportPlanAction(createExportPlanAction(seed(), 'jp-retail', 'book-akashi', 100), 'jp-retail', 'goods-aero', 100);
  const original = clone(state);
  const settled = settleGlobalTradeAction(state);
  assert.ok(settled.company.day > state.company.day);
  assert.deepEqual(state, original);
  state = advanceBusinessDayAction(state, calendarSummary(state).daysRemaining);
  const blocked = settleGlobalTradeAction(state);
  assertOnlyLogChanged(state, blocked);
  assert.equal(blocked.global.exportResults.length, 0);
  assert.equal(blocked.global.importResults.length, 0);
});

check('day advancement never crosses a month or pays costs; explicit closing pays once and resets time', () => {
  const original = seed();
  const days = calendarSummary(original).daysRemaining;
  const last = advanceBusinessDayAction(original, days);
  assert.equal(last.company.cashKrw, original.company.cashKrw);
  assert.deepEqual(last.settlements, original.settlements);
  assertOnlyLogChanged(last, advanceBusinessDayAction(last, 1));
  const income = managementReport(last).income;
  const closed = monthEndCloseAction(last);
  assert.deepEqual([closed.company.year, closed.company.month, closed.company.day], [2026, 3, 1]);
  assert.equal(closed.company.cashKrw, last.company.cashKrw - income.fixedExpenses - income.tax);
  assert.equal(calendarSummary(closed).daysRemaining, 30);
});

check('leap day and December rollover use exact dates rather than fixed 30-day approximations', () => {
  const leap = seed();
  leap.company.year = 2028;
  const shipped = shipment('future-book', leap);
  assert.equal(shipped.receivables[0].dueDate, '2028-03-03');
  const december = seed();
  december.company.month = 12;
  const nextYear = shipment('globe-media', december);
  assert.equal(nextYear.receivables[0].dueDate, '2027-01-31');
  const january = monthEndCloseAction(nextYear);
  assert.deepEqual([january.company.year, january.company.month, january.company.day], [2027, 1, 1]);
});

check('old undated invoices retain known cash and history without invented maturity', () => {
  const old = seed();
  delete old.company.day;
  const before = clone(old);
  const loaded = normalizeState(old);
  assert.equal(loaded.company.day, 1);
  assert.deepEqual(loaded.receivables, before.receivables);
  assert.deepEqual(loaded.settlements, before.settlements);
  const row = receivableRows(loaded).find((item) => item.remaining > 0);
  assert.equal(row.timingCoverage, 'legacy-undated');
  assert.equal(row.dueDate, '');
  assert.equal(row.canCollect, true);
  assert.equal(collectReceivableAction(loaded, row.id).company.cashKrw, old.company.cashKrw + row.remaining);
});

check('missing or edited maturity on a new invoice cannot bypass its locked issue date and terms', () => {
  const state = shipment('globe-media');
  for (const changedDue of [null, '2026-02-01', 'bad-date']) {
    const edited = clone(state);
    if (changedDue === null) delete edited.receivables[0].dueDate;
    else edited.receivables[0].dueDate = changedDue;
    const row = receivableRows(edited).find((item) => item.id === edited.receivables[0].id);
    assert.equal(row.dueDate, '2026-04-03');
    assert.equal(row.canCollect, false);
    assertOnlyLogChanged(edited, collectReceivableAction(edited, row.id));
  }
});

check('invalid new invoice dates are blocked, not silently treated as an old collectible invoice', () => {
  const state = shipment('globe-media');
  state.receivables[0].issuedDate = '2026-02-30';
  delete state.receivables[0].dueDate;
  assert.equal(receivableRows(state)[0].canCollect, false);
  assertOnlyLogChanged(state, collectReceivableAction(state, state.receivables[0].id));
});

check('day movement and orders do not mutate inputs or create income, stock, cash or new settlements', () => {
  const original = shipment('future-book');
  const before = clone(original);
  const next = advanceBusinessDayAction(original, 7);
  assert.deepEqual(original, before);
  for (const key of ['inventory', 'orders', 'receivables', 'settlements', 'cashFlowPeriod', 'operatingExpensePeriod']) assert.deepEqual(next[key], original[key]);
  assert.equal(next.company.cashKrw, original.company.cashKrw);
  assert.equal(managementReport(next).income.netProfit, managementReport(original).income.netProfit);
});

check('VAT becomes overdue after its actual 25th-day deadline and payment records the real day', () => {
  const state = monthEndCloseAction(shipment('future-book'));
  const deadline = advanceBusinessDayAction(state, 24);
  const getRow = (value) => engine.vatScheduleRows(value).find((row) => row.id === '2026-02');
  assert.equal(getRow(deadline).dueDate, '2026-03-25');
  assert.equal(getRow(deadline).status, 'DUE');
  const overdue = advanceBusinessDayAction(deadline, 1);
  assert.equal(getRow(overdue).status, 'OVERDUE');
  const paid = engine.payVatAction(overdue, 2026, 2);
  assert.equal(paid.vatPayments[0].paymentDate, '2026-03-26');
  assert.equal(getRow(paid).status, 'PAID');
  assert.equal(paid.company.day, 26);
});

check('text progress export preserves actual date, remaining days and next collection date', () => {
  const state = advanceBusinessDayAction(shipment('future-book'), 5);
  const exported = engine.createProgressExportAction(state);
  assert.match(exported.exportHistory[0].content, /Business Date: 2026-02-07/);
  assert.match(exported.exportHistory[0].content, /Remaining Work Days: 21/);
  assert.match(exported.exportHistory[0].content, /Next Collection Date: 2026-03-04/);
  assert.equal(exported.company.day, 7);
  assert.deepEqual(exported.receivables, state.receivables);
});

check('JSON and both full snapshot paths keep business date, due dates and paid amounts together', () => {
  const state = shipment('future-book');
  const loaded = normalizeState(clone(state));
  assert.deepEqual(calendarSummary(loaded), calendarSummary(state));
  assert.deepEqual(loaded.receivables, state.receivables);
  const saved = createLedgerSnapshotAction(loaded);
  const changed = monthEndCloseAction(advanceBusinessDayAction(saved, 7));
  for (const restore of [restoreLatestSnapshotAction, (value) => restoreLedgerSnapshotAction(value, 'FULL_LEDGER')]) {
    const restored = restore(changed);
    assert.deepEqual(calendarSummary(restored), calendarSummary(state));
    assert.deepEqual(restored.receivables, state.receivables);
    assert.equal(restored.company.cashKrw, state.company.cashKrw);
    assert.equal(receivableRows(restored)[0].canCollect, false);
  }
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

console.log(`Company Report business time checks: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
