import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';
const hookUrl = new URL('../src/app/simulation/_lib/useSimulationMarketState.js', import.meta.url).href;
const stateUrl = new URL('../src/app/simulation/_lib/marketStateRuntime.js', import.meta.url).href;
const initialDataUrl = new URL('../src/app/simulation/_lib/useSimulationInitialData.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const baseline = process.argv.includes('--baseline');
const providerUrl = 'data:text/javascript,' + encodeURIComponent(`
export const getApiErrorMessage = error => String(error?.message || error);
export const loadMarketData = () => { globalThis.__initialGoalRace.requests++; return globalThis.__initialGoalRace.promise; };
export const loadTradeData = () => { globalThis.__initialGoalRace.tradeRequests++; return Promise.resolve({ tradeOffers: [], myTradeOffers: [], failedLabels: [] }); };
`);
registerHooks({ load(url, context, nextLoad) {
  if ([hookUrl, initialDataUrl].includes(url)) {
    let source = readFileSync(new URL(url), 'utf8');
    if (baseline && url === hookUrl) {
      assert.ok(source.includes('evaluationMode = false,'));
      // Reproduce the former hook which did not receive evaluationMode.
      source = source.replaceAll(/\bevaluationMode\b/g, 'ignoredEvaluationMode');
    }
    if (baseline && url === initialDataUrl) {
      assert.equal(source.split('persistUser: !guestMode,').length - 1, 1);
      source = source.replace('persistUser: !guestMode,', '');
    }
    return { format: 'module', shortCircuit: true,
      source: source.replaceAll("from 'react'", `from '${harnessUrl}'`) };
  }
  if (url === stateUrl) return { format: 'module', shortCircuit: true,
    source: readFileSync(new URL(url), 'utf8').replace("from './simulationInitRuntime'", `from ${JSON.stringify(providerUrl)}`) };
  return nextLoad(url, context);
} });
const { useSimulationMarketState } = await import(hookUrl);
const { useSimulationInitialData } = await import(initialDataUrl);
const { applyUserEconomyProgressToState } = await import(stateUrl);
const { resolveSimulationBootstrapData, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const seed = readFileSync(new URL('../src/app/eternalhunger/evaluate/page.js', import.meta.url), 'utf8').match(/const EVALUATION_SEED = '([^']+)'/)[1];
const defaults = getDefaultSimulationSettings();
const bootstrap = resolveSimulationBootstrapData({ charList: [], mapsList: [], meValue: {}, settingValue: defaults,
  defaultSettings: defaults, guestMode: true, guestProfiles: [], isolatedEvaluation: true });
const map = bootstrap.mapsList[0], settings = { ...defaults, ...bootstrap.settingValue };
const items = await loadGuestSimulationItemCatalog({ includeLocal: false });
const { shuffledChars: originalRoster } = withSimulationRandom(createSeedRng(`EVALUATION_SETUP:${seed}`),
  () => buildInitialSimulationRoster({ charList: bootstrap.charList, routeItems: items, initialMap: map,
    initialZoneIds: map.zones.map(zone => String(zone.zoneId)), loadedSettings: settings,
    participantPresets: [], selectedParticipantPresetId: '', viewerPerks: [], publicPerks: [] }));
const priorWindow = globalThis.window;
function warnings(survivors, catalog) {
  const members = [...new Set(survivors.map(actor => actor.teamId))].flatMap(teamId => buildTeamObserverModel({
    survivors, teamId, publicItems: catalog, settings, day: 0, phase: 'night', matchSec: 0, zoneName: String }).members);
  return { count: members.filter(row => row.growth?.note?.includes('초반 목표 확인 필요')).length,
    firstWarning: members.find(row => row.growth?.note?.includes('초반 목표 확인 필요'))?.growth.note ?? '' };
}
async function exercise({ evaluationMode = true, replayMode = false, authenticated = true, serverItems = [], marketTab = 'craft' } = {}) {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  globalThis.__initialGoalRace = { requests: 0, tradeRequests: 0, promise };
  let storedUser = authenticated ? { username: 'synthetic-user', credits: 123, lp: 88, perks: ['fixture-perk'] } : null;
  const timers = new Map(), listeners = new Map(); let serial = 0;
  globalThis.window = { localStorage: { getItem: key => key === 'user' && storedUser ? JSON.stringify(storedUser) : null },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    setTimeout(callback) { const id = ++serial; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  let survivors = structuredClone(originalRoster), dead = [], survivorWrites = 0;
  const beforeAttack = survivors[0].stats.attackPower;
  const props = { evaluationMode, replayMode, runLockedRef: { current: false }, survivors,
    runEvents: [], devEventPreviewLimit: 10, devSelectRenderLimit: 10, marketCardRenderLimit: 10,
    fireAndReport: (_label, job) => job(), setSurvivors(update) { survivors = typeof update === 'function' ? update(survivors) : update; survivorWrites++; },
    setDead(update) { dead = typeof update === 'function' ? update(dead) : update; } };
  const harness = createHandlerHarness(useSimulationMarketState, props);
  let hook = harness.flush();
  hook.setPublicItems(items); hook = harness.flush();
  if (marketTab !== 'craft') { hook.selectMarketTab(marketTab); hook = harness.flush(); }
  const before = warnings(survivors, hook.publicItems);
  assert.equal(before.count, 0);
  const drain = () => { for (const [id, callback] of timers) { timers.delete(id); callback(); } hook = harness.flush(); };
  drain();
  resolve({ publicItems: serverItems, kiosks: [], droneOffers: [],
    publicPerks: [{ code: 'fixture-perk', name: 'synthetic perk', effects: { atkPlus: 50, maxHpPlus: 20 } }], failedLabels: [] });
  for (let index = 0; index < 6; index++) await Promise.resolve();
  hook = harness.flush(); drain();
  const after = warnings(survivors, hook.publicItems);
  const afterMarketAttack = survivors[0].stats.attackPower;
  const beforeAuthSync = { credits: hook.credits, lp: hook.viewerLp, perks: [...hook.viewerPerks] };
  if (authenticated) {
    storedUser = { ...storedUser, credits: 456, lp: 99, perks: ['late-auth-perk'] };
    listeners.get('eh:auth-sync')?.();
    hook = harness.flush(); drain();
  }
  const result = { evaluationMode, replayMode, authenticated, marketTab, suppliedServerItems: serverItems.length,
    marketRequests: globalThis.__initialGoalRace.requests, tradeRequests: globalThis.__initialGoalRace.tradeRequests, beforeCatalog: items.length,
    afterCatalog: hook.publicItems.length, beforeWarnings: before.count, afterWarnings: after.count,
    firstWarning: after.firstWarning, viewerCredits: hook.credits, viewerLp: hook.viewerLp,
    viewerPerks: hook.viewerPerks, actorAttackBefore: beforeAttack, actorAttackAfter: afterMarketAttack,
    beforeAuthSync, authSyncSubscribed: listeners.has('eh:auth-sync'), survivorWrites };
  harness.unmount(); assert.equal(listeners.size, 0); assert.equal(timers.size, 0);
  return result;
}
async function bootstrapStorageControl({ authenticated = true } = {}) {
  const user = { username: 'synthetic-bootstrap-user', credits: 123, lp: 88, perks: ['fixture-perk'] };
  const originalUserRaw = authenticated ? JSON.stringify(user) : null;
  const storage = new Map(authenticated ? [['user', originalUserRaw]] : []), writes = [];
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null,
    setItem(key, value) { storage.set(key, String(value)); writes.push(key); }, removeItem(key) { storage.delete(key); } },
    dispatchEvent() {} };
  let loading = true, publicItems = [], survivors = [];
  const actionNames = ['setAssistCounts', 'setCandidateSurvivors', 'setCredits', 'setDroneOffers', 'setGameEndReason',
    'setIsGameOver', 'setKiosks', 'setKillCounts', 'setMaps', 'setMarketMessage', 'setMatchSec', 'setMyTradeOffers',
    'setParticipantPresetName', 'setParticipantPresets', 'setPrevPhaseLogs', 'setPublicPerks', 'setResultSummary',
    'setSelectedParticipantPresetId', 'setSettings', 'setShowResultModal', 'setTradeOffers', 'setViewerLp', 'setViewerPerks',
    'setWinner', 'setSimulationFrame'];
  const actions = Object.fromEntries(actionNames.map(name => [name, () => {}]));
  Object.assign(actions, { setLoading(value) { loading = value; }, setPublicItems(value) { publicItems = value; },
    setSurvivors(value) { survivors = typeof value === 'function' ? value(survivors) : value; } });
  const harness = createHandlerHarness(useSimulationInitialData, { forceGuest: true, isolatedEvaluation: true, evaluationSeed: seed,
    refs: { activeMapRef: { current: null }, mapsRef: { current: [] }, runLockedRef: { current: false } },
    helpers: { addLog() {}, applyActiveMapId() {}, getDefaultSimulationSettings }, actions });
  harness.flush();
  for (let turn = 0; loading && turn < 100; turn++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(loading, false); assert.equal(publicItems.length, 774); assert.equal(survivors.length, 24);
  const afterRaw = storage.get('user') ?? null;
  const after = afterRaw ? JSON.parse(afterRaw) : null;
  harness.unmount();
  return { authenticated, before: authenticated ? user : null, after,
    rawAccountUnchanged: afterRaw === originalUserRaw, syntheticStorageWriteKeys: writes, catalog: publicItems.length, actors: survivors.length };
}
function defaultEconomyPersistenceControl() {
  let user = { username: 'synthetic-normal-user', credits: 10, lp: 20, perks: [] };
  let writes = 0;
  globalThis.window = { localStorage: { getItem: key => key === 'user' ? JSON.stringify(user) : null,
    setItem(key, value) { if (key === 'user') { user = JSON.parse(value); writes++; } }, removeItem() {} }, dispatchEvent() {} };
  const state = {};
  applyUserEconomyProgressToState({ credits: 321, lp: 654, perks: ['normal-retained'] }, {
    setCredits: value => { state.credits = value; }, setViewerLp: value => { state.lp = value; }, setViewerPerks: value => { state.perks = value; },
  });
  assert.deepEqual(state, { credits: 321, lp: 654, perks: ['normal-retained'] });
  assert.equal(user.credits, 321); assert.equal(user.lp, 654); assert.deepEqual(user.perks, ['normal-retained']);
  assert.equal(writes, 1);
  return { pass: true, defaultPersistenceRetained: true };
}
try {
  const results = [];
  results.push(await exercise());
  results.push(await exercise({ serverItems: [{ _id: 'synthetic-server-only', name: 'synthetic custom item' }] }));
  results.push(await exercise({ authenticated: false }));
  results.push(await exercise({ evaluationMode: false }));
  results.push(await exercise({ replayMode: true }));
  results.push(await exercise({ evaluationMode: false, replayMode: true }));
  results.push(await exercise({ marketTab: 'trade' }));
  results.push(await exercise({ evaluationMode: false, marketTab: 'trade' }));
  const bootstrapStorage = await bootstrapStorageControl();
  const anonymousBootstrapStorage = await bootstrapStorageControl({ authenticated: false });
  const normalEconomy = defaultEconomyPersistenceControl();
  console.log(JSON.stringify({ baseline, cases: results.map(row => ({ evaluation: row.evaluationMode, replay: row.replayMode,
    authenticated: row.authenticated, requests: row.marketRequests, tradeRequests: row.tradeRequests, before: row.beforeCatalog, after: row.afterCatalog,
    warnings: row.afterWarnings, attackIncrease: row.actorAttackAfter - row.actorAttackBefore,
    authSyncSubscribed: row.authSyncSubscribed })), bootstrapStorage, anonymousBootstrapStorage, normalEconomy }));
  for (const result of results.filter(row => row.evaluationMode)) {
    assert.equal(result.marketRequests, 0, 'Evaluation must not issue authenticated market/trade autoloads.');
    assert.equal(result.tradeRequests, 0);
    assert.equal(result.afterCatalog, 774); assert.equal(result.afterWarnings, 0);
    assert.equal(result.actorAttackAfter, result.actorAttackBefore, 'Stored user perks must not affect the evaluation roster.');
    assert.deepEqual(result.beforeAuthSync, { credits: 0, lp: 0, perks: [] });
    assert.equal(result.authSyncSubscribed, false); assert.equal(result.viewerCredits, 0); assert.equal(result.viewerLp, 0);
    assert.deepEqual(result.viewerPerks, []);
  }
  assert.equal(results[3].marketRequests, 1); assert.equal(results[3].afterCatalog, 0);
  assert.equal(results[3].actorAttackAfter - results[3].actorAttackBefore, 50);
  assert.equal(results[3].viewerCredits, 456); assert.equal(results[3].viewerLp, 99);
  assert.deepEqual(results[3].viewerPerks, ['late-auth-perk']);
  assert.equal(results[5].marketRequests, 0); assert.equal(results[5].tradeRequests, 0);
  assert.equal(results[5].actorAttackAfter, results[5].actorAttackBefore);
  assert.equal(results[5].authSyncSubscribed, true); assert.equal(results[5].viewerCredits, 456);
  assert.deepEqual(results[5].viewerPerks, ['late-auth-perk']);
  assert.equal(results[7].marketRequests, 1); assert.equal(results[7].tradeRequests, 1);
  assert.equal(bootstrapStorage.rawAccountUnchanged, true, 'Guest evaluation bootstrap must preserve the exact stored account JSON.');
  assert.equal(anonymousBootstrapStorage.rawAccountUnchanged, true);
  assert.deepEqual(bootstrapStorage.syntheticStorageWriteKeys, []);
  assert.deepEqual(anonymousBootstrapStorage.syntheticStorageWriteKeys, []);
  const controller = readFileSync(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
  assert.match(controller, /const marketState = useSimulationMarketState\(\{\s*replayMode,\s*evaluationMode,/,
    'The actual controller must forward evaluationMode to the exercised hook.');
  console.log('EVALUATION_MARKET_ISOLATION_CHECKS 11/11; actual hooks/phase-independent deferred fixture; no real account/network/browser or match proof');
} finally { globalThis.window = priorWindow; delete globalThis.__initialGoalRace; }
