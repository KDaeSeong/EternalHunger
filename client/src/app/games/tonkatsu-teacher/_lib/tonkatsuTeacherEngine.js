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
    counters: { crafted: 0, sold: 0, battles: 0, victories: 0, supplied: 0 },
    log: ['Day 1: 돈카츠 가게를 열었습니다. 재료를 관리하고 메뉴를 만들어 학생들을 지원하세요.'],
    ended: false,
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    mealTokens: value.mealTokens && typeof value.mealTokens === 'object' ? value.mealTokens : base.mealTokens,
    students: Array.isArray(value.students) && value.students.length ? value.students : base.students,
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
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId) || INGREDIENTS[0];
  const amount = Math.max(1, Number(qty || 1));
  const cost = ingredient.price * amount;
  if (state.gold < cost) return addLog(state, `${ingredient.name} 구매 실패. 골드가 부족합니다.`);
  return addLog({
    ...state,
    gold: state.gold - cost,
    inventory: addInventory(state.inventory, ingredient.id, amount),
  }, `${ingredient.name} ${amount}개를 구매했습니다. -${cost}G`);
}

export function craftRecipeAction(state, recipeId) {
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (state.gold < recipe.craftCost) return addLog(state, `${recipe.name} 제작 실패. 제작비가 부족합니다.`);
  if (!hasIngredients(state.inventory, recipe.needs)) {
    return addLog(state, `${recipe.name} 제작 실패. 필요 재료: ${formatNeeds(recipe.needs)}.`);
  }
  const failChance = recipe.category === 'main' ? 0.08 : 0.04;
  const failed = Math.random() < failChance;
  let next = {
    ...state,
    gold: state.gold - recipe.craftCost,
    inventory: spendIngredients(state.inventory, recipe.needs),
    counters: { ...state.counters, crafted: Number(state.counters.crafted || 0) + 1 },
  };
  if (failed) {
    return addLog(next, `${recipe.name} 제작이 흔들렸습니다. 재료 일부와 제작비를 소모했습니다.`);
  }
  next = {
    ...next,
    mealTokens: {
      ...next.mealTokens,
      [recipe.id]: Number(next.mealTokens[recipe.id] || 0) + recipe.yieldTokens,
    },
  };
  return addLog(next, `${recipe.name} ${recipe.yieldTokens}개를 준비했습니다.`);
}

export function sellRecipeAction(state, recipeId, qty = 1) {
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const amount = Math.max(1, Number(qty || 1));
  const have = Number(state.mealTokens[recipe.id] || 0);
  if (have < amount) return addLog(state, `${recipe.name} 판매 실패. 준비된 메뉴가 부족합니다.`);
  const demand = 1 + Math.min(0.3, Number(state.reputation || 0) / 1000);
  const revenue = Math.round(recipe.sellPrice * amount * demand);
  const repGain = Math.max(1, Math.round((recipe.power / 8) * amount));
  return addLog({
    ...state,
    gold: state.gold + revenue,
    reputation: state.reputation + repGain,
    mealTokens: { ...state.mealTokens, [recipe.id]: have - amount },
    counters: { ...state.counters, sold: Number(state.counters.sold || 0) + amount },
  }, `${recipe.name} ${amount}개를 판매했습니다. +${revenue}G, 평판 +${repGain}`);
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
  const student = getStudent(state, studentId);
  const meal = RECIPES.find((recipe) => recipe.id === student.meal);
  const mealPower = meal ? meal.power : 0;
  const prefBonus = meal?.tags?.includes(student.pref) ? 10 : 0;
  const weakPenalty = meal?.tags?.includes(student.weak) ? 8 : 0;
  const power = Number(student.atk || 0) * 8
    + Number(student.def || 0) * 5
    + Number(student.morale || 0)
    + mealPower
    + prefBonus
    - weakPenalty;
  const target = 116 + Number(state.floor || 1) * 18;
  const chance = clamp(0.35 + (power - target) / 160, 0.12, 0.92);
  const won = Math.random() < chance;
  const damage = won ? Math.max(6, 18 + state.floor * 2 - student.def) : Math.max(12, 34 + state.floor * 3 - student.def);
  const nextHp = clamp(Number(student.currentHp || 0) - damage, 0, student.hp);
  const rewardGold = won ? Math.round(30 * (1 + 0.13 * (state.floor - 1))) : 8;
  const shardGain = won && Math.random() < Math.min(0.35, 0.12 + 0.008 * state.floor) ? 1 : 0;
  let next = {
    ...state,
    gold: state.gold + rewardGold,
    recipeShards: state.recipeShards + shardGain,
    floor: won ? state.floor + 1 : state.floor,
    counters: {
      ...state.counters,
      battles: Number(state.counters.battles || 0) + 1,
      victories: Number(state.counters.victories || 0) + (won ? 1 : 0),
    },
  };
  next = updateStudent(next, student.id, {
    currentHp: nextHp,
    morale: clamp(Number(student.morale || 0) + (won ? 5 : -9), 0, 100),
    wins: Number(student.wins || 0) + (won ? 1 : 0),
    meal: '',
  });
  const message = won
    ? `${student.name}이 ${state.floor}층 전투에서 승리했습니다. +${rewardGold}G${shardGain ? ', 레시피 조각 +1' : ''}`
    : `${student.name}이 ${state.floor}층에서 패배했습니다. 위로 보상 +${rewardGold}G`;
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

export function scoreState(state) {
  return Math.max(0, Math.round(
    Number(state.gold || 0)
    + Number(state.reputation || 0) * 12
    + Number(state.floor || 1) * 90
    + Number(state.recipeShards || 0) * 18
    + Number(state.counters.crafted || 0) * 12
    + Number(state.counters.sold || 0) * 18
    + Number(state.counters.victories || 0) * 80
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
    score: scoreState(state),
  };
}
