import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createMapActionRuntime, rebaseSurvivorsForMap, rebaseSurvivorsForMapSteps } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { runMapPreparationSteps } = await import('../src/app/simulation/_lib/mapPreparationRuntime.js');
const { prepareLocalSimulationMapChange, saveLocalSimulationMap, getLocalSimulationStorageKeys, loadLocalSimulationMaps } = await import('../src/app/simulation/_lib/localSimulationMapRuntime.js');
const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { runGuardedPhaseAdvance } = await import('../src/app/simulation/_lib/phaseControllerGuards.js');
const { useSimulationSettingsControls } = await import('../src/app/simulation/_lib/useSimulationSettingsControls.js');

class MemoryStorage {
  values = new Map(); writes = 0; failWrites = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failWrites) throw new Error('QuotaExceededError'); this.values.set(key, String(value)); this.writes++; }
}
const fallback = buildGuestSimulationMap();
const key = getLocalSimulationStorageKeys().map;
const draft = { _id: 'local-map-preparation', name: '준비 시험', zones: [{ zoneId: 'north', name: '북쪽' }, { zoneId: 'south', name: '남쪽' }] };
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const storage = new MemoryStorage();
  saveLocalSimulationMap(draft, storage);
  const maps = loadLocalSimulationMaps(fallback, storage);
  const state = { activeMapId: fallback._id, maps, day: 0, loading: false, isGameOver: false, isAdvancing: false,
    survivors: [{ _id: 'a', name: 'A', hp: 100 }, { _id: 'b', name: 'B', hp: 90 }],
    candidateSurvivors: [{ _id: 'c', name: 'C', hp: 80 }], publicItems: [], settings: {} };
  let latest = state;
  const gate = deferred(), calls = [];
  const refs = { activeMapIdRef: { current: fallback._id }, activeMapRef: { current: fallback }, mapsRef: { current: maps },
    mapPreparationRef: { current: null }, isAdvancingRef: { current: false }, runLockedRef: { current: false } };
  let ticks = 0, yields = 0;
  const context = { storage, refs, state, preparationOptions: {
    now: () => ticks++, sliceMs: 1, yieldFrame: () => ++yields === 1 ? gate.promise : Promise.resolve(),
  }, actions: {
    getCurrentMapInputs: () => latest,
    setMapPreparation: (value) => calls.push(['pending', value]),
    setMaps: (value) => calls.push(['maps', value]),
    applyActiveMapId: (value) => { refs.activeMapIdRef.current = value; calls.push(['id', value]); },
    setSurvivors: (value) => calls.push(['survivors', value]),
    setCandidateSurvivors: (value) => calls.push(['candidates', value]),
    onLocalRulesChanged: () => calls.push(['rules']),
  } };
  return { storage, state, refs, calls, gate, context, api: createMapActionRuntime(context),
    changeInputs: (patch) => { latest = { ...state, ...patch }; }, yields: () => yields };
}
await check('select/save/remove/refresh stage all storage changes until one explicit commit', () => {
  for (const operation of ['select', 'save', 'remove', 'refresh']) {
    const storage = new MemoryStorage(); saveLocalSimulationMap(draft, storage);
    const before = storage.getItem(key), writes = storage.writes;
    const input = operation === 'save' ? { ...draft, name: 'Changed' } : operation === 'select' ? fallback._id : draft._id;
    const prepared = prepareLocalSimulationMapChange(operation, input, fallback, storage);
    assert.equal(prepared.ok, true); assert.equal(storage.getItem(key), before); assert.equal(storage.writes, writes);
    assert.equal(prepared.commit().ok, true); assert.equal(prepared.commit().ok, false);
    assert.equal(storage.writes, writes + (operation === 'refresh' ? 0 : 1));
  }
});
await check('another tab changing storage during preparation is never overwritten', () => {
  for (const operation of ['select', 'save', 'remove', 'refresh']) {
    const storage = new MemoryStorage(); saveLocalSimulationMap(draft, storage);
    const prepared = prepareLocalSimulationMapChange(operation, operation === 'save' ? draft : draft._id, fallback, storage);
    storage.setItem(key, 'other-tab-data');
    assert.equal(prepared.commit().ok, false); assert.equal(storage.getItem(key), 'other-tab-data');
  }
});
await check('quota/read failure and invalid input preserve the actual store', () => {
  const storage = new MemoryStorage(); saveLocalSimulationMap(draft, storage);
  const before = storage.getItem(key);
  const prepared = prepareLocalSimulationMapChange('select', fallback._id, fallback, storage);
  storage.failWrites = true;
  assert.equal(prepared.commit().ok, false); assert.equal(storage.getItem(key), before);
  assert.equal(prepareLocalSimulationMapChange('save', { name: '' }, fallback, storage).ok, false);
  assert.equal(prepareLocalSimulationMapChange('refresh', null, fallback, { getItem() { throw new Error('blocked'); } }).ok, false);
});
await check('corrupt store recovery is deferred too, and refresh without storage can retain fallback', () => {
  const storage = new MemoryStorage(); storage.setItem(key, '{broken');
  const prepared = prepareLocalSimulationMapChange('refresh', null, fallback, storage);
  assert.equal(storage.getItem(key), '{broken'); assert.equal(prepared.maps[0]._id, fallback._id);
  assert.equal(prepared.commit().ok, true); assert.doesNotThrow(() => JSON.parse(storage.getItem(key)));
  assert.equal(prepareLocalSimulationMapChange('refresh', null, fallback, null).commit().ok, true);
});
await check('lock is immediate, duplicate requests/start/settings are blocked before first frame', async () => {
  const f = fixture(), before = f.storage.getItem(key);
  const pending = f.api.selectLocalMap(draft._id);
  assert.ok(f.refs.mapPreparationRef.current);
  assert.deepEqual(f.calls.map(([kind]) => kind), ['pending']);
  assert.equal(f.storage.getItem(key), before); assert.equal(f.refs.activeMapIdRef.current, fallback._id);
  assert.equal(await createMapActionRuntime(f.context).selectLocalMap(fallback._id), false);
  assert.equal((await f.api.saveLocalMap(draft)).ok, false);
  let starts = 0, edits = 0;
  await runGuardedPhaseAdvance({ refs: f.refs, state: f.state, proceedPhase: async () => { starts++; } });
  const settings = useSimulationSettingsControls({ mapPreparationRef: f.refs.mapPreparationRef, day: 0,
    setSettings: () => { edits++; }, setSurvivors: () => { edits++; } });
  settings.handleMatchModeChange('solo'); settings.handleCharacterSkillsToggle(false);
  assert.equal(starts, 0); assert.equal(edits, 0);
  f.gate.resolve(); assert.equal(await pending, true);
  assert.deepEqual(f.calls.map(([kind]) => kind), ['pending', 'maps', 'id', 'survivors', 'candidates', 'pending']);
  assert.deepEqual(f.calls.find(([kind]) => kind === 'survivors')[1], rebaseSurvivorsForMap(f.state.survivors, f.refs.activeMapRef.current));
  assert.deepEqual(f.calls.find(([kind]) => kind === 'candidates')[1], rebaseSurvivorsForMap(f.state.candidateSurvivors, f.refs.activeMapRef.current));
  assert.equal(f.refs.mapPreparationRef.current, null); assert.ok(f.yields() > 1);
});
await check('failed persistence never publishes either roster, map, or selection', async () => {
  const f = fixture(), before = f.storage.getItem(key);
  const pending = f.api.saveLocalMap({ ...draft, name: 'Cannot save' });
  f.storage.failWrites = true; f.gate.resolve();
  assert.equal((await pending).ok, false); assert.equal(f.storage.getItem(key), before);
  assert.deepEqual(f.calls.map(([kind]) => kind), ['pending', 'pending']); assert.equal(f.refs.mapPreparationRef.current, null);
});
await check('selecting an unchanged ID still rebases changed stored map content', async () => {
  const f = fixture(); f.state.activeMapId = draft._id; f.refs.activeMapIdRef.current = draft._id;
  const pending = f.api.selectLocalMap(draft._id); f.gate.resolve();
  assert.equal(await pending, true);
  assert.ok(f.calls.find(([kind]) => kind === 'survivors')[1].every((actor) => ['north', 'south'].includes(actor.zoneId)));
  assert.ok(f.calls.some(([kind]) => kind === 'candidates'));
});
await check('in-flight edit/delete conflict leaves the newer stored version and visible map intact', async () => {
  const f = fixture(); const pending = f.api.removeLocalMap(draft._id);
  saveLocalSimulationMap({ ...draft, name: 'Other tab' }, f.storage);
  const changed = f.storage.getItem(key); f.gate.resolve();
  assert.equal((await pending).ok, false); assert.equal(f.storage.getItem(key), changed);
  assert.deepEqual(f.calls.map(([kind]) => kind), ['pending', 'pending']);
});
await check('changed input, run lock, or page cleanup cancels all later publication', async () => {
  for (const cause of ['input', 'run', 'unmount']) {
    const f = fixture(), before = f.storage.getItem(key);
    const pending = f.api.saveLocalMap({ ...draft, name: 'Not committed' });
    if (cause === 'input') f.changeInputs({ survivors: [...f.state.survivors] });
    if (cause === 'run') f.refs.runLockedRef.current = true;
    if (cause === 'unmount') { f.refs.mapPreparationRef.current.cancelled = true; f.refs.mapPreparationRef.current = null; }
    f.gate.resolve(); const result = await pending;
    assert.equal(result.cancelled, true); assert.equal(f.storage.getItem(key), before);
    assert.deepEqual(f.calls.map(([kind]) => kind), cause === 'unmount' ? ['pending'] : ['pending', 'pending']);
  }
});
await check('scheduler failure unlocks without storage or state publication', async () => {
  const f = fixture(), before = f.storage.getItem(key);
  f.context.preparationOptions.yieldFrame = () => Promise.reject(new Error('scheduler failed'));
  const result = await createMapActionRuntime(f.context).saveLocalMap(draft);
  assert.equal(result.ok, false); assert.equal(f.refs.mapPreparationRef.current, null);
  assert.equal(f.storage.getItem(key), before); assert.deepEqual(f.calls.map(([kind]) => kind), ['pending', 'pending']);
});
await check('manual refresh rebases both lists but start never reloads a different saved map', async () => {
  const f = fixture();
  assert.equal(await f.api.refreshMapSettingsFromServer('start'), true); assert.deepEqual(f.calls, []);
  const pending = f.api.refreshMapSettingsFromServer('manual'); f.gate.resolve();
  assert.equal(await pending, true); assert.equal(f.refs.activeMapIdRef.current, draft._id);
  assert.ok(f.calls.some(([kind]) => kind === 'survivors')); assert.ok(f.calls.some(([kind]) => kind === 'candidates'));
});
await check('cooperative 24-actor real-catalog output equals the synchronous result on both maps', async () => {
  const items = await loadGuestSimulationItemCatalog(), roster = buildGuestSimulationRoster();
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('Preparation must not consume random numbers'); };
  try {
    for (const map of [fallback, draft]) {
      const before = structuredClone({ roster, map, items });
      let ticks = 0, yields = 0;
      const result = await runMapPreparationSteps(rebaseSurvivorsForMapSteps(roster, map, items), {
        now: () => ticks++, sliceMs: 1, yieldFrame: () => { yields++; return Promise.resolve(); },
      });
      assert.equal(result.ok, true); assert.ok(yields > 24);
      assert.deepEqual(result.value, rebaseSurvivorsForMap(roster, map, items));
      assert.deepEqual({ roster, map, items }, before);
    }
  } finally { Math.random = originalRandom; }
});
await check('cooperative iterator closes on cancellation and propagates unexpected exceptions', async () => {
  let closed = 0;
  function* job() { try { yield; throw new Error('Unexpected'); } finally { closed++; } }
  assert.equal((await runMapPreparationSteps(job(), { isCurrent: () => false, yieldFrame: () => null })).cancelled, true);
  await assert.rejects(runMapPreparationSteps(job(), { yieldFrame: () => null }), /Unexpected/);
  assert.equal(closed, 1);
});
await check('UI awaits map actions, publishes pending status and disables start/settings through common busy state', () => {
  const read = (path) => readFileSync(new URL(`../src/app/simulation/${path}`, import.meta.url), 'utf8');
  assert.match(read('_components/SimulationPregameMapRulesSetup.js'), /await onMapChange/);
  assert.match(read('_components/SimulationPregameMapRulesSetup.js'), /await onMapSave/);
  assert.match(read('_components/SimulationPregameMapRulesSetup.js'), /await onMapDelete/);
  assert.match(read('_components/SimulationGameScreen.js'), /mapPreparation.*role="status"/);
  assert.match(read('_lib/useSimulationPageController.js'), /isAdvancing: isAdvancing \|\| Boolean\(mapPreparation\)/);
  assert.match(read('_lib/useSimulationMapActions.js'), /mapPreparationRef\.current\.cancelled = true/);
});
console.log(`MAP_PREPARATION_LIFECYCLE ${checks}/${checks}`);
