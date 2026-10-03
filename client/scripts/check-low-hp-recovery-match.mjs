import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { findItemByKeywords } = await import('../src/app/simulation/_lib/simulationCommon.js');
const { getRegionData } = await import('../src/app/simulation/_lib/lumiaRegionData.js');
const openingOnly = process.argv.includes('--probe-opening');
const withStarterFood = process.argv.includes('--with-starter-food');

// Fresh current catalog and actual phase-cycle execution, not a historic log
// fixture. Initial injuries/positions and one authored recipe are controlled.
// The default scenario omits starter steak from this authored catalog to test
// obtaining recovery instead of receiving free starting food. The companion
// --probe-opening --with-starter-food scenario keeps the full ordinary catalog.
// The paid-recipe case starts at the real hospital, which has no facility water;
// otherwise school water is legitimately used instead of the prepared recipe.
// Travel, shared stock, crafting, ordinary use, combat and clocks stay unchanged.
const fixture = JSON.parse(await createRandomIsolationInput('low-hp-recovery:competitive'));
const omittedStarterFood = [];
if (!withStarterFood) {
  let starter;
  while ((starter = findItemByKeywords(fixture.items, ['스테이크', 'sizzling steak']))) {
    omittedStarterFood.push(String(starter._id));
    fixture.items = fixture.items.filter(item => item !== starter);
  }
  assert.ok(omittedStarterFood.length > 0, 'The no-starter-food case must actually omit its grant.');
}
const startZone = withStarterFood ? 'school' : 'hospital';
assert.ok(fixture.map.zones.some(zone => zone.zoneId === startZone));
if (!withStarterFood) {
  assert.equal(Number(getRegionData(startZone)?.resources?.['물'] || 0), 0);
  assert.ok(!fixture.map.waterSourceZoneIds?.includes(startZone));
}
const raw = { _id: 'recovery:raw', name: '회복 통제 재료', type: '재료', tier: 1, spawnZones: [startZone] };
const meal = { _id: 'recovery:meal', name: '회복 통제 음식', type: 'food', category: 'consumable', tier: 2,
  spawnZones: [], consumeEffect: { version: 1, heal: 45 },
  recipe: { ingredients: [{ itemId: raw._id, qty: 1 }], resultQty: 1, creditsCost: 7 } };
fixture.items.push(raw, meal);
const injured = fixture.survivors.slice(0, 3);
const teamId = injured[0].teamId;
assert.ok(injured.every(actor => actor.teamId === teamId), 'Use a real three-member team.');
const otherZones = fixture.map.zones.map(zone => zone.zoneId).filter(id => id !== startZone);
for (const [index, actor] of fixture.survivors.entries()) {
  if (index >= injured.length && actor.zoneId === startZone) actor.zoneId = otherZones[index % otherZones.length];
}
for (const actor of injured) {
  actor.zoneId = startZone;
  actor.hp = 3;
  actor.inventory = [];
  actor.equipped = {};
  actor.activeEffects = [];
  actor.simCredits = 20;
  actor._growthPlan = null;
}
injured[0].inventory = [{ ...raw, itemId: raw._id, qty: 1 }];
injured[2].inventory = [{ ...meal, itemId: meal._id, qty: 1 }];

const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const initialInput = JSON.stringify(input);
const originalFetch = globalThis.fetch;
let apiCalls = 0;
const actualRecovered = new Set();
globalThis.fetch = () => { apiCalls++; throw new Error('Recovery must not access an account server.'); };
try {
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input),
    stopAfterPhase: openingOnly ? { day: 1, phase: 'morning' } : null,
    onFrame(frame) {
      for (const actor of frame.survivors) if (injured.some(row => row._id === actor._id) && actor.hp > 38) {
        actualRecovered.add(actor._id);
      }
      for (const resources of Object.values(frame.spawnState?.fieldResources?.byZone || {})) {
        for (const stock of Object.values(resources)) {
          assert.ok(stock.remaining >= 0 && stock.taken >= 0);
          assert.equal(stock.initial, stock.remaining + stock.taken, 'Only accepted actual pickups consume supply.');
        }
      }
    } });
  const uses = original.events.filter(event => event.kind === 'use' && event.source === 'consumable' && event.heal > 0);
  console.log(`LOW_HP_RECOVERY_TRACE ${JSON.stringify(injured.map(actor => ({ name: actor.name, id: actor._id,
    actualRecovered: actualRecovered.has(actor._id), uses: uses.filter(event => event.who === actor._id).length,
    firstActions: original.events.filter(event => event.who === actor._id && ['move', 'queue', 'rest', 'craft', 'use', 'death'].includes(event.kind))
      .slice(0, 16).map(event => ({ kind: event.kind, sec: event.at?.sec, reason: event.reason, chosen: event.chosen,
        itemId: event.itemId, heal: event.heal, hp: event.hp, from: event.from, to: event.to })),
    final: [...original.finalFrame.survivors, ...original.finalFrame.dead].filter(row => row._id === actor._id)
      .map(row => ({ hp: row.hp, zoneId: row.zoneId, cause: row._deathBy, inventory: row.inventory.map(item => item.itemId) }))
  })))}`);
  for (const actor of injured) {
    assert.ok(uses.some(event => event.who === actor._id), `${actor.name} must actually consume healing, not just announce rest.`);
    assert.ok(actualRecovered.has(actor._id), `${actor.name} must actually recover above the rest threshold.`);
  }
  const phaseUses = new Map();
  for (const event of original.events.filter(event => event.kind === 'use' && event.source === 'consumable' && !event.manual)) {
    assert.ok(Number.isFinite(event.at?.sec) && Number.isFinite(event.at?.day) && typeof event.at?.phase === 'string');
    const key = `${event.who}:${event.at.day}:${event.at.phase}`;
    const count = (phaseUses.get(key) || 0) + 1;
    phaseUses.set(key, count);
    assert.ok(count <= 1, 'Recovery planning cannot bypass the ordinary once-per-phase limit.');
  }
  if (openingOnly) {
    console.log(`LOW_HP_RECOVERY_OPENING_PROBE ${JSON.stringify({ scope: 'Opening only, not the complete match or replay gate.',
      withStarterFood, startZone, omittedStarterFood, recovered: actualRecovered.size, evidence: original.evidence })}`);
  } else {
    assert.equal(withStarterFood, false, 'The complete paid-recipe case uses the controlled no-starter-food catalog.');
    const receipt = original.events.find(event => event.kind === 'craft' && event.itemId === meal._id && event.who === injured[0]._id);
    assert.ok(receipt, 'The prepared recovery recipe must commit its actual craft.');
    assert.deepEqual(receipt.consumed, [{ itemId: raw._id, qty: 1 }]);
    assert.equal(receipt.paidCost, 7);
    assert.equal(receipt.beforeCredits - receipt.afterCredits, 7);
    assert.equal(receipt.qty, 1);
    const craftedDose = uses.find(event => event.itemId === meal._id && event.who === injured[0]._id);
    assert.ok(Number.isFinite(receipt.at?.sec));
    assert.ok(craftedDose && craftedDose.at.sec >= receipt.at.sec);
    assert.equal(craftedDose.heal, 45);
    assert.ok(actualRecovered.has(injured[0]._id));
    assert.ok(actualRecovered.has(injured[2]._id));
    const resumedGrowth = original.events.filter(event => event.kind === 'craft' && event.who === injured[0]._id
      && event.itemId !== meal._id && event.at.sec >= craftedDose.at.sec);
    assert.ok(resumedGrowth.length > 0, 'Equipment growth must resume after real recovery.');
    console.log(`LOW_HP_RECOVERY_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
      omittedStarterFood, startZone,
      injured: injured.map(actor => actor._id), healedActors: injured.filter(actor => uses.some(event => event.who === actor._id)).length,
      actualRecovered: actualRecovered.size, resumedCrafts: resumedGrowth.length,
      healingUses: uses.length, paidRecipe: { itemId: receipt.itemId, consumed: receipt.consumed, paidCost: receipt.paidCost,
        craftedAt: receipt.at.sec, usedAt: craftedDose.at.sec, actualHeal: craftedDose.heal }, evidence: original.evidence })}`);
    const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(initialInput), noisy: true });
    const comparable = result => ({ events: result.events, finalFrame: result.finalFrame, random: result.evidence.random,
      summary: { ending: result.evidence.ending } });
    assert.equal(compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay))).matched, true);
    assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
    assert.equal(JSON.stringify(input), initialInput);
    assert.equal(apiCalls, 0);
    console.log(`LOW_HP_RECOVERY_MATCH_REPLAY ${JSON.stringify({ pass: true, engine: SIMULATION_ENGINE_VERSION,
      frameDigest: replay.evidence.frameDigest, apiCalls,
      scope: 'Current 24-actor competitive phase cycle with an authored no-starter-steak catalog: real low-HP crafting, consumption, stock, resumed growth and complete saved-input replay with UI noise. Not human acceptance or browser performance.' })}`);
  }
} finally { globalThis.fetch = originalFetch; }
