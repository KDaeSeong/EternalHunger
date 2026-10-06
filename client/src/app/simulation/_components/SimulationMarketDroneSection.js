'use client';

import GameActionIcon from '../../games/_components/GameActionIcon';
import { isMarketItemAllowed } from '../../../utils/marketItemPolicy.js';

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
  const allowedOffers = droneOffers.filter(offer => isMarketItemAllowed(offer.itemId, 'drone'));
  const visibleOffers = allowedOffers.slice(0, visibleDroneOffers.length);
  return (
    <div className="market-section">
      {allowedOffers.length === 0 ? (
        <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
      ) : (
        <>
          {visibleOffers.map((o) => (
            <div key={o._id} className="market-card">
              <div className="market-row">
                <div>
                  <div className="market-title">{o.itemId?.name || '아이템'}</div>
                  <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                </div>
                <button
                  type="button"
                  className="market-mini-btn sim-icon-label"
                  data-game-sfx="sync"
                  onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }}
                >
                  <GameActionIcon action="refresh" label="새로고침" />
                  새로고침
                </button>
              </div>
              <div className="market-actions" style={{ marginTop: 10 }}>
                <input
                  type="number"
                  min={1}
                  value={getQty(`drone:${o._id}`, 1)}
                  onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                />
                <button
                  className="sim-icon-label"
                  type="button"
                  data-game-sfx="off"
                  onClick={() => doDroneBuy(o._id)}
                  disabled={!selectedCharId}
                >
                  <GameActionIcon action="drone-delivery" label="드론 구매" />
                  구매
                </button>
              </div>
            </div>
          ))}
          {allowedOffers.length > visibleOffers.length ? (
            <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
              드론 목록 더 보기 ({visibleOffers.length}/{allowedOffers.length})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
