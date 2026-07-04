export const GAME_SLUG = 'primitive-archive';
export const QUICK_SAVE_SLOT = 'primitive-archive-main';
export const SAVE_VERSION = 'primitive-archive-v1';

export const STUDENTS = [
  {
    id: 'shiroko',
    name: '시로코',
    role: '정찰',
    portrait: '/games/primitive-archive/portraits/shiroko.svg',
    stats: { gather: 9, hunt: 7, craft: 5, camp: 6 },
    trait: '탐험 피해 감소',
  },
  {
    id: 'hina',
    name: '히나',
    role: '사냥',
    portrait: '/games/primitive-archive/portraits/hina.svg',
    stats: { gather: 5, hunt: 10, craft: 4, camp: 6 },
    trait: '사냥 명중률 증가',
  },
  {
    id: 'noa',
    name: '노아',
    role: '제작',
    portrait: '/games/primitive-archive/portraits/noa.svg',
    stats: { gather: 6, hunt: 4, craft: 10, camp: 8 },
    trait: '제작 성공률 증가',
  },
];

export const ZONES = [
  { id: 'forest', name: '숲', gather: [['wood', 2], ['fiber', 1], ['berry', 1]], hunt: [['hide', 1], ['meat', 1]], note: '나무와 섬유가 안정적으로 나옵니다.' },
  { id: 'river', name: '강가', gather: [['stone', 2], ['clay', 1], ['herb', 1]], hunt: [['meat', 1], ['bone', 1]], note: '돌과 약초를 모으기 좋습니다.' },
  { id: 'cave', name: '동굴', gather: [['stone', 2], ['flint', 1]], hunt: [['bone', 2], ['hide', 1]], note: '부싯돌과 뼈가 잘 나오지만 위험합니다.' },
  { id: 'plains', name: '초원', gather: [['fiber', 2], ['berry', 1]], hunt: [['meat', 2], ['hide', 1]], note: '식량과 대형 사냥감 기회가 있습니다.' },
];

export const ITEMS = {
  wood: { name: '나무', icon: 'wood', weight: 1 },
  stone: { name: '돌', icon: 'stone', weight: 1 },
  fiber: { name: '섬유', icon: 'fiber', weight: 1 },
  hide: { name: '가죽', icon: 'hide', weight: 1 },
  bone: { name: '뼈', icon: 'bone', weight: 1 },
  flint: { name: '부싯돌', icon: 'stone', weight: 1 },
  clay: { name: '점토', icon: 'stone', weight: 1 },
  herb: { name: '약초', icon: 'herb', weight: 1 },
  berry: { name: '베리', icon: 'food', weight: 1 },
  meat: { name: '고기', icon: 'food', weight: 1 },
  cooked_meat: { name: '구운 고기', icon: 'food', weight: 1 },
  twine: { name: '끈', icon: 'fiber', weight: 1 },
  stone_axe: { name: '돌도끼', icon: 'tool', weight: 3 },
  bow: { name: '활', icon: 'weapon', weight: 2 },
};

export const RECIPES = [
  { id: 'twine', name: '끈', requires: { fiber: 2 }, baseChance: 0.9, reward: { twine: 1 }, note: '초기 제작 재료입니다.' },
  { id: 'stone_axe', name: '돌도끼', requires: { wood: 2, stone: 3 }, baseChance: 0.7, reward: { stone_axe: 1 }, note: '채집 성공률을 올립니다.' },
  { id: 'bow', name: '활', requires: { wood: 2, fiber: 3, twine: 1 }, baseChance: 0.62, reward: { bow: 1 }, note: '사냥 성공률을 올립니다.' },
];

export const WEATHER = [
  { id: 'clear', name: '맑음', temp: 16, actionMod: 0, cold: 0 },
  { id: 'rain', name: '비', temp: 10, actionMod: -0.06, cold: 4 },
  { id: 'cold-wind', name: '차가운 바람', temp: 4, actionMod: -0.08, cold: 9 },
  { id: 'snow', name: '눈', temp: -3, actionMod: -0.12, cold: 14 },
  { id: 'heat', name: '더위', temp: 28, actionMod: -0.04, cold: 0 },
];

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rollWeather(day = 1, rng = Math.random) {
  const snowBias = Math.min(0.2, day * 0.01);
  const roll = rng();
  if (roll > 0.92 - snowBias) return WEATHER[3];
  if (roll > 0.78) return WEATHER[2];
  if (roll > 0.58) return WEATHER[1];
  if (roll < 0.08) return WEATHER[4];
  return WEATHER[0];
}

export function makeParty() {
  return STUDENTS.map((student) => ({
    ...student,
    hp: 100,
    hunger: 12,
    stamina: 100,
  }));
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const rng = options.rng || Math.random;
  return {
    runId: options.runId || `pa-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    day: 1,
    ap: 4,
    apMax: 4,
    weather: rollWeather(1, rng),
    party: makeParty(),
    inventory: { wood: 2, stone: 2, fiber: 2, berry: 2 },
    camp: { fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, fuel: 0 },
    counters: { gather: 0, hunt: 0, craft: 0, camp: 0, meals: 0 },
    log: ['Day 1: 낯선 원시 지대에 도착했습니다. 파티의 첫 목표는 식량과 캠프 확보입니다.'],
    ended: false,
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    weather: value.weather && typeof value.weather === 'object' ? value.weather : base.weather,
    party: Array.isArray(value.party) && value.party.length ? value.party : base.party,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    camp: value.camp && typeof value.camp === 'object' ? { ...base.camp, ...value.camp } : base.camp,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    log: Array.isArray(value.log) ? value.log.slice(0, 80) : base.log,
  };
}

export function itemName(id) {
  return ITEMS[id]?.name || id;
}

export function addLog(state, message) {
  return {
    ...state,
    log: [`Day ${state.day}: ${message}`, ...state.log].slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function spendResources(inventory, requires) {
  const next = { ...inventory };
  Object.entries(requires).forEach(([id, qty]) => {
    next[id] = Math.max(0, Number(next[id] || 0) - Number(qty || 0));
  });
  return next;
}

export function addItems(inventory, entries) {
  const next = { ...inventory };
  entries.forEach(([id, qty]) => {
    if (!qty) return;
    next[id] = Number(next[id] || 0) + Number(qty || 0);
  });
  return next;
}

export function hasResources(inventory, requires) {
  return Object.entries(requires).every(([id, qty]) => Number(inventory[id] || 0) >= Number(qty || 0));
}

export function inventoryWeight(inventory) {
  return Object.entries(inventory).reduce((sum, [id, qty]) => sum + Number(qty || 0) * Number(ITEMS[id]?.weight || 1), 0);
}

export function averageParty(state, key) {
  if (!state.party.length) return 0;
  return Math.round(state.party.reduce((sum, member) => sum + Number(member[key] || 0), 0) / state.party.length);
}

export function getActor(state, actorId) {
  return state.party.find((member) => member.id === actorId) || state.party[0];
}

export function updateActor(state, actorId, patch) {
  return {
    ...state,
    party: state.party.map((member) => member.id === actorId ? { ...member, ...patch } : member),
  };
}

export function actionChance(state, actorId, action, base = 0.55) {
  const actor = getActor(state, actorId);
  const stat = Number(actor?.stats?.[action] || 5);
  const weather = Number(state.weather?.actionMod || 0);
  const camp = action === 'craft' ? Number(state.camp.workbenchLevel || 0) * 0.04 : 0;
  const axe = action === 'gather' && Number(state.inventory.stone_axe || 0) > 0 ? 0.08 : 0;
  const bow = action === 'hunt' && Number(state.inventory.bow || 0) > 0 ? 0.1 : 0;
  return clamp(base + stat * 0.025 + weather + camp + axe + bow, 0.08, 0.95);
}

export function afterAction(state, actorId, staminaCost, hungerAdd = 3, options = {}) {
  const actor = getActor(state, actorId);
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(actor.stamina || 0) - staminaCost, 0, 100),
    hunger: clamp(Number(actor.hunger || 0) + hungerAdd, 0, 100),
  });
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function advanceDay(state, options = {}) {
  const weather = rollWeather(state.day + 1, options.rng || Math.random);
  const warmth = Number(state.camp.fireLevel || 0) * 4 + Number(state.camp.shelterLevel || 0) * 3;
  const coldDamage = Math.max(0, Number(state.weather?.cold || 0) - warmth);
  const fuelUsed = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 1 : 0;
  const party = state.party.map((member) => {
    const hunger = clamp(Number(member.hunger || 0) + 8 + Math.floor(coldDamage / 3), 0, 100);
    const hungerDamage = hunger >= 90 ? 10 : hunger >= 75 ? 4 : 0;
    return {
      ...member,
      stamina: clamp(Number(member.stamina || 0) + 34 + Number(state.camp.shelterLevel || 0) * 8, 0, 100),
      hunger,
      hp: clamp(Number(member.hp || 0) - coldDamage - hungerDamage, 0, 100),
    };
  });
  const ended = party.every((member) => Number(member.hp || 0) <= 0);
  const next = {
    ...state,
    day: state.day + 1,
    ap: state.apMax,
    weather,
    party,
    camp: { ...state.camp, fuel: Math.max(0, Number(state.camp.fuel || 0) - fuelUsed) },
    ended,
  };
  const note = ended
    ? '파티가 더 이상 움직일 수 없습니다. 런을 종료하고 기록을 남기세요.'
    : `새로운 날입니다. 날씨: ${weather.name}, ${weather.temp}도.`;
  return addLog(next, fuelUsed ? `${note} 모닥불 연료를 1 소비했습니다.` : note);
}

export function scoreState(state) {
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  return Math.max(0, Math.round(
    state.day * 120
    + Number(state.counters.gather || 0) * 18
    + Number(state.counters.hunt || 0) * 48
    + Number(state.counters.craft || 0) * 34
    + Number(state.camp.fireLevel || 0) * 80
    + Number(state.camp.shelterLevel || 0) * 90
    + Number(state.camp.workbenchLevel || 0) * 70
    + hp * 2
    + (100 - hunger)
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  return {
    day: state.day,
    hp: averageParty(state, 'hp'),
    hunger: averageParty(state, 'hunger'),
    ap: state.ap,
    camp: `불 ${state.camp.fireLevel} / 대피소 ${state.camp.shelterLevel} / 작업대 ${state.camp.workbenchLevel}`,
    weight: inventoryWeight(state.inventory),
    score: scoreState(state),
  };
}

export function formatRequires(requires) {
  return Object.entries(requires).map(([id, qty]) => `${itemName(id)} ${qty}`).join(', ');
}

export function formatGains(entries) {
  return entries.map(([id, qty]) => `${itemName(id)} +${qty}`).join(', ');
}

export function runGatherAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'gather', 0.5);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = zone.gather.map(([id, qty]) => [id, qty + ((options.rng || Math.random)() < 0.18 ? 1 : 0)]);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, gather: Number(next.counters.gather || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 채집 성공. ${zone.name}에서 ${formatGains(gains)}.`);
  } else {
    next = addLog(next, `${actor.name}의 채집 실패. ${zone.name}의 날씨와 지형이 좋지 않았습니다.`);
  }
  return afterAction(next, actorId, 15, 3, options);
}

export function runHuntAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'hunt', 0.42);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = zone.hunt.map(([id, qty]) => [id, qty + ((options.rng || Math.random)() < 0.24 ? 1 : 0)]);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, hunt: Number(next.counters.hunt || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 사냥 성공. ${formatGains(gains)}.`);
  } else {
    const target = getActor(next, actorId);
    next = updateActor(next, actorId, { hp: clamp(Number(target.hp || 0) - 11, 0, 100) });
    next = addLog(next, `${actor.name}의 사냥 실패. 반격으로 HP -11.`);
  }
  return afterAction(next, actorId, 24, 5, options);
}

export function runCraftAction(state, actorId, recipeId, options = {}) {
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const actor = getActor(state, actorId);
  if (!hasResources(state.inventory, recipe.requires)) {
    return addLog(state, `${recipe.name} 제작 재료가 부족합니다. 필요: ${formatRequires(recipe.requires)}.`);
  }
  const chance = actionChance(state, actorId, 'craft', recipe.baseChance - 0.18);
  const ok = (options.rng || Math.random)() < chance;
  let next = { ...state, inventory: spendResources(state.inventory, recipe.requires) };
  if (ok) {
    next = {
      ...next,
      inventory: addItems(next.inventory, Object.entries(recipe.reward)),
      counters: { ...next.counters, craft: Number(next.counters.craft || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 제작 성공. ${recipe.name}을(를) 만들었습니다.`);
  } else {
    next = addLog(next, `${actor.name}의 제작 실패. 일부 재료를 잃었습니다.`);
  }
  return afterAction(next, actorId, 20, 4, options);
}

export function runEatAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const foodId = Number(state.inventory.cooked_meat || 0) > 0 ? 'cooked_meat' : Number(state.inventory.berry || 0) > 0 ? 'berry' : Number(state.inventory.meat || 0) > 0 ? 'meat' : '';
  if (!foodId) return addLog(state, '먹을 음식이 없습니다. 채집이나 사냥으로 식량을 확보하세요.');
  const nutrition = foodId === 'cooked_meat' ? 28 : foodId === 'meat' ? 12 : 8;
  const heal = foodId === 'cooked_meat' ? 6 : 0;
  const target = getActor(state, actorId);
  let next = {
    ...state,
    inventory: spendResources(state.inventory, { [foodId]: 1 }),
    counters: { ...state.counters, meals: Number(state.counters.meals || 0) + 1 },
  };
  next = updateActor(next, actorId, {
    hunger: clamp(Number(target.hunger || 0) - nutrition, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
  });
  next = addLog(next, `${actor.name}이(가) ${itemName(foodId)}을(를) 먹었습니다. 허기 -${nutrition}, HP +${heal}.`);
  return afterAction(next, actorId, 6, 0, options);
}

export function runRestAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const target = getActor(state, actorId);
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(target.stamina || 0) + 42 + Number(state.camp.shelterLevel || 0) * 8, 0, 100),
    hp: clamp(Number(target.hp || 0) + 4, 0, 100),
  });
  next = addLog(next, `${actor.name}이(가) 휴식했습니다. 스태미나와 HP를 회복했습니다.`);
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function runCampAction(state, actorId, kind, options = {}) {
  const actor = getActor(state, actorId);
  let next = state;
  if (kind === 'fuel') {
    if (!hasResources(next.inventory, { wood: 1 })) return addLog(next, '연료로 넣을 나무가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 1 }), camp: { ...next.camp, fuel: Number(next.camp.fuel || 0) + 2 } };
    next = addLog(next, `${actor.name}이(가) 모닥불 연료를 보충했습니다. 연료 +2.`);
  }
  if (kind === 'fire') {
    if (!hasResources(next.inventory, { wood: 2, stone: 2 })) return addLog(next, '모닥불 업그레이드 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 2, stone: 2 }), camp: { ...next.camp, fireLevel: clamp(Number(next.camp.fireLevel || 0) + 1, 0, 3) } };
    next = addLog(next, `${actor.name}이(가) 모닥불을 업그레이드했습니다. Lv.${next.camp.fireLevel}.`);
  }
  if (kind === 'shelter') {
    if (!hasResources(next.inventory, { wood: 3, fiber: 2, hide: 1 })) return addLog(next, '대피소 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 3, fiber: 2, hide: 1 }), camp: { ...next.camp, shelterLevel: clamp(Number(next.camp.shelterLevel || 0) + 1, 0, 3) } };
    next = addLog(next, `${actor.name}이(가) 대피소를 보강했습니다. Lv.${next.camp.shelterLevel}.`);
  }
  if (kind === 'workbench') {
    if (!hasResources(next.inventory, { wood: 4, stone: 2 })) return addLog(next, '작업대 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 4, stone: 2 }), camp: { ...next.camp, workbenchLevel: clamp(Number(next.camp.workbenchLevel || 0) + 1, 0, 2) } };
    next = addLog(next, `${actor.name}이(가) 작업대를 만들었습니다. Lv.${next.camp.workbenchLevel}.`);
  }
  if (kind === 'cook') {
    if (Number(next.camp.fireLevel || 0) <= 0 || Number(next.camp.fuel || 0) <= 0) return addLog(next, '고기를 구우려면 모닥불과 연료가 필요합니다.');
    if (!hasResources(next.inventory, { meat: 1 })) return addLog(next, '구울 고기가 없습니다.');
    next = {
      ...next,
      inventory: addItems(spendResources(next.inventory, { meat: 1 }), [['cooked_meat', 1]]),
      camp: { ...next.camp, fuel: Math.max(0, Number(next.camp.fuel || 0) - 1) },
    };
    next = addLog(next, `${actor.name}이(가) 고기를 구웠습니다. 구운 고기 +1.`);
  }
  next.counters = { ...next.counters, camp: Number(next.counters.camp || 0) + 1 };
  return afterAction(next, actorId, 14, 2, options);
}
