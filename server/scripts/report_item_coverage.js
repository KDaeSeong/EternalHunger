require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const { EXPECT_WEAPON_TYPES, EXPECT_ARMOR_SLOTS, normalizeWeaponType } = require('../config/item_taxonomy');

const MONGO_URI = process.env.MONGO_URI;

function countBy(rows, key) {
  const out = new Map();
  for (const row of rows) {
    const v = String(row?.[key] || '').trim();
    if (!v) continue;
    out.set(v, (out.get(v) || 0) + 1);
  }
  return Object.fromEntries([...out.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko')));
}

function countByDerived(rows, getter) {
  const out = new Map();
  for (const row of rows) {
    const v = String(getter(row) || '').trim();
    if (!v) continue;
    out.set(v, (out.get(v) || 0) + 1);
  }
  return Object.fromEntries([...out.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko')));
}

function hasValues(arr) {
  return Array.isArray(arr) && arr.some(v => String(v || '').trim());
}

function spawnMetaBucket(row) {
  const hasZones = hasValues(row?.spawnZones);
  const hasCrates = hasValues(row?.spawnCrateTypes);
  if (hasZones && hasCrates) return 'both';
  if (hasZones) return 'zonesOnly';
  if (hasCrates) return 'cratesOnly';
  return 'none';
}

function summarizeSpawnMeta(rows) {
  const byStatus = { both: 0, zonesOnly: 0, cratesOnly: 0, none: 0 };
  for (const row of rows) {
    const bucket = spawnMetaBucket(row);
    byStatus[bucket] = (byStatus[bucket] || 0) + 1;
  }
  return {
    totals: {
      all: rows.length,
      withAny: rows.filter(r => spawnMetaBucket(r) !== 'none').length,
      withZones: rows.filter(r => hasValues(r?.spawnZones)).length,
      withCrates: rows.filter(r => hasValues(r?.spawnCrateTypes)).length,
      missingAll: rows.filter(r => spawnMetaBucket(r) === 'none').length,
      missingZones: rows.filter(r => !hasValues(r?.spawnZones)).length,
      missingCrates: rows.filter(r => !hasValues(r?.spawnCrateTypes)).length,
    },
    byStatus,
  };
}

function buildSpawnMetaSection(items) {
  const materialLike = items.filter(x => ['재료', '소모품'].includes(x.type));
  const spawnRelevant = items.filter(x => ['재료', '소모품'].includes(x.type) || x.source === 'er' || x.source === 'namu');
  const spawnMissing = spawnRelevant.filter(x => spawnMetaBucket(x) === 'none');

  return {
    relevantTotals: summarizeSpawnMeta(spawnRelevant),
    materialLikeTotals: summarizeSpawnMeta(materialLike),
    missingAllByType: countByDerived(spawnMissing, x => x.type || '기타'),
    missingAllBySource: countByDerived(spawnMissing, x => x.source || '(empty)'),
    missingAllBySubType: countByDerived(spawnMissing, x => x.itemSubType || '(empty)'),
    missingZonesBySource: countByDerived(
      spawnRelevant.filter(x => !hasValues(x?.spawnZones)),
      x => x.source || '(empty)'
    ),
    missingCratesBySource: countByDerived(
      spawnRelevant.filter(x => !hasValues(x?.spawnCrateTypes)),
      x => x.source || '(empty)'
    ),
    examples: {
      missingAll: spawnMissing.slice(0, 20).map(x => ({
        name: x.name,
        type: x.type,
        itemSubType: x.itemSubType || '',
        source: x.source || '',
        equipSlot: x.equipSlot || '',
        weaponType: x.weaponType || '',
      })),
    },
  };
}

async function main() {
  if (!MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(MONGO_URI);

  const items = await Item.find({}, {
    name: 1,
    type: 1,
    equipSlot: 1,
    weaponType: 1,
    itemSubType: 1,
    rarity: 1,
    tier: 1,
    source: 1,
    spawnZones: 1,
    spawnCrateTypes: 1,
  }).lean();

  for (const item of items) {
    if (item?.weaponType) item.weaponType = normalizeWeaponType(item.weaponType);
  }

  const weapons = items.filter(x => x.type === '무기');
  const armors = items.filter(x => x.type === '방어구');
  const materials = items.filter(x => x.type === '재료');
  const consumables = items.filter(x => x.type === '소모품');

  const weaponGroups = countBy(weapons, 'weaponType');
  const armorGroups = countBy(armors, 'equipSlot');
  const subtypeGroups = countBy(items, 'itemSubType');
  const sourceGroups = countBy(items, 'source');

  const missingWeapons = EXPECT_WEAPON_TYPES.filter(x => !weaponGroups[x]);
  const missingArmor = EXPECT_ARMOR_SLOTS.filter(x => !armorGroups[x]);
  const unknownWeaponTypes = Object.keys(weaponGroups).filter(x => !EXPECT_WEAPON_TYPES.includes(x));

  const summary = {
    totals: {
      all: items.length,
      weapons: weapons.length,
      armors: armors.length,
      materials: materials.length,
      consumables: consumables.length,
    },
    bySource: sourceGroups,
    weaponGroups,
    armorGroups,
    itemSubTypes: subtypeGroups,
    missing: {
      weaponTypes: missingWeapons,
      armorSlots: missingArmor,
    },
    unknown: {
      weaponTypes: unknownWeaponTypes,
    },
    spawnMeta: buildSpawnMetaSection(items),
  };

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ coverage report failed');
  console.error(err?.stack || err?.message || err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
