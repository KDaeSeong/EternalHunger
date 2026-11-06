import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { getCombatSpaceId, shareCombatSpace } = await import('../src/utils/combatSpaceLogic.js');
const { createMapActionRuntime } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { buildStarterLoadoutSurvivorsForPhase } = await import('../src/app/simulation/_lib/phaseSpawnRuntime.js');
const { normalizeRuntimeSurvivorList, normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/simulationEngine.js');
const { spatialDistance, canObserveActor } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { engageCombatParticipants, getCombatIntentOpponents } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { applyPreparedCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { getCharacterCastInvalidReason, reconcileCharacterCasts } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { recordCombatContribution, commitRetreatCover } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { buildTeamCoordination } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const clone = value => structuredClone(value);
const row = (id, teamId, extra = {}) => ({ _id: id, name: id, mapId: 'main', teamId, teamName: teamId,
  zoneId: 'zone', _spatial: { zoneId: 'zone', x: 4, y: 4 }, hp: 1000, maxHp: 1000,
  stats: { maxHp: 1000, attackPower: 20, defense: 10, attackRange: 5, sightRange: 24, moveSpeed: 3.5, attackSpeed: 1 },
  inventory: [], activeEffects: [], power: 100, tacticalSkill: 'none', _tacNextAbsSec: 9999, ...extra });
const fresh = () => [row('a', 'a'), row('buddy', 'a'), row('enemy', 'b', { hp: 400 }), row('other', 'b')];
function jump(rows, id) {
  const events = [], originalMaps = Object.fromEntries(rows.map(actor => [actor._id, actor.mapId]));
  createMapActionRuntime({ state: { activeMapId: 'main', activeMapName: 'main', day: 3,
    hyperloopPadZoneId: 'zone', survivors: rows, maps: [{ _id: 'remote', name: 'remote', zones: [{ zoneId: 'zone' }] }] },
    actions: { setSurvivors: update => { rows = update(rows); }, emitRunEvent: (kind, payload) => events.push({ kind, ...clone(payload) }) },
  }).doHyperloopJump('remote', id);
  assert.equal(rows.find(actor => actor._id === id).mapId, 'remote');
  for (const actor of rows.filter(actor => actor._id !== id)) assert.equal(actor.mapId, originalMaps[actor._id]);
  assert.equal(events[0].kind, 'hyperloop'); assert.equal(events[0].whoId, id);
  return rows;
}
function exchange(rows) {
  rows = normalizeRuntimeSurvivorList(buildStarterLoadoutSurvivorsForPhase({
    state: { nextDay: 3, nextPhase: 'morning', survivors: rows, publicItems: [] },
  }));
  const initial = clone(rows), events = [], map = new Map(rows.map(actor => [actor._id, actor]));
  const source = getRuleset('ER_S11'), ruleset = { ...source, ai: { ...source.ai, escapeHpBelow: 0 },
    pvp: { ...source.pvp, criticalFleeHpBelow: 0, earlyLethalFinishMax: 0, postBattleMoveChance: 0, restHealMax: 0 } };
  const original = Math.random; Math.random = () => 0;
  try {
    const result = runPhaseCombatEncounter({ state: { actor: map.get('a'), target: map.get('enemy'), survivorMap: map,
      newDeadIds: [], roundKills: {}, roundAssists: {}, phaseSurvivors: rows, todaysSurvivors: [...rows],
      currentActionSec: () => 100, phaseIdxNow: 4, nextDay: 3, estimatePower: actor => actor.power,
      ruleset, publicItems: [], craftables: [] }, actions: {
      atNow: () => ({ day: 3, phase: 'morning', sec: 100 }), emitRunEvent: (kind, payload, at) => events.push({ ...clone(payload), kind, at }),
    } });
    return { initial, events, map, result };
  } finally { Math.random = original; }
}
let checks = 0; const failures = [];
function check(name, run) { try { run(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack || error).slice(0, 1500) }); console.error('FAIL ' + name + ': ' + error.message); } }

check('map equality follows survivor string normalization while preserving world and rift IDs', () => {
  const a = row('a', 'a'), b = row('b', 'b');
  assert.equal(getCombatSpaceId(a), 'world'); assert.equal(shareCombatSpace(a, b), true);
  b.mapId = 'remote'; assert.equal(shareCombatSpace(a, b), false);
  b.mapId = 'main'; b._combatSpaceId = 'dimension_rift:r';
  assert.equal(getCombatSpaceId(b), 'dimension_rift:r'); assert.equal(shareCombatSpace(a, b), false);
  a._combatSpaceId = 'dimension_rift:r'; assert.equal(shareCombatSpace(a, b), true);
  b.mapId = 'remote'; assert.equal(shareCombatSpace(a, b), false);
  for (const value of [undefined, null, '', 0, false, 'main', ' main ', 7]) {
    const first = row('first', 'a', { mapId: value }), normalized = normalizeRuntimeSurvivor(first);
    assert.equal(shareCombatSpace(first, { ...row('second', 'b'), mapId: normalized.mapId }), true);
    assert.equal(shareCombatSpace(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(normalized))), true);
  }
});

check('both unknown maps retain legacy combat but one unknown map is never a wildcard', () => {
  const legacy = fresh(); for (const actor of legacy) delete actor.mapId;
  assert.ok(exchange(legacy).events.some(event => event.kind === 'damage' && event.hpDamage > 0));
  for (const value of [undefined, null, '']) {
    const rows = fresh(); rows[2].mapId = value;
    const result = exchange(rows); assert.equal(result.events.filter(event => event.kind === 'damage').length, 0);
    assert.equal(result.map.get('enemy').hp, 400);
    assert.equal(shareCombatSpace(rows[0], rows[2]), false);
    assert.equal(shareCombatSpace(rows[2], rows[0]), false);
  }
});

check('official cross-map transport survives phase roster helpers but cannot damage the old map', () => {
  const result = exchange(jump(fresh(), 'enemy'));
  assert.equal(result.initial.find(actor => actor._id === 'enemy').mapId, 'remote');
  assert.equal(result.initial.find(actor => actor._id === 'a').mapId, 'main');
  assert.equal(result.events.filter(event => event.kind === 'damage').length, 0);
  assert.equal(result.map.get('enemy').hp, 400); assert.equal(result.map.get('a').hp, 1000);
});

check('remote allies cannot join the local round or contribute hits or retreat cover', () => {
  const result = exchange(jump(fresh(), 'buddy'));
  const engagement = result.events.find(event => event.kind === 'team_engagement'); assert.ok(engagement);
  assert.equal(engagement.teams.flat().includes('buddy'), false);
  assert.equal(result.events.some(event => event.kind === 'damage' && event.who === 'buddy'), false);
  assert.ok(result.events.some(event => event.kind === 'damage' && event.who === 'a' && event.hpDamage > 0));
  const helper = result.map.get('buddy'), flee = row('flee', 'a'), chaser = row('chaser', 'b');
  assert.deepEqual(commitRetreatCover(flee, chaser, [flee, chaser, helper], { nowSec: 100, estimatePower: () => 100 }), { helpers: [], bonus: 0 });
});

check('foreign-map opponents cannot enter spatial vision or current combat-intent target lists', () => {
  const a = row('a', 'a'), enemy = row('enemy', 'b'), remote = row('remote', 'b', { mapId: 'remote' });
  engageCombatParticipants(a, enemy, [a, enemy, remote], 100);
  assert.equal(spatialDistance(a, remote), Infinity); assert.equal(canObserveActor(a, remote, [a, enemy, remote]), false);
  assert.deepEqual(getCombatIntentOpponents(a, [a, enemy, remote], 100).map(actor => actor._id), ['enemy']);
  const before = clone(remote); const impact = applyCombatHit(a, remote, { type: 'skill', damage: 50 }, {
    shieldBlock: () => { throw new Error('Foreign map must not consume shields'); },
  });
  assert.equal(impact.hpDamage, 0); assert.equal(impact.blockedReason, 'combat_space'); assert.deepEqual(remote, before);
});

check('cached area recipients reread the transported actor and leave foreign-map HP unchanged', () => {
  const a = row('a', 'a'), local = row('local', 'b'), remote = row('remote', 'b', { mapId: 'remote' });
  const stale = { ...clone(remote), mapId: 'main' }, events = [];
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([a, local, remote].map(actor => [actor._id, actor])) },
    actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } });
  assert.deepEqual(runtime.getCharacterSkillSplashTargets(a, local), []);
  assert.equal(runtime.applyCharacterSkillSplashDamage(a, [{ target: stale, damage: 50, packet: { type: 'skill', damage: 50 } }]), 0);
  assert.equal(remote.hp, 1000); assert.equal(events.length, 0);
  assert.equal(runtime.applyCharacterSkillSplashDamage(a, [{ target: local, damage: 50, packet: { type: 'skill', damage: 50 } }]), 50);
  assert.equal(local.hp, 950);
});

check('prepared healing and shielding preserve same-map support without helping a foreign ally', () => {
  const a = row('a', 'a');
  for (const mapId of ['main', 'remote']) for (const type of ['heal_skill', 'shield_skill']) {
    const ally = row('ally', 'a', { mapId, hp: 10 });
    const prepared = { def: { name: type, slot: 'q', type, heal: [50], shield: [50], range: 30 },
      level: 1, stage: 1, decision: { supportTarget: true }, zoneId: 'zone', combatSpaceId: 'world', targetId: 'ally',
      castId: 'a:1', startedAtSec: 100, releaseAtSec: 102, recoveryUntilSec: 102 };
    const result = applyPreparedCharacterSkill(a, ally, prepared, { nowSec: 102, settings: { characterSkillsEnabled: true }, visionRoster: [a, ally] });
    if (mapId === 'remote') { assert.equal(result, null); assert.equal(ally.hp, 10); assert.deepEqual(ally.activeEffects, []); }
    else { assert.ok(result); assert.ok(ally.hp > 10 || ally.activeEffects.length > 0); }
  }
});

check('cross-map contribution ledgers and pending enemy casts cannot reuse prior local presence', () => {
  const a = row('a', 'a'), enemy = row('enemy', 'b');
  recordCombatContribution(enemy, a, 10, 4, 100); assert.equal(enemy._combatContributions.a.damage, 10);
  enemy.mapId = 'remote'; const ledger = clone(enemy._combatContributions);
  recordCombatContribution(enemy, a, 20, 4, 101); assert.deepEqual(enemy._combatContributions, ledger);
  a._pendingCharacterCast = { def: { name: 'Q', slot: 'q', type: 'attack_skill' }, level: 1,
    decision: { supportTarget: false }, zoneId: 'zone', combatSpaceId: 'world', targetId: 'enemy', castId: 'a:1',
    startedAtSec: 100, releaseAtSec: 102, recoveryUntilSec: 102, previousActionReadyAtSec: 0 };
  a.skillState = { q: { cooldownUntil: 110, stage: 'casting' } };
  assert.equal(getCharacterCastInvalidReason(a, a._pendingCharacterCast, [a, enemy], { characterSkillsEnabled: true }), 'combat_space');
  reconcileCharacterCasts([a, enemy], 101, { characterSkillsEnabled: true });
  assert.equal(a._pendingCharacterCast, null); assert.equal(a.skillState.q.cooldownUntil, 110);
});

check('coordination isolates transported or unknown-map members without changing one-map plans or order', () => {
  const coordinate = roster => {
    const result = buildTeamCoordination({ roster, day: 3, zoneGraph: { zone: ['safe'], safe: ['zone'] },
      chooseLeaderMove: () => ({ targets: ['zone'], reason: 'controlled_current_destination' }) });
    return { decisions: [...result.regroupDecisions], plans: [...result.movementPlans] };
  };
  const rows = fresh().slice(0, 2), local = coordinate(rows);
  assert.equal(local.decisions.length, 2);
  for (const [, decision] of local.decisions) { assert.equal(decision.memberCount, 2); assert.equal(decision.atTargetCount, 2); }
  const legacy = clone(rows); legacy.forEach(actor => { delete actor.mapId; });
  assert.deepEqual(coordinate(legacy), local, 'Single-map and legacy plans, values and iteration order must remain equal.');
  assert.deepEqual(coordinate(jump(clone(rows), 'buddy')), { decisions: [], plans: [] });
  const unknown = clone(rows); delete unknown[1].mapId;
  assert.deepEqual(coordinate(unknown), { decisions: [], plans: [] });
  const otherSpace = clone(rows); otherSpace[1]._combatSpaceId = 'dimension_rift:r';
  assert.deepEqual(coordinate(otherSpace), { decisions: [], plans: [] });
  const collision = [row('one', 'x', { mapId: 'map:world' }), row('two', 'world:x', { mapId: 'map' })];
  assert.deepEqual(coordinate(collision), { decisions: [], plans: [] }, 'Map/space/team tuples cannot collide through delimiters.');
});

console.log(JSON.stringify({ checks, pass: failures.length === 0, failures,
  scope: 'Current production module map-isolation regression. No full match, seed search, historic expected output or browser acceptance.' }));
if (failures.length) process.exitCode = 1;
