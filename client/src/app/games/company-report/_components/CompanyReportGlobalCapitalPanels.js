import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  CAPITAL_DISCLOSURE_TYPES,
  CAPITAL_FINANCING_TYPES,
  PRODUCTS,
  closeCapitalMarketAction,
  collectForeignReceivableAction,
  createDisclosureAction,
  createExportPlanAction,
  createHedgeContractAction,
  createImportPlanAction,
  decideDividendAction,
  formatMoney,
  raiseCapitalAction,
  settleGlobalTradeAction,
} from '../_lib/companyReportEngine';
import { StatusBadge, getMarketName, getProductName } from '../_lib/companyReportPlayHelpers';

export default function CompanyReportGlobalCapitalPanels({
  applyLedgerAction,
  capitalSummary,
  disclosureTypeId,
  financingTypeId,
  foreignReceivables,
  globalMarketId,
  globalProductId,
  globalSummary,
  globalUnits,
  markets,
  recentActionText,
  selectedForeignAr,
  setDisclosureTypeId,
  setFinancingTypeId,
  setGlobalMarketId,
  setGlobalProductId,
  setGlobalUnits,
  setSelectedForeignArId,
  state,
}) {
  return (
    <>
      <section className="games-detail-grid">
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
    </>
  );
}
