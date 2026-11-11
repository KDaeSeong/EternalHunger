import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { actor, skill } = await import('./lib/run-combat-scenario.mjs');
const {
  advanceUniqueResource,
  canPaySkillResource,
  gainSkillResource,
  normalizeUniqueResourceDefinition,
  spendSkillResource,
} = await import('../src/app/simulation/_lib/uniqueResourceRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { applyGuestCharacterProfiles } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { findCharacterSkillChoice, finishCharacterCast, reconcileCharacterCasts, startCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { applyPreparedCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { saveGuestCharacterProfile } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { compactCharacterForSave, findCharacterSaveMismatches } = await import('../src/utils/characterPayload.js');
const { buildSimulationRunComparison } = await import('../src/app/simulation/_lib/simulationRunComparisonRuntime.js');
const { REPLAY_SCHEMA } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const resource = (extra = {}) => ({ enabled: true, name: 'VF', maxValue: 100, startValue: 20, regenPerSec: 2, ...extra });
const resourceSkill = (extra = {}) => skill({ range: 5, castDelaySec: 0.1, resourceCost: 5, resourceGain: 10, ...extra });
const caster = (extra = {}) => actor('a', { localProfile: true, uniqueResource: resource(), uniqueResourceValue: 20,
  characterSkills: { q: resourceSkill() }, ...extra });
const enemy = () => actor('b', { _basicAttackReadyAtSec: 999 });

check('normal attack-speed boundaries preserve thirty seconds of resource recovery', () => {
  const run = (fractional) => {
    let row = caster({ uniqueResource: resource({ startValue: 0, regenPerSec: 0.1 }), uniqueResourceValue: 0 });
    const timeline = createPhaseActionTimeline({ durationSec: 30, intervalSec: 1,
      onElapsed: (_, elapsed) => {
        advanceUniqueResource(row, elapsed);
        row = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(row)));
      } });
    if (fractional) for (let i = 1; i <= 90; i += 1) timeline.advanceTo(Math.round(i * 0.333333 * 1e6) / 1e6);
    timeline.advanceTo(30);
    return row;
  };
  const ordinary = run(false), combat = run(true);
  assert.equal(ordinary.uniqueResourceValue, 3);
  assert.equal(combat.uniqueResourceValue, 3);
  assert.equal(canPaySkillResource(combat, { resourceCost: 3 }), true);
});

check('definition and runtime value use bounded explicit defaults', () => {
  assert.equal(normalizeUniqueResourceDefinition().maxValue, 100);
  assert.deepEqual(normalizeUniqueResourceDefinition({ enabled: true, name: '  VF  ', maxValue: 20000, startValue: 30000, regenPerSec: 200 }),
    { enabled: true, name: 'VF', maxValue: 10000, startValue: 10000, regenPerSec: 100 });
  const initialized = normalizeRuntimeSurvivor({ _id: 'a', uniqueResource: resource({ startValue: 37 }) });
  assert.equal(initialized.uniqueResourceValue, 37);
  assert.equal(normalizeRuntimeSurvivor({ ...initialized, uniqueResourceValue: 12.5 }).uniqueResourceValue, 12.5);
});

const slowCaster = (extra = {}) => caster({ uniqueResource: resource({ startValue: 0, regenPerSec: 0.001 }),
  uniqueResourceValue: 0, ...extra });

check('low recovery survives real world ticks, normalization and JSON frame copies', () => {
  let row = slowCaster();
  for (let i = 0; i < 120; i += 1) {
    row = runDetonationTickPhase({ state: { updatedSurvivors: [row], phaseDurationSec: 30,
      startOffsetSec: i * 0.25, endOffsetSec: (i + 1) * 0.25 } }).updatedSurvivors[0];
    row = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(structuredClone(row))));
  }
  assert.equal(row.uniqueResourceValue, 0.03);
  assert.equal(canPaySkillResource(row, { resourceCost: 0.03 }), true);
});

check('paid cost and earned gain preserve accumulated sub-display recovery', () => {
  const row = slowCaster({ uniqueResourceValue: 2 });
  advanceUniqueResource(row, 0.25);
  assert.equal(spendSkillResource(row, { resourceCost: 1 }).after, 1);
  assert.equal(gainSkillResource(row, { resourceGain: 1 }).after, 2);
  advanceUniqueResource(row, 0.75);
  assert.equal(row.uniqueResourceValue, 2.001);
  assert.equal(spendSkillResource(row, { resourceCost: 2.001 }).after, 0);
  advanceUniqueResource(row, 0.25);
  assert.equal(row.uniqueResourceValue, 0);
});

check('capacity discards excess recovery and gain without banking future resource', () => {
  const row = slowCaster({ uniqueResourceValue: 99.999 });
  advanceUniqueResource(row, 0.25);
  gainSkillResource(row, { resourceGain: 1 });
  assert.equal(row.uniqueResourceValue, 100);
  assert.equal(row._uniqueResourceRegen, undefined);
  spendSkillResource(row, { resourceCost: 1 });
  advanceUniqueResource(row, 0.25);
  assert.equal(row.uniqueResourceValue, 99);
  advanceUniqueResource(row, 9999);
  assert.equal(row._uniqueResourceRegen, undefined);
});

check('rounding up cannot leave hidden debt after an affordable full-balance spend', () => {
  const row = slowCaster();
  advanceUniqueResource(row, 0.75);
  assert.equal(row.uniqueResourceValue, 0.001);
  assert.equal(spendSkillResource(row, { resourceCost: 0.001 }).after, 0);
  assert.equal(row._uniqueResourceRegen, undefined);
  advanceUniqueResource(row, 0.25);
  assert.equal(row.uniqueResourceValue, 0);
  const ordinary = slowCaster({ uniqueResourceValue: 2 });
  spendSkillResource(ordinary, { resourceCost: 1 });
  gainSkillResource(ordinary, { resourceGain: 1 });
  assert.equal(ordinary._uniqueResourceRegen, undefined);
});

check('actual frame and replay preparation preserve a balance instead of starting a new life', () => {
  const original = slowCaster({ uniqueResourceValue: 2 });
  advanceUniqueResource(original, 0.25);
  const frame = createSimulationFrame({ day: 0, phase: 'night', matchSec: 0, survivors: [original, enemy()] });
  const input = createSimulationRunInput({ ...frame, activeMap: { _id: 'm', zones: [{ zoneId: 'z' }] } }, null);
  const restored = normalizeRuntimeSurvivor(prepareSimulationRunInput(JSON.parse(JSON.stringify(input))).state.survivors[0]);
  assert.equal(restored.uniqueResourceValue, 2);
  assert.deepEqual(restored._uniqueResourceRegen, original._uniqueResourceRegen);
  advanceUniqueResource(restored, 0.75);
  assert.equal(restored.uniqueResourceValue, 2.001);
  assert.equal(original.uniqueResourceValue, 2);
});

check('disabled, changed, edited and malformed receipts cannot inject recovery', () => {
  const original = slowCaster(); advanceUniqueResource(original, 0.25);
  for (const edit of [
    (row) => { row.uniqueResource.enabled = false; },
    (row) => { row.uniqueResource.name = 'Changed'; },
    (row) => { row.uniqueResourceValue = 1; },
    (row) => { row.uniqueResourceValue = NaN; },
    (row) => { row._uniqueResourceRegen.remainder = Infinity; },
    (row) => { row._uniqueResourceRegen.remainder = 1; },
  ]) {
    let row = structuredClone(original); edit(row); row = normalizeRuntimeSurvivor(row);
    assert.equal(row._uniqueResourceRegen, undefined);
    row.uniqueResource.enabled = true;
    const before = row.uniqueResourceValue;
    advanceUniqueResource(row, 0.25);
    assert.equal(row.uniqueResourceValue, before);
  }
});

check('zero, negative and nonfinite elapsed and rejected costs leave receipts unchanged', () => {
  const row = slowCaster(); advanceUniqueResource(row, 0.25);
  const before = structuredClone(row);
  for (const elapsed of [0, -1, NaN, Infinity]) advanceUniqueResource(row, elapsed);
  spendSkillResource(row, { resourceCost: 1 });
  spendSkillResource(row, { resourceCost: 0 });
  gainSkillResource(row, { resourceGain: 0 });
  assert.deepEqual(row, before);
});

check('legacy saves start without hidden credit and revival preserves the existing balance', () => {
  let legacy = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(slowCaster())));
  advanceUniqueResource(legacy, 0.25);
  legacy = normalizeRevivedSurvivor({ ...legacy, hp: 0 }, 50, 'z', 1, {}, 10);
  advanceUniqueResource(legacy, 0.75);
  assert.equal(legacy.uniqueResourceValue, 0.001);
});

check('new match and reapplied guest definition discard prior runtime recovery', () => {
  const old = slowCaster({ _id: 'guest-survivor-01', guestDefault: true });
  advanceUniqueResource(old, 0.25);
  const fresh = buildInitialSimulationRoster({ charList: [old], initialZoneIds: ['z'] }).candidateChars[0];
  assert.equal(fresh.uniqueResourceValue, 0);
  assert.equal(fresh._uniqueResourceRegen, undefined);
  advanceUniqueResource(fresh, 0.25);
  assert.equal(fresh.uniqueResourceValue, 0);
  const reapplied = applyGuestCharacterProfiles([old], [{ id: old._id, name: old.name, uniqueResource: old.uniqueResource }])[0];
  assert.equal(reapplied._uniqueResourceRegen, undefined);
  advanceUniqueResource(reapplied, 0.25);
  assert.equal(reapplied.uniqueResourceValue, 0);
});

check('cost availability, spending and capped gain mutate only committed runtime state', () => {
  const a = caster();
  assert.equal(canPaySkillResource(a, { resourceCost: 21 }), false);
  assert.deepEqual(spendSkillResource(a, { resourceCost: 21 }).paid, false);
  assert.equal(a.uniqueResourceValue, 20);
  assert.equal(spendSkillResource(a, { resourceCost: 5 }).after, 15);
  assert.equal(gainSkillResource(a, { resourceGain: 200 }).after, 100);
});

check('fractional shared-clock regeneration is capped without overshoot', () => {
  const a = caster({ uniqueResourceValue: 98.5 });
  assert.equal(advanceUniqueResource(a, 0.5).after, 99.5);
  assert.equal(advanceUniqueResource(a, 5).after, 100);
});

check('AI omits an unaffordable skill and admits it once the resource exists', () => {
  const a = caster({ uniqueResourceValue: 4 }); const b = enemy();
  assert.equal(findCharacterSkillChoice(a, [b], [a, b], 100, {}), null);
  a.uniqueResourceValue = 5;
  assert.ok(findCharacterSkillChoice(a, [b], [a, b], 100, {}));
});

check('actual cast start pays once and duplicate start cannot charge twice', () => {
  const a = caster(); const b = enemy(); const events = [];
  const choice = findCharacterSkillChoice(a, [b], [a, b], 100, {});
  assert.equal(startCharacterCast(a, choice, 100, {}, { emitRunEvent: (kind, data) => events.push({ kind, ...data }) }), true);
  assert.equal(a.uniqueResourceValue, 15);
  assert.equal(startCharacterCast(a, choice, 100, {}), false);
  assert.equal(a.uniqueResourceValue, 15);
  assert.deepEqual(events.filter((event) => event.kind === 'unique_resource').map((event) => event.delta), [-5]);
});

check('cancelled cast keeps its paid cost and grants no completion resource', () => {
  const a = caster(); const b = enemy();
  startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {});
  a.hp = 0;
  reconcileCharacterCasts([a, b], 100.05, {});
  assert.equal(a.uniqueResourceValue, 15);
  assert.equal(a._pendingCharacterCast, null);
});

check('successful release grants resource after the start cost without a second charge', () => {
  const a = caster(); const b = enemy(); const events = [];
  const actions = { emitRunEvent: (kind, data) => events.push({ kind, ...data }) };
  startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {}, actions);
  const prepared = finishCharacterCast(a, 100.1, actions);
  const result = applyPreparedCharacterSkill(a, b, prepared, { nowSec: 100.1, settings: {}, emitRunEvent: actions.emitRunEvent });
  assert.equal(result.resourceGain, 10);
  assert.equal(a.uniqueResourceValue, 25);
  assert.deepEqual(events.filter((event) => event.kind === 'unique_resource').map((event) => event.delta), [-5, 10]);
});

check('ordinary world clock regenerates while a defeated rift participant is paused', () => {
  const ordinary = caster({ _id: 'ordinary', uniqueResourceValue: 20 });
  const defeated = caster({ _id: 'defeated', uniqueResourceValue: 20, _combatSpaceId: 'dimension_rift:r1',
    _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 0 },
    _dimensionRiftDefeat: { riftId: 'r1', enteredAtSec: 0 } });
  const result = runDetonationTickPhase({ state: { updatedSurvivors: [ordinary, defeated], phaseDurationSec: 2,
    startOffsetSec: 0, endOffsetSec: 2, tickSec: 1, useDetonation: false, suddenDeathActive: false } });
  const byId = new Map(result.updatedSurvivors.map((row) => [row._id, row]));
  assert.equal(byId.get('ordinary').uniqueResourceValue, 24);
  assert.equal(byId.get('defeated').uniqueResourceValue, 20);
});

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

check('guest definition persists locally and rejects resource skills when the resource is disabled', () => {
  const storage = new MemoryStorage();
  const raw = { id: 'guest-survivor-01', name: '게스트', uniqueResource: resource(),
    characterSkills: { q: resourceSkill() }, characterSkillLevels: { q: 1 }, tacticalSkill: '블링크' };
  const saved = saveGuestCharacterProfile(raw, storage);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.profile.uniqueResource, resource());
  assert.equal(saved.profile.characterSkills.q.resourceCost, 5);
  assert.equal(saveGuestCharacterProfile({ ...raw, uniqueResource: { ...resource(), enabled: false } }, storage).ok, false);
});

check('authenticated save payload round-trips resource definitions and skill amounts', () => {
  const compact = compactCharacterForSave({ _id: '1234567890abcdef12345678', name: 'A', stats: {}, uniqueResource: resource(),
    characterSkills: { q: resourceSkill() } });
  assert.deepEqual(compact.uniqueResource, resource());
  assert.equal(compact.characterSkills.q.resourceCost, 5);
  assert.equal(compact.characterSkills.q.resourceGain, 10);
  assert.deepEqual(findCharacterSaveMismatches([compact], [{ ...compact }]), []);
});

check('run comparison attributes a changed resource definition to its actor', () => {
  const row = (id, startValue) => ({ _id: id, name: id, teamId: 'team:1', zoneId: 'z', hp: 100, maxHp: 100,
    uniqueResource: resource({ startValue }) });
  const record = (id, startValue) => ({ schema: REPLAY_SCHEMA, id, input: { schema: REPLAY_SCHEMA,
    engineVersion: SIMULATION_ENGINE_VERSION, runSeed: 'same', map: { _id: 'm', zones: [{ zoneId: 'z' }] },
    settings: { simulationRuleset: {} }, publicItems: [], kiosks: [], droneOffers: [],
    initialFrame: { day: 0, phase: 'night', matchSec: 0, survivors: [row('a', startValue), row('b', 20)],
      dead: [], killCounts: {}, assistCounts: {} } },
  finalFrame: { matchSec: 1, survivors: [row('a', startValue), row('b', 20)], dead: [] },
  events: [{ kind: 'match_end', outcome: 'last_team' }], random: { state: 1 },
  summary: { ending: { outcome: 'last_team', atSec: 1 } } });
  const comparison = buildSimulationRunComparison(record('before', 10), record('after', 40));
  assert.ok(comparison.actorChanges.some((change) => change.actorId === 'a' && change.key === 'uniqueResource'));
});

check('server persistence and history whitelists carry resource definitions and events', () => {
  const sources = [
    readFileSync(new URL('../../server/models/Characters.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../../server/routes/characters.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8'),
  ];
  assert.match(sources[0], /uniqueResource:/);
  assert.match(sources[1], /'uniqueResource'/);
  assert.match(sources[1], /resourceCost/);
  assert.match(sources[2], /'resourceName'/);
  assert.match(sources[2], /'delta'/);
});

console.log(`UNIQUE_RESOURCE_CHECKS ${checks}/${checks}`);
