'use client';

export default function SimulationMarketCraftSection({
  craftables,
  doCraft,
  getQty,
  itemNameById,
  selectedCharId,
  setQty,
  setShowAllMarketRows,
  visibleCraftables,
}) {
  return (
    <div className="market-section">
      <div className="market-small" style={{ marginBottom: 8 }}>레시피가 있는 아이템만 표시됩니다.</div>
      {craftables.length === 0 ? (
        <div className="market-card">조합 가능한 아이템이 없습니다. (관리자에서 레시피를 등록하세요)</div>
      ) : (
        <>
          {visibleCraftables.map((it) => (
            <div key={it._id} className="market-card">
              <div className="market-row">
                <div>
                  <div className="market-title">{it.name}</div>
                  <div className="market-small">tier {it.tier || 1} · {it.rarity || 'common'} · 비용 {Number(it?.recipe?.creditsCost || 0)} Cr</div>
                </div>
              </div>

              <div className="market-small" style={{ marginTop: 8 }}>
                재료: {(it.recipe.ingredients || []).map((ing) => {
                  const ingId = String(ing.itemId);
                  const ingName = itemNameById[ingId] || ingId;
                  return `${ingName} x${Number(ing.qty || 1)}`;
                }).join(', ')}
              </div>

              <div className="market-actions" style={{ marginTop: 10 }}>
                <input
                  type="number"
                  min={1}
                  value={getQty(`craft:${it._id}`, 1)}
                  onChange={(e) => setQty(`craft:${it._id}`, e.target.value)}
                />
                <button onClick={() => doCraft(it._id)} disabled={!selectedCharId}>조합</button>
              </div>
            </div>
          ))}
          {craftables.length > visibleCraftables.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              조합 목록 더 보기 ({visibleCraftables.length}/{craftables.length})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
