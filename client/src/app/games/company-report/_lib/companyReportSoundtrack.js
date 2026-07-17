export const COMPANY_REPORT_BGM_SCENES = Object.freeze({
  board: 'company-board',
  trade: 'company-trade',
  closing: 'company-closing',
  global: 'company-global',
  capital: 'company-capital',
  audit: 'company-audit',
  crisis: 'company-crisis',
});

export const COMPANY_REPORT_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'board', theme: COMPANY_REPORT_BGM_SCENES.board, title: '개장 전 브리핑', icon: 'finance' }),
  Object.freeze({ scene: 'trade', theme: COMPANY_REPORT_BGM_SCENES.trade, title: '주문 흐름', icon: 'trade' }),
  Object.freeze({ scene: 'closing', theme: COMPANY_REPORT_BGM_SCENES.closing, title: '월말의 숫자', icon: 'closing' }),
  Object.freeze({ scene: 'global', theme: COMPANY_REPORT_BGM_SCENES.global, title: '환율의 파도', icon: 'contract' }),
  Object.freeze({ scene: 'capital', theme: COMPANY_REPORT_BGM_SCENES.capital, title: '시장 개장', icon: 'capital' }),
  Object.freeze({ scene: 'audit', theme: COMPANY_REPORT_BGM_SCENES.audit, title: '원장의 잔향', icon: 'snapshot' }),
  Object.freeze({ scene: 'crisis', theme: COMPANY_REPORT_BGM_SCENES.crisis, title: '현금 경보', icon: 'warning' }),
]);

const TAB_SCENES = Object.freeze({
  board: COMPANY_REPORT_BGM_SCENES.board,
  trade: COMPANY_REPORT_BGM_SCENES.trade,
  close: COMPANY_REPORT_BGM_SCENES.closing,
  global: COMPANY_REPORT_BGM_SCENES.global,
  capital: COMPANY_REPORT_BGM_SCENES.capital,
  history: COMPANY_REPORT_BGM_SCENES.audit,
  ledger: COMPANY_REPORT_BGM_SCENES.audit,
  detail: COMPANY_REPORT_BGM_SCENES.audit,
});

const TRADE_RESULTS = new Set([
  'orderCreated',
  'shipmentPosted',
  'receivableCollected',
  'inventoryInbound',
  'campaignLaunched',
]);
const CLOSING_RESULTS = new Set(['inventoryValued', 'vatPaid', 'monthClosed']);
const GLOBAL_RESULTS = new Set(['exportPlanned', 'importPlanned', 'hedgeSigned', 'globalSettled', 'foreignCollected']);
const CAPITAL_RESULTS = new Set(['disclosureFiled', 'dividendDeclared', 'capitalRaised', 'capitalClosed']);
const AUDIT_RESULTS = new Set(['snapshotSaved', 'restorePreviewed', 'ledgerRestored', 'reportBookmarked', 'reportExported']);

export function resolveCompanyReportBgmScene({
  activeTabId = 'board',
  cashKrw = 0,
  cashRunwayMonths = 0,
  disclosureRisk = 0,
  operatingProfit = 0,
} = {}) {
  const runway = Number(cashRunwayMonths || 0);
  const criticalLiquidity = Number(cashKrw || 0) <= 0
    || runway <= 1.5
    || Number(disclosureRisk || 0) >= 60
    || (Number(operatingProfit || 0) < 0 && runway < 4);
  if (criticalLiquidity) return COMPANY_REPORT_BGM_SCENES.crisis;
  return TAB_SCENES[activeTabId] || COMPANY_REPORT_BGM_SCENES.board;
}

export function companyReportResultMusic(presentation = {}) {
  const key = String(presentation?.key || '');
  if (key === 'blocked') return { theme: COMPANY_REPORT_BGM_SCENES.crisis, durationMs: 14_000 };
  if (TRADE_RESULTS.has(key)) return { theme: COMPANY_REPORT_BGM_SCENES.trade, durationMs: 8_000 };
  if (CLOSING_RESULTS.has(key)) return { theme: COMPANY_REPORT_BGM_SCENES.closing, durationMs: key === 'monthClosed' ? 14_000 : 10_000 };
  if (GLOBAL_RESULTS.has(key)) return { theme: COMPANY_REPORT_BGM_SCENES.global, durationMs: 10_000 };
  if (CAPITAL_RESULTS.has(key)) return { theme: COMPANY_REPORT_BGM_SCENES.capital, durationMs: 11_000 };
  if (AUDIT_RESULTS.has(key)) return { theme: COMPANY_REPORT_BGM_SCENES.audit, durationMs: 9_000 };
  if (key === 'newRun') return { theme: COMPANY_REPORT_BGM_SCENES.board, durationMs: 8_000 };
  return null;
}
