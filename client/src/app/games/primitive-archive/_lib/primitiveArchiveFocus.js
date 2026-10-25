export function primitiveArchiveFocusPlan({
  state, nightRows = [], research = {}, campActions = [], archiveVictory = {},
  recruitCandidates = [], partyCap = 0, supplies = null, ready, busy,
} = {}) {
  const rows = nightRows.filter((row) => Number(row.currentHp) > 0).map((row) => ({ ...row }));
  const risky = rows.filter((row) => Number(row.damage) > 0);
  const night = {
    title: risky.length ? `${risky.length}명에게 밤 피해 예상` : '현재 상태로는 밤 피해 예상 없음',
    detail: '남은 행동력을 모두 쓰면 밤 정산 뒤 다음 날이 됩니다. 아래 예측은 현재 상태 기준입니다.',
    tone: risky.some((row) => Number(row.hp) <= 0) ? 'danger' : risky.length ? 'warning' : 'ready',
    rows,
  };
  if (!ready || busy) {
    return {
      blocked: true,
      objective: {
        title: !ready ? '진행 기록 확인 중' : '저장 작업 진행 중',
        detail: !ready ? '기존 진행을 확인한 뒤 행동할 수 있습니다.' : '진행을 보호하기 위해 작업이 끝날 때까지 기다려 주세요.',
        targetTab: '', actionLabel: '',
      },
      night: { title: '밤 예측 준비 중', detail: '현재 진행 확인이 끝난 뒤 표시합니다.', tone: 'neutral', rows: [] },
    };
  }
  const living = (state?.party || []).filter((member) => Number(member.hp) > 0);
  if (state?.ended || !living.length) {
    return {
      blocked: false,
      objective: {
        title: state?.victory ? '기초 아카이브 완주' : '이 경기는 종료되었습니다',
        detail: '종료된 경기에서는 행동할 수 없습니다. 경기 관리에서 결과 기록과 다음 경기를 확인할 수 있습니다.',
        targetTab: 'run', actionLabel: '경기 관리 열기',
      },
      night: { title: '밤 정산 종료', detail: '이 경기의 추가 밤 예측은 표시하지 않습니다.', tone: 'neutral', rows: [] },
    };
  }

  let objective;
  const fatal = risky.find((row) => Number(row.hp) <= 0);
  const hungry = living.find((member) => Number(member.hunger) >= 65);
  const weak = living.find((member) => Number(member.hp) <= 35);
  if (fatal) {
    const hungerRisk = Number(fatal.hungerDamage) > 0;
    objective = {
      title: `${fatal.name}의 밤 생존부터 확보`,
      detail: `지금 밤을 보내면 HP ${fatal.currentHp} → ${fatal.hp} 예상입니다. ${hungerRisk ? '식량과 식사 가능 여부' : '캠프 보온과 연료'}를 먼저 확인하세요.`,
      targetTab: hungerRisk ? 'actions' : 'camp', actionLabel: hungerRisk ? '기본 행동 보기' : '캠프 열기',
    };
  } else if (hungry) {
    objective = {
      title: `${hungry.name}의 허기 확인`,
      detail: `허기 ${hungry.hunger}입니다. 식량이 있으면 식사, 부족하면 채집·사냥의 효과와 위험을 비교하세요.`,
      targetTab: 'actions', actionLabel: '기본 행동 보기',
    };
  } else if (weak) {
    objective = {
      title: `${weak.name}의 상태부터 확인`,
      detail: `HP ${weak.hp}입니다. 파티에서 원인을 확인하고 위험한 행동 전 회복 수단을 검토하세요.`,
      targetTab: 'party', actionLabel: '파티 상태 열기',
    };
  } else if (risky.length) {
    const cold = risky.some((row) => Number(row.coldDamage) + Number(row.hypothermiaDamage) > 0);
    objective = {
      title: cold ? '이번 밤의 추위에 대비' : '이번 밤의 허기에 대비',
      detail: cold ? '아래 대원별 예상 피해를 보고 모닥불·연료·대피소의 부족한 준비를 확인하세요.' : '아래 예상 피해를 보고 식량과 식사 대상을 확인하세요.',
      targetTab: cold ? 'camp' : 'actions', actionLabel: cold ? '캠프 열기' : '기본 행동 보기',
    };
  } else if (living.length < 3 && (state?.party || []).some((member) => Number(member.hp || 0) <= 0)) {
    const deathNotice = '사망한 대원은 이 런에서 되살아나지 않습니다.';
    if (recruitCandidates.some((candidate) => candidate?.canRecruit)) {
      objective = {
        title: `기초 완주에 생존 대원 ${living.length}/3명 필요`,
        detail: `${deathNotice} 합류 가능한 후보를 선택해 생존 파티를 보충하세요.`,
        targetTab: 'party', actionLabel: '합류할 대원 선택',
      };
    } else if (recruitCandidates.length > 0 && (state?.party || []).length >= partyCap) {
      objective = {
        title: `기초 완주에 생존 대원 ${living.length}/3명 필요`,
        detail: `${deathNotice} 현재 파티 정원 ${partyCap}명이 가득 찼습니다. 정원을 늘릴 발전을 먼저 확인하세요.`,
        targetTab: 'growth', actionLabel: '파티 정원 발전 확인',
      };
    } else if (recruitCandidates.length > 0) {
      objective = {
        title: `기초 완주에 생존 대원 ${living.length}/3명 필요`,
        detail: `${deathNotice} 현재 합류할 수 있는 후보가 없습니다. 발전 화면에서 정원과 합류 조건을 확인하세요.`,
        targetTab: 'growth', actionLabel: '합류 조건 확인',
      };
    } else {
      objective = {
        title: `기초 완주에 생존 대원 ${living.length}/3명 필요`,
        detail: `${deathNotice} 합류 가능한 후보가 남아 있지 않습니다. 현재 런을 정산하거나 새 런을 시작할 수 있습니다.`,
        targetTab: 'run', actionLabel: '런 관리 열기',
      };
    }
  } else if (archiveVictory.canComplete) {
    objective = {
      title: '기초 완주 목표 달성',
      detail: '경기를 완성·종료할지, 종료하지 않고 문명 발전을 이어갈지 선택할 수 있습니다.',
      targetTab: 'run', actionLabel: '완주 선택 확인',
    };
  } else if (Number(supplies?.foodShortage || 0) > 0 || Number(supplies?.rationShortage || 0) > 0 || supplies?.fuelShortage) {
    const foodShortage = Number(supplies?.foodShortage || 0) > 0 || Number(supplies?.rationShortage || 0) > 0;
    const fuelShortage = Boolean(supplies?.fuelShortage);
    const foodDetail = [Number(supplies.rationShortage || 0) > 0 ? `부족 배식 ${supplies.rationShortage}단위` : '',
      Number(supplies.foodShortage || 0) > 0 ? `대원 저녁 영양 ${supplies.foodShortage}` : ''].filter(Boolean).join(' · ');
    objective = {
      title: foodShortage && fuelShortage
        ? '다음 정산 전 식량·땔감 비축'
        : foodShortage ? '다음 정산 전 저녁 식량 비축' : '다음 정산 전 땔감 비축',
      detail: foodShortage && fuelShortage
        ? `${foodDetail} 부족과 모닥불용 땔감 부족이 예상됩니다. 안전 채집으로 확보하세요.`
        : foodShortage ? `${foodDetail} 부족이 예상됩니다. 안전하게 베리를 줍고 파티 상태를 다시 확인하세요.`
          : '모닥불 연료가 부족합니다. 안전하게 땔감을 줍거나 캠프의 연료 준비를 확인하세요.',
      targetTab: 'actions',
      actionLabel: '안전 채집 열기',
    };
  } else {
    const missingGate = research.gateRows?.find((gate) => !gate.done);
    const camp = campActions.find((row) => row.levelKey === missingGate?.key);
    if (missingGate) {
      objective = {
        title: `${missingGate.label} 준비`,
        detail: `${camp?.materialText || research.reason || '캠프 준비 조건을 확인하세요.'} · 이 준비를 마치면 연구 개방에 한 걸음 가까워집니다.`,
        targetTab: camp?.enabled ? 'camp' : 'actions',
        actionLabel: camp?.enabled ? '캠프 열기' : '기본 행동 보기',
      };
    } else {
      objective = {
        title: research.selected?.name ? `다음 발전: ${research.selected.name}` : '다음 발전 목표 선택',
        detail: research.unlocked
          ? `${research.actionUnlocked ? '연구 목표와 남은 조건을 확인하세요.' : research.actionReason || '기초 연구 조건을 확인하세요.'} 선택한 연구는 행동과 하루 시작에도 진행됩니다.`
          : research.reason || '발전 화면에서 다음 준비와 해금 조건을 확인하세요.',
        targetTab: 'growth', actionLabel: '발전 목표 열기',
      };
    }
  }
  return { objective, night, supplies, blocked: false };
}
