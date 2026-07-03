'use client';

export default function SimulationMarketPerkSection({
  doPerkPurchase,
  fireAndReport,
  loadMarket,
  ownedPerkCodeSet,
  publicPerks,
  setShowAllMarketRows,
  viewerLp,
  visiblePublicPerks,
}) {
  return (
    <div className="market-section">
      <div className="market-small" style={{ marginBottom: 8 }}>계정 단위 특전입니다. 구매 후 홈/시뮬 모두 즉시 반영됩니다.</div>
      {publicPerks.length === 0 ? (
        <div className="market-card">활성 특전이 없습니다. (관리자에서 특전을 등록하세요)</div>
      ) : (
        <>
          {visiblePublicPerks.map((perk) => {
            const code = String(perk?.code || '');
            const owned = ownedPerkCodeSet.has(code);
            const cost = Math.max(0, Number(perk?.lpCost || 0));
            const desc = String(perk?.description || perk?.effectText || perk?.summary || '').trim();
            return (
              <div key={perk?._id || code} className="market-card">
                <div className="market-row">
                  <div>
                    <div className="market-title">{perk?.name || code || '특전'}</div>
                    <div className="market-small">코드: {code || '-'} · 비용: {cost} LP{perk?.category ? ` · ${perk.category}` : ''}</div>
                  </div>
                  <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                </div>
                {desc ? <div className="market-small" style={{ marginTop: 8 }}>{desc}</div> : null}
                <div className="market-actions" style={{ marginTop: 10 }}>
                  <button onClick={() => doPerkPurchase(code)} disabled={!code || owned || Number(viewerLp || 0) < cost}>
                    {owned ? '보유 중' : `구매 (${cost} LP)`}
                  </button>
                </div>
              </div>
            );
          })}
          {publicPerks.length > visiblePublicPerks.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              특전 더 보기 ({visiblePublicPerks.length}/{publicPerks.length})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
