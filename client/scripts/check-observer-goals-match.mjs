import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { getAvailableMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');

const input = await createRandomIsolationInput('1101');
const samples = [];
const goalKeys = new Set();
const growthKeys = new Set();
const receiptKeys = new Set();
const growthSamples = [];
const receiptSamples = [];
let seenEventCount = 0;
let previousTeams = new Set();
let activeFrames = 0;
let removedGoalChecks = 0;
const result = await runRandomIsolationMatch(input, { onFrame(frame, { publicItems, events }) {
  for (const actor of frame.survivors) {
    if (!actor._growthPlan?.targetId) continue;
    const key = `${actor._id}:${actor._growthPlan.targetId}`;
    if (growthKeys.has(key)) continue;
    const member = buildTeamObserverModel({ ...frame, teamId: actor.teamId, publicItems, events }).members.find((row) => row.id === actor._id);
    if (member?.growth?.status !== 'growing') continue;
    assert.equal(member.growth.targetId, actor._growthPlan.targetId);
    growthKeys.add(key);
    if (growthSamples.length < 3) growthSamples.push({ sec: frame.matchSec, actor: actor.name, ...member.growth });
  }
  for (const receipt of events.slice(seenEventCount).filter((event) => event.kind === 'procurement')) {
    const actor = [...frame.survivors, ...frame.dead].find((row) => row._id === receipt.who);
    assert.ok(actor, 'A receipt must belong to a real committed participant.');
    const member = buildTeamObserverModel({ ...frame, teamId: actor.teamId, publicItems, events }).members.find((row) => row.id === receipt.who);
    assert.equal(member.procurement.actionKey, receipt.actionKey);
    assert.equal(member.procurement.outcome, receipt.outcome);
    assert.equal(member.procurement.matchedChoice, true, 'The real selected action must join its actual settlement, not another order.');
    receiptKeys.add(`${receipt.who}:${receipt.actionKey}`);
    if (receiptSamples.length < 4) receiptSamples.push({ sec: frame.matchSec, actor: actor.name, ...member.procurement });
  }
  seenEventCount = events.length;
  const available = frame.survivors.filter((actor) => getAvailableMovementObjective(actor._movementObjective,
    { spawnState: frame.spawnState, forbiddenIds: frame.forbiddenZoneIds, nowSec: frame.matchSec, teamId: actor.teamId, actor }));
  if (available.length) activeFrames += 1;
  const currentTeams = new Set(available.map((actor) => actor.teamId));
  for (const teamId of previousTeams) if (!currentTeams.has(teamId)) {
    const model = buildTeamObserverModel({ ...frame, teamId, publicItems, events });
    assert.equal(model.objectives.length, 0, 'A vanished source must disappear from the observer in the same frame.');
    removedGoalChecks += 1;
  }
  previousTeams = currentTeams;
  for (const actor of available) {
    const key = JSON.stringify([actor._id, actor._movementObjective.type, actor._movementObjective.targetZoneId]);
    if (!goalKeys.has(key)) {
      const model = buildTeamObserverModel({ ...frame, teamId: actor.teamId, publicItems, events });
      const card = model.objectives.find((goal) => goal.members.includes(actor.name)
        && goal.objective.targetZoneId === actor._movementObjective.targetZoneId);
      assert.ok(card, 'A live selected resource decision must reach the observer card model.');
      if (samples.length < 6) samples.push({ sec: frame.matchSec, team: actor.teamId, actor: actor.name,
        label: card.label, zoneId: card.objective.targetZoneId });
    }
    goalKeys.add(key);
  }
} });
assert.equal(result.events.at(-1).kind, 'match_end');
const decisions = result.events.filter((event) => event.kind === 'movement_goal' && event.objective);
const sharedDecisions = result.events.filter((event) => event.reason === 'team_rotate');
assert.ok(activeFrames > 0 && removedGoalChecks > 0 && decisions.length > 0);
assert.ok(sharedDecisions.length > 0);
assert.deepEqual(sharedDecisions.filter((event) => !event.sharedGoalReason).slice(0, 3), [],
  'Shared purpose must survive movement, growth and queue event serialization.');
const purchasePlans = sharedDecisions.filter((event) => /키오스크|구매|kiosk/.test(event.sharedGoalReason));
assert.ok(purchasePlans.length > 0, 'The fixture must actually exercise shared purchase intentions.');
assert.ok(purchasePlans.every((event) => /검토/.test(describeObserverEvent(event))));
const namedOrders = result.events.filter((event) => event.kind === 'queue' && ['kioskBuy', 'kioskExchange', 'droneOrder'].includes(event.chosen) && event.itemId);
assert.ok(namedOrders.length > 0);
assert.ok(namedOrders.every((event) => event.itemName && describeObserverEvent(event).includes(event.itemName)));
assert.ok(growthKeys.size > 0 && receiptKeys.size > 0);
console.log(JSON.stringify({ pass: true, activeFrames, distinctGoals: goalKeys.size, removedGoalChecks, samples,
  actualGrowthChecks: growthKeys.size, actualReceiptChecks: receiptKeys.size, growthSamples, receiptSamples,
  sharedDecisionCount: sharedDecisions.length, purchasePlanCount: purchasePlans.length, namedOrderCount: namedOrders.length,
  purchaseSample: purchasePlans.slice(0, 2).map((event) => ({ sec: event.at?.sec, text: describeObserverEvent(event) })),
  evidence: result.evidence,
  scope: 'actual default fixture decision-to-observer-model coverage; not browser rendering or human acceptance' }, null, 2));
