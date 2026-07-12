import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  companyReportFeedbackCue,
  companyReportFeedbackSnapshot,
  companyReportFeedbackTransition,
  companyReportResultPresentation,
  companyReportTextPresentation,
} from '../src/app/games/company-report/_lib/companyReportFeedback.js';
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
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');

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
}

const base = seed();
const snapshot = companyReportFeedbackSnapshot(base);
assert.equal(snapshot.orderCount, base.orders.length, '초기 주문 수를 집계해야 합니다.');
assert.equal(companyReportFeedbackCue(null, snapshot), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(companyReportFeedbackCue(snapshot, { ...snapshot }), '', '상태 변화가 없으면 결과음을 재생하면 안 됩니다.');

const order = createOrderAction(base, 'future-book', 'book-akashi', 2);
expectResult(base, order, { key: 'orderCreated', action: 'order', cue: 'orderCreated', tone: 'success' });

const openOrder = base.orders.find((row) => row.status === 'CONFIRMED');
assert.ok(openOrder, '출고 가능한 초기 주문이 있어야 합니다.');
const shipped = shipOrderAction(base, openOrder.id);
expectResult(base, shipped, { key: 'shipmentPosted', action: 'shipment', cue: 'shipmentPosted', tone: 'success' });

const openReceivable = base.receivables.find((row) => Number(row.amount || 0) > Number(row.collected || 0));
assert.ok(openReceivable, '회수 가능한 초기 채권이 있어야 합니다.');
const collected = collectReceivableAction(base, openReceivable.id);
expectResult(base, collected, { key: 'receivableCollected', action: 'collection', cue: 'cashCollect', tone: 'success' });

const inbound = inboundInventoryAction(base, 'book-akashi', 2);
expectResult(base, inbound, { key: 'inventoryInbound', action: 'production', cue: 'productionPosted', tone: 'success' });

const valued = closeInventoryValuationAction(base);
expectResult(base, valued, { key: 'inventoryValued', action: 'valuation', cue: 'inventoryValued', tone: 'highlight' });

const campaigned = marketingCampaignAction(base, 'book-akashi');
expectResult(base, campaigned, { key: 'campaignLaunched', action: 'sales', cue: 'campaignLaunched', tone: 'highlight' });

const vatRow = vatScheduleRows(base).find((row) => row.remainingAmount > 0);
assert.ok(vatRow, '납부 가능한 초기 VAT 예정 행이 있어야 합니다.');
const vatPaid = payVatAction(base, vatRow.targetYear, vatRow.targetMonth, Math.min(1000, vatRow.remainingAmount));
expectResult(base, vatPaid, { key: 'vatPaid', action: 'tax', cue: 'taxPaid', tone: 'success' });

const exportPlan = createExportPlanAction(base, 'jp-retail', 'book-akashi', 2);
expectResult(base, exportPlan, { key: 'exportPlanned', action: 'export', cue: 'exportPlanned', tone: 'highlight' });
const importPlan = createImportPlanAction(base, 'jp-retail', 'book-akashi', 2);
expectResult(base, importPlan, { key: 'importPlanned', action: 'import', cue: 'importPlanned', tone: 'highlight' });
const hedged = createHedgeContractAction(base);
expectResult(base, hedged, { key: 'hedgeSigned', action: 'hedge', cue: 'hedgeSigned', tone: 'success' });

const plannedGlobal = createImportPlanAction(exportPlan, 'jp-retail', 'book-akashi', 2);
const globalSettled = settleGlobalTradeAction(plannedGlobal);
expectResult(plannedGlobal, globalSettled, { key: 'globalSettled', action: 'settle', cue: 'globalSettle', tone: 'success' });
const foreignOpen = globalSettled.global.foreignReceivables.find((row) => row.status === 'OPEN');
assert.ok(foreignOpen, '수출 정산 후 회수 가능한 외화채권이 있어야 합니다.');
const foreignCollected = collectForeignReceivableAction(globalSettled, foreignOpen.id);
expectResult(globalSettled, foreignCollected, { key: 'foreignCollected', action: 'collection', cue: 'cashCollect', tone: 'success' });

const disclosed = createDisclosureAction(base, 'EARNINGS_CALL');
expectResult(base, disclosed, { key: 'disclosureFiled', action: 'disclosure', cue: 'disclosureFiled', tone: 'success' });
const dividend = decideDividendAction(base);
expectResult(base, dividend, { key: 'dividendDeclared', action: 'dividend', cue: 'dividendDeclared', tone: 'highlight' });
const raised = raiseCapitalAction(base, 'RIGHTS_OFFERING');
expectResult(base, raised, { key: 'capitalRaised', action: 'capital', cue: 'capitalRaised', tone: 'success' });
const capitalClosed = closeCapitalMarketAction(base);
expectResult(base, capitalClosed, { key: 'capitalClosed', action: 'finance', cue: 'capitalClosed', tone: 'highlight' });

const monthClosed = monthEndCloseAction(base);
expectResult(base, monthClosed, { key: 'monthClosed', action: 'closing', cue: 'ledgerClose', tone: 'success' });
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
expectResult(blockedBase, blocked, { key: 'blocked', action: 'warning', cue: 'warning', tone: 'warning' });
const blockedAgain = inboundInventoryAction(blocked, 'book-akashi', 999);
expectResult(blocked, blockedAgain, { key: 'blocked', action: 'warning', cue: 'warning', tone: 'warning' });

const newRun = seed('company-feedback-new');
const newPresentation = companyReportResultPresentation(base, newRun);
assert.equal(newPresentation.key, 'newRun', '새 runId는 새 원장 전환이어야 합니다.');
assert.equal(companyReportFeedbackCue(base, newRun), '', '다른 원장을 불러올 때 자동 개시음을 내면 안 됩니다.');
assert.equal(companyReportTextPresentation('로그인하면 원장을 저장할 수 있습니다.').tone, 'warning', '비로그인 안내는 경고 톤이어야 합니다.');
assert.equal(companyReportTextPresentation('원장 상태를 저장했습니다.').action, 'save', '저장 결과는 저장 아이콘이어야 합니다.');
assert.equal(companyReportTextPresentation('저장된 원장을 불러왔습니다.').action, 'load', '불러오기 결과는 폴더 아이콘이어야 합니다.');
assert.equal(companyReportTextPresentation('복원 계획 JSON 다운로드를 준비했습니다.').action, 'download', '파일 내보내기는 다운로드 아이콘이어야 합니다.');

const resultCues = [
  'orderCreated', 'shipmentPosted', 'cashCollect', 'productionPosted', 'inventoryValued',
  'campaignLaunched', 'taxPaid', 'exportPlanned', 'importPlanned', 'hedgeSigned',
  'globalSettle', 'disclosureFiled', 'dividendDeclared', 'capitalRaised', 'capitalClosed',
  'ledgerClose', 'snapshotSaved', 'restorePreview', 'ledgerRestored', 'reportBookmarked',
  'reportExported', 'warning', 'start',
];
for (const cue of resultCues) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'ledger', 'order', 'shipment', 'collection', 'production', 'valuation', 'sales', 'tax',
  'export', 'import', 'hedge', 'settle', 'disclosure', 'dividend', 'capital', 'finance',
  'closing', 'snapshot', 'analysis', 'restore', 'bookmark', 'download', 'warning', 'new',
]) {
  assert.match(iconSource, new RegExp(`\\n  ${icon}: `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}

assert.match(pageSource, /const stateRef = useRef\(state\)/, '연속 회계 행동은 최신 상태 참조를 사용해야 합니다.');
assert.match(pageSource, /companyReportResultPresentation\(previousState, nextState\)/, '회계 행동마다 결과 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /resultPresentation=\{resultPresentation\}/, '기능 탭과 상세 패널에 공통 결과 프레젠테이션을 전달해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '상단 결과 패널에 결과 아이콘을 전달해야 합니다.');
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

console.log(JSON.stringify({
  feedbackTransitions: 24,
  resultCues: resultCues.length,
  resultPanels: componentSources.reduce((sum, source) => sum + [...source.matchAll(/<RecentActionResult\b/g)].length, 0) + 1,
  stateRef: true,
}, null, 2));
