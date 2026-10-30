import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

// Keep API request/cache, loader, state handler and hook implementations intact.
// Only the transport and React lifecycle are replaced with isolated fixtures.
const hookUrl = new URL('../src/app/simulation/_lib/useSimulationMarketState.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url === hookUrl) return { format: 'module', shortCircuit: true,
    source: readFileSync(new URL(url), 'utf8').replace("from 'react'", `from '${harnessUrl}'`) };
  return nextLoad(url, context);
} });
const priorWindow = globalThis.window;
const priorFetch = globalThis.fetch;
const nativeTransports = [http, https].flatMap(transport => ['request', 'get'].map(method =>
  ({ transport, method, original: transport[method] })));
let blockedNetworkAttempts = 0;
const blockNetwork = () => { blockedNetworkAttempts++; throw new Error('Real network is disabled in this check.'); };
for (const { transport, method } of nativeTransports) transport[method] = blockNetwork;
globalThis.fetch = blockNetwork;
const axios = (await import('axios')).default;
const priorAdapter = axios.defaults.adapter;
const endpoints = { publicItems: 'items', kiosks: 'kiosks', droneOffers: 'drone-offers', publicPerks: 'perks' };
const fields = Object.keys(endpoints);
const pending = new Map();
const requests = [];
const accountWrites = [];
const userRaw = JSON.stringify({ username: 'synthetic-market-user', credits: 123, lp: 45, perks: ['fixture-perk'] });
const timers = new Map(), listeners = new Map();
let timerSerial = 0;
globalThis.window = {
  location: { hostname: 'market-fixture.invalid', origin: 'https://market-fixture.invalid', pathname: '/simulation' },
  localStorage: { getItem: key => key === 'user' ? userRaw : null,
    setItem(key) { accountWrites.push(key); }, removeItem(key) { accountWrites.push(key); } },
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  setTimeout(callback) { const id = ++timerSerial; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
};
axios.defaults.adapter = config => new Promise((resolve, reject) => {
  const url = new URL(config.url);
  assert.equal(url.hostname, 'market-fixture.invalid');
  assert.equal(config.method, 'get');
  const field = fields.find(key => url.pathname.endsWith(`/public/${endpoints[key]}`));
  assert.ok(field, `Unexpected request: ${url.pathname}`);
  assert.equal(pending.has(field), false, `Duplicate pending request: ${field}`);
  requests.push(field);
  pending.set(field, { resolve: data => resolve({ status: 200, data, config, headers: {} }),
    reject: () => reject(Object.assign(new Error('synthetic service failure'),
      { response: { status: 503, data: { error: 'synthetic service failure' } } })) });
});

const api = await import('../src/utils/api.js');
const { loadMarketData } = await import('../src/app/simulation/_lib/simulationInitRuntime.js');
const { loadMarketIntoState } = await import('../src/app/simulation/_lib/marketStateRuntime.js');
const { useSimulationMarketState } = await import(hookUrl);
const baseline = process.argv.includes('--baseline');
const rows = [];
const catalog = tag => Object.fromEntries(fields.map(field => [field,
  [{ _id: `${tag}-${field}`, code: field === 'publicPerks' ? 'fixture-perk' : `${tag}-${field}`,
    name: `${tag} ${field}`, ...(field === 'publicPerks' ? { effects: { atkPlus: tag.endsWith('retry') ? 75 : 50 } } : {}) }]]));
async function settle(data, failures = [], expectedFields = fields) {
  for (let i = 0; i < 16 && pending.size < expectedFields.length; i++) await Promise.resolve();
  assert.deepEqual([...pending.keys()], expectedFields);
  // Settle in a different order from issuance to expose partial completion.
  for (const field of [...expectedFields].reverse()) {
    const request = pending.get(field); pending.delete(field);
    failures.includes(field) ? request.reject() : request.resolve(data[field]);
    await Promise.resolve();
  }
}
const snapshot = state => Object.fromEntries(fields.map(field => [field, structuredClone(state[field])]));
async function probeHandler() {
  let state = catalog('initial');
  const writes = [];
  const actions = { setMarketMessage: value => { state.message = value; } };
  for (const field of fields) actions[`set${field[0].toUpperCase()}${field.slice(1)}`] = value => {
    state[field] = value; writes.push(field);
  };
  async function run(label, data, failures, expected) {
    api.clearApiGetCache(); writes.length = 0;
    const before = snapshot(state), references = { ...state }, job = loadMarketIntoState(actions);
    assert.deepEqual(snapshot(state), before, 'Pending requests must preserve existing lists.');
    await settle(data, failures); await job;
    assert.deepEqual(snapshot(state), expected);
    for (const field of fields) {
      if (!baseline || !failures.includes(field)) assert.strictEqual(state[field],
        failures.includes(field) ? references[field] : data[field], `${field} must retain the intended array identity.`);
    }
    assert.deepEqual(writes, fields.filter(field => baseline || !failures.includes(field)));
    assert.equal(Boolean(state.message), Boolean(failures.length));
    rows.push({ path: 'handler', label, failures, writes: [...writes], sizes: fields.map(field => state[field].length) });
  }
  await run('before-failure', catalog('valid'), [], catalog('valid'));
  for (const field of fields) {
    const prior = snapshot(state), data = catalog(`partial-${field}`);
    await run(`partial-${field}`, data, [field], { ...data, [field]: baseline ? [] : prior[field] });
  }
  const prior = snapshot(state);
  await run('all-failure', catalog('unused'), fields,
    baseline ? Object.fromEntries(fields.map(field => [field, []])) : prior);
  await run('legitimate-empty', Object.fromEntries(fields.map(field => [field, []])), [],
    Object.fromEntries(fields.map(field => [field, []])));
  await run('successful-retry', catalog('retry'), [], catalog('retry'));
  api.clearApiGetCache();
  const job = loadMarketIntoState({ ...actions, canApply: () => false });
  await settle(catalog('blocked')); await job;
  assert.deepEqual(snapshot(state), catalog('retry'));
  rows.push({ path: 'handler', label: 'late-canApply-false', preserved: true });
}
async function probeHook() {
  api.clearApiGetCache();
  const runLockedRef = { current: false };
  let survivors = [{ _id: 'fixture-actor', hp: 100, maxHp: 100, stats: { attackPower: 10 } }];
  let survivorWrites = 0;
  const props = { evaluationMode: false, replayMode: false, runLockedRef, survivors, runEvents: [],
    devEventPreviewLimit: 10, devSelectRenderLimit: 10, marketCardRenderLimit: 10,
    setSurvivors(update) { survivors = typeof update === 'function' ? update(survivors) : update; survivorWrites++; },
    setDead() {}, fireAndReport: (_label, job) => job() };
  const harness = createHandlerHarness(useSimulationMarketState, props);
  try {
    let hook = harness.flush();
    const drain = () => {
      for (const [id, callback] of timers) { timers.delete(id); callback(); }
      hook = harness.flush();
    };
    drain();
    await settle(catalog('hook-valid'));
    for (let i = 0; i < 16; i++) await Promise.resolve();
    hook = harness.flush();
    drain();
    assert.deepEqual(snapshot(hook), catalog('hook-valid'));
    assert.equal(survivors[0].stats.attackPower, 60);
    const references = { ...hook }, beforeWrites = survivorWrites;
    api.clearApiGetCache();
    hook.selectMarketTab('perk'); hook = harness.flush();
    assert.deepEqual(snapshot(hook), catalog('hook-valid'));
    await settle(catalog('hook-partial'), ['publicItems', 'publicPerks']);
    for (let i = 0; i < 16; i++) await Promise.resolve();
    hook = harness.flush();
    drain();
    assert.deepEqual(snapshot(hook), { ...catalog('hook-partial'),
      publicItems: baseline ? [] : catalog('hook-valid').publicItems,
      publicPerks: baseline ? [] : catalog('hook-valid').publicPerks });
    assert.equal(survivors[0].stats.attackPower, baseline ? 10 : 60);
    if (!baseline) {
      assert.strictEqual(hook.publicItems, references.publicItems);
      assert.strictEqual(hook.publicPerks, references.publicPerks);
      assert.strictEqual(hook.activeViewerPerkBundle, references.activeViewerPerkBundle);
      assert.equal(survivorWrites, beforeWrites, 'A failed perks refresh must not rerun actor perk application.');
    }
    rows.push({ path: 'actual-hook', label: 'authenticated-tab-partial-failure',
      sizes: fields.map(field => hook[field].length), actorAttack: survivors[0].stats.attackPower,
      survivorWritesDuringFailure: survivorWrites - beforeWrites });
    for (const [label, data, expectedAttack] of [
      ['legitimate-empty', Object.fromEntries(fields.map(field => [field, []])), 10],
      ['successful-retry', catalog('hook-retry'), 85],
    ]) {
      api.clearApiGetCache();
      const job = hook.loadMarket(); await settle(data); await job;
      hook = harness.flush(); drain();
      assert.deepEqual(snapshot(hook), data);
      assert.equal(hook.marketMessage, '');
      assert.equal(survivors[0].stats.attackPower, expectedAttack);
      rows.push({ path: 'actual-hook', label, actorAttack: expectedAttack });
    }
  } finally { harness.unmount(); }
  for (const mode of ['evaluationMode', 'replayMode', 'runLocked']) {
    const beforeRequests = requests.length;
    const control = createHandlerHarness(useSimulationMarketState, { ...props,
      evaluationMode: mode === 'evaluationMode', replayMode: mode === 'replayMode',
      runLockedRef: { current: mode === 'runLocked' } });
    try { control.flush(); assert.equal(requests.length, beforeRequests); }
    finally { control.unmount(); }
    rows.push({ path: 'actual-hook', label: mode, marketRequests: 0 });
  }
}
try {
  api.clearApiGetCache();
  const job = loadMarketData();
  await settle(catalog('loader'), ['publicPerks']);
  const loaded = await job;
  assert.deepEqual(loaded.failedLabels, ['특전']);
  assert.deepEqual(loaded.publicPerks, []);
  if (!baseline) assert.deepEqual(loaded.failedFields, ['publicPerks']);
  rows.push({ path: 'actual-api-loader', label: 'independent-failure-status', failedLabels: loaded.failedLabels,
    failedFields: loaded.failedFields ?? null });
  const cachedRetry = loadMarketData();
  await settle(catalog('loader-retry'), [], ['publicPerks']);
  const retried = await cachedRetry;
  for (const field of fields.filter(key => key !== 'publicPerks')) assert.strictEqual(retried[field], loaded[field]);
  assert.deepEqual(retried.failedLabels, []);
  if (!baseline) assert.deepEqual(retried.failedFields, []);
  rows.push({ path: 'actual-api-loader', label: 'failed-request-retry-keeps-valid-cache', syntheticRequests: 1 });
  await probeHandler(); await probeHook();
  assert.equal(accountWrites.length, 0); assert.equal(pending.size, 0);
  assert.equal(blockedNetworkAttempts, 0);
  assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
  const report = { baseline, rows, requests: requests.length, realNetworkRequests: 0, blockedNetworkAttempts, accountWrites: 0,
    proof: 'fresh deferred axios transport; actual API/cache/loader/state/hook; synthetic hook lifecycle; no browser or match proof' };
  const out = new URL('../../.local/code-audit/market-failure-followup/', import.meta.url);
  mkdirSync(out, { recursive: true });
  writeFileSync(new URL(baseline ? 'before.json' : 'after.json', out), JSON.stringify(report, null, 2) + '\n');
  console.log(`MARKET_FAILURE_STATE ${baseline ? 'REPRODUCED_CURRENT_LOSS' : 'PASS'} ${rows.length} cases; ${requests.length} synthetic GETs; zero real account/network writes`);
} finally {
  axios.defaults.adapter = priorAdapter; globalThis.window = priorWindow;
  globalThis.fetch = priorFetch;
  for (const { transport, method, original } of nativeTransports) transport[method] = original;
}
