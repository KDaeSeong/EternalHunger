import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Authored starting resources and finite stock, not an old result file or a
// callback that grants materials, suppresses combat, or forces a chosen action.
const fixture = JSON.parse(await createRandomIsolationInput('HF6-paid-opening-20261005'));
const raw = { _id: 'custom:budget-fiber', name: '맞춤 예산 섬유', type: '재료', tier: 1, spawnZones: ['school'] };
const dye = { _id: 'custom:budget-dye', name: '맞춤 예산 염료', type: '재료', tier: 1, spawnZones: ['school'] };
const food = { _id: 'custom:budget-food', name: '맞춤 예산 회복약', type: '소모품', tier: 1,
  consumeEffect: { version: 1, heal: 25 },
  recipe: { ingredients: [{ itemId: raw._id, qty: 2 }], resultQty: 3, creditsCost: 7 } };
const head = { _id: 'custom:budget-head', name: '맞춤 예산 모자', type: '방어구', equipSlot: 'head', tier: 4, stats: { def: 5 },
  recipe: { ingredients: [{ itemId: raw._id, qty: 2 }, { itemId: dye._id, qty: 1 }], resultQty: 1, creditsCost: 20 } };
fixture.items.push(raw, dye, food, head);
fixture.map.fieldResourceStock = { ...fixture.map.fieldResourceStock,
  school: { ...fixture.map.fieldResourceStock?.school, [raw._id]: 0, [dye._id]: 3 } };
const authors = fixture.survivors.slice(0, 3);
const authoredIds = new Set(authors.map(actor => actor._id));
for (const actor of authors) {
  actor.zoneId = 'school';
  actor.inventory = [{ ...raw, itemId: raw._id, qty: 4 }];
  actor.simCredits = 20;
  actor.goalLoadouts = { ...actor.goalLoadouts, hero: { ...actor.goalLoadouts?.hero, headKey: head._id } };
  actor.routePlanTargetItemIds = [head._id];
  actor._growthFocusId = head._id;
  actor._growthPlan = null;
}
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const beforeInput = JSON.stringify(input);
const fetchBefore = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = () => { apiCalls++; throw new Error('Paid opening checks cannot access account APIs.'); };
try {
  const equippedActors = new Set();
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input),
    stopAfterPhase: { day: 1, phase: 'morning' }, onFrame(frame) {
      for (const actor of frame.survivors) if (authoredIds.has(actor._id) && actor.equipped?.head === head._id)
        equippedActors.add(actor._id);
    } });
  const receipts = original.events.filter(event => authoredIds.has(event.who) && event.kind === 'craft' && event.itemId === head._id);
  console.log(`PAID_OPENING_BUDGET_WITNESS ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
    equipped: [...equippedActors], receipts: receipts.map(event => ({ who: event.who, atSec: event.at.sec,
      paidCost: event.paidCost, beforeCredits: event.beforeCredits, afterCredits: event.afterCredits })),
    crafts: receipts.length, customFoodCrafts: original.events.filter(event =>
      authoredIds.has(event.who) && event.kind === 'craft' && event.itemId === food._id).length, evidence: original.evidence })}`);
  assert.equal(equippedActors.size, 3, 'This authored opening must gather and pay for all three real target hats.');
  assert.equal(receipts.length, 3);
  for (const event of receipts) {
    assert.ok(Number.isFinite(event.at.sec) && event.at.sec >= 0 && event.at.sec <= original.evidence.ticks);
    assert.equal(event.qty, 1); assert.equal(event.paidCost, 20);
    assert.equal(event.beforeCredits - event.afterCredits, 20);
    assert.deepEqual(event.consumed.map(row => [row.itemId, row.qty]).sort(), [[raw._id, 2], [dye._id, 1]].sort());
    const firstCustomCraft = original.events.find(row => row.who === event.who && row.kind === 'craft'
      && [head._id, food._id].includes(row.itemId));
    assert.equal(firstCustomCraft.itemId, head._id);
  }
  const stock = original.finalFrame.spawnState.fieldResources.byZone.school[dye._id];
  assert.equal(stock.initial, 3); assert.equal(stock.remaining, 0); assert.equal(stock.taken, 3);
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(beforeInput), noisy: true,
    stopAfterPhase: { day: 1, phase: 'morning' } });
  assert.deepEqual(replay.events, original.events); assert.deepEqual(replay.finalFrame, original.finalFrame);
  assert.deepEqual(replay.evidence.random, original.evidence.random);
  assert.equal(replay.evidence.frameDigest, original.evidence.frameDigest);
  assert.equal(JSON.stringify(input), beforeInput); assert.equal(apiCalls, 0);
  console.log(`PAID_OPENING_BUDGET_REPLAY ${JSON.stringify({ pass: true, engine: SIMULATION_ENGINE_VERSION,
    eventCount: original.events.length, frameDigest: original.evidence.frameDigest, apiCalls,
    scope: 'Actual 24-person first-morning phase, configured paid recipes and finite stock, with identical noisy saved-input replay. Not a full match, default balance, physical browser or human evaluation.' })}`);
} finally { globalThis.fetch = fetchBefore; }
