import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { twentyQuestionsFeedback } from '../src/app/twenty-questions/_lib/twentyQuestionsFeedback.js';
import { resolveTwentyQuestionsLobbyBgmScene, twentyQuestionsResultMusic } from '../src/app/twenty-questions/_lib/twentyQuestionsSoundtrack.js';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../src/app/twenty-questions/page.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('lobby.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TwentyQuestionsPage');
assert.ok(component?.body, 'actual lobby component exists');
const prelude = ast.statements.filter(node => !ts.isImportDeclaration(node) && node !== component
  && (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node))).map(node => node.getText(ast)).join('\n');
const statements = component.body.statements;
const end = statements.findIndex(ts.isReturnStatement);
assert.ok(end > 0, 'actual top-level lobby JSX return exists');
const body = statements.slice(0, end).map(node => node.getText(ast)).join('\n');
const expose = ['loadRooms', 'refreshRooms', 'createRoom', 'setForm', 'setWriterOpen', 'setStatusFilter', 'setCategoryFilter',
  'rooms', 'loading', 'loadError', 'creating', 'writerOpen', 'form', 'actionFeedback'];
const optional = ['updateForm', 'updateStatusFilter', 'updateCategoryFilter', 'updateWriterOpen'];
const compiled = ts.transpileModule(`${prelude}\nfunction view(){${body}\nreturn {${expose.join(',')},${optional.map(name => `${name}:typeof ${name}==='undefined'?null:${name}`).join(',')}};}return view();`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.None } }).outputText;

// Minimal hook/effect scheduling model over the actual current component body.
// API promises and session revisions are controlled dependencies. This does not
// mount React, authenticate accounts, or issue any external GET/POST request.
const equalDeps = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject, settled: false };
}
const initialForm = owner => ({ title: `${owner} title`, category: 'free', hint: `${owner} hint`, answer: `${owner} answer` });
const priorWindow = globalThis.window;
function harness() {
  const h = { hooks: [], index: 0, dirty: false, active: true, revision: 1, authScope: 'auth:cookie:A', csrfToken: 'fixture-csrf-A',
    token: 'controlled-A', user: { _id: 'A', id: 'A', username: 'A' },
    gets: [], posts: [], effects: [], trace: [], listeners: new Map(), stateSlots: [], timers: new Map(), nextTimerId: 1 };
  h.window = { location: { search: '', href: 'http://controlled.invalid/twenty-questions' },
    setTimeout(callback, delay) { const id = h.nextTimerId++; h.timers.set(id, { callback, delay, active: true }); h.trace.push({ kind: 'timerScheduled', id }); return id; },
    clearTimeout(id) { if (h.timers.has(id)) h.timers.get(id).active = false; h.trace.push({ kind: 'timerCleared', id }); },
    addEventListener(type, callback) { const callbacks = h.listeners.get(type) || new Set(); callbacks.add(callback); h.listeners.set(type, callbacks); },
    removeEventListener(type, callback) { h.listeners.get(type)?.delete(callback); },
    dispatchEvent(event) { for (const callback of [...(h.listeners.get(event.type) || [])]) callback(event); return true; } };
  const slot = kind => {
    const index = h.index++;
    if (!h.hooks[index]) h.hooks[index] = { kind };
    assert.equal(h.hooks[index].kind, kind, 'stable hook order');
    return h.hooks[index];
  };
  const useState = initial => {
    const entry = slot('state');
    if (!Object.hasOwn(entry, 'value')) { entry.value = typeof initial === 'function' ? initial() : initial; h.stateSlots.push(entry); }
    entry.set ||= value => {
      const next = typeof value === 'function' ? value(entry.value) : value;
      h.trace.push({ kind: 'state', index: h.hooks.indexOf(entry) });
      if (!Object.is(next, entry.value)) { entry.value = next; h.dirty = true; }
    };
    return [entry.value, entry.set];
  };
  const useRef = initial => { const entry = slot('ref'); entry.ref ||= { current: initial }; return entry.ref; };
  const memo = (kind, factory, deps) => { const entry = slot(kind); if (!entry.ready || !equalDeps(entry.deps, deps)) { entry.value = factory(); entry.deps = deps; entry.ready = true; } return entry.value; };
  const effect = (kind, callback, deps) => {
    const entry = slot(kind);
    if (!entry.ready || !equalDeps(entry.deps, deps)) { entry.next = callback; entry.deps = deps; entry.ready = true; h.effects.push(entry); }
  };
  const showToast = toast => h.trace.push({ kind: 'toast', toast });
  const router = { push: path => h.trace.push({ kind: 'push', path }) };
  const setMusicScene = scene => h.trace.push({ kind: 'music', scene });
  const sfx = { playGameSfx: cue => h.trace.push({ kind: 'sfx', cue }), handleGameSfxChangeCapture() {}, handleGameSfxPointerDownCapture() {} };
  const scope = {
    React: { createElement: (...args) => ({ args }) },
    useState, useRef, useMemo: (factory, deps) => memo('memo', factory, deps),
    useCallback: (callback, deps) => memo('callback', () => callback, deps),
    useEffect: (callback, deps) => effect('effect', callback, deps),
    useLayoutEffect: (callback, deps) => effect('layout', callback, deps),
    useHydrated: () => true, useAuthToken: () => h.token, useAuthUser: () => h.user,
    useRouter: () => router, useToast: () => ({ showToast }), useGameBgm: () => ({ setMusicScene }),
    useGameSfxEventHandlers: () => sfx,
    AUTH_SYNC_EVENT: 'controlled-auth-sync',
    captureAuthSession: () => ({ scope: h.authScope, revision: h.revision, csrfToken: h.csrfToken }),
    isCurrentAuthSession: captured => Boolean(captured) && captured.scope === h.authScope
      && captured.revision === h.revision && captured.csrfToken === h.csrfToken,
    apiGetCached: (path, options) => { const request = { ...deferred(), path, options }; h.gets.push(request); h.trace.push({ kind: 'get', path }); return request.promise; },
    apiPost: (path, payload, options) => { const request = { ...deferred(), path, payload: structuredClone(payload), options }; h.posts.push(request); h.trace.push({ kind: 'post', path }); return request.promise; },
    clearApiGetCache: path => h.trace.push({ kind: 'cache', path }),
    resolveTwentyQuestionsLobbyBgmScene, twentyQuestionsFeedback, twentyQuestionsResultMusic,
  };
  const renderView = new Function(...Object.keys(scope), compiled);
  h.render = () => {
    globalThis.window = h.window;
    let turns = 0;
    do {
      assert.ok(turns++ < 12, 'bounded render/effect settling');
      h.dirty = false; h.index = 0; h.effects = [];
      h.view = renderView(...Object.values(scope));
      for (const kind of ['layout', 'effect']) for (const entry of h.effects.filter(row => row.kind === kind)) {
        if (typeof entry.cleanup === 'function') entry.cleanup();
        entry.cleanup = entry.next(); entry.next = null;
      }
    } while (h.dirty);
    return h.view;
  };
  h.unmount = () => { for (const entry of h.hooks) if (typeof entry.cleanup === 'function') entry.cleanup(); h.active = false; };
  h.switchAccount = id => {
    h.revision += 1; h.token = id ? `controlled-${id}` : '';
    h.authScope = id ? `auth:cookie:${encodeURIComponent(id)}` : 'anon'; h.csrfToken = `fixture-csrf-${id || 'anon'}-${h.revision}`;
    h.user = id ? { _id: id, id, username: id } : null;
    h.window.dispatchEvent({ type: scope.AUTH_SYNC_EVENT }); h.render();
  };
  h.profileChange = () => { h.user = { ...h.user, nickname: 'updated display name' }; h.render(); };
  h.renewSession = () => { h.revision += 1; h.window.dispatchEvent({ type: scope.AUTH_SYNC_EVENT }); h.render(); };
  h.replaceCsrf = () => { h.csrfToken += '-replaced'; h.window.dispatchEvent({ type: scope.AUTH_SYNC_EVENT }); h.render(); };
  h.fireTimer = id => { const timer = h.timers.get(id); assert.ok(timer, 'captured actual announce timer exists'); timer.active = false; timer.callback(); };
  h.form = value => { (h.view.updateForm || h.view.setForm)(value); h.render(); };
  h.openWriter = value => { (h.view.updateWriterOpen || h.view.setWriterOpen)(value); h.render(); };
  h.filter = value => { (h.view.updateStatusFilter || h.view.setStatusFilter)(value); h.render(); };
  h.snapshot = () => ({ states: h.stateSlots.map(entry => structuredClone(entry.value)), getCount: h.gets.length,
    postCount: h.posts.length, trace: structuredClone(h.trace) });
  h.resolve = (kind, index, value) => { const request = h[kind][index]; assert.ok(request && !request.settled, `${kind} ${index} pending`); request.settled = true; request.resolve(value); };
  h.reject = (kind, index, message) => { const request = h[kind][index]; assert.ok(request && !request.settled, `${kind} ${index} pending`); request.settled = true; request.reject(new Error(message)); };
  h.render();
  return h;
}
async function flush(h) { for (let index = 0; index < 5; index += 1) { await Promise.resolve(); if (h.active && h.dirty) h.render(); } }
async function drainGets(h) {
  for (let round = 0; round < 5; round += 1) {
    const pending = h.gets.map((request, index) => !request.settled ? index : -1).filter(index => index >= 0);
    if (!pending.length) break;
    pending.forEach(index => h.resolve('gets', index, { rooms: [] })); await flush(h);
  }
}
async function ready() { const h = harness(); await drainGets(h); h.openWriter(true); h.form(initialForm('A')); h.trace = []; return h; }
const room = id => ({ _id: id, title: id, status: 'active' });
let passed = 0; const failures = [];
async function check(name, run) {
  try { await run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message.split('\n')[0] }); console.error(`FAIL ${name}: ${error.message.split('\n')[0]}`); }
}

try {
  await check('GET filter A then B reverse success keeps B list and retires A return/finally', async () => {
    const h = await ready(); h.filter('active'); const a = h.gets.length - 1;
    const old = h.view.loadRooms; const pendingA = old(); const a2 = h.gets.length - 1;
    h.filter('solved'); const b = h.gets.length - 1;
    h.resolve('gets', b, { rooms: [room('B-visible')] }); await flush(h);
    const before = h.snapshot(); h.resolve('gets', a2, { rooms: [room('A-late')] });
    assert.equal(await pendingA, null, 'retired success is distinct from current success and current failure'); await flush(h);
    assert.deepEqual(h.snapshot(), before, 'late success/finally must not alter B state');
    h.resolve('gets', a, { rooms: [room('A-effect-late')] }); await flush(h);
    assert.deepEqual(h.snapshot(), before);
  });
  await check('stale GET error/finally cannot set error toast or clear a newer pending loading state', async () => {
    const h = await ready(); const pending = h.view.loadRooms(); const a = h.gets.length - 1;
    h.filter('closed'); const b = h.gets.length - 1;
    const before = h.snapshot(); h.reject('gets', a, 'stale list error'); assert.equal(await pending, null); await flush(h);
    assert.deepEqual(h.snapshot(), before, 'old error/finally must leave active request untouched');
    h.resolve('gets', b, { rooms: [room('current')] }); await flush(h);
  });
  await check('stale refresh success and failure do not announce after filters change', async () => {
    for (const rejected of [false, true]) {
      const h = await ready(); const pending = h.view.refreshRooms(); const a = h.gets.length - 1;
      h.filter('solved'); await drainGetsExcept(h, a);
      const before = h.snapshot();
      if (rejected) h.reject('gets', a, 'old refresh error'); else h.resolve('gets', a, { rooms: [room('old')] });
      await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
    }
  });
  await check('GET and refresh completions after unmount make no state toast or feedback writes', async () => {
    for (const rejected of [false, true]) {
      const h = await ready(); const pending = h.view.refreshRooms(); const index = h.gets.length - 1;
      h.unmount(); const before = h.snapshot();
      if (rejected) h.reject('gets', index, 'unmounted error'); else h.resolve('gets', index, { rooms: [] });
      await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
    }
  });
  for (const accountPath of [['B'], ['B', 'A']]) for (const rejected of [false, true]) {
    await check(`POST A -> ${accountPath.join(' -> ')} late ${rejected ? 'error' : 'success'} cannot touch new form/navigation/cache/loading`, async () => {
      const h = await ready(); const pending = h.view.createRoom(); const post = h.posts.length - 1;
      for (const id of accountPath) h.switchAccount(id);
      await drainGets(h); h.form(initialForm('new-current')); h.trace = [];
      const before = h.snapshot();
      if (rejected) h.reject('posts', post, 'A late POST error'); else h.resolve('posts', post, { room: { _id: 'A-created' } });
      await flush(h); await drainGets(h); await pending; await flush(h);
      assert.deepEqual(h.snapshot(), before, 'retired completion must be fully inert');
    });
  }
  await check('same-render duplicate creation submits exactly one POST', async () => {
    const h = await ready(); const create = h.view.createRoom;
    const first = create(), second = create();
    const count = h.posts.length;
    h.posts.forEach((request, index) => { if (!request.settled) h.resolve('posts', index, { room: { _id: `created-${index}` } }); });
    await Promise.all([first, second]); await flush(h);
    assert.equal(count, 1, 'the synchronous request slot prevents two same-render POSTs');
  });
  await check('POST success/error after unmount produces no side effects including finally', async () => {
    for (const rejected of [false, true]) {
      const h = await ready(); const pending = h.view.createRoom(); const index = h.posts.length - 1;
      h.unmount(); const before = h.snapshot();
      if (rejected) h.reject('posts', index, 'unmounted POST'); else h.resolve('posts', index, { room: { _id: 'old' } });
      await flush(h); await drainGets(h); await pending; assert.deepEqual(h.snapshot(), before);
    }
  });
  await check('current successful creation preserves normal payload cache clearing form reset and navigation', async () => {
    const h = await ready(); const pending = h.view.createRoom();
    assert.deepEqual(h.posts[0].payload, initialForm('A'));
    h.resolve('posts', 0, { room: { _id: 'normal-room' }, message: 'created normally' }); await pending; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path === '/twenty-questions/normal-room'));
    assert.equal(h.trace.filter(row => row.kind === 'cache').length, 3);
    assert.ok(h.trace.some(row => row.kind === 'toast' && row.toast.tone === 'success'));
    assert.ok(h.stateSlots.some(entry => entry.value && typeof entry.value === 'object' && entry.value.title === '' && entry.value.answer === ''));
  });
  await check('current POST failure refreshes normally preserves draft releases busy and permits retry', async () => {
    const h = await ready(); const pending = h.view.createRoom(); h.reject('posts', 0, 'current creation error');
    await flush(h); await drainGets(h); await pending; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'toast' && row.toast.tone === 'danger' && row.toast.message === 'current creation error'));
    assert.ok(h.stateSlots.some(entry => entry.value?.answer === 'A answer'));
    const retry = h.view.createRoom(); assert.equal(h.posts.length, 2);
    h.resolve('posts', 1, { room: { _id: 'retry-success' } }); await retry; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/retry-success')));
  });
  await check('current creation without room ID follows its real fallback list reload', async () => {
    const h = await ready(); const count = h.gets.length; const pending = h.view.createRoom();
    h.resolve('posts', 0, { message: 'created without an ID' }); await flush(h); await drainGets(h); await pending;
    assert.equal(h.gets.length, count + 1); assert.equal(h.trace.some(row => row.kind === 'push'), false);
  });
  await check('current refresh success and failure still announce their actual outcome', async () => {
    for (const rejected of [false, true]) {
      const h = await ready(); const pending = h.view.refreshRooms(); const index = h.gets.length - 1;
      if (rejected) h.reject('gets', index, 'current refresh error'); else h.resolve('gets', index, { rooms: [room('fresh')] });
      await pending; await flush(h);
      const cue = twentyQuestionsFeedback(rejected ? 'roomLoadFailure' : 'refresh', { ok: !rejected }).cue;
      assert.ok(h.trace.some(row => row.kind === 'sfx' && row.cue === cue));
    }
  });
  await check('same-owner profile rerender preserves form and does not retire a valid current POST', async () => {
    const h = await ready(); const pending = h.view.createRoom(); h.profileChange(); await drainGets(h);
    assert.ok(h.stateSlots.some(entry => entry.value?.answer === 'A answer'));
    h.resolve('posts', 0, { room: { _id: 'same-owner-profile' } }); await pending;
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/same-owner-profile')));
  });
  await check('POST failure awaiting reload is retired when the account changes during that second await', async () => {
    const h = await ready(); const pending = h.view.createRoom(); h.reject('posts', 0, 'first failure'); await flush(h);
    const reload = h.gets.length - 1; assert.equal(h.gets[reload].settled, false, 'real catch is awaiting its reload');
    h.switchAccount('B'); await drainGetsExcept(h, reload); h.form(initialForm('B')); h.trace = [];
    const before = h.snapshot(); h.resolve('gets', reload, { rooms: [room('A-reload')] });
    await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  await check('GET refresh A -> B -> A is retired even when the final account identity repeats', async () => {
    const h = await ready(); const pending = h.view.refreshRooms(); const old = h.gets.length - 1;
    h.switchAccount('B'); h.switchAccount('A'); await drainGetsExcept(h, old); h.trace = [];
    const before = h.snapshot(); h.resolve('gets', old, { rooms: [room('ABA-old')] });
    await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  await check('queued old create callbacks cannot validate or submit after account change or unmount', async () => {
    for (const unmount of [false, true]) {
      const h = await ready(); h.form({ ...initialForm('A'), answer: '' }); const queued = h.view.createRoom;
      if (unmount) h.unmount(); else { h.switchAccount('B'); await drainGets(h); h.form(initialForm('B')); }
      h.trace = []; const before = h.snapshot(); await queued(); await flush(h);
      assert.deepEqual(h.snapshot(), before, 'even validation feedback belongs to the captured live context');
    }
  });
  await check('session renewal retires an old POST without erasing the same-owner form', async () => {
    const h = await ready(); const pending = h.view.createRoom(); h.renewSession(); await drainGets(h);
    assert.ok(h.stateSlots.some(entry => entry.value?.answer === 'A answer'));
    h.trace = []; const before = h.snapshot(); h.resolve('posts', 0, { room: { _id: 'before-renewal' } });
    await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  await check('CSRF-only session replacement retires GET and POST with unchanged scope and revision', async () => {
    const h = await ready(); const pendingGet = h.view.refreshRooms(), pendingPost = h.view.createRoom();
    const get = h.gets.length - 1, scope = h.authScope, revision = h.revision;
    h.replaceCsrf(); assert.equal(h.authScope, scope); assert.equal(h.revision, revision);
    await drainGetsExcept(h, get); h.trace = []; const before = h.snapshot();
    h.resolve('gets', get, { rooms: [room('old-csrf-list')] }); h.resolve('posts', 0, { room: { _id: 'old-csrf-room' } });
    await Promise.all([pendingGet, pendingPost]); await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  await check('actual current announce timer restores the current base scene normally', async () => {
    const h = await ready(); const refresh = h.view.refreshRooms(), index = h.gets.length - 1;
    h.resolve('gets', index, { rooms: [] }); await refresh; await flush(h);
    const id = [...h.timers.keys()].at(-1); assert.ok(id);
    h.trace = []; h.fireTimer(id);
    assert.ok(h.trace.some(row => row.kind === 'music' && row.scene === resolveTwentyQuestionsLobbyBgmScene({ writerOpen: h.view.writerOpen, loadError: h.view.loadError })));
  });
  await check('captured actual announce timers cannot set music after account change or unmount even if forcibly invoked', async () => {
    for (const unmount of [false, true]) {
      const h = await ready(); const refresh = h.view.refreshRooms(), index = h.gets.length - 1;
      h.resolve('gets', index, { rooms: [] }); await refresh; await flush(h);
      const id = [...h.timers.keys()].at(-1); assert.ok(id);
      if (unmount) h.unmount(); else { h.switchAccount('B'); await drainGets(h); }
      h.trace = []; const before = h.snapshot(); h.fireTimer(id); await flush(h);
      assert.deepEqual(h.snapshot(), before, 'a queued old timer must guard its own music side effect');
    }
  });
  await check('retired A completion cannot release the creating state of a newer B POST', async () => {
    const h = await ready(); const old = h.view.createRoom(); h.switchAccount('B'); await drainGets(h); h.openWriter(true); h.form(initialForm('B'));
    const current = h.view.createRoom(); const count = h.posts.length; h.trace = []; const before = h.snapshot();
    h.resolve('posts', 0, { room: { _id: 'old-A' } }); await old; await flush(h);
    assert.deepEqual(h.snapshot(), before); assert.equal(count, 2, 'B owns an independent current POST');
    h.resolve('posts', 1, { room: { _id: 'current-B' } }); await current; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/current-B')));
  });
  for (const change of ['filter', 'unmount']) await check(`POST catch reload retires its failure feedback after ${change}`, async () => {
    const h = await ready(); const pending = h.view.createRoom(); h.reject('posts', 0, 'failed before reload'); await flush(h);
    const reload = h.gets.length - 1;
    if (change === 'filter') { h.filter('closed'); await drainGetsExcept(h, reload); } else h.unmount();
    h.trace = []; const before = h.snapshot(); h.resolve('gets', reload, { rooms: [room('stale-reload')] });
    await pending; await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  for (const intent of ['form-edit', 'writer-close-open']) await check(`explicit ${intent} creates a new intent without letting old POST completion clear its form or busy state`, async () => {
    const h = await ready(); const old = h.view.createRoom();
    if (intent === 'writer-close-open') { h.openWriter(false); h.openWriter(true); }
    h.form(initialForm('new-intent')); const current = h.view.createRoom();
    assert.equal(h.posts.length, 2, 'an explicit changed form/writer intent permits one new POST');
    h.trace = []; const before = h.snapshot(); h.resolve('posts', 0, { room: { _id: 'old-intent' } });
    await old; await flush(h); assert.deepEqual(h.snapshot(), before);
    h.resolve('posts', 1, { room: { _id: 'new-intent' } }); await current; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/new-intent')));
  });
  await check('filter change during active POST keeps that POST valid and cannot permit a duplicate submission', async () => {
    const h = await ready(); const first = h.view.createRoom(); h.filter('solved'); await drainGets(h);
    const second = h.view.createRoom(), count = h.posts.length;
    h.posts.forEach((request, index) => { if (!request.settled) h.resolve('posts', index, { room: { _id: 'filter-current' } }); });
    await Promise.all([first, second]); await flush(h);
    assert.equal(count, 1);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/filter-current')));
  });
  await check('queued old form writer and filter handlers cannot mutate a different owner context', async () => {
    const h = await ready();
    const old = { form: h.view.updateForm, writer: h.view.updateWriterOpen, status: h.view.updateStatusFilter, category: h.view.updateCategoryFilter };
    assert.ok(Object.values(old).every(value => typeof value === 'function'), 'actual synchronous UI context handlers exist');
    h.switchAccount('B'); await drainGets(h); h.openWriter(true); h.form(initialForm('B')); h.trace = [];
    const before = h.snapshot(); old.form(initialForm('stale-A')); old.writer(false); old.status('closed'); old.category('game');
    await flush(h); assert.deepEqual(h.snapshot(), before);
  });
  await check('silent CSRF-only change recovers through current refresh and stale work cannot retire the recovered scope', async () => {
    const h = await ready();
    const announced = h.view.refreshRooms(), announceGet = h.gets.length - 1;
    h.resolve('gets', announceGet, { rooms: [] }); await announced; await flush(h);
    const oldTimer = [...h.timers.keys()].at(-1); assert.ok(oldTimer);
    const oldGetPromise = h.view.loadRooms(), oldGet = h.gets.length - 1;
    const oldPostPromise = h.view.createRoom();
    const originalScope = h.authScope, originalRevision = h.revision, count = h.gets.length;
    // No auth event and no render: the actual current callback must notice the
    // changed CSRF snapshot and open a replacement live request epoch itself.
    h.csrfToken += '-silent-replacement';
    const trigger = h.view.refreshRooms(); await flush(h);
    assert.equal(h.authScope, originalScope); assert.equal(h.revision, originalRevision);
    const currentGet = h.gets.findLastIndex((request, index) => index >= count && !request.settled);
    assert.ok(currentGet >= count, 'current refresh must recover a live GET without an auth-sync event');
    h.resolve('gets', currentGet, { rooms: [room('recovered-current-list')] }); await trigger; await flush(h);
    assert.ok(h.view.rooms.some(row => row._id === 'recovered-current-list'));
    assert.equal(h.view.form.answer, 'A answer', 'silent renewal preserves the same-owner draft');
    h.form(initialForm('A-current')); const currentPostPromise = h.view.createRoom();
    assert.equal(h.posts.length, 2, 'the recovered context accepts a fresh current POST');
    h.trace = []; const before = h.snapshot();
    h.resolve('gets', oldGet, { rooms: [room('old-silent-csrf-list')] });
    h.resolve('posts', 0, { room: { _id: 'old-silent-csrf-room' } });
    await Promise.all([oldGetPromise, oldPostPromise]); h.fireTimer(oldTimer); await flush(h);
    assert.deepEqual(h.snapshot(), before, 'already-stale work must not retire or modify the recovered live scope');
    h.resolve('posts', 1, { room: { _id: 'recovered-created-room' } }); await currentPostPromise; await flush(h);
    assert.ok(h.trace.some(row => row.kind === 'push' && row.path.endsWith('/recovered-created-room')));
  });
} finally {
  if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
}

async function drainGetsExcept(h, excluded) {
  for (let round = 0; round < 5; round += 1) {
    const pending = h.gets.map((request, index) => !request.settled && index !== excluded ? index : -1).filter(index => index >= 0);
    if (!pending.length) break;
    pending.forEach(index => h.resolve('gets', index, { rooms: [] })); await flush(h);
  }
}
console.log(`RESULT ${passed}/${passed + failures.length} passed; ${failures.length} failed; actual callback/effect declarations with controlled hook/session/API model only`);
if (failures.length) process.exitCode = 1;
