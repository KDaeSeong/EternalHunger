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

check('definition and runtime value use bounded explicit defaults', () => {
  assert.equal(normalizeUniqueResourceDefinition().maxValue, 100);
  assert.deepEqual(normalizeUniqueResourceDefinition({ enabled: true, name: '  VF  ', maxValue: 20000, startValue: 30000, regenPerSec: 200 }),
    { enabled: true, name: 'VF', maxValue: 10000, startValue: 10000, regenPerSec: 100 });
  const initialized = normalizeRuntimeSurvivor({ _id: 'a', uniqueResource: resource({ startValue: 37 }) });
  assert.equal(initialized.uniqueResourceValue, 37);
  assert.equal(normalizeRuntimeSurvivor({ ...initialized, uniqueResourceValue: 12.5 }).uniqueResourceValue, 12.5);
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
