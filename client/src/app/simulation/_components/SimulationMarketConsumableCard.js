'use client';

import {
  inferItemCategory,
  itemDisplayName,
  itemIcon,
} from '../_lib/simulationEngine';

export default function SimulationMarketConsumableCard({
  devForceUseConsumable,
  isAdvancing,
  isGameOver,
  selectedChar,
  selectedCharId,
}) {
  if (!selectedCharId || !selectedChar) return null;

  const consumables = (Array.isArray(selectedChar.inventory) ? selectedChar.inventory : [])
    .map((item, idx) => ({ item, idx }))
    .filter((row) => inferItemCategory(row.item) === 'consumable');

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🧪 소모품 강제 사용(개발자)</div>
      <div className="market-small">시뮬은 기본적으로 플레이어가 자동 사용합니다. 이 영역은 개발자 도구가 켜졌을 때만 노출됩니다.</div>
      <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {consumables.length === 0 ? (
          <div className="market-small">소모품이 없습니다.</div>
        ) : (
          consumables.slice(0, 12).map(({ item, idx }) => {
            const qty = Math.max(1, Number(item?.qty || 1));
            return (
              <button
                key={`dev-cons-${idx}-${String(item?._id || item?.itemId || '')}`}
                onClick={() => devForceUseConsumable(selectedCharId, idx)}
                disabled={isAdvancing || isGameOver}
                title={isAdvancing ? '진행 중에는 사용할 수 없습니다.' : '개발자 도구: 임의로 사용'}
              >
                {itemIcon(item)} {itemDisplayName(item)}{qty > 1 ? ` x${qty}` : ''}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
