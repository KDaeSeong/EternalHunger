import { useMemo, useState } from 'react';
import { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  CAPITAL_DISCLOSURE_TYPES,
  PARTNERS,
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
  createOrderAction,
  createProgressExportAction,
  decideDividendAction,
  dryRunLedgerRestoreAction,
  formatMoney,
  inboundInventoryAction,
  marketingCampaignAction,
  monthEndCloseAction,
  raiseCapitalAction,
  restoreLedgerSnapshotAction,
  settleGlobalTradeAction,
  shipOrderAction,
} from '../_lib/companyReportEngine';
import { getMarketName, getProductName } from '../_lib/companyReportPlayHelpers';

function buildOperationQueue({
  capitalSummary,
  globalSummary,
  guidance,
  latestSnapshot,
  ledgerDiff,
  management,
  report,
  reportTrend,
  restorePlan,
  selectedForeignAr,
  selectedOrder,
  selectedReceivable,
  selectedVatRow,
  state,
}) {
  const rows = [];
  const selectedOrderOpen = selectedOrder && selectedOrder.status !== 'SHIPPED' && selectedOrder.status !== 'COMPLETED';
  const selectedReceivableOpen = selectedReceivable && Number(selectedReceivable.remaining || 0) > 0;
  const selectedVatOpen = selectedVatRow && Number(selectedVatRow.remainingAmount || 0) > 0;
  const selectedForeignOpen = selectedForeignAr && Number(selectedForeignAr.remainingKrw || 0) > 0;

  if (selectedReceivableOpen) {
    rows.push({
      id: 'collect-receivable',
      tab: 'trade',
      kind: '현금',
      title: `${selectedReceivable.partnerName || '거래처'} 채권 회수`,
      detail: `잔액 ${formatMoney(selectedReceivable.remaining)} · 미수 ${report.openReceivables}건`,
      action: 'collect-receivable',
      actionLabel: '회수',
    });
  }

  if (selectedOrderOpen) {
    rows.push({
      id: 'ship-order',
      tab: 'trade',
      kind: '매출',
      title: `${selectedOrder.partnerName || '선택 주문'} 출고`,
      detail: `${selectedOrder.productName || selectedOrder.productId} · ${selectedOrder.quantity}개 · 상태 ${selectedOrder.status}`,
      action: 'ship-order',
      actionLabel: '출고',
    });
  }

  if (selectedVatOpen) {
    rows.push({
      id: 'pay-vat',
      tab: 'close',
      kind: '세금',
      title: `${selectedVatRow.targetYear}-${String(selectedVatRow.targetMonth).padStart(2, '0')} VAT 납부`,
      detail: `잔액 ${formatMoney(selectedVatRow.remainingAmount)} · 현재 현금 ${formatMoney(state.company.cashKrw)}`,
      action: 'pay-vat',
      actionLabel: '납부',
    });
  }

  if (guidance.showGlobal && selectedForeignOpen) {
    rows.push({
      id: 'collect-foreign',
      tab: 'global',
      kind: '환율',
      title: '외화채권 회수',
      detail: `잔액 ${formatMoney(selectedForeignAr.remainingKrw)} · 전체 외화채권 ${formatMoney(globalSummary.openForeignReceivableKrw)}`,
      action: 'collect-foreign',
      actionLabel: '회수',
    });
  }

  if (guidance.showGlobal && (globalSummary.activeExports || globalSummary.activeImports)) {
    rows.push({
      id: 'settle-global',
      tab: 'global',
      kind: '글로벌',
      title: '수출입 정산',
      detail: `활성 수출 ${globalSummary.activeExports}건 · 활성 수입 ${globalSummary.activeImports}건`,
      action: 'settle-global',
      actionLabel: '정산',
    });
  }

  if (guidance.showCapital && Number(capitalSummary.disclosureRisk || 0) >= 25) {
    rows.push({
      id: 'disclosure',
      tab: 'capital',
      kind: '공시',
      title: '공시 리스크 대응',
      detail: `위험 ${capitalSummary.disclosureRisk}/100 · 신뢰 ${capitalSummary.investorTrust}/100`,
      action: 'disclosure',
      actionLabel: '대응',
    });
  }

  if (!latestSnapshot || ledgerDiff.length > 0) {
    rows.push({
      id: 'snapshot',
      tab: guidance.showLedger ? 'ledger' : 'history',
      kind: '감사',
      title: latestSnapshot ? '원장 스냅샷 갱신' : '첫 원장 스냅샷 생성',
      detail: latestSnapshot ? `diff ${ledgerDiff.length}개 · checksum ${latestSnapshot.checksum}` : '복원과 감사 비교 기준을 먼저 만드세요.',
      action: 'snapshot',
      actionLabel: '스냅샷',
    });
  }

  if (guidance.showLedger && latestSnapshot && restorePlan.dryRunStatus !== 'READY') {
    rows.push({
      id: 'restore-dry-run',
      tab: 'ledger',
      kind: '복원',
      title: '복원 dry-run 확인',
      detail: `${restorePlan.restoreModeLabel} · 대상 테이블 ${restorePlan.targetTables.length}개`,
      action: 'restore-dry-run',
      actionLabel: 'dry-run',
    });
  }

  if (guidance.showHistory && reportTrend.archiveScore < 80) {
    rows.push({
      id: 'bookmark',
      tab: 'history',
      kind: '이력',
      title: '리포트 북마크/이력 보강',
      detail: `이력 점수 ${reportTrend.archiveScore}% · 스냅샷 ${reportTrend.snapshotRows.length}건`,
      action: 'bookmark',
      actionLabel: '북마크',
    });
  }

  if (!rows.length) {
    rows.push({
      id: 'close',
      tab: 'close',
      kind: '결산',
      title: '월말 결산 진행',
      detail: `현금 ${formatMoney(management.cashFlow.cash)} · 영업손익 ${formatMoney(management.income.operatingProfit)}`,
      action: 'close',
      actionLabel: '결산',
    });
  }

  return {
    headline: rows[0]?.title || '월말 결산 준비',
    rows: rows.slice(0, 6),
  };
}

export default function CompanyReportFeatureTabs({
  applyLedgerAction,
  capitalSummary,
  disclosureTypeId,
  downloadProgressCsv,
  downloadProgressJson,
  downloadRestorePlanJson,
  financingTypeId,
  foreignReceivables,
  globalMarketId,
  globalProductId,
  globalSummary,
  globalUnits,
  guidance,
  latestSettlement,
  latestSnapshot,
  ledgerDiff,
  management,
  orders,
  partnerId,
  productId,
  quantity,
  recentActionText,
  report,
  reportTrend,
  restoreMode,
  restorePlan,
  runVatPayment,
  selectedForeignAr,
  selectedOrder,
  selectedReceivable,
  selectedRestoreTables,
  selectedVatRow,
  state,
  stocks,
  vatPayAmount,
}) {
  const [activeTabId, setActiveTabId] = useState('board');
  const operationQueue = useMemo(() => buildOperationQueue({
    capitalSummary,
    globalSummary,
    guidance,
    latestSnapshot,
    ledgerDiff,
    management,
    report,
    reportTrend,
    restorePlan,
    selectedForeignAr,
    selectedOrder,
    selectedReceivable,
    selectedVatRow,
    state,
  }), [
    capitalSummary,
    globalSummary,
    guidance,
    latestSnapshot,
    ledgerDiff,
    management,
    report,
    reportTrend,
    restorePlan,
    selectedForeignAr,
    selectedOrder,
    selectedReceivable,
    selectedVatRow,
    state,
  ]);

  const runOperationQueueAction = (item) => {
    if (item.tab) setActiveTabId(item.tab);
    if (item.action === 'collect-receivable') {
      applyLedgerAction('채권 회수', (current) => collectReceivableAction(current, selectedReceivable?.id));
      return;
    }
    if (item.action === 'ship-order') {
      applyLedgerAction('주문 출고', (current) => shipOrderAction(current, selectedOrder?.id));
      return;
    }
    if (item.action === 'pay-vat') {
      runVatPayment();
      return;
    }
    if (item.action === 'collect-foreign') {
      applyLedgerAction('외화채권 회수', (current) => collectForeignReceivableAction(current, selectedForeignAr?.id));
      return;
    }
    if (item.action === 'settle-global') {
      applyLedgerAction('글로벌 정산', (current) => settleGlobalTradeAction(current));
      return;
    }
    if (item.action === 'disclosure') {
      applyLedgerAction('공시 대응', (current) => createDisclosureAction(current, disclosureTypeId));
      return;
    }
    if (item.action === 'snapshot') {
      applyLedgerAction('원장 스냅샷', (current) => createLedgerSnapshotAction(current));
      return;
    }
    if (item.action === 'restore-dry-run') {
      applyLedgerAction('복원 dry-run', (current) => dryRunLedgerRestoreAction(current, restoreMode, selectedRestoreTables));
      return;
    }
    if (item.action === 'bookmark') {
      applyLedgerAction('리포트 북마크', (current) => bookmarkCurrentReportAction(current));
      return;
    }
    if (item.action === 'close') {
      applyLedgerAction('월말 결산', (current) => monthEndCloseAction(current));
    }
  };

  return (
      <GameFeatureTabs
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        tabs={[
          {
            id: 'board',
            label: '경영 보드',
            badge: `${management.income.grossMarginPct}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>경영 요약</h2>
                    <span>{state.company.year}-{String(state.company.month).padStart(2, '0')}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="매출" value={formatMoney(management.income.sales)} />
                    <SmallStat label="영업손익" value={formatMoney(management.income.operatingProfit)} />
                    <SmallStat label="현금" value={formatMoney(management.cashFlow.cash)} />
                    <SmallStat label="런웨이" value={`${management.cashFlow.cashRunwayMonths}개월`} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {management.recommendations.slice(0, 4).map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운영 큐</h2>
                    <span>{operationQueue.rows.length}개</span>
                  </div>
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>{operationQueue.headline}</strong>
                  </div>
                  <div className="game-save-list">
                    {operationQueue.rows.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.kind}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => runOperationQueueAction(item)}>
                          {item.actionLabel}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>리스크</h2>
                    <span>{management.riskRows.length}개 지표</span>
                  </div>
                  <div className="game-save-list">
                    {management.riskRows.map((row) => (
                      <article className="game-save-row" key={row.label}>
                        <div>
                          <span>관리 지표</span>
                          <strong>{row.label}</strong>
                        </div>
                        <strong>{row.value}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'trade',
            label: '거래/채권',
            badge: `${orders.length}건`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 주문</h2>
                    <span>{getProductName(productId)}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="수량" value={quantity} />
                    <SmallStat label="재고" value={stocks.find((row) => row.id === productId)?.onHand || 0} />
                    <SmallStat label="거래처" value={PARTNERS.find((partner) => partner.id === partnerId)?.name || partnerId} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('주문 생성', (current) => createOrderAction(current, partnerId, productId, quantity))}>주문 생성</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('생산 입고', (current) => inboundInventoryAction(current, productId, quantity))}>선택 상품 생산 입고</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('상품 캠페인', (current) => marketingCampaignAction(current, productId))}>선택 상품 캠페인</ActionButton>
                  </div>
                  <RecentActionResult label="최근 거래 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>출고/회수</h2>
                    <span>{formatMoney(report.receivableAmount)}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="미수 채권" value={report.openReceivables} />
                    <SmallStat label="출고 주문" value={report.shippedOrders} />
                    <SmallStat label="선택 주문" value={selectedOrder?.status || '-'} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton disabled={!selectedOrder} onClick={() => applyLedgerAction('주문 출고', (current) => shipOrderAction(current, selectedOrder?.id))}>선택 주문 출고</ActionButton>
                    <ActionButton disabled={!selectedReceivable || selectedReceivable.remaining <= 0} onClick={() => applyLedgerAction('채권 회수', (current) => collectReceivableAction(current, selectedReceivable?.id))}>선택 채권 회수</ActionButton>
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'close',
            label: '결산/VAT',
            badge: formatMoney(report.vatPayableAmount),
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>월말 결산</h2>
                    <span>{latestSettlement ? '정산 있음' : '대기'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="자산" value={formatMoney(report.assets)} />
                    <SmallStat label="부채" value={formatMoney(report.liabilities)} />
                    <SmallStat label="자본" value={formatMoney(report.equity)} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('월말 재고평가', (current) => closeInventoryValuationAction(current))}>월말 재고평가</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('월말 결산', (current) => monthEndCloseAction(current))}>월말 결산</ActionButton>
                  </div>
                  <RecentActionResult label="최근 결산 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>VAT 납부</h2>
                    <span>{selectedVatRow?.status || 'NO_TAX'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="과세월" value={selectedVatRow ? `${selectedVatRow.targetYear}-${String(selectedVatRow.targetMonth).padStart(2, '0')}` : '-'} />
                    <SmallStat label="잔액" value={formatMoney(selectedVatRow?.remainingAmount || 0)} />
                    <SmallStat label="납부액" value={formatMoney(vatPayAmount)} />
                  </div>
                  <ActionButton
                    disabled={!selectedVatRow || selectedVatRow.remainingAmount <= 0 || vatPayAmount <= 0 || vatPayAmount > selectedVatRow.remainingAmount || Number(state.company.cashKrw || 0) < vatPayAmount}
                    onClick={runVatPayment}
                  >
                    선택 VAT 납부
                  </ActionButton>
                </section>
              </section>
            ),
          },
          guidance.showGlobal ? {
            id: 'global',
            label: '글로벌',
            badge: `${globalSummary.activeExports + globalSummary.activeImports} active`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>수출입</h2>
                    <span>{getMarketName(globalMarketId)}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="수출손익" value={formatMoney(globalSummary.exportProfitKrw)} />
                    <SmallStat label="외화채권" value={formatMoney(globalSummary.openForeignReceivableKrw)} />
                    <SmallStat label="헤지" value={globalSummary.hedgeCount} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('수출 계획 등록', (current) => createExportPlanAction(current, globalMarketId, globalProductId, globalUnits))}>수출 계획 등록</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('수입 계획 등록', (current) => createImportPlanAction(current, globalMarketId, globalProductId, globalUnits))}>수입 계획 등록</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('글로벌 정산', (current) => settleGlobalTradeAction(current))}>글로벌 정산</ActionButton>
                  </div>
                  <RecentActionResult label="최근 글로벌 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>외화채권/헤지</h2>
                    <span>{foreignReceivables.length}건</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('환헤지 체결', (current) => createHedgeContractAction(current))}>환헤지 체결</ActionButton>
                    <ActionButton disabled={!selectedForeignAr || selectedForeignAr.remainingKrw <= 0} onClick={() => applyLedgerAction('외화채권 회수', (current) => collectForeignReceivableAction(current, selectedForeignAr?.id))}>외화채권 회수</ActionButton>
                  </div>
                </section>
              </section>
            ),
          } : null,
          guidance.showCapital ? {
            id: 'capital',
            label: '자본시장',
            badge: `신뢰 ${capitalSummary.investorTrust}`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>상장 상태</h2>
                    <span>{formatMoney(capitalSummary.marketCapKrw)}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="주가" value={formatMoney(capitalSummary.sharePrice)} />
                    <SmallStat label="공시위험" value={`${capitalSummary.disclosureRisk}/100`} />
                    <SmallStat label="상장부채" value={formatMoney(capitalSummary.debtKrw)} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {capitalSummary.alerts.slice(0, 3).map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>투자자 액션</h2>
                    <span>{CAPITAL_DISCLOSURE_TYPES.find((type) => type.id === disclosureTypeId)?.label || disclosureTypeId}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('공시 대응', (current) => createDisclosureAction(current, disclosureTypeId))}>공시 대응 실행</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('배당 결정', (current) => decideDividendAction(current))}>배당 결정</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('자금 조달', (current) => raiseCapitalAction(current, financingTypeId))}>자금 조달</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('자본시장 월마감', (current) => closeCapitalMarketAction(current))}>자본시장 월마감</ActionButton>
                  </div>
                  <RecentActionResult label="최근 자본시장 결과" text={recentActionText} />
                </section>
              </section>
            ),
          } : null,
          guidance.showHistory ? {
            id: 'history',
            label: '리포트 이력',
            badge: `${reportTrend.archiveScore}%`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>장기 리포트 추세</h2>
                    <span>{reportTrend.latest?.period || '현재'} · {reportTrend.latest?.trend || '유지'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="이력 점수" value={`${reportTrend.archiveScore}%`} />
                    <SmallStat label="월 수" value={reportTrend.rows.length} />
                    <SmallStat label="흑자월" value={reportTrend.positiveProfitMonths} />
                    <SmallStat label="스냅샷" value={reportTrend.snapshotRows.length} />
                    <SmallStat label="북마크" value={reportTrend.bookmarkRows.length} />
                    <SmallStat label="내보내기" value={reportTrend.exportRows.length} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {reportTrend.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton onClick={() => applyLedgerAction('리포트 북마크', (current) => bookmarkCurrentReportAction(current))}>리포트 북마크</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('진행 리포트 이력', (current) => createProgressExportAction(current))}>진행 리포트 이력 추가</ActionButton>
                  </div>
                  <RecentActionResult label="최근 리포트 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>월별 추세</h2>
                    <span>{reportTrend.rows.length}개 기간</span>
                  </div>
                  <div className="game-save-list">
                    {reportTrend.rows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.source === 'live' ? '현재 진행월' : '월말 결산'} · 매출 {formatMoney(row.sales)}</span>
                          <strong>{row.period} / 영업이익 {formatMoney(row.operatingProfit)}</strong>
                          <small>전기 대비 이익 {formatMoney(row.profitDelta)} · 마진 {row.marginPct}%</small>
                        </div>
                        <strong>{row.trend}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>저장형 리포트</h2>
                    <span>{reportTrend.bookmarkRows.length + reportTrend.exportRows.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {reportTrend.bookmarkRows.map((bookmark) => (
                      <article className="game-save-row" key={bookmark.id}>
                        <div>
                          <span>{bookmark.favorite ? '즐겨찾기' : '북마크'} · {bookmark.note}</span>
                          <strong>{bookmark.label}</strong>
                          <small>자산 {formatMoney(bookmark.assets)} · 채권 {formatMoney(bookmark.receivableAmount)}</small>
                        </div>
                        <strong>{bookmark.score.toLocaleString('ko-KR')}</strong>
                      </article>
                    ))}
                    {reportTrend.exportRows.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.exportType} · {item.itemCount} items</span>
                          <strong>{item.exportNote}</strong>
                          <small>checksum {item.checksum}</small>
                        </div>
                        <strong>export</strong>
                      </article>
                    ))}
                    {!reportTrend.bookmarkRows.length && !reportTrend.exportRows.length ? <div className="games-empty">리포트 북마크나 진행 리포트 이력을 추가하면 여기에 누적됩니다.</div> : null}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>스냅샷 기준</h2>
                    <span>{reportTrend.snapshotRows.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {reportTrend.snapshotRows.map((snapshot) => (
                      <article className="game-save-row" key={snapshot.id}>
                        <div>
                          <span>{snapshot.rowCount} rows</span>
                          <strong>{snapshot.label}</strong>
                          <small>checksum {snapshot.checksum}</small>
                        </div>
                        <strong>{new Date(snapshot.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong>
                      </article>
                    ))}
                    {!reportTrend.snapshotRows.length ? <div className="games-empty">스냅샷을 생성하면 장기 리포트의 비교 기준으로 사용됩니다.</div> : null}
                  </div>
                </section>
              </section>
            ),
          } : null,
          guidance.showLedger ? {
            id: 'ledger',
            label: '원장/복원',
            badge: `${state.ledgerSnapshots.length}개`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>스냅샷</h2>
                    <span>{latestSnapshot?.checksum || '대기'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="diff" value={ledgerDiff.length} />
                    <SmallStat label="북마크" value={state.reportBookmarks.length} />
                    <SmallStat label="내보내기" value={state.exportHistory.length} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applyLedgerAction('원장 스냅샷', (current) => createLedgerSnapshotAction(current))}>원장 스냅샷 생성</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('리포트 북마크', (current) => bookmarkCurrentReportAction(current))}>리포트 북마크</ActionButton>
                    <ActionButton onClick={() => applyLedgerAction('진행 내보내기', (current) => createProgressExportAction(current))}>진행 내보내기</ActionButton>
                    <ActionButton onClick={downloadProgressJson}>JSON 다운로드</ActionButton>
                    <ActionButton onClick={downloadProgressCsv}>CSV 다운로드</ActionButton>
                  </div>
                  <RecentActionResult label="최근 원장/내보내기 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>복원 계획</h2>
                    <span>{restorePlan.dryRunStatus}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="모드" value={restorePlan.restoreModeLabel} />
                    <SmallStat label="테이블" value={restorePlan.targetTables.length} />
                    <SmallStat label="삭제 예정" value={`${restorePlan.deletedRowCount} rows`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton disabled={!latestSnapshot} onClick={() => applyLedgerAction('복원 dry-run', (current) => dryRunLedgerRestoreAction(current, restoreMode, selectedRestoreTables))}>복원 dry-run</ActionButton>
                    <ActionButton disabled={!latestSnapshot || !restorePlan.restorable} onClick={() => applyLedgerAction('선택 모드 복원', (current) => restoreLedgerSnapshotAction(current, restoreMode, selectedRestoreTables))}>선택 모드 복원</ActionButton>
                    <ActionButton disabled={!latestSnapshot} onClick={downloadRestorePlanJson}>복원 계획 JSON</ActionButton>
                  </div>
                </section>
              </section>
            ),
          } : null,
        ]}
      />
  );
}
