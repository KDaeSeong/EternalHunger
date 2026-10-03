const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/game');
const GameLog = require('../models/GameLog');
const Character = require('../models/Characters');
const User = require('../models/User');
const handler = router.stack.find(row => row.route?.path === '/end').route.stack.at(-1).handle;

test('actual account recording handler preserves bounded equipment receipts and damage health', async () => {
  const before = [Character.findOne, Character.find, GameLog.findOne, GameLog.countDocuments,
    GameLog.prototype.save, GameLog.db.transaction, User.updateOne, User.findById, router.testing.deps.consumeRateLimit];
  const session = { fixture: 'equipment-event-storage' };
  let saved, transactionCalls = 0;
  const read = value => ({
    session(current) { assert.equal(current, session); return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  Character.findOne = async () => ({ name: '시험 참가자' });
  Character.find = () => read([]);
  GameLog.findOne = () => read(null);
  GameLog.countDocuments = async () => 0;
  GameLog.db.transaction = async run => { transactionCalls += 1; return run(session); };
  User.updateOne = async (filter, update, options) => { assert.equal(options.session, session); return { acknowledged: true }; };
  User.findById = () => ({ select() { return this; }, lean: async () => ({ lp: 50, credits: 0, statistics: {} }) });
  router.testing.deps.consumeRateLimit = async () => ({ allowed: true, remaining: 1, retryAfterSec: 1 });
  GameLog.prototype.save = async function (options) {
    assert.equal(options.session, session);
    saved = this.toObject(); return this;
  };
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
    await handler({ user: { id: '222222222222222222222222' }, body: { winnerId: 'a',
      participants: [{ _id: 'a', name: '가', hp: 80 }, { _id: 'b', name: '나', hp: 0 }],
      runEvents: [event, battle, { kind: 'damage', equipmentEffectId: event.effectId, damage: Infinity, centerPosition: { ...point, x: NaN } }] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(transactionCalls, 1);
    const { unsupported, ...expected } = event;
    assert.deepEqual(saved.runEvents[0], expected);
    assert.deepEqual(saved.runEvents[1], battle);
    assert.equal(Object.hasOwn(saved.runEvents[2], 'damage'), false);
    assert.equal(Object.hasOwn(saved.runEvents[2], 'centerPosition'), false);
  } finally {
    [Character.findOne, Character.find, GameLog.findOne, GameLog.countDocuments,
      GameLog.prototype.save, GameLog.db.transaction, User.updateOne, User.findById,
      router.testing.deps.consumeRateLimit] = before;
  }
});
