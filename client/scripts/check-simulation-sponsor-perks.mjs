import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import './lib/register-simulation-modules.mjs';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const perks = await import('../src/utils/gameplayPerks.js');
const sponsor = await import('../src/app/simulation/_lib/simulationSponsorPerks.js');
const perkRuntime = await import('../src/app/simulation/_lib/perkRuntime.js');
const replay = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { rollKioskInteraction } = await import('../src/app/simulation/_lib/aiKioskInteractionRuntime.js');
const { rollDroneOrder } = await import('../src/app/simulation/_lib/aiDroneRuntime.js');
const { commitProcurementTransaction } = await import('../src/app/simulation/_lib/procurementTransactionRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const { START_SPONSOR, PROCUREMENT_PARTNER, CAREFUL_GATHER } = perks.GAMEPLAY_PERK_CODES;
const roster = [
  { _id: 'a1', name: '대원 A1', hp: 100, simCredits: 10, teamId: 'team:1', matchTeamId: 'team:1', matchTeamName: '1팀' },
  { _id: 'a2', name: '대원 A2', hp: 100, simCredits: 20, teamId: 'team:1', matchTeamId: 'team:1', matchTeamName: '1팀' },
  { _id: 'b1', name: '대원 B1', hp: 100, simCredits: 30, teamId: 'team:2', matchTeamId: 'team:2', matchTeamName: '2팀' },
  { _id: 'a3-dead', name: '탈락 대원', hp: 0, simCredits: 40, teamId: 'team:1', matchTeamId: 'team:1', matchTeamName: '1팀' },
];
let passed = 0;
let runChain = Promise.resolve();

run('normal start map refresh is captured before React publishes it, while a later map change is rejected', () => {
  const oldMap = { _id: 'map', name: 'old' };
  const refreshedMap = { _id: 'map', name: 'refreshed' };
  const currentRoster = roster.slice();
  const captured = sponsor.captureSponsorRunContext({ activeMap: oldMap, survivors: currentRoster }, refreshedMap);
  const published = sponsor.captureSponsorRunContext({ activeMap: refreshedMap, survivors: currentRoster }, refreshedMap);
  assert.ok(Object.keys(captured).every((key) => captured[key] === published[key]));
  const changed = sponsor.captureSponsorRunContext(published, { _id: 'other-map' });
  assert.notEqual(changed.activeMap, captured.activeMap);
});

run('explicit no-perk start clears a previously selected sponsor team and never grants credits', () => {
  const empty = sponsor.createSponsorPerkSnapshot({ codes: [], sponsorTeamId: 'team:1', survivors: roster });
  assert.equal(empty.teamId, '');
  assert.equal(empty.teamName, '');
  assert.deepEqual(empty.memberIds, []);
  assert.deepEqual(empty.codes, []);
  assert.equal(sponsor.applySponsorPerksToRoster(roster, empty), roster);
  assert.equal(sponsor.applySponsorPerksToRoster(roster, { ...empty, version: 99, memberIds: 'bad' }), roster);
});

function run(name, fn) {
  runChain = runChain.then(async () => {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

run('team options use the finalized matchTeamId and exclude deceased members', () => {
  const teams = sponsor.getSponsorTeamOptions(roster);
  assert.deepEqual(teams.map((team) => team.teamId), ['team:1', 'team:2']);
  assert.deepEqual(teams[0].memberIds, ['a1', 'a2']);
});

run('start sponsor adds exactly 30 simulation credits to the selected team once', () => {
  const snapshot = sponsor.createSponsorPerkSnapshot({ codes: [START_SPONSOR], sponsorTeamId: 'team:1', survivors: roster });
  const first = sponsor.applySponsorPerksToRoster(roster, snapshot);
  const twice = sponsor.applySponsorPerksToRoster(first, snapshot);
  assert.deepEqual(first.map((actor) => actor.simCredits), [40, 50, 30, 40]);
  assert.deepEqual(twice.map((actor) => actor.simCredits), [40, 50, 30, 40]);
  assert.equal(first[0]._gameplayPerks.startSponsorCreditGranted, true);
  assert.equal(first[2]._gameplayPerks, undefined);
});

run('procurement partner discounts only the selected team at the kiosk and drone rounding boundary', () => {
  const snapshot = sponsor.createSponsorPerkSnapshot({
    codes: [PROCUREMENT_PARTNER], sponsorTeamId: 'team:1', survivors: roster,
  });
  const applied = sponsor.applySponsorPerksToRoster(roster, snapshot);
  const appliedAgain = sponsor.applySponsorPerksToRoster(applied, snapshot);
  const sponsored = perkRuntime.getActorPerkEffects(applied[0]);
  const otherTeam = perkRuntime.getActorPerkEffects(applied[2]);
  assert.equal(perkRuntime.applyPerkDiscount(101, sponsored.kioskDiscountPct), 96);
  assert.equal(perkRuntime.applyPerkDiscount(101, sponsored.droneDiscountPct), 96);
  assert.equal(perkRuntime.applyPerkDiscount(101, perkRuntime.getActorPerkEffects(appliedAgain[0]).kioskDiscountPct), 96);
  const reprocessed = perkRuntime.applyPerkBundleToActor({ ...applied[0] }, perkRuntime.buildPerkRuntimeBundle([], []));
  assert.equal(perkRuntime.applyPerkDiscount(101, perkRuntime.getActorPerkEffects(reprocessed).kioskDiscountPct), 96);
  assert.equal(perkRuntime.applyPerkDiscount(101, otherTeam.kioskDiscountPct), 101);
  assert.equal(perkRuntime.applyPerkDiscount(101, otherTeam.droneDiscountPct), 101);
});

run('game-specific equipped products stay out of the global viewer bundle while legacy unscoped perks remain', () => {
  const products = perks.GAMEPLAY_PERK_PRODUCTS.filter((product) => product.gameSlug === 'eternal-hunger');
  const scopedCodes = products.map((product) => product.code);
  const bundle = perkRuntime.buildPerkRuntimeBundle(scopedCodes, products);
  assert.equal(bundle.effects.startCreditsPlus, 0);
  assert.equal(bundle.effects.kioskDiscountPct, 0);
  assert.equal(bundle.effects.droneDiscountPct, 0);
  const scoped = perkRuntime.buildPerkRuntimeBundle(['SCOPED_CUSTOM'], [{ code: 'SCOPED_CUSTOM',
    effects: { gameSlug: 'other-game', requiresEquip: true, startCreditsPlus: 9 } }]);
  assert.equal(scoped.effects.startCreditsPlus, 0);
  const legacy = perkRuntime.buildPerkRuntimeBundle(['ADMIN_LEGACY'], [{ code: 'ADMIN_LEGACY', effects: { startCreditsPlus: 7 } }]);
  assert.equal(legacy.effects.startCreditsPlus, 7);
});

run('simulated kiosk and drone quotes use the same team-scoped 5% price and affordability', () => {
  const snapshot = sponsor.createSponsorPerkSnapshot({
    codes: [PROCUREMENT_PARTNER], sponsorTeamId: 'team:1', survivors: roster,
  });
  const applied = sponsor.applySponsorPerksToRoster(roster.map((actor) => ({ ...actor, simCredits: 96 })), snapshot);
  const items = [{ _id: 'mat', name: '천 조각', category: 'material', tags: ['material'], tier: 1 }];
  const craftGoal = { missing: [{ itemId: 'mat', name: '천 조각' }] };
  const map = { _id: 'map-1', zones: [{ zoneId: 'hospital', name: '병원' }] };
  const kiosks = [{ mapId: 'map-1', zoneId: 'hospital', catalog: [
    { itemId: 'mat', mode: 'sell', priceCredits: 101 },
  ] }];
  const kioskOrder = (actor) => withSimulationRandom(() => 0, () => rollKioskInteraction(
    map, 'hospital', kiosks, items, 2, 'day', actor, craftGoal, {}, { kiosk: {} }, null
  ));
  const kioskActor = { ...applied[0], simCredits: 96, inventory: [] };
  const kioskOffer = kioskOrder(kioskActor);
  assert.equal(kioskOffer?.cost, 96);
  const kioskReceipt = commitProcurementTransaction({ actor: kioskActor, actionType: 'kioskBuy', offer: kioskOffer, day: 2 });
  assert.equal(kioskReceipt.paidCost, 96);
  assert.equal(kioskReceipt.afterCredits, 0);
  assert.equal(kioskOrder(applied[2]), null);

  const droneOffers = [{ offerId: 'drone-mat', itemId: 'mat', priceCredits: 101 }];
  const droneRules = { drone: { needFallbackPrice: 200, price: 200 } };
  const droneOrder = (actor) => withSimulationRandom(() => 0, () => rollDroneOrder(
    droneOffers, map, items, 3, 'day', actor, 0, craftGoal, {}, droneRules
  ));
  const droneActor = { ...applied[0], simCredits: 96, inventory: [] };
  const droneOffer = droneOrder(droneActor);
  assert.equal(droneOffer?.cost, 96);
  const droneReceipt = commitProcurementTransaction({ actor: droneActor, actionType: 'droneOrder', offer: droneOffer, day: 3 });
  assert.equal(droneReceipt.paidCost, 96);
  assert.equal(droneReceipt.afterCredits, 0);
  assert.equal(droneOrder(applied[2]), null);
});

run('wrong-game codes cannot grant either Eternal Hunger effect', () => {
  const snapshot = sponsor.createSponsorPerkSnapshot({
    codes: [START_SPONSOR, PROCUREMENT_PARTNER, CAREFUL_GATHER],
    sponsorTeamId: 'team:1', survivors: roster,
  });
  assert.deepEqual(snapshot.codes, [START_SPONSOR, PROCUREMENT_PARTNER]);
  const updated = sponsor.applySponsorPerksToRoster(roster, snapshot);
  assert.deepEqual(updated.map((actor) => actor.simCredits), [40, 50, 30, 40]);
  assert.equal(updated[2]._perkRuntime, undefined);
});

run('sponsor snapshot and granted starting credits survive replay input JSON capture', () => {
  const snapshot = sponsor.createSponsorPerkSnapshot({ codes: [START_SPONSOR], sponsorTeamId: 'team:1', survivors: roster });
  const initialSurvivors = sponsor.applySponsorPerksToRoster(roster.slice(0, 3), snapshot);
  const input = replay.createSimulationRunInput({
    activeMap: { _id: 'map-1', zones: [{ zoneId: 'zone-1', name: '시작 구역' }] },
    runSeed: 'sponsor-test',
    settings: { rulesetId: 'default', matchMode: 'squad' },
    sponsorPerkSnapshot: snapshot,
    survivors: initialSurvivors,
    publicItems: [], kiosks: [], droneOffers: [],
  }, { getItem: () => null });
  const stored = JSON.parse(JSON.stringify(input));
  assert.deepEqual(stored.sponsorPerkSnapshot, snapshot);
  assert.deepEqual(stored.initialFrame.survivors.map((actor) => actor.simCredits), [40, 50, 30]);
  assert.deepEqual(sponsor.applySponsorPerksToRoster(stored.initialFrame.survivors, stored.sponsorPerkSnapshot)
    .map((actor) => actor.simCredits), [40, 50, 30]);
  const badVersion = JSON.parse(JSON.stringify(stored));
  badVersion.sponsorPerkSnapshot.version = 2;
  assert.throws(() => replay.validateSimulationRunInput(badVersion), /후원 특전 정보/);
  const badMemberIds = JSON.parse(JSON.stringify(stored));
  badMemberIds.sponsorPerkSnapshot.memberIds = 'a1';
  assert.throws(() => replay.validateSimulationRunInput(badMemberIds), /후원 특전 정보/);
});

const controllerUrl = new URL('../src/app/simulation/_lib/useSimulationPhaseController.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const executorStub = `data:text/javascript,${encodeURIComponent(`
  export function useSimulationPhaseExecutor() {
    const execute = async options => {
      globalThis.__sponsorControllerProbe.executed.push(options);
      return { kind: 'ran' };
    };
    execute.isRunFailed = () => false;
    return execute;
  }
`)}`;
const sideEffectsStub = `data:text/javascript,${encodeURIComponent('export function useSimulationPhaseSideEffects() {}')}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react') return { url: harnessUrl, shortCircuit: true };
    if (context.parentURL === controllerUrl && specifier === './useSimulationPhaseExecutor.js') {
      return { url: executorStub, shortCircuit: true };
    }
    if (context.parentURL === controllerUrl && specifier === './useSimulationPhaseSideEffects') {
      return { url: sideEffectsStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { useSimulationPhaseController } = await import(controllerUrl);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
globalThis.__sponsorControllerProbe = { executed: [] };

run('actual phase controller awaits sponsor capture before executing the first day-zero phase', async () => {
  const capture = deferred();
  const calls = { applied: 0 };
  const refs = { isAdvancingRef: { current: false }, runInputRef: { current: null } };
  const state = { day: 0, matchSec: 0, phase: 'night', settings: { matchMode: 'solo' }, survivors: [], autoSpeed: 1 };
  let controller;
  const harness = createHandlerHarness(() => {
    controller = useSimulationPhaseController({ state, refs, actions: {
      prepareRun: () => capture.promise,
      applyRunInput: () => { calls.applied++; },
    } });
    return null;
  }, {});
  harness.render();
  const started = controller.proceedPhase();
  await Promise.resolve();
  assert.equal(globalThis.__sponsorControllerProbe.executed.length, 0);
  capture.resolve({ state: { activeMapId: 'map-1' }, helpers: {} });
  await started;
  assert.equal(calls.applied, 1);
  assert.equal(globalThis.__sponsorControllerProbe.executed.length, 1);
  harness.unmount();
});

run('actual phase controller aborts cleanly when sponsor capture returns blocked', async () => {
  const calls = { applied: 0 };
  const refs = { isAdvancingRef: { current: false }, runInputRef: { current: null } };
  const state = { day: 0, matchSec: 0, phase: 'night', settings: { matchMode: 'solo' }, survivors: [], autoSpeed: 1 };
  let controller;
  const harness = createHandlerHarness(() => {
    controller = useSimulationPhaseController({ state, refs, actions: {
      prepareRun: async () => ({ blocked: true }),
      applyRunInput: () => { calls.applied++; },
    } });
    return null;
  }, {});
  harness.render();
  const before = globalThis.__sponsorControllerProbe.executed.length;
  assert.deepEqual(await controller.proceedPhase(), { blocked: true });
  assert.equal(calls.applied, 0);
  assert.equal(globalThis.__sponsorControllerProbe.executed.length, before);
  harness.unmount();
});

run('actual phase controller never enters the engine when sponsor capture rejects', async () => {
  const refs = { isAdvancingRef: { current: false }, runInputRef: { current: null } };
  const state = { day: 0, matchSec: 0, phase: 'night', settings: { matchMode: 'solo' }, survivors: [], autoSpeed: 1 };
  let controller;
  const harness = createHandlerHarness(() => {
    controller = useSimulationPhaseController({ state, refs, actions: {
      prepareRun: async () => { throw new Error('capture failure'); },
    } });
    return null;
  }, {});
  harness.render();
  const before = globalThis.__sponsorControllerProbe.executed.length;
  await assert.rejects(controller.proceedPhase(), /capture failure/);
  assert.equal(globalThis.__sponsorControllerProbe.executed.length, before);
  harness.unmount();
});

await runChain;
console.log(`${passed} sponsor-perk checks passed.`);
