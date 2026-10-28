import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const client = await import('../src/app/simulation/_lib/perkRuntime.js');
const procurement = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const serverModule = await import('../../server/utils/perkRuntime.js');
const server = serverModule.default || serverModule;

const cases = [
  { name: 'market-only', raw: { marketDiscountPct: 10 }, kiosk: 0, drone: 0, market: 0.1, kioskCost: 90, droneCost: 90 },
  { name: 'kiosk-only', raw: { kioskDiscountPct: 0.1 }, kiosk: 0.1, drone: 0, market: 0, kioskCost: 90, droneCost: 100 },
  { name: 'drone-only', raw: { droneDiscountPct: 10 }, kiosk: 0, drone: 0.1, market: 0, kioskCost: 100, droneCost: 90 },
  { name: 'combined', raw: { kioskDiscountPct: 5, marketDiscountPct: 10, droneDiscountPct: 10 }, kiosk: 0.05, drone: 0.1, market: 0.1, kioskCost: 85, droneCost: 80 },
];

for (const scenario of cases) {
  const fx = client.normalizePerkEffects(scenario.raw);
  assert.equal(fx.kioskDiscountPct, scenario.kiosk, `${scenario.name} kiosk channel`);
  assert.equal(fx.droneDiscountPct, scenario.drone, `${scenario.name} drone channel`);
  assert.equal(fx.marketDiscountPct, scenario.market, `${scenario.name} market channel`);
  assert.deepEqual(client.normalizePerkEffects(fx), fx, `${scenario.name} normalization is idempotent`);
  assert.equal(client.applyPerkDiscount(100, fx.kioskDiscountPct, fx.marketDiscountPct), scenario.kioskCost,
    `${scenario.name} kiosk quote price`);
  assert.equal(client.applyPerkDiscount(100, fx.droneDiscountPct, fx.marketDiscountPct), scenario.droneCost,
    `${scenario.name} drone quote price`);
  assert.equal(server.applyDiscountedCost(100, fx.kioskDiscountPct, fx.marketDiscountPct), scenario.kioskCost,
    `${scenario.name} kiosk server price parity`);
  assert.equal(server.applyDiscountedCost(100, fx.droneDiscountPct, fx.marketDiscountPct), scenario.droneCost,
    `${scenario.name} drone server price parity`);
}

const merged = client.buildPerkRuntimeBundle(['KIOSK_A', 'SHOP_ALIAS', 'MARKET_ALIAS'], [
  { code: 'KIOSK_A', effects: { kioskDiscountPct: 5 } },
  { code: 'SHOP_ALIAS', effects: { shopDiscountPct: 5 } },
  { code: 'MARKET_ALIAS', effects: { discountPct: 10 } },
]).effects;
assert.equal(merged.kioskDiscountPct, 0.1, 'separate perk aliases add within their channel');
assert.equal(merged.marketDiscountPct, 0.1, 'legacy market alias remains on the market channel');
assert.equal(client.applyPerkDiscount(100, merged.kioskDiscountPct, merged.marketDiscountPct), 80,
  'merged quote applies each channel exactly once');
assert.equal(server.applyDiscountedCost(100, merged.kioskDiscountPct, merged.marketDiscountPct), 80,
  'merged server payment matches the client quote');
assert.equal(client.applyPerkDiscount(100, 0.8, 0.4), 5, 'combined discount retains the 5 percent minimum price');
assert.equal(server.applyDiscountedCost(100, 0.8, 0.4), 5, 'server retains the same minimum price');

const scoped = client.applyPerkBundleToActor({
  hp: 100,
  maxHp: 100,
  stats: {},
  simCredits: 100,
  _gameplayPerks: { procurementPartnerApplied: true },
}, { codes: [], docs: [], effects: client.normalizePerkEffects({}), summary: '' });
assert.equal(scoped._perkRuntime.kioskDiscountPct, 0.05, 'scoped procurement discount remains 5 percent');
assert.equal(client.applyPerkDiscount(100, scoped._perkRuntime.kioskDiscountPct), 95);

const actor = { hp: 100, simCredits: 100, inventory: [] };
const quotedCost = client.applyPerkDiscount(100, merged.kioskDiscountPct, merged.marketDiscountPct);
const receipt = procurement.commitProcurementTransaction({
  actor,
  actionType: 'kioskBuy',
  phaseIdxNow: 1,
  offer: {
    kind: 'buy',
    itemId: 'wood',
    item: { _id: 'wood', name: '나뭇가지', type: 'material', category: 'material', tier: 1 },
    qty: 1,
    cost: quotedCost,
  },
});
assert.equal(receipt.ok, true, 'quoted kiosk order commits through the production payment module');
assert.equal(receipt.paidCost, 80, 'payment charges the quoted amount');
assert.equal(actor.simCredits, 20);

console.log('PASS legacy perk discount normalization, quote/payment parity, and channel regression');
