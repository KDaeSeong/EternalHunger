// server/utils/defaultItemTree.js
// Default item tree seed.
// The seed body is generated from MongoDB Item documents into
// defaultItemTree.generated.json by scripts/export_default_item_tree_from_db.js.

const Item = require('../models/Item');
const DEFAULT_ITEM_TREE = require('./defaultItemTree.generated.json');

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

function normalizeTree(list = DEFAULT_ITEM_TREE) {
  const byKey = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const def = normalizeTreeDef(raw);
    if (!def || byKey.has(def.key)) continue;
    byKey.set(def.key, def);
  }
  return [...byKey.values()];
}

function scopeQuery(ownerUserId, extra = {}) {
  if (ownerUserId) return { ownerUserId, ...(extra || {}) };
  const base = extra || {};
  const legacyClause = {
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $exists: false } },
    ],
  };
  if (base.$or || base.$and) return { $and: [base, legacyClause] };
  return {
    ...base,
    ...legacyClause,
  };
}

function findExistingForDef(def, indexes) {
  if (!def) return null;
  return indexes.byItemKey.get(def.key)
    || (def.externalId ? indexes.byExternalId.get(def.externalId) : null)
    || indexes.byName.get(def.name)
    || null;
}

function indexItems(items) {
  const byItemKey = new Map();
  const byExternalId = new Map();
  const byName = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const itemKey = cleanString(item?.itemKey);
    const externalId = cleanString(item?.externalId);
    const name = cleanString(item?.name);
    if (itemKey && !byItemKey.has(itemKey)) byItemKey.set(itemKey, item);
    if (externalId && !byExternalId.has(externalId)) byExternalId.set(externalId, item);
    if (name && !byName.has(name)) byName.set(name, item);
  }
  return { byItemKey, byExternalId, byName };
}

function toBaseDoc(def, ownerUserId) {
  const doc = {
    itemKey: def.key,
    externalId: def.externalId,
    name: def.name,
    type: def.type,
    tags: def.tags,
    rarity: def.rarity,
    tier: def.tier,
    erCode: def.erCode,
    itemSubType: def.itemSubType,
    stackMax: def.stackMax,
    value: def.baseCreditValue,
    baseCreditValue: def.baseCreditValue,
    stats: def.stats,
    equipSlot: def.equipSlot,
    weaponType: def.weaponType,
    archetype: def.archetype,
    spawnZones: def.spawnZones,
    spawnCrateTypes: def.spawnCrateTypes,
    droneCreditsCost: def.droneCreditsCost,
    upgradeItemKeys: def.upgradeItemKeys,
    source: def.source,
    ownerUserId,
    generatedByUserId: null,
    generatedAt: null,
    lockedByAdmin: def.lockedByAdmin,
    description: def.description,
    image: def.image,
  };

  for (const key of Object.keys(doc)) {
    if (doc[key] === undefined) delete doc[key];
  }
  return doc;
}

async function upsertDefaultItemTree(opts = {}) {
  const rawMode = cleanString(opts?.mode).toLowerCase();
  const mode = rawMode === 'replace' ? 'replace' : rawMode === 'force' ? 'force' : 'missing';
  const ownerUserId = opts?.ownerUserId || null;
  const tree = normalizeTree();
  const keys = tree.map((def) => def.key);
  const externalIds = tree.map((def) => def.externalId).filter(Boolean);
  const names = tree.map((def) => def.name);

  const clauses = [
    { itemKey: { $in: keys } },
    { name: { $in: names } },
  ];
  if (externalIds.length) clauses.push({ externalId: { $in: externalIds } });

  const existing = await Item.find(scopeQuery(ownerUserId, { $or: clauses }));
  const indexes = indexItems(existing);

  const created = [];
  const updated = [];
  const skipped = [];
  const itemOps = [];

  for (const def of tree) {
    const exist = findExistingForDef(def, indexes);
    const baseDoc = toBaseDoc(def, ownerUserId);

    if (!exist) {
      itemOps.push({ insertOne: { document: baseDoc } });
      created.push({ key: def.key, name: def.name });
      continue;
    }

    if (mode === 'force' || mode === 'replace') {
      itemOps.push({
        updateOne: {
          filter: { _id: exist._id },
          update: { $set: baseDoc },
        },
      });
      updated.push({ key: def.key, name: def.name, id: String(exist._id) });
      continue;
    }

    skipped.push({ key: def.key, name: def.name, id: String(exist._id) });
  }

  if (itemOps.length) {
    await Item.bulkWrite(itemOps, { ordered: false, runValidators: true });
  }

  const nextIndexes = indexItems(await Item.find(scopeQuery(ownerUserId, { itemKey: { $in: keys } })));

  const recipeUpdated = [];
  const recipeOps = [];
  for (const def of tree) {
    if (!Array.isArray(def.recipeKeys) || def.recipeKeys.length === 0) continue;
    const target = nextIndexes.byItemKey.get(def.key);
    if (!target) continue;

    if (mode !== 'force' && mode !== 'replace') {
      const existingIngredients = target?.recipe?.ingredients;
      if (Array.isArray(existingIngredients) && existingIngredients.length > 0) continue;
    }

    const ingredients = [];
    for (const row of def.recipeKeys) {
      const ingredient = nextIndexes.byItemKey.get(row.key);
      if (!ingredient?._id) continue;
      ingredients.push({ itemId: ingredient._id, qty: Math.max(1, Math.floor(toNumber(row.qty, 1))) });
    }
    if (!ingredients.length) continue;

    recipeOps.push({
      updateOne: {
        filter: { _id: target._id },
        update: {
          $set: {
            recipe: {
              ingredients,
              creditsCost: def.recipeCreditsCost,
              resultQty: def.recipeResultQty,
            },
          },
        },
      },
    });
    recipeUpdated.push({ key: def.key, name: def.name, id: String(target._id) });
  }

  if (recipeOps.length) {
    await Item.bulkWrite(recipeOps, { ordered: false, runValidators: true });
  }

  let deletedCount = 0;
  const deleted = [];
  if (mode === 'replace') {
    const extras = await Item.find(scopeQuery(ownerUserId, { itemKey: { $nin: keys } }))
      .select('_id itemKey externalId name')
      .lean();
    if (extras.length) {
      const ids = extras.map((item) => item._id);
      const result = await Item.deleteMany({ _id: { $in: ids } });
      deletedCount = result?.deletedCount || 0;
      deleted.push(...extras.slice(0, 100).map((item) => ({
        key: cleanString(item.itemKey || item.externalId),
        name: cleanString(item.name),
        id: String(item._id),
      })));
    }
  }

  return {
    mode,
    treeCount: tree.length,
    createdCount: created.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    recipeUpdatedCount: recipeUpdated.length,
    deletedCount,
    created: created.slice(0, 100),
    updated: updated.slice(0, 100),
    skipped: skipped.slice(0, 100),
    recipeUpdated: recipeUpdated.slice(0, 100),
    deleted,
  };
}

module.exports = {
  DEFAULT_ITEM_TREE: normalizeTree(),
  upsertDefaultItemTree,
};
