import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { captureCombatHealth, recordCombatHealth, presentCombatHealth } = await import('../src/app/simulation/_lib/combatObservationRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { getTeamSurvivalStates, createTeamSurvivalObserver, describeTeamSurvival } = await import('../src/app/simulation/_lib/teamSurvivalObservationRuntime.js');
const { getMatchEndState } = await import('../src/app/simulation/_lib/matchEndRuntime.js');
const { createSimulationFeedbackSnapshot, getSimulationFeedbackPresentation, getSimulationFeedbackDisplay } = await import('../src/app/simulation/_lib/simulationFeedbackRuntime.js');
const { isSummaryLog, isKillLog } = await import('../src/app/simulation/_lib/logPresentation.js');

const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 100, maxHp: 100,
  _spatial: { zoneId: 'zone', x: 4, y: 4 }, inventory: [], tacticalSkill: 'none',
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 0.72 }, ...extra });
let checks = 0;
const check = (name, fn) => {
  withSimulationRandom(createSeedRng('combat-observation'), fn);
  checks++; console.log(`PASS ${name}`);
};
function strike(a = actor('a'), b = actor('b'), overrides = {}) {
  const events = []; const logs = [];
  resolveCombatWinnerOutcome({ state: { actor: a, target: b, currentActionSec: () => 100,
    pvpCfg: { criticalFleeHpBelow: 0 } }, ...overrides,
    actions: { addLog: (text, type) => logs.push({ text, type }),
      atNow: () => ({ sec: 100 }), emitRunEvent: (kind, data, at) => events.push({ kind, ...structuredClone(data), at }),
      ...overrides.actions } });
  return { a, b, events, logs };
}

check('a real hit records historical target HP before and after, not just damage', () => {
  const result = strike();
  const hit = result.events.find((event) => event.kind === 'damage');
  assert.equal(hit.hpBefore, 100); assert.equal(hit.hpAfter, 80);
  assert.equal(hit.maxHpBefore, 100); assert.equal(hit.maxHpAfter, 100);
  assert.match(result.logs[0].text, /HP 100\/100 → 80\/100/);
});

check('overkill, lifesteal and subsequent actor mutation do not fabricate historical HP', () => {
  const result = strike(actor('a', { hp: 30, stats: { attackPower: 200, lifesteal: 1 } }), actor('b', { hp: 7 }));
  const damage = result.events.find((event) => event.kind === 'damage');
  const battle = result.events.find((event) => event.kind === 'battle');
  assert.equal(damage.hpDamage, 7); assert.equal(damage.hpBefore, 7); assert.equal(damage.hpAfter, 0);
  assert.equal(battle.health.attacker.before.hp, 30); assert.equal(battle.health.attacker.after.hp, 37);
  assert.equal(battle.health.target.after.hp, 0); assert.equal(battle.lethal, true);
  result.a.hp = 99; result.b.hp = 65;
  assert.match(presentCombatHealth(battle).text, /a HP 30\/100 → 37\/100.*b HP 7\/100 → 0\/100/);
});

check('fully absorbed hits report unchanged HP and shield absorption separately', () => {
  const result = strike(actor('a'), actor('b'), { tactical: { shieldBlock: () => 0 } });
  const damage = result.events.find((event) => event.kind === 'damage');
  assert.equal(damage.hpDamage, 0); assert.equal(damage.absorbed, 20);
  assert.equal(damage.hpBefore, damage.hpAfter);
  assert.match(result.logs[0].text, /HP 100\/100 → 100\/100.*보호막 흡수 20/);
});

check('after-attack mastery or healing may change max HP without being mislabeled as damage', () => {
  const result = strike(actor('a'), actor('b'), { actions: { grantPvpDamageMastery: (row) => { row.hp += 5; row.maxHp += 10; } } });
  const battle = result.events.find((event) => event.kind === 'battle');
  assert.equal(battle.damage, 20);
  assert.match(presentCombatHealth(battle).text, /a HP 100\/100 → 105\/110.*b HP 100\/100 → 85\/110/);
  assert.equal(result.events.find((event) => event.kind === 'damage').hpAfter, 80);
});

check('each area target records its own actual HP and attacking lifesteal boundary', () => {
  const a = actor('a', { hp: 20, stats: { omnisyphon: 1 } }); const b = actor('b', { hp: 5 }); const c = actor('c');
  const events = []; const logs = [];
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([a, b, c].map((row) => [row._id, row])) },
    actions: { addLog: (text) => logs.push(text), emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  runtime.applyCharacterSkillSplashDamage(a, [b, c].map((target) => ({ target, damage: 20, packet: { type: 'skill', area: true }, skill: '광역 시험' })));
  const hits = events.filter((event) => event.kind === 'damage'); const battles = events.filter((event) => event.kind === 'battle');
  assert.deepEqual(hits.map((row) => [row.hpBefore, row.hpAfter, row.hpDamage]), [[5, 0, 5], [100, 80, 20]]);
  assert.equal(battles[1].health.attacker.before.hp, battles[0].health.attacker.after.hp);
  assert.equal(battles[0].damage, 5); assert.equal(battles[1].damage, 20);
  assert.match(logs.find((line) => line.includes('[b]')), /HP 5\/100 → 0\/100/);
});

check('a denied attack creates no fictional HP exchange', () => {
  const result = strike(actor('a', { hp: 0 }));
  assert.equal(result.events.length, 0);
});

check('legacy or malformed health evidence never borrows a current actor HP', () => {
  assert.equal(presentCombatHealth({ a: 'a', b: 'b' }), null);
  assert.equal(presentCombatHealth({ a: 'a', b: 'b', health: { version: 1 } }), null);
  const a = actor('a'), b = actor('b');
  const health = recordCombatHealth({ attacker: captureCombatHealth(a), target: captureCombatHealth(b) }, a, b);
  health.target.after.hp = NaN;
  assert.equal(presentCombatHealth({ a: 'a', b: 'b', health }), null);
  assert.doesNotMatch(describeObserverEvent({ kind: 'battle', a: 'a', b: 'b' }), /HP/);
});

check('the observer bounds recorded exchanges, excludes future and other-team data, and is read only', () => {
  const result = strike(); const battle = result.events.find((event) => event.kind === 'battle');
  const events = Array.from({ length: 20 }, (_, n) => ({ ...battle, at: { sec: n + 1 } }));
  events.push({ ...battle, a: 'unrelated', b: 'other', at: { sec: 20 } });
  const before = structuredClone(events);
  const model = buildTeamObserverModel({ survivors: [result.a, result.b], events, teamId: 'a', matchSec: 18 });
  assert.deepEqual(model.combat.map((row) => row.sec), [18, 17, 16]);
  assert.ok(model.combat.every((row) => row.participants.length === 2));
  assert.deepEqual(events, before);
});

const squad = (team = 'team:1', extra = {}) => [1, 2, 3].map((n) => actor(`${team}-${n}`, { teamId: team, ...extra }));
const policy = { canReviveThisMatch: true, phaseIdxNow: 1, wipeProtectionCutoffIdx: 2 };
check('the last death distinguishes protected wipe from final elimination using match-end policy', () => {
  const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 });
  const survivor = squad('team:2')[0];
  for (const p of [policy, { ...policy, phaseIdxNow: 3 }, { ...policy, canReviveThisMatch: false }]) {
    const rows = getTeamSurvivalStates({ survivors: [survivor], dead, ...p });
    const team = rows.find((row) => row.teamId === 'team:1');
    assert.equal(team.status === 'revival_pending', getMatchEndState({ survivors: [survivor], dead, ...p }).deferredForRevive);
  }
  assert.equal(getTeamSurvivalStates({ dead: squad('team:1', { hp: 0, deadAtPhaseIdx: 1, revivedOnce: true }), ...policy })[0].status, 'eliminated');
});

check('one living member prevents a wipe and an old corpse cannot hide a revived member', () => {
  const living = squad()[0]; const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 });
  const before = structuredClone({ living, dead });
  const team = getTeamSurvivalStates({ survivors: [living], dead, ...policy })[0];
  assert.equal(team.status, 'active'); assert.equal(team.aliveCount, 1); assert.equal(team.participants.length, 3);
  assert.deepEqual({ living, dead }, before);
});

check('rift defeat with positive HP is not a match death or team wipe', () => {
  const survivors = squad('team:1', { hp: 1, _dimensionRiftDefeated: true });
  assert.equal(getTeamSurvivalStates({ survivors, ...policy })[0].status, 'active');
});

check('simultaneous deaths emit one wipe, repeated frames do not re-emit, revival permits a later new wipe', () => {
  const events = []; const logs = [];
  const survivors = squad(); const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 });
  const observe = createTeamSurvivalObserver({ survivors, ...policy }, {
    emitRunEvent: (kind, row, at) => events.push({ kind, ...row, at }), addLog: (text, type) => logs.push({ text, type }) });
  observe({ survivors: [survivors[0]], dead: dead.slice(1), ...policy }, { sec: 1 });
  assert.equal(events.length, 0);
  for (let n = 0; n < 3; n++) observe({ survivors: [], dead, ...policy }, { sec: 2 + n });
  assert.equal(events.length, 1); assert.equal(events[0].status, 'revival_pending');
  observe({ survivors, dead: [], ...policy }, { sec: 5 });
  observe({ dead: dead.map((row) => ({ ...row, revivedOnce: true })), ...policy }, { sec: 6 });
  assert.deepEqual(events.map((row) => row.status), ['revival_pending', 'active', 'eliminated']);
  assert.ok(logs.every(isSummaryLog)); assert.ok(logs.every((row) => !isKillLog(row)));
});

check('phase reconstruction is silent for unchanged dead teams but protection expiry is a new event', () => {
  const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 }); const events = [];
  const initial = { dead, ...policy };
  createTeamSurvivalObserver(initial, { emitRunEvent: (_kind, row) => events.push(row) })(initial, { sec: 100 });
  assert.equal(events.length, 0);
  createTeamSurvivalObserver(initial, { emitRunEvent: (_kind, row) => events.push(row) })({ dead, ...policy, phaseIdxNow: 3 }, { sec: 110 });
  assert.equal(events[0].reason, 'protection_expired'); assert.match(describeTeamSurvival(events[0]), /최종 탈락.*전멸 보호 종료/);
});

check('team notices link exact participant IDs and are not lost when current event history is absent', () => {
  const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 });
  const state = getTeamSurvivalStates({ dead, ...policy })[0];
  const events = [{ kind: 'team_status', ...state, at: { sec: 100 } }];
  const model = buildTeamObserverModel({ dead, events, matchSec: 100 });
  assert.equal(model.turningPoints.length, 1); assert.match(model.turningPoints[0].text, /팀 전멸.*부활 대기/);
  const withoutHistory = buildTeamObserverModel({ dead, matchSec: 100, settings: {}, day: 1, phase: 'night' });
  assert.match(withoutHistory.status, /부활 대기/);
  const expired = buildTeamObserverModel({ dead, matchSec: 500, settings: {}, day: 3, phase: 'morning' });
  assert.match(expired.status, /최종 탈락/);
});

check('new team wipe has feedback priority over individual deaths without replacing final victory', () => {
  const snapshot = (extra) => createSimulationFeedbackSnapshot({ day: 1, phase: 'morning', dead: [], logs: [], ...extra });
  const previous = snapshot();
  const dead = squad('team:1', { hp: 0, deadAtPhaseIdx: 1 });
  const text = describeTeamSurvival(getTeamSurvivalStates({ dead, ...policy })[0]);
  const logs = [{ id: 'kill', type: 'death', text: '☠️ [a] 처치 (+1킬)' }, { id: 'team', type: 'highlight', text }];
  const current = snapshot({ dead, logs });
  assert.equal(getSimulationFeedbackPresentation(previous, current).key, 'teamRevivalPending');
  assert.equal(getSimulationFeedbackDisplay(current).key, 'teamRevivalPending');
  assert.equal(getSimulationFeedbackPresentation(current, current), null);
  const ended = snapshot({ dead, logs, isGameOver: true, winner: { name: '승리 팀' } });
  assert.equal(getSimulationFeedbackPresentation(previous, ended).key, 'victory');
});

check('account event compaction preserves bounded historical health and team state but rejects extra nested data', () => {
  const source = readFileSync(new URL('../../server/routes/game.js', import.meta.url), 'utf8');
  const compactSource = source.slice(source.indexOf('function compactRunEventsForStorage('), source.indexOf('function buildRunSummary('));
  const compact = runInNewContext(`${compactSource}; compactRunEventsForStorage`);
  const battle = strike().events.find((row) => row.kind === 'battle');
  battle.health.extra = { private: 'must not be stored' };
  const pending = getTeamSurvivalStates({ dead: squad('team:1', { hp: 0, deadAtPhaseIdx: 1 }), ...policy })[0];
  const rows = JSON.parse(JSON.stringify(compact([battle, { kind: 'team_status', ...pending, at: { sec: 123.25, day: 1, phase: 'night' } }])));
  assert.ok(presentCombatHealth(rows[0])); assert.equal(rows[0].health.extra, undefined);
  assert.deepEqual(rows[1].participants, pending.participants); assert.equal(rows[1].status, 'revival_pending');
  assert.equal(rows[1].at.sec, 123.25);
  battle.health.target.after.hp = Infinity;
  assert.equal(compact([battle])[0].health, undefined);
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  for (const field of ['health', 'hpBefore', 'maxHpAfter', 'participants', 'protectedCount', 'status']) assert.ok(finish.includes(`'${field}'`));
  assert.match(finish, /sec: event.at.sec/);
});

console.log(`COMBAT_OBSERVATION_CHECKS ${checks}/${checks}`);
