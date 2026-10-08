import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const { summarizeTeamRetreats } = await import('./lib/match-distribution-diagnostics.mjs');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { isMarketItemAllowed } = await import('../src/utils/marketItemPolicy.js');

// Predetermined ordinary guest inputs: no edited inventories, credits, HP,
// rules, catalogue, phase state or successful outcomes are injected.
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.ok(/^--(seeds|rosters|output)=.+/.test(arg), `Unknown argument: ${arg}`);
  const index = arg.indexOf('=');
  return [arg.slice(2, index), arg.slice(index + 1)];
}));
const seeds = (options.seeds || '1101,2202,3303').split(',');
const rosters = (options.rosters || 'FIXTURE:initial-roster,HF4:roster-A,HF4:roster-C').split(',');
assert.ok(seeds.length && rosters.length && seeds.every(Boolean) && rosters.every(Boolean));
assert.equal(new Set(seeds).size, seeds.length);
assert.equal(new Set(rosters).size, rosters.length);
const rows = [];
const idOf = value => typeof value === 'string' ? value : String(value?._id || value?.itemId || value?.item?._id || '');
const secOf = event => Number(event.at?.sec || 0);

for (const initialRosterSeed of rosters) for (const seed of seeds) {
  console.log(`NATURAL_MATRIX_START ${JSON.stringify({ seed, initialRosterSeed })}`);
  const input = await createRandomIsolationInput(seed, { initialRosterSeed });
  const initial = JSON.parse(input);
  const itemsById = new Map(initial.items.map(item => [String(item._id), item]));
  const actorsById = new Map(initial.survivors.map(actor => [String(actor._id), actor]));
  const tracker = createTeamIsolationTracker({ items: initial.items, zones: initial.map.zones });
  const equippedCrafts = new Set(), completeOpening = new Map(), receiptKeys = new Set();
  let seenEvents = 0, observerReceiptChecks = 0, previousIsolationKey = '';
  const result = await runRandomIsolationMatch(input, { onFrame(frame, { events, publicItems }) {
    // Isolation can start/end only on membership, zone or combat-space change.
    // Also retain growth/regroup changes; avoid repeating expensive recipe
    // diagnostics for each unchanged combat HP sub-tick.
    const isolationKey = JSON.stringify(frame.survivors.map(actor => [actor._id, actor.zoneId,
      getCombatSpaceId(actor), actor._teamRegroup?.status, actor._growthPlan?.targetId,
      actor._growthPlan?.completedSlots, actor._growthPlan?.openingComplete]));
    if (isolationKey !== previousIsolationKey) tracker.observe(frame);
    previousIsolationKey = isolationKey;
    const newEvents = events.slice(seenEvents);
    const lastReceipts = new Map();
    for (const event of newEvents) {
      if (event.kind === 'procurement') {
        const key = `${event.who}:${event.actionKey}`;
        assert.ok(!receiptKeys.has(key), 'A procurement action must emit at most one settlement.');
        receiptKeys.add(key);
        assert.ok(actorsById.has(event.who), 'Receipts must belong to a real participant.');
        if (event.outcome === 'completed') {
          if (event.actionType === 'kioskSell') assert.ok(event.qty > 0 && event.gainedCredits > 0);
          else assert.ok(event.receivedQty > 0);
          assert.ok(Math.abs(event.beforeCredits - event.paidCost + event.gainedCredits - event.afterCredits) < 1e-6,
            'The receipt must preserve actual personal credit accounting.');
          assert.ok(event.afterCredits >= 0);
          assert.ok(event.actionType === 'kioskSell' || isMarketItemAllowed(itemsById.get(event.itemId), event.source),
            'Actual purchases and exchanges must respect the food/water policy.');
        }
        lastReceipts.set(event.who, event);
      }
      if (event.kind === 'craft') {
        const actor = [...frame.survivors, ...frame.dead].find(row => String(row._id) === event.who);
        assert.ok(actor, 'Crafts must belong to a real participant.');
        if (Object.values(actor.equipped || {}).some(value => idOf(value) === event.itemId)) {
          equippedCrafts.add(`${event.who}:${event.itemId}`);
        }
      }
      if (event.kind === 'growth_plan' && event.totalSlots > 0 && event.completedSlots === event.totalSlots
        && !completeOpening.has(event.who)) completeOpening.set(event.who, secOf(event));
    }
    for (const event of lastReceipts.values()) {
      const actor = [...frame.survivors, ...frame.dead].find(row => String(row._id) === event.who);
      const model = buildTeamObserverModel({ ...frame, events, publicItems, teamId: actor.teamId,
        settings: initial.settings, forbiddenIds: frame.forbiddenZoneIds });
      const observed = model.members.find(member => member.id === event.who)?.procurement;
      assert.equal(observed?.actionKey, event.actionKey);
      assert.equal(observed?.outcome, event.outcome);
      assert.equal(observed?.matchedChoice, true, 'Observer receipts must join their actual selected order.');
      observerReceiptChecks += 1;
    }
    seenEvents = events.length;
  } });
  const sharedPlans = result.events.filter(event => event.reason === 'team_rotate'
    && /키오스크|구매|교환|kiosk/.test(event.sharedGoalReason || ''));
  const completed = result.events.filter(event => event.kind === 'procurement' && event.outcome === 'completed');
  const kioskReceipts = completed.filter(event => event.source === 'kiosk');
  const craftLinks = kioskReceipts.flatMap(receipt => {
    const craft = result.events.find(event => event.kind === 'craft' && event.who === receipt.who
      && secOf(event) >= secOf(receipt) && (event.consumed || []).some(row => row.itemId === receipt.itemId));
    return craft ? [{ who: receipt.who, purchasedId: receipt.itemId, paidCost: receipt.paidCost,
      craftId: craft.itemId, craftCost: craft.paidCost, equippedObserved: equippedCrafts.has(`${craft.who}:${craft.itemId}`) }] : [];
  });
  const isolation = tracker.report(result.finalFrame.matchSec);
  const isolationEndReasons = Object.fromEntries([...new Set(isolation.finished.map(row => row.endReason))]
    .map(reason => [reason, isolation.finished.filter(row => row.endReason === reason).length]));
  const row = { seed, initialRosterSeed, evidence: result.evidence,
    sharedPurchaseIntentions: sharedPlans.length,
    distinctSharedPurchaseReviews: new Set(sharedPlans.map(event => `${actorsById.get(event.who)?.teamId}:${event.sharedGoalReason}`)).size,
    naturalPurchaseCoverage: sharedPlans.length ? 'observed' : 'not_observed',
    kioskSettlements: kioskReceipts.length, allSettlements: completed.length, observerReceiptChecks,
    purchaseToCraftLinks: craftLinks.length, equippedPurchaseCrafts: craftLinks.filter(link => link.equippedObserved).length,
    craftSamples: craftLinks.slice(0, 3),
    openingComplete: completeOpening.size, openingCompleteBy250Sec: [...completeOpening.values()].filter(sec => sec <= 250).length,
    isolationEndReasons, isolationCensoredAtMatchEnd: isolation.unfinished.length,
    longestIsolationSeconds: Math.max(0, ...isolation.finished.map(row => row.duration)),
    longestContactIsolationSeconds: Math.max(0, ...isolation.finished.filter(row => row.endReason === 'contact').map(row => row.duration)),
    regroupArrivals: result.events.filter(event => event.regroupEvidence?.status === 'arrived').length,
    teamRetreats: summarizeTeamRetreats(result.events),
    huntTransfers: result.events.filter(event => event.kind === 'hunt_transfer').length,
    successfulBossSettlements: result.events.filter(event => event.kind === 'hunt_settlement' && event.defeated
      && ['alpha', 'omega', 'weakline'].includes(event.subkind)).length,
  };
  rows.push(row);
  const report = { engineVersion: SIMULATION_ENGINE_VERSION, cases: rows.length,
    expectedCases: seeds.length * rosters.length, complete: rows.length === seeds.length * rosters.length, rows,
    scope: 'predetermined guest roster/seed matrix with unchanged default budgets/catalogue/rules; observed plans, actual settlements and craft/equip links are separate metrics; not guaranteed natural purchase, causal balance, browser performance or human acceptance' };
  if (options.output) writeFileSync(options.output, JSON.stringify(report, null, 2));
  console.log(`NATURAL_MATRIX_CASE ${JSON.stringify(row)}`);
}
console.log(`NATURAL_MATRIX_RESULT ${JSON.stringify({ pass: true, engineVersion: SIMULATION_ENGINE_VERSION,
  cases: rows.length, observedPurchaseCases: rows.filter(row => row.sharedPurchaseIntentions > 0).length,
  kioskSettlements: rows.reduce((sum, row) => sum + row.kioskSettlements, 0),
  purchaseToCraftLinks: rows.reduce((sum, row) => sum + row.purchaseToCraftLinks, 0),
  equippedPurchaseCrafts: rows.reduce((sum, row) => sum + row.equippedPurchaseCrafts, 0) })}`);
