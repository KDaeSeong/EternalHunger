import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  LEDGER_RESTORE_MODES,
  PARTNERS,
  PRODUCTS,
  bookmarkCurrentReportAction,
  closeInventoryValuationAction,
  createLedgerSnapshotAction,
  createOrderAction,
  createProgressExportAction,
  dryRunLedgerRestoreAction,
  formatMoney,
  inboundInventoryAction,
  marketingCampaignAction,
  monthEndCloseAction,
  restoreLedgerSnapshotAction,
  restoreLatestSnapshotAction,
  shipOrderAction,
  collectReceivableAction,
} from '../_lib/companyReportEngine';
import { StatusBadge } from '../_lib/companyReportPlayHelpers';

export default function CompanyReportArchiveLedgerPanels({
  applyLedgerAction,
  downloadProgressCsv,
  downloadProgressJson,
  downloadRestorePlanJson,
  latestBookmark,
  latestExport,
  latestRestore,
  latestSettlement,
  latestSnapshot,
  orders,
  partnerId,
  productId,
  quantity,
  receivables,
  recentActionText,
  resultPresentation,
  report,
  restoreMode,
  restorePlan,
  selectedOrder,
  selectedReceivable,
  selectedRestoreTables,
  setPartnerId,
  setProductId,
  setQuantity,
  setRestoreMode,
  setSelectedOrderId,
  setSelectedReceivableId,
  setSelectedRestoreTables,
  state,
  stocks,
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
            <ActionButton action="order" cue="off" onClick={() => applyLedgerAction('주문 생성', (current) => createOrderAction(current, partnerId, productId, quantity))}>주문 생성</ActionButton>
            <ActionButton action="production" cue="off" onClick={() => applyLedgerAction('생산 입고', (current) => inboundInventoryAction(current, productId, quantity))}>선택 상품 생산 입고</ActionButton>
            <ActionButton action="sales" cue="off" onClick={() => applyLedgerAction('상품 캠페인', (current) => marketingCampaignAction(current, productId))}>선택 상품 캠페인</ActionButton>
          </div>
          <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
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
            <ActionButton action="shipment" cue="off" disabled={!selectedOrder} onClick={() => applyLedgerAction('주문 출고', (current) => shipOrderAction(current, selectedOrder?.id))}>선택 주문 출고</ActionButton>
            <ActionButton action="collection" cue="off" disabled={!selectedReceivable || selectedReceivable.remaining <= 0} onClick={() => applyLedgerAction('채권 회수', (current) => collectReceivableAction(current, selectedReceivable?.id))}>선택 채권 전액 회수</ActionButton>
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
            <ActionButton action="valuation" cue="off" onClick={() => applyLedgerAction('월말 재고평가', (current) => closeInventoryValuationAction(current))}>월말 재고평가</ActionButton>
            <ActionButton action="closing" cue="off" onClick={() => applyLedgerAction('월말 결산', (current) => monthEndCloseAction(current))}>월말 결산</ActionButton>
            <ActionButton action="snapshot" cue="off" onClick={() => applyLedgerAction('원장 스냅샷', (current) => createLedgerSnapshotAction(current))}>원장 스냅샷 생성</ActionButton>
            <ActionButton action="restore" cue="off" disabled={!latestSnapshot} onClick={() => applyLedgerAction('최근 스냅샷 복원', (current) => restoreLatestSnapshotAction(current))}>최근 스냅샷 복원</ActionButton>
            <ActionButton action="analysis" cue="off" disabled={!latestSnapshot} onClick={() => applyLedgerAction('복원 dry-run', (current) => dryRunLedgerRestoreAction(current, restoreMode, selectedRestoreTables))}>복원 dry-run</ActionButton>
            <ActionButton action="restore" cue="off" disabled={!latestSnapshot || !restorePlan.restorable} onClick={() => applyLedgerAction('선택 모드 복원', (current) => restoreLedgerSnapshotAction(current, restoreMode, selectedRestoreTables))}>선택 모드 복원</ActionButton>
            <ActionButton action="bookmark" cue="off" onClick={() => applyLedgerAction('리포트 북마크', (current) => bookmarkCurrentReportAction(current))}>리포트 북마크</ActionButton>
            <ActionButton action="download" cue="off" onClick={() => applyLedgerAction('진행 내보내기', (current) => createProgressExportAction(current))}>진행 내보내기</ActionButton>
            <ActionButton action="download" cue="off" onClick={downloadProgressJson}>JSON 다운로드</ActionButton>
            <ActionButton action="download" cue="off" onClick={downloadProgressCsv}>CSV 다운로드</ActionButton>
            <ActionButton action="download" cue="off" disabled={!latestSnapshot} onClick={downloadRestorePlanJson}>복원 계획 JSON</ActionButton>
          </div>
          <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
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
