import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { normalizeSatiety, applySatietyGain, decayActorSatiety } = await import('../src/app/simulation/_lib/satietyRuntime.js');
const { saveLocalRulesetOverride, readLocalRulesetOverride } = await import('../src/app/simulation/_lib/localSimulationMapRuntime.js');
const { buildRulesetSnapshot, DEFAULT_RULESET_ID } = await import('../src/utils/rulesets.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { createPhaseConsumableRuntime, forceUseConsumableAtIndex } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { normalizeConsumeEffect } = await import('../src/utils/consumeEffectContract.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { emitConsumableRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { describeConsumableReceipt } = await import('../src/app/simulation/_lib/consumableObservationRuntime.js');

// Disposable actors and memory storage only. No prior receipts or match logs are inputs.
let passed = 0;
const failures = [];
const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9,
  `${label}: expected ${expected}, received ${actual}`);
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const actor = (satiety = 70, extra = {}) => ({ _id: 'fractional-satiety-fixture', name: '포만도 검사',
  hp: 100, maxHp: 100, satiety, zoneId: 'fixture-zone', inventory: [], activeEffects: [],
  stats: { maxHp: 100, attackPower: 10, defense: 0 }, ...extra });
function storedRules(decay) {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)) };
  const patch = { consumables: { satietyDecayPerAction: decay } };
  assert.equal(saveLocalRulesetOverride(DEFAULT_RULESET_ID, patch, storage).ok, true);
  const restoredStorage = new Map(JSON.parse(JSON.stringify([...entries])));
  const restored = readLocalRulesetOverride(DEFAULT_RULESET_ID, { getItem: key => restoredStorage.get(key) ?? null });
  assert.deepEqual(restored, patch, 'stored patch survives a fresh storage reader');
  const ruleset = buildRulesetSnapshot(DEFAULT_RULESET_ID, restored);
  assert.equal(ruleset.consumables.satietyDecayPerAction, decay);
  return ruleset;
}

for (const rate of [0.25, 0.1, 0.75]) {
  await check(`stored rules ${rate}: 100 real decays equal the total amount`, () => {
    const ruleset = storedRules(rate);
    const who = actor(100), total = actor(100);
    let reported = 0;
    for (let index = 0; index < 100; index++) reported += decayActorSatiety(who, ruleset.consumables.satietyDecayPerAction);
    decayActorSatiety(total, rate * 100);
    near(who.satiety, 100 - rate * 100, '100-action remaining satiety');
    near(who.satiety, total.satiety, 'partition-independent decay');
    near(reported, rate * 100, 'reported total loss');
  });
}

await check('normalization preserves finite fractional values and the existing bounds/default coercions', () => {
  for (const value of [0.1, 34.75, 70.25, 99.99]) near(normalizeSatiety(value), value, 'fractional normalization');
  for (const [value, expected] of [[-1, 0], [101, 100], [undefined, 70], [NaN, 70], [Infinity, 70], [-Infinity, 70], ['bad', 70], [null, 0], ['', 0], ['34.75', 34.75]]) {
    near(normalizeSatiety(value), expected, `normalization ${String(value)}`);
  }
});

await check('default loss 1 remains exact through 100 actions and clamps at zero', () => {
  const who = actor(100); let total = 0;
  const ruleset = buildRulesetSnapshot(DEFAULT_RULESET_ID);
  assert.equal(ruleset.consumables.satietyDecayPerAction, 1);
  for (let index = 0; index < 100; index++) {
    total += decayActorSatiety(who, ruleset.consumables.satietyDecayPerAction);
    assert.equal(who.satiety, 99 - index);
  }
  assert.equal(total, 100); assert.equal(decayActorSatiety(who, 1), 0); assert.equal(who.satiety, 0);
  const clipped = actor(120); assert.equal(decayActorSatiety(clipped, 1), 1); assert.equal(clipped.satiety, 99);
  const below = actor(-20); assert.equal(decayActorSatiety(below, 1), 0); assert.equal(below.satiety, 0);
});

await check('JSON restore and survivor normalization preserve fractional residuals between real decays', () => {
  const ruleset = storedRules(0.1); let who = actor(70.25);
  for (let index = 0; index < 50; index++) decayActorSatiety(who, ruleset.consumables.satietyDecayPerAction);
  who = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(who)));
  near(who.satiety, 65.25, 'restored survivor');
  for (let index = 0; index < 50; index++) decayActorSatiety(who, ruleset.consumables.satietyDecayPerAction);
  near(who.satiety, 60.25, 'continued saved actor');
});

await check('gain requests retain integer rounding while zero gain preserves fractional residuals', () => {
  for (const amount of [0, 0.4, -1, undefined, NaN, 'bad', Infinity, -Infinity]) {
    const who = actor(70.25); assert.equal(applySatietyGain(who, amount), 0); near(who.satiety, 70.25, `zero/invalid gain ${String(amount)}`);
  }
  const who = actor(70.25); near(applySatietyGain(who, 0.6), 1, 'rounded positive gain'); near(who.satiety, 71.25, 'residual after integer gain');
  const full = actor(99.75); near(applySatietyGain(full, 3), 0.25, 'actual capped gain'); assert.equal(full.satiety, 100);
  for (const value of [0.25, NaN, Infinity, -1]) assert.equal(normalizeConsumeEffect({ version: 1, satiety: value }).ok, false, 'authored food satiety still requires a valid integer');
  assert.equal(normalizeConsumeEffect({ version: 1, satiety: 10 }).ok, true);
});

await check('invalid/nonfinite decay retains the existing no-loss behavior', () => {
  for (const amount of [undefined, null, 0, -1, NaN, 'bad', Infinity, -Infinity]) {
    const who = actor(70.25); assert.equal(decayActorSatiety(who, amount), 0); near(who.satiety, 70.25, `invalid decay ${String(amount)}`);
  }
  assert.equal(decayActorSatiety(null, 1), 0); assert.equal(applySatietyGain(null, 1), 0);
});

const food = (satiety = 10, extra = {}) => ({ itemId: 'fresh-fractional-food', name: '포만도 검사 음식', type: '소모품', qty: 2,
  consumeEffect: { version: 1, satiety }, ...extra });
await check('automatic food uses the actual fractional threshold and preserves inventory above it', () => {
  for (const value of [35, 35.25, 34.75]) {
    const who = actor(value, { inventory: [food()] });
    const before = structuredClone(who);
    const runtime = createPhaseConsumableRuntime({ phaseIdxNow: 1, consCfg: { aiUseSatietyBelow: 35, maxUsesPerPhase: 1 } });
    const used = runtime.tryUseConsumable(who, 'turn_start');
    assert.equal(used, value < 35, `strict threshold at ${value}`);
    if (used) { near(who.satiety, value + 10, 'food gain'); assert.equal(who.inventory[0].qty, 1); assert.equal(runtime.tryUseConsumable(who, 'turn_start'), false); }
    else assert.deepEqual(who, before);
  }
});

await check('real healing consumable with zero food gain preserves a fractional residual', () => {
  const who = actor(70.25, { hp: 75, inventory: [food(0, { consumeEffect: { version: 1, heal: 10, satiety: 0 } })] });
  assert.equal(forceUseConsumableAtIndex(who, 0).used, true);
  assert.equal(who.hp, 85); near(who.satiety, 70.25, 'zero-food-gain consumption'); assert.equal(who.inventory[0].qty, 1);
});

for (const rate of [0.25, 0.1]) {
  await check(`actual short phase action loop carries restored decay ${rate}`, async () => {
    const ruleset = storedRules(rate); ruleset.consumables = { ...ruleset.consumables, enabled: false };
    const who = normalizeRuntimeSurvivor(actor());
    let clock = 0, frames = 0;
    const result = await runPvpActionLoop({ state: { ruleset, phaseDurationSec: 5, tickSec: 1,
      currentActionSec: () => clock, getPhaseRuntimeOffsetSec: () => clock,
      updatedSurvivors: [who], phaseSurvivors: [who], mapObj: { zones: [{ zoneId: 'fixture-zone' }] },
      itemMetaById: {}, itemNameById: {}, craftables: [], publicItems: [] },
      actions: { reserveActionSecond: seconds => { clock += seconds; }, publishActionFrame: async () => { frames++; } } });
    assert.equal(clock, 5, 'bounded real loop reaches the requested short phase boundary');
    assert.ok(frames >= 5, 'real loop publishes action boundaries');
    near(result.survivorMap.get(who._id).satiety, 70 - rate * 4, 'four actual decision actions retain the stored fractional decay');
  });
}

await check('actual capped food gain keeps raw event precision and formats both user displays', () => {
  const who = actor(99.9, { inventory: [food(10)] });
  const events = [], logs = [];
  const result = forceUseConsumableAtIndex(who, 0, {
    emitConsumableRunEvent: (...args) => emitConsumableRunEvent((kind, data) => events.push({ kind, ...data }), ...args),
    addLog: (text, type) => logs.push({ text, type }),
  });
  assert.equal(result.used, true);
  assert.equal(who.satiety, 100);
  assert.equal(who.inventory[0].qty, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'use');
  const actualGain = 100 - 99.9;
  assert.notEqual(actualGain, 0.1, 'fixture genuinely exposes binary fractional precision');
  assert.equal(result.satiety, actualGain, 'actual consumption result retains its mathematical gain');
  assert.equal(events[0].satiety, actualGain, 'actual public emitter retains unrounded numeric gain');
  const restoredEvent = JSON.parse(JSON.stringify(events[0]));
  assert.equal(restoredEvent.satiety, actualGain, 'JSON event transport preserves raw numeric gain');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].type, 'highlight');
  const receipt = describeConsumableReceipt(restoredEvent);
  assert.deepEqual([logs[0].text, receipt].map(text => text.match(/포만감 \+([0-9.eE+-]+)/)?.[1]),
    ['0.1', '0.1'], 'both user-facing gain tokens must hide the binary fractional tail');
});

console.log(`RESULT ${passed}/${passed + failures.length} passed; ${failures.length} failed; memory-only fresh fixtures; actual short phase driver exercised`);
if (failures.length) process.exitCode = 1;
