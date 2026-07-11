'use client';

import { useState } from 'react';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  ITEMS,
  equipmentChoicesForSlot,
  itemName,
  totalCarryWeight,
} from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveWorkspaceTabs from './PrimitiveArchiveWorkspaceTabs';

export default function PrimitiveArchiveInventoryTab(props) {
  const [activeWorkspace, setActiveWorkspace] = useState('items');
  const {
    actor,
    actorId,
    autoEquip,
    changeEquipmentSlot,
    clearEquipment,
    currentEquipmentRows,
    currentLogCapacity,
    equipmentAdviceMode,
    equipmentAdviceRows,
    equipmentInventory,
    inventoryRows,
    setActorId,
    state,
  } = props;
  const tabs = [
    { id: 'items', label: '아이템', icon: 'inventory', badge: `${inventoryRows.length}종` },
    { id: 'equipment', label: '장비', icon: 'equip', badge: `${equipmentInventory.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개` },
    { id: 'log', label: '로그', icon: 'archive', badge: `${state.log.length}/${currentLogCapacity}` },
  ];

  return (
    <section className="primitive-inventory-workspace">
      <PrimitiveArchiveWorkspaceTabs
        activeId={activeWorkspace}
        label="인벤토리와 장비 화면"
        onChange={setActiveWorkspace}
        tabs={tabs}
      />

      {activeWorkspace === 'items' ? (
        <section className="games-panel primitive-workspace-panel" role="tabpanel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{totalCarryWeight(state).toLocaleString('ko-KR')} 무게</span>
          </div>
          {inventoryRows.length ? (
            <div className="primitive-inventory-grid">
              {inventoryRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>{ITEMS[id]?.icon || 'item'}</span>
                    <strong>{itemName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">보유 아이템이 없습니다.</div>}
        </section>
      ) : null}

      {activeWorkspace === 'equipment' ? (
        <section className="games-panel primitive-workspace-panel" role="tabpanel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{actor?.name || '대상'} · 보온 {actor ? currentEquipmentRows.reduce((sum, row) => sum + Number(row.insulation || 0), 0) : 0}</span>
          </div>
          <div className="primitive-equipment-toolbar">
            <label className="game-save-json-field">
              <span>대상</span>
              <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
                {state.party.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}
              </select>
            </label>
            <div>
              <GameControlButton action="equip" onClick={() => autoEquip('role')}>역할 추천</GameControlButton>
              <GameControlButton action="equip" onClick={() => autoEquip('weather')}>날씨 대응</GameControlButton>
              <GameControlButton action="reset" onClick={clearEquipment}>전체 해제</GameControlButton>
            </div>
          </div>
          {equipmentAdviceRows.length ? (
            <div className="games-action-result primitive-equipment-advice">
              <span>{equipmentAdviceMode === 'weather' ? '날씨 대응 추천' : '역할 추천'}</span>
              <strong>{equipmentAdviceRows[0].slotLabel}: {equipmentAdviceRows[0].name} · {equipmentAdviceRows[0].detail}</strong>
            </div>
          ) : null}
          <div className="primitive-equipment-grid">
            {currentEquipmentRows.map((row) => {
              const choices = equipmentChoicesForSlot(state, actorId, row.slot);
              return (
                <label className="primitive-equipment-slot" key={row.slot}>
                  <span>{row.label}</span>
                  <strong>{row.itemName}</strong>
                  <select value={row.itemId} onChange={(event) => changeEquipmentSlot(row.slot, event.target.value)}>
                    {choices.map((choice) => (
                      <option value={choice.itemId} key={`${row.slot}-${choice.itemId || 'none'}`}>
                        {choice.name}{choice.qty ? ` x${choice.qty}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <details className="primitive-equipment-owned">
            <summary>보유 장비 {equipmentInventory.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개 보기</summary>
            <div className="games-chip-row">
              {equipmentInventory.length ? equipmentInventory.map((item) => (
                <span className="games-tag" key={item.itemId}>{EQUIPMENT_SLOT_LABELS[item.slot] || item.slot} · {item.name} x{item.qty}</span>
              )) : <span className="games-tag">보유 장비 없음</span>}
            </div>
          </details>
        </section>
      ) : null}

      {activeWorkspace === 'log' ? (
        <section className="games-panel primitive-workspace-panel" role="tabpanel">
          <div className="games-panel-title">
            <h2>로그</h2>
            <span>{state.log.length}/{currentLogCapacity}</span>
          </div>
          <div className="games-activity-list primitive-log-list">
            {state.log.slice(0, 18).map((line, index) => (
              <div key={`${line}-${index}`}><strong>{line}</strong></div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
