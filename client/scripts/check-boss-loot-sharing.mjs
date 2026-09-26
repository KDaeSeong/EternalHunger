import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { chooseBossLootRecipient } = await import('../src/app/simulation/_lib/bossLootRecipientRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { advanceTimedWildlifeEffects, getWildlifeCombatRoster } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { updateEffects } = await import('../src/utils/statusLogic.js');
const { effect } = await import('./lib/run-combat-scenario.mjs');

// Explicit recipes test the actual settlement path, not official item balance.
const base = { _id: 'base-hat', name: '기본 모자', type: 'equipment', equipSlot: 'head', tier: 4, stats: { defense: 10 } };
const mithril = { _id: 'mithril', name: '미스릴', type: 'material', tier: 4 };
const force = { ...mithril, _id: 'force', name: '포스 코어' };
const blood = { ...mithril, _id: 'blood', name: 'VF 혈액 샘플' };
const cloth = { ...mithril, _id: 'cloth', name: '천', tier: 1 };
const recipe = (material) => ({ ...base, _id: `hat-${material._id}`, itemKey: `hat-${material._id}`,
  name: `${material.name} 모자`, tier: material === blood ? 6 : 5, stats: { defense: 20 },
  recipe: { ingredients: [{ itemId: base._id, qty: 1 }, { itemId: material._id, qty: 1 }], creditsCost: 3, resultQty: 1 } });
const items = [base, mithril, force, blood, cloth, recipe(mithril), recipe(force), recipe(blood), recipe(cloth)];
const meta = Object.fromEntries(items.map((item) => [item._id, item]));
const names = Object.fromEntries(items.map((item) => [item._id, item.name]));
const held = (item, qty = 1) => ({ ...structuredClone(item), itemId: item._id, qty });
const fixture = (kind = 'alpha', material = mithril) => {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.inventory = { ...ruleset.inventory, autoDropLowValue: false, maxSlots: 10 };
  ruleset.worldSpawns.bosses[kind] = { dropKeywords: [material.name], dmg: { min: 0, base: 0, scaleDiv: 1 },
    reward: { credits: { min: 7, max: 7 }, bonusDropChance: 0 } };
  ruleset.worldSpawns.specialResourceDrops = { [kind]: [{ key: kind === 'alpha' ? 'mithril' : kind === 'omega' ? 'force_core' : 'vf_blood_sample', chance: 1 }] };
  const make = (_id, teamSlot) => ({ _id, name: _id, teamId: 'team:1', teamSlot, zoneId: 'z', hp: 1000, maxHp: 1000,
    stats: { maxHp: 1000, attackPower: 100, defense: 30, attackSpeed: 1, moveSpeed: 3.5, attackRange: 2, sightRange: 10 },
    inventory: [held(base)], equipped: { head: base._id }, simCredits: 20, activeEffects: [],
    routePlanTargetItemIds: [base._id], goalLoadouts: { legend: { headKey: recipe(cloth)._id } }, _actionCycleKey: '6:600' });
  const hunter = make('hunter', 1), crafter = make('crafter', 2), escort = make('escort', 3);
  crafter.goalLoadouts = { [material === blood ? 'transcend' : 'legend']: { headKey: recipe(material)._id } };
  if (material === blood) crafter.goalLoadouts.legend = { headKey: recipe(cloth)._id };
  const state = { actor: hunter, rewardRoster: [hunter, crafter, escort], publicItems: items, craftables: items.filter((item) => item.recipe),
    itemMetaById: meta, itemNameById: names, ruleset, nextDay: 4, nextPhase: 'morning', phaseIdxNow: 6,
    forbiddenIds: new Set(), kiosks: [], droneOffers: [],
    mapObj: { zones: [{ zoneId: 'z', name: '보스 지역' }] }, nextSpawn: { bosses: { [kind]: { alive: true, zoneId: 'z' } } } };
  for (const row of state.rewardRoster) refreshActorGrowthPlan(row, items, state);
  const events = [], logs = [];
  const emitRunEvent = (eventKind, payload, at) => emitSimulationRunEvent({ kind: eventKind, payload, at,
    actions: { enqueueRunEvent: (event) => events.push(structuredClone(event)) } });
  const actions = { atNow: () => ({ day: 4, phase: 'morning', sec: 600 }), emitRunEvent, addLog: (message) => logs.push(message),
    emitItemGainIfAny: (qty, payload, at) => { if (qty > 0) emitRunEvent('gain', { ...payload, qty }, at); },
    emitObjectiveRunEvent: (row, objective, payload, at) => emitRunEvent('objective', { who: row._id, objective, ...payload }, at),
    applyLootCraftResult: (row, result) => applyLootCraftResult(row, result, meta) };
  const run = (extra = {}) => withSimulationRandom(() => 0, () => runHuntAction({ state: { ...state, ...extra }, actions }));
  return { hunter, crafter, escort, state, events, logs, actions, run };
};
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

await check('an alpha drop goes to the present teammate who can actually craft, not always the hunter', () => {
  const input = fixture(); input.run();
  assert.equal(input.crafter.equipped.head, 'hat-mithril', JSON.stringify({ plan: input.crafter._growthPlan, inventory: input.crafter.inventory, logs: input.logs }));
  assert.equal(input.crafter.simCredits, 17);
  assert.equal(input.hunter.simCredits, 27, 'Kill credits stay with the hunter.');
  assert.equal(invQty(input.hunter.inventory, mithril._id), 0);
  assert.equal(invQty(input.crafter.inventory, mithril._id), 0);
  assert.equal(input.events.filter((event) => event.kind === 'gain' && event.itemId === mithril._id).length, 1);
  assert.equal(input.events.find((event) => event.kind === 'gain' && event.itemId === mithril._id).who, input.crafter._id);
});

await check('assignment is read-only and deterministic, and favors a completable recipe over another unfinished one', () => {
  const input = fixture();
  input.hunter.goalLoadouts = input.crafter.goalLoadouts;
  refreshActorGrowthPlan(input.hunter, items, input.state);
  input.hunter.inventory = []; // Same rare need, but also missing the base hat.
  const before = structuredClone(input.state.rewardRoster);
  for (const roster of [input.state.rewardRoster, [...input.state.rewardRoster].reverse()]) {
    const chosen = withSimulationRandom(() => { throw new Error('Allocation must not draw random numbers.'); }, () =>
      chooseBossLootRecipient({ hunter: input.hunter, roster, drop: { item: mithril, itemId: mithril._id },
        remaining: 1, publicItems: items, ruleset: input.state.ruleset }));
    assert.equal(chosen.actor._id, 'crafter'); assert.equal(chosen.qty, 1);
  }
  assert.deepEqual(input.state.rewardRoster, before);
});

await check('omega and Wickeline distribute actual force core and blood drops using their recipes', () => {
  for (const [kind, material] of [['omega', force], ['weakline', blood]]) {
    const input = fixture(kind, material); input.run();
    assert.equal(input.crafter.equipped.head, recipe(material)._id, input.logs.join('\n'));
    assert.equal(input.crafter.simCredits, 17);
    assert.equal(input.events.filter((event) => event.kind === 'gain' && event.itemId === material._id).length, 1);
  }
});

await check('dead, absent, enemy and other-space actors, plus solo mode, cannot receive a team share', () => {
  for (const scenario of ['dead', 'absent', 'enemy', 'space', 'solo']) {
    const input = fixture();
    if (scenario === 'dead') input.crafter.hp = 0;
    if (scenario === 'absent') input.crafter.zoneId = 'away';
    if (scenario === 'enemy') input.crafter.teamId = 'team:2';
    if (scenario === 'space') input.crafter._combatSpaceId = 'dimension_rift:test';
    const before = structuredClone(input.crafter);
    input.run({ isSoloMatch: scenario === 'solo' });
    assert.deepEqual(input.crafter, before, scenario);
    assert.equal(input.events.some((event) => event.allocationReason === 'recipe_need'), false, scenario);
  }
});

await check('an already owned material or completed goal cannot attract another reward through a stale plan', () => {
  for (const owned of [mithril, recipe(mithril)]) {
    const input = fixture(); input.crafter.inventory.push(held(owned));
    const before = structuredClone(input.crafter.inventory); input.run();
    assert.deepEqual(input.crafter.inventory, before);
    assert.equal(input.events.some((event) => event.allocationReason === 'recipe_need'), false);
  }
});

await check('crafting uses the recipient credits, never the hunter reward or a free completion', () => {
  const input = fixture(); input.crafter.simCredits = 0; input.run();
  assert.equal(invQty(input.crafter.inventory, mithril._id), 1);
  assert.equal(input.crafter.equipped.head, base._id);
  assert.equal(input.crafter.simCredits, 0); assert.equal(input.hunter.simCredits, 27);
});

await check('a full recipient bag falls back to the hunter, and full bags record one unreceived drop', () => {
  for (const allFull of [false, true]) {
    const input = fixture(); input.state.ruleset.inventory.maxSlots = 1;
    if (!allFull) input.hunter.inventory = [];
    input.run();
    assert.equal(invQty(input.crafter.inventory, mithril._id), 0);
    const receipt = input.events.find((event) => event.kind === 'hunt_settlement');
    assert.equal(receipt.sharedDrops, undefined);
    assert.equal(receipt.receivedDrops.reduce((sum, drop) => sum + drop.qty, 0), allFull ? 0 : 1);
    assert.equal(receipt.unreceivedDrops.reduce((sum, drop) => sum + drop.qty, 0), allFull ? 1 : 0);
  }
});

await check('a rolled stack is divided by actual need without multiplying it or hoarding the excess', () => {
  for (const reverse of [false, true]) {
    const input = fixture(); input.escort.goalLoadouts = input.crafter.goalLoadouts;
    refreshActorGrowthPlan(input.escort, items, input.state);
    if (reverse) input.state.rewardRoster.reverse();
    input.state.ruleset.worldSpawns.specialResourceDrops.alpha[0].qty = 3;
    input.run();
    assert.equal(input.crafter.equipped.head, recipe(mithril)._id);
    assert.equal(input.escort.equipped.head, recipe(mithril)._id);
    assert.equal(invQty(input.hunter.inventory, mithril._id), 1);
    const gains = input.events.filter((event) => event.kind === 'gain' && event.itemId === mithril._id);
    assert.deepEqual(gains.map((event) => [event.who, event.qty]), [['crafter', 1], ['escort', 1], ['hunter', 1]]);
    const receipt = input.events.find((event) => event.kind === 'hunt_settlement');
    assert.equal([...receipt.receivedDrops, ...receipt.sharedDrops, ...receipt.unreceivedDrops].reduce((sum, drop) => sum + drop.qty, 0), 3);
  }
});

await check('partial stack capacity conserves received, shared and unreceived quantities without retry loops', () => {
  const input = fixture();
  const target = { ...recipe(mithril), _id: 'double-hat', itemKey: 'double-hat',
    recipe: { ingredients: [{ itemId: base._id, qty: 1 }, { itemId: mithril._id, qty: 2 }], creditsCost: 3 } };
  input.state.publicItems = [...items, target]; input.crafter.goalLoadouts.legend.headKey = target._id;
  refreshActorGrowthPlan(input.crafter, input.state.publicItems, input.state);
  input.crafter.simCredits = 0;
  input.state.ruleset.inventory.stackMax = { ...input.state.ruleset.inventory.stackMax, material: 1 };
  input.state.ruleset.worldSpawns.specialResourceDrops.alpha[0].qty = 3;
  input.run();
  const receipt = input.events.find((event) => event.kind === 'hunt_settlement');
  assert.deepEqual(receipt.receivedDrops, [{ itemId: 'mithril', qty: 1 }]);
  assert.equal(receipt.sharedDrops[0].qty, 1); assert.equal(receipt.unreceivedDrops[0].qty, 1);
  assert.equal(invQty(input.crafter.inventory, mithril._id), 1);
  assert.equal(invQty(input.hunter.inventory, mithril._id), 1);
});

await check('the hunter can retain a genuinely needed reward under the same stable priority', () => {
  const input = fixture(); input.hunter.goalLoadouts = input.crafter.goalLoadouts;
  refreshActorGrowthPlan(input.hunter, items, input.state); input.run();
  assert.equal(input.hunter.equipped.head, 'hat-mithril'); assert.equal(input.hunter.simCredits, 24);
  assert.equal(input.crafter.equipped.head, base._id);
  assert.equal(input.events.some((event) => event.allocationReason === 'recipe_need'), false);
});

await check('the actual rolled item determines sharing, not a presumed alpha material', () => {
  const input = fixture(); input.state.ruleset.worldSpawns.specialResourceDrops.alpha = [{ key: 'force_core', chance: 1 }];
  input.run();
  assert.equal(invQty(input.hunter.inventory, force._id), 1);
  assert.equal(input.events.some((event) => event.kind === 'gain' && event.itemId === mithril._id), false);
  assert.equal(input.crafter.equipped.head, base._id);
});

await check('receiving a material does not interrupt an active cast or hunt to craft', () => {
  for (const key of ['_pendingCharacterCast', '_wildlifeHunt']) {
    const input = fixture(); input.crafter[key] = { id: 'busy-action' }; input.run();
    assert.equal(invQty(input.crafter.inventory, mithril._id), 1);
    assert.equal(input.crafter.equipped.head, base._id); assert.equal(input.crafter.simCredits, 20);
    assert.deepEqual(input.crafter[key], { id: 'busy-action' });
  }
});

await check('one receipt records the actual receiver and purpose, and repeat or restored calls cannot duplicate it', () => {
  const input = fixture(); input.run();
  assert.ok(input.logs.some((line) => /hunter.*보스 전리품 분배.*crafter.*미스릴.*미스릴 모자 제작 재료/.test(line)));
  const gain = input.events.find((event) => event.kind === 'gain' && event.itemId === mithril._id);
  assert.equal(gain.bossHunterId, 'hunter'); assert.equal(gain.targetItemId, 'hat-mithril');
  const receipt = input.events.find((event) => event.kind === 'hunt_settlement');
  assert.deepEqual(receipt.receivedDrops, []); assert.equal(receipt.sharedDrops[0].who, 'crafter');
  const before = JSON.stringify({ actors: input.state.rewardRoster, events: input.events, spawn: input.state.nextSpawn });
  assert.equal(input.run().reason, 'already_settled');
  assert.equal(input.run({ actor: structuredClone(input.hunter), rewardRoster: structuredClone(input.state.rewardRoster) }).reason, 'already_settled');
  assert.equal(JSON.stringify({ actors: input.state.rewardRoster, events: input.events, spawn: input.state.nextSpawn }), before);
});

await check('a simultaneous lethal kill retains the existing posthumous loot rule without acting through a teammate', () => {
  const input = fixture(); input.hunter.hp = 1;
  input.state.ruleset.worldSpawns.bosses.alpha.dmg = { min: 10, base: 10, scaleDiv: 1 };
  const result = input.run();
  assert.equal(result.died, true); assert.equal(invQty(input.hunter.inventory, mithril._id), 1);
  assert.equal(input.crafter.equipped.head, base._id);
  assert.equal(input.events.some((event) => event.allocationReason === 'recipe_need'), false);
});

await check('ordinary or mutant special drops keep the original personal reward policy', () => {
  for (const preparedHuntRole of ['ordinary', 'mutant']) {
    const input = fixture();
    input.run({ preparedHuntRole, preparedHunt: { kind: 'bear', defeated: true, damage: 0, credits: 7,
      drops: [{ item: mithril, itemId: mithril._id, qty: 1 }], log: 'test earned drop' } });
    assert.equal(invQty(input.hunter.inventory, mithril._id), 1);
    assert.equal(invQty(input.crafter.inventory, mithril._id), 0);
  }
});

await check('the legacy actor batch preserves transfers to both already processed and not-yet-processed teammates', () => {
  for (const reverse of [false, true]) {
    const input = fixture(); input.state.rewardRoster = [input.hunter, input.crafter];
    input.crafter.activeEffects = [effect('기절', 30)]; // Prevent the recipient from taking the boss first.
    if (reverse) input.state.rewardRoster.reverse();
    const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({
      state: { ...input.state, phaseSurvivors: input.state.rewardRoster, zoneGraph: { z: [] }, zones: input.state.mapObj.zones,
        itemKeyById: {}, statusElapsedSec: 0, currentActionSec: () => 600 }, actions: input.actions }));
    const recipient = result.updatedSurvivors.find((row) => row._id === 'crafter');
    assert.equal(invQty(recipient.inventory, mithril._id) + invQty(recipient.inventory, 'hat-mithril'), 1, input.logs.join('\n'));
    assert.equal(input.events.find((event) => event.kind === 'gain' && event.itemId === mithril._id).bossHunterId, 'hunter');
    assert.equal(input.events.filter((event) => event.kind === 'gain' && event.itemId === mithril._id).length, 1);
  }
});

await check('real timed alpha combat settles into the live teammate, not a stale planning copy', async () => {
  for (const scenario of ['present', 'left', 'goal_changed']) {
    const input = fixture(); let offset = 0, advanced = 0, frames = 0;
    input.actions.atNow = () => ({ day: 4, phase: 'morning', sec: 600 + offset });
    const start = input.run({ deferHuntSettlement: true, currentActionSec: () => 600 });
    assert.equal(start.pending, true); assert.equal(invQty(input.crafter.inventory, mithril._id), 0);
    let pending;
    withSimulationRandom(() => 0.4, () => { pending = runPvpActionLoop({
      state: { ...input.state, updatedSurvivors: input.state.rewardRoster, phaseSurvivors: input.state.rewardRoster,
        phaseDurationSec: 25, currentActionSec: () => 600 + offset, getPhaseRuntimeOffsetSec: () => offset,
        battleSettings: { characterSkillsEnabled: true },
        ruleset: { ...input.state.ruleset, pvp: { ...input.state.ruleset.pvp, teamCombatEnabled: false } } },
      actions: { ...input.actions,
        reserveActionSecond: (seconds) => { offset = Math.min(25, Math.round((offset + seconds) * 1e6) / 1e6); },
        advanceWorld: ({ survivorMap, offsetSec }) => {
          const elapsedSec = Math.max(0, offsetSec - advanced);
          if (elapsedSec > 0) {
            advanceSpatialMovement(getWildlifeCombatRoster([...survivorMap.values()]), 600 + advanced, elapsedSec);
            for (const [id, row] of survivorMap) survivorMap.set(id, updateEffects(row, { elapsedSec, startSec: 600 + advanced }));
            advanceTimedWildlifeEffects([...survivorMap.values()], { elapsedSec, startSec: 600 + advanced });
            if (advanced === 0 && scenario === 'left') survivorMap.get('crafter').zoneId = 'away';
            if (advanced === 0 && scenario === 'goal_changed') survivorMap.get('crafter').inventory.push(held(mithril));
          }
          advanced = offsetSec;
        },
        publishActionFrame: async () => { assert.ok(++frames < 1000); }, shouldEndMatch: () => false } }); });
    const result = await pending;
    const recipient = result.survivorMap.get('crafter');
    assert.equal(recipient.equipped.head, scenario === 'present' ? 'hat-mithril' : base._id, input.logs.join('\n'));
    assert.equal(recipient.simCredits, scenario === 'present' ? 17 : 20);
    assert.equal(input.events.some((event) => event.allocationReason === 'recipe_need'), scenario === 'present');
    assert.equal(input.state.nextSpawn.bosses.alpha.alive, false);
    assert.ok(input.events.some((event) => event.kind === 'damage' && event.who === 'hunter'));
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement').length, 1);
    assert.equal(input.events.filter((event) => event.kind === 'gain' && event.itemId === mithril._id).length, 1);
  }
});

console.log(`BOSS_LOOT_SHARING_CHECKS ${checks}/${checks}`);
