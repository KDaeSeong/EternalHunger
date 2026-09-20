import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const fixture = JSON.parse(await createRandomIsolationInput('HF6-custom-crafting'));
// Three participants have an explicitly authored two-step recipe and its real
// starting materials. No callbacks grant ingredients, money, or completed gear.
const raw = { _id: 'custom:craft-fiber', name: '맞춤 섬유', type: '재료', tier: 1, spawnZones: ['school'] };
const batch = { _id: 'custom:craft-cloth', name: '맞춤 원단', type: '재료', tier: 2,
  recipe: { ingredients: [{ itemId: raw._id, qty: 2 }], resultQty: 3, creditsCost: 7 } };
const head = { _id: 'custom:craft-head', name: '맞춤 섬유 모자', type: '방어구', equipSlot: 'head', tier: 4, stats: { def: 5, hp: 12 },
  recipe: { ingredients: [{ itemId: batch._id, qty: 2 }], resultQty: 1, creditsCost: 4 } };
fixture.items.push(raw, batch, head);
for (const actor of fixture.survivors.slice(0, 3)) {
  actor.inventory = [{ ...raw, itemId: raw._id, qty: 2 }];
  actor.simCredits = 20;
  actor.routePlanTargetItemIds = [head._id];
  actor._growthFocusId = head._id;
  actor._growthPlan = null;
}
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const beforeInput = JSON.stringify(input);
const fetchBefore = globalThis.fetch;
let apiCalls = 0, observed = 0, equippedFrames = 0, firstEquipped = null, lastEventCount = 0;
globalThis.fetch = () => { apiCalls++; throw new Error('Custom crafting match must not access an account'); };
try {
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFrame(frame, { events, publicItems }) {
    const fresh = events.slice(lastEventCount); lastEventCount = events.length;
    for (const event of fresh.filter((row) => row.kind === 'craft' && row.itemId.startsWith('custom:craft-'))) {
      assert.equal(event.receiptVersion, 1);
      assert.equal(event.qty, event.itemId === batch._id ? 3 : 1);
      assert.equal(event.paidCost, event.itemId === batch._id ? 7 : 4);
      assert.equal(event.beforeCredits - event.afterCredits, event.paidCost);
      const actor = [...frame.survivors, ...frame.dead].find((row) => row._id === event.who);
      const model = buildTeamObserverModel({ ...frame, settings: input.settings, publicItems, events, teamId: actor.teamId });
      assert.ok(model.recent.some((row) => row.kind === 'craft' && row.sec === event.at.sec && /제작 비용/.test(row.text)));
      observed++;
    }
    const equipped = frame.survivors.find((actor) => actor.equipped?.head === head._id && invQty(actor.inventory, head._id) === 1);
    if (equipped) { equippedFrames++; firstEquipped ??= { who: equipped._id, atSec: frame.matchSec }; }
  } });
  const custom = original.events.filter((event) => event.kind === 'craft' && event.itemId.startsWith('custom:craft-'));
  assert.ok(custom.some((event) => event.itemId === batch._id) && custom.some((event) => event.itemId === head._id));
  assert.ok(observed > 0 && equippedFrames > 0);
  assert.equal(new Set(custom.map((event) => `${event.who}:${event.actionKey}`)).size, custom.length);
  console.log(`CUSTOM_CRAFTING_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
    customCrafts: custom.length, observed, equippedFrames, firstEquipped, evidence: original.evidence })}`);
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(beforeInput), noisy: true });
  const comparable = (result) => ({ events: result.events, finalFrame: result.finalFrame,
    random: result.evidence.random, summary: { ending: result.evidence.ending } });
  const comparison = compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay)));
  assert.equal(comparison.matched, true);
  assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
  assert.equal(JSON.stringify(input), beforeInput);
  assert.equal(apiCalls, 0);
  console.log(`CUSTOM_CRAFTING_MATCH_REPLAY ${JSON.stringify({ pass: true, engine: SIMULATION_ENGINE_VERSION,
    comparison, frameDigest: replay.evidence.frameDigest, apiCalls,
    scope: 'Actual phase-cycle custom batch crafting, payment, equipping, observer and saved-input replay with speed/observer changes. Not editor UI, physical browser storage, effects or original evaluator reproduction.' })}`);
} finally { globalThis.fetch = fetchBefore; }
