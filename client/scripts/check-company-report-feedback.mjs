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
const shipped = shipOrderAction(base, openOrder.id);
expectResult(base, shipped, { key: 'shipmentPosted', action: 'shipment', cue: 'shipmentPosted', tone: 'success' });

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

const plannedGlobal = createImportPlanAction(exportPlan, 'jp-retail', 'book-akashi', 2);
const globalSettled = settleGlobalTradeAction(plannedGlobal);
expectResult(plannedGlobal, globalSettled, { key: 'globalSettled', action: 'settle', cue: 'globalSettle', tone: 'success' });
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
  'ledgerClose', 'snapshotSaved', 'restorePreview', 'ledgerRestored', 'reportBookmarked',
  'reportExported', 'foreignCashCollect', 'liquidityWarning', 'inventoryAlert', 'warning', 'start',
];
for (const cue of resultCues) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'ledger', 'order', 'shipment', 'collection', 'production', 'inventory', 'valuation', 'inventory-write-down', 'sales', 'tax',
  'export', 'import', 'hedge', 'settle', 'disclosure', 'dividend', 'capital', 'finance',
  'closing', 'snapshot', 'analysis', 'restore', 'bookmark', 'download', 'warning', 'new',
  'archive', 'logs', 'guide', 'policy', 'inspect', 'advisor', 'trade', 'contract',
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
assert.match(cssSource, /\.company-report-panel-title h2/, '패널 제목 아이콘 레이아웃이 필요합니다.');
assert.match(cssSource, /\.game-save-row\.company-report-icon-row/, '의미 아이콘 행 레이아웃이 필요합니다.');
assert.match(cssSource, /\.company-report-impact-strip/, '최근 처리 영향 아이콘 레이아웃이 필요합니다.');
assert.match(cssSource, /\.company-report-icon-row\.is-priority-urgent/, '긴급 운영 항목을 시각적으로 구분해야 합니다.');

console.log(JSON.stringify({
  feedbackTransitions: 27,
  resultCues: resultCues.length,
  resultPanels: componentSources.reduce((sum, source) => sum + [...source.matchAll(/<RecentActionResult\b/g)].length, 0) + 1,
  semanticPanelTitles,
  semanticIconRows: helperIconRows + directIconRows + dynamicIconRows,
  stateRef: true,
}, null, 2));
