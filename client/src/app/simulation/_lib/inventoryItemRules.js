import {
  itemDisplayName,
  safeTags,
} from './simulationCommon';

export const DEFAULT_INV_RULES = {
  maxSlots: 10,
  stackMax: { material: 3, consumable: 6, equipment: 1 },
};

export function getInvItemId(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

export function clampInventoryTier(value, category = '') {
  const n = Number(value);
  const maxTier = String(category || '').toLowerCase() === 'equipment' ? 6 : 4;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(maxTier, Math.floor(n)));
}

// 시뮬에서 랜덤 생성된 장비(weapon/armor)를 DB에 저장할 때 사용하는 외부 ID
export function getSimEquipExternalId(it) {
  const id = String(it?.itemId || it?.id || '').trim();
  return id;
}

export function isSimGeneratedEquipment(it) {
  if (!it || typeof it !== 'object') return false;
  const extId = getSimEquipExternalId(it);
  if (!extId) return false;
  if (!extId.startsWith('wpn_') && !extId.startsWith('eq_')) return false;

  const cat = String(it?.category || '').toLowerCase();
  const slot = String(it?.equipSlot || '').toLowerCase();
  const tags = safeTags(it).map((t) => String(t).toLowerCase());
  const hasStats = it?.stats && typeof it.stats === 'object';

  const isEquip = cat === 'equipment' || slot === 'weapon' || tags.includes('equipment') || tags.includes('weapon') || tags.includes('armor');
  return isEquip && hasStats;
}

export function getInvRules(ruleset) {
  const inv = ruleset?.inventory || {};
  return {
    maxSlots: Number(inv.maxSlots || DEFAULT_INV_RULES.maxSlots),
    stackMax: { ...DEFAULT_INV_RULES.stackMax, ...(inv.stackMax || {}) },
  };
}

export function inferItemCategory(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  const bandageLike = lower.includes('bandage') || name.includes('붕대');

  if (it && typeof it === 'object') {
    const slot = String(it?.equipSlot || '').trim().toLowerCase();
    if (slot) return 'equipment';
  }

  if (bandageLike) return 'material';

  const isConsumable =
    type === 'food' ||
    type === 'consumable' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    tags.includes('capsule') ||
    tags.includes('book') ||
    lower.includes('apple') ||
    lower.includes('steak') ||
    name.includes('음식') ||
    name.includes('사과') ||
    name.includes('스테이크') ||
    name.includes('빵') ||
    name.includes('고기') ||
    name.includes('치킨');

  const isEquipment =
    type === 'weapon' ||
    it?.type === '무기' ||
    it?.type === '방어구' ||
    tags.includes('weapon') ||
    tags.includes('armor') ||
    tags.includes('equipment') ||
    tags.includes('equip') ||
    lower.includes('weapon') ||
    name.includes('무기') ||
    name.includes('검') ||
    name.includes('총') ||
    name.includes('창') ||
    name.includes('활') ||
    name.includes('갑옷') ||
    name.includes('헬멧') ||
    name.includes('신발') ||
    name.includes('장갑');

  if (isEquipment) return 'equipment';
  if (isConsumable) return 'consumable';
  return 'material';
}

export function inferEquipSlot(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  if (it && typeof it === 'object') {
    const s = String(it?.equipSlot || '').trim().toLowerCase();
    if (s) return s;
  }

  if (type === 'weapon' || it?.type === '무기' || tags.includes('weapon') || lower.includes('weapon') || name.includes('무기') || name.includes('검') || name.includes('총') || name.includes('활') || name.includes('창')) return 'weapon';
  if (tags.includes('head') || lower.includes('helmet') || name.includes('머리') || name.includes('모자') || name.includes('헬멧')) return 'head';
  if (tags.includes('clothes') || tags.includes('body') || name.includes('옷') || name.includes('상의') || name.includes('갑옷') || name.includes('방어복')) return 'clothes';
  if (tags.includes('arm') || lower.includes('glove') || name.includes('팔') || name.includes('장갑') || name.includes('암가드')) return 'arm';
  if (tags.includes('shoes') || lower.includes('boots') || name.includes('신발') || name.includes('부츠')) return 'shoes';
  return '';
}

export function isBandageLikeItem(it) {
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  return lower.includes('bandage') || name.includes('붕대');
}

export function hasSpecialInventoryTag(it) {
  const tags = safeTags(it).map((t) => String(t || '').toLowerCase());
  const rawName = String(itemDisplayName(it) || '');
  const name = rawName.toLowerCase();
  const compactName = rawName.replace(/\s+/g, '').toLowerCase();
  const specialNameTokens = [
    '운석',
    '생명의나무',
    '생나',
    '미스릴',
    '포스코어',
    '혈액샘플',
    '전술강화모듈',
    '아글라이아',
    '아이가이',
    'life tree',
    'tree of life',
    'meteor',
    'mithril',
    'force core',
    'blood sample',
    'tactical module',
    'aglaia',
  ];
  return tags.some((t) => (
    t.includes('legendary_core') ||
    t.includes('meteor') ||
    t.includes('life_tree') ||
    t.includes('mithril') ||
    t.includes('force_core') ||
    t.includes('vf') ||
    t.includes('transcend') ||
    t.includes('tac_skill_module')
  )) || specialNameTokens.some((token) => compactName.includes(String(token).replace(/\s+/g, '').toLowerCase()))
    || name.includes('meteor') || name.includes('mithril') || name.includes('force core') || name.includes('blood sample');
}

export function hasGoalInventoryTag(it) {
  const tags = safeTags(it).map((t) => String(t || '').toLowerCase());
  return it?.goalItem === true || it?._goalItem === true || tags.includes('craft_goal') || tags.includes('route_goal');
}

export function markInventoryGoalItem(item, isGoal = true, tagName = 'craft_goal') {
  if (!isGoal || !item || typeof item !== 'object') return item;
  const tags = safeTags(item).map((t) => String(t || '')).filter(Boolean);
  const tag = String(tagName || 'craft_goal').trim() || 'craft_goal';
  if (!tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())) tags.push(tag);
  return { ...item, tags, goalItem: true };
}

export function inventoryItemPriority(it) {
  const category = inferItemCategory(it);
  const tier = clampInventoryTier(it?.tier || 1, category);

  if (category === 'equipment') return 80 + tier * 5;
  if (hasSpecialInventoryTag(it)) return 70 + tier * 5;
  if (hasGoalInventoryTag(it)) return 54 + tier * 5;
  if (category === 'consumable') {
    return 20 + tier * 3;
  }
  return tier * 4;
}
