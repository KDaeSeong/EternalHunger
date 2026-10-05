import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');

function trackHuntOwner(activeHunts, event) {
  if (event.kind === 'hunt_start') {
    assert.equal(activeHunts.has(event.who), false, 'A hunter cannot own two active encounters.');
    activeHunts.set(event.who, event.encounterId);
  }
  if (event.kind === 'hunt_transfer') {
    assert.equal(activeHunts.get(event.previousOwnerId), event.encounterId,
      'A handoff must preserve the actual previous owner and encounter.');
    assert.equal(activeHunts.has(event.who), false, 'A handoff cannot replace another active encounter.');
    activeHunts.delete(event.previousOwnerId);
    activeHunts.set(event.who, event.encounterId);
  }
  if (event.kind === 'hunt_end' && activeHunts.get(event.who) === event.encounterId) activeHunts.delete(event.who);
}

// Independent lifecycle inputs, not a saved match outcome. A former owner may
// re-enter PvP after a handoff; its successor must still be treated as hunting.
const ownership = new Map();
trackHuntOwner(ownership, { kind: 'hunt_start', who: 'first', encounterId: 'boss' });
assert.deepEqual([...ownership], [['first', 'boss']]);
trackHuntOwner(ownership, { kind: 'hunt_transfer', previousOwnerId: 'first', who: 'second', encounterId: 'boss' });
assert.equal(ownership.has('first'), false);
assert.equal(ownership.get('second'), 'boss');
trackHuntOwner(ownership, { kind: 'hunt_end', who: 'first', encounterId: 'boss' });
assert.equal(ownership.get('second'), 'boss', 'A former owner ending must not close the live successor hunt.');
assert.throws(() => trackHuntOwner(ownership,
  { kind: 'hunt_transfer', previousOwnerId: 'first', who: 'third', encounterId: 'boss' }));
assert.deepEqual([...ownership], [['second', 'boss']], 'A stale handoff must preserve the current owner.');
trackHuntOwner(ownership, { kind: 'hunt_transfer', previousOwnerId: 'second', who: 'third', encounterId: 'boss' });
assert.deepEqual([...ownership], [['third', 'boss']]);
trackHuntOwner(ownership, { kind: 'hunt_start', who: 'first', encounterId: 'animal' });
assert.throws(() => trackHuntOwner(ownership,
  { kind: 'hunt_transfer', previousOwnerId: 'third', who: 'first', encounterId: 'boss' }));
assert.deepEqual([...ownership], [['third', 'boss'], ['first', 'animal']]);
trackHuntOwner(ownership, { kind: 'hunt_end', who: 'third', encounterId: 'boss' });
trackHuntOwner(ownership, { kind: 'hunt_end', who: 'first', encounterId: 'animal' });
assert.equal(ownership.size, 0);
console.log('PASS ultimate diagnostic tracks handoff ownership and preserves live successor hunts');

const fixture = JSON.parse(await createRandomIsolationInput('casting-integration-1'));
// The generic guest roster has no character Q/W/E/R definitions. Give this
// explicit test roster real delayed attacks, support and enhanced basics;
// default guest matches alone cannot prove the new skill path ran.
fixture.survivors.forEach((actor, index) => {
  actor.characterSkills = {
    q: { enabled: true, type: index % 3 === 0 ? 'basic_attack_enhance' : 'attack_skill', name: `시간축 Q ${index}`,
      flatDamage: [15], cooldownSec: 8.5, castDelaySec: 1.25, recoveryDelaySec: 0.25, radius: index % 3 === 1 ? 1 : 0 },
    w: { enabled: true, type: index % 2 === 0 ? 'heal_skill' : 'shield_skill', name: `지원 W ${index}`,
      heal: index % 2 === 0 ? [30] : [0], shield: index % 2 ? [20] : [0], supportTargetScope: 'auto',
      cooldownSec: 12, castDelaySec: 0.5, recoveryDelaySec: 0.25, durationSec: 2.5 },
    r: { enabled: true, type: index % 3 === 0 ? 'shield_skill' : 'attack_skill', name: `교전 전용 R ${index}`,
      flatDamage: index % 3 === 0 ? [0] : [55], shield: index % 3 === 0 ? [45] : [0],
      range: 6, supportTargetScope: 'auto', cooldownSec: 45, castDelaySec: 0.75, recoveryDelaySec: 0.25, durationSec: 4 },
  };
});
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
let apiCalls = 0; const originalFetch = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw new Error('Casting match cannot require an account API.'); };
try {
  const ultimateCastFrames = new Set();
  const first = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFrame: (frame) => {
    for (const actor of frame.survivors || []) {
      const cast = actor._pendingCharacterCast;
      if (cast?.def?.slot !== 'r') continue;
      assert.ok(actor._combatIntent, 'Every pending R must belong to enemy-team combat, including support R.');
      assert.ok(!actor._wildlifeHunt, 'No ordinary, mutant or boss hunt may start R.');
      assert.ok(!String(cast.targetId).startsWith('wildlife:'));
      ultimateCastFrames.add(cast.castId);
    }
  } });
  const casts = first.events.filter((event) => event.kind === 'skill_cast');
  const cancels = first.events.filter((event) => event.kind === 'skill_cancel');
  const releases = first.events.filter((event) => event.kind === 'skill' && event.castId);
  const armed = first.events.filter((event) => event.kind === 'skill_armed');
  const ultimateCasts = casts.filter((event) => event.slot === 'r');
  const huntingCasts = casts.filter((event) => String(event.targetId).startsWith('wildlife:'));
  assert.ok(ultimateCasts.length > 0 && huntingCasts.length > 0, 'Exercise both real hunting casts and real PvP ultimates.');
  assert.ok(ultimateCastFrames.size > 0);
  assert.ok(huntingCasts.every((event) => event.slot !== 'r'));
  assert.ok(releases.some((event) => event.slot === 'r' && event.damage > 0));
  assert.ok(releases.some((event) => event.slot === 'r' && event.shield > 0));
  const activeHunts = new Map();
  let huntTransfers = 0;
  for (const event of first.events) {
    trackHuntOwner(activeHunts, event);
    if (event.kind === 'hunt_transfer') huntTransfers++;
    if (event.kind === 'skill_cast' && event.slot === 'r') {
      if (activeHunts.has(event.who)) console.error(`ULTIMATE_HUNT_WITNESS ${JSON.stringify({
        cast: event, openEncounterId: activeHunts.get(event.who),
        history: first.events.filter(row => Number(row.at?.sec) <= Number(event.at?.sec)
          && (row.who === event.who || row.previousOwnerId === event.who)
          && ['hunt_start', 'hunt_end', 'hunt_transfer', 'skill_cast', 'move', 'death'].includes(row.kind)).slice(-12),
      })}`);
      assert.equal(activeHunts.has(event.who), false,
        'Self/ally-targeted R must not bypass the active-hunt restriction.');
    }
  }
  assert.ok(huntTransfers > 0, 'The actual casting match must exercise boss-hunt handoff ownership.');
  assert.ok(casts.length > 0 && cancels.length > 0 && releases.length > 0 && armed.length > 0);
  assert.ok(releases.some((event) => event.heal > 0)); assert.ok(releases.some((event) => event.shield > 0));
  const byId = new Map(casts.map((cast) => [cast.castId, cast])); assert.equal(byId.size, casts.length);
  const armedIds = new Set(armed.map((event) => event.castId));
  const cancelIds = new Set(cancels.map((event) => event.castId));
  for (const release of [...releases, ...armed]) {
    const cast = byId.get(release.castId); assert.ok(cast); assert.equal(cancelIds.has(release.castId), false);
    assert.ok(release.at.sec >= cast.releaseAtSec);
    if (release.kind === 'skill_armed' || !armedIds.has(release.castId)) assert.equal(release.at.sec, cast.releaseAtSec);
  }
  for (const packet of first.events.filter((event) => event.kind === 'damage' && event.castId)) {
    assert.equal(cancelIds.has(packet.castId), false); assert.ok(packet.at.sec >= byId.get(packet.castId).releaseAtSec);
  }
  const spatialHits = first.events.filter((event) => event.kind === 'damage' && Number.isFinite(event.distance));
  assert.ok(spatialHits.length > 0, 'A full match must exercise spatially validated hits.');
  for (const packet of spatialHits) {
    assert.ok(packet.distance <= packet.reach + 1e-6);
    assert.equal(packet.fromPosition.zoneId, packet.targetPosition.zoneId);
    assert.ok(Math.abs(Math.hypot(packet.fromPosition.x - packet.targetPosition.x,
      packet.fromPosition.y - packet.targetPosition.y) - packet.distance) < 1e-6);
  }
  for (const packet of first.events.filter((event) => event.kind === 'damage' && Number.isFinite(event.areaDistance))) {
    assert.ok(packet.areaDistance <= packet.radius + 1e-6);
    assert.equal(packet.centerPosition.zoneId, packet.targetPosition.zoneId);
  }
  const second = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), noisy: true });
  const comparison = compareSimulationReplay({ events: first.events, finalFrame: first.finalFrame, random: first.evidence.random },
    { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random });
  assert.equal(comparison.matched, true); assert.equal(first.evidence.frameDigest, second.evidence.frameDigest);
  assert.equal(apiCalls, 0);
  console.log(`CHARACTER_CASTING_MATCH ${JSON.stringify({ ...first.evidence, casts: casts.length, cancels: cancels.length,
    releases: releases.length, armed: armed.length, heals: releases.filter((event) => event.heal > 0).length,
    shields: releases.filter((event) => event.shield > 0).length, ultimateCasts: ultimateCasts.length,
    ultimateCastFrames: ultimateCastFrames.size, huntingCasts: huntingCasts.length, huntTransfers, comparison, apiCalls })}`);
} finally { globalThis.fetch = originalFetch; }
