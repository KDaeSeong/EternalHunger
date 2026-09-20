const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConsumeEffect, consumeEffectErrorText } = require('../utils/consumeEffectContract');

test('omitted legacy effect stays omitted, including explicit clearing', () => {
  for (const value of [undefined, null]) assert.deepEqual(normalizeConsumeEffect(value), { ok: true, explicit: false, effect: null });
});
test('explicit recovery is valid without name, tags or implicit defaults', () => {
  assert.deepEqual(normalizeConsumeEffect({ heal: '25', satiety: 0 }), {
    ok: true, explicit: true, effect: { version: 1, heal: 25, satiety: 0 },
  });
});
test('parsing is pure and owns nested data', () => {
  const source = { version: 1, shield: 20, regen: 2, durationSec: 3.5, stats: { attackPower: 5, moveSpeed: 0.1 } };
  const before = structuredClone(source);
  const result = normalizeConsumeEffect(source);
  assert.equal(result.ok, true);
  assert.deepEqual(source, before);
  assert.deepEqual(result.effect, source);
  assert.notEqual(result.effect.stats, source.stats);
  assert.deepEqual(normalizeConsumeEffect(JSON.parse(JSON.stringify(source))), result);
});
test('unknown fields, versions, stats and malformed shapes are never silently discarded', () => {
  for (const source of [[], false, 10, 'heal', { heal: 10, version: 2 }, { heal: 10, future: 1 },
    { stats: [] }, { stats: { unknown: 1 }, durationSec: 1 }, { heal: 10, stats: { attackPower: -1 } }]) {
    const result = normalizeConsumeEffect(source);
    assert.equal(result.ok, false, JSON.stringify(source));
    assert.equal(result.explicit, true);
    assert.ok(consumeEffectErrorText(result));
  }
});
test('healing amounts are nonnegative integers and satiety remains bounded', () => {
  for (const key of ['heal', 'satiety', 'shield', 'regen']) {
    for (const value of [-1, 0.5, '', false, null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const source = { heal: 1, [key]: value, ...(['shield', 'regen'].includes(key) ? { durationSec: 2 } : {}) };
      assert.equal(normalizeConsumeEffect(source).reason, 'invalid_amount', `${key}: ${String(value)}`);
    }
  }
  assert.equal(normalizeConsumeEffect({ satiety: 101 }).ok, false);
  assert.equal(normalizeConsumeEffect({ satiety: 100 }).ok, true);
});
test('time is required only for an actual timed effect; fractional seconds survive', () => {
  for (const effect of [{ shield: 1 }, { regen: 1 }, { stats: { defense: 2 } }]) {
    assert.equal(normalizeConsumeEffect(effect).ok, false);
    assert.equal(normalizeConsumeEffect({ ...effect, durationSec: 0 }).ok, false);
    assert.equal(normalizeConsumeEffect({ ...effect, durationSec: 0.125 }).effect.durationSec, 0.125);
  }
  assert.equal(normalizeConsumeEffect({ heal: 1, durationSec: 2 }).reason, 'unused_duration');
  assert.equal(normalizeConsumeEffect({ shield: 1, durationSec: 86401 }).ok, false);
});
test('empty effects are explicit invalid input, never a request for legacy food healing', () => {
  for (const input of [{}, { version: 1 }, { heal: 0, satiety: 0 }, { stats: { attackPower: 0 }, durationSec: 0 }]) {
    assert.equal(normalizeConsumeEffect(input).reason, 'empty_effect');
  }
});
