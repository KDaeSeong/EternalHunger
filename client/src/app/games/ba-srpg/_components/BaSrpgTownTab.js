import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  buyPropertyAction,
  cancelRentPropertyAction,
  enactEdictAction,
  rentPropertyAction,
  toggleLeasePropertyAction,
} from '../_lib/baSrpgEngine';

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
    town,
  } = props;

  return (
    <>
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>타운 허브</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="휴식 비용" value={`${town.restCost} Cr`} />
            <SmallStat label="상점 할인" value={`${town.shopDiscountPct}%`} />
            <SmallStat label="길드 랭크" value={guildRank.rank} />
            <SmallStat label="다음 랭크" value={guildRank.nextRep == null ? '최대' : `${guildRank.remaining} Rep`} />
          </div>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            보유 {town.ownedProperties} · 활성 {town.activeProperties} · 임차 {town.rentedProperties} · 임대 {town.leasedProperties}
          </p>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>부동산</h2>
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
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedProperty.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="구매" value={`${selectedProperty.buyPrice} Cr`} />
            <SmallStat label="임차" value={`${selectedProperty.rentFee} Cr`} />
            <SmallStat label="유지비" value={`${selectedProperty.rentCostPerDay} Cr`} />
            <SmallStat label="임대수익" value={`${selectedProperty.leaseIncomePerDay} Cr`} />
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
            <h2>칙령</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <label className="game-save-json-field">
            <span>월간 칙령</span>
            <select value={edictId} onChange={(event) => setEdictId(event.target.value)}>
              {edicts.map((edict) => <option value={edict.id} key={edict.id}>{edict.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedEdict.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="상태" value={selectedEdict.active ? '발효 중' : selectedEdict.available ? '발령 가능' : '이번 달 마감'} />
            <SmallStat label="주기" value="월간" />
          </div>
          <ActionButton disabled={!selectedEdict.available} onClick={() => setState((current) => enactEdictAction(current, edictId))}>
            칙령 발령
          </ActionButton>
        </section>
      </section>
              </>
    </>
  );
}
