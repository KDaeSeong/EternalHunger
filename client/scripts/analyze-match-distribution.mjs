import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { summarizeTeamRetreats } from './lib/match-distribution-diagnostics.mjs';
import { summarizeMovementReversalTrace } from './lib/movement-reversal-trace.mjs';

// Load production-dependent diagnostics only after extensionless-module hooks.
const { createMatchDistributionFrameTracker, summarizeMovement } = await import('./lib/match-distribution-frame-tracker.mjs');
const { buildSimulationDiagnostics } = await import('../src/app/simulation/_lib/simulationDiagnostics.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const args = process.argv.slice(2);
assert.ok(args.every((arg) => !arg.startsWith('--') || arg.startsWith('--rosters=') || /^--compare-observer(?:=.+)?$/.test(arg)
  || arg === '--trace-movement'),
  'Only --rosters=<comma-separated initial roster seeds>, --compare-observer[=<match seed>] and --trace-movement are supported.');
assert.ok(args.filter((arg) => arg === '--trace-movement').length <= 1, 'Specify --trace-movement only once.');
const traceMovement = args.includes('--trace-movement');
const comparisonArgs = args.filter((arg) => arg.startsWith('--compare-observer'));
assert.ok(comparisonArgs.length <= 1, 'Specify --compare-observer only once.');
const comparisonSeed = comparisonArgs[0]?.split('=')[1] || null;
const rosterArgs = args.filter((arg) => arg.startsWith('--rosters='));
assert.ok(rosterArgs.length <= 1, 'Specify --rosters only once.');
const initialRosterSeeds = rosterArgs.length ? rosterArgs[0].slice('--rosters='.length).split(',') : ['FIXTURE:initial-roster'];
assert.ok(initialRosterSeeds.every((seed) => seed.trim()) && new Set(initialRosterSeeds).size === initialRosterSeeds.length,
  'Initial roster seeds must be nonempty and unique.');
const requestedSeeds = args.filter((arg) => !arg.startsWith('--')).map(String).filter(Boolean);
const seeds = requestedSeeds.length ? requestedSeeds : ['1101', '1102', '1103'];
assert.equal(new Set(seeds).size, seeds.length, 'Match seeds must be unique.');
assert.ok(!comparisonSeed || seeds.includes(comparisonSeed), 'The comparison seed must be one of the requested matches.');
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function ratio(part, total) {
  return total > 0 ? Math.round(part / total * 1000) / 1000 : 0;
}

function summarizeHunts(events) {
  const starts = events.filter((event) => event?.kind === 'hunt_start');
  const ends = events.filter((event) => event?.kind === 'hunt_end');
  const settlements = events.filter((event) => event?.kind === 'hunt_settlement');
  const outcomes = {};
  for (const event of ends) {
    const key = String(event?.outcome || 'unknown');
    outcomes[key] = (outcomes[key] || 0) + 1;
  }
  const idsOf = (rows) => rows.map((event) => String(event.encounterId || '')).filter(Boolean);
  const startIdList = idsOf(starts);
  const endIdList = idsOf(ends);
  const settlementIdList = idsOf(settlements);
  const startIds = new Set(startIdList);
  const endIds = new Set(endIdList);
  const settlementIds = new Set(settlementIdList);
  assert.equal(startIdList.length, starts.length, 'Every hunt_start must carry an encounterId.');
  assert.equal(endIdList.length, ends.length, 'Every hunt_end must carry an encounterId.');
  assert.equal(settlementIdList.length, settlements.length, 'Every hunt_settlement must carry an encounterId.');
  assert.equal(startIds.size, starts.length, 'Each encounter may emit hunt_start only once.');
  assert.equal(endIds.size, ends.length, 'Each encounter may emit hunt_end only once.');
  assert.equal(settlementIds.size, settlements.length, 'Each encounter may settle only once.');
  assert.deepEqual([...endIds].filter((id) => !startIds.has(id)), [], 'hunt_end must reference a started encounter.');
  assert.deepEqual([...settlementIds].filter((id) => !startIds.has(id)), [], 'hunt_settlement must reference a started encounter.');
  const expectedSettlementIds = new Set(ends.filter((event) => ['victory', 'hunter_defeated'].includes(String(event?.outcome || '')))
    .map((event) => String(event.encounterId || '')).filter(Boolean));
  assert.deepEqual([...settlementIds].sort(), [...expectedSettlementIds].sort(),
    'Only completed victories and hunter defeats settle, exactly once.');
  const unfinished = [...startIds].filter((id) => !endIds.has(id));
  assert.deepEqual(unfinished, [], 'Every started hunt must end before the match snapshot closes.');
  return {
    starts: starts.length,
    ends: ends.length,
    settlements: settlements.length,
    outcomes,
    unfinished: unfinished.length,
    integrity: 'pass',
  };
}

function summarizeGrowth(events, participantCount) {
  const completeIds = new Set(events.filter((event) => event?.kind === 'growth_plan'
    && Number(event.totalSlots || 0) > 0 && Number(event.completedSlots || 0) === Number(event.totalSlots || 0))
    .map((event) => String(event.who || '')).filter(Boolean));
  const crafts = events.filter((event) => event?.kind === 'craft').length;
  return { complete: completeIds.size, total: participantCount, completeShare: ratio(completeIds.size, participantCount), crafts };
}

function summarizeEquipment(equipment) {
  const actors = Array.isArray(equipment?.actors) ? equipment.actors : [];
  const tierCounts = equipment?.tierCounts || {};
  const tierParts = [1, 2, 3, 4, 5, 6].reduce((sum, tier) => sum + Number(tierCounts[`t${tier}`] || 0), 0);
  const tierScore = [1, 2, 3, 4, 5, 6].reduce((sum, tier) => sum + tier * Number(tierCounts[`t${tier}`] || 0), 0);
  return {
    totalEquipped: Number(equipment?.totalEquipped || 0),
    fullLoadouts: actors.filter((actor) => Number(actor?.equippedCount || 0) >= 5).length,
    heroParts: actors.reduce((sum, actor) => sum + Number(actor?.heroOrBetter || 0), 0),
    legendaryParts: actors.reduce((sum, actor) => sum + Number(actor?.legendOrBetter || 0), 0),
    averageTier: tierParts ? Math.round(tierScore / tierParts * 1000) / 1000 : 0,
    tierCounts,
  };
}

const rows = [];
const initialBuilds = new Map();
let baselineCatalogDigest, baselineMapSettingsDigest;
for (const initialRosterSeed of initialRosterSeeds) for (const seed of seeds) {
  console.log(`MATCH_DISTRIBUTION_START ${JSON.stringify({ seed, initialRosterSeed, engineVersion: SIMULATION_ENGINE_VERSION })}`);
  const input = await createRandomIsolationInput(seed, { initialRosterSeed });
  const initial = JSON.parse(input);
  const catalogDigest = digest(initial.items), mapSettingsDigest = digest({ map: initial.map, settings: initial.settings });
  baselineCatalogDigest ??= catalogDigest; baselineMapSettingsDigest ??= mapSettingsDigest;
  assert.equal(catalogDigest, baselineCatalogDigest, 'All input-axis cases keep the actual catalogue unchanged.');
  assert.equal(mapSettingsDigest, baselineMapSettingsDigest, 'All input-axis cases keep the actual map/rules/settings unchanged.');
  const initialBuildDigest = digest(initial.survivors);
  if (initialBuilds.has(initialRosterSeed)) assert.equal(initialBuildDigest, initialBuilds.get(initialRosterSeed),
    'Changing only the match RNG seed cannot change the initial actor build.');
  initialBuilds.set(initialRosterSeed, initialBuildDigest);
  const rules = getRuleset(initial.settings.rulesetId);
  const tracker = createMatchDistributionFrameTracker({ initialActors: initial.survivors, items: initial.items,
    firstDayDeadlineSec: getPhaseDurationSec(rules, 1, 'morning') + getPhaseDurationSec(rules, 1, 'night') });
  const match = await runRandomIsolationMatch(input, { phaseOnly: true, onFrame: tracker.observe });
  const observed = tracker.report();
  const movement = summarizeMovement(initial.survivors, match.events);
  const movementTrace = traceMovement ? summarizeMovementReversalTrace(initial.survivors, match.events,
    { maxRotationSamples: 24, maxExplicitOutnumberedSamples: 8, maxContextEvents: 20 }) : null;
  if (movementTrace) {
    assert.equal(digest(initial), digest(JSON.parse(input)), 'Event tracing cannot mutate the actual fresh match input.');
    assert.equal(digest(match.events), match.evidence.eventDigest, 'Event tracing cannot mutate the real event stream.');
    assert.equal(movementTrace.counts.teamRotate.total, movement.reversalPairs['team_rotate->team_rotate'] || 0,
      'Detailed team rotation traces and the nonzero-edge baseline must count the same actual reversals.');
  }
  const compareObserver = comparisonArgs.length > 0 && (!comparisonSeed || seed === comparisonSeed);
  if (compareObserver) {
    console.log(`MATCH_DISTRIBUTION_OBSERVED ${JSON.stringify({ seed, initialRosterSeed,
      frames: match.evidence.frames, events: match.evidence.eventCount, eventDigest: match.evidence.eventDigest,
      frameDigest: match.evidence.frameDigest })}`);
    const plain = await runRandomIsolationMatch(input, { phaseOnly: true });
    assert.deepEqual(plain.evidence, match.evidence, 'Measurement cannot change events, frames, ending or RNG.');
    assert.deepEqual(plain.finalFrame, match.finalFrame, 'Measurement cannot change the final published state.');
    assert.deepEqual(plain.events, match.events, 'Measurement cannot alter any real event.');
  }
  const frame = match.finalFrame || {};
  const diagnostics = buildSimulationDiagnostics({
    runEvents: match.events,
    survivors: frame.survivors,
    dead: frame.dead,
    itemMetaById: Object.fromEntries((initial.items || []).map((item) => [String(item._id || ''), item])),
  });
  const actions = buildRunActionSummary(match.events);
  const row = {
    seed,
    initialRosterSeed,
    observerComparison: compareObserver ? 'pass' : 'not_requested',
    engineVersion: SIMULATION_ENGINE_VERSION,
    inputDigest: digest(initial),
    catalogDigest,
    mapSettingsDigest,
    initialActorSetDigest: digest(initial.survivors.map((actor) => String(actor._id)).sort()),
    initialBuildDigest,
    formationDigest: digest(initial.survivors.map((actor) => [actor._id, actor.teamId, actor.teamSlot, actor.zoneId]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))),
    rulesetId: initial.settings.rulesetId,
    initialAxisScope: 'Initial-roster-build seed may change selection, teams, weapons and route targets; not a positions-only controlled experiment.',
    initialFormation: initial.survivors.map((actor) => ({ actorId: actor._id, teamId: actor.teamId,
      teamSlot: actor.teamSlot, zoneId: actor.zoneId, weaponType: actor.weaponType,
      routePlanTargetItemIds: actor.routePlanTargetItemIds, routePlanZoneIds: actor.routePlanZoneIds, heroGoals: actor.goalLoadouts?.hero || null })),
    phases: match.evidence.phases,
    endingAtSec: match.evidence.ending.atSec,
    outcome: match.evidence.ending.outcome,
    winnerTeamId: match.evidence.ending.winnerTeamId,
    ending: match.evidence.ending,
    endingCauseScope: 'The production ending.cause is its last recorded death cause, not the sole causal explanation of the winner.',
    random: match.evidence.random,
    eventDigest: match.evidence.eventDigest,
    frameDigest: match.evidence.frameDigest,
    frames: match.evidence.frames,
    events: match.events.length,
    participants: diagnostics.participants,
    deaths: diagnostics.deaths,
    heroGearReady: diagnostics.equipment.heroGearReadyCount,
    legendaryReady: diagnostics.equipment.legendaryReadyCount,
    equipment: summarizeEquipment(diagnostics.equipment),
    growth: summarizeGrowth(match.events, diagnostics.participants.total),
    growthTiming: observed.growth,
    actionMix: actions.growth,
    team: actions.team,
    teamRetreats: summarizeTeamRetreats(match.events),
    regroupEpisodes: observed.regroup,
    teamCombat: actions.teamCombat,
    chase: diagnostics.chase,
    resources: actions.fieldResources,
    movement,
    ...(movementTrace ? { movementTrace } : {}),
    hunts: summarizeHunts(match.events),
  };
  rows.push(row);
  console.log(`MATCH_DISTRIBUTION_ROW ${JSON.stringify(row)}`);
}

const total = (pick) => rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0);
const aggregate = {
  seeds,
  initialRosterSeeds,
  engineVersion: SIMULATION_ENGINE_VERSION,
  uniqueInitialBuilds: new Set(rows.map((row) => row.initialBuildDigest)).size,
  uniqueFormations: new Set(rows.map((row) => row.formationDigest)).size,
  uniqueActorSets: new Set(rows.map((row) => row.initialActorSetDigest)).size,
  matches: rows.length,
  endingAtSec: {
    min: Math.min(...rows.map((row) => row.endingAtSec)),
    max: Math.max(...rows.map((row) => row.endingAtSec)),
    avg: Math.round(total((row) => row.endingAtSec) / rows.length * 1000) / 1000,
  },
  deaths: {
    total: total((row) => row.deaths.total),
    pvp: total((row) => row.deaths.pvp),
    wildlife: total((row) => row.deaths.wildlife),
    environment: total((row) => row.deaths.environment),
    opening: total((row) => row.deaths.byBand?.opening),
    early: total((row) => row.deaths.byBand?.early),
    mid: total((row) => row.deaths.byBand?.mid),
    end: total((row) => row.deaths.byBand?.end),
  },
  growthCompleteShare: ratio(total((row) => row.growth.complete), total((row) => row.growth.total)),
  observedGrowthCompleteShare: ratio(total((row) => row.growthTiming.complete), total((row) => row.growthTiming.total)),
  beforeFirstNightEndShare: ratio(total((row) => row.growthTiming.beforeFirstNightEnd), total((row) => row.growthTiming.total)),
  everFiveSlotHeroEquippedShare: ratio(total((row) => row.growthTiming.fiveSlotHeroEquipped), total((row) => row.growthTiming.total)),
  heroGearReadyShare: ratio(total((row) => row.heroGearReady), total((row) => row.participants.total)),
  teamCombatRounds: total((row) => row.teamCombat.rounds),
  regroupMoves: total((row) => row.team.regroupMoves),
  regroupHolds: total((row) => row.team.regroupHolds),
  regroupEpisodes: total((row) => row.regroupEpisodes.started),
  completedRegroupEpisodes: total((row) => row.regroupEpisodes.completed),
  regroupCompletionShare: ratio(total((row) => row.regroupEpisodes.completed), total((row) => row.regroupEpisodes.started)),
  regroupOutcomes: rows.reduce((counts, row) => {
    for (const [outcome, count] of Object.entries(row.regroupEpisodes.outcomes)) counts[outcome] = (counts[outcome] || 0) + count;
    return counts;
  }, {}),
  retreats: total((row) => row.team.retreats),
  teamRetreatEvents: total((row) => row.teamRetreats.total),
  teamRetreatReversals: total((row) => row.teamRetreats.reversals),
  restActions: total((row) => row.actionMix.rest),
  chaseCaughtShare: ratio(total((row) => row.chase.caught), total((row) => row.chase.total)),
  movementReversalShare: ratio(total((row) => row.movement.reversals), total((row) => row.movement.moves)),
  huntStarts: total((row) => row.hunts.starts),
  huntUnfinished: total((row) => row.hunts.unfinished),
  lastDeathCauses: rows.reduce((counts, row) => { const cause = row.ending.cause || 'unknown'; counts[cause] = (counts[cause] || 0) + 1; return counts; }, {}),
  scope: 'Current-source headless natural matches. Seed and initial-roster axes are explicit. Completion/contact metrics are not human, browser-speed or balance acceptance.',
};
console.log(`MATCH_DISTRIBUTION_AGGREGATE ${JSON.stringify(aggregate)}`);
