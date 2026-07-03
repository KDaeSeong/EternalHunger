'use client';

const EMPTY_TRADE_ROW = { itemId: '', qty: 1 };

function normalizeRows(rows) {
  return Array.isArray(rows) && rows.length ? rows : [EMPTY_TRADE_ROW];
}

export default function SimulationMarketTradeCreateForm({
  createTradeOffer,
  inventoryOptions,
  publicItems,
  selectedCharId,
  setTradeDraft,
  setTradeWantSearch,
  tradeDraft,
  tradeWantItemOptions,
  tradeWantSearch,
}) {
  const draft = tradeDraft || {};
  const giveRows = normalizeRows(draft.give);
  const wantRows = normalizeRows(draft.want);
  const inventory = Array.isArray(inventoryOptions) ? inventoryOptions : [];
  const publicItemRows = Array.isArray(publicItems) ? publicItems : [];
  const wantOptions = Array.isArray(tradeWantItemOptions) ? tradeWantItemOptions : [];

  const updateDraft = (patch) => setTradeDraft({ ...draft, ...patch });
  const updateRow = (field, idx, patch) => {
    const rows = normalizeRows(draft[field]);
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    updateDraft({ [field]: next });
  };
  const removeRow = (field, idx) => {
    const next = normalizeRows(draft[field]).filter((_, rowIdx) => rowIdx !== idx);
    updateDraft({ [field]: next.length ? next : [EMPTY_TRADE_ROW] });
  };
  const appendRow = (field) => updateDraft({ [field]: [...normalizeRows(draft[field]), EMPTY_TRADE_ROW] });

  return (
    <div className="market-card" style={{ marginTop: 18 }}>
      <div className="market-title">오퍼 생성</div>
      <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

      <div style={{ marginTop: 12 }}>
        <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
        {giveRows.map((row, idx) => (
          <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
            <select
              value={row.itemId}
              onChange={(e) => updateRow('give', idx, { itemId: e.target.value })}
              style={{ flex: 1 }}
            >
              <option value="">(선택)</option>
              {inventory.map((item) => (
                <option key={item.itemId} value={item.itemId}>{item.name} (보유 {item.qty})</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={row.qty}
              onChange={(e) => updateRow('give', idx, { qty: e.target.value })}
              style={{ width: 70 }}
            />
            <button className="market-mini-btn" onClick={() => removeRow('give', idx)}>
              삭제
            </button>
          </div>
        ))}
        <button
          className="market-mini-btn"
          style={{ marginTop: 8 }}
          onClick={() => appendRow('give')}
        >
          + give 추가
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
        <input
          value={tradeWantSearch}
          onChange={(e) => setTradeWantSearch(e.target.value)}
          placeholder={`원하는 아이템 검색 (표시 ${wantOptions.length}/${publicItemRows.length})`}
          style={{ width: '100%', marginTop: 8 }}
        />
        {wantRows.map((row, idx) => (
          <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
            <select
              value={row.itemId}
              onChange={(e) => updateRow('want', idx, { itemId: e.target.value })}
              style={{ flex: 1 }}
            >
              <option value="">(선택 안 함)</option>
              {wantOptions.map((item) => (
                <option key={item._id} value={item._id}>{item.name} (tier {item.tier || 1})</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={row.qty}
              onChange={(e) => updateRow('want', idx, { qty: e.target.value })}
              style={{ width: 70 }}
            />
            <button className="market-mini-btn" onClick={() => removeRow('want', idx)}>
              삭제
            </button>
          </div>
        ))}
        <button
          className="market-mini-btn"
          style={{ marginTop: 8 }}
          onClick={() => appendRow('want')}
        >
          + want 추가
        </button>
      </div>

      <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
        <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
        <input
          type="number"
          min={0}
        value={draft.wantCredits ?? 0}
          onChange={(e) => updateDraft({ wantCredits: e.target.value })}
          style={{ width: 120 }}
        />
      </div>

      <div className="market-row" style={{ marginTop: 10 }}>
        <textarea
          value={draft.note || ''}
          onChange={(e) => updateDraft({ note: e.target.value })}
          placeholder="메모(선택)"
          style={{ width: '100%', minHeight: 64 }}
        />
      </div>

      <div className="market-actions" style={{ marginTop: 10 }}>
        <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
      </div>
    </div>
  );
}
