import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import './lib/register-simulation-modules.mjs';
import * as engine from '../src/app/games/company-report/_lib/companyReportEngine.js';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const source = read('../src/app/games/company-report/_hooks/useCompanyReportPersistence.js');
const ast = ts.createSourceFile('persistence.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const hook = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'useCompanyReportPersistence');
assert.ok(hook, 'actual production hook exists');
const declarations = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)
  .replace(/^export default /, '').replace(/^export /, '')).join('\n');
const compiled = ts.transpileModule(`${declarations}\nreturn useCompanyReportPersistence(props);`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const guidanceSource = read('../src/app/games/company-report/_components/CompanyReportGuidancePanel.js');
const guidanceAst = ts.createSourceFile('guidance.js', guidanceSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const guidanceDeclarations = guidanceAst.statements.filter(n => ts.isVariableStatement(n)
  || ts.isFunctionDeclaration(n) && n.name?.text === 'normalizeCompanyReportGuidanceLevel')
  .map(n => n.getText(guidanceAst).replace(/^export /, '')).join('\n');
const normalizeGuidance = new Function(`${guidanceDeclarations}\nreturn normalizeCompanyReportGuidanceLevel;`)();
const authSource = read('../src/utils/api.js');
assert.match(authSource, /scope: getAuthScope\(getAnyToken\(\)\), revision: cookieSessionRevision, csrfToken:/);
assert.match(authSource, /current\.revision === session\.revision && current\.csrfToken === session\.csrfToken/);
// Controlled scheduling of the actual hook body, not a mounted React/browser test.
// No network, historical game outputs, real accounts, or persisted user data.
const clone = value => structuredClone(value);
const depsEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const seed = id => engine.createNewState({ runId: id, now: '2026-11-13T00:00:00.000Z' });
let scenarioHarnesses = [];
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness() {
  const h = { slots: [], index: 0, effects: [], dirty: false, active: true, calls: [], events: [], listeners: new Map(),
    token: 'A', user: { _id: 'A' }, session: { scope: 'auth:cookie:A', revision: 1, csrfToken: 'csrf-A' }, state: seed('initial'), guidance: 'outsider' };
  scenarioHarnesses.push(h);
  h.stateRef = { current: h.state }; h.guidanceLevelRef = { current: h.guidance };
  const slot = kind => { const i = h.index++; h.slots[i] ||= { kind }; assert.equal(h.slots[i].kind, kind); return h.slots[i]; };
  const useState = initial => { const s = slot('state'); if (!('value' in s)) s.value = typeof initial === 'function' ? initial() : initial;
    s.set ||= v => { s.value = typeof v === 'function' ? v(s.value) : v; h.events.push(['hook-state']); h.dirty = true; }; return [s.value, s.set]; };
  const useRef = initial => { const s = slot('ref'); return s.ref ||= { current: initial }; };
  const memo = (f, d) => { const s = slot('memo'); if (!s.ready || !depsEqual(s.deps, d)) { s.value = f(); s.deps = d; s.ready = true; } return s.value; };
  const effect = (f, d) => { const s = slot('effect'); if (!s.ready || !depsEqual(s.deps, d)) { s.callback = f; s.deps = d; s.ready = true; h.effects.push(s); } };
  const request = method => (url, body, options) => { const d = deferred(); h.calls.push({ method, url, body: clone(body), options, ...d }); return d.promise; };
  const captureAuthSession = () => ({ ...h.session });
  const isCurrentAuthSession = s => !!s && ['scope', 'revision', 'csrfToken'].every(k => s[k] === h.session[k]);
  h.window = { addEventListener(type, f) { const set = h.listeners.get(type) || new Set(); set.add(f); h.listeners.set(type, set); },
    removeEventListener(type, f) { h.listeners.get(type)?.delete(f); }, dispatchEvent(e) { for (const f of h.listeners.get(e.type) || []) f(e); } };
  const injected = { ...engine, useState, useRef, useEffect: effect, useLayoutEffect: effect,
    useCallback: (f, d) => memo(() => f, d), useMemo: memo, apiGet: request('GET'), apiPost: request('POST'), apiPut: request('PUT'),
    clearApiGetCache: key => h.events.push(['cache', key]), captureAuthSession, isCurrentAuthSession,
    normalizeCompanyReportGuidanceLevel: normalizeGuidance, window: h.window };
  const evaluate = new Function(...Object.keys(injected), 'props', compiled);
  h.render = () => { h.index = 0; h.dirty = false; h.view = evaluate(...Object.values(injected), {
    token: h.token,
    state: h.state, stateRef: h.stateRef, guidanceLevel: h.guidance, guidanceLevelRef: h.guidanceLevelRef,
    score: engine.scoreState(h.state), setState: value => { h.state = typeof value === 'function' ? value(h.stateRef.current) : value; h.stateRef.current = h.state; h.events.push(['state']); h.dirty = true; },
    setGuidanceLevel: value => { h.guidance = value; h.guidanceLevelRef.current = value; h.events.push(['guidance']); },
    setActionResult: text => h.events.push(['message', text]), showToast: value => h.events.push(['toast', value]),
    onLoaded: state => h.events.push(['loaded', state.runId]) });
    for (const s of h.effects.splice(0)) { s.cleanup?.(); s.cleanup = s.callback(); } return h.view; };
  h.edit = id => { h.state = engine.advanceBusinessDayAction(id === 'business' ? h.stateRef.current : seed(id), 1); h.stateRef.current = h.state; };
  h.switchOwner = owner => { if (h.token !== 'cookie-session') h.token = owner; h.user = { _id: owner }; h.session = { scope: `auth:cookie:${owner}`, revision: h.session.revision + 1, csrfToken: `csrf-${owner}-${h.session.revision}` }; h.render(); };
  h.unmount = () => { for (const s of h.slots) s.cleanup?.(); h.active = false; };
  h.strictReplay = () => { for (const s of h.slots.filter(s => s.kind === 'effect')) { s.cleanup?.(); s.cleanup = s.callback(); } };
  h.render(); return h;
}
async function flush(h) { for (let i = 0; i < 6; i++) { await Promise.resolve(); if (h.active && h.dirty) h.render(); } }
// Metadata matches the actual gameSaves mapSave serializer (id/gameSlug/slotKey/version).
const savedList = { saves: [{ slotKey: engine.QUICK_SAVE_SLOT, gameSlug: engine.GAME_SLUG, version: engine.SAVE_VERSION, id: 'save-current' }] };
const detail = id => ({ save: { id: 'save-current', gameSlug: engine.GAME_SLUG, slotKey: engine.QUICK_SAVE_SLOT,
  version: engine.SAVE_VERSION, payload: { state: seed(id), guidanceLevel: 'invalid-guidance' } } });
const resolve = async (h, i, value) => { assert.ok(h.calls[i], `request ${i} exists`); h.calls[i].resolve(value); await flush(h); };
const reject = async (h, i) => { h.calls[i].reject(new Error('controlled failure')); await flush(h); };
let passed = 0; const failures = [];
async function check(name, f) {
  scenarioHarnesses = []; let timer;
  try {
    await Promise.race([f(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('controlled harness scenario timeout (not gameplay timing)')), 3000); })]);
    passed++; console.log(`PASS ${name}`);
  } catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message.split('\n')[0]}`); }
  finally {
    clearTimeout(timer);
    // Release all deferred dependencies, including unexpected detail requests
    // issued by a failing original callback. No real I/O or timer is retained.
    const owned = scenarioHarnesses.slice();
    for (const h of owned) h.unmount();
    for (let round = 0; round < 12; round++) {
      for (const h of owned) for (const call of h.calls) call.resolve({ saves: [] });
      await Promise.resolve();
    }
  }
}

for (const stage of ['list', 'detail']) for (const change of ['business', 'new-run']) await check(`late ${stage} load preserves ${change} stateRef`, async () => {
  const h = harness(); const pending = h.view.loadRun();
  if (stage === 'detail') await resolve(h, 0, savedList);
  h.edit(change); const expected = clone(h.stateRef.current); const before = h.events.filter(e => e[0] !== 'hook-state');
  await resolve(h, stage === 'list' ? 0 : 1, stage === 'list' ? savedList : detail('late'));
  if (stage === 'list' && h.calls[1]) await resolve(h, 1, detail('late'));
  await pending; assert.deepEqual(h.stateRef.current, expected);
  const newEffects = h.events.filter(e => e[0] !== 'hook-state').slice(before.length);
  assert.ok(newEffects.every(e => e[0] === 'message' && /진행|변경/.test(e[1]) && !/불러왔|실패/.test(e[1])),
    'only current-progress preservation notice is allowed; no ledger/load/cache/toast side effects');
  assert.ok(newEffects.some(e => e[0] === 'message' && /진행|변경/.test(e[1])),
    'same-session ledger changes receive an explicit current-progress preservation notice');
  assert.equal(h.view.busy, '', 'retired load releases its own lock');
});
for (const method of ['saveRun', 'recordRun', 'loadRun']) for (const outcome of ['success', 'error']) await check(`${method} stale A-B-A ${outcome}/finally silent`, async () => {
  const h = harness(); h.token = 'cookie-session'; h.render(); const old = h.view[method](); h.switchOwner('B'); h.switchOwner('A');
  assert.equal(h.token, 'cookie-session', 'ABA changes real session snapshot while cookie token marker stays constant');
  const current = h.view.saveRun();
  await flush(h);
  assert.equal(h.view.busy, 'save', 'new request is visibly pending before old response resolves');
  const before = clone(h.events);
  if (outcome === 'error') await reject(h, 0); else await resolve(h, 0, method === 'loadRun' ? savedList : {});
  if (method === 'loadRun' && h.calls.length > 2) await resolve(h, 2, detail('stale'));
  await old; assert.deepEqual(h.events.filter(e => e[0] !== 'hook-state'), before.filter(e => e[0] !== 'hook-state')); assert.equal(h.view.busy, 'save', 'old finally cannot release new busy');
  await resolve(h, 1, {}); await current;
});
for (const retire of ['csrf', 'unmount']) await check(`${retire} retires pending success/error/finally`, async () => {
  for (const outcome of ['success', 'error']) { const h = harness(); const pending = h.view.recordRun();
    if (retire === 'csrf') h.session.csrfToken = 'silently-rotated'; else h.unmount();
    const before = clone(h.events); if (outcome === 'success') await resolve(h, 0, {}); else await reject(h, 0);
    await pending; assert.deepEqual(h.events.filter(e => e[0] !== 'hook-state'), before.filter(e => e[0] !== 'hook-state'), 'no stale product side effects; own busy retirement is allowed'); }
});
await check('queued old rendered handler cannot issue request after owner cycle', async () => {
  const h = harness(); h.token = 'cookie-session'; h.render(); const old = h.view.saveRun; h.switchOwner('B'); h.switchOwner('A');
  assert.equal(h.token, 'cookie-session'); await old(); assert.equal(h.calls.length, 0);
});
for (const first of ['saveRun', 'loadRun', 'recordRun']) for (const second of ['saveRun', 'loadRun', 'recordRun']) await check(`same-render lock ${first}/${second}`, async () => {
  const h = harness(); const a = h.view[first](); const b = h.view[second](); assert.equal(h.calls.length, 1);
  await resolve(h, 0, first === 'loadRun' ? { saves: [] } : {}); await Promise.all([a, b]);
});
for (const method of ['saveRun', 'recordRun']) await check(`${method} reads latest stateRef and matching summary/score/payload`, async () => {
  const h = harness(); const old = h.view[method]; h.edit('latest-without-render'); const expected = clone(h.stateRef.current); const pending = old();
  assert.deepEqual(h.calls[0].body.payload.state, expected); assert.deepEqual(h.calls[0].body.summary, engine.summaryForState(expected));
  if (method === 'recordRun') assert.equal(h.calls[0].body.score, engine.scoreState(expected));
  await resolve(h, 0, {}); await pending;
});
await check('current load commits once with actual normalization and onLoaded/current message', async () => {
  const h = harness(); const pending = h.view.loadRun(); await resolve(h, 0, savedList); await resolve(h, 1, detail('current-loaded')); await pending;
  assert.deepEqual(h.stateRef.current, engine.normalizeState(seed('current-loaded'))); assert.equal(h.guidance, normalizeGuidance('invalid-guidance'));
  assert.equal(h.events.filter(x => x[0] === 'loaded').length, 1); assert.equal(h.events.filter(x => x[0] === 'state').length, 1);
  assert.ok(h.events.some(x => x[0] === 'message' && /불러왔/.test(x[1]))); assert.equal(h.view.busy, '');
});
await check('current failure releases lock and permits retry', async () => {
  const h = harness(); const first = h.view.saveRun(); await reject(h, 0); await first; assert.equal(h.view.busy, '');
  const second = h.view.recordRun(); assert.equal(h.calls.length, 2); await resolve(h, 1, {}); await second;
});
for (const version of ['', undefined]) await check(`legacy ${version === '' ? 'empty' : 'missing'} outer version loads genuine ledger with optional fields absent`, async () => {
  const h = harness(); const pending = h.view.loadRun();
  const list = clone(savedList); if (version === undefined) delete list.saves[0].version; else list.saves[0].version = version;
  await resolve(h, 0, list);
  const response = detail('legacy-real-ledger');
  if (version === undefined) delete response.save.version; else response.save.version = version;
  const legacy = response.save.payload.state;
  delete legacy.company.day; delete legacy.cashFlowPeriod; delete legacy.operatingExpensePeriod;
  delete legacy.capitalMarket.debtRepayments; delete legacy.capitalMarket.nextDebtRepaymentNo; delete legacy.scoreVersion;
  await resolve(h, 1, response); await pending;
  assert.equal(h.stateRef.current.runId, legacy.runId); assert.deepEqual(h.stateRef.current.inventory, legacy.inventory);
  assert.deepEqual(h.stateRef.current.orders, legacy.orders); assert.deepEqual(h.stateRef.current.receivables, legacy.receivables);
  assert.equal(h.stateRef.current.company.cashKrw, legacy.company.cashKrw);
  assert.equal(h.events.filter(e => e[0] === 'loaded').length, 1); assert.equal(h.view.busy, '');
});
for (const invalid of ['missing-state', 'null-state', 'array-state', 'empty-state', 'other-game', 'other-slot', 'other-id', 'other-version']) await check(`invalid detail ${invalid} preserves live ledger`, async () => {
  const h = harness(); const before = clone(h.stateRef.current); const pending = h.view.loadRun(); await resolve(h, 0, savedList);
  const response = detail('invalid-not-to-load');
  if (invalid === 'missing-state') delete response.save.payload.state;
  if (invalid === 'null-state') response.save.payload.state = null;
  if (invalid === 'array-state') response.save.payload.state = [];
  if (invalid === 'empty-state') response.save.payload.state = {};
  if (invalid === 'other-game') response.save.gameSlug = 'primitive-archive';
  if (invalid === 'other-slot') response.save.slotKey = 'another-slot';
  if (invalid === 'other-id') response.save.id = 'another-save';
  if (invalid === 'other-version') response.save.version = 'unsupported-future-version';
  await resolve(h, 1, response); await pending; assert.deepEqual(h.stateRef.current, before);
  assert.equal(h.events.filter(x => x[0] === 'loaded').length, 0); assert.equal(h.view.busy, '');
});
await check('silent csrf rotation recovers on explicit new render/retry; old finally keeps new lock', async () => {
  const h = harness(); const old = h.view.saveRun(); h.session.csrfToken = 'rotated-without-event'; h.render();
  const current = h.view.recordRun(); assert.equal(h.calls.length, 2, 'new session can retry rather than remain permanently busy');
  await reject(h, 0); await old; assert.equal(h.view.busy, 'record', 'retired finally cannot release current request');
  await resolve(h, 1, {}); await current; assert.equal(h.view.busy, '');
});
await check('silent session old-handler click issues no API, refreshes, then fresh explicit retry recovers', async () => {
  const h = harness(); const old = h.view.saveRun;
  h.session.csrfToken = 'silent-csrf-before-click';
  const before = clone(h.events); await old();
  assert.equal(h.calls.length, 0, 'retired rendered handler must not issue a request');
  assert.deepEqual(h.events.filter(e => e[0] !== 'hook-state'), before.filter(e => e[0] !== 'hook-state'),
    'retirement may refresh internal scope, not publish success/error/toast/cache effects');
  assert.ok(h.dirty, 'old handler requests a render to capture the current session');
  h.render(); const fresh = h.view.saveRun(); assert.equal(h.calls.length, 1);
  await resolve(h, 0, {}); await fresh; assert.equal(h.view.busy, '');
});
for (const invalid of ['other-game', 'other-slot', 'unsupported-version']) await check(`invalid list ${invalid} cannot load or replace live ledger`, async () => {
  const h = harness(); const before = clone(h.stateRef.current); const pending = h.view.loadRun(); const list = clone(savedList);
  if (invalid === 'other-game') list.saves[0].gameSlug = 'primitive-archive';
  if (invalid === 'other-slot') list.saves[0].slotKey = 'another-slot';
  if (invalid === 'unsupported-version') list.saves[0].version = 'unsupported-future-version';
  await resolve(h, 0, list);
  assert.equal(h.calls.length, 1, 'incompatible list row must not request its detail');
  await pending; assert.deepEqual(h.stateRef.current, before); assert.equal(h.events.filter(e => e[0] === 'loaded').length, 0);
});
await check('supported list with blank legacy detail version loads same identity valid ledger', async () => {
  const h = harness(); const pending = h.view.loadRun(); await resolve(h, 0, savedList);
  const response = detail('mixed-supported-legacy'); response.save.version = '';
  await resolve(h, 1, response); await pending;
  assert.deepEqual(h.stateRef.current, engine.normalizeState(response.save.payload.state));
  assert.equal(h.events.filter(e => e[0] === 'loaded').length, 1);
  assert.equal(h.view.busy, '');
});
await check('Strict effect cleanup/replay retires old request and activates current handlers', async () => {
  const h = harness(); const old = h.view.saveRun(); h.strictReplay(); h.render(); const before = clone(h.events);
  await resolve(h, 0, {}); await old; assert.deepEqual(h.events.filter(e => e[0] !== 'hook-state'), before.filter(e => e[0] !== 'hook-state'));
  const next = h.view.recordRun(); assert.equal(h.calls.length, 2); await resolve(h, 1, {}); await next; assert.equal(h.view.busy, '');
});
console.log(JSON.stringify({ scope: 'actual hook callbacks/effects under controlled scheduling; not React/browser/account acceptance', passed, failed: failures.length }));
if (failures.length) process.exitCode = 1;
