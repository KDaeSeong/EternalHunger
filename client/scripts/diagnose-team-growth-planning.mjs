import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const { createRandomIsolationInput, runRandomIsolationMatch, buildIsolationNavigation } = await import('./lib/run-random-isolation-match.mjs');
const { cloneMovementRosterForPlanning } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { initializeActorPhaseMovementState } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seed = process.argv[2] || '4407';
const actorId = process.argv[3] || 'guest-survivor-13';
assert.ok(process.argv.length <= 4, 'Use [match seed] [actor ID].');
const input = await createRandomIsolationInput(seed);
const initial = JSON.parse(input), ruleset = getRuleset(initial.settings.rulesetId);
const { zoneGraph } = buildIsolationNavigation(initial.map);
const itemKeyById = buildItemKeyById(initial.items);
const stopAfterPhase = { day: 1, phase: 'night' };
const planSummary = plan => plan && Object.fromEntries(['targetId', 'targetZoneId', 'nextStep', 'stage', 'blocked',
  'readyCraftId', 'currentZoneItemIds', 'missing'].map(key => [key, structuredClone(plan[key])]));
const inventorySummary = actor => actor.inventory.map(item => ({ id: item.itemId || item.id || item._id,
  qty: item.qty, craftComponent: !!item.craftComponent, reserved: !!item._growthReserved, equipped: Object.values(actor.equipped || {}).includes(item.itemId || item.id || item._id) }));
let priorFrame = null, priorEventCount = 0;
const observations = [];
const observed = await runRandomIsolationMatch(input, { phaseOnly: true, stopAfterPhase,
  onFrame(frame, { events }) {
    for (let seq = priorEventCount; seq < events.length; seq += 1) {
      const event = events[seq];
      if (event.kind !== 'move' || event.who !== actorId || event.at.sec < 90 || event.at.sec > 230 || observations.length >= 8) continue;
      const raw = priorFrame?.survivors.find(actor => actor._id === actorId);
      if (!raw || raw.zoneId !== event.from) continue;
      const rawDigest = digest(raw);
      const options = { mapObj: initial.map, zoneGraph, forbiddenIds: new Set(priorFrame.forbiddenZoneIds),
        nextSpawn: structuredClone(priorFrame.spawnState), ruleset };
      // These are controlled copies of the last published input, not an exact
      // planner-time snapshot. Never call the RNG-bearing leader chooser again.
      const comparison = withSimulationRandom(() => { throw Error('The input comparison must not draw game randomness.'); }, () => {
        const planning = cloneMovementRosterForPlanning([raw])[0];
        const execution = initializeActorPhaseMovementState(normalizeRuntimeSurvivor(structuredClone(raw)), { ruleset, itemKeyById });
        const executionInventory = inventorySummary(execution);
        return { planning: planSummary(refreshActorGrowthPlan(planning, initial.items, options)),
          execution: planSummary(refreshActorGrowthPlan(execution, initial.items, options)),
          beforeInventory: inventorySummary(raw), executionInventory };
      });
      assert.equal(digest(raw), rawDigest, 'Comparing inputs cannot mutate the published frame.');
      observations.push({ seq, sourceFrameAtSec: priorFrame.matchSec, sourceEventCount: priorEventCount,
        inputFocusId: raw._growthFocusId, inputPlanTargetId: raw._growthPlan?.targetId,
        actualMove: { at: event.at, from: event.from, to: event.to, reason: event.reason,
          sourceReason: event.sharedGoalReason, targetZoneId: event.targetZoneId },
        ...comparison });
    }
    priorFrame = frame;
    priorEventCount = events.length;
  } });
console.log(`TEAM_GROWTH_PLANNING_OBSERVATIONS ${JSON.stringify({ seed, actorId, observations,
  scope: 'Last published input copied into controlled planning/execution normalization, not exact planner-time consumption.' })}`);
// A repaired recipe may legitimately stop moving in this window. Keep actual
// published held plans and pickups visible as well, without another decision.
const witnessKinds = new Set(['move', 'growth_plan', 'gain', 'craft']);
const witnessFields = ['kind', 'who', 'at', 'from', 'to', 'reason', 'targetId', 'targetZoneId',
  'blocked', 'missing', 'itemId', 'qty', 'receivedQty', 'paidCost'];
const witnessEvents = observed.events.filter(event => event.who === actorId
  && event.at?.sec >= 90 && event.at?.sec <= 230 && witnessKinds.has(event.kind));
const finalLivingActor = observed.finalFrame.survivors.find(actor => actor._id === actorId);
const finalActor = finalLivingActor || observed.finalFrame.dead.find(actor => actor._id === actorId);
console.log(`TEAM_GROWTH_ACTOR_WITNESS ${JSON.stringify({ seed, actorId, window: { fromSec: 90, toSec: 230 },
  events: witnessEvents.slice(0, 40).map(event => Object.fromEntries(witnessFields
    .filter(key => Object.hasOwn(event, key)).map(key => [key, structuredClone(event[key])]))),
  eventCount: witnessEvents.length, omittedEvents: Math.max(0, witnessEvents.length - 40),
  prefixEnd: finalActor ? { alive: !!finalLivingActor, zoneId: finalActor.zoneId, focusId: finalActor._growthFocusId,
    plan: planSummary(finalActor._growthPlan), inventory: inventorySummary(finalActor) } : null })}`);
const plain = await runRandomIsolationMatch(input, { phaseOnly: true, stopAfterPhase });
assert.deepEqual(observed.evidence, plain.evidence);
assert.deepEqual(observed.finalFrame, plain.finalFrame);
assert.deepEqual(observed.events, plain.events);
assert.equal(digest(JSON.parse(input)), digest(initial));
console.log(`TEAM_GROWTH_PLANNING_PREFIX_PASS ${JSON.stringify({ scope: 'Fresh day-1-night prefix only; not a full match or causal proof.',
  evidence: observed.evidence, observerComparison: 'pass', observations: observations.length })}`);
