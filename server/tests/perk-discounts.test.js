const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePerkEffects,
  mergePerkEffects,
  applyDiscountedCost,
} = require('../utils/perkRuntime');

test('market and channel discounts stay separate and each reduces price exactly once', () => {
  const cases = [
    { raw: { marketDiscountPct: 10 }, kiosk: 0, drone: 0, market: 0.1, kioskPrice: 90, dronePrice: 90 },
    { raw: { kioskDiscountPct: 10 }, kiosk: 0.1, drone: 0, market: 0, kioskPrice: 90, dronePrice: 100 },
    { raw: { droneDiscountPct: 0.1 }, kiosk: 0, drone: 0.1, market: 0, kioskPrice: 100, dronePrice: 90 },
    { raw: { kioskDiscountPct: 5, marketDiscountPct: 10, droneDiscountPct: 10 }, kiosk: 0.05, drone: 0.1, market: 0.1, kioskPrice: 85, dronePrice: 80 },
  ];

  for (const scenario of cases) {
    const effects = normalizePerkEffects(scenario.raw);
    assert.equal(effects.kioskDiscountPct, scenario.kiosk);
    assert.equal(effects.droneDiscountPct, scenario.drone);
    assert.equal(effects.marketDiscountPct, scenario.market);
    assert.deepEqual(normalizePerkEffects(effects), effects, 'normalization is idempotent');
    assert.equal(applyDiscountedCost(100, effects.kioskDiscountPct, effects.marketDiscountPct), scenario.kioskPrice);
    assert.equal(applyDiscountedCost(100, effects.droneDiscountPct, effects.marketDiscountPct), scenario.dronePrice);
  }
});

test('aliases from multiple perks merge by channel without duplicating the shared market discount', () => {
  const effects = mergePerkEffects([
    { shopDiscountPct: 5 },
    { kioskDiscount: 0.05 },
    { marketDiscount: 10 },
    { discountPct: 0 },
  ]);

  assert.equal(effects.kioskDiscountPct, 0.1);
  assert.equal(effects.droneDiscountPct, 0);
  assert.equal(effects.marketDiscountPct, 0.1);
  assert.equal(applyDiscountedCost(100, effects.kioskDiscountPct, effects.marketDiscountPct), 80);
  assert.deepEqual(normalizePerkEffects(effects), effects);
});

test('combined discounts keep the established five percent minimum price', () => {
  assert.equal(applyDiscountedCost(100, 0.8, 0.4), 5);
  assert.equal(applyDiscountedCost(1, 0.8, 0.4), 0);
});
