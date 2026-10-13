import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch, buildIsolationNavigation } = await import('./lib/run-random-isolation-match.mjs');
const { captureMovementObjective, getAvailableMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { runObserverPurchaseScenarioChecks } = await import('./check-observer-purchase-scenario.mjs');
const { classifySpecialByName } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { inferItemCategory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { chooseTeamPurchaseMove } = await import('../src/app/simulation/_lib/teamPurchaseGoalRuntime.js');
const { chooseTeamResourceMove } = await import('../src/app/simulation/_lib/teamResourceGoalRuntime.js');
const { pickTeamSafeZone } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { getCombatSpaceId, WORLD_COMBAT_SPACE } = await import('../src/utils/combatSpaceLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

const args = process.argv.slice(2);
assert.ok(args.every(arg => arg === '--require-natural-purchase' || arg === '--audit-purchase' || arg.startsWith('--seed=')),
  'Unknown observer match diagnostic argument.');
const requireNaturalPurchase = args.includes('--require-natural-purchase');
// A fixed natural match does not guarantee a payable one-ingredient squad
// recipe. Always exercise that branch with explicit pre-action conditions;
// keep its real travel, payment, craft and observer assertions mandatory.
const purchaseScenario = runObserverPurchaseScenarioChecks();
console.log(`OBSERVER_PURCHASE_WITNESS ${JSON.stringify(purchaseScenario)}`);

const fixtureSeed = process.argv.find(arg => arg.startsWith('--seed='))?.slice('--seed='.length) || '1101';
const input = await createRandomIsolationInput(fixtureSeed);
const observerSettings = JSON.parse(input).settings;
// Optional, read-only diagnostics of the same failed input. Never alter funds,
// actors, stock, actions or mandatory controlled/optional strict coverage.
const purchaseAudit = process.argv.includes('--audit-purchase');
const auditFixture = purchaseAudit ? JSON.parse(input) : null;
const auditRules = purchaseAudit ? getRuleset(observerSettings.rulesetId, observerSettings.simulationRuleset) : null;
const auditGraph = purchaseAudit ? buildIsolationNavigation(auditFixture.map).zoneGraph : null;
const auditCounts = {};
const auditSamples = [];
const auditMissingSamples = [];
const auditMissingKeys = new Set();
const countAudit = key => { auditCounts[key] = (auditCounts[key] || 0) + 1; };
function auditPurchaseFrame(frame, publicItems) {
  const groups = new Map(), candidates = new Set();
  for (const actor of frame.survivors) {
    if (getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE) continue;
    if (!groups.has(actor.teamId)) groups.set(actor.teamId, []);
    groups.get(actor.teamId).push(actor);
    const growth = actor._growthPlan;
    if (!growth?.openingComplete || !growth.targetId) { countAudit('no_late_focus'); continue; }
    if (growth.readyCraftId) { countAudit('focused_recipe_ready'); continue; }
    const missingRows = (growth.missing || []).map(row => {
      const item = publicItems.find(item => String(item._id) === row.itemId);
      return { item: item?.name || row.itemId, need: row.need, sourceCount: row.zones?.length || 0,
        special: inferItemCategory(item) === 'material' ? classifySpecialByName(item?.name) : null };
    });
    if (missingRows.some(row => row.special)) {
      countAudit('focus_includes_special');
      const key = JSON.stringify([actor._id, growth.targetId, missingRows]);
      if (!auditMissingKeys.has(key) && auditMissingSamples.length < 8) {
        auditMissingKeys.add(key);
        auditMissingSamples.push({ sec: frame.matchSec, actor: actor.name, target: growth.targetName,
          credits: actor.simCredits, plannedCredits: growth.plannedCredits, blocked: growth.blocked,
          missing: missingRows });
      }
    }
    if (!missingRows.length) { countAudit('no_missing'); continue; }
    if (missingRows.length > 1) { countAudit('multiple_missing_types'); continue; }
    if (growth.missing[0].need !== 1) { countAudit('multiple_missing_units'); continue; }
    const missing = growth.missing[0], material = publicItems.find(item => String(item._id) === missing.itemId);
    if (inferItemCategory(material) !== 'material' || !classifySpecialByName(material?.name)) {
      countAudit('ordinary_material'); continue;
    }
    if (missing.zones?.length) { countAudit('obtainable_field_material'); continue; }
    candidates.add(actor._id); countAudit('single_special_candidate');
    if (auditSamples.length < 3) auditSamples.push({ sec: frame.matchSec, who: actor._id, team: actor.teamId,
      material: material.name, target: growth.targetName, credits: actor.simCredits, blocked: growth.blocked });
  }
  for (const members of groups.values()) {
    if (members.length < 2) { countAudit('solo_group'); continue; }
    if (new Set(members.map(actor => actor.zoneId)).size !== 1) { countAudit('separated_group'); continue; }
    if (members.some(actor => actor._growthPlan && !actor._growthPlan.openingComplete && !actor._growthPlan.blocked)) {
      countAudit('unfinished_group'); continue;
    }
    if (!members.some(actor => candidates.has(actor._id))) { countAudit('no_current_purchase_demand'); continue; }
    if (frame.spawnState?.endgame) { countAudit('endgame_group'); continue; }
    if (members.some(actor => actor.hp <= Math.max(0, Number(auditRules?.ai?.recoverHpBelow ?? 38)))) {
      countAudit('recovering_group'); continue;
    }
    const ordered = [...members].sort((a, b) => Number(a.teamSlot || 99) - Number(b.teamSlot || 99));
    const forbiddenIds = new Set(frame.forbiddenZoneIds);
    const routeForZone = targetZoneId => pickTeamSafeZone(ordered[0], frame.survivors, auditGraph, forbiddenIds,
      { targetZoneId, maxDepth: Object.keys(auditGraph).length, travelParty: members });
    const quote = chooseTeamPurchaseMove({ members: ordered, publicItems, ruleset: auditRules, mapObj: auditFixture.map,
      day: frame.day, phase: frame.phase, forbiddenIds, routeForZone });
    if (!quote) { countAudit('no_payable_reachable_quote'); continue; }
    countAudit('payable_quote');
    if (members.some(actor => actor._teamRegroup?.status === 'rotation_wait')) countAudit('observed_rotation_hold');
    if (chooseTeamResourceMove({ members: ordered, publicItems, ruleset: auditRules, spawnState: frame.spawnState,
      routeForZone })) countAudit('natural_source_priority');
  }
}
let observerModelChecks = 0;
function observeFrame(frame, { teamId, publicItems, events }) {
  assert.ok(Array.isArray(frame.forbiddenZoneIds), 'The diagnostic requires the committed frame forbidden-zone list.');
  const model = buildTeamObserverModel({ ...frame, teamId, publicItems, events,
    settings: observerSettings, forbiddenIds: frame.forbiddenZoneIds });
  const forbidden = new Set(frame.forbiddenZoneIds);
  assert.ok(model.objectives.every(card => !forbidden.has(card.objective.targetZoneId)),
    'The observer cannot advertise a currently forbidden destination as a live resource goal.');
  observerModelChecks += 1;
  return model;
}

// A live source can still be inaccessible. This explicit frame is only a
// diagnostic-context regression, never a prepared match outcome or old journal.
const contextSpawn = { coreNodes: [{ id: 'context-tree', kind: 'life_tree', zoneId: 'context-zone', picked: false }] };
const contextGoal = captureMovementObjective({ objectiveType: 'natural_core', objectiveSubkind: 'life_tree' },
  'context-zone', { spawnState: contextSpawn });
const contextFrame = { survivors: [{ _id: 'context-actor', name: 'context-actor', teamId: 'team:1',
  zoneId: 'context-start', hp: 100, maxHp: 100, inventory: [],
  _movementObjective: { ...contextGoal, atSec: 1 } }], dead: [], matchSec: 2,
  spawnState: contextSpawn, forbiddenZoneIds: ['context-zone'] };
const contextOptions = { teamId: 'team:1', publicItems: [], events: [] };
assert.equal(observeFrame(contextFrame, contextOptions).objectives.length, 0,
  'The match diagnostic must forward this committed frame\'s forbidden zones to the observer.');
assert.equal(observeFrame({ ...contextFrame, forbiddenZoneIds: [] }, contextOptions).objectives.length, 1,
  'Removing all resource cards is not a valid fix for the diagnostic context.');
console.log('PASS observer match diagnostic uses the committed frame forbidden zones');

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
  if (purchaseAudit) auditPurchaseFrame(frame, publicItems);
  for (const actor of frame.survivors) {
    if (!actor._growthPlan?.targetId) continue;
    const key = `${actor._id}:${actor._growthPlan.targetId}`;
    if (growthKeys.has(key)) continue;
    const member = observeFrame(frame, { teamId: actor.teamId, publicItems, events }).members.find((row) => row.id === actor._id);
    if (member?.growth?.status !== 'growing') continue;
    assert.equal(member.growth.targetId, actor._growthPlan.targetId);
    growthKeys.add(key);
    if (growthSamples.length < 3) growthSamples.push({ sec: frame.matchSec, actor: actor.name, ...member.growth });
  }
  for (const receipt of events.slice(seenEventCount).filter((event) => event.kind === 'procurement')) {
    const actor = [...frame.survivors, ...frame.dead].find((row) => row._id === receipt.who);
    assert.ok(actor, 'A receipt must belong to a real committed participant.');
    const member = observeFrame(frame, { teamId: actor.teamId, publicItems, events }).members.find((row) => row.id === receipt.who);
    assert.equal(member.procurement.actionKey, receipt.actionKey);
    assert.equal(member.procurement.outcome, receipt.outcome);
    assert.equal(member.procurement.matchedChoice, true, 'The real selected action must join its actual settlement, not another order.');
    receiptKeys.add(`${receipt.who}:${receipt.actionKey}`);
    if (receiptSamples.length < 4) receiptSamples.push({ sec: frame.matchSec, actor: actor.name, ...member.procurement });
  }
  seenEventCount = events.length;
  const available = frame.survivors.filter((actor) => getAvailableMovementObjective(actor._movementObjective,
    { spawnState: frame.spawnState, forbiddenIds: frame.forbiddenZoneIds, nowSec: frame.matchSec, teamId: actor.teamId, actor,
      roster: frame.survivors, publicItems }));
  if (available.length) activeFrames += 1;
  const currentTeams = new Set(available.map((actor) => actor.teamId));
  for (const teamId of previousTeams) if (!currentTeams.has(teamId)) {
    const model = observeFrame(frame, { teamId, publicItems, events });
    assert.equal(model.objectives.length, 0, 'A vanished source must disappear from the observer in the same frame.');
    removedGoalChecks += 1;
  }
  previousTeams = currentTeams;
  for (const actor of available) {
    const key = JSON.stringify([actor._id, actor._movementObjective.type, actor._movementObjective.targetZoneId]);
    if (!goalKeys.has(key)) {
      const model = observeFrame(frame, { teamId: actor.teamId, publicItems, events });
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
if (purchaseAudit) console.log(`PURCHASE_COVERAGE_AUDIT ${JSON.stringify({ seed: fixtureSeed,
  counts: auditCounts, samples: auditSamples, missingSamples: auditMissingSamples,
  completedTransactions: result.events.filter(event => event.kind === 'procurement' && event.outcome === 'completed')
    .reduce((counts, event) => { counts[event.actionType] = (counts[event.actionType] || 0) + 1; return counts; }, {}),
  transactionItems: Object.entries(result.events.filter(event => event.kind === 'procurement' && event.outcome === 'completed')
    .reduce((counts, event) => { const key = `${event.actionType}:${event.itemName || event.itemId}`;
      counts[key] = (counts[key] || 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]),
  scope: 'Read-only committed-frame demand/quote diagnostics, not proof of eligibility at every pre-action boundary.' })}`);
console.log(`OBSERVER_MATCH_WITNESS ${JSON.stringify({ activeFrames, distinctGoals: goalKeys.size, removedGoalChecks,
  actualGrowthChecks: growthKeys.size, actualReceiptChecks: receiptKeys.size, sharedDecisionCount: sharedDecisions.length,
  purchasePlanCount: purchasePlans.length, observerModelChecks, diagnosticContextChecks: 2, evidence: result.evidence })}`);
if (requireNaturalPurchase) assert.ok(purchasePlans.length > 0,
  'The natural fixture must actually exercise shared purchase intentions (--require-natural-purchase).');
assert.ok(purchaseScenario.positiveCases > 0 && purchaseScenario.actualCompletedReceipts > 0,
  'The diagnostic must actually exercise and settle shared purchase intentions in the dedicated scenario.');
assert.ok(purchasePlans.every((event) => /검토/.test(describeObserverEvent(event))));
const namedOrders = result.events.filter((event) => event.kind === 'queue' && ['kioskBuy', 'kioskExchange', 'droneOrder'].includes(event.chosen) && event.itemId);
assert.ok(namedOrders.length > 0);
assert.ok(namedOrders.every((event) => event.itemName && describeObserverEvent(event).includes(event.itemName)));
assert.ok(growthKeys.size > 0 && receiptKeys.size > 0);
console.log(JSON.stringify({ pass: true, activeFrames, distinctGoals: goalKeys.size, removedGoalChecks, samples,
  actualGrowthChecks: growthKeys.size, actualReceiptChecks: receiptKeys.size, growthSamples, receiptSamples,
  sharedDecisionCount: sharedDecisions.length, purchasePlanCount: purchasePlans.length, namedOrderCount: namedOrders.length,
  observerModelChecks, diagnosticContextChecks: 2,
  naturalPurchaseCoverage: purchasePlans.length > 0 ? 'observed' : 'not_observed',
  requireNaturalPurchase, purchaseScenario,
  purchaseSample: purchasePlans.slice(0, 2).map((event) => ({ sec: event.at?.sec, text: describeObserverEvent(event) })),
  evidence: result.evidence,
  scope: 'unchanged natural match observation plus mandatory controlled purchase-to-observer coverage; not natural purchase frequency, browser rendering or human acceptance' }, null, 2));
