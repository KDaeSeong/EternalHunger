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
    chapter: 1,
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
  {
    id: 'm005',
    name: 'Hard 임무: 연구동 진입로',
    chapter: 2,
    region: '연구동 진입로',
    objective: '연구동 진입로의 경비망을 돌파하고 내부 침입로를 확보하십시오.',
    caution: 'Hard 임무입니다. 적 체력과 공격력이 상승하며, 엄폐를 빼앗기면 빠르게 무너집니다.',
    difficulty: 'hard',
    recommendedPower: 230,
    creditMin: 38,
    creditMax: 56,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 3, qtyMax: 6, chance: 1 },
      { itemId: 'mat_wood', qtyMin: 2, qtyMax: 4, chance: 0.85 },
      { itemId: 'con_bandage', qtyMin: 1, qtyMax: 2, chance: 0.55 },
      { itemId: 'eq_knife', qtyMin: 1, qtyMax: 1, chance: 0.18 },
    ],
    enemies: [
      { id: 'e_hard_vanguard', name: '진입로 선봉대', x: 5, y: 1, hp: 48, atk: 12, def: 4, range: 1, move: 2 },
      { id: 'e_hard_shield', name: '방패 경비병', x: 6, y: 3, hp: 58, atk: 10, def: 6, range: 1, move: 1 },
      { id: 'e_hard_marksman', name: '고지 저격수', x: 7, y: 0, hp: 32, atk: 14, def: 2, range: 4, move: 1 },
      { id: 'e_hard_drone', name: '전술 드론', x: 7, y: 5, hp: 30, atk: 9, def: 2, range: 3, move: 3 },
    ],
  },
  {
    id: 'm006',
    name: 'VeryHard 임무: 연구동 심부',
    chapter: 2,
    region: '연구동 심부',
    objective: '심부 제어실을 장악한 경비장을 쓰러뜨리고 연구동 자료를 회수하십시오.',
    caution: 'VeryHard 임무입니다. 보스 화력이 높고 빠른 클리어 턴 조건이 빡빡합니다.',
    difficulty: 'veryhard',
    recommendedPower: 320,
    creditMin: 62,
    creditMax: 88,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 4, qtyMax: 8, chance: 1 },
      { itemId: 'mat_wood', qtyMin: 3, qtyMax: 6, chance: 0.9 },
      { itemId: 'con_bandage', qtyMin: 2, qtyMax: 3, chance: 0.65 },
      { itemId: 'eq_knife', qtyMin: 1, qtyMax: 1, chance: 0.28 },
    ],
    enemies: [
      { id: 'e_vh_guard_a', name: '심부 경비병 A', x: 5, y: 1, hp: 54, atk: 13, def: 5, range: 1, move: 2 },
      { id: 'e_vh_guard_b', name: '심부 경비병 B', x: 5, y: 4, hp: 54, atk: 13, def: 5, range: 1, move: 2 },
      { id: 'e_vh_sniper', name: '심부 저격수', x: 7, y: 0, hp: 38, atk: 16, def: 2, range: 4, move: 1 },
      { id: 'e_vh_boss', name: '연구동 경비장', x: 7, y: 3, hp: 92, atk: 15, def: 7, range: 3, move: 2 },
    ],
  },
  {
    id: 'm007',
    name: 'Chapter 3: 해안 보급기지',
    chapter: 3,
    region: '해안 보급기지',
    objective: '해안 보급기지의 장거리 포대를 제압하고 보급 차단선을 확보하십시오.',
    caution: '장거리 포대와 기동 정찰조가 함께 등장합니다. 엄폐와 돌격 각을 동시에 관리해야 합니다.',
    difficulty: 'hard',
    recommendedPower: 390,
    creditMin: 76,
    creditMax: 104,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 5, qtyMax: 9, chance: 1 },
      { itemId: 'mat_wood', qtyMin: 4, qtyMax: 7, chance: 0.9 },
      { itemId: 'con_bandage', qtyMin: 2, qtyMax: 3, chance: 0.72 },
      { itemId: 'eq_knife', qtyMin: 1, qtyMax: 1, chance: 0.34 },
    ],
    enemies: [
      { id: 'e_c3_artillery', name: '해안 포대', x: 7, y: 1, hp: 64, atk: 17, def: 3, range: 5, move: 1 },
      { id: 'e_c3_runner_a', name: '기동 정찰조 A', x: 5, y: 0, hp: 42, atk: 12, def: 2, range: 2, move: 4 },
      { id: 'e_c3_runner_b', name: '기동 정찰조 B', x: 5, y: 5, hp: 42, atk: 12, def: 2, range: 2, move: 4 },
      { id: 'e_c3_guard', name: '보급기지 장갑병', x: 6, y: 3, hp: 70, atk: 12, def: 7, range: 1, move: 1 },
    ],
  },
  {
    id: 'm008',
    name: 'Chapter 3: 지휘 노드 탈환',
    chapter: 3,
    region: '지휘 노드',
    objective: '적 지휘 노드를 탈환하고 고화력 지휘 개체를 격파하십시오.',
    caution: '복합 패턴 보스전입니다. 저격수, 방패병, 보스 사격이 동시에 들어오므로 집중 화력이 필요합니다.',
    difficulty: 'veryhard',
    recommendedPower: 470,
    creditMin: 98,
    creditMax: 132,
    rewards: [
      { itemId: 'mat_stone', qtyMin: 6, qtyMax: 10, chance: 1 },
      { itemId: 'mat_wood', qtyMin: 5, qtyMax: 8, chance: 0.92 },
      { itemId: 'con_bandage', qtyMin: 2, qtyMax: 4, chance: 0.78 },
      { itemId: 'eq_knife', qtyMin: 1, qtyMax: 1, chance: 0.42 },
    ],
    enemies: [
      { id: 'e_c3_node_guard', name: '노드 방패병', x: 5, y: 2, hp: 78, atk: 13, def: 8, range: 1, move: 1 },
      { id: 'e_c3_node_sniper', name: '노드 저격수', x: 7, y: 0, hp: 46, atk: 18, def: 2, range: 5, move: 1 },
      { id: 'e_c3_node_drone', name: '교란 드론', x: 6, y: 5, hp: 48, atk: 11, def: 3, range: 3, move: 4 },
      { id: 'e_c3_commander', name: '지휘 노드 관리자', x: 7, y: 3, hp: 118, atk: 18, def: 7, range: 4, move: 2 },
    ],
  },
];

export const STUDENTS = [
  { id: 's_hoshino', name: '호시노', role: '탱커', x: 0, y: 2, hp: 54, atk: 10, def: 5, range: 1, move: 2 },
  { id: 's_yuuka', name: '유우카', role: '방어', x: 1, y: 3, hp: 46, atk: 8, def: 6, range: 1, move: 2 },
  { id: 's_mika', name: '미카', role: '돌격', x: 0, y: 1, hp: 42, atk: 14, def: 3, range: 1, move: 3 },
  { id: 's_noa', name: '노아', role: '지원', x: 1, y: 2, hp: 34, atk: 7, def: 2, range: 3, move: 2 },
];

export const MAX_FORMATION_SIZE = 4;
const DEFAULT_FORMATION_IDS = STUDENTS.slice(0, MAX_FORMATION_SIZE).map((student) => student.id);
const FORMATION_SPAWNS = [
  { x: 0, y: 2 },
  { x: 1, y: 3 },
  { x: 0, y: 1 },
  { x: 1, y: 2 },
];

const DIFFICULTY_RULES = {
  easy: { id: 'easy', label: 'Easy', hpMul: 1, atkMul: 1, rewardMul: 1, extraDropRolls: 0, targetTurn: 10 },
  normal: { id: 'normal', label: 'Normal', hpMul: 1, atkMul: 1, rewardMul: 1, extraDropRolls: 0, targetTurn: 11 },
  hard: { id: 'hard', label: 'Hard', hpMul: 1.15, atkMul: 1.1, rewardMul: 1.15, extraDropRolls: 1, targetTurn: 9 },
  veryhard: { id: 'veryhard', label: 'VeryHard', hpMul: 1.25, atkMul: 1.15, rewardMul: 1.3, extraDropRolls: 2, targetTurn: 8 },
};

export const STATUS_DEFS = {
  st_bleed: { id: 'st_bleed', name: '출혈', kind: 'DoT', tickDamage: 4, maxStacks: 1, merge: 'refresh' },
  st_burn: { id: 'st_burn', name: '화상', kind: 'DoT', tickDamage: 5, maxStacks: 2, merge: 'stackLimited' },
  st_stun: { id: 'st_stun', name: '기절', kind: 'Control', tickDamage: 0, maxStacks: 1, merge: 'extendOnly' },
  st_confuse: { id: 'st_confuse', name: '혼란', kind: 'Debuff', tickDamage: 0, maxStacks: 1, merge: 'refresh', accuracyMod: -0.2 },
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
  {
    id: 'sk_confuse_shot',
    name: '교란 사격',
    apCost: 2,
    target: 'enemy',
    rangeMin: 3,
    rangeMax: 7,
    damageMul: 1,
    statusId: 'st_confuse',
    statusChance: 0.8,
    duration: 2,
    accuracyAdd: 0.02,
    desc: '무기 피해를 주고 80% 확률로 혼란을 부여합니다. 혼란 대상은 명중률이 20% 감소합니다.',
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
    selectedStudentIds: DEFAULT_FORMATION_IDS,
    inventory: { mat_wood: 3, con_bandage: 1 },
    equipment: [],
    weaponUid: '',
    battleWins: 0,
    battleWinLog: [],
    completedMissionIds: [],
    missionResults: {},
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
    missionResults: value.missionResults && typeof value.missionResults === 'object' ? value.missionResults : {},
    completedQuestIds: Array.isArray(value.completedQuestIds) ? value.completedQuestIds : base.completedQuestIds,
    questClaims: value.questClaims && typeof value.questClaims === 'object' ? value.questClaims : questClaimsFromCompleted(value.completedQuestIds),
    properties: normalizeProperties(value.properties),
    edictState: normalizeEdictState(value.edictState),
    shopState: normalizeShopState(value.shopState, runId, day),
    selectedStudentIds: normalizeFormationIds(value.selectedStudentIds),
    battle: value.battle && typeof value.battle === 'object'
      ? normalizeBattle(value.battle, normalizeFormationIds(value.selectedStudentIds))
      : createBattle(value.selectedMissionId || 'm001', normalizeFormationIds(value.selectedStudentIds)),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

function normalizeFormationIds(value) {
  const seen = new Set();
  const ids = Array.isArray(value) ? value : DEFAULT_FORMATION_IDS;
  const cleaned = ids
    .filter((id) => STUDENTS.some((student) => student.id === id))
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, MAX_FORMATION_SIZE);
  return cleaned.length ? cleaned : DEFAULT_FORMATION_IDS;
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

function normalizeBattle(battle, formationIds = DEFAULT_FORMATION_IDS) {
  const mission = getMission(battle.missionId || 'm001');
  const unitIds = normalizeFormationIds(formationIds);
  const fallbackUnits = createUnits(unitIds);
  const restoredUnits = Array.isArray(battle.units)
    ? battle.units.map(normalizeCombatActor).filter((unit) => unitIds.includes(unit.id))
    : fallbackUnits;
  const units = restoredUnits.length ? restoredUnits : fallbackUnits;
  return {
    ...createBattle(mission.id),
    ...battle,
    units,
    enemies: Array.isArray(battle.enemies) ? battle.enemies.map(normalizeCombatActor) : createEnemies(mission),
    selectedUnitId: units.some((unit) => unit.id === battle.selectedUnitId) ? battle.selectedUnitId : units[0]?.id || '',
    targetEnemyId: battle.targetEnemyId || '',
  };
}

function createUnits(formationIds = DEFAULT_FORMATION_IDS) {
  const selectedIds = normalizeFormationIds(formationIds);
  return selectedIds.map((studentId, index) => {
    const student = STUDENTS.find((row) => row.id === studentId) || STUDENTS[0];
    const spawn = FORMATION_SPAWNS[index] || FORMATION_SPAWNS[0];
    return {
    ...student,
    x: spawn.x,
    y: spawn.y,
    maxHp: student.hp,
    ap: 2,
    acted: false,
    shield: null,
    statuses: [],
  };
  });
}

function difficultyRule(difficulty) {
  return DIFFICULTY_RULES[String(difficulty || '').toLowerCase()] || DIFFICULTY_RULES.normal;
}

export function difficultyLabel(difficulty) {
  return difficultyRule(difficulty).label;
}

function missionChapter(mission, index = MISSIONS.findIndex((item) => item.id === mission?.id)) {
  if (Number(mission?.chapter || 0) > 0) return Number(mission.chapter);
  return index < 4 ? 1 : 2;
}

function difficultyUnlockState(state) {
  const current = normalizeState(state);
  const completedSet = new Set(current.completedMissionIds || []);
  const chapterOneStars = MISSIONS.reduce((sum, mission, index) => {
    if (missionChapter(mission, index) !== 1) return sum;
    if (difficultyRule(mission.difficulty).id !== 'easy' && difficultyRule(mission.difficulty).id !== 'normal') return sum;
    return sum + Math.max(0, Math.min(3, Number(current.missionResults?.[mission.id]?.bestStars || 0)));
  }, 0);
  const hardUnlocked = chapterOneStars >= 9;
  const hardCleared = MISSIONS.some((mission) => difficultyRule(mission.difficulty).id === 'hard' && completedSet.has(mission.id));
  const veryHardUnlocked = hardCleared;
  return {
    easy: true,
    normal: true,
    hard: hardUnlocked,
    veryhard: veryHardUnlocked,
    chapterOneStars,
    hardUnlocked,
    veryHardUnlocked,
    hardCleared,
    hardStarsNeeded: Math.max(0, 9 - chapterOneStars),
    veryHardRequirementText: hardCleared ? '해금 완료' : 'Hard 임무 클리어 필요',
  };
}

function missionLockInfo(state, mission, index) {
  const current = normalizeState(state);
  const completedSet = new Set(current.completedMissionIds || []);
  const previousMission = MISSIONS[index - 1];
  if (previousMission && !completedSet.has(previousMission.id)) {
    return { locked: true, reason: `${previousMission.name} 클리어 필요` };
  }
  const unlocks = difficultyUnlockState(current);
  const difficultyId = difficultyRule(mission.difficulty).id;
  if (!unlocks[difficultyId]) {
    if (difficultyId === 'hard') return { locked: true, reason: `Hard 해금까지 챕터1 별 ${unlocks.hardStarsNeeded}개 필요` };
    if (difficultyId === 'veryhard') return { locked: true, reason: unlocks.veryHardRequirementText };
    return { locked: true, reason: `${difficultyLabel(mission.difficulty)} 난이도 잠김` };
  }
  return { locked: false, reason: '' };
}

function createEnemies(mission) {
  const rule = difficultyRule(mission.difficulty);
  return mission.enemies.map((enemy) => ({
    ...enemy,
    hp: Math.max(1, Math.round(Number(enemy.hp || 1) * Number(rule.hpMul || 1))),
    atk: Math.max(1, Math.round(Number(enemy.atk || 1) * Number(rule.atkMul || 1))),
    maxHp: Math.max(1, Math.round(Number(enemy.hp || 1) * Number(rule.hpMul || 1))),
    ap: 2,
    shield: null,
    statuses: [],
    difficulty: rule.id,
  }));
}

function createBattle(missionId, formationIds = DEFAULT_FORMATION_IDS) {
  const mission = getMission(missionId);
  const units = createUnits(formationIds);
  return {
    missionId: mission.id,
    turn: 1,
    phase: 'player',
    selectedUnitId: units[0]?.id || '',
    targetEnemyId: '',
    units,
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

function statusAccuracyMod(actor) {
  return (actor?.statuses || []).reduce((sum, status) => {
    const def = STATUS_DEFS[status?.id];
    if (!def || Number(status.duration || 0) <= 0) return sum;
    return sum + Number(def.accuracyMod || 0);
  }, 0);
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
  const nextDuration = Math.max(1, safeWholeNumber(duration, 1));
  const existing = statuses.find((status) => status.id === statusId);
  if (!existing) {
    return {
      ...actor,
      statuses: [...statuses, { id: statusId, duration: nextDuration, stacks: 1 }],
    };
  }
  return {
    ...actor,
    statuses: statuses.map((status) => {
      if (status.id !== statusId) return status;
      const maxStacks = def.maxStacks || 1;
      const stackGain = def.merge === 'stackLimited' ? 1 : 0;
      return {
        ...status,
        duration: Math.max(Number(status.duration || 1), nextDuration),
        stacks: Math.min(maxStacks, Math.max(1, Number(status.stacks || 1) + stackGain)),
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

function allAliveUnitsDone(battle) {
  return aliveUnits(battle).every((row) => row.acted || Number(row.ap || 0) <= 0);
}

function finishPlayerAction(state, battle, message) {
  const resolved = applyBattleOutcome(addLog(state, message), battle);
  if (resolved.battle?.phase !== 'player') return resolved;
  return allAliveUnitsDone(resolved.battle) ? endTurnAction(resolved) : resolved;
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
  const rule = difficultyRule(mission.difficulty);
  const passes = 1 + Math.max(0, Number(rule.extraDropRolls || 0));
  for (let pass = 0; pass < passes; pass += 1) {
    mission.rewards.forEach((reward) => {
      const chanceMul = pass === 0 ? 1 : 0.45;
      if (rng() > Number(reward.chance || 0) * chanceMul) return;
      const min = Number(reward.qtyMin || 0);
      const max = Math.max(min, Number(reward.qtyMax || min));
      const qty = min + Math.floor(rng() * (max - min + 1));
      inventory = addItem(inventory, reward.itemId, qty);
      gained.push(`${itemName(reward.itemId)} ${qty}${pass > 0 ? ' 추가' : ''}`);
    });
  }
  return { inventory, gained };
}

function missionStarTargetTurn(mission) {
  return difficultyRule(mission.difficulty).targetTurn;
}

function missionStarResult(mission, battle) {
  if (!battle || battle.phase !== 'cleared') return { stars: 0, allSurvived: false, fastClear: false, targetTurn: missionStarTargetTurn(mission) };
  const units = Array.isArray(battle.units) ? battle.units : [];
  const living = units.filter((unit) => Number(unit.hp || 0) > 0);
  const allSurvived = Boolean(units.length) && living.length === units.length;
  const targetTurn = missionStarTargetTurn(mission);
  const fastClear = Number(battle.turn || 0) <= targetTurn;
  return {
    stars: 1 + (allSurvived ? 1 : 0) + (fastClear ? 1 : 0),
    allSurvived,
    fastClear,
    targetTurn,
  };
}

function grantMissionReward(state, battle) {
  const mission = getMission(battle.missionId);
  const rng = createRng(`${state.runId}|reward|${mission.id}|${state.battleWins}`);
  const rule = difficultyRule(mission.difficulty);
  const baseCredit = mission.creditMin + Math.floor(rng() * (mission.creditMax - mission.creditMin + 1));
  const credit = Math.round(baseCredit * Number(rule.rewardMul || 1));
  const rewards = rollMissionRewards(state, mission, rng);
  const completedSet = new Set(state.completedMissionIds);
  completedSet.add(mission.id);
  const starResult = missionStarResult(mission, battle);
  const previousResult = state.missionResults?.[mission.id] || {};
  const bestTurn = Number(previousResult.bestTurn || 0);
  const nextMissionResults = {
    ...(state.missionResults || {}),
    [mission.id]: {
      missionId: mission.id,
      clears: Number(previousResult.clears || 0) + 1,
      bestStars: Math.max(Number(previousResult.bestStars || 0), starResult.stars),
      bestTurn: bestTurn ? Math.min(bestTurn, Number(battle.turn || bestTurn)) : Number(battle.turn || 0),
      allSurvived: Boolean(previousResult.allSurvived) || starResult.allSurvived,
      fastClear: Boolean(previousResult.fastClear) || starResult.fastClear,
      targetTurn: starResult.targetTurn,
      lastClearedAtDay: Number(state.day || 1),
    },
  };
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
    missionResults: nextMissionResults,
    battle,
  };
  const rewardText = rewards.gained.length ? `, ${rewards.gained.join(', ')}` : '';
  return addLog(next, `${mission.name} 클리어. ★${starResult.stars}/3, +${credit} Cr${rewardText}`);
}

export function startMissionAction(state, missionId) {
  const current = normalizeState(state);
  const mission = getMission(missionId);
  const index = MISSIONS.findIndex((item) => item.id === mission.id);
  const lockInfo = missionLockInfo(current, mission, index);
  if (lockInfo.locked) return addLog(current, `${mission.name} 출정 불가. ${lockInfo.reason}.`);
  const formationIds = normalizeFormationIds(current.selectedStudentIds);
  if (!formationIds.length) return addLog(current, '출전 편성에 학생이 없습니다.');
  return addLog({
    ...current,
    selectedMissionId: mission.id,
    selectedStudentIds: formationIds,
    battle: createBattle(mission.id, formationIds),
  }, `${mission.name} 출정을 시작했습니다.`);
}

export function setFormationAction(state, studentId, selected) {
  const current = normalizeState(state);
  if (!STUDENTS.some((student) => student.id === studentId)) return current;
  const currentIds = normalizeFormationIds(current.selectedStudentIds);
  const shouldSelect = selected !== false;
  if (shouldSelect && currentIds.includes(studentId)) return current;
  if (shouldSelect && currentIds.length >= MAX_FORMATION_SIZE) return addLog(current, `출전 편성은 최대 ${MAX_FORMATION_SIZE}명입니다.`);
  const nextIds = shouldSelect
    ? [...currentIds, studentId]
    : currentIds.filter((id) => id !== studentId);
  if (!nextIds.length) return addLog(current, '최소 1명은 편성해야 합니다.');
  return addLog({
    ...current,
    selectedStudentIds: nextIds,
  }, `편성 변경: ${nextIds.map((id) => STUDENTS.find((student) => student.id === id)?.name || id).join(', ')}`);
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
  if (unit.acted) return addLog(current, `${unit.name}은(는) 이미 행동을 마쳤습니다.`);
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
  if (unit.acted) return addLog(current, `${unit.name}은(는) 이미 행동을 마쳤습니다.`);
  if (Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}의 AP가 부족합니다.`);
  if (distance(unit, enemy) > Number(unit.range || 1)) return addLog(current, `${enemy.name}이(가) 사거리 밖입니다.`);
  const bonus = weaponBonus(current);
  const rng = createRng(`${current.runId}|atk|${battle.turn}|${unit.id}|${enemy.id}|${unit.ap}|${enemy.hp}`);
  const hit = rng() < clamp(0.78 + bonus.acc / 100 + statusAccuracyMod(unit) - tileDefense(enemy.x, enemy.y) * 0.04, 0.35, 0.97);
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
  return finishPlayerAction(current, nextBattle, nextBattle.lastResult);
}

export function executeSkillAction(state, skillId) {
  const current = normalizeState(state);
  const battle = current.battle;
  if (battle.phase !== 'player') return addLog(current, '플레이어 턴이 아닙니다.');
  const skill = TACTICAL_SKILLS.find((row) => row.id === skillId) || TACTICAL_SKILLS[0];
  const unit = selectedUnit(battle);
  if (!unit || unit.hp <= 0) return addLog(current, '스킬을 사용할 학생이 없습니다.');
  if (unit.acted) return addLog(current, `${unit.name}은(는) 이미 행동을 마쳤습니다.`);
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
    return finishPlayerAction(current, {
      ...battle,
      units: nextUnits,
      lastResult: resultText,
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
  const hitChance = clamp(0.78 + Number(skill.accuracyAdd || 0) + bonus.acc / 100 + statusAccuracyMod(unit) - tileDefense(enemy.x, enemy.y) * 0.04, 0.3, 0.97);
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
  return finishPlayerAction(current, nextBattle, resultText);
}

export function consumeBandageAction(state) {
  const current = normalizeState(state);
  const battle = current.battle;
  const unit = selectedUnit(battle);
  if (!unit) return current;
  if (Number(current.inventory.con_bandage || 0) <= 0) return addLog(current, '붕대가 없습니다.');
  if (unit.acted) return addLog(current, `${unit.name}은(는) 이미 행동을 마쳤습니다.`);
  if (Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}의 AP가 부족합니다.`);
  const heal = 16;
  const nextBattle = {
    ...battle,
    units: battle.units.map((row) => (
      row.id === unit.id
        ? { ...row, hp: Math.min(row.maxHp, Number(row.hp || 0) + heal), ap: 0, acted: true }
        : row
    )),
    lastResult: `${unit.name} 붕대 사용`,
  };
  const next = addLog({
    ...current,
    inventory: addItem(current.inventory, 'con_bandage', -1),
    battle: nextBattle,
  }, `${unit.name} HP +${heal}`);

  return allAliveUnitsDone(nextBattle) ? endTurnAction(next) : next;
}

export function waitSelectedUnitAction(state) {
  const current = normalizeState(state);
  const battle = current.battle;
  if (battle.phase !== 'player') return addLog(current, '플레이어 턴이 아닙니다.');
  const unit = selectedUnit(battle);
  if (!unit || unit.hp <= 0) return addLog(current, '대기할 학생이 없습니다.');
  if (unit.acted || Number(unit.ap || 0) <= 0) return addLog(current, `${unit.name}은(는) 이미 행동을 마쳤습니다.`);

  const nextBattle = {
    ...battle,
    units: battle.units.map((row) => (
      row.id === unit.id ? { ...row, ap: 0, acted: true } : row
    )),
    lastResult: `${unit.name} 대기`,
  };
  const next = addLog({
    ...current,
    battle: nextBattle,
  }, nextBattle.lastResult);

  return allAliveUnitsDone(nextBattle) ? endTurnAction(next) : next;
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

    const rng = createRng(`${state.runId}|enemy|${battle.turn}|${actor.id}|${target.id}|${actor.hp}|${target.hp}`);
    const hitChance = clamp(0.78 + statusAccuracyMod(actor) - tileDefense(target.x, target.y) * 0.04, 0.25, 0.95);
    const hit = rng() < hitChance;
    const confusionText = hasStatus(actor, 'st_confuse') ? ' (혼란)' : '';
    if (!hit) {
      messages.push(aiRuleLog(AI_RULES.attackIfInRange, `${actor.name} -> ${target.name} 공격 빗나감${confusionText}`));
      return;
    }
    const damage = Math.max(1, Number(actor.atk || 0) - Number(target.def || 0) - tileDefense(target.x, target.y));
    const damageResult = absorbDamage(target, damage);
    units = units.map((unit) => (
      unit.id === target.id ? damageResult.actor : unit
    ));
    messages.push(aiRuleLog(AI_RULES.attackIfInRange, `${actor.name} -> ${target.name} ${damage} 피해${coverDamageNote(target)}${confusionText}${damageResult.absorbed ? ` (보호막 ${damageResult.absorbed})` : ''}`));
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

export function formationRows(state) {
  const current = normalizeState(state);
  const selectedIds = normalizeFormationIds(current.selectedStudentIds);
  return STUDENTS.map((student) => ({
    ...student,
    selected: selectedIds.includes(student.id),
    order: selectedIds.indexOf(student.id) + 1,
    power: Number(student.hp || 0) + Number(student.atk || 0) * 4 + Number(student.def || 0) * 3 + Number(student.range || 0) * 5 + Number(student.move || 0) * 4,
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

function attackPreview(attacker, defender, accuracyBonus = 0, attackBonus = 0) {
  if (!attacker || !defender) {
    return {
      hitChancePct: 0,
      rawDamage: 0,
      hpDamage: 0,
      shieldAbsorb: 0,
      lethal: false,
      inCover: false,
    };
  }
  const hitChance = clamp(
    0.78
      + Number(accuracyBonus || 0)
      + statusAccuracyMod(attacker)
      - tileDefense(defender.x, defender.y) * 0.04,
    0.25,
    0.97,
  );
  const rawDamage = Math.max(
    1,
    Number(attacker.atk || 0)
      + Number(attackBonus || 0)
      - Number(defender.def || 0)
      - tileDefense(defender.x, defender.y),
  );
  const shieldAbsorb = Math.min(Number(defender.shield?.amount || 0), rawDamage);
  const hpDamage = Math.max(0, rawDamage - shieldAbsorb);
  return {
    hitChancePct: Math.round(hitChance * 100),
    rawDamage,
    hpDamage,
    expectedHpDamage: Math.round(hpDamage * hitChance),
    shieldAbsorb,
    lethal: hpDamage >= Number(defender.hp || 0),
    inCover: tileDefense(defender.x, defender.y) > 0,
  };
}

function forecastEnemyAction(enemy, battle) {
  const alive = aliveUnits(battle);
  if (!alive.length || Number(enemy?.hp || 0) <= 0) return null;
  if (hasStatus(enemy, 'st_stun')) {
    return {
      enemyId: enemy.id,
      enemyName: enemy.name,
      rule: AI_RULES.wait,
      targetId: '',
      targetName: '없음',
      detail: '기절 상태라 다음 적 턴 행동하지 못합니다.',
      moveText: '대기',
      hitChancePct: 0,
      hpDamage: 0,
      expectedHpDamage: 0,
      lethal: false,
      priority: 'low',
    };
  }

  let actor = { ...enemy };
  const enemies = battle.enemies.map((row) => ({ ...row }));
  const units = battle.units.map((row) => ({ ...row }));
  let target = [...alive].sort((a, b) => distance(actor, a) - distance(actor, b))[0];
  const lowHp = Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || actor.hp || 1)) <= AI_COVER_HP_RATIO;
  const cover = lowHp ? coverStep(actor, target, { ...battle, units, enemies }) : null;
  let usedCoverMove = false;
  let rule = AI_RULES.attackIfInRange;
  let moveText = '제자리';
  if (cover) {
    actor = { ...actor, x: cover.x, y: cover.y };
    usedCoverMove = true;
    rule = AI_RULES.takeCover;
    moveText = `엄폐 (${actor.x + 1},${actor.y + 1})`;
  }

  target = units.filter((unit) => unit.hp > 0).sort((a, b) => distance(actor, a) - distance(actor, b))[0];
  if (!target) return null;
  const range = Number(actor.range || 1);
  let targetDistance = distance(actor, target);
  if (targetDistance > range) {
    if (usedCoverMove) {
      return {
        enemyId: enemy.id,
        enemyName: enemy.name,
        rule,
        targetId: target.id,
        targetName: target.name,
        detail: `${target.name}까지 거리 ${targetDistance}. 엄폐 이동 후 공격하지 못합니다.`,
        moveText,
        hitChancePct: 0,
        hpDamage: 0,
        expectedHpDamage: 0,
        lethal: false,
        priority: 'low',
      };
    }
    const pos = stepToward(actor, target, { ...battle, units, enemies });
    const moved = pos.x !== actor.x || pos.y !== actor.y;
    if (!moved) {
      return {
        enemyId: enemy.id,
        enemyName: enemy.name,
        rule: AI_RULES.wait,
        targetId: target.id,
        targetName: target.name,
        detail: '접근 경로가 막혀 이동하지 못합니다.',
        moveText: '이동 불가',
        hitChancePct: 0,
        hpDamage: 0,
        expectedHpDamage: 0,
        lethal: false,
        priority: 'low',
      };
    }
    actor = { ...actor, x: pos.x, y: pos.y };
    targetDistance = distance(actor, target);
    rule = targetDistance <= range ? AI_RULES.moveToAttack : AI_RULES.moveToward;
    moveText = `이동 (${actor.x + 1},${actor.y + 1})`;
    if (targetDistance > range) {
      return {
        enemyId: enemy.id,
        enemyName: enemy.name,
        rule,
        targetId: target.id,
        targetName: target.name,
        detail: `${target.name}에게 접근하지만 아직 사거리 밖입니다. 거리 ${targetDistance}/${range}`,
        moveText,
        hitChancePct: 0,
        hpDamage: 0,
        expectedHpDamage: 0,
        lethal: false,
        priority: 'low',
      };
    }
  }

  const preview = attackPreview(actor, target, 0, 0);
  const priority = preview.lethal || preview.expectedHpDamage >= Math.ceil(Number(target.hp || 1) * 0.45)
    ? 'high'
    : preview.expectedHpDamage > 0
      ? 'normal'
      : 'low';
  return {
    enemyId: enemy.id,
    enemyName: enemy.name,
    rule,
    targetId: target.id,
    targetName: target.name,
    targetHp: Number(target.hp || 0),
    distance: targetDistance,
    range,
    detail: `${target.name}에게 ${preview.rawDamage} 피해 시도 · 명중 ${preview.hitChancePct}%${preview.inCover ? ' · 대상 엄폐' : ''}`,
    moveText,
    hitChancePct: preview.hitChancePct,
    hpDamage: preview.hpDamage,
    expectedHpDamage: preview.expectedHpDamage,
    shieldAbsorb: preview.shieldAbsorb,
    lethal: preview.lethal,
    priority,
  };
}

export function getBattleForecast(state) {
  const current = normalizeState(state);
  const battle = normalizeBattle(current.battle, current.selectedStudentIds);
  const units = aliveUnits(battle);
  const enemies = aliveEnemies(battle);
  const enemyPlans = enemies
    .map((enemy) => forecastEnemyAction(enemy, battle))
    .filter(Boolean);
  const threatByUnit = new Map(units.map((unit) => [unit.id, {
    unitId: unit.id,
    unitName: unit.name,
    hp: Number(unit.hp || 0),
    maxHp: Number(unit.maxHp || unit.hp || 0),
    incomingExpected: 0,
    maxHit: 0,
    attackers: [],
    lethal: false,
    inCover: tileDefense(unit.x, unit.y) > 0,
  }]));

  enemyPlans.forEach((plan) => {
    const target = threatByUnit.get(plan.targetId);
    if (!target) return;
    target.incomingExpected += Number(plan.expectedHpDamage || 0);
    target.maxHit = Math.max(target.maxHit, Number(plan.hpDamage || 0));
    if (plan.hpDamage > 0) target.attackers.push(plan.enemyName);
    if (plan.lethal) target.lethal = true;
  });

  const unitThreats = [...threatByUnit.values()].map((row) => {
    const hpRatioAfter = row.hp <= 0 ? 0 : Math.max(0, Math.round(((row.hp - row.incomingExpected) / Math.max(1, row.maxHp)) * 100));
    const riskScore = Math.round(clamp(
      (row.incomingExpected / Math.max(1, row.hp)) * 100
        + (row.lethal ? 45 : 0)
        + (row.inCover ? -10 : 0),
      0,
      160,
    ));
    return {
      ...row,
      incomingExpected: Math.round(row.incomingExpected),
      hpRatioAfter,
      riskScore,
      riskLabel: row.lethal ? '격파 위험' : riskScore >= 70 ? '고위험' : riskScore >= 35 ? '주의' : '안정',
      attackersText: row.attackers.length ? row.attackers.join(', ') : '없음',
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const selected = selectedUnit(battle);
  const bonus = weaponBonus(current);
  const selectedAttacks = enemies.map((enemy) => {
    const targetDistance = selected && enemy ? distance(selected, enemy) : 0;
    const inRange = selected && enemy && targetDistance <= Number(selected.range || 1);
    const preview = inRange ? attackPreview(selected, enemy, bonus.acc / 100, bonus.atk) : attackPreview(null, null);
    return {
      enemyId: enemy.id,
      enemyName: enemy.name,
      distance: targetDistance,
      inRange,
      hitChancePct: preview.hitChancePct,
      hpDamage: preview.hpDamage,
      expectedHpDamage: preview.expectedHpDamage,
      lethal: preview.lethal,
      coverText: tileDefense(enemy.x, enemy.y) ? '엄폐 중' : '노출',
    };
  }).sort((a, b) => {
    if (a.lethal !== b.lethal) return a.lethal ? -1 : 1;
    if (a.inRange !== b.inRange) return a.inRange ? -1 : 1;
    return b.expectedHpDamage - a.expectedHpDamage;
  });

  const topThreat = unitThreats[0] || null;
  const highThreatCount = unitThreats.filter((row) => row.riskScore >= 70).length;
  const incomingTotal = unitThreats.reduce((sum, row) => sum + row.incomingExpected, 0);
  const exposedUnits = unitThreats.filter((row) => !row.inCover && row.attackers.length).length;
  const recommendations = [];
  if (topThreat?.riskScore >= 70) recommendations.push(`${topThreat.unitName} 보호: 엄폐 이동, 방어 태세, 붕대 사용을 우선하세요.`);
  if (selectedAttacks[0]?.lethal) recommendations.push(`${selected?.name || '선택 유닛'}으로 ${selectedAttacks[0].enemyName} 마무리가 가능합니다.`);
  if (enemyPlans.some((plan) => plan.rule === AI_RULES.takeCover)) recommendations.push('저체력 적이 엄폐를 잡으려 합니다. 추격보다 사거리 확보가 먼저입니다.');
  if (!recommendations.length && incomingTotal > 0) recommendations.push('즉시 격파 위험은 낮습니다. 사거리 안의 적부터 줄이면 됩니다.');
  if (!recommendations.length) recommendations.push('다음 적 턴 피해가 거의 없습니다. 자동 1턴을 사용해도 무난합니다.');

  const threatLevel = highThreatCount
    ? '위험'
    : incomingTotal >= 20 || exposedUnits >= 2
      ? '주의'
      : '안정';
  return {
    threatLevel,
    headline: `${threatLevel} · 예상 피해 ${incomingTotal} · 고위험 ${highThreatCount}명`,
    incomingTotal,
    highThreatCount,
    exposedUnits,
    selectedUnitName: selected?.name || '',
    bestAttack: selectedAttacks[0] || null,
    enemyPlans: enemyPlans.sort((a, b) => {
      const rank = { high: 0, normal: 1, low: 2 };
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || b.expectedHpDamage - a.expectedHpDamage;
    }),
    unitThreats,
    selectedAttacks,
    recommendations: recommendations.slice(0, 4),
  };
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
  const campaign = getCampaignReport(current);
  const expansion = getCampaignExpansionReport(current);
  const operation = getOperationBriefing(current);
  const forecast = getBattleForecast(current);
  const presentation = getBattlePresentationReport(current);
  return {
    day: current.day,
    mission: getMission(current.selectedMissionId).name,
    formation: normalizeFormationIds(current.selectedStudentIds).length,
    battleWins: current.battleWins,
    credit: current.credit,
    guildRep: current.guildRep,
    guildRank: rank.rank,
    campaignStars: `${campaign.starTotal}/${campaign.starMax}`,
    hardUnlocked: campaign.hardUnlocked,
    veryHardUnlocked: campaign.veryHardUnlocked,
    campaignExpansion: {
      headline: expansion.headline,
      readinessPct: expansion.readinessPct,
      chapterCount: expansion.chapterRows.length,
      enemyPatternCount: expansion.enemyPatterns.length,
      riskCount: expansion.balanceRows.filter((row) => row.tone === 'warn').length,
    },
    quests: Object.keys(current.questClaims || {}).length,
    properties: town.activeProperties,
    edict: town.activeEdictName,
    operationBriefing: {
      headline: operation.headline,
      readinessPct: operation.readinessPct,
      nextAction: operation.nextAction,
      bestMissionId: operation.bestMissionId,
    },
    battleForecast: {
      headline: forecast.headline,
      threatLevel: forecast.threatLevel,
      incomingTotal: forecast.incomingTotal,
      highThreatCount: forecast.highThreatCount,
      bestAttack: forecast.bestAttack ? `${forecast.selectedUnitName} -> ${forecast.bestAttack.enemyName}` : '',
    },
    battlePresentation: {
      headline: presentation.headline,
      completionPct: presentation.completionPct,
      cutInTone: presentation.cutInTone,
      latestCue: presentation.latestCue.title,
      readyRows: presentation.presentationRows.filter((row) => row.ready).length,
      totalRows: presentation.presentationRows.length,
    },
    score: scoreState(current),
  };
}

export function getCampaignReport(state) {
  const current = normalizeState(state);
  const power = battlePower(current);
  const completedSet = new Set(current.completedMissionIds || []);
  const difficultyState = difficultyUnlockState(current);
  const missionRows = MISSIONS.map((mission, index) => {
    const result = current.missionResults?.[mission.id] || {};
    const cleared = completedSet.has(mission.id) || Number(result.clears || 0) > 0;
    const bestStars = Math.max(0, Math.min(3, Number(result.bestStars || 0)));
    const lockInfo = missionLockInfo(current, mission, index);
    const powerGap = power - Number(mission.recommendedPower || 0);
    return {
      ...mission,
      chapter: missionChapter(mission, index),
      order: index + 1,
      cleared,
      locked: lockInfo.locked,
      lockReason: lockInfo.reason,
      recommended: !cleared && !lockInfo.locked,
      bestStars,
      bestTurn: Number(result.bestTurn || 0),
      targetTurn: Number(result.targetTurn || missionStarTargetTurn(mission)),
      allSurvived: Boolean(result.allSurvived),
      fastClear: Boolean(result.fastClear),
      powerGap,
      difficultyLabel: difficultyLabel(mission.difficulty),
      statusLabel: cleared ? `★${bestStars}/3` : lockInfo.locked ? '잠김' : powerGap >= 0 ? '추천' : '전력 부족',
    };
  });
  const clearedCount = missionRows.filter((row) => row.cleared).length;
  const starTotal = missionRows.reduce((sum, row) => sum + row.bestStars, 0);
  const starMax = missionRows.length * 3;
  const nextMission = missionRows.find((row) => row.recommended) || missionRows.find((row) => !row.cleared && !row.locked) || missionRows[0];
  const hardUnlocked = difficultyState.hardUnlocked;
  const veryHardUnlocked = difficultyState.veryHardUnlocked;
  const recommendations = [];
  if (nextMission && !nextMission.cleared) {
    recommendations.push(`${nextMission.name} 진행`);
    if (nextMission.powerGap < 0) recommendations.push(`권장 전투력까지 ${Math.abs(nextMission.powerGap)} 보강`);
  }
  if (Number(current.inventory.con_bandage || 0) <= 0) recommendations.push('상점/의뢰로 붕대 확보');
  if (missionRows.some((row) => row.cleared && row.bestStars < 3)) recommendations.push('클리어 임무 3성 재도전');
  if (!hardUnlocked) recommendations.push(`Hard 해금까지 챕터1 별 ${difficultyState.hardStarsNeeded}개`);
  else if (!veryHardUnlocked) recommendations.push('VeryHard 해금까지 Hard 임무 클리어');
  if (!recommendations.length) recommendations.push('다음 챕터 데이터 확장 대기');

  return {
    clearedCount,
    totalMissions: missionRows.length,
    starTotal,
    starMax,
    progressPct: missionRows.length ? Math.round((clearedCount / missionRows.length) * 100) : 0,
    hardUnlocked,
    veryHardUnlocked,
    chapterOneStars: difficultyState.chapterOneStars,
    hardStarsNeeded: difficultyState.hardStarsNeeded,
    veryHardRequirementText: difficultyState.veryHardRequirementText,
    nextMissionId: nextMission?.id || '',
    nextMissionName: nextMission?.name || '-',
    headline: `${clearedCount}/${missionRows.length}개 임무 클리어, 별 ${starTotal}/${starMax}. ${hardUnlocked ? (veryHardUnlocked ? 'VeryHard 해금 조건을 충족했습니다.' : 'Hard 해금 조건을 충족했습니다.') : '별을 모아 Hard 해금을 노리세요.'}`,
    recommendations: [...new Set(recommendations)].slice(0, 4),
    missionRows,
  };
}

function enemyPatternLabel(enemy) {
  if (Number(enemy.hp || 0) >= 90) return '보스';
  if (Number(enemy.range || 0) >= 5) return '초장거리';
  if (Number(enemy.range || 0) >= 4) return '저격';
  if (Number(enemy.def || 0) >= 7) return '장갑';
  if (Number(enemy.move || 0) >= 4) return '기동';
  if (Number(enemy.range || 0) >= 3) return '사격';
  return '강습';
}

export function getCampaignExpansionReport(state) {
  const current = normalizeState(state);
  const campaign = getCampaignReport(current);
  const power = battlePower(current);
  const chapterMap = new Map();
  campaign.missionRows.forEach((mission) => {
    const key = Number(mission.chapter || 1);
    const row = chapterMap.get(key) || {
      chapter: key,
      missions: [],
      cleared: 0,
      stars: 0,
      starMax: 0,
      locked: 0,
      recommendedPowerMax: 0,
    };
    row.missions.push(mission);
    row.cleared += mission.cleared ? 1 : 0;
    row.stars += Number(mission.bestStars || 0);
    row.starMax += 3;
    row.locked += mission.locked ? 1 : 0;
    row.recommendedPowerMax = Math.max(row.recommendedPowerMax, Number(mission.recommendedPower || 0));
    chapterMap.set(key, row);
  });

  const chapterRows = [...chapterMap.values()].sort((a, b) => a.chapter - b.chapter).map((row) => {
    const progressPct = row.missions.length ? Math.round((row.cleared / row.missions.length) * 100) : 0;
    const starPct = row.starMax ? Math.round((row.stars / row.starMax) * 100) : 0;
    const nextMission = row.missions.find((mission) => !mission.cleared && !mission.locked)
      || row.missions.find((mission) => !mission.cleared)
      || row.missions[row.missions.length - 1];
    return {
      ...row,
      progressPct,
      starPct,
      nextMissionName: nextMission?.name || '-',
      status: progressPct >= 100 ? '완료' : row.locked >= row.missions.length ? '잠김' : progressPct > 0 ? '진행' : '대기',
      powerGap: power - row.recommendedPowerMax,
      difficultyText: [...new Set(row.missions.map((mission) => mission.difficultyLabel))].join(' / '),
    };
  });

  const patternMap = new Map();
  MISSIONS.forEach((mission, index) => {
    const chapter = missionChapter(mission, index);
    (mission.enemies || []).forEach((enemy) => {
      const label = enemyPatternLabel(enemy);
      const row = patternMap.get(label) || {
        label,
        count: 0,
        chapters: new Set(),
        examples: [],
        maxRange: 0,
        maxMove: 0,
        maxDef: 0,
      };
      row.count += 1;
      row.chapters.add(chapter);
      row.maxRange = Math.max(row.maxRange, Number(enemy.range || 0));
      row.maxMove = Math.max(row.maxMove, Number(enemy.move || 0));
      row.maxDef = Math.max(row.maxDef, Number(enemy.def || 0));
      if (row.examples.length < 3) row.examples.push(enemy.name);
      patternMap.set(label, row);
    });
  });
  const enemyPatterns = [...patternMap.values()]
    .map((row) => ({
      ...row,
      chapters: [...row.chapters].sort((a, b) => a - b),
      chapterText: [...row.chapters].sort((a, b) => a - b).map((chapter) => `CH.${chapter}`).join(', '),
      examplesText: row.examples.join(', '),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko-KR'));

  const difficultyCounts = campaign.missionRows.reduce((acc, mission) => {
    const key = mission.difficultyLabel;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  const chapterThree = chapterRows.find((row) => row.chapter === 3);
  const nextChapter = chapterRows.find((row) => row.progressPct < 100) || chapterRows[chapterRows.length - 1];
  const patternCoveragePct = Math.min(100, Math.round((enemyPatterns.length / 6) * 100));
  const chapterCoveragePct = Math.min(100, Math.round((chapterRows.length / 3) * 100));
  const readinessPct = Math.round(clamp(
    campaign.progressPct * 0.26
      + (campaign.starMax ? (campaign.starTotal / campaign.starMax) * 100 : 0) * 0.22
      + chapterCoveragePct * 0.18
      + patternCoveragePct * 0.18
      + Math.min(100, power / Math.max(1, Number(nextChapter?.recommendedPowerMax || 1)) * 100) * 0.16,
    0,
    100,
  ));

  const balanceRows = [
    {
      id: 'chapter-coverage',
      label: '챕터 커버리지',
      value: `${chapterRows.length}개 챕터`,
      detail: `현재 최고 챕터는 CH.${Math.max(...chapterRows.map((row) => row.chapter))}이며 CH.3 임무 ${chapterThree?.missions.length || 0}개가 포함됩니다.`,
      tone: chapterRows.length >= 3 ? 'good' : 'warn',
    },
    {
      id: 'difficulty-ladder',
      label: '난이도 사다리',
      value: Object.entries(difficultyCounts).map(([key, count]) => `${key} ${count}`).join(' / '),
      detail: `Easy/Normal에서 Hard/VeryHard까지 순차 해금됩니다.`,
      tone: campaign.hardUnlocked || campaign.veryHardUnlocked ? 'good' : 'normal',
    },
    {
      id: 'enemy-patterns',
      label: '적 패턴 다양성',
      value: `${enemyPatterns.length}종`,
      detail: enemyPatterns.slice(0, 4).map((row) => `${row.label} ${row.count}`).join(' / '),
      tone: enemyPatterns.length >= 6 ? 'good' : 'warn',
    },
    {
      id: 'power-curve',
      label: '전투력 곡선',
      value: `${power.toLocaleString('ko-KR')} / ${nextChapter?.recommendedPowerMax || 0}`,
      detail: nextChapter?.powerGap >= 0 ? `${nextChapter.status} 구간 권장 전투력을 충족합니다.` : `CH.${nextChapter?.chapter || 1} 최고 권장 전투력까지 ${Math.abs(nextChapter?.powerGap || 0)} 보강이 필요합니다.`,
      tone: (nextChapter?.powerGap || 0) >= 0 ? 'good' : 'warn',
    },
  ];
  const recommendations = [];
  if (chapterThree && chapterThree.progressPct < 100) recommendations.push(`CH.3 ${chapterThree.nextMissionName} 진행`);
  if (balanceRows.some((row) => row.id === 'power-curve' && row.tone === 'warn')) recommendations.push('장비 제작/상점/의뢰로 전투력 보강');
  if (campaign.missionRows.some((row) => row.cleared && row.bestStars < 3)) recommendations.push('기존 임무 3성 보강으로 별 총량 확보');
  if (!campaign.veryHardUnlocked) recommendations.push('VeryHard 해금 조건 확보');
  if (!recommendations.length) recommendations.push('CH.3 파밍과 전투 예측 기반 최적 턴 단축');

  return {
    headline: `${chapterRows.length}개 챕터 · 적 패턴 ${enemyPatterns.length}종 · 확장 준비도 ${readinessPct}%`,
    readinessPct,
    chapterRows,
    enemyPatterns,
    balanceRows,
    recommendations: [...new Set(recommendations)].slice(0, 4),
  };
}

function latestPresentationCue(current, battle) {
  const latestLine = String(battle.lastResult || current.log?.[0] || '').trim();
  const phaseLabel = battle.phase === 'player'
    ? '플레이어 턴'
    : battle.phase === 'enemy'
      ? '적 턴'
      : battle.phase === 'cleared'
        ? '임무 클리어'
        : battle.phase === 'failed'
          ? '임무 실패'
          : '전투 대기';

  if (!latestLine) {
    return {
      title: phaseLabel,
      detail: '아직 표시할 행동 결과가 없습니다. 첫 행동 후 이 영역에 결과 컷이 고정됩니다.',
      tone: 'standby',
    };
  }
  if (latestLine.includes('격파') || latestLine.includes('클리어') || latestLine.includes('승리')) {
    return {
      title: '결정타 컷',
      detail: latestLine,
      tone: 'finish',
    };
  }
  if (latestLine.includes('빗나감')) {
    return {
      title: '회피 컷',
      detail: latestLine,
      tone: 'miss',
    };
  }
  if (latestLine.includes('HP +') || latestLine.includes('붕대') || latestLine.includes('처치')) {
    return {
      title: '회복 컷',
      detail: latestLine,
      tone: 'support',
    };
  }
  if (latestLine.includes('보호막') || latestLine.includes('방어')) {
    return {
      title: '방어 컷',
      detail: latestLine,
      tone: 'guard',
    };
  }
  if (latestLine.includes('이동')) {
    return {
      title: '이동 컷',
      detail: latestLine,
      tone: 'move',
    };
  }
  if (latestLine.includes('피해') || latestLine.includes('공격') || latestLine.includes('스킬')) {
    return {
      title: '공격 컷',
      detail: latestLine,
      tone: 'attack',
    };
  }
  return {
    title: phaseLabel,
    detail: latestLine,
    tone: 'standby',
  };
}

export function getBattlePresentationReport(state) {
  const current = normalizeState(state);
  const battle = normalizeBattle(current.battle, current.selectedStudentIds);
  const skills = tacticalSkillRows(current);
  const forecast = getBattleForecast(current);
  const expansion = getCampaignExpansionReport(current);
  const latestCue = latestPresentationCue(current, battle);
  const usableSkills = skills.filter((skill) => skill.canUse);
  const skillNames = skills.slice(0, 3).map((skill) => skill.name).join(' / ');
  const highRiskRows = forecast.unitThreats.filter((unit) => unit.riskScore >= 70 || unit.lethal);
  const warnBalanceRows = expansion.balanceRows.filter((row) => row.tone === 'warn');

  const presentationRows = [
    {
      id: 'action-result',
      label: '행동 결과 고정',
      value: latestCue.title,
      detail: latestCue.detail,
      ready: Boolean(latestCue.title),
    },
    {
      id: 'skill-cut-in',
      label: '스킬 컷인',
      value: `${skills.length}종 · 사용 가능 ${usableSkills.length}종`,
      detail: skillNames ? `대표 스킬: ${skillNames}` : '스킬 데이터가 없습니다.',
      ready: skills.length >= 3,
    },
    {
      id: 'enemy-forecast',
      label: '적 턴 예고',
      value: `${forecast.enemyPlans.length}개 행동 · ${forecast.threatLevel}`,
      detail: forecast.enemyPlans[0]
        ? `${forecast.enemyPlans[0].enemyName} → ${forecast.enemyPlans[0].targetName}`
        : '현재 예고할 적 행동이 없습니다.',
      ready: forecast.enemyPlans.length > 0 && forecast.unitThreats.length > 0,
    },
    {
      id: 'campaign-balance',
      label: '장기 밸런스 감사',
      value: `${expansion.readinessPct}% · 점검 ${warnBalanceRows.length}건`,
      detail: expansion.headline,
      ready: expansion.chapterRows.length >= 3 && expansion.enemyPatterns.length >= 6 && expansion.balanceRows.length >= 4,
    },
  ];
  const readyRows = presentationRows.filter((row) => row.ready).length;
  const completionPct = Math.round((readyRows / Math.max(1, presentationRows.length)) * 100);
  const recommendations = [];
  if (usableSkills.length) recommendations.push(`${usableSkills[0].name} 컷인을 우선 표시할 수 있습니다.`);
  if (highRiskRows.length) recommendations.push(`${highRiskRows[0].unitName} 위험 컷을 먼저 띄우는 구성이 좋습니다.`);
  if (warnBalanceRows.length) recommendations.push(`${warnBalanceRows[0].label} 항목은 장기 튜닝 점검 대상으로 유지됩니다.`);
  if (!recommendations.length) recommendations.push('현재 전투 연출, 위협 예고, 장기 밸런스 감사가 모두 연결되어 있습니다.');

  return {
    completionPct,
    ready: completionPct >= 100,
    headline: `${latestCue.title} · 연출 감사 ${completionPct}% · 위협 ${forecast.threatLevel}`,
    cutInTone: latestCue.tone,
    latestCue,
    presentationRows,
    recommendations: [...new Set(recommendations)].slice(0, 4),
  };
}

function expectedMissionRewardText(mission) {
  const rule = difficultyRule(mission.difficulty);
  const dropPassMul = 1 + Math.max(0, Number(rule.extraDropRolls || 0)) * 0.45;
  return (mission.rewards || []).map((reward) => {
    const min = Number(reward.qtyMin || 0);
    const max = Math.max(min, Number(reward.qtyMax || min));
    const expectedQty = ((min + max) / 2) * Number(reward.chance || 0) * dropPassMul;
    const qtyText = expectedQty >= 1 ? expectedQty.toFixed(1).replace(/\.0$/, '') : '<1';
    return `${itemName(reward.itemId)} ${qtyText}`;
  }).join(' · ') || '보상 없음';
}

function operationRiskLabel(successPct, locked) {
  if (locked) return '잠김';
  if (successPct >= 82) return '안정';
  if (successPct >= 64) return '권장';
  if (successPct >= 45) return '주의';
  return '위험';
}

function operationSuccessPct(state, mission, locked) {
  if (locked) return 0;
  const current = normalizeState(state);
  const powerRatio = battlePower(current) / Math.max(1, Number(mission.recommendedPower || 1));
  const formationBonus = normalizeFormationIds(current.selectedStudentIds).length >= MAX_FORMATION_SIZE ? 5 : -8;
  const bandageBonus = Number(current.inventory.con_bandage || 0) > 0 ? 4 : -7;
  const weaponBonusValue = current.weaponUid ? 5 : 0;
  const difficultyPenalty = {
    easy: 0,
    normal: 4,
    hard: 10,
    veryhard: 16,
  }[difficultyRule(mission.difficulty).id] || 4;
  return Math.round(clamp(55 + (powerRatio - 1) * 58 + formationBonus + bandageBonus + weaponBonusValue - difficultyPenalty, 5, 96));
}

function operationPrepList(state, missionRow, successPct) {
  const current = normalizeState(state);
  const items = [];
  if (missionRow.locked) items.push(missionRow.lockReason);
  if (!missionRow.locked && missionRow.powerGap < 0) items.push(`전투력 ${Math.abs(missionRow.powerGap)} 보강`);
  if (normalizeFormationIds(current.selectedStudentIds).length < MAX_FORMATION_SIZE) items.push(`편성 ${MAX_FORMATION_SIZE}명 채우기`);
  if (Number(current.inventory.con_bandage || 0) <= 0) items.push('붕대 확보');
  if (!current.weaponUid && itemCount(current, 'eq_knife') > 0) items.push('나이프 장착');
  else if (!current.weaponUid) items.push('무기 제작/구매');
  if (!missionRow.locked && successPct < 45) items.push('하위 임무 재도전으로 별/재화 확보');
  return [...new Set(items)].slice(0, 4);
}

export function getOperationBriefing(state) {
  const current = normalizeState(state);
  const campaign = getCampaignReport(current);
  const power = battlePower(current);
  const readyQuests = questRows(current).filter((quest) => quest.done && !quest.claimed);
  const missionRows = campaign.missionRows.map((mission) => {
    const successPct = operationSuccessPct(current, mission, mission.locked);
    const prep = operationPrepList(current, mission, successPct);
    const avgCredit = Math.round(((Number(mission.creditMin || 0) + Number(mission.creditMax || 0)) / 2) * Number(difficultyRule(mission.difficulty).rewardMul || 1));
    const repeatValue = mission.cleared && mission.bestStars >= 3 ? '파밍' : mission.cleared ? '3성 보강' : '진행';
    return {
      id: mission.id,
      name: mission.name,
      chapter: mission.chapter,
      difficultyLabel: mission.difficultyLabel,
      locked: mission.locked,
      lockReason: mission.lockReason,
      cleared: mission.cleared,
      bestStars: mission.bestStars,
      recommendedPower: mission.recommendedPower,
      powerGap: mission.powerGap,
      successPct,
      riskLabel: operationRiskLabel(successPct, mission.locked),
      targetTurn: mission.targetTurn,
      avgCredit,
      rewardText: expectedMissionRewardText(mission),
      prep,
      prepText: prep.length ? prep.join(' / ') : '즉시 출정 가능',
      repeatValue,
      sortScore: (mission.locked ? -1000 : 0)
        + (mission.cleared ? 0 : 140)
        + successPct
        + avgCredit / 4
        + (mission.bestStars < 3 ? 30 : 0)
        - Math.max(0, -mission.powerGap) / 2,
    };
  });
  const nextMission = missionRows
    .filter((mission) => !mission.locked && !mission.cleared)
    .sort((a, b) => b.sortScore - a.sortScore)[0]
    || missionRows.filter((mission) => !mission.locked && mission.bestStars < 3).sort((a, b) => b.sortScore - a.sortScore)[0]
    || missionRows.filter((mission) => !mission.locked).sort((a, b) => b.sortScore - a.sortScore)[0]
    || missionRows[0];
  const readinessPct = Math.round(clamp(
    30
      + Math.min(1, power / Math.max(1, Number(nextMission?.recommendedPower || 1))) * 35
      + Math.min(1, Number(current.inventory.con_bandage || 0) / 2) * 10
      + (current.weaponUid ? 10 : 0)
      + Math.min(1, normalizeFormationIds(current.selectedStudentIds).length / MAX_FORMATION_SIZE) * 15,
    0,
    100,
  ));
  const nextAction = nextMission?.prep?.[0]
    || (readyQuests.length ? `${readyQuests[0].title} 보고` : `${nextMission?.name || campaign.nextMissionName} 출정`);

  return {
    headline: nextMission
      ? `${nextMission.name} · 승산 ${nextMission.successPct}% · ${nextMission.riskLabel}`
      : '출정 후보 없음',
    readinessPct,
    nextAction,
    power,
    readyQuests: readyQuests.length,
    bandages: Number(current.inventory.con_bandage || 0),
    weaponEquipped: Boolean(current.weaponUid),
    formationCount: normalizeFormationIds(current.selectedStudentIds).length,
    bestMissionId: nextMission?.id || '',
    missionRows: missionRows.sort((a, b) => b.sortScore - a.sortScore),
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
