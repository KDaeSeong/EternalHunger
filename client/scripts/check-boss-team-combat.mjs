import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { getBossAssistOwner, getBossAssistAssignments, reconcileBossAssists } = await import('../src/app/simulation/_lib/bossAssistRuntime.js');
const { advanceTimedWildlifeEffects, getWildlifeCombatRoster, getWildlifeOwnerDamageDealt,
  resolveTimedWildlifeAction, releaseTimedWildlifeEncounter } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { advanceSpatialMovement, spatialDistance } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { findNextCombatAction, engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { updateEffects } = await import('../src/utils/statusLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { getWildlifeMasteryEntries } = await import('../src/utils/masteryLogic.js');

const items = [{ _id: 'mithril', name: '미스릴', type: 'material', tier: 4 },
  { _id: 'force', name: '포스 코어', type: 'material', tier: 4 },
  { _id: 'blood', name: 'VF 혈액 샘플', type: 'material', tier: 4 },
  { _id: 'meat', name: '고기', type: 'material', tier: 1 }];
const meta = Object.fromEntries(items.map((item) => [item._id, item]));
const names = Object.fromEntries(items.map((item) => [item._id, item.name]));
const makeActor = (id, attackSpeed = 1) => ({ _id: id, name: id, teamId: 'team:1', zoneId: 'z', hp: 1000, maxHp: 1000,
  stats: { maxHp: 1000, attackPower: 45, defense: 20, attackSpeed, moveSpeed: 3.5, attackRange: 2, sightRange: 12 },
  inventory: [], equipped: {}, activeEffects: [], simCredits: 0, tacticalSkill: 'none',
  _spatial: { zoneId: 'z', x: 8, y: 8 }, _actionCycleKey: '2:100' });
function fixture(kind = 'alpha') {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.ai = { ...ruleset.ai, escapeHpBelow: 0, recoverHpBelow: 0, huntRetreatHpRatio: 0.05 };
  ruleset.pvp = { ...ruleset.pvp, criticalFleeChance: 0, criticalFleeHpBelow: 0 };
  ruleset.worldSpawns.bosses.alpha.reward = { credits: { min: 7, max: 7 }, bonusDropChance: 0 };
  ruleset.worldSpawns.specialResourceDrops = { alpha: [{ key: 'mithril', chance: 1 }] };
  const roster = [makeActor('owner'), makeActor('fast', 1.5), makeActor('slow', 0.5)];
  const world = { bosses: { [kind]: { alive: true, zoneId: 'z' } }, wildlife: { z: 0 }, wildlifeSpecies: { z: [] } };
  const events = [], mastery = [], logs = [];
  const state = { phaseSurvivors: roster, updatedSurvivors: roster, nextDay: 2, nextPhase: 'morning', phaseIdxNow: 2,
    ruleset, nextSpawn: world, mapObj: { zones: [{ zoneId: 'z', name: '보스 지역' }] },
    publicItems: items, itemMetaById: meta, itemNameById: names, craftables: [], forbiddenIds: new Set() };
  const actions = { addLog: (message) => logs.push(message), atNow: () => ({ day: 2, phase: 'morning', sec: 100 }),
    emitRunEvent: (kind, payload, at) => events.push(structuredClone({ ...payload, subkind: payload.kind, kind, at })),
    grantMasteries: (actor, entries, source) => mastery.push({ who: actor._id, entries, source }) };
  const started = withSimulationRandom(() => 0, () => runHuntAction({
    state: { ...state, actor: roster[0], rewardRoster: roster, currentActionSec: () => 100, deferHuntSettlement: true, didMove: true }, actions }));
  assert.equal(started.pending, true);
  return { roster, world, state, actions, events, mastery, logs };
}
async function fight(input, { duration = 22, skills = false, onAdvance = () => {} } = {}) {
  let offset = 0, advanced = 0, frames = 0, promise;
  withSimulationRandom(createSeedRng('boss-team-combat'), () => {
    promise = runPvpActionLoop({ state: { ...input.state, updatedSurvivors: input.roster,
      phaseSurvivors: input.roster, phaseDurationSec: duration, currentActionSec: () => 100 + offset,
      getPhaseRuntimeOffsetSec: () => offset, battleSettings: { characterSkillsEnabled: skills } },
    actions: { ...input.actions, atNow: () => ({ day: 2, phase: 'morning', sec: 100 + offset }),
      reserveActionSecond: (seconds) => { offset = Math.min(duration, Math.round((offset + seconds) * 1e6) / 1e6); },
      advanceWorld: ({ survivorMap }) => {
        const elapsedSec = offset - advanced;
        if (elapsedSec > 0) {
          advanceSpatialMovement(getWildlifeCombatRoster([...survivorMap.values()]), 100 + advanced, elapsedSec);
          for (const [id, actor] of survivorMap) survivorMap.set(id, updateEffects(actor, { elapsedSec, startSec: 100 + advanced }));
          advanceTimedWildlifeEffects([...survivorMap.values()], { elapsedSec, startSec: 100 + advanced });
        }
        onAdvance(survivorMap, 100 + offset);
        advanced = offset;
      },
      publishActionFrame: async () => { assert.ok(++frames < 2000, 'Combat clock must advance.'); },
    } });
  });
  return await promise;
}
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const options = (input) => ({ nowSec: 100, ruleset: input.state.ruleset });
const hits = (input, id) => input.events.filter((event) => event.kind === 'hunt_exchange'
  && event.strikerId === id && event.damageDealt > 0);

await check('three teammates attack one live boss with independent clocks and exactly one settlement', async () => {
  const input = fixture();
  const hp = input.roster[0]._wildlifeHunt.target.hp;
  const result = await fight(input);
  for (const id of ['owner', 'fast', 'slow']) {
    const attacks = hits(input, id);
    assert.ok(attacks.length >= 2, `${id} must actually attack, not merely appear in a roster.`);
    const interval = id === 'fast' ? 2 / 3 : id === 'slow' ? 2 : 1;
    for (let i = 1; i < attacks.length; i++) assert.ok(attacks[i].at.sec - attacks[i - 1].at.sec >= interval - 0.000002);
    assert.ok(attacks.every((event) => event.distance <= 2.000001), 'No remote or teleport attacks.');
  }
  const exchanges = input.events.filter((event) => event.kind === 'hunt_exchange');
  assert.equal(new Set(exchanges.map((event) => event.wildlifeId)).size, 1);
  assert.ok(Math.abs(exchanges.reduce((sum, event) => sum + event.damageDealt, 0) - hp) < 0.001);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_assist').length, 2);
  assert.equal(input.world.bosses.alpha.alive, false);
  assert.equal(input.world.bosses.alpha.engagementId, undefined);
  const final = [...result.survivorMap.values()];
  assert.equal(final.reduce((sum, actor) => sum + actor.simCredits, 0), 7);
  assert.equal(final.reduce((sum, actor) => sum + actor.inventory.filter((item) => (item.itemId || item._id) === 'mithril')
    .reduce((n, item) => n + Number(item.qty || 1), 0), 0), 1);
  for (const actor of final) assert.ok(!actor._wildlifeHunt && !String(actor._spatialMotion?.targetId || '').startsWith('wildlife:'));
  const done = input.events.find((event) => event.kind === 'hunt_end' && event.outcome === 'victory');
  for (const id of ['fast', 'slow']) assert.deepEqual(input.mastery.filter((row) => row.who === id),
    [{ who: id, entries: getWildlifeMasteryEntries({ damageDealt: done.assistDamageDealt[id] }), source: '보스 공동 사냥' }]);
  const ownerDamage = hp - Object.values(done.assistDamageDealt).reduce((sum, value) => sum + value, 0);
  const ownerMastery = input.mastery.filter((row) => row.who === 'owner').flatMap((row) => row.entries);
  assert.equal(ownerMastery.find((row) => row.category === 'weapon').amount, Math.round(ownerDamage * 0.05));
  const solo = fixture(); solo.roster = [solo.roster[0]];
  await fight(solo);
  const soloEnd = solo.events.find((event) => event.kind === 'hunt_end' && event.outcome === 'victory');
  assert.ok(done.elapsedSec < soloEnd.elapsedSec, 'Team DPS must change the real kill time.');
  console.log(`BOSS_TEAM_KILL_SECONDS team=${done.elapsedSec} solo=${soloEnd.elapsedSec}`);
});

await check('helpers cast Q/W/E on the shared clock but reserve attack and self/support ultimates', async () => {
  for (const [slot, ultimateType] of [['q', 'attack_skill'], ['w', 'basic_attack_enhance'], ['e', 'heal_skill']]) {
    const input = fixture();
    input.roster[1].characterSkills = {
      [slot]: { enabled: true, name: '일반 공동 사냥 스킬', type: 'attack_skill', flatDamage: [25], range: 8,
        cooldownSec: 10, castDelaySec: 0.4, recoveryDelaySec: 0.2 },
      r: { enabled: true, name: '사용 금지 궁극기', type: ultimateType, flatDamage: [10000], recovery: [1000], range: 10,
        cooldownSec: 60, castDelaySec: 0.1, recoveryDelaySec: 0.1 },
    };
    await fight(input, { skills: true });
    const casts = input.events.filter((event) => event.kind === 'skill_cast' && event.who === 'fast');
    assert.ok(casts.some((event) => event.slot === slot));
    assert.ok(input.events.some((event) => event.kind === 'damage' && event.who === 'fast' && event.type === 'skill'));
    assert.equal(input.events.some((event) => ['skill_cast', 'skill'].includes(event.kind) && event.slot === 'r'), false);
  }
});

await check('helper eligibility rejects other teams, regions, spaces, deaths, retreat, growth and unrelated casts', () => {
  for (const [name, mutate] of [
    ['enemy', (a) => { a.teamId = 'team:2'; }], ['away', (a) => { a.zoneId = 'away'; }],
    ['rift', (a) => { a._combatSpaceId = 'dimension_rift:test'; }], ['dead', (a) => { a.hp = 0; }],
    ['hurt', (a) => { a.hp = 20; }], ['recovery', (a) => { a._recentCombatUntil = 105; }],
    ['growth', (a) => { a._growthPlan = { openingComplete: false, blocked: false }; }],
    ['cast', (a) => { a._pendingCharacterCast = { targetId: 'other' }; }],
    ['own hunt', (a) => { a._wildlifeHunt = { id: 'another' }; }],
  ]) {
    const input = fixture(); mutate(input.roster[1]);
    assert.equal(getBossAssistOwner(input.roster[1], input.roster, options(input)), null, name);
  }
  const input = fixture();
  assert.equal(getBossAssistOwner(input.roster[1], input.roster, { ...options(input), isSoloMatch: true }), null);
  assert.equal(getBossAssistOwner(input.roster[1], input.roster, { ...options(input), forbiddenIds: new Set(['z']) }), null);
  input.roster[0]._wildlifeHunt.isBossReward = false;
  assert.equal(getBossAssistOwner(input.roster[1], input.roster, options(input)), null, 'Ordinary and mutant hunts stay individual.');
});

await check('selection is read-only and deterministic, and JSON load reconstructs the same shared owner', () => {
  const input = fixture(), before = structuredClone(input.roster);
  withSimulationRandom(() => { throw new Error('No RNG in assignment.'); }, () => {
    for (const roster of [input.roster, [...input.roster].reverse(), JSON.parse(JSON.stringify(input.roster))]) {
      const assigned = getBossAssistAssignments(roster, options(input));
      assert.equal(assigned.get('fast'), 'owner'); assert.equal(assigned.get('slow'), 'owner');
    }
  });
  assert.deepEqual(input.roster, before);
  const map = new Map(input.roster.map((row) => [row._id, row]));
  const assigned = getBossAssistAssignments(input.roster, options(input));
  assert.equal(findNextCombatAction(map, 100, [], {}, assigned), null, 'The PvP scheduler must not steal helper casts or movement.');
});

await check('a late teammate walks into range and joins without creating a new claim', async () => {
  const input = fixture(); input.roster[1].zoneId = 'away'; input.roster[2].zoneId = 'away';
  let joined = false;
  await fight(input, { onAdvance: (map, now) => {
    if (!joined && now >= 101.5) {
      joined = true; const helper = map.get('fast'); helper.zoneId = 'z';
      helper._spatial = { zoneId: 'z', x: 16, y: 8 };
      assert.ok(spatialDistance(helper, map.get('owner')._wildlifeHunt.target) > 2);
    }
  } });
  assert.ok(hits(input, 'fast').length > 0);
  assert.ok(hits(input, 'fast')[0].at.sec > 101.5);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_start').length, 1);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
});

function startHelperCast(input, type = 'attack_skill') {
  const [owner, helper] = input.roster;
  helper.characterSkills = { q: { enabled: true, name: '긴 지원 시전', type, flatDamage: [30], firstFlat: [30],
    range: 10, cooldownSec: 30, castDelaySec: 2, recoveryDelaySec: 1 } };
  const candidate = { ownerId: 'owner', actorId: 'fast', encounterId: owner._wildlifeHunt.id, actionType: 'hunt_skill_start' };
  const survivorMap = new Map(input.roster.map((row) => [row._id, row]));
  const result = withSimulationRandom(() => 0, () => resolveTimedWildlifeAction(candidate,
    { survivorMap, nowSec: 100, ruleset: input.state.ruleset, actions: input.actions }));
  assert.equal(result.performed, true);
  return { survivorMap, candidate };
}
await check('PvP intervention cancels only the helper hunt cast and immediately restores player scheduling', () => {
  const input = fixture(); startHelperCast(input);
  const enemy = makeActor('enemy'); enemy.teamId = 'team:2'; input.roster.push(enemy);
  const helper = input.roster[1];
  withSimulationRandom(() => 0, () => engageCombatParticipants(helper, enemy, input.roster, 100.5));
  reconcileBossAssists(input.roster, { ...options(input), nowSec: 100.5 }, input.actions);
  assert.equal(helper._pendingCharacterCast, null);
  assert.equal(helper.skillState.q.cooldownUntil, 130, 'Cancellation must not refund cooldown.');
  assert.equal(getBossAssistOwner(helper, input.roster, options(input)), null);
  const next = findNextCombatAction(new Map(input.roster.map((row) => [row._id, row])), 100.5);
  assert.ok(next && !String(next.targetId || '').startsWith('wildlife:'));
  assert.equal(input.events.filter((event) => event.kind === 'skill_cancel' && event.reason === 'hunt_end').length, 1);
});

await check('leaving, low HP, owner death and phase release cancel helper self-casts and stale hunt pursuit', () => {
  for (const reason of ['leave', 'hurt', 'owner_dead', 'release']) {
    const input = fixture(); const { survivorMap, candidate } = startHelperCast(input, 'basic_attack_enhance');
    const [owner, helper] = input.roster;
    helper._spatialMotion = { targetId: owner._wildlifeHunt.target._id };
    if (reason === 'leave') helper.zoneId = 'away';
    if (reason === 'hurt') helper.hp = 1;
    if (reason === 'owner_dead') owner.hp = 0;
    if (reason === 'release') releaseTimedWildlifeEncounter(owner, input.world, '시간대 전환', input.actions, 101);
    const stale = withSimulationRandom(() => 0, () => resolveTimedWildlifeAction({ ...candidate, actionType: 'hunt_skill_release' },
      { survivorMap, nowSec: 102, ruleset: input.state.ruleset, actions: input.actions }));
    assert.equal(stale.performed, false, reason);
    reconcileBossAssists(input.roster, { ...options(input), nowSec: 102 }, input.actions);
    assert.equal(helper._pendingCharacterCast, null, reason);
    assert.equal(helper._spatialMotion, null, reason);
    assert.ok(!helper._armedCharacterSkill, reason);
  }
});

await check('real growth batches keep available helpers in the fight instead of rotating or claiming another hunt', () => {
  const input = fixture();
  const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...input.state,
    actionIntervalSec: 20, currentActionSec: () => 100, zoneGraph: { z: ['away'], away: ['z'] } }, actions: input.actions }));
  for (const helper of result.updatedSurvivors.filter((actor) => actor._id !== 'owner')) {
    assert.equal(helper.zoneId, 'z'); assert.equal(helper.aiCurrentAction, 'hunt_combat');
    assert.ok(!helper._wildlifeHunt); assert.equal(helper._growthReadyAtSec, undefined);
  }
  assert.equal(input.events.filter((event) => event.kind === 'hunt_start').length, 1);
});

await check('helper DoT credits actual shared HP loss to its caster without duplicating owner mastery', () => {
  const input = fixture(); const encounter = input.roster[0]._wildlifeHunt;
  encounter.assistDamageDealt = { fast: 0 };
  encounter.target.hp = 3;
  encounter.target.activeEffects = [{ name: '중독', remainingDuration: 5, durationUnit: 'sec', dotDamage: 10,
    sourceActorId: 'fast' }];
  advanceTimedWildlifeEffects(input.roster, { elapsedSec: 1, startSec: 100 });
  assert.equal(encounter.target.hp, 0);
  assert.equal(encounter.damageDealt, 3);
  assert.equal(encounter.assistDamageDealt.fast, 3);
  assert.equal(getWildlifeOwnerDamageDealt(encounter), 0);
});

await check('omega and Wickeline also share one actual target and reserve helper R', async () => {
  for (const kind of ['omega', 'weakline']) {
    const input = fixture(kind);
    input.roster[1].characterSkills = { r: { enabled: true, name: '교전 전용', type: 'attack_skill',
      flatDamage: [10000], range: 10, cooldownSec: 30, castDelaySec: 0.1 } };
    await fight(input, { skills: true });
    assert.ok(hits(input, 'fast').length >= 2 && hits(input, 'slow').length >= 2);
    assert.equal(input.world.bosses[kind].alive, false);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
    assert.equal(input.events.some((event) => event.kind === 'skill_cast' && event.slot === 'r'), false);
  }
});

await check('an in-progress helper cast and single target survive JSON restoration and finish once', async () => {
  const input = fixture(); startHelperCast(input);
  input.roster = JSON.parse(JSON.stringify(input.roster));
  input.state.nextSpawn = input.world = JSON.parse(JSON.stringify(input.world));
  assert.equal(input.roster[1]._pendingCharacterCast.bossAssistEncounterId, input.roster[0]._wildlifeHunt.id);
  const result = await fight(input, { skills: true });
  assert.ok(input.events.some((event) => event.kind === 'damage' && event.who === 'fast' && event.type === 'skill'));
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_assist' && event.who === 'fast').length, 1);
  assert.ok(!result.survivorMap.get('fast')._pendingCharacterCast);
});

await check('the real phase boundary releases the shared claim and cancels a still pending helper self-cast', async () => {
  const input = fixture(); startHelperCast(input, 'basic_attack_enhance');
  const result = await fight(input, { duration: 0.25, skills: true });
  assert.ok(!result.survivorMap.get('fast')._pendingCharacterCast);
  assert.equal(input.world.bosses.alpha.alive, true);
  assert.equal(input.world.bosses.alpha.engagementId, undefined);
  assert.equal(input.events.some((event) => event.kind === 'hunt_settlement'), false);
  assert.equal(input.events.filter((event) => event.kind === 'skill_cancel' && event.reason === 'hunt_end').length, 1);
});

await check('travel/action locks and stun delay helper attacks without a backlog of missed hits', async () => {
  const input = fixture();
  input.roster[1]._actionReadyAtSec = 102;
  input.roster[2].activeEffects = [{ name: '기절', remainingDuration: 2.5, durationUnit: 'sec' }];
  await fight(input);
  assert.ok(hits(input, 'fast').length > 0 && hits(input, 'slow').length > 0);
  assert.ok(hits(input, 'fast')[0].at.sec >= 102);
  assert.ok(hits(input, 'slow')[0].at.sec >= 102.5);
  for (const id of ['fast', 'slow']) assert.equal(new Set(hits(input, id).map((event) => event.at.sec)).size, hits(input, id).length);
});

await check('the real loop stops boss support and attacks the intervening enemy team', async () => {
  const input = fixture(); startHelperCast(input);
  let intervened = false;
  await fight(input, { duration: 4, skills: true, onAdvance: (map, now) => {
    if (!intervened && now >= 100.5) {
      intervened = true;
      const enemy = makeActor('enemy'); enemy.teamId = 'team:2'; map.set(enemy._id, enemy);
      engageCombatParticipants(map.get('fast'), enemy, [...map.values()], now);
    }
  } });
  assert.equal(input.world.bosses.alpha.alive, true);
  assert.equal(input.world.bosses.alpha.engagementId, undefined);
  assert.ok(input.events.some((event) => event.kind === 'hunt_end' && event.reason === '실험체 교전 개입'));
  assert.ok(input.events.some((event) => event.kind === 'skill_cancel' && event.who === 'fast' && event.reason === 'hunt_end'));
  assert.ok(input.events.some((event) => event.kind === 'damage' && event.who === 'fast' && event.targetId === 'enemy'));
  assert.equal(input.events.some((event) => event.kind === 'hunt_settlement'), false);
});

console.log(`BOSS_TEAM_COMBAT_CHECKS ${checks}/${checks}`);
