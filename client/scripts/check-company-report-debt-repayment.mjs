import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import * as engine from '../src/app/games/company-report/_lib/companyReportEngine.js';

const clone = value => JSON.parse(JSON.stringify(value));
const seed = () => engine.createNewState({ runId: 'debt-repayment-check', now: '2026-11-06T00:00:00.000Z' });
const financed = () => engine.raiseCapitalAction(seed(), 'CORPORATE_BOND');
const group = state => ({ debtKrw: state.capitalMarket.debtKrw,
  debtRepayments: state.capitalMarket.debtRepayments, nextDebtRepaymentNo: state.capitalMarket.nextDebtRepaymentNo });
const otherMarket = state => {
  const { debtKrw, debtRepayments, nextDebtRepaymentNo, ...other } = state.capitalMarket;
  void debtKrw; void debtRepayments; void nextDebtRepaymentNo;
  return other;
};
const withoutMessages = state => {
  const { updatedAt, log, ...rest } = state;
  void updatedAt; void log;
  return rest;
};
let passed = 0;
function check(name, run) { run(); passed += 1; console.log(`PASS ${name}`); }
function rejectUnchanged(state, amount) {
  const original = clone(state);
  const result = engine.repayDebtAction(state, amount);
  assert.deepEqual(withoutMessages(result), withoutMessages(engine.normalizeState(original)));
  assert.deepEqual(state, original, 'A rejected payment cannot mutate its input.');
  return result;
}

// Construct old storage-format metadata from fresh current state only. This is
// fixture serialization, not an archived result or a replacement engine.
const legacyTables = [
  ['company_info', 'company', 'object'], ['inventory_balance', 'inventory', 'objectMap'],
  ['sales_order', 'orders', 'array'], ['account_receivable', 'receivables', 'array'],
  ['vat_payment', 'vatPayments', 'array'], ['inventory_valuation', 'inventoryValuations', 'array'],
  ['inventory_write_down', 'inventoryWriteDowns', 'array'], ['monthly_settlement', 'settlements', 'array'],
  ['global_export_plan', 'global.exportPlans', 'array'], ['global_import_plan', 'global.importPlans', 'array'],
  ['global_export_result', 'global.exportResults', 'array'], ['global_import_result', 'global.importResults', 'array'],
  ['foreign_receivable', 'global.foreignReceivables', 'array'], ['hedge_contract', 'global.hedgeContracts', 'array'],
  ['capital_disclosure', 'capitalMarket.disclosures', 'array'], ['dividend_decision', 'capitalMarket.dividends', 'array'],
  ['financing_plan', 'capitalMarket.financingPlans', 'array'], ['stock_price_history', 'capitalMarket.stockHistory', 'array'],
];
function legacyChecksum(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(16).padStart(8, '0');
}
function legacyRows(payload, [name, key, kind]) {
  const value = key.split('.').reduce((row, part) => row?.[part], payload);
  if (kind === 'object') return value && typeof value === 'object' ? [{ _pk: name, ...value }] : [];
  if (kind === 'objectMap') return Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, row]) => ({ _pk: id, ...(row || {}) }));
  return Array.isArray(value) ? value.map((row, index) => ({ _pk: row?.id || row?.no || row?.yearMonth || String(index), ...(row || {}) })) : [];
}
function legacySnapshot(state) {
  const snapshot = clone(engine.createLedgerSnapshotAction(state).ledgerSnapshots[0]);
  delete snapshot.debtStateChecksum;
  delete snapshot.payload.capitalMarket.debtRepayments;
  delete snapshot.payload.capitalMarket.nextDebtRepaymentNo;
  snapshot.checksum = legacyChecksum(JSON.stringify(snapshot.payload));
  snapshot.manifestChecksum = legacyChecksum(legacyTables.map(table => {
    const rows = legacyRows(snapshot.payload, table);
    const checksum = legacyChecksum(rows.map(row => `${row._pk}:${legacyChecksum(JSON.stringify(row))}`).join('\n'));
    return `${table[0]}:${rows.length}:${checksum}`;
  }).join('\n'));
  snapshot.rowCount = legacyTables.reduce((sum, table) => sum + legacyRows(snapshot.payload, table).length, 0);
  return snapshot;
}

check('real engine exposes voluntary repayment and preserves legacy outstanding principal', () => {
  assert.equal(typeof engine.repayDebtAction, 'function');
  const original = financed();
  delete original.capitalMarket.debtRepayments;
  delete original.capitalMarket.nextDebtRepaymentNo;
  const before = clone(original);
  const state = engine.normalizeState(original);
  assert.equal(state.company.cashKrw, before.company.cashKrw);
  assert.equal(state.capitalMarket.debtKrw, before.capitalMarket.debtKrw);
  assert.deepEqual(state.capitalMarket.debtRepayments, []);
  assert.equal(state.capitalMarket.nextDebtRepaymentNo, 1);
  assert.equal(engine.capitalMarketSummary(state).debtRepaymentCount, 0);
  assert.deepEqual(original, before);
});

check('partial principal payment decreases actual cash and debt equally without changing other market state', () => {
  const state = financed(), before = clone(state), amount = 30000000;
  const next = engine.repayDebtAction(state, amount);
  assert.equal(next.company.cashKrw, state.company.cashKrw - amount);
  assert.equal(next.capitalMarket.debtKrw, state.capitalMarket.debtKrw - amount);
  assert.deepEqual(otherMarket(next), otherMarket(state));
  assert.deepEqual({ ...next.company, cashKrw: state.company.cashKrw }, state.company);
  assert.equal(next.capitalMarket.debtRepayments.length, 1);
  assert.equal(next.capitalMarket.debtRepayments[0].amountKrw, amount);
  assert.ok(next.capitalMarket.debtRepayments[0].id);
  assert.equal(next.capitalMarket.nextDebtRepaymentNo, state.capitalMarket.nextDebtRepaymentNo + 1);
  assert.equal(engine.capitalMarketSummary(next).debtRepaymentCount, 1);
  assert.deepEqual(state, before);
});

check('full repayment reaches zero once and cannot create a negative principal balance', () => {
  const state = financed();
  const next = engine.repayDebtAction(state, state.capitalMarket.debtKrw);
  assert.equal(next.capitalMarket.debtKrw, 0);
  assert.equal(next.company.cashKrw, state.company.cashKrw - state.capitalMarket.debtKrw);
  assert.equal(engine.capitalMarketSummary(next).repayableDebtKrw, 0);
  rejectUnchanged(next, 1);
});

check('invalid, fractional, unsafe, over-debt and unaffordable payments change only messages', () => {
  const state = financed();
  for (const amount of [undefined, null, NaN, Infinity, -Infinity, 0, -1, 0.5,
    Number.MAX_SAFE_INTEGER + 1, '', 'invalid', true, false, [], {}]) rejectUnchanged(state, amount);
  rejectUnchanged(state, state.capitalMarket.debtKrw + 1);
  for (const cash of [0, -1000, 10]) {
    const poor = clone(state); poor.company.cashKrw = cash;
    rejectUnchanged(poor, 11);
    assert.equal(engine.capitalMarketSummary(poor).repayableDebtKrw, Math.max(0, Math.min(cash, poor.capitalMarket.debtKrw)));
  }
});

check('available cash limits repayment without blocking the existing financing recovery path', () => {
  const state = seed(); state.company.cashKrw = -1000000;
  const recovered = engine.raiseCapitalAction(state, 'CORPORATE_BOND');
  assert.ok(recovered.company.cashKrw > 0);
  assert.equal(engine.capitalMarketSummary(recovered).repayableDebtKrw,
    Math.min(recovered.company.cashKrw, recovered.capitalMarket.debtKrw));
  const amount = Math.min(recovered.company.cashKrw, recovered.capitalMarket.debtKrw);
  const paid = engine.repayDebtAction(recovered, amount);
  assert.equal(paid.company.cashKrw, recovered.company.cashKrw - amount);
  assert.equal(paid.capitalMarket.debtKrw, recovered.capitalMarket.debtKrw - amount);
});

check('principal is a cash outflow and never an operating or financial expense, including a taxable month', () => {
  const state = financed();
  state.orders = [{ id: 'CURRENT-DEBT-TAXABLE-SALE', partnerId: 'future-book', productId: 'book-akashi',
    quantity: 50000, shippedQty: 50000, unitPrice: 28000, unitCost: 9000, status: 'SHIPPED',
    year: state.company.year, month: state.company.month, shippedYear: state.company.year, shippedMonth: state.company.month }];
  const beforeIncome = engine.managementReport(state).income;
  assert.ok(beforeIncome.tax > 0, 'Exercise positive tax rather than a zero-tax coincidence.');
  const amount = 25000000, next = engine.repayDebtAction(state, amount);
  assert.deepEqual(engine.managementReport(next).income, beforeIncome);
  assert.deepEqual(next.operatingExpensePeriod, state.operatingExpensePeriod);
  assert.deepEqual(next.cashFlowPeriod, state.cashFlowPeriod);
  assert.equal(engine.managementReport(next).cashFlow.periodNetCashflow,
    engine.managementReport(state).cashFlow.periodNetCashflow - amount);
  const reportBefore = engine.reportSummary(state), reportAfter = engine.reportSummary(next);
  assert.equal(reportAfter.assets, reportBefore.assets - amount);
  assert.equal(reportAfter.liabilities, reportBefore.liabilities - amount);
  assert.equal(reportAfter.equity, reportBefore.equity);
});

check('monthly closing includes the paid cash once while keeping fixed costs, profit and tax identical', () => {
  const state = financed(), amount = 23000000;
  const ordinary = engine.monthEndCloseAction(state);
  const paid = engine.monthEndCloseAction(engine.repayDebtAction(state, amount));
  for (const key of ['totalSales', 'totalCost', 'operatingProfit', 'tax', 'netProfit', 'fixedExpensesPaidKrw', 'financialResultKrw']) {
    assert.equal(paid.settlements[0][key], ordinary.settlements[0][key], key);
  }
  assert.equal(paid.settlements[0].closingCashKrw, ordinary.settlements[0].closingCashKrw - amount);
  assert.equal(paid.settlements[0].netCashflow, ordinary.settlements[0].netCashflow - amount);
  assert.equal(paid.capitalMarket.debtKrw, state.capitalMarket.debtKrw - amount);
  assert.equal(paid.capitalMarket.debtRepayments.length, 1);
  assert.equal(engine.managementReport(paid).cashFlow.periodNetCashflow, 0);
});

check('the full financial repayment history survives log caps, JSON reload and another payment', () => {
  let state = financed();
  const opening = clone(state), receipts = [];
  for (let index = 0; index < 125; index++) {
    state = engine.repayDebtAction(state, 1000);
    receipts.push(clone(state.capitalMarket.debtRepayments.find(row => !receipts.some(old => old.id === row.id))));
  }
  assert.equal(state.capitalMarket.debtRepayments.length, 125);
  assert.equal(new Set(state.capitalMarket.debtRepayments.map(row => row.id)).size, 125);
  assert.equal(state.capitalMarket.nextDebtRepaymentNo, opening.capitalMarket.nextDebtRepaymentNo + 125);
  assert.equal(state.company.cashKrw, opening.company.cashKrw - 125000);
  assert.equal(state.capitalMarket.debtKrw, opening.capitalMarket.debtKrw - 125000);
  for (const receipt of receipts) assert.deepEqual(state.capitalMarket.debtRepayments.find(row => row.id === receipt.id), receipt);
  const encoded = JSON.stringify({ version: engine.SAVE_VERSION, payload: { state } });
  const loaded = engine.normalizeState(JSON.parse(encoded).payload.state);
  assert.deepEqual(group(loaded), group(state));
  assert.deepEqual(engine.managementReport(loaded).income, engine.managementReport(state).income);
  assert.equal(engine.capitalMarketSummary(loaded).debtRepaymentCount, 125);
  const again = engine.repayDebtAction(loaded, 1000);
  assert.equal(again.capitalMarket.debtRepayments.length, 126);
  assert.equal(new Set(again.capitalMarket.debtRepayments.map(row => row.id)).size, 126);
});

check('new full, core and quick snapshots restore cash and the entire debt group together', () => {
  const saved = engine.createLedgerSnapshotAction(engine.repayDebtAction(financed(), 1000000));
  assert.equal(typeof saved.ledgerSnapshots[0].debtStateChecksum, 'string');
  const expected = clone(saved), changed = engine.repayDebtAction(saved, 2000000);
  for (const restore of [state => engine.restoreLatestSnapshotAction(state),
    state => engine.restoreLedgerSnapshotAction(state, 'FULL_LEDGER'),
    state => engine.restoreLedgerSnapshotAction(state, 'CORE_STATE')]) {
    const next = restore(clone(changed));
    assert.equal(next.company.cashKrw, expected.company.cashKrw);
    assert.deepEqual(next.cashFlowPeriod, expected.cashFlowPeriod);
    assert.deepEqual(group(next), group(expected));
  }
});

check('company_info selection restores the coupled debt group while preserving unrelated market state', () => {
  const saved = engine.createLedgerSnapshotAction(financed());
  const changed = engine.repayDebtAction(saved, 31000000);
  changed.capitalMarket.sharePrice += 321;
  changed.capitalMarket.investorTrust -= 5;
  changed.capitalMarket.disclosureRisk += 7;
  const original = clone(changed);
  const restored = engine.restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'company_info');
  assert.equal(restored.company.cashKrw, saved.company.cashKrw);
  assert.deepEqual(restored.cashFlowPeriod, saved.cashFlowPeriod);
  assert.deepEqual(group(restored), group(saved));
  assert.deepEqual(otherMarket(restored), otherMarket(changed));
  assert.equal(engine.ledgerRestorePlan(restored, 'SELECTED_TABLES', 'company_info').afterDiffStatus, 'MATCH');
  assert.deepEqual(changed, original);
});

check('a selection without company_info preserves current cash and repayment state', () => {
  const saved = engine.createLedgerSnapshotAction(financed());
  const changed = engine.repayDebtAction(saved, 13000000);
  changed.capitalMarket.stockHistory = [{ year: 2026, month: 2, sharePrice: 14000, investorTrust: 70, disclosureRisk: 12 }];
  const restored = engine.restoreLedgerSnapshotAction(changed, 'SELECTED_TABLES', 'stock_price_history');
  assert.equal(restored.company.cashKrw, changed.company.cashKrw);
  assert.deepEqual(restored.cashFlowPeriod, changed.cashFlowPeriod);
  assert.deepEqual(group(restored), group(changed));
  assert.deepEqual(restored.capitalMarket.stockHistory, saved.capitalMarket.stockHistory);
});

check('old-format snapshots retain their original manifest and debt without carrying new repayment history', () => {
  const original = financed(), snapshot = legacySnapshot(original);
  const changed = engine.repayDebtAction(original, 12000000);
  changed.ledgerSnapshots = [snapshot];
  for (const restore of [state => engine.restoreLatestSnapshotAction(state),
    state => engine.restoreLedgerSnapshotAction(state, 'FULL_LEDGER'),
    state => engine.restoreLedgerSnapshotAction(state, 'CORE_STATE'),
    state => engine.restoreLedgerSnapshotAction(state, 'SELECTED_TABLES', 'company_info')]) {
    const input = clone(changed), before = clone(input), restored = restore(input);
    assert.equal(restored.company.cashKrw, original.company.cashKrw);
    assert.equal(restored.capitalMarket.debtKrw, original.capitalMarket.debtKrw);
    assert.deepEqual(restored.capitalMarket.debtRepayments, []);
    assert.equal(restored.capitalMarket.nextDebtRepaymentNo, 1);
    assert.equal(engine.ledgerRestorePlan(restored, 'FULL_LEDGER').restorable, true);
    assert.deepEqual(input, before);
    assert.deepEqual(input.ledgerSnapshots[0], snapshot);
  }
});

check('a missing debt checksum cannot disguise new repayment fields as an old-format snapshot', () => {
  const saved = engine.createLedgerSnapshotAction(engine.repayDebtAction(financed(), 1000000));
  const changed = engine.repayDebtAction(saved, 1000000);
  const currentSnapshot = saved.ledgerSnapshots[0];
  assert.ok(Object.hasOwn(currentSnapshot, 'debtStateChecksum'));
  assert.ok(Object.hasOwn(currentSnapshot.payload.capitalMarket, 'debtRepayments'));
  assert.ok(Object.hasOwn(currentSnapshot.payload.capitalMarket, 'nextDebtRepaymentNo'));
  for (const corrupt of [
    () => {},
    snapshot => { snapshot.payload.capitalMarket.debtKrw += 1; },
    snapshot => { snapshot.payload.capitalMarket.debtRepayments[0].amountKrw += 1; },
    snapshot => { delete snapshot.payload.capitalMarket.nextDebtRepaymentNo; },
    snapshot => { delete snapshot.payload.capitalMarket.debtRepayments; },
  ]) {
    const input = clone(changed);
    delete input.ledgerSnapshots[0].debtStateChecksum;
    corrupt(input.ledgerSnapshots[0]);
    const before = clone(input);
    for (const mode of ['FULL_LEDGER', 'CORE_STATE', 'SELECTED_TABLES']) {
      assert.equal(engine.ledgerRestorePlan(input, mode, 'company_info').restorable, false);
      assert.deepEqual(withoutMessages(engine.restoreLedgerSnapshotAction(input, mode, 'company_info')), withoutMessages(before));
    }
    assert.deepEqual(withoutMessages(engine.restoreLatestSnapshotAction(input)), withoutMessages(before));
    assert.deepEqual(input, before, 'The checksum-less source evidence must remain untouched.');
  }
  const legacy = legacySnapshot(financed());
  assert.equal(Object.hasOwn(legacy, 'debtStateChecksum'), false);
  assert.equal(Object.hasOwn(legacy.payload.capitalMarket, 'debtRepayments'), false);
  assert.equal(Object.hasOwn(legacy.payload.capitalMarket, 'nextDebtRepaymentNo'), false);
  const oldInput = clone(changed); oldInput.ledgerSnapshots = [legacy];
  assert.equal(engine.ledgerRestorePlan(oldInput, 'FULL_LEDGER').restorable, true);
  const restored = engine.restoreLatestSnapshotAction(oldInput);
  assert.equal(restored.capitalMarket.debtKrw, legacy.payload.capitalMarket.debtKrw);
  assert.deepEqual(restored.capitalMarket.debtRepayments, []);
});

check('a damaged new debt checksum blocks every debt-restoring entry point without erasing evidence', () => {
  const saved = engine.createLedgerSnapshotAction(engine.repayDebtAction(financed(), 1000000));
  const changed = engine.repayDebtAction(saved, 1000000);
  for (const corrupt of [snapshot => { snapshot.payload.capitalMarket.debtKrw += 1; },
    snapshot => { snapshot.payload.capitalMarket.debtRepayments[0].amountKrw += 1; },
    snapshot => { snapshot.payload.capitalMarket.nextDebtRepaymentNo += 1; }]) {
    const input = clone(changed); corrupt(input.ledgerSnapshots[0]);
    const before = clone(input);
    for (const mode of ['FULL_LEDGER', 'CORE_STATE', 'SELECTED_TABLES']) {
      assert.equal(engine.ledgerRestorePlan(input, mode, 'company_info').restorable, false);
      assert.deepEqual(withoutMessages(engine.restoreLedgerSnapshotAction(input, mode, 'company_info')), withoutMessages(before));
    }
    assert.deepEqual(withoutMessages(engine.restoreLatestSnapshotAction(input)), withoutMessages(before));
    assert.deepEqual(input, before);
  }
});

check('debt-only differences are visible in restore planning and the ledger comparison', () => {
  const saved = engine.createLedgerSnapshotAction(financed());
  const changed = engine.repayDebtAction(saved, 17000000);
  changed.company.cashKrw = saved.company.cashKrw;
  assert.equal(engine.ledgerRestorePlan(changed, 'SELECTED_TABLES', 'company_info').beforeDiffStatus, 'DIFF');
  assert.ok(engine.ledgerDiffRows(changed).some(row => row.deltaValue !== 0));
});

console.log(JSON.stringify({ passed: true, groups: passed,
  scope: 'Fresh actual company engine actions, financial identities, JSON reload and current/old-format snapshot restores only. No archived output fixture, browser, server, new interest, financing cap or score-policy acceptance.' }));
