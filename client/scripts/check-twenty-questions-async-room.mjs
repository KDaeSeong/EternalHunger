import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../src/app/twenty-questions/_components/TwentyQuestionsRoomContent.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('Room.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'TwentyQuestionsRoomContent');
const declarations = new Map();
for (const statement of component.body.statements) if (ts.isVariableStatement(statement)) {
  for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) declarations.set(d.name.text, `const ${d.getText(ast)};`);
}
const names = ['ownerKey', 'roomContextKey', 'room', 'roomRequestRef', 'retireRoomSession', 'isRoomContextCurrent',
  'captureRoomRequest', 'isCurrentRoomRequest', 'finishRoomRequest', 'beginRoomMutation', 'finishRoomMutation',
  'applyRoomResponse', 'loadRoom', 'clearRoomCaches', 'addQuestion', 'answerQuestion', 'submitGuess', 'sendHintMessage', 'closeRoom'];
for (const name of names) assert.ok(declarations.has(name), 'Missing actual declaration ' + name);
function effect(fragment) {
  const node = component.body.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.getText(ast).includes(fragment));
  assert.ok(node, 'Missing actual effect ' + fragment);
  return `{callback:${node.expression.arguments[0].getText(ast)},deps:${node.expression.arguments[1].getText(ast)}}`;
}
const pure = source.slice(source.indexOf('const RESPONSE_OPTIONS'), source.indexOf('export default function TwentyQuestionsRoomContent'));
// Count calls around the unchanged product normalizer, including its exact
// returned object. No replacement normalization or payload-shape shortcut.
const normalizationProbe = `const actualNormalizeRoom = normalizeRoom;
normalizeRoom = payload => observeRoomNormalization(payload, actualNormalizeRoom);`;
const factorySource = `${pure}\n${normalizationProbe}\n${names.map(n => declarations.get(n)).join('\n')}\nreturn {
  ${names.filter(n => n !== 'roomRequestRef').join(',')},roomVersion,effects:{
  layout:${effect('scope.ownerKey !== ownerKey')},auth:${effect('const handleAuthChange')},
  poll:${effect('const timer = window.setInterval(refreshRoom, ROOM_POLL_INTERVAL_MS)')},
  presence:${effect('const timer = window.setInterval(heartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS)')}}};`;
const progress = readFileSync(new URL('../src/app/twenty-questions/_lib/twentyQuestionsProgress.js', import.meta.url), 'utf8');
const { twentyQuestionsProgressTransition } = await import('data:text/javascript,' + encodeURIComponent(progress));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const payload = (id, count = 0, extra = {}) => ({ room: { _id: id, status: 'active', isHost: false,
  questions: Array.from({ length: count }, (_, i) => ({ _id: 'q' + i, response: 'pending' })), ...extra } });
const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));

// Product declarations/effect bodies are extracted from the current component.
// Hook scheduling and API are controlled; this is not mounted React or browser proof.
function harness() {
  const calls = { rooms: [], errors: [], loading: [], toasts: [], intervals: [], reads: [], posts: [], feedback: [], remote: [], caches: [], drafts: [], busy: [], confirms: [], normalizations: [], trace: [] };
  const state = { storedRoom: null, loadedScope: null, loading: true, sessionEpoch: 0, questionText: '', guessText: '', hintText: '', submitting: '' };
  let current = { id: 'A', user: { id: 'owner-A' }, token: 'cookie-session', canUseAttempt: true };
  let session = { owner: 'owner-A', revision: 0 };
  const scopeRef = { current: null }, roomRef = { current: null }, submittingRef = { current: '' };
  const callbacks = [], mounted = new Map(), backgrounds = new Set(), listeners = new Map();
  let cursor = 0;
  const listen = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
  const unlisten = (type, fn) => listeners.get(type)?.delete(fn);
  const setters = {
    setRoom: v => { state.storedRoom = v; calls.rooms.push(v); calls.trace.push({ kind: 'commit', room: v, ref: roomRef.current }); }, setLoadedScope: v => { state.loadedScope = v; },
    setLoading: v => { state.loading = v; calls.loading.push(v); }, setLoadError: v => calls.errors.push(v),
    setQuestionText: v => { state.questionText = v; calls.drafts.push(['question', v]); },
    setGuessText: v => { state.guessText = v; calls.drafts.push(['guess', v]); },
    setHintText: v => { state.hintText = v; calls.drafts.push(['hint', v]); },
    setSubmitting: v => { state.submitting = v; calls.busy.push(v); }, setActionFeedback: v => calls.feedback.push(v),
    setSessionEpoch: v => { state.sessionEpoch = typeof v === 'function' ? v(state.sessionEpoch) : v; },
  };
  const fixed = { ...setters, roomRef, submittingRef, hydrated: true, AUTH_SYNC_EVENT: 'auth-sync',
    observeRoomNormalization: (data, actual) => {
      const observed = { payload: data, output: undefined }; calls.normalizations.push(observed);
      calls.trace.push({ kind: 'normalize', observed }); observed.output = actual(data); return observed.output;
    },
    captureAuthSession: () => ({ ...session }), isCurrentAuthSession: v => Boolean(v) && v.owner === session.owner && v.revision === session.revision,
    useRef: initial => { scopeRef.current ??= initial; return scopeRef; },
    useCallback: (fn, deps) => { const i = cursor++; if (!callbacks[i] || !same(callbacks[i].deps, deps)) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    apiGet: url => { const r = { ...deferred(), url }; calls.reads.push(r); return r.promise; },
    apiPost: (url, body) => { const r = { ...deferred(), url, body }; calls.posts.push(r); return r.promise; },
    clearApiGetCache: v => calls.caches.push(v), announce: (...args) => calls.feedback.push(args),
    announceRemoteRoomChange: (...args) => { calls.remote.push(args); calls.trace.push({ kind: 'remote', args }); }, showToast: v => calls.toasts.push(v), twentyQuestionsProgressTransition,
    document: { visibilityState: 'visible', addEventListener: listen, removeEventListener: unlisten },
    window: { addEventListener: listen, removeEventListener: unlisten, clearInterval() {},
      setInterval: fn => { calls.intervals.push(fn); return calls.intervals.length; },
      confirm: v => { calls.confirms.push(v); return true; } },
  };
  function render(patch = {}, commit = true) {
    current = { ...current, ...patch }; cursor = 0;
    const inputs = { ...fixed, ...current, ...state, active: state.storedRoom?.status === 'active' };
    const view = new Function(...Object.keys(inputs), factorySource)(...Object.values(inputs));
    if (commit) for (const name of ['layout', 'auth']) {
      const next = view.effects[name], prior = mounted.get(name);
      if (!prior || !same(prior.deps, next.deps)) { prior?.cleanup?.(); mounted.set(name, { deps: next.deps, cleanup: next.callback() }); }
    }
    view.start = name => { const cleanup = view.effects[name].callback(); if (cleanup) backgrounds.add(cleanup); return () => { cleanup?.(); backgrounds.delete(cleanup); }; };
    return view;
  }
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  async function loaded(patch = {}, count = 0, extra = {}) {
    const before = calls.reads.length; render(patch); await flush();
    assert.equal(calls.reads.length, before + 1, 'Lifecycle starts one current-context load');
    calls.reads.at(-1).resolve(payload(current.id, count, extra)); await flush(); return render();
  }
  function unmount() { for (const fn of backgrounds) fn(); backgrounds.clear(); for (const e of mounted.values()) e.cleanup?.(); mounted.clear(); }
  return { calls, state, roomRef, submittingRef, render, loaded, flush, unmount,
    changeSession: (owner = session.owner) => { session = { owner, revision: session.revision + 1 }; },
    dispatch: (type, event = {}) => { for (const fn of listeners.get(type) || []) fn({ type, ...event }); } };
}
let checks = 0;
const failures = [];
async function check(name, run) {
  try { await run(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + String(error.stack || error).slice(0, 1200)); }
}
const sideEffects = h => [h.calls.rooms.length, h.calls.errors.length, h.calls.toasts.length, h.calls.loading.length,
  h.calls.feedback.length, h.calls.caches.length, h.calls.drafts.length, h.calls.busy.length, h.calls.normalizations.length, h.calls.trace.length];

await check('late A load success/error/finally cannot replace or clear newer B', async () => {
  for (const reject of [false, true]) {
    const h = harness(); h.render(); await h.flush(); const old = h.calls.reads[0];
    await h.loaded({ id: 'B' }, 2); const counts = sideEffects(h);
    if (reject) old.reject(Error('old A failed')); else old.resolve(payload('A')); await h.flush();
    assert.equal(h.roomRef.current._id, 'B'); assert.equal(h.roomRef.current.questions.length, 2);
    assert.deepEqual(sideEffects(h), counts); h.unmount();
  }
});
await check('reverse GET completion preserves latest room and pending loading state', async () => {
  const h = harness(); h.render(); await h.flush(); const view = h.render(), latest = view.loadRoom();
  h.calls.reads[0].resolve(payload('A')); await h.flush(); assert.equal(h.roomRef.current, null); assert.equal(h.state.loading, true);
  h.calls.reads[1].resolve(payload('A', 2)); await latest; assert.equal(h.roomRef.current.questions.length, 2); assert.equal(h.state.loading, false);
  const old = view.loadRoom(), next = view.loadRoom(); h.calls.reads[3].resolve(payload('A', 3)); await next;
  h.calls.reads[2].reject(Error('retired failure')); await old; assert.equal(h.roomRef.current.questions.length, 3); assert.equal(h.calls.toasts.length, 0); h.unmount();
});
await check('disposed poll and presence responses cannot apply or announce', async () => {
  for (const kind of ['poll', 'presence']) {
    const h = harness(), view = await h.loaded(), cleanup = view.start(kind);
    const task = kind === 'poll' ? h.calls.intervals.at(-1)() : null;
    const pending = kind === 'poll' ? h.calls.reads.at(-1) : h.calls.posts.at(-1); cleanup(); const count = h.calls.rooms.length;
    pending.resolve(payload('A', 2)); await task; await h.flush(); assert.equal(h.calls.rooms.length, count); assert.equal(h.calls.remote.length, 0); h.unmount();
  }
});
await check('pre-mutation poll/presence cannot erase success and legitimate later polling still applies', async () => {
  for (const kind of ['poll', 'presence']) {
    const h = harness(); await h.loaded(); h.state.questionText = 'question'; const view = h.render(); view.start(kind);
    const task = kind === 'poll' ? h.calls.intervals.at(-1)() : null;
    const old = kind === 'poll' ? h.calls.reads.at(-1) : h.calls.posts.at(-1), action = view.addQuestion();
    h.calls.posts.at(-1).resolve(payload('A', 1)); await action; old.resolve(payload('A')); await task; await h.flush();
    assert.equal(h.roomRef.current.questions.length, 1); h.render().start('poll'); const fresh = h.calls.intervals.at(-1)();
    h.calls.reads.at(-1).resolve(payload('A', 2)); await fresh; assert.equal(h.roomRef.current.questions.length, 2); assert.equal(h.calls.remote.length, 1); h.unmount();
  }
});
await check('background reads are single-flight and explicit refresh can supersede them without starvation', async () => {
  const h = harness(), view = await h.loaded(); view.start('poll'); const poll = h.calls.intervals.at(-1), task = poll(), old = h.calls.reads.at(-1), count = h.calls.reads.length;
  await poll(); view.start('presence'); await h.flush(); assert.equal(h.calls.reads.length, count); assert.equal(h.calls.posts.length, 0);
  const explicit = view.loadRoom(); h.calls.reads.at(-1).resolve(payload('A', 2)); await explicit; old.resolve(payload('A')); await task;
  assert.equal(h.roomRef.current.questions.length, 2); const fresh = poll(); h.calls.reads.at(-1).resolve(payload('A', 3)); await fresh;
  assert.equal(h.roomRef.current.questions.length, 3); h.unmount();
});
await check('all five old mutations guard success/error/drafts/cache/feedback/finally across owner handoff', async () => {
  const actions = [v => v.addQuestion(), v => v.answerQuestion('q0', 'yes'), v => v.submitGuess(), v => v.sendHintMessage(), v => v.closeRoom()];
  for (const action of actions) for (const reject of [false, true]) {
    const h = harness(); await h.loaded({}, 1, { isHost: true, answer: 'private A' });
    Object.assign(h.state, { questionText: 'A question', guessText: 'A guess', hintText: 'A hint' });
    const task = action(h.render()), old = h.calls.posts.at(-1); assert.ok(old);
    h.changeSession('owner-B'); await h.loaded({ user: { id: 'owner-B' } }, 1);
    Object.assign(h.state, { questionText: 'B question', guessText: 'B guess', hintText: 'B hint' });
    const next = h.render().addQuestion(), current = h.calls.posts.at(-1), counts = sideEffects(h);
    if (reject) old.reject(Error('old owner failed')); else old.resolve(payload('A', 2, { isHost: true })); await task;
    assert.deepEqual(sideEffects(h), counts); assert.equal(h.state.submitting, 'question');
    assert.deepEqual([h.state.questionText, h.state.guessText, h.state.hintText], ['B question', 'B guess', 'B hint']);
    current.resolve(payload('A', 2)); await next; assert.equal(h.state.submitting, ''); h.unmount();
  }
});
await check('queued retired callbacks start no request, feedback or confirmation', async () => {
  const h = harness(), old = await h.loaded({}, 0, { isHost: true }); h.changeSession('owner-B'); await h.loaded({ id: 'B', user: { id: 'owner-B' } });
  const counts = [h.calls.reads.length, h.calls.posts.length, h.calls.toasts.length, h.calls.feedback.length, h.calls.confirms.length];
  await old.loadRoom(); await old.addQuestion(); await old.answerQuestion('q0', 'yes'); await old.submitGuess(); await old.sendHintMessage(); await old.closeRoom();
  assert.deepEqual([h.calls.reads.length, h.calls.posts.length, h.calls.toasts.length, h.calls.feedback.length, h.calls.confirms.length], counts); h.unmount();
});
await check('same-frame mutations are single-flight and current failure releases busy for retry', async () => {
  const h = harness(); await h.loaded(); h.state.questionText = 'question'; h.state.guessText = 'guess'; const view = h.render(), task = view.addQuestion();
  await view.addQuestion(); await view.submitGuess(); assert.equal(h.calls.posts.length, 1); assert.equal(h.submittingRef.current, 'question');
  h.calls.posts[0].reject(Error('current failure')); await task; assert.equal(h.state.submitting, ''); assert.equal(h.state.questionText, 'question'); assert.equal(h.calls.toasts.at(-1).message, 'current failure');
  const retry = view.addQuestion(); h.calls.posts.at(-1).resolve(payload('A', 1)); await retry; assert.equal(h.state.questionText, ''); assert.equal(h.state.submitting, ''); h.unmount();
});
await check('same cookie marker hides old owner room before layout and scopes all drafts', async () => {
  const h = harness(); await h.loaded({}, 0, { isHost: true, answer: 'private answer' });
  Object.assign(h.state, { questionText: 'private question', guessText: 'private guess', hintText: 'private hint' }); h.changeSession('owner-B');
  const preview = h.render({ user: { id: 'owner-B' }, token: 'cookie-session' }, false); assert.equal(preview.room, null); assert.equal(h.state.storedRoom.answer, 'private answer');
  await h.loaded(); assert.deepEqual([h.state.questionText, h.state.guessText, h.state.hintText], ['', '', '']); assert.equal(h.render().room.isHost, false); assert.equal(h.render().room.answer, ''); h.unmount();
});
await check('profile refresh preserves drafts and silent same-owner session renewal recovers exactly once', async () => {
  const h = harness(); await h.loaded(); h.state.questionText = 'keep draft'; const count = h.calls.reads.length;
  h.render({ user: { id: 'owner-A', nickname: 'new profile' } }); await h.flush(); assert.equal(h.calls.reads.length, count); assert.equal(h.state.questionText, 'keep draft');
  h.render().start('poll'); const poll = h.calls.intervals.at(-1); h.changeSession(); await poll(); await poll();
  assert.equal(h.state.sessionEpoch, 1); assert.equal(h.calls.reads.length, count); await h.loaded(); assert.equal(h.state.questionText, 'keep draft');
  h.render().start('poll'); const task = h.calls.intervals.at(-1)(); h.calls.reads.at(-1).resolve(payload('A', 2)); await task; assert.equal(h.roomRef.current.questions.length, 2); h.unmount();
});
await check('auth events retire reads immediately while unchanged sessions and unrelated storage do not reset them', async () => {
  const h = harness(), view = await h.loaded(); view.start('poll'); const task = h.calls.intervals.at(-1)(), old = h.calls.reads.at(-1);
  h.dispatch('storage', { key: 'music-volume' }); h.dispatch('auth-sync'); assert.equal(h.state.sessionEpoch, 0);
  h.changeSession('owner-B'); h.dispatch('auth-sync'); h.dispatch('auth-sync'); assert.equal(h.state.sessionEpoch, 1);
  old.resolve(payload('A', 3, { isHost: true, answer: 'retired' })); await task; assert.equal(h.roomRef.current, null); assert.equal(h.calls.remote.length, 0); h.unmount();
});
await check('unmount suppresses late success/error/finally and queued lifecycle loads', async () => {
  for (const reject of [false, true]) {
    const h = harness(); h.render(); await h.flush(); h.unmount(); const counts = sideEffects(h);
    if (reject) h.calls.reads[0].reject(Error('unmounted')); else h.calls.reads[0].resolve(payload('A')); await h.flush(); assert.deepEqual(sideEffects(h), counts);
  }
  const h = harness(); h.render(); h.unmount(); await h.flush(); assert.equal(h.calls.reads.length, 0);
});
await check('wrong-room data is rejected while current failures, empty input and host permissions remain visible', async () => {
  const h = harness(); h.render(); await h.flush(); h.calls.reads[0].resolve(payload('B')); await h.flush(); assert.equal(h.roomRef.current, null); assert.match(h.calls.errors.at(-1), /확인/);
  const retry = h.render().loadRoom(); h.calls.reads.at(-1).resolve(payload('A')); await retry; await h.render().addQuestion(); assert.equal(h.calls.feedback.at(-1)[0], 'invalid');
  h.state.hintText = 'hint'; const participant = h.render(); await participant.sendHintMessage(); await participant.closeRoom(); assert.equal(h.calls.posts.length, 0); assert.equal(h.calls.confirms.length, 0);
  h.state.questionText = 'question'; const task = h.render().addQuestion(); h.calls.posts.at(-1).resolve(payload('B', 2)); await task;
  assert.equal(h.roomRef.current._id, 'A'); assert.equal(h.state.questionText, 'question'); assert.equal(h.state.submitting, ''); h.unmount();
});
await check('real snapshot comparison includes viewer identity, host permissions and private answer', async () => {
  const h = harness(), view = await h.loaded(), a = payload('A').room;
  for (const patch of [{ viewerId: 'other' }, { isHost: true }, { answer: 'answer' }]) assert.notEqual(view.roomVersion(a), view.roomVersion({ ...a, ...patch })); h.unmount();
});
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
  Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function background(h, view, kind) {
  const cleanup = view.start(kind);
  const task = kind === 'poll' ? h.calls.intervals.at(-1)() : null;
  return { cleanup, task, pending: kind === 'poll' ? h.calls.reads.at(-1) : h.calls.posts.at(-1) };
}
async function resolveBackground(h, pending, data) { pending.pending.resolve(data); await pending.task; await h.flush(); }

await check('changed poll and presence normalize frozen room/data/plain envelopes once and commit the inspected object before announcing', async () => {
  for (const kind of ['poll', 'presence']) for (const envelope of ['room', 'data', 'plain']) {
    const h = harness(), view = await h.loaded();
    const row = { ...payload('A', 1).room, guesses: [{ _id: 'guess-1', correct: false }],
      hintMessages: [{ _id: 'hint-1', text: 'hint' }], participants: [
        { user: { _id: { $oid: 'participant-1' }, nickname: '  새 참가자  ' } }, { name: '식별자 없음' },
      ] };
    const raw = freeze(envelope === 'plain' ? row : { [envelope]: row }), before = structuredClone(raw);
    const count = h.calls.normalizations.length, trace = h.calls.trace.length, commits = h.calls.rooms.length;
    const pending = background(h, view, kind); await resolveBackground(h, pending, raw);
    assert.equal(h.calls.normalizations.length - count, 1, kind + '/' + envelope);
    const observed = h.calls.normalizations[count]; assert.equal(observed.payload, raw);
    assert.equal(h.roomRef.current, observed.output); assert.equal(h.state.storedRoom, observed.output);
    assert.equal(h.calls.rooms.length - commits, 1);
    assert.deepEqual(h.calls.trace.slice(trace).map(entry => entry.kind), ['normalize', 'commit', 'remote']);
    const committed = h.calls.trace[trace + 1]; assert.equal(committed.room, observed.output); assert.equal(committed.ref, observed.output);
    assert.equal(h.calls.remote.at(-1)[1], observed.output);
    assert.equal(observed.output.questions, row.questions); assert.equal(observed.output.guesses, row.guesses); assert.equal(observed.output.hintMessages, row.hintMessages);
    assert.notEqual(observed.output.participants, row.participants);
    assert.equal(observed.output.participants.length, 1); assert.equal(observed.output.participants[0]._id, 'participant-1');
    assert.equal(observed.output.participants[0].name, '새 참가자'); assert.deepEqual(raw, before);
    h.unmount();
  }
});
await check('unchanged or wrong-room background replies normalize once without commit or remote announcement', async () => {
  for (const kind of ['poll', 'presence']) for (const wrongRoom of [false, true]) {
    const h = harness(), view = await h.loaded(), original = h.roomRef.current;
    const count = h.calls.normalizations.length, commits = h.calls.rooms.length, remote = h.calls.remote.length;
    const pending = background(h, view, kind); await resolveBackground(h, pending, freeze(payload(wrongRoom ? 'B' : 'A')));
    assert.equal(h.calls.normalizations.length - count, 1); assert.equal(h.calls.rooms.length, commits);
    assert.equal(h.calls.remote.length, remote); assert.equal(h.roomRef.current, original);
    assert.equal(h.calls.toasts.length, 0);
    h.unmount();
  }
});
await check('disposed unmounted owner room session and superseded background replies never normalize retired data', async () => {
  for (const kind of ['poll', 'presence']) for (const retirement of ['disposed', 'unmounted', 'owner', 'room', 'session', 'superseded']) {
    const h = harness(), view = await h.loaded(), pending = background(h, view, kind);
    if (retirement === 'disposed') pending.cleanup();
    if (retirement === 'unmounted') h.unmount();
    if (retirement === 'owner') { h.changeSession('owner-B'); await h.loaded({ user: { id: 'owner-B' } }); }
    if (retirement === 'room') await h.loaded({ id: 'B' });
    if (retirement === 'session') h.changeSession();
    if (retirement === 'superseded') {
      const task = h.render().loadRoom(); h.calls.reads.at(-1).resolve(payload('A', 2)); await task;
    }
    const counts = sideEffects(h), previousEpoch = h.state.sessionEpoch;
    await resolveBackground(h, pending, freeze(payload('A', 3, { isHost: true, answer: 'retired private answer' })));
    assert.deepEqual(sideEffects(h), counts, kind + '/' + retirement);
    if (retirement === 'session') {
      assert.equal(h.state.sessionEpoch, previousEpoch + 1, 'Existing security retirement still invalidates the session scope');
      assert.equal(h.render({}, false).room, null, 'Private room stays hidden before replacement effects');
    }
    h.unmount();
  }
});
await check('raw load and all five mutations retain one normalization cache drafts feedback and finally ownership', async () => {
  const actions = {
    load: view => view.loadRoom(), question: view => view.addQuestion(), answer: view => view.answerQuestion('q0', 'yes'),
    guess: view => view.submitGuess(), hint: view => view.sendHintMessage(), close: view => view.closeRoom(),
  };
  const cacheKeys = ['/twenty-questions/A', '/twenty-questions', '/public/home-hub', '/public/search', '/public/users'];
  for (const [name, action] of Object.entries(actions)) for (const wrongRoom of [false, true]) {
    const h = harness(); await h.loaded({}, 1, { isHost: ['answer', 'hint', 'close'].includes(name) });
    Object.assign(h.state, { questionText: 'question draft', guessText: 'guess draft', hintText: 'hint draft' });
    const count = h.calls.normalizations.length, caches = h.calls.caches.length, rooms = h.calls.rooms.length;
    const task = action(h.render()), pending = name === 'load' ? h.calls.reads.at(-1) : h.calls.posts.at(-1);
    assert.ok(pending);
    const raw = freeze({ ...payload(wrongRoom ? 'B' : 'A', 2, { isHost: ['answer', 'hint', 'close'].includes(name),
      ...(name === 'close' ? { status: 'closed' } : {}) }), message: 'raw-' + name, correct: false, exhausted: false });
    const before = structuredClone(raw); pending.resolve(raw); await task;
    assert.equal(h.calls.normalizations.length - count, 1, name + '/' + wrongRoom); assert.deepEqual(raw, before);
    assert.equal(h.state.submitting, ''); assert.equal(h.submittingRef.current, '');
    if (wrongRoom) {
      assert.equal(h.calls.caches.length, caches);
      assert.deepEqual([h.state.questionText, h.state.guessText, h.state.hintText], ['question draft', 'guess draft', 'hint draft']);
      if (name === 'load') { assert.equal(h.roomRef.current, null); assert.equal(h.state.loading, false); }
      else { assert.equal(h.calls.rooms.length, rooms); assert.equal(h.calls.feedback.at(-1)[0], name + 'Failure'); }
      assert.equal(h.calls.toasts.at(-1).tone, 'danger');
    } else {
      assert.equal(h.roomRef.current, h.calls.normalizations[count].output); assert.equal(h.calls.rooms.length, rooms + 1);
      if (name === 'load') { assert.equal(h.calls.caches.length, caches); assert.equal(h.state.loading, false); }
      else {
        assert.deepEqual(h.calls.caches.slice(caches), cacheKeys); assert.equal(h.calls.feedback.at(-1)[0], name);
        assert.equal(h.calls.toasts.at(-1).message, 'raw-' + name);
      }
      assert.equal(h.state.questionText, name === 'question' ? '' : 'question draft');
      assert.equal(h.state.guessText, name === 'guess' ? '' : 'guess draft');
      assert.equal(h.state.hintText, name === 'hint' ? '' : 'hint draft');
    }
    h.unmount();
  }
});
await check('viewer permission and private-answer-only changes still pass version comparison and commit once', async () => {
  for (const patch of [{ viewerId: 'viewer-new' }, { isHost: true }, { answer: 'current private answer' }, { answerRevealed: true }]) {
    const h = harness(), view = await h.loaded(), count = h.calls.normalizations.length, rooms = h.calls.rooms.length;
    const pending = background(h, view, 'poll'); await resolveBackground(h, pending, freeze(payload('A', 0, patch)));
    assert.equal(h.calls.normalizations.length - count, 1); assert.equal(h.calls.rooms.length, rooms + 1);
    for (const [key, value] of Object.entries(patch)) assert.equal(h.roomRef.current[key], value);
    h.unmount();
  }
});
await check('actual remote announcement callback preserves status answer hint milestone and membership precedence', () => {
  assert.ok(declarations.has('announceRemoteRoomChange'));
  const notifications = [];
  const announceRemote = new Function('useCallback', 'announce', 'twentyQuestionsProgressTransition',
    `${pure}\n${declarations.get('announceRemoteRoomChange')}\nreturn announceRemoteRoomChange;`)(
    callback => callback, (...args) => notifications.push(args), twentyQuestionsProgressTransition);
  const base = { ...payload('A').room, viewerId: 'self', attemptCount: 0, maxQuestions: 20,
    guesses: [], hintMessages: [], participants: [{ _id: 'self', name: '본인' }, { _id: 'left', name: '이전 참가자' }] };
  const cases = [
    [base, { ...base, status: 'solved', solvedByName: '정답자', hintMessages: [{ _id: 'h' }] }, 'remoteSolved'],
    [base, { ...base, status: 'closed', attemptCount: 20 }, 'limitReveal'],
    [base, { ...base, status: 'closed', attemptCount: 1 }, 'close'],
    [{ ...base, questions: [{ _id: 'q', response: 'pending' }] }, { ...base, questions: [{ _id: 'q', response: 'yes', responseLabel: '예' }], hintMessages: [{ _id: 'h' }] }, 'answer'],
    [base, { ...base, hintMessages: [{ _id: 'h' }], attemptCount: 10 }, 'remoteHint'],
    [{ ...base, attemptCount: 9 }, { ...base, attemptCount: 10, questions: [{ _id: 'q' }] }, 'phaseNarrow'],
    [{ ...base, attemptCount: 14 }, { ...base, attemptCount: 15 }, 'phaseFinal'],
    [{ ...base, attemptCount: 19 }, { ...base, attemptCount: 20, pendingCount: 1 }, 'phasePending'],
    [base, { ...base, questions: [{ _id: 'q' }], attemptCount: 1 }, 'remoteQuestion'],
    [base, { ...base, guesses: [{ _id: 'g', correct: false, guesserName: '참가자' }], attemptCount: 1 }, 'remoteWrong'],
    [base, { ...base, participants: [{ _id: 'self' }, { _id: 'joined', name: '새 참가자' }] }, 'participantJoin'],
    [base, { ...base, participants: [{ _id: 'self' }] }, 'participantLeave'],
  ];
  for (const [previous, next, action] of cases) {
    freeze(previous); freeze(next); const count = notifications.length;
    announceRemote(previous, next); assert.equal(notifications.length, count + 1); assert.equal(notifications.at(-1)[0], action);
  }
  const count = notifications.length;
  announceRemote(null, base); announceRemote(base, base);
  announceRemote({ ...base, participants: [] }, { ...base, participants: [{ _id: 'self' }] });
  assert.equal(notifications.length, count, 'Missing previous state, unchanged room and own presence do not announce');
});
console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Actual current-source declarations/lifecycle/poll/presence/mutation callbacks and separate actual remote announcement with deferred API and controlled hooks. The unchanged normalizer is instrumented for calls and returned-object identity. No network, account writes, mounted React, independent authenticated actors or real browser acceptance.' }));
if (failures.length) process.exitCode = 1;
