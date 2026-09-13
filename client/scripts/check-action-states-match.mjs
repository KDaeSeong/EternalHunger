import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { applyStatusEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { areSameTeam } = await import('../src/app/simulation/_lib/teamRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const fixture = JSON.parse(await createRandomIsolationInput('action-states-integration-1'));
const zoneId = fixture.survivors[0].zoneId;
const startingStates = new Map();
const diagnoseOpening = process.argv.includes('--diagnose-opening');
// Explicit saved initial conditions. No fabricated outcomes or mid-match hooks;
// this is state/replay verification, not default-roster balance evidence.
fixture.survivors.forEach((actor, index) => {
  actor.zoneId = zoneId;
  actor._spatial = { zoneId, x: 8 + index % 4 * 0.3, y: 8 + Math.floor(index / 4) * 0.3 };
  actor.stats = { ...actor.stats, sightRange: 24, attackRange: 2 };
  const entry = [['수면', 8.5], ['변이', 6.5], ['제압', 4.5], ['경직', 2.5], null][index % 5];
  if (entry) {
    const [name, seconds] = entry;
    assert.equal(applyStatusEffect(actor, { name, remainingDuration: seconds, durationUnit: 'sec', sourceId: 'controlled-start' }).applied, true);
    startingStates.set(actor._id, { name, seconds });
  }
});
if (!diagnoseOpening) withSimulationRandom(createSeedRng('action-states:initial-engagement'), () => {
  for (const attacker of fixture.survivors.filter((row) => !startingStates.has(row._id))) {
    const target = fixture.survivors.find((row) => startingStates.get(row._id)?.name === '수면' && !areSameTeam(attacker, row));
    assert.ok(target);
    engageCombatParticipants(attacker, target, fixture.survivors, 0);
  }
});
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
let apiCalls = 0; const originalFetch = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw new Error('Action-state match cannot require an account API.'); };
try {
  const first = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input) });
  const wakes = first.events.filter((event) => event.kind === 'sleep_break');
  if (diagnoseOpening) {
    console.log(`ACTION_STATES_OPENING_DIAGNOSTIC ${JSON.stringify({ sleepWakes: wakes.length,
      firstDamageAt: first.events.find((event) => event.kind === 'damage')?.at?.sec,
      early: first.events.filter((event) => event.at?.sec < 8.5 && ['move', 'action_cycle', 'damage'].includes(event.kind))
        .map(({ kind, who, from, to, at, chosen, hpDamage }) => ({ kind, who, from, to, sec: at.sec, chosen, hpDamage })) })}`);
  } else {
  assert.ok(wakes.length > 0, 'Sleep must actually be broken by a hit in this match.');
  assert.ok(wakes.some((event) => event.bonusDamage > 0));
  for (const event of first.events.filter((row) => ['damage', 'skill_cast'].includes(row.kind))) {
    const initial = startingStates.get(event.who);
    if (initial && initial.name !== '수면') assert.ok(event.at.sec >= initial.seconds, `${initial.name} actor acted early.`);
  }
  const second = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), noisy: true });
  const comparison = compareSimulationReplay({ events: first.events, finalFrame: first.finalFrame, random: first.evidence.random },
    { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random });
  assert.equal(comparison.matched, true); assert.equal(first.evidence.frameDigest, second.evidence.frameDigest); assert.equal(apiCalls, 0);
  console.log(`ACTION_STATES_MATCH ${JSON.stringify({ ...first.evidence, sleepWakes: wakes.length, comparison, apiCalls })}`);
  }
} finally { globalThis.fetch = originalFetch; }
