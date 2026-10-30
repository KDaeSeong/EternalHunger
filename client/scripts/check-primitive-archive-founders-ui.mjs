import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextImageModule from 'next/image.js';
import postcss from 'postcss';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { createFounderHistory, founderHistoryRows, isValidFounderHistory } from '../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js';

const root = new URL('../', import.meta.url);
const components = new URL('src/app/games/primitive-archive/_components/', root);
const foundersUrl = new URL('PrimitiveArchiveFoundersTab.js', components).href;
const tabsUrl = new URL('PrimitiveArchiveFeatureTabs.js', components).href;
const runTabUrl = new URL('PrimitiveArchiveRunTab.js', components).href;
const transformed = new Set([foundersUrl, tabsUrl, runTabUrl]);
const dataModule = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
globalThis.__primitiveFoundersReact = React;
globalThis.__primitiveFoundersImage = nextImageModule.default;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === tabsUrl && specifier.startsWith('./PrimitiveArchive')
      && specifier !== './PrimitiveArchiveFoundersTab') {
      return { url: `data:text/javascript,${encodeURIComponent(`export default function Stub() { return globalThis.__primitiveFoundersReact.createElement('div', {'data-other-workspace': true}); }`)}`, shortCircuit: true };
    }
    if (context.parentURL === foundersUrl && specifier === 'next/image') {
      return { url: 'data:text/javascript,export default globalThis.__primitiveFoundersImage;', shortCircuit: true };
    }
    if (context.parentURL === runTabUrl) {
      // Keep the actual RunTab, selection handlers, engine and progression.
      // Only presentation wrappers are replaced to avoid loading the app shell.
      if (specifier === 'next/link') return dataModule(`export default function Link(props) {
        return globalThis.__primitiveFoundersReact.createElement('a', props); }`);
      if (specifier === '../../_components/GamePlayPrimitives') return dataModule(`
        function Button(props) { return globalThis.__primitiveFoundersReact.createElement('button', {
          type: 'button', disabled: props.disabled, onClick: props.onClick, 'data-action': props.action,
          title: props.title, children: props.children }); }
        export { Button as ActionButton, Button as GameControlButton };`);
      if (specifier === './PrimitiveArchiveVisuals') return dataModule(`
        export function PrimitiveArchivePanelTitle(props) {
          return globalThis.__primitiveFoundersReact.createElement('header', null,
            globalThis.__primitiveFoundersReact.createElement('h2', null, props.title), props.meta, props.children); }`);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!transformed.has(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText };
  },
});
const { default: Founders } = await import(foundersUrl);
const { default: FeatureTabs } = await import(tabsUrl);
const { default: RunTab } = await import(runTabUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { STUDENTS } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const render = (props) => renderToStaticMarkup(React.createElement(Founders, props));
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const party = [
  { id: 'f1', name: '<창건 & 하나>', role: '제작', portrait: '/test-founder.png', hp: 100 },
  { id: 'f2', name: '기록된 두 번째 인물', role: '지원', hp: 0 },
];
const history = createFounderHistory({ party, day: 1, runId: 'founders-ui-check' });
history.members[0].tallies = { gather: 12, research_contribution: 2 };
history.members[0].recentDeeds = Array.from({ length: 8 }, (_, index) => ({
  day: 89 + index, kind: 'gather', target: 'unknown-internal-target', gains: [['berry', 1]],
}));
history.members[1].deathRecord = { day: 9, source: 'night', reason: '허기와 추위', hpBefore: 10, damage: 10,
  hungerDamage: 4, coldDamage: 6, hypothermiaDamage: 0 };
const state = freeze({ runId: 'founders-ui-check', day: 100, party, founderHistory: history });
assert.equal(isValidFounderHistory(state.founderHistory, state), true,
  'The UI fixture must satisfy the current stored-history validator.');
const rows = freeze(founderHistoryRows(state));
const before = JSON.stringify({ state, rows });
const html = render({ state, foundersRows: rows });

check('actual founder rows render identity, observed dates and measured activity without changing data', () => {
  assert.match(html, /&lt;창건 &amp; 하나&gt;/);
  assert.match(html, /제작 · 창건 인물/);
  assert.match(html, /2명 확정/);
  assert.match(html, /12회/);
  assert.match(html, /연구 기여/);
  assert.ok(!html.includes('연구 완료'));
  assert.match(html, /src="[^\"]*test-founder/);
  assert.equal(JSON.stringify({ state, rows }), before);
});
check('real SSR retains at most eight recent deeds, translated gains and confirmed death reason', () => {
  assert.equal((html.match(/<li>/g) || []).length, 8);
  assert.ok(html.indexOf('96일차') < html.indexOf('89일차'));
  assert.ok(!html.includes('88일차'));
  assert.ok(!html.includes('unknown-internal-target'));
  assert.ok(!html.includes('berry'));
  assert.match(html, /9일차 · 밤 정산 · 허기와 추위 · HP 피해 10/);
  assert.equal((html.match(/<details /g) || []).length, 2);
  assert.equal((html.match(/ open=""/g) || []).length, 1);
  assert.equal((html.match(/<summary>/g) || []).length, 2);
});
check('legacy records admit unknown founders and do not invent a death or inherited power', () => {
  const legacyState = { runId: 'legacy-ui', day: 30, party: [{ id: 'old', name: '옛 인물', hp: 0 }] };
  const legacyRows = founderHistoryRows(legacyState);
  const legacyHtml = render({ foundersRows: legacyRows });
  assert.match(legacyHtml, /30일차/);
  assert.match(legacyHtml, /과거 창건 명단과 기록되지 않은 업적은 추정하지 않습니다/);
  assert.match(legacyHtml, /<dt>창건 명단<\/dt><dd>미상<\/dd>/);
  assert.match(legacyHtml, /생존 미확인/);
  assert.ok(!legacyHtml.includes('사망 기록'));
  assert.match(legacyHtml, /조상신 숭배·가호·후대 계승 기능은 아직 제공하지 않습니다/);
  assert.ok(!legacyHtml.includes('<button'));
  assert.ok(!legacyHtml.includes('계승 완료'));
});
check('empty and long-text rows render safely with native expandable summaries', () => {
  assert.match(render({}), /아직 관찰된 인물 기록이 없습니다/);
  const longName = `창건자${'매우긴이름'.repeat(100)}<script>unsafe</script>`;
  const longHtml = render({ foundersRows: [{ actorId: 'long', name: longName, role: '지원',
    firstObservedDay: 1, observedFromDay: 1, living: true, tallies: {}, recentDeeds: [] }] });
  assert.ok(longHtml.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!longHtml.includes('<script>unsafe'));
  assert.match(longHtml, /<summary>/);
  assert.match(longHtml, /분야별 활동 기록/);
});

const tabProps = {
  activeTabId: 'founders', state: { ...state, ap: 4, camp: { fuel: 3 } }, foundersRows: rows,
  archiveReport: { grade: 'B' }, inventoryRows: [], partyCap: 4, regions: [],
  research: { unlocked: true, completed: 1, total: 2 }, civics: { completed: 1, total: 2 },
  tribe: { population: 6 }, currentDifficulty: { label: '보통' }, showDeveloperTools: false,
};
const tabsHtml = renderToStaticMarkup(React.createElement(FeatureTabs, tabProps));
check('secondary founder tab renders the actual panel while primary order and developer gate remain intact', () => {
  const primary = tabsHtml.match(/class="primitive-primary-tabs"[\s\S]*?<\/div>/)?.[0] || '';
  assert.deepEqual([...primary.matchAll(/id="primitive-archive-tab-([^\"]+)"/g)].map((match) => match[1]),
    ['actions', 'camp', 'growth']);
  assert.ok(!primary.includes('founders'));
  assert.match(tabsHtml, /id="primitive-archive-tab-founders" aria-current="page"/);
  assert.match(tabsHtml, /aria-labelledby="primitive-archive-tab-founders"/);
  assert.ok(!tabsHtml.includes('primitive-archive-tab-developer'));
  assert.match(tabsHtml, /&lt;창건 &amp; 하나&gt;/);
  assert.ok(renderToStaticMarkup(React.createElement(FeatureTabs, { ...tabProps, showDeveloperTools: true }))
    .includes('primitive-archive-tab-developer'));
});
check('actual secondary click selects founders, closes its menu and restores summary focus', () => {
  let selected;
  let focused = false;
  const menu = { open: true, querySelector: () => ({ focus: () => { focused = true; } }) };
  const tree = FeatureTabs({ ...tabProps, activeTabId: 'actions', setActiveTabId: (id) => { selected = id; } });
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.id === 'primitive-archive-tab-founders') return node;
    return React.Children.toArray(node.props?.children).map(find).find(Boolean);
  };
  const button = find(tree);
  assert.ok(button);
  button.props.onClick({ currentTarget: { closest: () => menu } });
  assert.equal(selected, 'founders');
  assert.equal(menu.open, false);
  assert.equal(focused, true);
});
const findNodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children)
    .flatMap((child) => findNodes(child, predicate))];
};
const selectionIds = STUDENTS.slice(0, 3).map((member) => member.id);
const runState = freeze(engine.createNewState({ runId: 'founder-selection-ui-check',
  now: '2026-10-30T00:00:00.000Z', rng: () => 0.5, founderIds: selectionIds }));
const runStateBefore = JSON.stringify(runState);
const runDifficulty = engine.difficultyRows().find((row) => row.key === runState.difficulty);
let selection = freeze([...selectionIds]);
let startCalls = 0;
const selectionProps = () => ({
  state: runState, currentDifficulty: runDifficulty, selectedDifficulty: runDifficulty,
  newRunDifficulty: runState.difficulty, founderChoices: STUDENTS, newRunFounderIds: selection,
  setNewRunFounderIds: (update) => { selection = freeze(typeof update === 'function' ? update(selection) : update); },
  startNewRun: () => { startCalls += 1; }, hydrated: true, token: null, busy: false,
  archiveVictory: engine.archiveVictorySummary(runState), setNewRunDifficulty: () => {},
});
const selectionTree = () => RunTab(selectionProps());
const selectionInputs = () => findNodes(selectionTree(), (node) => node.type === 'input' && node.props.type === 'checkbox');
const newRunButton = (tree) => findNodes(tree, (node) => node.props?.action === 'new')[0];

check('actual RunTab renders named native founder checkboxes, a three-person limit and accessible guidance', () => {
  const runHtml = renderToStaticMarkup(React.createElement(RunTab, selectionProps()));
  assert.match(runHtml, /<fieldset class="primitive-founder-selection"/);
  assert.match(runHtml, /<legend>다음 런의 창건자 · 3\/3명 선택<\/legend>/);
  assert.match(runHtml, /id="primitive-founder-selection-help"/);
  assert.equal((runHtml.match(/type="checkbox"/g) || []).length, STUDENTS.length);
  const inputs = selectionInputs();
  assert.equal(inputs.length, STUDENTS.length);
  assert.deepEqual(inputs.map((node) => node.props.checked), STUDENTS.map((member) => selection.includes(member.id)));
  for (const [index, node] of inputs.entries()) {
    assert.equal(node.props['aria-describedby'], 'primitive-founder-selection-help');
    assert.equal(node.props.disabled, index >= 3);
    assert.ok(runHtml.includes(STUDENTS[index].name));
  }
  assert.equal(newRunButton(selectionTree()).props.disabled, false);
});
check('native checkbox updates enforce the cap, allow replacement and preserve user selection order', () => {
  const cappedSelection = selection;
  selectionInputs()[3].props.onChange({ target: { checked: true } });
  assert.equal(selection, cappedSelection, 'The actual updater must also reject an extra selection from a stale event.');
  selectionInputs()[1].props.onChange({ target: { checked: false } });
  assert.deepEqual(selection, [selectionIds[0], selectionIds[2]]);
  assert.equal(newRunButton(selectionTree()).props.disabled, true);
  assert.equal(selectionInputs()[3].props.disabled, false);
  selectionInputs()[3].props.onChange({ target: { checked: true } });
  assert.deepEqual(selection, [selectionIds[0], selectionIds[2], STUDENTS[3].id]);
  const beforeDuplicate = selection;
  selectionInputs()[2].props.onChange({ target: { checked: true } });
  assert.equal(selection, beforeDuplicate, 'Repeated checked events must not duplicate a founder.');
  selectionInputs()[0].props.onChange({ target: { checked: false } });
  selectionInputs()[0].props.onChange({ target: { checked: true } });
  assert.deepEqual(selection, [selectionIds[2], STUDENTS[3].id, selectionIds[0]]);
  assert.equal(newRunButton(selectionTree()).props.disabled, false);
  assert.deepEqual(selectionIds, STUDENTS.slice(0, 3).map((member) => member.id));
});
check('incomplete selection and persistence lock disable new runs while current people and history remain unchanged', () => {
  for (const count of [0, 1, 2]) {
    const props = { ...selectionProps(), newRunFounderIds: selection.slice(0, count) };
    const tree = RunTab(props);
    assert.equal(newRunButton(tree).props.disabled, true);
    const runHtml = renderToStaticMarkup(React.createElement(RunTab, props));
    assert.match(runHtml, /창건자 3명을 선택해야 새 런을 시작할 수 있습니다/);
    assert.match(runHtml, /<button[^>]*disabled=""[^>]*data-action="new"/);
  }
  const lockedTree = RunTab({ ...selectionProps(), busy: 'save' });
  assert.equal(findNodes(lockedTree, (node) => node.type === 'fieldset')[0].props.disabled, true);
  assert.equal(newRunButton(lockedTree).props.disabled, true);
  assert.equal(startCalls, 0, 'Changing the next-run selection must not start or reset a run.');
  assert.equal(JSON.stringify(runState), runStateBefore);
});
check('theme stylesheet parses with narrow-screen wrapping and visible keyboard focus', () => {
  const css = readFileSync(new URL('src/styles/PrimitiveArchiveFounders.css', root), 'utf8');
  const stylesheet = postcss.parse(css);
  const media = [];
  stylesheet.walkAtRules('media', (rule) => media.push(rule.params));
  assert.ok(media.includes('(max-width: 480px)'));
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /min-width: 0/);
  assert.match(css, /:focus-visible[\s\S]*var\(--era-focus\)/);
  assert.match(css, /var\(--era-surface\)/);
});
delete globalThis.__primitiveFoundersReact;
delete globalThis.__primitiveFoundersImage;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual founder/FeatureTabs/RunTab SSR, native selection handlers and current-state immutability; stylesheet syntax/guards. Presentation button/title/link wrappers only are substituted for RunTab. Not browser layout, live game, new-run controller or save integration acceptance.' }));
