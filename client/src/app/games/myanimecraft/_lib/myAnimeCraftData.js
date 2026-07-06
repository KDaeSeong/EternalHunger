export const GAME_SLUG = 'myanimecraft';
export const QUICK_SAVE_SLOT = 'myanimecraft-main';
export const SAVE_VERSION = 'myanimecraft-v1';

export const RACE_LABELS = {
  T: '테란',
  Z: '저그',
  P: '프로토스',
};

export const MAPS = [
  { id: 'map-1', name: '폴리포이드', tags: ['macro', 'large'], matchupBalance: { TvZ: 0.015, TvP: -0.005, ZvP: 0.01 } },
  { id: 'map-2', name: '파이썬', tags: ['balanced'], matchupBalance: { TvZ: 0.005, TvP: 0.005, ZvP: 0 } },
  { id: 'map-3', name: '서킷브레이커', tags: ['macro', 'large'], matchupBalance: { TvZ: 0.02, TvP: -0.01, ZvP: 0.015 } },
  { id: 'map-4', name: '네오 실피드', tags: ['rush', 'small'], matchupBalance: { TvZ: -0.015, TvP: 0.02, ZvP: -0.005 } },
  { id: 'map-5', name: '블루스톰', tags: ['rush', 'small'], matchupBalance: { TvZ: -0.01, TvP: 0.015, ZvP: -0.015 } },
  { id: 'map-6', name: '라만차', tags: ['harass', 'balanced'], matchupBalance: { TvZ: 0, TvP: -0.015, ZvP: 0.02 } },
  { id: 'map-7', name: '태양의 제국', tags: ['macro', 'large'], matchupBalance: { TvZ: 0.015, TvP: 0, ZvP: 0.005 } },
  { id: 'map-8', name: '그라운드 제로', tags: ['tech', 'balanced'], matchupBalance: { TvZ: -0.005, TvP: 0.01, ZvP: -0.005 } },
];

export const BUILD_STYLE_LABELS = {
  rush: '러시',
  macro: '운영',
  tech: '테크',
  harass: '견제',
  balanced: '밸런스',
};

export const BUILD_STYLE_KEYS = Object.keys(BUILD_STYLE_LABELS);

export const BUILD_DEFS = [
  buildDef('T', 'TvZ', '2배럭 압박', 'rush', ['rush']),
  buildDef('T', 'TvZ', '8배럭 벙커링', 'rush', ['rush', 'small']),
  buildDef('T', 'TvZ', '1배럭 더블', 'macro', ['macro', 'large']),
  buildDef('T', 'TvZ', '5배럭 타이밍', 'rush', ['rush', 'balanced']),
  buildDef('T', 'TvZ', '바이오닉 견제', 'harass', ['small', 'harass']),
  buildDef('T', 'TvZ', '드랍십 흔들기', 'harass', ['harass', 'large']),
  buildDef('T', 'TvZ', '메카닉 운영', 'tech', ['large', 'macro']),
  buildDef('T', 'TvZ', '발키리 전환', 'tech', ['tech', 'balanced']),
  buildDef('T', 'TvZ', 'SK테란 전환', 'balanced', ['balanced', 'macro']),
  buildDef('T', 'TvZ', '레이트 메카닉', 'tech', ['tech', 'large']),
  buildDef('T', 'TvZ', '3배럭 아카데미', 'rush', ['rush', 'balanced']),
  buildDef('T', 'TvZ', '선엔베 업바이오닉', 'macro', ['macro', 'large']),
  buildDef('T', 'TvZ', '투스타 레이스 견제', 'harass', ['harass', 'tech']),
  buildDef('T', 'TvZ', '빠른 사이언스 베슬', 'tech', ['tech', 'large']),
  buildDef('T', 'TvP', '2배럭 찌르기', 'rush', ['rush', 'small']),
  buildDef('T', 'TvP', '원팩 원스타', 'tech', ['tech', 'small']),
  buildDef('T', 'TvP', '팩토리 조이기', 'rush', ['rush', 'balanced']),
  buildDef('T', 'TvP', '바이오닉-탱크 운영', 'balanced', ['macro', 'balanced']),
  buildDef('T', 'TvP', '업테란 운영', 'macro', ['macro', 'large']),
  buildDef('T', 'TvP', '트리플 커맨드', 'macro', ['macro', 'large']),
  buildDef('T', 'TvP', '메카닉 전환', 'tech', ['large', 'tech']),
  buildDef('T', 'TvP', '드랍십 벌처 견제', 'harass', ['harass', 'small']),
  buildDef('T', 'TvP', 'FD 테란', 'balanced', ['balanced', 'small']),
  buildDef('T', 'TvP', '벌처 마인 압박', 'harass', ['harass', 'balanced']),
  buildDef('T', 'TvP', '투팩 타이밍', 'rush', ['rush', 'balanced']),
  buildDef('T', 'TvP', '빠른 아머리 업그레이드', 'macro', ['macro', 'large']),
  buildDef('T', 'TvT', '1팩 더블', 'macro', ['macro', 'large']),
  buildDef('T', 'TvT', '벌처 레이스', 'tech', ['tech', 'small']),
  buildDef('T', 'TvT', '2팩 압박', 'rush', ['rush']),
  buildDef('T', 'TvT', '드랍십 탱크 흔들기', 'harass', ['harass', 'large']),
  buildDef('T', 'TvT', '메카닉 운영', 'tech', ['large', 'tech']),
  buildDef('T', 'TvT', '빠른 스타포트', 'harass', ['harass', 'small']),
  buildDef('T', 'TvT', '원팩 원스타', 'tech', ['tech', 'small']),
  buildDef('T', 'TvT', '투스타 레이스', 'tech', ['tech', 'balanced']),
  buildDef('T', 'TvT', '빠른 더블 후 탱크라인', 'macro', ['macro', 'large']),
  buildDef('T', 'TvT', '레이스 견제 후 벌처 전환', 'harass', ['harass', 'tech']),
  buildDef('Z', 'TvZ', '3해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'TvZ', '빠른 3가스 뮤탈', 'tech', ['tech', 'large']),
  buildDef('Z', 'TvZ', '2해처리 러커', 'tech', ['tech', 'balanced']),
  buildDef('Z', 'TvZ', '저글링 러시', 'rush', ['rush', 'small']),
  buildDef('Z', 'TvZ', '뮤탈 견제', 'harass', ['harass', 'small']),
  buildDef('Z', 'TvZ', '러커 조이기', 'rush', ['rush', 'balanced']),
  buildDef('Z', 'TvZ', '하이브 운영', 'macro', ['macro', 'large']),
  buildDef('Z', 'TvZ', '울트라 전환', 'macro', ['macro', 'large']),
  buildDef('Z', 'TvZ', '12앞 3해처리', 'macro', ['macro', 'large']),
  buildDef('Z', 'TvZ', '9드론 발업', 'rush', ['rush', 'small']),
  buildDef('Z', 'TvZ', '5해처리 히드라', 'macro', ['macro', 'balanced']),
  buildDef('Z', 'TvZ', '빠른 디파일러', 'tech', ['tech', 'large']),
  buildDef('Z', 'ZvP', '3해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'ZvP', '히드라 타이밍', 'rush', ['rush', 'balanced']),
  buildDef('Z', 'ZvP', '저글링 올인', 'rush', ['rush']),
  buildDef('Z', 'ZvP', '뮤탈 흔들기', 'harass', ['harass', 'small']),
  buildDef('Z', 'ZvP', '히드라 운영', 'macro', ['macro']),
  buildDef('Z', 'ZvP', '디파일러 장기전', 'tech', ['tech', 'large']),
  buildDef('Z', 'ZvP', '스파이어 페이크', 'harass', ['harass', 'small']),
  buildDef('Z', 'ZvP', '선가스 러커 드랍', 'harass', ['harass', 'tech']),
  buildDef('Z', 'ZvP', '973 히드라 타이밍', 'rush', ['rush', 'balanced']),
  buildDef('Z', 'ZvP', '5해처리 히드라', 'macro', ['macro', 'large']),
  buildDef('Z', 'ZvP', '빠른 하이브 전환', 'tech', ['tech', 'large']),
  buildDef('Z', 'ZvZ', '9드론 저글링', 'rush', ['rush', 'small']),
  buildDef('Z', 'ZvZ', '12앞마당 운영', 'macro', ['macro']),
  buildDef('Z', 'ZvZ', '2해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'ZvZ', '저글링 난전', 'harass', ['harass', 'small']),
  buildDef('Z', 'ZvZ', '3해처리 운영', 'macro', ['macro']),
  buildDef('Z', 'ZvZ', '원해처리 뮤탈', 'tech', ['tech', 'small']),
  buildDef('Z', 'ZvZ', '9발업 운영', 'rush', ['rush', 'small']),
  buildDef('Z', 'ZvZ', '선스파이어', 'tech', ['tech', 'balanced']),
  buildDef('Z', 'ZvZ', '2해처리 스커지 운영', 'harass', ['harass', 'tech']),
  buildDef('Z', 'ZvZ', '앞마당 페이크 저글링', 'harass', ['harass', 'small']),
  buildDef('P', 'TvP', '더블넥서스', 'macro', ['macro', 'large']),
  buildDef('P', 'TvP', '원게이트 더블', 'macro', ['macro', 'balanced']),
  buildDef('P', 'TvP', '옵드라 압박', 'balanced', ['balanced', 'macro']),
  buildDef('P', 'TvP', '질럿 러시', 'rush', ['rush', 'small']),
  buildDef('P', 'TvP', '다크템플러 찌르기', 'tech', ['tech', 'small']),
  buildDef('P', 'TvP', '리버 셔틀', 'harass', ['small', 'harass']),
  buildDef('P', 'TvP', '아비터 리콜', 'tech', ['tech', 'large']),
  buildDef('P', 'TvP', '캐리어 전환', 'tech', ['tech', 'large']),
  buildDef('P', 'TvP', '2게이트 옵저버', 'balanced', ['balanced', 'small']),
  buildDef('P', 'TvP', '빠른 트리플 넥서스', 'macro', ['macro', 'large']),
  buildDef('P', 'TvP', '리버 캐리어 전환', 'tech', ['tech', 'large']),
  buildDef('P', 'TvP', '다크 더블', 'tech', ['tech', 'balanced']),
  buildDef('P', 'ZvP', '질럿-드라군 압박', 'rush', ['rush']),
  buildDef('P', 'ZvP', '커세어 리버', 'harass', ['harass', 'small']),
  buildDef('P', 'ZvP', '커세어 다크', 'tech', ['tech', 'small']),
  buildDef('P', 'ZvP', '캐리어 운영', 'macro', ['macro', 'large']),
  buildDef('P', 'ZvP', '셔틀 테크', 'tech', ['large', 'tech']),
  buildDef('P', 'ZvP', '템플러 한방', 'tech', ['tech', 'balanced']),
  buildDef('P', 'ZvP', '더블넥 운영', 'macro', ['macro', 'large']),
  buildDef('P', 'ZvP', '선포지 더블', 'macro', ['macro', 'large']),
  buildDef('P', 'ZvP', '커세어 질럿 압박', 'rush', ['rush', 'harass']),
  buildDef('P', 'ZvP', '2스타 커세어', 'harass', ['harass', 'tech']),
  buildDef('P', 'ZvP', '빠른 아칸 전환', 'tech', ['tech', 'balanced']),
  buildDef('P', 'PvP', '2게이트 압박', 'rush', ['rush', 'small']),
  buildDef('P', 'PvP', '리버 견제', 'harass', ['harass', 'small']),
  buildDef('P', 'PvP', '아비터 테크', 'tech', ['large', 'tech']),
  buildDef('P', 'PvP', '다크템플러 테크', 'tech', ['tech', 'small']),
  buildDef('P', 'PvP', '더블 운영', 'macro', ['macro']),
  buildDef('P', 'PvP', '질럿 드라군 압박', 'balanced', ['balanced']),
  buildDef('P', 'PvP', '앞마당 리버 운영', 'macro', ['macro', 'large']),
  buildDef('P', 'PvP', '1게이트 코어', 'balanced', ['balanced', 'small']),
  buildDef('P', 'PvP', '3게이트 드라군', 'rush', ['rush', 'balanced']),
  buildDef('P', 'PvP', '리버 맞불', 'harass', ['harass', 'small']),
  buildDef('P', 'PvP', '다크 이후 앞마당', 'tech', ['tech', 'macro']),
];

export const CAREER_STAT_KEYS = ['attack', 'defense', 'strategy', 'sense', 'macro', 'scout', 'control', 'harass'];

export const FREE_AGENT_NAMES = [
  ['Nova', 'Rush'],
  ['Mika', 'Orbit'],
  ['Seri', 'Vector'],
  ['Kanna', 'Forge'],
  ['Rin', 'Anchor'],
  ['Haru', 'Signal'],
  ['Yuzu', 'Prime'],
  ['Aki', 'Tempo'],
];

export const ECON_TAG_LABELS = {
  MATCH_REWARD: '경기 상금',
  PAYROLL: '연봉',
  SHOP: '상점 구매',
  SPONSOR: '스폰서',
  TRAINING: '훈련',
  FA: 'FA 영입',
  TRADE: '트레이드',
  PERSONAL: '개인리그',
  WINNERS: '위너스리그',
  BONUS: '보너스',
};

export const EQUIPMENT_SLOT_LABELS = {
  keyboard: '키보드',
  mouse: '마우스',
  monitor: '모니터',
  gear: '기어',
};

export const ITEM_DEFS = [
  {
    id: 'it-kb-1',
    name: '게이밍 키보드(기본)',
    kind: 'keyboard',
    price: 120,
    effects: { statsDelta: { control: 18, harass: 10 } },
  },
  {
    id: 'it-ms-1',
    name: '게이밍 마우스(기본)',
    kind: 'mouse',
    price: 140,
    effects: { statsDelta: { control: 15, scout: 8 } },
  },
  {
    id: 'it-mn-1',
    name: '144Hz 모니터(기본)',
    kind: 'monitor',
    price: 220,
    effects: { statsDelta: { sense: 12, control: 10 } },
  },
  {
    id: 'it-gear-1',
    name: '팀 분석 노트',
    kind: 'gear',
    price: 160,
    effects: { statsDelta: { strategy: 14, scout: 10 } },
  },
  {
    id: 'it-kb-2',
    name: '프로 키보드',
    kind: 'keyboard',
    price: 320,
    effects: { statsDelta: { control: 32, harass: 18, attack: 8 } },
  },
  {
    id: 'it-ms-2',
    name: '프로 마우스',
    kind: 'mouse',
    price: 340,
    effects: { statsDelta: { control: 28, scout: 20, sense: 8 } },
  },
  {
    id: 'it-mn-2',
    name: '240Hz 모니터',
    kind: 'monitor',
    price: 460,
    effects: { statsDelta: { sense: 24, control: 18, defense: 8 } },
  },
  {
    id: 'it-gear-2',
    name: '빌드 연구 파일',
    kind: 'gear',
    price: 380,
    effects: { statsDelta: { strategy: 30, macro: 16, scout: 12 } },
  },
  {
    id: 'it-cons-1',
    name: '에너지 드링크',
    kind: 'consumable',
    price: 25,
    effects: { conditionDelta: 8 },
  },
  {
    id: 'it-cons-2',
    name: '멘탈 케어',
    kind: 'consumable',
    price: 40,
    effects: { conditionDelta: 12, fameDelta: 5 },
  },
  {
    id: 'it-cheer-1',
    name: '치어풀',
    kind: 'consumable',
    price: 0,
    effects: { conditionDelta: 6, fameDelta: 4 },
  },
];

export const TEAM_ACTION_DEFS = [
  {
    id: 'SPECIAL_TRAINING',
    label: '특훈',
    desc: '선수 스탯이 소폭 상승하지만 컨디션을 소모합니다.',
    cost: 100,
    conditionDelta: -8,
    fameDelta: 0,
    moneyDelta: 0,
    statDelta: 2,
    rewardItemId: '',
  },
  {
    id: 'REST',
    label: '휴식',
    desc: '컨디션을 회복합니다.',
    cost: 50,
    conditionDelta: 12,
    fameDelta: 0,
    moneyDelta: 0,
    statDelta: 0,
    rewardItemId: '',
  },
  {
    id: 'FANMEETING',
    label: '팬미팅',
    desc: '명성과 팬 기반을 올리고 치어풀을 1개 받습니다.',
    cost: 200,
    conditionDelta: -4,
    fameDelta: 8,
    moneyDelta: 120,
    statDelta: 0,
    rewardItemId: 'it-cheer-1',
  },
];

export const PERSONAL_ROUND_LABELS = {
  1: '16강',
  2: '8강',
  3: '4강',
  4: '결승',
};

export const PERSONAL_PHASE_LABELS = {
  PC_BANG: 'PC방 예선',
  DUAL_TOURNAMENT: '듀얼 토너먼트',
  RO32: '32강 듀얼',
  RO16: '16강',
  DONE: '완료',
};

export const POSTSEASON_LABELS = {
  1: '준플레이오프',
  2: '플레이오프',
  3: '결승',
};

export const POSTSEASON_PRIZES = [900, 550, 320, 180];

export const TEAM_BLUEPRINTS = [
  {
    id: 'team-home',
    name: '블루 스타즈',
    coach: '우시오 노아',
    coachStyle: 'balanced',
    money: 1000,
    roster: [
      player('h1', '시로코', 'T', 7, 78, 525, 545, 525, 535, 520, 550, 505, 555, 525),
      player('h2', '히나', 'Z', 7, 78, 520, 540, 520, 530, 515, 545, 500, 550, 520),
      player('h3', '노아', 'P', 6, 78, 510, 530, 510, 520, 505, 535, 490, 540, 510),
      player('h4', '유세이', 'T', 6, 78, 500, 520, 500, 510, 495, 525, 480, 530, 500),
      ...generatedRoster('home-sub', '블루', 4, 501),
    ],
  },
  {
    id: 'team-away',
    name: '레드 윙즈',
    coach: '잭 아틀라스',
    coachStyle: 'aggressive',
    money: 1000,
    roster: [
      player('a1', '잭', 'T', 7, 78, 515, 535, 515, 525, 510, 540, 495, 545, 515),
      player('a2', '아템', 'P', 7, 78, 518, 538, 518, 528, 513, 543, 498, 548, 518),
      player('a3', '우미', 'Z', 6, 78, 505, 525, 505, 515, 500, 530, 485, 535, 505),
      player('a4', '파이', 'P', 6, 78, 500, 520, 500, 510, 495, 525, 480, 530, 500),
      ...generatedRoster('away-sub', '레드', 4, 500),
    ],
  },
  team('t_4c143973', '옐로우 썬더즈', '유우키 쥬다이', 'balanced', '옐로우', 500),
  team('t_bd833b22', '그린 리프', '이자요이 노노미', 'balanced', '그린', 499),
  team('t_1a79937d', '오렌지 머슬', '쿠다 이즈나', 'balanced', '오렌지', 498),
  team('t_43b08c60', '퍼플 퍼퓸', '시틀라리', 'balanced', '퍼플', 497),
  team('t_0321d176', '다크 블루 갤럭시', '은하', 'balanced', '갤럭시', 496),
  team('t_75dddcf8', '화이트 스파키즈', '푸리나', 'balanced', '화이트', 495),
  team('t_fb447514', '블랙 타이달', '조마에 사오리', 'balanced', '블랙', 494),
  team('t_881e5490', '레인보우 리플렉터', '세미', 'balanced', '레인보우', 493),
];

function player(id, name, race, level, condition, fame, attack, defense, strategy, sense, macro, scout, control, harass) {
  return {
    id,
    name,
    race,
    level,
    condition,
    fame,
    stats: { attack, defense, strategy, sense, macro, scout, control, harass },
  };
}

function team(id, name, coach, coachStyle, prefix, base) {
  return {
    id,
    name,
    coach,
    coachStyle,
    money: 1000,
    roster: generatedRoster(id, prefix, 8, base),
  };
}

function generatedRoster(teamId, prefix, count, base) {
  const races = ['T', 'Z', 'P', 'T', 'Z', 'P', 'T', 'Z'];
  return Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    const step = Math.max(0, 4 - index);
    const rating = base + step * 5;
    return player(
      `${teamId}-${slot}`,
      `${prefix} Player ${slot}`,
      races[index % races.length],
      Math.max(0, 4 - Math.floor(index / 2)),
      100,
      Math.max(0, (4 - Math.floor(index / 2)) * 45),
      rating + 12,
      rating,
      rating + 8,
      rating + 4,
      rating + 13,
      rating - 8,
      rating + 14,
      rating + 1,
    );
  });
}

function buildDef(race, matchup, name, style, tags = []) {
  return { race, matchup, name, style, tags };
}
