import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runActorQueuedActionStep } = await import('../src/app/simulation/_lib/phaseActorQueuedActionStepRuntime.js');
const { runActorPostActionPhase } = await import('../src/app/simulation/_lib/phaseActorPostActionRuntime.js');
const { openLegendaryCrateForActor } = await import('../src/app/simulation/_lib/phaseLegendaryCrateRuntime.js');
const { runCraftAction } = await import('../src/app/simulation/_lib/phaseCraftActionRuntime.js');
const { setDeathMetadata } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');
const { applyLevelGrowth, grantMasteries } = await import('../src/app/simulation/_lib/masteryProgressRuntime.js');
const { createInitialMasteryState } = await import('../src/utils/masteryLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');

let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}

const mithril = { _id: 'mithril', name: '미스릴', type: 'material', tier: 4, tags: ['mithril'] };
const cloth = { _id: 'cloth', name: '천', type: 'material', tier: 1 };
const meat = { _id: 'meat', name: '고기', type: 'material', tier: 1 };
const helmet = { _id: 'helmet', name: '완성 머리', type: 'equipment', equipSlot: 'head', tier: 5,
  recipe: { ingredients: [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: 1 }] } };
const items = [mithril, cloth, meat, helmet];
const names = Object.fromEntries(items.map((item) => [item._id, item.name]));
const meta = Object.fromEntries(items.map((item) => [item._id, item]));
const baseRules = getRuleset('ER_S11');
const ruleset = { ...baseRules,
  inventory: { ...baseRules.inventory, maxSlots: 10, stackMax: { material: 6, equipment: 1 }, autoDropLowValue: false },
  worldSpawns: { ...baseRules.worldSpawns, bossFallback: { retreatBase: 1 },
    bosses: { alpha: { dropKeywords: ['미스릴'], dmg: { min: 10, base: 10, scaleDiv: 100000 },
      reward: { credits: { min: 7, max: 7 }, bonusDropChance: 0 } } },
    legendaryCrate: { openChance: { day: { moved: 1, stay: 1 } } },
  },
};
const held = (item, qty = 1) => ({ itemId: item._id, name: item.name, type: item.type, tier: item.tier, qty });
const actor = (extra = {}) => ({ _id: 'a', name: '사냥자', zoneId: 'z', hp: 1, maxHp: 100,
  stats: { maxHp: 100, attackPower: 1, defense: 0, skillAmp: 0, hpGrowth: 50 },
  simCredits: 0, inventory: [held(cloth)], activeEffects: [], gadgetEnergy: 0, _actionCycleKey: '4:20', ...extra });
const world = (extra = {}) => ({ bosses: { alpha: { alive: true, zoneId: 'z' } },
  wildlife: { z: 2 }, wildlifeSpecies: { z: ['bear', 'bear'] },
  legendaryCrates: [{ id: 'crate', zoneId: 'z', opened: false }], ...extra });
const state = (subject, spawn, extra = {}) => ({ actor: subject, nextSpawn: spawn,
  publicItems: items, craftables: [helmet], itemNameById: names, itemMetaById: meta, ruleset,
  nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, goalMissingIds: new Set(),
  mapObj: { zones: [{ zoneId: 'z', name: '사냥터' }], crates: [] },
  kiosks: [], canReviveThisMatch: true, reviveCutoffIdx: 6, ...extra });

function capture() {
  const calls = { events: [], logs: [], crafts: [], masteries: [] };
  const actions = {
    atNow: () => ({ day: 3, phase: 'morning', sec: 20 }),
    addLog: (text, type) => calls.logs.push({ text, type }),
    setDeathMetadata: (subject, reason, details) => setDeathMetadata(subject, reason, details, () => 20),
    emitDeathRunEventOnce: (subject, payload) => calls.events.push({ type: 'death', who: subject._id, hp: subject.hp, ...payload }),
    emitRunEvent: (type, payload) => calls.events.push({ type, ...payload }),
    emitItemGainIfAny: (qty, payload) => { if (qty > 0) calls.events.push({ type: 'gain', qty, ...payload }); },
    emitObjectiveRunEvent: (subject, objective, payload) => calls.events.push({ type: 'objective', who: subject._id, objective, ...payload }),
    grantMasteries: (subject, entries, reason) => {
      calls.masteries.push({ hp: subject.hp, entries });
      return grantMasteries(subject, entries, reason);
    },
    applyLootCraftResult: (subject, result) => {
      calls.crafts.push(result);
      applyLootCraftResult(subject, result, meta);
    },
  };
  return { calls, actions };
}

function hunt(subject = actor(), spawn = world(), extra = {}, observed = capture()) {
  const result = withSimulationRandom(() => 0, () => runHuntAction({ state: state(subject, spawn, extra), actions: observed.actions }));
  return { result, subject, spawn, ...observed };
}

check('lethal boss settlement records death before experience or rewards', () => {
  const { result, subject, spawn, calls } = hunt();
  assert.equal(result.died, true);
  assert.equal(subject.hp, 0);
  assert.equal(subject.deathReason, 'wildlife_hunt');
  assert.equal(subject._deathAt, 20);
  assert.equal(subject.deadAtPhaseIdx, 4);
  assert.equal(subject.reviveEligible, true);
  assert.equal(spawn.bosses.alpha.alive, false);
  assert.equal(calls.events[0].type, 'death');
  assert.equal(calls.masteries[0].hp, 0);
});

check('simultaneous kill retains its loot but cannot craft, equip or gain danger', () => {
  const { subject, calls } = hunt();
  assert.equal(subject.simCredits, 7);
  assert.equal(invQty(subject.inventory, mithril._id), 1);
  assert.equal(invQty(subject.inventory, cloth._id), 1);
  assert.equal(invQty(subject.inventory, helmet._id), 0);
  assert.equal(subject.equipped?.head, undefined);
  assert.equal(subject._specialCraftCount, undefined);
  assert.equal(subject._gatherPvpBonus, undefined);
  assert.equal(calls.crafts.length, 0);
  const gains = calls.events.filter((event) => event.type === 'gain');
  assert.ok(gains.length >= 2);
  assert.ok(gains.every((event) => event.posthumous && event.settlement === 'same_encounter'));
});

check('real mastery level-up cannot resurrect the lethally hit hunter', () => {
  const mastery = createInitialMasteryState();
  mastery.hunting.xp = 449;
  const subject = actor({ mastery });
  const { result } = hunt(subject);
  assert.equal(result.died, true);
  assert.ok(subject.erLevel >= 2);
  assert.ok(subject.maxHp > 100);
  assert.equal(subject.hp, 0);
});

check('level growth still heals living actors and grows dead maximum HP without revival', () => {
  const levelUp = { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 };
  const living = actor({ hp: 20 });
  const dead = actor({ hp: 0 });
  applyLevelGrowth(living, levelUp);
  applyLevelGrowth(dead, levelUp);
  assert.equal(living.hp, 70);
  assert.equal(dead.hp, 0);
  assert.ok(dead.maxHp > 100);
});

check('stale wasAlive input cannot hide a new death of a currently living actor', () => {
  const { result, calls } = hunt(actor(), world(), { wasAlive: false });
  assert.equal(result.died, true);
  assert.equal(calls.events.filter((event) => event.type === 'death').length, 1);
});

check('revival eligibility honors mode and cutoff without reviving during settlement', () => {
  for (const extra of [{ canReviveThisMatch: false }, { reviveCutoffIdx: 3 }]) {
    const { subject, result } = hunt(actor(), world(), extra);
    assert.equal(result.died, true);
    assert.equal(subject.hp, 0);
    assert.equal(subject.reviveEligible, false);
  }
});

check('surviving hunter can still craft the earned rare recipe', () => {
  const { result, subject, calls } = hunt(actor({ hp: 100 }));
  assert.equal(result.died, false);
  assert.ok(subject.hp > 0);
  assert.equal(invQty(subject.inventory, helmet._id), 1);
  assert.equal(subject.equipped.head, helmet._id);
  assert.equal(subject._specialCraftCount, 1);
  assert.equal(calls.events.filter((event) => event.type === 'death').length, 0);
});

check('invulnerability prevents hunting damage without fabricating a death', () => {
  const subject = actor({ activeEffects: [{ name: '무적', durationUnit: 'sec', remainingDuration: 10 }] });
  const { result, calls } = hunt(subject);
  assert.equal(result.died, false);
  assert.ok(subject.hp > 0);
  assert.equal(calls.events.find((event) => event.type === 'hunt_settlement').damage, 0);
});

check('dead or disabled hunters cannot consume any target or loot crate', () => {
  for (const subject of [actor({ hp: 0 }), actor({ hp: NaN }), actor({
    activeEffects: [{ name: '기절', remainingDuration: 3, durationUnit: 'sec' }],
  })]) {
    const spawn = world();
    const before = structuredClone(spawn);
    const { result, calls } = hunt(subject, spawn);
    assert.equal(result.hunt, null);
    assert.deepEqual(spawn, before);
    assert.equal(calls.events.length, 0);
    assert.equal(calls.masteries.length, 0);
  }
});

check('one JSON-restored action cannot settle an additional live target', () => {
  const observed = capture();
  const subject = actor({ hp: 100, inventory: [] });
  const spawn = world();
  hunt(subject, spawn, { craftables: [] }, observed);
  const restored = JSON.parse(JSON.stringify(subject));
  const restoredSpawn = JSON.parse(JSON.stringify(spawn));
  const before = structuredClone(restoredSpawn);
  const eventsBefore = observed.calls.events.length;
  const second = hunt(restored, restoredSpawn, { craftables: [] }, observed);
  assert.equal(second.result.reason, 'already_settled');
  assert.deepEqual(restoredSpawn, before);
  assert.equal(observed.calls.events.length, eventsBefore);
});

check('next scheduled action can hunt a different remaining target', () => {
  const subject = actor({ hp: 100, inventory: [] });
  const spawn = world({ mutantWildlife: { alive: true, zoneId: 'z', animal: '멧돼지' } });
  hunt(subject, spawn, { craftables: [] });
  subject._actionCycleKey = '4:40';
  const { result } = hunt(subject, spawn, { craftables: [] });
  assert.equal(result.hunt.kind, 'mutant_wildlife');
  assert.equal(result.hunt.defeated, true);
  assert.equal(spawn.mutantWildlife.alive, false);
});

check('retreat from an unconfigured boss is not a successful kill or earned mastery', () => {
  const subject = actor({ hp: 100, inventory: [] });
  const spawn = world();
  const { result, calls } = hunt(subject, spawn, { publicItems: [], craftables: [] });
  assert.equal(result.hunt.defeated, false);
  assert.equal(spawn.bosses.alpha.alive, true);
  assert.equal(subject.simCredits, 0);
  assert.equal(calls.masteries.length, 0);
  assert.equal(calls.events.some((event) => event.type === 'gain'), false);
  assert.equal(calls.events.find((event) => event.type === 'objective').success, false);
  assert.equal(calls.events.find((event) => event.type === 'hunt_settlement').defeated, false);
});

check('mutant and ordinary wildlife consumers expose actual defeat for settlement', () => {
  for (const spawn of [world({ bosses: {}, mutantWildlife: { alive: true, zoneId: 'z', animal: '멧돼지' } }),
    world({ bosses: {}, wildlife: { z: 1 }, wildlifeSpecies: { z: ['bear'] } })]) {
    const subject = actor({ hp: 1, stats: { maxHp: 1, attackPower: 0, defense: 0, skillAmp: 0, attackSpeed: 0.1 }, inventory: [] });
    const { result, calls } = hunt(subject, spawn, { craftables: [] });
    assert.equal(result.hunt.defeated, true);
    assert.equal(result.died, true);
    assert.equal(calls.crafts.length, 0);
    assert.ok(calls.events.some((event) => event.type === 'hunt_settlement' && event.died));
  }
});

check('lethal settlement records unreceived loot without discarding existing bag contents', () => {
  const subject = actor();
  const beforeInventory = structuredClone(subject.inventory);
  const limitedRules = { ...ruleset, inventory: { ...ruleset.inventory, maxSlots: 1 } };
  const { calls } = hunt(subject, world(), { ruleset: limitedRules });
  assert.deepEqual(subject.inventory, Object.assign(beforeInventory, { _lastAdd: subject.inventory._lastAdd }));
  assert.equal(invQty(subject.inventory, mithril._id), 0);
  const settled = calls.events.find((event) => event.type === 'hunt_settlement');
  assert.deepEqual(settled.receivedDrops, []);
  assert.ok(settled.unreceivedDrops.some((drop) => drop.itemId === mithril._id && drop.qty === 1));
});

check('queued hunting death exits before crate opening or post-action regeneration', () => {
  const subject = actor();
  const sourceActor = structuredClone(subject);
  const spawn = world();
  const observed = capture();
  const result = withSimulationRandom(() => 0, () => runActorQueuedActionStep({ actor: subject, sourceActor,
    actionPlan: { queuedActionType: 'hunt', goalMissingIds: new Set() }, state: state(subject, spawn), actions: observed.actions,
  }));
  assert.equal(result.newlyDead.length, 1);
  assert.equal(result.actor.deathReason, 'wildlife_hunt');
  assert.equal(result.actor.gadgetEnergy, 0);
  assert.equal(result.actor._postActionPhaseIdx, undefined);
  assert.equal(spawn.legendaryCrates[0].opened, false);
  assert.equal(observed.calls.events.filter((event) => event.type === 'death').length, 1);
});

check('post-action never relabels an already dead hunter as a forbidden-zone victim', () => {
  for (const forbiddenIds of [new Set(), new Set(['z'])]) {
    const subject = actor({ hp: 0, deathReason: 'wildlife_hunt', _deathBy: 'wildlife_hunt', deadAtPhaseIdx: 4 });
    const before = structuredClone(subject);
    const observed = capture();
    const result = runActorPostActionPhase({ state: state(subject, world(), {
      forbiddenIds, damagePerTick: 100, sourceActor: actor({ hp: 100 }), useDetonation: false,
    }), actions: observed.actions });
    assert.equal(result.died, false);
    assert.deepEqual(subject, before);
    assert.equal(observed.calls.events.length, 0);
  }
});

check('a newly living actor can die from actual forbidden-zone damage despite stale source HP', () => {
  const subject = actor({ hp: 5 });
  const observed = capture();
  const result = runActorPostActionPhase({ state: state(subject, world(), {
    forbiddenIds: new Set(['z']), damagePerTick: 10, sourceActor: actor({ hp: 0 }), useDetonation: false,
  }), actions: observed.actions });
  assert.equal(result.died, true);
  assert.equal(subject.deathReason, 'forbidden_zone');
  assert.equal(observed.calls.events.filter((event) => event.type === 'death').length, 1);
});

check('direct dead actor crate and craft entry points preserve both actor and world', () => {
  const subject = actor({ hp: 0, inventory: [held(cloth), held(mithril)] });
  const spawn = world();
  const before = structuredClone({ subject, spawn });
  const observed = capture();
  assert.equal(openLegendaryCrateForActor({ state: state(subject, spawn), actions: observed.actions }).opened, false);
  assert.equal(runCraftAction({ state: state(subject, spawn, { queuedActionType: 'craft' }), actions: observed.actions }).ran, false);
  assert.deepEqual({ subject, spawn }, before);
  assert.equal(observed.calls.events.length, 0);
});

check('same saved input deterministically reproduces death, loot and settlement events', () => {
  const initial = { subject: actor(), spawn: world() };
  const copy = JSON.parse(JSON.stringify(initial));
  const first = hunt(initial.subject, initial.spawn);
  const second = hunt(copy.subject, copy.spawn);
  assert.deepEqual(first.subject, second.subject);
  assert.deepEqual(first.spawn, second.spawn);
  assert.deepEqual(first.calls, second.calls);
});

console.log(`Hunt settlement: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
