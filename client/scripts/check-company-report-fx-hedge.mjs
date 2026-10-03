import assert from 'node:assert/strict';
import {
  collectForeignReceivableAction,
  createExportPlanAction,
  createHedgeContractAction,
  createImportPlanAction,
  createLedgerSnapshotAction,
  createNewState,
  createProgressExportAction,
  formatMoney,
  globalMarketRows,
  globalTradeSummary,
  managementReport,
  monthEndCloseAction,
  normalizeState,
  restoreLatestSnapshotAction,
  restoreLedgerSnapshotAction,
  SAVE_VERSION,
  settleGlobalTradeAction,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';

const seed = () => createNewState({ runId: 'fx-hedge-check', now: '2026-10-03T00:00:00.000Z' });
const clone = (value) => JSON.parse(JSON.stringify(value));
let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.message}`); }
}
function quote(state, marketId, factor) {
  const next = clone(state);
  const market = globalMarketRows(next).find((row) => row.id === marketId);
  next.global.exchangeRateLog.unshift({
    marketId, currency: market.currency, year: next.company.year,
    month: next.company.month, exchangeRateKrw: market.exchangeRateKrw * factor,
  });
  return next;
}
function exportPlan(units = 1000) {
  return createExportPlanAction(seed(), 'jp-retail', 'book-akashi', units);
}
function openForeignReceivable() {
  return settleGlobalTradeAction(exportPlan());
}
function hedgeProfit(state) {
  return managementReport(state).income.hedgeSettlementKrw;
}

check('100 hedge clicks without a foreign exposure cannot mint cash through one import', () => {
  const original = seed();
  const originalCopy = clone(original);
  let state = original;
  for (let i = 0; i < 100; i += 1) state = createHedgeContractAction(state);
  assert.equal(state.global.hedgeContracts.length, 0);
  assert.equal(state.company.cashKrw, original.company.cashKrw);
  assert.equal(state.global.nextHedgeNo, original.global.nextHedgeNo);
  assert.match(state.log[0], /미보호.*없습니다/);
  const settled = settleGlobalTradeAction(createImportPlanAction(state, 'jp-retail', 'book-akashi', 1));
  assert.equal(settled.company.cashKrw, original.company.cashKrw - settled.global.importResults[0].landedCostKrw);
  assert.deepEqual(original, originalCopy);
});

check('a real plan is protected once, to 65 percent, with no invented minimum notional', () => {
  const original = exportPlan(1);
  const before = clone(original);
  let state = createHedgeContractAction(original);
  const contract = state.global.hedgeContracts[0];
  assert.equal(contract.allocations.length, 1);
  assert.equal(contract.allocations[0].sourceId, original.global.exportPlans[0].id);
  assert.ok(contract.notionalKrw > 0 && contract.notionalKrw < 50000000);
  assert.equal(contract.premiumKrw, Math.round(contract.notionalKrw * 0.012));
  for (let i = 0; i < 100; i += 1) state = createHedgeContractAction(state);
  assert.equal(state.global.hedgeContracts.length, 1);
  assert.equal(state.company.cashKrw, original.company.cashKrw - contract.premiumKrw);
  assert.equal(globalTradeSummary(state).hedgeableNotionalKrw, 0);
  assert.deepEqual(original, before);
});

check('a newly added plan can be protected without protecting the earlier plan twice', () => {
  const first = createHedgeContractAction(exportPlan());
  const next = createHedgeContractAction(createImportPlanAction(first, 'na-stream', 'goods-aero', 100));
  assert.equal(next.global.hedgeContracts.length, 2);
  assert.equal(next.global.hedgeContracts[0].allocations.length, 1);
  assert.equal(next.global.hedgeContracts[0].allocations[0].kind, 'IMPORT_PLAN');
  assert.deepEqual(next.global.hedgeContracts[1], first.global.hedgeContracts[0]);
});

check('insufficient premium cash changes no contract, counter or binding', () => {
  const state = exportPlan();
  state.company.cashKrw = 0;
  const blocked = createHedgeContractAction(state);
  assert.match(blocked.log[0], /현금이 부족/);
  assert.deepEqual(blocked.global, state.global);
  assert.equal(blocked.company.cashKrw, 0);
});

for (const factor of [0.8, 1, 1.2]) {
  check(`export hedge offsets only the covered FX movement (${factor}) and never pays a fixed reward`, () => {
    const planned = exportPlan();
    const hedged = createHedgeContractAction(planned);
    const settled = settleGlobalTradeAction(quote(hedged, 'jp-retail', factor));
    const result = settled.global.exportResults[0];
    const contract = settled.global.hedgeContracts[0];
    const expected = Math.round(result.salesKrw * 0.65 * (1 - factor));
    assert.ok(Math.abs(contract.settlementKrw - expected) <= 1);
    assert.equal(contract.status, 'SETTLED');
    assert.equal(hedgeProfit(settled), contract.settlementKrw);
    assert.equal(settleGlobalTradeAction(settled).company.cashKrw, settled.company.cashKrw);
    const unhedged = settleGlobalTradeAction(quote(planned, 'jp-retail', factor));
    const beforeCollection = settled.company.cashKrw;
    const collected = collectForeignReceivableAction(settled, settled.global.foreignReceivables[0].id);
    const control = collectForeignReceivableAction(unhedged, unhedged.global.foreignReceivables[0].id);
    assert.equal(collected.company.cashKrw - beforeCollection, result.receivableAmountKrw);
    assert.equal(collected.company.cashKrw - control.company.cashKrw, contract.settlementKrw - contract.premiumKrw);
    assert.ok(Math.abs((result.fxGainLossKrw + contract.settlementKrw) - result.fxGainLossKrw * 0.35) <= 1);
  });
  check(`import hedge offsets the covered foreign payment, not unrelated receivables (${factor})`, () => {
    const planned = createImportPlanAction(seed(), 'jp-retail', 'book-akashi', 1000);
    const settled = settleGlobalTradeAction(quote(createHedgeContractAction(planned), 'jp-retail', factor));
    const control = settleGlobalTradeAction(quote(planned, 'jp-retail', factor));
    const contract = settled.global.hedgeContracts[0];
    const foreignCost = 1000 * (9000 * 0.72 + 9000 * 0.025);
    assert.ok(Math.abs(contract.settlementKrw - Math.round(foreignCost * 0.65 * (factor - 1))) <= 1);
    assert.equal(settled.company.cashKrw - control.company.cashKrw, contract.settlementKrw - contract.premiumKrw);
    assert.equal(settled.inventory['book-akashi'].onHand, control.inventory['book-akashi'].onHand);
    assert.equal(settled.inventory['book-akashi'].avgCost, control.inventory['book-akashi'].avgCost);
  });
}

check('settling unrelated imports cannot prematurely settle a receivable hedge', () => {
  const state = createHedgeContractAction(openForeignReceivable());
  const contract = clone(state.global.hedgeContracts[0]);
  const settled = settleGlobalTradeAction(createImportPlanAction(quote(state, 'jp-retail', 0.8), 'na-stream', 'goods-aero', 1));
  assert.deepEqual(settled.global.hedgeContracts[0], contract);
  assert.equal(hedgeProfit(settled), 0);
  const collected = collectForeignReceivableAction(settled, settled.global.foreignReceivables[0].id);
  assert.ok(collected.global.hedgeContracts[0].settlementKrw > 0);
  assert.equal(collected.global.hedgeContracts[0].status, 'SETTLED');
  assert.equal(collectForeignReceivableAction(collected, collected.global.foreignReceivables[0].id).company.cashKrw, collected.company.cashKrw);
});

check('a combined contract settles only the allocations whose own transactions complete', () => {
  const open = openForeignReceivable();
  const planned = createImportPlanAction(open, 'na-stream', 'goods-aero', 100);
  const hedged = createHedgeContractAction(planned);
  assert.equal(hedged.global.hedgeContracts[0].allocations.length, 2);
  const settled = settleGlobalTradeAction(quote(quote(hedged, 'jp-retail', 0.8), 'na-stream', 1.1));
  assert.equal(settled.global.hedgeContracts[0].status, 'ACTIVE');
  assert.equal(settled.global.hedgeContracts[0].allocations.filter((row) => row.status === 'SETTLED').length, 1);
  const partialProfit = hedgeProfit(settled);
  const collected = collectForeignReceivableAction(settled, open.global.foreignReceivables[0].id);
  assert.equal(collected.global.hedgeContracts[0].status, 'SETTLED');
  assert.ok(hedgeProfit(collected) > partialProfit);
  assert.equal(hedgeProfit(collected), collected.global.hedgeContracts[0].settlementKrw);
});

check('failed batch settlement cannot collect hedge gains or partially consume contracts', () => {
  const state = quote(createHedgeContractAction(exportPlan()), 'jp-retail', 0.8);
  state.company.cashKrw = 1;
  const before = clone(state);
  const blocked = settleGlobalTradeAction(state);
  assert.match(blocked.log[0], /현금.*부족/);
  assert.equal(blocked.company.cashKrw, state.company.cashKrw);
  assert.deepEqual(blocked.global, state.global);
  assert.deepEqual(state, before);
});

check('forecast shrinkage and duplicate saved links cannot protect more than actual delivered currency', () => {
  const state = createHedgeContractAction(exportPlan());
  state.company.reputation = 0;
  const duplicated = clone(state.global.hedgeContracts[0]);
  duplicated.id = 'HG-duplicate-fixture';
  state.global.hedgeContracts.unshift(duplicated);
  const settled = settleGlobalTradeAction(quote(state, 'jp-retail', 0.8));
  const actual = settled.global.foreignReceivables[0];
  const coveredAmount = settled.global.hedgeContracts.flatMap((row) => row.allocations)
    .reduce((sum, row) => sum + row.settledForeignAmount, 0);
  assert.ok(coveredAmount <= actual.foreignAmount * 0.65 + 1e-8);
  assert.ok(Math.abs(hedgeProfit(settled) - Math.round(settled.global.exportResults[0].salesKrw * 0.65 * 0.2)) <= 1);
});

check('a partially collected currency invoice is hedged and collected only for its unpaid portion', () => {
  const state = openForeignReceivable();
  const row = state.global.foreignReceivables[0];
  row.collectedKrw = Math.round(row.amountKrw * 0.4);
  row.status = 'PARTIAL';
  const unpaid = row.amountKrw - row.collectedKrw;
  const hedged = createHedgeContractAction(state);
  assert.ok(Math.abs(hedged.global.hedgeContracts[0].notionalKrw - unpaid * 0.65) <= 1);
  const collected = collectForeignReceivableAction(quote(hedged, 'jp-retail', 0.8), row.id);
  const expectedCash = Math.round(unpaid * 0.8) + Math.round(unpaid * 0.65 * 0.2);
  assert.ok(Math.abs(collected.company.cashKrw - hedged.company.cashKrw - expectedCash) <= 1);
  assert.equal(collected.global.foreignReceivables[0].collectedKrw, row.amountKrw);
});

check('profitable closing taxes net financial gains and losses rather than operating profit alone', () => {
  for (const factor of [0.8, 1.2]) {
    const state = settleGlobalTradeAction(quote(createHedgeContractAction(exportPlan(20000)), 'jp-retail', factor));
    const income = managementReport(state).income;
    assert.ok(income.profitBeforeTax > 0);
    assert.equal(income.tax, Math.round(income.profitBeforeTax * 0.22));
    assert.notEqual(income.tax, Math.round(income.operatingProfit * 0.22));
    const closed = monthEndCloseAction(state);
    assert.equal(closed.settlements[0].tax, income.tax);
    assert.equal(closed.company.cashKrw, state.company.cashKrw - income.fixedExpenses - income.tax);
  }
});

check('all premiums, signed settlements and FX results reach net profit, closing and export exactly once', () => {
  const planned = createImportPlanAction(exportPlan(), 'na-stream', 'goods-aero', 100);
  const hedged = createHedgeContractAction(planned);
  const state = settleGlobalTradeAction(quote(quote(hedged, 'jp-retail', 0.8), 'na-stream', 1.1));
  const income = managementReport(state).income;
  assert.equal(income.hedgePremiumExpensesKrw, state.global.hedgeContracts[0].premiumKrw);
  assert.equal(income.fxGainLossKrw, state.global.exportResults[0].fxGainLossKrw);
  assert.equal(income.financialResultKrw, income.fxGainLossKrw + income.hedgeSettlementKrw - income.hedgePremiumExpensesKrw);
  assert.equal(income.profitBeforeTax, income.operatingProfit + income.financialResultKrw);
  assert.equal(income.netProfit, income.profitBeforeTax - income.tax);
  const closed = monthEndCloseAction(state);
  assert.equal(closed.settlements[0].financialResultKrw, income.financialResultKrw);
  assert.equal(closed.settlements[0].netProfit, income.netProfit);
  assert.equal(closed.company.cashKrw, state.company.cashKrw - income.fixedExpenses - income.tax);
  assert.equal(managementReport(closed).income.hedgePremiumExpensesKrw, 0);
  assert.equal(hedgeProfit(closed), 0);
  const exported = createProgressExportAction(state).exportHistory[0].content;
  assert.ok(exported.includes(`Hedge Premiums: ${formatMoney(income.hedgePremiumExpensesKrw)}`));
  assert.ok(exported.includes(`Financial Result: ${formatMoney(income.financialResultKrw)}`));
});

check('collection-month FX and hedge results do not re-recognize shipment-month revenue or premium', () => {
  const open = openForeignReceivable();
  const hedged = createHedgeContractAction(open);
  const nextMonth = monthEndCloseAction(hedged);
  const changed = quote(nextMonth, 'jp-retail', 0.8);
  const collected = collectForeignReceivableAction(changed, open.global.foreignReceivables[0].id);
  const income = managementReport(collected).income;
  assert.equal(income.sales, 0);
  assert.equal(income.hedgePremiumExpensesKrw, 0);
  assert.equal(income.fxGainLossKrw, collected.global.foreignReceivables[0].collectionFxGainLossKrw);
  assert.equal(income.hedgeSettlementKrw, collected.global.hedgeContracts[0].settlementKrw);
  assert.equal(income.netProfit, income.operatingProfit + income.financialResultKrw - income.tax);
  assert.ok(collected.settlements[0].hedgePremiumExpensesKrw > 0);
});

check('month progression really changes quoted rates deterministically and records plan and collection rates', () => {
  const original = openForeignReceivable();
  const advanced = monthEndCloseAction(original);
  assert.deepEqual(globalMarketRows(advanced), globalMarketRows(monthEndCloseAction(clone(original))));
  const rate = globalMarketRows(advanced).find((row) => row.id === 'jp-retail').exchangeRateKrw;
  assert.notEqual(rate, globalMarketRows(original)[0].exchangeRateKrw);
  const plan = createExportPlanAction(advanced, 'jp-retail', 'book-akashi', 1);
  assert.equal(plan.global.exportPlans[0].exchangeRateKrw, rate);
  const row = original.global.foreignReceivables[0];
  const collected = collectForeignReceivableAction(advanced, row.id);
  assert.equal(collected.company.cashKrw - advanced.company.cashKrw, Math.round(row.foreignAmount * rate));
  assert.equal(collected.global.foreignReceivables[0].collectedExchangeRateKrw, rate);
});

check('future or malformed quotes do not replace the current positive market rate', () => {
  const state = seed();
  state.global.exchangeRateLog.unshift(
    { marketId: 'jp-retail', year: 2099, month: 1, exchangeRateKrw: 900 },
    { marketId: 'jp-retail', year: 2026, month: 2, exchangeRateKrw: -1 },
  );
  assert.equal(globalMarketRows(state)[0].exchangeRateKrw, 9.2);
});

check('old unlinked contracts keep their paid history but cannot pay the former guaranteed reward', () => {
  const state = seed();
  state.company.cashKrw -= 600000;
  state.global.hedgeContracts = [{ id: 'HG-old', notionalKrw: 50000000, premiumKrw: 600000, status: 'ACTIVE', year: 2026, month: 2 }];
  const original = clone(state);
  const loaded = normalizeState(state);
  assert.deepEqual(loaded.global.hedgeContracts, original.global.hedgeContracts);
  const settled = settleGlobalTradeAction(createImportPlanAction(loaded, 'jp-retail', 'book-akashi', 1));
  assert.equal(settled.global.hedgeContracts[0].settlementKrw, 0);
  assert.equal(settled.company.cashKrw, state.company.cashKrw - settled.global.importResults[0].landedCostKrw);
  assert.equal(managementReport(settled).income.hedgePremiumExpensesKrw, 600000);
  assert.deepEqual(state, original);
});

check('old won-only invoices retain cash amounts rather than inventing missing historical FX', () => {
  const state = seed();
  state.global.foreignReceivables = [{ id: 'FAR-old', marketId: 'jp-retail', amountKrw: 12345, collectedKrw: 345, status: 'OPEN' }];
  const changed = quote(state, 'jp-retail', 1.2);
  const collected = collectForeignReceivableAction(changed, 'FAR-old');
  assert.equal(collected.company.cashKrw, state.company.cashKrw + 12000);
  assert.equal(managementReport(collected).income.fxGainLossKrw, 0);
});

check('unknown legacy settlement dates neither fabricate current profit nor rewrite old cash or history', () => {
  const state = seed();
  state.global.hedgeContracts = [{ id: 'HG-old-settled', status: 'SETTLED', premiumKrw: 600000,
    notionalKrw: 50000000, settlementKrw: 900000, year: 2026, month: 1 }];
  const before = clone(state);
  const loaded = normalizeState(state);
  const income = managementReport(loaded).income;
  assert.equal(income.hedgeSettlementKrw, 0);
  assert.equal(income.hedgePremiumExpensesKrw, 0);
  assert.equal(income.financialIncomeCoverage, 'recorded-only');
  assert.deepEqual(loaded.global, before.global);
  assert.deepEqual(loaded.settlements, before.settlements);
  assert.equal(loaded.company.cashKrw, before.company.cashKrw);
});

check('JSON and snapshots preserve links, premiums, quotes and already settled allocations', () => {
  const open = openForeignReceivable();
  const planned = createImportPlanAction(open, 'na-stream', 'goods-aero', 10);
  const state = settleGlobalTradeAction(quote(createHedgeContractAction(planned), 'na-stream', 1.1));
  assert.equal(state.global.hedgeContracts[0].status, 'ACTIVE');
  const loaded = normalizeState(clone(state));
  assert.deepEqual(loaded.global, state.global);
  assert.deepEqual(managementReport(loaded).income, managementReport(state).income);
  const saved = createLedgerSnapshotAction(loaded);
  const changed = collectForeignReceivableAction(saved, open.global.foreignReceivables[0].id);
  const restored = restoreLatestSnapshotAction(changed);
  assert.deepEqual(restored.global, loaded.global);
  assert.equal(restored.company.cashKrw, loaded.company.cashKrw);
  assert.equal(hedgeProfit(restored), hedgeProfit(loaded));
  const physical = restoreLedgerSnapshotAction(changed, 'FULL_LEDGER');
  assert.equal(physical.restoreHistory[0].status, 'SUCCESS');
  assert.deepEqual(physical.global.hedgeContracts, loaded.global.hedgeContracts);
  assert.equal(physical.company.cashKrw, loaded.company.cashKrw);
  assert.equal(hedgeProfit(physical), hedgeProfit(loaded));
  assert.equal(SAVE_VERSION, 'company-report-v1');
});

console.log(`Company Report FX hedge checks: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
