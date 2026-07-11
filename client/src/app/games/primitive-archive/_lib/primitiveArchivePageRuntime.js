import {
  ITEMS,
  RECIPES,
  TECH_TIER_DEFS,
  itemName,
} from './primitiveArchiveEngine';

export const PARTY_SORT_OPTIONS = [
  { value: 'default', label: '기본' },
  { value: 'recommend', label: '추천' },
  { value: 'stamina', label: '스태미나' },
  { value: 'success', label: '성공률' },
];

export const BASE_CAMP_ACTIONS = [
  { id: 'fuel', label: '연료 넣기 · 나무 1' },
  { id: 'fire', label: '모닥불 강화' },
  { id: 'shelter', label: '대피소 강화' },
  { id: 'workbench', label: '작업대 제작' },
  { id: 'cook', label: '고기 굽기' },
];

export function clampRatio(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

export function chanceText(value) {
  return `${Math.round(clampRatio(value) * 100)}%`;
}

export function roleActionForMember(member) {
  if (member?.role === '사냥') return 'hunt';
  if (member?.role === '제작') return 'craft';
  return 'gather';
}

export function actionLabel(action) {
  if (action === 'hunt') return '사냥';
  if (action === 'craft') return '제작';
  if (action === 'rest') return '휴식';
  if (action === 'camp') return '캠프';
  if (action === 'eat') return '식사';
  if (action === 'research') return '연구';
  return '채집';
}

export function vitalBadges(member) {
  const badges = [];
  if (Number(member.hp || 0) <= 0) badges.push('탈진');
  else if (Number(member.hp || 0) <= 35) badges.push('부상');
  if (Number(member.hunger || 0) >= 80) badges.push('허기');
  if (Number(member.bodyTemp ?? 37) <= 34.5) badges.push('저체온');
  if (Number(member.stamina || 0) <= 25) badges.push('피로');
  if (!badges.length) badges.push('양호');
  return badges;
}

export function equipmentSuccessText(item) {
  const parts = Object.entries(item?.successAdd || {})
    .map(([action, value]) => `${actionLabel(action)} +${Math.round(Number(value || 0) * 100)}%`);
  const stamina = Object.entries(item?.staminaAdd || {})
    .map(([action, value]) => `${actionLabel(action)} 피로 ${Number(value || 0)}`);
  if (Number(item?.insulation || 0) > 0) parts.push(`보온 +${Number(item.insulation || 0)}`);
  if (stamina.length) parts.push(...stamina);
  return parts.join(' · ') || '기본 장비';
}

export function equipmentChoiceScore(itemId, actor, mode, weather) {
  const item = ITEMS[itemId];
  if (!item || item.type !== 'equip') return -Infinity;
  const preferredAction = roleActionForMember(actor);
  const weatherCold = Math.max(0, Number(weather?.cold || 0));
  let score = Number(item.insulation || 0) * (mode === 'weather' ? 9 + weatherCold * 0.35 : 3 + weatherCold * 0.12);
  Object.entries(item.successAdd || {}).forEach(([action, value]) => {
    const actionWeight = action === preferredAction
      ? mode === 'weather' ? 80 : 150
      : mode === 'weather' ? 55 : 65;
    score += Number(value || 0) * actionWeight;
  });
  Object.entries(item.staminaAdd || {}).forEach(([action, value]) => {
    score += -Number(value || 0) * (action === preferredAction ? 8 : action === 'rest' ? 5 : 6);
  });
  score -= Number(item.weight || 0) * (mode === 'weather' ? 0.3 : 0.2);
  return score;
}

export const RESEARCH_ERA_LABELS = {
  PRIMITIVE: '원시',
  NEOLITHIC: '신석기',
  ANCIENT: '고대',
  CLASSICAL: '고전',
};

export const RESEARCH_TAG_LABELS = {
  SURVIVAL: '생존',
  CRAFT: '제작',
  CAMP: '캠프',
  MILITARY: '군사',
  SCIENCE: '과학',
  CULTURE: '문화',
  SPIRITUAL: '영성',
  CIVICS: '행정',
};

export const CAMP_UNLOCK_LABELS = {
  fire: '모닥불',
  shelter: '대피소',
  workbench: '작업대',
  archive_room: '기록실',
  scribe_desk: '필사대',
  library_shelf: '서가',
};

export const PASSIVE_UNLOCK_LABELS = {
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

export function researchStatusLabel(tech) {
  if (tech.completed) return '완료';
  if (tech.selected) return '선택';
  if (tech.available) return '가능';
  if (tech.eurekaStatus?.blocked || tech.inspirationStatus?.blocked) return '단서 확보';
  return '잠김';
}

export function researchUnlockText(tech) {
  const recipes = (tech.unlocks?.recipes || [])
    .map((recipeId) => RECIPES.find((recipe) => recipe.id === recipeId)?.name || recipeId);
  const camps = (tech.unlocks?.camp || []).map((campId) => CAMP_UNLOCK_LABELS[campId] || campId);
  const passives = (tech.unlocks?.passives || []).map((passiveId) => PASSIVE_UNLOCK_LABELS[passiveId] || passiveId.replaceAll('_', ' '));
  return [
    recipes.length ? `제작 ${recipes.join(', ')}` : '',
    camps.length ? `시설 ${camps.join(', ')}` : '',
    passives.length ? `효과 ${passives.join(', ')}` : '',
  ].filter(Boolean).join(' · ') || '기본 연구 보너스';
}

export function researchNextStepText(tech) {
  if (tech.completed) return '이미 완료된 연구입니다.';
  const breakthroughText = [
    tech.eureka?.desc ? `유레카 ${tech.eureka.desc}` : '',
    tech.inspiration?.desc ? `영감 ${tech.inspiration.desc}` : '',
  ].filter(Boolean).join(' · ');
  if (!tech.available) {
    return `선행 연구: ${(tech.missingPrereqs || []).join(', ') || '없음'}${breakthroughText ? ` · ${breakthroughText}` : ''}`;
  }
  if (tech.eurekaStatus?.note) return tech.eurekaStatus.note;
  return `진행 ${tech.progress}/${tech.cost}${breakthroughText ? ` · ${breakthroughText}` : ''}`;
}

const RESEARCH_LAYOUT_TAG_ORDER = [
  'SURVIVAL',
  'CAMP',
  'CRAFT',
  'SCIENCE',
  'CULTURE',
  'SPIRITUAL',
  'MILITARY',
  'CIVICS',
];

function researchLayoutGroup(tech) {
  return (tech.tags || []).find((tag) => RESEARCH_LAYOUT_TAG_ORDER.includes(tag)) || 'OTHER';
}

function researchLayoutAnchor(tech, laneCount) {
  const group = researchLayoutGroup(tech);
  const groupIndex = RESEARCH_LAYOUT_TAG_ORDER.indexOf(group);
  const normalizedIndex = groupIndex < 0 ? RESEARCH_LAYOUT_TAG_ORDER.length / 2 : groupIndex;
  return RESEARCH_LAYOUT_TAG_ORDER.length > 1
    ? normalizedIndex / (RESEARCH_LAYOUT_TAG_ORDER.length - 1) * Math.max(0, laneCount - 1)
    : 0;
}

function assignResearchColumnSlots(column, scoreById) {
  const sorted = [...column].sort((left, right) => (
    Number(scoreById[left.id] || 0) - Number(scoreById[right.id] || 0)
    || RESEARCH_LAYOUT_TAG_ORDER.indexOf(researchLayoutGroup(left)) - RESEARCH_LAYOUT_TAG_ORDER.indexOf(researchLayoutGroup(right))
    || left.name.localeCompare(right.name, 'ko-KR')
  ));
  return sorted.map((tech, slot) => ({ tech, slot }));
}

function researchEdgeLane(edgeId) {
  let hash = 0;
  for (let index = 0; index < edgeId.length; index += 1) hash = ((hash << 5) - hash + edgeId.charCodeAt(index)) | 0;
  return Math.abs(hash) % 5;
}

export function buildResearchMap(techs) {
  const eraOrder = ['PRIMITIVE', 'NEOLITHIC', 'ANCIENT', 'CLASSICAL', 'MEDIEVAL'];
  const nodeWidth = 188;
  const nodeHeight = 94;
  const columnGap = 54;
  const rowGap = 14;
  const padding = 24;
  const headerHeight = 52;
  const tierDefs = TECH_TIER_DEFS.filter((definition) => techs.some((tech) => tech.tier === definition.tier));

  const columns = techs.reduce((result, tech) => {
    const tier = Math.max(1, Number(tech.tier || 1));
    if (!result[tier]) result[tier] = [];
    result[tier].push(tech);
    return result;
  }, {});
  const tierOrder = Object.keys(columns).map(Number).sort((a, b) => a - b);
  const laneCount = Math.max(1, ...tierOrder.map((tier) => columns[tier].length));
  const dependentIds = Object.fromEntries(techs.map((tech) => [tech.id, []]));
  techs.forEach((tech) => {
    (tech.prereqs || []).forEach((prereqId) => {
      if (dependentIds[prereqId]) dependentIds[prereqId].push(tech.id);
    });
  });
  let scoreById = Object.fromEntries(techs.map((tech) => [tech.id, researchLayoutAnchor(tech, laneCount)]));
  for (let pass = 0; pass < 10; pass += 1) {
    scoreById = Object.fromEntries(techs.map((tech) => {
      if (!(tech.prereqs || []).length) return [tech.id, researchLayoutAnchor(tech, laneCount)];
      const neighborScores = [
        ...(tech.prereqs || []),
        ...(dependentIds[tech.id] || []),
      ].map((techId) => scoreById[techId]).filter(Number.isFinite);
      if (!neighborScores.length) return [tech.id, researchLayoutAnchor(tech, laneCount)];
      const neighborAverage = neighborScores.reduce((sum, score) => sum + score, 0) / neighborScores.length;
      return [tech.id, researchLayoutAnchor(tech, laneCount) * 0.62 + neighborAverage * 0.38];
    }));
  }

  const nodes = tierOrder.flatMap((tier) => (
    assignResearchColumnSlots(columns[tier], scoreById).map(({ tech, slot }) => ({
      ...tech,
      tier,
      rowIndex: slot,
      layoutGroup: researchLayoutGroup(tech),
      x: padding + (tier - 1) * (nodeWidth + columnGap),
      y: padding + headerHeight + slot * (nodeHeight + rowGap),
      width: nodeWidth,
      height: nodeHeight,
      statusLabel: researchStatusLabel(tech),
      unlockText: researchUnlockText(tech),
      nextStepText: researchNextStepText(tech),
    }))
  ));
  const positionedById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const edges = nodes.flatMap((node) => (node.prereqs || []).map((prereqId) => {
    const source = positionedById[prereqId];
    if (!source) return null;
    const startX = source.x + source.width;
    const startY = source.y + source.height / 2;
    const endX = node.x;
    const endY = node.y + node.height / 2;
    const edgeId = `${prereqId}-${node.id}`;
    const tierSpan = Math.max(1, node.tier - source.tier);
    const sourceGutterX = startX + columnGap / 2;
    const targetGutterX = endX - columnGap / 2;
    const busY = headerHeight + 6 + researchEdgeLane(edgeId) * 3;
    const path = tierSpan > 1
      ? `M ${startX} ${startY} H ${sourceGutterX} V ${busY} H ${targetGutterX} V ${endY} H ${endX}`
      : `M ${startX} ${startY} H ${sourceGutterX} V ${endY} H ${endX}`;
    return {
      id: edgeId,
      from: prereqId,
      to: node.id,
      path,
      pathClass: [
        tierSpan > 1 ? 'is-long' : '',
        source.layoutGroup !== node.layoutGroup ? 'is-cross-branch' : '',
      ].filter(Boolean).join(' '),
      complete: Boolean(source.completed && node.completed),
      available: Boolean(source.completed && (node.available || node.selected)),
    };
  }).filter(Boolean));
  const tierHeaders = tierDefs.map((definition) => ({
    ...definition,
    count: columns[definition.tier]?.length || 0,
    x: padding + (definition.tier - 1) * (nodeWidth + columnGap),
    width: nodeWidth,
  }));
  const eras = eraOrder.map((era) => {
    const rows = nodes.filter((node) => node.era === era);
    return {
      era,
      label: RESEARCH_ERA_LABELS[era],
      completed: rows.filter((node) => node.completed).length,
      total: rows.length,
    };
  }).filter((era) => era.total > 0);

  return {
    edges,
    eras,
    height: padding * 2 + headerHeight + laneCount * nodeHeight + Math.max(0, laneCount - 1) * rowGap,
    nodes,
    tierCount: tierDefs.length,
    tierHeaders,
    width: padding * 2 + tierDefs.length * nodeWidth + Math.max(0, tierDefs.length - 1) * columnGap,
  };
}

export const BASE_START_INVENTORY = { wood: 2, stone: 2, fiber: 2, berry: 2 };
export const FALLBACK_DIFFICULTY_TAGS = {
  easy: '입문',
  normal: '표준',
  hard: '압박',
  nightmare: '극한',
};

export function multiplierText(value) {
  return `${Math.round(Number(value || 1) * 100)}%`;
}

export function startInventoryText(preset) {
  const inventory = { ...BASE_START_INVENTORY };
  Object.entries(preset?.startInventory || {}).forEach(([itemId, qty]) => {
    const nextQty = Math.max(0, Number(inventory[itemId] || 0) + Number(qty || 0));
    if (nextQty > 0) inventory[itemId] = nextQty;
    else delete inventory[itemId];
  });
  return Object.entries(inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([itemId, qty]) => `${itemName(itemId)} ${qty}`)
    .join(' · ');
}
