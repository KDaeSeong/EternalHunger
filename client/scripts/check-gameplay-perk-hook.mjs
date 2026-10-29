import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { GAMEPLAY_PERK_CODES, GAMEPLAY_PERK_PRODUCTS, activeGameplayPerkProducts, normalizeGameplayPerkAccount } from '../src/utils/gameplayPerks.js';

const require = createRequire(import.meta.url);
const { DEFAULT_PUBLIC_PERKS } = require('../../server/utils/defaultPerks.js');
const hookUrl = new URL('../src/hooks/useGameplayPerks.js', import.meta.url).href;
const reactUrl = `data:text/javascript,${encodeURIComponent(`
const host = () => globalThis.__gameplayPerkReactHost;
export const useState = (initial) => host().useState(initial);
export const useRef = (initial) => host().useRef(initial);
export const useEffect = (effect, deps) => host().useEffect(effect, deps);
`)}`;
const apiUrl = `data:text/javascript,${encodeURIComponent(`
const api = () => globalThis.__gameplayPerkApi;
export const AUTH_SYNC_EVENT = 'eh:auth-sync';
export const apiGet = (...args) => api().apiGet(...args);
export const captureAuthSession = () => api().captureAuthSession();
export const getToken = () => api().getToken();
export const getUser = () => api().getUser();
export const isCurrentAuthSession = (session) => api().isCurrentAuthSession(session);
`)}`;

registerHooks({
  load(url, context, nextLoad) {
    if (url !== hookUrl) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8')
      .replace("from 'react'", `from "${reactUrl}"`)
      .replace("from '../utils/api'", `from "${apiUrl}"`);
    return { format: 'module', shortCircuit: true, source };
  },
});

const { default: invokeGameplayPerks } = await import(hookUrl);
const {
  CAREFUL_GATHER,
  RESEARCH_NOTES,
  START_SPONSOR,
} = GAMEPLAY_PERK_CODES;
const activeRows = DEFAULT_PUBLIC_PERKS.filter((perk) => perk.isActive === true);
const archiveRows = activeRows.filter((perk) => perk.effects?.gameSlug === 'primitive-archive');

function user(id, patch = {}) {
  return {
    id,
    _id: id,
    username: id,
    lp: 500,
    perks: [CAREFUL_GATHER, RESEARCH_NOTES],
    perkLoadouts: { 'primitive-archive': [CAREFUL_GATHER, RESEARCH_NOTES], 'eternal-hunger': [] },
    ...patch,
  };
}

function payload(account, perks = archiveRows) {
  return { perks: structuredClone(perks), user: structuredClone(account) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function makeApi(initialUser = null) {
  const requests = [];
  const auth = {
    user: initialUser,
    token: initialUser ? 'cookie-session' : null,
    session: { scope: initialUser ? `auth:${initialUser.id}` : 'anon', revision: 1, csrfToken: 'csrf-1' },
  };
  globalThis.__gameplayPerkApi = {
    requests,
    auth,
    storedUserWrites: 0,
    apiGet(path, options) {
      assert.equal(path, '/perks/available', 'The hook must use the live, uncached available-perks endpoint.');
      requests.push({ path, options, deferred: deferred() });
      return requests.at(-1).deferred.promise;
    },
    getUser: () => auth.user,
    getToken: () => auth.token,
    captureAuthSession: () => ({ ...auth.session }),
    isCurrentAuthSession: (session) => session?.scope === auth.session.scope
      && session?.revision === auth.session.revision && session?.csrfToken === auth.session.csrfToken,
  };
  return globalThis.__gameplayPerkApi;
}

function makeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
  };
}

function sameDeps(a, b) { return a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }

function makeHost(gameSlug = 'primitive-archive') {
  let result;
  const host = {
    cells: [], cursor: 0, effects: [], dirty: true, mounted: true, writesAfterUnmount: 0, window: makeWindow(),
    useState(initial) {
      const index = this.cursor++;
      const cell = this.cells[index] ||= { kind: 'state', value: typeof initial === 'function' ? initial() : initial };
      cell.set ||= (next) => {
        if (!this.mounted) { this.writesAfterUnmount += 1; return; }
        cell.value = typeof next === 'function' ? next(cell.value) : next;
        this.dirty = true;
      };
      return [cell.value, cell.set];
    },
    useRef(initial) {
      const index = this.cursor++;
      const cell = this.cells[index] ||= { kind: 'ref', value: { current: initial } };
      return cell.value;
    },
    useEffect(effect, deps) {
      const index = this.cursor++;
      const cell = this.cells[index] ||= { kind: 'effect' };
      if (!sameDeps(cell.deps, deps)) {
        this.effects.push(() => {
          cell.cleanup?.();
          cell.deps = deps;
          cell.effect = effect;
          cell.cleanup = effect();
        });
      }
    },
    render() {
      this.cursor = 0;
      this.effects = [];
      this.dirty = false;
      globalThis.__gameplayPerkReactHost = this;
      try { result = invokeGameplayPerks(gameSlug); } finally { globalThis.__gameplayPerkReactHost = null; }
      this.effects.forEach((effect) => effect());
      return result;
    },
    flush() {
      let count = 0;
      while (this.dirty) {
        assert.ok(++count < 30, 'Hook state updates must settle without a render loop.');
        this.render();
      }
      return result;
    },
    strictEffectReplay() {
      for (const cell of this.cells) {
        if (cell.kind !== 'effect' || typeof cell.effect !== 'function') continue;
        cell.cleanup?.();
        cell.cleanup = cell.effect();
      }
    },
    unmount() {
      this.mounted = false;
      for (const cell of this.cells) cell.cleanup?.();
    },
    get result() { return result; },
  };
  return host;
}

function withWindow(host, callback) {
  const previous = globalThis.window;
  globalThis.window = host.window;
  try { return callback(); } finally { globalThis.window = previous; }
}

async function settle(host) {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
    withWindow(host, () => host.flush());
  }
}

function mount(api, gameSlug) {
  const host = makeHost(gameSlug);
  withWindow(host, () => host.flush());
  return { host, api };
}

function resolveRequest(api, index, response) { api.requests[index].deferred.resolve(response); }
function changeAccount(host, api, account) {
  api.auth.user = account;
  api.auth.token = account ? 'cookie-session' : null;
  api.auth.session = { scope: account ? `auth:${account.id}` : 'anon', revision: api.auth.session.revision + 1, csrfToken: `csrf-${api.auth.session.revision + 1}` };
  host.window.dispatchEvent({ type: 'eh:auth-sync', detail: { reason: 'test-account-change' } });
  withWindow(host, () => host.flush());
}

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
}

await check('shared static product and server contract agree on all gameplay codes, costs and effects', async () => {
  const clientByCode = new Map(GAMEPLAY_PERK_PRODUCTS.map((product) => [product.code, product]));
  const serverByCode = new Map(DEFAULT_PUBLIC_PERKS.map((product) => [product.code, product]));
  const gameplayCodes = Object.values(GAMEPLAY_PERK_CODES);
  for (const code of gameplayCodes) {
    const client = clientByCode.get(code);
    const server = serverByCode.get(code);
    assert.ok(client && server, `Both contracts include ${code}.`);
    assert.equal(client.lpCost, server.lpCost);
    assert.deepEqual(client.effects, server.effects);
  }
  const valid = activeGameplayPerkProducts(archiveRows, 'primitive-archive');
  assert.deepEqual(valid.map((product) => product.code), [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.equal(normalizeGameplayPerkAccount(payload(user('contract-user')), 'primitive-archive').equippedCodes.length, 2);
});

await check('guest sees the static game catalog, makes no request, and captures no account perk', async () => {
  const api = makeApi(null);
  const { host } = mount(api);
  await settle(host);
  assert.equal(host.result.status, 'guest');
  assert.deepEqual(host.result.products.map((product) => product.code), [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.deepEqual(await host.result.captureForNewRun(), []);
  assert.equal(api.requests.length, 0);
  host.unmount();
});

await check('ready state filters server products by active exact contract and owned equipped game codes', async () => {
  const account = user('perk-owner', { perks: [CAREFUL_GATHER, RESEARCH_NOTES, START_SPONSOR, 'UNKNOWN'] });
  const api = makeApi(account);
  const { host } = mount(api);
  const inactive = { ...archiveRows[0], isActive: false };
  const badEffect = { ...archiveRows[1], effects: { ...archiveRows[1].effects, amount: 99 } };
  const mixedRows = [...archiveRows, inactive, badEffect, DEFAULT_PUBLIC_PERKS.find((row) => row.code === START_SPONSOR)];
  resolveRequest(api, 0, payload(account, mixedRows));
  await settle(host);
  assert.equal(host.result.status, 'ready');
  assert.deepEqual(host.result.products.map((product) => product.code), [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.deepEqual(host.result.ownedCodes, [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.deepEqual(host.result.equippedCodes, [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.equal(api.storedUserWrites, 0, 'The hook never writes the response wallet/profile back into auth storage.');
  host.unmount();
});

await check('new-run capture always performs a fresh GET, while explicit without-perks and guest paths do not', async () => {
  const account = user('capture-owner');
  const api = makeApi(account);
  const { host } = mount(api);
  resolveRequest(api, 0, payload(account));
  await settle(host);
  const capture = host.result.captureForNewRun();
  assert.equal(api.requests.length, 2, 'Capture must refresh current server ownership and loadout without GET caching.');
  resolveRequest(api, 1, payload(account));
  assert.deepEqual(await capture, [CAREFUL_GATHER, RESEARCH_NOTES]);
  assert.deepEqual(await host.result.captureForNewRun({ withoutPerks: true }), []);
  assert.equal(api.requests.length, 2);
  host.unmount();
});

await check('same-account wallet edits do not refetch, but selected or owned signature changes do', async () => {
  const account = user('signature-owner');
  const api = makeApi(account);
  const { host } = mount(api);
  resolveRequest(api, 0, payload(account));
  await settle(host);
  api.auth.user = { ...api.auth.user, lp: 700 };
  host.window.dispatchEvent({ type: 'eh:auth-sync', detail: { reason: 'wallet-only' } });
  withWindow(host, () => host.flush());
  assert.equal(api.requests.length, 1, 'Unrelated profile/wallet changes do not trigger endpoint loops.');
  const changed = user('signature-owner', { perks: [CAREFUL_GATHER], perkLoadouts: { 'primitive-archive': [CAREFUL_GATHER] } });
  api.auth.user = changed;
  host.window.dispatchEvent({ type: 'eh:auth-sync', detail: { reason: 'loadout-changed' } });
  withWindow(host, () => host.flush());
  assert.equal(api.requests.length, 2);
  resolveRequest(api, 1, payload(changed));
  await settle(host);
  assert.deepEqual(host.result.equippedCodes, [CAREFUL_GATHER]);
  host.unmount();
});

await check('late account A response cannot overwrite account B after identity and session change', async () => {
  const accountA = user('account-A');
  const accountB = user('account-B', { perks: [RESEARCH_NOTES], perkLoadouts: { 'primitive-archive': [RESEARCH_NOTES] } });
  const api = makeApi(accountA);
  const { host } = mount(api);
  changeAccount(host, api, accountB);
  assert.equal(api.requests.length, 2, 'The account change starts a fresh B request.');
  assert.equal(host.result.status, 'loading');
  assert.deepEqual(host.result.equippedCodes, [RESEARCH_NOTES], 'B never renders A\'s previous selected codes while loading.');
  resolveRequest(api, 1, payload(accountB));
  await settle(host);
  assert.equal(host.result.status, 'ready');
  assert.deepEqual(host.result.ownedCodes, [RESEARCH_NOTES]);
  resolveRequest(api, 0, payload(accountA));
  await settle(host);
  assert.deepEqual(host.result.ownedCodes, [RESEARCH_NOTES]);
  assert.deepEqual(host.result.equippedCodes, [RESEARCH_NOTES]);
  host.unmount();
});

await check('response identity mismatch fails closed instead of granting a different account loadout', async () => {
  const accountA = user('request-owner-A');
  const accountB = user('response-owner-B', { perks: [RESEARCH_NOTES], perkLoadouts: { 'primitive-archive': [RESEARCH_NOTES] } });
  const api = makeApi(accountA);
  const { host } = mount(api);
  resolveRequest(api, 0, payload(accountB));
  await settle(host);
  assert.equal(host.result.status, 'error');
  assert.deepEqual(await host.result.captureForNewRun({ withoutPerks: true }), []);
  assert.deepEqual(host.result.equippedCodes, []);
  host.unmount();
});

await check('repeated explicit refreshes are uncached and the newest request wins by epoch', async () => {
  const initial = user('epoch-owner');
  const api = makeApi(initial);
  const { host } = mount(api);
  const older = host.result.refresh().catch((error) => error);
  const newer = host.result.refresh();
  assert.equal(api.requests.length, 3, 'Mount and both explicit refresh calls each make a live GET.');
  const next = user('epoch-owner', { perks: [RESEARCH_NOTES], perkLoadouts: { 'primitive-archive': [RESEARCH_NOTES] } });
  resolveRequest(api, 2, payload(next));
  await newer;
  await settle(host);
  resolveRequest(api, 1, payload(initial));
  await older;
  resolveRequest(api, 0, payload(initial));
  await settle(host);
  assert.deepEqual(host.result.ownedCodes, [RESEARCH_NOTES]);
  host.unmount();
});

await check('StrictMode effect replay reuses the in-flight automatic refresh instead of duplicating it', async () => {
  const account = user('strict-owner');
  const api = makeApi(account);
  const { host } = mount(api);
  withWindow(host, () => host.strictEffectReplay());
  assert.equal(api.requests.length, 1);
  resolveRequest(api, 0, payload(account));
  await settle(host);
  assert.equal(host.result.status, 'ready');
  host.unmount();
});

await check('unmounted request cannot write hook state and endpoint errors reject new-run capture', async () => {
  const account = user('unmount-owner');
  const api = makeApi(account);
  const mounted = mount(api);
  mounted.host.unmount();
  resolveRequest(api, 0, payload(account));
  await settle(mounted.host);
  assert.equal(mounted.host.writesAfterUnmount, 0);

  const failedApi = makeApi(user('failed-owner'));
  const failed = mount(failedApi);
  failedApi.requests[0].deferred.reject(new Error('offline fixture'));
  await settle(failed.host);
  assert.equal(failed.host.result.status, 'error');
  const failedCapture = failed.host.result.captureForNewRun();
  assert.equal(failedApi.requests.length, 2, 'An explicit capture retries and reports failure instead of granting an unverified perk.');
  failedApi.requests[1].deferred.reject(new Error('offline fixture'));
  await assert.rejects(failedCapture, /offline fixture/);
  failed.host.unmount();
});

console.log(`\n${checks} gameplay-perk hook checks passed.`);
