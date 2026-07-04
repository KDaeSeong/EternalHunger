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
];

export const STUDENTS = [
  { id: 's_hoshino', name: '호시노', role: '탱커', x: 0, y: 2, hp: 54, atk: 10, def: 5, range: 1, move: 2 },
  { id: 's_yuuka', name: '유우카', role: '방어', x: 1, y: 3, hp: 46, atk: 8, def: 6, range: 1, move: 2 },
  { id: 's_mika', name: '미카', role: '돌격', x: 0, y: 1, hp: 42, atk: 14, def: 3, range: 1, move: 3 },
  { id: 's_noa', name: '노아', role: '지원', x: 1, y: 2, hp: 34, atk: 7, def: 2, range: 3, move: 2 },
];

export const RECIPES = [
  { id: 'r_bandage', name: '붕대 만들기', inputs: [{ itemId: 'mat_wood', qty: 2 }], outputs: [{ itemId: 'con_bandage', qty: 1 }], costCredit: 5 },
  { id: 'r_knife', name: '나이프 제작', inputs: [{ itemId: 'mat_stone', qty: 2 }, { itemId: 'mat_wood', qty: 1 }], outputs: [{ itemId: 'eq_knife', qty: 1 }], costCredit: 10 },
];

export const SHOP_ITEMS = [
  { itemId: 'mat_wood', price: 2, stock: 30 },
  { itemId: 'mat_stone', price: 3, stock: 30 },
  { itemId: 'con_bandage', price: 8, stock: 10 },
  { itemId: 'eq_knife', price: 30, stock: 1 },
];

export const QUESTS = [
  {
    id: 'q_bandage_delivery',
    title: '붕대 납품',
    requirement: { type: 'haveItem', itemId: 'con_bandage', qty: 1 },
    reward: { credit: 80, items: [{ itemId: 'mat_wood', qty: 1 }] },
    repReward: 5,
  },
  {
    id: 'q_first_victory',
    title: '첫 승리 보고',
    requirement: { type: 'battleWin', count: 1 },
    reward: { credit: 100, items: [{ itemId: 'con_bandage', qty: 1 }] },
    repReward: 3,
  },
  {
    id: 'q_weekly_training',
    title: '주간 훈련 보고',
    requirement: { type: 'battleWin', count: 2 },
    reward: { credit: 200, items: [{ itemId: 'mat_stone', qty: 1 }] },
    repReward: 10,
  },
];

const OBSTACLES = new Set(['3,1', '3,2', '4,4']);
const COVER = new Set(['2,0', '2,4', '5,3']);

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `srpg-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    day: 1,
    credit: 500,
    guildRep: 0,
    selectedMissionId: 'm001',
    inventory: { mat_wood: 3, con_bandage: 1 },
    equipment: [],
    weaponUid: '',
    battleWins: 0,
    completedMissionIds: [],
    completedQuestIds: [],
    battle: createBattle('m001'),
    log: ['출정 준비가 끝났습니다. 학생을 선택하고 이동/공격으로 첫 임무를 정리하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    equipment: Array.isArray(value.equipment) ? value.equipment : base.equipment,
    completedMissionIds: Array.isArray(value.completedMissionIds) ? value.completedMissionIds : base.completedMissionIds,
    completedQuestIds: Array.isArray(value.completedQuestIds) ? value.completedQuestIds : base.completedQuestIds,
    battle: value.battle && typeof value.battle === 'object' ? normalizeBattle(value.battle) : createBattle(value.selectedMissionId || 'm001'),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

function normalizeBattle(battle) {
  const mission = getMission(battle.missionId || 'm001');
  return {
    ...createBattle(mission.id),
    ...battle,
    units: Array.isArray(battle.units) ? battle.units : createUnits(),
    enemies: Array.isArray(battle.enemies) ? battle.enemies : createEnemies(mission),
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
  }));
}

function createEnemies(mission) {
  return mission.enemies.map((enemy) => ({
    ...enemy,
    maxHp: enemy.hp,
    ap: 2,
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

function addItems(inventory, items = []) {
  return items.reduce((next, item) => addItem(next, item.itemId, item.qty), inventory);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const nextEnemies = battle.enemies.map((row) => (
    row.id === enemy.id ? { ...row, hp: Math.max(0, Number(row.hp || 0) - damage) } : row
  ));
  const defeated = nextEnemies.find((row) => row.id === enemy.id)?.hp <= 0;
  const nextBattle = {
    ...battle,
    enemies: nextEnemies,
    units: battle.units.map((row) => (
      row.id === unit.id ? { ...row, ap: Number(row.ap || 0) - 1, acted: true } : row
    )),
    targetEnemyId: defeated ? '' : enemy.id,
    lastResult: hit ? `${unit.name} -> ${enemy.name} ${damage} 피해${defeated ? ' 격파' : ''}` : `${unit.name} 공격 빗나감`,
  };
  return applyBattleOutcome(addLog(current, nextBattle.lastResult), nextBattle);
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
  const candidates = [
    { x: actor.x + 1, y: actor.y },
    { x: actor.x - 1, y: actor.y },
    { x: actor.x, y: actor.y + 1 },
    { x: actor.x, y: actor.y - 1 },
  ].filter((pos) => inside(pos.x, pos.y)
    && !OBSTACLES.has(keyOf(pos.x, pos.y))
    && !occupiedBy(battle.units, battle.enemies, pos.x, pos.y, actor.id));
  candidates.sort((a, b) => distance(a, target) - distance(b, target));
  return candidates[0] || { x: actor.x, y: actor.y };
}

function enemyPhase(state) {
  let battle = normalizeBattle(state.battle);
  let messages = [];
  let units = battle.units;
  let enemies = battle.enemies;

  aliveEnemies(battle).forEach((enemy) => {
    const alive = units.filter((unit) => unit.hp > 0);
    if (!alive.length || enemy.hp <= 0) return;
    const target = [...alive].sort((a, b) => distance(enemy, a) - distance(enemy, b))[0];
    if (distance(enemy, target) > Number(enemy.range || 1)) {
      const pos = stepToward(enemy, target, { ...battle, units, enemies });
      enemies = enemies.map((row) => row.id === enemy.id ? { ...row, x: pos.x, y: pos.y } : row);
      messages.push(`${enemy.name} 접근`);
      return;
    }
    const damage = Math.max(1, Number(enemy.atk || 0) - Number(target.def || 0) - tileDefense(target.x, target.y));
    units = units.map((unit) => (
      unit.id === target.id ? { ...unit, hp: Math.max(0, Number(unit.hp || 0) - damage) } : unit
    ));
    messages.push(`${enemy.name} -> ${target.name} ${damage} 피해`);
  });

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
  return addLog({
    ...current,
    day: Number(current.day || 1) + 1,
    battle: {
      ...current.battle,
      units: current.battle.units.map((unit) => ({ ...unit, hp: unit.maxHp, ap: 2, acted: false })),
      phase: current.battle.phase === 'failed' ? 'player' : current.battle.phase,
    },
    credit: Math.max(0, Number(current.credit || 0) - 50),
  }, '여관에서 하루를 쉬었습니다. 학생 HP가 회복됐습니다. -50 Cr');
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (Number(current.credit || 0) < recipe.costCredit) return addLog(current, '제작 비용이 부족합니다.');
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
    credit: Number(current.credit || 0) - recipe.costCredit,
    inventory,
    equipment,
  }, `${recipe.name} 완료.`);
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
  const line = SHOP_ITEMS.find((item) => item.itemId === itemId) || SHOP_ITEMS[0];
  if (Number(current.credit || 0) < line.price) return addLog(current, '크레딧이 부족합니다.');
  const item = getItem(line.itemId);
  if (item?.kind === 'equipment') {
    return addLog({
      ...current,
      credit: Number(current.credit || 0) - line.price,
      equipment: [...current.equipment, { uid: `${item.id}-${Date.now().toString(36)}`, itemId: item.id }],
    }, `${item.name} 구매.`);
  }
  return addLog({
    ...current,
    credit: Number(current.credit || 0) - line.price,
    inventory: addItem(current.inventory, line.itemId, 1),
  }, `${itemName(line.itemId)} 구매.`);
}

function questComplete(state, quest) {
  if (quest.requirement.type === 'battleWin') return Number(state.battleWins || 0) >= quest.requirement.count;
  if (quest.requirement.type === 'haveItem') return Number(state.inventory[quest.requirement.itemId] || 0) >= quest.requirement.qty;
  return false;
}

function spendQuestRequirement(state, quest) {
  if (quest.requirement.type !== 'haveItem') return state.inventory;
  return addItem(state.inventory, quest.requirement.itemId, -quest.requirement.qty);
}

export function claimQuestAction(state, questId) {
  const current = normalizeState(state);
  const quest = QUESTS.find((item) => item.id === questId) || QUESTS[0];
  if (current.completedQuestIds.includes(quest.id)) return addLog(current, '이미 완료한 의뢰입니다.');
  if (!questComplete(current, quest)) return addLog(current, `${quest.title} 조건이 부족합니다.`);
  const completed = new Set(current.completedQuestIds);
  completed.add(quest.id);
  return addLog({
    ...current,
    completedQuestIds: [...completed],
    inventory: addItems(spendQuestRequirement(current, quest), quest.reward.items),
    credit: Number(current.credit || 0) + Number(quest.reward.credit || 0),
    guildRep: Number(current.guildRep || 0) + Number(quest.repReward || 0),
  }, `${quest.title} 완료. +${quest.reward.credit || 0} Cr, 평판 +${quest.repReward || 0}`);
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
    done: questComplete(current, quest),
    claimed: current.completedQuestIds.includes(quest.id),
  }));
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
  return Math.max(0, Math.round(
    Number(current.credit || 0)
    + Number(current.guildRep || 0) * 12
    + Number(current.battleWins || 0) * 180
    + Number(current.completedQuestIds.length || 0) * 90
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
  return {
    day: current.day,
    mission: getMission(current.selectedMissionId).name,
    battleWins: current.battleWins,
    credit: current.credit,
    guildRep: current.guildRep,
    quests: current.completedQuestIds.length,
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
