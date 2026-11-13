const quantity = value => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('ko-KR') : '확인 필요';

export default function PrimitiveArchiveFoodOutlook({ outlook, ready = true, ended = false, annualMode = false }) {
  if (annualMode) return null;
  const current = outlook?.current;
  const party = outlook?.party;
  const care = outlook?.care;
  const morning = outlook?.morning;
  return <div className="primitive-food-outlook" role="group" aria-label="식량과 배식 전망">
    {!ready || !outlook ? <p className="primitive-food-outlook__notice">{ended
      ? '종료된 런에서는 저녁 관리와 다음 아침 정산이 실행되지 않습니다.'
      : '진행 기록을 확인한 뒤 식량과 배식 전망을 표시합니다.'}</p> : <>
      <dl className="primitive-food-outlook__rows">
        <div>
          <dt title={outlook.notes?.current}>현재 보유 식품·저녁 관리 전</dt>
          <dd>식품 {quantity(current?.foodCount)}개 · 공동 배식 재고 {quantity(current?.rationStock)}단위 / 현재 필요 {quantity(current?.rationNeed)}단위 · 현재 비축만으로 {quantity(current?.rationShortage)}단위 부족</dd>
        </div>
        {!ended ? <div>
          <dt title={outlook.notes?.party}>대원 저녁 식사 · 관리 전</dt>
          <dd>필요 {quantity(party?.need)}영양 / 공동 배식 몫을 제외한 비축 {quantity(party?.nutrition)}영양 · 부족 {quantity(party?.shortage)}영양</dd>
          <dd>{care?.unlocked === false ? '자동 저녁 관리 미해금 · 자동 배식·연료 보충 없음'
            : care?.active === true ? `자동 관리 배식 예정 ${quantity(care.peopleFed)}명 · 관리 뒤 밤 허기 60 초과 ${quantity(care.pendingMeals)}명`
              : '자동 저녁 관리 상태 확인 필요'}</dd>
        </div> : null}
        {!ended ? <div>
          <dt title={outlook.notes?.morning}>다음 아침 · 현재 배치 고정 전망</dt>
          <dd>{morning ? <>
            관리 후 재고 {quantity(morning.stock)} + 생산 {quantity(morning.produced)} = 배식 전 {quantity(morning.available)}단위<br />
            필요 {quantity(morning.need)} / 제공 {quantity(morning.provided)} / 부족 {quantity(morning.shortage)}단위 · 배식 후 비축 {quantity(morning.reserve)}단위
          </> : '다음 아침 배식 전망을 확인할 수 없습니다.'}</dd>
        </div> : null}
      </dl>
      {current?.foodItems?.length ? <details className="primitive-food-outlook__items">
        <summary>보유 식품 내역 · 개수</summary>
        <ul>{current.foodItems.map(item => <li key={item.id}>{item.name} {quantity(item.quantity)}개</li>)}</ul>
      </details> : null}
      <p className="primitive-food-outlook__notice">{ended
        ? '종료된 런의 현재 비축입니다. 저녁 관리와 다음 아침 정산은 실행되지 않습니다.'
        : '식품 개수·공동 배식 단위·대원 영양은 서로 다른 값입니다. 다음 아침 생산은 현재 밤에 쓸 수 없습니다. 아침 전망은 다음 개인 저녁 식사·사업 완성 보상·인구 변화를 포함하지 않습니다.'}</p>
    </>}
  </div>;
}
