import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const root = new URL('../', import.meta.url);
const componentDirectory = new URL('src/app/games/primitive-archive/_components/', root);
const panelUrl = new URL('PrimitiveArchiveProjectsPanel.js', componentDirectory).href;
const growthUrl = new URL('PrimitiveArchiveGrowthTab.js', componentDirectory).href;
const primitivesUrl = new URL('src/app/games/_components/GamePlayPrimitives.js', root).href;
const transformed = new Set([panelUrl, growthUrl, primitivesUrl,
  new URL('src/app/games/_components/GameActionIcon.js', root).href,
  ...['Visuals', 'ResearchTreePreview', 'AdvancementQuote'].map((name) => new URL(`PrimitiveArchive${name}.js`, componentDirectory).href)]);
const hooksUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === growthUrl && specifier === 'react') {
      return { url: hooksUrl, shortCircuit: true };
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
const { default: Projects } = await import(panelUrl);
const { default: Growth } = await import(growthUrl);
const { GameControlButton, ActionButton } = await import(primitivesUrl);
const { createNewState, projectTraditionSummary, reserveProjectTraditionAction, advanceDay } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const selectedProject = freeze({ id: 'drying-rack', name: '공동 건조대', statusLabel: '건설 중',
  costText: '나무 3 · 섬유 2', description: '공동 시설', effectText: '식량 회복 +2 · 완성 시 육포 1개',
  progress: 1, work: 5, progressPct: 20, canWork: true, completed: false, available: true,
  hasCost: true, committed: true, selected: true, missingPrereqs: [] });
const nextProject = freeze({ ...selectedProject, id: 'trail-markers', name: '탐사 표식망', selected: false });
const tradition = freeze({ enabled: true, canReserve: true, reason: '',
  founderId: 'noa', founderName: '노아', availableCharges: 2,
  evidenceText: '노아의 제작·캠프·공동 건설 실제 기여 4회가 전승의 근거입니다.',
  costText: 'AP 소모 없음 · 행동력 1 이상 필요 · 제작·건설 전승 1회 소비',
  effectText: '바로 다음 아침 실제 건설대 작업에 +1 · 영구 완성 효과와 별개 · 적용되지 않아도 이월·환급 없음',
  summaryText: '공동 건조대 · 다음 아침 건설 +1 예약 가능',
  pending: null, pendingText: '현재 예약 없음', lastSettlement: null, lastSettlementText: '새 예약의 실제 정산 기록 없음', records: [],
  selectedProjectId: selectedProject.id, selectedProjectName: selectedProject.name,
  baseWork: 1, remainingWork: 4, bonusWork: 1 });
const propsFor = (extra = {}) => ({ selectedProject, projects: [selectedProject, nextProject],
  projectEstimate: { work: 2, staminaCost: 10 }, projectTradition: tradition,
  hydrated: true, busy: false, ended: false, canAct: true, recentActionText: '기존 작업 결과',
  reserveProjectTradition: () => {}, runProject: () => {}, selectProject: () => {}, ...extra });
const render = (props) => renderToStaticMarkup(React.createElement(Projects, props));
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if ([GameControlButton, ActionButton].includes(node.type)) return nodes(node.type(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
};
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const button = (tree, label) => nodes(tree, (node) => node.type === 'button').find((node) => textOf(node).includes(label));
const reserveButton = (tree) => button(tree, '다음 아침 건설에 전승 예약');
const before = JSON.stringify({ selectedProject, tradition });
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('actual project SSR places a closed tradition disclosure before paid work and preserves source evidence and conditions', () => {
  const html = render(propsFor());
  assert.match(html, /<details class="primitive-project-tradition__details">/);
  assert.match(html, /aria-label="선택 사업의 전승"/);
  for (const text of [tradition.summaryText, tradition.evidenceText, tradition.costText, tradition.effectText,
    tradition.pendingText, tradition.lastSettlementText, selectedProject.effectText]) assert.ok(html.includes(text));
  assert.ok(html.includes('노아')); assert.ok(html.includes('개인 제작과 공유하는 남은 횟수 2'));
  assert.ok(html.indexOf(selectedProject.effectText) < html.indexOf('선택 사업의 전승'));
  assert.ok(html.indexOf('선택 사업의 전승') < html.indexOf('공동 작업 진행'));
  const reserve = reserveButton(Projects(propsFor()));
  assert.equal(reserve.props.disabled, false); assert.equal(reserve.props['data-game-sfx'], 'off');
  const tree = Projects(propsFor());
  const disclosure = nodes(tree, (node) => node.type === 'details' && node.props.className === 'primitive-project-tradition__details')[0];
  assert.ok(reserveButton(disclosure), 'Reservation stays inside the intentionally opened details.');
  const section = nodes(tree, (node) => node.props['aria-label'] === '선택 사업의 전승')[0];
  assert.equal(React.Children.toArray(section.props.children).length, 1, 'Closed display contains only its disclosure.');
});
check('reservation routes once through its own handler and respects getter, hydration, persistence and terminal guards', () => {
  let calls = 0; const reserveProjectTradition = () => { calls += 1; };
  reserveButton(Projects(propsFor({ reserveProjectTradition, canAct: false }))).props.onClick();
  assert.equal(calls, 1, 'Reservation uses its own engine guard, not paid work availability.');
  for (const extra of [{ busy: 'save' }, { busy: 'checkpoint' }, { hydrated: false }, { ended: true },
    { projectTradition: { ...tradition, canReserve: false, reason: '행동력 1 이상이 필요합니다.' } },
    { projectTradition: { ...tradition, enabled: false } }, { reserveProjectTradition: undefined }]) {
    const reserve = reserveButton(Projects(propsFor({ reserveProjectTradition, ...extra })));
    assert.equal(reserve.props.disabled, true); reserve.props.onClick();
  }
  assert.equal(calls, 1);
});
check('pending and actual settlement texts retain their original project, founder, due date and zero-application reason', () => {
  const pendingText = '예약일 21 · 예정일 22';
  const state = { ...tradition, canReserve: false, reason: '오늘 예약은 이미 사용했습니다.',
    pending: { reservedDay: 21, dueDay: 22, projectId: 'trail-markers', founderId: 'shiroko' },
    pendingText: `탐사 표식망 · 시로코 · ${pendingText}`,
    lastSettlement: { projectId: 'palisade', founderId: 'hina', applied: 0 },
    lastSettlementText: '목책 방어선 · 히나 · 실제 적용 +0 · 목표 변경으로 만료' };
  const html = render(propsFor({ projectTradition: state }));
  assert.ok(html.includes(state.pendingText)); assert.ok(html.includes(state.lastSettlementText));
  const tree = Projects(propsFor({ projectTradition: state }));
  const summary = nodes(tree, (node) => node.type === 'summary')[0];
  assert.ok(textOf(summary).includes(state.pendingText));
  assert.ok(html.includes('현재 선택 사업이 예약 대상과 다릅니다.'));
  assert.ok(html.includes(state.reason)); assert.equal(reserveButton(Projects(propsFor({ projectTradition: state }))).props.disabled, true);
});
check('legacy and ended records remain explanatory without invented founder evidence or executable reservation', () => {
  const legacy = { ...tradition, enabled: false, canReserve: false, founderName: '', founderId: '', availableCharges: 0,
    evidenceText: '', reason: '이전 런에서는 사업 전승을 새로 활성화하지 않습니다.',
    pendingText: '예약 기록 없음', lastSettlementText: '사업 전승 정산 미기록(이전 저장)' };
  const html = render(propsFor({ projectTradition: legacy }));
  assert.ok(html.includes(legacy.reason)); assert.ok(html.includes(legacy.lastSettlementText));
  assert.ok(!html.includes(tradition.evidenceText));
  assert.equal(reserveButton(Projects(propsFor({ projectTradition: legacy }))).props.disabled, true);
  assert.equal(reserveButton(Projects(propsFor({ ended: true }))).props.disabled, true);
  assert.ok(!render(propsFor({ projectTradition: undefined })).includes('선택 사업의 전승'));
});
check('only actual supplied records survive on the selected project and completed cards including all-complete runs', () => {
  const record = { projectId: selectedProject.id, founderId: 'noa',
    text: '공동 건조대 · 노아의 실제 공동 작업 전승 2 · 3~4일차 적용 · 6일차 완성' };
  const other = { projectId: nextProject.id, founderId: 'hina',
    text: '탐사 표식망 · 히나의 실제 공동 작업 전승 1 · 8~8일차 적용 · 9일차 완성' };
  const complete = { ...selectedProject, completed: true, canWork: false };
  const props = propsFor({ selectedProject: complete, projects: [complete, { ...nextProject, completed: true }],
    projectTradition: { ...tradition, canReserve: false, records: [record, other] } });
  const tree = Projects(props);
  const selectedRecords = nodes(tree, (node) => node.props['aria-label'] === '선택 사업의 실제 전승 기록')[0];
  assert.ok(textOf(selectedRecords).includes(record.text)); assert.ok(!textOf(selectedRecords).includes(other.text));
  const cardRecords = nodes(tree, (node) => node.type === 'ul' && node.props['aria-label'] === `${nextProject.name}의 실제 전승 기록`)[0];
  assert.ok(textOf(cardRecords).includes(other.text));
  assert.ok(render(props).includes(record.text)); assert.ok(render(props).includes(other.text));
  assert.ok(!render(propsFor({ projects: [complete] })).includes('의 실제 전승 기록'));
});
check('actual getter source text renders through reservation and the next morning actual application', () => {
  const state = createNewState({ runId: 'project-tradition-ui', now: '2026-11-01T00:00:00.000Z', rng: () => 0.5 });
  const actorId = state.party[0].id;
  state.founderHistory.members[0].tallies.craft = 3;
  state.ancestralFaith = { ...state.ancestralFaith, lastRiteDay: state.day, lastRiteFounderId: actorId,
    active: { founderId: actorId, domain: 'craft', day: state.day, remaining: 2 } };
  state.tribe.population = 4; state.tribe.assignments.builder = 1;
  state.inventory = { ...state.inventory, wood: 20, fiber: 20, berry: 30 };
  state.camp = { ...state.camp, fireLevel: 1, fuel: 4, shelterLevel: 1 };
  state.research.completed = { ...state.research.completed, GATHERING: true, SETTLEMENT: true, FOOD_STORAGE: true };
  freeze(state); const beforeState = JSON.stringify(state);
  const ready = projectTraditionSummary(state, actorId);
  assert.equal(ready.canReserve, true);
  const reserved = reserveProjectTraditionAction(state, actorId);
  const pending = projectTraditionSummary(reserved, actorId);
  const settled = projectTraditionSummary(advanceDay(reserved, { rng: () => 0.5 }), actorId);
  assert.ok(pending.pending); assert.ok(settled.lastSettlement); assert.ok(settled.records.length > 0);
  for (const summary of [ready, pending, settled]) {
    const html = render(propsFor({ projectTradition: summary }));
    for (const text of [summary.evidenceText, summary.costText, summary.effectText, summary.pendingText, summary.lastSettlementText]) {
      if (text) assert.ok(html.includes(text));
    }
    for (const record of summary.records) assert.ok(html.includes(record.text));
  }
  assert.equal(JSON.stringify(state), beforeState);
});
check('both actual growth branches forward reservation, summary and guard props to the existing project panel', () => {
  const emptyMap = { nodes: [], edges: [], eras: [], tierHeaders: [], tierCount: 0, width: 0, height: 0 };
  for (const unlocked of [false, true]) {
    const props = { ...propsFor({ busy: 'checkpoint' }), state: { ended: true, research: { selectedTechId: '' },
      civics: { selectedCivicId: '' }, meta: { perkPoints: 0 } },
    research: { unlocked, gateRows: [] }, civics: {}, researchMap: emptyMap, civicMap: emptyMap,
    technologyPlannerRows: [], civicPlannerRows: [], priorityPlannerRows: [], priorityCivicRows: [],
    inspirationRows: [], civicInspirationRows: [], techs: [], civicAdvancements: [], perks: [] };
    const panels = nodes(createHandlerHarness(Growth, props).render(), (node) => node.type === Projects);
    assert.equal(panels.length, 1);
    const forwarded = panels[0].props;
    assert.equal(forwarded.projectTradition, props.projectTradition);
    assert.equal(forwarded.reserveProjectTradition, props.reserveProjectTradition);
    assert.equal(forwarded.hydrated, true); assert.equal(forwarded.busy, 'checkpoint'); assert.equal(forwarded.ended, true);
    assert.equal(reserveButton(Projects(forwarded)).props.disabled, true);
  }
});
check('project targeting and ordinary paid-work handlers remain separate from reserving tradition', () => {
  const calls = []; const props = propsFor({ reserveProjectTradition: () => calls.push('reserve'),
    runProject: () => calls.push('work'), selectProject: (id) => calls.push(id) });
  const tree = Projects(props);
  button(tree, '공동 작업 진행').props.onClick(); button(tree, '지정').props.onClick();
  assert.deepEqual(calls, ['work', 'trail-markers']);
  assert.equal(JSON.stringify({ selectedProject, tradition }), before);
  postcss.parse(readFileSync(new URL('src/styles/PrimitiveArchiveFounders.css', root), 'utf8'));
});

console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual project/shared control SSR, getter/reservation/morning fixture, record display and both actual Growth initial render branches with the shared state/ref/effect hook harness. No browser, build, full lifecycle balance or save acceptance.' }));
