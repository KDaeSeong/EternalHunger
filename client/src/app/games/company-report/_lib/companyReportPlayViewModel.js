import {
  capitalMarketSummary,
  globalMarketRows,
  globalReceivableRows,
  globalTradeSummary,
  inventoryRows,
  inventoryValuationRows,
  inventoryWriteDownRows,
  ledgerDiffRows,
  ledgerRestorePlan,
  managementReport,
  orderRows,
  receivableRows,
  reportHistoryTrend,
  reportSummary,
  scoreState,
  vatPaymentRows,
  vatScheduleRows,
} from './companyReportEngine';

export function buildCompanyReportPlayViewModel({
  restoreMode,
  selectedForeignArId,
  selectedOrderId,
  selectedReceivableId,
  selectedRestoreTables,
  selectedVatKey,
  state,
  vatPaymentAmount,
}) {
  const score = scoreState(state);
  const report = reportSummary(state);
  const management = managementReport(state);
  const reportTrend = reportHistoryTrend(state);
  const globalSummary = globalTradeSummary(state);
  const capitalSummary = capitalMarketSummary(state);
  const markets = globalMarketRows();
  const stocks = inventoryRows(state);
  const inventoryValuations = inventoryValuationRows(state);
  const inventoryWriteDowns = inventoryWriteDownRows(state);
  const orders = orderRows(state);
  const receivables = receivableRows(state);
  const vatSchedule = vatScheduleRows(state);
  const vatPayments = vatPaymentRows(state);
  const foreignReceivables = globalReceivableRows(state);
  const ledgerDiff = ledgerDiffRows(state);
  const restorePlan = ledgerRestorePlan(state, restoreMode, selectedRestoreTables);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
    || orders.find((order) => order.status === 'CONFIRMED')
    || orders[0];
  const selectedReceivable = receivables.find((ar) => ar.id === selectedReceivableId)
    || receivables.find((ar) => ar.remaining > 0)
    || receivables[0];
  const selectedVatRow = vatSchedule.find((row) => row.id === selectedVatKey)
    || vatSchedule.find((row) => row.remainingAmount > 0)
    || vatSchedule[0];
  const selectedForeignAr = foreignReceivables.find((ar) => ar.id === selectedForeignArId)
    || foreignReceivables.find((ar) => ar.remainingKrw > 0)
    || foreignReceivables[0];
  const vatPayAmount = Math.max(0, Math.round(Number(vatPaymentAmount || selectedVatRow?.remainingAmount || 0)));

  return {
    capitalSummary,
    foreignReceivables,
    globalSummary,
    inventoryValuations,
    inventoryWriteDowns,
    latestBookmark: state.reportBookmarks[0],
    latestExport: state.exportHistory[0],
    latestRestore: state.restoreHistory[0],
    latestSettlement: report.latestSettlement,
    latestSnapshot: state.ledgerSnapshots[0],
    ledgerDiff,
    management,
    markets,
    orders,
    receivables,
    report,
    reportTrend,
    restorePlan,
    score,
    selectedForeignAr,
    selectedOrder,
    selectedReceivable,
    selectedVatRow,
    stocks,
    vatPayAmount,
    vatPayments,
    vatSchedule,
  };
}
