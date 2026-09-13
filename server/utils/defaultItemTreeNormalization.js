// Pure seed normalization shared by the server and the guest catalog generator.
// No database or server runtime dependencies; never imported by the browser.

const CRIMSON_SHARD_KEY = 'namu:material:진홍의 샤드';
const DAWN_SHARD_KEY = 'namu:material:새벽빛 샤드';
const SHARD_ITEM_DEFS = [
  {
    key: CRIMSON_SHARD_KEY,
    externalId: CRIMSON_SHARD_KEY,
    name: '진홍의 샤드',
    type: '재료',
    tags: ['namu', 'material', 'shard', 'transcendent', 'crimson'],
    rarity: 'transcendent',
    tier: 6,
    stackMax: 1,
    baseCreditValue: 0,
    source: 'default.seed.system',
    lockedByAdmin: true,
    description: '초월 장비를 진홍 파생 장비로 강화하는 샤드입니다.',
  },
  {
    key: DAWN_SHARD_KEY,
    externalId: DAWN_SHARD_KEY,
    name: '새벽빛 샤드',
    type: '재료',
    tags: ['namu', 'material', 'shard', 'transcendent', 'dawn'],
    rarity: 'transcendent',
    tier: 6,
    stackMax: 1,
    baseCreditValue: 0,
    source: 'default.seed.system',
    lockedByAdmin: true,
    description: '초월 장비를 새벽 파생 장비로 강화하는 샤드입니다.',
  },
];

function cleanString(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map(cleanString).filter(Boolean))];
}

function normalizeStats(stats) {
  const s = stats && typeof stats === 'object' ? stats : {};
  return {
    atk: toNumber(s.atk, 0),
    def: toNumber(s.def, 0),
    hp: toNumber(s.hp, 0),
    skillAmp: toNumber(s.skillAmp, 0),
    atkSpeed: toNumber(s.atkSpeed, 0),
    critChance: toNumber(s.critChance, 0),
    cdr: toNumber(s.cdr, 0),
    lifesteal: toNumber(s.lifesteal, 0),
    moveSpeed: toNumber(s.moveSpeed, 0),
    armorPen: toNumber(s.armorPen, 0),
    adaptiveForce: toNumber(s.adaptiveForce, 0),
  };
}

function treeKey(def) {
  return cleanString(def?.itemKey || def?.key || def?.externalId);
}

function fallbackTreeKey(def) {
  const type = cleanString(def?.type || '기타');
  const slot = cleanString(def?.equipSlot);
  const weaponType = cleanString(def?.weaponType);
  const tier = Math.max(1, Math.floor(toNumber(def?.tier, 1)));
  const name = cleanString(def?.name || 'item');
  return `core:${type}:${slot}:${weaponType}:${tier}:${name}`;
}

function normalizeTreeDef(def) {
  const key = treeKey(def) || fallbackTreeKey(def);
  const name = cleanString(def?.name);
  if (!key || !name) return null;

  return {
    key,
    externalId: cleanString(def?.externalId) || undefined,
    name,
    type: cleanString(def?.type || '기타'),
    tags: uniqStrings(def?.tags),
    rarity: cleanString(def?.rarity || 'common'),
    tier: Math.max(1, Math.floor(toNumber(def?.tier, 1))),
    erCode: cleanString(def?.erCode),
    itemSubType: cleanString(def?.itemSubType),
    stackMax: Math.max(1, Math.floor(toNumber(def?.stackMax, 1))),
    baseCreditValue: Math.max(0, Math.floor(toNumber(def?.baseCreditValue ?? def?.value, 0))),
    stats: normalizeStats(def?.stats),
    equipSlot: cleanString(def?.equipSlot),
    weaponType: cleanString(def?.weaponType),
    archetype: cleanString(def?.archetype),
    spawnZones: uniqStrings(def?.spawnZones),
    spawnCrateTypes: uniqStrings(def?.spawnCrateTypes),
    droneCreditsCost: Math.max(0, Math.floor(toNumber(def?.droneCreditsCost, 0))),
    upgradeItemKeys: uniqStrings(def?.upgradeItemKeys),
    source: cleanString(def?.source || 'default.seed.generated'),
    lockedByAdmin: Boolean(def?.lockedByAdmin),
    description: cleanString(def?.description),
    image: cleanString(def?.image),
    recipeKeys: (Array.isArray(def?.recipeKeys) ? def.recipeKeys : [])
      .map((row) => ({
        key: cleanString(row?.key),
        qty: Math.max(1, Math.floor(toNumber(row?.qty, 1))),
      }))
      .filter((row) => row.key),
    recipeCreditsCost: Math.max(0, Math.floor(toNumber(def?.recipeCreditsCost, 0))),
    recipeResultQty: Math.max(1, Math.floor(toNumber(def?.recipeResultQty, 1))),
  };
}

function normalizeDefaultItemTree(list = []) {
  const byKey = new Map();
  for (const raw of [...SHARD_ITEM_DEFS, ...(Array.isArray(list) ? list : [])]) {
    const def = normalizeTreeDef(raw);
    const hasNamuId = cleanString(def?.key).startsWith('namu:') || cleanString(def?.externalId).startsWith('namu:');
    if (!hasNamuId) continue;
    if (!def || byKey.has(def.key)) continue;
    byKey.set(def.key, def);
  }
  return applyShardVariantRecipes([...byKey.values()]);
}

function isTranscendentDef(def) {
  const rarity = cleanString(def?.rarity).toLowerCase();
  return rarity === 'transcendent' || rarity === '초월' || Math.floor(toNumber(def?.tier, 0)) >= 6;
}

function getShardVariantInfo(def) {
  if (!isTranscendentDef(def)) return null;
  const name = cleanString(def?.name);
  const match = name.match(/[-\s]+(진홍|새벽)$/);
  if (!match) return null;
  const baseName = name.slice(0, match.index).trim();
  if (!baseName) return null;
  const shardKey = match[1] === '진홍' ? CRIMSON_SHARD_KEY : DAWN_SHARD_KEY;
  return { baseName, shardKey };
}

function shouldRefreshOnMissing(def) {
  const key = cleanString(def?.key);
  return key === CRIMSON_SHARD_KEY || key === DAWN_SHARD_KEY || Boolean(getShardVariantInfo(def));
}

function scoreBaseCandidate(variant, candidate) {
  let score = 0;
  if (candidate?.key === variant?.key) return -1;
  if (cleanString(candidate?.type) === cleanString(variant?.type)) score += 10;
  if (cleanString(candidate?.equipSlot) && cleanString(candidate?.equipSlot) === cleanString(variant?.equipSlot)) score += 8;
  if (cleanString(candidate?.weaponType) && cleanString(candidate?.weaponType) === cleanString(variant?.weaponType)) score += 8;
  if (cleanString(candidate?.itemSubType) && cleanString(candidate?.itemSubType) === cleanString(variant?.itemSubType)) score += 8;
  if (!getShardVariantInfo(candidate)) score += 4;
  if (isTranscendentDef(candidate)) score += 2;
  return score;
}

function findShardVariantBase(def, byName) {
  const info = getShardVariantInfo(def);
  if (!info) return null;
  const candidates = byName.get(info.baseName) || [];
  return [...candidates]
    .sort((a, b) => scoreBaseCandidate(def, b) - scoreBaseCandidate(def, a))[0] || null;
}

function applyShardVariantRecipes(tree) {
  const byName = new Map();
  for (const def of tree) {
    const name = cleanString(def?.name);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(def);
  }

  return tree.map((def) => {
    const info = getShardVariantInfo(def);
    if (!info) return def;
    const base = findShardVariantBase(def, byName);
    if (!base?.key) return def;
    return {
      ...def,
      recipeKeys: [
        { key: base.key, qty: 1 },
        { key: info.shardKey, qty: 1 },
      ],
      recipeCreditsCost: 0,
      recipeResultQty: 1,
    };
  });
}

module.exports = {
  cleanString,
  toNumber,
  normalizeDefaultItemTree,
  getShardVariantInfo,
  shouldRefreshOnMissing,
};
