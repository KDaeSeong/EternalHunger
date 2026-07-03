'use client';

export default function SimulationMarketTabsPanel({
  acceptTradeOffer,
  activeViewerPerkBundle,
  cancelTradeOffer,
  craftables,
  createTradeOffer,
  credits,
  doCraft,
  doDroneBuy,
  doKioskTransaction,
  doPerkPurchase,
  droneOffers,
  fireAndReport,
  getQty,
  inventoryOptions,
  itemNameById,
  kiosks,
  loadMarket,
  loadTrades,
  marketCardRenderLimit,
  marketMessage,
  marketTab,
  myTradeOffers,
  ownedPerkCodeSet,
  publicItems,
  publicPerks,
  selectedCharId,
  setMarketTab,
  setQty,
  setShowAllMarketRows,
  setTradeDraft,
  setTradeWantSearch,
  showAllMarketRows,
  syncMyState,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  viewerLp,
  viewerPerks,
  visibleCraftables,
  visibleDroneOffers,
  visibleKiosks,
  visibleMyTradeOffers,
  visiblePublicPerks,
  visibleTradeOffers,
}) {
  return (
    <>
      <div className="market-tabs">
        <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
        <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
        <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
        <button className={`market-tab ${marketTab === 'perk' ? 'active' : ''}`} onClick={() => setMarketTab('perk')}>🎖️ 특전</button>
        <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
      </div>

      <div className="market-card" style={{ marginTop: 10 }}>
        <div className="market-row">
          <div>
            <div className="market-title">💳 계정 진행</div>
            <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
            {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
          </div>
          <button onClick={() => { void fireAndReport('market.sync', () => Promise.allSettled([syncMyState(), loadMarket()])); }} className="market-mini-btn">동기화</button>
        </div>
      </div>

      {marketMessage ? (
        <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
          <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
          <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
        </div>
      ) : null}

      {marketTab === 'craft' ? (
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
      ) : null}

      {marketTab === 'kiosk' ? (
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
      ) : null}

      {marketTab === 'drone' ? (
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
      ) : null}

      {marketTab === 'perk' ? (
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
      ) : null}

      {marketTab === 'trade' ? (
        <div className="market-section">
          <div className="market-row" style={{ marginBottom: 8 }}>
            <div className="market-small">오픈 오퍼</div>
            <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
          </div>

          {tradeOffers.length === 0 ? (
            <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
          ) : (
            <>
              {visibleTradeOffers.map((off) => (
                <div key={off._id} className="market-card">
                  <div className="market-title">{off.fromCharacterId?.name || '상대'}의 오퍼</div>
                  <div className="market-small" style={{ marginTop: 6 }}>
                    주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                  </div>
                  <div className="market-small" style={{ marginTop: 4 }}>
                    원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                      ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                      : '없음'}
                    {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                  </div>
                  {off.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {off.note}</div> : null}

                  <div className="market-actions" style={{ marginTop: 10 }}>
                    <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId || String(off?.fromCharacterId?._id || '') === String(selectedCharId)}>수락</button>
                  </div>
                </div>
              ))}
              {tradeOffers.length > visibleTradeOffers.length ? (
                <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                  오픈 오퍼 더 보기 ({visibleTradeOffers.length}/{tradeOffers.length})
                </button>
              ) : null}
            </>
          )}

          <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
            <div className="market-small">내 오퍼</div>
            <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
          </div>

          {myTradeOffers.length === 0 ? (
            <div className="market-card">내 오퍼가 없습니다.</div>
          ) : (
            <>
              {visibleMyTradeOffers.map((off) => (
                <div key={off._id} className="market-card">
                  <div className="market-title">상태: {off.status}</div>
                  <div className="market-small" style={{ marginTop: 6 }}>
                    주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                  </div>
                  <div className="market-small" style={{ marginTop: 4 }}>
                    원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                      ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                      : '없음'}
                    {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                  </div>
                  <div className="market-actions" style={{ marginTop: 10 }}>
                    {off.status === 'open' ? (
                      <button onClick={() => cancelTradeOffer(off._id)}>취소</button>
                    ) : null}
                  </div>
                </div>
              ))}
              {myTradeOffers.length > visibleMyTradeOffers.length ? (
                <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                  내 오퍼 더 보기 ({visibleMyTradeOffers.length}/{myTradeOffers.length})
                </button>
              ) : null}
            </>
          )}

          <div className="market-card" style={{ marginTop: 18 }}>
            <div className="market-title">오퍼 생성</div>
            <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

            <div style={{ marginTop: 12 }}>
              <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
              {(Array.isArray(tradeDraft.give) ? tradeDraft.give : []).map((row, idx) => (
                <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                  <select
                    value={row.itemId}
                    onChange={(e) => {
                      const next = [...tradeDraft.give];
                      next[idx] = { ...next[idx], itemId: e.target.value };
                      setTradeDraft({ ...tradeDraft, give: next });
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">(선택)</option>
                    {inventoryOptions.map((it) => (
                      <option key={it.itemId} value={it.itemId}>{it.name} (보유 {it.qty})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) => {
                      const next = [...tradeDraft.give];
                      next[idx] = { ...next[idx], qty: e.target.value };
                      setTradeDraft({ ...tradeDraft, give: next });
                    }}
                    style={{ width: 70 }}
                  />
                  <button
                    className="market-mini-btn"
                    onClick={() => {
                      const next = tradeDraft.give.filter((_, i) => i !== idx);
                      setTradeDraft({ ...tradeDraft, give: next.length ? next : [{ itemId: '', qty: 1 }] });
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                className="market-mini-btn"
                style={{ marginTop: 8 }}
                onClick={() => setTradeDraft({ ...tradeDraft, give: [...tradeDraft.give, { itemId: '', qty: 1 }] })}
              >
                + give 추가
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
              <input
                value={tradeWantSearch}
                onChange={(e) => setTradeWantSearch(e.target.value)}
                placeholder={`원하는 아이템 검색 (표시 ${tradeWantItemOptions.length}/${publicItems.length})`}
                style={{ width: '100%', marginTop: 8 }}
              />
              {(Array.isArray(tradeDraft.want) ? tradeDraft.want : []).map((row, idx) => (
                <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                  <select
                    value={row.itemId}
                    onChange={(e) => {
                      const next = [...tradeDraft.want];
                      next[idx] = { ...next[idx], itemId: e.target.value };
                      setTradeDraft({ ...tradeDraft, want: next });
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">(선택 안 함)</option>
                    {tradeWantItemOptions.map((it) => (
                      <option key={it._id} value={it._id}>{it.name} (tier {it.tier || 1})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) => {
                      const next = [...tradeDraft.want];
                      next[idx] = { ...next[idx], qty: e.target.value };
                      setTradeDraft({ ...tradeDraft, want: next });
                    }}
                    style={{ width: 70 }}
                  />
                  <button
                    className="market-mini-btn"
                    onClick={() => {
                      const next = tradeDraft.want.filter((_, i) => i !== idx);
                      setTradeDraft({ ...tradeDraft, want: next.length ? next : [{ itemId: '', qty: 1 }] });
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                className="market-mini-btn"
                style={{ marginTop: 8 }}
                onClick={() => setTradeDraft({ ...tradeDraft, want: [...tradeDraft.want, { itemId: '', qty: 1 }] })}
              >
                + want 추가
              </button>
            </div>

            <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
              <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
              <input
                type="number"
                min={0}
                value={tradeDraft.wantCredits}
                onChange={(e) => setTradeDraft({ ...tradeDraft, wantCredits: e.target.value })}
                style={{ width: 120 }}
              />
            </div>

            <div className="market-row" style={{ marginTop: 10 }}>
              <textarea
                value={tradeDraft.note}
                onChange={(e) => setTradeDraft({ ...tradeDraft, note: e.target.value })}
                placeholder="메모(선택)"
                style={{ width: '100%', minHeight: 64 }}
              />
            </div>

            <div className="market-actions" style={{ marginTop: 10 }}>
              <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
