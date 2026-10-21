export function primitiveArchiveCoachMessage({ state, nightRows = [], fallbackText = '' }) {
  if (state?.ended) return { urgent: false, title: '', text: fallbackText };

  const living = (state?.party || []).filter((member) => Number(member.hp || 0) > 0);
  const fatalNight = nightRows.find((row) => row.currentHp > 0 && row.hp <= 0);
  if (fatalNight) {
    return {
      urgent: true,
      title: '밤 생존 위험',
      text: `${fatalNight.name}: 현재 상태로 밤을 보내면 HP ${fatalNight.currentHp} → ${fatalNight.hp} 예상입니다. 마지막 AP 전에 식사·휴식·보온을 검토하세요. 파티 탭에서 피해 원인을 확인할 수 있습니다.`,
    };
  }

  const lowHp = living.find((member) => Number(member.hp) <= 35);
  if (lowHp) {
    return {
      urgent: true,
      title: '회복 먼저 검토',
      text: `${lowHp.name}의 HP가 ${lowHp.hp}입니다. 위험한 행동 전에 식량과 휴식 가능 여부를 확인하세요.`,
    };
  }

  const hungry = living.find((member) => Number(member.hunger || 0) >= 65);
  if (hungry) {
    return {
      urgent: true,
      title: '식량·식사 확인',
      text: `${hungry.name}의 허기가 ${hungry.hunger}입니다. 식량 보유량과 식사 행동을 확인하고, 파티 탭에서 밤 예상 피해를 살펴보세요.`,
    };
  }

  const nightDamage = nightRows.find((row) => row.currentHp > 0 && row.damage > 0);
  if (nightDamage) {
    return {
      urgent: true,
      title: '밤 피해 예상',
      text: `${nightDamage.name}: 현재 상태의 밤 예상 피해 ${nightDamage.damage} (추위 ${nightDamage.coldDamage}·허기 ${nightDamage.hungerDamage}·저체온 ${nightDamage.hypothermiaDamage})입니다. 식사·캠프·장비 중 부족한 대비를 살펴보세요.`,
    };
  }

  if (Number(state?.day || 0) >= 1 && Number(state.day) <= 3) {
    return {
      urgent: false,
      title: '첫 사흘의 선택',
      text: '식량·밤 대비·도구 준비 중 보유품과 상태에 맞춰 우선순위를 고르세요. 마지막 AP를 쓰면 밤 정산 뒤 다음 날로 넘어갑니다. 모닥불은 연료가 있어야 따뜻합니다.',
    };
  }

  return { urgent: false, title: '', text: fallbackText };
}
