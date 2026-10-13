import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildIsolationNavigation, createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { describeTeamRegroupDecision } = await import('../src/app/simulation/_lib/teamRegroupRuntime.js');
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const { createMatchDistributionFrameTracker } = await import('./lib/match-distribution-frame-tracker.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const args = process.argv.slice(2);
assert.ok(args.every(arg => !arg.startsWith('--') || arg.startsWith('--roster-seed=')
  || arg === '--summary-only' || arg === '--compare-observer'), 'Unknown regroup check option.');
const summaryOnly = args.includes('--summary-only');
const compareObserver = args.includes('--compare-observer');
const rosterArgs = args.filter(arg => arg.startsWith('--roster-seed='));
assert.ok(rosterArgs.length <= 1, 'Specify only one initial roster seed.');
const initialRosterSeed = rosterArgs[0]?.slice('--roster-seed='.length) ?? 'FIXTURE:initial-roster';
assert.ok(initialRosterSeed.trim(), 'The initial roster seed must not be empty.');
const requestedSeeds = args.filter(arg => !arg.startsWith('--'));
const seeds = requestedSeeds.length ? requestedSeeds : ['1101', '2202', '3303'];
assert.ok(seeds.every(seed => seed.trim()) && new Set(seeds).size === seeds.length, 'Match seeds must be nonempty and unique.');
for (const seed of seeds) {
  const input = await createRandomIsolationInput(seed, { initialRosterSeed }), fixture = JSON.parse(input);
  const { zoneGraph: graph } = buildIsolationNavigation(fixture.map);
  const checkedStatuses = new Set();
  const isolation = createTeamIsolationTracker({ items: fixture.items, zones: fixture.map.zones });
  // Reuse the fixed-attempt membership metric. An arrival or pair contact does
  // not prove that every member alive at the start of that attempt reunited.
  const distribution = createMatchDistributionFrameTracker({ initialActors: fixture.survivors, items: fixture.items });
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
    distribution.observe(frame);
    for (const actor of [...frame.survivors, ...frame.dead]) {
      const current = isolation.describe(actor), previous = equipmentProgress.get(String(actor._id));
      equipmentProgress.set(String(actor._id), { who: String(actor._id), name: actor.name,
        bestCompleted: Math.max(previous?.bestCompleted || 0, current.completed), total: current.total,
        firstCompleteSec: previous?.firstCompleteSec ?? (current.total > 0 && current.completed === current.total ? frame.matchSec : null),
        last: current });
    }
  } });
  const observerComparison = compareObserver && seed === seeds[0];
  if (observerComparison) {
    const plain = await runRandomIsolationMatch(input);
    assert.deepEqual(result.evidence, plain.evidence, 'Regroup diagnostics cannot change events, frames, ending or RNG.');
    assert.deepEqual(result.finalFrame, plain.finalFrame, 'Regroup diagnostics cannot change the final state.');
    assert.deepEqual(result.events, plain.events, 'Regroup diagnostics cannot change any committed event.');
  }
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
    if (e.status === 'rotation_wait') {
      assert.equal(e.from, e.to);
      assert.equal(e.companionsAtTarget, e.memberCount - 1);
      assert.ok(e.waitingFor.length > 0);
      assert.ok(e.waitingFor.every((row) => row.who && row.name && row.reason));
    }
    if (['enemy_path', 'forbidden_path', 'disconnected'].includes(e.status)) assert.equal(e.from, e.to);
    if (e.rallySelection) {
      assert.equal(e.rallySelection.reason, 'reachable_rendezvous');
      assert.ok(e.rallySelection.reachableCount > e.rallySelection.previousReachableCount);
      assert.ok(e.rallySelection.reachableCount <= e.memberCount);
      assert.notEqual(e.targetZoneId, e.rallySelection.previousZoneId);
    }
    counts[e.status] = (counts[e.status] || 0) + 1;
  }
  assert.ok(counts.arrived > 0, 'This fixture must exercise actual arrival, not only intentions.');
  const regroup = distribution.report().regroup;
  assert.equal(regroup.started, Object.values(regroup.outcomes).reduce((sum, count) => sum + count, 0),
    'Every started attempt, including failed and unfinished attempts, must remain in the denominator.');
  assert.equal(regroup.completed, regroup.episodes.filter(episode => episode.outcome === 'completed').length);
  for (const episode of regroup.episodes) {
    assert.ok(episode.memberIds.length >= 2 && new Set(episode.memberIds).size === episode.memberIds.length,
      'An attempt must retain its complete, unique starting living membership.');
    assert.ok(episode.durationSec >= 0);
  }
  const regroupSummary = { started: regroup.started, completed: regroup.completed, completionShare: regroup.completionShare,
    outcomes: regroup.outcomes, maxDurationSec: Math.max(0, ...regroup.episodes.map(episode => episode.durationSec)),
    scope: `${regroup.scope} Completion means same region, not within-region spatial clustering or survival causality.` };
  const strikes = result.events.filter(event => event.kind === 'team_strike' && Number(event.damage) > 0);
  const sameClockTargets = new Map();
  for (const event of strikes) {
    const key = JSON.stringify([event.at.sec, event.zoneId, event.teamId, event.targetId]);
    if (!sameClockTargets.has(key)) sameClockTargets.set(key, new Set());
    sameClockTargets.get(key).add(event.who);
  }
  const teamCombat = { positiveHpStrikes: strikes.length,
    focusFireStrikes: strikes.filter(event => event.reason === 'focus_fire').length,
    sameClockMultiActorTargets: [...sameClockTargets.values()].filter(ids => ids.size > 1).length,
    scope: 'Committed positive HP loss and multiple allies hitting one target at the same match time. Not a counterfactual survival benefit or a winner-causality metric.' };
  const evidence = summaryOnly ? { ...result.evidence, ending: {
    outcome: result.evidence.ending.outcome, atSec: result.evidence.ending.atSec,
    winnerTeamId: result.evidence.ending.winnerTeamId, cause: result.evidence.ending.cause,
  } } : result.evidence;
  const periods = isolation.report();
  const isolationEndCounts = {};
  for (const period of [...periods.finished, ...periods.unfinished]) {
    isolationEndCounts[period.endReason] = (isolationEndCounts[period.endReason] || 0) + 1;
  }
  console.log(JSON.stringify({ pass: true, seed, initialRosterSeed, engineVersion: SIMULATION_ENGINE_VERSION,
    observerComparison: observerComparison ? 'exact_events_frames_final_rng' : 'not_requested',
    hyperloopZones: buildIsolationNavigation(fixture.map).loops,
    ...(!summaryOnly ? { teams: fixture.survivors.map(actor => ({ id: actor._id, name: actor.name, team: actor.teamId })),
      reachableRendezvousEvents: decisions.filter(event => event.regroupEvidence.rallySelection).map(event => ({
      at: event.at, who: event.who, teamId: event.regroupEvidence.teamId, status: event.regroupEvidence.status,
      targetZoneId: event.regroupEvidence.targetZoneId, selection: event.regroupEvidence.rallySelection })) } : {}),
    decisions: decisions.length, modelChecks, counts,
    regroup: summaryOnly ? regroupSummary : regroup,
    teamCombat,
    isolationEndCounts,
    ...(!summaryOnly ? { longestEndedIsolationPeriods: periods.finished.sort((a, b) => b.duration - a.duration).slice(0, 3),
      unfinishedIsolationPeriods: periods.unfinished, equipmentProgress: [...equipmentProgress.values()] } : {}),
    evidence,
    scope: 'Fresh natural default-world matches, graph steps and observer-model evidence. Full fixed-attempt regroup outcomes are separate from per-actor contact. Neither metric proves original Marcus reproduction, human/balance acceptance or survival causality.' }));
}
