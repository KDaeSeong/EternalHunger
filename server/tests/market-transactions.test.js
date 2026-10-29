const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const policy = require('../../shared/marketItemPolicy.cjs');
const marketTransaction = require('../utils/marketTransaction');
const Character = require('../models/Characters');
const { normalizeInventory } = require('../utils/inventory');

const WATER = { _id: 'water', name: '물', type: '소모품', tags: ['food', 'drink'], tier: 1 };
const ORE = { _id: 'ore', name: '철광석', type: '재료', tags: [], tier: 1 };
const CRAFTED = { _id: 'crafted', name: '철검', type: '무기', tags: ['equipment'], tier: 1,
  recipe: { ingredients: [{ itemId: 'ore', qty: 1 }], creditsCost: 60, resultQty: 1 } };

function clone(value) {
  return structuredClone(value);
}

function makeStore({ credits = 100, inventory = [], failSave = '', otherCharacter = false } = {}) {
  return {
    user: { credits },
    character: { _id: 'character-1', userId: 'user-1', inventory: clone(inventory) },
    ...(otherCharacter ? { otherCharacter: { _id: 'character-2', userId: 'user-1', inventory: [] } } : {}),
    failSave,
  };
}

function makeQuery(read) {
  let session = null;
  return {
    select() { return this; },
    populate() { return this; },
    lean() { return this; },
    session(value) { session = value; return this; },
    then(resolve, reject) {
      return Promise.resolve().then(() => read(session)).then(resolve, reject);
    },
  };
}

function makeEconomyModels(store) {
  let transactionTail = Promise.resolve();
  function stateFor(session) { return session?.state || store; }
  function characterFor(state, id) {
    return id === 'character-2' ? state.otherCharacter : state.character;
  }
  const userModel = {
    findById() {
      return makeQuery((session) => {
        const state = stateFor(session);
        const snapshot = clone(state.user);
        const doc = {
          ...snapshot,
          async save() {
            if (store.failSave === 'user') {
              await new Promise((resolve) => setTimeout(resolve, 1));
              throw new Error('injected user save failure');
            }
            state.user = { credits: doc.credits };
          },
        };
        return doc;
      });
    },
    findOneAndUpdate(filter, update, { session } = {}) {
      return makeQuery(() => {
        if (store.failSave === 'user') throw new Error('injected user credit update failure');
        const state = stateFor(session);
        if (filter._id !== 'user-1') return null;
        const current = Number(state.user.credits || 0);
        if (filter.credits?.$gte !== undefined && current < filter.credits.$gte) return null;
        state.user.credits = current + update.$inc.credits;
        return clone(state.user);
      });
    },
  };
  userModel.db = {
    transaction(callback) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      return previous.then(async () => {
        const session = { state: clone({
          user: store.user,
          character: store.character,
          otherCharacter: store.otherCharacter,
        }) };
        try {
          const result = await callback(session);
          store.user = session.state.user;
          store.character = session.state.character;
          if (session.state.otherCharacter) store.otherCharacter = session.state.otherCharacter;
          return result;
        } finally {
          release();
        }
      });
    },
  };
  const characterModel = {
    findOne(filter) {
      return makeQuery((session) => {
        const state = stateFor(session);
        const snapshot = clone(characterFor(state, filter._id));
        if (!snapshot || snapshot.userId !== filter.userId) return null;
        const doc = {
          ...snapshot,
          markModified() {},
          async save({ session: saveSession } = {}) {
            if (store.failSave === 'character') throw new Error('injected character save failure');
            const saveState = stateFor(saveSession);
            const key = doc._id === 'character-2' ? 'otherCharacter' : 'character';
            saveState[key] = { _id: doc._id, userId: doc.userId, inventory: clone(doc.inventory) };
          },
        };
        return doc;
      });
    },
  };
  const inventory = {
    buildItemNameMap: () => new Map(),
    normalizeInventory: (rows) => clone(rows || []),
    addToInventory(rows, item) {
      const id = String(item.itemId?._id || item.itemId);
      const existing = rows.find((row) => String(row.itemId?._id || row.itemId) === id);
      if (existing) existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
      else rows.push(clone(item));
      return rows;
    },
    countInInventory(rows, itemId) {
      return rows.filter((row) => String(row.itemId?._id || row.itemId) === String(itemId))
        .reduce((sum, row) => sum + Number(row.qty || 0), 0);
    },
    removeFromInventory(rows, itemId, qty) {
      const row = rows.find((entry) => String(entry.itemId?._id || entry.itemId) === String(itemId));
      if (!row || Number(row.qty || 0) < qty) return false;
      row.qty -= qty;
      if (row.qty === 0) rows.splice(rows.indexOf(row), 1);
      return true;
    },
  };
  const perkRuntime = {
    getOwnedPerkContext: async () => ({ effects: {} }),
    applyDiscountedCost: (value) => value,
    applySaleBonus: (value) => value,
  };
  return {
    '../models/User': userModel,
    '../models/Characters': characterModel,
    '../models/Item': { find: () => makeQuery(() => [WATER, ORE, CRAFTED]) },
    '../models/Perk': { find: () => makeQuery(() => []) },
    '../utils/inventory': inventory,
    '../utils/perkRuntime': perkRuntime,
  };
}

function loadRouter(relative, dependencies) {
  const filename = path.join(__dirname, '..', relative);
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(filename, 'utf8'), {
    module,
    exports: module.exports,
    console: { error() {} },
    require(specifier) {
      if (specifier === 'express') return express;
      if (specifier === 'crypto') return require('node:crypto');
      if (specifier.endsWith('/requestScope')) {
        return { scopedFilter: (_req, extra = {}) => ({ ownerUserId: 'user-1', ...extra }) };
      }
      if (specifier.endsWith('shared/marketItemPolicy.cjs')) return policy;
      if (specifier === '../utils/marketTransaction') return marketTransaction;
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      throw new Error(`Unexpected route dependency: ${specifier}`);
    },
  }, { filename });
  return module.exports;
}

async function dispatchMounted(app, method, pathName, body) {
  return new Promise((resolve, reject) => {
    const req = Object.create(app.request);
    Object.assign(req, {
      method,
      url: pathName,
      originalUrl: pathName,
      headers: { host: 'controlled-route.test' },
      body,
    });
    const res = Object.create(app.response);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    Object.assign(res, {
      statusCode: 200,
      locals: {},
      app,
      req,
      setHeader() {},
      getHeader() { return undefined; },
      status(code) { this.statusCode = code; return this; },
      json(value) { finish({ status: this.statusCode, body: value }); return this; },
      end() { finish({ status: this.statusCode, body: null }); return this; },
    });
    app.handle(req, res, (error) => {
      if (error) reject(error);
      else finish({ status: res.statusCode || 404, body: null });
    });
  });
}

function mountedRoute(route, dependencies) {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 'user-1' }; next(); });
  app.use(loadRouter(route, dependencies));
  return app;
}

async function withRoute(route, method, pathName, body, dependencies) {
  return dispatchMounted(mountedRoute(route, dependencies), method, pathName, body);
}

function marketDependencies(store, options = {}, { route = 'kiosk', item = WATER } = {}) {
  const models = makeEconomyModels(store);
  if (route === 'kiosk') {
    models['../models/Kiosk'] = {
      findOne: () => makeQuery(() => ({ catalog: [{ itemId: item, mode: 'sell', priceCredits: 60 }] })),
    };
  } else if (route === 'drone') {
    models['../models/DroneOffer'] = {
      findOne: () => makeQuery(() => ({ isActive: true, itemId: item, priceCredits: 60, maxTier: 1 })),
    };
  }
  return models;
}

test('kiosk character-save failure rolls back the conditional credit settlement', async () => {
  const store = makeStore({ failSave: 'character' });
  const result = await withRoute('routes/kiosks.js', 'POST', '/shop/transaction',
    { characterId: 'character-1', catalogIndex: 0 }, marketDependencies(store, {}, { item: CRAFTED }));

  assert.equal(result.status, 500);
  assert.equal(store.user.credits, 100);
  assert.deepEqual(store.character.inventory, []);
});

test('drone character-save failure rolls back the conditional credit settlement', async () => {
  const store = makeStore({ failSave: 'character' });
  const result = await withRoute('routes/drone.js', 'POST', '/buy',
    { characterId: 'character-1', offerId: 'water-offer' }, marketDependencies(store, {}, { route: 'drone' }));

  assert.equal(result.status, 500);
  assert.equal(store.user.credits, 100);
  assert.deepEqual(store.character.inventory, []);
});

test('craft character-save failure rolls back credits, ingredients and output', async () => {
  const store = makeStore({ credits: 100, inventory: [{ itemId: 'ore', name: '철광석', qty: 1 }], failSave: 'character' });
  const dependencies = makeEconomyModels(store);
  dependencies['../models/Item'].findOne = () => makeQuery(() => CRAFTED);
  const result = await withRoute('routes/items.js', 'POST', '/craft',
    { characterId: 'character-1', itemId: CRAFTED._id, qty: 1 }, dependencies);

  assert.equal(result.status, 500);
  assert.equal(store.user.credits, 100);
  assert.deepEqual(store.character.inventory, [{ itemId: 'ore', name: '철광석', qty: 1 }]);
});

test('craft preserves fractional recipe costs and inventory quantities', async () => {
  const store = makeStore({ credits: 100, inventory: [{ itemId: 'ore', name: '철광석', qty: 1 }] });
  const fractionalRecipeItem = {
    ...CRAFTED,
    recipe: { ingredients: [{ itemId: 'ore', qty: 0.5 }], creditsCost: 2.5, resultQty: 1.5 },
  };
  const dependencies = makeEconomyModels(store);
  dependencies['../models/Item'].findOne = () => makeQuery(() => fractionalRecipeItem);
  const result = await withRoute('routes/items.js', 'POST', '/craft',
    { characterId: 'character-1', itemId: CRAFTED._id, qty: 1 }, dependencies);

  assert.equal(result.status, 200);
  assert.equal(store.user.credits, 97.5);
  assert.deepEqual(store.character.inventory, [
    { itemId: 'ore', name: '철광석', qty: 0.5 },
    { itemId: 'crafted', itemKey: undefined, name: '철검', qty: 1.5,
      tags: ['equipment'], type: '무기', tier: 1, rarity: '일반' },
  ]);
});

test('fractional request quantities retain kiosk and drone pricing and craft quantities', async () => {
  const kioskStore = makeStore({ credits: 100 });
  const kioskDependencies = marketDependencies(kioskStore, {}, { item: CRAFTED });
  kioskDependencies['../models/Kiosk'].findOne = () => makeQuery(() => ({
    catalog: [{ itemId: CRAFTED, mode: 'sell', priceCredits: 1 }],
  }));
  const kioskResult = await withRoute('routes/kiosks.js', 'POST', '/shop/transaction',
    { characterId: 'character-1', catalogIndex: 0, qty: 1.5 }, kioskDependencies);
  assert.equal(kioskResult.status, 200);
  assert.equal(kioskStore.user.credits, 98.5);
  assert.equal(kioskStore.character.inventory[0].qty, 1.5);

  const droneStore = makeStore({ credits: 100 });
  const droneDependencies = marketDependencies(droneStore, {}, { route: 'drone' });
  droneDependencies['../models/DroneOffer'].findOne = () => makeQuery(() => ({
    isActive: true, itemId: WATER, priceCredits: 1, maxTier: 1,
  }));
  const droneResult = await withRoute('routes/drone.js', 'POST', '/buy',
    { characterId: 'character-1', offerId: 'water-offer', qty: 1.5 }, droneDependencies);
  assert.equal(droneResult.status, 200);
  assert.equal(droneStore.user.credits, 98.5);
  assert.equal(droneStore.character.inventory[0].qty, 1.5);

  for (const [qty, initialOre, expectedCredits, expectedOre, expectedCraft] of [
    [1.5, 2, 98.5, 0.5, 1.5],
    [0.5, 1, 99, 0.5, 0.5],
  ]) {
    const craftStore = makeStore({ credits: 100, inventory: [{ itemId: 'ore', name: '철광석', qty: initialOre }] });
    const fractionalCostRecipe = { ...CRAFTED, recipe: {
      ingredients: [{ itemId: 'ore', qty: 1 }], creditsCost: 1, resultQty: 1,
    } };
    if (qty === 0.5) fractionalCostRecipe.recipe.creditsCost = 2;
    const craftDependencies = makeEconomyModels(craftStore);
    craftDependencies['../models/Item'].findOne = () => makeQuery(() => fractionalCostRecipe);
    const craftResult = await withRoute('routes/items.js', 'POST', '/craft',
      { characterId: 'character-1', itemId: CRAFTED._id, qty }, craftDependencies);
    assert.equal(craftResult.status, 200);
    assert.equal(craftStore.user.credits, expectedCredits);
    assert.deepEqual(craftStore.character.inventory.map((row) => row.qty), [expectedOre, expectedCraft]);
  }
});

test('fractional kiosk exchange give quantity is preserved', async () => {
  const store = makeStore({ inventory: [{ itemId: 'ore', name: '철광석', qty: 2 }] });
  const dependencies = marketDependencies(store, {}, { item: CRAFTED });
  dependencies['../models/Kiosk'].findOne = () => makeQuery(() => ({ catalog: [{
    itemId: CRAFTED, mode: 'exchange', priceCredits: 0,
    exchange: { giveItemId: ORE, giveQty: 1.5 },
  }] }));
  const result = await withRoute('routes/kiosks.js', 'POST', '/shop/transaction',
    { characterId: 'character-1', catalogIndex: 0 }, dependencies);

  assert.equal(result.status, 200);
  assert.equal(store.user.credits, 100);
  assert.deepEqual(store.character.inventory.map((row) => [row.itemId, row.qty]), [['ore', 0.5], ['crafted', 1]]);
});

test('concurrent drone purchases for different characters cannot overspend one user balance', async () => {
  const store = makeStore({ credits: 100, otherCharacter: true });
  const dependencies = marketDependencies(store, {}, { route: 'drone' });
  const app = mountedRoute('routes/drone.js', dependencies);
  const responses = await Promise.all([
    dispatchMounted(app, 'POST', '/buy', { characterId: 'character-1', offerId: 'water-offer' }),
    dispatchMounted(app, 'POST', '/buy', { characterId: 'character-2', offerId: 'water-offer' }),
  ]);
  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 400).length, 1);
  assert.equal(store.user.credits, 40);
  const settledQty = [store.character, store.otherCharacter]
    .flatMap((character) => character.inventory)
    .reduce((sum, row) => sum + Number(row.qty || 0), 0);
  assert.equal(settledQty, 1);
});

test('market routes reject non-positive and unsafe quantities', async () => {
  const invalidQuantities = [0, -1, Number.MAX_SAFE_INTEGER + 1, 'not-a-number'];
  for (const qty of invalidQuantities) {
    const kioskStore = makeStore();
    const kioskResult = await withRoute('routes/kiosks.js', 'POST', '/shop/transaction',
      { characterId: 'character-1', catalogIndex: 0, qty }, marketDependencies(kioskStore, {}, { item: CRAFTED }));
    assert.equal(kioskResult.status, 400);
    assert.equal(kioskStore.user.credits, 100);
    assert.deepEqual(kioskStore.character.inventory, []);

    const droneStore = makeStore();
    const droneResult = await withRoute('routes/drone.js', 'POST', '/buy',
      { characterId: 'character-1', offerId: 'water-offer', qty }, marketDependencies(droneStore, {}, { route: 'drone' }));
    assert.equal(droneResult.status, 400);
    assert.equal(droneStore.user.credits, 100);
    assert.deepEqual(droneStore.character.inventory, []);

    const craftStore = makeStore({ inventory: [{ itemId: 'ore', name: '철광석', qty: 1 }] });
    const craftDependencies = makeEconomyModels(craftStore);
    craftDependencies['../models/Item'].findOne = () => makeQuery(() => CRAFTED);
    const craftResult = await withRoute('routes/items.js', 'POST', '/craft',
      { characterId: 'character-1', itemId: CRAFTED._id, qty }, craftDependencies);
    assert.equal(craftResult.status, 400);
    assert.equal(craftStore.user.credits, 100);
    assert.equal(craftStore.character.inventory[0].qty, 1);
  }
});

test('market settlement refuses to run without database transaction support', async () => {
  assert.throws(
    () => marketTransaction.runMarketTransaction({}, async () => 'settled'),
    /MongoDB transaction support is required/
  );
});

test('inventory normalization preserves item quantities from hydrated Character subdocuments', () => {
  const oreId = new (require('mongoose').Types.ObjectId)();
  const gearId = new (require('mongoose').Types.ObjectId)();
  const character = new Character({
    userId: new (require('mongoose').Types.ObjectId)(),
    name: '거래 회귀 확인',
    inventory: [
      { itemId: oreId, name: '철광석', qty: 2 },
      { itemId: gearId, name: '장비', qty: 1 },
    ],
  });
  const originalRows = character.inventory;
  const normalized = normalizeInventory(originalRows, new Map(), { merge: true });

  assert.deepEqual(normalized.map((row) => ({ itemId: String(row.itemId), qty: row.qty })).sort((a, b) => a.itemId.localeCompare(b.itemId)),
    [{ itemId: String(oreId), qty: 2 }, { itemId: String(gearId), qty: 1 }].sort((a, b) => a.itemId.localeCompare(b.itemId)));
  assert.equal(character.inventory, originalRows);
  assert.equal(character.inventory[0].qty, 2);
  assert.equal(character.inventory[1].qty, 1);

  const legacyInput = [{ id: 'legacy-ore', name: '구형 철광석', quantity: 2, custom: { source: 'save' } }];
  const legacyBefore = clone(legacyInput);
  const legacyNormalized = normalizeInventory(legacyInput, new Map(), { merge: false });
  assert.equal(legacyNormalized[0].qty, 2);
  assert.equal(legacyNormalized[0].id, 'legacy-ore');
  assert.deepEqual(legacyNormalized[0].custom, { source: 'save' });
  assert.deepEqual(legacyInput, legacyBefore);
});
