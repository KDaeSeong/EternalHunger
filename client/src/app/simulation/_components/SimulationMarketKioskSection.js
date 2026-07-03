'use client';

export default function SimulationMarketKioskSection({
  doKioskTransaction,
  fireAndReport,
  getQty,
  itemNameById,
  kiosks,
  loadMarket,
  marketCardRenderLimit,
  selectedCharId,
  setQty,
  setShowAllMarketRows,
  showAllMarketRows,
  visibleKiosks,
}) {
  return (
    <div className="market-section">
      {kiosks.length === 0 ? (
        <div className="market-card">키오스크가 없습니다. (관리자에서 키오스크/카탈로그를 등록하세요)</div>
      ) : (
        <>
          {visibleKiosks.map((k) => (
            <div key={k._id} className="market-card">
              <div className="market-row">
                <div>
                  <div className="market-title">{k.name || '키오스크'}</div>
                  <div className="market-small">위치: {k.mapId?.name || '미지정'}</div>
                </div>
                <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
              </div>

              <div style={{ marginTop: 10 }}>
                {(Array.isArray(k.catalog) ? k.catalog : []).slice(0, showAllMarketRows ? undefined : marketCardRenderLimit).map((entry, idx) => {
                  const mode = entry.mode || 'sell';
                  const label = mode === 'sell' ? '구매' : mode === 'buy' ? '판매' : '교환';
                  const price = Math.max(0, Number(entry.priceCredits || 0));

                  const itemId = entry.itemId?._id || entry.itemId;
                  const itemName = entry.itemId?.name || itemNameById[String(itemId)] || String(itemId || '미지정');

                  const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                  const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById[String(exId)] || String(exId)) : '');
                  const exQty = Number(entry.exchange?.giveQty || 1);

                  return (
                    <div key={idx} className="market-subcard">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{label}: {itemName}</div>
                          <div className="market-small">
                            {mode === 'exchange'
                              ? `재료: ${exName || '미지정'} x${exQty}`
                              : `단가: ${price} Cr`}
                          </div>
                        </div>
                      </div>

                      <div className="market-actions" style={{ marginTop: 8 }}>
                        <input
                          type="number"
                          min={1}
                          value={getQty(`kiosk:${k._id}:${idx}`, 1)}
                          onChange={(e) => setQty(`kiosk:${k._id}:${idx}`, e.target.value)}
                        />
                        <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId || !itemId}>실행</button>
                      </div>
                    </div>
                  );
                })}
                {!showAllMarketRows && Array.isArray(k.catalog) && k.catalog.length > marketCardRenderLimit ? (
                  <div className="market-small" style={{ marginTop: 8 }}>
                    카탈로그 {marketCardRenderLimit}/{k.catalog.length}개 표시 중
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {kiosks.length > visibleKiosks.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              키오스크 더 보기 ({visibleKiosks.length}/{kiosks.length})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
