import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildIsolationNavigation, createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Read-only diagnosis of real engine frames. An isolation period ends on
// contact, death, a space change, or loss of all living teammates; none of
// those endings is silently counted as a successful regroup.
const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const seed = args[0] || '2202';
const initialRosterSeed = args[1] || 'FIXTURE:initial-roster';
const compact = process.argv.includes('--compact');
const input = await createRandomIsolationInput(seed, { initialRosterSeed });
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
const compactPeriod = ({ snapshots, events, ...period }) => ({ ...period,
  snapshots: snapshots.map(({ sec, actor, allies }) => ({ sec,
    actor: { zone: actor.zone, hp: actor.hp, progress: `${actor.completed}/${actor.total}`, target: actor.target,
      growthZone: actor.growthZone, blocked: actor.blocked, readyCraft: actor.readyCraft,
      regroup: actor.regroup, rally: actor.rally, action: actor.action, readyAt: actor.growthReadyAt },
    allies: allies.map(ally => ({ name: ally.name, zone: ally.zone, progress: `${ally.completed}/${ally.total}`, regroup: ally.regroup })) })),
  events: events.map(event => ({ sec: event.at.sec, kind: event.kind, who: event.who,
    from: event.from, to: event.to, reason: event.reason, itemId: event.itemId, name: event.name })) });
console.log(JSON.stringify({ seed, initialRosterSeed, engineVersion: SIMULATION_ENGINE_VERSION,
  hyperloopZones: buildIsolationNavigation(fixture.map).loops,
  teams: fixture.survivors.map(actor => ({ id: actor._id, name: actor.name, team: actor.teamId, zone: actor.zoneId })),
  periods: compact ? selected.map(compactPeriod) : selected,
  unfinished, evidence: result.evidence,
  scope: 'diagnostic only; real fixture traces, not evaluator reproduction or a success threshold' }));
