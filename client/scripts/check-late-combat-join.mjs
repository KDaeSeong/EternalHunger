import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import {
  actor,
  skill,
  runCombatScenario,
} from './lib/run-combat-scenario.mjs';
const { createTimedWildlifeEncounter } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');

const START_SEC = 100;
const ARRIVAL_SEC = 2;
const DURATION_SEC = 6;
const LEADER_ID = 'late-join-leader';
const BUDDY_ID = 'late-join-buddy';
const ENEMY_ID = 'controlled-enemy';
const ZONE_ID = 'late-join-zone';
const SEED = 'late-combat-join-20261010';

function makeRows(control) {
  const leader = actor(LEADER_ID, {
    teamId: 'late-join-team',
    zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 4, y: 4 },
    hp: 10000,
    maxHp: 10000,
  });
  const enemy = actor(ENEMY_ID, {
    teamId: 'controlled-enemy-team',
    zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 5, y: 4 },
    hp: 10000,
    maxHp: 10000,
  });
  const buddyZone = control === 'different_zone' ? 'late-join-other-zone'
    : ['different_space', 'eliminated'].includes(control) ? ZONE_ID : 'late-join-away-zone';
  const buddy = actor(BUDDY_ID, {
    teamId: 'late-join-team',
    zoneId: buddyZone,
    _spatial: { zoneId: buddyZone, x: 4, y: 4 },
    hp: control === 'eliminated' ? 0 : 10000,
    maxHp: 10000,
    _actionReadyAtSec: START_SEC + 3.25,
    _basicAttackReadyAtSec: START_SEC + 3.5,
  });

  if (control === 'different_space') {
    buddy._combatSpaceId = 'late-join-other-space';
    buddy._spatial.combatSpaceId = 'late-join-other-space';
  }
  if (control === 'recovery') buddy._recentCombatUntil = START_SEC + 10;
  if (control === 'pending_cast') {
    // The normal scheduler starts this valid self-support cast after arrival
    // and the personal action lock, rather than accepting a fabricated cast.
    buddy.characterSkills = { q: skill({ name: '합류 시전 통제', type: 'shield_skill', shield: [20],
      supportTargetScope: 'self', flatDamage: [0], castDelaySec: 10 }) };
  }
  return [leader, enemy, buddy];
}

function jsonCompatibleState(value, stack = new WeakSet()) {
  if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  assert.equal(stack.has(value), false, 'scenario state must be JSON-compatible and acyclic');
  stack.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item) => jsonCompatibleState(item, stack));
  } else {
    result = {};
    for (const key of Object.keys(value).sort()) {
      const child = jsonCompatibleState(value[key], stack);
      if (child !== undefined) result[key] = child;
    }
  }
  stack.delete(value);
  return result;
}

function reproductionState(result) {
  return jsonCompatibleState({
    events: result.events,
    frames: result.frames,
    survivorEntries: [...result.survivorMap.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
    randomState: result.randomState,
    newDeadIds: result.newDeadIds,
    roundKills: result.roundKills,
    roundAssists: result.roundAssists,
  });
}

function ownPvPBasicAttempts(result) {
  return result.events.filter((event) => String(event.who || '') === BUDDY_ID
    && String(event.targetId || '') === ENEMY_ID
    && event.kind === 'damage' && event.type === 'basic');
}
const ownPositivePvPHits = result => ownPvPBasicAttempts(result)
  .filter(event => Number(event.hpDamage ?? event.damage ?? 0) > 0);

function teamStrikesByBuddy(result) {
  return result.events.filter((event) => String(event.kind || '') === 'team_strike'
    && String(event.who || '') === BUDDY_ID
    && String(event.targetId || '') === ENEMY_ID);
}

async function runCase(control, seed = SEED) {
  let arrived = false;
  const result = await runCombatScenario(makeRows(control), {
    startSec: START_SEC,
    duration: DURATION_SEC,
    seed,
    onElapsed(liveMap, elapsedSec) {
      if (['different_zone', 'different_space', 'eliminated'].includes(control) || elapsedSec < ARRIVAL_SEC || arrived) return;
      arrived = true;
      const buddy = liveMap.get(BUDDY_ID);
      if (!buddy) return;
      buddy.zoneId = ZONE_ID;
      buddy._spatial = { zoneId: ZONE_ID, x: 4, y: 5 };
      if (control !== 'different_space') delete buddy._combatSpaceId;
      if (control === 'hunting') {
        // Start a valid, controlled hunt through the runtime factory at co-presence time.
        // This avoids fabricating an encounter whose owner/target/zone would reconcile away.
        const hunt = createTimedWildlifeEncounter(buddy, {
          pending: true,
          kind: 'chicken',
          claim: { source: 'wildlife', claimantId: BUDDY_ID, zoneId: ZONE_ID, speciesKey: 'chicken', hadSpeciesList: false },
        }, { nowSec: START_SEC + elapsedSec, phaseIdxNow: 1, nextDay: 1, actionKey: 'late-join-hunt-control' });
        assert.ok(hunt, 'the hunt control must be created through the real encounter factory');
        buddy._wildlifeHunt = hunt;
      }
    },
  });
  return { result, arrived };
}

async function runTwice(control) {
  const first = await runCase(control, SEED);
  const second = await runCase(control, SEED);
  assert.equal(first.arrived, !['different_zone', 'different_space', 'eliminated'].includes(control),
    `${control}: arrival callback should follow the fixture policy`);
  assert.deepEqual(reproductionState(first.result), reproductionState(second.result),
    `${control}: identical actor state and seed must reproduce events, frames, RNG, and final state`);
  console.log(`PASS ${control}: fresh actual loop and exact events/frames/final actors/RNG`);
  return first.result;
}

const positive = await runTwice('late_arrival');
const buddy = positive.survivorMap.get(BUDDY_ID);
const strikes = teamStrikesByBuddy(positive);
const attempts = ownPvPBasicAttempts(positive);
const hits = ownPositivePvPHits(positive);
assert.ok(buddy?._combatIntent, 'co-present, eligible buddy should receive intent through the ordinary encounter path');
assert.ok(strikes.length > 0, 'late-arriving eligible buddy should perform its own scheduled team basic');
assert.ok(hits.length > 0, 'the scheduled basic must produce a positive-HP hit, not only a queued strike event');
assert.ok(attempts.every((event) => Number(event.at?.sec ?? event.at) >= START_SEC + 3.5),
  'every basic attempt, including zero-HP damage, must wait for both personal clocks');
assert.ok(strikes.every((event) => Number(event.at?.sec ?? event.at) >= START_SEC + 3.5),
  'every dispatched own team strike must wait for both personal clocks');
for (const event of hits) {
  assert.equal(event.zoneId, ZONE_ID, 'actual hit receipt must remain in the encounter zone');
  assert.ok(Number(event.distance) <= Number(event.reach) + 1e-6,
    'actual hit receipt must prove the hit-time distance was within basic reach');
  assert.equal(event.fromPosition?.zoneId, ZONE_ID, 'hit-time attacker position must match the encounter zone');
  assert.equal(event.targetPosition?.zoneId, ZONE_ID, 'hit-time target position must match the encounter zone');
}

for (const control of ['different_zone', 'different_space', 'recovery', 'eliminated']) {
  const result = await runTwice(control);
  assert.equal(teamStrikesByBuddy(result).length, 0, `${control}: no unauthorized own PvP strike`);
  assert.equal(ownPvPBasicAttempts(result).length, 0, `${control}: no basic attempt, including zero-HP damage`);
  assert.equal(result.survivorMap.get(BUDDY_ID)?._combatIntent || null, null,
    `${control}: buddy must not acquire active PvP intent while the exclusion applies`);
}

for (const control of ['pending_cast', 'hunting']) {
  const result = await runTwice(control);
  if (control === 'pending_cast') {
    assert.equal(teamStrikesByBuddy(result).length, 0, 'an unreleased cast must not yield a free team basic');
    assert.equal(ownPvPBasicAttempts(result).length, 0, 'an unreleased cast must not yield any basic damage attempt');
    const cast = result.events.find(event => event.kind === 'skill_cast' && event.who === BUDDY_ID);
    assert.ok(cast && cast.startedAtSec >= START_SEC + 3.25 && cast.releaseAtSec > START_SEC + DURATION_SEC,
      'the actual AI cast starts after its personal action clock and remains unreleased during the control');
    assert.ok(result.survivorMap.get(BUDDY_ID)?._pendingCharacterCast?.def?.slot,
      'the control must retain a valid runtime cast, not a malformed fake payload');
    const teamRounds = result.events.filter((event) => event.kind === 'team_engagement');
    assert.ok(teamRounds.some((event) => event.teams?.some((side) => side.includes(BUDDY_ID))),
      'pending-cast buddy may remain on a live team side');
    assert.equal(teamRounds.some((event) => event.participants?.includes(BUDDY_ID)), false,
      'this actual scheduled queue never dispatches the pending-cast buddy; onlyActorId is also a queue filter');
  } else {
    const release = result.events.find(event => event.kind === 'hunt_end' && event.who === BUDDY_ID);
    if (release) {
      assert.equal(release.outcome, 'retreat', 'normal PvP interruption ends the current controlled hunt');
      assert.equal(release.subkind, 'chicken', 'payload hunt species never overwrites the product event kind');
      assert.ok(ownPositivePvPHits(result).length > 0,
        'the released hunter must actually re-enter PvP and damage HP after the lock');
      assert.ok(ownPvPBasicAttempts(result).every(event => event.at.sec >= release.at.sec + 2),
        'every later basic attempt, including zero-HP damage, pays the normal two-second action lock');
    } else {
      assert.ok(result.survivorMap.get(BUDDY_ID)?._wildlifeHunt?.target?.hp > 0,
        'without a release receipt the control must still be an actual live encounter');
      assert.equal(teamStrikesByBuddy(result).length, 0, 'an active hunter is not a free team striker');
      assert.equal(ownPvPBasicAttempts(result).length, 0, 'an active hunter is not a free PvP attacker');
    }
    // Receiving intent may correctly release a hunt. Only an attack before
    // release/its normal clock is unauthorized; later ordinary turns are valid.
  }
}

console.log('PASS: late combat join arrival, personal clocks, exclusion controls, and deterministic replay');
