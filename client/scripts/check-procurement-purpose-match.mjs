import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const workerMode = process.argv[2] === '--worker' ? process.argv[3] : '';
const queueURL = new URL('../src/app/simulation/_lib/phaseActionQueueDecisionRuntime.js', import.meta.url).href;

function baselineQueueSource(source) {
  const start = source.indexOf('  const procurementActionKey = isProcurementAction(queuedActionType)');
  const end = source.indexOf('  const queuePreview =', start);
  assert.ok(start >= 0 && end > start, 'The current source must contain the one personal-purpose block.');
  const emission = '      actionKey: procurementActionKey,\n      procurementPurpose,';
  assert.equal(source.split(emission).length, 2, 'Do not disable a different or duplicate event path.');
  return (source.slice(0, start) + source.slice(end))
    .replace(emission, "      actionKey: ['kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder'].includes(queuedActionType)\n        ? getProcurementActionKey(updated, phaseIdxNow) : '',")
    .replace("import { getGrowthRecipeWork } from './growthPlanRuntime.js';\n", '')
    .replace("import { buildProcurementPurpose, isProcurementAction } from './procurementPurposeRuntime.js';\n", '');
}

if (workerMode) {
  assert.ok(['baseline', 'current'].includes(workerMode));
  if (workerMode === 'baseline') registerHooks({ load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== queueURL) return loaded;
    return { ...loaded, source: baselineQueueSource(readFileSync(new URL(url), 'utf8').replaceAll('\r\n', '\n')) };
  } });
  const input = readFileSync(0, 'utf8');
  const { runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { describeProcurementPurpose } = await import('../src/app/simulation/_lib/procurementPurposeRuntime.js');
  const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
  const initial = JSON.parse(input);
  const actorNames = new Map(initial.survivors.map(actor => [actor._id, actor.name]));
  let seenEvents = 0, matchedReceipts = 0, receiptEvents = 0;
  const purposeSamples = [];
  const run = await runRandomIsolationMatch(input, { onFrame(frame, { events, publicItems }) {
    const receipts = new Map();
    for (const event of events.slice(seenEvents)) {
      if (event.kind === 'procurement') {
        assert.ok(!receipts.has(event.who), 'No earlier receipt may be hidden by a later receipt for this actor in one frame.');
        receipts.set(event.who, event);
        receiptEvents += 1;
      }
      if (Object.hasOwn(event, 'procurementPurpose')) {
        assert.equal(workerMode, 'current', 'The metadata-free baseline cannot retain a purpose field.');
        assert.equal(event.kind, 'queue', 'Only queue explanation metadata may differ between the two runs.');
        const purpose = describeProcurementPurpose(event);
        assert.ok(purpose, 'Every new personal purpose must match the actual selected action identity.');
        if (event.sharedGoalReason && purposeSamples.length < 6) purposeSamples.push({
          atSec: event.at.sec, who: event.who, actorName: actorNames.get(event.who),
          itemId: event.itemId, actionKey: event.actionKey, personalPurpose: event.procurementPurpose,
          personalText: purpose, teamMovementReason: event.sharedGoalReason });
      }
    }
    for (const event of receipts.values()) {
      const actor = [...frame.survivors, ...frame.dead].find(row => row._id === event.who);
      assert.ok(actor);
      const beforeFrame = digest(frame), beforeEvents = digest(events);
      const card = buildTeamObserverModel({ ...frame, events, publicItems, teamId: actor.teamId,
        settings: initial.settings, forbiddenIds: frame.forbiddenZoneIds }).members.find(row => row.id === event.who)?.procurement;
      assert.equal(card?.matchedChoice, true, 'Real receipts must match their actual selected order, not another actor.');
      assert.equal(card.actionKey, event.actionKey);
      assert.equal(card.itemId, event.itemId);
      assert.equal(card.outcome, event.outcome);
      if (workerMode === 'current') assert.ok(card.purpose, 'The matched card must retain its selected personal purpose.');
      assert.equal(digest(frame), beforeFrame, 'Observation cannot rewrite actual state.');
      assert.equal(digest(events), beforeEvents, 'Observation cannot rewrite the journal.');
      matchedReceipts += 1;
    }
    seenEvents = events.length;
  } });
  assert.equal(receiptEvents, run.events.filter(event => event.kind === 'procurement').length,
    'Every emitted receipt must reach an observed frame, including the match ending boundary.');
  assert.equal(matchedReceipts, receiptEvents, 'Every emitted receipt must have its actual observer connection checked.');
  const projectedEvents = run.events.map(event => {
    if (!Object.hasOwn(event, 'procurementPurpose')) return event;
    assert.equal(event.kind, 'queue', 'Do not hide a purpose field on a non-queue event in the comparison.');
    const { procurementPurpose: _personalPurpose, ...gameplayEvent } = event;
    return gameplayEvent;
  });
  const queuePurposes = run.events.filter(event => event.kind === 'queue' && event.procurementPurpose);
  const result = { mode: workerMode, evidence: run.evidence, finalFrame: run.finalFrame,
    projectedEventDigest: digest(projectedEvents), logDigest: digest(run.logs), matchedReceipts, receiptEvents,
    personalQueues: queuePurposes.length,
    recipeQueues: queuePurposes.filter(event => event.procurementPurpose.kind === 'recipe_material').length,
    purposeSamples };
  process.stdout.write(JSON.stringify(result));
} else {
  const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
  const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
  const input = await createRandomIsolationInput('1101', { initialRosterSeed: 'FIXTURE:initial-roster' });
  const runWorker = mode => {
    console.log(`PROCUREMENT_PURPOSE_MATCH_START ${mode}`);
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', mode], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), input, encoding: 'utf8', windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, `${mode} worker must actually finish: ${child.stderr}`);
    const result = JSON.parse(child.stdout);
    console.log(`PROCUREMENT_PURPOSE_MATCH_FINISHED ${JSON.stringify({ mode, frames: result.evidence.frames,
      events: result.evidence.eventCount, personalQueues: result.personalQueues })}`);
    return result;
  };
  // Fresh current-source baseline, then candidate, with the same ordinary
  // input. No historic result file, paid service or edited outcome is used.
  const baseline = runWorker('baseline');
  const current = runWorker('current');
  assert.equal(current.evidence.frameDigest, baseline.evidence.frameDigest);
  assert.equal(current.projectedEventDigest, baseline.projectedEventDigest);
  assert.equal(current.logDigest, baseline.logDigest);
  assert.deepEqual(current.finalFrame, baseline.finalFrame);
  assert.deepEqual(current.evidence.random, baseline.evidence.random);
  assert.deepEqual(current.evidence.ending, baseline.evidence.ending);
  assert.equal(current.evidence.eventCount, baseline.evidence.eventCount);
  assert.equal(baseline.personalQueues, 0);
  assert.ok(current.personalQueues > 0 && current.recipeQueues > 0 && current.purposeSamples.length > 0,
    'This fixed natural input must actually exercise personal recipe purposes and shared movement context.');
  console.log(`PROCUREMENT_PURPOSE_MATCH ${JSON.stringify({ pass: true, engineVersion: SIMULATION_ENGINE_VERSION,
    inputDigest: createHash('sha256').update(input).digest('hex'), seed: '1101', initialRosterSeed: 'FIXTURE:initial-roster',
    baselineSource: 'current queue source with only the exact new explanation block and metadata removed in memory',
    phases: current.evidence.phases, frames: current.evidence.frames, eventCount: current.evidence.eventCount,
    ending: current.evidence.ending, random: current.evidence.random,
    frameDigest: current.evidence.frameDigest, projectedEventDigest: current.projectedEventDigest,
    baselineRawEventDigest: baseline.evidence.eventDigest, currentRawEventDigest: current.evidence.eventDigest,
    logDigest: current.logDigest, matchedReceipts: current.matchedReceipts, receiptEvents: current.receiptEvents,
    queueOnlyPurposeMetadata: true, oneReceiptPerActorFrame: true, everyReceiptObserved: true,
    personalQueues: current.personalQueues, recipeQueues: current.recipeQueues, purposeSamples: current.purposeSamples,
    finalStateExact: true, allFramesExact: true, projectedEventsExact: true, logsExact: true, randomExact: true,
    scope: 'fresh ordinary guest input, metadata-free current-source baseline and candidate; real natural order/receipt/observer coverage and unchanged gameplay; not causal designated shared procurement, all custom inputs, browser timing/rendering, account storage, fun or full gate' })}`);
}
