import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { createSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildGuestSimulationMap, resolveSimulationBootstrapData } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { rebaseSurvivorsForMap, createMapActionRuntime } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { buildBaseZoneGraph, buildHyperloopZoneGraph, getHyperloopZoneIds, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const {
  deleteLocalSimulationMap,
  getLocalSimulationStorageKeys,
  loadLocalSimulationMaps,
  normalizeLocalSimulationMap,
  readLocalRulesetOverride,
  saveLocalRulesetOverride,
  saveLocalRulesetSelection,
  saveLocalSimulationMap,
  selectLocalSimulationMap,
} = await import('../src/app/simulation/_lib/localSimulationMapRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const fallback = buildGuestSimulationMap();
const storage = new MemoryStorage();
const customDraft = {
  name: '별빛 시험 지도',
  description: '게스트 로컬 저장 검증용 지도',
  zones: [
    { zoneId: 'north', name: '북쪽', center: { x: 10, y: 20 } },
    { zoneId: 'south', name: '남쪽', polygon: [[0, 0], [20, 0], [20, 20], [0, 20]] },
  ],
  zoneConnections: [{ fromZoneId: 'north', toZoneId: 'south', bidirectional: true }],
};

let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };

check('local map input is normalized to a new local ID and bounded shape', () => {
  const result = normalizeLocalSimulationMap(customDraft);
  assert.equal(result.ok, true);
  assert.match(result.map._id, /^local-map-/);
  assert.equal(result.map.localUser, true);
  assert.deepEqual(result.map.zoneConnections[0].fromZoneId, 'north');
});

check('broken references and duplicate zones are rejected before storage', () => {
  assert.equal(normalizeLocalSimulationMap({ ...customDraft, zones: [{ zoneId: 'x' }, { zoneId: 'x' }] }).ok, false);
  assert.equal(normalizeLocalSimulationMap({ ...customDraft, zoneConnections: [{ fromZoneId: 'north', toZoneId: 'missing' }] }).ok, false);
  assert.equal(normalizeLocalSimulationMap({ ...customDraft,
    zones: [{ zoneId: 'north' }, { zoneId: 'south' }, { zoneId: 'island' }],
    zoneConnections: [{ fromZoneId: 'north', toZoneId: 'south' }],
  }).ok, false);
});

check('pregame map changes rebase actor positions and route-plan state', () => {
  const map = { _id: 'local-map-rebase', zones: [{ zoneId: 'alpha' }, { zoneId: 'beta' }], zoneConnections: [{ fromZoneId: 'alpha', toZoneId: 'beta' }] };
  const [actor] = rebaseSurvivorsForMap([{
    _id: 'survivor-1',
    name: '테스트',
    hp: 100,
    zoneId: 'old-lumia-zone',
    routePlanZoneIds: ['old-lumia-zone'],
    routePlanIndex: 4,
    day1Moves: 3,
    day1HeroDone: true,
  }], map, []);
  assert.equal(actor.mapId, 'local-map-rebase');
  assert.ok(['alpha', 'beta'].includes(actor.zoneId));
  assert.equal(actor.routePlanIndex, 0);
  assert.equal(actor.day1Moves, 0);
  assert.equal(actor.day1HeroDone, false);
  assert.ok(actor.routePlanZoneIds.every((zoneId) => ['alpha', 'beta'].includes(zoneId)));
});

const saved = saveLocalSimulationMap(customDraft, storage);
check('saved local map is selected and restored ahead of the built-in fallback', () => {
  assert.equal(saved.ok, true);
  const maps = loadLocalSimulationMaps(fallback, storage);
  assert.equal(maps[0]._id, saved.map._id);
  assert.equal(maps[0].name, '별빛 시험 지도');
  assert.equal(maps[0].updatedAt, saved.map.updatedAt, 'reload must preserve map metadata instead of inventing a content change');
  assert.equal(maps.some((map) => map.guestDefault), true);
});

check('selection and deletion never mutate the built-in map', () => {
  const selected = selectLocalSimulationMap(fallback._id, fallback, storage);
  assert.equal(selected.ok, true);
  assert.equal(selected.maps[0]._id, fallback._id);
  const removed = deleteLocalSimulationMap(saved.map._id, storage);
  assert.equal(removed.ok, true);
  assert.equal(loadLocalSimulationMaps(fallback, storage)[0]._id, fallback._id);
});

check('corrupt map storage self-heals to the fallback', () => {
  const keys = getLocalSimulationStorageKeys();
  storage.setItem(keys.map, '{not-json');
  const maps = loadLocalSimulationMaps(fallback, storage);
  assert.equal(maps[0]._id, fallback._id);
  assert.doesNotThrow(() => JSON.parse(storage.getItem(keys.map)));
});

check('local rules are bounded, persisted, and feed the replay snapshot', () => {
  globalThis.localStorage = storage;
  assert.equal(saveLocalRulesetSelection('ER_S11', storage).ok, true);
  assert.equal(saveLocalRulesetOverride('ER_S11', { pvp: { encounterBase: 0.12 } }, storage).ok, true);
  assert.equal(readLocalRulesetOverride('ER_S11', storage).pvp.encounterBase, 0.12);
  assert.notEqual(getRuleset('ER_S11').pvp.encounterBase, 0.12, 'local patch must not globally affect an auth/base ruleset read');
  const guestBootstrap = resolveSimulationBootstrapData({
    defaultSettings: { rulesetId: 'ER_S11' },
    guestMode: true,
    mapsList: [],
    settingValue: {},
  });
  assert.equal(guestBootstrap.settingValue.simulationRuleset.pvp.encounterBase, 0.12);

  const map = normalizeLocalSimulationMap(customDraft).map;
  const input = createSimulationRunInput({
    activeMap: map,
    dead: [],
    droneOffers: [],
    initialFrame: null,
    kiosks: [],
    publicItems: [],
    runSeed: 'local-seed',
    settings: { rulesetId: 'ER_S11', simulationRuleset: guestBootstrap.settingValue.simulationRuleset },
    spawnState: null,
    survivors: [{ _id: 'a', hp: 100 }, { _id: 'b', hp: 100 }],
  }, storage);
  assert.equal(input.map._id, map._id);
  assert.equal(input.settings.simulationRuleset.pvp.encounterBase, 0.12);
});

check('local map/rule panel has an explicit stylesheet contract', () => {
  const source = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
  assert.match(source, /\.simulation-pregame-map-rules\s*\{/);
  assert.match(source, /\.simulation-pregame-map-rules__editor textarea/);
});

check('simulation core call sites consume the captured rules snapshot', () => {
  const files = [
    '../src/app/simulation/_lib/devToolActionRuntime.js',
    '../src/app/simulation/_lib/marketActionRuntime.js',
    '../src/app/simulation/_lib/simulationInitialRosterRuntime.js',
    '../src/app/simulation/_components/SimulationSurvivorBoard.js',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /getRuleset\(settings\?\.rulesetId\)\|getRuleset\(loadedSettings\?\.rulesetId\)/, file);
    assert.match(source, /getRuleset\([^\n]+simulationRuleset/, file);
  }
});

check('captured forbidden escape rules and local graph drive regional hyperloop without changing maps', () => {
  const map = { _id: 'regional-map', zones: [{ zoneId: 'pad', hasHyperloop: true }, { zoneId: 'safe' }],
    zoneConnections: [{ fromZoneId: 'safe', toZoneId: 'pad', bidirectional: false }] };
  const base = buildBaseZoneGraph(map, map.zones), pads = getHyperloopZoneIds(map, map.zones);
  const graph = buildHyperloopZoneGraph(base, map.zones, pads);
  assert.equal(base.pad.includes('safe'), false);
  assert.equal(graph.pad.includes('safe'), true);
  const movement = chance => {
    const actor = { _id: 'regional', mapId: map._id, zoneId: 'pad', hp: 100, maxHp: 100,
      stats: { attackPower: 20, defense: 10 }, inventory: [] }, events = [];
    const ruleset = getRuleset('ER_S11', { ...getRuleset('ER_S11'), forbidden: { escapeMoveChance: chance } });
    const result = withSimulationRandom(() => 0.5, () => runActorMovementDecisionPhase({ state: {
      actor, phaseSurvivors: [actor], craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {},
      kiosks: [], mapObj: map, nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4,
      forbiddenIds: new Set(['pad']), ruleset, zoneGraph: graph, zones: map.zones,
    }, actions: { atNow: () => ({ day: 3, phase: 'morning', sec: 100 }),
      isHyperloopTransit: (from, to) => isHyperloopTransit(base, pads, from, to),
      emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } }));
    return { result, events };
  };
  const blocked = movement(0), allowed = movement(1);
  assert.equal(blocked.result.nextZoneId, 'pad');
  assert.equal(blocked.events.some(event => event.kind === 'move'), false);
  assert.equal(allowed.result.nextZoneId, 'safe');
  assert.equal(allowed.result.actor.mapId, map._id);
  assert.equal(allowed.result.usedHyperloopMove, true);
  assert.ok(allowed.events.some(event => event.kind === 'move' && event.transport === 'hyperloop'));
});

check('running matches reject cross-map calls and pregame map changes without publishing writes', () => {
  const writes = [], state = { day: 1, activeMapId: fallback._id, maps: [fallback], survivors: [] };
  const runtime = createMapActionRuntime({ state, actions: Object.fromEntries(
    ['applyActiveMapId', 'setMaps', 'setSurvivors', 'emitRunEvent'].map(key => [key, value => writes.push([key, value])])) });
  assert.equal(runtime.doHyperloopJump('remote', 'a'), false);
  assert.deepEqual(writes, []);
});

const lockedMapRuntime = createMapActionRuntime({ state: { day: 1 }, actions: {
  setMaps: () => assert.fail('running match cannot replace maps'),
  applyActiveMapId: () => assert.fail('running match cannot select another map'),
} });
assert.equal(await lockedMapRuntime.selectLocalMap(fallback._id), false);
assert.equal(await lockedMapRuntime.refreshMapSettingsFromServer(), false);

console.log(`GUEST_LOCAL_MAP_RULE_CHECKS ${checks}/${checks}`);
