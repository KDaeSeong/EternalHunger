import {
  ITEMS,
  itemName,
  totalCarryWeight,
} from '../_lib/primitiveArchiveEngine';

export default function PrimitiveArchiveInventoryTab(props) {
  const {
    currentLogCapacity,
    inventoryRows,
    state,
  } = props;

  return (
    <>

          <section className="games-dashboard">
            <section className="games-panel">
              <div className="games-panel-title">
                <h2>인벤토리</h2>
                <span>{totalCarryWeight(state).toLocaleString('ko-KR')} 무게</span>
              </div>
              {inventoryRows.length ? (
                <div className="game-save-list">
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

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>로그</h2>
                <span>{state.log.length}/{currentLogCapacity}</span>
              </div>
              <div className="games-activity-list">
                {state.log.slice(0, 12).map((line, index) => (
                  <div key={`${line}-${index}`}>
                    <strong>{line}</strong>
                  </div>
                ))}
              </div>
            </section>
          </section>
                </>
  );
}
