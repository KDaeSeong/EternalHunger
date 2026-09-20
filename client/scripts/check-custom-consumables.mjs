// HF6 consumable acceptance checks, included in the guest-farming release gate.
// Uses disposable state,
// actual schema/runtime functions, and no account/database/browser writes.
import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const Item = require('../../server/models/Item.js');
const { inferItemCategory, addItemToInventory, invQty, canReceiveItem, normalizeInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { applyItemEffect } = await import('../src/utils/itemLogic.js');
const { createPhaseConsumableRuntime, forceUseConsumableAtIndex } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { makeStatusValueEffect, getShieldValue, getRegenValue, getEffectiveStats, updateEffects } = await import('../src/utils/statusLogic.js');
const { emitConsumableRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { describeConsumableReceipt } = await import('../src/app/simulation/_lib/consumableObservationRuntime.js');

const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, consumable: 6, equipment: 1 }, autoDropLowValue: false } };
const medicine = (extra = {}) => ({ _id: '111111111111111111111111', itemId: '111111111111111111111111',
  name: '맞춤 회복약', type: '소모품', qty: 2, tier: 1, consumeEffect: { version: 1, heal: 25, satiety: 0 }, ...extra });
const actor = (extra = {}) => ({ _id: 'hf6-consumable', name: '소모품 표본', hp: 20, maxHp: 100, satiety: 70,
  stats: { attackPower: 10, defense: 0, maxHp: 100 }, activeEffects: [], inventory: [], ...extra });
const auto = (who, extra = {}) => createPhaseConsumableRuntime({ phaseIdxNow: 0, ...extra }).tryUseConsumable(who, 'turn');
let passed = 0, failed = 0;
async function check(label, run) {
  try { await run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.error(`FAIL ${label}: ${error.message}`); }
}

await check('explicit authored effects survive schema conversion and JSON restore', () => {
  const item = medicine();
  const document = new Item(item);
  assert.equal(document.validateSync(), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(document)).consumeEffect, item.consumeEffect);
});
await check('schema refuses unknown or malformed explicit effects instead of silently erasing them', () => {
  for (const consumeEffect of [{ version: 2, heal: 25 }, { version: 1, heal: -1 }, { version: 1, heal: 'bad' },
    { version: 1, heal: 25, unknownEffect: 1 }, { version: 1, shield: 20, durationSec: -1 }]) {
    assert.ok(new Item(medicine({ consumeEffect })).validateSync(), JSON.stringify(consumeEffect));
  }
});
await check('explicit Korean consumable classification wins over incidental weapon words', () => {
  for (const name of ['맞춤 회복약', '검술 비약', '창의 가호', '특제 붕대']) {
    assert.equal(inferItemCategory(medicine({ name })), 'consumable', name);
  }
});
await check('receiving and stacking retain independent authored effect data', () => {
  const item = medicine();
  const bag = addItemToInventory([], item, item._id, 1, 1, rules);
  assert.deepEqual(bag[0].consumeEffect, item.consumeEffect);
  assert.notEqual(bag[0].consumeEffect, item.consumeEffect);
  const stacked = addItemToInventory(bag, item, item._id, 1, 1, rules);
  assert.equal(invQty(stacked, item._id), 2);
  assert.deepEqual(JSON.parse(JSON.stringify(stacked))[0].consumeEffect, item.consumeEffect);
});
await check('explicit healing is independent of item name and does not invent food effects', () => {
  for (const name of ['맞춤 회복약', '사과', '셀레네의 눈물']) {
    const effect = applyItemEffect(actor(), medicine({ name }));
    assert.equal(effect.recovery, 25, name);
    assert.equal(effect.satiety, 0, name);
    assert.equal(effect.newEffects.length, 0, name);
    assert.ok(!effect.permanentBoost, name);
  }
});
await check('actual use heals only missing HP, consumes one, and reports the applied amount', () => {
  const who = actor({ hp: 90, inventory: [medicine()] });
  const events = [];
  const result = forceUseConsumableAtIndex(who, 0, { emitConsumableRunEvent: (...args) => events.push(args) });
  assert.equal(result.used, true);
  assert.equal(who.hp, 100);
  assert.equal(who.satiety, 70);
  assert.equal(who.inventory[0].qty, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0][2].heal, 10);
  assert.equal(events[0][2].satiety, 0);
});
await check('unsupported or invalid explicit payloads cannot fall back to food or consume stock', () => {
  for (const consumeEffect of [{ version: 1, heal: 0, satiety: 0 }, { version: 2, heal: 25 },
    { version: 1, heal: -10 }, { version: 1, unknownEffect: 25 }, { version: 1, heal: 25, unknownEffect: 1 }]) {
    const who = actor({ inventory: [medicine({ name: '맞춤 음식', type: 'food', tags: ['food'], consumeEffect })] });
    const before = structuredClone(who);
    assert.equal(forceUseConsumableAtIndex(who, 0).used, false, JSON.stringify(consumeEffect));
    assert.deepEqual(who, before);
  }
});
for (const [label, extra] of [['dead', { hp: 0 }], ['invalid HP', { hp: NaN }],
  ...[0, -1, 0.5, NaN].map(qty => [`stock ${String(qty)}`, { inventory: [medicine({ type: 'food', tags: ['food'], qty })] }])]) {
  await check(`${label} cannot heal or lose inventory`, () => {
    const who = actor({ inventory: [medicine({ type: 'food', tags: ['food'] })], ...extra });
    const before = structuredClone(who);
    assert.equal(forceUseConsumableAtIndex(who, 0).used, false);
    assert.deepEqual(who, before);
  });
}
await check('fractional inventory indexes do not select or consume an item', () => {
  const who = actor({ inventory: [medicine(), medicine({ _id: 'second', itemId: 'second' })] });
  const before = structuredClone(who);
  assert.equal(forceUseConsumableAtIndex(who, 0.5).used, false);
  assert.deepEqual(who, before);
});
await check('automatic use finds useful explicit medicine without a food tag', () => {
  const who = actor({ inventory: [medicine()] });
  assert.equal(auto(who), true);
  assert.equal(who.hp, 45);
  assert.equal(who.inventory[0].qty, 1);
});
await check('automatic use skips ineffective entries and preserves their stock', () => {
  const unknown = medicine({ _id: 'unknown', itemId: 'unknown', name: '효과 없는 음식', type: 'food',
    consumeEffect: { version: 1, heal: 0, satiety: 0 } });
  const who = actor({ inventory: [unknown, medicine()] });
  assert.equal(auto(who), true);
  assert.equal(who.hp, 45);
  assert.equal(who.inventory[0].qty, 2);
  assert.equal(who.inventory[1].qty, 1);
});
await check('full HP and satiety do not waste a healing-only item', () => {
  const who = actor({ hp: 100, satiety: 100, inventory: [medicine({ type: 'food', tags: ['food'] })] });
  const before = structuredClone(who);
  assert.equal(forceUseConsumableAtIndex(who, 0).used, false);
  assert.deepEqual(who, before);
});
await check('same-phase and JSON-restored automatic retries cannot consume twice', () => {
  const who = actor({ inventory: [medicine()] });
  assert.equal(auto(who), true);
  const restored = JSON.parse(JSON.stringify(who));
  assert.equal(auto(restored), false);
  assert.equal(restored.hp, 45);
  assert.equal(restored.inventory[0].qty, 1);
  assert.equal(auto(restored, { phaseIdxNow: 1 }), true);
  assert.equal(restored.hp, 70);
  assert.equal(restored.inventory.length, 0);
});
await check('a status that forbids voluntary actions blocks consumption without mutation', () => {
  for (const name of ['기절', '수면', '경직', '제압', '공포', '매혹']) {
    const who = actor({ activeEffects: [makeStatusValueEffect(name, 3, `consumable:${name}`)],
      inventory: [medicine({ type: 'food', tags: ['food'] })] });
    const before = structuredClone(who);
    assert.equal(forceUseConsumableAtIndex(who, 0).used, false, name);
    assert.deepEqual(who, before, name);
  }
});
await check('explicit shield, regeneration and temporary stats use real timed effects', () => {
  const who = actor({ inventory: [medicine({ consumeEffect: { version: 1, shield: 20, regen: 2,
    durationSec: 3, stats: { attackPower: 5 } } })] });
  assert.equal(forceUseConsumableAtIndex(who, 0).used, true);
  assert.equal(getShieldValue(who), 20);
  assert.equal(getRegenValue(who), 2);
  assert.equal(getEffectiveStats(who).attackPower, 15);
  assert.equal(who.stats.attackPower, 10);
});
await check('legacy food with no explicit contract keeps its existing effect', () => {
  const effect = applyItemEffect(actor(), { name: '사과', type: 'food', tags: ['food'] });
  assert.equal(effect.recovery, 16);
  assert.equal(effect.satiety, 24);
  assert.equal(effect.newEffects.length, 2);
});

await check('different authored doses cannot silently merge or overwrite existing stock', () => {
  const first = medicine(), changed = medicine({ consumeEffect: { version: 1, heal: 55 } });
  const bag = addItemToInventory([], first, first._id, 1, 1, rules);
  const before = JSON.stringify(bag);
  assert.equal(canReceiveItem(bag, changed, changed._id, 1, rules), false);
  const result = addItemToInventory(bag, changed, changed._id, 1, 1, rules);
  assert.equal(result._lastAdd.acceptedQty, 0);
  assert.equal(JSON.stringify(result), before);
  const normalized = normalizeInventory([first, changed], rules);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].consumeEffect.heal, 25);
  assert.equal(normalized[1].consumeEffect.heal, 55);
  normalized[0].consumeEffect.heal = 999;
  assert.equal(first.consumeEffect.heal, 25);
});
await check('actual timed effects survive JSON and expire at fractional seconds without permanent stats', () => {
  const who = actor({ inventory: [medicine({ consumeEffect: { shield: 20, regen: 2, durationSec: 3.5, stats: { attackPower: 5 } } })] });
  assert.equal(forceUseConsumableAtIndex(who, 0).used, true);
  assert.ok(who.activeEffects.every(row => row.remainingDuration === 3.5));
  const restored = JSON.parse(JSON.stringify(who));
  const during = updateEffects(restored, { elapsedSec: 3 });
  assert.equal(getEffectiveStats(during).attackPower, 15);
  assert.equal(during.hp, 26);
  const after = updateEffects(during, { elapsedSec: 0.5 });
  assert.equal(after.hp, 27);
  assert.equal(getShieldValue(after), 0);
  assert.equal(getRegenValue(after), 0);
  assert.equal(getEffectiveStats(after).attackPower, 10);
  assert.equal(restored.hp, 20);
});
await check('combat preparation uses shields only at encounter and never replaces a stronger shield', () => {
  const who = actor({ hp: 100, inventory: [medicine({ consumeEffect: { shield: 20, durationSec: 3 } })] });
  const runtime = createPhaseConsumableRuntime({ phaseIdxNow: 0 });
  const before = structuredClone(who);
  assert.equal(runtime.tryUseConsumable(who, 'turn_start'), false);
  assert.deepEqual(who, before);
  assert.equal(runtime.tryUseConsumable(who, 'before_battle'), true);
  assert.equal(getShieldValue(who), 20);
  const second = createPhaseConsumableRuntime({ phaseIdxNow: 1 });
  const strong = structuredClone(who);
  who.inventory[0].consumeEffect.shield = 10;
  assert.equal(second.tryUseConsumable(who, 'before_battle'), false);
  assert.equal(getShieldValue(who), getShieldValue(strong));
  assert.equal(who.inventory[0].qty, 1);
});
await check('failed callbacks cannot roll back committed stock or duplicate automatic use', () => {
  const who = actor({ inventory: [medicine()] });
  assert.throws(() => auto(who, { emitConsumableRunEvent: () => { throw Error('observer unavailable'); } }));
  assert.equal(who.hp, 45);
  assert.equal(who.inventory[0].qty, 1);
  assert.equal(auto(who), false);
});
await check('fully immune timed-only dose is not consumed', () => {
  const who = actor({ statusImmunities: ['보호막'], inventory: [medicine({ consumeEffect: { shield: 20, durationSec: 3 } })] });
  const before = structuredClone(who);
  assert.equal(forceUseConsumableAtIndex(who, 0).used, false);
  assert.deepEqual(who, before);
});
await check('actual consumption receipts survive client/server compaction and explain applied effects', () => {
  const events = [], who = actor({ inventory: [medicine({ consumeEffect: { heal: 25, shield: 20, durationSec: 3 } })] });
  forceUseConsumableAtIndex(who, 0, { emitConsumableRunEvent: (...args) => emitConsumableRunEvent((kind, data) => events.push({ kind, ...data }), ...args) });
  const server = readFileSync(new URL('../../server/routes/game.js', import.meta.url), 'utf8');
  const compact = runInNewContext(`${server.slice(server.indexOf('function compactRunEventsForStorage('), server.indexOf('function buildRunSummary('))}; compactRunEventsForStorage`);
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  const client = finish.slice(finish.indexOf('const compactRunEvents ='), finish.indexOf("await apiPost('/game/end'"));
  const submitted = runInNewContext(`${client}; compactRunEvents`, { runEvents: events });
  const [restored] = JSON.parse(JSON.stringify(compact(submitted)));
  assert.equal(restored.heal, 25);
  assert.equal(restored.remainingQty, 1);
  assert.equal(restored.effects[0].shield, 20);
  assert.match(describeConsumableReceipt(restored), /보호막 20 \(3초\)/);
  assert.match(describeConsumableReceipt(restored), /남은 수량 1개/);
});

console.log(`CUSTOM_CONSUMABLE_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
