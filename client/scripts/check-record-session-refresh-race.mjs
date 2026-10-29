import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import ts from 'typescript';

const apiPath = new URL('../src/utils/api.js', import.meta.url);
const authPath = new URL('../src/utils/auth-session.js', import.meta.url);
const hookPath = new URL('../src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js', import.meta.url);
const authSource = readFileSync(authPath, 'utf8');
const authUrl = `data:text/javascript;base64,${Buffer.from(authSource).toString('base64')}`;
const apiSource = readFileSync(apiPath, 'utf8')
  .replace("import axios from 'axios';", 'const axios = (...args) => globalThis.__recordRaceAxios(...args);')
  .replace("from './auth-session';", `from '${authUrl}';`);
const apiUrl = `data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`;
const dataUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
globalThis.window = {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  dispatchEvent() {},
  location: { hostname: 'archive.test', origin: 'https://archive.test', protocol: 'https:' },
};
globalThis.document = { cookie: 'eh_csrf=csrf-fixture' };
globalThis.fetch = async () => ({ ok: true, status: 204 });
process.env.NEXT_PUBLIC_API_BASE = 'https://archive.test/api';

const jsxStub = `
  export function useState(initial) { return [initial, () => {}]; }
  export function useRef(initial) { return { current: initial }; }
`;
const checkpointStub = `export function isValidRunState() { return true; }`;
const engineStub = `
  export const GAME_SLUG = 'primitive-archive';
  export const QUICK_SAVE_SLOT = 'quick';
  export const SAVE_VERSION = 1;
  export const getPlayTimeSec = () => 12;
  export const normalizeState = (value) => value;
  export const runRecordStatus = () => ({ canRecord: true, label: '완주', result: 'clear' });
  export const scoreState = () => 120;
  export const summaryForState = () => ({ day: 12 });
`;
const rewardsStub = `export const archiveAccountRewardMessage = (receipt) => receipt?.status || '';`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === hookPath.href) {
      if (specifier === 'react') return { url: dataUrl(jsxStub), shortCircuit: true };
      if (specifier === '../../../../utils/api') return { url: apiUrl, shortCircuit: true };
      if (specifier === '../_lib/primitiveArchiveCheckpoint') return { url: dataUrl(checkpointStub), shortCircuit: true };
      if (specifier === '../_lib/primitiveArchiveEngine') return { url: dataUrl(engineStub), shortCircuit: true };
      if (specifier === '../_lib/primitiveArchiveAccountRewards') return { url: dataUrl(rewardsStub), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== hookPath.href) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(hookPath, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});

const api = await import(apiUrl);
const { default: invokePersistence } = await import(hookPath.href);
const checks = [];

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(user = { id: 'account-a', username: 'a', lp: 10, credits: 20 }) {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie = 'eh_csrf=csrf-fixture';
  api.saveAuth(undefined, user);
  const latestStateRef = { current: { runId: 'run-original', day: 12, ended: true, victory: true } };
  const writes = { toasts: [], actionResults: [] };
  const hook = invokePersistence({
    latestStateRef,
    state: latestStateRef.current,
    token: 'cookie-session',
    setActionResult: (value) => writes.actionResults.push(value),
    setNewRunDifficulty() {},
    setState() {},
    replaceRun() {},
    showToast: (value) => writes.toasts.push(value),
  });
  return { hook, latestStateRef, writes };
}

function receiptResponse() {
  return { data: {
    replayed: false,
    record: { id: 'record-a' },
    rewards: { status: 'awarded', lp: 500, credits: 1000, tier: 'basic' },
    userProgress: { lp: 510, credits: 1020 },
  }, status: 201, headers: {} };
}

async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

await check('same-account SessionSync refresh first does not discard the delayed real record-hook receipt', async () => {
  const { hook, writes } = harness();
  const record = deferred();
  const refresh = deferred();
  globalThis.__recordRaceAxios = ({ url }) => url.endsWith('/auth/session') ? refresh.promise : record.promise;
  const recordRequest = hook.recordRun();
  const syncRequest = api.refreshStoredAuthSession();
  refresh.resolve({ data: { user: { ...api.getUser(), nickname: 'updated profile' } }, status: 200, headers: {} });
  assert.equal(await syncRequest, true);
  record.resolve(receiptResponse());
  await recordRequest;
  assert.equal(writes.toasts.length, 1);
  assert.equal(api.getUser().lp, 510);
  assert.equal(api.getUser().credits, 1020);
});

await check('record receipt first makes the later same-account SessionSync response stale', async () => {
  const { hook, writes } = harness();
  const record = deferred();
  const refresh = deferred();
  globalThis.__recordRaceAxios = ({ url }) => url.endsWith('/auth/session') ? refresh.promise : record.promise;
  const recordRequest = hook.recordRun();
  const syncRequest = api.refreshStoredAuthSession();
  record.resolve(receiptResponse());
  await recordRequest;
  assert.equal(api.getUser().lp, 510);
  refresh.resolve({ data: { user: { id: 'account-a', username: 'a', lp: 10, credits: 20 } }, status: 200, headers: {} });
  assert.equal(await syncRequest, false);
  assert.equal(api.getUser().lp, 510);
  assert.equal(writes.toasts.length, 1);
});

await check('an accepted receipt retires a pending profile refresh even when its balance is unchanged', async () => {
  const currentUser = { id: 'account-a', username: 'a', lp: 200, credits: 40 };
  const { hook, writes } = harness(currentUser);
  const record = deferred();
  const refresh = deferred();
  globalThis.__recordRaceAxios = ({ url }) => url.endsWith('/auth/session') ? refresh.promise : record.promise;
  const recordRequest = hook.recordRun();
  const syncRequest = api.refreshStoredAuthSession();
  record.resolve({ data: {
    replayed: false,
    record: { id: 'record-a' },
    rewards: { status: 'awarded', lp: 500, credits: 1000, tier: 'basic' },
    userProgress: { lp: 200, credits: 40 },
  }, status: 201, headers: {} });
  await recordRequest;
  refresh.resolve({ data: { user: { ...currentUser, lp: 50, credits: 10 } }, status: 200, headers: {} });
  assert.equal(await syncRequest, false);
  assert.equal(api.getUser().lp, 200);
  assert.equal(api.getUser().credits, 40);
  assert.equal(writes.toasts.length, 1);
});

await check('a refresh that reports a different user is an authentication boundary', async () => {
  const { hook, writes } = harness();
  const record = deferred();
  globalThis.__recordRaceAxios = ({ url }) => url.endsWith('/auth/session')
    ? Promise.resolve({ data: { user: { id: 'account-b', username: 'b', lp: 0, credits: 0 } }, status: 200, headers: {} })
    : record.promise;
  const pendingRecord = hook.recordRun();
  assert.equal(await api.refreshStoredAuthSession(), true);
  record.resolve(receiptResponse());
  await pendingRecord;
  assert.equal(api.getUser().id, 'account-b');
  assert.equal(writes.toasts.length, 0);
});

await check('a profile patch that changes user identity advances the auth boundary', async () => {
  harness();
  const before = api.captureAuthSession();
  assert.equal(api.updateStoredUser({ id: 'account-b', username: 'b' }).id, 'account-b');
  assert.equal(api.isCurrentAuthSession(before), false);
  assert.equal(api.getUser().id, 'account-b');
});

for (const [name, invalidate] of [
  ['same-account explicit relogin', () => api.saveAuth(undefined, api.getUser())],
  ['other-account switch', () => api.saveAuth(undefined, { id: 'account-b', username: 'b', lp: 0, credits: 0 })],
  ['logout', () => api.clearAuth()],
  ['CSRF renewal', () => { document.cookie = 'eh_csrf=csrf-renewed'; }],
  ['new-run transition', (harnessState) => { harnessState.latestStateRef.current = { runId: 'run-new', day: 1 }; }],
]) {
  await check(`${name} still discards the delayed record response`, async () => {
    const state = harness();
    const record = deferred();
    globalThis.__recordRaceAxios = () => record.promise;
    const pending = state.hook.recordRun();
    invalidate(state);
    const expectedUser = structuredClone(api.getUser());
    record.resolve(receiptResponse());
    await pending;
    assert.equal(state.writes.toasts.length, 0);
    assert.deepEqual(api.getUser(), expectedUser);
    assert.equal(state.writes.actionResults.length, 0);
  });
}

assert.equal(checks.length, 10);
console.log(`Record/session refresh race checks passed: ${checks.length}/10. Actual api.js and persistence hook; synthetic HTTP/storage only.`);
