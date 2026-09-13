import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createEndgamePressure, advanceEndgamePressure, pickEndgameMove, getEndgameDurationSec } = await import('../src/app/simulation/_lib/suddenDeathRuntime.js');
const { getMatchEndState } = await import('../src/app/simulation/_lib/matchEndRuntime.js');
const { finalizeSimulationPhase } = await import('../src/app/simulation/_lib/phaseFinalizationRuntime.js');
const { finishSimulationGame } = await import('../src/app/simulation/_lib/finishGameRuntime.js');
const { prepareForbiddenZonePhase, beginSimulationPhase } = await import('../src/app/simulation/_lib/phasePreparationRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { setDeathMetadata } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');
const { getForbiddenZoneIdsForPhase, getForbiddenAddedZoneIdsForPhase } = await import('../src/app/simulation/_lib/forbiddenZoneRuntime.js');
const { buildBaseZoneGraph } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { readLocalSimulationRunHistory } = await import('../src/app/simulation/_lib/localRunHistoryRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { buildDetonationRiskSummary } = await import('../src/app/simulation/_lib/mapDerived.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'a', hp: 100, maxHp: 100, ...extra });
const lineMap = { _id: 'line', zones: ['a', 'b', 'c', 'd', 'e'].map((zoneId) => ({ zoneId })),
  zoneConnections: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']].map(([fromZoneId, toZoneId]) => ({ fromZoneId, toZoneId })) };
const graph = buildBaseZoneGraph(lineMap, lineMap.zones);
const ruleset = getRuleset('ER_S11');

await check('pressure announces exact two-to-one-to-zero boundaries without closing safe zones early', () => {
  const blocked = new Set(['a', 'b', 'c']);
  const endgame = createEndgamePressure({ mapObj: lineMap, forbiddenIds: blocked, nowSec: 100 });
  const events = [];
  const actions = { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) };
  advanceEndgamePressure(endgame, blocked, 100, actions);
  assert.equal(blocked.size, 3);
  assert.equal(advanceEndgamePressure(endgame, blocked, 189, actions), false);
  assert.equal(blocked.size, 3);
  advanceEndgamePressure(endgame, blocked, 190, actions);
  assert.equal(blocked.size, 4);
  assert.equal(blocked.has(endgame.finalZoneId), false);
  advanceEndgamePressure(endgame, blocked, 469, actions);
  assert.equal(blocked.size, 4);
  advanceEndgamePressure(endgame, blocked, 470, actions);
  assert.equal(blocked.size, 5);
  assert.deepEqual(events.map((event) => event.stage), ['approach', 'final', 'closed']);
});

await check('escape and pre-closure rotation use real edges, including dangerous intermediate zones', () => {
  const blocked = new Set(['a', 'b', 'c']);
  const endgame = { zoneIds: ['a', 'b', 'c', 'd', 'e'], finalZoneId: 'e', singleZoneAtSec: 90, stage: 'approach' };
  const original = actor('one', { zoneId: 'a', detonationSec: 12 });
  const snapshot = structuredClone(original);
  assert.equal(pickEndgameMove(original, endgame, blocked, graph, 0).nextStep, 'b');
  assert.deepEqual(original, snapshot, 'Planning grants neither travel nor extra timer/HP.');
  assert.equal(pickEndgameMove(actor('two', { zoneId: 'd' }), endgame, blocked, graph, 69), null);
  assert.equal(pickEndgameMove(actor('two', { zoneId: 'd' }), endgame, blocked, graph, 70).nextStep, 'e');
  assert.equal(pickEndgameMove(actor('three', { zoneId: 'e' }), endgame, blocked, graph, 91).nextStep, 'e');
  assert.equal(pickEndgameMove(original, endgame, blocked, { a: [], e: [] }, 91), null, 'No fabricated route.');
});

await check('endgame state survives phase setup without selecting a new anchor or reopening a zone', () => {
  const blocked = new Set(['a', 'b', 'c']);
  const endgame = createEndgamePressure({ mapObj: lineMap, forbiddenIds: blocked, nowSec: 100 });
  advanceEndgamePressure(endgame, blocked, 190);
  const snapshot = structuredClone(endgame);
  const result = prepareForbiddenZonePhase({
    refs: { suddenDeathActiveRef: { current: true } },
    state: { activeMap: lineMap, activeMapId: 'line', nextDay: 7, nextPhase: 'morning', phaseStartSec: 210,
      spawnState: { endgame }, ruleset, settings: {}, useDetonation: true },
    helpers: { getForbiddenZoneIdsForPhase: () => ['e'], getForbiddenAddedZoneIdsForPhase: () => ['e'] },
  });
  assert.deepEqual([...result.forbiddenIds], [...blocked]);
  assert.equal(result.endgame.finalZoneId, endgame.finalZoneId);
  assert.deepEqual(endgame, snapshot, 'Published previous phase state stays immutable.');
  assert.deepEqual(result.newlyAddedForbidden, []);
});

await check('ordinary closures preserve connected safe areas and their displayed additions are actual differences', () => {
  for (const map of [lineMap, buildGuestSimulationMap()]) {
    const mapGraph = buildBaseZoneGraph(map, map.zones);
    const cache = {};
    let prior = new Set();
    for (let index = 2; index <= 16; index += 1) {
      const day = Math.floor(index / 2); const phase = index % 2 ? 'night' : 'morning';
      const blocked = new Set(getForbiddenZoneIdsForPhase(map, day, phase, map.zones, {}, cache));
      assert.ok([...prior].every((id) => blocked.has(id)), 'Never reopen an already closed zone.');
      assert.deepEqual(new Set(getForbiddenAddedZoneIdsForPhase(map, day, phase, map.zones, {}, cache)), new Set([...blocked].filter((id) => !prior.has(id))));
      const safe = map.zones.map((zone) => zone.zoneId).filter((id) => !blocked.has(id));
      const visited = new Set([safe[0]]); const queue = [safe[0]];
      for (let n = 0; n < queue.length; n += 1) for (const id of mapGraph[queue[n]] || []) {
        if (safe.includes(id) && !visited.has(id)) { visited.add(id); queue.push(id); }
      }
      assert.equal(visited.size, safe.length, `${map._id} phase ${index}: remaining zones must be connected.`);
      if (index === 16) assert.equal(safe.length, 2, 'Laboratory closure cannot count twice and leave a third safe zone.');
      prior = blocked;
    }
  }
});

await check('closure caches do not survive changes to the enabled setting or phase rate', () => {
  const cache = {};
  const enabled = getForbiddenZoneIdsForPhase(lineMap, 3, 'morning', lineMap.zones, {}, cache);
  const disabled = getForbiddenZoneIdsForPhase(lineMap, 3, 'morning', lineMap.zones, { forbiddenZoneEnabled: false }, cache);
  assert.ok(enabled.length > 0);
  assert.deepEqual(disabled, []);
  const changed = { ...lineMap, forbiddenZoneConfig: { addPerPhase: 1 } };
  assert.equal(getForbiddenZoneIdsForPhase(changed, 2, 'night', changed.zones, {}, cache).length, 1);
});

await check('observer danger summary uses actual zone closure, not the length of the current phase', () => {
  const state = { activeMap: lineMap, day: 7, phase: 'morning', rulesetId: 'ER_S11', survivors: [] };
  const pair = buildDetonationRiskSummary({ ...state, forbiddenNow: new Set(['a', 'b', 'c']) });
  assert.equal(pair.safeLeft, 2);
  assert.equal(pair.allZonesClosed, false);
  const closed = buildDetonationRiskSummary({ ...state, forbiddenNow: new Set(['a', 'b', 'c', 'd', 'e']) });
  assert.equal(closed.safeLeft, 0);
  assert.equal(closed.allZonesClosed, true);
});

await check('opening wipe protection defers victory but expired or consumed revivals do not', () => {
  const survivors = [actor('a')];
  const dead = [actor('b', { hp: 0, deadAtPhaseIdx: 2 })];
  const config = { survivors, dead, canReviveThisMatch: true, phaseIdxNow: 2, wipeProtectionCutoffIdx: 4 };
  assert.equal(getMatchEndState(config).finished, false);
  assert.equal(getMatchEndState({ ...config, phaseIdxNow: 5 }).finished, true);
  assert.equal(getMatchEndState({ ...config, dead: [{ ...dead[0], revivedOnce: true }] }).finished, true);
  assert.equal(getMatchEndState({ ...config, survivors: [] }).finished, false);
  assert.equal(getMatchEndState({ survivors: [], dead }).outcome, 'no_survivors');
});

await check('a passed deadline alone cannot kill teams or choose a score winner', async () => {
  const survivors = [actor('a'), actor('b', { hp: 10 })];
  let finished = false;
  const result = await finalizeSimulationPhase({
    refs: { suddenDeathActiveRef: { current: true }, suddenDeathEndAtSecRef: { current: 1 } },
    state: { survivorMap: new Map(survivors.map((row) => [row._id, row])), phaseStartSec: 2000,
      nextSpawn: {}, phaseDurationSec: 100, phaseIdxNow: 15 },
    actions: { finishGame: () => { finished = true; } },
  });
  assert.equal(finished, false);
  assert.deepEqual(result.finalStepSurvivors.map((row) => row.hp), [100, 10]);
});

await check('the last team ends on its actual second without running the remaining display clock', async () => {
  const loser = actor('b', { hp: 0, _deathBy: 'combat', _deathCauseName: '교전', _deathAt: 1237 });
  let finishOptions; let clock; let coasted = false;
  await finalizeSimulationPhase({
    state: { survivorMap: new Map([['a', actor('a')]]), phaseStartSec: 1230, getPhaseRuntimeOffsetSec: () => 7,
      phaseDurationSec: 100, nextDay: 7, nextPhase: 'morning', phaseIdxNow: 14, phaseDeadSnapshots: [loser], nextSpawn: {} },
    actions: { finishGame: (_alive, _kills, _assists, options) => { finishOptions = options; },
      setMatchSec: (value) => { clock = value; }, runVisibleClockToPhaseEnd: async () => { coasted = true; } },
  });
  assert.equal(coasted, false);
  assert.equal(clock, 1237);
  assert.equal(finishOptions.ending.cause, 'combat');
  assert.equal(finishOptions.ending.causeName, '교전');
  assert.equal(finishOptions.ending.atSec, 1237);
});

await check('simultaneous explosions leave no survivors and never resurrect a winner', async () => {
  const originals = [actor('a', { detonationSec: 1, gadgetEnergy: 0 }), actor('b', { detonationSec: 1, gadgetEnergy: 0 })];
  const result = runDetonationTickPhase({ state: { updatedSurvivors: originals, forbiddenIds: new Set(['a']),
    useDetonation: true, suddenDeathActive: true, ruleset, phaseDurationSec: 1, phaseIdxNow: 15 }, actions: { setDeathMetadata } });
  assert.equal(result.updatedSurvivors.length, 0);
  assert.equal(result.newlyDead.length, 2);
  assert.ok(result.newlyDead.every((row) => row.hp === 0));
  let finalAlive; let ending;
  await finalizeSimulationPhase({ state: { phaseDeadSnapshots: result.newlyDead, phaseIdxNow: 15, nextSpawn: {} },
    actions: { finishGame: (alive, _kills, _assists, options) => { finalAlive = alive; ending = options.ending; } } });
  assert.deepEqual(finalAlive, []);
  assert.equal(ending.outcome, 'no_survivors');
});

await check('legacy non-detonation rules receive elapsed forbidden damage only, not free eliminations', () => {
  const originals = [actor('a'), actor('b', { zoneId: 'b' })];
  const result = runDetonationTickPhase({ state: { updatedSurvivors: originals, forbiddenIds: new Set(['a']),
    useDetonation: false, suddenDeathActive: true, ruleset: {}, phaseDurationSec: 20 }, actions: { setDeathMetadata } });
  assert.equal(result.newlyDead.length, 1);
  assert.equal(result.newlyDead[0]._deathBy, 'final_zone_pressure');
  assert.equal(result.newlyDead[0]._deathAt, 20);
  assert.equal(result.updatedSurvivors[0].hp, 100);
  assert.equal(getEndgameDurationSec({}), 370);
  const refs = { suddenDeathActiveRef: { current: false }, suddenDeathEndAtSecRef: { current: null } };
  const phase = beginSimulationPhase({ refs, state: { day: 6, phase: 'morning', matchSec: 1000, settings: { rulesetId: 'ER_S11' } } });
  assert.equal(refs.suddenDeathEndAtSecRef.current, 1000 + getEndgameDurationSec(phase.ruleset));
});

await check('CNOT escape consumes energy and keeps its existing timer instead of receiving a free gather reset', () => {
  const result = runDetonationTickPhase({ state: { updatedSurvivors: [actor('a', { detonationSec: 6, gadgetEnergy: 30 })],
    forbiddenIds: new Set(['a']), mapObj: lineMap, zoneGraph: graph, useDetonation: true, suddenDeathActive: true,
    ruleset, phaseDurationSec: 1 } });
  assert.equal(result.updatedSurvivors[0].zoneId, 'b');
  assert.equal(result.updatedSurvivors[0].gadgetEnergy, 0);
  assert.equal(result.updatedSurvivors[0].detonationSec, 5);
});

await check('guest result and local history use the engine ending time even with a stale UI closure', async () => {
  const savedWindow = globalThis.window; const savedStorage = globalThis.localStorage;
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  globalThis.window = { localStorage: storage, dispatchEvent: () => {} };
  globalThis.localStorage = storage;
  try {
    let summary;
    const ending = { outcome: 'last_team', atSec: 1237, day: 7, phase: 'morning', cause: 'combat', causeName: '교전', finalZoneStage: 'final' };
    await finishSimulationGame({ finalSurvivors: [actor('a')], latestKillCounts: {}, latestAssistCounts: {},
      refs: { isFinishingRef: { current: false } }, options: { finalDead: [actor('b', { hp: 0 })], ending },
      state: { day: 6, matchSec: 1180, dead: [], settings: {}, runEvents: [], runSeed: 'ending-check' },
      actions: { setResultSummary: (value) => { summary = typeof value === 'function' ? value(summary) : value; } } });
    assert.equal(summary.ending.atSec, 1237);
    const [record] = readLocalSimulationRunHistory(storage);
    assert.equal(record.matchSec, 1237);
    assert.equal(record.day, 7);
    assert.deepEqual(record.ending, ending);
    assert.equal(record.participants.length, 2);
  } finally { globalThis.window = savedWindow; globalThis.localStorage = savedStorage; }
});

console.log(`ENDGAME_CHECKS ${checks}/${checks}`);
