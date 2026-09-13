import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { getBasicAttackIntervalSec, findNextCombatAction, engageCombatParticipants, roundCombatTime } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { createPhaseActionTimeline, lockActorActionTime } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { beginSimulationPhase } = await import('../src/app/simulation/_lib/phasePreparationRuntime.js');
const { normalizeRevivedSurvivor, clearRuntimeCombatFields } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { formatRuntimeEffectBadge, describeRuntimeEffect } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { updateEffects, getActiveStatusEffects } = await import('../src/utils/statusLogic.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const effect = (name, seconds, extra = {}) => ({ name, remainingDuration: seconds, durationUnit: 'sec', ...extra });
const row = (id, speed, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 10000, maxHp: 10000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  inventory: [], stats: { maxHp: 10000, attackPower: 1, defense: 0, attackSpeed: speed },
  tacticalSkill: 'none', _tacNextAbsSec: 1e9, ...extra });
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

// Real PvP loop, real encounter/hit/elimination, real status clock. Discovery
// is disabled by the opening phase; the explicitly established fight continues.
async function fight(rows, { duration = 6, onElapsed = () => {}, skills = false, teamCombat = false } = {}) {
  let offset = 0; let live; let frames = 0;
  const events = [];
  engageCombatParticipants(rows[0], rows[1], rows, 100);
  const timeline = createPhaseActionTimeline({ durationSec: duration, onElapsed: (start, elapsed) => {
    advanceSpatialMovement([...live.values()], 100 + start, elapsed);
    for (const [id, actor] of live) live.set(id, updateEffects(actor, { elapsedSec: elapsed }));
    onElapsed(live, roundCombatTime(start + elapsed));
  } });
  let promise;
  withSimulationRandom(createSeedRng('timing-test'), () => { promise = runPvpActionLoop({
    state: { updatedSurvivors: rows, phaseSurvivors: rows, phaseDurationSec: duration, nextDay: 1, nextPhase: 'morning',
      currentActionSec: () => roundCombatTime(100 + offset), getPhaseRuntimeOffsetSec: () => offset,
      battleSettings: { characterSkillsEnabled: skills }, ruleset: { ai: { escapeHpBelow: 0 },
        pvp: { criticalFleeHpBelow: 0, teamCombatEnabled: teamCombat } } },
    actions: { reserveActionSecond: (seconds) => { offset = Math.min(duration, roundCombatTime(offset + seconds)); },
      advanceWorld: ({ survivorMap, offsetSec }) => { live = survivorMap; timeline.advanceTo(offsetSec); },
      atNow: () => ({ sec: roundCombatTime(100 + offset), day: 1, phase: 'morning' }),
      emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }),
      publishActionFrame: async () => { frames++; assert.ok(frames < 2000, 'A blocked actor must not cause a zero-time loop.'); },
    },
  }); });
  const result = await promise;
  return { ...result, events, frames, offset, times: (id) => events.filter((event) => event.kind === 'damage'
    && event.type === 'basic' && event.who === id).map((event) => event.at.sec) };
}

await check('attack periods use final equipped speed, active buffs and the project speed cap', () => {
  const a = row('a', 2);
  assert.equal(getBasicAttackIntervalSec(a), 0.5);
  a.inventory = [{ itemId: 'w', type: 'weapon', equipSlot: 'weapon', stats: { atkSpeed: 0.5 } }];
  a.equipped = { weapon: 'w' }; assert.equal(getBasicAttackIntervalSec(a), 0.4);
  a.activeEffects = [effect('slow attack', 3, { statMultipliers: { attackSpeed: 0.5 } })];
  assert.equal(getBasicAttackIntervalSec(a), 0.666667);
  a.activeEffects[0].remainingDuration = 0; assert.equal(getBasicAttackIntervalSec(a), 0.4);
  assert.equal(getBasicAttackIntervalSec(row('cap', 100)), 0.333333);
});
await check('real PvP produces 0.5 second and 2 second intervals rather than a shared eight second lock', async () => {
  const result = await fight([row('fast', 2), row('slow', 0.5)]);
  assert.deepEqual(result.times('fast'), Array.from({ length: 12 }, (_, i) => 100 + i / 2));
  assert.deepEqual(result.times('slow'), [100, 102, 104]);
  assert.equal(result.survivorMap.get('slow').hp, 9988); assert.equal(result.survivorMap.get('fast').hp, 9997);
});
await check('noninteger periods preserve their fractional next-ready time across integer world ticks', async () => {
  const result = await fight([row('a', 0.72), row('b', 0.5)]);
  assert.deepEqual(result.times('a'), [100, 101.388889, 102.777778, 104.166667, 105.555556]);
  assert.equal(result.offset, 6);
});
await check('speed changes affect the next reserved interval without retroactively granting an attack', async () => {
  const a = row('a', 2, { activeEffects: [effect('attack slow', 0.25, { statMultipliers: { attackSpeed: 0.5 } })] });
  const result = await fight([a, row('b', 0.5)]);
  assert.deepEqual(result.times('a').slice(0, 4), [100, 101, 101.5, 102]);
});
await check('three-versus-three allies retain individual intervals throughout a sustained team fight', async () => {
  const rows = [row('a1', 2, { teamId: 'a' }), row('b1', 0.5, { teamId: 'b' }),
    row('a2', 1, { teamId: 'a' }), row('a3', 0.5, { teamId: 'a' }), row('b2', 1, { teamId: 'b' }), row('b3', 2, { teamId: 'b' })];
  const result = await fight(rows, { teamCombat: true });
  for (const actor of rows) {
    const interval = 1 / actor.stats.attackSpeed;
    assert.deepEqual(result.times(actor._id), Array.from({ length: 6 / interval }, (_, i) => 100 + i * interval));
  }
  assert.equal(result.events.filter((event) => event.kind === 'team_strike').length, 42);
  assert.ok(result.events.filter((event) => event.kind === 'team_strike' && event.reason === 'focus_fire').length > 0,
    'Team focus must persist between independently scheduled attacks.');
});
await check('adding twenty-two remote spectators cannot slow an established duel', async () => {
  const base = await fight([row('fast', 2), row('slow', 0.5)]);
  const crowded = await fight([row('fast', 2), row('slow', 0.5), ...Array.from({ length: 22 }, (_, i) => row(`remote-${i}`, 1, { zoneId: 'remote' }))]);
  assert.deepEqual(crowded.times('fast'), base.times('fast')); assert.deepEqual(crowded.times('slow'), base.times('slow'));
});
await check('duplicate calls at the same second cannot grant another attack or spend another skill', () => {
  const a = row('a', 2); const b = row('b', 1); const events = [];
  const run = (now) => resolveCombatWinnerOutcome({ state: { actor: a, target: b, currentActionSec: () => now },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(run(100).performed, true); assert.equal(run(100).performed, false); assert.equal(run(100.49).performed, false);
  assert.equal(run(100.5).performed, true); assert.equal(b.hp, 9998);
  assert.equal(events.filter((event) => event.kind === 'damage').length, 2);
});
await check('a miss still spends the normal attack interval', async () => {
  const result = await fight([row('a', 2, { activeEffects: [effect('실명', 20)] }), row('b', 0.5)]);
  assert.equal(result.times('a').length, 12); assert.equal(result.survivorMap.get('b').hp, 10000);
  assert.ok(result.events.filter((event) => event.who === 'a' && event.kind === 'damage').every((event) => event.blockedReason === 'blind'));
});
await check('stun cancels opportunities and release does not unleash a backlog', async () => {
  let applied = false;
  const result = await fight([row('a', 2), row('b', 0.5)], { onElapsed: (map, sec) => {
    if (!applied && sec === 0.5) { map.get('a').activeEffects = [effect('기절', 1.5)]; applied = true; }
  } });
  assert.deepEqual(result.times('a'), [100, 102, 102.5, 103, 103.5, 104, 104.5, 105, 105.5]);
});
await check('travel/action lock delays the first attack without changing its later rate', async () => {
  const result = await fight([row('a', 2, { _actionReadyAtSec: 102.5 }), row('b', 0.5)]);
  assert.deepEqual(result.times('a'), [102.5, 103, 103.5, 104, 104.5, 105, 105.5]);
});
await check('fractional stun expiry opens an attack at that time, not the next integer tick', async () => {
  const result = await fight([row('a', 2, { activeEffects: [effect('기절', 0.25)] }), row('b', 0.5)]);
  assert.deepEqual(result.times('a').slice(0, 3), [100.25, 100.75, 101.25]);
});
await check('targetability expiry is scheduled even while every opponent is temporarily untargetable', async () => {
  const result = await fight([row('a', 2), row('b', 0.5, { activeEffects: [effect('대상 지정 불가', 0.25)] })]);
  assert.deepEqual(result.times('a').slice(0, 3), [100.25, 100.75, 101.25]);
  assert.deepEqual(result.times('b'), [100, 102, 104]);
});
await check('skill cast plus recovery reservation takes priority over a faster basic timer', async () => {
  const a = row('a', 2, { characterSkills: { q: { enabled: true, name: 'reserved skill', type: 'attack_skill', flatDamage: [1],
    cooldownSec: 10, castDelaySec: 1.25, recoveryDelaySec: 0.25 } } });
  const result = await fight([a, row('b', 0.5)], { skills: true });
  assert.deepEqual(result.times('a').slice(0, 3), [101.5, 102, 102.5]);
  assert.deepEqual(result.events.filter((event) => event.kind === 'damage' && event.who === 'a' && event.type === 'skill').map((event) => event.at.sec), [101.25]);
});
await check('moving away invalidates a planned target before its next attack', async () => {
  let moved = false;
  const result = await fight([row('a', 2), row('b', 0.5)], { onElapsed: (map, sec) => {
    if (!moved && sec >= 0.5) { map.get('b').zoneId = 'remote'; moved = true; }
  } });
  assert.deepEqual(result.times('a'), [100]); assert.deepEqual(result.times('b'), [100]);
});
await check('a killed participant cannot perform its pending counterattack', async () => {
  const killer = row('a', 2); killer.stats.attackPower = 1000;
  const result = await fight([killer, row('b', 2, { hp: 50, _basicAttackReadyAtSec: 100.5 })]);
  assert.deepEqual(result.times('a'), [100]); assert.deepEqual(result.times('b'), []);
  assert.equal(result.newDeadIds.length, 1);
});
await check('JSON replay keeps future attack readiness and revival clears the old life schedule', () => {
  const a = row('a', 2); const b = row('b', 1); engageCombatParticipants(a, b, [a, b], 100);
  a._basicAttackReadyAtSec = 101.5; b._basicAttackReadyAtSec = 102;
  const restored = JSON.parse(JSON.stringify([a, b]));
  const next = findNextCombatAction(new Map(restored.map((actor) => [actor._id, actor])), 100);
  assert.equal(next.atSec, 101.5); assert.equal(next.actorId, 'a');
  const revived = normalizeRevivedSurvivor({ ...a, hp: 0 }, 100, 'zone', 6, {}, 200);
  assert.equal(revived._basicAttackReadyAtSec, 0); assert.equal(revived._combatIntent, null);
});
await check('ordinary combat cleanup cannot reset an alive actors basic cooldown', () => {
  const a = row('a', 2, { _basicAttackReadyAtSec: 100.5, _lastBasicAttackAtSec: 100 });
  clearRuntimeCombatFields(a);
  assert.equal(a._basicAttackReadyAtSec, 100.5); assert.equal(a._lastBasicAttackAtSec, 100);
});
await check('fractional forbidden time honors partial protection and exact explosion boundaries', () => {
  const actor = row('a', 1, { detonationSec: 1, detonationMaxSec: 30, safeZoneUntil: 100.25, gadgetEnergy: 0,
    cooldowns: { cnotGate: 1, portableSafeZone: 1, weaponSkill: 1 } });
  const tick = (current, start, end) => runDetonationTickPhase({ state: { updatedSurvivors: [current], useDetonation: true,
    forbiddenIds: new Set(['zone']), phaseStartSec: 100, phaseDurationSec: 10, startOffsetSec: start, endOffsetSec: end },
    actions: { setDeathMetadata: (dead, reason, meta) => { dead._deathAt = meta.atSec; dead._deathBy = reason; } } });
  const whole = tick(structuredClone(actor), 0, 1).updatedSurvivors[0];
  let split = structuredClone(actor);
  for (let i = 0; i < 4; i++) split = tick(split, i / 4, (i + 1) / 4).updatedSurvivors[0];
  assert.equal(whole.detonationSec, 0.25); assert.equal(split.detonationSec, whole.detonationSec);
  assert.deepEqual(split.cooldowns, whole.cooldowns); assert.equal(split.cooldowns.weaponSkill, 0);
  const ended = tick(split, 1, 1.25); assert.equal(ended.updatedSurvivors.length, 0);
  assert.equal(ended.newlyDead[0]._deathAt, 101.25); assert.equal(ended.newlyDead[0].detonationSec, 0);
});
await check('fractional status ticking preserves duration, DOT and healing independently of split frequency', () => {
  const a = row('a', 1, { hp: 500, activeEffects: [effect('중독', 2, { dotDamage: 8 }), effect('재생', 2, { recovery: 4 })] });
  let split = structuredClone(a);
  for (let i = 0; i < 8; i++) split = updateEffects(split, { elapsedSec: 0.25 });
  const whole = updateEffects(a, { elapsedSec: 2 });
  assert.equal(split.hp, 492); assert.deepEqual(split, whole);
  const partial = updateEffects(a, { elapsedSec: 0.25 }); assert.equal(getActiveStatusEffects(partial)[0].remainingDuration, 1.75);
});
await check('growth boundaries stay unique when attacks split a world second', () => {
  const growth = []; const elapsed = [];
  const time = createPhaseActionTimeline({ durationSec: 60, intervalSec: 20,
    onGrowth: (sec) => growth.push(sec), onElapsed: (from, seconds) => elapsed.push([from, seconds]) });
  [0, 0.5, 0.5, 19.5, 20, 20.25, 60].forEach((sec) => time.advanceTo(sec));
  assert.deepEqual(growth, [0, 20, 40]); assert.equal(elapsed.reduce((sum, row) => sum + row[1], 0), 60);
  assert.ok(elapsed.every(([, seconds]) => seconds > 0 && seconds <= 1));
});
await check('an active local engagement spends the ordinary growth opportunity', () => {
  const rows = [row('a', 1), row('b', 1)]; engageCombatParticipants(rows[0], rows[1], rows, 100);
  let opportunities = 0;
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: rows, actionIntervalSec: 20, currentActionSec: () => 100 },
    actions: { emitRunEvent: () => opportunities++ } });
  assert.equal(opportunities, 0); assert.equal(result.updatedSurvivors.length, 2);
  assert.deepEqual(result.updatedSurvivors.map((actor) => actor.inventory), [[], []]);
});
await check('healing reduction expiring inside a second cannot depend on nearby attack frequency', () => {
  const actor = row('a', 1, { hp: 500, activeEffects: [effect('재생', 2, { recovery: 10 }),
    effect('heal cut', 0.25, { healReductionPct: 0.5 })] });
  const whole = updateEffects(actor, { elapsedSec: 1 });
  let split = structuredClone(actor);
  for (let i = 0; i < 4; i++) split = updateEffects(split, { elapsedSec: 0.25 });
  assert.equal(whole.hp, 508.75); assert.deepEqual(split, whole);
});
await check('a later regeneration segment cannot revive an actor killed in an earlier status segment', () => {
  const actor = row('a', 1, { hp: 1, activeEffects: [effect('중독', 0.25, { dotDamage: 100 }), effect('재생', 1, { recovery: 4 })] });
  const result = updateEffects(actor, { elapsedSec: 1 }); assert.equal(result.hp, 0);
});
await check('zero skill lock is not an invisible one-second cap and fractional locks are not rounded up', () => {
  const a = row('a', 2); lockActorActionTime([a], 100, 0); assert.equal(a._actionReadyAtSec, 100);
  lockActorActionTime([a], 100, 0.25); assert.equal(a._actionReadyAtSec, 100.25);
});
await check('display waits represent elapsed time, not the number of combat events', async () => {
  const waits = []; const clocks = [];
  const phase = beginSimulationPhase({ state: { day: 0, phase: 'night', matchSec: 0, settings: {}, autoSpeed: 1 },
    actions: { waitForVisibleTick: async (delay, clock) => waits.push({ delay, ...clock }), setMatchSec: (sec) => clocks.push(sec) } });
  for (const delta of [0.5, 0, 0.25, 0.25]) { phase.reserveActionSecond(delta); await phase.commitVisibleClock(); }
  assert.deepEqual(waits.map((row) => row.elapsedSec), [0.5, 0.25, 0.25]);
  assert.equal(waits.reduce((sum, row) => sum + row.delay, 0), 1000); assert.equal(clocks.at(-1), 1);
});
await check('a live subsecond status is never labelled as zero seconds on the board or application text', () => {
  assert.match(formatRuntimeEffectBadge(effect('기절', 0.25)).label, /0\.25s/);
  assert.match(describeRuntimeEffect(effect('기절', 0.25)), /0\.25초/);
  assert.match(formatRuntimeEffectBadge(effect('기절', 0.000001)).label, /0\.01s/);
});
console.log(`COMBAT_TIMING_CHECKS ${checks}/${checks}`);
