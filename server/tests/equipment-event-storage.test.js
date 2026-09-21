const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/game');
const GameLog = require('../models/GameLog');
const Character = require('../models/Characters');
const handler = router.stack.find(row => row.route?.path === '/end').route.stack.at(-1).handle;

test('actual account recording handler preserves bounded equipment receipts and damage health', async () => {
  const before = [Character.findOne, Character.find, GameLog.countDocuments, GameLog.prototype.save];
  let saved;
  Character.findOne = async () => ({ name: '시험 참가자' });
  Character.find = async () => [];
  GameLog.countDocuments = async () => 0;
  GameLog.prototype.save = async function () { saved = this.toObject(); return this; };
  try {
    const at = { day: 1, phase: 'day', sec: 100.8 }, point = { zoneId: 'school', x: 2, y: 3 };
    const event = { kind: 'equipment_effect', effectId: 'a:equipment:1', effectKind: 'rupture', stage: 'triggered',
      who: 'a', targetId: 'b', itemId: 'authored-head', itemName: '파열 모자', delaySec: 0.8, dueAtSec: 100.8,
      cooldownUntil: 108, radius: 2, baseDamage: 20, centerPosition: point, at, unsupported: 'must not persist' };
    const health = { version: 1, attacker: { id: 'a', before: { hp: 80, maxHp: 100 }, after: { hp: 81, maxHp: 100 } },
      target: { id: 'b', before: { hp: 10, maxHp: 100 }, after: { hp: 0, maxHp: 100 } } };
    const battle = { kind: 'battle', subkind: 'equipment_effect', equipmentEffectId: event.effectId,
      a: 'a', b: 'b', damage: 10, lethal: true, itemName: event.itemName, health, at };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ user: { id: '222222222222222222222222' }, body: { winnerId: 'a', participants: [],
      runEvents: [event, battle, { kind: 'damage', equipmentEffectId: event.effectId, damage: Infinity, centerPosition: { ...point, x: NaN } }] } }, res);
    assert.equal(res.statusCode, 200);
    const { unsupported, ...expected } = event;
    assert.deepEqual(saved.runEvents[0], expected);
    assert.deepEqual(saved.runEvents[1], battle);
    assert.equal(Object.hasOwn(saved.runEvents[2], 'damage'), false);
    assert.equal(Object.hasOwn(saved.runEvents[2], 'centerPosition'), false);
  } finally { [Character.findOne, Character.find, GameLog.countDocuments, GameLog.prototype.save] = before; }
});
