import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { makeRegenEffect } = await import('../src/utils/statusLogic.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const fixture = JSON.parse(await createRandomIsolationInput('automatic-custom-recovery'));
const raw = { _id: 'admin:metal', name: '관리자 합금 재료', type: '재료', tier: 1, spawnZones: ['school'] };
const gear = { _id: 'admin:arm', name: '관리자 맞춤 팔 보호구', type: '방어구', equipSlot: 'arm', tier: 3,
  lockedByAdmin: true, stats: { def: 5 },
  recipe: { ingredients: [{ itemId: raw._id, qty: 1 }], resultQty: 1, creditsCost: 7 } };
fixture.items.push(raw, gear);
const participants = fixture.survivors.slice(0, 3);
for (const actor of participants) {
  // Existing authored routes remain. No route names this administrator recipe,
  // so it must be discovered by ordinary automatic crafting with actual inputs.
  actor.inventory = [{ ...raw, itemId: raw._id, qty: 1 }];
  actor.equipped = {};
  actor.simCredits = 20;
  actor.hp = actor.maxHp - 2;
  actor.activeEffects = [makeRegenEffect(10, 2, 'recovery-match-fixture')];
  actor._growthPlan = null;
}
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const initialInput = JSON.stringify(input);
const fetchBefore = globalThis.fetch;
let apiCalls = 0, equippedFrames = 0, observedHeals = 0, healingReceipts = 0, lastCount = 0;
globalThis.fetch = () => { apiCalls++; throw new Error('The regression match must not access an account'); };
try {
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input),
    onFrame(frame, { events, publicItems }) {
      const fresh = events.slice(lastCount); lastCount = events.length;
      for (const event of fresh.filter(row => row.kind === 'heal')) {
        assert.ok(Number.isFinite(event.heal) && event.heal > 0);
        const actor = [...frame.survivors, ...frame.dead].find(row => row._id === event.who);
        const view = buildTeamObserverModel({ ...frame, teamId: actor.teamId, events, publicItems });
        // Recent history retains ten entries and the visible clock may still
        // be publishing this interval. Require real receipt history and actual
        // visible recovery frames, not permanent retention of every old tick.
        if (view.recent.some(row => row.kind === 'heal' && /실제 회복 HP \+/.test(row.text))) observedHeals++;
        healingReceipts++;
      }
      if (frame.survivors.some(actor => actor.equipped?.arm === gear._id)) equippedFrames++;
    } });
  const custom = original.events.filter(event => event.kind === 'craft' && event.itemId === gear._id);
  for (const actor of participants) {
    const receipt = custom.find(event => event.who === actor._id);
    assert.ok(receipt, `${actor.name} must automatically craft the administrator equipment`);
    assert.equal(receipt.paidCost, 7); assert.equal(receipt.beforeCredits - receipt.afterCredits, 7);
    assert.equal(receipt.qty, 1); assert.deepEqual(receipt.consumed, [{ itemId: raw._id, qty: 1 }]);
  }
  assert.ok(equippedFrames > 0 && observedHeals > 0 && healingReceipts > 0);
  assert.ok(original.logs.some(row => /체력 회복 HP \+/.test(row.text)));
  console.log(`HEALING_CRAFT_RECOVERY_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
    customCrafts: custom.length, equippedFrames, observedHeals, healingReceipts, evidence: original.evidence })}`);
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(initialInput), noisy: true });
  const comparable = result => ({ events: result.events, finalFrame: result.finalFrame, random: result.evidence.random,
    ending: result.evidence.ending });
  assert.equal(compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay))).matched, true);
  assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
  assert.equal(JSON.stringify(input), initialInput); assert.equal(apiCalls, 0);
  console.log(`HEALING_CRAFT_RECOVERY_MATCH_REPLAY ${JSON.stringify({ pass: true, engine: SIMULATION_ENGINE_VERSION,
    frameDigest: replay.evidence.frameDigest, apiCalls,
    scope: 'Real competitive phase-cycle automatic administrator crafting, payment, equipping, regeneration logs, observer and saved-input replay. The 24-actor recovery control runs separately.' })}`);
} finally { globalThis.fetch = fetchBefore; }
