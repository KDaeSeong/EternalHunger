import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Only run against the disposable replica set created by the local harness.
// This tests the real routers and database, with a fixture identity instead of JWT auth.
const uri = process.env.EH_TEST_MONGO_URI || '';
const parsed = new URL(uri);
assert.equal(parsed.protocol, 'mongodb:');
assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname));
assert.equal(parsed.username, '');
assert.equal(parsed.password, '');
const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const fixtureRoot = realpathSync(process.env.EH_MARKET_FIXTURE_ROOT || '');
const fixtureParent = realpathSync(path.join(root, '.local/code-audit/mongo-market'));
assert.equal(path.dirname(fixtureRoot), fixtureParent);
assert.match(path.basename(fixtureRoot), /^fixture-[a-f0-9]{12}$/);
const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.port, Number(parsed.port));
assert.equal(manifest.dataPath, path.join(fixtureRoot, 'data'));
assert.match(manifest.replicaSet, /^eh_market_fixture_[a-f0-9]{12}$/);

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const express = require('express');
const { MongoClient } = mongoose.mongo;
const guard = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 });
await guard.connect();
try {
  const { parsed: options } = await guard.db('admin').command({ getCmdLineOpts: 1 });
  assert.equal(realpathSync(options.storage.dbPath), realpathSync(manifest.dataPath));
  assert.equal(options.net.bindIp, '127.0.0.1');
  assert.equal(options.net.port, manifest.port);
  assert.equal(options.replication.replSet, manifest.replicaSet);
} finally { await guard.close(); }

const User = require('../../models/User');
const Character = require('../../models/Characters');
const Item = require('../../models/Item');
const Kiosk = require('../../models/Kiosk');
const DroneOffer = require('../../models/DroneOffer');
const Perk = require('../../models/Perk');
const dbName = `eh_market_test_${randomBytes(8).toString('hex')}`;
assert.match(dbName, /^eh_market_test_[a-f0-9]{16}$/);
await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
let server;
const checks = [];
let requestUserId;
async function check(name, run) { await run(); checks.push(name); }
const id = value => String(value._id || value);
const qty = (character, item) => character.inventory.reduce((sum, row) =>
  sum + (String(row.itemId) === id(item) ? row.qty : 0), 0);
const userCredits = async user => (await User.findById(user._id).lean()).credits;
async function actor(user, inventory = []) {
  return Character.create({ userId: user._id, name: `market-${randomBytes(4).toString('hex')}`, inventory });
}
async function fixture(credits = 100, inventory = []) {
  const user = await User.create({ username: `market-${randomBytes(8).toString('hex')}`,
    password: randomBytes(24).toString('hex'), credits });
  requestUserId = id(user);
  return { user, character: await actor(user, inventory) };
}
async function post(route, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': requestUserId },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, body: await response.json() };
}
try {
  await Promise.all([User.init(), Character.init(), Item.init(), Kiosk.init(), DroneOffer.init(), Perk.init()]);
  const ore = await Item.create({ name: '시장 검사 철광석', type: '재료' });
  const gear = await Item.create({ name: '시장 검사 철검', type: '무기', equipSlot: 'weapon',
    recipe: { ingredients: [{ itemId: ore._id, qty: 1 }], creditsCost: 60, resultQty: 1 } });
  const water = await Item.create({ name: '물', type: '소모품', tags: ['food', 'drink'] });
  const apple = await Item.create({ name: '시장 검사 사과', type: '소모품', tags: ['food'] });
  const kiosk = await Kiosk.create({ kioskId: `fixture-${randomBytes(4).toString('hex')}`,
    mapId: new mongoose.Types.ObjectId(), catalog: [
      { itemId: gear._id, mode: 'sell', priceCredits: 60 },
      { itemId: ore._id, mode: 'buy', priceCredits: 12 },
      { itemId: gear._id, mode: 'exchange', exchange: { giveItemId: ore._id, giveQty: 1 } },
      { itemId: gear._id, mode: 'exchange', exchange: { giveItemId: apple._id, giveQty: 1 } },
      { itemId: gear._id, mode: 'exchange', exchange: { giveItemId: water._id, giveQty: 1 } },
    ] });
  const offer = await DroneOffer.create({ itemId: water._id, priceCredits: 60 });
  const kioskRoute = `/api/kiosks/${kiosk._id}/transaction`;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: req.headers['x-fixture-user'] }; next(); });
  app.use('/api/kiosks', require('../../routes/kiosks'));
  app.use('/api/drone', require('../../routes/drone'));
  app.use('/api/items', require('../../routes/items'));
  server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.on('error', reject);
  });

  await check('kiosk purchase, sale and exchange commit both documents', async () => {
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 2 }]);
    const buy = await post(kioskRoute, { characterId: id(character), catalogIndex: 0 });
    assert.equal(buy.status, 200); assert.equal(buy.body.credits, 40);
    assert.equal(qty(await Character.findById(character._id), gear), 1);
    const sale = await post(kioskRoute, { characterId: id(character), catalogIndex: 1 });
    assert.equal(sale.status, 200); assert.equal(sale.body.credits, 52);
    const exchange = await post(kioskRoute, { characterId: id(character), catalogIndex: 2 });
    assert.equal(exchange.status, 200); assert.equal(await userCredits(user), 52);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0); assert.equal(qty(saved, gear), 2);
  });
  await check('drone water purchase commits credits and inventory', async () => {
    const { user, character } = await fixture();
    const reply = await post('/api/drone/buy', { characterId: id(character), offerId: id(offer) });
    assert.equal(reply.status, 200); assert.equal(reply.body.credits, 40);
    assert.equal(await userCredits(user), 40);
    assert.equal(qty(await Character.findById(character._id), water), 1);
  });
  await check('craft commits material debit, credit debit and output', async () => {
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
    const reply = await post('/api/items/craft', { characterId: id(character), itemId: id(gear) });
    assert.equal(reply.status, 200); assert.equal(await userCredits(user), 40);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0); assert.equal(qty(saved, gear), 1);
  });
  await check('authored fractional recipe costs and quantities stay supported', async () => {
    const custom = await Item.create({ name: '시장 검사 분할 재료 제작', type: '재료',
      recipe: { ingredients: [{ itemId: ore._id, qty: 0.5 }], creditsCost: 2.5, resultQty: 1.5 } });
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
    const reply = await post('/api/items/craft', { characterId: id(character), itemId: id(custom) });
    assert.equal(reply.status, 200); assert.equal(await userCredits(user), 97.5);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0.5); assert.equal(qty(saved, custom), 1.5);
  });
  await check('fractional request quantities preserve market and crafting contracts', async () => {
    const cheapOffer = await DroneOffer.create({ itemId: water._id, priceCredits: 1 });
    const cheapKiosk = await Kiosk.create({ kioskId: `fractional-${randomBytes(4).toString('hex')}`,
      mapId: new mongoose.Types.ObjectId(), catalog: [
        { itemId: gear._id, mode: 'sell', priceCredits: 1 },
        { itemId: gear._id, mode: 'exchange', exchange: { giveItemId: ore._id, giveQty: 1 } },
      ] });
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 2 }]);
    const cheapRoute = `/api/kiosks/${cheapKiosk._id}/transaction`;
    for (const amount of [1.5, 0.5]) {
      assert.equal((await post('/api/drone/buy', { characterId: id(character), offerId: id(cheapOffer), qty: amount })).status, 200);
      assert.equal((await post(cheapRoute, { characterId: id(character), catalogIndex: 0, qty: amount })).status, 200);
    }
    assert.equal(await userCredits(user), 95);
    let saved = await Character.findById(character._id);
    assert.equal(qty(saved, water), 2.5); assert.equal(qty(saved, gear), 2.5);
    assert.equal((await post(cheapRoute, { characterId: id(character), catalogIndex: 1, qty: 1.5 })).status, 200);
    saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0.5); assert.equal(qty(saved, gear), 4);
    assert.equal(await userCredits(user), 95);
    const craftFixture = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
    assert.equal((await post('/api/items/craft', { characterId: id(craftFixture.character), itemId: id(gear), qty: 0.5 })).status, 200);
    assert.equal(await userCredits(craftFixture.user), 70);
    const crafted = await Character.findById(craftFixture.character._id);
    assert.equal(qty(crafted, ore), 0.5); assert.equal(qty(crafted, gear), 0.5);
  });

  for (const [name, route, body] of [
    ['kiosk', kioskRoute, { catalogIndex: 0 }],
    ['drone', '/api/drone/buy', { offerId: id(offer) }],
    ['craft', '/api/items/craft', { itemId: id(gear) }],
  ]) {
    await check(`${name} failure after debit rolls back both documents`, async () => {
      const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
      const originalSave = Character.prototype.save;
      const originalError = console.error;
      let injected = 0;
      Character.prototype.save = async function(options) {
        if (id(this) === id(character)) {
          assert.ok(options?.session, 'character persistence must share the transaction session');
          assert.equal((await User.findById(user._id).session(options.session)).credits, 40);
          assert.equal(await userCredits(user), 100, 'uncommitted debit must be invisible outside the transaction');
          injected++;
          throw new Error('EH_MARKET_INTENTIONAL_SAVE_FAILURE');
        }
        return originalSave.call(this, options);
      };
      console.error = error => {
        if (error?.message !== 'EH_MARKET_INTENTIONAL_SAVE_FAILURE') originalError(error);
      };
      let reply;
      try { reply = await post(route, { characterId: id(character), ...body }); }
      finally { Character.prototype.save = originalSave; console.error = originalError; }
      assert.equal(reply.status, 500); assert.equal(injected, 1);
      assert.equal(await userCredits(user), 100);
      const saved = await Character.findById(character._id);
      assert.equal(qty(saved, ore), 1); assert.equal(qty(saved, gear), 0); assert.equal(qty(saved, water), 0);
    });
  }
  await check('concurrent drone orders cannot overspend across characters', async () => {
    const { user, character } = await fixture();
    const other = await actor(user);
    const replies = await Promise.all([character, other].map(ch =>
      post('/api/drone/buy', { characterId: id(ch), offerId: id(offer) })));
    assert.deepEqual(replies.map(row => row.status).sort(), [200, 400]);
    assert.equal(await userCredits(user), 40);
    assert.equal(qty(await Character.findById(character._id), water) + qty(await Character.findById(other._id), water), 1);
  });
  await check('concurrent free exchanges cannot spend one material twice', async () => {
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
    const replies = await Promise.all([1, 2].map(() => post(kioskRoute,
      { characterId: id(character), catalogIndex: 2 })));
    assert.deepEqual(replies.map(row => row.status).sort(), [200, 400]);
    assert.equal(await userCredits(user), 100);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0); assert.equal(qty(saved, gear), 1);
  });
  await check('concurrent crafting cannot duplicate output or material debit', async () => {
    const { user, character } = await fixture(100, [{ itemId: ore._id, qty: 1 }]);
    const replies = await Promise.all([1, 2].map(() => post('/api/items/craft',
      { characterId: id(character), itemId: id(gear) })));
    assert.deepEqual(replies.map(row => row.status).sort(), [200, 400]);
    assert.equal(await userCredits(user), 40);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, ore), 0); assert.equal(qty(saved, gear), 1);
  });
  await check('populated exchange materials reject both food and water', async () => {
    const { user, character } = await fixture(100,
      [{ itemId: apple._id, qty: 1 }, { itemId: water._id, qty: 1 }]);
    for (const catalogIndex of [3, 4]) {
      assert.equal((await post(kioskRoute, { characterId: id(character), catalogIndex })).status, 400);
    }
    assert.equal(await userCredits(user), 100);
    const saved = await Character.findById(character._id);
    assert.equal(qty(saved, apple), 1); assert.equal(qty(saved, water), 1); assert.equal(qty(saved, gear), 0);
  });
  await check('invalid quantities and foreign characters cannot change balances', async () => {
    const { user, character } = await fixture();
    for (const value of [0, -1, Number.MAX_SAFE_INTEGER + 1, 'invalid']) {
      assert.equal((await post('/api/drone/buy', { characterId: id(character), offerId: id(offer), qty: value })).status, 400);
    }
    const foreign = await actor({ _id: new mongoose.Types.ObjectId() });
    assert.equal((await post('/api/drone/buy', { characterId: id(foreign), offerId: id(offer) })).status, 404);
    assert.equal(await userCredits(user), 100);
    assert.equal(qty(await Character.findById(character._id), water), 0);
  });
  console.log('MONGO_MARKET_CHECKS ' + JSON.stringify({ pass: true, checks: checks.length,
    names: checks, database: dbName, jwtAuthTested: false, publicDataTouched: false }));
} finally {
  if (server) {
    const closing = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closing;
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
