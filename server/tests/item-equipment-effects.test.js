const { test } = require('node:test');
const assert = require('node:assert/strict');
const Item = require('../models/Item');
const router = require('../routes/admin/items');
const { normalizeEquipmentEffects } = require('../utils/equipmentEffectContract');
const { prepareItemEffectWritePayload, equipmentEffectWriteGuard } = require('../utils/itemEffectWritePayload');
const userId = '222222222222222222222222', itemId = '111111111111111111111111';
const effect = () => ({ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
  damage: { base: 20, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0.25 } });
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } });
const route = (path, method) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;

test('canonical schema preserves effects, numeric strings, independent ownership and clear', async () => {
  const raw = effect(); raw.delaySec = '0.8';
  const item = new Item({ name: '파열 모자', type: '방어구', equipmentEffects: [raw] });
  await item.validate(); assert.deepEqual(item.toObject().equipmentEffects, [effect()]);
  item.equipmentEffects[0].damage.base = 99; assert.equal(raw.damage.base, 20);
  item.equipmentEffects[0].radius = -1; assert.ok(item.validateSync()?.errors.equipmentEffects);
  item.equipmentEffects = null; await item.validate(); assert.equal(item.equipmentEffects, null);
  assert.equal(new Item({ name: '기존 아이템' }).equipmentEffects, undefined);
});
test('contract rejects unsafe, unknown and recursive definitions without normalization loss', () => {
  for (const value of [true, {}, [effect(), effect()], [{ ...effect(), radius: 0 }],
    [{ ...effect(), delaySec: 0.0000001 }], [{ ...effect(), cooldownSec: Infinity }],
    [{ ...effect(), kind: 'unknown' }], [{ ...effect(), version: 2 }], [{ ...effect(), onProc: effect() }],
    [{ ...effect(), damage: { base: true } }], [{ ...effect(), damage: { base: '' } }], [{ ...effect(), damage: {} }]])
    assert.equal(normalizeEquipmentEffects(value).ok, false, JSON.stringify(value));
});
test('plain patches preserve omitted definitions and cross-field writes have atomic guards', () => {
  assert.deepEqual(prepareItemEffectWritePayload({ name: '변경' }).payload, { name: '변경' });
  assert.deepEqual(prepareItemEffectWritePayload({ equipmentEffects: null }).payload.equipmentEffects, []);
  assert.equal(prepareItemEffectWritePayload({ type: '재료', equipmentEffects: [effect()] }).ok, false);
  assert.deepEqual(equipmentEffectWriteGuard({ equipmentEffects: [effect()] }), { type: { $in: ['무기', '방어구'] } });
  assert.deepEqual(equipmentEffectWriteGuard({ type: '소모품' }), { $or: [{ equipmentEffects: null }, { equipmentEffects: { $size: 0 } }] });
  assert.deepEqual(equipmentEffectWriteGuard({ type: '소모품', equipmentEffects: [] }), {});
});
test('actual POST and PUT reject bad effects before database writes', async () => {
  const before = [Item.prototype.save, Item.findOneAndUpdate]; let writes = 0;
  Item.prototype.save = Item.findOneAndUpdate = async () => { writes++; throw Error('unexpected write'); };
  try {
    for (const [path, method] of [['/items', 'post'], ['/items/:id', 'put']]) {
      for (const body of [{ equipmentEffects: [{ ...effect(), radius: -1 }] }, { 'equipmentEffects.0.radius': 2 },
        { $set: { equipmentEffects: [effect()] } }, { type: '재료', equipmentEffects: [effect()] }]) {
        const res = response(); await route(path, method)({ user: { id: userId }, params: { id: itemId }, body }, res);
        assert.equal(res.statusCode, 400); assert.doesNotMatch(res.body.error, /equipmentEffects|Mongo|ValidationError/);
      }
    }
    assert.equal(writes, 0);
  } finally { [Item.prototype.save, Item.findOneAndUpdate] = before; }
});
test('real create and partial update retain authenticated ownership, effects and clear semantics', async () => {
  const before = [Item.prototype.save, Item.findOneAndUpdate]; let saved; const writes = [];
  Item.prototype.save = async function () { await this.validate(); saved = this.toObject(); return this; };
  Item.findOneAndUpdate = async (filter, payload, options) => { writes.push({ filter, payload, options }); return payload; };
  try {
    const res = response(); await route('/items', 'post')({ user: { id: userId }, body: { name: '파열 모자', type: '방어구',
      ownerUserId: itemId, equipmentEffects: [effect()] } }, res);
    assert.equal(res.statusCode, 200); assert.equal(String(saved.ownerUserId), userId); assert.deepEqual(saved.equipmentEffects, [effect()]);
    for (const body of [{ equipmentEffects: [effect()] }, { equipmentEffects: null }, { name: '이름만' }, { type: '재료' }]) {
      const result = response(); await route('/items/:id', 'put')({ user: { id: userId }, params: { id: itemId }, body }, result);
      assert.equal(result.statusCode, 200);
    }
    for (const write of writes) {
      assert.equal(write.filter._id, itemId); assert.equal(write.filter.ownerUserId, userId);
      assert.equal(write.payload.ownerUserId, userId); assert.equal(write.options.runValidators, true);
    }
    assert.deepEqual(writes[0].filter.type, { $in: ['무기', '방어구'] });
    assert.deepEqual(writes[1].payload.equipmentEffects, []);
    assert.equal(Object.hasOwn(writes[2].payload, 'equipmentEffects'), false);
    assert.ok(writes[3].filter.$or);
  } finally { [Item.prototype.save, Item.findOneAndUpdate] = before; }
});
test('missing authentication and mismatched stored classification cannot write', async () => {
  const before = Item.findOneAndUpdate; let calls = 0;
  Item.findOneAndUpdate = async () => { calls++; return null; };
  try {
    const missing = response(); await route('/items/:id', 'put')({ params: { id: itemId }, body: { equipmentEffects: [effect()] } }, missing);
    assert.equal(missing.statusCode, 401); assert.equal(calls, 0);
    const mismatch = response(); await route('/items/:id', 'put')({ user: { id: userId }, params: { id: itemId }, body: { equipmentEffects: [effect()] } }, mismatch);
    assert.equal(mismatch.statusCode, 404); assert.match(mismatch.body.error, /분류와 장비 효과/);
  } finally { Item.findOneAndUpdate = before; }
});
