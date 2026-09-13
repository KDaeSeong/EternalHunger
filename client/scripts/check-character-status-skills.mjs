import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createDefaultCompiledSkill } = await import('../src/utils/characterSkillCompilerCore.js');
const { compileNaturalSkillDescription } = await import('../src/utils/characterSkillCompiler.js');
const { normalizeCharacterSkillForEditor } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { saveGuestCharacterProfile, readGuestCharacterProfiles, applyGuestCharacterProfiles, GUEST_CHARACTER_PROFILE_KEY } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { getCharacterSkillDef } = await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');
const { findCharacterSkillChoice, startCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { CHARACTER_STATUS_EFFECT_OPTIONS } = await import('../src/utils/characterStatusSkillDefinition.js');
const { actor, skill, effect, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const memoryStorage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)) }; };
const status = (name, durationSec = 2, extra = {}) => ({ name, target: 'target', durationSec, ...extra });
const statusSkill = (effects, extra = {}) => skill({ name: '사용자 상태 스킬', flatDamage: [0], statusEffects: effects, ...extra });
const profile = (q) => ({ id: 'guest-survivor-01', name: '사용자 검사자', characterSkills: { q } });
const eventsOf = (result, name) => result.events.filter((row) => row.kind === 'effect' && row.effect === name);
let checks = 0; let failures = 0;
const check = async (name, run) => { checks++; try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); } };

await check('both editors and the runtime definition preserve explicit status fields, never live state', () => {
  const expected = [status('수면', 2.5, { wakeDamagePct: 0 }), status('회피', 1, { target: 'self' })];
  const q = statusSkill(expected.map((row) => ({ ...row, sourceActorId: 'forged', remainingDuration: 999, tags: ['damage_immune'] })));
  for (const result of [createDefaultCompiledSkill(q, 'q'), normalizeCharacterSkillForEditor({ q }, 'q'),
    getCharacterSkillDef(actor('caster', { localProfile: true, characterSkills: { q } }), 'q')]) {
    assert.deepEqual(result.statusEffects, expected);
  }
});
await check('status-only skills save and reload with the existing key and schema', () => {
  const store = memoryStorage(); const q = statusSkill([status('수면', 2.5)]);
  const saved = saveGuestCharacterProfile(profile(q), store);
  assert.equal(saved.ok, true, saved.errors?.join(' '));
  const reloaded = readGuestCharacterProfiles(store);
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.profiles[0].characterSkills.q.statusEffects[0].name, '수면');
  assert.equal(JSON.parse(store.getItem(GUEST_CHARACTER_PROFILE_KEY)).schemaVersion, 1);
});
await check('unsupported names, invalid duration, target polarity and excess effects fail without replacing saved data', () => {
  const store = memoryStorage(); assert.equal(saveGuestCharacterProfile(profile(skill()), store).ok, true);
  const before = store.getItem(GUEST_CHARACTER_PROFILE_KEY);
  for (const effects of [[status('미구현 상태')], [status('기절', 0)], [status('기절', 61)],
    [status('기절', 2, { target: 'all' })], [status('무적')], Array.from({ length: 5 }, () => status('기절'))]) {
    assert.equal(saveGuestCharacterProfile(profile(statusSkill(effects, { flatDamage: [40] })), store).ok, false);
    assert.equal(store.getItem(GUEST_CHARACTER_PROFILE_KEY), before);
  }
});
await check('zero-damage hostile control is selected by the real AI and applied only at release', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('기절', 2)]) } }), actor('victim')], { duration: 2 });
  const applied = eventsOf(result, '기절').filter((row) => row.outcome === 'applied');
  assert.equal(applied.length, 1); assert.equal(applied[0].at.sec, 101.25); assert.equal(applied[0].who, 'victim');
  assert.ok(result.events.some((row) => row.kind === 'skill_cast' && row.who === 'caster'));
  assert.ok(result.frames.filter((frame) => frame.sec < 101.25).every((frame) => !frame.roster.find((row) => row._id === 'victim').activeEffects?.some((row) => row.name === '기절')));
});
await check('a damaging sleep skill deals damage before applying sleep, without waking its own fresh effect', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('수면', 2)], { flatDamage: [40] }) } }), actor('victim')], { duration: 1.3 });
  assert.equal(eventsOf(result, '수면').filter((row) => row.outcome === 'applied').length, 1);
  assert.equal(result.events.filter((row) => row.kind === 'sleep_break').length, 0);
  assert.equal(result.events.find((row) => row.kind === 'damage' && row.who === 'caster' && row.type === 'skill').hpDamage, 40);
});
await check('a support-only cleanse uses the selected ally and never damages it', async () => {
  const result = await runCombatScenario([actor('caster', { teamId: 'blue', characterSkills: { q: statusSkill([status('해로운 효과 제거', 0)],
    { type: 'support_skill', supportTargetScope: 'ally' }) } }), actor('enemy'), actor('ally', { teamId: 'blue', activeEffects: [effect('기절', 10)] })], { duration: 2 });
  const cleaned = eventsOf(result, '해로운 효과 제거');
  assert.equal(cleaned.length, 1); assert.equal(cleaned[0].who, 'ally'); assert.deepEqual(cleaned[0].removedEffects, ['기절']);
  assert.ok(!result.events.some((row) => row.kind === 'damage' && row.who === 'caster' && row.targetId === 'ally'));
});
await check('legacy profiles load without status effects and malformed saved effects are not rewritten', () => {
  const store = memoryStorage();
  store.setItem(GUEST_CHARACTER_PROFILE_KEY, JSON.stringify({ schemaVersion: 1, profiles: [profile(skill())] }));
  assert.equal(readGuestCharacterProfiles(store).ok, true);
  assert.deepEqual(readGuestCharacterProfiles(store).profiles[0].characterSkills.q.statusEffects, []);
  for (const q of [statusSkill([status('기절', null)]), statusSkill([status('기절', 2, { wakeDamagePct: 1 })]),
    statusSkill([status('수면', 2, { wakeDamagePct: 2 })]), statusSkill([status('변이', 2, { moveSpeedBonus: -1 })]),
    statusSkill([status('기절'), status('기절')]), statusSkill([status('회피')], { type: 'support_skill', flatDamage: [30] })]) {
    const text = JSON.stringify({ schemaVersion: 1, profiles: [profile(q)] }); store.setItem(GUEST_CHARACTER_PROFILE_KEY, text);
    assert.equal(readGuestCharacterProfiles(store).ok, false); assert.equal(store.getItem(GUEST_CHARACTER_PROFILE_KEY), text);
  }
});
await check('AI estimates never mutate actors or roll resistance and choose an unprotected enemy', () => {
  const a = actor('caster', { characterSkills: { q: statusSkill([status('기절')]) } });
  const b = actor('immune', { statusImmunities: ['기절'] }); const c = actor('valid', { statusResists: { 기절: 0.5 } });
  const before = JSON.stringify([a, b, c]);
  withSimulationRandom(() => { throw Error('AI must not draw randomness'); }, () => {
    const plan = findCharacterSkillChoice(a, [b, c], [a, b, c], 100, {}); assert.equal(plan.targetId, 'valid');
    assert.equal(findCharacterSkillChoice(a, [b], [a, b], 100, {}), null);
  });
  assert.equal(JSON.stringify([a, b, c]), before);
});
await check('AI avoids redundant long control and empty cleanse but permits a useful refresh', () => {
  const a = actor('caster', { characterSkills: { q: statusSkill([status('기절', 2)]) } });
  const b = actor('enemy', { activeEffects: [effect('기절', 1.5)] });
  assert.equal(findCharacterSkillChoice(a, [b], [a, b], 100, {}), null);
  b.activeEffects = [effect('기절', 0.75)]; assert.ok(findCharacterSkillChoice(a, [b], [a, b], 100, {}));
  a.characterSkills.q = statusSkill([status('해로운 효과 제거', 0)], { type: 'support_skill', supportTargetScope: 'self' });
  assert.equal(findCharacterSkillChoice(a, [b], [a, b], 100, {}), null);
});
await check('immunity acquired during a cast blocks the released state with an honest event', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('기절')]) } }), actor('victim')],
    { duration: 1.5, onElapsed: (map, sec) => { if (sec === 1) map.get('victim').activeEffects = [effect('모든 방해 면역', 5)]; } });
  const applied = eventsOf(result, '기절'); assert.equal(applied.length, 1); assert.equal(applied[0].outcome, 'immune');
  assert.equal(applied[0].immunityType, '모든 방해 면역');
});
await check('duration resistance is evaluated at release and forced controls preserve the actual caster', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('공포', 2)]) } }),
    actor('victim', { stats: { maxHp: 1000, defense: 0, attackPower: 1, attackSpeed: 1, ccDurationReduction: 0.5 } })], { duration: 1.3 });
  const applied = eventsOf(result, '공포')[0]; assert.equal(applied.duration, 1); assert.equal(applied.sourceActorId, 'caster');
  const saved = result.frames.at(-1).roster.find((row) => row._id === 'victim').activeEffects.find((row) => row.name === '공포');
  assert.equal(saved.sourceActorId, 'caster'); assert.ok(Number.isFinite(saved.sourcePosition.x));
});
await check('zero-damage area control includes only enemies within radius, even through invulnerability', async () => {
  const result = await runCombatScenario([actor('caster', { teamId: 'blue', characterSkills: { q: statusSkill([status('속박')], { radius: 1, targetPriority: 'damage' }) } }),
    actor('victim'), actor('near', { activeEffects: [effect('무적', 5), effect('기절', 5)], _spatial: { zoneId: 'zone', x: 4.5, y: 4 } }),
    actor('far', { activeEffects: [effect('속박', 5)], _spatial: { zoneId: 'zone', x: 10, y: 4 } }),
    actor('ally', { teamId: 'blue' })], { duration: 1.3 });
  const targets = eventsOf(result, '속박').filter((row) => row.outcome === 'applied').map((row) => row.who).sort();
  assert.deepEqual(targets, ['near', 'victim'], JSON.stringify({ effects: result.events.filter((row) => row.kind === 'effect'),
    positions: result.frames.at(-1).roster.map((row) => ({ id: row._id, position: row._spatial })) }));
});
await check('enhancement applies control on the later basic, not when armed, and a miss spends it without effects', async () => {
  const make = (extra = {}) => actor('caster', { characterSkills: { q: statusSkill([status('수면')], { type: 'basic_attack_enhance' }) }, ...extra });
  const normal = await runCombatScenario([make(), actor('victim')], { duration: 1.6 });
  assert.equal(normal.events.find((row) => row.kind === 'skill_armed').at.sec, 101.25);
  assert.equal(eventsOf(normal, '수면')[0].at.sec, 101.5);
  assert.equal(normal.events.filter((row) => row.kind === 'sleep_break').length, 0);
  const miss = await runCombatScenario([make({ activeEffects: [effect('실명', 5)] }), actor('victim')], { duration: 2 });
  assert.equal(eventsOf(miss, '수면').length, 0); assert.ok(miss.events.some((row) => row.kind === 'skill_armed'));
  assert.equal(miss.frames.at(-1).roster.find((row) => row._id === 'caster')._armedCharacterSkill, null);
});
await check('an area attack applies its own protection once and never gifts it to enemies', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('회피', 2, { target: 'self' })], { flatDamage: [10], radius: 1 }) } }),
    actor('victim'), actor('other')], { duration: 1.3 });
  const applied = eventsOf(result, '회피'); assert.equal(applied.length, 1); assert.equal(applied[0].who, 'caster');
});
await check('a target killed by the skill receives no postmortem control', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('수면')], { flatDamage: [2000] }) } }), actor('victim')], { duration: 1.3 });
  assert.equal(eventsOf(result, '수면').length, 0);
  assert.ok(result.events.some((row) => row.kind === 'damage' && row.who === 'caster' && row.hpAfter === 0));
});
await check('cancelled status casts cannot apply their target or self payload', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('기절'), status('회피', 2, { target: 'self' })]) } }), actor('victim')],
    { duration: 2, onElapsed: (map, sec) => { if (sec === 1) map.get('victim').zoneId = 'remote'; } });
  assert.equal(eventsOf(result, '기절').length + eventsOf(result, '회피').length, 0);
  assert.ok(result.events.some((row) => row.kind === 'skill_cancel' && row.who === 'caster'));
});
await check('a real hostile control release cancels the victims still-pending skill', async () => {
  const result = await runCombatScenario([actor('caster', { characterSkills: { q: statusSkill([status('기절')], { castDelaySec: 0.25 }) } }),
    actor('victim', { characterSkills: { q: skill({ castDelaySec: 1.25 }) } })], { duration: 2 });
  assert.ok(result.events.some((row) => row.kind === 'skill_cancel' && row.who === 'victim' && row.reason === 'status'));
  assert.ok(!result.events.some((row) => row.kind === 'damage' && row.who === 'victim' && row.castId));
});
await check('saved pending status casts replay identically and their effect is visible to the watched team', async () => {
  const a = actor('caster', { characterSkills: { q: statusSkill([status('수면')]) } }); const b = actor('victim');
  engageCombatParticipants(a, b, [a, b], 100);
  startCharacterCast(a, findCharacterSkillChoice(a, [b], [a, b], 100, {}), 100, {});
  const stored = JSON.stringify([a, b]);
  const first = await runCombatScenario(JSON.parse(stored), { startSec: 101, duration: 0.3, engage: false });
  const second = await runCombatScenario(JSON.parse(stored), { startSec: 101, duration: 0.3, engage: false });
  assert.deepEqual(first.events, second.events); assert.deepEqual(first.frames, second.frames);
  assert.equal(eventsOf(first, '수면').length, 1); assert.equal(first.events.filter((row) => row.kind === 'skill_cast').length, 0);
  const model = buildTeamObserverModel({ survivors: first.frames.at(-1).roster, teamId: 'victim', matchSec: 102, events: first.events });
  assert.ok(model.turningPoints.some((row) => /수면 부여/.test(row.text)));
  assert.ok(!first.events.some((row) => row.kind === 'sleep_break'));
});
await check('every authorable state survives save, reload and a real AI cast', async () => {
  for (const option of CHARACTER_STATUS_EFFECT_OPTIONS) {
    const clean = option.value === '해로운 효과 제거';
    const q = statusSkill([status(option.value, clean ? 0 : 2)], option.harmful ? {} : { type: 'support_skill', supportTargetScope: 'self' });
    const store = memoryStorage(); const saved = saveGuestCharacterProfile(profile(q), store);
    assert.equal(saved.ok, true, `${option.value}: ${saved.errors?.join(' ')}`);
    const result = await runCombatScenario([actor('caster', { characterSkills: readGuestCharacterProfiles(store).profiles[0].characterSkills,
      ...(clean ? { activeEffects: [effect('속박', 10)] } : {}) }), actor('victim')], { duration: 1.3 });
    const applied = eventsOf(result, option.value).filter((row) => row.outcome === 'applied');
    assert.equal(applied.length, 1, `${option.value} must actually be applied`);
    assert.equal(applied[0].who, option.harmful ? 'victim' : 'caster');
  }
});
await check('detailed editor compile survives profile roundtrip, real cast effects and deterministic replay', async () => {
  const statusEffect = status('수면', 2);
  const draft = createDefaultCompiledSkill({
    enabled: true, slot: 'q', type: 'attack_skill', name: '실험체 Q', damageType: 'true',
    resourceCost: 20, resourceGain: 5, targetPriority: 'lowest_hp', range: 4, radius: 1,
    statusEffects: [statusEffect], firstFlat: [40, 40, 40, 40, 40], flatDamage: [40, 40, 40, 40, 40],
    maxHpPct: [5, 5, 5, 5, 5], cooldownSec: 8.5, castDelaySec: 0.25, recoveryDelaySec: 0.25,
  }, 'q');
  const compiled = compileNaturalSkillDescription(
    '낮은 체력의 적에게 40/40/40/40/40 피해 및 대상 최대 체력의 5/5/5/5/5% 피해, 쿨타임 8.5초, 선딜 0.25초, 후딜 0.25초',
    draft, 'q'
  );
  assert.equal(compiled.ok, true, compiled.warnings?.join(' '));
  const edited = normalizeCharacterSkillForEditor({ q: compiled.skill }, 'q');
  const store = memoryStorage();
  const saved = saveGuestCharacterProfile({
    id: 'guest-survivor-01', name: '상세 실험체', characterSkills: { q: edited },
    uniqueResource: { enabled: true, name: '집중력', maxValue: 100, startValue: 40, regenPerSec: 0 },
  }, store);
  assert.equal(saved.ok, true, saved.errors?.join(' '));
  const loaded = readGuestCharacterProfiles(store);
  assert.equal(loaded.ok, true);
  const loadedSkill = loaded.profiles[0].characterSkills.q;
  for (const key of ['damageType', 'targetPriority', 'cooldownSec', 'castDelaySec', 'recoveryDelaySec',
    'resourceCost', 'resourceGain', 'range', 'radius', 'firstFlat', 'flatDamage', 'maxHpPct', 'statusEffects']) {
    assert.deepEqual(loadedSkill[key], edited[key], key);
  }
  assert.deepEqual(loaded.profiles[0].uniqueResource,
    { enabled: true, name: '집중력', maxValue: 100, startValue: 40, regenPerSec: 0 });

  const buildRows = () => applyGuestCharacterProfiles([
    actor('guest-survivor-01', { guestDefault: true, teamId: 'blue', _basicAttackReadyAtSec: 200 }),
    actor('victim', { teamId: 'red', hp: 500, maxHp: 500, stats: { maxHp: 500, attackPower: 1, defense: 0, attackSpeed: 1 }, _basicAttackReadyAtSec: 200 }),
  ], loaded.profiles);
  const first = await runCombatScenario(buildRows(), { duration: 1.3 });
  const second = await runCombatScenario(buildRows(), { duration: 1.3 });
  assert.deepEqual(first.events, second.events, 'reloaded skill must replay deterministically');
  assert.deepEqual(first.frames, second.frames, 'reloaded skill frames must replay deterministically');
  const cast = first.events.find((row) => row.kind === 'skill_cast' && row.who === 'guest-survivor-01');
  const impact = first.events.find((row) => row.kind === 'skill' && row.who === 'guest-survivor-01');
  const damage = first.events.find((row) => row.kind === 'damage' && row.who === 'guest-survivor-01' && row.castId);
  const sleep = first.events.find((row) => row.kind === 'effect' && row.effect === '수면' && row.who === 'victim');
  const resourceSpend = first.events.find((row) => row.kind === 'unique_resource' && row.phase === 'cast_start');
  assert.ok(cast && impact && damage && sleep && resourceSpend, 'the roundtripped skill must cast, damage, and apply its status');
  assert.equal(cast.targetId, 'victim');
  assert.equal(impact.targetId, 'victim');
  assert.equal(resourceSpend.delta, -20);
  assert.equal(impact.resourceGain, 5);
  assert.equal(impact.resourceAfter, 25);
  assert.equal(first.survivorMap.get('guest-survivor-01').skillState.q.cooldownUntil, 108.5);
  assert.equal(first.survivorMap.get('guest-survivor-01').uniqueResourceValue, 25);
});
console.log(`CHARACTER_STATUS_SKILL_CHECKS ${checks - failures}/${checks}`);
if (failures) process.exitCode = 1;
