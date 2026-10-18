import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { buildSimulationDiagnostics } = await import('../src/app/simulation/_lib/simulationDiagnostics.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { createSimulationRunInput, compareSimulationReplay, REPLAY_SCHEMA } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildSimulationRunComparison } = await import('../src/app/simulation/_lib/simulationRunComparisonRuntime.js');
const { buildTacticalEffectSummary } = await import('../src/app/simulation/_lib/tacticalEffectEvidenceRuntime.js');
const { buildTacticalImpactEvidence } = await import('./lib/tactical-impact-evidence.mjs');
const { assertFormationRosterConsistency, buildFormationExposure, buildTacticalExposurePair,
  createFormationSwapInput, validateStrategyVariants } = await import('./lib/strategy-comparison-contracts.mjs');
const { createTeamCombatParticipationDiagnostics } = await import('./lib/team-combat-participation-diagnostics.mjs');
const { createMatchDistributionFrameTracker, summarizeGrowthPlanEvents } = await import('./lib/match-distribution-frame-tracker.mjs');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.match(arg, /^--(seeds|output|variants|repeats|roster-seed)=.+$/);
  const split = arg.indexOf('=');
  const key = arg.slice(2, split).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return [key, arg.slice(split + 1)];
}));
assert.ok(options.rosterSeed === undefined || options.rosterSeed.trim().length > 0,
  '--roster-seed must be a non-empty identifier.');
assert.ok(options.rosterSeed === undefined || options.rosterSeed === options.rosterSeed.trim(),
  '--roster-seed must not have leading or trailing whitespace.');
const seeds = (options.seeds || '1101,2202,3303').split(',');
assert.ok(seeds.every(Boolean)); assert.equal(new Set(seeds).size, seeds.length);
const variants = (options.variants || 'baseline,one-tactical-skill,one-formation-swap').split(',');
validateStrategyVariants(variants);
const repeats = Number(options.repeats || 2);
assert.ok(Number.isInteger(repeats) && repeats >= 2 && repeats <= 3, 'Every condition needs at least two exact actual executions.');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rows = [];
const startingInputs = [];
const executions = [];
let completedMatches = 0;
let outputInitialized = false;
const teamOf = actor => String(actor.matchTeamId || actor.teamId);
const resultSummary = (initial, match, growthSummary) => {
  const diagnostics = buildSimulationDiagnostics({ runEvents: match.events, ...match.finalFrame,
    itemMetaById: Object.fromEntries(initial.publicItems.map(item => [String(item._id), item])) });
  const actions = buildRunActionSummary(match.events);
  return { evidence: match.evidence, initialGoalCompletion: growthSummary.initialGoalCompletion,
    growthPlanEvents: growthSummary.growthPlanEvents,
    heroGearReady: diagnostics.equipment.heroGearReadyCount,
    legendaryReady: diagnostics.equipment.legendaryReadyCount,
    emptySlots: diagnostics.equipment.actors.reduce((sum, actor) => sum + 5 - actor.equippedCount, 0),
    equipmentSnapshotScope: 'alive final state and latest death snapshot for finally dead participants',
    emptySlotActors: diagnostics.equipment.actors.filter(actor => actor.equippedCount < 5)
      .map(actor => ({ actorId: actor.id, source: actor.source, equippedCount: actor.equippedCount })),
    team: actions.team, growthActions: actions.growth,
    survival: initial.initialFrame.survivors.map(actor => {
      const death = match.finalFrame.dead.find(row => row._id === actor._id);
      const deathEvent = match.events.find(event => event.kind === 'death' && event.who === actor._id);
      return { actorId: actor._id, teamId: teamOf(actor), aliveAtEnd: !death,
        firstDeathAtSec: deathEvent?.at?.sec ?? null };
    }),
  };
};
const asRecord = (id, input, match) => ({ schema: REPLAY_SCHEMA, id, input,
  events: match.events, finalFrame: match.finalFrame, random: match.evidence.random,
  summary: { ending: match.evidence.ending, winnerTeamName: match.evidence.ending.winnerTeamId } });
const matchesComplete = () => rows.length === seeds.length * variants.length
  && completedMatches === seeds.length * variants.length * repeats;
const comparisonComplete = () => matchesComplete()
  && rows.filter(row => row.variant !== 'baseline').every(row => row.comparisonExposure?.ready === true);
const save = () => {
  if (options.output) writeFileSync(options.output, JSON.stringify({ engineVersion: SIMULATION_ENGINE_VERSION,
    seeds, rosterSeed: options.rosterSeed ?? null, variants, repeats,
    initialRosterSeeds: startingInputs.map(({ seed, initialRosterSeed }) => ({ seed, initialRosterSeed })),
    expectedCases: seeds.length * variants.length, expectedMatches: seeds.length * variants.length * repeats,
    completedMatches, complete: matchesComplete(), comparisonComplete: comparisonComplete(),
    startingInputs, executions, rows,
    scope: 'fresh ordinary full saved inputs and explicit deltas; each condition reruns exactly; tactical-stage facts joined to actual defensive HP hits; not general win-rate, full winner causality, browser, account or human acceptance' }, null, 2),
    { flag: outputInitialized ? 'w' : 'wx' });
  if (options.output) outputInitialized = true;
};
// Fail before spending actual match time on an invalid output path. Never erase
// another run's evidence, and retain each completed execution if a later one fails.
save();

for (const seed of seeds) {
  const fixture = JSON.parse(await createRandomIsolationInput(seed,
    options.rosterSeed === undefined ? {} : { initialRosterSeed: options.rosterSeed }));
  const original = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
    publicItems: fixture.items, survivors: fixture.survivors, runSeed: fixture.runSeed }, { getItem: () => null });
  assertFormationRosterConsistency(original);
  const originalDigest = digest(original);
  const formationProbe = variants.includes('one-formation-swap') ? createFormationSwapInput(original) : null;
  const initialRosterSeed = fixture.initialRosterSeed;
  startingInputs.push({ seed, initialRosterSeed, inputDigest: originalDigest, input: original });
  save();
  let baselineRecord;
  for (const variant of variants) {
    assert.ok(variant === 'baseline' || baselineRecord, 'Run the unchanged baseline before its variants.');
    let input = structuredClone(original);
    const changes = [], derivedChanges = [];
    if (variant === 'one-tactical-skill') {
      const actor = input.initialFrame.survivors[0], before = actor.tacticalSkill;
      actor.tacticalSkill = before === '치유의 바람' ? '초월' : '치유의 바람';
      changes.push({ actorId: actor._id, field: 'tacticalSkill', before, after: actor.tacticalSkill });
      const restored = structuredClone(input); restored.initialFrame.survivors[0].tacticalSkill = before;
      assert.deepEqual(restored, original, 'Only this one tactical value may differ in the full saved input.');
    }
    if (variant === 'one-formation-swap') {
      const formation = createFormationSwapInput(original);
      input = formation.input; changes.push(...formation.changes); derivedChanges.push(...formation.derivedChanges);
    }
    const before = digest(input);
    const trackedActors = variant === 'baseline' ? [input.initialFrame.survivors[0]._id] : changes.map(change => change.actorId);
    let match;
    const replays = [];
    const growthSummaries = [];
    for (let execution = 1; execution <= repeats; execution += 1) {
      console.log(`STRATEGY_COMPARISON_START ${JSON.stringify({ seed, initialRosterSeed, variant, execution, repeats, inputDigest: before, changes })}`);
      let lastCheckpoint = -1;
      // Keep the first execution diagnostic-free and compare the exact second
      // execution with observation enabled. Diagnostics never affect acceptance.
      const participation = formationProbe && variant !== 'one-tactical-skill' && execution > 1
        ? createTeamCombatParticipationDiagnostics({ roster: input.initialFrame.survivors,
          actorIds: formationProbe.changes.map(change => change.actorId),
          comparisonRoster: (variant === 'baseline' ? formationProbe.input : original).initialFrame.survivors }) : null;
      const rules = getRuleset(input.settings.rulesetId);
      const growthTracker = createMatchDistributionFrameTracker({ initialActors: input.initialFrame.survivors,
        items: input.publicItems,
        firstDayDeadlineSec: getPhaseDurationSec(rules, 1, 'morning') + getPhaseDurationSec(rules, 1, 'night') });
      const current = await runRandomIsolationMatch('', { phaseOnly: true, savedInput: input,
        onCombatDiagnostic: participation?.observe, onFrame(frame) {
        growthTracker.observe(frame);
        const checkpoint = Math.floor(frame.matchSec / 120);
        if (checkpoint !== lastCheckpoint) {
          lastCheckpoint = checkpoint;
          console.log(`STRATEGY_COMPARISON_PROGRESS ${JSON.stringify({ seed, variant, execution,
            matchSec: frame.matchSec, alive: frame.survivors.length })}`);
        }
      } });
      const growthSummary = { initialGoalCompletion: growthTracker.report().growth,
        growthPlanEvents: summarizeGrowthPlanEvents(current.events) };
      if (growthSummaries.length) assert.deepEqual(growthSummary, growthSummaries[0],
        'Same-condition actual executions must have identical frame-tracked growth and plan-event summaries.');
      growthSummaries.push(growthSummary);
      completedMatches += 1;
      const exact = match ? compareSimulationReplay(asRecord('expected', input, match), asRecord('actual', input, current)) : null;
      const replay = { execution, evidence: current.evidence, finalDigest: digest(current.finalFrame),
        logDigest: digest(current.logs), exact, verified: false,
        participationDiagnostics: participation ? { ...participation.summary(),
          scope: 'Bounded current runtime facts only; no missed-turn causality or comparison acceptance.',
          comparedAgainstDiagnosticFreeExecution: Boolean(exact?.matched) } : null };
      const observation = { seed, initialRosterSeed, variant, inputDigest: before, changes, growthSummary, ...replay };
      replays.push(replay); executions.push(observation); save();
      if (match) {
        assert.equal(exact.matched, true, 'This actual condition must replay exactly.');
        assert.deepEqual(current.evidence, match.evidence, 'Every frame digest/count, ending and RNG must match.');
        assert.deepEqual(current.events, match.events); assert.deepEqual(current.finalFrame, match.finalFrame);
        assert.deepEqual(current.logs, match.logs, 'Every actual log must also match.');
      } else match = current;
      assert.equal(digest(input), before); assert.equal(digest(original), originalDigest);
      replay.verified = true; observation.verified = true;
      save();
      console.log(`STRATEGY_COMPARISON_EXECUTION ${JSON.stringify({ seed, variant, execution,
        events: current.evidence.eventCount, frames: current.evidence.frames, exact: execution === 1 ? null : true })}`);
    }
    assert.equal(digest(input), before); assert.equal(digest(original), originalDigest);
    const record = asRecord(`${seed}:${variant}`, input, match);
    if (variant === 'baseline') baselineRecord = record;
    const comparison = variant === 'baseline' ? null : buildSimulationRunComparison(baselineRecord, record);
    if (variant === 'one-tactical-skill') {
      assert.equal(comparison.sameSeed, true); assert.equal(comparison.inputChangeCount, 1);
      assert.deepEqual(comparison.actorChanges.map(change => change.key), ['tacticalSkill']);
    }
    const tacticalImpacts = buildTacticalImpactEvidence(match.events, { actorIds: trackedActors });
    assert.equal(tacticalImpacts.unmatched.length, 0, 'Every activated defense must reach its real HP damage record.');
    assert.equal(tacticalImpacts.defenses, tacticalImpacts.matchedDefenses);
    let comparisonExposure = null;
    if (variant === 'one-tactical-skill') {
      const actorId = changes[0].actorId;
      comparisonExposure = buildTacticalExposurePair(baselineRecord.events,
        baselineRecord.input.initialFrame.survivors.find(actor => actor._id === actorId), match.events,
        input.initialFrame.survivors.find(actor => actor._id === actorId));
      assert.equal(comparisonExposure.baseline.configuredSkill, changes[0].before);
      assert.equal(comparisonExposure.candidate.configuredSkill, changes[0].after);
    } else if (variant === 'one-formation-swap') {
      const baseline = buildFormationExposure(baselineRecord.events, baselineRecord.input.initialFrame.survivors, trackedActors,
        input.initialFrame.survivors);
      const candidate = buildFormationExposure(match.events, input.initialFrame.survivors, trackedActors,
        baselineRecord.input.initialFrame.survivors);
      comparisonExposure = { baseline, candidate, ready: baseline.ready && candidate.ready,
        scope: 'Consistent formation inputs and actual changed-teammate team actions on both sides; not ally action, survival contribution or winner causality.' };
    }
    const row = { seed, initialRosterSeed, variant, inputDigest: before, changes, derivedChanges, replays, comparison, comparisonExposure, tacticalImpacts,
      trackedActors: input.initialFrame.survivors.filter(actor => trackedActors.includes(actor._id)).map(actor => ({
        actorId: actor._id, actorName: actor.name, teamId: teamOf(actor), tacticalSkill: actor.tacticalSkill,
        startingTeamMembers: input.initialFrame.survivors.filter(other => teamOf(other) === teamOf(actor)).map(other => other._id),
        effects: buildTacticalEffectSummary(match.events, actor._id),
      })), ...resultSummary(input, match, growthSummaries[0]),
      sharedPurchaseIntentions: match.events.filter(event => event.reason === 'team_rotate'
        && /키오스크|구매|교환|kiosk/.test(event.sharedGoalReason || '')).length };
    rows.push(row); save();
    console.log(`STRATEGY_COMPARISON_CASE ${JSON.stringify({ seed, initialRosterSeed, variant,
      endingSec: row.evidence.ending.atSec, winnerTeamId: row.evidence.ending.winnerTeamId,
      initialGoalCompletion: row.initialGoalCompletion.complete,
      growthPlanSlotCompleteEvents: row.growthPlanEvents.slotCompleteEvents, emptySlots: row.emptySlots })}`);
  }
}
console.log(`STRATEGY_COMPARISON_RESULT ${JSON.stringify({ pass: comparisonComplete(), matchesComplete: matchesComplete(), engineVersion: SIMULATION_ENGINE_VERSION,
  rosterSeed: options.rosterSeed ?? null,
  initialRosterSeeds: startingInputs.map(({ seed, initialRosterSeed }) => ({ seed, initialRosterSeed })),
  matches: completedMatches, cases: rows.length, repeats, variants, seeds,
  scope: 'fresh full input, exact reruns per condition, explicit tactical-stage and committed HP evidence; no injected resources or manufactured winner; no broad causal balance acceptance' })}`);
if (!comparisonComplete()) {
  console.error('Actual matches completed, but at least one changed condition lacked observed comparison exposure. Retain the zero-exposure case; do not count it as strategy acceptance.');
  process.exitCode = 2;
}
