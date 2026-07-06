import {
  GAME_SLUG,
  SAVE_VERSION,
  capitalMarketSummary,
  globalTradeSummary,
  ledgerDiffRows,
  ledgerRestorePlan,
  managementReport,
  reportSummary,
  scoreState,
  summaryForState,
} from './companyReportEngine';
import { csvRows } from './companyReportPlayHelpers';

export function buildCompanyReportExportPayload({
  selectedRestoreTables,
  state,
  restoreMode,
}) {
  const exportedReport = reportSummary(state);
  const exportedManagement = managementReport(state);
  const exportedGlobal = globalTradeSummary(state);
  const exportedCapital = capitalMarketSummary(state);
  const exportedRestorePlan = ledgerRestorePlan(state, restoreMode, selectedRestoreTables);

  return {
    gameSlug: GAME_SLUG,
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    period: `${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
    score: scoreState(state),
    summary: summaryForState(state),
    report: exportedReport,
    management: exportedManagement,
    global: exportedGlobal,
    capitalMarket: exportedCapital,
    ledgerDiff: ledgerDiffRows(state),
    restorePlan: exportedRestorePlan,
    latestProgressExport: state.exportHistory[0] || null,
  };
}

export function buildCompanyReportExportCsv(payload) {
  const rows = [
    ['section', 'metric', 'value', 'before', 'after', 'delta'],
    ['company', 'period', payload.period, '', '', ''],
    ['company', 'score', payload.score, '', '', ''],
    ['finance', 'cash', payload.management.cashFlow.cash, '', '', ''],
    ['finance', 'assets', payload.report.assets, '', '', ''],
    ['finance', 'receivables', payload.report.receivableAmount, '', '', ''],
    ['finance', 'inventory', payload.report.inventoryAmount, '', '', ''],
    ['income', 'sales', payload.management.income.sales, '', '', ''],
    ['income', 'operatingProfit', payload.management.income.operatingProfit, '', '', ''],
    ['global', 'exportSalesKrw', payload.global.exportSalesKrw, '', '', ''],
    ['global', 'exportProfitKrw', payload.global.exportProfitKrw, '', '', ''],
    ['capital', 'marketCapKrw', payload.capitalMarket.marketCapKrw, '', '', ''],
    ['capital', 'investorTrust', payload.capitalMarket.investorTrust, '', '', ''],
    ['restore', 'mode', payload.restorePlan.restoreModeLabel, '', '', ''],
    ['restore', 'dryRunStatus', payload.restorePlan.dryRunStatus, '', '', ''],
  ];

  payload.ledgerDiff.forEach((row) => rows.push([
    'ledgerDiff',
    row.label,
    row.deltaText,
    row.before,
    row.after,
    row.deltaText,
  ]));
  payload.restorePlan.tableDiffs.forEach((row) => rows.push([
    'restoreTable',
    row.tableName,
    row.diffStatus,
    row.snapshotRowCount,
    row.currentRowCount,
    `missing ${row.missingInCurrentCount} / extra ${row.extraInCurrentCount} / changed ${row.changedRowCount}`,
  ]));

  return csvRows(rows);
}
