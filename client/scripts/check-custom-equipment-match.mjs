import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { saveGuestItem, mergeGuestItemCatalog } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { getCombatEquipment } = await import('../src/utils/battleEquipmentLogic.js');

const fixture = JSON.parse(await createRandomIsolationInput('HF6-equipment-match'));
const originalCatalog = JSON.stringify(fixture.items);
const water = fixture.items.find(item => item.name === '물' && item.spawnZones?.length);
assert.ok(water);
const custom = { _id: 'guest-item-crafted-rupture', name: '파열 관측 모자', type: '방어구', equipSlot: 'head', tier: 4,
  stats: { def: 10, hp: 20 }, recipe: { ingredients: [{ itemId: water._id, qty: 1 }], resultQty: 1, creditsCost: 3 },
  equipmentEffects: [{ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
    damage: { base: 20, perLevel: 1, attackPowerRatio: 0, skillAmpRatio: 0.25 } }] };
const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const saved = saveGuestItem(custom, fixture.items, storage);
assert.equal(saved.ok, true, saved.error);
fixture.items = mergeGuestItemCatalog(fixture.items, { storage });
// Explicit authored test conditions: the ordinary guest roster has no Q/W/E/R.
// Select a custom craft target for one team, but add no materials, credits or
// finished equipment. Normal starting supplies, farming and actual recipes run.
fixture.survivors.forEach((actor, index) => {
  actor.characterSkills = { q: { enabled: true, type: 'attack_skill', name: `관측 Q ${index}`,
    flatDamage: [15], cooldownSec: 8.5, castDelaySec: 0.25, recoveryDelaySec: 0.25 } };
  if (index < 3) {
    actor.routePlanTargetItemIds = [custom._id];
    actor._growthFocusId = custom._id; actor._growthPlan = null;
  }
});
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const inputBefore = JSON.stringify(input);
let cursor = 0, crafts = 0, equippedFrames = 0, observed = 0, apiCalls = 0;
const fetchBefore = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw Error('Authored equipment must not require account calls'); };
try {
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFrame(frame, { events, publicItems }) {
    const fresh = events.slice(cursor); cursor = events.length;
    for (const event of fresh.filter(row => row.kind === 'craft' && row.itemId === custom._id)) {
      assert.equal(event.qty, 1); assert.equal(event.paidCost, 3);
      assert.deepEqual(event.consumed, [{ itemId: water._id, qty: 1 }]); crafts++;
    }
    if (frame.survivors.some(actor => getCombatEquipment(actor).some(item => item.itemId === custom._id))) equippedFrames++;
    for (const event of fresh.filter(row => row.kind === 'equipment_effect')) {
      const who = [...frame.survivors, ...frame.dead].find(row => row._id === event.who);
      const observer = buildTeamObserverModel({ ...frame, settings: input.settings, publicItems, events, teamId: who.teamId });
      assert.ok(observer.recent.some(row => row.kind === 'equipment_effect' && row.sec === event.at.sec && row.text.includes(custom.name)));
      observed++;
    }
  } });
  const equipment = original.events.filter(row => row.kind === 'equipment_effect');
  const scheduled = equipment.filter(row => row.stage === 'scheduled'), fired = equipment.filter(row => row.stage === 'triggered');
  const cancelled = equipment.filter(row => row.stage === 'cancelled');
  const hits = original.events.filter(row => row.kind === 'damage' && row.equipmentEffectId);
  assert.ok(crafts > 0 && equippedFrames > 0 && scheduled.length > 0 && fired.length > 0 && hits.length > 0,
    JSON.stringify({ crafts, equippedFrames, scheduled: scheduled.length, fired: fired.length, hits: hits.length }));
  const pendingById = new Map(scheduled.map(row => [row.effectId, row]));
  assert.equal(pendingById.size, scheduled.length);
  const resolvedIds = new Set();
  for (const event of [...fired, ...cancelled]) {
    assert.ok(pendingById.has(event.effectId)); assert.equal(resolvedIds.has(event.effectId), false); resolvedIds.add(event.effectId);
    if (event.stage === 'triggered') assert.equal(event.at.sec, pendingById.get(event.effectId).dueAtSec);
  }
  for (const hit of hits) {
    assert.equal(hit.at.sec, pendingById.get(hit.equipmentEffectId).dueAtSec);
    assert.equal(hit.hpDamage, hit.hpBefore - hit.hpAfter);
    assert.ok(Math.hypot(hit.targetPosition.x - hit.centerPosition.x, hit.targetPosition.y - hit.centerPosition.y) <= hit.radius + 1e-6);
  }
  console.log(`CUSTOM_EQUIPMENT_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION, crafts, equippedFrames,
    scheduled: scheduled.length, fired: fired.length, cancelled: cancelled.length, hits: hits.length, observed, evidence: original.evidence })}`);
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(inputBefore), noisy: true });
  const comparable = result => ({ events: result.events, finalFrame: result.finalFrame, random: result.evidence.random, summary: { ending: result.evidence.ending } });
  const compared = compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay)));
  assert.equal(compared.matched, true); assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
  assert.equal(JSON.stringify(input), inputBefore); assert.notEqual(JSON.stringify(fixture.items), originalCatalog); assert.equal(apiCalls, 0);
  console.log(`CUSTOM_EQUIPMENT_MATCH_REPLAY ${JSON.stringify({ pass: true, compared, frameDigest: replay.evidence.frameDigest, apiCalls,
    scope: 'Authored/save/load, real ordinary recipe farming/crafting, equipped skill impacts, timed procs, health observations and saved-input complete replay. Not browser editor, real account storage or ER balance.' })}`);
} finally { globalThis.fetch = fetchBefore; }
