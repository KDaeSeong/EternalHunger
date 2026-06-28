export const ER_CHARACTER_MAX_LEVEL = 20;

export const ER_MASTERY_CATEGORIES = [
  'weapon',
  'defense',
  'hunting',
  'craft',
  'search',
  'movement',
];

export const ER_MASTERY_LABELS = {
  weapon: '무기',
  defense: '방어',
  hunting: '사냥',
  craft: '제작',
  search: '탐색',
  movement: '이동',
};

const MASTERY_CURVES = {
  weapon: { first: 120, step: 35 },
  defense: { first: 230, step: 270 },
  hunting: { first: 180, step: 200 },
  craft: { first: 430, step: 120 },
  search: { first: 350, step: 60 },
  movement: { first: 300, step: 20 },
};

const CHARACTER_LEVEL_CURVE = { first: 450, step: 180 };

const EQUIPMENT_CRAFT_XP_BY_TIER = [0, 100, 200, 350, 600, 1000, 1200];
const WEAPON_CRAFT_XP_BY_TIER = [0, 100, 200, 350, 550, 800, 1000];
const FOOD_CRAFT_XP_BY_TIER = [0, 50, 120, 200, 360, 406, 500];
const SHOES_CRAFT_XP_BY_TIER = [0, 100, 140, 250, 500, 800, 1000];

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function positiveXp(value) {
  const n = Math.floor(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function requirementForNextLevel(curve, currentLevel) {
  const level = clampInt(currentLevel, 1, ER_CHARACTER_MAX_LEVEL);
  return Math.max(1, Math.floor(Number(curve.first || 1) + Number(curve.step || 0) * Math.max(0, level - 1)));
}

export function getLevelFromXp(xp, curve = CHARACTER_LEVEL_CURVE) {
  let remaining = positiveXp(xp);
  let level = 1;
  while (level < ER_CHARACTER_MAX_LEVEL) {
    const req = requirementForNextLevel(curve, level);
    if (remaining < req) break;
    remaining -= req;
    level += 1;
  }
  return level;
}

export function createInitialMasteryState() {
  return ER_MASTERY_CATEGORIES.reduce((acc, category) => {
    acc[category] = { xp: 0, level: 1 };
    return acc;
  }, {});
}

function normalizeCategory(raw, category) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const xp = positiveXp(src.xp ?? src.exp ?? src.masteryXp);
  const curve = MASTERY_CURVES[category] || MASTERY_CURVES.weapon;
  const fromXp = getLevelFromXp(xp, curve);
  const explicit = clampInt(src.level ?? src.lv, 0, ER_CHARACTER_MAX_LEVEL);
  return {
    xp,
    level: Math.max(1, Math.min(ER_CHARACTER_MAX_LEVEL, Math.max(fromXp, explicit || 1))),
  };
}

export function normalizeMasteryState(character = {}) {
  const src = character && typeof character === 'object' ? character : {};
  const rawMastery = src.mastery && typeof src.mastery === 'object' ? src.mastery : {};
  const mastery = createInitialMasteryState();

  ER_MASTERY_CATEGORIES.forEach((category) => {
    mastery[category] = normalizeCategory(rawMastery[category], category);
  });

  const legacyWeaponXp = positiveXp(src.weaponMasteryXp);
  if (legacyWeaponXp > mastery.weapon.xp) {
    mastery.weapon = normalizeCategory({ xp: legacyWeaponXp, level: src.weaponMasteryLevel }, 'weapon');
  } else if (positiveXp(src.weaponMasteryLevel) > mastery.weapon.level) {
    mastery.weapon.level = clampInt(src.weaponMasteryLevel, 1, ER_CHARACTER_MAX_LEVEL);
  }

  const totalXp = ER_MASTERY_CATEGORIES.reduce((sum, category) => sum + positiveXp(mastery[category]?.xp), 0);
  const level = getLevelFromXp(totalXp, CHARACTER_LEVEL_CURVE);

  return {
    mastery,
    totalXp,
    level,
    weaponMasteryXp: mastery.weapon.xp,
    weaponMasteryLevel: mastery.weapon.level,
  };
}

function writeMasteryState(character, state) {
  if (!character || typeof character !== 'object') return;
  character.mastery = state.mastery;
  character.masteryXp = state.totalXp;
  character.erLevel = state.level;
  character.level = state.level;
  character.weaponMasteryXp = state.weaponMasteryXp;
  character.weaponMasteryLevel = state.weaponMasteryLevel;
}

export function getCharacterLevel(character) {
  return normalizeMasteryState(character).level;
}

export function getMasteryLevel(character, category = 'weapon') {
  const key = ER_MASTERY_CATEGORIES.includes(category) ? category : 'weapon';
  return normalizeMasteryState(character).mastery[key].level;
}

export function getMasteryLabel(category = '') {
  return ER_MASTERY_LABELS[category] || String(category || '');
}

export function addMasteryXp(character, category = 'weapon', amount = 0) {
  if (!character || typeof character !== 'object') return null;
  const key = ER_MASTERY_CATEGORIES.includes(category) ? category : 'weapon';
  const gain = positiveXp(amount);
  if (gain <= 0) return null;

  const before = normalizeMasteryState(character);
  const nextRaw = JSON.parse(JSON.stringify(before.mastery));
  const beforeCat = nextRaw[key] || { xp: 0, level: 1 };
  beforeCat.xp = positiveXp(beforeCat.xp) + gain;
  nextRaw[key] = normalizeCategory(beforeCat, key);

  const after = normalizeMasteryState({ mastery: nextRaw, weaponMasteryXp: nextRaw.weapon?.xp || 0 });
  writeMasteryState(character, after);

  return {
    category: key,
    xpGain: gain,
    beforeXp: positiveXp(before.mastery[key]?.xp),
    afterXp: positiveXp(after.mastery[key]?.xp),
    beforeLevel: before.mastery[key]?.level || 1,
    afterLevel: after.mastery[key]?.level || 1,
    leveledUp: (after.mastery[key]?.level || 1) > (before.mastery[key]?.level || 1),
    beforeCharacterLevel: before.level,
    afterCharacterLevel: after.level,
    characterLeveledUp: after.level > before.level,
  };
}

export function addMultipleMasteryXp(character, entries = []) {
  const results = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry) return;
    const result = addMasteryXp(character, entry.category, entry.amount ?? entry.xp);
    if (result) results.push(result);
  });
  return results;
}

function tierValue(tier) {
  return Math.max(1, Math.min(6, Math.floor(Number(tier || 1))));
}

function xpFromTier(table, tier) {
  return positiveXp(table[tierValue(tier)] ?? table[table.length - 1] ?? 0);
}

export function getCraftMasteryXp(meta = {}, crafted = {}) {
  const item = meta && typeof meta === 'object' ? meta : {};
  const tier = tierValue(crafted?.craftedTier ?? item?.tier ?? 1);
  const typeText = `${String(item?.type || '')} ${String(item?.itemType || '')} ${String(item?.category || '')}`.toLowerCase();
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || '').toLowerCase()) : [];
  const slot = String(item?.equipSlot || '').toLowerCase();
  const isFood = typeText.includes('food') || typeText.includes('음식') || tags.includes('food') || tags.includes('consumable');
  const isWeapon = slot === 'weapon' || typeText.includes('weapon') || typeText.includes('무기') || tags.includes('weapon');

  const entries = [];
  entries.push({ category: 'craft', amount: xpFromTier(isFood ? FOOD_CRAFT_XP_BY_TIER : EQUIPMENT_CRAFT_XP_BY_TIER, tier) });
  if (isWeapon) entries.push({ category: 'weapon', amount: xpFromTier(WEAPON_CRAFT_XP_BY_TIER, tier) });
  if (slot === 'head') entries.push({ category: 'defense', amount: xpFromTier(EQUIPMENT_CRAFT_XP_BY_TIER, tier) });
  if (slot === 'shoes') entries.push({ category: 'movement', amount: xpFromTier(SHOES_CRAFT_XP_BY_TIER, tier) });
  return entries.filter((entry) => positiveXp(entry.amount) > 0);
}

export function getPvpMasteryEntries({ damageDealt = 0, damageTaken = 0 } = {}) {
  const dealt = Math.max(0, Number(damageDealt || 0));
  const taken = Math.max(0, Number(damageTaken || 0));
  return [
    { category: 'weapon', amount: Math.round(dealt * 0.63) },
    { category: 'defense', amount: Math.round(taken * 0.60) },
  ].filter((entry) => positiveXp(entry.amount) > 0);
}

export function getPvpKillMasteryEntries(opponent = {}) {
  const opponentLevel = Math.max(1, getCharacterLevel(opponent));
  return [
    { category: 'weapon', amount: 100 },
    { category: 'defense', amount: Math.max(50, Math.round(opponentLevel * 80 - 250)) },
  ];
}

export function getWildlifeMasteryEntries({ damageDealt = 0, damageTaken = 0 } = {}) {
  const dealt = Math.max(0, Number(damageDealt || 0));
  const taken = Math.max(0, Number(damageTaken || 0));
  return [
    { category: 'hunting', amount: Math.round(dealt * 0.35 + taken * 0.10) },
    { category: 'weapon', amount: Math.round(dealt * 0.05) },
    { category: 'defense', amount: Math.round(taken * 0.10) },
  ].filter((entry) => positiveXp(entry.amount) > 0);
}

export function getWildlifeDamageMultiplier(character) {
  const huntingLevel = getMasteryLevel(character, 'hunting');
  return 1 + Math.max(0, huntingLevel - 1) * 0.02;
}

export function getMovementSpeedMasteryBonus(character) {
  const movementLevel = getMasteryLevel(character, 'movement');
  return Math.max(0, movementLevel - 1) * 0.01;
}

export function getNonCombatRegenMultiplier(character) {
  const craftLevel = getMasteryLevel(character, 'craft');
  return 1 + Math.max(0, craftLevel - 1) * 0.10;
}

export function getSearchSightBonus(character) {
  const searchLevel = getMasteryLevel(character, 'search');
  return Math.max(0, searchLevel - 1) * 0.01;
}

export function applyMasteryStatBonuses(stats = {}, character = {}) {
  const out = { ...(stats && typeof stats === 'object' ? stats : {}) };
  const weaponLevel = getMasteryLevel(character, 'weapon');
  const defenseLevel = getMasteryLevel(character, 'defense');
  const searchLevel = getMasteryLevel(character, 'search');

  out.attackPower = Number(out.attackPower || 0) + Math.max(0, weaponLevel - 1) * 0.8;
  out.skillAmp = Number(out.skillAmp || 0) + Math.max(0, weaponLevel - 1) * 0.65;
  out.attackSpeed = Number(out.attackSpeed || 0) + Math.max(0, weaponLevel - 1) * 0.004;
  out.defense = Number(out.defense || 0) + Math.max(0, defenseLevel - 1) * 0.7;
  out.sightRange = Number(out.sightRange || 0) + Math.max(0, searchLevel - 1) * 0.01;
  out.attackSpeed = Math.max(0.1, Math.min(3, out.attackSpeed));
  return out;
}
