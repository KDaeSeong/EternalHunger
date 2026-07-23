import {
  ITEMS,
  RECIPES,
  TECH_TIER_DEFS,
  CIVIC_TIER_DEFS,
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
  MEDIEVAL: '중세',
  EARLY_MODERN: '근세',
  MODERN_EARLY: '전기 근대',
  MODERN_LATE: '후기 근대',
};

export const RESEARCH_BRANCH_LABELS = {
  FAITH: '신앙',
  NATURAL_PHILOSOPHY: '이학',
  LITERATURE: '문학',
  MILITARY: '군사',
  SURVIVAL: '생존',
  ENGINEERING: '기술',
};

const RESEARCH_BRANCH_ACTIONS = {
  FAITH: 'counsel',
  NATURAL_PHILOSOPHY: 'research',
  LITERATURE: 'archive',
  MILITARY: 'training',
  SURVIVAL: 'survival',
  ENGINEERING: 'project',
};

export const RESEARCH_TAG_LABELS = {
  SURVIVAL: '생존',
  CRAFT: '제작',
  CAMP: '캠프',
  MILITARY: '군사',
  SCIENCE: '과학',
  CULTURE: '문화',
  SPIRITUAL: '영성',
  CIVICS: '사회',
};

const RESEARCH_TAG_ACTIONS = {
  SURVIVAL: 'survival',
  CRAFT: 'craft',
  CAMP: 'camp',
  MILITARY: 'combat',
  SCIENCE: 'research',
  CULTURE: 'archive',
  SPIRITUAL: 'event',
  CIVICS: 'policy',
};

export function advancementAction(tags, track = 'technology', branch = '') {
  if (RESEARCH_BRANCH_ACTIONS[branch]) return RESEARCH_BRANCH_ACTIONS[branch];
  const matchedTag = (Array.isArray(tags) ? tags : []).find((tag) => RESEARCH_TAG_ACTIONS[tag]);
  return RESEARCH_TAG_ACTIONS[matchedTag] || (track === 'civics' ? 'policy' : 'research');
}

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
  ROAD_RESOURCE_UP: '도로 운반 수익 증가',
  CLASSICAL_MEDICINE_UP: '고전 의학 회복 보너스',
  LEVER_CRAFT_UP: '지레 제작 보정',
  CROP_CALENDAR_YIELD_UP: '경작력 채집 보정',
  AQUEDUCT_RESOURCE_UP: '수도교 자원 수익 증가',
  QUENCHING_CRAFT_UP: '담금질 제작 보정',
  HULL_RIVER_UP: '선체 골조 수변 수익',
  SURGICAL_RECOVERY_UP: '외과 도구 회복 보너스',
  REPUBLIC_COUNCIL_CP_UP: '공화정 사회 제도 보너스',
  CIVIC_RITUAL_RECOVERY_UP: '시민 의례 회복 보너스',
  PUBLIC_DEBATE_INSPIRATION_UP: '공개 토론 영감 강화',
  ATHLETIC_MORALE_UP: '경기 제전 공동체 보너스',
  RHETORIC_CULTURE_UP: '수사학 문화 보너스',
  CIVIC_LAW_PARTY_CAP_UP: '시민법 파티 정원',
  IMPERIAL_ADMIN_AUTO_UP: '제국 행정 자동 연구 보너스',
  CLASSICAL_EDUCATION_RESEARCH_UP: '고전 교육 연구 보너스',
  THREE_FIELD_YIELD_UP: '삼포농법 수익 증가',
  BLOOMERY_CRAFT_UP: '괴철로 제작 보정',
  LATEEN_RIVER_UP: '삼각돛 수변 수익 증가',
  HERBAL_MEDICINE_UP: '약초 의학 회복',
  MONASTIC_RECOVERY_UP: '수도 규율 회복',
  FEUDAL_PARTY_CAP_UP: '봉건 파티 정원',
  EPIC_CULTURE_UP: '서사 문화 증가',
  HEAVY_PLOUGH_YIELD_UP: '중경 식물 수익 증가',
  STEEL_CRAFT_UP: '강철 도구 제작 보정',
  WATERMILL_RESEARCH_UP: '수차 연구 보너스',
  NAVIGATION_RIVER_UP: '항해 수변 수익 증가',
  SCHOLASTIC_RESEARCH_UP: '스콜라 연구 보너스',
  CHIVALRY_HUNT_UP: '기사도 사냥 보정',
  COURT_CULTURE_UP: '궁정 문화 증가',
  CROP_ROTATION_YIELD_UP: '윤작 식물 수익 증가',
  MECHANICAL_CLOCK_RESEARCH_UP: '시계 연구 보너스',
  MASONRY_WEATHER_DOWN: '석조 기후 피해 감소',
  CHAINMAIL_RISK_DOWN: '사슬 갑옷 부상 감소',
  CATHEDRAL_RESEARCH_UP: '성당 학교 연구 보너스',
  GUILD_YIELD_UP: '길드 자원 수익 증가',
  CHRONICLE_LOG_UP: '연대기 로그 확장',
  PAPER_RESEARCH_UP: '제지 연구 보너스',
  OPTICAL_SCIENCE_RARE_UP: '광학 희귀 발견 증가',
  WINDMILL_RESOURCE_UP: '풍차 자원 수익 증가',
  CASTLE_DEFENSE_UP: '성곽 방어 보정',
  NATURAL_PHILOSOPHY_EUREKA_UP: '자연 철학 유레카 강화',
  MILITARY_ORDER_RISK_DOWN: '기사단 부상 감소',
  SACRED_MUSIC_RECOVERY_UP: '성가 회복과 문화',
  PRINTING_RESEARCH_UP: '목판 인쇄 연구 보너스',
  MEDIEVAL_MEDICINE_UP: '중세 의학 회복',
  ADVANCED_METALLURGY_CRAFT_UP: '고급 제철 제작 보정',
  OCEAN_NAVIGATION_YIELD_UP: '원양 항해 수변 수익',
  UNIVERSITY_RESEARCH_UP: '대학 연구 보너스',
  URBAN_CAMP_SCORE_UP: '도시 캠프 점수',
  ROMANCE_INSPIRATION_UP: '기사 문학 영감 강화',
  MECHANICAL_ENGINEERING_UP: '기계 공학 제작·작업 보정',
  PLATE_ARMOR_RISK_DOWN: '판금 갑옷 부상 감소',
  DEEP_WATER_SHIPBUILDING_UP: '원양 조선 수변 수익',
  IMPROVED_AGRICULTURE_YIELD_UP: '개량 농업 수익 증가',
  HUMANISM_BREAKTHROUGH_UP: '인문주의 발견 보너스',
  ESTATES_PARTY_CAP_UP: '의회 파티 정원',
  CODIFIED_THEOLOGY_RECOVERY_UP: '교리 회복과 문화',
  MOVABLE_TYPE_RESEARCH_UP: '활판 인쇄 연구 보너스',
  GUNPOWDER_HUNT_UP: '화약 사냥 보정',
  ANATOMY_RECOVERY_UP: '해부학 회복 보너스',
  OCEANIC_MAP_RARE_UP: '대양 지도 희귀 발견',
  ARQUEBUS_HUNT_UP: '조총 사냥 보정',
  PRINT_WORKSHOP_RESEARCH_UP: '인쇄 공방 연구 보너스',
  BOTANY_GATHER_UP: '식물 분류 채집 보정',
  CELESTIAL_NAVIGATION_RARE_UP: '천문 항법 희귀 발견',
  TRACE_FORT_DAMAGE_DOWN: '성형 요새 피해 감소',
  MICROSCOPY_RARE_UP: '현미경 희귀 발견',
  DRAINAGE_RESOURCE_UP: '배수 펌프 자원 수익',
  NEW_CROP_YIELD_UP: '신작물 재배 수익',
  SCIENTIFIC_METHOD_EUREKA_UP: '과학적 방법 유레카 강화',
  GALLEON_RIVER_UP: '갤리온 수변 수익',
  FIELD_ARTILLERY_HUNT_UP: '야전 포병 사냥 보정',
  PHARMACOPOEIA_RECOVERY_UP: '약전 회복 보너스',
  STEAM_PUMP_RESOURCE_UP: '증기 펌프 자원 수익',
  PRECISION_CLOCK_RESEARCH_UP: '정밀 시계 연구 보너스',
  SEED_SELECTION_YIELD_UP: '종자 선별 수익',
  COPPERPLATE_CULTURE_UP: '동판 인쇄 문화 보너스',
  EARLY_STEAM_ENGINE_PRODUCTION_UP: '초기 증기기관 생산 보정',
  CLASSICAL_MECHANICS_RESEARCH_UP: '고전 역학 연구 보너스',
  SHIP_OF_LINE_DEFENSE_UP: '전열함 방어 보정',
  MODERN_AGRONOMY_YIELD_UP: '근대 농학 수익',
  REFORMATION_CULTURE_UP: '종교 개혁 문화 보너스',
  RENAISSANCE_HUMANISM_BREAKTHROUGH_UP: '르네상스 인문주의 발견 보너스',
  STANDING_ARMY_PARTY_CAP_UP: '상비군 파티 정원',
  EMPIRICISM_EUREKA_UP: '경험 철학 유레카 강화',
  PATRONAGE_CULTURE_UP: '후원 문화 보너스',
  TOLERANCE_RECOVERY_UP: '교파 공존 회복 보너스',
  BUREAUCRACY_AUTO_RESEARCH_UP: '관료제 자동 연구 보너스',
  MARITIME_LAW_RESOURCE_UP: '해양법 수변 수익',
  MILITARY_REVOLUTION_HUNT_UP: '군사 혁신 사냥 보정',
  SCIENTIFIC_SOCIETY_RESEARCH_UP: '과학 학회 연구 보너스',
  PUBLIC_SPHERE_INSPIRATION_UP: '공론장 영감 강화',
  POOR_RELIEF_RECOVERY_UP: '빈민 구휼 회복 보너스',
  ENLIGHTENED_THEOLOGY_CULTURE_UP: '계몽 신학 문화 보너스',
  SOCIAL_CONTRACT_PARTY_CAP_UP: '사회 계약 파티 정원',
  PROFESSIONAL_OFFICERS_RISK_DOWN: '직업 장교단 위험 감소',
  ENLIGHTENMENT_BREAKTHROUGH_UP: '계몽주의 발견 보너스',
  CONSTITUTIONAL_ASSEMBLY_SCORE_UP: '입헌 의회 기록 점수',
  PUBLIC_HEALTH_RECOVERY_UP: '공중 보건 회복 보너스',
  MODERN_ENGINEERING_TECH_STACK: '산업 공학 누적 보너스',
  MODERN_SCIENCE_TECH_STACK: '근대 과학 누적 보너스',
  MODERN_SURVIVAL_TECH_STACK: '근대 생존 기술 누적 보너스',
  MODERN_MILITARY_TECH_STACK: '근대 군사 기술 누적 보너스',
  MODERN_MEDIA_TECH_STACK: '근대 기록 기술 누적 보너스',
  MODERN_MEDICAL_TECH_STACK: '근대 의료 기술 누적 보너스',
  MODERN_ENGINEERING_CIVIC_STACK: '산업 제도 누적 보너스',
  MODERN_SCIENCE_CIVIC_STACK: '전문 학술 제도 누적 보너스',
  MODERN_SURVIVAL_CIVIC_STACK: '공공 생존 제도 누적 보너스',
  MODERN_MILITARY_CIVIC_STACK: '국민 군사 제도 누적 보너스',
  MODERN_MEDIA_CIVIC_STACK: '대중 문화 제도 누적 보너스',
  MODERN_FAITH_CIVIC_STACK: '인도주의 제도 누적 보너스',
};

export function researchStatusLabel(tech) {
  if (tech.completed) return '완료';
  if (tech.selected) return '선택';
  if (tech.available) return '가능';
  if (tech.eurekaStatus?.blocked || tech.inspirationStatus?.blocked) return '단서 확보';
  return '잠김';
}

export function advancementTierLabel(advancement, track = advancement?.track) {
  const prefix = track === 'civics' ? 'C' : 'T';
  return `${prefix}${Math.max(1, Number(advancement?.tier || 1))}`;
}

const ACTION_UNLOCK_LABELS = {
  logging: '벌목',
  herbal: '약초 채집',
  trap: '덫 사냥',
  farm: '농업',
  herd: '목축',
  fish: '어로',
  mine: '채광',
  quarry: '채석',
};

export function researchUnlockText(tech) {
  const actions = (tech.unlocks?.actions || []).map((actionId) => ACTION_UNLOCK_LABELS[actionId] || actionId);
  const recipes = (tech.unlocks?.recipes || [])
    .map((recipeId) => RECIPES.find((recipe) => recipe.id === recipeId)?.name || recipeId);
  const camps = (tech.unlocks?.camp || []).map((campId) => CAMP_UNLOCK_LABELS[campId] || campId);
  const passives = (tech.unlocks?.passives || []).map((passiveId) => PASSIVE_UNLOCK_LABELS[passiveId] || passiveId.replaceAll('_', ' '));
  return [
    actions.length ? `생업 ${actions.join(', ')}` : '',
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
  const eraOrder = ['PRIMITIVE', 'NEOLITHIC', 'ANCIENT', 'CLASSICAL', 'MEDIEVAL', 'EARLY_MODERN', 'MODERN_EARLY', 'MODERN_LATE'];
  const nodeWidth = 188;
  const nodeHeight = 94;
  const columnGap = 54;
  const rowGap = 14;
  const padding = 24;
  const headerHeight = 52;
  const track = techs.some((tech) => tech.track === 'civics') ? 'civics' : 'technology';
  const tierPrefix = track === 'civics' ? 'C' : 'T';
  const availableTierDefs = track === 'civics' ? CIVIC_TIER_DEFS : TECH_TIER_DEFS;
  const tierDefs = availableTierDefs.filter((definition) => techs.some((tech) => tech.tier === definition.tier));

  const columns = techs.reduce((result, tech) => {
    const tier = Math.max(1, Number(tech.tier || 1));
    if (!result[tier]) result[tier] = [];
    result[tier].push(tech);
    return result;
  }, {});
  const tierOrder = Object.keys(columns).map(Number).sort((a, b) => a - b);
  const tierIndex = Object.fromEntries(tierOrder.map((tier, index) => [tier, index]));
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
      tierLabel: advancementTierLabel(tech, track),
      rowIndex: slot,
      layoutGroup: researchLayoutGroup(tech),
      x: padding + tierIndex[tier] * (nodeWidth + columnGap),
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
    const tierSpan = Math.max(1, Number(tierIndex[node.tier] || 0) - Number(tierIndex[source.tier] || 0));
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
    label: `${tierPrefix}${definition.tier}`,
    x: padding + Number(tierIndex[definition.tier] || 0) * (nodeWidth + columnGap),
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
    minTier: tierOrder[0] || 0,
    maxTier: tierOrder[tierOrder.length - 1] || 0,
    rangeLabel: tierOrder.length ? `${tierPrefix}${tierOrder[0]}-${tierPrefix}${tierOrder[tierOrder.length - 1]}` : '-',
    tierPrefix,
    tierCount: tierDefs.length,
    tierHeaders,
    width: padding * 2 + tierDefs.length * nodeWidth + Math.max(0, tierDefs.length - 1) * columnGap,
  };
}

export const BASE_START_INVENTORY = { wood: 2, stone: 2, fiber: 2, berry: 2 };
export const FALLBACK_DIFFICULTY_TAGS = {
  veryeasy: '이야기',
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
