import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { createPhaseActionTimeline, lockActorActionTime } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { runActorPostActionPhase } = await import('../src/app/simulation/_lib/phaseActorPostActionRuntime.js');
const { applyActorPhaseStatusTick } = await import('../src/app/simulation/_lib/phaseActorStatusRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { runSimulationPhaseCycle } = await import('../src/app/simulation/_lib/simulationPhaseCycleRuntime.js');
const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { buildBaseZoneGraph, buildHyperloopZoneGraph, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { getForbiddenZoneIdsForPhase, getForbiddenAddedZoneIdsForPhase } = await import('../src/app/simulation/_lib/forbiddenZoneRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { autoEquipBest } = await import('../src/app/simulation/_lib/gearFallbackRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const eventActions = await import('../src/app/simulation/_lib/runEventRuntime.js');
const mastery = await import('../src/app/simulation/_lib/masteryProgressRuntime.js');
const combat = await import('../src/app/simulation/_lib/combatRuntime.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { summarizeFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const rules = getRuleset('ER_S11');
const fixture = (extra = {}) => ({ _id: 'fixture', name: 'fixture', hp: 100, maxHp: 100, zoneId: 'a', inventory: [], ...extra });
function freezeOwnedState(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.values(value).forEach((child) => freezeOwnedState(child, seen));
  Object.freeze(value);
}

await check('growth recurs on the shared clock, with no duplicate or end-boundary reward', () => {
  const growth = []; let elapsed = 0;
  const timeline = createPhaseActionTimeline({ durationSec: 60, intervalSec: 20, onGrowth: (sec) => growth.push(sec), onElapsed: (_, sec) => { elapsed += sec; } });
  [0, 0, 19, 20, 20, 60, 100, 0].forEach((sec) => timeline.advanceTo(sec));
  assert.deepEqual(growth, [0, 20, 40]);
  assert.equal(elapsed, 60);
});
await check('phase energy is awarded once, not once per growth opportunity', () => {
  const actor = fixture({ gadgetEnergy: 0 });
  for (let n = 0; n < 7; n += 1) runActorPostActionPhase({ state: { actor, ruleset: rules, phaseIdxNow: 2, useDetonation: true } });
  assert.equal(actor.gadgetEnergy, 10);
  runActorPostActionPhase({ state: { actor, ruleset: rules, phaseIdxNow: 3, useDetonation: true } });
  assert.equal(actor.gadgetEnergy, 20);
});
await check('skill action locks delay only participants, preserve longer locks, and do not move the world clock', () => {
  const actors = [fixture(), fixture({ _id: 'other', _actionReadyAtSec: 30 })];
  assert.equal(lockActorActionTime(actors, 19, 2.5), 21.5);
  assert.equal(actors[0]._actionReadyAtSec, 21.5);
  assert.equal(actors[1]._actionReadyAtSec, 30);
});
await check('zero elapsed growth does not tick effects; ten seconds tick only ten seconds', () => {
  let actor = fixture({ hp: 50, activeEffects: [{ name: '테스트 회복', tags: ['regen'], recovery: 2, remainingDuration: 10, durationUnit: 'sec' }] });
  actor = applyActorPhaseStatusTick({ state: { actor, elapsedSec: 0 } }).actor;
  assert.equal(actor.hp, 50);
  for (let n = 0; n < 15; n += 1) actor = applyActorPhaseStatusTick({ state: { actor, elapsedSec: 1 } }).actor;
  assert.equal(actor.hp, 70);
  assert.equal(actor.activeEffects.length, 0);
});
await check('detonation windows use current location and never pre-charge a full phase', () => {
  const state = { useDetonation: true, forbiddenIds: new Set(['a']), mapObj: { zones: ['a', 'b', 'c', 'd'].map((zoneId) => ({ zoneId })) }, phaseDurationSec: 100, ruleset: rules };
  let actors = [fixture({ detonationSec: 20, detonationMaxSec: 30, gadgetEnergy: 0, cooldowns: { weaponSkill: 10 } })];
  actors = runDetonationTickPhase({ state: { ...state, updatedSurvivors: actors, startOffsetSec: 0, endOffsetSec: 5 } }).updatedSurvivors;
  assert.equal(actors[0].detonationSec, 15);
  actors[0].zoneId = 'b';
  actors = runDetonationTickPhase({ state: { ...state, updatedSurvivors: actors, startOffsetSec: 5, endOffsetSec: 10 } }).updatedSurvivors;
  assert.equal(actors[0].detonationSec, 20);
  assert.equal(actors[0].cooldowns.weaponSkill, 0);
});
await check('cooldowns also elapse when no zone is forbidden', () => {
  const result = runDetonationTickPhase({ state: { useDetonation: true, ruleset: rules, phaseDurationSec: 100, startOffsetSec: 0, endOffsetSec: 3, updatedSurvivors: [fixture({ cooldowns: { weaponSkill: 10 } })] } });
  assert.equal(result.updatedSurvivors[0].cooldowns.weaponSkill, 7);
});
await check('dead, stunned and travelling actors do not get extra growth actions', () => {
  const rows = [fixture({ hp: 0 }), fixture({ _id: 'stun', activeEffects: [{ name: '기절', remainingDuration: 10 }] }), fixture({ _id: 'travel', _growthReadyAtSec: 25 }), fixture({ _id: 'skill', _actionReadyAtSec: 23 })];
  let opportunities = 0;
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: rows, actionIntervalSec: 20, currentActionSec: () => 20 }, actions: { emitRunEvent: () => { opportunities += 1; } } });
  assert.equal(opportunities, 0);
  assert.equal(result.updatedSurvivors.length, 3);
});
await check('display distinguishes action selections from successful crafts', () => {
  const result = buildRunActionSummary([{ kind: 'action_cycle', chosen: 'craft' }, { kind: 'craft' }, { kind: 'queue', chosen: 'craft' }]);
  assert.equal(result.growth.opportunities, 1);
  assert.equal(result.growth.craft, 1);
  assert.match(result.growthLine, /성공 횟수와 별개/);
});

const items = await loadGuestSimulationItemCatalog();
const byId = new Map(items.map((item) => [item._id, item]));
const itemMetaById = buildItemMetaById(items);
const itemNameById = buildItemNameById(items);
const itemKeyById = buildItemKeyById(items);
const craftables = buildCraftableItems(items);
await check('a real recipe can craft again in the same phase, but never twice in one action', () => {
  const target = items.find((item) => item.type === '재료' && item.recipe.ingredients.length === 2 && item.recipe.ingredients.every((row) => byId.get(row.itemId)?.type === '재료'));
  const actor = fixture({ _actionCycleKey: '2:0' });
  const refill = () => { for (const row of target.recipe.ingredients) actor.inventory = addItemToInventory(actor.inventory, byId.get(row.itemId), row.itemId, row.qty, 1, rules); };
  refill();
  assert.equal(tryAutoCraftFromInventory(actor, [target], itemNameById, itemMetaById, 1, 2, rules)?.craftedId, target._id);
  refill();
  assert.equal(tryAutoCraftFromInventory(actor, [target], itemNameById, itemMetaById, 1, 2, rules), null);
  actor._actionCycleKey = '2:20';
  assert.equal(tryAutoCraftFromInventory(actor, [target], itemNameById, itemMetaById, 1, 2, rules)?.craftedId, target._id);
  assert.equal(invQty(actor.inventory, target._id), 2);
  actor._actionCycleKey = '2:40';
  assert.equal(tryAutoCraftFromInventory(actor, [target], itemNameById, itemMetaById, 1, 2, rules), null);
});

await check('actual guest phase cycle interleaves growth and combat without network or duplicate setup', async () => {
  const originalRandom = Math.random;
  const originalFetch = globalThis.fetch;
  const initialSeed = Number(process.env.EH_MATCH_SEED || 1101);
  let seed = initialSeed;
  let apiCalls = 0;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  globalThis.fetch = () => { apiCalls += 1; throw new Error('Guest timeline must not request a server.'); };
  try {
    const map = buildGuestSimulationMap();
    const settings = getDefaultSimulationSettings();
    if (process.env.EH_MATCH_MODE === 'solo') settings.matchMode = 'solo';
    const baseGraph = buildBaseZoneGraph(map, map.zones);
    const loops = map.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId);
    const graph = buildHyperloopZoneGraph(baseGraph, map.zones, loops);
    const { shuffledChars } = buildInitialSimulationRoster({ charList: buildGuestSimulationRoster(), routeItems: items, initialMap: map, initialZoneIds: map.zones.map((zone) => zone.zoneId), loadedSettings: settings });
    shuffledChars.forEach((actor) => { actor._itemKeyById = itemKeyById; });
    const state = { activeMap: map, activeMapId: map._id, autoSpeed: 32, settings, day: 0, phase: 'night', matchSec: 0, dead: [], survivors: shuffledChars, killCounts: {}, assistCounts: {}, spawnState: null, publicItems: items, craftables, itemMetaById, itemNameById, itemKeyById, zones: map.zones, zoneGraph: graph, kiosks: [], droneOffers: [] };
    const refs = Object.fromEntries(Object.entries({ activeMap: map, activeMapId: map._id, autoSpeed: 32, fullLogEntries: [], startStarterLoadoutApplied: false, suddenDeathActive: false, suddenDeathEndAtSec: null, suddenDeathForbiddenAnnounced: false }).map(([key, value]) => [`${key}Ref`, { current: value }]));
    const events = [];
    let latestFrame; let previousFrame; let observedEventCount = 0;
    const expectedLife = new Map(shuffledChars.map((actor) => [actor._id, true]));
    const frameStats = { frames: 0, midPhaseMoves: 0, midPhaseHpChanges: 0, midPhaseGearChanges: 0, revivals: 0, observerSamples: 0 };
    const phaseOnly = process.env.EH_FRAME_COMMIT_MODE === 'phase';
    let saves = 0; let clockTicks = 0; let finished = false; let finishOptions;
    const emitRunEvent = (kind, payload, at) => events.push({ kind, ...payload, at });
    const addLog = (text, type) => refs.fullLogEntriesRef.current.push({ text, type });
    const actions = { addLog, emitRunEvent, waitForVisibleTick: async (_delay, clock) => {
      assert.ok(clock.elapsedSec > 0);
      clockTicks = Math.round((clockTicks + clock.elapsedSec) * 1e6) / 1e6;
    }, normalizeAutoSpeed: Number,
      resetPhaseLogs: () => {}, setForbiddenAddedNow: () => {}, setPendingTranscendPick: () => {},
      persistSimEquipmentsFromChars: async () => { saves += 1; }, finishGame: (_alive, _kills, _assists, options) => { finished = true; finishOptions = options; },
      grantMastery: mastery.grantMastery, grantMasteries: mastery.grantMasteries,
      grantPvpDamageMastery: mastery.grantPvpDamageMastery, grantPvpKillMastery: mastery.grantPvpKillMastery,
      applyErTraitAfterBattle: combat.applyErTraitAfterBattle, applyErWeaponSkillAfterCombat: combat.applyErWeaponSkillAfterCombat,
    };
    for (const field of ['day', 'phase', 'matchSec', 'dead', 'survivors', 'spawnState', 'killCounts', 'assistCounts']) {
      actions[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
    }
    actions.setSimulationFrame = (frame) => {
      const aliveIds = new Set(frame.survivors.map((actor) => actor._id));
      const deadIds = new Set(frame.dead.map((actor) => actor._id));
      assert.equal(aliveIds.size + deadIds.size, 24, 'Every published frame preserves the full roster, including during revival.');
      assert.ok([...aliveIds].every((id) => !deadIds.has(id)));
      assert.ok(frame.dead.every((actor) => actor.hp === 0));
      for (const event of events.slice(observedEventCount)) {
        assert.ok(!Number.isFinite(event.at?.sec) || event.at.sec <= frame.matchSec, 'The displayed clock cannot precede resolved events.');
        if (event.kind === 'death') expectedLife.set(event.who, false);
        if (event.kind === 'revive') { expectedLife.set(event.who, true); frameStats.revivals += 1; }
      }
      observedEventCount = events.length;
      for (const [id, alive] of expectedLife) assert.equal(aliveIds.has(id), alive, `Life-state event and frame disagree for ${id} at ${frame.matchSec}.`);
      if (previousFrame) {
        assert.ok(frame.matchSec >= previousFrame.matchSec);
        if (frame.day === previousFrame.day && frame.phase === previousFrame.phase && frame.matchSec > previousFrame.matchSec) {
          for (const actor of frame.survivors) {
            const previous = previousFrame.survivors.find((row) => row._id === actor._id);
            if (!previous) continue;
            frameStats.midPhaseMoves += Number(actor.zoneId !== previous.zoneId);
            frameStats.midPhaseHpChanges += Number(actor.hp !== previous.hp);
            frameStats.midPhaseGearChanges += Number(JSON.stringify(actor.equipped) !== JSON.stringify(previous.equipped));
          }
        }
      }
      frameStats.frames += 1;
      if (frame.matchSec % 40 === 0) {
        freezeOwnedState(frame);
        const rngBefore = seed;
        const selectedTeam = `team:${(Math.floor(frame.matchSec / 40) % 8) + 1}`;
        const view = buildTeamObserverModel({ ...frame, events, teamId: selectedTeam, publicItems: items });
        assert.equal(seed, rngBefore, 'Reading/changing watched teams must not change game randomness.');
        assert.ok(view.team && view.members.length > 0);
        assert.equal(view.teams.reduce((sum, team) => sum + team.members.length, 0), 24);
        assert.equal(view.team.alive, view.members.filter((member) => member.alive).length);
        assert.ok(view.recent.every((event) => event.sec <= frame.matchSec));
        for (const member of view.members) {
          const current = [...frame.survivors, ...frame.dead].find((actor) => actor._id === member.id);
          assert.equal(member.hp, Math.max(0, Math.floor(current.hp)));
          assert.equal(member.alive, Number(current.hp) > 0);
        }
        frameStats.observerSamples += 1;
      }
      latestFrame = frame;
      previousFrame = frame;
      if (!phaseOnly) Object.assign(state, frame);
    };
    for (const name of ['emitItemGainIfAny', 'emitCraftRunEvent', 'emitObjectiveRunEvent', 'emitQueueRunEvent', 'emitEffectRunEvents', 'emitConsumableRunEvent']) actions[name] = (...args) => eventActions[name](emitRunEvent, ...args);
    // Same state adapter as useSimulationEventActions; gameplay uses real modules.
    actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => {
      if (!result?.inventory) return false;
      actor.inventory = result.inventory; autoEquipBest(actor, meta);
      mastery.grantCraftMastery(actor, result, meta);
      actions.emitCraftRunEvent(actor._id, result, at, zoneId || actor.zoneId);
      return true;
    };
    const forbiddenCache = new Map();
    const helpers = {
      getZoneName: (id) => map.zones.find((zone) => zone.zoneId === id)?.name || id,
      isHyperloopTransit: (from, to) => isHyperloopTransit(baseGraph, loops, from, to),
      getForbiddenZoneIdsForPhase: (m, d, p) => getForbiddenZoneIdsForPhase(m, d, p, map.zones, settings, forbiddenCache),
      getForbiddenAddedZoneIdsForPhase: (m, d, p) => getForbiddenAddedZoneIdsForPhase(m, d, p, map.zones, settings, forbiddenCache),
    };
    let phases = 0;
    while (!finished && phases < 24) {
      freezeOwnedState(state.survivors);
      freezeOwnedState(state.dead);
      freezeOwnedState(state.spawnState);
      await runSimulationPhaseCycle({ state, refs, actions, helpers });
      if (phaseOnly) Object.assign(state, latestFrame);
      phases += 1;
    }
    assert.ok(finished, 'A real match must finish within the bounded endgame, not merely survive a fixed test duration.');
    const endings = events.filter((event) => event.kind === 'match_end');
    assert.equal(endings.length, 1, 'One authoritative match ending.');
    assert.equal(endings[0].at.sec, state.matchSec);
    assert.equal(finishOptions.ending.atSec, state.matchSec);
    assert.ok(!events.some((event) => /sudden_death_(gather|clash|timeout)/.test(`${event.kind}:${event.reason || ''}`)));
    assert.ok(events.every((event) => !Number.isFinite(event.at?.sec) || event.at.sec <= state.matchSec), 'No events after the final match time.');
    const cycles = events.filter((event) => event.kind === 'action_cycle');
    const firstDay = cycles.filter((event) => event.at.day === 1 && event.at.phase === 'morning');
    assert.deepEqual([...new Set(firstDay.map((event) => event.at.sec))], [0, 20, 40, 60, 80, 100, 120]);
    assert.equal(new Set(firstDay.map((event) => event.who)).size, 24);
    assert.equal(events.filter((event) => event.kind === 'spawn_state').length, phases);
    assert.equal(saves, phases);
    assert.equal(apiCalls, 0);
    assert.ok(frameStats.frames >= state.matchSec);
    assert.ok(frameStats.midPhaseMoves > 0 && frameStats.midPhaseHpChanges > 0 && frameStats.midPhaseGearChanges > 0);
    if (settings.matchMode !== 'solo') assert.ok(frameStats.revivals > 0);
    assert.equal(clockTicks, state.matchSec, 'No extra display tick after the final team is decided.');
    const crafts = events.filter((event) => event.kind === 'craft');
    const battles = events.filter((event) => event.kind === 'battle');
    assert.ok(crafts.length > 0);
    assert.ok(battles.length > 0);
    assert.ok(cycles.some((event) => event.at.sec > battles[0].at.sec));
    assert.ok(crafts.some((event) => event.at.sec > battles[0].at.sec), 'Real crafting must continue after combat has started.');
    for (const event of cycles) assert.equal(event.at.sec % 10, 0, 'Growth cannot charge serial travel time to the shared clock.');
    assert.equal(new Set(cycles.map((event) => `${event.who}:${event.at.sec}`)).size, cycles.length);
    const deaths = events.filter((event) => event.kind === 'death');
    const timedEvents = events.filter((event) => ['craft', 'battle', 'action_cycle', 'death'].includes(event.kind));
    assert.ok(timedEvents.every((event, index) => index === 0 || event.at.sec >= timedEvents[index - 1].at.sec), 'Growth cannot be backdated behind an already resolved battle.');
    for (const death of deaths) {
      const later = cycles.find((event) => event.who === death.who && event.at.day === death.at.day && event.at.phase === death.at.phase && event.at.sec > death.at.sec);
      assert.ok(!later, `Dead actors must not act again in the same phase: ${JSON.stringify({ death, later })}`);
    }
    const growthPlans = events.filter((event) => event.kind === 'growth_plan');
    const growthComplete = new Set(growthPlans.filter((event) => event.completedSlots === event.totalSlots && event.totalSlots > 0).map((event) => event.who));
    const teamCombat = buildRunActionSummary(events).teamCombat;
    if (settings.matchMode !== 'solo') assert.ok(teamCombat.rounds > 0 && teamCombat.strikes > 0, 'Real squad matches must exercise team combat.');
    else assert.equal(teamCombat.assists, 0, 'Solo matches cannot award team assists.');
    for (const move of events.filter((event) => event.kind === 'move')) {
      assert.ok(graph[move.from]?.includes(move.to), `Travel must follow a real graph edge: ${JSON.stringify(move)}`);
      // Combat escape/chase have recovery locks; blink and knockback are skill
      // effects. Their events do not use the walking/hyperloop ETA field.
      if (move.transport || move.objectiveType === 'final_zone') assert.ok(move.etaSec > 0, 'Ordinary and endgame travel have a travel cost.');
    }
    const strikes = events.filter((event) => event.kind === 'team_strike');
    assert.equal(new Set(strikes.map((event) => `${event.encounterId}:${event.who}`)).size, strikes.length, 'A participant cannot attack twice in one round.');
    const supply = summarizeFieldResources(state.spawnState?.fieldResources);
    const resourceSummary = buildRunActionSummary(events).fieldResources;
    assert.ok(supply.initial > 0 && supply.taken > 0, 'Live matches must use shared field stock.');
    assert.equal(supply.initial, supply.remaining + supply.taken);
    assert.equal(supply.taken, resourceSummary.units, 'Every inventory-accepted field item has one stock transaction.');
    const remainingBySource = new Map();
    for (const event of events.filter((row) => row.kind === 'field_resource')) {
      const key = `${event.zoneId}:${event.itemId}`;
      const before = remainingBySource.get(key) ?? event.initial;
      assert.equal(event.remaining, before - event.qty, 'Stock must not reset across phases or actors.');
      assert.ok(event.remaining >= 0);
      remainingBySource.set(key, event.remaining);
    }
    const eventDigest = createHash('sha256').update(JSON.stringify(events)).digest('hex');
    console.log(JSON.stringify({ seed: initialSeed, phases, finished, ending: finishOptions.ending, frameStats, frameCommitMode: phaseOnly ? 'phase' : 'live', eventDigest, pressure: events.filter((event) => event.kind === 'endgame_zone'), clockTicks, growthOpportunities: cycles.length, recipeCrafts: crafts.length, battles: battles.length, spawnPasses: phases, equipmentSaves: saves, apiCalls, finalDay: state.day, finalPhase: state.phase, completedOpeningActors: growthComplete.size, teamCombat, supply, resourceSummary }));
  } finally { Math.random = originalRandom; globalThis.fetch = originalFetch; }
});
console.log(`ACTION_TIMELINE_CHECKS ${checks}/${checks}`);
