'use client';

function tradeItemsText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.itemId?.name || item.itemId} x${item.qty}`)
    .join(', ');
}

export default function SimulationMarketOpenTradeOffers({
  acceptTradeOffer,
  loadTrades,
  selectedCharId,
  setShowAllMarketRows,
  tradeOffers,
  visibleTradeOffers,
}) {
  const offers = Array.isArray(tradeOffers) ? tradeOffers : [];
  const visibleOffers = Array.isArray(visibleTradeOffers) ? visibleTradeOffers : [];

  return (
    <>
      <div className="market-row" style={{ marginBottom: 8 }}>
        <div className="market-small">오픈 오퍼</div>
        <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
      </div>

      {offers.length === 0 ? (
        <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
      ) : (
        <>
          {visibleOffers.map((offer) => (
            <div key={offer._id} className="market-card">
              <div className="market-title">{offer.fromCharacterId?.name || '상대'}의 오퍼</div>
              <div className="market-small" style={{ marginTop: 6 }}>
                주는 것: {tradeItemsText(offer.give)}
              </div>
              <div className="market-small" style={{ marginTop: 4 }}>
                원하는 것: {(Array.isArray(offer.want) ? offer.want : []).length ? tradeItemsText(offer.want) : '없음'}
                {Number(offer.wantCredits || 0) > 0 ? ` + ${Number(offer.wantCredits)} Cr` : ''}
              </div>
              {offer.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {offer.note}</div> : null}

              <div className="market-actions" style={{ marginTop: 10 }}>
                <button
                  onClick={() => acceptTradeOffer(offer._id)}
                  disabled={!selectedCharId || String(offer?.fromCharacterId?._id || '') === String(selectedCharId)}
                >
                  수락
                </button>
              </div>
            </div>
          ))}
          {offers.length > visibleOffers.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              오픈 오퍼 더 보기 ({visibleOffers.length}/{offers.length})
            </button>
          ) : null}
        </>
      )}
    </>
  );
}
