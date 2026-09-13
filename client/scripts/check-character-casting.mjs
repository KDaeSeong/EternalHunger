import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { actor, skill, effect, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { findCharacterSkillChoice, startCharacterCast, finishCharacterCast, reconcileCharacterCasts } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { engageCombatParticipants, findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const caster = (skills = { q: skill() }, extra = {}) => actor('a', { characterSkills: skills, ...extra });
const enemy = (extra = {}) => actor('b', { _basicAttackReadyAtSec: 200, ...extra });
const eventsOf = (result, kind, id = 'a') => result.events.filter((event) => event.kind === kind && event.who === id);

await check('actual cast produces no early damage and reserves casting plus recovery before basics', async () => {
  const result = await runCombatScenario([caster(), enemy()]);
  assert.deepEqual(result.times('a', 'skill'), [101.25]);
  assert.deepEqual(result.times('a'), [101.5, 102.5, 103.5]);
  assert.ok(result.frames.filter((frame) => frame.sec < 101.25).every((frame) => frame.roster.find((row) => row._id === 'b').hp === 1000));
  assert.equal(eventsOf(result, 'skill_cast')[0].at.sec, 100);
  assert.equal(result.survivorMap.get('a').skillState.q.cooldownUntil, 110);
});
await check('separate skills are selected and cast sequentially, not attached together to one basic', async () => {
  const result = await runCombatScenario([caster({ q: skill({ name: 'Q', flatDamage: [80], castDelaySec: 1, recoveryDelaySec: 0.5 }),
    w: skill({ name: 'W', flatDamage: [40], castDelaySec: 0.5, recoveryDelaySec: 0.25 }) }), enemy()]);
  assert.deepEqual(eventsOf(result, 'skill_cast').map((event) => [event.slot, event.at.sec]), [['q', 100], ['w', 101.5]]);
  assert.deepEqual(result.times('a', 'skill'), [101, 102]); assert.equal(result.times('a')[0], 102.25);
});
await check('a skill becoming ready between two slow basics is not delayed to the next basic', async () => {
  const a = caster({ q: skill({ castDelaySec: 0.25, recoveryDelaySec: 0.25, cooldownSec: 1.25 }) },
    { stats: { attackPower: 1, defense: 0, attackSpeed: 0.1 } });
  const result = await runCombatScenario([a, enemy()], { duration: 3 });
  assert.deepEqual(eventsOf(result, 'skill_cast').map((event) => event.at.sec), [100, 101.25, 102.5]);
  assert.deepEqual(result.times('a', 'skill'), [100.25, 101.5, 102.75]); assert.deepEqual(result.times('a'), [100.5]);
});
for (const name of ['기절', '침묵']) await check(`${name} cancels a cast immediately and expiry cannot release a cancelled payload`, async () => {
  const result = await runCombatScenario([caster(), enemy({ stats: { attackPower: 1, attackSpeed: 2 }, _basicAttackReadyAtSec: 100 })],
    { onElapsed: (map, sec) => { if (sec === 0.5) map.get('a').activeEffects = [effect(name, 0.1)]; } });
  assert.equal(result.times('a', 'skill').length, 0);
  assert.deepEqual(eventsOf(result, 'skill_cancel').map((event) => [event.reason, event.at.sec]), [['status', 100.5]]);
  assert.equal(result.survivorMap.get('a').skillState.q.cooldownUntil, 110);
});
await check('root interrupts a movement cast but preserves a stationary cast', async () => {
  for (const includesMovement of [false, true]) {
    const result = await runCombatScenario([caster({ q: skill({ includesMovement }) }), enemy({ _basicAttackReadyAtSec: 100, stats: { attackPower: 1, attackSpeed: 2 } })],
      { onElapsed: (map, sec) => { if (sec === 0.5) map.get('a').activeEffects = [effect('속박', 2)]; } });
    assert.equal(result.times('a', 'skill').length, includesMovement ? 0 : 1);
    assert.equal(eventsOf(result, 'skill_cancel').length, includesMovement ? 1 : 0);
  }
});
for (const [label, change, reason] of [
  ['target death', (map) => { map.get('b').hp = 0; }, 'target_dead'],
  ['target movement', (map) => { map.get('b').zoneId = 'remote'; }, 'target_moved'],
  ['caster movement', (map) => { map.get('a').zoneId = 'remote'; }, 'moved'],
  ['untargetability', (map) => { map.get('b').activeEffects = [effect('대상 지정 불가', 2)]; }, 'untargetable'],
]) await check(`${label} invalidates the locked cast target without silent retargeting`, async () => {
  const result = await runCombatScenario([caster(), enemy(), actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200 })],
    { onElapsed: (map, sec) => { if (sec === 1) change(map); } });
  assert.equal(result.times('a', 'skill').length, 0); assert.equal(eventsOf(result, 'skill_cancel')[0].reason, reason);
});
await check('target invulnerability during a cast blocks impact damage without cancelling the cast', async () => {
  const result = await runCombatScenario([caster(), enemy()], { onElapsed: (map, sec) => {
    if (sec === 1) map.get('b').activeEffects = [effect('무적', 3)];
  } });
  assert.deepEqual(result.times('a', 'skill'), [101.25]);
  assert.equal(eventsOf(result, 'damage').find((event) => event.type === 'skill').hpDamage, 0);
  assert.equal(eventsOf(result, 'skill_cancel').length, 0);
});
await check('an invulnerable primary target cannot suppress damage to other targets of the released area skill', async () => {
  const result = await runCombatScenario([caster({ q: skill({ radius: 1 }) }), enemy(), actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200 })],
    { onElapsed: (map, sec) => { if (sec === 1) map.get('b').activeEffects = [effect('무적', 3)]; } });
  const packets = eventsOf(result, 'damage').filter((event) => event.type === 'skill');
  assert.equal(packets.find((packet) => packet.targetId === 'b').hpDamage, 0);
  assert.equal(packets.find((packet) => packet.targetId === 'b2').hpDamage, 40);
  assert.ok(packets.every((packet) => packet.at.sec === 101.25 && packet.castId === 'a:1'));
});
await check('a lethal basic cancels the victims pending cast with no posthumous release', async () => {
  const result = await runCombatScenario([caster(), enemy({ _basicAttackReadyAtSec: 100.5, stats: { attackPower: 2000 } })]);
  assert.equal(result.times('a', 'skill').length, 0); assert.equal(eventsOf(result, 'skill_cancel')[0].reason, 'dead');
  assert.equal(result.newDeadIds.includes('a'), true);
});
await check('support healing occurs at release and never creates ally damage packets', async () => {
  const result = await runCombatScenario([caster({ w: skill({ type: 'heal_skill', heal: [100], supportTargetScope: 'ally' }) }), enemy(),
    actor('ally', { teamId: 'a', hp: 50, _basicAttackReadyAtSec: 200 })]);
  assert.ok(result.frames.filter((frame) => frame.sec < 101.25).every((frame) => frame.roster.find((row) => row._id === 'ally').hp === 50));
  assert.equal(result.survivorMap.get('ally').hp, 150);
  assert.ok(!result.events.some((event) => event.kind === 'damage' && event.targetId === 'ally'));
  assert.equal(eventsOf(result, 'skill')[0].at.sec, 101.25);
});
await check('an ally killed during a heal cast cannot be revived by its later release', async () => {
  const result = await runCombatScenario([caster({ w: skill({ type: 'heal_skill', heal: [100], supportTargetScope: 'ally' }) }), enemy(),
    actor('ally', { teamId: 'a', hp: 50, _basicAttackReadyAtSec: 200 })],
    { onElapsed: (map, sec) => { if (sec === 1) map.get('ally').hp = 0; } });
  assert.equal(result.survivorMap.get('ally').hp, 0); assert.equal(eventsOf(result, 'skill').length, 0);
  assert.equal(eventsOf(result, 'skill_cancel')[0].reason, 'target_dead');
});
await check('a delayed shield is absent while casting and present only after release', async () => {
  const result = await runCombatScenario([caster({ w: skill({ type: 'shield_skill', shield: [100], durationSec: 5, supportTargetScope: 'ally' }) }), enemy(),
    actor('ally', { teamId: 'a', _basicAttackReadyAtSec: 200 })]);
  assert.ok(result.frames.filter((frame) => frame.sec < 101.25).every((frame) => !(frame.roster.find((row) => row._id === 'ally').activeEffects || []).some((effect) => effect.shieldValue > 0)));
  assert.equal(eventsOf(result, 'skill')[0].shield, 100); assert.equal(eventsOf(result, 'skill')[0].at.sec, 101.25);
});
await check('a fractional skill shield expires in seconds without legacy duration multiplication or minimum extension', async () => {
  const result = await runCombatScenario([caster({ w: skill({ type: 'shield_skill', shield: [100], durationSec: 1.25, supportTargetScope: 'ally' }) }), enemy(),
    actor('ally', { teamId: 'a', _basicAttackReadyAtSec: 200 })]);
  const shieldAt = (sec) => result.frames.filter((frame) => frame.sec === sec).at(-1).roster
    .find((row) => row._id === 'ally').activeEffects.find((effect) => effect.shieldValue > 0 && effect.remainingDuration > 0);
  assert.equal(shieldAt(101.25).remainingDuration, 1.25);
  assert.equal(shieldAt(102).remainingDuration, 0.5);
  assert.equal(shieldAt(102.5), undefined);
});
await check('an enhancement is armed at cast completion and applied once on the later basic', async () => {
  const result = await runCombatScenario([caster({ q: skill({ type: 'basic_attack_enhance', damageType: 'basic' }) }), enemy()]);
  assert.equal(eventsOf(result, 'skill_armed')[0].at.sec, 101.25);
  assert.deepEqual(eventsOf(result, 'damage').filter((event) => event.raw === 40).map((event) => event.at.sec), [101.5]);
  assert.equal(eventsOf(result, 'skill')[0].at.sec, 101.5);
});
await check('an armed enhancement uses a new attack target after the old one moves away', async () => {
  const result = await runCombatScenario([caster({ q: skill({ type: 'basic_attack_enhance' }) }), enemy(), actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200 })],
    { onElapsed: (map, sec) => { if (sec === 1) map.get('b').zoneId = 'remote'; } });
  assert.equal(eventsOf(result, 'skill_cancel').length, 0);
  assert.equal(eventsOf(result, 'skill')[0].targetId, 'b2');
});
await check('a blind enhanced basic consumes the charge without leaking skill damage', async () => {
  const result = await runCombatScenario([caster({ q: skill({ type: 'basic_attack_enhance' }) }, { activeEffects: [effect('실명', 4)] }), enemy()]);
  assert.equal(result.survivorMap.get('b').hp, 1000); assert.equal(result.survivorMap.get('a')._armedCharacterSkill, null);
});
await check('enhancement recasts have a second cast and keep the original cooldown, not a free second payload', async () => {
  const result = await runCombatScenario([caster({ q: skill({ type: 'basic_attack_enhance', castDelaySec: 0.25, recoveryDelaySec: 0.25,
    flatDamage: [10], firstFlat: [10], secondFlat: [20], recastWindowSec: 2 }) }), enemy()]);
  assert.deepEqual(eventsOf(result, 'skill_cast').map((event) => [event.stage, event.at.sec]), [[1, 100], [2, 100.5]]);
  assert.deepEqual(eventsOf(result, 'skill').map((event) => [event.stage, event.at.sec]), [[1, 100.5], [2, 101.5]]);
  assert.equal(result.survivorMap.get('a').skillState.q.cooldownUntil, 110);
});
await check('an unused armed attack expires at its own boundary rather than waiting for another attack', async () => {
  const result = await runCombatScenario([caster({ q: skill({ type: 'basic_attack_enhance', durationSec: 1 }) }, { _basicAttackReadyAtSec: 200 }), enemy()]);
  assert.equal(eventsOf(result, 'skill_armed')[0].at.sec, 101.25);
  assert.equal(eventsOf(result, 'skill_expired')[0].at.sec, 102.25);
  assert.equal(eventsOf(result, 'skill').length, 0);
});
await check('selection is pure and duplicate start/release calls cannot repeat a skill', () => {
  const a = caster(); const b = enemy(); const before = JSON.stringify([a, b]);
  const choice = findCharacterSkillChoice(a, [b], [a, b], 100, {});
  assert.equal(JSON.stringify([a, b]), before);
  assert.equal(startCharacterCast(a, choice, 100, {}), true); assert.equal(startCharacterCast(a, choice, 100, {}), false);
  assert.equal(finishCharacterCast(a, 101), null); assert.ok(finishCharacterCast(a, 101.25));
  assert.equal(finishCharacterCast(a, 101.25), null);
});
await check('JSON and phase boundaries preserve pending casts while revival clears the old life payload', async () => {
  const a = caster(); const b = enemy(); engageCombatParticipants(a, b, [a, b], 100);
  startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {});
  const original = JSON.parse(JSON.stringify([a, b]));
  const next = findNextCombatAction(new Map(original.map((row) => [row._id, row])), 101, [], {});
  assert.equal(next.atSec, 101.25); assert.equal(next.actionType, 'skill_release');
  const result = await runCombatScenario(original, { startSec: 101, duration: 2, engage: false });
  assert.deepEqual(result.times('a', 'skill'), [101.25]); assert.equal(eventsOf(result, 'skill_cast').length, 0);
  const revived = normalizeRevivedSurvivor({ ...a, hp: 0, _armedCharacterSkill: a._pendingCharacterCast }, 100, 'zone', 5, {}, 200);
  assert.equal(revived._pendingCharacterCast, null); assert.equal(revived._armedCharacterSkill, null);
});
await check('cancelled cast releases only its own action lock and does not erase a longer lock', () => {
  const a = caster(); const b = enemy(); startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {});
  a._actionReadyAtSec = 110; a.activeEffects = [effect('기절', 1)];
  reconcileCharacterCasts([a, b], 100.5, {}); assert.equal(a._actionReadyAtSec, 110);
});
await check('growth boundary remains once when a cast crosses that boundary', () => {
  const growth = []; const timeline = createPhaseActionTimeline({ durationSec: 40, onGrowth: (sec) => growth.push(sec) });
  [0, 19.75, 20, 20.25, 40].forEach((sec) => timeline.advanceTo(sec)); assert.deepEqual(growth, [0, 20]);
});
await check('the actual growth pipeline cannot farm at a pending cast release boundary even without a combat intent', () => {
  const a = caster({ q: skill({ recoveryDelaySec: 0 }) }); const b = enemy();
  startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {});
  assert.equal(a._actionReadyAtSec, 101.25); assert.ok(!a._combatIntent);
  const before = structuredClone(a); const events = [];
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: [a], actionIntervalSec: 20, currentActionSec: () => 101.25 },
    actions: { emitRunEvent: (...args) => events.push(args) } });
  assert.deepEqual(result.updatedSurvivors, [before]); assert.deepEqual(events, []);
});
await check('the observer reads current casting and target-linked cancellation without mutating the frame', async () => {
  const result = await runCombatScenario([caster(), enemy()], { onElapsed: (map, sec) => {
    if (sec === 1) map.get('b').zoneId = 'remote';
  } });
  const frame = result.frames.find((frame) => frame.roster.find((row) => row._id === 'a')._pendingCharacterCast);
  const before = JSON.stringify(frame);
  const model = buildTeamObserverModel({ survivors: frame.roster, teamId: 'a', matchSec: frame.sec, events: result.events });
  assert.match(model.members[0].casting, /test skill 시전 중/); assert.equal(JSON.stringify(frame), before);
  const victim = buildTeamObserverModel({ survivors: result.frames.at(-1).roster, teamId: 'b', matchSec: 104, events: result.events });
  assert.ok(victim.turningPoints.some((row) => /대상 지역 이탈/.test(row.text)));
});
console.log(`CHARACTER_CASTING_CHECKS ${checks}/${checks}`);
