function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function inventoryUnits(state) {
  return Object.values(state?.inventory || {}).reduce(
    (sum, row) => sum + Math.max(0, Number(row?.onHand || 0)),
    0,
  );
}

function collectedAmount(rows, amountKey, collectedKey) {
  return safeArray(rows).reduce(
    (sum, row) => sum + Math.min(
      Math.max(0, Number(row?.[amountKey] || 0)),
      Math.max(0, Number(row?.[collectedKey] || 0)),
    ),
    0,
  );
}

const FEEDBACK_PROFILES = {
  idle: { action: 'ledger', cue: '', label: '최근 원장 결과', tone: 'ready' },
  newRun: { action: 'new', cue: 'start', label: '새 원장 개시', tone: 'highlight' },
  orderCreated: { action: 'order', cue: 'orderCreated', label: '주문 확정', tone: 'success' },
  shipmentPosted: { action: 'shipment', cue: 'shipmentPosted', label: '출고 전표 반영', tone: 'success' },
  receivableCollected: { action: 'collection', cue: 'cashCollect', label: '매출채권 회수', tone: 'success' },
  inventoryInbound: { action: 'production', cue: 'productionPosted', label: '생산 입고 반영', tone: 'success' },
  inventoryValued: { action: 'valuation', cue: 'inventoryValued', label: '재고평가 완료', tone: 'highlight' },
  campaignLaunched: { action: 'sales', cue: 'campaignLaunched', label: '상품 캠페인 집행', tone: 'highlight' },
  vatPaid: { action: 'tax', cue: 'taxPaid', label: '부가세 납부', tone: 'success' },
  exportPlanned: { action: 'export', cue: 'exportPlanned', label: '수출 계획 등록', tone: 'highlight' },
  importPlanned: { action: 'import', cue: 'importPlanned', label: '수입 계획 등록', tone: 'highlight' },
  hedgeSigned: { action: 'hedge', cue: 'hedgeSigned', label: '환헤지 체결', tone: 'success' },
  globalSettled: { action: 'settle', cue: 'globalSettle', label: '수출입 정산', tone: 'success' },
  foreignCollected: { action: 'collection', cue: 'cashCollect', label: '외화채권 회수', tone: 'success' },
  disclosureFiled: { action: 'disclosure', cue: 'disclosureFiled', label: '공시 대응 완료', tone: 'success' },
  dividendDeclared: { action: 'dividend', cue: 'dividendDeclared', label: '배당 결정', tone: 'highlight' },
  capitalRaised: { action: 'capital', cue: 'capitalRaised', label: '자금 조달 완료', tone: 'success' },
  capitalClosed: { action: 'finance', cue: 'capitalClosed', label: '자본시장 월마감', tone: 'highlight' },
  monthClosed: { action: 'closing', cue: 'ledgerClose', label: '월말 결산 완료', tone: 'success' },
  snapshotSaved: { action: 'snapshot', cue: 'snapshotSaved', label: '원장 스냅샷 생성', tone: 'success' },
  restorePreviewed: { action: 'analysis', cue: 'restorePreview', label: '복원 사전 점검', tone: 'highlight' },
  ledgerRestored: { action: 'restore', cue: 'ledgerRestored', label: '원장 복원 완료', tone: 'success' },
  reportBookmarked: { action: 'bookmark', cue: 'reportBookmarked', label: '리포트 북마크', tone: 'success' },
  reportExported: { action: 'download', cue: 'reportExported', label: '진행 리포트 내보내기', tone: 'success' },
  blocked: { action: 'warning', cue: 'warning', label: '원장 처리 불가', tone: 'warning' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /로그인|실패|없습니다|부족|할 수 없습니다|필요합니다|초과|먼저|차단/, force: true, value: { action: 'warning', label: '처리 안내', tone: 'warning' } },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', label: '원장 불러오기', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', label: '원장 저장', tone: 'success' } },
  { pattern: /전적|결산 기록/, force: true, value: { action: 'archive', label: '결산 기록', tone: 'success' } },
  { pattern: /다운로드|JSON|CSV/, force: true, value: { action: 'download', label: '파일 내보내기', tone: 'success' } },
];

const BLOCKED_LOG = /부족|없습니다|입력하세요|초과|먼저|이미 |차단|불가|할 수 없습니다|실패/;

export function companyReportFeedbackSnapshot(state) {
  const global = state?.global || {};
  const capital = state?.capitalMarket || {};
  const restoreHistory = safeArray(state?.restoreHistory);
  return {
    runId: String(state?.runId || ''),
    period: `${Number(state?.company?.year || 0)}-${String(Number(state?.company?.month || 0)).padStart(2, '0')}`,
    latestLog: String(state?.log?.[0] || ''),
    logCount: safeArray(state?.log).length,
    cashKrw: Number(state?.company?.cashKrw || 0),
    reputation: Number(state?.company?.reputation || 0),
    fanBase: Number(state?.company?.fanBase || 0),
    orderCount: safeArray(state?.orders).length,
    shippedCount: safeArray(state?.orders).filter((row) => ['SHIPPED', 'COMPLETED'].includes(row?.status)).length,
    receivableCollected: collectedAmount(state?.receivables, 'amount', 'collected'),
    inventoryUnits: inventoryUnits(state),
    inventoryValuationCount: safeArray(state?.inventoryValuations).length,
    inventoryWriteDownCount: safeArray(state?.inventoryWriteDowns).length,
    vatPaymentCount: safeArray(state?.vatPayments).length,
    settlementCount: safeArray(state?.settlements).length,
    exportPlanCount: safeArray(global.exportPlans).length,
    importPlanCount: safeArray(global.importPlans).length,
    exportResultCount: safeArray(global.exportResults).length,
    importResultCount: safeArray(global.importResults).length,
    foreignCollected: collectedAmount(global.foreignReceivables, 'amountKrw', 'collectedKrw'),
    hedgeCount: safeArray(global.hedgeContracts).length,
    disclosureCount: safeArray(capital.disclosures).length,
    dividendCount: safeArray(capital.dividends).length,
    financingCount: safeArray(capital.financingPlans).length,
    stockHistoryCount: safeArray(capital.stockHistory).length,
    snapshotCount: safeArray(state?.ledgerSnapshots).length,
    restoreHistoryCount: restoreHistory.length,
    latestRestoreType: String(restoreHistory[0]?.type || ''),
    bookmarkCount: safeArray(state?.reportBookmarks).length,
    exportHistoryCount: safeArray(state?.exportHistory).length,
  };
}

function asSnapshot(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'orderCount')
    ? value
    : companyReportFeedbackSnapshot(value);
}

function transitionFromLog(log) {
  if (/복원 dry-run/.test(log)) return 'restorePreviewed';
  if (/복원했습니다|복원 완료|테이블.*복원/.test(log)) return 'ledgerRestored';
  if (/월말 결산 완료/.test(log)) return 'monthClosed';
  if (/자본시장 월마감 완료/.test(log)) return 'capitalClosed';
  if (/재고평가 완료/.test(log)) return 'inventoryValued';
  if (/부가세 .*납부 완료/.test(log)) return 'vatPaid';
  if (/외화채권 .*회수/.test(log)) return 'foreignCollected';
  if (/채권 .*회수/.test(log)) return 'receivableCollected';
  if (/출고 완료/.test(log)) return 'shipmentPosted';
  if (/주문 .*생성/.test(log)) return 'orderCreated';
  if (/생산 입고/.test(log)) return 'inventoryInbound';
  if (/캠페인을 집행/.test(log)) return 'campaignLaunched';
  if (/수출 계획 .*등록/.test(log)) return 'exportPlanned';
  if (/수입 계획 .*등록/.test(log)) return 'importPlanned';
  if (/환헤지 계약을 체결/.test(log)) return 'hedgeSigned';
  if (/글로벌 정산 완료/.test(log)) return 'globalSettled';
  if (/공시 대응을 진행/.test(log)) return 'disclosureFiled';
  if (/배당을 결정/.test(log)) return 'dividendDeclared';
  if (/조달했습니다/.test(log)) return 'capitalRaised';
  if (/스냅샷.*생성/.test(log)) return 'snapshotSaved';
  if (/북마크했습니다/.test(log)) return 'reportBookmarked';
  if (/내보내기 이력/.test(log)) return 'reportExported';
  return '';
}

export function companyReportFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  const logChanged = current.latestLog !== previous.latestLog || current.logCount > previous.logCount;
  if (previous.runId !== current.runId) return 'newRun';
  if (current.latestLog && logChanged && BLOCKED_LOG.test(current.latestLog)) return 'blocked';

  const logTransition = logChanged
    ? transitionFromLog(current.latestLog)
    : '';
  if (logTransition) return logTransition;

  if (current.settlementCount > previous.settlementCount || current.period !== previous.period) return 'monthClosed';
  if (current.vatPaymentCount > previous.vatPaymentCount) return 'vatPaid';
  if (current.orderCount > previous.orderCount) return 'orderCreated';
  if (current.shippedCount > previous.shippedCount) return 'shipmentPosted';
  if (current.receivableCollected > previous.receivableCollected) return 'receivableCollected';
  if (current.inventoryValuationCount > previous.inventoryValuationCount || current.inventoryWriteDownCount > previous.inventoryWriteDownCount) return 'inventoryValued';
  if (current.exportResultCount > previous.exportResultCount || current.importResultCount > previous.importResultCount) return 'globalSettled';
  if (current.inventoryUnits > previous.inventoryUnits) return 'inventoryInbound';
  if (current.exportPlanCount > previous.exportPlanCount) return 'exportPlanned';
  if (current.importPlanCount > previous.importPlanCount) return 'importPlanned';
  if (current.hedgeCount > previous.hedgeCount) return 'hedgeSigned';
  if (current.foreignCollected > previous.foreignCollected) return 'foreignCollected';
  if (current.disclosureCount > previous.disclosureCount) return 'disclosureFiled';
  if (current.dividendCount > previous.dividendCount) return 'dividendDeclared';
  if (current.financingCount > previous.financingCount) return 'capitalRaised';
  if (current.stockHistoryCount > previous.stockHistoryCount) return 'capitalClosed';
  if (current.snapshotCount > previous.snapshotCount) return 'snapshotSaved';
  if (current.restoreHistoryCount > previous.restoreHistoryCount) {
    return current.latestRestoreType === 'DRY_RUN' ? 'restorePreviewed' : 'ledgerRestored';
  }
  if (current.bookmarkCount > previous.bookmarkCount) return 'reportBookmarked';
  if (current.exportHistoryCount > previous.exportHistoryCount) return 'reportExported';
  if (current.reputation > previous.reputation || current.fanBase > previous.fanBase) return 'campaignLaunched';
  return 'idle';
}

export function companyReportResultPresentation(previousValue, currentValue) {
  const current = asSnapshot(currentValue);
  const key = companyReportFeedbackTransition(previousValue, current);
  const profile = { key, ...FEEDBACK_PROFILES[key] };
  if (key === 'newRun') return { ...profile, detail: `${current.period} 경영 원장을 시작했습니다.` };
  return current.latestLog ? { ...profile, detail: current.latestLog } : profile;
}

export function companyReportFeedbackCue(previousValue, currentValue) {
  if (!previousValue || !currentValue || asSnapshot(previousValue).runId !== asSnapshot(currentValue).runId) return '';
  return companyReportResultPresentation(previousValue, currentValue).cue || '';
}

export function companyReportTextPresentation(text, fallback = FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
