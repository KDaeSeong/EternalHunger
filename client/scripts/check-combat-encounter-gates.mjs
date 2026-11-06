import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { observeCombatParticipation } = await import('../src/app/simulation/_lib/combatParticipationObservationRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const clone = value => structuredClone(value);
const row = (id, teamId, extra = {}) => ({ _id: id, name: id, teamId, zoneId: 'zone', hp: 1000, maxHp: 1000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 }, inventory: [], tacticalSkill: 'none', _tacNextAbsSec: 9999,
  stats: { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1 }, ...extra });
const fresh = (count = 3) => [row('a', 'one'), row('b', 'two'), ...(count === 3 ? [row('c', 'one')] : [])];
const gates = snapshots => snapshots.filter(snapshot => snapshot.stage === 'encounter_gate').map(snapshot => snapshot.encounterGate);
let checks = 0;
const check = async (name, work) => { await work(); checks++; console.log(`PASS ${name}`); };

await check('gate projection owns only capped primitives without consuming gameplay RNG', () => {
  const live = row('a', 'one');
  const source = { source: 'encounter', reason: 'escaped', actionType: 'basic', scheduledActorId: 'a',
    scheduledTargetId: 'b', teamCombatEnabled: true, sideSizes: [2, 1], escaped: true, caught: false,
    actor: live, callback: () => { throw Error('Never invoke a raw callback'); } };
  const random = createSeedRng('gate-projection');
  const before = random.getState(); let snapshot;
  withSimulationRandom(random, () => observeCombatParticipation(value => { snapshot = value; }, {
    stage: 'encounter_gate', nowSec: 100, encounterGate: source,
  }));
  assert.ok(snapshot);
  assert.deepEqual(random.getState(), before);
  assert.ok(Object.isFrozen(snapshot.encounterGate) && Object.isFrozen(snapshot.encounterGate.sideSizes));
  assert.deepEqual(Object.keys(snapshot.encounterGate).sort(), ['source', 'reason', 'actionType', 'scheduledActorId',
    'scheduledTargetId', 'teamCombatEnabled', 'sideSizes', 'escaped', 'caught'].sort());
  source.sideSizes[0] = 99; source.reason = 'changed'; live.hp = 0;
  assert.equal(snapshot.encounterGate.reason, 'escaped'); assert.deepEqual(snapshot.encounterGate.sideSizes, [2, 1]);
  let malformed;
  observeCombatParticipation(value => { malformed = value.encounterGate; }, { stage: 'encounter_gate',
    encounterGate: { source: live, reason: 'x'.repeat(10000), actionType: () => {}, scheduledActorId: live,
      scheduledTargetId: 'b'.repeat(10000), sideSizes: [1e9, -1, 99], escaped: live, caught: 'true' } });
  assert.equal(malformed.source, 'other'); assert.equal(malformed.reason, 'other');
  assert.equal(malformed.actionType, 'other'); assert.equal(malformed.scheduledActorId, '');
  assert.equal(malformed.scheduledTargetId.length, 256); assert.deepEqual(malformed.sideSizes, [512, 0]);
  assert.equal(malformed.escaped, false); assert.equal(malformed.caught, false);
  let called = false;
  observeCombatParticipation(undefined, { encounterGate: { get reason() { called = true; return 'escaped'; } } });
  assert.equal(called, false, 'Disabled observation must not inspect the gate graph.');
  let brokenCalls = 0;
  assert.doesNotThrow(() => withSimulationRandom(random, () => observeCombatParticipation(() => { brokenCalls++; }, {
    stage: 'encounter_gate', encounterGate: { get reason() { throw Error('Invalid primitive getter'); } },
  })));
  assert.equal(brokenCalls, 0, 'A failed gate projection must not fabricate a snapshot.');
  assert.deepEqual(random.getState(), before);
});

function encounter(rows, { teamEnabled = true, randomValue = 0.5, escape = false,
  target = rows[1], observed = true } = {}) {
  const survivorMap = new Map(rows.map(actor => [actor._id, actor]));
  const events = [], snapshots = [];
  const random = createSeedRng('gate-direct');
  // A fixed constant explicitly controls flee/chase/catch, without seed search.
  const source = escape ? () => randomValue : random;
  const result = withSimulationRandom(source, () => runPhaseCombatEncounter({ state: {
    actor: rows[0], target, actionType: 'basic', survivorMap, newDeadIds: [], phaseSurvivors: rows,
    todaysSurvivors: [...rows], currentActionSec: () => 100, nextDay: 3, phaseIdxNow: 4,
    roundKills: {}, roundAssists: {}, estimatePower: () => 100, publicItems: [], craftables: [],
    battleSettings: { characterSkillsEnabled: false },
    ruleset: { ai: { escapeHpBelow: escape ? 42 : 0, escapeBaseChance: 1, chaseBaseChance: 0 },
      pvp: { teamCombatEnabled: teamEnabled, criticalFleeHpBelow: 0, earlyLethalFinishMax: 0,
        postBattleMoveChance: 0, restHealMax: 0, postBattleRestExtraHealMax: 0 } },
    zoneGraph: { zone: ['safe'], safe: ['zone'] }, forbiddenIds: new Set(), totalZonesCount: 10,
  }, actions: {
    atNow: () => ({ sec: 100, day: 3, phase: 'morning' }),
    emitRunEvent: (kind, payload, at) => events.push(clone({ ...payload, kind, at })),
    observeCombatRuntime: observed ? snapshot => {
      if (observed === 'throw') throw Error('Observer failure must not affect the encounter.');
      snapshots.push(snapshot);
    } : undefined,
  } }));
  return { result, survivorMap, events, snapshots, randomState: random.getState() };
}

await check('actual one-versus-one fallback and disabled-team branches are handoffs, not terminal losses', () => {
  const solo = encounter(fresh(2));
  assert.ok(gates(solo.snapshots).some(gate => gate.reason === 'solo_pair_fallback'));
  assert.ok(solo.events.some(event => event.kind === 'damage' && event.who === 'a'));
  const disabled = encounter(fresh(), { teamEnabled: false });
  assert.ok(gates(disabled.snapshots).some(gate => gate.reason === 'team_disabled' && !gate.teamCombatEnabled));
  assert.ok(disabled.events.some(event => event.kind === 'damage' && event.who === 'a'));
});

await check('actual three-actor due-basic queue keeps handoff separate from executed hit and preserves outcomes', () => {
  const observed = encounter(fresh()), plain = encounter(fresh(), { observed: false });
  const passed = gates(observed.snapshots).filter(gate => gate.reason === 'team_queue_reached');
  assert.ok(passed.length > 0);
  assert.ok(passed.every(gate => gate.scheduledActorId === 'a' && gate.scheduledTargetId === 'b'));
  const queue = observed.snapshots.find(snapshot => snapshot.stage === 'team_queue');
  assert.deepEqual(queue.participants, ['a']);
  assert.ok(observed.events.some(event => event.kind === 'team_strike' && event.who === 'a' && event.damage > 0));
  assert.deepEqual(observed.events, plain.events); assert.deepEqual(observed.randomState, plain.randomState);
  assert.deepEqual([...observed.survivorMap], [...plain.survivorMap]);
  const throwing = encounter(fresh(), { observed: 'throw' });
  assert.deepEqual(throwing.events, plain.events); assert.deepEqual(throwing.randomState, plain.randomState);
  assert.deepEqual([...throwing.survivorMap], [...plain.survivorMap]);
});

await check('actual pair guards explain missing, spatially changed, dead and untargetable pairs', () => {
  const missing = encounter(fresh(), { target: null });
  assert.ok(gates(missing.snapshots).some(gate => gate.reason === 'pair_missing'));
  for (const patch of [{ zoneId: 'elsewhere' }, { _combatSpaceId: 'dimension_rift:other' }]) {
    const rows = fresh(); Object.assign(rows[1], patch);
    const run = encounter(rows);
    assert.ok(gates(run.snapshots).some(gate => gate.reason === 'pair_space_zone_changed'));
    assert.ok(!run.events.some(event => event.kind === 'damage'));
  }
  const dead = fresh(); dead[1].hp = 0;
  assert.ok(gates(encounter(dead).snapshots).some(gate => gate.reason === 'pair_inactive_or_untargetable'));
  const hidden = fresh(); hidden[1].activeEffects = [{ name: '대상 지정 불가', remainingDuration: 1, durationUnit: 'sec' }];
  const untargetable = encounter(hidden);
  assert.ok(gates(untargetable.snapshots).some(gate => gate.reason === 'pair_inactive_or_untargetable'));
  assert.ok(!untargetable.events.some(event => event.kind === 'damage'));
});

await check('actual flee and caught-lethal branches terminate before team dispatch', () => {
  const escaping = fresh(); escaping[1].hp = 1;
  const escaped = encounter(escaping, { escape: true, randomValue: 0.5 });
  assert.ok(gates(escaped.snapshots).some(gate => gate.reason === 'escaped' && gate.escaped && !gate.caught));
  assert.ok(!escaped.snapshots.some(snapshot => snapshot.stage === 'team_queue'));
  const caughtRows = fresh(); caughtRows[1].hp = 1;
  const caught = encounter(caughtRows, { escape: true, randomValue: 0 });
  assert.ok(gates(caught.snapshots).some(gate => gate.reason === 'caught_elimination' && gate.escaped && gate.caught));
  assert.equal(caught.survivorMap.get('b').hp, 0);
  assert.ok(!caught.snapshots.some(snapshot => snapshot.stage === 'team_queue'));
});

async function loop(boundary, observed = true) {
  const rows = fresh(); let offset = 0, live, frames = 0;
  const snapshots = [], events = [];
  const ready = boundary === 'phase' ? 104 : 101;
  for (const actor of rows) actor._basicAttackReadyAtSec = ready;
  const timeline = createPhaseActionTimeline({ durationSec: 4 });
  const random = createSeedRng('gate-loop'); let pending;
  withSimulationRandom(random, () => {
    engageCombatParticipants(rows[0], rows[1], rows, 100);
    pending = runPvpActionLoop({ state: {
      updatedSurvivors: rows, phaseSurvivors: rows, phaseDurationSec: 4, nextDay: 1, nextPhase: 'morning',
      currentActionSec: () => 100 + offset, getPhaseRuntimeOffsetSec: () => offset,
      battleSettings: { characterSkillsEnabled: false },
      ruleset: { ai: { escapeHpBelow: 0 }, pvp: { teamCombatEnabled: true, criticalFleeHpBelow: 0 } },
    }, actions: {
      reserveActionSecond: seconds => { offset = Math.min(4, Math.round((offset + seconds) * 1e6) / 1e6); },
      advanceWorld: ({ survivorMap, offsetSec }) => {
        live = survivorMap; timeline.advanceTo(offsetSec);
        if (boundary === 'space' && offsetSec >= 1) for (const actor of live.values()) actor._combatSpaceId = 'dimension_rift:other';
      },
      shouldEndMatch: () => boundary === 'match' && offset >= 1,
      observeCombatRuntime: observed ? snapshot => {
        if (observed === 'throw') throw Error('Observer failure must not affect the world loop.');
        snapshots.push(snapshot);
      } : undefined,
      atNow: () => ({ sec: 100 + offset, day: 1, phase: 'morning' }),
      emitRunEvent: (kind, payload, at) => events.push(clone({ ...payload, kind, at })),
      publishActionFrame: async () => { assert.ok(++frames < 100, 'Bounded loop must terminate.'); },
    } });
  });
  const result = await pending;
  assert.ok(snapshots.length < 2000, 'Observer assertions must run outside product exception isolation.');
  return { snapshots, events, offset, final: clone([...result.survivorMap]), randomState: random.getState() };
}

await check('actual loop phase, match and actor-space boundaries account for selected basics', async () => {
  for (const [boundary, reason] of [['phase', 'loop_phase_end'], ['match', 'loop_match_end'], ['space', 'actor_space_changed']]) {
    const run = await loop(boundary);
    const matching = gates(run.snapshots).filter(gate => gate.reason === reason);
    assert.ok(matching.length > 0, reason);
    assert.ok(matching.every(gate => gate.source === 'loop' && gate.actionType === 'basic'));
    assert.ok(!run.events.some(event => event.kind === 'damage'), 'Cancelled selected attacks must not produce HP packets.');
    assert.ok(run.offset <= 4);
  }
});

await check('real bounded loops preserve events, final state and RNG with observation enabled, disabled or throwing', async () => {
  for (const boundary of ['steady', 'phase', 'match', 'space']) {
    const plain = await loop(boundary, false);
    const observed = await loop(boundary, true);
    const throwing = await loop(boundary, 'throw');
    for (const other of [observed, throwing]) {
      assert.deepEqual(other.events, plain.events, boundary);
      assert.deepEqual(other.final, plain.final, boundary);
      assert.deepEqual(other.randomState, plain.randomState, boundary);
      assert.equal(other.offset, plain.offset);
    }
    if (boundary === 'steady') {
      assert.ok(observed.events.some(event => event.kind === 'damage' && event.hpDamage > 0));
      assert.ok(gates(observed.snapshots).some(gate => gate.reason === 'team_queue_reached'));
    }
  }
});

console.log(`PASS ${checks} bounded encounter-gate groups; branch evidence only, not natural-match formation acceptance.`);
