import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  buyPropertyAction,
  cancelRentPropertyAction,
  enactEdictAction,
  rentPropertyAction,
  toggleLeasePropertyAction,
} from '../_lib/baSrpgEngine';

const DISTRICTS = [
  { id: 'plaza', title: '광장', desc: '길드, 칙령, 평판 업무' },
  { id: 'market', title: '상가', desc: '상점과 제작 시설' },
  { id: 'lodging', title: '숙소', desc: '휴식과 장기 정비' },
];

function propertyTone(property) {
  if (property.leased) return 'is-leased';
  if (property.active) return 'is-active';
  if (property.rented) return 'is-rented';
  if (property.owned) return 'is-owned';
  return 'is-empty';
}

function propertyStatusLabel(property) {
  if (property.leased) return '임대 수익';
  if (property.active) return '효과 적용';
  if (property.rented) return '임차 중';
  if (property.owned) return '소유';
  return '계약 가능';
}

function PropertyTile({
  credit,
  property,
  propertyId,
  setPropertyId,
  setState,
}) {
  const selected = propertyId === property.id;
  const canBuy = !property.owned && credit >= Number(property.buyPrice || 0);
  const canRent = !property.owned && !property.rented && credit >= Number(property.rentFee || 0);

  return (
    <article className={`srpg-town-tile srpg-town-tile--${property.facility} ${propertyTone(property)}${selected ? ' is-selected' : ''}`}>
      <button type="button" className="srpg-town-tile__main" onClick={() => setPropertyId(property.id)}>
        <span className="srpg-town-tile__icon" aria-hidden="true">{property.icon || property.facilityLabel?.slice(0, 1) || '시'}</span>
        <span className="srpg-town-tile__body">
          <span>{property.facilityLabel || property.facility}</span>
          <strong>{property.name}</strong>
          <small>{property.effectLabel || property.desc}</small>
        </span>
        <em>{propertyStatusLabel(property)}</em>
      </button>
      <div className="srpg-town-tile__stats">
        <span>구매 {property.buyPrice}Cr</span>
        <span>임차 {property.rentFee}Cr</span>
        <span>일일 {property.rentCostPerDay}Cr</span>
      </div>
      <div className="srpg-town-tile__actions">
        {!property.owned && !property.rented ? (
          <>
            <button type="button" disabled={!canBuy} onClick={() => setState((current) => buyPropertyAction(current, property.id))}>구매</button>
            <button type="button" disabled={!canRent} onClick={() => setState((current) => rentPropertyAction(current, property.id))}>3일 임차</button>
          </>
        ) : null}
        {property.rented ? (
          <button type="button" onClick={() => setState((current) => cancelRentPropertyAction(current, property.id))}>임차 종료</button>
        ) : null}
        {property.owned ? (
          <button type="button" onClick={() => setState((current) => toggleLeasePropertyAction(current, property.id))}>
            {property.leased ? '임대 종료' : '임대 시작'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function BaSrpgTownTab(props) {
  const {
    edictId,
    edicts,
    guildRank,
    properties,
    propertyId,
    selectedEdict,
    selectedProperty,
    setEdictId,
    setPropertyId,
    setState,
    state,
    town,
  } = props;
  const credit = Number(state.credit || 0);

  return (
    <>
      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>타운 허브</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <div className="games-rank-split games-rank-split--compact">
            <SmallStat label="휴식" value={`${town.restCost}Cr`} />
            <SmallStat label="상점" value={`${town.shopDiscountPct}%`} />
            <SmallStat label="길드" value={guildRank.rank} />
            <SmallStat label="다음" value={guildRank.nextRep == null ? '최대' : `${guildRank.remaining}Rep`} />
            <SmallStat label="보유" value={town.ownedProperties} />
            <SmallStat label="활성" value={town.activeProperties} />
            <SmallStat label="임차" value={town.rentedProperties} />
            <SmallStat label="임대" value={town.leasedProperties} />
          </div>
          <p className="srpg-town-note">
            거점 시설은 소유/임차 중일 때 효과가 적용됩니다. 소유 시설을 임대하면 일일 수익은 얻지만 해당 시설 효과는 꺼집니다.
          </p>
        </section>

        <section className="games-panel srpg-town-map-panel">
          <div className="games-panel-title">
            <h2>시설 지도</h2>
            <span>{credit.toLocaleString('ko-KR')} Cr</span>
          </div>
          <div className="srpg-town-district-grid">
            {DISTRICTS.map((district) => {
              const districtProperties = properties.filter((property) => property.district === district.id);
              return (
                <section className="srpg-town-district" key={district.id}>
                  <div className="srpg-town-district__title">
                    <strong>{district.title}</strong>
                    <span>{district.desc}</span>
                  </div>
                  <div className="srpg-town-tile-grid">
                    {districtProperties.map((property) => (
                      <PropertyTile
                        credit={credit}
                        key={property.id}
                        property={property}
                        propertyId={propertyId}
                        setPropertyId={setPropertyId}
                        setState={setState}
                      />
                    ))}
                    {district.id === 'plaza' ? (
                      <article className={`srpg-town-tile srpg-town-tile--edict ${selectedEdict.active ? 'is-active' : ''}`}>
                        <button type="button" className="srpg-town-tile__main" onClick={() => setEdictId(selectedEdict.id)}>
                          <span className="srpg-town-tile__icon" aria-hidden="true">칙</span>
                          <span className="srpg-town-tile__body">
                            <span>월간 칙령</span>
                            <strong>{selectedEdict.name}</strong>
                            <small>{selectedEdict.desc}</small>
                          </span>
                          <em>{selectedEdict.active ? '발효 중' : selectedEdict.available ? '발령 가능' : '마감'}</em>
                        </button>
                        <div className="srpg-town-tile__actions">
                          <button type="button" disabled={!selectedEdict.available} onClick={() => setState((current) => enactEdictAction(current, edictId))}>
                            칙령 발령
                          </button>
                        </div>
                      </article>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>부동산 상세</h2>
            <span>{selectedProperty.status}</span>
          </div>
          <label className="game-save-json-field">
            <span>시설</span>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
              {properties.map((property) => (
                <option value={property.id} key={property.id}>{property.name} · {property.status}</option>
              ))}
            </select>
          </label>
          <p className="srpg-town-note">{selectedProperty.desc}</p>
          <div className="games-rank-split games-rank-split--compact">
            <SmallStat label="구매" value={`${selectedProperty.buyPrice}Cr`} />
            <SmallStat label="임차" value={`${selectedProperty.rentFee}Cr`} />
            <SmallStat label="유지" value={`${selectedProperty.rentCostPerDay}Cr`} />
            <SmallStat label="수익" value={`${selectedProperty.leaseIncomePerDay}Cr`} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={selectedProperty.owned} onClick={() => setState((current) => buyPropertyAction(current, propertyId))}>구매</ActionButton>
            <ActionButton disabled={selectedProperty.owned || Boolean(selectedProperty.rented)} onClick={() => setState((current) => rentPropertyAction(current, propertyId))}>3일 임차</ActionButton>
            <ActionButton disabled={!selectedProperty.rented} onClick={() => setState((current) => cancelRentPropertyAction(current, propertyId))}>임차 종료</ActionButton>
            <ActionButton disabled={!selectedProperty.owned} onClick={() => setState((current) => toggleLeasePropertyAction(current, propertyId))}>
              {selectedProperty.leased ? '임대 종료' : '임대 시작'}
            </ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>칙령 상세</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <label className="game-save-json-field">
            <span>월간 칙령</span>
            <select value={edictId} onChange={(event) => setEdictId(event.target.value)}>
              {edicts.map((edict) => <option value={edict.id} key={edict.id}>{edict.name}</option>)}
            </select>
          </label>
          <p className="srpg-town-note">{selectedEdict.desc}</p>
          <div className="games-rank-split games-rank-split--compact">
            <SmallStat label="상태" value={selectedEdict.active ? '발효 중' : selectedEdict.available ? '발령 가능' : '이번 달 마감'} />
            <SmallStat label="주기" value="월간" />
          </div>
          <ActionButton disabled={!selectedEdict.available} onClick={() => setState((current) => enactEdictAction(current, edictId))}>
            칙령 발령
          </ActionButton>
        </section>
      </section>
    </>
  );
}
