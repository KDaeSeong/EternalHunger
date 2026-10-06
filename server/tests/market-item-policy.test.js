const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../../shared/marketItemPolicy.cjs');

// Execute the current HTTP handlers with explicit model inputs. These are
// request/settlement contract tests, not a live Mongo or account round trip.
const food = { _id: 'food', name: '관리자 급식', type: '재료', tags: ['food'], tier: 1 };
const water = { _id: 'water', name: '물', type: '소모품', tags: ['food', 'drink'], tier: 1 };
const tree = { _id: 'tree', name: '생명의 나무', type: '재료', tier: 4 };
const items = [food, water, tree];
function query(value) {
  return { select() { return this; }, populate() { return this; }, lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
const scope = { requireUserId: req => req.user.id,
  scopedFilter: (req, extra = {}) => ({ ...extra, ownerAdminUid: req.user.id }),
  ownedFilter: (id, extra = {}) => ({ ...extra, ownerAdminUid: id }),
  withOwner: (id, payload) => ({ ...payload, ownerAdminUid: id }) };
function load(relative, dependencies = {}, factory = false) {
  const handlers = {}, router = {};
  for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, handler) => { handlers[`${method} ${url}`] = handler; };
  const filename = path.join(__dirname, '..', relative), module = { exports: {} };
  vm.runInNewContext(readFileSync(filename, 'utf8'), { module, exports: module.exports, console,
    require(specifier) {
      if (specifier === 'express') return { Router: () => router };
      if (specifier.endsWith('shared/marketItemPolicy.cjs')) return policy;
      if (specifier.endsWith('/requestScope')) return scope;
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      throw new Error(`Unexpected route dependency: ${specifier}`);
    } }, { filename });
  if (factory) module.exports({ ensureDefaultLumiaMap: async () => {} });
  return handlers;
}
async function call(handler, body = {}, params = {}) {
  const result = { statusCode: 200 };
  const res = { status(code) { result.statusCode = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ user: { id: 'owner' }, body, params }, res);
  return result;
}
function economy() {
  let saves = 0;
  const user = { credits: 50, async save() { saves++; } };
  const actor = { inventory: [], markModified() {}, async save() { saves++; } };
  const inventory = { buildItemNameMap: () => ({}), normalizeInventory: inv => [...inv],
    addToInventory: (inv, row) => inv.push(row), countInInventory: () => 1, removeFromInventory: () => true };
  const perks = { getOwnedPerkContext: async () => ({ effects: {} }),
    applyDiscountedCost: value => value, applySaleBonus: value => value };
  const dependencies = { '../models/User': { findById: () => query(user) },
    '../models/Characters': { findOne: () => query(actor) }, '../models/Item': { find: () => query(items) },
    '../models/Perk': {}, '../utils/inventory': inventory, '../utils/perkRuntime': perks };
  return { user, actor, dependencies, saves: () => saves };
}

test('direct drone requests reject food before inventory, credits or model saves change', async () => {
  const state = economy();
  state.dependencies['../models/DroneOffer'] = { findOne: () => query({ isActive: true, itemId: food, priceCredits: 17 }) };
  const handlers = load('routes/drone.js', state.dependencies);
  const result = await call(handlers['post /buy'], { characterId: 'actor', offerId: 'food-offer' });
  assert.equal(result.statusCode, 400); assert.match(result.body.error, /음식/);
  assert.equal(state.user.credits, 50); assert.deepEqual(state.actor.inventory, []); assert.equal(state.saves(), 0);
});

test('direct water drone purchase retains its actual price, quantity and payment', async () => {
  const state = economy();
  state.dependencies['../models/DroneOffer'] = { findOne: () => query({ isActive: true, itemId: water, priceCredits: 17, maxTier: 1 }) };
  const handlers = load('routes/drone.js', state.dependencies);
  const result = await call(handlers['post /buy'], { characterId: 'actor', offerId: 'water-offer', qty: 2 });
  assert.equal(result.statusCode, 200); assert.equal(state.user.credits, 16); assert.equal(state.saves(), 2);
  assert.equal(state.actor.inventory[0].itemId, 'water'); assert.equal(state.actor.inventory[0].qty, 2);
});

test('kiosk purchase, refund and exchange requests reject food or water without writes', async () => {
  for (const row of [{ itemId: food, mode: 'sell' }, { itemId: water, mode: 'sell' },
    { itemId: food, mode: 'buy' }, { itemId: tree, mode: 'exchange', exchange: { giveItemId: water, giveQty: 1 } }]) {
    const state = economy(); state.dependencies['../models/Kiosk'] = { findOne: () => query({ catalog: [row] }) };
    const handlers = load('routes/kiosks.js', state.dependencies);
    const result = await call(handlers['post /:id/transaction'], { characterId: 'actor', catalogIndex: 0 }, { id: 'shop' });
    assert.equal(result.statusCode, 400); assert.equal(state.user.credits, 50);
    assert.deepEqual(state.actor.inventory, []); assert.equal(state.saves(), 0);
  }
});

test('public catalogues hide food and kiosk water, preserve indices and retain a filtered-empty custom marker', async () => {
  const shared = { scopedFilter: scope.scopedFilter,
    Kiosk: { find: () => query([{ _id: 'shop', catalog: [{ itemId: food, mode: 'sell' },
      { itemId: water, mode: 'sell' }, { itemId: tree, mode: 'sell', priceCredits: 17 }] },
    { _id: 'food-only', catalog: [{ itemId: food, mode: 'sell' }] }]) },
    DroneOffer: { find: () => query([{ _id: 'food-offer', itemId: food }, { _id: 'water-offer', itemId: water }]) } };
  const handlers = load('routes/publicModules/data.js', { './shared': shared });
  const kiosks = (await call(handlers['get /kiosks'])).body;
  assert.equal(kiosks[0].catalog.length, 1); assert.equal(kiosks[0].catalog[0].catalogIndex, 2);
  assert.equal(kiosks[0].catalog[0].itemId._id, 'tree');
  assert.equal(kiosks[1].catalog.length, 0); assert.equal(kiosks[1].hasCustomCatalog, true);
  const offers = (await call(handlers['get /drone-offers'])).body;
  assert.equal(offers.length, 1); assert.equal(offers[0].itemId._id, 'water');
});

test('the original kiosk index still settles the displayed allowed item after preceding foods are hidden', async () => {
  const state = economy();
  state.dependencies['../models/Kiosk'] = { findOne: () => query({ catalog: [{ itemId: food, mode: 'sell' },
    { itemId: water, mode: 'sell' }, { itemId: tree, mode: 'sell', priceCredits: 17 }] }) };
  const handlers = load('routes/kiosks.js', state.dependencies);
  const result = await call(handlers['post /:id/transaction'], { characterId: 'actor', catalogIndex: 2 }, { id: 'shop' });
  assert.equal(result.statusCode, 200); assert.equal(state.user.credits, 33);
  assert.equal(state.actor.inventory[0].itemId, 'tree'); assert.equal(state.saves(), 2);
});

test('administrator drone registration rejects canonical food metadata and accepts water', async () => {
  let saves = 0;
  class DroneOffer { constructor(payload) { Object.assign(this, payload); } async save() { saves++; return this; } }
  const handlers = load('routes/admin/droneOffers.js', { '../../models/DroneOffer': DroneOffer,
    '../../models/Item': { findOne: filter => query(items.find(item => item._id === filter._id)) } });
  for (const method of ['post /', 'put /:id']) {
    const result = await call(handlers[method], { itemId: { _id: 'food', name: '가짜 재료 이름' } }, { id: 'old' });
    assert.equal(result.statusCode, 400); assert.equal(saves, 0);
  }
  const result = await call(handlers['post /'], { itemId: 'water', priceCredits: 17 });
  assert.equal(result.statusCode, 200); assert.equal(saves, 1);
});

test('administrator kiosk registration rejects food, water and food exchange inputs before saving', async () => {
  let saves = 0;
  class Kiosk { constructor(payload) { Object.assign(this, payload); } async save() { saves++; return this; } }
  const handlers = load('routes/admin/kiosks.js', { '../../models/Item': { find: () => query(items) },
    '../../models/Map': {}, '../../models/Kiosk': Kiosk,
    '../../utils/defaultZones': { DEFAULT_ZONES: [], KIOSK_MAP_NAMES: [] } }, true);
  for (const row of [null, { itemId: 'food', mode: 'sell' }, { itemId: 'water', mode: 'sell' },
    { itemId: 'tree', mode: 'exchange', exchange: { giveItemId: 'food', giveQty: 1 } }]) {
    for (const method of ['post /kiosks', 'put /kiosks/:id']) {
      const result = await call(handlers[method], { mapId: 'map', catalog: [row] }, { id: 'shop' });
      assert.equal(result.statusCode, 400); assert.equal(saves, 0);
    }
  }
  const result = await call(handlers['post /kiosks'], { mapId: 'map', catalog: [{ itemId: 'tree', mode: 'sell', priceCredits: 17 }] });
  assert.equal(result.statusCode, 200); assert.equal(saves, 1);
});

test('administrator default generation sells exactly the six requested items including the VF blood sample', async () => {
  const names = ['운석', '생명의 나무', '미스릴', '전술 강화 모듈', 'VF 혈액 샘플', '포스 코어'];
  const stock = names.map((name, index) => ({ _id: `default-${index}`, name, type: '재료' }));
  let inserted;
  const handlers = load('routes/admin/kiosks.js', { '../../models/Item': { find: () => query(stock) },
    '../../models/Map': { find: () => query([{ _id: 'map', name: '지도', zones: [{ zoneId: 'hospital', name: '병원', hasKiosk: true }] }]) },
    '../../models/Kiosk': { find: () => query([]), insertMany: async rows => { inserted = rows; } },
    '../../utils/defaultZones': { DEFAULT_ZONES: [], KIOSK_MAP_NAMES: [] } }, true);
  const result = await call(handlers['post /kiosks/generate'], { mode: 'missing' });
  assert.equal(result.statusCode, 200); assert.equal(result.body.createdCount, 1);
  const sales = inserted[0].catalog.filter(row => row.mode === 'sell');
  assert.deepEqual(Array.from(sales, row => stock.find(item => item._id === row.itemId).name).sort(), names.slice().sort());
  assert.equal(sales.find(row => row.itemId === 'default-4').priceCredits, 500);
});
