'use client';

function tradeItemsText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.itemId?.name || item.itemId} x${item.qty}`)
    .join(', ');
}

export default function SimulationMarketMyTradeOffers({
  cancelTradeOffer,
  loadTrades,
  myTradeOffers,
  setShowAllMarketRows,
  visibleMyTradeOffers,
}) {
  const offers = Array.isArray(myTradeOffers) ? myTradeOffers : [];
  const visibleOffers = Array.isArray(visibleMyTradeOffers) ? visibleMyTradeOffers : [];

  return (
    <>
      <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
        <div className="market-small">내 오퍼</div>
        <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
      </div>

      {offers.length === 0 ? (
        <div className="market-card">내 오퍼가 없습니다.</div>
      ) : (
        <>
          {visibleOffers.map((offer) => (
            <div key={offer._id} className="market-card">
              <div className="market-title">상태: {offer.status}</div>
              <div className="market-small" style={{ marginTop: 6 }}>
                주는 것: {tradeItemsText(offer.give)}
              </div>
              <div className="market-small" style={{ marginTop: 4 }}>
                원하는 것: {(Array.isArray(offer.want) ? offer.want : []).length ? tradeItemsText(offer.want) : '없음'}
                {Number(offer.wantCredits || 0) > 0 ? ` + ${Number(offer.wantCredits)} Cr` : ''}
              </div>
              <div className="market-actions" style={{ marginTop: 10 }}>
                {offer.status === 'open' ? (
                  <button onClick={() => cancelTradeOffer(offer._id)}>취소</button>
                ) : null}
              </div>
            </div>
          ))}
          {offers.length > visibleOffers.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              내 오퍼 더 보기 ({visibleOffers.length}/{offers.length})
            </button>
          ) : null}
        </>
      )}
    </>
  );
}
