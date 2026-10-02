import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// Never use an account database: require an isolated loopback replica set whose
// dbpath is inside a newly created eh-custom-item-check-* OS temporary folder.
const uri = process.env.EH_TEST_MONGO_URI || '';
assert.match(uri, /^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\//);
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const probe = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await probe.connect();
  const { parsed } = await probe.db('admin').command({ getCmdLineOpts: 1 });
  const fixtureRoot = path.dirname(path.resolve(parsed.storage.dbPath));
  assert.equal(path.dirname(fixtureRoot), path.resolve(os.tmpdir()));
  assert.match(path.basename(fixtureRoot), /^eh-custom-item-check-[a-f0-9]+$/);
  assert.equal(parsed.net.bindIp, '127.0.0.1');
  assert.equal(parsed.net.port, Number(new URL(uri).port));
  assert.match(parsed.replication.replSet, /^eh_goal_fixture_/);
} finally { await probe.close(); }

const originalSecret = process.env.MY_SECRET_KEY;
const originalSecure = process.env.COOKIE_SECURE;
process.env.MY_SECRET_KEY = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
const express = require('express');
const User = require('../../models/User');
const Item = require('../../models/Item');
const { verifyToken } = require('../../middleware/authMiddleware');
const authRouter = require('../../routes/auth');
const adminRouter = require('../../routes/admin');
const publicRouter = require('../../routes/publicModules/data');
const saveRouter = require('../../routes/gameSaves');
const dbName = 'eh_custom_item_test_' + randomBytes(12).toString('hex');
const password = 'Fixture!Only9Password';
const rupture = { version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
  damage: { base: 20, perLevel: 1, attackPowerRatio: 0, skillAmpRatio: 0.25 } };
let server, connected = false, baseUrl;
let checks = 0;
function checked(label) { checks += 1; console.log('PASS ' + label); }

async function request(route, { method = 'GET', body, cookies = new Map(), csrf = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  if (csrf && method !== 'GET' && cookies.has('eh_csrf')) headers['X-CSRF-Token'] = cookies.get('eh_csrf');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const reply = await fetch(baseUrl + route, { method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
  for (const value of reply.headers.getSetCookie()) {
    const match = /^(token|eh_csrf)=([^;]*)/.exec(value);
    if (match) cookies.set(match[1], match[2]);
  }
  return { status: reply.status, body: await reply.json() };
}
function expect(reply, status) { assert.equal(reply.status, status, JSON.stringify(reply.body)); return reply.body; }
async function account(label, isAdmin = false) {
  const username = 'hf6_' + randomBytes(8).toString('hex');
  expect(await request('/api/auth/signup', { method: 'POST',
    body: { username, password, nickname: label, acceptTerms: true, acceptPrivacy: true } }), 201);
  // Only this random disposable test database receives a fixture admin role.
  if (isAdmin) await User.updateOne({ username }, { $set: { isAdmin: true } });
  const cookies = new Map();
  const login = expect(await request('/api/auth/login', { method: 'POST', body: { username, password }, cookies }), 200);
  assert.ok(cookies.has('token') && cookies.has('eh_csrf'));
  assert.equal(expect(await request('/api/auth/session', { cookies }), 200).user.id, login.user.id);
  return { cookies, id: login.user.id };
}

try {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 }); connected = true;
  await Promise.all([User.init(), Item.init()]);
  checked('actual user and item MongoDB indexes initialize');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/game-saves', verifyToken, saveRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  const owner = await account('작성자', true), other = await account('다른 계정');
  checked('real signup, hashed-password login, JWT cookies and session lookup');
  assert.equal((await request('/api/admin/items')).status, 401);
  assert.equal((await request('/api/admin/items', { cookies: other.cookies })).status, 403);
  checked('anonymous and non-admin writes remain protected');
  const shared = await Item.create({ name: '공용 재료', type: '재료' });
  const otherItem = await Item.create({ name: '다른 계정의 재료', type: '재료', ownerUserId: other.id });
  const create = body => request('/api/admin/items', { method: 'POST', body, cookies: owner.cookies });
  assert.equal((await request('/api/admin/items', { method: 'POST', csrf: false,
    cookies: owner.cookies, body: { name: '실패해야 할 재료', type: '재료' } })).status, 403);
  assert.equal(await Item.countDocuments(), 2);
  checked('cookie writes without CSRF do not create items');
  const material = expect(await create({ name: '맞춤 부품', type: '재료', stackMax: 10, ownerUserId: other.id }), 200).item;
  assert.equal(material.ownerUserId, owner.id);
  const gear = expect(await create({ name: '맞춤 파열 모자', type: '방어구', equipSlot: 'head', tier: 4,
    externalId: 'hf6-custom-rupture',
    stats: { def: 5 }, equipmentEffects: [rupture],
    recipe: { ingredients: [{ itemId: material._id, qty: 2 }], creditsCost: 7, resultQty: 1 } }), 200).item;
  const food = expect(await create({ name: '맞춤 회복약', type: '소모품', stackMax: 6,
    consumeEffect: { heal: '25', satiety: 0 },
    recipe: { ingredients: [{ itemId: material._id, qty: 2 }], creditsCost: 7, resultQty: 3 } }), 200).item;
  assert.deepEqual(gear.equipmentEffects, [rupture]);
  assert.deepEqual(food.consumeEffect, { version: 1, heal: 25, satiety: 0 });
  checked('authenticated creation persists recipe identities, quantities, costs and both effect types');

  const catalog = expect(await request('/api/public/items', { cookies: owner.cookies }), 200);
  assert.deepEqual(new Set(catalog.map(item => item._id)), new Set([String(shared._id), material._id, gear._id, food._id]));
  for (const saved of [gear, food]) {
    const loaded = catalog.find(item => item._id === saved._id);
    for (const field of ['itemKey', 'type', 'equipSlot', 'stackMax', 'stats', 'recipe']) assert.deepEqual(loaded[field], saved[field], field);
    if (saved.equipmentEffects) assert.deepEqual(loaded.equipmentEffects, saved.equipmentEffects);
    if (saved.consumeEffect) assert.deepEqual(loaded.consumeEffect, saved.consumeEffect);
  }
  checked('cookie-authenticated simulation catalog returns complete authored items');
  assert.deepEqual(expect(await request('/api/public/items'), 200).map(item => item._id), [String(shared._id)]);
  assert.deepEqual(new Set(expect(await request('/api/public/items', { cookies: other.cookies }), 200).map(item => item._id)),
    new Set([String(shared._id), String(otherItem._id)]));
  checked('anonymous and other-account catalogs never expose the author inventory');

  const update = (id, body) => request('/api/admin/items/' + id, { method: 'PUT', body, cookies: owner.cookies });
  expect(await update(gear._id, { name: '이름만 바꾼 모자' }), 200);
  const before = await Item.findById(gear._id).lean();
  for (const body of [{ equipmentEffects: [{ ...rupture, kind: 'unsupported' }] }, { 'equipmentEffects.0.radius': 1 },
    { $set: { equipmentEffects: [] } }]) {
    const rejected = await update(gear._id, body);
    assert.equal(rejected.status, 400);
    assert.doesNotMatch(rejected.body.error, /Mongo|ValidationError|equipmentEffects/);
    assert.deepEqual(await Item.findById(gear._id).lean(), before);
  }
  expect(await update(food._id, { consumeEffect: { heal: -1 } }), 400);
  expect(await update(String(otherItem._id), { name: '다른 계정 변경 시도' }), 404);
  checked('partial edits preserve effects; invalid effects and foreign edits preserve stored data');

  const savedCatalog = expect(await request('/api/public/items', { cookies: owner.cookies }), 200);
  const slot = expect(await request('/api/game-saves/eternal-hunger/hf6-custom-items', { method: 'PUT', cookies: owner.cookies,
    body: { saveName: '커스텀 입력 왕복', version: 'hf6-http-test', payload: { publicItems: savedCatalog } } }), 200).save;
  assert.deepEqual(slot.payload.publicItems, savedCatalog);
  await mongoose.disconnect(); connected = false;
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 }); connected = true;
  assert.deepEqual(expect(await request('/api/public/items', { cookies: owner.cookies }), 200), savedCatalog);
  assert.deepEqual(expect(await request('/api/game-saves/' + slot.id, { cookies: owner.cookies }), 200).save.payload.publicItems, savedCatalog);
  expect(await request('/api/game-saves/' + slot.id, { cookies: other.cookies }), 404);
  checked('database reconnect and authenticated slot reload retain the same custom input');

  await assert.rejects(Item.create({ name: '중복 키', type: '재료', ownerUserId: owner.id, itemKey: gear.itemKey }), error => error.code === 11000);
  await assert.rejects(Item.create({ name: '중복 외부 ID', type: '재료', ownerUserId: owner.id,
    itemKey: 'hf6-different-key', externalId: gear.externalId }), error => error.code === 11000);
  await Item.create({ name: '다른 계정의 같은 식별자', type: '재료', ownerUserId: other.id,
    itemKey: gear.itemKey, externalId: gear.externalId });
  // Existing legacy documents with empty/missing IDs are excluded from the
  // partial indexes, rather than forcing an identifier migration or deletion.
  const legacyOwner = new mongoose.Types.ObjectId(owner.id);
  await Item.collection.insertMany([{ name: '빈 식별자 1', ownerUserId: legacyOwner, itemKey: '', externalId: '' },
    { name: '빈 식별자 2', ownerUserId: legacyOwner, itemKey: '', externalId: '' },
    { name: '식별자 없음 1', ownerUserId: legacyOwner }, { name: '식별자 없음 2', ownerUserId: legacyOwner }]);
  checked('real unique indexes reject same-owner duplicates but allow other owners and legacy empty identities');
  console.log('MONGO_CUSTOM_ITEMS_HTTP_CHECKS ' + JSON.stringify({ pass: true, checks, cookieAuthentication: true,
    persistentRecipesAndEffects: true, accountIsolation: true, databaseReconnect: true,
    scope: 'isolated real HTTP and MongoDB; not browser editor, match replay or production accounts' }));
} finally {
  try {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } finally {
    try {
      if (connected) {
        // A startup assertion may fail while other imported models are still
        // creating collections. Settle those jobs before dropping this test DB.
        await Promise.allSettled(Object.values(mongoose.models).map(model => model.init()));
        await mongoose.connection.dropDatabase();
      }
    } finally {
      try { await mongoose.disconnect(); }
      finally {
        if (originalSecret === undefined) delete process.env.MY_SECRET_KEY; else process.env.MY_SECRET_KEY = originalSecret;
        if (originalSecure === undefined) delete process.env.COOKIE_SECURE; else process.env.COOKIE_SECURE = originalSecure;
      }
    }
  }
}
