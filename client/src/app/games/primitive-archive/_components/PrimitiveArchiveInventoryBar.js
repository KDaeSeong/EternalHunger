import { itemName } from '../_lib/primitiveArchiveEngine';

const CORE_RESOURCE_IDS = ['wood', 'stone', 'fiber', 'hide', 'berry', 'meat', 'herb', 'clay'];

export default function PrimitiveArchiveInventoryBar({ inventory, inventoryRows = [] }) {
  return (
    <section className="primitive-inventory-bar" aria-label="현재 보유 자원">
      <div className="primitive-inventory-bar__heading">
        <strong>현재 보유 자원</strong>
        <details className="primitive-inventory-bar__all">
          <summary>전체 보유품 {inventoryRows.length}종</summary>
          {inventoryRows.length ? (
            <ul className="primitive-inventory-bar__all-list">
              {inventoryRows.map(([id, quantity]) => (
                <li key={id}><span>{itemName(id)}</span><strong>{quantity}</strong></li>
              ))}
            </ul>
          ) : <p>보유품 없음</p>}
        </details>
      </div>
      <ul className="primitive-inventory-bar__core-list">
        {CORE_RESOURCE_IDS.map((id) => (
          <li key={id}><span>{itemName(id)}</span><strong>{Number(inventory?.[id] || 0)}</strong></li>
        ))}
      </ul>
    </section>
  );
}
