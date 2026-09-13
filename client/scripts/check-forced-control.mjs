import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const status = await import('../src/utils/statusLogic.js');
const spatial = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { applyStatusEffect, applyRuntimeEffectPayloads } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { actor, effect, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { pickTeamFocusTarget, commitRetreatCover } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { reconcileForcedControls } = await import('../src/app/simulation/_lib/forcedControlRuntime.js');
const { normalizeDeadSnapshot, normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { emitEffectRunEvents } = await import('../src/app/simulation/_lib/runEventRuntime.js');
let checks = 0;
const check = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
const point = (x, y = 4) => ({ zoneId: 'zone', x, y });
const unit = (id, x, extra = {}) => actor(id, { _spatial: point(x),
  stats: { maxHp: 1000, attackPower: 1, attackSpeed: 1, attackRange: 1, sightRange: 24, moveSpeed: 3.5 }, ...extra });
const control = (name, seconds, sourceActorId = 'b') => effect(name, seconds, { sourceActorId, sourcePosition: point(16) });

await check('a fractional phase advances the same elapsed time as its combat clock exactly once', () => {
  let elapsed = 0; const growth = [];
  const timeline = createPhaseActionTimeline({ durationSec: 1.5, onGrowth: (sec) => growth.push(sec),
    onElapsed: (_, seconds) => { elapsed += seconds; } });
  for (const sec of [0, 0.25, 1, 1.5, 1.5, 10, 0]) timeline.advanceTo(sec);
  assert.equal(elapsed, 1.5);
  assert.deepEqual(growth, [0]);
});

await check('forced behavior blocks voluntary actions and skills, while root also blocks forced walking', () => {
  for (const name of ['공포', '매혹', '도발']) {
    const a = unit('a', 8, { activeEffects: [control(name, 3)] });
    assert.equal(status.canUseSkillByStatus(a), false, name);
    assert.equal(status.canMoveByStatus(a), false, 'Autonomous travel must not override control.');
    assert.equal(status.canMoveByStatus(a, { forced: true }), true, name);
    assert.equal(status.canBasicAttackByStatus(a), name === '도발');
    a.activeEffects.push(effect('속박', 1));
    assert.equal(status.canMoveByStatus(a, { forced: true }), false);
  }
});

await check('fear moves away in actual combat time without needing a pre-existing engagement', async () => {
  const result = await runCombatScenario([unit('a', 8, { activeEffects: [control('공포', 3)] }),
    unit('b', 16, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })], { duration: 1, engage: false });
  assert.equal(result.frames.at(-1).roster[0]._spatial.x, 4.5);
  assert.deepEqual(result.times('a'), []);
  assert.equal(result.events.some((row) => row.kind === 'forced_control' && row.who === 'a' && row.mode === 'fear'), true);
});

await check('charm walks toward its caster at movement speed without attacking or teleporting', async () => {
  const result = await runCombatScenario([unit('a', 8, { activeEffects: [control('매혹', 3)] }),
    unit('b', 16, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })], { duration: 1.5, engage: false });
  assert.equal(result.frames.at(-1).roster[0]._spatial.x, 13.25);
  assert.deepEqual(result.times('a'), []);
});

await check('root prevents fear walking only until its fractional expiry', async () => {
  const result = await runCombatScenario([unit('a', 8, { activeEffects: [control('공포', 3), effect('속박', 0.5)] }),
    unit('b', 16, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })], { duration: 1, engage: false });
  assert.equal(result.frames.at(-1).roster[0]._spatial.x, 6.25);
});

await check('taunt attacks its caster instead of the previous enemy or low-health focus', async () => {
  const a = unit('a', 4, { activeEffects: [control('도발', 3, 'c')] });
  const b = unit('b', 4.5, { hp: 1, _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 });
  const c = unit('c', 4.75, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 });
  const result = await runCombatScenario([a, b, c], { duration: 1.25 });
  const hits = result.events.filter((row) => row.kind === 'damage' && row.who === 'a');
  assert.ok(hits.length > 0);
  assert.ok(hits.every((row) => row.targetId === 'c' && row.type === 'basic'));
});

await check('taunt pays walking time to basic range and root does not suppress in-range basics', async () => {
  const moving = await runCombatScenario([unit('a', 4, { activeEffects: [control('도발', 4)] }),
    unit('b', 12, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })], { duration: 2.5, engage: false });
  assert.equal(moving.times('a')[0], 102);
  const rooted = await runCombatScenario([unit('a', 4, { activeEffects: [control('도발', 3), effect('속박', 3)] }),
    unit('b', 4.5, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })], { duration: 1.25 });
  assert.deepEqual(rooted.times('a'), [100, 101]);
  assert.equal(rooted.frames.at(-1).roster[0]._spatial.x, 4);
});

await check('an absent, dead or other-region taunter cannot redirect basics to an unrelated enemy', async () => {
  for (const extra of [{ hp: 0 }, { zoneId: 'elsewhere' }]) {
    const result = await runCombatScenario([unit('a', 4, { activeEffects: [control('도발', 3, 'c')] }),
      unit('b', 4.5, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 }), unit('c', 4.75, extra)], { duration: 1.25 });
    assert.deepEqual(result.times('a'), []);
  }
});

await check('team focus and voluntary cover cannot override a controlled actor', () => {
  const a = unit('a', 4, { teamId: 'ally', activeEffects: [control('도발', 3, 'c')] });
  const flee = unit('flee', 4, { teamId: 'ally' });
  const b = unit('b', 4.5); const c = unit('c', 4.75);
  assert.equal(pickTeamFocusTarget(a, [b, c], 'b', [a, b, c])._id, 'c');
  assert.deepEqual(commitRetreatCover(flee, b, [a, flee, b, c], { nowSec: 100 }).helpers, []);
});

await check('forced control prevents actual growth actions even inside a forbidden region', () => {
  const a = unit('a', 8, { activeEffects: [control('매혹', 3)] });
  const events = [];
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: [a], actionIntervalSec: 20,
    currentActionSec: () => 100, forbiddenIds: new Set(['zone']), publicItems: [], ruleset: {} },
    actions: { emitRunEvent: (kind) => events.push(kind) } });
  assert.deepEqual(result.updatedSurvivors[0], a);
  assert.deepEqual(events, []);
});

await check('application captures caster identity separately from skill source and refresh order survives JSON', () => {
  const a = unit('a', 8); const b = unit('b', 16); const c = unit('c', 4);
  applyStatusEffect(a, effect('공포', 4, { sourceId: 'skill-q' }), { sourceActor: b });
  assert.equal(status.getForcedControlEffect(a).sourceActorId, 'b');
  assert.deepEqual(status.getForcedControlEffect(a).sourcePosition, { ...point(16), combatSpaceId: 'world' });
  applyStatusEffect(a, effect('매혹', 4), { sourceActor: c });
  assert.equal(status.getForcedControlEffect(a).name, '매혹');
  applyStatusEffect(a, effect('공포', 4), { sourceActor: b });
  const reloaded = JSON.parse(JSON.stringify(a));
  assert.equal(status.getForcedControlEffect(reloaded).name, '공포');
  b._spatial.x = 22;
  assert.equal(status.getForcedControlEffect(reloaded).sourcePosition.x, 16);
});

await check('immunity, unstoppable suppression and cleanse affect forced behavior instead of just its badge', () => {
  const a = unit('a', 8, { activeEffects: [effect('모든 방해 면역', 1)] });
  assert.equal(applyStatusEffect(a, control('공포', 3)).reason, 'immune');
  assert.equal(status.getForcedControlEffect(a), null);
  const b = unit('b', 8, { activeEffects: [effect('저지 불가', 1), control('매혹', 3)] });
  assert.equal(status.getForcedControlEffect(b), null);
  const later = status.updateEffects(b, { elapsedSec: 1 });
  assert.equal(status.getForcedControlEffect(later).remainingDuration, 2);
  applyStatusEffect(later, effect('해로운 효과 제거', 0));
  assert.equal(status.getForcedControlEffect(later), null);
});

await check('new charm cancels an actual pending cast before release and remains reproducible after JSON', async () => {
  const rows = [unit('a', 4, { characterSkills: { q: skill({ castDelaySec: 2, range: 10 }) } }),
    unit('b', 5, { _basicAttackReadyAtSec: 1e9, _actionReadyAtSec: 1e9 })];
  const options = { duration: 2.5, onElapsed: (roster, elapsed) => {
    if (elapsed === 1) applyStatusEffect(roster.get('a'), effect('매혹', 2), { sourceActor: roster.get('b') });
  } };
  const first = await runCombatScenario(structuredClone(rows), options);
  const second = await runCombatScenario(JSON.parse(JSON.stringify(rows)), options);
  assert.equal(first.events.some((row) => row.kind === 'skill_cancel' && row.who === 'a' && row.at.sec === 101), true);
  assert.equal(first.events.some((row) => row.kind === 'damage' && row.who === 'a' && row.type === 'skill'), false);
  assert.deepEqual(second.events, first.events);
  assert.deepEqual(second.frames, first.frames);
});

await check('batched and split movement respect protected and rooted control boundaries identically', () => {
  const initial = [unit('a', 8, { activeEffects: [effect('저지 불가', 0.375), control('공포', 2), effect('속박', 0.875)] }), unit('b', 16)];
  const full = structuredClone(initial); spatial.advanceSpatialMovement(full, 100, 1.75);
  let split = structuredClone(initial);
  for (let i = 0; i < 7; i++) {
    spatial.advanceSpatialMovement(split, 100 + i * 0.25, 0.25);
    split = split.map((row) => status.updateEffects(row, { elapsedSec: 0.25 }));
  }
  assert.deepEqual(full.map((row) => row._spatial), split.map((row) => row._spatial));
  assert.equal(full[0]._spatial.x, 4.9375);
});

await check('latest taunt overrides older fear for basics, then remaining fear resumes after taunt expires', async () => {
  const a = unit('a', 8); const b = unit('b', 16, { _actionReadyAtSec: 1e9 });
  const c = unit('c', 8.5, { _actionReadyAtSec: 1e9 });
  applyStatusEffect(a, effect('공포', 4), { sourceActor: b });
  applyStatusEffect(a, effect('도발', 1.5), { sourceActor: c });
  assert.equal(status.canBasicAttackByStatus(a, c), true);
  const result = await runCombatScenario([a, b, c], { duration: 2, engage: false });
  assert.deepEqual(result.times('a'), [100, 101]);
  assert.ok(result.events.filter((row) => row.kind === 'damage' && row.who === 'a').every((row) => row.targetId === 'c'));
  assert.equal(result.frames.at(-1).roster[0]._spatial.x, 6.25);
  a.activeEffects.push(effect('기절', 1));
  assert.equal(status.canBasicAttackByStatus(a, c), false, 'Latest taunt must not override a hard action block.');
  a.activeEffects = [control('도발', 4, 'c'), effect('공격 불가 검사', 1, { tags: ['basic_block'] })];
  assert.equal(status.canBasicAttackByStatus(a, c), false, 'Unrelated basic blockers still apply.');
});

await check('fear keeps the exact opposite direction and stops at the region boundary', () => {
  const a = unit('a', 4, { _spatial: point(4, 8) }); const b = unit('b', 8, { _spatial: point(8, 10) });
  applyStatusEffect(a, effect('공포', 20), { sourceActor: b });
  spatial.advanceSpatialMovement([a, b], 100, 0.25);
  assert.deepEqual(a._spatial, point(3.217376, 7.608688));
  spatial.advanceSpatialMovement([a, b], 100.25, 10);
  assert.ok(Math.abs(a._spatial.x) < 1e-5 && Math.abs(a._spatial.y - 6) < 1e-5);
});

await check('control tracks observed caster positions, freezes the last observation and never guesses skill IDs', () => {
  const a = unit('a', 4, { stats: { sightRange: 3 } }); const b = unit('b', 6);
  applyStatusEffect(a, effect('매혹', 4, { sourceId: 'skill-q' }), { sourceActor: b });
  reconcileForcedControls([a, b], 100);
  b._spatial.x = 7; reconcileForcedControls([a, b], 100.25);
  b._spatial.x = 20;
  assert.equal(spatial.getForcedControlMotion(a, [a, b]).source, null);
  assert.equal(spatial.getForcedControlMotion(a, [a, b]).sourcePosition.x, 7);
  const reloaded = JSON.parse(JSON.stringify(a));
  b.hp = 0;
  assert.equal(spatial.getForcedControlMotion(reloaded, [reloaded, b]).sourcePosition.x, 7);
  reloaded.zoneId = 'other'; spatial.syncSpatialPositions([reloaded]);
  assert.equal(spatial.getForcedControlMotion(reloaded, [reloaded, b]).sourcePosition, null);
  const noSource = unit('no-source', 4, { activeEffects: [effect('도발', 3, { sourceId: 'b' })] });
  assert.equal(spatial.getForcedControlMotion(noSource, [noSource, b]).source, null);
  assert.equal(spatial.getForcedControlMotion(noSource, [noSource, b]).motion, null);
});

await check('missing, friendly and untargetable taunt sources never authorize unrelated or friendly hits', async () => {
  for (const sourceKind of ['missing', 'friendly', 'untargetable']) {
    const a = unit('a', 4, { activeEffects: [control('도발', 3, 'c')] });
    const b = unit('b', 4.25, { _actionReadyAtSec: 1e9 });
    const c = unit('c', 4.5, { _actionReadyAtSec: 1e9,
      ...(sourceKind === 'friendly' ? { teamId: 'a' } : {}),
      ...(sourceKind === 'untargetable' ? { activeEffects: [effect('대상 지정 불가', 3)] } : {}) });
    const result = await runCombatScenario(sourceKind === 'missing' ? [a, b] : [a, b, c], { duration: 2 });
    assert.deepEqual(result.times('a'), [], sourceKind);
  }
});

await check('moving-caster integration is simultaneous and preserves roster-order and JSON independence', () => {
  const a = unit('a', 4); const b = unit('b', 8, {
    _spatialMotion: { ...point(8, 16), stopRange: 0, reason: 'patrol' } });
  applyStatusEffect(a, effect('매혹', 4), { sourceActor: b });
  const original = [a, b]; reconcileForcedControls(original, 100);
  const split = JSON.parse(JSON.stringify(original)); const reversed = structuredClone(original).reverse();
  spatial.advanceSpatialMovement(original, 100, 1);
  spatial.advanceSpatialMovement(reversed, 100, 1);
  for (let i = 0; i < 4; i++) spatial.advanceSpatialMovement(split, 100 + i * 0.25, 0.25);
  assert.deepEqual(original.map((row) => row._spatial), reversed.reverse().map((row) => row._spatial));
  assert.deepEqual(original.map((row) => row._spatial), split.map((row) => row._spatial));
  assert.ok(original[0]._spatial.y > 4);
});

await check('death and revival clear forced-controller runtime memory', () => {
  const a = unit('a', 8, { activeEffects: [control('공포', 3)] }); const b = unit('b', 16);
  reconcileForcedControls([a, b], 100);
  assert.ok(a._forcedControlState);
  const dead = normalizeDeadSnapshot(a, {});
  assert.equal(dead._forcedControlState, null);
  const revived = normalizeRevivedSurvivor(a, 100, 'zone', 1, {}, 110);
  assert.equal(revived._forcedControlState, null);
  assert.equal(status.getForcedControlEffect(revived), null);
  assert.ok(a._forcedControlState, 'Lifecycle cleanup cannot mutate the previous live snapshot.');
});

await check('effect bundles and events preserve caster identity independently of skill identity', () => {
  const a = unit('a', 8); const b = unit('b', 16);
  const applied = applyRuntimeEffectPayloads(a, [effect('매혹', 2, { sourceId: 'skill-q' })], { sourceActor: b });
  assert.equal(status.getForcedControlEffect(a).sourceActorId, 'b');
  const events = [];
  emitEffectRunEvents((kind, data) => events.push({ kind, ...data }), a, applied.results, { skill: 'Q' });
  assert.equal(events[0].sourceActorId, 'b');
  assert.equal(events[0].sourceId, 'skill-q');
});

await check('observer explains forced movement and taunted strikes without changing game state', () => {
  const a = unit('a', 8, { name: '대상', activeEffects: [control('매혹', 3)] }); const b = unit('b', 16, { name: '시전자' });
  const events = [];
  const actions = { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }) };
  reconcileForcedControls([a, b], 100, actions); reconcileForcedControls([a, b], 100.25, actions);
  assert.equal(events.length, 1, 'Unchanged control does not flood transition events.');
  const before = JSON.stringify([a, b, events]);
  const view = buildTeamObserverModel({ survivors: [a, b], events, matchSec: 100.25 });
  assert.match(view.members[0].motion, /매혹.*시전자/);
  assert.match(view.recent[0]?.text || '', /매혹.*시전자/);
  assert.match(describeObserverEvent({ kind: 'team_strike', who: 'a', targetId: 'b', reason: 'taunted_target' }), /도발/);
  assert.equal(JSON.stringify([a, b, events]), before);
  const taunted = unit('a', 8, { activeEffects: [control('도발', 3)] });
  const nearby = unit('b', 8.5);
  const tauntView = buildTeamObserverModel({ survivors: [taunted, nearby], matchSec: 101.25 });
  assert.match(tauntView.members[0].motion, /사거리 안.*기본 공격 대기/);
  assert.doesNotMatch(tauntView.members[0].motion, /접근/);
  a.activeEffects = []; reconcileForcedControls([a, b], 103, actions);
  assert.match(describeObserverEvent(events.at(-1)), /매혹.*종료/);
});

console.log(`FORCED_CONTROL_CHECKS ${checks}/${checks}`);
