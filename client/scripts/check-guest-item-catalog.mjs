import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadGuestSimulationItemCatalog } from '../src/app/simulation/_lib/guestSimulationBootstrap.js';
import {
  GUEST_ITEM_CATALOG_SCHEMA_VERSION,
  OUTPUT_PATH,
  SOURCE_PATH,
  buildGuestItemCatalog,
  generateGuestItemCatalog,
} from './generate-guest-item-catalog.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

await generateGuestItemCatalog({ check: true });

const generatedSource = await readFile(OUTPUT_PATH, 'utf8');
assert.doesNotMatch(generatedSource, /\brequire\s*\(/, 'Generated client catalog must not use CommonJS require.');
assert.doesNotMatch(generatedSource, /\bmongoose\b/i, 'Generated client catalog must not depend on Mongoose.');
assert.doesNotMatch(
  generatedSource,
  /(?:from|import\s*)\s*['"][^'"]*server[\\/]/i,
  'Generated client catalog must not import server modules.',
);

const generatedModule = await import(`${pathToFileURL(OUTPUT_PATH).href}?check=${Date.now()}`);
const items = generatedModule.GUEST_ITEM_CATALOG;
const metadata = generatedModule.GUEST_ITEM_CATALOG_META;
const expected = buildGuestItemCatalog(await readFile(SOURCE_PATH));

assert.equal(metadata.schemaVersion, GUEST_ITEM_CATALOG_SCHEMA_VERSION, 'Catalog schema version must match the generator.');
assert.deepEqual(metadata, expected.metadata, 'Generated metadata must match the current server source.');
assert.deepEqual(items, expected.items, 'Generated catalog data must be a deterministic source transformation.');
assert.equal(items.length, metadata.itemCount, 'Catalog item count metadata must be exact.');
assert.equal(items.length, 774, 'Version 1.1.0 pins the server-effective 774-item seed.');
assert.equal(items.filter((item) => item.recipe.ingredients.length).length, 639);
assert.ok(items.every((item) => item.itemKey.startsWith('namu:')), 'Legacy core rows must not leak into guest matches.');
assert.equal(sha256(Buffer.from(JSON.stringify(items), 'utf8')), metadata.catalogSha256, 'Catalog content hash must match.');

const ids = items.map((item) => String(item?._id || ''));
const idSet = new Set(ids);
assert.equal(idSet.size, items.length, 'Generated item IDs must be unique.');
assert.ok(items.every((item) => item._id && item._id === item.itemKey), 'Every generated item must use its stable key as _id and itemKey.');

let recipeReferenceCount = 0;
let upgradeReferenceCount = 0;
for (const item of items) {
  const ingredients = Array.isArray(item?.recipe?.ingredients) ? item.recipe.ingredients : [];
  for (const ingredient of ingredients) {
    recipeReferenceCount += 1;
    assert.ok(idSet.has(String(ingredient?.itemId || '')), `Missing recipe reference: ${item._id} -> ${ingredient?.itemId}`);
    assert.ok(Number.isInteger(ingredient?.qty) && ingredient.qty > 0, `Invalid recipe quantity: ${item._id}`);
  }
  for (const upgradeItemKey of Array.isArray(item?.upgradeItemKeys) ? item.upgradeItemKeys : []) {
    upgradeReferenceCount += 1;
    assert.ok(idSet.has(String(upgradeItemKey || '')), `Missing upgrade reference: ${item._id} -> ${upgradeItemKey}`);
  }
}

assert.equal(recipeReferenceCount, metadata.recipeReferenceCount, 'Recipe reference count metadata must be exact.');
assert.equal(upgradeReferenceCount, metadata.upgradeReferenceCount, 'Upgrade reference count metadata must be exact.');

const variants = items.filter((item) => item.tier >= 6 && /[-\s]+(진홍|새벽)$/.test(item.name));
assert.ok(variants.length > 0, 'Shard variant fixtures must exist.');
for (const variant of variants) {
  const shardName = variant.name.endsWith('진홍') ? '진홍의 샤드' : '새벽빛 샤드';
  assert.equal(variant.recipe.ingredients.length, 2);
  assert.ok(variant.recipe.ingredients.some((ingredient) => ingredient.itemId === `namu:material:${shardName}`));
}
const firstRunItems = await loadGuestSimulationItemCatalog();
firstRunItems[0].name = 'mutated';
firstRunItems[0].tags.push('mutated');
const secondRunItems = await loadGuestSimulationItemCatalog();
assert.deepEqual(secondRunItems, items, 'Each match must receive isolated catalog data.');

console.log(JSON.stringify({
  schemaVersion: metadata.schemaVersion,
  sourceSha256: metadata.sourceSha256,
  catalogSha256: metadata.catalogSha256,
  itemCount: items.length,
  recipeReferenceCount,
  upgradeReferenceCount,
  deterministic: true,
  clientOnly: true,
}, null, 2));
