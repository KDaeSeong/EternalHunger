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

export const COSMETIC_SLOT_LABELS = {
  signboard: '간판',
  apron: '앞치마',
  interior: '인테리어',
};

export const DEFAULT_UNLOCKED_COSMETICS = ['cos_signboard_basic', 'cos_apron_basic', 'cos_interior_wood'];

export const DEFAULT_EQUIPPED_COSMETICS = {
  signboard: 'cos_signboard_basic',
  apron: 'cos_apron_basic',
  interior: 'cos_interior_wood',
};

export const COSMETICS = [
  {
    id: 'cos_signboard_basic',
    name: '기본 간판',
    slot: 'signboard',
    desc: '초기 기본 간판입니다. 특별한 효과는 없지만, 이걸로도 충분히 장사는 됩니다.',
    rarity: 1,
    effects: [{ type: 'goldMultFromOrders', value: 1.01 }],
    tags: ['basic'],
  },
  {
    id: 'cos_signboard_neon',
    name: '네온 간판',
    slot: 'signboard',
    desc: '밤에도 눈에 띄는 네온 간판입니다. 배달 주문이 조금 더 늘어납니다.',
    rarity: 2,
    effects: [
      { type: 'goldMultFromOrders', value: 1.02 },
      { type: 'deliveryGoldMult', value: 1.01 },
    ],
    tags: ['shop', 'neon'],
  },
  {
    id: 'cos_signboard_gold',
    name: '황금 간판',
    slot: 'signboard',
    desc: '요리대회 우승 기념으로 만든 황금 간판입니다. 눈에 확 띄는 건 덤입니다.',
    rarity: 3,
    effects: [
      { type: 'goldMultFromOrders', value: 1.03 },
      { type: 'contestScoreMult', category: 'theme', value: 1.01 },
    ],
    tags: ['premium', 'tournament'],
  },
  {
    id: 'cos_apron_basic',
    name: '기본 앞치마',
    slot: 'apron',
    desc: '기본 앞치마입니다. 선생님은 항상 일할 준비가 되어 있습니다.',
    rarity: 1,
    effects: [
      { type: 'failPctAdd', methodId: 'm_fry', value: -0.005 },
      { type: 'production_mult', tag: 'fried', value: 1.01 },
    ],
    tags: ['basic'],
  },
  {
    id: 'cos_apron_blue',
    name: '파란 앞치마',
    slot: 'apron',
    desc: '깔끔한 인상을 주는 파란 앞치마입니다. 손님들이 믿음을 느낍니다.',
    rarity: 2,
    effects: [
      { type: 'failPctAdd', methodId: 'm_fry', value: -0.01 },
      { type: 'tokenBonusChance', tag: 'fried', chance: 0.03 },
    ],
    tags: ['shop', 'clean', 'cool'],
  },
  {
    id: 'cos_apron_stripe',
    name: '스트라이프 앞치마',
    slot: 'apron',
    desc: '줄무늬가 들어간 작업용 앞치마입니다. 주방 동선이 좋아진 느낌이 듭니다.',
    rarity: 2,
    effects: [
      { type: 'failPctAdd', methodId: 'm_fry', value: -0.008 },
      { type: 'production_mult', tag: 'fried', value: 1.02 },
      { type: 'tokenBonusChance', tag: 'fried', chance: 0.01 },
    ],
    tags: ['shop', 'work'],
  },
  {
    id: 'cos_interior_wood',
    name: '우드 감성 인테리어',
    slot: 'interior',
    desc: '나무 결이 살아있는 인테리어입니다. 손님들이 감성 있다고 말합니다.',
    rarity: 1,
    effects: [{ type: 'recipeShardBonus', value: 1 }],
    tags: ['shop', 'interior', 'wood'],
  },
  {
    id: 'cos_interior_lantern',
    name: '등불 장식',
    slot: 'interior',
    desc: '가게 분위기를 따뜻하게 만드는 등불 장식입니다.',
    rarity: 2,
    effects: [{ type: 'contestScoreMult', category: 'creativity', value: 1.02 }],
    tags: ['shop', 'interior', 'warm'],
  },
  {
    id: 'cos_interior_poster',
    name: '프로모션 포스터',
    slot: 'interior',
    desc: '오늘의 추천 메뉴를 강조하는 포스터입니다.',
    rarity: 2,
    effects: [{ type: 'contestScoreMult', category: 'theme', value: 1.02 }],
    tags: ['shop', 'interior', 'promo'],
  },
  {
    id: 'cos_interior_musicbox',
    name: '뮤직박스',
    slot: 'interior',
    desc: '잔잔한 음악이 흐르는 뮤직박스입니다. 심사위원의 기분을 아주 조금 더 좋게 만듭니다.',
    rarity: 3,
    effects: [
      { type: 'contestScoreMult', category: 'creativity', value: 1.03 },
      { type: 'contestScoreMult', category: 'theme', value: 1.01 },
      { type: 'rareDropPct', value: 0.01 },
    ],
    tags: ['shop', 'interior', 'premium'],
  },
];

export const TOURNAMENT_TIERS = [
  { id: 'rookie', name: '루키', entryGold: 90, targetScore: 58, rewardGold: 180, rewardRep: 14, rewardShards: 4, unlockRecipes: ['curry_tonkatsu'] },
  { id: 'intermediate', name: '중급', entryGold: 180, targetScore: 72, rewardGold: 360, rewardRep: 30, rewardShards: 8, unlockRecipes: ['milk_ice', 'yogurt_parfait'] },
  { id: 'advanced', name: '상급', entryGold: 340, targetScore: 86, rewardGold: 720, rewardRep: 58, rewardShards: 14, unlockRecipes: ['honey_lemon_tonkatsu'] },
];

export const JUDGE_AI_CHEFS = [
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
