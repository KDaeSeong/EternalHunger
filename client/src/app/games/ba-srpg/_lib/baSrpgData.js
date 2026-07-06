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
export const DEFAULT_FORMATION_IDS = STUDENTS.slice(0, MAX_FORMATION_SIZE).map((student) => student.id);
export const FORMATION_SPAWNS = [
  { x: 0, y: 2 },
  { x: 1, y: 3 },
  { x: 0, y: 1 },
  { x: 1, y: 2 },
];

export const DIFFICULTY_RULES = {
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

export const OBSTACLES = new Set(['3,1', '3,2', '4,4']);
export const COVER = new Set(['2,0', '2,4', '5,3']);
export const AI_RULES = {
  takeCover: 'AI_TAKE_COVER',
  attackIfInRange: 'AI_ATTACK_IF_IN_RANGE',
  moveToAttack: 'AI_MOVE_TO_ATTACK',
  moveToward: 'AI_MOVE_TOWARD',
  wait: 'AI_WAIT',
};
export const AI_COVER_HP_RATIO = 0.42;
