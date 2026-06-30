// Export the current Item collection into the default item tree seed file.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// This script intentionally does not print MONGO_URI or any credentials.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Item = require('../models/Item');

const OUT_PATH = path.resolve(__dirname, '../utils/defaultItemTree.generated.json');

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

function buildCoreKey(doc) {
  const type = cleanString(doc?.type || '기타');
  const slot = cleanString(doc?.equipSlot);
  const weaponType = cleanString(doc?.weaponType);
  const tier = toNumber(doc?.tier, 1);
  const name = cleanString(doc?.name || 'item');
  return `core:${type}:${slot}:${weaponType}:${tier}:${name}`;
}

function itemSeedKey(doc) {
  return cleanString(doc?.itemKey) || cleanString(doc?.externalId) || buildCoreKey(doc);
}

function sanitizeStats(stats) {
  const s = stats && typeof stats === 'object' ? stats : {};
  const out = {};
  for (const key of ['atk', 'def', 'hp', 'skillAmp', 'atkSpeed', 'critChance', 'cdr', 'lifesteal', 'moveSpeed', 'armorPen', 'adaptiveForce']) {
    const value = toNumber(s[key], 0);
    if (value !== 0) out[key] = value;
  }
  return out;
}

function sanitizeRecipe(doc, byId) {
  const recipe = doc?.recipe && typeof doc.recipe === 'object' ? doc.recipe : {};
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const recipeKeys = ingredients
    .map((ingredient) => {
      const rawId = ingredient?.itemId?._id || ingredient?.itemId;
      const ref = rawId ? byId.get(String(rawId)) : null;
      const key = ref ? itemSeedKey(ref) : '';
      if (!key) return null;
      return {
        key,
        qty: Math.max(1, Math.floor(toNumber(ingredient?.qty, 1))),
      };
    })
    .filter(Boolean);

  return {
    recipeKeys,
    recipeCreditsCost: Math.max(0, Math.floor(toNumber(recipe.creditsCost, 0))),
    recipeResultQty: Math.max(1, Math.floor(toNumber(recipe.resultQty, 1))),
  };
}

function sanitizeItem(doc, byId) {
  const recipe = sanitizeRecipe(doc, byId);
  const out = {
    key: itemSeedKey(doc),
    externalId: cleanString(doc.externalId) || undefined,
    name: cleanString(doc.name),
    type: cleanString(doc.type || '기타'),
    tags: uniqStrings(doc.tags),
    rarity: cleanString(doc.rarity || 'common'),
    tier: Math.max(1, Math.floor(toNumber(doc.tier, 1))),
    erCode: cleanString(doc.erCode),
    itemSubType: cleanString(doc.itemSubType),
    stackMax: Math.max(1, Math.floor(toNumber(doc.stackMax, 1))),
    baseCreditValue: Math.max(0, Math.floor(toNumber(doc.baseCreditValue ?? doc.value, 0))),
    stats: sanitizeStats(doc.stats),
    equipSlot: cleanString(doc.equipSlot),
    weaponType: cleanString(doc.weaponType),
    archetype: cleanString(doc.archetype),
    spawnZones: uniqStrings(doc.spawnZones),
    spawnCrateTypes: uniqStrings(doc.spawnCrateTypes),
    droneCreditsCost: Math.max(0, Math.floor(toNumber(doc.droneCreditsCost, 0))),
    upgradeItemKeys: uniqStrings(doc.upgradeItemKeys),
    source: cleanString(doc.source || 'db.snapshot'),
    lockedByAdmin: Boolean(doc.lockedByAdmin),
    description: cleanString(doc.description),
    image: cleanString(doc.image),
    recipeKeys: recipe.recipeKeys,
    recipeCreditsCost: recipe.recipeCreditsCost,
    recipeResultQty: recipe.recipeResultQty,
  };

  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
    else if (Array.isArray(out[key]) && out[key].length === 0) delete out[key];
    else if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key]) && Object.keys(out[key]).length === 0) delete out[key];
    else if (out[key] === '') delete out[key];
    else if ((key === 'recipeCreditsCost' || key === 'droneCreditsCost') && out[key] === 0) delete out[key];
    else if (key === 'recipeResultQty' && out[key] === 1) delete out[key];
    else if (key === 'lockedByAdmin' && out[key] === false) delete out[key];
  }

  return out;
}

function dedupeByKey(items) {
  const seen = new Set();
  const out = [];
  const duplicateKeys = [];
  for (const item of items) {
    const key = cleanString(item.key);
    if (!key) continue;
    if (seen.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return { out, duplicateKeys };
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required');

  await mongoose.connect(mongoUri);
  const docs = await Item.find({}).sort({ type: 1, tier: 1, rarity: 1, name: 1, _id: 1 }).lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const exported = docs.map((doc) => sanitizeItem(doc, byId)).filter((item) => item.key && item.name);
  const { out, duplicateKeys } = dedupeByKey(exported);

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    sourceCount: docs.length,
    exportedCount: out.length,
    duplicateSkippedCount: duplicateKeys.length,
    outPath: OUT_PATH,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
