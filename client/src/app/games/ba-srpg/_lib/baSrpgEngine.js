export const GAME_SLUG = 'ba-srpg';
export const QUICK_SAVE_SLOT = 'ba-srpg-main';
export const SAVE_VERSION = 'ba-srpg-v1';

export const GRID = { width: 8, height: 6 };

export const ITEMS = [
  { id: 'mat_wood', name: '나무', kind: 'material', stackMax: 99 },
  { id: 'mat_stone', name: '돌', kind: 'material', stackMax: 99 },
  { id: 'con_bandage', name: '붕대', kind: 'consumable', stackMax: 20 },
  { id: 'eq_knife', name: '나이프', kind: 'equipment', stackMax: 1, stats: { atk: 2, acc: 5 } },
];

export const MISSIONS = [
  {
    id: 'm001',
    name: '첫 임무: 정찰',
    region: '학원구 외곽',
    objective: '학원구 외곽을 정찰하고 수상한 흔적을 기록한 뒤 귀환하십시오.',
    caution: '가벼운 교전 가능성. 엄폐를 활용하고 붕대를 준비하세요.',
    difficulty: 'easy',
    recommendedPower: 60,
    creditMin: 12,
    creditMax: 18,
    rewards: [
      { itemId: 'mat_wood', qtyMin: 1, qtyMax: 3, chance: 1 },
      { itemId: 'con_bandage', qtyMin: 1, qtyMax: 1, chance: 0.3 },
    ],
    enemies: [
      { id: 'e_scout', name: '정찰 드론', x: 5, y: 1, hp: 20, atk: 6, def: 1, range: 3, move: 2 },
      { id: 'e_raider', name: '소형 강습병', x: 6, y: 3, hp: 28, atk: 8, def: 2, range: 1, move: 2 },
    ],
  },
  {
    id: 'm002',
    name: '두번째 임무: 교전',
    region: '폐허 지구',
    objective: '폐허 지구에서 적을 격퇴하고 보급 상자를 확보하십시오.',
    caution: '적 사격이 거셀 수 있습니다. 이동 후 공격 각을 확보하세요.',
    difficulty: 'normal',
    recommendedPower: 120,
    creditMin: 18,
    creditMax: 28,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 1, qtyMax: 3, chance: 1 },
      { itemId: 'con_bandage', qtyMin: 1, qtyMax: 1, chance: 0.3 },
    ],
    enemies: [
      { id: 'e_raider_a', name: '강습병 A', x: 5, y: 1, hp: 32, atk: 9, def: 2, range: 1, move: 2 },
      { id: 'e_raider_b', name: '강습병 B', x: 6, y: 4, hp: 32, atk: 9, def: 2, range: 1, move: 2 },
      { id: 'e_sniper', name: '폐허 저격수', x: 7, y: 2, hp: 24, atk: 10, def: 1, range: 4, move: 1 },
    ],
  },
  {
    id: 'm003',
    name: '세번째 임무: 보급로 확보',
    region: '보급로',
    objective: '상가-학원구 사이 보급로를 순찰하고 장애물을 제거한 뒤 보고하십시오.',
    caution: '소규모 매복 가능성. 이동 경로를 분산하고 엄폐를 끼고 접근하세요.',
    difficulty: 'easy',
    recommendedPower: 90,
    creditMin: 14,
    creditMax: 22,
    rewards: [
      { itemId: 'mat_wood', qtyMin: 2, qtyMax: 5, chance: 1 },
      { itemId: 'mat_stone', qtyMin: 1, qtyMax: 2, chance: 0.6 },
      { itemId: 'con_bandage', qtyMin: 1, qtyMax: 1, chance: 0.35 },
    ],
    enemies: [
      { id: 'e_blocker', name: '장애물 경비병', x: 5, y: 2, hp: 35, atk: 8, def: 3, range: 1, move: 1 },
      { id: 'e_runner', name: '우회조', x: 6, y: 0, hp: 24, atk: 7, def: 1, range: 2, move: 3 },
      { id: 'e_drone', name: '감시 드론', x: 7, y: 4, hp: 22, atk: 6, def: 1, range: 3, move: 2 },
    ],
  },
  {
    id: 'm004',
    name: '네번째 임무: 야전 진지',
    region: '폐허 지구 외곽',
    objective: '폐허 지구 외곽의 야전 진지를 정리하고 남은 물자를 확보하십시오.',
    caution: '교전 강도가 상승합니다. 공격 각과 사거리(명중)를 먼저 확보하세요.',
    difficulty: 'normal',
    recommendedPower: 170,
    creditMin: 22,
    creditMax: 36,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 2, qtyMax: 5, chance: 1 },
      { itemId: 'mat_wood', qtyMin: 1, qtyMax: 3, chance: 0.7 },
      { itemId: 'con_bandage', qtyMin: 1, qtyMax: 2, chance: 0.45 },
      { itemId: 'eq_knife', qtyMin: 1, qtyMax: 1, chance: 0.12 },
    ],
    enemies: [
      { id: 'e_vanguard', name: '야전 선봉병', x: 5, y: 1, hp: 38, atk: 10, def: 3, range: 1, move: 2 },
      { id: 'e_marksman', name: '야전 저격수', x: 7, y: 2, hp: 28, atk: 12, def: 1, range: 4, move: 1 },
      { id: 'e_guard', name: '보급 경비병', x: 6, y: 4, hp: 42, atk: 9, def: 4, range: 1, move: 1 },
      { id: 'e_drone_b', name: '감시 드론 B', x: 7, y: 0, hp: 24, atk: 7, def: 1, range: 3, move: 2 },
    ],
  },
];

export const STUDENTS = [
  { id: 's_hoshino', name: '호시노', role: '탱커', x: 0, y: 2, hp: 54, atk: 10, def: 5, range: 1, move: 2 },
  { id: 's_yuuka', name: '유우카', role: '방어', x: 1, y: 3, hp: 46, atk: 8, def: 6, range: 1, move: 2 },
  { id: 's_mika', name: '미카', role: '돌격', x: 0, y: 1, hp: 42, atk: 14, def: 3, range: 1, move: 3 },
  { id: 's_noa', name: '노아', role: '지원', x: 1, y: 2, hp: 34, atk: 7, def: 2, range: 3, move: 2 },
];

export const STATUS_DEFS = {
  st_bleed: { id: 'st_bleed', name: '출혈', kind: 'DoT', tickDamage: 4, maxStacks: 1 },
  st_burn: { id: 'st_burn', name: '화상', kind: 'DoT', tickDamage: 5, maxStacks: 2 },
  st_stun: { id: 'st_stun', name: '기절', kind: 'Control', tickDamage: 0, maxStacks: 1 },
};

export const TACTICAL_SKILLS = [
  {
    id: 'sk_guard',
    name: '방어 태세',
    apCost: 2,
    target: 'self',
    rangeMin: 0,
    rangeMax: 0,
    shield: 8,
    duration: 2,
    desc: '자신에게 보호막 8을 부여합니다. 원본 Shield 정책처럼 수치는 합산하고 지속시간은 긴 쪽을 유지합니다.',
  },
  {
    id: 'sk_first_aid',
    name: '응급 처치',
    apCost: 2,
    target: 'self',
    rangeMin: 0,
    rangeMax: 0,
    heal: 10,
    desc: '선택 학생의 HP를 10 회복합니다.',
  },
  {
    id: 'sk_bleed_round',
    name: '출혈탄',
    apCost: 2,
    target: 'enemy',
    rangeMin: 1,
    rangeMax: 4,
    damageMul: 1,
    statusId: 'st_bleed',
    statusChance: 0.85,
    duration: 2,
    accuracyAdd: 0,
    desc: '무기 피해를 주고 85% 확률로 출혈을 부여합니다.',
  },
  {
    id: 'sk_burn_round',
    name: '소이탄',
    apCost: 2,
    target: 'enemy',
    rangeMin: 1,
    rangeMax: 4,
    damageMul: 0.85,
    techDamage: true,
    statusId: 'st_burn',
    statusChance: 0.75,
    duration: 2,
    accuracyAdd: -0.04,
    desc: '기술 피해를 주고 75% 확률로 화상을 부여합니다. 화상은 최대 2중첩입니다.',
  },
  {
    id: 'sk_grenade_flash',
    name: '섬광 투척',
    apCost: 2,
    target: 'enemy',
    rangeMin: 1,
    rangeMax: 5,
    damageMul: 0,
    statusId: 'st_stun',
    statusChance: 0.6,
    duration: 1,
    accuracyAdd: 0.08,
    desc: '대상에게 60% 확률로 기절을 부여합니다. 기절한 적은 다음 적 턴 행동을 건너뜁니다.',
  },
];

export const RECIPES = [
  { id: 'r_bandage', name: '붕대 만들기', inputs: [{ itemId: 'mat_wood', qty: 2 }], outputs: [{ itemId: 'con_bandage', qty: 1 }], costCredit: 5, requiredFacility: 'workbench' },
  { id: 'r_knife', name: '나이프 제작', inputs: [{ itemId: 'mat_stone', qty: 2 }, { itemId: 'mat_wood', qty: 1 }], outputs: [{ itemId: 'eq_knife', qty: 1 }], costCredit: 10, requiredFacility: 'workbench' },
];

export const SHOP_ITEMS = [
  { itemId: 'mat_wood', price: 2, stock: 30 },
  { itemId: 'mat_stone', price: 3, stock: 30 },
  { itemId: 'con_bandage', price: 8, stock: 10 },
  { itemId: 'eq_knife', price: 30, stock: 1 },
];

export const ECONOMY = {
  startingCredit: 500,
  innRestCost: 50,
  shop: { priceMulMin: 0.9, priceMulMax: 1.1, stockBumpMax: 3 },
  guild: {
    rankTable: [
      { minRep: 0, rank: 'F', nextRep: 100 },
      { minRep: 100, rank: 'E', nextRep: 250 },
      { minRep: 250, rank: 'D', nextRep: 500 },
      { minRep: 500, rank: 'C', nextRep: 1000 },
      { minRep: 1000, rank: 'B', nextRep: 2000 },
      { minRep: 2000, rank: 'A', nextRep: 4000 },
      { minRep: 4000, rank: 'S', nextRep: null },
    ],
  },
};

export const PROPERTIES = [
  {
    id: 'prop_shop_kiosk',
    name: '상가 키오스크',
    facility: 'shop',
    buyPrice: 900,
    rentFee: 150,
    rentCostPerDay: 15,
    leaseIncomePerDay: 40,
    desc: '상점과 연결되는 소형 점포입니다. 상점 가격 변동 폭을 낮춥니다.',
  },
  {
    id: 'prop_guild_branch',
    name: '길드 지부 사무실',
    facility: 'guild',
    buyPrice: 1400,
    rentFee: 220,
    rentCostPerDay: 25,
    leaseIncomePerDay: 65,
    desc: '길드 평판/랭크 업무를 돕는 사무실입니다. 의뢰 평판 보상이 10% 증가합니다.',
  },
  {
    id: 'prop_inn_room',
    name: '여관 전용 객실',
    facility: 'inn',
    buyPrice: 1100,
    rentFee: 180,
    rentCostPerDay: 20,
    leaseIncomePerDay: 50,
    desc: '여관 숙박 품질을 개선합니다. 휴식 비용이 10% 감소합니다.',
  },
  {
    id: 'prop_craft_shed',
    name: '소형 제작 작업장',
    facility: 'craft',
    buyPrice: 1000,
    rentFee: 170,
    rentCostPerDay: 18,
    leaseIncomePerDay: 45,
    desc: '제작과 연동되는 작업장입니다. 제작 비용이 5% 감소합니다.',
  },
];

export const EDICTS = [
  {
    id: 'ed_shop_discount_5',
    name: '상업 장려령',
    desc: '이번 달 동안 상점 판매가가 5% 할인됩니다.',
    cadence: 'monthly',
    effects: [{ type: 'shop_price_multiplier', value: 0.95 }],
  },
  {
    id: 'ed_inn_rest_discount_10',
    name: '숙박 지원령',
    desc: '이번 달 동안 여관 휴식 비용이 10% 할인됩니다.',
    cadence: 'monthly',
    effects: [{ type: 'inn_rest_cost_multiplier', value: 0.9 }],
  },
];

export const QUESTS = [
  {
    id: 'q_bandage_delivery',
    title: '붕대 납품',
    text: '붕대 1개를 가져오면 간단한 보상을 드립니다.',
    cadence: 'daily',
    requirement: { type: 'haveItem', itemId: 'con_bandage', qty: 1 },
    reward: { credit: 80, items: [{ itemId: 'mat_wood', qty: 1 }] },
    repReward: 5,
  },
  {
    id: 'q_weekly_training',
    title: '주간 훈련 보고',
    text: '이번 주에 전투 2회 승리하고 보고하세요.',
    cadence: 'weekly',
    requirement: { type: 'battleWin', count: 2 },
    reward: { credit: 200, items: [{ itemId: 'mat_stone', qty: 1 }] },
    repReward: 10,
  },
  {
    id: 'q_monthly_supplies',
    title: '월간 보급',
    text: '이번 달 보급품으로 나무 3개를 전달하세요.',
    cadence: 'monthly',
    requirement: { type: 'haveItem', itemId: 'mat_wood', qty: 3 },
    reward: { credit: 350, items: [{ itemId: 'con_bandage', qty: 1 }] },
    repReward: 15,
  },
  {
    id: 'q_yearly_review',
    title: '연간 전투 성과',
    text: '올해 전투 5회 승리한 기록을 제출하세요.',
    cadence: 'yearly',
    requirement: { type: 'battleWin', count: 5 },
    reward: { credit: 900, items: [{ itemId: 'eq_knife', qty: 1 }] },
    repReward: 40,
  },
  {
    id: 'q_knife_check',
    title: '무기 점검',
    text: '나이프 장비 1개를 가져오면 크레딧을 드립니다.',
    cadence: 'once',
    requirement: { type: 'haveItem', itemId: 'eq_knife', qty: 1 },
    reward: { credit: 120, items: [] },
    repReward: 5,
  },
  {
    id: 'q_first_victory',
    title: '첫 승리 보고',
    text: '전투에서 1회 승리하고 보고하세요.',
    cadence: 'once',
    requirement: { type: 'battleWin', count: 1 },
    reward: { credit: 100, items: [{ itemId: 'con_bandage', qty: 1 }] },
    repReward: 3,
  },
];

const OBSTACLES = new Set(['3,1', '3,2', '4,4']);
const COVER = new Set(['2,0', '2,4', '5,3']);
const AI_RULES = {
  takeCover: 'AI_TAKE_COVER',
  attackIfInRange: 'AI_ATTACK_IF_IN_RANGE',
  moveToAttack: 'AI_MOVE_TO_ATTACK',
  moveToward: 'AI_MOVE_TOWARD',
  wait: 'AI_WAIT',
};
const AI_COVER_HP_RATIO = 0.42;

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const runId = options.runId || `srpg-${Date.now().toString(36)}`;
  return {
    runId,
    startedAt: now,
    updatedAt: now,
    day: 1,
    credit: ECONOMY.startingCredit,
    guildRep: 0,
    selectedMissionId: 'm001',
    inventory: { mat_wood: 3, con_bandage: 1 },
    equipment: [],
    weaponUid: '',
    battleWins: 0,
    battleWinLog: [],
    completedMissionIds: [],
    completedQuestIds: [],
    questClaims: {},
    properties: { ownedIds: [], leasedOutIds: [], rented: {} },
    edictState: { monthly: null },
    shopState: createShopState(runId, 1),
    battle: createBattle('m001'),
    log: ['출정 준비가 끝났습니다. 학생을 선택하고 이동/공격으로 첫 임무를 정리하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const runId = String(value.runId || base.runId);
  const day = Math.max(1, Math.floor(Number(value.day || base.day || 1)));
  return {
    ...base,
    ...value,
    runId,
    day,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    equipment: Array.isArray(value.equipment) ? value.equipment : base.equipment,
    battleWinLog: Array.isArray(value.battleWinLog) ? value.battleWinLog : base.battleWinLog,
    completedMissionIds: Array.isArray(value.completedMissionIds) ? value.completedMissionIds : base.completedMissionIds,
    completedQuestIds: Array.isArray(value.completedQuestIds) ? value.completedQuestIds : base.completedQuestIds,
    questClaims: value.questClaims && typeof value.questClaims === 'object' ? value.questClaims : questClaimsFromCompleted(value.completedQuestIds),
    properties: normalizeProperties(value.properties),
    edictState: normalizeEdictState(value.edictState),
    shopState: normalizeShopState(value.shopState, runId, day),
    battle: value.battle && typeof value.battle === 'object' ? normalizeBattle(value.battle) : createBattle(value.selectedMissionId || 'm001'),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

function questClaimsFromCompleted(completedQuestIds = []) {
  return Array.isArray(completedQuestIds)
    ? completedQuestIds.reduce((next, questId) => ({ ...next, [questId]: { lastPeriodKey: 'legacy-once' } }), {})
    : {};
}

function normalizeProperties(value = {}) {
  return {
    ownedIds: Array.isArray(value?.ownedIds) ? value.ownedIds.filter((id) => PROPERTIES.some((property) => property.id === id)) : [],
    leasedOutIds: Array.isArray(value?.leasedOutIds) ? value.leasedOutIds.filter((id) => PROPERTIES.some((property) => property.id === id)) : [],
    rented: value?.rented && typeof value.rented === 'object'
      ? Object.fromEntries(Object.entries(value.rented).filter(([id]) => PROPERTIES.some((property) => property.id === id)))
      : {},
  };
}

function normalizeEdictState(value = {}) {
  const monthly = value?.monthly && typeof value.monthly === 'object' && EDICTS.some((edict) => edict.id === value.monthly.edictId)
    ? { periodKey: String(value.monthly.periodKey || ''), edictId: value.monthly.edictId }
    : null;
  return { monthly };
}

function normalizeBattle(battle) {
  const mission = getMission(battle.missionId || 'm001');
  return {
    ...createBattle(mission.id),
    ...battle,
    units: Array.isArray(battle.units) ? battle.units.map(normalizeCombatActor) : createUnits(),
    enemies: Array.isArray(battle.enemies) ? battle.enemies.map(normalizeCombatActor) : createEnemies(mission),
    selectedUnitId: battle.selectedUnitId || 's_hoshino',
    targetEnemyId: battle.targetEnemyId || '',
  };
}

function createUnits() {
  return STUDENTS.map((student) => ({
    ...student,
    maxHp: student.hp,
    ap: 2,
    acted: false,
    shield: null,
    statuses: [],
  }));
}

function createEnemies(mission) {
  return mission.enemies.map((enemy) => ({
    ...enemy,
    maxHp: enemy.hp,
    ap: 2,
    shield: null,
    statuses: [],
  }));
}

function createBattle(missionId) {
  const mission = getMission(missionId);
  return {
    missionId: mission.id,
    turn: 1,
    phase: 'player',
    selectedUnitId: 's_hoshino',
    targetEnemyId: '',
    units: createUnits(),
    enemies: createEnemies(mission),
    lastResult: '',
  };
}

function normalizeCombatActor(actor = {}) {
  const maxHp = Math.max(1, safeWholeNumber(actor.maxHp ?? actor.hp, 1));
  const statuses = Array.isArray(actor.statuses)
    ? actor.statuses
      .filter((status) => STATUS_DEFS[status?.id])
      .map((status) => ({
        id: status.id,
        duration: Math.max(1, safeWholeNumber(status.duration, 1)),
        stacks: Math.max(1, Math.min(STATUS_DEFS[status.id].maxStacks || 1, safeWholeNumber(status.stacks, 1))),
      }))
    : [];
  const shieldAmount = safeWholeNumber(actor.shield?.amount, 0);
  const shieldDuration = safeWholeNumber(actor.shield?.duration, 0);
  return {
    ...actor,
    maxHp,
    hp: clamp(safeWholeNumber(actor.hp, maxHp), 0, maxHp),
    ap: safeWholeNumber(actor.ap, 0),
    shield: shieldAmount > 0 && shieldDuration > 0 ? { amount: shieldAmount, duration: shieldDuration } : null,
    statuses,
  };
}

export function getMission(missionId) {
  return MISSIONS.find((mission) => mission.id === missionId) || MISSIONS[0];
}

export function getItem(itemId) {
  return ITEMS.find((item) => item.id === itemId) || null;
}

export function itemName(itemId) {
  return getItem(itemId)?.name || itemId;
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 90),
  };
}

function addItem(inventory, itemId, qty) {
  return {
    ...inventory,
    [itemId]: Math.max(0, Number(inventory[itemId] || 0) + Number(qty || 0)),
  };
}

function itemCount(state, itemId) {
  const inventoryCount = Number(state.inventory?.[itemId] || 0);
  const equipmentCount = (state.equipment || []).filter((item) => item.itemId === itemId).length;
  return inventoryCount + equipmentCount;
}

function hasItems(inventory, items = []) {
  return items.every((item) => Number(inventory[item.itemId] || 0) >= Number(item.qty || 0));
}

function spendItems(inventory, items = []) {
  return items.reduce((next, item) => addItem(next, item.itemId, -item.qty), inventory);
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

const SHOP_REFRESH_BASE_COST = 20;
const SHOP_REFRESH_COST_STEP = 10;

function safeWholeNumber(value, fallback = 0) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function shopSeedFor(runId, day, refreshCount) {
  return `${runId || GAME_SLUG}|shop|d${Math.max(1, safeWholeNumber(day, 1))}|r${safeWholeNumber(refreshCount, 0)}`;
}

function generatedShopRows(seed) {
  const rng = createRng(seed);
  const priceMin = Math.min(ECONOMY.shop.priceMulMin, ECONOMY.shop.priceMulMax);
  const priceMax = Math.max(ECONOMY.shop.priceMulMin, ECONOMY.shop.priceMulMax);
  const stockBumpMax = safeWholeNumber(ECONOMY.shop.stockBumpMax, 0);
  return SHOP_ITEMS.map((line) => {
    const basePrice = Math.max(0, Math.floor(Number(line.price || 0)));
    const priceMul = priceMin + rng() * (priceMax - priceMin);
    const price = Math.max(1, Math.floor(basePrice * priceMul));
    const hasStock = typeof line.stock === 'number';
    const stock = hasStock
      ? Math.max(0, Math.floor(Number(line.stock || 0)) + Math.floor(rng() * (stockBumpMax + 1)))
      : null;
    return { itemId: line.itemId, price, stock };
  });
}

function createShopState(runId, day = 1, refreshCount = 0, paidRefreshCount = 0, freeRefreshUsed = false) {
  const safeDay = Math.max(1, safeWholeNumber(day, 1));
  const safeRefreshCount = safeWholeNumber(refreshCount, 0);
  const seed = shopSeedFor(runId, safeDay, safeRefreshCount);
  return {
    day: safeDay,
    seed,
    refreshCount: safeRefreshCount,
    paidRefreshCount: safeWholeNumber(paidRefreshCount, 0),
    freeRefreshUsed: freeRefreshUsed === true,
    rows: generatedShopRows(seed),
  };
}

function normalizeShopState(value, runId, day) {
  const safeDay = Math.max(1, safeWholeNumber(day, 1));
  const refreshCount = safeWholeNumber(value?.refreshCount ?? value?.rerollCount, 0);
  const paidRefreshCount = safeWholeNumber(value?.paidRefreshCount ?? value?.rerollCount, 0);
  const freeRefreshUsed = value?.freeRefreshUsed === true || value?.freeRerollUsed === true;
  const generated = createShopState(runId, safeDay, refreshCount, paidRefreshCount, freeRefreshUsed);
  if (!value || typeof value !== 'object' || Math.max(1, safeWholeNumber(value.day, safeDay)) !== safeDay) {
    return generated;
  }
  const rows = Array.isArray(value.rows) ? value.rows : [];
  const normalizedRows = SHOP_ITEMS.map((line) => {
    const generatedRow = generated.rows.find((row) => row.itemId === line.itemId) || { price: line.price, stock: line.stock ?? null };
    const savedRow = rows.find((row) => row?.itemId === line.itemId) || null;
    const stockFromLegacy = value.stockByItemId && typeof value.stockByItemId === 'object'
      ? value.stockByItemId[line.itemId]
      : undefined;
    const rawStock = savedRow?.stock ?? stockFromLegacy ?? generatedRow.stock;
    return {
      itemId: line.itemId,
      price: Math.max(1, safeWholeNumber(savedRow?.price ?? generatedRow.price, line.price)),
      stock: rawStock == null && typeof line.stock !== 'number'
        ? null
        : Math.max(0, safeWholeNumber(rawStock, generatedRow.stock ?? 0)),
    };
  });
  return { ...generated, rows: normalizedRows };
}

function shopRefreshCost(state) {
  const shopState = normalizeShopState(state.shopState, state.runId, state.day);
  return SHOP_REFRESH_BASE_COST + safeWholeNumber(shopState.paidRefreshCount, 0) * SHOP_REFRESH_COST_STEP;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function periodKeyFor(cadence = 'once', day = 1) {
  const safeDay = Math.max(1, Math.floor(Number(day || 1)));
  if (cadence === 'daily') return `d${safeDay}`;
  if (cadence === 'weekly') return `w${Math.floor((safeDay - 1) / 7) + 1}`;
  if (cadence === 'monthly') return `m${Math.floor((safeDay - 1) / 30) + 1}`;
  if (cadence === 'yearly') return `y${Math.floor((safeDay - 1) / 365) + 1}`;
  return 'once';
}

function getProperty(propertyId) {
  return PROPERTIES.find((property) => property.id === propertyId) || null;
}

function hasActiveFacility(state, facility) {
  const properties = normalizeProperties(state.properties);
  return PROPERTIES.some((property) => {
    if (property.facility !== facility) return false;
    const ownedActive = properties.ownedIds.includes(property.id) && !properties.leasedOutIds.includes(property.id);
    const rentedActive = Boolean(properties.rented[property.id]);
    return ownedActive || rentedActive;
  });
}

function hasOwnedActiveFacility(state, facility) {
  const properties = normalizeProperties(state.properties);
  return PROPERTIES.some((property) => (
    property.facility === facility
    && properties.ownedIds.includes(property.id)
    && !properties.leasedOutIds.includes(property.id)
  ));
}

function activeMonthlyEdict(state) {
  const current = normalizeState(state);
  const monthly = current.edictState?.monthly;
  if (!monthly?.edictId || monthly.periodKey !== periodKeyFor('monthly', current.day)) return null;
  return EDICTS.find((edict) => edict.id === monthly.edictId) || null;
}

function edictEffectMultiplier(edict, effectType) {
  const effect = edict?.effects?.find((item) => item.type === effectType);
  return Number.isFinite(effect?.value) ? Number(effect.value) : 1;
}

function shopPriceMultiplier(state) {
  const edictMul = edictEffectMultiplier(activeMonthlyEdict(state), 'shop_price_multiplier');
  const shopFacilityMul = hasActiveFacility(state, 'shop') ? 0.98 : 1;
  return edictMul * shopFacilityMul;
}

function adjustedShopPrice(state, line) {
  return Math.max(1, Math.floor(Number(line.price || 0) * shopPriceMultiplier(state)));
}

function innRestCost(state) {
  const edictMul = edictEffectMultiplier(activeMonthlyEdict(state), 'inn_rest_cost_multiplier');
  const innFacilityMul = hasActiveFacility(state, 'inn') ? 0.9 : 1;
  return Math.max(0, Math.floor(ECONOMY.innRestCost * edictMul * innFacilityMul));
}

function craftCost(state, recipe) {
  const craftFacilityMul = hasActiveFacility(state, 'craft') ? 0.95 : 1;
  return Math.max(0, Math.floor(Number(recipe.costCredit || 0) * craftFacilityMul));
}

function guildRepReward(state, baseRep) {
  const rep = Math.max(0, Math.floor(Number(baseRep || 0)));
  if (!rep) return { total: 0, bonus: 0 };
  const bonus = hasActiveFacility(state, 'guild') ? Math.max(1, Math.floor(rep * 0.1)) : 0;
  return { total: rep + bonus, bonus };
}

function questCadence(quest) {
  return ['daily', 'weekly', 'monthly', 'yearly', 'once'].includes(quest?.cadence) ? quest.cadence : 'once';
}

function questPeriodKey(state, quest) {
  return periodKeyFor(questCadence(quest), state.day);
}

function hasClaimedQuest(state, quest) {
  const cadence = questCadence(quest);
  const entry = state.questClaims?.[quest.id];
  if (cadence === 'once') return Boolean(entry) || state.completedQuestIds.includes(quest.id);
  return entry?.lastPeriodKey === questPeriodKey(state, quest);
}

function battleWinCountForQuest(state, quest) {
  const cadence = questCadence(quest);
  if (cadence === 'once') return Number(state.battleWins || 0);
  const periodKey = questPeriodKey(state, quest);
  return (state.battleWinLog || []).filter((entry) => periodKeyFor(cadence, entry.day) === periodKey).length;
}

function settlePropertyDay(state, nextDay) {
  const properties = normalizeProperties(state.properties);
  const rented = { ...properties.rented };
  let leaseIncome = 0;
  let rentPaid = 0;
  let expiredCount = 0;
  let rentCanceled = 0;

  properties.leasedOutIds.forEach((propertyId) => {
    const property = getProperty(propertyId);
    if (property && properties.ownedIds.includes(propertyId)) leaseIncome += Number(property.leaseIncomePerDay || 0);
  });

  Object.entries(rented).forEach(([propertyId, rentInfo]) => {
    const untilDay = Number(rentInfo?.untilDay || 0);
    if (untilDay < nextDay) {
      delete rented[propertyId];
      expiredCount += 1;
      return;
    }
    const property = getProperty(propertyId);
    rentPaid += Number(property?.rentCostPerDay || 0);
  });

  let credit = Number(state.credit || 0) + leaseIncome;
  if (rentPaid > credit) {
    rentCanceled = Object.keys(rented).length;
    Object.keys(rented).forEach((propertyId) => { delete rented[propertyId]; });
    rentPaid = 0;
  } else {
    credit -= rentPaid;
  }

  return {
    credit,
    properties: { ...properties, rented },
    leaseIncome,
    rentPaid,
    expiredCount,
    rentCanceled,
  };
}

function distance(a, b) {
  return Math.abs(Number(a.x || 0) - Number(b.x || 0)) + Math.abs(Number(a.y || 0) - Number(b.y || 0));
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function inside(x, y) {
  return x >= 0 && y >= 0 && x < GRID.width && y < GRID.height;
}

function occupiedBy(units, enemies, x, y, ignoreId = '') {
  return [...units, ...enemies].find((actor) => actor.id !== ignoreId && actor.hp > 0 && actor.x === x && actor.y === y) || null;
}

function tileDefense(x, y) {
  return COVER.has(keyOf(x, y)) ? 2 : 0;
}

function coverDamageNote(actor) {
  const reduction = tileDefense(actor.x, actor.y);
  return reduction > 0 ? ` (엄폐 피해감소 -${reduction})` : '';
}

function selectedUnit(battle) {
  return battle.units.find((unit) => unit.id === battle.selectedUnitId && unit.hp > 0)
    || battle.units.find((unit) => unit.hp > 0)
    || battle.units[0];
}

function selectedEnemy(battle) {
  return battle.enemies.find((enemy) => enemy.id === battle.targetEnemyId && enemy.hp > 0)
    || battle.enemies.find((enemy) => enemy.hp > 0)
    || battle.enemies[0];
}

function weaponBonus(state) {
  const weapon = state.equipment.find((item) => item.uid === state.weaponUid);
  const tpl = weapon ? getItem(weapon.itemId) : null;
  return {
    atk: Number(tpl?.stats?.atk || 0),
    acc: Number(tpl?.stats?.acc || 0),
    name: tpl?.name || '',
  };
}

function hasStatus(actor, statusId) {
  return Array.isArray(actor?.statuses) && actor.statuses.some((status) => status.id === statusId && Number(status.duration || 0) > 0);
}

function statusLabel(status) {
  const def = STATUS_DEFS[status?.id];
  if (!def) return '';
  const stacks = Number(status.stacks || 1) > 1 ? `x${status.stacks}` : '';
  return `${def.name}${stacks}/${status.duration}`;
}

export function actorStatusText(actor) {
  const parts = [];
  if (Number(actor?.shield?.amount || 0) > 0) parts.push(`보호막 ${actor.shield.amount}/${actor.shield.duration}`);
  (actor?.statuses || []).forEach((status) => {
    const label = statusLabel(status);
    if (label) parts.push(label);
  });
  return parts.join(' · ');
}

function absorbDamage(actor, amount) {
  const damage = Math.max(0, Math.floor(Number(amount || 0)));
  if (!damage) return { actor, absorbed: 0, hpDamage: 0 };
  const shieldAmount = Number(actor.shield?.amount || 0);
  const absorbed = Math.min(shieldAmount, damage);
  const hpDamage = Math.max(0, damage - absorbed);
  const nextShieldAmount = Math.max(0, shieldAmount - absorbed);
  return {
    actor: {
      ...actor,
      shield: nextShieldAmount > 0 ? { ...actor.shield, amount: nextShieldAmount } : null,
      hp: Math.max(0, Number(actor.hp || 0) - hpDamage),
    },
    absorbed,
    hpDamage,
  };
}

function applyStatus(actor, statusId, duration = 2) {
  const def = STATUS_DEFS[statusId];
  if (!def) return actor;
  const statuses = Array.isArray(actor.statuses) ? actor.statuses : [];
  const existing = statuses.find((status) => status.id === statusId);
  if (!existing) {
    return {
      ...actor,
      statuses: [...statuses, { id: statusId, duration: Math.max(1, safeWholeNumber(duration, 1)), stacks: 1 }],
    };
  }
  return {
    ...actor,
    statuses: statuses.map((status) => {
      if (status.id !== statusId) return status;
      const maxStacks = def.maxStacks || 1;
      return {
        ...status,
        duration: Math.max(Number(status.duration || 1), Math.max(1, safeWholeNumber(duration, 1))),
        stacks: Math.min(maxStacks, Math.max(1, Number(status.stacks || 1) + (statusId === 'st_burn' ? 1 : 0))),
      };
    }),
  };
}

function applyShield(actor, amount, duration) {
  const nextAmount = Math.max(0, safeWholeNumber(amount, 0));
  const nextDuration = Math.max(1, safeWholeNumber(duration, 1));
  const currentAmount = Number(actor.shield?.amount || 0);
  const currentDuration = Number(actor.shield?.duration || 0);
  return {
    ...actor,
    shield: {
      amount: currentAmount + nextAmount,
      duration: Math.max(currentDuration, nextDuration),
    },
  };
}

function tickActorStatuses(actor) {
  let next = normalizeCombatActor(actor);
  const messages = [];
  const nextStatuses = [];
  next.statuses.forEach((status) => {
    const def = STATUS_DEFS[status.id];
    if (!def) return;
    const stacks = Math.max(1, Number(status.stacks || 1));
    if (def.kind === 'DoT' && next.hp > 0) {
      const damage = Number(def.tickDamage || 0) * stacks;
      const result = absorbDamage(next, damage);
      next = result.actor;
      messages.push(`${next.name} ${def.name} ${damage} 피해${result.absorbed ? ` (보호막 ${result.absorbed})` : ''}`);
    }
    const duration = Number(status.duration || 1) - 1;
    if (duration > 0 && next.hp > 0) nextStatuses.push({ ...status, duration });
  });
  const shield = next.shield
    ? { ...next.shield, duration: Number(next.shield.duration || 1) - 1 }
    : null;
  return {
    actor: {
      ...next,
      shield: shield && shield.amount > 0 && shield.duration > 0 ? shield : null,
      statuses: nextStatuses,
    },
    messages,
  };
}

function processRoundEndTicks(battle) {
  const messages = [];
  const units = battle.units.map((unit) => {
    const result = tickActorStatuses(unit);
    messages.push(...result.messages);
    return result.actor;
  });
  const enemies = battle.enemies.map((enemy) => {
    const result = tickActorStatuses(enemy);
    messages.push(...result.messages);
    return result.actor;
  });
  return {
    battle: { ...battle, units, enemies },
    messages,
  };
}

function aliveUnits(battle) {
  return battle.units.filter((unit) => unit.hp > 0);
}

function aliveEnemies(battle) {
  return battle.enemies.filter((enemy) => enemy.hp > 0);
}

function applyBattleOutcome(state, battle) {
  if (!aliveEnemies(battle).length) return grantMissionReward(state, { ...battle, phase: 'cleared', lastResult: '승리' });
  if (!aliveUnits(battle).length) {
    return addLog({
      ...state,
      battle: { ...battle, phase: 'failed', lastResult: '패배' },
    }, `${getMission(battle.missionId).name} 실패. 여관에서 재정비하세요.`);
  }
  return {
    ...state,
    battle,
  };
}

function rollMissionRewards(state, mission, rng) {
  let inventory = state.inventory;
  const gained = [];
  mission.rewards.forEach((reward) => {
    if (rng() > Number(reward.chance || 0)) return;
    const min = Number(reward.qtyMin || 0);
    const max = Math.max(min, Number(reward.qtyMax || min));
    const qty = min + Math.floor(rng() * (max - min + 1));
    inventory = addItem(inventory, reward.itemId, qty);
    gained.push(`${itemName(reward.itemId)} ${qty}`);
  });
  return { inventory, gained };
}

function grantMissionReward(state, battle) {
  const mission = getMission(battle.missionId);
  const rng = createRng(`${state.runId}|reward|${mission.id}|${state.battleWins}`);
  const credit = mission.creditMin + Math.floor(rng() * (mission.creditMax - mission.creditMin + 1));
  const rewards = rollMissionRewards(state, mission, rng);
  const completedSet = new Set(state.completedMissionIds);
  completedSet.add(mission.id);
  const next = {
    ...state,
    credit: Number(state.credit || 0) + credit,
    inventory: rewards.inventory,
    battleWins: Number(state.battleWins || 0) + 1,
    battleWinLog: [
      { day: Number(state.day || 1), missionId: mission.id, credit },
      ...(Array.isArray(state.battleWinLog) ? state.battleWinLog : []),
    ].slice(0, 120),
    completedMissionIds: [...completedSet],
    battle,
  };
  const rewardText = rewards.gained.length ? `, ${rewards.gained.join(', ')}` : '';
  return addLog(next, `${mission.name} 클리어. +${credit} Cr${rewardText}`);
}

export function startMissionAction(state, missionId) {
  const current = normalizeState(state);
  const mission = getMission(missionId);
  return addLog({
    ...current,
    selectedMissionId: mission.id,
    battle: createBattle(mission.id),
  }, `${mission.name} 출정을 시작했습니다.`);
}

export function selectUnitAction(state, unitId) {
  const current = normalizeState(state);
  return {
    ...current,
    battle: { ...current.battle, selectedUnitId: unitId },
  };
}

export function selectEnemyAction(state, enemyId) {
  const current = normalizeState(state);
  return {
    ...current,
    battle: { ...current.battle, targetEnemyId: enemyId },
  };
}

export function moveSelectedAction(state, dx, dy) {
  const current = normalizeState(state);
  const battle = current.battle;
  if (battle.phase !== 'player') return addLog(current, '플레이어 턴이 아닙니다.');
  const unit = selectedUnit(battle);
  if (!unit || unit.hp <= 0) return addLog(current, '이동할 학생이 없습니다.');
  if (Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}의 AP가 부족합니다.`);
  const x = Number(unit.x || 0) + Number(dx || 0);
  const y = Number(unit.y || 0) + Number(dy || 0);
  if (!inside(x, y) || OBSTACLES.has(keyOf(x, y))) return addLog(current, '이동할 수 없는 칸입니다.');
  if (occupiedBy(battle.units, battle.enemies, x, y, unit.id)) return addLog(current, '이미 다른 유닛이 있는 칸입니다.');
  const nextBattle = {
    ...battle,
    units: battle.units.map((row) => (
      row.id === unit.id ? { ...row, x, y, ap: Number(row.ap || 0) - 1 } : row
    )),
    lastResult: `${unit.name} 이동`,
  };
  return {
    ...current,
    battle: nextBattle,
  };
}

export function attackSelectedAction(state, enemyId) {
  const current = normalizeState(state);
  const battle = current.battle;
  if (battle.phase !== 'player') return addLog(current, '플레이어 턴이 아닙니다.');
  const unit = selectedUnit(battle);
  const enemy = battle.enemies.find((row) => row.id === enemyId && row.hp > 0) || selectedEnemy(battle);
  if (!unit || !enemy) return addLog(current, '공격 대상이 없습니다.');
  if (Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}의 AP가 부족합니다.`);
  if (distance(unit, enemy) > Number(unit.range || 1)) return addLog(current, `${enemy.name}이(가) 사거리 밖입니다.`);
  const bonus = weaponBonus(current);
  const rng = createRng(`${current.runId}|atk|${battle.turn}|${unit.id}|${enemy.id}|${unit.ap}|${enemy.hp}`);
  const hit = rng() < clamp(0.78 + bonus.acc / 100 - tileDefense(enemy.x, enemy.y) * 0.04, 0.35, 0.97);
  const rawDamage = Math.max(1, Number(unit.atk || 0) + bonus.atk - Number(enemy.def || 0) - tileDefense(enemy.x, enemy.y));
  const damage = hit ? rawDamage : 0;
  const damageResult = absorbDamage(enemy, damage);
  const nextEnemies = battle.enemies.map((row) => (
    row.id === enemy.id ? damageResult.actor : row
  ));
  const defeated = nextEnemies.find((row) => row.id === enemy.id)?.hp <= 0;
  const shieldText = damageResult.absorbed ? ` (보호막 ${damageResult.absorbed})` : '';
  const nextBattle = {
    ...battle,
    enemies: nextEnemies,
    units: battle.units.map((row) => (
      row.id === unit.id ? { ...row, ap: Number(row.ap || 0) - 1, acted: true } : row
    )),
    targetEnemyId: defeated ? '' : enemy.id,
    lastResult: hit ? `${unit.name} -> ${enemy.name} ${damage} 피해${shieldText}${defeated ? ' 격파' : ''}` : `${unit.name} 공격 빗나감`,
  };
  return applyBattleOutcome(addLog(current, nextBattle.lastResult), nextBattle);
}

export function executeSkillAction(state, skillId) {
  const current = normalizeState(state);
  const battle = current.battle;
  if (battle.phase !== 'player') return addLog(current, '플레이어 턴이 아닙니다.');
  const skill = TACTICAL_SKILLS.find((row) => row.id === skillId) || TACTICAL_SKILLS[0];
  const unit = selectedUnit(battle);
  if (!unit || unit.hp <= 0) return addLog(current, '스킬을 사용할 학생이 없습니다.');
  if (Number(unit.ap || 0) < Number(skill.apCost || 0)) return addLog(current, `${unit.name}의 AP가 부족합니다.`);

  if (skill.target === 'self') {
    const nextUnits = battle.units.map((row) => {
      if (row.id !== unit.id) return row;
      let next = { ...row, ap: Number(row.ap || 0) - Number(skill.apCost || 0), acted: true };
      if (skill.heal) next = { ...next, hp: Math.min(next.maxHp, Number(next.hp || 0) + Number(skill.heal || 0)) };
      if (skill.shield) next = applyShield(next, skill.shield, skill.duration);
      return next;
    });
    const resultText = skill.heal
      ? `${unit.name} ${skill.name}. HP +${skill.heal}`
      : `${unit.name} ${skill.name}. 보호막 +${skill.shield}`;
    return addLog({
      ...current,
      battle: {
        ...battle,
        units: nextUnits,
        lastResult: resultText,
      },
    }, resultText);
  }

  const enemy = battle.enemies.find((row) => row.id === battle.targetEnemyId && row.hp > 0) || selectedEnemy(battle);
  if (!enemy || enemy.hp <= 0) return addLog(current, '스킬 대상이 없습니다.');
  const dist = distance(unit, enemy);
  if (dist < Number(skill.rangeMin || 0) || dist > Number(skill.rangeMax || 1)) {
    return addLog(current, `${enemy.name}이(가) ${skill.name} 사거리 밖입니다. (${skill.rangeMin}-${skill.rangeMax})`);
  }

  const bonus = weaponBonus(current);
  const rng = createRng(`${current.runId}|skill|${battle.turn}|${unit.id}|${enemy.id}|${skill.id}|${unit.ap}|${enemy.hp}`);
  const hitChance = clamp(0.78 + Number(skill.accuracyAdd || 0) + bonus.acc / 100 - tileDefense(enemy.x, enemy.y) * 0.04, 0.3, 0.97);
  const hit = rng() < hitChance;
  const rawDamage = Math.max(0, Math.floor(
    (Number(unit.atk || 0) + bonus.atk + (skill.techDamage ? 2 : 0))
      * Number(skill.damageMul ?? 1)
      - (skill.techDamage ? Math.floor(Number(enemy.def || 0) / 2) : Number(enemy.def || 0))
      - tileDefense(enemy.x, enemy.y)
  ));
  const damageResult = absorbDamage(enemy, hit ? rawDamage : 0);
  const statusRolled = Boolean(hit && skill.statusId);
  const statusApplied = statusRolled && rng() < Number(skill.statusChance || 0);
  const nextEnemy = statusApplied ? applyStatus(damageResult.actor, skill.statusId, skill.duration) : damageResult.actor;
  const nextEnemies = battle.enemies.map((row) => (row.id === enemy.id ? nextEnemy : row));
  const defeated = nextEnemies.find((row) => row.id === enemy.id)?.hp <= 0;
  const statusName = STATUS_DEFS[skill.statusId]?.name || '';
  const damageText = rawDamage > 0
    ? `${hit ? rawDamage : 0} 피해${damageResult.absorbed ? ` (보호막 ${damageResult.absorbed})` : ''}`
    : '피해 없음';
  const statusText = statusRolled
    ? statusApplied ? `, ${statusName} 부여` : `, ${statusName} 저항`
    : '';
  const resultText = hit
    ? `${unit.name} ${skill.name} -> ${enemy.name} ${damageText}${statusText}${defeated ? ' 격파' : ''}`
    : `${unit.name} ${skill.name} 빗나감`;
  const nextBattle = {
    ...battle,
    enemies: nextEnemies,
    units: battle.units.map((row) => (
      row.id === unit.id ? { ...row, ap: Number(row.ap || 0) - Number(skill.apCost || 0), acted: true } : row
    )),
    targetEnemyId: defeated ? '' : enemy.id,
    lastResult: resultText,
  };
  return applyBattleOutcome(addLog(current, resultText), nextBattle);
}

export function consumeBandageAction(state) {
  const current = normalizeState(state);
  const battle = current.battle;
  const unit = selectedUnit(battle);
  if (!unit) return current;
  if (Number(current.inventory.con_bandage || 0) <= 0) return addLog(current, '붕대가 없습니다.');
  if (Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}의 AP가 부족합니다.`);
  const heal = 16;
  return addLog({
    ...current,
    inventory: addItem(current.inventory, 'con_bandage', -1),
    battle: {
      ...battle,
      units: battle.units.map((row) => (
        row.id === unit.id ? { ...row, hp: Math.min(row.maxHp, Number(row.hp || 0) + heal), ap: Number(row.ap || 0) - 1 } : row
      )),
      lastResult: `${unit.name} 붕대 사용`,
    },
  }, `${unit.name} HP +${heal}`);
}

function stepToward(actor, target, battle) {
  const candidates = openAdjacentTiles(actor, battle);
  candidates.sort((a, b) => distance(a, target) - distance(b, target));
  return candidates[0] || { x: actor.x, y: actor.y };
}

function openAdjacentTiles(actor, battle) {
  return [
    { x: actor.x + 1, y: actor.y },
    { x: actor.x - 1, y: actor.y },
    { x: actor.x, y: actor.y + 1 },
    { x: actor.x, y: actor.y - 1 },
  ].filter((pos) => inside(pos.x, pos.y)
    && !OBSTACLES.has(keyOf(pos.x, pos.y))
    && !occupiedBy(battle.units, battle.enemies, pos.x, pos.y, actor.id));
}

function coverStep(actor, target, battle) {
  if (tileDefense(actor.x, actor.y) > 0) return null;
  const candidates = openAdjacentTiles(actor, battle).filter((pos) => tileDefense(pos.x, pos.y) > 0);
  candidates.sort((a, b) => {
    const distanceDelta = distance(a, target) - distance(b, target);
    if (distanceDelta !== 0) return distanceDelta;
    return keyOf(a.x, a.y).localeCompare(keyOf(b.x, b.y));
  });
  return candidates[0] || null;
}

function aiRuleLog(rule, message) {
  return `[${rule}] ${message}`;
}

function enemyPhase(state) {
  let battle = normalizeBattle(state.battle);
  let messages = [];
  let units = battle.units;
  let enemies = battle.enemies;

  aliveEnemies(battle).forEach((enemy) => {
    const alive = units.filter((unit) => unit.hp > 0);
    if (!alive.length || enemy.hp <= 0) return;
    if (hasStatus(enemy, 'st_stun')) {
      messages.push(aiRuleLog(AI_RULES.wait, `${enemy.name} 기절로 행동 불가`));
      return;
    }
    let actor = enemies.find((row) => row.id === enemy.id) || enemy;
    let target = [...alive].sort((a, b) => distance(actor, a) - distance(actor, b))[0];
    const lowHp = Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || actor.hp || 1)) <= AI_COVER_HP_RATIO;
    const cover = lowHp ? coverStep(actor, target, { ...battle, units, enemies }) : null;
    let usedCoverMove = false;
    if (cover) {
      actor = { ...actor, x: cover.x, y: cover.y };
      enemies = enemies.map((row) => row.id === actor.id ? actor : row);
      usedCoverMove = true;
      messages.push(aiRuleLog(AI_RULES.takeCover, `${actor.name} 엄폐 이동 (${actor.x + 1},${actor.y + 1})`));
    }

    target = units.filter((unit) => unit.hp > 0).sort((a, b) => distance(actor, a) - distance(actor, b))[0];
    if (!target) return;
    const range = Number(actor.range || 1);
    if (distance(actor, target) > range) {
      if (usedCoverMove) return;
      const pos = stepToward(actor, target, { ...battle, units, enemies });
      const moved = pos.x !== actor.x || pos.y !== actor.y;
      if (!moved) {
        messages.push(aiRuleLog(AI_RULES.wait, `${actor.name} 이동 불가`));
        return;
      }
      const nextDistance = distance(pos, target);
      const moveRule = nextDistance <= range ? AI_RULES.moveToAttack : AI_RULES.moveToward;
      actor = { ...actor, x: pos.x, y: pos.y };
      enemies = enemies.map((row) => row.id === actor.id ? actor : row);
      messages.push(aiRuleLog(moveRule, `${actor.name} 이동 (${actor.x + 1},${actor.y + 1})`));
      if (nextDistance > range) return;
    }

    const damage = Math.max(1, Number(actor.atk || 0) - Number(target.def || 0) - tileDefense(target.x, target.y));
    const damageResult = absorbDamage(target, damage);
    units = units.map((unit) => (
      unit.id === target.id ? damageResult.actor : unit
    ));
    messages.push(aiRuleLog(AI_RULES.attackIfInRange, `${actor.name} -> ${target.name} ${damage} 피해${coverDamageNote(target)}${damageResult.absorbed ? ` (보호막 ${damageResult.absorbed})` : ''}`));
  });

  const ticked = processRoundEndTicks({ ...battle, units, enemies });
  units = ticked.battle.units;
  enemies = ticked.battle.enemies;
  messages = [...messages, ...ticked.messages];

  battle = {
    ...battle,
    units: units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? 2 : 0, acted: false })),
    enemies,
    turn: Number(battle.turn || 1) + 1,
    phase: 'player',
    lastResult: messages.join(' / ') || '적 턴 종료',
  };

  return applyBattleOutcome(addLog(state, battle.lastResult), battle);
}

export function endTurnAction(state) {
  const current = normalizeState(state);
  if (current.battle.phase !== 'player') return current;
  return enemyPhase({
    ...current,
    battle: { ...current.battle, phase: 'enemy' },
  });
}

export function autoPlayerTurnAction(state) {
  let current = normalizeState(state);
  if (current.battle.phase !== 'player') return current;
  aliveUnits(current.battle).forEach((unit) => {
    if (current.battle.phase !== 'player') return;
    current = selectUnitAction(current, unit.id);
    const enemy = aliveEnemies(current.battle).sort((a, b) => distance(unit, a) - distance(unit, b))[0];
    if (!enemy) return;
    if (distance(unit, enemy) > unit.range) {
      const pos = stepToward(unit, enemy, current.battle);
      current = moveSelectedAction(current, pos.x - unit.x, pos.y - unit.y);
    }
    current = attackSelectedAction(current, enemy.id);
  });
  if (current.battle.phase === 'player') current = endTurnAction(current);
  return current;
}

export function restAction(state) {
  const current = normalizeState(state);
  const nextDay = Number(current.day || 1) + 1;
  const restCost = innRestCost(current);
  const settled = settlePropertyDay({ ...current, credit: Math.max(0, Number(current.credit || 0) - restCost) }, nextDay);
  const parts = [`여관에서 하루를 쉬었습니다. 학생 HP가 회복됐습니다. -${restCost} Cr`];
  if (settled.leaseIncome) parts.push(`임대 수익 +${settled.leaseIncome} Cr`);
  if (settled.rentPaid) parts.push(`임차 유지비 -${settled.rentPaid} Cr`);
  if (settled.expiredCount) parts.push(`임차 만료 ${settled.expiredCount}건`);
  if (settled.rentCanceled) parts.push(`유지비 부족으로 임차 종료 ${settled.rentCanceled}건`);
  return addLog({
    ...current,
    day: nextDay,
    battle: {
      ...current.battle,
      units: current.battle.units.map((unit) => ({ ...unit, hp: unit.maxHp, ap: 2, acted: false, shield: null, statuses: [] })),
      enemies: current.battle.enemies.map((enemy) => ({ ...enemy, shield: null, statuses: [] })),
      phase: current.battle.phase === 'failed' ? 'player' : current.battle.phase,
    },
    credit: settled.credit,
    properties: settled.properties,
    shopState: createShopState(current.runId, nextDay),
  }, parts.join(' / '));
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const costCredit = craftCost(current, recipe);
  if (Number(current.credit || 0) < costCredit) return addLog(current, '제작 비용이 부족합니다.');
  if (!hasItems(current.inventory, recipe.inputs)) return addLog(current, '제작 재료가 부족합니다.');
  let inventory = spendItems(current.inventory, recipe.inputs);
  let equipment = current.equipment;
  recipe.outputs.forEach((output) => {
    const item = getItem(output.itemId);
    if (item?.kind === 'equipment') {
      equipment = [...equipment, { uid: `${item.id}-${Date.now().toString(36)}`, itemId: item.id }];
    } else {
      inventory = addItem(inventory, output.itemId, output.qty);
    }
  });
  return addLog({
    ...current,
    credit: Number(current.credit || 0) - costCredit,
    inventory,
    equipment,
  }, `${recipe.name} 완료. -${costCredit} Cr`);
}

export function equipWeaponAction(state, uid) {
  const current = normalizeState(state);
  const inst = current.equipment.find((item) => item.uid === uid);
  const item = inst ? getItem(inst.itemId) : null;
  if (!item?.stats?.atk && !item?.stats?.acc) return addLog(current, '무기로 장착할 수 없는 장비입니다.');
  return addLog({ ...current, weaponUid: uid }, `${item.name}을(를) 장착했습니다.`);
}

export function buyItemAction(state, itemId) {
  const current = normalizeState(state);
  const shop = shopRows(current);
  const line = shop.find((item) => item.itemId === itemId) || shop[0];
  const price = line.price;
  if (line.stock != null && Number(line.stock || 0) <= 0) return addLog(current, '상점 재고가 없습니다.');
  if (Number(current.credit || 0) < price) return addLog(current, '크레딧이 부족합니다.');
  const item = getItem(line.itemId);
  const nextShopState = {
    ...current.shopState,
    rows: current.shopState.rows.map((row) => (
      row.itemId === line.itemId && row.stock != null
        ? { ...row, stock: Math.max(0, Number(row.stock || 0) - 1) }
        : row
    )),
  };
  if (item?.kind === 'equipment') {
    return addLog({
      ...current,
      credit: Number(current.credit || 0) - price,
      shopState: nextShopState,
      equipment: [...current.equipment, { uid: `${item.id}-${Date.now().toString(36)}`, itemId: item.id }],
    }, `${item.name} 구매. -${price} Cr`);
  }
  return addLog({
    ...current,
    credit: Number(current.credit || 0) - price,
    shopState: nextShopState,
    inventory: addItem(current.inventory, line.itemId, 1),
  }, `${itemName(line.itemId)} 구매. -${price} Cr`);
}

export function refreshShopAction(state, useFree = false) {
  const current = normalizeState(state);
  const shopState = normalizeShopState(current.shopState, current.runId, current.day);
  const freeAvailable = hasOwnedActiveFacility(current, 'shop') && !shopState.freeRefreshUsed;
  const paidCost = shopRefreshCost(current);
  if (useFree && !freeAvailable) return addLog(current, '사용 가능한 무료 상점 갱신이 없습니다.');
  if (!useFree && Number(current.credit || 0) < paidCost) return addLog(current, '상점 갱신 크레딧이 부족합니다.');

  const nextPaidRefreshCount = useFree ? shopState.paidRefreshCount : shopState.paidRefreshCount + 1;
  const nextFreeRefreshUsed = useFree ? true : shopState.freeRefreshUsed;
  const nextShopState = createShopState(
    current.runId,
    current.day,
    shopState.refreshCount + 1,
    nextPaidRefreshCount,
    nextFreeRefreshUsed,
  );
  return addLog({
    ...current,
    credit: useFree ? current.credit : Number(current.credit || 0) - paidCost,
    shopState: nextShopState,
  }, useFree ? '상점을 무료로 갱신했습니다.' : `상점을 갱신했습니다. -${paidCost} Cr`);
}

function questComplete(state, quest) {
  if (quest.requirement.type === 'battleWin') return battleWinCountForQuest(state, quest) >= quest.requirement.count;
  if (quest.requirement.type === 'haveItem') return itemCount(state, quest.requirement.itemId) >= quest.requirement.qty;
  return false;
}

function spendQuestRequirement(state, quest) {
  if (quest.requirement.type !== 'haveItem') return { inventory: state.inventory, equipment: state.equipment };
  const item = getItem(quest.requirement.itemId);
  if (item?.kind === 'equipment') {
    let remaining = Number(quest.requirement.qty || 0);
    const equipment = [];
    state.equipment.forEach((entry) => {
      if (entry.itemId === quest.requirement.itemId && remaining > 0) {
        remaining -= 1;
        return;
      }
      equipment.push(entry);
    });
    return { inventory: state.inventory, equipment, weaponUid: equipment.some((entry) => entry.uid === state.weaponUid) ? state.weaponUid : '' };
  }
  return { inventory: addItem(state.inventory, quest.requirement.itemId, -quest.requirement.qty), equipment: state.equipment };
}

function applyQuestReward(state, quest) {
  const spent = spendQuestRequirement(state, quest);
  let inventory = spent.inventory;
  let equipment = spent.equipment;
  (quest.reward.items || []).forEach((reward) => {
    const item = getItem(reward.itemId);
    if (item?.kind === 'equipment') {
      Array.from({ length: Number(reward.qty || 0) }).forEach(() => {
        equipment = [...equipment, { uid: `${item.id}-${Date.now().toString(36)}-${equipment.length}`, itemId: item.id }];
      });
      return;
    }
    inventory = addItem(inventory, reward.itemId, reward.qty);
  });
  return { inventory, equipment, weaponUid: spent.weaponUid ?? state.weaponUid };
}

export function claimQuestAction(state, questId) {
  const current = normalizeState(state);
  const quest = QUESTS.find((item) => item.id === questId) || QUESTS[0];
  if (hasClaimedQuest(current, quest)) return addLog(current, '이번 기간에는 이미 보고한 의뢰입니다.');
  if (!questComplete(current, quest)) return addLog(current, `${quest.title} 조건이 부족합니다.`);
  const completed = new Set(current.completedQuestIds);
  if (questCadence(quest) === 'once') completed.add(quest.id);
  const rep = guildRepReward(current, quest.repReward || 0);
  const rewardPayload = applyQuestReward(current, quest);
  const questClaims = {
    ...current.questClaims,
    [quest.id]: {
      lastPeriodKey: questPeriodKey(current, quest),
      cadence: questCadence(quest),
      claimedAtDay: Number(current.day || 1),
    },
  };
  return addLog({
    ...current,
    completedQuestIds: [...completed],
    questClaims,
    inventory: rewardPayload.inventory,
    equipment: rewardPayload.equipment,
    weaponUid: rewardPayload.weaponUid,
    credit: Number(current.credit || 0) + Number(quest.reward.credit || 0),
    guildRep: Number(current.guildRep || 0) + rep.total,
  }, `${quest.title} 완료. +${quest.reward.credit || 0} Cr, 평판 +${rep.total}${rep.bonus ? ` (시설 보너스 +${rep.bonus})` : ''}`);
}

export function buyPropertyAction(state, propertyId) {
  const current = normalizeState(state);
  const property = getProperty(propertyId) || PROPERTIES[0];
  const properties = normalizeProperties(current.properties);
  if (properties.ownedIds.includes(property.id)) return addLog(current, '이미 소유한 부동산입니다.');
  if (Number(current.credit || 0) < property.buyPrice) return addLog(current, '부동산 구매 크레딧이 부족합니다.');
  const rented = { ...properties.rented };
  delete rented[property.id];
  return addLog({
    ...current,
    credit: Number(current.credit || 0) - Number(property.buyPrice || 0),
    properties: { ...properties, rented, ownedIds: [...properties.ownedIds, property.id] },
  }, `${property.name}을(를) 구매했습니다. -${property.buyPrice} Cr`);
}

export function rentPropertyAction(state, propertyId) {
  const current = normalizeState(state);
  const property = getProperty(propertyId) || PROPERTIES[0];
  const properties = normalizeProperties(current.properties);
  if (properties.ownedIds.includes(property.id)) return addLog(current, '소유한 부동산은 임차할 수 없습니다.');
  if (properties.rented[property.id]) return addLog(current, '이미 임차 중인 부동산입니다.');
  if (Number(current.credit || 0) < property.rentFee) return addLog(current, '부동산 임차 크레딧이 부족합니다.');
  return addLog({
    ...current,
    credit: Number(current.credit || 0) - Number(property.rentFee || 0),
    properties: {
      ...properties,
      rented: {
        ...properties.rented,
        [property.id]: { untilDay: Number(current.day || 1) + 3 },
      },
    },
  }, `${property.name}을(를) 3일간 임차했습니다. -${property.rentFee} Cr`);
}

export function cancelRentPropertyAction(state, propertyId) {
  const current = normalizeState(state);
  const property = getProperty(propertyId) || PROPERTIES[0];
  const properties = normalizeProperties(current.properties);
  if (!properties.rented[property.id]) return addLog(current, '임차 중인 부동산이 아닙니다.');
  const rented = { ...properties.rented };
  delete rented[property.id];
  return addLog({
    ...current,
    properties: { ...properties, rented },
  }, `${property.name} 임차를 종료했습니다.`);
}

export function toggleLeasePropertyAction(state, propertyId) {
  const current = normalizeState(state);
  const property = getProperty(propertyId) || PROPERTIES[0];
  const properties = normalizeProperties(current.properties);
  if (!properties.ownedIds.includes(property.id)) return addLog(current, '소유한 부동산만 임대할 수 있습니다.');
  const leased = properties.leasedOutIds.includes(property.id);
  return addLog({
    ...current,
    properties: {
      ...properties,
      leasedOutIds: leased
        ? properties.leasedOutIds.filter((id) => id !== property.id)
        : [...properties.leasedOutIds, property.id],
    },
  }, leased ? `${property.name} 임대를 종료했습니다.` : `${property.name} 임대를 시작했습니다. 하루 +${property.leaseIncomePerDay} Cr`);
}

export function enactEdictAction(state, edictId) {
  const current = normalizeState(state);
  const edict = EDICTS.find((item) => item.id === edictId) || EDICTS[0];
  const periodKey = periodKeyFor('monthly', current.day);
  if (current.edictState?.monthly?.periodKey === periodKey) return addLog(current, '이번 달에는 이미 칙령을 발령했습니다.');
  return addLog({
    ...current,
    edictState: { monthly: { periodKey, edictId: edict.id } },
  }, `${edict.name}을(를) 이번 달 칙령으로 발령했습니다.`);
}

export function inventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([itemId, qty]) => ({ itemId, name: itemName(itemId), qty, kind: getItem(itemId)?.kind || 'item' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

export function equipmentRows(state) {
  const current = normalizeState(state);
  return current.equipment.map((entry) => {
    const item = getItem(entry.itemId);
    return {
      ...entry,
      name: item?.name || entry.itemId,
      stats: item?.stats || {},
      equipped: current.weaponUid === entry.uid,
    };
  });
}

export function questRows(state) {
  const current = normalizeState(state);
  return QUESTS.map((quest) => ({
    ...quest,
    cadence: questCadence(quest),
    periodKey: questPeriodKey(current, quest),
    progress: quest.requirement.type === 'battleWin' ? battleWinCountForQuest(current, quest) : itemCount(current, quest.requirement.itemId),
    required: quest.requirement.type === 'battleWin' ? quest.requirement.count : quest.requirement.qty,
    done: questComplete(current, quest),
    claimed: hasClaimedQuest(current, quest),
  }));
}

export function shopRows(state) {
  const current = normalizeState(state);
  const shopState = normalizeShopState(current.shopState, current.runId, current.day);
  return SHOP_ITEMS.map((line) => {
    const generated = shopState.rows.find((row) => row.itemId === line.itemId) || { price: line.price, stock: line.stock ?? null };
    const pricedLine = { ...line, price: generated.price };
    return {
      ...line,
      item: getItem(line.itemId),
      name: itemName(line.itemId),
      price: adjustedShopPrice(current, pricedLine),
      dailyPrice: generated.price,
      basePrice: line.price,
      stock: generated.stock,
    };
  });
}

export function recipeRows(state) {
  const current = normalizeState(state);
  return RECIPES.map((recipe) => ({
    ...recipe,
    costCredit: craftCost(current, recipe),
    baseCostCredit: recipe.costCredit,
  }));
}

export function propertyRows(state) {
  const current = normalizeState(state);
  const properties = normalizeProperties(current.properties);
  return PROPERTIES.map((property) => {
    const rented = properties.rented[property.id] || null;
    const owned = properties.ownedIds.includes(property.id);
    const leased = properties.leasedOutIds.includes(property.id);
    return {
      ...property,
      owned,
      leased,
      rented,
      active: (owned && !leased) || Boolean(rented),
      status: owned ? (leased ? '임대 중' : '소유/사용 중') : rented ? `임차 중(~${rented.untilDay}일)` : '미보유',
    };
  });
}

export function edictRows(state) {
  const current = normalizeState(state);
  const active = activeMonthlyEdict(current);
  return EDICTS.map((edict) => ({
    ...edict,
    active: active?.id === edict.id,
    available: !current.edictState?.monthly || current.edictState.monthly.periodKey !== periodKeyFor('monthly', current.day),
  }));
}

export function tacticalSkillRows(state) {
  const current = normalizeState(state);
  const battle = current.battle;
  const unit = selectedUnit(battle);
  const enemy = battle.enemies.find((row) => row.id === battle.targetEnemyId && row.hp > 0) || selectedEnemy(battle);
  return TACTICAL_SKILLS.map((skill) => {
    const hasAp = unit && Number(unit.ap || 0) >= Number(skill.apCost || 0);
    const inPhase = battle.phase === 'player';
    const targetDistance = skill.target === 'enemy' && unit && enemy ? distance(unit, enemy) : 0;
    const inRange = skill.target !== 'enemy' || (targetDistance >= Number(skill.rangeMin || 0) && targetDistance <= Number(skill.rangeMax || 1));
    const canUse = Boolean(inPhase && unit?.hp > 0 && hasAp && inRange);
    let note = skill.desc;
    if (!inPhase) note = '플레이어 턴 아님';
    else if (!unit || unit.hp <= 0) note = '사용할 학생 없음';
    else if (!hasAp) note = `AP ${skill.apCost} 필요`;
    else if (!inRange) note = `거리 ${targetDistance} / 사거리 ${skill.rangeMin}-${skill.rangeMax}`;
    return {
      ...skill,
      canUse,
      targetName: skill.target === 'enemy' ? enemy?.name || '대상 없음' : unit?.name || '학생 없음',
      rangeText: skill.target === 'enemy' ? `${skill.rangeMin}-${skill.rangeMax}` : '자신',
      note,
    };
  });
}

export function guildRankInfo(state) {
  const current = normalizeState(state);
  const rep = Math.max(0, Math.floor(Number(current.guildRep || 0)));
  const table = [...ECONOMY.guild.rankTable].sort((a, b) => a.minRep - b.minRep);
  const currentRank = table.filter((row) => rep >= row.minRep).at(-1) || table[0];
  return {
    rep,
    rank: currentRank.rank,
    nextRep: currentRank.nextRep,
    remaining: currentRank.nextRep == null ? 0 : Math.max(0, currentRank.nextRep - rep),
  };
}

export function townSummary(state) {
  const current = normalizeState(state);
  const properties = propertyRows(current);
  const edict = activeMonthlyEdict(current);
  const shopState = normalizeShopState(current.shopState, current.runId, current.day);
  const hasOwnedShop = hasOwnedActiveFacility(current, 'shop');
  return {
    restCost: innRestCost(current),
    shopDiscountPct: Math.max(0, Math.round((1 - shopPriceMultiplier(current)) * 100)),
    shopRefreshCost: shopRefreshCost(current),
    shopRefreshCount: shopState.refreshCount,
    shopPaidRefreshCount: shopState.paidRefreshCount,
    shopFreeRefreshUsed: shopState.freeRefreshUsed,
    shopFreeRefreshAvailable: hasOwnedShop && !shopState.freeRefreshUsed,
    shopFreeRefreshLeft: hasOwnedShop && !shopState.freeRefreshUsed ? 1 : 0,
    hasOwnedShop,
    activeProperties: properties.filter((property) => property.active).length,
    ownedProperties: properties.filter((property) => property.owned).length,
    rentedProperties: properties.filter((property) => property.rented).length,
    leasedProperties: properties.filter((property) => property.leased).length,
    activeEdictName: edict?.name || '없음',
    guildRank: guildRankInfo(current).rank,
  };
}

export function battlePower(state) {
  const current = normalizeState(state);
  const bonus = weaponBonus(current);
  return current.battle.units.reduce((sum, unit) => sum + Math.max(0, Number(unit.hp || 0)) + Number(unit.atk || 0) * 4 + Number(unit.def || 0) * 2, 0)
    + bonus.atk * 12
    + bonus.acc * 3;
}

export function scoreState(state) {
  const current = normalizeState(state);
  const properties = propertyRows(current);
  const rank = guildRankInfo(current);
  return Math.max(0, Math.round(
    Number(current.credit || 0)
    + Number(current.guildRep || 0) * 12
    + Number(current.battleWins || 0) * 180
    + Object.keys(current.questClaims || {}).length * 90
    + properties.filter((property) => property.owned).length * 220
    + properties.filter((property) => property.active).length * 80
    + (activeMonthlyEdict(current) ? 120 : 0)
    + rank.rep * 2
    + battlePower(current) * 3
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const town = townSummary(current);
  const rank = guildRankInfo(current);
  return {
    day: current.day,
    mission: getMission(current.selectedMissionId).name,
    battleWins: current.battleWins,
    credit: current.credit,
    guildRep: current.guildRep,
    guildRank: rank.rank,
    quests: Object.keys(current.questClaims || {}).length,
    properties: town.activeProperties,
    edict: town.activeEdictName,
    score: scoreState(current),
  };
}

export function cellContent(state, x, y) {
  const current = normalizeState(state);
  const unit = current.battle.units.find((row) => row.hp > 0 && row.x === x && row.y === y);
  if (unit) return { type: 'unit', actor: unit };
  const enemy = current.battle.enemies.find((row) => row.hp > 0 && row.x === x && row.y === y);
  if (enemy) return { type: 'enemy', actor: enemy };
  if (OBSTACLES.has(keyOf(x, y))) return { type: 'obstacle' };
  if (COVER.has(keyOf(x, y))) return { type: 'cover' };
  return { type: 'empty' };
}
