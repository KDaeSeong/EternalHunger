import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const status = await import('../src/utils/statusLogic.js');
import { actor, effect, skill, runCombatScenario } from './lib/run-combat-scenario.mjs';
const { canJoinTeamCombat } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');

const point = (x, y = 4, zoneId = 'zone') => ({ zoneId, x, y });
const unit = (id, x, extra = {}) => actor(id, {
  teamId: id,
  _spatial: point(x),
  stats: { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1, attackRange: 1.5, sightRange: 24, moveSpeed: 3.5 },
  ...extra,
});
const control = (name, seconds, sourceActorId, sourcePosition = point(16)) => effect(name, seconds, {
  sourceActorId, sourcePosition,
});
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-5,
  `${message}${message ? ': ' : ''}${actual} != ${expected}`);

const failures = [];
let checks = 0;
async function check(name, run) {
  checks++;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error?.stack || error}`);
  }
}

const noHostileActions = (result, id) => result.events.filter((row) => row.kind === 'damage' && row.who === id);
const assertActualBasics = (result, id, targetId) => {
  const hits = noHostileActions(result, id);
  assert.ok(hits.length > 0, 'forced basics must commit actual hits, not just eligibility events');
  for (const hit of hits) {
    assert.equal(hit.type, 'basic');
    assert.equal(hit.targetId, targetId, 'only the live taunt caster can be attacked');
    assert.ok(hit.hpDamage > 0 && hit.hpAfter < hit.hpBefore, 'the actual hit must decrease HP');
    assert.ok(hit.distance <= hit.reach + 1e-6, 'the committed hit must be in actual attack range');
  }
};
const quietOpponent = (id, x = 4.5, extra = {}) => unit(id, x, {
  _actionReadyAtSec: 1e9, _basicAttackReadyAtSec: 1e9, ...extra,
});

await check('fear movement is forced through AI recovery only until fractional status expiry', async () => {
  const fear = unit('fear', 8, { _recentCombatUntil: 110,
    activeEffects: [control('공포', 0.375, 'fearCaster', point(16))] });
  const fearCaster = quietOpponent('fearCaster', 16);
  const feared = await runCombatScenario([fear, fearCaster], { startSec: 100, duration: 0.75, engage: false });
  close(feared.survivorMap.get('fear')._spatial.x, 8 - 3.5 * 0.375, 'fear moves only while its status remains active');
  assert.equal(noHostileActions(feared, 'fear').length, 0, 'fear must not authorize an attack');
});

await check('charm movement is forced through AI recovery only until fractional status expiry', async () => {
  const charm = unit('charm', 8, { _recentCombatUntil: 110,
    activeEffects: [control('매혹', 0.375, 'charmCaster', point(16))] });
  const charmCaster = quietOpponent('charmCaster', 16);
  const charmed = await runCombatScenario([charm, charmCaster], { startSec: 100, duration: 0.75, engage: false });
  close(charmed.survivorMap.get('charm')._spatial.x, 8 + 3.5 * 0.375, 'charm moves only while its status remains active');
  assert.equal(noHostileActions(charmed, 'charm').length, 0, 'charm must not authorize an attack');
});

await check('root blocks forced movement until its expiry even during AI recovery', async () => {
  const rooted = unit('rootedFear', 8, { _recentCombatUntil: 110,
    activeEffects: [control('공포', 0.75, 'rootCaster', point(16)), effect('속박', 0.25)] });
  const rootCaster = quietOpponent('rootCaster', 16);
  const rootResult = await runCombatScenario([rooted, rootCaster], { startSec: 100, duration: 0.75, engage: false });
  close(rootResult.survivorMap.get('rootedFear')._spatial.x, 8 - 3.5 * 0.5,
    'root blocks the first quarter-second but not the remainder');
});

await check('forced fear respects the action-ready clock and survives a fractional JSON-restored boundary', async () => {
  const initial = [
    unit('fear', 8, { _recentCombatUntil: 110, _actionReadyAtSec: 100.25,
      activeEffects: [control('공포', 0.625, 'caster', point(16))] }),
    quietOpponent('caster', 16),
  ];
  const first = await runCombatScenario(structuredClone(initial), { startSec: 100, duration: 0.75, engage: false });
  const restored = await runCombatScenario(JSON.parse(JSON.stringify(initial)), { startSec: 100, duration: 0.75, engage: false });
  close(first.survivorMap.get('fear')._spatial.x, 8 - 3.5 * 0.375,
    'forced movement begins only after actionReadyAtSec and stops at effect expiry');
  assert.deepEqual(restored.events, first.events);
  assert.deepEqual(restored.frames, first.frames);
});

const clockCases = [
  { _actionReadyAtSec: 104, _basicAttackReadyAtSec: 100, expected: 104, label: 'action clock' },
  { _actionReadyAtSec: 100, _basicAttackReadyAtSec: 104, expected: 104, label: 'basic clock' },
];
for (const clocks of clockCases) await check(`1v1 taunt respects its ${clocks.label}`, async () => {
  const taunted = unit('taunted', 4, { _recentCombatUntil: 110, activeEffects: [control('도발', 6, 'taunter', point(4.5))],
    _actionReadyAtSec: clocks._actionReadyAtSec, _basicAttackReadyAtSec: clocks._basicAttackReadyAtSec });
  const taunter = quietOpponent('taunter', 4.5);
  const result = await runCombatScenario([taunted, taunter], { startSec: 100, duration: 4.5 });
  assert.deepEqual(result.times('taunted'), [clocks.expected], `${clocks.label} must remain enforced`);
  assertActualBasics(result, 'taunted', 'taunter');
  assert.equal(result.times('taunter').length, 0, 'target has no reserved action');
  const saved = result.survivorMap.get('taunted');
  assert.equal(saved._lastBasicAttackAtSec, clocks.expected);
  assert.equal(saved._basicAttackReadyAtSec, clocks.expected + 1, 'real basic cooldown must be reserved');
  assert.equal(saved._actionReadyAtSec, clocks._actionReadyAtSec, 'forced attack must not rewrite the action clock');
  assert.equal(saved._recentCombatUntil, 110, 'forced action does not erase the recovery deadline');
});

await check('taunt basic works in a 3-person team round without spending an ally reserved turn', async () => {
  const taunted = unit('taunted', 4, { teamId: 'blue', _recentCombatUntil: 110,
    _actionReadyAtSec: 100, _basicAttackReadyAtSec: 104,
    activeEffects: [control('도발', 6, 'taunter', point(4.5))] });
  const taunter = quietOpponent('taunter', 4.5, { teamId: 'red' });
  const ally = unit('ally', 5, { teamId: 'blue', _actionReadyAtSec: 1e9, _basicAttackReadyAtSec: 1e9 });
  const result = await runCombatScenario([taunted, taunter, ally], { startSec: 100, duration: 4.5 });
  assert.deepEqual(result.times('taunted'), [104]);
  assertActualBasics(result, 'taunted', 'taunter');
  assert.equal(result.events.some((row) => row.kind === 'team_strike' && row.who === 'taunted'
    && row.targetId === 'taunter'), true, 'team round must produce the forced actor strike');
  assert.equal(result.events.some((row) => row.kind === 'team_strike' && row.who === 'ally'), false,
    'the ally is not granted a free turn');
  const savedAlly = result.survivorMap.get('ally');
  assert.equal(savedAlly._lastBasicAttackAtSec, undefined);
  assert.equal(savedAlly._basicAttackReadyAtSec, 1e9);
  assert.equal(savedAlly._actionReadyAtSec, 1e9);
});

await check('expired forced control does not turn AI recovery into immunity or a free attack', async () => {
  const taunted = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 0.5, 'taunter', point(4.5))] });
  const taunter = quietOpponent('taunter', 4.5);
  const result = await runCombatScenario([taunted, taunter], { startSec: 100, duration: 5 });
  assert.deepEqual(result.times('taunted'), [100],
    'the forced command gets its first ready basic before expiry, then voluntary AI remains recovery-locked');
  assertActualBasics(result, 'taunted', 'taunter');
  assert.equal(result.survivorMap.get('taunted')._recentCombatUntil, 110);
});

await check('stun remains a hard action block during recovery and taunt', async () => {
  const stunned = unit('stunned', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 2, 'taunter', point(4.5)), effect('기절', 0.5)] });
  const stunTarget = quietOpponent('taunter', 4.5);
  const stunResult = await runCombatScenario([stunned, stunTarget], { startSec: 100, duration: 0.75 });
  assert.deepEqual(stunResult.times('stunned'), [100.5], 'stun blocks until expiry, then the forced basic resumes');
  assertActualBasics(stunResult, 'stunned', 'taunter');
  assert.equal(stunResult.survivorMap.get('stunned')._basicAttackReadyAtSec, 101.5,
    'the successful post-stun basic consumes its normal cooldown');
});

await check('silence blocks skills but does not block a taunt basic', async () => {
  const silenced = unit('silenced', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 2, 'silenceTarget', point(4.5)), effect('침묵', 2)] });
  assert.equal(status.canUseSkillByStatus(silenced), false, 'silence remains a skill blocker');
  const silenceTarget = quietOpponent('silenceTarget', 4.5);
  const silenceResult = await runCombatScenario([silenced, silenceTarget], { startSec: 100, duration: 0.5 });
  assert.deepEqual(silenceResult.times('silenced'), [100], 'silence blocks skills, not the forced basic');
  assertActualBasics(silenceResult, 'silenced', 'silenceTarget');
});

await check('out-of-range taunt pays forced walking time before striking and reserves cooldown at impact', async () => {
  const taunted = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 4, 'taunter', point(8))] });
  const taunter = quietOpponent('taunter', 8);
  const result = await runCombatScenario([taunted, taunter], { startSec: 100, duration: 2.5, engage: false });
  const times = result.times('taunted');
  assertActualBasics(result, 'taunted', 'taunter');
  assert.ok(times.length > 0, 'taunted actor eventually reaches its caster and attacks during recovery');
  assert.ok(times[0] > 100, 'the first basic cannot be free of the required movement time');
  assert.ok(times.every((time, index) => index === 0 || time - times[index - 1] >= 1 - 1e-6),
    'each attack respects the one-second basic cooldown');
  const saved = result.survivorMap.get('taunted');
  assert.equal(saved._lastBasicAttackAtSec, times.at(-1));
  assert.equal(saved._basicAttackReadyAtSec, times.at(-1) + 1);
  assert.equal(saved._recentCombatUntil, 110);
  assert.ok(saved._spatial.x >= 6.5 - 1e-6 && saved._spatial.x < 8,
    'movement stops at or just within basic reach, not at the caster');
});

await check('ordinary combat intent still cannot attack or move during AI recovery', async () => {
  const recovering = unit('recovering', 4, { _recentCombatUntil: 110,
    _combatIntent: { zoneId: 'zone', combatSpaceId: 'world', enemyTeamId: 'enemy', targetId: 'enemy', focusTargetId: 'enemy' },
    _spatialMotion: { zoneId: 'zone', combatSpaceId: 'world', targetId: 'enemy', x: 12, y: 4, stopRange: 1.5, reason: 'approach' } });
  const enemy = quietOpponent('enemy', 12, { teamId: 'enemy' });
  const result = await runCombatScenario([recovering, enemy], { startSec: 100, duration: 2 });
  assert.equal(noHostileActions(result, 'recovering').length, 0, 'voluntary attack remains recovery-locked');
  close(result.survivorMap.get('recovering')._spatial.x, 4, 'voluntary movement remains recovery-locked');
  assert.equal(result.survivorMap.get('recovering')._recentCombatUntil, 110);
});

await check('AI recovery remains vulnerable to an incoming ready opponent hit', async () => {
  const attacker = unit('attacker', 4, { teamId: 'enemy', _actionReadyAtSec: 100, _basicAttackReadyAtSec: 100 });
  const recovering = unit('recovering', 4.5, { _recentCombatUntil: 110 });
  const result = await runCombatScenario([attacker, recovering], { startSec: 100, duration: 0.5 });
  assert.ok(result.survivorMap.get('recovering').hp < 1000, 'AI recovery is not hit immunity');
  assert.equal(result.times('recovering').length, 0, 'the recovering actor did not get a free counterattack');
  assert.ok(result.events.some((row) => row.kind === 'damage' && row.who === 'attacker'
    && row.targetId === 'recovering' && row.hpDamage > 0));
});

await check('repeated forced taunt basics obey the configured attack interval', async () => {
  const taunted = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 5, 'taunter', point(4.5))] });
  const taunter = quietOpponent('taunter', 4.5);
  const result = await runCombatScenario([taunted, taunter], { startSec: 100, duration: 2.25 });
  const times = result.times('taunted');
  assertActualBasics(result, 'taunted', 'taunter');
  assert.ok(times.length >= 2, 'forced basics continue while the control and recovery overlap');
  assert.ok(times.every((time, index) => index === 0 || Math.abs(time - times[index - 1] - 1) < 1e-6),
    'attack speed 1 yields exactly one-second intervals');
  assert.equal(result.survivorMap.get('taunted')._basicAttackReadyAtSec, times.at(-1) + 1);
});

await check('recovery exception requires the scheduled caster target and cannot unlock other actions', () => {
  const a = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 2, 'taunter', point(4.5))] });
  assert.equal(canJoinTeamCombat(a, { nowSec: 100 }), false, 'legacy/cover calls get no forced exception');
  assert.equal(canJoinTeamCombat(a, { nowSec: 100, scheduledBasicTargetId: 'anotherEnemy' }), false);
  assert.equal(canJoinTeamCombat(a, { nowSec: 100, scheduledBasicTargetId: 'taunter' }), true);
  a._pendingCharacterCast = { releaseAtSec: 101 };
  assert.equal(canJoinTeamCombat(a, { nowSec: 100, scheduledBasicTargetId: 'taunter' }), false);
  a._pendingCharacterCast = null;
  for (const name of ['공포', '매혹', '기절']) {
    a.activeEffects = [control(name, 2, 'taunter', point(4.5))];
    assert.equal(canJoinTeamCombat(a, { nowSec: 100, scheduledBasicTargetId: 'taunter' }), false, name);
  }
});

await check('forced basics do not start ready character or ultimate skills during AI recovery', async () => {
  const taunted = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 2, 'taunter', point(4.5))],
    characterSkills: { q: skill({ name: 'ready Q', slot: 'q' }), r: skill({ name: 'ready R', slot: 'r' }) } });
  const result = await runCombatScenario([taunted, quietOpponent('taunter', 4.5)], {
    startSec: 100, duration: 2.25, settings: { skills: { characterSkills: true } } });
  assertActualBasics(result, 'taunted', 'taunter');
  assert.equal(result.events.some((event) => event.who === 'taunted'
    && ['skill_cast', 'skill', 'skill_armed'].includes(event.kind)), false);
  const saved = result.survivorMap.get('taunted');
  for (const slot of ['q', 'r']) assert.equal(Number(saved.skillState?.[slot]?.cooldownUntil || 0), 0,
    'a forced basic must not spend a ready skill cooldown');
});

const invalidSourceCases = [
  { name: 'missing', rows: (a, b, c) => [a, b] },
  { name: 'dead', rows: (a, b, c) => [a, b, { ...c, hp: 0 }] },
  { name: 'friendly', rows: (a, b, c) => [a, b, { ...c, teamId: a.teamId }] },
  { name: 'other zone', rows: (a, b, c) => [a, b, { ...c, zoneId: 'elsewhere', _spatial: point(4.5, 4, 'elsewhere') }] },
  { name: 'other combat space', rows: (a, b, c) => [a, b, { ...c, _combatSpaceId: 'other-space' }] },
  { name: 'untargetable', rows: (a, b, c) => [a, b, { ...c, activeEffects: [effect('대상 지정 불가', 2)] }] },
  { name: 'rift defeated', rows: (a, b, c) => {
    const inRift = (row) => ({ ...row, _combatSpaceId: 'dimension_rift:r1',
      _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 90 } });
    const riftActor = inRift(a);
    riftActor.activeEffects = [control('도발', 2, 'taunter', point(4.5))];
    return [riftActor, b, { ...inRift(c), _dimensionRiftDefeat: { riftId: 'r1', enteredAtSec: 90 } }];
  } },
];
for (const scenario of invalidSourceCases) await check(`invalid taunt source (${scenario.name}) cannot authorize a hit`, async () => {
  const a = unit('taunted', 4, { _recentCombatUntil: 110,
    activeEffects: [control('도발', 2, 'taunter', point(4.5))] });
  const b = quietOpponent('otherEnemy', 4.25);
  const c = quietOpponent('taunter', 4.5);
  const result = await runCombatScenario(scenario.rows(a, b, c), { startSec: 100, duration: 1.25 });
  assert.equal(noHostileActions(result, 'taunted').some((row) => row.targetId !== 'taunter'), false,
    `${scenario.name} cannot redirect to another enemy`);
  assert.equal(noHostileActions(result, 'taunted').length, 0, `${scenario.name} cannot authorize an invalid taunt`);
});

await check('JSON-restored forced control preserves source identity and deterministic recovery-time behavior', async () => {
  const initial = [
    unit('taunted', 4, { _recentCombatUntil: 110, _actionReadyAtSec: 102, _basicAttackReadyAtSec: 103,
      activeEffects: [control('도발', 4, 'taunter', point(4.5))] }),
    quietOpponent('taunter', 4.5),
  ];
  const first = await runCombatScenario(structuredClone(initial), { startSec: 100, duration: 4.25 });
  const restored = await runCombatScenario(JSON.parse(JSON.stringify(initial)), { startSec: 100, duration: 4.25 });
  assert.deepEqual(first.events, restored.events);
  assert.deepEqual(first.frames, restored.frames);
  assert.deepEqual(first.times('taunted'), [103]);
  assertActualBasics(first, 'taunted', 'taunter');
  assertActualBasics(restored, 'taunted', 'taunter');
  assert.ok(first.survivorMap.get('taunted')._recentCombatUntil > first.times('taunted')[0]);
});

console.log(`AI_RECOVERY_FORCED_CONTROL_CHECKS ${checks - failures.length}/${checks}`);
if (failures.length) {
  throw new AggregateError(failures.map(({ error }) => error),
    `${failures.length} of ${checks} AI recovery forced-control cases failed: ${failures.map(({ name }) => name).join('; ')}`);
}
