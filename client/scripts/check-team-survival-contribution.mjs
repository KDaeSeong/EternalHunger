import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, effect, runCombatScenario, skill } from './lib/run-combat-scenario.mjs';

// These cases use the production runPvpActionLoop, cast scheduler, combat
// damage, and team-round path. No instant-skill release or winner override.
const settings = { skills: { characterSkills: true } };
const seed = 'team-survival-contribution-v1';
const stats = (attackPower, defense = 0, attackSpeed = 1, moveSpeed = 3.5) => ({
  maxHp: 100, attackPower, defense, attackSpeed, attackRange: 2, sightRange: 12, moveSpeed,
});
const repeatSignature = (result) => JSON.stringify({
  events: result.events,
  frames: result.frames,
  randomState: result.randomState,
  survivors: [...result.survivorMap.values()].sort((a, b) => a._id.localeCompare(b._id)),
});
let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
}

async function runSupportCase(withSupport) {
  const healer = actor('a-healer', { teamId: 'team-a', teamName: 'A', hp: 100, maxHp: 100,
    stats: stats(0), characterSkills: withSupport ? { w: skill({ name: '실전 회복', slot: 'w', type: 'heal_skill',
      heal: [20], supportTargetScope: 'ally', castDelaySec: 0.25, recoveryDelaySec: 0.25, cooldownSec: 10 }) } : {} });
  const enemy = actor('z-enemy', { teamId: 'team-z', teamName: 'Z', hp: 1000, maxHp: 1000,
    stats: stats(60, 10, 1), _basicAttackReadyAtSec: 100.5 });
  const wounded = actor('b-wounded', { teamId: 'team-a', teamName: 'A', hp: 50, maxHp: 100,
    stats: stats(0, 10) });
  const result = await runCombatScenario([healer, enemy, wounded], { duration: 0.75, settings, seed });
  return { result, healerId: healer._id, woundedId: wounded._id, enemyId: enemy._id };
}

await check('an automatically scheduled support cast preserves a wounded teammate through a real hostile hit', async () => {
  const supported = await runSupportCase(true);
  const unsupported = await runSupportCase(false);
  const { result, healerId, woundedId, enemyId } = supported;
  const healed = result.events.find(event => event.kind === 'skill' && event.who === healerId
    && event.targetId === woundedId && Number(event.heal || 0) > 0);
  assert.ok(healed, 'The production scheduler must choose, cast, and release the ally heal.');
  assert.equal(healed.at.sec, 100.25);
  const castStart = result.events.find(event => event.kind === 'skill_cast' && event.who === healerId
    && event.targetId === woundedId && event.slot === 'w');
  assert.ok(castStart, 'The observed heal must have a real scheduled cast, not a manually released payload.');
  assert.equal(castStart.at.sec, 100);
  assert.equal(result.survivorMap.get(healerId).skillState.w.cooldownUntil, 110);
  const hostileHit = result.events.find(event => event.kind === 'damage' && event.who === enemyId
    && event.targetId === woundedId && event.type === 'basic' && event.hpDamage > 0);
  assert.ok(hostileHit, 'The survival difference must include a real incoming HP-damage packet.');
  assert.equal(hostileHit.hpBefore, 70);
  assert.ok(result.survivorMap.get(woundedId).hp > 0);
  const unsupportedHit = unsupported.result.events.find(event => event.kind === 'damage' && event.who === unsupported.enemyId
    && event.targetId === unsupported.woundedId && event.type === 'basic' && event.hpDamage > 0);
  assert.ok(unsupportedHit, 'The no-support control must receive the same real hostile action.');
  assert.equal(unsupportedHit.at.sec, hostileHit.at.sec);
  assert.equal(unsupportedHit.raw, hostileHit.raw, 'Both conditions must use identical incoming raw damage.');
  assert.equal(unsupportedHit.damage, hostileHit.damage, 'Both conditions use the same calculated damage before overkill clipping.');
  assert.equal(unsupportedHit.hpDamage, Math.min(unsupportedHit.hpBefore, unsupportedHit.damage));
  assert.equal(hostileHit.hpDamage, Math.min(hostileHit.hpBefore, hostileHit.damage));
  assert.ok(hostileHit.damage > unsupportedHit.hpBefore && hostileHit.damage < hostileHit.hpBefore,
    'The unchanged incoming hit must be lethal only without the actual heal.');
  assert.equal(unsupportedHit.hpBefore, 50);
  assert.equal(hostileHit.at.sec, 100.5);
  assert.equal(unsupportedHit.at.sec, 100.5);
  assert.equal(unsupported.result.survivorMap.get(unsupported.woundedId).hp, 0,
    'Without the configured support skill, the same scheduled hostile hit is lethal.');
  assert.equal(unsupported.result.events.some(event => event.kind === 'skill' && event.who === unsupported.healerId
    && event.targetId === unsupported.woundedId), false);
  console.log(JSON.stringify({ comparison: 'automatic support cast → real incoming hit → teammate survival',
    heal: healed.heal, incomingDamage: hostileHit.hpDamage,
    supportedHp: result.survivorMap.get(woundedId).hp,
    unsupportedHp: unsupported.result.survivorMap.get(unsupported.woundedId).hp }));
});

async function runFormationCase(helperX) {
  const leader = actor('a-leader', { teamId: 'team-a', teamName: 'A', hp: 100, maxHp: 100,
    stats: stats(30, 0, 0.5, 0.1), _spatial: { zoneId: 'zone', x: 8, y: 8 } });
  const helper = actor('b-helper', { teamId: 'team-a', teamName: 'A', hp: 100, maxHp: 100,
    stats: stats(30, 0, 0.5, 0.1), _spatial: { zoneId: 'zone', x: helperX, y: 8 } });
  const enemy = actor('z-enemy', { teamId: 'team-z', teamName: 'Z', hp: 50, maxHp: 50,
    stats: stats(60, 0, 1, 0.1), _spatial: { zoneId: 'zone', x: 8, y: 8 }, _basicAttackReadyAtSec: 100.5 });
  const result = await runCombatScenario([leader, enemy, helper], { duration: 2.2, settings, seed });
  return { result, leaderId: leader._id, helperId: helper._id, enemyId: enemy._id };
}

await check('a same-stat nearby teammate focuses a real enemy kill before the remote counterpart can join', async () => {
  const nearby = await runFormationCase(9);
  const remote = await runFormationCase(22);
  const { result, leaderId, helperId, enemyId } = nearby;
  const helperHit = result.events.find(event => event.kind === 'damage' && event.who === helperId
    && event.targetId === enemyId && event.type === 'basic' && event.hpDamage > 0);
  assert.ok(helperHit, 'The nearby ally must perform a scheduled in-range attack.');
  const alliedStrikes = result.events.filter(event => event.kind === 'team_strike'
    && [leaderId, helperId].includes(event.who) && event.targetId === enemyId && event.damage > 0);
  assert.equal(new Set(alliedStrikes.map(event => event.who)).size, 2,
    'Both nearby allies must spend their own actual in-range strike on the enemy.');
  assert.ok(alliedStrikes.some(event => event.reason === 'focus_fire'),
    'Whichever ally acts second must follow the shared focus target; initiative is not fixed to actor name.');
  assert.equal(result.survivorMap.get(enemyId).hp, 0, 'The focused allied attacks must actually eliminate the enemy.');
  assert.ok(result.survivorMap.get(leaderId).hp > 0, 'At least the pressured leader must survive the completed team kill.');
  assert.equal(remote.result.survivorMap.get(remote.enemyId).hp > 0, true,
    'The equal-stat remote teammate cannot contribute an out-of-range attack in this short encounter.');
  assert.equal(remote.result.events.some(event => event.kind === 'damage' && event.who === remote.helperId
    && event.targetId === remote.enemyId && event.type === 'basic' && event.hpDamage > 0), false);
  const remoteLeaderHits = remote.result.events.filter(event => event.kind === 'damage' && event.targetId === remote.leaderId
    && event.type === 'basic' && event.hpDamage > 0);
  assert.ok(remoteLeaderHits.length > 0, 'The remote condition must expose the leader to real enemy attacks.');
  assert.equal(remote.result.survivorMap.get(remote.leaderId).hp, 0,
    'Without the nearby teammate contribution, the same pressured leader is actually eliminated.');
  assert.ok(remoteLeaderHits.some(event => event.hpAfter === 0 && event.hpBefore > 0),
    'The remote leader loss must come from an actual lethal HP packet.');
  assert.deepEqual(result.survivorMap.get(helperId).stats, remote.result.survivorMap.get(remote.helperId).stats,
    'Only the helper position changes; its combat abilities stay identical.');
  console.log(JSON.stringify({ comparison: 'same seeded matchup, same helper stats, near versus remote',
    nearbyHelperDamage: helperHit.hpDamage,
    nearbyEnemyHp: result.survivorMap.get(enemyId).hp,
    nearbyLeaderHp: result.survivorMap.get(leaderId).hp,
    remoteEnemyHp: remote.result.survivorMap.get(remote.enemyId).hp,
    remoteLeaderHp: remote.result.survivorMap.get(remote.leaderId).hp }));
});

await check('each fresh support and formation input reproduces events, frames, final state, and RNG-seeded outcome', async () => {
  for (const run of [() => runSupportCase(true), () => runSupportCase(false),
    () => runFormationCase(9), () => runFormationCase(22)]) {
    const first = await run();
    const second = await run();
    assert.equal(repeatSignature(first.result), repeatSignature(second.result),
      'runCombatScenario restarts the same explicit seed for every fresh identical input.');
  }
});

await check('the production scheduler excludes remote, dead and controlled allies from actual attacks', async () => {
  const member = (id, zoneId = 'zone', extra = {}) => actor(id, { teamId: 'team-a', zoneId,
    _combatIntent: { zoneId, combatSpaceId: 'world', enemyTeamId: 'team-z', targetId: 'z-enemy', focusTargetId: '' }, ...extra });
  const result = await runCombatScenario([
    member('a-active'), member('a-remote', 'far'), member('a-dead', 'zone', { hp: 0 }),
    member('a-stunned', 'zone', { activeEffects: [effect('기절', 10)] }),
    actor('z-enemy', { teamId: 'team-z', _combatIntent: {
      zoneId: 'zone', combatSpaceId: 'world', enemyTeamId: 'team-a', targetId: 'a-active', focusTargetId: '' } }),
  ], { duration: 3, seed, engage: false, settings: { skills: { characterSkills: false } } });
  const excluded = new Set(['a-remote', 'a-dead', 'a-stunned']);
  assert.equal(result.events.some(event => event.kind === 'damage' && excluded.has(event.who)), false);
  const engagements = result.events.filter(event => event.kind === 'team_engagement');
  assert.ok(engagements.length > 0, 'The controlled case must actually reach team action scheduling.');
  assert.ok(engagements.every(event => event.participants.every(id => !excluded.has(id))));
  const attacks = result.events.filter(event => event.kind === 'damage' && event.who === 'a-active' && event.hpDamage > 0);
  assert.deepEqual(attacks.map(event => event.at.sec), [100, 101, 102],
    'The eligible local actor must spend its own scheduled turns, without duplicate same-time attacks.');
});

console.log(`TEAM_SURVIVAL_CONTRIBUTION_CHECKS ${checks}/${checks}`);
