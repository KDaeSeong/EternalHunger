import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';
import { defaultHungerConfig } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { createHungerPack, restoreHungerPackAsync } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { createHungerRun, advanceHungerRun } from '../src/app/hungergames/_lib/hungerGameRuntime.js';

const root = new URL('../', import.meta.url);
const pageUrl = new URL('src/app/hungergames/page.js', root).href;
const rosterUrl = new URL('src/app/hungergames/_components/HungerRosterEditor.js', root).href;
const hooksUrl = new URL('scripts/lib/hook-handler-harness.mjs', root).href;
const rosterType = () => null, eventType = () => null, viewerType = () => null;
const moduleSource = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
globalThis.__hgOwnershipCheck = { rosterType, eventType, viewerType };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ([pageUrl, rosterUrl].includes(context.parentURL)) {
      if (specifier === 'react') return moduleSource(`export {useState,useRef,useEffect,useEffect as useLayoutEffect} from ${JSON.stringify(hooksUrl)};`);
      if (specifier.endsWith('.module.css')) return moduleSource('export default new Proxy({}, {get: (_, key) => String(key)});');
      if (specifier === 'next/link' || specifier === 'next/image' || specifier.endsWith('/SiteHeader') || specifier.endsWith('/HungerTraitFields')) {
        return moduleSource('export default function Boundary() { return null; }');
      }
      if (specifier.endsWith('/utils/previewImage')) return moduleSource('export const readCompressedPreviewImage=(...args)=>globalThis.__hgOwnershipCheck.photo(...args);');
      if (specifier.endsWith('/utils/api')) return moduleSource(`
        export const AUTH_SYNC_EVENT='eh:auth-sync';
        export const getToken=()=>globalThis.__hgOwnershipCheck.owner ? 'cookie-session' : null;
        export const captureAuthSession=()=>({scope:globalThis.__hgOwnershipCheck.owner ? 'owner:'+globalThis.__hgOwnershipCheck.owner : 'anon',revision:globalThis.__hgOwnershipCheck.authRevision});
        export const isCurrentAuthSession=session=>session.scope===captureAuthSession().scope&&session.revision===captureAuthSession().revision;
        export const apiGet=(...args)=>globalThis.__hgOwnershipCheck.get(...args);
        export const apiPut=(...args)=>globalThis.__hgOwnershipCheck.put(...args);`);
      if (context.parentURL === pageUrl) {
        for (const [name, key] of [['HungerRosterEditor', 'rosterType'], ['HungerEventEditor', 'eventType'], ['HungerRunViewer', 'viewerType']]) {
          if (specifier.endsWith('/' + name)) return moduleSource(`export default globalThis.__hgOwnershipCheck.${key};`);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (![pageUrl, rosterUrl].includes(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Page } = await import(pageUrl);
const { default: Roster } = await import(rosterUrl);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
const button = (app, label) => elements(app.tree, node => node.type === 'button' && textOf(node) === label)[0];
const child = (app, type) => elements(app.tree, node => node.type === type)[0]?.props;
const roster = app => child(app, rosterType);
const events = app => child(app, eventType);
const imported = (name = '가져온 참가자') => {
  const config = defaultHungerConfig(); config.roster[0] = { ...config.roster[0], name, previewImage: '' };
  const raw = JSON.stringify(createHungerPack(config));
  return { size: new TextEncoder().encode(raw).length, text: async () => raw };
};
async function mount(stored = null, finishBootstrap = true) {
  let timerId = 0; const timers = new Map(), listeners = new Map();
  const state = globalThis.__hgOwnershipCheck;
  Object.assign(state, { owner: 'A', authRevision: 0, get: () => { throw Error('Unexpected synthetic GET'); },
    put: () => { throw Error('Unexpected synthetic PUT'); }, photo: () => { throw Error('Unexpected photo read'); } });
  const originals = { window: globalThis.window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const memory = { stored, writes: [], confirms: 0 };
  const schedule = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  globalThis.window = { setTimeout: schedule, clearTimeout: id => timers.delete(id),
    localStorage: { getItem: () => memory.stored, setItem: (key, value) => { memory.writes.push({ key, value }); memory.stored = value; } },
    confirm: () => { memory.confirms += 1; return true; },
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn) };
  globalThis.setTimeout = schedule; globalThis.clearTimeout = id => timers.delete(id);
  const app = createHandlerHarness(Page, {}); app.flush();
  const draw = async () => { await settle(); app.flush(); };
  if (finishBootstrap) await draw();
  return Object.assign(app, { memory, timers, state, draw,
    tab(label) { button(app, label).props.onClick(); app.flush(); },
    auth(owner, signal = false) { state.owner = owner; state.authRevision += 1; if (signal) for (const fn of listeners.get('eh:auth-sync') || []) fn(); app.flush(); },
    async import(file) { elements(app.tree, node => node.type === 'input' && node.props.type === 'file')[0].props.onChange({ target: { files: [file] } }); await draw(); },
    dispose() { app.unmount(); Object.assign(globalThis, originals); },
  });
}
let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log('PASS ' + name); };
const actor = name => [{ id: 'account-actor', name, hungerTraits: [], items: [] }];

await check('initial cooperative restoration blocks hidden import and configuration handlers until ready', async () => {
  const config = defaultHungerConfig(); let run = createHungerRun(config); run = advanceHungerRun(advanceHungerRun(run));
  const app = await mount(JSON.stringify(createHungerPack(config, run)), false);
  try {
    assert.equal(button(app, '참가자').props.disabled, true);
    const seed = elements(app.tree, node => node.type === 'input' && node.props.maxLength === 120)[0];
    seed.props.onChange({ target: { value: 'stale-before-ready' } });
    await app.import(imported());
    assert.equal(app.memory.confirms, 0); assert.equal(button(app, '참가자').props.disabled, true);
    for (const [id, timer] of [...app.timers]) if (timer.delay === 0) { app.timers.delete(id); timer.fn(); }
    await app.draw();
    assert.equal(child(app, viewerType).run.history.length, 2);
    assert.equal(child(app, viewerType).run.input.seed, config.seed);
    assert.equal(button(app, '참가자').props.disabled, false);
  } finally { app.dispose(); }
});

await check('late account successes and failures after owner switch or logout do not apply and release their own busy lock', async () => {
  for (const owner of ['B', null]) for (const failure of [false, true]) {
    const app = await mount();
    try {
      app.tab('참가자'); const before = roster(app).roster, request = deferred(); app.state.get = () => request.promise;
      roster(app).onLoadAccount(); app.flush(); assert.equal(roster(app).busy, true);
      app.auth(owner); failure ? request.reject(Error('OLD_OWNER_FAILURE')) : request.resolve(actor('old owner'));
      await app.draw(); assert.deepEqual(roster(app).roster, before); assert.equal(roster(app).busy, false);
      assert.equal(app.memory.confirms, 0); assert.ok(!textOf(app.tree).includes('OLD_OWNER_FAILURE'));
      app.auth('B'); app.state.get = async () => actor('current owner'); roster(app).onLoadAccount(); await app.draw();
      assert.equal(roster(app).roster[0].name, 'current owner'); assert.equal(roster(app).busy, false);
    } finally { app.dispose(); }
  }
});

await check('retired owner finally cannot unlock a newer request and stale list cannot start a second GET', async () => {
  const app = await mount();
  try {
    const old = deferred(), current = deferred(); let calls = 0;
    app.state.get = () => { calls += 1; return calls === 1 ? old.promise : current.promise; };
    button(app, '계정 저장 불러오기').props.onClick(); app.flush(); app.auth('B', true);
    app.tab('참가자'); roster(app).onLoadAccount(); app.flush();
    old.resolve({ saves: [{ slotKey: 'workspace', id: 'old-slot' }] }); await app.draw();
    assert.equal(calls, 2); assert.equal(roster(app).busy, true);
    current.resolve(actor('new owner')); await app.draw(); assert.equal(roster(app).busy, false);
    assert.equal(roster(app).roster[0].name, 'new owner');
  } finally { app.dispose(); }
});

await check('account detail and save completion recheck ownership before restore, confirmations or notices', async () => {
  for (const action of ['load', 'save']) {
    const app = await mount();
    try {
      const pending = deferred(); let calls = 0;
      app.state.get = async () => ++calls === 1 ? { saves: [{ slotKey: 'workspace', id: 'slot' }] } : pending.promise;
      app.state.put = () => pending.promise;
      button(app, action === 'load' ? '계정 저장 불러오기' : '계정에 저장').props.onClick(); await app.draw();
      app.auth('B'); pending.resolve(action === 'load' ? { save: { payload: createHungerPack(defaultHungerConfig()) } } : {});
      await app.draw(); assert.equal(app.memory.confirms, 0); assert.ok(!textOf(app.tree).includes('계정 저장 슬롯에 저장했습니다.'));
      assert.equal(button(app, '계정 저장 불러오기').props.disabled, false);
    } finally { app.dispose(); }
  }
});

await check('busy locks real editor props and rejects captured editor callbacks without losing drafts', async () => {
  const app = await mount();
  try {
    app.tab('이벤트'); const oldEvents = events(app), draft = { ...oldEvents.events[0], title: '저장 전 초안' };
    oldEvents.onDraftChange(draft); oldEvents.onDraftOriginIdChange(draft.id); app.flush();
    const pending = deferred(); app.state.get = () => pending.promise; button(app, '계정 저장 불러오기').props.onClick(); app.flush();
    assert.equal(events(app).busy, true); assert.equal(events(app).ready, true);
    oldEvents.onChange([]); oldEvents.onDraftChange(null); oldEvents.onDraftOriginIdChange(null); app.flush();
    assert.equal(events(app).events.length, oldEvents.events.length); assert.equal(events(app).draft.title, '저장 전 초안');
    pending.resolve({ saves: [] }); await app.draw();
    app.tab('참가자'); const current = roster(app), next = current.roster.map((a, i) => i ? a : { ...a, name: 'same workspace' });
    current.onChange(next); app.flush(); assert.equal(roster(app).rosterRevision, current.rosterRevision);
  } finally { app.dispose(); }
});

await check('workspace replacement invalidates old callbacks, photo completion and screen-only item drafts', async () => {
  const app = await mount();
  try {
    app.tab('참가자'); const old = roster(app), pendingPhoto = deferred(); app.state.photo = () => pendingPhoto.promise;
    const editor = createHandlerHarness(Roster, old); editor.flush();
    elements(editor.tree, node => node.type === 'input' && node.props.type === 'file')[0].props.onChange({ target: { files: [{}] } });
    old.onItemDraftsChange({ revision: old.rosterRevision, byId: { [old.roster[0].id]: { text: 'invalid draft', error: '입력 오류' } } }); app.flush();
    assert.ok(textOf(app.tree).includes('반영하지 않은 시작 아이템 입력'));
    app.tab('경기'); app.tab('참가자'); assert.equal(roster(app).itemDrafts.byId[old.roster[0].id].text, 'invalid draft');
    await app.import(imported()); app.tab('참가자'); const current = roster(app);
    assert.ok(current.rosterRevision > old.rosterRevision); assert.deepEqual(current.itemDrafts.byId, {});
    old.onChange(previous => previous.map(a => ({ ...a, name: 'STALE_CALLBACK' })));
    old.onItemDraftsChange({ revision: old.rosterRevision, byId: { old: { text: 'stale', error: 'stale' } } });
    pendingPhoto.resolve('data:image/png;base64,AAAA'); await app.draw();
    assert.equal(roster(app).roster[0].name, '가져온 참가자'); assert.equal(roster(app).roster[0].previewImage, '');
    assert.deepEqual(roster(app).itemDrafts.byId, {}); editor.unmount();
  } finally { app.dispose(); }
});

await check('account roster-only replacement preserves the unrelated event draft and its original identity', async () => {
  const app = await mount();
  try {
    app.tab('이벤트'); const old = events(app), draft = { ...old.events[0], title: '보존할 사건 초안' };
    old.onDraftChange(draft); old.onDraftOriginIdChange(draft.id); app.flush();
    app.tab('참가자'); const revision = roster(app).rosterRevision;
    app.state.get = async () => actor('새 참가자'); roster(app).onLoadAccount(); await app.draw();
    assert.ok(roster(app).rosterRevision > revision); app.tab('이벤트');
    assert.deepEqual(events(app).draft, draft); assert.equal(events(app).draftOriginId, draft.id);
    old.onDraftChange(null); app.flush(); assert.deepEqual(events(app).draft, draft);
  } finally { app.dispose(); }
});

await check('unmounted account and file completions perform no state writes or confirmations', async () => {
  for (const kind of ['account', 'file']) {
    const app = await mount(), pending = deferred();
    if (kind === 'account') { app.state.get = () => pending.promise; button(app, '계정 저장 불러오기').props.onClick(); }
    else await app.import({ size: 10, text: () => pending.promise });
    app.flush(); app.unmount();
    pending.resolve(kind === 'account' ? { saves: [] } : JSON.stringify(createHungerPack(defaultHungerConfig())));
    await settle(); assert.equal(app.writesAfterUnmount, 0); assert.equal(app.memory.confirms, 0); app.dispose();
  }
});

await check('v1 v2 v3 run snapshots and next config remain separate and editor drafts never enter packs', async () => {
  for (const version of [1, 2, 3]) {
    const config = defaultHungerConfig(), run = advanceHungerRun(createHungerRun(config, version));
    const next = { ...config, seed: 'edited-next-seed' }, pack = createHungerPack(next, run);
    const restored = await restoreHungerPackAsync(pack, async () => {});
    assert.deepEqual(restored.run, run); assert.equal(restored.config.seed, next.seed);
    for (const key of ['itemDrafts', 'draftOriginId', 'rosterRevision', 'eventDraft']) assert.ok(!Object.hasOwn(pack, key));
  }
});

delete globalThis.__hgOwnershipCheck;
console.log(JSON.stringify({ pass: true, checks, scope: 'Fresh actual page and photo handlers with synthetic React lifecycle, auth, API promises and storage; no browser, live API/account, files, build or EH changes.' }));
