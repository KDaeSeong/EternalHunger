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
  { id: 'itm_memory_chip', name: '메모리 칩', rarity: 'RARE', sellValue: 22, stackable: true },
  { id: 'itm_enhance_stone', name: '강화석', rarity: 'RARE', sellValue: 35, stackable: true },
  { id: 'itm_tower_key', name: '시련의 탑 열쇠', rarity: 'RARE', sellValue: 30, stackable: true },
  { id: 'itm_tower_token', name: '시련 토큰', rarity: 'RARE', sellValue: 12, stackable: true },
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
];

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
    equipment: {},
    inventory: {
      itm_scrap: 80,
      itm_bandage: 12,
      itm_battery: 6,
      itm_memory_chip: 3,
      itm_enhance_stone: 3,
      itm_tower_key: 5,
    },
    counters: {
      CLEAR_FLOOR: 0,
      KILL_BOSS: 0,
      ATTEMPT_TOWER: 0,
      CLEAR_TOWER: 0,
      CRAFT: 0,
      ENHANCE_TRY: 0,
      ENHANCE_SUCCESS: 0,
    },
    claimedMissions: [],
    log: ['샬레 당직이 시작됐습니다. 방치 정산으로 층을 밀고, 재료를 모아 장비를 제작하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    equipment: value.equipment && typeof value.equipment === 'object' ? value.equipment : base.equipment,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    claimedMissions: Array.isArray(value.claimedMissions) ? value.claimedMissions : base.claimedMissions,
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

function equipmentScore(equip) {
  if (!equip) return 0;
  const def = getItem(equip.itemId);
  const stats = def?.equip || {};
  return Math.round(
    Number(stats.powerAdd || 0)
    + (Number(stats.powerMul || 1) - 1) * 900
    + (Number(stats.staminaMul || 1) - 1) * 450
    + Number(equip.enhance || 0) * 22
  );
}

function makeEquipment(itemId, enhance = 0) {
  const def = getItem(itemId);
  return {
    uid: `${itemId}-${Date.now().toString(36)}`,
    itemId,
    name: def?.name || itemId,
    rarity: def?.rarity || 'COMMON',
    slot: def?.equip?.slot || 'WEAPON',
    enhance,
  };
}

export function getEquippedList(state) {
  const current = normalizeState(state);
  return Object.values(current.equipment).filter(Boolean).sort((a, b) => slotLabel(a.slot).localeCompare(slotLabel(b.slot), 'ko-KR'));
}

export function teamPower(state) {
  const current = normalizeState(state);
  let add = 0;
  let mul = 1;
  let staminaMul = 1;
  getEquippedList(current).forEach((equip) => {
    const stats = getItem(equip.itemId)?.equip || {};
    const enhance = Number(equip.enhance || 0);
    add += Number(stats.powerAdd || 0) + enhance * 8;
    mul *= Number(stats.powerMul || 1) + enhance * 0.006;
    staminaMul *= Number(stats.staminaMul || 1);
  });
  const staminaFactor = clamp(0.45, 1.12, 0.62 + (Number(current.stamina || 0) / 100) * 0.5);
  return Math.round((Number(current.basePower || 0) + add) * mul * staminaFactor * staminaMul);
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

  while (seconds > 0 && stamina > 8) {
    const power = teamPower({ ...next, floor, stamina, inventory });
    const difficulty = dutyDifficulty(floor);
    const probability = winProb(power, difficulty);
    const clearSec = clamp(Math.round(34 * Math.pow(difficulty / Math.max(power, 1), 0.7)), 8, 180);
    if (seconds < clearSec) break;
    seconds -= clearSec;
    if (rng() > probability) {
      return addLog({
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
      }, `${floor}층 정산 실패. ${leader.lines.fail}`);
    }

    const reward = creditReward(floor);
    credits += reward;
    cleared += 1;
    if (floor % 10 === 0) bosses += 1;
    inventory = rollDrops(inventory, floor, rng);
    stamina = clamp(stamina - (floor % 10 === 0 ? 3.2 : 1.3), 0, 100);
    floor += 1;
  }

  next = {
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
  };
  return addLog(next, `${minutes}분 방치 정산: ${cleared}층 클리어, +${Math.round(credits)} Cr, 보스 ${bosses}회. ${cleared ? leader.lines.clear : '추가 클리어는 없었습니다.'}`);
}

export function restAction(state) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    stamina: clamp(Number(current.stamina || 0) + 35, 0, 100),
  }, '재정비로 스태미나를 회복했습니다.');
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (Number(current.credits || 0) < recipe.credits) return addLog(current, `${recipe.name} 실패. 크레딧이 부족합니다.`);
  if (!hasItems(current.inventory, recipe.requires)) return addLog(current, `${recipe.name} 실패. 필요한 재료가 부족합니다.`);

  const produced = getItem(recipe.produces.itemId);
  let equipment = current.equipment;
  let inventory = spendItems(current.inventory, recipe.requires);
  let message = `${recipe.name} 완료.`;
  if (produced?.equip) {
    const equip = makeEquipment(produced.id);
    const old = equipment[equip.slot];
    equipment = !old || equipmentScore(equip) >= equipmentScore(old)
      ? { ...equipment, [equip.slot]: equip }
      : equipment;
    message = `${recipe.name} 완료. ${produced.name}${old && equipment[equip.slot] === old ? '은 기존 장비보다 약해 보관 처리했습니다.' : '을(를) 장착했습니다.'}`;
  } else {
    inventory = addItem(inventory, recipe.produces.itemId, recipe.produces.qty);
  }

  return addLog({
    ...current,
    credits: Number(current.credits || 0) - recipe.credits,
    inventory,
    equipment,
    counters: bumpCounter(current.counters, 'CRAFT', 1),
  }, message);
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
  const nextEquip = success ? { ...equip, enhance: level + 1 } : equip;
  return addLog({
    ...current,
    credits: Number(current.credits || 0) - costCredits,
    inventory: addItem(current.inventory, 'itm_enhance_stone', -costStones),
    equipment: { ...current.equipment, [slot]: nextEquip },
    counters: {
      ...bumpCounter(current.counters, 'ENHANCE_TRY', 1),
      ENHANCE_SUCCESS: Number(current.counters.ENHANCE_SUCCESS || 0) + (success ? 1 : 0),
    },
  }, `${equip.name} +${level} 강화 ${success ? `성공. +${level + 1}` : '실패.'} 성공률 ${Math.round(chance * 100)}%`);
}

export function attemptTowerAction(state, count = 1) {
  let next = normalizeState(state);
  const rng = createRng(`${next.runId}|tower|${next.towerFloor}|${next.counters.ATTEMPT_TOWER}|${count}`);
  const requested = Math.max(1, Number(count || 1));
  let successCount = 0;
  let failCount = 0;
  let credits = 0;

  for (let index = 0; index < requested; index += 1) {
    if (Number(next.inventory.itm_tower_key || 0) <= 0) break;
    const floor = Number(next.towerFloor || 1);
    const probability = winProb(teamPower(next), towerDifficulty(floor), 1.7);
    next = {
      ...next,
      inventory: addItem(next.inventory, 'itm_tower_key', -1),
      counters: bumpCounter(next.counters, 'ATTEMPT_TOWER', 1),
    };
    if (rng() < probability) {
      const reward = towerReward(floor);
      const tokenGain = 1 + Math.floor((floor - 1) / 10) + (floor % 5 === 0 ? 1 : 0);
      successCount += 1;
      credits += reward;
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
      next = {
        ...next,
        towerLossStreak: Number(next.towerLossStreak || 0) + 1,
      };
      break;
    }
  }

  return addLog(next, `시련의 탑 ${requested}회 요청: 성공 ${successCount}, 실패 ${failCount}, +${credits} Cr.`);
}

export function claimMissionRewardsAction(state) {
  let next = normalizeState(state);
  let claimed = 0;
  let credits = 0;
  let inventory = next.inventory;
  const claimedSet = new Set(next.claimedMissions);

  MISSIONS.forEach((mission) => {
    if (claimedSet.has(mission.id)) return;
    if (Number(next.counters[mission.action] || 0) < mission.target) return;
    claimedSet.add(mission.id);
    claimed += 1;
    credits += Number(mission.rewardCredits || 0);
    inventory = addItems(inventory, mission.rewardItems);
  });

  if (!claimed) return addLog(next, '수령 가능한 미션 보상이 없습니다.');
  next = {
    ...next,
    credits: Number(next.credits || 0) + credits,
    inventory,
    claimedMissions: [...claimedSet],
  };
  return addLog(next, `미션 ${claimed}개 보상 수령. +${credits} Cr.`);
}

export function inventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([itemId, qty]) => ({ itemId, name: itemName(itemId), qty, rarity: getItem(itemId)?.rarity || 'COMMON' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

export function availableEnhanceSlots(state) {
  return getEquippedList(state).map((equip) => equip.slot);
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
  };
}
