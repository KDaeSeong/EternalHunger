import {
  BASE_LOG_LIMIT,
  ARCHIVE_LOG_LIMIT_BONUS,
  ARCHIVE_VICTORY_DAY,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  STUDENTS,
  DIALOGUES,
  ZONES,
  ITEMS,
  RECIPES,
  TECH_TREE,
  PERK_DEFS,
  WEATHER,
  DIFFICULTY_PRESETS,
  applyOwnedPerks,
  difficultyKey,
  difficultyPreset,
  emptyEquipmentSlots,
  initEquipmentForParty,
  initMetaState,
  makeParty,
  normalizeEquipment,
  normalizeResearch,
} from './primitiveArchiveData';

export {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  BASE_LOG_LIMIT,
  ARCHIVE_LOG_LIMIT_BONUS,
  ARCHIVE_VICTORY_DAY,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  STUDENTS,
  DIALOGUES,
  ZONES,
  ITEMS,
  RECIPES,
  TECH_TREE,
  PERK_DEFS,
  WEATHER,
  DIFFICULTY_PRESETS,
} from './primitiveArchiveData';

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const rng = options.rng || Math.random;
  const meta = initMetaState(options.meta);
  const difficulty = difficultyKey(options.difficulty);
  const preset = difficultyPreset(difficulty);
  const party = makeParty();
  const inventory = Object.entries(preset.startInventory || {}).reduce((acc, [itemId, qty]) => ({
    ...acc,
    [itemId]: Math.max(0, Number(acc[itemId] || 0) + Number(qty || 0)),
  }), { wood: 2, stone: 2, fiber: 2, berry: 2 });
  const base = {
    runId: options.runId || `pa-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    difficulty,
    day: 1,
    ap: preset.apMax,
    apMax: preset.apMax,
    weather: rollWeather(1, rng),
    party,
    inventory,
    equipment: initEquipmentForParty(party),
    camp: { fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, archiveRoomLevel: 0, scribeDeskLevel: 0, libraryShelfLevel: 0, fuel: 0 },
    counters: { gather: 0, hunt: 0, craft: 0, camp: 0, meals: 0, events: 0 },
    research: initResearchState(),
    meta,
    log: ['Day 1: 낯선 원시 지대에 도착했습니다. 파티의 첫 목표는 식량과 캠프 확보입니다.'],
    ended: false,
    victory: false,
  };
  return applyOwnedPerks(base, meta);
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const research = normalizeResearch(value.research);
  const meta = initMetaState(value.meta);
  const difficulty = difficultyKey(value.difficulty || base.difficulty);
  const preset = difficultyPreset(difficulty);
  const party = (Array.isArray(value.party) && value.party.length ? value.party : base.party).map((member) => ({
    ...member,
    hp: clamp(Number(member.hp ?? 100), 0, 100),
    hunger: clamp(Number(member.hunger ?? 12), 0, 100),
    stamina: clamp(Number(member.stamina ?? 100), 0, 100),
    bodyTemp: clamp(Number(member.bodyTemp ?? 37), 25, 39),
  }));
  const camp = value.camp && typeof value.camp === 'object'
    ? {
      ...base.camp,
      ...value.camp,
      archiveRoomLevel: clamp(Number(value.camp.archiveRoomLevel || 0), 0, 1),
      scribeDeskLevel: clamp(Number(value.camp.scribeDeskLevel || 0), 0, 1),
      libraryShelfLevel: clamp(Number(value.camp.libraryShelfLevel || 0), 0, 1),
    }
    : base.camp;
  return {
    ...base,
    ...value,
    difficulty,
    ap: clamp(Number(value.ap ?? preset.apMax), 0, Math.max(1, Number(value.apMax || preset.apMax))),
    apMax: Math.max(1, Number(value.apMax || preset.apMax)),
    weather: value.weather && typeof value.weather === 'object' ? value.weather : base.weather,
    party,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    equipment: normalizeEquipment(value.equipment, party),
    camp,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    research,
    meta,
    log: Array.isArray(value.log) ? value.log.slice(0, logCapacity({ ...base, ...value, camp })) : base.log,
    victory: Boolean(value.victory),
  };
}

export function getPartyCap(state) {
  const current = normalizeState(state);
  return 3 + (hasTechPassive(current, 'PARTY_CAP_UP') ? 1 : 0);
}

function makePartyMember(student) {
  return {
    ...student,
    hp: 100,
    hunger: 12,
    stamina: 100,
    bodyTemp: 37,
  };
}

export function recruitablePartyRows(state) {
  const current = normalizeState(state);
  const joinedIds = new Set(current.party.map((member) => member.id));
  const partyCap = getPartyCap(current);
  return STUDENTS
    .filter((student) => !joinedIds.has(student.id))
    .map((student) => ({
      ...student,
      canRecruit: current.party.length < partyCap,
      partyCap,
      currentPartySize: current.party.length,
    }));
}

export function recruitPartyMemberAction(state, studentId = '') {
  const current = normalizeState(state);
  const partyCap = getPartyCap(current);
  if (current.party.length >= partyCap) {
    return addLog(current, `파티 인원이 이미 최대입니다. (${current.party.length}/${partyCap})`);
  }

  const joinedIds = new Set(current.party.map((member) => member.id));
  const student = studentId
    ? STUDENTS.find((entry) => entry.id === studentId)
    : STUDENTS.find((entry) => !joinedIds.has(entry.id));
  if (!student) return addLog(current, '합류시킬 학생 후보가 없습니다.');
  if (joinedIds.has(student.id)) return addLog(current, `${student.name}은(는) 이미 파티에 있습니다.`);

  const member = makePartyMember(student);
  const party = [...current.party, member];
  return addLog({
    ...current,
    party,
    equipment: normalizeEquipment(current.equipment, party),
  }, `${member.name} 파티 합류. (파티 ${party.length}/${partyCap})`);
}

export function itemName(id) {
  return ITEMS[id]?.name || id;
}

export function logCapacity(state) {
  return BASE_LOG_LIMIT + (Number(state?.camp?.archiveRoomLevel || 0) > 0 ? ARCHIVE_LOG_LIMIT_BONUS : 0);
}

export function addLog(state, message) {
  return {
    ...state,
    log: [`Day ${state.day}: ${message}`, ...state.log].slice(0, logCapacity(state)),
    updatedAt: new Date().toISOString(),
  };
}

function pickDialogue(actorId, action, result = 'success', rng = Math.random) {
  const pack = DIALOGUES[actorId] || DIALOGUES.shiroko;
  const entry = pack?.[action];
  const lines = Array.isArray(entry) ? entry : entry?.[result];
  if (!Array.isArray(lines) || !lines.length) return '';
  return lines[Math.floor(rng() * lines.length) % lines.length];
}

function addDialogueLog(state, actorId, action, result = 'success', rng = Math.random) {
  const actor = getActor(state, actorId);
  const line = pickDialogue(actorId, action, result, rng);
  if (!line) return state;
  return addLog(state, `${actor?.name || '학생'}: "${line}"`);
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

function getTech(techId) {
  return TECH_TREE.find((tech) => tech.id === techId) || null;
}

function prereqsMet(research, tech) {
  return (tech?.prereqs || []).every((techId) => research.completed?.[techId]);
}

function missingPrereqNames(research, tech) {
  return (tech?.prereqs || [])
    .filter((techId) => !research.completed?.[techId])
    .map((techId) => getTech(techId)?.name || techId);
}

function missingPrereqMessage(research, tech) {
  const missing = missingPrereqNames(research, tech);
  const eurekaNote = tech?.eureka ? ' 유레카 조건은 단서일 뿐이며, 선행 연구가 끝나야 보너스가 적용됩니다.' : '';
  return `${tech.name} 연구를 하려면 먼저 ${missing.join(', ')} 연구를 완료해야 합니다.${eurekaNote}`;
}

function eurekaStatusForTech(state, tech) {
  if (!tech?.eureka) {
    return {
      current: 0,
      target: 0,
      done: false,
      blocked: false,
      statusLabel: '유레카 없음',
      note: '이 기술은 별도 유레카 조건이 없습니다.',
      missingPrereqs: [],
    };
  }
  const research = normalizeResearch(state.research);
  const progress = researchTriggerProgress({ ...state, research }, tech.eureka);
  const missingPrereqs = missingPrereqNames(research, tech);
  const completed = Boolean(research.completed?.[tech.id]);
  const eurekaDone = Boolean(research.eureka?.[tech.id]);
  const blocked = progress.done && !completed && missingPrereqs.length > 0;
  let statusLabel = '진행 중';
  if (completed) statusLabel = '연구 완료';
  else if (eurekaDone) statusLabel = '유레카 적용';
  else if (blocked) statusLabel = '단서 확보 · 선행 연구 필요';
  else if (progress.done) statusLabel = '적용 대기';
  const note = blocked
    ? `조건은 충족했지만 ${missingPrereqs.join(', ')} 연구 완료 후 유레카 보너스가 적용됩니다.`
    : tech.eureka.desc || '';
  return {
    ...progress,
    blocked,
    statusLabel,
    note,
    missingPrereqs,
  };
}

function nextAvailableTech(research) {
  return TECH_TREE.find((tech) => !research.completed?.[tech.id] && prereqsMet(research, tech)) || null;
}

function hasTechPassive(state, passiveId) {
  const research = normalizeResearch(state.research);
  return TECH_TREE.some((tech) => research.completed?.[tech.id] && (tech.unlocks?.passives || []).includes(passiveId));
}

function hasTechCampUnlock(state, campId) {
  const research = normalizeResearch(state.research);
  return TECH_TREE.some((tech) => research.completed?.[tech.id] && (tech.unlocks?.camp || []).includes(campId));
}

function bookSystemActive(state) {
  return hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK');
}

function bookCraftChanceBonus(state) {
  if (!bookSystemActive(state) || Number(state.inventory?.book_craft_guide || 0) <= 0) return 0;
  return 0.04 + Number(state.camp?.libraryShelfLevel || 0) * 0.02 + (hasTechPassive(state, 'BOOK_BONUS_UP') ? 0.01 : 0);
}

function bookCampStaminaReduction(state) {
  if (!bookSystemActive(state) || Number(state.inventory?.book_camp_manual || 0) <= 0) return 0;
  return 2 + Number(state.camp?.libraryShelfLevel || 0) + (hasTechPassive(state, 'BOOK_BONUS_UP') ? 1 : 0);
}

function bookResearchBonus(state) {
  if (!bookSystemActive(state)) return 0;
  return Math.min(2, Number(state.inventory?.book_craft_guide || 0) + Number(state.inventory?.book_camp_manual || 0));
}

function completeTechIfReady(state, techId) {
  const research = normalizeResearch(state.research);
  const tech = getTech(techId);
  if (!tech || research.completed[tech.id]) return state;
  const progress = Number(research.progress[tech.id] || 0);
  if (progress < tech.cost) return state;
  const nextResearch = {
    ...research,
    progress: { ...research.progress, [tech.id]: tech.cost },
    completed: { ...research.completed, [tech.id]: true },
  };
  if (nextResearch.selectedTechId === tech.id) {
    nextResearch.selectedTechId = nextAvailableTech(nextResearch)?.id || tech.id;
  }
  return applyEureka(addLog({ ...state, research: nextResearch }, `연구 완료: ${tech.name}`));
}

function addResearchProgress(state, techId, points, source = '연구') {
  const research = normalizeResearch(state.research);
  const tech = getTech(techId);
  if (!tech) return state;
  if (research.completed[tech.id]) return state;
  if (!prereqsMet(research, tech)) return addLog({ ...state, research }, missingPrereqMessage(research, tech));
  const progress = Math.min(tech.cost, Number(research.progress[tech.id] || 0) + Math.max(0, Math.floor(points)));
  const next = {
    ...state,
    research: {
      ...research,
      progress: { ...research.progress, [tech.id]: progress },
    },
  };
  const withLog = addLog(next, `${source}: ${tech.name} +${Math.max(0, Math.floor(points))}RP (${progress}/${tech.cost})`);
  return completeTechIfReady(withLog, tech.id);
}

function researchTriggerProgress(state, trigger) {
  const research = normalizeResearch(state.research);
  const counters = research.counters || {};
  const target = Math.max(1, Number(trigger?.count || 1));
  let current = 0;
  if (trigger.type === 'actionSuccess') current = Number(counters.actionSuccess?.[trigger.action] || 0);
  if (trigger.type === 'actionFail') current = Number(counters.actionFail?.[trigger.action] || 0);
  if (trigger.type === 'recipeCraft') current = Number(counters.recipeCraft?.[trigger.recipeId] || 0);
  if (trigger.type === 'campAction') current = Number(counters.campAction?.[trigger.kind] || 0);
  if (trigger.type === 'haveItem') current = Number(state.inventory?.[trigger.itemId] || 0);
  if (trigger.type === 'surviveDays') current = Number(state.day || 1);
  if (trigger.type === 'campLevel') current = Number(state.camp?.[trigger.key] || 0);
  if (trigger.type === 'weatherSeen') current = Number(counters.weatherSeen?.[trigger.weatherId] || 0);
  if (trigger.type === 'weatherTypes') {
    current = Object.values(counters.weatherSeen || {}).filter((value) => Number(value || 0) > 0).length;
  }
  if (trigger.type === 'campFireDays') current = Number(counters.campFireDays || 0);
  return {
    current,
    target,
    done: current >= target,
  };
}

function applyEureka(state) {
  let next = { ...state, research: normalizeResearch(state.research) };
  for (const tech of TECH_TREE) {
    const trigger = tech.eureka;
    if (!trigger || next.research.eureka[tech.id] || next.research.completed[tech.id]) continue;
    if (!researchTriggerProgress(next, trigger).done) continue;
    if (!prereqsMet(next.research, tech)) continue;
    const bonus = Math.ceil(tech.cost * Number(trigger.bonusPct || 0));
    next = {
      ...next,
      research: { ...next.research, eureka: { ...next.research.eureka, [tech.id]: true } },
    };
    next = addLog(next, `유레카: ${tech.name} (${trigger.desc})`);
    next = addResearchProgress(next, tech.id, bonus, '유레카');
  }
  return next;
}

function recordResearchEvent(state, event) {
  const research = normalizeResearch(state.research);
  const counters = {
    ...research.counters,
    actionSuccess: { ...research.counters.actionSuccess },
    actionFail: { ...research.counters.actionFail },
    recipeCraft: { ...research.counters.recipeCraft },
    campAction: { ...research.counters.campAction },
    weatherSeen: { ...research.counters.weatherSeen },
    campFireDays: Math.max(0, Number(research.counters.campFireDays || 0)),
  };
  if (event.kind === 'action') {
    const bucket = event.ok ? counters.actionSuccess : counters.actionFail;
    bucket[event.action] = Number(bucket[event.action] || 0) + 1;
  }
  if (event.kind === 'recipe' && event.ok) counters.recipeCraft[event.recipeId] = Number(counters.recipeCraft[event.recipeId] || 0) + 1;
  if (event.kind === 'camp') counters.campAction[event.campKind] = Number(counters.campAction[event.campKind] || 0) + 1;
  if (event.kind === 'day') {
    counters.weatherSeen[event.weatherId] = Number(counters.weatherSeen[event.weatherId] || 0) + 1;
    if (event.fireKept) counters.campFireDays = Number(counters.campFireDays || 0) + 1;
  }
  return applyEureka({ ...state, research: { ...research, counters } });
}

function autoResearchForDay(state) {
  const research = normalizeResearch(state.research);
  const techId = research.selectedTechId || nextAvailableTech(research)?.id;
  if (!techId) return state;
  const points = clamp(
    2
    + Number(state.camp.workbenchLevel || 0)
    + Number(state.camp.archiveRoomLevel || 0)
    + Number(state.camp.scribeDeskLevel || 0)
    + Number(state.camp.libraryShelfLevel || 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS') ? 1 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_2') ? 1 : 0)
    + bookResearchBonus(state),
    2,
    12
  );
  return addResearchProgress({ ...state, research }, techId, points, '일일 연구');
}

export function inventoryWeight(inventory) {
  return Object.entries(inventory).reduce((sum, [id, qty]) => sum + Number(qty || 0) * Number(ITEMS[id]?.weight || 1), 0);
}

function equipmentWeight(equipment = {}) {
  return Object.values(equipment).reduce((sum, slots) => (
    sum + Object.values(slots || {}).reduce((slotSum, itemId) => (
      slotSum + (itemId ? Number(ITEMS[itemId]?.weight || 0) : 0)
    ), 0)
  ), 0);
}

export function totalCarryWeight(state) {
  const current = normalizeState(state);
  return inventoryWeight(current.inventory) + equipmentWeight(current.equipment);
}

function equipmentBonus(state, actorId, bucket, key) {
  const slots = normalizeEquipment(state.equipment, state.party)[actorId] || {};
  return Object.values(slots).reduce((sum, itemId) => (
    sum + Number(ITEMS[itemId]?.[bucket]?.[key] || 0)
  ), 0);
}

function actorInsulation(state, actorId) {
  const slots = normalizeEquipment(state.equipment, state.party)[actorId] || {};
  return Object.values(slots).reduce((sum, itemId) => sum + Number(ITEMS[itemId]?.insulation || 0), 0);
}

export function partyInsulation(state) {
  const current = normalizeState(state);
  if (!current.party.length) return 0;
  const total = current.party.reduce((sum, member) => sum + actorInsulation(current, member.id), 0);
  return Math.round((total / current.party.length) * 10) / 10;
}

function isEquipped(state, actorId, itemId) {
  return Object.values(normalizeEquipment(state.equipment, state.party)[actorId] || {}).includes(itemId);
}

export function equipmentRows(state, actorId) {
  const current = normalizeState(state);
  const equipment = normalizeEquipment(current.equipment, current.party);
  const slots = equipment[actorId] || emptyEquipmentSlots();
  return EQUIPMENT_SLOTS.map((slot) => {
    const itemId = slots[slot];
    const item = ITEMS[itemId];
    return {
      slot,
      label: EQUIPMENT_SLOT_LABELS[slot],
      itemId: itemId || '',
      itemName: item?.name || '없음',
      insulation: Number(item?.insulation || 0),
      successText: item?.successAdd ? Object.entries(item.successAdd).map(([key, value]) => `${key}+${Math.round(Number(value) * 100)}%`).join(', ') : '',
    };
  });
}

export function equipmentChoicesForSlot(state, actorId, slot) {
  const current = normalizeState(state);
  const equipped = normalizeEquipment(current.equipment, current.party)[actorId]?.[slot] || '';
  const inventoryChoices = Object.entries(current.inventory)
    .filter(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip' && ITEMS[itemId]?.slot === slot)
    .map(([itemId, qty]) => ({
      itemId,
      name: ITEMS[itemId].name,
      qty: Number(qty || 0),
    }));
  const equippedChoice = equipped && !inventoryChoices.some((item) => item.itemId === equipped)
    ? [{ itemId: equipped, name: ITEMS[equipped]?.name || equipped, qty: 0 }]
    : [];
  return [{ itemId: '', name: '없음', qty: 0 }, ...equippedChoice, ...inventoryChoices];
}

export function equipmentInventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip')
    .map(([itemId, qty]) => ({
      itemId,
      name: ITEMS[itemId].name,
      slot: ITEMS[itemId].slot,
      slotLabel: EQUIPMENT_SLOT_LABELS[ITEMS[itemId].slot] || ITEMS[itemId].slot,
      qty: Number(qty || 0),
    }))
    .sort((a, b) => a.slotLabel.localeCompare(b.slotLabel, 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR'));
}

export function setEquipmentSlotAction(state, actorId, slot, nextItemId) {
  const current = normalizeState(state);
  const actor = getActor(current, actorId);
  if (!actor) return current;
  if (!EQUIPMENT_SLOTS.includes(slot)) return addLog(current, '장비 슬롯을 찾을 수 없습니다.');
  const nextItem = nextItemId ? ITEMS[nextItemId] : null;
  if (nextItemId && (!nextItem || nextItem.type !== 'equip' || nextItem.slot !== slot)) {
    return addLog(current, '해당 슬롯에 장착할 수 없는 장비입니다.');
  }

  const equipment = normalizeEquipment(current.equipment, current.party);
  const previousItemId = equipment[actorId]?.[slot] || '';
  if (previousItemId === nextItemId) return current;
  if (nextItemId && Number(current.inventory[nextItemId] || 0) <= 0) {
    return addLog(current, `${nextItem.name} 보유 수량이 없습니다.`);
  }
  const inventory = { ...current.inventory };
  if (previousItemId) inventory[previousItemId] = Number(inventory[previousItemId] || 0) + 1;
  if (nextItemId) inventory[nextItemId] = Math.max(0, Number(inventory[nextItemId] || 0) - 1);

  const next = {
    ...current,
    inventory,
    equipment: {
      ...equipment,
      [actorId]: {
        ...(equipment[actorId] || emptyEquipmentSlots()),
        [slot]: nextItemId || null,
      },
    },
  };
  return addLog(next, `${actor.name} 장비 변경: ${EQUIPMENT_SLOT_LABELS[slot]} = ${nextItemId ? ITEMS[nextItemId].name : '없음'}`);
}

function buildEquipmentPool(state) {
  const pool = { ...state.inventory };
  const equipment = normalizeEquipment(state.equipment, state.party);
  Object.values(equipment).forEach((slots) => {
    Object.values(slots || {}).forEach((itemId) => {
      if (!itemId) return;
      pool[itemId] = Number(pool[itemId] || 0) + 1;
    });
  });
  return pool;
}

function preferredActionForRole(role) {
  if (role === '사냥') return 'hunt';
  if (role === '제작') return 'craft';
  return 'gather';
}

function equipmentScoreFor(actor, itemId, mode, weather) {
  const item = ITEMS[itemId];
  if (!item || item.type !== 'equip') return -Infinity;
  const weatherCold = Math.max(0, Number(weather?.cold || 0));
  const weatherWeight = mode === 'weather' ? 9 + weatherCold * 0.35 : 3 + weatherCold * 0.12;
  let score = Number(item.insulation || 0) * weatherWeight;
  const preferredAction = preferredActionForRole(actor?.role);

  Object.entries(item.successAdd || {}).forEach(([action, value]) => {
    const actionWeight = action === preferredAction
      ? mode === 'weather' ? 80 : 150
      : mode === 'weather' ? 55 : 65;
    score += Number(value || 0) * actionWeight;
  });

  Object.entries(item.staminaAdd || {}).forEach(([action, value]) => {
    const staminaWeight = action === preferredAction ? 8 : action === 'rest' ? 5 : 6;
    score += -Number(value || 0) * staminaWeight;
  });

  score -= Number(item.weight || 0) * (mode === 'weather' ? 0.3 : 0.2);
  return score;
}

function bestEquipmentForSlot(state, pool, actor, slot, mode) {
  let bestId = '';
  let bestScore = 0;
  Object.entries(pool).forEach(([itemId, qty]) => {
    if (Number(qty || 0) <= 0) return;
    const item = ITEMS[itemId];
    if (!item || item.type !== 'equip' || item.slot !== slot) return;
    const score = equipmentScoreFor(actor, itemId, mode, state.weather);
    if (score > bestScore) {
      bestId = itemId;
      bestScore = score;
    }
  });
  return bestId;
}

function countEquipmentChanges(before, after, party) {
  return party.reduce((sum, member) => {
    const prev = before[member.id] || emptyEquipmentSlots();
    const next = after[member.id] || emptyEquipmentSlots();
    return sum + EQUIPMENT_SLOTS.filter((slot) => (prev[slot] || '') !== (next[slot] || '')).length;
  }, 0);
}

export function autoEquipAction(state, mode = 'role') {
  const current = normalizeState(state);
  const safeMode = mode === 'weather' ? 'weather' : 'role';
  const before = normalizeEquipment(current.equipment, current.party);
  const pool = buildEquipmentPool(current);
  const equipment = {};

  current.party.forEach((actor) => {
    equipment[actor.id] = emptyEquipmentSlots();
    EQUIPMENT_SLOTS.forEach((slot) => {
      const itemId = bestEquipmentForSlot(current, pool, actor, slot, safeMode);
      if (!itemId) return;
      equipment[actor.id][slot] = itemId;
      pool[itemId] = Math.max(0, Number(pool[itemId] || 0) - 1);
    });
  });

  const inventory = Object.fromEntries(Object.entries(pool).filter(([, qty]) => Number(qty || 0) > 0));
  const changed = countEquipmentChanges(before, equipment, current.party);
  const modeLabel = safeMode === 'weather' ? '날씨' : '역할';
  return addLog({ ...current, inventory, equipment }, `장비 자동 장착 완료(${modeLabel} 모드). 변경 슬롯 ${changed}개.`);
}

export function clearAllEquipmentAction(state) {
  const current = normalizeState(state);
  const pool = buildEquipmentPool(current);
  const equipment = Object.fromEntries(current.party.map((member) => [member.id, emptyEquipmentSlots()]));
  const inventory = Object.fromEntries(Object.entries(pool).filter(([, qty]) => Number(qty || 0) > 0));
  return addLog({ ...current, inventory, equipment }, '모든 학생의 장비를 해제했습니다.');
}

export function averageParty(state, key) {
  if (!state.party.length) return 0;
  return Math.round(state.party.reduce((sum, member) => sum + Number(member[key] || 0), 0) / state.party.length);
}

export function averageBodyTemp(state) {
  if (!state.party.length) return 0;
  const avg = state.party.reduce((sum, member) => sum + Number(member.bodyTemp ?? 37), 0) / state.party.length;
  return Math.round(avg * 10) / 10;
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

function withEventCounter(state) {
  return {
    ...state,
    counters: {
      ...state.counters,
      events: Number(state.counters?.events || 0) + 1,
    },
  };
}

function addEventLog(state, message) {
  return addLog(withEventCounter(state), `탐험 사건: ${message}`);
}

function zoneEventReward(zoneId, action) {
  if (action === 'gather') {
    if (zoneId === 'river') return [['herb', 1], ['clay', 1]];
    if (zoneId === 'cave') return [['flint', 1], ['obsidian_shard', 1]];
    if (zoneId === 'plains') return [['berry', 1], ['fiber', 1]];
    return [['resin', 1], ['berry', 1]];
  }
  if (zoneId === 'plains' || zoneId === 'cave') return [['dino_hide', 1], ['dino_bone', 1]];
  return [['tooth', 1], ['sinew', 1]];
}

function applyExplorationEvent(state, { actorId, action, zoneId = '', ok = true, recipe = null, rng = Math.random } = {}) {
  const chance = ok ? 0.12 : 0.08;
  if (rng() > chance) return state;
  const actor = getActor(state, actorId);
  let next = state;

  if (action === 'gather') {
    if (ok) {
      const rewards = zoneEventReward(zoneId, 'gather').filter(([, qty]) => qty > 0);
      next = { ...next, inventory: addItems(next.inventory, rewards) };
      return addEventLog(next, `${actor.name} 학생이 숨겨진 흔적을 발견했습니다. ${formatGains(rewards)}.`);
    }
    next = updateActor(next, actorId, { hp: clamp(Number(actor.hp || 0) - 3, 0, 100) });
    return addEventLog(next, `${actor.name} 학생이 가시덤불에 긁혔습니다. HP -3.`);
  }

  if (action === 'hunt') {
    if (ok) {
      const rewards = zoneEventReward(zoneId, 'hunt');
      next = {
        ...next,
        inventory: addItems(next.inventory, rewards),
      };
      next = updateActor(next, actorId, { hp: clamp(Number(actor.hp || 0) - 4, 0, 100) });
      return addEventLog(next, `${actor.name} 학생이 큰 사냥감의 흔적을 확보했습니다. ${formatGains(rewards)}, HP -4.`);
    }
    next = updateActor(next, actorId, {
      hp: clamp(Number(actor.hp || 0) - 5, 0, 100),
      stamina: clamp(Number(actor.stamina || 0) - 6, 0, 100),
    });
    return addEventLog(next, `${actor.name} 학생이 포식자를 피해 달아났습니다. HP -5, 스태미나 -6.`);
  }

  if (action === 'craft') {
    if (!ok) return addEventLog(next, `${actor.name} 학생이 실패 원인을 기록했습니다. 다음 제작 판단에 도움이 됩니다.`);
    const [rewardId] = Object.keys(recipe?.reward || {});
    if (!rewardId) return state;
    next = { ...next, inventory: addItems(next.inventory, [[rewardId, 1]]) };
    return addEventLog(next, `${actor.name}의 정교한 마감으로 ${itemName(rewardId)}을(를) 추가로 얻었습니다.`);
  }

  if (action === 'camp') {
    next = {
      ...next,
      camp: { ...next.camp, fuel: Number(next.camp.fuel || 0) + 1 },
      party: next.party.map((member) => ({
        ...member,
        stamina: clamp(Number(member.stamina || 0) + 3, 0, 100),
      })),
    };
    return addEventLog(next, '캠프 동선이 안정됐습니다. 연료 +1, 전원 스태미나 +3.');
  }

  return state;
}

export function actionChance(state, actorId, action, base = 0.55) {
  const actor = getActor(state, actorId);
  const stat = Number(actor?.stats?.[action] || 5);
  const weather = Number(state.weather?.actionMod || 0);
  const camp = action === 'craft' ? Number(state.camp.workbenchLevel || 0) * 0.04 : 0;
  const book = action === 'craft' ? bookCraftChanceBonus(state) : 0;
  const equipment = equipmentBonus(state, actorId, 'successAdd', action);
  const researchBonus =
    (action === 'gather' && hasTechPassive(state, 'GATHER_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'HUNT_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && isEquipped(state, actorId, 'bow') && hasTechPassive(state, 'BOW_HUNT_UP') ? 0.06 : 0)
    + (action === 'craft' && hasTechPassive(state, 'CRAFT_SUCCESS_UP') ? 0.06 : 0);
  return clamp(base + stat * 0.025 + weather + camp + book + equipment + researchBonus, 0.08, 0.95);
}

function staminaCostWithEquipment(state, actorId, action, baseCost) {
  return Math.max(1, Math.round(Number(baseCost || 0) + equipmentBonus(state, actorId, 'staminaAdd', action)));
}

function actionBodyTempDelta(state, actorId, warmthAdd = 0) {
  const weatherCold = Number(state.weather?.cold || 0);
  const personalWarmth = actorInsulation(state, actorId) * 1.25 + Number(state.camp.fireLevel || 0) * 0.65;
  const coldPressure = Math.max(0, weatherCold - personalWarmth);
  const heatPressure = state.weather?.id === 'heat' ? 0.16 : 0;
  return warmthAdd - coldPressure * 0.035 + heatPressure;
}

export function afterAction(state, actorId, staminaCost, hungerAdd = 3, options = {}) {
  const actor = getActor(state, actorId);
  const bodyTemp = clamp(
    Number(actor.bodyTemp ?? 37) + actionBodyTempDelta(state, actorId, Number(options.warmthAdd || 0)),
    25,
    39,
  );
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(actor.stamina || 0) - staminaCost, 0, 100),
    hunger: clamp(Number(actor.hunger || 0) + hungerAdd, 0, 100),
    bodyTemp,
  });
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function advanceDay(state, options = {}) {
  const preset = difficultyPreset(state);
  const weather = rollWeather(state.day + 1, options.rng || Math.random);
  const warmth = Number(state.camp.fireLevel || 0) * 4 + Number(state.camp.shelterLevel || 0) * 3 + partyInsulation(state) * 2;
  const coldDamage = Math.round(Math.max(0, Number(state.weather?.cold || 0) - warmth) * preset.coldMultiplier);
  const fuelUsed = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 1 : 0;
  const party = state.party.map((member) => {
    const hunger = clamp(Number(member.hunger || 0) + Math.round(8 * preset.hungerMultiplier) + Math.floor(coldDamage / 3), 0, 100);
    const hungerDamage = hunger >= 90 ? 10 : hunger >= 75 ? 4 : 0;
    const shelterRecovery = (34 + Number(state.camp.shelterLevel || 0) * 8) * preset.staminaRecoveryMultiplier;
    const tempRecovery = warmth >= Number(state.weather?.cold || 0) ? 0.65 : 0;
    const bodyTemp = clamp(
      Number(member.bodyTemp ?? 37) - coldDamage * 0.24 - (state.weather?.id === 'snow' ? 0.35 : 0) + tempRecovery,
      25,
      39,
    );
    const hypothermiaDamage = bodyTemp < 31 ? 18 : bodyTemp < 34.5 ? 7 : 0;
    return {
      ...member,
      stamina: clamp(Number(member.stamina || 0) + shelterRecovery, 0, 100),
      hunger,
      bodyTemp,
      hp: clamp(Number(member.hp || 0) - coldDamage - hungerDamage - hypothermiaDamage, 0, 100),
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
  const tempNote = `평균 체온 ${averageBodyTemp(next).toFixed(1)}도`;
  const note = ended
    ? '파티가 더 이상 움직일 수 없습니다. 런을 종료하고 기록을 남기세요.'
    : `새로운 날입니다. 날씨: ${weather.name}, ${weather.temp}도 · ${tempNote}`;
  const logged = addLog(next, fuelUsed ? `${note} 모닥불 연료를 1 소비했습니다.` : note);
  return recordResearchEvent(autoResearchForDay(logged), { kind: 'day', weatherId: weather.id, fireKept: fuelUsed > 0 });
}

export function selectTechAction(state, techId) {
  const current = normalizeState(state);
  const tech = getTech(techId);
  if (!tech) return current;
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, missingPrereqMessage(current.research, tech));
  return addLog({
    ...current,
    research: { ...current.research, selectedTechId: tech.id },
  }, `연구 목표를 ${tech.name}(으)로 변경했습니다.`);
}

export function runResearchAction(state, actorId, options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '연구할 행동력이 부족합니다.');
  const actor = getActor(current, actorId);
  const techId = current.research.selectedTechId || nextAvailableTech(current.research)?.id;
  const tech = getTech(techId);
  if (!tech) return addLog(current, '연구 가능한 기술이 없습니다.');
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, missingPrereqMessage(current.research, tech));
  const archiveStudy = Number(current.camp.scribeDeskLevel || 0) + Number(current.camp.libraryShelfLevel || 0) + bookResearchBonus(current);
  const points = 3 + Math.floor(Number(actor?.stats?.craft || 5) / 3) + Number(current.camp.workbenchLevel || 0) + archiveStudy;
  const staminaCost = Math.max(5, 14 - Number(current.camp.workbenchLevel || 0) * 2 - Number(current.camp.scribeDeskLevel || 0));
  const researched = addResearchProgress(current, tech.id, points, `${actor.name} 연구`);
  const withDialogue = addDialogueLog(researched, actorId, 'research', 'success', options.rng || Math.random);
  return afterAction(withDialogue, actorId, staminaCost, 2, options);
}

export function buyPerkAction(state, perkId) {
  const current = normalizeState(state);
  const perk = PERK_DEFS.find((item) => item.id === perkId);
  if (!perk) return current;
  const level = perkLevel(current.meta, perk.id);
  if (level >= perk.maxLevel) return addLog(current, '이미 최대 레벨인 특전입니다.');
  if (Number(current.meta.perkPoints || 0) < perk.cost) return addLog(current, '특전 포인트가 부족합니다.');
  return addLog({
    ...current,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) - perk.cost,
      ownedPerks: { ...current.meta.ownedPerks, [perk.id]: level + 1 },
    },
  }, `${perk.name} 특전을 구매했습니다. 다음 탐험부터 적용됩니다.`);
}

export function settleRunAction(state) {
  const current = normalizeState(state);
  if (current.meta.lastSettledRunId === current.runId) return addLog(current, '이미 정산한 런입니다.');
  const score = scoreState(current);
  const award = Math.max(1, Math.floor(score / 850));
  return addLog({
    ...current,
    ended: true,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) + award,
      lifetimeScore: Number(current.meta.lifetimeScore || 0) + score,
      runsCompleted: Number(current.meta.runsCompleted || 0) + 1,
      lastAward: award,
      lastSettledRunId: current.runId,
    },
  }, `런 정산 완료. 점수 ${score.toLocaleString('ko-KR')} / 특전 +${award}`);
}

export function completeArchiveAction(state) {
  const current = normalizeState(state);
  if (current.victory) return addLog(current, '이미 아카이브를 완성한 런입니다.');
  const victory = archiveVictorySummary(current);
  if (!victory.canComplete) {
    const pending = victory.rows.filter((row) => !row.done).map((row) => row.label).join(', ');
    return addLog(current, `아카이브 완성 조건이 부족합니다. 남은 목표: ${pending || '없음'}.`);
  }
  const nextForScore = { ...current, victory: true };
  const score = scoreState(nextForScore);
  const award = Math.max(3, Math.floor(score / 700));
  return addLog({
    ...nextForScore,
    ended: true,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) + award,
      lifetimeScore: Number(current.meta.lifetimeScore || 0) + score,
      runsCompleted: Number(current.meta.runsCompleted || 0) + 1,
      lastAward: award,
      lastSettledRunId: current.runId,
    },
  }, `아카이브 완성. 점수 ${score.toLocaleString('ko-KR')} / 특전 +${award}`);
}

export function startNewRunFromMeta(state, options = {}) {
  const current = normalizeState(state);
  return createNewState({ ...options, meta: current.meta });
}

export function techRows(state) {
  const current = normalizeState(state);
  return TECH_TREE.map((tech) => {
    const progress = Math.min(tech.cost, Number(current.research.progress?.[tech.id] || 0));
    const completed = Boolean(current.research.completed?.[tech.id]);
    const available = !completed && prereqsMet(current.research, tech);
    const eurekaStatus = eurekaStatusForTech(current, tech);
    return {
      ...tech,
      progress,
      completed,
      available,
      selected: current.research.selectedTechId === tech.id,
      eurekaDone: Boolean(current.research.eureka?.[tech.id]),
      eurekaStatus,
      missingPrereqs: missingPrereqNames(current.research, tech),
      progressPct: Math.round((progress / tech.cost) * 100),
    };
  });
}

export function researchInspirationRows(state) {
  const current = normalizeState(state);
  return TECH_TREE
    .filter((tech) => tech.eureka)
    .map((tech) => {
      const status = eurekaStatusForTech(current, tech);
      return {
        techId: tech.id,
        techName: tech.name,
        desc: tech.eureka.desc || '',
        completed: Boolean(current.research.completed?.[tech.id]),
        eurekaDone: Boolean(current.research.eureka?.[tech.id]),
        available: prereqsMet(current.research, tech),
        blocked: status.blocked,
        statusLabel: status.statusLabel,
        note: status.note,
        missingPrereqs: status.missingPrereqs,
        current: status.current,
        target: status.target,
        progressPct: Math.round((Math.min(status.current, status.target) / status.target) * 100),
      };
    })
    .sort((a, b) => (
      Number(a.completed) - Number(b.completed)
      || Number(b.available) - Number(a.available)
      || Number(a.eurekaDone) - Number(b.eurekaDone)
      || b.progressPct - a.progressPct
      || a.techName.localeCompare(b.techName, 'ko-KR')
    ));
}

export function perkRows(state) {
  const current = normalizeState(state);
  return PERK_DEFS.map((perk) => {
    const level = perkLevel(current.meta, perk.id);
    return {
      ...perk,
      level,
      maxed: level >= perk.maxLevel,
      canBuy: level < perk.maxLevel && Number(current.meta.perkPoints || 0) >= perk.cost,
    };
  });
}

export function researchSummary(state) {
  const current = normalizeState(state);
  const rows = techRows(current);
  const selected = rows.find((tech) => tech.selected) || rows.find((tech) => tech.available) || rows[0];
  return {
    completed: rows.filter((tech) => tech.completed).length,
    total: rows.length,
    selected,
    available: rows.filter((tech) => tech.available).length,
  };
}

export function archiveObjectiveRows(state) {
  const current = normalizeState(state);
  const research = researchSummary(current);
  const alive = current.party.filter((member) => Number(member.hp || 0) > 0).length;
  const books = Number(current.inventory.book_craft_guide || 0) + Number(current.inventory.book_camp_manual || 0);
  const facilities = Number(current.camp.archiveRoomLevel || 0)
    + Number(current.camp.scribeDeskLevel || 0)
    + Number(current.camp.libraryShelfLevel || 0);
  return [
    {
      id: 'survive',
      label: '생존일',
      current: current.day,
      target: ARCHIVE_VICTORY_DAY,
      done: current.day >= ARCHIVE_VICTORY_DAY,
    },
    {
      id: 'research',
      label: '연구',
      current: research.completed,
      target: research.total,
      done: research.completed >= research.total,
    },
    {
      id: 'facilities',
      label: '기록 시설',
      current: facilities,
      target: 3,
      done: facilities >= 3,
    },
    {
      id: 'books',
      label: '책',
      current: books,
      target: 2,
      done: Number(current.inventory.book_craft_guide || 0) > 0 && Number(current.inventory.book_camp_manual || 0) > 0,
    },
    {
      id: 'survivors',
      label: '생존 파티',
      current: alive,
      target: 3,
      done: alive >= 3,
    },
  ];
}

export function archiveVictorySummary(state) {
  const current = normalizeState(state);
  const rows = archiveObjectiveRows(current);
  const completed = rows.filter((row) => row.done).length;
  return {
    rows,
    completed,
    total: rows.length,
    canComplete: completed === rows.length && !current.ended,
    victory: Boolean(current.victory),
    label: current.victory ? '아카이브 완성' : `${completed}/${rows.length}`,
  };
}

export function scoreState(state) {
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  const research = researchSummary(state);
  const preset = difficultyPreset(state);
  const equipmentCount = Object.values(normalizeEquipment(state.equipment, state.party)).reduce((sum, slots) => (
    sum + Object.values(slots || {}).filter(Boolean).length
  ), 0);
  return Math.max(0, Math.round(
    (state.day * 120
    + Number(state.counters.gather || 0) * 18
    + Number(state.counters.hunt || 0) * 48
    + Number(state.counters.craft || 0) * 34
    + Number(state.camp.fireLevel || 0) * 80
    + Number(state.camp.shelterLevel || 0) * 90
    + Number(state.camp.workbenchLevel || 0) * 70
    + Number(state.camp.archiveRoomLevel || 0) * 95
    + Number(state.camp.scribeDeskLevel || 0) * 90
    + Number(state.camp.libraryShelfLevel || 0) * 105
    + research.completed * 120
    + equipmentCount * 45
    + partyInsulation(state) * 35
    + (state.victory ? 700 : 0)
    + hp * 2
    + (100 - hunger))
    * preset.scoreMultiplier
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const preset = difficultyPreset(state);
  const victory = archiveVictorySummary(state);
  const archiveReport = archiveCompletionReportForState(state);
  return {
    day: state.day,
    difficulty: preset.label,
    hp: averageParty(state, 'hp'),
    hunger: averageParty(state, 'hunger'),
    bodyTemp: averageBodyTemp(state),
    ap: state.ap,
    camp: `불 ${state.camp.fireLevel} / 대피소 ${state.camp.shelterLevel} / 작업대 ${state.camp.workbenchLevel} / 기록실 ${state.camp.archiveRoomLevel || 0} / 필사대 ${state.camp.scribeDeskLevel || 0} / 서가 ${state.camp.libraryShelfLevel || 0}`,
    research: `${researchSummary(state).completed}/${TECH_TREE.length}`,
    objectives: `${victory.completed}/${victory.total}`,
    victory: victory.victory,
    perkPoints: Number(state.meta?.perkPoints || 0),
    weight: totalCarryWeight(state),
    insulation: partyInsulation(state),
    score: scoreState(state),
    archiveReport: archiveReport.recordSummary,
  };
}

export function getRunProgressReport(state) {
  const current = normalizeState(state);
  const victory = archiveVictorySummary(current);
  const research = researchSummary(current);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const stamina = averageParty(current, 'stamina');
  const bodyTemp = averageBodyTemp(current);
  const foodUnits = ['berry', 'meat', 'cooked_meat', 'jerky', 'herb_tonic']
    .reduce((sum, id) => sum + Number(current.inventory[id] || 0), 0);
  const fuel = Number(current.camp.fuel || 0);
  const weight = totalCarryWeight(current);
  const insulation = partyInsulation(current);
  const pendingObjectives = victory.rows.filter((row) => !row.done);
  const objectivePct = victory.total ? Math.round((victory.completed / victory.total) * 100) : 0;
  const daysLeft = Math.max(0, ARCHIVE_VICTORY_DAY - Number(current.day || 1));
  let riskScore = 0;
  if (hp < 55) riskScore += 3;
  else if (hp < 75) riskScore += 1;
  if (hunger > 70) riskScore += 3;
  else if (hunger > 45) riskScore += 1;
  if (stamina < 35) riskScore += 2;
  else if (stamina < 55) riskScore += 1;
  if (bodyTemp < 35.6 || bodyTemp > 38.5) riskScore += 2;
  if (foodUnits <= current.party.length) riskScore += 2;
  if (fuel <= 1 && current.weather.temp <= 8) riskScore += 2;
  if (current.ap <= 1 && pendingObjectives.length >= 3) riskScore += 1;

  const riskLevel = riskScore >= 7 ? '위험' : riskScore >= 4 ? '주의' : '안정';
  const riskTone = riskScore >= 7 ? 'danger' : riskScore >= 4 ? 'warning' : 'stable';
  const blockers = [];
  if (foodUnits <= current.party.length) blockers.push(`식량 ${foodUnits}개`);
  if (fuel <= 1) blockers.push(`연료 ${fuel}`);
  if (research.selected && !research.selected.completed) {
    blockers.push(`연구 ${research.selected.name} ${research.selected.progress}/${research.selected.cost}`);
  }
  if (weight >= 24) blockers.push(`무게 ${weight}`);
  if (insulation < Math.max(2, Math.ceil((12 - current.weather.temp) / 3))) blockers.push(`보온 ${insulation}`);

  const recommendations = [];
  if (hp < 65 || stamina < 45) recommendations.push('파티 회복을 위해 휴식 우선');
  if (foodUnits <= current.party.length + 1) recommendations.push('식량 확보를 위해 채집/사냥 우선');
  if (fuel <= 1 || bodyTemp < 36) recommendations.push('연료 확보 후 모닥불 유지');
  if (research.available && research.selected && !research.selected.completed) recommendations.push(`${research.selected.name} 연구 진행`);
  if (pendingObjectives.some((row) => row.id === 'facilities')) recommendations.push('기록 시설 제작 재료 확보');
  if (pendingObjectives.some((row) => row.id === 'books')) recommendations.push('책 제작 루트 점검');
  if (!recommendations.length) recommendations.push(victory.canComplete ? '아카이브 완성 가능' : '현재 운영 유지');

  return {
    objectivePct,
    objectiveLabel: `${victory.completed}/${victory.total}`,
    daysLeft,
    riskLevel,
    riskTone,
    riskScore,
    foodUnits,
    fuel,
    insulation,
    weight,
    pendingObjectives: pendingObjectives.map((row) => row.label),
    blockers: blockers.slice(0, 5),
    recommendations: [...new Set(recommendations)].slice(0, 4),
    headline: victory.victory
      ? '아카이브가 완성된 런입니다.'
      : victory.canComplete
        ? '목표 조건이 모두 충족됐습니다. 아카이브 완성을 누르세요.'
        : `${daysLeft}일 생존 목표까지 남았고, 현재 위험도는 ${riskLevel}입니다.`,
  };
}

function archiveReportStatus(done, victory, ended) {
  if (victory) return '완성';
  if (ended) return done ? '정산 완료' : '미완성';
  return done ? '완성 가능' : '진행 중';
}

export function archiveCompletionReportForState(state) {
  const current = normalizeState(state);
  const victory = archiveVictorySummary(current);
  const research = researchSummary(current);
  const objectives = archiveObjectiveRows(current);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const stamina = averageParty(current, 'stamina');
  const score = scoreState(current);
  const facilities = Number(current.camp.archiveRoomLevel || 0)
    + Number(current.camp.scribeDeskLevel || 0)
    + Number(current.camp.libraryShelfLevel || 0);
  const books = Number(current.inventory.book_craft_guide || 0) + Number(current.inventory.book_camp_manual || 0);
  const equipmentCount = equipmentInventoryRows(current).reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const objectivePct = victory.total ? Math.round((victory.completed / victory.total) * 100) : 0;
  const researchPct = research.total ? Math.round((research.completed / research.total) * 100) : 0;
  const survivalPct = Math.min(100, Math.round((Number(current.day || 1) / ARCHIVE_VICTORY_DAY) * 100));
  const stabilityPct = Math.round(clamp((hp * 0.45) + ((100 - hunger) * 0.25) + (stamina * 0.2) + Math.min(10, partyInsulation(current) * 2), 0, 100));
  const archiveScore = Math.round(clamp(
    objectivePct * 0.34
      + researchPct * 0.22
      + survivalPct * 0.18
      + stabilityPct * 0.14
      + Math.min(100, facilities * 30 + books * 5) * 0.08
      + Math.min(100, score / 28) * 0.04,
    0,
    100,
  ));
  const grade = archiveScore >= 95 ? 'S'
    : archiveScore >= 85 ? 'A'
      : archiveScore >= 70 ? 'B'
        : archiveScore >= 50 ? 'C'
          : 'D';
  const chapters = [
    {
      id: 'survival',
      title: '생존 기록',
      pct: survivalPct,
      status: archiveReportStatus(current.day >= ARCHIVE_VICTORY_DAY, victory.victory, current.ended),
      detail: `Day ${current.day}, 생존 파티 ${current.party.filter((member) => Number(member.hp || 0) > 0).length}/${current.party.length}, 평균 체온 ${averageBodyTemp(current).toFixed(1)}도입니다.`,
    },
    {
      id: 'research',
      title: '연구 기록',
      pct: researchPct,
      status: archiveReportStatus(research.completed >= research.total, victory.victory, current.ended),
      detail: `연구 ${research.completed}/${research.total}, 선택 기술 ${research.selected?.name || '없음'}입니다.`,
    },
    {
      id: 'facilities',
      title: '기록 시설',
      pct: Math.min(100, Math.round((facilities / 3) * 100)),
      status: archiveReportStatus(facilities >= 3, victory.victory, current.ended),
      detail: `기록실 Lv.${Number(current.camp.archiveRoomLevel || 0)}, 필사대 Lv.${Number(current.camp.scribeDeskLevel || 0)}, 서가 Lv.${Number(current.camp.libraryShelfLevel || 0)}입니다.`,
    },
    {
      id: 'books',
      title: '문자/책 보존',
      pct: Math.min(100, Math.round((books / 2) * 100)),
      status: archiveReportStatus(books >= 2, victory.victory, current.ended),
      detail: `제작 안내서 ${Number(current.inventory.book_craft_guide || 0)}권, 야영 매뉴얼 ${Number(current.inventory.book_camp_manual || 0)}권입니다.`,
    },
    {
      id: 'party',
      title: '파티와 장비',
      pct: stabilityPct,
      status: archiveReportStatus(stabilityPct >= 70, victory.victory, current.ended),
      detail: `평균 HP ${hp}, 허기 ${hunger}, 스태미나 ${stamina}, 보온 ${partyInsulation(current)}, 장비 ${equipmentCount}개입니다.`,
    },
  ];
  const handoff = [];
  if (!victory.victory && victory.canComplete) handoff.push('아카이브 완성을 눌러 완성 기록서를 확정하세요.');
  if (!victory.canComplete && !current.ended) {
    const pending = objectives.filter((row) => !row.done).map((row) => row.label);
    handoff.push(`남은 목표: ${pending.join(', ') || '없음'}`);
  }
  if (current.ended && !victory.victory) handoff.push('정산된 미완성 런입니다. 특전으로 다음 런을 강화하세요.');
  if (victory.victory) handoff.push('완성 런입니다. 전적 기록 후 새 런에서 특전을 이어받으세요.');
  if (Number(current.meta?.perkPoints || 0) > 0) handoff.push(`사용 가능 특전 ${Number(current.meta.perkPoints || 0)}pt가 있습니다.`);

  return {
    status: victory.victory ? 'complete' : current.ended ? 'settled' : victory.canComplete ? 'ready' : 'active',
    title: victory.victory ? '원시 아카이브 완성본' : victory.canComplete ? '완성 대기 기록서' : current.ended ? '탐험 정산 기록서' : '탐험 진행 기록서',
    grade,
    archiveScore,
    objectivePct,
    score,
    chapters,
    handoff: handoff.slice(0, 4),
    recordSummary: {
      day: current.day,
      grade,
      archiveScore,
      objectivePct,
      researchPct,
      survivalPct,
      stabilityPct,
      victory: victory.victory,
      score,
    },
  };
}

export function formatRequires(requires) {
  return Object.entries(requires).map(([id, qty]) => `${itemName(id)} ${qty}`).join(', ');
}

export function campFacilityRows(state) {
  const current = normalizeState(state);
  const facilities = [
    {
      id: 'archive_room',
      action: 'archive',
      name: '기록실',
      desc: `로그 저장량 ${BASE_LOG_LIMIT} -> ${BASE_LOG_LIMIT + ARCHIVE_LOG_LIMIT_BONUS}, 일일 연구 +1`,
      level: Number(current.camp.archiveRoomLevel || 0),
      maxLevel: 1,
      cost: { wood: 5, stone: 3, fiber: 3, hide: 1 },
      unlocked: hasTechCampUnlock(current, 'archive_room'),
      buildLabel: '기록실 짓기',
      maxedLabel: '기록실 완성',
      lockedLabel: '기록실 잠김 · 기록 보관 연구 필요',
    },
    {
      id: 'scribe_desk',
      action: 'scribe',
      name: '필사대',
      desc: '일일 연구 +1, 연구 행동 피로 -1',
      level: Number(current.camp.scribeDeskLevel || 0),
      maxLevel: 1,
      cost: { wood: 2, stone: 2, clay: 2, fiber: 2 },
      unlocked: hasTechCampUnlock(current, 'scribe_desk'),
      buildLabel: '필사대 만들기',
      maxedLabel: '필사대 완성',
      lockedLabel: '필사대 잠김 · 문자 연구 필요',
    },
    {
      id: 'library_shelf',
      action: 'library',
      name: '서가',
      desc: '일일 연구 +1, 책 보너스 강화, 기록 점수 증가',
      level: Number(current.camp.libraryShelfLevel || 0),
      maxLevel: 1,
      cost: { wood: 4, fiber: 4, resin: 2, clay: 2 },
      unlocked: hasTechCampUnlock(current, 'library_shelf'),
      buildLabel: '서가 세우기',
      maxedLabel: '서가 완성',
      lockedLabel: '서가 잠김 · 서가 정리 연구 필요',
    },
  ];
  return facilities.map((facility) => ({
    ...facility,
    maxed: facility.level >= facility.maxLevel,
    costText: formatRequires(facility.cost),
    buttonLabel: facility.level >= facility.maxLevel
      ? facility.maxedLabel
      : facility.unlocked
        ? `${facility.buildLabel} · ${formatRequires(facility.cost)}`
        : facility.lockedLabel,
  }));
}

export function formatGains(entries) {
  if (!entries.length) return '획득 없음';
  return entries.map(([id, qty]) => `${itemName(id)} +${qty}`).join(', ');
}

function rollZoneGains(entries, rng = Math.random) {
  return entries.reduce((gains, [id, qty, chance = 1]) => {
    if (rng() > chance) return gains;
    gains.push([id, qty + (rng() < 0.18 ? 1 : 0)]);
    return gains;
  }, []);
}

export function runGatherAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'gather', 0.5);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = rollZoneGains(zone.gather, options.rng || Math.random);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, gather: Number(next.counters.gather || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 채집 성공. ${zone.name}에서 ${formatGains(gains)}.`);
  } else {
    next = addLog(next, `${actor.name}의 채집 실패. ${zone.name}의 날씨와 지형이 좋지 않았습니다.`);
  }
  next = addDialogueLog(next, actorId, 'gather', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'gather', zoneId: zone.id, ok, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'gather', ok }), actorId, staminaCostWithEquipment(state, actorId, 'gather', 15), 3, options);
}

export function runHuntAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'hunt', 0.42);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = rollZoneGains(zone.hunt, options.rng || Math.random);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, hunt: Number(next.counters.hunt || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 사냥 성공. ${formatGains(gains)}.`);
  } else {
    const target = getActor(next, actorId);
    const damage = hasTechPassive(next, 'HUNT_RISK_DOWN') ? 7 : 11;
    next = updateActor(next, actorId, { hp: clamp(Number(target.hp || 0) - damage, 0, 100) });
    next = addLog(next, `${actor.name}의 사냥 실패. 반격으로 HP -${damage}.`);
  }
  next = addDialogueLog(next, actorId, 'hunt', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'hunt', zoneId: zone.id, ok, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'hunt', ok }), actorId, staminaCostWithEquipment(state, actorId, 'hunt', 24), 5, options);
}

export function runCraftAction(state, actorId, recipeId, options = {}) {
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const actor = getActor(state, actorId);
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK')) {
    return addLog(state, `${recipe.name}은(는) 문자 연구 후 제작할 수 있습니다.`);
  }
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_BONUS_UP')) {
    return addLog(state, `${recipe.name}은(는) 책 제작 연구 후 제작할 수 있습니다.`);
  }
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
    next = recordResearchEvent(next, { kind: 'recipe', recipeId: recipe.id, ok: true });
  } else {
    next = addLog(next, `${actor.name}의 제작 실패. 일부 재료를 잃었습니다.`);
  }
  next = addDialogueLog(next, actorId, 'craft', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'craft', ok, recipe, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'craft', ok }), actorId, staminaCostWithEquipment(state, actorId, 'craft', 20), 4, options);
}

export function runEatAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const foodId = ['cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .find((id) => ITEMS[id]?.type === 'food' && Number(state.inventory[id] || 0) > 0) || '';
  if (!foodId) return addLog(state, '먹을 음식이 없습니다. 채집이나 사냥으로 식량을 확보하세요.');
  const food = ITEMS[foodId];
  const nutrition = Number(food.nutrition || 0);
  const heal = Number(food.heal || 0);
  const warmth = foodId === 'cooked_meat' ? 1.1 : foodId === 'herb_tonic' ? 0.8 : 0;
  const target = getActor(state, actorId);
  let next = {
    ...state,
    inventory: spendResources(state.inventory, { [foodId]: 1 }),
    counters: { ...state.counters, meals: Number(state.counters.meals || 0) + 1 },
  };
  next = updateActor(next, actorId, {
    hunger: clamp(Number(target.hunger || 0) - nutrition, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
    bodyTemp: clamp(Number(target.bodyTemp ?? 37) + warmth, 25, 39),
  });
  next = addLog(next, `${actor.name}이(가) ${itemName(foodId)}을(를) 먹었습니다. 허기 -${nutrition}, HP +${heal}${warmth ? `, 체온 +${warmth.toFixed(1)}` : ''}.`);
  next = addDialogueLog(next, actorId, 'eat', 'success', options.rng || Math.random);
  return afterAction(next, actorId, staminaCostWithEquipment(state, actorId, 'eat', 6), 0, options);
}

export function runRestAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const target = getActor(state, actorId);
  const heal = hasTechPassive(state, 'REST_HEAL_UP') ? 8 : 4;
  const warmth = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 0.75 : 0.25;
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(target.stamina || 0) + 42 + Number(state.camp.shelterLevel || 0) * 8, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
    bodyTemp: clamp(Number(target.bodyTemp ?? 37) + warmth, 25, 39),
  });
  next = addLog(next, `${actor.name}이(가) 휴식했습니다. 스태미나와 HP를 회복하고 체온을 안정시켰습니다.`);
  next = addDialogueLog(next, actorId, 'rest', 'success', options.rng || Math.random);
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
  if (kind === 'archive') {
    if (!hasTechCampUnlock(next, 'archive_room')) return addLog(next, '기록실은 기록 보관 연구를 완료한 뒤 지을 수 있습니다.');
    if (Number(next.camp.archiveRoomLevel || 0) >= 1) return addLog(next, '기록실은 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 })) return addLog(next, '기록실 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 }),
      camp: { ...next.camp, archiveRoomLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 기록실을 세웠습니다. 로그 저장량과 일일 연구가 증가합니다.`);
  }
  if (kind === 'scribe') {
    if (!hasTechCampUnlock(next, 'scribe_desk')) return addLog(next, '필사대는 문자 연구를 완료한 뒤 만들 수 있습니다.');
    if (Number(next.camp.scribeDeskLevel || 0) >= 1) return addLog(next, '필사대는 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 })) return addLog(next, '필사대 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 }),
      camp: { ...next.camp, scribeDeskLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 필사대를 만들었습니다. 연구 행동과 일일 연구가 강화됩니다.`);
  }
  if (kind === 'library') {
    if (!hasTechCampUnlock(next, 'library_shelf')) return addLog(next, '서가는 서가 정리 연구를 완료한 뒤 세울 수 있습니다.');
    if (Number(next.camp.libraryShelfLevel || 0) >= 1) return addLog(next, '서가는 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 })) return addLog(next, '서가 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 }),
      camp: { ...next.camp, libraryShelfLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 서가를 세웠습니다. 책 보너스와 일일 연구가 강화됩니다.`);
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
  next = addDialogueLog(next, actorId, 'camp', 'success', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'camp', ok: true, rng: options.rng || Math.random });
  next.counters = { ...next.counters, camp: Number(next.counters.camp || 0) + 1 };
  const campStaminaCost = Math.max(5, staminaCostWithEquipment(state, actorId, 'camp', 14) - bookCampStaminaReduction(next));
  return afterAction(recordResearchEvent(next, { kind: 'camp', campKind: kind }), actorId, campStaminaCost, 2, options);
}

function livingParty(state) {
  return state.party.filter((member) => Number(member.hp || 0) > 0);
}

function foodAvailable(state) {
  return ['cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .some((id) => Number(state.inventory[id] || 0) > 0);
}

function pickActorForAuto(state, action = 'gather') {
  const candidates = livingParty(state);
  if (!candidates.length) return state.party[0]?.id || '';
  return candidates
    .map((member) => {
      const stamina = Number(member.stamina || 0);
      const hp = Number(member.hp || 0);
      const hungerSafety = 100 - Number(member.hunger || 0);
      return {
        id: member.id,
        score: actionChance(state, member.id, action, action === 'hunt' ? 0.42 : action === 'craft' ? 0.5 : 0.5) * 120
          + stamina * 0.28
          + hp * 0.16
          + hungerSafety * 0.1,
      };
    })
    .sort((a, b) => b.score - a.score)[0].id;
}

function pickAutoCareActor(state) {
  const candidates = livingParty(state);
  if (!candidates.length) return state.party[0]?.id || '';
  return candidates
    .map((member) => ({
      id: member.id,
      score: Number(member.hunger || 0) * 1.6
        + Math.max(0, 55 - Number(member.hp || 0)) * 1.25
        + Math.max(0, 45 - Number(member.stamina || 0))
        + Math.max(0, 35.2 - Number(member.bodyTemp ?? 37)) * 20,
    }))
    .sort((a, b) => b.score - a.score)[0].id;
}

function autoRecipeAllowed(state, recipe) {
  if (!recipe || !hasResources(state.inventory, recipe.requires)) return false;
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK')) return false;
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_BONUS_UP')) return false;
  return true;
}

function pickAutoRecipe(state) {
  const priority = [
    'jerky',
    'herb_tonic',
    'twine',
    'stone_axe',
    'bow',
    'flint_knife',
    'bone_pick',
    'spear',
    'sling',
    'atlatl',
    'leather_strip',
    'hide_coat',
    'hide_pants',
    'shoes_leather',
    'hat_fur',
    'gloves',
    'earmuffs',
    'socks',
    'arm_warmers',
    'leggings',
    'pauldron',
    'fur_coat',
    'fur_pants',
    'fur_hat',
    'fur_boots',
    'fur_earmuffs',
    'fur_socks',
    'fur_gloves',
    'charm',
    'hunter_talisman',
    'crafter_amulet',
    'gatherer_charm',
    'book_craft_guide',
    'book_camp_manual',
  ];
  return priority
    .map((id) => RECIPES.find((recipe) => recipe.id === id))
    .find((recipe) => autoRecipeAllowed(state, recipe)) || null;
}

function pickAutoCampKind(state) {
  if (Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 && hasResources(state.inventory, { meat: 1 })) return 'cook';
  if (Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) < 2 && hasResources(state.inventory, { wood: 1 })) return 'fuel';
  if (Number(state.camp.fireLevel || 0) < 1 && hasResources(state.inventory, { wood: 2, stone: 2 })) return 'fire';
  if (Number(state.camp.shelterLevel || 0) < 1 && hasResources(state.inventory, { wood: 3, fiber: 2, hide: 1 })) return 'shelter';
  if (Number(state.camp.workbenchLevel || 0) < 1 && hasResources(state.inventory, { wood: 4, stone: 2 })) return 'workbench';
  if (hasTechCampUnlock(state, 'archive_room') && Number(state.camp.archiveRoomLevel || 0) < 1 && hasResources(state.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 })) return 'archive';
  if (hasTechCampUnlock(state, 'scribe_desk') && Number(state.camp.scribeDeskLevel || 0) < 1 && hasResources(state.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 })) return 'scribe';
  if (hasTechCampUnlock(state, 'library_shelf') && Number(state.camp.libraryShelfLevel || 0) < 1 && hasResources(state.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 })) return 'library';
  if (Number(state.camp.fireLevel || 0) < 3 && hasResources(state.inventory, { wood: 2, stone: 2 })) return 'fire';
  if (Number(state.camp.shelterLevel || 0) < 3 && hasResources(state.inventory, { wood: 3, fiber: 2, hide: 1 })) return 'shelter';
  if (Number(state.camp.workbenchLevel || 0) < 2 && hasResources(state.inventory, { wood: 4, stone: 2 })) return 'workbench';
  return '';
}

function pickAutoZone(state, action) {
  if (action === 'hunt') {
    if (Number(state.inventory.meat || 0) < 2) return 'plains';
    if (Number(state.inventory.tooth || 0) < 1 || Number(state.inventory.sinew || 0) < 1) return 'forest';
    return 'cave';
  }
  if (Number(state.inventory.wood || 0) < 5 || Number(state.inventory.fiber || 0) < 5) return 'forest';
  if (Number(state.inventory.stone || 0) < 5 || Number(state.inventory.clay || 0) < 2 || Number(state.inventory.herb || 0) < 2) return 'river';
  if (Number(state.inventory.flint || 0) < 2 || Number(state.inventory.obsidian_shard || 0) < 1) return 'cave';
  return 'plains';
}

function autoActionSignature(state) {
  return [
    state.day,
    state.ap,
    state.log.length,
    averageParty(state, 'hp'),
    averageParty(state, 'hunger'),
    averageParty(state, 'stamina'),
    Object.entries(state.inventory).reduce((sum, [, qty]) => sum + Number(qty || 0), 0),
  ].join(':');
}

function runNextAutoArchiveAction(state, options = {}) {
  const careActorId = pickAutoCareActor(state);
  const careActor = getActor(state, careActorId);
  const averageHunger = averageParty(state, 'hunger');
  const foodStock = Number(state.inventory.meat || 0)
    + Number(state.inventory.berry || 0)
    + Number(state.inventory.jerky || 0)
    + Number(state.inventory.cooked_meat || 0);
  if (foodAvailable(state) && (Number(careActor?.hunger || 0) >= 52 || averageHunger >= 50)) {
    return runEatAction(state, careActorId, options);
  }
  if (!foodAvailable(state) && averageHunger >= 70 && Number(careActor?.hp || 0) > 20) {
    return runGatherAction(state, pickActorForAuto(state, 'gather'), 'forest', options);
  }
  if (Number(careActor?.hp || 0) <= 45 || Number(careActor?.stamina || 0) <= 28 || Number(careActor?.bodyTemp ?? 37) <= 34.4) {
    return runRestAction(state, careActorId, options);
  }

  if (averageHunger >= 55 && foodStock < state.party.length + 2) {
    if (averageParty(state, 'hp') < 55) {
      return runGatherAction(state, pickActorForAuto(state, 'gather'), 'forest', options);
    }
    return runHuntAction(state, pickActorForAuto(state, 'hunt'), pickAutoZone(state, 'hunt'), options);
  }

  const campKind = pickAutoCampKind(state);
  if (campKind) return runCampAction(state, pickActorForAuto(state, 'craft'), campKind, options);

  const recipe = pickAutoRecipe(state);
  if (recipe && (Number(state.counters?.craft || 0) < Number(state.counters?.gather || 0) + 2 || recipe.id.startsWith('book_'))) {
    return runCraftAction(state, pickActorForAuto(state, 'craft'), recipe.id, options);
  }

  const research = researchSummary(state);
  if (research.selected && !research.selected.completed && Number(state.day || 1) >= 2) {
    return runResearchAction(state, pickActorForAuto(state, 'craft'), options);
  }

  if (foodStock < state.party.length + 1) {
    return runHuntAction(state, pickActorForAuto(state, 'hunt'), pickAutoZone(state, 'hunt'), options);
  }
  return runGatherAction(state, pickActorForAuto(state, 'gather'), pickAutoZone(state, 'gather'), options);
}

export function runAutoDayAction(state, options = {}) {
  let next = normalizeState(state);
  const hasEquipmentPool = Object.entries(buildEquipmentPool(next))
    .some(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip');
  if (hasEquipmentPool) {
    next = autoEquipAction(next, Number(next.weather?.cold || 0) >= 5 ? 'weather' : 'role');
  }
  if (next.ended || Number(next.ap || 0) <= 0) return next;

  const startDay = next.day;
  let steps = 0;
  while (!next.ended && Number(next.ap || 0) > 0 && next.day === startDay && steps < 16) {
    const before = autoActionSignature(next);
    next = runNextAutoArchiveAction(next, options);
    steps += 1;
    if (autoActionSignature(next) === before) {
      next = runGatherAction(next, pickActorForAuto(next, 'gather'), pickAutoZone(next, 'gather'), options);
      steps += 1;
      if (autoActionSignature(next) === before) break;
    }
  }

  return addLog(next, `하루 자동 운영 완료: ${steps}회 행동 처리, Day ${next.day}, AP ${next.ap}/${next.apMax}.`);
}
