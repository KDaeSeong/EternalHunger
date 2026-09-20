import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { saveGuestItem, mergeGuestItemCatalog } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');

const fixture = JSON.parse(await createRandomIsolationInput('HF6-consumable-match'));
const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const originalCatalog = JSON.stringify(fixture.items);
const water = fixture.items.find(item => item.name === '물' && item.spawnZones?.length);
assert.ok(water, 'The recipe must use a real material from the ordinary catalog');
const custom = { _id: 'guest-item-crafted-dose', name: '검술 회복약', type: '소모품', tier: 4,
  recipe: { ingredients: [{ itemId: water._id, qty: 1 }], resultQty: 2, creditsCost: 3 }, consumeEffect: {
  version: 1, heal: 25, shield: 20, regen: 2, durationSec: 3.5, stats: { attackPower: 5 },
} };
const saved = saveGuestItem(custom, fixture.items, storage);
assert.equal(saved.ok, true, saved.error);
fixture.items = mergeGuestItemCatalog(fixture.items, { storage });
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
// No added inventory or in-match grants. A newly authored item must actually
// be crafted with real materials and credits in the ordinary game loop.
const inputBefore = JSON.stringify(input);
let count = 0, eventCursor = 0, acquired = 0;
const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFrame(frame, { events, publicItems }) {
  const fresh = events.slice(eventCursor); eventCursor = events.length;
  for (const event of fresh.filter(event => event.kind === 'craft' && event.itemId === custom._id)) {
    assert.equal(event.qty, 2);
    assert.equal(event.paidCost, 3);
    assert.deepEqual(event.consumed, [{ itemId: water._id, qty: 1 }]);
    acquired++;
  }
  for (const event of fresh.filter(event => event.kind === 'use' && event.itemId === custom._id)) {
    assert.ok(event.heal >= 0 && event.heal <= 25);
    assert.equal(event.satiety, 0);
    assert.ok(Number.isSafeInteger(event.remainingQty));
    assert.ok(event.effects.some(row => row.shield === 20 || row.regen === 2 || row.stats?.attackPower === 5));
    assert.ok(event.effects.every(row => row.durationSec === 3.5));
    const actor = [...frame.survivors, ...frame.dead].find(row => row._id === event.who);
    const observer = buildTeamObserverModel({ ...frame, settings: input.settings, publicItems, events, teamId: actor.teamId });
    assert.ok(observer.recent.some(row => row.kind === 'use' && row.sec === event.at.sec && row.text.includes(custom.name)));
    count++;
  }
} });
assert.ok(acquired > 0 && count > 0, `Expected actual acquisition/use: ${acquired}/${count}`);
console.log(`CUSTOM_CONSUMABLE_MATCH_ORIGINAL ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION, acquired, observedUses: count, evidence: original.evidence })}`);
const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(inputBefore), noisy: true });
const comparable = result => ({ events: result.events, finalFrame: result.finalFrame,
  random: result.evidence.random, summary: { ending: result.evidence.ending } });
const compared = compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay)));
assert.equal(compared.matched, true);
assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
assert.equal(JSON.stringify(input), inputBefore);
assert.notEqual(JSON.stringify(fixture.items), originalCatalog);
console.log(`CUSTOM_CONSUMABLE_MATCH_REPLAY ${JSON.stringify({ pass: true, compared, frameDigest: replay.evidence.frameDigest,
  scope: 'New local item authoring/save/load, real ordinary recipe crafting and use, observer receipts, complete saved-input replay. Not browser editor or physical storage.' })}`);
