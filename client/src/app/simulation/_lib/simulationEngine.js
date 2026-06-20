import { getUser } from '../../../utils/api';
import { writeHallOfFameState } from '../../../utils/hallOfFame';
import { generateDynamicEvent } from '../../../utils/eventLogic';
import { createEquipmentItem, normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  EFFECT_BLEED,
  EFFECT_BURN,
  EFFECT_FOOD_POISON,
  EFFECT_POISON,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  absorbShieldDamage,
  addOrRefreshEffect,
  normalizeStatusEffectList,
  purgeNegativeEffects,
} from '../../../utils/statusLogic';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags : [];
}

function itemDisplayName(item) {
  return item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
}

function resolveRewardDropEntry(entry, publicItems, itemNameById) {
  const raw = entry && typeof entry === 'object' ? entry : null;
  if (!raw) return null;
  const rawItem = raw?.item && typeof raw.item === 'object' ? raw.item : null;
  const itemId = String(raw?.itemId || raw?.id || raw?._id || rawItem?._id || '');
  if (!itemId) return null;
  const catalogItem = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id || '') === itemId) || null;
  const qty = Math.max(1, Number(raw?.qty || raw?.count || 1));
  return {
    itemId,
    qty,
    item: catalogItem || rawItem || {
      _id: itemId,
      name: String(raw?.name || itemNameById?.[itemId] || '아이템'),
      type: String(raw?.type || rawItem?.type || '재료'),
      tags: Array.isArray(rawItem?.tags) ? rawItem.tags : [],
    },
  };
}

function normalizeRewardDropEntries(entries, publicItems, itemNameById) {
  const rawList = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return rawList
    .map((entry) => resolveRewardDropEntry(entry, publicItems, itemNameById))
    .filter(Boolean);
}

function itemIcon(item) {
  const t = String(item?.type || '').toLowerCase();
  const tags = safeTags(item);
  if (tags.includes('heal') || tags.includes('medical')) return '🚑';
  if (tags.includes('meat')) return '🥩';
  if (String(item?.name || '').includes('치킨')) return '🍗';
  if (t === 'food' || tags.includes('food') || tags.includes('healthy')) return '🍎';
  if (t === 'weapon' || item?.type === '무기') return '⚔️';
  if (item?.type === '방어구') return '🛡️';
  return '📦';
}

function shuffleArray(list, rng = Math.random) {
  const arr = Array.isArray(list) ? [...list] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const EQUIP_SLOTS = ['weapon', 'head', 'clothes', 'arm', 'shoes'];

// 시작 장비(1일차 낮): 무기 타입(요청 목록)
const START_WEAPON_TYPES = [
  '권총', '돌격소총', '돌소총', '저격총', '장갑', '톤파', '쌍절곤', '아르카나', '검', '쌍검', '망치',
  '방망이', '채찍', '투척', '암기', '활', '석궁', '도끼', '단검', '창', '레이피어',
];

const INIT_DEPENDENCY_PATHS = [
  '/characters',
  '/events',
  '/settings',
  '/user/me',
  '/public/items',
  '/public/maps',
  '/public/kiosks',
  '/public/drone-offers',
  '/public/perks',
  '/trades',
  '/trades?mine=true',
];

function normalizeUserStatistics(stats) {
  const src = stats && typeof stats === 'object' ? stats : {};
  const totalGames = Number(src?.totalGames || 0);
  const totalKills = Number(src?.totalKills || 0);
  const totalWins = Number(src?.totalWins || 0);
  return {
    totalGames: Number.isFinite(totalGames) && totalGames > 0 ? Math.floor(totalGames) : 0,
    totalKills: Number.isFinite(totalKills) && totalKills > 0 ? Math.floor(totalKills) : 0,
    totalWins: Number.isFinite(totalWins) && totalWins > 0 ? Math.floor(totalWins) : 0,
  };
}

function mergeStoredUserProgress(currentUser, patch = {}) {
  const baseUser = currentUser && typeof currentUser === 'object' ? currentUser : {};
  const next = { ...baseUser, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'lp')) {
    const lp = Number(patch.lp || 0);
    next.lp = Number.isFinite(lp) ? lp : Number(baseUser?.lp || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'credits')) {
    const credits = Number(patch.credits || 0);
    next.credits = Number.isFinite(credits) ? credits : Number(baseUser?.credits || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'statistics')) {
    next.statistics = normalizeUserStatistics(patch.statistics);
  } else if (baseUser?.statistics) {
    next.statistics = normalizeUserStatistics(baseUser.statistics);
  }
  return next;
}

const PERK_EFFECT_DEFAULTS = {
  hpPlus: 0,
  maxHpPlus: 0,
  startCreditsPlus: 0,
  creditsPlus: 0,
  atkPlus: 0,
  defPlus: 0,
  moveSpeedPlus: 0,
  strPlus: 0,
  agiPlus: 0,
  intPlus: 0,
  menPlus: 0,
  lukPlus: 0,
  dexPlus: 0,
  shtPlus: 0,
  endPlus: 0,
  kioskDiscountPct: 0,
  droneDiscountPct: 0,
  marketDiscountPct: 0,
  kioskChancePlus: 0,
  droneChancePlus: 0,
  craftChancePlus: 0,
  goalWeightPlus: 0,
  lootWeightPlus: 0,
  aggressionPlus: 0,
  saleBonusPct: 0,
  wildlifeCreditsPct: 0,
  wildlifeDamageMinus: 0,
  wildlifeLootPlus: 0,
  eventCreditsPct: 0,
  eventRecoveryPlus: 0,
  eventItemPlus: 0,
  bleedResistPct: 0,
  poisonResistPct: 0,
  burnResistPct: 0,
  bleedImmune: 0,
  poisonImmune: 0,
  burnImmune: 0,
  cleanseHealPlus: 0,
};

const PERK_EFFECT_ALIASES = {
  hpPlus: ['hpPlus', 'healthPlus', 'maxHpPlusFlat', 'hp_flat'],
  maxHpPlus: ['maxHpPlus', 'maxHealthPlus'],
  startCreditsPlus: ['startCreditsPlus', 'simCreditsPlus', 'startingCreditsPlus'],
  creditsPlus: ['creditsPlus'],
  atkPlus: ['atkPlus', 'attackPlus', 'attackFlat'],
  defPlus: ['defPlus', 'defensePlus', 'armorPlus'],
  moveSpeedPlus: ['moveSpeedPlus', 'movePlus', 'msPlus'],
  strPlus: ['strPlus'],
  agiPlus: ['agiPlus'],
  intPlus: ['intPlus'],
  menPlus: ['menPlus'],
  lukPlus: ['lukPlus'],
  dexPlus: ['dexPlus'],
  shtPlus: ['shtPlus'],
  endPlus: ['endPlus'],
  kioskDiscountPct: ['kioskDiscountPct', 'kioskDiscount', 'shopDiscountPct'],
  droneDiscountPct: ['droneDiscountPct', 'droneDiscount'],
  marketDiscountPct: ['marketDiscountPct', 'marketDiscount', 'discountPct'],
  kioskChancePlus: ['kioskChancePlus', 'shopChancePlus'],
  droneChancePlus: ['droneChancePlus'],
  craftChancePlus: ['craftChancePlus', 'craftBias'],
  goalWeightPlus: ['goalWeightPlus', 'goalBias', 'goalPriorityPlus'],
  lootWeightPlus: ['lootWeightPlus', 'lootBiasPlus'],
  aggressionPlus: ['aggressionPlus', 'combatAggroPlus'],
  saleBonusPct: ['saleBonusPct', 'sellBonusPct'],
  wildlifeCreditsPct: ['wildlifeCreditsPct', 'huntCreditsPct', 'animalCreditsPct'],
  wildlifeDamageMinus: ['wildlifeDamageMinus', 'huntDamageMinus', 'animalDamageMinus'],
  wildlifeLootPlus: ['wildlifeLootPlus', 'huntLootPlus', 'animalLootPlus'],
  eventCreditsPct: ['eventCreditsPct', 'scenarioCreditsPct'],
  eventRecoveryPlus: ['eventRecoveryPlus', 'scenarioRecoveryPlus'],
  eventItemPlus: ['eventItemPlus', 'scenarioItemPlus', 'eventLootPlus'],
  bleedResistPct: ['bleedResistPct', 'bleedResist', 'bleedAvoidPct'],
  poisonResistPct: ['poisonResistPct', 'poisonResist', 'poisonAvoidPct', 'foodPoisonResistPct'],
  burnResistPct: ['burnResistPct', 'burnResist', 'burnAvoidPct'],
  bleedImmune: ['bleedImmune', 'immuneBleed'],
  poisonImmune: ['poisonImmune', 'immunePoison', 'foodPoisonImmune'],
  burnImmune: ['burnImmune', 'immuneBurn'],
  cleanseHealPlus: ['cleanseHealPlus', 'cleanseRecoveryPlus', 'medicalRecoveryPlus'],
};

function perkNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizePerkPct(value) {
  const n = perkNumber(value);
  const ratio = Math.abs(n) > 1 ? (n / 100) : n;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(-0.95, Math.min(0.95, ratio));
}

function normalizePerkEffects(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...PERK_EFFECT_DEFAULTS };
  Object.entries(PERK_EFFECT_ALIASES).forEach(([targetKey, aliases]) => {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(src, alias)) continue;
      const value = src[alias];
      out[targetKey] = targetKey.endsWith('Pct') ? normalizePerkPct(value) : perkNumber(value);
      break;
    }
  });
  out.kioskDiscountPct = normalizePerkPct(out.kioskDiscountPct + out.marketDiscountPct);
  out.droneDiscountPct = normalizePerkPct(out.droneDiscountPct + out.marketDiscountPct);
  out.marketDiscountPct = normalizePerkPct(out.marketDiscountPct);
  out.saleBonusPct = normalizePerkPct(out.saleBonusPct);
  out.bleedResistPct = normalizePerkPct(out.bleedResistPct);
  out.poisonResistPct = normalizePerkPct(out.poisonResistPct);
  out.burnResistPct = normalizePerkPct(out.burnResistPct);
  out.bleedImmune = out.bleedImmune ? 1 : 0;
  out.poisonImmune = out.poisonImmune ? 1 : 0;
  out.burnImmune = out.burnImmune ? 1 : 0;
  return out;
}

function buildPerkRuntimeBundle(codes, perks) {
  const ownedCodes = Array.isArray(codes) ? codes.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const ownedSet = new Set(ownedCodes);
  const perkDocs = (Array.isArray(perks) ? perks : []).filter((perk) => ownedSet.has(String(perk?.code || '').trim()));
  const effects = { ...PERK_EFFECT_DEFAULTS };
  perkDocs.forEach((perk) => {
    const fx = normalizePerkEffects(perk?.effects);
    Object.keys(effects).forEach((key) => {
      effects[key] += perkNumber(fx[key]);
    });
  });
  effects.kioskDiscountPct = normalizePerkPct(effects.kioskDiscountPct);
  effects.droneDiscountPct = normalizePerkPct(effects.droneDiscountPct);
  effects.marketDiscountPct = normalizePerkPct(effects.marketDiscountPct);
  effects.saleBonusPct = normalizePerkPct(effects.saleBonusPct);
  return {
    codes: ownedCodes,
    docs: perkDocs,
    effects,
    summary: perkDocs.map((perk) => String(perk?.name || perk?.code || '').trim()).filter(Boolean).join(', '),
  };
}

function getActorPerkEffects(actor) {
  return actor?._perkRuntime && typeof actor._perkRuntime === 'object' ? actor._perkRuntime : PERK_EFFECT_DEFAULTS;
}

function applyPerkDiscount(cost, ...pctList) {
  const base = Math.max(0, Math.round(perkNumber(cost)));
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  const ratio = Math.max(0.05, 1 - Math.max(0, totalPct));
  return Math.max(0, Math.round(base * ratio));
}

function getPerkLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'lootWeightPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.6, Math.min(1.2, normalizePerkPct(fx?.lootWeightPlus || 0)));
}

function getPerkAggressionBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'aggressionPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.5, Math.min(1.0, normalizePerkPct(fx?.aggressionPlus || 0)));
}

function applyPerkLootWeight(weight, actorOrEffects, opts = {}) {
  const baseWeight = Math.max(0, Number(weight || 0));
  if (!(baseWeight > 0)) return 0;
  const lootBias = getPerkLootBias(actorOrEffects);
  const rareBoost = Math.max(0, Number(opts?.rareBoost || 0));
  const ratio = Math.max(0.15, 1 + lootBias + Math.max(0, lootBias) * rareBoost);
  return Math.max(0.01, baseWeight * ratio);
}

function getPerkWildlifeLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'wildlifeLootPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = normalizePerkPct(fx?.lootWeightPlus || 0);
  const extra = normalizePerkPct(fx?.wildlifeLootPlus || 0);
  return Math.max(-0.6, Math.min(1.4, base + extra));
}

function getPerkEventItemBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'eventItemPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = Math.max(0, normalizePerkPct(fx?.lootWeightPlus || 0));
  const extra = Math.max(0, normalizePerkPct(fx?.eventItemPlus || 0));
  return Math.max(0, Math.min(1.2, base * 0.4 + extra));
}

function applyPerkCreditBonus(amount, ...pctList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  return Math.max(0, Math.round(base * Math.max(0, 1 + totalPct)));
}

function applyPerkDamageReduction(amount, ...minusList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalMinus = minusList.reduce((sum, v) => sum + Math.max(0, perkNumber(v)), 0);
  return Math.max(0, Math.round(base - totalMinus));
}

function maybeBoostDropQty(qty, chance, maxExtra = 1) {
  let next = Math.max(1, Math.round(perkNumber(qty) || 1));
  const extraCap = Math.max(0, Math.round(perkNumber(maxExtra) || 0));
  const rollChance = Math.max(0, Math.min(0.95, Number(chance || 0)));
  for (let i = 0; i < extraCap; i += 1) {
    if (Math.random() < rollChance) next += 1;
  }
  return next;
}

function applyPerkBundleToActor(actor, bundle, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const perkBundle = bundle && typeof bundle === 'object' ? bundle : { codes: [], docs: [], effects: { ...PERK_EFFECT_DEFAULTS }, summary: '' };
  const fx = perkBundle.effects && typeof perkBundle.effects === 'object' ? perkBundle.effects : PERK_EFFECT_DEFAULTS;
  const next = actor;

  const baseStats = next._perkBaseStats && typeof next._perkBaseStats === 'object'
    ? { ...next._perkBaseStats }
    : { ...(next?.stats && typeof next.stats === 'object' ? next.stats : {}) };
  next._perkBaseStats = { ...baseStats };
  const statKeys = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
  const updatedStats = { ...baseStats };
  statKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updatedStats, key)) updatedStats[key] = 0;
    updatedStats[key] = perkNumber(updatedStats[key]);
  });
  updatedStats.str += perkNumber(fx.strPlus) + perkNumber(fx.atkPlus);
  updatedStats.sht += perkNumber(fx.shtPlus) + perkNumber(fx.atkPlus);
  updatedStats.end += perkNumber(fx.endPlus) + perkNumber(fx.defPlus);
  updatedStats.agi += perkNumber(fx.agiPlus);
  updatedStats.int += perkNumber(fx.intPlus);
  updatedStats.men += perkNumber(fx.menPlus);
  updatedStats.luk += perkNumber(fx.lukPlus);
  updatedStats.dex += perkNumber(fx.dexPlus);
  next.stats = updatedStats;

  const baseMaxHp = perkNumber(next._perkBaseMaxHp ?? next.maxHp ?? 100) || 100;
  next._perkBaseMaxHp = baseMaxHp;
  const prevMaxHp = Math.max(1, perkNumber(next.maxHp || baseMaxHp) || baseMaxHp);
  const hpBonus = Math.max(0, perkNumber(fx.maxHpPlus) + perkNumber(fx.hpPlus));
  const desiredMaxHp = Math.max(1, Math.round(baseMaxHp + hpBonus));
  const currentHp = perkNumber(next.hp != null ? next.hp : prevMaxHp);
  const hpDelta = desiredMaxHp - prevMaxHp;
  next.maxHp = desiredMaxHp;
  if (opts.initialFill) next.hp = desiredMaxHp;
  else if (currentHp <= 0) next.hp = 0;
  else next.hp = Math.max(1, Math.min(desiredMaxHp, currentHp + Math.max(0, hpDelta)));

  const baseGrant = Math.max(0, Math.round(perkNumber(fx.startCreditsPlus) + perkNumber(fx.creditsPlus)));
  const prevGrant = Math.max(0, Math.round(perkNumber(next._perkGrantedCreditsTotal || 0)));
  const delta = Math.max(0, baseGrant - prevGrant);
  if (opts.applyCredits !== false && delta > 0) next.simCredits = Math.max(0, perkNumber(next.simCredits || 0) + delta);
  next._perkGrantedCreditsTotal = baseGrant;

  next._perkRuntime = { ...fx };
  next._perkCodes = Array.isArray(perkBundle.codes) ? perkBundle.codes.slice() : [];
  next._perkSummary = String(perkBundle.summary || '');
  return next;
}


function ensureEquipped(obj) {
  const eq = obj?.equipped;
  if (eq && typeof eq === 'object') {
    return {
      weapon: eq.weapon ?? null,
      head: eq.head ?? null,
      clothes: eq.clothes ?? null,
      arm: eq.arm ?? null,
      shoes: eq.shoes ?? null,
    };
  }
  return { weapon: null, head: null, clothes: null, arm: null, shoes: null };
}

function normalizeRuntimeInventory(list) {
  return (Array.isArray(list) ? list : [])
    .filter((it) => it && typeof it === 'object')
    .map((it) => {
      const next = { ...it };
      const qty = Number(next?.qty ?? 1);
      next.qty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      const itemId = String(next?.itemId || next?.id || next?._id || '').trim();
      if (itemId) next.itemId = itemId;
      if (next?.equipSlot != null) next.equipSlot = String(next.equipSlot || '').toLowerCase();
      if (next?.weaponType != null) next.weaponType = normalizeWeaponType(next.weaponType) || String(next.weaponType || '');
      if (!Array.isArray(next?.tags)) next.tags = safeTags(next);
      return next;
    });
}

function normalizeRuntimeEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const next = { ...effect };
  if (next?.remainingDuration != null) {
    const dur = Number(next.remainingDuration);
    next.remainingDuration = Number.isFinite(dur) ? Math.max(0, Math.floor(dur)) : 0;
  }
  if (next?.dotDamage != null) {
    const dot = Number(next.dotDamage);
    next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;
  }
  if (next?.recovery != null) {
    const rec = Number(next.recovery);
    next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;
  }
  if (next?.shieldValue != null) {
    const shield = Number(next.shieldValue);
    next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;
  }
  if (next?.sourceId != null) next.sourceId = String(next.sourceId || '');
  return next;
}

function normalizeRuntimeSurvivorList(list, opts = {}) {
  return (Array.isArray(list) ? list : [])
    .map((it) => normalizeRuntimeSurvivor(it, opts))
    .filter((it) => it && typeof it === 'object' && String(it?._id || '').trim());
}

function buildRuntimeSurvivorMap(list, opts = {}) {
  const map = new Map();
  normalizeRuntimeSurvivorList(list, opts).forEach((it) => {
    map.set(String(it._id), it);
  });
  return map;
}

function upsertRuntimeSurvivor(runtimeMap, survivor, opts = {}) {
  if (!(runtimeMap instanceof Map)) return null;
  const next = normalizeRuntimeSurvivor(survivor, opts);
  const id = String(next?._id || '').trim();
  if (!id) return null;
  runtimeMap.set(id, next);
  return next;
}

function normalizeRuntimeSurvivor(obj, opts = {}) {
  const base = obj && typeof obj === 'object' ? obj : {};
  const hpDefault = opts.hpDefault != null ? Number(opts.hpDefault) : 100;
  const maxHpDefault = opts.maxHpDefault != null ? Number(opts.maxHpDefault) : 100;
  const hpRaw = Number(base?.hp);
  const maxHpRaw = Number(base?.maxHp);
  const hp = Number.isFinite(hpRaw) ? hpRaw : hpDefault;
  const maxHp = Number.isFinite(maxHpRaw) && maxHpRaw > 0 ? maxHpRaw : maxHpDefault;
  const perkFx = getActorPerkEffects(base);
  const statusImmunities = new Set(
    Array.isArray(base?.statusImmunities)
      ? base.statusImmunities.map((x) => String(x || '').trim()).filter(Boolean)
      : []
  );
  if (perkNumber(perkFx?.bleedImmune || 0) > 0) statusImmunities.add(EFFECT_BLEED);
  if (perkNumber(perkFx?.poisonImmune || 0) > 0) {
    statusImmunities.add(EFFECT_POISON);
    statusImmunities.add(EFFECT_FOOD_POISON);
  }
  if (perkNumber(perkFx?.burnImmune || 0) > 0) statusImmunities.add(EFFECT_BURN);

  const statusResists = {
    ...(base?.statusResists && typeof base.statusResists === 'object' ? base.statusResists : {}),
  };
  statusResists[EFFECT_BLEED] = Math.max(0, Number(statusResists[EFFECT_BLEED] || 0), Number(perkFx?.bleedResistPct || 0));
  statusResists[EFFECT_POISON] = Math.max(0, Number(statusResists[EFFECT_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_FOOD_POISON] = Math.max(0, Number(statusResists[EFFECT_FOOD_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_BURN] = Math.max(0, Number(statusResists[EFFECT_BURN] || 0), Number(perkFx?.burnResistPct || 0));

  return {
    ...base,
    inventory: normalizeRuntimeInventory(base?.inventory),
    equipped: ensureEquipped(base),
    activeEffects: Array.isArray(base?.activeEffects) ? base.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [],
    cooldowns: base?.cooldowns && typeof base.cooldowns === 'object' ? { ...base.cooldowns } : { portableSafeZone: 0, cnotGate: 0 },
    hp: Math.max(0, Math.min(maxHp, hp)),
    maxHp,
    simCredits: Number.isFinite(Number(base?.simCredits)) ? Number(base.simCredits) : 0,
    tacticalSkillLevel: Math.max(1, Math.min(2, Number(base?.tacticalSkillLevel || 1))),
    zoneId: String(base?.zoneId || ''),
    mapId: base?.mapId != null ? String(base.mapId || '') : '',
    day1Moves: Math.max(0, Number(base?.day1Moves || 0)),
    day1HeroDone: !!base?.day1HeroDone,
    droneLastOrderIndex: Number.isFinite(Number(base?.droneLastOrderIndex)) ? Number(base.droneLastOrderIndex) : -9999,
    droneLastOrderAbsSec: Number.isFinite(Number(base?.droneLastOrderAbsSec)) ? Number(base.droneLastOrderAbsSec) : -99999,
    kioskLastInteractAbsSec: Number.isFinite(Number(base?.kioskLastInteractAbsSec)) ? Number(base.kioskLastInteractAbsSec) : -99999,
    safeZoneUntil: Number.isFinite(Number(base?.safeZoneUntil)) ? Number(base.safeZoneUntil) : 0,
    aiTargetZoneId: base?.aiTargetZoneId != null ? String(base.aiTargetZoneId || '') : '',
    aiTargetTTL: Math.max(0, Number(base?.aiTargetTTL || 0)),
    _recentCombatUntil: Number.isFinite(Number(base?._recentCombatUntil)) ? Number(base._recentCombatUntil) : 0,
    _recentCombatWith: String(base?._recentCombatWith || ''),
    _recentCombatReason: String(base?._recentCombatReason || ''),
    detonationSec: Number.isFinite(Number(base?.detonationSec)) ? Number(base.detonationSec) : undefined,
    detonationMaxSec: Number.isFinite(Number(base?.detonationMaxSec)) ? Number(base.detonationMaxSec) : undefined,
    statusImmunities: Array.from(statusImmunities),
    statusResists,
  };
}

function getInvItemId(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

// ✅ 시뮬에서 랜덤 생성된 장비(weapon/armor)를 DB에 저장할 때 사용하는 외부 ID
// - equipmentCatalog.js에서 생성되는 id가 wpn_... / eq_... 형태
function getSimEquipExternalId(it) {
  const id = String(it?.itemId || it?.id || '').trim();
  return id;
}

function isSimGeneratedEquipment(it) {
  if (!it || typeof it !== 'object') return false;
  const extId = getSimEquipExternalId(it);
  if (!extId) return false;
  // equipmentCatalog에서 생성되는 prefix로 필터(불필요한 업서트/중복 저장 방지)
  if (!extId.startsWith('wpn_') && !extId.startsWith('eq_')) return false;

  const cat = String(it?.category || '').toLowerCase();
  const slot = String(it?.equipSlot || '').toLowerCase();
  const tags = safeTags(it).map((t) => String(t).toLowerCase());
  const hasStats = it?.stats && typeof it.stats === 'object';

  // category/slot/tags 중 하나라도 장비로 보이면 OK
  const isEquip = cat === 'equipment' || slot === 'weapon' || tags.includes('equipment') || tags.includes('weapon') || tags.includes('armor');
  return isEquip && hasStats;
}


// 장착 장비에서 이동속도(moveSpeed) 합산(신발 중심)
// - equipmentCatalog.js에서 shoes에 stats.moveSpeed를 부여
function getEquipMoveSpeed(actor) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const ids = [eq.weapon, eq.head, eq.clothes, eq.arm, eq.shoes].map((x) => String(x || '')).filter(Boolean);
  const used = new Set();

  function sumFromItem(it) {
    if (!it || typeof it !== 'object') return 0;
    const st = it.stats && typeof it.stats === 'object' ? it.stats : {};
    const v = Number(st.moveSpeed || 0);
    return Number.isFinite(v) ? v : 0;
  };

  let ms = 0;

  // 1) equipped id 우선
  for (const id of ids) {
    const it = inv.find((x) => String(getInvItemId(x)) === id);
    if (it) {
      used.add(String(getInvItemId(it)));
      ms += sumFromItem(it);
    }
  }

  // 2) fallback: equipSlot=shoes
  const shoes = inv.find((x) => String(x?.equipSlot || '') === 'shoes' && !used.has(String(getInvItemId(x))));
  if (shoes) ms += sumFromItem(shoes);

  const perkMs = perkNumber(getActorPerkEffects(actor)?.moveSpeedPlus || 0);
  return Math.max(0, ms + perkMs);
}


const SLOT_ICON = { weapon: '⚔️', head: '🪖', clothes: '👕', arm: '🦾', shoes: '👟' };

// 🗺️ 루미아 섬(존 기반) 감성 배치(미니맵 앵커 좌표, viewBox 0..100)
// - 실제 맵 이미지는 어드민에서 교체 가능하므로, 이 값은 "기본" 레이아웃용입니다.
const LUMIA_ZONE_POS = {
  archery: { x: 18, y: 24 },
  forest: { x: 26, y: 40 },
  temple: { x: 40, y: 26 },
  pond: { x: 52, y: 38 },
  lab: { x: 62, y: 30 },
  school: { x: 76, y: 24 },
  hotel: { x: 84, y: 38 },
  residential: { x: 86, y: 52 },
  hospital: { x: 74, y: 60 },
  police: { x: 60, y: 54 },
  cathedral: { x: 48, y: 48 },
  alley: { x: 52, y: 62 },
  gas_station: { x: 34, y: 68 },
  stream: { x: 40, y: 78 },
  beach: { x: 26, y: 86 },
  port: { x: 50, y: 88 },
  warehouse: { x: 62, y: 84 },
  factory: { x: 70, y: 74 },
  firestation: { x: 78, y: 78 },
};

// 🧭 기본 동선(인접 이동) - 하이퍼루프 맵 레이아웃 기준
// - 어드민 zoneConnections가 비어 있을 때만 사용
const LUMIA_DEFAULT_EDGES = [
  ['gas_station', 'alley'],
  ['gas_station', 'school'],
  ['gas_station', 'archery'],

  ['archery', 'hotel'],
  ['archery', 'school'],
  ['hotel', 'school'],
  ['hotel', 'beach'],

  ['school', 'firestation'],
  ['school', 'forest'],
  ['firestation', 'police'],
  ['firestation', 'lab'],
  ['firestation', 'pond'],

  ['police', 'alley'],
  ['police', 'pond'],
  ['alley', 'temple'],

  ['temple', 'stream'],
  ['stream', 'pond'],
  ['stream', 'hospital'],

  ['pond', 'hospital'],
  ['pond', 'lab'],
  ['pond', 'cathedral'],

  ['lab', 'cathedral'],
  ['forest', 'lab'],
  ['forest', 'beach'],

  ['beach', 'residential'],
  ['residential', 'warehouse'],
  ['warehouse', 'cathedral'],
  ['warehouse', 'port'],

  ['cathedral', 'port'],
  ['cathedral', 'factory'],
  ['factory', 'hospital'],
];


function shortText(s, maxLen = 8) {
  const str = String(s || '');
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 1)) + '…';
}

function hash32(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}


function extractActorNameFromLog(text) {
  const t = String(text || '');
  const m = t.match(/\[([^\]]+)\]/);
  return m ? String(m[1] || '').trim() : '';
}

function getEquipSummary(char) {
  const eq = ensureEquipped(char);
  const inv = Array.isArray(char?.inventory) ? char.inventory : [];
  const parts = EQUIP_SLOTS.map((slot) => {
    const icon = SLOT_ICON[slot] || '🧩';
    const id = String(eq?.[slot] || '');
    if (!id) return { full: `${icon} -`, short: `${icon} -` };
    const it = inv.find((x) => getInvItemId(x) === id);
    const name = it ? itemDisplayName(it) : '?';
    return { full: `${icon} ${name}`, short: `${icon} ${shortText(name)}` };
  });
  return { full: parts.map((p) => p.full).join(' | '), short: parts.map((p) => p.short).join(' | ') };
}

function compactIO(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (!x?.itemId) return;
    const id = String(x.itemId);
    const qty = Math.max(1, Number(x.qty || 1));
    map.set(id, (map.get(id) || 0) + qty);
  });
  return [...map.entries()].map(([itemId, qty]) => ({ itemId, qty }));
}

function isEnabledScenarioEvent(ev) {
  return ev?.enabled !== false;
}

function getScenarioEventTimeOfDay(ev) {
  const raw = String(ev?.timeOfDay || ev?.time || 'both').toLowerCase();
  if (raw === 'day' || raw === 'night' || raw === 'both') return raw;
  if (raw === 'any') return 'both';
  return 'both';
}

// --- 로컬 설정: 맵 하이퍼루프 목적지(어드민 로컬 저장) ---
function localKeyHyperloops(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_map_hyperloops_${id}` : '';
}

// --- 로컬 설정: 하이퍼루프 장치(패드) 구역 ---
function localKeyHyperloopDeviceZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_hyperloop_zone_${id}` : '';
}

function readLocalJsonArray(key) {
  const k = String(key || '').trim();
  if (!k) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(k);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function uniqStr(list) {
  const out = [];
  const s = new Set();
  for (const v of (Array.isArray(list) ? list : [])) {
    const k = String(v || '').trim();
    if (!k) continue;
    if (s.has(k)) continue;
    s.add(k);
    out.push(k);
  }
  return out;
}

// --- 필드 파밍(이벤트 외): 맵의 itemCrates(lootTable)에서 아이템을 획득 ---
function randInt(min, max) {
  const a = Math.floor(Number(min || 0));
  const b = Math.floor(Number(max || 0));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pickWeighted(list) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.reduce((sum, x) => sum + Math.max(0, Number(x?.weight || 1)), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, Number(x?.weight || 1));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}

// --- 티어(장비 등급): 1=일반, 2=고급, 3=희귀, 4=영웅, 5=전설, 6=초월 ---
// ※ 함수명은 기존 호환을 위해 유지(실제 상한은 6)
function clampTier4(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(6, Math.max(1, n));
}

function tierLabelKo(tier) {
  const t = clampTier4(tier);
  if (t === 6) return '초월';
  if (t === 5) return '전설';
  if (t === 4) return '영웅';
  if (t === 3) return '희귀';
  if (t === 2) return '고급';
  return '일반';
}

function crateTypeLabel(crateType) {
  const k = String(crateType || '').toLowerCase();
  if (k === 'food') return '음식 상자';
  if (k === 'legendary_material') return '전설 재료 상자';
  if (k === 'transcend_pick') return '초월 장비 선택 상자';
  // legacy/기타
  if (k.includes('legendary')) return '전설 재료 상자';
  return '상자';
}

// 🎁 초월 장비 선택 상자: 후보 2~3개를 뽑아 "선택"하게 하는 최소 구현
function rollTranscendPickOptions(publicItems, count = 3) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const equipT4 = list
    .filter((it) => it?._id)
    .filter((it) => inferItemCategory(it) === 'equipment')
    .filter((it) => clampTier4(it?.tier || 1) >= 6);
  if (!equipT4.length) return [];

  // 슬롯 다양성 우선(가능하면 서로 다른 슬롯)
  const bySlot = {};
  for (const it of equipT4) {
    const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase() || 'etc';
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot].push(it);
  }

  const slots = Object.keys(bySlot);
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = slots[i];
    slots[i] = slots[j];
    slots[j] = tmp;
  }

  const picked = [];
  const used = new Set();

  for (const s of slots) {
    if (picked.length >= count) break;
    const arr = bySlot[s] || [];
    if (!arr.length) continue;
    const it = arr[Math.floor(Math.random() * arr.length)];
    const id = String(it?._id || '');
    if (!id || used.has(id)) continue;
    used.add(id);
    picked.push(it);
  }

  if (picked.length < Math.min(count, equipT4.length)) {
    const rest = equipT4.filter((it) => !used.has(String(it?._id || '')));
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    for (const it of rest) {
      if (picked.length >= count) break;
      const id = String(it?._id || '');
      if (!id || used.has(id)) continue;
      used.add(id);
      picked.push(it);
    }
  }

  return picked.map((it) => ({
    itemId: String(it._id),
    name: String(it?.name || ''),
    tier: clampTier4(it?.tier || 4),
    slot: String(it?.equipSlot || inferEquipSlot(it) || ''),
  }));
}

function pickAutoTranscendOption(options, publicItems) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const scored = (Array.isArray(options) ? options : []).map((o) => {
    const it = list.find((x) => String(x?._id) === String(o?.itemId)) || null;
    const tier = clampTier4(it?.tier ?? o?.tier ?? 4);
    const v = Number(it?.baseCreditValue ?? it?.value ?? 0);
    const score = tier * 100000 + v;
    return { ...o, _score: score };
  });
  scored.sort((a, b) => Number(b?._score || 0) - Number(a?._score || 0));
  return scored[0] || null;
}


function rollFieldLoot(mapObj, zoneId, publicItems, ruleset, opts = {}) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const perkLootBias = getPerkLootBias(opts?.perkEffects || {});

  // 존별 상자 허용/금지(서버(DB) 저장)
  // - map.crateAllowDeny: { [zoneId]: ['legendary_material', 'transcend_pick', ...] }  // 금지 리스트
  // - legacy 호환: 서버 필드 자체가 없을 때(구버전)만 로컬 저장값을 fallback으로 사용
  const mapId = String(mapObj?._id || mapObj?.id || '');
  const hasServerCrateAllowDeny = (mapObj?.crateAllowDeny && typeof mapObj.crateAllowDeny === 'object' && !Array.isArray(mapObj.crateAllowDeny));
  let denyByZone = hasServerCrateAllowDeny ? mapObj.crateAllowDeny : {};
  if (typeof window !== 'undefined' && mapId && !hasServerCrateAllowDeny) {
    try {
      const raw = window.localStorage.getItem(`eh_map_zone_crate_rules_${mapId}`);
      const p = raw ? JSON.parse(raw) : null;
      if (p && typeof p === 'object' && !Array.isArray(p)) denyByZone = p;
    } catch {}
  }
  const deny = (denyByZone && Array.isArray(denyByZone[String(zoneId)]) ? denyByZone[String(zoneId)] : []).map((v) => String(v || '').toLowerCase());
  const isDenied = (crateTypeKey) => deny.includes(String(crateTypeKey || '').toLowerCase());

  const inZone = crates
    .filter((c) => String(c?.zoneId) === String(zoneId))
    .filter((c) => !isDenied(String(c?.crateType || 'food').toLowerCase()));

  const moved = !!opts.moved;

  // 룰셋에서 구역 상자 드랍 확률을 가져옵니다(없으면 기본값 사용)
  const field = ruleset?.drops?.fieldCrate || {};
  const fallbackMaxTier = Math.max(1, Number(field?.fallbackMaxTier ?? 2));

  // 전설 재료 상자(필드) 게이트: 기본 2일차 밤 이후
  const curDay = Number(opts?.day ?? opts?.curDay ?? 0);
  const curPhase = String(opts?.phase ?? opts?.curPhase ?? '');
  const gate = field?.legendaryMaterialGate || field?.legendaryMaterial?.gate || null;
  const gateDay = Number(gate?.day ?? 2);
  const gateTodRaw = String(gate?.timeOfDay ?? gate?.phase ?? 'night');
  const gateTod = gateTodRaw === 'morning' ? 'day' : (gateTodRaw === 'day' ? 'day' : 'night');
  const legendEnabled = (curDay && curPhase) ? isAtOrAfterWorldTime(curDay, curPhase, gateDay, gateTod) : true;

  // 맵에 상자 데이터가 없거나(기본 구역만 적용한 경우), 현재 구역에 상자가 없으면
  // "최소 루프"가 끊기지 않도록 fallback 드랍을 허용합니다.
  // - 전설 재료 상자가 아직 열리면 안 되는 구간(게이트 이전)에서
  //   구역 상자가 전설 상자만 있는 경우도 fallback로 처리합니다.
  const legendOnly = !legendEnabled && inZone.length && inZone.every((c) => String(c?.crateType || '').toLowerCase() === 'legendary_material');
  const useFallback = !inZone.length || legendOnly;

  // 전설 재료(운석/생나/미스릴/포스코어) 드랍 가중치: ruleset(worldSpawns.legendaryCrate) 우선
  const legendDropWeights = (opts?.dropWeightsByKey && typeof opts.dropWeightsByKey === 'object')
    ? opts.dropWeightsByKey
    : ((opts?.weightsByKey && typeof opts.weightsByKey === 'object')
      ? opts.weightsByKey
      : (ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey || null));

  const chanceBase = useFallback
    ? (moved ? Number(field?.fallbackChanceMoved ?? 0.20) : Number(field?.fallbackChanceStay ?? 0.08))
    : (moved ? Number(field?.chanceMoved ?? 0.28) : Number(field?.chanceStay ?? 0.12));
  const chance = Math.max(0.01, Math.min(0.98, chanceBase + Math.max(-0.05, Math.min(0.16, perkLootBias * 0.18))));
  if (Math.random() >= chance) return null;

  // 1) 구역 상자 기반 드랍(맵에 crateType이 있으면 사용, 없으면 food)
  if (!useFallback) {
    const usable = legendEnabled ? inZone : inZone.filter((c) => String(c?.crateType || '').toLowerCase() !== 'legendary_material');
    if (!usable.length) return null;
    const crate = usable[Math.floor(Math.random() * usable.length)];
    const crateType = String(crate?.crateType || 'food');
    const ctLower = String(crateType).toLowerCase();

    // 전설 재료 상자라면: 룰셋 dropWeightsByKey 기준으로 운석/생나/미스릴/포스코어를 굴립니다.
    if (ctLower === 'legendary_material') {
      const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
      const picked = pickWeighted(candidates);
      const item = picked?.item || null;
      if (item?._id) {
        return { item, itemId: String(item._id), qty: 1, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
      }
      // 후보를 찾지 못하면, 맵 lootTable로 fallback(있는 경우)
    }

    // 초월 장비 선택 상자라면: 아이템을 바로 주지 않고 후보를 반환합니다.
    if (ctLower === 'transcend_pick') {
      const optCount = Math.max(2, Math.min(3, Number(ruleset?.drops?.crateTypes?.transcend_pick?.optionsCount ?? 3)));
      const options = rollTranscendPickOptions(publicItems, optCount);
      if (!options.length) return null;
      return { item: null, itemId: '', qty: 1, crateId: crate?.crateId || '', crateType, options, zoneId: String(zoneId || '') };
    }

    const weightedLootTable = (Array.isArray(crate?.lootTable) ? crate.lootTable : []).map((entry) => {
      const itemId = String(entry?.itemId || '');
      const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
      const special = classifySpecialByName(item?.name);
      const isEquip = inferItemCategory(item) === 'equipment';
      const weight = applyPerkLootWeight(entry?.weight || 1, opts?.perkEffects || {}, { rareBoost: special ? 0.7 : (isEquip ? 0.35 : 0) });
      return { ...entry, _item: item, weight };
    });
    const entry = pickWeighted(weightedLootTable);
    if (!entry?.itemId) return null;

    const itemId = String(entry.itemId);
    const item = entry?._item || (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
    let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
    const itemCat = inferItemCategory(item);
    if ((itemCat === 'material' || itemCat === 'consumable') && Math.random() < Math.max(0, perkLootBias) * 0.45) {
      qty += 1;
    }

    return { item, itemId, qty, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
  }

  // 2) fallback: 음식 상자 / 전설 재료 상자 / 초월 장비 선택 상자
  const list = Array.isArray(publicItems) ? publicItems : [];

  const ct = ruleset?.drops?.crateTypes || {};
  const wFood0 = Math.max(0, Number(ct?.food?.weight ?? ct?.food ?? 80));
  const wLegendBase0 = Number(field?.legendaryMaterialWeight ?? field?.legendaryMaterial?.weight ?? ct?.legendary_material?.weight ?? ct?.legendary_material ?? 15);
  const wLegend0 = legendEnabled ? Math.max(0, wLegendBase0) : 0;
  const wTrans0 = Math.max(0, Number(ct?.transcend_pick?.weight ?? ct?.transcend_pick ?? 5));

  // 존 금지 타입은 fallback에서도 0 처리
  const rareCrateBonus = Math.max(0, perkLootBias);
  const wFood = isDenied('food') ? 0 : applyPerkLootWeight(wFood0, opts?.perkEffects || {}, { rareBoost: 0 });
  const wLegend = isDenied('legendary_material') ? 0 : applyPerkLootWeight(wLegend0, opts?.perkEffects || {}, { rareBoost: 0.5 + rareCrateBonus * 0.5 });
  const wTrans = isDenied('transcend_pick') ? 0 : applyPerkLootWeight(wTrans0, opts?.perkEffects || {}, { rareBoost: 0.4 + rareCrateBonus * 0.4 });

  const typeCandidates = [
    { item: 'food', weight: wFood },
    { item: 'legendary_material', weight: wLegend },
    { item: 'transcend_pick', weight: wTrans },
  ].filter((x) => Number(x?.weight || 0) > 0);

  if (!typeCandidates.length) return null;
  const pickedType = pickWeighted(typeCandidates)?.item || null;
  if (!pickedType) return null;

  if (pickedType === 'legendary_material') {
    const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
    const picked = pickWeighted(candidates);
    const item = picked?.item || null;
    if (item?._id) return { item, itemId: String(item._id), qty: 1, crateId: 'fallback', crateType: 'legendary_material', zoneId: String(zoneId || '') };
  }

  if (pickedType === 'transcend_pick') {
    const optCount = Math.max(2, Math.min(3, Number(ct?.transcend_pick?.optionsCount ?? 3)));
    const options = rollTranscendPickOptions(publicItems, optCount);
    if (options.length) return { item: null, itemId: '', qty: 1, crateId: 'fallback', crateType: 'transcend_pick', options, zoneId: String(zoneId || '') };
  }

  // food crate: 하급 재료 + 소모품(치유/음식)
  const pool = [];
  const isDay1 = Number(curDay || 0) === 1;
  for (const it of list) {
    if (!it?._id) continue;
    const tier = clampTier4(it?.tier || 1);
    const cat = inferItemCategory(it);

    // 특수 재료는 food crate에선 제외(전설 재료 상자에서)
    const sp = classifySpecialByName(it?.name);
    if (sp) continue;

    if (cat === 'material') {
      if (tier > fallbackMaxTier) continue;

      const nm = String(it?.name || '').toLowerCase();
      const v = Number(it?.baseCreditValue ?? it?.value ?? 0);

      let w = 1;
      if (tier <= 1) w += 2;
      if (v > 0 && v <= 40) w += 1;
      if (nm.includes('천') || nm.includes('가죽') || nm.includes('돌') || nm.includes('나무') || nm.includes('철') || nm.includes('부품')) w += 1;

      // ✅ 1일차 템포 튜닝: 하급 재료는 한 번에 2~3개 나오도록(영웅 세팅 목표)
      // - 인벤 재료 스택 상한(기본 3)을 넘기지 않게 maxQty=3 유지
      const minQty = (isDay1 && tier <= 1) ? 2 : 1;
      const maxQty = (isDay1 && tier <= 1) ? 3 : 1;
      if (isDay1 && tier <= 1) w += 3; // 하급 재료 우선

      pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(w, opts?.perkEffects || {}, { rareBoost: tier >= 2 ? 0.15 : 0 }), minQty, maxQty });
      continue;
    }

    if (cat === 'consumable') {
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      // 음식/치유 위주
      if (t === 'food' || tags.includes('food') || tags.includes('heal') || tags.includes('medical')) {
        pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(2, opts?.perkEffects || {}, { rareBoost: tags.includes('medical') ? 0.1 : 0 }), minQty: 1, maxQty: 1 });
      }
    }
  }

  const entry = pickWeighted(pool);
  if (!entry?.itemId) return null;

  const itemId = String(entry.itemId);
  const item = list.find((it) => String(it?._id) === itemId) || null;
  let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
  if (Math.random() < Math.max(0, perkLootBias) * 0.45) qty += 1;
  return { item, itemId, qty, crateId: 'fallback', crateType: 'food', zoneId: String(zoneId || '') };
}


// --- 전설 재료 상자(필드 드랍): 3일차 '낮' 이후부터 맵 곳곳에서 발견 가능 ---
function normalizeMatchKey(v) {
  // NOTE: 정규식 문자 클래스 내 '-'는 범위로 해석될 수 있으니 끝으로 옮기거나 이스케이프한다.
  return String(v || '').toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・_.(),-]/g, '');
}

function findItemByKeywords(publicItems, keywords) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const keys = (Array.isArray(keywords) ? keywords : [])
    .map((k) => normalizeMatchKey(k))
    .filter(Boolean);
  if (!keys.length) return null;
  return (
    list.find((it) => {
      const name = normalizeMatchKey(it?.name || it?.text || '');
      return keys.some((k) => name.includes(k));
    }) || null
  );
}

// --- 🧾 장비 티어 요약(공용) ---
// NOTE:
// - 여러 로직(야생동물 크레딧 언더독 보정, AI 교전 회피 등)에서 공통으로 사용한다.
// - equipped가 있으면 그 슬롯 기준으로, 없으면 inventory의 equipSlot/type 힌트로 추정한다.
function getEquipTierSummary(c) {
  const inv = Array.isArray(c?.inventory) ? c.inventory : [];
  const eq = c?.equipped || null;

  function pickById(id) {
    if (!id) return null;
    const sid = String(id);
    return inv.find((it) => {
      const iid = String(it?.itemId || it?.id || it?._id || '');
      return iid && iid === sid;
    }) || null;
  };

  function readTier(it) {
    const t = Number(it?.tier ?? it?.t ?? 1);
    return Number.isFinite(t) ? Math.max(1, Math.floor(t)) : 1;
  };

  // 1) equipped 기반
  if (eq && typeof eq === 'object') {
    const w = pickById(eq.weapon);
    const h = pickById(eq.head);
    const c2 = pickById(eq.clothes);
    const a = pickById(eq.arm);
    const s = pickById(eq.shoes);

    const weaponTier = w ? readTier(w) : 0;
    const armorTierSum = (h ? readTier(h) : 0) + (c2 ? readTier(c2) : 0) + (a ? readTier(a) : 0) + (s ? readTier(s) : 0);
    return { weaponTier, armorTierSum };
  }

  // 2) fallback: inventory 힌트 기반(구형 데이터)
  let weaponTier = 0;
  let armorTierSum = 0;
  const armorSlots = new Set(['head', 'clothes', 'arm', 'shoes']);
  for (const it of inv) {
    const slot = String(it?.equipSlot || '');
    const tp = String(it?.type || '').toLowerCase();
    const t = readTier(it);
    if (slot === 'weapon' || tp === 'weapon' || tp === '무기') weaponTier = Math.max(weaponTier, t);
    else if (armorSlots.has(slot)) armorTierSum += t;
  }
  return { weaponTier, armorTierSum };
}


function getLegendaryCoreCandidates(publicItems, weightsByKey = null) {
  const w = (weightsByKey && typeof weightsByKey === 'object') ? weightsByKey : {};

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const mithril = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
  const forceCore = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);

  const out = [];
  if (meteor?._id) out.push({ key: 'meteor', item: meteor, weight: Math.max(0.01, Number(w.meteor ?? 3)) });
  if (tree?._id) out.push({ key: 'life_tree', item: tree, weight: Math.max(0.01, Number(w.life_tree ?? 3)) });
  if (mithril?._id) out.push({ key: 'mithril', item: mithril, weight: Math.max(0.01, Number(w.mithril ?? 2)) });
  if (forceCore?._id) out.push({ key: 'force_core', item: forceCore, weight: Math.max(0.01, Number(w.force_core ?? 1)) });
  return out;
}

function resolveLegendaryDropWeights(opts = {}, ruleset = null) {
  if (opts?.dropWeightsByKey && typeof opts.dropWeightsByKey === 'object') return opts.dropWeightsByKey;
  if (opts?.weightsByKey && typeof opts.weightsByKey === 'object') return opts.weightsByKey;
  return ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey || null;
}

function rollLegendaryCrateLoot(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 게이트: 3일차 '낮' 이후부터
  if (!isAtOrAfterWorldTime(curDay, curPhase, 3, 'day')) return null;

  const moved = !!opts.moved;
  // 전설 재료 상자는 자주 나오면 밸런스가 무너져서, 이동 시에도 낮은 확률로만 발견
  const chance = moved ? 0.09 : 0.03;
  if (Math.random() >= chance) return null;

  const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  const item = picked?.item || null;
  if (!item?._id) return null;

  return { item, itemId: String(item._id), qty: 1, crateType: 'legendary_material', zoneId: String(zoneId || '') };
}

// --- 키오스크(구매/교환): 2일차 '낮' 이후부터 이용 가능 ---
// 목표: 이벤트 없이도 "상자/키오스크/사냥/드론" 루프가 돌아가도록, 최소 동작(구매/교환)을 시뮬에 연결합니다.
// NOTE: 서버(/kiosks API)와 별개로, "시뮬 전용" 규칙 기반으로 작동합니다.

function pickFromAllCrates(mapObj, publicItems) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const pool = [];
  crates.forEach((c) => {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    lt.forEach((e) => {
      if (!e?.itemId) return;
      pool.push({ itemId: String(e.itemId), weight: Math.max(0, Number(e?.weight || 1)), minQty: e?.minQty, maxQty: e?.maxQty });
    });
  });

  // 상자 데이터가 없으면 fallback: 재료(티어1~2) 위주
  if (!pool.length) {
    const list = Array.isArray(publicItems) ? publicItems : [];
    for (const it of list) {
      if (!it?._id) continue;
      if (String(it?.type || '') !== '재료') continue;
      const tier = Number(it?.tier || 1);
      if (tier > 2) continue;
      if (classifySpecialByName(it?.name)) continue;

      const nm = String(it?.name || '').toLowerCase();
      const v = Number(it?.baseCreditValue ?? it?.value ?? 0);
      let w = 1;
      if (tier <= 1) w += 2;
      if (v > 0 && v <= 40) w += 1;
      if (nm.includes('천') || nm.includes('가죽') || nm.includes('돌') || nm.includes('나무') || nm.includes('철') || nm.includes('부품')) w += 1;

      pool.push({ itemId: String(it._id), weight: w, minQty: 1, maxQty: 1 });
    }
  }

  if (!pool.length) return null;
  return pickWeighted(pool);
}

function pickUnitsFromInventory(inventory, n) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const picked = [];
  for (let k = 0; k < n; k++) {
    const total = list.reduce((sum, x) => sum + Math.max(0, Number(x?.qty || 0)), 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      r -= Math.max(0, Number(list[i]?.qty || 0));
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = 0;
    const it = list[idx];
    const id = String(it?.itemId || it?.id || '');
    if (!id) break;
    picked.push({ itemId: id, qty: 1 });
    const nextQty = Math.max(0, Number(it?.qty || 0) - 1);
    if (nextQty <= 0) list.splice(idx, 1);
    else list[idx] = { ...it, qty: nextQty };
  }
  return picked;
}

function removePickedUnitsFromInventory(inventory, picked) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const need = compactIO(Array.isArray(picked) ? picked : []);
  for (const row of need) {
    const itemId = String(row?.itemId || '');
    let remaining = Math.max(0, Number(row?.qty || 0));
    if (!itemId || remaining <= 0) continue;
    for (let i = 0; i < list.length && remaining > 0; i += 1) {
      const curId = String(list[i]?.itemId || list[i]?.id || '');
      if (curId !== itemId) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const nextQty = have - take;
      remaining -= take;
      if (nextQty <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: nextQty };
      }
    }
  }
  return list;
}

function pruneEquippedAgainstInventory(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  const invIds = new Set((Array.isArray(actor?.inventory) ? actor.inventory : []).map((x) => String(getInvItemId(x) || '')).filter(Boolean));
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };
  for (const slot of EQUIP_SLOTS) {
    const curId = String(eq?.[slot] || '');
    if (curId && !invIds.has(curId)) nextEq[slot] = null;
  }
  actor.equipped = nextEq;
  return actor;
}

function clearRuntimeCombatFields(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  actor.lastDamagedBy = '';
  actor.lastDamagedPhaseIdx = -9999;
  actor._deathAt = undefined;
  actor._deathBy = undefined;
  actor._detLogLastMilestone = null;
  actor._gatherPvpBonus = 0;
  actor._gatherPvpBonusUntilPhaseIdx = -9999;
  actor._immediateDanger = 0;
  actor._immediateDangerUntilPhaseIdx = -9999;
  actor.aiTargetZoneId = '';
  actor.aiTargetTTL = 0;
  actor.safeZoneUntil = 0;
  actor._recentCombatUntil = 0;
  actor._recentCombatWith = '';
  actor._recentCombatReason = '';
  return actor;
}

function applyAiRecoveryWindow(actor, absSec, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const now = Number.isFinite(Number(absSec)) ? Number(absSec) : 0;
  const recoverSec = Math.max(0, Number(opts?.recoverSec ?? 0));
  const safeZoneSec = Math.max(0, Number(opts?.safeZoneSec ?? 0));
  const reason = String(opts?.reason || '');
  const opponentId = String(opts?.opponentId || '');
  const retargetZoneId = String(opts?.retargetZoneId || '');
  const retargetTtl = Math.max(0, Math.floor(Number(opts?.retargetTtl ?? 0)));
  actor.aiTargetZoneId = retargetZoneId || '';
  actor.aiTargetTTL = retargetZoneId ? retargetTtl : 0;
  actor._recentCombatUntil = Math.max(0, now + recoverSec, Number(actor?._recentCombatUntil || 0));
  actor._recentCombatWith = opponentId;
  actor._recentCombatReason = reason;
  if (safeZoneSec > 0) {
    actor.safeZoneUntil = Math.max(Number(actor?.safeZoneUntil || 0), now + safeZoneSec);
  }
  return actor;
}

function isAiRecoveryLocked(actor, absSec) {
  return Number(actor?._recentCombatUntil || 0) > Number(absSec || 0);
}

function normalizeDeadSnapshot(actor, ruleset) {
  if (!actor || typeof actor !== 'object') return actor;
  const dead = normalizeRuntimeSurvivor(actor);
  dead.inventory = normalizeInventory(dead.inventory, ruleset);
  pruneEquippedAgainstInventory(dead);
  clearRuntimeCombatFields(dead);
  dead.hp = 0;
  return dead;
}

function normalizeRevivedSurvivor(actor, revivedHp, zoneId, phaseIdxNow, ruleset, absSec = 0, reviveKit = null) {
  if (!actor || typeof actor !== 'object') return actor;
  const revived = normalizeRuntimeSurvivor(actor);
  revived.inventory = normalizeInventory(revived.inventory, ruleset);
  pruneEquippedAgainstInventory(revived);
  clearRuntimeCombatFields(revived);
  revived.hp = Math.max(1, Math.min(Number(revived.maxHp || revivedHp || 1), Number(revivedHp || 1)));
  revived.zoneId = String(zoneId || revived.zoneId || '');
  revived.activeEffects = [];
  revived.statusImmunities = Array.isArray(revived.statusImmunities) ? [...revived.statusImmunities] : [];
  revived.statusResists = revived.statusResists && typeof revived.statusResists === 'object' ? { ...revived.statusResists } : {};
  revived.revivedOnce = true;
  revived.revivedAtPhaseIdx = phaseIdxNow;
  revived.deadAtPhaseIdx = undefined;
  revived.reviveEligible = false;
  applyAiRecoveryWindow(revived, absSec, { reason: 'revive', recoverSec: 8, safeZoneSec: 10 });
  if (reviveKit && reviveKit._id) {
    revived.inventory = addItemToInventory(revived.inventory, reviveKit, String(reviveKit._id), 1, 1, ruleset);
  }
  pruneEquippedAgainstInventory(revived);
  return revived;
}

function applyStatusEffect(actor, effect, opts = {}) {
  if (!actor || typeof actor !== 'object') return { applied: false, reason: 'invalid' };
  const res = addOrRefreshEffect(actor, effect, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return res;
}

function clearNegativeStatusEffects(actor, opts = {}) {
  if (!actor || typeof actor !== 'object') return { changed: false, removed: [] };
  const res = purgeNegativeEffects(actor, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return { changed: !!res?.changed, removed: Array.isArray(res?.removed) ? res.removed : [] };
}

function applyShieldEffect(actor, shieldValue, duration = 2, sourceId = '') {
  const shield = Math.max(0, Math.floor(Number(shieldValue || 0)));
  if (!actor || shield <= 0) return { applied: false, shield: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_SHIELD,
    shieldValue: shield,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, shield };
}

function applyRegenEffect(actor, recovery, duration = 2, sourceId = '') {
  const rec = Math.max(0, Math.floor(Number(recovery || 0)));
  if (!actor || rec <= 0) return { applied: false, recovery: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_REGEN,
    recovery: rec,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, recovery: rec };
}

function describeRuntimeEffect(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff) return '';
  const name = String(eff?.name || '효과');
  if (name === EFFECT_SHIELD) return `보호막 +${Math.max(0, Number(eff?.shieldValue || 0))}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  if (name === EFFECT_REGEN) return `재생 ${Math.max(0, Number(eff?.recovery || 0))}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  const statMods = eff?.statModifiers && typeof eff.statModifiers === 'object' ? eff.statModifiers : null;
  if (statMods && Object.keys(statMods).length) {
    const bits = Object.entries(statMods).map(([k, v]) => `${String(k)} ${Number(v) > 0 ? '+' : ''}${Number(v)}`);
    return `${name}${bits.length ? ` [${bits.join(', ')}]` : ''}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  }
  return `${name}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
}

function applyRuntimeEffectPayloads(actor, effects) {
  const list = normalizeStatusEffectList(effects).map((x) => normalizeRuntimeEffect(x)).filter(Boolean);
  const results = [];
  list.forEach((effect) => {
    const res = applyStatusEffect(actor, effect);
    results.push({ ...res, effect });
  });
  return {
    results,
    applied: results.some((x) => !!x?.applied),
  };
}

function consumeShieldDamage(actor, rawDamage) {
  const result = absorbShieldDamage(actor, rawDamage);
  actor.activeEffects = Array.isArray(result?.character?.activeEffects)
    ? result.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return result;
}

function clearPostCombatEffects(actor) {
  if (!actor || typeof actor !== 'object') return false;
  const res = clearNegativeStatusEffects(actor, { names: [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN], removeAllNegative: false });
  actor.activeEffects = Array.isArray(actor.activeEffects) ? actor.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
  return !!res.changed;
}

function countInventoryUnits(inventory) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => sum + Math.max(0, Number(x?.qty ?? 1)), 0);
}

function kioskLegendaryPrice(key, priceByKey) {
  const table = priceByKey && typeof priceByKey === 'object' ? priceByKey : {};
  const v = Number(table?.[key]);
  if (Number.isFinite(v) && v > 0) return v;

  // fallback: 기본 아이템 트리(baseCreditValue) 기준
  if (key === 'force_core') return 1200;
  if (key === 'mithril') return 900;
  return 800; // meteor / life_tree
}


function zoneNameHasKiosk(name) {
  const nm = String(name || '').toLowerCase();
  // 키오스크 위치: 병원, 성당, 경찰서, 소방서, 양궁장, 절, 창고, 연구소, 호텔
  const keywords = [
    '병원', 'hospital',
    '성당', 'cathedral', 'church',
    '경찰서', 'police',
    '소방서', 'fire station', 'firestation', 'fire',
    '양궁장', '양궁', 'archery',
    '절', 'temple',
    '창고', 'warehouse', 'storage',
    '연구소', 'lab', 'research',
    '호텔', 'hotel',
    '학교', 'school', 'academy',
  ];
  return keywords.some((k) => nm.includes(String(k).toLowerCase()));
}

function hasKioskAtZone(kiosks, mapObj, zoneId) {
  const zId = String(zoneId || '');
  if (!zId) return false;

  // 1) 서버에서 내려오는 실제 키오스크 배치(/public/kiosks)가 있으면, 그걸 우선으로 사용합니다.
  if (Array.isArray(kiosks) && kiosks.length) {
    const mapId = String(mapObj?._id || mapObj?.id || '');
    const hit = kiosks.some((k) => {
      const km = String(k?.mapId?._id || k?.mapId || '');
      const kz = String(k?.zoneId || '');
      return mapId && km === mapId && kz === zId;
    });
    if (hit) return true;
  }

  // 2) fallback: 맵 구역 이름으로 판정(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교)
  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const zone = zonesArr.find((z) => String(z?.zoneId || '') === zId) || null;
  return zoneNameHasKiosk(zone?.name || '');
}

function canUseKioskAtWorldTime(day, phase) {
  // 실제 ER 일반 Kiosk는 게임 시작부터 접근 가능하고, 사용 제약은 크레딧/위치 쪽이 핵심이다.
  return Number(day || 1) >= 1 && !!String(phase || 'morning');
}


// --- 월드 스폰(맵 이벤트): 전설 재료 상자/보스(알파/오메가/위클라인) ---
// 목적: "랜덤 조우"가 아니라, 날짜/낮 조건에 따라 맵 어딘가에 스폰 → 해당 구역에 들어가면 조우/획득.
// NOTE: 시뮬 페이지(클라이언트) 기준의 단순 월드 상태이며, 서버 영구 저장은 추후 단계에서 연결.

function createInitialSpawnState(mapId = '') {
  return {
    mapId: String(mapId || ''),
    // 🦌 야생동물 스폰(존별 카운트): 매 페이즈에 최소 수량을 유지(Top-up)
    // - 목적: '확률 조우'만으로는 파밍 루프(크레딧/키오스크)가 약해져서,
    //   월드 상태로 "존에 야생동물이 충분히 존재"하도록 관리합니다.
    wildlife: {},
    // 전설 재료 상자(드랍된 상자) 목록: 열린 상자는 일정 기간 후 정리
    legendaryCrates: [],
    // 자연 코어(운석/생명의 나무) 스폰: 2일차 낮 이후 일부 구역에 스폰 → 해당 구역 진입 시 습득
    coreNodes: [],
    // 음식 상자(드랍된 상자): 매일 낮 시작 시 일부 구역에 스폰
    foodCrates: [],
    // 보스(구역에 1개씩 스폰): 살아있으면 유지, 처치되면 다시 스폰 가능
    bosses: {
      alpha: null,
      omega: null,
      weakline: null,
    },
    // 마지막 스폰 날짜(낮 페이즈 시작 시 1회만 생성)
    spawnedDay: {
      legendary: -1,
      core: -1,
      food: -1,
      alpha: -1,
      omega: -1,
      weakline: -1,
      wildlife: -1,
    },
    // 내부 카운터(id 생성용)
    counters: { crate: 0, core: 0, food: 0 },
  };
}


function cloneSpawnState(state, mapId = '') {
  const safe = state && typeof state === 'object' ? state : null;
  const mid = String(mapId || '');
  if (!safe || String(safe.mapId || '') !== mid) return createInitialSpawnState(mid);

  const spawnedDay = {
    legendary: Number(safe?.spawnedDay?.legendary ?? -1),
    core: Number(safe?.spawnedDay?.core ?? -1),
    food: Number(safe?.spawnedDay?.food ?? -1),
    alpha: Number(safe?.spawnedDay?.alpha ?? -1),
    omega: Number(safe?.spawnedDay?.omega ?? -1),
    weakline: Number(safe?.spawnedDay?.weakline ?? -1),
    wildlife: Number(safe?.spawnedDay?.wildlife ?? -1),
  };

  const counters = {
    crate: Number(safe?.counters?.crate ?? 0),
    core: Number(safe?.counters?.core ?? 0),
    food: Number(safe?.counters?.food ?? 0),
  };

  return {
    mapId: String(safe.mapId || ''),
    wildlife: (safe.wildlife && typeof safe.wildlife === 'object') ? { ...safe.wildlife } : {},
    legendaryCrates: Array.isArray(safe.legendaryCrates) ? safe.legendaryCrates.map((c) => ({ ...c })) : [],
    coreNodes: Array.isArray(safe.coreNodes) ? safe.coreNodes.map((n) => ({ ...n })) : [],
    foodCrates: Array.isArray(safe.foodCrates) ? safe.foodCrates.map((c) => ({ ...c })) : [],
    bosses: {
      alpha: safe?.bosses?.alpha ? { ...safe.bosses.alpha } : null,
      omega: safe?.bosses?.omega ? { ...safe.bosses.omega } : null,
      weakline: safe?.bosses?.weakline ? { ...safe.bosses.weakline } : null,
    },
    spawnedDay,
    counters,
  };
}


function zoneHasKioskFlag(zone) {
  if (!zone) return false;
  if (typeof zone?.hasKiosk === 'boolean') return !!zone.hasKiosk;
  // name/zoneId 기반 휴리스틱(기본 구역 세트 대응)
  return zoneNameHasKiosk(zone?.name || '') || zoneNameHasKiosk(zone?.zoneId || '');
}

function getEligibleSpawnZoneIds(zones, forbiddenIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && !zoneHasKioskFlag(z))
    .map(({ zid }) => zid);
}


// LEGACY: 데이터(coreSpawn/coreSpawnZones) 누락 대비 기본 허용 구역
const LEGACY_CORE_ZONE_IDS = ['beach', 'forest', 'stream', 'pond', 'factory', 'port'];
const LEGACY_CORE_ZONE_NAME_KEYS = ['모래사장', '숲', '개울', '연못', '공장', '항구'];


function zoneAllowsNaturalCore(zone, allowSet) {
  if (!zone) return false;
  // 키오스크 구역은 자연 코어 스폰 제외(안전지대 느낌)
  if (zoneHasKioskFlag(zone)) return false;

  const zid = String(zone?.zoneId || '');

  // 맵 단위 허용 리스트가 있으면 최우선
  if (allowSet instanceof Set && allowSet.size) {
    return zid && allowSet.has(zid);
  }

  // zones[*].coreSpawn 플래그가 있으면 그걸 사용
  if (typeof zone?.coreSpawn === 'boolean') return !!zone.coreSpawn;

  // 데이터가 없으면 기본 허용 구역(레거시)만 허용
  const nm = String(zone?.name || '');
  return LEGACY_CORE_ZONE_IDS.includes(zid) || LEGACY_CORE_ZONE_NAME_KEYS.includes(nm);
}

function getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const allowSet = Array.isArray(coreSpawnZoneIds) && coreSpawnZoneIds.length ? new Set(coreSpawnZoneIds.map(String)) : null;

  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && zoneAllowsNaturalCore(z, allowSet))
    .map(({ zid }) => zid);
}


// --- 로컬 설정: 변이 야생동물(밤) 스폰 구역 ---
function localKeyMutantWildlifeZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_mutant_spawn_zone_${id}` : '';
}

function readLocalString(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(k) || '');
  } catch {
    return '';
  }
}

function getMutantWildlifeSpawnZoneId(mapId) {
  const k = localKeyMutantWildlifeZone(mapId);
  return readLocalString(k);
}

function getHyperloopDeviceZoneId(mapId) {
  const k = localKeyHyperloopDeviceZone(mapId);
  return readLocalString(k);
}

function ensureWorldSpawns(prevState, zones, forbiddenIds, curDay, curPhase, mapId, coreSpawnZoneIds, ruleset) {
  const announcements = [];
  const s = cloneSpawnState(prevState, mapId);

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws.core || {};
  const legRule = ws.legendaryCrate || {};
  const bossRule = ws.bosses || {};
  const foodRule = ws.foodCrate || {};

  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  const coreDiv = Math.max(1, Number(coreRule?.scaleDiv ?? 7));
  const coreMaxPerDay = Math.max(1, Number(coreRule?.perDayMax ?? 2));
  const coreKeepDays = Math.max(1, Number(coreRule?.keepDays ?? 2));

  const legGateDay = Number(legRule?.gateDay ?? 3);
  const legDiv = Math.max(1, Number(legRule?.scaleDiv ?? 6));
  const legMaxPerDay = Math.max(1, Number(legRule?.perDayMax ?? 3));
  const legKeepDays = Math.max(1, Number(legRule?.keepDays ?? 3));

  const foodGateDay = Number(foodRule?.gateDay ?? 1);
  const foodDiv = Math.max(1, Number(foodRule?.scaleDiv ?? 5));
  const foodMaxPerDay = Math.max(1, Number(foodRule?.perDayMax ?? 4));
  const foodKeepDays = Math.max(1, Number(foodRule?.keepDays ?? 2));

  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const d = Number(curDay || 0);
  const p = String(curPhase || '');
  const spawnKey = d + (p === 'night' ? 0.5 : 0.0);

  // 오래된/열린 오브젝트 정리(중복 선언 방지: 함수 말미에서 1회만 수행)

  const eligible = getEligibleSpawnZoneIds(zones, forbiddenIds);
  if (!eligible.length) return { state: s, announcements };

  // --- 🦌 야생동물 스폰(존별 카운트): 매 페이즈 Top-up ---
  // 목적:
  // - '확률 조우'만으로는 파밍 루프(크레딧→키오스크→전설/초월 제작)가 약해지므로,
  //   월드 스폰 상태로 "각 존에 야생동물이 충분히 존재"하도록 유지합니다.
  // - UI/로그에서 total/empty를 쉽게 확인(요청: "매 페이즈 스폰 체크")
  try {
    const wildRule = ws?.wildlife || {};
    const perZoneMinDay = Math.max(0, Number(wildRule?.perZoneMinDay ?? 2));
    const perZoneMinNight = Math.max(0, Number(wildRule?.perZoneMinNight ?? 2));
    const extraTotalDay = Math.max(0, Number(wildRule?.extraTotalDay ?? eligible.length));
    const extraTotalNight = Math.max(0, Number(wildRule?.extraTotalNight ?? eligible.length));

    const perZoneMin = (timeOfDay === 'day') ? perZoneMinDay : perZoneMinNight;
    const extraTotal = (timeOfDay === 'day') ? extraTotalDay : extraTotalNight;
    const targetTotal = Math.max(0, eligible.length * perZoneMin + extraTotal);

    // per-phase 키(낮/밤 분리)
    if (Number(s?.spawnedDay?.wildlife) !== spawnKey) {
      if (!s.wildlife || typeof s.wildlife !== 'object') s.wildlife = {};

      // 정리: 현재 맵의 eligible 존만 유지
      const allow = new Set(eligible.map(String));
      Object.keys(s.wildlife).forEach((k) => {
        if (!allow.has(String(k))) delete s.wildlife[k];
      });

      // 1) 각 존 최소치 보장
      for (const zid0 of eligible) {
        const zid = String(zid0 || '');
        if (!zid) continue;
        const cur = Math.max(0, Number(s.wildlife[zid] ?? 0));
        s.wildlife[zid] = Math.max(cur, perZoneMin);
      }

      // 2) 추가 스폰(핫스팟 가중치 분배)
      const hotspot = (wildRule?.hotspotWeights && typeof wildRule.hotspotWeights === 'object') ? wildRule.hotspotWeights : {
        forest: 2.0,
        pond: 1.6,
        stream: 1.6,
        beach: 1.4,
        port: 1.2,
      };

      const weightOf = (zid) => {
        const k = String(zid || '');
        const v = Number(hotspot?.[k]);
        if (Number.isFinite(v) && v > 0) return v;
        return 1.0;
      };

      const sumNow = () => eligible.reduce((sum, z) => sum + Math.max(0, Number(s.wildlife[String(z)] ?? 0)), 0);
      let totalNow = sumNow();
      let add = Math.max(0, targetTotal - totalNow);

      const pickZone = () => {
        const ids = eligible.map(String).filter(Boolean);
        if (!ids.length) return '';
        const totalW = ids.reduce((acc, id) => acc + weightOf(id), 0);
        if (totalW <= 0) return ids[0];
        let r = Math.random() * totalW;
        for (const id of ids) {
          r -= weightOf(id);
          if (r <= 0) return id;
        }
        return ids[ids.length - 1];
      };

      const cap = Math.max(0, Number(wildRule?.topupCapPerPhase ?? (eligible.length * 4)));
      add = Math.min(add, cap);
      for (let i = 0; i < add; i++) {
        const zid = pickZone();
        if (!zid) break;
        s.wildlife[zid] = Math.max(0, Number(s.wildlife[zid] ?? 0)) + 1;
      }

      s.spawnedDay.wildlife = spawnKey;
    }
  } catch {
    // ignore
  }


  const eligibleCore = getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds);


  // --- 자연 코어(운석/생명의 나무): ER 타임라인 기반 ---
  // - 운석: Day 1 Night부터 낮/밤 사이클 전환마다 1개, 총 4개
  // - 생명의 나무: Day 1 Night 2개, Day 2 Night 2개
  // 위치는 시뮬에선 eligibleCore(어드민 지정 coreSpawnZones 우선)에서 랜덤 배치
  const wantMeteor = (d === 1 && p === 'night') || (d === 2 && (p === 'morning' || p === 'night')) || (d === 3 && p === 'morning');
  const wantTree = (d === 1 && p === 'night') ? 2 : (d === 2 && p === 'night') ? 2 : 0;

  if ((wantMeteor || wantTree > 0) && Number(s.spawnedDay.core) !== spawnKey && eligibleCore.length) {
    const alreadyAlive = new Set(
      (Array.isArray(s.coreNodes) ? s.coreNodes : [])
        .filter((n) => !n?.picked)
        .map((n) => String(n?.zoneId))
    );

    const zonePool = eligibleCore.filter((zid) => !alreadyAlive.has(String(zid)));
    let spawned = 0;

    function spawnCore(kind, count) {
      const c = Math.min(Math.max(0, Number(count || 0)), zonePool.length);
      for (let i = 0; i < c; i++) {
        const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
        s.counters.core = Number(s.counters.core || 0) + 1;
        s.coreNodes.push({
          id: `CORE_${String(d)}_${String(s.counters.core)}`,
          kind,
          zoneId: String(zid),
          spawnedDay: d,
          picked: false,
          pickedBy: null,
          pickedAt: null,
        });
        spawned++;
      }
    }

    if (wantTree > 0) spawnCore('life_tree', wantTree);
    if (wantMeteor) spawnCore('meteor', 1);

    s.spawnedDay.core = spawnKey;
    if (spawned > 0) announcements.push(`🌠 희귀 재료 자연 스폰 발생! (x${spawned})`);
  }

  // --- 음식 상자(Blue Air Supply Box): ER 타임라인 기반 ---
  // Day 2: 3 / Night 2: 3 / Day 3: 2 / Night 3: 1
  const foodCount = (d === 2 && p === 'morning') ? 3 : (d === 2 && p === 'night') ? 3 : (d === 3 && p === 'morning') ? 2 : (d === 3 && p === 'night') ? 1 : 0;

  if (foodCount > 0 && Number(s.spawnedDay.food) !== spawnKey) {
    const alreadyAlive = new Set(
      (Array.isArray(s.foodCrates) ? s.foodCrates : [])
        .filter((c) => !c?.opened)
        .map((c) => String(c?.zoneId))
    );

    const zonePool = eligible.filter((zid) => !alreadyAlive.has(String(zid)));
    const pickCount = Math.min(foodCount, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      s.counters.food = Number(s.counters.food || 0) + 1;
      s.foodCrates.push({
        id: `FCRATE_${String(d)}_${String(s.counters.food)}`,
        zoneId: String(zid),
        spawnedDay: d,
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.food = spawnKey;
    if (pickCount > 0) announcements.push(`🍱 음식 상자 드랍 발생! (x${pickCount})`);
  }

  // --- 전설 재료 상자: 3일차 '낮' 이후, 매일 낮 시작에 N개 드랍 ---
  if (timeOfDay === 'day' && Number(curDay || 0) >= legGateDay && Number(s.spawnedDay.legendary) !== Number(curDay || 0)) {
    const alreadyToday = new Set(
      (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
        .filter((c) => Number(c?.spawnedDay) === Number(curDay || 0))
        .map((c) => String(c?.zoneId))
    );

    const maxNew = Math.min(legMaxPerDay, Math.max(1, Math.floor(eligible.length / legDiv) || 1)); // 맵 크기에 따라 1~3개
    const zonePool = eligible.filter((zid) => !alreadyToday.has(String(zid)));
    const pickCount = Math.min(maxNew, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      s.counters.crate = Number(s.counters.crate || 0) + 1;
      s.legendaryCrates.push({
        id: `LCRATE_${String(curDay || 0)}_${String(s.counters.crate)}`,
        zoneId: String(zid),
        spawnedDay: Number(curDay || 0),
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.legendary = Number(curDay || 0);
    if (pickCount > 0) announcements.push(`🟪 전설 재료 상자 드랍 발생! (x${pickCount})`);
  }

  // --- 보스(알파/오메가/위클라인): ER 타임라인 기반 ---
  function spawnBossAt(kind, targetDay) {
    const k = String(kind);
    if (p !== 'night') return;
    if (d !== Number(targetDay || 0)) return;

    const existing = s?.bosses?.[k];
    if (existing) return; // ER: 1회 스폰

    if (Number(s.spawnedDay?.[k]) === spawnKey) return;

    const zid = eligible[randInt(0, Math.max(0, eligible.length - 1))];
    s.bosses[k] = {
      kind: k,
      zoneId: String(zid),
      spawnedDay: d,
      alive: true,
      defeatedBy: null,
      defeatedAt: null,
    };
    s.spawnedDay[k] = spawnKey;

    const label = k === 'alpha' ? '알파' : k === 'omega' ? '오메가' : '위클라인';
    announcements.push(`⚠️ ${label}가 어딘가에 출현했다!`);
  }

  spawnBossAt('alpha', 2);
  spawnBossAt('omega', 3);
  spawnBossAt('weakline', 4);

  // --- 변이 야생동물(요청): 매 밤 시작 시 1마리 스폰(로컬 설정 zone 우선) ---
  if (String(curPhase || '') === 'morning') {
    // 낮 시작 시: 전날 밤 스폰은 정리(남아있어도 아침에 사라짐)
    if (s.mutantWildlife) s.mutantWildlife = null;
  }

  if (String(curPhase || '') === 'night') {
    const nightDay = Number(curDay || 0);
    const mutantRule = ws?.mutantWildlife || {};
    const mutantEnabled = mutantRule?.enabled !== false;
    const mutantGateDay = Math.max(1, Number(mutantRule?.gateDay ?? 2));
    const mutantIntervalNights = Math.max(1, Number(mutantRule?.intervalNights ?? 2));
    const mutantSpawnChance = Math.max(0, Math.min(1, Number(mutantRule?.spawnChance ?? 0.75)));
    const mutantIntervalOk = ((nightDay - mutantGateDay) % mutantIntervalNights) === 0;
    s.spawnedDay = s.spawnedDay || {};
    const already = Number(s.spawnedDay.mutantWildlife || 0) === nightDay && s?.mutantWildlife?.alive;
    if (mutantEnabled && nightDay >= mutantGateDay && mutantIntervalOk && !already && Math.random() < mutantSpawnChance) {
      const cfgZid = String(getMutantWildlifeSpawnZoneId(mapId) || '').trim();
      // 어드민에서 지정한 스폰 구역은 금지구역 여부와 무관하게 "존재하면" 우선 적용
      const allZoneIdSet = new Set((Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || '')).filter(Boolean));
      const zid = (cfgZid && allZoneIdSet.has(cfgZid))
        ? cfgZid
        : String(eligible[randInt(0, Math.max(0, eligible.length - 1))] || '');
      if (zid) {
        const animalPool = ['닭', '멧돼지', '곰', '늑대', '박쥐', '들개'];
        const animal = animalPool[randInt(0, animalPool.length - 1)] || '늑대';
        s.mutantWildlife = {
          zoneId: String(zid),
          animal,
          spawnedDay: d,
          alive: true,
          defeatedBy: null,
          defeatedAt: null,
        };
        s.spawnedDay.mutantWildlife = nightDay;
        const zoneName = (Array.isArray(zones) ? zones : []).find((z) => String(z?.zoneId || '') === String(zid))?.name || zid;
        announcements.push(`🧪 변이 야생동물(${animal}) 출현: ${zoneName}`);
      }
    }
  }

  // 오래된/열린 오브젝트 정리
  const keepFromLegendary = Math.max(0, Number(curDay || 0) - legKeepDays);
  s.legendaryCrates = (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromLegendary);

  const keepFromCore = Math.max(0, Number(curDay || 0) - coreKeepDays);
  s.coreNodes = (Array.isArray(s.coreNodes) ? s.coreNodes : [])
    .filter((n) => !n?.picked)
    .filter((n) => Number(n?.spawnedDay || 0) >= keepFromCore);

  const keepFromFood = Math.max(0, Number(curDay || 0) - foodKeepDays);
  s.foodCrates = (Array.isArray(s.foodCrates) ? s.foodCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromFood);

  return { state: s, announcements };
}


function openSpawnedLegendaryCrate(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.legendaryCrates)) return null;

  const zid = String(zoneId || '');
  const crate = s.legendaryCrates.find((c) => !c?.opened && String(c?.zoneId) === zid) || null;
  if (!crate) return null;

  // 스폰된 상자는 "있으면 거의 연다" 느낌(다만 밤엔 덜 적극적)
  const moved = !!opts.moved;
  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const ws = ruleset?.worldSpawns || {};
  const legRule = ws?.legendaryCrate || {};
  const oc = legRule?.openChance || {};
  const byTod = (timeOfDay === 'day' ? oc.day : oc.night) || {};
  const chance = moved
    ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.85 : 0.55))
    : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.65 : 0.35));
  if (Math.random() >= chance) return null;

  const candidates = getLegendaryCoreCandidates(publicItems, legRule?.dropWeightsByKey);
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  const item = picked?.item || null;
  if (!item?._id) return null;

  crate.opened = true;
  crate.openedBy = String(actor?.name || 'unknown');
  crate.openedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const reward = legRule?.reward || {};
  const cr = reward?.credits || {};
  const minCr = Number(cr?.min ?? 0);
  const maxCr = Number(cr?.max ?? 0);
  const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

  const bonusChance = Math.max(0, Math.min(1, Number(reward?.bonusDropChance ?? 0)));
  let bonusDrops = [];
  if (bonusChance > 0 && Math.random() < bonusChance) {
    const rest = candidates.filter((c) => String(c?.key || '') !== String(picked?.key || ''));
    const bonusPicked = pickWeighted(rest.length ? rest : candidates);
    const bItem = bonusPicked?.item || null;
    if (bItem?._id) {
      bonusDrops = [{ item: bItem, itemId: String(bItem._id), qty: 1 }];
    }
  }

  return { item, itemId: String(item._id), qty: 1, credits, bonusDrops, crateType: 'legendary_material', zoneId: zid };
}

function openSpawnedFoodCrate(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.foodCrates)) return null;

  const zid = String(zoneId || '');
  const crate = s.foodCrates.find((c) => !c?.opened && String(c?.zoneId) === zid) || null;
  if (!crate) return null;

  const moved = !!opts.moved;
  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const ws = ruleset?.worldSpawns || {};
  const rule = ws?.foodCrate || {};
  const oc = rule?.openChance || {};
  const byTod = (timeOfDay === 'day' ? oc.day : oc.night) || {};
  const chance = moved
    ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.70 : 0.45))
    : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.55 : 0.30));
  if (Math.random() >= chance) return null;

  const list = Array.isArray(publicItems) ? publicItems : [];

  // 룰셋 기반 보상 풀/가중치(음식 vs 의료 vs 하급 재료)
  const rt = (ruleset?.worldSpawns || {})?.foodCrate?.rewardTable || {};
  const cats = Array.isArray(rt?.categories) ? rt.categories : [];
  const boosts = rt?.boosts || {};

  // 페이즈(낮/밤)/맵별 카테고리 가중치 보정(옵션)
  // - rulesets.js의 rewardTable.phaseMulByCat / mapMulByMapId
  const pm = rt?.phaseMulByCat || {};
  const mm = rt?.mapMulByMapId || {};
  const byPhase = (timeOfDay === 'day' ? pm.day : pm.night) || {};
  const byMap = mm?.[String(s?.mapId || '')] || mm?.default || {};
  function catMul(key) {
    const k = String(key || '');
    const a = Number(byPhase?.[k] ?? 1);
    const b = Number(byMap?.[k] ?? 1);
    const mul = (Number.isFinite(a) ? a : 1) * (Number.isFinite(b) ? b : 1);
    return Number.isFinite(mul) && mul > 0 ? mul : 1;
  };

  function buildFoodCrateCandidates(key, tierCap) {
    const want = String(key || 'food');
    const cap = Math.max(1, Number(tierCap || 1));
    const out = [];
    for (const it of list) {
      if (!it?._id) continue;
      const sp = classifySpecialByName(it?.name);
      if (sp) continue;

      const cat = inferItemCategory(it);
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      const name = String(it?.name || '');
      const lower = name.toLowerCase();

      if (want === 'food') {
        if (cat !== 'consumable') continue;
        const ok = t === 'food' || tags.includes('food') || name.includes('음식') || name.includes('빵') || name.includes('고기');
        if (!ok) continue;

        let w = 3;
        if (tags.includes('healthy')) w += Math.max(0, Number(boosts?.healthyFood || 0));
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }

      if (want === 'medical') {
        if (cat !== 'consumable') continue;
        const ok = tags.includes('heal') || tags.includes('medical') || lower.includes('bandage') || lower.includes('medkit') || name.includes('붕대') || name.includes('응급');
        if (!ok) continue;

        let w = 3;
        if (name.includes('붕대')) w += Math.max(0, Number(boosts?.bandageName || 0));
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }

      if (want === 'material') {
        if (cat !== 'material') continue;
        const tier = clampTier4(it?.tier || 1);
        if (tier > cap) continue;
        const w = tier <= 1 ? 2 : 1;
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }
    }
    return out;
  }

  const pickedCat = pickWeighted((cats || [])
    .map((c) => {
      const base = Number(c?.weight || 0);
      const w = base * catMul(c?.key);
      return { item: c, weight: w };
    })
    .filter((x) => Number(x?.weight || 0) > 0))?.item || { key: 'food', weight: 1, qty: { min: 1, max: 1 }, tierCap: 1 };

  const catKey = String(pickedCat?.key || 'food');
  const qtyMin = Math.max(1, Number(pickedCat?.qty?.min ?? 1));
  const qtyMax = Math.max(qtyMin, Number(pickedCat?.qty?.max ?? qtyMin));
  const tierCap = Math.max(1, Number(pickedCat?.tierCap ?? 1));

  let candidates = buildFoodCrateCandidates(catKey, tierCap);
  // 후보가 없으면 음식 → 의료 → 재료 순으로 약한 폴백
  if (!candidates.length && catKey !== 'food') candidates = buildFoodCrateCandidates('food', tierCap);
  if (!candidates.length && catKey !== 'medical') candidates = buildFoodCrateCandidates('medical', tierCap);
  if (!candidates.length && catKey !== 'material') candidates = buildFoodCrateCandidates('material', tierCap);

  const picked = pickWeighted(candidates);
  if (!picked?.itemId) return null;
  crate.opened = true;
  crate.openedBy = String(actor?.name || 'unknown');
  crate.openedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const reward = rule?.reward || {};
  const cr = reward?.credits || {};
  const minCr = Number(cr?.min ?? 0);
  const maxCr = Number(cr?.max ?? 0);
  const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

  const qty = Math.max(1, randInt(qtyMin, qtyMax));
  return { item: picked.item, itemId: String(picked.itemId), qty, credits, crateType: 'food', zoneId: zid };
}



function pickupSpawnedCore(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.coreNodes)) return null;

  const zid = String(zoneId || '');
  const node = s.coreNodes.find((n) => !n?.picked && String(n?.zoneId) === zid) || null;
  if (!node) return null;

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};

  // 스폰된 코어는 "존재하면 거의 무조건" 주워가는 느낌(ER 메인 오브젝트)
  // - 필요하면 룰셋에서 alwaysPick=false로 되돌릴 수 있음
  const alwaysPick = coreRule?.alwaysPick !== false;
  if (!alwaysPick) {
    const moved = !!opts.moved;
    const timeOfDay = getTimeOfDayFromPhase(curPhase);
    const pc = coreRule?.pickChance || {};
    const byTod = (timeOfDay === 'day' ? pc.day : pc.night) || {};
    const chance = moved
      ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.85 : 0.55))
      : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.65 : 0.35));
    if (Math.random() >= chance) return null;
  }

  const kind = String(node?.kind || '');
  let item = null;
  if (kind === 'meteor') item = findItemByKeywords(publicItems, ['운석', 'meteor']);
  if (kind === 'life_tree') item = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);

  if (!item?._id) {
    // ✅ 서버 아이템 트리에 특수 재료가 없거나 이름이 달라도 시뮬이 멈추지 않도록 "가상 아이템" 생성
    if (kind === 'meteor') item = { _id: 'SIM_MATERIAL_METEOR', name: '운석', type: '재료', tier: 4, tags: ['legendary_core', 'meteor'] };
    if (kind === 'life_tree') item = { _id: 'SIM_MATERIAL_LIFETREE', name: '생명의 나무', type: '재료', tier: 4, tags: ['legendary_core', 'life_tree'] };
  }
  if (!item?._id) return null;

  node.picked = true;
  node.pickedBy = String(actor?.name || 'unknown');
  node.pickedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  return { item, itemId: String(item._id), qty: 1, kind };
}


function consumeBossAtZone(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset) {
  const s = spawnState;
  if (!s || !s.bosses) return null;

  const zid = String(zoneId || '');
  const ws = ruleset?.worldSpawns || {};
  const bossRule = ws?.bosses || {};
  const fallback = ws?.bossFallback || {};

  const retreatBase = Number(fallback?.retreatBase ?? 0.20);
  const retreatPowerBonusMax = Number(fallback?.retreatPowerBonusMax ?? 0.25);
  const perkFx = getActorPerkEffects(actor);
  const perkWildLootBias = Math.max(0, getPerkWildlifeLootBias(perkFx));

  const kinds = ['alpha', 'omega', 'weakline'];
  for (const k of kinds) {
    const b = s?.bosses?.[k];
    if (!b || !b.alive) continue;
    if (String(b.zoneId) !== zid) continue;

    const p = roughPower(actor);
    const powerBonus = Math.min(retreatPowerBonusMax, Math.max(0, (p - 40) / 240));

    const cfg = bossRule?.[k] || {};
    const kw = Array.isArray(cfg?.dropKeywords) ? cfg.dropKeywords : (k === 'omega'
      ? ['포스 코어', 'force core', 'forcecore']
      : k === 'weakline'
        ? ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf']
        : ['미스릴', 'mithril']);

    const dmgCfg = cfg?.dmg || {};
    const dmgMin = Math.max(0, Number(dmgCfg?.min ?? (k === 'omega' ? 8 : 6)));
    const dmgBase = Number(dmgCfg?.base ?? (k === 'omega' ? 26 : k === 'weakline' ? 18 : 22));
    const dmgDiv = Math.max(1, Number(dmgCfg?.scaleDiv ?? (k === 'weakline' ? 10 : 9)));

    const drop = findItemByKeywords(publicItems, kw);
    const dmg = Math.max(dmgMin, dmgBase - Math.floor(p / dmgDiv));

    if (drop?._id) {
      b.alive = false;
      b.defeatedBy = String(actor?.name || '');
      b.defeatedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

      const label = k === 'alpha' ? '알파' : k === 'omega' ? '오메가' : '위클라인';
      const log = k === 'alpha'
        ? `🐺 야생동물(${label}) 사냥 성공! 미스릴 획득`
        : k === 'omega'
          ? `🧿 변이체(${label}) 격파! 포스 코어 획득`
          : `🧬 변이체(${label}) 처치! VF 혈액 샘플 + (운석/생명의 나무) 획득`;

      const rw = cfg?.reward || {};
      const cr = rw?.credits || {};
      const minCr = Number(cr?.min ?? 0);
      const maxCr = Number(cr?.max ?? 0);
      const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

      const bonusChance = Math.max(0, Math.min(1, Number(rw?.bonusDropChance ?? 0)));
      const drops = [{ item: drop, itemId: String(drop._id), qty: 1 }];
      if (bonusChance > 0 && Math.random() < bonusChance) {
        // 단순화: "추가드랍"은 동일 재료 1개 추가(룰셋으로 확률 고정)
        drops.push({ item: drop, itemId: String(drop._id), qty: 1 });
      }

      // ✅ 요청: 위클라인은 VF 혈액 샘플 1개 + (운석 또는 생명의 나무) 1개 드랍
      if (k === 'weakline') {
        const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
        const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
        const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
        if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.22, 1) });
      }

      return {
        kind: k,
        damage: dmg,
        credits,
        drops,
        log,
      };
    }

    // 아이템이 없으면(데이터 미구축) 보스는 그냥 "도망" 처리(상태 유지)
    if (Math.random() < retreatBase + powerBonus) {
      return { kind: k, damage: 0, drops: [], log: `⚠️ 강력한 적과 조우했지만(아이템 미구축) 물러났다` };
    }
  }


  return null;
}

// --- 변이 야생동물(요청): 밤 스폰(로컬 설정 zone) 조우/소모 ---
function consumeMutantWildlifeAtZone(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset) {
  const s = spawnState;
  const m = s?.mutantWildlife;
  if (!m || !m.alive) return null;

  const zid = String(zoneId || '');
  if (String(m.zoneId) !== zid) return null;

  const p = roughPower(actor);
  const dmg = Math.max(4, 14 - Math.floor(p / 12));
  const credit = Math.max(0, Number(ruleset?.credits?.mutantWildlifeKill ?? 8));

  m.alive = false;
  m.defeatedBy = String(actor?.name || '');
  m.defeatedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const animal = String(m.animal || '').trim() || '미상';

  // ✅ 드랍(요청)
  // - 변이닭: 1/2 확률로 치킨 1개
  // - 변이멧돼지: 고기 4개
  // - 변이곰/늑대/들개: 고기 2개
  // - 박쥐는 고기 드랍 없음
  const drops = [];
  const meat = findItemByKeywords(publicItems, ['고기']);
  const chicken = findItemByKeywords(publicItems, ['치킨']);
  const nm = animal;
  const low = nm.toLowerCase();

  const isBat = nm.includes('박쥐') || low.includes('bat');
  const isChicken = nm.includes('닭') || low.includes('chicken');
  const isBoar = nm.includes('멧돼지') || low.includes('boar');
  const isBear = nm.includes('곰') || low.includes('bear');
  const isWolf = nm.includes('늑대') || low.includes('wolf');
  const isDog = nm.includes('들개') || low.includes('dog');

  if (!isBat) {
    if (isChicken) {
      if (chicken?._id && Math.random() < 0.5) {
        drops.push({ item: chicken, itemId: String(chicken._id), qty: 1 });
      }
    } else if (isBoar) {
      if (meat?._id) drops.push({ item: meat, itemId: String(meat._id), qty: 4 });
    } else if (isBear || isWolf || isDog) {
      if (meat?._id) drops.push({ item: meat, itemId: String(meat._id), qty: 2 });
    }
  }

  // ✅ 모든 변이동물: 10% 확률로 운석 또는 생명의 나무 드랍
  if (Math.random() < 0.10) {
    const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
    const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
    const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
    if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
  }

  return {
    kind: 'mutant_wildlife',
    damage: dmg,
    credits: credit,
    drops,
    log: `🧪 변이 야생동물(${animal}) 처치! (+${credit} Cr)`,
  };
}


// --- 아이템 특수 분류(구매/스폰 규칙용) ---
function classifySpecialByName(name) {
  const nm = String(name || '').toLowerCase();
  if (!nm) return '';
  // VF 혈액 샘플
  if ((nm.includes('vf') && (nm.includes('혈액') || nm.includes('샘플') || nm.includes('sample'))) || nm.includes('blood sample')) return 'vf';
  // 4대 전설 재료
  if (nm.includes('운석') || nm.includes('meteor')) return 'meteor';
  if ((nm.includes('생명') && nm.includes('나무')) || nm.includes('tree of life') || nm.includes('life tree')) return 'life_tree';
  if (nm.includes('미스릴') || nm.includes('mithril')) return 'mithril';
  if ((nm.includes('포스') && nm.includes('코어')) || nm.includes('force core') || nm.includes('forcecore')) return 'force_core';
  return '';
}

function isSpecialCoreKind(kind) {
  return kind === 'meteor' || kind === 'life_tree' || kind === 'mithril' || kind === 'force_core';
}

function computeCraftTierFromIngredients(ingredients, itemMetaById, itemNameById) {
  // 제작 규칙(요청):
  // - 하급 재료 2개 -> 일반(1)
  // - 일반 장비 1 + 하급 1 -> 희귀(3)
  // - 희귀 장비 1 + 하급 1 -> 영웅(4)
  // - 하급 1 + 운석/생나/포스코어/미스릴 -> 전설(5)
  // - 하급 1 + VF 혈액 샘플 -> 초월(6)
  const ings = Array.isArray(ingredients) ? ingredients : [];

  let hasVf = false;
  let hasLegendaryMat = false;
  let hasEquip = false;
  let maxEquipTier = 0;
  let lowMatCount = 0;

  for (const x of ings) {
    const id = String(x?.itemId || '');
    if (!id) continue;
    const qty = Math.max(1, Number(x?.qty || 1));

    const meta = (itemMetaById && itemMetaById[id]) ? itemMetaById[id] : null;
    const name = String(meta?.name || itemNameById?.[id] || '');
    const kind = classifySpecialByName(name);

    if (kind === 'vf') hasVf = true;
    if (isSpecialCoreKind(kind)) hasLegendaryMat = true;

    const pseudoItem = { name, type: meta?.type, tags: meta?.tags, tier: meta?.tier };
    const cat = inferItemCategory(pseudoItem);
    if (cat === 'equipment') {
      hasEquip = true;
      maxEquipTier = Math.max(maxEquipTier, clampTier4(meta?.tier || pseudoItem?.tier || 1));
    } else if (cat === 'material') {
      // 특수 재료는 별도 처리(전설/초월)
      if (!kind) lowMatCount += qty;
    }
  }

  if (hasVf) return 6;
  if (hasLegendaryMat) return 5;

  if (hasEquip && lowMatCount >= 1) {
    // 일반(1) 장비 + 하급 -> 희귀(3), 희귀(3) 장비 + 하급 -> 영웅(4)
    return maxEquipTier >= 3 ? 4 : 3;
  }
  if (!hasEquip && lowMatCount >= 2) {
    return 1;
  }
  // fallback: 목표 아이템의 원래 tier를 크게 벗어나지 않도록 보정
  return clampTier4(Math.max(1, maxEquipTier || 1));
}

function applyEquipTier(item, tier) {
  if (!item) return item;
  const t = clampTier4(tier);
  return { ...item, tier: t, rarity: tierLabelKo(t) };
}

function isItemInMapCrates(mapObj, itemId) {
  const id = String(itemId || '');
  if (!id) return false;
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  for (const c of crates) {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) return true;
  }
  return false;
}

// --- 간단 조합 목표(=AI 조달 우선순위) ---
// "이미 일부 재료를 들고 있고, 부족한 재료가 적은" 상위 티어 레시피를 우선으로 선택합니다.
function normalizeGoalTier(tier) {
  const t = Number(tier);
  if (t === 4 || t === 5 || t === 6) return t;
  return 6;
}

function pickGoalLoadoutBySlot(actor) {
  const t = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const g = actor?.goalLoadouts && typeof actor.goalLoadouts === 'object' ? actor.goalLoadouts : {};
  const b = (t === 4 ? g.hero : t === 5 ? g.legend : g.transcend) || null;
  if (!b || typeof b !== 'object') return { weapon: '', head: '', clothes: '', arm: '', shoes: '' };
  return {
    weapon: String(b.weaponKey || '').trim(),
    head: String(b.headKey || '').trim(),
    clothes: String(b.clothesKey || '').trim(),
    arm: String(b.armKey || '').trim(),
    shoes: String(b.shoesKey || '').trim(),
  };
}

function pickGoalLoadoutKeys(actor) {
  const b = pickGoalLoadoutBySlot(actor);
  return [b.weapon, b.head, b.clothes, b.arm, b.shoes].filter(Boolean);
}

function getOneSpecialShortMissing(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const tier = Number(craftGoal?.tier || craftGoal?.target?.tier || 0);
  if (miss.length !== 1 || tier < 5) return null;
  const m = miss[0] || null;
  const key = String(m?.special || classifySpecialByName(m?.name) || '');
  if (!key || (!isSpecialCoreKind(key) && key !== 'vf')) return null;
  return { ...m, special: key, targetTier: tier, targetName: String(craftGoal?.target?.name || '') };
}

function buildCraftGoal(inventory, craftables, itemNameById, opts) {
  const list = Array.isArray(craftables) ? craftables : [];
  if (!list.length) return null;

  const goalTier = normalizeGoalTier(opts?.goalTier ?? 6);
  const goalKeysRaw = opts?.goalItemKeys instanceof Set ? [...opts.goalItemKeys] : (Array.isArray(opts?.goalItemKeys) ? opts.goalItemKeys : []);
  const goalKeys = new Set(goalKeysRaw.map((x) => String(x || '').trim()).filter(Boolean));
  const perkFx = normalizePerkEffects(opts?.perkEffects);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  let best = null;

  for (const it of list) {
    const tier = Number(it?.tier || 1);
    if (tier > goalTier) continue;

    const ings = compactIO(it?.recipe?.ingredients || []);
    if (!ings.length) continue;

    let haveSlots = 0;
    const missing = [];

    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      const need = Math.max(1, Number(ing?.qty || 1));
      if (!id) continue;

      const haveQty = invQty(inventory, id);
      if (haveQty >= need) haveSlots += 1;
      else {
        const nm = itemNameById?.[id] || '';
        missing.push({
          itemId: id,
          need,
          have: haveQty,
          name: nm,
          special: classifySpecialByName(nm),
        });
      }
    }

    const k = String(it?.itemKey || it?.externalId || '').trim();
    const isGoal = goalKeys.size > 0 && k && goalKeys.has(k);

    // "재료 0개 보유" 레시피는 기본적으로 제외(너무 랜덤)하되, 목표 장비는 예외
    if (haveSlots <= 0 && !isGoal) continue;

    // 너무 멀면(부족 재료가 너무 많으면) 목표로 삼지 않음
    if (missing.length > 3) continue;

    const ratio = haveSlots / Math.max(1, ings.length);
    let score = tier * 100 + ratio * (25 + craftBias * 6) - missing.length * 8;

    const oneSpecialShort = (missing.length === 1) && (tier >= 5) && (() => {
      const mk = String(missing?.[0]?.special || classifySpecialByName(missing?.[0]?.name) || '');
      return mk && (isSpecialCoreKind(mk) || mk === 'vf');
    })();

    // 공식 Saved Plan/Legendary 추천 흐름처럼, 상위 장비가 '특수 재료 1개만 부족'하면 강하게 밀어준다.
    if (oneSpecialShort) score += (tier >= 6 ? 900 : 700);

    // 목표 장비(itemKey)가 설정된 경우: 해당 결과물을 강하게 우선
    if (goalKeys.size > 0) {
      score += isGoal ? (3000 + goalWeightBonus * 600) : -20;
      if (isGoal && oneSpecialShort) score += 500;
    }

    if (!best || score > best.score) {
      best = {
        score,
        target: it,
        tier,
        missing,
        haveSlots,
        totalSlots: ings.length,
      };
    }
  }

  return best;
}

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    const s = String(x || '');
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds) {
  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = [];
  for (const z of zonesArr) {
    const zid = String(z?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    if (hasKioskAtZone(kiosks, mapObj, zid)) out.push(zid);
  }
  return uniqStrings(out);
}

function findCrateZoneIdsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const hits = [];
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) hits.push(zid);
  }
  return uniqStrings(hits);
}

function findCrateZoneWeightsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return new Map();
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = new Map();
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    for (const e of lt) {
      if (String(e?.itemId || '') !== id) continue;
      const w = Math.max(0, Number(e?.weight ?? 1));
      out.set(zid, (out.get(zid) || 0) + w);
    }
  }
  return out;
}

function buildRuntimeSpawnMeta({ itemId, meta, itemName, mapObj, spawnState, forbiddenIds }) {
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();
  function add(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };
  const nm = String(itemName || meta?.name || '');
  const tags = safeTags(meta).map((t) => String(t).toLowerCase());
  const spec = String(classifySpecialByName(nm) || '');
  const hintZones = Array.isArray(meta?.spawnZones) ? meta.spawnZones : [];
  const crateHints = new Set((Array.isArray(meta?.spawnCrateTypes) ? meta.spawnCrateTypes : []).map((x) => String(x || '').toLowerCase()).filter(Boolean));
  for (const raw of hintZones) {
    const t = String(raw || '').trim();
    if (!t || !Array.isArray(mapObj?.zones)) continue;
    if (/^Z\d+$/i.test(t)) { add(t.toUpperCase(), 2.4); continue; }
    mapObj.zones.filter((z) => z && z.zoneId && String(z.name || '').includes(t)).forEach((z) => add(String(z.zoneId), 1.8));
  }
  if (crateHints.size && Array.isArray(mapObj?.itemCrates)) {
    for (const c of mapObj.itemCrates) {
      const zid = String(c?.zoneId || '');
      const ct = String(c?.crateType || 'food').toLowerCase();
      if (zid && crateHints.has(ct) && !forb.has(zid)) add(zid, 1.6);
    }
  }
  for (const [z, w] of findCrateZoneWeightsForItem(mapObj, itemId, forb).entries()) add(z, 1.4 + Math.min(4, w / 4));
  if ((nm.includes('물') || tags.includes('water')) && Array.isArray(mapObj?.waterSourceZoneIds)) mapObj.waterSourceZoneIds.forEach((z) => add(z, 2.2));
  if ((nm.includes('스테이크') || tags.includes('cooked')) && Array.isArray(mapObj?.campfireZoneIds)) mapObj.campfireZoneIds.forEach((z) => add(z, 1.4));
  if ((spec === 'meteor' || spec === 'life_tree') && Array.isArray(mapObj?.coreSpawnZones)) mapObj.coreSpawnZones.forEach((z) => add(z, 2.0));
  if (spec === 'mithril' && spawnState?.bosses?.alpha?.alive && spawnState.bosses.alpha.zoneId) add(spawnState.bosses.alpha.zoneId, 2.6);
  if (spec === 'force_core' && spawnState?.bosses?.omega?.alive && spawnState.bosses.omega.zoneId) add(spawnState.bosses.omega.zoneId, 2.6);
  if (spec === 'vf' && spawnState?.bosses?.weakline?.alive && spawnState.bosses.weakline.zoneId) add(spawnState.bosses.weakline.zoneId, 3.0);
  if ((nm.includes('고기') || tags.includes('meat') || tags.includes('food')) && spawnState?.wildlife) {
    Object.entries(spawnState.wildlife)
      .map(([z, c]) => ({ z: String(z), c: Math.max(0, Number(c || 0)) }))
      .filter((x) => x.z && !forb.has(x.z))
      .sort((a, b) => (b.c - a.c) || a.z.localeCompare(b.z))
      .slice(0, 4)
      .forEach((e) => add(e.z, 1));
  }
  return {
    itemId: String(itemId || ''),
    crateTypes: [...crateHints],
    zoneWeights: [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])),
  };
}

function expandMissingResourceChain(missingList, itemMetaById, itemNameById, maxDepth = 2) {
  const seeds = Array.isArray(missingList) ? missingList : [];
  const seen = new Map();
  const out = [];
  const q = seeds
    .map((m) => ({
      itemId: String(m?.itemId || ''),
      name: String(m?.name || ''),
      depth: 0,
      chainWeight: 1,
      special: String(m?.special || ''),
    }))
    .filter((x) => x.itemId);
  while (q.length) {
    const cur = q.shift();
    const prev = Number(seen.get(cur.itemId) ?? -1);
    if (prev >= cur.chainWeight) continue;
    seen.set(cur.itemId, cur.chainWeight);
    out.push(cur);
    if (cur.depth >= maxDepth) continue;
    const meta = itemMetaById?.[cur.itemId] || null;
    const ings = compactIO(meta?.recipe?.ingredients || []);
    if (!ings.length) continue;
    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      if (!id) continue;
      q.push({
        itemId: id,
        name: String(itemNameById?.[id] || itemMetaById?.[id]?.name || ''),
        depth: cur.depth + 1,
        chainWeight: cur.chainWeight * (cur.depth <= 0 ? 0.72 : 0.5),
        special: String(classifySpecialByName(itemNameById?.[id] || itemMetaById?.[id]?.name || '') || ''),
      });
    }
  }
  return out.sort((a, b) => (a.depth - b.depth) || (b.chainWeight - a.chainWeight) || a.itemId.localeCompare(b.itemId));
}

// ✅ 목표 제작(=missing 재료) 기준으로 '재료가 나올 확률이 높은 존'을 점수화
// - 1) 직접 부족 재료를 우선
// - 2) 부족 재료가 조합식이면 재료의 재료까지 역추적해서 존 점수에 반영
function pickGoalResourceZoneTargets(mapObj, spawnState, forbiddenIds, missingList, itemMetaById, itemNameById) {
  const miss = expandMissingResourceChain(missingList, itemMetaById, itemNameById, 2);
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();

  function addScore(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };

  for (const m of miss) {
    const id = String(m?.itemId || '');
    if (!id) continue;
    const meta = itemMetaById?.[id] || null;
    const runtimeSpawnMeta = buildRuntimeSpawnMeta({
      itemId: id,
      meta,
      itemName: itemNameById?.[id] || meta?.name || m?.name || '',
      mapObj,
      spawnState,
      forbiddenIds: forb,
    });
    const mul = Math.max(0.2, Number(m?.chainWeight || 1));
    for (const [z, w] of runtimeSpawnMeta.zoneWeights) addScore(z, w * mul);
  }

  const ranked = [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return ranked.slice(0, 6).map(([z]) => z);
}

function bfsNextStepToAnyTarget(startZoneId, targetSet, zoneGraph, forbiddenIds) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const targets =
    targetSet instanceof Set
      ? new Set([...targetSet].map((z) => String(z)))
      : new Set(Array.isArray(targetSet) ? targetSet.map((z) => String(z)) : []);

  if (!start || targets.size === 0) return { nextStep: null, target: null };
  if (targets.has(start)) return { nextStep: start, target: start };

  if (!zoneGraph || typeof zoneGraph !== 'object') return { nextStep: null, target: null };

  const q = [start];
  const parent = new Map();
  parent.set(start, null);

  while (q.length) {
    const cur = q.shift();
    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);

      if (targets.has(n)) {
        // reconstruct to find next step after start
        let x = n;
        let prev = parent.get(x);
        while (prev && prev !== start) {
          x = prev;
          prev = parent.get(x);
        }
        return { nextStep: x, target: n };
      }

      q.push(n);
    }
  }

  return { nextStep: null, target: null };
}

function bfsPickSafestZone(startZoneId, zoneGraph, forbiddenIds, zonePop, opts) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const pop = (zonePop && typeof zonePop === 'object') ? zonePop : {};
  const maxDepth = Math.max(1, Math.floor(Number(opts?.maxDepth ?? 3)));
  const minDelta = Math.max(0, Math.floor(Number(opts?.minDelta ?? 1)));

  if (!start || !zoneGraph || typeof zoneGraph !== 'object') return { target: null, nextStep: null, dist: null };
  if (forb.has(start)) return { target: null, nextStep: null, dist: null };

  const startPop = Number(pop[start] ?? 0);

  // BFS로 "가장 가까운 안전/저인구 존" 탐색:
  // 1) startPop - minDelta 이하를 만족하는 첫 레벨을 우선
  // 2) 없으면 maxDepth 내에서 pop 최소를 fallback
  const q = [start];
  const parent = new Map([[start, null]]);
  const depth = new Map([[start, 0]]);

  let bestAny = start;
  let bestAnyPop = startPop;
  let bestAnyDist = 0;

  let bestCand = null;
  let bestCandPop = Infinity;
  let bestCandDist = Infinity;

  while (q.length) {
    const cur = q.shift();
    const d = Number(depth.get(cur) ?? 0);
    const pCur = Number(pop[cur] ?? 0);

    if (pCur < bestAnyPop || (pCur === bestAnyPop && d < bestAnyDist)) {
      bestAny = cur;
      bestAnyPop = pCur;
      bestAnyDist = d;
    }

    if (d > 0 && pCur <= (startPop - minDelta)) {
      if (d < bestCandDist || (d === bestCandDist && pCur < bestCandPop)) {
        bestCand = cur;
        bestCandDist = d;
        bestCandPop = pCur;
      }
    }

    if (d >= maxDepth) continue;

    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);
      depth.set(n, d + 1);
      q.push(n);
    }
  }

  const target = bestCand || bestAny || null;
  if (!target) return { target: null, nextStep: null, dist: null };

  // start → target 경로에서 다음 1스텝을 복원
  let x = target;
  let prev = parent.get(x);
  while (prev && prev !== start) {
    x = prev;
    prev = parent.get(x);
  }

  return { target, nextStep: x, dist: Number(depth.get(target) ?? 0) };
}

// --- 전설/초월 세팅 목표(관전형 AI) ---
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 목표로 움직이게 함
// - craftGoal(레시피 목표)이 없더라도, 장비 티어가 낮으면 후반 세팅을 추구
function invHasSpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return false;
  return list.some((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
}

function findInvItemIdBySpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return '';
  const hit = list.find((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
  return hit ? String(hit?.itemId || hit?.id || '') : '';
}

function computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, day, phase, ruleset) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const tiers = {};
  let minTier = 99;
  for (const slot of EQUIP_SLOTS) {
    const best = pickBestEquipBySlot(inv, slot);
    const t = best ? clampTier4(Number(best?.tier || 1)) : 0;
    tiers[slot] = t;
    minTier = Math.min(minTier, t || 0);
  }
  if (!Number.isFinite(minTier) || minTier === 99) minTier = 0;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const lowCount = countLowMaterials(inv, itemMetaById, itemNameById);

  const hasVf = invHasSpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const hasMeteor = invHasSpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const hasLife = invHasSpecialKind(inv, 'life_tree', itemMetaById, itemNameById);
  const hasMithril = invHasSpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const hasForce = invHasSpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const hasLegendMatAny = hasMeteor || hasLife || hasMithril || hasForce;

  // ✅ 캐릭터 목표(영웅/전설/초월)에 따라 후반 세팅(키오스크/특수재료) 욕구를 달리함
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const allowLegend = goalTier >= 5;
  const allowTrans = goalTier >= 6;

  // 키오스크가 2일차 낮부터 의미 있게 동작하므로, 목표도 그 시점부터 활성화
  const nearLegend = allowLegend && minTier >= 4 && minTier < 5;
  const nearTrans = allowTrans && minTier >= 5 && minTier < 6;
  const wantLegend = allowLegend && ((nearLegend && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const wantTrans = allowTrans && ((nearTrans && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 3, 'day')) && minTier < 6;
  const legendOverdue = allowLegend && ((nearLegend && isAtOrAfterWorldTime(day, phase, 1, 'night')) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const transOverdue = allowTrans && ((nearTrans && isAtOrAfterWorldTime(day, phase, 3, 'day')) || isAtOrAfterWorldTime(day, phase, 3, 'night')) && minTier < 6;

  const legendCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.meteor ?? 200));
  const forceCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.force_core ?? 350));
  const transCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.vf ?? 500));

  // 크레딧 파밍 필요(키오스크 구매/후반 세팅 가속)
  const needCreditsForLegend = wantLegend && simCredits < legendCost;
  const needCreditsForTrans = wantTrans && simCredits < transCost;
  const farmCredits = needCreditsForLegend || needCreditsForTrans;

  return {
    goalTier,
    tiers,
    minTier,
    simCredits,
    lowCount,
    wantLegend,
    wantTrans,
    nearLegend,
    nearTrans,
    legendOverdue,
    transOverdue,
    hasVf,
    hasLegendMatAny,
    farmCredits,
    legendCost,
    forceCost,
    transCost,
  };
}

// --- 목표 기반 이동(조합 목표 + 월드 스폰 + 키오스크) ---
function chooseAiMoveTargets({ actor, craftGoal, upgradeNeed, mapObj, spawnState, forbiddenIds, day, phase, kiosks, itemMetaById = null, itemNameById = null }) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hasGoal = !!craftGoal?.target && miss.length > 0;

  const s = spawnState && typeof spawnState === 'object' ? spawnState : null;
  const bosses = s?.bosses || {};
  const coreNodes = Array.isArray(s?.coreNodes) ? s.coreNodes : [];
  const crates = Array.isArray(s?.legendaryCrates) ? s.legendaryCrates : [];

  const result = { targets: [], reason: '' };

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const kioskZones = listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds);

  const up = (upgradeNeed && typeof upgradeNeed === 'object') ? upgradeNeed : null;
  const wantLegendAny = !!up?.wantLegend;
  const wantTransAny = !!up?.wantTrans;
  const hasLegendMatAny = !!up?.hasLegendMatAny;
  const hasVfAny = !!up?.hasVf;
  const farmCredits = !!up?.farmCredits;

  const legendCost = Math.max(0, Number(up?.legendCost ?? 200));
  const forceCost = Math.max(0, Number(up?.forceCost ?? 350));
  const transCost = Math.max(0, Number(up?.transCost ?? 500));

  const needKeys = new Set(
    miss
      .map((m) => String(m?.special || classifySpecialByName(m?.name) || ''))
      .filter(Boolean)
  );

  const needVf = needKeys.has('vf') || (wantTransAny && !hasVfAny);
  const needMeteor = needKeys.has('meteor');
  const needLife = needKeys.has('life_tree');
  const needMithril = needKeys.has('mithril');
  const needForce = needKeys.has('force_core');

  // 0) 메인 오브젝트(자연코어) 우선: 운석/생나 스폰이 떠 있으면 크레딧 파밍보다 먼저 달려감
  const activeCoreZones = uniqStrings(
    coreNodes
      .filter((n) => n && !n.picked && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)))
  );
  if (isAtOrAfterWorldTime(day, phase, 1, 'night') && activeCoreZones.length) {
    const key = String(actor?._id || actor?.id || actor?.name || '');
    const roll = (hash32(key) % 100) / 100;
    const forceContest = (wantLegendAny && !hasLegendMatAny) || needMeteor || needLife || needMithril || needForce || needVf;
    const contest = forceContest || roll < 0.78;
    if (contest) {
      result.targets = activeCoreZones;
      result.reason = '메인오브젝트(자연코어)';
      return result;
    }
  }

  // 0) 크레딧 파밍(야생동물 밀집 존): 키오스크 구매/후반 제작이 막힐 때 우선
  if (farmCredits && s?.wildlife && typeof s.wildlife === 'object') {
    const entries = Object.entries(s.wildlife)
      .map(([z, c]) => ({ z: String(z), c: Math.max(0, Number(c || 0)) }))
      .filter((x) => x.z && !forbiddenIds.has(String(x.z)))
      .sort((a, b) => (b.c - a.c) || a.z.localeCompare(b.z));
    const top = entries.slice(0, 6).map((x) => x.z).filter(Boolean);
    if (top.length) {
      result.targets = top;
      result.reason = '크레딧 파밍';
      return result;
    }
  }

  // 1) VF: 위클라인(5일차) 우선, 그 다음 키오스크 구매(4일차)
  if (needVf) {
    if (isAtOrAfterWorldTime(day, phase, 5, 'day') && bosses?.weakline?.alive && bosses.weakline.zoneId && !forbiddenIds.has(String(bosses.weakline.zoneId))) {
      result.targets = [String(bosses.weakline.zoneId)];
      result.reason = 'VF(위클라인)';
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && simCredits >= transCost && kioskZones.length) {
      result.targets = kioskZones;
      result.reason = 'VF(키오스크)';
      return result;
    }
  }

  // 1.5) 전설 재료(아무거나): 목표가 없어도 후반 세팅을 위해 '특수재료'를 우선 확보
  if (wantLegendAny && !hasLegendMatAny) {
    const crateTargetsAny = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargetsAny.length) {
      result.targets = crateTargetsAny;
      result.reason = '특수재료(전설상자)';
      return result;
    }

    const coreTargetsAny = uniqStrings(
      coreNodes
        .filter((n) => n && !n.picked && n.zoneId)
        .map((n) => String(n.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 1, 'night') && coreTargetsAny.length) {
      result.targets = coreTargetsAny;
      result.reason = '특수재료(자연코어)';
      return result;
    }

    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '특수재료(알파)';
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId && !forbiddenIds.has(String(bosses.omega.zoneId))) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '특수재료(오메가)';
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '특수재료(키오스크)';
      return result;
    }
  }

  // 2) 자연 코어(운석/생나): 2일차부터 스폰 → 해당 구역 진입
  if (needMeteor || needLife) {
    const kinds = [];
    if (needMeteor) kinds.push('meteor');
    if (needLife) kinds.push('life_tree');

    const targets = coreNodes
      .filter((n) => n && !n.picked && kinds.includes(String(n.kind)) && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)));
    const uniq = uniqStrings(targets);

    if (uniq.length) {
      result.targets = uniq;
      result.reason = needMeteor && needLife ? '자연코어(운석/생나)' : needMeteor ? '자연코어(운석)' : '자연코어(생나)';
      return result;
    }

    // 키오스크 구매/교환이 가능한 시점이면 키오스크도 후보로
    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '자연코어(키오스크)';
      return result;
    }
  }

  // 3) 미스릴: 알파(3일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needMithril) {
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '미스릴(알파)';
      return result;
    }

    const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '미스릴(전설상자)';
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '미스릴(키오스크)';
      return result;
    }
  }

  // 4) 포스 코어: 오메가(4일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needForce) {
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId && !forbiddenIds.has(String(bosses.omega.zoneId))) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '포스코어(오메가)';
      return result;
    }

    const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '포스코어(전설상자)';
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= forceCost) {
      result.targets = kioskZones;
      result.reason = '포스코어(키오스크)';
      return result;
    }
  }

  // 5) 목표가 있으면, 부족한 일반 재료가 들어있는 상자 구역으로 이동
  if (hasGoal) {
    const zonesForGoal = pickGoalResourceZoneTargets(mapObj, s, forbiddenIds, miss, itemMetaById, itemNameById);
    if (zonesForGoal.length) {
      result.targets = zonesForGoal;
      result.reason = '재료 파밍(목표)';
      return result;
    }
  }

  // 6) 기회주의: 전설 재료 상자/자연 코어가 있으면 약간의 확률로 향함(루프 가속)
  const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
  if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length && Math.random() < 0.18) {
    result.targets = crateTargets;
    result.reason = '전설상자 탐색';
    return result;
  }

  const coreTargets = uniqStrings(
    coreNodes
      .filter((n) => n && !n.picked && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)))
  );
  if (isAtOrAfterWorldTime(day, phase, 1, 'night') && coreTargets.length && Math.random() < 0.22) {
    result.targets = coreTargets;
    result.reason = '자연코어 탐색';
    return result;
  }

  return result;
}


function pickMissingBasicItemId(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hit = miss.find((m) => m?.itemId && !m?.special);
  return hit?.itemId ? String(hit.itemId) : '';
}

function rollKioskInteraction(mapObj, zoneId, kiosks, publicItems, curDay, curPhase, actor, craftGoal, itemNameById, marketRules, ruleset = null, upgradeNeed = null, absSecNow = 0) {
  const mr = marketRules?.kiosk || {};
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.kioskChancePlus || 0)) + Math.max(0, perkNumber(perkFx.goalWeightPlus || 0)) * 0.01;
  const applyKioskCost = (value) => applyPerkDiscount(value, perkFx.kioskDiscountPct, perkFx.marketDiscountPct);
  // 실제 ER 일반 Kiosk는 시작부터 접근 가능하고, 시뮬은 위치/크레딧 조건으로만 제어합니다.
  if (!canUseKioskAtWorldTime(curDay, curPhase)) return null;

  // 위치 게이트: 키오스크는 특정 시설(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교) 구역에만 존재
  if (!hasKioskAtZone(kiosks, mapObj, zoneId)) return null;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  // 실제 ER 일반 Kiosk는 별도 사용 쿨다운보다 크레딧/행동 점유로 제어된다.
  // 시뮬도 1 tick 1 행동 규칙만 적용하고, 별도 cooldown gate는 두지 않는다.
  const items = Array.isArray(publicItems) ? publicItems : [];
  const findById = (id) => items.find((x) => String(x?._id) === String(id)) || null;

  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const up = (upgradeNeed && typeof upgradeNeed === 'object') ? upgradeNeed : null;
  const oneSpecialShort = getOneSpecialShortMissing(craftGoal);
  const hasNeed = miss.length > 0;
  const hasUpgradeNeed = !!up?.wantLegend || !!up?.wantTrans || !!up?.farmCredits;
  const legendOverdue = !!up?.legendOverdue;
  const transOverdue = !!up?.transOverdue;
  const nearLegend = !!up?.nearLegend;
  const nearTrans = !!up?.nearTrans;
  const hasMeaningfulNeed = hasNeed || hasUpgradeNeed;
  const cats = mr?.categories || {};
  const allowVf = cats?.vf !== false;
  const allowLegendary = cats?.legendary !== false;
  const allowBasic = cats?.basic !== false;


  // 목표(조합) 기반이면 더 적극적으로 이용(룰셋)
  const chanceNeed = Number(mr?.chanceNeed ?? 0.42);
  const chanceIdle = Number(mr?.chanceIdle ?? 0.16);
  const needCount = Math.max(0, miss.length);
  const earlyProcureBonus = (curDay <= 2) ? 0.08 : 0;
  const savedPlanLegendBonus = oneSpecialShort ? (oneSpecialShort?.special === 'vf' ? 0.18 : 0.15) : 0;
  const pacingPressure = (legendOverdue ? 0.14 : (nearLegend ? 0.05 : 0)) + (transOverdue ? 0.18 : (nearTrans ? 0.06 : 0));
  const urgencyBonus = hasMeaningfulNeed
    ? Math.min(0.24,
        needCount * 0.04
        + (up?.wantLegend ? 0.03 : 0)
        + (up?.wantTrans ? 0.05 : 0)
        + (up?.farmCredits ? 0.02 : 0)
      )
    : 0;
  const affordableNeedBonus = hasMeaningfulNeed
    ? (simCredits >= Number(mr?.prices?.basic ?? 10) ? 0.12 : 0)
    : 0;
  const chance = hasMeaningfulNeed
    ? Math.min(0.995, chanceNeed + earlyProcureBonus + urgencyBonus + affordableNeedBonus + savedPlanLegendBonus + pacingPressure + perkChanceBonus)
    : Math.min(0.55, chanceIdle + ((curDay <= 2 && simCredits >= Number(mr?.prices?.basic ?? 10)) ? 0.04 : 0) + (legendOverdue ? 0.04 : 0) + perkChanceBonus);

  // ✅ 서버(어드민)에서 편집한 키오스크 카탈로그가 있으면 그대로 사용(우선)
  // - 카탈로그는 각 키오스크 문서(Kiosk.catalog)에 저장되며, /public/kiosks로 내려옵니다.
  const kioskDoc = (Array.isArray(kiosks) ? kiosks : []).find((k) => {
    const mid = String(k?.mapId?._id || k?.mapId || '').trim();
    const zid = String(k?.zoneId || '').trim();
    return mid && String(mapObj?._id || '').trim() === mid && String(zoneId || '').trim() === zid;
  });
  let catalog = Array.isArray(kioskDoc?.catalog) ? kioskDoc.catalog : [];

  // 카탈로그 가격이 과도하게 크면(예: 800~1200) 시뮬 기본 규칙으로 fallback
  if (catalog.length && catalog.some((r) => Number(r?.priceCredits || 0) > 650)) catalog = [];

  function pickFromCatalog() {
    if (!catalog.length) return null;

    const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
    const credits = Math.max(0, Number(actor?.simCredits || 0));
    const missIds = new Set((Array.isArray(miss) ? miss : []).map((m) => String(m?.itemId || '')).filter(Boolean));

    const normId = (v) => String(v?._id || v || '').trim();

    // 1) 목표 기반: 부족한 아이템(정확히 itemId 매칭)이 카탈로그에 있으면 우선 수행
    for (const row of catalog) {
      const itemId = normId(row?.itemId);
      if (!itemId || !missIds.has(itemId)) continue;

      const mode = String(row?.mode || 'sell');
      if (mode === 'sell') {
        const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
        if (credits >= cost) return { kind: 'buy', item: findById(itemId) || row.itemId, itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
      if (mode === 'exchange') {
        const giveId = normId(row?.exchange?.giveItemId);
        const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
        if (giveId && invQty(inv, giveId) >= giveQty) {
          return { kind: 'exchange', item: findById(itemId) || row.itemId, itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
        }
      }
    }

    // 2) 교환 우선: 가진 재료로 가능한 exchange를 실행(경제 안정화 위해 확률 게이트)
    const exch = catalog.filter((r) => String(r?.mode) === 'exchange');
    if (exch.length && Math.random() < (hasMeaningfulNeed ? 0.82 : 0.60)) {
      const shuffled = shuffleArray(exch);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const giveId = normId(row?.exchange?.giveItemId);
        const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
        if (!itemId || !giveId) continue;
        if (invQty(inv, giveId) >= giveQty) {
          return { kind: 'exchange', item: findById(itemId) || row.itemId, itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
        }
      }
    }

    // 3) 환급(키오스크 buy = 유저 sell): 가진 아이템을 credits로 환전(낮은 확률)
    const refunds = catalog.filter((r) => String(r?.mode) === 'buy');
    if (refunds.length && Math.random() < (hasMeaningfulNeed ? 0.10 : 0.18)) {
      const shuffled = shuffleArray(refunds);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const gain = Math.max(0, Number(row?.priceCredits || 0));
        if (!itemId || gain <= 0) continue;
        if (invQty(inv, itemId) >= 1) return { kind: 'sell', item: findById(itemId) || row.itemId, itemId, qty: 1, credits: gain, label: '카탈로그 환급' };
      }
    }

    // 4) 구매(sell = 유저 buy): 저가 항목만 가끔 구매
    const buys = catalog.filter((r) => String(r?.mode) === 'sell');
    if (buys.length && Math.random() < (hasMeaningfulNeed ? 0.34 : 0.18)) {
      const isLvMax = (String(ruleset?.ai?.tacModuleUpgradeMode || 'level') === 'level') && (Number(actor?.tacticalSkillLevel || 1) >= 2);
      const shuffled = shuffleArray(buys);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
        if (!itemId) continue;
        // (level 모드) 전술 스킬 레벨이 MAX면 모듈을 랜덤 구매하지 않음(낭비 방지)
        if (isLvMax) {
          const it = findById(itemId) || row?.itemId;
          const nm = String(it?.name || '');
          const tags = Array.isArray(it?.tags) ? it.tags : [];
          const isTacModule = nm.includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
          if (isTacModule) continue;
        }
        if (cost <= 0 || credits >= cost) return { kind: 'buy', item: findById(itemId) || row.itemId, itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
    }

    return null;
  };

  const hasCatalogNeed = catalog.some((r) => {
    const itemId = String(r?.itemId?._id || r?.itemId || '').trim();
    return itemId && miss.some((m) => String(m?.itemId || '') === itemId);
  });
  if (!hasCatalogNeed) {
    // 업그레이드 목표(전설/초월)만 있어도 키오스크를 '조금 더 자주' 사용
    if (Math.random() >= chance) return null;
  }
  const pickedByCatalog = pickFromCatalog();
  if (pickedByCatalog) return pickedByCatalog;

  // --- 우선 교환/환급 규칙(키오스크 핵심) ---
  // - 포스 코어 → 미스릴
  // - 미스릴 → 전술 강화 모듈
  // - 전술 강화 모듈 → 크레딧 환급
  // - 운석 ↔ 생명의 나무 (상호 교환)
  const findByTag = (tagKey) => items.find((x) => Array.isArray(x?.tags) && x.tags.some((t) => String(t).toLowerCase() == String(tagKey).toLowerCase())) || null;
  const meteorItem = findByTag('meteor') || findItemByKeywords(items, ['운석', 'meteor']);
  const lifeTreeItem = findByTag('life_tree') || findItemByKeywords(items, ['생명의 나무', 'tree of life', 'life tree']);
  const mithrilItem = findByTag('mithril') || findItemByKeywords(items, ['미스릴', 'mythril', 'mithril']);
  const forceCoreItem = findByTag('force_core') || findItemByKeywords(items, ['포스 코어', 'force core']);
  const tacModuleItem = findByTag('tac_skill_module') || findItemByKeywords(items, ['전술 강화 모듈', 'tac. skill module', 'tactical']);

  const tacUpgradeMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level'); // 'level' | 'stack'
  const TAC_MAX_LV = 2;
  const tacSkillLv = Math.max(1, Math.min(TAC_MAX_LV, Math.floor(Number(actor?.tacticalSkillLevel || 1))));
  const tacIsLvMax = (tacUpgradeMode === 'level') && (tacSkillLv >= TAC_MAX_LV);

  function getPrice(it, fallback) {
    const v = Number(it?.baseCreditValue ?? it?.value ?? it?.price ?? fallback);
    return (Number.isFinite(v) && v > 0) ? v : Math.max(0, Number(fallback || 0));
  };

  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const has = (it, q=1) => (it?._id ? invQty(inv, String(it._id)) : 0) >= Math.max(1, Number(q||1));
  const missNeedCount = (specialKey) => (Array.isArray(miss) ? miss : []).reduce((sum, m) => {
    const key = String(m?.special || classifySpecialByName(m?.name) || '');
    if (key !== String(specialKey || '')) return sum;
    return sum + Math.max(0, Number(m?.need || 1) - Number(m?.have || 0));
  }, 0);
  const preserveNeededSpecials = mr?.exchange?.preserveNeededSpecials !== false;
  const spareForceNeed = Math.max(0, Number(mr?.exchange?.spareForceCoreToMithril ?? 1));
  const spareMithrilNeed = Math.max(0, Number(mr?.exchange?.spareMithrilToTacModule ?? 2));

  // 0-A) 즉시 교환: 포코→미스릴, 미스릴→모듈, 모듈→크레딧(환급)
  // - 관전 템포를 위해 교환은 확률로 과도한 반복을 줄입니다.
  const forceCoreHave = forceCoreItem?._id ? invQty(inv, String(forceCoreItem._id)) : 0;
  const mithrilHave = mithrilItem?._id ? invQty(inv, String(mithrilItem._id)) : 0;
  const needForceCount = missNeedCount('force_core');
  const needMithrilCount = missNeedCount('mithril');
  const canExchangeForceCore = forceCoreItem && mithrilItem && has(forceCoreItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (forceCoreHave - needForceCount) >= spareForceNeed);
  if (canExchangeForceCore && Math.random() < 0.42) {
    return { kind: 'exchange', item: mithrilItem, itemId: String(mithrilItem._id), qty: 1, consume: [{ itemId: String(forceCoreItem._id), qty: 1 }], label: '포스 코어→미스릴' };
  }
  // (level 모드) 전술 스킬 레벨이 MAX면 미스릴→모듈 교환을 중단(낭비 방지)
  const canExchangeMithril = mithrilItem && tacModuleItem && !tacIsLvMax && has(mithrilItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (mithrilHave - needMithrilCount) >= spareMithrilNeed);
  if (canExchangeMithril && Math.random() < 0.38) {
    return { kind: 'exchange', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, consume: [{ itemId: String(mithrilItem._id), qty: 1 }], label: '미스릴→전술 강화 모듈' };
  }

  // 전술 강화 모듈: (level 모드) 전술 스킬 레벨업 재료 / (stack 모드) 보유 스택 기반 강화
  const tacModuleHave = tacModuleItem?._id ? invQty(inv, String(tacModuleItem._id)) : 0;
  if (tacUpgradeMode !== 'level') {
    // stack 모드에서만 환급을 적극 허용
    if (tacModuleItem && tacModuleHave >= 2 && Math.random() < 0.55) {
      const gain = getPrice(tacModuleItem, 100);
      return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급' };
    }
  } else {
    // level 모드에서는 레벨업이 끝나기 전까지 환급을 거의 하지 않음
    if (tacModuleItem && tacSkillLv >= TAC_MAX_LV && tacModuleHave >= 1 && Math.random() < 0.25) {
      const gain = getPrice(tacModuleItem, 100);
      return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급(레벨MAX)' };
    }
  }

  // 0-B) 목표 기반 상호 교환: 운석↔생나
  const needMeteor = miss.some((m) => (m?.special === 'meteor' || classifySpecialByName(m?.name) === 'meteor'));
  const needTree = miss.some((m) => (m?.special === 'life_tree' || classifySpecialByName(m?.name) === 'life_tree'));
  if (meteorItem && lifeTreeItem) {
    if (needTree && has(meteorItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: lifeTreeItem, itemId: String(lifeTreeItem._id), qty: 1, consume: [{ itemId: String(meteorItem._id), qty: 1 }], label: '운석→생명의 나무' };
    }
    if (needMeteor && has(lifeTreeItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: meteorItem, itemId: String(meteorItem._id), qty: 1, consume: [{ itemId: String(lifeTreeItem._id), qty: 1 }], label: '생명의 나무→운석' };
    }
  }

  // 0-C-0) Saved Plan식 추천: 목표 상위 장비가 '특수 재료 1개만 부족'하면 그 재료를 최우선 구매
  if (oneSpecialShort) {
    const key = String(oneSpecialShort.special || '');
    const onePick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : (key === 'vf' ? findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']) : tacModuleItem);
    const oneCost = (key === 'vf')
      ? applyKioskCost(Number(mr?.prices?.vf ?? 500))
      : ((key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
        ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
        : applyKioskCost(Number(mr?.prices?.tacModule ?? 10)));
    const oneOk = key === 'vf'
      ? Number(mr?.buySuccess?.vf ?? 0.95)
      : Number(mr?.buySuccess?.legendary ?? 0.95);
    if (onePick?._id && simCredits >= oneCost && Math.random() < Math.min(0.995, oneOk + 0.06)) {
      return { kind: 'buy', item: onePick, itemId: String(onePick._id), qty: 1, cost: oneCost, label: `추천 특수재료(${key})` };
    }
  }

  // 0-C) 목표 기반 구매: 운석/생나/미스릴/포코/모듈
  // - 가격은 아이템 baseCreditValue를 우선 사용(없으면 기존 룰셋 fallback).
  const tacModuleTargetMin = (tacUpgradeMode === 'level') ? (tacSkillLv >= TAC_MAX_LV ? 0 : 1) : 1;
  const tacModuleWant = tacModuleItem && (tacModuleHave < tacModuleTargetMin) && (simCredits >= Number(mr?.prices?.tacModule ?? 10)) && (Math.random() < 0.35);
  const wantSpecial = tacModuleWant
    ? ({ name: '전술 강화 모듈', special: 'tac_skill_module' })
    : miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)) || (!tacIsLvMax && String(m?.name||'').includes('전술 강화 모듈')));
  if (wantSpecial) {
    const key = wantSpecial.special || classifySpecialByName(wantSpecial.name);
    const pick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : tacModuleItem;
    if (pick && pick._id) {
      const cost = (key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
        ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
        : Number(mr?.prices?.tacModule ?? 10);
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const pressureOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.08 : 0) + (oneSpecialShort ? 0.03 : 0));
      if (simCredits >= cost && Math.random() < pressureOk) {
        return { kind: 'buy', item: pick, itemId: String(pick._id), qty: 1, cost, label: '특수재료 구매' };
      }
    }
  }

  // 0-D) 업그레이드 목표(전설/초월) 기반 구매: 목표 레시피가 없어도 후반 세팅을 위해 특수재료를 확보
  // - ER 참고: 크레딧으로 키오스크에서 특수 재료 구매 가능
  // - 우선순위: 초월 목표면 VF → 전설 재료(아무거나)
  if (up && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day')) {
    const buyOkLegend = Number(mr?.buySuccess?.legendary ?? 0.85);
    const buyOkVf = Number(mr?.buySuccess?.vf ?? 0.85);

    // (A) 초월: VF 혈액 샘플
    if (allowVf && up.wantTrans && !up.hasVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
      const vfItem2 = findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vfItem2?._id && simCredits >= cost && Math.random() < buyOkVf) {
        return { kind: 'buy', item: vfItem2, itemId: String(vfItem2._id), qty: 1, cost, label: 'VF 혈액 샘플(업그레이드)' };
      }
    }

    // (B) 전설: 4대 전설 재료 중 "가장 싼" 것부터 확보
    if (allowLegendary && up.wantLegend && !up.hasLegendMatAny) {
      const cand = [];
      if (meteorItem?._id) cand.push({ key: 'meteor', it: meteorItem, cost: applyKioskCost(kioskLegendaryPrice('meteor', mr?.prices?.legendaryByKey)) });
      if (lifeTreeItem?._id) cand.push({ key: 'life_tree', it: lifeTreeItem, cost: applyKioskCost(kioskLegendaryPrice('life_tree', mr?.prices?.legendaryByKey)) });
      if (mithrilItem?._id) cand.push({ key: 'mithril', it: mithrilItem, cost: applyKioskCost(kioskLegendaryPrice('mithril', mr?.prices?.legendaryByKey)) });
      if (forceCoreItem?._id) cand.push({ key: 'force_core', it: forceCoreItem, cost: applyKioskCost(kioskLegendaryPrice('force_core', mr?.prices?.legendaryByKey)) });
      cand.sort((a, b) => (a.cost - b.cost) || String(a.key).localeCompare(String(b.key)));
      const pick = cand[0] || null;
      const legendBuyBias = (curDay <= 3 ? 0.06 : 0) + (miss.length >= 2 ? 0.04 : 0) + (legendOverdue ? 0.08 : 0) + (nearLegend ? 0.03 : 0);
      if (pick?.it?._id && simCredits >= pick.cost && Math.random() < Math.min(0.99, buyOkLegend + legendBuyBias)) {
        return { kind: 'buy', item: pick.it, itemId: String(pick.it._id), qty: 1, cost: Math.max(0, Number(pick.cost || 0)), label: `특수재료(${pick.key})` };
      }
    }
  }

  // 1) 목표 기반: VF 혈액 샘플 (룰셋 가격/성공률)
  const needVf = miss.find((m) => m?.special === 'vf' || classifySpecialByName(m?.name) === 'vf');
  if (needVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfItem = findById(needVf.itemId) || findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
    const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
    const ok = Number(mr?.buySuccess?.vf ?? 0.85);
    if (allowVf && vfItem && simCredits >= cost && Math.random() < ok) {
      return { kind: 'buy', item: vfItem, itemId: String(vfItem._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 2) 목표 기반: 전설 재료(룰셋 가격/성공률)
  const needCore = miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)));
  if (needCore) {
    const key = needCore.special || classifySpecialByName(needCore.name);
    const coreNameMap = { meteor: '운석', life_tree: '생명의 나무', mithril: '미스릴', force_core: '포스 코어' };
    const label = coreNameMap[key] || '전설 재료';

    const candidates = getLegendaryCoreCandidates(items);
    const found = findById(needCore.itemId) || (candidates.find((c) => c.key === key)?.item || null);
    const cost = applyKioskCost(kioskLegendaryPrice(key, mr?.prices?.legendaryByKey));

    if (found) {
      // 구매 우선
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const needBuyOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.05 : 0));
      if (allowLegendary && simCredits >= cost && Math.random() < needBuyOk) {
        return { kind: 'buy', item: found, itemId: String(found._id), qty: 1, cost, label };
      }
    }
  }

  // 3) 목표 기반: 일반 재료(맵 상자풀에 존재하는 재료만 구매)
  const needBasic = miss.find((m) => m?.itemId && !m?.special && isItemInMapCrates(mapObj, m.itemId));
  if (needBasic) {
    const it = findById(needBasic.itemId);
    const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
    const ok = Number(mr?.buySuccess?.basic ?? 0.75);
    if (allowBasic && it && simCredits >= cost && Math.random() < ok) {
      const needQty = Math.max(1, Math.min(3, Math.max(1, Number(needBasic.need || 1) - Number(needBasic.have || 0))));
      return { kind: 'buy', item: it, itemId: String(it._id), qty: needQty, cost, label: '재료 보급' };
    }
  }

  // 4) fallback: 기존 랜덤 로직 (VF/전설 재료/기본 보급)

  // 4-1) 4일차 낮 이후: VF 혈액 샘플(500 크레딧) 구매 가능
  if (isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfChance = Number(mr?.fallback?.vfChance ?? 0.25);
    if (allowVf && Math.random() < vfChance) {
      const vf = findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vf && simCredits >= cost) return { kind: 'buy', item: vf, itemId: String(vf._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 4-2) 2일차 낮 이후: 운석/생나 키오스크 구매/교환 가능(미스릴/포스코어도 포함)
  const lgChance = Number(mr?.fallback?.legendaryChance ?? 0.20);
  if (allowLegendary && Math.random() < lgChance) {
    const cores = getLegendaryCoreCandidates(items);
    if (cores.length) {
      const picked = cores[Math.floor(Math.random() * cores.length)];
      const cost = applyKioskCost(kioskLegendaryPrice(picked.key, mr?.prices?.legendaryByKey));

      // 구매
      const ok = Number(mr?.buySuccess?.legendaryFallback ?? mr?.buySuccess?.legendary ?? 0.7);
      if (simCredits >= cost && Math.random() < ok) {
        return { kind: 'buy', item: picked.item, itemId: String(picked.item._id), qty: 1, cost, label: picked.label };
      }
    }
  }

  // 4-3) 기본 보급(하급 재료)
  const basicChance = Number(mr?.fallback?.basicChance ?? 0.35);
  if (allowBasic && Math.random() < basicChance) {
    const entry = pickFromAllCrates(mapObj, publicItems);
    if (entry?.itemId) {
      const it = findById(entry.itemId);
      const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
      if (it && simCredits >= cost) {
        const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
        return { kind: 'buy', item: it, itemId: String(it._id), qty, cost, label: '보급품' };
      }
    }
  }

  return null;
}


// --- 전송 드론(하급 아이템) 호출: 즉시 지급 ---
function lowestEquippedTier(actor, publicItems = []) {
  const eq = ensureEquipped(actor);
  const items = Array.isArray(publicItems) ? publicItems : [];
  const tiers = EQUIP_SLOTS.map((slot) => {
    const itemId = String(eq?.[slot] || '');
    if (!itemId) return 0;
    const item = items.find((it) => String(it?._id || '') === itemId) || null;
    return clampTier4(Number(item?.tier || 0));
  }).filter((v) => Number.isFinite(v) && v > 0);
  return tiers.length ? Math.min(...tiers) : 0;
}

function rollDroneOrder(droneOffers, mapObj, publicItems, curDay, curPhase, actor, phaseIdxNow, craftGoal, itemNameById, marketRules, absSecNow = 0) {
  // 드론은 언제든 호출 가능(하급 아이템 보급용). 캐릭터가 자동으로 호출하며, '즉시 지급' 규칙을 따른다.
  // 너무 잦으면 재미가 깨지므로 확률 + 초 단위 쿨다운으로 제어한다.
  const dm = marketRules?.drone || {};
  if (dm?.enabled === false) return null;
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.droneChancePlus || 0)) + Math.max(0, perkNumber(perkFx.craftChancePlus || 0)) * 0.01;
  const applyDroneCost = (value) => applyPerkDiscount(value, perkFx.droneDiscountPct, perkFx.marketDiscountPct);

  const invCount = Array.isArray(actor?.inventory) ? actor.inventory.length : 0;

  // 실제 ER Remote Drone은 credits만 있으면 anytime, anywhere 호출 가능하다.
  // 시뮬은 1 tick 1 행동 규칙과 비용 조건만 유지하고, 인위적 cooldown gate는 제거한다.
  const absNow = Number(absSecNow || 0);

  const credits = Math.max(0, Number(actor?.simCredits || 0));
  const items = Array.isArray(publicItems) ? publicItems : [];
  const needId = pickMissingBasicItemId(craftGoal);
  const hasNeed = !!needId;
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const legendOverdue = goalTier >= 5 && isAtOrAfterWorldTime(curDay, curPhase, 2, 'night') && lowestEquippedTier(actor, publicItems) < 5;
  const transOverdue = goalTier >= 6 && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && lowestEquippedTier(actor, publicItems) < 6;

  // 목표(조합)에서 부족한 하급 재료가 있으면 조금 더 자주 호출
  const needLow = Number(dm?.chanceNeedLowInv ?? 0.55);
  const needDef = Number(dm?.chanceNeedDefault ?? 0.38);
  const lowInv = Number(dm?.chanceLowInv ?? 0.30);
  const inv2 = Number(dm?.chanceInv2 ?? 0.20);
  const def = Number(dm?.chanceDefault ?? 0.10);
  const droneBaseChance = hasNeed ? (invCount <= 2 ? needLow : needDef) : (invCount <= 1 ? lowInv : invCount == 2 ? inv2 : def);
  const droneUrgency = hasNeed
    ? Math.min(0.24, ((curDay <= 2) ? 0.08 : 0) + ((credits >= Number(dm?.price ?? 10)) ? 0.10 : 0) + (invCount <= 2 ? 0.06 : 0))
    : ((curDay <= 2 && invCount <= 1) ? 0.05 : 0);
  const pacingPressure = (legendOverdue ? 0.12 : 0) + (transOverdue ? 0.16 : 0) + ((goalTier >= 5 && hasNeed && curDay <= 2) ? 0.04 : 0);
  const baseChance = Math.min(0.98, droneBaseChance + droneUrgency + pacingPressure + perkChanceBonus);
  if (Math.random() >= baseChance) return null;

  const pool = [];
  function isSpecialName(name) {
    const kind = classifySpecialByName(name);
    return kind === 'vf' || isSpecialCoreKind(kind);
  };

  // 1) droneOffers(있으면)에서 뽑기: 특수 재료(운석/생나/미스릴/포스코어/VF)는 제외
  if (Array.isArray(droneOffers) && droneOffers.length) {
    for (const offer of droneOffers) {
      const price = applyDroneCost(Math.max(0, Number(offer?.price ?? offer?.cost ?? 0)));
      const itemId = String(offer?.itemId ?? offer?.item?._id ?? '');
      const item = offer?.item || (itemId ? items.find((x) => String(x?._id) === itemId) : null);
      if (!itemId || !item) continue;

      const nm = String(item?.name || '');
      if (isSpecialName(nm)) continue;
      if (credits < price) continue;

      let weight = Math.max(1, Number(offer?.weight ?? 1));

      // 목표에 필요한 재료면 가중치 크게
      const mul = Math.max(1, Number(dm?.needWeightMul ?? 8));
      if (hasNeed && String(itemId) === String(needId)) weight *= (mul + (legendOverdue ? 4 : 0) + (transOverdue ? 6 : 0));

      pool.push({ kind: 'offer', offerId: offer?.offerId ?? offer?._id ?? null, item, itemId, price, weight });
    }
  }

  // 1-1) 목표 재료가 있는데, offer에 없거나(혹은 전부 비쌈) pool이 비었으면 fallback로 해당 아이템을 직접 구매하는 형태(가격 고정)
  if (hasNeed && !pool.some((p) => String(p?.itemId) === String(needId))) {
    const it = items.find((x) => String(x?._id) === String(needId));
    const nfPrice = applyDroneCost(Math.max(0, Number(dm?.needFallbackPrice ?? 10)));
    if (it && !isSpecialName(it?.name) && credits >= nfPrice) {
      const w = Math.max(1, Number(dm?.needFallbackWeight ?? 5));
      pool.push({ kind: 'needFallback', offerId: null, item: it, itemId: String(it._id), price: nfPrice, weight: w });
    }
  }

  // 2) fallback: 공용 아이템 중 하급 재료 느낌(가격 고정)에서 뽑기
  if (!pool.length && items.length) {
    const fallbackKeywords = Array.isArray(dm?.fallbackKeywords) ? dm.fallbackKeywords : ['천', '가죽', '철', '돌', '나뭇', 'wood', 'leather', 'fabric', 'iron', 'stone'];
    for (const it of items) {
      const name = String(it?.name || '');
      if (!name) continue;
      if (isSpecialName(name)) continue;

      const low = name.toLowerCase();
      const ok = fallbackKeywords.some((k) => low.includes(String(k).toLowerCase()));
      if (!ok) continue;

      const price = applyDroneCost(Math.max(0, Number(dm?.price ?? 10)));
      if (credits >= price) {
        pool.push({ kind: 'fallback', offerId: null, item: it, itemId: String(it._id), price, weight: 1 });
      }
    }
  }

  if (!pool.length) return null;
  const picked = pickWeighted(pool);
  if (!picked?.itemId) return null;

  const qty = 1;
  return {
    kind: 'drone',
    offerId: picked.offerId,
    item: picked.item,
    itemId: String(picked.itemId),
    qty,
    cost: Math.max(0, Number(picked.price || 0)),
  };
}



function readStat(actor, keys) {
  const st = actor?.stats && typeof actor.stats === 'object' ? actor.stats : actor;
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  // 전투/사냥 난이도 보정용(간단 모델)
  const str = readStat(actor, ['STR', 'str']);
  const agi = readStat(actor, ['AGI', 'agi']);
  const sht = readStat(actor, ['SHOOT', 'SHT', 'shoot', 'sht']);
  const end = readStat(actor, ['END', 'end']);
  const men = readStat(actor, ['MEN', 'men']);
  return str + agi + sht + end + men * 0.5;
}

// --- 야생동물/변이체(필드 교전): 하급 아이템 + (조건부) 특수 재료 드랍 ---
function rollWildlifeEncounter(mapObj, zoneId, publicItems, curDay, curPhase, actor, opts = {}) {
  const moved = !!opts.moved;
  const isKioskZone = !!opts.isKioskZone;
  const disableBoss = !!opts.disableBoss;
  const force = !!opts.force;
  const perkFx = getActorPerkEffects(actor);
  const perkWildLootBias = Math.max(0, getPerkWildlifeLootBias(perkFx));
  const perkWildCreditPct = normalizePerkPct(perkFx?.wildlifeCreditsPct || 0);
  const perkWildDamageMinus = Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0));

  // 키오스크 구역은 비교적 "안전지대"로 간주: 야생 조우 확률/보스 스폰을 낮춤
  const baseChance = isKioskZone ? (moved ? 0.10 : 0.05) : (moved ? 0.22 : 0.10);
  if (!force && Math.random() >= baseChance) return null;

  const p = roughPower(actor);
  const powerBonus = Math.min(0.25, Math.max(0, (p - 40) / 240));

  // --- 스폰 규칙(요청): 늑대=매 낮, 곰=매 밤, 닭/멧돼지/박쥐=매 페이즈 ---
  const tod = curPhase === 'morning' ? 'day' : 'night';
  const spawnPool = [
    ...(tod === 'day'
      ? [{ key: 'wolf', label: '늑대', icon: '🐺', weight: 3 }]
      : [{ key: 'bear', label: '곰', icon: '🐻', weight: 3 }]),
    { key: 'chicken', label: '닭', icon: '🐔', weight: 2 },
    { key: 'boar', label: '멧돼지', icon: '🐗', weight: 2 },
    { key: 'bat', label: '박쥐', icon: '🦇', weight: 2 },
    { key: 'dog', label: '들개', icon: '🐕', weight: 2 },
  ];
  const species = pickWeighted(spawnPool) || spawnPool[0];

    if (!disableBoss) {
  // 5일차 낮부터: 위클라인 → VF 혈액 샘플 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 5, 'day') && Math.random() < 0.15 + powerBonus) {
      const vf = findItemByKeywords(publicItems, ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf']);
      const dmg = applyPerkDamageReduction(Math.max(6, 18 - Math.floor(p / 10)), perkWildDamageMinus);
      if (vf?._id) {
        const drops = [{ item: vf, itemId: String(vf._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.45, 1) }];
        const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
        const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
        const pick = (Math.random() < (0.5 + Math.min(0.12, perkWildLootBias * 0.12)) ? meteor : tree) || meteor || tree;
        if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
        return {
          kind: 'weakline',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(65, 95), perkWildCreditPct),
          drops,
          log: '🧬 변이체(위클라인) 처치! VF 혈액 샘플 + (운석/생명의 나무) 획득 가능',
        };
      }
    }

    // 4일차 낮부터: 오메가 → 포스 코어 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && Math.random() < 0.18 + powerBonus) {
      const fc = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);
      const dmg = applyPerkDamageReduction(Math.max(8, 26 - Math.floor(p / 9)), perkWildDamageMinus);
      if (fc?._id) {
        return {
          kind: 'omega',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(48, 72), perkWildCreditPct),
          drops: [{ item: fc, itemId: String(fc._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.35, 1) }],
          log: `🧿 변이체(오메가) 격파! 포스 코어 획득 가능`,
        };
      }
    }

    // 3일차 낮부터: 알파 → 미스릴 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 3, 'day') && Math.random() < 0.22 + powerBonus) {
      const mi = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
      const dmg = applyPerkDamageReduction(Math.max(6, 22 - Math.floor(p / 9)), perkWildDamageMinus);
      if (mi?._id) {
        return {
          kind: 'alpha',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(36, 56), perkWildCreditPct),
          drops: [{ item: mi, itemId: String(mi._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.32, 1) }],
          log: `🐺 야생동물(알파) 사냥 성공! 미스릴 획득 가능`,
        };
      }
    }

    }

  // 기본: 하급 재료 드랍(맵 상자 풀 기반 / 없으면 fallback)
  const drops = [];
  const entry = pickFromAllCrates(mapObj, publicItems);
  if (entry?.itemId) {
    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(entry.itemId)) || null;
    if (it?._id) {
      const qty0 = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
      const qty = maybeBoostDropQty(qty0, perkWildLootBias * 0.38, 1);
      drops.push({ item: it, itemId: String(it._id), qty });
    }
  }

  // ✅ 박쥐 제외 모든 야생동물: 고기 드랍(요청)
  const meat = findItemByKeywords(publicItems, ['고기']);
  if (meat?._id) {
    if (species?.key === 'chicken') {
      if (Math.random() < Math.min(0.92, (2 / 3) + perkWildLootBias * 0.12)) drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.32, 1) });
    } else if (species?.key === 'boar') {
      drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(2, perkWildLootBias * 0.32, 1) });
    } else if (species?.key === 'bear' || species?.key === 'wolf' || species?.key === 'dog') {
      drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.28, 1) });
    }
    // bat은 제외
  }

  // ✅ 모든 야생동물: 5% 확률로 운석 또는 생명의 나무 드랍
  if (Math.random() < Math.min(0.22, 0.05 + perkWildLootBias * 0.06)) {
    const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
    const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
    const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
    if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
  }

  if (!drops.length) return null;

  // ✅ ER 참고: 야생동물 사냥으로 크레딧 획득
  // - 수치는 ER 크레딧 감각(야생동물 소량, 변이/보스는 더 큼)에 맞춰 낮게 유지
  // - 대신 "장비가 뒤처진" 실험체는 파밍으로 역전 기회를 더 잘 잡도록 보정(언더독 보너스)
  const dayScale = 1 + Math.min(0.35, Math.max(0, (Number(curDay || 1) - 1) * 0.08));
  let crMin = 10;
  let crMax = 14;
  const k0 = String(species?.key || '').toLowerCase();
  if (k0 === 'chicken') { crMin = 12; crMax = 18; }
  else if (k0 === 'bat') { crMin = 9; crMax = 14; }
  else if (k0 === 'boar') { crMin = 14; crMax = 22; }
  else if (k0 === 'dog') { crMin = 14; crMax = 22; }
  else if (k0 === 'wolf') { crMin = 18; crMax = 28; }
  else if (k0 === 'bear') { crMin = 22; crMax = 34; }

  const tierSum = getEquipTierSummary(actor);
  const avgTier = (Number(tierSum.weaponTier || 0) + Number(tierSum.armorTierSum || 0) / 4) / 2;
  const underdogMul = (Number(curDay || 1) >= 3 && avgTier <= 3.2) ? 1.6 : (Number(curDay || 1) >= 4 && avgTier <= 4.2) ? 1.3 : 1.0;

  const credits0 = Math.max(0, Math.floor(randInt(Math.floor(crMin * dayScale), Math.floor(crMax * dayScale)) * underdogMul));
  const credits = applyPerkCreditBonus(credits0, perkWildCreditPct);

  const dmgBase = species?.key === 'bear' ? 11 : species?.key === 'wolf' ? 9 : species?.key === 'boar' ? 8 : species?.key === 'bat' ? 6 : 4;
  const dmg = applyPerkDamageReduction(Math.max(0, dmgBase - Math.floor(p / 18)), perkWildDamageMinus);
  return {
    kind: String(species?.key || 'wildlife'),
    damage: dmg,
    credits,
    drops,
    log: `${String(species?.icon || '🦌')} ${String(species?.label || '야생동물')} 사냥 성공`,
  };

  // drops가 비어있으면 조우 없음으로 처리
  return null;
}

// --- 🦌 야생동물(존 스폰 카운트) 소모 ---
// - spawnState.wildlife[zoneId] > 0 이면 "해당 존에 야생동물이 존재"한다고 가정
// - 조우가 성립하면 1마리 소모하고, rollWildlifeEncounter(force=true)로 드랍/크레딧을 생성
function consumeWildlifeAtZone(spawnState, mapObj, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !s.wildlife || typeof s.wildlife !== 'object') return null;
  const zid = String(zoneId || '');
  if (!zid) return null;

  const moved = !!opts.moved;
  const isKioskZone = !!opts.isKioskZone;
  const recovering = !!opts.recovering;
  if (recovering) return null;

  const cur = Math.max(0, Number(s.wildlife[zid] ?? 0));
  if (cur <= 0) return null;

  // 조우 확률(존에 개체가 많을수록 더 잘 만남)
  const base = isKioskZone ? (moved ? 0.18 : 0.08) : (moved ? 0.70 : 0.38);
  const densBoost = Math.min(0.22, cur * 0.04);
  const chance = Math.min(0.92, base + densBoost);
  if (Math.random() >= chance) return null;

  // 1마리 소모
  s.wildlife[zid] = Math.max(0, cur - 1);

  // 실제 드랍/크레딧 생성
  const res = rollWildlifeEncounter(mapObj, zid, publicItems, curDay, curPhase, actor, {
    moved,
    isKioskZone,
    disableBoss: true,
    force: true,
  });

  if (res) return res;

  // 드랍 데이터가 없더라도, "사냥했다"는 이벤트는 남김(파밍 루프 끊김 방지)
  const p = roughPower(actor);
  const perkFx = getActorPerkEffects(actor);
  const dmg = applyPerkDamageReduction(Math.max(0, 5 - Math.floor(p / 22)), Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0)));
  const credits = applyPerkCreditBonus(Math.max(0, randInt(12, 22)), perkFx?.wildlifeCreditsPct || 0);
  return { kind: 'wildlife', damage: dmg, credits, drops: [], log: '🦌 야생동물 사냥 성공' };
}

// --- 운석/생명의 나무 자연 스폰(2일차 낮 이후, 일부 맵으로 확장 가능) ---
function rollNaturalCoreSpawn(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 운석/생명의 나무: 2일차 '낮' 이후부터
  const ruleset = opts?.ruleset || null;
  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};
  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  if (!isAtOrAfterWorldTime(curDay, curPhase, coreGateDay, 'day')) return null;

  const moved = !!opts.moved;

  // --- 구역 제한: "일부 구역"만 자연 스폰 허용 ---
  const zones = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const z = zones.find((x) => String(x?.zoneId) === String(zoneId)) || null;
  const zoneName = String(z?.name || '');
  const zoneHasKiosk = Boolean(opts?.isKioskZone || z?.hasKiosk);

  // 키오스크 구역(병원/성당/경찰서 등)은 자연 스폰 제외(안전지대 느낌)
  if (zoneHasKiosk) return null;

  // mapObj.coreSpawnZones가 있으면 최우선(향후 데이터화 대비)
  const mapAllow = Array.isArray(mapObj?.coreSpawnZones) ? mapObj.coreSpawnZones.map(String) : null;

  let allowed = false;
  if (mapAllow && mapAllow.length) {
    allowed = mapAllow.includes(String(zoneId));
  } else if (z && typeof z?.coreSpawn === 'boolean') {
    allowed = !!z.coreSpawn;
  } else {
    // 데이터가 없으면 기본 허용 구역(레거시)만 허용
    allowed = LEGACY_CORE_ZONE_IDS.includes(String(zoneId)) || LEGACY_CORE_ZONE_NAME_KEYS.includes(zoneName);
  }

  if (!allowed) return null;

  // 구역 제한이 들어가므로 기본 확률을 약간 올림(그래도 희귀)
  const chance = moved ? 0.08 : 0.03;
  if (Math.random() >= chance) return null;

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const candidates = [];
  if (meteor?._id) candidates.push({ key: 'meteor', item: meteor, weight: 1 });
  if (tree?._id) candidates.push({ key: 'life_tree', item: tree, weight: 1 });
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  if (!picked?.item?._id) return null;

  return { item: picked.item, itemId: String(picked.item._id), qty: 1, kind: String(picked.key) };
}

// --- 인벤토리/스택 제한(최소) ---
const DEFAULT_INV_RULES = {
  maxSlots: 10,
  stackMax: { material: 3, consumable: 6, equipment: 1 },
};

function getInvRules(ruleset) {
  const inv = ruleset?.inventory || {};
  return {
    maxSlots: Number(inv.maxSlots || DEFAULT_INV_RULES.maxSlots),
    stackMax: { ...DEFAULT_INV_RULES.stackMax, ...(inv.stackMax || {}) },
  };
}

function inferItemCategory(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  // ✅ 서버(DB) 아이템이 equipSlot을 들고 오는 경우 우선 장비로 판정
  // (기존 로직은 name/tag 기반이라 equipSlot만 있는 장비가 재료로 오인될 수 있음)
  if (it && typeof it === 'object') {
    const slot = String(it?.equipSlot || '').trim().toLowerCase();
    if (slot) return 'equipment';
  }

  const isConsumable =
    type === 'food' ||
    type === 'consumable' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    tags.includes('heal') ||
    tags.includes('medical') ||
    lower.includes('bandage') ||
    lower.includes('medkit') ||
    name.includes('음식') ||
    name.includes('빵') ||
    name.includes('고기') ||
    name.includes('붕대') ||
    name.includes('응급');

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

function inferEquipSlot(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  // ✅ 서버(DB) 아이템의 equipSlot 필드를 최우선으로 사용
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

function getEffectIndex(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = String(effectName || '');
  return list.findIndex((e) => String(e?.name || '') === key);
}

function hasActiveEffect(character, effectName) {
  return getEffectIndex(character, effectName) >= 0;
}

function removeActiveEffect(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = String(effectName || '');
  const next = list.filter((e) => String(e?.name || '') !== key);
  const removed = next.length !== list.length;
  if (removed) character.activeEffects = next;
  return removed;
}

function isBandageLikeItem(it) {
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  return lower.includes('bandage') || lower.includes('medkit') || name.includes('붕대') || name.includes('응급');
}

function canReceiveItem(inventory, it, itemId, qty, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? inventory : [];
  const key = String(it?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  if (!key || want <= 0) return false;

  const category = inferItemCategory(it);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const idx = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (idx >= 0) {
    const have = Math.max(0, Number(list[idx]?.qty ?? 1));
    return have < maxStack;
  }

  // 장비는 타입(머리/옷/팔/신발/무기)별 1개 유지: 더 좋은 장비(tier↑)면 교체 허용
  if (category === 'equipment') {
    const slot = inferEquipSlot(it);
    if (slot) {
      const existing = list.find((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === slot);
      if (existing) {
        const cfg = ruleset?.equipment || {};
        const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
        const newTier = clampTier4(it?.tier || 1);
        const oldTier = clampTier4(existing?.tier || 1);
        if (replaceOnlyIfBetter) return newTier > oldTier;
        return true;
      }
    }
  }
  return list.length < rules.maxSlots;
}

function normalizeInventory(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const list = (Array.isArray(inventory) ? inventory : [])
    .map((x) => ({ ...x }))
    .filter((x) => (x?.itemId || x?.id) && Math.max(0, Number(x?.qty ?? 1)) > 0);

  for (let i = 0; i < list.length; i++) {
    const category = String(list[i]?.category || inferItemCategory(list[i]) || 'material');
    const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    list[i] = {
      ...list[i],
      category,
      equipSlot: category === 'equipment' ? (list[i]?.equipSlot || inferEquipSlot(list[i]) || '') : (list[i]?.equipSlot || ''),
      tier: clampTier4(list[i]?.tier || 1),
      qty: Math.min(maxStack, q),
    };
  }

  // 장비 타입(머리/옷/팔/신발/무기) 중복은 최신 1개만 유지
  const kept = [];
  const usedSlots = new Set();
  for (let i = list.length - 1; i >= 0; i--) {
    const isEq = String(list[i]?.category || inferItemCategory(list[i])) === 'equipment';
    const slot = isEq ? String(list[i]?.equipSlot || inferEquipSlot(list[i]) || '') : '';
    if (isEq && slot) {
      if (usedSlots.has(slot)) continue;
      usedSlots.add(slot);
    }
    kept.push(list[i]);
  }
  kept.reverse();

  if (kept.length > rules.maxSlots) {
    // 오래된 것부터 드랍(정렬 기준: acquiredDay 오름차순)
    kept.sort((a, b) => (Number(a?.acquiredDay ?? 0) - Number(b?.acquiredDay ?? 0)));
    return kept.slice(Math.max(0, kept.length - rules.maxSlots));
  }
  return kept;
}

function formatInvRuleState(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const slots = Array.isArray(inventory) ? inventory.length : 0;
  const cap = rules?.stackMax || {};
  return ` [INV ${slots}/${rules.maxSlots} | 재료${cap.material}/소모${cap.consumable}/장비${cap.equipment}]`;
}

function formatInvAddNote(meta, want, inventory, ruleset) {
  const reason = String(meta?.reason || '');
  const accepted = Math.max(0, Number(meta?.acceptedQty ?? want ?? 0));
  const dropped = Math.max(0, Number(meta?.droppedQty ?? 0));

  let note = '';
  if (reason === 'equip_replaced') {
    const slot = String(meta?.slot || '');
    const oldName = String(meta?.oldName || '');
    const newName = String(meta?.newName || '');
    const oldTier = Number(meta?.oldTier || 0);
    const newTier = Number(meta?.newTier || 0);
    const head = slot ? `[${slot}]` : '';
    const tOld = oldTier > 0 ? `T${oldTier} ` : '';
    const tNew = newTier > 0 ? `T${newTier} ` : '';
    note = ` (장비 교체${head}: ${tOld}${oldName} → ${tNew}${newName})`;
  } else if (reason === 'equip_not_better') {
    note = ' (장비 유지: 더 좋은 장비가 아님)';
  } else if (accepted <= 0 && dropped > 0) {
    if (reason === 'equip_slot_full') note = ' (장비 슬롯 가득: 획득 실패)';
    else if (reason === 'inventory_full') note = ' (가방 가득: 획득 실패)';
    else note = ' (획득 실패)';
  } else if (dropped > 0) {
    note = ` (스택/한도 초과 ${dropped}개 버림)`;
  }

  if (!note) return '';
  if (!inventory || !ruleset) return note;
  return `${note}${formatInvRuleState(inventory, ruleset)}`;
}

function addItemToInventory(inventory, item, itemId, qty, day, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  const key = String(item?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  const category = inferItemCategory(item);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const equipSlot = category === 'equipment' ? inferEquipSlot(item) : '';

  if (!key || want <= 0) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'invalid' };
    return list;
  }

  const i = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (i >= 0) {
    const cur = Math.max(0, Number(list[i]?.qty ?? 1));
    const next = Math.min(maxStack, cur + want);
    const accepted = Math.max(0, next - cur);
    const dropped = Math.max(0, (cur + want) - next);
    list[i] = { ...list[i], qty: next, category, tier: clampTier4(item?.tier || list[i]?.tier || 1), ...(category === 'equipment' ? { rarity: tierLabelKo(clampTier4(item?.tier || list[i]?.tier || 1)) } : {}), ...(equipSlot ? { equipSlot } : {}) };
    list._lastAdd = { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
    return list;
  }

  // 장비는 타입(머리/옷/팔/신발/무기)별 1개 유지: 더 좋은 장비(tier↑)면 교체
  if (category === 'equipment' && equipSlot) {
    const cfg = ruleset?.equipment || {};
    const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
    const j = list.findIndex((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === equipSlot);
    if (j >= 0) {
      const oldTier = clampTier4(list[j]?.tier || 1);
      const newTier = clampTier4(item?.tier || 1);
      const forceSameTier = !!item?._forceReplaceSameTier && (newTier === oldTier);
      if (replaceOnlyIfBetter && !(newTier > oldTier) && !forceSameTier) {
        list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'equip_not_better' };
        return list;
      }
      const oldName = String(list[j]?.name || itemDisplayName(list[j]) || '');
      const newName = String(item?.name || itemDisplayName(item) || '');
      list.splice(j, 1);
      list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: 0, reason: 'equip_replaced', slot: equipSlot, oldName, newName, oldTier, newTier };
    }
  }

  // 장비 교체로 슬롯이 비었으면 inventory_full 체크를 건너뜀
  if (String(list?._lastAdd?.reason || '') !== 'equip_replaced' && list.length >= rules.maxSlots) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'inventory_full' };
    return list;
  }

  const replacedMeta = String(list?._lastAdd?.reason || '') === 'equip_replaced' ? { ...list._lastAdd } : null;

  const accepted = Math.min(maxStack, want);
  const dropped = Math.max(0, want - accepted);
  list.push({
    itemId: item?._id || itemId,
    qty: accepted,
    name: item?.name,
    type: item?.type,
    tags: Array.isArray(item?.tags) ? item.tags : [],
    category,
    equipSlot: equipSlot || '',
    tier: clampTier4(item?.tier || 1), ...(category === 'equipment' ? { rarity: tierLabelKo(clampTier4(item?.tier || 1)) } : {}),
    acquiredDay: Number(day || 0),
  });
  list._lastAdd = replacedMeta
    ? { ...replacedMeta, itemId: key, acceptedQty: accepted, droppedQty: dropped }
    : { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
  return list;
}

function invQty(inventory, itemId) {
  const id = String(itemId || '');
  if (!id) return 0;
  return (Array.isArray(inventory) ? inventory : []).reduce(
    (sum, x) => (String(x?.itemId || x?.id || '') === id ? sum + Math.max(0, Number(x?.qty || 1)) : sum),
    0
  );
}

function consumeIngredientsFromInv(inventory, ingredients) {
  const need = compactIO(ingredients);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  for (const ing of need) {
    const id = String(ing.itemId || '');
    let remaining = Math.max(0, Number(ing.qty || 1));
    if (!id || remaining <= 0) continue;

    for (let i = 0; i < list.length && remaining > 0; i++) {
      if (String(list[i]?.itemId || list[i]?.id || '') !== id) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const next = have - take;
      remaining -= take;
      if (next <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: next };
      }
    }
  }
  return list;
}

function tryAutoCraftFromLoot(inventory, lootedItemId, craftables, itemNameById, itemMetaById, day, ruleset) {
  const lootId = String(lootedItemId || '');
  if (!lootId) return null;

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.some((ing) => String(ing?.itemId) === lootId))
    .sort((a, b) => (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name)));

  // ✅ 1일차에는 조합이 '보이도록' 확률을 조금 올림(관전 템포)
  const chance = (Number(day || 0) === 1) ? 0.75 : 0.35;
  if (!candidates.length || Math.random() >= chance) return null;

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const ok = ings.length > 0 && ings.every((ing) => invQty(inventory, ing.itemId) >= Number(ing.qty || 1));
    if (!ok) continue;

    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? computeCraftTierFromIngredients(ings, itemMetaById, itemNameById)
      : clampTier4(target?.tier || 1);

    const craftedItem = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    // 인벤토리가 가득 차면 조합하지 않음(재료 소모 방지)
    // - 장비의 경우 craftTier 반영 전(target.tier)로 판단하면 업그레이드가 막히므로 craftedItem 기준으로 체크
    if (!canReceiveItem(inventory, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    const afterConsume = consumeIngredientsFromInv(inventory, ings);
    const afterAdd = addItemToInventory(afterConsume, craftedItem, craftedItem?._id, 1, day, ruleset);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    return { inventory: afterAdd, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }
  return null;
}

// ✅ 인벤 기반 자동 조합(페이즈당 1회)
// - loot 트리거(tryAutoCraftFromLoot)만으로는 재료가 쌓여도 제작이 멈추는 구간이 생김
// - 조건을 만족하면 1회는 반드시 시도(관전형 템포)
function buildCraftDebugInfo(actor, craftables, itemNameById, ruleset) {
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const withRecipe = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0);
  if (!withRecipe.length) return { code: 'recipe_none', text: '레시피가 있는 제작 대상이 없습니다.' };

  const goalBySlot = pickGoalLoadoutBySlot(actor);
  let bestTarget = null;
  let bestMissing = [];
  let bestScore = -1;
  let weaponMismatch = 0;
  let tierBlocked = 0;
  let receiveBlocked = 0;
  let readyCount = 0;

  for (const it of withRecipe) {
    const ings = compactIO(it?.recipe?.ingredients || []);
    const missing = [];
    let have = 0;
    for (const ing of ings) {
      const need = Number(ing?.qty || 1);
      const got = invQty(inv0, ing?.itemId);
      if (got >= need) have += 1;
      else missing.push(`${itemNameById?.[String(ing?.itemId || '')] || String(ing?.itemId || '')} x${Math.max(0, need - got)}`);
    }
    const score = (have * 100) - missing.length;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = it;
      bestMissing = missing;
    }
    if (missing.length > 0) continue;
    readyCount += 1;

    const cat = inferItemCategory(it);
    if (cat === 'equipment') {
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        if (w && actorWNorm && w !== actorWNorm) {
          weaponMismatch += 1;
          continue;
        }
      }
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampTier4(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampTier4(Number(it?.tier || 1));
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (!wantGoal && tgtTier <= curTier) {
        tierBlocked += 1;
        continue;
      }
    }
    if (!canReceiveItem(inv0, it, it?._id, 1, ruleset)) {
      receiveBlocked += 1;
      continue;
    }
  }

  if (readyCount <= 0) {
    const targetName = String(bestTarget?.name || '목표 없음');
    const missText = bestMissing.length > 0 ? ` / 부족: ${bestMissing.slice(0, 3).join(', ')}` : '';
    return { code: 'missing_ing', targetName, missing: bestMissing, text: `${targetName} 제작 재료 부족${missText}` };
  }
  if (weaponMismatch > 0) {
    return { code: 'weapon_mismatch', targetName: String(bestTarget?.name || ''), text: '무기 타입이 맞지 않아 제작 후보에서 제외되었습니다.' };
  }
  if (receiveBlocked > 0) {
    return { code: 'inventory_full', targetName: String(bestTarget?.name || ''), text: '인벤/슬롯 제한으로 결과물을 받을 수 없습니다.' };
  }
  if (tierBlocked > 0) {
    return { code: 'tier_blocked', targetName: String(bestTarget?.name || ''), text: '동일 슬롯에 동급 이상 장비가 있어 제작을 보류했습니다.' };
  }
  return { code: 'no_candidate', targetName: String(bestTarget?.name || ''), text: '제작 가능한 후보를 찾지 못했습니다.' };
}

function tryAutoCraftFromInventory(actor, craftables, itemNameById, itemMetaById, day, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return null;
  if (Number(actor?._invCraftPhaseIdx ?? -9999) === Number(phaseIdxNow || 0)) return null;

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const perkFx = getActorPerkEffects(actor);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goalBySlot = pickGoalLoadoutBySlot(actor);
  const goalKeys = new Set(Object.values(goalBySlot).map((x) => String(x || '').trim()).filter(Boolean));
  const keyOfId = (id) => String(kmap?.[String(id || '')] || '').trim();

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0)
    .filter((it) => {
      const ings = compactIO(it?.recipe?.ingredients || []);
      if (!ings.length) return false;
      return ings.every((ing) => invQty(inv0, ing.itemId) >= Number(ing.qty || 1));
    })
    .filter((it) => {
      const cat = inferItemCategory(it);
      if (cat !== 'equipment') return true;
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        // 무기 타입이 명시된 경우: 캐릭터 선호 무기와 다르면 제작 우선순위에서 제외
        if (w && actorWNorm && w !== actorWNorm) return false;
      }
      // 같은 슬롯에 이미 동급 이상이 있으면 제작하지 않음(재료 낭비 방지)
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampTier4(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampTier4(Number(it?.tier || 1));

      // 목표 장비면(같은 티어라도) 목표와 다를 때 1회 교체 제작을 허용
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (wantGoal) {
        const eqId = String(ensureEquipped(actor)?.[slot] || '');
        const eqKey = eqId ? keyOfId(eqId) : '';
        if (eqKey && eqKey === candKey) return false;
        if (inv0.some((x) => String(getInvItemId(x)) === String(it?._id))) return false;
        return true;
      }

      return tgtTier > curTier;
    })
    .sort((a, b) => {
      const ka = String(a?.itemKey || a?.externalId || '').trim();
      const kb = String(b?.itemKey || b?.externalId || '').trim();
      const ga = (goalKeys.size > 0 && ka && goalKeys.has(ka)) ? 1 : 0;
      const gb = (goalKeys.size > 0 && kb && goalKeys.has(kb)) ? 1 : 0;
      if (gb != ga) return gb - ga;

      const perkScoreA = (ga ? (goalWeightBonus * 100) : 0) + (Number(a?.tier || 1) * craftBias * 4);
      const perkScoreB = (gb ? (goalWeightBonus * 100) : 0) + (Number(b?.tier || 1) * craftBias * 4);
      if (perkScoreB !== perkScoreA) return perkScoreB - perkScoreA;

      const ca = inferItemCategory(a) === 'equipment' ? 1 : 0;
      const cb = inferItemCategory(b) === 'equipment' ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return (Number(b?.tier || 1) - Number(a?.tier || 1)) || String(a?.name || '').localeCompare(String(b?.name || ''));
    });

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? clampTier4(Number(target?.tier || computeCraftTierFromIngredients(ings, itemMetaById, itemNameById) || 1))
      : clampTier4(target?.tier || 1);
    const craftedItem0 = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    // 목표 장비라면 같은 티어 교체를 허용(장비 슬롯 1개 유지 정책에 막히지 않게)
    let craftedItem = craftedItem0;
    if (cat === 'equipment') {
      const slot = String(target?.equipSlot || inferEquipSlot(target) || '').toLowerCase();
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(target?.itemKey || target?.externalId || '').trim();
      if (wantKey && candKey && wantKey === candKey) {
        craftedItem = { ...craftedItem0, _forceReplaceSameTier: true };
      }
    }

    if (!canReceiveItem(inv0, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    let inv = consumeIngredientsFromInv(inv0, ings);
    inv = addItemToInventory(inv, craftedItem, craftedItem?._id, 1, day, ruleset);
    const meta = inv?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
    if (got <= 0) continue;

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    actor._craftDebug = {
      code: 'crafted',
      targetName: String(craftedItem?.name || ''),
      missing: [],
      phaseIdx: Number(phaseIdxNow || 0),
      text: `${craftedItem?.name || '아이템'} 제작 완료`,
    };
    return { changed: true, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ [${actor?.name}] 인벤 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }

  actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);
  actor._craftDebug = {
    ...buildCraftDebugInfo(actor, craftables, itemNameById, ruleset),
    phaseIdx: Number(phaseIdxNow || 0),
  };
  return null;
}

// ===============================
// ✅ 1일차 목표: "1회 이동"만으로 영웅(T4)까지 맞추기
// - 플레이어 간섭이 없으므로, 관전 템포를 위해 AI가 재료를 소모해 장비를 단계적으로 끌어올립니다.
// - 규칙(요청): 하급 재료 2개 → 일반(T1) 제작 / (장비 + 하급1) → 희귀(T3) / (희귀 + 하급1) → 영웅(T4)
//   ※ 여기서는 '하급 재료'를 (재료 카테고리 + 특수재료 제외 + tier<=2)로 간주합니다.
// ===============================

function getInvId(x) {
  return String(x?.itemId || x?.id || x?._id || '');
}

function getInvTier(x, itemMetaById) {
  const t0 = Number(x?.tier);
  if (Number.isFinite(t0) && t0 > 0) return clampTier4(t0);
  const id = getInvId(x);
  const m = id ? itemMetaById?.[id] : null;
  return clampTier4(m?.tier || 1);
}

function isLowMaterialInvEntry(x, itemMetaById, itemNameById) {
  if (!x || typeof x !== 'object') return false;
  const id = getInvId(x);
  if (!id) return false;

  const cat = String(x?.category || inferItemCategory(x) || 'material');
  if (cat !== 'material') return false;

  const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
  if (!name) return false;
  if (classifySpecialByName(name)) return false; // 운석/생나/포스코어/미스릴/VF 제외

  const tier = getInvTier(x, itemMetaById);
  return tier <= 2;
}

function countLowMaterials(inventory, itemMetaById, itemNameById) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => {
    if (!isLowMaterialInvEntry(x, itemMetaById, itemNameById)) return sum;
    return sum + Math.max(0, Number(x?.qty ?? 1));
  }, 0);
}

function consumeLowMaterials(inventory, need, itemMetaById, itemNameById) {
  const want = Math.max(0, Math.floor(Number(need || 0)));
  if (want <= 0) return { inventory: Array.isArray(inventory) ? [...inventory] : [], consumed: 0 };

  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  // qty 많은 것부터 먼저 소모
  list.sort((a, b) => Math.max(0, Number(b?.qty ?? 1)) - Math.max(0, Number(a?.qty ?? 1)));

  let remaining = want;
  for (let i = 0; i < list.length && remaining > 0; i++) {
    if (!isLowMaterialInvEntry(list[i], itemMetaById, itemNameById)) continue;
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const next = q - take;
    remaining -= take;
    if (next <= 0) {
      list.splice(i, 1);
      i -= 1;
    } else {
      list[i] = { ...list[i], qty: next };
    }
  }

  return { inventory: list, consumed: want - remaining };
}

function pickBestEquipBySlot(inventory, slot) {
  const s = String(slot || '').toLowerCase();
  const list = Array.isArray(inventory) ? inventory : [];
  const cand = list.filter((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s);
  if (!cand.length) return null;
  cand.sort((a, b) => clampTier4(Number(b?.tier || 1)) - clampTier4(Number(a?.tier || 1)));
  return cand[0] || null;
}

function autoEquipBest(actor, itemMetaById) {
  if (!actor || typeof actor !== 'object') return;
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goal = pickGoalLoadoutBySlot(actor);

  function keyOfInv(x) {
    const id = String(getInvItemId(x) || '');
    const k = String(x?.itemKey || x?.externalId || kmap?.[id] || '').trim();
    return k;
  };

  for (const s of EQUIP_SLOTS) {
    const goalKey = String(goal?.[s] || '').trim();
    if (goalKey) {
      const hit = inv.find((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s && keyOfInv(x) === goalKey);
      if (hit) {
        nextEq[s] = String(getInvItemId(hit));
        continue;
      }
    }

    const best = pickBestEquipBySlot(inv, s);
    if (best) nextEq[s] = String(best?.itemId || best?.id || best?._id || '');
    else nextEq[s] = null;
  }
  actor.equipped = nextEq;
}

function day1HeroGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  const d = Number(day || 0);
  const ph = String(phase || '').toLowerCase();
  if (d !== 1) return { changed: false, logs: [] };
  if (actor?.day1HeroDone) return { changed: false, logs: [] };

  // ✅ 관전형 요구사항(사용자): "1일차 밤"까지는 전원 영웅(T4) 세팅을 반드시 완료
  // - 파밍 RNG/재료 부족/이동 실패로 목표가 누락되는 것을 방지
  // - 낮에는 재료 소모 방식(단계적 제작/강화)을 유지하되, 밤에는 부족한 슬롯을 강제로 채움
  if (ph.includes('night')) {
    const logs = [];
    let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
    inv = normalizeInventory(inv, ruleset);

    const preferredWeaponType = String(actor?.weaponType || '').trim();
    const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
      ? preferredWeaponType
      : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
    const wTypeNorm = normalizeWeaponType(wType);

    for (const slot of EQUIP_SLOTS) {
      const best = pickBestEquipBySlot(inv, slot);
      const curTier = best ? clampTier4(Number(best?.tier || 1)) : 0;
      if (curTier >= 4) continue;
      const gear = createEquipmentItem({ slot, day: d, tier: 4, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`✅ [${actor?.name}] 강제 세팅(1일차 밤): ${SLOT_ICON[slot] || '🧩'} 영웅 장비 획득`);
    }

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.day1HeroDone = true;
    logs.push(`🏁 [${actor?.name}] 1일차 밤 보정 완료: 영웅 장비 세트 확정`);
    return { changed: true, logs };
  }

  // 낮에는 기존 방식 유지: 최소 1회 이동 + 재료 소모로 단계적 달성
  if (Math.max(0, Number(actor?.day1Moves || 0)) < 1) return { changed: false, logs: [] };

  const logs = [];
  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  // 1) 비어있는 방어구 슬롯을 먼저 채움(머리/옷/팔) — 2재료씩
  for (const slot of ['head', 'clothes', 'arm']) {
    const has = !!pickBestEquipBySlot(inv, slot);
    const low = countLowMaterials(inv, itemMetaById, itemNameById);
    if (!has && low >= 2) {
      const dec = consumeLowMaterials(inv, 2, itemMetaById, itemNameById);
      inv = dec.inventory;
      const gear = createEquipmentItem({ slot, day: d, tier: 1, weaponType: '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`🛠️ [${actor?.name}] 제작: ${SLOT_ICON[slot] || '🧩'} ${gear?.name || '장비'} (일반)`);
    }
  }

  // 2) 무기/신발 포함 5부위 업그레이드(희귀→영웅) — 1재료씩
  // - 1일차 목표를 위해 한 페이즈에서 과도하게 반복하지 않도록 슬롯당 최대 2단계만 진행
  for (const slot of EQUIP_SLOTS) {
    for (let step = 0; step < 2; step += 1) {
      const it = pickBestEquipBySlot(inv, slot);
      if (!it) break;
      const curTier = clampTier4(Number(it?.tier || 1));
      if (curTier >= 4) break;

      const low = countLowMaterials(inv, itemMetaById, itemNameById);
      if (low < 1) break;

      // T1/2 -> T3, T3 -> T4
      const nextTier = curTier >= 3 ? 4 : 3;
      const dec = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
      if (dec.consumed < 1) break;
      inv = dec.inventory;

      const gear = createEquipmentItem({ slot, day: d, tier: nextTier, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`⬆️ [${actor?.name}] 강화: ${SLOT_ICON[slot] || '🧩'} ${tierLabelKo(nextTier)} 장비 획득`);
    }
  }

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);

  const done = EQUIP_SLOTS.every((s) => {
    const it = pickBestEquipBySlot(inv, s);
    return it && clampTier4(Number(it?.tier || 1)) >= 4;
  });

  if (done) {
    actor.day1HeroDone = true;
    logs.push(`✅ [${actor?.name}] 1일차 목표 달성: 영웅 장비 세트 완성(이동 ${Math.max(0, Number(actor?.day1Moves || 0))}회)`);
  }

  return { changed: logs.length > 0, logs };
}

// ===============================
// ✅ 후반 세팅: 전설(T5)/초월(T6) 제작 디렉터
// - 규칙(요청):
//   * 하급 재료 1 + (운석/생나/미스릴/포스코어) -> 전설(5)
//   * 하급 재료 1 + VF 혈액 샘플 -> 초월(6)
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 실제로 실행
// - 페이즈당 1회만 수행(과속/로그 스팸 방지)
// ===============================
function lateGameGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [] };

  const d = Number(day || 0);
  const ph = String(phase || '');
  const logs = [];

  const phaseIdx = worldPhaseIndex(d, ph);
  if (Number(actor?.lateGameCraftPhaseIdx) === Number(phaseIdx)) return { changed: false, logs };

  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const up = computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, d, ph, ruleset);
  if (!up?.wantLegend && !up?.wantTrans) return { changed: false, logs };

  // 하급 재료 1개는 필수
  if (Number(up.lowCount || 0) < 1) return { changed: false, logs };

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  const slotOrder = EQUIP_SLOTS.slice();
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  slotOrder.sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  // 목표 티어 결정
  const targetTier = up.wantTrans ? 6 : 5;

  // 재료 선택(우선순위)
  const vfId = findInvItemIdBySpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const forceId = findInvItemIdBySpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const mithrilId = findInvItemIdBySpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const meteorId = findInvItemIdBySpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const lifeId = findInvItemIdBySpecialKind(inv, 'life_tree', itemMetaById, itemNameById);

  let specialId = '';
  let specialLabel = '';
  if (targetTier === 6) {
    specialId = vfId;
    specialLabel = 'VF';
    if (!specialId) return { changed: false, logs };
  } else {
    specialId = forceId || mithrilId || meteorId || lifeId;
    specialLabel = forceId ? '포스코어' : mithrilId ? '미스릴' : meteorId ? '운석' : lifeId ? '생나' : '';
    if (!specialId) return { changed: false, logs };
  }

  // 업그레이드가 필요한 슬롯 선택
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || slotOrder[0];
  if (!slotPick) return { changed: false, logs };

  // 인벤토리 공간(장비 교체 로직이 있으므로 canReceiveItem로 먼저 가드)
  const gear = createEquipmentItem({ slot: slotPick, day: d, tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs };

  // 재료 소모: 하급 1 + 특수 1
  const decLow = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
  if (decLow.consumed < 1) return { changed: false, logs };
  inv = decLow.inventory;
  inv = consumeIngredientsFromInv(inv, [{ itemId: String(specialId), qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got > 0) {
    logs.push(`🛠️ [${actor?.name}] 후반 제작: ${specialLabel}+하급재료 → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`);
    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.lateGameCraftPhaseIdx = phaseIdx;
    return { changed: true, logs };
  }

  return { changed: false, logs };
}



// ===============================
// ✅ 즉시 제작: 특수 재료 획득 즉시 전설(T5)/초월(T6) 장비 제작
// - 운석/생나/미스릴/포스코어: 전설(T5)
// - VF 혈액 샘플: 초월(T6)
// - 인벤이 꽉 차면 하급 재료 1스택을 버리고 공간을 만듭니다.
// - 과도한 로그/과속 방지를 위해 페이즈당 최대 2회까지만 허용합니다.
// ===============================
function ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById) {
  const list = Array.isArray(inv) ? [...inv] : [];
  const rules = getInvRules(ruleset);
  if (list.length < Number(rules.maxSlots || 10)) return list;

  // 1) 장비가 아닌 것(재료/소모품)부터 버림
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    const cat = inferItemCategory(it);
    if (cat === 'equipment') continue;
    // 특수 재료(VF/운석/생나/미스릴/포코)는 버리지 않음
    const nm = String(it?.name || itemNameById?.[String(it?.itemId || it?.id || '')] || itemMetaById?.[String(it?.itemId || it?.id || '')]?.name || '');
    const sk = classifySpecialByName(nm);
    if (sk) continue;

    const q = Math.max(1, Number(it?.qty || 1));
    if (q > 1) list[i] = { ...it, qty: q - 1 };
    else list.splice(i, 1);
    return list;
  }

  // 2) 그래도 꽉 차면: 마지막 아이템 1개를 제거(최후 수단)
  list.pop();
  return list;
}

function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [], pvpBonus: 0 };
  const k = String(specialKind || '');
  if (!k) return { changed: false, logs: [], pvpBonus: 0 };

  const targetTier = (k === 'vf') ? 6 : 5;
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];

  // 페이즈당 과도한 즉시 제작 방지
  if (Number(actor?._specialCraftPhaseIdx ?? -9999) !== phaseIdxNow) {
    actor._specialCraftPhaseIdx = phaseIdxNow;
    actor._specialCraftCount = 0;
  }
  const cnt = Math.max(0, Number(actor?._specialCraftCount || 0));
  if (cnt >= 2) return { changed: false, logs: [], pvpBonus: 0 };

  const sid = String(specialItemId || '');
  if (!sid) return { changed: false, logs: [], pvpBonus: 0 };
  if (invQty(inv0, sid) <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  let inv = normalizeInventory(inv0, ruleset);

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  const slotOrder = EQUIP_SLOTS.slice().sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || null;
  if (!slotPick) return { changed: false, logs: [], pvpBonus: 0 };

  // 무기 타입은 캐릭터 선호 기준으로
  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  const gear = createEquipmentItem({ slot: slotPick, day: Number(curDay || 0), tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });

  // 공간 확보
  inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs: [], pvpBonus: 0 };

  // 재료 소모(특수 재료 1개)
  inv = consumeIngredientsFromInv(inv, [{ itemId: sid, qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, Number(curDay || 0), ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);
  actor._specialCraftCount = cnt + 1;

  const label = (k === 'vf') ? 'VF→초월' : (k === 'force_core') ? '포스코어→전설' : (k === 'mithril') ? '미스릴→전설' : (k === 'meteor') ? '운석→전설' : (k === 'life_tree') ? '생나→전설' : '특수재료→전설';
  const logs = [`⚒️ [${actor?.name}] 즉시 제작: ${label} → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`];

  // 수집/제작은 소음이 커서 교전을 유발(다음 페이즈 + 즉시 표적)
  const pvpBonus = (k === 'vf') ? 0.55 : 0.35;

  return { changed: true, logs, inventory: inv, pvpBonus };
}
// --- 운석 + 생명의 나무 수액 → 포스 코어(간단 자동 조합) ---
const MAT_METEOR_ID = 'mat_meteor';
const MAT_TREE_ID = 'mat_world_tree';
const MAT_FORCE_CORE_ID = 'mat_force_core';

function invKey(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

function invDecOne(list, id) {
  const arr = Array.isArray(list) ? [...list] : [];
  const key = String(id || '');
  for (let i = 0; i < arr.length; i++) {
    if (invKey(arr[i]) !== key) continue;
    const q = Math.max(0, Number(arr[i]?.qty || 1));
    if (q > 1) arr[i] = { ...arr[i], qty: q - 1 };
    else arr.splice(i, 1);
    return arr;
  }
  return arr;
}

function invHasOne(list, id) {
  const key = String(id || '');
  return (Array.isArray(list) ? list : []).some((it) => invKey(it) === key && Math.max(0, Number(it?.qty || 1)) > 0);
}

function makeForceCore(day) {
  return { id: MAT_FORCE_CORE_ID, text: '포스 코어', type: 'material', tags: ['material', 'core', 'force_core'], acquiredDay: day };
}

// incomingId가 mat일 경우, 인벤에 저장하지 않아도 그 1개를 재료로 간주해 조합 가능
function tryAutoCraftForceCore(inventory, day, incomingId = '') {
  const inc = String(incomingId || '');
  const haveMeteor = inc === MAT_METEOR_ID || invHasOne(inventory, MAT_METEOR_ID);
  const haveTree = inc === MAT_TREE_ID || invHasOne(inventory, MAT_TREE_ID);
  if (!haveMeteor || !haveTree) return null;

  let next = Array.isArray(inventory) ? [...inventory] : [];
  if (inc !== MAT_METEOR_ID) next = invDecOne(next, MAT_METEOR_ID);
  if (inc !== MAT_TREE_ID) next = invDecOne(next, MAT_TREE_ID);
  next = [...next, makeForceCore(day)];
  return { inventory: next, log: '🧬 포스 코어 조합: 운석 파편 + 생명의 나무 수액 → 포스 코어 x1' };
}

function safeGenerateDynamicEvent(actor, day, ruleset, phase, publicItems) {
  try {
    // ✅ 기존 구현(2인자) / 신규 구현(3~4인자) 모두 호환
    const res = generateDynamicEvent(actor, day, ruleset, phase, publicItems);
    if (res && typeof res === 'object') return res;
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  } catch (err) {
    // ruleset 미정의 등 런타임 ReferenceError 방어
    console.error('[safeGenerateDynamicEvent] fallback:', err);
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  }
}

// --- 월드 시간(일차/낮/밤) 유틸 ---
// NOTE: 기존 phase(morning/night) 로직을 깨지 않기 위해, timeOfDay는 phase에서 파생합니다.
// - phase: 'morning' | 'night' (기존 유지)
// - timeOfDay: 'day' | 'night' (게이트/스폰 규칙용)
const TIME_OF_DAY_ORDER = { day: 0, night: 1 };

function getTimeOfDayFromPhase(ph) {
  return ph === 'morning' ? 'day' : 'night';
}

function worldTimeText(d, ph) {
  const tod = getTimeOfDayFromPhase(ph);
  const icon = tod === 'day' ? '🌞' : '🌙';
  const ko = tod === 'day' ? '낮' : '밤';
  return `${icon} ${Number(d || 0)}일차 ${ko}`;
}

// 예) 2일차 낮 이후: isAtOrAfterWorldTime(day, phase, 2, 'day')
function isAtOrAfterWorldTime(curDay, curPhase, reqDay, reqTimeOfDay = 'day') {
  const cd = Number(curDay || 0);
  const rd = Number(reqDay || 0);
  const cOrder = TIME_OF_DAY_ORDER[getTimeOfDayFromPhase(curPhase)] ?? 0;
  const rOrder = TIME_OF_DAY_ORDER[String(reqTimeOfDay)] ?? 0;
  if (cd > rd) return true;
  if (cd < rd) return false;
  return cOrder >= rOrder;
}

// --- 월드 페이즈 인덱스(배송/쿨다운 등) ---
// day=1, phase=morning(낮) => 0
// day=1, phase=night(밤)  => 1
function worldPhaseIndex(d, ph) {
  const dd = Math.max(0, Number(d || 0));
  const tod = getTimeOfDayFromPhase(ph);
  const base = Math.max(0, dd - 1) * 2;
  return base + (tod === 'night' ? 1 : 0);
}



// 로컬 명예의 전당(내 기록) 백업 저장: 서버 저장/조회가 꼬여도 최소한 로컬엔 남게 함
function saveLocalHallOfFameBackup(winner, killCountsObj, assistCountsObj, participantsList) {
  try {
    const me = getUser();
    const username = me?.username || me?.id || 'guest';
    const idToName = {};
    (participantsList || []).forEach((p) => {
      const id = String(p?._id || p?.id || '');
      if (!id) return;
      idToName[id] = p?.name || p?.nickname || p?.charName || p?.title || id;
    });

    writeHallOfFameState({ username }, (current) => {
      const state = { ...(current || {}), chars: { ...(current?.chars || {}) } };
      Object.entries(killCountsObj || {}).forEach(([pid, k]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(k || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.kills = Number(entry.kills || 0) + amount;
        state.chars[sid] = entry;
      });
      Object.entries(assistCountsObj || {}).forEach(([pid, a]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(a || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.assists = Number(entry.assists || 0) + amount;
        state.chars[sid] = entry;
      });
      if (winner) {
        const wid = String(winner?._id || winner?.id || '');
        if (wid) {
          const entry = state.chars[wid] || { name: idToName[wid] || winner?.name || wid, wins: 0, kills: 0, assists: 0 };
          entry.name = idToName[wid] || entry.name;
          entry.wins = Number(entry.wins || 0) + 1;
          state.chars[wid] = entry;
        }
      }
      return state;
    }, { winnerId: String(winner?._id || winner?.id || '') });
  } catch (e) {
    console.error('local hof save failed', e);
  }
}

export {
  safeTags,
  itemDisplayName,
  resolveRewardDropEntry,
  normalizeRewardDropEntries,
  itemIcon,
  shuffleArray,
  EQUIP_SLOTS,
  START_WEAPON_TYPES,
  INIT_DEPENDENCY_PATHS,
  normalizeUserStatistics,
  mergeStoredUserProgress,
  PERK_EFFECT_DEFAULTS,
  PERK_EFFECT_ALIASES,
  perkNumber,
  normalizePerkPct,
  normalizePerkEffects,
  buildPerkRuntimeBundle,
  getActorPerkEffects,
  applyPerkDiscount,
  getPerkLootBias,
  getPerkAggressionBias,
  applyPerkLootWeight,
  getPerkWildlifeLootBias,
  getPerkEventItemBias,
  applyPerkCreditBonus,
  applyPerkDamageReduction,
  maybeBoostDropQty,
  applyPerkBundleToActor,
  ensureEquipped,
  normalizeRuntimeInventory,
  normalizeRuntimeEffect,
  normalizeRuntimeSurvivorList,
  buildRuntimeSurvivorMap,
  upsertRuntimeSurvivor,
  normalizeRuntimeSurvivor,
  getInvItemId,
  getSimEquipExternalId,
  isSimGeneratedEquipment,
  getEquipMoveSpeed,
  SLOT_ICON,
  LUMIA_ZONE_POS,
  LUMIA_DEFAULT_EDGES,
  shortText,
  hash32,
  extractActorNameFromLog,
  getEquipSummary,
  compactIO,
  isEnabledScenarioEvent,
  getScenarioEventTimeOfDay,
  localKeyHyperloops,
  localKeyHyperloopDeviceZone,
  readLocalJsonArray,
  uniqStr,
  randInt,
  pickWeighted,
  clampTier4,
  tierLabelKo,
  crateTypeLabel,
  rollTranscendPickOptions,
  pickAutoTranscendOption,
  rollFieldLoot,
  normalizeMatchKey,
  findItemByKeywords,
  getEquipTierSummary,
  getLegendaryCoreCandidates,
  resolveLegendaryDropWeights,
  rollLegendaryCrateLoot,
  pickFromAllCrates,
  pickUnitsFromInventory,
  removePickedUnitsFromInventory,
  pruneEquippedAgainstInventory,
  clearRuntimeCombatFields,
  applyAiRecoveryWindow,
  isAiRecoveryLocked,
  normalizeDeadSnapshot,
  normalizeRevivedSurvivor,
  applyStatusEffect,
  clearNegativeStatusEffects,
  applyShieldEffect,
  applyRegenEffect,
  describeRuntimeEffect,
  applyRuntimeEffectPayloads,
  consumeShieldDamage,
  clearPostCombatEffects,
  countInventoryUnits,
  kioskLegendaryPrice,
  zoneNameHasKiosk,
  hasKioskAtZone,
  canUseKioskAtWorldTime,
  createInitialSpawnState,
  cloneSpawnState,
  zoneHasKioskFlag,
  getEligibleSpawnZoneIds,
  LEGACY_CORE_ZONE_IDS,
  LEGACY_CORE_ZONE_NAME_KEYS,
  zoneAllowsNaturalCore,
  getEligibleCoreSpawnZoneIds,
  localKeyMutantWildlifeZone,
  readLocalString,
  getMutantWildlifeSpawnZoneId,
  getHyperloopDeviceZoneId,
  ensureWorldSpawns,
  openSpawnedLegendaryCrate,
  openSpawnedFoodCrate,
  pickupSpawnedCore,
  consumeBossAtZone,
  consumeMutantWildlifeAtZone,
  classifySpecialByName,
  isSpecialCoreKind,
  computeCraftTierFromIngredients,
  applyEquipTier,
  isItemInMapCrates,
  normalizeGoalTier,
  pickGoalLoadoutBySlot,
  pickGoalLoadoutKeys,
  getOneSpecialShortMissing,
  buildCraftGoal,
  uniqStrings,
  listKioskZoneIdsForMap,
  findCrateZoneIdsForItem,
  findCrateZoneWeightsForItem,
  buildRuntimeSpawnMeta,
  expandMissingResourceChain,
  pickGoalResourceZoneTargets,
  bfsNextStepToAnyTarget,
  bfsPickSafestZone,
  invHasSpecialKind,
  findInvItemIdBySpecialKind,
  computeLateGameUpgradeNeed,
  chooseAiMoveTargets,
  pickMissingBasicItemId,
  rollKioskInteraction,
  lowestEquippedTier,
  rollDroneOrder,
  readStat,
  roughPower,
  rollWildlifeEncounter,
  consumeWildlifeAtZone,
  rollNaturalCoreSpawn,
  DEFAULT_INV_RULES,
  getInvRules,
  inferItemCategory,
  inferEquipSlot,
  getEffectIndex,
  hasActiveEffect,
  removeActiveEffect,
  isBandageLikeItem,
  canReceiveItem,
  normalizeInventory,
  formatInvRuleState,
  formatInvAddNote,
  addItemToInventory,
  invQty,
  consumeIngredientsFromInv,
  tryAutoCraftFromLoot,
  buildCraftDebugInfo,
  tryAutoCraftFromInventory,
  getInvId,
  getInvTier,
  isLowMaterialInvEntry,
  countLowMaterials,
  consumeLowMaterials,
  pickBestEquipBySlot,
  autoEquipBest,
  day1HeroGearDirector,
  lateGameGearDirector,
  ensureRoomForEquipment,
  tryImmediateCraftFromSpecial,
  MAT_METEOR_ID,
  MAT_TREE_ID,
  MAT_FORCE_CORE_ID,
  invKey,
  invDecOne,
  invHasOne,
  makeForceCore,
  tryAutoCraftForceCore,
  safeGenerateDynamicEvent,
  TIME_OF_DAY_ORDER,
  getTimeOfDayFromPhase,
  worldTimeText,
  isAtOrAfterWorldTime,
  worldPhaseIndex,
  saveLocalHallOfFameBackup,
};
