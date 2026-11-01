import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('src/app/games/primitive-archive/_components/PrimitiveArchiveOperationsSummary.js', root).href;
const primitivesUrl = new URL('src/app/games/_components/GamePlayPrimitives.js', root).href;
const iconUrl = new URL('src/app/games/_components/GameActionIcon.js', root).href;
const transformed = new Set([componentUrl, primitivesUrl, iconUrl]);
globalThis.__operationsUiReact = React;
const hooksSource = `export function useState(initial) {
  const harness = globalThis.__operationsUiHooks;
  if (!harness) return globalThis.__operationsUiReact.useState(initial);
  const index = harness.cursor++;
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
  return [harness.values[index], value => {
    harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value;
  }];
}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === componentUrl && specifier === 'react') {
      return { url: `data:text/javascript,${encodeURIComponent(hooksSource)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!transformed.has(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Operations } = await import(componentUrl);
const { GameControlButton } = await import(primitivesUrl);
const { createNewState, settlementOperationsSummary } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const operations = freeze({ enabled: true, ended: false, day: 21, tone: 'warning',
  summaryText: '저녁 2명 보충 예정 · 다음 아침 부족 배식 3/4단위',
  timingText: '현재 비축으로 저녁을 보충하고 밤을 보낸 뒤, 다음 아침 생산과 배식을 정산합니다.',
  issues: [{ id: 'food', text: '오늘 저녁 1명에게 식량이 부족합니다.', tabId: 'actions' },
    { id: 'fuel', text: '이번 밤 땔감이 부족합니다.', tabId: 'camp' }],
  rows: [{ id: 'stock', title: '현재 부족·가구 비축', text: '배식 필요 4단위 · 현재 비축 3단위' },
    { id: 'evening', title: '오늘 저녁(예상)', text: '나무 1개 → 연료 +2 · 대원 2명 배식' },
    { id: 'morning', title: '다음 아침(현재 배치 고정 전망)', text: '생산 베리 2개 · 부족 배식 3/4단위' },
    { id: 'receipt', title: '최근 아침(실제)', text: '최근 생산 나무 3개 · 최근 배식 4/4단위' }],
  investments: [{ id: 'builder', title: '건설에 투자', text: '건설 일손 1명 · 사업 +1 작업/일', available: true, reason: '실행 가능한 사업 선택됨' },
    { id: 'scholar', title: '연구에 투자', text: '연구 일손 1명 · +1RP/일', available: false, reason: '연구 체계가 아직 잠겨 있습니다.' }],
});
const before = JSON.stringify(operations);
const render = (props) => renderToStaticMarkup(React.createElement(Operations, props));
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (node.type === GameControlButton) return nodes(GameControlButton(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
};
const createHarness = () => {
  const hooks = { cursor: 0, values: [] };
  return (props) => {
    hooks.cursor = 0; globalThis.__operationsUiHooks = hooks;
    try { return Operations(props); } finally { delete globalThis.__operationsUiHooks; }
  };
};
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const buttons = (tree) => nodes(tree, (node) => node.type === 'button');
const button = (tree, label) => buttons(tree).find((node) => textOf(node).includes(label));
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('actual component and shared controls SSR render a compact closed disclosure with all source rows', () => {
  const html = render({ operations });
  assert.match(html, /<section[^>]*aria-label="정착 운영 요약"[^>]*data-tone="warning"/);
  assert.match(html, /<details class="primitive-operations__details">/);
  assert.match(html, /<summary aria-expanded="false">/);
  assert.ok(html.includes(operations.summaryText));
  assert.ok(html.includes(operations.timingText));
  for (const row of operations.rows) {
    assert.ok(html.includes(`<dt>${row.title}</dt>`));
    assert.ok(html.includes(`<dd>${row.text}</dd>`));
  }
  for (const row of operations.investments) {
    assert.ok(html.includes(row.title)); assert.ok(html.includes(row.text)); assert.ok(html.includes(row.reason));
  }
  assert.match(html, /data-game-sfx="off"/);
});
check('food and fuel issues remain outside the closed details and retain named response controls', () => {
  const draw = createHarness();
  const tree = draw({ operations });
  const detail = nodes(tree, (node) => node.type === 'details')[0];
  const issues = nodes(tree, (node) => node.type === 'ul' && node.props['aria-label'] === '현재 운영 주의사항')[0];
  assert.ok(issues);
  assert.equal(nodes(detail, (node) => node === issues).length, 0);
  for (const issue of operations.issues) assert.ok(textOf(issues).includes(issue.text));
  assert.ok(button(issues, '식량 확보')); assert.ok(button(issues, '캠프 확인'));
  const html = render({ operations });
  assert.ok(html.indexOf('현재 운영 주의사항') > html.indexOf('</details>'));
});
check('native disclosure toggle events preserve keyboard summary semantics and current expanded state', () => {
  const draw = createHarness(); const props = { operations };
  const detail = () => nodes(draw(props), (node) => node.type === 'details')[0];
  assert.equal(detail().props.open, false);
  detail().props.onToggle({ currentTarget: { open: true } });
  assert.equal(detail().props.open, true);
  assert.equal(nodes(draw(props), (node) => node.type === 'summary')[0].props['aria-expanded'], true);
  assert.ok(textOf(nodes(draw(props), (node) => node.type === 'summary')[0]).includes('접기'));
  detail().props.onToggle({ currentTarget: { open: false } });
  assert.equal(detail().props.open, false);
});
check('real control handlers route to food, camp and actual tribe placement while blocked handlers stay inert', () => {
  const draw = createHarness(); const calls = []; const onNavigate = (tabId) => calls.push(tabId);
  const tree = draw({ operations, onNavigate });
  button(tree, '식량 확보').props.onClick(); button(tree, '캠프 확인').props.onClick();
  button(tree, '직업 배치 열기').props.onClick();
  assert.deepEqual(calls, ['actions', 'camp', 'tribe']);
  const blockedTree = draw({ operations, onNavigate, blocked: true });
  for (const node of buttons(blockedTree)) {
    assert.equal(node.props['data-game-sfx'], 'off');
    if (textOf(node).includes('운영 상세 닫기')) continue;
    assert.equal(node.props.disabled, true); node.props.onClick();
  }
  assert.deepEqual(calls, ['actions', 'camp', 'tribe']);
  nodes(blockedTree, (node) => node.type === 'details')[0].props.onToggle({ currentTarget: { open: true } });
  assert.equal(nodes(draw({ operations, blocked: true }), (node) => node.type === 'details')[0].props.open, true);
});
check('Escape and the explicit close control restore summary focus without navigation', () => {
  const draw = createHarness(); const props = { operations, blocked: true };
  const detail = () => nodes(draw(props), (node) => node.type === 'details')[0];
  let focusCount = 0;
  const event = { currentTarget: { closest: () => ({ querySelector: () => ({ focus: () => { focusCount += 1; } }) }) } };
  detail().props.onToggle({ currentTarget: { open: true } });
  let prevented = false;
  detail().props.onKeyDown({ ...event, key: 'Escape', preventDefault: () => { prevented = true; } });
  assert.equal(detail().props.open, false); assert.equal(prevented, true); assert.equal(focusCount, 1);
  detail().props.onToggle({ currentTarget: { open: true } });
  button(draw(props), '운영 상세 닫기').props.onClick(event);
  assert.equal(detail().props.open, false); assert.equal(focusCount, 2);
});
check('allowed navigation closes an open popover and restores focus while blocked or invalid routes preserve it', () => {
  const draw = createHarness(); const calls = []; let focusCount = 0;
  const onNavigate = (tabId) => calls.push(tabId);
  const props = { operations, onNavigate };
  const detail = (current = props) => nodes(draw(current), (node) => node.type === 'details')[0];
  const event = { currentTarget: { closest: (selector) => {
    assert.equal(selector, '.primitive-operations');
    return { querySelector: () => ({ focus: () => { focusCount += 1; } }) };
  } } };
  for (const label of ['식량 확보', '캠프 확인', '직업 배치 열기']) {
    detail().props.onToggle({ currentTarget: { open: true } });
    assert.equal(detail().props.open, true);
    button(draw(props), label).props.onClick(event);
    assert.equal(detail().props.open, false);
  }
  assert.deepEqual(calls, ['actions', 'camp', 'tribe']); assert.equal(focusCount, 3);
  const blocked = { ...props, blocked: true };
  detail(blocked).props.onToggle({ currentTarget: { open: true } });
  button(draw(blocked), '직업 배치 열기').props.onClick(event);
  assert.equal(detail(blocked).props.open, true);
  assert.deepEqual(calls, ['actions', 'camp', 'tribe']); assert.equal(focusCount, 3);
  const staleIssue = { id: 'stale', text: '이동 대상을 다시 확인합니다.', tabId: 'actions' };
  const changed = { ...props, operations: { ...operations, issues: [staleIssue] } };
  const staleButton = button(draw(changed), '식량 확보');
  staleIssue.tabId = 'invalid-tab';
  staleButton.props.onClick(event);
  assert.equal(detail(changed).props.open, true);
  assert.deepEqual(calls, ['actions', 'camp', 'tribe']); assert.equal(focusCount, 3);
});
check('pre-settlement preparation and ended explanations come from the contract without future investment controls', () => {
  const preparation = { ...operations, enabled: false, summaryText: '정착 연구와 식량 저장을 준비합니다.',
    timingText: '비축으로 저녁을 보충하려면 식량 저장 연구가 필요합니다.', issues: [], rows: [], investments: [] };
  const preparingHtml = render({ operations: preparation });
  assert.ok(preparingHtml.includes('정착 준비')); assert.ok(preparingHtml.includes(preparation.summaryText));
  assert.ok(preparingHtml.includes(preparation.timingText));
  const ended = { ...operations, ended: true, summaryText: '종료된 런입니다.',
    timingText: '다음 정산은 진행하지 않습니다.', rows: [] };
  const endedHtml = render({ operations: ended });
  assert.ok(endedHtml.includes('운영 종료')); assert.ok(endedHtml.includes(ended.summaryText));
  assert.ok(endedHtml.includes(ended.timingText));
  assert.equal(buttons(createHarness()({ operations: ended })).length, 1);
  assert.ok(!endedHtml.includes('직업 배치 열기')); assert.ok(!endedHtml.includes('현재 운영 주의사항'));
  assert.ok(!endedHtml.includes('건설에 투자')); assert.equal(render({}), '');
});
check('actual operations getter renders preparation, settlement and ended source text without altering game state', () => {
  const initial = createNewState({ runId: 'operations-ui-fixture', now: '2026-11-01T00:00:00.000Z', rng: () => 0.5 });
  const settled = { ...initial, inventory: { ...initial.inventory, berry: 30, wood: 4 },
    research: { ...initial.research, completed: { ...initial.research.completed, SETTLEMENT: true, FOOD_STORAGE: true } } };
  for (const state of [initial, settled, { ...settled, ended: true }]) {
    freeze(state); const beforeState = JSON.stringify(state);
    const summary = freeze(settlementOperationsSummary(state));
    const html = render({ operations: summary });
    assert.ok(html.includes(summary.summaryText)); assert.ok(html.includes(summary.timingText));
    for (const row of summary.rows) assert.ok(html.includes(`<dd>${row.text}</dd>`));
    assert.equal(JSON.stringify(state), beforeState);
  }
});
check('long source text remains available with wrapping and immutable source records', () => {
  const longText = '매우 긴 설명과 이름이 이어지는 현재 운영 근거 '.repeat(12);
  const long = freeze({ ...operations, summaryText: longText,
    issues: [{ id: 'long', text: longText, tabId: 'actions' }],
    rows: [{ id: 'long', title: longText, text: longText }] });
  const html = render({ operations: long });
  assert.ok(html.includes(`title="${longText}"`)); assert.ok(html.includes(`<dd>${longText}</dd>`));
  assert.ok(html.includes(`<span>${longText}</span>`));
  assert.equal(JSON.stringify(operations), before);
  const css = readFileSync(new URL('src/styles/PrimitiveArchiveOperations.css', root), 'utf8');
  const ast = postcss.parse(css);
  const rules = (selector) => ast.nodes.filter((node) => node.type === 'rule' && node.selector === selector);
  const declarations = (selector) => rules(selector).flatMap((rule) => rule.nodes.filter((node) => node.type === 'decl'));
  assert.ok(declarations('.primitive-operations__summary').some((decl) => decl.prop === 'text-overflow' && decl.value === 'ellipsis'));
  assert.ok(declarations('.primitive-operations__body').some((decl) => decl.prop === 'overflow-wrap' && decl.value === 'anywhere'));
  assert.ok(declarations('.primitive-operations__issues li').some((decl) => decl.prop === 'flex-wrap' && decl.value === 'wrap'));
  assert.ok(declarations('.primitive-operations__body').some((decl) => decl.prop === 'position' && decl.value === 'absolute'));
  assert.ok(declarations('.primitive-operations__body').some((decl) => decl.prop === 'max-height' && decl.value.includes('dvh')));
  assert.ok(declarations('.primitive-operations__body').some((decl) => decl.prop === 'overflow' && decl.value === 'auto'));
  for (const selector of ['.primitive-operations__issues', '.primitive-operations__issues li']) {
    assert.ok(!declarations(selector).some((decl) => ['height', 'max-height', 'overflow'].includes(decl.prop)), 'Persistent issues must not be clipped.');
  }
  assert.match(css, /summary:focus-visible/); assert.match(css, /var\(--era-control-border\)/);
});

delete globalThis.__operationsUiReact;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual operations getter, component and shared control/icon SSR; in-memory React state events and navigation locks; contract-only text and style wrapping checks. Not native browser disclosure timing, visual layout, live state or complete game acceptance.' }));
