import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { summarizeKioskCraftEvidence } from './lib/natural-procurement-evidence.mjs';
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
const schema = 'eternal-hunger.natural-procurement-matrix.v3';
const sharedRecipePurpose = /^팀 제작 (구매|교환):/;
const idOf = value => typeof value === 'string' ? value : String(value?._id || value?.itemId || value?.item?._id || '');
const secOf = event => Number(event.at?.sec || 0);

for (const initialRosterSeed of rosters) for (const seed of seeds) {
  console.log(`NATURAL_MATRIX_START ${JSON.stringify({ seed, initialRosterSeed })}`);
  const input = await createRandomIsolationInput(seed, { initialRosterSeed });
  const initial = JSON.parse(input);
  const itemsById = new Map(initial.items.map(item => [String(item._id), item]));
  const actorsById = new Map(initial.survivors.map(actor => [String(actor._id), actor]));
  const tracker = createTeamIsolationTracker({ items: initial.items, zones: initial.map.zones });
  const equippedCraftEventIndexes = new Set(), completeOpening = new Map(), receiptKeys = new Set();
  const equippedCraftObservations = new Map();
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
    for (const [offset, event] of newEvents.entries()) {
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
        const slot = Object.entries(actor.equipped || {}).find(([, value]) => idOf(value) === event.itemId)?.[0];
        const inventoryQty = (actor.inventory || []).filter(entry => idOf(entry) === event.itemId)
          .reduce((sum, entry) => sum + Number(entry.qty ?? 1), 0);
        if (slot && inventoryQty > 0) {
          // Preserve the actual craft's observation boundary. A later craft of
          // the same catalog ID cannot retroactively equip an earlier event.
          equippedCraftEventIndexes.add(seenEvents + offset);
          equippedCraftObservations.set(seenEvents + offset, { frameMatchSec: frame.matchSec,
            itemId: event.itemId, slot, inventoryQty });
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
  const broadProcurementPlans = result.events.filter(event => event.reason === 'team_rotate'
    && /키오스크|구매|교환|kiosk/.test(event.sharedGoalReason || ''));
  const sharedPlans = broadProcurementPlans.filter(event => sharedRecipePurpose.test(event.sharedGoalReason || ''));
  const indexedEvents = result.events.map((event, eventIndex) => ({ event, eventIndex }));
  const sharedOrders = indexedEvents.filter(({ event }) => event.kind === 'queue'
    && ['kioskBuy', 'kioskExchange'].includes(event.chosen) && sharedRecipePurpose.test(event.sharedGoalReason || ''));
  const completed = result.events.filter(event => event.kind === 'procurement' && event.outcome === 'completed');
  const kioskSettlements = completed.filter(event => event.source === 'kiosk');
  const craftEvidence = summarizeKioskCraftEvidence(result.events, { equippedCraftEventIndexes });
  const craftLinks = craftEvidence.associations;
  const zeroFeeCraftLinks = craftEvidence.zeroFeeAssociations;
  const sharedPurposeLinks = craftLinks.filter(link => link.sharedPurposeTagged);
  const sharedPurposeZeroFeeLinks = zeroFeeCraftLinks.filter(link => link.sharedPurposeTagged);
  const anyFeeCraftLinks = [...craftLinks, ...zeroFeeCraftLinks];
  const sharedPurposeAnyFeeLinks = [...sharedPurposeLinks, ...sharedPurposeZeroFeeLinks];
  const uniqueCraftCount = links => new Set(links.map(link => link.craftEventIndex)).size;
  const actorName = who => actorsById.get(who)?.name || who;
  const itemName = itemId => itemsById.get(itemId)?.name || itemId;
  const consumedSample = consumed => Array.isArray(consumed)
    ? consumed.map(entry => ({ itemId: entry.itemId, itemName: itemName(entry.itemId), qty: entry.qty })) : null;
  const journalSample = ({ event, eventIndex }) => ({ eventIndex, kind: event.kind, atSec: secOf(event),
    who: event.who, actorName: actorName(event.who), actionKey: event.actionKey,
    actionType: event.actionType || event.chosen, sharedGoalReason: event.sharedGoalReason || '',
    itemId: event.itemId, itemName: itemName(event.itemId), qty: event.qty, receivedQty: event.receivedQty,
    paidCost: event.paidCost, gainedCredits: event.gainedCredits,
    beforeCredits: event.beforeCredits, afterCredits: event.afterCredits,
    consumed: consumedSample(event.consumed), equipObservation: equippedCraftObservations.get(eventIndex) || null });
  // Retain raw, bounded journal samples from this fresh match. A queue label
  // and an allocation to consumed catalog quantities are not item-lot proof.
  const receiptSamples = craftEvidence.receivedReceiptEventIndexes.slice(0, 6).map(eventIndex => {
    const event = result.events[eventIndex];
    let queueEventIndex = null;
    for (let prior = eventIndex - 1; prior >= 0; prior -= 1) {
      const candidate = result.events[prior];
      if (candidate.kind === 'queue' && candidate.who === event.who && candidate.actionKey === event.actionKey
        && candidate.chosen === event.actionType && candidate.itemId === event.itemId) {
        queueEventIndex = prior;
        break;
      }
    }
    return { ...journalSample({ event, eventIndex }), queueEventIndex,
      queueSharedGoalReason: queueEventIndex == null ? '' : result.events[queueEventIndex].sharedGoalReason || '' };
  });
  const associationSample = link => ({ ...link, actorName: actorName(link.who),
    purchasedItemName: itemName(link.purchasedId), craftedItemName: itemName(link.craftId),
    queue: link.queueEventIndex == null ? null
      : journalSample({ event: result.events[link.queueEventIndex], eventIndex: link.queueEventIndex }),
    receipt: journalSample({ event: result.events[link.receiptEventIndex], eventIndex: link.receiptEventIndex }),
    craft: journalSample({ event: result.events[link.craftEventIndex], eventIndex: link.craftEventIndex }) });
  const craftEvents = indexedEvents.filter(({ event }) => event.kind === 'craft');
  const isolation = tracker.report(result.finalFrame.matchSec);
  const isolationEndReasons = Object.fromEntries([...new Set(isolation.finished.map(row => row.endReason))]
    .map(reason => [reason, isolation.finished.filter(row => row.endReason === reason).length]));
  const row = { seed, initialRosterSeed, evidence: result.evidence,
    sharedPurchaseIntentions: sharedPlans.length,
    distinctSharedPurchaseReviews: new Set(sharedPlans.map(event => `${actorsById.get(event.who)?.teamId}:${event.sharedGoalReason}`)).size,
    sharedRecipeOrders: sharedOrders.length,
    broadProcurementRotationIntentions: broadProcurementPlans.length,
    distinctBroadProcurementRotationReviews: new Set(broadProcurementPlans.map(event => `${actorsById.get(event.who)?.teamId}:${event.sharedGoalReason}`)).size,
    naturalPurchaseCoverage: sharedPlans.length ? 'explicit_shared_recipe_intent_observed' : 'not_observed',
    purchaseIntentScope: 'Only team_rotate reasons beginning with 팀 제작 구매: or 팀 제작 교환: are explicit shared recipe intentions; other kiosk mentions stay separate.',
    kioskSettlements: kioskSettlements.length,
    kioskSaleSettlements: kioskSettlements.filter(event => event.actionType === 'kioskSell').length,
    kioskReceivedSettlements: craftEvidence.receivedReceiptEventIndexes.length,
    kioskReceivedByAction: Object.fromEntries(['kioskBuy', 'kioskExchange'].map(actionType => [actionType,
      craftEvidence.receivedReceiptEventIndexes.filter(eventIndex => result.events[eventIndex].actionType === actionType).length])),
    allSettlements: completed.length, observerReceiptChecks,
    // These are quantity-bounded, journal-ordered associations, not receipt-lot
    // provenance. Shared movement intentions remain a separate observation.
    purchaseToCraftLinks: craftLinks.length, linkedReceiptUnits: craftLinks.reduce((sum, link) => sum + link.linkedQty, 0),
    distinctPaidCrafts: uniqueCraftCount(craftLinks),
    equippedPurchaseCrafts: uniqueCraftCount(craftLinks.filter(link => link.equippedObserved)),
    sharedPurposePaidCraftLinks: sharedPurposeLinks.length,
    sharedPurposeDistinctPaidCrafts: uniqueCraftCount(sharedPurposeLinks),
    sharedPurposeEquippedPaidCrafts: uniqueCraftCount(sharedPurposeLinks.filter(link => link.equippedObserved)),
    zeroFeePurchaseToCraftLinks: zeroFeeCraftLinks.length,
    zeroFeeLinkedReceiptUnits: zeroFeeCraftLinks.reduce((sum, link) => sum + link.linkedQty, 0),
    distinctZeroFeeCrafts: uniqueCraftCount(zeroFeeCraftLinks),
    equippedZeroFeePurchaseCrafts: uniqueCraftCount(zeroFeeCraftLinks.filter(link => link.equippedObserved)),
    sharedPurposeZeroFeeCraftLinks: sharedPurposeZeroFeeLinks.length,
    sharedPurposeDistinctZeroFeeCrafts: uniqueCraftCount(sharedPurposeZeroFeeLinks),
    sharedPurposeEquippedZeroFeeCrafts: uniqueCraftCount(sharedPurposeZeroFeeLinks.filter(link => link.equippedObserved)),
    anyFeePurchaseToCraftLinks: anyFeeCraftLinks.length,
    anyFeeLinkedReceiptUnits: anyFeeCraftLinks.reduce((sum, link) => sum + link.linkedQty, 0),
    sharedPurposeAnyFeeCraftLinks: sharedPurposeAnyFeeLinks.length,
    sharedPurposeEquippedAnyFeeCrafts: uniqueCraftCount(sharedPurposeAnyFeeLinks.filter(link => link.equippedObserved)),
    naturalSharedPurposeOrderCraftCoverage: sharedPurposeLinks.length ? 'tagged_order_paid_craft_association_observed' : 'not_observed',
    naturalSharedPurposeZeroFeeOrderCraftCoverage: sharedPurposeZeroFeeLinks.length ? 'tagged_order_zero_fee_craft_association_observed' : 'not_observed',
    naturalSharedPurposeAnyFeeOrderCraftCoverage: sharedPurposeAnyFeeLinks.length ? 'tagged_order_craft_association_observed' : 'not_observed',
    craftAssociationScope: craftEvidence.scope,
    craftSamples: craftLinks.slice(0, 3).map(associationSample),
    zeroFeeCraftSamples: zeroFeeCraftLinks.slice(0, 3).map(associationSample),
    sharedPurposeCraftSamples: sharedPurposeAnyFeeLinks.slice(0, 3).map(associationSample),
    sharedReasonSamples: [...new Map(sharedPlans.map(event => [event.sharedGoalReason, {
      atSec: secOf(event), who: event.who, actorName: actorName(event.who), sharedGoalReason: event.sharedGoalReason }])).values()].slice(0, 6),
    sharedOrderSamples: sharedOrders.slice(0, 6).map(journalSample), receiptSamples,
    reportedCraftCostBreakdown: { total: craftEvents.length,
      zeroFee: craftEvents.filter(({ event }) => event.paidCost === 0).length,
      positiveFee: craftEvents.filter(({ event }) => Number.isFinite(event.paidCost) && event.paidCost > 0).length,
      other: craftEvents.filter(({ event }) => !Number.isFinite(event.paidCost) || event.paidCost < 0).length },
    rawCraftSamples: craftEvents.slice(0, 3).map(journalSample),
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
  const report = { schema, engineVersion: SIMULATION_ENGINE_VERSION, cases: rows.length,
    expectedCases: seeds.length * rosters.length, complete: rows.length === seeds.length * rosters.length, rows,
    scope: 'predetermined guest roster/seed matrix with unchanged default budgets/catalogue/rules; exact shared recipe intentions, broad kiosk rotations, all settlements, actual kiosk receipts, exact queue joins, quantity-bounded paid/zero-fee craft associations and same-output equip observations are separate metrics; zero-fee material-consuming crafting is valid, not free equipment correction; not lot provenance, causal shared procurement, guaranteed natural purchase, balance, browser performance or human acceptance' };
  if (options.output) writeFileSync(options.output, JSON.stringify(report, null, 2));
  console.log(`NATURAL_MATRIX_CASE ${JSON.stringify(row)}`);
}
console.log(`NATURAL_MATRIX_RESULT ${JSON.stringify({ pass: true, schema, engineVersion: SIMULATION_ENGINE_VERSION,
  cases: rows.length, observedPurchaseCases: rows.filter(row => row.sharedPurchaseIntentions > 0).length,
  kioskSettlements: rows.reduce((sum, row) => sum + row.kioskSettlements, 0),
  kioskReceivedSettlements: rows.reduce((sum, row) => sum + row.kioskReceivedSettlements, 0),
  purchaseToCraftLinks: rows.reduce((sum, row) => sum + row.purchaseToCraftLinks, 0),
  equippedPurchaseCrafts: rows.reduce((sum, row) => sum + row.equippedPurchaseCrafts, 0),
  sharedPurposePaidCraftLinks: rows.reduce((sum, row) => sum + row.sharedPurposePaidCraftLinks, 0),
  sharedPurposeEquippedPaidCrafts: rows.reduce((sum, row) => sum + row.sharedPurposeEquippedPaidCrafts, 0),
  zeroFeePurchaseToCraftLinks: rows.reduce((sum, row) => sum + row.zeroFeePurchaseToCraftLinks, 0),
  sharedPurposeZeroFeeCraftLinks: rows.reduce((sum, row) => sum + row.sharedPurposeZeroFeeCraftLinks, 0),
  sharedPurposeEquippedZeroFeeCrafts: rows.reduce((sum, row) => sum + row.sharedPurposeEquippedZeroFeeCrafts, 0),
  sharedPurposeAnyFeeCraftLinks: rows.reduce((sum, row) => sum + row.sharedPurposeAnyFeeCraftLinks, 0),
  scope: 'quantity-bounded journal associations; zero shared coverage remains not observed, not overall acceptance' })}`);
