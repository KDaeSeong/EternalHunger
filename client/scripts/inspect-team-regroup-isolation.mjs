import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Read-only diagnosis of real engine frames. An isolation period ends on
// contact, death, a space change, or loss of all living teammates; none of
// those endings is silently counted as a successful regroup.
const seed = process.argv[2] || '2202';
const input = await createRandomIsolationInput(seed);
const fixture = JSON.parse(input);
const tracker = createTeamIsolationTracker({ items: fixture.items, zones: fixture.map.zones, captureSnapshots: true });
const result = await runRandomIsolationMatch(input, { onFrame: tracker.observe });
assert.equal(result.events.at(-1).kind, 'match_end');
const { finished, unfinished } = tracker.report();
const selected = finished.sort((a, b) => b.duration - a.duration).slice(0, 3);
for (const period of selected) {
  const teamIds = new Set(fixture.survivors.filter((actor) => actor.teamId === period.teamId).map((actor) => actor._id));
  period.events = result.events.filter((event) => event.at?.sec >= period.start && event.at.sec <= period.end
    && teamIds.has(event.who) && ['move', 'craft', 'field_resource', 'resource_replan'].includes(event.kind));
}
console.log(JSON.stringify({ seed, engineVersion: SIMULATION_ENGINE_VERSION, periods: selected,
  unfinished, evidence: result.evidence,
  scope: 'diagnostic only; real fixture traces, not evaluator reproduction or a success threshold' }));
