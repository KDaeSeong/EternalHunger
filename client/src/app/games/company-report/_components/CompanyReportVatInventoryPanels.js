import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import { closeInventoryValuationAction, formatMoney } from '../_lib/companyReportEngine';
import { StatusBadge } from '../_lib/companyReportPlayHelpers';

export default function CompanyReportVatInventoryPanels({
  applyLedgerAction,
  handleVatSelect,
  inventoryValuations,
  inventoryWriteDowns,
  recentActionText,
  report,
  runVatPayment,
  selectedVatRow,
  setVatPaymentAmount,
  state,
  vatPayAmount,
  vatPaymentAmount,
  vatPayments,
  vatSchedule,
}) {
  return (
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
          action="settle"
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
        <ActionButton action="analysis" onClick={() => applyLedgerAction('현재 월 재고평가', (current) => closeInventoryValuationAction(current))}>현재 월 재고평가 실행</ActionButton>
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
  );
}
