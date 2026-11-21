const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const Module = require('node:module');
const { getLegacyRecipeIngredientKeys, shouldRepairLegacyRecipe } = require('../utils/defaultItemTreeNormalization');

const cases = [
  { key: 'namu:창:죽창', name: '죽창', weaponType: '창',
    previous: ['namu:창:단창', 'namu:material:고철'],
    current: ['namu:창:단창', 'namu:material:나뭇가지'] },
  { key: 'namu:석궁:저격궁', name: '저격궁', weaponType: '석궁',
    previous: ['namu:석궁:쇠뇌', 'namu:material:고철'],
    current: ['namu:석궁:크로스보우', 'namu:material:레이저 포인터'] },
];
const rows = (keys) => keys.map((key) => ({ key, qty: 1 }));

// Opaque IDs expose the same string lookup boundary as MongoDB ObjectIds,
// without importing mongoose, opening a connection or loading a real model.
class FakeObjectId {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
  toJSON() { return this.value; }
}

function getPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}
function matches(document, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$and') return expected.every((part) => matches(document, part));
    if (key === '$or') return expected.some((part) => matches(document, part));
    const actual = getPath(document, key);
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.includes(actual);
    if (expected && typeof expected === 'object' && '$exists' in expected) return (actual !== undefined) === expected.$exists;
    return expected === null ? actual == null : isDeepStrictEqual(actual, expected);
  });
}
function setPath(document, path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const parent = parts.reduce((current, part) => current[part] ??= {}, document);
  parent[key] = value;
}

function fixture(spec, options = {}) {
  const materialKeys = [...new Set([...spec.previous, ...spec.current])];
  const materialDocs = materialKeys.map((itemKey, index) => ({ _id: new FakeObjectId(`material-${index}`),
    itemKey, externalId: itemKey, name: itemKey.split(':').at(-1), source: 'namu', ownerUserId: null }));
  const byKey = new Map(materialDocs.map((item) => [item.itemKey, item]));
  const target = { _id: new FakeObjectId('existing-target'), itemKey: spec.key, externalId: spec.key,
    name: spec.name, weaponType: spec.weaponType, type: '무기', source: 'namu', ownerUserId: null,
    tier: 2, rarity: 'uncommon', stats: { atk: 987, def: 321 }, value: 444,
    recipe: { ingredients: spec.previous.map((key) => ({ itemId: byKey.get(key)._id, qty: 1 })),
      creditsCost: 0, resultQty: 1, note: 'retain-extra-recipe-metadata' } };
  const canonical = { key: spec.key, externalId: spec.key, name: spec.name, weaponType: spec.weaponType,
    source: 'namu', type: '무기', tier: 2, stats: { atk: 9 }, recipeKeys: rows(spec.current),
    recipeCreditsCost: 0, recipeResultQty: 1 };
  options.editTarget?.(target, byKey);
  options.editCanonical?.(canonical);
  const omitted = new Set(options.omittedKeys || []);
  // Keep old-only ingredient documents outside the canonical tree. Both
  // seed paths must explicitly fetch them to recognize the old ObjectIds.
  const rawTree = [canonical, ...spec.current.filter((key) => !omitted.has(key)).map((key) => ({
    key, externalId: key, name: key.split(':').at(-1), source: 'namu', type: '재료', tier: 1,
  }))];
  const docs = [target, ...materialDocs.filter((item) => !omitted.has(item.itemKey))];
  const state = { queries: [], operations: [], applied: [], target, byKey, canonical, docs, rawTree };
  const fakeItem = {
    find: async (query) => { state.queries.push(query); return docs.filter((item) => matches(item, query)); },
    bulkWrite: async (operations, config) => {
      assert.deepEqual(config, { ordered: false, runValidators: true });
      state.operations.push(...operations);
      for (const operation of operations) {
        if (!operation.updateOne) continue;
        options.beforeUpdate?.(target, operation);
        const document = docs.find((item) => matches(item, operation.updateOne.filter));
        if (!document) continue;
        state.applied.push(operation);
        for (const [path, value] of Object.entries(operation.updateOne.update.$set)) setPath(document, path, value);
      }
    },
  };
  const seedPath = require.resolve('../utils/defaultItemTree');
  const previousCache = require.cache[seedPath];
  const originalLoad = Module._load;
  let modelLoads = 0, treeLoads = 0;
  try {
    delete require.cache[seedPath];
    Module._load = function (request, parent, isMain) {
      if (parent?.filename === seedPath && request === '../models/Item') { modelLoads++; return fakeItem; }
      if (parent?.filename === seedPath && request === './defaultItemTree.generated.json') { treeLoads++; return rawTree; }
      return originalLoad.call(this, request, parent, isMain);
    };
    state.seed = require(seedPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[seedPath];
    if (previousCache) require.cache[seedPath] = previousCache;
  }
  assert.equal(modelLoads, 1, 'No real Item model may be loaded.');
  assert.equal(treeLoads, 1, 'Use explicit canonical fixtures, not mutable generated data.');
  state.run = async (entrypoint) => {
    const offset = state.seed.DEFAULT_ITEM_TREE.findIndex((item) => item.key === spec.key);
    assert.ok(offset >= 0);
    return state.seed[entrypoint]({ mode: 'missing', phase: 'recipes', offset, limit: 1 });
  };
  state.targetOperations = () => state.operations.filter((operation) => operation.updateOne?.filter._id === target._id);
  return state;
}

for (const spec of cases) {
  test(`${spec.name}: pure guard requires exact legacy and canonical recipes`, () => {
    const current = { key: spec.key, recipeKeys: rows(spec.current), recipeCreditsCost: 0, recipeResultQty: 1 };
    const existing = { itemKey: spec.key, source: 'namu', recipe: { creditsCost: 0, resultQty: 1 } };
    const previous = rows(spec.previous);
    const before = JSON.stringify({ existing, current, previous });
    assert.equal(shouldRepairLegacyRecipe(existing, current, previous), true);
    assert.equal(shouldRepairLegacyRecipe(existing, current, [...previous].reverse()), true);
    for (const altered of [
      { ...existing, source: 'default.seed.actual' }, { ...existing, source: 'admin' },
      { ...existing, itemKey: `custom:${spec.key}`, externalId: spec.key },
      { ...existing, recipe: { creditsCost: 1, resultQty: 1 } },
      { ...existing, recipe: { creditsCost: 0, resultQty: 2 } },
      { ...existing, recipe: { creditsCost: '0', resultQty: 1 } },
    ]) assert.equal(shouldRepairLegacyRecipe(altered, current, previous), false);
    for (const altered of [[], rows(spec.current), [previous[0], previous[0]],
      [...previous, { key: 'custom:extra', qty: 1 }], [{ ...previous[0], qty: 2 }, previous[1]],
      [{ ...previous[0], qty: '1' }, previous[1]], [{ qty: 1 }, previous[1]]]) {
      assert.equal(shouldRepairLegacyRecipe(existing, current, altered), false);
    }
    for (const altered of [{ ...current, recipeCreditsCost: 1 }, { ...current, recipeResultQty: 2 },
      { ...current, recipeKeys: previous }, { ...current, recipeKeys: [{ ...current.recipeKeys[0], qty: 2 }, current.recipeKeys[1]] }]) {
      assert.equal(shouldRepairLegacyRecipe(existing, altered, previous), false);
    }
    assert.deepEqual(getLegacyRecipeIngredientKeys(current), spec.previous);
    const oldKeys = getLegacyRecipeIngredientKeys(current); oldKeys.pop();
    assert.deepEqual(getLegacyRecipeIngredientKeys(current), spec.previous);
    assert.deepEqual(getLegacyRecipeIngredientKeys({ key: 'unrelated' }), []);
    assert.equal(shouldRepairLegacyRecipe(existing, { ...current, key: '__proto__' }, previous), false);
    assert.equal(JSON.stringify({ existing, current, previous }), before);
  });

  for (const entrypoint of ['upsertDefaultItemTreeBatch', 'upsertDefaultItemTree']) {
    test(`${spec.name}: ${entrypoint} repairs only the exact legacy ingredients`, async () => {
      const state = fixture(spec);
      const id = state.target._id, stats = state.target.stats, oldRecipe = state.target.recipe;
      const before = { ...state.target, recipe: { ...oldRecipe } };
      const result = await state.run(entrypoint);
      const operations = state.targetOperations();
      assert.equal(operations.length, 1);
      assert.deepEqual(operations[0].updateOne.update.$set, { 'recipe.ingredients': spec.current.map((key) => ({
        itemId: state.byKey.get(key)._id, qty: 1,
      })) });
      assert.strictEqual(operations[0].updateOne.filter._id, id);
      assert.equal(operations[0].updateOne.filter.source, 'namu');
      assert.equal(operations[0].updateOne.filter.itemKey, spec.key);
      assert.deepEqual(operations[0].updateOne.filter['recipe.ingredients'], before.recipe.ingredients);
      assert.equal(operations[0].updateOne.filter['recipe.creditsCost'], 0);
      assert.equal(operations[0].updateOne.filter['recipe.resultQty'], 1);
      assert.strictEqual(state.target._id, id); assert.strictEqual(state.target.stats, stats);
      assert.strictEqual(state.target.recipe, oldRecipe);
      assert.deepEqual(state.target, { ...before, recipe: { ...before.recipe,
        ingredients: operations[0].updateOne.update.$set['recipe.ingredients'] } });
      assert.equal(result.recipeUpdatedCount, 1);
      const ingredientQuery = state.queries.find((query) => query.itemKey?.$in.includes(spec.previous[1]));
      assert.ok(ingredientQuery, 'Fetch the legacy ingredient keys, including old-only keys outside the current tree.');
      for (const key of [...spec.previous, ...spec.current]) assert.ok(ingredientQuery.itemKey.$in.includes(key));
      state.operations.length = 0;
      await state.run(entrypoint);
      assert.deepEqual(state.targetOperations(), [], 'A corrected recipe must remain unchanged on the next missing pass.');
    });

    test(`${spec.name}: ${entrypoint} preserves custom recipes, values and incomplete material lookups`, async (t) => {
      const variants = [
        ['custom-source', { editTarget: (target) => { target.source = 'admin'; } }],
        ['default-seed-source', { editTarget: (target) => { target.source = 'default.seed.actual'; } }],
        ['same-name-unrelated-key', { editTarget: (target) => { target.itemKey = `custom:${spec.key}`; } }],
        ['credits', { editTarget: (target) => { target.recipe.creditsCost = 7; } }],
        ['result-quantity', { editTarget: (target) => { target.recipe.resultQty = 2; } }],
        ['ingredient-quantity', { editTarget: (target) => { target.recipe.ingredients[0].qty = 2; } }],
        ['duplicate-ingredient', { editTarget: (target) => { target.recipe.ingredients[1] = { ...target.recipe.ingredients[0] }; } }],
        ['additional-ingredient', { editTarget: (target) => { target.recipe.ingredients.push({ itemId: target._id, qty: 1 }); } }],
        ['unresolved-old-id', { editTarget: (target) => { target.recipe.ingredients[0].itemId = new FakeObjectId('unknown'); } }],
        ['wrong-canonical-recipe', { editCanonical: (def) => { def.recipeKeys = rows(spec.previous); } }],
        ['canonical-cost', { editCanonical: (def) => { def.recipeCreditsCost = 9; } }],
        ['canonical-result', { editCanonical: (def) => { def.recipeResultQty = 2; } }],
        ['canonical-ingredient-quantity', { editCanonical: (def) => { def.recipeKeys[0].qty = 2; } }],
        ...spec.current.map((key) => [`missing:${key}`, { omittedKeys: [key] }]),
      ];
      for (const [name, options] of variants) await t.test(name, async () => {
        const state = fixture(spec, options);
        const before = JSON.stringify(state.target);
        await state.run(entrypoint);
        assert.deepEqual(state.targetOperations(), []);
        assert.equal(JSON.stringify(state.target), before);
      });
    });

    test(`${spec.name}: ${entrypoint} conditionally updates the recipe read before a concurrent edit`, async () => {
      let edited = false;
      const state = fixture(spec, { beforeUpdate: (target, operation) => {
        if (edited || !operation.updateOne.update.$set['recipe.ingredients']) return;
        edited = true;
        target.recipe.ingredients = [{ itemId: target._id, qty: 7 }];
      } });
      await state.run(entrypoint);
      assert.equal(edited, true);
      assert.deepEqual(state.applied.filter((operation) => operation.updateOne.filter._id === state.target._id), []);
      assert.deepEqual(state.target.recipe.ingredients, [{ itemId: state.target._id, qty: 7 }]);
    });

    test(`${spec.name}: ${entrypoint} fills an empty recipe only with every canonical ingredient ID`, async () => {
      for (const omittedKeys of [[], ...spec.current.map((key) => [key])]) {
        const state = fixture(spec, { omittedKeys, editTarget: (target) => { target.recipe = {
          creditsCost: 0, resultQty: 1, ingredients: [],
        }; } });
        await state.run(entrypoint);
        const operations = state.targetOperations();
        assert.equal(operations.length, omittedKeys.length ? 0 : 1);
        assert.deepEqual(state.target.recipe.ingredients, omittedKeys.length ? [] : spec.current.map((key) => ({
          itemId: state.byKey.get(key)._id, qty: 1,
        })));
      }
    });
  }
}

for (const spec of [
  { key: 'namu:창:파이크', name: '파이크', weaponType: '창',
    current: ['namu:창:단창', 'namu:material:고철'] },
  { key: 'namu:석궁:헤비 크로스보우', name: '헤비 크로스보우', weaponType: '석궁',
    current: ['namu:석궁:쇠뇌', 'namu:material:고철'] },
]) {
  for (const entrypoint of ['upsertDefaultItemTreeBatch', 'upsertDefaultItemTree']) {
    test(`${spec.name}: ${entrypoint} fills the confirmed empty recipe without a partial write`, async () => {
      for (const omittedKeys of [[], ...spec.current.map((key) => [key])]) {
        const state = fixture({ ...spec, previous: spec.current }, { omittedKeys,
          editTarget: (target) => { target.recipe = { ingredients: [], creditsCost: 0, resultQty: 1 }; } });
        const id = state.target._id, stats = state.target.stats;
        await state.run(entrypoint);
        const operations = state.targetOperations();
        assert.equal(operations.length, omittedKeys.length ? 0 : 1);
        assert.deepEqual(state.target.recipe, { creditsCost: 0, resultQty: 1,
          ingredients: omittedKeys.length ? [] : spec.current.map((key) => ({ itemId: state.byKey.get(key)._id, qty: 1 })) });
        assert.strictEqual(state.target._id, id); assert.strictEqual(state.target.stats, stats);
      }
    });
  }
}
