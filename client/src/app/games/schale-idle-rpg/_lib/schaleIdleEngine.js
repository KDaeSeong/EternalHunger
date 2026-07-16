import {
  SAVE_VERSION,
  STUDENTS,
  ITEMS,
  RECIPES,
  UPGRADE_DEFS,
  UPGRADE_COST_PARAMS,
  OFFLINE_CAP_MS,
  OFFLINE_WAVE_MS,
  TOWER,
  TOWER_SHOP_OFFERS,
  TOWER_SHOP_ROTATION,
  MISSIONS,
  SEASON_REWARD_TABLE,
  ITEM_LOOKUP,
  SLOT_LABELS,
  RARITY_RANK,
  AFFIX_COUNT_BY_RARITY,
  AFFIX_TEMPLATES,
  TITLES,
  ACHIEVEMENTS,
  ENHANCE_RULES,
} from './schaleIdleData';

export {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  STUDENTS,
  ITEMS,
  RECIPES,
  UPGRADE_DEFS,
  UPGRADE_COST_PARAMS,
  OFFLINE_CAP_MS,
  OFFLINE_WAVE_MS,
  TOWER,
  TOWER_SHOP_OFFERS,
  TOWER_SHOP_ROTATION,
  MISSIONS,
  SEASON_REWARD_TABLE,
  ITEM_LOOKUP,
  SLOT_LABELS,
  RARITY_RANK,
  AFFIX_COUNT_BY_RARITY,
  AFFIX_TEMPLATES,
  TITLES,
  ACHIEVEMENTS,
  ENHANCE_RULES,
} from './schaleIdleData';

const MAX_SALVAGE_QUEUE = 160;
const ENHANCE_RULE_LOOKUP = Object.fromEntries(ENHANCE_RULES.map((rule) => [rule.itemId, rule]));
const ENHANCE_PROTECTION_PREFERENCES = new Set(['AUTO', 'ALL_ONLY', 'DOWNGRADE_ONLY', 'DESTROY_ONLY']);
const ENHANCE_PITY_POLICIES = new Set(['KEEP', 'DECAY_1', 'RESET']);
const ENHANCE_PROTECTION_ITEM_IDS = [
  'itm_protect_charm',
  'itm_protect_downgrade',
  'itm_protect_destroy',
  'itm_protect_ticket',
];

export const ENHANCE_PENALTY_LABELS = {
  NONE: '강화 수치 유지',
  DOWNGRADE_1: '1단계 하락',
  DESTROY: '장비 파괴',
};

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    version: SAVE_VERSION,
    runId: options.runId || `sir-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    leaderStudentId: 'stu_noa',
    floor: 1,
    maxClearedFloor: 0,
    towerFloor: 1,
    towerMaxCleared: 0,
    towerLossStreak: 0,
    credits: 720,
    stamina: 100,
    basePower: 180,
    upgrades: defaultUpgrades(),
    equipment: {},
    equipmentInventory: {},
    equipmentPresets: [],
    activePresetId: '',
    autoUseProtectionTicket: true,
    protectionPreference: 'AUTO',
    pityPolicyOnProtection: 'KEEP',
    enhanceFailStreakByUid: {},
    lastEnhanceResult: null,
    inventory: {
      itm_scrap: 80,
      itm_bandage: 12,
      itm_battery: 6,
      itm_memory_chip: 3,
      itm_enhance_stone: 3,
      itm_tower_key: 5,
      itm_reroll_ticket: 1,
    },
    salvageQueue: [],
    salvageSettings: {
      candidateOnly: true,
    },
    towerShop: {
      dailyKey: '',
      dailyBought: {},
      weeklyKey: '',
      weeklyBought: {},
      seed: 0,
      rotation: null,
    },
    counters: {
      CLEAR_FLOOR: 0,
      KILL_BOSS: 0,
      ATTEMPT_TOWER: 0,
      CLEAR_TOWER: 0,
      CRAFT: 0,
      ENHANCE_TRY: 0,
      ENHANCE_SUCCESS: 0,
      REROLL: 0,
      SALVAGE: 0,
      SHOP_BUY: 0,
      SHOP_RESET: 0,
      UPGRADE: 0,
      EQUIP: 0,
      EQUIP_LOCK: 0,
      EQUIP_FAVORITE: 0,
      PRESET: 0,
    },
    claimedMissions: [],
    seasonRewardClaims: [],
    lifetimeCounters: {},
    achievementClaims: {},
    unlockedTitleIds: [],
    equippedTitleId: null,
    lastDutyReport: null,
    towerLastBatchReport: null,
    lastSavedAt: now,
    offlineLastSummary: null,
    log: ['샬레 당직이 시작됐습니다. 방치 정산으로 층을 밀고, 재료를 모아 장비를 제작하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const sourceInventory = value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory;
  const stackInventory = sourceInventory.stack && typeof sourceInventory.stack === 'object'
    ? sourceInventory.stack
    : sourceInventory;
  const sourceEquipmentInventory = value.equipmentInventory && typeof value.equipmentInventory === 'object'
    ? value.equipmentInventory
    : sourceInventory.equip && typeof sourceInventory.equip === 'object'
      ? sourceInventory.equip
      : {};
  const equipmentState = normalizeEquipmentState({
    equipment: value.equipment,
    equipmentInventory: sourceEquipmentInventory,
    salvageQueue: value.salvageQueue,
  });
  const towerShop = normalizeTowerShop(value.towerShop, base.towerShop);
  return {
    ...base,
    ...value,
    version: SAVE_VERSION,
    inventory: normalizeStackInventory(stackInventory, base.inventory),
    upgrades: normalizeUpgrades(value.upgrades),
    equipment: equipmentState.equipment,
    equipmentInventory: equipmentState.equipmentInventory,
    equipmentPresets: normalizeEquipmentPresets(value.equipmentPresets),
    activePresetId: typeof value.activePresetId === 'string' ? value.activePresetId : '',
    autoUseProtectionTicket: value.autoUseProtectionTicket === undefined
      ? base.autoUseProtectionTicket
      : Boolean(value.autoUseProtectionTicket),
    protectionPreference: normalizeEnhanceProtectionPreference(value.protectionPreference),
    pityPolicyOnProtection: normalizeEnhancePityPolicy(value.pityPolicyOnProtection),
    enhanceFailStreakByUid: normalizeEnhanceFailStreaks(value.enhanceFailStreakByUid, equipmentState.equipmentInventory),
    lastEnhanceResult: value.lastEnhanceResult && typeof value.lastEnhanceResult === 'object'
      ? { ...value.lastEnhanceResult }
      : base.lastEnhanceResult,
    salvageQueue: normalizeSalvageQueue(value.salvageQueue, equipmentState),
    salvageSettings: normalizeSalvageSettings(value.salvageSettings, base.salvageSettings),
    towerShop,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    claimedMissions: Array.isArray(value.claimedMissions) ? value.claimedMissions : base.claimedMissions,
    seasonRewardClaims: Array.isArray(value.seasonRewardClaims)
      ? Array.from(new Set(value.seasonRewardClaims.filter((item) => typeof item === 'string')))
      : base.seasonRewardClaims,
    lifetimeCounters: value.lifetimeCounters && typeof value.lifetimeCounters === 'object' ? normalizeCounters(value.lifetimeCounters) : base.lifetimeCounters,
    achievementClaims: value.achievementClaims && typeof value.achievementClaims === 'object' ? { ...value.achievementClaims } : base.achievementClaims,
    unlockedTitleIds: Array.isArray(value.unlockedTitleIds) ? Array.from(new Set(value.unlockedTitleIds.filter((item) => typeof item === 'string'))) : base.unlockedTitleIds,
    equippedTitleId: typeof value.equippedTitleId === 'string' ? value.equippedTitleId : null,
    lastDutyReport: value.lastDutyReport && typeof value.lastDutyReport === 'object' ? value.lastDutyReport : base.lastDutyReport,
    towerLastBatchReport: value.towerLastBatchReport && typeof value.towerLastBatchReport === 'object' ? value.towerLastBatchReport : base.towerLastBatchReport,
    lastSavedAt: typeof value.lastSavedAt === 'string' ? value.lastSavedAt : (typeof value.updatedAt === 'string' ? value.updatedAt : base.lastSavedAt),
    offlineLastSummary: value.offlineLastSummary && typeof value.offlineLastSummary === 'object' ? value.offlineLastSummary : base.offlineLastSummary,
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

function normalizeEnhanceProtectionPreference(value) {
  return ENHANCE_PROTECTION_PREFERENCES.has(value) ? value : 'AUTO';
}

function normalizeEnhancePityPolicy(value) {
  return ENHANCE_PITY_POLICIES.has(value) ? value : 'KEEP';
}

function normalizeEnhanceFailStreaks(value, equipmentInventory = {}) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([uid]) => Boolean(equipmentInventory?.[uid]))
    .map(([uid, amount]) => [uid, Math.max(0, Math.floor(Number(amount || 0)))])
    .filter(([, amount]) => amount > 0));
}

export function getItem(id) {
  return ITEM_LOOKUP[id] || null;
}

export function itemName(id) {
  return getItem(id)?.name || id;
}

export function slotLabel(slot) {
  return SLOT_LABELS[slot] || slot;
}

export function getLeader(state) {
  return STUDENTS.find((student) => student.id === state.leaderStudentId) || STUDENTS[0];
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 90),
  };
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

function hash32(value) {
  let hash = 2166136261;
  String(value || '').split('').forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addItem(inventory, itemId, qty) {
  return {
    ...inventory,
    [itemId]: Math.max(0, Number(inventory[itemId] || 0) + Number(qty || 0)),
  };
}

function normalizeStackInventory(value = {}, fallback = {}) {
  if (!value || typeof value !== 'object') return { ...fallback };
  const entries = Object.entries(value)
    .filter(([, qty]) => Number.isFinite(Number(qty)))
    .map(([itemId, qty]) => [itemId, Math.max(0, Number(qty || 0))]);
  return Object.fromEntries(entries);
}

function addItems(inventory, rewards = []) {
  return rewards.reduce((next, reward) => addItem(next, reward.itemId, reward.qty), inventory);
}

function hasItems(inventory, needs = {}) {
  return Object.entries(needs).every(([itemId, qty]) => Number(inventory[itemId] || 0) >= Number(qty || 0));
}

function spendItems(inventory, needs = {}) {
  return Object.entries(needs).reduce((next, [itemId, qty]) => addItem(next, itemId, -qty), inventory);
}

function bumpCounter(counters, action, amount = 1) {
  return {
    ...counters,
    [action]: Number(counters[action] || 0) + Number(amount || 0),
  };
}

function normalizeCounters(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, amount]) => [
    key,
    Math.max(0, Math.floor(Number(amount || 0))),
  ]));
}

function defaultUpgrades() {
  return Object.fromEntries(UPGRADE_DEFS.map((upgrade) => [upgrade.id, 0]));
}

function normalizeUpgrades(value = {}) {
  const base = defaultUpgrades();
  return Object.fromEntries(UPGRADE_DEFS.map((upgrade) => [
    upgrade.id,
    Math.max(0, Math.floor(Number(value?.[upgrade.id] ?? base[upgrade.id] ?? 0))),
  ]));
}

function upgradeCost(id, nextLevel) {
  const params = UPGRADE_COST_PARAMS[id] || UPGRADE_COST_PARAMS.UPG_FIREPOWER;
  const level = Math.max(1, Math.floor(Number(nextLevel || 1)));
  const scale = Math.pow(Number(params.growth || 1.3), level - 1);
  const items = Object.fromEntries(Object.entries(params.baseItems || {}).map(([itemId, qty]) => [
    itemId,
    Math.max(1, Math.ceil(Number(qty || 0) * scale)),
  ]));
  return {
    credits: Math.max(1, Math.ceil(Number(params.baseCredits || 0) * scale)),
    items,
  };
}

function upgradeMultipliers(upgrades = {}) {
  return UPGRADE_DEFS.reduce((next, def) => {
    const level = Math.max(0, Math.floor(Number(upgrades?.[def.id] || 0)));
    return {
      powerMul: next.powerMul * (1 + Number(def.powerMulPerLevel || 0) * level),
      staminaMul: next.staminaMul * (1 + Number(def.staminaMulPerLevel || 0) * level),
    };
  }, { powerMul: 1, staminaMul: 1 });
}

function bumpLifetimeCounter(state, action, amount = 1) {
  return {
    ...state,
    lifetimeCounters: bumpCounter(normalizeCounters(state.lifetimeCounters), action, amount),
  };
}

function addLifetimeCounters(state, entries = {}) {
  return Object.entries(entries).reduce((next, [action, amount]) => (
    Number(amount || 0) > 0 ? bumpLifetimeCounter(next, action, amount) : next
  ), state);
}

function rarityRank(rarity) {
  return RARITY_RANK[rarity] || RARITY_RANK.COMMON;
}

function defaultRolls() {
  return {
    powerAddMul: 1,
    powerMulMul: 1,
    staminaMulMul: 1,
  };
}

function normalizeRolls(rolls) {
  return {
    powerAddMul: Number(rolls?.powerAddMul || 1),
    powerMulMul: Number(rolls?.powerMulMul || 1),
    staminaMulMul: Number(rolls?.staminaMulMul || 1),
  };
}

function computeRollsFromAffixes(affixes = []) {
  return affixes.reduce((next, affix) => {
    const value = Number(affix.value || 1);
    if (affix.stat === 'POWER_ADD_MUL') return { ...next, powerAddMul: next.powerAddMul * value };
    if (affix.stat === 'POWER_MUL_MUL') return { ...next, powerMulMul: next.powerMulMul * value };
    if (affix.stat === 'STAMINA_MUL_MUL') return { ...next, staminaMulMul: next.staminaMulMul * value };
    if (affix.stat === 'GLOBAL_MUL') {
      return {
        powerAddMul: next.powerAddMul * value,
        powerMulMul: next.powerMulMul * value,
        staminaMulMul: next.staminaMulMul * value,
      };
    }
    return next;
  }, defaultRolls());
}

function rollAffixes(rng, rarity = 'UNCOMMON', slot = 'WEAPON', lockedAffixes = []) {
  const count = Math.max(1, AFFIX_COUNT_BY_RARITY[rarity] || 2);
  const locked = lockedAffixes.slice(0, count).map((affix) => ({ ...affix, locked: true }));
  const used = new Set(locked.map((affix) => affix.id));
  const pool = AFFIX_TEMPLATES.filter((template) => !used.has(template.id));
  const picked = [...locked];
  while (picked.length < count && pool.length) {
    const index = Math.floor(rng() * pool.length);
    const template = pool.splice(index, 1)[0];
    const range = template.range[rarity] || template.range.UNCOMMON;
    const value = Number((range[0] + rng() * (range[1] - range[0])).toFixed(3));
    picked.push({
      id: template.id,
      label: slot === 'ARMOR' && template.id === 'AFF_FIREPOWER' ? '방호 보정' : template.label,
      stat: template.stat,
      value,
      locked: false,
    });
  }
  return picked;
}

function normalizeEquipmentInstance(equip, fallbackSlot = '') {
  if (!equip || typeof equip !== 'object') return null;
  const def = getItem(equip.itemId);
  const slot = equip.slot || fallbackSlot || def?.equip?.slot || 'WEAPON';
  const rarity = equip.rarity || def?.rarity || 'COMMON';
  const uid = equip.uid || `${equip.itemId || 'legacy'}-${slot}-legacy`;
  const seededRng = createRng(`${uid}|${equip.itemId}|${slot}`);
  const affixes = Array.isArray(equip.affixes) && equip.affixes.length
    ? equip.affixes
    : rollAffixes(seededRng, rarity, slot);
  return {
    ...equip,
    uid,
    itemId: equip.itemId,
    name: equip.name || def?.name || equip.itemId,
    rarity,
    slot,
    enhance: Number(equip.enhance ?? equip.enhanceLevel ?? 0),
    rolls: equip.rolls ? normalizeRolls(equip.rolls) : computeRollsFromAffixes(affixes),
    affixes,
    rerollCount: Number(equip.rerollCount || 0),
    locked: Boolean(equip.locked),
    favorite: Boolean(equip.favorite),
    createdAt: Number(equip.createdAt || Date.now()),
  };
}

function normalizeEquipmentState({ equipment = {}, equipmentInventory = {}, salvageQueue = [] } = {}) {
  const inventory = {};
  const slotHints = new Map(Object.entries(equipment && typeof equipment === 'object' ? equipment : {})
    .filter(([, uid]) => typeof uid === 'string' && uid)
    .map(([slot, uid]) => [uid, slot]));
  const addEquipment = (equip, fallbackSlot = '') => {
    const normalized = normalizeEquipmentInstance(equip, fallbackSlot);
    if (!normalized?.uid || !normalized.itemId) return null;
    inventory[normalized.uid] = normalized;
    return normalized;
  };

  Object.entries(equipmentInventory || {}).forEach(([uid, equip]) => {
    addEquipment({ ...equip, uid: equip?.uid || uid }, slotHints.get(uid) || '');
  });
  (Array.isArray(salvageQueue) ? salvageQueue : []).forEach((entry) => {
    const uid = entry?.equip?.uid || entry?.uid;
    if (entry?.equip && !inventory[uid]) addEquipment({ ...entry.equip, uid });
  });

  const slots = {};
  Object.entries(equipment && typeof equipment === 'object' ? equipment : {}).forEach(([slot, value]) => {
    if (!value) return;
    const normalized = typeof value === 'string'
      ? inventory[value]
      : addEquipment(value, slot);
    if (!normalized?.uid) return;
    const targetSlot = SLOT_LABELS[slot] ? slot : normalized.slot;
    if (!SLOT_LABELS[targetSlot] || normalized.slot !== targetSlot) return;
    slots[targetSlot] = normalized.uid;
  });

  return {
    equipment: slots,
    equipmentInventory: inventory,
  };
}

function cloneEquipmentInstance(equip) {
  const normalized = normalizeEquipmentInstance(equip);
  if (!normalized) return null;
  return {
    ...normalized,
    rolls: { ...normalizeRolls(normalized.rolls) },
    affixes: (normalized.affixes || []).map((affix) => ({ ...affix })),
  };
}

function cloneEquipmentUidMap(equipment = {}) {
  return Object.entries(equipment || {}).reduce((next, [slot, uid]) => {
    const normalizedUid = typeof uid === 'string'
      ? uid
      : normalizeEquipmentInstance(uid, slot)?.uid;
    if (!normalizedUid || !SLOT_LABELS[slot]) return next;
    return { ...next, [slot]: normalizedUid };
  }, {});
}

function normalizeEquipmentPresets(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((preset, index) => {
      if (!preset || typeof preset !== 'object') return null;
      const id = String(preset.id || `preset-${index + 1}`);
      const name = String(preset.name || `프리셋 ${index + 1}`);
      return {
        id,
        name,
        equipment: cloneEquipmentUidMap(preset.equipment || {}),
        createdAt: Number(preset.createdAt || Date.now()),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeSalvageQueue(value, equipmentState) {
  const equippedUids = new Set(Object.values(equipmentState.equipment || {}).filter(Boolean));
  const seen = new Set();
  const rows = (Array.isArray(value) ? value : []).reduce((nextRows, entry) => {
    const uid = typeof entry?.uid === 'string' ? entry.uid : entry?.equip?.uid;
    const equip = equipmentState.equipmentInventory?.[uid] || normalizeEquipmentInstance(entry?.equip);
    if (!uid || !equip || equippedUids.has(uid) || seen.has(uid)) return nextRows;
    seen.add(uid);
    nextRows.push({
      ...makeSalvageEntry(equip, entry.reason || '보관 장비'),
      createdAt: Number(entry.createdAt || Date.now()),
    });
    return nextRows;
  }, []);
  Object.values(equipmentState.equipmentInventory || {}).forEach((equip) => {
    if (!equip?.uid || equippedUids.has(equip.uid) || seen.has(equip.uid)) return;
    seen.add(equip.uid);
    rows.push(makeSalvageEntry(equip, '보관 장비'));
  });
  return rows.slice(0, MAX_SALVAGE_QUEUE);
}

function normalizeTowerShop(value, fallback) {
  const source = value && typeof value === 'object' ? value : fallback;
  return {
    dailyKey: source.dailyKey || '',
    dailyBought: source.dailyBought && typeof source.dailyBought === 'object' ? source.dailyBought : {},
    weeklyKey: source.weeklyKey || '',
    weeklyBought: source.weeklyBought && typeof source.weeklyBought === 'object' ? source.weeklyBought : {},
    seed: Number(source.seed || 0),
    rotation: source.rotation && typeof source.rotation === 'object' ? {
      dailyKey: source.rotation.dailyKey || '',
      dailyOfferIds: Array.isArray(source.rotation.dailyOfferIds) ? source.rotation.dailyOfferIds.filter((id) => offerExists(id)) : [],
      dailyResetsUsed: Math.max(0, Math.floor(Number(source.rotation.dailyResetsUsed || 0))),
      dailyNonce: Math.max(0, Math.floor(Number(source.rotation.dailyNonce || 0))),
      dailyPityCounter: Math.max(0, Math.floor(Number(source.rotation.dailyPityCounter || 0))),
      weeklyKey: source.rotation.weeklyKey || '',
      weeklyOfferIds: Array.isArray(source.rotation.weeklyOfferIds) ? source.rotation.weeklyOfferIds.filter((id) => offerExists(id)) : [],
      weeklyResetsUsed: Math.max(0, Math.floor(Number(source.rotation.weeklyResetsUsed || 0))),
      weeklyNonce: Math.max(0, Math.floor(Number(source.rotation.weeklyNonce || 0))),
      weeklyPityCounter: Math.max(0, Math.floor(Number(source.rotation.weeklyPityCounter || 0))),
    } : null,
  };
}

function normalizeSalvageSettings(value, fallback = { candidateOnly: true }) {
  const source = value && typeof value === 'object' ? value : fallback;
  return {
    candidateOnly: source.candidateOnly !== false,
  };
}

function getKstDateParts(now = Date.now()) {
  const date = new Date(now + 9 * 60 * 60 * 1000);
  const dayKey = date.toISOString().slice(0, 10);
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000 / 7) + 1;
  return {
    dayKey,
    weekKey: `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
  };
}

function ensureTowerShopPeriod(towerShop, now = Date.now()) {
  const keys = getKstDateParts(now);
  return {
    dailyKey: towerShop.dailyKey === keys.dayKey ? towerShop.dailyKey : keys.dayKey,
    dailyBought: towerShop.dailyKey === keys.dayKey ? towerShop.dailyBought : {},
    weeklyKey: towerShop.weeklyKey === keys.weekKey ? towerShop.weeklyKey : keys.weekKey,
    weeklyBought: towerShop.weeklyKey === keys.weekKey ? towerShop.weeklyBought : {},
    seed: Number(towerShop.seed || 0),
    rotation: towerShop.rotation && typeof towerShop.rotation === 'object' ? { ...towerShop.rotation } : null,
  };
}

function offerExists(offerId) {
  return TOWER_SHOP_OFFERS.some((offer) => offer.id === offerId);
}

function uniqueOfferIds(ids = []) {
  const seen = new Set();
  return ids.filter((id) => {
    if (!offerExists(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function pickUnique(pool, count, rng) {
  const rows = uniqueOfferIds(pool);
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temp = rows[index];
    rows[index] = rows[swapIndex];
    rows[swapIndex] = temp;
  }
  return rows.slice(0, Math.max(0, Math.min(count, rows.length)));
}

function makeTowerShopPick(pool, count, seed, key, nonce, fixed = [], exclude = new Set()) {
  const fixedIds = uniqueOfferIds(fixed).filter((id) => !exclude.has(id));
  const fixedSet = new Set(fixedIds);
  const filtered = uniqueOfferIds(pool).filter((id) => !fixedSet.has(id) && !exclude.has(id));
  const rng = createRng(`${seed}|${key}|${nonce}|tower-shop-pick`);
  const picked = pickUnique(filtered, Math.max(0, count - fixedIds.length), rng);
  return uniqueOfferIds([...fixedIds, ...picked]).slice(0, count);
}

function makeTowerShopPickWithBuckets(pool, count, seed, key, nonce, fixed = [], exclude = new Set(), buckets = []) {
  const picked = uniqueOfferIds(fixed).filter((id) => !exclude.has(id));

  buckets.forEach((bucket) => {
    const bucketFixed = uniqueOfferIds(bucket.fixedOfferIds || []).filter((id) => !exclude.has(id) && !picked.includes(id));
    bucketFixed.forEach((id) => picked.push(id));
    const need = Math.max(0, Number(bucket.pick || 0) - bucketFixed.length);
    if (!need) return;
    const ids = makeTowerShopPick(
      bucket.pool || [],
      need,
      seed,
      `${key}-${bucket.id}`,
      nonce + hash32(bucket.id),
      [],
      new Set([...exclude, ...picked]),
    );
    ids.forEach((id) => {
      if (!picked.includes(id)) picked.push(id);
    });
  });

  const need = Math.max(0, count - picked.length);
  if (need > 0) {
    const tail = makeTowerShopPick(pool, need, seed, `${key}-tail`, nonce, [], new Set([...exclude, ...picked]));
    tail.forEach((id) => {
      if (!picked.includes(id)) picked.push(id);
    });
  }

  if (picked.length < count) {
    return makeTowerShopPick(pool, count, seed, key, nonce, fixed, new Set());
  }

  return picked.slice(0, count);
}

function applyTowerShopPity(ids, pity, counter, exclude = new Set(), fixed = []) {
  if (!pity || Number(pity.trigger || 0) <= 0) return { ids, counter };
  const fixedSet = new Set(uniqueOfferIds(fixed));
  if ((pity.guaranteedOfferIds || []).some((id) => ids.includes(id))) return { ids, counter: 0 };

  const nextCounter = Number(counter || 0) + 1;
  if (nextCounter < Number(pity.trigger || 0)) return { ids, counter: nextCounter };

  const candidate = uniqueOfferIds(pity.guaranteedOfferIds || []).find((id) => !exclude.has(id));
  if (!candidate || ids.includes(candidate)) return { ids, counter: 0 };

  const next = ids.slice();
  let replaceIndex = -1;
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (!fixedSet.has(next[index])) {
      replaceIndex = index;
      break;
    }
  }
  next[replaceIndex >= 0 ? replaceIndex : Math.max(0, next.length - 1)] = candidate;
  return { ids: uniqueOfferIds(next).slice(0, ids.length), counter: 0 };
}

function normalizeTowerShopRotationForKeys(rotation, keys) {
  const source = rotation && typeof rotation === 'object' ? rotation : {};
  return {
    dailyKey: source.dailyKey === keys.dayKey ? source.dailyKey : keys.dayKey,
    dailyOfferIds: source.dailyKey === keys.dayKey ? uniqueOfferIds(source.dailyOfferIds || []) : [],
    dailyResetsUsed: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyResetsUsed || 0))) : 0,
    dailyNonce: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyNonce || 0))) : 0,
    dailyPityCounter: source.dailyKey === keys.dayKey ? Math.max(0, Math.floor(Number(source.dailyPityCounter || 0))) : 0,
    weeklyKey: source.weeklyKey === keys.weekKey ? source.weeklyKey : keys.weekKey,
    weeklyOfferIds: source.weeklyKey === keys.weekKey ? uniqueOfferIds(source.weeklyOfferIds || []) : [],
    weeklyResetsUsed: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyResetsUsed || 0))) : 0,
    weeklyNonce: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyNonce || 0))) : 0,
    weeklyPityCounter: source.weeklyKey === keys.weekKey ? Math.max(0, Math.floor(Number(source.weeklyPityCounter || 0))) : 0,
  };
}

function generateTowerShopPick(rotation, scope, seed, exclude = new Set()) {
  const isWeekly = scope === 'WEEKLY';
  const key = isWeekly ? rotation.weeklyKey : rotation.dailyKey;
  const nonce = isWeekly ? rotation.weeklyNonce : rotation.dailyNonce;
  const fixed = isWeekly ? TOWER_SHOP_ROTATION.weeklyFixedOfferIds : TOWER_SHOP_ROTATION.dailyFixedOfferIds;
  const pool = isWeekly ? TOWER_SHOP_ROTATION.weeklyPool : TOWER_SHOP_ROTATION.dailyPool;
  const pick = isWeekly ? TOWER_SHOP_ROTATION.weeklyPick : TOWER_SHOP_ROTATION.dailyPick;
  const buckets = isWeekly ? TOWER_SHOP_ROTATION.weeklyBuckets : TOWER_SHOP_ROTATION.dailyBuckets;
  const pity = isWeekly ? TOWER_SHOP_ROTATION.weeklyPity : TOWER_SHOP_ROTATION.dailyPity;
  const counter = isWeekly ? rotation.weeklyPityCounter : rotation.dailyPityCounter;
  const picked = makeTowerShopPickWithBuckets(pool, pick, seed, key, nonce, fixed, exclude, buckets);
  return applyTowerShopPity(picked, pity, counter, exclude, fixed);
}

function ensureTowerShopState(state, now = Date.now()) {
  const keys = getKstDateParts(now);
  const periodShop = ensureTowerShopPeriod(state.towerShop || {}, now);
  const seed = Number(periodShop.seed || 0) || hash32(`${state.runId || 'schale'}|tower-shop`);
  let rotation = normalizeTowerShopRotationForKeys(periodShop.rotation, keys);
  const avoidOverlap = Boolean(TOWER_SHOP_ROTATION.avoidCrossOverlap);
  const priority = TOWER_SHOP_ROTATION.crossOverlapPriority || 'WEEKLY';

  if (avoidOverlap && priority === 'DAILY') {
    if (!rotation.dailyOfferIds.length) {
      const daily = generateTowerShopPick(rotation, 'DAILY', seed);
      rotation = { ...rotation, dailyOfferIds: daily.ids, dailyPityCounter: daily.counter };
    }
    if (!rotation.weeklyOfferIds.length) {
      const weekly = generateTowerShopPick(rotation, 'WEEKLY', seed, new Set(rotation.dailyOfferIds));
      rotation = { ...rotation, weeklyOfferIds: weekly.ids, weeklyPityCounter: weekly.counter };
    }
  } else {
    if (!rotation.weeklyOfferIds.length) {
      const weekly = generateTowerShopPick(rotation, 'WEEKLY', seed);
      rotation = { ...rotation, weeklyOfferIds: weekly.ids, weeklyPityCounter: weekly.counter };
    }
    if (!rotation.dailyOfferIds.length) {
      const daily = generateTowerShopPick(rotation, 'DAILY', seed, avoidOverlap ? new Set(rotation.weeklyOfferIds) : new Set());
      rotation = { ...rotation, dailyOfferIds: daily.ids, dailyPityCounter: daily.counter };
    }
  }

  return {
    ...state,
    towerShop: {
      ...periodShop,
      seed,
      rotation,
    },
  };
}

function activeTowerShopOfferIdSet(towerShop) {
  const rotation = towerShop?.rotation || {};
  return new Set([...(rotation.dailyOfferIds || []), ...(rotation.weeklyOfferIds || [])]);
}

function towerShopPickupLabel(towerShop, offerId) {
  const rotation = towerShop?.rotation || {};
  const daily = (rotation.dailyOfferIds || []).includes(offerId);
  const weekly = (rotation.weeklyOfferIds || []).includes(offerId);
  if (daily && weekly) return '오늘+이번주 픽업';
  if (weekly) return '이번주 픽업';
  if (daily) return '오늘 픽업';
  return '비활성';
}

function getTowerShopBought(towerShop, offer) {
  const bucket = offer.limit?.period === 'WEEKLY' ? towerShop.weeklyBought : towerShop.dailyBought;
  return Number(bucket?.[offer.id] || 0);
}

function setTowerShopBought(towerShop, offer, value) {
  if (offer.limit?.period === 'WEEKLY') {
    return { ...towerShop, weeklyBought: { ...towerShop.weeklyBought, [offer.id]: value } };
  }
  return { ...towerShop, dailyBought: { ...towerShop.dailyBought, [offer.id]: value } };
}

function salvageValue(equip) {
  const rank = rarityRank(equip.rarity);
  const enhance = Number(equip.enhance || 0);
  return {
    scrap: 8 + rank * 8 + enhance * 4,
    stone: rank >= RARITY_RANK.RARE ? 1 + Math.floor(enhance / 3) : Math.floor(enhance / 4),
    ticket: rank >= RARITY_RANK.EPIC && enhance >= 6 ? 1 : 0,
  };
}

function isHighRiskSalvageEntry(entry) {
  return rarityRank(entry?.rarity) >= RARITY_RANK.RARE
    || Number(entry?.enhance || 0) >= 3
    || Number(entry?.score || 0) >= 120;
}

function isProtectedSalvageEntry(entry) {
  return Boolean(entry?.equipped || entry?.locked || entry?.favorite);
}

function salvageTargetRows(rows = [], candidateOnly = true) {
  return rows.filter((entry) => (
    !isProtectedSalvageEntry(entry)
    && (!candidateOnly || !isHighRiskSalvageEntry(entry))
  ));
}

function salvageTotals(rows = []) {
  return rows.reduce((sum, entry) => {
    const value = salvageValue(entry);
    return {
      scrap: sum.scrap + value.scrap,
      stone: sum.stone + value.stone,
      ticket: sum.ticket + value.ticket,
    };
  }, { scrap: 0, stone: 0, ticket: 0 });
}

function salvageRewardText(totals) {
  return `고철 ${totals.scrap}${totals.stone ? `, 강화석 ${totals.stone}` : ''}${totals.ticket ? `, 리롤권 ${totals.ticket}` : ''}`;
}

function normalizeSelectedSalvageUids(selectedUids = []) {
  if (!Array.isArray(selectedUids)) return new Set();
  return new Set(selectedUids.filter((uid) => typeof uid === 'string' && uid.trim()));
}

function removeEquipmentUids(equipmentInventory, uidSet) {
  return Object.fromEntries(Object.entries(equipmentInventory || {})
    .filter(([uid]) => !uidSet.has(uid)));
}

function makeSalvageEntry(equip, reason) {
  return {
    uid: equip.uid,
    itemId: equip.itemId,
    name: equip.name,
    rarity: equip.rarity,
    slot: equip.slot,
    enhance: Number(equip.enhance || 0),
    score: equipmentScore(equip),
    equip: cloneEquipmentInstance(equip),
    reason,
    createdAt: Date.now(),
  };
}

function queueSalvage(salvageQueue, equip, reason) {
  if (!equip) return salvageQueue;
  return [
    makeSalvageEntry(equip, reason),
    ...salvageQueue.filter((entry) => entry?.uid !== equip.uid),
  ].slice(0, MAX_SALVAGE_QUEUE);
}

function syncSalvageQueueEquipment(salvageQueue, equip) {
  return salvageQueue.map((entry) => (
    entry?.uid === equip.uid
      ? { ...makeSalvageEntry(equip, entry.reason), createdAt: entry.createdAt }
      : entry
  ));
}

function putEquipmentOrQueue(equipment, equipmentInventory, salvageQueue, equip, reason = '입수') {
  const oldUid = equipment[equip.slot];
  const old = oldUid ? equipmentInventory[oldUid] : null;
  const nextInventory = { ...equipmentInventory, [equip.uid]: equip };
  if (!old || equipmentScore(equip) >= equipmentScore(old)) {
    return {
      equipment: { ...equipment, [equip.slot]: equip.uid },
      equipmentInventory: nextInventory,
      salvageQueue: old ? queueSalvage(salvageQueue, old, '교체 장비') : salvageQueue,
      equipped: true,
    };
  }
  return {
    equipment,
    equipmentInventory: nextInventory,
    salvageQueue: queueSalvage(salvageQueue, equip, reason),
    equipped: false,
  };
}

function equipmentScore(equip) {
  const normalized = normalizeEquipmentInstance(equip);
  if (!normalized) return 0;
  const def = getItem(normalized.itemId);
  const stats = def?.equip || {};
  const enhance = Number(normalized.enhance || 0);
  const rolls = normalizeRolls(normalized.rolls);
  return Math.round(
    Number(stats.powerAdd || 0) * rolls.powerAddMul * (1 + enhance * 0.12)
    + ((Number(stats.powerMul || 1) * rolls.powerMulMul * (1 + enhance * 0.01)) - 1) * 900
    + ((Number(stats.staminaMul || 1) * rolls.staminaMulMul * (1 + enhance * 0.02)) - 1) * 450
    + enhance * 18
  );
}

function makeEquipment(itemId, enhance = 0, rng = createRng(`${itemId}|${Date.now()}`)) {
  const def = getItem(itemId);
  const slot = def?.equip?.slot || 'WEAPON';
  const rarity = def?.rarity || 'COMMON';
  const uidSeed = Math.floor(rng() * 1000000000).toString(36);
  const affixes = rollAffixes(rng, rarity, slot);
  return {
    uid: `${itemId}-${Date.now().toString(36)}-${uidSeed}`,
    itemId,
    name: def?.name || itemId,
    rarity,
    slot,
    enhance,
    rolls: computeRollsFromAffixes(affixes),
    affixes,
    rerollCount: 0,
  };
}

export function getEquippedList(state) {
  const current = normalizeState(state);
  return Object.values(current.equipment)
    .map((uid) => current.equipmentInventory?.[uid])
    .filter(Boolean)
    .sort((a, b) => slotLabel(a.slot).localeCompare(slotLabel(b.slot), 'ko-KR'));
}

export function getEquipmentByUid(state, uid) {
  const current = normalizeState(state);
  return uid ? current.equipmentInventory?.[uid] || null : null;
}

export function getEquippedEquipment(state, slot) {
  const current = normalizeState(state);
  const uid = slot ? current.equipment?.[slot] : '';
  return uid ? current.equipmentInventory?.[uid] || null : null;
}

function titleById(titleId) {
  return TITLES.find((title) => title.id === titleId) || null;
}

function getEquippedTitle(state) {
  const current = normalizeState(state);
  const title = titleById(current.equippedTitleId);
  if (!title || !current.unlockedTitleIds.includes(title.id)) return null;
  return title;
}

function rewardCreditMul(state) {
  const title = getEquippedTitle(state);
  return title?.kind === 'REWARD_MUL' ? Number(title.mul || 1) : 1;
}

function powerTitleMul(state) {
  const title = getEquippedTitle(state);
  return title?.kind === 'POWER_MUL' ? Number(title.mul || 1) : 1;
}

function achievementProgress(current, achievement) {
  if (achievement.action === 'MAX_FLOOR') return Number(current.maxClearedFloor || 0);
  if (achievement.action === 'MAX_TOWER') return Number(current.towerMaxCleared || 0);
  if (achievement.action === 'ENHANCED_EQUIP') {
    return getEquippedList(current).some((equip) => Number(equip.enhance || 0) >= achievement.target) ? 1 : 0;
  }
  return Number(current.lifetimeCounters?.[achievement.action] || 0);
}

export function achievementRows(state) {
  const current = normalizeState(state);
  return ACHIEVEMENTS.map((achievement) => {
    const target = achievement.action === 'ENHANCED_EQUIP' ? 1 : Number(achievement.target || 1);
    const rawProgress = achievementProgress(current, achievement);
    const progress = achievement.action === 'ENHANCED_EQUIP' ? rawProgress : Math.min(rawProgress, target);
    const done = rawProgress >= target;
    const claimed = Boolean(current.achievementClaims?.[achievement.id]);
    return {
      ...achievement,
      progress,
      target,
      done,
      claimed,
      canClaim: done && !claimed,
      titleName: achievement.unlockTitleId ? titleById(achievement.unlockTitleId)?.name || achievement.unlockTitleId : '',
    };
  });
}

export function titleRows(state) {
  const current = normalizeState(state);
  return TITLES.map((title) => ({
    ...title,
    unlocked: current.unlockedTitleIds.includes(title.id),
    equipped: current.unlockedTitleIds.includes(title.id) && current.equippedTitleId === title.id,
  }));
}

export function teamPower(state) {
  const current = normalizeState(state);
  let add = 0;
  let mul = 1;
  let staminaMul = 1;
  const upgrades = upgradeMultipliers(current.upgrades);
  getEquippedList(current).forEach((equip) => {
    const normalized = normalizeEquipmentInstance(equip);
    const stats = getItem(normalized.itemId)?.equip || {};
    const enhance = Number(normalized.enhance || 0);
    const rolls = normalizeRolls(normalized.rolls);
    add += Number(stats.powerAdd || 0) * rolls.powerAddMul * (1 + enhance * 0.12);
    mul *= Number(stats.powerMul || 1) * rolls.powerMulMul * (1 + enhance * 0.01);
    staminaMul *= Number(stats.staminaMul || 1) * rolls.staminaMulMul * (1 + enhance * 0.02);
  });
  const staminaFactor = clamp(0.62 + (Number(current.stamina || 0) / 100) * 0.5 * upgrades.staminaMul, 0.45, 1.2);
  return Math.round((Number(current.basePower || 0) + add) * mul * staminaFactor * staminaMul * powerTitleMul(current) * upgrades.powerMul);
}

function dutyDifficulty(floor) {
  const f = Math.max(1, Number(floor || 1));
  const bossMul = f % 20 === 0 ? 4 : f % 10 === 0 ? 2.5 : 1;
  return 100 * Math.pow(1.085, f - 1) * bossMul;
}

function towerDifficulty(floor) {
  const f = Math.max(1, Number(floor || 1));
  return TOWER.D0 * Math.pow(1 + TOWER.growth, f - 1) * TOWER.bossMul;
}

function winProb(power, difficulty, k = 1.6) {
  const ratio = power / (power + difficulty);
  return clamp(Math.pow(ratio, k), 0.04, 0.98);
}

function creditReward(floor) {
  return Math.round(10 * Math.pow(1.06, Math.max(1, floor) - 1));
}

function towerReward(floor) {
  return Math.round(TOWER.R0 * Math.pow(1 + TOWER.rewardGrowth, Math.max(1, floor) - 1));
}

function rollDrops(inventory, floor, rng) {
  let next = addItem(inventory, 'itm_scrap', 2 + Math.floor(floor / 8));
  if (rng() < 0.34) next = addItem(next, 'itm_bandage', 1);
  if (rng() < 0.22) next = addItem(next, 'itm_battery', 1);
  if (floor >= 20 && rng() < 0.13) next = addItem(next, 'itm_memory_chip', 1);
  if (floor >= 35 && rng() < 0.08) next = addItem(next, 'itm_alloy_plate', 1);
  if (floor % 10 === 0) next = addItem(next, 'itm_enhance_stone', 1);
  if (floor % 20 === 0) next = addItem(next, 'itm_tower_key', 1);
  return next;
}

function compressDutyHighlights(details, maxLines = 8) {
  const lines = [];
  let runStart = null;
  let runEnd = null;
  let runCredits = 0;
  const flush = () => {
    if (runStart == null || runEnd == null) return;
    lines.push(runStart === runEnd
      ? `F${runStart} 클리어 (+${Math.floor(runCredits)} Cr)`
      : `F${runStart}~F${runEnd} 클리어 (+${Math.floor(runCredits)} Cr)`);
    runStart = null;
    runEnd = null;
    runCredits = 0;
  };

  details.forEach((entry) => {
    if (entry.kind === 'FLOOR_CLEAR') {
      if (runStart == null) {
        runStart = entry.floor;
        runEnd = entry.floor;
        runCredits = Number(entry.creditsGained || 0);
      } else if (entry.floor === runEnd + 1) {
        runEnd = entry.floor;
        runCredits += Number(entry.creditsGained || 0);
      } else {
        flush();
        runStart = entry.floor;
        runEnd = entry.floor;
        runCredits = Number(entry.creditsGained || 0);
      }
      return;
    }
    flush();
    if (entry.kind === 'BOSS_RESULT') lines.push(`F${entry.floor} 보스전: ${entry.message}`);
    else if (entry.kind === 'LOOT') lines.push(`F${entry.floor} 전리품: ${entry.items.map((item) => `${itemName(item.itemId)}x${item.qty}`).join(', ')}`);
    else if (entry.kind === 'FAILED') lines.push(`F${entry.floor} 실패: ${entry.message}`);
  });
  flush();
  return lines.slice(0, maxLines);
}

function makeDutyReport({ fromFloor, toFloor, totalCreditsGained, stoppedReason, details }) {
  return {
    at: Date.now(),
    fromFloor,
    toFloor,
    totalCreditsGained: Math.round(totalCreditsGained),
    stoppedReason,
    highlights: compressDutyHighlights(details),
    details: details.slice(-40),
  };
}

export function resolveDutyAction(state, minutes = 60) {
  let next = normalizeState(state);
  const leader = getLeader(next);
  const rng = createRng(`${next.runId}|duty|${next.floor}|${next.counters.CLEAR_FLOOR}|${minutes}`);
  let seconds = Math.max(60, Number(minutes || 60) * 60);
  let cleared = 0;
  let credits = 0;
  let bosses = 0;
  let floor = Number(next.floor || 1);
  let inventory = next.inventory;
  let stamina = Number(next.stamina || 0);
  const fromFloor = floor;
  const details = [];
  const rewardMul = rewardCreditMul(next);
  const fatigueMul = 1 / upgradeMultipliers(next.upgrades).staminaMul;

  while (seconds > 0 && stamina > 8) {
    const power = teamPower({ ...next, floor, stamina, inventory });
    const difficulty = dutyDifficulty(floor);
    const probability = winProb(power, difficulty);
    const clearSec = clamp(Math.round(34 * Math.pow(difficulty / Math.max(power, 1), 0.7)), 8, 180);
    if (seconds < clearSec) break;
    seconds -= clearSec;
    if (rng() > probability) {
      details.push({ kind: 'FAILED', floor, message: leader.lines.fail });
      const failedState = addLifetimeCounters({
        ...next,
        floor,
        maxClearedFloor: Math.max(Number(next.maxClearedFloor || 0), floor - 1),
        credits: Math.round(Number(next.credits || 0) + credits),
        stamina: Math.max(0, Math.round(stamina - 6)),
        inventory,
        counters: {
          ...next.counters,
          CLEAR_FLOOR: Number(next.counters.CLEAR_FLOOR || 0) + cleared,
          KILL_BOSS: Number(next.counters.KILL_BOSS || 0) + bosses,
        },
        lastDutyReport: makeDutyReport({
          fromFloor,
          toFloor: Math.max(fromFloor, floor - 1),
          totalCreditsGained: credits,
          stoppedReason: 'FAILED',
          details,
        }),
      }, {
        CLEAR_FLOOR: cleared,
        KILL_BOSS: bosses,
        EARN_CREDITS: credits,
      });
      return addLog({
        ...failedState,
      }, `${floor}층 정산 실패. ${leader.lines.fail}`);
    }

    const reward = Math.round(creditReward(floor) * rewardMul);
    credits += reward;
    cleared += 1;
    details.push({ kind: 'FLOOR_CLEAR', floor, creditsGained: reward });
    if (floor % 10 === 0) {
      bosses += 1;
      details.push({ kind: 'BOSS_RESULT', floor, win: true, message: '보스 처치 성공', creditsGained: reward });
    }
    inventory = rollDrops(inventory, floor, rng);
    stamina = clamp(stamina - (floor % 10 === 0 ? 3.2 : 1.3) * fatigueMul, 0, 100);
    floor += 1;
  }

  next = addLifetimeCounters({
    ...next,
    floor,
    maxClearedFloor: Math.max(Number(next.maxClearedFloor || 0), floor - 1),
    credits: Math.round(Number(next.credits || 0) + credits),
    stamina: Math.round(stamina),
    inventory,
    counters: {
      ...next.counters,
      CLEAR_FLOOR: Number(next.counters.CLEAR_FLOOR || 0) + cleared,
      KILL_BOSS: Number(next.counters.KILL_BOSS || 0) + bosses,
    },
    lastDutyReport: makeDutyReport({
      fromFloor,
      toFloor: Math.max(fromFloor, floor - 1),
      totalCreditsGained: credits,
      stoppedReason: seconds <= 0 ? 'TIME_OUT' : 'NONE',
      details,
    }),
  }, {
    CLEAR_FLOOR: cleared,
    KILL_BOSS: bosses,
    EARN_CREDITS: credits,
  });
  return addLog(next, `${minutes}분 방치 정산: ${cleared}층 클리어, +${Math.round(credits)} Cr, 보스 ${bosses}회. ${cleared ? leader.lines.clear : '추가 클리어는 없었습니다.'}`);
}

function parseSavedAt(value, fallback = Date.now()) {
  const raw = typeof value === 'number' ? value : new Date(value || '').getTime();
  return Number.isFinite(raw) ? raw : fallback;
}

export function applyOfflineProgressAction(state, nowMs = Date.now()) {
  const current = normalizeState(state);
  const lastMs = parseSavedAt(current.lastSavedAt || current.updatedAt || current.startedAt, nowMs);
  const deltaMs = Math.max(0, Math.min(OFFLINE_CAP_MS, nowMs - lastMs));
  const waves = Math.floor(deltaMs / OFFLINE_WAVE_MS);
  const nowIso = new Date(nowMs).toISOString();
  if (waves <= 0) {
    return {
      ...current,
      lastSavedAt: nowIso,
      updatedAt: nowIso,
      offlineLastSummary: null,
    };
  }

  const floorBase = Math.max(1, Math.floor(Number(current.towerMaxCleared || current.maxClearedFloor || current.floor || 1)));
  const creditsPerWave = Math.round((15 + floorBase * 2) * rewardCreditMul(current));
  const creditsGained = waves * creditsPerWave;
  const tokensGained = Math.floor(waves / 10);
  const next = addLifetimeCounters({
    ...current,
    credits: Math.round(Number(current.credits || 0) + creditsGained),
    inventory: addItem(current.inventory, 'itm_tower_token', tokensGained),
    lastSavedAt: nowIso,
    updatedAt: nowIso,
    offlineLastSummary: {
      at: nowIso,
      deltaMs,
      waves,
      creditsGained,
      tokensGained,
      capped: nowMs - lastMs > OFFLINE_CAP_MS,
    },
  }, {
    EARN_CREDITS: creditsGained,
  });

  const minutes = Math.floor(deltaMs / 60000);
  return addLog(next, `오프라인 진행: ${minutes}분 / ${waves}웨이브 보상, +${creditsGained} Cr, 시련 토큰 +${tokensGained}`);
}

export function restAction(state) {
  const current = normalizeState(state);
  const recovery = Math.round(35 * upgradeMultipliers(current.upgrades).staminaMul);
  return addLog({
    ...current,
    stamina: clamp(Number(current.stamina || 0) + recovery, 0, 100),
  }, `재정비로 스태미나를 ${recovery} 회복했습니다.`);
}

export function applyUpgradeAction(state, upgradeId) {
  const current = normalizeState(state);
  const def = UPGRADE_DEFS.find((upgrade) => upgrade.id === upgradeId);
  if (!def) return addLog(current, '연구 항목을 찾을 수 없습니다.');
  const level = Math.max(0, Math.floor(Number(current.upgrades[def.id] || 0)));
  const cost = upgradeCost(def.id, level + 1);
  if (Number(current.credits || 0) < cost.credits) return addLog(current, `${def.name} 연구 실패. 크레딧이 부족합니다.`);
  if (!hasItems(current.inventory, cost.items)) return addLog(current, `${def.name} 연구 실패. 필요한 재료가 부족합니다.`);

  const next = addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - cost.credits,
    inventory: spendItems(current.inventory, cost.items),
    upgrades: {
      ...current.upgrades,
      [def.id]: level + 1,
    },
    counters: bumpCounter(current.counters, 'UPGRADE', 1),
  }, { UPGRADE: 1 });

  return addLog(next, `${def.name} Lv.${level} -> Lv.${level + 1} 연구 완료. 전투력이 상승했습니다.`);
}

export function craftRecipeAction(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  if (Number(current.credits || 0) < recipe.credits) return addLog(current, `${recipe.name} 실패. 크레딧이 부족합니다.`);
  if (!hasItems(current.inventory, recipe.requires)) return addLog(current, `${recipe.name} 실패. 필요한 재료가 부족합니다.`);

  const produced = getItem(recipe.produces.itemId);
  let equipment = current.equipment;
  let equipmentInventory = current.equipmentInventory;
  let salvageQueue = current.salvageQueue;
  let inventory = spendItems(current.inventory, recipe.requires);
  let equipmentChanged = false;
  let message = `${recipe.name} 완료.`;
  if (produced?.equip) {
    const rng = createRng(`${current.runId}|craft|${recipe.id}|${current.counters.CRAFT}`);
    const equip = makeEquipment(produced.id, 0, rng);
    const result = putEquipmentOrQueue(equipment, equipmentInventory, salvageQueue, equip, '제작 초과분');
    equipment = result.equipment;
    equipmentInventory = result.equipmentInventory;
    salvageQueue = result.salvageQueue;
    equipmentChanged = result.equipped;
    message = result.equipped
      ? `${recipe.name} 완료. 장착: ${produced.name}`
      : `${recipe.name} 완료. 기존 장비보다 약해 보관함으로 이동: ${produced.name}`;
  } else {
    inventory = addItem(inventory, recipe.produces.itemId, recipe.produces.qty);
  }

  return addLog(addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - recipe.credits,
    inventory,
    equipment,
    equipmentInventory,
    salvageQueue,
    activePresetId: equipmentChanged ? '' : current.activePresetId,
    counters: bumpCounter(current.counters, 'CRAFT', 1),
  }, { CRAFT: 1 }), message);
}

export function getEnhanceRule(equipment) {
  const itemId = typeof equipment === 'string' ? equipment : equipment?.itemId;
  const rarity = typeof equipment === 'object' ? equipment?.rarity : getItem(itemId)?.rarity;
  return ENHANCE_RULE_LOOKUP[itemId] || {
    itemId,
    maxLevel: 10,
    baseCredit: rarity === 'EPIC' ? 160 : rarity === 'RARE' ? 125 : 85,
    creditGrowth: rarity === 'EPIC' ? 1.2 : 1.18,
    requiresPerTry: { itm_enhance_stone: rarity === 'EPIC' ? 2 : 1 },
    scrapPerLevel: rarity === 'EPIC' ? 10 : rarity === 'RARE' ? 8 : 6,
    successBase: rarity === 'EPIC' ? 0.8 : rarity === 'RARE' ? 0.86 : 0.9,
    successDecay: rarity === 'EPIC' ? 0.03 : 0.02,
    failPenalty: 'DOWNGRADE_1',
    pityPerFail: 0.03,
    pityMaxBonus: 0.18,
    hardPityAt: 10,
  };
}

export function calcEnhanceCost(rule, nextLevel) {
  const level = Math.max(1, Math.floor(Number(nextLevel || 1)));
  const items = { ...(rule.requiresPerTry || {}) };
  if (Number(rule.scrapPerLevel || 0) > 0) {
    items.itm_scrap = Number(items.itm_scrap || 0) + Number(rule.scrapPerLevel || 0) * level;
  }
  return {
    credits: Math.floor(Number(rule.baseCredit || 0) * Math.pow(Number(rule.creditGrowth || 1), level - 1)),
    items,
  };
}

export function calcEnhanceBaseChance(rule, currentLevel) {
  return clamp(
    Number(rule.successBase || 0) - Number(rule.successDecay || 0) * Math.max(0, Number(currentLevel || 0)),
    0.35,
    0.95,
  );
}

export function calcEnhancePityBonus(rule, failStreak) {
  return clamp(
    Number(rule.pityPerFail ?? 0.03) * Math.max(0, Math.floor(Number(failStreak || 0))),
    0,
    Number(rule.pityMaxBonus ?? 0.18),
  );
}

export function calcEnhanceSuccessChance(rule, currentLevel, failStreak) {
  return clamp(
    calcEnhanceBaseChance(rule, currentLevel) + calcEnhancePityBonus(rule, failStreak),
    0.35,
    0.99,
  );
}

export function pickEnhanceProtectionItem(penalty, inventory = {}, preference = 'AUTO') {
  const normalizedPreference = normalizeEnhanceProtectionPreference(preference);
  const has = (itemId) => Number(inventory?.[itemId] || 0) > 0;
  if (normalizedPreference === 'ALL_ONLY') return has('itm_protect_ticket') ? 'itm_protect_ticket' : '';
  if (normalizedPreference === 'DOWNGRADE_ONLY') {
    if (penalty !== 'DOWNGRADE_1') return '';
    if (has('itm_protect_charm')) return 'itm_protect_charm';
    return has('itm_protect_downgrade') ? 'itm_protect_downgrade' : '';
  }
  if (normalizedPreference === 'DESTROY_ONLY') {
    return penalty === 'DESTROY' && has('itm_protect_destroy') ? 'itm_protect_destroy' : '';
  }
  if (penalty === 'DOWNGRADE_1') {
    return ['itm_protect_charm', 'itm_protect_downgrade', 'itm_protect_ticket'].find(has) || '';
  }
  if (penalty === 'DESTROY') {
    return ['itm_protect_destroy', 'itm_protect_ticket'].find(has) || '';
  }
  return '';
}

function buildEnhancePlan(current, slot) {
  const uid = current.equipment?.[slot] || '';
  const equipment = uid ? current.equipmentInventory?.[uid] || null : null;
  if (!equipment) {
    return {
      slot,
      uid: '',
      equipment: null,
      materialRows: [],
      protectionRows: ENHANCE_PROTECTION_ITEM_IDS.map((itemId) => ({
        itemId,
        name: itemName(itemId),
        current: Number(current.inventory?.[itemId] || 0),
        selected: false,
      })),
      canAttempt: false,
      shortageText: '강화할 장비가 없습니다.',
    };
  }

  const rule = getEnhanceRule(equipment);
  const level = Math.max(0, Math.floor(Number(equipment.enhance || 0)));
  const nextLevel = level + 1;
  const maxLevel = Math.max(1, Math.floor(Number(rule.maxLevel || 10)));
  const failStreak = Math.max(0, Math.floor(Number(current.enhanceFailStreakByUid?.[uid] || 0)));
  const hardPityAt = Math.max(1, Math.floor(Number(rule.hardPityAt ?? 10)));
  const guaranteed = failStreak >= hardPityAt;
  const baseChance = calcEnhanceBaseChance(rule, level);
  const pityBonus = calcEnhancePityBonus(rule, failStreak);
  const rolledChance = calcEnhanceSuccessChance(rule, level, failStreak);
  const successChance = guaranteed ? 1 : rolledChance;
  const cost = calcEnhanceCost(rule, nextLevel);
  const materialRows = Object.entries(cost.items).map(([itemId, required]) => {
    const currentQty = Number(current.inventory?.[itemId] || 0);
    return {
      itemId,
      name: itemName(itemId),
      current: currentQty,
      required: Number(required || 0),
      met: currentQty >= Number(required || 0),
    };
  });
  const creditReady = Number(current.credits || 0) >= cost.credits;
  const materialsReady = materialRows.every((row) => row.met);
  const atMax = level >= maxLevel;
  const penalty = rule.failPenalty || 'DOWNGRADE_1';
  const protectionItemId = current.autoUseProtectionTicket && penalty !== 'NONE'
    ? pickEnhanceProtectionItem(penalty, current.inventory, current.protectionPreference)
    : '';
  const shortageParts = [];
  if (atMax) shortageParts.push('최대 강화 단계');
  if (!creditReady) shortageParts.push(`크레딧 ${Math.max(0, cost.credits - Number(current.credits || 0)).toLocaleString('ko-KR')} Cr`);
  materialRows.filter((row) => !row.met).forEach((row) => {
    shortageParts.push(`${row.name} ${Math.max(0, row.required - row.current)}개`);
  });

  return {
    slot,
    uid,
    equipment,
    rule,
    level,
    nextLevel,
    maxLevel,
    atMax,
    failStreak,
    hardPityAt,
    hardPityRemaining: guaranteed ? 0 : Math.max(0, hardPityAt - failStreak),
    guaranteed,
    baseChance,
    baseChancePct: Math.round(baseChance * 1000) / 10,
    pityBonus,
    pityBonusPct: Math.round(pityBonus * 1000) / 10,
    successChance,
    successChancePct: Math.round(successChance * 1000) / 10,
    penalty,
    penaltyLabel: ENHANCE_PENALTY_LABELS[penalty] || penalty,
    creditCost: cost.credits,
    creditReady,
    materialRows,
    materialsReady,
    protectionItemId,
    protectionItemName: protectionItemId ? itemName(protectionItemId) : '',
    protectionRows: ENHANCE_PROTECTION_ITEM_IDS.map((itemId) => ({
      itemId,
      name: itemName(itemId),
      current: Number(current.inventory?.[itemId] || 0),
      selected: itemId === protectionItemId,
    })),
    canAttempt: !atMax && creditReady && materialsReady,
    shortageText: shortageParts.join(', ') || '강화 가능',
  };
}

export function enhancePlanForSlot(state, slot) {
  return buildEnhancePlan(normalizeState(state), slot);
}

export function setEnhanceSettingsAction(state, patch = {}) {
  const current = normalizeState(state);
  return {
    ...current,
    autoUseProtectionTicket: Object.hasOwn(patch, 'autoUseProtectionTicket')
      ? Boolean(patch.autoUseProtectionTicket)
      : current.autoUseProtectionTicket,
    protectionPreference: Object.hasOwn(patch, 'protectionPreference')
      ? normalizeEnhanceProtectionPreference(patch.protectionPreference)
      : current.protectionPreference,
    pityPolicyOnProtection: Object.hasOwn(patch, 'pityPolicyOnProtection')
      ? normalizeEnhancePityPolicy(patch.pityPolicyOnProtection)
      : current.pityPolicyOnProtection,
  };
}

function applyEnhanceProtectionPityPolicy(failMap, uid, previousStreak, policy) {
  if (policy === 'RESET') {
    delete failMap[uid];
    return 0;
  }
  if (policy === 'DECAY_1') {
    const nextStreak = Math.max(0, previousStreak - 1);
    if (nextStreak > 0) failMap[uid] = nextStreak;
    else delete failMap[uid];
    return nextStreak;
  }
  const nextStreak = previousStreak + 1;
  failMap[uid] = nextStreak;
  return nextStreak;
}

function removeEquipmentUidFromPresets(presets, uid) {
  return normalizeEquipmentPresets(presets).map((preset) => ({
    ...preset,
    equipment: Object.fromEntries(Object.entries(preset.equipment || {}).filter(([, savedUid]) => savedUid !== uid)),
  }));
}

export function enhanceEquipmentAction(state, slot) {
  const current = normalizeState(state);
  const plan = buildEnhancePlan(current, slot);
  const equip = plan.equipment;
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 강화할 장비가 없습니다.`);
  if (plan.atMax) return addLog(current, `${equip.name}은 +${plan.maxLevel} 최대 강화 단계입니다.`);
  if (!plan.canAttempt) return addLog(current, `강화 실패. 부족: ${plan.shortageText}.`);

  const attemptId = Number(current.counters.ENHANCE_TRY || 0) + 1;
  const rng = createRng(`${current.runId}|enhance|${plan.uid}|${plan.level}|${current.counters.ENHANCE_TRY}`);
  const success = plan.guaranteed || rng() < plan.successChance;
  let inventory = spendItems(current.inventory, Object.fromEntries(plan.materialRows.map((row) => [row.itemId, row.required])));
  const failMap = { ...current.enhanceFailStreakByUid };
  const counters = {
    ...bumpCounter(current.counters, 'ENHANCE_TRY', 1),
    ENHANCE_SUCCESS: Number(current.counters.ENHANCE_SUCCESS || 0) + (success ? 1 : 0),
  };
  const baseResult = {
    attemptId,
    uid: plan.uid,
    itemId: equip.itemId,
    slot,
    fromLevel: plan.level,
    chancePct: plan.successChancePct,
    baseChancePct: plan.baseChancePct,
    pityBonusPct: plan.pityBonusPct,
    failStreakBefore: plan.failStreak,
    penalty: plan.penalty,
    protectionItemId: '',
    guaranteed: plan.guaranteed,
  };
  const chanceText = `성공률 ${plan.successChancePct}% (기본 ${plan.baseChancePct}% + 누적 ${plan.pityBonusPct}%p)`;

  if (success) {
    delete failMap[plan.uid];
    const nextEquip = { ...equip, enhance: plan.nextLevel };
    const outcome = plan.guaranteed ? 'pity_success' : 'success';
    const message = plan.guaranteed
      ? `${equip.name} +${plan.level} 강화 성공. 하드 천장 발동으로 +${plan.nextLevel} 달성. ${chanceText}`
      : `${equip.name} +${plan.level} 강화 성공. +${plan.nextLevel} 달성. ${chanceText}`;
    return addLog(addLifetimeCounters({
      ...current,
      credits: Number(current.credits || 0) - plan.creditCost,
      inventory,
      equipmentInventory: { ...current.equipmentInventory, [plan.uid]: nextEquip },
      enhanceFailStreakByUid: failMap,
      lastEnhanceResult: {
        ...baseResult,
        toLevel: plan.nextLevel,
        outcome,
        failStreakAfter: 0,
      },
      counters,
    }, { ENHANCE_TRY: 1, ENHANCE_SUCCESS: 1 }), message);
  }

  const protectionItemId = current.autoUseProtectionTicket
    ? pickEnhanceProtectionItem(plan.penalty, inventory, current.protectionPreference)
    : '';
  if (protectionItemId) {
    inventory = addItem(inventory, protectionItemId, -1);
    const failStreakAfter = applyEnhanceProtectionPityPolicy(
      failMap,
      plan.uid,
      plan.failStreak,
      current.pityPolicyOnProtection,
    );
    return addLog(addLifetimeCounters({
      ...current,
      credits: Number(current.credits || 0) - plan.creditCost,
      inventory,
      enhanceFailStreakByUid: failMap,
      lastEnhanceResult: {
        ...baseResult,
        toLevel: plan.level,
        outcome: 'protected',
        protectionItemId,
        failStreakAfter,
      },
      counters,
    }, { ENHANCE_TRY: 1 }), `${equip.name} +${plan.level} 강화 실패. ${itemName(protectionItemId)} 사용으로 ${plan.penaltyLabel} 패널티 방지. +${plan.level} 유지. ${chanceText}`);
  }

  if (plan.penalty === 'DESTROY') {
    delete failMap[plan.uid];
    const equipmentInventory = { ...current.equipmentInventory };
    delete equipmentInventory[plan.uid];
    const equipment = Object.fromEntries(Object.entries(current.equipment).filter(([, uid]) => uid !== plan.uid));
    return addLog(addLifetimeCounters({
      ...current,
      credits: Number(current.credits || 0) - plan.creditCost,
      inventory,
      equipment,
      equipmentInventory,
      equipmentPresets: removeEquipmentUidFromPresets(current.equipmentPresets, plan.uid),
      activePresetId: '',
      salvageQueue: current.salvageQueue.filter((entry) => entry.uid !== plan.uid),
      enhanceFailStreakByUid: failMap,
      lastEnhanceResult: {
        ...baseResult,
        toLevel: null,
        outcome: 'destroyed',
        failStreakAfter: 0,
      },
      counters,
    }, { ENHANCE_TRY: 1 }), `${equip.name} +${plan.level} 강화 실패. 장비 파괴. ${chanceText}`);
  }

  const nextLevel = plan.penalty === 'DOWNGRADE_1' ? Math.max(0, plan.level - 1) : plan.level;
  const outcome = nextLevel < plan.level ? 'downgrade' : 'failed_stable';
  const failStreakAfter = plan.failStreak + 1;
  failMap[plan.uid] = failStreakAfter;
  const nextEquip = { ...equip, enhance: nextLevel };
  const message = outcome === 'downgrade'
    ? `${equip.name} +${plan.level} 강화 실패. 실패 패널티로 +${nextLevel}까지 하락. ${chanceText}`
    : `${equip.name} +${plan.level} 강화 실패. 강화 수치 유지. ${chanceText}`;
  return addLog(addLifetimeCounters({
    ...current,
    credits: Number(current.credits || 0) - plan.creditCost,
    inventory,
    equipmentInventory: { ...current.equipmentInventory, [plan.uid]: nextEquip },
    enhanceFailStreakByUid: failMap,
    lastEnhanceResult: {
      ...baseResult,
      toLevel: nextLevel,
      outcome,
      failStreakAfter,
    },
    counters,
  }, { ENHANCE_TRY: 1 }), message);
}

export function rerollEquipmentAction(state, slot) {
  const current = normalizeState(state);
  const uid = current.equipment[slot];
  const equip = uid ? current.equipmentInventory[uid] : null;
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 재련할 장비가 없습니다.`);

  const lockedAffixes = Array.isArray(equip.affixes) ? equip.affixes.filter((affix) => affix.locked) : [];
  const ticketCost = 1 + lockedAffixes.length;
  const tokenCost = 12 + lockedAffixes.length * 8 + Number(equip.rerollCount || 0) * 2;
  let inventory = current.inventory;
  let costText = '';
  if (Number(inventory.itm_reroll_ticket || 0) >= ticketCost) {
    inventory = addItem(inventory, 'itm_reroll_ticket', -ticketCost);
    costText = `리롤권 ${ticketCost}장`;
  } else if (Number(inventory.itm_tower_token || 0) >= tokenCost) {
    inventory = addItem(inventory, 'itm_tower_token', -tokenCost);
    costText = `시련 토큰 ${tokenCost}개`;
  } else {
    return addLog(current, `옵션 재련 실패. 리롤권 ${ticketCost}장 또는 시련 토큰 ${tokenCost}개가 필요합니다.`);
  }

  const rng = createRng(`${current.runId}|reroll|${slot}|${equip.rerollCount}|${current.counters.REROLL}`);
  const affixes = rollAffixes(rng, equip.rarity, equip.slot, lockedAffixes);
  const nextEquip = {
    ...equip,
    affixes,
    rolls: computeRollsFromAffixes(affixes),
    rerollCount: Number(equip.rerollCount || 0) + 1,
    lastRerolledAt: new Date().toISOString(),
  };
  return addLog({
    ...current,
    inventory,
    equipmentInventory: { ...current.equipmentInventory, [uid]: nextEquip },
    counters: bumpCounter(current.counters, 'REROLL', 1),
  }, `${equip.name} 옵션 재련 완료(${costText}): ${affixes.map((affix) => `${affix.label} x${affix.value}`).join(', ')}`);
}

export function toggleEquipmentAffixLockAction(state, slot, affixId) {
  const current = normalizeState(state);
  const uid = current.equipment[slot];
  const equip = uid ? current.equipmentInventory[uid] : null;
  if (!equip) return addLog(current, `${slotLabel(slot)} 슬롯에 장비가 없습니다.`);

  const affixes = Array.isArray(equip.affixes) ? equip.affixes : [];
  if (!affixes.length) return addLog(current, `${equip.name}에는 잠글 옵션이 없습니다.`);

  let changed = false;
  const nextAffixes = affixes.map((affix) => {
    if (affix.id !== affixId) return affix;
    changed = true;
    return { ...affix, locked: !affix.locked };
  });
  if (!changed) return addLog(current, '옵션 라인을 찾을 수 없습니다.');

  const nextEquip = {
    ...equip,
    affixes: nextAffixes,
    rolls: computeRollsFromAffixes(nextAffixes),
  };
  const target = nextAffixes.find((affix) => affix.id === affixId);

  return addLog({
    ...current,
    equipmentInventory: { ...current.equipmentInventory, [uid]: nextEquip },
  }, `${equip.name} 옵션 ${target?.label || affixId} ${target?.locked ? '잠금' : '해제'}`);
}

export function equipEquipmentAction(state, uid) {
  const current = normalizeState(state);
  const equip = current.equipmentInventory?.[uid];
  if (!equip) return addLog(current, '장착할 장비를 보관함에서 찾을 수 없습니다.');
  const slot = equip.slot;
  if (!SLOT_LABELS[slot]) return addLog(current, '장착 슬롯이 올바르지 않습니다.');
  if (current.equipment?.[slot] === uid) return addLog(current, `이미 장착 중인 장비입니다: ${equip.name}`);

  const previousUid = current.equipment?.[slot];
  const previous = previousUid ? current.equipmentInventory?.[previousUid] : null;
  let salvageQueue = current.salvageQueue.filter((entry) => entry?.uid !== uid);
  if (previous) salvageQueue = queueSalvage(salvageQueue, previous, '수동 교체 장비');

  return addLog({
    ...current,
    equipment: { ...current.equipment, [slot]: uid },
    salvageQueue,
    activePresetId: '',
    counters: bumpCounter(current.counters, 'EQUIP', 1),
  }, `${slotLabel(slot)} 장착: ${equip.name}${previous ? ` / 이전 장비: ${previous.name}` : ''}`);
}

export function toggleEquipmentProtectionAction(state, uid, kind = 'locked') {
  const current = normalizeState(state);
  const equip = current.equipmentInventory?.[uid];
  if (!equip) return addLog(current, '보호 설정할 장비를 보관함에서 찾을 수 없습니다.');
  const key = kind === 'favorite' ? 'favorite' : 'locked';
  const counterKey = key === 'favorite' ? 'EQUIP_FAVORITE' : 'EQUIP_LOCK';
  const nextEquip = { ...equip, [key]: !equip[key] };
  return addLog({
    ...current,
    equipmentInventory: { ...current.equipmentInventory, [uid]: nextEquip },
    salvageQueue: syncSalvageQueueEquipment(current.salvageQueue, nextEquip),
    counters: bumpCounter(current.counters, counterKey, 1),
  }, `${equip.name} ${key === 'favorite' ? '즐겨찾기' : '잠금'} ${nextEquip[key] ? 'ON' : 'OFF'}`);
}

export function autoSalvageAction(state) {
  const current = normalizeState(state);
  const queue = Array.isArray(current.salvageQueue) ? current.salvageQueue : [];
  if (!queue.length) return addLog(current, '자동 분해할 장비가 없습니다.');
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const targetQueue = salvageTargetRows(salvageRows(current), candidateOnly);
  const targetUids = new Set(targetQueue.map((entry) => entry.uid));
  const remainingQueue = queue.filter((entry) => !targetUids.has(entry.uid));
  if (!targetQueue.length) return addLog(current, candidateOnly
    ? '후보만 분해 ON 상태에서 실행할 안전 후보가 없습니다. 위험 후보까지 확인하려면 후보만 분해를 끄세요.'
    : '잠금 또는 즐겨찾기로 보호된 장비만 남아 분해하지 않았습니다.');

  let inventory = current.inventory;
  const totals = salvageTotals(targetQueue);

  inventory = addItem(inventory, 'itm_scrap', totals.scrap);
  if (totals.stone > 0) inventory = addItem(inventory, 'itm_enhance_stone', totals.stone);
  if (totals.ticket > 0) inventory = addItem(inventory, 'itm_reroll_ticket', totals.ticket);

  return addLog({
    ...current,
    inventory,
    equipmentInventory: removeEquipmentUids(current.equipmentInventory, targetUids),
    salvageQueue: remainingQueue,
    counters: bumpCounter(current.counters, 'SALVAGE', targetQueue.length),
  }, `자동 분해 ${targetQueue.length}개 완료. 고철 +${totals.scrap}, 강화석 +${totals.stone}, 리롤권 +${totals.ticket}${remainingQueue.length ? ` / 보호로 ${remainingQueue.length}개 유지` : ''}`);
}

export function salvageSelectedAction(state, selectedUids = []) {
  const current = normalizeState(state);
  const queue = Array.isArray(current.salvageQueue) ? current.salvageQueue : [];
  const selectedUidSet = normalizeSelectedSalvageUids(selectedUids);
  if (!selectedUidSet.size) return addLog(current, '선택 분해할 장비를 먼저 고르세요.');

  const selectedQueue = salvageRows(current).filter((entry) => selectedUidSet.has(entry.uid));
  if (!selectedQueue.length) return addLog(current, '선택한 장비가 분해 대기열에 없습니다.');

  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const targetQueue = salvageTargetRows(selectedQueue, candidateOnly);
  if (!targetQueue.length) {
    return addLog(current, candidateOnly
      ? '후보만 분해 ON 상태라 선택한 장비가 모두 보호되었습니다.'
      : '선택한 장비 중 실행할 분해 후보가 없습니다.');
  }

  const targetUids = new Set(targetQueue.map((entry) => entry.uid));
  const remainingQueue = queue.filter((entry) => !targetUids.has(entry.uid));
  let inventory = current.inventory;
  const totals = salvageTotals(targetQueue);

  inventory = addItem(inventory, 'itm_scrap', totals.scrap);
  if (totals.stone > 0) inventory = addItem(inventory, 'itm_enhance_stone', totals.stone);
  if (totals.ticket > 0) inventory = addItem(inventory, 'itm_reroll_ticket', totals.ticket);

  const protectedCount = selectedQueue.length - targetQueue.length;
  return addLog({
    ...current,
    inventory,
    equipmentInventory: removeEquipmentUids(current.equipmentInventory, targetUids),
    salvageQueue: remainingQueue,
    counters: bumpCounter(current.counters, 'SALVAGE', targetQueue.length),
  }, `선택 분해 ${targetQueue.length}개 완료. 고철 +${totals.scrap}, 강화석 +${totals.stone}, 리롤권 +${totals.ticket}${protectedCount ? ` / 후보 보호 ${protectedCount}개` : ''}`);
}

export function setSalvageCandidateOnlyAction(state, enabled) {
  const current = normalizeState(state);
  const candidateOnly = enabled !== false;
  return addLog({
    ...current,
    salvageSettings: {
      ...current.salvageSettings,
      candidateOnly,
    },
  }, candidateOnly
    ? '후보만 분해를 켰습니다. 위험 후보와 잠금·즐겨찾기 장비를 보호합니다.'
    : '후보만 분해를 껐습니다. 잠금·즐겨찾기 장비를 제외한 대기열을 처리합니다.');
}

function grantTowerShopReward(current, offer, rng) {
  let equipment = current.equipment;
  let equipmentInventory = current.equipmentInventory;
  let salvageQueue = current.salvageQueue;
  let inventory = current.inventory;
  let equipmentChanged = false;
  const reward = offer.reward;
  let label = '';

  if (reward.type === 'STACK') {
    inventory = addItem(inventory, reward.itemId, reward.qty);
    label = `${itemName(reward.itemId)} ${reward.qty}개`;
  }

  if (reward.type === 'EQUIP') {
    for (let index = 0; index < Math.max(1, Number(reward.qty || 1)); index += 1) {
      const equip = makeEquipment(reward.itemId, 0, rng);
      const result = putEquipmentOrQueue(equipment, equipmentInventory, salvageQueue, equip, '상점 초과분');
      equipment = result.equipment;
      equipmentInventory = result.equipmentInventory;
      salvageQueue = result.salvageQueue;
      equipmentChanged = equipmentChanged || result.equipped;
      label = `${equip.name}${result.equipped ? ' 장착' : ' 분해 대기'}`;
    }
  }

  if (reward.type === 'RANDOM_EQUIP') {
    const pool = Array.isArray(reward.pool) && reward.pool.length ? reward.pool : ['eq_tower_relic_alpha'];
    for (let index = 0; index < Math.max(1, Number(reward.qty || 1)); index += 1) {
      const itemId = pool[Math.floor(rng() * pool.length)];
      const equip = makeEquipment(itemId, 0, rng);
      const result = putEquipmentOrQueue(equipment, equipmentInventory, salvageQueue, equip, '상점 초과분');
      equipment = result.equipment;
      equipmentInventory = result.equipmentInventory;
      salvageQueue = result.salvageQueue;
      equipmentChanged = equipmentChanged || result.equipped;
      label = `${equip.name}${result.equipped ? ' 장착' : ' 분해 대기'}`;
    }
  }

  return { equipment, equipmentInventory, salvageQueue, inventory, label, equipmentChanged };
}

export function buyTowerShopOfferAction(state, offerId) {
  const current = ensureTowerShopState(normalizeState(state));
  const offer = TOWER_SHOP_OFFERS.find((item) => item.id === offerId);
  if (!offer) return addLog(current, '타워 상점 상품을 찾을 수 없습니다.');
  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  if (!activeIds.has(offer.id)) return addLog(current, `${offer.name}은 현재 픽업 상품이 아닙니다.`);
  const bought = getTowerShopBought(towerShop, offer);
  const max = Number(offer.limit?.max || 999);
  if (bought >= max) return addLog(current, `${offer.name} 구매 제한에 도달했습니다.`);
  if (Number(current.inventory[offer.cost.itemId] || 0) < offer.cost.qty) return addLog(current, `${offer.name} 구매 실패. ${itemName(offer.cost.itemId)}이 부족합니다.`);

  const rng = createRng(`${current.runId}|tower-shop|${offer.id}|${bought}|${current.counters.SHOP_BUY}`);
  const paid = addItem(current.inventory, offer.cost.itemId, -offer.cost.qty);
  const granted = grantTowerShopReward({ ...current, inventory: paid }, offer, rng);
  return addLog({
    ...current,
    inventory: granted.inventory,
    equipment: granted.equipment,
    equipmentInventory: granted.equipmentInventory,
    salvageQueue: granted.salvageQueue,
    activePresetId: granted.equipmentChanged ? '' : current.activePresetId,
    towerShop: setTowerShopBought(towerShop, offer, bought + 1),
    counters: bumpCounter(current.counters, 'SHOP_BUY', 1),
  }, `${offer.name} 구매 완료. ${granted.label}`);
}

export function buyTowerShopOfferMaxAction(state, offerId) {
  const current = ensureTowerShopState(normalizeState(state));
  const offer = TOWER_SHOP_OFFERS.find((item) => item.id === offerId);
  if (!offer) return addLog(current, '대상 상점 상품을 찾을 수 없습니다.');

  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  if (!activeIds.has(offer.id)) return addLog(current, `${offer.name}는 현재 픽업 상품이 아닙니다.`);

  const bought = getTowerShopBought(towerShop, offer);
  const limitMax = offer.limit ? Number(offer.limit.max || 0) : Number.POSITIVE_INFINITY;
  const remainingByLimit = Number.isFinite(limitMax) ? Math.max(0, limitMax - bought) : Number.POSITIVE_INFINITY;
  if (remainingByLimit <= 0) return addLog(current, `${offer.name} 구매 제한에 도달했습니다.`);

  const tokenCount = Number(current.inventory[offer.cost.itemId] || 0);
  const maxByCurrency = Math.floor(tokenCount / Math.max(1, Number(offer.cost.qty || 1)));
  const buyCount = Math.max(0, Math.floor(Math.min(maxByCurrency, remainingByLimit)));
  if (buyCount <= 0) return addLog(current, `${offer.name} 최대 구매 실패. ${itemName(offer.cost.itemId)}이 부족합니다.`);

  let next = {
    ...current,
    inventory: addItem(current.inventory, offer.cost.itemId, -offer.cost.qty * buyCount),
  };
  const sampleLabels = [];
  for (let index = 0; index < buyCount; index += 1) {
    const rng = createRng(`${current.runId}|tower-shop|max|${offer.id}|${bought + index}|${current.counters.SHOP_BUY}`);
    const granted = grantTowerShopReward(next, offer, rng);
    next = {
      ...next,
      inventory: granted.inventory,
      equipment: granted.equipment,
      equipmentInventory: granted.equipmentInventory,
      salvageQueue: granted.salvageQueue,
      activePresetId: granted.equipmentChanged ? '' : next.activePresetId,
    };
    if (sampleLabels.length < 3 && granted.label) sampleLabels.push(granted.label);
  }

  return addLog({
    ...next,
    towerShop: setTowerShopBought(towerShop, offer, bought + buyCount),
    counters: bumpCounter(current.counters, 'SHOP_BUY', buyCount),
  }, `${offer.name} 최대 구매 ${buyCount}회 완료. ${sampleLabels.join(', ')}${buyCount > sampleLabels.length ? ` 외 ${buyCount - sampleLabels.length}회` : ''}`);
}

export function resetTowerShopRotationAction(state, scope = 'DAILY') {
  const current = ensureTowerShopState(normalizeState(state));
  const isWeekly = scope === 'WEEKLY';
  const rotation = current.towerShop.rotation;
  const cost = isWeekly ? TOWER_SHOP_ROTATION.weeklyResetCost : TOWER_SHOP_ROTATION.dailyResetCost;
  const max = isWeekly ? TOWER_SHOP_ROTATION.weeklyResetMax : TOWER_SHOP_ROTATION.dailyResetMax;
  const used = isWeekly ? rotation.weeklyResetsUsed : rotation.dailyResetsUsed;
  const label = isWeekly ? '이번주 픽업' : '오늘 픽업';

  if (used >= max) return addLog(current, `${label} 리셋 한도에 도달했습니다.`);
  if (Number(current.inventory.itm_tower_token || 0) < cost) return addLog(current, `${label} 리셋 실패. ${itemName('itm_tower_token')} ${cost}개가 필요합니다.`);

  const towerShop = {
    ...current.towerShop,
    rotation: isWeekly ? {
      ...rotation,
      weeklyOfferIds: [],
      weeklyNonce: Number(rotation.weeklyNonce || 0) + 1,
      weeklyResetsUsed: used + 1,
    } : {
      ...rotation,
      dailyOfferIds: [],
      dailyNonce: Number(rotation.dailyNonce || 0) + 1,
      dailyResetsUsed: used + 1,
    },
  };
  const next = ensureTowerShopState({
    ...current,
    inventory: addItem(current.inventory, 'itm_tower_token', -cost),
    towerShop,
    counters: bumpCounter(current.counters, 'SHOP_RESET', 1),
  });
  return addLog(next, `${label} 상점을 리셋했습니다. ${itemName('itm_tower_token')} -${cost}`);
}

export function attemptTowerAction(state, count = 1, stopOnFail = true) {
  let next = normalizeState(state);
  const requested = Math.max(1, Number(count || 1));
  const rng = createRng(`${next.runId}|tower|${next.towerFloor}|${next.counters.ATTEMPT_TOWER}|${requested}|${stopOnFail ? 'stop' : 'run'}`);
  const rewardMul = rewardCreditMul(next);
  let successCount = 0;
  let failCount = 0;
  let credits = 0;
  let tokens = 0;
  const logs = [];

  for (let index = 0; index < requested; index += 1) {
    if (Number(next.inventory.itm_tower_key || 0) <= 0) {
      logs.push('열쇠가 부족해 배치 도전을 중단했습니다.');
      break;
    }
    const floor = Number(next.towerFloor || 1);
    const lossStreak = Math.max(0, Math.floor(Number(next.towerLossStreak || 0)));
    const catchup = 1 + clamp(0.06 * lossStreak, 0, 0.24);
    const probability = winProb(teamPower(next) * catchup, towerDifficulty(floor), 1.7);
    next = {
      ...next,
      inventory: addItem(next.inventory, 'itm_tower_key', -1),
      counters: bumpCounter(next.counters, 'ATTEMPT_TOWER', 1),
    };
    if (rng() < probability) {
      const reward = Math.round(towerReward(floor) * rewardMul);
      const tokenGain = 1 + Math.floor((floor - 1) / 10) + (floor % 5 === 0 ? 1 : 0);
      successCount += 1;
      credits += reward;
      tokens += tokenGain;
      logs.push(`F${floor} 성공: +${reward} Cr, 토큰 +${tokenGain}, 연패보정 x${catchup.toFixed(2)}`);
      let inventory = addItem(next.inventory, 'itm_tower_token', tokenGain);
      if (floor % TOWER.milestoneEvery === 0) inventory = addItem(inventory, 'itm_tower_key', 1);
      next = {
        ...next,
        towerFloor: floor + 1,
        towerMaxCleared: Math.max(Number(next.towerMaxCleared || 0), floor),
        towerLossStreak: 0,
        credits: Number(next.credits || 0) + reward,
        inventory,
        counters: bumpCounter(next.counters, 'CLEAR_TOWER', 1),
      };
    } else {
      failCount += 1;
      logs.push(`F${floor} 실패: 성공률 ${Math.round(probability * 100)}%, 연패보정 x${catchup.toFixed(2)}`);
      next = {
        ...next,
        towerLossStreak: Number(next.towerLossStreak || 0) + 1,
      };
      if (stopOnFail) break;
    }
  }

  next = addLifetimeCounters({
    ...next,
    towerLastBatchReport: {
      at: Date.now(),
      requested,
      stopOnFail: stopOnFail !== false,
      successes: successCount,
      failures: failCount,
      creditsGained: credits,
      tokensGained: tokens,
      logs: logs.slice(-30),
    },
  }, {
    ATTEMPT_TOWER: successCount + failCount,
    CLEAR_TOWER: successCount,
    EARN_CREDITS: credits,
  });
  return addLog(next, `시련의 탑 ${requested}회 요청: 성공 ${successCount}, 실패 ${failCount}, +${credits} Cr.`);
}

export function claimMissionRewardsAction(state) {
  let next = normalizeState(state);
  let claimed = 0;
  let credits = 0;
  let inventory = next.inventory;
  const claimedSet = new Set(next.claimedMissions);
  const rewardMul = rewardCreditMul(next);

  MISSIONS.forEach((mission) => {
    if (claimedSet.has(mission.id)) return;
    if (Number(next.counters[mission.action] || 0) < mission.target) return;
    claimedSet.add(mission.id);
    claimed += 1;
    credits += Math.round(Number(mission.rewardCredits || 0) * rewardMul);
    inventory = addItems(inventory, mission.rewardItems);
  });

  if (!claimed) return addLog(next, '수령 가능한 미션 보상이 없습니다.');
  next = addLifetimeCounters({
    ...next,
    credits: Number(next.credits || 0) + credits,
    inventory,
    claimedMissions: [...claimedSet],
  }, { EARN_CREDITS: credits });
  return addLog(next, `미션 ${claimed}개 보상 수령. +${credits} Cr.`);
}

export function claimAchievementRewardsAction(state) {
  let next = normalizeState(state);
  const rows = achievementRows(next);
  const rewardMul = rewardCreditMul(next);
  let claimed = 0;
  let credits = 0;
  const claims = { ...next.achievementClaims };
  const titleIds = new Set(next.unlockedTitleIds);

  rows.forEach((achievement) => {
    if (!achievement.canClaim) return;
    claims[achievement.id] = true;
    claimed += 1;
    credits += Math.round(Number(achievement.rewardCredits || 0) * rewardMul);
    if (achievement.unlockTitleId) titleIds.add(achievement.unlockTitleId);
  });

  if (!claimed) return addLog(next, '수령 가능한 업적 보상이 없습니다.');
  next = addLifetimeCounters({
    ...next,
    credits: Number(next.credits || 0) + credits,
    achievementClaims: claims,
    unlockedTitleIds: [...titleIds],
  }, { EARN_CREDITS: credits });
  return addLog(next, `업적 ${claimed}개 보상 수령. +${credits} Cr${titleIds.size !== next.unlockedTitleIds.length ? ', 새 칭호 해금' : ''}.`);
}

export function equipTitleAction(state, titleId) {
  const current = normalizeState(state);
  if (!titleId) return addLog({ ...current, equippedTitleId: null }, '칭호를 해제했습니다.');
  const title = titleById(titleId);
  if (!title) return addLog(current, '칭호를 찾을 수 없습니다.');
  if (!current.unlockedTitleIds.includes(title.id)) return addLog(current, `${title.name} 칭호는 아직 해금되지 않았습니다.`);
  return addLog({ ...current, equippedTitleId: title.id }, `${title.name} 칭호를 장착했습니다. ${title.desc}`);
}

function makeEquipmentPresetId(state) {
  return `preset-${Date.now().toString(36)}-${Math.max(0, normalizeEquipmentPresets(state.equipmentPresets).length + 1)}`;
}

function presetAvailability(state, preset) {
  const currentUids = new Set(Object.keys(state.equipmentInventory || {}));
  const items = Object.values(preset.equipment || {}).filter((uid) => typeof uid === 'string');
  const available = items.filter((uid) => currentUids.has(uid)).length;
  return {
    equippedCount: items.length,
    availableCount: available,
    missingCount: Math.max(0, items.length - available),
  };
}

export function equipmentPresetRows(state) {
  const current = normalizeState(state);
  return normalizeEquipmentPresets(current.equipmentPresets).map((preset) => ({
    ...preset,
    ...presetAvailability(current, preset),
    active: preset.id === current.activePresetId,
  }));
}

export function saveEquipmentPresetAction(state, name = '') {
  const current = normalizeState(state);
  const equipment = cloneEquipmentUidMap(current.equipment);
  const equippedCount = Object.keys(equipment).length;
  if (!equippedCount) return addLog(current, '저장할 장착 장비가 없습니다.');
  const presetName = String(name || '').trim() || `프리셋 ${normalizeEquipmentPresets(current.equipmentPresets).length + 1}`;
  const preset = {
    id: makeEquipmentPresetId(current),
    name: presetName,
    equipment,
    createdAt: Date.now(),
  };
  const presets = [preset, ...normalizeEquipmentPresets(current.equipmentPresets)].slice(0, 12);
  return addLog({
    ...current,
    equipmentPresets: presets,
    activePresetId: preset.id,
    counters: bumpCounter(current.counters, 'PRESET', 1),
  }, `장비 프리셋 저장: ${preset.name} (${equippedCount}개 슬롯)`);
}

export function applyEquipmentPresetAction(state, presetId) {
  const current = normalizeState(state);
  const preset = normalizeEquipmentPresets(current.equipmentPresets).find((row) => row.id === presetId);
  if (!preset) return addLog(current, '장비 프리셋을 찾을 수 없습니다.');

  const usedUids = new Set();
  let missing = 0;
  let salvageQueue = current.salvageQueue || [];
  const equipment = {};

  Object.keys(SLOT_LABELS).forEach((slot) => {
    const uid = preset.equipment?.[slot];
    if (!uid) return;
    const savedEquip = current.equipmentInventory?.[uid];
    if (!savedEquip || savedEquip.slot !== slot) {
      missing += 1;
      return;
    }
    usedUids.add(uid);
    equipment[slot] = uid;
    salvageQueue = salvageQueue.filter((entry) => entry.uid !== uid);
  });

  Object.values(current.equipment || {}).forEach((uid) => {
    if (!uid || usedUids.has(uid)) return;
    const equip = current.equipmentInventory?.[uid];
    if (equip) salvageQueue = queueSalvage(salvageQueue, equip, '프리셋 교체 장비');
  });

  const equippedCount = Object.keys(equipment).length;
  return addLog({
    ...current,
    equipment,
    salvageQueue: salvageQueue.slice(0, MAX_SALVAGE_QUEUE),
    activePresetId: preset.id,
    counters: bumpCounter(current.counters, 'PRESET', 1),
  }, `장비 프리셋 적용: ${preset.name} (${equippedCount}개 장착${missing ? `, ${missing}개 누락` : ''})`);
}

export function deleteEquipmentPresetAction(state, presetId) {
  const current = normalizeState(state);
  const presets = normalizeEquipmentPresets(current.equipmentPresets);
  const target = presets.find((row) => row.id === presetId);
  if (!target) return addLog(current, '삭제할 장비 프리셋을 찾을 수 없습니다.');
  const nextPresets = presets.filter((row) => row.id !== presetId);
  return addLog({
    ...current,
    equipmentPresets: nextPresets,
    activePresetId: current.activePresetId === presetId ? '' : current.activePresetId,
  }, `장비 프리셋 삭제: ${target.name}`);
}

export function inventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([itemId, qty]) => ({ itemId, name: itemName(itemId), qty, rarity: getItem(itemId)?.rarity || 'COMMON' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

export function recipeCostPlan(state, recipeId) {
  const current = normalizeState(state);
  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const materialRows = Object.entries(recipe.requires || {}).map(([itemId, required]) => {
    const currentQty = Number(current.inventory?.[itemId] || 0);
    return {
      itemId,
      name: itemName(itemId),
      current: currentQty,
      required: Number(required || 0),
      met: currentQty >= Number(required || 0),
    };
  });
  const credits = Number(current.credits || 0);
  const creditReady = credits >= Number(recipe.credits || 0);
  const materialsReady = materialRows.every((row) => row.met);
  return {
    recipe,
    credits,
    creditReady,
    materialsReady,
    materialRows,
    canCraft: creditReady && materialsReady,
    shortageText: [
      !creditReady ? `크레딧 ${credits.toLocaleString('ko-KR')}/${Number(recipe.credits || 0).toLocaleString('ko-KR')}` : '',
      ...materialRows.filter((row) => !row.met).map((row) => `${row.name} ${row.current}/${row.required}`),
    ].filter(Boolean).join(' · '),
  };
}

export function equipmentInventoryRows(state) {
  const current = normalizeState(state);
  const equippedSlotByUid = new Map(Object.entries(current.equipment || {})
    .filter(([, uid]) => Boolean(uid))
    .map(([slot, uid]) => [uid, slot]));
  const queuedByUid = new Map((current.salvageQueue || [])
    .filter((entry) => entry?.uid)
    .map((entry) => [entry.uid, entry]));
  return Object.values(current.equipmentInventory || {})
    .filter(Boolean)
    .map((equip) => {
      const equippedSlot = equippedSlotByUid.get(equip.uid) || '';
      const queued = queuedByUid.get(equip.uid);
      return {
        ...equip,
        score: equipmentScore(equip),
        equipped: Boolean(equippedSlot),
        equippedSlot,
        queued: Boolean(queued),
        queueReason: queued?.reason || '',
        protected: Boolean(equip.locked || equip.favorite || equippedSlot),
      };
    })
    .sort((a, b) => (
      Number(b.equipped) - Number(a.equipped)
      || Number(b.favorite) - Number(a.favorite)
      || Number(b.locked) - Number(a.locked)
      || Number(b.score) - Number(a.score)
      || Number(b.createdAt || 0) - Number(a.createdAt || 0)
    ));
}

export function equipmentInventorySummary(state) {
  const rows = equipmentInventoryRows(state);
  return {
    total: rows.length,
    equipped: rows.filter((row) => row.equipped).length,
    reserve: rows.filter((row) => !row.equipped).length,
    queued: rows.filter((row) => row.queued).length,
    locked: rows.filter((row) => row.locked).length,
    favorite: rows.filter((row) => row.favorite).length,
    protected: rows.filter((row) => row.protected).length,
  };
}

export function salvageRows(state) {
  const current = normalizeState(state);
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const equippedUids = new Set(Object.values(current.equipment || {}).filter(Boolean));
  const rows = current.salvageQueue.map((entry) => {
    const equip = current.equipmentInventory?.[entry.uid] || entry.equip || entry;
    const row = {
      ...entry,
      ...cloneEquipmentInstance(equip),
      reason: entry.reason,
      createdAt: entry.createdAt,
      score: equipmentScore(equip),
      equipped: equippedUids.has(entry.uid),
      locked: Boolean(equip?.locked),
      favorite: Boolean(equip?.favorite),
    };
    const value = salvageValue(row);
    return {
      ...row,
      highRisk: isHighRiskSalvageEntry(row),
      rewardText: `고철 ${value.scrap}${value.stone ? `, 강화석 ${value.stone}` : ''}${value.ticket ? `, 리롤권 ${value.ticket}` : ''}`,
    };
  });
  const targetUids = new Set(salvageTargetRows(rows, candidateOnly).map((entry) => entry.uid));
  return rows.map((entry) => ({ ...entry, executable: targetUids.has(entry.uid) }));
}

export function salvageSummary(state) {
  const current = normalizeState(state);
  const rows = salvageRows(current);
  const candidateOnly = current.salvageSettings?.candidateOnly !== false;
  const executableRows = rows.filter((entry) => entry.executable);
  const protectedRows = rows.filter((entry) => !entry.executable);
  const totals = salvageTotals(executableRows);
  const byRarity = rows.reduce((next, entry) => ({
    ...next,
    [entry.rarity]: Number(next[entry.rarity] || 0) + 1,
  }), {});
  const bySlot = rows.reduce((next, entry) => ({
    ...next,
    [entry.slot]: Number(next[entry.slot] || 0) + 1,
  }), {});
  const riskyRows = rows
    .filter((entry) => entry.highRisk)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return {
    queued: executableRows.length,
    totalQueued: rows.length,
    executableCount: executableRows.length,
    protectedByCandidateOnly: protectedRows.length,
    protectedByLock: rows.filter((entry) => entry.locked).length,
    protectedByFavorite: rows.filter((entry) => entry.favorite).length,
    candidateOnly,
    protectedEquipped: getEquippedList(current).length,
    totals,
    totalRewardText: salvageRewardText(totals),
    highRiskCount: riskyRows.length,
    topRiskRows: riskyRows.slice(0, 3),
    byRarityText: Object.entries(byRarity).map(([rarity, count]) => `${rarity} ${count}`).join(' · ') || '없음',
    bySlotText: Object.entries(bySlot).map(([slot, count]) => `${slotLabel(slot)} ${count}`).join(' · ') || '없음',
  };
}

export function selectedSalvageSummary(state, selectedUids = []) {
  const current = normalizeState(state);
  const selectedUidSet = normalizeSelectedSalvageUids(selectedUids);
  const rows = salvageRows(current).filter((entry) => selectedUidSet.has(entry.uid));
  const executableRows = rows.filter((entry) => entry.executable);
  const protectedRows = rows.filter((entry) => !entry.executable);
  const totals = salvageTotals(executableRows);
  const riskyRows = rows
    .filter((entry) => entry.highRisk)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return {
    selectedCount: rows.length,
    requestedCount: selectedUidSet.size,
    staleCount: Math.max(0, selectedUidSet.size - rows.length),
    executableCount: executableRows.length,
    protectedByCandidateOnly: protectedRows.length,
    candidateOnly: current.salvageSettings?.candidateOnly !== false,
    totals,
    totalRewardText: salvageRewardText(totals),
    highRiskCount: riskyRows.length,
    topRiskRows: riskyRows.slice(0, 3),
  };
}

export function towerShopRows(state) {
  const current = ensureTowerShopState(normalizeState(state));
  const towerShop = current.towerShop;
  const activeIds = activeTowerShopOfferIdSet(towerShop);
  return TOWER_SHOP_OFFERS.filter((offer) => activeIds.has(offer.id)).map((offer) => {
    const bought = getTowerShopBought(towerShop, offer);
    const max = Number(offer.limit?.max || 999);
    const remaining = Math.max(0, max - bought);
    const maxBuyCount = Math.max(0, Math.floor(Math.min(
      remaining,
      Math.floor(Number(current.inventory[offer.cost.itemId] || 0) / Math.max(1, Number(offer.cost.qty || 1))),
    )));
    return {
      ...offer,
      bought,
      remaining,
      maxBuyCount,
      canBuy: remaining > 0 && Number(current.inventory[offer.cost.itemId] || 0) >= offer.cost.qty,
      canBuyMax: maxBuyCount > 1,
      costText: `${itemName(offer.cost.itemId)} ${offer.cost.qty}`,
      limitText: offer.limit ? `${offer.limit.period === 'WEEKLY' ? '주간' : '일일'} ${bought}/${max}` : '상시',
      pickupLabel: towerShopPickupLabel(towerShop, offer.id),
    };
  });
}

export function towerShopRotationSummary(state) {
  const current = ensureTowerShopState(normalizeState(state));
  const rotation = current.towerShop.rotation;
  const tokenCount = Number(current.inventory.itm_tower_token || 0);
  return {
    dailyKey: rotation.dailyKey,
    weeklyKey: rotation.weeklyKey,
    dailyCount: rotation.dailyOfferIds.length,
    weeklyCount: rotation.weeklyOfferIds.length,
    dailyResetsUsed: rotation.dailyResetsUsed,
    dailyResetMax: TOWER_SHOP_ROTATION.dailyResetMax,
    dailyResetCost: TOWER_SHOP_ROTATION.dailyResetCost,
    weeklyResetsUsed: rotation.weeklyResetsUsed,
    weeklyResetMax: TOWER_SHOP_ROTATION.weeklyResetMax,
    weeklyResetCost: TOWER_SHOP_ROTATION.weeklyResetCost,
    dailyPityCounter: rotation.dailyPityCounter,
    dailyPityTrigger: TOWER_SHOP_ROTATION.dailyPity?.trigger || 0,
    weeklyPityCounter: rotation.weeklyPityCounter,
    weeklyPityTrigger: TOWER_SHOP_ROTATION.weeklyPity?.trigger || 0,
    tokenCount,
    canResetDaily: rotation.dailyResetsUsed < TOWER_SHOP_ROTATION.dailyResetMax && tokenCount >= TOWER_SHOP_ROTATION.dailyResetCost,
    canResetWeekly: rotation.weeklyResetsUsed < TOWER_SHOP_ROTATION.weeklyResetMax && tokenCount >= TOWER_SHOP_ROTATION.weeklyResetCost,
  };
}

export function availableEnhanceSlots(state) {
  return getEquippedList(state).map((equip) => equip.slot);
}

export function upgradeRows(state) {
  const current = normalizeState(state);
  return UPGRADE_DEFS.map((def) => {
    const level = Math.max(0, Math.floor(Number(current.upgrades[def.id] || 0)));
    const cost = upgradeCost(def.id, level + 1);
    const costItemText = Object.entries(cost.items)
      .map(([itemId, qty]) => `${itemName(itemId)} ${qty}`)
      .join(', ');
    const powerBonus = Math.round(Number(def.powerMulPerLevel || 0) * 100);
    const staminaBonus = Math.round(Number(def.staminaMulPerLevel || 0) * 100);
    return {
      ...def,
      level,
      nextLevel: level + 1,
      costCredits: cost.credits,
      costItems: cost.items,
      costItemText,
      bonusText: `${powerBonus ? `전투력 +${powerBonus}%/Lv` : ''}${staminaBonus ? ` · 스태미나 효율 +${staminaBonus}%/Lv` : ''}`.trim(),
      canUpgrade: Number(current.credits || 0) >= cost.credits && hasItems(current.inventory, cost.items),
    };
  });
}

export function missionRows(state) {
  const current = normalizeState(state);
  const claimed = new Set(current.claimedMissions);
  return MISSIONS.map((mission) => {
    const progress = Number(current.counters[mission.action] || 0);
    return {
      ...mission,
      progress,
      done: progress >= mission.target,
      claimed: claimed.has(mission.id),
    };
  });
}

function progressRatio(progress, target) {
  const denominator = Math.max(1, Number(target || 1));
  return clamp(Number(progress || 0) / denominator, 0, 1);
}

function progressPct(progress, target) {
  return Math.round(progressRatio(progress, target) * 100);
}

function nextTargetFromList(value, targets, fallbackStep) {
  const current = Math.max(0, Number(value || 0));
  return targets.find((target) => current < target) || (Math.floor(current / fallbackStep) + 1) * fallbackStep;
}

function buildGrowthAction(id, title, detail, priority = 'normal') {
  return { id, title, detail, priority };
}

function roadmapStatus(pct) {
  if (pct >= 100) return 'complete';
  if (pct >= 70) return 'close';
  return 'active';
}

function buildRoadmapStep({ id, phase, title, detail, progress, target, priority = 'normal', action = '' }) {
  const pct = progressPct(progress, target);
  return {
    id,
    phase,
    title,
    detail,
    progress: Math.max(0, Math.round(Number(progress || 0))),
    target: Math.max(1, Math.round(Number(target || 1))),
    pct,
    priority,
    status: roadmapStatus(pct),
    action,
  };
}

function missingRecipeForSlot(slot) {
  return RECIPES.find((recipe) => {
    const produced = getItem(recipe.produces?.itemId);
    return produced?.equip?.slot === slot;
  }) || null;
}

export function growthReportForState(state) {
  const current = normalizeState(state);
  const power = teamPower(current);
  const floor = Math.max(1, Math.floor(Number(current.floor || 1)));
  const maxFloor = Math.max(0, Math.floor(Number(current.maxClearedFloor || 0)));
  const towerFloor = Math.max(1, Math.floor(Number(current.towerFloor || 1)));
  const towerMaxFloor = Math.max(0, Math.floor(Number(current.towerMaxCleared || 0)));
  const towerLossStreak = Math.max(0, Math.floor(Number(current.towerLossStreak || 0)));
  const towerCatchup = 1 + Math.min(0.24, towerLossStreak * 0.06);
  const mainProb = winProb(power, dutyDifficulty(floor));
  const towerProb = winProb(power * towerCatchup, towerDifficulty(towerFloor), 1.7);
  const mainTarget = nextTargetFromList(maxFloor, [20, 50, 100, 200, 300, 500], 100);
  const towerTarget = nextTargetFromList(towerMaxFloor, [10, 20, 50, 100, 150, 200], 50);
  const equipped = getEquippedList(current);
  const missingSlots = Object.keys(SLOT_LABELS).filter((slot) => !current.equipment?.[slot]);
  const upgrades = upgradeRows(current);
  const readyUpgrades = upgrades.filter((upgrade) => upgrade.canUpgrade);
  const missions = missionRows(current);
  const claimableMissions = missions.filter((mission) => mission.done && !mission.claimed);
  const activeMission = missions
    .filter((mission) => !mission.claimed)
    .sort((a, b) => progressRatio(b.progress, b.target) - progressRatio(a.progress, a.target))[0] || null;
  const achievements = achievementRows(current);
  const claimableAchievements = achievements.filter((achievement) => achievement.canClaim);
  const activeAchievement = achievements
    .filter((achievement) => !achievement.claimed)
    .sort((a, b) => progressRatio(b.progress, b.target) - progressRatio(a.progress, a.target))[0] || null;
  const salvageInfo = salvageSummary(current);
  const towerKeys = Number(current.inventory.itm_tower_key || 0);
  const towerTokens = Number(current.inventory.itm_tower_token || 0);
  const floorBase = Math.max(1, Math.floor(Number(current.towerMaxCleared || current.maxClearedFloor || current.floor || 1)));
  const creditsPerWave = Math.round((15 + floorBase * 2) * rewardCreditMul(current));
  const offlineHourlyCredits = creditsPerWave * Math.floor(60 * 60 * 1000 / OFFLINE_WAVE_MS);
  const offlineHourlyTokens = Math.floor(Math.floor(60 * 60 * 1000 / OFFLINE_WAVE_MS) / 10);

  const blockers = [];
  const recommendations = [];

  if (claimableMissions.length || claimableAchievements.length) {
    recommendations.push(buildGrowthAction(
      'claim-rewards',
      '보상 먼저 수령',
      `미션 ${claimableMissions.length}개, 업적 ${claimableAchievements.length}개 보상이 대기 중입니다.`,
      'high',
    ));
  }
  if (Number(current.stamina || 0) < 35) {
    blockers.push('스태미나 부족');
    recommendations.push(buildGrowthAction('rest', '재정비', '스태미나가 낮아 정산 효율과 승률이 같이 떨어집니다.', 'high'));
  }
  if (missingSlots.length) {
    const firstSlot = missingSlots[0];
    const recipe = missingRecipeForSlot(firstSlot);
    blockers.push(`${slotLabel(firstSlot)} 미장착`);
    recommendations.push(buildGrowthAction(
      'craft-missing-slot',
      `${slotLabel(firstSlot)} 확보`,
      recipe
        ? `${recipe.name}으로 빈 슬롯을 먼저 채우세요.`
        : `${slotLabel(firstSlot)} 슬롯 장비가 비어 있습니다.`,
      'high',
    ));
  }
  if (readyUpgrades.length) {
    recommendations.push(buildGrowthAction(
      'upgrade',
      '상시 연구 진행',
      `${readyUpgrades[0].name} Lv.${readyUpgrades[0].level} -> Lv.${readyUpgrades[0].nextLevel} 연구가 가능합니다.`,
      'normal',
    ));
  }
  if (salvageInfo.executableCount > 0) {
    recommendations.push(buildGrowthAction(
      'salvage',
      '분해 대기열 정리',
      `실행 가능한 후보 ${salvageInfo.executableCount}개가 있어 재료 회수가 가능합니다.`,
      'normal',
    ));
  }
  if (mainProb < 0.42) {
    blockers.push('메인 정산 승률 낮음');
    recommendations.push(buildGrowthAction('main-power', '전투력 보강', `현재 층 승률이 ${Math.round(mainProb * 100)}%라 연구/강화가 먼저입니다.`, 'high'));
  } else if (Number(current.stamina || 0) >= 35) {
    recommendations.push(buildGrowthAction('duty', '2시간 정산', `현재 층 승률 ${Math.round(mainProb * 100)}%로 메인 웨이브를 밀기 좋습니다.`, 'normal'));
  }
  if (towerKeys <= 0) {
    blockers.push('탑 열쇠 부족');
    recommendations.push(buildGrowthAction('tower-key', '탑 열쇠 확보', '탑 상점 구매나 열쇠 제작 후 등반을 재개하세요.', 'normal'));
  } else if (towerProb >= 0.55) {
    recommendations.push(buildGrowthAction('tower', '탑 배치 도전', `탑 ${towerFloor}층 예상 승률이 ${Math.round(towerProb * 100)}%입니다.`, 'normal'));
  } else {
    recommendations.push(buildGrowthAction('tower-delay', '탑은 보류', `탑 ${towerFloor}층 승률이 ${Math.round(towerProb * 100)}%라 메인 성장 후 재도전이 낫습니다.`, 'low'));
  }

  const statusTone = blockers.length >= 3 || mainProb < 0.35 ? 'danger' : blockers.length ? 'warn' : 'good';
  const headline = recommendations[0]?.title || '메인 정산 유지';
  const overallPct = Math.round(clamp(
    18
      + progressRatio(maxFloor, mainTarget) * 18
      + progressRatio(towerMaxFloor, towerTarget) * 14
      + Math.min(1, equipped.length / Object.keys(SLOT_LABELS).length) * 16
      + Math.min(1, upgrades.reduce((sum, upgrade) => sum + Number(upgrade.level || 0), 0) / 15) * 12
      + Math.min(1, achievements.filter((achievement) => achievement.claimed).length / Math.max(1, achievements.length)) * 12
      + Math.min(1, towerTokens / 60) * 10,
    0,
    100,
  ));

  return {
    statusTone,
    headline,
    overallPct,
    summary: `${headline} · 성장도 ${overallPct}%`,
    combat: {
      power,
      floor,
      mainProbabilityPct: Math.round(mainProb * 100),
      mainTarget,
      mainTargetPct: progressPct(maxFloor, mainTarget),
      towerFloor,
      towerProbabilityPct: Math.round(towerProb * 100),
      towerTarget,
      towerTargetPct: progressPct(towerMaxFloor, towerTarget),
      towerCatchupPct: Math.round((towerCatchup - 1) * 100),
    },
    resources: {
      credits: Number(current.credits || 0),
      stamina: Number(current.stamina || 0),
      towerKeys,
      towerTokens,
      equippedCount: equipped.length,
      missingSlots: missingSlots.map((slot) => slotLabel(slot)),
      salvageCandidates: salvageInfo.executableCount,
      readyUpgrades: readyUpgrades.length,
      claimableRewards: claimableMissions.length + claimableAchievements.length,
    },
    nextMission: activeMission ? {
      name: activeMission.name,
      progress: activeMission.progress,
      target: activeMission.target,
      pct: progressPct(activeMission.progress, activeMission.target),
    } : null,
    nextAchievement: activeAchievement ? {
      name: activeAchievement.name,
      progress: activeAchievement.progress,
      target: activeAchievement.target,
      pct: progressPct(activeAchievement.progress, activeAchievement.target),
    } : null,
    offlineProjection: {
      creditsPerWave,
      hourlyCredits: offlineHourlyCredits,
      hourlyTokens: offlineHourlyTokens,
      capHours: Math.round(OFFLINE_CAP_MS / (60 * 60 * 1000)),
    },
    blockers,
    recommendations: recommendations.slice(0, 6),
  };
}

export function growthRoadmapForState(state) {
  const current = normalizeState(state);
  const report = growthReportForState(current);
  const missions = missionRows(current);
  const achievements = achievementRows(current);
  const upgrades = upgradeRows(current);
  const equippedCount = getEquippedList(current).length;
  const slotCount = Object.keys(SLOT_LABELS).length;
  const dailyMissions = missions.filter((mission) => mission.type === 'daily');
  const weeklyMissions = missions.filter((mission) => mission.type === 'weekly');
  const dailyClaimed = dailyMissions.filter((mission) => mission.claimed).length;
  const dailyReady = dailyMissions.filter((mission) => mission.done && !mission.claimed).length;
  const weeklyProgress = weeklyMissions.reduce((sum, mission) => sum + progressRatio(mission.progress, mission.target), 0);
  const totalUpgradeLevel = upgrades.reduce((sum, upgrade) => sum + Number(upgrade.level || 0), 0);
  const readyUpgrade = upgrades.find((upgrade) => upgrade.canUpgrade);
  const claimableRewards = Number(report.resources.claimableRewards || 0);
  const salvageInfo = salvageSummary(current);
  const nextRecommendation = report.recommendations.find((item) => item.priority !== 'low') || report.recommendations[0] || null;

  const sections = [
    {
      id: 'today',
      label: '오늘',
      steps: [
        buildRoadmapStep({
          id: 'daily-reward',
          phase: '오늘',
          title: '일일 미션 보상 회수',
          detail: claimableRewards
            ? `수령 대기 보상 ${claimableRewards}개가 있습니다.`
            : `완료 ${dailyClaimed}/${Math.max(1, dailyMissions.length)}개, 대기 ${dailyReady}개입니다.`,
          progress: dailyClaimed + dailyReady * 0.7,
          target: Math.max(1, dailyMissions.length),
          priority: claimableRewards ? 'high' : 'normal',
          action: claimableRewards ? '보상 수령' : '당직/탑/강화 루프 진행',
        }),
        buildRoadmapStep({
          id: 'slot-fill',
          phase: '오늘',
          title: '장비 슬롯 완성',
          detail: report.resources.missingSlots.length
            ? `빈 슬롯: ${report.resources.missingSlots.join(', ')}`
            : '모든 기본 장비 슬롯을 채웠습니다.',
          progress: equippedCount,
          target: slotCount,
          priority: report.resources.missingSlots.length ? 'high' : 'normal',
          action: report.resources.missingSlots.length ? '제작/상점으로 빈 슬롯 보강' : '강화와 옵션 재련',
        }),
        buildRoadmapStep({
          id: 'stamina-loop',
          phase: '오늘',
          title: '스태미나 운영',
          detail: Number(current.stamina || 0) < 35
            ? '스태미나가 낮아 재정비 후 정산하는 편이 좋습니다.'
            : '현재 스태미나는 정산 루프를 이어갈 수 있는 수준입니다.',
          progress: Number(current.stamina || 0),
          target: 100,
          priority: Number(current.stamina || 0) < 35 ? 'high' : 'normal',
          action: Number(current.stamina || 0) < 35 ? '재정비' : '2시간 정산',
        }),
      ],
    },
    {
      id: 'weekly',
      label: '이번 주',
      steps: [
        buildRoadmapStep({
          id: 'weekly-missions',
          phase: '이번 주',
          title: '주간 미션 진행',
          detail: weeklyMissions.length
            ? `주간 미션 평균 진행률 ${Math.round((weeklyProgress / Math.max(1, weeklyMissions.length)) * 100)}%입니다.`
            : '등록된 주간 미션이 없습니다.',
          progress: weeklyProgress,
          target: Math.max(1, weeklyMissions.length),
          priority: 'normal',
          action: '메인/보스/탑 목표 병행',
        }),
        buildRoadmapStep({
          id: 'research-15',
          phase: '이번 주',
          title: '상시 연구 Lv.15',
          detail: readyUpgrade
            ? `${readyUpgrade.name} Lv.${readyUpgrade.level} -> Lv.${readyUpgrade.nextLevel} 연구가 가능합니다.`
            : `현재 총 연구 레벨은 ${totalUpgradeLevel}입니다.`,
          progress: totalUpgradeLevel,
          target: 15,
          priority: readyUpgrade ? 'high' : 'normal',
          action: readyUpgrade ? '상시 연구 진행' : '재료/크레딧 확보',
        }),
        buildRoadmapStep({
          id: 'tower-target',
          phase: '이번 주',
          title: `탑 ${report.combat.towerTarget}층 돌파`,
          detail: `현재 최고 ${current.towerMaxCleared}층, 다음 도전 승률 ${report.combat.towerProbabilityPct}%입니다.`,
          progress: current.towerMaxCleared,
          target: report.combat.towerTarget,
          priority: report.combat.towerProbabilityPct >= 55 && Number(current.inventory.itm_tower_key || 0) > 0 ? 'normal' : 'low',
          action: report.combat.towerProbabilityPct >= 55 ? '탑 배치 도전' : '전투력 보강 후 도전',
        }),
      ],
    },
    {
      id: 'long',
      label: '장기',
      steps: [
        buildRoadmapStep({
          id: 'main-target',
          phase: '장기',
          title: `메인 F${report.combat.mainTarget} 도달`,
          detail: `현재 최고 F${current.maxClearedFloor}, 다음 층 승률 ${report.combat.mainProbabilityPct}%입니다.`,
          progress: current.maxClearedFloor,
          target: report.combat.mainTarget,
          priority: report.combat.mainProbabilityPct < 42 ? 'high' : 'normal',
          action: report.combat.mainProbabilityPct < 42 ? '강화/연구 먼저' : '2시간 정산 반복',
        }),
        buildRoadmapStep({
          id: 'achievements',
          phase: '장기',
          title: '업적/칭호 수집',
          detail: `업적 ${achievements.filter((achievement) => achievement.claimed).length}/${achievements.length}개를 수령했습니다.`,
          progress: achievements.filter((achievement) => achievement.claimed).length,
          target: Math.max(1, achievements.length),
          priority: achievements.some((achievement) => achievement.canClaim) ? 'high' : 'normal',
          action: achievements.some((achievement) => achievement.canClaim) ? '업적 보상 수령' : '목표 미션 진행',
        }),
        buildRoadmapStep({
          id: 'salvage-economy',
          phase: '장기',
          title: '분해 경제 안정화',
          detail: salvageInfo.executableCount
            ? `분해 실행 후보 ${salvageInfo.executableCount}개, 위험 후보 ${salvageInfo.highRiskCount}개입니다.`
            : '현재 분해 대기열은 안정적입니다.',
          progress: Math.min(10, Number(current.counters.SALVAGE || 0) + Math.max(0, 10 - salvageInfo.executableCount)),
          target: 10,
          priority: salvageInfo.executableCount ? 'normal' : 'low',
          action: salvageInfo.executableCount ? '후보만 분해 실행' : '장비 파밍 유지',
        }),
      ],
    },
  ].map((section) => {
    const sectionPct = Math.round(section.steps.reduce((sum, step) => sum + step.pct, 0) / Math.max(1, section.steps.length));
    return {
      ...section,
      pct: sectionPct,
      done: section.steps.filter((step) => step.status === 'complete').length,
      total: section.steps.length,
    };
  });

  const allSteps = sections.flatMap((section) => section.steps);
  const priorityRank = { high: 0, normal: 1, low: 2 };
  const nextStep = allSteps
    .filter((step) => step.status !== 'complete')
    .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || a.pct - b.pct)[0] || allSteps[0] || null;
  const completionPct = Math.round(sections.reduce((sum, section) => sum + section.pct, 0) / Math.max(1, sections.length));

  return {
    headline: nextStep ? `${nextStep.phase}: ${nextStep.title}` : '로드맵 완료',
    completionPct,
    nextAction: nextStep ? {
      title: nextStep.title,
      detail: nextRecommendation?.detail || nextStep.detail,
      action: nextStep.action,
      priority: nextStep.priority,
    } : null,
    sections,
  };
}

function buildDailyPlanAction({ id, title, detail, priority = 'normal', command = null, buttonLabel = '' }) {
  return { id, title, detail, priority, command, buttonLabel };
}

function buildDailyCheck({ id, label, value, detail, status = 'active' }) {
  return { id, label, value, detail, status };
}

export function dailyOperationsPlanForState(state) {
  const current = normalizeState(state);
  const report = growthReportForState(current);
  const roadmap = growthRoadmapForState(current);
  const missions = missionRows(current);
  const achievements = achievementRows(current);
  const upgrades = upgradeRows(current);
  const shopRotation = towerShopRotationSummary(current);
  const shopOffers = towerShopRows(current);
  const salvageInfo = salvageSummary(current);
  const equipped = getEquippedList(current);
  const slotCount = Object.keys(SLOT_LABELS).length;
  const missingSlots = Object.keys(SLOT_LABELS).filter((slot) => !current.equipment?.[slot]);
  const firstMissingSlot = missingSlots[0] || '';
  const missingRecipe = firstMissingSlot ? missingRecipeForSlot(firstMissingSlot) : null;
  const readyUpgrade = upgrades.find((upgrade) => upgrade.canUpgrade) || null;
  const claimableMissions = missions.filter((mission) => mission.done && !mission.claimed);
  const claimableAchievements = achievements.filter((achievement) => achievement.canClaim);
  const dailyMissions = missions.filter((mission) => mission.type === 'daily');
  const weeklyMissions = missions.filter((mission) => mission.type === 'weekly');
  const dailyDone = dailyMissions.filter((mission) => mission.claimed).length;
  const dailyReady = dailyMissions.filter((mission) => mission.done && !mission.claimed).length;
  const weeklyProgressPct = Math.round(
    weeklyMissions.reduce((sum, mission) => sum + progressRatio(mission.progress, mission.target), 0)
      / Math.max(1, weeklyMissions.length)
      * 100,
  );
  const buyableOffer = shopOffers.find((offer) => offer.canBuy) || null;
  const towerKeys = Number(current.inventory.itm_tower_key || 0);
  const stamina = Number(current.stamina || 0);
  const claimableCount = claimableMissions.length + claimableAchievements.length;

  const priorityActions = [];
  if (claimableCount) {
    priorityActions.push(buildDailyPlanAction({
      id: 'claim-rewards',
      title: '보상 수령',
      detail: `미션 ${claimableMissions.length}개, 업적 ${claimableAchievements.length}개 보상이 대기 중입니다.`,
      priority: 'high',
      command: { type: 'claim-rewards' },
      buttonLabel: '수령',
    }));
  }
  if (stamina < 35) {
    priorityActions.push(buildDailyPlanAction({
      id: 'rest',
      title: '재정비',
      detail: `스태미나 ${stamina}/100입니다. 정산 효율을 회복한 뒤 메인 웨이브를 미는 편이 낫습니다.`,
      priority: 'high',
      command: { type: 'rest' },
      buttonLabel: '재정비',
    }));
  }
  if (missingRecipe) {
    priorityActions.push(buildDailyPlanAction({
      id: 'craft-missing-slot',
      title: `${slotLabel(firstMissingSlot)} 슬롯 제작`,
      detail: `${missingRecipe.name}으로 빈 장비 슬롯을 채우면 기본 전투력 손실을 줄일 수 있습니다.`,
      priority: 'high',
      command: { type: 'craft', recipeId: missingRecipe.id },
      buttonLabel: '제작',
    }));
  }
  if (readyUpgrade) {
    priorityActions.push(buildDailyPlanAction({
      id: 'upgrade',
      title: '상시 연구',
      detail: `${readyUpgrade.name} Lv.${readyUpgrade.level} -> Lv.${readyUpgrade.nextLevel} 연구가 가능합니다.`,
      priority: 'normal',
      command: { type: 'upgrade', upgradeId: readyUpgrade.id },
      buttonLabel: '연구',
    }));
  }
  if (report.combat.mainProbabilityPct >= 42 && stamina >= 35) {
    priorityActions.push(buildDailyPlanAction({
      id: 'duty',
      title: '2시간 당직 정산',
      detail: `메인 승률 ${report.combat.mainProbabilityPct}%입니다. 현재 층을 반복 정산하기 좋은 상태입니다.`,
      priority: 'normal',
      command: { type: 'duty', minutes: 120 },
      buttonLabel: '정산',
    }));
  }
  if (towerKeys > 0 && report.combat.towerProbabilityPct >= 55) {
    priorityActions.push(buildDailyPlanAction({
      id: 'tower',
      title: '시련의 탑 배치',
      detail: `탑 ${report.combat.towerFloor}층 예상 승률 ${report.combat.towerProbabilityPct}%입니다. 열쇠 ${towerKeys}개를 사용할 타이밍입니다.`,
      priority: 'normal',
      command: { type: 'tower' },
      buttonLabel: '도전',
    }));
  }
  if (buyableOffer) {
    priorityActions.push(buildDailyPlanAction({
      id: 'tower-shop',
      title: '타워 상점 구매',
      detail: `${buyableOffer.name} 구매가 가능합니다. ${buyableOffer.pickupLabel} · ${buyableOffer.costText}`,
      priority: 'normal',
      command: { type: 'buy-offer', offerId: buyableOffer.id },
      buttonLabel: '구매',
    }));
  }
  if (salvageInfo.executableCount > 0) {
    priorityActions.push(buildDailyPlanAction({
      id: 'salvage',
      title: '분해 대기열 정리',
      detail: `실행 대상 ${salvageInfo.executableCount}개, 보호 대상 ${salvageInfo.protectedByCandidateOnly}개입니다.`,
      priority: salvageInfo.highRiskCount ? 'low' : 'normal',
      command: { type: 'salvage' },
      buttonLabel: '분해',
    }));
  }
  if (!priorityActions.length) {
    priorityActions.push(buildDailyPlanAction({
      id: 'steady-duty',
      title: '메인 정산 유지',
      detail: '수령/제작/연구 병목이 없어 메인 정산과 탑 도전을 반복하면 됩니다.',
      priority: 'normal',
      command: { type: 'duty', minutes: 120 },
      buttonLabel: '정산',
    }));
  }

  const readinessPct = Math.round(clamp(
    report.overallPct * 0.42
      + roadmap.completionPct * 0.34
      + progressRatio(stamina, 100) * 10
      + Math.min(1, equipped.length / Math.max(1, slotCount)) * 8
      + (claimableCount ? 0 : 6),
    0,
    100,
  ));
  const highPriorityCount = priorityActions.filter((action) => action.priority === 'high').length;
  const riskLabel = report.statusTone === 'danger'
    ? '위험'
    : report.statusTone === 'warn' || highPriorityCount
      ? '점검'
      : '안정';
  const actionHeadline = priorityActions[0]?.title || roadmap.headline;

  const checkCards = [
    buildDailyCheck({
      id: 'daily',
      label: '일일 미션',
      value: `${dailyDone}/${Math.max(1, dailyMissions.length)}`,
      detail: dailyReady
        ? `완료 후 수령 대기 ${dailyReady}개가 있습니다.`
        : '일일 미션은 당직/탑/강화 루프와 함께 진행됩니다.',
      status: dailyReady ? 'ready' : dailyDone >= dailyMissions.length ? 'complete' : 'active',
    }),
    buildDailyCheck({
      id: 'weekly',
      label: '주간 미션',
      value: `${weeklyProgressPct}%`,
      detail: weeklyMissions.length ? '주간 목표는 메인, 탑, 제작을 병행하면 자연스럽게 누적됩니다.' : '등록된 주간 미션이 없습니다.',
      status: weeklyProgressPct >= 100 ? 'complete' : weeklyProgressPct >= 70 ? 'ready' : 'active',
    }),
    buildDailyCheck({
      id: 'equipment',
      label: '장비 슬롯',
      value: `${equipped.length}/${slotCount}`,
      detail: missingSlots.length ? `빈 슬롯: ${missingSlots.map((slot) => slotLabel(slot)).join(', ')}` : '기본 슬롯이 모두 채워졌습니다.',
      status: missingSlots.length ? 'ready' : 'complete',
    }),
    buildDailyCheck({
      id: 'shop',
      label: '타워 상점',
      value: `${shopRotation.tokenCount}토큰`,
      detail: buyableOffer
        ? `${buyableOffer.name} 구매 가능. 오늘 리셋 ${shopRotation.dailyResetsUsed}/${shopRotation.dailyResetMax}, 주간 리셋 ${shopRotation.weeklyResetsUsed}/${shopRotation.weeklyResetMax}`
        : `구매 가능 상품이 없습니다. 오늘 픽업 ${shopRotation.dailyCount}개, 이번주 픽업 ${shopRotation.weeklyCount}개입니다.`,
      status: buyableOffer ? 'ready' : 'active',
    }),
    buildDailyCheck({
      id: 'offline',
      label: '방치 효율',
      value: `${report.offlineProjection.hourlyCredits.toLocaleString('ko-KR')} Cr/h`,
      detail: `시간당 토큰 +${report.offlineProjection.hourlyTokens}, 보상 상한 ${report.offlineProjection.capHours}시간 기준입니다.`,
      status: 'active',
    }),
  ];

  return {
    headline: `${actionHeadline} · 준비도 ${readinessPct}%`,
    riskLabel,
    readinessPct,
    highPriorityCount,
    priorityActions: priorityActions.slice(0, 7),
    checkCards,
    roadmapHeadline: roadmap.headline,
    nextAction: roadmap.nextAction,
    blockers: report.blockers,
    projections: {
      mainProbabilityPct: report.combat.mainProbabilityPct,
      towerProbabilityPct: report.combat.towerProbabilityPct,
      hourlyCredits: report.offlineProjection.hourlyCredits,
      hourlyTokens: report.offlineProjection.hourlyTokens,
      capHours: report.offlineProjection.capHours,
    },
  };
}

function buildSeasonBalanceRow({ id, label, value, detail, tone = 'normal' }) {
  return { id, label, value, detail, tone };
}

export function seasonOperationsReportForState(state) {
  const current = normalizeState(state);
  const report = growthReportForState(current);
  const roadmap = growthRoadmapForState(current);
  const dailyPlan = dailyOperationsPlanForState(current);
  const missions = missionRows(current);
  const achievements = achievementRows(current);
  const upgrades = upgradeRows(current);
  const salvageInfo = salvageSummary(current);
  const shopRotation = towerShopRotationSummary(current);
  const equipped = getEquippedList(current);
  const slotCount = Object.keys(SLOT_LABELS).length;
  const totalUpgradeLevel = upgrades.reduce((sum, upgrade) => sum + Number(upgrade.level || 0), 0);
  const claimedAchievements = achievements.filter((achievement) => achievement.claimed).length;
  const weeklyMissions = missions.filter((mission) => mission.type === 'weekly');
  const weeklyProgressPct = Math.round(
    weeklyMissions.reduce((sum, mission) => sum + progressRatio(mission.progress, mission.target), 0)
      / Math.max(1, weeklyMissions.length)
      * 100,
  );
  const seasonLengthDays = 14;
  const startMs = new Date(current.startedAt || '').getTime();
  const elapsedDays = Number.isFinite(startMs)
    ? Math.max(1, Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000)) + 1)
    : 1;
  const seasonDay = ((elapsedDays - 1) % seasonLengthDays) + 1;
  const daysLeft = Math.max(0, seasonLengthDays - seasonDay);
  const seasonNumber = Math.floor((elapsedDays - 1) / seasonLengthDays) + 1;
  const seasonMainTarget = nextTargetFromList(Number(current.maxClearedFloor || 0), [50, 100, 200, 350, 500, 750], 100);
  const seasonTowerTarget = nextTargetFromList(Number(current.towerMaxCleared || 0), [20, 50, 100, 150, 200, 300], 50);
  const enhancedGearScore = equipped.reduce((sum, equip) => {
    const rarityBonus = Math.max(0, (RARITY_RANK[equip.rarity] || 1) - 1);
    return sum + 12 + rarityBonus * 4 + Math.min(8, Number(equip.enhance || 0));
  }, 0);
  const gearTarget = Math.max(80, slotCount * 22);
  const economyScore = Math.min(100, Math.round(
    progressRatio(Number(current.credits || 0), 15000) * 34
      + progressRatio(Number(current.inventory.itm_tower_token || 0), 80) * 26
      + progressRatio(Number(current.inventory.itm_tower_key || 0), 12) * 18
      + (shopRotation.canResetDaily || shopRotation.canResetWeekly ? 8 : 14)
      + (salvageInfo.executableCount ? 4 : 8),
  ));

  const tracks = [
    buildRoadmapStep({
      id: 'season-main',
      phase: '시즌',
      title: `메인 F${seasonMainTarget} 도달`,
      detail: `현재 최고 F${current.maxClearedFloor}, 다음 층 승률 ${report.combat.mainProbabilityPct}%입니다.`,
      progress: Number(current.maxClearedFloor || 0),
      target: seasonMainTarget,
      priority: report.combat.mainProbabilityPct < 42 ? 'high' : 'normal',
      action: report.combat.mainProbabilityPct < 42 ? '장비/연구 보강' : '2시간 당직 반복',
    }),
    buildRoadmapStep({
      id: 'season-tower',
      phase: '시즌',
      title: `시련의 탑 ${seasonTowerTarget}층`,
      detail: `현재 최고 ${current.towerMaxCleared}층, 열쇠 ${Number(current.inventory.itm_tower_key || 0)}개, 예상 승률 ${report.combat.towerProbabilityPct}%입니다.`,
      progress: Number(current.towerMaxCleared || 0),
      target: seasonTowerTarget,
      priority: Number(current.inventory.itm_tower_key || 0) <= 0 ? 'high' : 'normal',
      action: Number(current.inventory.itm_tower_key || 0) <= 0 ? '열쇠 확보' : '탑 배치 도전',
    }),
    buildRoadmapStep({
      id: 'season-gear',
      phase: '시즌',
      title: '시즌 장비 세트 정비',
      detail: `장착 ${equipped.length}/${slotCount}, 분해 실행 후보 ${salvageInfo.executableCount}개입니다.`,
      progress: enhancedGearScore,
      target: gearTarget,
      priority: equipped.length < slotCount || salvageInfo.highRiskCount ? 'high' : 'normal',
      action: equipped.length < slotCount ? '빈 슬롯 제작' : salvageInfo.executableCount ? '분해 후보 정리' : '강화/옵션 재련',
    }),
    buildRoadmapStep({
      id: 'season-economy',
      phase: '시즌',
      title: '시즌 재화 순환',
      detail: `주간 진행 ${weeklyProgressPct}%, 타워 토큰 ${Number(current.inventory.itm_tower_token || 0)}개, 시간당 ${report.offlineProjection.hourlyCredits.toLocaleString('ko-KR')} Cr입니다.`,
      progress: economyScore,
      target: 100,
      priority: dailyPlan.highPriorityCount ? 'high' : 'normal',
      action: dailyPlan.priorityActions[0]?.title || '정산 루프 유지',
    }),
    buildRoadmapStep({
      id: 'season-archive',
      phase: '시즌',
      title: '업적/칭호 아카이브',
      detail: `업적 ${claimedAchievements}/${achievements.length}개, 장기 로드맵 ${roadmap.completionPct}%입니다.`,
      progress: claimedAchievements,
      target: Math.max(1, achievements.length),
      priority: achievements.some((achievement) => achievement.canClaim) ? 'high' : 'normal',
      action: achievements.some((achievement) => achievement.canClaim) ? '업적 보상 수령' : '장기 목표 진행',
    }),
  ];

  const seasonPct = Math.round(tracks.reduce((sum, track) => sum + track.pct, 0) / Math.max(1, tracks.length));
  const urgentTracks = tracks.filter((track) => track.priority === 'high' && track.status !== 'complete');
  const balanceRows = [
    buildSeasonBalanceRow({
      id: 'power-curve',
      label: '전투 곡선',
      value: `${report.combat.mainProbabilityPct}% / ${report.combat.towerProbabilityPct}%`,
      detail: `메인과 탑 승률 차이를 보고 정산, 강화, 탑 도전 순서를 조절합니다.`,
      tone: report.combat.mainProbabilityPct < 42 || report.combat.towerProbabilityPct < 45 ? 'warn' : 'good',
    }),
    buildSeasonBalanceRow({
      id: 'economy-curve',
      label: '재화 곡선',
      value: `${report.offlineProjection.hourlyCredits.toLocaleString('ko-KR')} Cr/h`,
      detail: `상시 연구 총 Lv.${totalUpgradeLevel}, 크레딧 ${Number(current.credits || 0).toLocaleString('ko-KR')} Cr입니다.`,
      tone: Number(current.credits || 0) < 3000 && totalUpgradeLevel < 10 ? 'warn' : 'normal',
    }),
    buildSeasonBalanceRow({
      id: 'tower-supply',
      label: '탑 보급',
      value: `열쇠 ${Number(current.inventory.itm_tower_key || 0)} / 토큰 ${Number(current.inventory.itm_tower_token || 0)}`,
      detail: `픽업 ${shopRotation.dailyCount + shopRotation.weeklyCount}개, 리셋 가능 ${shopRotation.canResetDaily || shopRotation.canResetWeekly ? '있음' : '없음'}입니다.`,
      tone: Number(current.inventory.itm_tower_key || 0) <= 0 ? 'warn' : 'good',
    }),
    buildSeasonBalanceRow({
      id: 'salvage-risk',
      label: '분해 리스크',
      value: `${salvageInfo.executableCount}개 / 위험 ${salvageInfo.highRiskCount}개`,
      detail: salvageInfo.candidateOnly ? '후보만 분해가 켜져 있어 고위험 장비를 보호합니다.' : '후보만 분해가 꺼져 있어 실행 전 목록 확인이 필요합니다.',
      tone: salvageInfo.highRiskCount && !salvageInfo.candidateOnly ? 'warn' : 'normal',
    }),
    buildSeasonBalanceRow({
      id: 'idle-cap',
      label: '방치 상한',
      value: `${report.offlineProjection.capHours}시간`,
      detail: `상한 기준 예상 ${Math.round(report.offlineProjection.hourlyCredits * report.offlineProjection.capHours).toLocaleString('ko-KR')} Cr, 토큰 +${report.offlineProjection.hourlyTokens * report.offlineProjection.capHours}입니다.`,
      tone: 'normal',
    }),
  ];
  const balanceWarnCount = balanceRows.filter((row) => row.tone === 'warn').length;
  const riskLabel = urgentTracks.length >= 2 || balanceWarnCount >= 2
    ? '위험'
    : urgentTracks.length || balanceWarnCount
      ? '점검'
      : '안정';
  const nextTrack = tracks
    .filter((track) => track.status !== 'complete')
    .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) || a.pct - b.pct)[0] || tracks[0];

  return {
    seasonId: `S${seasonNumber}`,
    seasonName: `샬레 장기 당직 S${seasonNumber}`,
    seasonDay,
    seasonLengthDays,
    daysLeft,
    seasonPct,
    riskLabel,
    headline: `${nextTrack.title} · 시즌 ${seasonPct}%`,
    tracks,
    balanceRows,
    milestones: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      pct: track.pct,
      status: track.status,
      priority: track.priority,
    })),
    recommendations: [
      nextTrack ? `${nextTrack.title}: ${nextTrack.action}` : '',
      dailyPlan.priorityActions[0] ? `오늘 우선: ${dailyPlan.priorityActions[0].title}` : '',
      report.recommendations[0] ? `성장 판단: ${report.recommendations[0].title}` : '',
      balanceWarnCount ? `밸런스 점검 ${balanceWarnCount}건을 먼저 해소하세요.` : '현재 시즌 밸런스는 안정권입니다.',
    ].filter(Boolean).slice(0, 4),
  };
}

function rewardTextForRows(rewardItems = []) {
  return rewardItems
    .map((reward) => `${itemName(reward.itemId)} ${Number(reward.qty || 0).toLocaleString('ko-KR')}개`)
    .join(', ');
}

function seasonRewardClaimKey(seasonId, rewardId) {
  return `${seasonId}:${rewardId}`;
}

export function seasonRewardRows(state) {
  const current = normalizeState(state);
  const season = seasonOperationsReportForState(current);
  const claimed = new Set(current.seasonRewardClaims || []);
  const rows = SEASON_REWARD_TABLE.map((reward) => {
    const claimKey = seasonRewardClaimKey(season.seasonId, reward.id);
    const progress = Math.min(Number(season.seasonPct || 0), Number(reward.seasonPct || 0));
    const pct = Math.round(progress / Math.max(1, Number(reward.seasonPct || 1)) * 100);
    const done = Number(season.seasonPct || 0) >= Number(reward.seasonPct || 0);
    const claimedThisSeason = claimed.has(claimKey);
    return {
      ...reward,
      seasonId: season.seasonId,
      claimKey,
      pct,
      progress: Number(season.seasonPct || 0),
      target: Number(reward.seasonPct || 0),
      done,
      claimed: claimedThisSeason,
      canClaim: done && !claimedThisSeason,
      status: claimedThisSeason ? 'claimed' : done ? 'ready' : 'locked',
      rewardText: [
        reward.rewardCredits ? `${Number(reward.rewardCredits || 0).toLocaleString('ko-KR')} Cr` : '',
        rewardTextForRows(reward.rewardItems),
      ].filter(Boolean).join(' / '),
    };
  });
  const claimable = rows.filter((row) => row.canClaim);
  const claimedCount = rows.filter((row) => row.claimed).length;
  return {
    seasonId: season.seasonId,
    seasonName: season.seasonName,
    seasonPct: season.seasonPct,
    rows,
    claimableCount: claimable.length,
    claimedCount,
    totalCount: rows.length,
    nextReward: rows.find((row) => !row.claimed) || rows[rows.length - 1],
    headline: claimable.length
      ? `${claimable.length}개 시즌 보상 수령 가능`
      : rows.every((row) => row.claimed)
        ? '이번 시즌 보상을 모두 수령했습니다.'
        : `${rows.find((row) => !row.claimed)?.name || '시즌 보상'}까지 진행 중`,
  };
}

export function claimSeasonRewardsAction(state) {
  const current = normalizeState(state);
  const rewardReport = seasonRewardRows(current);
  const claimable = rewardReport.rows.filter((row) => row.canClaim);
  if (!claimable.length) return addLog(current, '수령 가능한 시즌 보상이 없습니다.');

  let credits = 0;
  let inventory = { ...current.inventory };
  const claimKeys = new Set(current.seasonRewardClaims || []);
  claimable.forEach((row) => {
    claimKeys.add(row.claimKey);
    credits += Number(row.rewardCredits || 0);
    inventory = addItems(inventory, row.rewardItems);
  });

  return addLog({
    ...current,
    credits: Number(current.credits || 0) + credits,
    inventory,
    seasonRewardClaims: [...claimKeys],
    updatedAt: new Date().toISOString(),
  }, `시즌 보상 ${claimable.length}개 수령. +${credits.toLocaleString('ko-KR')} Cr.`);
}

function minutesBetween(from, to) {
  const fromMs = new Date(from || '').getTime();
  const toMs = new Date(to || '').getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / 60000));
}

function buildSyncRow(id, label, value, detail, status = 'ready') {
  return { id, label, value, detail, status };
}

export function accountSyncReportForState(state) {
  const current = normalizeState(state);
  const summary = {
    floor: current.maxClearedFloor,
    tower: current.towerMaxCleared,
    power: teamPower(current),
    score: scoreState(current),
    credits: Number(current.credits || 0),
  };
  const dirtyMinutes = minutesBetween(current.lastSavedAt, current.updatedAt);
  const saveFreshnessPct = dirtyMinutes <= 0 ? 100 : dirtyMinutes <= 10 ? 82 : dirtyMinutes <= 60 ? 58 : 32;
  const presetCount = Number(current.equipmentPresets?.length || 0);
  const equippedCount = getEquippedList(current).length;
  const missionReady = missionRows(current).filter((mission) => mission.done && !mission.claimed).length;
  const achievementReady = achievementRows(current).filter((achievement) => achievement.canClaim).length;
  const seasonRewards = seasonRewardRows(current);
  const syncScore = Math.round(clamp(
    saveFreshnessPct * 0.34
      + Math.min(100, equippedCount * 18) * 0.16
      + Math.min(100, presetCount * 34) * 0.12
      + Math.min(100, Number(current.seasonRewardClaims?.length || 0) * 22 + seasonRewards.claimedCount * 12) * 0.14
      + Math.min(100, (missionReady + achievementReady + seasonRewards.claimableCount) ? 60 : 100) * 0.10
      + Math.min(100, Object.values(current.counters || {}).reduce((sum, value) => sum + Number(value || 0), 0) / 5) * 0.14,
    0,
    100,
  ));
  const statusLabel = dirtyMinutes <= 0
    ? '동기화됨'
    : dirtyMinutes <= 10
      ? '저장 권장'
      : '저장 필요';
  const syncRows = [
    buildSyncRow(
      'save-slot',
      '빠른 저장 슬롯',
      statusLabel,
      dirtyMinutes <= 0
        ? '현재 진행 상태가 저장 기준 시각과 일치합니다.'
        : `마지막 저장 이후 약 ${dirtyMinutes}분 분량의 진행이 로컬에만 있습니다.`,
      dirtyMinutes <= 0 ? 'complete' : 'ready',
    ),
    buildSyncRow(
      'record-snapshot',
      '전적 스냅샷',
      summary.score.toLocaleString('ko-KR'),
      `최고 F${summary.floor}, 탑 ${summary.tower}층, 전투력 ${summary.power.toLocaleString('ko-KR')} 기준으로 기록됩니다.`,
      'ready',
    ),
    buildSyncRow(
      'offline',
      '오프라인 보상',
      current.offlineLastSummary?.waves ? `${current.offlineLastSummary.waves}웨이브` : '대기 없음',
      current.offlineLastSummary?.waves
        ? `최근 오프라인 정산 크레딧 ${Number(current.offlineLastSummary.creditsGained || 0).toLocaleString('ko-KR')} Cr이 요약에 포함됩니다.`
        : '저장 데이터를 불러오면 지난 접속 시간 보상이 자동 반영됩니다.',
      current.offlineLastSummary?.waves ? 'complete' : 'idle',
    ),
    buildSyncRow(
      'season',
      '시즌 보상 상태',
      `${seasonRewards.claimedCount}/${seasonRewards.totalCount}`,
      seasonRewards.claimableCount
        ? `수령 가능한 시즌 보상 ${seasonRewards.claimableCount}개가 남아 있습니다.`
        : `시즌 진행률 ${seasonRewards.seasonPct}% 기준 보상 상태가 요약됩니다.`,
      seasonRewards.claimableCount ? 'ready' : 'complete',
    ),
    buildSyncRow(
      'presets',
      '장비 프리셋',
      `${presetCount}개`,
      presetCount
        ? '저장 슬롯 payload에 장비 프리셋과 활성 프리셋이 함께 보존됩니다.'
        : '탑/방치용 프리셋을 저장해두면 장기 계정 성장 동기화 품질이 올라갑니다.',
      presetCount ? 'complete' : 'idle',
    ),
  ];
  const payloadRows = [
    { label: '저장 payload', value: 'state 전체', detail: '장비, 프리셋, 상점 로테이션, 미션, 시즌 보상, 로그를 포함합니다.' },
    { label: '전적 summary', value: 'account-progress', detail: '층/탑/전투력/점수/성장 리포트/시즌 리포트를 요약 저장합니다.' },
    { label: '복귀 보정', value: `${Math.round(OFFLINE_CAP_MS / (60 * 60 * 1000))}시간 상한`, detail: '불러오기 시 오프라인 정산을 적용한 뒤 화면 상태를 갱신합니다.' },
  ];
  const recommendations = [];
  if (dirtyMinutes > 0) recommendations.push('현재 로컬 진행이 저장 슬롯보다 앞서 있습니다. 저장을 눌러 서버 상태를 맞추세요.');
  if (missionReady || achievementReady) recommendations.push('미션/업적 보상 수령 후 저장하면 계정 성장 요약이 더 정확합니다.');
  if (seasonRewards.claimableCount) recommendations.push('시즌 보상을 수령한 뒤 전적 스냅샷을 남기면 시즌 진행 기록이 깔끔합니다.');
  if (!presetCount) recommendations.push('장비 프리셋을 하나 저장하면 탑/방치 세팅 복원성이 좋아집니다.');
  if (!recommendations.length) recommendations.push('저장 슬롯과 전적 스냅샷을 번갈아 남기면 장기 계정 성장 흐름을 안정적으로 추적할 수 있습니다.');
  return {
    syncScore,
    statusLabel,
    dirtyMinutes,
    summary,
    syncRows,
    payloadRows,
    recommendations,
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  return Math.max(0, Math.round(
    Number(current.maxClearedFloor || 0) * 35
    + Number(current.towerMaxCleared || 0) * 80
    + Number(current.credits || 0)
    + teamPower(current) * 4
    + getEquippedList(current).reduce((sum, equip) => sum + equipmentScore(equip), 0) * 6
    + Number(current.counters.REROLL || 0) * 40
    + Number(current.counters.SALVAGE || 0) * 12
    + Number(current.counters.SHOP_BUY || 0) * 35
    + Number(current.counters.UPGRADE || 0) * 120
    + achievementRows(current).filter((achievement) => achievement.claimed).length * 250
    + Number(current.seasonRewardClaims?.length || 0) * 180
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
    floor: current.floor,
    maxClearedFloor: current.maxClearedFloor,
    towerFloor: current.towerFloor,
    towerMaxCleared: current.towerMaxCleared,
    credits: current.credits,
    stamina: current.stamina,
    power: teamPower(current),
    score: scoreState(current),
    rerolls: Number(current.counters.REROLL || 0),
    salvaged: Number(current.counters.SALVAGE || 0),
    towerShopBuys: Number(current.counters.SHOP_BUY || 0),
    upgrades: { ...current.upgrades },
    salvageQueued: current.salvageQueue.length,
    achievements: achievementRows(current).filter((achievement) => achievement.claimed).length,
    equippedTitle: titleById(current.equippedTitleId)?.name || '',
    growthReport: (() => {
      const report = growthReportForState(current);
      return {
        statusTone: report.statusTone,
        headline: report.headline,
        overallPct: report.overallPct,
        mainProbabilityPct: report.combat.mainProbabilityPct,
        towerProbabilityPct: report.combat.towerProbabilityPct,
        blockers: report.blockers,
        recommendations: report.recommendations.map((item) => item.title),
      };
    })(),
    growthRoadmap: (() => {
      const roadmap = growthRoadmapForState(current);
      return {
        headline: roadmap.headline,
        completionPct: roadmap.completionPct,
        nextAction: roadmap.nextAction?.title || '',
        sections: roadmap.sections.map((section) => ({
          id: section.id,
          label: section.label,
          pct: section.pct,
          done: section.done,
          total: section.total,
        })),
      };
    })(),
    dailyOperations: (() => {
      const plan = dailyOperationsPlanForState(current);
      return {
        headline: plan.headline,
        readinessPct: plan.readinessPct,
        riskLabel: plan.riskLabel,
        highPriorityCount: plan.highPriorityCount,
        nextActions: plan.priorityActions.map((item) => item.title),
      };
    })(),
    seasonOperations: (() => {
      const season = seasonOperationsReportForState(current);
      const rewards = seasonRewardRows(current);
      return {
        seasonId: season.seasonId,
        headline: season.headline,
        seasonPct: season.seasonPct,
        riskLabel: season.riskLabel,
        tracks: season.milestones,
        balanceWarnCount: season.balanceRows.filter((row) => row.tone === 'warn').length,
        rewards: {
          headline: rewards.headline,
          claimed: rewards.claimedCount,
          claimable: rewards.claimableCount,
          total: rewards.totalCount,
          nextReward: rewards.nextReward?.name || '',
        },
      };
    })(),
    accountSync: (() => {
      const sync = accountSyncReportForState(current);
      return {
        syncScore: sync.syncScore,
        statusLabel: sync.statusLabel,
        dirtyMinutes: sync.dirtyMinutes,
        rows: sync.syncRows.map((row) => ({
          id: row.id,
          label: row.label,
          value: row.value,
          status: row.status,
        })),
      };
    })(),
    lastDutyReport: current.lastDutyReport ? {
      fromFloor: current.lastDutyReport.fromFloor,
      toFloor: current.lastDutyReport.toFloor,
      credits: current.lastDutyReport.totalCreditsGained,
      stoppedReason: current.lastDutyReport.stoppedReason,
    } : null,
    offlineLastSummary: current.offlineLastSummary ? {
      waves: Number(current.offlineLastSummary.waves || 0),
      credits: Number(current.offlineLastSummary.creditsGained || 0),
      tokens: Number(current.offlineLastSummary.tokensGained || 0),
    } : null,
  };
}
