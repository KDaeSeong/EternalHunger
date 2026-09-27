import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { getBossAssistOwner, getBossAssistAssignments, getBossHuntSuccessor, reconcileBossAssists } = await import('../src/app/simulation/_lib/bossAssistRuntime.js');
const { advanceTimedWildlifeEffects, getWildlifeCombatRoster, getWildlifeOwnerDamageDealt,
  getWildlifeOwnerDamageTaken, transferTimedBossEncounter,
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

await check('a retreating owner hands the damaged boss to a teammate without restarting or duplicating rewards', async () => {
  const input = fixture();
  const originalId = input.roster[0]._wildlifeHunt.id;
  let withdrawn = false, hpAtWithdrawal = 0;
  const result = await fight(input, { onAdvance: (map, now) => {
    const owner = map.get('owner');
    if (!withdrawn && now >= 102 && owner._wildlifeHunt) {
      withdrawn = true;
      hpAtWithdrawal = owner._wildlifeHunt.target.hp;
      owner.hp = 1;
    }
  } });
  const transfers = input.events.filter((event) => event.kind === 'hunt_transfer');
  assert.equal(transfers.length, 1, 'The damaged encounter must continue with a new owner.');
  assert.equal(transfers[0].previousOwnerId, 'owner');
  assert.equal(transfers[0].who, 'fast');
  assert.equal(transfers[0].encounterId, originalId);
  assert.equal(transfers[0].wildlifeHp, hpAtWithdrawal);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_start').length, 1);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(input.world.bosses.alpha.alive, false);
  assert.ok(result.survivorMap.get('owner').hp > 0);
  assert.equal([...result.survivorMap.values()].reduce((sum, actor) => sum + actor.simCredits, 0), 7);
  const before = input.events.filter((event) => event.kind === 'hunt_exchange' && event.at.sec < transfers[0].at.sec);
  const after = input.events.filter((event) => event.kind === 'hunt_exchange' && event.at.sec >= transfers[0].at.sec);
  assert.ok(before.length && after.length);
  assert.ok(after.every((event) => event.ownerId === 'fast'));
  assert.equal(new Set([...before, ...after].map((event) => event.wildlifeId)).size, 1);
});

const handoff = (input, reason = '체력 열세로 후퇴', nowSec = 101) => transferTimedBossEncounter(input.roster[0], input.world,
  input.roster, { ...options(input), phaseIdxNow: 2, nowSec, reason, actions: input.actions });

await check('handoff moves the same target, timers, effects, reward and pending helper cast exactly once', () => {
  const input = fixture(); startHelperCast(input);
  const [owner, helper] = input.roster, hunt = owner._wildlifeHunt;
  hunt.target.hp -= 80;
  hunt.damageDealt = 80;
  hunt.assistDamageDealt = { fast: 30, slow: 10 };
  hunt.damageTaken = 24;
  hunt.target.activeEffects = [{ name: '중독', remainingDuration: 3, durationUnit: 'sec', dotDamage: 5, sourceActorId: 'owner' }];
  hunt.target._basicAttackReadyAtSec = 102.75;
  hunt.target._actionReadyAtSec = 102.25;
  hunt.target._spatialMotion = { targetId: 'owner' };
  const beforeTarget = structuredClone(hunt.target), beforeReward = structuredClone(hunt.reward);
  const beforeCast = structuredClone(helper._pendingCharacterCast);
  withSimulationRandom(() => { throw new Error('Handoff must not reroll.'); }, () => assert.equal(handoff(input), helper));
  assert.equal(owner._wildlifeHunt, null);
  assert.equal(helper._wildlifeHunt, hunt);
  assert.deepEqual(hunt.target, { ...beforeTarget, _wildlifeOwnerId: 'fast', _spatialMotion: null, _spatialLastSeen: null });
  assert.deepEqual(hunt.reward, { ...beforeReward, claim: { ...beforeReward.claim, claimantId: 'fast' } });
  assert.equal(input.world.bosses.alpha.engagedBy, 'fast');
  assert.equal(input.world.bosses.alpha.engagementId, hunt.id);
  assert.equal(getWildlifeOwnerDamageDealt(hunt), 30);
  assert.equal(getWildlifeOwnerDamageTaken(hunt), 0);
  assert.equal(hunt.assistDamageDealt.owner, 40);
  assert.equal(hunt.assistDamageTaken.owner, 24);
  reconcileBossAssists(input.roster, { ...options(input), nowSec: 101 }, input.actions);
  assert.deepEqual(helper._pendingCharacterCast, beforeCast);
  assert.equal(handoff(input), null);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_transfer').length, 1);
  advanceTimedWildlifeEffects(input.roster, { elapsedSec: 1, startSec: 101 });
  assert.equal(hunt.assistDamageDealt.owner, 45);
  assert.equal(getWildlifeOwnerDamageDealt(hunt), 30);
});

await check('successor selection rejects unavailable teammates and remains read-only and order independent', () => {
  for (const [name, mutate] of [
    ['enemy', (a) => { a.teamId = 'team:2'; }], ['away', (a) => { a.zoneId = 'away'; }],
    ['rift', (a) => { a._combatSpaceId = 'dimension_rift:test'; }], ['dead', (a) => { a.hp = 0; }],
    ['hurt', (a) => { a.hp = 1; }], ['recovery', (a) => { a._recentCombatUntil = 110; }],
    ['growth', (a) => { a._growthPlan = { openingComplete: false, blocked: false }; }],
    ['other cast', (a) => { a._pendingCharacterCast = { targetId: 'other' }; }],
    ['other boss cast', (a) => { a._pendingCharacterCast = { bossAssistEncounterId: 'other' }; }],
    ['own hunt', (a) => { a._wildlifeHunt = { id: 'another' }; }],
    ['PvP', (a) => { a._combatIntent = { opponentIds: ['enemy'] }; }],
  ]) {
    const input = fixture(); input.roster[2].hp = 0; mutate(input.roster[1]);
    assert.equal(getBossHuntSuccessor(input.roster[0], input.roster, options(input)), null, name);
  }
  const input = fixture(); input.roster[0].hp = 0;
  const before = structuredClone(input.roster);
  for (const roster of [input.roster, [...input.roster].reverse(), JSON.parse(JSON.stringify(input.roster))]) {
    withSimulationRandom(() => { throw new Error('Selection must not consume RNG.'); }, () => {
      const owner = roster.find((actor) => actor._id === 'owner');
      assert.equal(getBossHuntSuccessor(owner, roster, options(input))._id, 'fast');
    });
  }
  assert.deepEqual(input.roster, before);
  assert.equal(getBossHuntSuccessor(input.roster[0], input.roster, { ...options(input), isSoloMatch: true }), null);
  assert.equal(getBossHuntSuccessor(input.roster[0], input.roster, { ...options(input), forbiddenIds: new Set(['z']) }), null);
});

await check('stale claims, dead bosses and nonboss hunts never transfer or mutate another reservation', () => {
  for (const mutate of [
    (input) => { input.world.bosses.alpha.engagementId = 'newer'; },
    (input) => { input.world.bosses.alpha.engagedBy = 'other'; },
    (input) => { input.world.bosses.alpha.alive = false; },
    (input) => { input.world.bosses.alpha.zoneId = 'away'; },
    (input) => { input.roster[0]._wildlifeHunt.target.hp = 0; },
    (input) => { input.roster[0]._wildlifeHunt.isBossReward = false; },
    (input) => { input.roster[0]._wildlifeHunt.claim.source = 'mutant'; },
  ]) {
    const input = fixture(); mutate(input);
    const before = structuredClone({ world: input.world, roster: input.roster });
    assert.equal(handoff(input), null);
    assert.deepEqual({ world: input.world, roster: input.roster }, before);
  }
});

await check('an actual lethal boss strike records one death, retargets a living ally and pays one victory', async () => {
  const input = fixture(), owner = input.roster[0], hunt = owner._wildlifeHunt;
  owner.hp = 30;
  owner.activeEffects = [{ name: '기절', remainingDuration: 5, durationUnit: 'sec' }];
  hunt.target._spatial = { ...owner._spatial };
  hunt.target.stats.attackPower = 100;
  hunt.target._basicAttackReadyAtSec = 100;
  const deaths = [];
  input.actions.emitDeathRunEventOnce = (actor) => deaths.push(actor._id);
  const result = await fight(input);
  assert.deepEqual(deaths, ['owner']);
  assert.ok(result.newDeadIds.includes('owner'));
  const transfer = input.events.find((event) => event.kind === 'hunt_transfer');
  assert.equal(transfer.reason, '사망');
  const retaliation = input.events.filter((event) => event.kind === 'hunt_exchange' && event.damageTaken > 0);
  assert.equal(retaliation[0].targetId, 'owner');
  assert.ok(retaliation.slice(1).every((event) => event.targetId === 'fast'));
  for (let i = 1; i < retaliation.length; i++) assert.ok(retaliation[i].at.sec - retaliation[i - 1].at.sec >= 1 / 0.82 - 0.000002);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal([...result.survivorMap.values()].reduce((sum, actor) => sum + actor.simCredits, 0), 7);
  assert.equal(input.mastery.filter((row) => row.who === 'owner').flatMap((row) => row.entries)
    .find((row) => row.category === 'defense').amount, 3);
  const fastTaken = retaliation.filter((event) => event.targetId === 'fast').reduce((sum, event) => sum + event.damageTaken, 0);
  assert.equal(input.mastery.filter((row) => row.who === 'fast').flatMap((row) => row.entries)
    .find((row) => row.category === 'defense')?.amount || 0, Math.round(fastTaken * 0.1));
});

await check('region and combat-space departure preserve the encounter at its original location', async () => {
  for (const leave of [(owner) => { owner.zoneId = 'away'; }, (owner) => { owner._combatSpaceId = 'dimension_rift:test'; }]) {
    const input = fixture(); let departed = false;
    await fight(input, { onAdvance: (map, now) => {
      if (!departed && now >= 102) { departed = true; leave(map.get('owner')); }
    } });
    const transfer = input.events.find((event) => event.kind === 'hunt_transfer');
    assert.equal(transfer.zoneId, 'z');
    assert.equal(transfer.reason, '전장 또는 지역 이탈');
    assert.equal(input.world.bosses.alpha.alive, false);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  }
});

await check('no eligible successor releases the boss; a visible enemy prevents handoff', async () => {
  const input = fixture(); input.roster.forEach((actor) => { actor.hp = 1; });
  await fight(input, { duration: 0.25 });
  assert.equal(input.events.some((event) => event.kind === 'hunt_transfer'), false);
  assert.equal(input.world.bosses.alpha.alive, true);
  assert.equal(input.world.bosses.alpha.engagedBy, undefined);
  assert.equal(input.events.some((event) => event.kind === 'hunt_settlement'), false);
  const contested = fixture();
  const enemy = makeActor('enemy'); enemy.teamId = 'team:2'; contested.roster.push(enemy);
  assert.equal(handoff(contested), null);
});

await check('successive retreats preserve each actor contribution without duplicate mastery or drops', async () => {
  const input = fixture(); const withdrawn = new Set();
  const result = await fight(input, { onAdvance: (map, now) => {
    for (const [id, when] of [['owner', 101], ['fast', 102]]) {
      if (now >= when && !withdrawn.has(id) && map.get(id)._wildlifeHunt) {
        withdrawn.add(id); map.get(id).hp = 1;
      }
    }
  } });
  assert.deepEqual(input.events.filter((event) => event.kind === 'hunt_transfer').map((event) => event.who), ['fast', 'slow']);
  const done = input.events.find((event) => event.kind === 'hunt_end' && event.outcome === 'victory');
  assert.ok(done);
  for (const id of ['owner', 'fast', 'slow']) {
    const exchanges = input.events.filter((event) => event.kind === 'hunt_exchange');
    const dealt = exchanges.filter((event) => event.strikerId === id).reduce((sum, event) => sum + event.damageDealt, 0);
    const taken = exchanges.filter((event) => event.targetId === id).reduce((sum, event) => sum + event.damageTaken, 0);
    assert.deepEqual(input.mastery.filter((row) => row.who === id).flatMap((row) => row.entries),
      getWildlifeMasteryEntries({ damageDealt: dealt, damageTaken: taken }));
  }
  const all = [...result.survivorMap.values()];
  assert.equal(all.reduce((sum, actor) => sum + actor.simCredits, 0), 7);
  assert.equal(all.flatMap((actor) => actor.inventory).filter((item) => (item.itemId || item._id) === 'mithril').length, 1);
});

await check('a transferred helper cast survives JSON restore, fires on schedule and still never uses R', async () => {
  const run = async () => {
    const input = fixture(); startHelperCast(input);
    input.roster[1].characterSkills.r = { enabled: true, name: '금지 궁극기', type: 'attack_skill',
      flatDamage: [10000], range: 10, cooldownSec: 30, castDelaySec: 0.1 };
    input.roster[0].hp = 1;
    handoff(input);
    input.roster = JSON.parse(JSON.stringify(input.roster));
    input.state.nextSpawn = input.world = JSON.parse(JSON.stringify(input.world));
    const result = await fight(input, { skills: true });
    assert.ok(input.events.some((event) => event.kind === 'damage' && event.who === 'fast' && event.type === 'skill'));
    assert.equal(input.events.some((event) => event.kind === 'skill_cancel' && event.who === 'fast'), false);
    assert.equal(input.events.some((event) => ['skill_cast', 'skill'].includes(event.kind) && event.slot === 'r'), false);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
    return { events: input.events, world: input.world, actors: [...result.survivorMap.values()] };
  };
  assert.deepEqual(await run(), await run());
});

await check('a successor with an earlier settled hunt in this action cycle still receives this boss once', async () => {
  const input = fixture();
  input.roster[1]._huntActionKey = 'phase:2:cycle:2:100';
  input.roster[0].hp = 1;
  const result = await fight(input);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal([...result.survivorMap.values()].reduce((sum, actor) => sum + actor.simCredits, 0), 7);
  const successor = result.survivorMap.get('fast'), count = input.events.length;
  const duplicate = runHuntAction({ state: { ...input.state, actor: successor, preparedHunt: { defeated: true, credits: 7 },
    preparedHuntRole: 'boss', encounterId: successor._settledHuntEncounterId, damageAlreadyApplied: true }, actions: input.actions });
  assert.equal(duplicate.reason, 'already_settled');
  assert.equal(input.events.length, count);
});

await check('a stunned successor receives an ally-finished boss reward without an extra action', async () => {
  const input = fixture(); input.roster[0].hp = 1;
  input.roster[1].activeEffects = [{ name: '기절', remainingDuration: 20, durationUnit: 'sec' }];
  input.roster[2].stats.attackPower = 500;
  const result = await fight(input, { duration: 3 });
  assert.equal(input.events.find((event) => event.kind === 'hunt_transfer').who, 'fast');
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(hits(input, 'fast').length, 0);
  assert.equal([...result.survivorMap.values()].reduce((sum, actor) => sum + actor.simCredits, 0), 7);
});

await check('handoff cancels the departing caster without refunding cooldown or cancelling its successor', () => {
  const input = fixture(); const { survivorMap } = startHelperCast(input);
  input.roster[0].characterSkills = structuredClone(input.roster[1].characterSkills);
  const owner = input.roster[0];
  const result = withSimulationRandom(() => 0, () => resolveTimedWildlifeAction({ ownerId: owner._id, actorId: owner._id,
    encounterId: owner._wildlifeHunt.id, actionType: 'hunt_skill_start' },
  { survivorMap, nowSec: 100, ruleset: input.state.ruleset, actions: input.actions }));
  assert.equal(result.performed, true);
  const emit = input.actions.emitRunEvent;
  input.actions.emitRunEvent = (kind, payload, at) => {
    if (kind === 'skill_cancel') {
      assert.equal(input.roster[1]._wildlifeHunt?.claim.claimantId, 'fast', 'Callbacks must see an already owned encounter.');
      assert.equal(owner._wildlifeHunt, null);
    }
    emit(kind, payload, at);
  };
  handoff(input);
  assert.equal(owner._pendingCharacterCast, null);
  assert.equal(owner.skillState.q.cooldownUntil, 130);
  assert.ok(input.roster[1]._pendingCharacterCast);
  assert.equal(input.events.filter((event) => event.kind === 'skill_cancel' && event.who === 'owner').length, 1);
});

await check('a prior external death cause remains intact when allies continue the boss', async () => {
  const input = fixture(); input.roster[0].hp = 0;
  input.roster[0]._deathBy = 'detonation'; input.roster[0]._deathCauseName = '금지구역 시간 소진';
  const extraDeaths = [];
  input.actions.emitDeathRunEventOnce = (actor) => extraDeaths.push(actor._id);
  const result = await fight(input);
  assert.equal(result.survivorMap.get('owner')._deathBy, 'detonation');
  assert.deepEqual(extraDeaths, []);
  assert.equal(input.events.find((event) => event.kind === 'hunt_end' && event.who === 'owner').continuedBy, 'fast');
  assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
});

await check('all three boss kinds allow handoff while phase boundaries never hand it around', async () => {
  for (const kind of ['alpha', 'omega', 'weakline']) {
    const input = fixture(kind); input.roster[0].hp = 1;
    await fight(input);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_transfer').length, 1, kind);
    assert.equal(input.world.bosses[kind].alive, false, kind);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1, kind);
  }
  const boundary = fixture();
  await fight(boundary, { duration: 0.25 });
  assert.equal(boundary.events.some((event) => event.kind === 'hunt_transfer'), false);
});

console.log(`BOSS_TEAM_COMBAT_CHECKS ${checks}/${checks}`);
