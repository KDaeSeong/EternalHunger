import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const client = path.join(root, 'client');
const requireClient = createRequire(path.join(client, 'package.json'));
const importClient = async name => import(pathToFileURL(requireClient.resolve(name)).href);
const React = (await importClient('react')).default;
const ts = (await importClient('typescript')).default;
const postcss = (await importClient('postcss')).default;
const { renderToStaticMarkup } = await importClient('react-dom/server');
await import(pathToFileURL(path.join(client, 'scripts/lib/register-simulation-modules.mjs')).href);

const enginePath = path.join(client, 'src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const playPath = path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js');
const read = file => readFileSync(file, 'utf8');
const playSource = read(playPath);
const primitivesUrl = pathToFileURL(path.join(client, 'src/app/games/_components/GamePlayPrimitives.js')).href;
const iconUrl = pathToFileURL(path.join(client, 'src/app/games/_components/GameActionIcon.js')).href;
const focusUrl = pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchiveFocusPanel.js')).href;
const operationsUrl = pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchiveOperationsSummary.js')).href;
const annualOperationsUrl = pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchiveAnnualOperations.js')).href;
const foodOutlookUrl = pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchiveFoodOutlook.js')).href;
registerHooks({
  load(url, context, nextLoad) {
    if (![primitivesUrl, iconUrl, focusUrl, operationsUrl, annualOperationsUrl, foodOutlookUrl].includes(url)) return nextLoad(url, context);
    const source = read(new URL(url));
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const engine = await import(pathToFileURL(enginePath).href);
const feedback = await import(pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js')).href);
const soundtrack = await import(pathToFileURL(path.join(client, 'src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js')).href);
const { GameControlButton } = await import(primitivesUrl);
const { default: Focus } = await import(focusUrl);
const { default: Operations } = await import(operationsUrl);
function declaration(sourceText, name) {
  const source = ts.createSourceFile('PrimitiveArchivePlayContent.js', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      assert.equal(found, undefined, `Ambiguous page declaration: ${name}`);
      found = `const ${node.getText(source)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(found, `Missing actual page declaration: ${name}`);
  return found;
}
// Execute declarations extracted from the current page. Hook-return values and
// UI setters below are controlled inputs, not mounted React/checkpoint lifecycle.
// Engine, feedback, music selection and native button are actual product modules.
const selectedSource = ['applyAction', 'settlementDay', 'settlementDayExpected', 'settlementDayControl', 'autoDayControl']
  .map(name => declaration(playSource, name)).join('\n');
const compiled = ts.transpileModule(selectedSource, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext },
}).outputText;
const clone = value => JSON.parse(JSON.stringify(value));
const visible = state => { const result = clone(state); delete result.log; delete result.updatedAt; return result; };
const fresh = (runId = 'settlement-day-ui-fresh') => {
  const state = engine.createNewState({ runId, now: '2026-11-04T00:00:00.000Z', rng: () => 0.5 });
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp = { ...state.camp, shelterLevel: 1, workbenchLevel: 1, fireLevel: 1, fuel: 10 };
  state.inventory = { ...state.inventory, berry: 40, wood: 20 };
  return state;
};
function renderHandler(state = fresh(), overrides = {}) {
  const calls = { state: [], feedback: [], result: [], sounds: [] };
  const ref = { current: state };
  const scope = {
    ...engine, ...feedback, ...soundtrack, React, GameControlButton,
    state, stateRef: ref, hydrated: true, checkpoint: { ready: true, exclusive: true, status: 'ready' },
    busy: '', shopControlsBusy: false, shopStartRef: { current: false }, canAct: true,
    showDeveloperTools: false, actorId: state.party[0].id,
    musicSceneTimerRef: { current: null }, eraArrivalTimerRef: { current: null }, baseMusicScene: 'archive-camp',
    playGameSfx: cue => calls.sounds.push(cue), setMusicScene: () => {}, setActorId: () => {}, setArrivingEraId: () => {},
    setState: value => calls.state.push(value), setActionResult: value => calls.result.push(value),
    setMessage: () => {}, setActionFeedback: value => calls.feedback.push(value), ...overrides,
  };
  scope.actionOwnerSession = null;
  scope.isCurrentAuthSession = () => true;
  scope.actionVersionRef = { current: 0 };
  scope.checkpoint = { ...scope.checkpoint, canMutate: () => scope.checkpoint.ready && scope.checkpoint.exclusive };
  const factory = new Function(...Object.keys(scope), `${compiled}\nreturn { autoDayControl, settlementDayControl, applyAction };`);
  const result = factory(...Object.values(scope));
  const control = result.settlementDayControl;
  return { ...result, scope, calls, ref, control, button: control ? GameControlButton(control.props) : null };
}
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
function invoke(button, native = false) {
  if (native && button.props.disabled) return;
  const previousRandom = Math.random;
  const previousWindow = globalThis.window;
  Math.random = () => 0.5;
  globalThis.window = { clearTimeout() {}, setTimeout() { return 1; } };
  try { button.props.onClick(); } finally {
    Math.random = previousRandom;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
}
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS ' + name); };
check('actual native control exposes AP forfeiture and a named risk description without changing the old auto header', () => {
  const view = renderHandler();
  assert.equal(view.button.props.disabled, false);
  const html = renderToStaticMarkup(view.control);
  assert.match(html, /정착 운영/); assert.match(html, /AP 4 포기하고 하루 진행/);
  assert.match(html, /aria-describedby="primitive-settlement-day-risk"/);
  assert.match(html, /aria-label="정착 운영: 남은 개인 행동력 4 포기하고 하루 진행"/);
  assert.equal(view.button.type, 'button'); assert.equal(view.button.props.type, 'button');
  assert.equal(view.autoDayControl.type, GameControlButton);
  assert.equal(view.autoDayControl.props.action, 'auto');
  assert.equal(view.autoDayControl.props.cue, 'off');
  assert.equal(view.autoDayControl.props.className, 'primitive-auto-day');
  assert.equal(textOf(view.autoDayControl), '하루 자동 운영');
  assert.equal(view.autoDayControl.props.disabled, false);
  invoke(GameControlButton(view.autoDayControl.props), true);
  assert.deepEqual(visible(view.ref.current), visible(engine.runAutoDayAction(view.scope.state, { rng: () => 0.5 })));
  const blocked = renderHandler(fresh(), { canAct: false });
  assert.equal(blocked.autoDayControl.props.disabled, true);
  invoke(GameControlButton(blocked.autoDayControl.props), true);
  assert.equal(blocked.calls.state.length, 0);
});
check('operations command and full physical-stock risk remain outside closed details and hide when blocked or ended', () => {
  const view = renderHandler(), operations = engine.settlementOperationsSummary(view.ref.current);
  const html = renderToStaticMarkup(React.createElement(Operations, { operations, dayControl: view.control }));
  assert.match(html, /<details class="primitive-operations__details">/);
  assert.ok(html.indexOf('primitive-operations__day-control') > html.indexOf('</details>'));
  assert.match(html, /id="primitive-settlement-day-risk"/);
  assert.equal((html.match(/id="primitive-settlement-day-risk"/g) || []).length, 1);
  assert.ok(html.indexOf('id="primitive-settlement-day-risk"') > html.indexOf('</details>'));
  assert.match(html, /현재 비축/); assert.match(html, /다음 날 생산을 미리 쓰지/); assert.match(html, /피해나 사망/);
  assert.ok(html.includes('개인 행동력 4 포기하고 하루 진행'));
  for (const extra of [{ blocked: true }, { operations: { ...operations, ended: true } }]) {
    const blocked = renderToStaticMarkup(React.createElement(Operations, { operations, dayControl: view.control, ...extra }));
    assert.ok(!blocked.includes('primitive-operations__day-control'));
  }
});
check('actual global FocusPanel forwards the command before tab content rather than through the action workspace', () => {
  const view = renderHandler(), operations = engine.settlementOperationsSummary(view.ref.current);
  const plan = { objective: { title: '현재 목표', detail: '기존 목표' }, night: { rows: [], tone: 'ready', title: '이번 밤', detail: '기존 전망' }, blocked: false };
  const html = renderToStaticMarkup(React.createElement(Focus, { plan, operations, dayControl: view.control }));
  assert.match(html, /primitive-operations__day-control/);
  assert.match(html, /aria-describedby="primitive-settlement-day-risk"/);
  assert.ok(!renderToStaticMarkup(React.createElement(Focus, {
    plan: { ...plan, blocked: true }, operations, dayControl: view.control,
  })).includes('primitive-operations__day-control'));
  const source = ts.createSourceFile('PrimitiveArchivePlayContent.js', playSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let focus, tabs;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PrimitiveArchiveFocusPanel') focus = node;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PrimitiveArchiveFeatureTabs') tabs = node;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(focus && tabs); assert.equal(focus.parent, tabs.parent);
  assert.ok(focus.pos < tabs.pos);
  const dayControl = focus.attributes.properties.find(attribute => attribute.name?.getText(source) === 'dayControl');
  assert.ok(dayControl?.initializer && ts.isJsxExpression(dayControl.initializer));
  const forwardDayControl = new Function('annualMode', 'settlementDayControl', `return ${dayControl.initializer.expression.getText(source)};`);
  const dailyControl = {};
  assert.equal(forwardDayControl(false, dailyControl), dailyControl);
  assert.equal(forwardDayControl(true, dailyControl), null);
  assert.match(tabs.getText(source), /autoDayControl=\{autoDayControl\}/);
  assert.doesNotMatch(tabs.getText(source), /dayControl=\{settlementDayControl\}/);
  const workspaceSource = read(path.join(client, 'src/app/games/primitive-archive/_components/PrimitiveArchiveActionWorkspace.js'));
  const workspace = ts.createSourceFile('PrimitiveArchiveActionWorkspace.js', workspaceSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let quickHeader;
  const visitWorkspace = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(workspace) === 'PrimitiveArchivePanelTitle'
      && node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(workspace) === 'title'
        && attribute.initializer?.text === '빠른 행동')) quickHeader = node;
    ts.forEachChild(node, visitWorkspace);
  };
  visitWorkspace(workspace);
  assert.ok(quickHeader, 'Existing quick-action header remains present');
  assert.match(quickHeader.getText(workspace), /\{autoDayControl \|\| null\}/);
  assert.doesNotMatch(quickHeader.getText(workspace), /settlementDay/);
});
check('one actual page click equals one existing boundary with real feedback and no personal rewards', () => {
  const state = fresh(), before = clone(state), view = renderHandler(state);
  invoke(view.button, true);
  const expected = engine.advanceDay({ ...clone(state), ap: 0 }, { rng: () => 0.5 });
  assert.deepEqual(state, before);
  assert.equal(view.ref.current.day, state.day + 1);
  assert.deepEqual(visible(view.ref.current), visible(expected));
  assert.equal(view.calls.feedback.length, 1); assert.equal(view.calls.state.length, 1);
  assert.match(view.calls.result[0], /정착 운영|하루|Day/);
});
check('double invocation of the old rendered handler cannot settle another day', () => {
  const view = renderHandler();
  invoke(view.button); const after = view.ref.current;
  invoke(view.button);
  assert.equal(view.ref.current, after); assert.equal(after.day, view.scope.state.day + 1);
});
check('changed live run day AP or update stamp refuses the old rendered handler', () => {
  for (const [key, value] of [['runId', 'another-run'], ['day', 4], ['ap', 1], ['updatedAt', '2026-11-04T00:00:01.000Z']]) {
    const view = renderHandler();
    const current = key === 'runId' ? fresh(value) : { ...view.ref.current, [key]: value };
    view.ref.current = current; invoke(view.button);
    assert.equal(view.ref.current, current, key);
  }
});
check('owner bootstrap writer lease save load and shop guards disable and reject direct callbacks', () => {
  const guards = [
    { checkpoint: { ready: false, exclusive: false, status: 'owner-unknown' } },
    { checkpoint: { ready: false, exclusive: false, status: 'loading' } },
    { checkpoint: { ready: true, exclusive: false, status: 'conflict' } },
    { busy: 'save' }, { busy: 'load' }, { shopControlsBusy: true }, { shopStartRef: { current: true } },
  ];
  for (const guard of guards) {
    const view = renderHandler(fresh(), guard), before = view.ref.current;
    assert.equal(view.button.props.disabled, true);
    invoke(view.button); assert.equal(view.ref.current, before); assert.equal(view.calls.state.length, 0);
  }
  const unhydrated = renderHandler(fresh(), { hydrated: false });
  assert.equal(unhydrated.button.props.disabled, true);
  invoke(unhydrated.button, true); assert.equal(unhydrated.calls.state.length, 0);
});
check('existing conflict and unavailable memory-progress policy stays enabled for the held writer', () => {
  for (const status of ['conflict', 'unavailable', 'corrupt']) {
    const view = renderHandler(fresh(), { checkpoint: { ready: true, exclusive: true, status } });
    assert.equal(view.button.props.disabled, false); invoke(view.button, true);
    assert.equal(view.ref.current.day, view.scope.state.day + 1);
  }
});
check('ended zero AP extinct or unestablished states do not render the new command', () => {
  for (const change of [state => { state.ended = true; }, state => { state.ap = 0; },
    state => { state.party = state.party.map(member => ({ ...member, hp: 0 })); },
    state => { state.research.completed.SETTLEMENT = false; }, state => { state.tribe.morale = 0; }]) {
    const state = fresh(); change(state); assert.equal(renderHandler(state).button, null);
  }
});
check('a real hunt casualty selected as actor does not block surviving companions day progression', () => {
  let state = fresh(); state.party[0].hp = 1;
  state = engine.runHuntAction(state, state.party[0].id, 'plains', { rng: () => 0.999999 });
  assert.equal(state.party[0].hp, 0);
  const view = renderHandler(state, { canAct: false });
  assert.equal(view.autoDayControl.props.disabled, true);
  assert.equal(view.button.props.disabled, false); invoke(view.button, true);
  assert.equal(view.ref.current.day, state.day + 1);
});
check('operations command wraps with era tokens and risk text overrides the existing compact focus paragraph hiding', () => {
  const current = read(path.join(client, 'src/styles/PrimitiveArchiveOperations.css'));
  const parsed = postcss.parse(current);
  const rules = [];
  parsed.walkRules(rule => {
    if (rule.selector.includes('.primitive-operations__day-control') || rule.selector.includes('.primitive-settlement-day')) rules.push(rule);
  });
  assert.ok(rules.some(rule => rule.selector.endsWith('.primitive-settlement-day') && rule.nodes.some(node => node.prop === 'white-space' && node.value === 'normal')));
  assert.ok(rules.some(rule => rule.selector.endsWith('.primitive-operations__day-control') && rule.nodes.some(node => node.prop === 'flex-wrap' && node.value === 'wrap')));
  const risk = rules.find(rule => rule.selector.endsWith('.primitive-operations__day-risk'));
  assert.ok(risk); assert.equal((risk.selector.match(/\./g) || []).length, 5);
  for (const [prop, value] of [['display', 'block'], ['overflow', 'visible'], ['-webkit-line-clamp', 'unset']]) assert.ok(risk.nodes.some(node => node.prop === prop && node.value === value));
  for (const rule of rules) rule.walkDecls(node => {
    if (/(color|background|border)/.test(node.prop)) assert.match(node.value, /var\(--era-/);
  });
});
console.log(JSON.stringify({ pass: true, checks, mode: 'actual-source',
  scope: 'Real page AST handler/control declarations, native button, engine and feedback with fresh inputs. Controlled hook-return values and UI setters; no mounted checkpoint hook, browser, storage writes, server, layout geometry or human acceptance.',
  generatedResultFiles: 0 }));
