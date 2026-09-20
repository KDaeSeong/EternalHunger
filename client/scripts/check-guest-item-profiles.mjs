import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { GUEST_ITEM_PROFILE_KEY, saveGuestItem, removeGuestItem, readGuestItems, mergeGuestItemCatalog } from '../src/app/simulation/_lib/guestItemProfileRuntime.js';
import { loadGuestSimulationItemCatalog } from '../src/app/simulation/_lib/guestSimulationBootstrap.js';
import { createConsumeEffectDraft, prepareConsumeEffectDraft } from '../src/utils/consumeEffectAuthoring.js';
import { createItemRecipeDraft, prepareItemRecipeDraft } from '../src/utils/itemRecipeAuthoring.js';
const builtin = await loadGuestSimulationItemCatalog({ includeLocal: false });
const beforeBuiltin = JSON.stringify(builtin);
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };
const herb = builtin.find(item => item.type === '재료' && !item.recipe?.ingredients?.length) || builtin[0];
const item = { _id: 'guest-item-medicine', name: '맞춤 약', type: '소모품', tier: 1, consumeEffect: { heal: 25 },
  recipe: { ingredients: [{ itemId: herb._id, qty: 1 }], resultQty: 2, creditsCost: 3 } };
let passed = 0, failed = 0;
async function check(name, run) { try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } }
await check('authoring roundtrip keeps explicit zeros and unsupported payloads fail without erasure', () => {
  const draft = createConsumeEffectDraft({ version: 1, heal: 25, satiety: 0 });
  assert.deepEqual(prepareConsumeEffectDraft(draft).effect, draft.value);
  assert.equal(prepareConsumeEffectDraft(createConsumeEffectDraft({ version: 2, heal: 25 })).ok, false);
  assert.equal(prepareConsumeEffectDraft({ ...draft, enabled: false }).effect, null);
  assert.equal(prepareConsumeEffectDraft(createConsumeEffectDraft({ stats: { critChance: 25 }, durationSec: 3 })).ok, false);
});
await check('new item saves and reloads with recipe/effect; built-in input stays immutable', () => {
  const storage = memory();
  assert.equal(saveGuestItem(item, builtin, storage).ok, true);
  const merged = mergeGuestItemCatalog(builtin, { storage });
  const row = merged.find(row => row._id === item._id);
  assert.deepEqual(row.recipe, item.recipe);
  assert.deepEqual(row.consumeEffect, { version: 1, heal: 25 });
  row.consumeEffect.heal = 900;
  assert.equal(readGuestItems(builtin, storage).items[0].consumeEffect.heal, 25);
  assert.equal(JSON.stringify(builtin), beforeBuiltin);
});
await check('recipe authoring preserves and rejects fractional, blank and malformed values without silent repair', () => {
  const valid = { creditsCost: '3', resultQty: '2', ingredients: [{ itemId: herb._id, qty: '1' }] };
  assert.deepEqual(prepareItemRecipeDraft(createItemRecipeDraft(valid)).recipe, item.recipe);
  for (const bad of [{ ...valid, resultQty: 1.5 }, { ...valid, creditsCost: -1 },
    { ...valid, creditsCost: '' }, { ...valid, creditsCost: null }, { ...valid, resultQty: true },
    { ...valid, resultQty: null },
    ...[0, 1.5, 'bad', '', false, null].map(qty => ({ ...valid, ingredients: [{ itemId: herb._id, qty }] })),
    { ...valid, ingredients: [{ itemId: '', qty: 1 }] }]) {
    const before = JSON.stringify(bad);
    const draft = createItemRecipeDraft(bad);
    assert.equal(prepareItemRecipeDraft(draft).ok, false, before);
    assert.equal(JSON.stringify(bad), before);
  }
});
await check('a new item requires an actual recipe and rejected edits preserve saved recipes', () => {
  const storage = memory();
  assert.equal(saveGuestItem({ ...item, recipe: undefined }, builtin, storage).ok, false);
  assert.equal(storage.getItem(GUEST_ITEM_PROFILE_KEY), null);
  assert.equal(saveGuestItem(item, builtin, storage).ok, true);
  const before = storage.getItem(GUEST_ITEM_PROFILE_KEY);
  for (const recipe of [{ ...item.recipe, resultQty: 1.5 }, { ...item.recipe, creditsCost: '' },
    { ...item.recipe, ingredients: [] }, { ...item.recipe, ingredients: [{ itemId: '', qty: 1 }] }]) {
    assert.equal(saveGuestItem({ ...item, recipe }, builtin, storage).ok, false);
    assert.equal(storage.getItem(GUEST_ITEM_PROFILE_KEY), before);
  }
});
await check('local built-in override and its removal never change the original', () => {
  const storage = memory(), original = builtin.find(row => row.type === '소모품');
  assert.ok(original);
  assert.equal(saveGuestItem({ ...original, name: '기기 전용 변경', consumeEffect: { heal: 77 } }, builtin, storage).ok, true);
  assert.equal(mergeGuestItemCatalog(builtin, { storage }).find(row => row._id === original._id).consumeEffect.heal, 77);
  assert.equal(removeGuestItem(original._id, builtin, storage).ok, true);
  assert.deepEqual(mergeGuestItemCatalog(builtin, { storage }), builtin);
});
await check('evaluation isolation never reads a broken local store', async () => {
  const storage = { getItem: () => { throw Error('must not read'); } };
  assert.deepEqual(await loadGuestSimulationItemCatalog({ includeLocal: false, storage }), builtin);
});
await check('invalid effect, missing material and cyclic recipe preserve the previous saved bytes', () => {
  const storage = memory(); assert.equal(saveGuestItem(item, builtin, storage).ok, true);
  const previous = storage.getItem(GUEST_ITEM_PROFILE_KEY);
  for (const bad of [{ ...item, consumeEffect: { heal: -1 } },
    { ...item, recipe: { ...item.recipe, ingredients: [{ itemId: 'missing', qty: 1 }] } },
    { ...item, recipe: { ...item.recipe, ingredients: [{ itemId: item._id, qty: 1 }] } }]) {
    assert.equal(saveGuestItem(bad, builtin, storage).ok, false);
    assert.equal(storage.getItem(GUEST_ITEM_PROFILE_KEY), previous);
  }
});
await check('quota failure cannot publish an unsaved change', () => {
  const storage = memory(); saveGuestItem(item, builtin, storage);
  const previous = storage.getItem(GUEST_ITEM_PROFILE_KEY);
  const broken = { getItem: storage.getItem, setItem: () => { throw Error('quota'); } };
  assert.equal(saveGuestItem({ ...item, name: '저장 실패' }, builtin, broken).ok, false);
  assert.equal(storage.getItem(GUEST_ITEM_PROFILE_KEY), previous);
});
await check('deleting a referenced custom ingredient is refused while dependent recipes remain', () => {
  const storage = memory(); saveGuestItem(item, builtin, storage);
  const dependent = { ...item, _id: 'guest-item-next', recipe: { ingredients: [{ itemId: item._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
  assert.equal(saveGuestItem(dependent, builtin, storage).ok, true);
  assert.equal(removeGuestItem(item._id, builtin, storage).ok, false);
  assert.equal(readGuestItems(builtin, storage).items.length, 2);
});
console.log(`GUEST_ITEM_PROFILE_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
