const { test } = require('node:test');
const assert = require('node:assert/strict');
const Item = require('../models/Item');
const router = require('../routes/admin/items');
const { prepareItemEffectWritePayload } = require('../utils/itemEffectWritePayload');
const userId = '222222222222222222222222';
const itemId = '111111111111111111111111';
const effect = { version: 1, heal: 25, satiety: 0 };
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; },
  json(body) { this.body = body; return this; } });
const route = (path, method) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;

test('actual schema keeps canonical effects and allows an explicit null clear', async () => {
  const item = new Item({ name: '맞춤 회복약', type: '소모품', consumeEffect: { heal: '25', satiety: '0' } });
  await item.validate();
  assert.deepEqual(item.toObject().consumeEffect, effect);
  item.consumeEffect = null;
  await item.validate();
  assert.equal(item.toObject().consumeEffect, null);
  assert.equal(new Item({ name: '기존 아이템' }).toObject().consumeEffect, undefined);
});
test('schema validates directly assigned and mutated Mixed values', () => {
  const item = new Item({ name: '맞춤 회복약', consumeEffect: effect });
  item.consumeEffect.heal = -10;
  assert.ok(item.validateSync()?.errors.consumeEffect);
  item.consumeEffect = { heal: 10, unsupported: true };
  assert.ok(item.validateSync()?.errors.consumeEffect);
});
test('plain patches preserve omission, canonicalize values and cannot bypass validation with update operators', () => {
  assert.deepEqual(prepareItemEffectWritePayload({ name: '변경' }), { ok: true, payload: { name: '변경' } });
  assert.deepEqual(prepareItemEffectWritePayload({ consumeEffect: null }).payload, { consumeEffect: null });
  assert.deepEqual(prepareItemEffectWritePayload({ consumeEffect: { heal: '25', satiety: 0 } }).payload.consumeEffect, effect);
  for (const body of [null, [], { $set: { consumeEffect: { heal: -1 } } }, { 'consumeEffect.heal': -1 },
    { consumeEffect: { heal: 25, unsupported: true } }]) assert.equal(prepareItemEffectWritePayload(body).ok, false);
});
test('real POST and PUT handlers reject bad effects before any persistence call', async () => {
  const saveBefore = Item.prototype.save;
  const updateBefore = Item.findOneAndUpdate;
  let writes = 0;
  Item.prototype.save = async () => { writes++; throw new Error('unexpected write'); };
  Item.findOneAndUpdate = async () => { writes++; throw new Error('unexpected write'); };
  try {
    for (const [path, method] of [['/items', 'post'], ['/items/:id', 'put']]) {
      for (const body of [{ name: '오류', consumeEffect: { heal: -1 } }, { consumeEffect: { heal: 25, unknown: 1 } },
        { 'consumeEffect.heal': -10 }, { $set: { consumeEffect: { heal: 25 } } }]) {
        const res = response();
        await route(path, method)({ user: { id: userId }, params: { id: itemId }, body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(typeof res.body.error, 'string');
        assert.doesNotMatch(res.body.error, /consumeEffect|ValidationError|Mongo|Error:/);
      }
    }
    assert.equal(writes, 0);
  } finally { Item.prototype.save = saveBefore; Item.findOneAndUpdate = updateBefore; }
});
test('real POST handler persists the validated effect under the authenticated owner only', async () => {
  const before = Item.prototype.save;
  let saved = null;
  Item.prototype.save = async function () { await this.validate(); saved = this.toObject(); return this; };
  try {
    const res = response();
    await route('/items', 'post')({ user: { id: userId }, body: { name: '맞춤 회복약', type: '소모품',
      ownerUserId: itemId, consumeEffect: { heal: '25', satiety: 0 } } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(saved.consumeEffect, effect);
    assert.equal(String(saved.ownerUserId), userId);
    assert.deepEqual(res.body.item.toObject().consumeEffect, effect);
  } finally { Item.prototype.save = before; }
});
test('real PUT handler retains owner filters and whole-field validation including explicit clearing', async () => {
  const before = Item.findOneAndUpdate;
  const writes = [];
  Item.findOneAndUpdate = async (filter, payload, options) => { writes.push({ filter, payload, options }); return payload; };
  try {
    for (const body of [{ consumeEffect: effect }, { consumeEffect: null }, { name: '이름만 변경' }]) {
      const res = response();
      await route('/items/:id', 'put')({ user: { id: userId }, params: { id: itemId }, body }, res);
      assert.equal(res.statusCode, 200);
    }
    for (const write of writes) {
      assert.deepEqual(write.filter, { _id: itemId, ownerUserId: userId });
      assert.equal(write.payload.ownerUserId, userId);
      assert.equal(write.options.runValidators, true);
    }
    assert.deepEqual(writes[0].payload.consumeEffect, effect);
    assert.equal(writes[1].payload.consumeEffect, null);
    assert.equal(Object.hasOwn(writes[2].payload, 'consumeEffect'), false);
  } finally { Item.findOneAndUpdate = before; }
});
test('missing authentication is rejected before effect or database processing', async () => {
  for (const [path, method] of [['/items', 'post'], ['/items/:id', 'put']]) {
    const res = response();
    await route(path, method)({ params: { id: itemId }, body: { consumeEffect: { heal: -1 } } }, res);
    assert.equal(res.statusCode, 401);
  }
});
