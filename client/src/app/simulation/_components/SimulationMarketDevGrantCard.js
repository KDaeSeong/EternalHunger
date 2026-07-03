'use client';

export default function SimulationMarketDevGrantCard({
  devGrantItemId,
  devGrantItemOptions,
  devGrantItemToSelected,
  devGrantQty,
  devGrantSearch,
  isAdvancing,
  isGameOver,
  selectedChar,
  selectedCharId,
  selectedDevGrantItem,
  setDevGrantItemId,
  setDevGrantQty,
  setDevGrantSearch,
  visibleDevGrantItemOptions,
}) {
  if (!selectedCharId || !selectedChar) return null;

  const visibleOptions = Array.isArray(visibleDevGrantItemOptions) ? visibleDevGrantItemOptions : [];
  const allOptions = Array.isArray(devGrantItemOptions) ? devGrantItemOptions : [];

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🛠 아이템 지급(개발자)</div>
      <div className="market-small">선택 캐릭터에게 아이템을 직접 지급합니다. 장비 아이템은 지급 후 자동 장착 규칙을 다시 적용합니다.</div>
      <input
        value={devGrantSearch}
        onChange={(e) => setDevGrantSearch(e.target.value)}
        placeholder={`아이템 검색 후 선택 (표시 ${visibleOptions.length}/${allOptions.length})`}
        style={{ width: '100%', marginTop: 8 }}
        disabled={isAdvancing || isGameOver}
      />
      <div className="dev-grant-list" role="listbox" aria-label="developer item grant list">
        {visibleOptions.length === 0 ? (
          <div className="market-small">검색 결과가 없습니다.</div>
        ) : (
          visibleOptions.map((item) => {
            const id = String(item?._id || '');
            const selected = id && id === String(devGrantItemId || '');
            return (
              <button
                type="button"
                key={`dev-grant-${id}`}
                className={`dev-grant-option ${selected ? 'selected' : ''}`}
                onClick={() => setDevGrantItemId(id)}
                disabled={isAdvancing || isGameOver || !id}
                role="option"
                aria-selected={selected}
                title={item?._label || item?.name || id}
              >
                <span>{item?._label || item?.name || id}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
        <div className="dev-grant-picked" title={selectedDevGrantItem?._label || ''}>
          선택: {selectedDevGrantItem?._label || '-'}
        </div>
        <input
          type="number"
          min="1"
          max="99"
          value={devGrantQty}
          onChange={(e) => setDevGrantQty(e.target.value)}
          style={{ width: 76 }}
          disabled={isAdvancing || isGameOver}
        />
        <button
          className="market-mini-btn"
          onClick={devGrantItemToSelected}
          disabled={isAdvancing || isGameOver || !devGrantItemId}
        >
          지급
        </button>
      </div>
    </div>
  );
}
