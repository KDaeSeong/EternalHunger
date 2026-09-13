import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import seedNormalization from '../../server/utils/defaultItemTreeNormalization.js';

export const GUEST_ITEM_CATALOG_SCHEMA_VERSION = 1;
export const GUEST_ITEM_CATALOG_GENERATOR_VERSION = '1.1.0';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const CLIENT_ROOT = resolve(SCRIPT_DIR, '..');
export const REPOSITORY_ROOT = resolve(CLIENT_ROOT, '..');
export const SOURCE_PATH = resolve(REPOSITORY_ROOT, 'server', 'utils', 'defaultItemTree.generated.json');
export const NORMALIZER_PATH = resolve(REPOSITORY_ROOT, 'server', 'utils', 'defaultItemTreeNormalization.js');
const normalizerSha256 = createHash('sha256').update(readFileSync(NORMALIZER_PATH)).digest('hex');
export const OUTPUT_PATH = resolve(
  CLIENT_ROOT,
  'src',
  'app',
  'simulation',
  '_generated',
  'guestItemCatalog.generated.js',
);

const STAT_KEYS = [
  'atk',
  'def',
  'hp',
  'skillAmp',
  'atkSpeed',
  'critChance',
  'cdr',
  'lifesteal',
  'moveSpeed',
  'armorPen',
  'adaptiveForce',
];

function cleanString(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function positiveInteger(value, fallback = 1) {
  return Math.max(1, Math.floor(finiteNumber(value, fallback)));
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanString).filter(Boolean))];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeStats(stats) {
  const source = stats && typeof stats === 'object' ? stats : {};
  return Object.fromEntries(STAT_KEYS.map((key) => [key, finiteNumber(source[key], 0)]));
}

function sourceItemKey(item) {
  return cleanString(item?.key || item?.itemKey || item?.externalId);
}

function validateSourceItems(sourceItems) {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
    throw new Error('defaultItemTree.generated.json must contain a non-empty array.');
  }

  const keys = new Set();
  for (const item of sourceItems) {
    const key = sourceItemKey(item);
    if (!key) throw new Error('Every source item must have a key.');
    if (!cleanString(item?.name)) throw new Error(`Source item ${key} has no name.`);
    if (keys.has(key)) throw new Error(`Duplicate source item key: ${key}`);
    keys.add(key);
  }

  let recipeReferenceCount = 0;
  let upgradeReferenceCount = 0;
  for (const item of sourceItems) {
    const fromKey = sourceItemKey(item);
    for (const ingredient of Array.isArray(item?.recipeKeys) ? item.recipeKeys : []) {
      const reference = cleanString(ingredient?.key);
      recipeReferenceCount += 1;
      if (!reference || !keys.has(reference)) {
        throw new Error(`Missing recipe reference: ${fromKey} -> ${reference || '(empty)'}`);
      }
      if (positiveInteger(ingredient?.qty, 1) !== finiteNumber(ingredient?.qty, 1)) {
        throw new Error(`Invalid recipe quantity: ${fromKey} -> ${reference}`);
      }
    }
    for (const referenceRaw of Array.isArray(item?.upgradeItemKeys) ? item.upgradeItemKeys : []) {
      const reference = cleanString(referenceRaw);
      upgradeReferenceCount += 1;
      if (!reference || !keys.has(reference)) {
        throw new Error(`Missing upgrade reference: ${fromKey} -> ${reference || '(empty)'}`);
      }
    }
  }

  return { keys, recipeReferenceCount, upgradeReferenceCount };
}

function normalizeGuestItem(sourceItem) {
  const key = sourceItemKey(sourceItem);
  const baseCreditValue = nonNegativeInteger(sourceItem?.baseCreditValue ?? sourceItem?.value, 0);
  const ingredients = (Array.isArray(sourceItem?.recipeKeys) ? sourceItem.recipeKeys : []).map((ingredient) => ({
    itemId: cleanString(ingredient?.key),
    qty: positiveInteger(ingredient?.qty, 1),
  }));

  return {
    _id: key,
    itemKey: key,
    externalId: cleanString(sourceItem?.externalId) || key,
    name: cleanString(sourceItem?.name),
    type: cleanString(sourceItem?.type) || '기타',
    tags: uniqueStrings(sourceItem?.tags),
    rarity: cleanString(sourceItem?.rarity) || 'common',
    tier: positiveInteger(sourceItem?.tier, 1),
    erCode: cleanString(sourceItem?.erCode),
    itemSubType: cleanString(sourceItem?.itemSubType),
    stackMax: positiveInteger(sourceItem?.stackMax, 1),
    value: baseCreditValue,
    baseCreditValue,
    recipe: {
      ingredients,
      creditsCost: nonNegativeInteger(sourceItem?.recipeCreditsCost, 0),
      resultQty: positiveInteger(sourceItem?.recipeResultQty, 1),
    },
    stats: normalizeStats(sourceItem?.stats),
    equipSlot: cleanString(sourceItem?.equipSlot),
    weaponType: cleanString(sourceItem?.weaponType),
    archetype: cleanString(sourceItem?.archetype),
    spawnZones: uniqueStrings(sourceItem?.spawnZones),
    spawnCrateTypes: uniqueStrings(sourceItem?.spawnCrateTypes),
    droneCreditsCost: nonNegativeInteger(sourceItem?.droneCreditsCost, 0),
    upgradeItemKeys: uniqueStrings(sourceItem?.upgradeItemKeys),
    source: cleanString(sourceItem?.source) || 'default.seed.generated',
    lockedByAdmin: Boolean(sourceItem?.lockedByAdmin),
    description: cleanString(sourceItem?.description),
  };
}

export function buildGuestItemCatalog(sourceBuffer) {
  const sourceBytes = Buffer.isBuffer(sourceBuffer)
    ? sourceBuffer
    : Buffer.from(String(sourceBuffer ?? ''), 'utf8');
  const sourceText = sourceBytes.toString('utf8');
  // Raw exports contain legacy rows and omit system shard recipes. Use exactly
  // the same pure transformation as server seeding, before translating IDs.
  const rawItems = JSON.parse(sourceText);
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('The raw seed must be a non-empty array.');
  const sourceItems = seedNormalization.normalizeDefaultItemTree(rawItems);
  const sourceIntegrity = validateSourceItems(sourceItems);
  const items = sourceItems.map(normalizeGuestItem);
  const catalogJson = JSON.stringify(items);
  const metadata = {
    schemaVersion: GUEST_ITEM_CATALOG_SCHEMA_VERSION,
    generatorVersion: GUEST_ITEM_CATALOG_GENERATOR_VERSION,
    sourcePath: 'server/utils/defaultItemTree.generated.json',
    sourceSha256: sha256(sourceBytes),
    normalizerPath: 'server/utils/defaultItemTreeNormalization.js',
    normalizerSha256,
    rawItemCount: rawItems.length,
    catalogSha256: sha256(Buffer.from(catalogJson, 'utf8')),
    itemCount: items.length,
    recipeCount: items.filter((item) => item.recipe.ingredients.length > 0).length,
    recipeReferenceCount: sourceIntegrity.recipeReferenceCount,
    upgradeReferenceCount: sourceIntegrity.upgradeReferenceCount,
  };
  return { items, metadata };
}

export function renderGuestItemCatalogModule({ items, metadata }) {
  const metadataText = JSON.stringify(metadata, null, 2);
  const itemsText = JSON.stringify(items, null, 2);
  return `// AUTO-GENERATED by client/scripts/generate-guest-item-catalog.mjs.\n` +
    `// Source: ${metadata.sourcePath} (${metadata.sourceSha256})\n` +
    `// Do not edit this file manually.\n\n` +
    `export const GUEST_ITEM_CATALOG_META = Object.freeze(${metadataText});\n\n` +
    `export const GUEST_ITEM_CATALOG = Object.freeze(${itemsText});\n\n` +
    `export default GUEST_ITEM_CATALOG;\n`;
}

export async function generateGuestItemCatalog({ check = false } = {}) {
  const sourceBuffer = await readFile(SOURCE_PATH);
  const built = buildGuestItemCatalog(sourceBuffer);
  const rendered = renderGuestItemCatalogModule(built);

  if (check) {
    const existing = await readFile(OUTPUT_PATH, 'utf8').catch(() => '');
    if (existing !== rendered) {
      throw new Error('Guest item catalog is stale. Run npm run generate:guest-item-catalog.');
    }
    return { ...built.metadata, outputPath: OUTPUT_PATH, status: 'current' };
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, rendered, 'utf8');
  return { ...built.metadata, outputPath: OUTPUT_PATH, status: 'written' };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await generateGuestItemCatalog({ check: process.argv.includes('--check') });
  console.log(JSON.stringify(result, null, 2));
}
