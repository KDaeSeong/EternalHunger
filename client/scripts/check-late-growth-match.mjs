import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { getCombatEquipment } = await import('../src/utils/battleEquipmentLogic.js');

const fixture = JSON.parse(await createRandomIsolationInput('HF2-late-growth-match'));
const water = fixture.items.find(item => item.name === '물' && item.spawnZones?.length);
assert.ok(water);
const makeGear = (tier, ingredients) => ({ _id: `guest-item-late-${tier}`, itemKey: `guest-late-key-${tier}`,
  name: `후반 성장 시험 모자 ${tier}`, type: '방어구', equipSlot: 'head', tier, stats: { def: tier * 2 },
  recipe: { ingredients, resultQty: 1, creditsCost: 3 } });
const hero = makeGear(4, [{ itemId: water._id, qty: 1 }]);
const legend = makeGear(5, [{ itemId: hero._id, qty: 1 }, { itemId: water._id, qty: 1 }]);
const transcend = makeGear(6, [{ itemId: legend._id, qty: 1 }, { itemId: water._id, qty: 1 }]);
const authored = [hero, legend, transcend];
fixture.items.push(...authored);
const participants = new Set(fixture.survivors.slice(0, 3).map(actor => actor._id));
for (const actor of fixture.survivors.filter(actor => participants.has(actor._id))) {
  actor.routePlanTargetItemIds = [hero._id]; actor._growthPlan = null; actor._growthFocusId = hero._id;
  actor.goalLoadouts = { hero: { headKey: hero.itemKey }, legend: { headKey: legend.itemKey },
    transcend: { headKey: transcend.itemKey } };
}
// The three recipes and choices are explicit test input, not original-game
// balance. Do not grant ingredients, credits, equipment, movement or immunity.
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const inputBefore = JSON.stringify(input), counts = {}, equipped = {}, lateViews = new Set();
let cursor = 0, apiCalls = 0;
const fetchBefore = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw new Error('Late growth must not require an account call'); };
try {
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFrame(frame, { events, publicItems }) {
    const fresh = events.slice(cursor); cursor = events.length;
    for (const event of fresh.filter(row => row.kind === 'craft' && authored.some(item => item._id === row.itemId))) {
      const recipe = authored.find(item => item._id === event.itemId).recipe;
      assert.equal(event.qty, 1); assert.equal(event.paidCost, 3);
      assert.equal(event.beforeCredits - event.afterCredits, 3);
      assert.deepEqual(event.consumed, recipe.ingredients);
      counts[event.itemId] = (counts[event.itemId] || 0) + 1;
    }
    for (const actor of frame.survivors.filter(row => participants.has(row._id))) {
      for (const item of getCombatEquipment(actor).filter(item => authored.some(row => row._id === item.itemId))) {
        equipped[item.itemId] = (equipped[item.itemId] || 0) + 1;
      }
      if (actor._growthPlan?.stage !== 'late' || !actor._growthPlan.targetId) continue;
      assert.equal(actor._growthPlan.openingComplete, true);
      assert.equal(actor._growthPlan.targetIds.length, 1, 'do not copy an entire late catalog into every frame');
      const observer = buildTeamObserverModel({ ...frame, settings: input.settings, publicItems, events, teamId: actor.teamId });
      const view = observer.members.find(member => member.id === actor._id)?.growth;
      if (view?.targetId) { assert.match(view.label, /후반 성장/); lateViews.add(view.targetId); }
    }
  } });
  for (const item of authored) {
    assert.ok(counts[item._id] > 0, `real ${item.name} crafting missing: ${JSON.stringify(counts)}`);
    assert.ok(equipped[item._id] > 0, `real ${item.name} equipment missing`);
  }
  for (const item of [legend, transcend]) assert.ok(lateViews.has(item._id), `observer missed ${item.name}`);
  console.log(`LATE_GROWTH_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION, counts, equipped,
    lateViews: [...lateViews], evidence: original.evidence })}`);
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(inputBefore), noisy: true });
  const comparable = result => ({ events: result.events, finalFrame: result.finalFrame, random: result.evidence.random,
    summary: { ending: result.evidence.ending } });
  const compared = compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay)));
  assert.equal(compared.matched, true); assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
  assert.equal(JSON.stringify(input), inputBefore); assert.equal(apiCalls, 0);
  console.log(`LATE_GROWTH_MATCH_REPLAY ${JSON.stringify({ pass: true, compared, frameDigest: replay.evidence.frameDigest,
    apiCalls, scope: 'Actual 24-actor model, authored opening/legend/transcend recipes, real materials/credits/equipment/observer and complete saved-input replay. Not browser or human acceptance.' })}`);
} finally { globalThis.fetch = fetchBefore; }
