import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { buildFormationExposure } = await import('./lib/strategy-comparison-contracts.mjs');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { createMapActionRuntime } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { withdrawFromDimensionRift } = await import('../src/app/simulation/_lib/dimensionRiftWithdrawalRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const clone = value => structuredClone(value);
const row = (id, teamId, extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId, zoneId: 'zone',
  _spatial: { zoneId: 'zone', x: 4, y: 4 }, hp: 1000, maxHp: 1000, inventory: [],
  power: 100, stats: { maxHp: 1000, attackPower: 20, defense: 10, attackRange: 1.5,
    sightRange: 24, moveSpeed: 3.5, attackSpeed: 1 }, tacticalSkill: 'none', _tacNextAbsSec: 9999, ...extra });
const fresh = () => [row('changed-a', 'a'), row('buddy-a', 'a'), row('enemy-b', 'b'), row('changed-b', 'b')];
function otherFormation(rows) {
  const out = clone(rows), first = out.find(actor => actor._id === 'changed-a'), second = out.find(actor => actor._id === 'changed-b');
  [first.teamId, second.teamId] = [second.teamId, first.teamId];
  for (const actor of out) actor.teamName = actor.teamId;
  return out;
}
const sourceRules = getRuleset('ER_S11');
function run(rows, { randomValue = 0, actionType = 'exchange', actorId = 'changed-a', criticalFlee = false } = {}) {
  // Own both input rosters before any production runtime emission or mutation.
  const initial = clone(rows), comparison = otherFormation(initial), events = [], observations = [];
  const survivorMap = new Map(rows.map(actor => [actor._id, actor]));
  const actor = survivorMap.get(actorId), target = rows.find(other => other.teamId !== actor.teamId);
  const ruleset = { ...sourceRules, ai: { ...sourceRules.ai, escapeHpBelow: 0, chaseBaseChance: 0 },
    pvp: { ...sourceRules.pvp, criticalFleeHpBelow: criticalFlee ? 100 : 0, criticalFleeChance: criticalFlee ? 1 : 0,
      earlyLethalFinishMax: 0, postBattleMoveChance: 0, restHealMax: 0, postBattleRestExtraHealMax: 0 } };
  const actions = { atNow: () => ({ day: 3, phase: 'morning', sec: 100 }),
    emitRunEvent: (kind, payload, at) => events.push(clone({ ...payload, kind, at })),
    observeCombatRuntime: snapshot => observations.push(clone(snapshot)) };
  const state = { actor, target, actionType, survivorMap, newDeadIds: [], roundKills: {}, roundAssists: {},
    phaseSurvivors: rows, todaysSurvivors: [...rows], currentActionSec: () => 100, phaseIdxNow: 4, nextDay: 3,
    estimatePower: current => current.power || 100, ruleset, publicItems: [], craftables: [], assistWindowPhases: 2,
    zoneGraph: { zone: ['safe'], safe: ['zone'] }, totalZonesCount: 10, forbiddenIds: new Set() };
  const original = Math.random; Math.random = () => randomValue;
  let result;
  try { result = runPhaseCombatEncounter({ state, actions }); } finally { Math.random = original; }
  return { initial, comparison, events, observations, survivorMap, result };
}
const exposure = (runtime, ids = ['changed-a']) => buildFormationExposure(runtime.events, runtime.initial, ids, runtime.comparison);
const watched = runtime => exposure(runtime).participants[0];
function hyperloopEvents(actorId) {
  let survivors = fresh(); const events = [];
  const runtime = createMapActionRuntime({ state: { activeMapId: 'main', activeMapName: 'main', day: 3,
    hyperloopPadZoneId: 'zone', survivors, maps: [{ _id: 'remote', name: 'remote', zones: [{ zoneId: 'zone' }] }] },
    actions: { setSurvivors: update => { survivors = update(survivors); },
      emitRunEvent: (kind, payload) => events.push(clone({ ...payload, kind, at: { sec: 100 } })) } });
  runtime.doHyperloopJump('remote', actorId);
  assert.equal(survivors.find(actor => actor._id === actorId).mapId, 'remote');
  assert.equal(events.length, 1); assert.equal(events[0].whoId, actorId);
  return events;
}
function spaceEvents(actorId) {
  const actor = fresh().find(current => current._id === actorId), rift = { id: 'controlled', zoneId: 'zone' }, events = [];
  const enter = enterDimensionRiftSpace(actor, rift, 100); assert.ok(enter);
  // The phase runtime wraps the authoritative enter receipt in this event kind.
  events.push({ ...enter, kind: 'dimension_rift_space', at: { sec: 100 } });
  const leave = withdrawFromDimensionRift(actor, 100, { actions: { atNow: () => ({ sec: 100 }),
    emitRunEvent: (kind, payload, at) => events.push(clone({ ...payload, kind, at })) } });
  assert.ok(leave); assert.equal(actor._combatSpaceId, 'world'); return events;
}
function atEngagementBoundary(runtime, inserted) {
  assert.equal(runtime.events[0].kind, 'team_engagement');
  // Explicit contract-stream composition, not a claim that the UI transport can
  // interrupt a synchronous round. Every attack remains a production emission.
  return { ...runtime, events: [runtime.events[0], ...inserted, ...runtime.events.slice(1)] };
}
const compactEvents = runtime => runtime.events.filter(event => ['team_engagement', 'damage', 'team_strike', 'move', 'death', 'chase', 'team_cover'].includes(event.kind))
  .slice(0, 30).map(event => ({ kind: event.kind, who: event.who, targetId: event.targetId, teams: event.teams,
    participants: event.participants, hpBefore: event.hpBefore, hpAfter: event.hpAfter, hpDamage: event.hpDamage,
    damage: event.damage, from: event.from, to: event.to, zoneId: event.zoneId, outcome: event.outcome, reason: event.reason }));
let checks = 0; const failures = [];
function check(name, runCheck) { try { runCheck(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.message).slice(0, 1200) }); console.error('FAIL ' + name + ': ' + String(error.message).slice(0, 1200)); } }

check('both actual formations expose both changed actors through committed runtime HP strikes', () => {
  const initial = fresh(), baseline = run(clone(initial)), candidate = run(otherFormation(initial));
  for (const runtime of [baseline, candidate]) {
    const out = exposure(runtime, ['changed-a', 'changed-b']);
    assert.equal(out.ready, true);
    for (const actor of out.participants) {
      assert.ok(actor.committedHits > 0); assert.equal(actor.invalidHpHits, 0); assert.ok(actor.teamActions > 0);
      assert.ok(actor.diagnostics.outgoingHpHits > 0);
    }
    assert.ok(runtime.observations.some(snapshot => snapshot.stage === 'team_queue'));
    assert.ok(runtime.events.some(event => event.kind === 'team_strike' && event.damage > 0));
    assert.ok(runtime.events.some(event => event.kind === 'damage' && event.hpBefore - event.hpAfter === event.hpDamage && event.hpDamage > 0));
  }
});

check('incoming real HP damage alone is not the watched actors changed-teammate action', () => {
  const rows = fresh(); rows[0].hp = 500;
  const runtime = run(rows, { actorId: 'enemy-b', actionType: 'basic' }), actor = watched(runtime);
  assert.ok(actor.diagnostics.incomingHpHits > 0); assert.equal(actor.diagnostics.outgoingHpHits, 0);
  assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
});

check('a teammate killed earlier in the actual round cannot qualify a later stale-roster strike', () => {
  const rows = fresh(); rows[1].hp = 1;
  const runtime = run(rows, { randomValue: 0.99 }), actor = watched(runtime);
  const deathDamage = runtime.events.findIndex(event => event.kind === 'damage' && event.targetId === 'buddy-a' && event.hpAfter === 0);
  const strike = runtime.events.findIndex(event => event.kind === 'team_strike' && event.who === 'changed-a' && event.damage > 0);
  assert.ok(deathDamage >= 0 && strike > deathDamage);
  assert.ok(actor.diagnostics.outgoingHpHits > 0); assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
  assert.ok(actor.diagnostics.rejectedStrikes.changed_teammates_unavailable > 0);
});

check('a teammate who actually flees mid-round cannot qualify a later stale-roster strike', () => {
  const rows = fresh(); rows[0].hp = 500; rows[0].maxHp = 2000; rows[1].hp = 50;
  const runtime = run(rows, { randomValue: 0.99, criticalFlee: true }), actor = watched(runtime);
  const departure = runtime.events.findIndex(event => event.kind === 'move' && event.who === 'buddy-a' && event.from !== event.to);
  const strike = runtime.events.findIndex(event => event.kind === 'team_strike' && event.who === 'changed-a' && event.damage > 0);
  assert.ok(departure >= 0 && strike > departure, 'The production flee path must move the changed teammate before the watched real strike.');
  assert.notEqual(runtime.survivorMap.get('buddy-a').zoneId, runtime.survivorMap.get('changed-a').zoneId);
  assert.ok(actor.diagnostics.outgoingHpHits > 0);
  if (actor.teamActions !== 0) console.error('LIVE_EXPOSURE_COUNTEREXAMPLE ' + JSON.stringify({
    engineVersion: SIMULATION_ENGINE_VERSION, initial: runtime.initial.map(current => ({ id: current._id, teamId: current.teamId, hp: current.hp, maxHp: current.maxHp })),
    departureIndex: departure, watchedStrikeIndex: strike, exposure: actor, events: compactEvents(runtime) }));
  assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
});

check('a different-space teammate is excluded by the actual runtime queue and cannot establish exposure', () => {
  const rows = fresh(); rows[1]._combatSpaceId = 'dimension_rift:isolated';
  const runtime = run(rows), actor = watched(runtime);
  const engagement = runtime.events.find(event => event.kind === 'team_engagement');
  assert.ok(engagement); assert.ok(!engagement.teams.flat().includes('buddy-a'));
  assert.ok(actor.diagnostics.outgoingHpHits > 0); assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
});

check('inconsistent initial team identity cannot turn actual runtime events into valid formation evidence', () => {
  const runtime = run(fresh()), inconsistent = clone(runtime.initial);
  inconsistent.find(actor => actor._id === 'buddy-a').teamId = 'b';
  const out = buildFormationExposure(runtime.events, inconsistent, ['changed-a'], otherFormation(inconsistent));
  assert.equal(out.ready, false); assert.equal(out.participants[0].teamActions, 0);
});

check('valid lethal HP commits are not invalidated by their own target death before strike publication', () => {
  const rows = fresh(); rows[2].hp = 1; rows[3].hp = 1;
  const runtime = run(rows), actor = watched(runtime);
  assert.ok(runtime.events.some(event => event.kind === 'damage' && event.who === 'changed-a' && event.hpAfter === 0));
  assert.equal(actor.ready, true); assert.ok(actor.teamActions > 0);
});

check('a real hit that causes target critical flee remains valid for its live attacking team', () => {
  const rows = fresh(); rows[0].hp = 500; rows[0].maxHp = 2000; rows[1].hp = 50;
  const runtime = run(rows, { randomValue: 0.99, criticalFlee: true });
  const actor = exposure(runtime, ['changed-b']).participants[0];
  assert.ok(runtime.events.some(event => event.kind === 'move' && event.who === 'buddy-a'));
  assert.equal(actor.ready, true); assert.ok(actor.teamActions > 0);
});

check('actual cross-map and combat-space transition receipts invalidate stale teammate presence even after return', () => {
  for (const transitions of [hyperloopEvents('buddy-a'), spaceEvents('buddy-a')]) {
    const runtime = atEngagementBoundary(run(fresh()), transitions), actor = watched(runtime);
    assert.ok(actor.diagnostics.outgoingHpHits > 0); assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
    const freshRound = run(fresh());
    const renewed = { ...runtime, events: [...runtime.events, ...freshRound.events] };
    assert.equal(watched(renewed).ready, true, 'Only a fresh production engagement can restore presence evidence.');
  }
});

check('schema boundaries preserve same-zone and spatial movement but require a fresh engagement after a round trip', () => {
  const base = run(fresh()), unchanged = atEngagementBoundary(base, [
    { kind: 'move', who: 'buddy-a', from: 'zone', to: 'zone', at: { sec: 100 } },
    { kind: 'spatial_displacement', who: 'buddy-a', zoneId: 'zone', fromPosition: { x: 4, y: 4 }, toPosition: { x: 5, y: 4 }, at: { sec: 100 } },
  ]);
  assert.equal(watched(unchanged).ready, true);
  const roundTrip = atEngagementBoundary(base, [
    { kind: 'move', who: 'buddy-a', from: 'zone', to: 'safe', at: { sec: 100 } },
    { kind: 'move', who: 'buddy-a', from: 'safe', to: 'zone', at: { sec: 100 } },
  ]);
  assert.equal(watched(roundTrip).ready, false);
  assert.equal(watched({ ...roundTrip, events: [...roundTrip.events, ...run(fresh()).events] }).ready, true);
});

check('combatants who depart before the real HP commit cannot reuse their old engagement', () => {
  const base = run(fresh()), target = base.events.find(event => event.kind === 'team_strike' && event.who === 'changed-a').targetId;
  for (const actorId of ['changed-a', target]) {
    const runtime = atEngagementBoundary(base, hyperloopEvents(actorId)), actor = watched(runtime);
    assert.ok(actor.diagnostics.outgoingHpHits > 0); assert.equal(actor.teamActions, 0); assert.equal(actor.ready, false);
    assert.ok(actor.diagnostics.rejectedStrikes.combatants_unavailable > 0);
  }
});

console.log(JSON.stringify({ engineVersion: SIMULATION_ENGINE_VERSION, checks, pass: failures.length === 0, failures,
  scope: 'Fresh current-source production encounter/team/damage/flee events; one bounded round per fixture, no match history input, no seed search. Controlled coverage does not replace fixed formation runs or G5 acceptance.' }));
if (failures.length) process.exitCode = 1;
