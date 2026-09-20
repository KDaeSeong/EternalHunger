import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { isEndgamePhase } = await import('../src/app/simulation/_lib/suddenDeathRuntime.js');

const seed = process.argv[2] || '2202';
let beforeFrames = 0, afterFrames = 0, observedGrants = 0;
const input = await createRandomIsolationInput(seed);
const result = await runRandomIsolationMatch(input, { onFrame(frame) {
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
  'The fixture must reach the real final-night transition, not merely finish an early match.');
assert.equal(new Set(grants.map((event) => event.who)).size, grants.length);
for (const event of grants) {
  assert.equal(event.at.day, 6); assert.equal(event.at.phase, 'night'); assert.equal(event.at.sec, 1180);
  assert.ok(event.beforeSec >= 0 && event.beforeSec <= 30);
  assert.equal(event.afterSec, Math.round((event.beforeSec + 15) * 1e6) / 1e6);
  assert.equal(event.maxSec, 45); assert.equal(event.addedSec, 15);
}
assert.equal(result.events.at(-1).kind, 'match_end');
console.log(JSON.stringify({ pass: true, seed, engineVersion: SIMULATION_ENGINE_VERSION, beforeFrames, afterFrames,
  grants: grants.map(({ who, beforeSec, afterSec, at }) => ({ who, beforeSec, afterSec, at })), evidence: result.evidence,
  scope: 'actual model match: every frame cap, personal once-only final-night bonus, normal match ending; not human acceptance' }));
