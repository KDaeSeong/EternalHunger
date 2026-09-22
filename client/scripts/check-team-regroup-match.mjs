import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { describeTeamRegroupDecision } = await import('../src/app/simulation/_lib/teamRegroupRuntime.js');
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const { buildBaseZoneGraph, buildHyperloopZoneGraph } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['1101', '2202', '3303'];
for (const seed of seeds) {
  const input = await createRandomIsolationInput(seed), fixture = JSON.parse(input);
  const graph = buildHyperloopZoneGraph(buildBaseZoneGraph(fixture.map, fixture.map.zones), fixture.map.zones,
    fixture.map.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId));
  const checkedStatuses = new Set();
  const isolation = createTeamIsolationTracker({ items: fixture.items, zones: fixture.map.zones });
  const equipmentProgress = new Map();
  let inspected = 0, modelChecks = 0;
  const result = await runRandomIsolationMatch(input, { onFrame(frame, { publicItems, events }) {
    for (; inspected < events.length; inspected += 1) {
      const event = events[inspected], evidence = event.regroupEvidence;
      if (!evidence || checkedStatuses.has(evidence.status)) continue;
      const actor = [...frame.survivors, ...frame.dead].find((row) => String(row._id) === String(event.who));
      if (!actor || Number(actor.hp) <= 0) continue;
      const member = buildTeamObserverModel({ ...frame, publicItems, events, teamId: actor.teamId }).members.find((row) => row.id === String(actor._id));
      if (member?.coordination?.sec !== event.at.sec || member.coordination.text !== describeTeamRegroupDecision(evidence)) continue;
      checkedStatuses.add(evidence.status); modelChecks += 1;
    }
    isolation.observe(frame);
    for (const actor of [...frame.survivors, ...frame.dead]) {
      const current = isolation.describe(actor), previous = equipmentProgress.get(String(actor._id));
      equipmentProgress.set(String(actor._id), { who: String(actor._id), name: actor.name,
        bestCompleted: Math.max(previous?.bestCompleted || 0, current.completed), total: current.total,
        firstCompleteSec: previous?.firstCompleteSec ?? (current.total > 0 && current.completed === current.total ? frame.matchSec : null),
        last: current });
    }
  } });
  assert.equal(result.events.at(-1).kind, 'match_end');
  const decisions = result.events.filter((event) => event.regroupEvidence), counts = {};
  assert.ok(decisions.length > 0 && modelChecks > 0);
  for (const event of decisions) {
    const e = event.regroupEvidence;
    assert.equal(e.version, 1); assert.ok(e.hp > 0 && e.memberCount >= 2);
    assert.ok(e.companionsAtTarget >= 0 && e.companionsAtTarget < e.memberCount);
    assert.ok(e.at.sec <= event.at.sec);
    if (e.status === 'joining') { assert.notEqual(e.from, e.to); assert.ok(graph[e.from]?.includes(e.to)); }
    if (e.status === 'arrived') assert.equal(e.to, e.targetZoneId);
    if (e.status === 'growing') assert.ok(e.growth && e.growth.completedSlots < e.growth.totalSlots);
    if (['enemy_path', 'forbidden_path', 'disconnected'].includes(e.status)) assert.equal(e.from, e.to);
    counts[e.status] = (counts[e.status] || 0) + 1;
  }
  assert.ok(counts.arrived > 0, 'This fixture must exercise actual arrival, not only intentions.');
  const periods = isolation.report();
  const isolationEndCounts = {};
  for (const period of [...periods.finished, ...periods.unfinished]) {
    isolationEndCounts[period.endReason] = (isolationEndCounts[period.endReason] || 0) + 1;
  }
  console.log(JSON.stringify({ pass: true, seed, engineVersion: SIMULATION_ENGINE_VERSION,
    decisions: decisions.length, modelChecks, counts,
    isolationEndCounts, longestEndedIsolationPeriods: periods.finished.sort((a, b) => b.duration - a.duration).slice(0, 3),
    unfinishedIsolationPeriods: periods.unfinished, equipmentProgress: [...equipmentProgress.values()],
    evidence: result.evidence,
    scope: 'actual fixture matches, graph steps and observer-model evidence; isolation durations are diagnostics, not original Marcus reproduction or human/balance acceptance' }));
}
