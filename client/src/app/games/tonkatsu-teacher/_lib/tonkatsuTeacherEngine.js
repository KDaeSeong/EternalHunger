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
    note: '체력과 방어를 함께 밀어주는 든든한 메뉴입니다.',
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
  { recipeId: 'spicy_tonkatsu', name: '매운 돈카츠 연구', gold: 220, recipeShards: 6 },
  { recipeId: 'cheese_tonkatsu', name: '치즈 돈카츠 연구', gold: 280, recipeShards: 8 },
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
  { id: 'intermediate', name: '중급', entryGold: 180, targetScore: 72, rewardGold: 360, rewardRep: 30, rewardShards: 8, unlockRecipes: [] },
  { id: 'advanced', name: '상급', entryGold: 340, targetScore: 86, rewardGold: 720, rewardRep: 58, rewardShards: 14, unlockRecipes: [] },
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
  return current.unlockedRecipeIds.includes(recipeId);
}

export function recipeRows(state) {
  const current = normalizeState(state);
  return RECIPES.map((recipe) => {
    const unlocked = isRecipeUnlocked(current, recipe.id);
    const research = RESEARCH_PROJECTS.find((project) => project.recipeId === recipe.id);
    const tournamentLocked = recipe.id === 'curry_tonkatsu' && !current.clearedTournamentTiers.includes('rookie');
    const reason = unlocked ? '' : research ? `연구 필요: ${research.gold}G + 조각 ${research.recipeShards}` : tournamentLocked ? '루키 대회 우승 필요' : '해금 필요';
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

export function judgeSummary(state) {
  const current = normalizeState(state);
  const judged = current.judgeHistory.length;
  const correct = current.judgeHistory.filter((entry) => entry.correct).length;
  const accuracy = judged ? Math.round((correct / judged) * 100) : 0;
  const rank = judged < 5 ? '견습 심사원' : accuracy >= 75 ? '정밀 심사원' : accuracy >= 55 ? '실전 심사원' : '수련 심사원';
  const modeCounts = current.judgeHistory.reduce((next, entry) => {
    const text = entry.judgeText || '';
    const mode = text.includes(JUDGE_BATCH_MODE_LABELS.strong) ? 'strong' : text.includes(JUDGE_BATCH_MODE_LABELS.weak) ? 'weak' : text.includes('자동심사') ? 'random' : 'manual';
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

export function summaryForState(state) {
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
    score: scoreState(state),
  };
}
