import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { GUEST_ITEM_PROFILE_KEY, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildInitialFastRoutePlan, mergeInitialRoutePlanFields } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Fresh authored recipes atop the normal 24-participant world. Only declared
// goals/catalog inputs change; nobody receives materials, credits or gear.
const fixture = JSON.parse(await createRandomIsolationInput('deep-custom-natural-20261013'));
const initialActors = cloneReplayData(fixture.survivors);
assert.equal(initialActors.length, 24);
const profiles = [], specs = new Map();
for (const [index, stages, rawId] of [[0, 6, 'namu:material:고철'], [1, 24, 'namu:material:나뭇가지']]) {
  assert.ok(fixture.items.some(item => item._id === rawId));
  const ids = Array.from({ length: stages }, (_, step) => `guest-item-natural-${stages}-${step}`);
  ids.forEach((id, step) => profiles.push({ _id: id, name: `자연 파밍 ${stages}단계 ${step + 1}`,
    type: step === stages - 1 ? '방어구' : '재료', tier: step === stages - 1 ? 4 : 1, stackMax: 10,
    ...(step === stages - 1 ? { equipSlot: 'head', stats: { def: 5, hp: 12 } } : {}),
    recipe: { ingredients: [{ itemId: step ? ids[step - 1] : rawId, qty: 1 }], resultQty: 1, creditsCost: 1 },
  }));
  specs.set(fixture.survivors[index]._id, { index, stages, rawId, ids, targetId: ids.at(-1) });
}
const serialized = JSON.stringify({ schemaVersion: 1, items: profiles });
const authored = readGuestItems(fixture.items, { getItem(key) {
  assert.equal(key, GUEST_ITEM_PROFILE_KEY); return serialized;
} });
assert.equal(authored.ok, true, authored.error);
fixture.items.push(...authored.items);
for (const [who, spec] of specs) {
  const actor = fixture.survivors[spec.index];
  actor.goalLoadouts = { ...actor.goalLoadouts, hero: { ...actor.goalLoadouts?.hero, headKey: spec.targetId } };
  fixture.survivors[spec.index] = mergeInitialRoutePlanFields(actor, buildInitialFastRoutePlan(actor, fixture.map, fixture.items));
  assert.equal(fixture.survivors[spec.index]._id, who);
  assert.equal(fixture.survivors[spec.index].simCredits, initialActors[spec.index].simCredits);
  assert.deepEqual(fixture.survivors[spec.index].inventory, initialActors[spec.index].inventory);
  assert.equal(invQty(actor.inventory, spec.rawId), 0);
  for (const id of spec.ids) assert.equal(invQty(actor.inventory, id), 0);
  assert.ok(fixture.survivors[spec.index].routePlanTargetItemIds.includes(spec.targetId));
  assert.ok(fixture.survivors[spec.index].routePlanRequiredItemIds.includes(spec.rawId));
}
assert.deepEqual(fixture.survivors.slice(2), initialActors.slice(2));
const input = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const beforeInput = JSON.stringify(input);
const rules = getRuleset(input.settings.rulesetId || 'ER_S11');
const deadline = getPhaseDurationSec(rules, 1, 'morning') + getPhaseDurationSec(rules, 1, 'night');
const completed = new Map(), progress = new Map(), picked = new Map(), crafts = new Map();
const terms = new Map(authored.items.map(item => [item._id, item.recipe]));
let cursor = 0, apiCalls = 0;
const fetchBefore = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw Error('Natural custom farming must not access accounts or APIs'); };
try {
  console.log('Running natural 6/24-stage recipes with real stocks, starting credits and competition.');
  const original = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input),
    stopAfterPhase: { day: 1, phase: 'night' },
    onFrame(frame, { events, publicItems }) {
      const fresh = events.slice(cursor); cursor = events.length;
      for (const event of fresh) {
        const spec = specs.get(event.who);
        if (event.kind === 'field_resource' && spec && event.itemId === spec.rawId && !picked.has(event.who))
          picked.set(event.who, event.at.sec);
        if (event.kind !== 'craft' || !terms.has(event.itemId)) continue;
        const recipe = terms.get(event.itemId);
        assert.equal(event.receiptVersion, 1); assert.equal(event.qty, recipe.resultQty);
        assert.equal(event.paidCost, recipe.creditsCost);
        assert.equal(event.beforeCredits - event.afterCredits, event.paidCost);
        assert.deepEqual(event.consumed, recipe.ingredients);
        if (spec && spec.ids.includes(event.itemId)) {
          const rows = crafts.get(event.who) || [];
          rows.push(event); crafts.set(event.who, rows);
        }
      }
      for (const actor of frame.survivors) {
        if (!specs.has(actor._id)) continue;
        const spec = specs.get(actor._id);
        const growth = getActorGrowthProgress(actor, publicItems);
        progress.set(actor._id, { sec: frame.matchSec, zone: actor.zoneId, credits: actor.simCredits,
          totalSlots: growth.totalSlots, completedSlots: growth.completedSlots, openingComplete: growth.openingComplete,
          targetId: actor._growthPlan?.targetId, blocked: actor._growthPlan?.blocked,
          step: actor._growthPlan?.readyCraftId });
        if (actor.equipped?.head === spec.targetId && invQty(actor.inventory, spec.targetId) === 1)
          completed.set(actor._id, completed.get(actor._id) ?? frame.matchSec);
      }
    },
  });
  console.log(`DEEP_CUSTOM_NATURAL_OBSERVATION ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
    deadline, actualSec: original.finalFrame.matchSec,
    participants: [...specs].map(([who, spec]) => ({ who, stages: spec.stages,
      startingCredits: initialActors[spec.index].simCredits, pickedSec: picked.get(who),
      completedSec: completed.get(who), crafts: crafts.get(who)?.length || 0,
      aliveAtDeadline: original.finalFrame.survivors.some(actor => actor._id === who), last: progress.get(who) })),
    battles: original.events.filter(event => event.kind === 'battle').length })}`);
  assert.equal(original.finalFrame.matchSec, deadline);
  for (const [who, spec] of specs) {
    assert.ok(picked.has(who), `${who} must acquire its real leaf from shared world stock`);
    assert.ok(completed.has(who), `${who} must equip the deep custom target by the first-night deadline`);
    assert.ok(completed.get(who) < deadline);
    const rows = crafts.get(who) || [];
    assert.deepEqual(rows.map(event => event.itemId), spec.ids);
    assert.ok(rows[0].at.sec >= picked.get(who));
    assert.equal(rows.reduce((total, event) => total + event.paidCost, 0), spec.stages);
    assert.equal(new Set(rows.map(event => event.actionKey)).size, rows.length);
  }
  const remaining = new Map();
  for (const event of original.events.filter(row => row.kind === 'field_resource')) {
    const key = `${event.zoneId}:${event.itemId}`;
    assert.equal(event.remaining, (remaining.get(key) ?? event.initial) - event.qty);
    assert.ok(event.remaining >= 0); remaining.set(key, event.remaining);
  }
  assert.ok(original.events.some(event => event.kind === 'battle'));
  const replay = await runRandomIsolationMatch(null, { savedInput: JSON.parse(beforeInput), noisy: true,
    stopAfterPhase: { day: 1, phase: 'night' } });
  const comparable = result => ({ events: result.events, finalFrame: result.finalFrame,
    random: result.evidence.random, summary: { ending: result.evidence.ending } });
  const comparison = compareSimulationReplay(cloneReplayData(comparable(original)), cloneReplayData(comparable(replay)));
  assert.equal(comparison.matched, true); assert.equal(original.evidence.frameDigest, replay.evidence.frameDigest);
  assert.equal(JSON.stringify(input), beforeInput); assert.equal(apiCalls, 0);
  console.log(`DEEP_CUSTOM_NATURAL_REPLAY ${JSON.stringify({ pass: true, engine: SIMULATION_ENGINE_VERSION,
    comparison, frameDigest: replay.evidence.frameDigest, eventDigest: replay.evidence.eventDigest,
    frames: replay.evidence.frames, events: replay.events.length, apiCalls,
    scope: 'One current competitive 24-participant opening and saved-input repeat, actual natural leaf pickup, 6/24 paid crafts and equip. Not a full match, all authoring combinations, physical browser storage or human evaluation.' })}`);
} finally { globalThis.fetch = fetchBefore; }
