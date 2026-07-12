export const GAME_SLUG = 'schale-idle-rpg';
export const QUICK_SAVE_SLOT = 'schale-idle-rpg-main';
export const SAVE_VERSION = 'schale-idle-rpg-v2';

export const STUDENTS = [
  {
    id: 'stu_noa',
    name: '노아',
    lines: {
      clear: '정리됐네요. 다음 구역으로 넘어가요.',
      boss: '계획대로예요. 선생님이 안 보셔도요.',
      fail: '상황 재정의가 필요해요. 다시 짜죠.',
    },
  },
  {
    id: 'stu_hina',
    name: '히나',
    lines: {
      clear: '문제없어. 계속 가자.',
      boss: '끝났어. 다음 임무로.',
      fail: '후퇴. 다시 간다.',
    },
  },
];

export const ITEMS = [
  { id: 'itm_scrap', name: '고철 조각', rarity: 'COMMON', sellValue: 1, stackable: true },
  { id: 'itm_bandage', name: '붕대', rarity: 'COMMON', sellValue: 2, stackable: true },
  { id: 'itm_battery', name: '소형 배터리', rarity: 'UNCOMMON', sellValue: 4, stackable: true },
  { id: 'itm_optic_lens', name: '광학 렌즈', rarity: 'UNCOMMON', sellValue: 5, stackable: true },
  { id: 'itm_alloy_plate', name: '합금 플레이트', rarity: 'RARE', sellValue: 12, stackable: true },
  { id: 'itm_servo_joint', name: '서보 조인트', rarity: 'RARE', sellValue: 14, stackable: true },
  { id: 'itm_encrypted_chip', name: '암호화 칩', rarity: 'EPIC', sellValue: 35, stackable: true },
  { id: 'itm_titan_core', name: '타이탄 코어 파편', rarity: 'EPIC', sellValue: 45, stackable: true },
  { id: 'itm_memory_chip', name: '메모리 칩', rarity: 'RARE', sellValue: 22, stackable: true },
  { id: 'itm_enhance_stone', name: '강화석', rarity: 'RARE', sellValue: 35, stackable: true },
  { id: 'itm_protect_ticket', name: '만능 강화 보호권', rarity: 'UNCOMMON', sellValue: 18, stackable: true },
  { id: 'itm_protect_downgrade', name: '하락 방지권', rarity: 'UNCOMMON', sellValue: 20, stackable: true },
  { id: 'itm_protect_destroy', name: '파괴 방지권', rarity: 'RARE', sellValue: 45, stackable: true },
  { id: 'itm_tower_key', name: '시련의 탑 열쇠', rarity: 'RARE', sellValue: 30, stackable: true },
  { id: 'itm_tower_token', name: '시련 토큰', rarity: 'RARE', sellValue: 12, stackable: true },
  { id: 'itm_reroll_ticket', name: '옵션 리롤권', rarity: 'EPIC', sellValue: 45, stackable: true },
  { id: 'itm_protect_charm', name: '강화 보호 부적', rarity: 'EPIC', sellValue: 55, stackable: true },
  { id: 'eq_rusty_rifle', name: '녹슨 소총', rarity: 'UNCOMMON', stackable: false, equip: { slot: 'WEAPON', powerAdd: 55, powerMul: 1.05 } },
  { id: 'eq_field_armor', name: '현장 방호복', rarity: 'UNCOMMON', stackable: false, equip: { slot: 'ARMOR', powerAdd: 30, staminaMul: 1.08 } },
  { id: 'eq_lucky_charm', name: '행운 부적', rarity: 'RARE', stackable: false, equip: { slot: 'ACCESSORY_1', powerMul: 1.06 } },
  { id: 'eq_spare_battery_pack', name: '예비 배터리 팩', rarity: 'UNCOMMON', stackable: false, equip: { slot: 'ACCESSORY_2', staminaMul: 1.12 } },
  { id: 'eq_shale_badge', name: '샬레 휘장', rarity: 'EPIC', stackable: false, equip: { slot: 'RELIC', powerMul: 1.1, staminaMul: 1.1 } },
  { id: 'eq_tower_relic_alpha', name: '시련의 유물-알파', rarity: 'RARE', stackable: false, equip: { slot: 'RELIC', powerAdd: 18, powerMul: 1.06, staminaMul: 1.04 } },
  { id: 'eq_tower_relic_beta', name: '시련의 유물-베타', rarity: 'EPIC', stackable: false, equip: { slot: 'RELIC', powerAdd: 26, powerMul: 1.09, staminaMul: 1.05 } },
  { id: 'eq_tower_relic_omega', name: '시련의 유물-오메가', rarity: 'EPIC', stackable: false, equip: { slot: 'RELIC', powerAdd: 34, powerMul: 1.12, staminaMul: 1.06 } },
];

export const RECIPES = [
  { id: 'rcp_rusty_rifle', name: '녹슨 소총 제작', credits: 120, requires: { itm_scrap: 25, itm_battery: 2 }, produces: { itemId: 'eq_rusty_rifle', qty: 1 } },
  { id: 'rcp_field_armor', name: '현장 방호복 제작', credits: 110, requires: { itm_scrap: 22, itm_bandage: 5 }, produces: { itemId: 'eq_field_armor', qty: 1 } },
  { id: 'rcp_lucky_charm', name: '행운 부적 제작', credits: 160, requires: { itm_scrap: 30, itm_memory_chip: 2 }, produces: { itemId: 'eq_lucky_charm', qty: 1 } },
  { id: 'rcp_spare_battery_pack', name: '예비 배터리 팩 제작', credits: 140, requires: { itm_scrap: 18, itm_battery: 3 }, produces: { itemId: 'eq_spare_battery_pack', qty: 1 } },
  { id: 'rcp_shale_badge', name: '샬레 휘장 제작', credits: 300, requires: { itm_scrap: 55, itm_memory_chip: 3, itm_battery: 4 }, produces: { itemId: 'eq_shale_badge', qty: 1 } },
  { id: 'rcp_enhance_stone', name: '강화석 제작', credits: 90, requires: { itm_scrap: 16, itm_battery: 1 }, produces: { itemId: 'itm_enhance_stone', qty: 1 } },
  { id: 'rcp_protect_ticket', name: '강화 보호권 제작', credits: 120, requires: { itm_memory_chip: 2, itm_battery: 2, itm_scrap: 10 }, produces: { itemId: 'itm_protect_ticket', qty: 1 } },
  { id: 'rcp_protect_downgrade', name: '하락 방지권 제작', credits: 180, requires: { itm_scrap: 60, itm_memory_chip: 10 }, produces: { itemId: 'itm_protect_downgrade', qty: 1 } },
  { id: 'rcp_protect_destroy', name: '파괴 방지권 제작', credits: 420, requires: { itm_scrap: 120, itm_memory_chip: 30, itm_battery: 10 }, produces: { itemId: 'itm_protect_destroy', qty: 1 } },
  { id: 'rcp_tower_key', name: '시련의 탑 열쇠 제작', credits: 260, requires: { itm_scrap: 80, itm_battery: 20 }, produces: { itemId: 'itm_tower_key', qty: 1 } },
];

export const UPGRADE_DEFS = [
  { id: 'UPG_FIREPOWER', name: '화력 연구', powerMulPerLevel: 0.05 },
  { id: 'UPG_ARMOR', name: '방호 정비', powerMulPerLevel: 0.03 },
  { id: 'UPG_LOGISTICS', name: '보급/피로 관리', powerMulPerLevel: 0.01, staminaMulPerLevel: 0.05 },
];

export const UPGRADE_COST_PARAMS = {
  UPG_FIREPOWER: {
    baseCredits: 60,
    growth: 1.35,
    baseItems: { itm_scrap: 12, itm_battery: 1 },
  },
  UPG_ARMOR: {
    baseCredits: 55,
    growth: 1.33,
    baseItems: { itm_scrap: 10, itm_bandage: 2 },
  },
  UPG_LOGISTICS: {
    baseCredits: 50,
    growth: 1.3,
    baseItems: { itm_scrap: 8, itm_battery: 1 },
  },
};

export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const OFFLINE_WAVE_MS = 60 * 1000;

export const TOWER = {
  id: 'tower_trial',
  name: '시련의 탑',
  maxFloor: 200,
  D0: 120,
  growth: 0.075,
  bossMul: 3.6,
  R0: 70,
  rewardGrowth: 0.075,
  milestoneEvery: 10,
};

export const TOWER_SHOP_OFFERS = [
  {
    id: 'offer_key_bundle',
    name: '열쇠 묶음(5개)',
    cost: { itemId: 'itm_tower_token', qty: 3 },
    reward: { type: 'STACK', itemId: 'itm_tower_key', qty: 5 },
    limit: { period: 'DAILY', max: 5 },
  },
  {
    id: 'offer_enhance_stone_pack',
    name: '강화석 팩(3개)',
    cost: { itemId: 'itm_tower_token', qty: 4 },
    reward: { type: 'STACK', itemId: 'itm_enhance_stone', qty: 3 },
    limit: { period: 'DAILY', max: 3 },
  },
  {
    id: 'offer_relic_roll',
    name: '탑 유물 뽑기(1개)',
    cost: { itemId: 'itm_tower_token', qty: 18 },
    reward: { type: 'RANDOM_EQUIP', pool: ['eq_tower_relic_alpha', 'eq_tower_relic_beta', 'eq_tower_relic_omega'], qty: 1 },
    limit: { period: 'WEEKLY', max: 10 },
  },
  {
    id: 'offer_reroll_ticket',
    name: '옵션 리롤권(1개)',
    cost: { itemId: 'itm_tower_token', qty: 12 },
    reward: { type: 'STACK', itemId: 'itm_reroll_ticket', qty: 1 },
    limit: { period: 'DAILY', max: 2 },
  },
  {
    id: 'offer_protect_charm',
    name: '강화 보호 부적(1개)',
    cost: { itemId: 'itm_tower_token', qty: 15 },
    reward: { type: 'STACK', itemId: 'itm_protect_charm', qty: 1 },
    limit: { period: 'WEEKLY', max: 5 },
  },
  {
    id: 'offer_scrap_pack',
    name: '부품 팩(200)',
    cost: { itemId: 'itm_tower_token', qty: 2 },
    reward: { type: 'STACK', itemId: 'itm_scrap', qty: 200 },
    limit: { period: 'DAILY', max: 10 },
  },
  {
    id: 'offer_battery_pack',
    name: '배터리 팩(3)',
    cost: { itemId: 'itm_tower_token', qty: 3 },
    reward: { type: 'STACK', itemId: 'itm_battery', qty: 3 },
    limit: { period: 'DAILY', max: 5 },
  },
  {
    id: 'offer_key_bundle_10',
    name: '열쇠 묶음(10개)',
    cost: { itemId: 'itm_tower_token', qty: 5 },
    reward: { type: 'STACK', itemId: 'itm_tower_key', qty: 10 },
    limit: { period: 'WEEKLY', max: 10 },
  },
];

export const TOWER_SHOP_ROTATION = {
  dailyPick: 4,
  weeklyPick: 3,
  dailyResetCost: 8,
  dailyResetMax: 3,
  weeklyResetCost: 20,
  weeklyResetMax: 1,
  dailyPool: ['offer_key_bundle', 'offer_enhance_stone_pack', 'offer_reroll_ticket', 'offer_scrap_pack', 'offer_battery_pack', 'offer_protect_charm'],
  weeklyPool: ['offer_relic_roll', 'offer_protect_charm', 'offer_key_bundle_10', 'offer_reroll_ticket'],
  weeklyFixedOfferIds: ['offer_relic_roll'],
  avoidCrossOverlap: true,
  crossOverlapPriority: 'WEEKLY',
  dailyBuckets: [
    { id: 'keys', pick: 1, pool: ['offer_key_bundle', 'offer_key_bundle_10'] },
    { id: 'supply', pick: 1, pool: ['offer_scrap_pack', 'offer_battery_pack', 'offer_enhance_stone_pack'] },
    { id: 'utility', pick: 1, pool: ['offer_reroll_ticket', 'offer_protect_charm'] },
  ],
  weeklyBuckets: [
    { id: 'keys', pick: 1, pool: ['offer_key_bundle_10', 'offer_key_bundle'] },
    { id: 'utility', pick: 1, pool: ['offer_protect_charm', 'offer_reroll_ticket', 'offer_enhance_stone_pack'] },
  ],
  dailyPity: { trigger: 3, guaranteedOfferIds: ['offer_protect_charm', 'offer_reroll_ticket'] },
  weeklyPity: { trigger: 2, guaranteedOfferIds: ['offer_enhance_stone_pack', 'offer_protect_charm'] },
};

export const MISSIONS = [
  { id: 'd_clear_30', type: 'daily', name: '일일 당직: 웨이브 30층 정산', action: 'CLEAR_FLOOR', target: 30, rewardCredits: 300, rewardItems: [{ itemId: 'itm_scrap', qty: 60 }] },
  { id: 'd_tower_5', type: 'daily', name: '일일 도전: 시련의 탑 5회', action: 'ATTEMPT_TOWER', target: 5, rewardCredits: 260, rewardItems: [{ itemId: 'itm_tower_key', qty: 1 }] },
  { id: 'd_enh_3', type: 'daily', name: '일일 강화: 강화 3회 시도', action: 'ENHANCE_TRY', target: 3, rewardCredits: 220, rewardItems: [{ itemId: 'itm_memory_chip', qty: 20 }] },
  { id: 'd_craft_2', type: 'daily', name: '일일 제작: 제작 2회', action: 'CRAFT', target: 2, rewardCredits: 180, rewardItems: [{ itemId: 'itm_bandage', qty: 10 }] },
  { id: 'w_clear_300', type: 'weekly', name: '주간 당직: 웨이브 300층', action: 'CLEAR_FLOOR', target: 300, rewardCredits: 2200, rewardItems: [{ itemId: 'itm_scrap', qty: 600 }, { itemId: 'itm_tower_key', qty: 5 }] },
  { id: 'w_boss_10', type: 'weekly', name: '주간 토벌: 보스 10회', action: 'KILL_BOSS', target: 10, rewardCredits: 1800, rewardItems: [{ itemId: 'itm_tower_key', qty: 3 }] },
  { id: 'w_tower_clear_20', type: 'weekly', name: '주간 등반: 탑 20층 클리어', action: 'CLEAR_TOWER', target: 20, rewardCredits: 2000, rewardItems: [{ itemId: 'itm_tower_key', qty: 3 }] },
];

export const SEASON_REWARD_TABLE = [
  {
    id: 'season_supply_20',
    seasonPct: 20,
    name: '시즌 보급 I',
    desc: '초반 정산 루프를 밀어주는 기본 재료 보급입니다.',
    rewardCredits: 800,
    rewardItems: [{ itemId: 'itm_scrap', qty: 160 }, { itemId: 'itm_bandage', qty: 20 }],
  },
  {
    id: 'season_tower_40',
    seasonPct: 40,
    name: '시즌 탑 도전권',
    desc: '중반 탑 등반을 위한 열쇠와 강화 재료 묶음입니다.',
    rewardCredits: 1200,
    rewardItems: [{ itemId: 'itm_tower_key', qty: 4 }, { itemId: 'itm_enhance_stone', qty: 3 }],
  },
  {
    id: 'season_upgrade_60',
    seasonPct: 60,
    name: '시즌 정비 키트',
    desc: '장비 옵션과 강화 안전성을 보강하는 정비 패키지입니다.',
    rewardCredits: 1800,
    rewardItems: [{ itemId: 'itm_reroll_ticket', qty: 2 }, { itemId: 'itm_protect_ticket', qty: 2 }, { itemId: 'itm_memory_chip', qty: 40 }],
  },
  {
    id: 'season_relic_80',
    seasonPct: 80,
    name: '시즌 유물 정비권',
    desc: '후반 유물 파밍과 옵션 정비를 위한 토큰 보상입니다.',
    rewardCredits: 2600,
    rewardItems: [{ itemId: 'itm_tower_token', qty: 20 }, { itemId: 'itm_reroll_ticket', qty: 3 }, { itemId: 'itm_protect_charm', qty: 1 }],
  },
  {
    id: 'season_archive_100',
    seasonPct: 100,
    name: '시즌 완주 기록',
    desc: '장기 당직 시즌을 완주한 계정 성장 보상입니다.',
    rewardCredits: 4200,
    rewardItems: [{ itemId: 'itm_tower_token', qty: 35 }, { itemId: 'itm_protect_charm', qty: 2 }, { itemId: 'itm_enhance_stone', qty: 8 }],
  },
];

export const ITEM_LOOKUP = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
export const SLOT_LABELS = {
  WEAPON: '무기',
  ARMOR: '방어구',
  ACCESSORY_1: '장신구 1',
  ACCESSORY_2: '장신구 2',
  RELIC: '유물',
};

export const RARITY_RANK = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
};

export const AFFIX_COUNT_BY_RARITY = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
};

export const AFFIX_TEMPLATES = [
  {
    id: 'AFF_FIREPOWER',
    label: '화력 보정',
    stat: 'POWER_ADD_MUL',
    range: {
      COMMON: [0.95, 1.05],
      UNCOMMON: [0.97, 1.1],
      RARE: [1, 1.15],
      EPIC: [1.05, 1.25],
    },
  },
  {
    id: 'AFF_TACTICS',
    label: '전술 증폭',
    stat: 'POWER_MUL_MUL',
    range: {
      COMMON: [1, 1.01],
      UNCOMMON: [1, 1.02],
      RARE: [1, 1.03],
      EPIC: [1.01, 1.05],
    },
  },
  {
    id: 'AFF_ENDURANCE',
    label: '스태미나 관리',
    stat: 'STAMINA_MUL_MUL',
    range: {
      COMMON: [1, 1.02],
      UNCOMMON: [1, 1.03],
      RARE: [1, 1.04],
      EPIC: [1.01, 1.06],
    },
  },
  {
    id: 'AFF_CALIBRATION',
    label: '교정 튜닝',
    stat: 'GLOBAL_MUL',
    range: {
      COMMON: [1, 1.005],
      UNCOMMON: [1.003, 1.01],
      RARE: [1.006, 1.018],
      EPIC: [1.01, 1.03],
    },
  },
];

export const TITLES = [
  { id: 'title_rookie', name: '신입 당번', desc: '크레딧 획득 +1%', kind: 'REWARD_MUL', mul: 1.01 },
  { id: 'title_tower', name: '탑 등반가', desc: '크레딧 획득 +2%', kind: 'REWARD_MUL', mul: 1.02 },
  { id: 'title_smith', name: '장비 장인', desc: '전투력 +2%', kind: 'POWER_MUL', mul: 1.02 },
  { id: 'title_veteran', name: '베테랑 당번', desc: '크레딧 획득 +3%', kind: 'REWARD_MUL', mul: 1.03 },
  { id: 'title_boss_hunter', name: '보스 헌터', desc: '전투력 +3%', kind: 'POWER_MUL', mul: 1.03 },
];

export const ACHIEVEMENTS = [
  {
    id: 'ach_floor_20',
    name: '현장 적응',
    desc: '메인 스테이지 20층 클리어',
    rewardCredits: 2000,
    unlockTitleId: 'title_rookie',
    action: 'MAX_FLOOR',
    target: 20,
  },
  {
    id: 'ach_tower_10',
    name: '초급 등반',
    desc: '시련의 탑 10층 클리어',
    rewardCredits: 3000,
    unlockTitleId: 'title_tower',
    action: 'MAX_TOWER',
    target: 10,
  },
  {
    id: 'ach_enhance_5',
    name: '강화 첫 발',
    desc: '강화 +5 장비 1개 보유',
    rewardCredits: 2500,
    unlockTitleId: 'title_smith',
    action: 'ENHANCED_EQUIP',
    target: 5,
  },
  {
    id: 'ach_clear_200',
    name: '꾸준한 당번',
    desc: '메인 웨이브 200회 클리어',
    rewardCredits: 4000,
    action: 'CLEAR_FLOOR',
    target: 200,
  },
  {
    id: 'ach_boss_30',
    name: '보스 처리반',
    desc: '보스/중간보스 30회 처치',
    rewardCredits: 5000,
    action: 'KILL_BOSS',
    target: 30,
  },
  {
    id: 'ach_earn_50k',
    name: '재정 담당',
    desc: '크레딧 50,000 획득',
    rewardCredits: 4500,
    action: 'EARN_CREDITS',
    target: 50000,
  },
  {
    id: 'ach_clear_500',
    name: '장기 근무',
    desc: '메인 웨이브 500회 클리어',
    rewardCredits: 8000,
    unlockTitleId: 'title_veteran',
    action: 'CLEAR_FLOOR',
    target: 500,
  },
  {
    id: 'ach_boss_100',
    name: '특수임무 숙련자',
    desc: '보스/중간보스 100회 처치',
    rewardCredits: 9000,
    unlockTitleId: 'title_boss_hunter',
    action: 'KILL_BOSS',
    target: 100,
  },
];
