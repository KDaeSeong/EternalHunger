'use client';

import {
  EQUIP_SLOTS,
  clampTier4,
  ensureEquipped,
  getInvItemId,
  inferEquipSlot,
  inferItemCategory,
  itemDisplayName,
  itemIcon,
  tierLabelKo,
} from '../_lib/simulationEngine';

export default function SimulationMarketEquipmentCard({
  isAdvancing,
  isGameOver,
  selectedChar,
  selectedCharId,
  setEquipForSurvivor,
}) {
  if (!selectedCharId || !selectedChar) return null;

  const equippedBySlot = ensureEquipped(selectedChar);
  const inventory = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
  const equipmentRows = inventory
    .map((item, idx) => ({ item, idx }))
    .map(({ item, idx }) => {
      const category = String(item?.category || inferItemCategory(item));
      const slot = String(item?.equipSlot || inferEquipSlot(item));
      const itemId = getInvItemId(item);
      const isEquip = category === 'equipment' && slot && EQUIP_SLOTS.includes(String(slot));
      return { item, idx, slot, itemId, isEquip };
    })
    .filter((row) => row.isEquip && row.itemId);

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🎒 장비 장착/해제</div>
      <div className="market-small">무기/방어구는 장착 상태(equipped)를 우선 적용합니다.</div>
      <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {equipmentRows.length === 0 ? (
          <div className="market-small">장착 가능한 장비가 없습니다.</div>
        ) : (
          equipmentRows.slice(0, 30).map(({ item, idx, slot, itemId }) => {
            const tierText = tierLabelKo(clampTier4(item?.tier || 1));
            const name = itemDisplayName(item);
            const equipped = String(equippedBySlot?.[slot] || '') === String(itemId);
            return (
              <div key={`eq-${idx}-${itemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{itemIcon(item)}</span>
                <span style={{ fontWeight: 800 }}>{name}</span>
                <span className="market-small">({tierText}{slot ? `/${slot}` : ''})</span>
                <button
                  className={`invEquipBtn ${equipped ? 'off' : 'on'}`}
                  onClick={() => setEquipForSurvivor(selectedCharId, slot, equipped ? null : itemId)}
                  disabled={isAdvancing || isGameOver}
                >
                  {equipped ? '해제' : '장착'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
