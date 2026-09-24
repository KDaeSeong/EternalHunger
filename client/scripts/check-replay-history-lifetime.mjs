import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createHandlerHarness, elements, historyStorage, textOf } from './lib/hook-handler-harness.mjs';

const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const componentUrl = new URL('../src/app/simulation/_components/SimulationReplayHistory.js', import.meta.url).href;
const hookUrl = new URL('../src/app/simulation/_components/useObserverMemoryLifetime.js', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url !== componentUrl && url !== hookUrl) return nextLoad(url, context);
  let source = url === componentUrl && process.argv.includes('--baseline')
    ? execFileSync('git', ['show', '944637a7:client/src/app/simulation/_components/SimulationReplayHistory.js'], { encoding: 'utf8' })
    : readFileSync(new URL(url), 'utf8');
  source = source.replaceAll("from 'react'", `from '${harnessUrl}'`)
    .replaceAll("from '../_lib/simulationReplayStorage'", `from '${harnessUrl}'`)
    .replaceAll("from './simulationReplayDeletionRuntime.js'", `from '${harnessUrl}'`);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: History } = await import(componentUrl);
const { createReplayHistoryRequests, replayHistoryMetadata } = await import('../src/app/simulation/_components/simulationReplayHistoryLifetime.js');
const { createObserverMemoryRegistry } = await import('../src/app/simulation/_components/observerMemoryLifetime.js');
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const record = () => ({ id: 'run-a', finishedAt: 123456789, summary: { winnerName: 'fixture', participantCount: 24 },
  input: { runSeed: '1101', privateFixture: {} }, events: Array.from({ length: 5000 }, (_, i) => ({ i })) });
const button = (h, name) => { const list = elements(h.flush(), (node) => node.type === 'button' && textOf(node) === name); assert.equal(list.length, 1, name); return list[0]; };
async function open(props = {}) {
  historyStorage.rows = [replayHistoryMetadata(record())]; historyStorage.list = null; historyStorage.load = async () => record(); historyStorage.deletes = 0;
  const h = createHandlerHarness(History, props); h.flush(); await button(h, '경기 보관함').props.onClick(); h.flush(); return h;
}
await check('closing the real comparison handler releases the full record without deleting it', async () => {
  const h = await open(); await button(h, '비교 기준').props.onClick(); h.flush();
  assert.ok(textOf(h.tree).includes('기준: fixture'));
  button(h, '보관함 닫기').props.onClick(); h.flush();
  assert.equal(h.cells.some((cell) => cell.value?.events?.length === 5000), false);
  await button(h, '경기 보관함').props.onClick(); h.flush();
  assert.ok(textOf(h.tree).includes('기준: 선택 안 함')); assert.equal(historyStorage.deletes, 0); assert.equal(historyStorage.rows.length, 1);
  h.unmount();
});
await check('a pending comparison cannot repopulate a closed dialog', async () => {
  const h = await open(), pending = deferred(); historyStorage.load = () => pending.promise;
  const task = button(h, '비교 기준').props.onClick(); button(h, '보관함 닫기').props.onClick(); h.flush();
  pending.resolve(record()); await task; h.flush();
  assert.equal(h.cells.some((cell) => cell.value?.events), false); h.unmount();
});
for (const [name, callback] of [['동일 재경기', 'onReplay'], ['조건 복사·변경', 'onVariant']]) {
  await check(`closing pending ${name} prevents late navigation`, async () => {
    let calls = 0; const h = await open({ [callback]: () => calls++ }), pending = deferred(); historyStorage.load = () => pending.promise;
    const task = button(h, name).props.onClick(); button(h, '보관함 닫기').props.onClick();
    pending.resolve(record()); await task; h.flush(); assert.equal(calls, 0); h.unmount();
  });
}
await check('a stale completion cannot finish a newer open request', async () => {
  const h = await open(), first = deferred(), second = deferred(); historyStorage.load = () => first.promise;
  const oldTask = button(h, '비교 기준').props.onClick(); button(h, '보관함 닫기').props.onClick(); h.flush();
  historyStorage.list = () => second.promise; const newTask = button(h, '경기 보관함').props.onClick(); h.flush();
  first.resolve(record()); await oldTask; h.flush(); assert.ok(textOf(h.tree).includes('불러오는 중'));
  second.resolve(historyStorage.rows); await newTask; h.flush(); assert.equal(button(h, '비교 기준').props.disabled, false); h.unmount();
});
await check('unmount invalidates pending reads and avoids post-unmount state writes', async () => {
  const h = await open(), pending = deferred(); historyStorage.load = () => pending.promise;
  const task = button(h, '비교 기준').props.onClick(); h.unmount(); pending.resolve(record()); await task;
  assert.equal(h.writesAfterUnmount, 0);
});
await check('same-render duplicate clicks start only one storage read', async () => {
  const h = await open(), pending = deferred(); let reads = 0;
  historyStorage.load = () => { reads++; return pending.promise; };
  const handler = button(h, '비교 기준').props.onClick; const a = handler(), b = handler(); assert.equal(reads, 1);
  pending.resolve(record()); await Promise.all([a, b]); h.unmount();
});
await check('storage errors release busy state and allow a retry', async () => {
  const h = await open(); historyStorage.load = async () => { throw new Error('fixture read failed'); };
  await button(h, '비교 기준').props.onClick(); h.flush(); assert.ok(textOf(h.tree).includes('fixture read failed'));
  assert.equal(button(h, '비교 기준').props.disabled, false); h.unmount();
});
await check('normal replay navigation still forwards the exact archive', async () => {
  let received; const h = await open({ onReplay: (value) => { received = value; } }), original = record();
  historyStorage.load = async () => original; await button(h, '동일 재경기').props.onClick(); assert.equal(received, original); h.unmount();
});
await check('both sides of a comparison are released, not just the baseline', async () => {
  const h = await open(), other = { ...record(), id: 'run-b' };
  historyStorage.rows = [...historyStorage.rows, replayHistoryMetadata(other)];
  await button(h, '경기 보관함').props.onClick(); h.flush();
  historyStorage.load = async (id) => id === 'run-b' ? other : record();
  await elements(h.tree, (node) => node.type === 'button' && textOf(node) === '비교 기준')[0].props.onClick(); h.flush();
  await elements(h.tree, (node) => node.type === 'button' && textOf(node) === '비교 대상')[1].props.onClick(); h.flush();
  assert.equal(h.cells.filter((cell) => cell.value?.events?.length === 5000).length, 2);
  button(h, '보관함 닫기').props.onClick(); h.flush();
  assert.equal(h.cells.filter((cell) => cell.value?.events?.length === 5000).length, 0); assert.equal(historyStorage.rows.length, 2); h.unmount();
});
await check('normal variant navigation forwards the exact archive without changing it', async () => {
  let received; const h = await open({ onVariant: (value) => { received = value; } }), original = record(), before = structuredClone(original);
  historyStorage.load = async () => original; await button(h, '조건 복사·변경').props.onClick();
  assert.equal(received, original); assert.deepEqual(original, before); h.unmount();
});
await check('metadata for an unsaved run contains neither input nor event graph', () => {
  const original = record(), summary = replayHistoryMetadata(original);
  assert.deepEqual(Object.keys(summary), ['id', 'finishedAt', 'summary', 'runSeed', 'unavailable']);
  assert.equal(summary.runSeed, '1101'); assert.notEqual(summary.summary, original.summary);
});
await check('closing a pending list ignores its later success and error', async () => {
  for (const failure of [false, true]) {
    const h = await open(), pending = deferred();
    button(h, '보관함 닫기').props.onClick(); historyStorage.list = () => pending.promise;
    const task = button(h, '경기 보관함').props.onClick(); button(h, '보관함 닫기').props.onClick();
    if (failure) pending.reject(new Error('late error')); else pending.resolve(historyStorage.rows);
    await task; h.flush(); assert.equal(elements(h.tree, (node) => node.props?.role === 'dialog').length, 0);
    assert.equal(h.cells.some((cell) => cell.value === 'late error'), false); h.unmount();
  }
});
await check('closing evaluation preparation does not start an unwanted evaluation', async () => {
  historyStorage.rows = []; const pending = deferred(); historyStorage.list = () => pending.promise;
  const h = createHandlerHarness(History, { evaluationMode: true, evaluationOpenRequest: 1, evaluationRunRecord: record() });
  h.flush(); button(h, '보관함 닫기').props.onClick(); h.flush(); pending.resolve([]); await settle(); h.flush();
  assert.equal(elements(h.tree, (node) => node.props?.role === 'dialog').length, 0);
  assert.equal(h.cells.some((cell) => cell.value?.status === 'in_progress'), false); h.unmount();
});
await check('evaluation fallback is metadata-only and closing preserves an unsaved draft', async () => {
  // Synthetic Node-only storage, never an evaluator's browser or human scores.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map(); let failWrites = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error('synthetic quota'); values.set(key, value); },
  } });
  try {
    historyStorage.list = null; historyStorage.rows = [];
    const h = createHandlerHarness(History, { evaluationMode: true, evaluationOpenRequest: 1, evaluationRunRecord: record() });
    h.flush(); await settle(); h.flush();
    const lists = h.cells.filter((cell) => Array.isArray(cell.value)).map((cell) => cell.value);
    assert.ok(lists.some((rows) => rows[0]?.id === 'run-a' && rows[0]?.runSeed === '1101'));
    assert.equal(lists.some((rows) => rows[0]?.events), false);
    failWrites = true;
    const textarea = elements(h.tree, (node) => node.type === 'textarea')[0];
    textarea.props.onChange({ target: { value: 'synthetic unsaved draft' } }); h.flush();
    button(h, '보관함 닫기').props.onClick(); h.flush();
    await button(h, '설문·경기 기록').props.onClick(); h.flush();
    assert.equal(elements(h.tree, (node) => node.type === 'textarea')[0].props.value, 'synthetic unsaved draft');
    h.unmount();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;
  }
});
await check('generation tokens reject stale success, failure, and finally work', () => {
  const gate = createReplayHistoryRequests(), a = gate.begin(); assert.equal(gate.begin(), null);
  gate.cancel(); const b = gate.begin(); assert.equal(gate.isCurrent(a), false); assert.equal(gate.finish(a), false);
  assert.equal(gate.isCurrent(b), true); assert.equal(gate.finish(b), true); assert.equal(gate.isCurrent(b), false);
});
await check('weak diagnostics distinguish unobserved GC from collection and stay bounded', () => {
  const weak = []; class FakeWeakRef { constructor(target) { this.target = target; weak.push(this); } deref() { return this.target; } }
  const registry = createObserverMemoryRegistry({ WeakRefType: FakeWeakRef });
  const owner = registry.open('session'); owner.watch({ journal: {} }); owner.close();
  assert.equal(registry.snapshot().owners[0].targets[0].state, 'reachable_or_not_yet_collected');
  weak[0].target = undefined; assert.equal(registry.snapshot().owners[0].targets[0].state, 'collected');
  owner.watch({ extra: {} }); assert.equal(registry.snapshot().owners[0].targets.length, 1);
  for (let i = 0; i < 20; i++) registry.open('history');
  assert.equal(registry.snapshot().owners.length, 12); assert.equal(registry.snapshot().evictedOwners, 9);
  const bounded = registry.open('bounded'); for (let i = 0; i < 50; i++) bounded.watch({ [`key${i}`]: {} });
  assert.equal(registry.snapshot().owners.at(-1).targets.length, 8);
  const unsupported = createObserverMemoryRegistry({ WeakRefType: null }); unsupported.open('session').watch({ a: {} });
  assert.equal(unsupported.snapshot().supported, false); assert.equal(unsupported.snapshot().owners.length, 0);
});
await check('the real WeakRef diagnostic does not keep observed object graphs alive (Node GC only)', async () => {
  assert.equal(typeof globalThis.gc, 'function', 'Run this check with --expose-gc');
  const registry = createObserverMemoryRegistry(), owner = registry.open('session');
  (() => { const target = { events: new Array(10000).fill('fixture') }; owner.watch({ journal: target }); })();
  owner.close(); await settle(); globalThis.gc(); await settle();
  assert.equal(registry.snapshot().owners[0].targets[0].state, 'collected');
});
console.log(`Replay history / memory lifetime checks: ${passed}`);
