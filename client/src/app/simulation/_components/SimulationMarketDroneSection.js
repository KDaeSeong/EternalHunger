'use client';

export default function SimulationMarketDroneSection({
  doDroneBuy,
  droneOffers,
  fireAndReport,
  getQty,
  loadMarket,
  selectedCharId,
  setQty,
  setShowAllMarketRows,
  visibleDroneOffers,
}) {
  return (
    <div className="market-section">
      {droneOffers.length === 0 ? (
        <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
      ) : (
        <>
          {visibleDroneOffers.map((o) => (
            <div key={o._id} className="market-card">
              <div className="market-row">
                <div>
                  <div className="market-title">{o.itemId?.name || '아이템'}</div>
                  <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                </div>
                <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
              </div>
              <div className="market-actions" style={{ marginTop: 10 }}>
                <input
                  type="number"
                  min={1}
                  value={getQty(`drone:${o._id}`, 1)}
                  onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                />
                <button onClick={() => doDroneBuy(o._id)} disabled={!selectedCharId}>구매</button>
              </div>
            </div>
          ))}
          {droneOffers.length > visibleDroneOffers.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              드론 목록 더 보기 ({visibleDroneOffers.length}/{droneOffers.length})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
