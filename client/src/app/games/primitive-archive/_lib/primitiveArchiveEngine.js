import {
  BASE_LOG_LIMIT,
  ARCHIVE_LOG_LIMIT_BONUS,
  ARCHIVE_VICTORY_DAY,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  STUDENTS,
  DIALOGUES,
  ZONES,
  WORLD_REGIONS,
  TRIBE_PROJECTS,
  SEASONS,
  ITEMS,
  RECIPES,
  TECH_TREE,
  TECH_TIER_DEFS,
  PERK_DEFS,
  WEATHER,
  DIFFICULTY_PRESETS,
  applyOwnedPerks,
  clamp,
  difficultyKey,
  difficultyPreset,
  emptyEquipmentSlots,
  initEquipmentForParty,
  initExplorationState,
  initMetaState,
  initProjectState,
  initResearchState,
  makeParty,
  normalizeEquipment,
  normalizeExplorationState,
  normalizeProjectState,
  normalizeResearch,
  difficultyRows,
  rollWeather,
  seasonForDay,
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
  WORLD_REGIONS,
  TRIBE_PROJECTS,
  SEASONS,
  ITEMS,
  RECIPES,
  TECH_TREE,
  TECH_TIER_DEFS,
  PERK_DEFS,
  WEATHER,
  DIFFICULTY_PRESETS,
  clamp,
  difficultyRows,
  initExplorationState,
  initProjectState,
  initResearchState,
  rollWeather,
  seasonForDay,
} from './primitiveArchiveData';

function perkLevel(meta, perkId) {
  return Math.max(0, Number(meta?.ownedPerks?.[perkId] || 0));
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const rng = options.rng || Math.random;
  const meta = initMetaState(options.meta);
  const difficulty = difficultyKey(options.difficulty);
  const preset = difficultyPreset(difficulty);
  const difficultyBrief = `난이도 ${preset.label} · AP ${preset.apMax} · 허기 ${Math.round(Number(preset.hungerMultiplier || 1) * 100)}% · 추위 ${Math.round(Number(preset.coldMultiplier || 1) * 100)}%`;
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
    eventChains: [],
    exploration: initExplorationState(),
    projects: initProjectState(),
    research: initResearchState(),
    meta,
    log: [`Day 1: ${difficultyBrief} 규칙으로 원시 지대에 도착했습니다. 파티의 첫 목표는 식량과 캠프 확보입니다.`],
    ended: false,
    victory: false,
  };
  return applyOwnedPerks(base, meta);
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const research = normalizeResearch(value.research);
  const exploration = normalizeExplorationState(value.exploration);
  const projects = normalizeProjectState(value.projects);
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
    eventChains: normalizeEventChains(value.eventChains || base.eventChains, Number(value.day || base.day || 1)),
    exploration,
    projects,
    research,
    meta,
    log: Array.isArray(value.log) ? value.log.slice(0, logCapacity({ ...base, ...value, camp })) : base.log,
    victory: Boolean(value.victory),
  };
}

export function getPartyCap(state) {
  const current = normalizeState(state);
  return 3
    + (hasTechPassive(current, 'PARTY_CAP_UP') ? 1 : 0)
    + (hasTechPassive(current, 'PARTY_CAP_UP_2') ? 1 : 0);
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
  return BASE_LOG_LIMIT
    + (Number(state?.camp?.archiveRoomLevel || 0) > 0 ? ARCHIVE_LOG_LIMIT_BONUS : 0)
    + (hasTechPassive(state, 'ARCHIVE_LOG_UP') ? 40 : 0)
    + (hasTechPassive(state, 'ARCHIVE_LOG_UP_2') ? 80 : 0);
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

const RESEARCH_CAMP_LABELS = {
  fire: '모닥불',
  shelter: '대피소',
  workbench: '작업대',
  archive_room: '기록실',
  scribe_desk: '필사대',
  library_shelf: '서가',
};

const RESEARCH_ACTION_LABELS = {
  gather: '채집',
  hunt: '사냥',
  craft: '제작',
  camp: '캠프',
  rest: '휴식',
  eat: '식사',
  research: '연구',
};

function recipeName(recipeId) {
  return RECIPES.find((recipe) => recipe.id === recipeId)?.name || recipeId;
}

function recipeUnlockTech(recipeId) {
  return TECH_TREE.find((tech) => (tech.unlocks?.recipes || []).includes(recipeId)) || null;
}

function canPrototypeRecipeForEureka(research, tech, recipeId) {
  const eureka = tech?.eureka || {};
  return eureka.type === 'recipeCraft'
    && eureka.recipeId === recipeId
    && prereqsMet(research, tech);
}

export function recipeUnlockInfo(state, recipeId) {
  const research = normalizeResearch(state?.research);
  const recipe = RECIPES.find((row) => row.id === recipeId) || null;
  if (!recipe) {
    return {
      recipe: null,
      unlocked: false,
      prototype: false,
      techId: '',
      techName: '',
      statusLabel: '알 수 없는 레시피',
      lockedReason: '선택한 제작 레시피를 찾을 수 없습니다.',
    };
  }

  const tech = recipeUnlockTech(recipe.id);
  if (!tech) {
    return {
      recipe,
      unlocked: true,
      prototype: false,
      techId: '',
      techName: '',
      statusLabel: '기본 제작',
      lockedReason: '',
    };
  }

  const completed = Boolean(research.completed?.[tech.id]);
  const prototype = !completed && canPrototypeRecipeForEureka(research, tech, recipe.id);
  const unlocked = completed || prototype;
  const missing = missingPrereqNames(research, tech);
  return {
    recipe,
    unlocked,
    prototype,
    techId: tech.id,
    techName: tech.name,
    statusLabel: completed ? `${tech.name} 완료` : prototype ? `${tech.name} 시제품` : `${tech.name} 필요`,
    lockedReason: unlocked
      ? ''
      : missing.length
        ? `${recipe.name}은(는) ${tech.name} 연구 계열 제작물입니다. 먼저 선행 연구 ${missing.join(', ')}을(를) 완료하세요.`
        : `${recipe.name}은(는) ${tech.name} 연구 완료 후 제작할 수 있습니다.`,
  };
}

export function recipeRows(state) {
  return RECIPES.map((recipe) => ({
    ...recipe,
    ...recipeUnlockInfo(state, recipe.id),
  }));
}

function passiveLabel(passiveId) {
  const labels = {
    GATHER_SUCCESS_UP: '채집 성공률',
    HUNT_SUCCESS_UP: '사냥 성공률',
    CRAFT_SUCCESS_UP: '제작 성공률',
    COOKING_RECOVERY_UP: '요리 회복',
    REST_HEAL_UP: '휴식 회복',
    RESEARCH_NOTE_UP: '일일 연구',
    HUNT_RISK_DOWN: '사냥 위험 감소',
    BOW_HUNT_UP: '활 사냥 보정',
    CAMP_SCORE_UP: '캠프 점수',
    PARTY_CAP_UP: '파티 정원',
    RESEARCH_POINT_BONUS: '연구 보너스',
    ARCHIVE_LOG_UP: '로그 저장량',
    BOOK_SYSTEM_UNLOCK: '책 시스템',
    BOOK_BONUS_UP: '책 보너스',
    RESEARCH_POINT_BONUS_2: '상위 연구 보너스',
    STORAGE_RATIONS_UP: '보존식 효율',
    ADVANCED_CRAFT_UP: '정밀 제작',
    OBSIDIAN_HUNT_UP: '흑요석 사냥',
    MEGAFAUNA_RISK_DOWN: '대형 사냥 위험 감소',
    TABLET_RESEARCH_UP: '기록판 연구',
    WEATHER_LORE_UP: '날씨 해석',
    CAMP_FUEL_SAVER: '연료 절약',
    COOKING_RECOVERY_UP_2: '화덕 조리 보너스',
    ZONE_SELECTION: '행동 구역 선택',
    WEATHER_FORECAST_UP: '날씨 예측',
    ADVANCED_CRAFT_UP_2: '상위 정밀 제작',
    MYSTIC_RECOVERY_UP: '의식 회복',
    HUNT_RISK_DOWN_2: '사냥 위험 추가 감소',
    STATE_RESEARCH_UP: '조직 연구',
    PARTY_CAP_UP_2: '파티 정원 추가',
    REST_HEAL_UP_2: '휴식 회복 추가',
    RESOURCE_YIELD_UP: '행동 수익 증가',
    ARCHIVE_LOG_UP_2: '역사 로그 확장',
    RESEARCH_POINT_BONUS_3: '수학 연구 보너스',
    EUREKA_BONUS_UP: '유레카 보너스 강화',
    CAMP_ACTION_STAMINA_DOWN: '캠프 행동 피로 감소',
    WEATHER_DAMAGE_DOWN: '날씨 피해 감소',
    RARE_YIELD_UP: '희귀 자원 발견',
    HUNT_RISK_DOWN_3: '사냥 위험 대폭 감소',
    WEATHER_LORE_UP_2: '천문 기후 보정',
    RARE_YIELD_UP_2: '희귀 자원 정밀 발견',
    FORECAST_DETAIL_UP: '기대수익 정밀도',
    HUNT_SUCCESS_UP_2: '사냥 성공률 추가',
    WEATHER_DAMAGE_DOWN_2: '날씨 피해 추가 감소',
    CAMP_SCORE_UP_2: '캠프 점수 추가',
    RIVER_YIELD_UP: '강가 수익 증가',
    RIVER_YIELD_UP_2: '강가 수익 추가 증가',
    SHIPBUILDING_RIVER_UP: '조선 강가 수익 증가',
    PLANT_YIELD_UP: '식물 자원 수익 증가',
    PLANT_YIELD_UP_2: '식물 자원 수익 추가 증가',
    ANIMAL_YIELD_UP: '동물 자원 수익 증가',
    MINERAL_YIELD_UP: '광물 발견 증가',
    ADVANCED_CRAFT_UP_3: '금속 정밀 제작',
    RESEARCH_POINT_BONUS_4: '고전 연구 보너스',
    INSPIRATION_BONUS_UP: '영감 보너스 강화',
    DRAMA_SCORE_UP: '드라마 기록 점수',
    ART_SCORE_UP: '미술 기록 점수',
    REST_HEAL_UP_3: '음악 휴식 회복',
    HUNT_SUCCESS_UP_3: '기마 사냥 성공률',
    IRON_CRAFT_UP: '철제 제작 성공률',
    RESOURCE_YIELD_UP_2: '화폐 자원 수익 증가',
  };
  return labels[passiveId] || passiveId.replaceAll('_', ' ');
}

function researchUnlockGroups(tech) {
  const unlocks = tech?.unlocks || {};
  const recipes = (unlocks.recipes || []).map(recipeName);
  const items = (unlocks.items || []).map(itemName);
  const camps = (unlocks.camp || []).map((campId) => RESEARCH_CAMP_LABELS[campId] || campId);
  const passives = (unlocks.passives || []).map(passiveLabel);
  return {
    recipes,
    items,
    camps,
    passives,
    unlockText: [
      recipes.length ? `제작 ${recipes.join(', ')}` : '',
      items.length ? `아이템 ${items.join(', ')}` : '',
      camps.length ? `시설 ${camps.join(', ')}` : '',
      passives.length ? `효과 ${passives.join(', ')}` : '',
    ].filter(Boolean).join(' · ') || '기본 연구 보너스',
  };
}

function availableTechNames(research, excludeTechId = '') {
  return TECH_TREE
    .filter((row) => row.id !== excludeTechId && !research.completed?.[row.id] && prereqsMet(research, row))
    .sort((a, b) => Number(a.tier || 1) - Number(b.tier || 1) || a.cost - b.cost)
    .map((row) => row.name);
}

function missingPrereqMessage(research, tech) {
  const missing = missingPrereqNames(research, tech);
  const available = availableTechNames(research, tech?.id);
  const nextStep = available.length
    ? ` 지금 진행 가능한 연구는 ${available.slice(0, 3).join(', ')}입니다.`
    : ' 현재 바로 진행 가능한 다른 연구가 없습니다. 완료한 연구와 목표 선택을 다시 확인하세요.';
  const eurekaNote = tech?.eureka
    ? ` 유레카(${tech.eureka.desc})는 연구 비용을 줄이는 단서이며, 선행 연구가 끝나야 적용됩니다.`
    : '';
  return `${tech.name} 연구는 아직 잠겨 있습니다. 먼저 필요한 선행 연구: ${missing.join(', ')}.${eurekaNote}${nextStep}`;
}

const RESEARCH_SYSTEM_REQUIREMENTS = [
  { id: 'fire', label: '모닥불 Lv.1', key: 'fireLevel', target: 1 },
  { id: 'shelter', label: '대피소 Lv.1', key: 'shelterLevel', target: 1 },
  { id: 'workbench', label: '작업대 Lv.1', key: 'workbenchLevel', target: 1 },
];

const RESEARCH_ACTION_TECH_IDS = [
  'GATHERING',
  'HUNTING',
];

export function researchSystemStatus(state) {
  const research = normalizeResearch(state?.research);
  const gateRows = RESEARCH_SYSTEM_REQUIREMENTS.map((requirement) => {
    const current = Math.max(0, Number(state?.camp?.[requirement.key] || 0));
    return {
      ...requirement,
      current,
      done: current >= requirement.target,
    };
  });
  const actionGateRows = RESEARCH_ACTION_TECH_IDS.map((techId) => {
    const tech = getTech(techId);
    return {
      id: techId,
      label: tech?.name || techId,
      done: Boolean(research.completed?.[techId]),
    };
  });
  const unlocked = gateRows.every((row) => row.done);
  const actionUnlocked = unlocked && actionGateRows.every((row) => row.done);
  const completed = gateRows.filter((row) => row.done).length;
  const actionCompleted = actionGateRows.filter((row) => row.done).length;
  return {
    unlocked,
    actionUnlocked,
    completed,
    total: gateRows.length,
    actionCompleted,
    actionTotal: actionGateRows.length,
    gateRows,
    actionGateRows,
    headline: unlocked ? '부족 연구 체계가 활성화되었습니다.' : `부족 발전 ${completed}/${gateRows.length}`,
    reason: unlocked
      ? '기술을 지정하면 매 행동 턴과 하루 시작에 연구 포인트가 누적됩니다.'
      : `연구 시작 조건: ${gateRows.filter((row) => !row.done).map((row) => row.label).join(', ')}`,
    actionReason: actionUnlocked
      ? '수동 연구 행동을 사용할 수 있습니다.'
      : `T1 기초 연구 완료 시 직접 연구 해금 ${actionCompleted}/${actionGateRows.length}: ${actionGateRows.filter((row) => !row.done).map((row) => row.label).join(', ') || '완료'}`,
  };
}

function breakthroughStatusForTech(state, tech, kind) {
  const trigger = tech?.[kind];
  const kindLabel = kind === 'inspiration' ? '영감' : '유레카';
  if (!trigger) {
    return {
      current: 0,
      target: 0,
      done: false,
      blocked: false,
      statusLabel: `${kindLabel} 없음`,
      note: `이 기술은 별도 ${kindLabel} 조건이 없습니다.`,
      missingPrereqs: [],
    };
  }
  const research = normalizeResearch(state.research);
  const progress = researchTriggerProgress({ ...state, research }, trigger);
  const missingPrereqs = missingPrereqNames(research, tech);
  const completed = Boolean(research.completed?.[tech.id]);
  const breakthroughDone = Boolean(research[kind]?.[tech.id]);
  const blocked = progress.done && !completed && missingPrereqs.length > 0;
  let statusLabel = '진행 중';
  if (completed) statusLabel = '연구 완료';
  else if (breakthroughDone) statusLabel = `${kindLabel} 적용`;
  else if (blocked) statusLabel = '단서 확보 · 선행 연구 필요';
  else if (progress.done) statusLabel = '적용 대기';
  const note = blocked
    ? `조건은 충족했지만 ${missingPrereqs.join(', ')} 연구 완료 후 ${kindLabel} 보너스가 적용됩니다.`
    : trigger.desc || '';
  return {
    ...progress,
    blocked,
    statusLabel,
    note,
    missingPrereqs,
  };
}

function eurekaStatusForTech(state, tech) {
  return breakthroughStatusForTech(state, tech, 'eureka');
}

function inspirationStatusForTech(state, tech) {
  return breakthroughStatusForTech(state, tech, 'inspiration');
}

function nextAvailableTech(research) {
  return TECH_TREE
    .filter((tech) => !research.completed?.[tech.id] && prereqsMet(research, tech))
    .sort((a, b) => Number(a.tier || 1) - Number(b.tier || 1) || a.cost - b.cost)[0] || null;
}

function hasTechPassive(state, passiveId) {
  const research = normalizeResearch(state.research);
  return TECH_TREE.some((tech) => research.completed?.[tech.id] && (tech.unlocks?.passives || []).includes(passiveId));
}

function getProject(projectId) {
  return TRIBE_PROJECTS.find((project) => project.id === projectId) || null;
}

export function hasCompletedProject(state, projectId) {
  return Boolean(normalizeProjectState(state?.projects).completed?.[projectId]);
}

function projectPrereqsMet(state, project) {
  const research = normalizeResearch(state?.research);
  return (project?.prereqs || []).every((techId) => Boolean(research.completed?.[techId]));
}

function nextAvailableProjectId(state, completed = normalizeProjectState(state?.projects).completed) {
  return TRIBE_PROJECTS.find((project) => !completed?.[project.id] && projectPrereqsMet(state, project))?.id || '';
}

export function projectRows(state) {
  const current = normalizeState(state);
  const projects = normalizeProjectState(current.projects);
  return TRIBE_PROJECTS.map((project) => {
    const completed = Boolean(projects.completed?.[project.id]);
    const progress = Math.min(project.work, Math.max(0, Number(projects.progress?.[project.id] || 0)));
    const committed = Boolean(projects.resourceCommitted?.[project.id]);
    const missingPrereqs = (project.prereqs || [])
      .filter((techId) => !current.research.completed?.[techId])
      .map((techId) => getTech(techId)?.name || techId);
    const available = !completed && missingPrereqs.length === 0;
    const hasCost = committed || hasResources(current.inventory, project.cost || {});
    return {
      ...project,
      completed,
      progress,
      progressPct: Math.round((progress / Math.max(1, project.work)) * 100),
      committed,
      selected: projects.selectedProjectId === project.id,
      available,
      hasCost,
      canWork: available && hasCost,
      missingPrereqs,
      costText: formatRequires(project.cost || {}),
      statusLabel: completed
        ? '완성'
        : committed
          ? '건설 중'
          : available
            ? hasCost ? '착수 가능' : '재료 부족'
            : '기술 잠김',
    };
  });
}

export function selectProjectAction(state, projectId) {
  const current = normalizeState(state);
  const row = projectRows(current).find((project) => project.id === projectId);
  if (!row) return current;
  if (row.completed) return addLog(current, `${row.name}은(는) 이미 완성된 프로젝트입니다.`);
  if (!row.available) return addLog(current, `${row.name} 착수에 필요한 기술: ${row.missingPrereqs.join(', ') || '없음'}.`);
  return addLog({
    ...current,
    projects: { ...current.projects, selectedProjectId: row.id },
  }, `부족 프로젝트 목표를 ${row.name}(으)로 지정했습니다.`);
}

export function projectActionEstimate(state, actorId, projectId = '') {
  const current = normalizeState(state);
  const actor = getActor(current, actorId);
  const project = getProject(projectId || current.projects.selectedProjectId);
  const campSkill = Number(actor?.stats?.camp || 5);
  const work = clamp(1 + Math.floor(campSkill / 5) + Number(current.camp.workbenchLevel || 0), 1, 4);
  const staminaCost = Math.max(6, 18 - Math.floor(campSkill / 2) - Number(current.camp.workbenchLevel || 0) * 2);
  return {
    project,
    work,
    staminaCost,
  };
}

export function runProjectAction(state, actorId, projectId = '', options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '프로젝트 작업에 사용할 행동력이 부족합니다.');
  const targetId = projectId || current.projects.selectedProjectId || nextAvailableProjectId(current);
  const row = projectRows(current).find((project) => project.id === targetId);
  if (!row) return addLog(current, '진행할 부족 프로젝트가 없습니다.');
  if (row.completed) return addLog(current, `${row.name}은(는) 이미 완성됐습니다.`);
  if (!row.available) return addLog(current, `${row.name} 착수에 필요한 기술: ${row.missingPrereqs.join(', ') || '없음'}.`);
  if (!row.committed && !hasResources(current.inventory, row.cost || {})) {
    return addLog(current, `${row.name} 착수 재료가 부족합니다. 필요: ${row.costText}.`);
  }

  const actor = getActor(current, actorId);
  const estimate = projectActionEstimate(current, actorId, row.id);
  const projectState = normalizeProjectState(current.projects);
  let next = {
    ...current,
    inventory: row.committed ? { ...current.inventory } : spendResources(current.inventory, row.cost || {}),
    projects: {
      ...projectState,
      selectedProjectId: row.id,
      resourceCommitted: { ...projectState.resourceCommitted, [row.id]: true },
      progress: {
        ...projectState.progress,
        [row.id]: Math.min(row.work, Number(projectState.progress?.[row.id] || 0) + estimate.work),
      },
    },
    counters: { ...current.counters, camp: Number(current.counters?.camp || 0) + 1 },
  };
  const progress = Number(next.projects.progress?.[row.id] || 0);
  if (!row.committed) next = addLog(next, `${row.name} 착수. ${row.costText}을(를) 공동 자재로 투입했습니다.`);
  next = addLog(next, `${actor.name}의 프로젝트 작업: ${row.name} +${estimate.work} (${progress}/${row.work}).`);

  if (progress >= row.work) {
    const completed = { ...next.projects.completed, [row.id]: true };
    const rewardEntries = Object.entries(row.reward || {});
    next = {
      ...next,
      inventory: addItems(next.inventory, rewardEntries),
      projects: {
        ...next.projects,
        completed,
        selectedProjectId: nextAvailableProjectId(next, completed),
        lastCompletedId: row.id,
        completionSerial: Number(next.projects.completionSerial || 0) + 1,
      },
    };
    next = addLog(next, `부족 프로젝트 완성: ${row.name}. ${row.effectText}${rewardEntries.length ? ` · ${formatGains(rewardEntries)}` : ''}.`);
  }

  next = recordResearchEvent(next, { kind: 'camp', campKind: 'project' });
  return afterAction(next, actorId, estimate.staminaCost, 3, options);
}

export function canSelectActionZone(state) {
  return hasTechPassive(state, 'ZONE_SELECTION');
}

function getRegion(regionId) {
  return WORLD_REGIONS.find((region) => region.id === regionId) || null;
}

export function regionRows(state) {
  const current = normalizeState(state);
  const exploration = normalizeExplorationState(current.exploration);
  const selectionUnlocked = canSelectActionZone(current);
  return WORLD_REGIONS.map((region) => {
    const zone = ZONES.find((row) => row.id === region.zoneId) || ZONES[0];
    const revealed = Boolean(exploration.revealed?.[region.id]);
    return {
      ...region,
      zone,
      zoneName: zone.name,
      revealed,
      visits: Number(exploration.visits?.[region.id] || 0),
      selected: exploration.selectedRegionId === region.id,
      selectable: selectionUnlocked && revealed && !region.safe,
      recentlyDiscovered: exploration.lastDiscoveredId === region.id && Number(exploration.discoverySerial || 0) > 0,
      dangerLabel: region.danger <= 1 ? '안전' : region.danger <= 3 ? '주의' : '위험',
      yieldPct: Math.round(Number(region.yieldBonus || 0) * 100),
      rarePct: Math.round(Number(region.rareBonus || 0) * 100),
    };
  });
}

export function explorationSummary(state) {
  const rows = regionRows(state);
  const revealedRows = rows.filter((region) => region.revealed);
  const selected = rows.find((region) => region.selected && region.revealed && !region.safe)
    || revealedRows.find((region) => !region.safe)
    || rows[0];
  return {
    rows,
    selected,
    revealed: revealedRows.length,
    total: rows.length,
    frontier: rows.filter((region) => !region.revealed && region.neighbors.some((neighborId) => rows.find((row) => row.id === neighborId)?.revealed)).length,
    selectionUnlocked: canSelectActionZone(state),
    label: `${revealedRows.length}/${rows.length} 지역 발견`,
  };
}

export function selectRegionAction(state, regionId) {
  const current = normalizeState(state);
  if (!canSelectActionZone(current)) return addLog(current, '지도 제작 연구를 완료하면 행동 지역을 지정할 수 있습니다.');
  const region = regionRows(current).find((row) => row.id === regionId);
  if (!region?.revealed || region.safe) return addLog(current, '아직 행동 지역으로 지정할 수 없는 곳입니다.');
  return addLog({
    ...current,
    exploration: { ...current.exploration, selectedRegionId: region.id },
  }, `행동 지역을 ${region.name}(으)로 지정했습니다.`);
}

export function civilizationMilestoneRows(state) {
  const current = normalizeState(state);
  const season = seasonForDay(current.day);
  const eraOrder = ['PRIMITIVE', 'NEOLITHIC', 'ANCIENT', 'CLASSICAL'];
  const eraLabels = { PRIMITIVE: '원시', NEOLITHIC: '신석기', ANCIENT: '고대', CLASSICAL: '고전' };
  const completedEras = TECH_TREE
    .filter((tech) => current.research.completed?.[tech.id])
    .map((tech) => tech.era);
  const eraId = eraOrder.reduce((latest, era) => (completedEras.includes(era) ? era : latest), 'PRIMITIVE');
  const selectedTech = getTech(current.research.selectedTechId);
  const researchProgress = Number(current.research.progress?.[selectedTech?.id] || 0);
  const projects = projectRows(current);
  const selectedProject = projects.find((project) => project.selected && !project.completed)
    || projects.find((project) => project.available && !project.completed);
  const exploration = explorationSummary(current);
  return {
    season,
    eraId,
    eraLabel: eraLabels[eraId] || eraId,
    rows: [
      {
        id: 'season', action: 'season', label: `${season.name} ${season.dayInSeason}/${season.length}일`,
        value: season.daysRemaining ? `${season.daysRemaining}일 후 계절 전환` : '다음 날 계절 전환', detail: season.note,
      },
      {
        id: 'research', action: 'research', label: selectedTech?.name || '연구 목표 없음',
        value: selectedTech ? `${Math.max(0, Number(selectedTech.cost || 0) - researchProgress)} RP 남음` : '목표를 지정하세요',
        detail: selectedTech ? `현재 ${researchProgress}/${selectedTech.cost}` : '부족 발전 후 연구가 해금됩니다.',
      },
      {
        id: 'project', action: 'project', label: selectedProject?.name || '다음 부족 프로젝트',
        value: selectedProject ? `${Math.max(0, selectedProject.work - selectedProject.progress)} 작업 남음` : '진행 가능한 사업 없음',
        detail: selectedProject?.effectText || '연구를 진행해 새 공동 사업을 해금하세요.',
      },
      {
        id: 'exploration', action: 'discover', label: '세계 탐사', value: exploration.label,
        detail: exploration.frontier ? `인접한 미탐사 지역 ${exploration.frontier}곳` : '현재 확인 가능한 경계를 모두 조사했습니다.',
      },
    ],
  };
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
  const books = Number(state.inventory?.book_craft_guide || 0) + Number(state.inventory?.book_camp_manual || 0);
  const tablets = hasTechPassive(state, 'TABLET_RESEARCH_UP') ? Number(state.inventory?.clay_tablet || 0) : 0;
  return Math.min(4, books + tablets);
}

function completeTechIfReady(state, techId) {
  const research = normalizeResearch(state.research);
  const tech = getTech(techId);
  if (!tech || research.completed[tech.id]) return state;
  const progress = Number(research.progress[tech.id] || 0);
  if (progress < tech.cost) return state;
  const actionWasUnlocked = researchSystemStatus(state).actionUnlocked;
  const nextResearch = {
    ...research,
    progress: { ...research.progress, [tech.id]: tech.cost },
    completed: { ...research.completed, [tech.id]: true },
    lastCompletedTechId: tech.id,
    completionSerial: Number(research.completionSerial || 0) + 1,
  };
  if (nextResearch.selectedTechId === tech.id) {
    nextResearch.selectedTechId = nextAvailableTech(nextResearch)?.id || tech.id;
  }
  let next = addLog({ ...state, research: nextResearch }, `연구 완료: ${tech.name}`);
  if (!actionWasUnlocked && researchSystemStatus(next).actionUnlocked) {
    next = addLog(next, '연구 행동 해금: 기초 학문과 건설 기술이 갖춰져 이제 부족원이 직접 연구할 수 있습니다.');
  }
  return applyResearchBreakthroughs(next);
}

function addResearchProgress(state, techId, points, source = '연구', options = {}) {
  if (!researchSystemStatus(state).unlocked) return state;
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
  const withLog = options.silent
    ? next
    : addLog(next, `${source}: ${tech.name} +${Math.max(0, Math.floor(points))}RP (${progress}/${tech.cost})`);
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

function applyResearchBreakthrough(state, kind) {
  const status = researchSystemStatus(state);
  if (!status.unlocked) return state;
  const kindLabel = kind === 'inspiration' ? '영감' : '유레카';
  let next = { ...state, research: normalizeResearch(state.research) };
  for (const tech of TECH_TREE) {
    const trigger = tech[kind];
    if (!trigger || next.research[kind]?.[tech.id] || next.research.completed[tech.id]) continue;
    if (!researchTriggerProgress(next, trigger).done) continue;
    if (!prereqsMet(next.research, tech)) continue;
    const eurekaMultiplier = kind === 'eureka' && hasTechPassive(next, 'EUREKA_BONUS_UP') ? 1.2 : 1;
    const inspirationMultiplier = kind === 'inspiration' && hasTechPassive(next, 'INSPIRATION_BONUS_UP') ? 1.25 : 1;
    const bonus = Math.ceil(tech.cost * Number(trigger.bonusPct || 0) * eurekaMultiplier * inspirationMultiplier);
    next = {
      ...next,
      research: {
        ...next.research,
        [kind]: { ...next.research[kind], [tech.id]: true },
      },
    };
    next = addLog(next, `${kindLabel}: ${tech.name} (${trigger.desc})`);
    next = addResearchProgress(next, tech.id, bonus, kindLabel);
  }
  return next;
}

function applyResearchBreakthroughs(state) {
  return applyResearchBreakthrough(applyResearchBreakthrough(state, 'eureka'), 'inspiration');
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
  return applyResearchBreakthroughs({ ...state, research: { ...research, counters } });
}

function autoResearchForDay(state) {
  if (!researchSystemStatus(state).unlocked) return state;
  const research = normalizeResearch(state.research);
  const techId = research.selectedTechId || nextAvailableTech(research)?.id;
  if (!techId) return state;
  const points = clamp(
    2
    + Number(state.camp.workbenchLevel || 0)
    + Number(state.camp.archiveRoomLevel || 0)
    + Number(state.camp.scribeDeskLevel || 0)
    + Number(state.camp.libraryShelfLevel || 0)
    + (hasTechPassive(state, 'RESEARCH_NOTE_UP') ? 1 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS') ? 1 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_2') ? 1 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_3') ? 2 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_4') ? 2 : 0)
    + (hasTechPassive(state, 'STATE_RESEARCH_UP') ? 1 : 0)
    + (hasCompletedProject(state, 'council-fire') ? 1 : 0)
    + bookResearchBonus(state),
    2,
    14
  );
  return addResearchProgress({ ...state, research }, techId, points, '일일 연구');
}

function autoResearchForTurn(state) {
  if (!researchSystemStatus(state).unlocked) return state;
  const research = normalizeResearch(state.research);
  const techId = research.selectedTechId || nextAvailableTech(research)?.id;
  if (!techId) return state;
  const points = 1
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_4') ? 1 : 0)
    + (hasCompletedProject(state, 'council-fire') ? 1 : 0);
  return addResearchProgress({ ...state, research }, techId, points, '턴 연구', { silent: true });
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

const RARE_RESOURCE_IDS = ['obsidian_shard', 'dino_hide', 'dino_bone', 'mutant_gland', 'rune_shard'];

const EVENT_CHAIN_TTL_DAYS = 3;
const EVENT_CHAIN_DEFS = {
  obsidian_vein: {
    title: '흑요석 광맥 추적',
    detail: '동굴 벽면에서 이어지는 검은 광맥 흔적입니다. 바로 따라가면 흑요석을 안정적으로 회수할 수 있습니다.',
    action: 'gather',
    actionLabel: '광맥 회수',
    costText: 'AP 1 · 채집',
    rewardText: '흑요석/부싯돌',
    rewards: [['obsidian_shard', 2], ['flint', 1]],
    baseChance: 0.5,
    staminaCost: 13,
    hungerAdd: 3,
    failDamage: 4,
    failStamina: 8,
  },
  megafauna_tracks: {
    title: '거대동물 이동로 추적',
    detail: '초원에 남은 큰 발자국이 한 방향으로 이어집니다. 추적에 성공하면 가죽과 뼈를 크게 확보합니다.',
    action: 'hunt',
    actionLabel: '이동로 매복',
    costText: 'AP 1 · 사냥',
    rewardText: '공룡 가죽/뼈',
    rewards: [['dino_hide', 1], ['dino_bone', 2], ['meat', 2]],
    baseChance: 0.43,
    staminaCost: 20,
    hungerAdd: 5,
    failDamage: 11,
    failStamina: 11,
  },
  rune_cache: {
    title: '룬 조각 은닉처',
    detail: '빛나는 파편이 일정한 간격으로 묻혀 있습니다. 조심스럽게 회수하면 연구와 기록 점수가 크게 오릅니다.',
    action: 'gather',
    actionLabel: '은닉처 회수',
    costText: 'AP 1 · 정밀 채집',
    rewardText: '룬/점토/수지',
    rewards: [['rune_shard', 1], ['clay', 1], ['resin', 1]],
    baseChance: 0.46,
    staminaCost: 14,
    hungerAdd: 4,
    failDamage: 5,
    failStamina: 9,
  },
  mutant_nest: {
    title: '돌연변이 둥지 소탕',
    detail: '동굴 안쪽에서 이상한 체액과 뼛조각이 이어집니다. 위험하지만 점액과 이빨을 대량 확보할 수 있습니다.',
    action: 'hunt',
    actionLabel: '둥지 소탕',
    costText: 'AP 1 · 위험 사냥',
    rewardText: '점액/이빨/뼈',
    rewards: [['mutant_gland', 1], ['tooth', 2], ['bone', 2]],
    baseChance: 0.4,
    staminaCost: 22,
    hungerAdd: 5,
    failDamage: 13,
    failStamina: 12,
  },
};

function normalizeEventChains(chains, currentDay = 1) {
  const day = Math.max(1, Number(currentDay || 1));
  return (Array.isArray(chains) ? chains : [])
    .map((chain, index) => {
      const kind = String(chain?.kind || '');
      const def = EVENT_CHAIN_DEFS[kind];
      if (!def) return null;
      const startedDay = Math.max(1, Number(chain?.startedDay || day));
      return {
        id: String(chain?.id || `event-chain-${kind}-${startedDay}-${index}`),
        kind,
        zoneId: String(chain?.zoneId || ''),
        source: String(chain?.source || ''),
        startedDay,
        expiresDay: Math.max(startedDay, Number(chain?.expiresDay || startedDay + EVENT_CHAIN_TTL_DAYS)),
        resolved: Boolean(chain?.resolved),
        resolvedDay: Number(chain?.resolvedDay || 0),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function activeEventChains(state) {
  const currentDay = Math.max(1, Number(state?.day || 1));
  return normalizeEventChains(state?.eventChains, currentDay)
    .filter((chain) => !chain.resolved && Number(chain.expiresDay || 0) >= currentDay);
}

function eventChainKindFromRewards(rewards, action = '', zoneId = '') {
  const ids = new Set((Array.isArray(rewards) ? rewards : []).map(([id]) => String(id || '')));
  if (ids.has('rune_shard')) return 'rune_cache';
  if (ids.has('mutant_gland')) return 'mutant_nest';
  if (ids.has('dino_hide') || ids.has('dino_bone')) return 'megafauna_tracks';
  if (ids.has('obsidian_shard')) return 'obsidian_vein';
  if (String(zoneId) === 'plains' && action === 'hunt') return 'megafauna_tracks';
  if (String(zoneId) === 'cave' && action === 'gather') return 'obsidian_vein';
  return '';
}

function openEventChain(state, kind, params = {}) {
  const def = EVENT_CHAIN_DEFS[kind];
  if (!def) return { state, added: false, chain: null };
  const day = Math.max(1, Number(state?.day || 1));
  const chains = normalizeEventChains(state?.eventChains, day);
  const zoneId = String(params.zoneId || '');
  const existing = chains.find((chain) => (
    !chain.resolved
    && chain.kind === kind
    && String(chain.zoneId || '') === zoneId
    && Number(chain.expiresDay || 0) >= day
  ));
  if (existing) return { state: { ...state, eventChains: chains }, added: false, chain: existing };

  const chain = {
    id: `event-chain-${kind}-${zoneId || 'field'}-${day}-${chains.length}`,
    kind,
    zoneId,
    source: String(params.source || ''),
    startedDay: day,
    expiresDay: day + EVENT_CHAIN_TTL_DAYS,
    resolved: false,
    resolvedDay: 0,
  };
  return {
    state: { ...state, eventChains: [chain, ...chains].slice(0, 12) },
    added: true,
    chain,
  };
}

function openEventChainFromRewards(state, rewards, context = {}) {
  const kind = eventChainKindFromRewards(rewards, context.action, context.zoneId);
  if (!kind) return { state, text: '' };
  const opened = openEventChain(state, kind, { zoneId: context.zoneId, source: context.action });
  const def = EVENT_CHAIN_DEFS[kind];
  return {
    state: opened.state,
    text: opened.added && def ? ` 이어지는 단서: ${def.title}.` : '',
  };
}

function resolveEventChain(state, chainId, ok) {
  const day = Math.max(1, Number(state?.day || 1));
  return {
    ...state,
    eventChains: normalizeEventChains(state?.eventChains, day).map((chain) => (
      String(chain.id) === String(chainId)
        ? { ...chain, resolved: true, resolvedDay: day, ok: Boolean(ok) }
        : chain
    )),
  };
}

export function eventChainRows(state) {
  const current = normalizeState(state);
  return activeEventChains(current).map((chain) => {
    const def = EVENT_CHAIN_DEFS[chain.kind] || {};
    const actorId = bestLivingActorFor(current, def.action || 'gather');
    const actor = getActor(current, actorId);
    const hp = Number(actor?.hp || 0);
    const stamina = Number(actor?.stamina || 0);
    const chance = actionChance(current, actorId, def.action || 'gather', Number(def.baseChance || 0.45));
    const daysLeft = Math.max(0, Number(chain.expiresDay || 0) - Number(current.day || 1));
    return {
      ...chain,
      title: def.title || chain.kind,
      detail: def.detail || '',
      actionLabel: def.actionLabel || '대응',
      costText: `${def.costText || 'AP 1'} · ${Math.round(chance * 100)}%`,
      rewardText: def.rewardText || '',
      actorId,
      actorName: actor?.name || '',
      chance,
      daysLeft,
      stageLabel: daysLeft > 0 ? `${daysLeft}일 남음` : '오늘 만료',
      enabled: !current.ended && Number(current.ap || 0) > 0 && hp > 0 && stamina >= 12,
    };
  });
}

function stripExplorationEventLine(line) {
  return String(line || '')
    .replace(/^Day\s+\d+:\s*/i, '')
    .replace(/^탐험 사건:\s*/, '')
    .trim();
}

function explorationEventRowsFromLog(state, limit = 3) {
  return (Array.isArray(state?.log) ? state.log : [])
    .filter((line) => String(line || '').includes('탐험 사건:'))
    .slice(0, Math.max(0, Number(limit || 0)))
    .map((line, index) => {
      const day = String(line || '').match(/^Day\s+(\d+):/i)?.[1] || '';
      const summary = stripExplorationEventLine(line);
      const firstSentence = summary.split('.').map((part) => part.trim()).filter(Boolean)[0] || summary;
      return {
        id: `event-${day || 'n'}-${index}-${summary.slice(0, 12)}`,
        day,
        title: firstSentence,
        summary,
      };
    });
}

function rareResourceRows(state) {
  return RARE_RESOURCE_IDS.map((id) => ({
    id,
    name: itemName(id),
    qty: Number(state?.inventory?.[id] || 0),
  }));
}

function rareResourceLabel(rows) {
  const owned = (Array.isArray(rows) ? rows : [])
    .filter((row) => Number(row.qty || 0) > 0)
    .map((row) => `${row.name} ${row.qty}`);
  return owned.length ? owned.join(' / ') : '희귀 재료 없음';
}

function explorationEventPressure(state) {
  const rows = rareResourceRows(state);
  const rareTotal = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const eventCount = Number(state?.counters?.events || 0);
  const activeChains = activeEventChains(state);
  const resolvedChains = normalizeEventChains(state?.eventChains, Number(state?.day || 1))
    .filter((chain) => chain.resolved).length;
  const recentEvents = explorationEventRowsFromLog(state, 3);
  const eventPct = Math.min(100, Math.round(eventCount * 12 + rareTotal * 8 + activeChains.length * 6 + resolvedChains * 5));
  const advice = [];

  if (Number(state?.day || 1) >= 5 && eventCount < 2) {
    advice.push('후반 장비 소재를 위해 동굴/초원 사건을 더 노리세요');
  }
  if (Number(state?.day || 1) >= 6 && rareTotal < 2) {
    advice.push('흑요석·공룡 소재·룬 파편 확보가 늦습니다');
  }
  if (Number(state?.inventory?.dino_hide || 0) > 0 || Number(state?.inventory?.obsidian_shard || 0) > 0) {
    advice.push('희귀 소재 장비 제작으로 사냥/추위 압박을 낮추세요');
  }
  if (activeChains.length) {
    advice.push(`활성 탐험 단서 ${activeChains.length}개 대응`);
  }
  if (averageParty(state, 'hp') < 70 && Number(state?.inventory?.herb_tonic || 0) > 0) {
    advice.push('약초 달임으로 부상 회복 후 메가파우나를 노리세요');
  }

  return {
    eventCount,
    eventPct,
    activeChains,
    resolvedChains,
    recentEvents,
    rareResources: rows,
    rareTotal,
    rareLabel: rareResourceLabel(rows),
    eventLabel: `${eventCount}회 · 희귀 ${rareTotal}개`,
    advice,
  };
}

const FOOD_RECOVERY_IDS = ['packed_ration', 'cooked_meat', 'jerky', 'meat', 'berry'];

function foodNutritionValue(state, foodId) {
  const food = ITEMS[foodId] || {};
  const cooked = ['packed_ration', 'cooked_meat', 'jerky'].includes(foodId);
  return Number(food.nutrition || 0)
    + (foodId === 'packed_ration' && hasTechPassive(state, 'STORAGE_RATIONS_UP') ? 6 : 0)
    + (cooked && hasTechPassive(state, 'COOKING_RECOVERY_UP') ? 4 : 0)
    + (cooked && hasTechPassive(state, 'COOKING_RECOVERY_UP_2') ? 4 : 0)
    + (hasCompletedProject(state, 'drying-rack') ? 2 : 0);
}

function foodHealValue(state, foodId) {
  return Number(ITEMS[foodId]?.heal || 0)
    + (foodId === 'herb_tonic' && hasTechPassive(state, 'MYSTIC_RECOVERY_UP') ? 4 : 0);
}
const RARE_GEAR_RECIPE_PRIORITY = [
  'dino_scale_vest',
  'obsidian_blade',
  'weather_totem',
  'fur_coat',
  'fur_pants',
  'fur_hat',
  'fur_boots',
  'hunter_talisman',
];

function foodUnitCount(state) {
  return FOOD_RECOVERY_IDS
    .reduce((sum, id) => sum + Number(state?.inventory?.[id] || 0), 0);
}

function pickBestRareGearRecipe(state) {
  return RARE_GEAR_RECIPE_PRIORITY
    .map((id) => RECIPES.find((recipe) => recipe.id === id))
    .find((recipe) => recipe && recipeUnlockInfo(state, recipe.id).unlocked && hasResources(state.inventory, recipe.requires))
    || null;
}

function hasAnyEquipInPool(state) {
  return Object.entries(buildEquipmentPool(state))
    .some(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip');
}

function bestLivingActorFor(state, action = 'gather') {
  return pickActorForAuto(state, action);
}

export function recoveryChoiceRows(state) {
  const current = normalizeState(state);
  const eventPressure = explorationEventPressure(current);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const stamina = averageParty(current, 'stamina');
  const bodyTemp = averageBodyTemp(current);
  const foodUnits = foodUnitCount(current);
  const partySize = Math.max(1, current.party.filter((member) => Number(member.hp || 0) > 0).length);
  const bestRareRecipe = pickBestRareGearRecipe(current);
  const hasTonic = Number(current.inventory.herb_tonic || 0) > 0;
  const canBrewTonic = recipeUnlockInfo(current, 'herb_tonic').unlocked && hasResources(current.inventory, { herb: 2, berry: 1 });
  const canFeed = FOOD_RECOVERY_IDS.some((id) => Number(current.inventory[id] || 0) > 0);
  const canWarm = Number(current.inventory.wood || 0) > 0 || Number(current.camp.fuel || 0) > 0;
  const canGear = Boolean(bestRareRecipe) || hasAnyEquipInPool(current);
  const canTrack = Number(current.ap || 0) > 0 && hp >= 45 && stamina >= 30;
  const rows = [
    {
      id: 'field_tonic',
      tone: hp < 55 ? 'danger' : 'normal',
      title: hasTonic ? '응급 처치' : '현장 약초 처치',
      detail: hasTonic
        ? '약초 달임 1개로 메가파우나/동굴 사냥 후 전원 HP를 회복합니다.'
        : '약초 2개와 베리 1개로 즉석 처치를 진행해 사냥 후 부상 압박을 줄입니다.',
      costText: hasTonic ? '약초 달임 1' : '약초 2 · 베리 1',
      enabled: (hp < 78 || eventPressure.eventCount > 0) && (hasTonic || canBrewTonic),
      priority: (80 - hp) + eventPressure.eventCount * 4 + (hasTonic ? 8 : 0),
    },
    {
      id: 'ration_break',
      tone: hunger > 65 ? 'danger' : 'normal',
      title: '비상 배식',
      detail: '보존식/구운 고기/육포를 우선 사용해 희귀 자원 파밍 중 허기 누적을 낮춥니다.',
      costText: `식량 ${Math.min(foodUnits, partySize)}개`,
      enabled: (hunger >= 42 || foodUnits <= partySize + 1) && canFeed,
      priority: hunger + Math.max(0, partySize + 2 - foodUnits) * 10,
    },
    {
      id: 'warm_watch',
      tone: bodyTemp < 35.5 ? 'danger' : 'normal',
      title: '온기 확보',
      detail: '나무나 연료를 써서 체온과 스태미나를 보정하고 다음 사냥 피해를 버틸 여유를 만듭니다.',
      costText: Number(current.inventory.wood || 0) > 0 ? '나무 1' : '연료 1',
      enabled: (bodyTemp < 36.4 || Number(current.weather?.cold || 0) >= 8 || Number(current.camp.fuel || 0) <= 1) && canWarm,
      priority: Math.max(0, 37 - bodyTemp) * 18 + Number(current.weather?.cold || 0),
    },
    {
      id: 'rare_gear',
      tone: bestRareRecipe ? 'normal' : 'low',
      title: bestRareRecipe ? '희귀 장비 제작' : '위험 장비 정비',
      detail: bestRareRecipe
        ? `${bestRareRecipe.name} 제작 재료가 준비됐습니다. 제작 후 장비를 자동 정비합니다.`
        : '보유 장비를 역할/날씨 기준으로 다시 배치해 희귀 자원 회수와 대형 사냥 리스크를 낮춥니다.',
      costText: bestRareRecipe ? formatRequires(bestRareRecipe.requires) : '보유 장비 재배치',
      enabled: canGear && (eventPressure.rareTotal > 0 || Number(current.day || 1) >= 5 || Number(current.weather?.cold || 0) >= 8),
      priority: eventPressure.rareTotal * 16 + (bestRareRecipe ? 24 : 4) + Number(current.weather?.cold || 0),
    },
    {
      id: 'risk_track',
      tone: eventPressure.rareTotal < 2 && Number(current.day || 1) >= 6 ? 'danger' : 'normal',
      title: eventPressure.rareTotal < 2 ? '희귀 흔적 추적' : '메가파우나 추적',
      detail: eventPressure.rareTotal < 2
        ? '동굴/초원의 희귀 자원 사건을 노리는 행동을 즉시 실행합니다.'
        : '초원 사냥으로 대형 사냥감 부산물을 노립니다. HP와 스태미나가 낮으면 먼저 회복하세요.',
      costText: 'AP 1',
      enabled: canTrack && (Number(current.day || 1) >= 5 || eventPressure.eventCount < 2 || eventPressure.rareTotal < 2),
      priority: (Number(current.day || 1) >= 6 ? 18 : 0) + Math.max(0, 2 - eventPressure.rareTotal) * 14 + Math.max(0, 2 - eventPressure.eventCount) * 8,
    },
  ];

  return rows
    .filter((row) => row.enabled || row.priority > 0)
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.priority - a.priority)
    .slice(0, 5);
}

function recoveryActionActorId(state, actorId = '', action = 'gather') {
  const requested = String(actorId || '').trim();
  const requestedActor = state.party.find((member) => member.id === requested);
  if (requestedActor && Number(requestedActor.hp || 0) > 0) return requested;
  return bestLivingActorFor(state, action);
}

function updateLivingParty(state, mapper) {
  return {
    ...state,
    party: state.party.map((member) => (
      Number(member.hp || 0) > 0 ? mapper(member) : member
    )),
  };
}

function finishRecoveryAction(state, actorId, options = {}, actionOptions = {}) {
  return afterAction(
    state,
    recoveryActionActorId(state, actorId, options.action || 'gather'),
    Math.max(0, Number(options.staminaCost || 0)),
    Math.max(0, Number(options.hungerAdd || 0)),
    { ...actionOptions, warmthAdd: Number(options.warmthAdd || 0) },
  );
}

function consumeRecoveryFood(inventory, state) {
  const next = { ...inventory };
  const foodId = FOOD_RECOVERY_IDS.find((id) => Number(next[id] || 0) > 0);
  if (!foodId) return null;
  next[foodId] = Math.max(0, Number(next[foodId] || 0) - 1);
  const nutrition = foodNutritionValue(state, foodId);
  const warmth = foodId === 'cooked_meat' ? 0.45 : foodId === 'packed_ration' ? 0.18 : 0;
  return {
    foodId,
    inventory: next,
    heal: foodHealValue(state, foodId),
    nutrition,
    warmth,
  };
}

export function runRecoveryChoiceAction(state, actorId, choiceId, options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '대응 행동을 실행할 AP가 부족합니다.');
  const id = String(choiceId || '');

  if (id === 'field_tonic') {
    const hasTonic = Number(current.inventory.herb_tonic || 0) > 0;
    const canBrewTonic = recipeUnlockInfo(current, 'herb_tonic').unlocked && hasResources(current.inventory, { herb: 2, berry: 1 });
    if (!hasTonic && !canBrewTonic) return addLog(current, '응급 처치에 필요한 약초 달임이나 약초/베리가 부족합니다.');
    const inventory = hasTonic
      ? spendResources(current.inventory, { herb_tonic: 1 })
      : spendResources(current.inventory, { herb: 2, berry: 1 });
    const heal = hasTonic ? 14 : 8;
    const staminaGain = hasTonic ? 5 : 3;
    let next = updateLivingParty({ ...current, inventory }, (member) => ({
      ...member,
      hp: clamp(Number(member.hp || 0) + heal, 0, 100),
      stamina: clamp(Number(member.stamina || 0) + staminaGain, 0, 100),
      bodyTemp: clamp(Number(member.bodyTemp ?? 37) + (hasTonic ? 0.3 : 0.18), 25, 39),
    }));
    next = addLog(next, `${hasTonic ? '약초 달임' : '현장 약초 처치'}로 전원 HP +${heal}, ST +${staminaGain}.`);
    return finishRecoveryAction(next, actorId, { action: 'craft', staminaCost: 4, hungerAdd: 1 }, options);
  }

  if (id === 'ration_break') {
    const targets = livingParty(current)
      .sort((a, b) => Number(b.hunger || 0) - Number(a.hunger || 0));
    let inventory = { ...current.inventory };
    const updates = {};
    const used = [];
    targets.forEach((member) => {
      const consumed = consumeRecoveryFood(inventory, current);
      if (!consumed) return;
      inventory = consumed.inventory;
      used.push(consumed.foodId);
      updates[member.id] = {
        ...member,
        hunger: clamp(Number(member.hunger || 0) - consumed.nutrition, 0, 100),
        hp: clamp(Number(member.hp || 0) + consumed.heal, 0, 100),
        bodyTemp: clamp(Number(member.bodyTemp ?? 37) + consumed.warmth, 25, 39),
      };
    });
    if (!used.length) return addLog(current, '비상 배식에 사용할 식량이 없습니다.');
    let next = {
      ...current,
      inventory,
      counters: { ...current.counters, meals: Number(current.counters?.meals || 0) + used.length },
      party: current.party.map((member) => updates[member.id] || member),
    };
    const names = used.map(itemName).join(', ');
    next = addLog(next, `비상 배식 완료: ${names}. 허기가 높은 팀원부터 ${used.length}명에게 배분했습니다.`);
    return finishRecoveryAction(next, actorId, { action: 'camp', staminaCost: 3, hungerAdd: 0 }, options);
  }

  if (id === 'warm_watch') {
    const hasWood = Number(current.inventory.wood || 0) > 0;
    const hasFuel = Number(current.camp.fuel || 0) > 0;
    if (!hasWood && !hasFuel) return addLog(current, '온기를 확보할 나무나 연료가 부족합니다.');
    let next = hasWood
      ? {
        ...current,
        inventory: spendResources(current.inventory, { wood: 1 }),
        camp: { ...current.camp, fuel: Number(current.camp.fuel || 0) + 1 },
      }
      : {
        ...current,
        camp: { ...current.camp, fuel: Math.max(0, Number(current.camp.fuel || 0) - 1) },
      };
    const tempGain = hasWood ? 0.45 : 0.75;
    const staminaGain = hasWood ? 6 : 8;
    next = updateLivingParty(next, (member) => ({
      ...member,
      stamina: clamp(Number(member.stamina || 0) + staminaGain, 0, 100),
      bodyTemp: clamp(Number(member.bodyTemp ?? 37) + tempGain, 25, 39),
    }));
    next = addLog(next, `${hasWood ? '나무 1개를 쪼개 연료를 보강' : '비축 연료 1개를 사용'}했습니다. 전원 체온 +${tempGain.toFixed(1)}, ST +${staminaGain}.`);
    return finishRecoveryAction(next, actorId, { action: 'camp', staminaCost: 2, hungerAdd: 1, warmthAdd: 0.15 }, options);
  }

  if (id === 'rare_gear') {
    const recipe = pickBestRareGearRecipe(current);
    if (recipe) {
      const craftActorId = recoveryActionActorId(current, actorId, 'craft');
      const crafted = runCraftAction(current, craftActorId, recipe.id, options);
      if (crafted.ended) return crafted;
      return autoEquipAction(crafted, Number(crafted.weather?.cold || 0) >= 5 ? 'weather' : 'role');
    }
    if (hasAnyEquipInPool(current)) {
      return autoEquipAction(current, Number(current.weather?.cold || 0) >= 5 ? 'weather' : 'role');
    }
    return addLog(current, '정비할 희귀 장비나 보유 장비가 없습니다.');
  }

  if (id === 'risk_track') {
    const pressure = explorationEventPressure(current);
    if (pressure.rareTotal < 2 || Number(current.inventory.obsidian_shard || 0) < 1) {
      return runGatherAction(current, recoveryActionActorId(current, actorId, 'gather'), 'cave', options);
    }
    return runHuntAction(current, recoveryActionActorId(current, actorId, 'hunt'), 'plains', options);
  }

  return addLog(current, '대응 선택지를 찾을 수 없습니다.');
}

export function runEventChainAction(state, actorId, chainId, options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '대응을 실행할 AP가 부족합니다.');

  const row = eventChainRows(current).find((entry) => String(entry.id) === String(chainId));
  if (!row) return addLog(current, '대응 가능한 탐험 단서를 찾을 수 없습니다.');
  if (!row.enabled) return addLog(current, `${row.title} 대응 조건이 부족합니다. AP, HP, 스태미나를 먼저 회복하세요.`);

  const def = EVENT_CHAIN_DEFS[row.kind] || {};
  const action = def.action || 'gather';
  const actingActorId = recoveryActionActorId(current, actorId || row.actorId, action);
  const actor = getActor(current, actingActorId);
  const rng = options.rng || Math.random;
  const ok = rng() < Number(row.chance || 0);
  let next = resolveEventChain(current, row.id, ok);

  if (ok) {
    next = {
      ...next,
      inventory: addItems(next.inventory, def.rewards || []),
    };
    next = addEventLog(next, `${actor?.name || '파티'}가 ${row.title} 대응에 성공했습니다. ${formatGains(def.rewards || [])}.`);
  } else {
    const target = getActor(next, actingActorId);
    const damage = eventRiskDamage(next, actingActorId, Number(def.failDamage || 6), action);
    const staminaLoss = Math.max(4, Number(def.failStamina || 8) - (hasEventSupportGear(next, actingActorId, action) ? 2 : 0));
    next = updateActor(next, actingActorId, {
      hp: clamp(Number(target.hp || 0) - damage, 0, 100),
      stamina: clamp(Number(target.stamina || 0) - staminaLoss, 0, 100),
    });
    next = addEventLog(next, `${actor?.name || '파티'}가 ${row.title} 대응에 실패했습니다. HP -${damage}, 스태미나 -${staminaLoss}.`);
  }

  return afterAction(
    recordResearchEvent(next, { kind: 'action', action, ok }),
    actingActorId,
    Math.max(1, Number(def.staminaCost || 14)),
    Math.max(1, Number(def.hungerAdd || 3)),
    options,
  );
}

function hasKoreanFinalConsonant(text) {
  const char = String(text || '').trim().slice(-1);
  if ('013678'.includes(char)) return true;
  if ('2459'.includes(char)) return false;
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

function objectParticle(text) {
  return `${text}${hasKoreanFinalConsonant(text) ? '을' : '를'}`;
}

function hasEventSupportGear(state, actorId, action) {
  if (action === 'hunt') {
    return ['bow', 'spear', 'atlatl', 'obsidian_blade', 'hunter_talisman']
      .some((itemId) => isEquipped(state, actorId, itemId));
  }
  if (action === 'gather') {
    return ['stone_axe', 'bone_pick', 'flint_knife', 'gatherer_charm']
      .some((itemId) => isEquipped(state, actorId, itemId));
  }
  return false;
}

function eventRiskDamage(state, actorId, base, action = '') {
  let damage = Number(base || 0);
  if (action === 'hunt' && hasTechPassive(state, 'MEGAFAUNA_RISK_DOWN')) damage -= 3;
  if (action === 'hunt' && hasTechPassive(state, 'HUNT_RISK_DOWN')) damage -= 2;
  if (action === 'hunt' && hasTechPassive(state, 'HUNT_RISK_DOWN_2')) damage -= 2;
  if (action === 'hunt' && hasTechPassive(state, 'HUNT_RISK_DOWN_3')) damage -= 3;
  if (hasEventSupportGear(state, actorId, action)) damage -= 2;
  return Math.max(1, Math.round(damage));
}

export function huntFailureDamage(state) {
  let damage = 11;
  if (hasTechPassive(state, 'MEGAFAUNA_RISK_DOWN')) damage -= 3;
  if (hasTechPassive(state, 'HUNT_RISK_DOWN')) damage -= 2;
  if (hasTechPassive(state, 'HUNT_RISK_DOWN_2')) damage -= 2;
  if (hasTechPassive(state, 'HUNT_RISK_DOWN_3')) damage -= 3;
  if (hasCompletedProject(state, 'palisade')) damage -= 2;
  return Math.max(2, damage);
}

function chooseWeightedEvent(rng, events) {
  const rows = events.filter(Boolean);
  const total = rows.reduce((sum, event) => sum + Math.max(0.01, Number(event.weight || 1)), 0);
  let roll = rng() * total;
  for (const event of rows) {
    roll -= Math.max(0.01, Number(event.weight || 1));
    if (roll <= 0) return event;
  }
  return rows[0] || null;
}

function zoneGatherEvents(zoneId, state) {
  const late = Number(state.day || 1) >= 6;
  if (zoneId === 'river') {
    return [
      { weight: 3, title: '점토 퇴적층', rewards: [['clay', 2], ['herb', 1]], note: '진흙 아래에 보존 상태가 좋은 점토층을 찾았습니다.' },
      { weight: 1.4, title: '강가 수지 표본', rewards: [['resin', 1], ['clay', 1]], note: '젖은 나무껍질 사이에서 굳은 수지를 떼어냈습니다.' },
    ];
  }
  if (zoneId === 'cave') {
    return [
      { weight: 2.4, title: '검은 유리맥', rewards: [['obsidian_shard', late ? 2 : 1], ['flint', 1]], staminaLoss: 2, note: '동굴 벽 안쪽의 검은 유리맥을 조심스럽게 떼어냈습니다.' },
      { weight: 1.2, title: '마른 뼈층', rewards: [['bone', 2], ['tooth', 1]], note: '오래된 짐승 뼈가 쌓인 층을 발견했습니다.' },
    ];
  }
  if (zoneId === 'plains') {
    return [
      { weight: 2.2, title: '거대 발자국', rewards: [['dino_bone', 1], ['fiber', 1]], staminaLoss: 2, note: '초원에 깊게 남은 발자국 주변에서 공룡 뼈 조각을 찾았습니다.' },
      { weight: 1.8, title: '숨은 베리 군락', rewards: [['berry', 2], ['herb', 1]], note: '풀숲 안쪽에서 먹을 수 있는 베리 군락을 발견했습니다.' },
      late ? { weight: 0.7, title: '룬 파편 반짝임', rewards: [['rune_shard', 1]], note: '해질녘 풀밭 사이에서 이상한 빛을 내는 파편을 주웠습니다.' } : null,
    ];
  }
  return [
    { weight: 2.6, title: '수지 고목', rewards: [['resin', 1], ['wood', 1]], note: '오래된 나무에서 접착에 쓸 수 있는 수지를 얻었습니다.' },
    { weight: 1.6, title: '버섯 그늘', rewards: [['berry', 1], ['herb', 1]], note: '그늘진 나무뿌리 아래에서 약초와 식량을 챙겼습니다.' },
  ];
}

function zoneHuntEvents(zoneId, state) {
  const late = Number(state.day || 1) >= 6;
  if (zoneId === 'plains') {
    return [
      { weight: late ? 2.4 : 1.4, title: '메가파우나 몰이', rewards: [['meat', 3], ['dino_hide', 1], ['dino_bone', 1]], damage: 8, staminaLoss: 4, note: '큰 사냥감을 몰아붙여 귀한 부산물을 확보했습니다.' },
      { weight: 1.8, title: '빠른 초식동물', rewards: [['meat', 2], ['hide', 1], ['sinew', 1]], damage: 3, note: '무리에서 떨어진 초식동물을 짧게 제압했습니다.' },
      late ? { weight: 0.55, title: '룬이 박힌 뼈', rewards: [['rune_shard', 1], ['dino_bone', 1]], damage: 5, note: '이상한 문양이 남은 뼈 조각을 회수했습니다.' } : null,
    ];
  }
  if (zoneId === 'cave') {
    return [
      { weight: 2.1, title: '동굴 포식자 둥지', rewards: [['bone', 2], ['tooth', 1], ['mutant_gland', 1]], damage: 9, staminaLoss: 3, note: '동굴 깊은 곳의 포식자 둥지를 정리했습니다.' },
      { weight: 1.3, title: '낡은 사냥 흔적', rewards: [['hide', 1], ['sinew', 1], ['obsidian_shard', 1]], damage: 4, note: '이전 사냥 흔적에서 쓸 수 있는 재료를 회수했습니다.' },
    ];
  }
  if (zoneId === 'river') {
    return [
      { weight: 2.4, title: '강변 사냥', rewards: [['meat', 2], ['bone', 1]], damage: 2, note: '물을 마시러 온 작은 짐승을 포착했습니다.' },
      { weight: 1.1, title: '젖은 발자국 추적', rewards: [['tooth', 1], ['sinew', 1]], damage: 3, note: '젖은 발자국을 따라가 사냥 부산물을 챙겼습니다.' },
    ];
  }
  return [
    { weight: 2.6, title: '숲속 매복', rewards: [['meat', 1], ['hide', 1], ['sinew', 1]], damage: 3, note: '나무 사이에서 짧은 매복 사냥에 성공했습니다.' },
    { weight: 1.2, title: '날카로운 이빨', rewards: [['tooth', 1], ['hide', 1]], damage: 5, note: '위험한 짐승을 가까스로 제압하고 이빨을 회수했습니다.' },
  ];
}

function fallbackZoneEventReward(zoneId, action) {
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
      const event = chooseWeightedEvent(rng, zoneGatherEvents(zoneId, next)) || {};
      const rewards = (event.rewards || fallbackZoneEventReward(zoneId, 'gather')).filter(([, qty]) => qty > 0);
      next = { ...next, inventory: addItems(next.inventory, rewards) };
      const chainResult = openEventChainFromRewards(next, rewards, { action: 'gather', zoneId });
      next = chainResult.state;
      if (Number(event.staminaLoss || 0) > 0) {
        const target = getActor(next, actorId);
        next = updateActor(next, actorId, {
          stamina: clamp(Number(target.stamina || 0) - Number(event.staminaLoss || 0), 0, 100),
        });
      }
      const costText = Number(event.staminaLoss || 0) > 0 ? `, 스태미나 -${Number(event.staminaLoss || 0)}` : '';
      const title = event.title || '숨겨진 흔적';
      return addEventLog(next, `${actor.name} 학생이 ${objectParticle(title)} 발견했습니다. ${event.note || '쓸 만한 단서를 챙겼습니다.'} ${formatGains(rewards)}${costText}.`);
    }
    const damage = zoneId === 'cave' ? 4 : zoneId === 'river' ? 2 : 3;
    next = updateActor(next, actorId, { hp: clamp(Number(actor.hp || 0) - damage, 0, 100) });
    const failNote = zoneId === 'cave'
      ? '낙석을 피해 물러났습니다'
      : zoneId === 'river'
        ? '진흙에 발이 빠져 몸을 부딪쳤습니다'
        : '가시덤불에 긁혔습니다';
    return addEventLog(next, `${actor.name} 학생이 ${failNote}. HP -${damage}.`);
  }

  if (action === 'hunt') {
    if (ok) {
      const event = chooseWeightedEvent(rng, zoneHuntEvents(zoneId, next)) || {};
      const rewards = event.rewards || fallbackZoneEventReward(zoneId, 'hunt');
      const damage = eventRiskDamage(next, actorId, Number(event.damage || 4), 'hunt');
      const staminaLoss = Math.max(0, Number(event.staminaLoss || 0) - (hasEventSupportGear(next, actorId, 'hunt') ? 1 : 0));
      next = {
        ...next,
        inventory: addItems(next.inventory, rewards),
      };
      const chainResult = openEventChainFromRewards(next, rewards, { action: 'hunt', zoneId });
      next = chainResult.state;
      next = updateActor(next, actorId, {
        hp: clamp(Number(actor.hp || 0) - damage, 0, 100),
        stamina: clamp(Number(actor.stamina || 0) - staminaLoss, 0, 100),
      });
      const costText = [
        `HP -${damage}`,
        staminaLoss > 0 ? `스태미나 -${staminaLoss}` : '',
      ].filter(Boolean).join(', ');
      const title = event.title || '큰 사냥감의 흔적';
      return addEventLog(next, `${actor.name} 학생이 ${objectParticle(title)} 확보했습니다. ${event.note || '사냥 부산물을 챙겼습니다.'} ${formatGains(rewards)}, ${costText}.`);
    }
    const damage = eventRiskDamage(next, actorId, zoneId === 'plains' || zoneId === 'cave' ? 7 : 5, 'hunt');
    const staminaLoss = zoneId === 'plains' || zoneId === 'cave' ? 7 : 6;
    next = updateActor(next, actorId, {
      hp: clamp(Number(actor.hp || 0) - damage, 0, 100),
      stamina: clamp(Number(actor.stamina || 0) - staminaLoss, 0, 100),
    });
    const failName = zoneId === 'plains'
      ? '대형 짐승의 돌진'
      : zoneId === 'cave'
        ? '동굴 포식자의 반격'
        : '포식자의 추격';
    return addEventLog(next, `${actor.name} 학생이 ${failName}을 피해 달아났습니다. HP -${damage}, 스태미나 -${staminaLoss}.`);
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
  const season = seasonForDay(state.day);
  const seasonBonus = action === 'gather'
    ? Number(season.gatherMod || 0)
    : action === 'hunt'
      ? Number(season.huntMod || 0)
      : 0;
  const projectBonus = action === 'gather' && hasCompletedProject(state, 'irrigation-ditch') ? 0.05 : 0;
  const researchBonus =
    (action === 'gather' && hasTechPassive(state, 'GATHER_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'HUNT_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && isEquipped(state, actorId, 'bow') && hasTechPassive(state, 'BOW_HUNT_UP') ? 0.06 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'OBSIDIAN_HUNT_UP') ? 0.04 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'HUNT_SUCCESS_UP_2') ? 0.06 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'ANIMAL_YIELD_UP') ? 0.04 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'HUNT_SUCCESS_UP_3') ? 0.08 : 0)
    + (action === 'gather' && hasTechPassive(state, 'PLANT_YIELD_UP') ? 0.04 : 0)
    + (action === 'gather' && hasTechPassive(state, 'PLANT_YIELD_UP_2') ? 0.04 : 0)
    + (action === 'craft' && hasTechPassive(state, 'CRAFT_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'craft' && hasTechPassive(state, 'ADVANCED_CRAFT_UP') ? 0.04 : 0)
    + (action === 'craft' && hasTechPassive(state, 'ADVANCED_CRAFT_UP_2') ? 0.04 : 0)
    + (action === 'craft' && hasTechPassive(state, 'ADVANCED_CRAFT_UP_3') ? 0.05 : 0)
    + (action === 'craft' && hasTechPassive(state, 'IRON_CRAFT_UP') ? 0.06 : 0);
  return clamp(base + stat * 0.025 + weather + camp + book + equipment + seasonBonus + projectBonus + researchBonus, 0.08, 0.95);
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
  next = autoResearchForTurn(next);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function advanceDay(state, options = {}) {
  const preset = difficultyPreset(state);
  const weather = rollWeather(state.day + 1, options.rng || Math.random);
  const warmth = Number(state.camp.fireLevel || 0) * 4 + Number(state.camp.shelterLevel || 0) * 3 + partyInsulation(state) * 2;
  const weatherLoreMul = (hasTechPassive(state, 'WEATHER_FORECAST_UP') ? 0.95 : 1)
    * (hasTechPassive(state, 'WEATHER_LORE_UP') ? 0.9 : 1)
    * (hasTechPassive(state, 'WEATHER_DAMAGE_DOWN') ? 0.9 : 1)
    * (hasTechPassive(state, 'WEATHER_LORE_UP_2') ? 0.88 : 1)
    * (hasTechPassive(state, 'WEATHER_DAMAGE_DOWN_2') ? 0.82 : 1)
    * (hasCompletedProject(state, 'palisade') ? 0.85 : 1);
  const coldDamage = Math.round(Math.max(0, Number(state.weather?.cold || 0) - warmth) * preset.coldMultiplier * weatherLoreMul);
  const fireActive = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0;
  const fuelSaverNight = hasTechPassive(state, 'CAMP_FUEL_SAVER') && Number(state.day || 1) % 2 === 1;
  const fuelUsed = fireActive && !fuelSaverNight ? 1 : 0;
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
  let logged = addLog(next, fuelUsed ? `${note} 모닥불 연료를 1 소비했습니다.` : note);
  const previousSeason = seasonForDay(state.day);
  const currentSeason = seasonForDay(next.day);
  if (previousSeason.id !== currentSeason.id) {
    logged = addLog(logged, `계절 전환: ${currentSeason.name}. ${currentSeason.note}`);
  }
  return recordResearchEvent(autoResearchForDay(logged), { kind: 'day', weatherId: weather.id, fireKept: fuelUsed > 0 });
}

export function selectTechAction(state, techId) {
  const current = normalizeState(state);
  const researchStatus = researchSystemStatus(current);
  if (!researchStatus.unlocked) return addLog(current, researchStatus.reason);
  const tech = getTech(techId);
  if (!tech) return current;
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, missingPrereqMessage(current.research, tech));
  return addLog({
    ...current,
    research: { ...current.research, selectedTechId: tech.id },
  }, `연구 목표를 ${tech.name}(으)로 변경했습니다.`);
}

export function researchActionEstimate(state, actorId) {
  const current = normalizeState(state);
  const researchStatus = researchSystemStatus(current);
  const actor = getActor(current, actorId);
  const archiveStudy = Number(current.camp.scribeDeskLevel || 0)
    + Number(current.camp.libraryShelfLevel || 0)
    + bookResearchBonus(current);
  return {
    unlocked: researchStatus.actionUnlocked,
    lockedReason: researchStatus.actionReason,
    points: 3
      + Math.floor(Number(actor?.stats?.craft || 5) / 3)
      + Number(current.camp.workbenchLevel || 0)
      + archiveStudy
      + (hasTechPassive(current, 'STATE_RESEARCH_UP') ? 1 : 0),
    staminaCost: Math.max(5, 14 - Number(current.camp.workbenchLevel || 0) * 2 - Number(current.camp.scribeDeskLevel || 0)),
  };
}

export function runResearchAction(state, actorId, options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '연구할 행동력이 부족합니다.');
  const researchStatus = researchSystemStatus(current);
  if (!researchStatus.unlocked) return addLog(current, researchStatus.reason);
  if (!researchStatus.actionUnlocked) return addLog(current, researchStatus.actionReason);
  const actor = getActor(current, actorId);
  const techId = current.research.selectedTechId || nextAvailableTech(current.research)?.id;
  const tech = getTech(techId);
  if (!tech) return addLog(current, '연구 가능한 기술이 없습니다.');
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, missingPrereqMessage(current.research, tech));
  const { points, staminaCost } = researchActionEstimate(current, actorId);
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
  const systemStatus = researchSystemStatus(current);
  return TECH_TREE.map((tech) => {
    const progress = Math.min(tech.cost, Number(current.research.progress?.[tech.id] || 0));
    const completed = Boolean(current.research.completed?.[tech.id]);
    const available = systemStatus.unlocked && !completed && prereqsMet(current.research, tech);
    const eurekaStatus = eurekaStatusForTech(current, tech);
    const inspirationStatus = inspirationStatusForTech(current, tech);
    const nextTechIds = TECH_TREE.filter((candidate) => candidate.prereqs?.includes(tech.id)).map((candidate) => candidate.id);
    return {
      ...tech,
      progress,
      completed,
      available,
      selected: current.research.selectedTechId === tech.id,
      eurekaDone: Boolean(current.research.eureka?.[tech.id]),
      eurekaStatus,
      inspirationDone: Boolean(current.research.inspiration?.[tech.id]),
      inspirationStatus,
      nextTechIds,
      missingPrereqs: missingPrereqNames(current.research, tech),
      progressPct: Math.round((progress / tech.cost) * 100),
    };
  }).sort((a, b) => (
    Number(a.tier || 1) - Number(b.tier || 1)
      || String(a.tags?.[0] || '').localeCompare(String(b.tags?.[0] || ''))
      || a.name.localeCompare(b.name, 'ko-KR')
  ));
}

export function researchInspirationRows(state) {
  const current = normalizeState(state);
  return TECH_TREE
    .flatMap((tech) => ['eureka', 'inspiration'].flatMap((kind) => {
      const trigger = tech[kind];
      if (!trigger) return [];
      const status = breakthroughStatusForTech(current, tech, kind);
      const breakthroughDone = Boolean(current.research[kind]?.[tech.id]);
      return [{
        id: `${kind}-${tech.id}`,
        kind,
        kindLabel: kind === 'inspiration' ? '영감' : '유레카',
        techId: tech.id,
        techName: tech.name,
        desc: trigger.desc || '',
        completed: Boolean(current.research.completed?.[tech.id]),
        breakthroughDone,
        eurekaDone: breakthroughDone,
        available: researchSystemStatus(current).unlocked && prereqsMet(current.research, tech),
        blocked: status.blocked,
        statusLabel: status.statusLabel,
        note: status.note,
        missingPrereqs: status.missingPrereqs,
        current: status.current,
        target: status.target,
        progressPct: Math.round((Math.min(status.current, status.target) / status.target) * 100),
      }];
    }))
    .sort((a, b) => (
      Number(a.completed) - Number(b.completed)
      || Number(b.available) - Number(a.available)
      || Number(a.breakthroughDone) - Number(b.breakthroughDone)
      || b.progressPct - a.progressPct
      || a.techName.localeCompare(b.techName, 'ko-KR')
    ));
}

function researchEurekaActionText(tech, status) {
  const trigger = tech.eureka;
  if (!trigger) return '유레카 조건 없음. 연구 행동으로 바로 진행하세요.';
  if (status.done) return status.blocked ? '단서는 확보했습니다. 선행 연구를 먼저 완료하세요.' : '유레카 단서 확보 완료.';
  const remain = Math.max(0, Number(status.target || 0) - Number(status.current || 0));
  if (trigger.type === 'actionSuccess') return `${RESEARCH_ACTION_LABELS[trigger.action] || trigger.action} 성공 ${remain}회 필요`;
  if (trigger.type === 'actionFail') return `${RESEARCH_ACTION_LABELS[trigger.action] || trigger.action} 실패 ${remain}회 필요`;
  if (trigger.type === 'recipeCraft') return `${recipeName(trigger.recipeId)} 제작 ${remain}회 필요`;
  if (trigger.type === 'haveItem') return `${itemName(trigger.itemId)} ${remain}개 더 확보`;
  if (trigger.type === 'campAction') return `캠프 ${RESEARCH_ACTION_LABELS[trigger.kind] || trigger.kind} 행동 ${remain}회 필요`;
  if (trigger.type === 'weatherTypes') return `새 날씨 관찰 ${remain}종 필요`;
  if (trigger.type === 'surviveDays') return `${remain}일 더 생존`;
  if (trigger.type === 'campLevel') return `${RESEARCH_CAMP_LABELS[trigger.key?.replace('Level', '')] || trigger.key || '캠프'} Lv.${trigger.count} 달성 필요`;
  if (trigger.type === 'campFireDays') return `모닥불 유지 밤 ${remain}회 필요`;
  return trigger.desc || '유레카 조건을 진행하세요.';
}

function ancientResearchPressure(state, tech) {
  const current = normalizeState(state);
  if (tech?.era !== 'ANCIENT' || current.research.completed?.[tech.id]) {
    return { bonus: 0, reasons: [] };
  }

  const reasons = [];
  let bonus = 0;
  const day = Number(current.day || 1);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const bodyTemp = averageBodyTemp(current);
  const foodUnits = ['berry', 'meat', 'cooked_meat', 'jerky', 'packed_ration', 'herb_tonic']
    .reduce((sum, id) => sum + Number(current.inventory?.[id] || 0), 0);
  const alive = Math.max(1, current.party.filter((member) => Number(member.hp || 0) > 0).length);
  const weatherSeen = Object.values(current.research?.counters?.weatherSeen || {})
    .filter((value) => Number(value || 0) > 0).length;

  if (tech.id === 'FOOD_STORAGE' && (hunger >= 48 || foodUnits <= alive * 2 || day >= 7)) {
    bonus += 18;
    reasons.push('식량 압박');
  }
  if (tech.id === 'WRITING' && (Number(current.camp.archiveRoomLevel || 0) > 0 || day >= 7)) {
    bonus += 12;
    reasons.push('기록 시설 연계');
  }
  if (tech.id === 'BOOKCRAFT' && Number(current.inventory?.clay || 0) >= 2) {
    bonus += 10;
    reasons.push('책 재료 확보');
  }
  if (tech.id === 'LIBRARY' && (Number(current.inventory?.book_camp_manual || 0) > 0 || Number(current.camp.scribeDeskLevel || 0) > 0)) {
    bonus += 14;
    reasons.push('상위 연구 가속');
  }
  if (tech.id === 'ADVANCED_CARVING' && Number(current.counters?.craft || 0) >= 4) {
    bonus += 10;
    reasons.push('제작 루프 강화');
  }
  if (tech.id === 'OBSIDIAN_KNAPPING' && Number(current.inventory?.obsidian_shard || 0) > 0) {
    bonus += 16;
    reasons.push('희귀 재료 활용');
  }
  if (tech.id === 'MEGAFAUNA_HIDE' && (Number(current.inventory?.dino_hide || 0) > 0 || hp < 62)) {
    bonus += 16;
    reasons.push(hp < 62 ? '대형 사냥 위험 완화' : '공룡 가죽 활용');
  }
  if (tech.id === 'CLAY_TABLETS' && Number(current.inventory?.clay || 0) >= 3) {
    bonus += 12;
    reasons.push('기록판 재료 확보');
  }
  if (tech.id === 'WEATHER_LORE' && (bodyTemp <= 35.8 || Number(current.weather?.cold || 0) >= 8 || weatherSeen >= 3)) {
    bonus += 15;
    reasons.push('날씨 대응');
  }

  return {
    bonus,
    reasons,
  };
}

export function researchPlannerRows(state) {
  const systemStatus = researchSystemStatus(state);
  const rows = techRows(state);
  return rows.map((tech) => {
    const unlockGroups = researchUnlockGroups(tech);
    const eurekaTarget = Math.max(0, Number(tech.eurekaStatus?.target || 0));
    const eurekaCurrent = Math.min(eurekaTarget, Math.max(0, Number(tech.eurekaStatus?.current || 0)));
    const eurekaPct = eurekaTarget ? Math.round((eurekaCurrent / eurekaTarget) * 100) : 0;
    const inspirationTarget = Math.max(0, Number(tech.inspirationStatus?.target || 0));
    const inspirationCurrent = Math.min(inspirationTarget, Math.max(0, Number(tech.inspirationStatus?.current || 0)));
    const inspirationPct = inspirationTarget ? Math.round((inspirationCurrent / inspirationTarget) * 100) : 0;
    const missing = tech.missingPrereqs || [];
    const pressure = ancientResearchPressure(state, tech);
    const priorityScore = tech.completed
      ? -1000
      : Math.round(
        (tech.selected ? 70 : 0)
        + (tech.available ? 55 : 0)
        + (tech.eurekaDone ? 24 : eurekaPct * 0.22)
        + (tech.inspirationDone ? 16 : inspirationPct * 0.14)
        + Number(tech.progressPct || 0) * 0.35
        + unlockGroups.recipes.length * 8
        + unlockGroups.camps.length * 10
        + unlockGroups.passives.length * 4
        + pressure.bonus
        - missing.length * 18,
      );
    const nextAction = tech.completed
      ? '완료된 연구입니다. 후속 연구를 선택하세요.'
      : !tech.available
        ? missing.length
          ? `${missing.join(', ')} 연구를 먼저 완료하세요. ${researchEurekaActionText(tech, tech.eurekaStatus)}`
          : researchEurekaActionText(tech, tech.eurekaStatus)
        : !systemStatus.actionUnlocked
          ? `${researchEurekaActionText(tech, tech.eurekaStatus)} 지정 목표에는 매 행동 턴과 하루 시작에 자동 RP가 누적됩니다.`
          : tech.eurekaDone
            ? '유레카가 적용됐습니다. 연구 실행으로 마무리하세요.'
            : researchEurekaActionText(tech, tech.eurekaStatus);
    return {
      ...tech,
      ...unlockGroups,
      eurekaCurrent,
      eurekaTarget,
      eurekaPct,
      eurekaText: tech.eureka?.desc || '유레카 없음',
      inspirationCurrent,
      inspirationTarget,
      inspirationPct,
      inspirationText: tech.inspiration?.desc || '영감 없음',
      nextAction,
      blockerText: !systemStatus.unlocked
        ? systemStatus.reason
        : missing.length
          ? `선행: ${missing.join(', ')}`
          : '선행 조건 충족',
      pressureBonus: pressure.bonus,
      pressureReasons: pressure.reasons,
      pressureLabel: pressure.reasons.length ? `후반 보정 +${pressure.bonus}: ${pressure.reasons.join(', ')}` : '후반 보정 없음',
      priorityScore,
      priorityLabel: tech.completed
        ? '완료'
        : tech.selected
          ? '선택 목표'
          : tech.available
            ? '진행 가능'
            : tech.eurekaStatus?.blocked
              ? '단서 확보'
              : '잠김',
    };
  }).sort((a, b) => (
    b.priorityScore - a.priorityScore
      || Number(b.available) - Number(a.available)
      || Number(a.completed) - Number(b.completed)
      || Number(a.tier || 1) - Number(b.tier || 1)
      || a.cost - b.cost
      || a.name.localeCompare(b.name, 'ko-KR')
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
  const systemStatus = researchSystemStatus(current);
  const rows = techRows(current);
  const selected = rows.find((tech) => tech.selected) || rows.find((tech) => tech.available) || rows[0];
  const archiveRows = rows.filter((tech) => tech.archiveRequired);
  return {
    completed: rows.filter((tech) => tech.completed).length,
    total: rows.length,
    archiveCompleted: archiveRows.filter((tech) => tech.completed).length,
    archiveTotal: archiveRows.length,
    selected,
    available: rows.filter((tech) => tech.available).length,
    unlocked: systemStatus.unlocked,
    actionUnlocked: systemStatus.actionUnlocked,
    gateCompleted: systemStatus.completed,
    gateTotal: systemStatus.total,
    actionCompleted: systemStatus.actionCompleted,
    actionTotal: systemStatus.actionTotal,
    gateRows: systemStatus.gateRows,
    actionGateRows: systemStatus.actionGateRows,
    headline: systemStatus.headline,
    reason: systemStatus.reason,
    actionReason: systemStatus.actionReason,
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
      label: '핵심 연구',
      current: research.archiveCompleted,
      target: research.archiveTotal,
      done: research.archiveCompleted >= research.archiveTotal,
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
    + (hasTechPassive(state, 'CAMP_SCORE_UP') ? 150 : 0)
    + (hasTechPassive(state, 'CAMP_SCORE_UP_2') ? 300 : 0)
    + (hasTechPassive(state, 'DRAMA_SCORE_UP') ? 180 : 0)
    + (hasTechPassive(state, 'ART_SCORE_UP') ? 180 : 0)
    + (hasCompletedProject(state, 'stone-monument') ? 400 : 0)
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

export function recentExplorationEvents(state, limit = 4) {
  return explorationEventRowsFromLog(normalizeState(state), limit);
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
  const foodUnits = ['berry', 'meat', 'cooked_meat', 'jerky', 'packed_ration', 'herb_tonic']
    .reduce((sum, id) => sum + Number(current.inventory[id] || 0), 0);
  const fuel = Number(current.camp.fuel || 0);
  const weight = totalCarryWeight(current);
  const insulation = partyInsulation(current);
  const eventPressure = explorationEventPressure(current);
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
  if (Number(current.day || 1) >= 5 && eventPressure.eventCount < 2) blockers.push(`탐험 사건 ${eventPressure.eventCount}회`);
  if (Number(current.day || 1) >= 6 && eventPressure.rareTotal < 2) blockers.push(`희귀 재료 ${eventPressure.rareTotal}개`);

  const recommendations = [];
  if (hp < 70 && Number(current.inventory?.herb_tonic || 0) > 0) recommendations.push('약초 달임으로 부상 회복');
  else if (hp < 70 && Number(current.inventory?.herb || 0) >= 2 && Number(current.inventory?.berry || 0) >= 1) recommendations.push('약초 달임 제작 후 회복');
  if (hp < 65 || stamina < 45) recommendations.push('파티 회복을 위해 휴식 우선');
  if (foodUnits <= current.party.length + 1) recommendations.push('식량 확보를 위해 채집/사냥 우선');
  if (fuel <= 1 || bodyTemp < 36) recommendations.push('연료 확보 후 모닥불 유지');
  if (research.available && research.selected && !research.selected.completed) recommendations.push(`${research.selected.name} 연구 진행`);
  if (pendingObjectives.some((row) => row.id === 'facilities')) recommendations.push('기록 시설 제작 재료 확보');
  if (pendingObjectives.some((row) => row.id === 'books')) recommendations.push('책 제작 루트 점검');
  recommendations.push(...eventPressure.advice);
  if (!recommendations.length) recommendations.push(victory.canComplete ? '아카이브 완성 가능' : '현재 운영 유지');

  return {
    objectivePct,
    objectiveLabel: `${victory.completed}/${victory.total}`,
    daysLeft,
    riskLevel,
    riskTone,
    riskScore,
    foodUnits,
    eventCount: eventPressure.eventCount,
    eventLabel: eventPressure.eventLabel,
    eventPct: eventPressure.eventPct,
    fuel,
    insulation,
    rareResourceLabel: eventPressure.rareLabel,
    rareResourceTotal: eventPressure.rareTotal,
    activeEventChains: eventChainRows(current),
    recoveryChoices: recoveryChoiceRows(current),
    recentEvents: eventPressure.recentEvents,
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
  const eventPressure = explorationEventPressure(current);
  const objectivePct = victory.total ? Math.round((victory.completed / victory.total) * 100) : 0;
  const researchPct = research.total ? Math.round((research.completed / research.total) * 100) : 0;
  const survivalPct = Math.min(100, Math.round((Number(current.day || 1) / ARCHIVE_VICTORY_DAY) * 100));
  const stabilityPct = Math.round(clamp((hp * 0.45) + ((100 - hunger) * 0.25) + (stamina * 0.2) + Math.min(10, partyInsulation(current) * 2), 0, 100));
  const archiveScore = Math.round(clamp(
    objectivePct * 0.32
      + researchPct * 0.21
      + survivalPct * 0.17
      + stabilityPct * 0.13
      + Math.min(100, facilities * 30 + books * 5) * 0.08
      + eventPressure.eventPct * 0.05
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
      id: 'exploration_events',
      title: '탐험 사건과 희귀 소재',
      pct: eventPressure.eventPct,
      status: archiveReportStatus(eventPressure.eventPct >= 60, victory.victory, current.ended),
      detail: `탐험 사건 ${eventPressure.eventCount}회, ${eventPressure.rareLabel}. 최근 기록은 ${eventPressure.recentEvents[0]?.title || '아직 없습니다'}.`,
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
      eventCount: eventPressure.eventCount,
      eventPct: eventPressure.eventPct,
      rareResourceTotal: eventPressure.rareTotal,
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

function zoneEntryChance(state, chance = 1, context = {}) {
  const baseChance = Number(chance || 1);
  if (baseChance >= 1) return 1;
  const region = context.region || getRegion(context.regionId);
  return clamp(
    baseChance
      + (hasTechPassive(state, 'RARE_YIELD_UP') ? 0.06 : 0)
      + (hasTechPassive(state, 'RARE_YIELD_UP_2') ? 0.08 : 0)
      + Number(region?.rareBonus || 0)
      + (context.zoneId === 'cave' && hasTechPassive(state, 'MINERAL_YIELD_UP') ? 0.08 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'RIVER_YIELD_UP') ? 0.05 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'RIVER_YIELD_UP_2') ? 0.06 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'SHIPBUILDING_RIVER_UP') ? 0.07 : 0),
    0,
    1,
  );
}

function zoneBonusQuantityChance(state, context = {}) {
  const region = context.region || getRegion(context.regionId);
  return clamp(
    0.18
      + Number(region?.yieldBonus || 0)
      + (hasTechPassive(state, 'RESOURCE_YIELD_UP') ? 0.12 : 0)
      + (hasTechPassive(state, 'RESOURCE_YIELD_UP_2') ? 0.14 : 0)
      + (context.action === 'gather' && hasTechPassive(state, 'PLANT_YIELD_UP') ? 0.08 : 0)
      + (context.action === 'gather' && hasTechPassive(state, 'PLANT_YIELD_UP_2') ? 0.1 : 0)
      + (context.action === 'gather' && hasCompletedProject(state, 'irrigation-ditch') ? 0.12 : 0)
      + (context.action === 'hunt' && hasTechPassive(state, 'ANIMAL_YIELD_UP') ? 0.1 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'RIVER_YIELD_UP') ? 0.08 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'RIVER_YIELD_UP_2') ? 0.1 : 0)
      + (context.zoneId === 'river' && hasTechPassive(state, 'SHIPBUILDING_RIVER_UP') ? 0.12 : 0),
    0,
    0.9,
  );
}

function revealedActionRegions(state) {
  const exploration = normalizeExplorationState(state?.exploration);
  return WORLD_REGIONS.filter((region) => exploration.revealed?.[region.id] && !region.safe);
}

function resolveActionRegion(state, requestedRegionId, rng = Math.random) {
  const revealed = revealedActionRegions(state);
  const fallback = revealed[0] || WORLD_REGIONS.find((region) => !region.safe) || WORLD_REGIONS[0];
  if (canSelectActionZone(state)) {
    const requested = revealed.find((region) => region.id === requestedRegionId)
      || revealed.find((region) => region.zoneId === requestedRegionId)
      || revealed.find((region) => region.id === state.exploration?.selectedRegionId);
    return requested || fallback;
  }
  const index = Math.min(revealed.length - 1, Math.floor(clamp(Number(rng()), 0, 0.999999) * revealed.length));
  return revealed[index] || fallback;
}

function actionChanceForRegion(state, actorId, action, region) {
  const base = actionChance(state, actorId, action, action === 'hunt' ? 0.42 : 0.5);
  return clamp(base - Number(region?.danger || 0) * 0.012, 0.08, 0.95);
}

export function regionalActionChance(state, actorId, action, requestedRegionId = '') {
  const current = normalizeState(state);
  const regions = canSelectActionZone(current)
    ? [resolveActionRegion(current, requestedRegionId, () => 0)]
    : revealedActionRegions(current);
  if (!regions.length) return actionChance(current, actorId, action, action === 'hunt' ? 0.42 : 0.5);
  return regions.reduce((sum, region) => sum + actionChanceForRegion(current, actorId, action, region), 0) / regions.length;
}

function discoverRegionAfterAction(state, region, ok, rng = Math.random) {
  const exploration = normalizeExplorationState(state.exploration);
  let next = {
    ...state,
    exploration: {
      ...exploration,
      visits: {
        ...exploration.visits,
        [region.id]: Number(exploration.visits?.[region.id] || 0) + 1,
      },
    },
  };
  const directCandidates = (region.neighbors || [])
    .map((regionId) => getRegion(regionId))
    .filter((candidate) => candidate && !exploration.revealed?.[candidate.id]);
  const frontierCandidates = WORLD_REGIONS.filter((candidate) => (
    !exploration.revealed?.[candidate.id]
    && candidate.neighbors.some((neighborId) => exploration.revealed?.[neighborId])
  ));
  const candidates = directCandidates.length ? directCandidates : frontierCandidates;
  if (!candidates.length) return next;
  const discoveryChance = clamp(
    (ok ? 0.28 : 0.08)
      + (hasCompletedProject(state, 'trail-markers') ? 0.18 : 0)
      + (canSelectActionZone(state) ? 0.06 : 0),
    0,
    0.72,
  );
  if (rng() >= discoveryChance) return next;
  const index = Math.min(candidates.length - 1, Math.floor(clamp(Number(rng()), 0, 0.999999) * candidates.length));
  const discovered = candidates[index];
  const rewards = discovered.discoveryReward || [];
  next = {
    ...next,
    inventory: addItems(next.inventory, rewards),
    exploration: {
      ...next.exploration,
      revealed: { ...next.exploration.revealed, [discovered.id]: true },
      lastDiscoveredId: discovered.id,
      discoverySerial: Number(next.exploration.discoverySerial || 0) + 1,
    },
  };
  return addLog(next, `새 지역 발견: ${discovered.name}. ${discovered.landmark}${rewards.length ? ` · 발견 보상 ${formatGains(rewards)}` : ''}.`);
}

function rollZoneGains(state, entries, rng = Math.random, context = {}) {
  const bonusChance = zoneBonusQuantityChance(state, context);
  return entries.reduce((gains, [id, qty, chance = 1]) => {
    if (rng() > zoneEntryChance(state, chance, context)) return gains;
    gains.push([id, qty + (rng() < bonusChance ? 1 : 0)]);
    return gains;
  }, []);
}

function expectedZoneGains(state, action, actorId, requestedRegionId) {
  const regions = canSelectActionZone(state)
    ? [resolveActionRegion(state, requestedRegionId, () => 0)]
    : revealedActionRegions(state);
  const totals = {};
  const regionWeight = regions.length ? 1 / regions.length : 1;
  regions.forEach((region) => {
    const zone = ZONES.find((row) => row.id === region.zoneId) || ZONES[0];
    const successChance = actionChanceForRegion(state, actorId, action, region);
    const context = { action, zoneId: zone.id, regionId: region.id, region };
    const bonusChance = zoneBonusQuantityChance(state, context);
    (zone[action] || []).forEach(([itemId, qty, chance = 1]) => {
      const expected = successChance * regionWeight * zoneEntryChance(state, chance, context) * (Number(qty || 0) + bonusChance);
      totals[itemId] = Number(totals[itemId] || 0) + expected;
    });
  });
  return Object.entries(totals)
    .map(([itemId, expected]) => ({ itemId, name: itemName(itemId), expected }))
    .sort((a, b) => b.expected - a.expected || a.name.localeCompare(b.name, 'ko-KR'));
}

function expectedGainText(rows, detailed = false) {
  if (!rows.length) return '기대 획득 없음';
  const digits = detailed ? 2 : 1;
  return rows.slice(0, 5).map((row) => `${row.name} ${row.expected.toFixed(digits)}`).join(' · ');
}

export function actionForecastRows(state, actorId, requestedRegionId, recipeId) {
  const current = normalizeState(state);
  const actor = getActor(current, actorId);
  const zoneSelectionUnlocked = canSelectActionZone(current);
  const region = resolveActionRegion(current, requestedRegionId, () => 0);
  const precise = hasTechPassive(current, 'FORECAST_DETAIL_UP');
  const gatherChance = regionalActionChance(current, actorId, 'gather', requestedRegionId);
  const huntChance = regionalActionChance(current, actorId, 'hunt', requestedRegionId);
  const gatherGains = expectedZoneGains(current, 'gather', actorId, requestedRegionId);
  const huntGains = expectedZoneGains(current, 'hunt', actorId, requestedRegionId);
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const recipeInfo = recipeUnlockInfo(current, recipe.id);
  const craftChance = recipeInfo.unlocked ? actionChance(current, actorId, 'craft', recipe.baseChance - 0.18) : 0;
  const craftGains = Object.entries(recipe.reward || {}).map(([itemId, qty]) => ({
    itemId,
    name: itemName(itemId),
    expected: Number(qty || 0) * craftChance,
  }));
  const foodId = ['packed_ration', 'cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .find((id) => ITEMS[id]?.type === 'food' && Number(current.inventory[id] || 0) > 0) || '';
  const researchEstimate = researchActionEstimate(current, actorId);
  const selectedTech = getTech(current.research.selectedTechId);
  const restHeal = 4
    + (hasTechPassive(current, 'REST_HEAL_UP') ? 4 : 0)
    + (hasTechPassive(current, 'REST_HEAL_UP_2') ? 4 : 0)
    + (hasTechPassive(current, 'REST_HEAL_UP_3') ? 5 : 0);
  const restStamina = Math.min(
    Math.max(0, 100 - Number(actor?.stamina || 0)),
    42 + Number(current.camp.shelterLevel || 0) * 8,
  );
  const revealedCount = revealedActionRegions(current).length;
  const locationLabel = zoneSelectionUnlocked ? region.name : `탐사된 ${revealedCount}개 지역 평균`;

  return [
    {
      id: 'gather',
      label: '채집',
      chancePct: Math.round(gatherChance * 100),
      context: locationLabel,
      outcome: expectedGainText(gatherGains, precise),
      cost: `AP 1 · ST ${staminaCostWithEquipment(current, actorId, 'gather', 15)}`,
    },
    {
      id: 'hunt',
      label: '사냥',
      chancePct: Math.round(huntChance * 100),
      context: locationLabel,
      outcome: expectedGainText(huntGains, precise),
      cost: `AP 1 · ST ${staminaCostWithEquipment(current, actorId, 'hunt', 24)} · 기대 피해 ${((1 - huntChance) * huntFailureDamage(current)).toFixed(1)}`,
    },
    {
      id: 'craft',
      label: '제작',
      chancePct: Math.round(craftChance * 100),
      context: recipe.name,
      outcome: recipeInfo.unlocked ? expectedGainText(craftGains, precise) : recipeInfo.lockedReason,
      cost: `AP 1 · ${formatRequires(recipe.requires)} · ST ${staminaCostWithEquipment(current, actorId, 'craft', 20)}`,
      locked: !recipeInfo.unlocked,
    },
    {
      id: 'consume',
      label: '식사',
      chancePct: 100,
      context: foodId ? itemName(foodId) : '보유 음식 없음',
      outcome: foodId ? `허기 -${foodNutritionValue(current, foodId)} · HP +${foodHealValue(current, foodId)}` : '채집이나 사냥으로 음식을 확보하세요.',
      cost: foodId ? `${itemName(foodId)} 1개 · AP 1` : '실행 불가',
      locked: !foodId,
    },
    {
      id: 'rest',
      label: '휴식',
      chancePct: 100,
      context: `대피소 Lv.${Number(current.camp.shelterLevel || 0)}`,
      outcome: `ST +${restStamina} · HP +${restHeal} · 체온 안정`,
      cost: 'AP 1',
    },
    {
      id: 'research',
      label: '연구',
      chancePct: researchEstimate.unlocked ? 100 : 0,
      context: researchEstimate.unlocked ? selectedTech?.name || '선택 기술 없음' : '수동 연구 행동 잠김',
      outcome: researchEstimate.unlocked && selectedTech
        ? `연구 포인트 +${researchEstimate.points}`
        : researchEstimate.lockedReason,
      cost: researchEstimate.unlocked ? `AP 1 · ST ${researchEstimate.staminaCost}` : '턴/일일 자동 연구만 진행',
      locked: !researchEstimate.unlocked || !selectedTech,
    },
  ];
}

export function runGatherAction(state, actorId, regionId, options = {}) {
  const rng = options.rng || Math.random;
  const current = normalizeState(state);
  const region = resolveActionRegion(current, regionId, rng);
  const zone = ZONES.find((row) => row.id === region.zoneId) || ZONES[0];
  const actor = getActor(current, actorId);
  const chance = actionChanceForRegion(current, actorId, 'gather', region);
  const ok = rng() < chance;
  let next = current;
  if (ok) {
    const gains = rollZoneGains(current, zone.gather, rng, { action: 'gather', zoneId: zone.id, regionId: region.id, region });
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, gather: Number(next.counters.gather || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 채집 성공. ${region.name}에서 ${formatGains(gains)}.`);
  } else {
    next = addLog(next, `${actor.name}의 채집 실패. ${region.name}의 날씨와 지형이 좋지 않았습니다.`);
  }
  next = addDialogueLog(next, actorId, 'gather', ok ? 'success' : 'fail', rng);
  next = applyExplorationEvent(next, { actorId, action: 'gather', zoneId: zone.id, ok, rng });
  next = discoverRegionAfterAction(next, region, ok, rng);
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'gather', ok }), actorId, staminaCostWithEquipment(current, actorId, 'gather', 15), 3, options);
}

export function runHuntAction(state, actorId, regionId, options = {}) {
  const rng = options.rng || Math.random;
  const current = normalizeState(state);
  const region = resolveActionRegion(current, regionId, rng);
  const zone = ZONES.find((row) => row.id === region.zoneId) || ZONES[0];
  const actor = getActor(current, actorId);
  const chance = actionChanceForRegion(current, actorId, 'hunt', region);
  const ok = rng() < chance;
  let next = current;
  if (ok) {
    const gains = rollZoneGains(current, zone.hunt, rng, { action: 'hunt', zoneId: zone.id, regionId: region.id, region });
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, hunt: Number(next.counters.hunt || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 사냥 성공. ${region.name}에서 ${formatGains(gains)}.`);
  } else {
    const target = getActor(next, actorId);
    const damage = huntFailureDamage(next);
    next = updateActor(next, actorId, { hp: clamp(Number(target.hp || 0) - damage, 0, 100) });
    next = addLog(next, `${actor.name}의 사냥 실패. ${region.name}에서 반격으로 HP -${damage}.`);
  }
  next = addDialogueLog(next, actorId, 'hunt', ok ? 'success' : 'fail', rng);
  next = applyExplorationEvent(next, { actorId, action: 'hunt', zoneId: zone.id, ok, rng });
  next = discoverRegionAfterAction(next, region, ok, rng);
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'hunt', ok }), actorId, staminaCostWithEquipment(current, actorId, 'hunt', 24), 5, options);
}

export function runCraftAction(state, actorId, recipeId, options = {}) {
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const actor = getActor(state, actorId);
  const unlock = recipeUnlockInfo(state, recipe.id);
  if (!unlock.unlocked) return addLog(state, unlock.lockedReason);
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
  const foodId = ['packed_ration', 'cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .find((id) => ITEMS[id]?.type === 'food' && Number(state.inventory[id] || 0) > 0) || '';
  if (!foodId) return addLog(state, '먹을 음식이 없습니다. 채집이나 사냥으로 식량을 확보하세요.');
  const nutrition = foodNutritionValue(state, foodId);
  const heal = foodHealValue(state, foodId);
  const warmth = foodId === 'cooked_meat' ? 1.1 : foodId === 'packed_ration' ? 0.4 : foodId === 'herb_tonic' ? 0.8 : 0;
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
  const heal = 4
    + (hasTechPassive(state, 'REST_HEAL_UP') ? 4 : 0)
    + (hasTechPassive(state, 'REST_HEAL_UP_2') ? 4 : 0)
    + (hasTechPassive(state, 'REST_HEAL_UP_3') ? 5 : 0);
  const warmth = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 0.75 : 0.25;
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(target.stamina || 0) + 42 + Number(state.camp.shelterLevel || 0) * 8, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
    bodyTemp: clamp(Number(target.bodyTemp ?? 37) + warmth, 25, 39),
  });
  next = addLog(next, `${actor.name}이(가) 휴식했습니다. 스태미나와 HP를 회복하고 체온을 안정시켰습니다.`);
  next = addDialogueLog(next, actorId, 'rest', 'success', options.rng || Math.random);
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  next = autoResearchForTurn(next);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function runCampAction(state, actorId, kind, options = {}) {
  const actor = getActor(state, actorId);
  const researchWasUnlocked = researchSystemStatus(state).unlocked;
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
  if (!researchWasUnlocked && researchSystemStatus(next).unlocked) {
    next = addLog(next, '부족 발전 단계 달성: 모닥불, 대피소, 작업대가 갖춰져 연구 체계가 해금되었습니다.');
    next = applyResearchBreakthroughs(next);
  }
  next = addDialogueLog(next, actorId, 'camp', 'success', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'camp', ok: true, rng: options.rng || Math.random });
  next.counters = { ...next.counters, camp: Number(next.counters.camp || 0) + 1 };
  const campStaminaCost = Math.max(
    4,
    staminaCostWithEquipment(state, actorId, 'camp', 14)
      - bookCampStaminaReduction(next)
      - (hasTechPassive(next, 'CAMP_ACTION_STAMINA_DOWN') ? 3 : 0),
  );
  return afterAction(recordResearchEvent(next, { kind: 'camp', campKind: kind }), actorId, campStaminaCost, 2, options);
}

function livingParty(state) {
  return state.party.filter((member) => Number(member.hp || 0) > 0);
}

function foodAvailable(state) {
  return ['packed_ration', 'cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
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
  if (!recipeUnlockInfo(state, recipe.id).unlocked) return false;
  return true;
}

function pickAutoRecipe(state) {
  const priority = [
    'packed_ration',
    'jerky',
    'herb_tonic',
    'twine',
    'clay_tablet',
    'weather_totem',
    'bone_awl',
    'stone_axe',
    'bow',
    'obsidian_blade',
    'flint_knife',
    'bone_pick',
    'spear',
    'dino_scale_vest',
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
    + Number(state.inventory.packed_ration || 0)
    + Number(state.inventory.cooked_meat || 0)
    + Number(state.inventory.herb_tonic || 0);
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
