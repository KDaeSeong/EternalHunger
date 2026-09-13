import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { applyStatusEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { areSameTeam } = await import('../src/app/simulation/_lib/teamRuntime.js');
const fixture = JSON.parse(await createRandomIsolationInput('forced-control-integration-1'));
const zoneId = fixture.survivors[0].zoneId;
// Explicit controlled starting conditions, not a default-roster balance test.
// Every effect is part of the saved input; the real match is not injected with
// test-only callbacks or changed HP/loot/endgame rules after it starts.
fixture.survivors.forEach((actor, index) => {
  actor.zoneId = zoneId;
  actor._spatial = { zoneId, x: 8 + (index % 4) * 0.3, y: 8 + Math.floor(index / 4) * 0.3 };
});
const controls = new Map();
fixture.survivors.forEach((actor, index) => {
  const caster = fixture.survivors.find((row) => !areSameTeam(actor, row));
  const name = ['공포', '매혹', '도발'][index % 3];
  const result = applyStatusEffect(actor, { name, remainingDuration: 8.5, durationUnit: 'sec', sourceId: 'controlled-start' }, { sourceActor: caster });
  assert.equal(result.applied, true);
  controls.set(actor._id, { name, casterId: caster._id });
});
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
let apiCalls = 0; const originalFetch = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw new Error('Forced-control match cannot require an account API.'); };
try {
  const first = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input) });
  const transitions = first.events.filter((row) => row.kind === 'forced_control');
  assert.deepEqual([...new Set(transitions.map((row) => row.mode))].sort(), ['charm', 'fear', 'taunt']);
  assert.ok(first.events.some((row) => row.kind === 'forced_control_end'));
  const controlledHits = first.events.filter((row) => row.kind === 'damage' && row.at.sec < 8.5);
  assert.ok(controlledHits.length > 0, 'An actual taunted basic attack must occur, not just a state badge.');
  for (const hit of controlledHits) {
    assert.equal(controls.get(hit.who)?.name, '도발');
    assert.equal(hit.targetId, controls.get(hit.who)?.casterId);
    assert.equal(hit.type, 'basic');
  }
  assert.equal(first.events.some((row) => row.kind === 'skill_cast' && row.at.sec < 8.5), false);
  const second = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), noisy: true });
  const comparison = compareSimulationReplay({ events: first.events, finalFrame: first.finalFrame, random: first.evidence.random },
    { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random });
  assert.equal(comparison.matched, true);
  assert.equal(first.evidence.frameDigest, second.evidence.frameDigest);
  assert.equal(apiCalls, 0);
  console.log(`FORCED_CONTROL_MATCH ${JSON.stringify({ ...first.evidence, controlledHits: controlledHits.length,
    transitions: transitions.length, comparison, apiCalls })}`);
} finally { globalThis.fetch = originalFetch; }
