export const GAME_SLUG = 'schale-idle-rpg';
export const QUICK_SAVE_SLOT = 'schale-idle-rpg-main';
export const SAVE_VERSION = 'schale-idle-rpg-v1';

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

const UPGRADE_COST_PARAMS = {
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

const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const OFFLINE_WAVE_MS = 60 * 1000;

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

const TOWER_SHOP_ROTATION = {
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

const ITEM_LOOKUP = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
const SLOT_LABELS = {
  WEAPON: '무기',
  ARMOR: '방어구',
  ACCESSORY_1: '장신구 1',
  ACCESSORY_2: '장신구 2',
  RELIC: '유물',
};

const RARITY_RANK = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
};

const AFFIX_COUNT_BY_RARITY = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
};

const AFFIX_TEMPLATES = [
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

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `sir-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    leaderStudentId: 'stu_noa',
    floor: 1,
    maxClearedFloor: 0,
    towerFloor: 1,
    towerMaxCleared: 0,
    towerLossStreak: 0,
    credits: 720,
    stamina: 100,
    basePower: 180,
    upgrades: defaultUpgrades(),
    equipment: {},
    equipmentPresets: [],
    activePresetId: '',
    inventory: {
      itm_scrap: 80,
      itm_bandage: 12,
      itm_battery: 6,
      itm_memory_chip: 3,
      itm_enhance_stone: 3,
      itm_tower_key: 5,
      itm_reroll_ticket: 1,
    },
    salvageQueue: [],
    salvageSettings: {
      candidateOnly: true,
    },
    towerShop: {
      dailyKey: '',
      dailyBought: {},
      weeklyKey: '',
      weeklyBought: {},
      seed: 0,
      rotation: null,
    },
    counters: {
      CLEAR_FLOOR: 0,
      KILL_BOSS: 0,
      ATTEMPT_TOWER: 0,
      CLEAR_TOWER: 0,
      CRAFT: 0,
      ENHANCE_TRY: 0,
      ENHANCE_SUCCESS: 0,
      REROLL: 0,
      SALVAGE: 0,
      SHOP_BUY: 0,
      UPGRADE: 0,
    },
    claimedMissions: [],
    lifetimeCounters: {},
    achievementClaims: {},
    unlockedTitleIds: [],
    equippedTitleId: null,
    lastDutyReport: null,
    towerLastBatchReport: null,
    lastSavedAt: now,
    offlineLastSummary: null,
    log: ['샬레 당직이 시작됐습니다. 방치 정산으로 층을 밀고, 재료를 모아 장비를 제작하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const equipment = normalizeEquipmentMap(value.equipment && typeof value.equipment === 'object' ? value.equipment : base.equipment);
  const towerShop = normalizeTowerShop(value.towerShop, base.towerShop);
  return {
    ...base,
    ...value,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    upgrades: normalizeUpgrades(value.upgrades),
    equipment,
    equipmentPresets: normalizeEquipmentPresets(value.equipmentPresets),
    activePresetId: typeof value.activePresetId === 'string' ? value.activePresetId : '',
    salvageQueue: Array.isArray(value.salvageQueue) ? value.salvageQueue.slice(0, 40) : base.salvageQueue,
    salvageSettings: normalizeSalvageSettings(value.salvageSettings, base.salvageSettings),
    towerShop,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    claimedMissions: Array.isArray(value.claimedMissions) ? value.claimedMissions : base.claimedMissions,
    lifetimeCounters: value.lifetimeCounters && typeof value.lifetimeCounters === 'object' ? normalizeCounters(value.lifetimeCounters) : base.lifetimeCounters,
    achievementClaims: value.achievementClaims && typeof value.achievementClaims === 'object' ? { ...value.achievementClaims } : base.achievementClaims,
    unlockedTitleIds: Array.isArray(value.unlockedTitleIds) ? Array.from(new Set(value.unlockedTitleIds.filter((item) => typeof item === 'string'))) : base.unlockedTitleIds,
    equippedTitleId: typeof value.equippedTitleId === 'string' ? value.equippedTitleId : null,
    lastDutyReport: value.lastDutyReport && typeof value.lastDutyReport === 'object' ? value.lastDutyReport : base.lastDutyReport,
    towerLastBatchReport: value.towerLastBatchReport && typeof value.towerLastBatchReport === 'object' ? value.towerLastBatchReport : base.towerLastBatchReport,
    lastSavedAt: typeof value.lastSavedAt === 'string' ? value.lastSavedAt : (typeof value.updatedAt === 'string' ? value.updatedAt : base.lastSavedAt),
    offlineLastSummary: value.offlineLastSummary && typeof value.offlineLastSummary === 'object' ? value.offlineLastSummary : base.offlineLastSummary,
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

export function getItem(id) {
  return ITEM_LOOKUP[id] || null;
}

export function itemName(id) {
  return getItem(id)?.name || id;
}

export function slotLabel(slot) {
  return SLOT_LABELS[slot] || slot;
}

export function getLeader(state) {
  return STUDENTS.find((student) => student.id === state.leaderStudentId) || STUDENTS[0];
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 90),
  };
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

function hash32(value) {
  let hash = 2166136261;
  String(value || '').split('').forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addItem(inventory, itemId, qty) {
  return {
    ...inventory,
    [itemId]: Math.max(0, Number(inventory[itemId] || 0) + Number(qty || 0)),
  };
}

function addItems(inventory, rewards = []) {
  return rewards.reduce((next, reward) => addItem(next, reward.itemId, reward.qty), inventory);
}

function hasItems(inventory, needs = {}) {
  return Object.entries(needs).every(([itemId, qty]) => Number(inventory[itemId] || 0) >= Number(qty || 0));
}

function spendItems(inventory, needs = {}) {
  return Object.entries(needs).reduce((next, [itemId, qty]) => addItem(next, itemId, -qty), inventory);
}

function bumpCounter(counters, action, amount = 1) {
  return {
    ...counters,
    [action]: Number(counters[action] || 0) + Number(amount || 0),
  };
}

function normalizeCounters(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, amount]) => [
    key,
    Math.max(0, Math.floor(Number(amount || 0))),
  ]));
}

function defaultUpgrades() {
  return Object.fromEntries(UPGRADE_DEFS.map((upgrade) => [upgrade.id, 0]));
}

function normalizeUpgrades(value = {}) {
  const base = defaultUpgrades();
  return Object.fromEntries(UPGRADE_DEFS.map((upgrade) => [
    upgrade.id,
    Math.max(0, Math.floor(Number(value?.[upgrade.id] ?? base[upgrade.id] ?? 0))),
  ]));
}

function upgradeCost(id, nextLevel) {
  const params = UPGRADE_COST_PARAMS[id] || UPGRADE_COST_PARAMS.UPG_FIREPOWER;
  const level = Math.max(1, Math.floor(Number(nextLevel || 1)));
  const scale = Math.pow(Number(params.growth || 1.3), level - 1);
  const items = Object.fromEntries(Object.entries(params.baseItems || {}).map(([itemId, qty]) => [
    itemId,
    Math.max(1, Math.ceil(Number(qty || 0) * scale)),
  ]));
  return {
    credits: Math.max(1, Math.ceil(Number(params.baseCredits || 0) * scale)),
    items,
  };
}

function upgradeMultipliers(upgrades = {}) {
  return UPGRADE_DEFS.reduce((next, def) => {
    const level = Math.max(0, Math.floor(Number(upgrades?.[def.id] || 0)));
    return {
      powerMul: next.powerMul * (1 + Number(def.powerMulPerLevel || 0) * level),
      staminaMul: next.staminaMul * (1 + Number(def.staminaMulPerLevel || 0) * level),
    };
  }, { powerMul: 1, staminaMul: 1 });
}

function bumpLifetimeCounter(state, action, amount = 1) {
  return {
    ...state,
    lifetimeCounters: bumpCounter(normalizeCounters(state.lifetimeCounters), action, amount),
  };
}

function addLifetimeCounters(state, entries = {}) {
  return Object.entries(entries).reduce((next, [action, amount]) => (
    Number(amount || 0) > 0 ? bumpLifetimeCounter(next, action, amount) : next
  ), state);
}

function rarityRank(rarity) {
  return RARITY_RANK[rarity] || RARITY_RANK.COMMON;
}

function defaultRolls() {
  return {
    powerAddMul: 1,
    powerMulMul: 1,
    staminaMulMul: 1,
  };
}

function normalizeRolls(rolls) {
  return {
    powerAddMul: Number(rolls?.powerAddMul || 1),
    powerMulMul: Number(rolls?.powerMulMul || 1),
    staminaMulMul: Number(rolls?.staminaMulMul || 1),
  };
}

function computeRollsFromAffixes(affixes = []) {
  return affixes.reduce((next, affix) => {
    const value = Number(affix.value || 1);
    if (affix.stat === 'POWER_ADD_MUL') return { ...next, powerAddMul: next.powerAddMul * value };
    if (affix.stat === 'POWER_MUL_MUL') return { ...next, powerMulMul: next.powerMulMul * value };
    if (affix.stat === 'STAMINA_MUL_MUL') return { ...next, staminaMulMul: next.staminaMulMul * value };
    if (affix.stat === 'GLOBAL_MUL') {
      return {
        powerAddMul: next.powerAddMul * value,
        powerMulMul: next.powerMulMul * value,
        staminaMulMul: next.staminaMulMul * value,
      };
    }
    return next;
  }, defaultRolls());
}

function rollAffixes(rng, rarity = 'UNCOMMON', slot = 'WEAPON', lockedAffixes = []) {
  const count = Math.max(1, AFFIX_COUNT_BY_RARITY[rarity] || 2);
  const locked = lockedAffixes.slice(0, count).map((affix) => ({ ...affix, locked: true }));
  const used = new Set(locked.map((affix) => affix.id));
  const pool = AFFIX_TEMPLATES.filter((template) => !used.has(template.id));
  const picked = [...locked];
  while (picked.length < count && pool.length) {
    const index = Math.floor(rng() * pool.length);
    const template = pool.splice(index, 1)[0];
    const range = template.range[rarity] || template.range.UNCOMMON;
    const value = Number((range[0] + rng() * (range[1] - range[0])).toFixed(3));
    picked.push({
      id: template.id,
      label: slot === 'ARMOR' && template.id === 'AFF_FIREPOWER' ? '방호 보정' : template.label,
      stat: template.stat,
      value,
      locked: false,
    });
  }
  return picked;
}

function normalizeEquipmentInstance(equip, fallbackSlot = '') {
  if (!equip || typeof equip !== 'object') return null;
  const def = getItem(equip.itemId);
  const slot = equip.slot || fallbackSlot || def?.equip?.slot || 'WEAPON';
  const rarity = equip.rarity || def?.rarity || 'COMMON';
  const uid = equip.uid || `${equip.itemId || 'legacy'}-${slot}-legacy`;
  const seededRng = createRng(`${uid}|${equip.itemId}|${slot}`);
  const affixes = Array.isArray(equip.affixes) && equip.affixes.length
    ? equip.affixes
    : rollAffixes(seededRng, rarity, slot);
  return {
    ...equip,
    uid,
    itemId: equip.itemId,
    name: equip.name || def?.name || equip.itemId,
    rarity,
    slot,
    enhance: Number(equip.enhance ?? equip.enhanceLevel ?? 0),
    rolls: equip.rolls ? normalizeRolls(equip.rolls) : computeRollsFromAffixes(affixes),
    affixes,
    rerollCount: Number(equip.rerollCount || 0),
  };
}

function normalizeEquipmentMap(equipment = {}) {
  return Object.entries(equipment).reduce((next, [slot, equip]) => {
    const normalized = normalizeEquipmentInstance(equip, slot);
    if (!normalized) return next;
    return { ...next, [normalized.slot]: normalized };
  }, {});
}

function cloneEquipmentInstance(equip) {
  const normalized = normalizeEquipmentInstance(equip);
  if (!normalized) return null;
  return {
    ...normalized,
    rolls: { ...normalizeRolls(normalized.rolls) },
    affixes: (normalized.affixes || []).map((affix) => ({ ...affix })),
  };
}

function cloneEquipmentMap(equipment = {}) {
  return Object.entries(equipment || {}).reduce((next, [slot, equip]) => {
    const normalized = cloneEquipmentInstance(equip);
    if (!normalized) return next;
    return { ...next, [slot]: normalized };
  }, {});
}

function normalizeEquipmentPresets(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((preset, index) => {
      if (!preset || typeof preset !== 'object') return null;
      const id = String(preset.id || `preset-${index + 1}`);
      const name = String(preset.name || `프리셋 ${index + 1}`);
      return {
        id,
        name,
        equipment: cloneEquipmentMap(preset.equipment || {}),
        createdAt: Number(preset.createdAt || Date.now()),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeTowerShop(value, fallback) {
  const source = value && typeof value === 'object' ? value : fallback;
  return {
    dailyKey: source.dailyKey || '',
    dailyBought: source.dailyBought && typeof source.dailyBought === 'object' ? source.dailyBought : {},
    weeklyKey: source.weeklyKey || '',
    weeklyBought: source.weeklyBought && typeof source.weeklyBought === 'object' ? source.weeklyBought : {},
    seed: Number(source.seed || 0),
    rotation: source.rotation && typeof source.rotation === 'object' ? {
      dailyKey: source.rotation.dailyKey || '',
      dailyOfferIds: Array.isArray(source.rotation.dailyOfferIds) ? source.rotation.dailyOfferIds.filter((id) => offerExists(id)) : [],
      dailyResetsUsed: Math.max(0, Math.floor(Number(source.rotation.dailyResetsUsed || 0))),
      dailyNonce: Math.max(0, Math.floor(Number(source.rotation.dailyNonce || 0))),
      dailyPityCounter: Math.max(0, Math.floor(Number(source.rotation.dailyPityCounter || 0))),
      weeklyKey: source.rotation.weeklyKey || '',
      weeklyOfferIds: Array.isArray(source.rotation.weeklyOfferIds) ? source.rotation.weeklyOfferIds.filter((id) => offerExists(id)) : [],
      weeklyResetsUsed: Math.max(0, Math.floor(Number(source.rotation.weeklyResetsUsed || 0))),
      weeklyNonce: Math.max(0, Math.floor(Number(source.rotation.weeklyNonce || 0))),
      weeklyPityCounter: Math.max(0, Math.floor(Number(source.rotation.weeklyPityCounter || 0))),
    } : null,
  };
}

function normalizeSalvageSettings(value, fallback = { candidateOnly: true }) {
  const source = value && typeof value === 'object' ? value : fallback;
  return {
    candidateOnly: source.candidateOnly !== false,
  };
}

function getKstDateParts(now = Date.now()) {
  const date = new Date(now + 9 * 60 * 60 * 1000);
  const dayKey = date.toISOString().slice(0, 10);
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000 / 7) + 1;
  return {
    dayKey,
    weekKey: `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
  };
}

function ensureTowerShopPeriod(towerShop, now = Date.now()) {
  const keys = getKstDateParts(now);
  return {
    dailyKey: towerShop.dailyKey === keys.dayKey ? towerShop.dailyKey : keys.dayKey,
    dailyBought: towerShop.dailyKey === keys.dayKey ? towerShop.dailyBought : {},
    weeklyKey: towerShop.weeklyKey === keys.weekKey ? towerShop.weeklyKey : keys.weekKey,
    weeklyBought: towerShop.weeklyKey === keys.weekKey ? towerShop.weeklyBought : {},
    seed: Number(towerShop.seed || 0),
    rotation: towerShop.rotation && typeof towerShop.rotation === 'object' ? { ...towerShop.rotation } : null,
  };
}

function offerExists(offerId) {
  return TOWER_SHOP_OFFERS.some((offer) => offer.id === offerId);
}

function uniqueOfferIds(ids = []) {
  const seen = new Set();
  return ids.filter((id) => {
    if (!offerExists(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function pickUnique(pool, count, rng) {
  const rows = uniqueOfferIds(pool);
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temp = rows[index];
    rows[index] = rows[swapIndex];
    rows[swapIndex] = temp;
  }
  return rows.slice(0, Math.max(0, Math.min(count, rows.length)));
}

function makeTowerShopPick(pool, count, seed, key, nonce, fixed = [], exclude = new Set()) {
  const fixedIds = uniqueOfferIds(fixed).filter((id) => !exclude.has(id));
  const fixedSet = new Set(fixedIds);
  const filtered = uniqueOfferIds(pool).filter((id) => !fixedSet.has(id) && !exclude.has(id));
  const rng = createRng(`${seed}|${key}|${nonce}|tower-shop-pick`);
  const picked = pickUnique(filtered, Math.max(0, count - fixedIds.length), rng);
  return uniqueOfferIds([...fixedIds, ...picked]).slice(0, count);
}

function makeTowerShopPickWithBuckets(pool, count, seed, key, nonce, fixed = [], exclude = new Set(), buckets = []) {
  const picked = uniqueOfferIds(fixed).filter((id) => !exclude.has(id));

  buckets.forEach((bucket) => {
    const bucketFixed = uniqueOfferIds(bucket.fixedOfferIds || []).filter((id) => !exclude.has(id) && !picked.includes(id));
    bucketFixed.forEach((id) => picked.push(id));
    const need = Math.max(0, Number(bucket.pick || 0) - bucketFixed.length);
    if (!need) return;
    const ids = makeTowerShopPick(
      bucket.pool || [],
      need,
      seed,
      `${key}-${bucket.id}`,
      nonce + hash32(bucket.id),
      [],
      new Set([...exclude, ...picked]),
    );
    ids.forEach((id) => {
      if (!picked.includes(id)) picked.push(id);
    });
  });

  const need = Math.max(0, count - picked.length);
  if (need > 0) {
    const tail = makeTowerShopPick(pool, need, seed, `${key}-tail`, nonce, [], new Set([...exclude, ...picked]));
    tail.forEach((id) => {
      if (!picked.includes(id)) picked.push(id);
    });
  }

  if (picked.length < count) {
    return makeTowerShopPick(pool, count, seed, key, nonce, fixed, new Set());
  }

  return picked.slice(0, count);
}

function applyTowerShopPity(ids, pity, counter, exclude = new Set(), fixed = []) {
  if (!pity || Number(pity.trigger || 0) <= 0) return { ids, counter };
  const fixedSet = new Set(uniqueOfferIds(fixed));
  if ((pity.guaranteedOfferIds || []).some((id) => ids.includes(id))) return { ids, counter: 0 };

  const nextCounter = Number(counter || 0) + 1;
  if (nextCounter < Number(pity.trigger || 0)) return { ids, counter: nextCounter };

  const candidate = uniqueOfferIds(pity.guaranteedOfferIds || []).find((id) => !exclude.has(id));
  if (!candidate || ids.includes(candidate)) return { ids, counter: 0 };

  const next = ids.slice();
  let replaceIndex = -1;
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (!fixedSet.has(next[index])) {
      replaceIndex = index;
      break;
    }
  }
  next[replaceIndex >= 0 ? replaceIndex : Math.max(0, next.length - 1)] = candidate;
  return { ids: uniqueOfferIds(next).slice(0, ids.length), counter: 0 };
}

function normalizeTowerShopRotationForKeys(rotation, keys) {
  const source = rotation && typeof rotation === 'object' ? rotation : {};
  return {
    dailyKey: source.dailyKey === keys.dayKey ? source.dailyKey : keys.dayKey,
    dailyOfferIds: source.dailyKey === keys.dayKey ? uniqueOfferIds(source.dailyOfferIds || []) : [],
    dailyResetsUsed: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyResetsUsed || 0))) : 0,
    dailyNonce: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyNonce || 0))) : 0,
    dailyPityCounter: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyPityCounter || 0))) : 0,
    weeklyKey: source.weeklyKey === keys.weekKey ? source.weeklyKey : keys.weekKey,
    weeklyOfferIds: source.weeklyKey === keys.weekKey ? uniqueOfferIds(source.weeklyOfferIds || []) : [],
    weeklyResetsUsed: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyResetsUsed || 0))) : 0,
    weeklyNonce: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyNonce || 0))) : 0,
    weeklyPityCounter: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyPityCounter || 0))) : 0,
  };
}

function generateTowerShopPick(rotation, scope, seed, exclude = new Set()) {
  const isWeekly = scope === 'WEEKLY';
  const key = isWeekly ? rotation.weeklyKey : rotation.dailyKey;
  const nonce = isWeekly ? rotation.weeklyNonce : rotation.dailyNonce;
  const fixed = isWeekly ? TOWER_SHOP_ROTATION.weeklyFixedOfferIds : TOWER_SHOP_ROTATION.dailyFixedOfferIds;
  const pool = isWeekly ? TOWER_SHOP_ROTATION.weeklyPool : TOWER_SHOP_ROTATION.dailyPool;
  const pick = isWeekly ? TOWER_SHOP_ROTATION.weeklyPick : TOWER_SHOP_ROTATION.dailyPick;
  const buckets = isWeekly ? TOWER_SHOP_ROTATION.weeklyBuckets : TOWER_SHOP_ROTATION.dailyBuckets;
  const pity = isWeekly ? TOWER_SHOP_ROTATION.weeklyPity : TOWER_SHOP_ROTATION.dailyPity;
  const counter = isWeekly ? rotation.weeklyPityCounter : rotation.dailyPityCounter;
  const picked = makeTowerShopPickWithBuckets(pool, pick, seed, key, nonce, fixed, exclude, buckets);
  return applyTowerShopPity(picked, pity, counter, exclude, fixed);
}

function ensureTowerShopState(state, now = Date.now()) {
  const keys = getKstDateParts(now);
  const periodShop = ensureTowerShopPeriod(state.towerShop || {}, now);
  const seed = Number(periodShop.seed || 0) || hash32(`${state.runId || 'schale'}|tower-shop`);
  let rotation = normalizeTowerShopRotationForKeys(periodShop.rotation, keys);
  const avoidOverlap = Boolean(TOWER_SHOP_ROTATION.avoidCrossOverlap);
  const priority = TOWER_SHOP_ROTATION.crossOverlapPriority || 'WEEKLY';

  if (avoidOverlap && priority === 'DAILY') {
    if (!rotation.dailyOfferIds.length) {
      const daily = generateTowerShopPick(rotation, 'DAILY', seed);
      rotation = { ...rotation, dailyOfferIds: daily.ids, dailyPityCounter: daily.counter };
    }
    if (!rotation.weeklyOfferIds.length) {
      const weekly = generateTowerShopPick(rotation, 'WEEKLY', seed, new Set(rotation.dailyOfferIds));
      rotation = { ...rotation, weeklyOfferIds: weekly.ids, weeklyPityCounter: weekly.counter };
    }
  } else {
    if (!rotation.weeklyOfferIds.length) {
      const weekly = generateTowerShopPick(rotation, 'WEEKLY', seed);
      rotation = { ...rotation, weeklyOfferIds: weekly.ids, weeklyPityCounter: weekly.counter };
    }
    if (!rotation.dailyOfferIds.length) {
      const daily = generateTowerShopPick(rotation, 'DAILY', seed, avoidOverlap ? new Set(rotation.weeklyOfferIds) : new Set());
      rotation = { ...rotation, dailyOfferIds: daily.ids, dailyPityCounter: daily.counter };
    }
  }

  return {
    ...state,
    towerShop: {
      ...periodShop,
      seed,
      rotation,
    },
  };
}

function activeTowerShopOfferIdSet(towerShop) {
  const rotation = towerShop?.rotation || {};
  return new Set([...(rotation.dailyOfferIds || []), ...(rotation.weeklyOfferIds || [])]);
}

function towerShopPickupLabel(towerShop, offerId) {
  const rotation = towerShop?.rotation || {};
  const daily = (rotation.dailyOfferIds || []).includes(offerId);
  const weekly = (rotation.weeklyOfferIds || []).includes(offerId);
  if (daily && weekly) return '오늘+이번주 픽업';
  if (weekly) return '이번주 픽업';
  if (daily) return '오늘 픽업';
  return '비활성';
}

function getTowerShopBought(towerShop, offer) {
  const bucket = offer.limit?.period === 'WEEKLY' ? towerShop.weeklyBought : towerShop.dailyBought;
  return Number(bucket?.[offer.id] || 0);
}

function setTowerShopBought(towerShop, offer, value) {
  if (offer.limit?.period === 'WEEKLY') {
    return { ...towerShop, weeklyBought: { ...towerShop.weeklyBought, [offer.id]: value } };
  }
  return { ...towerShop, dailyBought: { ...towerShop.dailyBought, [offer.id]: value } };
}

function salvageValue(equip) {
  const rank = rarityRank(equip.rarity);
  const enhance = Number(equip.enhance || 0);
  return {
    scrap: 8 + rank * 8 + enhance * 4,
    stone: rank >= RARITY_RANK.RARE ? 1 + Math.floor(enhance / 3) : Math.floor(enhance / 4),
    ticket: rank >= RARITY_RANK.EPIC && enhance >= 6 ? 1 : 0,
  };
}

function isHighRiskSalvageEntry(entry) {
  return rarityRank(entry?.rarity) >= RARITY_RANK.RARE
    || Number(entry?.enhance || 0) >= 3
    || Number(entry?.score || 0) >= 120;
}

function salvageTargetRows(rows = [], candidateOnly = true) {
  return candidateOnly ? rows.filter((entry) => !isHighRiskSalvageEntry(entry)) : rows;
}

function salvageTotals(rows = []) {
  return rows.reduce((sum, entry) => {
    const value = salvageValue(entry);
    return {
      scrap: sum.scrap + value.scrap,
      stone: sum.stone + value.stone,
      ticket: sum.ticket + value.ticket,
    };
  }, { scrap: 0, stone: 0, ticket: 0 });
}

function salvageRewardText(totals) {
  return `고철 ${totals.scrap}${totals.stone ? `, 강화석 ${totals.stone}` : ''}${totals.ticket ? `, 리롤권 ${totals.ticket}` : ''}`;
}

function normalizeSelectedSalvageUids(selectedUids = []) {
  if (!Array.isArray(selectedUids)) return new Set();
  return new Set(selectedUids.filter((uid) => typeof uid === 'string' && uid.trim()));
}

function makeSalvageEntry(equip, reason) {
  return {
    uid: equip.uid,
    itemId: equip.itemId,
    name: equip.name,
    rarity: equip.rarity,
    slot: equip.slot,
    enhance: Number(equip.enhance || 0),
    score: equipmentScore(equip),
    equip: cloneEquipmentInstance(equip),
    reason,
    createdAt: Date.now(),
  };
}

function queueSalvage(salvageQueue, equip, reason) {
  if (!equip) return salvageQueue;
  return [makeSalvageEntry(equip, reason), ...salvageQueue].slice(0, 40);
}

function putEquipmentOrQueue(equipment, salvageQueue, equip, reason = '입수') {
  const old = equipment[equip.slot];
  if (!old || equipmentScore(equip) >= equipmentScore(old)) {
    return {
      equipment: { ...equipment, [equip.slot]: equip },
      salvageQueue: old ? queueSalvage(salvageQueue, old, '교체 장비') : salvageQueue,
      equipped: true,
    };
  }
  return {
    equipment,
    salvageQueue: queueSalvage(salvageQueue, equip, reason),
    equipped: false,
  };
}

function equipmentScore(equip) {
  const normalized = normalizeEquipmentInstance(equip);
  if (!normalized) return 0;
  const def = getItem(normalized.itemId);
  const stats = def?.equip || {};
  const enhance = Number(normalized.enhance || 0);
  const rolls = normalizeRolls(normalized.rolls);
  return Math.round(
    Number(stats.powerAdd || 0) * rolls.powerAddMul * (1 + enhance * 0.12)
    + ((Number(stats.powerMul || 1) * rolls.powerMulMul * (1 + enhance * 0.01)) - 1) * 900
    + ((Number(stats.staminaMul || 1) * rolls.staminaMulMul * (1 + enhance * 0.02)) - 1) * 450
    + enhance * 18
  );
}

function makeEquipment(itemId, enhance = 0, rng = createRng(`${itemId}|${Date.now()}`)) {
  const def = getItem(itemId);
  const slot = def?.equip?.slot || 'WEAPON';
  const rarity = def?.rarity || 'COMMON';
  const uidSeed = Math.floor(rng() * 1000000000).toString(36);
  const affixes = rollAffixes(rng, rarity, slot);
  return {
    uid: `${itemId}-${Date.now().toString(36)}-${uidSeed}`,
    itemId,
    name: def?.name || itemId,
    rarity,
    slot,
    enhance,
    rolls: computeRollsFromAffixes(affixes),
    affixes,
    rerollCount: 0,
  };
}

export function getEquippedList(state) {
  const current = normalizeState(state);
  return Object.values(current.equipment).filter(Boolean).sort((a, b) => slotLabel(a.slot).localeCompare(slotLabel(b.slot), 'ko-KR'));
}

function titleById(titleId) {
  return TITLES.find((title) => title.id === titleId) || null;
}

function getEquippedTitle(state) {
  const current = normalizeState(state);
  const title = titleById(current.equippedTitleId);
  if (!title || !current.unlockedTitleIds.includes(title.id)) return null;
  return title;
}

function rewardCreditMul(state) {
  const title = getEquippedTitle(state);
  return title?.kind === 'REWARD_MUL' ? Number(title.mul || 1) : 1;
}

function powerTitleMul(state) {
  const title = getEquippedTitle(state);
  return title?.kind === 'POWER_MUL' ? Number(title.mul || 1) : 1;
}

function achievementProgress(current, achievement) {
  if (achievement.action === 'MAX_FLOOR') return Number(current.maxClearedFloor || 0);
  if (achievement.action === 'MAX_TOWER') return Number(current.towerMaxCleared || 0);
  if (achievement.action === 'ENHANCED_EQUIP') {
    return getEquippedList(current).some((equip) => Number(equip.enhance || 0) >= achievement.target) ? 1 : 0;
  }
  return Number(current.lifetimeCounters?.[achievement.action] || 0);
}

export function achievementRows(state) {
  const current = normalizeState(state);
  return ACHIEVEMENTS.map((achievement) => {
    const target = achievement.action === 'ENHANCED_EQUIP' ? 1 : Number(achievement.target || 1);
    const rawProgress = achievementProgress(current, achievement);
    const progress = achievement.action === 'ENHANCED_EQUIP' ? rawProgress : Math.min(rawProgress, target);
    const done = rawProgress >= target;
    const claimed = Boolean(current.achievementClaims?.[achievement.id]);
    return {
      ...achievement,
      progress,
      target,
      done,
      claimed,
      canClaim: done && !claimed,
      titleName: achievement.unlockTitleId ? titleById(achievement.unlockTitleId)?.name || achievement.unlockTitleId : '',
    };
  });
}

export function titleRows(state) {
  const current = normalizeState(state);
  return TITLES.map((title) => ({
    ...title,
    unlocked: current.unlockedTitleIds.includes(title.id),
    equipped: current.unlockedTitleIds.includes(title.id) && current.equippedTitleId === title.id,
  }));
}

export function teamPower(state) {
  const current = normalizeState(state);
  let add = 0;
  let mul = 1;
  let staminaMul = 1;
  const upgrades = upgradeMultipliers(current.upgrades);
  getEquippedList(current).forEach((equip) => {
    const normalized = normalizeEquipmentInstance(equip);
    const stats = getItem(normalized.itemId)?.equip || {};
    const enhance = Number(normalized.enhance || 0);
    const rolls = normalizeRolls(normalized.rolls);
    add += Number(stats.powerAdd || 0) * rolls.powerAddMul * (1 + enhance * 0.12);
    mul *= Number(stats.powerMul || 1) * rolls.powerMulMul * (1 + enhance * 0.01);
    staminaMul *= Number(stats.staminaMul || 1) * rolls.staminaMulMul * (1 + enhance * 0.02);
  });
  const staminaFactor = clamp(0.62 + (Number(current.stamina || 0) / 100) * 0.5 * upgrades.staminaMul, 0.45, 1.2);
  return Math.round((Number(current.basePower || 0) + add) * mul * staminaFactor * staminaMul * powerTitleMul(current) * upgrades.powerMul);
}

function dutyDifficulty(floor) {
  const f = Math.max(1, Number(floor || 1));
  const bossMul = f % 20 === 0 ? 4 : f % 10 === 0 ? 2.5 : 1;
  return 100 * Math.pow(1.085, f - 1) * bossMul;
}

function towerDifficulty(floor) {
  const f = Math.max(1, Number(floor || 1));
  return TOWER.D0 * Math.pow(1 + TOWER.growth, f - 1) * TOWER.bossMul;
}

function winProb(power, difficulty, k = 1.6) {
  const ratio = power / (power + difficulty);
  return clamp(Math.pow(ratio, k), 0.04, 0.98);
}

function creditReward(floor) {
  return Math.round(10 * Math.pow(1.06, Math.max(1, floor) - 1));
}

function towerReward(floor) {
  return Math.round(TOWER.R0 * Math.pow(1 + TOWER.rewardGrowth, Math.max(1, floor) - 1));
}

function rollDrops(inventory, floor, rng) {
  let next = addItem(inventory, 'itm_scrap', 2 + Math.floor(floor / 8));
  if (rng() < 0.34) next = addItem(next, 'itm_bandage', 1);
  if (rng() < 0.22) next = addItem(next, 'itm_battery', 1);
  if (floor >= 20 && rng() < 0.13) next = addItem(next, 'itm_memory_chip', 1);
  if (floor >= 35 && rng() < 0.08) next = addItem(next, 'itm_alloy_plate', 1);
  if (floor % 10 === 0) next = addItem(next, 'itm_enhance_stone', 1);
  if (floor % 20 === 0) next = addItem(next, 'itm_tower_key', 1);
  return next;
}

function compressDutyHighlights(details, maxLines = 8) {
  const lines = [];
  let runStart = null;
  let runEnd = null;
  let runCredits = 0;
  const flush = () => {
    if (runStart == null || runEnd == null) return;
    lines.push(runStart === runEnd
      ? `F${runStart} 클리어 (+${Math.floor(runCredits)} Cr)`
      : `F${runStart}~F${runEnd} 클리어 (+${Math.floor(runCredits)} Cr)`);
    runStart = null;
    runEnd = null;
    runCredits = 0;
  };

  details.forEach((entry) => {
    if (entry.kind === 'FLOOR_CLEAR') {
      if (runStart == null) {
        runStart = entry.floor;
        runEnd = entry.floor;
        runCredits = Number(entry.creditsGained || 0);
      } else if (entry.floor === runEnd + 1) {
        runEnd = entry.floor;
        runCredits += Number(entry.creditsGained || 0);
      } else {
        flush();
        runStart = entry.floor;
        runEnd = entry.floor;
        runCredits = Number(entry.creditsGained || 0);
      }
      return;
    }
    flush();
    if (entry.kind === 'BOSS_RESULT') lines.push(`F${entry.floor} 보스전: ${entry.message}`);
    else if (entry.kind === 'LOOT') lines.push(`F${entry.floor} 전리품: ${entry.items.map((item) => `${itemName(item.itemId)}x${item.qty}`).join(', ')}`);
    else if (entry.kind === 'FAILED') lines.push(`F${entry.floor} 실패: ${entry.message}`);
  });
  flush();
  return lines.slice(0, maxLines);
}

function makeDutyReport({ fromFloor, toFloor, totalCreditsGained, stoppedReason, details }) {
  return {
    at: Date.now(),
    fromFloor,
    toFloor,
    totalCreditsGained: Math.round(totalCreditsGained),
    stoppedReason,
    highlights: compressDutyHighlights(details),
    details: details.slice(-40),
  };
}

export function resolveDutyAction(state, minutes = 60) {
  let next = normalizeState(state);
  const leader = getLeader(next);
  const rng = createRng(`${next.runId}|duty|${next.floor}|${next.counters.CLEAR_FLOOR}|${minutes}`);
  let seconds = Math.max(60, Number(minutes || 60) * 60);
  let cleared = 0;
  let credits = 0;
  let bosses = 0;
  let floor = Number(next.floor || 1);
  let inventory = next.inventory;
  let stamina = Number(next.stamina || 0);
  const fromFloor = floor;
  const details = [];
  const rewardMul = rewardCreditMul(next);
  const fatigueMul = 1 / upgradeMultipliers(next.upgrades).staminaMul;

  while (seconds > 0 && stamina > 8) {
    const power = teamPower({ ...next, floor, stamina, inventory });
    const difficulty = dutyDifficulty(floor);
    const probability = winProb(power, difficulty);
    const clearSec = clamp(Math.round(34 * Math.pow(difficulty / Math.max(power, 1), 0.7)), 8, 180);
    if (seconds < clearSec) break;
    seconds -= clearSec;
    if (rng() > probability) {
      details.push({ kind: 'FAILED', floor, message: leader.lines.fail });
      const failedState = addLifetimeCounters({
        ...next,
        floor,
        maxClearedFloor: Math.max(Number(next.maxClearedFloor || 0), floor - 1),
        credits: Math.round(Number(next.credits || 0) + credits),
        stamina: Math.max(0, Math.round(stamina - 6)),
        inventory,
        counters: {
          ...next.counters,
          CLEAR_FLOOR: Number(next.counters.CLEAR_FLOOR || 0) + cleared,
          KILL_BOSS: Number(next.counters.KILL_BOSS || 0) + bosses,
        },
        lastDutyReport: makeDutyReport({
          fromFloor,
          toFloor: Math.max(fromFloor, floor - 1),
          totalCreditsGained: credits,
          stoppedReason: 'FAILED',
          details,
        }),
      }, {
        CLEAR_FLOOR: cleared,
        KILL_BOSS: bosses,
        EARN_CREDITS: credits,
      });
      return addLog({
        ...failedState,
      }, `${floor}층 정산 실패. ${leader.lines.fail}`);
    }

    const reward = Math.round(creditReward(floor) * rewardMul);
    credits += reward;
    cleared += 1;
    details.push({ kind: 'FLOOR_CLEAR', floor, creditsGained: reward });
    if (floor % 10 === 0) {
      bosses += 1;
      details.push({ kind: 'BOSS_RESULT', floor, win: true, message: '보스 처치 성공', creditsGained: reward });
    }
    inventory = rollDrops(inventory, floor, rng);
    stamina = clamp(stamina - (floor % 10 === 0 ? 3.2 : 1.3) * fatigueMul, 0, 100);
    floor += 1;
  }

  next = addLifetimeCounters({
    ...next,
    floor,
    maxClearedFloor: Math.max(Number(next.maxClearedFloor || 0), floor - 1),
    credits: Math.round(Number(next.credits || 0) + credits),
    stamina: Math.round(stamina),
    inventory,
    counters: {
      ...next.counters,
      CLEAR_FLOOR: Number(next.counters.CLEAR_FLOOR || 0) + cleared,
      KILL_BOSS: Number(next.counters.KILL_BOSS || 0) + bosses,
    },
    lastDutyReport: makeDutyReport({
      fromFloor,
      toFloor: Math.max(fromFloor, floor - 1),
      totalCreditsGained: credits,
      stoppedReason: seconds <= 0 ? 'TIME_OUT' : 'NONE',
      details,
    }),
  }, {
    CLEAR_FLOOR: cleared,
    KILL_BOSS: bosses,
    EARN_CREDITS: credits,
  });
  return addLog(next, `${minutes}분 방치 정산: ${cleared}층 클리어, +${Math.round(credits)} Cr, 보스 ${bosses}회. ${cleared ? leader.lines.clear : '추가 클리어는 없었습니다.'}`);
}

function parseSavedAt(value, fallback = Date.now()) {
  const raw = typeof value === 'number' ? value : new Date(value || '').getTime();
  return Number.isFinite(raw) ? raw : fallback;
}

export function applyOfflineProgressAction(state, nowMs = Date.now()) {
  const current = normalizeState(state);
  const lastMs = parseSavedAt(current.lastSavedAt || current.updatedAt || current.startedAt, nowMs);
  const deltaMs = Math.max(0, Math.min(OFFLINE_CAP_MS, nowMs - lastMs));
  const waves = Math.floor(deltaMs / OFFLINE_WAVE_MS);
  const nowIso = new Date(nowMs).toISOString();
  if (waves <= 0) {
    return {
      ...current,
      lastSavedAt: nowIso,
      updatedAt: nowIso,
      offlineLastSummary: null,
    };
  }

  const floorBase = Math.max(1, Math.floor(Number(current.towerMaxCleared || current.maxClearedFloor || current.floor || 1)));
  const creditsPerWave = Math.round((15 + floorBase * 2) * rewardCreditMul(current));
  const creditsGained = waves * creditsPerWave;
  const tokensGained = Math.floor(waves / 10);
  const next = addLifetimeCounters({
    ...current,
    credits: Math.round(Number(current.credits || 0) + creditsGained),
    inventory: addItem(current.inventory, 'itm_tower_token', tokensGained),
    lastSavedAt: nowIso,
    updatedAt: nowIso,
    offlineLastSummary: {
      at: nowIso,
      deltaMs,
      waves,
      creditsGained,
      tokensGained,
      capped: nowMs - lastMs > OFFLINE_CAP_MS,
    },
  }, {
    EARN_CREDITS: creditsGained,
  });

  const minutes = Math.floor(deltaMs / 60000);
  return addLog(next, `오프라인 진행: ${minutes}분 / ${waves}웨이브 보상, +${creditsGained} Cr, 시련 토큰 +${tokensGained}`);
}

export function restAction(state) {
  const current = normalizeState(state);
  const recovery = Math.round(35 * upgradeMultipliers(current.upgrades).staminaMul);
  return addLog({
    ...current,
    stamina: clamp(Number(current.stamina || 0) + recovery, 0, 100),
  }, `재정비로 스태미나를 ${recovery} 회복했습니다.`);
}

export function applyUpgradeAction(state, upgradeId) {
  const current = normalizeState(state);
  const def = UPGRADE_DEFS.find((upgrade) => upgrade.id === upgradeId);
  if (!def) return addLog(current, '연구 항목을 찾을 수 없습니다.');
  const level = Math.max(0, Math.floor(Number(current.upgrades[def.id] || 0)));
  const cost = upgradeCost(def.id, level + 1);
  if (Number(current.credits || 0) < cost.credits) return addLog(current, `${def.name} 연구 실패. 크레딧이 부족합니다.`);
  if (!hasItems(current.inventory, cost.items)) return addLog(current, `${def.name} 연구 실패. 필요한 재료가 부족합니다.`);

  const next = addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - cost.credits,
    inventory: spendItems(current.inventory, cost.items),
    upgrades: {
      ...current.upgrades,
      [def.id]: level + 1,
    },
    counters: bumpCounter(current.counters, 'UPGRADE', 1),
  }, { UPGRADE: 1 });

  return addLog(next, `${def.name} Lv.${level} -> Lv.${level + 1} 연구 완료. 전투력이 상승했습니다.`);
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (Number(current.credits || 0) < recipe.credits) return addLog(current, `${recipe.name} 실패. 크레딧이 부족합니다.`);
  if (!hasItems(current.inventory, recipe.requires)) return addLog(current, `${recipe.name} 실패. 필요한 재료가 부족합니다.`);

  const produced = getItem(recipe.produces.itemId);
  let equipment = current.equipment;
  let salvageQueue = current.salvageQueue;
  let inventory = spendItems(current.inventory, recipe.requires);
  let message = `${recipe.name} 완료.`;
  if (produced?.equip) {
    const rng = createRng(`${current.runId}|craft|${recipe.id}|${current.counters.CRAFT}`);
    const equip = makeEquipment(produced.id, 0, rng);
    const old = equipment[equip.slot];
    const result = putEquipmentOrQueue(equipment, salvageQueue, equip, '제작 초과분');
    equipment = result.equipment;
    salvageQueue = result.salvageQueue;
    message = `${recipe.name} 완료. ${produced.name}${old && equipment[equip.slot] === old ? '은 기존 장비보다 약해 보관 처리했습니다.' : '을(를) 장착했습니다.'}`;
  } else {
    inventory = addItem(inventory, recipe.produces.itemId, recipe.produces.qty);
  }

  return addLog(addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - recipe.credits,
    inventory,
    equipment,
    salvageQueue,
    counters: bumpCounter(current.counters, 'CRAFT', 1),
  }, { CRAFT: 1 }), message);
}

export function enhanceEquipmentAction(state, slot) {
  const current = normalizeState(state);
  const equip = current.equipment[slot];
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 강화할 장비가 없습니다.`);
  const level = Number(equip.enhance || 0);
  const costCredits = 70 + level * 35;
  const costStones = 1 + Math.floor(level / 3);
  if (Number(current.credits || 0) < costCredits) return addLog(current, '강화 실패. 크레딧이 부족합니다.');
  if (Number(current.inventory.itm_enhance_stone || 0) < costStones) return addLog(current, '강화 실패. 강화석이 부족합니다.');

  const rng = createRng(`${current.runId}|enhance|${slot}|${level}|${current.counters.ENHANCE_TRY}`);
  const chance = clamp(0.82 - level * 0.045, 0.22, 0.9);
  const success = rng() < chance;
  let inventory = addItem(current.inventory, 'itm_enhance_stone', -costStones);
  let nextEquip = success ? { ...equip, enhance: level + 1 } : equip;
  let penaltyText = '';
  if (!success && level >= 5) {
    const protectItem = ['itm_protect_ticket', 'itm_protect_downgrade', 'itm_protect_charm']
      .find((itemId) => Number(inventory[itemId] || 0) > 0);
    if (protectItem) {
      inventory = addItem(inventory, protectItem, -1);
      penaltyText = ` ${itemName(protectItem)}로 하락을 막았습니다.`;
    } else {
      nextEquip = { ...equip, enhance: Math.max(0, level - 1) };
      penaltyText = ` 실패 패널티로 +${nextEquip.enhance}까지 하락했습니다.`;
    }
  }
  return addLog(addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - costCredits,
    inventory,
    equipment: { ...current.equipment, [slot]: nextEquip },
    counters: {
      ...bumpCounter(current.counters, 'ENHANCE_TRY', 1),
      ENHANCE_SUCCESS: Number(current.counters.ENHANCE_SUCCESS || 0) + (success ? 1 : 0),
    },
  }, {
    ENHANCE_TRY: 1,
    ENHANCE_SUCCESS: success ? 1 : 0,
  }), `${equip.name} +${level} 강화 ${success ? `성공. +${level + 1}` : `실패.${penaltyText}`} 성공률 ${Math.round(chance * 100)}%`);
}

export function rerollEquipmentAction(state, slot) {
  const current = normalizeState(state);
  const equip = current.equipment[slot];
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 재련할 장비가 없습니다.`);

  const lockedAffixes = Array.isArray(equip.affixes) ? equip.affixes.filter((affix) => affix.locked) : [];
  const ticketCost = 1 + lockedAffixes.length;
  const tokenCost = 12 + lockedAffixes.length * 8 + Number(equip.rerollCount || 0) * 2;
  let inventory = current.inventory;
  let costText = '';
  if (Number(inventory.itm_reroll_ticket || 0) >= ticketCost) {
    inventory = addItem(inventory, 'itm_reroll_ticket', -ticketCost);
    costText = `리롤권 ${ticketCost}장`;
  } else if (Number(inventory.itm_tower_token || 0) >= tokenCost) {
    inventory = addItem(inventory, 'itm_tower_token', -tokenCost);
    costText = `시련 토큰 ${tokenCost}개`;
  } else {
    return addLog(current, `옵션 재련 실패. 리롤권 ${ticketCost}장 또는 시련 토큰 ${tokenCost}개가 필요합니다.`);
  }

  const rng = createRng(`${current.runId}|reroll|${slot}|${equip.rerollCount}|${current.counters.REROLL}`);
  const affixes = rollAffixes(rng, equip.rarity, equip.slot, lockedAffixes);
  const nextEquip = {
    ...equip,
    affixes,
    rolls: computeRollsFromAffixes(affixes),
    rerollCount: Number(equip.rerollCount || 0) + 1,
    lastRerolledAt: new Date().toISOString(),
  };
  return addLog({
    ...current,
    inventory,
    equipment: { ...current.equipment, [slot]: nextEquip },
    counters: bumpCounter(current.counters, 'REROLL', 1),
  }, `${equip.name} 옵션 재련 완료(${costText}): ${affixes.map((affix) => `${affix.label} x${affix.value}`).join(', ')}`);
}

export function toggleEquipmentAffixLockAction(state, slot, affixId) {
  const current = normalizeState(state);
  const equip = current.equipment[slot];
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 장비가 없습니다.`);

  const affixes = Array.isArray(equip.affixes) ? equip.affixes : [];
  if (!affixes.length) return addLog(current, `${equip.name}에는 잠글 옵션이 없습니다.`);

  let changed = false;
  const nextAffixes = affixes.map((affix) => {
    if (affix.id !== affixId) return affix;
    changed = true;
    return { ...affix, locked: !affix.locked };
  });
  if (!changed) return addLog(current, '옵션 라인을 찾을 수 없습니다.');

  const nextEquip = {
    ...equip,
    affixes: nextAffixes,
    rolls: computeRollsFromAffixes(nextAffixes),
  };
  const target = nextAffixes.find((affix) => affix.id === affixId);

  return addLog({
    ...current,
    equipment: { ...current.equipment, [slot]: nextEquip },
  }, `${equip.name} 옵션 ${target?.label || affixId} ${target?.locked ? '잠금' : '해제'}`);
}

export function autoSalvageAction(state) {
  const current = normalizeState(state);
  const queue = Array.isArray(current.salvageQueue) ? current.salvageQueue : [];
  if (!queue.length) return addLog(current, '자동 분해할 장비가 없습니다.');
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const targetQueue = salvageTargetRows(queue, candidateOnly);
  const targetUids = new Set(targetQueue.map((entry) => entry.uid));
  const remainingQueue = queue.filter((entry) => !targetUids.has(entry.uid));
  if (!targetQueue.length) return addLog(current, '후보만 분해 ON 상태에서 실행할 안전 후보가 없습니다. 전체 분해가 필요하면 후보만 분해를 끄세요.');

  let inventory = current.inventory;
  const totals = salvageTotals(targetQueue);

  inventory = addItem(inventory, 'itm_scrap', totals.scrap);
  if (totals.stone > 0) inventory = addItem(inventory, 'itm_enhance_stone', totals.stone);
  if (totals.ticket > 0) inventory = addItem(inventory, 'itm_reroll_ticket', totals.ticket);

  return addLog({
    ...current,
    inventory,
    salvageQueue: remainingQueue,
    counters: bumpCounter(current.counters, 'SALVAGE', targetQueue.length),
  }, `자동 분해 ${targetQueue.length}개 완료. 고철 +${totals.scrap}, 강화석 +${totals.stone}, 리롤권 +${totals.ticket}${remainingQueue.length ? ` / 보호로 ${remainingQueue.length}개 유지` : ''}`);
}

export function salvageSelectedAction(state, selectedUids = []) {
  const current = normalizeState(state);
  const queue = Array.isArray(current.salvageQueue) ? current.salvageQueue : [];
  const selectedUidSet = normalizeSelectedSalvageUids(selectedUids);
  if (!selectedUidSet.size) return addLog(current, '선택 분해할 장비를 먼저 고르세요.');

  const selectedQueue = queue.filter((entry) => selectedUidSet.has(entry.uid));
  if (!selectedQueue.length) return addLog(current, '선택한 장비가 분해 대기열에 없습니다.');

  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const targetQueue = salvageTargetRows(selectedQueue, candidateOnly);
  if (!targetQueue.length) {
    return addLog(current, candidateOnly
      ? '후보만 분해 ON 상태라 선택한 장비가 모두 보호되었습니다.'
      : '선택한 장비 중 실행할 분해 후보가 없습니다.');
  }

  const targetUids = new Set(targetQueue.map((entry) => entry.uid));
  const remainingQueue = queue.filter((entry) => !targetUids.has(entry.uid));
  let inventory = current.inventory;
  const totals = salvageTotals(targetQueue);

  inventory = addItem(inventory, 'itm_scrap', totals.scrap);
  if (totals.stone > 0) inventory = addItem(inventory, 'itm_enhance_stone', totals.stone);
  if (totals.ticket > 0) inventory = addItem(inventory, 'itm_reroll_ticket', totals.ticket);

  const protectedCount = selectedQueue.length - targetQueue.length;
  return addLog({
    ...current,
    inventory,
    salvageQueue: remainingQueue,
    counters: bumpCounter(current.counters, 'SALVAGE', targetQueue.length),
  }, `선택 분해 ${targetQueue.length}개 완료. 고철 +${totals.scrap}, 강화석 +${totals.stone}, 리롤권 +${totals.ticket}${protectedCount ? ` / 후보 보호 ${protectedCount}개` : ''}`);
}

export function setSalvageCandidateOnlyAction(state, enabled) {
  const current = normalizeState(state);
  const candidateOnly = enabled !== false;
  return addLog({
    ...current,
    salvageSettings: {
      ...current.salvageSettings,
      candidateOnly,
    },
  }, candidateOnly ? '후보만 분해를 켰습니다. 위험 후보는 자동 분해에서 보호됩니다.' : '후보만 분해를 껐습니다. 자동 분해가 전체 대기열을 처리합니다.');
}

function grantTowerShopReward(current, offer, rng) {
  let equipment = current.equipment;
  let salvageQueue = current.salvageQueue;
  let inventory = current.inventory;
  const reward = offer.reward;
  let label = '';

  if (reward.type === 'STACK') {
    inventory = addItem(inventory, reward.itemId, reward.qty);
    label = `${itemName(reward.itemId)} ${reward.qty}개`;
  }

  if (reward.type === 'EQUIP') {
    for (let index = 0; index < Math.max(1, Number(reward.qty || 1)); index += 1) {
      const equip = makeEquipment(reward.itemId, 0, rng);
      const result = putEquipmentOrQueue(equipment, salvageQueue, equip, '상점 초과분');
      equipment = result.equipment;
      salvageQueue = result.salvageQueue;
      label = `${equip.name}${result.equipped ? ' 장착' : ' 분해 대기'}`;
    }
  }

  if (reward.type === 'RANDOM_EQUIP') {
    const pool = Array.isArray(reward.pool) && reward.pool.length ? reward.pool : ['eq_tower_relic_alpha'];
    for (let index = 0; index < Math.max(1, Number(reward.qty || 1)); index += 1) {
      const itemId = pool[Math.floor(rng() * pool.length)];
      const equip = makeEquipment(itemId, 0, rng);
      const result = putEquipmentOrQueue(equipment, salvageQueue, equip, '상점 초과분');
      equipment = result.equipment;
      salvageQueue = result.salvageQueue;
      label = `${equip.name}${result.equipped ? ' 장착' : ' 분해 대기'}`;
    }
  }

  return { equipment, salvageQueue, inventory, label };
}

export function buyTowerShopOfferAction(state, offerId) {
  const current = ensureTowerShopState(normalizeState(state));
  const offer = TOWER_SHOP_OFFERS.find((item) => item.id === offerId);
  if (!offer) return addLog(current, '타워 상점 상품을 찾을 수 없습니다.');
  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  if (!activeIds.has(offer.id)) return addLog(current, `${offer.name}은 현재 픽업 상품이 아닙니다.`);
  const bought = getTowerShopBought(towerShop, offer);
  const max = Number(offer.limit?.max || 999);
  if (bought >= max) return addLog(current, `${offer.name} 구매 제한에 도달했습니다.`);
  if (Number(current.inventory[offer.cost.itemId] || 0) < offer.cost.qty) return addLog(current, `${offer.name} 구매 실패. ${itemName(offer.cost.itemId)}이 부족합니다.`);

  const rng = createRng(`${current.runId}|tower-shop|${offer.id}|${bought}|${current.counters.SHOP_BUY}`);
  const paid = addItem(current.inventory, offer.cost.itemId, -offer.cost.qty);
  const granted = grantTowerShopReward({ ...current, inventory: paid }, offer, rng);
  return addLog({
    ...current,
    inventory: granted.inventory,
    equipment: granted.equipment,
    salvageQueue: granted.salvageQueue,
    towerShop: setTowerShopBought(towerShop, offer, bought + 1),
    counters: bumpCounter(current.counters, 'SHOP_BUY', 1),
  }, `${offer.name} 구매 완료. ${granted.label}`);
}

export function buyTowerShopOfferMaxAction(state, offerId) {
  const current = ensureTowerShopState(normalizeState(state));
  const offer = TOWER_SHOP_OFFERS.find((item) => item.id === offerId);
  if (!offer) return addLog(current, '대상 상점 상품을 찾을 수 없습니다.');

  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  if (!activeIds.has(offer.id)) return addLog(current, `${offer.name}는 현재 픽업 상품이 아닙니다.`);

  const bought = getTowerShopBought(towerShop, offer);
  const limitMax = offer.limit ? Number(offer.limit.max || 0) : Number.POSITIVE_INFINITY;
  const remainingByLimit = Number.isFinite(limitMax) ? Math.max(0, limitMax - bought) : Number.POSITIVE_INFINITY;
  if (remainingByLimit <= 0) return addLog(current, `${offer.name} 구매 제한에 도달했습니다.`);

  const tokenCount = Number(current.inventory[offer.cost.itemId] || 0);
  const maxByCurrency = Math.floor(tokenCount / Math.max(1, Number(offer.cost.qty || 1)));
  const buyCount = Math.max(0, Math.floor(Math.min(maxByCurrency, remainingByLimit)));
  if (buyCount <= 0) return addLog(current, `${offer.name} 최대 구매 실패. ${itemName(offer.cost.itemId)}이 부족합니다.`);

  let next = {
    ...current,
    inventory: addItem(current.inventory, offer.cost.itemId, -offer.cost.qty * buyCount),
  };
  const sampleLabels = [];
  for (let index = 0; index < buyCount; index += 1) {
    const rng = createRng(`${current.runId}|tower-shop|max|${offer.id}|${bought + index}|${current.counters.SHOP_BUY}`);
    const granted = grantTowerShopReward(next, offer, rng);
    next = {
      ...next,
      inventory: granted.inventory,
      equipment: granted.equipment,
      salvageQueue: granted.salvageQueue,
    };
    if (sampleLabels.length < 3 && granted.label) sampleLabels.push(granted.label);
  }

  return addLog({
    ...next,
    towerShop: setTowerShopBought(towerShop, offer, bought + buyCount),
    counters: bumpCounter(current.counters, 'SHOP_BUY', buyCount),
  }, `${offer.name} 최대 구매 ${buyCount}회 완료. ${sampleLabels.join(', ')}${buyCount > sampleLabels.length ? ` 외 ${buyCount - sampleLabels.length}회` : ''}`);
}

export function resetTowerShopRotationAction(state, scope = 'DAILY') {
  const current = ensureTowerShopState(normalizeState(state));
  const isWeekly = scope === 'WEEKLY';
  const rotation = current.towerShop.rotation;
  const cost = isWeekly ? TOWER_SHOP_ROTATION.weeklyResetCost : TOWER_SHOP_ROTATION.dailyResetCost;
  const max = isWeekly ? TOWER_SHOP_ROTATION.weeklyResetMax : TOWER_SHOP_ROTATION.dailyResetMax;
  const used = isWeekly ? rotation.weeklyResetsUsed : rotation.dailyResetsUsed;
  const label = isWeekly ? '이번주 픽업' : '오늘 픽업';

  if (used >= max) return addLog(current, `${label} 리셋 한도에 도달했습니다.`);
  if (Number(current.inventory.itm_tower_token || 0) < cost) return addLog(current, `${label} 리셋 실패. ${itemName('itm_tower_token')} ${cost}개가 필요합니다.`);

  const towerShop = {
    ...current.towerShop,
    rotation: isWeekly ? {
      ...rotation,
      weeklyOfferIds: [],
      weeklyNonce: Number(rotation.weeklyNonce || 0) + 1,
      weeklyResetsUsed: used + 1,
    } : {
      ...rotation,
      dailyOfferIds: [],
      dailyNonce: Number(rotation.dailyNonce || 0) + 1,
      dailyResetsUsed: used + 1,
    },
  };
  const next = ensureTowerShopState({
    ...current,
    inventory: addItem(current.inventory, 'itm_tower_token', -cost),
    towerShop,
  });
  return addLog(next, `${label} 상점을 리셋했습니다. ${itemName('itm_tower_token')} -${cost}`);
}

export function attemptTowerAction(state, count = 1, stopOnFail = true) {
  let next = normalizeState(state);
  const requested = Math.max(1, Number(count || 1));
  const rng = createRng(`${next.runId}|tower|${next.towerFloor}|${next.counters.ATTEMPT_TOWER}|${requested}|${stopOnFail ? 'stop' : 'run'}`);
  const rewardMul = rewardCreditMul(next);
  let successCount = 0;
  let failCount = 0;
  let credits = 0;
  let tokens = 0;
  const logs = [];

  for (let index = 0; index < requested; index += 1) {
    if (Number(next.inventory.itm_tower_key || 0) <= 0) {
      logs.push('열쇠가 부족해 배치 도전을 중단했습니다.');
      break;
    }
    const floor = Number(next.towerFloor || 1);
    const lossStreak = Math.max(0, Math.floor(Number(next.towerLossStreak || 0)));
    const catchup = 1 + clamp(0.06 * lossStreak, 0, 0.24);
    const probability = winProb(teamPower(next) * catchup, towerDifficulty(floor), 1.7);
    next = {
      ...next,
      inventory: addItem(next.inventory, 'itm_tower_key', -1),
      counters: bumpCounter(next.counters, 'ATTEMPT_TOWER', 1),
    };
    if (rng() < probability) {
      const reward = Math.round(towerReward(floor) * rewardMul);
      const tokenGain = 1 + Math.floor((floor - 1) / 10) + (floor % 5 === 0 ? 1 : 0);
      successCount += 1;
      credits += reward;
      tokens += tokenGain;
      logs.push(`F${floor} 성공: +${reward} Cr, 토큰 +${tokenGain}, 연패보정 x${catchup.toFixed(2)}`);
      let inventory = addItem(next.inventory, 'itm_tower_token', tokenGain);
      if (floor % TOWER.milestoneEvery === 0) inventory = addItem(inventory, 'itm_tower_key', 1);
      next = {
        ...next,
        towerFloor: floor + 1,
        towerMaxCleared: Math.max(Number(next.towerMaxCleared || 0), floor),
        towerLossStreak: 0,
        credits: Number(next.credits || 0) + reward,
        inventory,
        counters: bumpCounter(next.counters, 'CLEAR_TOWER', 1),
      };
    } else {
      failCount += 1;
      logs.push(`F${floor} 실패: 성공률 ${Math.round(probability * 100)}%, 연패보정 x${catchup.toFixed(2)}`);
      next = {
        ...next,
        towerLossStreak: Number(next.towerLossStreak || 0) + 1,
      };
      if (stopOnFail) break;
    }
  }

  next = addLifetimeCounters({
    ...next,
    towerLastBatchReport: {
      at: Date.now(),
      requested,
      stopOnFail: stopOnFail !== false,
      successes: successCount,
      failures: failCount,
      creditsGained: credits,
      tokensGained: tokens,
      logs: logs.slice(-30),
    },
  }, {
    ATTEMPT_TOWER: successCount + failCount,
    CLEAR_TOWER: successCount,
    EARN_CREDITS: credits,
  });
  return addLog(next, `시련의 탑 ${requested}회 요청: 성공 ${successCount}, 실패 ${failCount}, +${credits} Cr.`);
}

export function claimMissionRewardsAction(state) {
  let next = normalizeState(state);
  let claimed = 0;
  let credits = 0;
  let inventory = next.inventory;
  const claimedSet = new Set(next.claimedMissions);
  const rewardMul = rewardCreditMul(next);

  MISSIONS.forEach((mission) => {
    if (claimedSet.has(mission.id)) return;
    if (Number(next.counters[mission.action] || 0) < mission.target) return;
    claimedSet.add(mission.id);
    claimed += 1;
    credits += Math.round(Number(mission.rewardCredits || 0) * rewardMul);
    inventory = addItems(inventory, mission.rewardItems);
  });

  if (!claimed) return addLog(next, '수령 가능한 미션 보상이 없습니다.');
  next = addLifetimeCounters({
    ...next,
    credits: Number(next.credits || 0) + credits,
    inventory,
    claimedMissions: [...claimedSet],
  }, { EARN_CREDITS: credits });
  return addLog(next, `미션 ${claimed}개 보상 수령. +${credits} Cr.`);
}

export function claimAchievementRewardsAction(state) {
  let next = normalizeState(state);
  const rows = achievementRows(next);
  const rewardMul = rewardCreditMul(next);
  let claimed = 0;
  let credits = 0;
  const claims = { ...next.achievementClaims };
  const titleIds = new Set(next.unlockedTitleIds);

  rows.forEach((achievement) => {
    if (!achievement.canClaim) return;
    claims[achievement.id] = true;
    claimed += 1;
    credits += Math.round(Number(achievement.rewardCredits || 0) * rewardMul);
    if (achievement.unlockTitleId) titleIds.add(achievement.unlockTitleId);
  });

  if (!claimed) return addLog(next, '수령 가능한 업적 보상이 없습니다.');
  next = addLifetimeCounters({
    ...next,
    credits: Number(next.credits || 0) + credits,
    achievementClaims: claims,
    unlockedTitleIds: [...titleIds],
  }, { EARN_CREDITS: credits });
  return addLog(next, `업적 ${claimed}개 보상 수령. +${credits} Cr${titleIds.size !== next.unlockedTitleIds.length ? ', 새 칭호 해금' : ''}.`);
}

export function equipTitleAction(state, titleId) {
  const current = normalizeState(state);
  if (!titleId) return addLog({ ...current, equippedTitleId: null }, '칭호를 해제했습니다.');
  const title = titleById(titleId);
  if (!title) return addLog(current, '칭호를 찾을 수 없습니다.');
  if (!current.unlockedTitleIds.includes(title.id)) return addLog(current, `${title.name} 칭호는 아직 해금되지 않았습니다.`);
  return addLog({ ...current, equippedTitleId: title.id }, `${title.name} 칭호를 장착했습니다. ${title.desc}`);
}

function makeEquipmentPresetId(state) {
  return `preset-${Date.now().toString(36)}-${Math.max(0, normalizeEquipmentPresets(state.equipmentPresets).length + 1)}`;
}

function presetAvailability(state, preset) {
  const currentUids = new Set([
    ...Object.values(state.equipment || {}).map((equip) => equip?.uid).filter(Boolean),
    ...(state.salvageQueue || []).map((entry) => entry?.uid).filter(Boolean),
  ]);
  const items = Object.values(preset.equipment || {}).filter(Boolean);
  const available = items.filter((equip) => currentUids.has(equip.uid)).length;
  return {
    equippedCount: items.length,
    availableCount: available,
    missingCount: Math.max(0, items.length - available),
  };
}

export function equipmentPresetRows(state) {
  const current = normalizeState(state);
  return normalizeEquipmentPresets(current.equipmentPresets).map((preset) => ({
    ...preset,
    ...presetAvailability(current, preset),
    active: preset.id === current.activePresetId,
  }));
}

export function saveEquipmentPresetAction(state, name = '') {
  const current = normalizeState(state);
  const equipment = cloneEquipmentMap(current.equipment);
  const equippedCount = Object.keys(equipment).length;
  if (!equippedCount) return addLog(current, '저장할 장착 장비가 없습니다.');
  const presetName = String(name || '').trim() || `프리셋 ${normalizeEquipmentPresets(current.equipmentPresets).length + 1}`;
  const preset = {
    id: makeEquipmentPresetId(current),
    name: presetName,
    equipment,
    createdAt: Date.now(),
  };
  const presets = [preset, ...normalizeEquipmentPresets(current.equipmentPresets)].slice(0, 12);
  return addLog({
    ...current,
    equipmentPresets: presets,
    activePresetId: preset.id,
  }, `장비 프리셋 저장: ${preset.name} (${equippedCount}개 슬롯)`);
}

export function applyEquipmentPresetAction(state, presetId) {
  const current = normalizeState(state);
  const preset = normalizeEquipmentPresets(current.equipmentPresets).find((row) => row.id === presetId);
  if (!preset) return addLog(current, '장비 프리셋을 찾을 수 없습니다.');

  const currentByUid = new Map(Object.values(current.equipment || {}).filter(Boolean).map((equip) => [equip.uid, equip]));
  const queueByUid = new Map((current.salvageQueue || []).filter((entry) => entry?.uid).map((entry) => [entry.uid, entry]));
  const usedUids = new Set();
  let missing = 0;
  let salvageQueue = current.salvageQueue || [];
  const equipment = {};

  Object.keys(SLOT_LABELS).forEach((slot) => {
    const savedEquip = cloneEquipmentInstance(preset.equipment?.[slot]);
    if (!savedEquip) return;
    const currentEquip = currentByUid.get(savedEquip.uid);
    const queuedEntry = queueByUid.get(savedEquip.uid);
    if (!currentEquip && !queuedEntry) {
      missing += 1;
      return;
    }
    usedUids.add(savedEquip.uid);
    equipment[slot] = cloneEquipmentInstance(currentEquip || queuedEntry.equip || savedEquip);
    salvageQueue = salvageQueue.filter((entry) => entry.uid !== savedEquip.uid);
  });

  Object.values(current.equipment || {}).forEach((equip) => {
    if (!equip?.uid || usedUids.has(equip.uid)) return;
    salvageQueue = queueSalvage(salvageQueue, equip, '프리셋 교체 장비');
  });

  const equippedCount = Object.keys(equipment).length;
  return addLog({
    ...current,
    equipment,
    salvageQueue: salvageQueue.slice(0, 40),
    activePresetId: preset.id,
  }, `장비 프리셋 적용: ${preset.name} (${equippedCount}개 장착${missing ? `, ${missing}개 누락` : ''})`);
}

export function deleteEquipmentPresetAction(state, presetId) {
  const current = normalizeState(state);
  const presets = normalizeEquipmentPresets(current.equipmentPresets);
  const target = presets.find((row) => row.id === presetId);
  if (!target) return addLog(current, '삭제할 장비 프리셋을 찾을 수 없습니다.');
  const nextPresets = presets.filter((row) => row.id !== presetId);
  return addLog({
    ...current,
    equipmentPresets: nextPresets,
    activePresetId: current.activePresetId === presetId ? '' : current.activePresetId,
  }, `장비 프리셋 삭제: ${target.name}`);
}

export function inventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([itemId, qty]) => ({ itemId, name: itemName(itemId), qty, rarity: getItem(itemId)?.rarity || 'COMMON' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

export function salvageRows(state) {
  const current = normalizeState(state);
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const targetUids = new Set(salvageTargetRows(current.salvageQueue, candidateOnly).map((entry) => entry.uid));
  return current.salvageQueue.map((entry) => {
    const value = salvageValue(entry);
    return {
      ...entry,
      highRisk: isHighRiskSalvageEntry(entry),
      executable: targetUids.has(entry.uid),
      rewardText: `고철 ${value.scrap}${value.stone ? `, 강화석 ${value.stone}` : ''}${value.ticket ? `, 리롤권 ${value.ticket}` : ''}`,
    };
  });
}

export function salvageSummary(state) {
  const current = normalizeState(state);
  const rows = salvageRows(current);
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const executableRows = rows.filter((entry) => entry.executable);
  const protectedRows = rows.filter((entry) => !entry.executable);
  const totals = salvageTotals(executableRows);
  const byRarity = rows.reduce((next, entry) => ({
    ...next,
    [entry.rarity]: Number(next[entry.rarity] || 0) + 1,
  }), {});
  const bySlot = rows.reduce((next, entry) => ({
    ...next,
    [entry.slot]: Number(next[entry.slot] || 0) + 1,
  }), {});
  const riskyRows = rows
    .filter((entry) => entry.highRisk)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return {
    queued: executableRows.length,
    totalQueued: rows.length,
    executableCount: executableRows.length,
    protectedByCandidateOnly: protectedRows.length,
    candidateOnly,
    protectedEquipped: getEquippedList(current).length,
    totals,
    totalRewardText: salvageRewardText(totals),
    highRiskCount: riskyRows.length,
    topRiskRows: riskyRows.slice(0, 3),
    byRarityText: Object.entries(byRarity).map(([rarity, count]) => `${rarity} ${count}`).join(' · ') || '없음',
    bySlotText: Object.entries(bySlot).map(([slot, count]) => `${slotLabel(slot)} ${count}`).join(' · ') || '없음',
  };
}

export function selectedSalvageSummary(state, selectedUids = []) {
  const current = normalizeState(state);
  const selectedUidSet = normalizeSelectedSalvageUids(selectedUids);
  const rows = salvageRows(current).filter((entry) => selectedUidSet.has(entry.uid));
  const executableRows = rows.filter((entry) => entry.executable);
  const protectedRows = rows.filter((entry) => !entry.executable);
  const totals = salvageTotals(executableRows);
  const riskyRows = rows
    .filter((entry) => entry.highRisk)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return {
    selectedCount: rows.length,
    requestedCount: selectedUidSet.size,
    staleCount: Math.max(0, selectedUidSet.size - rows.length),
    executableCount: executableRows.length,
    protectedByCandidateOnly: protectedRows.length,
    candidateOnly: current.salvageSettings?.candidateOnly !== false,
    totals,
    totalRewardText: salvageRewardText(totals),
    highRiskCount: riskyRows.length,
    topRiskRows: riskyRows.slice(0, 3),
  };
}

export function towerShopRows(state) {
  const current = ensureTowerShopState(normalizeState(state));
  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  return TOWER_SHOP_OFFERS.filter((offer) => activeIds.has(offer.id)).map((offer) => {
    const bought = getTowerShopBought(towerShop, offer);
    const max = Number(offer.limit?.max || 999);
    const remaining = Math.max(0, max - bought);
    const maxBuyCount = Math.max(0, Math.floor(Math.min(
      remaining,
      Math.floor(Number(current.inventory[offer.cost.itemId] || 0) / Math.max(1, Number(offer.cost.qty || 1))),
    )));
    return {
      ...offer,
      bought,
      remaining,
      maxBuyCount,
      canBuy: remaining > 0 && Number(current.inventory[offer.cost.itemId] || 0) >= offer.cost.qty,
      canBuyMax: maxBuyCount > 1,
      costText: `${itemName(offer.cost.itemId)} ${offer.cost.qty}`,
      limitText: offer.limit ? `${offer.limit.period === 'WEEKLY' ? '주간' : '일일'} ${bought}/${max}` : '상시',
      pickupLabel: towerShopPickupLabel(towerShop, offer.id),
    };
  });
}

export function towerShopRotationSummary(state) {
  const current = ensureTowerShopState(normalizeState(state));
  const rotation = current.towerShop.rotation;
  const tokenCount = Number(current.inventory.itm_tower_token || 0);
  return {
    dailyKey: rotation.dailyKey,
    weeklyKey: rotation.weeklyKey,
    dailyCount: rotation.dailyOfferIds.length,
    weeklyCount: rotation.weeklyOfferIds.length,
    dailyResetsUsed: rotation.dailyResetsUsed,
    dailyResetMax: TOWER_SHOP_ROTATION.dailyResetMax,
    dailyResetCost: TOWER_SHOP_ROTATION.dailyResetCost,
    weeklyResetsUsed: rotation.weeklyResetsUsed,
    weeklyResetMax: TOWER_SHOP_ROTATION.weeklyResetMax,
    weeklyResetCost: TOWER_SHOP_ROTATION.weeklyResetCost,
    dailyPityCounter: rotation.dailyPityCounter,
    dailyPityTrigger: TOWER_SHOP_ROTATION.dailyPity?.trigger || 0,
    weeklyPityCounter: rotation.weeklyPityCounter,
    weeklyPityTrigger: TOWER_SHOP_ROTATION.weeklyPity?.trigger || 0,
    tokenCount,
    canResetDaily: rotation.dailyResetsUsed < TOWER_SHOP_ROTATION.dailyResetMax && tokenCount >= TOWER_SHOP_ROTATION.dailyResetCost,
    canResetWeekly: rotation.weeklyResetsUsed < TOWER_SHOP_ROTATION.weeklyResetMax && tokenCount >= TOWER_SHOP_ROTATION.weeklyResetCost,
  };
}

export function availableEnhanceSlots(state) {
  return getEquippedList(state).map((equip) => equip.slot);
}

export function upgradeRows(state) {
  const current = normalizeState(state);
  return UPGRADE_DEFS.map((def) => {
    const level = Math.max(0, Math.floor(Number(current.upgrades[def.id] || 0)));
    const cost = upgradeCost(def.id, level + 1);
    const costItemText = Object.entries(cost.items)
      .map(([itemId, qty]) => `${itemName(itemId)} ${qty}`)
      .join(', ');
    const powerBonus = Math.round(Number(def.powerMulPerLevel || 0) * 100);
    const staminaBonus = Math.round(Number(def.staminaMulPerLevel || 0) * 100);
    return {
      ...def,
      level,
      nextLevel: level + 1,
      costCredits: cost.credits,
      costItems: cost.items,
      costItemText,
      bonusText: `${powerBonus ? `전투력 +${powerBonus}%/Lv` : ''}${staminaBonus ? ` · 스태미나 효율 +${staminaBonus}%/Lv` : ''}`.trim(),
      canUpgrade: Number(current.credits || 0) >= cost.credits && hasItems(current.inventory, cost.items),
    };
  });
}

export function missionRows(state) {
  const current = normalizeState(state);
  const claimed = new Set(current.claimedMissions);
  return MISSIONS.map((mission) => {
    const progress = Number(current.counters[mission.action] || 0);
    return {
      ...mission,
      progress,
      done: progress >= mission.target,
      claimed: claimed.has(mission.id),
    };
  });
}

export function scoreState(state) {
  const current = normalizeState(state);
  return Math.max(0, Math.round(
    Number(current.maxClearedFloor || 0) * 35
    + Number(current.towerMaxCleared || 0) * 80
    + Number(current.credits || 0)
    + teamPower(current) * 4
    + getEquippedList(current).reduce((sum, equip) => sum + equipmentScore(equip), 0) * 6
    + Number(current.counters.REROLL || 0) * 40
    + Number(current.counters.SALVAGE || 0) * 12
    + Number(current.counters.SHOP_BUY || 0) * 35
    + Number(current.counters.UPGRADE || 0) * 120
    + achievementRows(current).filter((achievement) => achievement.claimed).length * 250
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  return {
    floor: current.floor,
    maxClearedFloor: current.maxClearedFloor,
    towerFloor: current.towerFloor,
    towerMaxCleared: current.towerMaxCleared,
    credits: current.credits,
    stamina: current.stamina,
    power: teamPower(current),
    score: scoreState(current),
    rerolls: Number(current.counters.REROLL || 0),
    salvaged: Number(current.counters.SALVAGE || 0),
    towerShopBuys: Number(current.counters.SHOP_BUY || 0),
    upgrades: { ...current.upgrades },
    salvageQueued: current.salvageQueue.length,
    achievements: achievementRows(current).filter((achievement) => achievement.claimed).length,
    equippedTitle: titleById(current.equippedTitleId)?.name || '',
    lastDutyReport: current.lastDutyReport ? {
      fromFloor: current.lastDutyReport.fromFloor,
      toFloor: current.lastDutyReport.toFloor,
      credits: current.lastDutyReport.totalCreditsGained,
      stoppedReason: current.lastDutyReport.stoppedReason,
    } : null,
    offlineLastSummary: current.offlineLastSummary ? {
      waves: Number(current.offlineLastSummary.waves || 0),
      credits: Number(current.offlineLastSummary.creditsGained || 0),
      tokens: Number(current.offlineLastSummary.tokensGained || 0),
    } : null,
  };
}
