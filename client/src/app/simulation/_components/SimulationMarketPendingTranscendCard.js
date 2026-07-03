'use client';

import {
  clampTier4,
  itemDisplayName,
  itemIcon,
  tierLabelKo,
} from '../_lib/simulationEngine';

export default function SimulationMarketPendingTranscendCard({
  getZoneName,
  isAdvancing,
  isGameOver,
  pendingTranscendPick,
  publicItems,
  resolvePendingTranscendPick,
}) {
  if (!pendingTranscendPick) return null;

  const items = Array.isArray(publicItems) ? publicItems : [];
  const options = Array.isArray(pendingTranscendPick.options) ? pendingTranscendPick.options : [];

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🎁 초월 장비 선택 상자(대기)</div>
      <div className="market-small">
        [{pendingTranscendPick.characterName || pendingTranscendPick.characterId}] {getZoneName(pendingTranscendPick.zoneId)} · 선택 완료 전에는 진행이 잠깁니다.
      </div>
      <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {options.map((option, idx) => {
          const item = items.find((row) => String(row?._id) === String(option?.itemId)) || null;
          const name = itemDisplayName(item || { _id: option?.itemId, name: option?.name });
          const tierText = tierLabelKo(clampTier4(item?.tier ?? option?.tier ?? 4));
          const slotText = String(item?.equipSlot || option?.slot || '');
          return (
            <button
              key={`tp-${pendingTranscendPick.id || 'p'}-${String(option?.itemId || idx)}`}
              onClick={() => resolvePendingTranscendPick(idx, 'manual')}
              disabled={isAdvancing || isGameOver}
            >
              {itemIcon(item)} {name} ({tierText}{slotText ? `/${slotText}` : ''})
            </button>
          );
        })}
        <button onClick={() => resolvePendingTranscendPick(-1, 'auto')} disabled={isAdvancing || isGameOver}>자동(추천)</button>
      </div>
    </div>
  );
}
