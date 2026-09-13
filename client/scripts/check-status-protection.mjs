import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const status = await import('../src/utils/statusLogic.js');
const { actor, effect, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { applyStatusEffect, applyRuntimeEffectPayloads, hasActiveEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { buildTacStatusEffects } = await import('../src/app/simulation/tacticalSkillTable.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { emitEffectRunEvents } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { formatRuntimeEffectResultText } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { getVisibleRuntimeEffects } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { normalizeGuestCharacterProfile, saveGuestCharacterProfile, readGuestCharacterProfiles,
  applyGuestCharacterProfiles } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const neverRoll = () => { throw new Error('Deterministic protection must not draw a random value.'); };
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

await check('named crowd control immunity blocks an incoming stun in the real application path', () => {
  const a = actor('a', { activeEffects: [effect('모든 방해 면역', 3)] });
  const result = applyStatusEffect(a, effect('기절', 5), { random: neverRoll });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'immune');
  assert.equal(status.hasActionBlockStatus(a), false);
});

await check('movement immunity has a narrower category than all crowd control immunity', () => {
  const move = actor('move', { activeEffects: [effect('이동 방해 면역', 3)] });
  for (const name of ['공포', '기절', '넉백', '도발', '이동 속도 감소', '매혹', '속박', '에어본', '제압', '춤']) {
    assert.equal(status.addOrRefreshEffect(move, effect(name, 1), { random: neverRoll }).reason, 'immune', name);
  }
  for (const name of ['침묵', '실명', '중독', '치유 감소']) {
    assert.equal(status.addOrRefreshEffect(move, effect(name, 1), { random: neverRoll }).applied, true, name);
  }
  const all = actor('all', { activeEffects: [effect('모든 방해 면역', 3)] });
  assert.equal(applyStatusEffect(all, effect('침묵', 1)).reason, 'immune');
  assert.equal(applyStatusEffect(all, effect('실명', 1)).reason, 'immune');
  assert.equal(applyStatusEffect(all, effect('중독', 1)).applied, true);
  assert.equal(status.updateEffects(all, { elapsedSec: 1 }).hp, 992, 'CC immunity is not invulnerability.');
});

await check('harmful immunity rejects non-CC debuffs and allows ordinary beneficial effects', () => {
  const a = actor('a', { activeEffects: [effect('해로운 효과 면역', 4)] });
  for (const name of ['기절', '중독', '화상', '치유 감소', '쿨다운 증가']) {
    assert.equal(applyStatusEffect(a, effect(name, 3), { random: neverRoll }).reason, 'immune');
  }
  assert.equal(applyStatusEffect(a, effect('후속 피해 표식', 3, { category: 'debuff' })).reason, 'immune');
  assert.equal(applyStatusEffect(a, effect('보호막', 3, { shieldValue: 30 })).applied, true);
  assert.equal(applyStatusEffect(a, effect('재생', 3)).applied, true);
  assert.equal(status.absorbShieldDamage(a, 50).damage, 20, 'Harmful-effect protection does not block direct damage.');
});

await check('expired protections and grants cannot reject new effects or suppress old controls', () => {
  const a = actor('a', { activeEffects: [effect('모든 방해 면역', 0), effect('저지 불가', 0),
    effect('보호', 0, { grantsImmunity: ['해로운 효과 면역'] })] });
  assert.equal(applyStatusEffect(a, effect('기절', 3)).applied, true);
  assert.equal(status.hasActionBlockStatus(a), true);
});

await check('permanent and granted immunity groups work while exact legacy immunity remains compatible', () => {
  for (const extra of [{ statusImmunities: ['cc_immune'] }, { activeEffects: [effect('외부 보호', 4, { grantsImmunity: ['cc_immune'] })] }]) {
    assert.equal(applyStatusEffect(actor('a', extra), effect('기절', 2), { random: neverRoll }).reason, 'immune');
  }
  const a = actor('a', { statusImmunities: ['stun'], statusResists: { 기절: 0.5 } });
  assert.equal(applyStatusEffect(a, effect('기절', 2), { random: neverRoll }).reason, 'immune');
  assert.equal(applyStatusEffect(actor('b', { statusResists: { 기절: 0.5 } }), effect('기절', 2), { random: () => 0.1 }).reason, 'resisted');
});

await check('unstoppable stores control without cancelling actions and resumes only its unexpired portion', () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 2)] });
  const result = applyStatusEffect(a, effect('기절', 5), { random: neverRoll });
  assert.equal(result.applied, true); assert.equal(result.suppressedBy, '저지 불가');
  assert.equal(a.activeEffects.length, 2); assert.equal(status.hasActionBlockStatus(a), false);
  assert.equal(hasActiveEffect(a, '기절'), false);
  const after = status.updateEffects(a, { elapsedSec: 2 });
  assert.equal(status.hasActionBlockStatus(after), true);
  assert.equal(hasActiveEffect(after, '기절'), true);
  assert.equal(after.activeEffects[0].remainingDuration, 3);
  assert.equal(status.hasActionBlockStatus(status.updateEffects(after, { elapsedSec: 3 })), false);
});

await check('a control expiring during unstoppable never reappears after protection ends', () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 4)] });
  applyStatusEffect(a, effect('속박', 2));
  assert.equal(status.updateEffects(a, { elapsedSec: 4 }).activeEffects.length, 0);
  assert.equal(status.canMoveByStatus(status.updateEffects(a, { elapsedSec: 2 })), true);
});

await check('CC immunity does not cleanse stored control or suspend its countdown', () => {
  const a = actor('a', { activeEffects: [effect('기절', 5)] });
  applyStatusEffect(a, effect('모든 방해 면역', 2));
  assert.equal(status.hasActionBlockStatus(a), false);
  assert.equal(a.activeEffects.length, 2);
  assert.equal(status.hasActionBlockStatus(status.updateEffects(a, { elapsedSec: 2 })), true);
});

await check('unrelated applications, shield damage and JSON normalization preserve suppressed effects', () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 2)] });
  applyStatusEffect(a, effect('기절', 5));
  applyStatusEffect(a, effect('보호막', 4, { shieldValue: 30 }));
  const next = status.absorbShieldDamage(a, 20).character;
  assert.equal(next.activeEffects.find((row) => row.name === '기절').remainingDuration, 5);
  const reloaded = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(next)));
  assert.equal(status.hasActionBlockStatus(reloaded), false);
  assert.equal(status.hasActionBlockStatus(status.updateEffects(reloaded, { elapsedSec: 2 })), true);
});

await check('cleansing is an instant action and removes both controls and non-CC marks without removing buffs', () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 2), effect('기절', 5), effect('중독', 5),
    effect('피해 표식', 4, { category: 'debuff' }), effect('보호막', 3, { shieldValue: 30 })] });
  const result = applyStatusEffect(a, effect('해로운 효과 제거', 0));
  assert.equal(result.applied, true); assert.equal(result.reason, 'cleansed');
  assert.deepEqual(result.removed.map((row) => row.name), ['기절', '중독', '피해 표식']);
  assert.deepEqual(a.activeEffects.map((row) => row.name), ['저지 불가', '보호막']);
  assert.equal(status.hasActionBlockStatus(status.updateEffects(a, { elapsedSec: 2 })), false);
  const empty = actor('b'); applyStatusEffect(empty, effect('해로운 효과 제거', 0));
  assert.equal(applyStatusEffect(empty, effect('기절', 3)).applied, true, 'Cleansing does not grant future immunity.');
});

await check('untargetability still rejects new protection and cleanse effects', () => {
  const a = actor('a', { activeEffects: [effect('대상 지정 불가', 3), effect('중독', 4)] });
  for (const name of ['모든 방해 면역', '해로운 효과 제거']) assert.equal(applyStatusEffect(a, effect(name, 2)).reason, 'untargetable');
  assert.ok(a.activeEffects.some((row) => row.name === '중독'));
});

await check('harmful protection ignores old DOT for its own duration without extending or deleting the DOT', () => {
  const a = actor('a', { activeEffects: [effect('중독', 5, { dotDamage: 8 }), effect('해로운 효과 면역', 2)] });
  const full = status.updateEffects(a, { elapsedSec: 5 });
  let stepped = structuredClone(a);
  for (let i = 0; i < 20; i++) stepped = status.updateEffects(stepped, { elapsedSec: 0.25 });
  assert.equal(full.hp, 976); assert.deepEqual(full, stepped);
  assert.equal(a.hp, 1000);
});

await check('duration resistance is deterministic and reduces only incoming control durations', () => {
  const a = actor('a', { stats: { ccDurationReduction: 0.4 } });
  for (const name of ['기절', '속박', '침묵']) {
    const result = status.addOrRefreshEffect(a, effect(name, 5), { random: neverRoll });
    assert.equal(result.effect.remainingDuration, 3, name);
    assert.equal(result.durationAdjustment.originalSec, 5);
  }
  for (const name of ['중독', '보호막', '재생', '무적']) assert.equal(status.addOrRefreshEffect(a, effect(name, 5)).effect.remainingDuration, 5);
});

await check('knockback, grab, airborne and suppression keep their duration despite resistance', () => {
  const a = actor('a', { stats: { ccDurationReduction: 1, slowDurationReduction: 1 } });
  for (const name of ['넉백', '붙잡힘', '에어본', '제압']) {
    const result = status.addOrRefreshEffect(a, effect(name, 3), { random: neverRoll });
    assert.equal(result.effect.remainingDuration, 3, name); assert.equal(result.durationAdjustment, undefined);
  }
});

await check('slow-specific resistance combines remaining-duration multipliers, not slow magnitude', () => {
  const a = actor('a', { stats: { ccDurationReduction: 0.3, slowDurationReduction: 0.4 } });
  const slow = applyStatusEffect(a, effect('이동 속도 감소', 10, { moveSpeedBonus: -0.5 }), { random: neverRoll });
  assert.equal(slow.effect.remainingDuration, 4.2); assert.equal(slow.effect.moveSpeedBonus, -0.5);
  const stun = applyStatusEffect(a, effect('기절', 10)); assert.equal(stun.effect.remainingDuration, 7);
});

await check('duration resistance includes explicit equipped items, passive and active stats, not stored spares', () => {
  const a = actor('a', { stats: { ccDurationReduction: 0.1 },
    characterSkills: { passive: { enabled: true, statModifiers: { ccDurationReduction: 0.2 } } },
    activeEffects: [effect('저항 보강', 3, { statModifiers: { ccDurationReduction: 0.1 } })],
    inventory: [{ itemId: 'equipped', equipSlot: 'head', stats: { ccDurationReduction: 0.1 } },
      { itemId: 'spare', equipSlot: 'head', tier: 9, stats: { ccDurationReduction: 0.9 } }], equipped: { head: 'equipped' } });
  assert.equal(status.addOrRefreshEffect(a, effect('기절', 4)).effect.remainingDuration, 2);
  a.equipped.head = ''; assert.equal(status.addOrRefreshEffect(a, effect('기절', 4)).effect.remainingDuration, 2.4);
  a.characterSkills.passive.enabled = false; assert.equal(status.addOrRefreshEffect(a, effect('기절', 4)).effect.remainingDuration, 3.2);
});

await check('zero-duration after resistance is rejected while malformed stats and persistent effects stay finite-safe', () => {
  const a = actor('a', { stats: { ccDurationReduction: 1 } });
  const zero = applyStatusEffect(a, effect('기절', 3), { random: neverRoll });
  assert.equal(zero.applied, false); assert.equal(zero.reason, 'duration_reduced'); assert.equal(a.activeEffects.length, 0);
  assert.equal(status.addOrRefreshEffect(actor('bad', { stats: { ccDurationReduction: Infinity } }), effect('기절', 3)).effect.remainingDuration, 3);
  assert.equal(status.addOrRefreshEffect(a, { name: '기절' }).effect.remainingDuration, undefined);
});

await check('refresh does not apply resistance a second time to old remaining duration', () => {
  const a = actor('a', { stats: { ccDurationReduction: 0.5 } });
  applyStatusEffect(a, effect('기절', 10));
  const later = status.updateEffects(a, { elapsedSec: 2 });
  applyStatusEffect(later, effect('기절', 4));
  assert.equal(later.activeEffects[0].remainingDuration, 3);
  assert.equal(normalizeRuntimeSurvivor(later).activeEffects[0].remainingDuration, 3);
});

await check('guest profile save and reload retains resistance modifiers and changes actual incoming effects', () => {
  const data = new Map(); const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const raw = { id: 'guest-survivor-01', name: '저항 검사', characterSkills: { passive: { enabled: true, name: '저항',
    statModifiers: { ccDurationReduction: 0.25, slowDurationReduction: 0.2 } } } };
  assert.equal(saveGuestCharacterProfile(raw, storage).ok, true);
  const profile = readGuestCharacterProfiles(storage).profiles[0];
  assert.deepEqual(profile, normalizeGuestCharacterProfile(raw));
  const a = applyGuestCharacterProfiles([actor('guest-survivor-01', { guestDefault: true })], [profile])[0];
  assert.equal(applyStatusEffect(a, effect('이동 속도 감소', 5)).effect.remainingDuration, 3);
});

await check('applied payload metadata, saved events and visible text preserve real reduced durations', () => {
  const a = actor('a', { stats: { ccDurationReduction: 0.5 } });
  const result = applyRuntimeEffectPayloads(a, [effect('기절', 4)]).results[0];
  assert.equal(result.effect.remainingDuration, 2);
  assert.match(formatRuntimeEffectResultText(result), /지속 시간 4→2초/);
  const events = []; emitEffectRunEvents((kind, data) => events.push({ kind, ...data }), a, [result]);
  assert.equal(events[0].duration, 2); assert.equal(events[0].durationAdjustment.appliedSec, 2);
  assert.equal(events[0].durationAdjustment.originalSec, 4);
});

await check('suppression and cleansing are explained without displaying them as ordinary failed applications', () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 3)] });
  const muted = applyStatusEffect(a, effect('기절', 5));
  assert.match(formatRuntimeEffectResultText(muted), /저지 불가로 무시 중/);
  assert.match(getVisibleRuntimeEffects(a.activeEffects).find((row) => row.name === '기절')._boardLabel, /저지 불가로 무시 중/);
  const removed = applyStatusEffect(a, effect('해로운 효과 제거', 0));
  assert.match(formatRuntimeEffectResultText(removed), /제거: 기절/);
  const events = []; emitEffectRunEvents((kind, data) => events.push({ kind, ...data }), a, [muted, removed]);
  assert.equal(events[0].suppressedBy, '저지 불가'); assert.deepEqual(events[1].removedEffects, ['기절']);
});

await check('actual combat begins on the reduced stun expiry, not its original expiry', async () => {
  const a = actor('a', { stats: { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1, ccDurationReduction: 0.5 } });
  applyStatusEffect(a, effect('기절', 2));
  const result = await runCombatScenario([a, actor('b', { _basicAttackReadyAtSec: 200 })], { duration: 3 });
  assert.equal(result.times('a')[0], 101); assert.ok(result.times('a').every((at) => at >= 101));
});

await check('actual basic attacks stop while residual CC resumes after unstoppable ends', async () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 1)] });
  applyStatusEffect(a, effect('기절', 3));
  const result = await runCombatScenario([a, actor('b', { _basicAttackReadyAtSec: 200 })], { duration: 4 });
  assert.equal(result.times('a')[0], 100);
  assert.ok(result.times('a').includes(103));
  assert.ok(result.times('a').every((at) => at < 101 || at >= 103));
});

await check('actual pending casts cancel when stored silence resumes after protection ends', async () => {
  const a = actor('a', { activeEffects: [effect('저지 불가', 0.375)], characterSkills: { q: skill({ castDelaySec: 2 }) } });
  applyStatusEffect(a, effect('침묵', 4));
  const input = [a, actor('b', { _basicAttackReadyAtSec: 200 })];
  const first = await runCombatScenario(structuredClone(input), { duration: 3 });
  assert.ok(first.events.some((event) => event.kind === 'skill_cast' && event.who === 'a'));
  assert.ok(first.events.some((event) => event.kind === 'skill_cancel' && event.who === 'a' && event.reason === 'status'));
  assert.equal(first.events.find((event) => event.kind === 'skill_cancel' && event.who === 'a').at.sec, 100.375,
    'Protection expiry must reconcile the pending cast at that boundary, not its later release.');
  assert.equal(first.times('a', 'skill').length, 0);
  const second = await runCombatScenario(JSON.parse(JSON.stringify(input)), { duration: 3 });
  assert.deepEqual(first.events, second.events); assert.deepEqual(first.frames, second.frames);
});

await check('actual tactical slow applications use target resistance and cannot bypass movement immunity', () => {
  const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 100 } });
  const attacker = () => actor('attacker', { tacticalSkill: '퀘이크', _tacNextAbsSec: 0 });
  const target = actor('target', { stats: { ccDurationReduction: 0.5 } });
  runtime.applyCombatTacAttack(attacker(), target, 0);
  const baseSlow = buildTacStatusEffects('퀘이크', 1, '', { target: 'enemy' }).find((row) => row.name === '이동 속도 감소');
  assert.equal(target.activeEffects.find((row) => row.name === '이동 속도 감소').remainingDuration, baseSlow.remainingDuration * 0.5);
  const protectedTarget = actor('protected', { activeEffects: [effect('이동 방해 면역', 3)] });
  runtime.applyCombatTacAttack(attacker(), protectedTarget, 0);
  assert.equal(protectedTarget.activeEffects.some((row) => row.name === '이동 속도 감소'), false);
});

await check('persistent protection refresh and JSON round trips cannot turn it into a timed or expired buff', () => {
  const a = actor('a', { activeEffects: [{ name: '모든 방해 면역', remainingDuration: null }] });
  assert.equal(applyStatusEffect(a, effect('기절', 2)).reason, 'immune');
  applyStatusEffect(a, effect('모든 방해 면역', 1));
  const later = status.updateEffects(JSON.parse(JSON.stringify(a)), { elapsedSec: 10 });
  assert.equal(applyStatusEffect(later, effect('기절', 2)).reason, 'immune');
  const poison = actor('poison', { activeEffects: [{ name: '중독', remainingDuration: null, dotDamage: 8 }] });
  assert.equal(status.updateEffects(poison, { elapsedSec: 2 }).hp, 984);
});

await check('batched spatial movement stops for residual root after protection expiry just like substeps', () => {
  const original = actor('a', { activeEffects: [effect('저지 불가', 1), effect('속박', 3)],
    _spatialMotion: { zoneId: 'zone', x: 20, y: 4, stopRange: 0, reason: 'patrol' } });
  const full = structuredClone(original); advanceSpatialMovement([full], 100, 4);
  let split = structuredClone(original);
  for (let i = 0; i < 16; i++) { advanceSpatialMovement([split], 100 + i * 0.25, 0.25); split = status.updateEffects(split, { elapsedSec: 0.25 }); }
  assert.equal(full._spatial.x, 11);
  assert.deepEqual(full._spatial, split._spatial);
});

await check('persistent status badges never claim a zero-second expiration', () => {
  for (const remainingDuration of [null, undefined]) {
    const [badge] = getVisibleRuntimeEffects([{ name: '모든 방해 면역', remainingDuration }]);
    assert.match(badge._boardLabel, /모든 방해 면역/);
    assert.doesNotMatch(badge._boardLabel, /0s/);
    assert.doesNotMatch(badge._boardTitle, /0s/);
  }
  const [timed] = getVisibleRuntimeEffects([effect('기절', 0.375)]);
  assert.match(timed._boardLabel, /0.38s/);
});

console.log(`STATUS_PROTECTION_CHECKS ${checks}/${checks}`);
