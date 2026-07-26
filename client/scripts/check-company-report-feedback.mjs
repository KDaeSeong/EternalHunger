import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  companyReportFeedbackCue,
  companyReportFeedbackSnapshot,
  companyReportFeedbackTransition,
  companyReportResultPresentation,
  companyReportTextPresentation,
} from '../src/app/games/company-report/_lib/companyReportFeedback.js';
import { FIXED_EXPENSES } from '../src/app/games/company-report/_lib/companyReportData.js';
import {
  bookmarkCurrentReportAction,
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
  dryRunLedgerRestoreAction,
  inboundInventoryAction,
  marketingCampaignAction,
  managementReport,
  monthEndCloseAction,
  payVatAction,
  raiseCapitalAction,
  restoreLatestSnapshotAction,
  settleGlobalTradeAction,
  shipOrderAction,
  vatScheduleRows,
} from '../src/app/games/company-report/_lib/companyReportEngine.js';

const routeUrl = new URL('../src/app/games/company-report/', import.meta.url);
const componentUrl = new URL('_components/', routeUrl);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const featureSource = await readFile(new URL('CompanyReportFeatureTabs.js', componentUrl), 'utf8');
const archiveSource = await readFile(new URL('CompanyReportArchiveLedgerPanels.js', componentUrl), 'utf8');
const globalSource = await readFile(new URL('CompanyReportGlobalCapitalPanels.js', componentUrl), 'utf8');
const vatSource = await readFile(new URL('CompanyReportVatInventoryPanels.js', componentUrl), 'utf8');
const guidanceSource = await readFile(new URL('CompanyReportGuidancePanel.js', componentUrl), 'utf8');
const managementSource = await readFile(new URL('CompanyReportManagementPanels.js', componentUrl), 'utf8');
const visualsSource = await readFile(new URL('CompanyReportVisuals.js', componentUrl), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

function seed(runId = 'company-feedback') {
  return createNewState({ now: '2026-07-12T00:00:00.000Z', runId });
}

function expectResult(previous, current, expected) {
  const presentation = companyReportResultPresentation(previous, current);
  assert.equal(companyReportFeedbackTransition(previous, current), expected.key, `${expected.key} 전환을 선택해야 합니다.`);
  assert.equal(presentation.action, expected.action, `${expected.key} 아이콘을 선택해야 합니다.`);
  assert.equal(presentation.cue, expected.cue, `${expected.key} 결과음을 선택해야 합니다.`);
  assert.equal(presentation.tone, expected.tone, `${expected.key} 결과 톤을 선택해야 합니다.`);
  assert.equal(presentation.detail, current.log[0], `${expected.key} 결과 상세에는 최신 원장 로그가 들어가야 합니다.`);
  assert.ok(Array.isArray(presentation.impacts), `${expected.key} 결과에는 구조화된 영향 목록이 있어야 합니다.`);
  return presentation;
}

const base = seed();
const snapshot = companyReportFeedbackSnapshot(base);
assert.equal(snapshot.orderCount, base.orders.length, '초기 주문 수를 집계해야 합니다.');
assert.equal(companyReportFeedbackCue(null, snapshot), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(companyReportFeedbackCue(snapshot, { ...snapshot }), '', '상태 변화가 없으면 결과음을 재생하면 안 됩니다.');

const order = createOrderAction(base, 'future-book', 'book-akashi', 2);
const orderPresentation = expectResult(base, order, { key: 'orderCreated', action: 'order', cue: 'orderCreated', tone: 'success' });
assert.deepEqual(orderPresentation.impacts.map((item) => [item.action, item.value]), [['order', '+1건']], '주문 결과는 주문 증가량을 표시해야 합니다.');

const openOrder = base.orders.find((row) => row.status === 'CONFIRMED');
assert.ok(openOrder, '출고 가능한 초기 주문이 있어야 합니다.');
const shipmentSafeBase = JSON.parse(JSON.stringify(base));
const receivableToClose = shipmentSafeBase.receivables.find(
  (row) => Number(row.amount || 0) > Number(row.collected || 0),
);
receivableToClose.collected = receivableToClose.amount;
receivableToClose.status = 'COLLECTED';
const shipped = shipOrderAction(shipmentSafeBase, openOrder.id);
expectResult(shipmentSafeBase, shipped, { key: 'shipmentPosted', action: 'shipment', cue: 'shipmentPosted', tone: 'success' });

const receivableRiskState = shipOrderAction(base, openOrder.id);
const receivableRiskPresentation = expectResult(base, receivableRiskState, {
  key: 'receivableRiskEscalated',
  action: 'company-receivable-risk',
  cue: 'companyReceivableRisk',
  tone: 'warning',
});
assert.deepEqual(
  receivableRiskPresentation.impacts.map((item) => item.label),
  ['미회수 채권', '매출채권'],
  '미수금 적체 경보는 채권 건수와 금액을 함께 보여야 합니다.',
);
assert.equal(receivableRiskPresentation.impacts[0]?.value, '3건', '미수금 적체 경보는 현재 미회수 채권 수를 표시해야 합니다.');

const newReceivable = receivableRiskState.receivables.find(
  (row) => !base.receivables.some((baseRow) => baseRow.id === row.id),
);
assert.ok(newReceivable, '출고 후 새 매출채권이 생성되어야 합니다.');
const receivableRecoveredState = collectReceivableAction(receivableRiskState, newReceivable.id);
const receivableRecoveryPresentation = expectResult(receivableRiskState, receivableRecoveredState, {
  key: 'receivableRiskRecovered',
  action: 'company-receivable-recovery',
  cue: 'companyReceivableRecovered',
  tone: 'success',
});
assert.equal(receivableRecoveryPresentation.impacts[0]?.value, '2건', '미수금 회복은 남은 미회수 채권 수를 표시해야 합니다.');

const openReceivable = base.receivables.find((row) => Number(row.amount || 0) > Number(row.collected || 0));
assert.ok(openReceivable, '회수 가능한 초기 채권이 있어야 합니다.');
const collected = collectReceivableAction(base, openReceivable.id);
const collectionPresentation = expectResult(base, collected, { key: 'receivableCollected', action: 'collection', cue: 'cashCollect', tone: 'success' });
assert.equal(collectionPresentation.impacts[0]?.action, 'finance', '채권 회수 결과는 현금 변화를 첫 번째로 보여야 합니다.');
assert.equal(collectionPresentation.impacts[1]?.action, 'collection', '채권 회수 결과는 미수금 감소도 보여야 합니다.');
assert.match(collectionPresentation.impacts[0]?.value || '', /^\+[\d,]+원$/, '현금 유입은 부호와 원 단위를 표시해야 합니다.');
assert.match(collectionPresentation.impacts[1]?.value || '', /^-[\d,]+원$/, '채권 감소는 음수 부호와 원 단위를 표시해야 합니다.');

const inbound = inboundInventoryAction(base, 'book-akashi', 2);
expectResult(base, inbound, { key: 'inventoryInbound', action: 'production', cue: 'productionPosted', tone: 'success' });

const inventorySafeState = JSON.parse(JSON.stringify(base));
inventorySafeState.inventory['goods-aero'].onHand += 349;
const inventoryRiskState = inboundInventoryAction(inventorySafeState, 'goods-aero', 2);
const inventoryRiskPresentation = expectResult(inventorySafeState, inventoryRiskState, {
  key: 'inventoryRiskEscalated',
  action: 'company-inventory-risk',
  cue: 'companyInventoryRisk',
  tone: 'warning',
});
assert.deepEqual(inventoryRiskPresentation.impacts.map((item) => item.label), ['총 재고', '현금'], '재고 과잉 경보는 현재 수량과 입고 현금 유출을 보여야 합니다.');
assert.equal(inventoryRiskPresentation.impacts[0]?.value, '2,401개', '재고 과잉 경보는 현재 총 재고를 표시해야 합니다.');
const inventoryRecoveryOrder = createOrderAction(inventoryRiskState, 'future-book', 'goods-aero', 2);
const inventoryRecoveryBuffer = inventoryRecoveryOrder.receivables.find(
  (row) => Number(row.amount || 0) > Number(row.collected || 0),
);
inventoryRecoveryOrder.receivables.unshift({
  ...inventoryRecoveryBuffer,
  id: 'AR-INVENTORY-RISK-BUFFER',
});
const inventoryRecoveredState = shipOrderAction(inventoryRecoveryOrder, inventoryRecoveryOrder.orders[0].id);
const inventoryRecoveryPresentation = expectResult(inventoryRecoveryOrder, inventoryRecoveredState, {
  key: 'inventoryRiskRecovered',
  action: 'company-inventory-recovery',
  cue: 'companyInventoryRecovered',
  tone: 'success',
});
assert.equal(inventoryRecoveryPresentation.impacts[0]?.value, '2,399개', '재고 과잉 해소는 출고 후 총 재고를 표시해야 합니다.');

const valued = closeInventoryValuationAction(base);
expectResult(base, valued, { key: 'inventoryWrittenDown', action: 'inventory-write-down', cue: 'inventoryWriteDown', tone: 'warning' });
assert.match(valued.log[0], /손상 [1-9]/, '초기 재고평가는 실제 평가손실을 발생시켜야 합니다.');

const valuedWithoutLoss = JSON.parse(JSON.stringify(base));
valuedWithoutLoss.inventoryValuations.unshift({ id: 'valuation-no-loss-check' });
valuedWithoutLoss.log.unshift('2026-02 재고평가 완료. 손상 0원 / 환입 0원.');
expectResult(base, valuedWithoutLoss, { key: 'inventoryValued', action: 'valuation', cue: 'inventoryValued', tone: 'highlight' });

const campaigned = marketingCampaignAction(base, 'book-akashi');
expectResult(base, campaigned, { key: 'campaignLaunched', action: 'sales', cue: 'campaignLaunched', tone: 'highlight' });

const vatRow = vatScheduleRows(base).find((row) => row.remainingAmount > 0);
assert.ok(vatRow, '납부 가능한 초기 VAT 예정 행이 있어야 합니다.');
const vatPaid = payVatAction(base, vatRow.targetYear, vatRow.targetMonth, Math.min(1000, vatRow.remainingAmount));
const vatPresentation = expectResult(base, vatPaid, { key: 'vatPaid', action: 'tax', cue: 'taxPaid', tone: 'success' });
assert.deepEqual(vatPresentation.impacts.map((item) => item.action), ['tax', 'finance'], 'VAT 결과는 납부액과 현금 감소를 함께 보여야 합니다.');

const exportPlan = createExportPlanAction(base, 'jp-retail', 'book-akashi', 2);
expectResult(base, exportPlan, { key: 'exportPlanned', action: 'export', cue: 'exportPlanned', tone: 'highlight' });
const importPlan = createImportPlanAction(base, 'jp-retail', 'book-akashi', 2);
expectResult(base, importPlan, { key: 'importPlanned', action: 'import', cue: 'importPlanned', tone: 'highlight' });
const hedged = createHedgeContractAction(base);
expectResult(base, hedged, { key: 'hedgeSigned', action: 'hedge', cue: 'hedgeSigned', tone: 'success' });

const fxPlanOne = createExportPlanAction(base, 'jp-retail', 'book-akashi', 2);
const fxRiskState = createImportPlanAction(fxPlanOne, 'jp-retail', 'book-akashi', 2);
const fxRiskPresentation = expectResult(fxPlanOne, fxRiskState, {
  key: 'fxRiskEscalated',
  action: 'company-fx-risk',
  cue: 'companyFxRisk',
  tone: 'warning',
});
assert.deepEqual(fxRiskPresentation.impacts.map((item) => item.value), ['2건', '0건'], '환노출 경보는 미헤지 계획과 활성 헤지를 함께 보여야 합니다.');
const fxRecoveredState = createHedgeContractAction(fxRiskState);
const fxRecoveryPresentation = expectResult(fxRiskState, fxRecoveredState, {
  key: 'fxRiskRecovered',
  action: 'company-fx-recovery',
  cue: 'companyFxRecovered',
  tone: 'success',
});
assert.deepEqual(fxRecoveryPresentation.impacts.map((item) => item.value), ['1건', '1건'], '환노출 회복은 헤지 후 남은 노출을 보여야 합니다.');

const globalSettled = settleGlobalTradeAction(exportPlan);
expectResult(exportPlan, globalSettled, { key: 'globalSettled', action: 'settle', cue: 'globalSettle', tone: 'success' });
const foreignOpen = globalSettled.global.foreignReceivables.find((row) => row.status === 'OPEN');
assert.ok(foreignOpen, '수출 정산 후 회수 가능한 외화채권이 있어야 합니다.');
const foreignCollected = collectForeignReceivableAction(globalSettled, foreignOpen.id);
expectResult(globalSettled, foreignCollected, { key: 'foreignCollected', action: 'collection', cue: 'foreignCashCollect', tone: 'success' });

const disclosed = createDisclosureAction(base, 'EARNINGS_CALL');
const disclosurePresentation = expectResult(base, disclosed, { key: 'disclosureFiled', action: 'disclosure', cue: 'disclosureFiled', tone: 'success' });
assert.deepEqual(disclosurePresentation.impacts.map((item) => item.label), ['투자자 신뢰', '공시위험', '현금'], '공시 대응은 신뢰·위험·비용을 함께 보여야 합니다.');
const dividend = decideDividendAction(base);
expectResult(base, dividend, { key: 'dividendDeclared', action: 'dividend', cue: 'dividendDeclared', tone: 'highlight' });
const raised = raiseCapitalAction(base, 'RIGHTS_OFFERING');
expectResult(base, raised, { key: 'capitalRaised', action: 'capital', cue: 'capitalRaised', tone: 'success' });
const capitalClosed = closeCapitalMarketAction(base);
expectResult(base, capitalClosed, { key: 'capitalClosed', action: 'finance', cue: 'capitalClosed', tone: 'highlight' });

const riskBase = {
  ...base,
  capitalMarket: { ...base.capitalMarket, investorTrust: 50, disclosureRisk: 34 },
};
const riskEscalated = raiseCapitalAction(riskBase, 'CORPORATE_BOND');
const riskPresentation = expectResult(riskBase, riskEscalated, {
  key: 'capitalRiskEscalated',
  action: 'company-risk',
  cue: 'companyRiskEscalated',
  tone: 'warning',
});
assert.deepEqual(riskPresentation.impacts.map((item) => item.label), ['투자자 신뢰', '공시위험', '현금'], '위험 경보는 신뢰·위험·조달 현금을 함께 보여야 합니다.');

const recoveryBase = {
  ...base,
  capitalMarket: { ...base.capitalMarket, investorTrust: 42, disclosureRisk: 37 },
};
const riskRecovered = createDisclosureAction(recoveryBase, 'GOVERNANCE_FIX');
const recoveryPresentation = expectResult(recoveryBase, riskRecovered, {
  key: 'capitalRiskRecovered',
  action: 'company-recovery',
  cue: 'companyRiskRecovered',
  tone: 'success',
});
assert.deepEqual(recoveryPresentation.impacts.map((item) => item.label), ['투자자 신뢰', '공시위험', '현금'], '위험 회복은 신뢰·위험·대응 비용을 함께 보여야 합니다.');

const fixedExpenseTotal = FIXED_EXPENSES.reduce((sum, row) => sum + Number(row.amount || 0), 0);
const liquiditySafeState = {
  ...base,
  company: { ...base.company, cashKrw: fixedExpenseTotal * 4.5 },
};
const liquidityRiskState = {
  ...liquiditySafeState,
  company: { ...liquiditySafeState.company, cashKrw: fixedExpenseTotal * 3.5 },
  log: ['대규모 선급 비용을 지급해 가용 현금이 감소했습니다.', ...liquiditySafeState.log],
};
const liquidityRiskPresentation = expectResult(liquiditySafeState, liquidityRiskState, {
  key: 'liquidityRiskEscalated',
  action: 'company-liquidity-risk',
  cue: 'companyLiquidityRisk',
  tone: 'warning',
});
assert.deepEqual(
  liquidityRiskPresentation.impacts.map((item) => item.label),
  ['현금 런웨이', '현금'],
  '유동성 위험 경보는 남은 운영 개월과 현금을 함께 보여야 합니다.',
);
assert.equal(liquidityRiskPresentation.impacts[0]?.value, '3.5개월', '유동성 위험 경보는 현재 현금 런웨이를 표시해야 합니다.');

const liquidityRecoveredState = {
  ...liquidityRiskState,
  company: { ...liquidityRiskState.company, cashKrw: fixedExpenseTotal * 4.25 },
  log: ['대형 매출채권을 회수해 현금 여력이 회복되었습니다.', ...liquidityRiskState.log],
};
const liquidityRecoveryPresentation = expectResult(liquidityRiskState, liquidityRecoveredState, {
  key: 'liquidityRiskRecovered',
  action: 'company-liquidity-recovery',
  cue: 'companyLiquidityRecovered',
  tone: 'success',
});
assert.equal(liquidityRecoveryPresentation.impacts[0]?.value, '4.3개월', '유동성 회복은 현재 현금 런웨이를 표시해야 합니다.');

const monthClosed = monthEndCloseAction(base);
const lossClosePresentation = expectResult(base, monthClosed, {
  key: 'monthClosedLoss',
  action: 'company-loss',
  cue: 'companyLoss',
  tone: 'warning',
});
assert.deepEqual(
  lossClosePresentation.impacts.map((item) => item.label),
  ['회계기간', '순손익', '순현금흐름'],
  '적자 월마감은 다음 기간과 손익·현금흐름을 함께 보여야 합니다.',
);
assert.match(lossClosePresentation.impacts[1]?.value || '', /^-[\d,]+원$/, '적자 결산은 음수 순손익을 표시해야 합니다.');

const profitableClose = {
  ...base,
  company: { ...base.company, year: 2026, month: 3 },
  settlements: [{
    year: 2026,
    month: 2,
    totalSales: 180_000_000,
    totalCost: 120_000_000,
    operatingProfit: 60_000_000,
    tax: 13_200_000,
    netProfit: 46_800_000,
    netCashflow: 38_000_000,
  }, ...base.settlements],
  log: ['2026-02 월말 결산 완료. 순손익 46,800,000원.', ...base.log],
};
const profitClosePresentation = expectResult(base, profitableClose, {
  key: 'monthClosedProfit',
  action: 'company-profit',
  cue: 'companyProfit',
  tone: 'success',
});
assert.deepEqual(
  profitClosePresentation.impacts.map((item) => item.value),
  ['2026-03', '+46,800,000원', '+38,000,000원'],
  '흑자 월마감은 다음 기간과 양수 손익·현금흐름을 구조화해 표시해야 합니다.',
);
const snapshotted = createLedgerSnapshotAction(base);
expectResult(base, snapshotted, { key: 'snapshotSaved', action: 'snapshot', cue: 'snapshotSaved', tone: 'success' });
const previewed = dryRunLedgerRestoreAction(snapshotted);
expectResult(snapshotted, previewed, { key: 'restorePreviewed', action: 'analysis', cue: 'restorePreview', tone: 'highlight' });
const changedAfterSnapshot = createOrderAction(snapshotted, 'future-book', 'book-akashi', 1);
const restored = restoreLatestSnapshotAction(changedAfterSnapshot);
expectResult(changedAfterSnapshot, restored, { key: 'ledgerRestored', action: 'restore', cue: 'ledgerRestored', tone: 'success' });
const bookmarked = bookmarkCurrentReportAction(base);
expectResult(base, bookmarked, { key: 'reportBookmarked', action: 'bookmark', cue: 'reportBookmarked', tone: 'success' });
const exported = createProgressExportAction(base);
expectResult(base, exported, { key: 'reportExported', action: 'download', cue: 'reportExported', tone: 'success' });

const blockedBase = { ...base, company: { ...base.company, cashKrw: 0 } };
const blocked = inboundInventoryAction(blockedBase, 'book-akashi', 999);
const liquidityPresentation = expectResult(blockedBase, blocked, { key: 'liquidityBlocked', action: 'finance', cue: 'liquidityWarning', tone: 'warning' });
assert.equal(companyReportTextPresentation(blocked.log[0], liquidityPresentation).action, 'finance', '유동성 부족 텍스트도 현금 아이콘을 유지해야 합니다.');
const blockedAgain = inboundInventoryAction(blocked, 'book-akashi', 999);
expectResult(blocked, blockedAgain, { key: 'liquidityBlocked', action: 'finance', cue: 'liquidityWarning', tone: 'warning' });

const inventoryBlockedBase = JSON.parse(JSON.stringify(base));
inventoryBlockedBase.inventory[openOrder.productId].onHand = 0;
const inventoryBlocked = shipOrderAction(inventoryBlockedBase, openOrder.id);
const inventoryBlockedPresentation = expectResult(inventoryBlockedBase, inventoryBlocked, { key: 'inventoryBlocked', action: 'inventory', cue: 'inventoryAlert', tone: 'warning' });
assert.equal(companyReportTextPresentation(inventoryBlocked.log[0], inventoryBlockedPresentation).action, 'inventory', '재고 부족 텍스트도 재고 아이콘을 유지해야 합니다.');

const newRun = seed('company-feedback-new');
const newPresentation = companyReportResultPresentation(base, newRun);
assert.equal(newPresentation.key, 'newRun', '새 runId는 새 원장 전환이어야 합니다.');
assert.equal(companyReportFeedbackCue(base, newRun), '', '다른 원장을 불러올 때 자동 개시음을 내면 안 됩니다.');
assert.equal(companyReportTextPresentation('로그인하면 원장을 저장할 수 있습니다.').tone, 'warning', '비로그인 안내는 경고 톤이어야 합니다.');
assert.equal(companyReportTextPresentation('원장 상태를 저장했습니다.').action, 'save', '저장 결과는 저장 아이콘이어야 합니다.');
assert.equal(companyReportTextPresentation('저장된 원장을 불러왔습니다.').action, 'load', '불러오기 결과는 폴더 아이콘이어야 합니다.');
assert.equal(companyReportTextPresentation('복원 계획 JSON 다운로드를 준비했습니다.').action, 'download', '파일 내보내기는 다운로드 아이콘이어야 합니다.');

const resultCues = [
  'orderCreated', 'shipmentPosted', 'cashCollect', 'productionPosted', 'inventoryValued', 'inventoryWriteDown',
  'campaignLaunched', 'taxPaid', 'exportPlanned', 'importPlanned', 'hedgeSigned',
  'globalSettle', 'disclosureFiled', 'dividendDeclared', 'capitalRaised', 'capitalClosed',
  'ledgerClose', 'companyProfit', 'companyLoss', 'snapshotSaved', 'restorePreview', 'ledgerRestored', 'reportBookmarked',
  'reportExported', 'foreignCashCollect', 'liquidityWarning', 'inventoryAlert',
  'companyRiskEscalated', 'companyRiskRecovered',
  'companyLiquidityRisk', 'companyLiquidityRecovered',
  'companyReceivableRisk', 'companyReceivableRecovered',
  'companyFxRisk', 'companyFxRecovered',
  'companyInventoryRisk', 'companyInventoryRecovered',
  'warning', 'start',
];
for (const cue of resultCues) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'ledger', 'order', 'shipment', 'collection', 'production', 'inventory', 'valuation', 'inventory-write-down', 'sales', 'tax',
  'export', 'import', 'hedge', 'settle', 'disclosure', 'dividend', 'capital', 'finance',
  'closing', 'snapshot', 'analysis', 'restore', 'bookmark', 'download', 'warning', 'new',
  'archive', 'logs', 'guide', 'policy', 'inspect', 'advisor', 'trade', 'contract',
  'company-risk', 'company-recovery',
  'company-liquidity-risk', 'company-liquidity-recovery',
  'company-loss', 'company-profit',
  'company-receivable-risk', 'company-receivable-recovery',
  'company-fx-risk', 'company-fx-recovery',
  'company-inventory-risk', 'company-inventory-recovery',
]) {
  assert.match(iconSource, new RegExp(`\\n  ['\"]?${icon}['\"]?: `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}

assert.match(pageSource, /const stateRef = useRef\(state\)/, '연속 회계 행동은 최신 상태 참조를 사용해야 합니다.');
assert.match(pageSource, /companyReportResultPresentation\(previousState, nextState\)/, '회계 행동마다 결과 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /resultPresentation=\{resultPresentation\}/, '기능 탭과 상세 패널에 공통 결과 프레젠테이션을 전달해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '상단 결과 패널에 결과 아이콘을 전달해야 합니다.');
assert.match(pageSource, /<CompanyReportImpactStrip items=\{resultPresentation\.impacts\} \/>/, '상단 결과 아래에 구조화된 영향 아이콘을 표시해야 합니다.');
assert.doesNotMatch(pageSource, /StepG-6|business ledger slice/, '게임 설명에 내부 이식 용어를 노출하면 안 됩니다.');
assert.match(pageSource, /playGameSfx\('start'\)/, '사용자가 새 원장을 시작할 때만 개시음을 재생해야 합니다.');

const componentSources = [featureSource, archiveSource, globalSource, vatSource];
for (const source of componentSources) {
  const renderedSource = source.slice(source.lastIndexOf('  return ('));
  for (const match of renderedSource.matchAll(/applyLedgerAction\(/g)) {
    const buttonPrefix = renderedSource.slice(Math.max(0, match.index - 520), match.index);
    assert.match(buttonPrefix, /cue="off"/, '상태 기반 결과음이 있는 버튼은 선행 클릭음을 꺼야 합니다.');
  }
  if (!source.includes('RecentActionResult')) continue;
  assert.match(source, /action=\{resultPresentation\.action\}/, '각 결과 패널에 결과 아이콘을 전달해야 합니다.');
  assert.match(source, /tone=\{resultPresentation\.tone\}/, '각 결과 패널에 결과 톤을 전달해야 합니다.');
}

const visualSources = [featureSource, archiveSource, globalSource, vatSource, guidanceSource, managementSource];
const semanticPanelTitles = visualSources.reduce((sum, source) => sum + [...source.matchAll(/<CompanyReportPanelTitle\b/g)].length, 0);
const helperIconRows = visualSources.reduce((sum, source) => sum + [...source.matchAll(/<CompanyReportIconRow\b/g)].length, 0);
const directIconRows = visualSources.reduce((sum, source) => sum + [...source.matchAll(/className="game-save-row company-report-icon-row/g)].length, 0);
const dynamicIconRows = visualSources.reduce((sum, source) => sum + [...source.matchAll(/className=\{`game-save-row company-report-icon-row/g)].length, 0);
assert.equal(semanticPanelTitles, 48, '회사 리포트의 48개 패널 제목에 의미 아이콘이 있어야 합니다.');
assert.equal(helperIconRows + directIconRows + dynamicIconRows, 27, '핵심 원장과 판단 행 27곳에 의미 아이콘이 있어야 합니다.');
assert.ok(visualSources.every((source) => !source.includes('className="games-panel-title"')), '원시 패널 제목 마크업이 남아 있으면 안 됩니다.');
assert.match(visualsSource, /export function CompanyReportPanelTitle/, '공용 패널 제목 컴포넌트가 필요합니다.');
assert.match(visualsSource, /export function CompanyReportIconRow/, '공용 의미 아이콘 행 컴포넌트가 필요합니다.');
assert.match(visualsSource, /export function CompanyReportImpactStrip/, '최근 처리 영향 아이콘 컴포넌트가 필요합니다.');
assert.match(featureSource, /expectedImpact:/, '운영 큐는 행동별 예상 효과를 제공해야 합니다.');
assert.match(featureSource, /priorityTone:/, '운영 큐는 긴급·권장·정기 우선도를 구분해야 합니다.');
assert.match(managementSource, /action=\{row\.action \|\| 'warning'\}/, '리스크 행은 지표별 의미 아이콘을 사용해야 합니다.');
assert.match(managementSource, /is-risk is-\$\{row\.tone \|\| 'warning'\}/, '리스크 행은 안전·경고 상태를 시각적으로 구분해야 합니다.');
const managementRiskRows = managementReport(base).riskRows;
assert.equal(managementRiskRows.length, 11, '경영 리포트는 환노출과 총 재고를 포함한 11개 위험 지표를 제공해야 합니다.');
assert.ok(managementRiskRows.every((row) => row.action && row.tone), '모든 위험 지표에 의미 아이콘과 상태 톤이 있어야 합니다.');
assert.equal(managementRiskRows.find((row) => row.label === '미헤지 수출입')?.action, 'company-fx-recovery', '안전한 초기 환노출은 회복 아이콘으로 표시해야 합니다.');
assert.match(cssSource, /\.company-report-panel-title h2/, '패널 제목 아이콘 레이아웃이 필요합니다.');
assert.match(cssSource, /\.game-save-row\.company-report-icon-row/, '의미 아이콘 행 레이아웃이 필요합니다.');
assert.match(cssSource, /\.company-report-impact-strip/, '최근 처리 영향 아이콘 레이아웃이 필요합니다.');
assert.match(cssSource, /\.company-report-icon-row\.is-priority-urgent/, '긴급 운영 항목을 시각적으로 구분해야 합니다.');
assert.match(cssSource, /\.company-report-icon-row\.is-risk\.is-safe/, '안전한 리스크 지표는 별도 시각 톤을 사용해야 합니다.');
assert.match(cssSource, /\.company-report-risk-grid \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/, '리스크 지표는 데스크톱에서 2열로 압축해야 합니다.');
assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.company-report-risk-grid \{[\s\S]*grid-template-columns: 1fr/, '모바일 리스크 지표는 1열로 복귀해야 합니다.');

console.log(JSON.stringify({
  feedbackTransitions: 39,
  resultCues: resultCues.length,
  resultPanels: componentSources.reduce((sum, source) => sum + [...source.matchAll(/<RecentActionResult\b/g)].length, 0) + 1,
  semanticPanelTitles,
  semanticIconRows: helperIconRows + directIconRows + dynamicIconRows,
  stateRef: true,
}, null, 2));
