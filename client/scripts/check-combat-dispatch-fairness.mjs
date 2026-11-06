import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, runCombatScenario } from './lib/run-combat-scenario.mjs';

// A bounded controlled dispatch test, not acceptance of natural-match cooperation.
const startSec = 100;
const duration = 4;
const fixtures = [
  { name: 'two hostile actors at simultaneous one-second deadlines', rows: [['a', 'a', 1], ['b', 'b', 1]] },
  { name: 'three actors retain individual deadlines with an allied pair', rows: [['a', 'a', 2], ['b', 'b', 1], ['c', 'a', 0.5]] },
  { name: 'four actors dispatch both allied pairs at tied deadlines', rows: [['a', 'a', 1], ['b', 'b', 1], ['c', 'a', 1], ['d', 'b', 1]] },
];

async function run(fixture, observed) {
  const rows = fixture.rows.map(([id, teamId, speed]) => actor(id, { teamId, hp: 10000, maxHp: 10000,
    stats: { maxHp: 10000, attackPower: 1, defense: 0, attackSpeed: speed } }));
  let frames = 0;
  let observations = 0;
  let elapsed = 0;
  let worldEnd = 0;
  let tiedCandidatesNotSelected = 0;
  const queueParticipants = {};
  const observationErrors = [];
  const onElapsed = (live, end) => {
    assert.ok(end > worldEnd && end <= duration, 'The real world clock must advance monotonically.');
    elapsed += end - worldEnd;
    worldEnd = end;
    for (const row of live.values()) {
      assert.ok(row.hp > 9900, 'The fixture must remain a low-damage live fight.');
      assert.deepEqual(row._spatial, { zoneId: 'zone', x: 4, y: 4 }, 'No movement may confound dispatch.');
    }
  };
  const observeCombatRuntime = observed ? snapshot => {
    // Product observers deliberately isolate exceptions from match execution.
    // Preserve assertion failures here and fail outside that isolation boundary.
    try {
    assert.ok(++observations < 5000, 'Observation must remain bounded.');
    if (snapshot.stage === 'actor_schedule' && snapshot.scheduled?.actionType === 'basic') {
      for (const row of snapshot.actorCandidates) {
        if (row.candidate?.actionType === 'basic' && row.candidate.atSec === snapshot.scheduled.atSec
          && row.actorId !== snapshot.scheduled.actorId) tiedCandidatesNotSelected++;
      }
    }
    if (snapshot.stage === 'team_queue') {
      assert.equal(snapshot.participants.length, 1, 'A scheduled basic dispatches only its own actor.');
      assert.equal(snapshot.participants[0], snapshot.onlyActorId);
      const id = snapshot.participants[0];
      queueParticipants[id] = (queueParticipants[id] || 0) + 1;
    }
    } catch (error) { observationErrors.push(error.message); }
  } : undefined;
  const result = await runCombatScenario(rows, { duration, startSec,
    settings: { characterSkillsEnabled: false }, seed: 'bounded-dispatch-fairness',
    onElapsed, observeCombatRuntime,
    onFrame: frame => {
      assert.ok(++frames < 150, 'Finite frame cap must catch zero-time starvation.');
      assert.ok(frame.sec >= startSec && frame.sec <= startSec + duration);
    } });
  assert.deepEqual(observationErrors, [], 'Observer assertions must not be swallowed by product exception isolation.');
  assert.equal(elapsed, duration);
  assert.equal(worldEnd, duration);
  assert.equal(result.frames.at(-1).sec, startSec + duration);
  assert.ok(result.events.length < 250, 'Finite event cap must catch repeated same-time attacks.');
  assert.ok(!result.events.some(event => ['chase', 'move', 'skill', 'death'].includes(event.kind)),
    'No escape, movement, skill or death may alter this fixture.');
  const hits = result.events.filter(event => event.kind === 'damage' && event.type === 'basic');
  for (const [id, , speed] of fixture.rows) {
    const interval = 1 / speed;
    const expectedTimes = Array.from({ length: duration * speed }, (_, i) => startSec + i * interval);
    const ownHits = hits.filter(event => event.who === id);
    assert.deepEqual(ownHits.map(event => event.at.sec), expectedTimes,
      `${id}: each ready interval must actually execute, including actors not selected first at a tie.`);
    for (const hit of ownHits) {
      assert.equal(hit.attackIntervalSec, interval);
      assert.equal(hit.nextAttackAtSec, hit.at.sec + interval, 'Each emitted attack must reserve its own next interval.');
      assert.equal(hit.hpDamage, 1);
      assert.equal(hit.hpBefore - hit.hpAfter, 1);
      assert.equal(hit.distance, 0);
    }
    const final = result.survivorMap.get(id);
    assert.equal(final._basicAttackReadyAtSec, startSec + duration);
    assert.equal(final.hp, 10000 - hits.filter(event => event.targetId === id).length,
      'Final HP must reconcile with actual incoming emitted hits.');
    if (observed && fixture.rows.length > 2) assert.equal(queueParticipants[id], expectedTimes.length);
  }
  assert.equal(hits.length, fixture.rows.reduce((sum, [, , speed]) => sum + duration * speed, 0));
  if (observed) assert.ok(tiedCandidatesNotSelected > 0,
    'Observe simultaneous eligible candidates losing the first arbitration without calling that starvation.');
  return { result, tiedCandidatesNotSelected, frames, observations };
}

let checks = 0;
for (const fixture of fixtures) {
  const plain = await run(fixture, false);
  const observed = await run(fixture, true);
  assert.deepEqual(observed.result.events, plain.result.events, 'Observation must not change emitted combat outcomes.');
  assert.deepEqual(observed.result.randomState, plain.result.randomState, 'Observation must consume no gameplay RNG.');
  assert.deepEqual([...observed.result.survivorMap.values()], [...plain.result.survivorMap.values()],
    'Observation must not mutate final runtime state.');
  checks++;
  console.log(`PASS ${fixture.name}: four seconds; ${observed.tiedCandidatesNotSelected} tied nonselections; ${observed.frames} frames`);
}
console.log(`PASS ${checks} bounded current-source dispatch fixtures; natural-match G5.2 acceptance remains separate.`);
