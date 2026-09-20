import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createPhaseCombatEliminationRuntime } = await import('../src/app/simulation/_lib/phaseCombatEliminationRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const ruleset = getRuleset('ER_S11');
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'safe', hp: 100, maxHp: 100,
  inventory: [], detonationSec: 20, detonationMaxSec: 30, gadgetEnergy: 0, ...extra });
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
function elimination(winner, override = ruleset) {
  const events = [], logs = [];
  const runtime = createPhaseCombatEliminationRuntime({ state: { ruleset: override, useDetonation: true,
    craftables: [], publicItems: [], itemNameById: {}, itemMetaById: {}, nextDay: 6, phaseIdxNow: 13 },
    actions: { addLog: (text) => logs.push(text), emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  return { events, logs, kill: (id) => runtime.applyCombatElimination(winner, actor(id), { deferAftermath: true }) };
}
check('ordinary kills restore remaining time but never expand the personal 30-second cap', () => {
  const winner = actor('winner', { detonationSec: 29 });
  const runtime = elimination(winner);
  runtime.kill('first');
  assert.equal(winner.detonationMaxSec, 30);
  assert.equal(winner.detonationSec, 30);
  runtime.kill('second');
  assert.equal(winner.detonationMaxSec, 30);
  assert.equal(winner.detonationSec, 30);
});

const { applyFinalNightDetonationBonus, normalizeDetonationTimer, resetDetonationTimer, restoreDetonationTime } =
  await import('../src/app/simulation/_lib/detonationTimerRuntime.js');
const { normalizeRuntimeSurvivorList } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { runActorPostActionPhase } = await import('../src/app/simulation/_lib/phaseActorPostActionRuntime.js');
const { runSimulationPhaseSetup } = await import('../src/app/simulation/_lib/simulationPhaseSetupRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
function grant(actors, options = {}) {
  const events = [], logs = [];
  const ledger = applyFinalNightDetonationBonus({ actors, ruleset, day: 6, phase: 'night', atSec: 1180,
    actions: { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }), addLog: (text) => logs.push(text) }, ...options });
  return { ledger, events, logs };
}
function tick(rows, { forbidden = false, duration = 1, ...extra } = {}) {
  return runDetonationTickPhase({ state: { updatedSurvivors: rows, ruleset, useDetonation: true,
    phaseDurationSec: duration, forbiddenIds: new Set(forbidden ? ['safe'] : []), ...extra } });
}
for (const [remaining, expected] of [[30, 45], [8, 23], [0, 15], [7.25, 22.25]]) {
  check(`final-night entry adds exactly 15 seconds to ${remaining}, not a reset to 45`, () => {
    const row = actor('one', { detonationSec: remaining });
    const before = structuredClone(row), result = grant([row]);
    assert.equal(row.detonationSec, expected); assert.equal(row.detonationMaxSec, 45);
    assert.equal(row.hp, before.hp); assert.equal(row.zoneId, before.zoneId);
    assert.deepEqual(row.inventory, before.inventory);
    assert.equal(result.events.length, 1); assert.equal(result.events[0].beforeSec, remaining);
    assert.equal(result.events[0].afterSec, expected); assert.equal(result.events[0].at.sec, 1180);
    assert.match(result.logs[0], /마지막 밤/);
    assert.equal(row.detonationFinalNightBonusAtSec, 1180);
  });
}
check('all living individuals receive their own remaining-time addition; dead actors stay untouched', () => {
  const rows = [actor('one', { teamId: 'same', detonationSec: 30 }), actor('two', { teamId: 'same', detonationSec: 8 }),
    actor('three', { detonationSec: 3 }), Object.freeze(actor('dead', { hp: 0, detonationSec: 0 }))];
  const { ledger } = grant(rows);
  assert.deepEqual(rows.map((row) => row.detonationSec), [45, 23, 18, 0]);
  assert.deepEqual(ledger.actorIds, ['one', 'two', 'three']);
  assert.equal(rows[3].detonationFinalNightBonusGranted, undefined);
});
check('repeating the entry after normalization and JSON save-load never awards twice', () => {
  let rows = [actor('one', { detonationSec: 8 })];
  const first = grant(rows);
  rows = normalizeRuntimeSurvivorList(JSON.parse(JSON.stringify(rows)));
  assert.equal(grant(rows).events.length, 0, 'Actor marker protects even without the match ledger.');
  assert.equal(rows[0].detonationSec, 23);
  const restoredLedger = JSON.parse(JSON.stringify(first.ledger));
  const again = grant([...rows, actor('late')], { previousGrant: restoredLedger });
  assert.equal(again.events.length, 0); assert.deepEqual(again.ledger, restoredLedger);
});
check('other nights, later phases and disabled collars do not award the entry bonus', () => {
  for (const options of [{ day: 5 }, { phase: 'morning' }, { day: 7 }, { ruleset: {} }]) {
    const row = actor('one'); const before = structuredClone(row);
    assert.equal(grant([row], options).events.length, 0); assert.deepEqual(row, before);
  }
});
check('the safe-zone tick regenerates to 30 ordinarily and to 45 after final-night entry', () => {
  const normal = actor('normal', { detonationSec: 29 }), final = actor('final', { detonationSec: 8 });
  grant([final]);
  const rows = tick([normal, final], { duration: 60 }).updatedSurvivors;
  assert.deepEqual(rows.map((row) => [row.detonationSec, row.detonationMaxSec]), [[30, 30], [45, 45]]);
  assert.equal(final.detonationSec, 23, 'Tick input remains an owned snapshot.');
});
check('forbidden time is consumed normally and a subsequent safe tick does not erase the bonus', () => {
  const row = actor('one', { detonationSec: 30 }); grant([row]);
  const after = tick([row], { forbidden: true, duration: 10 }).updatedSurvivors;
  assert.equal(after[0].detonationSec, 35);
  assert.equal(tick(after).updatedSurvivors[0].detonationSec, 36);
});
check('kills after final-night entry replenish up to 45 but never increase that cap', () => {
  const row = actor('one', { detonationSec: 8 }); grant([row]);
  const runtime = elimination(row);
  runtime.kill('first'); assert.equal(row.detonationSec, 28);
  for (let i = 0; i < 10; i++) runtime.kill(`victim${i}`);
  assert.equal(row.detonationSec, 45); assert.equal(row.detonationMaxSec, 45);
  assert.equal(runtime.logs.filter((line) => line.includes('타이머 +')).length, 5);
  assert.equal(runtime.kill('first').duplicate, true); assert.equal(row.detonationSec, 45);
});
check('a zero kill bonus is respected and capped rewards report only the time actually restored', () => {
  const row = actor('one', { detonationSec: 29 });
  const runtime = elimination(row); runtime.kill('first');
  assert.ok(runtime.logs.some((line) => line.includes('타이머 +1초 (30/30초)')));
  row.detonationSec = 20;
  elimination(row, { ...ruleset, detonation: { ...ruleset.detonation, killBonusSec: 0 } }).kill('none');
  assert.equal(row.detonationSec, 20);
});
check('old inflated caps, invalid remaining values, and oversized starts cannot bypass the limits', () => {
  const row = actor('old', { detonationSec: 100, detonationMaxSec: 100 });
  normalizeDetonationTimer(row, ruleset); assert.equal(row.detonationSec, 30); assert.equal(row.detonationMaxSec, 30);
  for (const value of [undefined, null, NaN, Infinity]) {
    row.detonationSec = value; normalizeDetonationTimer(row, ruleset); assert.equal(row.detonationSec, 20);
  }
  row.detonationSec = -3; normalizeDetonationTimer(row, ruleset); assert.equal(row.detonationSec, 0);
  resetDetonationTimer(row, { detonation: { startSec: 99, maxSec: 99 } }, { newMatch: true });
  assert.equal(row.detonationSec, 30); assert.equal(row.detonationMaxSec, 30);
});
check('post-action initialization preserves the earned 45-second timer', () => {
  const row = actor('one', { detonationSec: 30 }); grant([row]);
  runActorPostActionPhase({ state: { actor: row, useDetonation: true, ruleset, phaseIdxNow: 13 } });
  assert.equal(row.detonationSec, 45); assert.equal(row.detonationMaxSec, 45);
});
check('revival keeps the grant marker, while a genuinely new match resets it and starts normally', () => {
  const row = actor('one', { detonationSec: 8 }); grant([row]); row.hp = 0;
  const revived = normalizeRevivedSurvivor(row, 50, 'safe', 13, ruleset, 1185, null);
  resetDetonationTimer(revived, ruleset, { finalNight: true });
  assert.equal(revived.detonationSec, 20); assert.equal(revived.detonationMaxSec, 45);
  assert.equal(grant([revived]).events.length, 0); assert.equal(revived.detonationSec, 20);
  resetDetonationTimer(revived, ruleset, { newMatch: true });
  assert.equal(revived.detonationSec, 20); assert.equal(revived.detonationMaxSec, 30);
  assert.equal(grant([revived]).events.length, 1);
});
check('dead winners cannot restore time even when credited with a simultaneous elimination', () => {
  const row = actor('dead', { hp: 0, detonationSec: 8 });
  elimination(row).kill('victim');
  assert.equal(row.hp, 0); assert.equal(row.detonationSec, 8);
  assert.equal(restoreDetonationTime(row, 5, ruleset), 0);
});
check('the global grant reaches living arena actors without enabling field hazards or regeneration there', () => {
  const row = actor('arena', { detonationSec: 8 });
  enterDimensionRiftSpace(row, { id: 'r', zoneId: 'safe', day: 4, phase: 'night', maxTeams: 2 }, 1100);
  grant([row]);
  assert.equal(tick([row], { forbidden: true, duration: 10 }).updatedSurvivors[0].detonationSec, 23);
  assert.equal(tick([row], { duration: 10 }).updatedSurvivors[0].detonationSec, 23);
});
check('the observer describes the recorded before/after values instead of the later live timer', () => {
  const row = actor('one', { detonationSec: 8 }), { events } = grant([row]);
  row.detonationSec = 45;
  assert.match(describeObserverEvent(events[0]), /8초 \+15초 → 23초 · 이후 상한 45초/);
  const model = buildTeamObserverModel({ survivors: [row], events, teamId: 'one', matchSec: 1181 });
  assert.ok(JSON.stringify(model).includes('8초 +15초 → 23초'));
});
check('actual phase setup grants at final-night entry and preserves the ledger in subsequent phases', () => {
  const zones = ['safe', 'other', 'third'].map((zoneId) => ({ zoneId, name: zoneId }));
  const map = { _id: 'timer-map', zones, routes: [] }, events = [];
  const refs = { suddenDeathActiveRef: { current: false }, suddenDeathEndAtSecRef: { current: null },
    startStarterLoadoutAppliedRef: { current: true } };
  const originals = [Object.freeze(actor('one', { detonationSec: 30 })), Object.freeze(actor('two', { detonationSec: 8 }))];
  const baseState = { day: 6, phase: 'morning', matchSec: 1180, activeMap: map, activeMapId: map._id, zones,
    settings: { rulesetId: 'ER_S11', matchMode: 'solo' }, survivors: originals, dead: [], publicItems: [], kiosks: [] };
  const actions = { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }) };
  const first = runSimulationPhaseSetup({ refs, state: baseState, actions });
  assert.deepEqual(first.phaseSurvivors.map((row) => row.detonationSec), [45, 23]);
  assert.equal(first.nextPhase, 'night'); assert.equal(refs.suddenDeathActiveRef.current, true);
  assert.equal(events.filter((event) => event.kind === 'detonation_bonus').length, 2);
  assert.deepEqual(originals.map((row) => row.detonationSec), [30, 8]);
  const next = runSimulationPhaseSetup({ refs, actions, state: { ...baseState, day: 6, phase: 'night', matchSec: 1230,
    survivors: JSON.parse(JSON.stringify(first.phaseSurvivors)), spawnState: JSON.parse(JSON.stringify(first.nextSpawn)) } });
  assert.deepEqual(next.phaseSurvivors.map((row) => [row.detonationSec, row.detonationMaxSec]), [[45, 45], [23, 45]]);
  assert.deepEqual(next.nextSpawn.detonationFinalNightGrant, first.nextSpawn.detonationFinalNightGrant);
  assert.equal(events.filter((event) => event.kind === 'detonation_bonus').length, 2);
});
check('initial roster construction never imports the final-night timer or grant marker into a new match', () => {
  const old = actor('old', { detonationSec: 45, detonationMaxSec: 45, detonationFinalNight: true,
    detonationFinalNightBonusGranted: true, detonationFinalNightBonusAtSec: 1180 });
  const result = buildInitialSimulationRoster({ charList: [old], initialZoneIds: ['safe'], loadedSettings: { rulesetId: 'ER_S11' } });
  const fresh = result.candidateChars[0];
  assert.equal(fresh.detonationSec, 20); assert.equal(fresh.detonationMaxSec, 30);
  assert.equal(fresh.detonationFinalNightBonusGranted, false); assert.equal(fresh.detonationFinalNightBonusAtSec, null);
});
check('Legacy uses the same 30/45-second cap and once-only 15-second grant', () => {
  const row = actor('legacy', { detonationSec: 8 }), legacy = getRuleset('LEGACY');
  grant([row], { ruleset: legacy }); assert.equal(row.detonationSec, 23);
  restoreDetonationTime(row, 100, legacy); assert.equal(row.detonationSec, 45);
});

console.log(`DETONATION_RULES_CHECKS ${checks}/${checks}`);
