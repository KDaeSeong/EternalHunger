import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const cycleUrl = new URL('../src/app/simulation/_lib/simulationPhaseCycleRuntime.js', import.meta.url).href;
const admission = 'updatedSurvivors: statusActors, normalizedSurvivors: true, useDetonation, zoneGraph,';
const worker = process.argv.find(arg => arg.startsWith('--match-worker='))?.split('=')[1];
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

if (worker) {
  assert.ok(['default-entry-control', 'normalized-entry'].includes(worker));
  let transformations = 0;
  if (worker === 'default-entry-control') {
    // A fresh counterfactual of the CURRENT cycle, not an old replay/output.
    // Only the explicit ingress optimization is disabled in memory. All
    // production status, hazards, combat, recipes, event and frame code runs.
    registerHooks({ load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (url !== cycleUrl) return loaded;
      const source = Buffer.from(loaded.source).toString('utf8');
      assert.equal(source.split(admission).length, 2);
      transformations++;
      return { ...loaded, source: source.replace(admission, admission.replace('true', 'false')) };
    } });
  }
  const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const input = await createRandomIsolationInput(seed);
  const started = performance.now();
  const result = await runRandomIsolationMatch(input);
  assert.equal(transformations, worker === 'default-entry-control' ? 1 : 0);
  console.log(JSON.stringify({ worker, transformations, elapsedMs: performance.now() - started,
    outcome: { inputDigest: digest(input), evidence: result.evidence,
      finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) } }));
  process.exit(0);
}

const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { applyActorPhaseStatusTick } = await import('../src/app/simulation/_lib/phaseActorStatusRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { setDeathMetadata } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');
const { runPhaseWorldResolution } = await import('../src/app/simulation/_lib/phaseWorldResolutionRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const ruleset = getRuleset('ER_S11');
let checks = 0, comparisons = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const actor = (id, extra = {}) => ({ _id: id, name: id, zoneId: 'safe', hp: 100, maxHp: 100,
  gadgetEnergy: 0, detonationSec: 20, detonationMaxSec: 30, inventory: [], ...extra });
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function statusActor(row, elapsedSec = 1, startSec = 0) {
  return applyActorPhaseStatusTick({ state: { actor: row, elapsedSec, startSec } }).actor;
}
function tick(rows, normalizedSurvivors, extra = {}) {
  const random = createSeedRng('status-tick:' + seed), logs = [], deaths = [];
  const state = { updatedSurvivors: rows, normalizedSurvivors, ruleset, useDetonation: true,
    phaseDurationSec: 1, tickSec: 1, phaseStartSec: 0, phaseIdxNow: 0,
    forbiddenIds: new Set(), zoneGraph: { safe: ['other'] },
    mapObj: { zones: [{ zoneId: 'safe' }, { zoneId: 'other' }] }, ...extra };
  const result = withSimulationRandom(random, () => runDetonationTickPhase({ state, actions: {
    addLog: (text, type) => logs.push({ text, type }),
    atNow: () => ({ day: 1, phase: 'morning', sec: 1 }),
    setDeathMetadata,
    emitDeathRunEventOnce: (who, meta) => deaths.push({ who: structuredClone(who), meta }),
  } }));
  return { ...result, logs, deaths, random: random.getState() };
}
function compare(rows, extra = {}) {
  const before = structuredClone(rows);
  freeze(rows);
  const control = tick(rows, false, extra);
  const optimized = tick(rows, true, extra);
  assert.deepEqual(optimized, control);
  assert.deepEqual(rows, before, 'Read-only status inputs must not be mutated.');
  comparisons++;
  return optimized;
}

check('the production cycle admits only actual status tick results; world resolution keeps the default path', () => {
  const source = readFileSync(fileURLToPath(cycleUrl), 'utf8');
  assert.equal(source.split(admission).length, 2);
  assert.ok(source.indexOf('const result = applyActorPhaseStatusTick(') < source.indexOf(admission));
  const world = readFileSync(new URL('../src/app/simulation/_lib/phaseWorldResolutionRuntime.js', import.meta.url), 'utf8');
  assert.ok(!world.includes('normalizedSurvivors'));
});
check('actual status producers are value-idempotent at zero, fractional and whole seconds', () => {
  for (const elapsedSec of [0, 0.25, 1, 3]) {
    const row = statusActor(actor('producer', { stats: { attackPower: 37.499, attackSpeed: 1.23456 },
      inventory: [{ itemId: 'hat', qty: '2', tags: ['head'], tier: 3 },
        { itemId: 'empty', qty: 0 }], activeEffects: [{ name: '회복', recovery: 2.5, remainingDuration: 5 }],
      uniqueResource: { enabled: true, name: 'VF', maxValue: 80, regenPerSec: 2.5 },
      uniqueResourceValue: 31.275, _perkRuntime: { poisonImmune: 1, burnResistPct: 0.3 },
      routePlanZoneIds: [' safe ', ''], routePlanRequiredQtyById: { ore: '3' } }), elapsedSec);
    assert.deepEqual(normalizeRuntimeSurvivor(row), row);
    compare([row], { useDetonation: false, phaseDurationSec: elapsedSec });
  }
});
check('shared cooldown and resource clocks use the interval-start effect age', () => {
  const before = actor('clock', { uniqueResource: { enabled: true, maxValue: 100, regenPerSec: 2 },
    uniqueResourceValue: 7, activeEffects: [{ name: 'rate', remainingDuration: 0.5, durationUnit: 'sec', cooldownRateBonus: 1 }],
    cooldowns: { portableSafeZone: 3, cnotGate: 4, weaponSkill: 5 },
    skillState: { q: { cooldownUntil: 10, nested: { marker: 'read-only' } } },
    _weaponSkillNextAbsSec: 10, _tacNextAbsSec: 8 });
  const result = compare([statusActor(before)], { intervalStartActors: freeze([before]), useDetonation: false });
  const row = result.updatedSurvivors[0];
  assert.equal(row.uniqueResourceValue, 9); assert.equal(row.cooldowns.weaponSkill, 3.5);
  assert.equal(row.skillState.q.cooldownUntil, 9.5); assert.equal(row._tacNextAbsSec, 7.5);
});
check('normal and final-night safe recovery preserves independent 30/45-second caps', () => {
  const result = compare([statusActor(actor('normal', { detonationSec: 29.5 })),
    statusActor(actor('final', { detonationFinalNight: true, detonationSec: 44.5, detonationMaxSec: 45 }))]);
  assert.deepEqual(result.updatedSurvivors.map(row => [row.detonationSec, row.detonationMaxSec]), [[30, 30], [45, 45]]);
});
check('forbidden deaths preserve timer, metadata, logs, victim ordering and RNG', () => {
  const rows = [statusActor(actor('one', { detonationSec: 0.5 })),
    statusActor(actor('two', { detonationSec: 0.25 }))];
  const result = compare(rows, { forbiddenIds: new Set(['safe']), canReviveThisMatch: true, reviveCutoffIdx: 2 });
  assert.equal(result.updatedSurvivors.length, 0);
  assert.deepEqual(result.newlyDead.map(row => row._id), ['one', 'two']);
  assert.ok(result.newlyDead.every(row => row.deathReason === 'detonation' && row.reviveEligible));
  assert.equal(result.deaths.length, 2);
});
check('gate selection and portable safety retain actual costs and cooldowns', () => {
  const result = compare([statusActor(actor('gate', { gadgetEnergy: 30, detonationSec: 4 })),
    statusActor(actor('shield', { gadgetEnergy: 40, detonationSec: 4, cooldowns: { cnotGate: 20 } }))],
  { forbiddenIds: new Set(['safe']) });
  assert.equal(result.updatedSurvivors[0].zoneId, 'other');
  assert.equal(result.updatedSurvivors[0].gadgetEnergy, 0);
  assert.equal(result.updatedSurvivors[1].gadgetEnergy, 0);
  assert.equal(result.updatedSurvivors[1].cooldowns.portableSafeZone, 30);
  assert.ok(result.updatedSurvivors[1].safeZoneUntil > 1);
});
check('stasis pauses collars and final-zone damage for only its active interval', () => {
  const before = actor('stasis', { activeEffects: [{ name: '경직', remainingDuration: 0.5, durationUnit: 'sec' }] });
  const status = statusActor(before);
  const collar = compare([status], { forbiddenIds: new Set(['safe']), intervalStartActors: freeze([before]) });
  assert.equal(collar.updatedSurvivors[0].detonationSec, 19.5);
  const pressure = compare([status], { forbiddenIds: new Set(['safe']), intervalStartActors: [before],
    useDetonation: false, suddenDeathActive: true });
  assert.equal(pressure.updatedSurvivors[0].hp, 97.5);
});
check('final-zone pressure death keeps the no-revival rule without a collar', () => {
  const result = compare([statusActor(actor('pressure', { hp: 2 }))],
    { forbiddenIds: new Set(['safe']), useDetonation: false, suddenDeathActive: true });
  assert.equal(result.newlyDead[0].deathReason, 'final_zone_pressure');
  assert.equal(result.newlyDead[0].reviveEligible, false);
});
check('rift actors advance shared clocks without earning field timer regeneration', () => {
  const before = actor('rift', { uniqueResource: { enabled: true, maxValue: 100, regenPerSec: 3 }, uniqueResourceValue: 9 });
  enterDimensionRiftSpace(before, { id: 'r', zoneId: 'safe' }, 0);
  const result = compare([statusActor(before)], { forbiddenIds: new Set(['safe']) });
  assert.equal(result.updatedSurvivors[0].detonationSec, 20);
  assert.equal(result.updatedSurvivors[0].uniqueResourceValue, 12);
});
check('blank IDs are omitted, duplicate IDs keep the last value and first insertion order', () => {
  const rows = [statusActor(actor('same', { hp: 80 })), statusActor(actor(' ')),
    statusActor(actor('other')), statusActor(actor('same', { hp: 27 }))];
  const result = compare(rows);
  assert.deepEqual(result.updatedSurvivors.map(row => [row._id, row.hp]), [['same', 27], ['other', 100]]);
});
check('egress owns mutable output fields while frozen source snapshots remain intact', () => {
  const row = statusActor(actor('owned', { inventory: [{ itemId: 'food', consumeEffect: { heal: { flat: 7 } } }],
    activeEffects: [{ name: 'rate', durationUnit: 'sec', remainingDuration: 20, cooldownRateBonus: 0.2 }],
    skillState: { q: { cooldownUntil: 10 } }, routePlanItemIdsByZone: { safe: ['food'] } }));
  const result = compare([row]), output = result.updatedSurvivors[0], before = structuredClone(row);
  output.stats.attackPower = 999; output.inventory[0].consumeEffect.heal.flat = 999;
  output.activeEffects[0].remainingDuration = 999; output.skillState.q.cooldownUntil = 999;
  output.cooldowns.weaponSkill = 999; output.routePlanItemIdsByZone.safe.push('new');
  assert.deepEqual(row, before);
});
check('next calls re-read edited input instead of retaining actor-identity state', () => {
  const row = actor('edited', { inventory: [{ itemId: 'hat', tags: ['head'], qty: 1, tier: 2 }] });
  const first = compare([statusActor(row)]);
  row.inventory[0].tier = 5; row.uniqueResource = { enabled: true, maxValue: 100, regenPerSec: 4 };
  row.uniqueResourceValue = 11; row.stats = { attackPower: 79.7 }; row.cooldowns = { weaponSkill: 8 };
  const second = compare([statusActor(row)]);
  assert.equal(first.updatedSurvivors[0].inventory[0].tier, 2);
  assert.equal(second.updatedSurvivors[0].inventory[0].tier, 5);
  assert.equal(second.updatedSurvivors[0].uniqueResourceValue, 15);
  assert.equal(second.updatedSurvivors[0].stats.attackPower, 79.7);
});
check('untrusted default and world-resolution callers still normalize invalid legacy stock and stats', () => {
  const row = actor('raw', { inventory: [{ itemId: 'empty', qty: 0 }, { itemId: 'legacy' }],
    stats: { attackPower: -10, attackSpeed: Infinity }, uniqueResourceValue: -1 });
  const base = tick(freeze([row]), false);
  assert.equal(base.updatedSurvivors[0].inventory.length, 1);
  assert.equal(base.updatedSurvivors[0].inventory[0].qty, 1);
  assert.equal(base.updatedSurvivors[0].stats.attackPower, 0);
  assert.deepEqual(tick([row], 'true'), base, 'Only an explicit boolean may opt into the internal contract.');
  const world = runPhaseWorldResolution({ state: { updatedSurvivors: [row], ruleset, useDetonation: true,
    phaseDurationSec: 1, fogLocalSec: null, nextSpawn: { dimensionRifts: [] } } });
  assert.deepEqual(world.updatedSurvivors, base.updatedSurvivors);
});
check('normalized ingress avoids an actual normalization read; egress remains canonical', () => {
  const canonical = statusActor(actor('reads', { inventory: [{ itemId: 'mat', qty: 2 }] }));
  const run = normalized => {
    let reads = 0;
    const row = { ...canonical };
    Object.defineProperty(row, 'stats', { enumerable: true, get: () => { reads++; return canonical.stats; } });
    const result = tick([row], normalized, { useDetonation: false });
    return { reads, result };
  };
  const control = run(false), optimized = run(true);
  assert.deepEqual(optimized.result, control.result);
  assert.equal(control.reads, 3); assert.equal(optimized.reads, 1);
});
check('fresh varied status fixtures match default hazards, logs, deaths and RNG at every boundary', () => {
  for (let index = 0; index < 80; index++) for (const duration of [0, 0.25, 1, 3]) {
    const before = actor('varied:' + index, { hp: index % 9 ? 31.5 : 0, maxHp: 110,
      detonationSec: index % 6 + 0.25, gadgetEnergy: index % 3 * 30,
      detonationFinalNight: index % 2 === 0, stats: { attackSpeed: 1.0005, skillAmp: index * 3.1 },
      inventory: [{ itemId: 'hat', qty: index % 4, tier: index % 6 + 1, tags: ['head'] },
        { itemId: 'food', consumeEffect: { heal: { flat: index } } }],
      uniqueResource: { enabled: index % 2 === 0, regenPerSec: 0.125, maxValue: 80 },
      uniqueResourceValue: index + 0.125,
      activeEffects: [{ name: 'rate', durationUnit: 'sec', remainingDuration: 0.5, cooldownRatePenalty: 0.25 }],
      cooldowns: { weaponSkill: index % 4 }, skillState: { q: { cooldownUntil: index + 2 } } });
    compare([statusActor(before, duration)], { phaseDurationSec: duration, tickSec: 0.25,
      forbiddenIds: new Set(index % 3 ? [] : ['safe']), intervalStartActors: freeze([before]),
      useDetonation: index % 4 !== 0, suddenDeathActive: index % 4 === 0,
      fogLocalSec: index % 5 === 0 ? 0 : null });
  }
});
console.log(JSON.stringify({ pass: true, checks, comparisons,
  scope: 'Current production status/hazard contracts and fresh default-entry differential; no historical result input, browser timing, AI, account or deployment' }));

if (process.argv.includes('--match')) {
  const results = [];
  for (const mode of ['default-entry-control', 'normalized-entry']) {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--match-worker=' + mode, '--seed=' + seed],
      { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'] });
    const result = JSON.parse(output.trim()); results.push(result);
    console.log(JSON.stringify({ completed: mode, ...result }));
  }
  assert.deepEqual(results[1].outcome, results[0].outcome);
  console.log(JSON.stringify({ pass: true, matches: 2, seed, scope: 'Fresh current-source control versus optimized complete 24-actor match: input, every event/frame, final state, ending, logs and RNG; Node harness timings are not browser x32 performance.' }));
}
