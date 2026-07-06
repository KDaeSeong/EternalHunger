import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  CAPITAL_DISCLOSURE_TYPES,
  CAPITAL_FINANCING_TYPES,
  LEDGER_RESTORE_MODES,
  PARTNERS,
  PRODUCTS,
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
  restoreLatestSnapshotAction,
  settleGlobalTradeAction,
  shipOrderAction,
} from '../_lib/companyReportEngine';
import { StatusBadge, getMarketName, getProductName } from '../_lib/companyReportPlayHelpers';

export default function CompanyReportDetailPanels({
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
  handleVatSelect,
  inventoryValuations,
  inventoryWriteDowns,
  latestBookmark,
  latestExport,
  latestRestore,
  latestSettlement,
  latestSnapshot,
  ledgerDiff,
  management,
  markets,
  orders,
  partnerId,
  productId,
  quantity,
  receivables,
  recentActionText,
  report,
  restoreMode,
  restorePlan,
  runVatPayment,
  selectedForeignAr,
  selectedOrder,
  selectedReceivable,
  selectedRestoreTables,
  selectedVatRow,
  setDisclosureTypeId,
  setFinancingTypeId,
  setGlobalMarketId,
  setGlobalProductId,
  setGlobalUnits,
  setPartnerId,
  setProductId,
  setQuantity,
  setRestoreMode,
  setSelectedForeignArId,
  setSelectedOrderId,
  setSelectedReceivableId,
  setSelectedRestoreTables,
  setVatPaymentAmount,
  state,
  stocks,
  vatPayAmount,
  vatPaymentAmount,
  vatPayments,
  vatSchedule,
}) {
  return (
    <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주문 생성</h2>
            <span>{quantity}개</span>
          </div>
          <label className="game-save-json-field">
            <span>거래처</span>
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
              {PARTNERS.map((partner) => <option value={partner.id} key={partner.id}>{partner.name} / {partner.type}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>상품</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {PRODUCTS.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>수량</span>
            <input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applyLedgerAction('주문 생성', (current) => createOrderAction(current, partnerId, productId, quantity))}>주문 생성</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('생산 입고', (current) => inboundInventoryAction(current, productId, quantity))}>선택 상품 생산 입고</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('상품 캠페인', (current) => marketingCampaignAction(current, productId))}>선택 상품 캠페인</ActionButton>
          </div>
          <RecentActionResult label="최근 주문 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>출고 / 회수</h2>
            <span>{selectedOrder?.status || '-'}</span>
          </div>
          <label className="game-save-json-field">
            <span>출고 주문</span>
            <select value={selectedOrder?.id || ''} onChange={(event) => setSelectedOrderId(event.target.value)}>
              {orders.map((order) => <option value={order.id} key={order.id}>{order.no} / {order.partnerName} / {order.status}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>회수 채권</span>
            <select value={selectedReceivable?.id || ''} onChange={(event) => setSelectedReceivableId(event.target.value)}>
              {receivables.map((ar) => <option value={ar.id} key={ar.id}>{ar.id} / {ar.partnerName} / {formatMoney(ar.remaining)}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedOrder} onClick={() => applyLedgerAction('주문 출고', (current) => shipOrderAction(current, selectedOrder?.id))}>선택 주문 출고</ActionButton>
            <ActionButton disabled={!selectedReceivable || selectedReceivable.remaining <= 0} onClick={() => applyLedgerAction('채권 회수', (current) => collectReceivableAction(current, selectedReceivable?.id))}>선택 채권 전액 회수</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>결산 / 스냅샷</h2>
            <span>{latestSnapshot?.checksum || '대기'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평판" value={state.company.reputation} />
            <SmallStat label="팬덤" value={state.company.fanBase.toLocaleString('ko-KR')} />
            <SmallStat label="자산" value={formatMoney(report.assets)} />
            <SmallStat label="자본" value={formatMoney(report.equity)} />
            <SmallStat label="VAT 미납" value={formatMoney(report.vatPayableAmount)} />
            <SmallStat label="재고손상" value={formatMoney(report.inventoryWriteDownBalance)} />
          </div>
          <label className="game-save-json-field">
            <span>복원 모드</span>
            <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value)}>
              {LEDGER_RESTORE_MODES.map((mode) => <option value={mode.id} key={mode.id}>{mode.label}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>선택 테이블</span>
            <input
              value={selectedRestoreTables}
              onChange={(event) => setSelectedRestoreTables(event.target.value)}
              disabled={restoreMode !== 'SELECTED_TABLES'}
              placeholder="sales_order, account_receivable"
            />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applyLedgerAction('월말 재고평가', (current) => closeInventoryValuationAction(current))}>월말 재고평가</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('월말 결산', (current) => monthEndCloseAction(current))}>월말 결산</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('원장 스냅샷', (current) => createLedgerSnapshotAction(current))}>원장 스냅샷 생성</ActionButton>
            <ActionButton disabled={!latestSnapshot} onClick={() => applyLedgerAction('최근 스냅샷 복원', (current) => restoreLatestSnapshotAction(current))}>최근 스냅샷 복원</ActionButton>
            <ActionButton disabled={!latestSnapshot} onClick={() => applyLedgerAction('복원 dry-run', (current) => dryRunLedgerRestoreAction(current, restoreMode, selectedRestoreTables))}>복원 dry-run</ActionButton>
            <ActionButton disabled={!latestSnapshot || !restorePlan.restorable} onClick={() => applyLedgerAction('선택 모드 복원', (current) => restoreLedgerSnapshotAction(current, restoreMode, selectedRestoreTables))}>선택 모드 복원</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('리포트 북마크', (current) => bookmarkCurrentReportAction(current))}>리포트 북마크</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('진행 내보내기', (current) => createProgressExportAction(current))}>진행 내보내기</ActionButton>
            <ActionButton onClick={downloadProgressJson}>JSON 다운로드</ActionButton>
            <ActionButton onClick={downloadProgressCsv}>CSV 다운로드</ActionButton>
            <ActionButton disabled={!latestSnapshot} onClick={downloadRestorePlanJson}>복원 계획 JSON</ActionButton>
          </div>
          <RecentActionResult label="최근 결산/복원 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>글로벌 수출입</h2>
            <span>{globalSummary.activeExports + globalSummary.activeImports} active</span>
          </div>
          <label className="game-save-json-field">
            <span>시장</span>
            <select value={globalMarketId} onChange={(event) => setGlobalMarketId(event.target.value)}>
              {markets.map((market) => <option value={market.id} key={market.id}>{market.name} / {market.exchangeRateLabel}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>상품</span>
            <select value={globalProductId} onChange={(event) => setGlobalProductId(event.target.value)}>
              {PRODUCTS.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>수량</span>
            <input type="number" min="1" max="9999" value={globalUnits} onChange={(event) => setGlobalUnits(event.target.value)} />
          </label>
          <label className="game-save-json-field">
            <span>외화채권</span>
            <select value={selectedForeignAr?.id || ''} onChange={(event) => setSelectedForeignArId(event.target.value)}>
              {foreignReceivables.length ? foreignReceivables.map((ar) => <option value={ar.id} key={ar.id}>{ar.id} / {ar.marketName} / {formatMoney(ar.remainingKrw)}</option>) : <option value="">회수 대기 없음</option>}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applyLedgerAction('수출 계획 등록', (current) => createExportPlanAction(current, globalMarketId, globalProductId, globalUnits))}>수출 계획 등록</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('수입 계획 등록', (current) => createImportPlanAction(current, globalMarketId, globalProductId, globalUnits))}>수입 계획 등록</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('환헤지 체결', (current) => createHedgeContractAction(current))}>환헤지 체결</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('글로벌 정산', (current) => settleGlobalTradeAction(current))}>글로벌 정산</ActionButton>
            <ActionButton disabled={!selectedForeignAr || selectedForeignAr.remainingKrw <= 0} onClick={() => applyLedgerAction('외화채권 회수', (current) => collectForeignReceivableAction(current, selectedForeignAr?.id))}>외화채권 회수</ActionButton>
          </div>
          <RecentActionResult label="최근 글로벌 상세 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>상장 / 투자자</h2>
            <span>신뢰 {capitalSummary.investorTrust}</span>
          </div>
          <label className="game-save-json-field">
            <span>공시 대응</span>
            <select value={disclosureTypeId} onChange={(event) => setDisclosureTypeId(event.target.value)}>
              {CAPITAL_DISCLOSURE_TYPES.map((type) => <option value={type.id} key={type.id}>{type.label} / {formatMoney(type.costKrw)}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>조달 방식</span>
            <select value={financingTypeId} onChange={(event) => setFinancingTypeId(event.target.value)}>
              {CAPITAL_FINANCING_TYPES.map((type) => <option value={type.id} key={type.id}>{type.label} / {formatMoney(type.cashKrw)}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="시가총액" value={formatMoney(capitalSummary.marketCapKrw)} />
            <SmallStat label="공시위험" value={`${capitalSummary.disclosureRisk}/100`} />
            <SmallStat label="상장부채" value={formatMoney(capitalSummary.debtKrw)} />
            <SmallStat label="주식수" value={capitalSummary.sharesOutstanding.toLocaleString('ko-KR')} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applyLedgerAction('공시 대응', (current) => createDisclosureAction(current, disclosureTypeId))}>공시 대응 실행</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('배당 결정', (current) => decideDividendAction(current))}>배당 결정</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('자금 조달', (current) => raiseCapitalAction(current, financingTypeId))}>자금 조달</ActionButton>
            <ActionButton onClick={() => applyLedgerAction('자본시장 월마감', (current) => closeCapitalMarketAction(current))}>자본시장 월마감</ActionButton>
          </div>
          <RecentActionResult label="최근 투자자 액션 결과" text={recentActionText} />
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>VAT 예정표</h2>
            <span>{formatMoney(report.vatPayableAmount)} 미납</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="과세월" value={selectedVatRow ? `${selectedVatRow.targetYear}-${String(selectedVatRow.targetMonth).padStart(2, '0')}` : '-'} />
            <SmallStat label="세액" value={formatMoney(selectedVatRow?.invoiceVatAmount || 0)} />
            <SmallStat label="납부" value={formatMoney(selectedVatRow?.paidAmount || 0)} />
            <SmallStat label="잔액" value={formatMoney(selectedVatRow?.remainingAmount || 0)} />
          </div>
          <label className="game-save-json-field">
            <span>납부 대상</span>
            <select value={selectedVatRow?.id || ''} onChange={(event) => handleVatSelect(event.target.value)}>
              {vatSchedule.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.targetYear}-{String(row.targetMonth).padStart(2, '0')} / {row.status} / {formatMoney(row.remainingAmount)}
                </option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>납부액</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={vatPaymentAmount}
              onChange={(event) => setVatPaymentAmount(event.target.value)}
              placeholder={selectedVatRow ? String(selectedVatRow.remainingAmount) : '0'}
            />
          </label>
          <div className="game-save-list">
            <article className="game-save-row">
              <div>
                <span>납부기한 {selectedVatRow?.dueDate || '-'}</span>
                <strong>{selectedVatRow?.note || '납부 대상 없음'}</strong>
              </div>
              <StatusBadge value={selectedVatRow?.status || 'NO_TAX'} />
            </article>
          </div>
          <ActionButton
            disabled={!selectedVatRow || selectedVatRow.remainingAmount <= 0 || vatPayAmount <= 0 || vatPayAmount > selectedVatRow.remainingAmount || Number(state.company.cashKrw || 0) < vatPayAmount}
            onClick={runVatPayment}
          >
            선택 VAT 납부
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>VAT 납부 이력</h2>
            <span>{vatPayments.length}건</span>
          </div>
          <div className="game-save-list">
            {vatPayments.length ? vatPayments.slice(0, 6).map((payment) => (
              <article className="game-save-row" key={payment.id}>
                <div>
                  <span>{payment.paymentDate} / {payment.referenceNo}</span>
                  <strong>{payment.targetYear}-{String(payment.targetMonth).padStart(2, '0')} 부가세</strong>
                  <span>납부 후 잔액 {formatMoney(payment.remainingAfter)}</span>
                </div>
                <strong>{formatMoney(payment.paymentAmount)}</strong>
              </article>
            )) : <div className="games-empty">VAT를 납부하면 이력이 표시됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재고평가 / 손상</h2>
            <span>{inventoryValuations.length} rows</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평가행" value={inventoryValuations.length} />
            <SmallStat label="손상/환입" value={inventoryWriteDowns.length} />
            <SmallStat label="손상잔액" value={formatMoney(report.inventoryWriteDownBalance)} />
            <SmallStat label="재고장부" value={formatMoney(report.inventoryAmount)} />
          </div>
          <ActionButton onClick={() => applyLedgerAction('현재 월 재고평가', (current) => closeInventoryValuationAction(current))}>현재 월 재고평가 실행</ActionButton>
          <RecentActionResult label="최근 재고평가 결과" text={recentActionText} />
          <div className="game-save-list">
            {inventoryWriteDowns.length ? inventoryWriteDowns.slice(0, 6).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.year}-{String(row.month).padStart(2, '0')} / {row.eventType}</span>
                  <strong>{row.productName}</strong>
                  <span>{row.note}</span>
                </div>
                <strong>{formatMoney(row.netEffectAmount)}</strong>
              </article>
            )) : inventoryValuations.length ? inventoryValuations.slice(0, 6).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.year}-{String(row.month).padStart(2, '0')} / {row.valuationStatus}</span>
                  <strong>{row.productName}</strong>
                  <span>NRV {formatMoney(row.nrvTotalAmount)} / 장부 {formatMoney(row.closingInventoryAmount)}</span>
                </div>
                <strong>{row.onHand}개</strong>
              </article>
            )) : <div className="games-empty">월말 재고평가를 실행하면 평가와 손상/환입 이력이 표시됩니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>경영 리포트</h2>
            <span>손익 / 현금흐름</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="매출" value={formatMoney(management.income.sales)} />
            <SmallStat label="매출총이익" value={formatMoney(management.income.grossProfit)} />
            <SmallStat label="매출총이익률" value={`${management.income.grossMarginPct}%`} />
            <SmallStat label="영업손익" value={formatMoney(management.income.operatingProfit)} />
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="현금" value={formatMoney(management.cashFlow.cash)} />
            <SmallStat label="회수액" value={formatMoney(management.cashFlow.collectedCash)} />
            <SmallStat label="채권잔액" value={formatMoney(management.cashFlow.receivableAmount)} />
            <SmallStat label="런웨이" value={`${management.cashFlow.cashRunwayMonths}개월`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {management.recommendations.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>매출 분석</h2>
            <span>상품 / 캐릭터</span>
          </div>
          <div className="game-save-list">
            {management.productRows.length ? management.productRows.map((row) => (
              <article className="game-save-row" key={row.label}>
                <div>
                  <span>상품 매출</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.formatted}</strong>
              </article>
            )) : <div className="games-empty">출고된 상품 매출이 없습니다.</div>}
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            {management.characterRows.slice(0, 4).map((row) => (
              <SmallStat label={row.label} value={row.formatted} key={row.label} />
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>리스크 체크</h2>
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

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>스냅샷 diff</h2>
            <span>{latestSnapshot?.checksum || '스냅샷 없음'}</span>
          </div>
          <div className="game-save-list">
            {ledgerDiff.length ? ledgerDiff.map((row) => (
              <article className="game-save-row" key={row.label}>
                <div>
                  <span>{row.before} → {row.after}</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.deltaText}</strong>
              </article>
            )) : <div className="games-empty">스냅샷을 생성하면 현재 원장과의 차이를 볼 수 있습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>복원 dry-run</h2>
            <span>{restorePlan.dryRunStatus}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="모드" value={restorePlan.restoreModeLabel} />
            <SmallStat label="대상 테이블" value={restorePlan.targetTables.length} />
            <SmallStat label="삭제 예정" value={`${restorePlan.deletedRowCount} rows`} />
            <SmallStat label="삽입 예정" value={`${restorePlan.insertedRowCount} rows`} />
            <SmallStat label="FK 순환" value={restorePlan.cycleDetected ? '감지' : '없음'} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            <article className="game-save-row">
              <div>
                <span>checksum {restorePlan.snapshotChecksum || '-'}</span>
                <strong>{restorePlan.message}</strong>
              </div>
              <strong>{restorePlan.beforeDiffStatus}</strong>
            </article>
            <article className="game-save-row">
              <div>
                <span>delete</span>
                <strong>{restorePlan.deleteOrder.slice(0, 5).join(' → ') || '-'}</strong>
              </div>
              <strong>{restorePlan.deleteOrder.length}</strong>
            </article>
            <article className="game-save-row">
              <div>
                <span>insert</span>
                <strong>{restorePlan.insertOrder.slice(0, 5).join(' → ') || '-'}</strong>
              </div>
              <strong>{restorePlan.insertOrder.length}</strong>
            </article>
            {restorePlan.warnings.slice(0, 3).map((warning) => (
              <article className="game-save-row" key={warning}>
                <div>
                  <span>warning</span>
                  <strong>{warning}</strong>
                </div>
                <strong>검토</strong>
              </article>
            ))}
            {restorePlan.tableDiffs.slice(0, 8).map((row) => (
              <article className="game-save-row" key={row.tableName}>
                <div>
                  <span>{row.snapshotRowCount} rows snapshot / {row.currentRowCount} rows current</span>
                  <strong>{row.label}</strong>
                  <span>missing {row.missingInCurrentCount} / extra {row.extraInCurrentCount} / changed {row.changedRowCount}</span>
                  <span>{row.snapshotChecksum} → {row.currentChecksum}</span>
                </div>
                <strong>{row.diffStatus}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>글로벌 성과</h2>
            <span>StepD slice</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="수출매출" value={formatMoney(globalSummary.exportSalesKrw)} />
            <SmallStat label="수출손익" value={formatMoney(globalSummary.exportProfitKrw)} />
            <SmallStat label="수입원가" value={formatMoney(globalSummary.importLandedCostKrw)} />
            <SmallStat label="헤지계약" value={`${globalSummary.hedgeCount}건`} />
          </div>
          <div className="game-save-list">
            {state.global.exportResults.slice(0, 4).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.year}-{String(row.month).padStart(2, '0')} / {getMarketName(row.marketId)}</span>
                  <strong>{getProductName(row.productId)} 수출</strong>
                  <span>{row.soldUnits}개 / 비용 {formatMoney(row.exportCostKrw)}</span>
                </div>
                <strong>{formatMoney(row.salesKrw)}</strong>
              </article>
            ))}
            {!state.global.exportResults.length ? <div className="games-empty">수출 계획을 등록하고 글로벌 정산을 실행하면 성과가 표시됩니다.</div> : null}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>외화채권 / 수입</h2>
            <span>{formatMoney(globalSummary.openForeignReceivableKrw)}</span>
          </div>
          <div className="game-save-list">
            {foreignReceivables.slice(0, 5).map((ar) => (
              <article className="game-save-row" key={ar.id}>
                <div>
                  <span>{ar.marketName} / {ar.currency}</span>
                  <strong>{ar.id}</strong>
                  <span>{ar.productName} / 회수 {formatMoney(ar.collectedKrw)}</span>
                </div>
                <StatusBadge value={ar.status} />
              </article>
            ))}
            {!foreignReceivables.length ? <div className="games-empty">해외 매출 정산 후 외화채권이 생성됩니다.</div> : null}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>자본시장</h2>
            <span>StepE slice</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="주가" value={formatMoney(capitalSummary.sharePrice)} />
            <SmallStat label="변동" value={formatMoney(capitalSummary.priceDelta)} />
            <SmallStat label="투자자 신뢰" value={`${capitalSummary.investorTrust}/100`} />
            <SmallStat label="공시위험" value={`${capitalSummary.disclosureRisk}/100`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {capitalSummary.alerts.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>공시 / 조달 이력</h2>
            <span>{capitalSummary.disclosureCount + capitalSummary.financingCount + capitalSummary.dividendCount}건</span>
          </div>
          <div className="game-save-list">
            {state.capitalMarket.disclosures.slice(0, 3).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.type} / 비용 {formatMoney(row.costKrw)}</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.trustDelta >= 0 ? '+' : ''}{row.trustDelta}</strong>
              </article>
            ))}
            {state.capitalMarket.financingPlans.slice(0, 3).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.type} / 부채 {formatMoney(row.debtKrw)}</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{formatMoney(row.cashKrw)}</strong>
              </article>
            ))}
            {!state.capitalMarket.disclosures.length && !state.capitalMarket.financingPlans.length ? <div className="games-empty">공시 대응이나 자금 조달을 실행하면 이력이 표시됩니다.</div> : null}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재무 요약</h2>
            <span>{latestSettlement ? `${latestSettlement.year}-${String(latestSettlement.month).padStart(2, '0')}` : '결산 전'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="총자산" value={formatMoney(report.assets)} />
            <SmallStat label="부채" value={formatMoney(report.liabilities)} />
            <SmallStat label="재고" value={formatMoney(report.inventoryAmount)} />
            <SmallStat label="매출" value={formatMoney(report.sales)} />
            <SmallStat label="VAT" value={formatMoney(report.vatPayableAmount)} />
            <SmallStat label="손상잔액" value={formatMoney(report.inventoryWriteDownBalance)} />
          </div>
          {latestSettlement ? (
            <div className="game-save-list">
              <article className="game-save-row">
                <div>
                  <span>최근 월말 결산</span>
                  <strong>영업손익 {formatMoney(latestSettlement.operatingProfit)}</strong>
                </div>
                <strong>{formatMoney(latestSettlement.netProfit)}</strong>
              </article>
            </div>
          ) : <div className="games-empty">월말 결산을 실행하면 손익과 현금흐름이 표시됩니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>스냅샷</h2>
            <span>{state.ledgerSnapshots.length}개</span>
          </div>
          <div className="game-save-list">
            {state.ledgerSnapshots.length ? state.ledgerSnapshots.map((snapshot) => (
              <article className="game-save-row" key={snapshot.id}>
                <div>
                  <span>{snapshot.rowCount} rows / {snapshot.checksum}</span>
                  <strong>{snapshot.label}</strong>
                </div>
                <strong>{new Date(snapshot.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong>
              </article>
            )) : <div className="games-empty">아직 원장 스냅샷이 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>복원 이력</h2>
            <span>{latestRestore?.status || '기록 없음'}</span>
          </div>
          <div className="game-save-list">
            {state.restoreHistory.length ? state.restoreHistory.slice(0, 5).map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.type} / {item.restoreMode} / {item.targetTableCount} tables</span>
                  <strong>{item.message || `${item.beforeDiffStatus || '-'} → ${item.afterDiffStatus || '-'}`}</strong>
                  <span>{item.deleteOrder?.length ? `delete ${item.deleteOrder.slice(0, 3).join(' → ')} / insert ${item.insertOrder.slice(0, 3).join(' → ')}` : '복원 순서 없음'}</span>
                  <span>{item.checksum || '-'}</span>
                </div>
                <strong>{item.status}</strong>
              </article>
            )) : <div className="games-empty">dry-run 또는 복원을 실행하면 감사 이력이 남습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>리포트 아카이브</h2>
            <span>{latestBookmark?.label || '북마크 없음'}</span>
          </div>
          <div className="game-save-list">
            {state.reportBookmarks.length ? state.reportBookmarks.slice(0, 5).map((bookmark) => (
              <article className="game-save-row" key={bookmark.id}>
                <div>
                  <span>{bookmark.favorite ? '즐겨찾기' : '일반'} / {bookmark.note}</span>
                  <strong>{bookmark.label}</strong>
                  <span>자산 {formatMoney(bookmark.assets)} / 채권 {formatMoney(bookmark.receivableAmount)}</span>
                </div>
                <strong>{Number(bookmark.score || 0).toLocaleString('ko-KR')}</strong>
              </article>
            )) : <div className="games-empty">중요한 결산이나 진행 리포트를 북마크할 수 있습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>내보내기 기록</h2>
            <span>{latestExport?.checksum || '기록 없음'}</span>
          </div>
          <div className="game-save-list">
            {state.exportHistory.length ? state.exportHistory.slice(0, 5).map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.exportType} / {item.itemCount} items</span>
                  <strong>{item.exportNote}</strong>
                  <span>{String(item.content || '').split('\n').slice(0, 2).join(' / ')}</span>
                </div>
                <strong>{item.checksum}</strong>
              </article>
            )) : <div className="games-empty">진행 내보내기를 실행하면 감사용 기록이 남습니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주문 원장</h2>
            <span>{orders.length}건</span>
          </div>
          <div className="game-save-list">
            {orders.slice(0, 8).map((order) => (
              <article className="game-save-row" key={order.id}>
                <div>
                  <span>{order.partnerName} / {order.productName}</span>
                  <strong>{order.no}</strong>
                  <span>{order.quantity}개 / {formatMoney(order.totalAmount)}</span>
                </div>
                <StatusBadge value={order.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>매출채권</h2>
            <span>{formatMoney(report.receivableAmount)}</span>
          </div>
          <div className="game-save-list">
            {receivables.slice(0, 8).map((ar) => (
              <article className="game-save-row" key={ar.id}>
                <div>
                  <span>{ar.partnerName} / 회수 {formatMoney(ar.collected)}</span>
                  <strong>{ar.id}</strong>
                  <span>잔액 {formatMoney(ar.remaining)}</span>
                </div>
                <StatusBadge value={ar.status} />
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재고 원장</h2>
            <span>{stocks.length}품목</span>
          </div>
          <div className="game-save-list">
            {stocks.map((stock) => (
              <article className="game-save-row" key={stock.id}>
                <div>
                  <span>{stock.category} / {stock.character}</span>
                  <strong>{stock.name}</strong>
                  <span>평균원가 {formatMoney(stock.avgCost)} / 장부 {formatMoney(stock.amount)}</span>
                </div>
                <strong>{stock.onHand}개</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
