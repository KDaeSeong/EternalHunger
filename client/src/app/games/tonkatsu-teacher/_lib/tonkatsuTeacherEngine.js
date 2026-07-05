export const GAME_SLUG = 'tonkatsu-teacher';
export const QUICK_SAVE_SLOT = 'tonkatsu-teacher-main';
export const SAVE_VERSION = 'tonkatsu-teacher-v1';

export const INGREDIENTS = [
  { id: 'pork', name: '돼지고기', price: 14, rarity: 1, tags: ['meat', 'main'] },
  { id: 'flour', name: '밀가루', price: 8, rarity: 1, tags: ['staple'] },
  { id: 'egg', name: '달걀', price: 8, rarity: 1, tags: ['staple'] },
  { id: 'breadcrumb', name: '빵가루', price: 9, rarity: 1, tags: ['fried'] },
  { id: 'oil', name: '식용유', price: 10, rarity: 1, tags: ['fried'] },
  { id: 'rice', name: '밥', price: 8, rarity: 1, tags: ['hearty'] },
  { id: 'cabbage', name: '양배추', price: 10, rarity: 1, tags: ['salad', 'light'] },
  { id: 'apple', name: '사과', price: 26, rarity: 2, tags: ['sweet', 'fruit'] },
  { id: 'milk', name: '우유', price: 12, rarity: 1, tags: ['dessert'] },
  { id: 'cheese', name: '치즈', price: 28, rarity: 2, tags: ['cheese'] },
  { id: 'gochujang', name: '고추장', price: 28, rarity: 2, tags: ['spicy'] },
  { id: 'curry', name: '카레가루', price: 30, rarity: 2, tags: ['curry'] },
  { id: 'garlic', name: '마늘', price: 12, rarity: 1, tags: ['aroma', 'savory', 'garlic'] },
  { id: 'soy_sauce', name: '간장', price: 12, rarity: 1, tags: ['sauce', 'umami', 'salty', 'soy'] },
  { id: 'butter', name: '버터', price: 30, rarity: 2, tags: ['buttery', 'rich', 'creamy'] },
  { id: 'lemon', name: '레몬', price: 26, rarity: 2, tags: ['citrus', 'light', 'refreshing', 'fruit'] },
  { id: 'honey', name: '꿀', price: 30, rarity: 2, tags: ['sweet', 'honey', 'dessert'] },
  { id: 'yogurt', name: '요거트', price: 24, rarity: 2, tags: ['yogurt', 'cool', 'dessert', 'creamy'] },
];

export const RECIPES = [
  {
    id: 'basic_tonkatsu',
    name: '기본 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'basic'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, rice: 1 },
    craftCost: 20,
    yieldTokens: 1,
    sellPrice: 82,
    power: 18,
    note: '초기 영업과 전투 버프의 기준 메뉴입니다.',
  },
  {
    id: 'cabbage_salad',
    name: '양배추 샐러드',
    category: 'side',
    tags: ['salad', 'light'],
    needs: { cabbage: 2, apple: 1 },
    craftCost: 12,
    yieldTokens: 1,
    sellPrice: 54,
    power: 9,
    note: '가벼운 사이드 메뉴라 학생 피로 회복에 좋습니다.',
  },
  {
    id: 'milk_pudding',
    name: '우유 푸딩',
    category: 'dessert',
    tags: ['dessert', 'sweet'],
    needs: { milk: 2, egg: 1, apple: 1 },
    craftCost: 15,
    yieldTokens: 1,
    sellPrice: 66,
    power: 11,
    note: '평판을 조금 더 잘 올리는 디저트입니다.',
  },
  {
    id: 'spicy_tonkatsu',
    name: '고추장 매운 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'spicy'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, gochujang: 1, rice: 1 },
    craftCost: 30,
    yieldTokens: 1,
    sellPrice: 112,
    power: 28,
    unlock: { type: 'research' },
    note: '공격적인 학생에게 잘 맞는 고화력 메뉴입니다.',
  },
  {
    id: 'cheese_tonkatsu',
    name: '치즈 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'cheese'],
    needs: { pork: 1, cheese: 2, flour: 1, egg: 1, breadcrumb: 1, oil: 1, rice: 1 },
    craftCost: 35,
    yieldTokens: 1,
    sellPrice: 126,
    power: 31,
    unlock: { type: 'research' },
    note: '방어형 학생에게 안정적인 전투 보정을 줍니다.',
  },
  {
    id: 'curry_tonkatsu',
    name: '카레 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'curry', 'hearty'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, curry: 1, rice: 2 },
    craftCost: 38,
    yieldTokens: 1,
    sellPrice: 136,
    power: 34,
    unlock: { type: 'tournament', tier: 'rookie' },
    note: '체력과 방어를 함께 밀어주는 든든한 메뉴입니다.',
  },
  {
    id: 'apple_sauce_tonkatsu',
    name: '사과 소스 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'sweet'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, apple: 2, rice: 1 },
    craftCost: 28,
    yieldTokens: 1,
    sellPrice: 118,
    power: 27,
    unlock: { type: 'research' },
    note: '달콤한 소스와 튀김 조합으로 드랍 보정이 좋은 메뉴입니다.',
  },
  {
    id: 'crispy_katsu_sand',
    name: '바삭 돈카츠 샌드',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'speed'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 2, oil: 1, cabbage: 1 },
    craftCost: 26,
    yieldTokens: 1,
    sellPrice: 106,
    power: 26,
    unlock: { type: 'facility', facilityId: 'counter', level: 2 },
    note: '영업 카운터 확장 후 만드는 빠른 회전용 메뉴입니다.',
  },
  {
    id: 'croquette',
    name: '감자 고로케',
    category: 'side',
    tags: ['fried', 'hearty'],
    needs: { breadcrumb: 1, egg: 1, flour: 1, oil: 1, rice: 1 },
    craftCost: 18,
    yieldTokens: 1,
    sellPrice: 72,
    power: 20,
    unlock: { type: 'facility', facilityId: 'fryer', level: 2 },
    note: '튀김기 강화 후 해금되는 든든한 사이드 메뉴입니다.',
  },
  {
    id: 'milk_ice',
    name: '밀크 아이스',
    category: 'dessert',
    tags: ['dessert', 'cool'],
    needs: { milk: 2, apple: 1 },
    craftCost: 14,
    yieldTokens: 1,
    sellPrice: 62,
    power: 16,
    unlock: { type: 'tournament', tier: 'intermediate' },
    note: '중급 대회 이후 활용하기 좋은 시원한 후식입니다.',
  },
  {
    id: 'garlic_soy_grilled_pork',
    name: '마늘 간장 그릴 포크',
    category: 'main',
    tags: ['grilled', 'smoky', 'savory', 'garlic', 'soy'],
    needs: { pork: 1, garlic: 1, soy_sauce: 1, rice: 1 },
    craftCost: 34,
    yieldTokens: 1,
    sellPrice: 128,
    power: 32,
    unlock: { type: 'facility', facilityId: 'grill', level: 1 },
    note: '그릴 스테이션으로 여는 훈연 계열 첫 메뉴입니다.',
  },
  {
    id: 'honey_lemon_tonkatsu',
    name: '허니 레몬 글레이즈 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'citrus', 'honey', 'sweet', 'refreshing'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, honey: 1, lemon: 1 },
    craftCost: 42,
    yieldTokens: 1,
    sellPrice: 154,
    power: 38,
    unlock: { type: 'tournament', tier: 'advanced' },
    note: '상급 대회 이후 해금되는 고급 글레이즈 메뉴입니다.',
  },
  {
    id: 'butter_curry_tonkatsu',
    name: '버터 풍미 카레 돈카츠',
    category: 'main',
    tags: ['fried', 'tonkatsu', 'curry', 'buttery', 'rich'],
    needs: { pork: 1, flour: 1, egg: 1, breadcrumb: 1, oil: 1, curry: 1, butter: 1 },
    craftCost: 46,
    yieldTokens: 1,
    sellPrice: 162,
    power: 40,
    unlock: { type: 'research' },
    note: '연구로 해금하는 고급 카레 메뉴입니다.',
  },
  {
    id: 'yogurt_parfait',
    name: '요거트 파르페',
    category: 'dessert',
    tags: ['dessert', 'yogurt', 'cool', 'fruit', 'refreshing'],
    needs: { yogurt: 1, apple: 1, honey: 1 },
    craftCost: 20,
    yieldTokens: 1,
    sellPrice: 82,
    power: 19,
    unlock: { type: 'tournament', tier: 'intermediate' },
    note: '중급 대회 보상권에서 열리는 회복형 디저트입니다.',
  },
  {
    id: 'garlic_cabbage',
    name: '마늘 간장 양배추무침',
    category: 'side',
    tags: ['side', 'garlic', 'savory', 'light'],
    needs: { cabbage: 1, garlic: 1, soy_sauce: 1 },
    craftCost: 18,
    yieldTokens: 1,
    sellPrice: 68,
    power: 18,
    unlock: { type: 'research' },
    note: '저비용 연구로 여는 가벼운 마늘 간장 사이드입니다.',
  },
];

export const STUDENTS = [
  { id: 'yuuka', name: '유우카', role: '탱커', hp: 120, atk: 9, def: 12, pref: 'hearty', weak: 'spicy' },
  { id: 'shiroko', name: '시로코', role: '러너', hp: 95, atk: 12, def: 7, pref: 'fried', weak: 'hearty' },
  { id: 'hina', name: '히나', role: '딜러', hp: 105, atk: 11, def: 9, pref: 'spicy', weak: 'dessert' },
  { id: 'noa', name: '노아', role: '서포터', hp: 100, atk: 10, def: 8, pref: 'salad', weak: 'fried' },
  { id: 'mika', name: '미카', role: '브루저', hp: 110, atk: 12, def: 7, pref: 'cheese', weak: 'salad' },
];

export const DEFAULT_UNLOCKED_RECIPES = ['basic_tonkatsu', 'cabbage_salad', 'milk_pudding'];

export const RESEARCH_PROJECTS = [
  { recipeId: 'apple_sauce_tonkatsu', name: '사과 소스 돈카츠 연구', gold: 180, recipeShards: 20 },
  { recipeId: 'spicy_tonkatsu', name: '매운 돈카츠 연구', gold: 220, recipeShards: 6 },
  { recipeId: 'cheese_tonkatsu', name: '치즈 돈카츠 연구', gold: 280, recipeShards: 8 },
  { recipeId: 'butter_curry_tonkatsu', name: '버터 카레 돈카츠 연구', gold: 80, recipeShards: 8 },
  { recipeId: 'garlic_cabbage', name: '마늘 양배추무침 연구', gold: 40, recipeShards: 4 },
];

export const FACILITIES = [
  {
    id: 'fryer',
    name: '튀김기',
    maxLevel: 5,
    effect: 'fried',
    levels: [
      { level: 2, gold: 120, productionMult: 1.06, failReduce: 0.01 },
      { level: 3, gold: 280, productionMult: 1.08, failReduce: 0.01 },
      { level: 4, gold: 520, productionMult: 1.1, failReduce: 0.02 },
      { level: 5, gold: 900, productionMult: 1.12, bonusChance: 0.08 },
    ],
  },
  {
    id: 'fridge',
    name: '냉장고',
    maxLevel: 5,
    effect: 'storage',
    levels: [
      { level: 2, gold: 100, storageCap: 60, rareDropPct: 0.02 },
      { level: 3, gold: 260, storageCap: 80, rareDropPct: 0.03 },
      { level: 4, gold: 480, storageCap: 100, rareDropPct: 0.04 },
      { level: 5, gold: 820, storageCap: 130, rareDropPct: 0.06 },
    ],
  },
  {
    id: 'counter',
    name: '영업 카운터',
    maxLevel: 5,
    effect: 'orders',
    levels: [
      { level: 2, gold: 140, dailyOrders: 4, goldMult: 1.04 },
      { level: 3, gold: 320, dailyOrders: 5, goldMult: 1.07 },
      { level: 4, gold: 620, dailyOrders: 6, goldMult: 1.1 },
      { level: 5, gold: 960, dailyOrders: 8, goldMult: 1.14 },
    ],
  },
  {
    id: 'delivery',
    name: '배달 창구',
    maxLevel: 4,
    effect: 'delivery',
    levels: [
      { level: 2, gold: 180, deliveryUnlocked: true, deliveryGoldMult: 1.08 },
      { level: 3, gold: 420, deliveryUnlocked: true, deliveryGoldMult: 1.14, deliveryMaterialChance: 0.08 },
      { level: 4, gold: 760, deliveryUnlocked: true, deliveryGoldMult: 1.22, deliveryMaterialChance: 0.14 },
    ],
  },
  {
    id: 'lab',
    name: '레시피 연구대',
    maxLevel: 4,
    effect: 'research',
    levels: [
      { level: 2, gold: 160, recipeShardBonus: 1, contestMult: 1.03 },
      { level: 3, gold: 360, recipeShardBonus: 2, contestMult: 1.06 },
      { level: 4, gold: 720, recipeShardBonus: 3, contestMult: 1.1 },
    ],
  },
  {
    id: 'grill',
    name: '그릴 스테이션',
    maxLevel: 3,
    effect: 'grilled',
    levels: [
      { level: 2, gold: 240, productionMult: 1.1, failReduce: 0.03 },
      { level: 3, gold: 600, productionMult: 1.2, failReduce: 0.06, contestMult: 1.05 },
    ],
  },
];

export const TOURNAMENT_THEMES = [
  { id: 'crispy', name: '바삭함', targetTags: ['fried'], avoidTags: [], desc: '튀김의 식감과 안정감을 봅니다.' },
  { id: 'comfort', name: '든든함', targetTags: ['hearty'], avoidTags: ['light'], desc: '든든하고 균형 잡힌 메뉴가 유리합니다.' },
  { id: 'spicy', name: '매운맛', targetTags: ['spicy'], avoidTags: ['dessert'], desc: '강한 맛과 공격적인 구성이 유리합니다.' },
  { id: 'light', name: '가벼운 한 끼', targetTags: ['salad', 'light'], avoidTags: ['hearty'], desc: '부담 없는 구성이 높은 점수를 받습니다.' },
  { id: 'cheese', name: '치즈 파티', targetTags: ['cheese'], avoidTags: ['salad'], desc: '진한 풍미가 핵심입니다.' },
  { id: 'sweet', name: '달콤한 마무리', targetTags: ['sweet', 'dessert'], avoidTags: ['spicy'], desc: '디저트와 단맛 구성이 유리합니다.' },
];

export const TOURNAMENT_TIERS = [
  { id: 'rookie', name: '루키', entryGold: 90, targetScore: 58, rewardGold: 180, rewardRep: 14, rewardShards: 4, unlockRecipes: ['curry_tonkatsu'] },
  { id: 'intermediate', name: '중급', entryGold: 180, targetScore: 72, rewardGold: 360, rewardRep: 30, rewardShards: 8, unlockRecipes: ['milk_ice', 'yogurt_parfait'] },
  { id: 'advanced', name: '상급', entryGold: 340, targetScore: 86, rewardGold: 720, rewardRep: 58, rewardShards: 14, unlockRecipes: ['honey_lemon_tonkatsu'] },
];

const JUDGE_AI_CHEFS = [
  { id: 'sakuroko', name: '사쿠라코 셰프', style: '정석', preferTags: ['fried', 'hearty'], avoidTags: ['spicy'] },
  { id: 'rico', name: '리코 셰프', style: '실험파', preferTags: ['sweet', 'dessert'], avoidTags: ['hearty'] },
  { id: 'hina', name: '히나 셰프', style: '강공', preferTags: ['spicy', 'fried'], avoidTags: ['light'] },
  { id: 'noa', name: '노아 셰프', style: '분석', preferTags: ['salad', 'light'], avoidTags: ['cheese'] },
  { id: 'mika', name: '미카 셰프', style: '중량감', preferTags: ['cheese', 'hearty'], avoidTags: ['dessert'] },
  { id: 'shiroko', name: '시로코 셰프', style: '속도전', preferTags: ['fried', 'light'], avoidTags: ['curry'] },
];

export const JUDGE_BATCH_MODE_LABELS = {
  random: '랜덤 선택',
  strong: '강한 쪽 선택',
  weak: '약한 쪽 선택',
};

export const JUDGE_HISTORY_MODE_LABELS = {
  all: '전체',
  manual: '수동',
  random: '랜덤',
  strong: '강한 쪽',
  weak: '약한 쪽',
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function makeStudents() {
  return STUDENTS.map((student) => ({
    ...student,
    currentHp: student.hp,
    morale: 60,
    meal: '',
    wins: 0,
  }));
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `tt-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    day: 1,
    gold: 260,
    reputation: 0,
    recipeShards: 8,
    floor: 1,
    businessMode: 'hall',
    facilityLevels: Object.fromEntries(FACILITIES.map((facility) => [facility.id, 1])),
    unlockedRecipeIds: DEFAULT_UNLOCKED_RECIPES,
    clearedTournamentTiers: [],
    tournamentHistory: [],
    inventory: {
      pork: 4,
      flour: 4,
      egg: 4,
      breadcrumb: 4,
      oil: 4,
      rice: 4,
      cabbage: 3,
      apple: 2,
      milk: 2,
      garlic: 2,
      soy_sauce: 2,
    },
    mealTokens: {},
    students: makeStudents(),
    judgeMatch: null,
    judgeHistory: [],
    lastJudgeBatch: null,
    counters: { crafted: 0, sold: 0, battles: 0, victories: 0, supplied: 0, facilityUpgrades: 0, researches: 0, tournaments: 0, tournamentWins: 0, orders: 0, judgeMatches: 0, judgeCorrect: 0 },
    log: ['Day 1: 돈카츠 가게를 열었습니다. 재료를 관리하고 메뉴를 만들어 학생들을 지원하세요.'],
    ended: false,
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const facilityLevels = FACILITIES.reduce((next, facility) => ({
    ...next,
    [facility.id]: clamp(Number(value.facilityLevels?.[facility.id] || 1), 1, facility.maxLevel),
  }), {});
  const unlockedRecipeIds = Array.isArray(value.unlockedRecipeIds) && value.unlockedRecipeIds.length
    ? Array.from(new Set([...DEFAULT_UNLOCKED_RECIPES, ...value.unlockedRecipeIds]))
    : base.unlockedRecipeIds;
  return {
    ...base,
    ...value,
    businessMode: value.businessMode === 'delivery' ? 'delivery' : 'hall',
    facilityLevels,
    unlockedRecipeIds,
    clearedTournamentTiers: Array.isArray(value.clearedTournamentTiers) ? value.clearedTournamentTiers : base.clearedTournamentTiers,
    tournamentHistory: Array.isArray(value.tournamentHistory) ? value.tournamentHistory.slice(0, 30) : base.tournamentHistory,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    mealTokens: value.mealTokens && typeof value.mealTokens === 'object' ? value.mealTokens : base.mealTokens,
    students: Array.isArray(value.students) && value.students.length ? value.students : base.students,
    judgeMatch: value.judgeMatch && typeof value.judgeMatch === 'object' ? value.judgeMatch : null,
    judgeHistory: Array.isArray(value.judgeHistory) ? value.judgeHistory.slice(0, 50) : base.judgeHistory,
    lastJudgeBatch: value.lastJudgeBatch && typeof value.lastJudgeBatch === 'object' ? value.lastJudgeBatch : null,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    log: Array.isArray(value.log) ? value.log.slice(0, 80) : base.log,
  };
}

export function ingredientName(id) {
  return INGREDIENTS.find((item) => item.id === id)?.name || id;
}

export function recipeName(id) {
  return RECIPES.find((item) => item.id === id)?.name || id;
}

export function facilityName(id) {
  return FACILITIES.find((item) => item.id === id)?.name || id;
}

export function tournamentTierName(id) {
  return TOURNAMENT_TIERS.find((item) => item.id === id)?.name || id;
}

const TIER_ORDER = {
  rookie: 1,
  intermediate: 2,
  advanced: 3,
};

function isTierCleared(clearedTiers = [], tierId = '') {
  const required = Number(TIER_ORDER[tierId] || 0);
  if (!required) return false;
  return clearedTiers.some((cleared) => Number(TIER_ORDER[cleared] || 0) >= required);
}

export function buildFacilityContext(state) {
  const current = normalizeState(state);
  const ctx = {
    storageCap: 40,
    rareDropPct: 0,
    recipeShardBonus: 0,
    productionMultByTag: {},
    failReduce: 0,
    tokenBonusChanceByTag: {},
    dailyOrders: 3,
    goldMultFromOrders: 1,
    deliveryUnlocked: false,
    deliveryGoldMult: 1,
    deliveryMaterialChance: 0,
    contestScoreMult: 1,
  };

  FACILITIES.forEach((facility) => {
    const level = Number(current.facilityLevels[facility.id] || 1);
    facility.levels.filter((item) => item.level <= level).forEach((item) => {
      if (item.storageCap) ctx.storageCap = Math.max(ctx.storageCap, item.storageCap);
      if (item.rareDropPct) ctx.rareDropPct = Math.max(ctx.rareDropPct, item.rareDropPct);
      if (item.recipeShardBonus) ctx.recipeShardBonus = Math.max(ctx.recipeShardBonus, item.recipeShardBonus);
      if (item.productionMult && facility.effect) {
        ctx.productionMultByTag[facility.effect] = Number(ctx.productionMultByTag[facility.effect] || 1) * item.productionMult;
      }
      if (item.failReduce) ctx.failReduce += item.failReduce;
      if (item.bonusChance && facility.effect) {
        const previous = Number(ctx.tokenBonusChanceByTag[facility.effect] || 0);
        ctx.tokenBonusChanceByTag[facility.effect] = 1 - (1 - previous) * (1 - item.bonusChance);
      }
      if (item.dailyOrders) ctx.dailyOrders = Math.max(ctx.dailyOrders, item.dailyOrders);
      if (item.goldMult) ctx.goldMultFromOrders *= item.goldMult;
      if (item.deliveryUnlocked) ctx.deliveryUnlocked = true;
      if (item.deliveryGoldMult) ctx.deliveryGoldMult *= item.deliveryGoldMult;
      if (item.deliveryMaterialChance) ctx.deliveryMaterialChance = Math.max(ctx.deliveryMaterialChance, item.deliveryMaterialChance);
      if (item.contestMult) ctx.contestScoreMult *= item.contestMult;
    });
  });

  return ctx;
}

export function isRecipeUnlocked(state, recipeId) {
  const current = normalizeState(state);
  if (current.unlockedRecipeIds.includes(recipeId)) return true;
  const recipe = RECIPES.find((item) => item.id === recipeId);
  const unlock = recipe?.unlock;
  if (!unlock) return DEFAULT_UNLOCKED_RECIPES.includes(recipeId);
  if (unlock.type === 'facility') {
    return Number(current.facilityLevels?.[unlock.facilityId] || 1) >= Number(unlock.level || 1);
  }
  if (unlock.type === 'tournament') {
    return isTierCleared(current.clearedTournamentTiers, unlock.tier);
  }
  return false;
}

export function recipeRows(state) {
  const current = normalizeState(state);
  return RECIPES.map((recipe) => {
    const unlocked = isRecipeUnlocked(current, recipe.id);
    const research = RESEARCH_PROJECTS.find((project) => project.recipeId === recipe.id);
    const unlock = recipe.unlock || {};
    const facility = unlock.type === 'facility' ? FACILITIES.find((item) => item.id === unlock.facilityId) : null;
    const reason = unlocked
      ? ''
      : research
        ? `연구 필요: ${research.gold}G + 조각 ${research.recipeShards}`
        : unlock.type === 'facility'
          ? `${facility?.name || unlock.facilityId} Lv.${unlock.level || 1} 필요`
          : unlock.type === 'tournament'
            ? `${tournamentTierName(unlock.tier)} 대회 우승 필요`
            : '해금 필요';
    return { ...recipe, unlocked, reason };
  });
}

export function addLog(state, message) {
  return {
    ...state,
    log: [`Day ${state.day}: ${message}`, ...state.log].slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function hasIngredients(inventory, needs) {
  return Object.entries(needs).every(([id, qty]) => Number(inventory[id] || 0) >= Number(qty || 0));
}

export function spendIngredients(inventory, needs) {
  const next = { ...inventory };
  Object.entries(needs).forEach(([id, qty]) => {
    next[id] = Math.max(0, Number(next[id] || 0) - Number(qty || 0));
  });
  return next;
}

export function addInventory(inventory, id, qty) {
  return {
    ...inventory,
    [id]: Number(inventory[id] || 0) + Number(qty || 0),
  };
}

export function getStudent(state, studentId) {
  return state.students.find((student) => student.id === studentId) || state.students[0];
}

export function updateStudent(state, studentId, patch) {
  return {
    ...state,
    students: state.students.map((student) => (
      student.id === studentId ? { ...student, ...patch } : student
    )),
  };
}

export function averageStudents(state, key) {
  if (!state.students.length) return 0;
  return Math.round(state.students.reduce((sum, student) => sum + Number(student[key] || 0), 0) / state.students.length);
}

export function formatNeeds(needs) {
  return Object.entries(needs).map(([id, qty]) => `${ingredientName(id)} ${qty}`).join(', ');
}

export function buyIngredientAction(state, ingredientId, qty = 1) {
  const current = normalizeState(state);
  const ctx = buildFacilityContext(current);
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId) || INGREDIENTS[0];
  const amount = Math.max(1, Number(qty || 1));
  const cost = ingredient.price * amount;
  if (inventoryCount(current) + amount > ctx.storageCap) return addLog(current, `${ingredient.name} 구매 실패. 냉장고 보관 한도 ${ctx.storageCap}칸을 초과합니다.`);
  if (current.gold < cost) return addLog(current, `${ingredient.name} 구매 실패. 골드가 부족합니다.`);
  return addLog({
    ...current,
    gold: current.gold - cost,
    inventory: addInventory(current.inventory, ingredient.id, amount),
  }, `${ingredient.name} ${amount}개를 구매했습니다. -${cost}G`);
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (!isRecipeUnlocked(current, recipe.id)) return addLog(current, `${recipe.name} 제작 실패. 아직 해금되지 않은 레시피입니다.`);
  if (current.gold < recipe.craftCost) return addLog(current, `${recipe.name} 제작 실패. 제작비가 부족합니다.`);
  if (!hasIngredients(current.inventory, recipe.needs)) {
    return addLog(current, `${recipe.name} 제작 실패. 필요 재료: ${formatNeeds(recipe.needs)}.`);
  }
  const ctx = buildFacilityContext(current);
  const matchingMult = recipe.tags.reduce((mult, tag) => mult * Number(ctx.productionMultByTag[tag] || 1), 1);
  const bonusChance = recipe.tags.reduce((chance, tag) => Math.max(chance, Number(ctx.tokenBonusChanceByTag[tag] || 0)), 0);
  const failChance = clamp((recipe.category === 'main' ? 0.08 : 0.04) - ctx.failReduce, 0.01, 0.2);
  const failed = Math.random() < failChance;
  let next = {
    ...current,
    gold: current.gold - recipe.craftCost,
    inventory: spendIngredients(current.inventory, recipe.needs),
    counters: { ...current.counters, crafted: Number(current.counters.crafted || 0) + 1 },
  };
  if (failed) {
    return addLog(next, `${recipe.name} 제작이 흔들렸습니다. 재료 일부와 제작비를 소모했습니다.`);
  }
  const produced = Math.max(1, Math.floor(recipe.yieldTokens * matchingMult) + (Math.random() < bonusChance ? 1 : 0));
  next = {
    ...next,
    mealTokens: {
      ...next.mealTokens,
      [recipe.id]: Number(next.mealTokens[recipe.id] || 0) + produced,
    },
  };
  return addLog(next, `${recipe.name} ${produced}개를 준비했습니다. 생산 보정 x${matchingMult.toFixed(2)}`);
}

export function sellRecipeAction(state, recipeId, qty = 1) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const amount = Math.max(1, Number(qty || 1));
  const have = Number(current.mealTokens[recipe.id] || 0);
  if (have < amount) return addLog(current, `${recipe.name} 판매 실패. 준비된 메뉴가 부족합니다.`);
  const ctx = buildFacilityContext(current);
  const isDelivery = current.businessMode === 'delivery' && ctx.deliveryUnlocked;
  const demand = 1 + Math.min(0.3, Number(current.reputation || 0) / 1000);
  const revenue = Math.round(recipe.sellPrice * amount * demand * (isDelivery ? ctx.deliveryGoldMult : 1));
  const repGain = Math.max(1, Math.round((recipe.power / 8) * amount));
  let inventory = current.inventory;
  if (isDelivery && Math.random() < ctx.deliveryMaterialChance) {
    const pool = INGREDIENTS.filter((item) => item.rarity <= 2);
    const pick = pool[Math.floor(Math.random() * pool.length)] || INGREDIENTS[0];
    inventory = addInventory(inventory, pick.id, 1);
  }
  return addLog({
    ...current,
    gold: current.gold + revenue,
    reputation: current.reputation + repGain,
    inventory,
    mealTokens: { ...current.mealTokens, [recipe.id]: have - amount },
    counters: { ...current.counters, sold: Number(current.counters.sold || 0) + amount },
  }, `${recipe.name} ${amount}개를 ${isDelivery ? '배달' : '판매'}했습니다. +${revenue}G, 평판 +${repGain}`);
}

export function feedStudentAction(state, studentId, recipeId) {
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const student = getStudent(state, studentId);
  const have = Number(state.mealTokens[recipe.id] || 0);
  if (have <= 0) return addLog(state, `${recipe.name} 배식 실패. 준비된 메뉴가 없습니다.`);
  const likes = recipe.tags.includes(student.pref);
  const weak = recipe.tags.includes(student.weak);
  const moraleGain = Math.round(12 * (likes ? 1.35 : 1) * (weak ? 0.7 : 1));
  const heal = Math.round(recipe.power * (likes ? 1.2 : 1));
  let next = {
    ...state,
    mealTokens: { ...state.mealTokens, [recipe.id]: have - 1 },
    counters: { ...state.counters, supplied: Number(state.counters.supplied || 0) + 1 },
  };
  next = updateStudent(next, student.id, {
    currentHp: clamp(Number(student.currentHp || 0) + heal, 0, student.hp),
    morale: clamp(Number(student.morale || 0) + moraleGain, 0, 100),
    meal: recipe.id,
  });
  return addLog(next, `${student.name}에게 ${recipe.name}을 배식했습니다. HP +${heal}, 사기 +${moraleGain}`);
}

export function battleAction(state, studentId) {
  const current = normalizeState(state);
  const student = getStudent(current, studentId);
  const meal = RECIPES.find((recipe) => recipe.id === student.meal);
  const ctx = buildFacilityContext(current);
  const mealPower = meal ? meal.power : 0;
  const prefBonus = meal?.tags?.includes(student.pref) ? 10 : 0;
  const weakPenalty = meal?.tags?.includes(student.weak) ? 8 : 0;
  const power = Number(student.atk || 0) * 8
    + Number(student.def || 0) * 5
    + Number(student.morale || 0)
    + mealPower
    + prefBonus
    - weakPenalty;
  const target = 116 + Number(current.floor || 1) * 18;
  const chance = clamp(0.35 + (power - target) / 160, 0.12, 0.92);
  const won = Math.random() < chance;
  const damage = won ? Math.max(6, 18 + current.floor * 2 - student.def) : Math.max(12, 34 + current.floor * 3 - student.def);
  const nextHp = clamp(Number(student.currentHp || 0) - damage, 0, student.hp);
  const rewardGold = won ? Math.round(30 * (1 + 0.13 * (current.floor - 1))) : 8;
  const shardGain = won && Math.random() < Math.min(0.45, 0.12 + 0.008 * current.floor + ctx.rareDropPct) ? 1 + ctx.recipeShardBonus : 0;
  let next = {
    ...current,
    gold: current.gold + rewardGold,
    recipeShards: current.recipeShards + shardGain,
    floor: won ? current.floor + 1 : current.floor,
    counters: {
      ...current.counters,
      battles: Number(current.counters.battles || 0) + 1,
      victories: Number(current.counters.victories || 0) + (won ? 1 : 0),
    },
  };
  next = updateStudent(next, student.id, {
    currentHp: nextHp,
    morale: clamp(Number(student.morale || 0) + (won ? 5 : -9), 0, 100),
    wins: Number(student.wins || 0) + (won ? 1 : 0),
    meal: '',
  });
  const message = won
    ? `${student.name}이 ${current.floor}층 전투에서 승리했습니다. +${rewardGold}G${shardGain ? `, 레시피 조각 +${shardGain}` : ''}`
    : `${student.name}이 ${current.floor}층에서 패배했습니다. 위로 보상 +${rewardGold}G`;
  return addLog(next, message);
}

export function nextDayAction(state) {
  const students = state.students.map((student) => ({
    ...student,
    currentHp: clamp(Number(student.currentHp || 0) + 18, 0, student.hp),
    morale: clamp(Number(student.morale || 0) - 4, 0, 100),
    meal: '',
  }));
  const ended = state.day >= 14;
  return addLog({
    ...state,
    day: state.day + 1,
    students,
    ended,
  }, ended ? '2주 운영 리포트가 완성됐습니다. 결과를 전적에 기록하세요.' : '새 영업일이 시작됐습니다. 학생들이 회복하고 사기가 조금 가라앉았습니다.');
}

export function setBusinessModeAction(state, mode) {
  const current = normalizeState(state);
  const ctx = buildFacilityContext(current);
  const nextMode = mode === 'delivery' ? 'delivery' : 'hall';
  if (nextMode === 'delivery' && !ctx.deliveryUnlocked) return addLog(current, '배달 창구 Lv.2가 필요합니다.');
  return addLog({ ...current, businessMode: nextMode }, `영업 방식을 ${nextMode === 'delivery' ? '배달' : '홀 영업'}로 변경했습니다.`);
}

export function upgradeFacilityAction(state, facilityId) {
  const current = normalizeState(state);
  const facility = FACILITIES.find((item) => item.id === facilityId) || FACILITIES[0];
  const level = Number(current.facilityLevels[facility.id] || 1);
  if (level >= facility.maxLevel) return addLog(current, `${facility.name}은 이미 최대 레벨입니다.`);
  const nextLevel = level + 1;
  const spec = facility.levels.find((item) => item.level === nextLevel);
  const cost = Number(spec?.gold || 0);
  if (Number(current.gold || 0) < cost) return addLog(current, `${facility.name} Lv.${nextLevel} 업그레이드 실패. ${cost}G가 필요합니다.`);
  return addLog({
    ...current,
    gold: current.gold - cost,
    facilityLevels: { ...current.facilityLevels, [facility.id]: nextLevel },
    counters: { ...current.counters, facilityUpgrades: Number(current.counters.facilityUpgrades || 0) + 1 },
  }, `${facility.name}을 Lv.${nextLevel}로 업그레이드했습니다.`);
}

export function researchRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const project = RESEARCH_PROJECTS.find((item) => item.recipeId === recipeId);
  const recipe = RECIPES.find((item) => item.id === recipeId);
  if (!project || !recipe) return addLog(current, '연구할 레시피를 찾을 수 없습니다.');
  if (current.unlockedRecipeIds.includes(recipeId)) return addLog(current, `${recipe.name}은 이미 해금됐습니다.`);
  if (Number(current.gold || 0) < project.gold) return addLog(current, `${project.name} 실패. 골드 ${project.gold}G가 필요합니다.`);
  if (Number(current.recipeShards || 0) < project.recipeShards) return addLog(current, `${project.name} 실패. 레시피 조각 ${project.recipeShards}개가 필요합니다.`);
  return addLog({
    ...current,
    gold: current.gold - project.gold,
    recipeShards: current.recipeShards - project.recipeShards,
    unlockedRecipeIds: [...current.unlockedRecipeIds, recipeId],
    counters: { ...current.counters, researches: Number(current.counters.researches || 0) + 1 },
  }, `${project.name} 완료. ${recipe.name}을 사용할 수 있습니다.`);
}

export function fulfillDailyOrdersAction(state) {
  const current = normalizeState(state);
  const ctx = buildFacilityContext(current);
  let remaining = ctx.dailyOrders;
  let mealTokens = { ...current.mealTokens };
  let gold = Number(current.gold || 0);
  let reputation = Number(current.reputation || 0);
  let sold = 0;
  const candidates = Object.entries(mealTokens)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([recipeId, qty]) => ({ recipe: RECIPES.find((item) => item.id === recipeId), qty: Number(qty || 0) }))
    .filter((row) => row.recipe)
    .sort((a, b) => b.recipe.sellPrice - a.recipe.sellPrice);

  candidates.forEach((row) => {
    if (remaining <= 0) return;
    const amount = Math.min(remaining, row.qty);
    if (amount <= 0) return;
    remaining -= amount;
    sold += amount;
    mealTokens = { ...mealTokens, [row.recipe.id]: Number(mealTokens[row.recipe.id] || 0) - amount };
    gold += Math.round(row.recipe.sellPrice * amount * ctx.goldMultFromOrders);
    reputation += Math.max(1, Math.round(row.recipe.power / 10)) * amount;
  });

  if (!sold) return addLog(current, '처리할 영업 주문이 없습니다. 먼저 메뉴를 준비하세요.');
  return addLog({
    ...current,
    gold,
    reputation,
    mealTokens,
    counters: {
      ...current.counters,
      sold: Number(current.counters.sold || 0) + sold,
      orders: Number(current.counters.orders || 0) + sold,
    },
  }, `일일 주문 ${sold}건을 처리했습니다. 영업 배율 x${ctx.goldMultFromOrders.toFixed(2)}`);
}

export function currentTournamentTheme(state) {
  const current = normalizeState(state);
  const index = Math.abs((Number(current.day || 1) + Number(current.counters.tournaments || 0)) % TOURNAMENT_THEMES.length);
  return TOURNAMENT_THEMES[index] || TOURNAMENT_THEMES[0];
}

function computeRecipeScoreForTheme(state, recipeId, theme, options = {}) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const ctx = buildFacilityContext(current);
  const tagHits = theme.targetTags.filter((tag) => recipe.tags.includes(tag)).length;
  const avoidHits = theme.avoidTags.filter((tag) => recipe.tags.includes(tag)).length;
  const themeScore = clamp(52 + tagHits * 22 - avoidHits * 16, 0, 100);
  const tagVariety = new Set(recipe.tags).size;
  const ingredientVariety = Object.keys(recipe.needs).length;
  const balance = clamp(55 + Math.min(30, ingredientVariety * 5) + (recipe.category === 'main' ? 4 : 0) - avoidHits * 8, 0, 100);
  const tech = clamp(48 + ingredientVariety * 6 + Number(recipe.power || 0) * 0.8 + Number(current.counters.crafted || 0) * 0.5, 0, 100);
  const creativity = clamp(35 + tagVariety * 7 + ingredientVariety * 4 + Math.min(20, Number(current.recipeShards || 0)), 0, 100);
  const styleBonus = Number(options.styleBonus || 0);
  const total = clamp((themeScore * 0.35 + balance * 0.25 + tech * 0.25 + creativity * 0.15) * ctx.contestScoreMult + styleBonus, 0, 150);
  return {
    recipe,
    theme,
    themeScore: Math.round(themeScore),
    balance: Math.round(balance),
    tech: Math.round(tech),
    creativity: Math.round(creativity),
    total: Math.round(total * 10) / 10,
  };
}

function computeTournamentScore(state, recipeId) {
  const current = normalizeState(state);
  const score = computeRecipeScoreForTheme(current, recipeId, currentTournamentTheme(current));
  return {
    ...score,
    total: Math.round(score.total),
  };
}

export function tournamentPreview(state, recipeId, tierId = 'rookie') {
  const current = normalizeState(state);
  const tier = TOURNAMENT_TIERS.find((item) => item.id === tierId) || TOURNAMENT_TIERS[0];
  const score = computeTournamentScore(current, recipeId);
  return {
    ...score,
    tier,
    win: score.total >= tier.targetScore,
  };
}

export function enterTournamentAction(state, recipeId, tierId = 'rookie') {
  const current = normalizeState(state);
  const tier = TOURNAMENT_TIERS.find((item) => item.id === tierId) || TOURNAMENT_TIERS[0];
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (!isRecipeUnlocked(current, recipe.id)) return addLog(current, `${recipe.name}은 아직 대회에 낼 수 없습니다.`);
  if (Number(current.gold || 0) < tier.entryGold) return addLog(current, `${tier.name} 대회 참가 실패. 참가비 ${tier.entryGold}G가 필요합니다.`);
  const preview = tournamentPreview(current, recipe.id, tier.id);
  const won = preview.win;
  const unlocked = won
    ? Array.from(new Set([...current.unlockedRecipeIds, ...tier.unlockRecipes]))
    : current.unlockedRecipeIds;
  const cleared = won
    ? Array.from(new Set([...current.clearedTournamentTiers, tier.id]))
    : current.clearedTournamentTiers;
  const historyEntry = {
    day: current.day,
    tierId: tier.id,
    recipeId: recipe.id,
    themeId: preview.theme.id,
    score: preview.total,
    won,
  };
  return addLog({
    ...current,
    gold: current.gold - tier.entryGold + (won ? tier.rewardGold : Math.round(tier.rewardGold * 0.25)),
    reputation: current.reputation + (won ? tier.rewardRep : Math.round(tier.rewardRep * 0.25)),
    recipeShards: current.recipeShards + (won ? tier.rewardShards : 1),
    unlockedRecipeIds: unlocked,
    clearedTournamentTiers: cleared,
    tournamentHistory: [historyEntry, ...current.tournamentHistory].slice(0, 30),
    counters: {
      ...current.counters,
      tournaments: Number(current.counters.tournaments || 0) + 1,
      tournamentWins: Number(current.counters.tournamentWins || 0) + (won ? 1 : 0),
    },
  }, `${tier.name} 대회 ${won ? '우승' : '참가'}: ${recipe.name} ${preview.total}점 / 목표 ${tier.targetScore}점`);
}

function judgeCandidateRecipes(tierId) {
  if (tierId === 'rookie') {
    return RECIPES.filter((recipe) => DEFAULT_UNLOCKED_RECIPES.includes(recipe.id));
  }
  if (tierId === 'intermediate') {
    return RECIPES.filter((recipe) => !['curry_tonkatsu'].includes(recipe.id));
  }
  return RECIPES;
}

function randomPick(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return list[Math.floor(Math.random() * list.length)] || fallback;
}

function pickDistinctPair(list, fallback) {
  const first = randomPick(list, fallback);
  if (!list.length) return [fallback, fallback];
  const rest = list.filter((item) => item !== first);
  return [first, randomPick(rest.length ? rest : list, fallback)];
}

function buildChefEntry(state, recipe, theme, chef) {
  const preferHits = chef.preferTags.filter((tag) => recipe.tags.includes(tag)).length;
  const avoidHits = chef.avoidTags.filter((tag) => recipe.tags.includes(tag)).length;
  const themeHits = theme.targetTags.filter((tag) => recipe.tags.includes(tag)).length;
  const styleBonus = preferHits * 4 - avoidHits * 3 + themeHits * 2 + (Math.random() * 6 - 3);
  const score = computeRecipeScoreForTheme(state, recipe.id, theme, { styleBonus });
  const appealTags = Array.from(new Set([...theme.targetTags, ...chef.preferTags]))
    .filter((tag) => recipe.tags.includes(tag))
    .slice(0, 2);
  const appeal = appealTags.length
    ? `${chef.style} 감각으로 #${appealTags.join(' #')} 포인트를 밀어붙입니다.`
    : `${chef.style} 스타일로 안정적인 완성도를 노립니다.`;
  return {
    name: chef.name,
    recipeId: recipe.id,
    recipeName: recipe.name,
    appeal,
    total: score.total,
  };
}

function buildJudgeMatch(state, tierId = 'rookie') {
  const current = normalizeState(state);
  const tier = TOURNAMENT_TIERS.find((item) => item.id === tierId) || TOURNAMENT_TIERS[0];
  const previousThemeId = current.judgeMatch?.themeId;
  const themes = TOURNAMENT_THEMES.filter((theme) => theme.id !== previousThemeId);
  const theme = randomPick(themes.length ? themes : TOURNAMENT_THEMES, TOURNAMENT_THEMES[0]);
  const candidates = judgeCandidateRecipes(tier.id);
  const [chefA, chefB] = pickDistinctPair(JUDGE_AI_CHEFS, JUDGE_AI_CHEFS[0]);
  const [recipeA, recipeB] = pickDistinctPair(candidates, RECIPES[0]);
  const entryA = buildChefEntry(current, recipeA, theme, chefA);
  const entryB = buildChefEntry(current, recipeB, theme, chefB);
  return {
    id: `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    tierId: tier.id,
    tierName: tier.name,
    themeId: theme.id,
    themeName: theme.name,
    themeDesc: theme.desc,
    aiAName: entryA.name,
    aiBName: entryB.name,
    aiARecipeId: entryA.recipeId,
    aiBRecipeId: entryB.recipeId,
    aiARecipeName: entryA.recipeName,
    aiBRecipeName: entryB.recipeName,
    aiAAppeal: entryA.appeal,
    aiBAppeal: entryB.appeal,
    aiATotal: entryA.total,
    aiBTotal: entryB.total,
    createdAt: new Date().toISOString(),
    resolved: false,
  };
}

function winnerForJudgeMatch(match) {
  if (!match) return 'A';
  const a = Number(match.aiATotal || 0);
  const b = Number(match.aiBTotal || 0);
  if (Math.abs(a - b) <= 0.05) return 'A';
  return a >= b ? 'A' : 'B';
}

function resolveJudgeMatch(state, match, pick, judgeText = '') {
  const current = normalizeState(state);
  const judgePick = pick === 'B' ? 'B' : 'A';
  const winner = winnerForJudgeMatch(match);
  const tie = Math.abs(Number(match.aiATotal || 0) - Number(match.aiBTotal || 0)) <= 0.05;
  const correct = tie || judgePick === winner;
  const rewardGold = correct ? 50 : 20;
  const rewardShards = correct ? 3 : 1;
  const entry = {
    id: match.id,
    tierId: match.tierId,
    themeId: match.themeId,
    themeName: match.themeName,
    aiAName: match.aiAName,
    aiBName: match.aiBName,
    aiARecipeId: match.aiARecipeId,
    aiBRecipeId: match.aiBRecipeId,
    aiARecipeName: match.aiARecipeName,
    aiBRecipeName: match.aiBRecipeName,
    aiAAppeal: match.aiAAppeal,
    aiBAppeal: match.aiBAppeal,
    aiATotal: match.aiATotal,
    aiBTotal: match.aiBTotal,
    judgePick,
    winner,
    judgeText,
    correct,
    judgedAt: new Date().toISOString(),
  };
  return {
    ...current,
    gold: Number(current.gold || 0) + rewardGold,
    recipeShards: Number(current.recipeShards || 0) + rewardShards,
    judgeHistory: [entry, ...current.judgeHistory].slice(0, 50),
    judgeMatch: {
      ...match,
      resolved: true,
      judgePick,
      winner,
      judgeText,
      correct,
    },
    counters: {
      ...current.counters,
      judgeMatches: Number(current.counters.judgeMatches || 0) + 1,
      judgeCorrect: Number(current.counters.judgeCorrect || 0) + (correct ? 1 : 0),
    },
  };
}

export function startJudgeMatchAction(state, tierId = 'rookie') {
  const current = normalizeState(state);
  return addLog({
    ...current,
    judgeMatch: buildJudgeMatch(current, tierId),
  }, `${tournamentTierName(tierId)} 심사 매치를 준비했습니다.`);
}

export function submitJudgePickAction(state, pick, judgeText = '') {
  const current = normalizeState(state);
  const match = current.judgeMatch;
  if (!match || match.resolved) return addLog(current, '진행 중인 심사 매치가 없습니다. 새 심사 매치를 먼저 준비하세요.');
  const resolved = resolveJudgeMatch(current, match, pick, judgeText);
  const chosen = pick === 'B' ? resolved.judgeMatch.aiBName : resolved.judgeMatch.aiAName;
  return addLog(resolved, `${chosen} 선택: ${resolved.judgeMatch.correct ? '정답' : '오답'}입니다. 보상 +${resolved.judgeMatch.correct ? 50 : 20}G`);
}

export function runJudgeBatchAction(state, tierId = 'rookie', count = 10, mode = 'random') {
  let current = normalizeState(state);
  const total = clamp(Math.round(Number(count || 10)), 1, 50);
  const safeMode = Object.prototype.hasOwnProperty.call(JUDGE_BATCH_MODE_LABELS, mode) ? mode : 'random';
  const beforeCorrect = Number(current.counters.judgeCorrect || 0);
  const beforeMatches = Number(current.counters.judgeMatches || 0);
  for (let index = 0; index < total; index += 1) {
    const match = buildJudgeMatch(current, tierId);
    const winner = winnerForJudgeMatch(match);
    const loser = winner === 'A' ? 'B' : 'A';
    const pick = safeMode === 'strong' ? winner : safeMode === 'weak' ? loser : (Math.random() < 0.5 ? 'A' : 'B');
    current = resolveJudgeMatch(current, match, pick, `자동심사#${index + 1} [${JUDGE_BATCH_MODE_LABELS[safeMode]}]`);
  }
  const correct = Number(current.counters.judgeCorrect || 0) - beforeCorrect;
  const matches = Number(current.counters.judgeMatches || 0) - beforeMatches;
  const lastJudgeBatch = {
    tierId: TOURNAMENT_TIERS.find((tier) => tier.id === tierId)?.id || TOURNAMENT_TIERS[0].id,
    mode: safeMode,
    count: matches,
    correct,
    accuracy: matches ? Math.round((correct / matches) * 100) : 0,
    rewardGold: correct * 50 + (matches - correct) * 20,
    rewardShards: correct * 3 + (matches - correct),
    createdAt: new Date().toISOString(),
  };
  return addLog({
    ...current,
    lastJudgeBatch,
  }, `자동 심사 ${matches}판 완료: ${correct}/${matches} 정답 (${lastJudgeBatch.accuracy}%).`);
}

export function clearJudgeHistoryAction(state) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    judgeMatch: null,
    judgeHistory: [],
    lastJudgeBatch: null,
  }, '심사 기록과 현재 매치를 초기화했습니다.');
}

function judgeHistoryMode(entry) {
  const text = entry?.judgeText || '';
  if (text.includes(JUDGE_BATCH_MODE_LABELS.strong) || text.includes('[강]')) return 'strong';
  if (text.includes(JUDGE_BATCH_MODE_LABELS.weak) || text.includes('[약]')) return 'weak';
  if (text.includes(JUDGE_BATCH_MODE_LABELS.random) || text.includes('[랜]') || text.includes('자동심사')) return 'random';
  return 'manual';
}

function summarizeJudgeRows(rows = []) {
  const total = rows.length;
  const correct = rows.filter((entry) => entry.correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const rewardGold = rows.reduce((sum, entry) => sum + (entry.correct ? 50 : 20), 0);
  const rewardShards = rows.reduce((sum, entry) => sum + (entry.correct ? 3 : 1), 0);
  const rank = total < 5 ? '견습' : accuracy >= 90 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : 'D';
  const modeCounts = rows.reduce((next, entry) => {
    const mode = judgeHistoryMode(entry);
    return { ...next, [mode]: Number(next[mode] || 0) + 1 };
  }, { manual: 0, random: 0, strong: 0, weak: 0 });
  return {
    total,
    correct,
    accuracy,
    rewardGold,
    rewardShards,
    rank,
    modeCounts,
  };
}

export function judgeSummary(state) {
  const current = normalizeState(state);
  const judged = current.judgeHistory.length;
  const correct = current.judgeHistory.filter((entry) => entry.correct).length;
  const accuracy = judged ? Math.round((correct / judged) * 100) : 0;
  const rank = judged < 5 ? '견습 심사원' : accuracy >= 75 ? '정밀 심사원' : accuracy >= 55 ? '실전 심사원' : '수련 심사원';
  const modeCounts = current.judgeHistory.reduce((next, entry) => {
    const mode = judgeHistoryMode(entry);
    return { ...next, [mode]: Number(next[mode] || 0) + 1 };
  }, { manual: 0, random: 0, strong: 0, weak: 0 });
  return {
    match: current.judgeMatch,
    history: current.judgeHistory.slice(0, 8),
    judged,
    correct,
    accuracy,
    rank,
    modeCounts,
    lastBatch: current.lastJudgeBatch,
  };
}

export function judgeRecentSummary(state, options = {}) {
  const current = normalizeState(state);
  const limit = clamp(Math.round(Number(options.limit || 10)), 1, 50);
  const mode = Object.prototype.hasOwnProperty.call(JUDGE_HISTORY_MODE_LABELS, options.mode) ? options.mode : 'all';
  const autoOnly = Boolean(options.autoOnly);
  const sourceRows = current.judgeHistory.filter((entry) => {
    const entryMode = judgeHistoryMode(entry);
    if (autoOnly && entryMode === 'manual') return false;
    if (mode !== 'all' && entryMode !== mode) return false;
    return true;
  });
  const rows = sourceRows.slice(0, limit).map((entry) => ({
    ...entry,
    judgeMode: judgeHistoryMode(entry),
  }));
  const summary = summarizeJudgeRows(rows);
  return {
    ...summary,
    rows,
    limit,
    mode,
    autoOnly,
    sourceCount: sourceRows.length,
    totalHistoryCount: current.judgeHistory.length,
  };
}

export function facilityRows(state) {
  const current = normalizeState(state);
  return FACILITIES.map((facility) => {
    const level = Number(current.facilityLevels[facility.id] || 1);
    const next = facility.levels.find((item) => item.level === level + 1);
    return {
      ...facility,
      level,
      maxed: level >= facility.maxLevel,
      nextCost: next?.gold || 0,
      canUpgrade: Boolean(next) && Number(current.gold || 0) >= Number(next.gold || 0),
    };
  });
}

export function researchRows(state) {
  const current = normalizeState(state);
  return RESEARCH_PROJECTS.map((project) => {
    const recipe = RECIPES.find((item) => item.id === project.recipeId);
    const done = current.unlockedRecipeIds.includes(project.recipeId);
    return {
      ...project,
      recipeName: recipe?.name || project.recipeId,
      done,
      canResearch: !done && Number(current.gold || 0) >= project.gold && Number(current.recipeShards || 0) >= project.recipeShards,
    };
  });
}

export function scoreState(state) {
  return Math.max(0, Math.round(
    Number(state.gold || 0)
    + Number(state.reputation || 0) * 12
    + Number(state.floor || 1) * 90
    + Number(state.recipeShards || 0) * 18
    + Number(state.counters.crafted || 0) * 12
    + Number(state.counters.sold || 0) * 18
    + Number(state.counters.victories || 0) * 80
    + Number(state.counters.facilityUpgrades || 0) * 55
    + Number(state.counters.researches || 0) * 90
    + Number(state.counters.tournamentWins || 0) * 220
    + Number(state.counters.judgeMatches || 0) * 8
    + Number(state.counters.judgeCorrect || 0) * 35
    + averageStudents(state, 'morale') * 4
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function inventoryCount(state) {
  return Object.values(state.inventory).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

export function mealTokenCount(state) {
  return Object.values(state.mealTokens).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function buildOperationAction(id, title, detail, priority = 'medium') {
  return { id, title, detail, priority };
}

function buildTutorialStep(id, title, detail, done, progressPct, actionHint) {
  return {
    id,
    title,
    detail,
    done: Boolean(done),
    progressPct: Math.round(clamp(progressPct, 0, 100)),
    actionHint,
  };
}

function buildBalanceRow(id, label, value, pct, tone, detail) {
  return {
    id,
    label,
    value,
    pct: Math.round(clamp(pct, 0, 100)),
    tone,
    detail,
  };
}

function buildProductionRow(id, title, trigger, detail, pct, tone = 'ready') {
  return {
    id,
    title,
    trigger,
    detail,
    pct: Math.round(clamp(pct, 0, 100)),
    tone,
  };
}

export function operationsReportForState(state) {
  const current = normalizeState(state);
  const ctx = buildFacilityContext(current);
  const recipes = recipeRows(current);
  const facilities = facilityRows(current);
  const researches = researchRows(current);
  const judge = judgeSummary(current);
  const tokenTotal = mealTokenCount(current);
  const ingredientTotal = inventoryCount(current);
  const unlockedRecipes = recipes.filter((recipe) => recipe.unlocked);
  const lockedRecipes = recipes.length - unlockedRecipes.length;
  const craftableRecipes = unlockedRecipes
    .filter((recipe) => Number(current.gold || 0) >= Number(recipe.craftCost || 0) && hasIngredients(current.inventory, recipe.needs))
    .sort((a, b) => Number(b.sellPrice || 0) - Number(a.sellPrice || 0));
  const bestCraftable = craftableRecipes[0] || null;
  const readyResearch = researches.find((project) => !project.done && project.canResearch) || null;
  const readyFacility = facilities.find((facility) => !facility.maxed && facility.canUpgrade) || null;
  const bestStudent = current.students.slice().sort((a, b) => (
    (Number(b.currentHp || 0) / Math.max(1, Number(b.hp || 1))) * 40 + Number(b.morale || 0)
    - ((Number(a.currentHp || 0) / Math.max(1, Number(a.hp || 1))) * 40 + Number(a.morale || 0))
  ))[0] || current.students[0];
  const battleMeal = bestStudent?.meal ? RECIPES.find((recipe) => recipe.id === bestStudent.meal) : null;
  const battlePower = bestStudent
    ? Number(bestStudent.atk || 0) * 8
      + Number(bestStudent.def || 0) * 5
      + Number(bestStudent.morale || 0)
      + Number(battleMeal?.power || 0)
      + (battleMeal?.tags?.includes(bestStudent.pref) ? 10 : 0)
      - (battleMeal?.tags?.includes(bestStudent.weak) ? 8 : 0)
    : 0;
  const battleTarget = 116 + Number(current.floor || 1) * 18;
  const battleChancePct = Math.round(clamp(0.35 + (battlePower - battleTarget) / 160, 0.12, 0.92) * 100);
  const tournamentRecipe = bestCraftable || unlockedRecipes.slice().sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0] || RECIPES[0];
  const tournament = tournamentPreview(current, tournamentRecipe.id, 'rookie');
  const facilityTotal = facilities.reduce((sum, facility) => sum + Number(facility.level || 0), 0);
  const craftedCount = Number(current.counters?.crafted || 0);
  const soldCount = Number(current.counters?.sold || 0);
  const suppliedCount = Number(current.counters?.supplied || 0);
  const battleCount = Number(current.counters?.battles || 0);
  const growthCount = Number(current.counters?.facilityUpgrades || 0) + Number(current.counters?.researches || 0);
  const ingredientCostMap = INGREDIENTS.reduce((map, item) => ({ ...map, [item.id]: Number(item.price || 0) }), {});
  const loopRecipe = bestCraftable || unlockedRecipes[0] || RECIPES[0];
  const loopInputCost = Object.entries(loopRecipe.needs || {}).reduce((sum, [id, qty]) => sum + Number(ingredientCostMap[id] || 0) * Number(qty || 0), 0) + Number(loopRecipe.craftCost || 0);
  const loopOutputGold = Math.round(Number(loopRecipe.sellPrice || 0) * Math.max(1, Number(loopRecipe.yieldTokens || 1)) * Number(ctx.goldMultFromOrders || 1));
  const loopMargin = loopOutputGold - loopInputCost;
  const avgMorale = averageStudents(current, 'morale');
  const avgHpPct = Math.round(current.students.reduce((sum, student) => (
    sum + (Number(student.currentHp || 0) / Math.max(1, Number(student.hp || 1))) * 100
  ), 0) / Math.max(1, current.students.length));
  const readinessPct = Math.round(clamp(
    20
      + (unlockedRecipes.length / Math.max(1, recipes.length)) * 22
      + Math.min(18, tokenTotal * 4)
      + Math.min(14, facilityTotal * 1.4)
      + Math.min(12, Number(current.floor || 1) * 1.8)
      + avgMorale * 0.08
      + (judge.accuracy || 0) * 0.04,
    0,
    100,
  ));
  const recommendations = [];

  if (current.ended) {
    recommendations.push(buildOperationAction('record', '운영 기록', '2주 운영이 끝났습니다. 전적에 기록하고 새 운영을 시작할 차례입니다.', 'high'));
  } else if (tokenTotal > 0) {
    recommendations.push(buildOperationAction('orders', '일일 주문 처리', `준비된 메뉴 ${tokenTotal}개를 먼저 판매해 골드와 평판을 회수하세요.`, 'high'));
  } else if (bestCraftable) {
    recommendations.push(buildOperationAction('craft', '메뉴 제작', `${bestCraftable.name} 제작이 가능합니다. 판매가 ${bestCraftable.sellPrice}G라 회전율이 좋습니다.`, 'high'));
  } else {
    const missingRecipe = unlockedRecipes.find((recipe) => !hasIngredients(current.inventory, recipe.needs)) || RECIPES[0];
    recommendations.push(buildOperationAction('buy', '재료 매입', `${missingRecipe.name} 재료를 채우면 제작 루프를 다시 돌릴 수 있습니다.`, 'high'));
  }

  if (readyResearch) {
    recommendations.push(buildOperationAction('research', '레시피 연구', `${readyResearch.name}을 바로 연구할 수 있습니다. 메뉴 풀이 넓어집니다.`, 'medium'));
  }
  if (readyFacility) {
    recommendations.push(buildOperationAction('facility', '시설 강화', `${readyFacility.name} Lv.${Number(readyFacility.level || 1) + 1} 업그레이드가 가능합니다.`, 'medium'));
  }
  if (bestStudent && battleChancePct >= 55) {
    recommendations.push(buildOperationAction('battle', '전투 진행', `${bestStudent.name} 기준 ${current.floor}층 예상 승률이 ${battleChancePct}%입니다.`, 'medium'));
  } else if (bestStudent) {
    recommendations.push(buildOperationAction('feed', '학생 회복', `${bestStudent.name} 기준 승률이 ${battleChancePct}%라 배식 후 전투가 낫습니다.`, 'medium'));
  }
  if (tournament.win) {
    recommendations.push(buildOperationAction('tournament', '루키 대회 출전', `${tournamentRecipe.name} 예상 점수 ${tournament.total}점으로 우승권입니다.`, 'low'));
  }

  const tutorialRows = [
    buildTutorialStep('buy', '재료 매입', '돈카츠 제작 재료를 최소 5칸 확보합니다.', ingredientTotal >= 5 || craftedCount > 0, ingredientTotal / 5 * 100, '재료 상점에서 돼지고기와 빵가루를 먼저 채우세요.'),
    buildTutorialStep('craft', '첫 메뉴 제작', '기본 돈카츠나 샐러드를 만들어 판매 가능한 메뉴를 확보합니다.', craftedCount > 0 || tokenTotal > 0 || soldCount > 0, Math.max(craftedCount, tokenTotal) * 100, '주방/영업 탭에서 메뉴 제작을 누르세요.'),
    buildTutorialStep('sell', '영업 매출 회수', '준비된 메뉴를 팔거나 일일 주문으로 골드를 회수합니다.', soldCount > 0, soldCount / 3 * 100, '준비 메뉴가 생기면 일일 주문 처리를 우선 실행하세요.'),
    buildTutorialStep('feed', '학생 배식', '전투 전에 선호 태그가 맞는 메뉴를 배식해 HP와 사기를 올립니다.', suppliedCount > 0 || battleCount > 0, suppliedCount * 100, '학생/전투 탭에서 선택 메뉴 배식을 실행하세요.'),
    buildTutorialStep('battle', '첫 전투', '배식 후 예상 승률이 안정권이면 전투 보상을 회수합니다.', battleCount > 0, battleCount * 100, '예상 승률 55% 이상일 때 전투 진행이 효율적입니다.'),
    buildTutorialStep('growth', '시설 또는 연구', '골드와 조각을 써서 시설/레시피 중 하나를 확장합니다.', growthCount > 0, growthCount * 100, '성장/대회 탭에서 강화 가능 항목을 먼저 확인하세요.'),
  ];
  const tutorialPct = Math.round(tutorialRows.reduce((sum, row) => sum + Number(row.progressPct || 0), 0) / Math.max(1, tutorialRows.length));
  const balanceRows = [
    buildBalanceRow('economy', '제작 마진', `${loopRecipe.name} ${loopMargin >= 0 ? '+' : ''}${loopMargin}G`, 50 + loopMargin / 4, loopMargin >= 80 ? 'good' : loopMargin >= 20 ? 'watch' : 'risk', `투입 ${loopInputCost}G / 주문 매출 ${loopOutputGold}G 기준입니다.`),
    buildBalanceRow('storage', '보관 압박', `${ingredientTotal}/${ctx.storageCap}`, 100 - (ingredientTotal / Math.max(1, ctx.storageCap)) * 65, ingredientTotal >= ctx.storageCap ? 'risk' : ingredientTotal >= ctx.storageCap * 0.8 ? 'watch' : 'good', '보관 한도에 가까우면 제작 또는 시설 강화가 우선입니다.'),
    buildBalanceRow('student', '학생 컨디션', `${avgHpPct}% HP / 사기 ${avgMorale}`, (avgHpPct + avgMorale) / 2, avgHpPct < 45 ? 'risk' : avgMorale < 45 ? 'watch' : 'good', 'HP와 사기가 낮으면 배식 후 다음 전투를 진행하세요.'),
    buildBalanceRow('battle', '전투 난이도', `${battleChancePct}%`, battleChancePct, battleChancePct >= 65 ? 'good' : battleChancePct >= 45 ? 'watch' : 'risk', `추천 학생 ${bestStudent?.name || '없음'} 기준 ${current.floor}층 예상입니다.`),
    buildBalanceRow('tournament', '대회 격차', `${tournament.total}/${tournament.tier.targetScore}`, 50 + (tournament.total - tournament.tier.targetScore) * 1.2, tournament.win ? 'good' : tournament.total >= tournament.tier.targetScore - 18 ? 'watch' : 'risk', `${tournamentRecipe.name} 루키 대회 미리보기입니다.`),
    buildBalanceRow('judge', '심사 표본', `${judge.judged}판 / ${judge.accuracy}%`, Math.min(100, judge.judged * 7 + judge.accuracy * 0.4), judge.judged >= 10 && judge.accuracy >= 55 ? 'good' : judge.judged >= 5 ? 'watch' : 'risk', '심사 표본이 쌓이면 대회 판정 감각을 검증할 수 있습니다.'),
  ];
  const balanceScore = Math.round(balanceRows.reduce((sum, row) => sum + Number(row.pct || 0), 0) / Math.max(1, balanceRows.length));

  return {
    headline: current.ended
      ? '운영 종료'
      : readinessPct >= 75
        ? '확장 가능'
        : readinessPct >= 50
          ? '운영 안정'
          : '재료 회전 필요',
    readinessPct,
    tutorialPct,
    balanceScore,
    riskLabel: avgHpPct < 45 ? '학생 회복 필요' : ingredientTotal >= ctx.storageCap ? '보관 한도 초과' : tokenTotal > 0 ? '판매 대기' : '정상',
    tutorialRows,
    balanceRows,
    businessRows: [
      { label: '영업 방식', value: current.businessMode === 'delivery' ? '배달' : '홀' },
      { label: '주문 처리량', value: ctx.dailyOrders },
      { label: '보관 한도', value: `${ingredientTotal}/${ctx.storageCap}` },
      { label: '준비 메뉴', value: tokenTotal },
    ],
    kitchenRows: [
      { label: '제작 가능', value: `${craftableRecipes.length}/${unlockedRecipes.length}` },
      { label: '해금 메뉴', value: `${unlockedRecipes.length}/${recipes.length}` },
      { label: '잠김 메뉴', value: lockedRecipes },
      { label: '최고 제작 후보', value: bestCraftable?.name || '재료 부족' },
    ],
    growthRows: [
      { label: '시설 레벨 합', value: facilityTotal },
      { label: '연구 가능', value: readyResearch ? readyResearch.name : '없음' },
      { label: '강화 가능', value: readyFacility ? readyFacility.name : '없음' },
      { label: '심사 정확도', value: `${judge.accuracy}%` },
    ],
    battleRows: [
      { label: '추천 학생', value: bestStudent?.name || '없음' },
      { label: '평균 HP', value: `${avgHpPct}%` },
      { label: '평균 사기', value: avgMorale },
      { label: '전투 승률', value: `${battleChancePct}%` },
    ],
    recommendations: recommendations.slice(0, 5),
  };
}

export function productionReportForState(state) {
  const current = normalizeState(state);
  const ctx = buildFacilityContext(current);
  const tokenTotal = mealTokenCount(current);
  const ingredientTotal = inventoryCount(current);
  const avgMorale = averageStudents(current, 'morale');
  const avgHpPct = Math.round(current.students.reduce((sum, student) => (
    sum + (Number(student.currentHp || 0) / Math.max(1, Number(student.hp || 1))) * 100
  ), 0) / Math.max(1, current.students.length));
  const counters = current.counters || {};
  const soldCount = Number(counters.sold || 0);
  const craftedCount = Number(counters.crafted || 0);
  const battleCount = Number(counters.battles || 0);
  const victoryCount = Number(counters.victories || 0);
  const tournamentWins = Number(counters.tournamentWins || 0);
  const judgeMatches = Number(counters.judgeMatches || 0);
  const facilityTotal = Object.values(current.facilityLevels || {}).reduce((sum, level) => sum + Number(level || 0), 0);
  const unlockedRecipes = recipeRows(current).filter((recipe) => recipe.unlocked).length;
  const bestStudent = current.students.slice().sort((a, b) => (
    Number(b.morale || 0) + Number(b.currentHp || 0) - Number(a.morale || 0) - Number(a.currentHp || 0)
  ))[0] || current.students[0];
  const phase = Number(current.day || 1) <= 3
    ? '오픈 초반'
    : Number(current.day || 1) <= 9
      ? '확장 운영'
      : '최종 정산';
  const salesScene = tokenTotal > 0
    ? `준비 메뉴 ${tokenTotal}개를 주문 처리 장면으로 바로 연결할 수 있습니다.`
    : ingredientTotal >= 4
      ? '재료는 있으니 주방 제작 장면을 먼저 잡는 흐름이 좋습니다.'
      : '재료 매입 장면부터 시작하면 다음 액션이 선명해집니다.';
  const battleScene = battleCount > victoryCount
    ? '최근 전투 실패가 있어 회복/배식 컷을 먼저 배치하는 편이 자연스럽습니다.'
    : avgHpPct >= 65 && avgMorale >= 55
      ? `${bestStudent?.name || '학생'} 중심의 다음 전투 컷을 바로 보여줄 수 있습니다.`
      : '학생 컨디션이 낮아 배식과 휴식 장면을 강조하는 편이 좋습니다.';
  const productionScore = Math.round(clamp(
    25
      + Math.min(16, soldCount * 3)
      + Math.min(14, craftedCount * 2)
      + Math.min(14, victoryCount * 4)
      + Math.min(10, tournamentWins * 6)
      + Math.min(10, judgeMatches)
      + Math.min(8, facilityTotal)
      + Math.min(8, unlockedRecipes)
      + (tokenTotal > 0 ? 5 : 0),
    0,
    100,
  ));
  const eventRows = [
    buildProductionRow(
      'lunch-rush',
      '점심 러시',
      current.businessMode === 'delivery' ? '배달 주문 폭주' : '홀 좌석 만석',
      '준비 메뉴가 많을수록 주문 처리와 평판 회수 장면을 강하게 보여줍니다.',
      30 + tokenTotal * 12 + soldCount * 2 + ctx.dailyOrders * 5,
      tokenTotal > 0 ? 'ready' : 'setup',
    ),
    buildProductionRow(
      'student-support',
      '학생 응원전',
      `${bestStudent?.name || '학생'} 배식/전투 연결`,
      '선호 태그 배식 후 전투에 들어가면 전투 연출과 보상 회수가 한 화면에서 이어집니다.',
      25 + avgHpPct * 0.35 + avgMorale * 0.35 + battleCount * 5,
      avgHpPct >= 55 ? 'ready' : 'setup',
    ),
    buildProductionRow(
      'judge-week',
      '미식 심사 주간',
      `${judgeMatches}회 심사 표본`,
      '심사 기록이 쌓이면 대회 전 판정 감각을 확인하는 이벤트 주간으로 전환됩니다.',
      20 + judgeMatches * 8,
      judgeMatches >= 5 ? 'ready' : 'setup',
    ),
    buildProductionRow(
      'festival-booth',
      '축제 부스 운영',
      `${unlockedRecipes}개 메뉴 / 시설 합 ${facilityTotal}`,
      '레시피와 시설이 충분하면 판매, 대회, 평판 보너스를 묶은 장기 이벤트로 씁니다.',
      20 + unlockedRecipes * 7 + facilityTotal * 4 + tournamentWins * 10,
      unlockedRecipes >= 6 && facilityTotal >= 8 ? 'ready' : 'setup',
    ),
  ];
  const sceneCues = [
    buildProductionRow('sales', '영업 컷', current.businessMode === 'delivery' ? '배달' : '홀', salesScene, tokenTotal > 0 ? 82 : ingredientTotal >= 4 ? 58 : 34, tokenTotal > 0 ? 'ready' : 'setup'),
    buildProductionRow('battle', '전투 컷', bestStudent?.name || '학생', battleScene, avgHpPct >= 65 ? 76 : 44, avgHpPct >= 65 ? 'ready' : 'setup'),
    buildProductionRow('growth', '성장 컷', `시설 합 ${facilityTotal}`, '시설/연구가 올라갈수록 주방이 넓어지는 장면으로 운영 성장을 보여줍니다.', 35 + facilityTotal * 6, facilityTotal >= 7 ? 'ready' : 'setup'),
  ];
  const soundCues = [
    { id: 'kitchen', cue: '주방 지글', target: craftedCount > 0 ? '제작 성공' : '첫 메뉴 제작', detail: '메뉴 제작 버튼 결과와 연결합니다.' },
    { id: 'bell', cue: '주문 벨', target: tokenTotal > 0 ? '주문 처리' : '메뉴 준비', detail: '영업 루프의 다음 행동을 짧게 알려줍니다.' },
    { id: 'battle', cue: victoryCount > 0 ? '승리 팡파르' : '전투 긴장음', target: '학생 전투', detail: '배식 후 전투 흐름을 분리해서 인지시키는 큐입니다.' },
    { id: 'judge', cue: judgeMatches >= 5 ? '심사 하이라이트' : '심사 대기음', target: '심사위원 모드', detail: '대회와 심사 데이터를 이어주는 소리 표식입니다.' },
  ];
  const recommendations = [];
  if (tokenTotal > 0) recommendations.push('준비 메뉴가 있으니 점심 러시 이벤트를 먼저 소화하세요.');
  if (avgHpPct < 55) recommendations.push('전투 컷 전에 학생 배식 장면을 먼저 넣는 편이 안정적입니다.');
  if (judgeMatches < 5) recommendations.push('심사 표본을 5회 이상 쌓으면 미식 심사 주간 이벤트가 열립니다.');
  if (unlockedRecipes < 6) recommendations.push('축제 부스 운영을 위해 레시피 연구를 더 진행하세요.');
  if (!recommendations.length) recommendations.push('장기 이벤트 조건이 충분합니다. 판매, 전투, 심사를 묶어 한 사이클로 진행하세요.');
  return {
    phase,
    productionScore,
    sceneCues,
    eventRows,
    soundCues,
    recommendations,
  };
}

export function summaryForState(state) {
  const operationsReport = operationsReportForState(state);
  const productionReport = productionReportForState(state);
  return {
    day: state.day,
    gold: state.gold,
    reputation: state.reputation,
    floor: state.floor,
    recipes: mealTokenCount(state),
    ingredients: inventoryCount(state),
    morale: averageStudents(state, 'morale'),
    facilities: Object.values(state.facilityLevels || {}).reduce((sum, level) => sum + Number(level || 0), 0),
    researches: Number(state.counters?.researches || 0),
    tournamentWins: Number(state.counters?.tournamentWins || 0),
    judgeMatches: Number(state.counters?.judgeMatches || 0),
    judgeAccuracy: Number(state.counters?.judgeMatches || 0)
      ? Math.round((Number(state.counters?.judgeCorrect || 0) / Number(state.counters?.judgeMatches || 0)) * 100)
      : 0,
    readinessPct: operationsReport.readinessPct,
    tutorialPct: operationsReport.tutorialPct,
    balanceScore: operationsReport.balanceScore,
    productionScore: productionReport.productionScore,
    productionPhase: productionReport.phase,
    operationStatus: operationsReport.headline,
    score: scoreState(state),
  };
}
