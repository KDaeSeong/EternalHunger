import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { isEndgamePhase } = await import('../src/app/simulation/_lib/suddenDeathRuntime.js');
const { createSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');

// The ordinary roster may legitimately finish before final night (1101 now
// ends on day 6 daytime). Use explicit custom-roster durability, as in the
// archive coverage test: no seed hunting, modified world rules, scripted deaths
// or state injections after start. This is not default-roster balance evidence.
const seed = process.argv[2] || '1101';
const hpScale = 2;
let beforeFrames = 0, afterFrames = 0, observedGrants = 0;
const fixture = JSON.parse(await createRandomIsolationInput(seed));
const originalRules = structuredClone(fixture.settings);
fixture.survivors = fixture.survivors.map(actor => ({ ...actor,
  hp: actor.hp * hpScale, maxHp: actor.maxHp * hpScale,
  stats: { ...actor.stats, maxHp: actor.stats.maxHp * hpScale } }));
assert.deepEqual(fixture.settings, originalRules, 'Coverage durability must not alter world or collar rules.');
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
const result = await runRandomIsolationMatch(null, { savedInput: input, onFrame(frame) {
  const finalNight = isEndgamePhase(frame.day, frame.phase), cap = finalNight ? 45 : 30;
  if (finalNight) afterFrames += 1; else beforeFrames += 1;
  for (const actor of frame.survivors) {
    assert.equal(actor.detonationMaxSec, cap, `frame ${frame.matchSec}: ${actor._id} cap`);
    assert.ok(actor.detonationSec >= 0 && actor.detonationSec <= cap);
    if (actor.detonationFinalNightBonusGranted) observedGrants += 1;
    if (!finalNight) assert.notEqual(actor.detonationFinalNightBonusGranted, true);
  }
} });
const grants = result.events.filter((event) => event.kind === 'detonation_bonus');
assert.ok(beforeFrames > 0 && afterFrames > 0 && observedGrants > 0 && grants.length > 0,
  `The fixture must reach the real final-night transition, not merely finish an early match: ${JSON.stringify({
    seed, beforeFrames, afterFrames, observedGrants, grants: grants.length,
    ending: { day: result.evidence.ending.day, phase: result.evidence.ending.phase,
      atSec: result.evidence.ending.atSec, cause: result.evidence.ending.cause },
  })}`);
assert.equal(new Set(grants.map((event) => event.who)).size, grants.length);
for (const event of grants) {
  assert.equal(event.at.day, 6); assert.equal(event.at.phase, 'night'); assert.equal(event.at.sec, 1180);
  assert.ok(event.beforeSec >= 0 && event.beforeSec <= 30);
  assert.equal(event.afterSec, Math.round((event.beforeSec + 15) * 1e6) / 1e6);
  assert.equal(event.maxSec, 45); assert.equal(event.addedSec, 15);
}
assert.equal(result.events.at(-1).kind, 'match_end');
console.log(JSON.stringify({ pass: true, seed, hpScale, engineVersion: SIMULATION_ENGINE_VERSION, beforeFrames, afterFrames,
  grants: grants.map(({ who, beforeSec, afterSec, at }) => ({ who, beforeSec, afterSec, at })), evidence: result.evidence,
  scope: 'source-generated custom roster with explicit HP x2 and unchanged world rules: actual match, every frame cap, personal once-only final-night bonus and normal ending; not default-roster balance or human acceptance' }));
