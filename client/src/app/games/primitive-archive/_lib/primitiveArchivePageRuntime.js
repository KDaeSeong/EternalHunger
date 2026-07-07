import {
  ITEMS,
  RECIPES,
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
};

export const CAMP_UNLOCK_LABELS = {
  fire: '모닥불',
  shelter: '대피소',
  workbench: '작업대',
  archive_room: '기록실',
  scribe_desk: '필사대',
  library_shelf: '서가',
};

export function researchStatusLabel(tech) {
  if (tech.completed) return '완료';
  if (tech.selected) return '선택';
  if (tech.available) return '가능';
  if (tech.eurekaStatus?.blocked) return '단서 확보';
  return '잠김';
}

export function researchUnlockText(tech) {
  const recipes = (tech.unlocks?.recipes || [])
    .map((recipeId) => RECIPES.find((recipe) => recipe.id === recipeId)?.name || recipeId);
  const camps = (tech.unlocks?.camp || []).map((campId) => CAMP_UNLOCK_LABELS[campId] || campId);
  const passives = (tech.unlocks?.passives || []).map((passiveId) => passiveId.replaceAll('_', ' '));
  return [
    recipes.length ? `제작 ${recipes.join(', ')}` : '',
    camps.length ? `시설 ${camps.join(', ')}` : '',
    passives.length ? `효과 ${passives.length}개` : '',
  ].filter(Boolean).join(' · ') || '기본 연구 보너스';
}

export function researchNextStepText(tech) {
  if (tech.completed) return '이미 완료된 연구입니다.';
  if (!tech.available) {
    return `선행 연구: ${(tech.missingPrereqs || []).join(', ') || '없음'} · 유레카: ${tech.eureka?.desc || '없음'}`;
  }
  if (tech.eurekaStatus?.note) return tech.eurekaStatus.note;
  return `진행 ${tech.progress}/${tech.cost} · 유레카: ${tech.eureka?.desc || '없음'}`;
}

export function buildResearchMap(techs) {
  const byEra = techs.reduce((result, tech) => {
    const era = tech.era || 'PRIMITIVE';
    if (!result[era]) result[era] = [];
    result[era].push({
      ...tech,
      statusLabel: researchStatusLabel(tech),
      unlockText: researchUnlockText(tech),
      nextStepText: researchNextStepText(tech),
    });
    return result;
  }, {});
  return Object.entries(byEra).map(([era, rows]) => ({
    era,
    label: RESEARCH_ERA_LABELS[era] || era,
    completed: rows.filter((tech) => tech.completed).length,
    total: rows.length,
    rows,
  }));
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
