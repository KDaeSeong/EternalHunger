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

const BUILD_DEFS = [
  buildDef('T', 'TvZ', '2배럭 압박', 'rush', ['rush']),
  buildDef('T', 'TvZ', '바이오닉 견제', 'harass', ['small', 'harass']),
  buildDef('T', 'TvZ', '메카닉 운영', 'tech', ['large', 'macro']),
  buildDef('T', 'TvP', '2배럭 찌르기', 'rush', ['rush', 'small']),
  buildDef('T', 'TvP', '바이오닉-탱크 운영', 'balanced', ['macro', 'balanced']),
  buildDef('T', 'TvP', '메카닉 전환', 'tech', ['large', 'tech']),
  buildDef('T', 'TvT', '1팩 더블', 'macro', ['macro', 'large']),
  buildDef('T', 'TvT', '2팩 압박', 'rush', ['rush']),
  buildDef('T', 'TvT', '메카닉 운영', 'tech', ['large', 'tech']),
  buildDef('Z', 'TvZ', '3해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'TvZ', '저글링 러시', 'rush', ['rush', 'small']),
  buildDef('Z', 'TvZ', '하이브 운영', 'macro', ['macro', 'large']),
  buildDef('Z', 'ZvP', '3해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'ZvP', '저글링 올인', 'rush', ['rush']),
  buildDef('Z', 'ZvP', '히드라 운영', 'macro', ['macro']),
  buildDef('Z', 'ZvZ', '9드론 저글링', 'rush', ['rush', 'small']),
  buildDef('Z', 'ZvZ', '2해처리 뮤탈', 'tech', ['large', 'tech']),
  buildDef('Z', 'ZvZ', '3해처리 운영', 'macro', ['macro']),
  buildDef('P', 'TvP', '더블넥서스', 'macro', ['macro', 'large']),
  buildDef('P', 'TvP', '질럿 러시', 'rush', ['rush', 'small']),
  buildDef('P', 'TvP', '리버 셔틀', 'harass', ['small', 'harass']),
  buildDef('P', 'ZvP', '질럿-드라군 압박', 'rush', ['rush']),
  buildDef('P', 'ZvP', '캐리어 운영', 'macro', ['macro', 'large']),
  buildDef('P', 'ZvP', '셔틀 테크', 'tech', ['large', 'tech']),
  buildDef('P', 'PvP', '2게이트 압박', 'rush', ['rush', 'small']),
  buildDef('P', 'PvP', '아비터 테크', 'tech', ['large', 'tech']),
  buildDef('P', 'PvP', '더블 운영', 'macro', ['macro']),
];

const CAREER_STAT_KEYS = ['attack', 'defense', 'strategy', 'sense', 'macro', 'scout', 'control', 'harass'];

const FREE_AGENT_NAMES = [
  ['Nova', 'Rush'],
  ['Mika', 'Orbit'],
  ['Seri', 'Vector'],
  ['Kanna', 'Forge'],
  ['Rin', 'Anchor'],
  ['Haru', 'Signal'],
  ['Yuzu', 'Prime'],
  ['Aki', 'Tempo'],
];

const ECON_TAG_LABELS = {
  MATCH_REWARD: '경기 상금',
  PAYROLL: '연봉',
  SHOP: '상점 구매',
  SPONSOR: '스폰서',
  TRAINING: '훈련',
  FA: 'FA 영입',
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
];

const TEAM_BLUEPRINTS = [
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

function cloneTeam(teamData) {
  return {
    ...teamData,
    money: Number(teamData.money || 0),
    career: normalizeTeamCareer(teamData),
    roster: teamData.roster.map((member) => ({
      ...member,
      salaryStep: Number(member.salaryStep || 0),
      stats: { ...member.stats },
    })),
  };
}

function itemById(itemId) {
  return ITEM_DEFS.find((item) => item.id === itemId) || null;
}

function equipmentSlotOfKind(kind) {
  if (kind === 'keyboard') return 'keyboard';
  if (kind === 'mouse') return 'mouse';
  if (kind === 'monitor') return 'monitor';
  if (kind === 'gear') return 'gear';
  return null;
}

function normalizeInventoryEntry(entry, teamId) {
  const items = Array.isArray(entry?.items)
    ? entry.items
      .filter((item) => item && itemById(item.itemId))
      .map((item) => ({
        itemId: item.itemId,
        qty: clamp(Math.floor(Number(item.qty || 0)), 0, 9999),
      }))
      .filter((item) => item.qty > 0)
    : [];
  const equipped = entry?.equipped && typeof entry.equipped === 'object' ? entry.equipped : {};
  return {
    teamId,
    items,
    equipped: Object.fromEntries(Object.entries(equipped).map(([playerId, slots]) => [
      playerId,
      Object.fromEntries(Object.entries(slots || {}).filter(([, itemId]) => {
        const item = itemById(itemId);
        return item && equipmentSlotOfKind(item.kind);
      })),
    ])),
  };
}

function createInventories(teams, existing = []) {
  const source = Array.isArray(existing) ? existing : [];
  return teams.map((teamData) => {
    const previous = source.find((item) => item?.teamId === teamData.id);
    return normalizeInventoryEntry(previous, teamData.id);
  });
}

function shopWeek(stateLike) {
  return Number(stateLike?.week || 1);
}

function buildShopOffers(seedBase, seasonNo, week) {
  const rng = createRng(`${seedBase}|shop|s${seasonNo}|w${week}`);
  const byKind = ['consumable', 'keyboard', 'mouse', 'monitor', 'gear'].map((kind) => {
    const pool = ITEM_DEFS.filter((item) => item.kind === kind);
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }).filter(Boolean);
  const extras = [...ITEM_DEFS]
    .sort((a, b) => {
      const aRoll = createRng(`${seedBase}|${seasonNo}|${week}|${a.id}`)();
      const bRoll = createRng(`${seedBase}|${seasonNo}|${week}|${b.id}`)();
      return aRoll - bRoll;
    })
    .filter((item) => !byKind.some((picked) => picked.id === item.id))
    .slice(0, 3);
  const picked = [...byKind, ...extras].slice(0, 8);
  const featuredId = picked.length ? picked[Math.floor(rng() * picked.length) % picked.length].id : '';
  return picked.map((item) => {
    const salePct = item.id === featuredId ? Math.floor(20 + rng() * 26) : (rng() < 0.25 ? Math.floor(10 + rng() * 31) : 0);
    const price = Math.max(1, Math.floor(item.price * (100 - salePct) / 100));
    const stock = item.kind === 'consumable' ? Math.floor(3 + rng() * 4) : Math.floor(1 + rng() * 2);
    return {
      offerId: `offer-${seasonNo}-${week}-${item.id}`,
      itemId: item.id,
      basePrice: item.price,
      price,
      stock: item.id === featuredId ? stock + 2 : stock,
      salePct,
      featured: item.id === featuredId,
    };
  });
}

function ensureShop(state) {
  const seasonNo = Number(state.seasonNo || 1);
  const week = shopWeek(state);
  const shop = state.shop && typeof state.shop === 'object' ? state.shop : null;
  if (!shop || Number(shop.seasonNo) !== seasonNo || Number(shop.week) !== week || !Array.isArray(shop.offers)) {
    return {
      seasonNo,
      week,
      offers: buildShopOffers(state.runId || 'starleague', seasonNo, week),
      lastRerollAt: Date.now(),
    };
  }
  return {
    ...shop,
    seasonNo,
    week,
    offers: shop.offers
      .filter((offer) => offer && itemById(offer.itemId))
      .map((offer) => ({
        offerId: String(offer.offerId || `offer-${seasonNo}-${week}-${offer.itemId}`),
        itemId: offer.itemId,
        basePrice: Math.max(1, Math.floor(Number(offer.basePrice || itemById(offer.itemId)?.price || 1))),
        price: Math.max(1, Math.floor(Number(offer.price || itemById(offer.itemId)?.price || 1))),
        stock: clamp(Math.floor(Number(offer.stock || 0)), 0, 99),
        salePct: Math.max(0, Math.floor(Number(offer.salePct || 0))),
        featured: Boolean(offer.featured),
      })),
  };
}

export function getSourceSummary() {
  return {
    teams: TEAM_BLUEPRINTS.length,
    maps: 94,
    importedMaps: MAPS.length,
    source: 'starleague-masterdata.json',
  };
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const runId = options.runId || `sl-${Date.now().toString(36)}`;
  const teams = TEAM_BLUEPRINTS.map(cloneTeam);
  const fixtures = generateSchedule(teams);
  const contracts = ensureContractsForTeams(teams, {}, 1);
  const state = {
    runId,
    startedAt: now,
    updatedAt: now,
    seasonNo: 1,
    week: 1,
    teams,
    mapPool: MAPS.map((item) => item.id),
    fixtures,
    standings: createStandings(teams),
    contracts,
    inventories: createInventories(teams),
    shop: null,
    econLogs: [],
    seasonReports: [],
    freeAgentSeq: 0,
    log: ['시즌 1이 개막했습니다. 다음 경기나 이번 주 전체 진행을 눌러 리그를 진행하세요.'],
    ended: false,
    championTeamId: '',
  };
  return {
    ...state,
    shop: ensureShop(state),
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const teams = Array.isArray(value.teams) && value.teams.length ? value.teams.map(cloneTeam) : base.teams;
  const fixtures = Array.isArray(value.fixtures) && value.fixtures.length ? value.fixtures : generateSchedule(teams);
  const seasonNo = Number(value.seasonNo || base.seasonNo || 1);
  const merged = {
    ...base,
    ...value,
    teams,
    fixtures,
    contracts: ensureContractsForTeams(teams, value.contracts, seasonNo),
    inventories: createInventories(teams, value.inventories),
    econLogs: normalizeEconLogs(value.econLogs),
    seasonReports: Array.isArray(value.seasonReports) ? value.seasonReports.slice(0, 60) : base.seasonReports,
    standings: Array.isArray(value.standings) && value.standings.length ? value.standings : rebuildStandings(teams, fixtures),
    mapPool: Array.isArray(value.mapPool) && value.mapPool.length ? value.mapPool : base.mapPool,
    freeAgentSeq: Number(value.freeAgentSeq || 0),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
  return {
    ...merged,
    shop: ensureShop(merged),
  };
}

function createStandings(teams) {
  return teams.map((item) => ({
    teamId: item.id,
    wins: 0,
    losses: 0,
    mapWins: 0,
    mapLosses: 0,
    money: Number(item.money || 0),
    streak: 0,
  }));
}

function generateSchedule(teams) {
  const ids = teams.map((item) => item.id);
  const rotating = [...ids];
  const fixtures = [];
  const rounds = ids.length - 1;
  for (let round = 1; round <= rounds; round += 1) {
    for (let index = 0; index < ids.length / 2; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      const homeTeamId = round % 2 === 0 ? right : left;
      const awayTeamId = round % 2 === 0 ? left : right;
      fixtures.push({
        id: `R${round}-M${index + 1}`,
        round,
        homeTeamId,
        awayTeamId,
        played: false,
        result: null,
      });
    }
    rotating.splice(1, 0, rotating.pop());
  }
  return fixtures;
}

function rebuildStandings(teams, fixtures) {
  return fixtures.reduce((standings, fixture) => {
    if (!fixture.played || !fixture.result) return standings;
    return applyResultToStandings(standings, fixture.result);
  }, createStandings(teams));
}

function createRng(seed) {
  let hash = 2166136261;
  String(seed).split('').forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return () => {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildDef(race, matchup, name, style, tags = []) {
  return {
    id: `${race}-${matchup}-${name}`.replace(/\s+/g, '_'),
    race,
    matchup,
    name,
    style,
    tags,
  };
}

function matchupOf(a, b) {
  if (a === 'T' && b === 'Z') return 'TvZ';
  if (a === 'Z' && b === 'T') return 'TvZ';
  if (a === 'T' && b === 'P') return 'TvP';
  if (a === 'P' && b === 'T') return 'TvP';
  if (a === 'Z' && b === 'P') return 'ZvP';
  if (a === 'P' && b === 'Z') return 'ZvP';
  if (a === 'T' && b === 'T') return 'TvT';
  if (a === 'Z' && b === 'Z') return 'ZvZ';
  return 'PvP';
}

function signedMapBias(a, b, matchup, raw) {
  if (matchup === 'TvZ') {
    if (a === 'T' && b === 'Z') return raw;
    if (a === 'Z' && b === 'T') return -raw;
  }
  if (matchup === 'TvP') {
    if (a === 'T' && b === 'P') return raw;
    if (a === 'P' && b === 'T') return -raw;
  }
  if (matchup === 'ZvP') {
    if (a === 'Z' && b === 'P') return raw;
    if (a === 'P' && b === 'Z') return -raw;
  }
  return 0;
}

function mapMultiplier(aRace, bRace, map) {
  const matchup = matchupOf(aRace, bRace);
  const raw = Number(map?.matchupBalance?.[matchup] || 0);
  return 1 + signedMapBias(aRace, bRace, matchup, raw) * 0.6;
}

function conditionMultiplier(member) {
  return clamp(0.88 + (Number(member?.condition || 75) - 75) / 650, 0.84, 1.08);
}

function levelMultiplier(member) {
  return 1 + clamp(Number(member?.level || 0), 0, 12) * 0.018;
}

function phasePower(member) {
  const stats = member?.stats || {};
  const early = Number(stats.scout || 0) * 0.2
    + Number(stats.harass || 0) * 0.2
    + Number(stats.sense || 0) * 0.25
    + Number(stats.control || 0) * 0.35;
  const mid = Number(stats.strategy || 0) * 0.35
    + Number(stats.control || 0) * 0.35
    + Number(stats.defense || 0) * 0.3;
  const late = Number(stats.macro || 0) * 0.35
    + Number(stats.attack || 0) * 0.25
    + Number(stats.strategy || 0) * 0.25
    + Number(stats.control || 0) * 0.15;
  const overall = Number(stats.attack || 0) * 0.12
    + Number(stats.defense || 0) * 0.12
    + Number(stats.strategy || 0) * 0.15
    + Number(stats.sense || 0) * 0.12
    + Number(stats.macro || 0) * 0.13
    + Number(stats.scout || 0) * 0.12
    + Number(stats.control || 0) * 0.14
    + Number(stats.harass || 0) * 0.1;
  return { early, mid, late, overall };
}

function playerBuildPreference(member) {
  const stats = member?.stats || {};
  return {
    rush: (Number(stats.harass || 0) * 0.55 + Number(stats.sense || 0) * 0.45) / 1000,
    macro: (Number(stats.macro || 0) * 0.75 + Number(stats.defense || 0) * 0.25) / 1000,
    tech: (Number(stats.strategy || 0) * 0.65 + Number(stats.scout || 0) * 0.35) / 1000,
    harass: (Number(stats.harass || 0) * 0.65 + Number(stats.control || 0) * 0.35) / 1000,
    balanced: (Number(stats.control || 0) * 0.45 + Number(stats.strategy || 0) * 0.35 + Number(stats.sense || 0) * 0.2) / 1000,
  };
}

function coachBuildBias(style, buildStyle) {
  if (style === 'aggressive') return buildStyle === 'rush' || buildStyle === 'harass' ? 0.1 : -0.02;
  if (style === 'macro') return buildStyle === 'macro' || buildStyle === 'tech' ? 0.1 : -0.02;
  if (style === 'mindgame') return buildStyle === 'balanced' ? 0.03 : 0.01;
  return buildStyle === 'balanced' ? 0.06 : 0.01;
}

function pickBuild(seed, teamData, member, opponent, map) {
  const rng = createRng(seed);
  const matchup = matchupOf(member?.race, opponent?.race);
  const options = BUILD_DEFS.filter((item) => item.race === member?.race && item.matchup === matchup);
  if (!options.length) return buildDef(member?.race || 'T', matchup, '기본 운영', 'balanced');

  const preference = playerBuildPreference(member);
  const weighted = options.map((item) => {
    const mapTags = Array.isArray(map?.tags) ? map.tags : [];
    const tagBonus = item.tags.reduce((sum, tag) => sum + (mapTags.includes(tag) ? 0.04 : 0), 0);
    const score = clamp(
      Number(preference[item.style] || 0.5)
        + coachBuildBias(teamData?.coachStyle, item.style)
        + tagBonus
        + (rng() - 0.5) * 0.06,
      0.01,
      0.99,
    );
    return { item, score: Math.exp(score / 0.9) };
  });
  const total = weighted.reduce((sum, row) => sum + row.score, 0);
  let roll = rng() * total;
  for (const row of weighted) {
    roll -= row.score;
    if (roll <= 0) return row.item;
  }
  return weighted[weighted.length - 1].item;
}

function counterBonus(myStyle, opponentStyle) {
  if (myStyle === opponentStyle) return 0;
  if (myStyle === 'rush' && opponentStyle === 'macro') return 0.045;
  if (myStyle === 'rush' && opponentStyle === 'tech') return 0.02;
  if (myStyle === 'rush' && opponentStyle === 'harass') return 0.01;
  if (myStyle === 'harass' && opponentStyle === 'macro') return 0.03;
  if (myStyle === 'harass' && opponentStyle === 'tech') return 0.015;
  if (myStyle === 'tech' && opponentStyle === 'rush') return 0.04;
  if (myStyle === 'macro' && opponentStyle === 'tech') return 0.03;
  if (myStyle === 'balanced') return 0.01;
  return -0.005;
}

function stylePhaseBonus(style) {
  if (style === 'rush') return { early: 0.055, mid: 0.02, late: -0.02 };
  if (style === 'harass') return { early: 0.02, mid: 0.04, late: 0 };
  if (style === 'tech') return { early: -0.01, mid: 0.045, late: 0.015 };
  if (style === 'macro') return { early: -0.02, mid: 0.015, late: 0.06 };
  return { early: 0.01, mid: 0.01, late: 0.01 };
}

function pressureOf(member, opponent, teamData) {
  const mean = (Number(member?.fame || 0) + Number(opponent?.fame || 0)) / 2;
  const z = (Number(member?.fame || 0) - mean) / 600;
  const pressure = clamp(0.5 + (1 / (1 + Math.exp(-z)) - 0.5), 0, 1);
  const coachStability = teamData?.coachStyle === 'aggressive'
    ? 0.5
    : teamData?.coachStyle === 'macro'
    ? 0.62
    : teamData?.coachStyle === 'mindgame'
    ? 0.58
    : 0.65;
  return { pressure, coachStability };
}

function noiseMultiplierFromPressure(info, importance) {
  const base = 1 + Number(info?.pressure || 0) * 0.18 * importance;
  const stability = 1 - (Number(info?.coachStability || 0.55) - 0.55) * 0.12;
  return clamp(base * stability, 0.85, 1.25);
}

function importanceForSet(scoreHome, scoreAway) {
  const homeNeed = 3 - Number(scoreHome || 0);
  const awayNeed = 3 - Number(scoreAway || 0);
  if (homeNeed <= 1 || awayNeed <= 1) return 1.2;
  if (Number(scoreHome || 0) + Number(scoreAway || 0) >= 3) return 1.05;
  return 0.9;
}

function gaussian(rng, mean = 0, sigma = 1) {
  const u1 = Math.max(1e-9, rng());
  const u2 = Math.max(1e-9, rng());
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

function baseNoiseAmp(homePlayer, awayPlayer) {
  const mirror = homePlayer?.race === awayPlayer?.race;
  const controlAverage = (
    Number(homePlayer?.stats?.strategy || 0)
    + Number(homePlayer?.stats?.scout || 0)
    + Number(homePlayer?.stats?.control || 0)
    + Number(awayPlayer?.stats?.strategy || 0)
    + Number(awayPlayer?.stats?.scout || 0)
    + Number(awayPlayer?.stats?.control || 0)
  ) / 6;
  const base = mirror ? 55 : 95;
  return clamp(base * (1 - clamp((controlAverage - 520) / 2400, 0, 0.25)), 35, 120);
}

function durationFromDiff(rng, diff, mirror) {
  const swing = clamp(260 - Math.abs(diff) * 0.6, 0, 320);
  const base = mirror ? 1120 : 980;
  return Math.round(clamp(base + swing + gaussian(rng, 0, 65), 540, 1650));
}

function statAverageFromStats(stats = {}) {
  return CAREER_STAT_KEYS.reduce((sum, key) => sum + Number(stats[key] || 0), 0) / CAREER_STAT_KEYS.length;
}

function normalizeTeamCareer(teamData) {
  const roster = Array.isArray(teamData.roster) ? teamData.roster : [];
  const rosterFame = roster.reduce((sum, member) => sum + Number(member.fame || 0), 0);
  const baseFan = Math.round(900 + rosterFame / Math.max(1, roster.length) * 5 + Math.max(0, teamPower(teamData)) * 2);
  const career = teamData.career && typeof teamData.career === 'object' ? teamData.career : {};
  return {
    sponsorTier: clamp(Number(career.sponsorTier || 1), 1, 6),
    fanBase: Math.max(0, Math.round(Number(career.fanBase || baseFan))),
    trainingLevel: clamp(Number(career.trainingLevel || 1), 1, 8),
    scoutingLevel: clamp(Number(career.scoutingLevel || 1), 1, 8),
    payrollPressure: Math.max(0, Math.round(Number(career.payrollPressure || calcTeamPayroll(teamData)))),
  };
}

function addStateLog(state, line) {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 90),
  };
}

function syncTeamEconomy(state, teamId, updater) {
  const teamData = getTeam(state, teamId);
  const standing = getStanding(state, teamId);
  const currentMoney = Number(standing?.money ?? teamData.money ?? 0);
  const updatedTeam = updater({ ...teamData, money: currentMoney, career: normalizeTeamCareer(teamData) }, currentMoney);
  const nextMoney = Number(updatedTeam.money ?? currentMoney);
  return {
    ...state,
    teams: state.teams.map((item) => (item.id === teamId ? cloneTeam(updatedTeam) : item)),
    standings: state.standings.map((row) => (row.teamId === teamId ? { ...row, money: nextMoney } : row)),
    updatedAt: new Date().toISOString(),
  };
}

export function calcPlayerMarketValue(member) {
  const avg = statAverageFromStats(member?.stats || {});
  const fame = Number(member?.fame || 0);
  const salaryStep = Number(member?.salaryStep || 0);
  return clamp(Math.floor(avg * 0.82 + Number(member?.level || 1) * 24 + fame * 0.32 + salaryStep * 12), 60, 560);
}

export function calcTeamPayroll(teamData) {
  if (!Array.isArray(teamData?.roster)) return 0;
  return teamData.roster.reduce((sum, member) => sum + Math.max(10, Math.floor(calcPlayerMarketValue(member) * 0.22)), 0);
}

function createPlayerContract(member, teamId, seasonNo, overrides = {}) {
  const marketValue = calcPlayerMarketValue(member);
  return {
    playerId: member.id,
    teamId,
    salary: Math.max(10, Math.floor(Number(overrides.salary ?? marketValue * 0.22))),
    signingBonus: Math.max(0, Math.floor(Number(overrides.signingBonus ?? 0))),
    yearsLeft: clamp(Number(overrides.yearsLeft ?? 2), 1, 5),
    startedSeasonNo: Number(overrides.startedSeasonNo || seasonNo || 1),
  };
}

function ensureContractsForTeams(teams, existing, seasonNo = 1) {
  const source = existing && typeof existing === 'object' ? existing : {};
  return teams.reduce((contracts, teamData) => {
    teamData.roster.forEach((member) => {
      const previous = source[member.id];
      contracts[member.id] = createPlayerContract(member, teamData.id, seasonNo, previous || {});
    });
    return contracts;
  }, {});
}

function teamPayrollFromContracts(contracts, teamData) {
  return teamData.roster.reduce((sum, member) => {
    const contract = contracts?.[member.id];
    return sum + Number(contract?.salary || Math.max(10, Math.floor(calcPlayerMarketValue(member) * 0.22)));
  }, 0);
}

function contractRowsForTeam(state, teamId) {
  const teamData = getTeam(state, teamId);
  return teamData.roster.map((member) => {
    const contract = state.contracts?.[member.id] || createPlayerContract(member, teamData.id, state.seasonNo);
    return {
      playerId: member.id,
      playerName: member.name,
      salary: Number(contract.salary || 0),
      yearsLeft: Number(contract.yearsLeft || 0),
      signingBonus: Number(contract.signingBonus || 0),
      marketValue: calcPlayerMarketValue(member),
    };
  }).sort((a, b) => b.salary - a.salary || a.playerName.localeCompare(b.playerName, 'ko-KR'));
}

function normalizeEconLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: String(entry.id || `econ-${Date.now().toString(36)}`),
      seasonNo: Number(entry.seasonNo || 1),
      week: Number(entry.week || 0),
      teamId: String(entry.teamId || ''),
      teamName: String(entry.teamName || ''),
      tag: String(entry.tag || 'BONUS'),
      amount: Math.trunc(Number(entry.amount || 0)),
      note: String(entry.note || ''),
      at: Number(entry.at || Date.now()),
      meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    }))
    .slice(0, 160);
}

function addEconLog(state, params) {
  const teamData = params.teamId ? getTeam(state, params.teamId) : null;
  const entry = {
    id: `econ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    seasonNo: Number(params.seasonNo ?? state.seasonNo ?? 1),
    week: Number(params.week ?? state.week ?? 0),
    teamId: params.teamId || '',
    teamName: params.teamName || teamData?.name || '',
    tag: params.tag || 'BONUS',
    amount: Math.trunc(Number(params.amount || 0)),
    note: params.note || ECON_TAG_LABELS[params.tag] || '경제 로그',
    at: params.at || Date.now(),
    meta: params.meta || {},
  };
  return {
    ...state,
    econLogs: [entry, ...normalizeEconLogs(state.econLogs)].slice(0, 160),
  };
}

export function getTeamContractRows(state, teamId) {
  const current = normalizeState(state);
  return contractRowsForTeam(current, teamId);
}

export function econSummary(state, teamId) {
  const current = normalizeState(state);
  const logs = normalizeEconLogs(current.econLogs).filter((entry) => !teamId || entry.teamId === teamId);
  const income = logs.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expense = logs.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const contracts = teamId ? contractRowsForTeam(current, teamId) : [];
  return {
    income,
    expense,
    net: income - expense,
    count: logs.length,
    last: logs.slice(0, 8),
    payroll: teamId ? teamPayrollFromContracts(current.contracts, getTeam(current, teamId)) : 0,
    expiringCount: contracts.filter((item) => item.yearsLeft <= 1).length,
  };
}

function getTeamInventory(state, teamId) {
  return createInventories(state.teams, state.inventories).find((item) => item.teamId === teamId) || normalizeInventoryEntry(null, teamId);
}

function addInventoryItem(state, teamId, itemId, qty = 1) {
  const amount = clamp(Math.floor(Number(qty || 0)), 0, 9999);
  if (!amount) return state;
  const inventories = createInventories(state.teams, state.inventories).map((inventory) => {
    if (inventory.teamId !== teamId) return inventory;
    const items = [...inventory.items];
    const index = items.findIndex((item) => item.itemId === itemId);
    if (index >= 0) items[index] = { ...items[index], qty: clamp(Number(items[index].qty || 0) + amount, 0, 9999) };
    else items.push({ itemId, qty: amount });
    return { ...inventory, items };
  });
  return { ...state, inventories };
}

function consumeInventoryItem(state, teamId, itemId, qty = 1) {
  const amount = clamp(Math.floor(Number(qty || 0)), 0, 9999);
  if (!amount) return state;
  const inventories = createInventories(state.teams, state.inventories).map((inventory) => {
    if (inventory.teamId !== teamId) return inventory;
    const items = inventory.items
      .map((item) => (item.itemId === itemId ? { ...item, qty: clamp(Number(item.qty || 0) - amount, 0, 9999) } : item))
      .filter((item) => item.qty > 0);
    return { ...inventory, items };
  });
  return { ...state, inventories };
}

function equippedItemUseCount(inventory, itemId, exceptPlayerId = '') {
  return Object.entries(inventory.equipped || {}).reduce((sum, [playerId, slots]) => {
    if (playerId === exceptPlayerId) return sum;
    return sum + Object.values(slots || {}).filter((id) => id === itemId).length;
  }, 0);
}

function inventoryQty(inventory, itemId) {
  return Number(inventory.items.find((item) => item.itemId === itemId)?.qty || 0);
}

function inferSetKey(itemId) {
  return String(itemId || '').match(/-(\d+)$/)?.[1] || null;
}

function applyEquippedToPlayer(playerData, inventory) {
  const equipped = inventory?.equipped?.[playerData.id];
  if (!equipped) return playerData;
  const stats = { ...(playerData.stats || {}) };
  Object.values(equipped).forEach((itemId) => {
    const item = itemById(itemId);
    Object.entries(item?.effects?.statsDelta || {}).forEach(([key, amount]) => {
      stats[key] = Number(stats[key] || 0) + Number(amount || 0);
    });
  });

  const slotIds = Object.values(equipped).filter(Boolean);
  let equipmentMul = 1;
  if (slotIds.length === 2) equipmentMul = 1.01;
  else if (slotIds.length === 3) equipmentMul = 1.025;
  else if (slotIds.length >= 4) equipmentMul = 1.04;

  const setKeys = slotIds.map(inferSetKey).filter(Boolean);
  if (setKeys.length >= 3 && setKeys.every((key) => key === setKeys[0])) equipmentMul += 0.02;
  else if (setKeys.length === 2 && setKeys[0] === setKeys[1]) equipmentMul += 0.008;

  return {
    ...playerData,
    stats,
    equipmentMul: clamp(equipmentMul, 0.9, 1.12),
  };
}

function teamWithEquipment(state, teamData) {
  const inventory = getTeamInventory(state, teamData.id);
  return {
    ...teamData,
    roster: teamData.roster.map((member) => applyEquippedToPlayer(member, inventory)),
  };
}

export function getSeasonShopRows(state) {
  const current = normalizeState(state);
  return ensureShop(current).offers.map((offer) => {
    const item = itemById(offer.itemId);
    return {
      ...offer,
      name: item?.name || offer.itemId,
      kind: item?.kind || 'other',
      slot: equipmentSlotOfKind(item?.kind),
      effects: item?.effects || {},
    };
  });
}

export function inventoryRowsForTeam(state, teamId) {
  const current = normalizeState(state);
  const inventory = getTeamInventory(current, teamId);
  return inventory.items.map((entry) => {
    const item = itemById(entry.itemId);
    return {
      ...entry,
      name: item?.name || entry.itemId,
      kind: item?.kind || 'other',
      slot: equipmentSlotOfKind(item?.kind),
      equippedCount: equippedItemUseCount(inventory, entry.itemId),
      effects: item?.effects || {},
    };
  }).sort((a, b) => String(a.kind).localeCompare(String(b.kind), 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR'));
}

export function equipmentRowsForPlayer(state, teamId, playerId) {
  const current = normalizeState(state);
  const inventory = getTeamInventory(current, teamId);
  const slots = inventory.equipped?.[playerId] || {};
  return Object.entries(EQUIPMENT_SLOT_LABELS).map(([slot, label]) => {
    const itemId = slots[slot] || '';
    const item = itemById(itemId);
    return {
      slot,
      label,
      itemId,
      itemName: item?.name || '',
      effects: item?.effects || {},
    };
  });
}

export function buyShopItemAction(state, teamId, offerId) {
  let current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 상점 구매를 진행할 수 없습니다.');
  const shop = ensureShop(current);
  const offer = shop.offers.find((item) => item.offerId === offerId);
  if (!offer) return addStateLog(current, '상점 상품을 찾을 수 없습니다.');
  if (Number(offer.stock || 0) <= 0) return addStateLog(current, '해당 상품은 품절됐습니다.');
  const item = itemById(offer.itemId);
  if (!item) return addStateLog(current, '아이템 정보를 찾을 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (money < offer.price) return addStateLog(current, `${teamData.name} 상점 구매 실패: ${offer.price} Cr 필요, 보유 ${money} Cr`);

  current = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) - offer.price,
  }));
  current = addInventoryItem({
    ...current,
    shop: {
      ...shop,
      offers: shop.offers.map((row) => (row.offerId === offerId ? { ...row, stock: Math.max(0, Number(row.stock || 0) - 1) } : row)),
    },
  }, teamId, item.id, 1);
  current = addEconLog(current, {
    teamId,
    tag: 'SHOP',
    amount: -offer.price,
    note: `${teamData.name} 상점 구매: ${item.name}`,
    meta: { itemId: item.id, itemName: item.name, price: offer.price },
  });
  return addStateLog(current, `${teamData.name} 상점 구매: ${item.name} -${offer.price} Cr`);
}

export function equipInventoryItemAction(state, teamId, playerId, itemId) {
  const current = normalizeState(state);
  const item = itemById(itemId);
  const slot = equipmentSlotOfKind(item?.kind);
  if (!item || !slot) return addStateLog(current, '장착할 수 없는 아이템입니다.');
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  if (!playerData) return addStateLog(current, '선수를 찾을 수 없습니다.');
  const inventory = getTeamInventory(current, teamId);
  const currentSlots = inventory.equipped[playerId] || {};
  const equippedElsewhere = equippedItemUseCount(inventory, itemId, playerId);
  const alreadyOnPlayer = Object.values(currentSlots).filter((id) => id === itemId).length;
  if (inventoryQty(inventory, itemId) <= equippedElsewhere + alreadyOnPlayer && currentSlots[slot] !== itemId) {
    return addStateLog(current, `${item.name} 보유 수량이 부족합니다.`);
  }
  const inventories = createInventories(current.teams, current.inventories).map((row) => {
    if (row.teamId !== teamId) return row;
    return {
      ...row,
      equipped: {
        ...row.equipped,
        [playerId]: {
          ...(row.equipped[playerId] || {}),
          [slot]: itemId,
        },
      },
    };
  });
  return addStateLog({
    ...current,
    inventories,
    updatedAt: new Date().toISOString(),
  }, `${playerData.name} ${EQUIPMENT_SLOT_LABELS[slot]} 장착: ${item.name}`);
}

export function unequipSlotAction(state, teamId, playerId, slot) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  const inventories = createInventories(current.teams, current.inventories).map((row) => {
    if (row.teamId !== teamId) return row;
    const nextSlots = { ...(row.equipped[playerId] || {}) };
    delete nextSlots[slot];
    return {
      ...row,
      equipped: {
        ...row.equipped,
        [playerId]: nextSlots,
      },
    };
  });
  return addStateLog({
    ...current,
    inventories,
    updatedAt: new Date().toISOString(),
  }, `${playerData?.name || '선수'} ${EQUIPMENT_SLOT_LABELS[slot] || slot} 장착을 해제했습니다.`);
}

export function consumeInventoryItemAction(state, teamId, playerId, itemId) {
  let current = normalizeState(state);
  const item = itemById(itemId);
  if (!item || item.kind !== 'consumable') return addStateLog(current, '사용할 수 없는 아이템입니다.');
  const inventory = getTeamInventory(current, teamId);
  if (inventoryQty(inventory, itemId) <= 0) return addStateLog(current, `${item.name} 보유 수량이 없습니다.`);
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  if (!playerData) return addStateLog(current, '선수를 찾을 수 없습니다.');
  const conditionDelta = Number(item.effects?.conditionDelta || 0);
  const fameDelta = Number(item.effects?.fameDelta || 0);
  current = {
    ...current,
    teams: current.teams.map((team) => (team.id === teamId ? {
      ...team,
      roster: team.roster.map((member) => (member.id === playerId ? {
        ...member,
        condition: clamp(Number(member.condition || 0) + conditionDelta, 0, 100),
        fame: Math.max(0, Math.round(Number(member.fame || 0) + fameDelta)),
      } : member)),
    } : team)),
  };
  current = consumeInventoryItem(current, teamId, itemId, 1);
  return addStateLog({
    ...current,
    updatedAt: new Date().toISOString(),
  }, `${playerData.name}에게 ${item.name} 사용: 컨디션 +${conditionDelta}${fameDelta ? `, 명성 +${fameDelta}` : ''}`);
}

function buildSeasonReport(state) {
  const leader = getTopTeams(state, 1)[0];
  const seasonLogs = normalizeEconLogs(state.econLogs).filter((entry) => entry.seasonNo === Number(state.seasonNo || 1));
  const income = seasonLogs.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expense = seasonLogs.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  return {
    seasonNo: Number(state.seasonNo || 1),
    createdAt: Date.now(),
    championTeamId: leader?.teamId || '',
    championTeamName: leader?.teamName || '',
    played: getPlayedCount(state),
    total: getTotalFixtureCount(state),
    income,
    expense,
    net: income - expense,
    score: scoreState(state),
  };
}

function appendSeasonReport(state) {
  const existing = Array.isArray(state.seasonReports) ? state.seasonReports : [];
  if (existing.some((report) => Number(report.seasonNo) === Number(state.seasonNo))) return state;
  return {
    ...state,
    seasonReports: [buildSeasonReport(state), ...existing].slice(0, 60),
  };
}

function rankedIndex(state, teamId) {
  return getTopTeams(state, state.teams.length).findIndex((row) => row.teamId === teamId);
}

function makeFreeAgentCandidate(state, teamId, seqOffset = 0) {
  const teamData = getTeam(state, teamId);
  const career = normalizeTeamCareer(teamData);
  const seq = Number(state.freeAgentSeq || 0) + seqOffset;
  const rng = createRng(`${state.runId}|fa|${state.seasonNo}|${state.week}|${teamId}|${seq}`);
  const nameParts = FREE_AGENT_NAMES[Math.floor(rng() * FREE_AGENT_NAMES.length) % FREE_AGENT_NAMES.length];
  const base = clamp(teamPower(teamData, state) + career.scoutingLevel * 10 + Math.round((rng() - 0.35) * 72), 420, 660);
  const race = ['T', 'Z', 'P'][Math.floor(rng() * 3) % 3];
  const level = clamp(3 + Math.floor((base - 420) / 45), 3, 8);
  const stats = CAREER_STAT_KEYS.reduce((acc, key, index) => {
    acc[key] = clamp(Math.round(base + (rng() - 0.5) * 58 + (index % 2 === 0 ? 8 : -4)), 260, 820);
    return acc;
  }, {});
  const candidate = {
    id: `fa-${state.seasonNo}-${state.week}-${teamId}-${seq + 1}`,
    name: `${nameParts[0]} ${nameParts[1]}`,
    race,
    level,
    condition: 92,
    fame: Math.round(80 + level * 32 + rng() * 180),
    salaryStep: 0,
    stats,
  };
  const marketValue = calcPlayerMarketValue(candidate);
  return {
    player: candidate,
    signingBonus: Math.max(110, Math.floor(marketValue * 0.62)),
    salary: Math.max(16, Math.floor(marketValue * 0.28)),
    yearsLeft: marketValue >= 320 || level >= 7 ? 3 : 2,
  };
}

export function getFreeAgentPreview(state, teamId) {
  const current = normalizeState(state);
  return makeFreeAgentCandidate(current, teamId, 0);
}

export function careerSummary(state, teamId) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const standing = getStanding(current, teamId);
  const payroll = teamPayrollFromContracts(current.contracts, teamData);
  const preview = makeFreeAgentCandidate(current, teamId, 0);
  return {
    ...career,
    money: Number(standing?.money ?? teamData.money ?? 0),
    payroll,
    rosterValue: teamData.roster.reduce((sum, member) => sum + calcPlayerMarketValue(member), 0),
    freeAgentCost: preview.signingBonus,
    freeAgentName: preview.player.name,
    freeAgentRace: preview.player.race,
  };
}

function mapById(id) {
  return MAPS.find((item) => item.id === id) || MAPS[0];
}

export function getTeam(state, teamId) {
  return state.teams.find((item) => item.id === teamId) || state.teams[0];
}

export function teamName(state, teamId) {
  return getTeam(state, teamId)?.name || teamId;
}

function getStanding(state, teamId) {
  return state.standings.find((item) => item.teamId === teamId) || createStandings([getTeam(state, teamId)])[0];
}

function averageStats(member) {
  const stats = member.stats || {};
  return (
    Number(stats.attack || 0) * 1.1
    + Number(stats.defense || 0) * 0.85
    + Number(stats.strategy || 0)
    + Number(stats.sense || 0) * 0.95
    + Number(stats.macro || 0)
    + Number(stats.scout || 0) * 0.8
    + Number(stats.control || 0) * 1.1
    + Number(stats.harass || 0) * 0.85
  ) / 7.65;
}

function lineupFor(teamData, fixtureId) {
  const offset = fixtureId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const sorted = [...teamData.roster].sort((a, b) => (
    averageStats(b) + Number(b.level || 0) * 12 + Number(b.fame || 0) / 20
  ) - (
    averageStats(a) + Number(a.level || 0) * 12 + Number(a.fame || 0) / 20
  ));
  return Array.from({ length: 5 }, (_, index) => sorted[(index + offset) % sorted.length]);
}

function simulateSet({ state, fixture, homeTeam, awayTeam, homePlayer, awayPlayer, setNo, scoreHome, scoreAway }) {
  const mapIds = state.mapPool.length ? state.mapPool : MAPS.map((item) => item.id);
  const map = mapById(mapIds[(fixture.round + setNo - 2) % mapIds.length]);
  const seed = `${state.runId}|${fixture.id}|${setNo}|${scoreHome}-${scoreAway}`;
  const rng = createRng(seed);
  const homeBuild = pickBuild(`${seed}|build|home`, homeTeam, homePlayer, awayPlayer, map);
  const awayBuild = pickBuild(`${seed}|build|away`, awayTeam, awayPlayer, homePlayer, map);
  const homePhase = phasePower(homePlayer);
  const awayPhase = phasePower(awayPlayer);
  const homeBuildPhase = stylePhaseBonus(homeBuild.style);
  const awayBuildPhase = stylePhaseBonus(awayBuild.style);
  const homeCounter = counterBonus(homeBuild.style, awayBuild.style);
  const awayCounter = counterBonus(awayBuild.style, homeBuild.style);
  const homeBaseMul = conditionMultiplier(homePlayer) * levelMultiplier(homePlayer) * mapMultiplier(homePlayer.race, awayPlayer.race, map) * Number(homePlayer.equipmentMul || 1);
  const awayBaseMul = conditionMultiplier(awayPlayer) * levelMultiplier(awayPlayer) * mapMultiplier(awayPlayer.race, homePlayer.race, map) * Number(awayPlayer.equipmentMul || 1);
  const coachMul = (style) => (
    style === 'balanced' ? 1.01
    : style === 'macro' ? 1.008
    : style === 'aggressive' ? 1.006
    : style === 'mindgame' ? 1.004
    : 1
  );
  const homeCoachMul = coachMul(homeTeam.coachStyle);
  const awayCoachMul = coachMul(awayTeam.coachStyle);
  const homeEarly = homePhase.early * homeBaseMul * (1 + homeBuildPhase.early + homeCounter * 0.7) * homeCoachMul;
  const homeMid = homePhase.mid * homeBaseMul * (1 + homeBuildPhase.mid + homeCounter * 0.55) * homeCoachMul;
  const homeLate = homePhase.late * homeBaseMul * (1 + homeBuildPhase.late + homeCounter * 0.3) * homeCoachMul;
  const awayEarly = awayPhase.early * awayBaseMul * (1 + awayBuildPhase.early + awayCounter * 0.7) * awayCoachMul;
  const awayMid = awayPhase.mid * awayBaseMul * (1 + awayBuildPhase.mid + awayCounter * 0.55) * awayCoachMul;
  const awayLate = awayPhase.late * awayBaseMul * (1 + awayBuildPhase.late + awayCounter * 0.3) * awayCoachMul;
  const diff = 0.34 * (homeEarly - awayEarly) + 0.36 * (homeMid - awayMid) + 0.3 * (homeLate - awayLate);
  const importance = importanceForSet(scoreHome, scoreAway);
  const homePressure = pressureOf(homePlayer, awayPlayer, homeTeam);
  const awayPressure = pressureOf(awayPlayer, homePlayer, awayTeam);
  let noiseAmp = baseNoiseAmp(homePlayer, awayPlayer);
  noiseAmp *= noiseMultiplierFromPressure(homePressure, importance);
  noiseAmp *= noiseMultiplierFromPressure(awayPressure, importance);
  if (homeTeam.coachStyle === 'mindgame' || awayTeam.coachStyle === 'mindgame') noiseAmp *= 1.05;
  noiseAmp *= 1 - clamp((Math.abs(diff) - 240) / 1800, 0, 0.18);
  const noisyDiff = diff + gaussian(rng, 0, noiseAmp);
  const pHome = clamp(1 / (1 + Math.exp(-noisyDiff / 220)), 0.08, 0.92);
  const homeWin = rng() < pHome;
  return {
    setNo,
    mapId: map.id,
    mapName: map.name,
    homePlayerId: homePlayer.id,
    homePlayerName: homePlayer.name,
    awayPlayerId: awayPlayer.id,
    awayPlayerName: awayPlayer.name,
    winnerTeamId: homeWin ? homeTeam.id : awayTeam.id,
    winnerPlayerId: homeWin ? homePlayer.id : awayPlayer.id,
    probabilityHome: Math.round(pHome * 100),
    durationSec: durationFromDiff(rng, noisyDiff, homePlayer.race === awayPlayer.race),
    matchup: matchupOf(homePlayer.race, awayPlayer.race),
    homeBuildName: homeBuild.name,
    awayBuildName: awayBuild.name,
    homeBuildStyle: homeBuild.style,
    awayBuildStyle: awayBuild.style,
    mapBiasHome: Math.round((mapMultiplier(homePlayer.race, awayPlayer.race, map) - 1) * 1000) / 10,
    phaseDiff: Math.round(diff),
    noisyDiff: Math.round(noisyDiff),
    noiseAmp: Math.round(noiseAmp),
    counterHome: Math.round(homeCounter * 1000) / 10,
    counterAway: Math.round(awayCounter * 1000) / 10,
  };
}

function simulateFixture(state, fixture) {
  const homeTeam = teamWithEquipment(state, getTeam(state, fixture.homeTeamId));
  const awayTeam = teamWithEquipment(state, getTeam(state, fixture.awayTeamId));
  const homeLineup = lineupFor(homeTeam, fixture.id);
  const awayLineup = lineupFor(awayTeam, fixture.id);
  let scoreHome = 0;
  let scoreAway = 0;
  const sets = [];

  for (let setNo = 1; setNo <= 5 && scoreHome < 3 && scoreAway < 3; setNo += 1) {
    const setResult = simulateSet({
      state,
      fixture,
      homeTeam,
      awayTeam,
      homePlayer: homeLineup[(setNo - 1) % homeLineup.length],
      awayPlayer: awayLineup[(setNo - 1) % awayLineup.length],
      setNo,
      scoreHome,
      scoreAway,
    });
    sets.push(setResult);
    if (setResult.winnerTeamId === homeTeam.id) scoreHome += 1;
    else scoreAway += 1;
  }

  return {
    matchId: fixture.id,
    round: fixture.round,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    scoreHome,
    scoreAway,
    winnerTeamId: scoreHome > scoreAway ? homeTeam.id : awayTeam.id,
    loserTeamId: scoreHome > scoreAway ? awayTeam.id : homeTeam.id,
    sets,
    playedAt: Date.now(),
  };
}

function applyResultToStandings(standings, result) {
  return standings.map((row) => {
    if (row.teamId !== result.homeTeamId && row.teamId !== result.awayTeamId) return row;
    const isHome = row.teamId === result.homeTeamId;
    const mapFor = isHome ? result.scoreHome : result.scoreAway;
    const mapAgainst = isHome ? result.scoreAway : result.scoreHome;
    const won = row.teamId === result.winnerTeamId;
    return {
      ...row,
      wins: row.wins + (won ? 1 : 0),
      losses: row.losses + (won ? 0 : 1),
      mapWins: row.mapWins + mapFor,
      mapLosses: row.mapLosses + mapAgainst,
      money: Number(row.money || 0) + (won ? 150 : 70),
      streak: won ? Math.max(1, Number(row.streak || 0) + 1) : Math.min(-1, Number(row.streak || 0) - 1),
    };
  });
}

function tuneRosterAfterMatch(teams, result) {
  const playedWinners = new Set(result.sets.filter((setResult) => setResult.winnerTeamId === result.winnerTeamId).map((setResult) => setResult.winnerPlayerId));
  const playedPlayers = new Set(result.sets.flatMap((setResult) => [setResult.homePlayerId, setResult.awayPlayerId]));
  return teams.map((teamData) => ({
    ...teamData,
    roster: teamData.roster.map((member) => {
      const played = playedPlayers.has(member.id);
      const wonSet = playedWinners.has(member.id);
      return {
        ...member,
        condition: clamp(Number(member.condition || 100) + (played ? (wonSet ? -3 : -7) : 2), 35, 100),
        fame: Math.max(0, Number(member.fame || 0) + (wonSet ? 7 : played ? 2 : 0)),
      };
    }),
  }));
}

function advanceWeekIfNeeded(state) {
  const totalRounds = Math.max(...state.fixtures.map((fixture) => fixture.round));
  const currentRoundDone = state.fixtures
    .filter((fixture) => fixture.round === state.week)
    .every((fixture) => fixture.played);
  const allDone = state.fixtures.every((fixture) => fixture.played);

  if (allDone) {
    const leader = getTopTeams(state, 1)[0];
    return appendSeasonReport({
      ...state,
      ended: true,
      championTeamId: leader?.teamId || '',
      log: [`${leader?.teamName || '선두 팀'}이 시즌 ${state.seasonNo} 우승을 확정했습니다.`, ...state.log].slice(0, 90),
    });
  }

  if (currentRoundDone && state.week < totalRounds) {
    return {
      ...state,
      week: state.week + 1,
      log: [`${state.week + 1}주차 일정으로 넘어갔습니다.`, ...state.log].slice(0, 90),
    };
  }
  return state;
}

function addResultLog(state, result) {
  const winner = result.winnerTeamId === result.homeTeamId ? result.homeTeamName : result.awayTeamName;
  return {
    ...state,
    log: [
      `${result.round}주차 ${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName} - ${winner} 승`,
      ...state.log,
    ].slice(0, 90),
  };
}

export function simulateNextMatchAction(state) {
  const current = normalizeState(state);
  if (current.ended) {
    return {
      ...current,
      log: ['이미 시즌이 종료됐습니다. 전적에 기록하거나 다음 시즌을 시작하세요.', ...current.log].slice(0, 90),
    };
  }
  const fixture = current.fixtures.find((item) => item.round === current.week && !item.played)
    || current.fixtures.find((item) => !item.played);
  if (!fixture) return advanceWeekIfNeeded(current);

  const result = simulateFixture(current, fixture);
  let next = {
    ...current,
    fixtures: current.fixtures.map((item) => (
      item.id === fixture.id ? { ...item, played: true, result } : item
    )),
    standings: applyResultToStandings(current.standings, result),
    teams: tuneRosterAfterMatch(current.teams, result),
    updatedAt: new Date().toISOString(),
  };
  [
    { teamId: result.homeTeamId, amount: result.winnerTeamId === result.homeTeamId ? 150 : 70 },
    { teamId: result.awayTeamId, amount: result.winnerTeamId === result.awayTeamId ? 150 : 70 },
  ].forEach((reward) => {
    next = addEconLog(next, {
      tag: 'MATCH_REWARD',
      teamId: reward.teamId,
      amount: reward.amount,
      note: `${fixture.id} 경기 상금`,
      meta: {
        matchId: result.matchId,
        winnerTeamId: result.winnerTeamId,
        scoreHome: result.scoreHome,
        scoreAway: result.scoreAway,
      },
    });
  });
  next = addResultLog(next, result);
  return advanceWeekIfNeeded(next);
}

export function simulateWeekAction(state) {
  let next = normalizeState(state);
  const targetWeek = next.week;
  while (!next.ended && next.fixtures.some((fixture) => fixture.round === targetWeek && !fixture.played)) {
    next = simulateNextMatchAction(next);
  }
  return next;
}

export function negotiateSponsorAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 스폰서 협상을 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const rank = rankedIndex(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const rankBonus = Math.max(0, current.teams.length - Math.max(0, rank)) * 14;
  const gain = Math.round(170 + career.sponsorTier * 85 + career.fanBase / 70 + rankBonus);
  const fanGain = Math.round(80 + career.sponsorTier * 25 + Math.max(0, teamPower(teamData, current) - 480) * 0.6);
  const tierGain = rank >= 0 && rank <= 2 && career.sponsorTier < 6 ? 1 : 0;
  const next = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) + gain,
    career: {
      ...career,
      sponsorTier: clamp(career.sponsorTier + tierGain, 1, 6),
      fanBase: career.fanBase + fanGain,
    },
  }));
  return addStateLog(addEconLog(next, {
    tag: 'SPONSOR',
    teamId,
    amount: gain,
    note: '스폰서 협상',
    meta: { fanGain, tierGain },
  }), `${teamData.name} 스폰서 협상: +${gain} Cr, 팬 +${fanGain}${tierGain ? ', 스폰서 등급 상승' : ''}`);
}

export function investTrainingAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 훈련 투자를 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  const cost = Math.round(150 + career.trainingLevel * 95 + teamData.roster.length * 8);
  if (money < cost) {
    return addStateLog(current, `${teamData.name} 훈련 투자 실패: ${cost} Cr 필요, 보유 ${money} Cr`);
  }
  const statGain = 2 + Math.floor(career.trainingLevel / 2);
  const next = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) - cost,
    career: {
      ...career,
      trainingLevel: clamp(career.trainingLevel + 1, 1, 8),
    },
    roster: team.roster.map((member, index) => ({
      ...member,
      condition: clamp(Number(member.condition || 100) + 8, 0, 100),
      fame: Number(member.fame || 0) + (index < 5 ? 5 : 2),
      stats: CAREER_STAT_KEYS.reduce((acc, key) => {
        acc[key] = clamp(Number(member.stats?.[key] || 0) + statGain + (index < 5 ? 1 : 0), 0, 1000);
        return acc;
      }, {}),
    })),
  }));
  return addStateLog(addEconLog(next, {
    tag: 'TRAINING',
    teamId,
    amount: -cost,
    note: '훈련 투자',
    meta: { statGain, trainingLevel: clamp(career.trainingLevel + 1, 1, 8) },
  }), `${teamData.name} 훈련 투자: -${cost} Cr, 훈련 Lv.${clamp(career.trainingLevel + 1, 1, 8)}`);
}

export function signFreeAgentAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 FA 영입을 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (teamData.roster.length >= 12) {
    return addStateLog(current, `${teamData.name} FA 영입 실패: 로스터가 가득 찼습니다.`);
  }
  const offer = makeFreeAgentCandidate(current, teamId, 0);
  if (money < offer.signingBonus) {
    return addStateLog(current, `${teamData.name} FA 영입 실패: ${offer.player.name} 계약금 ${offer.signingBonus} Cr 필요`);
  }
  const career = normalizeTeamCareer(teamData);
  let next = syncTeamEconomy(
    {
      ...current,
      freeAgentSeq: Number(current.freeAgentSeq || 0) + 1,
    },
    teamId,
    (team) => ({
      ...team,
      money: Number(team.money || 0) - offer.signingBonus,
      career: {
        ...career,
        scoutingLevel: clamp(career.scoutingLevel + 1, 1, 8),
        fanBase: career.fanBase + Math.round(offer.player.fame / 4),
        payrollPressure: calcTeamPayroll({ ...team, roster: [...team.roster, offer.player] }),
      },
      roster: [...team.roster, offer.player],
    }),
  );
  next = {
    ...next,
    contracts: {
      ...next.contracts,
      [offer.player.id]: createPlayerContract(offer.player, teamId, current.seasonNo, {
        salary: offer.salary,
        signingBonus: offer.signingBonus,
        yearsLeft: offer.yearsLeft,
        startedSeasonNo: current.seasonNo,
      }),
    },
  };
  return addStateLog(addEconLog(next, {
    tag: 'FA',
    teamId,
    amount: -offer.signingBonus,
    note: `${offer.player.name} FA 계약금`,
    meta: { playerId: offer.player.id, playerName: offer.player.name, salary: offer.salary, yearsLeft: offer.yearsLeft },
  }), `${teamData.name} FA 영입: ${offer.player.name} 계약금 -${offer.signingBonus} Cr, 연봉 ${offer.salary} Cr/${offer.yearsLeft}년`);
}

export function startNextSeasonAction(state) {
  const current = normalizeState(state);
  const next = createNewState();
  const nextSeasonNo = Number(current.seasonNo || 1) + 1;
  const payrollByTeam = new Map();
  const carriedTeams = current.teams.map((teamData) => {
    const career = normalizeTeamCareer(teamData);
    const standing = getStanding(current, teamData.id);
    const payroll = teamPayrollFromContracts(current.contracts, teamData);
    payrollByTeam.set(teamData.id, payroll);
    const moneyAfterPayroll = Number(standing?.money ?? teamData.money ?? 0) - payroll;
    return cloneTeam({
      ...teamData,
      money: moneyAfterPayroll,
      career: {
        ...career,
        fanBase: Math.round(career.fanBase * 1.04),
        payrollPressure: payroll,
      },
      roster: teamData.roster.map((member) => ({
        ...member,
        condition: clamp(Number(member.condition || 100) + (moneyAfterPayroll >= 0 ? 18 : -8), 30, 100),
        fame: Math.max(0, Number(member.fame || 0) + (current.championTeamId === teamData.id ? 24 : 8)),
      })),
    });
  });
  const fixtures = generateSchedule(carriedTeams);
  let rolledContracts = ensureContractsForTeams(carriedTeams, current.contracts, nextSeasonNo);
  rolledContracts = Object.fromEntries(Object.entries(rolledContracts).map(([playerId, contract]) => [
    playerId,
    {
      ...contract,
      yearsLeft: Math.max(1, Number(contract.yearsLeft || 2) - 1),
      salary: Math.max(10, Number(contract.salary || 0) + (Number(contract.yearsLeft || 2) <= 1 ? 4 : 0)),
    },
  ]));
  let nextState = {
    ...next,
    runId: current.runId,
    startedAt: current.startedAt,
    seasonNo: nextSeasonNo,
    teams: carriedTeams,
    fixtures,
    standings: createStandings(carriedTeams),
    contracts: rolledContracts,
    inventories: createInventories(carriedTeams, current.inventories),
    econLogs: normalizeEconLogs(current.econLogs),
    seasonReports: Array.isArray(current.seasonReports) ? current.seasonReports.slice(0, 60) : [],
    freeAgentSeq: Number(current.freeAgentSeq || 0),
    log: [`시즌 ${Number(current.seasonNo || 1) + 1}이 새로 시작됐습니다.`, ...current.log].slice(0, 90),
  };
  nextState = {
    ...nextState,
    shop: ensureShop(nextState),
  };
  payrollByTeam.forEach((payroll, teamId) => {
    if (payroll <= 0) return;
    nextState = addEconLog(nextState, {
      tag: 'PAYROLL',
      teamId,
      amount: -payroll,
      seasonNo: nextSeasonNo,
      week: 0,
      note: `시즌 ${nextSeasonNo} 연봉 지급`,
      meta: { payroll, rosterCount: getTeam(current, teamId).roster.length },
    });
  });
  return nextState;
}

export function getTopTeams(state, limit = 10) {
  const current = normalizeState(state);
  return current.standings
    .map((row) => {
      const teamData = getTeam(current, row.teamId);
      return {
        ...row,
        teamName: teamData.name,
        coach: teamData.coach,
        diff: Number(row.mapWins || 0) - Number(row.mapLosses || 0),
      };
    })
    .sort((a, b) => (
      b.wins - a.wins
      || b.diff - a.diff
      || b.mapWins - a.mapWins
      || a.teamName.localeCompare(b.teamName, 'ko-KR')
    ))
    .slice(0, limit);
}

export function getTopPlayers(state, limit = 12) {
  const current = normalizeState(state);
  const records = new Map();

  current.teams.forEach((teamData) => {
    teamData.roster.forEach((member) => {
      records.set(member.id, {
        playerId: member.id,
        playerName: member.name,
        teamId: teamData.id,
        teamName: teamData.name,
        race: member.race,
        level: Number(member.level || 0),
        condition: Number(member.condition || 0),
        fame: Number(member.fame || 0),
        skill: Math.round(averageStats(teamWithEquipment(current, teamData).roster.find((row) => row.id === member.id) || member)),
        matchWins: 0,
        matchLosses: 0,
        setWins: 0,
        setLosses: 0,
      });
    });
  });

  current.fixtures.forEach((fixture) => {
    const result = fixture.result;
    if (!fixture.played || !result) return;
    const homePlayers = new Set();
    const awayPlayers = new Set();
    result.sets.forEach((setResult) => {
      if (setResult.homePlayerId) homePlayers.add(setResult.homePlayerId);
      if (setResult.awayPlayerId) awayPlayers.add(setResult.awayPlayerId);

      const homeRecord = records.get(setResult.homePlayerId);
      const awayRecord = records.get(setResult.awayPlayerId);
      if (homeRecord) {
        if (setResult.winnerPlayerId === setResult.homePlayerId) homeRecord.setWins += 1;
        else homeRecord.setLosses += 1;
      }
      if (awayRecord) {
        if (setResult.winnerPlayerId === setResult.awayPlayerId) awayRecord.setWins += 1;
        else awayRecord.setLosses += 1;
      }
    });

    homePlayers.forEach((playerId) => {
      const record = records.get(playerId);
      if (!record) return;
      if (result.winnerTeamId === result.homeTeamId) record.matchWins += 1;
      else record.matchLosses += 1;
    });
    awayPlayers.forEach((playerId) => {
      const record = records.get(playerId);
      if (!record) return;
      if (result.winnerTeamId === result.awayTeamId) record.matchWins += 1;
      else record.matchLosses += 1;
    });
  });

  return [...records.values()]
    .map((record) => {
      const matchDiff = record.matchWins - record.matchLosses;
      const setDiff = record.setWins - record.setLosses;
      const winRate = record.matchWins + record.matchLosses
        ? Math.round((record.matchWins / (record.matchWins + record.matchLosses)) * 100)
        : 0;
      const score = Math.round(
        record.skill
        + record.matchWins * 120
        + record.setWins * 20
        + record.level * 40
        + record.fame * 2
        + setDiff * 12
        + matchDiff * 35,
      );
      return {
        ...record,
        matchDiff,
        setDiff,
        winRate,
        score,
      };
    })
    .sort((a, b) => (
      b.score - a.score
      || b.matchWins - a.matchWins
      || b.setDiff - a.setDiff
      || a.playerName.localeCompare(b.playerName, 'ko-KR')
    ))
    .slice(0, limit);
}

export function getCurrentFixtures(state) {
  const current = normalizeState(state);
  return current.fixtures.filter((fixture) => fixture.round === current.week);
}

export function fixtureLabel(state, fixture) {
  const result = fixture.result;
  if (!result) return `${teamName(state, fixture.homeTeamId)} vs ${teamName(state, fixture.awayTeamId)}`;
  return `${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName}`;
}

export function getPlayedCount(state) {
  return normalizeState(state).fixtures.filter((fixture) => fixture.played).length;
}

export function getTotalFixtureCount(state) {
  return normalizeState(state).fixtures.length;
}

export function scoreState(state) {
  const current = normalizeState(state);
  const leader = getTopTeams(current, 1)[0];
  const careerScore = current.teams.reduce((sum, teamData) => {
    const career = normalizeTeamCareer(teamData);
    return sum + career.sponsorTier * 80 + career.trainingLevel * 55 + career.scoutingLevel * 45 + career.fanBase / 90;
  }, 0);
  const itemScore = createInventories(current.teams, current.inventories).reduce((sum, inventory) => {
    const owned = inventory.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0);
    const equipped = Object.values(inventory.equipped || {}).reduce((slotSum, slots) => slotSum + Object.values(slots || {}).filter(Boolean).length, 0);
    return sum + owned * 8 + equipped * 28;
  }, 0);
  return Math.max(0, Math.round(
    getPlayedCount(current) * 35
    + Number(leader?.wins || 0) * 180
    + Number(leader?.diff || 0) * 24
    + current.standings.reduce((sum, row) => sum + Number(row.money || 0), 0) / 12
    + careerScore
    + itemScore
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const leader = getTopTeams(current, 1)[0];
  return {
    seasonNo: current.seasonNo,
    week: current.week,
    played: getPlayedCount(current),
    total: getTotalFixtureCount(current),
    leader: leader?.teamName || '',
    champion: current.championTeamId ? teamName(current, current.championTeamId) : '',
    teams: current.teams.length,
    careerValue: Math.round(current.teams.reduce((sum, teamData) => {
      const career = normalizeTeamCareer(teamData);
      return sum + career.fanBase + career.sponsorTier * 250 + career.trainingLevel * 180 + career.scoutingLevel * 140;
    }, 0)),
    econLogs: normalizeEconLogs(current.econLogs).length,
    seasonReports: Array.isArray(current.seasonReports) ? current.seasonReports.length : 0,
    inventoryItems: createInventories(current.teams, current.inventories).reduce((sum, inventory) => (
      sum + inventory.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0)
    ), 0),
    score: scoreState(current),
  };
}

export function teamPower(teamData, state = null) {
  const resolvedTeam = state ? teamWithEquipment(normalizeState(state), teamData) : teamData;
  if (!resolvedTeam?.roster?.length) return 0;
  const sorted = [...resolvedTeam.roster]
    .sort((a, b) => averageStats(b) - averageStats(a))
    .slice(0, 5);
  return Math.round(sorted.reduce((sum, member) => sum + averageStats(member), 0) / sorted.length);
}
